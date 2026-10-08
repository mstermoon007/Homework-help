'use strict';

// P32-AS-04/09：答案防污染负断言。
// 1) RenderFormat.answerSpec 是批改专用只读规格（acceptable 打平标量、classify groups 透传）；
// 2) 作答前 screen/print HTML 不携带 value/acceptable/explanation/misconception，
//    无预填、无 checked、feedback 空占位（提交后由 markQuestions 注入）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RenderFormat = require(path.join(ROOT, 'shared', 'presentation', 'render-format.js'));
const HTMLRenderer = require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));

var SECRET_ANSWER = '秘密答案ZQX';
var SECRET_ALT = '秘密等价PGH';
var SECRET_EXPL = '秘密解析K7V';
var SECRET_MISC = '秘密错因9WR';

function fillSQ(extra) {
  return Object.assign({
    id: 'sq-fill', questionType: 'fill', answerMode: 'input',
    prompt: '计算下面各题（题干不含答案）',
    answer: { value: SECRET_ANSWER, acceptable: [SECRET_ALT], explanation: SECRET_EXPL },
    data: { misconception: SECRET_MISC }
  }, extra || {});
}

test('P32-AS-04 answerSpec 结构：value/acceptable 打平/precision/unit/mode；显示 answer 不变', () => {
  var q = RenderFormat.toRenderableQuestion(fillSQ({
    answer: { value: SECRET_ANSWER, acceptable: [SECRET_ALT], explanation: SECRET_EXPL, precision: 2, unit: '个' }
  }));
  assert.deepStrictEqual(q.answerSpec, {
    value: SECRET_ANSWER, acceptable: [SECRET_ALT], precision: 2, unit: '个', mode: 'input'
  });
  assert.strictEqual(q.answer, SECRET_ANSWER);
  assert.ok(!('explanation' in q.answerSpec), 'explanation 不进 answerSpec（提交后通道字段分离）');
});

test('P32-AS-04 acceptable 嵌套数组/非标量不参与判分（容忍缺陷形态，不抛错）', () => {
  var q = RenderFormat.toRenderableQuestion(fillSQ({
    answer: { value: '△', acceptable: [['△', '□', '○'], 3, null, { x: 1 }] }
  }));
  assert.deepStrictEqual(q.answerSpec.acceptable, ['3']);
});

test('P32-AS-04 classify：groups 仅该题型透传进 answerSpec', () => {
  var groups = { 红色: ['红圆卡'] };
  var cq = RenderFormat.toRenderableQuestion({
    id: 'sq-c', questionType: 'classify', answerMode: 'input', prompt: '分一分',
    answer: { value: '红色：红圆卡' }, data: { groups: groups }
  });
  assert.strictEqual(cq.answerSpec.groups, groups);
  var fq = RenderFormat.toRenderableQuestion(fillSQ({ data: { groups: { x: [] }, misconception: SECRET_MISC } }));
  assert.ok(!('groups' in fq.answerSpec), '非 classify 不透传 groups');
});

test('P32-AS-09 作答前 screen 渲染零答案：input 无 value，acceptable/解析/错因均不上屏', () => {
  var html = HTMLRenderer.render(fillSQ(), 0, { mode: 'screen' });
  assert.strictEqual(html.indexOf(SECRET_ANSWER), -1, 'value 泄露');
  assert.strictEqual(html.indexOf(SECRET_ALT), -1, 'acceptable 泄露');
  assert.strictEqual(html.indexOf(SECRET_EXPL), -1, 'explanation 提前上屏');
  assert.strictEqual(html.indexOf(SECRET_MISC), -1, 'misconception 提前上屏');
  assert.ok(/<input[^>]*class="answer-inp"[^>]*>/.test(html));
  assert.strictEqual(/\bvalue=/.test(html.match(/<input[^>]*class="answer-inp"[^>]*>/)[0]), false, '作答 input 不得预填 value');
  assert.ok(/<div class="feedback"><\/div>/.test(html), 'feedback 仅空占位');
});

test('P32-AS-09 作答前 print 渲染零答案：空白作答区、无输入值、无解析', () => {
  var html = HTMLRenderer.render(fillSQ(), 0, { mode: 'print' });
  assert.strictEqual(html.indexOf(SECRET_ANSWER), -1);
  assert.strictEqual(html.indexOf(SECRET_ALT), -1);
  assert.strictEqual(html.indexOf(SECRET_EXPL), -1);
  assert.strictEqual(html.indexOf(SECRET_MISC), -1);
  assert.strictEqual(html.indexOf('answer-inp-printblank') !== -1 || html.indexOf('aria-label="作答区"') !== -1, true);
});

test('P32-AS-09 judge：screen/print 均无 checked/选中态，解析提交后才可见', () => {
  var sq = {
    id: 'sq-j', questionType: 'judge', answerMode: 'judge', prompt: '判断说法是否正确',
    answer: { value: false, acceptable: [false], explanation: SECRET_EXPL },
    data: { misconception: SECRET_MISC }
  };
  ['screen', 'print'].forEach((mode) => {
    var html = HTMLRenderer.render(sq, 0, { mode: mode });
    assert.strictEqual(html.indexOf('checked'), -1, mode + ' 不得预选');
    assert.strictEqual(html.indexOf(SECRET_EXPL), -1, mode + ' 解析泄露');
    assert.strictEqual(html.indexOf(SECRET_MISC), -1, mode + ' 错因泄露');
  });
});

test('P32-AS-09 choice：选项可见是题型固有语义，但不得预选正确项', () => {
  var sq = {
    id: 'sq-o', questionType: 'choice', answerMode: 'choice', prompt: '选颜色',
    options: [{ value: '红' }, { value: '蓝' }, { value: '绿' }],
    answer: { value: '红', acceptable: [], explanation: SECRET_EXPL }
  };
  var html = HTMLRenderer.render(sq, 0, { mode: 'screen' });
  assert.strictEqual(html.indexOf('checked'), -1, '不得预选');
  assert.strictEqual(html.indexOf(SECRET_EXPL), -1, '解析泄露');
  var printHtml = HTMLRenderer.render(sq, 0, { mode: 'print' });
  assert.strictEqual(printHtml.indexOf('checked'), -1);
});
