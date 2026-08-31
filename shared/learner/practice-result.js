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
 *     errorType,         // 只允许来自可靠来源（R10）；否则 null
 *     status,            // 'correct' | 'wrong' | 'unanswered' | 'skipped' | 'redo'
 *     timestamp
 *   }
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
      errorType: opts.errorType != null ? opts.errorType : sq.errorType,
      status: opts.status || (opts.correct === true ? STATUS.CORRECT : STATUS.WRONG),
      timestamp: numOrNull(opts.timestamp) || now()
    });
  }

  /**
   * 兼容入口：从 legacy 题目对象构造（仍需显式提供 knowledgePointId）。
   * UI 层不得自行猜测：kpId 必须来自 resolveKnowledgePointId() 等既有映射。
   */
  function fromLegacy(question, opts) {
    opts = opts || {};
    var kpId = strOrNull(opts.knowledgePointId);
    if (!kpId) {
      throw new Error('PracticeResult.fromLegacy: 需要显式 knowledgePointId（必须来自既有知识点映射，禁止猜）');
    }
    return create({
      questionId: strOrNull(question && (question.id || question.questionId)),
      knowledgePointId: kpId,
      correct: opts.correct === true,
      userAnswer: opts.userAnswer,
      correctAnswer: opts.correctAnswer != null ? opts.correctAnswer
        : (question && question.answer != null ? question.answer : null),
      responseTime: numOrNull(opts.responseTime),
      questionDifficulty: numOrNull(opts.questionDifficulty),
      questionType: strOrNull(question && (question.questionType || question.type)),
      spiralLevel: numOrNull(opts.spiralLevel),
      errorType: opts.errorType != null ? opts.errorType : (question && question.errorType),
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
      errorType: normalizeErrorTypeField(partial.errorType),
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
    fromSemanticQuestion: fromSemanticQuestion,
    fromLegacy: fromLegacy
  };

  global.PracticeResult = PracticeResult;
  if (typeof module !== 'undefined' && module.exports) module.exports = PracticeResult;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));