/**
 * shared/learner/result-collector.js — M6-R05 练习结果收集器
 *
 * 统一「批改结果 → PracticeResult → LearnerModel.update」链路：
 *
 *   check()
 *     ↓
 *   PracticeResult
 *     ↓
 *   LearnerModel.update()
 *
 * 覆盖：正确 / 错误 / 未作答 / 重做 / 跳过。
 */
(function (global) {
  'use strict';

  var LearnerModel = (typeof global.LearnerModel !== 'undefined' && global.LearnerModel) ? global.LearnerModel
    : (typeof require !== 'undefined' ? require('./learner-model.js') : null);
  var PracticeResultModule = (typeof global.PracticeResult !== 'undefined' && global.PracticeResult) ? global.PracticeResult
    : (typeof require !== 'undefined' ? require('./practice-result.js') : null);
  if (!LearnerModel || !PracticeResultModule) {
    throw new Error('result-collector.js 依赖 learner-model.js 与 practice-result.js');
  }

  /**
   * 批量收集（主入口）。
   * @param {Object} state 当前 LearnerModel 状态（会被返回的新状态替换）
   * @param {Array<Object>} results PracticeResult 或增量 schema
   * @param {Object} [opts] { now, alpha, baseDifficulty }
   * @returns {Object} 更新后的顶层状态
   */
  function collect(state, results, opts) {
    opts = opts || {};
    var s = LearnerModel.normalizeLearnerState(state);
    var ts = (typeof opts.now === 'number') ? opts.now : Date.now();
    var list = Array.isArray(results) ? results : (results ? [results] : []);
    list.forEach(function (r) {
      if (!r) return;
      var pr = (r && r.knowledgePointId != null && typeof r === 'object')
        ? PracticeResultModule.create(r)
        : r;
      if (pr && pr.status === 'skipped') {
        // 跳过：仅计曝光，不计作答（R05 跳过分支）
        s = LearnerModel.update(s, pr, { alpha: opts.alpha, now: ts });
        return;
      }
      s = LearnerModel.update(s, pr, { alpha: opts.alpha, now: ts });
    });
    return s;
  }

  /**
   * 便捷：把一次练习批改转化为 PracticeResult 列表并更新状态。
   * @param {Object} state
   * @param {Array<Object>} questions SemanticQuestion[]（每项含 knowledgePoint）
   * @param {Object} checkResult { results: [...boolean], answers?, correctAnswers? }
   * @param {Object} [opts] { errorTypeByIndex?, responseTimes?, now, alpha }
   */
  function collectCheck(state, questions, checkResult, opts) {
    opts = opts || {};
    var results = [];
    if (!Array.isArray(checkResult.results)) return LearnerModel.normalizeLearnerState(state);
    checkResult.results.forEach(function (correct, i) {
      var q = questions && questions[i];
      if (!q) return; // 无对应题目，跳过（不伪造）
      var pr = PracticeResultModule.fromSemanticQuestion(q, {
        correct: correct === true,
        userAnswer: opts.answers && opts.answers[i],
        responseTime: opts.responseTimes && opts.responseTimes[i],
        errorType: opts.errorTypeByIndex && opts.errorTypeByIndex[i],
        status: correct === true ? 'correct' : (opts.skippedIndexes && opts.skippedIndexes[i] ? 'skipped' : 'wrong')
      });
      results.push(pr);
    });
    return collect(state, results, opts);
  }

  var ResultCollector = {
    collect: collect,
    collectCheck: collectCheck
  };

  global.ResultCollector = ResultCollector;
  if (typeof module !== 'undefined' && module.exports) module.exports = ResultCollector;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));