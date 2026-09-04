/**
 * shared/svg-templates.js — SVG 模板注册表（题目固定样式 → SVG 渲染族）
 *
 * 整理目标：把「题型固定样式（M3-13 style）」与「SVG 模板实现」的对应关系
 *           统一登记在一处，渲染层按 plan.style 查找模板族即可获得确定性的题目外观。
 *
 * 模板族（实现于 svg-*.js，挂载 global.SVGGenerators）：
 *   svg-calculation → SVGGenerators.math.calculation（add/sub/mul/div/dec/frac）
 *   svg-geometry    → SVGGenerators.math.geometry（图形操作/连线）
 *   svg-make-ten    → SVGGenerators.math.makeTen（凑十法拆分）
 *   svg-choice      → 选项卡（选择支 A/B/C/D，由渲染层 options 渲染）
 *   svg-judge       → 判断陈述（对/错标记，由渲染层语句渲染）
 *   svg-story       → 图文应用（生活场景 + 条件陈述，由渲染层文本渲染）
 *   svg-open        → 开放表达（自由作答区，由渲染层画布渲染）
 *
 * style（question-style-strategy 输出）→ 模板族注册：
 *   calc   → svg-calculation（计算式：横式/竖式）
 *   fill   → svg-calculation（算式留空）
 *   choice → svg-choice（选项卡）
 *   judge  → svg-judge（判断陈述）
 *   story  → svg-story（图文应用）
 *   shape  → svg-geometry（图形操作）
 *   open   → svg-open（开放表达）
 */
(function (global) {
  'use strict';

  var TEMPLATE_FAMILIES = {
    'svg-calculation': { module: 'math.calculation', desc: '计算式（横式/竖式：加、减、乘、除、小数、分数）', ready: false },
    'svg-geometry':    { module: 'math.geometry',    desc: '图形操作（立体/平面图形、连线配对、拼摆）', ready: false },
    'svg-make-ten':    { module: 'math.makeTen',     desc: '凑十法拆分（20 以内进位加法）', ready: false },
    'svg-choice':      { module: null,               desc: '选项卡（A/B/C/D 选择支，渲染层 options 渲染）', ready: true },
    'svg-judge':       { module: null,               desc: '判断陈述（对/错，渲染层语句渲染）', ready: true },
    'svg-story':       { module: null,               desc: '图文应用（生活场景 + 条件陈述，渲染层文本渲染）', ready: true },
    'svg-open':        { module: null,               desc: '开放表达（自由作答区，渲染层画布渲染）', ready: true }
  };

  var STYLE_TO_TEMPLATE = {
    calc:   'svg-calculation',
    fill:   'svg-calculation',
    choice: 'svg-choice',
    judge:  'svg-judge',
    story:  'svg-story',
    shape:  'svg-geometry',
    open:   'svg-open'
  };

  function refreshReadyState() {
    var g = global.SVGGenerators || {};
    Object.keys(TEMPLATE_FAMILIES).forEach(function (fam) {
      var t = TEMPLATE_FAMILIES[fam];
      if (!t.module) return;
      var parts = t.module.split('.');
      var node = g;
      for (var i = 0; i < parts.length; i++) {
        node = node ? node[parts[i]] : null;
        if (!node) break;
      }
      t.ready = !!node;
    });
  }

  /** 按固定样式取模板族信息；未知样式返回 null */
  function templateForStyle(style) {
    refreshReadyState();
    var fam = STYLE_TO_TEMPLATE[style];
    if (!fam) return null;
    var t = TEMPLATE_FAMILIES[fam];
    return { family: fam, desc: t.desc, ready: t.ready, module: t.module };
  }

  /** 全部模板族清单（供文档/校验） */
  function listTemplates() {
    refreshReadyState();
    return Object.keys(TEMPLATE_FAMILIES).map(function (fam) {
      var t = TEMPLATE_FAMILIES[fam];
      return { family: fam, desc: t.desc, ready: t.ready, module: t.module };
    });
  }

  var Api = {
    templateForStyle: templateForStyle,
    listTemplates: listTemplates,
    STYLE_TO_TEMPLATE: STYLE_TO_TEMPLATE,
    TEMPLATE_FAMILIES: TEMPLATE_FAMILIES
  };

  global.SVGTemplates = Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = Api;
})(typeof window !== 'undefined' ? window : globalThis);
