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
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

// Refactor Step 2：QuestionPlan 主知识点 ID（数组唯一语义；边界兼容旧单数）
function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function createSelectionGenerator(spec) {
  spec = spec || {};
  var mode = spec.mode || 'fill'; // fill | choice | judge
  var id = spec.id || 'generator:selection-' + mode;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
    // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
    if (plan && plan.seed != null) return plan.seed + ':' + i;
    return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  // FINAL-31c 同源（见 application.js）：KP 语义运算约束。真源 plan.semanticParams.operations
  // （SemanticParameters.attachToPlan 注入的 KBL semantic.operations，token 为
  // addition/subtraction/multiplication/division）。KP 显式声明运算时，题面算式必须落在
  // 允许集内，杜绝「乘除 KP（如 g2-down-u07-k002 数量关系整合）产出加法口算」的语义错位。
  // operations 为空（KP 无显式运算约束）时不过滤，保持原行为。
  var OP_ALIAS = {
    addition: 'add', subtraction: 'sub', multiplication: 'mult', division: 'div',
    add: 'add', sub: 'sub', mult: 'mult', div: 'div'
  };
  function kpAllowedOps(plan) {
    var ops = plan && plan.semanticParams && plan.semanticParams.operations;
    var out = [];
    if (Array.isArray(ops)) {
      ops.forEach(function (o) {
        var t = OP_ALIAS[o];
        if (t && out.indexOf(t) === -1) out.push(t);
      });
    }
    return out.length ? out : null;
  }

  function baseArithmetic(plan, context, i) {
    var constraints = plan.constraints || {};
    var rng = Rng.createSeededRandom(seedFor(plan, context, i));
    var operation = context.operation || plan.operation || 'mixed';
    // KP 运算约束：声明的运算 ∉ 允许集（含默认 'mixed'）→ 从允许集确定性择一，
    // 并按运算收束算符池（generateStructure 对 'mult'/'div' 只出对应算符）。
    var allowedOps = kpAllowedOps(plan);
    if (allowedOps && allowedOps.indexOf(Arith.normalizeOperation(operation)) === -1) {
      operation = allowedOps[Math.floor(rng() * allowedOps.length)];
    }
    var structure = Arith.generateStructure(rng, {
      operation: operation,
      numberRange: constraints.numberRange,
      maxSteps: constraints.maxSteps,
      allowBracket: constraints.allowBracket,
      allowMultDiv: constraints.allowMultDiv,
      noNegative: true
    });
    var answer = Arith.calculateAnswer(structure.operands, structure.operators);
    return { rng: rng, structure: structure, answer: answer, constraints: constraints, operation: operation };
  }

  function buildBase(plan, context, i, extra) {
    var constraints = plan.constraints || {};
    return {
      knowledgePointId: pkp(plan),
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
    var qt = plan.questionTypeId;

    // P30-GEN-06（P30-16）：selection-* 生成器可能被 KP 绑定承接多题型（fill/choice/judge/apply/calc），
    // 题面须按 qt 分化骨架，不能恒用创建时的 mode。
    if (qt === 'fill') {
      var qFill = buildBase(plan, context, i, { mode: 'fill', operation: base.operation, steps: base.structure.steps });
      qFill.prompt = '计算：' + expr + ' = ____';
      qFill.answer = { value: String(base.answer), acceptable: [] };
      return qFill;
    }

    if (qt === 'choice') {
      var distractors = Arith.generateDistractors(base.rng, base.answer, 3, base.constraints.numberRange);
      if (distractors.length < 2) {
        distractors = Arith.generateDistractors(base.rng, base.answer, 3, null);
      }
      var options = Rng.shuffle(base.rng, distractors.concat([base.answer]).map(String));
      var qChoice = buildBase(plan, context, i, { mode: 'choice', operation: base.operation, steps: base.structure.steps });
      qChoice.prompt = '请选择正确答案：' + expr + ' = ？';
      qChoice.answer = { value: String(base.answer), acceptable: [] };
      qChoice.data.options = options;
      qChoice.data.correctIndex = options.indexOf(String(base.answer));
      return qChoice;
    }

    if (qt === 'judge') {
      var isTrue = base.rng() < 0.5;
      var shown = isTrue
        ? base.answer
        : base.answer + Rng.pick(base.rng, [-1, 1]) * Rng.randInt(base.rng, 1, 2);
      var qJudge = buildBase(plan, context, i, { mode: 'judge', operation: base.operation, steps: base.structure.steps, shownResult: String(shown) });
      qJudge.prompt = '判断对错：' + expr + ' = ' + shown + '（对还是错？）';
      qJudge.answer = {
        value: isTrue,
        acceptable: [],
        explanation: isTrue
          ? expr + ' = ' + base.answer + '，计算正确，说法成立。'
          : expr + ' 的正确结果是 ' + base.answer + '，不是 ' + shown + '，说法错误。'
      };
      if (!isTrue) {
        qJudge.data.misconception = '计算结果错误：' + expr.replace(/\s*=\s*$/, '') + ' 的正确结果是 ' +
          base.answer + '，题中写成了 ' + shown + '。';
      }
      return qJudge;
    }

    // apply / calc：直接写得数形态，前缀与 fill/choice/judge 区分
    var qOther = buildBase(plan, context, i, { mode: mode, operation: base.operation, steps: base.structure.steps });
    qOther.prompt = '直接写得数：' + expr + ' = ____';
    qOther.answer = { value: String(base.answer), acceptable: [] };
    return qOther;
  }

  var generator = {
    id: id,
    subject: subject,
    capabilities: mode === 'fill' ? ['fill', 'geometry', 'calc', 'apply'] : (mode === 'choice' ? ['choice', 'geometry', 'calc', 'apply'] : ['judge', 'geometry', 'calc', 'apply']),
    questionTypes: mode === 'fill' ? ['fill', 'geometry', 'calc', 'apply'] : (mode === 'choice' ? ['choice', 'geometry', 'calc', 'apply'] : ['judge', 'geometry', 'calc', 'apply']),knowledgePoints: spec.knowledgePoints || [],

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
      // FINAL-33 同源（见 arithmetic.js）：Generator 自声明 semanticEvidence（依据题面
      // 真实 data.operation 派生 relations/constructs），诚实性由 validator 检查 7/8 把关。
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
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
