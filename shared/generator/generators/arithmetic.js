/**
 * shared/generator/generators/arithmetic.js — M4-R06 算术族核心 Generator
 *
 * addition / subtraction / multiplication / division / mixed-calculation
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成；
 * 输出 SemanticQuestion（无渲染逻辑）；难度/结构全部来自 QuestionPlan 约束。
 */
'use strict';

var Rng = require('../core/rng.js');
var Arith = require('../core/arithmetic-core.js');

// Refactor Step 2：QuestionPlan 主知识点 ID（数组唯一语义；边界兼容旧单数）
function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

var FAMILY = {
  addition: { op: 'add' },
  subtraction: { op: 'sub' },
  multiplication: { op: 'mult' },
  division: { op: 'div' },
  'mixed-calculation': { op: 'mixed' }
};

function createArithmeticGenerator(spec) {
  spec = spec || {};
  var op = spec.operation || 'add';
  var id = spec.id || 'generator:arithmetic-' + op;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
    // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
    if (plan && plan.seed != null) return plan.seed + ':' + i;
    return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  // M4-R17：兼容 operation 为 字符串（旧）或 KP 语义数组（新）。
  // operationSet 始终是「算符数组」；operation 字符串仅用于旧路径。
  function planOperationSet(plan) {
    return (plan.operationSet || (Array.isArray(plan.operation) ? plan.operation : null));
  }
  function planOperationStr(plan) {
    return (typeof plan.operation === 'string'
      ? plan.operation
      : (plan.operationStr || null));
  }

  return {
    id: id,
    subject: subject,
    capabilities: ['oral', 'calc', 'fill', 'apply'],
    questionTypes: ['oral', 'calc', 'fill', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'oral' || plan.questionTypeId === 'calc';
    },

    generate: function (plan, context) {
      context = context || {};
      var constraints = plan.constraints || {};
      var count = plan.count || 1;
      var questions = [];

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var opSet = context.operationSet || planOperationSet(plan);
        var kind = constraints.kind ||
          ((plan.constraints && plan.constraints.kind) || (plan.kind || null));
        var structure = Arith.buildSpecialKind(rng, { kind: kind, numberRange: constraints.numberRange });
        if (!structure) {
          structure = Arith.generateStructure(rng, {
            operation: context.operation || planOperationStr(plan) || ((opSet && opSet.filter(function (o) { return o === '+' || o === '−'; }).length === opSet.length) ? 'add' : op),
            operationSet: opSet,
            exactSteps: constraints.exactSteps,
            numberRange: constraints.numberRange,
            maxSteps: constraints.exactSteps != null ? constraints.exactSteps : constraints.maxSteps,
            allowBracket: constraints.allowBracket,
            allowMultDiv: constraints.allowMultDiv,
            noNegative: true
          });
        }
        var answer = structure.answer != null ? structure.answer : Arith.calculateAnswer(structure.operands, structure.operators);
        var prompt = Arith.formatExpression(structure.operands, structure.operators) + ' = ?';

        questions.push({
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
          prompt: prompt,
          answer: { value: String(answer), acceptable: [] },
          answerMode: 'input',
          hint: null,
          data: {
            // C2：data.operation 必须用「运算标签字符串」。plan.operation 在新计划形态下
            // 是算符数组（如 ['+']），直接送 normalizeOperation 会落入兜底 'mixed'，
            // 导致单运算 KP（如竖式加法 KP operation=['+']）的题目被误标 mixed 而
            // 触发 KP_SEMANTIC_OPERATION；优先级与上方 generateStructure 的运算决策一致。
            operation: Arith.normalizeOperation(context.operation || planOperationStr(plan) || op),
            steps: structure.steps
          }
        });
      }
      return questions;
    }
  };
}

function buildAll() {
  var out = [];
  Object.keys(FAMILY).forEach(function (name) {
    out.push(createArithmeticGenerator({ id: 'generator:arithmetic-' + name, operation: FAMILY[name].op }));
  });
  return out;
}

module.exports = {
  FAMILY: FAMILY,
  createArithmeticGenerator: createArithmeticGenerator,
  buildAll: buildAll
};
