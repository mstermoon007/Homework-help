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
      : (typeof require !== 'undefined' ? require('../render.js') : null)));
}

function getQCheck() {
  var PU = getPluginUtil();
  if (PU && typeof PU.defaultQCheck === 'function') return PU.defaultQCheck;
  if (typeof defaultQCheck === 'function') return defaultQCheck;
  if (typeof require !== 'undefined') return require('../check.js').defaultQCheck;
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
