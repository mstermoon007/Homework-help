// @ts-check
/// <reference path="../shared/plugin-types.js" />
/**
 * plugins/_template.js — 新插件开发样板（复制本文件后修改）
 *
 * 【开发流程（缺一不可）】
 *   1. 复制本文件为 plugins/<你的插件id>.js，修改 id/name/grades 等
 *   2. 在 plugins/registry.js 注册：{ id, name, subject, grade, file, deps }
 *   3. 在 shared/module-catalog.js 登记模块（如需新模块）
 *   4. 在 shared/knowledge-bank.js 登记知识点条目（pluginId 须与 id 一致，
 *      ID 为科目前缀三段式：math-g1-m1-addsub-20 / cn-g1-n1-… / en-g3-e1-…）
 *      —— 以上三处必须同步更新，页面（HTML）零修改
 *   5. 用 dev/plugin-check.html 验证 generate/render/check
 *
 * 【工厂选型（任务11 起）】
 *   - PluginUtil.createMathPlugin(cfg)     数值比较批改 + math-grid/math-card + 数学难度消费
 *   - 仅数学工厂已提供；语文/英语插件当前直接构建插件对象（可自行补 createChinesePlugin /
 *     createEnglishPlugin 工厂）。所有工厂自动注入：subject 预设、opts.difficultyParams
 *     （App.Difficulty.paramsFor 结果）、plugin.cardClass/gridClass；旧 createPlugin(cfg) 完全兼容。
 *
 * 【硬性约定】
 *   - 随机数只用 PluginUtil（crypto 优先），禁止 Math.random()
 *   - 插件不得互相 import/require，公共能力走 shared/common.js
 *   - 不读写 localStorage / 不记录用户行为 / 不做个性化
 *   - 打印输出必须干净：交互元素（输入框/选项）用 renderCard 生成，
 *     print.js 会自动把 .answer-inp / .opt 处理为可打印形式
 *   - 必须接入难度系统：至少用 PluginUtil.diffMax() 缩放数值范围
 */
(function (global) {
  'use strict';

  // ============ 依赖：shared/common.js 的 PluginUtil（先于本文件加载） ============
  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/_template.js 依赖 shared/common.js（PluginUtil），请先加载');

  /**
   * 科目化工厂示例（数学）：createMathPlugin 自动提供
   *   ① subject: 'math' 预设          ② 数值比较缺省批改（'12' 与 12 等价）
   *   ③ math-grid 网格修饰类           ④ opts.difficultyParams = App.Difficulty.paramsFor('math', 难度)
   * 语文/英语插件当前直接构建插件对象（未提供对应工厂）。
   */
  var plugin = _PU.createMathPlugin({

    // ---- 必填元数据 ----
    id: 'template-demo',            // 与文件名一致（template-demo.js → template-demo）
    name: '样板插件（5以内加法）',
    // subject 由工厂预设为 'math'，无需手写
    grades: [1],                    // 适用年级（非空数组）
    category: 'number',             // number / geometry / statistics / mixed
    moduleId: 'M1',                 // 对应 shared/module-catalog.js 的模块 id（数学插件必填）

    // ---- 可选元数据 ----
    description: '5 以内加法口算（新插件开发示例）',
    columns: 4,                     // 网格默认列数（renderGrid 自动使用）

    // ---- 打印配置：确保打印输出干净、无交互元素 ----
    printConfig: { pageType: 'math' },

    // ---- 设置面板（practice.html 据此动态生成控件，页面零修改） ----
    settings: [
      {
        key: 'maxNum',
        label: '难度（最大数）',
        type: 'number',
        default: 5,
        min: 3,
        max: 20,
        hint: '如 5 = 5 以内'
      }
    ],

    // ---- 知识点声明（须已在 shared/knowledge-bank.js 登记，否则开发期告警） ----
    // 格式①（各年级统一）：knowledgePoints: ['math-g1-m1-addsub-20']
    // 格式②（按年级区分）：knowledgePoints: { 1: ['math-g1-m1-addsub-20'], 2: ['math-g2-m1-addsub-100'] }
    // knowledgePoints: ['math-g1-m1-addsub-20'],

    // ---- 核心：只实现题目生成，render/check 由工厂兜底 ----
    generateQuestions(opts) {
      var count = opts.count || 10;
      var grade = opts.grade || 1;

      // 难度系统（必接）：归一化 1-10；显式 maxNum 即填即得（与 math-oral 约定一致）。
      // 工厂已注入 opts.difficultyParams（level/scale/steps/allowBracket/allowMultDiv），
      // 也可直接消费结构参数：
      //   var steps = opts.difficultyParams && opts.difficultyParams.steps;
      var _DIFF = _PU.diffLevel(opts.difficulty);            // 非法值回退 3
      var maxNum = opts.maxNum != null
        ? Math.round(Number(opts.maxNum))                    // 设置面板显式值优先
        : _PU.diffMax(5, _DIFF);                             // 难度缩放：level 3 → 5，10 → 12

      var questions = [];
      for (var i = 0; i < count; i++) {
        var a = _PU.randInt(1, Math.max(1, maxNum - 1));
        var b = _PU.randInt(1, Math.max(1, maxNum - a));     // 确保和 <= maxNum
        questions.push({
          type: 'template-demo',
          // renderCard 题目形状：{ q, answer, inputType, unit, hint, svg, options }
          // inputType: 'text'（单框）/ 'multi'（多框）/ 'choice'（选项）
          q: a + ' + ' + b + ' = ',
          answer: a + b,
          inputType: 'text',
          // render 用 renderCard 生成标准卡片：类名（.question-card/.num/.answer-inp）
          // 与 practice.html 样式、打印模块完全一致，不要手写其他类名
          render: function (idx) { return _PU.renderCard(this, idx); }
          // check 省略：createMathPlugin 默认走数值比较批改；
          // multi/数组答案仍走 defaultQCheck 分字段判定；特殊判定可提供 check(userAnswers, idx)
        });
      }
      return questions;
    },

    // meta 可为函数（opts → meta 对象），缺省为 { grade, count }
    meta(opts) {
      return { grade: opts.grade || 1, count: (opts.count || 10), columns: 4 };
    }

    // ---- 可选覆盖（一般无需提供，工厂默认已够用） ----
    // render(set) {},               // 自定义整组渲染（默认网格自动带科目修饰类）
    // check(set, userAnswers) {},   // 自定义整组批改（默认逐题科目比较器）
  });

  // ============ 导出（与所有插件保持一致，勿改） ============
  global.__currentPlugin = plugin;   // practice.html / dev/plugin-check.html

  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
