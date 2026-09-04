/**
 * shared/presentation/renderer.js — M7-R01 Presentation Renderer（统一渲染入口）
 *
 * 职责：把 SemanticQuestion[]（可兼容 Legacy Question）渲染为成品。
 *
 *   PresentationRenderer.render(sq, options)    → RenderResult { html, graphic, metadata }
 *   PresentationRenderer.renderAll(questions, options)
 *                                             → { items, html, renderOptions }
 *
 * 设计约束（R01/R05）：
 *   - 输入只允许 SemanticQuestion / renderOptions；不识别 plugin / generator / kp 引用；
 *   - SVG 一律经 SVG Renderer（R03），渲染层唯一出口 RenderResult 携带完成图形；
 *   - RenderResult 绝不携带 plugin/generator/difficultyParams 等实现细节；
 *   - Renderer 不修改题目数据（graphic 描述符 → 输出图形，不写回题目）；
 *   - mode 支持 screen / print / preview（默认按 R07 screen）。
 */
(function (global) {
  'use strict';

  var RenderOptions = (typeof global !== 'undefined' && global.RenderOptions)
    ? global.RenderOptions
    : require('./render-options.js');
  var RenderResult = (typeof global !== 'undefined' && global.RenderResult)
    ? global.RenderResult
    : require('./render-result.js');
  var LegacyAdapter = (typeof global !== 'undefined' && global.LegacySvgAdapter)
    ? global.LegacySvgAdapter
    : require('./legacy-svg-adapter.js');
  var SVGRenderer = (typeof global !== 'undefined' && global.SVGRenderer)
    ? global.SVGRenderer
    : require('./svg-registry.js');
  // M7-R01/M4-R11：SVG 经 GraphicRenderer 门面统一派发；缺门面时直连 SVGRenderer（兼容旧加载顺序）。
  var GraphicRenderer = (typeof global !== 'undefined' && global.GraphicRenderer &&
      typeof global.GraphicRenderer.render === 'function')
    ? global.GraphicRenderer
    : (typeof global !== 'undefined' && global.SVGRenderer ? global.SVGRenderer : SVGRenderer);
  var HTMLRenderer = (typeof global !== 'undefined' && global.HTMLRenderer)
    ? global.HTMLRenderer
    : require('./html-renderer.js');

  /** 归一化单题图形描述符（SemanticQuestion.graphic 直取；Legacy q.svg 经适配器） */
  function graphicOf(sq) {
    if (!sq || typeof sq !== 'object') return null;
    if (sq.graphic && typeof sq.graphic === 'object' && typeof sq.graphic.type === 'string') {
      return sq.graphic;
    }
    return LegacyAdapter.convert(sq) || null;
  }

  /**
   * 渲染单题 → RenderResult（M7-R05 契约）。
   * @param {Object} sq SemanticQuestion（或兼容 Legacy Question）
   * @param {Object} [options] renderOptions（自动 normalize；未指定按 screen 默认）
   * @param {number} [index] 题号（缺省用 0）
   * @returns {Object} RenderResult
   */
  function render(sq, options, index) {
    var ro = RenderOptions.normalize(options);
    var i = typeof index === 'number' ? index : 0;
    var graphicDesc = graphicOf(sq);
    var svg = graphicDesc ? GraphicRenderer.render(graphicDesc, ro) : '';
    // P2.1（Issue #1 延伸）：density 透传给 HTML 渲染器（仅影响 HTML 输出，不进 RenderResult 元数据）
    var html = HTMLRenderer.render(sq, i, { mode: ro.mode, graphic: svg, density: ro.density });
    return RenderResult.create(sq, html, svg);
  }

  /**
   * 批量渲染 → { items: RenderResult[], html, renderOptions }
   * html 为整组网格 HTML（供整页/打印直接注入）。
   * @param {Array<Object>} questions
   * @param {Object} [options]
   * @param {Object} [gridOptions] { columns } 网格列数
   * @returns {{ items:Array, html:string, renderOptions:Object }}
   */
  function renderAll(questions, options, gridOptions) {
    var ro = RenderOptions.normalize(options);
    var list = Array.isArray(questions) ? questions : [];
    var items = [];
    for (var i = 0; i < list.length; i++) {
      items.push(render(list[i], ro, i));
    }
    var g = gridOptions || {};
    var html = HTMLRenderer.renderGrid(items, { mode: ro.mode, columns: g.columns });
    return { items: items, html: html, renderOptions: ro };
  }

  /**
   * 渲染产物合规检查：逐项校验 RenderResult 契约（禁用字段/缺字段）。
   */
  function validateResults(results) {
    var errors = [];
    (results || []).forEach(function (r, idx) {
      var c = RenderResult.validate(r);
      if (!c.valid) errors.push({ index: idx, errors: c.errors });
    });
    return { valid: errors.length === 0, errors: errors };
  }

  var API = {
    render: render,
    renderAll: renderAll,
    validateResults: validateResults,
    graphicOf: graphicOf
  };

  global.PresentationRenderer = API;
  if (global.App && typeof global.App === 'object') global.App.PresentationRenderer = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);