/**
 * shared/strategy/strategy-engine.js — M3-17 Strategy Engine (P2 Task 3.1 合并为 8 步)
 *
 * 唯一入口：StrategyEngine.plan(request)
 *
 * 内部顺序固定（8 步）：
 *   1) Request validate
 *   2) KP resolve + Capability inject
 *   3) QuestionType + Cognitive select
 *   4) Difficulty resolve（静态/目标/自适应/学习者）
 *   5) Constraints build（numberRange + structure + spiral + context）
 *   6) Count allocate
 *   7) Generator select
 *   8) Plan validate
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

  // 1) Request validate
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }

  // 2) KP resolve + Capability inject
  var kp = StrategyResolver.resolveKnowledgePoint(request.knowledgePointId);
  var GenRegistry = require('../generator/generator-registry.js');
  kp = GenRegistry.enhanceKp(kp);
  trace.knowledgePoint = kp.id;
  trace.kpCapabilities = kp.capabilities;

  var capability = CapabilityResolver.getCapabilities(kp);
  trace.capabilityQuestionTypes = capability.questionTypes;

  // 3) QuestionType + Cognitive select (合并)
  var questionType = QuestionTypeStrategy.selectQuestionType(kp, {
    questionTypeId: request.questionType != null ? request.questionType : null,
    subtype: request.subtype,
    cognitiveLevel: request.cognitiveLevel
  });
  var cognitiveLevel = CognitiveStrategy.resolveCognitiveLevel({
    knowledgePoint: kp,
    questionType: questionType,
    cognitiveLevel: request.cognitiveLevel
  });
  trace.questionType = questionType;
  trace.cognitiveLevel = cognitiveLevel;

  // 4) Difficulty resolve（合并静态/目标/自适应/学习者）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, questionType, request.customParams);
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

  var learnerDecision = null;
  if (request.learnerProfile && typeof request.learnerProfile === 'object') {
    var LearnerModel = require('../learner/learner-model.js');
    var kpState = null;
    if (request.learnerProfile.knowledgePoints && typeof request.learnerProfile.knowledgePoints === 'object') {
      kpState = LearnerModel.get(request.learnerProfile, kp.id) || null;
    } else if (request.learnerProfile.mastery != null) {
      kpState = request.learnerProfile;
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
  trace.staticDifficulty = staticProfile.level;
  trace.effectiveDifficulty = effectiveDifficulty;

  // 5) Constraints build（合并 numberRange + structure + spiral + context）
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: request.settings,
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    level: effectiveDifficulty
  });

  var structure = StructureConstraints.resolveStructureConstraints({
    knowledgePoint: kp,
    questionType: questionType,
    customParams: request.customParams,
    finalDifficulty: effectiveDifficulty,
    settings: request.settings
  });

  var spiralInputLevel = request.spiral_level;
  if (learnerDecision && request.spiral_level == null) spiralInputLevel = learnerDecision.targetSpiralLevel;
  var spiral = SpiralStrategy.resolveSpiral({
    knowledgePoint: kp,
    spiral_level: spiralInputLevel,
    max_spiral_level: request.max_spiral_level,
    difficulty: effectiveDifficulty,
    cognitiveLevel: cognitiveLevel
  });

  var contextType = ContextStrategy.resolveContextType({
    knowledgePoint: kp,
    questionType: questionType,
    spiralLevel: spiral.spiralLevel,
    cognitiveLevel: cognitiveLevel
  });

  trace.numberRange = numberRange;
  trace.structure = structure;
  trace.spiral = spiral;
  trace.contextType = contextType;

  // 6) Count allocate
  var count = request.count != null ? request.count : 1;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  // 合并约束
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

  // 算术/复杂语义注入（M4-R17/18）
  var KpArith = require('../generator/core/kp-arithmetic-semantics.js');
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  var KpComplex = require('../generator/core/kp-complex-semantics.js');
  var complexSem = KpComplex.resolveComplexSemantics(kp);
  trace.kpArithmeticSemantics = arithSem ? { legacyType: arithSem.legacyType, operators: arithSem.operators, steps: arithSem.steps } : null;
  trace.kpComplexSemantics = complexSem ? { family: complexSem.family, operators: complexSem.operators, steps: complexSem.steps } : null;

  if (arithSem) {
    constraints.operation = arithSem.operators;
    constraints.exactSteps = arithSem.steps;
    if (arithSem.kind) constraints.kind = arithSem.kind;
  }
  if (complexSem) {
    constraints.operation = complexSem.operators;
    constraints.exactSteps = complexSem.steps;
    constraints.allowBracket = complexSem.allowBracket;
    constraints.structure = { family: complexSem.family, inverse: complexSem.inverse };
  }

  // 7) Generator select（在校验前，供 Plan 携带 generator 信息）
  var GeneratorSelector = require('../generator/generator-selector.js');
  var selectedGenerator = GeneratorSelector.selectGenerator({
    knowledgePointId: kp.id,
    questionTypeId: questionType,
    difficulty: effectiveDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    contextType: contextType,
    constraints: constraints,
    legacyPluginId: kp.legacyPluginId
  });

  // 8) QuestionPlan 构建
  var questionPlan = {
    knowledgePointId: kp.id,
    questionTypeId: questionType,
    subtype: request.subtype != null && request.subtype !== '' ? request.subtype : undefined,
    count: count,
    difficulty: effectiveDifficulty,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiral.spiralLevel,
    variationMode: spiral.variationMode,
    contextType: contextType,
    constraints: constraints,
    generator: selectedGenerator
  };
  if (arithSem) {
    questionPlan.operation = arithSem.operators;
  }
  if (complexSem) {
    questionPlan.operation = complexSem.operators;
  }
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

  // Plan validate（步骤 8）
  var check = StrategyValidator.validatePlan(questionPlan);
  if (!check.valid) {
    throw new StrategyError('QuestionPlan 校验失败: ' + check.errors.join('; '), CODES.INVALID_PLAN, { errors: check.errors });
  }

  var result = StrategyResult.createStrategyResult([questionPlan], {
    trace: trace,
    staticLevel: staticProfile.level,
    targetDifficulty: difficulty.targetDifficulty,
    effectiveDifficulty: effectiveDifficulty
  }, []);

  // Debug Trace（保持兼容：request.debug === true）
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

// 浏览器/全局挂载
if (typeof window !== 'undefined') window.StrategyEngine = module.exports;
if (typeof global !== 'undefined') global.StrategyEngine = module.exports;