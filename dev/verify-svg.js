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

require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
var U = global.SVGUtil;
var G = require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
var C = require(path.join(ROOT, 'shared', 'svg', 'svg-calculation.js'));
var M = require(path.join(ROOT, 'shared', 'svg', 'svg-make-ten.js'));

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
// 结构断言辅助：条件成立计入 total，失败计 fail 并输出原因
function cnOk(cond, msg) {
  total++;
  if (!cond) { fail++; console.log('FAIL ' + msg); }
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

// ============ 任务：SVG 生成器细化 —— 新增能力逐项验证 ============

// ---- svgWrap printMode：辅助线变浅 + 颜色降饱和 + svg-print 类 ----
(function () {
  var plain = U.svgWrap(U.svgLine(0, 0, 100, 100, { dasharray: '5 4' }) +
    U.svgGrid('tian', { x: 10, y: 10, size: 60 }));
  var print = U.svgWrap(
    U.svgLine(0, 0, 100, 100, { dasharray: '5 4' }) +
    U.svgGrid('tian', { x: 10, y: 10, size: 60 }),
    { printMode: true });
  cnOk(print.indexOf('svg-print') !== -1, 'printMode：根节点含 svg-print 类');
  cnOk(print.indexOf('[stroke-dasharray]{opacity') !== -1, 'printMode：虚线辅助线透明度规则注入（验收点）');
  cnOk(print.indexOf('.svg-grid-line{opacity') !== -1, 'printMode：网格线变浅规则注入');
  cnOk(print.indexOf('#27324a') === -1, 'printMode：主色 hex 已向白混合降饱和');
  cnOk(plain.indexOf('svg-print') === -1 && plain.indexOf('#27324a') !== -1, '非打印模式输出保持原样');
})();

// ---- svgGrid 四种格线背景 ----
[['tian', 2], ['mi', 4], ['cross', 2]].forEach(function (it) {
  var g = U.svgGrid(it[0], { x: 0, y: 0, size: 80 });
  check('svgGrid-' + it[0], U.svgWrap(g));
  cnOk((g.match(/<line/g) || []).length === it[1], 'svgGrid-' + it[0] + ' 内线条数 = ' + it[1]);
  cnOk(g.indexOf('svg-grid-line') !== -1, 'svgGrid-' + it[0] + ' 线条带 svg-grid-line 类');
});
var fl = U.svgGrid('four-line', { x: 0, topY: 0, width: 120, gap: 20 });
check('svgGrid-four-line', U.svgWrap(fl));
cnOk((fl.match(/<line/g) || []).length === 4, 'svgGrid-four-line 含 4 条横线');

// ============ 几何细化：线段等分标记 tickMark / triangle ticks 参数 ============
(function () {
  var tk = G.tickMark(0, 0, 90, 0, 3);
  check('tickMark-frag', U.svgWrap(tk));
  cnOk((tk.match(/<line/g) || []).length === 2, '三等分产生 2 条分点刻线（n-1）');
  cnOk(G.tickMark(0, 0, 10, 0, 1) === '', '等分数 <2 → 空片段');
  var base = (G.triangle({ p1: [0, 0], p2: [6, 0], p3: [3, 4] }).match(/<line/g) || []).length;
  var withTicks = (G.triangle({ p1: [0, 0], p2: [6, 0], p3: [3, 4], showHeight: false,
    ticks: [[0, 2]] }).match(/<line/g) || []).length;
  cnOk(withTicks === base + 1, 'triangle.ticks 底边中点刻线已追加');
  check('triangle-ticks', G.triangle({ p1: [0, 0], p2: [6, 0], p3: [3, 4],
    labelSides: true, angles: [60, 60, 60], ticks: [[0, 3], [1, 3]] }));
})();

// ============ 计算细化：进/借位颜色区分 + 小数竖式 dec + 分数竖式 frac ============
(function () {
  var carrySvg = C.add([456, 378]);
  cnOk(carrySvg.indexOf('#e0862c') !== -1, 'add 进位点为橙色（与结果红区分）');
  var borrowSvg = C.sub(502, 217);
  cnOk(borrowSvg.indexOf('#7c5cff') !== -1, 'sub 借位点为紫色（验收点）');
  var custom = C.add([99, 99], { carryColor: '#123abc' });
  cnOk(custom.indexOf('#123abc') !== -1, 'carryColor 可配置覆盖');
})();

[[['12.5', '3.48', '+'], ['48', '125', '+'], ['7.05', '2.4', '+'],
  ['12.5', '3.48', '-'], ['10', '0.25', '-'], ['9.09', '9.009', '-']]]
.forEach(function (cases) {
  cases.forEach(function (c, i) {
    var svg = C.dec(c[0], c[1], c[2]);
    check('dec#' + i + '-' + c[2].trim(), svg);
    var hasPoint = c[0].indexOf('.') !== -1 || c[1].indexOf('.') !== -1;
    if (hasPoint) cnOk(svg.indexOf('>.<') !== -1, 'dec#' + i + ' 小数点独立成列');
  });
});
// 小数进/借位点存在性
(function () {
  var dAdd = C.dec('12.59', '3.48', '+');   // 百分位 9+8 进位
  cnOk(dAdd.indexOf('#e0862c') !== -1, 'dec 加法小数进位点位（橙）');
  var dSub = C.dec('12.5', '3.48', '-');    // 百分位借位
  cnOk(dSub.indexOf('#7c5cff') !== -1, 'dec 减法小数借位点位（紫）');
})();
// dec 结果正确性抽检：拼接全部文本节点后检索结果串（逐位 text 按列序输出）
(function () {
  function flatText(svg) {
    var m = svg.match(/>[^<>]+<\/text>/g) || [];
    return m.map(function (s) { return s.replace(/^>|<\/text>$/g, ''); }).join('');
  }
  var t1 = flatText(C.dec('12.5', '3.48', '+'));
  cnOk(t1.indexOf('15.98') !== -1, 'dec 12.5+3.48 结果行 = 15.98');
  var t2 = flatText(C.dec('10', '0.25', '-'));
  cnOk(t2.indexOf('9.75') !== -1, 'dec 10−0.25 结果行 = 9.75');
  var t3 = flatText(C.dec('9.09', '9.009', '-'));
  cnOk(t3.indexOf('0.081') !== -1, 'dec 9.09−9.009 结果补零 = 0.081');
  var threw = false;
  try { C.dec('1.2.3', '2', '+'); } catch (e) { threw = true; }
  cnOk(threw, 'dec 非法小数串 → 抛 RangeError');
})();

(function () {
  var fAdd = C.frac(1, 2, 1, 3, '+');
  check('frac-add', fAdd);
  cnOk(fAdd.indexOf('?') !== -1, 'frac 默认留白框（问号占位）');
  cnOk(fAdd.indexOf('2.2') !== -1, 'frac 分数横线已绘制');
  var fRes = C.frac(1, 2, 1, 3, '+', { resultBox: false });
  check('frac-add-result', fRes);
  cnOk(fRes.indexOf('>5<') !== -1 && fRes.indexOf('>6<') !== -1, 'frac 结果约分为 1/2+1/3=5/6');
  var fSub = C.frac(3, 4, 1, 4, '-', { resultBox: false });
  cnOk(fSub.indexOf('>1<') !== -1 && fSub.indexOf('>2<') !== -1, 'frac 减法 3/4−1/4=1/2');
  var threwF = false;
  try { C.frac(1, 0, 1, 2, '+'); } catch (e) { threwF = true; }
  cnOk(threwF, 'frac 分母为 0 → 抛错');
})();

// ============ 凑十步骤动画（CSS，打印静态） ============
(function () {
  var anim = M.makeTen(9, 5, { animate: true });
  cnOk(anim && anim.indexOf('mt-step') !== -1, 'animate：步骤节点带 mt-step 类');
  cnOk(anim && anim.indexOf('@keyframes mtFadeIn') !== -1, 'animate：内嵌淡入 keyframes');
  cnOk(anim && anim.indexOf('prefers-reduced-motion') !== -1, 'animate：reduced-motion 降级规则');
  var still = M.makeTen(9, 5);
  cnOk(still && still.indexOf('mt-step') === -1, '默认（未开 animate）保持静态');
  var printed = M.makeTen(9, 5, { animate: true, printMode: true });
  cnOk(printed && printed.indexOf('mt-step') === -1, 'printMode 强制静态（动画关闭）');
  var pAnim = M.makeTen(9, 5, { printMode: true });
  cnOk(pAnim && pAnim.indexOf('svg-print') !== -1 && pAnim.indexOf('@keyframes') === -1,
    '凑十卡 printMode：svg-print 且无动画样式');
})();

// ============ R-A04：六个语义 SVG 插件运行时挂载与派发校验 ============
// plugins/svg-{clock,area,fraction,data-stats,draw,competition}.js 挂载
// SVGGenerators.math.*，经 graphic-renderer → SVGRenderer 派发链产出 <svg>。
(function () {
  var pFiles = {
    clock: 'svg-clock', area: 'svg-area', fraction: 'svg-fraction',
    dataStats: 'svg-data-stats', draw: 'svg-draw', competition: 'svg-competition'
  };
  var mount = {};
  Object.keys(pFiles).forEach(function (ns) {
    mount[ns] = require(path.join(ROOT, 'plugins', pFiles[ns] + '.js'));
  });
  cnOk(Object.keys(mount).every(function (ns) {
    return global.SVGGenerators.math && global.SVGGenerators.math[ns] === mount[ns];
  }), '六个 svg 插件已挂载 SVGGenerators.math.*');

  var registry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
  var seeded = registry.seedFromGlobal().seeded;
  cnOk(seeded >= 100, 'seedFromGlobal 注册数 >= 100（含六个语义类型）');

  // 派发注册校验：语义类型+子类型均在 SVGRenderer 派发注册表中可解析
  // （即已接入 graphic-renderer → SVGRenderer 派发链；各子生成器保持原位置参数契约）
  var dispatchCases = {
    clock: { type: 'clock', subtype: 'clockSVG' },
    area: { type: 'area', subtype: 'gridSVG' },
    fraction: { type: 'fraction', subtype: 'fractionCircle' },
    dataStats: { type: 'dataStats', subtype: 'barChart' },
    draw: { type: 'draw', subtype: 'protractorSVG' },
    competition: { type: 'competition', subtype: 'logicGrid' }
  };
  Object.keys(dispatchCases).forEach(function (t) {
    cnOk(typeof global.SVGRenderer.resolve(dispatchCases[t]) === 'function',
      'R-A04 派发可解析: ' + t + '.' + dispatchCases[t].subtype);
  });
})();

// ============ 核心 SVG 渲染族装配（geometry/calculation/makeTen/chart/diagram/currency） ============
// 与 practice.html 加载面一致：svg-core 之后全部挂载 SVGGenerators.math.*，
// svg-registry 种子扫描自动索引为 {type, subtype} 描述符。
(function () {
  var coreFiles = {
    geometry: 'svg-geometry', calculation: 'svg-calculation', makeTen: 'svg-make-ten',
    chart: 'svg-chart', diagram: 'svg-diagram', currency: 'svg-currency'
  };
  Object.keys(coreFiles).forEach(function (ns) {
    require(path.join(ROOT, 'shared', 'svg', coreFiles[ns] + '.js'));
  });
  require(path.join(ROOT, 'shared', 'presentation', 'svg-templates.js'));
  Object.keys(coreFiles).forEach(function (ns) {
    cnOk(global.SVGGenerators && global.SVGGenerators.math && global.SVGGenerators.math[ns],
      '核心渲染族已挂载 SVGGenerators.math.' + ns);
  });

  var registryC = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
  // 本区块加载了 chart/diagram/currency 等模块，需再次 seed 才能被 SVGRenderer 索引（幂等覆盖）
  registryC.seedFromGlobal();
  var dispatchCore = {
    geometry: ['rectangle', 'positionGrid'],
    calculation: ['add'],
    chart: ['bar', 'line', 'pie'],
    diagram: ['brace', 'segment', 'balance', 'scale'],
    currency: ['rmb']
  };
  Object.keys(dispatchCore).forEach(function (t) {
    dispatchCore[t].forEach(function (sub) {
      cnOk(typeof global.SVGRenderer.resolve({ type: t, subtype: sub }) === 'function',
        'SVGRenderer 派发可解析: ' + t + '.' + sub);
    });
  });

  var G = global.SVGGenerators.math;
  var samples = [
    ['geometry.positionGrid', G.geometry.positionGrid({ gridSize: 5, objects: [{ name: '小猫', x: 0, y: 0 }, { name: '小狗', x: 3, y: 2 }] })],
    ['chart.bar', G.chart.bar({ data: [{ label: '一', value: 8 }, { label: '二', value: 5 }] })],
    ['chart.line', G.chart.line({ data: [{ label: '一', value: 3 }, { label: '二', value: 6 }] })],
    ['chart.pie', G.chart.pie({ data: [{ label: '语文', percent: 40 }, { label: '数学', percent: 60 }] })],
    ['diagram.brace', G.diagram.brace({ left: 5, right: 6, unit: '个' })],
    ['diagram.segment', G.diagram.segment({ total: 80, part: 30, unit: '米' })],
    ['diagram.balance', G.diagram.balance({ left: 12, rightUnknown: 5, unit: 'kg' })],
    ['diagram.scale', G.diagram.scale({ scale: 50000, mapDist: 6 })],
    ['currency.rmb', G.currency.rmb({ amounts: [352, 128], op: '+' })]
  ];
  samples.forEach(function (s) { check(s[0], s[1]); });
})();

console.log('\n' + (fail === 0
  ? ('✅ verify-svg 通过：共生成并校验 ' + total + ' 个 SVG')
  : ('❌ ' + fail + ' / ' + total + ' 个 SVG 结构异常')));
process.exit(fail === 0 ? 0 : 1);
