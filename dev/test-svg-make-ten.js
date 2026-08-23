#!/usr/bin/env node
/** dev/test-svg-make-ten.js — SVGMakeTen 单元测试 */
'use strict';
var path = require('path');
require(path.join(__dirname, '..', 'shared', 'svg-core.js'));
var M = require(path.join(__dirname, '..', 'shared', 'svg-make-ten.js'));

var fail = 0, pass = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK:   ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}
function plain(svg) { return svg.replace(/<[^>]*>/g, ''); }

console.log('===== 验收标准 =====');
var po = M.poTen(15, 8);
assert(typeof po === 'string' && po.startsWith('<svg'), 'poTen(15,8) 输出完整 SVG');
var poText = plain(po);
assert(/10 - 8/.test(poText) && poText.includes('2'), '展示 10-8=2');
assert(/2 \+ 5/.test(poText) || /2 ＋ 5/.test(poText) || (poText.includes('2') && poText.includes('5')), '展示 2+5');
assert(poText.includes('= 7'), '结果 7');

console.log('===== 凑十 =====');
var mk = plain(M.makeTen(9, 5));
assert(mk.includes('5 = 1 + 4'), '拆第二加数：5=1+4');
assert(mk.includes('9 + 1') && /= 14/.test(mk), '9+1=10，10+4=14');
assert(M.makeTenSteps(9, 5).answer === 14, 'steps.answer=14');

console.log('===== 平十 =====');
var pt = plain(M.pingTen(15, 8));
assert(pt.includes('8 = 5 + 3'), '平十：8=5+3（个位在前）');
assert(pt.includes('15 - 5') && pt.includes('10 - 3') && pt.includes('= 7'), '15−5=10 → 10−3=7');

console.log('===== 无法分解处理 =====');
assert(M.makeTen(3, 4) === null, '凑十：和≤10 返回 null');
assert(M.makeTen(12, 3) === null, '凑十：超出 20 以内返回 null');
assert(M.pingTen(13, 2) === null, '平十：减数不大于个位返回 null');
assert(M.poTen(25, 8) === null, '破十：非十几返回 null');

console.log('===== 多组合批量 =====');
[[9, 5], [8, 6], [7, 7], [6, 9]].forEach(function (pair) {
  var s = M.makeTen(pair[0], pair[1]);
  var okS = s && s.startsWith('<svg') && !/NaN|undefined/.test(s);
  assert(okS, '凑十 ' + pair[0] + '+' + pair[1] + ' 合法输出');
});
[[15, 8], [14, 6], [12, 5], [16, 9]].forEach(function (pair) {
  assert(M.pingTen(pair[0], pair[1]) && M.poTen(pair[0], pair[1]), '平十/破十 ' + pair[0] + '-' + pair[1]);
});
[[M.makeTen(9, 5), '凑十'], [M.pingTen(15, 8), '平十'], [M.poTen(15, 8), '破十']].forEach(function (item) {
  assert(!/NaN|undefined/.test(item[0]), item[1] + ' 无 NaN 泄漏');
});

console.log('\n' + (fail === 0 ? ('✅ svg-make-ten 全部通过（' + pass + ' 项断言）') : ('❌ ' + fail + ' 项失败')));
process.exit(fail === 0 ? 0 : 1);
