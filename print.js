/**
 * 统一打印模块
 * 所有页面的打印功能统一通过此模块处理
 * 用法：<script src="print.js"></script> 后调用 Print.open(container, title, options)
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
      pageMargin: '8mm 8mm'
    }
  };

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
      '.back-home', '.grade-badge', '.settings-card', '.panel.controls',
      '.actions', '.meta', '.result', '.wrong-section', '.history-box',
      '.mark-icon', '.correct-answer', '.feedback', '.reveal', '.step-hint',
      '.badge', '.timer-bar', '.controls', 'footer'
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
    var printHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + (title || '练习题') + '</title>\n' +
      originalStyles +
      '<style>\n' +
      '  /* === 打印专用覆盖（不修改原页面布局） === */\n' +
      '  @page { size: A4 portrait; margin: ' + route.pageMargin + '; }\n' +
      '  body { padding: 0 !important; margin: 0 !important; background: #fff !important; }\n' +
      '  .print-shell { width: 100%; max-width: 190mm; margin: 0 auto; box-sizing: border-box; }\n' +
      '  /* 隐藏交互元素（DOM已移除，CSS兜底） */\n' +
      '  .btn, button, .btn-row, .score-btns, .score-panel,\n' +
      '  .back-home, .grade-badge, .settings-card, .panel.controls,\n' +
      '  .actions, .meta, .result, .wrong-section, .history-box,\n' +
      '  .mark-icon, .correct-answer, .feedback, .reveal, .step-hint,\n' +
      '  .badge, .tb-feedback, .tb-think, .tb-num, .timer-bar, .controls, footer { display: none !important; }\n' +
      '  /* 避免题目跨页截断 */\n' +
      '  .question-item, .tb-item, .problem { page-break-inside: avoid; }\n' +
      '  /* 颜色保真 */\n' +
      '  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }\n' +
      '</style>\n</head>\n<body>\n' +
      '<div class="print-shell">' + clone.innerHTML + '</div>\n' +
      '</body>\n</html>';

    // 打开新窗口
    var pw = global.open('', '_blank', 'width=900,height=700');
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