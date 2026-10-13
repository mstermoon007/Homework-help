'use strict';

/**
 * tests/generation/p40-q05-misconception-distractors.test.js — P40-Q-05 迷思驱动干扰项
 *
 * 双证据验收（任务书 §1.2 Q-05）：
 *   证据 1（读信号发生）：semantic-parameters.resolve 投影 semanticParams.miscons（KP 错误谱轻量形态）；
 *   证据 2（产出变化）：算术 choice 干扰项按错误谱选择扰动策略（口诀混淆→乘数错位、
 *     概念混淆/符号错误→运算符共轭、计算错误/步骤错误→off-by-one），data.distractors
 *     携带 {expr, errorType, source} 溯源；无素材 KP 诚实降级（source='adjacent-fallback'）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// 有 slots 的乘法 KP（math-g2-down-u03-k005：计算错误 + 口诀混淆 + 审题错误）
const RESOLVER = SP.resolve || SP.createSemanticParameterResolver;
const kpWithSlots = 'math-g2-down-u03-k005';
const kpWithout = 'math-g1-down-u04-k002'; // #7 复现 KP：无迷思剖面（T2 数据事实）

function resolveFor(kpId, qt) {
  if (typeof RESOLVER === 'function' && SP.createSemanticParameterResolver) {
    var r = typeof SP === 'function' ? SP() : SP;
    return r.resolve(kpId, qt);
  }
  return SP.resolve ? SP.resolve(kpId, qt) : SP(kpId, qt);
}

test('P40-Q-05 证据 1（读信号）：miscons 投影 KP 错误谱', () => {
  var sp = resolveFor(kpWithSlots, 'choice');
  assert.ok(Array.isArray(sp.miscons), 'miscons 应为数组');
  assert.ok(sp.miscons.length >= 2, '该 KP 应投影出错误谱：' + JSON.stringify(sp.miscons));
  var types = sp.miscons.map(function (m) { return m.errorType; });
  assert.ok(types.indexOf('口诀混淆') !== -1 || types.indexOf('计算错误') !== -1,
    '错误谱应含口诀/计算错误类：' + types.join(','));
  assert.ok(types.every(function (t) { return t != null; }));
});

test('P40-Q-05 证据 1：无剖面 KP miscons 为空数组（诚实空态）', () => {
  var sp = resolveFor(kpWithout, 'choice');
  assert.deepEqual(sp.miscons, [], '无 slots KP 应投影空数组');
});

test('P40-Q-05 证据 2（产出变化）：有 slots KP 的 choice 干扰项带迷思溯源', async () => {
  var session = new PracticeSession({
    subject: 'math', grade: 2, count: 3, difficulty: 3,
    knowledgePointId: 'math-g2-down-u03-k005', questionType: 'choice',
    seed: 'p40q05|miscon|' + kpWithSlots
  });
  await session.start();
  var qs = session.semanticQuestions || [];
  assert.ok(qs.length >= 1, '应产出题目');
  var misconceptionSeen = false;
  for (var q of qs) {
    assert.equal(q.questionType, 'choice');
    var d = q.data || {};
    assert.ok(Array.isArray(d.distractors) && d.distractors.length >= 1,
      'data.distractors 溯源字段应存在：' + JSON.stringify(d).slice(0, 200));
    assert.equal(d.distractors.length, 3, '3 个干扰项全部携带溯源');
    var correct = String(q.answer.value);
    assert.ok(d.options.indexOf(correct) !== -1, '正确项在选项内');
    for (var p of d.distractors) {
      assert.ok(p && p.expr != null && p.source, '溯源结构完整 ' + JSON.stringify(p));
      assert.ok(['misconception', 'adjacent-fallback'].indexOf(p.source) !== -1, 'source 枚举合法');
      assert.notEqual(String(p.expr), correct, '干扰项不得与正确项相同');
      if (p.source === 'misconception') {
        misconceptionSeen = true;
        assert.ok(p.errorType, '迷思溯源须带 errorType');
      }
    }
  }
  assert.ok(misconceptionSeen, '3 题中至少 1 题产出迷思驱动干扰项（口诀混淆→乘数错位）');
});

test('P40-Q-05 证据 2：无素材 KP 诚实降级（全 adjacent-fallback，不编造迷思）', async () => {
  var session = new PracticeSession({
    subject: 'math', grade: 1, count: 2, difficulty: 3,
    knowledgePointId: kpWithout, questionType: 'choice',
    seed: 'p40q05|fallback|' + kpWithout
  });
  await session.start();
  var qs = session.semanticQuestions || [];
  assert.ok(qs.length >= 1);
  for (var q of qs) {
    var d = q.data || {};
    assert.ok(Array.isArray(d.distractors) && d.distractors.length === 3);
    for (var p of d.distractors) {
      assert.equal(p.source, 'adjacent-fallback', '无素材 KP 不得标 source=misconception');
      assert.equal(p.errorType, null, '降级项不带伪造 errorType');
    }
  }
});

test('P40-Q-05 溯源与选项一致：溯源 expr ∈ data.options', async () => {
  var session = new PracticeSession({
    subject: 'math', grade: 2, count: 2, difficulty: 3,
    knowledgePointId: 'math-g2-down-u03-k001', questionType: 'choice',
    seed: 'p40q05|consist|' + 'math-g2-down-u03-k001'
  });
  await session.start();
  for (var q of (session.semanticQuestions || [])) {
    var d = q.data || {};
    if (!d.distractors) continue;
    for (var p of d.distractors) {
      assert.ok(d.options.indexOf(p.expr) !== -1,
        '溯源 expr 必须在选项中：' + p.expr + ' vs ' + JSON.stringify(d.options));
    }
  }
});

// P40-Q-SEM 缺陷 #1（数域失守）防回归：91+26=117>numMax=100 越界
test('P40-Q-SEM #1：纯加减结果落在封闭数域内（复现 seed 回归）', async () => {
  var session = new PracticeSession({
    subject: 'math', grade: 1, count: 1, difficulty: 3,
    knowledgePointId: 'math-g1-down-u04-k002', questionType: 'apply',
    seed: 'p40q01|math-g1-down-u04-k002|apply|d3|a'
  });
  await session.start();
  var sq = (session.semanticQuestions || [])[0];
  assert.ok(sq, '应产出题目');
  assert.ok(Number(sq.answer.value) <= 100, '#1 结果不得越界：' + sq.prompt + ' → ' + sq.answer.value);
});
