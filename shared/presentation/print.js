/**
 * 统一打印模块（shared 核心版）
 * 所有页面的打印功能统一通过此模块处理
 * 用法：<script src="shared/presentation/print.js"></script> 后调用：
 *   Print.open(container, title, options)     — DOM 克隆链：构建打印页并唤起浏览器打印
 *   Print.buildFromQuestions(questions, opts) — 直渲链：题目数组 → 统一渲染器 → 打印 HTML
 *   Print.openFromQuestions(questions, opts)  — 直渲链：构建并唤起打印（session.print 主链）
 *
 * P28-UI-PRINT-WYSIWYG-01 单一真相：
 *   - 版式常量 Print.LAYOUT（A4 / 190mm / 12mm 10mm / 718px），双链与屏显预览共用
 *   - 打印文档骨架唯一来源 buildPrintDocument（CSP / @page / shell / 标题），两条链都调用
 *   - 判断题打印形态唯一来源 buildJudgePrintCss（克隆链去按钮化 / 直渲链（　）形态）
 *   - 列数 / 列跨算法唯一来源 shared/core/core.js 的 PluginUtil.layout
 *   - 屏 / 打密度差异只经 tokens.css 的 --grid-gap-print / --card-padding-print 表达
 *
 * 设计原则：打印页面与预览页面排版完全一致。
 * 仅添加打印必需的少量覆盖（隐藏按钮、A4纸张、分页控制），
 * 不覆盖原页面的布局、间距、字号、颜色等样式。
 */
(function (global) {
  'use strict';

  // ============ A4 版式常量（双链 + 屏显 A4 测量的唯一真相；契约见 docs/06-PRESENTATION.md §4） ============
  var PRINT_DPI = 96; // 屏幕/打印换算基准（CSS 像素：96px = 1in）
  var PRINT_MM = PRINT_DPI / 25.4;
  var PAGE_MARGIN = '12mm 10mm'; // 上下 12mm / 左右 10mm → 内容宽 210 - 2×10 = 190mm
  var MARGIN_MATCH = PAGE_MARGIN.match(/([\d.]+)mm\s+([\d.]+)mm/) || ['', '12', '10'];
  var PRINT_LAYOUT = {
    dpi: PRINT_DPI,
    pageWidthMm: 210,
    pageHeightMm: 297,
    pageMargin: PAGE_MARGIN,
    marginVMm: Number(MARGIN_MATCH[1]),
    marginHMm: Number(MARGIN_MATCH[2]),
    contentWidthMm: 210 - 2 * Number(MARGIN_MATCH[2]),          // 190（契约）
    printableWidthPx: Math.round((210 - 2 * Number(MARGIN_MATCH[2])) * PRINT_MM) // 190mm@96dpi ≈ 718
  };

  // 打印 token 兜底字面量：浏览器环境经 getComputedStyle 读 tokens.css 真值；
  // Node / 样式未就位时回落此表。值必须与 tokens.css 一致（renderer.test.js 契约断言锁定）。
  var PRINT_TOKEN_DEFAULTS = {
    '--grid-gap-print': '8px 6px',
    '--card-padding-print': '6px 8px'
  };

  // ============ 打印路由（页面类型 → 克隆链预处理） ============
  // P28-UI-PRINTSTYLE-CLEANUP-01：仅保留唯一在用路由 math（全库调用均传 'math'），
  // 其余 8 条零调用方路由已删除。页边距不在此配置，统一走 PRINT_LAYOUT.pageMargin。
  var PRINT_ROUTES = {
    math: {
      beforeClone: function(clone, cols) {
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', 1fr)';
      }
    }
  };

  // 打印文档统一 CSP：禁任何脚本，仅同源样式 + 内联样式、同源图片与 data 图
  var PRINT_CSP = "default-src 'none'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";

  // 文本转义：防止标题（含插件名/年级）被注入到打印页 HTML 执行脚本
  function escForPrint(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ============ 打印文档骨架（双链唯一来源） ============

  /**
   * V5.1.0 判断题打印形态（双链唯一实现）：
   * 克隆链：屏幕态 .judge-btn 大按钮去框去 ✓/✗，追加「（　）」；
   * 直渲链：html-renderer 直接输出 .judge-print「正确（　）错误（　）」，以下 .judge-print 规则承接排版。
   */
  function buildJudgePrintCss() {
    return '.question-answer-judge { display:flex; flex-wrap:wrap; gap:6px 24px; margin-top:6px; border:none; min-height:0; font-size:15px; font-weight:700; }' +
    '.judge-input { display:none; }' +
    '.judge-btn { display:inline-block; flex:none; border:none !important; border-radius:0; padding:0 !important; background:transparent !important; color:#27324a !important; font-size:15px; font-weight:700; }' +
    '.judge-btn .judge-mark { display:none; }' +
    '.judge-btn::after { content:"（　）"; }' +
    '.judge-print { gap:6px 24px; }' +
    '.judge-print .judge-choose { white-space:nowrap; letter-spacing:1px; }';
  }

  /** 双链共用基础 CSS：@page / 纸宽 / shell / 标题 / judge 形态 / 颜色保真 */
  function buildBasePrintCss() {
    return '@page { size: A4 portrait; margin: ' + PRINT_LAYOUT.pageMargin + '; }' +
    'html { width: 210mm; overflow-x: hidden; }' +
    'body { margin:0; padding: 0 !important; background: #fff !important; color:#27324a; width: 210mm; max-width: 100% !important; overflow-x: hidden; box-sizing: border-box; }' +
    '.print-sheet { width: 100%; max-width: 190mm; margin: 0 auto; box-sizing: border-box; }' +
    '.ps-title { font-size:18px; font-weight:800; text-align:center; margin:0 0 8px; }' +
    buildJudgePrintCss() +
    '@media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }';
  }

  /**
   * 构建完整打印 HTML 文档（克隆链 / 直渲链共用骨架，保证零差异）
   * @param {Object} o { title, headTags（克隆链原样收集的 link/style）, extraCss（链专属 CSS）, bodyHtml }
   * @returns {string} 完整 HTML 文档
   */
  function buildPrintDocument(o) {
    o = o || {};
    var title = o.title || '练习题';
    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<meta http-equiv="Content-Security-Policy" content="' + PRINT_CSP + '">\n' +
      '<title>' + escForPrint(title) + '</title>\n' +
      (o.headTags || '') +
      '<style>\n' + buildBasePrintCss() + '\n' + (o.extraCss || '') + '\n</style>\n</head>\n<body>\n' +
      '<div class="print-sheet">\n' +
      '<div class="ps-title">' + escForPrint(title) + '</div>\n' +
      o.bodyHtml +
      '\n</div>\n</body>\n</html>';
  }

  /** 把构建好的 HTML 写入新窗口并延迟唤起打印（open/openFromQuestions 共用出口） */
  function popupAndPrint(printHtml) {
    // 打开新窗口（按 A4 竖版比例：210mm×297mm → 约 794×1123 @96dpi）
    var pw = global.open('', '_blank', 'width=820,height=1140');
    if (!pw) {
      global.alert('弹窗被拦截，请允许本站弹窗后重试。');
      return;
    }
    pw.document.write(printHtml);
    pw.document.close();

    // 延迟打印，确保样式加载
    setTimeout(function() {
      pw.print();
    }, 500);
  }

  // ============ 核心打印函数 · DOM 克隆链 ============

  /**
   * 构建「打印/预览共用」的完整 HTML 文档（两者唯一内容来源，保证零差异）
   * @returns {string|null} 完整 HTML；container 不存在时返回 null
   */
  function buildPrintHtml(container, title, options) {
    options = options || {};
    var pageType = options.pageType || 'math';
    var columns = options.columns || 3;
    var route = PRINT_ROUTES[pageType] || PRINT_ROUTES.math;

    var sourceEl;
    if (typeof container === 'string') {
      sourceEl = global.document.querySelector(container);
    } else {
      sourceEl = container;
    }
    if (!sourceEl) {
      return null;
    }

    // 克隆内容
    var clone = sourceEl.cloneNode(true);

    // 移除不需要打印的元素（按钮、控制面板等）
    var removeSelectors = [
      '.btn', 'button', '.btn-row', '.score-btns', '.score-panel',
      '.back-home', '.settings-card', '.panel.controls',
      '.actions', '.meta', '.result', '.wrong-section', '.history-box',
      '.mark-icon', '.correct-answer', '.feedback', '.reveal', '.step-hint',
      '.badge', '.formula-placeholder', '.timer-bar', '.controls', 'footer'
    ];
    removeSelectors.forEach(function(sel) {
      var els = clone.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        els[i].parentNode && els[i].parentNode.removeChild(els[i]);
      }
    });

    // 清空输入框的值（保留输入框样式，与预览页一致）
    var inputs = clone.querySelectorAll('input');
    for (var j = 0; j < inputs.length; j++) {
      inputs[j].value = '';
      inputs[j].placeholder = '';
    }

    // 页面类型预处理（如设置列数）
    if (route.beforeClone) {
      route.beforeClone(clone, columns);
    }

    // ============ A4 自适应列数 + 强制撑满 ============
    // 与预览(practice.html)共用 PluginUtil.layout 同一套算法，保证打印页与屏幕页排版完全一致、不再漂移。
    //   - 列数：调用方已传(固定/预览算好)则复用；否则从克隆 DOM 文本按同算法估算
    //   - 每张卡片按题目长度跨列 + 撑满列宽（applySpanning 与预览 fitColumns 同逻辑）
    // A4 竖版可打印宽度：PRINT_LAYOUT.printableWidthPx（190mm@96dpi ≈ 718px，与预览同源）
    // 网格容器（q-grid：renderGeneric 降级链产出；questions-grid：统一渲染器产出）
    var grids = clone.querySelectorAll('.questions-grid, .q-grid');
    if (grids.length) {
      // 列数：调用方已传(固定/预览算好)则复用；否则由 layout 统一按 DOM 估算
      var a4Cols = options.columns
        ? options.columns
        : PluginUtil.layout.gridColumnsFromDom(clone, PRINT_LAYOUT.printableWidthPx);
      // 通过内联样式设定列数，与屏幕端保持一致
      // P28-UI-PRINT-WYSIWYG-01：--grid-cols 必须随 cssText 一起写入（先 setProperty 再赋 cssText 会被整体冲掉，
      // 导致克隆链回落到样式表默认 3 列，与屏显漂移）。
      for (var gi = 0; gi < grids.length; gi++) {
        // P1.3（Issue #1）：gap 单一来源 = tokens.css --grid-gap-print（内联 var() 带兜底，防样式链接失效）
        grids[gi].style.cssText =
          '--grid-cols:' + a4Cols + ';' +
          'display:grid;' +
          'grid-template-columns:repeat(' + a4Cols + ', minmax(0,1fr));' +
          'grid-auto-flow:row dense;' +
          'gap:var(--grid-gap-print,' + PRINT_TOKEN_DEFAULTS['--grid-gap-print'] + ');' +
          'width:100%;';
      }
      // 每张卡片按长度跨列 + 撑满列宽（与预览 fitColumns 完全一致）
      PluginUtil.layout.applySpanning(clone, a4Cols);
    }

    // 收集原始页面样式（原样复制，保证排版一致）
    var originalStyles = '';
    var links = global.document.querySelectorAll('link[rel="stylesheet"]');
    for (var k = 0; k < links.length; k++) {
      originalStyles += '<link rel="stylesheet" href="' + links[k].href + '">\n';
    }
    var styleTags = global.document.querySelectorAll('style');
    for (var m = 0; m < styleTags.length; m++) {
      originalStyles += '<style>\n' + styleTags[m].textContent + '\n</style>\n';
    }

    // 克隆链专属打印覆盖（骨架/@page/shell/judge 已由 buildBasePrintCss 统一提供）。
    // P28-23 安全边界：clone 是页面 #problemsArea 的深拷贝 DOM（已由
    // PresentationRenderer→HTMLRenderer 经安全渲染管线产出，非 raw HTML 字符串）。
    // outerHTML 仅做 DOM 序列化，不引入用户输入；打印窗口 CSP 已禁 script-src。
    var cloneCss =
      '  /* 兜底：确保卡片撑满网格列（主力已在克隆 DOM 设内联 style） */\n' +
      '  .print-sheet .question-card { justify-self: stretch !important; width: 100% !important; box-sizing: border-box !important; }\n' +
      // 自 pages.css @media print 迁入（P28-UI-PRINT-WYSIWYG-01）：克隆保留 id=#problemsArea，
      // 用与屏幕态同 id 权重的选择器压过屏幕 padding/对齐
      '  #problemsArea .questions-grid .question-card,\n' +
      '  #problemsArea .q-grid .question-card { padding: var(--card-padding-print,' + PRINT_TOKEN_DEFAULTS['--card-padding-print'] + ') !important; text-align: left !important; }\n' +
      // P28-UI-QNUM-GAP-01：打印端题号与屏显（生成页）一致——保留 22×22 灰色圆形徽章
      '  .print-sheet .question-card .num { display:inline-block; width:22px; height:22px; border-radius:50%; background:#eef0f3; color:#9aa3b2 !important; font-weight:700; font-size:12px; text-align:center; vertical-align:middle; justify-content:center; min-width:0; padding:0; box-shadow:none; }\n' +
      // P28-UI-ANSWER-LINE-REMOVE-01：克隆链打印与屏显一致——输入框下方不再保留作答横线
      '  .print-sheet .question-answer { border-bottom: none; }\n' +
      '  /* 隐藏交互元素（DOM已移除，CSS兜底） */\n' +
      '  .btn, button, .btn-row, .score-btns, .score-panel,\n' +
      '  .back-home, .settings-card, .panel.controls,\n' +
      '  .actions, .meta, .result, .wrong-section, .history-box,\n' +
      '  .mark-icon, .correct-answer, .feedback, .reveal, .step-hint,\n' +
      '  .badge, .formula-placeholder, .tb-feedback, .tb-think, .tb-num, .timer-bar, .controls, footer { display: none !important; }\n' +
      '  /* 避免题目卡跨页截断（P28-UI-PRINTSTYLE-CLEANUP-01：原 .question-item/.tb-item/.problem 为零产出死类，改指真实在产的 .question-card） */\n' +
      '  .question-card { page-break-inside: avoid; }\n' +
      // 自 pages.css @media print 迁入：M13 乘除法表静态卡片（单卡通栏 + 表格边框）
      '  #problemsArea .preview-table-card { grid-column: 1 / -1; text-align: center !important; }\n' +
      '  .preview-table { border-collapse: collapse; margin: 10px auto 2px; font-size: 13px; }\n' +
      '  .preview-table caption { font-size: 12px; color: var(--muted); margin-bottom: 6px; }\n' +
      '  .preview-table td { border: 1px solid var(--line); padding: 4px 8px; white-space: nowrap; }\n' +
      // 自 pages.css @media print 迁入：批改反馈空时不占高
      '  .question-card .feedback { min-height: 0; margin-top: 4px; }\n' +
      '  .question-card .feedback:empty { display: none; }\n';

    return buildPrintDocument({
      title: title || '练习题',
      headTags: originalStyles,
      extraCss: cloneCss,
      bodyHtml: clone.outerHTML
    });
  }

  /**
   * 打开打印页面，排版与原页面完全一致
   * @param {string|Element} container - 内容容器选择器或DOM元素
   * @param {string} title - 打印标题
   * @param {Object} options
   *   - pageType: 页面类型（唯一在用：math）
   *   - columns: 列数
   */
  function open(container, title, options) {
    var printHtml = buildPrintHtml(container, title, options);
    if (!printHtml) {
      global.alert('未找到打印内容区域！');
      return;
    }
    popupAndPrint(printHtml);
  }

  // ============ M7-R06：SemanticQuestion[] → PresentationRenderer → 打印 ============
  // 新链路不再依赖页面 DOM 克隆：题目数组直接经统一 PresentationRenderer
  // 渲染后套打印外壳，与「生成 → 渲染」主链零重渲染、零漂移。
  // 旧 Print.open（DOM 克隆）保留：practice.html 反馈重打与降级打印路径使用。
  // P28-UI-PRINTSTYLE-CLEANUP-01：页内 A4 预览模态层（Print.preview / previewFromQuestions
  // 及 pv-* 支撑函数）全库零调用方，已整体删除。

  /** 解析 PresentationRenderer / RenderOptions（浏览器全局 → Node require 回退） */
  function resolveNS(name, relPath) {
    try {
      if (typeof window !== 'undefined' && window[name]) return window[name];
    } catch (e) { /* ignore */ }
    if (typeof require === 'function') {
      try { return require(relPath); } catch (e) { /* ignore */ }
    }
    return null;
  }

  /** 解析 PluginUtil.layout（浏览器全局 → Node require core.js 回退；缺失返回 null） */
  function resolveLayout() {
    try {
      if (typeof window !== 'undefined' && window.PluginUtil && window.PluginUtil.layout) return window.PluginUtil.layout;
    } catch (e) { /* ignore */ }
    if (typeof require === 'function') {
      try { require('../core/core.js'); } catch (e) { /* ignore */ }
    }
    try {
      if (typeof globalThis !== 'undefined' && globalThis.PluginUtil && globalThis.PluginUtil.layout) {
        return globalThis.PluginUtil.layout;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  // P1.3（Issue #1）：gap/padding 单一来源 = tokens.css（打印文档自含无法带样式链接，运行时读 + 兜底字面量）。
  function cssTokenVal(name) {
    try {
      if (typeof document !== 'undefined' && document.documentElement) {
        var v = window.getComputedStyle(document.documentElement).getPropertyValue(name);
        if (v && v.trim()) return v.trim();
      }
    } catch (e) { /* Node 测试环境/无样式时回落字面量 */ }
    return PRINT_TOKEN_DEFAULTS[name];
  }

  // A4 竖版打印专用 CSS（不依赖页面自带样式，独立自足）
  // P1.1（Issue #1 [Frozen Core Fix]）：打印去卡片化 + 间距收紧——纸张上无框无底，靠间距分隔。
  // @page / body 纸宽 / shell / 标题 / judge 形态已在 buildBasePrintCss，此处仅网格与题卡。
  function buildPrintQcss(opts) {
    opts = opts || {};
    // P3.2（Issue #1）：answerRule=false 时口算/填空卷去作答虚线，由网格间距分隔（默认保留）
    var keepRule = opts.answerRule !== false;
    return 'body { font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }' +
    '.questions-grid { display:grid; gap:' + cssTokenVal('--grid-gap-print') + '; grid-template-columns:repeat(var(--grid-cols,3), minmax(0,1fr)); grid-auto-flow:row dense; }' +
    '.question-card { position:relative; padding:' + cssTokenVal('--card-padding-print') + '; page-break-inside:avoid; break-inside:avoid; box-sizing:border-box; }' +
    // P3.3（Issue #1）：无图形短卡放行跨页拆分，提高页底密度（:has 不支持时自动退化为整卡 avoid）
    '.question-card:not(:has(.question-graphic)) { page-break-inside:auto; break-inside:auto; }' +
    '.question-stem { font-size:15px; line-height:1.5; font-weight:600; }' +
    '.question-stem .num { display:inline-block; width:22px; height:22px; border-radius:50%; background:#eef0f3; color:#9aa3b2; font-weight:700; font-size:12px; text-align:center; vertical-align:middle; }' +
    '.question-graphic { margin:6px 0 4px; text-align:center; }' +
    '.question-graphic svg { max-width:100%; height:auto; }' +
    '.question-options { display:flex; flex-wrap:wrap; gap:6px 14px; margin-top:8px; font-size:15px; }' +
    '.question-options .option-letter { display:inline-block; min-width:20px; font-weight:700; color:#7c5cff; margin-right:4px; }' +
    '.question-answer { margin-top:6px; min-height:20px;' + (keepRule ? ' border-bottom:1px dashed #b9c6de;' : '') + ' }' +
    '.question-answer-print { min-height:20px; }' +
    // P28-INLINE-ANSWER-01：横向算式等号后空白盒（直渲 print 模式，与屏幕输入框等宽等高，无问号）
    '.eq-answer { white-space:nowrap; }' +
    '.answer-inp-inline { display:inline-block; width:72px; height:30px; margin-left:2px; vertical-align:middle; box-sizing:border-box; }' +
    '.answer-inp-printblank { border:2px dashed #c9d4e6; border-radius:7px; background:#fafbff; }' +
    '.feedback { display:none; }';
  }

  /**
   * 直接由 SemanticQuestion[]（或兼容 Legacy Question）构建打印页完整 HTML。
   * 列数 / 每题列跨与屏显预览同源：PluginUtil.layout 按 PRINT_LAYOUT.printableWidthPx 计算。
   * @param {Array<Object>} questions
   * @param {Object} [options] { title, columns（显式列数，缺省按 718px 动态计算）, fixed（true=固定列数不做列跨）, answerRule, renderOptions }
   * @returns {string|null} 完整 HTML
   */
  function buildFromQuestions(questions, options) {
    options = options || {};
    var title = options.title || '练习题';
    var PR = resolveNS('PresentationRenderer', './renderer.js');
    if (!PR || !Array.isArray(questions) || !questions.length) return null;
    var RO = resolveNS('RenderOptions', './render-options.js');
    var ro = RO ? RO.normalize(options.renderOptions, 'print')
      : Object.assign({ mode: 'print', paper: 'A4', density: 'compact' }, options.renderOptions || {});

    // 列数：调用方显式传入（session 已按固定 meta 或 718px 算好）则复用；
    // 否则本处按 A4 可打印宽度走 layout 同一算法；layout 缺失（极端环境）回落 3 列。
    var layout = resolveLayout();
    var columns = options.columns || 3;
    if (!options.columns && layout) {
      columns = layout.calcOptimalCols({ questions: questions }, PRINT_LAYOUT.printableWidthPx);
    }
    // 列跨：与预览 fitColumns 同一阈值（spanForLength：≥50 通栏 / ≥26 半宽）；固定列数模式不跨列。
    var spans = null;
    if (layout && !options.fixed) {
      spans = questions.map(function (q, i) {
        return layout.spanForLength(layout.renderLen(q, i), columns) || 'span 1';
      });
    }

    var all;
    try {
      all = PR.renderAll(questions, ro, { columns: columns, spans: spans });
    } catch (e) {
      // FINAL-72：禁止 catch 吞错——保留原始错误诊断，再回落 null（调用方 alert 兜底）
      console.warn('[Print] buildFromQuestions 渲染失败：', e);
      return null;
    }
    // P3.2（Issue #1）：作答线按题型自适应——含书写类（应用/开放/作图/简答）保留虚线，纯口算/填空去掉；
    // options.answerRule 可显式覆盖。
    var hasWrite = false;
    for (var wi = 0; wi < questions.length && !hasWrite; wi++) {
      var wt = String(questions[wi].type || questions[wi].questionType || '');
      if (/apply|word|open|draw|measure|answer|compose/.test(wt)) hasWrite = true;
    }
    var answerRule = options.answerRule != null ? !!options.answerRule : hasWrite;
    return buildPrintDocument({
      title: title,
      extraCss: buildPrintQcss({ answerRule: answerRule }),
      bodyHtml: all.html
    });
  }

  /** 打开新窗口直接打印 SemanticQuestion 数组 */
  function openFromQuestions(questions, options) {
    var html = buildFromQuestions(questions, options);
    if (!html) {
      global.alert('无法构建打印内容（空题或渲染器不可用）。');
      return;
    }
    popupAndPrint(html);
  }

  // ============ 导出 ============
  global.Print = {
    LAYOUT: PRINT_LAYOUT,
    TOKEN_DEFAULTS: PRINT_TOKEN_DEFAULTS,
    ROUTES: PRINT_ROUTES,
    open: open,
    buildPrintDocument: buildPrintDocument,
    buildJudgePrintCss: buildJudgePrintCss,
    buildFromQuestions: buildFromQuestions,
    openFromQuestions: openFromQuestions
  };

})(typeof window !== 'undefined' ? window : this);
