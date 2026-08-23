#!/usr/bin/env node
/**
 * dev/test-difficulty-structure.js — DifficultyProfile 结构复杂度验证
 *
 * 检查：
 *   1. level 1–10 结构复杂度严格单调递增（complexityScore）
 *   2. 五个分档边界正确（steps / allowBracket / allowMultDiv 逐档断言）
 *   3. 非法输入回退（0、负数、NaN、11、小数）
 *   4. createProfile 合并/钳制/类型偏好推导
 *   5. consumeProfile 各插件类型参数一致性
 */
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'shared/common.js'));
var D = require(path.join(ROOT, 'shared/difficulty.js'));

var passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg); }
}

// ============ 1. 单调性 ============
console.log('\n===== 结构复杂度单调性 =====');
var prev = -Infinity, mono = true;
for (var lv = 1; lv <= 10; lv++) {
  var s = D.difficultyToStructure(lv);
  if (!(s.complexityScore > prev)) { mono = false; console.log('    level ' + lv + ' score=' + s.complexityScore + ' 未大于前一档 ' + prev); }
  prev = s.complexityScore;
}
ok(mono, 'level 1-10 complexityScore 严格单调递增');

// ============ 2. 分档边界 ============
console.log('\n===== 分档边界 =====');
var EXPECT = [
  /*lv*/ [1, 2].map(function (l) { return [l, 1, false, false]; }),
];
// 显式逐档期望表：[level, steps, bracket, md]
var table = [
  [1, 1, false, false], [2, 1, false, false],
  [3, 2, false, false], [4, 2, false, false],
  [5, 3, true, true], [6, 3, true, true],
  [7, 4, true, true], [8, 4, true, true],
  [9, 5, true, true], [10, 5, true, true]
];
table.forEach(function (row) {
  var l = row[0], st = D.difficultyToStructure(l);
  ok(st.steps === row[1] && st.allowBracket === row[2] && st.allowMultDiv === row[3],
    'level ' + l + ' → steps=' + st.steps + ' bracket=' + st.allowBracket + ' multdiv=' + st.allowMultDiv);
});

console.log('\n===== 档位特性标记 =====');
ok(D.difficultyToStructure(4).chainAddSub === true && D.difficultyToStructure(2).chainAddSub === false,
  '连加连减：tier2 无 → tier3(3-4级难度) 有');
ok(D.difficultyToStructure(7).alternateOps === true && D.difficultyToStructure(6).alternateOps === false,
  '符号交替：仅 7-8 及以上');
ok(D.difficultyToStructure(9).nestedBrackets === true && D.difficultyToStructure(8).nestedBrackets === false,
  '多层括号：仅 9-10');

// ============ 3. 非法输入回退 ============
console.log('\n===== 非法输入回退 =====');
ok(D.difficultyToStructure(0).steps === D.difficultyToStructure(3).steps, 'level 0 回退默认 3 档结构');
ok(D.difficultyToStructure(-5).steps === D.difficultyToStructure(3).steps, '负数回退 3');
ok(D.difficultyToStructure(NaN).complexityScore === D.difficultyToStructure(3).complexityScore, 'NaN 回退 3');
ok(D.difficultyToStructure(99).steps === D.difficultyToStructure(10).steps, '99 钳到 10');
ok(D.difficultyToStructure(7.6).steps === D.difficultyToStructure(8).steps, '7.6 四舍五入到 8');

// ============ 4. createProfile 合并/钳制/偏好 ============
console.log('\n===== createProfile =====');
var p1 = D.createProfile(3, 0);
ok(p1.effectiveLevel === 3 && p1.scale === 1, '基准 3+0 → effectiveLevel=3 scale=1');
ok(p1.typePreference === null, '无 delta → typePreference=null');
var p2 = D.createProfile(3, 2);
ok(p2.effectiveLevel === 5 && p2.scale === 1.4 && p2.structure.steps === 3 && p2.structure.allowBracket === true,
  '3+2 → 5 级：scale=1.4 steps=3 有括号');
ok(p2.typePreference === 'hard', '正 delta 推导 hard');
ok(D.createProfile(4, -1).typePreference === 'easy', '负 delta 推导 easy');
var p3 = D.createProfile(9, 2);
ok(p3.effectiveLevel === 10 && p3.structure.nestedBrackets === true, '9+2 钳制到 10 且多层括号');
var p4 = D.createProfile(2, -5);
ok(p4.effectiveLevel === 1, '2−5 钳制到 1');
var p5 = D.createProfile(6, 0, { typeBias: 'easy' });
ok(p5.typePreference === 'easy' && p5.effectiveLevel === 6, '显式 typeBias 覆盖推导');
ok(D.createProfile('x').effectiveLevel === 3, '非法 base 回退 3');

// ============ 5. consumeProfile ============
console.log('\n===== consumeProfile =====');
var prof = D.createProfile(8, 0);
var ex = D.consumeProfile(prof, 'expression');
ok(ex.allowBracket === true && ex.allowMultDiv === true && ex.alternateOps === true && ex.maxOperand === Math.round(20 * 2),
  'expression@8：括号/乘除/交替开，maxOperand=40');
ok(ex.steps === 4 && ex.difficulty === 8, 'expression 透传 difficulty/steps');
var oral = D.consumeProfile(D.createProfile(1, 0), 'oral');
ok(oral.carry === false && oral.maxOperand === 6, 'oral@1：无进位 maxOperand=6（scale 0.6）');
var app = D.consumeProfile(D.createProfile(5, 0), 'application');
ok(app.multiStep === true && app.fractionsPercent === false, 'application@5：多步但无分数百分数');
var dft = D.consumeProfile(prof, 'unknown-type');
ok(dft.difficulty === 8 && dft.steps === 4, '未知类型兜底透传三键');
var threw = false;
try { D.consumeProfile(null, 'expression'); } catch (e) { threw = true; }
ok(threw, '空 profile 抛错');

// ============ 输出 ============
console.log('\n========================================');
if (failed) { console.log('❌ ' + failed + ' 项失败'); process.exit(1); }
console.log('✅ 全部通过（共 ' + passed + ' 项断言）');
