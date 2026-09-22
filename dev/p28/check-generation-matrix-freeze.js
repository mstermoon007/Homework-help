#!/usr/bin/env node
'use strict';
// dev/p28/check-generation-matrix-freeze.js — P28-08 生成矩阵最终冻结
//
// 冻结判定：1570 条 ALLOW(KP, QT) 生成矩阵 = 动态能力端点（buildEligibility 动态枚举），
// 每条逐一对齐一条真实 Generator、真实生成 ≥1 题、通过 Validator（KpSemantic 全量语义校验）、
// 产出是合法 SemanticQuestion（Schema 校验）、questionType/KP 与 ALLOW 记录一致、
// 非空/非占位/非回退（禁 fake/placeholder/empty/fallback 题）。
//
// 判定规则：
//   统计 ALLOW 静态矩阵 == 1570 == 动态枚举；每行 pluginId ∈ GeneratorRegistry（真实）；
//   逐行重生成证据：n≥1、qt/kp 匹配、Schema valid、KpSemantic valid、TypeContract ok、
//   元数据 generator 真实、prompt 非空非占位、answer 非空。任一 FAIL → 退出码 1。
//
// 产物：
//   docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.json（含逐行冻结证据）
//   docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.md（冻结结论）
//
// 用法：node dev/p28/check-generation-matrix-freeze.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var SQ = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
var KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
var TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
var R = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var MATRIX_FILE = path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json');

var CANONICAL = QTR.TYPES.map(function (t) { return t.id; });
var PLACEHOLDER = /占位|placeholder|TODO|待定|待补充|Lorem|^\.{3,}$/;

function gradeOf(kp) {
  var m = /^math-g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

// ---------- 1. 静态矩阵 ----------
var matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf8'));
var rows = matrix.mappings || [];
var rowSet = {};
rows.forEach(function (r) { rowSet[r.knowledgeId + '/' + r.questionType] = r; });

// ---------- 2. 动态能力端点 ----------
var ALL = CANONICAL;
var kps = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    kps.push({ id: k.knowledgeId, grade: g });
  });
}
var pairs = [];
kps.forEach(function (k) {
  var ev = KCV.buildEligibility([k.id], ALL);
  var m = (ev.matrix && ev.matrix[k.id]) || {};
  ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.id, grade: k.grade, qt: t }); });
});

// ---------- 3. 一致性断言 ----------
var registryIds = {};
R.all().forEach(function (rec) { registryIds[rec.id] = 1; });

function consistency() {
  var lines = [];
  var ok = true;
  if (rows.length !== 1570) { ok = false; lines.push('静态矩阵行数 ' + rows.length + ' != 1570'); }
  if ((matrix.stats || {}).allow !== 1570) { ok = false; lines.push('stats.allow ' + matrix.stats.allow + ' != 1570'); }
  if (pairs.length !== 1570) { ok = false; lines.push('动态枚举 ' + pairs.length + ' != 1570'); }
  if (rows.some(function (r) { return r.permission !== 'allow'; })) {
    ok = false; lines.push('存在 permission != allow 的行');
  }
  var missingIds = {};
  rows.forEach(function (r) { if (!registryIds[r.pluginId]) missingIds[r.pluginId] = 1; });
  if (Object.keys(missingIds).length) { ok = false; lines.push('matrix pluginId 缺失于注册表: ' + Object.keys(missingIds).join(',')); }
  if (pairs.some(function (p) { return !rowSet[p.kp + '/' + p.qt]; })) { ok = false; rows.length && lines.push('动态枚举含矩阵外条目'); }
  if (rows.some(function (r) { return !pairs.some(function (p) { return p.kp === r.knowledgeId && p.qt === r.questionType; }); })) {
    ok = false; lines.push('矩阵含动态枚举外条目');
  }
  var qts = {};
  rows.forEach(function (r) { qts[r.questionType] = 1; });
  if (Object.keys(qts).length !== 7 || CANONICAL.some(function (t) { return !qts[t]; })) {
    ok = false; lines.push('矩阵题型集合 ≠ 规范 7 类: ' + Object.keys(qts).join(','));
  }
  var kpCount = {};
  rows.forEach(function (r) { kpCount[r.knowledgeId] = 1; });
  if (Object.keys(kpCount).length !== 375) { ok = false; lines.push('矩阵 KP 数 ' + Object.keys(kpCount).length + ' != 375'); }
  return { ok: ok, lines: lines };
}

// ---------- 4. 逐行重生成冻结证据 ----------
var evidence = [];
var summaries = {
  n0: 0, schemaFail: 0, kpSemFail: 0, tcFail: 0, typeFail: 0, kpFail: 0,
  genFail: 0, emptyFail: 0, placeholderFail: 0, ansFail: 0, rowFail: 0
};
var fails = [];

(async function run() {
  var cons = consistency();
  console.log('矩阵一致性：' + (cons.ok ? 'PASS' : 'FAIL'));
  cons.lines.forEach(function (l) { console.log('  - ' + l); });
  if (!cons.ok) fails.push({ phase: 'consistency', lines: cons.lines });

  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var row = rowSet[p.kp + '/' + p.qt];
    var rec = {
      kp: p.kp, qt: p.qt, pluginId: row ? row.pluginId : null,
      generator: null, schema: 1, kpSem: 1, tc: 1, realGen: 1,
      promptLen: 0, sample: '', ans: '', ok: true, err: null
    };
    try {
      var session = new PracticeSession({
        subject: 'math', grade: gradeOf(p.kp), count: 1,
        knowledgePointId: p.kp, questionType: p.qt
      });
      await session.start();
      var qs = session.semanticQuestions || [];
      var q = qs[0];
      if (!q) { rec.ok = false; rec.err = 'no question'; summaries.n0++; }
      else {
        rec.generator = (q.metadata && q.metadata.generator) || null;
        if (!rec.generator || !registryIds[rec.generator]) { rec.realGen = 0; summaries.genFail++; }
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        if (q.questionType !== p.qt) { rec.ok = false; summaries.typeFail++; }
        if (qk !== p.kp) { rec.ok = false; summaries.kpFail++; }

        var sv = SQ.validateSchema(q);
        if (!sv.valid) { rec.schema = 0; rec.ok = false; summaries.schemaFail++; rec.err = 'schema'; }

        var plan = { knowledgePointIds: [p.kp], questionTypeId: p.qt, difficulty: 5, count: 1 };
        var kv = KpSem.validateKpSemantics(q, { plan: plan, kpId: p.kp });
        if (!kv.valid) { rec.kpSem = 0; rec.ok = false; summaries.kpSemFail++; rec.err = 'kpSem'; }

        var tv = TC.check(p.qt, q);
        if (!tv.ok) { rec.tc = 0; rec.ok = false; summaries.tcFail++; rec.err = 'typeContract'; }

        var prompt = String(q.prompt || '');
        rec.promptLen = prompt.length;
        rec.sample = prompt.slice(0, 36);
        if (prompt.trim().length < 4) { rec.ok = false; summaries.emptyFail++; }
        if (PLACEHOLDER.test(prompt)) { rec.ok = false; summaries.placeholderFail++; }

        var an = q.answer;
        if (!an || an.value === undefined || an.value === null || an.value === '') {
          rec.ok = false; summaries.ansFail++; rec.err = 'answer';
        } else {
          rec.ans = String(an.value).slice(0, 24);
        }

        rec.ok = rec.ok && rec.realGen === 1 && rec.schema === 1 && rec.kpSem === 1 && rec.tc === 1;
      }
    } catch (e) {
      rec.ok = false;
      rec.err = String((e && e.message) || e).slice(0, 120);
      summaries.n0++;
    }
    if (!rec.ok) fails.push(rec);
    evidence.push(rec);
    if (i % 200 === 0) process.stdout.write('\r  冻结进度 ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  冻结进度 ' + pairs.length + '/' + pairs.length + '          \n');

  var rowFails = summaryCountRow(summaries);
  console.log('冻结复核：ALLOW rows=' + pairs.length + '，FAIL rows=' + rowFails);
  fails.slice(0, 30).forEach(function (f) { console.log('  FAIL ' + f.kp + ' ' + f.qt + ' gen=' + f.generator + ' ' + f.err); });

  var generated = pairs.length - summaries.n0;
  var artifact = {
    task: 'P28-08 1570 Generation Matrix 最终冻结',
    date: new Date().toISOString().slice(0, 10),
    matrixFile: 'shared/knowledge/mappings/generation-contract/math.json',
    matrixCount: rows.length,
    canonicalTypes: CANONICAL,
    counts: {
      allow: pairs.length,
      realGenerated: generated,
      validated: pairs.length - summaries.kpSemFail - summaries.n0,
      semanticValid: pairs.length - summaries.schemaFail - summaries.n0,
      typeContractOk: pairs.length - summaries.tcFail - summaries.n0,
      realGenerator: pairs.length - summaries.genFail - summaries.n0,
      noPlaceholder: pairs.length - summaries.placeholderFail - summaries.n0,
      noEmpty: pairs.length - summaries.emptyFail - summaries.n0
    },
    summaries: summaries,
    consistency: cons,
    frozen: rowFails === 0 && cons.ok,
    evidence: evidence
  };

  fs.mkdirSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28'), { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-GENERATION-MATRIX-FROZEN.json'),
    JSON.stringify(artifact, null, 1) + '\n'
  );
  writeMd(artifact, rowFails, cons, generated);
  console.log('产物已写入 docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.{json,md}');
  process.exit(artifact.frozen ? 0 : 1);
})().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});

function summaryCountRow(s) {
  var rowFail = 0;
  ['n0', 'schemaFail', 'kpSemFail', 'tcFail', 'typeFail', 'kpFail', 'genFail', 'emptyFail', 'placeholderFail', 'ansFail']
    .forEach(function (k) { if (s[k] > 0) rowFail += 1; });
  s.rowFail = rowFail;
  return rowFail;
}

function writeMd(a, rowFails, cons, generated) {
  var md = [];
  md.push('# P28-Generation-Matrix-Freeze — 1570 生成矩阵最终冻结');
  md.push('');
  md.push('| 项 | 值 |');
  md.push('|---|---|');
  md.push('| 任务 | P28-08 生成矩阵最终冻结：1570 条 ALLOW(KP, QuestionType) 逐条对齐真实 Generator、真实生成、通过 Validator、产出合法 SemanticQuestion；禁 fake/placeholder/empty/fallback 题 |');
  md.push('| 执行日期 | ' + a.date + ' |');
  md.push('| 判定规则 | 静态矩阵 == 动态能力端点 == 1570；每行 pluginId ∈ GeneratorRegistry；逐行重生成证据 10 项全绿 |');
  md.push('');
  md.push('## 1. 矩阵一致性');
  md.push('');
  md.push('| 项 | 值 | 结论 |');
  md.push('|---|---|---|');
  md.push('| 静态矩阵行（generation-contract/math.json） | ' + rows.length + ' | ' + (cons.ok ? '✅' : '❌') + ' |');
  md.push('| stats.allow | ' + ((matrix.stats || {}).allow) + ' | ✅ |');
  md.push('| 动态能力端点（buildEligibility 枚举） | ' + pairs.length + ' | ' + (pairs.length === 1570 ? '✅' : '❌') + ' |');
  md.push('| 规范 7 类覆盖 | ' + CANONICAL.join('/') + ' | ✅ |');
  md.push('| 矩阵 KP 数 | ' + new Set(rows.map(function (r) { return r.knowledgeId; })).size + ' | ✅ 375 |');
  md.push('| matrix pluginId 全数落于注册表 | — | ' + (cons.lines.filter(function (l) { return l.indexOf('pluginId') !== -1; }).length ? '❌' : '✅') + ' |');
  md.push('');
  md.push('## 2. 1570 逐行重生成冻结复核');
  md.push('');
  md.push('| 检查 | 通过 | FAIL |');
  md.push('|---|---|---|');
  md.push('| 真实生成（n≥1，无空/异常） | ' + generated + ' | ' + a.summaries.n0 + ' |');
  md.push('| questionType === ALLOW 记录 | ' + (pairs.length - a.summaries.typeFail) + ' | ' + a.summaries.typeFail + ' |');
  md.push('| KP === ALLOW 记录 | ' + (pairs.length - a.summaries.kpFail) + ' | ' + a.summaries.kpFail + ' |');
  md.push('| SemanticQuestion Schema 校验 | ' + (pairs.length - a.summaries.schemaFail) + ' | ' + a.summaries.schemaFail + ' |');
  md.push('| Validator（KpSemantic 全量语义） | ' + (pairs.length - a.summaries.kpSemFail) + ' | ' + a.summaries.kpSemFail + ' |');
  md.push('| TypeContract 7 类不变量 | ' + (pairs.length - a.summaries.tcFail) + ' | ' + a.summaries.tcFail + ' |');
  md.push('| 真实 Generator（元数据，非回退/适配） | ' + (pairs.length - a.summaries.genFail) + ' | ' + a.summaries.genFail + ' |');
  md.push('| prompt 非空非占位 | ' + (pairs.length - a.summaries.emptyFail - a.summaries.placeholderFail) + ' | ' + (a.summaries.emptyFail + a.summaries.placeholderFail) + ' |');
  md.push('| answer 非空 | ' + (pairs.length - a.summaries.ansFail) + ' | ' + a.summaries.ansFail + ' |');
  md.push('');
  md.push('## 3. 冻结结论');
  md.push('');
  md.push(rowFails === 0 && cons.ok
    ? '**ALLOW = ' + pairs.length + ' · 真实生成 = ' + generated + ' · 全部通过 Validator/Schema/TypeContract/真实性检查 —— 1570 生成矩阵冻结 ✅**'
    : '**存在 FAIL ' + rowFails + ' 项 —— 冻结未通过 ❌**');
  md.push('');
  md.push('逐行冻结证据：`docs/archive/phases/p28/P28-GENERATION-MATRIX-FROZEN.json`（' + evidence.length + ' 行）。');
  md.push('');
  md.push('## 4. 门禁');
  md.push('');
  md.push('- `node dev/p28/check-generation-matrix-freeze.js` —— 复跑本冻结（退出码 0 = 冻结保持，1 = 违规）');
  md.push('- `node dev/check-allow-generation.js` —— P24-02 动态真实性（1570/1570）配套');
  fs.writeFileSync(path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-GENERATION-MATRIX-FROZEN.md'), md.join('\n') + '\n');
}