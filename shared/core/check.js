/**
 * shared/core/check.js — 批改聚合（P32 答案系统收口）
 *
 * computeResult / pickOpt（选项点击）。
 * 判分唯一权威 = AnswerValidator.gradeUserAnswer（shared/validator/answer-validator.js）：
 *   - 浏览器：经 global.PresentationEngine.AnswerValidator（presentation-engine.bundle 暴露）
 *   - Node：require 兜底（同目录相对路径）
 * P32-AS-06/08：defaultQCheck、q.answerParts 分支、opts.checkFn 轨道已物理删除；
 * 归一化唯一存在于 answer-validator（旧 core.normalizeAns 已删）。
 */
(function (global) {
  'use strict';

  function resolveAnswerValidator() {
    if (global.PresentationEngine && global.PresentationEngine.AnswerValidator) {
      return global.PresentationEngine.AnswerValidator;
    }
    if (typeof require === 'function') {
      try { return require('../validator/answer-validator.js'); } catch (e) { /* 装载异常：按不可判处理 */ }
    }
    return null;
  }

  /** 通用批改：返回 { score,total,correct,message,results,correctAnswers,
   *  explanations,misconceptions,parentCheck }（V5.1.0：逐题解析/自由文本错因；P32-AS-20 加 parentCheck）
   * P32-AS-06：逐题委托 gradeUserAnswer；correctAnswers 只取 answerSpec.value 的显示值，
   * acceptable 白名单永不进入上屏字段。
   * P32-AS-20（用户裁决 2026-10-08）：任一 grade===null → parentCheck=true 触发 UI 既有家长检查分支。 */
  function computeResult(questions, userAnswers) {
    var validator = resolveAnswerValidator();
    var correct = 0, results = [], correctAnswers = [], explanations = [], misconceptions = [];
    // P32-AS-20（用户裁决 2026-10-08 列入 AS-20 修断链）：
    // 任一题 grade === null（apply/geometry 长文本说理不可自动判）→ result.parentCheck = true，
    // UI 既有 parentCheck 分支（practice.html L1041-1053）由死分支转正。
    // results[i] 仍按 grade === true 计 false（null → false），不"非空即对"；correct 不变。
    var parentCheck = false;
    questions.forEach(function (q, i) {
      var grade = null;
      if (validator) {
        grade = validator.gradeUserAnswer(
          userAnswers ? userAnswers[i] : undefined,
          q.answerSpec || null,
          { questionType: q.questionType || q.type, prompt: q.q || q.text }
        );
      }
      // results 为布尔数组（practice.html 提交/显答案两条消费链契约）：
      // grade === null 表示不可自动判（家长检查通道），不计为正确——禁止非空即对。
      var ok = grade === true;
      if (ok) correct++;
      results.push(ok);
      if (grade === null) parentCheck = true;
      var disp = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
      correctAnswers.push(disp);
      explanations.push(q.explanation != null ? q.explanation : null);
      misconceptions.push(q.misconception != null ? q.misconception : null);
    });
    var total = questions.length;
    var score = total ? Math.round(correct / total * 100) : 0;
    var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
    return {
      score: score, total: total, correct: correct, message: message,
      results: results, correctAnswers: correctAnswers,
      explanations: explanations, misconceptions: misconceptions,
      parentCheck: parentCheck
    };
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
  global.PluginUtil.computeResult = computeResult;
  global.PluginUtil.pickOpt = pickOpt;
  global.__pickOpt = pickOpt;               // 卡片 onclick="window.__pickOpt(this)" 兼容

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      computeResult: computeResult, pickOpt: pickOpt
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
