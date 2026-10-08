'use strict';

// P32-AS-05/07/13：运行时判分唯一入口 gradeUserAnswer 单元测试。
// P32-AS-17：单元测试补盲（AS-14 null 边界 / acceptable 边界 / precision 边界 /
// 余数记号补全 / judge 大小写 / classify 分隔与重复 / 防御路径）。
// 三态契约：true 正确 / false 错误 / null 不可自动判（家长检查，禁止非空即对）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AV = require(path.join(ROOT, 'shared', 'validator', 'answer-validator.js'));
const grade = AV.gradeUserAnswer;

function spec(value, extra) {
  return Object.assign({ value: value, acceptable: [], precision: null, unit: null, mode: 'input' }, extra || {});
}

test('P32-AS-05 judge：期望由 answer.value 自证（boolean 与布尔词同源）', () => {
  const t = spec(true, { mode: 'judge' });
  const f = spec(false, { mode: 'judge' });
  ['true', '对', '是', 'yes', 'Y', 'T', '1', '✓', '正确'].forEach((u) => {
    assert.strictEqual(grade(u, t, { questionType: 'judge' }), true, '真集: ' + u);
    assert.strictEqual(grade(u, f, { questionType: 'judge' }), false, '真集答假命题: ' + u);
  });
  ['false', '错', '否', 'no', 'N', 'F', '0', '✗', '错误'].forEach((u) => {
    assert.strictEqual(grade(u, f, { questionType: 'judge' }), true, '假集: ' + u);
    assert.strictEqual(grade(u, t, { questionType: 'judge' }), false, '假集答真命题: ' + u);
  });
  // 字符串型 value 同样可自证
  assert.strictEqual(grade('错', spec('false', { mode: 'judge' }), { questionType: 'judge' }), true);
});

test('P32-AS-05 judge：无法识别的作答 → false（不是 null：题型本身可自动判）', () => {
  assert.strictEqual(grade('也许', spec(true, { mode: 'judge' }), { questionType: 'judge' }), false);
  assert.strictEqual(grade('', spec(true, { mode: 'judge' }), { questionType: 'judge' }), false);
});

test('P32-AS-05 judge：answer.value 自身不可解析 → null（题目数据缺陷，不可判）', () => {
  assert.strictEqual(grade('对', spec('maybe'), { questionType: 'judge' }), null);
});

test('P32-AS-05 choice：与选项值精确匹配，空白/大小写归一', () => {
  const s = spec('A', { mode: 'choice' });
  assert.strictEqual(grade('A', s, { questionType: 'choice' }), true);
  assert.strictEqual(grade(' a ', s, { questionType: 'choice' }), true); // 去全部空白+小写（归一化唯一口径）
  assert.strictEqual(grade('B', s, { questionType: 'choice' }), false);
  const s2 = spec('red', { acceptable: ['RED'], mode: 'choice' });
  assert.strictEqual(grade('red', s2, { questionType: 'choice' }), true);
  assert.strictEqual(grade('red ', s2, { questionType: 'choice' }), true);
});

test('P32-AS-05 calc：数值容差判定（默认 precision=2）', () => {
  const s = spec('8');
  assert.strictEqual(grade('8', s, { questionType: 'calc', prompt: '5+3=？' }), true);
  assert.strictEqual(grade('8.00', s, { questionType: 'calc' }), true);
  assert.strictEqual(grade('7.999', s, { questionType: 'calc' }), true);
  assert.strictEqual(grade('7', s, { questionType: 'calc' }), false);
  const p1 = spec('0.3', { precision: 1 });
  assert.strictEqual(grade('0.30000000000000004', p1, { questionType: 'calc' }), true);
  const p2 = spec('0.25');
  assert.strictEqual(grade('0.26', p2, { questionType: 'calc' }), false); // 差 0.01 不小于容差
});

test('P32-AS-05 calc/fill：acceptable 语义等价白名单判分', () => {
  assert.strictEqual(grade('两', spec('2', { acceptable: ['两'] }), { questionType: 'fill' }), true);
  assert.strictEqual(grade('2', spec('2', { acceptable: ['两'] }), { questionType: 'fill' }), true);
  assert.strictEqual(grade('三', spec('2', { acceptable: ['两'] }), { questionType: 'fill' }), false);
  assert.strictEqual(grade('90°', spec('直角', { acceptable: ['90度', '90°'] }), { questionType: 'fill' }), true);
  assert.strictEqual(grade('直角', spec('直角', { acceptable: ['90度', '90°'] }), { questionType: 'fill' }), true);
  assert.strictEqual(grade('120立方厘米', spec('120', { acceptable: ['120立方厘米'] }), { questionType: 'apply' }), true);
  assert.strictEqual(grade('甲', spec('甲', { acceptable: ['图形甲'] }), { questionType: 'fill' }), true);
});

test('P32-AS-05 余数除法：b×q+r=a 且 0≤r<b，记号归一', () => {
  var ctx = { questionType: 'calc', prompt: '53 ÷ 6 = ？' };
  var s = spec('8……5');
  ['8……5', '8...5', '8余5', ' 8 …… 5 '].forEach((u) => {
    assert.strictEqual(grade(u, s, ctx), true, u);
  });
  assert.strictEqual(grade('7……11', s, ctx), false, '余数 ≥ 除数');
  assert.strictEqual(grade('8……6', s, ctx), false, '余数越界');
  assert.strictEqual(grade('9……-1', s, ctx), false);
  assert.strictEqual(grade('53', s, ctx), false, '只给被除数不等于商余形式');
});

test('P32-AS-13 classify：组→项集合顺序无关配对', () => {
  var s = spec('红色：红圆卡、红方卡、红三角卡；蓝色：蓝圆卡；黄色：黄三角卡、黄方卡', {
    groups: { 红色: ['红圆卡', '红方卡', '红三角卡'], 蓝色: ['蓝圆卡'], 黄色: ['黄三角卡', '黄方卡'] }
  });
  assert.strictEqual(grade(s.value, s, { questionType: 'classify' }), true);
  var shuffled = '黄色：黄方卡、黄三角卡；蓝色：蓝圆卡；红色：红三角卡、红圆卡、红方卡';
  assert.strictEqual(grade(shuffled, s, { questionType: 'classify' }), true);
  assert.strictEqual(grade('红色：红圆卡、红方卡；蓝色：蓝圆卡；黄色：黄三角卡、黄方卡', s, { questionType: 'classify' }), false, '组内缺项');
  assert.strictEqual(grade('红色：红圆卡、红方卡、外星人；蓝色：蓝圆卡；黄色：黄三角卡、黄方卡', s, { questionType: 'classify' }), false, '错项');
  assert.strictEqual(grade('红色：红圆卡、红方卡、红三角卡；蓝色：蓝圆卡', s, { questionType: 'classify' }), false, '缺整组');
  assert.strictEqual(grade('颜色：随便；红色：红圆卡、红方卡、红三角卡；蓝色：蓝圆卡；黄色：黄三角卡、黄方卡', s, { questionType: 'classify' }), false, '多余组标签');
  assert.strictEqual(grade('我不知道', s, { questionType: 'classify' }), null, '不可解析 → parentCheck');
  assert.strictEqual(grade('', s, { questionType: 'classify' }), false, '空作答 → false');
});

test('P32-AS-13 classify：无 data.groups → null（不可自动判）', () => {
  assert.strictEqual(grade('红色：红圆卡', spec('红色：红圆卡'), { questionType: 'classify' }), null);
});

test('P32-AS-05 geometry/apply 短答可判；none/read-aloud 不可判', () => {
  assert.strictEqual(grade('12', spec('12'), { questionType: 'geometry' }), true);
  assert.strictEqual(grade('13', spec('12'), { questionType: 'geometry' }), false);
  assert.strictEqual(grade('请画图说明', spec('画图'), { questionType: 'geometry' }), false); // 文本答案按白名单判
  assert.strictEqual(grade('奇数', spec('奇数'), { questionType: 'apply' }), true);
  assert.strictEqual(grade('你好', spec('whatever', { mode: 'read-aloud' }), { questionType: 'read-aloud' }), null);
  assert.strictEqual(grade('你好', spec('whatever', { mode: 'none' }), { questionType: 'none' }), null);
});

test('P32-AS-05 公共边界：空 spec/空 value/空作答', () => {
  assert.strictEqual(grade('8', null, { questionType: 'calc' }), null);
  assert.strictEqual(grade('8', spec(null), { questionType: 'calc' }), null);
  assert.strictEqual(grade('8', spec(''), { questionType: 'calc' }), null);
  assert.strictEqual(grade('   ', spec('8'), { questionType: 'calc' }), false);
  assert.strictEqual(grade(undefined, spec('8'), { questionType: 'calc' }), false);
});

test('P32-AS-05 acceptable 中非标量（嵌套数组缺陷形态）不参与判分', () => {
  var s = spec('△', { acceptable: [['△', '□', '○']] });
  assert.strictEqual(grade('□', s, { questionType: 'fill' }), false);
  assert.strictEqual(grade('△', s, { questionType: 'fill' }), true);
});

// ── P32-AS-17 单元测试补盲 ───────────────────────────────────────────────

test('P32-AS-17 apply/geometry：候选全为长文本说理 → null（家长检查；边界只看答案侧，不看作答侧）', () => {
  var s1 = spec('因为2024÷4=506没有余数，所以2024年是闰年');
  assert.strictEqual(grade('2024年是闰年', s1, { questionType: 'apply' }), null, '开放题不得机械判错');
  assert.strictEqual(grade('随便答一句', s1, { questionType: 'apply' }), null, '禁止非空即对，也禁止非空即错');
  assert.strictEqual(grade('闰年', s1, { questionType: 'apply' }), null, '作答侧短答不改变答案侧边界');
  var s2 = spec('先量出线段长度，再画一条同样长的线段');
  assert.strictEqual(grade('我画好了', s2, { questionType: 'geometry' }), null, '作图/实操 → null');
  // 任一候选为纯数值或 ≤6 汉字短答 → 恢复自动判分
  var s3 = spec('366', { acceptable: ['366天'] });
  assert.strictEqual(grade('366', s3, { questionType: 'apply' }), true, '纯数值候选自动判');
  assert.strictEqual(grade('366天', s3, { questionType: 'apply' }), true, '短答白名单自动判');
});

test('P32-AS-17 acceptable 边界：重复值无害（运行时）；质检方向拦 value 错误', () => {
  // 运行时：重复候选只影响 some/indexOf 命中，不改判分
  var dup = spec('2', { acceptable: ['两', '两', '2'] });
  assert.strictEqual(grade('两', dup, { questionType: 'fill' }), true);
  assert.strictEqual(grade('三', dup, { questionType: 'fill' }), false);
  // 质检方向（validateNumericAnswer）：value 与题干重算期望不符 → ERROR；
  // acceptable 内容合规由生成侧 finish 契约过滤承担（AS-11），运行时不猜测语义等价
  var gate = AV.validateNumericAnswer({ value: '3', acceptable: [] }, '2');
  assert.strictEqual(gate.match, false);
  assert.strictEqual(gate.errors.length, 1, 'value 错误 → ANSWER_MISMATCH');
  var gateOk = AV.validateNumericAnswer({ value: '2', acceptable: ['两'] }, '2');
  assert.strictEqual(gateOk.match, true);
  assert.strictEqual(gateOk.errors.length, 0);
});

test('P32-AS-17 precision 边界：0 位容差（差 <1 即真）与非法值回落默认 2', () => {
  var p0 = spec('8', { precision: 0 });
  assert.strictEqual(grade('8.5', p0, { questionType: 'calc' }), true, 'tolerance=1：差 0.5 < 1');
  assert.strictEqual(grade('9', p0, { questionType: 'calc' }), false, '差 1 不小于 1');
  var pNaN = spec('8', { precision: 'abc' });
  assert.strictEqual(grade('7.98', pNaN, { questionType: 'calc' }), false, 'NaN → 默认 2：差 0.02 超容差');
  assert.strictEqual(grade('7.999', pNaN, { questionType: 'calc' }), true, '差 0.001 在容差内');
});

test('P32-AS-17 余数记号补全：单省略号/多句点/「余」带空格；题干无除式退回文本等价', () => {
  var ctx = { questionType: 'calc', prompt: '53 ÷ 6 = ？' };
  var s = spec('8……5');
  assert.strictEqual(grade('8…5', s, ctx), true, '单省略号归一');
  assert.strictEqual(grade('8.....5', s, ctx), true, '多句点归一');
  assert.strictEqual(grade('8 余 5', s, ctx), true, '「余」带空格归一');
  // 题干解析不出 a÷b 结构 → 记号归一后文本等价比较
  var noDiv = { questionType: 'calc', prompt: '把 53 个苹果平均分装' };
  assert.strictEqual(grade('8……5', s, noDiv), true, '无除式 → 文本等价');
  // 期望非余数而作答带余数记号 → 不命中数值也不命中文本
  assert.strictEqual(grade('16……0', spec('16'), { questionType: 'fill', prompt: '' }), false);
});

test('P32-AS-17 judge：大小写变体归一', () => {
  var t = spec(true, { mode: 'judge' });
  assert.strictEqual(grade('YES', t, { questionType: 'judge' }), true);
  assert.strictEqual(grade('True', t, { questionType: 'judge' }), true);
  var f = spec(false, { mode: 'judge' });
  assert.strictEqual(grade('NO', f, { questionType: 'judge' }), true);
});

test('P32-AS-17 classify：半角冒号/逗号分隔与组内重复项', () => {
  var s = spec('红色：红圆卡、红方卡；蓝色：蓝圆卡', {
    groups: { 红色: ['红圆卡', '红方卡'], 蓝色: ['蓝圆卡'] }
  });
  assert.strictEqual(grade('红色:红圆卡,红方卡；蓝色:蓝圆卡', s, { questionType: 'classify' }), true, '半角冒号+半角逗号');
  assert.strictEqual(grade('红色：红圆卡、红圆卡、红方卡；蓝色：蓝圆卡', s, { questionType: 'classify' }), false, '组内重复项 → 数目不符');
});

test('P32-AS-17 防御：value=0 合法非空；ctx 缺 questionType 回退短答路径', () => {
  assert.strictEqual(grade('0', spec(0), { questionType: 'fill' }), true, 'value=0 不按空答案处理');
  assert.strictEqual(grade('8', spec('8'), {}), true, '无 questionType → 短答路径');
  assert.strictEqual(grade('8', spec('8'), null), true, 'ctx=null → 短答路径');
});
