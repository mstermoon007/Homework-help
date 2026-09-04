#!/usr/bin/env node
/**
 * dev/check-ui-boundary.js — P1-R01 UI→Engine 边界 Gate
 *
 * P1 生产主链收口：App.GenerationEngine.generate() 是 UI 唯一生产生成入口。
 * practice.html（及所有 .html 页面）不得直接调用 Plugin / Generator / Strategy / Legacy。
 *
 * 断言：
 *   [A] 页面生成统一入口：只出现 GenerationEngine.generate（App./window. 均认可）
 *   [B] 无 Strategy 直连：不出现 StrategyEngine.plan( / Strategy config 分发
 *   [C] 无 Legacy 直连：不出现 generateLegacy( / legacy plugin 适配器直调
 *   [D] 无 Plugin 直连：不出现 plugin.generate( / plugin.render( / plugin.svg( 的生成调用
 *   [E] 无 Generator 直连：不出现 GeneratorRegistry / generator-selector 页面级引用
 *
 * 合法保留：
 *   - App.GenerationEngine.generate() / renderLegacySet()（Engine 提供的渲染桥，非生成入口）
 *   - App.PluginLoader.loadPlugin()（仅加载插件用于设置 UI / 知识点声明，不直接出题）
 *
 * 退出码：0 = PASS；1 = FAIL（任一断言不满足）。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

function walkHtml(dir, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    var fp = path.join(dir, name);
    var st = fs.statSync(fp);
    if (st.isDirectory()) walkHtml(fp, out);
    else if (name.endsWith('.html')) out.push(path.relative(ROOT, fp));
  });
  return out;
}

function stripComments(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  return src;
}

var htmlPages = walkHtml(ROOT, []).filter(function (f) {
  return f.indexOf('node_modules') === -1 && f.indexOf('dev/') === -1;
});

var pass = [];
var fail = [];
function add(name, ok, extra) {
  if (ok) pass.push(name); else fail.push(name + (extra ? ' — ' + extra : ''));
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' (' + extra + ')' : ''));
}

function scan(re) {
  var hits = [];
  htmlPages.forEach(function (f) {
    var abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) return;
    var src = stripComments(fs.readFileSync(abs, 'utf8'));
    var m = src.match(re);
    if (m) hits.push(f);
  });
  return hits;
}

// [A] 页面生成必须存在统一入口 PracticeBridge.start()（关联层唯一生产入口，
//     内部经 PracticeSession.start() → App.GenerationEngine.generate()）。
//     历史门禁断言 practiceSession.start()，但生成主链已收敛为关联层 PracticeBridge.start
//     （B5 收敛后 UI 不再直调 new PracticeSession().start()）。
add('UI 存在统一生成入口 PracticeBridge.start()', (function () {
  var hits = scan(/PracticeBridge\.start\s*\(/);
  return hits.length >= 1;
})());

// [A2] 页面不得把 generateLegacy 当生成入口（只能走 generate）
add('UI 无 generateLegacy 直连', (function () {
  var hits = scan(/GenerationEngine\.generateLegacy\s*\(/);
  return hits.length === 0;
})());

// [B] 无 Strategy 直连
add('UI 无 Strategy 直连', (function () {
  var hits = scan(/StrategyEngine\.plan\s*\(|StrategyLegacyAdapter|StrategyConfig\./);
  return hits.length === 0;
})());

// [C] 无 Legacy 适配器直连（生成侧）
add('UI 无 Legacy 适配器直连', (function () {
  var hits = scan(/generateByPluginId\s*\(|LegacyPluginAdapter\./);
  return hits.length === 0;
})());

// [D] 无 Plugin 生成/渲染直连（loadPlugin 仅用于加载 UI 声明）
add('UI 无 plugin.generate/render 直连', (function () {
  var hits = scan(/plugin\.generate\s*\(|plugin\.render\s*\(|plugin\.svg\s*\(/);
  return hits.length === 0;
})());

// [E] 无 Generator 直连
add('UI 无 Generator 直连', (function () {
  var hits = scan(/GeneratorRegistry\.|generator-selector\.|GeneratorSelector\./);
  return hits.length === 0;
})());

console.log('\nUI→Engine 边界 Gate：' + pass.length + '/' + (pass.length + fail.length) + ' 通过');
if (fail.length) {
  console.log('失败项:\n - ' + fail.join('\n - '));
  process.exitCode = 1;
} else {
  console.log('UI-BOUNDARY: PASS（UI 唯一生成入口 = GenerationEngine.generate）');
  process.exitCode = 0;
}
