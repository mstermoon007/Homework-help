/**
 * shared/strategy/complexity-strategy.js — M3-14 Complexity Strategy
 *
 * 题目复杂度统筹：把「有效难度 + 知识点螺旋档」映射为 简单/标准/复杂 三档，
 * 驱动题目内容在固定样式内「复杂化 / 简单化」：
 *
 *   tier=simple   → 数值范围小、单步运算、无干扰项（简单化）
 *   tier=standard → 数值范围中、支持多步、进位退位（默认基准）
 *   tier=complex  → 大范围、混合运算/多条件、多步嵌套（复杂化）
 *
 * 与 question-style-strategy 解耦：样式管骨架，复杂度管内容深度。
 * 输出档位注入 QuestionPlan.complexity，供渲染层/生成器做内容增强。
 */
'use strict';

var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

var DIFFICULTY_MIN = 1;
var DIFFICULTY_MAX = 10;
var TIERS = ['simple', 'standard', 'complex'];

/** 难度档 → 基础复杂度档（1-3 → simple；4-7 → standard；8-10 → complex） */
function tierForDifficulty(difficulty) {
  if (typeof difficulty !== 'number' || !isFinite(difficulty)) {
    throw new StrategyError('difficulty 必须是有限数字: ' + difficulty, CODES.INVALID_REQUEST, { difficulty: difficulty });
  }
  var d = Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.floor(difficulty)));
  if (d <= 3) return 'simple';
  if (d <= 7) return 'standard';
  return 'complex';
}

/**
 * 解析复杂度档。
 * options: {
 *   difficulty: number,            // 有效难度 1-10（必填）
 *   spiralLevel: number,           // 螺旋档 1-6（可选，用于微调）
 *   maxSpiralLevel: number,        // 知识点最大螺旋档（可选）
 *   knowledgePointId: string       // 错误提示用
 * }
 * 输出：{ tier, label, rangeBoost, multiStep, mixLevel, spiralAdjusted }
 *   rangeBoost  难度对数值范围的增益（0/1/2，供数值范围叠加）
 *   multiStep   是否允许多步运算
 *   mixLevel    混合度 0-2（0 单一运算；1 加减少量混合；2 进位/退位+混合）
 */
function resolveComplexity(options) {
  options = options || {};
  if (options.difficulty == null) {
    throw new StrategyError('difficulty 必填（1-10）', CODES.INVALID_REQUEST, { knowledgePointId: options.knowledgePointId });
  }
  var tier = tierForDifficulty(options.difficulty);
  var spiral = options.spiralLevel != null ? options.spiralLevel : null;

  // 螺旋微调：螺旋档高 + 难度中上 → 升一档；螺旋档低 + 难度低 → 保持简单
  var spiralAdjusted = false;
  if (spiral != null) {
    if (tier === 'standard' && spiral >= 5 && options.difficulty >= 6) {
      tier = 'complex'; spiralAdjusted = true;
    } else if (tier === 'standard' && spiral <= 2 && options.difficulty <= 4) {
      tier = 'simple'; spiralAdjusted = true;
    }
  }

  var params = {
    simple:   { rangeBoost: 0, multiStep: false, mixLevel: 0 },
    standard: { rangeBoost: 1, multiStep: true,  mixLevel: 1 },
    complex:  { rangeBoost: 2, multiStep: true,  mixLevel: 2 }
  }[tier];

  return {
    tier: tier,
    label: tier === 'simple' ? '基础' : tier === 'standard' ? '标准' : '进阶',
    rangeBoost: params.rangeBoost,
    multiStep: params.multiStep,
    mixLevel: params.mixLevel,
    spiralAdjusted: spiralAdjusted
  };
}

module.exports = {
  resolveComplexity: resolveComplexity,
  tierForDifficulty: tierForDifficulty,
  TIERS: TIERS
};
