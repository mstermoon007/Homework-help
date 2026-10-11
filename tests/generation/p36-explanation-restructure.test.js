// P36-02：开放设计类讲解「规则内重组」定向断言
// 覆盖：code-recognition apply（5 类题库）讲解重组；reasoning sudoku/winning 死分支
// 已于 P36-03 物理删除，此处保留防双轨回归负断言（P30 §5：删除不留壳）。
// 口径：仅用生成器既有素材（规则/答案/题面要素）重组，不新增教学支架；
//       讲解必须 ① 非空 ② 非「根据数字编码规则：<答案>」纯复述 ③ 含既有规则要素。
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const codeGen = require('../../shared/generator/generators/semantic-special.js').buildAll()
  .find(g => g.id === 'generator:code-recognition');
const reasoningGen = require('../../shared/generator/generators/reasoning.js').createReasoningGenerator({});

function codeApply(name, i) {
  return codeGen.generate({
    knowledgePointIds: ['math-g3-up-u06-k001'], questionTypeId: 'apply',
    difficulty: 3, count: 4, seed: 't', semanticParams: { name }
  }, {})[i];
}
function reasoningApply(name, i) {
  return reasoningGen.generate({
    knowledgePointIds: ['math-g5-down-u08-k003'], questionTypeId: 'apply',
    difficulty: 3, count: 3, seed: 't', semanticParams: { name }
  }, {})[i];
}

test('P36-02 code-recognition apply：双段答案重组为逐项作答结构', () => {
  // life 类（认识生活中的数字编码）：v0 双段、含 119
  const q0 = codeApply('认识生活中的数字编码', 0);
  const e0 = q0.answer.explanation;
  assert.ok(e0 && e0.length > 0, '讲解非空');
  assert.ok(!e0.startsWith('根据数字编码规则：'), '不再是规则纯复述模板');
  assert.ok(e0.indexOf('按题面任务逐项作答：① ') === 0, '双段答案走逐项作答结构');
  assert.ok(e0.indexOf('；② ') !== -1, '第二任务标注 ②');
  assert.ok(e0.indexOf('119') !== -1, '讲解含答案要素 119');
  assert.ok(e0.indexOf(q0.prompt) === -1, '非题面复述');
});

test('P36-02 code-recognition apply：单段答案回落依据式且无叠词病句', () => {
  // idcard v2（学籍表）答案为单段——回落依据式
  const single = codeApply('身份证号码的编码规则', 2);
  assert.ok(single.answer.explanation.indexOf('依据题中的编码规则作答：') === 0, '单段回落依据式');
  for (const i of [0, 1, 2, 3]) {
    const e = codeApply('实践活动', i).answer.explanation;
    assert.ok(e.indexOf('规则：规则：') === -1, '无「规则：规则：」叠词 v=' + i);
  }
  // practice v1（宾馆房号）双段：设计规则 + 举例，走逐项作答
  const p1 = codeApply('实践活动', 1).answer.explanation;
  assert.ok(p1.indexOf('按题面任务逐项作答：① ') === 0 && p1.indexOf('；② ') !== -1);
});

test('P36-02 code-recognition apply：讲解要素与答案一致（五类题库全量）', () => {
  const cats = ['身份证号码的编码规则', '邮政编码', '数字编码的特点', '实践活动', '认识生活中的数字编码'];
  for (const name of cats) {
    for (let i = 0; i < 4; i++) {
      const q = codeApply(name, i);
      const e = q.answer.explanation;
      assert.ok(e && e.length > 10, name + ' v=' + i + ' 讲解非空');
      assert.ok(!e.startsWith('根据数字编码规则：'), name + ' v=' + i + ' 非旧复述模板');
      // 答案首段（直接作答部分）必须出现在讲解中——既有素材重组的证据
      const head = String(q.answer.value).split('；')[0];
      assert.ok(e.indexOf(head) !== -1, name + ' v=' + i + ' 讲解含答案要素');
    }
  }
});

test('P36-03 防双轨回归：sudoku/winning 死分支已物理删除，桩题不得复活', () => {
  // 注入历史死分支名称（数独/必胜），确认走 logic 兜底而非已删模板：
  // 不可解答桩题「（推理过程略）」与必胜策略模板均不得复现。
  for (const nm of ['数独游戏', '必胜策略']) {
    for (let i = 0; i < 3; i++) {
      const q = reasoningApply(nm, i);
      assert.notEqual(String(q.answer.value), '（推理过程略）', nm + ' v=' + i + ' 桩题不得复现');
      const e = String(q.answer.explanation || '');
      assert.ok(e.indexOf('依据（数独规则）') === -1, nm + ' v=' + i + ' 数独模板残留');
      assert.ok(e.indexOf('尼姆和') === -1 && e.indexOf('凑 5 策略') === -1, nm + ' v=' + i + ' 必胜模板残留');
      assert.ok(q.prompt && q.prompt.length > 0 && e.length > 10, nm + ' v=' + i + ' 兜底题完整');
    }
  }
});

test('P36-02 防线：fill/choice 分支模板不变（P34-14 口径不连带）', () => {
  const fill = codeGen.generate({
    knowledgePointIds: ['math-g3-up-u06-k001'], questionTypeId: 'fill',
    difficulty: 3, count: 1, seed: 't', semanticParams: { name: '邮政编码' }
  }, {})[0];
  assert.ok(fill.answer.explanation.indexOf('由题中的编码规则可知') === 0);
  const choice = codeGen.generate({
    knowledgePointIds: ['math-g3-up-u06-k001'], questionTypeId: 'choice',
    difficulty: 3, count: 1, seed: 't', semanticParams: { name: '邮政编码' }
  }, {})[0];
  assert.ok(choice.answer.explanation.indexOf('按数字编码规则判断') === 0);
});
