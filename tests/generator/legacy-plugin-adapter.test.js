'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Adapter = require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
const Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));

function fakePlugin() {
  return {
    id: 'fake-math',
    subject: 'math',
    generate: function (opts) {
      opts = opts || {};
      var n = opts.count || 1;
      var questions = [];
      for (var i = 0; i < n; i++) {
        questions.push({
          type: 'calc-item',
          q: (i + 3) + ' + ' + (i + 5) + ' = ?',
          answer: String(i + 8),
          knowledgePointId: 'math-g1-m0-make-ten',
          render: function () { return '<div></div>'; },
          check: function () { return true; }
        });
      }
      return { questions: questions, meta: { count: n } };
    }
  };
}

function makePlan(count, difficulty) {
  return Engine.plan({ knowledgePointId: 'math-g1-m0-make-ten', count: count || 2, difficulty: difficulty || 3 }).plans[0];
}

test('QuestionPlan → legacy options → plugin.generate → SemanticQuestion[]', () => {
  const generator = Adapter.createLegacyGenerator(fakePlugin(), {
    capabilities: ['calc'],
    knowledgePoints: ['math-g1-m0-make-ten']
  });
  const plan = makePlan(2, 4);
  assert.strictEqual(generator.supports(plan), true);

  const questions = generator.generate(plan, { seed: 's' });
  assert.strictEqual(questions.length, 2);
  questions.forEach(q => {
    assert.strictEqual(Contract.validateSemanticQuestion(q).valid, true);
    // 统一映射：7 维全部携带
    assert.strictEqual(q.knowledgePointId, 'math-g1-m0-make-ten');
    assert.strictEqual(q.questionType, plan.questionTypeId);
    assert.strictEqual(q.difficulty, 4);
    assert.strictEqual(q.difficultyParams.level, 4);
    assert.deepStrictEqual(q.numberRange, plan.constraints.numberRange);
    assert.strictEqual(q.spiralLevel, plan.spiralLevel);
    assert.strictEqual(q.context, plan.contextType);
    assert.ok(q.seed != null);
    // 渲染契约不得进入语义层
    assert.strictEqual(q.render, undefined);
    assert.strictEqual(q.check, undefined);
  });
});

test('supports：capabilities 不匹配 → false', () => {
  const generator = Adapter.createLegacyGenerator(fakePlugin(), {
    capabilities: ['geometry'],
    knowledgePoints: ['math-g1-m0-make-ten']
  });
  assert.strictEqual(generator.supports(makePlan()), false);
});

test('supports：knowledgePoints 不匹配 → false', () => {
  const generator = Adapter.createLegacyGenerator(fakePlugin(), {
    capabilities: ['calc'],
    knowledgePoints: ['other-kp']
  });
  assert.strictEqual(generator.supports(makePlan()), false);
});

test('异步插件：generate 返回 Promise → SemanticQuestion[]', async () => {
  const asyncPlugin = {
    id: 'async-math',
    subject: 'math',
    generate: function (opts) {
      return Promise.resolve({ questions: [{ q: '1+1=?', answer: '2', knowledgePointId: 'math-g1-m0-make-ten' }] });
    }
  };
  const generator = Adapter.createLegacyGenerator(asyncPlugin, {
    capabilities: ['calc'],
    knowledgePoints: ['math-g1-m0-make-ten']
  });
  const questions = await generator.generate(makePlan(1), {});
  assert.strictEqual(questions.length, 1);
  assert.strictEqual(Contract.validateSemanticQuestion(questions[0]).valid, true);
});

test('fallback：原始 exerciseSet 保留 render/check（渲染契约不变）', () => {
  const plugin = fakePlugin();
  const plan = makePlan(2);
  const set = Adapter.runLegacyFallback(plugin, plan, { grade: 1 });
  assert.strictEqual(set.questions.length, 2);
  assert.strictEqual(typeof set.questions[0].render, 'function');
  assert.strictEqual(typeof set.questions[0].check, 'function');
});

test('read-aloud 跟读题（无 answer）→ answerMode read-aloud 且契约通过', () => {
  const readPlugin = {
    id: 'read-math',
    subject: 'math',
    generate: function () {
      return { questions: [{ letter: 'A', name: 'A', sound: 'ei' }] };
    }
  };
  const generator = Adapter.createLegacyGenerator(readPlugin, {
    capabilities: ['calc'],
    knowledgePoints: ['math-g1-m0-make-ten']
  });
  const questions = generator.generate(makePlan(1), {});
  assert.strictEqual(questions[0].answerMode, 'read-aloud');
  assert.strictEqual(questions[0].prompt, 'A');
  assert.strictEqual(Contract.validateSemanticQuestion(questions[0]).valid, true);
});
