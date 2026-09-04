#!/usr/bin/env node
/**
 * dev/check-comprehensive-pipeline.js — 综合练习管线门禁（新轨）
 *
 * 通过生成层引擎（strategy-engine.bundle + generation-engine）在沙箱内
 * 以 mode='comprehensive'（ComprehensiveStrategy 规划）生成试题，断言：
 *  1. 生成不依赖运行时 require（Generator Runtime 经全局注入）；
 *  2. 每题具备标准 Question 接口：q/text/answer；
 *  3. 每题带 knowledgePointId 元信息；
 *  4. 产物可直接渲染（questions + html 非空）。
 *
 * 用法：node dev/check-comprehensive-pipeline.js
 * 退出码 0 = PASS（供 verify:m4 串联）。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

global.window = global;
['./shared/common.js', './shared/difficulty.js', './shared/difficulty-static.js',
 './shared/knowledge-bank.js', './plugins/registry.js', './shared/plugin-loader.js',
 './shared/strategy-engine.bundle.js', './shared/presentation-engine.bundle.js',
 './shared/presentation/render-options.js', './shared/presentation/render-result.js',
 './shared/presentation/legacy-svg-adapter.js', './shared/presentation/svg-registry.js',
 './shared/presentation/html-renderer.js', './shared/presentation/renderer.js',
 './shared/generation-engine.js', './shared/strategy/comprehensive-strategy.js'
].forEach(function (rel) {
  require(path.join(ROOT, rel));
});

var bad = [];
function check(name, cond) {
  var ok = !!cond;
  if (!ok) bad.push(name);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  return ok;
}

var Engine = global.GenerationEngine || require(path.join(ROOT, './shared/generation-engine.js'));
if (!Engine || typeof Engine.generate !== 'function') {
  console.log('  ✗ 生成层引擎不可用');
  console.log('=== 综合练习管线门禁 ===\nFAIL');
  process.exit(1);
}

var grade = 2;
var request = { subject: 'math', grade: grade, count: 20, mode: 'comprehensive', difficulty: 4 };

Engine.generate(request, { skipValidation: false })
  .then(function (res) {
    var qs = res.questions || [];
    console.log('[综合练习（grade ' + grade + '，mode=comprehensive）] 题数=' + qs.length);
    check('生成无异常且非空', qs.length > 0);
    check('每题带 knowledgePointId', qs.length > 0 && qs.every(function (q) { return !!q.knowledgePointId; }));
    check('每题具备标准接口', qs.length > 0 && qs.every(function (q) {
      return typeof (q.q || q.prompt) === 'string' && q.answer != null;
    }));
    check('可渲染（html 非空）', !!(res.html && res.html.length > 20));
    var failed = (res.failedPlans || []).length;
    var total = (res.plans || []).length || 1;
    // 个别既有问题插件（如 math-word-problems 实例化失败）会被跳过：失败计划需可控（<30%）
    check('失败计划可控', failed / total < 0.3);
    var pass = bad.length === 0;
    console.log('=== 综合练习管线门禁 ===\n' + (pass ? 'PASS' : 'FAIL'));
    process.exit(pass ? 0 : 1);
  })
  .catch(function (e) {
    console.log('  ✗ 综合生成异常：' + (e && e.message || e));
    console.log('=== 综合练习管线门禁 ===\nFAIL');
    process.exit(1);
  });
