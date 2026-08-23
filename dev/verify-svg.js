#!/usr/bin/env node
/**
 * dev/verify-svg.js — SVG 生成器批量结构验证
 * 批量生成四类生成器的输出，检查基本结构：
 *   <svg 开头 / </svg> 结尾 / xmlns 命名空间 / viewBox 存在 / 无 NaN·undefined 泄漏。
 * 用法：node dev/verify-svg.js   （全部通过退出码 0）
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'svg-core.js'));
var U = global.SVGUtil;
var G = require(path.join(ROOT, 'shared', 'svg-geometry.js'));
var C = require(path.join(ROOT, 'shared', 'svg-calculation.js'));
var M = require(path.join(ROOT, 'shared', 'svg-make-ten.js'));

var total = 0, fail = 0;
function check(name, svg) {
  total++;
  var problems = [];
  if (typeof svg !== 'string' || !svg) problems.push('空输出');
  else {
    if (!/^<svg\b/.test(svg)) problems.push('不以 <svg 开头');
    if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) problems.push('缺 xmlns');
    if (!/viewBox="[^"]+"/.test(svg)) problems.push('缺 viewBox');
    if (!/<\/svg>$/.test(svg.trim())) problems.push('不以 </svg> 结尾');
    if (/NaN|undefined|null/.test(svg.replace(/>[^<]*</g, '>'))) problems.push('疑似 NaN/undefined 泄漏');
    var vb = svg.match(/viewBox="([-\d.]+ )([-.\d ]+)"/);
    if (vb && vb[2].split(' ').some(Number.isNaN)) problems.push('viewBox 含非数字');
  }
  if (problems.length) { fail++; console.log('FAIL ' + name + ' → ' + problems.join('; ')); }
}

// ============ SVGGeometry 全 API × 参数变体 ============
[[3, 2], [4, 3], [6, 5], [8, 7]].forEach(function (d, i) {
  check('rectangle#' + i, G.rectangle({ width: d[0], height: d[1], labelSides: true }));
});
for (var s = 2; s <= 6; s++) check('square#' + s, G.square({ size: s, dashed: s % 2 === 0 }));
[[0, 0], [1, 1]].forEach(function (_, i) {
  check('triangle#' + i, G.triangle({ p1: [0, 0], p2: [5 + i, 0], p3: [2 + i, 3 + i],
    showHeight: true, angles: [50 + i, 60 - i, 70], labelVertices: true, dashed: i === 1 }));
});
check('parallelogram', G.parallelogram({ base: 6, height: 4, offset: 2 }));
check('trapezoid', G.trapezoid({ topBase: 3, bottomBase: 6, height: 4 }));
[2, 4, 7].forEach(function (r) { check('circle#r' + r, G.circle({ r: r, labelRadius: true })); });
[45, 90, 120, 270].forEach(function (a) { check('sector#a' + a, G.sector({ r: 5, angle: a, labelAngle: true })); });
check('cuboid', G.cuboid({ length: 6, width: 4, height: 3 }));
check('cube', G.cube({ edge: 4 }));
check('cylinder', G.cylinder({ r: 3, height: 8 }));
check('cone', G.cone({ r: 3, height: 7 }));
check('translationDemo', G.translationDemo({ points: [[0, 0], [4, 0], [4, 3]], dx: 5, dy: 2 }));
check('rotationDemo', G.rotationDemo({ points: [[0, 0], [4, 0], [4, 3]], cx: 2, cy: 1, deg: 60 }));
check('reflectionDemo', G.reflectionDemo({ points: [[0, 1], [4, 1], [2, 4]], axis: 'y' }));

// ============ SVGCalculation 四则 × 错误模式 × 边界组合 ============
var addCases = [[456, 378], [99, 1], [305, 207], [12, 34], [999, 999]];
addCases.forEach(function (p2, i) {
  check('add#' + i, C.add(p2));
  check('add-noCarry#' + i, C.add(p2, { errorType: 'no-carry' }));
});
var subCases = [[502, 217], [100, 37], [81, 9], [45, 45]];
subCases.forEach(function (p2, i) {
  check('sub#' + i, C.sub(p2[0], p2[1]));
  check('sub-noBorrow#' + i, C.sub(p2[0], p2[1], { errorType: 'no-borrow' }));
});
var mulCases = [[123, 4], [56, 7], [123, 45], [89, 76]];
mulCases.forEach(function (p2, i) {
  check('mul#' + i, C.mul(p2[0], p2[1]));
  check('mul-noCarry#' + i, C.mul(p2[0], p2[1], { errorType: 'no-carry' }));
});
var divCases = [[47, 5], [72, 8], [1000, 7], [81, 9]];
divCases.forEach(function (p2, i) { check('div#' + i, C.div(p2[0], p2[1])); });

// ============ SVGMakeTen 三法 × 组合（含无效输入应返回 null，跳过检查） ============
[[9, 5], [8, 6], [7, 7], [6, 9], [9, 9]].forEach(function (p2, i) {
  var svg = M.makeTen(p2[0], p2[1]);
  if (svg !== null) check('makeTen#' + i, svg);
});
[[15, 8], [14, 6], [12, 5], [16, 9], [11, 3]].forEach(function (p2, i) {
  var a = M.pingTen(p2[0], p2[1]);
  var b = M.poTen(p2[0], p2[1]);
  if (a !== null) check('pingTen#' + i, a);
  if (b !== null) check('poTen#' + i, b);
});

// ============ SVGUtil 核心直查 ============
check('core-wrap', U.svgWrap('<circle cx="30" cy="30" r="20"/>'));
check('core-esc', U.svgWrap(U.svgText(10, 10, '<a&b>')));

console.log('\n' + (fail === 0
  ? ('✅ verify-svg 通过：共生成并校验 ' + total + ' 个 SVG')
  : ('❌ ' + fail + ' / ' + total + ' 个 SVG 结构异常')));
process.exit(fail === 0 ? 0 : 1);
