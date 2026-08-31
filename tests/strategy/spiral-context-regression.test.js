'use strict';

/**
 * M3-27 螺旋/情境回归测试
 * 验证 S1..S6（直至 maxSpiralLevel）与 contextDefault，
 * 均不得超过 KP 定义范围。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Spiral = require(path.join(ROOT, 'shared', 'strategy', 'spiral-strategy.js'));
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));

const MODES = Spiral.MODES; // S1..S6

test('S1..S6：maxSpiralLevel=6 的 KP 全档映射', () => {
  const KP_ID = 'math-g1-m1-addsub-5';
  for (let s = 1; s <= 6; s++) {
    const r = Engine.plan({ knowledgePointId: KP_ID, count: 1, spiral_level: s, max_spiral_level: 6 });
    const plan = r.plans[0];
    assert.strictEqual(plan.spiralLevel, s, 'S' + s);
    assert.strictEqual(plan.variationMode, MODES[s - 1], 'S' + s + ' variationMode');
  }
});

test('S1..S3：maxSpiralLevel=3 的 KP 全档映射', () => {
  const KP_ID = 'math-g1-m6-solid-shape';
  for (let s = 1; s <= 3; s++) {
    const r = Engine.plan({ knowledgePointId: KP_ID, count: 1, spiral_level: s, max_spiral_level: 3 });
    assert.strictEqual(r.plans[0].spiralLevel, s);
    assert.strictEqual(r.plans[0].variationMode, MODES[s - 1]);
  }
});

test('不得超过 maxSpiralLevel（请求超出 → clamp）', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m6-solid-shape', count: 1, spiral_level: 5, max_spiral_level: 3 });
  assert.strictEqual(r.plans[0].spiralLevel, 3);
  assert.strictEqual(r.plans[0].variationMode, 'presentation');
});

test('contextDefault：standard → 输出 standard 或 +1（complex），不超过 KP 定义范围', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 1, difficulty: 3 });
  const kp = require(path.join(ROOT, 'shared', 'knowledge-point.js')).get('math-g1-m0-make-ten');
  const ctxDefault = kp.context.defaults[0];
  assert.strictEqual(ctxDefault, 'standard');
  // 允许 base 或 upgrade +1，绝不超过 complex
  assert.ok(['standard', 'complex'].includes(r.plans[0].contextType), 'contextType=' + r.plans[0].contextType);
});

test('不支持 context 的题型 → none（不受 KP 默认影响）', () => {
  const r = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 1, questionType: 'calc' });
  assert.notStrictEqual(r.plans[0].contextType, undefined);
  // geometry 型 KP（en 认读）→ none
  const r2 = Engine.plan({ knowledgePointId: 'en-g3-e1-letter-recognition', count: 1 });
  assert.strictEqual(r2.plans[0].contextType, 'none');
});

test('全量回归：574 KP 的 spiralLevel 与 contextType 均不超过 KP 定义范围', () => {
  let checked = 0;
  Ontology.SUBJECTS.forEach(s => {
    (KnowledgeBank[s] || []).forEach(g => {
      (g.modules || []).forEach(m => {
        (m.knowledgePoints || []).forEach(kp => {
          const r = Engine.plan({ knowledgePointId: kp.id, count: 1 });
          const plan = r.plans[0];
          const canonical = Ontology.normalize(kp);
          const maxSpiral = (canonical.spiral && canonical.spiral.maxLevel) || 1;
          assert.ok(plan.spiralLevel >= 1 && plan.spiralLevel <= maxSpiral,
            kp.id + ' spiralLevel ' + plan.spiralLevel + ' > ' + maxSpiral);
          assert.ok(plan.spiralLevel <= 6, kp.id + ' spiralLevel 超 S6');

          const t = Registry.get(plan.questionTypeId);
          if (t && t.supports && t.supports.context === true) {
            const ctxDefault = (canonical.context && canonical.context.defaults && canonical.context.defaults[0]) || 'standard';
            const tiers = ['pure', 'simple', 'standard', 'complex'];
            const baseIdx = tiers.indexOf(ctxDefault);
            const outIdx = tiers.indexOf(plan.contextType);
            assert.ok(outIdx >= baseIdx && outIdx <= Math.min(baseIdx + 1, tiers.length - 1),
              kp.id + ' contextType ' + plan.contextType + ' 超出范围（默认 ' + ctxDefault + '）');
          } else {
            assert.strictEqual(plan.contextType, 'none', kp.id + ' 不支持 context 却输出 ' + plan.contextType);
          }
          checked++;
        });
      });
    });
  });
  assert.strictEqual(checked, 574);
});
