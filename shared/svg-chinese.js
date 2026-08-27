/**
 * shared/svg-chinese.js — 语文科目 SVG 生成器（SVGGenerators.cn）
 *
 * 任务8 落地：基于 shared/svg-core.js 的 SVGUtil 构造语文书写类图形，
 * 浏览器 / Node 双环境可用，输出即完整 <svg> 字符串。
 *
 * API：
 *   hanziGrid(char, gridType)  田字格/米字格/十字格 + 居中汉字；gridType: 'tian'(默认) | 'mi' | 'cross'
 *   pinyinGrid(syllable, opts) 四线三格 + 拼音音节；opts: { lineColor, baselineColor } 颜色可配
 *   strokeOrder(char)          预置笔顺分步演示（内置 10 个常用字），带笔画序号徽标
 *   strokeOrderWord(text)      多字笔顺展示（2~4 字，序号跨字连续；全部须在笔顺库内）
 *   sentenceLine(text)         带横线的书写格（上虚线导引 + 下实线基线）
 *
 * 约定（与 svg-make-ten 一致）：
 *   - 无效参数一律返回 null，由调用方决定降级展示；
 *   - 颜色使用字面量常量（SVG 表现属性豁免令牌规则）；
 *   - 汉字字形依赖系统字体渲染（KaiTi/STKaiti 回退 serif）。
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg-chinese.js 依赖 shared/svg-core.js（SVGUtil），请先加载');

  // ============ 常量 ============
  var INK = '#27324a';            // 主笔色
  var BADGE_FILL = '#5b8def';     // 笔画序号徽标
  var KAITI = "'KaiTi','STKaiti','楷体',Georgia,serif";

  /** 任务13：辅助线颜色经 style 属性消费 tokens.css 变量（SVG 表现属性不支持 var()） */
  function gridLine(x1, y1, x2, y2, cssVar, sw, dash) {
    var style = 'stroke:var(' + cssVar + ');stroke-width:' + sw +
      (dash ? ';stroke-dasharray:' + dash : '');
    return U.svgElement('line', { x1: x1, y1: y1, x2: x2, y2: y2, style: style });
  }

  /** 常用字笔顺数据（0..100 归一坐标；每笔为折线点列，序号即数组顺序） */
  var STROKE_DATA = {
    '一': [[[15, 50], [85, 50]]],
    '二': [[[20, 32], [80, 32]], [[12, 70], [88, 70]]],
    '三': [[[22, 25], [82, 25]], [[16, 52], [86, 52]], [[10, 78], [90, 78]]],
    '十': [[[15, 50], [85, 50]], [[50, 12], [50, 88]]],
    '口': [[[32, 22], [32, 78]], [[32, 22], [72, 22], [72, 78]], [[32, 78], [72, 78]]],
    '山': [[[50, 18], [50, 62]], [[26, 28], [26, 76], [74, 76]], [[74, 42], [74, 76]]],
    '日': [[[33, 20], [33, 80]], [[33, 20], [67, 20], [67, 80]], [[33, 50], [67, 50]], [[33, 80], [67, 80]]],
    '木': [[[14, 48], [86, 48]], [[50, 12], [50, 88]], [[47, 54], [24, 82]], [[53, 54], [79, 82]]],
    '人': [[[55, 15], [22, 78]], [[45, 45], [84, 80]]],
    '八': [[[46, 18], [16, 72]], [[56, 20], [86, 74]]]
  };

  /** 单个汉字校验（CJK 基本区 + 扩展 A + 兼容区） */
  function isHanzi(ch) {
    return typeof ch === 'string' && ch.length === 1 && /[\u3400-\u9FFF\uF900-\uFAFF]/.test(ch);
  }

  // ============ 田字格 / 米字格 / 十字格 ============
  /**
   * @param {string} char 单个汉字
   * @param {string} [gridType] 'tian'（默认）| 'mi' | 'cross'（十字格：实线中线）
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function hanziGrid(char, gridType) {
    if (!isHanzi(char)) return null;
    var kind = (gridType === 'mi' || gridType === 'cross') ? gridType : 'tian';
    // 格线经 SVGUtil.svgGrid 统一输出（带 svg-grid-line 类，打印模式自动变浅）
    var inner = U.svgGrid(kind, { x: 10, y: 10, size: 100 });
    // 汉字（基线下移约 0.36×字号 视觉居中）
    inner += U.svgText(60, 60 + 78 * 0.36, char, { fontSize: 78, fontFamily: KAITI, fill: INK, fontWeight: 'bold' });
    return U.svgWrap(inner, { width: 120, height: 120 });
  }

  // ============ 四线三格拼音 ============
  var PINYIN_RE = /^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/;

  /**
   * @param {string} syllable 拼音音节（可带调号，长度 ≤ 8）
   * @param {Object} [opts] { lineColor, baselineColor } 四线格颜色可配置
   *        （默认经 style 消费 tokens.css 变量；打印模式由 svgWrap printMode 统一变浅）
   * @returns {string|null} 完整 <svg>；非法输入返回 null
   */
  function pinyinGrid(syllable, opts) {
    if (typeof syllable !== 'string') return null;
    var s = syllable.trim();
    if (!s || s.length > 8 || !PINYIN_RE.test(s)) return null;
    opts = opts || {};
    var w = Math.max(160, 80 + s.length * 26);
    // 四线三格：第四线为基线略粗（颜色走令牌，可被 opts 覆盖）
    var inner = U.svgGrid('four-line', { x: 12, topY: 22, width: w - 24, gap: 22, lines: 4,
      lineColor: opts.lineColor, baselineColor: opts.baselineColor });
    // 音节主体落于第二、三格之间（基线贴近第三线，符合四线格书写习惯）
    inner += U.svgText(w / 2, 64, s, { fontSize: 34, fontFamily: KAITI, fill: INK });
    return U.svgWrap(inner, { width: w, height: 110 });
  }

  // ============ 笔顺演示 ============
  /**
   * @param {string} char 内置笔顺数据的汉字（一二十三十口山日木人八）
   * @returns {string|null} 完整 <svg>（含笔画序号徽标）；无数据返回 null
   */
  function gridRect() {
    return U.svgElement('rect', { x: 5, y: 5, width: 90, height: 90, fill: '#ffffff',
      style: 'stroke:var(--grid-tianzige-frame);stroke-width:1' });
  }

  /** 单字笔顺组（含序号徽标）：dx 为水平偏移，numStart 为起始笔画序号 */
  function strokesOf(ch, dx, numStart) {
    var strokes = STROKE_DATA[ch] || [];
    var out = '';
    strokes.forEach(function (pts, i) {
      var moved = pts.map(function (p) { return [p[0] + dx, p[1]]; });
      out += U.svgPolyline(moved, { stroke: INK, strokeWidth: 6 });
      var start = moved[0];
      // 序号徽标：起点外扩一点，避免压住起笔
      var bx = start[0] < 50 ? start[0] - 11 : start[0] + 11;
      var by = start[1] < 50 ? start[1] - 11 : start[1] + 11;
      bx = Math.max(9, Math.min(91, bx)) + dx;
      by = Math.max(9, Math.min(91, by));
      out += U.svgCircle(bx, by, 8, { fill: BADGE_FILL, stroke: 'none', strokeWidth: 0 });
      out += U.svgText(bx, by + 4, String(numStart + i),
        { fontSize: 11, fontFamily: 'Menlo, Consolas, monospace', fill: '#ffffff', fontWeight: 'bold' });
    });
    return { svg: out, count: strokes.length };
  }

  function strokeOrder(char) {
    if (!isHanzi(char) || !STROKE_DATA[char]) return null;
    var r = strokesOf(char, 0, 1);
    return U.svgWrap(gridRect() + r.svg, { width: 110, height: 110 });
  }

  // ============ 多字笔顺展示（任务：SVG 细化） ============
  /**
   * 多字笔顺：每个字独立田字框横排，笔画序号跨字连续。
   * @param {string} text 2~4 个汉字，全部须在 STROKE_DATA 内；否则返回 null
   * @returns {string|null} 完整 <svg>
   */
  function strokeOrderWord(text) {
    if (typeof text !== 'string') return null;
    var t = text.trim();
    if (t.length < 2 || t.length > 4) return null;
    for (var i = 0; i < t.length; i++) {
      if (!STROKE_DATA[t.charAt(i)]) return null;
    }
    var PITCH = 110 + 14;
    var inner = '';
    var num = 1;
    for (var k = 0; k < t.length; k++) {
      inner += gridRect().replace(/x="5"/, 'x="' + (5 + k * PITCH) + '"');
      var r = strokesOf(t.charAt(k), k * PITCH, num);
      inner += r.svg;
      num += r.count;
    }
    var w = t.length * 110 + (t.length - 1) * 14;
    return U.svgWrap(inner, { width: w, height: 110 });
  }

  // ============ 带横线的书写格 ============
  /**
   * @param {string} text 书写示范文本（≤ 16 字；空串输出空白格）
   * @returns {string|null} 完整 <svg>；非字符串或超长返回 null
   */
  function sentenceLine(text) {
    if (typeof text !== 'string' || text.length > 16) return null;
    var n = text.length;
    var padX = 28;
    var w = Math.max(200, padX * 2 + n * 44);
    var inner = gridLine(padX - 12, 52, w - padX + 12, 52,
      '--grid-fourline-baseline', 2);                                // 基线（实线，令牌色）
    inner += gridLine(padX - 12, 14, w - padX + 12, 14,
      '--grid-tianzige-aux', 1.2, '5 5');                            // 顶部导引（虚线，令牌色）
    if (n > 0) {
      inner += U.svgText(padX, 52, text,
        { fontSize: 38, fontFamily: KAITI, fill: INK, 'text-anchor': 'start' });
    }
    return U.svgWrap(inner, { width: w, height: 70 });
  }

  // ============ 导出：挂载到科目化命名空间 ============
  var SVGChinese = {
    hanziGrid: hanziGrid,
    pinyinGrid: pinyinGrid,
    strokeOrder: strokeOrder,
    strokeOrderWord: strokeOrderWord,
    sentenceLine: sentenceLine,
    STROKE_DATA: STROKE_DATA
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.cn = SVGChinese;
  global.SVGGenerators.cn.ready = true; // 任务8：生成器已落地（覆盖任务7占位标记）

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGChinese;
})(typeof window !== 'undefined' ? window : global);
