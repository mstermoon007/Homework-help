'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Adapter = require(path.join(ROOT, 'shared', 'strategy', 'legacy-adapter.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));

const PLAN = () => Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 3, difficulty: 4 }).plans[0];

test('QuestionPlan -> 旧 Plugin options 完整映射', () => {
  const opts = Adapter.adaptPlanToLegacyOptions(PLAN(), { grade: 1, count: 3 });
  assert.strictEqual(opts.difficulty, 4);
  assert.strictEqual(typeof opts.difficultyParams, 'object');
  assert.strictEqual(opts.difficultyParams.level, 4);
  assert.strictEqual(typeof opts.difficultyParams.scale, 'number');
  assert.strictEqual(typeof opts.difficultyParams.steps, 'number');
  assert.strictEqual(typeof opts.difficultyParams.allowBracket, 'boolean');
  assert.strictEqual(typeof opts.difficultyParams.allowMultDiv, 'boolean');
  assert.strictEqual(opts.maxNum, 20);
  assert.strictEqual(opts.questionType, 'calc');
  assert.ok(['recognize', 'understand', 'apply'].includes(opts.cognitiveLevel));
  assert.strictEqual(opts.spiralLevel, 1);
  assert.strictEqual(typeof opts.contextType, 'string');
  assert.strictEqual(opts.grade, 1);
  assert.strictEqual(opts.count, 3);
});

test('subtype 透传', () => {
  const plan = Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: 1, subtype: 'cushi' }).plans[0];
  const opts = Adapter.adaptPlanToLegacyOptions(plan, {});
  assert.strictEqual(opts.subtype, 'cushi');
});

test('UI chip 设置与 settingNums 透传（不修改插件逻辑，仅映射）', () => {
  const opts = Adapter.adaptPlanToLegacyOptions(PLAN(), {
    type: 'cushi',
    settings: { level: 2, type: 'ignored' },
    settingNums: { maxNum: 15 }
  });
  assert.strictEqual(opts.type, 'cushi');
  assert.strictEqual(opts.level, 2);
  assert.strictEqual(opts.maxNum, 15);
  assert.strictEqual(opts.type, 'cushi');
});

test('缺少 difficulty -> 抛出错误', () => {
  assert.throws(() => {
    Adapter.adaptPlanToLegacyOptions({ questionTypeId: 'calc' }, {});
  }, /缺少 difficulty/);
});

test('缺少 questionTypeId -> 抛出错误', () => {
  assert.throws(() => {
    Adapter.adaptPlanToLegacyOptions({ difficulty: 3 }, {});
  }, /缺少 questionTypeId/);
});
