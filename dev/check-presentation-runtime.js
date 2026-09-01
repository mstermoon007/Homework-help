#!/usr/bin/env node
/**
 * dev/check-presentation-runtime.js — C01/C02 Browser Runtime + E2E Probe
 *
 * 在浏览器式 vm 沙箱（与 dev/plugin-loader.js 同机制的持久上下文）中，按 practice.html
 * 的 <script> 顺序装载：registry.js → strategy bundle → presentation bundle →
 * presentation 渲染器栈（render-options/render-result/svg/html-renderer/renderer）→
 * generation-engine.js，验证 C01（P0-001 浏览器运行时接线）与 C02（端到端）：
 *   1. window.PresentationEngine 已注册（含 generateQuestions）；
 *   2. generation-engine 的 getPresentationEngine() 能解析到非空实例（P0-001 消除）；
 *   3. 经真实 plan 调用 PresentationEngine.generateQuestions 能产出题目（questions.length>0）；
 *   4. renderQuestions → 非空 HTML；checkAnswers → 分数结构；
 *   5. GenerationEngine.generate（真实页面入口：build → runPlans → render）端到端产题 + 渲染 HTML。
 *
 * 用法：node dev/check-presentation-runtime.js
 * 退出码 0 = PASS（供 CI / verify 串联）。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var bad = [];
function check(name, cond) {
  var ok = !!cond;
  if (!ok) bad.push(name);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  return ok;
}

var win = {
  console: console,
  crypto: globalThis.crypto,
  performance: globalThis.performance,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  navigator: { userAgent: 'PresentationProbe/1.0' },
  localStorage: (function () {
    var store = {};
    return {
      getItem: function (k) { return k in store ? store[k] : null; },
      setItem: function (k, v) { store[k] = String(v); },
      removeItem: function (k) { delete store[k]; }
    };
  })()
};
win.window = win;
win.self = win;
win.globalThis = win;
win.global = win;
win.module = { exports: {} };
win.exports = win.module.exports;

var context = vm.createContext(win);

function exec(absPath) {
  win.module = { exports: {} };
  win.exports = win.module.exports;
  win.require = makeVmRequire(absPath);
  vm.runInContext(fs.readFileSync(absPath, 'utf8'), context, { filename: absPath, timeout: 30000 });
  return win.module.exports;
}

function makeVmRequire(absPath) {
  return function (spec) {
    if (typeof spec === 'string' && spec.charAt(0) === '.') {
      var resolved = path.resolve(path.dirname(absPath), spec);
      return exec(resolved);
    }
    return require(spec);
  };
}

// 按 practice.html 脚本顺序装载（镜像 161-203 的浏览器加载顺序）
function load(rel) { exec(path.join(ROOT, rel)); }
load('shared/common.js');
load('shared/difficulty.js');
load('shared/difficulty-static.js');
load('shared/knowledge-bank.js');
load('plugins/registry.js');
load('shared/strategy-engine.bundle.js');
load('shared/presentation-engine.bundle.js');
// presentation 渲染器栈（镜像 practice.html 183-200 的浏览器加载顺序），供
// GenerationEngine.generate → render() 使用（PresentationRenderer）
load('shared/presentation/render-options.js');
load('shared/presentation/render-result.js');
load('shared/presentation/legacy-svg-adapter.js');
load('shared/presentation/svg-registry.js');
load('shared/generator/graphic-renderer.js');
load('shared/svg-core.js');
load('plugins/svg-clock.js');
load('plugins/svg-area.js');
load('plugins/svg-fraction.js');
load('plugins/svg-data-stats.js');
load('plugins/svg-draw.js');
load('plugins/svg-competition.js');
load('shared/presentation/html-renderer.js');
load('shared/presentation/renderer.js');
load('shared/generation-engine.js');
// 镜像 practice.html:182-188 学习者模块（practice-session.js 依赖，保证相对 require 可解析）
load('shared/storage.js');
load('shared/learner/error-model.js');
load('shared/learner/practice-result.js');
load('shared/learner/learner-model.js');
load('shared/learner/learner-storage.js');
load('shared/learner/result-collector.js');
load('shared/practice-session.js'); // 镜像 practice.html:211 真实练习会话入口

check('window.PresentationEngine 已注册', win.PresentationEngine && typeof win.PresentationEngine.generateQuestions === 'function');
check('window.GeneratorSelector 已注册', !!win.GeneratorSelector);
check('window.StrategyEngine 已注册', !!win.StrategyEngine);
check('window.GenerationEngine 已注册', typeof win.GenerationEngine.generate === 'function');

// P0-001：generation-engine 的 getPresentationEngine 现应解析到非空实例
var PresentationEngine = win.PresentationEngine;
var GenerationEngine = win.GenerationEngine;

// 经真实决策链构造 plan（StrategyEngine.plan —— 镜像 check-strategy-bundle 探针）
// 与真实 practice 流程一致：先 apply 迁移开关，使原生（core）生成器轨生效
var plan = null;
try {
  if (win.MigrationSwitch && typeof win.MigrationSwitch.apply === 'function') {
    win.MigrationSwitch.apply();
  }
  var decision = win.StrategyEngine.plan({
    knowledgePointId: 'math-g1-m1-addsub-5',
    count: 5,
    difficulty: 3,
    grade: 1
  });
  plan = decision && decision.plans && decision.plans[0];
} catch (e) {
  check('StrategyEngine.plan 可构造 plan（' + e.message + '）', false);
  finish();
  return;
}
check('StrategyEngine.plan 产出 plan（决策链可用）', !!plan);

if (!plan) { finish(); return; }

PresentationEngine.generateQuestions(plan, { skipValidation: true, legacyOutput: true })
  .then(function (result) {
    var sqs = result.semanticQuestions || [];
    var legacyQs = result.questions || [];
    check('generateQuestions 正常返回（不抛错）', true);
    check('生成题目数量 > 0（P0-001 消除，无静默空结果）', legacyQs.length > 0);
    check('题目具备内容字段', (sqs[0] && (!!sqs[0].prompt || !!sqs[0].stem)) || (legacyQs[0] && !!legacyQs[0].q));
    console.log('  → 生成题目数：' + legacyQs.length);

    // C02：渲染链 —— renderQuestions → HTML（经 global.PluginUtil.renderGrid）
    var html = '';
    try {
      html = PresentationEngine.renderQuestions(legacyQs, { columns: 1 });
      check('renderQuestions 产出非空 HTML', typeof html === 'string' && html.trim().length > 0);
      console.log('  → 渲染 HTML 长度：' + html.length);
    } catch (e) {
      check('renderQuestions 产出非空 HTML（' + (e && e.message) + '）', false);
    }

    // C02：判分链 —— checkAnswers → { score, total, correct }
    try {
      var userAnswers = {};
      legacyQs.forEach(function (q, i) { userAnswers[i] = q.answer; });
      var checked = PresentationEngine.checkAnswers(legacyQs, userAnswers);
      check('checkAnswers 正常返回分数结构', checked && typeof checked.score === 'number' && checked.total === legacyQs.length);
      console.log('  → 判分 score=' + (checked && checked.score) + ' total=' + (checked && checked.total));
    } catch (e) {
      check('checkAnswers 正常返回分数结构（' + (e && e.message) + '）', false);
    }

    // C02：真实页面入口 —— GenerationEngine.generate（build → runPlans → render）
    try {
      GenerationEngine.generate({ knowledgePointId: plan.knowledgePointId, count: 5, difficulty: 3, grade: 1 })
        .then(function (out) {
          var okQ = (out.questions && out.questions.length > 0);
          var okHtml = typeof out.html === 'string' && out.html.length > 0;
          check('GenerationEngine.generate 端到端产题', okQ);
          check('GenerationEngine.generate 端到端渲染 HTML', okHtml);
          console.log('  → generate questions=' + (out.questions ? out.questions.length : 0) + ' html=' + (out.html ? out.html.length : 0));
          return C02GraphicAndSession();
        })
        .then(function (ok) {
          finish();
        })
        .catch(function (err) {
          check('GenerationEngine.generate 端到端产题', false);
          console.log('  → generate error: ' + (err && err.message || err));
          finish();
        });
    } catch (e) {
      check('GenerationEngine.generate 端到端产题', false);
      console.log('  → generate throw: ' + (e && e.message || e));
      finish();
    }
  })
  .catch(function (err) {
    check('generateQuestions 正常返回（不抛错）', false);
    console.log('  → error: ' + (err && err.stack || err));
    finish();
  });

function C02GraphicAndSession() {
  // ---- C02-04：Graphic/SVG 渲染链路（graphic 描述符 → <svg>）----
  // 生成侧（graphic KP → 生成器）受限于既有 M4-R16 空生成回归，故本机验证渲染半环：
  // 任意 graphic 描述符经 GenerationEngine.render → HTML 含 <svg>，且 GraphicRenderer 可派发。
  var svgProbe = { type: 'custom', subtype: null, params: { rawSvg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="10"/></svg>' }, renderHints: {} };
  var svgSupported = win.GraphicRenderer && win.GraphicRenderer.isSupported(svgProbe.type);
  var svgStr = (win.GraphicRenderer && win.GraphicRenderer.render(svgProbe, {})) || '';
  var svgHtml = GenerationEngine.render([{ prompt: 'svg 渲染', question: { prompt: 'svg 渲染' }, answer: { value: 1 }, graphic: svgProbe }], { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' });
  check('C02-04 SVG 渲染：graphic 类型受支持', !!svgSupported);
  check('C02-04 SVG 渲染：GraphicRenderer.render 产出 <svg>', typeof svgStr === 'string' && svgStr.indexOf('<svg') !== -1);
  check('C02-04 SVG 渲染：GenerationEngine.render HTML 含 <svg>', typeof svgHtml === 'object' && svgHtml.html && svgHtml.html.indexOf('<svg') !== -1);

  // ---- C02-01：真实 PracticeSession.start() 入口（practice.html 的 UI 路径）----
  return Promise.resolve()
    .then(function () {
      if (win.MigrationSwitch && typeof win.MigrationSwitch.apply === 'function') win.MigrationSwitch.apply();
      var session = new win.PracticeSession({
        subject: 'math', grade: 1, count: 5, difficulty: 3,
        knowledgePointId: 'math-g1-m1-addsub-5'
      });
      return session.start();
    })
    .then(function (result) {
      var okCount = result && Array.isArray(result.questions) && result.questions.length > 0;
      var okHtml = result && typeof result.html === 'string' && result.html.length > 0;
      check('C02-01 PracticeSession.start()（真实 UI 入口）产题', okCount);
      check('C02-01 PracticeSession.start() 产出渲染 HTML', okHtml);
      console.log('  → PracticeSession.start questions=' + (result && result.questions ? result.questions.length : 0) + ' html=' + (result && result.html ? result.html.length : 0));
      return okCount && okHtml;
    })
    .catch(function (err) {
      check('C02-01 PracticeSession.start()（真实 UI 入口）产题', false);
      console.log('  → PracticeSession.start error: ' + (err && err.message || err));
      return false;
    });
}

function finish() {
  if (bad.length === 0) {
    console.log('=== C01/C02 Browser Runtime + E2E Probe ===\nPASS');
    process.exit(0);
  } else {
    console.log('=== C01/C02 Browser Runtime + E2E Probe ===\nFAIL: ' + bad.join(', '));
    process.exit(1);
  }
}
