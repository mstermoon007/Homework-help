// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-placeholder.js — 竞赛模块占位插件
//
// 用途：竞赛模块（C1-C9）暂未实现具体题目生成逻辑。为避免题型选择页
// 出现空白或「插件不存在」报错，本插件实现标准 ExercisePlugin 接口：
//   - generate()      返回空题目集 { questions: [], meta: {...} }
//   - render()        返回「题目开发中，敬请期待」占位提示
//   - check()         返回 0 分空结果（无题可判）
//   - isPlaceholder   特殊标记 = true，供综合练习 / 页面过滤使用
//   - competitionModuleId 明确声明对应哪个竞赛模块（C1–C9）
//
// 综合练习（math-comprehensive.js）会依据 isPlaceholder 过滤本插件，
// 因此占位插件不会参与抽题，也不影响知识库权重配比。
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-placeholder.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // 对应竞赛模块：默认 C9（竞赛综合），页面通过 URL 参数 plugin=<this> 进入，
  // registry 以 competitionModuleIds 声明多个映射，加载到内存后由页面设置当前模块。
  var COMPETITION_MODULE_IDS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];

  var competitionPlaceholderPlugin = _PU.createPlugin({
    id: 'math-competition-placeholder',
    name: '竞赛专题',
    subject: 'math',
    category: 'competition',
    grades: [4, 5, 6],
    isPlaceholder: true,
    competitionModuleIds: COMPETITION_MODULE_IDS,
    moduleId: 'C9',
    description: '竞赛模块正在开发中，敬请期待',
    settings: [],

    generateQuestions: function () {
      return [];
    },

    // 覆盖全局属性：id/name 已在工厂中固化，这里补充展示名
    generate: function () {
      return {
        questions: [],
        meta: {
          grade: 4,
          count: 0,
          title: '竞赛专题',
          placeholder: true
        }
      };
    },

    render: function (set) {
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
        '<div style="font-size:13px;color:#7a879c;">本模块为竞赛专题占位，具体题型正在建设中，请稍后再来。</div>' +
        '</div>';
    },

    check: function () {
      return { score: 0, total: 0, correct: 0, message: '题目开发中',
        results: [], correctAnswers: [] };
    }
  });

  global.__currentPlugin = competitionPlaceholderPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = competitionPlaceholderPlugin;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));