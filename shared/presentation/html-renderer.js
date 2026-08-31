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
    var opts = (sq && (sq.options || sq.distractors)) || null;
    if (Array.isArray(opts) && opts.length >= 2) return opts.map(function (o) {
      return (o && typeof o === 'object') ? (o.label != null ? o.label : o.value) : o;
    });
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
   * @param {Object} [options] { mode, graphic } —— graphic 为已生成的 <svg> 字符串
   * @returns {string} 卡片 HTML
   */
  function render(sq, index, options) {
    options = options || {};
    var mode = options.mode || 'screen';
    var prompt = promptOf(sq);
    var graphic = typeof options.graphic === 'string' ? options.graphic : '';
    var answerText = sq && Array.isArray(sq.answerText) ? sq.answerText
      : (sq && sq.answer && Array.isArray(sq.answer.multiplier) ? sq.answer.multiplier : null);

    var html = '<div class="question-card" data-index="' + index + '" role="group" aria-label="第 ' + (index + 1) + ' 题">';
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
    var cols = options.columns || 3;
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