'use strict';

// P32-AS-06/08：computeResult 批改聚合测试。
// 契约冻结：函数名/8 字段结构不变；判分唯一委托 AnswerValidator.gradeUserAnswer；
// defaultQCheck / answerParts / opts.checkFn 已物理删除。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
// Node 侧装载：common.js → core.js/check.js 增量挂载 global.PluginUtil
require(path.join(ROOT, 'shared', 'core', 'common.js'));
const computeResult = global.PluginUtil.computeResult;

function leg(questionType, answer, answerSpec, extra) {
  return Object.assign({
    q: '', text: '', questionType: questionType, type: questionType,
    answer: answer, answerSpec: answerSpec,
    explanation: null, misconception: null
  }, extra || {});
}
function spec(value, extra) {
  return Object.assign({ value: value, acceptable: [], precision: null, unit: null, mode: 'input' }, extra || {});
}

test('P32-AS-06/20 输出 9 字段结构冻结（AS-20 加 parentCheck）', () => {
  var qs = [leg('calc', '8', spec('8'), { q: '5+3=？' })];
  var r = computeResult(qs, ['8']);
  assert.deepStrictEqual(Object.keys(r).sort(),
    ['correct', 'correctAnswers', 'explanations', 'message', 'misconceptions', 'parentCheck', 'results', 'score', 'total']);
  assert.strictEqual(r.total, 1);
  assert.strictEqual(r.correct, 1);
  assert.strictEqual(r.score, 100);
  assert.strictEqual(r.message, '太棒了！全对！');
  assert.ok(Array.isArray(r.results));
  assert.strictEqual(r.parentCheck, false, '全可判集 → parentCheck=false');
});

test('P32-AS-06 判分经 gradeUserAnswer（混合题型 + 分数档位）', () => {
  var qs = [
    leg('calc', '8', spec('8'), { q: '5+3=？' }),
    leg('judge', false, spec(false, { mode: 'judge' })),
    leg('fill', '直角', spec('直角', { acceptable: ['90度', '90°'] })),
    leg('choice', '红', spec('红', { mode: 'choice' }))
  ];
  var r = computeResult(qs, ['8.00', '错', '90°', '红']);
  assert.deepStrictEqual(r.results, [true, true, true, true]);
  assert.strictEqual(r.score, 100);

  var r2 = computeResult(qs, ['7', '对', '锐角', '蓝']);
  assert.deepStrictEqual(r2.results, [false, false, false, false]);
  assert.strictEqual(r2.score, 0);
  assert.strictEqual(r2.message, '继续加油！');

  var r3 = computeResult(qs, ['8', '对', '直角', '红']);
  assert.strictEqual(r3.score, 75);
  assert.strictEqual(r3.message, '继续加油！');
  var r4 = computeResult(qs, ['8', '错', '直角', '红']);
  assert.strictEqual(r4.score, 100);
});

test('P32-AS-06 防污染：correctAnswers 只含 value，acceptable 白名单永不上屏', () => {
  var qs = [
    leg('fill', '直角', spec('直角', { acceptable: ['90度', '90°'] })),
    leg('apply', '120', spec('120', { acceptable: ['120立方厘米'] })),
    leg('fill', '2', spec('2', { acceptable: ['两'] }))
  ];
  var r = computeResult(qs, ['90°', '120立方厘米', '两']);
  assert.deepStrictEqual(r.results, [true, true, true]);
  assert.deepStrictEqual(r.correctAnswers, ['直角', '120', '2']);
  var serialized = JSON.stringify(r.correctAnswers) + r.message;
  assert.strictEqual(serialized.indexOf('90'), -1, '90度/90° 不得出现在上屏字段');
  assert.strictEqual(serialized.indexOf('立方厘米'), -1);
  assert.strictEqual(serialized.indexOf('两'), -1);
});

test('P32-AS-06/20 null 三态：不可自动判不计正确，parentCheck 聚合为 true（家长检查通道）', () => {
  // P32-AS-20 复现题：read-aloud 不可判 → grade=null → results[i]=false + parentCheck=true
  var qs = [
    leg('read-aloud', 'whatever', spec('whatever', { mode: 'read-aloud' })),
    leg('calc', '8', spec('8'))
  ];
  var r = computeResult(qs, ['任意朗读', '8']);
  assert.deepStrictEqual(r.results, [false, true], 'null → false（不"非空即对"）');
  assert.strictEqual(r.correct, 1, 'null 题不计正确');
  assert.strictEqual(r.parentCheck, true, '任一 null → parentCheck=true');
  // 反向断言：全可判集 → parentCheck=false
  var r2 = computeResult([leg('calc', '8', spec('8'))], ['8']);
  assert.strictEqual(r2.parentCheck, false, '全可判集 → parentCheck=false');
  // 边界：空集 → parentCheck=false（无 null 题）
  var r3 = computeResult([], []);
  assert.strictEqual(r3.parentCheck, false, '空集 → parentCheck=false');
});

test('P32-AS-06 空作答全部 false（禁止非空即对的反向：空也不得判对）', () => {
  var qs = [leg('calc', '8', spec('8')), leg('judge', true, spec(true, { mode: 'judge' }))];
  var r = computeResult(qs, ['', '']);
  assert.deepStrictEqual(r.results, [false, false]);
});

test('P32-AS-06 explanation/misconception 走提交后数据通道（逐题透传，缺失即 null）', () => {
  var qs = [
    leg('judge', true, spec(true, { mode: 'judge' }), { explanation: '因为偶数定义', misconception: '混淆奇偶' }),
    leg('calc', '8', spec('8'))
  ];
  var r = computeResult(qs, ['对', '8']);
  assert.deepStrictEqual(r.explanations, ['因为偶数定义', null]);
  assert.deepStrictEqual(r.misconceptions, ['混淆奇偶', null]);
});

test('P32-AS-06 数组答案显示值拼接；total=0 不除零', () => {
  var qs = [leg('fill', ['甲', '乙'], spec('甲、乙'))];
  var r = computeResult(qs, ['甲、乙']);
  assert.strictEqual(r.correctAnswers[0], '甲、乙');
  var r0 = computeResult([], []);
  assert.strictEqual(r0.score, 0);
  assert.strictEqual(r0.total, 0);
});

test('P32-AS-08 defaultQCheck 轨道已物理删除', () => {
  assert.strictEqual(global.PluginUtil.defaultQCheck, undefined);
  assert.strictEqual(global.defaultQCheck, undefined);
  assert.strictEqual(global.PluginUtil.normalizeAns, undefined);
  assert.strictEqual(global.normalizeAns, undefined);
  var commonExports = require(path.join(ROOT, 'shared', 'core', 'check.js'));
  assert.strictEqual(commonExports.defaultQCheck, undefined);
  assert.strictEqual(typeof commonExports.computeResult, 'function');
});
