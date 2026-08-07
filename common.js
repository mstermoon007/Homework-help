/**
 * 共享工具函数与路由
 * 用法：<script src="common.js"></script> 后即可使用 App 全局对象
 */
(function (global) {
  'use strict';

  // ============ 常量 ============
  var GRADE_NAMES = { '1':'一年级','2':'二年级','3':'三年级','4':'四年级','5':'五年级','6':'六年级' };
  var SUBJECT_NAMES = { 'math':'数学', 'chinese':'语文', 'english':'英语' };

  // ============ 路由参数 ============

  /** 从 URL 获取年级参数 */
  function getGradeParam() {
    var p = new URLSearchParams(global.location.search).get('grade');
    var valid = ['1','2','3','4','5','6'];
    return valid.indexOf(p) !== -1 ? Number(p) : 1;
  }

  /** 获取年级中文名 */
  function getGradeName(g) {
    return GRADE_NAMES[String(g)] || '一年级';
  }

  /** 获取当前页面的年级 */
  function currentGrade() {
    return getGradeParam();
  }

  /** 生成带年级参数的目标链接 */
  function buildLink(path, g) {
    var grade = g !== undefined ? g : currentGrade();
    return path + '?grade=' + encodeURIComponent(grade);
  }

  // ============ 导航栏生成 ============

  /** 生成返回按钮 + 年级标签 */
  function renderNav(backUrl, backText) {
    var url = backUrl || 'index.html';
    var text = backText || '← 返回首页';
    var grade = currentGrade();
    var gradeName = getGradeName(grade);
    return '<a href="' + url + '" class="back-home">' + text + '</a>\n' +
           '<span class="grade-badge" id="gradeBadge" style="display:inline-block;margin-left:10px;padding:4px 14px;background:rgba(255,255,255,0.95);border-radius:20px;font-size:0.85rem;font-weight:700;vertical-align:middle;">' + gradeName + '</span>';
  }

  /** 生成页面头部 */
  function renderHeader(title, subtitle, icon) {
    var grade = currentGrade();
    var gradeName = getGradeName(grade);
    var iconHtml = icon ? '<div class="logo">' + icon + '</div>' : '';
    return '<div class="page-header">\n' +
           iconHtml +
           '  <h1>' + title + '<span class="grade-badge" id="gradeBadge">' + gradeName + '</span></h1>\n' +
           '  <p>' + (subtitle || '') + '</p>\n' +
           '</div>';
  }

  // ============ 工具函数 ============

  /** 声调映射 */
  var TONE_MAP = {
    'ā':'a','á':'a','ǎ':'a','à':'a',
    'ō':'o','ó':'o','ǒ':'o','ò':'o',
    'ē':'e','é':'e','ě':'e','è':'e',
    'ī':'i','í':'i','ǐ':'i','ì':'i',
    'ū':'u','ú':'u','ǔ':'u','ù':'u',
    'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü'
  };

  /** 增强版随机整数 [min, max] */
  function randInt(min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  /** Fisher-Yates 洗牌 */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /** 标准化拼音（去声调、去空格、小写） */
  function normPY(s) {
    if (!s) return '';
    return s.toLowerCase()
      .split('').map(function(c) { return TONE_MAP[c] || c; }).join('')
      .replace(/\s+/g, '')
      .replace(/v/g, 'ü')
      .replace(/[:：]/g, '');
  }

  /** 标准化汉字（去空格） */
  function normHZ(s) {
    if (!s) return '';
    return s.replace(/\s+/g, '').trim();
  }

  /** 从数组中随机取一个元素 */
  function rand(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  // ============ 打印文件生成 ============

  /**
   * 生成打印文件：克隆页面内容，替换输入框为下划线，在新窗口打开 A4 打印页
   * 打印页面的排版与预览页面保持一致
   * @param {string|Element} container - 内容容器选择器或DOM元素
   * @param {string} title - 打印标题
   * @param {Object} options - 可选配置
   *   - keepInputs: 保留输入框（默认替换为下划线）
   *   - extraStyle: 额外CSS样式（追加到打印页）
   *   - beforePrint: 打印前回调
   */
  function openPrintPage(container, title, options) {
    options = options || {};
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
    var previewWidth = sourceEl.getBoundingClientRect().width || 760;
    var targetWidth = 760;
    var scale = Math.min(1, targetWidth / Math.max(previewWidth, 720));
    scale = Math.max(0.82, parseFloat(scale.toFixed(3)));

    // 移除不需要打印的元素
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

    // 替换输入框为下划线（保留题目结构）
    if (!options.keepInputs) {
      var inputs = clone.querySelectorAll('input');
      for (var j = 0; j < inputs.length; j++) {
        var inp = inputs[j];
        var span = global.document.createElement('span');
        span.className = 'print-blank';
        span.textContent = '________';
        span.style.cssText = 'display:inline-block;border-bottom:1.5px solid #333;min-width:60px;margin:0 4px;';
        inp.parentNode && inp.parentNode.replaceChild(span, inp);
      }
    }

    // 收集原始页面的所有样式
    var originalStyles = '';
    
    // 1. 复制 <link rel="stylesheet"> 标签
    var links = global.document.querySelectorAll('link[rel="stylesheet"]');
    for (var k = 0; k < links.length; k++) {
      originalStyles += '<link rel="stylesheet" href="' + links[k].href + '">\n';
    }
    
    // 2. 复制所有 <style> 标签内容
    var styleTags = global.document.querySelectorAll('style');
    for (var m = 0; m < styleTags.length; m++) {
      originalStyles += '<style>\n' + styleTags[m].textContent + '\n</style>\n';
    }

    // 生成时间戳
    var now = new Date();
    var ts = now.getFullYear() + '' +
      String(now.getMonth() + 1).padStart(2, '0') +
      String(now.getDate()).padStart(2, '0');

    // 构建 A4 打印页 HTML（保留原始样式 + 打印专用覆盖）
    var printHtml = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n' +
      '<meta charset="UTF-8">\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + (title || '练习题') + '</title>\n' +
      originalStyles +
      '<style>\n' +
      '  /* 打印页面专用样式 */\n' +
      '  @page { size: A4; margin: 15mm 12mm; }\n' +
      '  body { padding: 0 !important; margin: 0 !important; background: #fff !important; }\n' +
      '  .print-shell { width: 100%; max-width: 100%; margin: 0 auto; box-sizing: border-box; }\n' +
      '  .header, .nav-tabs { display: none !important; }\n' +
      '  .questions-card, .questions-card.show {\n' +
      '    box-shadow: none !important; border-radius: 0 !important;\n' +
      '    padding: 0 !important; margin: 0 !important;\n' +
      '    max-width: none !important; width: 100% !important;\n' +
      '    display: block !important;\n' +
      '  }\n' +
      '  .question-item { page-break-inside: avoid; }\n' +
      '  @media screen { body { background: #f6f7fb; padding: 12px 0; } .print-shell { transform: scale(' + scale + '); transform-origin: top center; width: calc(100% / ' + scale + '); } }\n' +
      '  .question-item.correct, .question-item.wrong {\n' +
      '    background: transparent !important; border: none !important;\n' +
      '    border-bottom: 1px dashed #ddd !important;\n' +
      '  }\n' +
      '  .user-ans-input, .answer-input {\n' +
      '    border: none !important; border-bottom: 1.5px solid #333 !important;\n' +
      '    border-radius: 0 !important; background: transparent !important;\n' +
      '    color: #333 !important;\n' +
      '  }\n' +
      '  .print-blank { display: inline-block; border-bottom: 1.5px solid #333; min-width: 60px; margin: 0 4px; }\n';

    // 页面特有样式覆盖
    if (options.extraStyle) {
      printHtml += '  ' + options.extraStyle + '\n';
    }

    printHtml += '</style>\n</head>\n<body>\n' +
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
      if (options.beforePrint) options.beforePrint(pw);
      pw.print();
    }, 500);
  }

  // ============ 导出 ============
  global.App = {
    GRADE_NAMES: GRADE_NAMES,
    SUBJECT_NAMES: SUBJECT_NAMES,
    getGradeParam: getGradeParam,
    getGradeName: getGradeName,
    currentGrade: currentGrade,
    buildLink: buildLink,
    renderNav: renderNav,
    renderHeader: renderHeader,
    randInt: randInt,
    shuffle: shuffle,
    normPY: normPY,
    normHZ: normHZ,
    rand: rand,
    TONE_MAP: TONE_MAP,
    openPrintPage: openPrintPage
  };

})(typeof window !== 'undefined' ? window : this);