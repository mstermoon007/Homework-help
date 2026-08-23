/**
 * 统一打印模块（shared 核心版）
 * 所有页面的打印功能统一通过此模块处理
 * 用法：<script src="shared/print.js"></script> 后调用 Print.open(container, title, options)
 *
 * 设计原则：打印页面与预览页面排版完全一致。
 * 仅添加打印必需的少量覆盖（隐藏按钮、A4纸张、分页控制），
 * 不覆盖原页面的布局、间距、字号、颜色等样式。
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
   * 打开打印页面，排版与原页面完全一致
   * @param {string|Element} container - 内容容器选择器或DOM元素
   * @param {string} title - 打印标题
   * @param {Object} options
   *   - pageType: 页面类型（math/pinyin/word/makeTen）
   *   - columns: 列数（用于 math/pinyin）
   */
  function open(container, title, options) {
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
      global.alert('未找到打印内容区域！');
      return;
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
    var A4_PRINTABLE_PX = 718;   // A4 竖版可打印宽度：190mm @96dpi ≈ 718px
    var grids = clone.querySelectorAll('.questions-grid, .q-grid, .comprehensive-grid');
    if (grids.length) {
      // 列数：调用方已传(固定/预览算好)则复用；否则由 layout 统一按 DOM 估算
      var a4Cols = options.columns
        ? options.columns
        : PluginUtil.layout.gridColumnsFromDom(clone, A4_PRINTABLE_PX);
      // 直接在网格元素上写内联 style（最高优先级），保证打印页卡片按 A4 宽度均分填满
      for (var gi = 0; gi < grids.length; gi++) {
        grids[gi].style.cssText =
          'display:grid;' +
          'grid-template-columns:repeat(' + a4Cols + ',minmax(0,1fr));' +
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
      '  .print-shell .question-card { justify-self: stretch !important; width: 100% !important; box-sizing: border-box !important; }\n' +
      '  /* 隐藏交互元素（DOM已移除，CSS兜底） */\n' +
      '  .btn, button, .btn-row, .score-btns, .score-panel,\n' +
      '  .back-home, .settings-card, .panel.controls,\n' +
      '  .actions, .meta, .result, .wrong-section, .history-box,\n' +
      '  .mark-icon, .correct-answer, .feedback, .reveal, .step-hint,\n' +
      '  .badge, .formula-placeholder, .tb-feedback, .tb-think, .tb-num, .timer-bar, .controls, footer { display: none !important; }\n' +
      '  /* 避免题目跨页截断 */\n' +
      '  .question-item, .tb-item, .problem { page-break-inside: avoid; }\n' +
      '  /* 颜色保真 */\n' +
      '  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }\n' +
      '</style>\n</head>\n<body>\n' +
      // 练习页（practice.html）已不再在题目区重复渲染内层标题，这里统一注入与屏显一致的
      // 「年级 题型（题量）」标题，确保打印页顶部仍有统一标题（样式沿用 shared/pages.css 的 .sheet-title）
      '<div class="print-shell">' +
      '<div class="sheet-title"><h2 class="sheet-title-text">' + escForPrint(title || '练习题') + '</h2></div>' +
      clone.outerHTML +
      '</div>\n' +
      '</body>\n</html>';

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

  // ============ 导出 ============
  global.Print = {
    ROUTES: PRINT_ROUTES,
    open: open
  };

})(typeof window !== 'undefined' ? window : this);