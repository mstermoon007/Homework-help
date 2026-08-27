#!/usr/bin/env node
/**
 * dev/performance-budget.js — 插件生成与批改性能预算自动检测
 * 简化版：测量 generate/render/check 三个环节耗时，对比预算阈值
 */

'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var registryMod = require('./plugin-registry.js');

var CHECK_COUNT = 20; // 每个插件测试的题目数
var STRICT = process.argv.indexOf('--strict') !== -1;

var budgets = { generate: 100, render: 80, check: 50 }; // ms

var allPlugins = registryMod.readRegistry();
var bySubject = { math: [], cn: [], en: [] };
allPlugins.forEach(function (p) {
  var s = (p.subject || 'math').toLowerCase();
  if (bySubject[s] !== undefined) bySubject[s].push(p);
  else bySubject['math'].push(p);
});

var total = allPlugins.length;
var passed = 0, failed = 0, warnCount = 0;

console.log('插件性能预算检测');
console.log('预算: generate ≤ ' + budgets.generate + 'ms, render ≤ ' + budgets.render + 'ms, check ≤ ' + budgets.check + 'ms');
console.log('插件总数: ' + total + ' | 模式: ' + (STRICT ? '严格(超预算视为错误)' : '常规(仅警告)'));
console.log('');

function timeFn(fn) {
  var t0 = process.hrtime.bigint();
  var result;
  try { result = fn(); } catch (e) { result = { error: e.message }; }
  var t1 = process.hrtime.bigint();
  var dur = Number(t1 - t0) / 1e6;
  return { result: result, dur: dur };
}

function testPlugin(plugin) {
  var pid = plugin.id || 'unknown';
  var subject = (plugin.subject || 'math').toLowerCase();
  var r = {
    id: pid,
    subject: subject,
    generate: { ok: false, dur: 0, warn: false },
    render:   { ok: false, dur: 0, warn: false },
    check:    { ok: false, dur: 0, warn: false }
  };

  // 1. generate
  var gen = timeFn(function() { return plugin.generate({ grade: 1, count: CHECK_COUNT }); });
  r.generate.dur = gen.dur;
  if (!gen.result || gen.result.error) { r.generate.warn = true; warnCount++; }
  else { r.generate.ok = true; passed++; }

  if (r.generate.ok) {
    var set = gen.result;
    // 2. render
    var ren = timeFn(function() { return plugin.render ? plugin.render(set) : null; });
    r.render.dur = ren.dur;
    if (ren.result !== null && typeof ren.result === 'string') { r.render.ok = true; passed++; }
    else { r.render.warn = true; warnCount++; }

    if (r.render.ok) {
      // 3. check
      var answers = [];
      try { set.questions.forEach(function(q) { answers.push(String(q.answer || '')); }); } catch(e) { answers = new Array(CHECK_COUNT).fill(''); }
      var chk = timeFn(function() { return plugin.check ? plugin.check(set, answers) : null; });
      r.check.dur = chk.dur;
      if (chk.result && typeof chk.result === 'object' && 'score' in chk.result && Array.isArray(chk.result.results)) { r.check.ok = true; passed++; }
      else { r.check.warn = true; warnCount++; }
    }
  }

  // 输出每个插件的耗时判定
  var gOk = r.generate.dur <= budgets.generate;
  var rOk = r.render.dur <= budgets.render;
  var cOk = r.check.dur <= budgets.check;
  var allOk = gOk && rOk && cOk;
  if (!allOk) warnCount++;
  if (allOk) passed++; else failed++;

  console.log('  ' + (allOk ? '✅' : '⚠️') + ' ' + pid +
    ' gen=' + r.generate.dur.toFixed(1) + 'ms(' + (gOk?'O':'X') + ') ' +
    ' ren=' + r.render.dur.toFixed(1) + 'ms(' + (rOk?'O':'X') + ') ' +
    ' chk=' + r.check.dur.toFixed(1) + 'ms(' + (cOk?'O':'X') + ')');
}

// 测试所有插件
bySubject.math.forEach(testPlugin);
bySubject.cn.forEach(testPlugin);
bySubject.en.forEach(testPlugin);

console.log('');
console.log('结果: 通过 ' + passed + '/' + total + ' | 超预算警告: ' + warnCount);

if (STRICT && failed > 0) {
  console.log('⚠️ 严格模式：有 ' + failed + ' 插件超出预算，退出码 1');
  process.exit(1);
} else {
  console.log('✅ 检测完成');
}