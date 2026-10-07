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
  var SVGRenderer = (typeof global !== 'undefined' && global.SVGRenderer)
    ? global.SVGRenderer
    : require('./svg-registry.js');
  // M7-R01/M4-R11：SVG 经 GraphicRenderer 门面统一派发；缺门面时直连 SVGRenderer（兼容旧加载顺序）。
  var GraphicRenderer = (typeof global !== 'undefined' && global.GraphicRenderer &&
      typeof global.GraphicRenderer.render === 'function')
    ? global.GraphicRenderer
    : (typeof global !== 'undefined' && global.SVGRenderer ? global.SVGRenderer : SVGRenderer);

  /** 从 GraphicRenderer 结果提取 SVG 字符串（SUCCESS 返回 svg，否则返回 ''） */
  function extractSvg(result) {
    if (!result || typeof result !== 'object') return '';
    if (result.status === 'SUCCESS' && typeof result.svg === 'string') return result.svg;
    return '';
  }
  var HTMLRenderer = (typeof global !== 'undefined' && global.HTMLRenderer)
    ? global.HTMLRenderer
    : require('./html-renderer.js');
  // P31-04：排版唯一决策 SSOT——renderAll 渲染前先算 plan，档位随每题透传（渲染后不再改 DOM）
  var QuestionLayout = (typeof global !== 'undefined' && global.QuestionLayout)
    ? global.QuestionLayout
    : require('./layout.js');

  /** 归一化单题图形描述符（MATH-14：认 SemanticQuestion.graphic；生成器经 data 透传时兜底 data.graphic） */
  function graphicOf(sq) {
    if (!sq || typeof sq !== 'object') return null;
    if (sq.graphic && typeof sq.graphic === 'object' && typeof sq.graphic.type === 'string') {
      return sq.graphic;
    }
    // 兼容生成器输出轨道：描述符在 sq.data.graphic（position/money/application/shape/stats/picture）
    var dataGraphic = sq.data && sq.data.graphic;
    if (dataGraphic && typeof dataGraphic === 'object' && typeof dataGraphic.type === 'string') {
      return dataGraphic;
    }
    return null;
  }

  /**
   * 渲染单题 → RenderResult（M7-R05 契约）。
   * @param {Object} sq SemanticQuestion（或兼容 Legacy Question）
   * @param {Object} [options] renderOptions（自动 normalize；未指定按 screen 默认）
   * @param {number} [index] 题号（缺省用 0）
   * @param {Object} [extra] 网格上下文：{ span } 列跨由 QuestionLayout 统一度量后透传（打印/预览同源）；
   *        { layoutDensity, stem, optionsMode, graphicGear } P31-04 plan 档位（html-renderer 按 class 白名单消费）
   * @returns {Object} RenderResult
   */
  function render(sq, options, index, extra) {
    var ro = RenderOptions.normalize(options);
    var i = typeof index === 'number' ? index : 0;
    var graphicDesc = graphicOf(sq);
    var gfxResult = graphicDesc ? GraphicRenderer.render(graphicDesc, ro) : { status: 'UNSUPPORTED', reason: 'No graphic descriptor' };
    var svg = extractSvg(gfxResult);
    // P31-FIX-10：旧 P2.1 ro.density→HTML 渲染器透传已删（裸 compact 死双轨；密度档位唯一走 plan）
    // P28-UI-PRINT-WYSIWYG-01：span 列跨透传（白名单在 html-renderer 内校验）
    // P31-04：plan 排版档位（layoutDensity/stem/optionsMode/graphicGear）透传，仅出 class，不进 RenderResult 契约
    var html = HTMLRenderer.render(sq, i, {
      mode: ro.mode,
      graphic: svg,
      span: extra && extra.span,
      layoutDensity: extra && extra.layoutDensity,
      stem: extra && extra.stem,
      optionsMode: extra && extra.optionsMode,
      graphicGear: extra && extra.graphicGear,
      break: extra && extra.break
    });
    var rr = RenderResult.create(sq, html, svg);
    // 附加渲染状态元数据供上游诊断（不破坏 RenderResult 契约）
    rr._gfxStatus = gfxResult.status;
    rr._gfxReason = gfxResult.reason;
    return rr;
  }

  /**
   * 批量渲染 → { items: RenderResult[], html, renderOptions }
   * html 为整组网格 HTML（供整页/打印直接注入）。
   * P31-04：渲染前先由 QuestionLayout.plan 统一决策列数与每题档位（屏/打同源，渲染后不再改 DOM）；
   * 调用方显式 spans（print 直渲链形态）优先于 plan.span，档位仍取 plan。
   * P31-06：plan 自身异常 → 安全单列 plan（columns=1，全 compact）；单题渲染异常 → 唯一应急出口
   * HTMLRenderer.renderEmergency（单列、纯文本题干、标准作答 input）。安全降级只有这一个入口。
   * @param {Array<Object>} questions
   * @param {Object} [options]
   * @param {Object} [gridOptions] { columns, spans, availWidth, fixed }
   *   columns：显式列数（缺省 plan 按 availWidth 动态决策，屏幕缺省 A4 718px）
   *   spans[i]：该题列跨（grid-column 值；提供时优先于 plan，print 直渲链同源形态）
   *   fixed：固定列模式（每题强制 span 1，且不透传 plan 档位/分页）
   * @returns {{ items:Array, html:string, renderOptions:Object }}
   */
  // P31-06：plan 自身异常 → 安全单列 plan（排版决策失败不阻断渲染，无消费者时可整体丢弃）
  function safeSingleColumnPlan(n) {
    var items = [];
    for (var i = 0; i < n; i++) {
      items.push({ index: i, density: 'compact', span: 1, stem: 'block', graphic: 'none', options: 'inline', break: 'auto' });
    }
    return { columns: 1, items: items };
  }

  function renderAll(questions, options, gridOptions) {
    var ro = RenderOptions.normalize(options);
    var list = Array.isArray(questions) ? questions : [];
    var g = gridOptions || {};
    // P31-04：列数与每题列跨/档位唯一决策点 = QuestionLayout.plan（先算，后渲染）
    // P31-05：经 planFor 取（同题集 + 同决策面复用渲染期缓存，print/updateCountTip 与渲染同键同值）
    var layoutPlan = null;
    try {
      if (QuestionLayout && typeof QuestionLayout.planFor === 'function') {
        layoutPlan = QuestionLayout.planFor(list, {
          mode: ro.mode,
          availWidth: g.availWidth,
          columns: g.columns,
          fixed: g.fixed
        });
      }
    } catch (e) {
      layoutPlan = safeSingleColumnPlan(list.length);
    }
    var items = [];
    for (var i = 0; i < list.length; i++) {
      var extra = {};
      var pi = layoutPlan ? layoutPlan.items[i] : null;
      // P28-UI-PRINT-WYSIWYG-01 契约保持：固定列模式不输出列跨（CSS 默认单格），列数以调用方为准
      if (pi && !g.fixed) {
        extra.span = QuestionLayout.spanToCss(pi.span);
        extra.layoutDensity = pi.density;
        extra.stem = pi.stem;
        extra.optionsMode = pi.options;
        extra.graphicGear = pi.graphic;
        extra.break = pi.break; // P31-05：分页档位（'keep' → 卡内联 page-break-inside:avoid）
      }
      if (g.spans && g.spans[i]) extra.span = g.spans[i];
      var rr;
      try {
        rr = render(list[i], ro, i, extra);
      } catch (e) {
        // P31-06：单题渲染异常 → 唯一应急出口（html-renderer.renderEmergency），禁止 catch→'' 吞题
        rr = RenderResult.create(list[i], HTMLRenderer.renderEmergency(list[i], i), '');
      }
      items.push(rr);
    }
    var html = HTMLRenderer.renderGrid(items, {
      mode: ro.mode,
      columns: layoutPlan ? layoutPlan.columns : g.columns
    });
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