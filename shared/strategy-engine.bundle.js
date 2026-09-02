/* 自动生成：node dev/build-strategy-bundle.js（请勿手改） */
/* StrategyEngine 浏览器 bundle：M3-20 接入 practice.html */
(function (global) {
'use strict';
var __defs = {}, __mods = {};
function __req(id) {
  if (__mods[id]) return __mods[id].exports;
  if (!__defs[id]) throw new Error('strategy-bundle: 模块未注册: ' + id);
  var m = { exports: {} };
  __mods[id] = m;
  __defs[id](m, m.exports, __req);
  return m.exports;
}
__defs['node:path'] = function (m) {
  var posix = {
    resolve: function (a, b) { return b ? (a.replace(/\/$/, '') + '/' + b) : a; },
    join: function () {
      var parts = []; for (var i = 0; i < arguments.length; i++) { var p = String(arguments[i]); if (p) parts.push(p.replace(/\/+$/, '')); }
      return parts.join('/');
    },
    dirname: function (p) { var i = p.lastIndexOf('/'); return i === -1 ? '.' : p.slice(0, i); },
    basename: function (p) { var i = p.lastIndexOf('/'); return i === -1 ? p : p.slice(i + 1); },
    extname: function (p) { var b = posix.basename(p); var i = b.lastIndexOf('.'); return i <= 0 ? '' : b.slice(i); },
    normalize: function (p) { return p; }
  };
  posix.posix = posix;
  m.exports = posix;
};
__defs["shared/common.js"] = function (m) {
  if (global.PluginUtil == null) throw new Error('strategy-bundle: 缺少全局 PluginUtil（请先加载对应脚本）');
  m.exports = global.PluginUtil;
};
__defs["shared/difficulty.js"] = function (m) {
  if (global.App.Difficulty == null) throw new Error('strategy-bundle: 缺少全局 App.Difficulty（请先加载对应脚本）');
  m.exports = global.App.Difficulty;
};
__defs["shared/difficulty-static.js"] = function (m) {
  if (global.App.DifficultyStatic == null) throw new Error('strategy-bundle: 缺少全局 App.DifficultyStatic（请先加载对应脚本）');
  m.exports = global.App.DifficultyStatic;
};
__defs["shared/knowledge-bank.js"] = function (m) {
  if (global.KnowledgeBank == null) throw new Error('strategy-bundle: 缺少全局 KnowledgeBank（请先加载对应脚本）');
  m.exports = global.KnowledgeBank;
};
__defs["plugins/registry.js"] = function (m) {
  if (global.PLUGIN_REGISTRY == null) throw new Error('strategy-bundle: 缺少全局 PLUGIN_REGISTRY（请先加载对应脚本）');
  m.exports = global.PLUGIN_REGISTRY;
};
__defs["shared/strategy/strategy-engine.js"] = function (module, exports, require) {
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

var StrategyRequest = require("shared/strategy/strategy-request.js");
var StrategyResolver = require("shared/strategy/strategy-resolver.js");
var CapabilityResolver = require("shared/capability-resolver.js");
var QuestionTypeStrategy = require("shared/strategy/question-type-strategy.js");
var CognitiveStrategy = require("shared/strategy/cognitive-strategy.js");
var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var TargetDifficulty = require("shared/strategy/target-difficulty.js");
var NumberRangeStrategy = require("shared/strategy/number-range-strategy.js");
var StructureConstraints = require("shared/strategy/structure-constraints.js");
var SpiralStrategy = require("shared/strategy/spiral-strategy.js");
var ContextStrategy = require("shared/strategy/context-strategy.js");
var ConstraintBuilder = require("shared/strategy/constraint-builder.js");
var StrategyValidator = require("shared/strategy/strategy-validator.js");
var StrategyResult = require("shared/strategy/strategy-result.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;
var AdaptiveStrategy = require("shared/strategy/adaptive-strategy.js");

function plan(request) {
  var trace = {};

  // 1) Request
  var reqCheck = StrategyRequest.validateRequest(request);
  if (!reqCheck.valid) {
    throw new StrategyError('Request 非法: ' + reqCheck.errors.join('; '), CODES.INVALID_REQUEST, { errors: reqCheck.errors });
  }

  // 2) KnowledgePoint（M4-R12：注入 Generator Registry 推导的 capabilities）
  var kp = StrategyResolver.resolveKnowledgePoint(request.knowledgePointId);
  var GenRegistry = require("shared/generator/generator-registry.js");
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
    var LearnerModel = require("shared/learner/learner-model.js");
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
  var KpArith = require("shared/generator/core/kp-arithmetic-semantics.js");
  var arithSem = KpArith.resolveArithmeticSemantics(kp);
  trace.kpArithmeticSemantics = arithSem ? { legacyType: arithSem.legacyType, operators: arithSem.operators, steps: arithSem.steps } : null;

  // M4-R18：复杂运算语义注入（混合/链式/括号/逆向等 plan-driven 生成器）。
  // complexSem 与 arithSem 互斥（R17 已排除 mixed/chain 等 legacyType），同路径注入 constraints。
  var KpComplex = require("shared/generator/core/kp-complex-semantics.js");
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
    if (arithSem.kind) constraints.kind = arithSem.kind;
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
  var GeneratorSelector = require("shared/generator/generator-selector.js");
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

};
__defs["shared/strategy/legacy-adapter.js"] = function (module, exports, require) {
/**
 * shared/strategy/legacy-adapter.js — M3-19 Legacy Adapter
 *
 * QuestionPlan → 旧 Plugin options（映射层，不修改插件内部逻辑）
 *
 * 映射：
 *   {
 *     difficulty,                       // plan.difficulty
 *     difficultyParams: {               // Generator 已算好的难度参数
 *       level, scale, steps, allowBracket, allowMultDiv
 *     },
 *     maxNum,                           // constraints.numberRange.max
 *     questionType,                     // 标准 questionTypeId
 *     subtype,                          // legacy 子题型（plan.subtype）
 *     cognitiveLevel,                   // M3 新增
 *     spiralLevel,                      // M3 新增
 *     contextType                       // M3 新增
 *   }
 *
 * extra 透传（UI 原样字段）：grade / count / type / settings / settingNums。
 */
'use strict';

var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function adaptPlanToLegacyOptions(plan, extra) {
  plan = plan || {};
  extra = extra || {};

  if (!plan.difficulty) {
    throw new StrategyError('LegacyAdapter: plan 缺少 difficulty', CODES.INVALID_PLAN);
  }
  if (!plan.questionTypeId) {
    throw new StrategyError('LegacyAdapter: plan 缺少 questionTypeId', CODES.INVALID_PLAN);
  }
  var constraints = plan.constraints || {};

  var options = {};

  options.difficulty = plan.difficulty;

  options.difficultyParams = {
    level: plan.difficulty,
    scale: constraints.scale != null ? constraints.scale : 1,
    steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
    allowBracket: !!constraints.allowBracket,
    allowMultDiv: !!constraints.allowMultDiv
  };

  if (constraints.numberRange && constraints.numberRange.max != null) {
    options.maxNum = constraints.numberRange.max;
  }

  options.questionType = plan.questionTypeId;

  if (plan.subtype != null && plan.subtype !== '') options.subtype = plan.subtype;

  // M3 新增字段
  if (plan.cognitiveLevel != null) options.cognitiveLevel = plan.cognitiveLevel;
  if (plan.spiralLevel != null) options.spiralLevel = plan.spiralLevel;
  if (plan.contextType != null) options.contextType = plan.contextType;

  // UI 透传
  if (extra.grade != null) options.grade = extra.grade;
  // count：以 Plan 为准（M3-21 ⑦ 必须从 Strategy 流入），extra.count 仅作回退
  if (plan.count != null) options.count = plan.count;
  else if (extra.count != null) options.count = extra.count;
  if (extra.type != null && extra.type !== '') options.type = extra.type;
  // M4-R17：语义级算符集直传（与 native 共享 KP 语义，保证文本算数对照一致）
  // 字形归一化到 legacy 期望字形：−(U+2212)→'-'，×/÷ 保持
  if (Array.isArray(extra.operators) && extra.operators.length) {
    options.operators = extra.operators.map(function (op) {
      if (op === '\u2212' || op === '\u2013' || op === '\uff0d') return '-';
      return op;
    });
  }
  Object.keys(extra.settings || {}).forEach(function (k) {
    if (k === 'type') return;
    var v = extra.settings[k];
    if (v !== '' && v != null) options[k] = v;
  });
  Object.keys(extra.settingNums || {}).forEach(function (k) {
    var v = extra.settingNums[k];
    if (v !== '' && v != null) options[k] = v;
  });

  return options;
}

module.exports = {
  adaptPlanToLegacyOptions: adaptPlanToLegacyOptions
};

};
__defs["shared/strategy/strategy-config.js"] = function (module, exports, require) {
  module.exports = null;
};
__defs["shared/strategy/question-type-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/question-type-strategy.js — M3-06 Question Type Strategy
 *
 * 题型决策优先级（输出 questionTypeId）：
 *   ① 用户明确指定 questionType   —— 合法且 KP 支持 → 直接返回；KP 不支持 → 拒绝（抛错）
 *   ② Capability 支持的指定 subtype —— 归一化 legacy subtype，受支持 → 返回；否则落到下一级
 *   ③ CognitiveLevel 匹配         —— 在受支持题型中找第一个认知层级匹配者
 *   ④ KP 默认题型                 —— presentation.questionTypes 顺序中的第一个受支持题型
 *   ⑤ Registry 默认题型           —— 优先 'calc'，否则受支持列表首项
 *
 * 不变式：输出必须属于该 KP 的受支持题型集合；KP 无任何受支持题型 → NO_CAPABILITY。
 */
'use strict';

var Registry = require("shared/question-type-registry.js");
var Resolver = require("shared/capability-resolver.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function selectQuestionType(kp, options) {
  options = options || {};

  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KP 不能为空', CODES.INVALID_REQUEST);
  }

  var supported = supportedTypes(kp);

  // ① 用户明确指定 questionType
  if (options.questionTypeId != null) {
    var requested = options.questionTypeId;
    if (!Registry.has(requested)) {
      throw new StrategyError('非法 questionTypeId: ' + requested, CODES.INVALID_REQUEST, { questionTypeId: requested });
    }
    if (supported.indexOf(requested) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + requested, CODES.NO_CAPABILITY, { questionTypeId: requested, knowledgePointId: kp.id });
    }
    return requested;
  }

  // ② Capability 支持的指定 subtype
  if (options.subtype != null) {
    var normalized = Registry.normalizeQuestionType(options.subtype);
    if (normalized && normalized.id && supported.indexOf(normalized.id) !== -1) {
      return normalized.id;
    }
  }

  // ③ CognitiveLevel 匹配
  if (options.cognitiveLevel != null) {
    var matched = matchByCognitiveLevel(supported, options.cognitiveLevel);
    if (matched) return matched;
  }

  // ④ KP 默认题型
  var defaultFromKP = getDefaultFromKP(kp, supported);
  if (defaultFromKP) return defaultFromKP;

  // ⑤ Registry 默认题型
  return getRegistryDefault(kp, supported);
}

function supportedTypes(kp) {
  return Resolver.getCapabilities(kp).questionTypes || [];
}

function matchByCognitiveLevel(supported, level) {
  if (typeof level !== 'string') return null;
  for (var i = 0; i < supported.length; i++) {
    var t = Registry.get(supported[i]);
    if (t && t.cognitiveLevels && t.cognitiveLevels.indexOf(level) !== -1) {
      return supported[i];
    }
  }
  return null;
}

function getDefaultFromKP(kp, supported) {
  var qts = kp && kp.presentation && kp.presentation.questionTypes;
  if (!Array.isArray(qts)) return null;
  for (var i = 0; i < qts.length; i++) {
    var token = qts[i] && (qts[i].rawType || qts[i].type);
    if (!token) continue;
    var norm = Registry.normalizeQuestionType(token);
    if (norm && norm.id && supported.indexOf(norm.id) !== -1) return norm.id;
  }
  return null;
}

function getRegistryDefault(kp, supported) {
  if (supported.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }
  if (supported.indexOf('calc') !== -1) return 'calc';
  return supported[0];
}

module.exports = {
  selectQuestionType: selectQuestionType,
  supportedTypes: supportedTypes,
  matchByCognitiveLevel: matchByCognitiveLevel,
  getDefaultFromKP: getDefaultFromKP,
  getRegistryDefault: getRegistryDefault
};

};
__defs["shared/strategy/question-type-allocation.js"] = function (module, exports, require) {
/**
 * shared/strategy/question-type-allocation.js — M3-07 Question Type Allocation
 *
 * 处理 count > 1 的题型分配：
 *   例：10 题 → oral 4 / fill 3 / choice 3
 *
 * 分配算法（最大余数法，确定性）：
 *   base = floor(count / n)，rem = count % n
 *   优先级靠前的题型多拿 rem 中的 1 题（优先级由 M3-06 决策的题型置顶）
 *
 * 不变式（硬性要求）：
 *   sum(plan.count) === request.count
 *   不得出现 9 题 / 11 题；违反即抛 StrategyError。
 */
'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var QuestionTypeStrategy = require("shared/strategy/question-type-strategy.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function allocateQuestionTypes(options) {
  options = options || {};

  var count = options.count;
  if (typeof count !== 'number' || !isFinite(count) || count < 1 || Math.floor(count) !== count) {
    throw new StrategyError('count 必须是 >=1 的整数: ' + count, CODES.INVALID_REQUEST, { count: count });
  }

  var kp = null;
  if (options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  } else if (options.kp != null) {
    kp = options.kp;
  }

  // 1) 确定候选题型（保持优先级顺序，靠前者优先获得余数）
  var candidateTypes;
  if (Array.isArray(options.questionTypes) && options.questionTypes.length > 0) {
    candidateTypes = options.questionTypes.slice();
  } else if (kp) {
    candidateTypes = QuestionTypeStrategy.supportedTypes(kp);
  } else {
    throw new StrategyError('缺少候选题型：请提供 questionTypes 或 knowledgePointId/kp', CODES.INVALID_REQUEST);
  }

  // 2) 校验 + 去重（保持顺序）
  var seen = {};
  candidateTypes = candidateTypes.filter(function (t) {
    if (seen[t]) return false;
    seen[t] = true;
    return true;
  });
  candidateTypes.forEach(function (t) {
    if (!Registry.has(t)) {
      throw new StrategyError('非法 questionTypeId: ' + t, CODES.INVALID_REQUEST, { questionTypeId: t });
    }
    if (kp && QuestionTypeStrategy.supportedTypes(kp).indexOf(t) === -1) {
      throw new StrategyError('KP 不支持该题型: ' + t, CODES.NO_CAPABILITY, { questionTypeId: t, knowledgePointId: kp.id });
    }
  });
  if (candidateTypes.length === 0) {
    throw new StrategyError('KP 无任何受支持题型: ' + (kp && kp.id), CODES.NO_CAPABILITY, { knowledgePointId: kp && kp.id });
  }

  // 3) M3-06 决策的题型置顶（获得余数优先权）
  if (kp && candidateTypes.length > 1) {
    var preferred = QuestionTypeStrategy.selectQuestionType(kp, options);
    var idx = candidateTypes.indexOf(preferred);
    if (idx > 0) {
      candidateTypes.splice(idx, 1);
      candidateTypes.unshift(preferred);
    }
  }

  // 4) 最大余数分配
  var plans = distribute(count, candidateTypes);

  // 5) 不变式：sum(plan.count) === request.count
  var total = plans.reduce(function (n, p) { return n + p.count; }, 0);
  if (total !== count) {
    throw new StrategyError('分配不变式被破坏: sum=' + total + ' !== count=' + count, CODES.INVALID_PLAN, { total: total, count: count });
  }

  return {
    requestCount: count,
    total: total,
    plans: plans.map(function (p) {
      return {
        knowledgePointId: kp ? kp.id : (options.knowledgePointId || null),
        questionTypeId: p.questionTypeId,
        count: p.count
      };
    })
  };
}

function distribute(count, types) {
  var n = types.length;
  var base = Math.floor(count / n);
  var rem = count % n;
  var plans = [];
  for (var i = 0; i < n; i++) {
    var c = base + (i < rem ? 1 : 0);
    if (c > 0) plans.push({ questionTypeId: types[i], count: c });
  }
  return plans;
}

function validateAllocation(plans, requestCount) {
  var errors = [];
  if (!Array.isArray(plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }
  var sum = 0;
  plans.forEach(function (p, i) {
    if (!p || typeof p !== 'object') { errors.push('plan[' + i + '] 必须是对象'); return; }
    if (typeof p.questionTypeId !== 'string') errors.push('plan[' + i + '] 缺少 questionTypeId');
    if (typeof p.count !== 'number' || p.count < 1 || Math.floor(p.count) !== p.count) {
      errors.push('plan[' + i + '] count 必须是 >=1 的整数');
    } else {
      sum += p.count;
    }
  });
  if (sum !== requestCount) {
    errors.push('分配总数 ' + sum + ' !== 请求数 ' + requestCount);
  }
  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  allocateQuestionTypes: allocateQuestionTypes,
  distribute: distribute,
  validateAllocation: validateAllocation
};

};
__defs["shared/strategy/static-difficulty.js"] = function (module, exports, require) {
/**
 * shared/strategy/static-difficulty.js — M3-08 Static Difficulty 接入层
 *
 * 接入现有静态多维难度引擎 DifficultyStatic.paramsForKnowledgePoint(...)，
 * 禁止重新实现 7 维难度公式（G/S/C/T/St/N/A 合成与权重一律由 difficulty-static.js 负责）。
 *
 * 输入：
 *   knowledgePoint  — Canonical KnowledgePoint（StrategyResolver 产出）
 *   questionType    — 标准 questionTypeId
 *   customParams    — 自定义覆盖（scale/steps 等生成参数）
 *
 * 适配：引擎期望 legacy 元数据字段（difficulty / spiral_level / cognitive_level /
 * number_range_default / max_steps_default / context_default / applicable_question_types），
 * 本层将 Canonical KP 映射为该形状（toEngineMeta），不改动引擎内部公式。
 *
 * 输出：
 *   { level, scale, steps, allowBracket, allowMultDiv, staticMeta }
 */
'use strict';

var DifficultyStatic = require("shared/difficulty-static.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

/**
 * Canonical KnowledgePoint → 引擎期望的 legacy 元数据形状。
 * 纯字段映射；缺失字段回落到引擎缺省语义（difficulty 3 / cognitive 掌握 / standard 情境）。
 */
function toEngineMeta(kp) {
  var meta = {};
  meta.difficulty = (kp.legacy && typeof kp.legacy.difficulty === 'number')
    ? kp.legacy.difficulty : 3;
  meta.spiral_level = (kp.spiral && typeof kp.spiral.level === 'number')
    ? kp.spiral.level : 1;
  meta.max_spiral_level = (kp.spiral && typeof kp.spiral.maxLevel === 'number')
    ? kp.spiral.maxLevel : 1;
  meta.cognitive_level = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level) || null;
  meta.max_steps_default = (kp.structure && typeof kp.structure.maxSteps === 'number')
    ? kp.structure.maxSteps : 1;
  meta.number_range_default = (kp.numeric && kp.numeric.range) || null;
  meta.context_default = (kp.context && kp.context.defaults && kp.context.defaults[0]) || null;
  meta.applicable_question_types = ((kp.presentation && kp.presentation.questionTypes) || []).map(function (q) {
    return { type: q.type || q.rawType, coefficient: q.weight != null ? q.weight : 1 };
  });
  return meta;
}

function resolveStaticDifficulty(knowledgePoint, questionType, customParams) {
  if (!knowledgePoint || typeof knowledgePoint !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空', CODES.INVALID_REQUEST);
  }

  // 7 维难度公式唯一入口：difficulty-static.js
  var profile = DifficultyStatic.paramsForKnowledgePoint(
    toEngineMeta(knowledgePoint), questionType, customParams);

  return {
    level: profile.level,
    scale: profile.scale,
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    allowMultDiv: !!profile.allowMultDiv,
    staticMeta: profile.staticMeta
  };
}

module.exports = {
  toEngineMeta: toEngineMeta,
  resolveStaticDifficulty: resolveStaticDifficulty
};

};
__defs["shared/strategy/difficulty-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/difficulty-strategy.js — M3-09 Effective Difficulty
 *
 * 有效难度 = 静态多维难度 + 学习者自适应调整：
 *
 *   Static Difficulty (M3-08)
 *            +
 *   Learner Adjustment (adaptiveDelta)
 *            ↓
 *   Effective Difficulty
 *
 * 第一版公式：
 *   effectiveDifficulty = staticLevel + adaptiveDelta
 *   clamp(effectiveDifficulty, 1, 10)
 *
 * adaptiveDelta 缺省为 0（无调整）。
 */
'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;

/**
 * 有效难度 v1 核心公式（唯一实现处，M3-10 复用）：
 *   effectiveDifficulty = clamp(baseLevel + adaptiveDelta, 1, 10)
 */
function applyEffective(baseLevel, adaptiveDelta) {
  if (typeof baseLevel !== 'number' || !isFinite(baseLevel)) {
    throw new StrategyError('baseLevel 必须是有限数字: ' + baseLevel, CODES.INVALID_REQUEST, { baseLevel: baseLevel });
  }
  var delta = adaptiveDelta == null ? 0 : adaptiveDelta;
  if (typeof delta !== 'number' || !isFinite(delta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + delta, CODES.INVALID_REQUEST, { adaptiveDelta: delta });
  }
  var raw = baseLevel + delta;
  var clamped = Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, raw));
  return Math.round(clamped);
}

function computeEffectiveDifficulty(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  var adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  if (typeof adaptiveDelta !== 'number' || !isFinite(adaptiveDelta)) {
    throw new StrategyError('adaptiveDelta 必须是有限数字: ' + adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: adaptiveDelta });
  }

  // Static Difficulty（M3-08，唯一公式入口）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
  var staticLevel = staticProfile.level;

  // Effective Difficulty v1
  var raw = staticLevel + adaptiveDelta;
  var effectiveDifficulty = applyEffective(staticLevel, adaptiveDelta);

  return {
    staticLevel: staticLevel,
    adaptiveDelta: adaptiveDelta,
    raw: raw,
    effectiveDifficulty: effectiveDifficulty,
    static: staticProfile
  };
}

module.exports = {
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  applyEffective: applyEffective,
  computeEffectiveDifficulty: computeEffectiveDifficulty
};

};
__defs["shared/strategy/target-difficulty.js"] = function (module, exports, require) {
/**
 * shared/strategy/target-difficulty.js — M3-10 Target Difficulty（用户显式难度处理）
 *
 * 明确规则（v1，插件不得自行判断，必须经本模块）：
 *
 *   普通单知识点练习：
 *
 *   1) 用户明确选择难度（request.difficulty != null）
 *        ├─ allowDifficultyOverride !== false → targetDifficulty = clamp(difficulty, 1, 10)
 *        │                                     source = 'user'
 *        └─ 不允许覆盖                       → targetDifficulty = staticDifficulty
 *                                              source = 'static'
 *
 *   2) 用户未选择难度
 *        → KnowledgePoint → StaticDifficulty (M3-08)
 *        → targetDifficulty = staticLevel
 *        → source = 'static'
 *
 *   3) 自适应（adaptive === true）
 *        → effectiveDifficulty = clamp(targetDifficulty + adaptiveDelta, 1, 10)
 *        （核心公式复用 difficulty-strategy.applyEffective，M3-09）
 *
 *   4) 自适应关闭（缺省）
 *        → effectiveDifficulty = targetDifficulty
 */
'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var DifficultyStrategy = require("shared/strategy/difficulty-strategy.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var DIFFICULTY_MIN = DifficultyStrategy.DIFFICULTY_MIN;
var DIFFICULTY_MAX = DifficultyStrategy.DIFFICULTY_MAX;

function clampUserDifficulty(n) {
  return Math.min(DIFFICULTY_MAX, Math.max(DIFFICULTY_MIN, Math.round(Number(n))));
}

function resolveTargetDifficulty(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  var staticDifficulty = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams).level;

  // 1) 用户显式难度 + 覆盖判定
  var allowOverride = options.allowDifficultyOverride !== false;
  var targetDifficulty;
  var source;
  var requestedDifficulty = null;

  if (options.difficulty != null) {
    if (typeof options.difficulty !== 'number' || !isFinite(options.difficulty)) {
      throw new StrategyError('difficulty 必须是有限数字: ' + options.difficulty, CODES.INVALID_REQUEST, { difficulty: options.difficulty });
    }
    requestedDifficulty = clampUserDifficulty(options.difficulty);
    if (allowOverride) {
      targetDifficulty = requestedDifficulty;
      source = 'user';
    } else {
      targetDifficulty = staticDifficulty;
      source = 'static';
    }
  } else {
    targetDifficulty = staticDifficulty;
    source = 'static';
  }

  // 2) 自适应调整
  var adaptive = options.adaptive === true;
  var adaptiveDelta = 0;
  if (adaptive) {
    if (options.adaptiveDelta != null && (typeof options.adaptiveDelta !== 'number' || !isFinite(options.adaptiveDelta))) {
      throw new StrategyError('adaptiveDelta 必须是有限数字: ' + options.adaptiveDelta, CODES.INVALID_REQUEST, { adaptiveDelta: options.adaptiveDelta });
    }
    adaptiveDelta = options.adaptiveDelta == null ? 0 : options.adaptiveDelta;
  }

  var effectiveDifficulty = adaptive
    ? DifficultyStrategy.applyEffective(targetDifficulty, adaptiveDelta)
    : targetDifficulty;

  return {
    targetDifficulty: targetDifficulty,
    source: source,
    requestedDifficulty: requestedDifficulty,
    allowOverride: allowOverride,
    adaptive: adaptive,
    adaptiveDelta: adaptiveDelta,
    effectiveDifficulty: effectiveDifficulty,
    staticDifficulty: staticDifficulty
  };
}

module.exports = {
  resolveTargetDifficulty: resolveTargetDifficulty,
  clampUserDifficulty: clampUserDifficulty
};

};
__defs["shared/strategy/structure-constraints.js"] = function (module, exports, require) {
/**
 * shared/strategy/structure-constraints.js — M3-11 Difficulty → Structure Constraints
 *
 * 将最终难度（target/effective，M3-10/09 产出）转换为结构约束：
 *
 *   constraints: {
 *     maxSteps,       // ← difficulty-static.js 已有逻辑（steps）
 *     allowBracket,   // ← difficulty-static.js 已有逻辑
 *     allowMultDiv,   // ← difficulty-static.js 已有逻辑
 *     numberRange     // ← M3-12 number-range-strategy
 *   }
 *
 * 规则：
 *   - 最终难度 === 静态难度 → 直接复用 difficulty-static.js 产出的 steps/allowBracket/allowMultDiv
 *   - 最终难度 !== 静态难度 → 复用 difficulty-static.js 内部的既有调用链
 *     Difficulty.paramsFor('math', level)（不复制 difficulty.js 的结构分档规则，只调用）
 */
'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var NumberRangeStrategy = require("shared/strategy/number-range-strategy.js");
var Difficulty = require("shared/difficulty.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function clampFinalLevel(level) {
  return Math.min(10, Math.max(1, Math.round(Number(level))));
}

function resolveStructureConstraints(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }
  if (!kp || typeof kp !== 'object') {
    throw new StrategyError('KnowledgePoint 不能为空（knowledgePoint 或 knowledgePointId）', CODES.INVALID_REQUEST);
  }

  // 静态难度 profile（difficulty-static.js 已有逻辑，优先使用）
  var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);

  var finalLevel;
  if (options.finalDifficulty != null) {
    if (typeof options.finalDifficulty !== 'number' || !isFinite(options.finalDifficulty)) {
      throw new StrategyError('finalDifficulty 必须是有限数字: ' + options.finalDifficulty, CODES.INVALID_REQUEST, { finalDifficulty: options.finalDifficulty });
    }
    finalLevel = clampFinalLevel(options.finalDifficulty);
  } else {
    finalLevel = staticProfile.level;
  }

  var maxSteps;
  var allowBracket;
  var allowMultDiv;

  if (finalLevel === staticProfile.level) {
    // 优先：difficulty-static.js 已有逻辑
    maxSteps = staticProfile.steps;
    allowBracket = staticProfile.allowBracket;
    allowMultDiv = staticProfile.allowMultDiv;
  } else {
    // 复用 difficulty-static.js 内部既有调用链（Difficulty.paramsFor），不复制结构分档表
    var params = Difficulty.paramsFor('math', finalLevel);
    maxSteps = params.steps;
    allowBracket = !!params.allowBracket;
    allowMultDiv = !!params.allowMultDiv;
  }

  // M3-12 数值范围
  var numberRange = NumberRangeStrategy.resolveNumberRange({
    settings: options.settings,
    knowledgePoint: kp,
    questionType: options.questionType,
    customParams: options.customParams,
    level: finalLevel
  });

  return {
    finalDifficulty: finalLevel,
    maxSteps: maxSteps,
    allowBracket: allowBracket,
    allowMultDiv: allowMultDiv,
    numberRange: { min: numberRange.min, max: numberRange.max }
  };
}

module.exports = {
  resolveStructureConstraints: resolveStructureConstraints,
  clampFinalLevel: clampFinalLevel
};

};
__defs["shared/strategy/number-range-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/number-range-strategy.js — M3-12 Number Range Strategy
 *
 * 数值范围优先级（自上而下取第一个有效来源）：
 *   ① 用户 settings.numberRange
 *   ② KnowledgePoint numberRangeDefault
 *   ③ DifficultyStatic（静态难度 profile → scale → diffMax）
 *   ④ Difficulty Profile（difficulty.js 科目 profile → scale → diffMax）
 *
 * 输出：
 *   numberRange: { min, max }
 *
 * 不变式：min <= max（违反时交换并记录）。
 */
'use strict';

var StaticDifficulty = require("shared/strategy/static-difficulty.js");
var Difficulty = require("shared/difficulty.js");
var PluginUtil = require("shared/common.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var BASE_MAX = 20; // 难度档 3 的基准最大值（与 consumeProfile('expression').maxOperand 一致）

function isValidRange(r) {
  return !!r && typeof r === 'object' &&
    typeof r.min === 'number' && isFinite(r.min) &&
    typeof r.max === 'number' && isFinite(r.max);
}

function normalizeRange(min, max, source) {
  if (min > max) {
    var t = min; min = max; max = t;
  }
  return { min: min, max: max, source: source };
}

function resolveNumberRange(options) {
  options = options || {};

  // ① 用户 settings
  var userRange = options.settings && options.settings.numberRange;
  if (isValidRange(userRange)) {
    return normalizeRange(userRange.min, userRange.max, 'user-settings');
  }

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  // ② KnowledgePoint numberRangeDefault（Canonical: numeric.range；Legacy: number_range_default）
  var kpRange = kp && (kp.numeric && kp.numeric.range ? kp.numeric.range : kp.number_range_default);
  if (isValidRange(kpRange)) {
    return normalizeRange(kpRange.min, kpRange.max, 'knowledge-point');
  }

  // ③ DifficultyStatic（静态难度 profile 的 scale）
  if (kp) {
    var staticProfile = StaticDifficulty.resolveStaticDifficulty(kp, options.questionType, options.customParams);
    if (staticProfile && typeof staticProfile.scale === 'number') {
      return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, staticProfile.level), 'difficulty-static');
    }
  }

  // ④ Difficulty Profile（difficulty.js 按 level → scale → diffMax）
  var level = options.level != null ? options.level : 3;
  var profile = Difficulty.paramsFor('math', level);
  return normalizeRange(1, PluginUtil.diffMax(BASE_MAX, profile.level), 'difficulty-profile');
}

module.exports = {
  resolveNumberRange: resolveNumberRange,
  isValidRange: isValidRange,
  normalizeRange: normalizeRange,
  BASE_MAX: BASE_MAX
};

};
__defs["shared/strategy/cognitive-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/cognitive-strategy.js — M3-13 Cognitive Level Strategy
 *
 * 认知层级决策优先级：
 *   ① 用户/策略明确指定 cognitiveLevel
 *        └─ 必须来自 Registry.COGNITIVE_LEVELS（不重新定义枚举）
 *        └─ 归一化到统一三层 recognize / understand / apply
 *        └─ 若题型支持范围不含该层级 → 落入后续判定
 *   ② QuestionType 支持范围 —— 作为候选范围过滤 ③④
 *   ③ KnowledgePoint cognitiveLevel（cognition.raw → 统一三层）
 *   ④ 默认认知层级 —— 优先 understand，在题型支持范围内选择
 *
 * 输出：cognitiveLevel ∈ { recognize, understand, apply }
 */
'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

// 唯一认知枚举来源（不得重新定义）
var ENUM = Registry.COGNITIVE_LEVELS;

// 统一三层（均为 Registry 枚举子集）
var UNIFIED_LEVELS = ['recognize', 'understand', 'apply'];
UNIFIED_LEVELS.forEach(function (l) {
  if (ENUM.indexOf(l) === -1) {
    throw new Error('cognitive-strategy: 统一层级 ' + l + ' 不在 Registry.COGNITIVE_LEVELS 中');
  }
});

// 完整枚举 → 统一三层
var FULL_TO_UNIFIED = {
  recall: 'recognize', recognize: 'recognize',
  understand: 'understand',
  apply: 'apply', analyze: 'apply', evaluate: 'apply', create: 'apply'
};

// KB 中文认知层级 → 统一三层
var KP_RAW_TO_UNIFIED = {
  '了解': 'recognize',
  '理解': 'understand',
  '掌握': 'apply',
  '运用': 'apply'
};

function toUnified(level) {
  if (typeof level !== 'string') return null;
  if (UNIFIED_LEVELS.indexOf(level) !== -1) return level;
  return FULL_TO_UNIFIED[level] || null;
}

function kpToUnified(kp) {
  var raw = (kp.cognition && kp.cognition.raw) ||
    (kp.legacy && kp.legacy.cognitive_level);
  if (raw) {
    if (KP_RAW_TO_UNIFIED[raw]) return KP_RAW_TO_UNIFIED[raw];
    if (ENUM.indexOf(raw) !== -1) return toUnified(raw);
  }
  var num = kp.cognition && kp.cognition.level;
  if (typeof num === 'number' && isFinite(num)) {
    if (num >= 0.67) return 'apply';
    if (num >= 0.33) return 'understand';
    return 'recognize';
  }
  return null;
}

function supportedUnifiedSet(typeId) {
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }
  var set = {};
  (t.cognitiveLevels || []).forEach(function (l) {
    var u = toUnified(l);
    if (u) set[u] = true;
  });
  return set;
}

function resolveCognitiveLevel(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  // ② QuestionType 支持范围（过滤 + 兜底候选）
  var typeId = options.questionType || options.questionTypeId || null;
  var allowed = typeId ? supportedUnifiedSet(typeId) : null;

  // ① 用户/策略明确指定
  if (options.cognitiveLevel != null) {
    if (typeof options.cognitiveLevel !== 'string' || ENUM.indexOf(options.cognitiveLevel) === -1) {
      throw new StrategyError('非法 cognitiveLevel（必须来自 Registry.COGNITIVE_LEVELS）: ' + options.cognitiveLevel, CODES.INVALID_REQUEST, { cognitiveLevel: options.cognitiveLevel });
    }
    var mapped = toUnified(options.cognitiveLevel);
    if (!allowed || allowed[mapped]) return mapped;
    // 不在题型支持范围内 → 落入 ③④
  }

  // ③ KnowledgePoint cognitiveLevel（受题型支持范围过滤）
  if (kp) {
    var kpLevel = kpToUnified(kp);
    if (kpLevel && (!allowed || allowed[kpLevel])) return kpLevel;
  }

  // ④ 默认认知层级（优先 understand，在支持范围内选择）
  if (allowed) {
    var order = ['understand', 'recognize', 'apply'];
    for (var i = 0; i < order.length; i++) {
      if (allowed[order[i]]) return order[i];
    }
    for (i = 0; i < UNIFIED_LEVELS.length; i++) {
      if (allowed[UNIFIED_LEVELS[i]]) return UNIFIED_LEVELS[i];
    }
  }
  return 'understand';
}

module.exports = {
  UNIFIED_LEVELS: UNIFIED_LEVELS,
  toUnified: toUnified,
  kpToUnified: kpToUnified,
  supportedUnifiedSet: supportedUnifiedSet,
  resolveCognitiveLevel: resolveCognitiveLevel
};

};
__defs["shared/strategy/spiral-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/spiral-strategy.js — M3-14 Spiral Strategy
 *
 * 输入：
 *   spiral_level / max_spiral_level（或 knowledgePoint）
 *   difficulty / cognitiveLevel（第一版保留输入，不参与固定映射）
 *
 * 输出：
 *   { spiralLevel, variationMode }
 *
 * 第一版固定映射：
 *   S1 → prototype   S2 → numeric     S3 → presentation
 *   S4 → context     S5 → structure   S6 → transfer
 *
 * 不变式：spiralLevel 不得超过 max_spiral_level；超过 S6 的层级 variationMode 固定 transfer。
 */
'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

var MODES = ['prototype', 'numeric', 'presentation', 'context', 'structure', 'transfer'];
var MODE_MAX = MODES.length; // S6

function toIntOr(n, fallback) {
  n = Number(n);
  if (!isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

function resolveSpiral(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var spiral = options.spiral_level != null ? options.spiral_level : options.spiralLevel;
  if (spiral == null && kp) {
    spiral = (kp.spiral && kp.spiral.level != null) ? kp.spiral.level : kp.spiral_level;
  }
  var maxSpiral = options.max_spiral_level != null ? options.max_spiral_level : options.maxSpiralLevel;
  if (maxSpiral == null && kp) {
    maxSpiral = (kp.spiral && kp.spiral.maxLevel != null) ? kp.spiral.maxLevel : kp.max_spiral_level;
  }

  var spiralLevel = toIntOr(spiral, 1);
  var maxLevel = toIntOr(maxSpiral, 1);

  // 不变式：不得超过 max_spiral_level
  if (spiralLevel > maxLevel) spiralLevel = maxLevel;

  var modeIdx = Math.min(spiralLevel, MODE_MAX) - 1;
  var variationMode = MODES[modeIdx];

  return {
    spiralLevel: spiralLevel,
    variationMode: variationMode
  };
}

module.exports = {
  MODES: MODES,
  resolveSpiral: resolveSpiral
};

};
__defs["shared/strategy/context-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/context-strategy.js — M3-15 Context Strategy
 *
 * 情境类型决策规则：
 *   1) QuestionType 不支持 context → 'none'
 *   2) 支持 context → 使用 KP contextDefault
 *   3) 高螺旋（spiralLevel >= 4）/ 应用认知（unified 'apply'）
 *      → 允许提高情境复杂度（+1 档，封顶 complex）
 *
 * 输出：contextType
 *
 * 第一版只使用项目已有情境枚举：pure / simple / standard / complex
 * （来源：difficulty-static.js CONTEXT_MAP / question-plan.js VALID_CONTEXT_TYPES）
 */
'use strict';

var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var CognitiveStrategy = require("shared/strategy/cognitive-strategy.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

// 项目已有情境枚举（不新增枚举值）
var CONTEXT_TIERS = ['pure', 'simple', 'standard', 'complex'];
var HIGH_SPIRAL_THRESHOLD = 4; // M3-14：S4 → context

function resolveContextType(options) {
  options = options || {};

  var kp = options.knowledgePoint;
  if (!kp && options.knowledgePointId != null) {
    kp = KnowledgePoint.get(options.knowledgePointId);
    if (!kp) {
      throw new StrategyError('知识点不存在: ' + options.knowledgePointId, CODES.KP_NOT_FOUND, { knowledgePointId: options.knowledgePointId });
    }
  }

  var typeId = options.questionType || options.questionTypeId;
  var t = Registry.get(typeId);
  if (!t) {
    throw new StrategyError('非法 questionTypeId: ' + typeId, CODES.INVALID_REQUEST, { questionTypeId: typeId });
  }

  // 1) QuestionType 不支持 context → none
  if (!t.supports || t.supports.context !== true) return 'none';

  // 2) 支持 context → KP contextDefault
  var base = null;
  if (kp) {
    var def = (kp.context && kp.context.defaults && kp.context.defaults[0]) ||
      kp.context_default ||
      (kp.legacy && kp.legacy.context_default);
    if (CONTEXT_TIERS.indexOf(def) !== -1) base = def;
  }
  if (!base) base = 'standard';

  // 3) 高螺旋 / 应用认知 → 提高情境复杂度（+1 档，封顶 complex）
  var spiralLevel = Number(options.spiralLevel);
  if (!isFinite(spiralLevel) || spiralLevel < 1) spiralLevel = 1;
  var unified = CognitiveStrategy.toUnified(options.cognitiveLevel);
  var upgrade = spiralLevel >= HIGH_SPIRAL_THRESHOLD || unified === 'apply';

  if (upgrade) {
    var idx = CONTEXT_TIERS.indexOf(base);
    if (idx !== -1 && idx < CONTEXT_TIERS.length - 1) base = CONTEXT_TIERS[idx + 1];
  }

  return base;
}

module.exports = {
  CONTEXT_TIERS: CONTEXT_TIERS,
  HIGH_SPIRAL_THRESHOLD: HIGH_SPIRAL_THRESHOLD,
  resolveContextType: resolveContextType
};

};
__defs["shared/strategy/constraint-builder.js"] = function (module, exports, require) {
/**
 * shared/strategy/constraint-builder.js — M3-16 Constraint Builder（结构约束统一组装）
 *
 * 将以下已解析部件最终合成为 Generator 可直接消费的 constraints：
 *   difficulty, numberRange, cognitiveLevel, spiralLevel, context, questionType
 *
 * 输出结构（Generator 直接消费）：
 *   {
 *     difficulty,      // 最终难度（1-10 整数）
 *     questionType,    // 标准 questionTypeId
 *     cognitiveLevel,  // 统一三层 recognize/understand/apply
 *     spiralLevel,     // 1..maxSpiralLevel
 *     contextType,     // 项目已有情境枚举 / 'none'
 *     scale,           // 数值缩放（复用 difficulty.js paramsFor 既有逻辑）
 *     numberRange,     // { min, max }，min <= max
 *     maxSteps,        // >= 1
 *     allowBracket,    // boolean
 *     allowMultDiv     // boolean
 *   }
 */
'use strict';

var Difficulty = require("shared/difficulty.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var CODES = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function requirePiece(pieces, key, label) {
  if (pieces[key] == null) {
    throw new StrategyError('ConstraintBuilder 缺少部件: ' + (label || key), CODES.INVALID_PLAN, { missing: key });
  }
  return pieces[key];
}

function buildConstraints(pieces) {
  pieces = pieces || {};

  var difficulty = requirePiece(pieces, 'difficulty', 'difficulty（最终难度）');
  var questionType = requirePiece(pieces, 'questionType', 'questionType');
  var cognitiveLevel = requirePiece(pieces, 'cognitiveLevel', 'cognitiveLevel');
  var spiralLevel = requirePiece(pieces, 'spiralLevel', 'spiralLevel');
  var contextType = requirePiece(pieces, 'contextType', 'contextType');
  var numberRange = requirePiece(pieces, 'numberRange', 'numberRange');
  var maxSteps = requirePiece(pieces, 'maxSteps', 'maxSteps');
  var allowBracket = requirePiece(pieces, 'allowBracket', 'allowBracket');
  var allowMultDiv = requirePiece(pieces, 'allowMultDiv', 'allowMultDiv');

  if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
    throw new StrategyError('difficulty 必须是有限数字: ' + difficulty, CODES.INVALID_PLAN);
  }
  if (!numberRange || typeof numberRange.min !== 'number' || typeof numberRange.max !== 'number' || numberRange.min > numberRange.max) {
    throw new StrategyError('numberRange 非法: ' + JSON.stringify(numberRange), CODES.INVALID_PLAN);
  }

  // scale：复用 difficulty.js 既有逻辑（不复制公式）
  var scale = Difficulty.paramsFor('math', Math.round(difficulty)).scale;

  return {
    difficulty: Math.round(difficulty),
    questionType: questionType,
    cognitiveLevel: cognitiveLevel,
    spiralLevel: spiralLevel,
    contextType: contextType,
    scale: scale,
    numberRange: { min: numberRange.min, max: numberRange.max },
    maxSteps: maxSteps,
    allowBracket: !!allowBracket,
    allowMultDiv: !!allowMultDiv
  };
}

module.exports = {
  buildConstraints: buildConstraints
};

};
__defs["shared/strategy/strategy-validator.js"] = function (module, exports, require) {
/**
 * shared/strategy/strategy-validator.js — M3-18 Strategy Validator
 *
 * QuestionPlan 最终校验（进入 Generator 前的最后一道门）：
 *   ① KP 存在
 *   ② questionType 合法
 *   ③ KP 支持 questionType
 *   ④ cognitiveLevel 合法
 *   ⑤ difficulty 1~10
 *   ⑥ spiralLevel 合法
 *   ⑦ spiralLevel <= maxSpiralLevel
 *   ⑧ count > 0
 *   ⑨ numberRange 合法
 *   ⑩ maxSteps >= 1
 *   ⑪ context 合法
 *
 * 任何一项失败 → valid:false，不允许进入 Generator。
 */
'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var Registry = require("shared/question-type-registry.js");
var Resolver = require("shared/capability-resolver.js");

var CONTEXT_LEGAL = ['pure', 'simple', 'standard', 'complex', 'none'];

function isInt(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }

function validatePlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan 必须是对象'] };
  }

  // ① KP 存在
  var kp = null;
  if (!plan.knowledgePointId || typeof plan.knowledgePointId !== 'string') {
    errors.push('① knowledgePointId 必填');
  } else {
    kp = KnowledgePoint.get(plan.knowledgePointId);
    if (!kp) errors.push('① 知识点不存在: ' + plan.knowledgePointId);
  }

  // ② questionType 合法
  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('② questionTypeId 必填');
  } else if (!Registry.has(plan.questionTypeId)) {
    errors.push('② 非法 questionTypeId: ' + plan.questionTypeId);
  }

  // ③ KP 支持 questionType
  if (kp && plan.questionTypeId && Registry.has(plan.questionTypeId)) {
    var supported = Resolver.getCapabilities(kp).questionTypes || [];
    if (supported.indexOf(plan.questionTypeId) === -1) {
      errors.push('③ KP 不支持该题型: ' + plan.questionTypeId + '（支持: ' + supported.join(',') + '）');
    }
  }

  // ④ cognitiveLevel 合法（Registry 枚举）
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || Registry.COGNITIVE_LEVELS.indexOf(plan.cognitiveLevel) === -1) {
      errors.push('④ 非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  // ⑤ difficulty 1~10
  if (plan.difficulty == null || !isInt(plan.difficulty) || plan.difficulty < 1 || plan.difficulty > 10) {
    errors.push('⑤ difficulty 必须是 1-10 的整数: ' + plan.difficulty);
  }

  // ⑥ spiralLevel 合法
  if (plan.spiralLevel == null || !isInt(plan.spiralLevel) || plan.spiralLevel < 1 || plan.spiralLevel > 6) {
    errors.push('⑥ spiralLevel 必须是 1-6 的整数: ' + plan.spiralLevel);
  } else if (kp && isInt(plan.spiralLevel)) {
    // ⑦ spiralLevel <= maxSpiralLevel
    var maxSpiral = (kp.spiral && typeof kp.spiral.maxLevel === 'number')
      ? kp.spiral.maxLevel : (kp.max_spiral_level || 1);
    if (plan.spiralLevel > maxSpiral) {
      errors.push('⑦ spiralLevel ' + plan.spiralLevel + ' 超过 maxSpiralLevel ' + maxSpiral);
    }
  }

  // ⑧ count > 0
  if (plan.count == null || !isInt(plan.count) || plan.count < 1) {
    errors.push('⑧ count 必须是 >=1 的整数: ' + plan.count);
  }

  // ⑨ numberRange 合法
  var constraints = plan.constraints || {};
  var nr = constraints.numberRange;
  if (!nr || typeof nr !== 'object' || typeof nr.min !== 'number' || !isFinite(nr.min) ||
      typeof nr.max !== 'number' || !isFinite(nr.max) || nr.min > nr.max) {
    errors.push('⑨ numberRange 必须是 {min,max} 且 min<=max: ' + JSON.stringify(nr));
  }

  // ⑩ maxSteps >= 1
  if (constraints.maxSteps == null || !isInt(constraints.maxSteps) || constraints.maxSteps < 1) {
    errors.push('⑩ maxSteps 必须是 >=1 的整数: ' + constraints.maxSteps);
  }

  // ⑪ context 合法
  if (plan.contextType != null) {
    if (CONTEXT_LEGAL.indexOf(plan.contextType) === -1) {
      errors.push('⑪ 非法 contextType: ' + plan.contextType);
    }
  }

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  CONTEXT_LEGAL: CONTEXT_LEGAL,
  validatePlan: validatePlan
};

};
__defs["shared/strategy/strategy-error.js"] = function (module, exports, require) {
/**
 * shared/strategy/strategy-error.js — M3 Strategy Error
 *
 * 统一策略层异常，便于上层捕获与处理。
 * 不抛给 Generator。
 */
'use strict';

function StrategyError(message, code, detail) {
  Error.call(this);
  this.name = 'StrategyError';
  this.message = message;
  this.code = code || 'STRATEGY_ERROR';
  this.detail = detail || null;
}

StrategyError.prototype = Object.create(Error.prototype);
StrategyError.prototype.constructor = StrategyError;

StrategyError.CODES = {
  KP_NOT_FOUND: 'KP_NOT_FOUND',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_PLAN: 'INVALID_PLAN',
  NO_CAPABILITY: 'NO_CAPABILITY',
  GENERATOR_MISMATCH: 'GENERATOR_MISMATCH'
};

function isStrategyError(err) {
  return err && err.name === 'StrategyError';
}

module.exports = {
  StrategyError: StrategyError,
  isStrategyError: isStrategyError
};
};
__defs["shared/strategy/strategy-request.js"] = function (module, exports, require) {
/**
 * shared/strategy/strategy-request.js — M3-01 Strategy Request
 *
 * 统一策略输入对象。
 * 只描述「要什么题」，不包含生成逻辑、SVG/HTML、执行函数。
 * 向后兼容旧 UI 参数（subject/grade/count/difficulty 等）。
 */
'use strict';

var StrategyConfig = require("shared/strategy-config.js");

var LEGACY_UI_KEYS = ['subject', 'grade', 'count', 'difficulty', 'subtype', 'questionType'];

// 标准题型枚举（来自 QuestionTypeRegistry）
var VALID_QUESTION_TYPES = [
  'oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'
];

// 难度范围
var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;

function normalizeLegacyParams(params) {
  var out = {};
  // 旧 UI 参数映射
  if (params.subject != null) out.subject = params.subject;
  if (params.grade != null) out.grade = params.grade;
  if (params.count != null) out.count = Math.max(1, Math.floor(params.count));
  if (params.difficulty != null) {
    var d = Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.floor(params.difficulty)));
    out.targetDifficulty = d;
  }
  if (params.subtype != null) out.subtype = params.subtype;
  if (params.questionType != null) out.questionType = params.questionType;
  return out;
}

function validateRequest(req) {
  var errors = [];

  if (!req || typeof req !== 'object') {
    errors.push('Request 必须是对象');
    return { valid: false, errors: errors };
  }

  // 核心输入：knowledgePointId 必填
  if (!req.knowledgePointId || typeof req.knowledgePointId !== 'string') {
    errors.push('knowledgePointId 是必填字符串');
  }

  // 题型：若提供，必须在合法枚举中
  if (req.questionType != null) {
    if (typeof req.questionType !== 'string') {
      errors.push('questionType 必须是字符串');
    } else if (VALID_QUESTION_TYPES.indexOf(req.questionType) === -1) {
      errors.push('非法 questionType: ' + req.questionType);
    }
  }

  // targetDifficulty 必须在 1-10
  if (req.targetDifficulty != null) {
    var td = req.targetDifficulty;
    if (typeof td !== 'number' || td < DIFFICULTY_MIN || td > DIFFICULTY_MAX || td % 1 !== 0) {
      errors.push('targetDifficulty 必须是 1-10 的整数');
    }
  }

  // count 必须 >=1
  if (req.count != null) {
    var c = req.count;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  // subject/grade 若提供，需合法
  if (req.subject != null && typeof req.subject !== 'string') {
    errors.push('subject 必须是字符串');
  }
  if (req.grade != null && (typeof req.grade !== 'number' || req.grade < 1 || req.grade > 6 || req.grade % 1 !== 0)) {
    errors.push('grade 必须是 1-6 的整数');
  }

  // learnerProfile 可选，若提供必须是对象
  if (req.learnerProfile != null && typeof req.learnerProfile !== 'object') {
    errors.push('learnerProfile 必须是对象');
  }

  // settings 可选，若提供必须是对象
  if (req.settings != null && typeof req.settings !== 'object') {
    errors.push('settings 必须是对象');
  }

  // 禁止字段：不允许直接包含 SVG/HTML/生成器
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template'];
  forbidden.forEach(function (k) {
    if (req[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Request 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

function createRequest(params) {
  var req = Object.assign({}, params || {});
  return req;
}

function createFromLegacyUI(legacyParams) {
  // 从旧 UI 参数创建 StrategyRequest
  var base = normalizeLegacyParams(legacyParams || {});
  // 保留 legacy 字段供兼容层使用
  base._legacy = true;
  return base;
}

function isLegacyRequest(req) {
  return req && req._legacy === true;
}

module.exports = {
  VALID_QUESTION_TYPES: VALID_QUESTION_TYPES,
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  normalizeLegacyParams: normalizeLegacyParams,
  validateRequest: validateRequest,
  createRequest: createRequest,
  createFromLegacyUI: createFromLegacyUI,
  isLegacyRequest: isLegacyRequest
};
};
__defs["shared/strategy/strategy-result.js"] = function (module, exports, require) {
/**
 * shared/strategy/strategy-result.js — M3-03 Strategy Result
 *
 * 统一策略引擎输出结构。
 * 只描述「生成计划」，不包含题目内容、SVG/HTML、DOM、生成逻辑。
 * 供 Generator 层消费。
 */
'use strict';

function createStrategyResult(plans, meta, warnings) {
  var m = {
    engine: 'strategy-v1',
    version: '1.0',
    generatedAt: new Date().toISOString()
  };
  // 合并调用方传入的 meta（trace / staticLevel / effectiveDifficulty 等）
  if (meta && typeof meta === 'object') {
    for (var k in meta) {
      if (Object.prototype.hasOwnProperty.call(meta, k)) m[k] = meta[k];
    }
  }
  return {
    plans: plans || [],
    meta: m,
    warnings: warnings || []
  };
}

function validateStrategyResult(result) {
  var errors = [];

  if (!result || typeof result !== 'object') {
    return { valid: false, errors: ['Result 必须是对象'] };
  }

  if (!Array.isArray(result.plans)) {
    return { valid: false, errors: ['plans 必须是数组'] };
  }

  for (var i = 0; i < result.plans.length; i++) {
    var plan = result.plans[i];
    if (!plan || typeof plan !== 'object') {
      return { valid: false, errors: ['plan[' + i + '] 必须是对象'] };
    }
    if (!plan.knowledgePointId || typeof plan.knowledgePointId !== 'string') {
      return { valid: false, errors: ['plan[' + i + '] 缺少 knowledgePointId'] };
    }
    if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
      return { valid: false, errors: ['plan[' + i + '] 缺少 questionTypeId'] };
    }
  }

  if (result.meta && typeof result.meta !== 'object') {
    return { valid: false, errors: ['meta 必须是对象'] };
  }
  if (result.warnings && !Array.isArray(result.warnings)) {
    return { valid: false, errors: ['warnings 必须是数组'] };
  }

  // 禁止字段
  var forbidden = ['questions', 'svg', 'html', 'dom', 'render', 'renderHtml'];
  for (var i = 0; i < forbidden.length; i++) {
    var k = forbidden[i];
    if (result[k] !== undefined) {
      return { valid: false, errors: ['禁止字段: ' + k + ' (不允许在 StrategyResult 中包含题目/HTML/SVG)'] };
    }
  }

  return { valid: true, errors: [] };
}

module.exports = {
  createStrategyResult: createStrategyResult,
  validateStrategyResult: validateStrategyResult
};
};
__defs["shared/strategy/question-plan.js"] = function (module, exports, require) {
/**
 * shared/strategy/question-plan.js — M3-02 Question Plan Schema
 *
 * 统一题目计划结构：描述「生成什么题」，不包含生成逻辑。
 * 供 Strategy Engine 产出，Generator 消费。
 */
'use strict';

var StrategyConfig = require("shared/strategy-config.js");
var Registry = require("shared/question-type-registry.js");

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var SPIRAL_MIN = 1;
var SPIRAL_MAX = 6;

var VALID_COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

var VALID_CONTEXT_TYPES = ['pure', 'simple', 'standard', 'complex'];

function validateQuestionPlan(plan) {
  var errors = [];

  if (!plan || typeof plan !== 'object') {
    errors.push('Plan 必须是对象');
    return { valid: false, errors: errors };
  }

  // 核心必填字段
  if (!plan.knowledgePointId || typeof plan.knowledgePointId !== 'string') {
    errors.push('knowledgePointId 是必填字符串');
  }

  if (!plan.questionTypeId || typeof plan.questionTypeId !== 'string') {
    errors.push('questionTypeId 是必填字符串');
  } else if (!['oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'].includes(plan.questionTypeId)) {
    errors.push('非法 questionTypeId: ' + plan.questionTypeId);
  }

  // cognitiveLevel
  if (plan.cognitiveLevel != null) {
    if (typeof plan.cognitiveLevel !== 'string' || !VALID_COGNITIVE_LEVELS.includes(plan.cognitiveLevel)) {
      errors.push('非法 cognitiveLevel: ' + plan.cognitiveLevel);
    }
  }

  // difficulty
  if (plan.difficulty != null) {
    var d = plan.difficulty;
    if (typeof d !== 'number' || d < 1 || d > 10 || d % 1 !== 0) {
      errors.push('difficulty 必须是 1-10 的整数');
    }
  }

  // spiralLevel
  if (plan.spiralLevel != null) {
    var sl = plan.spiralLevel;
    if (typeof sl !== 'number' || sl < 1 || sl > 6 || sl % 1 !== 0) {
      errors.push('spiralLevel 必须是 1-6 的整数');
    }
  }

  // count
  if (plan.count != null) {
    var c = plan.count;
    if (typeof c !== 'number' || c < 1 || c % 1 !== 0) {
      errors.push('count 必须是 >=1 的整数');
    }
  }

  // constraints
  if (plan.constraints != null) {
    if (typeof plan.constraints !== 'object') {
      errors.push('constraints 必须是对象');
    } else {
      var cst = plan.constraints;

      if (cst.numberRange != null) {
        if (typeof cst.numberRange !== 'object' || cst.numberRange === null ||
            cst.numberRange.min == null || cst.numberRange.max == null) {
          errors.push('constraints.numberRange 必须是 {min, max} 对象');
        } else if (typeof cst.numberRange.min !== 'number' || typeof cst.numberRange.max !== 'number' ||
                   cst.numberRange.min > cst.numberRange.max) {
          errors.push('constraints.numberRange.min/max 必须是数字且 min <= max');
        }
      }

      if (cst.maxSteps != null && (typeof cst.maxSteps !== 'number' || cst.maxSteps < 1 || cst.maxSteps % 1 !== 0)) {
        errors.push('constraints.maxSteps 必须是 >=1 的整数');
      }

      if (cst.allowBracket != null && typeof cst.allowBracket !== 'boolean') {
        errors.push('constraints.allowBracket 必须是布尔值');
      }

      if (cst.allowMultDiv != null && typeof cst.allowMultDiv !== 'boolean') {
        errors.push('constraints.allowMultDiv 必须是布尔值');
      }

      if (cst.contextType != null) {
        if (typeof cst.contextType !== 'string' || !['pure', 'simple', 'standard', 'complex'].includes(cst.contextType)) {
          errors.push('constraints.contextType 必须是 pure/simple/standard/complex 之一');
        }
      }
    }
  }

  // 禁止字段
  var forbidden = ['svg', 'html', 'generate', 'generator', 'render', 'template', 'execute', 'executeFunction'];
  forbidden.forEach(function (k) {
    if (plan[k] !== undefined) {
      errors.push('禁止字段: ' + k + ' (不允许在 Plan 中包含 SVG/HTML/生成器)');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  validateQuestionPlan: validateQuestionPlan
};
};
__defs["shared/strategy/strategy-resolver.js"] = function (module, exports, require) {
/**
 * shared/strategy/strategy-resolver.js — M3-04 知识点接入层
 *
 * 统一通过 KnowledgePoint.get() 获取标准 KP，禁止直接读取 knowledge-math.js 等。
 * KP 不存在 → 抛出 StrategyError → 不进入 Generator。
 */
'use strict';

var KnowledgePoint = require("shared/knowledge-point.js");
var StrategyError = require("shared/strategy/strategy-error.js").StrategyError;
var StrategyErrorCodes = require("shared/strategy/strategy-error.js").StrategyError.CODES;

function resolveKnowledgePoint(kpId) {
  if (!kpId || typeof kpId !== 'string') {
    throw new StrategyError('knowledgePointId 必填且必须是字符串', StrategyErrorCodes.INVALID_REQUEST);
  }
  var kp = KnowledgePoint.get(kpId);
  if (!kp) {
    throw new StrategyError('知识点不存在: ' + kpId, StrategyErrorCodes.KP_NOT_FOUND, { knowledgePointId: kpId });
  }
  return kp;
}

function resolveMultiple(ids) {
  if (!Array.isArray(ids)) {
    throw new Error('ids 必须是数组');
  }
  var results = {};
  ids.forEach(function (id) {
    try {
      results[id] = KnowledgePoint.get(id);
    } catch (e) {
      results[id] = null;
    }
  });
  return results;
}

function hasKnowledgePoint(id) {
  return KnowledgePoint.get(id) !== null;
}

module.exports = {
  resolveKnowledgePoint: resolveKnowledgePoint,
  resolveMultiple: resolveMultiple,
  hasKnowledgePoint: hasKnowledgePoint
};
};
__defs["shared/generator/migration-switch.js"] = function (module, exports, require) {
/**
 * shared/generator/migration-switch.js — M4-R17 迁移切换清单（声明式）
 *
 * M4-R17 第一批迁移：math-oral 的 12 个高重复纯口算 KP 已通过逐 KP 全量
 * Adapter 对照（FULL-EQ，dev/check-generator-migration.js 门禁）。
 * 本模块声明这些 KP 的切换（knowledgePoint → native），供引擎/调用方在
 * 运行时 apply() 一次性生效；其余 KP（mixed/remainder/relation/多位数）
 * 无纯算术语义，保持 hybrid → legacy 优先，不做 native 切换。
 *
 * 注意：切换粒度必须是「知识点」，不能是「插件」——
 * 若 override('plugin','math-oral','native') 会把 N/A KP 也甩给 native
 * 的默认混合生成器，破坏 remainder/mixed/subType 语义。
 */
'use strict';

var Mode = require("shared/generator/generator-mode.js");

// M4-R17 迁移批次：已 FULL-EQ 的 math-oral 纯口算 KP（12 个）
var MIGRATED_KPS = [
  'math-g1-m1-addsub-5',
  'math-g1-m1-addsub-10',
  'math-g1-m1-carry-add-20',
  'math-g1-m1-retreat-sub-20',
  'math-g1-m1-addsub-100',
  'math-g1-m1-two-digit-add',
  'math-g2-m1-add-100',
  'math-g2-m1-sub-100',
  'math-g2-m1-mult-table',
  'math-g2-m1-div-table',
  'math-g2-m1-addsub-1000',
  'math-g3-m1-g3-add-sub-wan'
];

// M4-R18 迁移批次：复杂运算（链式/括号/逆向）plan-driven KP（9 个）。
// 由 generator:complex-calc 服务，经 complex 语义注入 + per-KP native 切换生效。
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

// M4-R26 迁移批次：简便计算（凑整）家族——math-g4-mixed 2 个 KP（add-law/mul-law）。
// 由 arithmetic 生成器经 SPECIAL_ORAL_PROFILE kind 分派（step=2 多步凑整），FULL-EQ 全绿。
var R26_LAW_KPS = [
  'math-g4-m3-g4-mix-addlaw',
  'math-g4-m3-g4-mix-mullaw'
];

// M4-R27 迁移批次：六上小数/负数家族——math-g6-oral 负数加减口算 + math-g6-calc 小数乘法笔算。
// 由 arithmetic 生成器经 SPECIAL_ORAL_PROFILE kind 分派（neg-add-sub/dec-mult）。
// 前提：KB numberRange 需放开（neg-add-sub 允许负值；dec-mult 允许 <1 因数）。
var R27_KPS = [
  'math-g6-m1-g6-oral-neg-add-sub',
  'math-g6-m2-g6-calc-dec-mult'
];

var ALL_MIGRATED = MIGRATED_KPS.concat(COMPLEX_KPS, R26_LAW_KPS, R27_KPS);

function isMigrated(kpId) {
  return ALL_MIGRATED.indexOf(kpId) !== -1;
}

function apply() {
  ALL_MIGRATED.forEach(function (kpId) {
    Mode.override('knowledgePoint', kpId, 'native');
  });
  return ALL_MIGRATED.length;
}

module.exports = {
  MIGRATED_KPS: MIGRATED_KPS,
  COMPLEX_KPS: COMPLEX_KPS,
  R26_LAW_KPS: R26_LAW_KPS,
  R27_KPS: R27_KPS,
  ALL_MIGRATED: ALL_MIGRATED,
  isMigrated: isMigrated,
  apply: apply
};
};
__defs["shared/generator/semantic-question-bridge.js"] = function (module, exports, require) {
/**
 * shared/generator/semantic-question-bridge.js — M4-R19 SemanticQuestion → 标准 Question 桥
 *
 * 核心 Generator 产出 SemanticQuestion[]（无渲染/判定，仅 prompt/answer/data）。
 * 综合练习等需要「可渲染 + 可判定」标准 Question 接口（render(idx) / check(answers, idx)）。
 * 本桥将两者对接，不改动语义层（prompt 仍是算式/题干文本），渲染/判定全部收敛于此。
 *
 * 规则：
 *   - 题干   → q.q / q.text = semantic.prompt
 *   - 判定   → q.check = defaultQCheck（文本/多空/选择统一）
 *   - 选择   → semantic.data.options 时 inputType='choice'，options=[...]，answer 比对选项值
 *   - 逆向题 → prompt 含 □（未知数），降级为单空文本答题，学生填答案
 *   - 跟读   → answerMode 'read-aloud'（无书面作答）输入框隐藏
 *   - 渲染   → 复用 PluginUtil.renderCard（浏览器与 Node 均可用，纯字符串）
 */
'use strict';

function getPluginUtil() {
  return (typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof global !== 'undefined' && global.PluginUtil ? global.PluginUtil
      : (typeof require !== 'undefined' ? require("shared/render.js") : null)));
}

function getQCheck() {
  var PU = getPluginUtil();
  if (PU && typeof PU.defaultQCheck === 'function') return PU.defaultQCheck;
  if (typeof defaultQCheck === 'function') return defaultQCheck;
  if (typeof require !== 'undefined') return require("shared/check.js").defaultQCheck;
  return null;
}

function safeStr(v) {
  if (v == null) return '';
  if (typeof v === 'boolean') return v ? '对' : '错';
  return String(v);
}

/**
 * 将单个 SemanticQuestion 转换为标准 Question（含 render/check）。
 * @param {Object} sq  SemanticQuestion
 * @param {Object} [meta] { answerMode, data } 透传参考
 * @returns {Object} 标准 Question
 */
function toQuestion(sq) {
  sq = sq || {};
  var prompt = safeStr(sq.prompt);
  var answer = sq.answer;
  var ui = getPluginUtil();
  var qcheck = getQCheck();

  var q = {
    q: prompt,
    text: prompt,
    answer: answer,
    answerMode: sq.answerMode || 'input',
    hint: sq.hint != null ? sq.hint : null,
    knowledgePointId: sq.knowledgePointId,
    questionType: sq.questionType,
    type: sq.type || sq.questionType || null,
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    numberRange: sq.numberRange,
    seed: sq.seed,
    data: sq.data || {}
  };

  // 选择题：data.options（如 selection-choice 的 data.options）
  var options = (sq.data && Array.isArray(sq.data.options) && sq.data.options.length) ? sq.data.options : null;
  if (options) {
    q.inputType = 'choice';
    q.options = options.map(function (o) { return safeStr(o); });
    q.answer = safeStr(sq.answer);
  } else if (Array.isArray(sq.answer)) {
    q.inputType = 'multi';
  } else {
    q.inputType = 'text';
  }

  // 跟读/无书面作答：隐藏输入，不吃答案
  if (q.answerMode === 'read-aloud' || (q.answer == null && q.answerMode === 'read-aloud')) {
    q.inputType = 'none';
  }

  // render：复用插件卡片渲染（renderCard 期望 q.q / q.answer / inputType / options）
  q.render = function (idx) {
    if (ui && typeof ui.renderCard === 'function') return ui.renderCard(q, idx, {});
    // Node 兜底：无 UI 时返回简单 HTML（渲染文本 + 输入框占位），保证测试可运行
    var head = '<div class="question-card" data-index="' + idx + '"><div class="q-header"><span class="num">' + (idx + 1) + '</span> <span class="q-text">' + prompt + '</span></div>';
    var field = (q.inputType === 'choice' && q.options)
      ? '<div class="options">' + q.options.map(function (o) { return '<button type="button" class="opt" data-val="' + o + '">' + o + '</button>'; }).join('') + '</div>'
      : '<input type="text" class="answer-inp" data-index="' + idx + '">';
    return head + field + '</div>';
  };

  // check：整串/多空/选择统一走 defaultQCheck（与综合练习既有判定一致）
  q.check = function (answers, idx) {
    if (q.inputType === 'none') return true;
    if (qcheck) return !!qcheck(q, answers, idx);
    // 兜底简易比较
    var ua = Array.isArray(answers) ? answers[idx] : (answers ? answers[idx] : undefined);
    var norm = function (v) { return String(v == null ? '' : v).trim(); };
    return norm(ua) === norm(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
  };

  return q;
}

/**
 * 批量转换 SemanticQuestion[] → 标准 Question[]。
 * @param {Array<Object>} sems
 * @returns {Array<Object>}
 */
function toQuestions(sems) {
  if (!Array.isArray(sems)) return [];
  return sems.map(function (sq) { return toQuestion(sq); });
}

module.exports = {
  toQuestion: toQuestion,
  toQuestions: toQuestions
};

};
__defs["shared/capability-resolver.js"] = function (module, exports, require) {
/**
 * shared/capability-resolver.js — Capability 解析器 (M2-05 / M2-R06)
 *
 * 将 KnowledgePoint 归一化为 CapabilityModel，并提供最终能力决策。
 *
 * API
 * -----
 * resolve(kp)                  -> CapabilityModel（M2-05，能力模型）
 * resolveFinal({knowledgePointId, questionType}) -> 最终能力状态（M2-R06）
 * canGenerate(kpId, qtId)      -> boolean
 * matrix(kp)                   -> { supported: [...], unsupported: [...] }
 *
 * 最终决策优先级（R06.2）：
 *   INVALID → FORBID → MISSING → ALLOW → DEGRADE
 * 其中 DEGRADE 绝不自动升级为 ALLOW。
 *
 * 决策来源（R06.3）：
 *   knowledgePoint : ontology
 *   questionType   : registry
 *   plugin         : generator-capability-registry（declared/inferred）
 *   matrix         : R04 capability-matrix
 */
'use strict';

var Ontology = require("shared/knowledge-ontology.js");
var Registry = require("shared/question-type-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var CapabilityModel = require("shared/capability-model.js");
var Matrix = require("shared/capability-matrix.js");
var GenCap = require("shared/generator-capability-registry.js");

function resolve(canonicalKp) {
  // canonicalKp 已经是 Canonical KP，直接从 presentation.questionTypes 和 generation.capabilities 推导
  return CapabilityModel.resolveCapability(canonicalKp);
}

function canGenerate(kpId, qtId) {
  var r = resolveFinal({ knowledgePointId: kpId, questionType: qtId });
  return r.decision === 'ALLOW';
}

function resolveFinal(input) {
  var kpId = input && input.knowledgePointId;
  var qtId = input && input.questionType;

  // 1) 未知题型 -> INVALID
  var qt = Registry.get(qtId);
  if (!qt) {
    return { knowledgePointId: kpId, questionType: qtId, capability: null, decision: 'INVALID', source: { questionType: 'registry' }, confidence: 'none' };
  }

  // 2) 未知知识点 -> INVALID
  var kp = KnowledgePoint.get(kpId);
  if (!kp) {
    return { knowledgePointId: kpId, questionType: qtId, capability: qt.category, decision: 'INVALID', source: { knowledgePoint: 'ontology' }, confidence: 'none' };
  }

  // 3) 构建 R04 矩阵决策
  var mx = Matrix.buildMatrix(kp);
  var cell = mx.questionTypes[qtId];
  var matrixDecision = cell ? cell.decision : 'FORBID';

  // 4) Plugin 能力（generator capability registry）
  var pluginRec = null;
  var allGen = GenCap.buildGeneratorCapabilityRegistry();
  for (var i = 0; i < allGen.length; i++) {
    if (allGen[i].pluginId === kp.pluginId) { pluginRec = allGen[i]; break; }
  }
  var pluginHas = pluginRec ? pluginRec.questionTypes.indexOf(qtId) !== -1 : null;

  var decision;
  if (matrixDecision === 'MISSING') decision = 'MISSING';
  else if (matrixDecision === 'FORBID') decision = 'FORBID';
  else if (matrixDecision === 'ALLOW') decision = 'ALLOW';
  else decision = 'DEGRADE'; // 不自动升级

  // 若 plugin 明确缺失该能力但 matrix ALLOW，降级为 DEGRADE（声明不足，不伪造）
  if (decision === 'ALLOW' && pluginHas === false) decision = 'DEGRADE';

  var confidence = 'declared';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';
  else if (decision === 'MISSING') confidence = 'unknown';

  return {
    knowledgePointId: kpId,
    questionType: qtId,
    capability: qt.category,
    decision: decision,
    source: {
      knowledgePoint: 'ontology',
      questionType: 'registry',
      plugin: pluginRec ? 'declared' : 'none',
      matrix: 'R04'
    },
    confidence: confidence
  };
}

function matrix(kp) {
  var canonical = Ontology.normalize(kp);
  var supported = [];
  var unsupported = [];

  (canonical.presentation.questionTypes || []).forEach(function (q) {
    if (!q || !q.type) return;
    var std = Registry.normalizeQuestionType(q.type);
    if (std.id) {
      if (supported.indexOf(std.id) === -1) supported.push(std.id);
    } else {
      unsupported.push(q.type);
    }
  });

  (canonical.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id) && supported.indexOf(cap.id) === -1) supported.push(cap.id);
  });

  return { supported: supported, unsupported: unsupported };
}

function getCapabilities(kp) {
  // 获取指定 KP 的能力描述：{ questionTypes, cognitiveLevels, difficultyRange }
  var cap = resolve(kp);
  var questionTypes = cap.questionTypes.map(function (q) { return q.id; });
  var cognitiveLevels = {};
  var difficultyRange = {};
  cap.questionTypes.forEach(function (q) {
    cognitiveLevels[q.id] = q.cognitiveLevels;
    difficultyRange[q.id] = q.difficultyRange;
  });
  return {
    questionTypes: questionTypes,
    cognitiveLevels: cognitiveLevels,
    difficultyRange: difficultyRange
  };
}

module.exports = {
  resolve: resolve,
  resolveFinal: resolveFinal,
  canGenerate: canGenerate,
  matrix: matrix,
  getCapabilities: getCapabilities
};

};
__defs["shared/strategy/adaptive-strategy.js"] = function (module, exports, require) {
/**
 * shared/strategy/adaptive-strategy.js — M6-R12..R18 / R22 自适应策略
 *
 * 输入：{ knowledgePoint, staticDifficulty, learnerState, difficulty, allowDifficultyOverride, adaptiveMode, legacyDelta }
 * 输出：{
 *   effectiveDifficulty, targetSpiralLevel, cognitiveLevel, variant, errorFocus,
 *   adjustment, mastery, confidence, recentAccuracy, mode, shadow?
 * }
 *
 * 规则：
 *   - R13 Effective Difficulty = Static/User Difficulty + Learner Adjustment，限幅 [-2,+2]
 *   - R14 mastery → 难度规则（叠加 confidence 防低样本误判）
 *   - R15 连续正确/连续错误保护（单次最多 ±1 级，连续强化有上限）
 *   - R16 mastery+confidence+recentAccuracy → spiralLevel
 *   - R17 errorPatterns → errorFocus（Generator 接收）
 *   - R18 变体选择（基础/数值/呈现/情境/结构/迁移）
 *   - R22 新旧自适应对照（legacy / new / shadow）
 */
'use strict';

var LearnerModel = require("shared/learner/learner-model.js");

var DIFF_MIN = 1, DIFF_MAX = 10;
var ADJ_MIN = -2, ADJ_MAX = 2;

var VARIANTS = ['基础', '数值', '呈现', '情境', '结构', '迁移'];

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
function clampDiff(n) { return clamp(Math.round(n), DIFF_MIN, DIFF_MAX); }
function clampAdj(n) { return clamp(Math.round(n), ADJ_MIN, ADJ_MAX); }
function round3(n) { return Math.round(n * 1000) / 1000; }

function safeNumber(v, dflt) {
  var n = Number(v);
  return (typeof v === 'number' && isFinite(n)) ? n : dflt;
}

// ===== R14 mastery → 难度档位基准调整 =====
function masteryBandAdjustment(mastery) {
  if (mastery < 0.40) return -1;            // 低掌握：降低难度
  if (mastery < 0.70) return 0;             // 掌握中：保持/轻微调整
  if (mastery < 0.85) return 1;             // 较熟练：提高一级
  return 1;                                 // 高度熟练：提高难度（+额外 → 见下方强化）
}

// ===== R15 连续正确/连续错误保护 =====
function streakInfo(recentResults) {
  if (!Array.isArray(recentResults) || !recentResults.length) return { streak: 0, streakKind: 0 };
  var n = recentResults.length;
  var last = recentResults[n - 1];
  var len = 0;
  for (var i = n - 1; i >= 0; i--) {
    if (recentResults[i] !== last) break;
    len++;
  }
  return { streak: len, streakKind: last === 1 ? 1 : (last === 0 ? -1 : 0) };
}

function applyStreakProtection(adj, kpState) {
  var info = streakInfo(kpState && kpState.recentResults);
  var adj2 = adj;
  if (info.streakKind === -1 && info.streak >= 1) {
    // 最近连续错误：不允许上调难度（尊重 mastery 但防止“纸上熟练”冒进）
    adj2 = Math.min(adj2, 0);
  }
  if (info.streakKind === 1 && info.streak >= 2 && adj2 < 0) {
    // 最近连续正确且有回稳迹象：弱化单次下调的影响，但不过度乐观
    adj2 = Math.round(adj2 / 2);
  }
  return clampAdj(adj2);
}

// ===== R08 置信度门：低样本抑制调整 =====
function dampenByConfidence(adj, kpState) {
  var conf = safeNumber(kpState && kpState.confidence, 0);
  var attempts = safeNumber(kpState && kpState.attempts, 0);
  if (attempts <= 0) return 0;          // 从未作答：无证据，不动难度
  if (conf < 0.15) return Math.round(adj / 2);   // 置信度极低：折半调整（≤±1）
  if (attempts < 3) return clampAdj(roundStep(adj)); // 小样本：单步
  return adj;
}

function roundStep(adj) {
  // 小样本下只允许单步（-1/0/1）
  return clamp(adj, -1, 1);
}

// ===== R16 spiral =====
function spiralTarget(mastery, confidence, recentAccuracy) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  var ra = clamp(safeNumber(recentAccuracy, 0), 0, 1);
  var score = 0.5 * m + 0.25 * conf + 0.25 * ra;
  var level = 1;
  if (score < 0.4) level = 1;            // 低掌握 → S1
  else if (score < 0.6) level = 2;       // 基本掌握 → S2
  else if (score < 0.8) level = 3;       // 熟练 → S3
  else level = 4;                        // 高度熟练 → S4
  if (conf >= 0.7 && ra >= 0.85 && m >= 0.85) level = Math.max(level, 5); // 可尝试 S5/S6
  return clamp(level, 1, 6);
}

// ===== R18 变体选择 =====
function variantFor(mastery, confidence, errorFocus) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  var conf = clamp(safeNumber(confidence, 0), 0, 1);
  // 有错因且 mastery 低 → 回到基础变体做巩固
  if (errorFocus && errorFocus.length && m < 0.7) return '基础';
  if (m < 0.4) return '基础';
  if (m < 0.7) return conf >= 0.5 ? '呈现' : '数值';
  if (m < 0.85) return conf >= 0.6 ? '结构' : '情境';
  return '迁移';
}

// ===== R17 错因聚焦 =====
function errorFocusFor(kpState, limit) {
  if (!kpState || !kpState.errorPatterns) return [];
  var list = [];
  Object.keys(kpState.errorPatterns).forEach(function (k) {
    var p = kpState.errorPatterns[k];
    if (!p || p.count <= 0) return;
    list.push(p);
  });
  list.sort(function (a, b) {
    var d = (b.recentCount || 0) - (a.recentCount || 0);
    if (d) return d;
    return (b.count || 0) - (a.count || 0);
  });
  var n = (typeof limit === 'number') ? limit : 2;
  return list.slice(0, n).map(function (p) { return p.errorType; });
}

function cognitiveFor(mastery) {
  var m = clamp(safeNumber(mastery, 0), 0, 1);
  if (m < 0.4) return 'recall';
  if (m < 0.7) return 'understand';
  if (m < 0.85) return 'apply';
  return 'analyze';
}

// ===== 主入口 =====
/**
 * @param {Object} opts {
 *   kpId, learnerState,            // 该知识点状态（KpState 或 null）
 *   staticDifficulty,              // 知识点固有难度
 *   difficulty,                    // 用户显式难度（可选）
 *   allowDifficultyOverride,       // 是否允许用户难度覆盖
 *   adaptiveMode,                  // 'legacy' | 'new' | 'shadow'
 *   legacyDelta,                   // 旧 currentDelta（供 legacy/shadow）
 *   maxSpiralLevel,
 *   cognitiveLevel                 // 引擎已选认知层级（可选，用于输出）
 * }
 */
function resolve(opts) {
  opts = opts || {};
  var kp = opts.learnerState && typeof opts.learnerState === 'object'
    ? LearnerModel.normalizeKpState(opts.learnerState, opts.kpId)
    : LearnerModel.defaultKpState(opts.kpId);

  var staticDiff = clampDiff(safeNumber(opts.staticDifficulty, 3));
  var userDiff = opts.difficulty != null ? clampDiff(safeNumber(opts.difficulty, staticDiff)) : null;
  var allowOverride = opts.allowDifficultyOverride !== false;
  var base = (allowOverride && userDiff != null) ? userDiff : staticDiff;

  var mastery = kp.mastery;
  var confidence = kp.confidence;
  var recentAccuracy = kp.recentAccuracy;
  var attempts = kp.attempts;
  var mode = opts.adaptiveMode === 'legacy' || opts.adaptiveMode === 'shadow' ? opts.adaptiveMode
    : (attempts > 0 ? 'new' : 'new'); // 无证据也走 new（adjustment=0），保证接管
  var legacyDelta = clampAdj(safeNumber(opts.legacyDelta, 0));

  // ---- 学习者调整量 ----
  var adj = 0;
  if (attempts > 0) {
    adj = masteryBandAdjustment(mastery);
    // 高掌握强化：≥0.85 且可信 → +2
    if (mastery >= 0.85 && confidence >= 0.7 && recentAccuracy >= 0.85) adj = 2;
    adj = dampenByConfidence(adj, kp);
    adj = applyStreakProtection(adj, kp);
  }
  adj = clampAdj(adj);

  var learnerEffective = clampDiff(base + adj);

  // ---- shadow / legacy 对照（R22）----
  var legacyEffective = clampDiff(base + legacyDelta);
  var shadow = null;
  if (mode === 'shadow') {
    shadow = {
      legacyDelta: legacyDelta,
      learnerAdjustment: adj,
      legacyEffective: legacyEffective,
      learnerEffective: learnerEffective
    };
  }

  var effectiveDifficulty = (mode === 'legacy' || mode === 'shadow') ? legacyEffective : learnerEffective;

  // ---- spiral / variant / errorFocus / cognitive ----
  var focus = errorFocusFor(kp, 2);
  var maxSpiral = clamp(safeNumber(opts.maxSpiralLevel, 6), 1, 6);
  var targetSpiral = spiralTarget(mastery, confidence, recentAccuracy);
  targetSpiral = Math.min(targetSpiral, maxSpiral);
  if (attempts === 0) targetSpiral = 1; // 无记录从最低螺旋开始

  var variant = variantFor(mastery, confidence, focus);

  return {
    effectiveDifficulty: effectiveDifficulty,
    targetSpiralLevel: targetSpiral,
    cognitiveLevel: cognitiveFor(mastery),
    variant: variant,
    errorFocus: focus,
    adjustment: adj,
    mastery: round3(mastery),
    confidence: round3(confidence),
    recentAccuracy: round3(recentAccuracy),
    attempts: attempts,
    mode: mode,
    baseDifficulty: base,
    shadow: shadow,
    recommendedDifficulty: learnerEffective,
    recommendedSpiralLevel: targetSpiral
  };
}

module.exports = {
  resolve: resolve,
  masteryBandAdjustment: masteryBandAdjustment,
  applyStreakProtection: applyStreakProtection,
  dampenByConfidence: dampenByConfidence,
  spiralTarget: spiralTarget,
  variantFor: variantFor,
  errorFocusFor: errorFocusFor,
  cognitiveFor: cognitiveFor,
  VARIANTS: VARIANTS,
  ADJ_MIN: ADJ_MIN,
  ADJ_MAX: ADJ_MAX
};
};
__defs["shared/generator/generator-registry.js"] = function (module, exports, require) {
/**
 * shared/generator/generator-registry.js — M4-R03 Generator Registry
 *
 * 只读、纯数据的 Generator 注册表。仅保存声明：
 *   Generator ID / subject / capabilities / supported question types /
 *   supported knowledge points / version
 *
 * 禁止保存执行函数源码（运行时 Gate 校验：所有记录必须 JSON 可序列化）。
 *
 * 查询关系（KnowledgePoint → Capability → Generator）：
 *   forKnowledgePoint(kpId)     → 服务该 KP 的 Generator 列表
 *   forQuestionType(qtId)       → 具备该题型的 Generator 列表
 *   resolveChain(kpId)          → { kp, capabilityQuestionTypes, generators }
 */
'use strict';

var GenCap = require("shared/generator-capability-registry.js");

// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
var CORE_RECORDS = [
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec', 'math-g4-m3-g4-mix-addlaw', 'math-g6-m1-g6-oral-neg-add-sub'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g2-m1-mult-table', 'math-g2-m2-mult-col', 'math-g2-m4-multiplication-meaning', 'math-g2-m7-pic-mult', 'math-g2-m8-mult-total', 'math-g2-m5-match-multdiv', 'math-g3-m1-g3-mul-multi1', 'math-g4-m1-g4-oral-mul3x1', 'math-g4-m1-g4-oral-mul2t', 'math-g4-m1-g4-oral-law', 'math-g4-m3-g4-mix-mullaw', 'math-g5-m1-g5-oral-decmul', 'math-g6-c1-vertical-multidigit', 'math-g6-c3-multiplication-principle', 'math-g6-m2-g6-calc-dec-mult'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m13-division-table', 'math-g2-m1-div-table', 'math-g2-m1-muldiv-relation', 'math-g2-m2-div-col', 'math-g2-m4-division-meaning', 'math-g2-m7-pic-div', 'math-g2-m7-pic-div-include', 'math-g2-m8-div-partitive', 'math-g2-m8-div-quotative', 'math-g3-m1-g3-div1', 'math-g4-c2-c2-divisible', 'math-g4-m1-g4-oral-divt', 'math-g5-m1-g5-oral-decdiv', 'math-g4-m2-g4-v-div2', 'math-g4-m2-g4-v-div2q', 'math-g4-m8-g4-word-div', 'math-g5-c2-divisibility', 'math-g6-c2-divisibility'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: [], scope: 'core', version: 1 },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill'], questionTypes: ['fill'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g1-m13-division-table', 'math-g1-m13-fill-blank', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-cutfill', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-solid', 'math-g4-c4-c4-count'], scope: 'core', version: 1 },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice'], questionTypes: ['choice'], knowledgePoints: ['math-g1-m12-choice-mixed', 'math-g1-m5-match-calc', 'math-g1-m5-match-shape', 'math-g1-m5-match-clock', 'math-g1-m5-match-rmb', 'math-g2-m12-choice-mixed'], scope: 'core', version: 1 },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge'], questionTypes: ['judge'], knowledgePoints: ['math-g1-m0-make-ten-cushi', 'math-g1-m11-judge-mixed', 'math-g2-m11-judge-mixed'], scope: 'core', version: 1 },
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill', 'oral'], questionTypes: ['calc', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m1-mixed-chain', 'math-g2-m1-mixed-addsub', 'math-g2-m1-mixed-multdiv', 'math-g2-m3-chain-addsub', 'math-g2-m3-multdiv-mixed', 'math-g2-m3-mixed-no-bracket', 'math-g2-m3-mixed-bracket', 'math-g1-m4-num-fill-unknown', 'math-g2-m3-fill-operator'],
    scope: 'core', version: 1 }
];

function buildRecords() {
  // 数据来源：M2 Generator Capability Registry（只读）；无 KP 关联者不入册（非 Generator）
  var legacy = GenCap.buildGeneratorCapabilityRegistry()
    .filter(function (r) { return r.knowledgePoints.length > 0; })
    .map(function (r) {
      return {
        id: 'legacy:' + r.pluginId,
        subject: r.subject,
        capabilities: r.capabilities.slice(),
        questionTypes: r.questionTypes.slice(),
        knowledgePoints: r.knowledgePoints.slice(),
        scope: 'legacy',
        version: 1
      };
    });
  return legacy.concat(CORE_RECORDS);
}

var _records = null;

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function get(id) {
  for (var i = 0; i < records().length; i++) {
    if (records()[i].id === id) return records()[i];
  }
  return null;
}

function all() {
  return records().slice();
}

function forKnowledgePoint(kpId) {
  return records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
}

function forQuestionType(qtId) {
  return records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require("shared/knowledge-point.js");
  var Resolver = require("shared/capability-resolver.js");
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var capabilityQuestionTypes = Resolver.getCapabilities(kp).questionTypes || [];
  return {
    knowledgePointId: kpId,
    capabilityQuestionTypes: capabilityQuestionTypes,
    generators: forKnowledgePoint(kpId).map(function (r) { return r.id; })
  };
}

/**
 * M4-R12 知识点绑定迁移：KnowledgePoint → Capabilities → Generator Registry。
 *
 * 在 Canonical KP 上注入：
 *   capabilities     —— 该 KP 能由哪些能力生成（Generator Registry 推导，覆盖类型级 capability）
 *   legacyPluginId   —— 迁移兼容字段（保留原 pluginId 引用，逐步淘汰）
 *
 * 不修改 KnowledgeBank / 插件；只读增强返回同一对象（浅注入）。
 */
function enhanceKp(kp) {
  if (!kp || typeof kp !== 'object' || !kp.id) return kp;

  var generators = forKnowledgePoint(kp.id);
  var capabilities = [];
  generators.forEach(function (g) {
    (g.capabilities || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
    // 核心 Generator 的语义能力（scope=core 无 KP 绑定，由题型/能力反查补充）
    (g.questionTypes || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
  });

  // 无 Generator 直接绑定该 KP 时，回退解析链（CapabilityResolver 的能力集）
  if (capabilities.length === 0) {
    var Resolver = require("shared/capability-resolver.js");
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  kp.legacyPluginId = (kp.source && kp.source.pluginId) || null;
  return kp;
}

module.exports = {
  records: records,
  get: get,
  all: all,
  forKnowledgePoint: forKnowledgePoint,
  forQuestionType: forQuestionType,
  forSubject: forSubject,
  resolveChain: resolveChain,
  enhanceKp: enhanceKp
};

};
__defs["shared/learner/learner-model.js"] = function (module, exports, require) {
/**
 * shared/learner/learner-model.js — M6-R02 / R06 / R07 / R08 / R11 / R26
 *
 * Learner Model：知识点级掌握度模型。纯数据与规则，不触碰 Storage。
 *
 * 每个知识点维护：
 *   mastery            EMA 掌握度（R07）：mastery(t)=α×result+(1-α)×mastery(t-1)
 *   confidence         置信度（R08）：与 mastery 分离，随样本量与一致性增长
 *   attempts / correct / accuracy / recentAccuracy / recentResults（R06）
 *   errorPatterns      错因（R09，类型与计数由 ErrorModel 维护）
 *   exposureCount / lastPracticedAt
 *   recommendedDifficulty / recommendedSpiralLevel（默认推荐，权威值由 AdaptiveStrategy 覆盖）
 *
 * R11：Strategy 只能通过本 API 读取，禁止直接读 Storage。
 * R26：normalizeLearnerState() 统一容错（NaN/负数/>1 mastery/非法错因/旧版本数据）。
 */
(function (global) {
  'use strict';

  var ErrorModel = (typeof LearnerErrorModel !== 'undefined') ? LearnerErrorModel
    : (typeof require !== 'undefined' ? require("shared/learner/error-model.js") : null);
  if (!ErrorModel) throw new Error('learner-model.js 依赖 error-model.js');

  var VERSION = 1;
  var DEFAULT_ALPHA = 0.3;      // EMA 平滑系数
  var RECENT_WINDOW = 10;       // recentAccuracy 采用的最近结果数
  var RECENT_RESULTS_CAP = 20;  // recentResults 保留上限
  var DIFF_MIN = 1, DIFF_MAX = 10;

  // ===== 字段默认值 =====
  function defaultKpState(kpId) {
    return {
      kpId: kpId || null,
      mastery: 0,
      confidence: 0,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      recentAccuracy: 0,
      recentResults: [],
      errorPatterns: {},
      exposureCount: 0,
      lastPracticedAt: null,
      recommendedDifficulty: DIFF_MIN,
      recommendedSpiralLevel: 1,
      updatedAt: null
    };
  }

  // ===== 数值工具 =====
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }
  function clampDiff(n) {
    if (typeof n !== 'number' || !isFinite(n)) return DIFF_MIN;
    return Math.min(DIFF_MAX, Math.max(DIFF_MIN, Math.round(n)));
  }
  function clampLevel(n, max) {
    if (typeof n !== 'number' || !isFinite(n)) return 1;
    return Math.min(max, Math.max(1, Math.round(n)));
  }
  function nonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }

  // ===== R26 容错归一 =====
  function normalizeKpState(raw, kpId) {
    var d = defaultKpState(kpId);
    if (raw == null || typeof raw !== 'object') return d;
    d.mastery = clamp01(raw.mastery);
    d.confidence = clamp01(raw.confidence);
    d.attempts = nonNegInt(raw.attempts);
    d.correct = Math.min(nonNegInt(raw.correct), d.attempts); // 正确数不可能超过尝试数
    d.accuracy = clamp01(raw.accuracy != null ? raw.accuracy : (d.attempts ? d.correct / d.attempts : 0));
    d.exposureCount = nonNegInt(raw.exposureCount);
    d.recentResults = valuesAre01Array(raw.recentResults);
    d.recentAccuracy = clamp01(raw.recentAccuracy != null ? raw.recentAccuracy
      : (d.recentResults.length ? avg(d.recentResults) : d.accuracy));
    d.errorPatterns = ErrorModel.normalizePatterns(raw.errorPatterns);
    d.lastPracticedAt = isValidTs(raw.lastPracticedAt) ? raw.lastPracticedAt : null;
    d.updatedAt = isValidTs(raw.updatedAt) ? raw.updatedAt : null;
    d.recommendedDifficulty = clampDiff(raw.recommendedDifficulty == null ? DIFF_MIN : raw.recommendedDifficulty);
    d.recommendedSpiralLevel = clampLevel(raw.recommendedSpiralLevel == null ? 1 : raw.recommendedSpiralLevel, 6);
    // 旧数据/损坏数据缺失 mastery 字段时用准确率兜底（字段存在但越界时仍走 clamp，不触发兜底）
    if ((raw.mastery == null || typeof raw.mastery !== 'number' || !isFinite(raw.mastery)) && d.attempts) {
      d.mastery = recomputeMasteryFallback(d);
    }
    return d;
  }

  function recomputeMasteryFallback(s) {
    // 旧版本/损坏数据缺失 mastery 时的兜底（EMA 才是权威，仅当 attempts 存在且 mastery=0 时用）
    return s.attempts ? clamp01(s.correct / s.attempts) : 0;
  }

  function valuesAre01Array(v) {
    if (!Array.isArray(v)) return [];
    return v.map(function (x) {
      var n = Number(x);
      return (n === 0 || n === 1) ? n : 0;
    }).slice(-RECENT_RESULTS_CAP);
  }
  function avg(a) {
    if (!a.length) return 0;
    var s = 0;
    for (var i = 0; i < a.length; i++) s += a[i];
    return s / a.length;
  }
  function isValidTs(v) {
    return typeof v === 'number' && isFinite(v) && v > 0;
  }

  /**
   * 顶层状态归一（R26 统一入口）：处理字段缺失/NaN/负数/>1 mastery/非法错因/旧版本。
   * @param {Object} state
   * @returns {Object} { version, updatedAt, knowledgePoints: { [kpId]: KpState } }
   */
  function normalizeLearnerState(state) {
    var out = { version: VERSION, updatedAt: null, knowledgePoints: {} };
    if (state == null || typeof state !== 'object') return out;
    out.version = VERSION;
    out.updatedAt = isValidTs(state.updatedAt) ? state.updatedAt : null;
    var kps = (state && state.knowledgePoints != null && typeof state.knowledgePoints === 'object') ? state.knowledgePoints : {};
    if (state && state.mastery != null && typeof state === 'object' && state.kpId != null) {
      // 单知识点扁平状态 → 包装
      kps = {}; kps[String(state.kpId)] = state;
    }
    Object.keys(kps).forEach(function (kpId) {
      if (!kpId) return;
      out.knowledgePoints[kpId] = normalizeKpState(kps[kpId], kpId);
    });
    return out;
  }

  // ===== 存取 =====
  function get(state, kpId) {
    if (!kpId) return defaultKpState(null);
    state = normalizeLearnerState(state);
    if (!state.knowledgePoints[kpId]) return null; // 无记录 → null（区别于默认值，便于判断“是否学过”）
    return state.knowledgePoints[kpId];
  }

  function getOrInit(state, kpId) {
    var got = get(state, kpId);
    return got ? got : defaultKpState(kpId);
  }

  /** 更新（合并）单个知识点状态（R02 upsert）。 */
  function upsert(state, kpId, patch) {
    state = normalizeLearnerState(state);
    if (!kpId) return state;
    var cur = state.knowledgePoints[kpId] || defaultKpState(kpId);
    if (patch && typeof patch === 'object') {
      Object.keys(patch).forEach(function (k) {
        if (k === 'kpId' && patch[k] == null) return;
        if (patch[k] !== undefined) cur[k] = patch[k];
      });
    }
    cur.updatedAt = Date.now();
    // 一致化派生字段
    cur.accuracy = cur.attempts ? cur.correct / cur.attempts : 0;
    cur.recentAccuracy = cur.recentResults.length ? avg(cur.recentResults) : cur.accuracy;
    cur.kpId = kpId;
    cur = normalizeKpState(cur, kpId);
    state.knowledgePoints[kpId] = cur;
    state.updatedAt = cur.updatedAt;
    return state;
  }

  // ===== R07 EMA 掌握度 =====
  function computeMastery(kpState, result) {
    var prev = kpState ? clamp01(kpState.mastery) : 0;
    var res = result ? (result.correct === true ? 1 : 0) : 0;
    return clamp01(round3(DEFAULT_ALPHA * res + (1 - DEFAULT_ALPHA) * prev));
  }

  // ===== R08 置信度 =====
  function computeConfidence(kpState) {
    var s = kpState || defaultKpState(null);
    var rawN = s.attempts + (s.exposureCount || 0) * 0.5;
    if (rawN <= 0) return 0;
    var sizeFactor = 1 - Math.pow(0.75, rawN);           // 样本量增长（n=1.5→0.35, n=5→0.76, n=30→0.9998）
    var consistency = s.recentAccuracy != null ? clamp01(s.recentAccuracy)
      : (s.attempts ? s.correct / s.attempts : 0);
    var consistencyGain = 0.5 + 0.5 * consistency;
    return clamp01(round3(sizeFactor * consistencyGain * 0.9 + 0.1));
  }

  // ===== R06 KP 级准确率 =====
  function accuracyOf(s) { return s.attempts ? clamp01(s.correct / s.attempts) : 0; }
  function recentAccuracyOf(s, windowN) {
    var n = (typeof windowN === 'number' && windowN > 0) ? windowN : RECENT_WINDOW;
    var arr = (s.recentResults || []).slice(-n);
    return arr.length ? avg(arr) : accuracyOf(s);
  }

  // ===== 默认推荐（R14/R16 启发表；权威值由 AdaptiveStrategy 覆盖） =====
  function recommendDefaults(s, baseDifficulty) {
    var base = baseDifficulty == null ? DIFF_MIN : clampDiff(baseDifficulty);
    var m = clamp01(s.mastery);
    var adj = 0;
    if (m < 0.4) adj = -1;
    else if (m < 0.7) adj = 0;
    else if (m < 0.85) adj = 1;
    else adj = 2;
    // 低置信度削弱调整（R08 低样本防误判）
    var conf = clamp01(s.confidence);
    if (conf < 0.3) adj = Math.round(adj / 2);
    var spiral = m < 0.4 ? 1 : (m < 0.7 ? 2 : (m < 0.85 ? 3 : 4));
    if (conf < 0.3) spiral = Math.min(spiral, 2);
    return {
      recommendedDifficulty: clamp(base + adj, DIFF_MIN, DIFF_MAX),
      recommendedSpiralLevel: clampLevel(spiral, 6)
    };
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function round3(n) { return Math.round(n * 1000) / 1000; }

  // ===== R05/R11 核心更新入口 =====
  /**
   * @param {Object} state 顶层 LearnerModel 状态
   * @param {Object} result PracticeResult（必须含 knowledgePointId）
   * @param {Object} [opts] { alpha, baseDifficulty, now }
   * @returns {Object} 更新后的顶层状态
   */
  function update(state, result, opts) {
    opts = opts || {};
    if (!result || !result.knowledgePointId) {
      throw new Error('LearnerModel.update 需要含 knowledgePointId 的 PracticeResult');
    }
    state = normalizeLearnerState(state);
    var kpId = result.knowledgePointId;
    var kp = state.knowledgePoints[kpId] || defaultKpState(kpId);
    var ts = (typeof opts.now === 'number') ? opts.now : Date.now();
    var alpha = (typeof opts.alpha === 'number' && opts.alpha > 0 && opts.alpha <= 1) ? opts.alpha : DEFAULT_ALPHA;

    var isSkip = result.status === 'skipped';
    var isRedo = result.status === 'redo';

    // 答题结果归一：correct → 1，其余（wrong/unanswered）→ 0；跳过不进入掌握度
    var res = isSkip ? null : (result.correct === true ? 1 : 0);

    if (!isSkip) {
      kp.exposureCount += 1;
      if (!isRedo) {
        // 重做（纠正）：更新掌握度信号，但不重复计入 first-pass 正确率统计
        kp.attempts += 1;
        if (res === 1) kp.correct += 1;
      }
    } else {
      kp.exposureCount += 1;
    }

    // recentResults（跳过不记录，保持 0/1 语义）
    if (!isSkip) {
      kp.recentResults.push(res);
      if (kp.recentResults.length > RECENT_RESULTS_CAP) kp.recentResults = kp.recentResults.slice(-RECENT_RESULTS_CAP);
    }

    // MASTERY：EMA（跳过不更新）
    if (!isSkip) {
      var prevM = clamp01(kp.mastery);
      kp.mastery = clamp01(round3(alpha * res + (1 - alpha) * prevM));
      kp.recentAccuracy = round3(recentAccuracyOf(kp));
      kp.accuracy = kp.attempts ? clamp01(kp.correct / kp.attempts) : 0;
      kp.confidence = computeConfidence(kp);
    }

    // ERROR PATTERNS（R09/R10：仅来自 result.errorType 的可靠错因）
    var etype = ErrorModel.resolveErrorType(result);
    if (etype && !isSkip) {
      ErrorModel.recordError(kp.errorPatterns, etype, ts);
    }

    kp.lastPracticedAt = ts;
    kp.updatedAt = ts;

    // 默认推荐（可被 AdaptiveStrategy 覆盖）
    var rec = recommendDefaults(kp, opts.baseDifficulty);
    kp.recommendedDifficulty = rec.recommendedDifficulty;
    kp.recommendedSpiralLevel = rec.recommendedSpiralLevel;

    kp = normalizeKpState(kp, kpId);
    state.knowledgePoints[kpId] = kp;
    state.updatedAt = ts;
    return state;
  }

  // ===== R11 Mastery API =====
  function getMastery(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.mastery : 0;
  }
  function getConfidence(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.confidence : 0;
  }
  function getAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.accuracy : 0;
  }
  function getRecentAccuracy(state, kpId) {
    var kp = get(state, kpId);
    return kp ? kp.recentAccuracy : 0;
  }
  function getErrors(state, kpId) {
    var kp = get(state, kpId);
    return kp ? ErrorModel.getErrorFocus(kp.errorPatterns) : [];
  }
  function getState(state, kpId) {
    if (kpId == null) return normalizeLearnerState(state);
    var kp = get(state, kpId);
    return kp ? kp : defaultKpState(kpId);
  }

  var LearnerModel = {
    VERSION: VERSION,
    DEFAULT_ALPHA: DEFAULT_ALPHA,
    RECENT_WINDOW: RECENT_WINDOW,
    defaultKpState: defaultKpState,
    normalizeKpState: normalizeKpState,
    normalizeLearnerState: normalizeLearnerState,
    get: get,
    getOrInit: getOrInit,
    upsert: upsert,
    update: update,
    computeMastery: computeMastery,
    computeConfidence: computeConfidence,
    accuracyOf: accuracyOf,
    recentAccuracyOf: recentAccuracyOf,
    recommendDefaults: recommendDefaults,
    getMastery: getMastery,
    getConfidence: getConfidence,
    getAccuracy: getAccuracy,
    getRecentAccuracy: getRecentAccuracy,
    getErrors: getErrors,
    getState: getState,
    clear: function () { return { version: VERSION, updatedAt: null, knowledgePoints: {} }; }
  };

  global.LearnerModel = LearnerModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearnerModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
};
__defs["shared/generator/core/kp-arithmetic-semantics.js"] = function (module, exports, require) {
/**
 * shared/generator/core/kp-arithmetic-semantics.js — M4-R17 KP 级算术语义解析
 *
 * 将 Canonical KnowledgePoint 的 legacy 语义（source.legacyType）解析为可供
 * native 算术生成器与 legacy Adapter 共同消费的约束：
 *
 *   { operators: ['+','−']  | ['+'] | ['−'] | ['×'] | ['÷'],  steps: 1 }
 *
 * 作用：
 *   ① plan.constraints 注入 operation（算符集）与 exactSteps（精确步数），
 *     使 native arithmetic 生成器按 KP 语义固定算符/步数（不再按难度乱生成多步链）
 *   ② legacy Adapter 据此映射 operators，使对照公平（同一语义驱动）
 *
 * 仅解析「单步、单/双算符、纯算术」类 legacyType（addsub/add/sub/mult/div），
 * 其余（remainder/mixed/relation/multi1/twodigit/div1/fraction/decimal）返回 null，
 * 记为「不可用纯算术迁移」，由 BATCH 边界脚本决定保留 legacy 还是走专项模板生成器。
 */
'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

var SINGLE_STEP_PROFILE = {
  addsub: { operators: [OP_ADD, OP_SUB], steps: 1 },
  add: { operators: [OP_ADD], steps: 1 },
  sub: { operators: [OP_SUB], steps: 1 },
  mult: { operators: [OP_MUL], steps: 1 },
  div: { operators: [OP_DIV], steps: 1 }
};

// M4-R24 特殊口算族：legacy g4-oral 的整数域口算（除数是整十数/大数加减/三位乘一位/乘整十）。
// kind 供 native 生成器分派到对应的专用结构构造（镜像 legacy 粒度），不落入通用 generateStructure。
// M4-R25 扩展：g4/g5 口算的小数加减/小数乘除与运算律简便（见 docs/DEV_LOG.md 附录 C）。
var SPECIAL_ORAL_PROFILE = {
  'div-tens':   { operators: [OP_DIV], steps: 1, kind: 'div-tens' },
  'big-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'big-addsub' },
  'mul3x1':     { operators: [OP_MUL], steps: 1, kind: 'mul3x1' },
  'mul2tens':   { operators: [OP_MUL], steps: 1, kind: 'mul2tens' },
  'dec-addsub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'dec-addsub' },
  'law-oral':   { operators: [OP_MUL], steps: 1, kind: 'law-oral' },
  'dec-mul-oral': { operators: [OP_MUL], steps: 1, kind: 'dec-mul-oral' },
  'dec-div-oral': { operators: [OP_DIV], steps: 1, kind: 'dec-div-oral' },
  // M4-R26 简便计算（多步凑整）族
  'add-law':    { operators: [OP_ADD], steps: 2, kind: 'add-law' },
  'mul-law':    { operators: [OP_MUL], steps: 2, kind: 'mul-law' },
  // M4-R27 六上小数/负数族：负数加减口算（操作数含负）、小数乘法笔算（含 <1 因数）
  'neg-add-sub': { operators: [OP_ADD, OP_SUB], steps: 1, kind: 'neg-add-sub' },
  'dec-mult':   { operators: [OP_MUL], steps: 1, kind: 'dec-mult' }
};

var NON_MIGRATABLE = ['remainder', 'mixed', 'relation', 'multi1', 'twodigit', 'div1', 'fraction', 'decimal', 'g3', 'md'];

/**
 * 解析 KP 算术语义；无法由纯算术核心覆盖时返回 null。
 * @param {Object} kp Canonical KnowledgePoint
 * @param {Object} options { allowMultiStep: boolean } 默认 false（第一批仅单步）
 */
function resolveArithmeticSemantics(kp, options) {
  options = options || {};
  if (!kp || !kp.source) return null;
  var lt = kp.source.legacyType;

  if (NON_MIGRATABLE.indexOf(lt) !== -1) return null;

  var profile = SPECIAL_ORAL_PROFILE[lt] || SINGLE_STEP_PROFILE[lt];
  if (!profile) return null;

  var out = {
    operators: profile.operators.slice(),
    steps: profile.steps,
    legacyType: lt,
    migratable: true
  };
  if (profile.kind) out.kind = profile.kind;
  return out;
}

/** 供对照/回归脚本用：给定 KP 判断是否可经算术语义迁移 */
function isArithmeticMigratable(kp) {
  return !!resolveArithmeticSemantics(kp);
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  SINGLE_STEP_PROFILE: SINGLE_STEP_PROFILE,
  SPECIAL_ORAL_PROFILE: SPECIAL_ORAL_PROFILE,
  NON_MIGRATABLE: NON_MIGRATABLE,
  resolveArithmeticSemantics: resolveArithmeticSemantics,
  isArithmeticMigratable: isArithmeticMigratable
};
};
__defs["shared/generator/core/kp-complex-semantics.js"] = function (module, exports, require) {
/**
 * shared/generator/core/kp-complex-semantics.js — M4-R18 KP 级复杂运算语义解析
 *
 * 将 Canonical KnowledgePoint（源中 type = mixed/bracket/chain/multdiv/operator/mix）
 * 解析为可供 native 生成器消费的结构化约束：
 *
 *   { family, operators, steps, allowBracket, inverse? }
 *
 * 族分类（按 Plan 可表达性划分）：
 *   chain     — 纯链式运算（连加连减、乘除混合）
 *   no-bracket — 无括号混合运算（先乘除后加减，实质也是链式）
 *   bracket   — 有括号混合运算（括号包裹前两步）
 *   inverse   — 求未知数 / 填运算符
 *
 * 该模块是「Plan 语义承载」的核心：Generator 按 family 选择表达路径，
 * 不解释难度（难度→numberRange/maxSteps/allowBracket 由 StructureConstraints 完成）。
 */
'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

/**
 * Complex KP 结构描述表（仅限 R18 round-1 可迁移的 KP）。
 * key = KP id；若 KP 不在表中 → resolveComplexSemantics 返回 null（非本批迁移对象）。
 */
var COMPLEX_PROFILES = {
  // ─── chain（链式，纯算术）──────────────────────
  // g1: 连加连减：[+,−]，2 operators（3 operands），无括号，all positive
  'math-g1-m1-mixed-chain': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减与加减混合（g1）'
  },
  // g2-m3: 连加连减脱式：[+,−]，2 operators（3 operands），无括号，脱式显式
  'math-g2-m3-chain-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减脱式（g2-m3）'
  },
  // g2-m3: 乘除混合脱式：[×,÷]，2 operators（3 operands），无括号
  'math-g2-m3-multdiv-mixed': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合脱式（g2-m3）'
  },
  // g2-m1: 加减混合运算：[+,−]，2 operators（3 operands），无括号
  'math-g2-m1-mixed-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '加减混合运算（g2-m1）'
  },
  // g2-m1: 乘除混合运算：[×,÷]，2 operators（3 operands），无括号
  'math-g2-m1-mixed-multdiv': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合运算（g2-m1）'
  },

  // ─── no-bracket（混合运算，无括号）─────────────
  // g2-m3: 无括号混合运算：混合四种，2 operators（3 operands），无括号
  'math-g2-m3-mixed-no-bracket': {
    family: 'no-bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '无括号混合运算（先乘除后加减）'
  },

  // ─── bracket（有括号混合运算）───────────────────
  // g2-m3: 带括号混合运算：混合四种，2 operators（3 operands），括号包前两步
  'math-g2-m3-mixed-bracket': {
    family: 'bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: true,
    comment: '带括号混合运算（先算括号内）'
  },

  // ─── inverse（求未知数 / 填运算符）─────────────
  // g1-m4: 填未知数：+/-，求缺失加数/减数
  'math-g1-m4-num-fill-unknown': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operand' },
    comment: '在算式中填写未知的加数或减数'
  },
  // g2-m3: 填运算符号：任意四种运算符，缺失运算符
  'math-g2-m3-fill-operator': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operator' },
    comment: '在○填+、−、×、÷使等式成立'
  }
};

var COMPLEX_KP_IDS = Object.keys(COMPLEX_PROFILES);

/**
 * 解析 KP 的复杂运算结构语义；不在本批迁移范围时返回 null。
 * @param {Object} kp  Canonical KnowledgePoint
 * @returns {Object|null} { family, operators, steps, allowBracket, inverse? } 或 null
 */
function resolveComplexSemantics(kp) {
  if (!kp || !kp.id) return null;
  var profile = COMPLEX_PROFILES[kp.id];
  if (!profile) return null;

  return {
    family: profile.family,
    operators: profile.operators.slice(),
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    inverse: profile.inverse ? { mode: profile.inverse.mode } : null
  };
}

/** 判断 KP 是否属于本批复杂语义迁移范围 */
function isComplexMigratable(kpId) {
  return COMPLEX_KP_IDS.indexOf(kpId) !== -1;
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  COMPLEX_PROFILES: COMPLEX_PROFILES,
  COMPLEX_KP_IDS: COMPLEX_KP_IDS,
  resolveComplexSemantics: resolveComplexSemantics,
  isComplexMigratable: isComplexMigratable
};

};
__defs["shared/generator/generator-selector.js"] = function (module, exports, require) {
/**
 * shared/generator/generator-selector.js — M4-R13/R14 Generator 选择器
 *
 * 输入：QuestionPlan
 * 输出：最佳 Generator（记录 + source + match）
 *
 * 选择优先级：
 *   ① 知识点匹配  —— knowledgePoints 包含 plan.knowledgePointId
 *   ② 能力匹配    —— capabilities 包含 plan.questionTypeId
 *   ③ 题型匹配    —— questionTypes 包含 plan.questionTypeId
 *   ④ 难度范围匹配—— difficultyRange 覆盖 plan.difficulty
 *   ⑤ 版本        —— version 更高者优先
 *   ⑥ fallback    —— legacyPluginId 对应的 legacy Generator（无类型绑定）
 *
 * 双轨（M4-R14，Feature Flag generatorMode）：
 *   legacy  —— 只看旧插件轨道（scope=legacy）
 *   native  —— 只看核心 Generator 轨道（scope=core）；无候选时回退旧插件
 *   hybrid  —— 双轨并轨，按优先级选优
 *
 * 轨道的有效模式由 generator-mode.js 按 插件/知识点/题型/科目 覆盖解析。
 * 禁止 UI 直接选择 Generator：必须经本选择器（或 StrategyEngine）决策。
 */
'use strict';

var GenRegistry = require("shared/generator/generator-registry.js");
var KnowledgePoint = require("shared/knowledge-point.js");
var Mode = require("shared/generator/generator-mode.js");
// M7-R18：旧插件边界收敛到 shared/legacy/plugin-adapter.js
var LegacyBridge = require("shared/legacy/plugin-adapter.js");

function trackOf(record) {
  return record.scope === 'core' ? 'native' : 'legacy';
}

function selectGenerator(plan, options) {
  plan = plan || {};
  options = options || {};
  if (!plan.knowledgePointId) {
    throw new Error('GeneratorSelector: plan 缺少 knowledgePointId');
  }

  var mode = options.mode != null ? options.mode : Mode.resolve(plan);
  var kp = KnowledgePoint.get(plan.knowledgePointId);
  var all = GenRegistry.all();
  var candidates = [];

  all.forEach(function (g) {
    // 双轨过滤：根据有效模式决定本记录是否可达
    var track = trackOf(g);
    if (mode === 'legacy' && track !== 'legacy') return;
    if (mode === 'native' && track !== 'native') return;
    // hybrid：双轨都可达

    var score = { record: g, kp: 0, capability: 0, qt: 0, diff: 0 };

    // ① 知识点匹配
    if (g.knowledgePoints.indexOf(plan.knowledgePointId) !== -1) score.kp = 1;

    // ② 能力匹配
    if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;

    // ③ 题型匹配
    if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;

    // ④ 难度范围匹配（记录声明了 difficultyRange 才计分）
    if (g.difficultyRange && plan.difficulty != null) {
      if (plan.difficulty >= g.difficultyRange.min && plan.difficulty <= g.difficultyRange.max) score.diff = 1;
    }

    if (score.kp + score.capability + score.qt + score.diff > 0) candidates.push(score);
  });

  // 按优先级排序：kp > capability > qt > diff > version
  candidates.sort(function (a, b) {
    if (a.kp !== b.kp) return b.kp - a.kp;
    if (a.capability !== b.capability) return b.capability - a.capability;
    if (a.qt !== b.qt) return b.qt - a.qt;
    if (a.diff !== b.diff) return b.diff - a.diff;
    return (b.record.version || 1) - (a.record.version || 1); // ⑤ 版本
  });

  if (candidates.length === 0) {
    // ⑥ fallback：legacyPluginId → legacy Generator（native 轨无匹配时保留旧插件）
    if (mode !== 'legacy') {
      var legacyPluginId = kp && (kp.legacyPluginId || (kp.source && kp.source.pluginId));
      if (legacyPluginId) {
        var legacy = GenRegistry.get('legacy:' + legacyPluginId);
        if (legacy) {
          return { generatorId: legacy.id, source: 'fallback:legacy', record: legacy, mode: mode };
        }
      }
    }
    return { generatorId: null, source: 'none', record: null, mode: mode };
  }

  var best = candidates[0];
  return {
    generatorId: best.record.id,
    source: 'priority',
    record: best.record,
    match: { kp: best.kp, capability: best.capability, questionType: best.qt, difficulty: best.diff },
    mode: mode
  };
}

/**
 * 实例化选择结果：legacy 记录 → LegacyAdapter 包装；core 记录 → 核心 Generator 实例。
 * 仅在需要真正生成时调用（选择本身只用注册表数据）。
 *
 * R23：实例化后立即包装 generate —— 为每个 SemanticQuestion 附加可追溯元数据：
 *   metadata.generator / metadata.generatorVersion / metadata.seed
 * 保证历史题目可以追溯到来源 Generator 与版本。
 */
function instantiate(selection, plugin) {
  if (!selection || !selection.record) return null;
  var gen;
  if (selection.record.scope === 'core') {
    var Generators = require("shared/generator/generators/index.js");
    gen = Generators.get(selection.record.id);
  } else {
    // M7-R18：legacy 实例化统一经 shared/legacy/plugin-adapter.js（唯一旧插件边界）。
    gen = LegacyBridge.hydrateLegacyGenerator(selection, plugin);
    if (!gen) return null;
  }

  var generatorId = selection.record.id;
  var generatorVersion = toSemver(selection.record.version);

  return wrapGenerator(gen, generatorId, generatorVersion);
}

/** 数字版本 → "x.y.z" 语义化版本；已是字符串则原样保留 */
function toSemver(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return String(v == null ? '1.0.0' : v);
}

/** 包装 generate：为每个产出 sq 附加 metadata.generator/.generatorVersion/.seed */
function wrapGenerator(gen, generatorId, generatorVersion) {
  if (!gen || typeof gen.generate !== 'function') return gen;
  var orig = gen.generate.bind(gen);
  gen.generate = function (plan, context) {
    var out = orig(plan, context);
    if (out && typeof out.then === 'function') {
      return out.then(function (sqs) { return attachMeta(sqs, generatorId, generatorVersion); });
    }
    return attachMeta(out, generatorId, generatorVersion);
  };
  return gen;
}

function attachMeta(sqs, generatorId, generatorVersion) {
  if (!sqs) return sqs;
  var arr = Array.isArray(sqs) ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
  if (!arr) return sqs;
  arr.forEach(function (sq) {
    if (!sq) return;
    sq.metadata = sq.metadata || {};
    sq.metadata.generator = generatorId;
    sq.metadata.generatorVersion = generatorVersion;
    if (sq.seed != null) sq.metadata.seed = sq.seed;
  });
  return sqs;
}

module.exports = {
  selectGenerator: selectGenerator,
  instantiate: instantiate,
  Mode: Mode
};
};
__defs["shared/question-type-registry.js"] = function (module, exports, require) {
/**
 * shared/question-type-registry.js — 全局唯一题型注册表 (M2-01 / M2-02 / M2-03)
 *
 * 标准题型 ID 全部来自项目既有数据（M1 已归一化的 canonical 题型 + 显见几何类）：
 *   oral / calc / fill / choice / judge / apply / open / geometry
 * 禁止凭想象新增；legacy 细粒度 type/subtype 经 legacyTypeMap 归一到标准 ID。
 *
 * 归并策略（确定性、可审计）：
 *   1) 精确匹配标准 ID
 *   2) 显式 canonical 别名（operate->oral 等）
 *   3) 关键字启发式：几何关键字 -> geometry；认读关键字 -> recognize；其余 -> calc
 * 启发式归并结果在 verifier 中以 WARNING 暴露，不静默伪造。
 *
 * 纯数据 + 纯函数；不依赖 DOM / 插件 / 生成器。
 */
(function (global) {
  'use strict';

  var COGNITIVE_LEVELS = ['recall', 'recognize', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

  var TYPES = [
    { id: 'oral', name: '口算', category: 'calculation',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'calc', name: '计算', category: 'calculation',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: false, distractors: false } },
    { id: 'fill', name: '填空', category: 'written',
      cognitiveLevels: ['recall', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'choice', name: '选择', category: 'selection',
      cognitiveLevels: ['recognize', 'understand', 'apply'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: true } },
    { id: 'judge', name: '判断', category: 'selection',
      cognitiveLevels: ['recognize', 'understand'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'apply', name: '应用', category: 'application',
      cognitiveLevels: ['understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'open', name: '开放', category: 'open',
      cognitiveLevels: ['apply', 'analyze', 'create'], difficultyRange: [1, 6],
      supports: { context: true, graphic: true, distractors: false } },
    { id: 'geometry', name: '几何', category: 'geometry',
      cognitiveLevels: ['recognize', 'understand', 'apply', 'analyze'], difficultyRange: [1, 6],
      supports: { context: false, graphic: true, distractors: false } },
    { id: 'recognize', name: '认读', category: 'recognition',
      cognitiveLevels: ['recall', 'recognize', 'understand'], difficultyRange: [1, 4],
      supports: { context: false, graphic: true, distractors: false } }
  ];

  // 显式 canonical 别名（legacy type/subtype/format -> 标准 questionType）
  var CANONICAL_ALIASES = {
    operate: 'oral', oral: 'oral', 'law-oral': 'oral', 'dec-mul-oral': 'oral', 'dec-div-oral': 'oral',
    'frac-addsub-oral': 'oral', 'equation-oral': 'oral', 'mul-oral': 'oral',
    calc: 'calc', cushi: 'calc', addsub: 'calc', mixed: 'calc', mix: 'calc', column: 'calc',
    'chain-add': 'calc', 'chain-sub': 'calc', 'chain': 'calc', bracket: 'calc', 'multdiv': 'calc',
    add: 'calc', sub: 'calc', mult: 'calc', div: 'calc', remainder: 'calc',
    'mul-table': 'calc', 'div-table': 'calc', multiTable: 'calc', 'big-addsub': 'calc',
    'mul3x1': 'calc', 'mul2tens': 'calc', 'div-tens': 'calc', 'mul3x2': 'calc', 'mul-zero': 'calc',
    'div-2digit': 'calc', 'div-2quotient': 'calc', 'dec-vertical': 'calc', 'add-law': 'calc',
    'mul-law': 'calc', 'dist-law': 'calc', 'dec-simple': 'calc', 'dec-addsub': 'calc',
    'big-num': 'calc', dec: 'calc', vertical: 'calc', 'vertical-multi': 'calc', 'carry-complex': 'calc',
    'neg-add-sub': 'calc', 'dec-mult': 'calc', 'dec-div': 'calc', decimal: 'calc', negative: 'calc',
    'est-muldiv': 'calc', estimate: 'calc', rounding: 'calc', 'dec-meaning': 'calc', 'dec-place': 'calc',
    'dec-compare': 'calc', 'dec-mixed': 'calc', 'frac-mixed': 'calc', 'frac-simple': 'calc',
    'frac-line': 'calc', 'int-split': 'calc', 'frac-split': 'calc', 'frac-perc': 'calc',
    fill: 'fill', 'fill-length': 'fill', 'fill-mass': 'fill', 'fill-time': 'fill', cutfill: 'fill',
    choice: 'choice', matching: 'choice', 'match-shape': 'choice', 'match-clock': 'choice', 'match-rmb': 'choice',
    judge: 'judge', comparison: 'judge',
    apply: 'apply', word: 'apply', open: 'apply', 'big-app': 'apply', 'mul-travel': 'apply',
    'word-problem': 'apply', 'word-problems': 'apply',
    'div-share': 'apply', 'price-qty': 'apply', 'dec-pay': 'apply', 'avg-score': 'apply', 'dec-scene': 'apply',
    'dec-mul-app': 'apply', 'dec-div-app': 'apply', 'equation-app': 'apply', 'factor-app': 'apply',
    'frac-app': 'apply', 'area-app': 'apply', 'solid-app': 'apply', 'possibility-app': 'apply',
    'linechart-app': 'apply', 'tree-app': 'apply', 'speed-distance': 'apply', work: 'apply',
    concentration: 'apply', 'profit-loss': 'apply', age: 'apply', planting: 'apply', phalanx: 'apply',
    grass: 'apply', economics: 'apply', 'percent-discount': 'apply', ratio: 'apply', proportion: 'apply',
    percent: 'apply', optimize: 'apply', optimization: 'apply', 'journey-complex': 'apply', 'travel-work': 'apply',
    'sum-diff': 'apply', 'inclusion-exclusion': 'apply', equation: 'apply', fraction: 'apply', area: 'apply',
    rotation: 'apply', array: 'apply', magic: 'apply', sequence: 'apply', series: 'apply', recurring: 'apply',
    'chicken-rabbit': 'apply', pancake: 'apply', assume: 'apply', law: 'apply', quotient: 'apply', stats: 'apply',
    'big-compare': 'apply', horizontal: 'apply', symbol: 'apply', 'divisibility': 'apply', 'prime-factor': 'apply',
    'factor-count': 'apply', 'gcd-lcm': 'apply', 'perfect-square': 'apply', 'nt-extreme': 'apply',
    'add-principle': 'apply', 'mult-principle': 'apply', permutation: 'apply', enumeration: 'apply',
    bundling: 'apply', insertion: 'apply', 'stars-bars': 'apply', pigeonhole: 'apply', 'worst-case': 'apply',
    'area-basic': 'apply', 'equal-area': 'apply', 'bird-head': 'apply', 'butterfly': 'apply', 'swallow-tail': 'apply',
    half: 'apply', 'painted-cube': 'apply', pythagorean: 'apply', lattice: 'apply', boat: 'apply', circular: 'apply',
    'avg-speed': 'apply', 'ratio-prop': 'apply', 'ratio-simp': 'apply', 'frac-percent': 'apply', 'cy-cone': 'apply',
    'cyl-cone': 'apply', 'number-shape': 'apply', 'percent-ratio': 'apply', 'magic-adv': 'apply', 'array-adv': 'apply',
    competition: 'apply', modulo: 'apply', recursion: 'apply', derangement: 'apply', periodic: 'apply',
    'sequence-sum': 'apply', extremum: 'apply', winning: 'apply', 'define-op': 'apply', 'complex-frac': 'apply',
    diophantine: 'apply', eq1: 'apply', eq2: 'apply', 'frac-mult-int': 'apply', 'frac-mult-frac': 'apply',
    'frac-div-int': 'apply', 'frac-div-frac': 'apply', 'dec-perc': 'apply', 'frac-mult-div': 'apply',
    'solve-proportion': 'apply', 'frac-order': 'apply', 'solve-equation': 'apply', 'cylinder-cone': 'apply',
    formula: 'apply', chart: 'apply', 'rotate-scale': 'apply', 'frac-mult': 'apply', 'frac-div': 'apply', scale: 'apply',
    'dec-div-int': 'apply', 'dec-div-dec': 'apply', 'repeating-dec': 'apply', 'product-rule': 'apply',
    'repeating-note': 'apply', 'equation-prop': 'apply', 'prime-composite': 'apply', 'frac-meaning': 'apply',
    'frac-property': 'apply', 'frac-decimal': 'apply', coordinate: 'apply', 'area-formula': 'apply',
    'solid-formula': 'apply', 'rotation-elem': 'apply', possibility: 'apply', 'linechart-feature': 'apply',
    'solid-feature': 'apply', 'possibility-desc': 'apply', 'equation-solve': 'apply', 'rotation-draw': 'apply',
    'observe-3d': 'apply', 'polygon-height': 'apply', 'coordinate-plot': 'apply', 'solid-net': 'apply',
    'balance-equation': 'apply', 'area-picture': 'apply', 'tree-planting': 'apply', 'possibility-compare': 'apply',
    'linechart-single': 'apply', 'linechart-double': 'apply', 'tree-three': 'apply', defective: 'apply',
    'defective-scale': 'apply', 'dec-mul-vertical': 'apply',
    geometry: 'geometry', circle: 'geometry', angle: 'geometry', clock: 'geometry', 'clock-read': 'geometry',
    'clock-draw': 'geometry', clockFace: 'geometry', shape: 'geometry', 'draw-shape': 'geometry', symmetry: 'geometry',
    translate: 'geometry', perimeter: 'geometry', rect: 'geometry', compass: 'geometry', 'line-ray': 'geometry',
    'angle-metric': 'geometry', quad: 'geometry', 'op-meaning': 'geometry', 'quotient-law': 'geometry',
    triangle: 'geometry', average: 'geometry', 'angle-degree': 'geometry', 'shape-feature': 'geometry',
    'law-formula': 'geometry', 'dec-frac': 'geometry', protractor: 'geometry', 'parallel-perp': 'geometry',
    'grid-quad': 'geometry', observe: 'geometry', 'segment-multiple': 'geometry', 'brace-addsub': 'geometry',
    'area-hectare': 'geometry', hectare: 'geometry', solid: 'geometry', flat: 'geometry', 'count-graph': 'geometry',
    position: 'geometry', grid: 'geometry', 'draw-line': 'geometry', 'draw-angle': 'geometry', measure: 'geometry',
    motion: 'geometry', transform: 'geometry', basic: 'geometry', meet: 'geometry', chase: 'geometry', train: 'geometry',
    river: 'geometry', extreme: 'geometry', drawer: 'geometry', integrated: 'geometry', misc: 'geometry', mock: 'geometry',
    'geometry-count': 'geometry', 'circle-angle': 'geometry', 'solid-rotation': 'geometry', 'interval-departure': 'geometry',
    'pick-up': 'geometry', mixture: 'geometry', all: 'geometry', 'factor-multiple': 'geometry',
    read: 'recognize', number: 'recognize', count: 'recognize', tally: 'recognize', enum: 'recognize',
    classify: 'recognize', table: 'recognize', picto: 'recognize', set: 'recognize', place: 'recognize',
    am: 'recognize', perm: 'recognize', pa: 'recognize', digit: 'recognize', composite: 'recognize', shard: 'recognize',
    ym: 'recognize', relation: 'recognize', operator: 'recognize', readwrite: 'recognize', approx: 'recognize',
    length: 'recognize', mass: 'recognize', time: 'recognize', pattern: 'recognize', 'mult-meaning': 'recognize',
    'div-meaning': 'recognize', unit: 'recognize', convert: 'recognize', order: 'recognize', compare: 'recognize',
    'big-compare': 'recognize', parity: 'recognize', divisible: 'recognize', prime: 'recognize', factor: 'recognize',
    'digit-reason': 'recognize'
  };

  var GEOMETRY_KEYWORDS = [
    'angle', 'shape', 'clock', 'circle', 'symmetry', 'coordinate', 'draw', 'grid', 'line', 'ray',
    'perimeter', 'area', 'solid', 'rotate', 'rotation', 'translate', 'scale', 'cylinder', 'cone',
    'triangle', 'quad', 'parallel', 'perpendicular', 'protractor', 'compass', 'segment', 'polygon',
    'lattice', 'pythagorean', 'geometry', 'observe-3d', 'solid-net', 'solid-feature', 'rotation-elem',
    'rotation-draw', 'polygon-height', 'coordinate-plot', 'geomcount', 'geometry-count', 'grid-quad',
    'circle-angle', 'solid-rotation', 'angle-degree', 'angle-metric', 'shape-feature', 'line-ray',
    'draw-line', 'draw-angle', 'draw-shape', 'motion', 'transform', 'count-graph', 'measure'
  ];

  var RECOGNIZE_KEYWORDS = [
    'read', 'number', 'count', 'tally', 'enum', 'classify', 'table', 'picto', 'set', 'place',
    'digit', 'composite', 'shard', 'ym', 'relation', 'operator', 'readwrite', 'approx', 'length',
    'mass', 'time', 'pattern', 'meaning', 'unit', 'convert', 'order', 'compare', 'parity',
    'divisible', 'prime', 'factor', 'recognize', 'recall'
  ];

  var BY_ID = {};
  TYPES.forEach(function (t) { BY_ID[t.id] = t; });

  function isCognitiveLevel(v) { return COGNITIVE_LEVELS.indexOf(v) !== -1; }

  function normalizeQuestionType(token, opts) {
    opts = opts || {};
    if (!token || typeof token !== 'string') return { id: null, confidence: 'none' };
    if (BY_ID[token]) return { id: token, confidence: 'exact' };
    var mapped = CANONICAL_ALIASES[token];
    if (mapped) return { id: mapped, confidence: 'explicit' };
    var lower = token.toLowerCase();
    var i;
    for (i = 0; i < GEOMETRY_KEYWORDS.length; i++) {
      if (lower.indexOf(GEOMETRY_KEYWORDS[i]) !== -1) return { id: 'geometry', confidence: 'heuristic' };
    }
    for (i = 0; i < RECOGNIZE_KEYWORDS.length; i++) {
      if (lower.indexOf(RECOGNIZE_KEYWORDS[i]) !== -1) return { id: 'recognize', confidence: 'heuristic' };
    }
    if (opts.allowHeuristic !== false) return { id: 'calc', confidence: 'heuristic' };
    return { id: null, confidence: 'unmapped' };
  }

  function validateType(t) {
    var errs = [];
    if (!t || !t.id) errs.push('题型缺少 id');
    if (!t.name) errs.push('题型缺少 name');
    if (!t.category) errs.push('题型缺少 category');
    if (!Array.isArray(t.cognitiveLevels) || t.cognitiveLevels.length === 0) errs.push('cognitiveLevels 非法');
    else t.cognitiveLevels.forEach(function (c) { if (!isCognitiveLevel(c)) errs.push('非法 cognitiveLevel: ' + c); });
    if (!Array.isArray(t.difficultyRange) || t.difficultyRange.length !== 2) errs.push('difficultyRange 非法');
    else {
      var lo = t.difficultyRange[0], hi = t.difficultyRange[1];
      if (typeof lo !== 'number' || typeof hi !== 'number' || lo < 1 || hi > 6 || lo > hi) errs.push('difficultyRange 越界: ' + lo + '-' + hi);
    }
    if (!t.supports || typeof t.supports !== 'object') errs.push('supports 非法');
    else {
      ['context', 'graphic', 'distractors'].forEach(function (k) {
        if (typeof t.supports[k] !== 'boolean') errs.push('supports.' + k + ' 必须为布尔');
      });
    }
    return errs;
  }

  var validationErrors = [];
  var seen = {};
  TYPES.forEach(function (t) {
    if (seen[t.id]) validationErrors.push('重复题型 ID: ' + t.id);
    seen[t.id] = 1;
    validateType(t).forEach(function (e) { validationErrors.push(t.id + ' :: ' + e); });
  });

  var API = {
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    TYPES: TYPES,
    canonicalAliases: CANONICAL_ALIASES,
    get: function (id) { return BY_ID[id] || null; },
    has: function (id) { return !!BY_ID[id]; },
    all: function () { return TYPES.slice(); },
    byCategory: function (category) { return TYPES.filter(function (t) { return t.category === category; }); },
    supports: function (id, capability) {
      var t = BY_ID[id];
      if (!t) return false;
      return !!(t.supports && t.supports[capability]);
    },
    normalizeQuestionType: normalizeQuestionType,
    validate: function (id) {
      var t = BY_ID[id];
      if (!t) return { valid: false, errors: ['未知题型 ID: ' + id] };
      return { valid: validationErrors.length === 0, errors: validateType(t) };
    },
    validationErrors: validationErrors
  };

  global.QuestionTypeRegistry = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-point.js"] = function (module, exports, require) {
/**
 * shared/knowledge-point.js — Canonical KnowledgePoint 访问层 (M1-R03)
 *
 * 合规方案：绝不修改 KnowledgeBank。
 * KnowledgeBank 继续返回原始 Legacy 数据；本层只做：
 *   Legacy KP -> Ontology.normalize -> Canonical KnowledgePoint
 *
 * KnowledgeBank 既有方法（findGrade / getEntries / getCoverage / suggestNext）
 * 行为完全不变；本层是只读封装，无缓存、无语义变化、不接入 practice.html。
 */
(function (global) {
  'use strict';

  var KnowledgeBank = require("shared/knowledge-bank.js");
  var Ontology = require("shared/knowledge-ontology.js");
  var SUBJECTS = Ontology.SUBJECTS;

  function findLegacy(id) {
    for (var si = 0; si < SUBJECTS.length; si++) {
      var arr = KnowledgeBank[SUBJECTS[si]];
      if (!Array.isArray(arr)) continue;
      for (var gi = 0; gi < arr.length; gi++) {
        var g = arr[gi];
        if (!g || !g.modules) continue;
        for (var mi = 0; mi < g.modules.length; mi++) {
          var kps = g.modules[mi].knowledgePoints;
          if (!Array.isArray(kps)) continue;
          for (var ki = 0; ki < kps.length; ki++) {
            if (kps[ki] && kps[ki].id === id) return kps[ki];
          }
        }
      }
    }
    return null;
  }

  function get(id) {
    var legacy = findLegacy(id);
    if (!legacy) return null;
    return Ontology.normalize(legacy);
  }

  var API = { get: get, findLegacy: findLegacy };

  global.KnowledgePoint = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/strategy-config.js"] = function (module, exports, require) {
/**
 * shared/strategy-config.js — M3 Feature Flag & Strategy Config
 *
 * 统一策略引擎的特性开关与配置。
 * 默认保持 'legacy' 以维持现有行为零修改。
 */
'use strict';

var STRATEGY_VERSION = '1.0.0';
var DEFAULT_STRATEGY = 'legacy'; // 'legacy' | 'strategy-v1'

// 内部状态（运行时仅读，启动时确定）
var _currentStrategy = null;
var _configOverrides = {};

function getStrategy() {
  if (_currentStrategy) return _currentStrategy;
  // 优先级：环境变量 > 全局配置 > 默认
  if (typeof process !== 'undefined' && process.env && process.env.GENERATION_STRATEGY) {
    return process.env.GENERATION_STRATEGY;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__GENERATION_STRATEGY__) {
    return globalThis.__GENERATION_STRATEGY__;
  }
  return DEFAULT_STRATEGY;
}

function setStrategy(strategy) {
  if (strategy !== 'legacy' && strategy !== 'strategy-v1') {
    throw new Error('Invalid strategy: ' + strategy + ' (expected "legacy" | "strategy-v1")');
  }
  _currentStrategy = strategy;
  if (typeof globalThis !== 'undefined') {
    globalThis.__GENERATION_STRATEGY__ = strategy;
  }
}

function isLegacy() {
  return getStrategy() === 'legacy';
}

function isStrategyV1() {
  return getStrategy() === 'strategy-v1';
}

function getConfig() {
  return {
    version: STRATEGY_VERSION,
    current: getStrategy(),
    overrides: _configOverrides,
    features: {
      strategyEngine: isStrategyV1(),
      legacyFallback: isLegacy()
    }
  };
}

function setConfigOverrides(overrides) {
  _configOverrides = Object.assign({}, _configOverrides, overrides);
}

function reset() {
  _currentStrategy = null;
  _configOverrides = {};
}

module.exports = {
  STRATEGY_VERSION: STRATEGY_VERSION,
  DEFAULT_STRATEGY: DEFAULT_STRATEGY,
  getStrategy: getStrategy,
  setStrategy: setStrategy,
  isLegacy: isLegacy,
  isStrategyV1: isStrategyV1,
  getConfig: getConfig,
  setConfigOverrides: setConfigOverrides,
  reset: reset
};
};
__defs["shared/generator/generator-mode.js"] = function (module, exports, require) {
/**
 * shared/generator/generator-mode.js — M4-R14 Generator Feature Flag
 *
 * 新旧 Generator 双轨运行的开关，支持四级粒度覆盖（从最具体到最宽泛）：
 *
 *   generatorMode:
 *     "legacy"  —— 双轨中只跑旧插件（LegacyAdapter）
 *     "hybrid"  —— 双轨并行：旧插件与核心 Generator 都作为候选，按优先级选优
 *     "native"  —— 双轨中只跑核心 Generator（无匹配时回退旧插件）
 *
 * 覆盖粒度（更具体者优先）：
 *   ① 单插件      override('plugin', 'math-oral', 'native')
 *   ② 单知识点    override('knowledgePoint', 'math-g1-m1-addsub-5', 'native')
 *   ③ 单题型      override('questionType', 'calc', 'legacy')
 *   ④ 单科目      override('subject', 'math', 'hybrid')
 *   ⑤ 全局        setGlobal('hybrid')
 *
 * 解析：resolve(plan) → 有效模式（供 GeneratorSelector 决策）。
 * 该模块是纯配置层：不持执行逻辑、不加载插件。
 */
'use strict';

var MODES = ['legacy', 'hybrid', 'native'];
var SCOPES = ['plugin', 'knowledgePoint', 'questionType', 'subject'];

// 科目双命名归一：registry 用 chinese/english，knowledge-point 用 cn/en
var SUBJECT_ALIASES = { cn: 'chinese', chinese: 'chinese', en: 'english', english: 'english', math: 'math' };

function canonicalSubject(subject) {
  if (typeof subject !== 'string') return subject;
  return SUBJECT_ALIASES[subject] || subject;
}

var globalMode = 'hybrid';      // 默认双轨并行
var overrides = {               // scope → key → mode
  plugin: {},
  knowledgePoint: {
    // P4-R04: Hybrid KP 切换到 Native 模式（62 个 Hybrid KP，排除 judge 类）
    'math-g1-m1-addsub-10': 'native',
    'math-g1-m1-addsub-100': 'native',
    'math-g1-m1-addsub-5': 'native',
    'math-g1-m1-carry-add-20': 'native',
    'math-g1-m1-mixed-chain': 'native',
    'math-g1-m1-retreat-sub-20': 'native',
    'math-g1-m1-two-digit-add': 'native',
    'math-g1-m12-choice-mixed': 'native',
    'math-g1-m13-division-table': 'native',
    'math-g1-m13-fill-blank': 'native',
    
    'math-g1-m4-num-fill-unknown': 'native',
    'math-g1-m5-match-calc': 'native',
    'math-g1-m5-match-clock': 'native',
    'math-g1-m5-match-rmb': 'native',
    'math-g1-m5-match-shape': 'native',
    'math-g2-m1-addsub-1000': 'native',
    'math-g2-m1-div-table': 'native',
    'math-g2-m1-mixed-addsub': 'native',
    'math-g2-m1-mixed-multdiv': 'native',
    'math-g2-m1-muldiv-relation': 'native',
    'math-g2-m1-mult-table': 'native',
    'math-g2-m12-choice-mixed': 'native',
    'math-g2-m2-div-col': 'native',
    'math-g2-m2-mult-col': 'native',
    'math-g2-m3-chain-addsub': 'native',
    'math-g2-m3-fill-operator': 'native',
    'math-g2-m3-mixed-bracket': 'native',
    'math-g2-m3-mixed-no-bracket': 'native',
    'math-g2-m3-multdiv-mixed': 'native',
    'math-g2-m4-division-meaning': 'native',
    'math-g2-m4-fill-length': 'native',
    'math-g2-m4-fill-mass': 'native',
    'math-g2-m4-fill-time': 'native',
    'math-g2-m4-length-unit': 'native',
    'math-g2-m4-mass-unit': 'native',
    'math-g2-m4-multiplication-meaning': 'native',
    'math-g2-m4-time-unit': 'native',
    'math-g2-m5-match-multdiv': 'native',
    'math-g2-m7-pic-div': 'native',
    'math-g2-m7-pic-div-include': 'native',
    'math-g2-m7-pic-mult': 'native',
    'math-g2-m8-div-partitive': 'native',
    'math-g2-m8-div-quotative': 'native',
    'math-g2-m8-mult-total': 'native',
    'math-g3-m1-g3-div1': 'native',
    'math-g3-m1-g3-mul-multi1': 'native',
    'math-g3-m4-g3-measure': 'native',
    'math-g4-c2-c2-divisible': 'native',
    'math-g4-c4-c4-count': 'native',
    'math-g4-c4-c4-cutfill': 'native',
    'math-g4-c4-c4-pa': 'native',
    'math-g4-c4-c4-solid': 'native',
    'math-g4-m1-g4-oral-big': 'native',
    'math-g4-m1-g4-oral-dec': 'native',
    'math-g4-m1-g4-oral-divt': 'native',
    'math-g4-m1-g4-oral-law': 'native',
    'math-g4-m1-g4-oral-mul2t': 'native',
    'math-g4-m1-g4-oral-mul3x1': 'native',
    'math-g5-m1-g5-oral-decmul': 'native',
    'math-g5-m1-g5-oral-decdiv': 'native',
    'math-g4-m2-g4-v-div2': 'native',
    'math-g4-m2-g4-v-div2q': 'native',
    'math-g4-m8-g4-word-div': 'native',
    'math-g5-c2-divisibility': 'native',
    'math-g6-c1-vertical-multidigit': 'native',
    'math-g6-c2-divisibility': 'native',
    'math-g6-c3-multiplication-principle': 'native',
    // M4-R26: 简便计算（凑整）家族 native 切换
    'math-g4-m3-g4-mix-addlaw': 'native',
    'math-g4-m3-g4-mix-mullaw': 'native',
    // M4-R27: 六上小数/负数家族 native 切换
    'math-g6-m1-g6-oral-neg-add-sub': 'native',
    'math-g6-m2-g6-calc-dec-mult': 'native'
  },
  questionType: {},
  subject: {}
};

function isValidMode(mode) {
  return typeof mode === 'string' && MODES.indexOf(mode) !== -1;
}

function isValidScope(scope) {
  return typeof scope === 'string' && SCOPES.indexOf(scope) !== -1;
}

function setGlobal(mode) {
  if (!isValidMode(mode)) {
    throw new Error('GeneratorMode: 非法 generatorMode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  }
  globalMode = mode;
  return globalMode;
}

function getGlobal() {
  return globalMode;
}

/**
 * 设定单粒度覆盖。
 * @param {string} scope  plugin|knowledgePoint|questionType|subject
 * @param {string} key    pluginId / kpId / questionTypeId / subject（math|chinese|english）
 * @param {string} mode   legacy|hybrid|native
 */
function override(scope, key, mode) {
  if (!isValidScope(scope)) {
    throw new Error('GeneratorMode: 非法 scope="' + scope + '"（合法值: ' + SCOPES.join('/') + '）');
  }
  if (key == null || key === '') {
    throw new Error('GeneratorMode: ' + scope + ' 覆盖缺少 key');
  }
  if (!isValidMode(mode)) {
    throw new Error('GeneratorMode: 非法 mode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  }
  var mapKey = scope === 'subject' ? canonicalSubject(key) : String(key);
  overrides[scope][mapKey] = mode;
  return mode;
}

function clearOverride(scope, key) {
  if (!isValidScope(scope)) return;
  if (key == null) {
    overrides[scope] = {};
    return;
  }
  var mapKey = scope === 'subject' ? canonicalSubject(key) : String(key);
  delete overrides[scope][mapKey];
}

function clearAll() {
  globalMode = 'hybrid';
  SCOPES.forEach(function (s) { overrides[s] = {}; });
}

function dump() {
  var out = { generatorMode: globalMode };
  SCOPES.forEach(function (s) {
    out[s + 'Overrides'] = Object.assign({}, overrides[s]);
  });
  return out;
}

/**
 * 解析 plan 的有效 generatorMode（更具体覆盖优先）。
 *
 * plan 需要 knowledgePointId（→ 该 KP 的 legacyPluginId）、可选 questionTypeId 与 subject。
 * 链：plugin → knowledgePoint → questionType → subject → global。
 *
 * @returns {string} legacy|hybrid|native
 */
function resolve(plan) {
  plan = plan || {};
  var kp = null;
  var legacyPluginId = plan.legacyPluginId;

  if (plan.knowledgePointId) {
    try {
      var KnowledgePoint = require("shared/knowledge-point.js");
      kp = KnowledgePoint.get(plan.knowledgePointId);
      if (kp) {
        if (legacyPluginId == null) {
          legacyPluginId = kp.legacyPluginId || (kp.source && kp.source.pluginId) || null;
        }
        if (plan.subject == null) plan.subject = kp.subject;
      }
    } catch (e) { /* KP 缺失不影响模式解析 */ }
  }

  if (legacyPluginId && overrides.plugin[legacyPluginId]) return overrides.plugin[legacyPluginId];
  if (plan.knowledgePointId && overrides.knowledgePoint[plan.knowledgePointId]) return overrides.knowledgePoint[plan.knowledgePointId];
  if (plan.questionTypeId && overrides.questionType[plan.questionTypeId]) return overrides.questionType[plan.questionTypeId];
  if (plan.subject) {
    var subjectKey = canonicalSubject(plan.subject);
    if (overrides.subject[subjectKey]) return overrides.subject[subjectKey];
  }

  return globalMode;
}

module.exports = {
  MODES: MODES,
  SCOPES: SCOPES,
  setGlobal: setGlobal,
  getGlobal: getGlobal,
  override: override,
  clearOverride: clearOverride,
  clearAll: clearAll,
  dump: dump,
  resolve: resolve
};
};
__defs["shared/render.js"] = function (module, exports, require) {
/**
 * shared/render.js — 插件渲染与工厂（任务 3.2 拆分）
 *
 * renderCard / renderGrid / clockSVG / createPlugin 及科目化工厂（math/chinese/english）。
 * 增量挂载到 window.PluginUtil；跨模块裸调用（createPlugin → defaultQCheck / _maybeReportCoverage）
 * 经全局解析（check.js / core.js 已挂全局）。
 */
(function (global) {
  'use strict';

  function renderCard(q, idx, opts) {
    opts = opts || {};
    var st = function (key, extra) {
      var s = (extra || '');
      return s ? ' style="' + s + '"' : '';
    };
    var inpW = opts.inputWidth || 96;
    // 宽度为动态值：显式 inputWidth 时内联输出，否则走 CSS 类默认 96px
    var inpWStyle = opts.inputWidth ? 'width:' + inpW + 'px;' : '';
    var svgHtml = '';
    if (q.svg) {
      svgHtml = '<div class="scene-box"' + st('scene-box') + '>' + q.svg + '</div>';
    }
    var hintHtml = q.hint ? '<div class="q-hint"' + st('q-hint') + '>💡 ' + q.hint + '</div>' : '';
    var badgeHtml = '';
    if (opts.badgeLabels && q.type && opts.badgeLabels[q.type]) {
      badgeHtml = '<span class="badge"' + st('badge') + '>' + opts.badgeLabels[q.type] + '</span>';
    }
    var formulaHtml = '<span class="qa-label"' + st('qa-label') + '>算式</span>' +
      '<input type="text" class="formula-inp" data-formula="' + idx + '" placeholder="列式" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 列式"' + st('formula-inp', 'width:120px;') + '>' +
      '<span class="qa-label"' + st('qa-label') + '>答案</span>';
    var inputHtml = '';
    if (q.inputType === 'choice') {
      var optsHtml = '';
      (q.options || []).forEach(function (o) {
        optsHtml += '<button type="button" class="opt" role="radio" aria-checked="false" data-val="' + String(o).replace(/"/g, '&quot;') + '" aria-label="第 ' + (idx + 1) + ' 题 选项：' + o + '" onclick="window.__pickOpt(this)"' + st('opt') + '>' + o + '</button>';
      });
      inputHtml = '<div class="options" role="radiogroup" aria-label="第 ' + (idx + 1) + ' 题 选项"' + st('options') + '>' + optsHtml + '</div>' +
        '<input type="hidden" data-index="' + idx + '">';
    } else if (q.inputType === 'multi') {
      var count = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      var inputs = '';
      for (var j = 0; j < count; j++) {
        inputs += '<input type="text" class="answer-inp" data-idx="' + idx + '" data-field="' + j + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 第 ' + (j + 1) + ' 空"' + st('answer-inp', inpWStyle) + '>';
      }
      inputHtml = '<div class="input-group"' + st('input-group') + '>' + inputs + '</div>';
    } else {
      inputHtml = '<div class="input-group"' + st('input-group') + '>' +
        '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 答案"' + st('answer-inp', inpWStyle) + '>' +
        (q.unit ? '<span class="unit"' + st('unit') + '>' + q.unit + '</span>' : '') +
        '</div>';
    }
    var qaRowHtml = '<div class="qa-row"' + st('qa-row') + '>' + formulaHtml + inputHtml + '</div>';
    var qTextHtml = q.rawHtml ? (q.q || '') : '<span class="q-text">' + (q.q || q.text || '') + '</span>';
    var qHeaderHtml = '<div class="q-header"' + st('q-header') + '>' +
      '<span class="num"' + st('num') + '>' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      qTextHtml +
      '</div>';
    return '<div class="question-card" data-index="' + idx + '" role="group" aria-label="第 ' + (idx + 1) + ' 题"' + st('question-card') + '>' +
      qHeaderHtml +
      badgeHtml +
      svgHtml +
      qaRowHtml +
      hintHtml +
      '<div class="feedback"' + st('feedback') + ' aria-live="polite"></div>' +
      '</div>';
  }

  /** 渲染整组题目（网格） */
  function renderGrid(questions, opts) {
    opts = opts || {};
    var cols = opts.columns || 3;
    var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
    questions.forEach(function (q, i) { html += renderCard(q, i, opts); });
    return html + '</div>';
  }

  // ============ 通用时钟 SVG（插件统一调用，避免各插件重复定义） ============
  /**
   * 统一的时钟 SVG（12 小时制，支持任意分钟；整时传 minute=0）。
   * 供 math-clock / math-time-date 等插件统一调用，单一来源、避免漂移。
   * @param {number} hour   小时（0~12，自动取模）
   * @param {number} [minute=0] 分钟
   * @returns {string} SVG 字符串
   */
  function clockSVG(hour, minute) {
    hour = ((hour % 12) + 12) % 12;
    minute = minute || 0;
    var cx = 60, cy = 60, r = 54;
    var hAngle = (hour % 12) * 30 + minute * 0.5;  // 12 点为 0°
    var mAngle = minute * 6;
    var hRad = (hAngle - 90) * Math.PI / 180;
    var mRad = (mAngle - 90) * Math.PI / 180;
    var hx = cx + 26 * Math.cos(hRad);
    var hy = cy + 26 * Math.sin(hRad);
    var mx = cx + 42 * Math.cos(mRad);
    var my = cy + 42 * Math.sin(mRad);
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = (i * 30 - 90) * Math.PI / 180;
      var r1 = (i % 3 === 0) ? 46 : 49;
      ticks += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#9aa6bd" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }
    // 钟面数字：0° 为 12 点方向，顺时针 90°/180°/270° 分别对应 3/6/9 点
    var nums = [[12, 0], [3, 90], [6, 180], [9, 270]];
    var numHtml = '';
    nums.forEach(function (n) {
      var a = (n[1] - 90) * Math.PI / 180;
      var nx = cx + 40 * Math.cos(a);
      var ny = cy + 40 * Math.sin(a) + 4;
      numHtml += '<text x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle" font-size="14" fill="#5b6b85" font-weight="700">' + n[0] + '</text>';
    });
    return '<svg width="120" height="120" viewBox="0 0 120 120" style="background:#fff;border-radius:50%;">' +
      '<circle cx="60" cy="60" r="54" fill="#fafbff" stroke="#5b8def" stroke-width="3"/>' +
      ticks + numHtml +
      '<line x1="60" y1="60" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#27324a" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="60" y1="60" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#e8870a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="4" fill="#27324a"/>' +
      '</svg>';
  }

  // ============ 插件工厂 createPlugin ============
  /**
   * 插件工厂：开发者只需提供 generateQuestions(opts)，自动生成标准 generate/render/check。
   *
   * @param {Object} config
   *   id/name/subject/grades 必填；generateQuestions(opts) 必填，返回标准题目数组
   *   （每题含 answer + render(idx)，可选 check）。
   *   可选：category / description / printConfig / settings / knowledgePoints（声明覆盖的知识点 id/name）
   *        / columns（网格列数）/ meta / render（自定义整组渲染）/ check（自定义整组批改）。
   *        其余字段（如 __choose 等交互方法）原样挂载到插件对象。
   * @returns {Object} 标准 ExercisePlugin 对象（含 generate/render/check）
   */
  function createPlugin(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('createPlugin(config)：配置对象缺失');
    }
    var id = config.id, name = config.name, subject = config.subject, grades = config.grades;
    if (!id || typeof id !== 'string') console.error('[createPlugin] 插件 ' + (name || '?') + ' 缺少必填字段 id（字符串）');
    if (!name) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 name');
    if (!subject) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 subject');
    if (!grades || !Array.isArray(grades) || !grades.length) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 grades（非空数组）');
    if (typeof config.generateQuestions !== 'function') console.error('[createPlugin] 插件 ' + id + ' 必须提供 generateQuestions(opts) 函数');

    var _kb = (typeof global.KnowledgeBank !== 'undefined') ? global.KnowledgeBank : null;

    function defaultRender(set) {
      var cols = (set && set.meta && set.meta.columns) || config.columns || 3;
      var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
      set.questions.forEach(function (q, i) {
        html += (typeof q.render === 'function') ? q.render(i) : renderCard(q, i);
      });
      html += '</div>';
      return html;
    }

    function defaultCheck(set, answers) {
      var correct = 0, results = [], correctAnswers = [];
      set.questions.forEach(function (q, i) {
        var ok;
        if (typeof q.check === 'function') ok = !!q.check(answers, i);
        else ok = defaultQCheck(q, answers, i); // 缺省判定：multi 分字段 / 其余整串比较
        if (ok) correct++;
        results.push(ok);
        correctAnswers.push(Array.isArray(q.answer) ? q.answer.join('、') : String(q.answer));
      });
      var total = set.questions.length;
      var score = total ? Math.round(correct / total * 100) : 0;
      var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    }

    function defaultGenerate(options) {
      var opts = options || {};
      // 参数合理性提醒
      if (opts.count != null && (!(opts.count > 0) || Math.floor(opts.count) !== opts.count)) {
        console.warn('[createPlugin:' + id + '] 参数 count 应为正整数，收到：' + opts.count);
      }
      var questions = [];
      try {
        questions = config.generateQuestions.call(plugin, opts) || [];
      } catch (e) {
        console.error('[createPlugin:' + id + '] generateQuestions 执行出错：', e);
        throw new Error('题型「' + name + '」生成题目时出错：' + (e && e.message ? e.message : e));
      }
      // 规范化：缺 render 的题用通用卡片兜底；缺 check 的题挂默认单题判定
      questions = questions.map(function (q, i) {
        if (q && typeof q.render !== 'function' && q.answer != null) {
          q.render = function (idx) { return renderCard(q, idx); };
        }
        if (q && typeof q.check !== 'function') {
          q.check = function (answers, idx) { return defaultQCheck(q, answers, idx); };
        }
        return q;
      });
      // 知识点声明校验：声明的知识点需在知识库中登记（统一结构：getEntries 扁平化）
      // 支持两种格式：① string[]（对所有 grades 统一校验）② { [grade]: string[] }（按年级分别校验）
      if (config.knowledgePoints && _kb && subject === 'math' && opts.grade) {
        var entries = _kb.getEntries ? _kb.getEntries('math', opts.grade) : [];
        if (entries.length) {
          var entryById = {};
          entries.forEach(function (e) { entryById[e.id] = true; entryById[e.name] = true; });
          var kpRaw = config.knowledgePoints;
          var kpList = Array.isArray(kpRaw) ? kpRaw : (kpRaw && kpRaw[opts.grade]) || [];
          var missing = kpList.filter(function (kp) { return !entryById[kp]; });
          if (missing.length) {
            console.warn('[createPlugin:' + id + '] 在 ' + opts.grade + ' 年级声明覆盖的知识点未在知识库登记：' +
              missing.join('、') + '（请补充 shared/knowledge-bank.js 或修正 knowledgePoints）');
          }
        }
      }
      // 开发期提示：当前页知识点覆盖（浏览器每页一次）
      _maybeReportCoverage(config);
      var meta = (typeof config.meta === 'function') ? config.meta(opts)
        : (config.meta || { grade: opts.grade, count: questions.length });
      return { questions: questions, meta: meta };
    }

    // 合并非保留字段（settings / printConfig / 自定义方法等）
    var RESERVED = { id: 1, name: 1, subject: 1, grades: 1, category: 1, description: 1,
      generateQuestions: 1, render: 1, check: 1, knowledgePoints: 1, columns: 1, meta: 1 };
    var plugin = {};
    Object.keys(config).forEach(function (k) { if (!RESERVED[k]) plugin[k] = config[k]; });
    plugin.id = id;
    plugin.name = name;
    plugin.subject = subject;
    plugin.grades = grades;
    if (config.category) plugin.category = config.category;
    if (config.description) plugin.description = config.description;
    if (config.printConfig) plugin.printConfig = config.printConfig;
    if (config.settings) plugin.settings = config.settings;
    plugin.generate = config.generate ? config.generate : defaultGenerate;
    plugin.render = config.render ? config.render : defaultRender;
    plugin.check = config.check ? config.check : defaultCheck;
    // 声明式知识点以独立字段暴露（RESERVED 不合并，避免与运行时方法混淆），
    // 供 dev/verify-knowledge-bank.js 等工具静态校验「声明 ↔ 知识库」一致性
    if (config.knowledgePoints) plugin.declaredKnowledgePoints = config.knowledgePoints;

    return plugin;
  }

  // ============ 科目化插件工厂（数学/语文/英语，自动注入 subject + difficultyParams + 修饰类） ============

  /** 科目化辅助：包装 generate，调用前自动注入 opts.difficultyParams。
   *  优先级：
   *   1) opts.knowledgePointMeta 存在（插件按知识点设置）→ 静态多维计算优先
   *      （调用 App.DifficultyStatic.paramsForKnowledgePoint，不再使用 opts.difficulty / opts.adaptiveDelta）；
   *      若插件同时提供 opts.level（自带难度 chip，hasOwnLevel）→ 仍用插件 level 解析，
   *      静态结果仅作参考写入 staticMeta，不覆盖难度。
   *   2) 否则回退现有「档位 + delta」逻辑（行为不变）。 */
  function _wrapDifficultyParams(plugin, subject) {
    var _orig = plugin.generate;
    plugin.generate = function (opts) {
      opts = opts || {};
      if (opts.difficultyParams == null) {
        var _D = (typeof global !== 'undefined') ? (global.App && global.App.Difficulty) : null;
        var _DS = (typeof global !== 'undefined') ? (global.App && global.App.DifficultyStatic) : null;
        var hasOwnLevel = opts.level != null && opts.level !== '';

        if (opts.knowledgePointMeta && _DS && typeof _DS.paramsForKnowledgePoint === 'function') {
          // 静态多维计算优先（ignore opts.difficulty / opts.adaptiveDelta；createProfile delta 恒为 0）
          var staticOut = _DS.paramsForKnowledgePoint(opts.knowledgePointMeta, opts.questionType, opts.customParams);
          if (hasOwnLevel) {
            // 插件自带难度 chip：保留插件 level（createProfile delta 恒为 0），静态仅作参考
            var lv = opts.level;
            var prof = (_D && typeof _D.paramsFor === 'function')
              ? _D.paramsFor(subject, lv) : { level: lv, difficulty: lv };
            prof.staticMeta = staticOut.staticMeta;
            opts.difficultyParams = prof;
          } else {
            opts.difficultyParams = staticOut;
          }
        } else if (_D && typeof _D.paramsFor === 'function') {
          // 回退：现有「档位 + delta」逻辑（无知识点元数据时与历史行为一致）
          var lv2 = (opts.difficulty != null) ? opts.difficulty : (opts.level || 3);
          try { opts.difficultyParams = _D.paramsFor(subject, lv2); } catch (e) { /* 安全跳过 */ }
        }
        opts.hasOwnLevel = hasOwnLevel;
      }
      return _orig.call(plugin, opts);
    };
  }

  /** 科目化辅助：包装 render，在网格容器追加科目修饰类（math-grid / cn-grid / en-grid）。 */
  function _wrapGridClass(plugin) {
    if (!plugin.gridClass) return;
    var _orig = plugin.render;
    plugin.render = function (set) {
      var html = _orig.call(plugin, set);
      if (html.indexOf(plugin.gridClass) === -1) {
        html = html.replace('class="questions-grid"', 'class="questions-grid ' + plugin.gridClass + '"');
      }
      return html;
    };
  }

  /** 数值等价比较：'12' ≡ 12；非数值回退字符串比较 */
  function _numEq(a, b) {
    var na = Number(normalizeAns(a));
    var nb = Number(normalizeAns(b));
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return normalizeAns(a) === normalizeAns(b);
  }

  /** 数值版 defaultQCheck：multi 分字段数值比较 / 其余整串数值比较 */
  function _mathQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (!_numEq(uv, parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return _numEq(ua, ans);
  }

  /**
   * 数学插件工厂：预设 subject='math'、数值比较批改（'12'≡12）、math-grid/math-card 修饰类、
   * 自动注入 opts.difficultyParams。旧 createPlugin(cfg) 完全兼容、行为不变。
   */
  function createMathPlugin(config) {
    config = config || {};
    config.subject = 'math';
    var _origGQ = config.generateQuestions;
    if (typeof _origGQ === 'function') {
      config.generateQuestions = function (opts) {
        var qs = _origGQ.call(this, opts) || [];
        qs.forEach(function (q) {
          if (q && typeof q.check !== 'function' && q.answer != null) {
            q.check = function (answers, idx) { return _mathQCheck(q, answers, idx); };
          }
        });
        return qs;
      };
    }
    var plugin = createPlugin(config);
    plugin.cardClass = 'math-card';
    plugin.gridClass = 'math-grid';
    _wrapDifficultyParams(plugin, 'math');
    _wrapGridClass(plugin);
    return plugin;
  }

  // ============ 增量挂载 ============
  global.PluginUtil = global.PluginUtil || {};
  global.PluginUtil.renderCard = renderCard;
  global.PluginUtil.renderGrid = renderGrid;
  global.PluginUtil.clockSVG = clockSVG;
  global.PluginUtil.createPlugin = createPlugin;
  global.PluginUtil.createMathPlugin = createMathPlugin;
  global.renderCard = renderCard;       // 跨模块裸调用兼容
  global.clockSVG = clockSVG;           // 插件直接调用兼容

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderCard: renderCard, renderGrid: renderGrid, clockSVG: clockSVG,
      createPlugin: createPlugin, createMathPlugin: createMathPlugin,
      _wrapDifficultyParams: _wrapDifficultyParams, _wrapGridClass: _wrapGridClass,
      _numEq: _numEq, _mathQCheck: _mathQCheck
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/check.js"] = function (module, exports, require) {
/**
 * shared/check.js — 批改逻辑（任务 3.2 拆分）
 *
 * defaultQCheck / computeResult / pickOpt（选项点击）。
 * 跨模块裸调用：createPlugin（render.js）→ defaultQCheck 经全局解析。
 * normalizeAns 由 core.js 挂全局，本文件直接裸调用。
 */
(function (global) {
  'use strict';

  /** 缺省单题判定（createPlugin 与综合练习共用）：
   *  - inputType 'multi'：按 answers['i:j'] 分字段比较（数组答案；字符串答案按 、/，/, 拆分）
   *  - 其余（text/choice）：整串比较（数组答案拼接后比较） */
  function defaultQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (normalizeAns(uv) !== normalizeAns(parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return normalizeAns(ua) === normalizeAns(ans);
  }

  /** 通用批改：返回 { score,total,correct,message,results,correctAnswers } */
  function computeResult(questions, userAnswers, opts) {
    opts = opts || {};
    var checkFn = opts.checkFn || defaultQCheck;
    var correct = 0, results = [], correctAnswers = [];
    questions.forEach(function (q, i) {
      var ok = checkFn(q, userAnswers, i);
      if (ok) correct++;
      results.push(ok);
      var disp = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
      correctAnswers.push(q.answerParts ? q.answerParts.join('、') : disp);
    });
    var total = questions.length;
    var score = total ? Math.round(correct / total * 100) : 0;
    var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
    return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
  }

  /** 选项点击处理（choice 题型，写入隐藏 input）。选中态由 components.css 的 .opt.chosen 呈现 */
  function pickOpt(el) {
    var card = el.parentNode && el.parentNode.parentNode;
    if (!card) return;
    var opts = card.querySelectorAll('.opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove('chosen');
      opts[i].setAttribute('aria-checked', 'false');
    }
    el.classList.add('chosen');
    el.setAttribute('aria-checked', 'true');
    var inp = card.querySelector('input[data-index]');
    if (inp) inp.value = el.getAttribute('data-val') || el.textContent;
  }

  // ============ 增量挂载 ============
  global.PluginUtil = global.PluginUtil || {};
  global.PluginUtil.defaultQCheck = defaultQCheck;
  global.PluginUtil.computeResult = computeResult;
  global.PluginUtil.pickOpt = pickOpt;
  global.defaultQCheck = defaultQCheck;     // 跨模块裸调用兼容（render.js createPlugin）
  global.__pickOpt = pickOpt;               // 卡片 onclick="window.__pickOpt(this)" 兼容

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      defaultQCheck: defaultQCheck, computeResult: computeResult, pickOpt: pickOpt
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology.js"] = function (module, exports, require) {
/**
 * shared/knowledge-ontology.js — Canonical Knowledge Ontology Schema (M1-01)
 *
 * 职责（仅数据标准化，不触达生成/渲染/DOM/用户数据）：
 *   - 定义 Canonical KnowledgePoint 结构（create 提供默认值）。
 *   - normalize(legacyKP) 委托 Normalizer 将 Legacy KnowledgePoint 转为 Canonical。
 *   - validate(kp) 委托 Validator 做 ERROR/WARNING 分类。
 *   - isValid(kp) 便捷判断。
 *
 * 不修改现有 KnowledgeBank 数据结构；KnowledgeBank 继续返回原始 Legacy 数据。
 */
(function (global) {
  'use strict';

  var Schema = require("shared/schemas/knowledge-point.schema.js");

  var VERSION = Schema.VERSION;
  var SUBJECTS = Schema.SUBJECTS;
  var KNOWN_OPERATIONS = Schema.KNOWN_OPERATIONS;
  var KNOWN_QUESTION_TYPES = Schema.KNOWN_QUESTION_TYPES;
  var KNOWN_CONTEXTS = Schema.KNOWN_CONTEXTS;

  function isPlainObject(x) {
    return x && typeof x === 'object' && !Array.isArray(x);
  }

  function defaultCanonical() {
    return {
      id: '',
      subject: null,
      grade: null,
      module: { id: '', name: '' },
      identity: { id: '', name: '', description: '' },
      source: { pluginId: null, legacyType: null },
      knowledge: { concept: null, operations: [], factualContent: {}, prerequisites: [] },
      structure: { minSteps: 1, maxSteps: 1, allowBracket: false, allowMultDiv: false },
      cognition: { level: 0, targets: [], raw: null },
      presentation: { questionTypes: [], graphicType: null },
      numeric: { range: { min: null, max: null }, integerOnly: true, decimalPlaces: 0 },
      context: { defaults: [], allowPure: true, allowContextual: true },
      errors: [],
      spiral: { level: 1, maxLevel: 1 },
      generation: { capabilities: [] },
      metadata: { weight: 1, version: VERSION },
      legacy: {}
    };
  }

  function create(data) {
    var c = defaultCanonical();
    if (!isPlainObject(data)) return c;
    if (data.id !== undefined) c.id = data.id;
    if (data.subject !== undefined) c.subject = data.subject;
    if (data.grade !== undefined) c.grade = data.grade;
    if (data.module) c.module = Object.assign({}, c.module, data.module);
    if (data.identity) c.identity = Object.assign({}, c.identity, data.identity);
    if (data.source) c.source = Object.assign({}, c.source, data.source);
    if (data.knowledge) c.knowledge = Object.assign({}, c.knowledge, data.knowledge);
    if (data.structure) c.structure = Object.assign({}, c.structure, data.structure);
    if (data.cognition) c.cognition = Object.assign({}, c.cognition, data.cognition);
    if (data.presentation) c.presentation = Object.assign({}, c.presentation, data.presentation);
    if (data.numeric) {
      c.numeric = Object.assign({}, c.numeric, data.numeric);
      if (data.numeric.range) c.numeric.range = Object.assign({}, c.numeric.range);
    }
    if (data.context) c.context = Object.assign({}, c.context, data.context);
    if (data.errors) c.errors = data.errors;
    if (data.spiral) c.spiral = Object.assign({}, c.spiral, data.spiral);
    if (data.generation) c.generation = Object.assign({}, c.generation, data.generation);
    if (data.metadata) c.metadata = Object.assign({}, c.metadata, data.metadata);
    if (data.legacy) c.legacy = Object.assign({}, data.legacy);
    return c;
  }

  function normalize(legacyKP) {
    var Normalizer = require("shared/knowledge-ontology-normalizer.js");
    return Normalizer.fromLegacy(legacyKP);
  }

  function validate(kp) {
    var Validator = require("shared/knowledge-ontology-validator.js");
    return Validator.validate(kp);
  }

  function isValid(kp) {
    var r = validate(kp);
    return !!(r && r.valid);
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    defaultCanonical: defaultCanonical,
    create: create,
    normalize: normalize,
    validate: validate,
    isValid: isValid,
    schemaVersion: function () { return VERSION; }
  };

  global.KnowledgeOntology = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/capability-model.js"] = function (module, exports, require) {
/**
 * shared/capability-model.js — Capability 数据模型 (M2-04)
 *
 * 描述知识点「理论上」支持什么样的生成能力。
 * Capability ≠ Generator —— 只描述能力，不描述本次生成什么题目。
 *
 * 结构遵循 M2-04 标准：
 * {
 *   knowledgePointId,
 *   questionTypes: [
 *     {
 *       id,              // 标准 questionType Id
 *       cognitiveLevels, // 认知层级列表
 *       difficultyRange, // 难度范围 [min, max]
 *       priority         // 优先级 (0-5)
 *     }
 *   ]
 * }
 */
'use strict';

var TYPES = require("shared/question-type-registry.js").TYPES;
var Registry = require("shared/question-type-registry.js");

function defaultCapability() {
  return {
    knowledgePointId: '',
    questionTypes: []
  };
}

function isValidCapability(c) {
  if (!c || typeof c !== 'object') return false;
  if (c.knowledgePointId == null) return false;
  if (!Array.isArray(c.questionTypes)) return false;
  return c.questionTypes.every(function (qt) {
    if (!qt || typeof qt.id !== 'string') return false;
    if (!Array.isArray(qt.cognitiveLevels)) return false;
    if (!qt.difficultyRange || qt.difficultyRange.length !== 2) return false;
    if (typeof qt.priority !== 'number') return false;
    return true;
  });
}

function resolveCapability(canonicalKp) {
  // 基于 Canonical KnowledgePoint 推导 capability（能力声明，非执行器）。
  // 数据来源：presentation.questionTypes（已归一化）+ generation.capabilities（数据推导）。
  var result = defaultCapability();
  result.knowledgePointId = canonicalKp.id || '';

  var pushQt = function (typeToken, qtMeta) {
    if (!typeToken) return;
    var std = Registry.normalizeQuestionType(typeToken);
    if (!std.id) return;
    var already = result.questionTypes.some(function (q) { return q.id === std.id; });
    if (already) return;
    var qt = Registry.get(std.id);
    result.questionTypes.push({
      id: std.id,
      cognitiveLevels: (qt && qt.cognitiveLevels) || ['understand'],
      difficultyRange: inferDifficultyRange(canonicalKp, std.id),
      priority: 1,
      supported: true
    });
  };

  // 1) 从 canonical presentation.questionTypes（含 rawType）推导
  (canonicalKp.presentation && canonicalKp.presentation.questionTypes || []).forEach(function (q) {
    pushQt(q.rawType || q.type);
  });

  // 2) 从 canonical generation.capabilities（M1 数据推导）补充
  (canonicalKp.generation && canonicalKp.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id)) pushQt(cap.id);
  });

  // 若仍为空，则未推导出可用题型；保持空 arrays（不伪造）。
  return result;
}

function inferDifficultyRange(kp, qtypeId) {
  // 根据 max_steps_default / number_range_default / cognitive_level 推断 difficultyRange [min, max]
  var ms = Number(kp.max_steps_default);
  if (!isFinite(ms) || ms < 1) ms = 1;
  var range = kp.number_range_default;
  var min = 1, max = 6; // default grade range

  if (ms > 1) max = Math.min(6, ms);
  if (range && typeof range === 'object' && isFinite(range.min) && isFinite(range.max)) {
    min = Math.max(1, Math.min(6, range.min));
    max = Math.min(6, Math.max(range.min, range.max));
  }
  var cl = kp.cognitive_level;
  if (cl) {
    var clMap = { '了解': 1, '理解': 2, '掌握': 3, '运用': 4 };
    if (clMap[cl] !== undefined) {
      var clNum = clMap[cl];
      if (min > clNum) min = clNum;
      if (max < clNum) max = clNum;
    }
  }
  return [min, max];
}

module.exports = {
  defaultCapability: defaultCapability,
  isValidCapability: isValidCapability,
  resolveCapability: resolveCapability,
  inferDifficultyRange: inferDifficultyRange
};
};
__defs["shared/capability-matrix.js"] = function (module, exports, require) {
/**
 * shared/capability-matrix.js — KnowledgePoint × QuestionType × Capability Matrix (M2-R04)
 *
 * 建立 574 KP × 标准题型 的三维能力关系，并给出明确决策规则：
 *
 *   ALLOW    ：该题型属于该 KP 的解析能力集 → 可生成
 *   FORBID   ：该题型不在能力集，且与能力集存在语义冲突（如 geometry 与纯口算）→ 明确禁止
 *   MISSING  ：该 KP 未解析出任何能力（数据缺失）→ 需人工补数据
 *   DEGRADE  ：该 KP 能力集存在但题型覆盖稀疏 → 标记待核查
 *
 * 纯数据计算，不调用任何 Generator，不修改插件/KB/practice.html。
 */
'use strict';

var Registry = require("shared/question-type-registry.js");

// 语义冲突规则：某些标准题型与该题型类型互斥。
// 依据 Registry.category：calculation / written / selection / application / open / geometry / recognition
var CONFLICT_CATEGORIES = {
  geometry: ['geometry'],
  oral: ['calculation'],
  calc: ['calculation'],
  recognize: ['recognition']
};

function decisionFor(capSet, qtId) {
  // capSet: 解析出的能力 id 集合
  var qt = Registry.get(qtId);
  if (!qt) return 'FORBID'; // 未知题型一律禁止

  if (capSet.has(qtId)) return 'ALLOW';

  // 能力集为空 → 数据缺失，无法判定 → MISSING
  if (capSet.size === 0) return 'MISSING';

  // 语义冲突：能力集中存在与该题型 category 互斥的题型 → FORBID
  var conflictCats = CONFLICT_CATEGORIES[qtId];
  if (conflictCats) {
    var catHasConflict = false;
    capSet.forEach(function (id) {
      var t = Registry.get(id);
      if (t && conflictCats.indexOf(t.category) !== -1) catHasConflict = true;
    });
    if (catHasConflict) return 'FORBID';
  }

  return 'DEGRADE';
}

function buildMatrix(kp, cap) {
  // 允许外部注入已解析的 capability（避免 capability-resolver <-> capability-matrix 循环依赖）
  if (!cap) {
    var CapabilityModel = require("shared/capability-model.js");
    cap = CapabilityModel.resolveCapability(kp);
  }
  var capSet = new Set(cap.questionTypes.map(function (q) { return q.id; }));

  var questionTypes = {};
  Registry.all().forEach(function (qt) {
    var decision = decisionFor(capSet, qt.id);
    questionTypes[qt.id] = {
      supported: decision === 'ALLOW',
      decision: decision,
      capability: qt.category
    };
  });

  return {
    knowledgePointId: kp.id,
    subject: kp.subject || null,
    grade: kp.grade || null,
    allowed: cap.questionTypes.map(function (q) { return q.id; }),
    questionTypes: questionTypes,
    status: capSet.size === 0 ? 'MISSING' : 'RESOLVED'
  };
}

module.exports = {
  decisionFor: decisionFor,
  buildMatrix: buildMatrix,
  CONFLICT_CATEGORIES: CONFLICT_CATEGORIES
};

};
__defs["shared/generator-capability-registry.js"] = function (module, exports, require) {
/**
 * shared/generator-capability-registry.js — 真实 Generator Capability Registry (M2-R05)
 *
 * 只读注册表/解析层：把 99 个真实插件与 M2 的 QuestionType / Capability /
 * KnowledgePoint 建立能力对齐。只描述能力，不保存任何执行函数。
 *
 * 数据来源：
 *   - plugins/registry.js   : pluginId / subject / category / grades（declared）
 *   - KnowledgeBank          : kp.pluginId → 该插件服务的 KP（declared 关联）
 *   - CapabilityResolver     : KP → questionTypes / capabilities（inferred）
 *
 * 严禁保存：generateFunction / generatorFunction / DOM / SVG renderer 引用。
 */
'use strict';

var path = require("node:path");
var Registry = require("shared/question-type-registry.js");
var KnowledgeBank = require("shared/knowledge-bank.js");
var Ontology = require("shared/knowledge-ontology.js");

var pluginRegistry = require("plugins/registry.js");

// 惰性加载 capability-resolver，避免 circular dependency
var _Resolver = null;
function resolver() {
  if (!_Resolver) _Resolver = require("shared/capability-resolver.js");
  return _Resolver;
}

function buildKpByPluginId() {
  var map = {};
  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          if (kp.pluginId) {
            (map[kp.pluginId] = map[kp.pluginId] || []).push(kp);
          }
        });
      });
    });
  });
  return map;
}

function buildGeneratorCapabilityRegistry() {
  var kpByPlugin = buildKpByPluginId();

  return pluginRegistry.map(function (entry) {
    var kps = kpByPlugin[entry.id] || [];
    var questionTypeIds = [];
    var capabilities = [];
    var unknownTypes = [];
    var invalidTypes = [];

    // 通过 KP → CapabilityResolver 解析题型/能力（inferred，KB 为权威关联）
    kps.forEach(function (kp) {
      try {
        var cap = resolver().resolve(Ontology.normalize(kp));
        (cap.questionTypes || []).forEach(function (qt) {
          if (Registry.has(qt.id)) {
            if (questionTypeIds.indexOf(qt.id) === -1) questionTypeIds.push(qt.id);
            if (capabilities.indexOf(qt.id) === -1) capabilities.push(qt.id);
          } else {
            invalidTypes.push(qt.id);
          }
        });
      } catch (e) {
        unknownTypes.push(kp.id + ':' + e.message);
      }
    });

    return {
      pluginId: entry.id,
      subject: entry.subject,
      category: entry.category,
      grades: entry.grades || [],
      moduleIds: entry.moduleIds || [],
      isPlaceholder: !!entry.isPlaceholder,
      questionTypes: questionTypeIds,
      capabilities: capabilities,
      knowledgePoints: kps.map(function (k) { return k.id; }),
      unknownCapabilities: unknownTypes,
      invalidCapabilities: invalidTypes,
      source: 'plugin-contract',
      confidence: kps.length ? 'inferred' : (entry.isPlaceholder ? 'unknown' : 'unknown')
    };
  });
}

module.exports = {
  buildGeneratorCapabilityRegistry: buildGeneratorCapabilityRegistry,
  buildKpByPluginId: buildKpByPluginId
};

};
__defs["shared/learner/error-model.js"] = function (module, exports, require) {
/**
 * shared/learner/error-model.js — M6-R09 错因（Error Pattern）模型
 *
 * 每条记录：
 *   {
 *     errorType,       // 错因类型（ERROR_TYPES 之一，或 'other' 兜底）
 *     count,           // 累计出现次数
 *     recentCount,     // 近期出现次数（随新结果衰减）
 *     lastOccurredAt,  // 最近一次出现时间戳
 *     confidence       // 该错因出现的确定性（0..1，随出现次数增长）
 *   }
 *
 * M6-R10 来源约束：本模型不自行分析答案；“错因”只允许来自
 * Validator / SemanticQuestion 提供的 errorType。系统无可靠错因时
 * 一律返回 null（不伪造诊断）。
 */
(function (global) {
  'use strict';

  // 初始错因类型（只支持项目已有能力，不扩张）；'other' 兜底
  var ERROR_TYPES = [
    '计算错误',   // 运算结果错误/算术出错
    '口诀混淆',   // 乘法口诀/公式背诵混淆
    '概念混淆',   // 概念理解偏差
    '符号错误',   // 正负号/运算符/标点混用
    '步骤错误',   // 解题步骤顺序/遗漏
    '审题错误',   // 读题偏差/漏条件
    '单位错误',   // 单位换算/遗漏单位
    '格式错误'    // 答案格式不符（书写/排版）
  ];
  var OTHER = 'other';

  var MAX_SEEN_FOR_CONFIDENCE = 10;
  var RECENT_DECAY = 0.5;
  var RECENT_BOOST = 1;

  function isKnownType(t) {
    return typeof t === 'string' && ERROR_TYPES.indexOf(t) !== -1;
  }

  /**
   * 归一化错因：合法类型返回原值；'other' 返回 'other'；
   * 其余（含 null/非法）返回 null —— 绝不伪造诊断。
   * @param {*} t
   * @returns {string|null}
   */
  function normalizeErrorType(t) {
    if (t === OTHER || t === 'other') return OTHER;
    if (isKnownType(t)) return t;
    return null;
  }

  function defaultPattern(errorType) {
    return {
      errorType: errorType,
      count: 0,
      recentCount: 0,
      lastOccurredAt: null,
      confidence: 0
    };
  }

  /**
   * 规范化整个 errorPatterns 容器（R26：字段缺失/非法类型自愈）。
   * @param {Object} patterns
   * @returns {Object} 规范化后的 errorPatterns（仅含合法错因键）
   */
  function normalizePatterns(patterns) {
    var out = {};
    if (patterns == null || typeof patterns !== 'object') return out;
    Object.keys(patterns).forEach(function (k) {
      var tk = normalizeErrorType(k);
      if (!tk) return; // 非法/未知类型 → 丢弃
      var p = patterns[k];
      if (p == null || typeof p !== 'object') { out[tk] = defaultPattern(tk); return; }
      var norm = defaultPattern(tk);
      norm.count = toNonNegInt(p.count);
      norm.recentCount = toNonNegInt(p.recentCount);
      norm.lastOccurredAt = (typeof p.lastOccurredAt === 'number' && isFinite(p.lastOccurredAt)) ? p.lastOccurredAt : null;
      norm.confidence = clamp01(typeof p.confidence === 'number' && isFinite(p.confidence) ? p.confidence : 0);
      out[tk] = norm;
    });
    return out;
  }

  function toNonNegInt(v) {
    var n = Number(v);
    if (!isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  }
  function clamp01(n) {
    if (typeof n !== 'number' || !isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  /**
   * 记录一次错因出现。返回最新 pattern。
   * 不改变 attempts/correct —— 那些由 LearnerModel 维护。
   */
  function recordError(patterns, errorType, timestamp) {
    var t = normalizeErrorType(errorType);
    if (!t) return null;
    patterns = patterns || {};
    var p = patterns[t] ? patterns[t] : defaultPattern(t);
    p.count += 1;
    p.recentCount = (p.recentCount || 0) + RECENT_BOOST;
    p.lastOccurredAt = (typeof timestamp === 'number') ? timestamp : Date.now();
    p.confidence = clamp01(0.3 + 0.6 * Math.min(1, p.count / MAX_SEEN_FOR_CONFIDENCE));
    patterns[t] = p;

    // 其余错因近期计数衰减（表示“最近没再犯”）
    Object.keys(patterns).forEach(function (k) {
      if (k === t) return;
      if (patterns[k] && patterns[k].recentCount > 0) {
        patterns[k].recentCount = Math.max(0, patterns[k].recentCount - RECENT_DECAY);
      }
    });
    return p;
  }

  /**
   * 错因解析：唯一的可靠来源入口。
   * @param {Object} [source] 疑似携带 errorType 的对象（question / practiceResult）
   * @returns {string|null} 可靠错因类型；无则 null（不伪造）
   */
  function resolveErrorType(source) {
    if (!source || typeof source !== 'object') return null;
    var t = source.errorType;
    if (t == null) return null;
    return normalizeErrorType(t);
  }

  /**
   * 获取错因聚焦列表（R17）：按严重度排序。
   * 权重：recentCount 优先（近期反复出现更相关），count 次之。
   * @param {Object} patterns
   * @param {number} [limit] 返回条数上限
   * @returns {Array<{errorType:string, count:number, recentCount:number, confidence:number}>}
   */
  function getErrorFocus(patterns, limit) {
    patterns = patterns || {};
    var list = [];
    Object.keys(patterns).forEach(function (k) {
      var p = patterns[k];
      if (!p || p.count <= 0) return;
      list.push(p);
    });
    list.sort(function (a, b) {
      var d = (b.recentCount || 0) - (a.recentCount || 0);
      if (d) return d;
      return (b.count || 0) - (a.count || 0);
    });
    if (typeof limit === 'number' && limit > 0) list = list.slice(0, limit);
    return list.map(function (p) { return {
      errorType: p.errorType,
      count: p.count,
      recentCount: p.recentCount,
      lastOccurredAt: p.lastOccurredAt,
      confidence: p.confidence
    }; });
  }

  var ErrorModel = {
    ERROR_TYPES: ERROR_TYPES,
    OTHER: OTHER,
    normalizeErrorType: normalizeErrorType,
    normalizePatterns: normalizePatterns,
    defaultPattern: defaultPattern,
    recordError: recordError,
    resolveErrorType: resolveErrorType,
    getErrorFocus: getErrorFocus
  };

  global.LearnerErrorModel = ErrorModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = ErrorModel;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
};
__defs["shared/legacy/plugin-adapter.js"] = function (module, exports, require) {
/**
 * shared/legacy/plugin-adapter.js — M7-R18 旧插件唯一桥接层
 *
 * 全系统唯一允许触碰「旧 Plugin」的边界：
 *
 *   GenerationEngine
 *        ↓
 *   LegacyPluginAdapter（本模块）
 *        ↓
 *   旧 Plugin（plugin.generate / plugin.render）
 *
 * 禁止（R18）：
 *   - UI 直接调用旧 Plugin
 *   - Strategy 直接调用旧 Plugin（只认 capability）
 *   - Renderer 直接调用旧 Plugin
 *
 * 本模块职责：
 *   - 加载已装载的插件对象（浏览器缓存在全局；Node 经 dev/plugin-loader）
 *   - 以统一 Promise 包装 plugin.generate → exerciseSet
 *   - 提供 plugin.render 的桥（供 GenerationEngine.renderLegacySet 使用）
 *   - 复用 M4-R02 createLegacyGenerator（实现保留在 shared/generator/legacy-plugin-adapter.js，
 *     本模块为获得该能力的唯一路径）
 *
 * R19 扫描：全仓库的 plugin.generate / plugin.render 仅允许出现在
 *   shared/legacy/plugin-adapter.js（与 shared/generator/legacy-plugin-adapter.js 实现）。
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';
  var cache = {};

  /**
   * 取插件对象。优先走已装载缓存（浏览器端插件由 boot/PluginLoader 预先装入）：
   *   ① 本模块缓存 ② window.__mathSubPlugins / __currentPlugin ③ Node dev/plugin-loader
   * 返回 plugin 或 null。浏览器端未命中时返回 null（调用方应传入已装载的插件）。
   */
  function loadPlugin(id) {
    if (!id) return null;
    if (cache[id]) return cache[id];
    var found = null;
    if (isBrowser) {
      // 浏览器端插件对象已在启动时装载（App.PluginLoader 脚本机制），此处只在全局缓存中查找
      if (global.__mathSubPlugins && global.__mathSubPlugins[id]) found = global.__mathSubPlugins[id];
      else if (global.__currentPlugin && global.__currentPlugin.id === id) found = global.__currentPlugin;
      else if (global.App && global.App.plugins && global.App.plugins[id]) found = global.App.plugins[id];
    } else {
      try {
        var loader = require("dev/plugin-loader.js");
        var entry = loader.loadPlugin(id);
        found = entry && !entry.error ? entry.plugin : null;
      } catch (e) { /* 插件不可用时返回 null，由调用方处理 */ }
    }
    if (found) cache[id] = found;
    return found || null;
  }

  /** 预置/登记插件对象（幂等）。 */
  function setPlugin(id, plugin) {
    if (id && plugin) cache[id] = plugin;
    return plugin;
  }

  /**
   * 统一生成入口：plugin.generate(options) 的 Promise 包装。
   * （UI 经 GenerationEngine.generateLegacy → 本函数到达旧插件）
   * @returns {Promise<{ questions:Array, meta:Object }>} 原始 exerciseSet
   */
  function generateByPluginId(pluginId, options) {
    return Promise.resolve().then(function () {
      var plugin = loadPlugin(pluginId);
      if (!plugin || typeof plugin.generate !== 'function') {
        throw new Error('Legacy 插件不可用或未装载: ' + pluginId);
      }
      var set = plugin.generate(options || {});
      return (set && typeof set.then === 'function') ? set : Promise.resolve(set);
    });
  }

  /**
   * 渲染桥：plugin.render(exerciseSet) → html（供 GenerationEngine.renderLegacySet）。
   * 插件未提供 render 时返回 null，由上层走通用降级。
   */
  function renderSet(set, pluginId) {
    var plugin = loadPlugin(pluginId);
    if (!plugin || typeof plugin.render !== 'function') return null;
    try {
      return plugin.render(set);
    } catch (e) {
      return null;
    }
  }

  /**
   * 实例化 legacy 纪录：plugin（可注入，缺省时自装载）→ GeneratorContract。
   * 供 GeneratorSelector.instantiate 的唯一 legacy 入口（R18：Selector 也不再直接 loader）。
   */
  function hydrateLegacyGenerator(selection, plugin) {
    if (!selection || !selection.record) return null;
    if (!plugin) {
      var pid = selection.record.pluginId;
      if (!pid && typeof selection.record.id === 'string' && selection.record.id.indexOf('legacy:') === 0) {
        pid = selection.record.id.slice('legacy:'.length);
      }
      plugin = loadPlugin(pid);
    }
    if (!plugin) return null;
    var GenAdapter = require("shared/generator/legacy-plugin-adapter.js");
    return GenAdapter.createLegacyGenerator(plugin, {
      capabilities: selection.record.capabilities,
      knowledgePoints: selection.record.knowledgePoints
    });
  }

  var API = {
    loadPlugin: loadPlugin,
    setPlugin: setPlugin,
    generateByPluginId: generateByPluginId,
    renderSet: renderSet,
    hydrateLegacyGenerator: hydrateLegacyGenerator,
    createLegacyGenerator: function (plugin, meta) {
      return require("shared/generator/legacy-plugin-adapter.js").createLegacyGenerator(plugin, meta);
    }
  };

  global.LegacyPluginAdapter = API;
  if (global.App && typeof global.App === 'object') global.App.LegacyPluginAdapter = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
};
__defs["shared/generator/generators/index.js"] = function (module, exports, require) {
/**
 * shared/generator/generators/index.js — M4-R06 核心 Generator 索引
 *
 * Generator id → 工厂/实例映射。首批 8 个：
 *   addition / subtraction / multiplication / division / mixed-calculation
 *   fill / choice / judge
 */
'use strict';

var Arithmetic = require("shared/generator/generators/arithmetic.js");
var Selection = require("shared/generator/generators/selection.js");
var Complex = require("shared/generator/generators/complex.js");

var ALL = [].concat(
  Arithmetic.buildAll(),
  Selection.buildAll(),
  Complex.buildAll()
);

var BY_ID = {};
ALL.forEach(function (g) { BY_ID[g.id] = g; });

module.exports = {
  ALL: ALL,
  BY_ID: BY_ID,
  get: function (id) { return BY_ID[id] || null; }
};

};
__defs["shared/schemas/knowledge-point.schema.js"] = function (module, exports, require) {
/**
 * shared/schemas/knowledge-point.schema.js — Canonical KnowledgePoint Schema (M1-R01)
 *
 * 正式集中定义 Canonical KnowledgePoint 的 5 类结构与字段级合法性规则。
 * knowledge-ontology.js 引用本文件，不复制逻辑（单一事实来源）。
 *
 * 5 类（Categories）：
 *   ① Identity      : id, subject, grade, module, name, description
 *   ② Knowledge     : concept, operations, factualContent, prerequisites
 *   ③ Difficulty    : spiralLevel, maxSpiralLevel, cognitiveLevel, numberRangeDefault, maxStepsDefault
 *   ④ Assessment    : applicableQuestionTypes, contextDefault, errors
 *   ⑤ Generation    : capabilities（仅能力声明，不含生成器）
 *
 * 本文件纯数据/纯函数，不依赖 DOM / window / 插件 / KB / 生成器。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var SUBJECTS = ['math', 'cn', 'en'];

  var KNOWN_OPERATIONS = [
    'add', 'subtract', 'multiply', 'divide',
    'compare', 'order',
    'compose', 'decompose',
    'measure', 'convert',
    'identify', 'classify',
    'read', 'write',
    'calculate', 'reason',
    'represent', 'model'
  ];

  var KNOWN_QUESTION_TYPES = ['calc', 'fill', 'judge', 'choice', 'operate', 'apply', 'open'];

  var KNOWN_CONTEXTS = ['pure', 'simple', 'standard', 'complex'];

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  var COGNITIVE_MIN = 0;
  var COGNITIVE_MAX = 1;

  // ⑤ Generation Capability 枚举（仅能力声明，type 用于分组）。
  var CAPABILITIES = {
    'single-step': { type: 'procedure' },
    'multi-step': { type: 'procedure' },
    'calculation': { type: 'calculation' },
    'oral': { type: 'question-format' },
    'fill': { type: 'question-format' },
    'choice': { type: 'question-format' },
    'judge': { type: 'question-format' },
    'open': { type: 'question-format' },
    'contextual': { type: 'context' },
    'application': { type: 'context' }
  };

  // Legacy applicable_question_types.type -> capability id（数据驱动推导，不猜测）。
  var QUESTION_TYPE_TO_CAPABILITY = {
    calc: 'calculation', operate: 'calculation',
    fill: 'fill', choice: 'choice', judge: 'judge',
    apply: 'contextual', open: 'open'
  };

  var CATEGORIES = {
    identity: { fields: ['id', 'subject', 'grade', 'module', 'name', 'description'] },
    knowledge: { fields: ['concept', 'operations', 'factualContent', 'prerequisites'] },
    difficulty: { fields: ['spiralLevel', 'maxSpiralLevel', 'cognitiveLevel', 'numberRangeDefault', 'maxStepsDefault'] },
    assessment: { fields: ['applicableQuestionTypes', 'contextDefault', 'errors'] },
    generation: { fields: ['capabilities'] }
  };

  function isKnownCapability(id) { return CAPABILITIES[id] != null; }
  function isValidCognitiveRaw(v) { return COGNITIVE_MAP[v] != null; }
  function isValidQuestionType(t) { return KNOWN_QUESTION_TYPES.indexOf(t) !== -1; }

  /**
   * 字段级合法性（格式非法 = ERROR）。供 Validator 与 KB Verifier 共用。
   * 仅检查可客观判定的格式，不因为缺数据而报错（缺数据由调用方视作 WARNING）。
   */
  function checkLegality(c) {
    var errors = [];
    c = c || {};

    var range = c.numeric && c.numeric.range;
    if (range && typeof range.min === 'number' && typeof range.max === 'number' && range.min > range.max) {
      errors.push('numberRange min > max');
    }

    var st = c.structure || {};
    if (typeof st.maxSteps === 'number' && st.maxSteps < 1) {
      errors.push('maxSteps < 1');
    }

    var sp = c.spiral || {};
    if (typeof sp.level === 'number' && typeof sp.maxLevel === 'number' && sp.level > sp.maxLevel) {
      errors.push('spiralLevel > maxSpiralLevel');
    }

    var cog = c.cognition || {};
    if (typeof cog.level === 'number' && (cog.level < COGNITIVE_MIN || cog.level > COGNITIVE_MAX)) {
      errors.push('cognitiveLevel 超出范围');
    }

    // 注：questionType 的“未知”在 Canonical 层按 WARNING 处理（TYPE_ALIAS 非穷举），
    // 不在此升级为 ERROR，以免阻断治理。

    var gen = c.generation || {};
    if (Array.isArray(gen.capabilities)) {
      gen.capabilities.forEach(function (cap) {
        if (cap && !isKnownCapability(cap.id)) errors.push('未知 capability: ' + (cap && cap.id));
      });
    }

    return { errors: errors, warnings: [] };
  }

  var API = {
    VERSION: VERSION,
    SUBJECTS: SUBJECTS,
    KNOWN_OPERATIONS: KNOWN_OPERATIONS,
    KNOWN_QUESTION_TYPES: KNOWN_QUESTION_TYPES,
    KNOWN_CONTEXTS: KNOWN_CONTEXTS,
    COGNITIVE_MAP: COGNITIVE_MAP,
    COGNITIVE_MIN: COGNITIVE_MIN,
    COGNITIVE_MAX: COGNITIVE_MAX,
    CAPABILITIES: CAPABILITIES,
    QUESTION_TYPE_TO_CAPABILITY: QUESTION_TYPE_TO_CAPABILITY,
    CATEGORIES: CATEGORIES,
    isKnownCapability: isKnownCapability,
    isValidCognitiveRaw: isValidCognitiveRaw,
    isValidQuestionType: isValidQuestionType,
    checkLegality: checkLegality
  };

  global.KnowledgePointSchema = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology-normalizer.js"] = function (module, exports, require) {
/**
 * shared/knowledge-ontology-normalizer.js — Legacy → Canonical 归一化 (M1-01)
 *
 * 纯数据转换：不依赖 DOM / window / 插件 / UI / 题目生成。
 * 同一个 Legacy KP 输入必须得到相同 Canonical 输出（可重复）。
 * 不修改原对象；原始信息通过 source / legacy 字段保留。
 *
 * 映射严格依据 shared/difficulty-static.js 既有的字段语义
 * （spiral_level / max_spiral_level / cognitive_level / max_steps_default /
 *  number_range_default / context_default / applicable_question_types）。
 */
(function (global) {
  'use strict';

  var Ontology = require("shared/knowledge-ontology.js");
  var OpsOnt = require("shared/knowledge-operation.js");
  var OpsMap = require("shared/ontology-operation-map.js");
  var FactOnt = require("shared/knowledge-factual.js");
  var FactMap = require("shared/ontology-factual-map.js");
  var ErrOnt = require("shared/knowledge-error.js");
  var ErrMap = require("shared/ontology-error-map.js");
  var Schema = require("shared/schemas/knowledge-point.schema.js");
  var MODULE_CATALOG = (function () {
    try { return require("shared/module-catalog.js"); } catch (e) { return null; }
  })();

  var SUBJECTS = Ontology.SUBJECTS;

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  function mapCognitive(v) {
    if (v == null) return 0;
    if (COGNITIVE_MAP[v] != null) return COGNITIVE_MAP[v];
    return 0.67;
  }

  var TYPE_ALIAS = {
    cushi: 'calc', mixed: 'apply', mix: 'apply', word: 'apply',
    oral: 'operate', recognize: 'operate', picture: 'operate',
    matching: 'choice', column: 'fill', comparison: 'judge'
  };
  function canonQuestionType(t) {
    if (!t) return t;
    if (Ontology.KNOWN_QUESTION_TYPES.indexOf(t) !== -1) return t;
    if (TYPE_ALIAS[t]) return TYPE_ALIAS[t];
    return t;
  }

  function moduleName(token) {
    if (!token) return '';
    if (MODULE_CATALOG && MODULE_CATALOG.byId) {
      var m = MODULE_CATALOG.byId(token.toUpperCase()) || MODULE_CATALOG.byId(token);
      if (m) return m.name || token;
    }
    return token;
  }

  function deriveCapabilities(legacyKP, maxSteps) {
    legacyKP = legacyKP || {};
    var capIds = {};
    var out = [];
    function pushCap(id) {
      if (id && Schema.isKnownCapability(id) && !capIds[id]) {
        capIds[id] = 1;
        out.push({ id: id, type: Schema.CAPABILITIES[id].type });
      }
    }
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (a && a.type) {
          var cap = Schema.QUESTION_TYPE_TO_CAPABILITY[a.type];
          if (cap) pushCap(cap);
        }
      });
    }
    if (typeof legacyKP.type === 'string') {
      var capT = Schema.QUESTION_TYPE_TO_CAPABILITY[legacyKP.type];
      if (capT) pushCap(capT);
    }
    var ms = Number(maxSteps);
    if (!isFinite(ms) || ms < 1) ms = 1;
    pushCap(ms > 1 ? 'multi-step' : 'single-step');
    return out;
  }

  function fromLegacy(legacyKP) {
    legacyKP = legacyKP || {};
    var c = {};

    c.id = typeof legacyKP.id === 'string' ? legacyKP.id : '';

    var parts = c.id ? c.id.split('-') : [];
    var subject = parts[0] || null;
    var grade = null;
    if (parts[1]) {
      var gm = /^g(\d+)$/.exec(parts[1]);
      if (gm) grade = parseInt(gm[1], 10);
    }
    var moduleId = parts[2] || '';

    c.subject = SUBJECTS.indexOf(subject) !== -1 ? subject : null;
    c.grade = grade;

    c.module = { id: moduleId, name: moduleName(moduleId) };
    c.identity = {
      id: c.id,
      name: typeof legacyKP.name === 'string' ? legacyKP.name : '',
      description: typeof legacyKP.description === 'string' ? legacyKP.description : ''
    };
    c.source = {
      pluginId: legacyKP.pluginId || null,
      legacyType: legacyKP.type || null
    };

    var rawOps = Array.isArray(legacyKP.operations) && legacyKP.operations.length
      ? legacyKP.operations.slice()
      : OpsMap.operationsForPlugin(legacyKP.pluginId);
    var operations = [];
    var seenOp = {};
    rawOps.forEach(function (o) {
      var norm = OpsOnt.normalize(o);
      var canon = norm.canonical || o;
      if (!seenOp[canon]) { seenOp[canon] = 1; operations.push(canon); }
    });
    var factual = (legacyKP.factualContent && typeof legacyKP.factualContent === 'object')
      ? legacyKP.factualContent : FactMap.factualForPlugin(legacyKP.pluginId);
    var concept = (typeof legacyKP.concept === 'string' && legacyKP.concept) ? legacyKP.concept : null;
    var prerequisites = Array.isArray(legacyKP.prerequisites) ? legacyKP.prerequisites.slice() : [];
    c.knowledge = {
      concept: concept,
      operations: operations,
      factualContent: factual,
      prerequisites: prerequisites
    };

    var maxSteps = Number(legacyKP.max_steps_default);
    if (!isFinite(maxSteps) || maxSteps < 1) maxSteps = 1;
    c.structure = {
      minSteps: 1,
      maxSteps: maxSteps,
      allowBracket: !!legacyKP.allowBracket,
      allowMultDiv: !!legacyKP.allowMultDiv
    };

    var cogRaw = legacyKP.cognitive_level != null ? legacyKP.cognitive_level : null;
    c.cognition = { level: mapCognitive(cogRaw), targets: [], raw: cogRaw };

    var qts = [];
    if (Array.isArray(legacyKP.applicable_question_types)) {
      legacyKP.applicable_question_types.forEach(function (a) {
        if (!a || !a.type) return;
        qts.push({
          type: canonQuestionType(a.type),
          weight: Number(a.coefficient) || 1,
          rawType: a.type,
          cognitiveLevels: null,
          difficultyFactor: null
        });
      });
    } else if (typeof legacyKP.type === 'string' && legacyKP.type) {
      qts.push({
        type: canonQuestionType(legacyKP.type),
        weight: 1,
        rawType: legacyKP.type,
        cognitiveLevels: null,
        difficultyFactor: null
      });
    }
    c.presentation = {
      questionTypes: qts,
      graphicType: legacyKP.graphicType != null ? legacyKP.graphicType : null
    };

    var range = { min: null, max: null };
    var nr = legacyKP.number_range_default;
    if (nr && typeof nr === 'object' && (nr.min != null || nr.max != null)) {
      range.min = nr.min != null ? Number(nr.min) : null;
      range.max = nr.max != null ? Number(nr.max) : null;
    } else if (typeof nr === 'number') {
      range.min = 1;
      range.max = nr;
    }
    c.numeric = { range: range, integerOnly: true, decimalPlaces: 0 };

    var ctxDefaults = [];
    var allowPure = true, allowContextual = true;
    var ctx = legacyKP.context_default;
    if (typeof ctx === 'string' && ctx) {
      ctxDefaults.push(ctx);
      if (ctx === 'pure') allowContextual = false;
    }
    c.context = { defaults: ctxDefaults, allowPure: allowPure, allowContextual: allowContextual };

    var errs = [];
    if (Array.isArray(legacyKP.common_errors) && legacyKP.common_errors.length) {
      legacyKP.common_errors.forEach(function (e) {
        if (typeof e === 'string') errs.push(e);
        else if (e && e.id) errs.push(e);
      });
    } else {
      ErrMap.errorsForPlugin(legacyKP.pluginId).forEach(function (e) { errs.push(e); });
    }
    c.errors = errs;

    c.generation = { capabilities: deriveCapabilities(legacyKP, c.structure.maxSteps) };

    var sLevel = Number(legacyKP.spiral_level);
    if (!isFinite(sLevel) || sLevel < 1) sLevel = 1;
    var sMax = Number(legacyKP.max_spiral_level);
    if (!isFinite(sMax) || sMax < sLevel) sMax = sLevel;
    c.spiral = { level: sLevel, maxLevel: sMax };

    c.metadata = {
      weight: Number(legacyKP.weight) || 1,
      version: Ontology.VERSION
    };

    c.legacy = {
      difficulty: legacyKP.difficulty != null ? legacyKP.difficulty : null,
      example: legacyKP.example || null,
      prerequisites: legacyKP.prerequisites || null,
      related: legacyKP.related || null,
      status: legacyKP.status || null,
      category: legacyKP.category || null,
      bankRef: legacyKP.bankRef || null,
      exerciseTypes: legacyKP.exerciseTypes || null,
      cognitive_level: cogRaw,
      context_default: ctx
    };

    return Ontology.create(c);
  }

  var API = { fromLegacy: fromLegacy, mapCognitive: mapCognitive, canonQuestionType: canonQuestionType };

  global.KnowledgeOntologyNormalizer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-ontology-validator.js"] = function (module, exports, require) {
/**
 * shared/knowledge-ontology-validator.js — Canonical Schema 校验 (M1-01)
 *
 * validate(kp) -> { valid, errors[], warnings[], normalized }
 *   ERROR  : 结构非法（应阻断接入）。
 *   WARNING: 数据暂缺/未归一化（不阻断，留给 M1-02 数据治理）。
 *
 * 不修改传入对象；只读校验。
 */
(function (global) {
  'use strict';

  var Ontology = require("shared/knowledge-ontology.js");
  var Schema = require("shared/schemas/knowledge-point.schema.js");

  var COGNITIVE_MAP = Schema.COGNITIVE_MAP;

  function validate(kp) {
    var errors = [];
    var warnings = [];
    kp = kp || {};

    var name = kp.identity && kp.identity.name;

    if (!kp.id) errors.push('id 缺失');
    if (!name) errors.push('name 缺失');
    if (!kp.subject || Schema.SUBJECTS.indexOf(kp.subject) === -1) errors.push('subject 缺失/非法');

    var grade = kp.grade;
    if (typeof grade !== 'number' || grade < 1 || grade > 6 || grade % 1 !== 0) errors.push('grade 非法');

    var sp = kp.spiral || {};
    if (typeof sp.level !== 'number' || sp.level < 1) errors.push('spiral.level 非法');
    if (typeof sp.maxLevel !== 'number' || sp.maxLevel < sp.level) errors.push('spiral.maxLevel < spiral.level');

    var st = kp.structure || {};
    if (typeof st.maxSteps === 'number' && typeof st.minSteps === 'number' && st.maxSteps < st.minSteps) {
      errors.push('structure.maxSteps < minSteps');
    }

    var pres = kp.presentation || {};
    if (!Array.isArray(pres.questionTypes)) errors.push('questionTypes 非数组');

    var cog = kp.cognition || {};
    if (typeof cog.level !== 'number' || isNaN(cog.level)) errors.push('cognition.level 非法');

    // 字段级格式合法性（集中规则，ERROR 级）。缺数据不在此报。
    var legal = Schema.checkLegality(kp);
    legal.errors.forEach(function (e) { errors.push(e); });

    if (!(kp.identity && kp.identity.description)) warnings.push('description 缺失');

    var sem = kp.knowledge || {};
    if (!sem.factualContent || Object.keys(sem.factualContent).length === 0) warnings.push('factualContent 为空');
    if (!sem.operations || sem.operations.length === 0) warnings.push('operations 为空');
    if (Array.isArray(sem.operations)) {
      sem.operations.forEach(function (o) {
        if (Schema.KNOWN_OPERATIONS.indexOf(o) === -1) warnings.push('未知 operation: ' + o);
      });
    }
    if (sem.concept == null) warnings.push('concept 缺失');
    if (!Array.isArray(sem.prerequisites) || sem.prerequisites.length === 0) warnings.push('prerequisites 为空');

    var ctx = kp.context || {};
    if (!ctx.defaults || ctx.defaults.length === 0) warnings.push('context 为空');

    if (!kp.errors || kp.errors.length === 0) warnings.push('errors 为空');

    if (!(pres && pres.graphicType)) warnings.push('graphicType 缺失');

    if (Array.isArray(pres.questionTypes)) {
      pres.questionTypes.forEach(function (q) {
        if (q && Schema.KNOWN_QUESTION_TYPES.indexOf(q.type) === -1) warnings.push('未知 questionType: ' + q.type);
      });
    }

    var gen = kp.generation || {};
    var caps = Array.isArray(gen.capabilities) ? gen.capabilities : [];
    if (caps.length === 0) warnings.push('generation.capabilities 为空');

    if (cog.raw != null && typeof cog.raw === 'string' && !COGNITIVE_MAP[cog.raw]) {
      warnings.push('未知 cognitive_level: ' + cog.raw);
    }

    var valid = errors.length === 0;
    return { valid: valid, errors: errors, warnings: warnings, normalized: true };
  }

  var API = { validate: validate };

  global.KnowledgeOntologyValidator = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["dev/plugin-loader.js"] = function (module, exports, require) {
/**
 * dev/plugin-loader.js — 插件加载模块（步骤 3）
 *
 * 职责：
 *   在 Node 环境中用 vm 模拟浏览器全局对象（window），逐插件独立沙箱加载：
 *     1. 预执行共享层（shared/common.js → shared/knowledge-bank.js，模拟页面 <script> 顺序）；
 *     2. 按 registry 条目预执行 deps（如 pinyin-bank.js，相对站点根）；
 *     3. 执行插件文件本身；
 *     4. 捕获导出对象：module.exports 优先（含 generate 时），否则 window.__currentPlugin；
 *     5. 校验三大接口（generate/render/check），即 CONTRACT.md 第六节唯一运行时硬闸门。
 *
 * API：
 *   const { loadPlugin, loadAll } = require("dev/dev/plugin-loader.js");
 *   loadPlugin(entryOrId);   // → { plugin, compatible, missingInterfaces, source, error, ... }
 *   loadAll({ subject });    // → { results, summary }
 *
 * CLI：
 *   node dev/plugin-loader.js                    # 加载全部插件并输出体检摘要
 *   node dev/plugin-loader.js math-oral,chinese-pinyin
 *   node dev/plugin-loader.js --json
 */
'use strict';

var fs = require("fs");
var path = require("path");
var vm = require("vm");
var Module = require("module");

var ROOT = path.join(__dirname, '..');
var registryMod = require("dev/plugin-registry.js");

// 浏览器端共享层加载顺序（与各类页面静态 <script> 一致）：
// common/difficulty/subject-utils/print/knowledge-bank/module-catalog/svg-*/registry 先于一切插件。
// 必须与实际页面加载的共享脚本对齐，否则插件在沙箱中找不到 App.Difficulty / ChineseUtil / SVGUtil 等会误报失败。
var SHARED_SCRIPTS = [
  'shared/common.js',
  'shared/difficulty.js',
  'shared/difficulty-static.js',
  'shared/subject-utils.js',
  'shared/print.js',
  'shared/knowledge-bank.js',
  'shared/knowledge-math.js',
  'shared/knowledge-cn.js',
  'shared/knowledge-en.js',
  'shared/module-catalog.js',
  'shared/plugin-loader.js',
  'shared/svg-core.js',
  'shared/svg-calculation.js',
  'shared/svg-geometry.js',
  'shared/svg-make-ten.js',
  'shared/svg-chinese.js',
  'shared/svg-english.js',
  'plugins/registry.js',
  // M4-19：Strategy + Generator Runtime bundle（挂在 sandbox 全局，供 comprehensive 等插件无 require 使用）
  'shared/strategy-engine.bundle.js'
];

/**
 * 可「真加载」的 document 桩：
 * - 常规元素仅满足守卫判断；
 * - head.appendChild(<script>) 时在当前会话内执行真实脚本，
 *   并异步触发 onload/onerror——与浏览器 <script> 注入语义一致，
 *   使 App.PluginLoader.loadScript 与综合插件的动态子插件装载真正可用。
 */
function makeDocument(execScript) {
  function fakeEl(tagName) {
    return {
      tagName: tagName,
      style: {},
      setAttribute: function (k, v) { this[k] = v; },
      appendChild: function (c) { return c; },
      addEventListener: function () {}
    };
  }
  function fireOnload(el) {
    setTimeout(function () {
      try {
        execScript(path.join(ROOT, String(el.src)));
        if (typeof el.onload === 'function') el.onload();
      } catch (e) {
        if (typeof el.onerror === 'function') el.onerror(e);
        else throw e;
      }
    }, 0);
  }
  return {
    createElement: fakeEl,
    createTextNode: function () { return {}; },
    head: {
      appendChild: function (el) {
        if (el && typeof el.src === 'string' && typeof el.onload === 'function') {
          fireOnload(el);
        }
        return el;
      }
    },
    body: { appendChild: function (el) { return el; } },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getElementById: function () { return null; }
  };
}

/** 生成绑定到指定脚本路径的真实 require（供脚本内相对路径兜底依赖使用） */
function makeRequire(filename) {
  var m = new Module(filename, null);
  m.filename = filename;
  m.paths = Module._nodeModulePaths(path.dirname(filename));
  return function (spec) { return m.require(spec); };
}

/**
 * 创建一个插件专属的「浏览器式」沙箱会话。
 *
 * 关键点：整个会话只创建【一个持久 V8 上下文】（vm.createContext + 多次
 * vm.runInContext），所有脚本共享同一全局对象——等价于浏览器里多个
 * <script> 标签：前一脚本挂到 window 的数据（PINYIN_BANK / PluginUtil 等）
 * 对后续脚本的【裸标识符】可见。若对同一 sandbox 反复 runInNewContext，
 * 每次都会新建上下文，跨脚本裸标识符解析会失败。
 */
function createSession(entry) {
  var win = {
    console: console,
    crypto: globalThis.crypto,
    performance: globalThis.performance,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    setInterval: setInterval,
    clearInterval: clearInterval,
    navigator: { userAgent: 'NodePluginLoader/1.0' },
    localStorage: (function () {
      var store = {};
      return {
        getItem: function (k) { return k in store ? store[k] : null; },
        setItem: function (k, v) { store[k] = String(v); },
        removeItem: function (k) { delete store[k]; }
      };
    })()
  };
  // 浏览器式循环引用与 CommonJS 环境（module 随脚本切换，见 exec）
  win.window = win;
  win.self = win;
  win.globalThis = win;
  win.global = win;
  win.module = { exports: {} };
  win.exports = win.module.exports;

  var context = vm.createContext(win);

  /** 在当前会话内执行一个脚本（模拟 <script src>），返回其 module.exports */
  function exec(absPath) {
    var code = fs.readFileSync(absPath, 'utf8');
    // 每个脚本一份新的 module/exports，其余全局全部共享
    win.module = { exports: {} };
    win.exports = win.module.exports;
    win.require = makeVmRequire(absPath);
    var result = win.module.exports;
    vm.runInContext(code, context, { filename: absPath, timeout: 15000 });
    return result;
  }

  /**
   * 沙箱感知的 require：相对路径（./ ../）在【同一 vm 上下文】内执行，
   * 使子模块（core.js / render.js 等）对 global.PluginUtil 的赋值落到沙箱 win 上，
   * 而非 Node 全局——否则插件在沙箱中看不到 PluginUtil.createPlugin / randInt 等。
   * 内置模块（fs/path/crypto…）回退到 Node require。
   */
  function makeVmRequire(absPath) {
    return function (spec) {
      if (typeof spec === 'string' && spec.charAt(0) === '.') {
        var resolved = path.resolve(path.dirname(absPath), spec);
        return exec(resolved); // 递归走同一沙箱；子模块重新挂到 win 全局
      }
      return require(spec);
    };
  }

  win.document = makeDocument(exec);

  /** 按浏览器顺序装载：共享层 → deps → 插件本体，返回最终 module.exports */
  function boot() {
    SHARED_SCRIPTS.forEach(function (rel) { exec(path.join(ROOT, rel)); });
    (entry.deps || []).forEach(function (d) { exec(path.join(ROOT, d)); });
    return exec(entry.absolutePath);
  }

  return { window: win, exec: exec, boot: boot };
}

/**
 * 加载单个插件并做接口校验。
 * @param {Object|string} entryOrId registry 条目或插件 id
 */
function loadPlugin(entryOrId) {
  var entry = typeof entryOrId === 'string'
    ? registryMod.getEntry(entryOrId)
    : entryOrId;

  var res = {
    id: entry ? entry.id : String(entryOrId),
    file: entry ? entry.file : '',
    plugin: null,
    source: null,
    compatible: false,
    missingInterfaces: [],
    warnings: [],
    error: null
  };
  if (!entry) {
    res.error = '注册表中不存在该插件';
    return res;
  }

  var mod = null, win = null;
  try {
    var session = createSession(entry);
    mod = session.boot();
    win = session.window;
  } catch (e) {
    res.error = '执行失败：' + e.message;
    return res;
  }

  // 导出解析：module.exports 优先（与 dev/regression-check.js 口径一致），
  // 否则回退 window.__currentPlugin，最后兜底扫描 window 上含三大接口的对象
  var pick = null;
  if (mod && typeof mod.generate === 'function') {
    pick = mod;
    res.source = 'module.exports';
  } else if (win.__currentPlugin && typeof win.__currentPlugin.generate === 'function') {
    pick = win.__currentPlugin;
    res.source = 'window.__currentPlugin';
  } else {
    for (var k in win) {
      var v = win[k];
      if (v && typeof v === 'object' &&
          typeof v.generate === 'function' &&
          typeof v.render === 'function' &&
          typeof v.check === 'function') {
        pick = v;
        res.source = 'window.' + k;
        break;
      }
    }
  }
  if (!pick) {
    res.error = '无法捕获导出对象（module.exports 与 __currentPlugin 均无 generate）';
    return res;
  }

  // 三大接口硬闸门（CONTRACT.md 第六节）
  ['generate', 'render', 'check'].forEach(function (fn) {
    if (typeof pick[fn] !== 'function') res.missingInterfaces.push(fn);
  });

  // 必填元数据提醒（不阻断加载，供上层审计）
  ['id', 'name', 'subject', 'grades'].forEach(function (f) {
    var val = pick[f];
    if (val == null || (Array.isArray(val) && !val.length)) {
      res.warnings.push('缺少元数据字段 ' + f);
    }
  });
  if (pick.id !== entry.id) {
    res.warnings.push('id 不一致：registry=' + entry.id + '，插件对象=' + pick.id);
  }

  res.plugin = pick;
  res.compatible = res.missingInterfaces.length === 0;
  return res;
}

/**
 * 批量加载全部（或筛选后）插件。
 * @param {{subject?: string, ids?: string[]}} [options]
 */
function loadAll(options) {
  options = options || {};
  var list = registryMod.readRegistry();

  if (options.subject) {
    list = list.filter(function (e) { return e.subject === options.subject; });
  }
  if (options.ids && options.ids.length) {
    var wanted = {};
    options.ids.forEach(function (id) { wanted[id] = true; });
    list = list.filter(function (e) { return wanted[e.id] || wanted[e.runtimeId]; });
  }

  var results = [];
  list.forEach(function (e) { results.push(loadPlugin(e)); });

  var compatible = 0, incompatible = 0, failed = 0;
  results.forEach(function (r) {
    if (r.error) failed++;
    else if (r.compatible) compatible++;
    else incompatible++;
  });

  return {
    results: results,
    summary: { total: results.length, compatible: compatible, incompatible: incompatible, failed: failed }
  };
}

module.exports = { loadPlugin: loadPlugin, loadAll: loadAll };

// ---- CLI ----
if (require.main === module) {
  var args = process.argv.slice(2);
  var asJson = args.indexOf('--json') !== -1;
  var idsArg = args.filter(function (a) { return a !== '--json'; })[0];
  var options = idsArg ? { ids: idsArg.split(',') } : {};

  var out = loadAll(options);
  if (asJson) {
    console.log(JSON.stringify(out, null, 2));
  } else {
    out.results.forEach(function (r) {
      if (r.error) {
        console.log('  ✗ ' + r.id + ' — ' + r.error);
      } else if (!r.compatible) {
        console.log('  ✗ ' + r.id + ' — 接口缺失：' + r.missingInterfaces.join('/'));
      } else {
        var extra = r.warnings.length ? '  ⚠ ' + r.warnings.join('；') : '';
        console.log('  ✓ ' + r.id + '  [' + r.source + ']' + extra);
      }
    });
    console.log('\n汇总：共 ' + out.summary.total +
      '，兼容 ' + out.summary.compatible +
      '，接口不兼容 ' + out.summary.incompatible +
      '，加载失败 ' + out.summary.failed);
  }
  if (out.summary.failed > 0 || out.summary.incompatible > 0) process.exitCode = 1;
}

};
__defs["shared/generator/legacy-plugin-adapter.js"] = function (module, exports, require) {
/**
 * shared/generator/legacy-plugin-adapter.js — M4-R02 Legacy Plugin Adapter
 *
 * 将现有（legacy）插件包装为 GeneratorContract，不改动插件内部逻辑：
 *
 *   QuestionPlan
 *     ↓
 *   Adapter（createLegacyGenerator）
 *     ↓
 *   legacy options（M3 LegacyAdapter 映射）
 *     ↓
 *   plugin.generate()
 *     ↓
 *   SemanticQuestion[]（统一语义输出，无渲染函数）
 *
 * 统一映射（每个 SemanticQuestion 携带）：
 *   knowledgePointId / questionType / difficulty / difficultyParams /
 *   numberRange / spiralLevel / context / seed
 *
 * 保留旧插件 fallback：runLegacyFallback 返回原始 exerciseSet（含 render/check），
 * 渲染与打印契约不变。
 */
'use strict';

var LegacyAdapter = require("shared/strategy/legacy-adapter.js");
var Contract = require("shared/generator/generator-contract.js");

/**
 * 把 legacy 插件包装为 GeneratorContract。
 * @param {Object} plugin 已加载的 legacy 插件（含 generate）
 * @param {Object} [meta] { capabilities: string[], knowledgePoints: string[] }
 *        可由 M2 Generator Capability Registry 注入；缺省时 capabilities 取空数组。
 */
function createLegacyGenerator(plugin, meta) {
  meta = meta || {};
  var capabilities = Array.isArray(meta.capabilities) ? meta.capabilities.slice() : [];
  var knowledgePoints = Array.isArray(meta.knowledgePoints) ? meta.knowledgePoints.slice() : [];

  var generator = {
    id: 'legacy:' + (plugin.id || 'plugin'),
    subject: Contract.canonSubject(plugin.subject || 'math'),
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,
    plugin: plugin,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      if (capabilities.length && capabilities.indexOf(plan.questionTypeId) === -1) return false;
      if (knowledgePoints.length && plan.knowledgePointId &&
          knowledgePoints.indexOf(plan.knowledgePointId) === -1) return false;
      return true;
    },

    generate: function (plan, context) {
      context = context || {};
      var MAX_RETRIES = 3;

      function doGenerate(attempt) {
        var ctx = attempt === 0 ? context : { seed: (context.seed || '') + ':r' + attempt, legacy: context.legacy };
        var options = LegacyAdapter.adaptPlanToLegacyOptions(plan, ctx.legacy || {});
        if (attempt > 0 && options.seed != null) {
          options.seed = options.seed + ':r' + attempt;
        }
        var set = plugin.generate(options);

        function handleResult(s) {
          var sqs = toSemanticQuestions(s, plan, ctx);
          var q = checkBatchQuality(sqs, plan);
          if (!q.ok && attempt < MAX_RETRIES) return doGenerate(attempt + 1);
          return sqs;
        }

        if (set && typeof set.then === 'function') {
          return set.then(handleResult);
        }
        return handleResult(set);
      }

      return doGenerate(0);
    }
  };
  return generator;
}

/** 输入类型 → SemanticQuestion.answerMode 映射（M4 严格契约） */
function mapInputType(inputType) {
  // M4 Generator Contract 仅区分 'read-aloud' 与 'input'（书面作答）。
  // choice/multi/none 仍属书面作答（学生选择/填写/无需文字），统一映射为 'input'，
  // 具体差异由 questionType / options / distractors 表达，避免非法 answerMode。
  if (inputType === 'read-aloud') return 'read-aloud';
  return 'input';
}

/** 标量化（数组/对象 → 可比较字符串；对象优先取其 value） */
function coerceScalar(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
  }
  return String(v);
}

/** 从 per-question render(i) 输出里提取 <svg>...</svg>（捕获失败/无图形返回 null） */
function captureSvg(renderFn, owner, index) {
  if (typeof renderFn !== 'function') return null;
  try {
    var out = renderFn.call(owner, index);
    if (out == null) return null;
    var s = String(out);
    var start = s.indexOf('<svg');
    if (start === -1) return null;
    var end = s.indexOf('</svg>', start);
    if (end === -1) return null;
    return s.slice(start, end + '</svg>'.length);
  } catch (e) {
    return null;
  }
}

/**
 * legacy exerciseSet → SemanticQuestion[]（统一映射，剥离渲染契约）。
 */
function toSemanticQuestions(set, plan, context) {
  context = context || {};
  var questions = (set && Array.isArray(set.questions)) ? set.questions : [];
  var constraints = plan.constraints || {};
  var seedBase = context.seed;
  var SQ = require("shared/semantic-question.js");

  return questions.map(function (q, i) {
    // 跟读类（无书面作答，如 english-alphabet 的 letter/name/sound/example）→ answerMode 'read-aloud'
    var isReadAloud = q.answer == null && q.inputType == null && (q.letter != null || q.name != null);
    // 图形/统计型插件把题干放在 q.data.question 而非 q.q（如 stats-classify/picture）
    var dataPrompt = q.data ? (q.data.question != null ? q.data.question
      : (q.data.prompt != null ? q.data.prompt
        : (q.data.text != null ? q.data.text : null))) : null;
    var prompt = q.q != null ? q.q
      : (q.question != null ? q.question
        : (q.text != null ? q.text
          : (q.stem != null ? q.stem
            : (dataPrompt != null ? dataPrompt
              : (q.name != null ? q.name
                : (q.char != null ? q.char
                  : (q.pinyin != null ? q.pinyin
                      : (q.letter != null ? q.letter : ''))))))));

    // 规范化 answer 为对象格式 { value, acceptable } 以符合 SemanticQuestion Schema
    var rawAnswer = q.answer != null ? q.answer : null;
    var answerObj = (typeof rawAnswer === 'object' && rawAnswer !== null) ? rawAnswer : { value: rawAnswer, acceptable: [] };

    // answerMode：read-aloud（跟读类）或按 inputType 映射（choice/text/input/multi）
    var answerMode = isReadAloud ? 'read-aloud' : mapInputType(q.inputType || q.type);

    // distractors：choice 题由 options（剔除正确答案）构建
    var distractors = [];
    var allOptions = [];
    if (!isReadAloud && (q.inputType === 'choice' || q.type === 'choice') && Array.isArray(q.options)) {
      var correct = rawAnswer != null ? coerceScalar(rawAnswer) : null;
      allOptions = q.options.slice(); // 完整选项（含正确答案），用于渲染
      q.options.forEach(function (opt) {
        var val = coerceScalar(opt);
        if (val && val !== correct) distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
      });
    } else if (distractors.length > 0) {
      // 回退：从 answer + distractors 重建完整选项
      var correct = answerObj && answerObj.value != null ? coerceScalar(answerObj.value) : null;
      if (correct) allOptions = [correct].concat(distractors.map(function (d) { return d.value; }));
    }

    // graphic：携带 legacy svg / graphic / drawing / illustration，
    // 使 PresentationRenderer 经由 LegacySvgAdapter（R04）渲染出图形。
    // 部分图形型插件把视觉放在 per-question render(i) 而非 q.svg 字段
    // （如 patterns/stats/picture-equations）——在此捕获其 <svg> 字符串为描述符。
    var svgRaw = q.svg || q.illustration || null;
    if (!svgRaw && typeof q.render === 'function') {
      svgRaw = captureSvg(q.render, q, i);
    }
    var sq = {
      knowledgePointId: plan.knowledgePointId,
      questionType: plan.questionTypeId,
      difficulty: q.difficulty != null ? q.difficulty : plan.difficulty,
      difficultyParams: {
        level: plan.difficulty,
        scale: constraints.scale != null ? constraints.scale : 1,
        steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
        allowBracket: !!constraints.allowBracket,
        allowMultDiv: !!constraints.allowMultDiv
      },
      numberRange: constraints.numberRange || { min: 1, max: 1 },
      spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
      context: plan.contextType != null ? plan.contextType : 'standard',
      seed: seedBase != null ? seedBase + ':' + i : null,
      content: { prompt: prompt },
      question: { prompt: prompt, answerMode: answerMode },
      answer: answerObj,
      distractors: distractors,
      options: allOptions.length ? allOptions : undefined,
      graphic: q.graphic != null ? q.graphic
        : (svgRaw ? { type: 'custom', subtype: null, params: { rawSvg: svgRaw }, renderHints: {} } : null),
      hint: q.hint != null ? q.hint : null,
      data: {
        kind: q.kind != null ? q.kind : null,
        type: q.type != null ? q.type : null,
        letter: q.letter != null ? q.letter : null,
        name: q.name != null ? q.name : null,
        example: q.example != null ? q.example : null,
        raw: (q.data != null && typeof q.data === 'object') ? safeCopy(q.data) : null,
        meta: safeCopy(set.meta)
      }
    };
    // 使用工厂函数补全 id / knowledgePoint / metadata 等必填字段
    return SQ.createSemanticQuestion(sq);
  });
}

function safeCopy(v) {
  if (v == null) return null;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (e) {
    return null;
  }
}

/** 从 prompt 提取操作数（越界检查用） */
function parseOperands(prompt) {
  if (!prompt || typeof prompt !== 'string') return [];
  var nums = [];
  var re = /(-?\d+\.?\d*)/g;
  var m;
  while ((m = re.exec(prompt)) !== null) nums.push(Number(m[1]));
  return nums;
}

/** 批次质量检查：越界 + 重复 prompt */
function checkBatchQuality(sqs, plan) {
  var range = (plan.constraints && plan.constraints.numberRange) || null;
  var seen = {};
  for (var i = 0; i < sqs.length; i++) {
    var q = sqs[i];
    var prompt = (q.content && q.content.prompt) || (q.question && q.question.prompt) || '';
    if (range) {
      var ops = parseOperands(prompt);
      for (var j = 0; j < ops.length; j++) {
        if (ops[j] < range.min || ops[j] > range.max) return { ok: false, reason: 'bounds' };
      }
    }
    if (seen[prompt]) return { ok: false, reason: 'duplicates' };
    seen[prompt] = true;
  }
  return { ok: true };
}

/**
 * 旧插件 fallback：QuestionPlan → legacy options → plugin.generate()
 * 返回原始 exerciseSet（含 render/check），渲染与打印契约不变。
 */
function runLegacyFallback(plugin, plan, uiExtra) {
  var options = LegacyAdapter.adaptPlanToLegacyOptions(plan, uiExtra || {});
  return plugin.generate(options);
}

module.exports = {
  createLegacyGenerator: createLegacyGenerator,
  toSemanticQuestions: toSemanticQuestions,
  runLegacyFallback: runLegacyFallback
};

};
__defs["shared/generator/generators/arithmetic.js"] = function (module, exports, require) {
/**
 * shared/generator/generators/arithmetic.js — M4-R06 算术族核心 Generator
 *
 * addition / subtraction / multiplication / division / mixed-calculation
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成；
 * 输出 SemanticQuestion（无渲染逻辑）；难度/结构全部来自 QuestionPlan 约束。
 */
'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

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
    return (plan.knowledgePointId + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
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
    capabilities: ['oral', 'calc'],
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
          prompt: prompt,
          answer: String(answer),
          answerMode: 'input',
          hint: null,
          data: {
            operation: Arith.normalizeOperation(context.operation || plan.operation || op),
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

};
__defs["shared/generator/generators/selection.js"] = function (module, exports, require) {
/**
 * shared/generator/generators/selection.js — M4-R06 选择题族核心 Generator
 *
 * fill（填空）/ choice（选择）/ judge（判断）
 *
 * 复用算术核心抽取件（操作数/结构/答案/干扰项），输出 SemanticQuestion，
 * 无渲染逻辑；难度/结构全部来自 QuestionPlan 约束。
 */
'use strict';

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

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

};
__defs["shared/generator/generators/complex.js"] = function (module, exports, require) {
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

var Rng = require("shared/generator/core/rng.js");
var Arith = require("shared/generator/core/arithmetic-core.js");

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

};
__defs["shared/knowledge-operation.js"] = function (module, exports, require) {
/**
 * shared/knowledge-operation.js — Canonical Operation Vocabulary (M1-02.1)
 *
 * 统一「知识点要求学生执行的操作」枚举，解决 Legacy 中潜在的同义词碎片
 * （add / addition / plus / sum / calc-add ...）。
 *
 * 仅数据/语义定义，不依赖 DOM / 插件 / 生成流程。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var OPERATIONS = {
    add:        { id: 'add',        name: '加法',         description: '执行加法运算',            category: 'arithmetic' },
    subtract:   { id: 'subtract',   name: '减法',         description: '执行减法运算',            category: 'arithmetic' },
    multiply:   { id: 'multiply',   name: '乘法',         description: '执行乘法运算',            category: 'arithmetic' },
    divide:     { id: 'divide',     name: '除法',         description: '执行除法运算',            category: 'arithmetic' },
    calculate:  { id: 'calculate',  name: '计算',         description: '进行数值计算',            category: 'arithmetic' },

    compare:    { id: 'compare',    name: '比较',         description: '比较大小/多少/关系',      category: 'comparison' },
    order:      { id: 'order',      name: '排序',         description: '按规则排序/排列',         category: 'comparison' },

    compose:    { id: 'compose',    name: '组合',         description: '组合/合成整体',           category: 'composition' },
    decompose:  { id: 'decompose',  name: '分解',         description: '分解/拆分',               category: 'composition' },

    measure:    { id: 'measure',    name: '度量',         description: '测量/量化',               category: 'measurement' },
    convert:    { id: 'convert',    name: '换算',         description: '单位/形式换算',           category: 'measurement' },

    identify:   { id: 'identify',   name: '识别',         description: '识别/辨认对象或属性',     category: 'classification' },
    classify:   { id: 'classify',   name: '分类',         description: '分类/归类',               category: 'classification' },

    read:       { id: 'read',       name: '认读',         description: '认读/阅读符号文字',       category: 'literacy' },
    write:      { id: 'write',      name: '书写',         description: '书写/表达',               category: 'literacy' },

    reason:     { id: 'reason',     name: '推理',         description: '逻辑推理',                category: 'cognition' },
    represent:  { id: 'represent',  name: '表征',         description: '用图/式/模型表征',        category: 'cognition' },
    model:      { id: 'model',      name: '建模',         description: '建立模型解决问题',        category: 'cognition' }
  };

  var ALIASES = {
    addition: 'add', plus: 'add', sum: 'add', 加: 'add', 加法: 'add', calcadd: 'add', 'add-operation': 'add',
    subtraction: 'subtract', minus: 'subtract', 减: 'subtract', 减法: 'subtract', sub: 'subtract',
    multiplication: 'multiply', 乘: 'multiply', 乘法: 'multiply', mult: 'multiply',
    division: 'divide', 除: 'divide', 除法: 'divide', div: 'divide',
    比较: 'compare', 比大小: 'compare', comparison: 'compare', 对比: 'compare',
    排序: 'order', 顺序: 'order', sort: 'order', 排列: 'order',
    组合: 'compose', 合成: 'compose', 合并: 'compose',
    分解: 'decompose', 拆分: 'decompose',
    测量: 'measure', 度量: 'measure',
    换算: 'convert', 转换: 'convert',
    识别: 'identify', 辨认: 'identify', 认: 'identify',
    分类: 'classify', 归类: 'classify',
    读: 'read', 认读: 'read',
    写: 'write', 书写: 'write',
    计算: 'calculate', compute: 'calculate', calc: 'calculate',
    推理: 'reason', 逻辑: 'reason',
    表示: 'represent', 表征: 'represent',
    建模: 'model'
  };

  function isCanonical(id) {
    return OPERATIONS.hasOwnProperty(id);
  }

  function normalize(raw) {
    if (raw == null) return { canonical: null, status: 'unresolved' };
    var s = String(raw).trim();
    if (isCanonical(s)) return { canonical: s, status: 'canonical' };
    if (ALIASES.hasOwnProperty(s)) return { canonical: ALIASES[s], status: 'alias' };
    return { canonical: null, status: 'unresolved' };
  }

  function hasAliasCycle() {
    var visited = {}, inStack = {};
    var keys = Object.keys(ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (visited[k]) continue;
      var chain = [], cur = k;
      while (cur != null) {
        if (inStack[cur]) return true;
        if (visited[cur]) break;
        inStack[cur] = true; visited[cur] = true; chain.push(cur);
        cur = ALIASES[cur];
        if (cur != null && isCanonical(cur)) break;
      }
      inStack = {};
    }
    return false;
  }

  var API = {
    VERSION: VERSION,
    OPERATIONS: OPERATIONS,
    ALIASES: ALIASES,
    CANONICAL_IDS: Object.keys(OPERATIONS),
    isCanonical: isCanonical,
    normalize: normalize,
    hasAliasCycle: hasAliasCycle
  };

  global.KnowledgeOperation = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-operation-map.js"] = function (module, exports, require) {
/**
 * shared/ontology-operation-map.js — Curated Plugin → Canonical Operations (M1-02.1)
 *
 * 治理记录：将每个插件映射到它「要求学生执行的操作」（Canonical Operation）。
 * 仅记录可依据「插件命名 / 既有插件行为」可靠推断的操作；不确定者留空（unresolved），
 * 由后续人工或 M1-02 后续批次补全。绝不作无依据猜测。
 *
 * 这是「增量语义建模」：不修改 KnowledgeBank 原始条目，由 Normalizer 在归一化时应用本映射。
 * 可审计、可重复、可回滚（删除本映射即回到 M1-01 无 operations 状态）。
 *
 * evidence 约定：
 *   - 'plugin-name'   : 由插件命名稳定推断（如 multiplication-table → multiply）
 *   - 'documented'    : 与项目既有插件行为一致
 * 置信度：
 *   - 'medium'        : 命名/行为可可靠推断
 *   - 'low'           : 仅按命名粗略归类，待插件细读确认
 */
(function (global) {
  'use strict';

  var Ops = require("shared/knowledge-operation.js");

  var MAP = {
    'math-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-oral': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-g1-multiplication-table': { ops: ['multiply'], confidence: 'high', evidence: 'plugin-name' },

    'math-g2-column': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-vertical': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-vertical': { ops: ['calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-make-ten': { ops: ['add', 'subtract'], confidence: 'medium', evidence: 'documented' },

    'math-shapes': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-geometry': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-area': { ops: ['identify', 'classify', 'measure'], confidence: 'medium', evidence: 'plugin-name' },

    'math-fraction': { ops: ['identify', 'compare', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-decimal': { ops: ['identify', 'compare', 'calculate'], confidence: 'medium', evidence: 'documented' },

    'math-unit-convert': { ops: ['convert', 'measure'], confidence: 'medium', evidence: 'plugin-name' },
    'math-money': { ops: ['measure', 'convert', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-clock': { ops: ['read', 'measure'], confidence: 'medium', evidence: 'plugin-name' },
    'math-time-date': { ops: ['read', 'measure'], confidence: 'medium', evidence: 'plugin-name' },

    'math-patterns': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'documented' },
    'math-g1-patterns': { ops: ['identify', 'reason'], confidence: 'medium', evidence: 'documented' },
    'math-number-sense': { ops: ['identify', 'compare', 'classify'], confidence: 'medium', evidence: 'documented' },
    'math-position-direction': { ops: ['identify', 'classify'], confidence: 'medium', evidence: 'plugin-name' },
    'math-combination-set': { ops: ['classify', 'identify'], confidence: 'medium', evidence: 'plugin-name' },

    'math-data-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-statistics': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-stats': { ops: ['classify', 'identify', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-word-problems': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g6-word-problems': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g4-word': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },
    'math-g5-word': { ops: ['reason', 'calculate'], confidence: 'medium', evidence: 'documented' },

    'math-picture-equations': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g2-picture-equations': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g4-picture': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g5-picture': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-picture-equation': { ops: ['represent', 'calculate'], confidence: 'medium', evidence: 'plugin-name' },

    'math-logic-reasoning': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },
    'math-g6-reasoning': { ops: ['reason'], confidence: 'medium', evidence: 'plugin-name' },

    'math-g4-draw': { ops: ['represent'], confidence: 'low', evidence: 'plugin-name' },
    'math-g5-draw': { ops: ['represent'], confidence: 'low', evidence: 'plugin-name' },

    'chinese-pinyin': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' },
    'chinese-hanzi': { ops: ['read', 'write', 'identify', 'compose'], confidence: 'high', evidence: 'documented' },
    'pinyin-to-char': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' },
    'english-alphabet': { ops: ['read', 'write', 'identify'], confidence: 'high', evidence: 'documented' }
  };

  function operationsForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    if (!e) return [];
    return e.ops.filter(function (o) { return Ops.isCanonical(o); });
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? MAP[pluginId] : null;
  }

  function operationsForKP(kp) {
    kp = kp || {};
    if (Array.isArray(kp.operations) && kp.operations.length) return kp.operations.slice();
    return operationsForPlugin(kp.pluginId);
  }

  var API = {
    MAP: MAP,
    operationsForPlugin: operationsForPlugin,
    operationsForKP: operationsForKP,
    metaForPlugin: metaForPlugin
  };

  global.OntologyOperationMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-factual.js"] = function (module, exports, require) {
/**
 * shared/knowledge-factual.js — Factual Content 类型与校验 (M1-02.2)
 *
 * 事实 = 稳定的教学事实（公式/规则/单位/词表/概念/分类/固定关系/口诀/知识范围/符号/系统）。
 * 策略字段（题量/难度/用户掌握度/题目顺序/随机策略）严禁进入 factualContent。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var FACT_TYPES = [
    'formula', 'rule', 'concept', 'vocabulary', 'unit', 'table',
    'classification', 'relationship', 'notation', 'range', 'system', 'count', 'alphabet'
  ];

  var STRATEGY_FIELDS = [
    'questionCount', 'preferredDifficulty', 'adaptiveDelta', 'userMastery',
    'nextQuestion', 'generationOrder', 'randomSeed', 'difficulty', 'useContext'
  ];

  function isFactualType(k) { return FACT_TYPES.indexOf(k) !== -1; }

  function validate(fc) {
    var errors = [], warnings = [];
    if (fc == null) return { valid: true, errors: errors, warnings: warnings };
    if (typeof fc !== 'object' || Array.isArray(fc)) {
      errors.push('factualContent 必须是对象');
      return { valid: false, errors: errors, warnings: warnings };
    }
    Object.keys(fc).forEach(function (k) {
      if (STRATEGY_FIELDS.indexOf(k) !== -1) {
        errors.push('策略字段混入 factualContent: ' + k);
      } else if (!isFactualType(k)) {
        warnings.push('未声明 fact type: ' + k);
      }
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  var API = {
    VERSION: VERSION,
    FACT_TYPES: FACT_TYPES,
    STRATEGY_FIELDS: STRATEGY_FIELDS,
    isFactualType: isFactualType,
    validate: validate
  };

  global.KnowledgeFactual = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-factual-map.js"] = function (module, exports, require) {
/**
 * shared/ontology-factual-map.js — Curated Plugin → Factual Content (M1-02.2)
 *
 * 治理记录：仅纳入「有明确、稳定教学依据」的事实（HIGH/MEDIUM 置信度）。
 * 无法确认者留空（factualContent = {}），由后续批次/人工补齐。绝不伪造事实。
 *
 * 证据等级：
 *   high   : 项目命名/既有行为即可确定（如乘法表 1-9、人民币单位 元角分、字母 26）
 *   medium : 与标准课程知识一致（如拼音声韵调数量、常见单位集合）
 * 低级推断（LOW/UNVERIFIED）不写入核心事实。
 */
(function (global) {
  'use strict';

  var FactOnt = require("shared/knowledge-factual.js");

  var MAP = {
    'math-g1-multiplication-table': {
      factualContent: { table: '1-9' },
      confidence: 'high', evidence: 'plugin-name'
    },
    'math-money': {
      factualContent: { units: ['元', '角', '分'] },
      confidence: 'high', evidence: 'standard-curriculum'
    },
    'chinese-pinyin': {
      factualContent: { system: '汉语拼音', initials: 23, finals: 24, tones: 4 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'pinyin-to-char': {
      factualContent: { system: '汉语拼音', tones: 4 },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'english-alphabet': {
      factualContent: { alphabet: { letters: 26 } },
      confidence: 'high', evidence: 'standard-curriculum'
    },
    'math-unit-convert': {
      factualContent: { units: ['cm', 'm', 'km', 'g', 'kg', 'mL', 'L'] },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-fraction': {
      factualContent: { notation: 'a/b', concept: '整体的一部分' },
      confidence: 'medium', evidence: 'standard-curriculum'
    },
    'math-decimal': {
      factualContent: { notation: '十进制小数' },
      confidence: 'low', evidence: 'standard-curriculum'
    }
  };

  function factualForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    if (!e) return {};
    return e.factualContent;
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? MAP[pluginId] : null;
  }

  var API = { MAP: MAP, factualForPlugin: factualForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyFactualMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/knowledge-error.js"] = function (module, exports, require) {
/**
 * shared/knowledge-error.js — Canonical Error Ontology (M1-02.3)
 *
 * 描述「学生在该知识点上稳定的认知/操作错误模式」，不是某一道题的错误答案。
 * Error ID：稳定、可复用、英文 kebab-case、与题目/插件无关。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var ERROR_CATEGORIES = [
    'concept', 'operation', 'calculation', 'notation',
    'unit', 'reading', 'writing', 'structure', 'reasoning', 'attention'
  ];

  var ID_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/;
  var FORBIDDEN_RE = /(plugin|question|error-[0-9]|math-g|cn-|en-)/;

  function isCategory(c) { return ERROR_CATEGORIES.indexOf(c) !== -1; }

  function isValidId(id) {
    if (typeof id !== 'string' || !ID_RE.test(id)) return false;
    if (FORBIDDEN_RE.test(id)) return false;
    return true;
  }

  function normalizeError(e) {
    if (typeof e === 'string') return { id: e, category: null, description: e };
    if (e && typeof e === 'object') return { id: e.id, category: e.category || null, description: e.description || '' };
    return null;
  }

  function validate(errors) {
    var errs = [], warns = [];
    if (!Array.isArray(errors)) {
      errs.push('errors 必须是数组');
      return { valid: false, errors: errs, warnings: warns };
    }
    var seen = {};
    errors.forEach(function (raw) {
      var e = normalizeError(raw);
      if (!e || !e.id) { errs.push('error 缺少合法 id'); return; }
      if (!isValidId(e.id)) errs.push('非法 error id: ' + e.id);
      if (seen[e.id]) errs.push('重复 error id: ' + e.id);
      seen[e.id] = 1;
      if (!e.description) errs.push('error 缺少 description: ' + e.id);
      if (e.category && !isCategory(e.category)) errs.push('未知 error category: ' + e.category);
    });
    return { valid: errs.length === 0, errors: errs, warnings: warns };
  }

  var API = {
    VERSION: VERSION,
    ERROR_CATEGORIES: ERROR_CATEGORIES,
    isCategory: isCategory,
    isValidId: isValidId,
    normalizeError: normalizeError,
    validate: validate
  };

  global.KnowledgeError = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/ontology-error-map.js"] = function (module, exports, require) {
/**
 * shared/ontology-error-map.js — Curated Plugin → Canonical Errors (M1-02.3)
 *
 * 治理记录：仅纳入「稳定、公认的错误模式」（MEDIUM 置信度，标准教学/pedagogy 依据）。
 * 不为凑覆盖率而批量制造错误；无法确认者留空（errors = []）。绝不写入具体题目答案。
 */
(function (global) {
  'use strict';

  var MAP = {
    'math-make-ten': [
      { id: 'borrow-omission', category: 'calculation', description: '退位减法遗漏退位' }
    ],
    'math-g2-column': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'digit-alignment-error', category: 'notation', description: '数位未对齐' }
    ],
    'math-g2-mixed': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' },
      { id: 'borrow-omission', category: 'calculation', description: '退位遗漏' }
    ],
    'math-g4-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-g5-vertical': [
      { id: 'carry-omission', category: 'calculation', description: '进位遗漏' }
    ],
    'math-unit-convert': [
      { id: 'unit-confusion', category: 'unit', description: '单位混淆/进率错误' }
    ],
    'math-money': [
      { id: 'unit-confusion', category: 'unit', description: '人民币单位混淆' }
    ],
    'math-fraction': [
      { id: 'denominator-confusion', category: 'concept', description: '分子/分母混淆' }
    ],
    'math-decimal': [
      { id: 'decimal-point-error', category: 'notation', description: '小数点位置错误' }
    ],
    'chinese-pinyin': [
      { id: 'tone-marking-error', category: 'notation', description: '标调错误' },
      { id: 'initial-final-confusion', category: 'reading', description: '声母韵母混淆' }
    ],
    'pinyin-to-char': [
      { id: 'tone-marking-error', category: 'notation', description: '标调错误' }
    ],
    'english-alphabet': [
      { id: 'letter-case-confusion', category: 'writing', description: '字母大小写混淆' }
    ],
    'math-g1-multiplication-table': [
      { id: 'multiplication-fact-confusion', category: 'operation', description: '乘法口诀混淆' }
    ]
  };

  function errorsForPlugin(pluginId) {
    var e = pluginId && MAP[pluginId];
    return e ? e.slice() : [];
  }

  function metaForPlugin(pluginId) {
    return pluginId && MAP[pluginId] ? { count: MAP[pluginId].length } : null;
  }

  var API = { MAP: MAP, errorsForPlugin: errorsForPlugin, metaForPlugin: metaForPlugin };

  global.OntologyErrorMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

};
__defs["shared/module-catalog.js"] = function (module, exports, require) {
// shared/module-catalog.js
/**
 * shared/module-catalog.js — 全科目题型模块目录（唯一数据源）
 *
 * 以结构化方式组织数学基础模块 M0–M12、竞赛模块 C1–C9、语文模块 N1–N8 与英语模块 E1–E6，
 * 供题型选择页、练习页与模块化开发参考。
 *
 * 科目代码（SUBJECTS）：
 *   math 数学（模块前缀 M/C）
 *   cn   语文（模块前缀 N）
 *   en   英语（模块前缀 E）
 * 模块 ID 全局唯一：{M|C|N|E}{序号}，与知识点 ID 的 moduleIdLower 段对应。
 *
 * 数据结构：
 *   MODULE_CATALOG[] -> { id, name, subject, grades: number[], category, level?, icon?, desc?, gradeStatus?, status? }
 *   - id       模块唯一标识
 *   - name     模块中文名
 *   - subject  所属科目（SUBJECTS 之一：math / cn / en）
 *   - grades   适用年级（1-6）
 *   - category 领域（数学：number / geometry / statistics / mixed；
 *              语文英语：language-basic / language-advanced / literature / reading / writing / comprehensive）
 *   - level    层级（仅数学模块：basic 基础 / competition 竞赛；语文英语暂不使用）
 *   - icon     展示图标（emoji，可选）
 *   - desc     模块描述（可选）
 *   - gradeStatus  按年级就绪状态（仅数学竞赛模块）：{ [grade]: 'active' | 'placeholder' }
 *       与 shared/knowledge-bank.js 对应年级知识点 status 保持一致。
 *       五年级竞赛处于重新开发阶段（见 docs/g5-competition-knowledge-map.md），
 *       四年级/六年级沿用既有实现；基础模块 M0-M12 全年级 active。
 *   - status   模块整体就绪状态（仅语文/英语模块）：'active' | 'placeholder'
 *       placeholder 表示目录已建、插件与知识点待逐轮激活（如 N8/E6 综合卷）。
 *
 * 导出：
 *   MODULE_CATALOG     = BASIC_MODULES.concat(CHINESE_MODULES, ENGLISH_MODULES) 再并竞赛（全量，供页面渲染）
 *   BASIC_MODULES      数学基础模块数组（M0-M12，subject=math）
 *   COMPETITION_MODULES 数学竞赛模块数组（C1-C9，subject=math）
 *   CHINESE_MODULES    语文模块数组（N1-N8，subject=cn）
 *   ENGLISH_MODULES    英语模块数组（E1-E6，subject=en）
 *   MODULE_BY_ID(id)   —— 按 id 查模块，未命中返回 null
 *
 * 浏览器：<script src="shared/module-catalog.js"></script> -> 全局 MODULE_CATALOG / BASIC_MODULES / ...
 * Node：  const MODULE_CATALOG = require("shared/shared/module-catalog.js")
 */
(function(global) {
  /** 科目代码（全站唯一约定，知识点 ID 前缀与此一致） */
  const SUBJECTS = { MATH: 'math', CN: 'cn', EN: 'en' };

  const BASIC_MODULES = [
    { id: 'M0', name: '巧算专项', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic' },
    { id: 'M1', name: '口算练习', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M2', name: '竖式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M3', name: '脱式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M4', name: '填空题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M5', name: '连线题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M6', name: '操作题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'geometry', level: 'basic' },
    { id: 'M7', name: '看图列式', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M8', name: '解决问题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M9', name: '分类与整理', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
    { id: 'M10', name: '推理与数学广角', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
   { id: 'M11', name: '判断题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
   { id: 'M12', name: '选择题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    // M13 提前预习：一年级乘除法启蒙（乘法表/除法表静态展示 + 乘除填空随机练习），
    // 携带自定义显示属性（卡片草绿色 + 胶囊标签），知识点 ID 对应小写 m13
    {
      id: 'M13', name: '提前预习', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic',
      display: {
        color: '#7cb342',
        tags: ['乘法表', '除法表', '乘除法填空']
      }
    }
  ];

  const COMPETITION_MODULES = [
    { id: 'C1', name: '数字谜与数阵图', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🧩',
      desc: '竖式/横式数字谜、幻方与数阵图填数，训练位值分析与枚举推理',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C2', name: '数论初步', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔢',
      desc: '整除特征、奇偶性、质数合数、因数倍数与余数规律',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C3', name: '组合计数', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔀',
      desc: '加乘原理、排列组合初步、枚举与容斥、找规律计数',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C4', name: '几何模型', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'geometry', level: 'competition', icon: '📐',
      desc: '鸟头、蝴蝶、燕尾、一半模型，圆与扇形，勾股定理与格点面积',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C5', name: '行程问题', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🚗',
      desc: '相遇追及、火车过桥、流水行船与环形跑道，画线段图分析',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C6', name: '工程与浓度', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '🏗️',
      desc: '工程问题（工作量/工效/工时）、溶液浓度混合与配比问题',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C7', name: '分数与巧算', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '✨',
      desc: '分数与小数巧算、繁分数化简、换元与裂项等速算技巧',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C8', name: '最值与逻辑推理', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'statistics', level: 'competition', icon: '🧠',
      desc: '最大最小问题、抽屉原理、逻辑推理（列表/假设法）与对策问题',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C9', name: '竞赛综合', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'mixed', level: 'competition', icon: '🏆',
      desc: '跨模块综合卷：按各竞赛模块知识点 weight 加权混编，模拟竞赛组卷',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } }
  ];

  // 语文模块（N 系列）：目录先行，插件与知识点逐轮激活（status: placeholder 为占位）
  const CHINESE_MODULES = [
    { id: 'N1', name: '拼音基础', subject: SUBJECTS.CN, grades: [1,2,3], category: 'language-basic', status: 'active',
      desc: '声母韵母、声调整体认读、拼读与标调规则' },
    { id: 'N2', name: '识字写字', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '生字认读、笔顺结构、形近字与多音字辨析' },
    { id: 'N3', name: '词语积累', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '近反义词、成语积累、词语搭配与归类' },
    { id: 'N4', name: '句型句式', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '把字句被字句、扩句缩句、修改病句与句式变换' },
    { id: 'N5', name: '古诗文默写', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'literature', status: 'placeholder',
      desc: '课内古诗词与文言名句填空、理解性默写' },
    { id: 'N6', name: '阅读理解', subject: SUBJECTS.CN, grades: [3,4,5,6], category: 'reading', status: 'placeholder',
      desc: '记叙文/说明文阅读、词句赏析与信息提取' },
    { id: 'N7', name: '写作基础', subject: SUBJECTS.CN, grades: [3,4,5,6], category: 'writing', status: 'placeholder',
      desc: '看图写话、片段描写与习作构思提纲' },
    { id: 'N8', name: '语文综合', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'comprehensive', status: 'placeholder',
      desc: '跨模块综合卷：按各语文模块知识点 weight 加权混编' }
  ];

  // 英语模块（E 系列）：目录先行，插件与知识点逐轮激活
  const ENGLISH_MODULES = [
    { id: 'E1', name: '字母与发音', subject: SUBJECTS.EN, grades: [3], category: 'language-basic', status: 'active',
      desc: '26 个字母读写、大小写配对与自然拼读启蒙' },
    { id: 'E2', name: '词汇拼写', subject: SUBJECTS.EN, grades: [3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '核心词表拼写、词性分类与高频短语' },
    { id: 'E3', name: '句型语法', subject: SUBJECTS.EN, grades: [4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '基本句型、时态初步与疑问句转换' },
    { id: 'E4', name: '情景对话', subject: SUBJECTS.EN, grades: [4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '问候购物问路等情景问答匹配与补全' },
    { id: 'E5', name: '阅读短文', subject: SUBJECTS.EN, grades: [5,6], category: 'reading', status: 'placeholder',
      desc: '短文阅读理解、判断正误与信息定位' },
    { id: 'E6', name: '英语综合', subject: SUBJECTS.EN, grades: [5,6], category: 'comprehensive', status: 'placeholder',
      desc: '跨模块综合卷：按各英语模块知识点 weight 加权混编' }
  ];

  const MODULE_CATALOG = BASIC_MODULES
    .concat(CHINESE_MODULES)
    .concat(ENGLISH_MODULES)
    .concat(COMPETITION_MODULES);

  const MODULE_BY_ID = {};
  MODULE_CATALOG.forEach(function (m) {
    if (MODULE_BY_ID[m.id]) throw new Error('module-catalog：模块 ID 重复 ' + m.id);
    MODULE_BY_ID[m.id] = m;
  });
  MODULE_CATALOG.byId = function (id) { return MODULE_BY_ID[id] || null; };
  MODULE_CATALOG.SUBJECTS = SUBJECTS;

  global.MODULE_CATALOG = MODULE_CATALOG;
  global.SUBJECTS = SUBJECTS;
  global.BASIC_MODULES = BASIC_MODULES;
  global.COMPETITION_MODULES = COMPETITION_MODULES;
  global.CHINESE_MODULES = CHINESE_MODULES;
  global.ENGLISH_MODULES = ENGLISH_MODULES;
  if (typeof module !== 'undefined') module.exports = MODULE_CATALOG;
})(typeof window !== 'undefined' ? window : global);

};
__defs["dev/dev/plugin-loader.js"] = function (module, exports, require) {
  module.exports = null;
};
__defs["fs"] = function (module, exports, require) {
  module.exports = null;
};
__defs["path"] = function (module, exports, require) {
  module.exports = null;
};
__defs["vm"] = function (module, exports, require) {
  module.exports = null;
};
__defs["module"] = function (module, exports, require) {
  module.exports = null;
};
__defs["dev/plugin-registry.js"] = function (module, exports, require) {
/**
 * dev/plugin-registry.js — 插件注册表读取模块（步骤 2）
 *
 * 职责：
 *   读取 plugins/registry.js 的 PLUGIN_REGISTRY 数组，
 *   提取每个插件的 id 与 file 路径（附带 name/subject/grades 等元数据），
 *   返回标准化的插件条目列表。
 *
 * API：
 *   const { readRegistry, getEntry } = require("dev/dev/plugin-registry.js");
 *   readRegistry();              // → [{ id, file, absolutePath, ... }, ...]
 *   getEntry('math-oral');       // → 条目或 null
 *
 * CLI：
 *   node dev/plugin-registry.js                 # 打印全部条目清单
 *   node dev/plugin-registry.js --subject math  # 按科目过滤
 *   node dev/plugin-registry.js --json          # JSON 输出
 */
'use strict';

var fs = require("fs");
var path = require("path");
var ROOT = path.join(__dirname, '..');

/**
 * 读取注册表并标准化条目。
 * @returns {Array<{
 *   id: string,
 *   file: string,
 *   absolutePath: string,
 *   runtimeId: string,
 *   name: string,
 *   subject: string|null,
 *   category: string|null,
 *   grades: number[],
 *   moduleIds: string[],
 *   deps: string[],
 *   isPlaceholder: boolean
 * }>}
 */
function readRegistry() {
  var registryPath = path.join(ROOT, 'plugins', 'registry.js');
  if (!fs.existsSync(registryPath)) {
    throw new Error('找不到注册表文件：' + registryPath);
  }
  // 清除缓存后重载，保证开发期多次调用拿到最新内容
  delete require.cache[require.resolve(registryPath)];
  var mod = require(registryPath);
  var arr = Array.isArray(mod) ? mod : (global.PLUGIN_REGISTRY || []);
  if (!Array.isArray(arr)) {
    throw new Error('PLUGIN_REGISTRY 不是数组，请检查 plugins/registry.js');
  }

  return arr
    .filter(function (e) { return e && e.id && e.file; })
    .map(function (e) {
      return {
        id: e.id,
        file: e.file,
        absolutePath: path.join(ROOT, e.file),
        runtimeId: e.runtimeId || e.id,
        name: e.name || '',
        subject: e.subject || null,
        category: e.category == null ? null : e.category,
        grades: Array.isArray(e.grades) ? e.grades.slice() : [],
        moduleIds: Array.isArray(e.moduleIds) ? e.moduleIds.slice() : [],
        deps: Array.isArray(e.deps) ? e.deps.slice() : [],
        isPlaceholder: !!e.isPlaceholder
      };
    });
}

/** 按 id 取单个条目；不存在返回 null */
function getEntry(id) {
  var list = readRegistry();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id || list[i].runtimeId === id) return list[i];
  }
  return null;
}

module.exports = { readRegistry: readRegistry, getEntry: getEntry };

// ---- CLI ----
if (require.main === module) {
  var args = process.argv.slice(2);
  var subjectFilter = null;
  var asJson = args.indexOf('--json') !== -1;
  var si = args.indexOf('--subject');
  if (si !== -1 && args[si + 1]) subjectFilter = args[si + 1];

  var list = readRegistry();
  if (subjectFilter) {
    list = list.filter(function (e) { return e.subject === subjectFilter; });
  }

  if (asJson) {
    console.log(JSON.stringify(list, null, 2));
  } else {
    console.log('插件注册表：共 ' + list.length + ' 个条目\n');
    list.forEach(function (e) {
      var flags = [];
      if (e.isPlaceholder) flags.push('占位');
      if (e.deps.length) flags.push('deps:' + e.deps.join('+'));
      console.log(
        '  ' + e.id +
        '  [' + (e.subject || '-') + ']' +
        (flags.length ? '  (' + flags.join(', ') + ')' : '') +
        '\n    └─ ' + e.file
      );
    });
  }
}

};
__defs["shared/generator/generator-contract.js"] = function (module, exports, require) {
/**
 * shared/generator/generator-contract.js — M5-R17 Generator 契约升级
 *
 * 新契约：
 *   generate(plan) → Promise<SemanticQuestion[]> | SemanticQuestion[]
 *
 * 旧插件通过 LegacyAdapter 桥接：
 *   Legacy Plugin (generateQuestions)
 *         ↓ LegacyPluginAdapter
 *         ↓ SemanticQuestion[]
 */
'use strict';

var SQ = require("shared/semantic-question.js");
var LQA = require("shared/question/legacy-question-adapter.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var BatchValidator = require("shared/validator/batch-validator.js");
var RetryLoop = require("shared/generator/retry-loop.js");
var QID = require("shared/question-id.js");

// ====== 新契约接口定义 ======
var GENERATOR_CONTRACT = {
  // 必填字段
  REQUIRED_FIELDS: ['id', 'generate'],

  // 标准 plan 结构
  PLAN_SCHEMA: {
    knowledgePointId: { required: true, type: 'string' },
    questionTypeId: { required: true, type: 'string' },
    difficulty: { required: true, type: 'number', min: 1, max: 10 },
    count: { required: true, type: 'number', min: 1 },
    seed: { required: false, type: 'string' },
    constraints: { required: false, type: 'object' },
    planId: { required: false, type: 'string' }
  },

  // 输出结构
  OUTPUT_SCHEMA: {
    // 必须是 SemanticQuestion[]
    items: {
      id: { type: 'string', required: true },
      version: { type: 'number', required: true },
      knowledgePoint: { type: 'string', required: true },
      difficulty: { type: 'number', required: true },
      question: { type: 'object', required: true },
      answer: { type: 'object', required: true },
      metadata: { type: 'object', required: true }
    }
  }
};

/**
 * 创建新契约 Generator（标准化接口）
 * @param {Object} impl { generate(plan): SemanticQuestion[], capabilities?, knowledgePoints?, version? }
 * @returns {Object} 符合新契约的 Generator 实例
 */
function createGenerator(impl) {
  impl = impl || {};
  if (typeof impl.generate !== 'function') {
    throw new Error('Generator 必须实现 generate(plan) 方法');
  }

  var generatorId = impl.id || 'generator:unknown';
  var generatorVersion = impl.version || '1.0.0';
  var capabilities = impl.capabilities || [];
  var knowledgePoints = impl.knowledgePoints || [];

  var gen = {
    id: generatorId,
    version: generatorVersion,
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,

    /**
     * 核心生成方法（新契约）
     * @param {Object} plan QuestionPlan
     * @returns {Promise<SemanticQuestion[]> | SemanticQuestion[]}
     */
    generate: function (plan) {
      // 1. 验证 plan
      if (!plan || !plan.knowledgePointId || !plan.questionTypeId || plan.difficulty == null) {
        throw new Error('Plan 缺少必填字段: knowledgePointId, questionTypeId, difficulty');
      }

      // 2. 派生 seed
      var baseSeed = plan.seed || require("shared/question-id.js").generateBaseSeed();
      var seeds = require("shared/question-id.js").generateSeedsForPlan({
        seed: baseSeed,
        generatorId: impl.id || 'unknown',
        count: plan.count || 1
      });

      // 3. 逐题生成
      var questions = [];
      for (var i = 0; i < (plan.count || 1); i++) {
        var itemPlan = Object.assign({}, plan, { seed: seeds[i], index: i });
        var sq = impl.generateItem ? impl.generateItem(itemPlan) : impl.generate(itemPlan);
        // 支持单题或批量返回
        var arr = Array.isArray(sq) ? sq : [sq];
        arr.forEach(function (item) {
          questions.push(normalizeOutput(item, itemPlan, i));
        });
      }

      // 限制数量
      if (questions.length > (plan.count || 1)) {
        questions = questions.slice(0, plan.count || 1);
      }

      return questions.length === 1 ? questions[0] : questions;
    },

    // 批量生成（兼容旧计划接口）
    generateBatch: function (plan) {
      var result = this.generate(plan);
      return Array.isArray(result) ? result : [result];
    }
  };

  return gen;
}

/**
 * 标准化输出为 SemanticQuestion
 */
function normalizeOutput(item, plan, index) {
  if (item && item.id && item.metadata && item.metadata.generator) {
    return item; // 已是标准格式
  }
  // 兜底：创建标准结构
  return require("shared/semantic-question.js").createSemanticQuestion(Object.assign({}, item, {
    generator: item.generator || 'generator:' + (item.id || 'unknown'),
    generatorVersion: item.generatorVersion || '1.0.0',
    seed: plan.seed,
    index: index,
    knowledgePoint: plan.knowledgePointId,
    difficulty: plan.difficulty,
    questionType: plan.questionTypeId
  }));
}

/**
 * Legacy Plugin Adapter（旧插件 → 新契约）
 * 将旧插件的 generateQuestions(opts) 包装为新契约 generate(plan)
 */
function createLegacyGenerator(legacyPlugin, meta) {
  meta = meta || {};
  var legacyId = meta.id || legacyPlugin.id || 'legacy:unknown';
  var capabilities = meta.capabilities || [];
  var knowledgePoints = meta.knowledgePoints || [];

  return {
    id: 'legacy:' + legacyId,
    version: meta.version || '1.0.0',
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,

    generate: function (plan) {
      // 将 Plan 转换为 Legacy opts
      var opts = {
        count: plan.count || 10,
        grade: plan.grade,
        difficulty: plan.difficulty,
        knowledgePointId: plan.knowledgePointId,
        questionType: plan.questionTypeId,
        seed: plan.seed,
        // 透传约束
        difficultyParams: plan.constraints
      };

      // 调用旧插件
      var legacyResult = legacyPlugin.generateQuestions ? legacyPlugin.generateQuestions(opts) :
                         legacyPlugin.generate ? legacyPlugin.generate(opts) : { questions: [] };

      var rawQuestions = legacyResult.questions || legacyResult || [];

      // 转换为 SemanticQuestion
      return rawQuestions.map(function (q, i) {
        return require("shared/question/legacy-question-adapter.js").adaptQuestion(q, {
          generatorId: 'legacy:' + legacyId,
          generatorVersion: meta.version || '1.0.0',
          seed: plan.seed,
          planId: plan.planId,
          index: i,
          knowledgePointId: plan.knowledgePointId,
          difficulty: plan.difficulty
        });
      });
    }
  };
}

// ====== 源码禁止项（Generator 实现不得包含渲染/随机/自行决定难度代码） ======
var FORBIDDEN_PATTERNS = [
  { pattern: /\bMath\.random\b/, label: 'Math.random（随机数必须由注入的随机源提供）' },
  { pattern: /\bdocument\.(getElementById|querySelector|querySelectorAll|createElement|write|body|head)\b/, label: 'DOM 读取/操作' },
  { pattern: /\bwindow\.(document|location|alert|confirm|prompt)\b/, label: 'window UI 操作' },
  { pattern: /\.innerHTML\b|\.outerHTML\b|\.insertAdjacentHTML\b/, label: '直接生成 HTML' },
  { pattern: /<svg\b|createElementNS\s*\(\s*['"`]http:\/\/www\.w3\.org\/2000\/svg|\.setAttributeNS\s*\(/, label: '直接生成 SVG' },
  { pattern: /\bsvg\s*[:=]\s*['"`]/, label: 'SVG 字符串字面量（必须剥离至 GraphicRenderer）' },
  { pattern: /\bg\.appendChild\b|\bdocument\.createElementNS\b|\btextContent\s*=\s*['"`]/, label: 'DOM 渲染代码' },
  { pattern: /\bparamsFor\s*\(|\bdiffLevel\s*\(|\bcreateProfile\s*\(|\bconsume\s*\(/, label: '自行决定全局难度（必须消费 plan.difficulty/constraints）' }
];

// Generator 实现专用的难度/年级硬编码禁止（选择器/策略层可合法解释难度）
var GENERATOR_DIFFICULTY_PATTERNS = [
  { pattern: /\bif\s*\([^)]*\bdifficulty\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '难度硬编码条件（if difficulty === …，规则必须迁移至 Strategy）' },
  { pattern: /\bif\s*\([^)]*\bgrade\b[^)]*(===|==|!==|!=|<|>|<=|>=)/, label: '年级硬编码条件（if grade === …，规则必须迁移至 Strategy）' }
];

// SemanticQuestion 禁止字段（渲染/执行契约不得进入语义层）
var FORBIDDEN_KEYS = ['render', 'check', 'html', 'svg', 'generate', 'generator', 'template', 'execute'];

var SUBJECTS = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };

function isEmptyGraphic(g) {
  if (g == null || typeof g !== 'object') return false;
  return (g.type == null) && (g.subtype == null) && (g.svg == null) &&
    (g.params == null || Object.keys(g.params).length === 0);
}

/**
 * 校验 Generator 实例是否符合新契约，并可对 Generator 源码做禁止项扫描。
 * @param {Object} gen
 * @param {string|null} [sourceText] Generator 源码（可选，用于禁止项扫描）
 * @returns {Object} { valid, errors: string[], warnings }
 */
function validateGeneratorContract(g, sourceText) {
  var errors = [];
  var warnings = [];

  if (!g || typeof g !== 'object') {
    return { valid: false, errors: ['GeneratorContract 必须是对象'], warnings: warnings };
  }

  if (!g.id || typeof g.id !== 'string') errors.push('id 必填（字符串）');
  if (!g.subject || SUBJECTS[g.subject] == null) errors.push('subject 非法: ' + g.subject + '（math/cn/en）');
  if (!Array.isArray(g.capabilities) || g.capabilities.length === 0) {
    errors.push('capabilities 必须是非空数组');
  } else {
    var QTR = require("shared/question-type-registry.js");
    (g.capabilities || []).forEach(function (c) {
      if (!QTR.has(c)) errors.push('capability 非法: ' + c + '（不在 QuestionType Registry）');
    });
  }
  if (!Array.isArray(g.knowledgePoints)) errors.push('knowledgePoints 必须是数组');
  if (typeof g.supports !== 'function') errors.push('supports(plan) 必须是函数');
  if (typeof g.generate !== 'function') errors.push('generate(plan, context) 必须是函数');

  if (sourceText != null) {
    FORBIDDEN_PATTERNS.forEach(function (f) {
      if (f.pattern.test(sourceText)) errors.push('源码违规：' + f.label);
    });
  }

  return { valid: errors.length === 0, errors: errors, warnings: warnings };
}

/**
 * 运行新契约 Generator + Validator（内置重试）
 * @param {Object} gen 新契约 Generator
 * @param {Object} plan QuestionPlan
 * @param {Object} context { validatorEnabled, maxRetries, validatorMode }
 * @returns {Promise<{ questions, validationResults, retries, success }>}
 */
function runGeneratorWithValidation(gen, plan, context) {
  context = context || {};
  var validatorEnabled = context.validatorEnabled !== false;
  var maxRetries = context.maxRetries || 3;

  if (!validatorEnabled) {
    return Promise.resolve(gen.generate(plan)).then(function (questions) {
      return { questions: Array.isArray(questions) ? questions : [questions], validationResults: [], retries: 0, success: true };
    });
  }

  return require("shared/generator/retry-loop.js").generateWithRetry(
    function (p) { return gen.generate(p); },
    plan,
    { generatorId: gen.id, generatorVersion: gen.version, maxRetries: maxRetries, validatorEnabled: true }
  );
}

/**
 * 校验 SemanticQuestion（string-error 契约校验，兼容 flat/legacy 输入）。
 * @param {Object} q
 * @returns {Object} { valid, errors: string[] }
 */
function validateSemanticQuestion(q) {
  var errors = [];

  if (!q || typeof q !== 'object') {
    return { valid: false, errors: ['SemanticQuestion 必须是对象'] };
  }

  if (!q.knowledgePointId || typeof q.knowledgePointId !== 'string') errors.push('knowledgePointId 必填');
  var QTR = require("shared/question-type-registry.js");
  var qTypeValid = QTR.has(q.questionType) || SQ.Schema.isValidQuestionType(q.questionType) || q.questionType === 'read-aloud';
  if (!q.questionType || !qTypeValid) errors.push('questionType 非法: ' + q.questionType);
  if (q.difficulty == null || typeof q.difficulty !== 'number') errors.push('difficulty 必填（数字）');
  if (q.difficultyParams == null || typeof q.difficultyParams !== 'object') {
    errors.push('difficultyParams 必填');
  } else {
    ['level', 'scale', 'steps'].forEach(function (k) {
      if (typeof q.difficultyParams[k] !== 'number') errors.push('difficultyParams.' + k + ' 必填（数字）');
    });
  }
  if (q.numberRange == null || typeof q.numberRange.min !== 'number' || typeof q.numberRange.max !== 'number' || q.numberRange.min > q.numberRange.max) {
    errors.push('numberRange 非法: ' + JSON.stringify(q.numberRange));
  }
  // answerMode: 'input'（书面作答，answer 必填）| 'read-aloud'（跟读类，answer 可空）
  var answerMode = q.answerMode || 'input';
  if (answerMode !== 'input' && answerMode !== 'read-aloud') {
    errors.push('answerMode 非法: ' + answerMode);
  }
  if (answerMode === 'input' && q.answer == null) errors.push('answer 必填（input 模式）');
  if (q.prompt == null || typeof q.prompt !== 'string') errors.push('prompt 必填（字符串）');

  // M4-R11：graphic 必须是结构化描述（{ type, subtype, params }），不允许内嵌 SVG 字符串
  if (q.graphic != null && !isEmptyGraphic(q.graphic)) {
    if (typeof q.graphic !== 'object' || q.graphic === null) {
      errors.push('graphic 必须是 { type, subtype, params } 对象');
    } else {
      if (typeof q.graphic.type !== 'string' || q.graphic.type.length === 0) {
        errors.push('graphic.type 必填（字符串）');
      }
      if (q.graphic.subtype != null && typeof q.graphic.subtype !== 'string') {
        errors.push('graphic.subtype 必须是字符串');
      }
      if (q.graphic.params != null && typeof q.graphic.params !== 'object') {
        errors.push('graphic.params 必须是对象');
      }
      if (typeof q.graphic.svg === 'string') {
        errors.push('graphic 禁止内嵌 SVG 字符串（必须剥离至 GraphicRenderer）');
      }
    }
  }

  FORBIDDEN_KEYS.forEach(function (k) {
    if (q[k] !== undefined) errors.push('SemanticQuestion 禁止字段: ' + k + '（渲染/执行契约不得进入语义层）');
  });

  return { valid: errors.length === 0, errors: errors };
}

module.exports = {
  SUBJECTS: SUBJECTS,
  FORBIDDEN_PATTERNS: FORBIDDEN_PATTERNS,
  GENERATOR_DIFFICULTY_PATTERNS: GENERATOR_DIFFICULTY_PATTERNS,
  FORBIDDEN_KEYS: FORBIDDEN_KEYS,
  GENERATOR_CONTRACT: GENERATOR_CONTRACT,
  createGenerator: createGenerator,
  createLegacyGenerator: createLegacyGenerator,
  validateGeneratorContract: validateGeneratorContract,
  runGeneratorWithValidation: runGeneratorWithValidation,
  canonSubject: function (s) { return (s || 'math').toLowerCase(); },
  validateSemanticQuestion: validateSemanticQuestion
};
};
__defs["shared/semantic-question.js"] = function (module, exports, require) {
/**
 * shared/semantic-question.js — SemanticQuestion 标准对象工厂/标准化/校验 (M5-R01)
 *
 * 职责：
 *   - createSemanticQuestion(raw)         从原始数据创建标准 SemanticQuestion
 *   - normalizeSemanticQuestion(raw)      将任意题目对象标准化为 SemanticQuestion
 *   - validateSchema(question)            仅做 Schema 级校验（ERROR/WARNING/INFO）
 *   - isValidSemanticQuestion(question)   便捷判断
 *
 * 设计原则：
 *   - 纯语义层：无 DOM、无 HTML、无 SVG 字符串、无渲染逻辑
 *   - 兼容性：保留 render/check 字段位供适配层填充
 *   - 可追溯：强制 generator / generatorVersion / seed
 *   - 单一事实来源：字段定义、枚举、错误码集中于 shared/schemas/semantic-question.schema.js
 */
'use strict';

var path = require("path");
var Schema = require("shared/schemas/semantic-question.schema.js");
var QTR = require("shared/question-type-registry.js");
var QID = require("shared/question-id.js");

var UUID_COUNTER = 0;

function uuid() {
  UUID_COUNTER++;
  return 'sq_' + Date.now().toString(36) + '_' + UUID_COUNTER.toString(36);
}

function nowISO() {
  return new Date().toISOString();
}

function deepClone(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(deepClone);
  if (typeof obj === 'object') {
    var out = {};
    Object.keys(obj).forEach(function (k) { out[k] = deepClone(obj[k]); });
    return out;
  }
  return obj;
}

function coerceNumber(v) {
  if (v == null) return null;
  var n = Number(v);
  return isNaN(n) ? null : n;
}

function coerceInteger(v) {
  var n = coerceNumber(v);
  return n == null ? null : Math.floor(n);
}

function coerceString(v) {
  if (v == null) return '';
  return String(v);
}

function ensureArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

// Schema 8 类 + QTR 补集（geometry/recognize/oral）+ read-aloud 的并集
var VALID_QUESTION_TYPES = null;
function isValidQuestionType(t) {
  if (!t) return false;
  if (VALID_QUESTION_TYPES == null) {
    var set = Schema.QUESTION_TYPES.slice();
    (QTR.TYPES || []).forEach(function (tt) { if (set.indexOf(tt.id) === -1) set.push(tt.id); });
    if (set.indexOf('read-aloud') === -1) set.push('read-aloud');
    VALID_QUESTION_TYPES = set;
  }
  return VALID_QUESTION_TYPES.indexOf(t) !== -1;
}

/**
 * 创建标准 SemanticQuestion（工厂函数，补全默认值、生成 id/seed）。
 * @param {Object} raw 原始题目数据
 * @returns {Object} 标准 SemanticQuestion
 */
function createSemanticQuestion(raw) {
  raw = raw || {};

  // 自动生成 ID（若未提供）
  var questionId = raw.id || QID.generateQuestionId(raw.seed || QID.generateBaseSeed(), {
    generatorId: raw.generator || raw.metadata && raw.metadata.generator,
    index: raw.index,
    knowledgePointId: raw.knowledgePoint || raw.knowledgePointId,
    difficulty: raw.difficulty,
    questionType: raw.questionType
  });

  // 自动生成 metadata（可追溯三要素）
  var metadata = raw.metadata || {};
  if (!metadata.generator && raw.generator) metadata.generator = raw.generator;
  if (!metadata.generatorVersion && raw.generatorVersion) metadata.generatorVersion = raw.generatorVersion;
  if (!metadata.seed && raw.seed) metadata.seed = raw.seed;
  metadata = QID.createMetadata({
    generatorId: metadata.generator,
    generatorVersion: metadata.generatorVersion,
    seed: metadata.seed,
    planId: metadata.planId,
    timestamp: metadata.timestamp,
    retryCount: metadata.retryCount,
    tags: metadata.tags
  });

  var sq = {
    // ① Identity
    id: questionId,
    version: raw.version || Schema.VERSION,

    // ② Knowledge Binding
    knowledgePoint: coerceString(raw.knowledgePoint || raw.knowledgePointId),
    knowledgePointId: coerceString(raw.knowledgePointId || raw.knowledgePoint),
    skill: coerceString(raw.skill || ''),

    // ③ Difficulty & Cognitive
    // ③ Difficulty & Cognitive
    difficulty: coerceInteger(raw.difficulty),
    difficultyParams: deepClone(raw.difficultyParams) || {},
    numberRange: deepClone(raw.numberRange) || { min: 1, max: 1 },
    spiralLevel: coerceInteger(raw.spiralLevel) || 1,
    context: coerceString(raw.context),
    seed: raw.seed || null,
    cognitiveLevel: coerceString(raw.cognitiveLevel || ''),

    // ④ Content (纯文本)
    content: deepClone(raw.content) || Schema.defaultContent(),

    // ⑤ Question (核心题干)
    question: deepClone(raw.question) || Schema.defaultQuestion(),

    // ⑥ Answer
    answer: deepClone(raw.answer) || Schema.defaultAnswer(),

    // ⑦ Distractors
    distractors: ensureArray(raw.distractors).map(function (d) {
      return deepClone(d) || Schema.defaultDistractor();
    }),

    // ⑧ Graphic (描述性，非渲染)
    graphic: deepClone(raw.graphic) || Schema.defaultGraphic(),

    // ⑨ Metadata (可追溯)
    metadata: metadata
  };

  // 兼容字段（供 LegacyAdapter / 适配层使用，不参与语义校验）
  if (raw.render != null) sq.render = raw.render;
  if (raw.check != null) sq.check = raw.check;
  if (raw.svg != null) sq.svg = raw.svg;
  if (raw.options != null) sq.options = raw.options;

  // 扁平化常用字段（便捷访问，不破坏标准结构）
  sq.prompt = sq.content && sq.content.prompt ? sq.content.prompt : (sq.question && sq.question.prompt ? sq.question.prompt : '');
  sq.questionType = raw.questionType || raw.type || null;
  sq.answerMode = (sq.question && sq.question.answerMode) || raw.answerMode || 'input';

  return sq;
}

/**
 * 标准化任意题目对象为 SemanticQuestion（宽容模式，尽力转换）。
 * 用于 Legacy Plugin 输出 → SemanticQuestion。
 * @param {Object} raw 任意题目对象
 * @returns {Object} 标准 SemanticQuestion
 */
function normalizeSemanticQuestion(raw) {
  if (!raw || typeof raw !== 'object') {
    return createSemanticQuestion({});
  }

  // 已经是标准结构则直接返回（幂等）
  if (raw.id && raw.version && raw.metadata && raw.metadata.generator) {
    return raw;
  }

  // 字段映射表：Legacy 字段名 → 标准字段
  var mapped = {
    id: raw.id || raw.questionId,
    version: raw.version || Schema.VERSION,
    knowledgePoint: raw.knowledgePointId || raw.knowledgePoint || raw.kpId,
    skill: raw.skill || raw.ability || '',
    questionType: raw.questionType || raw.type,
    difficulty: coerceInteger(raw.difficulty || raw.difficultyLevel),
    numberRange: raw.numberRange,
    cognitiveLevel: raw.cognitiveLevel || raw.cognitive || '',
    content: raw.content || { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) },
    question: raw.question || (function () {
      var q = { prompt: coerceString(raw.prompt || raw.stem || raw.q || raw.question) };
      if (raw.answerMode) q.answerMode = raw.answerMode;
      return q;
    })(),
    answerMode: raw.answerMode,
    answer: raw.answer ? (typeof raw.answer === 'object' ? raw.answer : { value: raw.answer }) : { value: raw.answerValue || raw.correctAnswer },
    distractors: ensureArray(raw.distractors || raw.options || raw.choices).map(function (d) {
      if (typeof d === 'object') return d;
      return { value: d };
    }),
    graphic: raw.graphic || raw.svg ? { type: 'custom', params: { rawSvg: raw.svg } } : null,
    metadata: raw.metadata || {
      generator: raw.generator || raw.pluginId || raw.source,
      generatorVersion: raw.generatorVersion || raw.version,
      seed: raw.seed || raw.randomSeed,
      timestamp: raw.timestamp || nowISO()
    }
  };

  // 补全 prompt
  if (!mapped.content.prompt) {
    mapped.content.prompt = coerceString(mapped.question.prompt || mapped.question.stem || mapped.question.q);
  }

  return createSemanticQuestion(mapped);
}

/**
 * Schema 级校验（仅结构/类型/枚举/必填，不做业务逻辑校验）。
 * 返回：{ valid, errors: [{code, field, message, severity}], warnings: [], info: [] }
 * @param {Object} sq SemanticQuestion
 * @returns {Object}
 */
function validateSchema(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq || typeof sq !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: '题目对象为空或非对象', severity: Schema.SEVERITY.ERROR });
    return { valid: false, errors: errors, warnings: warnings, info: info };
  }

  // 禁止在 SemanticQuestion 上携带执行/渲染字段（先于归一化检查，避免被丢弃）
  if (typeof sq.render === 'function' || typeof sq.check === 'function') {
    errors.push({ code: Schema.ERROR_CODES.SCHEMA_INVALID, field: 'root', message: 'SemanticQuestion 禁止携带 render/check 执行字段（禁止字段）', severity: Schema.SEVERITY.ERROR });
  }

  // 宽容归一化：兼容 flat/legacy 输入（如 { prompt, answer: '14' }），
  // 与 createSemanticQuestion / normalizeSemanticQuestion 保持一致
  sq = normalizeSemanticQuestion(sq);

  // --- ① Identity ---
  if (!sq.id) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'id', message: '缺少题目 ID', severity: Schema.SEVERITY.ERROR });
  }
  if (typeof sq.version !== 'number' && typeof sq.version !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'version', message: 'version 应为数字或字符串', severity: Schema.SEVERITY.WARNING });
  }

  // --- ② Knowledge Binding ---
  if (!sq.knowledgePoint) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'knowledgePoint', message: '缺少 knowledgePoint 绑定', severity: Schema.SEVERITY.ERROR });
  }

  // --- ③ Difficulty ---
  if (sq.difficulty != null) {
    var diff = coerceInteger(sq.difficulty);
    if (diff === null || Schema.DIFFICULTY_LEVELS.indexOf(diff) === -1) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'difficulty', message: 'difficulty 超出已知范围 (1-10)', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ③.5 QuestionType ---
  if (!sq.questionType) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'questionType', message: '缺少 questionType', severity: Schema.SEVERITY.ERROR });
  } else if (!isValidQuestionType(sq.questionType)) {
    errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'questionType', message: '未知 questionType: ' + sq.questionType, severity: Schema.SEVERITY.ERROR });
  }

  // --- ③.6 NumberRange ---
  if (sq.numberRange) {
    if (typeof sq.numberRange !== 'object') {
      errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'numberRange', message: 'numberRange 必须为对象 { min, max }', severity: Schema.SEVERITY.ERROR });
    } else if (sq.numberRange.min != null && sq.numberRange.max != null &&
               sq.numberRange.min > sq.numberRange.max) {
      errors.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'numberRange', message: 'numberRange.min 不得大于 max', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ④ Content ---
  if (sq.content && typeof sq.content !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content', message: 'content 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.content && sq.content.prompt != null && typeof sq.content.prompt !== 'string') {
    warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'content.prompt', message: 'prompt 应为字符串', severity: Schema.SEVERITY.WARNING });
  }
  var promptVal = (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || sq.prompt;
  if (!promptVal) {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'prompt', message: '缺少 prompt（题干）', severity: Schema.SEVERITY.ERROR });
  }

  // --- ⑤ Question ---
  if (sq.question && typeof sq.question !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'question', message: 'question 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.question && sq.question.answerMode && !Schema.isValidAnswerMode(sq.question.answerMode)) {
    warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'question.answerMode', message: '未知 answerMode: ' + sq.question.answerMode, severity: Schema.SEVERITY.WARNING });
  }

  // --- ⑥ Answer ---
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  if (!sq.answer || typeof sq.answer !== 'object') {
    // read-aloud 模式允许 answer 为 null
    if (answerMode !== 'read-aloud') {
      errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'answer', message: '缺少 answer 对象', severity: Schema.SEVERITY.ERROR });
    }
  } else {
    // read-aloud 模式允许 answer.value 为 null
    if (answerMode !== 'read-aloud' && sq.answer.value == null && (!sq.answer.acceptable || sq.answer.acceptable.length === 0)) {
      errors.push({ code: Schema.ERROR_CODES.ANSWER_INVALID, field: 'answer.value', message: '答案值缺失且无可接受替代答案', severity: Schema.SEVERITY.ERROR });
    }
    if (sq.answer.precision != null && (typeof sq.answer.precision !== 'number' || sq.answer.precision < 0)) {
      warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'answer.precision', message: 'precision 应为非负数', severity: Schema.SEVERITY.WARNING });
    }
  }

  // --- ⑦ Distractors ---
  if (sq.distractors && !Array.isArray(sq.distractors)) {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors', message: 'distractors 必须为数组', severity: Schema.SEVERITY.ERROR });
  }
  if (Array.isArray(sq.distractors)) {
    sq.distractors.forEach(function (d, i) {
      if (!d || typeof d !== 'object') {
        warnings.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'distractors[' + i + ']', message: '干扰项应为对象', severity: Schema.SEVERITY.WARNING });
        return;
      }
      if (d.errorType && !Schema.isValidDistractorErrorType(d.errorType)) {
        warnings.push({ code: Schema.ERROR_CODES.DISTRACTOR_ERROR_TYPE_INVALID, field: 'distractors[' + i + '].errorType', message: '未知错误类型: ' + d.errorType, severity: Schema.SEVERITY.WARNING });
      }
    });
  }

  // --- ⑧ Graphic ---
  if (sq.graphic && typeof sq.graphic !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.FIELD_TYPE_MISMATCH, field: 'graphic', message: 'graphic 必须为对象', severity: Schema.SEVERITY.ERROR });
  }
  if (sq.graphic) {
    if (sq.graphic.type && !Schema.isValidGraphicType(sq.graphic.type)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.type', message: '未知 graphic type: ' + sq.graphic.type, severity: Schema.SEVERITY.WARNING });
    }
    if (sq.graphic.type && sq.graphic.subtype && !Schema.isValidGraphicSubtype(sq.graphic.type, sq.graphic.subtype)) {
      warnings.push({ code: Schema.ERROR_CODES.ENUM_VALUE_INVALID, field: 'graphic.subtype', message: 'type ' + sq.graphic.type + ' 下未知 subtype: ' + sq.graphic.subtype, severity: Schema.SEVERITY.WARNING });
    }
    // 禁止直接嵌入 SVG/HTML 字符串
    if (sq.graphic.rawSvg || sq.graphic.svg || sq.graphic.html) {
      errors.push({ code: Schema.ERROR_CODES.GRAPHIC_INVALID, field: 'graphic', message: 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', severity: Schema.SEVERITY.ERROR });
    }
  }

  // --- ⑨ Metadata (可追溯) ---
  if (!sq.metadata || typeof sq.metadata !== 'object') {
    errors.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata', message: '缺少 metadata', severity: Schema.SEVERITY.ERROR });
  } else {
    if (!sq.metadata.generator) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generator', message: '缺少 generator 来源标识', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.generatorVersion) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.generatorVersion', message: '缺少 generatorVersion', severity: Schema.SEVERITY.WARNING });
    }
    if (!sq.metadata.seed) {
      warnings.push({ code: Schema.ERROR_CODES.REQUIRED_FIELD_MISSING, field: 'metadata.seed', message: '缺少 seed（不可复现）', severity: Schema.SEVERITY.WARNING });
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info };
}

/**
 * 便捷判断：是否为合法 SemanticQuestion（Schema 通过）。
 * @param {Object} sq
 * @returns {boolean}
 */
function isValidSemanticQuestion(sq) {
  return validateSchema(sq).valid;
}

/**
 * 批量标准化
 * @param {Array<Object>} raws
 * @returns {Array<Object>}
 */
function normalizeQuestions(raws) {
  if (!Array.isArray(raws)) return [];
  return raws.map(normalizeSemanticQuestion);
}

/**
 * 批量校验
 * @param {Array<Object>>} sqs
 * @returns {Array<Object>} 每项 { valid, errors, warnings, info }
 */
function validateQuestions(sqs) {
  if (!Array.isArray(sqs)) return [];
  return sqs.map(validateSchema);
}

module.exports = {
  createSemanticQuestion: createSemanticQuestion,
  normalizeSemanticQuestion: normalizeSemanticQuestion,
  validateSchema: validateSchema,
  isValidSemanticQuestion: isValidSemanticQuestion,
  normalizeQuestions: normalizeQuestions,
  validateQuestions: validateQuestions,
  Schema: Schema
};
};
__defs["shared/generator/core/rng.js"] = function (module, exports, require) {
/**
 * shared/generator/core/rng.js — M4-R06 核心随机源（可复现，禁止 Math.random）
 *
 * mulberry32 种子 PRNG + 整数/选择/洗牌助手。
 * 同一种子（seed）必须产生完全相同的序列 → 支持「相同 Plan/Seed 语义等价」验收。
 */
'use strict';

function hashSeed(str) {
  var h = 5381;
  str = String(str);
  for (var i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function createSeededRandom(seed) {
  var a = (seed == null ? 1 : (typeof seed === 'number' ? (seed >>> 0) : hashSeed(seed))) || 1;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng, min, max) {
  if (max < min) { var t = min; min = max; max = t; }
  return min + Math.floor(rng() * (max - min + 1));
}

function pick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  return arr[randInt(rng, 0, arr.length - 1)];
}

function shuffle(rng, arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = randInt(rng, 0, i);
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

module.exports = {
  hashSeed: hashSeed,
  createSeededRandom: createSeededRandom,
  randInt: randInt,
  pick: pick,
  shuffle: shuffle
};

};
__defs["shared/generator/core/arithmetic-core.js"] = function (module, exports, require) {
/**
 * shared/generator/core/arithmetic-core.js — M4-R06 核心算术抽取件
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成。
 * 纯函数，不读 DOM、不生成 HTML/SVG、不解释全局难度（全部来自约束参数）。
 */
'use strict';

var Rng = require("shared/generator/core/rng.js");

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

function normalizeOperation(op) {
  var m = { add: 'add', addition: 'add', sub: 'sub', subtraction: 'sub',
    mult: 'mult', mul: 'mult', multiplication: 'mult',
    div: 'div', division: 'div', mixed: 'mixed' };
  return m[op] || 'mixed';
}

function defaultOperators(op, allowMultDiv) {
  if (op === 'add') return [OP_ADD];
  if (op === 'sub') return [OP_SUB];
  if (op === 'mult') return [OP_MUL];
  if (op === 'div') return [OP_DIV];
  return allowMultDiv ? [OP_ADD, OP_SUB, OP_MUL, OP_DIV] : [OP_ADD, OP_SUB];
}

/**
 * 操作数生成 + 结构生成（由 QuestionPlan 约束驱动，不解释难度）。
 * @param {function} rng 种子随机源
 * @param {Object} cfg { operation, numberRange:{min,max}, maxSteps, allowBracket, allowMultDiv, noNegative,
 *                       exactSteps, operationSet }
 *
 * M4-R17：支持 KP 级语义约束
 *   - cfg.operationSet —— 数组，限制算符池（如 ['+','−']；默认由 operation/allowMultDiv 推导）
 *   - cfg.exactSteps   —— 精确步数（固定为 1 而非按 maxSteps 随机 1..n）
 */
function generateStructure(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = normalizeOperation(cfg.operation);
  var noNegative = cfg.noNegative !== false;

  var steps = cfg.exactSteps != null && cfg.exactSteps >= 1
    ? cfg.exactSteps
    : (cfg.maxSteps != null && cfg.maxSteps > 1
      ? Rng.randInt(rng, 1, Math.min(cfg.maxSteps, 3))
      : 1);

  var maxForMult = Math.min(max, 20);

  // 算符池：KP 语义 operationSet 优先；否则按 operation/allowMultDiv 推导
  var opPool = Array.isArray(cfg.operationSet) && cfg.operationSet.length
    ? cfg.operationSet.slice()
    : defaultOperators(op, cfg.allowMultDiv);

  // 运算符链：×/÷ 之后不再接 ×/÷（避免连续乘除的整除性耦合）
  var operators = [];
  for (var i = 0; i < steps; i++) {
    var prev = operators[i - 1];
    var pool = (prev === OP_MUL || prev === OP_DIV)
      ? [OP_ADD, OP_SUB]
      : opPool;
    operators.push(Rng.pick(rng, pool));
  }

  // 操作数：先随机，再按运算符约束修正（减法非负 / 除法可整除）
  var operands = [];
  for (i = 0; i <= steps; i++) {
    operands.push(Rng.randInt(rng, min, max));
  }
  for (i = 0; i < steps; i++) {
    // 减法交换仅在“未被前一乘/除步骤固定操作数槽位”时安全：
    // 若前一运算符是 ×/÷，operands[i+1] 已被固定为除数/因子，交换会破坏整除性/因子上限。
    var subSwapSafe = operands[i + 1] > operands[i] &&
      (i === 0 || (operators[i - 1] !== OP_MUL && operators[i - 1] !== OP_DIV));
    if (operators[i] === OP_SUB && noNegative && subSwapSafe) {
      var tmp = operands[i + 1];
      operands[i + 1] = operands[i];
      operands[i] = tmp;
    } else if (operators[i] === OP_DIV) {
      // 被除数 = 商 × 除数（先定除数再定被除数，保证整除且被除数 ≤ max）
      var divisor = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      var maxQuotient = Math.max(1, Math.floor(max / divisor));
      var quotient = Rng.randInt(rng, 1, Math.min(Math.min(maxForMult, 9), maxQuotient));
      operands[i + 1] = divisor;
      operands[i] = divisor * quotient;
    } else if (operators[i] === OP_MUL) {
      operands[i] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      operands[i + 1] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
    }
  }

  // 链式非负校验：保证每一步中间结果 >= 0（小学口算约束）
  // 注意：若后继运算符是 ×/÷，operands[i+1] 是其后被除数/因子，不可下调（否则破坏整除性）。
  if (noNegative) {
    for (i = 0; i < steps; i++) {
      if (operators[i] !== OP_SUB) continue;
      var prefix = calculateAnswer(operands.slice(0, i + 1), operators.slice(0, i));
      var partial = prefix - operands[i + 1];
      var nextLocked = i + 1 < steps && (operators[i + 1] === OP_DIV || operators[i + 1] === OP_MUL);
      if (partial < 0) {
        if (prefix >= min && !nextLocked) {
          operands[i + 1] = Rng.randInt(rng, Math.max(1, min), Math.max(min, prefix));
        } else {
          operators[i] = OP_ADD;
        }
      }
    }
  }

  return { operands: operands, operators: operators, steps: steps };
}

/** 答案计算：先乘除后加减（从左到右） */
function calculateAnswer(operands, operators) {
  var vals = operands.slice();
  var ops = operators.slice();

  for (var i = 0; i < ops.length; i++) {
    if (ops[i] === OP_MUL || ops[i] === OP_DIV) {
      var r = apply(ops[i], vals[i], vals[i + 1]);
      vals.splice(i, 2, r);
      ops.splice(i, 1);
      i--;
    }
  }
  var acc = vals[0];
  for (i = 0; i < ops.length; i++) {
    acc = apply(ops[i], acc, vals[i + 1]);
  }
  return acc;
}

function apply(op, a, b) {
  if (op === OP_ADD) return a + b;
  if (op === OP_SUB) return a - b;
  if (op === OP_MUL) return a * b;
  if (op === OP_DIV) return b === 0 ? a : a / b;
  return a;
}

function formatExpression(operands, operators) {
  var s = String(operands[0]);
  for (var i = 0; i < operators.length; i++) {
    s += ' ' + operators[i] + ' ' + operands[i + 1];
  }
  return s;
}

/** 干扰项生成：答案附近 ±1..±3 的唯一值 */
function generateDistractors(rng, answer, count, range) {
  var dist = [];
  var guard = 0;
  while (dist.length < count && guard < 40) {
    guard++;
    var delta = Rng.randInt(rng, 1, 3) * (Rng.pick(rng, [-1, 1]));
    var v = answer + delta;
    if (range && (v < range.min || v > range.max)) continue;
    if (v === answer || dist.indexOf(v) !== -1) continue;
    dist.push(v);
  }
  return dist;
}

/** 解析题干中的操作数与运算符（支持最多 4 个操作数 / 3 步，供语义等价 Gate 复核答案） */
function parseExpression(text) {
  var m = String(text).match(/(-?\d+(?:\.\d+)?)\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?)(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?/);
  if (!m) return null;
  var operands = [Number(m[1]), Number(m[3])];
  var operators = [m[2] === '-' ? OP_SUB : m[2]];
  if (m[4]) {
    operators.push(m[4] === '-' ? OP_SUB : m[4]);
    operands.push(Number(m[5]));
  }
  if (m[6]) {
    operators.push(m[6] === '-' ? OP_SUB : m[6]);
    operands.push(Number(m[7]));
  }
  return { operands: operands, operators: operators };
}

// ─── M4-R18 括号结构 ────────────────────────────────────────────────────────────

/**
 * 有括号两步运算：(a op1 b) op2 c
 *   op1 ∈ [+,-]（括号内），op2 ∈ [×,÷]（括号外）
 *   保证：op2 为 ÷ 时 (a op1 b) 可整除 op2 操作数；noNegative 时 (a op1 b) >= 0
 * @returns {{ operands: [a,b,c], operators: [op1,op2], answer: number }}
 */
function buildBracket(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var noNegative = cfg.noNegative !== false;
  var OP_INSIDE = [OP_ADD, OP_SUB];
  var OP_OUTSIDE = [OP_MUL, OP_DIV];

  var guard = 0;
  while (guard++ < 200) {
    var op1 = Rng.pick(rng, OP_INSIDE);
    var op2 = Rng.pick(rng, OP_OUTSIDE);
    var a, b, c, inner, answer;

    if (op2 === OP_MUL) {
      // (a +/- b) * c — just ensure noNegative
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, Math.min(max, 9));
      c = Rng.randInt(rng, 2, Math.min(max, 9));
      inner = op1 === OP_ADD ? a + b : a - b;
      if (noNegative && inner < 0) { var t = a; a = b; b = t; inner = a - b; }
      if (noNegative && inner < 0) continue;
      answer = inner * c;
      return { operands: [a, b, c], operators: [op1, op2], answer: answer };
    }

    // op2 === OP_DIV — ensure (a +/- b) % c === 0
    c = Rng.randInt(rng, 2, Math.min(max, 9));
    var maxQuotient = Math.floor(max / c);
    if (maxQuotient < 1) continue;
    var q = Rng.randInt(rng, 1, Math.min(maxQuotient, 9));
    var target = c * q; // (a +/- b) must equal this
    if (op1 === OP_ADD) {
      a = Rng.randInt(rng, Math.max(min, 1), Math.min(max, target - 1));
      b = target - a;
      if (b < min || b > max) continue;
      inner = a + b;
    } else {
      // a - b = target → a = target + b
      b = Rng.randInt(rng, min, Math.min(max, 9));
      a = target + b;
      if (a < min || a > max) continue;
      inner = a - b;
    }
    if (inner !== target) continue;
    answer = q;
    return { operands: [a, b, c], operators: [op1, op2], answer: answer };
  }

  // fallback: (2 + 3) * 4 = 20
  return { operands: [2, 3, 4], operators: [OP_ADD, OP_MUL], answer: 20 };
}

/** 括号格式化：(a op1 b) op2 c */
function formatBracketExpression(operands, operators) {
  return '(' + operands[0] + ' ' + operators[0] + ' ' + operands[1] + ') ' + operators[1] + ' ' + operands[2];
}

// ─── M4-R18 逆向题结构 ──────────────────────────────────────────────────────────

/**
 * 填未知数（带等式右端目标）：a + □ = total  /  □ + b = total  /  a − □ = r  /  □ − b = r
 * mode: 'fill-operand'
 * @returns {{ prompt, known, unknown, operator, position }}  answer = unknown
 */
function buildFillOperand(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB]);

  var a, b, total, r;
  var i = 0;
  while (i++ < 80) {
    if (op === OP_ADD) {
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, max);
      total = a + b;
      if (total > max) continue;
      var position = rng() < 0.5 ? 'first' : 'second';
      if (position === 'first') {
        // □ + b = total → answer = a
        return { prompt: '□ + ' + b + ' = ' + total, known: b, unknown: a, operator: op, position: position };
      }
      // a + □ = total → answer = b
      return { prompt: a + ' + □ = ' + total, known: a, unknown: b, operator: op, position: position };
    }
    // op === OP_SUB
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, Math.min(max - 1, Math.max(min, 1)), a - 1);
    r = a - b;
    var pos = rng() < 0.5 ? 'first' : 'second';
    if (pos === 'first') {
      // □ − b = r → answer = a
      return { prompt: '□ − ' + b + ' = ' + r, known: b, unknown: a, operator: op, position: pos };
    }
    // a − □ = r → answer = b
    return { prompt: a + ' − □ = ' + r, known: a, unknown: b, operator: op, position: pos };
  }
  return { prompt: '5 − □ = 3', known: 5, unknown: 2, operator: OP_SUB, position: 'second' };
}

/**
 * 填运算符：a □ b = answer, answer 是已知值，□ 是运算符
 * @returns {{ prompt, answer (string), operands }}
 */
function buildFillOperator(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));

  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB, OP_MUL, OP_DIV]);
  var a, b, answer;
  if (op === OP_ADD) {
    a = Rng.randInt(rng, min, max);
    b = Rng.randInt(rng, min, max);
    answer = a + b;
    if (answer > max) { var t = a; a = Math.max(min, Math.floor(a * 0.6)); b = Math.max(min, Math.floor(b * 0.6)); answer = a + b; }
  } else if (op === OP_SUB) {
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, min, a - 1);
    answer = a - b;
  } else if (op === OP_MUL) {
    a = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    b = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    answer = a * b;
  } else {
    // div — ensure exact
    b = Rng.randInt(rng, 2, Math.min(max, 9));
    var q = Rng.randInt(rng, 2, Math.min(max, 9));
    a = b * q;
    answer = q;
    if (a > max) { a = b * 2; answer = 2; }
  }
  return { prompt: a + ' □ ' + b + ' =', answer: op, operator: op, operands: [a, b] };
}

// ─── M4-R24 特殊口算结构（镜像 legacy plugins/math-g4-oral.js 的粒度）───────────

/**
 * 大数加减口算（big-addsub，万以内）：整百/整千/千+百/两个三位数，差为正。
 * @returns {{ operands:[a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildBigAddsub(rng) {
  function mul100(lo, hi) { return Rng.randInt(rng, lo, hi) * 100; }
  if (Rng.pick(rng, [1, 2]) === 1) {
    var kind = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
    var a, b;
    if (kind === 'hh') { a = mul100(1, 9); b = mul100(1, 90 - a / 100); }
    else if (kind === 'kk') { a = Rng.randInt(rng, 1, 8) * 1000; b = Rng.randInt(rng, 1, Math.max(1, Math.floor((10000 - a) / 1000))) * 1000; }
    else if (kind === 'hk') { a = Rng.randInt(rng, 1, 8) * 1000; b = mul100(1, 90 - a / 100); }
    else { a = Rng.randInt(rng, 100, 499); b = Rng.randInt(rng, 100, 499); }
    return { operands: [a, b], operators: [OP_ADD], steps: 1, answer: a + b };
  }
  var kind2 = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
  var a2, b2;
  if (kind2 === 'hh') { a2 = mul100(2, 90); b2 = mul100(1, a2 / 100 - 1); }
  else if (kind2 === 'kk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = Rng.randInt(rng, 1, a2 / 1000 - 1) * 1000; }
  else if (kind2 === 'hk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = mul100(1, a2 / 100 - 1); }
  else { a2 = Rng.randInt(rng, 300, 900); b2 = Rng.randInt(rng, 100, a2 - 100); }
  return { operands: [a2, b2], operators: [OP_SUB], steps: 1, answer: a2 - b2 };
}

/**
 * 三位数乘一位数口算（mul3x1）：40% 整十三位数，60% 一般三位数 × 一位数。
 * @returns {{ operands:[a,f], operators:[×], steps:1, answer:number }}
 */
function buildMul3x1(rng) {
  var a = (Rng.pick(rng, [1, 2, 3]) === 1) ? Rng.randInt(rng, 10, 99) * 10 : Rng.randInt(rng, 100, 999);
  var f = Rng.randInt(rng, 2, 9);
  return { operands: [a, f], operators: [OP_MUL], steps: 1, answer: a * f };
}

/**
 * 两位数乘整十数口算（mul2tens）：2 位数 × 整十数（20/30/…/90）。
 * @returns {{ operands:[a,t*10], operators:[×], steps:1, answer:number }}
 */
function buildMul2tens(rng) {
  var a = Rng.randInt(rng, 11, 99);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: a * b };
}

/**
 * 除数是整十数口算（div-tens）：被除数 = (整十除数) × 商，商为一位/两位/整十数。
 * @returns {{ operands:[a,t*10], operators:[÷], steps:1, answer:number }}
 */
function buildDivTens(rng, range) {
  var max = Math.max(20, (range && range.max) || 5000);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  // 被除数 a = b*q 不得超过 range.max（整十除数的语义范围）
  var qMax = Math.max(2, Math.floor(max / b));
  var v = qMax < 11 ? 's' : Rng.pick(rng, ['s', 'd', 'tens']);
  var q;
  if (v === 's') q = Rng.randInt(rng, 2, Math.min(9, qMax));
  else if (v === 'd') q = Rng.randInt(rng, 11, Math.min(49, qMax));
  else q = Rng.randInt(rng, 2, Math.max(2, Math.min(9, Math.floor(qMax / 10)))) * 10;
  var a = b * q;
  return { operands: [a, b], operators: [OP_DIV], steps: 1, answer: q };
}

/**
 * M4-R25 小数点清理：去掉浮点噪声（0.1+0.2 → 0.3），并去除多余尾 0（6.90 → 6.9）。
 */
function trimDec(x) {
  return String(Number(Number(x).toFixed(2)));
}

/**
 * 小数加减法口算（dec-addsub，一位小数）：a=aW.aT ± bW.bT，被减数不小于减数。
 * @returns {{ operands:[a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildDecAddsub(rng) {
  var fmt = function (w, t) { return w + '.' + t; };
  var aW = Rng.randInt(rng, 0, 6), aT = Rng.randInt(rng, 1, 9);
  var bW = Rng.randInt(rng, 0, 6), bT = Rng.randInt(rng, 1, 9);
  var a = aW * 10 + aT, b = bW * 10 + bT;
  if (Rng.pick(rng, [1, 2]) === 1) {
    return { operands: [a / 10, b / 10], operators: [OP_ADD], steps: 1, answer: (a + b) / 10 };
  }
  if (a < b) { var tw = aW; aW = bW; bW = tw; var tt = aT; aT = bT; bT = tt; a = aW * 10 + aT; b = bW * 10 + bT; }
  return { operands: [a / 10, b / 10], operators: [OP_SUB], steps: 1, answer: (a - b) / 10 };
}

/**
 * 运用运算律简便口算（law-oral）：25/125/99/101 × n，镜像 legacy 的凑整结构。
 * @returns {{ operands:[a,n], operators:[×], steps:1, answer:number }}
 */
function buildLawOral(rng) {
  var v = Rng.pick(rng, ['25', '125', '99', '101']);
  var a, n;
  if (v === '25') { a = 25; n = Rng.pick(rng, [4, 8, 12, 16, 24, 28, 32, 36, 40]); }
  else if (v === '125') { a = 125; n = Rng.pick(rng, [8, 16, 24, 32, 40, 48, 56, 64, 72, 80]); }
  else if (v === '99') { a = 99; n = Rng.randInt(rng, 2, 9); }
  else { a = 101; n = Rng.randInt(rng, 2, 9); }
  return { operands: [a, n], operators: [OP_MUL], steps: 1, answer: a * n };
}

/**
 * 小数乘法口算（dec-mul-oral）：一位小数×整数 / 一位小数×一位小数 / 整十、整百×一位小数。
 * @returns {{ operands:[a,b], operators:[×], steps:1, answer:number }}
 */
function buildDecMulOral(rng, range) {
  var max = Math.max(10, (range && range.max) || 1000);
  var v = Rng.pick(rng, ['i', 'ii', 'tens', 'zero']);
  var a, b;
  if (v === 'i') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 2, 99); }
  else if (v === 'ii') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else if (v === 'tens') { a = Rng.randInt(rng, 2, 9) * 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else { a = Rng.randInt(rng, 2, 9) * 100; b = Rng.randInt(rng, 1, 9) / 10; }
  if (a > max) a = Rng.randInt(rng, 2, Math.max(2, Math.floor(max / 100))) * 100;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(trimDec(a * b)) };
}

/**
 * 小数除法口算（dec-div-oral）：被除数 = 除数 × 商（除数一位小数），商为整数或一位小数。
 * @returns {{ operands:[a,divisor], operators:[÷], steps:1, answer:number }}
 */
function buildDecDivOral(rng, range) {
  var min = Math.max(0.1, (range && range.min != null) ? range.min : 0.1);
  var v = Rng.pick(rng, ['int', 'dec']);
  var divisor = Rng.randInt(rng, 2, 9) / 10;
  var q;
  if (v === 'int') q = Rng.randInt(rng, 2, 9);
  else q = Rng.randInt(rng, 1, 9) / 10;
  // 保证被除数 a = divisor × q 不低于 range.min（整十除数语义最低单位）
  var a = divisor * q;
  if (a < min) { q = Math.max(v === 'int' ? 2 : 1, Math.ceil(min / divisor / 0.1) * 0.1); a = divisor * q; }
  return { operands: [Number(trimDec(a)), Number(trimDec(divisor))], operators: [OP_DIV], steps: 1, answer: Number(trimDec(q)) };
}

/**
 * 负数加减口算（neg-add-sub，镜像 legacy math-g6-oral）：−a + b / −a − b。
 *   add：−a + b = b − a（异号相加，结果可正可负）
 *   sub：−a − b = −(a + b)（负号相减）
 * 操作数含负数，需配合 KP numberRange 允许负值（如 {min:-20, max:20}）。
 * @returns {{ operands:[-a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildNegAddsub(rng) {
  if (Rng.pick(rng, ['add', 'sub']) === 'add') {
    var a = Rng.randInt(rng, 2, 9), b = Rng.randInt(rng, 1, 9);
    return { operands: [-a, b], operators: [OP_ADD], steps: 1, answer: b - a };
  }
  var a2 = Rng.randInt(rng, 1, 9), b2 = Rng.randInt(rng, 1, 9);
  return { operands: [-a2, b2], operators: [OP_SUB], steps: 1, answer: -(a2 + b2) };
}

/**
 * 小数乘法笔算（dec-mult，镜像 legacy math-g6-calc）：一位/两位小数因数 × 整数或小数。
 *   dd  —— a.b × c.d（一位小数 × 一位小数）
 *   di  —— a.b × 整数
 *   dd2 —— 0.ab × 0.cd（两位小数 × 两位小数）
 * 答案用 toFixed(6) 清理浮点噪声（legacy trimD 同款），保留小数点位数。
 * @returns {{ operands:[a,b], operators:[×], steps:1, answer:number }}
 */
function buildDecMult(rng) {
  var v = Rng.pick(rng, ['dd', 'di', 'dd2']);
  var a, b;
  if (v === 'dd') {
    a = Rng.randInt(rng, 10, 99) / 10;
    b = Rng.randInt(rng, 10, 99) / 10;
  } else if (v === 'di') {
    a = Rng.randInt(rng, 10, 999) / 10;
    b = Rng.randInt(rng, 2, 99);
  } else {
    a = Rng.randInt(rng, 11, 99) / 100;
    b = Rng.randInt(rng, 11, 99) / 100;
  }
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(String(Number((a * b).toFixed(6)))) };
}

/**
 * 加法运算律简便计算（add-law）：a+b+c，其中 a+c 或 b+c 凑整十/百（镜像 legacy）。
 * @returns {{ operands:[a,b,c], operators:[+,+], steps:2, answer:number }}
 */
function buildAddLaw(rng) {
  var a = Rng.randInt(rng, 11, 99), b = Rng.randInt(rng, 11, 99);
  var t = Rng.pick(rng, [10, 100]);
  var ac = t - (a % t); if (ac <= 0) ac = t;
  var c = ac;
  return { operands: [a, b, c], operators: [OP_ADD, OP_ADD], steps: 2, answer: a + b + c };
}

/**
 * 乘法运算律简便计算（mul-law）：p1×p2×rest，p1×p2 为凑整积（25×4/125×8…），因子打乱（镜像 legacy）。
 * @returns {{ operands:[p1,p2,rest], operators:[×,×], steps:2, answer:number }}
 */
function buildMulLaw(rng) {
  var pairs = [[25, 4], [125, 8], [25, 8], [125, 4], [50, 2], [20, 5]];
  var idx = Rng.randInt(rng, 0, pairs.length - 1);
  var p1 = pairs[idx][0], p2 = pairs[idx][1];
  var rest = Rng.randInt(rng, 3, 9);
  var factors = [p1, p2, rest];
  for (var i = factors.length - 1; i > 0; i--) { var j = Rng.randInt(rng, 0, i); var t = factors[i]; factors[i] = factors[j]; factors[j] = t; }
  return { operands: factors, operators: [OP_MUL, OP_MUL], steps: 2, answer: p1 * p2 * rest };
}

/**
 * M4-R24/M4-R25/M4-R26 特殊口算结构入口：按 kind 分派到专用构造（整数域 + 小数/运算律 + 简易凑整）。
 * 其余 kind 返回 null（由调用方回退通用 generateStructure）。
 * @param {function} rng 种子随机源
 * @param {Object} cfg { kind, numberRange }
 */
function buildSpecialKind(rng, cfg) {
  cfg = cfg || {};
  var kind = cfg.kind;
  if (kind === 'big-addsub') return buildBigAddsub(rng);
  if (kind === 'mul3x1') return buildMul3x1(rng);
  if (kind === 'mul2tens') return buildMul2tens(rng);
  if (kind === 'div-tens') return buildDivTens(rng, cfg.numberRange);
  if (kind === 'dec-addsub') return buildDecAddsub(rng);
  if (kind === 'law-oral') return buildLawOral(rng);
  if (kind === 'dec-mul-oral') return buildDecMulOral(rng, cfg.numberRange);
  if (kind === 'dec-div-oral') return buildDecDivOral(rng, cfg.numberRange);
  if (kind === 'add-law') return buildAddLaw(rng);
  if (kind === 'mul-law') return buildMulLaw(rng);
  if (kind === 'neg-add-sub') return buildNegAddsub(rng);
  if (kind === 'dec-mult') return buildDecMult(rng);
  return null;
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  normalizeOperation: normalizeOperation,
  defaultOperators: defaultOperators,
  generateStructure: generateStructure,
  calculateAnswer: calculateAnswer,
  formatExpression: formatExpression,
  generateDistractors: generateDistractors,
  parseExpression: parseExpression,
  buildBracket: buildBracket,
  formatBracketExpression: formatBracketExpression,
  buildFillOperand: buildFillOperand,
  buildFillOperator: buildFillOperator,
  buildBigAddsub: buildBigAddsub,
  buildMul3x1: buildMul3x1,
  buildMul2tens: buildMul2tens,
  buildDivTens: buildDivTens,
  buildDecAddsub: buildDecAddsub,
  buildLawOral: buildLawOral,
  buildDecMulOral: buildDecMulOral,
  buildDecDivOral: buildDecDivOral,
  buildAddLaw: buildAddLaw,
  buildMulLaw: buildMulLaw,
  buildNegAddsub: buildNegAddsub,
  buildDecMult: buildDecMult,
  trimDec: trimDec,
  buildSpecialKind: buildSpecialKind
};

};
__defs["shared/shared/module-catalog.js"] = function (module, exports, require) {
  module.exports = null;
};
__defs["dev/dev/plugin-registry.js"] = function (module, exports, require) {
  module.exports = null;
};
__defs["shared/question/legacy-question-adapter.js"] = function (module, exports, require) {
/**
 * shared/question/legacy-question-adapter.js — M5-R03 Legacy Question → SemanticQuestion 适配器
 *
 * 职责：将旧插件输出的标准 Question（含 render/check/svg）转换为标准 SemanticQuestion。
 * 处理字段映射：
 *   - q/text → content.prompt / question.prompt
 *   - answer → answer.value / answer.acceptable
 *   - options → distractors (choice 题)
 *   - inputType → answerMode / expectedFormat
 *   - svg → graphic (描述性 params，不保留原始 SVG 字符串)
 *   - type/questionType → questionType / skill
 *   - difficulty/difficultyParams → difficulty / difficultyParams
 *   - knowledgePointId → knowledgePoint
 *   - render/check/svg → 保留兼容字段（不参与语义校验）
 *
 * 设计原则：
 *   - 尽量保留原有信息（答案、选项、提示、渲染/判定函数）
 *   - 语义层不产出 HTML/SVG 字符串
 *   - 兼容字段（render/check/svg）保留供 LegacyRenderer 使用
 */
'use strict';

var SQ = require("shared/semantic-question.js");
var Schema = require("shared/schemas/semantic-question.schema.js");
var QTR = require("shared/question-type-registry.js");
var QID = require("shared/question-id.js");

function coerceString(v) { return v == null ? '' : String(v); }
function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

/** 可复现的确定性索引（FNV-1a 哈希 → 无 Math.random；配合 context.seed 跨运行稳定） */
function seededIndex(seedStr) {
  var h = 2166136261;
  var s = String(seedStr);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/**
 * 将单个 Legacy Question 转换为 SemanticQuestion
 * @param {Object} legacyQ 旧插件产出的标准 Question
 * @param {Object} [context] { generatorId, generatorVersion, seed, planId, index, knowledgePointId, difficulty }
 * @returns {Object} SemanticQuestion
 */
function adaptQuestion(legacyQ, context) {
  context = context || {};
  legacyQ = legacyQ || {};

  // --- 基础字段提取 ---
  var prompt = coerceString(legacyQ.q || legacyQ.text || legacyQ.stem || legacyQ.question || '');
  var answerVal = legacyQ.answer;
  var answerObj = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : { value: answerVal };
  var answerValue = answerObj.value != null ? answerVal : answerVal; // 兼容旧格式

  // answerMode 映射
  var answerModeMap = {
    'text': 'input',
    'input': 'input',
    'choice': 'choice',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = legacyQ.inputType || legacyQ.type || 'text';
  var answerMode = answerModeMap[inputType] || 'input';

  // distractors 从 options 构建（仅 choice 题）
  var distractors = [];
  if (inputType === 'choice' && Array.isArray(legacyQ.options)) {
    var correct = coerceString(answerValue);
    legacyQ.options.forEach(function (opt) {
      var val = coerceString(opt);
      if (val && val !== correct) {
        distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
      }
    });
  }

  // graphic 从 svg / graphic / drawing 转换（描述性 params，不保留原始 SVG 字符串）
  var graphic = null;
  if (legacyQ.svg || legacyQ.graphic || legacyQ.drawing) {
    graphic = {
      type: 'custom',
      subtype: null,
      params: { legacySvg: legacyQ.svg || legacyQ.graphic || legacyQ.drawing },
      renderHints: {}
    };
  }

  // knowledgePoint 从 context 或 legacyQ 取
  var knowledgePoint = context.knowledgePointId || legacyQ.knowledgePointId || legacyQ.kpId || '';

  // type/skill 映射（legacy 领域题型 → 标准 questionType）
  var questionType = legacyQ.questionType || legacyQ.type || legacyQ.kind || 'calc';
  var norm = QTR.normalizeQuestionType(questionType, { allowHeuristic: true });
  if (norm && norm.id) questionType = norm.id;
  var skill = legacyQ.skill || legacyQ.ability || '';

  // difficulty
  var difficulty = context.difficulty != null ? context.difficulty : coerceInteger(legacyQ.difficulty);

  // metadata 组装（可追溯三要素）
  var metadata = {
    generator: context.generatorId || legacyQ.generator || legacyQ.pluginId || 'legacy:unknown',
    generatorVersion: context.generatorVersion || legacyQ.generatorVersion || '1.0.0',
    seed: context.seed || legacyQ.seed || legacyQ.randomSeed,
    planId: context.planId || null,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    validationScore: null,
    tags: ['legacy-adapted']
  };

  // 构造 SemanticQuestion
  var sq = SQ.createSemanticQuestion({
    id: legacyQ.id || legacyQ.questionId,
    knowledgePoint: knowledgePoint,
    skill: skill,
    difficulty: difficulty,
    difficultyParams: legacyQ.difficultyParams || null,
    question: { prompt: prompt },
    content: { prompt: prompt },
    answer: { value: answerValue, acceptable: ensureArray(answerObj.acceptable) },
    distractors: distractors,
    graphic: graphic,
    metadata: metadata,
    // 保留兼容字段（供 LegacyRenderer）
    render: legacyQ.render || null,
    check: legacyQ.check || null,
    svg: legacyQ.svg || null,
    // 扁平字段
    questionType: questionType,
    answerMode: answerMode,
    type: legacyQ.type || null,
    hint: legacyQ.hint || null,
    numberRange: legacyQ.numberRange || null,
    difficultyParams: legacyQ.difficultyParams || null
  });

  return sq;
}

/**
 * 批量转换 Legacy Questions → SemanticQuestions
 * @param {Array<Object>} legacyQuestions
 * @param {Object} [context] 共享上下文
 * @returns {Array<Object>}
 */
function adaptQuestions(legacyQuestions, context) {
  if (!Array.isArray(legacyQuestions)) return [];
  return legacyQuestions.map(function (q, i) {
    var ctx = Object.assign({}, context, { index: i });
    return adaptQuestion(q, ctx);
  });
}

/**
 * 反向适配：SemanticQuestion → Legacy Question（用于 LegacyRenderer 兼容）
 * @param {Object} sq SemanticQuestion
 * @returns {Object} Legacy Question 格式
 */
function toLegacyQuestion(sq) {
  if (!sq) return null;

  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  var inputTypeMap = {
    'input': 'text',
    'choice': 'choice',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = inputTypeMap[answerMode] || 'text';

  // 还原 options（choice 题从 distractors 恢复）
  var options = null;
  if (inputType === 'choice' && Array.isArray(sq.distractors) && sq.distractors.length) {
    options = sq.distractors.map(function (d) { return d.value; });
    // 插入正确答案到随机位置（可复现：由 seed 决定，全仓禁 Math.random）
    var correct = sq.answer && sq.answer.value != null ? coerceString(sq.answer.value) : '';
    if (correct && options.indexOf(correct) === -1) {
      var seedStr = (sq.seed != null ? String(sq.seed)
        : (sq.metadata && sq.metadata.seed != null ? String(sq.metadata.seed)
          : (sq.id || 'q')));
      var pos = seededIndex(seedStr) % (options.length + 1);
      options.splice(pos, 0, correct);
    }
  }

  var legacyQ = {
    id: sq.id,
    q: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    text: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    answer: sq.answer && sq.answer.value != null ? sq.answer.value : (sq.answer ? sq.answer.value : null),
    inputType: inputType,
    options: options,
    type: sq.questionType || sq.type || sq.skill || 'calc',
    questionType: sq.questionType || sq.type || sq.skill || 'calc',
    skill: sq.skill || '',
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    knowledgePointId: sq.knowledgePoint,
    hint: sq.hint,
    numberRange: sq.numberRange,
    // 兼容函数
    render: sq.render || null,
    check: sq.check || null,
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
  };

  return legacyQ;
}

/**
 * 批量反向适配
 * @param {Array<Object>} semanticQuestions
 * @returns {Array<Object>}
 */
function toLegacyQuestions(semanticQuestions) {
  if (!Array.isArray(semanticQuestions)) return [];
  return semanticQuestions.map(toLegacyQuestion);
}

module.exports = {
  adaptQuestion: adaptQuestion,
  adaptQuestions: adaptQuestions,
  toLegacyQuestion: toLegacyQuestion,
  toLegacyQuestions: toLegacyQuestions
};
};
__defs["shared/validator/validation-pipeline.js"] = function (module, exports, require) {
/**
 * shared/validator/validation-pipeline.js — M5-R13 Validation Pipeline
 *
 * 统一验证管道，按顺序执行：
 *   Schema → KnowledgePoint → Answer → Distractor → Structure → Difficulty → Duplicate → Graphic → RenderPreflight
 *
 * 输出：
 *   { valid, errors, warnings, info, score, checks: { schema, knowledgePoint, answer, ... } }
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var Schema = require("shared/schemas/semantic-question.schema.js");
var kpValidator = require("shared/validator/kp-validator.js");
var answerValidator = require("shared/validator/answer-validator.js");
var distractorValidator = require("shared/validator/distractor-validator.js");
var structureValidator = require("shared/validator/structure-validator.js");
var difficultyValidator = require("shared/validator/difficulty-validator.js");
var duplicateValidator = require("shared/validator/duplicate-validator.js");
var graphicValidator = require("shared/validator/graphic-validator.js");
var renderPreflight = require("shared/validator/render-preflight.js");

var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;

// 验证器执行顺序（核心→业务→结构→质量→去重→渲染）
var PIPELINE_STEPS = [
  { name: 'schema', fn: Validator.validateSchemaOnly, required: true },
  { name: 'knowledgePoint', fn: kpValidator.validateKnowledgePoint, required: false },
  { name: 'answer', fn: answerValidator.validateAnswer, required: false },
  { name: 'distractor', fn: distractorValidator.validateDistractors, required: false },
  { name: 'structure', fn: structureValidator.validateStructure, required: false },
  { name: 'difficulty', fn: difficultyValidator.validateDifficulty, required: false },
  { name: 'duplicate', fn: duplicateValidator.validateDuplicate, required: false },
  { name: 'graphic', fn: graphicValidator.validateGraphic, required: false },
  { name: 'renderPreflight', fn: renderPreflight.validateRenderPreflight, required: false }
];

/**
 * 运行完整验证管道
 * @param {Object} sq SemanticQuestion
 * @param {Object} context 验证上下文
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function runPipeline(sq, context) {
  context = context || {};
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  var scores = [];
  var checks = {};
  var seenKeys = context.seenKeys || new Set();

  for (var i = 0; i < PIPELINE_STEPS.length; i++) {
    var step = PIPELINE_STEPS[i];
    var fn = step.fn;
    var stepContext = Object.assign({}, context, { seenKeys: seenKeys });

    var result;
    try {
      result = fn(sq, stepContext);
    } catch (e) {
      var err = require("shared/validator/question-validator.js").createError(
        'VALIDATOR_EXCEPTION', step.name, '验证器异常: ' + e.message, 'ERROR', { stack: e.stack });
      result = { valid: false, errors: [err], warnings: [], info: [], score: 0, checks: {} };
    }

    // 累积结果
    if (result.errors) allErrors.push.apply(allErrors, result.errors);
    if (result.warnings) allWarnings.push.apply(allWarnings, result.warnings);
    if (result.info) allInfo.push.apply(allInfo, result.info);
    if (typeof result.score === 'number') scores.push(result.score);
    if (result.checks) Object.assign(checks, result.checks);

    // 更新 seenKeys（用于 duplicate validator）
    if (result.seenKeys) seenKeys = result.seenKeys;

    // 关键验证器失败且 required=true → 短路（如 Schema）
    if (step.required && (!result.valid || (result.errors && result.errors.length))) {
      break;
    }
  }

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    checks: checks
  };
}

/**
 * 批量运行管道（共享 seenKeys 做去重）
 * @param {Array<Object>} questions
 * @param {Object} context
 * @returns {Array<Object>}
 */
function runPipelineBatch(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var results = [];

  questions.forEach(function (sq, idx) {
    var stepContext = Object.assign({}, context, { index: idx, seenKeys: seenKeys });
    var result = runPipeline(sq, stepContext);
    results.push(result);
    if (result.seenKeys) seenKeys = result.seenKeys;
  });

  return results;
}

module.exports = {
  runPipeline: runPipeline,
  runPipelineBatch: runPipelineBatch,
  PIPELINE_STEPS: PIPELINE_STEPS
};
};
__defs["shared/validator/batch-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/batch-validator.js — M5-R15 Batch Question Validator
 *
 * 整套练习级验证：
 *   - 总数量
 *   - 知识点覆盖
 *   - 题型比例
 *   - 难度分布
 *   - 重复率
 *   - 答案完整率
 *   - 图形完整率
 *   - 题型分布是否符合 QuestionPlan
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceString(v) { return v == null ? '' : String(v); }

function countBy(arr, keyFn) {
  var out = {};
  arr.forEach(function (x) { var k = keyFn(x); out[k] = (out[k] || 0) + 1; });
  return out;
}

function validateBatch(questions, plan) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!Array.isArray(questions) || questions.length === 0) {
    errors.push(createError(ERROR_CODES.SCHEMA_INVALID, 'questions', '题目数组为空', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: {} };
  }

  plan = plan || {};
  var total = questions.length;

  // ① 总数量
  var expectedCount = plan.count || total;
  if (total !== expectedCount) {
    warnings.push(createError('COUNT_MISMATCH', 'count', '实际题目数(' + total + ') 与计划(' + expectedCount + ') 不符', SEVERITY.WARNING, { actual: total, expected: expectedCount }));
  } else {
    info.push({ code: 'COUNT_OK', field: 'count', message: '题目数量达标: ' + total, severity: 'INFO' });
  }

  // ② 知识点覆盖
  var kpCounts = countBy(questions, function (q) { return q.knowledgePoint || 'unknown'; });
  var kpCovered = Object.keys(kpCounts).filter(function (k) { return k !== 'unknown'; }).length;
  var plannedKPs = plan.knowledgePoints || [];
  if (plannedKPs.length) {
    var missingKPs = plannedKPs.filter(function (kp) { return !kpCounts[kp]; });
    if (missingKPs.length) {
      errors.push(createError('KP_COVERAGE_INCOMPLETE', 'knowledgePoints', '缺失知识点覆盖: ' + missingKPs.join(', '), SEVERITY.ERROR, { missing: missingKPs, covered: Object.keys(kpCounts) }));
    }
  }
  info.push({ code: 'KP_COVERAGE', field: 'knowledgePoints', message: '覆盖知识点: ' + kpCovered + ' 个', severity: 'INFO' });

  // ③ 题型比例
  var typeCounts = countBy(questions, function (q) { return q.questionType || q.type || 'unknown'; });
  var plannedTypes = plan.questionTypes || {};
  Object.keys(plannedTypes).forEach(function (type) {
    var expected = plannedTypes[type];
    var actual = typeCounts[type] || 0;
    if (actual < expected) {
      warnings.push(createError('TYPE_RATIO_LOW', 'questionType.' + type, '题型 ' + type + ' 数量(' + actual + ') 少于计划(' + expected + ')', SEVERITY.WARNING, { type: type, actual: actual, expected: expected }));
    }
  });
  info.push({ code: 'TYPE_DIST', field: 'questionTypes', message: '题型分布: ' + JSON.stringify(typeCounts), severity: 'INFO' });

  // ④ 难度分布
  var diffCounts = countBy(questions, function (q) { return q.difficulty || 0; });
  var avgDiff = questions.reduce(function (s, q) { return s + (q.difficulty || 0); }, 0) / total;
  var targetDiff = plan.difficulty;
  if (targetDiff != null && Math.abs(avgDiff - targetDiff) > 1) {
    warnings.push(createError('DIFFICULTY_DIST_OFF', 'difficulty', '平均难度(' + avgDiff.toFixed(1) + ') 偏离目标(' + targetDiff + ')', SEVERITY.WARNING, { avg: avgDiff, target: targetDiff }));
  }
  info.push({ code: 'DIFF_DIST', field: 'difficulty', message: '难度分布: ' + JSON.stringify(diffCounts) + ', 平均: ' + avgDiff.toFixed(1), severity: 'INFO' });

  // ⑤ 重复率
  var keys = questions.map(function (q) { return require("shared/validator/duplicate-validator.js").buildCanonicalKey(q); });
  var uniqueKeys = new Set(keys);
  var dupRate = (keys.length - uniqueKeys.size) / keys.length;
  if (dupRate > 0.1) {
    errors.push(createError('DUPLICATE_RATE_HIGH', 'duplicate', '重复率 ' + (dupRate * 100).toFixed(1) + '% 超过 10%', SEVERITY.ERROR, { rate: dupRate, total: keys.length, unique: uniqueKeys.size }));
  } else if (dupRate > 0) {
    warnings.push(createError('DUPLICATE_RATE_WARN', 'duplicate', '存在重复题目，重复率 ' + (dupRate * 100).toFixed(1) + '%', SEVERITY.WARNING, { rate: dupRate }));
  }
  info.push({ code: 'DUP_RATE', field: 'duplicate', message: '重复率: ' + (dupRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑥ 答案完整率
  var answered = questions.filter(function (q) { return q.answer && q.answer.value != null; }).length;
  var answerRate = answered / total;
  if (answerRate < 1) {
    errors.push(createError('ANSWER_INCOMPLETE', 'answer', '答案完整率 ' + (answerRate * 100).toFixed(1) + '% (< 100%)', SEVERITY.ERROR, { answered: answered, total: total }));
  }
  info.push({ code: 'ANSWER_RATE', field: 'answer', message: '答案完整率: ' + (answerRate * 100).toFixed(1) + '%', severity: 'INFO' });

  // ⑦ 图形完整率（有 graphic 的题目）
  var withGraphic = questions.filter(function (q) { return q.graphic && q.graphic.type; }).length;
  if (plan.graphicRequired && withGraphic < plan.graphicRequired) {
    warnings.push(createError('GRAPHIC_INSUFFICIENT', 'graphic', '含图形题目(' + withGraphic + ') 少于要求(' + plan.graphicRequired + ')', SEVERITY.WARNING));
  }
  info.push({ code: 'GRAPHIC_COUNT', field: 'graphic', message: '含图形题目: ' + withGraphic, severity: 'INFO' });

  // ⑧ 题型分布符合 QuestionPlan 细节
  if (plan.typeRatio) {
    Object.keys(plan.typeRatio).forEach(function (type) {
      var ratio = plan.typeRatio[type];
      var expected = Math.round(total * ratio);
      var actual = typeCounts[type] || 0;
      if (Math.abs(actual - expected) > Math.max(1, total * 0.1)) {
        warnings.push(createError('TYPE_RATIO_DEVIATION', 'questionType.' + type, '题型 ' + type + ' 比例偏离计划', SEVERITY.WARNING, { actual: actual, expected: expected, ratio: ratio }));
      }
    });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { batch: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateBatch: validateBatch
};
};
__defs["shared/generator/retry-loop.js"] = function (module, exports, require) {
/**
 * shared/generator/retry-loop.js — M5-R14 Generation Retry Loop
 *
 * 生成失败自动重试：
 *   - maxRetries = 3
 *   - 可重试错误：ANSWER_MISMATCH, DUPLICATE, DIFFICULTY_MISMATCH, GRAPHIC_INVALID 等
 *   - 不可重试错误：SCHEMA_INVALID, KP_MISSING, KP_MISMATCH, GENERATOR_NOT_FOUND 等
 *   - 超过重试次数返回明确失败信息
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var Pipeline = require("shared/validator/validation-pipeline.js");
var QID = require("shared/question-id.js");

var DEFAULT_MAX_RETRIES = 3;
var RETRYABLE_CODES = [
  Validator.ERROR_CODES.ANSWER_MISMATCH,
  Validator.ERROR_CODES.DUPLICATE_QUESTION,
  Validator.ERROR_CODES.DIFFICULTY_MISMATCH,
  Validator.ERROR_CODES.GRAPHIC_INVALID,
  Validator.ERROR_CODES.DISTRACTOR_DUPLICATE,
  Validator.ERROR_CODES.DISTRACTOR_EQUALS_ANSWER,
  Validator.ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN,
  Validator.ERROR_CODES.STRUCTURE_INVALID,
  Validator.ERROR_CODES.STEPS_EXCEED,
  Validator.ERROR_CODES.OPERATIONS_VIOLATION
];
var FATAL_CODES = [
  Validator.ERROR_CODES.SCHEMA_INVALID,
  Validator.ERROR_CODES.REQUIRED_FIELD_MISSING,
  Validator.ERROR_CODES.KP_MISSING,
  Validator.ERROR_CODES.KP_MISMATCH,
  Validator.ERROR_CODES.GENERATOR_NOT_FOUND
];

function isRetryable(errors) {
  if (!errors || !errors.length) return false;
  return errors.some(function (e) { return RETRYABLE_CODES.indexOf(e.code) !== -1; });
}

function isFatal(errors) {
  if (!errors || !errors.length) return false;
  return errors.some(function (e) { return FATAL_CODES.indexOf(e.code) !== -1; });
}

function hasFatal(errors) {
  return isFatal(errors);
}

function hasRetryable(errors) {
  return isRetryable(errors);
}

/**
 * 带重试的生成执行器
 * @param {Function} generatorFn 签名: (plan, context) → Promise<SemanticQuestion[]> 或 SemanticQuestion[]
 * @param {Object} plan QuestionPlan
 * @param {Object} context { maxRetries, generatorId, generatorVersion, seed, validatorContext }
 * @returns {Promise<{ questions, validationResults, retries, success }>}
 */
function generateWithRetry(generatorFn, plan, context) {
  context = context || {};
  var maxRetries = context.maxRetries != null ? context.maxRetries : DEFAULT_MAX_RETRIES;
  var generatorId = context.generatorId || 'unknown';
  var generatorVersion = context.generatorVersion || '1.0.0';
  var baseSeed = context.seed || QID.generateBaseSeed();
  var validatorContext = context.validatorContext || {};

  var retries = 0;
  var allResults = [];
  var lastQuestions = null;
  var lastValidation = null;

  function attempt(attemptIndex, seed) {
    var attemptContext = Object.assign({}, plan, { seed: seed, _retryAttempt: attemptIndex });
    // 兼容同步/异步 generator：契约允许 generatorFn 直接返回数组（见 JSDoc），统一归一化为 Promise
    return Promise.resolve(generatorFn(attemptContext)).then(function (questions) {
      if (!Array.isArray(questions)) questions = questions.questions || [];
      // 标准化为 SemanticQuestion
      questions = questions.map(function (q, i) {
        return require("shared/semantic-question.js").normalizeSemanticQuestion(Object.assign({}, q, {
          generator: generatorId,
          generatorVersion: generatorVersion,
          seed: seed,
          index: i,
          _retryAttempt: attemptIndex
        }));
      });

      // 运行验证管道
      var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: seed, planId: plan.planId });
      var validationResults = Pipeline.runPipelineBatch(questions, valContext);

      var allValid = validationResults.every(function (r) { return r.valid; });
      var allErrors = validationResults.flatMap(function (r) { return r.errors || []; });

      return { questions: questions, validationResults: validationResults, allValid: allValid, allErrors: allErrors, seed: seed };
    });
  }

  // 首次尝试
  var currentSeed = baseSeed;
  return attempt(0, currentSeed).then(function loop(result) {
    allResults.push({
      attempt: retries,
      seed: result.seed,
      valid: result.allValid,
      errors: result.allErrors,
      questionCount: result.questions.length
    });

    if (result.allValid) {
      // 成功
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: true,
        attempts: allResults
      };
    }

    // 检查是否有致命错误
    if (hasFatal(result.allErrors)) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'FATAL_ERROR',
        message: '遇到不可恢复错误，停止重试',
        attempts: allResults
      };
    }

    // 检查是否有可重试错误
    if (!hasRetryable(result.allErrors)) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'NON_RETRYABLE',
        message: '错误不可重试，停止重试',
        attempts: allResults
      };
    }

    // 重试
    retries++;
    if (retries > maxRetries) {
      return {
        questions: result.questions,
        validationResults: result.validationResults,
        retries: retries,
        success: false,
        error: 'MAX_RETRIES_EXCEEDED',
        message: '超过最大重试次数 (' + maxRetries + ')',
        attempts: allResults
      };
    }

    // 派生新 seed 重试
    currentSeed = QID.deriveSeed(baseSeed, generatorId, retries);
    return attempt(retries, currentSeed).then(loop);
  });
}

/**
 * 同步版本（用于同步生成器）
 */
function generateWithRetrySync(generatorFn, plan, context) {
  context = context || {};
  var maxRetries = context.maxRetries != null ? context.maxRetries : DEFAULT_MAX_RETRIES;
  var generatorId = context.generatorId || 'unknown';
  var generatorVersion = context.generatorVersion || '1.0.0';
  var baseSeed = context.seed || QID.generateBaseSeed();
  var validatorContext = context.validatorContext || {};

  var retries = 0;
  var allResults = [];
  var currentSeed = baseSeed;

  while (true) {
    var attemptContext = Object.assign({}, plan, { seed: currentSeed, _retryAttempt: retries });
    var questions = generatorFn(attemptContext);
    if (!Array.isArray(questions)) questions = questions.questions || [];

    questions = questions.map(function (q, i) {
      return require("shared/semantic-question.js").normalizeSemanticQuestion(Object.assign({}, q, {
        generator: generatorId,
        generatorVersion: generatorVersion,
        seed: currentSeed,
        index: i,
        _retryAttempt: retries
      }));
    });

    var valContext = Object.assign({}, validatorContext, { generatorId: generatorId, seed: currentSeed, planId: plan.planId });
    var validationResults = Pipeline.runPipelineBatch(questions, valContext);

    var allValid = validationResults.every(function (r) { return r.valid; });
    var allErrors = validationResults.flatMap(function (r) { return r.errors || []; });

    allResults.push({
      attempt: retries,
      seed: currentSeed,
      valid: allValid,
      errors: allErrors,
      questionCount: questions.length
    });

    if (allValid) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: true,
        attempts: allResults
      };
    }

    if (hasFatal(allErrors)) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'FATAL_ERROR',
        message: '遇到不可恢复错误，停止重试',
        attempts: allResults
      };
    }

    if (!hasRetryable(allErrors)) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'NON_RETRYABLE',
        message: '错误不可重试，停止重试',
        attempts: allResults
      };
    }

    retries++;
    if (retries > maxRetries) {
      return {
        questions: questions,
        validationResults: validationResults,
        retries: retries,
        success: false,
        error: 'MAX_RETRIES_EXCEEDED',
        message: '超过最大重试次数 (' + maxRetries + ')',
        attempts: allResults
      };
    }

    currentSeed = QID.deriveSeed(baseSeed, generatorId, retries);
  }
}

module.exports = {
  generateWithRetry: generateWithRetry,
  generateWithRetrySync: generateWithRetrySync,
  DEFAULT_MAX_RETRIES: DEFAULT_MAX_RETRIES,
  RETRYABLE_CODES: RETRYABLE_CODES,
  FATAL_CODES: FATAL_CODES,
  isRetryable: isRetryable,
  isFatal: isFatal
};
};
__defs["shared/question-id.js"] = function (module, exports, require) {
/**
 * shared/question-id.js — M5-R02 统一题目 ID / Seed / 版本 生成器
 *
 * 职责：
 *   - generateQuestionId(seed, context)  确定性 ID（同 seed+context 可复现）
 *   - generateSeed(plan, generatorId, index)  统一 seed 派生（Plan → Generator → 题号）
 *   - parseSeed(seedStr)  解析 seed 字符串
 *   - no Math.random() 任何位置
 *   - 基于 mulberry32 PRNG (shared/generator/core/rng.js)
 */
'use strict';

var Rng = require("shared/generator/core/rng.js");

var ID_PREFIX = 'q';
var SEED_DELIMITER = '|';
var SEED_PART_DELIMITER = ':';
var SEED_COUNTER = 0;

/**
 * 生成确定性题目 ID
 * 格式: q_<base36(timestamp)>_<base36(counter)>_<shortHash(seed)>
 * 或: q_<shortHash(seed+context)> (完全确定性)
 *
 * @param {string|number} seed 种子
 * @param {Object} context { generatorId, index, knowledgePointId, difficulty, questionType }
 * @returns {string}
 */
function generateQuestionId(seed, context) {
  var rng = Rng.createSeededRandom(seed);
  var parts = [ID_PREFIX];

  // 基于 seed+context 的短哈希（确定性）
  var ctxStr = '';
  if (context) {
    ctxStr = (context.generatorId || '') + SEED_DELIMITER +
             (context.index != null ? context.index : '') + SEED_DELIMITER +
             (context.knowledgePointId || '') + SEED_DELIMITER +
             (context.difficulty != null ? context.difficulty : '') + SEED_DELIMITER +
             (context.questionType || '');
  }
  var hash = Rng.hashSeed(String(seed) + ctxStr);
  parts.push(hash.toString(36));

  // 可选：时间戳前缀（便于排序/调试，不影响确定性）
  // parts.unshift(Date.now().toString(36));

  return parts.join('_');
}

/**
 * 派生子 seed（Plan → Generator → QuestionIndex）
 * 规则: seed = baseSeed:generatorId:index
 * 保证：相同 Plan + 相同 Generator + 相同 index → 相同 seed → 相同题目
 *
 * @param {string} baseSeed 基础种子（来自 Plan.context.seed 或 auto 生成）
 * @param {string} generatorId 生成器 ID
 * @param {number} index 题目索引 (0-based)
 * @returns {string} 派生 seed
 */
function deriveSeed(baseSeed, generatorId, index) {
  var cleanBase = String(baseSeed || 'auto').replace(/\|/g, '-');
  var cleanGen = String(generatorId).replace(/\|/g, '-');
  return [cleanBase, cleanGen, index].join(SEED_DELIMITER);
}

/**
 * 从 Plan 生成一批 seeds
 * @param {Object} plan { seed, generatorId, count }
 * @returns {string[]}
 */
function generateSeedsForPlan(plan) {
  var base = plan.seed || 'plan-' + Date.now();
  var genId = plan.generatorId || 'unknown';
  var count = plan.count || 1;
  var seeds = [];
  for (var i = 0; i < count; i++) {
    seeds.push(deriveSeed(base, genId, i));
  }
  return seeds;
}

/**
 * 解析 seed 字符串
 * @param {string} seedStr
 * @returns {Object} { base, generatorId, index, raw }
 */
function parseSeed(seedStr) {
  if (!seedStr) return { base: null, generatorId: null, index: null, raw: null };
  var parts = seedStr.split(SEED_DELIMITER);
  if (parts.length >= 3) {
    return {
      base: parts[0],
      generatorId: parts[1],
      index: parseInt(parts[2], 10),
      raw: seedStr
    };
  }
  return { base: seedStr, generatorId: null, index: null, raw: seedStr };
}

/**
 * 生成基础 seed（用于 Plan 初始化）
 * 优先使用传入的 seed，否则基于时间+计数器生成（非确定性场景兜底）
 * @param {string|number} [seed]
 * @returns {string}
 */
function generateBaseSeed(seed) {
  if (seed != null) return String(seed);
  // 兜底：时间+单调计数器（仅用于无种子场景，生产应始终显式传 seed；不使用 Math.random）
  SEED_COUNTER = (SEED_COUNTER || 0) + 1;
  return 'auto-' + Date.now().toString(36) + '-' + SEED_COUNTER.toString(36);
}

/**
 * 版本号生成/标准化
 * @param {string|number} v
 * @returns {string} semantic version "x.y.z"
 */
function normalizeVersion(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return '1.0.0';
}

/**
 * 组装完整 metadata 对象（可追溯三要素）
 * @param {Object} opts { generatorId, generatorVersion, seed, planId, timestamp }
 * @returns {Object}
 */
function createMetadata(opts) {
  opts = opts || {};
  return {
    generator: opts.generatorId || null,
    generatorVersion: normalizeVersion(opts.generatorVersion),
    seed: opts.seed || null,
    planId: opts.planId || null,
    timestamp: opts.timestamp || new Date().toISOString(),
    retryCount: opts.retryCount || 0,
    validationScore: null,
    tags: opts.tags || []
  };
}

module.exports = {
  generateQuestionId: generateQuestionId,
  deriveSeed: deriveSeed,
  generateSeedsForPlan: generateSeedsForPlan,
  parseSeed: parseSeed,
  generateBaseSeed: generateBaseSeed,
  normalizeVersion: normalizeVersion,
  createMetadata: createMetadata,
  Rng: Rng  // 导出底层 PRNG 供高级用法
};
};
__defs["shared/schemas/semantic-question.schema.js"] = function (module, exports, require) {
/**
 * shared/schemas/semantic-question.schema.js — SemanticQuestion Schema (M5-R01)
 *
 * 定义标准 SemanticQuestion 结构、字段级合法性规则、枚举值。
 * 纯数据/纯函数，不依赖 DOM / window / 插件 / 渲染器。
 *
 * 版本：1
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  // ====== 题型枚举（与 KnowledgePoint 兼容）======
  var QUESTION_TYPES = [
    'calc',       // 计算题
    'fill',       // 填空题
    'judge',      // 判断题
    'choice',     // 选择题
    'operate',    // 操作题（作图/摆图等）
    'apply',      // 应用题
    'open',       // 开放题
    'read-aloud'  // 跟读/口语
  ];

  // ====== 难度档位 ======
  var DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // ====== 认知层级 ======
  var COGNITIVE_LEVELS = ['了解', '理解', '掌握', '运用'];

  // ====== 答案模式 ======
  var ANSWER_MODES = ['input', 'choice', 'multi', 'none', 'read-aloud'];

  // ====== 图形类型 ======
  var GRAPHIC_TYPES = [
    'geometry',   // 几何图形
    'chart',      // 统计图表
    'diagram',    // 示意图
    'number-line', // 数轴
    'grid',       // 网格/方格
    'custom'      // 自定义
  ];

  // ====== 图形子类型 ======
  var GRAPHIC_SUBTYPES = {
    geometry: ['triangle', 'rectangle', 'circle', 'polygon', 'angle', 'line', 'point'],
    chart: ['bar', 'line', 'pie', 'scatter'],
    diagram: ['flow', 'tree', 'venn', 'mindmap'],
    'number-line': ['integer', 'fraction', 'decimal'],
    grid: ['dot', 'square', 'isometric'],
    custom: []
  };

  // ====== 干扰项错误类型分类 ======
  var DISTRACTOR_ERROR_TYPES = [
    '口诀混淆',
    '计算错误',
    '进位错误',
    '退位错误',
    '概念混淆',
    '单位混淆',
    '顺序错误',
    '符号错误',
    '估算偏差',
    '逻辑跳跃'
  ];

  // ====== 验证错误码 ======
  var ERROR_CODES = {
    // Schema 类
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    FIELD_TYPE_MISMATCH: 'FIELD_TYPE_MISMATCH',
    ENUM_VALUE_INVALID: 'ENUM_VALUE_INVALID',

    // KnowledgePoint 类
    KP_MISSING: 'KP_MISSING',
    KP_MISMATCH: 'KP_MISMATCH',
    KP_OPERATION_INVALID: 'KP_OPERATION_INVALID',
    KP_FORMAT_INVALID: 'KP_FORMAT_INVALID',
    KP_COGNITIVE_INVALID: 'KP_COGNITIVE_INVALID',
    KP_CONTEXT_INVALID: 'KP_CONTEXT_INVALID',
    KP_GRAPHIC_INVALID: 'KP_GRAPHIC_INVALID',

    // Answer 类
    ANSWER_INVALID: 'ANSWER_INVALID',
    ANSWER_MISMATCH: 'ANSWER_MISMATCH',
    ANSWER_TYPE_MISMATCH: 'ANSWER_TYPE_MISMATCH',
    ANSWER_OUT_OF_DOMAIN: 'ANSWER_OUT_OF_DOMAIN',

    // Distractor 类
    DISTRACTOR_COUNT_INVALID: 'DISTRACTOR_COUNT_INVALID',
    DISTRACTOR_DUPLICATE: 'DISTRACTOR_DUPLICATE',
    DISTRACTOR_EQUALS_ANSWER: 'DISTRACTOR_EQUALS_ANSWER',
    DISTRACTOR_TYPE_MISMATCH: 'DISTRACTOR_TYPE_MISMATCH',
    DISTRACTOR_OUT_OF_DOMAIN: 'DISTRACTOR_OUT_OF_DOMAIN',
    DISTRACTOR_ERROR_TYPE_INVALID: 'DISTRACTOR_ERROR_TYPE_INVALID',

    // Structure 类
    STRUCTURE_INVALID: 'STRUCTURE_INVALID',
    STEPS_EXCEED: 'STEPS_EXCEED',
    BRACKETS_VIOLATION: 'BRACKETS_VIOLATION',
    OPERATIONS_VIOLATION: 'OPERATIONS_VIOLATION',
    OPERAND_COUNT_INVALID: 'OPERAND_COUNT_INVALID',
    OPERAND_RANGE_INVALID: 'OPERAND_RANGE_INVALID',

    // Difficulty 类
    DIFFICULTY_MISMATCH: 'DIFFICULTY_MISMATCH',
    DIFFICULTY_OUT_OF_RANGE: 'DIFFICULTY_OUT_OF_RANGE',

    // Duplicate 类
    DUPLICATE_QUESTION: 'DUPLICATE_QUESTION',

    // Graphic 类
    GRAPHIC_INVALID: 'GRAPHIC_INVALID',
    GRAPHIC_TYPE_UNREGISTERED: 'GRAPHIC_TYPE_UNREGISTERED',
    GRAPHIC_PARAMS_INCOMPLETE: 'GRAPHIC_PARAMS_INCOMPLETE',
    GRAPHIC_RENDERER_MISSING: 'GRAPHIC_RENDERER_MISSING',

    // Render 类
    RENDER_PREFLIGHT_FAILED: 'RENDER_PREFLIGHT_FAILED',
    HTML_GENERATION_FAILED: 'HTML_GENERATION_FAILED',
    SVG_GENERATION_FAILED: 'SVG_GENERATION_FAILED',
    PRINT_GENERATION_FAILED: 'PRINT_GENERATION_FAILED'
  };

  // ====== 严重级别 ======
  var SEVERITY = {
    ERROR: 'ERROR',     // 阻断：题目不可用
    WARNING: 'WARNING', // 警告：题目可用但有隐患
    INFO: 'INFO'        // 信息：仅记录
  };

  // ====== 默认值工厂 ======
  function defaultMetadata() {
    return {
      generator: null,           // generator id (e.g., 'generator:arithmetic-addition' or 'legacy:math-oral')
      generatorVersion: null,    // semantic version string (e.g., '1.0.0')
      seed: null,                // 种子（可复现）
      timestamp: null,           // ISO timestamp
      retryCount: 0,             // 重试次数
      validationScore: null,     // 质量评分
      tags: []                   // 标签
    };
  }

  function defaultGraphic() {
    return {
      type: null,
      subtype: null,
      params: {},
      renderHints: {}
    };
  }

  function defaultContent() {
    return {
      prompt: '',           // 题干文本（纯文本，无 HTML/SVG）
      stem: null,           // 题干结构化表示（可选）
      language: 'zh-CN',    // 语言
      readingLevel: null    // 阅读难度等级
    };
  }

  function defaultQuestion() {
    return {
      prompt: '',           // 题干（核心文本）
      hint: null,           // 提示
      answerMode: 'input',  // 答题模式
      expectedFormat: null  // 期望答案格式（如 'number', 'text', 'choice-index'）
    };
  }

  function defaultAnswer() {
    return {
      value: null,          // 正确答案值
      acceptable: [],       // 可接受的替代答案
      unit: null,           // 单位
      precision: null,      // 精度要求（小数位数等）
      explanation: null     // 解析
    };
  }

  function defaultDistractor() {
    return {
      value: null,
      errorType: null,      // DISTRACTOR_ERROR_TYPES 中的值
      weight: 1             // 权重（用于自适应选择）
    };
  }

  // ====== 公共 API ======
  var API = {
    VERSION: VERSION,
    QUESTION_TYPES: QUESTION_TYPES,
    DIFFICULTY_LEVELS: DIFFICULTY_LEVELS,
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    ANSWER_MODES: ANSWER_MODES,
    GRAPHIC_TYPES: GRAPHIC_TYPES,
    GRAPHIC_SUBTYPES: GRAPHIC_SUBTYPES,
    DISTRACTOR_ERROR_TYPES: DISTRACTOR_ERROR_TYPES,
    ERROR_CODES: ERROR_CODES,
    SEVERITY: SEVERITY,
    defaultMetadata: defaultMetadata,
    defaultGraphic: defaultGraphic,
    defaultContent: defaultContent,
    defaultQuestion: defaultQuestion,
    defaultAnswer: defaultAnswer,
    defaultDistractor: defaultDistractor,

    // 类型检查器
    isValidQuestionType: function (t) { return QUESTION_TYPES.indexOf(t) !== -1; },
    isValidDifficulty: function (d) { return DIFFICULTY_LEVELS.indexOf(d) !== -1; },
    isValidCognitiveLevel: function (c) { return COGNITIVE_LEVELS.indexOf(c) !== -1; },
    isValidAnswerMode: function (m) { return ANSWER_MODES.indexOf(m) !== -1; },
    isValidGraphicType: function (t) { return GRAPHIC_TYPES.indexOf(t) !== -1; },
    isValidGraphicSubtype: function (type, subtype) {
      var list = GRAPHIC_SUBTYPES[type];
      return list && list.indexOf(subtype) !== -1;
    },
    isValidDistractorErrorType: function (e) { return DISTRACTOR_ERROR_TYPES.indexOf(e) !== -1; },
    isValidSeverity: function (s) { return SEVERITY[s] != null; }
  };

  // 模块导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.SemanticQuestionSchema = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
};
__defs["shared/validator/question-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/question-validator.js — M5-R04 Validator 核心接口
 *
 * 统一验证入口：
 *   validate(question, context) → { valid, errors, warnings, score, checks }
 *
 * 设计：
 *   - 不修改原题目（纯函数）
 *   - 错误分级：ERROR / WARNING / INFO
 *   - 统一错误码（见 semantic-question.schema.js ERROR_CODES）
 *   - 支持插件式验证器链（后续 Pipeline 组合）
 */
'use strict';

var Schema = require("shared/schemas/semantic-question.schema.js");
var ERROR_CODES = Schema.ERROR_CODES;
var SEVERITY = Schema.SEVERITY;

function createError(code, field, message, severity, detail) {
  return { code: code, field: field, message: message, severity: severity || SEVERITY.ERROR, detail: detail };
}

/**
 * 核心 Schema 校验（复用 semantic-question.js 的 validateSchema）
 * @param {Object} sq
 * @returns {Object} { valid, errors, warnings, info }
 */
function validateSchemaOnly(sq) {
  return require("shared/semantic-question.js").validateSchema(sq);
}

/**
 * 空验证器（基类/占位）
 * @returns {Object} { valid: true, errors: [], warnings: [], info: [], score: 1, checks: {} }
 */
function noopValidator(sq, context) {
  return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: {} };
}

/**
 * 组合多个验证器结果
 * @param {Array<Object>} results
 * @returns {Object}
 */
function combineResults(results) {
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  var scores = [];
  var checks = {};

  results.forEach(function (r) {
    if (r.errors) allErrors.push.apply(allErrors, r.errors);
    if (r.warnings) allWarnings.push.apply(allWarnings, r.warnings);
    if (r.info) allInfo.push.apply(allInfo, r.info);
    if (typeof r.score === 'number') scores.push(r.score);
    if (r.checks) Object.assign(checks, r.checks);
  });

  var valid = allErrors.length === 0;
  var score = scores.length ? scores.reduce(function (a, b) { return a + b; }, 0) / scores.length : 1;

  return { valid: valid, errors: allErrors, warnings: allWarnings, info: allInfo, score: score, checks: checks };
}

/**
 * 主验证入口（当前仅 Schema 校验，后续 Pipeline 接管完整链路）
 * @param {Object} question SemanticQuestion
 * @param {Object} context 验证上下文
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validate(question, context) {
  context = context || {};

  // 1. Schema 校验
  var schemaResult = validateSchemaOnly(question);
  if (!schemaResult.valid) {
    return combineResults([schemaResult]);
  }

  // 2. 后续各专项验证器将在 Pipeline 中串联
  // 此处预留接口，返回 Schema 校验结果
  return combineResults([schemaResult]);
}

/**
 * 批量验证
 * @param {Array<Object>} questions
 * @param {Object} context
 * @returns {Array<Object>}
 */
function validateBatch(questions, context) {
  if (!Array.isArray(questions)) return [];
  return questions.map(function (q) { return validate(q, context); });
}

/**
 * 判断错误是否可重试（用于 Retry Loop）
 * @param {string} code 错误码
 * @returns {boolean}
 */
function isRetryableError(code) {
  var retryable = [
    ERROR_CODES.ANSWER_MISMATCH,
    ERROR_CODES.DUPLICATE_QUESTION,
    ERROR_CODES.DIFFICULTY_MISMATCH,
    ERROR_CODES.GRAPHIC_INVALID,
    ERROR_CODES.DISTRACTOR_DUPLICATE,
    ERROR_CODES.DISTRACTOR_EQUALS_ANSWER,
    ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN,
    ERROR_CODES.STRUCTURE_INVALID,
    ERROR_CODES.STEPS_EXCEED,
    ERROR_CODES.OPERATIONS_VIOLATION
  ];
  return retryable.indexOf(code) !== -1;
}

/**
 * 判断错误是否致命（不可恢复，立即暴露）
 * @param {string} code 错误码
 * @returns {boolean}
 */
function isFatalError(code) {
  var fatal = [
    ERROR_CODES.SCHEMA_INVALID,
    ERROR_CODES.REQUIRED_FIELD_MISSING,
    ERROR_CODES.KP_MISSING,
    ERROR_CODES.KP_MISMATCH,
    ERROR_CODES.GENERATOR_NOT_FOUND
  ];
  return fatal.indexOf(code) !== -1;
}

module.exports = {
  validate: validate,
  validateBatch: validateBatch,
  validateSchemaOnly: validateSchemaOnly,
  combineResults: combineResults,
  createError: createError,
  isRetryableError: isRetryableError,
  isFatalError: isFatalError,
  ERROR_CODES: ERROR_CODES,
  SEVERITY: SEVERITY
};
};
__defs["shared/validator/kp-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/kp-validator.js — M5-R05 Knowledge Point Validator
 *
 * 检查题目与知识点一致性：
 *   - knowledgePoint.id 是否存在于 KnowledgeBank
 *   - Generator 声明的知识点与题目知识点是否一致
 *   - operation 是否属于知识点允许操作
 *   - format/questionType 是否属于知识点允许题型
 *   - cognitiveLevel 是否在允许范围
 *   - context 是否允许
 *   - graphic.type 是否属于知识点允许呈现方式
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var KnowledgeBank = require("shared/knowledge-bank.js");
var Ontology = require("shared/knowledge-ontology.js");
var GenCap = require("shared/generator-capability-registry.js");

var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

/**
 * 获取知识点的规范信息
 * @param {string} kpId
 * @returns {Object|null} { id, operations, applicableQuestionTypes, contextDefault, cognitiveLevel, graphicTypes, ... }
 */
function getKPInfo(kpId) {
  if (!kpId) return null;
  var normalized = Ontology.normalize ? Ontology.normalize({ id: kpId }) : { id: kpId };
  var ops = (normalized.knowledge && normalized.knowledge.operations) || [];
  var types = (normalized.assessment && normalized.assessment.applicableQuestionTypes) || [];
  var context = (normalized.assessment && normalized.assessment.contextDefault) || 'standard';
  var cognitive = (normalized.difficulty && normalized.difficulty.cognitiveLevel) || '理解';
  return {
    id: kpId,
    operations: ops,
    applicableQuestionTypes: types,
    contextDefault: context,
    cognitiveLevel: cognitive,
    graphicTypes: normalized.generation && normalized.generation.graphicTypes || []
  };
}

/**
 * 验证单题的知识点一致性
 * @param {Object} sq SemanticQuestion
 * @param {Object} context { generatorId, generatorCapabilities }
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validateKnowledgePoint(sq, context) {
  context = context || {};
  var errors = [];
  var warnings = [];
  var info = [];

  var kpId = sq.knowledgePoint;
  if (!kpId) {
    errors.push(createError(ERROR_CODES.KP_MISSING, 'knowledgePoint', '题目缺少 knowledgePoint 绑定', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { knowledgePoint: 'fail' } };
  }

  var kpInfo = getKPInfo(kpId);
  if (!kpInfo) {
    warnings.push(createError(ERROR_CODES.KP_MISMATCH, 'knowledgePoint', '知识点 ' + kpId + ' 未在 KnowledgeBank/本体中找到', SEVERITY.WARNING, { kpId: kpId }));
    // 不直接阻断，允许新 KP 先行接入
  } else {
    info.push({ code: 'KP_FOUND', field: 'knowledgePoint', message: '知识点存在: ' + kpId, severity: SEVERITY.INFO });

    // ① operation 检查（若题目声明了 operation）
    if (sq.question && sq.question.operation) {
      var op = coerceString(sq.question.operation);
      if (kpInfo.operations.length && kpInfo.operations.indexOf(op) === -1) {
        errors.push(createError(ERROR_CODES.KP_OPERATION_INVALID, 'question.operation', '操作 ' + op + ' 不在知识点 ' + kpId + ' 允许操作列表中', SEVERITY.ERROR, { operation: op, allowed: kpInfo.operations }));
      }
    }

    // ② questionType/format 检查
    var qType = sq.questionType || sq.type;
    if (qType && kpInfo.applicableQuestionTypes.length && kpInfo.applicableQuestionTypes.indexOf(qType) === -1) {
      errors.push(createError(ERROR_CODES.KP_FORMAT_INVALID, 'questionType', '题型 ' + qType + ' 不在知识点 ' + kpId + ' 允许题型列表中', SEVERITY.ERROR, { questionType: qType, allowed: kpInfo.applicableQuestionTypes }));
    }

    // ③ cognitiveLevel 检查
    if (sq.cognitiveLevel && kpInfo.cognitiveLevel) {
      // 简单检查：题目认知层级不应超过知识点定义的上限
      var levels = ['了解', '理解', '掌握', '运用'];
      var sqLevel = levels.indexOf(sq.cognitiveLevel);
      var kpLevel = levels.indexOf(kpInfo.cognitiveLevel);
      if (sqLevel !== -1 && kpLevel !== -1 && sqLevel > kpLevel) {
        warnings.push(createError(ERROR_CODES.KP_COGNITIVE_INVALID, 'cognitiveLevel', '题目认知层级(' + sq.cognitiveLevel + ') 超过知识点上限(' + kpInfo.cognitiveLevel + ')', SEVERITY.WARNING));
      }
    }

    // ④ context 检查
    if (sq.content && sq.content.context && kpInfo.contextDefault) {
      if (kpInfo.contextDefault !== 'all' && sq.content.context !== kpInfo.contextDefault) {
        info.push({ code: 'CONTEXT_MISMATCH', field: 'content.context', message: '题目 context(' + sq.content.context + ') 与知识点默认(' + kpInfo.contextDefault + ') 不一致', severity: SEVERITY.INFO });
      }
    }

    // ⑤ graphic.type 检查
    if (sq.graphic && sq.graphic.type && kpInfo.graphicTypes.length) {
      if (kpInfo.graphicTypes.indexOf(sq.graphic.type) === -1) {
        warnings.push(createError(ERROR_CODES.KP_GRAPHIC_INVALID, 'graphic.type', '图形类型 ' + sq.graphic.type + ' 不在知识点 ' + kpId + ' 允许呈现方式中', SEVERITY.WARNING, { graphicType: sq.graphic.type, allowed: kpInfo.graphicTypes }));
      }
    }
  }

  // ⑥ Generator 声明的知识点一致性（若 context 提供了 generatorCapabilities）
  if (context.generatorCapabilities) {
    var genKPs = context.generatorCapabilities.knowledgePoints || [];
    if (genKPs.length && genKPs.indexOf(kpId) === -1) {
      warnings.push(createError(ERROR_CODES.KP_MISMATCH, 'knowledgePoint', 'Generator ' + (context.generatorId || 'unknown') + ' 未声明知识点 ' + kpId, SEVERITY.WARNING, { generatorId: context.generatorId, declaredKPs: genKPs }));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0, checks: { knowledgePoint: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateKnowledgePoint: validateKnowledgePoint,
  getKPInfo: getKPInfo
};
};
__defs["shared/validator/answer-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/answer-validator.js — M5-R06 Answer Validator
 *
 * 验证题目答案正确性：
 *   - 数值计算（四则运算、进位/退位、分数、小数）
 *   - 填空题
 *   - 选择题（答案在选项中）
 *   - 判断题（对/错）
 *   - 简单文本答案
 *
 * 核心逻辑：题干 → 计算/规则 → answer，不能只检查 answer != null
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function coerceNumber(v) { if (v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function safeTrim(v) { return coerceString(v).trim(); }

/**
 * 计算标准算式的正确答案
 * 支持：a + b, a - b, a × b, a ÷ b, 混合运算（含括号）
 * @param {string} prompt
 * @returns {string|null} 正确答案字符串，无法解析返回 null
 */
function computeExpectedAnswer(prompt) {
  var expr = coerceString(prompt).replace(/[？?□_\\s]/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[＝=]/g, '');
  if (!expr) return null;

  try {
    // 简单表达式求值（仅支持 + - * / ( )）
    // 注意：生产环境建议用 math.js 或安全表达式解析器
    var fn = new Function('return ' + expr);
    var result = fn();
    if (typeof result === 'number' && isFinite(result)) {
      // 整数保持整数，小数保留 2 位
      return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(result);
  } catch (e) {
    return null;
  }
}

/**
 * 验证数值答案
 * @param {Object} answerObj { value, acceptable, precision, unit }
 * @param {string} expected 期望正确答案
 * @returns {Object} { match, errors, warnings }
 */
function validateNumericAnswer(answerObj, expected) {
  var errors = [];
  var warnings = [];
  var val = answerObj.value;
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable : [];

  var candidates = [val].concat(acceptable).map(function (v) { return coerceString(v).trim(); }).filter(function (v) { return v !== ''; });
  var expectedStr = coerceString(expected).trim();

  var match = candidates.some(function (c) {
    // 数值比较（允许精度差异）
    var cn = coerceNumber(c);
    var en = coerceNumber(expectedStr);
    if (cn != null && en != null) {
      var precision = answerObj.precision != null ? answerObj.precision : 2;
      return Math.abs(cn - en) < Math.pow(10, -precision);
    }
    return c === expectedStr;
  });

  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案不匹配：期望 ' + expectedStr + '，实际 ' + candidates.join('/'), SEVERITY.ERROR, { expected: expectedStr, actual: candidates }));
  }
  return { match: match, errors: errors, warnings: warnings };
}

/**
 * 验证选择题答案（答案必须在选项中）
 * @param {Object} answerObj
 * @param {Array<string>} options
 * @returns {Object}
 */
function validateChoiceAnswer(answerObj, options) {
  var errors = [];
  var val = coerceString(answerObj.value);
  if (!val) {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '选择题答案为空', SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var optStrs = options.map(function (o) { return coerceString(o).trim(); });
  if (optStrs.indexOf(val) === -1) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案 ' + val + ' 不在选项中', SEVERITY.ERROR, { answer: val, options: optStrs }));
    return { match: false, errors: errors, warnings: [] };
  }
  return { match: true, errors: [], warnings: [] };
}

/**
 * 验证判断题答案（对/错、true/false、是/否、✓/✗）
 * @param {Object} answerObj
 * @param {boolean} expected 期望布尔值
 * @returns {Object}
 */
function validateJudgeAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var trueSet = ['true', '对', '是', 'yes', 'y', 't', '1', 'true', '✓', '正确'];
  var falseSet = ['false', '错', '否', 'no', 'n', 'f', '0', 'false', '✗', '错误'];
  var parsed = trueSet.indexOf(val) !== -1 ? true : (falseSet.indexOf(val) !== -1 ? false : null);
  if (parsed === null) {
    errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value', '判断题答案格式非法: ' + val, SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var match = parsed === expected;
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '判断题答案错误：期望 ' + (expected ? '对' : '错') + '，实际 ' + val, SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

/**
 * 验证填空/文本答案（宽松匹配，去空格、大小写不敏感）
 * @param {Object} answerObj
 * @param {string|string[]} expected
 * @returns {Object}
 */
function validateTextAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable.map(function (a) { return coerceString(a).toLowerCase().trim(); }) : [];
  var candidates = [val].concat(acceptable).filter(function (v) { return v !== ''; });
  var expList = Array.isArray(expected) ? expected : [expected];
  var expNorm = expList.map(function (e) { return coerceString(e).toLowerCase().trim(); });

  var match = candidates.some(function (c) { return expNorm.indexOf(c) !== -1; });
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '文本答案不匹配：期望 ' + expNorm.join('/') + '，实际 ' + candidates.join('/'), SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

/**
 * 主验证入口
 * @param {Object} sq SemanticQuestion
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validateAnswer(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq.answer || typeof sq.answer !== 'object') {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer', '缺少 answer 对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { answer: 'fail' } };
  }

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var qType = sq.questionType || sq.type || 'calc';
  var answerObj = sq.answer;

  // 根据题型分派验证逻辑
  if (qType === 'choice' && sq.distractors) {
    var options = sq.distractors.map(function (d) { return d.value; });
    if (answerObj.value != null) options.push(coerceString(answerObj.value));
    var optUniq = options.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var res = validateChoiceAnswer(answerObj, optUniq);
    errors.push.apply(errors, res.errors);
    warnings.push.apply(warnings, res.warnings);
  } else if (qType === 'judge' || qType === 'true-false') {
    // 判断题需知期望值（此处无法自动推断，仅做格式校验）
    var res2 = validateJudgeAnswer(answerObj, true); // 默认期望 true，实际应从题干推断
    warnings.push({ code: 'JUDGE_ANSWER_UNVERIFIED', field: 'answer', message: '判断题正确性需人工/规则核对', severity: 'INFO' });
  } else if (qType === 'fill' || qType === 'calc') {
    // 计算/填空：尝试从题干自动计算期望答案
    var expected = computeExpectedAnswer(prompt);
    if (expected) {
      var res3 = validateNumericAnswer(answerObj, expected);
      errors.push.apply(errors, res3.errors);
      warnings.push.apply(warnings, res3.warnings);
    } else {
      // 无法自动计算，仅做非空校验
      if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
        errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '答案为空且无法自动校验', SEVERITY.ERROR));
      } else {
        info.push({ code: 'ANSWER_UNVERIFIED', field: 'answer', message: '题目类型 ' + qType + ' 无法自动验证，需人工核对', severity: 'INFO' });
      }
    }
  } else {
    // 其他类型（apply, open, operate 等）仅做非空
    if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
      warnings.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { answer: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateAnswer: validateAnswer,
  computeExpectedAnswer: computeExpectedAnswer,
  validateNumericAnswer: validateNumericAnswer,
  validateChoiceAnswer: validateChoiceAnswer,
  validateJudgeAnswer: validateJudgeAnswer,
  validateTextAnswer: validateTextAnswer
};
};
__defs["shared/validator/distractor-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/distractor-validator.js — M5-R07 Distractor Validator
 *
 * 验证选择题干扰项：
 *   - 干扰项数量
 *   - 干扰项唯一性
 *   - 干扰项不能等于正确答案
 *   - 干扰项类型一致
 *   - 干扰项必须属于允许答案域
 *   - errorType 分类合法
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var Schema = require("shared/schemas/semantic-question.schema.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }

function validateDistractors(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var distractors = sq.distractors;
  if (!distractors || !Array.isArray(distractors)) {
    // 非选择题可无 distractors
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { distractor: 'skip' } };
  }

  var answerVal = sq.answer && sq.answer.value != null ? coerceString(sq.answer.value) : '';
  var qType = sq.questionType || sq.type;

  // ① 数量检查（选择题通常 3-4 个干扰项）
  if (distractors.length === 0) {
    warnings.push(createError(ERROR_CODES.DISTRACTOR_COUNT_INVALID, 'distractors.length', '选择题缺少干扰项', SEVERITY.WARNING));
  } else if (distractors.length > 6) {
    warnings.push(createError(ERROR_CODES.DISTRACTOR_COUNT_INVALID, 'distractors.length', '干扰项过多(' + distractors.length + ')，建议 3-4 个', SEVERITY.WARNING));
  }

  // ② 唯一性 & ③ 不等于正确答案 & ④ 类型一致 & ⑤ errorType 合法
  var seen = {};
  distractors.forEach(function (d, i) {
    if (!d || typeof d !== 'object') {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_TYPE_MISMATCH, 'distractors[' + i + ']', '干扰项应为对象', SEVERITY.WARNING));
      return;
    }
    var val = coerceString(d.value);
    if (!val) {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_TYPE_MISMATCH, 'distractors[' + i + '].value', '干扰项值为空', SEVERITY.WARNING));
      return;
    }
    // 唯一性
    if (seen[val]) {
      errors.push(createError(ERROR_CODES.DISTRACTOR_DUPLICATE, 'distractors[' + i + ']', '重复干扰项: ' + val, SEVERITY.ERROR));
    } else {
      seen[val] = true;
    }
    // 不等于正确答案
    if (answerVal && val === answerVal) {
      errors.push(createError(ERROR_CODES.DISTRACTOR_EQUALS_ANSWER, 'distractors[' + i + ']', '干扰项等于正确答案: ' + val, SEVERITY.ERROR));
    }
    // errorType 合法性
    if (d.errorType && !Schema.isValidDistractorErrorType(d.errorType)) {
      warnings.push(createError(ERROR_CODES.DISTRACTOR_ERROR_TYPE_INVALID, 'distractors[' + i + '].errorType', '未知错误类型: ' + d.errorType, SEVERITY.WARNING));
    }
  });

  // ⑤ 域检查（可选：若答案是数值，干扰项也应为数值）
  if (answerVal && !isNaN(Number(answerVal))) {
    distractors.forEach(function (d, i) {
      if (d.value != null && isNaN(Number(d.value))) {
        warnings.push(createError(ERROR_CODES.DISTRACTOR_OUT_OF_DOMAIN, 'distractors[' + i + ']', '数值题干扰项应为数值: ' + d.value, SEVERITY.WARNING));
      }
    });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: [], score: valid ? 1 : 0.5, checks: { distractor: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateDistractors: validateDistractors
};
};
__defs["shared/validator/structure-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/structure-validator.js — M5-R08 Structure Validator
 *
 * 验证题目结构约束（对应 Plan/Strategy 输出的约束）：
 *   - steps
 *   - brackets
 *   - operations
 *   - maxSteps
 *   - 运算符组合
 *   - 操作数数量
 *   - 操作数范围
 *   - 结构层级
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceString(v) { return v == null ? '' : String(v); }

function countOperators(expr) {
  var ops = coerceString(expr).match(/[+\-*/]/g);
  return ops ? ops.length : 0;
}

function countBrackets(expr) {
  var s = coerceString(expr);
  var open = (s.match(/\(/g) || []).length;
  var close = (s.match(/\)/g) || []).length;
  return { open: open, close: close, balanced: open === close };
}

function extractOperands(expr) {
  // 简单提取数字作为操作数
  var nums = coerceString(expr).match(/\d+/g);
  return nums ? nums.map(Number) : [];
}

function validateStructure(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var constraints = sq.difficultyParams || sq.constraints || {};

  // ① maxSteps
  var maxSteps = coerceInteger(constraints.maxSteps);
  if (maxSteps != null && maxSteps > 0) {
    var actualSteps = countOperators(prompt) + 1; // 简单估算：运算符数+1
    if (actualSteps > maxSteps) {
      errors.push(createError(ERROR_CODES.STEPS_EXCEED, 'structure.steps', '实际步数(' + actualSteps + ') 超过最大步数(' + maxSteps + ')', SEVERITY.ERROR, { actual: actualSteps, max: maxSteps }));
    }
  }

  // ② brackets
  var allowBracket = constraints.allowBracket;
  var brackets = countBrackets(prompt);
  if (allowBracket === false && (brackets.open > 0 || brackets.close > 0)) {
    errors.push(createError(ERROR_CODES.BRACKETS_VIOLATION, 'structure.brackets', '禁止括号但题目包含括号', SEVERITY.ERROR, brackets));
  }
  if (!brackets.balanced) {
    errors.push(createError(ERROR_CODES.BRACKETS_VIOLATION, 'structure.brackets', '括号不匹配', SEVERITY.ERROR, brackets));
  }

  // ③ operations
  var allowMultDiv = constraints.allowMultDiv;
  var opsInPrompt = coerceString(prompt).match(/[+\-×÷*/]/g) || [];
  var hasMultDiv = opsInPrompt.some(function (op) { return ['*', '/', '×', '÷'].indexOf(op) !== -1; });
  if (allowMultDiv === false && hasMultDiv) {
    errors.push(createError(ERROR_CODES.OPERATIONS_VIOLATION, 'structure.operations', '禁止乘除但题目包含乘除', SEVERITY.ERROR, { ops: opsInPrompt }));
  }

  // ④ operand count
  var operands = extractOperands(prompt);
  var maxOperands = coerceInteger(constraints.maxOperands);
  if (maxOperands && operands.length > maxOperands) {
    errors.push(createError(ERROR_CODES.OPERAND_COUNT_INVALID, 'structure.operands', '操作数数量(' + operands.length + ') 超过上限(' + maxOperands + ')', SEVERITY.ERROR, { operands: operands }));
  }

  // ⑤ operand range
  var numberRange = constraints.numberRange || (sq.numberRange && { min: sq.numberRange.min, max: sq.numberRange.max });
  if (numberRange && typeof numberRange.min === 'number' && typeof numberRange.max === 'number') {
    operands.forEach(function (op, i) {
      if (op < numberRange.min || op > numberRange.max) {
        errors.push(createError(ERROR_CODES.OPERAND_RANGE_INVALID, 'structure.operands[' + i + ']', '操作数 ' + op + ' 超出范围 [' + numberRange.min + ', ' + numberRange.max + ']', SEVERITY.ERROR, { operand: op, range: numberRange }));
      }
    });
  }

  // ⑥ structure level (nesting depth)
  var maxDepth = coerceInteger(constraints.maxDepth);
  if (maxDepth != null) {
    var depth = 0, maxD = 0;
    for (var i = 0; i < prompt.length; i++) {
      if (prompt[i] === '(') { depth++; if (depth > maxD) maxD = depth; }
      else if (prompt[i] === ')') depth--;
    }
    if (maxD > maxDepth) {
      errors.push(createError(ERROR_CODES.STRUCTURE_INVALID, 'structure.depth', '嵌套深度(' + maxD + ') 超过上限(' + maxDepth + ')', SEVERITY.ERROR, { depth: maxD }));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: [], info: [], score: valid ? 1 : 0, checks: { structure: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateStructure: validateStructure
};
};
__defs["shared/validator/difficulty-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/difficulty-validator.js — M5-R09 Difficulty Validator
 *
 * 验证实际题目难度是否符合 Strategy 输出：
 *   - targetDifficulty
 *   - numberRange
 *   - maxSteps
 *   - spiralLevel
 *   - cognitiveLevel
 * 建立允许误差带：target=5 → acceptable 4~6
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function coerceNumber(v) { var n = Number(v); return isNaN(n) ? null : n; }

function computeActualDifficulty(sq) {
  // 简易难度估算：基于操作数大小、运算符复杂度、步数
  var prompt = sq.prompt || '';
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).length;
  var nums = (prompt.match(/\d+/g) || []).map(Number);
  var maxNum = nums.length ? Math.max.apply(null, nums) : 0;
  var steps = (prompt.match(/[+\-×÷*/]/g) || []).length + 1;

  var diff = 1;
  diff += Math.min(3, Math.floor(maxNum / 20));     // 最大数贡献
  diff += Math.min(2, Math.floor(ops / 2));         // 运算符复杂度
  diff += Math.min(2, Math.max(0, steps - 2));      // 步数
  return Math.min(10, Math.max(1, diff));
}

function validateDifficulty(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var target = coerceInteger(sq.difficulty);
  var params = sq.difficultyParams || sq.constraints || {};

  if (target == null) {
    warnings.push({ code: 'DIFFICULTY_MISSING', field: 'difficulty', message: '题目缺少 difficulty 字段', severity: 'WARNING' });
    return { valid: true, errors: [], warnings: warnings, info: [], score: 0.8, checks: { difficulty: 'warn' } };
  }

  // ① targetDifficulty 在合法范围
  if (target < 1 || target > 10) {
    errors.push(createError(ERROR_CODES.DIFFICULTY_OUT_OF_RANGE, 'difficulty', 'difficulty 超出范围(1-10): ' + target, SEVERITY.ERROR));
  }

  // ② 实际难度估算与目标对比
  // 说明：computeActualDifficulty 是基于 prompt 的粗粒度启发式估算，并非权威难度。
  // 权威难度由 Generator/Strategy 产出（Generator 已按 plan.difficulty 消费约束）。
  // 因此启发式估算与目标不一致时按 WARNING + 质量分惩罚处理，仅作软性交叉校验，
  // 不硬性判为 ERROR（避免对合法生成结果产生误报并拖垮全量扫描通过率）。
  var actual = computeActualDifficulty(sq);
  var tolerance = params.difficultyTolerance != null ? params.difficultyTolerance : 1; // 默认 ±1
  var minAccept = target - tolerance;
  var maxAccept = target + tolerance;

  if (actual < minAccept || actual > maxAccept) {
    warnings.push(createError(ERROR_CODES.DIFFICULTY_MISMATCH, 'difficulty', '启发式实际难度(' + actual + ') 超出目标范围 [' + minAccept + ', ' + maxAccept + '] (目标 ' + target + ')', SEVERITY.WARNING, { target: target, actual: actual, tolerance: tolerance }));
  } else {
    info.push({ code: 'DIFFICULTY_OK', field: 'difficulty', message: '难度匹配: 目标 ' + target + ', 实际 ' + actual, severity: 'INFO' });
  }

  // ③ numberRange 一致性
  if (params.numberRange) {
    var range = params.numberRange;
    if (typeof range.min === 'number' && typeof range.max === 'number') {
      // 可结合 structure-validator 的 operand range 检查，此处仅记录
      info.push({ code: 'NUMBER_RANGE', field: 'difficultyParams.numberRange', message: '数值范围 [' + range.min + ', ' + range.max + ']', severity: 'INFO' });
    }
  }

  // ④ spiralLevel / cognitiveLevel 一致性
  var spiralLevel = coerceInteger(params.spiralLevel);
  if (spiralLevel != null && target != null) {
    var expectedSpiral = Math.ceil(target / 2);
    if (Math.abs(spiralLevel - expectedSpiral) > 1) {
      warnings.push({ code: 'SPIRAL_MISMATCH', field: 'difficultyParams.spiralLevel', message: 'spiralLevel(' + spiralLevel + ') 与 difficulty(' + target + ') 不匹配', severity: 'WARNING' });
    }
  }

  var hasWarning = warnings.length > 0;
  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? (hasWarning ? 0.8 : 1) : 0.5, checks: { difficulty: valid ? (hasWarning ? 'warn' : 'pass') : 'fail' } };
}

module.exports = {
  validateDifficulty: validateDifficulty,
  computeActualDifficulty: computeActualDifficulty
};
};
__defs["shared/validator/duplicate-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/duplicate-validator.js — M5-R10 Duplicate Validator
 *
 * 题目去重：
 *   - Canonical Key: knowledgePoint + operation + operands + structure + format + context
 *   - 同批次去重
 *   - 同一练习去重
 *   - 可选历史题目去重（需外部存储）
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function sortObj(o) { return JSON.stringify(o, Object.keys(o).sort()); }

function buildCanonicalKey(sq) {
  var parts = [];
  parts.push(coerceString(sq.knowledgePoint));
  parts.push(coerceString(sq.questionType || sq.type));
  parts.push(coerceString(sq.question && sq.question.operation));

  // 操作数（排序后）
  var prompt = sq.prompt || (sq.content && sq.content.prompt) || '';
  var nums = (prompt.match(/\d+/g) || []).map(Number).sort(function (a, b) { return a - b; });
  parts.push(nums.join(','));

  // 结构特征
  var ops = (prompt.match(/[+\-×÷*/]/g) || []).sort().join('');
  parts.push(ops);

  // format/context
  parts.push(coerceString(sq.content && sq.content.context));
  parts.push(coerceString(sq.content && sq.content.format));

  return parts.join('|');
}

function validateDuplicate(sq, context) {
  var errors = [];
  var warnings = [];
  var info = [];

  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var key = buildCanonicalKey(sq);

  if (seenKeys.has(key)) {
    errors.push(createError(ERROR_CODES.DUPLICATE_QUESTION, 'canonicalKey', '重复题目: ' + key, SEVERITY.ERROR, { canonicalKey: key }));
  } else {
    seenKeys.add(key);
    info.push({ code: 'UNIQUE', field: 'canonicalKey', message: '题目唯一: ' + key, severity: 'INFO' });
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    info: info,
    score: errors.length === 0 ? 1 : 0,
    checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' },
    seenKeys: seenKeys // 返回更新后的集合供后续题目使用
  };
}

function validateBatchDuplicate(questions, context) {
  context = context || {};
  var seenKeys = context.seenKeys || new Set();
  var results = questions.map(function (sq) {
    var key = buildCanonicalKey(sq);
    var errors = [];
    var warnings = [];
    if (seenKeys.has(key)) {
      errors.push(createError('DUPLICATE_QUESTION', 'canonicalKey', '重复题目: ' + key, 'ERROR', { canonicalKey: key }));
    } else {
      seenKeys.add(key);
    }
    return { valid: errors.length === 0, errors: errors, warnings: warnings, info: [], score: errors.length === 0 ? 1 : 0, checks: { duplicate: errors.length === 0 ? 'pass' : 'fail' } };
  });
  return { results: results, seenKeys: seenKeys };
}

module.exports = {
  validateDuplicate: validateDuplicate,
  validateBatchDuplicate: validateBatchDuplicate,
  buildCanonicalKey: buildCanonicalKey
};
};
__defs["shared/validator/graphic-validator.js"] = function (module, exports, require) {
/**
 * shared/validator/graphic-validator.js — M5-R11 Graphic Validator
 *
 * 验证图形描述：
 *   - type 是否注册
 *   - subtype 是否合法
 *   - params 是否完整
 *   - 参数类型是否正确
 *   - Renderer 是否存在对应处理器
 *   - 禁止 raw SVG/HTML 字符串
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var Schema = require("shared/schemas/semantic-question.schema.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function validateGraphic(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  var g = sq.graphic;
  if (!g) {
    return { valid: true, errors: [], warnings: [], info: [], score: 1, checks: { graphic: 'skip' } };
  }

  if (typeof g !== 'object') {
    errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'graphic', 'graphic 必须为对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: [], info: [], score: 0, checks: { graphic: 'fail' } };
  }

  // ① 禁止原始 SVG/HTML
  if (g.rawSvg || g.svg || g.html) {
    errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'graphic.rawSvg', 'graphic 不得包含原始 SVG/HTML 字符串（请使用描述性 params）', SEVERITY.ERROR));
  }

  // ② type 注册检查
  if (!g.type) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.type', '缺少 graphic.type', SEVERITY.ERROR));
  } else if (!Schema.isValidGraphicType(g.type)) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.type', '未注册的 graphic type: ' + g.type, SEVERITY.ERROR));
  }

  // ③ subtype 合法性
  if (g.subtype && g.type && !Schema.isValidGraphicSubtype(g.type, g.subtype)) {
    errors.push(createError(ERROR_CODES.GRAPHIC_TYPE_UNREGISTERED, 'graphic.subtype', 'type ' + g.type + ' 下未知 subtype: ' + g.subtype, SEVERITY.ERROR));
  }

  // ④ params 完整性（按 type 检查必填参数）
  var requiredParams = {
    geometry: ['shape'],
    chart: ['data', 'axes'],
    diagram: ['nodes', 'edges'],
    'number-line': ['range'],
    grid: ['size']
  };
  var req = requiredParams[g.type];
  if (req && g.params) {
    req.forEach(function (p) {
      if (g.params[p] == null) {
        warnings.push({ code: ERROR_CODES.GRAPHIC_PARAMS_INCOMPLETE, field: 'graphic.params.' + p, message: 'graphic.type ' + g.type + ' 缺少必填参数: ' + p, severity: 'WARNING' });
      }
    });
  }

  // ⑤ Renderer 存在性（延迟到 render-preflight，此处仅记录）
  info.push({ code: 'GRAPHIC_TYPE', field: 'graphic.type', message: '图形类型: ' + g.type + (g.subtype ? '/' + g.subtype : ''), severity: 'INFO' });

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0, checks: { graphic: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateGraphic: validateGraphic
};
};
__defs["shared/validator/render-preflight.js"] = function (module, exports, require) {
/**
 * shared/validator/render-preflight.js — M5-R12 Render Preflight
 *
 * 渲染前检查：
 *   - HTML 可生成
 *   - SVG Generator 存在
 *   - Graphic 参数合法
 *   - Print 模式可用
 *   - 无异常 DOM 依赖
 */
'use strict';

var Validator = require("shared/validator/question-validator.js");
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function validateRenderPreflight(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  // ① 基础字段完整性（渲染需要的最小字段）
  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt);
  if (!prompt) {
    errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'prompt', '缺少题干，无法渲染', SEVERITY.ERROR));
  }

  // ② answerMode 合法
  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  var validModes = ['input', 'choice', 'multi', 'none', 'read-aloud'];
  if (validModes.indexOf(answerMode) === -1) {
    errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'answerMode', '非法 answerMode: ' + answerMode, SEVERITY.ERROR));
  }

  // ③ choice 题需有 options
  if (answerMode === 'choice') {
    var hasOptions = sq.distractors && sq.distractors.length > 0;
    var answerVal = sq.answer && sq.answer.value != null;
    if (!hasOptions && !answerVal) {
      errors.push(createError(ERROR_CODES.RENDER_PREFLIGHT_FAILED, 'distractors', '选择题缺少选项', SEVERITY.ERROR));
    }
  }

  // ④ graphic → SVG Generator 存在性检查（延迟到运行时，此处仅记录）
  if (sq.graphic && sq.graphic.type) {
    info.push({ code: 'GRAPHIC_RENDER', field: 'graphic', message: '需 SVG Generator: ' + sq.graphic.type, severity: 'INFO' });
  }

  // ⑤ print 模式检查（打印需无交互元素）
  if (sq.printMode) {
    if (answerMode === 'choice' || answerMode === 'input') {
      warnings.push({ code: 'PRINT_INTERACTIVE', field: 'printMode', message: '打印模式下存在交互元素，将降级为静态显示', severity: 'WARNING' });
    }
  }

  // ⑥ 兼容字段（render/check/svg）存在性
  if (sq.render && typeof sq.render !== 'function') {
    warnings.push({ code: 'RENDER_INVALID', field: 'render', message: 'render 字段非函数', severity: 'WARNING' });
  }
  if (sq.check && typeof sq.check !== 'function') {
    warnings.push({ code: 'CHECK_INVALID', field: 'check', message: 'check 字段非函数', severity: 'WARNING' });
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { renderPreflight: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateRenderPreflight: validateRenderPreflight
};
};
global.StrategyEngine = __req('shared/strategy/strategy-engine.js');
global.StrategyLegacyAdapter = __req('shared/strategy/legacy-adapter.js');
global.StrategyConfig = __req('shared/strategy/strategy-config.js');
global.StrategyValidator = __req('shared/strategy/strategy-validator.js');
global.QuestionTypeStrategy = __req('shared/strategy/question-type-strategy.js');
global.QuestionTypeAllocation = __req('shared/strategy/question-type-allocation.js');
global.StaticDifficultyStrategy = __req('shared/strategy/static-difficulty.js');
global.DifficultyStrategy = __req('shared/strategy/difficulty-strategy.js');
global.TargetDifficulty = __req('shared/strategy/target-difficulty.js');
global.StructureConstraints = __req('shared/strategy/structure-constraints.js');
global.NumberRangeStrategy = __req('shared/strategy/number-range-strategy.js');
global.CognitiveStrategy = __req('shared/strategy/cognitive-strategy.js');
global.SpiralStrategy = __req('shared/strategy/spiral-strategy.js');
global.ContextStrategy = __req('shared/strategy/context-strategy.js');
global.ConstraintBuilder = __req('shared/strategy/constraint-builder.js');
global.GeneratorSelector = __req('shared/generator/generator-selector.js');
global.GeneratorMode = __req('shared/generator/generator-mode.js');
global.GeneratorRegistry = __req('shared/generator/generator-registry.js');
global.MigrationSwitch = __req('shared/generator/migration-switch.js');
global.LegacyPluginAdapter = __req('shared/generator/legacy-plugin-adapter.js');
global.SemanticQuestionBridge = __req('shared/generator/semantic-question-bridge.js');
global.ComplexGen = __req('shared/generator/generators/complex.js');
global.StrategyBundle = { req: __req, modules: __defs };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));