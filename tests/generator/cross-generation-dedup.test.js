/**
 * tests/generator/cross-generation-dedup.test.js — C2 跨轮/跨代去重收口
 *
 * 覆盖：
 *   1. 同批 20 题 questionFingerprint 唯一（批内去重）
 *   2. 跨 generation 指纹交集 0 + generationId 铸造与 previousGenerationId 链
 *   3. 连 10 套（previousSeenKeys 滚动）代际 0 重复、failedPlans=0、每套 20 题
 *   4. combine 合并出题跨代 0 重复
 *   5. 指纹族标签剔除：data.operation='mixed' 时 10−6 与 10＋6 不得并为同一指纹
 *   6. 语义空间饱和（生成器只产 1 道题）→ 返回 GENERATION_SPACE_EXHAUSTED
 *   7. seenKeys 事务化：失败批次被丢弃题目的指纹必须回滚，不得污染跨轮去重集
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'engine', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

const GE = require(path.join(ROOT, 'shared', 'engine', 'generation-engine.js'));
const Dup = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));
const Retry = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));

const KP = 'math-g1-m1-addsub-10';

function fpsOf(questions) {
  return new Set((questions || []).map(function (q) {
    return q.questionFingerprint || Dup.buildQuestionFingerprint(q);
  }));
}
function intersectionCount(a, b) {
  var n = 0;
  b.forEach(function (k) { if (a.has(k)) n++; });
  return n;
}

test('C2-1 同批 20 题 questionFingerprint 全唯一（批内去重）', async () => {
  const g = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP, count: 20, difficulty: 4 });
  assert.strictEqual(g.questions.length, 20);
  assert.strictEqual((g.failedPlans || []).length, 0);
  const fps = fpsOf(g.questions);
  assert.strictEqual(fps.size, 20, '批内 20 题指纹必须两两不同');
  g.questions.forEach(function (q) { assert.ok(q.questionFingerprint, '每题必须携带 questionFingerprint'); });
});

test('C2-2 跨 generation：指纹交集 0，generationId 铸造且 previousGenerationId 成链', async () => {
  const g1 = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP, count: 20, difficulty: 4 });
  const g2 = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP, count: 20, difficulty: 4 }, { previousSeenKeys: fpsOf(g1.questions), previousGenerationId: g1.generationId });
  assert.ok(g1.generationId, '第一代必须铸造 generationId');
  assert.ok(g2.generationId, '第二代必须铸造 generationId');
  assert.notStrictEqual(g1.generationId, g2.generationId, '两代 generationId 必须不同');
  assert.strictEqual(g1.previousGenerationId, null);
  assert.strictEqual(g2.previousGenerationId, g1.generationId, '第二代 previousGenerationId 必须指向第一代');
  assert.strictEqual(intersectionCount(fpsOf(g1.questions), fpsOf(g2.questions)), 0, '两代题目指纹交集必须为 0');
});

test('C2-3 连 10 套（上一代指纹滚动注入）：代际 0 重复、0 failedPlans、每套 20 题', async () => {
  let prev = null;
  for (let i = 0; i < 10; i++) {
    const g = await GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP, count: 20, difficulty: 4 }, prev ? { previousSeenKeys: prev } : {});
    assert.strictEqual(g.questions.length, 20, '第 ' + (i + 1) + ' 套必须满 20 题');
    assert.strictEqual((g.failedPlans || []).length, 0, '第 ' + (i + 1) + ' 套不得有 failedPlans');
    const cur = fpsOf(g.questions);
    assert.strictEqual(cur.size, 20, '第 ' + (i + 1) + ' 套批内指纹必须唯一');
    if (prev) assert.strictEqual(intersectionCount(prev, cur), 0, '第 ' + i + ' 套与第 ' + (i + 1) + ' 套不得有重复题');
    prev = cur;
  }
});

test('C2-4 combine 合并出题：跨代指纹交集 0', async () => {
  const req = { subject: 'math', grade: 1, mode: 'multi-kp', knowledgePointIds: [KP, 'math-g1-m0-make-ten'], questionTypes: ['calc'], combine: true, count: 20, difficulty: 3 };
  const g1 = await GE.generate(req);
  const g2 = await GE.generate(req, { previousSeenKeys: fpsOf(g1.questions) });
  assert.strictEqual(g1.questions.length, 20);
  assert.strictEqual(g2.questions.length, 20);
  assert.strictEqual(intersectionCount(fpsOf(g1.questions), fpsOf(g2.questions)), 0, 'combine 两代题目指纹交集必须为 0');
});

test('C2-5 指纹族标签剔除：data.operation="mixed" 时 10−6 与 10＋6 不得同指纹', () => {
  const base = { knowledgePoint: 'kp-x', questionType: 'calc', data: { operation: 'mixed', operands: [10, 6] } };
  const qSub = Object.assign({}, base, { prompt: '10－6＝？' });
  const qAdd = Object.assign({}, base, { prompt: '10＋6＝？' });
  const fpSub = Dup.buildQuestionFingerprint(qSub);
  const fpAdd = Dup.buildQuestionFingerprint(qAdd);
  assert.notStrictEqual(fpSub, fpAdd, 'mixed 族标签必须剔除，10−6 与 10＋6 指纹必须不同');
  // 语义等价（同式异写/交换律）仍同指纹
  const qSub2 = Object.assign({}, base, { prompt: '10−6=?' });
  assert.strictEqual(Dup.buildQuestionFingerprint(qSub2), fpSub, '同一算式全角/半角异写必须同指纹');
});

test('C2-6 语义空间饱和（生成器仅能产 1 道题）→ GENERATION_SPACE_EXHAUSTED', async () => {
  const built = await GE.build({ mode: 'single-kp', knowledgePointIds: ['math-g4-c9-c9-integrated'], grade: 4, count: 20, difficulty: 4 });
  const plan = built.plans[0];
  const sel = Selector.selectGenerator(plan);
  const gen = Selector.instantiate(sel, sel.plugin);
  const seen = new Set();
  const out = await Retry.generateWithRetry(function (p) { return gen.generate(p); }, plan, {
    generatorId: sel.record.id,
    validatorContext: { generatorId: sel.record.id, seenKeys: seen }
  });
  assert.strictEqual(out.success, false);
  assert.strictEqual(out.error, Retry.GENERATION_SPACE_EXHAUSTED);
  // 终轮净化：输出不得含 null 空位
  assert.ok(out.questions.every(function (q) { return !!q; }), '失败输出必须净化 null 空位');
});

test('C2-7 seenKeys 事务化：失败轮丢弃题指纹回滚，仅保留成功题指纹', async () => {
  const built = await GE.build({ mode: 'single-kp', knowledgePointIds: ['math-g4-c9-c9-integrated'], grade: 4, count: 20, difficulty: 4 });
  const plan = built.plans[0];
  const sel = Selector.selectGenerator(plan);
  const gen = Selector.instantiate(sel, sel.plugin);
  const seen = new Set();
  seen.add('PRESEEDED-DUMMY-KEY');
  const out = await Retry.generateWithRetry(function (p) { return gen.generate(p); }, plan, {
    generatorId: sel.record.id,
    validatorContext: { generatorId: sel.record.id, seenKeys: seen }
  });
  assert.strictEqual(out.success, false);
  // 预播种键保留；多轮失败中 19 道被丢弃题的指纹不得残留（回滚），
  // 仅局部重试中被保留的题（1 道）指纹允许入集。
  assert.ok(seen.has('PRESEEDED-DUMMY-KEY'), '跨代预播种指纹不得丢失');
  const keptFps = out.questions.map(function (q) { return q.questionFingerprint; }).filter(Boolean);
  keptFps.forEach(function (fp) { assert.ok(seen.has(fp), '保留题指纹必须在去重集中'); });
  assert.strictEqual(seen.size, 1 + keptFps.length, '去重集不得被失败批次污染（仅预播种 + 保留题）');
});
