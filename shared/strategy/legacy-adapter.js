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

var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

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
