#!/usr/bin/env node
'use strict';
// dev/p27/check-variation-drift.js — P27-09 VariationProfile 漂移校验（门禁）
//
// 重新真实生成 N 题并与 kbl/teaching/variation-profiles.json 比对变式分布。
// 契约分两级（依据：跨运行 RNG 基种子非确定，值依赖轴与生成器内随机结构天然抖动）：
//   HARD（题面形态旗标，值无关；漂移即 exit 1）：
//     - context.present         情境词有无（≥2 汉字样本占比 ≥0.5）
//     - representation.present  表征路径有无
//     - representation.paths    表征路径集合
//   SOFT（值/结构依赖轴；漂移只上报不拦截）：
//     - unknown.positions       答案承载位集合（依赖答案值与 data 叶子值碰撞）
//     - numeric.varies / 值域    答案值散布（依赖 RNG 抽样空间）
//     - structure.steps         步数集合（部分生成器按样本随机步数；
//                                结构边界由 validator check#5 另行守护）
//
// 用法：node dev/p27/check-variation-drift.js [--n 6] [--report-only]

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
var REPORT_ONLY = false;
var argN = process.argv.indexOf('--n');
if (argN !== -1 && process.argv[argN + 1]) N = Math.max(2, parseInt(process.argv[argN + 1], 10) || 6);
if (process.argv.indexOf('--report-only') !== -1) REPORT_ONLY = true;

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var profile = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'variation-profiles.json'));
var matrix = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'kp-matrix.json'));

var profByKey = {};
profile.rows.forEach(function (r) {
  profByKey[r.knowledgePointId + '|' + r.questionType + '|' + r.grade] = r;
});

var aKps = {};
matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; })
  .forEach(function (k) { aKps[k.id] = true; });

var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!aKps[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// ---- 比对 ----
function diffRow(prof, obs) {
  var hard = [];
  var soft = [];
  var pv = prof.variation, ov = obs.variation;
  if (pv.context.present !== ov.context.present) hard.push('context.present ' + pv.context.present + '→' + ov.context.present);
  if (pv.representation.present !== ov.representation.present) hard.push('representation.present ' + pv.representation.present + '→' + ov.representation.present);
  if (JSON.stringify(pv.representation.paths) !== JSON.stringify(ov.representation.paths)) {
    hard.push('representation.paths ' + JSON.stringify(pv.representation.paths) + '→' + JSON.stringify(ov.representation.paths));
  }
  if (JSON.stringify(pv.structure.steps) !== JSON.stringify(ov.structure.steps)) {
    soft.push('structure.steps ' + JSON.stringify(pv.structure.steps) + '→' + JSON.stringify(ov.structure.steps));
  }
  if (JSON.stringify(pv.unknown.positions) !== JSON.stringify(ov.unknown.positions)) {
    soft.push('unknown.positions ' + JSON.stringify(pv.unknown.positions) + '→' + JSON.stringify(ov.unknown.positions));
  }
  if (pv.numeric.varies !== ov.numeric.varies) soft.push('numeric.varies ' + pv.numeric.varies + '→' + ov.numeric.varies);
  return { hard: hard, soft: soft };
}

(async function run() {
  var checked = 0, skipped = 0, hardViolations = [], softReports = [], genErrors = [];
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var prof = profByKey[p.kp + '|' + p.qt + '|' + p.grade];
    if (!prof || !prof.variation) { skipped++; continue; }
    if (prof.flags.indexOf('gen-error') !== -1 || prof.flags.indexOf('no-sample') !== -1) { skipped++; continue; }

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
    if (err || !samples.length) {
      genErrors.push({ kp: p.kp, qt: p.qt, grade: p.grade, error: err || 'no-sample' });
      continue;
    }

    var obs = Observe.observeRow(samples);
    var d = diffRow(prof, obs);
    checked++;
    if (d.hard.length) hardViolations.push({ kp: p.kp, qt: p.qt, grade: p.grade, hard: d.hard });
    if (d.soft.length && softReports.length < 200) softReports.push({ kp: p.kp, qt: p.qt, grade: p.grade, soft: d.soft });

    if ((i + 1) % 60 === 0) process.stdout.write('\r  进度 ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + pairs.length + '/' + pairs.length + '          \n');

  var outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'variation-drift-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    schemaVersion: 'p27-variation-drift.1',
    generatedAt: new Date().toISOString(),
    sampling: { n: N },
    contract: { hard: ['context.present', 'representation.present', 'representation.paths'], soft: ['unknown.positions', 'numeric.varies', 'structure.steps'] },
    summary: { checked: checked, skipped: skipped, genErrors: genErrors.length, hardViolations: hardViolations.length, softReports: softReports.length },
    hardViolations: hardViolations,
    softReports: softReports,
    genErrors: genErrors.slice(0, 50)
  }, null, 2) + '\n');

  console.log('比对行：' + checked + '，跳过行：' + skipped + '，生成异常行：' + genErrors.length);
  console.log('硬违例（结构轴漂移）：' + hardViolations.length);
  console.log('软报告（值依赖轴抖动）：' + softReports.length + '（report-only）');
  console.log('报告：' + outPath);
  hardViolations.slice(0, 20).forEach(function (v) {
    console.log('  HARD-DRIFT ' + v.kp + '×' + v.qt + ' @g' + v.grade + ' :: ' + v.hard.join(' | '));
  });

  if (hardViolations.length && !REPORT_ONLY) {
    console.error('[P27-09] 漂移门禁 FAIL：结构轴漂移 ' + hardViolations.length + ' 行');
    process.exit(1);
  }
  console.log('[P27-09] 漂移门禁 ' + (REPORT_ONLY ? 'REPORT-ONLY' : 'PASS'));
})().catch(function (e) {
  console.error('漂移校验失败：', e);
  process.exit(1);
});
