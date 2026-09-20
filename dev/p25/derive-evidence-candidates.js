#!/usr/bin/env node
'use strict';
// dev/p25/derive-evidence-candidates.js — P26 evidence 全量扩建·候选规则派生
//
// 目标：把 P25-04 evidence 体系从 4 个 A 类代表 KP 扩到全部 75 个 A 类 KP（draftSemanticLevel==='A'）。
// 红线：证据规则不得虚构——全部断言机械派生自两类真值源，不做题面 NLP、不写 KP ID 分支：
//   1. 真实生成产出：每个 A 类 KP × ALLOW 题型用 PracticeSession 实际生成 N 题，
//      统计 sq.data 字段稳定性（全样本等值 → required field 候选）、生成器声明
//      semanticEvidence.relations（全样本一致 → required relation 候选）。
//   2. KBL 语义事实（kp-matrix.json semanticFamily/operations + intent-relations.json）：
//      forbidden 仅跨家族守卫（fieldNot data.operation ∉ KP 运算集；relationNot 对侧家族禁表），
//      required relation 必须通过 getAllowedRelations 允许集过滤（否则 check#8 必 fail，不产出）。
//
// 产出：dev/p25/reports/evidence-derive-report.json（人工可审逐行候选 + 基线证据状态 + 抽样题干）
// 消费：dev/p25/apply-evidence-candidates.js（审后合并进 kbl/teaching/evidence-rules.json）
//
// 用法：node dev/p25/derive-evidence-candidates.js [--n 6]

var fs = require('fs');
var path = require('path');
var __dirnameRoot = path.join(__dirname, '..', '..');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(__dirnameRoot, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(__dirnameRoot, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(__dirnameRoot, 'shared', 'engine', 'practice-session.js'));
var KpSemantic = require(path.join(__dirnameRoot, 'shared', 'validator', 'kp-semantic-validator.js'));

var N = 6;
var argN = process.argv.indexOf('--n');
if (argN !== -1 && process.argv[argN + 1]) N = Math.max(2, parseInt(process.argv[argN + 1], 10) || 6);

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var matrix = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'kp-matrix.json'));
var intentRelations = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'intent-relations.json'));
var evidenceRules = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'evidence-rules.json'));

// ---- A 类 KP 清单（75）----
var aKps = matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });
var aById = {};
aKps.forEach(function (k) { aById[k.id] = k; });

// ---- ALLOW 行枚举（与 dev/check-allow-generation.js 同机制）----
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!aById[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// ---- 工具 ----
var OP_NORM = { addition: 'add', subtraction: 'sub', multiplication: 'mult', division: 'div', mixed: 'mixed' };
function kpOpsNorm(ops) {
  return (ops || []).map(function (o) { return OP_NORM[o] || o; });
}

/** data 浅层普查：叶路径 → {t, v}；数组记长度；深度 3；跳过 semanticEvidence（单独处理） */
function census(data, out, prefix, depth) {
  if (data == null || typeof data !== 'object') return;
  Object.keys(data).forEach(function (k) {
    if (k === 'semanticEvidence') return;
    var v = data[k];
    var p = prefix ? prefix + '.' + k : k;
    if (v === null || v === undefined) { out[p] = { t: 'null' }; return; }
    if (Array.isArray(v)) { out[p] = { t: 'array', len: v.length }; return; }
    if (typeof v === 'object') {
      if (depth <= 1) { out[p] = { t: 'object' }; return; }
      census(v, out, p, depth - 1);
      return;
    }
    out[p] = { t: typeof v, v: v };
  });
}

/** KP 语义视图（与 validator getKpSemanticForIntent 同构） */
function kpSemanticOf(kpId) {
  var kp = KC.get(kpId);
  if (!kp) return null;
  var sem = kp.semantic || {};
  return { family: sem.family || null, type: kp.type || null, operations: sem.operations || [] };
}

/** 对侧家族禁表（镜像 validator getAllowedRelations 的兜底方向） */
function crossFamilyForbidden(kpSem) {
  var side = null;
  if (kpSem && (kpSem.type === 'geometry' || kpSem.family === 'geometry')) side = 'geometry';
  else if (kpSem && (kpSem.type === 'calculation' ||
    kpSem.family === 'multiplication-division' || kpSem.family === 'fraction' ||
    kpSem.family === 'decimal' || kpSem.family === 'percent')) side = 'algebra-arithmetic';
  if (!side) return [];
  return (intentRelations.forbiddenAcrossFamilies && intentRelations.forbiddenAcrossFamilies[side]) || [];
}

// ---- 主循环 ----
var rows = [];
var done = 0;
var existingKeys = {};
evidenceRules.rules.forEach(function (r) { existingKeys[r.knowledgePointId + '|' + r.questionType] = true; });

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var kpMeta = aById[p.kp];
    var kpSem = kpSemanticOf(p.kp);
    var allowedRels = KpSemantic.getAllowedRelations(kpSem);

    var samples = [];
    var err = null;
    try {
      var session = new PracticeSession({ subject: 'math', grade: p.grade, count: N, knowledgePointId: p.kp, questionType: p.qt });
      await session.start();
      samples = (session.semanticQuestions || []).filter(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return q.questionType === p.qt && qk === p.kp;
      });
    } catch (e) {
      err = String((e && e.message) || e).slice(0, 160);
    }

    // 字段普查聚合 + 声明聚合 + 基线证据状态
    var fieldAgg = {};   // path -> {present, values:{json:count}, types:{}}
    var declSets = {};   // json( relations ) -> count
    var generators = {};
    var states = {};
    var prompts = [];
    var intentConflicts = [];

    samples.forEach(function (q) {
      var gen = (q.metadata && q.metadata.generator) || '?';
      generators[gen] = (generators[gen] || 0) + 1;

      var flat = {};
      census(q.data, flat, '', 3);
      Object.keys(flat).forEach(function (pth) {
        if (!fieldAgg[pth]) fieldAgg[pth] = { present: 0, values: {}, types: {} };
        var a = fieldAgg[pth];
        a.present++;
        var f = flat[pth];
        a.types[f.t] = true;
        if (f.t !== 'object' && f.t !== 'array' && f.t !== 'null') {
          var j = JSON.stringify(f.v);
          a.values[j] = (a.values[j] || 0) + 1;
        }
      });

      var decl = q.data && q.data.semanticEvidence;
      if (decl && Array.isArray(decl.relations) && decl.relations.length) {
        var key = JSON.stringify(decl.relations.slice().sort());
        declSets[key] = (declSets[key] || 0) + 1;
        // check#8 预演：声明关系越界即意图矛盾（真发现，只上报不派生）
        var conflicts = decl.relations.filter(function (r) { return allowedRels[r] === undefined; });
        if (conflicts.length && Object.keys(allowedRels).length) {
          intentConflicts.push({ generator: gen, relations: decl.relations, conflicts: conflicts });
        }
      }

      var ev = KpSemantic.checkSemanticEvidence(q, p.kp);
      states[ev.state] = (states[ev.state] || 0) + 1;
      if (prompts.length < 3 && q.prompt) prompts.push(String(q.prompt).slice(0, 80));
    });

    // ---- 候选断言派生 ----
    var flags = [];
    if (err) flags.push('gen-error');
    if (samples.length === 0) flags.push('no-sample');
    if (samples.length < N) flags.push('partial-sample');
    var genIds = Object.keys(generators);
    if (genIds.length > 1) flags.push('multi-generator');

    // 确定性基线（P25 门禁同源）：会话输出确定，samples=1 表示该行 distinct 产出空间就是 1 题
    // （count:N 经会话内去重/生成器上限收敛为 1）。契约冻结成立，但须打标供人工评审。
    if (samples.length === 1) flags.push('single-sample');

    var stableFields = [];
    Object.keys(fieldAgg).forEach(function (pth) {
      var a = fieldAgg[pth];
      var scalarTypes = Object.keys(a.types).filter(function (t) { return t === 'string' || t === 'number' || t === 'boolean'; });
      var valKeys = Object.keys(a.values);
      if (a.present === samples.length && scalarTypes.length === 1 && valKeys.length === 1) {
        stableFields.push({ path: 'data.' + pth, value: JSON.parse(valKeys[0]), type: scalarTypes[0] });
      }
    });

    var declKeys = Object.keys(declSets);
    var stableRelations = [];
    if (declKeys.length === 1 && declSets[declKeys[0]] === samples.length) {
      stableRelations = JSON.parse(declKeys[0]);
    } else if (declKeys.length > 1) {
      flags.push('unstable-declaration');
      // 取交集保守派生
      var inter = null;
      declKeys.forEach(function (k) {
        var s = JSON.parse(k);
        inter = inter === null ? s : inter.filter(function (r) { return s.indexOf(r) !== -1; });
      });
      stableRelations = inter || [];
    }

    // required relation 必须在允许集内（越界会让 check#8 fail，不产出）
    var hasAllowedSet = Object.keys(allowedRels).length > 0;
    var requiredRelations = stableRelations.filter(function (r) {
      if (!hasAllowedSet) return false;
      if (allowedRels[r] === undefined) { flags.push('relation-outside-allowed:' + r); return false; }
      return true;
    });
    if (requiredRelations.length && samples.length < 3) flags.push('single-sample-declaration');

    // required fields：全样本等值的标量字段（数值随题变化的字段天然不稳定，不会被选中）
    // 数值字段仅在 ≥3 个 distinct 样本下稳定时才可信（单样本数值可能是巧合值），否则丢弃打标
    var requiredFields = stableFields.filter(function (f) {
      if (typeof f.value === 'number') return samples.length >= 3;
      return true;
    }).map(function (f) { return { kind: 'field', path: f.path, value: f.value }; });
    if (stableFields.some(function (f) { return typeof f.value === 'number'; }) && samples.length < 3) {
      flags.push('numeric-stable-field-dropped');
    }

    // forbidden：跨家族守卫（KBL 派生，不依赖样本）
    var forbidden = [];
    var opsN = kpOpsNorm(kpSem && kpSem.operations);
    if (opsN.length && opsN.indexOf('mixed') === -1) {
      ['add', 'sub', 'mult', 'div'].forEach(function (op) {
        if (opsN.indexOf(op) === -1) forbidden.push({ kind: 'fieldNot', path: 'data.operation', value: op });
      });
    }
    var relRequiredSet = {};
    requiredRelations.forEach(function (r) { relRequiredSet[r] = true; });
    crossFamilyForbidden(kpSem).forEach(function (r) {
      if (!relRequiredSet[r]) forbidden.push({ kind: 'relationNot', relation: r });
    });

    var ruleable = (requiredFields.length + requiredRelations.length) >= 1;
    if (!ruleable && samples.length) flags.push('no-stable-evidence');
    if (existingKeys[p.kp + '|' + p.qt]) flags.push('existing-rule-kept');

    rows.push({
      kp: p.kp,
      name: kpMeta ? kpMeta.name : null,
      family: (kpMeta && kpMeta.semanticFamily) || (kpSem && kpSem.family) || null,
      operations: (kpMeta && kpMeta.operations) || [],
      grade: p.grade,
      qt: p.qt,
      generators: generators,
      samples: samples.length,
      baselineStates: states,
      declaredRelations: declKeys.map(function (k) { return { relations: JSON.parse(k), count: declSets[k] }; }),
      allowedRelations: Object.keys(allowedRels),
      stableFields: stableFields,
      intentConflicts: intentConflicts.slice(0, 3),
      candidate: ruleable ? {
        knowledgePointId: p.kp,
        knowledgePointName: kpMeta ? kpMeta.name : undefined,
        questionType: p.qt,
        kblAnchor: 'semantic.family=' + (kpMeta && kpMeta.semanticFamily) + '; semantic.operations=[' + ((kpMeta && kpMeta.operations) || []).join(',') + ']',
        required: requiredRelations.map(function (r) { return { kind: 'relation', relation: r }; }).concat(requiredFields),
        forbidden: forbidden
      } : null,
      flags: flags,
      samplePrompts: prompts
    });

    done++;
    if (done % 40 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  // ---- 汇总 ----
  var summary = {
    aKps: aKps.length,
    pairs: pairs.length,
    genError: 0, noSample: 0, ruleable: 0, notRuleable: 0, existingKept: 0,
    baseline: { pass: 0, warn: 0, skip: 0, fail: 0 },
    intentConflictRows: 0,
    byQt: {}
  };
  rows.forEach(function (r) {
    if (r.flags.indexOf('gen-error') !== -1) summary.genError++;
    if (r.flags.indexOf('no-sample') !== -1) summary.noSample++;
    if (r.candidate) summary.ruleable++; else summary.notRuleable++;
    if (r.flags.indexOf('existing-rule-kept') !== -1) summary.existingKept++;
    if (r.intentConflicts.length) summary.intentConflictRows++;
    Object.keys(r.baselineStates).forEach(function (s) { summary.baseline[s] = (summary.baseline[s] || 0) + r.baselineStates[s]; });
    summary.byQt[r.qt] = (summary.byQt[r.qt] || 0) + 1;
  });

  var outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'evidence-derive-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    schemaVersion: 'p26-evidence-derive.1',
    generatedAt: new Date().toISOString(),
    sampling: { n: N },
    builtFrom: {
      aClass: 'kbl/teaching/kp-matrix.json draftSemanticLevel=A',
      allow: 'KCV.buildEligibility ALLOW 动态枚举（同 dev/check-allow-generation.js）',
      relations: 'kbl/teaching/intent-relations.json',
      existing: 'kbl/teaching/evidence-rules.json ' + evidenceRules.schemaVersion
    },
    summary: summary,
    rows: rows
  }, null, 2) + '\n');

  console.log('A 类 KP：' + summary.aKps + '，ALLOW 行：' + summary.pairs);
  console.log('可派生候选行：' + summary.ruleable + '，无稳定证据行：' + summary.notRuleable + '，已有规则保留：' + summary.existingKept);
  console.log('基线证据状态分布：' + JSON.stringify(summary.baseline));
  console.log('生成失败行：' + summary.genError + '，无样本行：' + summary.noSample + '，意图矛盾行：' + summary.intentConflictRows);
  console.log('报告：' + outPath);
  rows.filter(function (r) { return r.flags.indexOf('gen-error') !== -1; }).slice(0, 20).forEach(function (r) {
    console.log('  GEN-ERROR ' + r.kp + '×' + r.qt);
  });
})().catch(function (e) {
  console.error('派生失败：', e);
  process.exit(1);
});
