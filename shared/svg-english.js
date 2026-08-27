/**
 * shared/svg-english.js — 英语科目 SVG 生成器（SVGGenerators.en）
 *
 * 任务9 落地：基于 shared/svg-core.js 的 SVGUtil 构造英语书写类图形，
 * 浏览器 / Node 双环境可用，输出即完整 <svg> 字符串。
 *
 * API：
 *   letterWriting(letter, letterCase) 单字母四线三格书写；letterCase: 'upper' | 'lower'，
 *                                     省略时按字母自身大小写推断
 *   letterPair(letter)                大小写同框配对卡（上格大写 + 中格小写）
 *   letterStroke(letter, letterCase)  笔顺示意卡：描红虚线底稿 + 笔画数徽标 +
 *                                     起笔方向箭头（大写；小写仅描红）
 *   wordCard(word, phonetic)          单词卡片：单词 + 音标（可省）+ 四线三格抄写区
 *   fourLineWriting(text)             句子四线三格抄写条（≤ 28 字符）
 *
 * 约定（与 svg-chinese 一致）：
 *   - 无效参数一律返回 null，由调用方决定降级展示；
 *   - 颜色使用字面量常量（SVG 表现属性豁免令牌规则）；
 *   - 四线格坐标：y=[22,44,66,88]，大写占上两格（基线第三线），小写主体居中格。
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg-english.js 依赖 shared/svg-core.js（SVGUtil），请先加载');

  // ============ 常量 ============
  var INK = '#27324a';            // 主笔色
  var MUTED = '#7a879c';          // 音标次级色
  var GRID_FRAME = '#5a6f94';     // 卡片外框
  var SERIF = "Georgia,'Times New Roman',serif";

  var CASE_UPPER = /^(upper|uppercase|u)$/i;
  var CASE_LOWER = /^(lower|lowercase|l)$/i;
  var WORD_RE = /^[a-zA-Z][a-zA-Z'-]{0,11}$/;

  /** 任务13：横线颜色经 style 属性消费 tokens.css 变量（SVG 表现属性不支持 var()） */
  function gridLineStyled(x1, y1, x2, y2, cssVar, sw) {
    return U.svgElement('line', { x1: x1, y1: y1, x2: x2, y2: y2,
      style: 'stroke:var(' + cssVar + ');stroke-width:' + sw });
  }

  /** 四线三格横线组：x 从 x1 到 x2；第三线（基线）用深色令牌且略粗；带 svg-grid-line 类（打印变浅） */
  function fourLines(inner, x1, x2, topY, gap) {
    for (var i = 0; i < 4; i++) {
      var ln = gridLineStyled(x1, topY + i * gap, x2, topY + i * gap,
        i === 2 ? '--grid-fourline-baseline' : '--grid-fourline-line',
        i === 2 ? 1.8 : 1.3);
      // 注入 svg-grid-line 类（svgWrap printMode 下透明度降低）
      inner += ln.replace('<line ', '<line class="svg-grid-line" ');
    }
    return inner;
  }

  /** 单个英文字母校验 */
  function isLetter(ch) {
    return typeof ch === 'string' && ch.length === 1 && /[a-zA-Z]/.test(ch);
  }

  // ============ 单字母四线三格书写 ============
  /**
   * @param {string} letter 单个英文字母
   * @param {string} [letterCase] 'upper' | 'lower'；省略时按字母大小写推断
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function letterWriting(letter, letterCase) {
    if (!isLetter(letter)) return null;
    var isUpper;
    if (letterCase == null || letterCase === '') {
      isUpper = letter === letter.toUpperCase();
    } else if (CASE_UPPER.test(letterCase)) {
      isUpper = true;
    } else if (CASE_LOWER.test(letterCase)) {
      isUpper = false;
    } else {
      return null;
    }
    var glyph = isUpper ? letter.toUpperCase() : letter.toLowerCase();
    var w = 140;
    var inner = fourLines('', 14, w - 14, 22, 22);
    // 大写占上两格：基线在第三线；小写主体居中格：同一基线、字号略小
    inner += U.svgText(70, 66, glyph,
      { fontSize: isUpper ? 46 : 38, fontFamily: SERIF, fill: INK, fontWeight: 'bold' });
    return U.svgWrap(inner, { width: w, height: 110 });
  }

  // ============ 单词卡片 ============
  /**
   * @param {string} word 单词（字母开头，可含 '-，长度 ≤ 12）
   * @param {string} [phonetic] 音标（通常含斜杠，如 '/bʊk/'；≤ 26 字符；空串视为无音标）
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function wordCard(word, phonetic) {
    if (typeof word !== 'string' || !WORD_RE.test(word)) return null;
    var pho = null;
    if (phonetic != null && phonetic !== '') {
      if (typeof phonetic !== 'string' || phonetic.length > 26) return null;
      pho = phonetic;
    }
    var w = Math.max(240, 120 + word.length * 26);
    var inner = U.svgRect(20, 16, w - 40, 132, { fill: '#ffffff', stroke: GRID_FRAME, strokeWidth: 2, rx: 10 });
    inner += U.svgText(w / 2, 60, word, { fontSize: 42, fontFamily: SERIF, fill: INK, fontWeight: 'bold' });
    if (pho) {
      inner += U.svgText(w / 2, 88, pho, { fontSize: 19, fontFamily: SERIF, fill: MUTED });
    }
    // 卡片下部四线三格抄写区
    inner = fourLines(inner, 34, w - 34, 104, 15);
    return U.svgWrap(inner, { width: w, height: 162 });
  }

  // ============ 句子四线三格抄写 ============
  var SENT_RE = /^[A-Za-z0-9 ,.'!?;:\-]+$/;

  /**
   * @param {string} text 英文句子（≤ 28 字符，字母数字与常用标点）
   * @returns {string|null} 完整 <svg>；空串/非字符串/超长/非法字符返回 null
   */
  function fourLineWriting(text) {
    if (typeof text !== 'string') return null;
    var s = text.trim();
    if (!s || s.length > 28 || !SENT_RE.test(s)) return null;
    var w = Math.max(300, 56 + s.length * 17);
    var inner = fourLines('', 16, w - 16, 24, 28);
    // 句子主体坐于第三线（基线），随行宽自适应画布
    inner += U.svgText(30, 80, s, { fontSize: 30, fontFamily: SERIF, fill: INK, 'text-anchor': 'start' });
    return U.svgWrap(inner, { width: w, height: 122 });
  }

  // ============ 大小写配对卡（任务：SVG 细化） ============
  /**
   * 大小写字母同框：上格大写 + 中格小写，共用一组四线三格。
   * @param {string} letter 单个英文字母
   * @param {Object} [opts] { showPair=false } 预留
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function letterPair(letter) {
    if (!isLetter(letter)) return null;
    var up = letter.toUpperCase(), lo = letter.toLowerCase();
    var w = 240;
    var inner = fourLines('', 14, w - 14, 22, 22);
    inner += U.svgText(70, 66, up, { fontSize: 46, fontFamily: SERIF, fill: INK, fontWeight: 'bold' });
    inner += U.svgText(170, 66, lo, { fontSize: 38, fontFamily: SERIF, fill: INK });
    // 分隔竖虚线（辅助线，打印变浅）
    inner += U.svgElement('line', { x1: 120, y1: 22, x2: 120, y2: 88,
      class: 'svg-grid-line', style: 'stroke:#9fb3d1;stroke-width:1;stroke-dasharray:5 4' });
    return U.svgWrap(inner, { width: w, height: 110 });
  }

  // ============ 字母笔顺示意（任务：SVG 细化） ============
  // 大写标准笔画数（schoolbook 规范）与起笔方向（dx,dy 单位向量）+ 起笔坐标。
  // 未收录起笔方向的字母仅输出描红样式；小写不标笔画数（各教材口径不一）。
  var UPPER_STROKES = {
    A: 3, B: 3, C: 1, D: 2, E: 4, F: 3, G: 2, H: 3, I: 3, J: 2, K: 3, L: 2,
    M: 4, N: 3, O: 1, P: 2, Q: 2, R: 3, S: 1, T: 2, U: 1, V: 2, W: 4, X: 2, Y: 3, Z: 3
  };
  var START_HINTS = {
    L: [52, 30, 0, 1], T: [46, 28, 1, 0], H: [50, 26, 0, 1], I: [70, 26, 0, 1],
    E: [54, 26, 0, 1], F: [54, 26, 0, 1], X: [48, 28, 1, 1], Z: [44, 32, 1, 0],
    K: [56, 26, 0, 1], M: [46, 86, 0, -1], N: [50, 86, 0, -1], V: [46, 28, 1, 1],
    W: [44, 28, 1, 1], Y: [52, 28, 1, 0.8], A: [40, 88, 0.75, -1]
  };

  /**
   * 字母笔顺示意卡：实线示范字 + 虚线描红字 + 笔画数徽标 + 起笔方向箭头（大写）；
   * 小写字仅提供描红示意（笔画数/笔顺各教材口径不一，不作标注）。
   * @param {string} letter 单个英文字母
   * @param {string} letterCase 'upper' | 'lower'
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function letterStroke(letter, letterCase) {
    if (!isLetter(letter)) return null;
    var isUpper;
    if (CASE_UPPER.test(String(letterCase || ''))) isUpper = true;
    else if (CASE_LOWER.test(String(letterCase || ''))) isUpper = false;
    else return null;
    var glyph = isUpper ? letter.toUpperCase() : letter.toLowerCase();
    var w = 140;
    var inner = fourLines('', 14, w - 14, 22, 22);
    // 描红虚线底稿（辅助视觉，打印变浅）+ 实线示范字
    inner += U.svgText(70, 66, glyph, { fontSize: isUpper ? 46 : 38, fontFamily: SERIF,
      fill: '#c7d2e4', fontWeight: 'bold', transform: 'translate(2.5,2)' });
    inner += U.svgText(70, 66, glyph, { fontSize: isUpper ? 46 : 38, fontFamily: SERIF, fill: INK, fontWeight: 'bold' });
    if (isUpper) {
      var count = UPPER_STROKES[glyph];
      if (count != null) {
        // 笔画数徽标（右上角）
        inner += U.svgCircle(w - 24, 18, 10, { fill: '#5b8def', stroke: 'none' }) +
          U.svgText(w - 24, 22, String(count), { fontSize: 12, fill: '#ffffff', fontWeight: 700, fontFamily: 'Menlo, monospace' });
      }
      var st = START_HINTS[glyph];
      if (st) {
        // 起笔方向箭头：短线 + 三角头
        var sx = st[0], sy = st[1], dx = st[2], dy = st[3];
        var len = 15, ex = sx + dx * len, ey = sy + dy * len;
        inner += U.svgLine(sx, sy, ex, ey, { stroke: '#e05252', strokeWidth: 2 });
        var ang = Math.atan2(dy, dx), hl = 6;
        var p1x = ex + Math.cos(ang + Math.PI - 0.45) * hl, p1y = ey + Math.sin(ang + Math.PI - 0.45) * hl;
        var p2x = ex + Math.cos(ang + Math.PI + 0.45) * hl, p2y = ey + Math.sin(ang + Math.PI + 0.45) * hl;
        inner += U.svgPolygon([[ex, ey], [p1x, p1y], [p2x, p2y]], { fill: '#e05252', stroke: 'none' });
      }
    }
    return U.svgWrap(inner, { width: w, height: 110 });
  }

  // ============ 导出：挂载到科目化命名空间 ============
  var SVGEnglish = {
    letterWriting: letterWriting,
    letterPair: letterPair,
    letterStroke: letterStroke,
    wordCard: wordCard,
    fourLineWriting: fourLineWriting
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.en = SVGEnglish;
  global.SVGGenerators.en.ready = true; // 任务9：生成器已落地（覆盖任务7占位标记）

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGEnglish;
})(typeof window !== 'undefined' ? window : global);
