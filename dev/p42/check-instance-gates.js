#!/usr/bin/env node
'use strict';
// dev/p42/check-instance-gates.js — P42-4（P42-028/029）实例级质量门禁（合一文件）
//
// 一次重放 1570 ALLOW 面（seed p42|<kp>|<qt>|d3，count=1，difficulty 3——与 P42 面审计
// 同一 seed 协议，见 dev/p42/audit-truth-face.js），对每题跑两段独立检查：
//
//   Section A（P42-028 实例级难度完整性）：difficulty-integrity-validator
//     errors > 0 → FAIL；warnings > 0 → 计数上报（当前口径 numberRange drift）。
//
//   Section B（P42-029 解析质量底线）：quality-scorer.scoreExplanationQuality 四判据
//     < 0.5（空解析/复述）            → FAIL（硬底线）
//     [0.5, 0.6)（登记目标阈值以下）  → watch（不阻断；P42-6 判据④′落地后 judge 布尔
//                                        答案改走「结论词一致」判定，watch 存量 133→25，
//                                        judge 行不再结构性不可达，见 register §0.14）
//     ≥ 0.6                           → pass
//
// 退出码：任一 FAIL → 1；否则 0。证据写 dev/p42/out/p42-4-instance-gate.json。
// 分类逻辑为纯函数（classifyQuestion），tests/generation/p42-4-instance-gate.test.js 直测。
//
// 用法：node dev/p42/check-instance-gates.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var DI = require(path.join(ROOT, 'shared', 'validator', 'difficulty-integrity-validator.js'));
var QS = require(path.join(ROOT, 'shared', 'validator', 'quality-scorer.js'));

// ── 阈值（P42-4 裁决：0.5 硬底线 + 0.6 watch 目标，P42-3 分级阈值先例）──
var QUALITY_FLOOR = 0.5;   // < 0.5 → FAIL
var QUALITY_TARGET = 0.6;  // [0.5, 0.6) → watch

// 纯函数：单题两段分级（无 IO，供 CLI 与测试共用）
function classifyQuestion(q) {
  var d = DI.validateDifficultyIntegrity(q, {});
  var s = QS.scoreExplanationQuality(q);
  return {
    diffFail: !!(d.errors && d.errors.length),
    diffErrN: (d.errors || []).length,
    diffMsg: d.errors && d.errors.length ? String(d.errors[0].message || d.errors[0]).slice(0, 160) : null,
    diffWarn: !!(d.warnings && d.warnings.length),
    quality: s,
    qualityGate: s < QUALITY_FLOOR ? 'fail' : (s < QUALITY_TARGET ? 'watch' : 'pass')
  };
}

function enumeratePairs() {
  var ALL = QTR.TYPES.map(function (t) { return t.id; });
  var pairs = [];
  for (var g = 1; g <= 6; g++) {
    (env.KnowledgeContext.kpsForGrade('math', g) || []).forEach(function (k) {
      var ev = KCV.buildEligibility([k.knowledgeId], ALL);
      var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
      ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
    });
  }
  return pairs;
}

function main() {
  var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
  var pairs = enumeratePairs();
  var stats = { total: 0, genErr: 0, diffFailN: 0, diffWarnN: 0, qPass: 0, qWatch: 0, qFail: 0 };
  var fails = [], watch = [];
  var qualityDist = {};
  var done = 0;

  var run = async function () {
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      try {
        var session = new PracticeSession({
          subject: 'math', grade: p.grade, count: 1, difficulty: 3,
          knowledgePointId: p.kp, questionType: p.qt, seed: 'p42|' + p.kp + '|' + p.qt + '|d3'
        });
        await session.start();
        var q = (session.semanticQuestions || [])[0];
        if (!q) throw new Error('no question');
        stats.total++;
        var c = classifyQuestion(q);
        qualityDist[c.quality] = (qualityDist[c.quality] || 0) + 1;
        if (c.diffFail) {
          stats.diffFailN++;
          if (fails.length < 40) fails.push({ kp: p.kp, qt: p.qt, kind: 'difficulty-integrity', msg: c.diffMsg });
        }
        if (c.diffWarn) stats.diffWarnN++;
        if (c.qualityGate === 'fail') {
          stats.qFail++;
          if (fails.length < 40) fails.push({ kp: p.kp, qt: p.qt, kind: 'explanation-quality', quality: c.quality });
        } else if (c.qualityGate === 'watch') {
          stats.qWatch++;
          if (watch.length < 200) watch.push({ kp: p.kp, qt: p.qt, quality: c.quality });
        } else stats.qPass++;
      } catch (e) {
        stats.genErr++;
        if (fails.length < 40) fails.push({ kp: p.kp, qt: p.qt, kind: 'generation', msg: String((e && e.message) || e).slice(0, 160) });
      }
      done++;
      if (done % 200 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
    }
    process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

    var failTotal = stats.genErr + stats.diffFailN + stats.qFail;
    console.log('P42-4 实例级质量门禁面：' + stats.total + ' 题（生成异常 ' + stats.genErr + '）');
    console.log('  A. 难度完整性（P42-028）：errors=' + stats.diffFailN + '，warnings=' + stats.diffWarnN);
    console.log('  B. 解析质量（P42-029）  ：pass=' + stats.qPass + '，watch=' + stats.qWatch + '，fail=' + stats.qFail
      + '（分布 ' + JSON.stringify(qualityDist) + '，硬底线 ' + QUALITY_FLOOR + '，目标 ' + QUALITY_TARGET + '）');

    var outDir = path.join(__dirname, 'out');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'p42-4-instance-gate.json'), JSON.stringify({
      seed: 'p42|<kp>|<qt>|d3',
      thresholds: { qualityFloor: QUALITY_FLOOR, qualityTarget: QUALITY_TARGET },
      stats: stats,
      qualityDist: qualityDist,
      fails: fails,
      watch: watch
    }, null, 2));

    fails.slice(0, 20).forEach(function (f) {
      console.log('  FAIL ' + f.kp + ' ' + f.qt + ' [' + f.kind + ']' + (f.msg ? ' ' + f.msg : '') + (f.quality != null ? ' quality=' + f.quality : ''));
    });
    console.log('FAIL 合计 ' + failTotal + '（明细/ watch 清单见 dev/p42/out/p42-4-instance-gate.json）');
    process.exit(failTotal ? 1 : 0);
  };

  run().catch(function (e) { console.error('FATAL', e && e.stack || e); process.exit(1); });
}

module.exports = { classifyQuestion: classifyQuestion, QUALITY_FLOOR: QUALITY_FLOOR, QUALITY_TARGET: QUALITY_TARGET };

if (require.main === module) main();
