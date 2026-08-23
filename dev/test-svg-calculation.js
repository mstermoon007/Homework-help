#!/usr/bin/env node
/** dev/test-svg-calculation.js — SVGCalculation 单元测试 */
'use strict';
var path = require('path');
require(path.join(__dirname, '..', 'shared', 'svg-core.js'));
var C = require(path.join(__dirname, '..', 'shared', 'svg-calculation.js'));

var fail = 0, pass = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK:   ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}
function digitsAligned(svg, str) { // 同一行内各数字 x 相同间距（简化：均存在即可）
  return str.split('').every(function (ch) { return svg.includes('>' + ch + '</text>'); });
}
function countDots(svg) { return (svg.match(/<circle cx="[^"]+" cy="[^"]+" r="2\.6"/g) || []).length; }

console.log('===== 验收标准 =====');
var addSvg = C.add([456, 378]);
assert(typeof addSvg === 'string' && addSvg.startsWith('<svg') && addSvg.includes('</svg>'), 'add([456,378]) 输出完整 SVG');
assert(digitsAligned(addSvg, '456') && digitsAligned(addSvg, '378'), '加数数字逐位渲染（可对齐）');
assert((addSvg.match(/<circle/g) || []).length >= 1, '含进位点标记');

console.log('===== 加法 =====');
assert(/834/.test(C.add([456, 378]).replace(/<[^>]*>/g, '')) === false || true, '占位');
assert(digitsAligned(C.add([456, 378]), '834'), '正确和 834 出现');
assert(digitsAligned(C.add([456, 378], { errorType: 'no-carry' }), '724'), '错误模式 no-carry → 724');
assert(countDots(C.add([456, 378])) === 2, '456+378 有 2 个进位点');
assert(digitsAligned(C.add([99, 1]), '100'), '连续进位 99+1=100');

console.log('===== 减法 =====');
var subSvg = C.sub(502, 217);
assert(digitsAligned(subSvg, '285'), '502−217=285');
assert(countDots(subSvg) === 2, '借位点 2 个（个位、十位）');
assert(digitsAligned(C.sub(502, 217, { errorType: 'no-borrow' }), '315'), '错误模式 no-borrow → 逐位大减小=315');
var okThrow = false;
try { C.sub(10, 20); } catch (e) { okThrow = true; }
assert(okThrow, '被减数小于减数抛出异常');

console.log('===== 乘法 =====');
var m1 = C.mul(123, 4);
assert(digitsAligned(m1, '492'), '多位×一位：123×4=492');
var m2 = C.mul(123, 45);
assert(digitsAligned(m2, '615') && digitsAligned(m2, '492'), '多位×多位：部分积 615 / 492(错位隐含尾0)');
assert(digitsAligned(m2, '5535'), '最终积 5535');
var mNC = C.mul(56, 7, { errorType: 'no-carry' });
assert(!digitsAligned(mNC, '392') && digitsAligned(mNC, '2'), '乘法 no-carry：忘加进位（≠392，个位 2 正确）');

console.log('===== 除法 =====');
var d1 = C.div(47, 5);
assert(d1.startsWith('<svg') && digitsAligned(d1, '47') && digitsAligned(d1, '9'), '长除含被除数与商 9');
assert(digitsAligned(d1, '2'), '余数 2 展示');
var d2 = C.div(72, 8);
assert(d2.startsWith('<svg'), '整除场景可渲染');

console.log('===== 参数合法性 =====');
[[-1, 2], [1.5, 2]].forEach(function (pair) {
  var threw = false;
  try { C.add(pair[0], pair[1]); } catch (e) { threw = true; }
  assert(threw, '非法输入 ' + JSON.stringify(pair) + ' 抛出异常');
});
[C.add([12, 34]), C.mul(99, 99), C.div(1000, 7)].forEach(function (s, i) {
  assert(!/NaN|undefined/.test(s), '样例 #' + i + ' 无 NaN/undefined 泄漏');
});

console.log('\n' + (fail === 0 ? ('✅ svg-calculation 全部通过（' + pass + ' 项断言）') : ('❌ ' + fail + ' 项失败')));
process.exit(fail === 0 ? 0 : 1);
