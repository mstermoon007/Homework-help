'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Mode = require(path.join(ROOT, 'shared', 'generator', 'generator-mode.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));

function planFor(kpId) {
  return Engine.plan({ knowledgePointId: kpId, count: 2, difficulty: 3 }).plans[0];
}

test('M4-R14：legacy 模式 → 只看 old track（即使 core 可匹配 calc）', () => {
  Mode.clearAll();
  Mode.setGlobal('legacy');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.generatorId, 'legacy:math-oral');
  assert.strictEqual(sel.mode, 'legacy');
  assert.strictEqual(sel.record.scope, 'legacy');
});

test('M4-R14：native 模式 → 核心 Generator 轨道胜出', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // math-oral 的 KP：core arithmetic 按能力匹配 → native 胜出
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.record.scope, 'core');
  assert.strictEqual(sel.mode, 'native');
});

test('M4-R14：native 无候选 → fallback 旧插件（保留可生成性）', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  // make-ten 由 core 不支持其语义 → core 按能力可匹配 calc（arithmetic），
  // 但若用无 calc 能力的题型（如 geometry）则 core 无候选 → fallback legacy
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'review', difficulty: 3 });
  assert.strictEqual(sel.source, 'fallback:legacy');
  assert.strictEqual(sel.generatorId, 'legacy:math-make-ten');
});

test('M4-R14：hybrid 模式 → 双轨并轨，legacy KP 绑定优先（知识点匹配①）', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  const plan = planFor('math-g1-m0-make-ten');
  const sel = Selector.selectGenerator(plan);
  assert.strictEqual(sel.generatorId, 'legacy:math-make-ten');
  assert.strictEqual(sel.match.kp, 1);
});

test('M4-R14：单插件覆盖切换 make-ten → legacy（其他 KP 不受影响）', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  Mode.override('plugin', 'math-make-ten', 'legacy');
  // make-ten 的 KP → plugin 覆盖 legacy
  const selTen = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(selTen.generatorId, 'legacy:math-make-ten');
  // 其他插件 KP → 全局 native
  const selOral = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(selOral.record.scope, 'core');
});

test('M4-R14：单知识点切换 → native（其他知识点仍走旧轨道）', () => {
  Mode.clearAll();
  Mode.setGlobal('legacy');
  Mode.override('knowledgePoint', 'math-g1-m1-addsub-5', 'native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.record.scope, 'core');
  const sel2 = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-10', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel2.scope !== undefined ? sel2.record.scope : sel2.record.scope, 'legacy');
});

test('M4-R14：单题型切换 → calc 全走 native，judge 仍走 legacy', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  Mode.override('questionType', 'calc', 'native');
  const selCalc = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(selCalc.record.scope, 'core');
  const selJudge = Selector.selectGenerator({ knowledgePointId: 'math-g1-m0-make-ten-cushi', questionTypeId: 'judge', difficulty: 3 });
  assert.strictEqual(selJudge.record.scope, 'legacy');
});

test('M4-R14：单科目切换 → chinese 全 native，math 保持 hybrid', () => {
  Mode.clearAll();
  Mode.setGlobal('hybrid');
  Mode.override('subject', 'chinese', 'native');
  // cn KP（chinese-pinyin）→ subject 覆盖 native；chinese 无 core 记录 → fallback legacy，mode 记 native
  const selCn = Selector.selectGenerator({ knowledgePointId: 'cn-g1-n1-pinyin-basic', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(selCn.mode, 'native');
  const selMath = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(selMath.mode, 'hybrid');
});

test('M4-R14：selectGenerator 返回 mode 字段，instantiate 解析 core 实例', () => {
  Mode.clearAll();
  Mode.setGlobal('native');
  const sel = Selector.selectGenerator({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3 });
  assert.strictEqual(sel.mode, 'native');
  const inst = Selector.instantiate(sel);
  assert.ok(inst && inst.generate);
  const qs = inst.generate({ knowledgePointId: 'math-g1-m1-addsub-5', questionTypeId: 'calc', difficulty: 3, count: 2 }, { seed: 'm4-r14' });
  assert.strictEqual(qs.length, 2);
});