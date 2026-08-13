// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/chinese-pinyin.js 依赖 shared/common.js（PluginUtil），请先加载');

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  /** @type {ExercisePlugin} */
  var plugin = {
    id: 'chinese-pinyin',
    name: '拼音练习',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'chinese',
    printConfig: { pageType: 'pinyin' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',  label: '混合' },
          { value: 'copy', label: '拼音抄写' },
          { value: 'char', label: '汉字注音' },
          { value: 'word', label: '词语注音' }
        ]
      }
    ],

    generate(options = {}) {
      if (typeof PINYIN_BANK === 'undefined') {
        throw new Error('PINYIN_BANK 未加载，请确保 pinyin-bank.js 已引入');
      }

      const grade = options.grade || 1;
      const count = options.count || 10;
      const type = options.type || (grade === 1 ? 'mix' : 'word'); // 一年级可混合，高年级默认词语注音

      const bank = PINYIN_BANK;
      const questions = [];

      function take(arr, n) {
        const list = bank._shuffle ? bank._shuffle(arr) : arr.slice();
        return list.slice(0, n);
      }

      // 题目统一为 renderCard / computeResult 兼容形状：{ q, answer, inputType }
      if (type === 'copy' && grade === 1) {
        // 拼音抄写：显示汉字与拼音，学生抄写拼音
        take(bank.getChars(grade), count).forEach(ch => {
          questions.push({ type: 'copy', q: ch.hz + ' → ' + ch.py, answer: ch.py, inputType: 'text' });
        });
      } else if (type === 'char' && grade === 1) {
        // 汉字注音：显示汉字，学生写拼音
        take(bank.getChars(grade), count).forEach(ch => {
          questions.push({ type: 'char', q: ch.hz, answer: ch.py, inputType: 'text' });
        });
      } else if (type === 'mix' && grade === 1) {
        // 混合：抄写 + 注音各半
        const half = Math.ceil(count / 2);
        take(bank.getChars(grade), half).forEach(ch => {
          questions.push({ type: 'copy', q: ch.hz + ' → ' + ch.py, answer: ch.py, inputType: 'text' });
        });
        take(bank.getChars(grade), count - half).forEach(ch => {
          questions.push({ type: 'char', q: ch.hz, answer: ch.py, inputType: 'text' });
        });
      } else {
        // 词语注音（二年级+ 或通用）
        take(bank.getWords(grade), count).forEach(w => {
          questions.push({ type: 'word', q: w.w, answer: w.py, inputType: 'text' });
        });
      }

      return {
        questions,
        meta: { grade, count: questions.length, type, title: '小学' + gradeName(grade) + '拼音练习' }
      };
    },

    render(exerciseSet) {
      // 统一使用 PluginUtil.renderGrid（renderCard），全站卡片风格一致
      return _PU.renderGrid(exerciseSet.questions, { columns: 1, inputWidth: 220 });
    },

    check(exerciseSet, userAnswers) {
      // 复用 PluginUtil.computeResult，自定义 checkFn 保留原「声调容错」判定
      return _PU.computeResult(exerciseSet.questions, userAnswers, {
        checkFn: function (q, ua, i) {
          var userAns = (ua[i] || '').trim();
          return _PU.normPY(userAns) === _PU.normPY(q.answer);
        }
      });
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
