'use strict';

/**
 * tests/orchestration/p11-00-generation-context.test.js — Generation Cell Context Contract（P11-00）
 *
 * 冻结：Request → POL Plan → Cell Request 的投影规则（practice-orchestrator.js 头契约）
 *   - 生成上下文（difficulty/adaptive/learnerProfile/subtype/cognitiveLevel/spiralLevel/
 *     max_spiral_level/customParams/settings/allowDifficultyOverride/selectLevel/style/expectedAnswerStyle）
 *     必须完整继承到 cell；Context Loss = 0。
 *   - 规划上下文（combine/planLevel/父级 typeCounts/perTypeCount/count）不得下沉。
 *   - cell 是选区收窄：cell ∈ selectedTypes × selectedKPs。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = Env.KnowledgeContext;

const GRADE = 2;
const KPS = KC.poolKpIds({ subject: 'math', grade: GRADE }).slice(0, 3);
const TYPES = ['calc', 'fill'];

const GENERATION_CONTEXT = {
  difficulty: 6,
  selectLevel: 'standard',
  style: 'plain',
  expectedAnswerStyle: 'text',
  subtype: 'sub-1',
  cognitiveLevel: 3,
  spiralLevel: 2,
  max_spiral_level: 4,
  customParams: { a: 1 },
  settings: { b: 2 },
  allowDifficultyOverride: true,
  adaptive: true,
  adaptiveMode: 'new',
  adaptiveDelta: 0.5,
  learnerProfile: { mastery: 0.6, confidence: 0.8 }
};

const PLANNING_ONLY = {
  planLevel: 'overall',
  perTypeCount: 4
};

function captureExecute(store) {
  return function (req) {
    store.push(req);
    return Promise.resolve({ questions: [], plans: [], trace: {}, failedPlans: [] });
  };
}

async function runWithCapture(parentExtra) {
  const store = [];
  const req = Object.assign({
    subject: 'math', grade: GRADE,
    knowledgePointIds: KPS, questionTypes: TYPES, count: 8
  }, GENERATION_CONTEXT, PLANNING_ONLY, parentExtra || {});
  const res = await PO.orchestrate(req, {}, { execute: captureExecute(store) });
  return { store, res, req };
}

test('① Context Loss = 0：生成上下文逐字段完整继承到每个 cell', async () => {
  const { store } = await runWithCapture();
  assert.ok(store.length > 0, '存在 cell 执行');
  store.forEach((cell, i) => {
    Object.keys(GENERATION_CONTEXT).forEach((k) => {
      assert.deepEqual(cell[k], GENERATION_CONTEXT[k], 'cell#' + i + ' 丢失 ' + k);
    });
  });
});

test('② 规划级字段不下沉：planLevel / 父级 perTypeCount 不进入 cell；cell 预算是自身单题型预算', async () => {
  const { store } = await runWithCapture();
  store.forEach((cell, i) => {
    assert.ok(!('planLevel' in cell), 'cell#' + i + ' 不得含 planLevel');
    assert.equal(cell.perTypeCount, null, 'cell#' + i + ' perTypeCount 必须为 null（父级规划字段）');
    assert.ok(Array.isArray(cell.typeCounts) && cell.typeCounts.length === 1, 'cell typeCounts 仅自身题型');
    assert.equal(cell.typeCounts[0].questionType, cell.questionTypes[0]);
    assert.equal(cell.typeCounts[0].count, cell.count);
    assert.equal(cell.mode, 'single-kp');
  });
});

test('③ 选区收窄：cell ∈ selectedTypes × selectedKPs（所有轮次，含 recovery）', async () => {
  const { store, req } = await runWithCapture();
  const selectedTypes = req.questionTypes;
  const selectedKps = req.knowledgePointIds;
  store.forEach((cell, i) => {
    assert.equal(cell.questionTypes.length, 1, 'cell#' + i + ' 单题型');
    assert.equal(cell.knowledgePointIds.length, 1, 'cell#' + i + ' 单 KP');
    assert.ok(selectedTypes.indexOf(cell.questionTypes[0]) !== -1, 'cell#' + i + ' 题型越界');
    assert.ok(selectedKps.indexOf(cell.knowledgePointIds[0]) !== -1, 'cell#' + i + ' KP 越界');
  });
});

test('④ 真实执行链：cellReq 进入 Strategy 后用户难度保持（1/5/10）', async () => {
  for (const d of [1, 5, 10]) {
    const store = [];
    const req = {
      subject: 'math', grade: GRADE, knowledgePointIds: [KPS[0]],
      questionTypes: ['calc'], count: 2, difficulty: d, adaptive: true, adaptiveMode: 'new'
    };
    await PO.orchestrate(req, {}, { execute: captureExecute(store) });
    const cell = store[0];
    const plan = global.StrategyEngine.plan(Object.assign({}, cell, { count: cell.count })).plans[0];
    assert.equal(plan.difficulty, d, 'Strategy plan.difficulty=' + d);
  }
});
