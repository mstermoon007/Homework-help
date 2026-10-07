'use strict';
/**
 * shared/presentation/layout.js — P31-02 题目排版唯一 SSOT
 *
 * 从 shared/core/core.js 物理迁入（只搬家，行为零变化）：屏幕预览（practice.html）
 * 与打印（print.js 克隆链 / 直渲链）共用同一套列数 / 列跨算法，避免双份代码漂移。
 * 浏览器全局 QuestionLayout；Node 经 module.exports 使用。
 *
 * 原则：仅用「题目本身」(算式/问句)决定布局，hint 是辅助信息、自动换行不撑宽。
 *   ① plan → itemFor 结构特征决策表 → {columns, items[]}（P31-03 起唯一决策入口）
 *   ② renderer.renderAll 渲染前算 plan 并透传 HTML（P31-04 起渲染后不再改 DOM）
 *   ③ planFor 按题集对象缓存 plan（P31-05 起屏/打/克隆三链唯一取数入口；
 *     gridColumnsFromDom/applySpanning 克隆 DOM 二次度量已物理删除，克隆链采信渲染期注入的内联样式）
 *
 * P31-03 起在本文件内演进为结构特征驱动的 plan() 决策表（字符长度降级为信号之一）。
 */
(function (global) {
  var GAP = 12;             // 网格列间隙(px)
  var CN_W = 14, EN_W = 9;  // 中文字宽 / 英文数字字宽(px @96dpi)

  /** 取题目核心文本（仅算式/问句，不含 hint/input/序号）。
   *  q.prompt = SemanticQuestion 题干字段（打印直渲链与屏显预览必须同源度量，P28-UI-PRINT-WYSIWYG-01） */
  function coreText(q) {
    // P28-UI-PRINT-WYSIWYG-01：与 HTMLRenderer.promptOf 同源——SemanticQuestion 题干可能位于
    // prompt / content.prompt / question.prompt（对象）/ stem；legacy 位于 q / text / question（字符串）。
    // 度量字段缺漏会导致打印列跨全部漏判（屏显走 renderable 对象有 text，打印走原始 DTO 只有 content.prompt）。
    if (!q) return '';
    var t = q.prompt
      || (q.content && q.content.prompt)
      || (q.question && typeof q.question === 'object' ? q.question.prompt : null)
      || q.stem
      || q.q
      || q.text
      || (typeof q.question === 'string' ? q.question : null)
      || '';
    return String(t).trim();
  }

  /** 度量题目核心文本长度（用于跨列判定；图形/多输入额外占宽） */
  function renderLen(q, i) {
    var txt = coreText(q);
    var score = txt.length;
    try {
      var h = (typeof q.render === 'function') ? q.render(i) : '';
      if (h.indexOf('<svg') !== -1) score += 8;
      if (h.indexOf('combine-inp') !== -1) score += 8;
      if (h.indexOf('scene-box') !== -1) score += 10;
      // SemanticQuestion 无 render 函数：图形描述符在 q.graphic / q.data.graphic
      if (!h && (q.graphic || (q.data && q.data.graphic))) score += 8;
    } catch (e) { /* ignore */ }
    return score;
  }

  /** 估算单卡最小渲染宽度(px)：仅核心文本 + 输入框 + 图形；hint 不参与宽度决策 */
  function estimateCardWidth(q, idx) {
    var w = 0;
    var txt = coreText(q);
    var cn = (txt.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    var en = txt.length - cn;
    w += cn * CN_W + en * EN_W;
    try {
      var h = (typeof q.render === 'function') ? q.render(idx) : '';
      if (h.indexOf('combine-inp') !== -1) w += 96 * 3;
      else if (q.inputCount && q.inputCount > 1) w += 96 * q.inputCount;
      else if (q.type === 'multi' || (q.answer && Array.isArray(q.answer))) w += 96 * 2;
      else w += 96;
      if (h.indexOf('<svg') !== -1 || h.indexOf('<canvas') !== -1 || h.indexOf('scene-box') !== -1) w += 120;
    } catch (e) { w += 96; }
    w += 32 + 16; // 卡片内边距 + 安全边距
    return Math.max(w, 140);
  }

  /** 动态最优列数：按中位数卡宽计算 [1,4]（P31-10：meta.columns 死数据面已删，生产零写入方） */
  function calcOptimalCols(set, availWidth) {
    var qs = set.questions;
    if (!qs || !qs.length) return 3;
    var widths = qs.map(function (q, i) { return estimateCardWidth(q, i); });
    widths.sort(function (a, b) { return a - b; });
    var medianW = widths[Math.floor(widths.length / 2)];
    var colNeed = medianW + GAP;
    var rawCols = Math.floor((availWidth + GAP) / colNeed);
    return Math.max(1, Math.min(4, rawCols));
  }

  // ============ P31-03：结构特征驱动的 QuestionLayoutPlan ============
  // 信号只取题目既有字段（questionType/style/prompt 长度/options/graphic 描述符/response.layout），
  // 字符长度降级为信号之一。阈值与档位全部来自 P31-01 真实链 516 题取样证据（见任务书证据③）：
  //   - calc/fill/judge 单作答行题：长度不再驱动跨列（F 桶：L42/L51/L61 被误拉宽）
  //   - geometry 或中/大图档：一律 expanded/full（A/B 桶：带图短题被压 span1）
  //   - choice/classify 表达式选项：two-column（G 桶：4×7 字选项任折）；≥8 字选项全库仅 1 例，不做 single-column
  //   - style=story / 长应用（≥50）：expanded/full；多输入题 0 例，不以多空触发
  //   - response.layout=inline-after-equals：stem=inline（H 桶：32/93 真实信号）
  var PLAN_DEFAULT_AVAIL_WIDTH = 718; // A4 190mm@96dpi，与 Print.LAYOUT.printableWidthPx 同源
  var STD_SPAN2_LEN = 26;            // 标准档（choice/classify/apply/未知 DTO）半宽起点
  var STD_FULL_LEN = 50;             // 标准档通栏起点
  var OPT_TWOCOL_MIN = 6;            // 选项最长 ≥6 字且 ≥3 项 → two-column（G 桶证据：4×7）
  var OPT_TWOCOL_COUNT = 3;

  /** 图形档位：描述符无顶层 size（P31-01 证据 I），由 type/role/subtype/params 确定性映射。
   *  diagram(brace/calculation-support) → small；number-position 网格/立体（含 r+height）→ large；
   *  其余 geometry（方/矩/三角/圆等）→ medium。Legacy 无描述符但 render 出 svg → medium。 */
  function graphicGear(q, i) {
    var d = q.graphic || (q.data && q.data.graphic) || null;
    if (d) {
      var p = d.params || {};
      if (d.type === 'diagram') return 'small';
      if (d.role === 'number-position' || p.gridSize != null) return 'large';
      if (d.subtype === 'cylinder' || d.subtype === 'cone' || d.subtype === 'sphere' ||
          d.subtype === 'cuboid' || (p.r != null && p.height != null)) return 'large';
      if (d.type === 'geometry') return 'medium';
      return 'small';
    }
    try {
      if (typeof q.render === 'function' && String(q.render(i) || '').indexOf('<svg') !== -1) return 'medium';
    } catch (e) { /* ignore */ }
    return 'none';
  }

  /** 选项元信息：兼容 SemanticQuestion 与 Legacy 字段面；返回 {n, max, two} */
  function optionMeta(q) {
    var list = null;
    var candidates = [q.options, q.distractors, q.data && q.data.options, q.data && q.data.distractors];
    for (var c = 0; c < candidates.length; c++) {
      if (Array.isArray(candidates[c]) && candidates[c].length >= 2) { list = candidates[c]; break; }
    }
    if (!list) return null;
    var max = 0;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      var label = (o && typeof o === 'object') ? (o.label != null ? o.label : o.value) : o;
      var n = String(label == null ? '' : label).length;
      if (n > max) max = n;
    }
    return { n: list.length, max: max, two: list.length >= OPT_TWOCOL_COUNT && max >= OPT_TWOCOL_MIN };
  }

  /** span 档位（1|2|full）→ CSS grid-column 值（html-renderer span 白名单同源） */
  function spanToCss(span) {
    if (span === 'full') return '1 / -1';
    if (span === 2) return 'span 2';
    return 'span 1';
  }

  /** 单题决策：产出 QuestionLayoutPlan item（纯函数，无 DOM）。
   *  columns 为当前网格列数（固定列模式由调用方强制 span=1，不在此处理）。 */
  function itemFor(q, i, columns) {
    var len = renderLen(q, i);
    var type = String(q.questionType || q.type || '').toLowerCase();
    var gear = graphicGear(q, i);
    var opts = optionMeta(q);
    var inlineAns = !!(q.response && q.response.layout === 'inline-after-equals');
    var item = {
      index: i,
      density: 'standard',
      span: 1,
      stem: inlineAns ? 'inline' : 'block',
      graphic: gear,
      options: opts && opts.two ? 'two-column' : 'inline',
      break: 'auto'
    };

    // ① 几何题 / 中·大图档 → expanded 通栏（A、B、I 桶）
    if (type === 'geometry' || gear === 'medium' || gear === 'large') {
      item.density = 'expanded';
      item.span = 'full';
      item.break = 'keep';
      return item;
    }
    // ② story / 长应用题 → expanded 通栏
    if (q.style === 'story' || (type === 'apply' && len >= STD_FULL_LEN)) {
      item.density = 'expanded';
      item.span = 'full';
      item.break = 'keep';
      return item;
    }
    // ③ choice/classify → standard；选项两列档；题干中长可跨 2 列
    if (type === 'choice' || type === 'classify') {
      item.density = 'standard';
      item.span = len >= STD_FULL_LEN ? 'full' : (len >= STD_SPAN2_LEN ? Math.min(2, columns) : 1);
      return item;
    }
    // ④ calc/fill/judge 单作答行 → compact；长度永不驱动跨列（F 桶纠正）
    if (type === 'calc' || type === 'fill' || type === 'judge') {
      item.density = 'compact';
      item.span = 1;
      return item;
    }
    // ⑤ apply（非长题）与未知/Legacy DTO：保留长度档位（直渲打印 DTO 契约：26 半宽 / 50 通栏）
    item.span = len >= STD_FULL_LEN ? 'full' : (len >= STD_SPAN2_LEN ? Math.min(2, columns) : 1);
    return item;
  }

  /**
   * 题目集排版决策（P31 唯一排版中心产物，纯函数 / Node 与浏览器一致）。
   * @param {Array|Object} questions SQ[] / Legacy[]，或 {questions, meta}
   * @param {Object} [ctx] { mode:'screen'|'print', availWidth, columns（显式列数）, fixed（固定列模式） }
   * @returns {{columns:number, items:Array}} items 字段：
   *   index / density(compact|standard|expanded) / span(1|2|full) /
   *   stem(inline|block) / graphic(none|small|medium|large) /
   *   options(inline|two-column) / break(auto|keep)
   * LayoutPlan 仅 presentation 内部产物，不进入 SemanticQuestion/RenderResult 契约。
   */
  function plan(questions, ctx) {
    ctx = ctx || {};
    var qs = Array.isArray(questions) ? questions : ((questions && questions.questions) || []);
    var fixed = ctx.fixed === true;
    var columns = ctx.columns
      || calcOptimalCols({ questions: qs }, ctx.availWidth || PLAN_DEFAULT_AVAIL_WIDTH);
    var items = qs.map(function (q, i) {
      var item = itemFor(q, i, columns);
      if (fixed) item.span = 1; // 固定列模式：不跨列（与 fitColumns 历史行为一致）
      return item;
    });
    return { columns: columns, items: items };
  }

  // ============ P31-05：plan 结果缓存（presentation 内部产物，不进契约） ============
  // 键 = 题集对象引用（WeakMap，随题集生命周期回收）+ ctx 决策面指纹（mode/availWidth/columns/fixed）。
  // 同一题集 + 同一决策面 → 复用渲染期结果；页面（updateCountTip）与 PracticeSession（print）经 planFor 取数，
  // 与渲染期 renderAll 同键同值，杜绝三处各自估算漂移。（P31-10：指纹删 meta.columns 死数据面项）
  var planCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

  function planFingerprint(ctx) {
    return [ctx.mode || '', ctx.availWidth || '', ctx.columns || '', ctx.fixed === true ? 1 : 0].join('|');
  }

  /** 带缓存的 plan 入口（签名与 plan 一致；同题集对象 + 同决策面返回同一结果对象） */
  function planFor(questions, ctx) {
    ctx = ctx || {};
    var fp = planFingerprint(ctx);
    var cached = (planCache && questions && typeof questions === 'object') ? planCache.get(questions) : null;
    if (cached && cached.fp === fp) return cached.plan;
    var p = plan(questions, ctx);
    if (planCache && questions && typeof questions === 'object') planCache.set(questions, { fp: fp, plan: p });
    return p;
  }

  // P31-FIX-07：只保留真实外部消费面（renderer/print/practice.html/契约测试）。
  // GAP/estimateCardWidth/calcOptimalCols/itemFor 仅本模块 plan 决策链内部消费，
  // 全库零外部访问（含 UMD 全局/require/页面/测试），导出条目物理删除（函数本体保留）。
  var Layout = {
    // 度量（coreText/renderLen 同时是 renderer.test 契约面）
    coreText: coreText,
    renderLen: renderLen,
    // P31-03 排版决策中心
    plan: plan,
    spanToCss: spanToCss,
    graphicGear: graphicGear,
    optionMeta: optionMeta,
    // P31-05 plan 缓存取数入口（屏 / 打 / 克隆三链同源）
    planFor: planFor
  };

  global.QuestionLayout = Layout;
  if (typeof module !== 'undefined' && module.exports) module.exports = Layout;
  return Layout;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
