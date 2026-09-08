'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));

test('MATH-14：已知 KP → core 本体绑定优先（无 legacy 轨道）', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.ok(sel.generatorId.indexOf('generator:') === 0);
  assert.strictEqual(sel.source, 'priority');
  assert.strictEqual(sel.match.kp, 1);
  // 注册表无任何 legacy 记录
  const GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
  assert.strictEqual(GenRegistry.all().filter(r => r.scope === 'legacy').length, 0);
});

test('M4-R13：能力/题型匹配（calc 题型的 core 候选可达）', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const plan = { knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'calc', difficulty: 3 };
  const sel = Selector.selectGenerator(plan);
  assert.ok(sel.record);
  assert.ok(['legacy:math-make-ten', 'generator:arithmetic-addition', 'generator:arithmetic-mixed-calculation'].includes(sel.generatorId));
});

test('M4-R13：选择结果可实例化为 core Generator（能力匹配时）', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const plan = { knowledgePointId: 'x-no-plugin', questionTypeId: 'choice', difficulty: 3 };
  const sel = Selector.selectGenerator(plan);
  // 无 KP 绑定 → 按能力/题型匹配到 selection-choice
  if (sel.generatorId && sel.generatorId.indexOf('generator:') === 0) {
    const inst = Generators.get(sel.generatorId);
    assert.ok(inst);
    assert.ok(inst.capabilities.includes('choice'));
  }
});

test('MATH-14：legacy 已删除 → hybrid 与 native 均无 legacy 兜底（无能力时 UNSUPPORTED）', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  // hybrid：无 core 候选且 legacy 已不存在 → 不再 fallback，返回 unsupported
  const selHybrid = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'geometry', difficulty: 3 });
  assert.ok(!/^legacy:/.test(selHybrid.generatorId || ''));
  assert.notStrictEqual(selHybrid.source, 'fallback:legacy');
  assert.strictEqual(selHybrid.source, 'unsupported');
  assert.strictEqual(selHybrid.errorCode, 'GENERATOR_UNSUPPORTED');
  // native：同样 unsupported
  Mode.setGlobal('native');
  const selNative = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'geometry', difficulty: 3 });
  assert.strictEqual(selNative.source, 'unsupported');
  assert.strictEqual(selNative.errorCode, 'GENERATOR_UNSUPPORTED');
});

test('M4-R13：缺少 knowledgePointId → 抛错', () => {
  assert.throws(() => Selector.selectGenerator({ questionTypeId: 'calc' }), /knowledgePointId/);
});

test('M4-R13：native 模式下无 core 候选 → GENERATOR_UNSUPPORTED（Step 14，禁止回退 legacy）', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assert.strictEqual(sel.source, 'unsupported');
  assert.strictEqual(sel.errorCode, 'GENERATOR_UNSUPPORTED');
  assert.strictEqual(sel.generatorId, null);
});

test('M4-R13：hybrid 模式下 legacy 与 core 并轨按优先级选优', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.ok(sel.record);
  // hybrid 模式下可达 legacy 和 core 双轨
  assert.ok(['legacy:math-oral', 'generator:arithmetic-addition'].includes(sel.generatorId));
});

test('P0-03 Step 13：立体图形/人民币/位置 KP → arithmetic 生成器硬阻断', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // map: KP → 其原生绑定生成器（P0-04 后由 shape/money/position 生成器直接绑定）
  const nativeMap = {
    'math-g1-m6-solid-shape': 'generator:shape-recognition',
    'math-g1-m4-rmb-calc': 'generator:money-measurement',
    'math-g1-m6-position': 'generator:position-direction'
  };
  Object.keys(nativeMap).forEach((kpId) => {
    const sel = Selector.selectGenerator({ knowledgePointId: kpId, questionTypeId: 'calc', difficulty: 3 });
    // 仅共存 questionType（calc）不视为匹配 → 不得进入 arithmetic 家族（非 arithmetic 匹配合法）
    assert.notStrictEqual((sel.generatorId || '').indexOf('generator:arithmetic-'), 0, kpId + ' 不得进入 arithmetic');
    assert.strictEqual(sel.generatorId, nativeMap[kpId], kpId + ' 应由原生绑定生成器承接');
  });
  // 算术语义 KP 仍正常进入 arithmetic 家族
  const ok = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(ok.source, 'priority');
  assert.ok(ok.generatorId.indexOf('generator:arithmetic-') === 0, 'algebra KP 应经 arithmetic 家族');
});

test('P0-03 Step 12：KP native binding 优先于泛型 capability 匹配', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  // addsub-10 显式绑定 arithmetic-addition/subtraction（KP binding=最高优先）
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.match.kp, 1, '存在 KP 绑定时 kp=1');
  assert.strictEqual(sel.match.semanticOp, 1, '语义一致时 semanticOp=1');
  assert.ok(['generator:arithmetic-addition', 'generator:arithmetic-subtraction'].includes(sel.generatorId));
  // generic arithmetic-mixed-calculation（无 KP 绑定）仅在无绑定时按 capability/qt 候选
  const mixed = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'oral', difficulty: 3 });
  assert.strictEqual(mixed.match.semanticOp, 1);
});
test('P0-07 Step 32：Composite 生成器仅服务 combine=true 且 ≥2 KP 的合并计划', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // 单 KP（multi-kp 拆分后的单计划）不得路由到 Composite → 走 arithmetic 家族
  const single = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'calc', difficulty: 3 });
  assert.notStrictEqual(single.generatorId, 'generator:composite', '单 KP 不得进 Composite');
  assert.ok(single.generatorId.indexOf('generator:arithmetic-') === 0, '单 KP make-ten 应走 arithmetic 家族');
  assert.ok(single.match.kp >= 1 || single.match.semanticOp === 1, 'make-ten 应仍有合法算术匹配');
  // combine=true 且 ≥2 KP（make-ten + addsub-5）→ Composite
  const combo = Selector.selectGenerator({
    knowledgePointId: 'math-g1-m0-make-ten',
    knowledgePointIds: ['math-g1-m0-make-ten', 'math-g1-m1-addsub-5'],
    combine: true,
    questionTypeId: 'calc',
    difficulty: 3
  });
  assert.strictEqual(combo.generatorId, 'generator:composite', 'combine=true 双 KP 应进 Composite');
});

test('C3：combine 合并计划绝不回落 arithmetic 等单 KP 生成器（防误选回归）', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // 多组合并计划重复选择，均必须为 composite（修复前实测连选 20 次稳定误选 arithmetic-addition）
  const pairs = [
    ['math-g1-m1-addsub-10', 'math-g1-m0-make-ten'],
    ['math-g1-m1-addsub-5', 'math-g1-m0-make-ten-cushi']
  ];
  pairs.forEach(function (pair) {
    const sel = Selector.selectGenerator({
      knowledgePointId: pair[0],
      knowledgePointIds: pair.slice(),
      combine: true,
      questionTypeId: 'calc',
      difficulty: 3
    });
    assert.strictEqual(sel.generatorId, 'generator:composite', pair.join('+') + ' 必须由 composite 承接');
    assert.strictEqual(sel.record.supportsComposite, true);
    assert.ok(!/^generator:arithmetic-/.test(sel.generatorId), '合并计划不得回落 arithmetic 家族');
  });
});
