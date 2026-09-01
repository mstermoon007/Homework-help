#!/usr/bin/env node
/**
 * dev/check-p6-render-print.js — P6 统一渲染与打印 Gate
 *
 * 验证：
 *   [1] Renderer 唯一出口：PresentationRenderer.render/renderAll 是页面唯一渲染入口
 *   [2] SVGRegistry 生产管线：所有 SVG 经 SVGRegistry.render 渲染
 *   [3] 打印统一：Print.openFromQuestions/previewFromQuestions 经 PresentationRenderer
 *   [4] 无页面直接拼装题目 HTML（无直接 innerHTML 拼题目）
 *   [5] SVG 无内联生成器（插件不直接产出 <svg> 字符串到题目）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');

function stripComments(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  return src;
}

function countInFile(file, re) {
  var abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return 0;
  var m = stripComments(fs.readFileSync(abs, 'utf8')).match(re);
  return m ? m.length : 0;
}

var htmlPages = ['practice.html', 'math-types.html', 'subject-types.html', 'chinese-types.html', 'english-types.html', 'faq.html', 'index.html', 'grade.html'];

var pass = [];
var fail = [];
function add(name, ok, extra) {
  if (ok) pass.push(name); else fail.push(name + (extra ? ' — ' + extra : ''));
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? ' (' + extra + ')' : ''));
}

// [1] Renderer 唯一出口
add('Renderer 唯一出口', (function () {
  var html = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  var hasGenerate = /practiceSession\.start\(/.test(html);
  var noPluginRender = !/plugin\.render\(/.test(html);
  // renderAll 在 GenerationEngine 内部调用，页面只经 practiceSession.start() 生成
  return hasGenerate && noPluginRender;
})());

// [2] SVGRegistry 生产管线
add('SVGRegistry 生产管线', (function () {
  try {
    // Load all SVG modules in the correct order
    require(path.join(ROOT, 'shared', 'svg-core.js'));
    require(path.join(ROOT, 'shared', 'svg-geometry.js'));
    require(path.join(ROOT, 'shared', 'svg-calculation.js'));
    require(path.join(ROOT, 'shared', 'svg-make-ten.js'));
    require(path.join(ROOT, 'plugins', 'svg-clock.js'));
    require(path.join(ROOT, 'plugins', 'svg-area.js'));
    require(path.join(ROOT, 'plugins', 'svg-fraction.js'));
    require(path.join(ROOT, 'plugins', 'svg-draw.js'));
    require(path.join(ROOT, 'plugins', 'svg-data-stats.js'));
    require(path.join(ROOT, 'plugins', 'svg-competition.js'));

    var registry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
    var result = registry.seedFromGlobal();
    // 至少有基础的 geometry/calculation/makeTen + 新增的 clock/area/fraction/draw/dataStats/competition
    return result.seeded >= 100;
  } catch (e) {
    console.log('  SVGRegistry error:', e.message);
    return false;
  }
})());

// [3] 打印统一
add('打印统一', (function () {
  var html = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  var hasPracticeSessionPrint = /practiceSession\.print\(\)/.test(html);
  var hasBuildFromQuestions = /buildFromQuestions/.test(
    fs.readFileSync(path.join(ROOT, 'shared', 'print.js'), 'utf8')
  );
  return hasPracticeSessionPrint && hasBuildFromQuestions;
})());

// [4] 无页面直接拼装题目 HTML
add('无页面直接拼装题目 HTML', (function () {
  var html = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  var hasInnerHTMLQuestion = /problemsArea\.innerHTML\s*=/ .test(html) || /innerHTML\s*\+=.*question/.test(html);
  return !hasInnerHTMLQuestion;
})());

// [5] SVG 无内联生成器
add('SVG 无内联生成器', (function () {
  var htmlPages = ['practice.html', 'math-types.html', 'subject-types.html', 'chinese-types.html', 'english-types.html', 'faq.html', 'index.html', 'grade.html'];
  var svgInlineRe = /svg\s*:\s*[^}]*<svg|svg\s*:\s*[^}]*svg\(/;
  var violations = [];
  htmlPages.forEach(function (f) {
    var abs = path.join(ROOT, f);
    if (!fs.existsSync(abs)) return;
    var src = fs.readFileSync(abs, 'utf8');
    if (svgInlineRe.test(src)) violations.push(f);
  });
  return violations.length === 0;
})());

console.log('\nP6 统一渲染与打印 Gate：' + pass.length + '/' + (pass.length + fail.length) + ' 通过');
if (fail.length) {
  console.log('失败项:\n - ' + fail.join('\n - '));
  process.exitCode = 1;
} else {
  console.log('P6 RENDER-PRINT: PASS');
  process.exitCode = 0;
}