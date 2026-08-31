/**
 * tests/legacy/plugin-adapter.test.js — M7-R16/R18 旧插件唯一桥接
 *
 * 验证：
 *   - shared/legacy/plugin-adapter.js 是唯一 Loader/Bridge（loadPlugin/setPlugin/generateByPluginId/renderSet/hydrateLegacyGenerator）；
 *   - generateByPluginId 统一 Promise 包装 legacy plugin.generate；
 *   - GenerationEngine.generateLegacy / renderLegacySet 经桥到达旧插件（UI 不再直连）；
 *   - renderLegacySet 在插件无 render 时返回 null（上层走通用降级）。
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Adapter = require(path.join(ROOT, 'shared', 'legacy', 'plugin-adapter.js'));
const GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));

function fakePlugin() {
  return {
    id: '__m7fake',
    subject: 'math',
    grade: 1,
    generate(opts) {
      return { questions: [{ q: '3+4=?', answer: 7, kind: 'calc' }], meta: { plugin: '__m7fake' } };
    },
    render(set) {
      return '<div class="ps-questions">' + (set.questions.length) + '题</div>';
    }
  };
}

test('R18-1 generateByPluginId 统一 Promise 包装 legacy generate', async () => {
  Adapter.setPlugin('__m7fake', fakePlugin());
  const out = await Adapter.generateByPluginId('__m7fake', { count: 3 });
  assert.ok(out && Array.isArray(out.questions));
  assert.strictEqual(out.questions.length, 1);
});

test('R18-2 未装载插件的统一拒绝', async () => {
  await assert.rejects(() => Adapter.generateByPluginId('__m7-nonexistent', {}), /不可用|未装载/);
});

test('R16-1 GenerationEngine.generateLegacy 经桥生成（不直接 plugin.generate）', async () => {
  Adapter.setPlugin('__m7fake', fakePlugin());
  const g = await GE.generateLegacy({ pluginId: '__m7fake', count: 5 });
  assert.strictEqual(g.source, 'legacy');
  assert.ok(g.set && Array.isArray(g.set.questions));
  assert.strictEqual(g.set.questions[0].answer, 7);
});

test('R16-2 generateLegacy 缺 pluginId 拒绝', async () => {
  await assert.rejects(() => GE.generateLegacy({ count: 5 }), /pluginId/);
});

test('R16-3 renderLegacySet 经桥渲染；无 render 插件返回 null', () => {
  Adapter.setPlugin('__m7fake', fakePlugin());
  const html = GE.renderLegacySet({ questions: [1, 2] }, '__m7fake');
  assert.ok(typeof html === 'string' && html.indexOf('2题') !== -1);
  Adapter.setPlugin('__m7norender', { id: '__m7norender', generate: () => ({ questions: [] }) });
  assert.strictEqual(GE.renderLegacySet({ questions: [] }, '__m7norender'), null);
});

test('R18-3 hydrateLegacyGenerator 用已装载插件构造 GeneratorContract', () => {
  const gen = Adapter.hydrateLegacyGenerator(
    { record: { pluginId: '__m7fake', capabilities: ['calc'], knowledgePoints: [] } },
    fakePlugin()
  );
  assert.ok(gen && typeof gen.generate === 'function');
  const res = gen.generate({ questionTypeId: 'calc', knowledgePointId: 'x', difficulty: 1, count: 2 }, {});
  return Promise.resolve(res).then(sq => {
    assert.ok(Array.isArray(sq) && sq.length === 1);
    assert.strictEqual(sq[0].question.prompt, '3+4=?');
  });
});

// ==== R34 反向适配器回归 ====
// 曾缺陷：toLegacyQuestion 在 choice 题的 distractors 不含正确答案、
// 需按其 seed 插入正确选项时引用未定义的裸 `context.seed`
// → ReferenceError: context is not defined（legacyOutput 渲染路径崩溃）。
const LegacyQAdapter = require(path.join(ROOT, 'shared', 'question', 'legacy-question-adapter.js'));

test('R34-1 toLegacyQuestion choice+distractors 按 seed 插入正确项（不再崩溃）', () => {
  const sq = {
    id: 'q-c1', prompt: '选出正确答案', answerMode: 'choice',
    answer: { value: '苹果' },
    distractors: [{ value: '香蕉' }, { value: '梨' }, { value: '橙' }],
    seed: 'seed-abc'
  };
  // 关键：不抛异常（曾在 context 未定义时报错）
  const legacyQ = LegacyQAdapter.toLegacyQuestion(sq);
  assert.strictEqual(legacyQ.inputType, 'choice');
  assert.ok(Array.isArray(legacyQ.options));
  // 正确答案被插入（distractors 3 项 + 正确 1 项 = 4 项）
  assert.strictEqual(legacyQ.options.length, 4);
  assert.ok(legacyQ.options.indexOf('苹果') !== -1);
  // 断定性（同一 seed 位置稳定）
  const again = LegacyQAdapter.toLegacyQuestion(sq);
  assert.deepStrictEqual(again.options, legacyQ.options);
});

test('R34-2 toLegacyQuestion 缺 seed 回落 id（不崩溃）', () => {
  const sq = { id: 'q-c2', prompt: 'p', answerMode: 'choice', answer: { value: 'A' }, distractors: [{ value: 'B' }, { value: 'C' }] };
  const legacyQ = LegacyQAdapter.toLegacyQuestion(sq);
  assert.strictEqual(legacyQ.options.length, 3);
});

test('R34-3 toLegacyQuestion 保留 svg / graphic.rawSvg → svg 字段', () => {
  const sq = { id: 'q-3', prompt: '看图', answerMode: 'input', answer: { value: 1 }, graphic: { type: 'custom', params: { rawSvg: '<svg/>' } } };
  const legacyQ = LegacyQAdapter.toLegacyQuestion(sq);
  assert.strictEqual(legacyQ.svg, '<svg/>');
});