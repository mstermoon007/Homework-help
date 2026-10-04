/**
 * shared/learner/practice-result.js — M6-R04 练习结果标准对象
 *
 * 标准结构：
 *   {
 *     questionId,        // 题目 ID（有则填，无则 null）
 *     knowledgePointId,  // 知识点 ID —— 必须来自 SemanticQuestion，禁止 UI 猜测
 *     correct,           // true/false
 *     userAnswer,
 *     correctAnswer,
 *     responseTime,      // 毫秒；未知为 null
 *     questionDifficulty,
 *     questionType,
 *     spiralLevel,
 *     semanticTarget,   // P27-12：语义目标维度（P25 新增，可回溯用）；无则 null
 *     errorType,         // 只允许来自可靠来源（R10）；否则 null
 *     misconception,     // V5.1.0：判断题自由文本错因（sq.data.misconception）；不入 errorType 聚类，无则 null
 *     status,            // 'correct' | 'wrong' | 'unanswered' | 'skipped' | 'redo'
 *     timestamp
 *   }
 *
 * P28-31 定位：练习结果的**事实契约**。knowledgePointId 必须源自 SemanticQuestion
 *   （禁止 UI 猜测）；status/errorType 归一后进入 LearnerModel。本模块不做任何评分/归因。
 */
(function (global) {
  'use strict';

  var STATUS = {
    CORRECT: 'correct',
    WRONG: 'wrong',
    UNANSWERED: 'unanswered',
    SKIPPED: 'skipped',
    REDO: 'redo'
  };

  function numOrNull(v) {
    return (typeof v === 'number' && isFinite(v)) ? v : null;
  }
  function strOrNull(v) {
    return (v == null || v === '') ? null : String(v);
  }

  function now() { return Date.now(); }

  /**
   * 由 SemanticQuestion 与作答结果构造 PracticeResult（R04 主入口）。
   * @param {Object} sq SemanticQuestion（必须有 knowledgePoint）
   * @param {Object} opts { correct, userAnswer, correctAnswer?, responseTime?, status? }
   * @returns {Object} PracticeResult
   * @throws 若 sq 非对象或缺少 knowledgePoint（禁止 UI 猜测知识点）
   */
  function fromSemanticQuestion(sq, opts) {
    opts = opts || {};
    if (!sq || typeof sq !== 'object') {
      throw new Error('PracticeResult.fromSemanticQuestion: 需要 SemanticQuestion');
    }
    var knowledgePointId = strOrNull(sq.knowledgePoint) || strOrNull(sq.knowledgePointId);
    if (!knowledgePointId) {
      throw new Error('PracticeResult.fromSemanticQuestion: knowledgePointId 必须从 SemanticQuestion 获取（禁止 UI 猜测）');
    }
    return create({
      questionId: strOrNull(sq.id) || strOrNull(sq.questionId),
      knowledgePointId: knowledgePointId,
      correct: opts.correct === true,
      userAnswer: opts.userAnswer,
      correctAnswer: opts.correctAnswer != null ? opts.correctAnswer
        : (sq.answer && sq.answer.value != null ? sq.answer.value : null),
      responseTime: numOrNull(opts.responseTime),
      questionDifficulty: numOrNull(sq.difficulty),
      questionType: strOrNull(sq.questionType) || strOrNull(sq.type),
      spiralLevel: numOrNull(sq.spiralLevel != null ? sq.spiralLevel : (sq.constraints && sq.constraints.spiralLevel)),
      // P27-12：semanticTarget 优先取 sq.semanticTarget（字符串）；
      // 兼容 sq.semanticTargets（数组）取首项；无则 null（绝不伪造）。
      semanticTarget: strOrNull(sq.semanticTarget)
        || (Array.isArray(sq.semanticTargets) && sq.semanticTargets.length ? strOrNull(sq.semanticTargets[0]) : null),
      errorType: opts.errorType != null ? opts.errorType : sq.errorType,
      // V5.1.0：判断题自由文本错因，源自 sq.data.misconception；opts 可显式覆盖
      misconception: opts.misconception != null ? opts.misconception
        : (sq.data && sq.data.misconception != null ? sq.data.misconception : null),
      status: opts.status || (opts.correct === true ? STATUS.CORRECT : STATUS.WRONG),
      timestamp: numOrNull(opts.timestamp) || now()
    });
  }

  /**
   * 基础工厂：补全默认值、规范化字段。
   */
  function create(partial) {
    partial = partial || {};
    var correct = partial.correct === true;
    var status = (partial.status === STATUS.REDO) ? STATUS.REDO
      : (partial.status === STATUS.SKIPPED) ? STATUS.SKIPPED
      : correct ? STATUS.CORRECT : STATUS.WRONG;
    return {
      questionId: strOrNull(partial.questionId),
      knowledgePointId: strOrNull(partial.knowledgePointId),
      correct: correct,
      userAnswer: partial.userAnswer != null ? partial.userAnswer : null,
      correctAnswer: partial.correctAnswer != null ? partial.correctAnswer : null,
      responseTime: numOrNull(partial.responseTime),
      questionDifficulty: numOrNull(partial.questionDifficulty),
      questionType: strOrNull(partial.questionType),
      spiralLevel: numOrNull(partial.spiralLevel),
      semanticTarget: strOrNull(partial.semanticTarget),
      errorType: normalizeErrorTypeField(partial.errorType),
      // V5.1.0：自由文本错因只做字符串归一，不经 ErrorModel 8 类聚类（用户锁定口径）
      misconception: strOrNull(partial.misconception),
      status: status,
      timestamp: numOrNull(partial.timestamp) || now()
    };
  }

  function normalizeErrorTypeField(t) {
    if (t == null) return null;
    // 错因类型由 ErrorModel 归一（unknown → null，绝不伪造）
    var EM = (typeof LearnerErrorModel !== 'undefined') ? LearnerErrorModel
      : (typeof require !== 'undefined' ? require('./error-model.js') : null);
    return EM ? EM.normalizeErrorType(t) : (typeof t === 'string' ? t : null);
  }

  var PracticeResult = {
    STATUS: STATUS,
    create: create,
    fromSemanticQuestion: fromSemanticQuestion
  };

  global.PracticeResult = PracticeResult;
  if (typeof module !== 'undefined' && module.exports) module.exports = PracticeResult;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));