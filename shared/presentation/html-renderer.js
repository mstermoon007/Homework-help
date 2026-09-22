/**
 * shared/presentation/html-renderer.js — M7-R02 HTML Renderer
 *
 * 把 SemanticQuestion 渲染为语义化卡片 HTML（纯字符串，浏览器 / Node 通用）。
 * 卡片结构统一（R02 命名）：
 *   .question-card       卡片容器（role=group + aria-label）
 *   .question-graphic    图形区（SVG 由 SVG Renderer 产出后注入，无图则省略）
 *   .question-stem       题干（含题号 .num）
 *   .question-options    选项（choice 题）
 *   .question-answer     作答区（input 文本作答 / read-aloud 空 / print 留空）
 *
 * 约束：
 *   - 只依赖题目的语义字段，不接触 plugin/generator/difficulty；
 *   - 浏览器与 Node 输出一致（不依赖 DOM）；
 *   - 所有用户可输入文本一律转义，防注入。
 */
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function promptOf(sq) {
    if (!sq) return '';
    if (sq.prompt) return sq.prompt;
    if (sq.content && sq.content.prompt) return sq.content.prompt;
    if (sq.question && sq.question.prompt) return sq.question.prompt;
    if (sq.stem) return sq.stem;
    return '';
  }

  function answerModeOf(sq) {
    var m = sq && sq.answerMode;
    if (m) return m;
    if (sq && sq.question && sq.question.answerMode) return sq.question.answerMode;
    return 'input';
  }

  function optionsOf(sq) {
    // P28-48：候选必须逐个做「非空数组」判定。归一化工厂会给每题注入 distractors:[]，
    // 旧写法 sq.options || sq.distractors || sq.data.options 会被空数组（truthy）短路，
    // 导致 data.options 中真实存在的选择题选项永远渲染不出来。
    if (!sq) return null;
    var cands = [
      sq.options,
      sq.distractors,
      sq.data ? sq.data.options : null,
      sq.data ? sq.data.distractors : null
    ];
    for (var i = 0; i < cands.length; i++) {
      var opts = cands[i];
      if (Array.isArray(opts) && opts.length >= 2) {
        return opts.map(function (o) {
          return (o && typeof o === 'object') ? (o.label != null ? o.label : o.value) : o;
        });
      }
    }
    return null;
  }

  function renderOptions(sq, index, options, mode, answerText) {
    var opts = optionsOf(sq);
    var modePrint = mode === 'print';
    var html = '';
    if (opts) {
      html += '<div class="question-options">';
      for (var i = 0; i < opts.length; i++) {
        var letter = String.fromCharCode(65 + i);
        if (modePrint) {
          html += '<span class="option option-' + mode + '" data-oi="' + i + '">' +
            '<span class="option-letter">' + letter + '</span>' +
            '<span class="option-text">' + esc(opts[i]) + '</span></span>';
        } else {
          html += '<label class="option"><input type="radio" class="option-input" ' +
            'name="q' + index + '" value="' + esc(String(opts[i])) + '" data-index="' + index +
            '" data-oi="' + i + '">' +
            '<span class="option-letter">' + letter + '</span>' +
            '<span class="option-text">' + esc(opts[i]) + '</span></label>';
        }
      }
      html += '</div>';
    }
    return html;
  }

  function renderAnswer(sq, index, options, mode, answerText) {
    var modePrint = mode === 'print';
    var modeVal = answerModeOf(sq);
    var html = '';
    if (modePrint) {
      // 打印留空作答，不输出可输入框（交互交给屏幕模式）
      html += '<div class="question-answer question-answer-' + mode + '" aria-label="作答区"></div>';
      return html;
    }
    if (modeVal === 'read-aloud') return html;
    if (modeVal === 'choice') {
      // 选项内联，作答区仅提示
      html += '<div class="question-answer question-answer-choice"><span class="answer-hint"></span></div>';
      return html;
    }
    if (modeVal === 'multi') {
      var blanks = answerText && answerText.length ? answerText.length : 1;
      html += '<div class="question-answer question-answer-multi">';
      for (var b = 0; b < blanks; b++) {
        html += '<input type="text" class="answer-inp" data-index="' + index + '" data-field="' + b +
          '" autocomplete="off" aria-label="第 ' + (index + 1) + ' 题 第 ' + (b + 1) + ' 空答案">';
      }
      html += '</div>';
      return html;
    }
    html += '<div class="question-answer"><input type="text" class="answer-inp" data-index="' + index +
      '" autocomplete="off" aria-label="第 ' + (index + 1) + ' 题 答案"></div>';
    return html;
  }

  /**
   * 渲染单题卡片。
   * @param {Object} sq SemanticQuestion
   * @param {number} index 题号（0 基）
   * @param {Object} [options] { mode, graphic, density } —— graphic 为已生成的 <svg> 字符串；density=compact 追加紧凑类
   * @returns {string} 卡片 HTML
   */
  /** P28-23：SVG 注入兜底——即使来源非预期也拒绝携带脚本/事件/外联特征的图形串 */
  function graphicGuard(svg) {
    if (typeof svg !== 'string' || !svg) return '';
    if (/<script|<foreignObject|<iframe|<object\b|<embed\b|on[A-Za-z]+\s*=|url\s*\(\s*['"]?\s*javascript/i.test(svg)) return '';
    return svg;
  }

  function render(sq, index, options) {
    options = options || {};
    var mode = options.mode || 'screen';
    var prompt = promptOf(sq);
    var graphic = graphicGuard(options.graphic);
    var answerText = sq && Array.isArray(sq.answerText) ? sq.answerText
      : (sq && sq.answer && Array.isArray(sq.answer.multiplier) ? sq.answer.multiplier : null);

    // P2.2（Issue #1 延伸）：density=compact 追加 compact 类（仅 class，卡内结构不变，Node/浏览器输出一致）
    var cardCls = 'question-card' + (options.density === 'compact' ? ' compact' : '');
    // 生成层统筹：固定样式类（style-{calc|fill|choice|judge|story|shape|open}），供页面固定样式呈现。
    // P28-23：样式 token 白名单（仅小写字母/数字/连字符），非白名单不进入 class 属性。
    if (sq && typeof sq.style === 'string' && /^[a-z0-9-]+$/.test(sq.style)) cardCls += ' style-' + sq.style;
    var html = '<div class="' + cardCls + '" data-index="' + index + '" role="group" aria-label="第 ' + (index + 1) + ' 题">';
    html += '<div class="question-stem"><span class="num">' + (index + 1) + '</span>' + esc(prompt) + '</div>';
    if (graphic) {
      html += '<div class="question-graphic">' + graphic + '</div>';
    }
    html += renderOptions(sq, index, options, mode, answerText);
    html += renderAnswer(sq, index, options, mode, answerText);
    html += '<div class="feedback"></div>';
    html += '</div>';
    return html;
  }

  /**
   * 渲染一组题 → 网格容器 HTML。
   * @param {Array<RenderResult>} results
   * @param {Object} options { mode, columns }
   */
  function renderGrid(results, options) {
    options = options || {};
    // P28-23：columns 强制正整数（1..6），禁止任意字符串进入 class/style
    var cols = Math.floor(Number(options.columns));
    if (!isFinite(cols) || cols < 1) cols = 3;
    if (cols > 6) cols = 6;
    var html = '<div class="questions-grid q-grid cols-' + cols + '" style="--grid-cols:' + cols + '">';
    (results || []).forEach(function (r, i) {
      if (r && typeof r.html === 'string') html += r.html;
      else if (r && typeof r === 'string') html += r;
    });
    html += '</div>';
    return html;
  }

  var API = {
    render: render,
    renderGrid: renderGrid,
    renderOptions: renderOptions,
    renderAnswer: renderAnswer,
    esc: esc
  };

  global.HTMLRenderer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);