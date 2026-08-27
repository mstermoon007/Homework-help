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

// ============ SVGChinese 语文生成器（任务8） ============
var CN = require(path.join(ROOT, 'shared', 'svg-chinese.js'));

// 结构断言辅助：条件成立计入 total，失败计 fail 并输出原因
function cnOk(cond, msg) {
  total++;
  if (!cond) { fail++; console.log('FAIL ' + msg); }
}

// hanziGrid：田字格 / 米字格 / 非法输入
var tianShan = CN.hanziGrid('山', 'tian');
if (tianShan !== null) check('hanziGrid-tian-shan', tianShan); else { total++; fail++; console.log('FAIL hanziGrid-tian-shan → null'); }
cnOk(tianShan && tianShan.indexOf('山') !== -1, '田字格含汉字「山」');
cnOk(tianShan && (tianShan.match(/stroke-dasharray/g) || []).length >= 2, '田字格含虚线中线（横+竖）');
var miMu = CN.hanziGrid('木', 'mi');
if (miMu !== null) check('hanziGrid-mi-mu', miMu); else { total++; fail++; console.log('FAIL hanziGrid-mi-mu → null'); }
cnOk(miMu && (miMu.match(/<line/g) || []).length === 4, '米字格含 4 条内线（十字+双对角）');
var tianDefault = CN.hanziGrid('口');
if (tianDefault !== null) check('hanziGrid-default-kou', tianDefault); else { total++; fail++; console.log('FAIL hanziGrid-default → null'); }
cnOk(CN.hanziGrid() === null, 'hanziGrid 无参 → null');
cnOk(CN.hanziGrid('AB') === null, 'hanziGrid 多字符 → null');
cnOk(CN.hanziGrid('A') === null, 'hanziGrid 非汉字 → null');

// pinyinGrid：带调音节 / 非法输入
var pyHua = CN.pinyinGrid('huā');
if (pyHua !== null) check('pinyinGrid-hua', pyHua); else { total++; fail++; console.log('FAIL pinyinGrid-hua → null'); }
cnOk(pyHua && (pyHua.match(/<line/g) || []).length === 4, '四线三格含 4 条横线');
cnOk(pyHua && pyHua.indexOf('huā') !== -1, '四线格显示音节文本');
var pyLong = CN.pinyinGrid('zhuàng');
if (pyLong !== null) check('pinyinGrid-zhuang', pyLong); else { total++; fail++; console.log('FAIL pinyinGrid-zhuang → null'); }
cnOk(CN.pinyinGrid('') === null, 'pinyinGrid 空串 → null');
cnOk(CN.pinyinGrid(123) === null, 'pinyinGrid 非字符串 → null');
cnOk(CN.pinyinGrid('abc1') === null, 'pinyinGrid 含数字 → null');

// strokeOrder：内置字笔画数与徽标数一致；未收录字返回 null
[['山', 3], ['日', 4], ['木', 4], ['一', 1], ['人', 2]].forEach(function (c) {
  var svg = CN.strokeOrder(c[0]);
  if (svg !== null) check('strokeOrder-' + c[0], svg);
  else { total++; fail++; console.log('FAIL strokeOrder-' + c[0] + ' → null'); }
  cnOk(svg && (svg.match(/<polyline/g) || []).length === c[1], '「' + c[0] + '」折线数 = 笔画数 ' + c[1]);
  cnOk(svg && (svg.match(/<circle/g) || []).length === c[1], '「' + c[0] + '」序号徽标数 = 笔画数 ' + c[1]);
});
cnOk(CN.strokeOrder('永') === null, 'strokeOrder 未收录「永」→ null');
cnOk(CN.strokeOrder() === null, 'strokeOrder 无参 → null');

// sentenceLine：示范文本书写格
var sent = CN.sentenceLine('今天天气晴朗');
if (sent !== null) check('sentenceLine-text', sent); else { total++; fail++; console.log('FAIL sentenceLine-text → null'); }
cnOk(sent && sent.indexOf('今天天气晴朗') !== -1, '书写格含示范文本');
cnOk(sent && (sent.match(/<line/g) || []).length >= 2, '书写格含基线+顶部导引线');
check('sentenceLine-blank', CN.sentenceLine(''));
cnOk(CN.sentenceLine(null) === null, 'sentenceLine 非字符串 → null');
cnOk(CN.sentenceLine('字'.repeat(17)) === null, 'sentenceLine 超长(17) → null');

// 命名空间一致性：模块导出即 SVGGenerators.cn，且 ready 标记为 true
cnOk(global.SVGGenerators.cn === CN, 'SVGGenerators.cn 指向本模块导出');
cnOk(typeof global.SVGGenerators.cn.ready === 'boolean', 'ready 标记存在');
cnOk(global.SVGGenerators.cn.ready === true, '任务8 后 ready=true');

// ============ SVGEnglish 英语生成器（任务9） ============
var EN = require(path.join(ROOT, 'shared', 'svg-english.js'));

// letterWriting：大小写 / 推断 / 非法输入
var lwA = EN.letterWriting('A', 'upper');
if (lwA !== null) check('letterWriting-A-upper', lwA); else { total++; fail++; console.log('FAIL letterWriting-A-upper → null'); }
cnOk(lwA && (lwA.match(/<line/g) || []).length === 4, '四线三格含 4 条横线（验收点）');
cnOk(lwA && lwA.indexOf('>A<') !== -1, '显示大写 A');
var lwG = EN.letterWriting('g', 'lower');
if (lwG !== null) check('letterWriting-g-lower', lwG); else { total++; fail++; console.log('FAIL letterWriting-g-lower → null'); }
cnOk(lwG && lwG.indexOf('>g<') !== -1, '显示小写 g');
cnOk(EN.letterWriting('B') !== null && EN.letterWriting('b') !== null, '省略 case 按字母自身推断');
var lwBad = [EN.letterWriting(), EN.letterWriting('AB'), EN.letterWriting('1'),
  EN.letterWriting('A', 'middle'), EN.letterWriting('A', 123)];
cnOk(lwBad.every(x => x === null), 'letterWriting 非法输入 → null（缺参/多字符/非字母/未知 case）');

// wordCard：单词+音标+抄写区；非法输入
var wcBook = EN.wordCard('book', '/bʊk/');
if (wcBook !== null) check('wordCard-book-phonetic', wcBook); else { total++; fail++; console.log('FAIL wordCard-book → null'); }
cnOk(wcBook && wcBook.indexOf('book') !== -1 && wcBook.indexOf('/bʊk/') !== -1, '卡片含单词与音标');
cnOk(wcBook && (wcBook.match(/<line/g) || []).length === 4, '卡片下部含四线抄写区');
var wcApple = EN.wordCard('apple');
if (wcApple !== null) check('wordCard-apple-noPhonetic', wcApple); else { total++; fail++; console.log('FAIL wordCard-apple → null'); }
cnOk(wcApple && wcApple.indexOf('apple') !== -1, '无音标时仅展示单词');
var wcBad = [EN.wordCard(''), EN.wordCard(123), EN.wordCard('bo1k'), EN.wordCard('ok', { x: 1 })];
cnOk(wcBad.every(x => x === null), 'wordCard 非法输入 → null（空串/非串/数字混入/音标类型）');

// fourLineWriting：句子抄写
var flSent = EN.fourLineWriting('I like apples.');
if (flSent !== null) check('fourLineWriting-sentence', flSent); else { total++; fail++; console.log('FAIL fourLineWriting-sentence → null'); }
cnOk(flSent && flSent.indexOf('I like apples.') !== -1, '抄写条含句子文本');
cnOk(flSent && (flSent.match(/<line/g) || []).length === 4, '抄写条含 4 条横线');
var flBad = [EN.fourLineWriting(''), EN.fourLineWriting(null), EN.fourLineWriting('字'),
  EN.fourLineWriting('x'.repeat(29))];
cnOk(flBad.every(x => x === null), 'fourLineWriting 非法输入 → null（空/非串/中文/超长）');

// 命名空间一致性
cnOk(global.SVGGenerators.en === EN, 'SVGGenerators.en 指向本模块导出');
cnOk(global.SVGGenerators.en.ready === true, '任务9 后 ready=true');

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

// ============ 语文细化：十字格 / 多字笔顺 / 四线格颜色可配 ============
(function () {
  var cross = CN.hanziGrid('木', 'cross');
  if (cross !== null) check('hanziGrid-cross-mu', cross); else { total++; fail++; console.log('FAIL hanziGrid-cross → null'); }
  cnOk(cross && (cross.match(/<line/g) || []).length === 2, '十字格仅 2 条实线中线');
  cnOk(cross && cross.indexOf('stroke-dasharray') === -1, '十字格无虚线（区别于田字格）');

  var word = CN.strokeOrderWord('山口');
  if (word !== null) check('strokeOrderWord-shankou', word); else { total++; fail++; console.log('FAIL strokeOrderWord → null'); }
  cnOk(word && (word.match(/<polyline/g) || []).length === 6, '多字笔顺折线总数 = 山3+口3 = 6');
  cnOk(word && (word.match(/<circle/g) || []).length === 6, '序号徽标跨字连续共 6 个');
  cnOk(word && word.indexOf('>6<') !== -1, '末笔序号连续编号至 6');
  cnOk(CN.strokeOrderWord('山永') === null, '多字笔顺含未收录字「永」→ null');
  cnOk(CN.strokeOrderWord('山') === null, '单字请用 strokeOrder → null');

  var pyCustom = CN.pinyinGrid('huā', { lineColor: '#ff0000', baselineColor: '#0000ff' });
  cnOk(pyCustom && pyCustom.indexOf('#ff0000') !== -1 && pyCustom.indexOf('#0000ff') !== -1,
    'pinyinGrid 四线格颜色可配置（验收点）');
  var pyDefault = CN.pinyinGrid('huā');
  cnOk(pyDefault && pyDefault.indexOf('svg-grid-line') !== -1, '四线格线条带 svg-grid-line 类');
  var pyPrint = CN.pinyinGrid('huā').replace('<svg ', '<svg data-pm="1" ');
  void pyPrint; // 打印变浅由 svgWrap printMode 统一处理（见上方 core 用例）
})();

// ============ 英语细化：大小写同框 / 笔顺示意 ============
(function () {
  var pair = EN.letterPair('a');
  if (pair !== null) check('letterPair-Aa', pair); else { total++; fail++; console.log('FAIL letterPair → null'); }
  cnOk(pair && pair.indexOf('>A<') !== -1 && pair.indexOf('>a<') !== -1, '配对卡同时含大小写字母');
  cnOk(pair && (pair.match(/<line/g) || []).length >= 5, '配对卡含四线格+分隔虚线');
  cnOk(EN.letterPair('AB') === null, 'letterPair 非单字母 → null');

  var lsL = EN.letterStroke('L', 'upper');
  if (lsL !== null) check('letterStroke-L-upper', lsL); else { total++; fail++; console.log('FAIL letterStroke-L → null'); }
  cnOk(lsL && lsL.indexOf('>2<') !== -1, '大写 L 笔画数徽标 = 2');
  cnOk(lsL && lsL.indexOf('<polygon') !== -1, '起笔方向箭头三角头存在');
  cnOk(lsL && lsL.indexOf('fill="#c7d2e4"') !== -1, '描红虚线底稿层存在');
  var lsa = EN.letterStroke('g', 'lower');
  check('letterStroke-g-lower', lsa);
  cnOk(lsa && lsa.indexOf('<polygon') === -1 && lsa.indexOf('>3<') === -1,
    '小写不作笔画数/箭头标注（口径差异）');
  cnOk(EN.letterStroke('A', 'middle') === null, 'letterStroke 非法 case → null');
})();

console.log('\n' + (fail === 0
  ? ('✅ verify-svg 通过：共生成并校验 ' + total + ' 个 SVG')
  : ('❌ ' + fail + ' / ' + total + ' 个 SVG 结构异常')));
process.exit(fail === 0 ? 0 : 1);
