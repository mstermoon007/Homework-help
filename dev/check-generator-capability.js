#!/usr/bin/env node
/**
 * dev/check-generator-capability.js — M2-R05 Capability → Generator Consistency Gate
 *
 * 校验「能力侧（Capability Resolver / Matrix）」与「生成器侧（Generator Registry）」
 * 的一致性（MATH-14 后，legacy GenCap 轨道已删除，此处对 native core 注册表再次收口）：
 *
 *   R05.1 注册表卫生：id 唯一；subject ∈ {math}；capabilities / questionTypes 全部能
 *         归一化为规范 7 类（question-type-registry）；knowledgePoints 引用均存在于知识库。
 *   R05.2 能力→生成器覆盖：每个 KP 的每个 capability QuestionType（matrix 决策
 *         ALLOW/DEGRADE）必须存在至少一个注册生成器支持该题型（等级级覆盖）。
 *         若声明了能力却无人可生成 → ERROR（真缺口）。
 *   R05.3 KP 级绑定：KB 中至少有一个显式绑定生成器的 KP 占可解析 KP 比率（INFO 审计）。
 *
 * ERROR = 0 才 PASS；WARNING 分类输出，不阻断。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-ontology.js'));
var Resolver = require(path.join(ROOT, 'shared', 'capability', 'capability-resolver.js'));
var Matrix = require(path.join(ROOT, 'shared', 'capability', 'capability-matrix.js'));
var Registry = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var GenReg = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));

var SUBJECTS = Ontology.SUBJECTS;
var RECORDS = GenReg.all();
var REG_TYPES = Registry.TYPES.map(function (t) { return t.id; });

function collectKps() {
  var kps = [];
  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) { kps.push(kp); });
      });
    });
  });
  return kps;
}

function run() {
  var kps = collectKps();
  var kpIds = {};
  kps.forEach(function (k) { kpIds[k.id] = 1; });

  // ---- R05.1 注册表卫生 ----
  var dupIds = {};
  var illegalSubject = [];
  var unknownQt = [];        // 归一化后仍非规范类型
  var illegalCap = [];
  var unknownKp = [];
  var seenIds = {};

  RECORDS.forEach(function (r) {
    if (seenIds[r.id]) dupIds[r.id] = (dupIds[r.id] || 1) + 1;
    seenIds[r.id] = 1;
    if (r.subject !== 'math') illegalSubject.push(r.id + ' :: subject=' + r.subject);
    (r.questionTypes || []).forEach(function (t) {
      var n = Registry.normalizeQuestionType(t, { allowHeuristic: false });
      if (!n || !n.id || REG_TYPES.indexOf(n.id) === -1) unknownQt.push(r.id + ' :: ' + t);
    });
    (r.capabilities || []).forEach(function (c) {
      var n = Registry.normalizeQuestionType(c, { allowHeuristic: false });
      if (!n || !n.id || REG_TYPES.indexOf(n.id) === -1) illegalCap.push(r.id + ' :: ' + c);
    });
    (r.knowledgePoints || []).forEach(function (k) {
      if (!kpIds[k]) unknownKp.push(r.id + ' :: ' + k);
    });
  });

  // ---- R05.2 能力→生成器覆盖 ----
  var globalQtCoverage = {};
  REG_TYPES.forEach(function (t) { globalQtCoverage[t] = 0; });
  RECORDS.forEach(function (r) {
    (r.questionTypes || []).forEach(function (t) {
      var n = Registry.normalizeQuestionType(t, { allowHeuristic: false });
      if (n && n.id) globalQtCoverage[n.id]++;
    });
  });

  var capabilityQts = {};    // qt -> set of kpIds declaring it
  var noGeneratorBacking = [];   // qt with capability but 0 generator
  var perKpBacking = 0;          // KP 级显式绑定数
  var declaredKp = 0;            // 有 capability 声明的 KP 数

  kps.forEach(function (kp) {
    var canonical;
    try { canonical = Ontology.normalize(kp); } catch (e) { return; }
    var mx = Matrix.buildMatrix ? Matrix.buildMatrix(canonical) : null;
    var supported = null;
    if (mx && typeof mx === 'object') {
      supported = [];
      (Object.keys(mx.questionTypes || {})).forEach(function (qtId) {
        var cell = mx.questionTypes[qtId];
        if (cell && (cell.decision === 'ALLOW' || cell.decision === 'DEGRADE')) supported.push(qtId);
      });
    }
    if (!supported) {
      var cap = Resolver.resolve(canonical);
      supported = (cap.questionTypes || []).map(function (q) { return q.id; });
    }
    if (!supported) return;
    declaredKp++;
    if (GenReg.forKnowledgePoint(kp.id).length > 0) perKpBacking++;
    supported.forEach(function (qid) {
      capabilityQts[qid] = capabilityQts[qid] || [];
      if (capabilityQts[qid].indexOf(kp.id) === -1) capabilityQts[qid].push(kp.id);
    });
  });

  Object.keys(capabilityQts).forEach(function (qid) {
    if (globalQtCoverage[qid] === 0) {
      noGeneratorBacking.push(qid + ' (declared by ' + capabilityQts[qid].length + ' KP)');
    }
  });

  var report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalKp: kps.length,
    declaredCapabilityKp: declaredKp,
    kpBackedByGenerator: perKpBacking,
    generatorRecordCount: RECORDS.length,
    duplicateGeneratorId: Object.keys(dupIds),
    illegalSubject: illegalSubject,
    unknownGeneratorQuestionType: unknownQt,
    illegalGeneratorCapability: illegalCap,
    unknownGeneratorKnowledgePoint: unknownKp,
    capabilityWithoutGenerator: noGeneratorBacking,
    generatorQuestionTypeCoverage: globalQtCoverage
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'generator-capability-report.json'), JSON.stringify(report, null, 2));

  console.log('M2-R05 Capability → Generator Consistency Gate');
  console.log('');
  console.log('Total KP:                 ' + kps.length);
  console.log('Declared Capability KP:   ' + declaredKp);
  console.log('KP backed by Generator:   ' + perKpBacking);
  console.log('Generator Records:        ' + RECORDS.length);
  console.log('Duplicate Generator IDs:  ' + Object.keys(dupIds).length);
  console.log('Illegal Subject:          ' + illegalSubject.length);
  console.log('Unknown Gen QuestionType: ' + unknownQt.length);
  console.log('Illegal Capability Token: ' + illegalCap.length);
  console.log('Unknown Gen KP:           ' + unknownKp.length);
  console.log('Capability w/o Generator: ' + noGeneratorBacking.length);
  console.log('');
  console.log('Generator QuestionType 覆盖: ' + JSON.stringify(globalQtCoverage));
  if (noGeneratorBacking.length) console.log('  GAP: ' + noGeneratorBacking.join('; '));
  console.log('');
  console.log('Report -> dev/reports/generator-capability-report.json');

  var ok = Object.keys(dupIds).length === 0 && illegalSubject.length === 0 &&
    unknownQt.length === 0 && illegalCap.length === 0 && unknownKp.length === 0 &&
    noGeneratorBacking.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M2-R05 Capability → Generator Consistency Gate' : '[FAIL] M2-R05 Capability → Generator Consistency Gate');
  process.exitCode = ok ? 0 : 1;
}

run();