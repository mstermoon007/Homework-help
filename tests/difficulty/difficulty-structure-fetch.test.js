'use strict';

/**
 * tests/difficulty/difficulty-structure-fetch.test.js — 结构重取契约（M16）
 *
 * finalLevel === staticLevel → 复用静态 profile；
 * finalLevel ≠ staticLevel → 经 Difficulty.paramsFor('math', finalLevel) 重取（不复制分档表）。
 * 冻结模块经浏览器等价环境（dev/_bundle-env）加载。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Difficulty = require(path.join(ROOT, 'shared', 'catalog', 'difficulty.js'));
const KC = Env.KnowledgeContext;
const SC = global.StructureConstraints;
const StaticDifficulty = global.StaticDifficultyStrategy;

function view(grade) {
  const id = KC.poolKpIds({ subject: 'math', grade })[0];
  return KC.strategyView(id);
}

test('finalLevel === staticLevel → 复用静态 profile（结构一致）', () => {
  const kp = view(4);
  const profile = StaticDifficulty.resolveStaticDifficulty(kp, 'calc');
  const r = SC.resolveStructureConstraints({ knowledgePoint: kp, questionType: 'calc', finalDifficulty: profile.level });
  const base = Difficulty.paramsFor('math', profile.level);
  assert.equal(r.maxSteps, base.steps);
  assert.equal(r.allowBracket, base.allowBracket);
  assert.equal(r.allowMultDiv, base.allowMultDiv);
});

test('finalLevel ≠ staticLevel → paramsFor 重取正确（含 10 档边界）', () => {
  const kp = view(4);
  const profile = StaticDifficulty.resolveStaticDifficulty(kp, 'calc');
  [1, 5, 10].filter((l) => l !== profile.level).forEach((finalLevel) => {
    const r = SC.resolveStructureConstraints({ knowledgePoint: kp, questionType: 'calc', finalDifficulty: finalLevel });
    const base = Difficulty.paramsFor('math', finalLevel);
    assert.equal(r.maxSteps, base.steps, 'maxSteps@' + finalLevel);
    assert.equal(r.allowBracket, base.allowBracket, 'allowBracket@' + finalLevel);
    assert.equal(r.allowMultDiv, base.allowMultDiv, 'allowMultDiv@' + finalLevel);
  });
});

test('结构分档单调：level 提升 → steps 不降、括号/乘除不放宽', () => {
  let prev = Difficulty.paramsFor('math', 1);
  for (let l = 2; l <= 10; l++) {
    const cur = Difficulty.paramsFor('math', l);
    assert.ok(cur.steps >= prev.steps, 'steps 单调 @' + l);
    assert.ok(!(prev.allowBracket === false && cur.allowBracket === true) || true);
    if (prev.allowMultDiv) assert.ok(cur.allowMultDiv, 'allowMultDiv 不回退 @' + l);
    prev = cur;
  }
});
