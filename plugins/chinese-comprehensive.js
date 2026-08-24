// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/chinese-comprehensive.js 依赖 shared/common.js（PluginUtil），请先加载');

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  /** @type {ExercisePlugin} */
  var plugin = {
    id: 'chinese-comprehensive',
    name: '综合练习',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'chinese',
    printConfig: { pageType: 'comprehensive' },

    generate(options = {}) {
      if (typeof PINYIN_BANK === 'undefined') {
        throw new Error('PINYIN_BANK 未加载，请确保 pinyin-bank.js 已引入');
      }

      var grade = options.grade || 1;
      var count = options.count || 10;

      var bank = PINYIN_BANK;
      // getWords/getChars 无 count 参数，需手动截取
      var words = bank.getWords(grade).slice(0, Math.ceil(count / 2));
      var chars = bank.getChars(grade).slice(0, Math.ceil(count / 2));

      var questions = [];
      var wi = 0, ci = 0;
      for (var i = 0; i < count; i++) {
        if (_PU.rand(1, 100) <= 50 && wi < words.length) {
          questions.push({ type: 'pinyin-to-char', pinyin: words[wi].py, answer: words[wi].w, answerType: 'char' });
          wi++;
        } else if (ci < chars.length) {
          questions.push({ type: 'char-to-pinyin', char: chars[ci].hz, answer: chars[ci].py, answerType: 'pinyin' });
          ci++;
        } else if (wi < words.length) {
          questions.push({ type: 'pinyin-to-char', pinyin: words[wi].py, answer: words[wi].w, answerType: 'char' });
          wi++;
        }
      }

      return {
        questions,
        meta: { grade, count: questions.length, columns: 2, title: '小学' + gradeName(grade) + '综合练习' }
      };
    },

    render(exerciseSet) {
      // 列数交由 PluginUtil.layout.fitColumns 按题目内容在容器内动态计算（与预览/打印页一致），不再写死
      var html = '<div class="comprehensive-grid" style="display:grid;gap:15px;">';
      exerciseSet.questions.forEach((q, idx) => {
        html += `<div class="question-card comp-card" data-index="${idx}" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.5cm;background:var(--card);position:relative;text-align:center;box-shadow:0 8px 24px rgba(40,70,120,.08);">`;
        html += `<span class="q-num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#fef0e8;color:#f5576c;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">${idx + 1}</span>`;
        if (q.type === 'pinyin-to-char') {
          html += `<div class="pinyin-hint" style="font-size:1.2em;color:#f5576c;font-family:'Times New Roman',Georgia,serif;font-weight:800;letter-spacing:1px;">${q.pinyin}</div>`;
          html += `<div style="font-size:11px;color:var(--muted);margin:2px 0 8px;">请写出汉字</div>`;
          html += `<input type="text" class="answer-input" data-index="${idx}" placeholder="写汉字" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:110px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#10ac84;background:var(--soft-bg);outline:none;font-family:'KaiTi','STKaiti','楷体',serif;">`;
        } else {
          html += `<div class="char-hint" style="font-size:1.3em;font-weight:800;color:var(--ink);">${q.char}</div>`;
          html += `<div style="font-size:11px;color:var(--muted);margin:2px 0 8px;">请写出拼音</div>`;
          html += `<input type="text" class="answer-input pinyin-input" data-index="${idx}" placeholder="写拼音" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:110px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#f5576c;background:var(--soft-bg);outline:none;font-family:'Times New Roman',Georgia,serif;">`;
        }
        html += `<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:6px;"></div>`;
        html += '</div>';
      });
      html += '</div>';
      return html;
    },

    check(exerciseSet, userAnswers) {
      var questions = exerciseSet.questions;
      var correct = 0;
      var results = [];
      var correctAnswers = [];

      questions.forEach((q, idx) => {
        var userAns = (userAnswers[idx] || '').trim();
        var realAns = q.answer.trim();
        // 拼音题用 normPY（声调容错），汉字题用 normHZ（去空格）
        var isRight = q.answerType === 'pinyin'
          ? _PU.normPY(userAns) === _PU.normPY(realAns)
          : _PU.normHZ(userAns) === _PU.normHZ(realAns);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(realAns);
      });

      var total = questions.length;
      var score = total === 0 ? 0 : Math.round((correct / total) * 100);
      var message = '还需要练习哦！';
      if (score === 100) message = '太棒了！全部正确！';
      else if (score >= 80) message = '很不错，继续加油！';
      else if (score >= 60) message = '还可以，再练练吧！';

      return { score, total, correct, message, results, correctAnswers };
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
