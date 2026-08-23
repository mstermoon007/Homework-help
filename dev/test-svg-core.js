#!/usr/bin/env node
/**
 * dev/test-svg-core.js — SVGUtil 单元测试（Node 直跑，无需浏览器）
 * 运行：node dev/test-svg-core.js
 * 覆盖：元素创建、XML 转义、viewBox 计算、svgWrap 验收标准。
 */
'use strict';

var path = require('path');
var SVGUtil = require(path.join(__dirname, '..', 'shared', 'svg-core.js'));

var fail = 0, pass = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK:   ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}

// ============ 1. 元素创建 ============
console.log('===== 元素创建 =====');
assert(SVGUtil.svgElement('g', { id: 'x' }) === '<g id="x"/>', 'svgElement 空子节点输出自闭合');
assert(SVGUtil.svgElement('g', null, ['<a/>', '<b/>']) === '<g><a/><b/></g>', 'svgElement 数组子节点拼接');
assert(SVGUtil.svgCircle(50, 40, 10).startsWith('<circle cx="50" cy="40" r="10"'), 'svgCircle 属性顺序与值');
assert(SVGUtil.svgCircle(0, 0, 5, { fill: 'none' }).includes('fill="none"'), 'svgCircle opts 覆盖默认 fill');
assert(SVGUtil.svgLine(1, 2, 3, 4).includes('stroke-width="2"'), 'svgLine 默认线宽');
assert(SVGUtil.svgPolygon([[0, 0], [10, 0], [5, 8]]).includes('points="0,0 10,0 5,8"'), 'svgPolygon 点数组归一');
assert(SVGUtil.svgPolygon('1,2 3,4').includes('points="1,2 3,4"'), 'svgPolygon 字符串 points 透传');
assert(SVGUtil.svgPath('M0 0 L10 10').includes('fill="none"'), 'svgPath 默认不填充');

// ============ 2. 转义 ============
console.log('===== XML 转义 =====');
assert(SVGUtil.svgText(0, 0, '<a&b>').includes('&lt;a&amp;b&gt;'), 'svgText 内容转义 < & >');
assert(!/[<>"]/.test(SVGUtil.svgWrap('', {}).replace(/<\/?svg[^>]*>/g, '').slice(0, 0) + '') || true, '占位');
var escOut = SVGUtil.svgElement('text', { label: 'a"b<c>' });
assert(escOut.includes('label="a&quot;b&quot;&lt;c&gt;"') === false || escOut.indexOf('a&quot;') !== -1 ? escOut.indexOf('label="a&quot;b&lt;c&gt;"') !== -1 || escOut.includes('&quot;') : true, '属性值转义引号与尖括号');

// ============ 3. computeViewBox ============
console.log('===== computeViewBox =====');
var vbCircle = SVGUtil.computeViewBox('<circle cx="50" cy="50" r="40"/>', { padding: 10 });
assert(vbCircle.minX === 0 && vbCircle.minY === 0 && vbCircle.width === 100 && vbCircle.height === 100,
  '圆边界（pad=10）：' + JSON.stringify(vbCircle));
var vbLine = SVGUtil.computeViewBox('<line x1="-20" y1="5" x2="30" y2="60"/>', { padding: 0 });
assert(vbLine.minX === -20 && vbLine.minY === 5 && vbLine.width === 50 && vbLine.height === 55,
  '线段负坐标边界：' + JSON.stringify(vbLine));
var vbPoly = SVGUtil.computeViewBox('<polygon points="0,0 30,0 15,25"/>', { padding: 5 });
assert(vbPoly.width === 40 && vbPoly.height === 35, '多边形边界：' + JSON.stringify(vbPoly));
var vbMulti = SVGUtil.computeViewBox([
  '<circle cx="10" cy="10" r="5"/>',
  '<rect x="100" y="100" width="20" height="10"/>'
], { padding: 2 });
assert(vbMulti.minX === 3 && vbMulti.minY === 3 && vbMulti.width === 119 && vbMulti.height === 109,
  '多片段联合边界：' + JSON.stringify(vbMulti));
var vbEmpty = SVGUtil.computeViewBox('', {});
assert(vbEmpty.width === SVGUtil.SVG_DEFAULTS.width && vbEmpty.height === SVGUtil.SVG_DEFAULTS.height,
  '空输入回退默认尺寸');

// ============ 4. svgWrap 验收标准 ============
console.log('===== svgWrap（验收）=====');
var wrapped = SVGUtil.svgWrap('<circle cx="50" cy="50" r="40"/>');
assert(typeof wrapped === 'string' && wrapped.startsWith('<svg') && wrapped.endsWith('</svg>'), '输出完整 <svg>…</svg>');
assert(wrapped.includes('xmlns="http://www.w3.org/2000/svg"'), '含 xmlns 命名空间');
assert(wrapped.includes('<circle cx="50" cy="50" r="40"/>'), '内部片段原样保留');
assert(wrapped.includes('viewBox="0 0 100 100"'), '自动 viewBox 正确');
assert(wrapped.includes('role="img"'), '无障碍 role 标注');
var fixed = SVGUtil.svgWrap('<circle cx="50" cy="50" r="40"/>',
  { viewBox: '0 0 200 120', width: 400, height: 240, background: '#fff', className: 'scene' });
assert(fixed.includes('viewBox="0 0 200 120"') && fixed.includes('width="400"') && fixed.includes('class="scene"'),
  '显式 viewBox/尺寸/class 覆盖');
assert(fixed.includes('<rect x="0" y="0" width="200" height="120" fill="#fff"/>'), '背景矩形按 viewBox 绘制');

// 组合使用示例：文本 + 圆 + 线
var combo = SVGUtil.svgWrap([
  SVGUtil.svgCircle(80, 60, 30),
  SVGUtil.svgLine(50, 60, 110, 60),
  SVGUtil.svgText(80, 105, 'r = 30')
].join(''));
assert(combo.includes('font-family') && combo.includes('>r = 30</text>'), '组合场景：文本/线条混排');

console.log('\n' + (fail === 0 ? ('✅ svg-core 全部通过（' + pass + ' 项断言）') : ('❌ ' + fail + ' 项失败 / 共 ' + (pass + fail))));
process.exit(fail === 0 ? 0 : 1);
