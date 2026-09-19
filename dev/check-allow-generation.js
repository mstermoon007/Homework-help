#!/usr/bin/env node
'use strict';
// dev/check-allow-generation.js — P24-02 真实性门禁
//
// 逐条验证 KBL 每个 ALLOW(KP, QT) 映射都能真实生成 ≥1 题，
// 且 question.questionType === 请求 QT、题目 KP === 请求 KP。
//
// 背景：KBL capability ALLOW 只声明「应该支持」，本门禁证明「实际可生成」
// （Capability Declaration = Executable Capability）。
// 2026-09-19 P25-06 本体起恢复基线 1570/1570：原被教学裁决覆盖层（teaching-denials.json，
// execution-gap）判 FORBID 的 4 个图形表征 KP × calc，已由 generator:semantic-relations
// 参数化族生成器补齐，4 条 deny 全部撤销（账本置 status=revoked 留痕，resolver ACTIVE 为空）。
// 本脚本按 buildEligibility 的 ALLOW 动态枚举，未来若再登记 ACTIVE deny 基线会相应回落。
//
// 用法：node dev/check-allow-generation.js

var path = require('path');
var ROOT = path.join(__dirname, '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

var ALL = QTR.TYPES.map(function (t) { return t.id; });

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

var fails = [];
var done = 0;

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    try {
      var session = new PracticeSession({
        subject: 'math', grade: p.grade, count: 1,
        knowledgePointId: p.kp, questionType: p.qt
      });
      await session.start();
      var qs = session.semanticQuestions || [];
      var ok = qs.length >= 1 && qs.every(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return q.questionType === p.qt && qk === p.kp;
      });
      if (!ok) fails.push({ kp: p.kp, qt: p.qt, n: qs.length });
    } catch (e) {
      fails.push({ kp: p.kp, qt: p.qt, n: -1, err: String((e && e.message) || e).slice(0, 120) });
    }
    done++;
    if (done % 200 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  console.log('ALLOW 真实性：' + pairs.length + ' 对，PASS ' + (pairs.length - fails.length) + '，FAIL ' + fails.length);
  fails.slice(0, 30).forEach(function (f) {
    console.log('  FAIL ' + f.kp + ' ' + f.qt + ' n=' + f.n + (f.err ? ' ' + f.err : ''));
  });
  if (fails.length > 30) console.log('  …另有 ' + (fails.length - 30) + ' 项失败');
  process.exit(fails.length ? 1 : 0);
})();
