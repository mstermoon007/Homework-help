/**
 * 统一打印模块（shared 核心版）
 * 所有页面的打印功能统一通过此模块处理
 * 用法：<script src="shared/print.js"></script> 后调用：
 *   Print.open(container, title, options)     — 构建打印页并唤起浏览器打印
 *   Print.preview(container, title, options)  — 页内模态层 A4 预览（与打印同一份 HTML）
 *
 * 设计原则：打印页面与预览页面排版完全一致。
 * 仅添加打印必需的少量覆盖（隐藏按钮、A4纸张、分页控制），
 * 不覆盖原页面的布局、间距、字号、颜色等样式。
 * 预览与打印共用 buildPrintHtml 的同一产物，保证两者零差异。
 */
(function (global) {
  'use strict';

  // ============ 打印路由（页面类型 → 打印配置） ============
  var PRINT_ROUTES = {
    math: {
      label: '数学口算练习',
      pageMargin: '12mm 10mm',
      beforeClone: function(clone, cols) {
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', 1fr)';
      }
    },
    pinyin: {
      label: '拼音练习',
      pageMargin: '12mm 10mm',
      beforeClone: function(clone, cols) {
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', 1fr)';
      }
    },
    word: {
      label: '数学应用题',
      pageMargin: '12mm 10mm'
    },
    makeTen: {
      label: '凑十法·平十法·破十法',
      pageMargin: '8mm 8mm',
      beforeClone: function(clone, cols) {
        // 巧算专项固定一行三题（屏幕与 A4 竖版打印一致），保证每行等宽排列
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', minmax(0, 1fr))';
      }
    },
    pinyinToChar: {
      label: '看拼音写字',
      pageMargin: '12mm 10mm',
      beforeClone: function(clone, cols) {
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', 1fr)';
      }
    },
    comprehensive: {
      label: '综合练习',
      pageMargin: '12mm 10mm',
      beforeClone: function(clone, cols) {
        var grid = clone.querySelector('.questions-grid');
        if (grid) grid.style.gridTemplateColumns = 'repeat(' + (cols || 3) + ', 1fr)';
      }
    },
    numberSense: {
      label: '数的认识',
      pageMargin: '12mm 10mm'
    },
    measurement: {
      label: '常见量换算与测量',
      pageMargin: '12mm 10mm'
    },
    geometry: {
      label: '图形的认识',
      pageMargin: '12mm 10mm'
    },
    shapes: {
      label: '图形练习',
      pageMargin: '12mm 10mm'
    },
    unitConvert: {
      label: '单位换算练习',
      pageMargin: '12mm 10mm'
    },
    alphabet: {
      label: '英语字母跟读练习',
      pageMargin: '10mm 10mm'
    }
  };

  // 文本转义：防止标题（含插件名/年级）被注入到打印页 HTML 执行脚本
  function escForPrint(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ============ 核心打印函数 ============

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
    // A4 竖版可打印宽度常数
// 计算依据：A4 纸张宽度 190mm，在 96dpi（每英寸96像素）下的像素转换
// 190mm × (96px / 25.4mm) ≈ 718.11px → 取整 718px
// 该常数确保打印层面的网格容器宽度与 A4 纸张边距(190mm)一致
// 前端(shared/print.js)与后端算法均使用该值，保证列数计算一致
var A4_PRINTABLE_PX = 718;
    var grids = clone.querySelectorAll('.questions-grid, .q-grid, .comprehensive-grid');
    if (grids.length) {
      // 列数：调用方已传(固定/预览算好)则复用；否则由 layout 统一按 DOM 估算
      var a4Cols = options.columns
        ? options.columns
        : PluginUtil.layout.gridColumnsFromDom(clone, A4_PRINTABLE_PX);
      // 通过 CSS 变量设定列数，与屏幕端保持一致
      for (var gi = 0; gi < grids.length; gi++) {
        grids[gi].style.setProperty('--grid-cols', a4Cols);
        grids[gi].style.cssText =
          'display:grid;' +
          'gap:14px 12px;' +
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

    // 构建打印页 HTML：原始样式 + 仅必要的打印覆盖
    // 使用 outerHTML 保留 #problemsArea 容器 id，使原页面对其下卡片的样式作用域
    // （如 .questions-grid .question-card 左对齐）在打印页同样生效，保证排版一致。
    var printHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      // 安全加固（修复 P1）：打印窗口禁止任何脚本执行，仅允许同源样式与内联样式、图片
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data:;">\n' +
      '<title>' + (title || '练习题') + '</title>\n' +
      originalStyles +
      '<style>\n' +
      '  /* === 打印专用覆盖 === */\n' +
      '  @page { size: A4 portrait; margin: ' + route.pageMargin + '; }\n' +
      '  html { width: 210mm; overflow-x: hidden; }\n' +
      '  body { padding: 0 !important; margin: 0 !important; background: #fff !important; width: 210mm; max-width: 100% !important; overflow-x: hidden; box-sizing: border-box; }\n' +
      '  .print-shell { width: 100% !important; max-width: 190mm !important; margin: 0 auto !important; box-sizing: border-box !important; }\n' +
      '  /* 兜底：确保卡片撑满网格列（主力已在克隆 DOM 设内联 style） */\n' +
      '  .print-shell .question-card { justify-self: stretch !important; width: 100% !important; box-sizing: border-box !important; padding: var(--card-padding-print) !important; }\n' +
      '  /* 隐藏交互元素（DOM已移除，CSS兜底） */\n' +
      '  .btn, button, .btn-row, .score-btns, .score-panel,\n' +
      '  .back-home, .settings-card, .panel.controls,\n' +
      '  .actions, .meta, .result, .wrong-section, .history-box,\n' +
      '  .mark-icon, .correct-answer, .feedback, .reveal, .step-hint,\n' +
      '  .badge, .formula-placeholder, .tb-feedback, .tb-think, .tb-num, .timer-bar, .controls, footer { display: none !important; }\n' +
      '  /* 避免题目跨页截断 */\n' +
      '  .question-item, .tb-item, .problem { page-break-inside: avoid; }\n' +
      '  /* 颜色保真 */\n' +
      '  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }\n  .scene-box svg {\n    max-width: 100%;\n    height: auto;\n  } }\n' +
      '</style>\n</head>\n<body>\n' +
      // 练习页（practice.html）已不再在题目区重复渲染内层标题，这里统一注入与屏显一致的
      // 「年级 题型（题量）」标题，确保打印页顶部仍有统一标题（样式沿用 shared/pages.css 的 .sheet-title）
      '<div class="print-shell">' +
      '<div class="sheet-title"><h2 class="sheet-title-text">' + escForPrint(title || '练习题') + '</h2></div>' +
      clone.outerHTML +
      '</div>\n' +
      '</body>\n</html>';

    return printHtml;
  }

  /** 把构建好的 HTML 写入新窗口并延迟唤起打印（open 专用出口） */
  function popupAndPrint(printHtml, title) {
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

  /**
   * 打开打印页面，排版与原页面完全一致
   * @param {string|Element} container - 内容容器选择器或DOM元素
   * @param {string} title - 打印标题
   * @param {Object} options
   *   - pageType: 页面类型（math/pinyin/word/makeTen）
   *   - columns: 列数（用于 math/pinyin）
   */
  function open(container, title, options) {
    var printHtml = buildPrintHtml(container, title, options);
    if (!printHtml) {
      global.alert('未找到打印内容区域！');
      return;
    }
    popupAndPrint(printHtml, title);
  }

  // ============ 页内 A4 预览模态层 ============

  var PV_A4_WIDTH_PX = 794;   // 210mm @96dpi
  var pvOverlay = null;       // 惰性创建的模态根节点
  var pvFrame = null;

  /** 注入一次预览模态层样式（类名带 pv- 前缀，不与业务样式冲突） */
  function ensurePreviewStyle(doc) {
    if (doc.getElementById('print-preview-style')) return;
    var st = doc.createElement('style');
    st.id = 'print-preview-style';
    st.textContent =
      '.pv-overlay{position:fixed;inset:0;z-index:3000;background:rgba(23,32,54,.62);' +
      'display:flex;flex-direction:column;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);}' +
      '.pv-toolbar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:10px 14px;' +
      'background:#fff;border-bottom:1px solid #e3e9f2;box-shadow:0 2px 10px rgba(20,40,90,.12);}' +
      '.pv-title{flex:1;font-weight:800;color:#27324a;font-size:14px;' +
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.pv-btn{cursor:pointer;border:1px solid #c9d4e6;background:#f7faff;color:#3f6fd1;' +
      'border-radius:9px;padding:8px 16px;font-size:13px;font-weight:700;transition:.15s;}' +
      '.pv-btn:hover{border-color:#5b8def;background:#eef3fb;}' +
      '.pv-btn.primary{border:none;background:linear-gradient(135deg,#5b8def,#7c5cff);color:#fff;}' +
      '.pv-btn.primary:hover{filter:brightness(1.06);}' +
      '.pv-stage{flex:1;overflow:auto;padding:18px 12px 28px;}' +
      '.pv-sheet-holder{width:' + PV_A4_WIDTH_PX + 'px;margin:0 auto;transform-origin:top center;}' +
      '.a4-sheet{width:210mm;min-height:297mm;background:#fff;box-shadow:0 10px 40px rgba(10,25,60,.35);' +
      'border-radius:2px;overflow:hidden;}';
    doc.head.appendChild(st);
  }

  /** 惰性构建模态 DOM；返回 { overlay, frame, sheetHolder } */
  function ensurePreviewDom(doc) {
    if (pvOverlay) return { overlay: pvOverlay, frame: pvFrame, holder: pvHolder };
    ensurePreviewStyle(doc);

    pvOverlay = doc.createElement('div');
    pvOverlay.className = 'pv-overlay';
    pvOverlay.hidden = true;
    pvOverlay.innerHTML =
      '<div class="pv-toolbar">' +
      '  <span class="pv-title">打印预览</span>' +
      '  <button type="button" class="pv-btn primary" data-pv="print">直接打印</button>' +
      '  <button type="button" class="pv-btn" data-pv="close">关闭预览</button>' +
      '</div>' +
      '<div class="pv-stage"><div class="pv-sheet-holder"><div class="a4-sheet">' +
      '  <iframe class="pv-frame" title="打印预览" style="display:block;width:100%;height:297mm;border:0;"></iframe>' +
      '</div></div></div>';
    doc.body.appendChild(pvOverlay);

    pvFrame = pvOverlay.querySelector('.pv-frame');
    pvHolder = pvOverlay.querySelector('.pv-sheet-holder');

    // 关闭 / 直接打印（事件委托，按钮随 innerHTML 重建也不丢）
    pvOverlay.addEventListener('click', function (ev) {
      var act = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-pv');
      if (act === 'close' || ev.target === pvOverlay) closePreview();
      if (act === 'print' && lastHtml) popupAndPrint(lastHtml, lastTitle);
    });
    // ESC 关闭
    doc.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !pvOverlay.hidden) closePreview();
    });
    // 视口变化时重算缩放
    global.addEventListener('resize', fitSheetScale);

    return { overlay: pvOverlay, frame: pvFrame, holder: pvHolder };
  }

  var pvHolder = null;
  var lastHtml = '';
  var lastTitle = '';

  /** 按视口宽度缩放 A4 纸张（小屏等比缩小，免横向滚动） */
  function fitSheetScale() {
    if (!pvOverlay || pvOverlay.hidden || !pvHolder) return;
    var stage = pvHolder.parentNode; // .pv-stage
    var sheet = pvHolder.querySelector('.a4-sheet');
    if (!sheet) return;
    var avail = stage.clientWidth - 24;
    var scale = Math.min(1, avail / PV_A4_WIDTH_PX);
    pvHolder.style.transform = scale < 1 ? 'scale(' + scale + ')' : '';
    // transform 不改变布局盒，手动压缩占位高度避免底部大空白
    pvHolder.style.height = scale < 1 ? (sheet.offsetHeight * scale) + 'px' : '';
  }

  /**
   * 页内打印预览：与 Print.open 使用同一份构建产物（buildPrintHtml），
   * 以 iframe srcdoc 呈现模拟 A4 纸张，排版与直接打印零差异。
   * @param {string|Element} container 同 Print.open
   * @param {string} title 打印标题
   * @param {Object} options 同 Print.open（pageType/columns）
   */
  function preview(container, title, options) {
    var doc = global.document;
    var html = buildPrintHtml(container, title, options);
    if (!html) {
      global.alert('未找到打印内容区域！');
      return;
    }
    lastHtml = html;
    lastTitle = title || '练习题';

    var dom = ensurePreviewDom(doc);
    dom.overlay.hidden = false;
    doc.body.style.overflow = 'hidden'; // 锁背景滚动

    dom.overlay.querySelector('.pv-title').textContent = '打印预览 · ' + lastTitle;

    // srcdoc 与打印窗口写入的是同一个字符串 —— 保证「预览 = 打印」
    pvFrame.onload = function () { fitSheetScale(); };
    pvFrame.srcdoc = html;
  }

  function closePreview() {
    if (!pvOverlay) return;
    pvOverlay.hidden = true;
    pvOverlay = null; // 重置缓存，确保下次 Preview 时重新创建 DOM 与事件监听
    global.document.body.style.overflow = '';
  }

  // ============ 导出 ============
  global.Print = {
    ROUTES: PRINT_ROUTES,
    open: open,
    preview: preview
  };

})(typeof window !== 'undefined' ? window : this);