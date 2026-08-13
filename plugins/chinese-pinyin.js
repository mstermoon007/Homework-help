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

      if (type === 'copy' && grade === 1) {
        // 拼音抄写：取单个汉字及其拼音，让学生抄写拼音
        take(bank.getChars(grade), count).forEach(ch => {
          questions.push({ type: 'copy', char: ch.hz, pinyin: ch.py });
        });
      } else if (type === 'char' && grade === 1) {
        // 汉字注音：显示汉字，学生写拼音
        take(bank.getChars(grade), count).forEach(ch => {
          questions.push({ type: 'char', char: ch.hz, pinyin: ch.py });
        });
      } else if (type === 'mix' && grade === 1) {
        // 混合：抄写 + 注音各半
        const half = Math.ceil(count / 2);
        take(bank.getChars(grade), half).forEach(ch => {
          questions.push({ type: 'copy', char: ch.hz, pinyin: ch.py });
        });
        take(bank.getChars(grade), count - half).forEach(ch => {
          questions.push({ type: 'char', char: ch.hz, pinyin: ch.py });
        });
      } else {
        // 词语注音（二年级+ 或通用）
        take(bank.getWords(grade), count).forEach(w => {
          questions.push({ type: 'word', word: w.w, pinyin: w.py });
        });
      }

      return {
        questions,
        meta: { grade, count: questions.length, type, title: '小学' + gradeName(grade) + '拼音练习' }
      };
    },

    render(exerciseSet) {
      const { questions } = exerciseSet;
      let html = '<div class="pinyin-exercise">';
      questions.forEach((q, idx) => {
        html += `<div class="pinyin-row" data-index="${idx}" style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">`;
        html += `<span class="q-num">${idx + 1}.</span>`;
        if (q.type === 'copy') {
          html += `<span style="font-size:1.2em;">${q.char}</span>`;
          html += `<span style="color:#888;">${q.pinyin}</span>`;
          html += `<input type="text" class="answer-input pinyin-input" data-index="${idx}" placeholder="抄写拼音" style="width:150px;font-family:'Segoe UI',Arial,sans-serif;">`;
        } else if (q.type === 'char') {
          html += `<span style="font-size:1.2em;">${q.char}</span>`;
          html += `<input type="text" class="answer-input pinyin-input" data-index="${idx}" placeholder="输入拼音" style="width:150px;font-family:'Segoe UI',Arial,sans-serif;">`;
        } else {
          html += `<span style="font-size:1.1em;">${q.word}</span>`;
          html += `<input type="text" class="answer-input pinyin-input" data-index="${idx}" placeholder="输入拼音" style="width:300px;font-family:'Segoe UI',Arial,sans-serif;">`;
        }
        html += '</div>';
      });
      html += '</div>';
      return html;
    },

    check(exerciseSet, userAnswers) {
      const questions = exerciseSet.questions;
      let correct = 0;
      const results = [];
      const correctAnswers = [];

      questions.forEach((q, idx) => {
        const userAns = (userAnswers[idx] || '').trim();
        const realAns = q.pinyin.trim();
        // 声调容错：normPY 去除声调与空格，用户无需输入声调符号
        const isRight = _PU.normPY(userAns) === _PU.normPY(realAns);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(realAns);
      });

      const total = questions.length;
      const score = total === 0 ? 0 : Math.round((correct / total) * 100);
      let message = '还需要练习哦！';
      if (score === 100) message = '太棒了！全部正确！';
      else if (score >= 80) message = '很不错，继续加油！';
      else if (score >= 60) message = '还可以，再练练吧！';

      return { score, total, correct, message, results, correctAnswers };
    }
  };

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
