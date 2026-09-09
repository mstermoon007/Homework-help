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

var StaticDifficulty = require('./static-difficulty.js');
var KnowledgePoint = require('../knowledge/knowledge-point.js');
var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;
var StrategyConfig = require('./strategy-config.js');
var ComplexityStrategy = require('./complexity-strategy.js');

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

/**
 * P0-02 Step 8 — 合成难度（composed difficulty）
 *
 * 当前 Difficulty 结构的四路输入：
 *   1. base        — KP difficulty（StaticDifficulty 7 维，canonical 消费）或用户显式难度
 *   2. mode profile— quick/teacher 不调整；competition 未显式给难度时向年级锚点上沿抬升
 *   3. question    — 问题复杂度：复用 ComplexityStrategy 三档（按合成前的 base 判定）
 *                    simple 0 / standard +1 / complex +2
 *   4. composite   — 组合复杂度：显式复合结构（kp-complex 语义非平凡，或 allowBracket/allowMultDiv）+1
 *
 *   composed = clamp(round(base + modeAdj + qAdj + cAdj), 1, 10)
 *
 * Legacy difficulty 数据（kp.difficulty / legacy.difficulty）不参与、不修改。
 */
var MODE_PROFILE = {
  quick: 0,
  teacher: 0,
  competition: 'anchor-top'
};

/**
 * 组合复杂度：显式复合结构 → 1，否则 0。
 * 数据源为 canonical 结构字段与 kp-complex 语义表（非本对象所在策略链的难度输出，无循环）。
 */
function compositeComplexityOf(kp) {
  if (!kp) return 0;
  if (kp.structure && (kp.structure.allowBracket || kp.structure.allowMultDiv)) return 1;
  var sem = null;
  try {
    sem = require('../generator/core/kp-complex-semantics.js').resolveComplexSemantics(kp);
  } catch (e) { /* 语义表缺失时降级为 0，不阻塞 */ }
  if (!sem || !sem.family) return 0;
  if (sem.family !== 'simple' && sem.family !== 'no-bracket') return 1;
  if (sem.allowBracket || sem.inverse) return 1;
  return 0;
}

/**
 * 问题复杂度偏移：按合成前 base 判定三档（复用 ComplexityStrategy 同一 tier 语义）。
 */
function questionComplexityAdjustment(base, kp) {
  var tier = ComplexityStrategy.tierForDifficulty(base);
  if (tier === 'standard') return 1;
  if (tier === 'complex') return 2;
  return 0;
}

/**
 * mode profile 偏移：competition 且未显式给难度时，向上沿年级锚点抬升；否则 0。
 */
function modeAdjustment(mode, grade, hasUserDifficulty, base) {
  if (MODE_PROFILE[mode] !== 'anchor-top') return 0;
  if (hasUserDifficulty) return 0;
  if (grade == null) return 0;
  var anchor = StrategyConfig.difficultyAnchorOf(grade);
  if (!anchor) return 0;
  return Math.max(0, anchor[1] - base);
}

/**
 * 合成难度唯一实现处：base + modeAdj + qAdj + cAdj，clamp 1..10 并取整。
 *
 * 规则：
 *  - 用户显式难度（hasUserDifficulty=true）为权威输入，不叠加任何内容/结构偏移；
 *  - competition（未显式难度）mode profile 锚点顶格 —— 合成后不越过年级锚点上沿；
 *  - 其余模式按 base + modeAdj + qAdj + cAdj 合成。
 */
function resolveComposedDifficulty(options) {
  options = options || {};
  var base = options.base;
  if (typeof base !== 'number' || !isFinite(base)) {
    throw new StrategyError('base 必须是有限数字: ' + base, CODES.INVALID_REQUEST, { base: base });
  }

  var kp = options.knowledgePoint || null;
  var mode = options.mode || 'single-kp';
  var hasUser = options.hasUserDifficulty === true;

  if (hasUser) {
    return {
      composedDifficulty: applyEffective(base, 0),
      composition: {
        source: 'user',
        base: base,
        mode: mode,
        modeAdjustment: 0,
        questionComplexityTier: ComplexityStrategy.tierForDifficulty(base),
        questionComplexityAdjustment: 0,
        compositeAdjustment: 0
      }
    };
  }

  var qAdj = questionComplexityAdjustment(base, kp);
  var cAdj = compositeComplexityOf(kp);
  var mAdj = modeAdjustment(mode, options.grade, false, base);
  var composedDifficulty = applyEffective(base + mAdj + qAdj + cAdj, 0);

  if (MODE_PROFILE[mode] === 'anchor-top' && options.grade != null) {
    var anchor = StrategyConfig.difficultyAnchorOf(options.grade);
    if (anchor) composedDifficulty = Math.min(composedDifficulty, anchor[1]);
  }

  return {
    composedDifficulty: composedDifficulty,
    composition: {
      source: 'composed',
      base: base,
      mode: mode,
      modeAdjustment: mAdj,
      questionComplexityTier: ComplexityStrategy.tierForDifficulty(base),
      questionComplexityAdjustment: qAdj,
      compositeAdjustment: cAdj
    }
  };
}

module.exports = {
  DIFFICULTY_MIN: DIFFICULTY_MIN,
  DIFFICULTY_MAX: DIFFICULTY_MAX,
  applyEffective: applyEffective,
  computeEffectiveDifficulty: computeEffectiveDifficulty,
  compositeComplexityOf: compositeComplexityOf,
  modeAdjustment: modeAdjustment,
  questionComplexityAdjustment: questionComplexityAdjustment,
  resolveComposedDifficulty: resolveComposedDifficulty
};
