// @ts-check
/// <reference path="../shared/plugin-types.js" />

// 使用 shared/common.js 的 PluginUtil.createPlugin 工厂：
// 开发者只需实现 generateQuestions(opts)，render/check 由工厂自动生成。
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/pinyin-to-char.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  function gradeName(g) {
    return (typeof App !== 'undefined' && App.getGradeName) ? App.getGradeName(g) : (g + '年级');
  }

  var plugin = _PU.createPlugin({
    id: 'pinyin-to-char',
    name: '看拼音写字',
    grades: [1, 2, 3, 4, 5, 6],
    subject: 'chinese',
    printConfig: { pageType: 'pinyinToChar' },
    columns: 2,

    // 唯一需要开发者实现的：根据参数生成题目数组（每题含 answer + render(idx)）
    generateQuestions: function (options) {
      if (typeof PINYIN_BANK === 'undefined') {
        throw new Error('PINYIN_BANK 未加载，请确保 pinyin-bank.js 已引入');
      }
      var grade = options.grade || 1;
      var count = options.count || 10;
      var words = PINYIN_BANK.getWords(grade).slice(0, count);
      // 直接返回 renderCard / computeResult 兼容的题目形状，无需自定义 render/check
      return words.map(function (w) {
        return {
          q: w.py,            // 显示拼音，学生写出对应汉字
          answer: w.w,        // 答案（汉字）
          inputType: 'text'
        };
      });
    },

    // meta 自定义标题
    meta: function (opts) {
      var grade = opts.grade || 1;
      return { grade: grade, count: opts.count || 10, title: '小学' + gradeName(grade) + '看拼音写字练习' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
