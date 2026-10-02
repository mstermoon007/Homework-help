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
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

// P28-NAME-MIGRATION-02：kind 派生迁至 semantic-parameters.js（SSOT 边界），
// 经 plan.semanticParams.kind 暴露。本生成器只读不改写；保留 op='div' 防御层确保
// mixed 生成器在余数 KP 上不误派生（mixed op≠'div' 不命中 → 走通用结构）。余数 KP
// （math-g2-down-u02-k001）路由到 generator:arithmetic-division → op='div' → 命中。

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

// P28-GEO-NATIVE-02：分数乘法单元 geometry 原生 maker（g6-up-u02-k002/k003/k004）。
// 源 Excel 将该单元标在「图形与几何」域，三 KP 各有 geometry ALLOW 行，此前被 shape
// kp=0 泛型兜底成无关认图题。mixed 生成器 kp=1 且声明 geometry 后自然承接，
// 用线段图（diagram.segment，对象参数、渲染器现成）承载「求一个数的几分之几」。
function makeFractionMultiplyGeometryQuestion(plan, context, i, seedFn) {
  var rng = Rng.createSeededRandom(seedFn(plan, context, i));
  var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
  var prompt, answer, graphic, modelKind;

  if (kpName.indexOf('混合') !== -1) {
    // k003：运算律——乘法分配律的线段模型 (1/4 + 2/4) × 8
    var total3 = 8;
    var part3 = 6;
    modelKind = 'fraction-distributive';
    prompt = '看图用乘法分配律简便计算：一条线段长 ' + total3 + ' 米，先取它的 1/4，' +
      '再取它的 2/4，两次一共取了多少米？(1/4 + 2/4) × ' + total3 + ' = ____';
    answer = String(part3);
    graphic = {
      type: 'geometry', subtype: 'segment',
      params: { total: total3, part: part3, unit: 'cm', partLabel: String(part3), totalLabel: String(total3) }
    };
  } else if (kpName.indexOf('解决问题') !== -1) {
    // k004：连续求一个数的几分之几（找准单位“1”）
    var total4 = 24;
    var first4 = 18; // 3/4
    var answer4 = 12; // 再取 2/3
    modelKind = 'fraction-twice';
    prompt = '看图解决问题：果园里共有 ' + total4 + ' 棵果树，苹果树占 3/4，' +
      '红富士苹果树又占苹果树的 2/3。红富士苹果树有多少棵？____';
    answer = String(answer4);
    graphic = {
      type: 'geometry', subtype: 'segment',
      params: { total: total4, part: first4, unit: 'cm', partLabel: String(first4), totalLabel: String(total4) }
    };
  } else {
    // k002：一个数乘分数——单位“1”的量 × 对应分率 = 对应分量
    var den = Rng.pick(rng, [3, 4, 6]);
    var whole = den * Rng.randInt(rng, 2, 4);
    var num = Rng.randInt(rng, 1, den - 1);
    var part = (whole / den) * num;
    modelKind = 'fraction-of-quantity';
    prompt = '看图列式计算：一袋面粉重 ' + whole + ' 千克，做点心用去了它的 ' +
      num + '/' + den + '，用去了多少千克？' + whole + ' × ' + num + '/' + den + ' = ____';
    answer = String(part);
    graphic = {
      type: 'geometry', subtype: 'segment',
      params: { total: whole, part: part, unit: 'cm', partLabel: String(part), totalLabel: String(whole) }
    };
  }

  return {
    knowledgePointId: (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) || plan.knowledgePointId,
    questionType: 'geometry',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFn(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'geometry',
      steps: 1,
      kind: modelKind,
      graphic: graphic,
      operation: 'mult'
    }
  };
}

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

  // P28-GEO-NATIVE-02：mixed-calculation 承接 g6 分数乘法单元 geometry 行（注册表同步声明）
  var declaredTypes = id === 'generator:arithmetic-mixed-calculation'
    ? ['calc', 'fill', 'apply', 'geometry']
    : ['calc', 'fill', 'apply'];

  return {
    id: id,
    subject: subject,
    capabilities: declaredTypes,
    questionTypes: declaredTypes,
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'calc';
    },

    generate: function (plan, context) {
      context = context || {};
      var constraints = plan.constraints || {};
      var count = plan.count || 1;
      var questions = [];

      // P27-11：变式指令通用消费（无 KP 分支）。指令来自 strategy-engine 挂载的
      // plan.variationDirectives（Misconception→NextVariation，P27-10 overlay 派生）。
      // axis='numeric' → 数值低位巩固：运算数在本行 numberRange 的下半区生成，
      // 报告值仍用原始 numberRange（不动 validator check#4 的语义边界）。
      var vDirectives = Array.isArray(plan && plan.variationDirectives) ? plan.variationDirectives : [];
      var numericSteer = vDirectives.some(function (d) { return d && d.axis === 'numeric'; });
      var genRange = constraints.numberRange;
      if (numericSteer && genRange && typeof genRange.min === 'number' && typeof genRange.max === 'number' &&
          genRange.max > genRange.min) {
        var mid = Math.floor((genRange.min + genRange.max) / 2);
        genRange = { min: genRange.min, max: Math.max(genRange.min, mid) };
      }

      for (var i = 0; i < count; i++) {
        // P28-GEO-NATIVE-02：mixed 的 geometry 行走分数乘法线段/运算律模型
        if (id === 'generator:arithmetic-mixed-calculation' && plan.questionTypeId === 'geometry') {
          questions.push(makeFractionMultiplyGeometryQuestion(plan, context, i, seedFor));
          continue;
        }
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var opSet = context.operationSet || planOperationSet(plan);
        // P28-NAME-MIGRATION-02：kind 来自 plan.semanticParams.kind（SSOT 派生）；
        // op='div' 防御层仅 division 生成器命中，mixed 生成器跳过避免误派生
        var semKind = (op === 'div' && plan.semanticParams) ? plan.semanticParams.kind : null;
        var kind = constraints.kind ||
          ((plan.constraints && plan.constraints.kind) || (plan.kind || null)) || semKind;
        var structure = Arith.buildSpecialKind(rng, { kind: kind, numberRange: genRange });
        if (!structure) {
          structure = Arith.generateStructure(rng, {
            operation: context.operation || planOperationStr(plan) || ((opSet && opSet.filter(function (o) { return o === '+' || o === '−'; }).length === opSet.length) ? 'add' : op),
            operationSet: opSet,
            exactSteps: constraints.exactSteps,
            numberRange: genRange,
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
          // D004 修复：补 answer.explanation，包含运算表达式与结果，供答题页显示解题步骤
          answer: { value: String(answer), acceptable: [], explanation: prompt.replace(' = ?', ' = ' + answer) },
          answerMode: 'input',
          // P28-FORM-CONTRACT-01：声明横向算式作答框内联到等号后（替代渲染器正则识别）
          response: { layout: 'inline-after-equals' },
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
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
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
