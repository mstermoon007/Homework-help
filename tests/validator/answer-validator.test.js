'use strict';
/**
 * tests/validator/answer-validator.test.js — P28-24 移除 new Function
 * 验证 computeExpectedAnswer 的安全解析器
 */
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { computeExpectedAnswer, validateNumericAnswer, validateRemainderAnswer } = require('../../shared/validator/answer-validator.js');

const ANSWER_VALIDATOR_PATH = path.resolve(__dirname, '../../shared/validator/answer-validator.js');

test('P28-24 基本四则运算', function () {
  assert.strictEqual(computeExpectedAnswer('3 + 5'), '8');
  assert.strictEqual(computeExpectedAnswer('10 - 4'), '6');
  assert.strictEqual(computeExpectedAnswer('6 * 7'), '42');
  assert.strictEqual(computeExpectedAnswer('20 / 4'), '5');
});

test('P28-24 运算符优先级与括号', function () {
  assert.strictEqual(computeExpectedAnswer('3 + 5 * 2'), '13');
  assert.strictEqual(computeExpectedAnswer('(3 + 5) * 2'), '16');
  assert.strictEqual(computeExpectedAnswer('20 / 4 + 3'), '8');
  assert.strictEqual(computeExpectedAnswer('20 / (4 + 1)'), '4');
});

test('P28-24 中文运算符 × ÷', function () {
  assert.strictEqual(computeExpectedAnswer('6 × 7'), '42');
  assert.strictEqual(computeExpectedAnswer('20 ÷ 4'), '5');
  assert.strictEqual(computeExpectedAnswer('3 × 4 + 2'), '14');
});

test('P28-24 题干中的 ？ □ 空格 = 号', function () {
  assert.strictEqual(computeExpectedAnswer('3 + 5 = ?'), '8');
  assert.strictEqual(computeExpectedAnswer('3 + 5 ？'), '8');
  // 含 □ 的算式：strip 后若仍为合法表达式则计算，否则 null
  // "□ + 5 = 8" → "+58" 非法 → null；"3 + □ = 8" → "3+8" = 11
  assert.strictEqual(computeExpectedAnswer('□ + 5 = 8'), null);
  assert.strictEqual(computeExpectedAnswer('3 + □ = 8'), '11');
  assert.strictEqual(computeExpectedAnswer('  3 + 5  '), '8');
  assert.strictEqual(computeExpectedAnswer('3+5＝'), '8');
});

test('P28-24 小数', function () {
  assert.strictEqual(computeExpectedAnswer('1.5 + 2.25'), '3.75');
  assert.strictEqual(computeExpectedAnswer('0.1 + 0.2'), '0.3');
  assert.strictEqual(computeExpectedAnswer('10 / 4'), '2.5');
  assert.strictEqual(computeExpectedAnswer('.5 + .5'), '1');
  assert.strictEqual(computeExpectedAnswer('5. + 2'), '7');
});

test('P28-24 百分号 %（后缀，即除以 100）', function () {
  assert.strictEqual(computeExpectedAnswer('50%'), '0.5');
  assert.strictEqual(computeExpectedAnswer('50% * 200'), '100');
  assert.strictEqual(computeExpectedAnswer('100% + 50%'), '1.5');
  assert.strictEqual(computeExpectedAnswer('25% * 80'), '20');
});

test('P28-24 一元负号', function () {
  assert.strictEqual(computeExpectedAnswer('-5 + 3'), '-2');
  assert.strictEqual(computeExpectedAnswer('-(3 + 2)'), '-5');
  assert.strictEqual(computeExpectedAnswer('--5'), '5');
});

test('P28-24 分数写法（用 / 表示）', function () {
  assert.strictEqual(computeExpectedAnswer('1/2 + 1/4'), '0.75');
  assert.strictEqual(computeExpectedAnswer('3/4 * 100'), '75');
});

test('P28-24 非法/无法解析返回 null', function () {
  assert.strictEqual(computeExpectedAnswer(''), null);
  assert.strictEqual(computeExpectedAnswer('abc'), null);
  assert.strictEqual(computeExpectedAnswer('3 + foo'), null);
  // 缺右括号 / 多右括号 / 残留 token 现在都被拦截返回 null
  assert.strictEqual(computeExpectedAnswer('3 + (4 * 5'), null);
  assert.strictEqual(computeExpectedAnswer('3 + 4) * 5'), null);
  assert.strictEqual(computeExpectedAnswer('3 ** 2'), null); // 幂不支持
  assert.strictEqual(computeExpectedAnswer('Math.max(1,2)'), null); // 函数调用拦截
  assert.strictEqual(computeExpectedAnswer('1,2,3'), null); // 逗号拦截
  assert.strictEqual(computeExpectedAnswer('3 / 0'), null); // 除零保护
});

test('P28-25 恶意输入必须全部拦截 REJECT', function () {
  const malicious = [
    'constructor',
    'window',
    'process',
    'require',
    'Function',
    'document',
    'globalThis',
    'constructor.constructor',
    'window.alert',
    'process.env',
    'require("fs")',
    'Function("return 1")',
    'document.cookie',
    'globalThis.eval',
    '__proto__',
    'constructor.prototype',
    'Object.constructor',
    'Array.constructor',
    'eval',
    'setTimeout',
    'setInterval',
    'console.log',
  ];
  for (const m of malicious) {
    const result = computeExpectedAnswer(m);
    assert.strictEqual(result, null, '必须拦截: ' + m);
  }
});

test('FINAL-70 恶意输入嵌入算术表达式必须 FAIL（fail-closed 返回 null）', function () {
  // 载荷伪装在正常算式中——安全 parser 必须对赋值/成员/调用/位运算/比较/三元/模板/字面量等
  // 非四则语法全部拒绝；任何一个被求值都等于绕过。
  const embedded = [
    '1+process.exit(1)',
    '1 + process.exit(1)',
    '(0,process.exit(2))',
    "1+constructor.constructor('return 1')()",
    '1;globalThis.__FINAL70_PWNED=1',
    '1+(globalThis.__FINAL70_PWNED=1)',
    'globalThis.__FINAL70_PWNED=1',
    'a=1+2',
    '1?2:3',
    '1+[1]',
    '`${1}`',
    '1>>>2',
    '1|2',
    '1&2',
    '1<2',
    'new Date()',
    'delete x',
    '(function(){})()',
    '1..toString()',
    "'1'+'2'",
    'setTimeout("alert(1)")',
    'global["eval"]',
    '1+require("child_process")',
  ];
  // 注：'1==1' 不列入——题干归一化器会按小学数学记号剥离 '='（"3+5=8"），
  // '1==1' → '11' 是无意义数字而非求值（'=' 在到 tokenizer 前已被移除，
  // 且等号不携带任何执行原语）；任何含标识符/调用的赋值载荷仍在 tokenize 即拒。
  for (const payload of embedded) {
    assert.strictEqual(computeExpectedAnswer(payload), null, '恶意表达式必须 FAIL: ' + payload);
  }
});

test('FINAL-70 恶意输入不能执行（进程内哨兵：副作用绝不发生）', function () {
  // 若底层实现退化为 eval/Function，赋值型载荷会写入全局哨兵。
  delete globalThis.__FINAL70_PWNED;
  const sentinelPayloads = [
    'globalThis.__FINAL70_PWNED=1',
    '1;globalThis.__FINAL70_PWNED=1',
    '1+(globalThis.__FINAL70_PWNED=1)',
    '(globalThis.__FINAL70_PWNED="pwned")',
    'this.__FINAL70_PWNED=1',
  ];
  for (const payload of sentinelPayloads) {
    assert.strictEqual(computeExpectedAnswer(payload), null, '必须拒绝: ' + payload);
    assert.strictEqual(globalThis.__FINAL70_PWNED, undefined,
      '载荷被求值（哨兵被写入），说明存在动态执行: ' + payload);
  }
  delete globalThis.__FINAL70_PWNED;
});

test('FINAL-70 恶意输入不能执行（子进程证据：process.exit 载荷不生效）', function () {
  // 最强证据：在独立 node 进程内计算含 process.exit(123) 的表达式。
  // 安全 parser 拒绝解析 → 进程正常走到 process.exit(0)，退出码 0；
  // 若底层是 eval/Function，载荷会令进程以 123 退出（或崩溃为非 0）。
  const script =
    'var computeExpectedAnswer = require(' + JSON.stringify(ANSWER_VALIDATOR_PATH) + ').computeExpectedAnswer;' +
    'var r = computeExpectedAnswer("1+process.exit(123)");' +
    'if (r !== null) { process.exit(2); }' +
    'process.exit(0);';
  const r = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0,
    '子进程退出码 ' + r.status + '（期望 0）；stderr: ' + (r.stderr || '').slice(0, 300));
});

test('P28-24 validateNumericAnswer 集成', function () {
  const res = validateNumericAnswer({ value: '8', acceptable: [] }, '8');
  assert.strictEqual(res.match, true);
  const res2 = validateNumericAnswer({ value: '3.75', acceptable: [] }, '3.75');
  assert.strictEqual(res2.match, true);
  // 精度容差
  const res3 = validateNumericAnswer({ value: '0.3', precision: 1 }, '0.30000000000000004');
  assert.strictEqual(res3.match, true);
});

test('P28-24 validateRemainderAnswer 余数除法', function () {
  const res = validateRemainderAnswer({ value: '8……5' }, '53 ÷ 6 = ?');
  assert.strictEqual(res, true);
  const res2 = validateRemainderAnswer({ value: '8余5' }, '53 ÷ 6 = ?');
  assert.strictEqual(res2, true);
  const res3 = validateRemainderAnswer({ value: '8...5' }, '53 ÷ 6 = ?');
  assert.strictEqual(res3, true);
  // 错误余数
  assert.strictEqual(validateRemainderAnswer({ value: '8……6' }, '53 ÷ 6 = ?'), false);
  // 非余数题返回 null
  assert.strictEqual(validateRemainderAnswer({ value: '8' }, '5 + 3 = ?'), null);
});