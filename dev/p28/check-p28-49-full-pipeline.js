#!/usr/bin/env node
'use strict';
// dev/p28/check-p28-49-full-pipeline.js — P28-49 最终真实生成验证
//
// 在 P24-02 check-allow-generation.js（Generate + Validate）基础上，
// 对每个 ALLOW(KP, QT) 对补齐完整链路：
//   Generate → Validate → SemanticQuestion → Render
//
// 四步判定：
//   1. Generate：PracticeSession.start() 产出 ≥1 题
//   2. Validate：每题 questionType === 请求 QT、KP 绑定 === 请求 KP
//   3. SemanticQuestion：semantic-question.validateSchema 无 ERROR 级问题
//   4. Render：HTMLRenderer.render(sq, 0, {mode:'screen'}) 不抛异常，
//      且输出 HTML 含与 QT 对应的 style-* 样式类
//
// 用法：node dev/p28/check-p28-49-full-pipeline.js

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// SVG 生成器须先于首次渲染就绪（与 renderer.test.js 一致）
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-calculation.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-make-ten.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-chart.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-diagram.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-currency.js'));
require(path.join(ROOT, 'shared', 'presentation', 'svg-sanitizer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

var SemanticSchema = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
var HTMLRenderer = require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));

// QT → 期望 style 类名（与 question-style-strategy.js 基础映射一致）
var QT_STYLE = {
  calc: 'style-calc',
  fill: 'style-fill',
  choice: 'style-choice',
  judge: 'style-judge',
  apply: 'style-story',
  geometry: 'style-shape',
  classify: 'style-sort'
};

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
var passRender = 0;

function classifyRender(qt, html) {
  var expected = QT_STYLE[qt];
  if (!expected) return { ok: true, reason: 'no-style-mapping-for-' + qt };
  if (html.indexOf(expected) >= 0) return { ok: true };
  // 取实际出现的 style-* 类供诊断
  var m = html.match(/style-[a-z]+/);
  return { ok: false, reason: 'expected ' + expected + ' got ' + (m ? m[0] : '(none)') };
}

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

      // Step 1+2: Generate + Validate
      if (qs.length < 1) {
        fails.push({ kp: p.kp, qt: p.qt, step: 'generate', n: 0 });
        done++; continue;
      }
      var valid = qs.every(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return q.questionType === p.qt && qk === p.kp;
      });
      if (!valid) {
        fails.push({ kp: p.kp, qt: p.qt, step: 'validate', n: qs.length });
        done++; continue;
      }

      // Step 3: SemanticQuestion schema（无 ERROR）
      var schemaOk = qs.every(function (q) {
        var r = SemanticSchema.validateSchema(q);
        return r.valid && (!r.errors || r.errors.length === 0);
      });
      if (!schemaOk) {
        fails.push({ kp: p.kp, qt: p.qt, step: 'semantic', n: qs.length });
        done++; continue;
      }

      // Step 4: Render
      var renderOk = true;
      var renderReason = '';
      for (var j = 0; j < qs.length; j++) {
        var html;
        try {
          html = HTMLRenderer.render(qs[j], j, { mode: 'screen' });
        } catch (e) {
          renderOk = false; renderReason = 'throw:' + String((e && e.message) || e).slice(0, 80); break;
        }
        if (typeof html !== 'string' || html.length < 10) {
          renderOk = false; renderReason = 'empty-html'; break;
        }
        var cr = classifyRender(p.qt, html);
        if (!cr.ok) { renderOk = false; renderReason = cr.reason; break; }
      }
      if (!renderOk) {
        fails.push({ kp: p.kp, qt: p.qt, step: 'render', n: qs.length, reason: renderReason });
        done++; continue;
      }
      passRender++;
    } catch (e) {
      fails.push({ kp: p.kp, qt: p.qt, step: 'exception', n: -1, err: String((e && e.message) || e).slice(0, 120) });
    }
    done++;
    if (done % 100 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '  render-pass ' + passRender);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '  render-pass ' + passRender + '          \n');

  var total = pairs.length;
  var passed = total - fails.length;
  console.log('P28-49 全链路：' + total + ' 对，PASS ' + passed + '，FAIL ' + fails.length);
  if (fails.length) {
    console.log('失败明细（按 step 分组，最多 40 条）：');
    fails.slice(0, 40).forEach(function (f) {
      console.log('  FAIL [' + f.step + '] ' + f.kp + ' × ' + f.qt +
        (f.n != null ? ' n=' + f.n : '') +
        (f.reason ? ' reason=' + f.reason : '') +
        (f.err ? ' err=' + f.err : ''));
    });
    if (fails.length > 40) console.log('  …另有 ' + (fails.length - 40) + ' 项失败');
  }
  process.exit(fails.length ? 1 : 0);
})();
