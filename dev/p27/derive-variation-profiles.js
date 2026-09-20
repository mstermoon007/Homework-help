#!/usr/bin/env node
'use strict';
// dev/p27/derive-variation-profiles.js — P27-09 VariationProfile 变式剖面派生
//
// 目标：把 P25-09 任务书缺口「生成器有隐式变式（未知量/情境/数值），但无显式
// VariationProfile 机制与漂移校验」收口为显式机制。
// 红线（与 P26 evidence 派生同源，不伪造）：
//   - 全部变式轴断言机械派生自真实生成产出（PracticeSession 实际生成 N 题），
//     不做题面 NLP 语义判断、不写 KP ID 分支、不虚构任何「应有变式」。
//   - 与 evidence 全量扩建同一枚举口径：draftSemanticLevel==='A' 的 KP ×
//     KCV.buildEligibility ALLOW 题型行（与 dev/check-allow-generation.js 同机制）。
//
// 五条变式轴（全部为生成产出的事实投影）：
//   unknown        答案位置轴：哪个 data 叶子字段承载答案（跨样本位置集合）
//   numeric        数值轴：答案值是否随样本变化（varies）+ 答案值域
//   context        情境轴：题干含 ≥2 个汉字（排除纯算式形态）的样本占比
//   representation 表征轴：data 中 graphic/svg/picture 类字段及其取值集合
//   structure      结构轴：data.steps 等步数型字段的取值集合
//
// 产出：
//   kbl/teaching/variation-profiles.json            —— 变式剖面 SSOT（供漂移校验比对）
//   dev/p27/reports/variation-derive-report.json    —— 人工可审逐行 + 抽样题干
//
// 用法：node dev/p27/derive-variation-profiles.js [--n 6]

var fs = require('fs');
var path = require('path');
var __dirnameRoot = path.join(__dirname, '..', '..');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(__dirnameRoot, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(__dirnameRoot, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(__dirnameRoot, 'shared', 'engine', 'practice-session.js'));
var Observe = require(path.join(__dirname, 'variation-observe.js'));

var N = 6;
var argN = process.argv.indexOf('--n');
if (argN !== -1 && process.argv[argN + 1]) N = Math.max(2, parseInt(process.argv[argN + 1], 10) || 6);

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var matrix = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'kp-matrix.json'));

var aKps = matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });
var aById = {};
aKps.forEach(function (k) { aById[k.id] = k; });

// ---- ALLOW 行枚举（与 dev/p25/derive-evidence-candidates.js 同机制）----
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!aById[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// ---- 工具：五轴观测逻辑统一取自 variation-observe.js（漂移校验必须同源） ----

// ---- 主循环 ----
var rows = [];
var done = 0;

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
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

    var flags = [];
    if (err) flags.push('gen-error');
    if (!err && samples.length === 0) flags.push('no-sample');
    if (samples.length === 1) flags.push('single-sample');
    var gens = {};
    samples.forEach(function (q) {
      var gen = (q.metadata && q.metadata.generator) || '?';
      gens[gen] = (gens[gen] || 0) + 1;
    });
    if (Object.keys(gens).length > 1) flags.push('multi-generator');

    var obs = samples.length ? Observe.observeRow(samples) : null;
    if (obs) {
      if (!obs.variation.unknown.positions.length) flags.push('unknown-not-observed');
      if (obs.variation.representation.present === false) delete obs.variation.representation.values;
    }

    rows.push({
      knowledgePointId: p.kp,
      questionType: p.qt,
      grade: p.grade,
      variation: obs ? obs.variation : null,
      evidence: {
        samples: samples.length,
        generators: gens,
        samplePrompts: samples.slice(0, 3).map(function (q) { return String(q.prompt).slice(0, 80); })
      },
      flags: flags
    });

    done++;
    if (done % 60 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  // ---- 汇总 ----
  var summary = {
    aKps: aKps.length,
    pairs: pairs.length,
    profiled: 0, genError: 0, noSample: 0, singleSample: 0, unknownNotObserved: 0,
    byQt: {},
    axisCoverage: { unknown: 0, numericVaries: 0, contextPresent: 0, representationPresent: 0, structureMultiStep: 0 }
  };
  rows.forEach(function (r) {
    if (r.variation) summary.profiled++;
    if (r.flags.indexOf('gen-error') !== -1) summary.genError++;
    if (r.flags.indexOf('no-sample') !== -1) summary.noSample++;
    if (r.flags.indexOf('single-sample') !== -1) summary.singleSample++;
    if (r.flags.indexOf('unknown-not-observed') !== -1) summary.unknownNotObserved++;
    summary.byQt[r.questionType] = (summary.byQt[r.questionType] || 0) + 1;
    if (r.variation) {
      if (r.variation.unknown.positions.length) summary.axisCoverage.unknown++;
      if (r.variation.numeric.varies) summary.axisCoverage.numericVaries++;
      if (r.variation.context.present) summary.axisCoverage.contextPresent++;
      if (r.variation.representation.present) summary.axisCoverage.representationPresent++;
      if (r.variation.structure.steps.length > 1) summary.axisCoverage.structureMultiStep++;
    }
  });

  var outProfile = {
    schemaVersion: 'p27-variation.1',
    note: 'P27-09 VariationProfile：五轴全部机械派生自真实生成产出（A 类 KP × ALLOW 行），不虚构；漂移校验见 dev/p27/check-variation-drift.js',
    builtFrom: {
      aClass: 'kbl/teaching/kp-matrix.json draftSemanticLevel=A',
      allow: 'KCV.buildEligibility ALLOW 动态枚举（同 dev/check-allow-generation.js）',
      sampling: { n: N }
    },
    axes: {
      unknown: '答案位置轴：data 叶子值==answer 值的路径集合（跨样本）',
      numeric: '数值轴：distinct 答案数≥2 → varies；附答案值域',
      context: '情境轴：题干含≥2 汉字样本占比≥0.5 → present',
      representation: '表征轴：data 中 graphic/svg/picture 类路径及取值集合',
      structure: '结构轴：data.steps 类字段取值集合'
    },
    policy: {
      hardAxes: ['context', 'representation'],
      softAxes: ['unknown', 'numeric', 'structure'],
      note: '硬轴值无关（生成器题面形态旗标），漂移即 FAIL；软轴依赖 RNG 抽样值/生成器内随机结构，漂移 report-only。结构边界由 validator check#5（maxSteps/structure）另行守护'
    },
    counts: { kps: aKps.length, rows: rows.length, profiled: summary.profiled },
    summary: summary,
    rows: rows
  };
  fs.writeFileSync(path.join(__dirnameRoot, 'kbl', 'teaching', 'variation-profiles.json'),
    JSON.stringify(outProfile, null, 2) + '\n');

  var outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'variation-derive-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    schemaVersion: 'p27-variation-derive.1',
    generatedAt: new Date().toISOString(),
    sampling: { n: N },
    summary: summary,
    rows: rows
  }, null, 2) + '\n');

  console.log('A 类 KP：' + summary.aKps + '，ALLOW 行：' + summary.pairs + '，成剖面行：' + summary.profiled);
  console.log('轴覆盖：' + JSON.stringify(summary.axisCoverage));
  console.log('生成失败行：' + summary.genError + '，无样本行：' + summary.noSample +
    '，单样本行：' + summary.singleSample + '，unknown 未观测行：' + summary.unknownNotObserved);
  console.log('剖面：kbl/teaching/variation-profiles.json');
  console.log('报告：' + outPath);
})().catch(function (e) {
  console.error('派生失败：', e);
  process.exit(1);
});
