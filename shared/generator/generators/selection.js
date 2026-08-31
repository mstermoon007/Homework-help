/**
 * shared/generator/generators/selection.js — M4-R06 选择题族核心 Generator
 *
 * fill（填空）/ choice（选择）/ judge（判断）
 *
 * 复用算术核心抽取件（操作数/结构/答案/干扰项），输出 SemanticQuestion，
 * 无渲染逻辑；难度/结构全部来自 QuestionPlan 约束。
 */
'use strict';

var Rng = require('../core/rng.js');
var Arith = require('../core/arithmetic-core.js');

function createSelectionGenerator(spec) {
  spec = spec || {};
  var mode = spec.mode || 'fill'; // fill | choice | judge
  var id = spec.id || 'generator:selection-' + mode;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    return (plan.knowledgePointId + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  function baseArithmetic(plan, context, i) {
    var constraints = plan.constraints || {};
    var rng = Rng.createSeededRandom(seedFor(plan, context, i));
    var structure = Arith.generateStructure(rng, {
      operation: context.operation || plan.operation || 'mixed',
      numberRange: constraints.numberRange,
      maxSteps: constraints.maxSteps,
      allowBracket: constraints.allowBracket,
      allowMultDiv: constraints.allowMultDiv,
      noNegative: true
    });
    var answer = Arith.calculateAnswer(structure.operands, structure.operators);
    return { rng: rng, structure: structure, answer: answer, constraints: constraints };
  }

  function buildBase(plan, context, i, extra) {
    var constraints = plan.constraints || {};
    return {
      knowledgePointId: plan.knowledgePointId,
      questionType: plan.questionTypeId,
      difficulty: plan.difficulty,
      difficultyParams: {
        level: plan.difficulty,
        scale: constraints.scale != null ? constraints.scale : 1,
        steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
        allowBracket: !!constraints.allowBracket,
        allowMultDiv: !!constraints.allowMultDiv
      },
      numberRange: constraints.numberRange || { min: 1, max: 20 },
      spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
      context: plan.contextType != null ? plan.contextType : 'standard',
      seed: seedFor(plan, context, i),
      hint: null,
      answerMode: 'input',
      data: extra || {}
    };
  }

  function makeQuestion(plan, context, i) {
    var base = baseArithmetic(plan, context, i);
    var expr = Arith.formatExpression(base.structure.operands, base.structure.operators);

    if (mode === 'fill') {
      var qFill = buildBase(plan, context, i, { mode: 'fill', steps: base.structure.steps });
      qFill.prompt = expr + ' = ____';
      qFill.answer = String(base.answer);
      return qFill;
    }

    if (mode === 'choice') {
      var distractors = Arith.generateDistractors(base.rng, base.answer, 3, base.constraints.numberRange);
      if (distractors.length < 2) {
        // numberRange 过窄（如 {1,1}）时放宽干扰项范围，保证至少 2 个不同干扰项
        distractors = Arith.generateDistractors(base.rng, base.answer, 3, null);
      }
      var options = Rng.shuffle(base.rng, distractors.concat([base.answer]).map(String));
      var qChoice = buildBase(plan, context, i, { mode: 'choice', steps: base.structure.steps });
      qChoice.prompt = expr + ' = ?';
      qChoice.answer = String(base.answer);
      qChoice.data.options = options;
      qChoice.data.correctIndex = options.indexOf(String(base.answer));
      return qChoice;
    }

    // judge：命题正确与否
    var isTrue = base.rng() < 0.5;
    var shown = isTrue
      ? base.answer
      : base.answer + Rng.pick(base.rng, [-1, 1]) * Rng.randInt(base.rng, 1, 2);
    var qJudge = buildBase(plan, context, i, { mode: 'judge', steps: base.structure.steps, shownResult: String(shown) });
    qJudge.prompt = expr + ' = ' + shown + '（对还是错？）';
    qJudge.answer = isTrue;
    return qJudge;
  }

  var generator = {
    id: id,
    subject: subject,
    capabilities: mode === 'fill' ? ['fill'] : (mode === 'choice' ? ['choice'] : ['judge']),
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i));
      }
      return questions;
    }
  };
  return generator;
}

function buildAll() {
  return [
    createSelectionGenerator({ id: 'generator:selection-fill', mode: 'fill' }),
    createSelectionGenerator({ id: 'generator:selection-choice', mode: 'choice' }),
    createSelectionGenerator({ id: 'generator:selection-judge', mode: 'judge' })
  ];
}

module.exports = {
  createSelectionGenerator: createSelectionGenerator,
  buildAll: buildAll
};
