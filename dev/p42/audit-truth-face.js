#!/usr/bin/env node
'use strict';
// dev/p42/audit-truth-face.js — P42-1C 1570 确定性面独立真值审计（只读，不写生产数据）
//
// 逐条复现 P42-0 审计面（seed p42|<kp>|<qt>|d3，count=1，d3），用 truth-verifier
// 对题干（含空位代入一致性）+ 解析（等式真值）独立重算。
// 输出：PASS / FAIL / UNVERIFIED 统计 + FAIL 明细（若有 FAIL 须登记，不得顺手修）。
//
// 用法：node dev/p42/audit-truth-face.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var V = require(path.join(__dirname, 'truth-verifier.js'));

var ALL = QTR.TYPES.map(function (t) { return t.id; });

var pairs = [];
for (var g = 1; g <= 6; g++) {
  (env.KnowledgeContext.kpsForGrade('math', g) || []).forEach(function (k) {
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

var stats = { total: 0, PASS: 0, FAIL: 0, UNVERIFIED: 0 };
var promptChecked = 0, explChecked = 0;
var fails = [];
var done = 0;

(async function run() {
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
      var r = V.auditQuestion(q);
      stats.total++;
      stats[r.status]++;
      promptChecked += r.prompt.checked;
      explChecked += r.explanation.checked;
      if (r.status === 'FAIL') {
        fails.push({ kp: p.kp, qt: p.qt, failures: r.failures, prompt: q.prompt, expl: q.answer && q.answer.explanation });
      }
    } catch (e) {
      stats.total++;
      stats.UNVERIFIED++;
      fails.push({ kp: p.kp, qt: p.qt, failures: ['SESSION-ERROR: ' + String((e && e.message) || e).slice(0, 120)] });
    }
    done++;
    if (done % 200 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  console.log('P42-1C 真值审计面：' + stats.total + ' 题');
  console.log('  PASS       ' + stats.PASS);
  console.log('  FAIL       ' + stats.FAIL);
  console.log('  UNVERIFIED ' + stats.UNVERIFIED);
  console.log('  覆盖子句：题干 ' + promptChecked + ' + 解析 ' + explChecked + ' = ' + (promptChecked + explChecked));

  var outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'p42-1c-truth-audit.json'), JSON.stringify({
    seed: 'p42|<kp>|<qt>|d3',
    stats: stats,
    checkedClauses: { prompt: promptChecked, explanation: explChecked },
    fails: fails
  }, null, 2));

  fails.slice(0, 20).forEach(function (f) {
    console.log('  FAIL ' + f.kp + ' ' + f.qt);
    (f.failures || []).slice(0, 3).forEach(function (msg) { console.log('    ' + msg.slice(0, 160)); });
  });
  if (fails.length > 20) console.log('  …另有 ' + (fails.length - 20) + ' 项，详见 out/p42-1c-truth-audit.json');
  process.exit(stats.FAIL ? 1 : 0);
})();
