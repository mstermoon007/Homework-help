/**
 * shared/strategy/strategy-engine.js — M3-17 Strategy Engine
 *
 * 唯一入口：StrategyEngine.plan(request)
 *
 * 内部顺序固定：
 *   Request → KnowledgePoint → Capability → QuestionType → CognitiveLevel
 *   → StaticDifficulty → EffectiveDifficulty → NumberRange → Structure
 *   → Spiral → Context → Count → QuestionPlan → Validator
 *
 * Validator 失败 → 抛 StrategyError（不允许进入 Generator）。
 */
'use strict';

var StrategyRequest = require('./strategy-request.js');
var StrategyResolver = require('./strategy-resolver.js');
var CapabilityResolver = require('../capability-resolver.js');
var QuestionTypeStrategy = require('./question-type-strategy.js');
var CognitiveStrategy = require('./cognitive-strategy.js');
var StaticDifficulty = require('./static-difficulty.js');
var TargetDifficulty = require('./target-difficulty.js');
var NumberRangeStrategy = require('./number-range-strategy.js');
var StructureConstraints = require('./structure-constraints.js');
var SpiralStrategy = require('./spiral-strategy.js');
var ContextStrategy = require('./context-strategy.js');
var ConstraintBuilder = require('./constraint-builder.js');
var StrategyValidator = require('./strategy-validator.js');
var StrategyResult = require('./strategy-result.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;
var AdaptiveStrategy = require('./adaptive-strategy.js');

function plan(request) {
  var trace = {};

  // 1) Request
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }

  // 2) KnowledgePoint（M4-R12：注入 Generator Registry 推导的 capabilities）
  var kp = StrategyResolver.resolveKnowledgePoint(request.knowledgePointId);
  var GenRegistry = require('../generator/generator-registry.js');
  kp = GenRegistry.enhanceKp(kp);
  trace.knowledgePoint = kp.id;
  trace.kpCapabilities = kp.capabilities;

  // 3) Capability
  var capability = CapabilityResolver.getCapabilities(kp);
  trace.capabilityQuestionTypes = capability.questionTypes;

  // 4) QuestionType
  var questionType = QuestionTypeStrategy.selectQuestionType(kp, {
    questionTypeId: request.questionType != null ? request.questionType : null,
    subtype: request.subtype,
    cognitiveLevel: request.cognitiveLevel
  });
  trace.questionType = questionType;

  // 5) CognitiveLevel
  var cognitiveLevel = CognitiveStrategy.resolveCognitiveLevel({
    knowledgePoint: kp,
    questionType: questionType,
    cognitiveLevel: request.cognitiveLevel
  });
  trace.cognitiveLevel = cognitiveLevel;

  // 6) StaticDifficulty
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, questionType, request.customParams);
  trace.staticDifficulty = staticProfile.level;

  // 7) EffectiveDifficulty
  var difficulty = TargetDifficulty.resolveTargetDifficulty({
    knowledgePoint: kp,
    questionType: questionType,
    difficulty: request.difficulty != null ? request.difficulty : null,
    adaptive: request.adaptive === true,
    adaptiveDelta: request.adaptiveDelta != null ? request.adaptiveDelta : 0,
    allowDifficultyOverride: request.allowDifficultyOverride,
    customParams: request.customParams
  });
  var effectiveDifficulty = difficulty.effectiveDifficulty;
  trace.effectiveDifficulty = effectiveDifficulty;

  // M6-R19：Learner Model 自适应接管（仅当调用方显式提供 learnerProfile；无则 legacy 逐字节不变）
  // 依据：速度不直接改 Learner Model；难度/螺旋/变体由 AdaptiveStrategy 一次性决策后传入计划。
  var learnerDecision = null;
  if (request.learnerProfile && typeof request.learnerProfile === 'object') {
    var LearnerModel = require('../learner/learner-model.js');
    var kpState = null;
    if (request.learnerProfile.knowledgePoints && typeof request.learnerProfile.knowledgePoints === 'object') {
      kpState = LearnerModel.get(request.learnerProfile, kp.id) || null;
    } else if (request.learnerProfile.mastery != null) {
      kpState = request.learnerProfile; // 直接给定该 KP 的状态
    }
    var maxSpiral = 6;
    if (kp && kp.spiral && typeof kp.spiral.maxLevel === 'number') maxSpiral = kp.spiral.maxLevel;
    else if (kp && kp.max_spiral_level != null) maxSpiral = kp.max_spiral_level;
    learnerDecision = AdaptiveStrategy.resolve({
      kpId: kp.id,
      learnerState: kpState,
      staticDifficulty: staticProfile.level,
      difficulty: request.difficulty != null ? request.difficulty : null,
      allowDifficultyOverride: request.allowDifficultyOverride,
      adaptiveMode: request.adaptiveMode,
      adaptiveDelta: difficulty.adaptiveDelta,
      maxSpiralLevel: maxSpiral
    });
    if (learnerDecision.effectiveDifficulty != null) {
      effectiveDifficulty = learnerDecision.effectiveDifficulty;
      trace.effectiveDifficulty = effectiveDifficulty;
    }
    trace.learner = {
      kpId: kp.id,
      mode: learnerDecision.mode,
      adjustment: learnerDecision.adjustment,
      mastery: learnerDecision.mastery,
      confidence: learnerDecision.confidence,
      recentAccuracy: learnerDecision.recentAccuracy,
      attempts: learnerDecision.attempts,
      targetSpiralLevel: learnerDecision.targetSpiralLevel,
      variant: learnerDecision.variant,
      errorFocus: learnerDecision.errorFocus
    };
  }

  // 8) NumberRange
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: request.settings,
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    level: effectiveDifficulty
  });
  trace.numberRange = numberRange;

  // 9) Structure
  var structure = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    finalDifficulty: effectiveDifficulty,
    settings: request.settings
  });
  trace.structure = structure;

  // 10) Spiral（有 learner 决策时以 learner 目标螺旋为准，无则走既有规则）
  var spiralInputLevel = request.spiral_level;
  if (learnerDecision && request.spiral_level == null) spiralInputLevel = learnerDecision.targetSpiralLevel;
  var spiral = SpiralStrategy.resolveSpiral({
    knowledgePoint: kp,
    spiral_level: spiralInputLevel,
    max_spiral_level: request.max_spiral_level,
    difficulty: effectiveDifficulty,
    cognitiveLevel: cognitiveLevel
  });
  trace.spiral = spiral;

  // 11) Context
  var contextType = ContextStrategy.resolveContextType({
    knowledgePoint: kp,
    questionType: questionType,
    spiralLevel: spiral.spiralLevel,
    cognitiveLevel: cognitiveLevel
  });
  trace.contextType = contextType;

  // 12) Count
  var count = request.count != null ? request.count : 1;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  // 13) QuestionPlan
  var constraints = ConstraintBuilder.buildConstraints({
    difficulty: effectiveDifficulty,
    questionType: questionType,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    contextType: contextType,
    numberRange: structure.numberRange,
    maxSteps: structure.maxSteps,
    allowBracket: structure.allowBracket,
    allowMultDiv: structure.allowMultDiv
  });

  // M4-R17：KP 级算术语义注入（native 生成器按语义固定算符/步数，不再按难度乱生成多步链）。
  // 仅当 KP 可由纯算术核心覆盖时注入；否则常量语义缺失（native 走难度默认，legacy 走自身 config）。
  var KpArith = require('../generator/core/kp-arithmetic-semantics.js');
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  trace.kpArithmeticSemantics = arithSem ? { legacyType: arithSem.legacyType, operators: arithSem.operators, steps: arithSem.steps } : null;

  // M4-R18：复杂运算语义注入（混合/链式/括号/逆向等 plan-driven 生成器）。
  // complexSem 与 arithSem 互斥（R17 已排除 mixed/chain 等 legacyType），同路径注入 constraints。
  var KpComplex = require('../generator/core/kp-complex-semantics.js');
  var complexSem = KpComplex.resolveComplexSemantics(kp);
  trace.kpComplexSemantics = complexSem ? { family: complexSem.family, operators: complexSem.operators, steps: complexSem.steps } : null;

  var questionPlan = {
    knowledgePointId: kp.id,
    questionTypeId: questionType,
    count: count,
    difficulty: effectiveDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    variationMode: spiral.variationMode,
    contextType: contextType,
    constraints: constraints
  };
  if (arithSem) {
    constraints.operation = arithSem.operators;
    constraints.exactSteps = arithSem.steps;
    questionPlan.operation = arithSem.operators;
  }
  if (complexSem) {
    constraints.operation = complexSem.operators;
    constraints.exactSteps = complexSem.steps;
    constraints.allowBracket = complexSem.allowBracket;
    constraints.structure = { family: complexSem.family, inverse: complexSem.inverse };
    questionPlan.operation = complexSem.operators;
  }
  if (request.subtype != null && request.subtype !== '') questionPlan.subtype = request.subtype;
  if (request.adaptive === true) {
    questionPlan.adaptiveDelta = difficulty.adaptiveDelta;
    questionPlan.targetDifficulty = difficulty.targetDifficulty;
  }
  if (learnerDecision) {
    questionPlan.learner = {
      mode: learnerDecision.mode,
      adjustment: learnerDecision.adjustment,
      mastery: learnerDecision.mastery,
      confidence: learnerDecision.confidence
    };
    questionPlan.variant = learnerDecision.variant;
    questionPlan.errorFocus = learnerDecision.errorFocus;
  }

  // 14) Validator（失败不允许进入 Generator）
  var check = StrategyValidator.validatePlan(questionPlan);
  if (!check.valid) {
    throw new StrategyError('QuestionPlan 校验失败: ' + check.errors.join('; '), CODES.INVALID_PLAN, { errors: check.errors });
  }

  // M4-R13：选择最佳 Generator（禁止 UI 直接选择；由引擎决策）
  var GeneratorSelector = require('../generator/generator-selector.js');
  var selectedGenerator = GeneratorSelector.selectGenerator(questionPlan);
  questionPlan.generator = selectedGenerator;

  var result = StrategyResult.createStrategyResult([questionPlan], {
    trace: trace,
    staticLevel: staticProfile.level,
    targetDifficulty: difficulty.targetDifficulty,
    effectiveDifficulty: effectiveDifficulty
  }, []);

  // M3-22 Debug Trace（开发模式输出：request.debug === true）
  if (request.debug === true) {
    result.strategyTrace = [
      { step: 1, name: 'KP', value: kp.id },
      { step: 2, name: 'Capability', value: capability.questionTypes },
      { step: 3, name: 'QuestionType', value: questionType },
      { step: 4, name: 'Cognitive', value: cognitiveLevel },
      { step: 5, name: 'Static Difficulty', value: staticProfile.level },
      { step: 6, name: 'Adaptive Delta', value: { target: difficulty.targetDifficulty, delta: difficulty.adaptiveDelta, adaptive: difficulty.adaptive } },
      { step: 7, name: 'Effective Difficulty', value: effectiveDifficulty },
      { step: 8, name: 'Structure', value: { maxSteps: structure.maxSteps, allowBracket: structure.allowBracket, allowMultDiv: structure.allowMultDiv } },
      { step: 9, name: 'Spiral', value: spiral.spiralLevel + ' (' + spiral.variationMode + ')' },
      { step: 10, name: 'Context', value: contextType },
      { step: 11, name: 'Count', value: count }
    ];
  }

  var resultCheck = StrategyResult.validateStrategyResult(result);
  if (!resultCheck.valid) {
    throw new StrategyError('StrategyResult 校验失败: ' + resultCheck.errors.join('; '), CODES.INVALID_PLAN, { errors: resultCheck.errors });
  }

  result.valid = true;
  return result;
}

function formatValue(v) {
  if (v == null) return String(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * M3-22：把 strategyTrace 渲染为可读的决策链文本（KP ↓ Capability ↓ … ↓ Count），
 * 便于 AI 编程与人工排查。
 */
function formatStrategyTrace(trace) {
  if (!Array.isArray(trace)) return '';
  return trace.map(function (s) {
    return s.name + ' : ' + formatValue(s.value);
  }).join('\n  ↓\n');
}

module.exports = {
  plan: plan,
  formatStrategyTrace: formatStrategyTrace
};
