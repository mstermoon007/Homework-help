// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-g5-placeholder.js — 五年级模块占位插件
//
// 用途：五年级知识点已按全年级题型模块目录（M1-M12）写入知识库，但各模块
// 具体题目生成逻辑尚未实现。为避免题型选择页空白或「插件不存在」报错，
// 本插件作为五年级各模块的统一占位，实现标准 ExercisePlugin 接口：
//   - generate()      返回空题目集 { questions: [], meta: {...} }
//   - render()        返回「题目开发中，敬请期待」占位提示
//   - check()         返回 0 分空结果（无题可判）
//   - isPlaceholder   特殊标记 = true，供综合练习 / 覆盖统计 / 页面过滤使用
//
// 注册表（registry.js）中五年级预留插件（math-g5-*）均通过
// moduleIds 声明对应模块，实际加载本文件作为统一占位实现。
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-g5-placeholder.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  var G5_MODULE_IDS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10', 'M11', 'M12'];

  var g5PlaceholderPlugin = _PU.createPlugin({
    id: 'math-g5-placeholder',
    name: '五年级题型',
    subject: 'math',
    category: 'mixed',
    grades: [5],
    isPlaceholder: true,
    moduleIds: G5_MODULE_IDS,
    moduleId: 'M1',
    description: '五年级题型正在建设中，敬请期待',
    settings: [],

    generateQuestions: function () {
      return [];
    },

    generate: function () {
      return {
        questions: [],
        meta: {
          grade: 5,
          count: 0,
          title: '五年级题型',
          placeholder: true
        }
      };
    },

    render: function () {
      var moduleName = '';
      if (typeof window !== 'undefined' && window.location) {
        var mId = new URLSearchParams(window.location.search).get('module');
        if (mId) {
          var cat = typeof MODULE_CATALOG !== 'undefined' ? MODULE_CATALOG : null;
          if (cat) {
            for (var i = 0; i < cat.length; i++) {
              if (cat[i].id === mId) { moduleName = cat[i].name; break; }
            }
          }
        }
      }
      var title = moduleName ? '「' + moduleName + '」' : '';
      return '<div class="placeholder-tip" style="padding:48px 24px;text-align:center;">' +
        '<div style="font-size:56px;line-height:1;margin-bottom:16px;">🚧</div>' +
        '<div style="font-size:20px;font-weight:800;color:#3f6fd1;margin-bottom:8px;">' + title + '题目开发中，敬请期待</div>' +
        '<div style="font-size:13px;color:#7a879c;">本模块为五年级题型占位，具体题目正在建设中，请稍后再来。</div>' +
        '</div>';
    },

    check: function () {
      return { score: 0, total: 0, correct: 0, message: '题目开发中',
        results: [], correctAnswers: [] };
    }
  });

  global.__currentPlugin = g5PlaceholderPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = g5PlaceholderPlugin;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));