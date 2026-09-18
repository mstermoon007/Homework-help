'use strict';

/**
 * tests/shape/pol-kbl-shape.test.js — POL–KBL Shape Contract 测试
 *
 * 契约目标：相同 KBL canonical 输入 → 稳定的 Practice Context 形状（三视图）。
 *   - 所有键恒存在；值不出现 undefined（缺失统一 null / 显式默认）
 *   - 转换只发生在 KnowledgeContext（knowledgeId→id / module→moduleId / gN→N）
 *   - 缺省字段的默认值稳定且可断言
 *   - 视图为只读投影，不修改 canonical
 *
 * 运行：node --test tests/shape/*.test.js（npm run test:pol-kbl-shape）
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.join(__dirname, '..', '..');
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));

const GRADES = [1, 2, 3, 4, 5, 6];

function allKps() {
  const out = [];
  GRADES.forEach((g) => {
    KC.kpsForGrade('math', g).forEach((kp) => out.push({ grade: g, kp }));
  });
  return out;
}

function noUndefined(obj) {
  return Object.keys(obj).every((k) => obj[k] !== undefined);
}

test('view 契约：三视图键恒存在且无 undefined', () => {
  const kp = KC.kpsForGrade('math', 4)[0];
  const view = KC.strategyView(kp.knowledgeId);
  const adapt = KC.adaptKp(kp);
  const ui = KC.uiKp(kp);
  assert.ok(view && adapt && ui);
  assert.ok(noUndefined(view), 'strategyView 不应出现 undefined');
  assert.ok(noUndefined(adapt), 'adaptKp 不应出现 undefined');
  assert.ok(noUndefined(ui), 'uiKp 不应出现 undefined');
});

test('转换唯一性：三视图 id 对齐 canonical，grade 为数字', () => {
  allKps().forEach(({ grade, kp }) => {
    const view = KC.strategyView(kp.knowledgeId);
    const adapt = KC.adaptKp(kp);
    const ui = KC.uiKp(kp);
    assert.strictEqual(view.id, kp.knowledgeId, 'strategyView.id = knowledgeId');
    assert.strictEqual(adapt.id, kp.knowledgeId, 'adaptKp.id = knowledgeId');
    assert.strictEqual(adapt.knowledgeId, kp.knowledgeId);
    assert.strictEqual(ui.id, kp.knowledgeId, 'uiKp.id = knowledgeId');
    assert.strictEqual(view.grade, grade, 'strategyView.grade = N');
    assert.strictEqual(adapt.grade, grade, 'adaptKp.grade = N');
    assert.strictEqual(ui.grade, grade, 'uiKp.grade = N');
    assert.strictEqual(adapt.moduleId, kp.module, 'module → moduleId');
    assert.strictEqual(KC.toN(KC.toG(grade)), grade, 'gN ↔ N 往返');
  });
});

test('顶层 frozen 别名与嵌套字段一致（generator-selector 消费）', () => {
  allKps().forEach(({ kp }) => {
    const view = KC.strategyView(kp.knowledgeId);
    assert.strictEqual(view.pluginId, view.source.pluginId, 'pluginId 顶层 = source.pluginId');
    assert.strictEqual(view.graphicType, view.presentation.graphicType, 'graphicType 顶层 = presentation.graphicType');
    assert.deepStrictEqual(view.operations, view.knowledge.operations, 'operations 顶层 = knowledge.operations');
  });
});

test('缺 optional 字段：seedDifficulty/cognitiveLevel 缺失 → null/0（不猜测）', () => {
  const synth = JSON.parse(JSON.stringify(allKps()[0].kp));
  delete synth.difficultyAnnotation;
  const view = KC.strategyViewFor(synth);
  assert.strictEqual(view.legacy.difficulty, null);
  assert.strictEqual(view.cognition.raw, null);
  assert.strictEqual(view.cognition.level, 0, '缺失 → 0（不得猜测为中间值）');
});

test('缺 optional 字段：type 缺失 → source.legacyType / uiKp.type 为 null', () => {
  const synth = JSON.parse(JSON.stringify(allKps()[0].kp));
  delete synth.type;
  const view = KC.strategyViewFor(synth);
  const ui = KC.uiKp(synth);
  assert.strictEqual(view.source.legacyType, null);
  assert.strictEqual(ui.type, null);
});

test('缺 optional 字段：maxSteps 缺失 → structure.maxSteps = 1', () => {
  const synth = JSON.parse(JSON.stringify(allKps()[0].kp));
  synth.generation = synth.generation || {};
  synth.generation.maxSteps = null;
  const view = KC.strategyViewFor(synth);
  assert.strictEqual(view.structure.maxSteps, 1);
  assert.strictEqual(view.structure.allowBracket, false);
  assert.strictEqual(view.structure.allowMultDiv, false);
});

test('缺 optional 字段：numberRange 缺失 → numeric.range = {min:null,max:null}', () => {
  const synth = JSON.parse(JSON.stringify(allKps()[0].kp));
  synth.generation = synth.generation || {};
  delete synth.generation.numberRange;
  const view = KC.strategyViewFor(synth);
  assert.deepStrictEqual(view.numeric.range, { min: null, max: null });
});

test('空输入 / 最小输入：adaptKp 与 uiKp 返回 null 或全 null 值（不抛错）', () => {
  assert.strictEqual(KC.adaptKp(null), null);
  assert.strictEqual(KC.uiKp(null), null);
  const minimal = { knowledgeId: 'math-g1-up-u01-k001' };
  const adapt = KC.adaptKp(minimal);
  const ui = KC.uiKp(minimal);
  assert.ok(noUndefined(adapt));
  assert.ok(noUndefined(ui));
  assert.strictEqual(adapt.id, minimal.knowledgeId);
  assert.strictEqual(adapt.grade, null, '缺失 grade → null');
  assert.deepStrictEqual(ui.applicable_question_types, []);
  assert.strictEqual(ui.difficulty, null);
});

test('context 契约：defaults / allowPure / allowContextual 稳定', () => {
  allKps().forEach(({ kp }) => {
    const view = KC.strategyView(kp.knowledgeId);
    assert.ok(Array.isArray(view.context.defaults));
    assert.strictEqual(typeof view.context.allowPure, 'boolean');
    assert.strictEqual(typeof view.context.allowContextual, 'boolean');
    const expected = view.context.defaults.indexOf('pure') !== -1;
    assert.strictEqual(view.context.allowContextual, !expected);
  });
});

test('spiral 边界默认固定为 {level:1,maxLevel:1}（P0 显式契约）', () => {
  allKps().forEach(({ kp }) => {
    const view = KC.strategyView(kp.knowledgeId);
    assert.deepStrictEqual(view.spiral, { level: 1, maxLevel: 1 });
  });
});

test('不同 grade / 边界 KP：poolKpIds 与 kpsForGrade 稳定', () => {
  GRADES.forEach((g) => {
    const kps = KC.kpsForGrade('math', g);
    assert.ok(kps.length > 0, 'g' + g + ' 非空');
    assert.ok(kps.every((kp) => kp.grade === 'g' + g));
    const pool = KC.poolKpIds({ subject: 'math', grade: g });
    assert.strictEqual(pool.length, kps.length);
    assert.strictEqual(pool[0], kps[0].knowledgeId);
    assert.strictEqual(pool[pool.length - 1], kps[kps.length - 1].knowledgeId);
  });
});

test('无 unit / 非法 unit：kpsForUnit 与 poolContext 返回空', () => {
  assert.deepStrictEqual(KC.kpsForUnit('math-g1-up-u99'), []);
  assert.deepStrictEqual(KC.poolContext({ subject: 'math', grade: 1, unit: 'NO-SUCH-UNIT' }), []);
});

test('多 KP / unit 过滤：poolContext 条目 moduleId/unitId 命中过滤值', () => {
  const kps = KC.kpsForGrade('math', 2);
  const moduleId = kps[0].module;
  const entries = KC.poolContext({ subject: 'math', grade: 2, unit: moduleId });
  assert.ok(entries.length > 0);
  assert.ok(entries.every((e) => e.moduleId === moduleId || e.unitId === moduleId));
  const unitId = kps[0].unitId;
  const byUnit = KC.poolContext({ subject: 'math', grade: 2, unit: unitId });
  assert.ok(byUnit.length > 0);
  assert.ok(byUnit.every((e) => e.moduleId === unitId || e.unitId === unitId));
});

test('稳定性：同输入两次视图深等价（缓存）且 canonical 未被修改', () => {
  const kp = KC.kpsForGrade('math', 3)[0];
  const before = JSON.stringify(kp);
  const v1 = KC.strategyView(kp.knowledgeId);
  const v2 = KC.strategyView(kp.knowledgeId);
  assert.strictEqual(v1, v2, '缓存命中返回同一视图对象');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(v1)), JSON.parse(JSON.stringify(v2)));
  assert.strictEqual(JSON.stringify(kp), before, 'canonical 不得被视图修改');
  assert.strictEqual(KC.adaptKp(kp).id, kp.knowledgeId);
  assert.strictEqual(JSON.stringify(kp), before, 'adaptKp 不得修改 canonical');
});
