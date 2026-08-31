/**
 * shared/generator/generators/complex.js — M4-R18 复杂运算 Generator
 *
 * plan-driven：不解释难度，全部由 QuestionPlan 约束 + constraints.structure.family 决定。
 *
 * family 分派（来自 kp-complex-semantics 注入）：
 *   chain      — 连加连减 / 乘除混合（纯算术核心，多步链）
 *   no-bracket — 无括号混合运算（纯算术核心，多步链；先乘除后加减由核心保证）
 *   bracket    — 带括号混合运算（括号包前两步）
 *   inverse    — 填未知数 / 填运算符（逆向题）
 *
 * 输出 SemanticQuestion（无渲染逻辑）；prompt 直接表达算式，答案数值/字符串。
 */
'use strict';

var Rng = require('../core/rng.js');
var Arith = require('../core/arithmetic-core.js');

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':complex:' + i;
  return (plan.knowledgePointId + '|' + plan.family + '|' + plan.difficulty + '|' + plan.count) + ':complex:' + i;
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
      steps: (constraints.structure && constraints.structure.family === 'chain') ? (constraints.exactSteps || 2) : (constraints.maxSteps || 1),
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    numberRange: constraints.numberRange || { min: 1, max: 20 },
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    hint: null,
    answerMode: 'input',
    family: (constraints.structure && constraints.structure.family) || 'chain',
    data: extra || {}
  };
}

/**
 * 乘除混合链（仅 ×/÷，2 步）：形如 a ÷ b × c 或 a × b ÷ c
 * 保证整除：先构造可整除的 pair。返回值同 generateStructure。
 */
function buildMultDivChain(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var maxForMult = Math.min(max, 9);

  var guard = 0;
  while (guard++ < 200) {
    var op1 = Rng.pick(rng, [Arith.OP_MUL, Arith.OP_DIV]);
    var op2 = Rng.pick(rng, [Arith.OP_MUL, Arith.OP_DIV]);
    var a, b, c;
    if (op1 === Arith.OP_DIV) {
      // a ÷ b ─►  a = b * q ; then op2
      b = Rng.randInt(rng, 2, maxForMult);
      var q = Rng.randInt(rng, 2, maxForMult);
      a = b * q;
      if (a > max) continue;
      if (op2 === Arith.OP_MUL) {
        c = Rng.randInt(rng, 2, maxForMult);
        return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
      }
      // a ÷ b ÷ c  →  ensure q % c === 0
      c = Rng.randInt(rng, 2, maxForMult);
      if (q % c !== 0) continue;
      return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
    } else {
      // op1 === MUL
      a = Rng.randInt(rng, 2, maxForMult);
      b = Rng.randInt(rng, 2, maxForMult);
      var prod = a * b;
      if (op2 === Arith.OP_DIV) {
        if (prod > max) continue;
        c = Rng.randInt(rng, 2, maxForMult);
        if (prod % c !== 0) continue;
        return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
      }
      // a × b × c
      c = Rng.randInt(rng, 2, maxForMult);
      if (a * b * c > max) continue;
      return { operands: [a, b, c], operators: [op1, op2], steps: 2 };
    }
  }
  return { operands: [6, 3, 2], operators: [Arith.OP_DIV, Arith.OP_MUL], steps: 2 };
}

function makeChain(plan, context, i) {
  var constraints = plan.constraints || {};
  var structure = constraints.structure || {};
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var operators = constraints.operation || [Arith.OP_ADD, Arith.OP_SUB];

  // 乘除混合链（仅 ×/÷）：核心的 ×→[+,-] 强制不适用，走专用构造
  var onlyMultDiv = operators.length > 0 &&
    operators.every(function (o) { return o === Arith.OP_MUL || o === Arith.OP_DIV; });

  var gen;
  if (onlyMultDiv) {
    gen = buildMultDivChain(rng, { numberRange: constraints.numberRange });
  } else {
    gen = Arith.generateStructure(rng, {
      operation: 'mixed',
      numberRange: constraints.numberRange,
      maxSteps: constraints.maxSteps || 2,
      allowBracket: false,
      allowMultDiv: (structure.family === 'no-bracket' || structure.family === 'chain'),
      exactSteps: constraints.exactSteps || 2,
      operationSet: operators,
      noNegative: true
    });
  }
  var answer = Arith.calculateAnswer(gen.operands, gen.operators);
  var q = buildBase(plan, context, i, { steps: gen.steps, mode: 'chain' });
  q.prompt = Arith.formatExpression(gen.operands, gen.operators) + ' =';
  q.answer = String(answer);
  q.data.operands = gen.operands;
  q.data.operators = gen.operators;
  return q;
}

function makeBracket(plan, context, i) {
  var constraints = plan.constraints || {};
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = Arith.buildBracket(rng, {
    numberRange: constraints.numberRange,
    noNegative: true
  });
  var q = buildBase(plan, context, i, { mode: 'bracket' });
  q.prompt = Arith.formatBracketExpression(s.operands, s.operators) + ' =';
  q.answer = String(s.answer);
  q.data.operands = s.operands;
  q.data.operators = s.operators;
  return q;
}

function makeInverse(plan, context, i) {
  var constraints = plan.constraints || {};
  var structure = constraints.structure || {};
  var mode = (structure.inverse && structure.inverse.mode) || 'fill-operand';
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var operators = constraints.operation || [Arith.OP_ADD, Arith.OP_SUB];

  if (mode === 'fill-operator') {
    var fo = Arith.buildFillOperator(rng, { numberRange: constraints.numberRange, operators: operators });
    var q = buildBase(plan, context, i, { mode: 'fill-operator' });
    q.prompt = fo.prompt;
    q.answer = fo.answer;
    q.data.operands = fo.operands;
    return q;
  }

  var f = Arith.buildFillOperand(rng, { numberRange: constraints.numberRange, operators: operators });
  var q2 = buildBase(plan, context, i, { mode: 'fill-operand' });
  q2.prompt = f.prompt;
  q2.answer = String(f.unknown);
  q2.data.position = f.position;
  q2.data.operator = f.operator;
  return q2;
}

function createComplexGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:complex';
  var subject = spec.subject || 'math';
  var knowledgePoints = spec.knowledgePoints || [];

  var generator = {
    id: id,
    subject: subject,
    capabilities: spec.capabilities || ['calc', 'fill', 'oral'],
    questionTypes: spec.questionTypes || ['calc', 'fill', 'oral'],
    knowledgePoints: knowledgePoints,

    supports: function (plan) {
      if (!plan || !plan.constraints || !plan.constraints.structure) return false;
      // 仅服务于本生成器绑定的复杂 KP；family 必须可识别
      return knowledgePoints.indexOf(plan.knowledgePointId) !== -1;
    },

    generate: function (plan, context) {
      var family = (plan.constraints && plan.constraints.structure && plan.constraints.structure.family) || 'chain';
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      for (var i = 0; i < count; i++) {
        var q;
        if (family === 'bracket') q = makeBracket(plan, context, i);
        else if (family === 'inverse') q = makeInverse(plan, context, i);
        else q = makeChain(plan, context, i);
        questions.push(q);
      }
      return questions;
    }
  };
  return generator;
}

var COMPLEX_KPS = [
  'math-g1-m1-mixed-chain',
  'math-g2-m1-mixed-addsub',
  'math-g2-m1-mixed-multdiv',
  'math-g2-m3-chain-addsub',
  'math-g2-m3-multdiv-mixed',
  'math-g2-m3-mixed-no-bracket',
  'math-g2-m3-mixed-bracket',
  'math-g1-m4-num-fill-unknown',
  'math-g2-m3-fill-operator'
];

function buildAll() {
  return [
    createComplexGenerator({
      id: 'generator:complex-calc',
      capabilities: ['calc', 'fill', 'oral'],
      questionTypes: ['calc', 'fill', 'oral'],
      knowledgePoints: COMPLEX_KPS
    })
  ];
}

module.exports = {
  COMPLEX_KPS: COMPLEX_KPS,
  createComplexGenerator: createComplexGenerator,
  buildAll: buildAll
};
