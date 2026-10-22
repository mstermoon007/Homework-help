'use strict';

/**
 * tests/generation/p42-2a-teaching-goal-match.test.js — P42-2A
 *
 * 背景（P42-DEFECT-REGISTER P42-019 / P42-020~022，教学目标匹配维度）：
 *
 * P42-019：concept-meaning.js 顺序分支 apply 模板只问「后一个数是多少」，
 *   却复用 stem 的双值答案「(cur−1) 和 (cur+1)」——题答不一致；且解析列式
 *   取自题面内嵌的后向参考式「cur − 1 = cur−1」，与所问的前向结论矛盾。
 *   修复：apply 收敛为单一结论 applyAnswer = String(cur+1)（P32-AS-11 分型
 *   答案机制），情境句按 P32-AS-16 口径删完整证明、内嵌前向 scaffold
 *   「（cur + 1 = ？）」使解析列式随题问切到前向算式；item.answer 为 stem
 *   双值变体时不再作「概念结论」附注（conclusion:false）。
 *
 * P42-020~022：money.js makeMeasurementConversionQuestion 从度量族全表
 *   随机抽单位，KP「认识厘米和米」产出「毫米↔千米」超纲换算。修复：
 *   getMoneyMeta 由 KP 名称机械认领显式单位（长单位名优先认领，防
 *   「千米」吞出「米」），认领 ≥2 个时收窄换算双方 ⊆ KP 显式范围；
 *   名称无 ≥2 单位信号的 KP 行为零变化。
 *
 * 冻结不变量：
 *   1. P42-019：顺序 KP 全部 apply 样本——问句「后一个数是多少」时答案必为
 *      单一数值 cur+1；解析列式为前向算式且每个数值等式成立；无双值答案
 *      附注污染。calc/fill/choice 的双值语义不变（正向对照）。
 *   2. P42-020~022：KP「认识厘米和米」全部换算样本——题面与解析只出现
 *      厘米/米，不出现毫米/千米/分米。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

async function make(opts) {
  const s = new PracticeSession(Object.assign({ subject: 'math', count: 1 }, opts));
  await s.start();
  return s.semanticQuestions || [];
}

// generator 直调批量骨架（P42-1B 同款）：attachToPlan → Selector → generate
function genRow(kp, qt, d, v, generatorRe) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1,
    seed: 'p42-2a|' + kp + '|' + qt + '|d' + d + '|v' + v
  });
  const sel = Selector.selectGenerator({ knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1 });
  if (generatorRe) assert.match(sel.generatorId, generatorRe, kp + '|' + qt + ' 路由');
  const gen = Generators.get(sel.generatorId);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, kp + '|' + qt + '|d' + d + '|v' + v + ' 产出 1 题');
  return qs[0];
}

/* ---------------- Part 1 · P42-019：顺序 apply 问「后一个」答单一前向结论 ---------------- */

test('P42-019 登记种子 p42|math-g1-down-u03-k005|apply|d3：答案为后一个数 77，解析列式前向且等式为真', async () => {
  const qs = await make({
    grade: 1, difficulty: 3, knowledgePointId: 'math-g1-down-u03-k005',
    questionType: 'apply', seed: 'p42|math-g1-down-u03-k005|apply|d3'
  });
  assert.equal(qs.length, 1);
  const q = qs[0];
  const prompt = q.prompt || (q.content && q.content.stem) || '';
  const expl = (q.answer && q.answer.explanation) || '';
  const m = /数到 (\d+)/.exec(prompt);
  assert.ok(m, '题面应含计数情境数字：' + prompt);
  const cur = Number(m[1]);

  // 题答一致：问「后一个数是多少」→ 答案必为单一数值 cur+1
  assert.equal(q.answer.value, String(cur + 1),
    'apply 答案必须是后一个数 ' + (cur + 1) + '，实际：' + q.answer.value);
  assert.doesNotMatch(q.answer.value, / 和 /, 'apply 答案不得复用 stem 双值形态');

  // 解析一致性：列式随题问切到前向算式，且等式为真
  assert.ok(expl.indexOf(cur + ' + 1 = ' + (cur + 1)) !== -1,
    '解析应含前向等式 ' + cur + ' + 1 = ' + (cur + 1) + '，实际：' + expl);
  assert.doesNotMatch(expl, / 和 /, '解析不得附注 stem 双值答案（概念结论污染）');
  assert.doesNotMatch(expl, /− 1 = /, '解析列式不得仍为后向算式（与所问矛盾）');
});

test('P42-019 顺序 KP apply 全 seed 面（d1..4 × v0..3）：问后一个答单一 cur+1，等式为真', () => {
  const kp = 'math-g1-down-u03-k005';
  let checked = 0;
  for (let d = 1; d <= 4; d++) {
    for (let v = 0; v < 4; v++) {
      const q = genRow(kp, 'apply', d, v, /concept-meaning/);
      const prompt = q.prompt || (q.content && q.content.stem) || '';
      const expl = (q.answer && q.answer.explanation) || '';
      const m = /数到 (\d+)/.exec(prompt);
      assert.ok(m, 'd' + d + '|v' + v + ' 题面应含计数情境数字：' + prompt);
      const cur = Number(m[1]);
      assert.equal(q.answer.value, String(cur + 1),
        'd' + d + '|v' + v + ' apply 答案必须是后一个数，题面：' + prompt + '，答案：' + q.answer.value);
      assert.ok(expl.indexOf(cur + ' + 1 = ' + (cur + 1)) !== -1,
        'd' + d + '|v' + v + ' 解析前向等式缺失：' + expl);
      assert.doesNotMatch(q.answer.value + expl, / 和 /, 'd' + d + '|v' + v + ' 双值污染：' + expl);
      assert.doesNotMatch(expl, /− 1 = /, 'd' + d + '|v' + v + ' 解析列式仍为后向算式：' + expl);
      checked++;
    }
  }
  assert.equal(checked, 16);
});

test('P42-019 正向对照：同 KP calc/fill 保持 stem 双值语义不变', async () => {
  for (const qt of ['calc', 'fill']) {
    const qs = await make({
      grade: 1, difficulty: 3, knowledgePointId: 'math-g1-down-u03-k005',
      questionType: qt, seed: 'p42|math-g1-down-u03-k005|' + qt + '|d3'
    });
    assert.equal(qs.length, 1);
    const q = qs[0];
    const prompt = q.prompt || (q.content && q.content.stem) || '';
    assert.match(q.answer.value, / 和 /, qt + ' 答案应保持双值形态：' + q.answer.value);
    // calc 题面为 stem（含「相邻的两个数」），fill 题面为 scaffold（参考：N − 1 = ____）
    const m = /与 (\d+) 相邻/.exec(prompt) || /参考：(\d+) − 1/.exec(prompt);
    assert.ok(m, '题面应含基准数：' + prompt);
    const cur = Number(m[1]);
    const pair = q.answer.value.split(' 和 ').map(Number).sort(function (a, b) { return a - b; });
    assert.deepEqual(pair, [cur - 1, cur + 1], qt + ' 双值答案应为 cur−1 与 cur+1');
  }
});

/* ---------------- Part 2 · P42-020~022：换算双方 ⊆ KP 显式单位集合 ---------------- */

const KP_LEN = 'math-g2-up-u05-k001'; // 认识厘米和米
const OUT_OF_SCOPE = /毫米|千米|分米/;

test('P42-020~022 登记种子（choice/fill/judge d3）：题面与解析不出现超纲单位', async () => {
  for (const qt of ['choice', 'fill', 'judge']) {
    const qs = await make({
      grade: 2, difficulty: 3, knowledgePointId: KP_LEN,
      questionType: qt, seed: 'p42|' + KP_LEN + '|' + qt + '|d3'
    });
    assert.equal(qs.length, 1);
    const q = qs[0];
    const prompt = q.prompt || (q.content && q.content.stem) || '';
    const expl = (q.answer && q.answer.explanation) || '';
    assert.doesNotMatch(prompt + expl, OUT_OF_SCOPE,
      qt + ' 超 KP 显式范围（认识厘米和米）：' + prompt + ' | ' + expl);
    assert.match(prompt, /厘米|米/, qt + ' 换算题应落在 KP 显式单位内：' + prompt);
  }
});

test('P42-020~022 换算面全 seed 面（4 题型 × d1..4 × v0..3）：全部样本单位 ⊆ {厘米, 米}', () => {
  let checked = 0;
  for (const qt of ['choice', 'fill', 'judge', 'calc']) {
    for (let d = 1; d <= 4; d++) {
      for (let v = 0; v < 4; v++) {
        const q = genRow(KP_LEN, qt, d, v, /money/);
        const prompt = q.prompt || (q.content && q.content.stem) || '';
        const expl = (q.answer && q.answer.explanation) || '';
        assert.doesNotMatch(prompt + expl, OUT_OF_SCOPE,
          qt + '|d' + d + '|v' + v + ' 超纲单位：' + prompt + ' | ' + expl);
        checked++;
      }
    }
  }
  assert.equal(checked, 64);
});
