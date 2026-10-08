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

  // V5.1.0：createSemanticQuestion 会把顶层 answerMode 归一为 'input'，
  // 判断题在渲染层只能以 questionType='judge' + booleanAnswer 为可靠判据（契约 SSOT）。
  function isJudge(sq) {
    var qt = sq && (sq.questionType || sq.type);
    if (qt === 'judge') return true;
    return answerModeOf(sq) === 'judge';
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
      // P31-04：选项容器输出 plan mode 类（options-inline / options-two-column，白名单外不加）
      var optModeCls = (options && PLAN_OPTIONS_RE.test(options.optionsMode))
        ? ' options-' + options.optionsMode : '';
      html += '<div class="question-options' + optModeCls + '">';
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

  // V5.1.0 判断题控件：屏幕端两个大按钮（radio 语义，value=true/false，
  // 与 AnswerValidator.parseJudgeValue 的 'true'/'false' 词表对齐）；打印端「正确（　）错误（　）」。
  function renderJudgeAnswer(index, mode) {
    if (mode === 'print') {
      return '<div class="question-answer question-answer-judge judge-print" aria-label="判断区">' +
        '<span class="judge-choose">正确（　）</span><span class="judge-choose">错误（　）</span></div>';
    }
    return '<div class="question-answer question-answer-judge" role="radiogroup" aria-label="判断对错">' +
      '<label class="judge-btn judge-btn-true"><input type="radio" class="judge-input" name="q' + index +
        '" value="true" data-index="' + index + '" autocomplete="off" aria-label="判断为正确">' +
        '<span class="judge-mark">✓</span><span class="judge-text">正确</span></label>' +
      '<label class="judge-btn judge-btn-false"><input type="radio" class="judge-input" name="q' + index +
        '" value="false" data-index="' + index + '" autocomplete="off" aria-label="判断为错误">' +
        '<span class="judge-mark">✗</span><span class="judge-text">错误</span></label>' +
      '</div>';
  }

  // P31-04：QuestionLayoutPlan 档位 class 白名单（P28-23 口径：枚举外一律不进 class 属性）。
  // 档位来源唯一：renderer.renderAll 渲染前算 QuestionLayout.plan 透传；CSS 消费在 P31-07/08 接线。
  // P31-FIX-10：旧 ro.density 用户偏好→裸 'compact' 类双轨已物理删除（全 styles/PRINT_QCSS
  // 零规则、全库零 DOM 消费，门禁 21 P28-UI-PRINTSTYLE-CLEANUP-01 早已删其 CSS 但生产方幸存）；
  // 密度档位唯一轨道=plan 透传的 density-* 前缀类。
  var PLAN_DENSITY_RE = /^(?:compact|standard|expanded)$/;
  var PLAN_STEM_RE = /^(?:inline|block)$/;
  var PLAN_OPTIONS_RE = /^(?:inline|two-column)$/;
  var PLAN_GRAPHIC_RE = /^(?:small|medium|large)$/; // none → 无 .question-graphic 容器，不输出类

  function renderAnswer(sq, index, options, mode, answerText) {
    var modePrint = mode === 'print';
    var modeVal = answerModeOf(sq);
    var html = '';
    if (isJudge(sq)) {
      return renderJudgeAnswer(index, mode);
    }
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
   * @param {Object} [options] { mode, graphic, layoutDensity, stem, optionsMode, graphicGear, span, break } —— graphic 为已生成的 <svg> 字符串；排版档位仅取自 QuestionLayoutPlan 白名单字段
   * @returns {string} 卡片 HTML
   */
  /** P28-23：SVG 注入兜底——即使来源非预期也拒绝携带脚本/事件/外联特征的图形串 */
  function graphicGuard(svg) {
    if (typeof svg !== 'string' || !svg) return '';
    if (/<script|<foreignObject|<iframe|<object\b|<embed\b|on[A-Za-z]+\s*=|url\s*\(\s*['"]?\s*javascript/i.test(svg)) return '';
    return svg;
  }

  // P28-FORM-CONTRACT-01：横向算式作答框内联由生成器声明 response.layout='inline-after-equals'
  // 决定（语义字段），不再靠题干以「= ?」结尾的正则识别（删除 INLINE_EQ_RE）。
  // 形态识别上移为声明字段；此处仅在 layout 已声明时机械剥离尾缀「= ?」（格式化辅助，
  // 非形态识别）。若题干无该尾缀（如多分支生成器的非算式分支），回落 block 布局，
  // 与旧正则未匹配时行为等价。屏幕端「？」作浅色 placeholder（虚化）；打印克隆链清空
  // value/placeholder 呈空白盒；下方独立作答行不再输出。
  var TRAILING_EQ_BLANK_RE = /\s*[=＝]\s*[？?]\s*$/;
  function inlineExpression(sq, prompt) {
    if (!sq || !sq.response || sq.response.layout !== 'inline-after-equals') return null;
    if (answerModeOf(sq) !== 'input') return null;
    if (optionsOf(sq)) return null;  // 选择题（selection.js 的 calc 选择题等）不内联
    var p = String(prompt);
    var left = p.replace(TRAILING_EQ_BLANK_RE, '');
    if (left === p) return null;  // 无「= ?」尾缀 → 回落 block（与旧正则未匹配等价）
    return left;
  }

  function render(sq, index, options) {
    options = options || {};
    var mode = options.mode || 'screen';
    var prompt = promptOf(sq);
    var graphic = graphicGuard(options.graphic);
    var answerText = sq && Array.isArray(sq.answerText) ? sq.answerText
      : (sq && sq.answer && Array.isArray(sq.answer.multiplier) ? sq.answer.multiplier : null);
    var inlineLeft = inlineExpression(sq, prompt);

    // P31-FIX-10：旧 P2.2「density=compact 追加裸 compact 类」已物理删除（零 CSS/零 DOM
    // 消费的死双轨，密度档位唯一轨道=plan 的 density-* 类）。
    // P31-04：plan 排版档位 → density-*/stem-* 类（来源为 renderAll 透传的 plan 档位，白名单外不进 class）
    var cardCls = 'question-card';
    if (PLAN_DENSITY_RE.test(options.layoutDensity)) cardCls += ' density-' + options.layoutDensity;
    if (PLAN_STEM_RE.test(options.stem)) cardCls += ' stem-' + options.stem;
    // P31-10：style-* 死 CSS 类输出已删（全 styles 三表零规则、全库零 DOM 消费，三方印证；
    // sq.style 字段本身保留，strategy 层 SSOT 不在 P31 范围）。
    // P28-UI-PRINT-WYSIWYG-01：列跨由 QuestionLayout（shared/presentation/layout.js）统一度量后经 options.span 透传（打印与预览同阈值）。
    // 白名单只允许 grid-column 两种形态，杜绝任意字符串进入 style 属性。
    // P31-05：plan.break='keep' → 卡内联不跨页分页（expanded 卡最高优先不拆页）；'auto'/缺省不输出。
    var styleParts = [];
    if (options.span && /^(?:span [1-4]|1 \/ -1)$/.test(options.span)) {
      styleParts.push('grid-column:' + options.span);
    }
    if (options.break === 'keep') {
      styleParts.push('page-break-inside:avoid;break-inside:avoid');
    }
    var spanStyle = styleParts.length ? ' style="' + styleParts.join(';') + '"' : '';
    var html = '<div class="' + cardCls + '" data-index="' + index + '"' + spanStyle + ' role="group" aria-label="第 ' + (index + 1) + ' 题">';
    // P28-UI-QNUM-GAP-01：题号与正文之间固定 4 个空格宽（&nbsp; 不折叠、打印克隆同源生效）
    html += '<div class="question-stem"><span class="num">' + (index + 1) + '</span>&nbsp;&nbsp;&nbsp;&nbsp;';
    if (inlineLeft) {
      // .eq-answer nowrap：窄列下「= 填写框」整体换行，等号与框永不分离
      html += esc(inlineLeft) + '<span class="eq-answer">&nbsp;=&nbsp;';
      if (mode === 'print') {
        html += '<span class="answer-inp answer-inp-inline answer-inp-printblank" aria-label="作答空白"></span>';
      } else {
        html += '<input type="text" class="answer-inp answer-inp-inline" placeholder="？" data-index="' + index +
          '" autocomplete="off" aria-label="第 ' + (index + 1) + ' 题 答案">';
      }
      html += '</span>';
    } else {
      html += esc(prompt);
    }
    html += '</div>';
    if (graphic) {
      // P31-04：图形档位类（plan.graphicGear：small/medium/large；none 或无档位不输出 graphic-* 类）
      var gearCls = PLAN_GRAPHIC_RE.test(options.graphicGear) ? ' graphic-' + options.graphicGear : '';
      html += '<div class="question-graphic' + gearCls + '">' + graphic + '</div>';
    }
    html += renderOptions(sq, index, options, mode, answerText);
    // P28-INLINE-ANSWER-01：横向算式作答框已内联于题干，跳过独立作答行
    if (!inlineLeft) html += renderAnswer(sq, index, options, mode, answerText);
    html += '<div class="feedback"></div>';
    html += '</div>';
    return html;
  }

  /**
   * 渲染一组题 → 网格容器 HTML。
   * P31-04：columns 由 QuestionLayout.plan 决策后传入（--grid-cols 注入，CSS .q-grid 消费）；
   * grid-auto-flow:row dense 由 plan 跨列共同构成网格执行语义（原 practice.html fitColumns 行为，
   * 渲染后二次改 DOM 已删除）。
   * @param {Array<RenderResult>} results
   * @param {Object} options { mode, columns }
   */
  function renderGrid(results, options) {
    options = options || {};
    // P28-23：columns 强制正整数（1..6），禁止任意字符串进入 class/style
    var cols = Math.floor(Number(options.columns));
    if (!isFinite(cols) || cols < 1) cols = 3;
    if (cols > 6) cols = 6;
    var html = '<div class="questions-grid q-grid cols-' + cols + '" style="--grid-cols:' + cols + ';grid-auto-flow:row dense">';
    (results || []).forEach(function (r) {
      if (r && typeof r.html === 'string') html += r.html;
      else if (r && typeof r === 'string') html += r;
    });
    html += '</div>';
    return html;
  }

  // P31-06：唯一应急渲染（renderAll 单题渲染异常时启用；不参与任何布局决策，禁止扩建为第二渲染器）。
  // 契约：单列普通卡 + 题号 + 纯文本题干 + 标准作答 input（data-index 保障答案收集/批改绑定）。
  // 图形一律不渲染，原题带图形描述符时输出文本占位。题干字段面与 layout.coreText 同源
  //（prompt/content.prompt/question.prompt/stem/q/text/question 字符串），任何形态题都不丢题干。
  function emergencyPromptOf(q) {
    if (!q) return '';
    var t = q.prompt
      || (q.content && q.content.prompt)
      || (q.question && typeof q.question === 'object' ? q.question.prompt : null)
      || q.stem
      || q.q
      || q.text
      || (typeof q.question === 'string' ? q.question : null)
      || '';
    return String(t);
  }

  function renderEmergency(q, index) {
    var hasGraphic = !!(q && (q.graphic || (q.data && q.data.graphic)));
    var html = '<div class="question-card" data-index="' + index + '" role="group" aria-label="第 ' + (index + 1) + ' 题">';
    html += '<div class="question-stem"><span class="num">' + (index + 1) + '</span>&nbsp;&nbsp;&nbsp;&nbsp;' +
      esc(emergencyPromptOf(q)) + '</div>';
    if (hasGraphic) html += '<div>（图示略）</div>';
    html += '<div class="question-answer"><input type="text" class="answer-inp" data-index="' + index +
      '" autocomplete="off" aria-label="第 ' + (index + 1) + ' 题 答案"></div>';
    html += '<div class="feedback"></div>';
    html += '</div>';
    return html;
  }

  // P31-FIX-07：renderOptions/renderAnswer/esc 仅 render()/renderEmergency 模块内部消费，
  // 外部（页面/打印/Node 测试/其他引擎）零成员访问，导出条目物理删除（函数本体保留）。
  var API = {
    render: render,
    renderGrid: renderGrid,
    renderEmergency: renderEmergency
  };

  global.HTMLRenderer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);