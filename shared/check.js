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
