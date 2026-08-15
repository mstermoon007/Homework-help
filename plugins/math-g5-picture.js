/**
 * plugins/math-g5-picture.js — 五年级看图列式插件（M7 看图列式）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M7 模块）：
 *   g5-pic-balance  天平平衡图（列方程）（type: 'balance-equation'）
 *   g5-pic-area     多边形面积图          （type: 'area-picture'）
 *   g5-pic-segment  线段图（小数倍数）    （type: 'segment-multiple'）
 *   g5-pic-tree     植树问题示意图        （type: 'tree-planting'）
 *
 * 每题带 SVG 示意图，学生看图列式并填空（text 输入）。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-picture.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function trimD(x) { return String(Number(x.toFixed(3))); }

  // ============ 天平平衡图（列方程） ============
  // 天平左边：x + a；右边：b。问 x 的值
  function buildBalanceEquation() {
    var a = rnd(1, 5), x = rnd(2, 9);
    var b = x + a;
    var v = pick(['leftx', 'rightx']);
    var svg = balanceSVG(a, b, v);
    if (v === 'leftx') {
      return { q: '天平平衡，x =（  ）', answer: x, svg: svg, hint: b + ' − ' + a + ' = ' + x + '，或 x + ' + a + ' = ' + b + '。' };
    }
    return { q: '天平平衡，x =（  ）', answer: x, svg: svg, hint: b + ' − ' + a + ' = ' + x + '。' };
  }
  function balanceSVG(a, b, v) {
    var W = 220, H = 110;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    // 支架
    out += '<line x1="110" y1="20" x2="110" y2="80" stroke="#27324a" stroke-width="3"/>';
    out += '<line x1="70" y1="22" x2="150" y2="22" stroke="#27324a" stroke-width="3"/>';
    out += '<line x1="110" y1="20" x2="110" y2="10" stroke="#27324a" stroke-width="3"/>';
    out += '<polygon points="104,10 116,10 110,0" fill="#27324a"/>';
    // 左托盘：x 盒 + a 个
    out += '<rect x="48" y="40" width="40" height="22" rx="4" fill="rgba(63,111,209,.2)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<text x="55" y="55" font-size="13" fill="#3f6fd1" font-weight="700">x</text>';
    for (var i = 0; i < a; i++) {
      out += '<circle cx="' + (48 + i * 12 + 6) + '" cy="' + (86) + '" r="5" fill="rgba(242,169,59,.8)"/>';
    }
    // 右托盘：b 个
    for (var j = 0; j < b; j++) {
      out += '<circle cx="' + (140 + j * 8 + 6) + '" cy="' + (86) + '" r="5" fill="rgba(63,111,209,.8)"/>';
    }
    out += '<line x1="110" y1="22" x2="60" y2="40" stroke="#27324a" stroke-width="2"/>';
    out += '<line x1="110" y1="22" x2="160" y2="40" stroke="#27324a" stroke-width="2"/>';
    out += '<text x="60" y="104" font-size="11" fill="#7a879c">' + a + ' 个</text>';
    out += '<text x="140" y="104" font-size="11" fill="#7a879c">' + b + ' 个</text>';
    out += '</svg>';
    return out;
  }

  // ============ 多边形面积图 ============
  // 画出三角形/平行四边形/梯形，标出底和高，求面积
  function buildAreaPicture() {
    var shape = pick(['三角形', '平行四边形', '梯形']);
    var b, h, ans, svg, extra;
    if (shape === '三角形') {
      b = rnd(4, 10); h = rnd(3, 8);
      ans = b * h / 2;
      extra = '底 = ' + b + '，高 = ' + h;
      svg = triPicSVG(b, h);
    } else if (shape === '平行四边形') {
      b = rnd(4, 10); h = rnd(3, 8);
      ans = b * h;
      extra = '底 = ' + b + '，高 = ' + h;
      svg = paraPicSVG(b, h);
    } else {
      var up = rnd(2, 5), down = rnd(5, 9), h3 = rnd(3, 8);
      b = (up + down) * h3 / 2;
      ans = b;
      extra = '上底 = ' + up + '，下底 = ' + down + '，高 = ' + h3;
      svg = trapPicSVG(up, down, h3);
    }
    return { q: '看图列式计算：' + shape + '的面积是（  ）（' + extra + '）', answer: ans, svg: svg,
      hint: shape === '三角形' ? '三角形面积 = 底 × 高 ÷ 2' : shape === '平行四边形' ? '平行四边形面积 = 底 × 高' : '梯形面积 =（上底 + 下底）× 高 ÷ 2' };
  }
  function triPicSVG(b, h) {
    var W = 40 + b * 14, H = 30 + h * 14;
    var x1 = 10, y1 = H - 10, x2 = x1 + b * 14, x3 = (x1 + x2) / 2, y3 = y1 - h * 14;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + x1 + ',' + y1 + ' ' + x2 + ',' + y1 + ' ' + x3 + ',' + y3 + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + x3 + '" y1="' + y3 + '" x2="' + x3 + '" y2="' + y1 + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (x3 + 4) + '" y="' + ((y3 + y1) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '<text x="' + ((x1 + x2) / 2 - 8) + '" y="' + (y1 + 12) + '" font-size="12" fill="#3f6fd1">底</text>' +
      '</svg>';
  }
  function paraPicSVG(b, h) {
    var W = 40 + b * 14, H = 30 + h * 14;
    var x1 = 12, y1 = H - 10;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + x1 + ',' + y1 + ' ' + (x1 + b * 14) + ',' + y1 + ' ' + (x1 + b * 14 - 16) + ',' + (y1 - h * 14) + ' ' + (x1 - 16) + ',' + (y1 - h * 14) + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + (x1 + 20) + '" y1="' + (y1 - h * 14) + '" x2="' + (x1 + 20) + '" y2="' + y1 + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (x1 + 26) + '" y="' + ((y1 - h * 14 + y1) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '<text x="' + (x1 + b * 14 / 2 - 8) + '" y="' + (y1 + 12) + '" font-size="12" fill="#3f6fd1">底</text>' +
      '</svg>';
  }
  function trapPicSVG(up, down, h) {
    var W = 40 + down * 14, H = 30 + h * 14;
    var mid = 10;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + mid + ',' + (H - 10) + ' ' + (mid + down * 14) + ',' + (H - 10) + ' ' + (mid + down * 14 - 16) + ',' + (H - 10 - h * 14) + ' ' + (mid + 16) + ',' + (H - 10 - h * 14) + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + (mid + 30) + '" y1="' + (H - 10 - h * 14) + '" x2="' + (mid + 30) + '" y2="' + (H - 10) + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (mid + 36) + '" y="' + ((H - 10 - h * 14 + H - 10) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '<text x="' + (mid + down * 14 / 2 - 8) + '" y="' + (H - 10 + 12) + '" font-size="12" fill="#3f6fd1">下底</text>' +
      '</svg>';
  }

  // ============ 线段图（小数倍数） ============
  // 甲是小数 a，乙是甲的 k 倍，线段图，问甲+乙 或 乙-甲
  function buildSegmentMultiple() {
    var base = rnd(2, 9) / 10;
    var k = rnd(2, 4);
    var total = base * k + base;
    var diff = base * k - base;
    var svg = segmentPicSVG(base, k);
    var v = pick(['sum', 'diff']);
    if (v === 'sum') {
      return { q: '看图列式：乙是甲的 ' + k + ' 倍，甲和乙一共是（  ）', answer: trimD(total), svg: svg, hint: trimD(base) + '×' + k + ' + ' + trimD(base) + ' = ' + trimD(total) + '。' };
    }
    return { q: '看图列式：乙是甲的 ' + k + ' 倍，乙比甲多（  ）', answer: trimD(diff), svg: svg, hint: trimD(base) + '×' + k + ' − ' + trimD(base) + ' = ' + trimD(diff) + '。' };
  }
  function segmentPicSVG(base, k) {
    var W = 200, H = 80;
    var x = 10, w1 = 50, w2 = 50 * k;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    // 甲
    out += '<rect x="' + x + '" y="14" width="' + w1 + '" height="16" fill="rgba(63,111,209,.35)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<text x="' + (x + w1 / 2 - 8) + '" y="' + (26) + '" font-size="11" fill="#3f6fd1">甲</text>';
    // 乙（k 段）
    for (var i = 0; i < k; i++) {
      out += '<rect x="' + (x + i * w1) + '" y="' + (48) + '" width="' + w1 + '" height="16" fill="rgba(242,169,59,.4)" stroke="#f2a93b" stroke-width="1.5"/>';
    }
    out += '<text x="' + (x + w2 / 2 - 8) + '" y="' + (60) + '" font-size="11" fill="#f2a93b">乙</text>';
    out += '<text x="' + x + '" y="74" font-size="11" fill="#7a879c">甲 = 1 份</text>';
    out += '</svg>';
    return out;
  }

  // ============ 植树问题示意图 ============
  // 两端都栽 / 只栽一端 / 两端都不栽
  function buildTreePlanting() {
    var v = pick(['both', 'one', 'none']);
    var n = rnd(3, 8); // 段数
    var trees = v === 'both' ? n + 1 : v === 'one' ? n : n - 1;
    if (trees < 2) return buildTreePlanting();
    var svg = treeSVG(n, v);
    var label = v === 'both' ? '两端都栽' : v === 'one' ? '只栽一端' : '两端都不栽';
    return { q: '植树问题（' + label + '）：' + n + ' 段路，需要种（  ）棵树', answer: trees, svg: svg,
      hint: v === 'both' ? '棵数 = 段数 + 1' : v === 'one' ? '棵数 = 段数' : '棵数 = 段数 − 1' };
  }
  function treeSVG(n, v) {
    var W = 30 + n * 30, H = 60;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    out += '<line x1="15" y1="35" x2="' + (15 + n * 30) + '" y2="35" stroke="#27324a" stroke-width="2"/>';
    var start = v === 'none' ? 1 : 0;
    var end = v === 'both' ? n : v === 'one' ? n : n - 1;
    for (var i = start; i <= end; i++) {
      var px = 15 + i * 30;
      out += '<circle cx="' + px + '" cy="35" r="4" fill="#3f6fd1"/>';
      out += '<polygon points="' + px + ',' + 30 + ' ' + (px - 5) + ',' + 20 + ' ' + px + ',' + 24 + ' ' + (px + 5) + ',' + 20 + '" fill="rgba(63,111,209,.7)"/>';
    }
    out += '<text x="' + (15 + n * 30 / 2 - 10) + '" y="52" font-size="11" fill="#7a879c">' + n + ' 段</text>';
    out += '</svg>';
    return out;
  }

  // ============ 综合看图列式 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 28) return buildBalanceEquation();
    if (r <= 56) return buildAreaPicture();
    if (r <= 80) return buildSegmentMultiple();
    return buildTreePlanting();
  }

  var TYPE_BUILDERS = {
    'balance-equation': buildBalanceEquation,
    'area-picture': buildAreaPicture,
    'segment-multiple': buildSegmentMultiple,
    'tree-planting': buildTreePlanting,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'balance-equation': '天平平衡图',
    'area-picture': '多边形面积图',
    'segment-multiple': '线段图（小数倍数）',
    'tree-planting': '植树问题示意图',
    mix: '综合看图列式'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-picture',
    moduleId: 'M7',
    name: '看图列式',
    pageTitle: '五年级看图列式',
    pageSubtitle: '天平方程、面积图、线段图与植树问题',
    grades: [5],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g5-pic-balance', 'g5-pic-area', 'g5-pic-segment', 'g5-pic-tree'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合看图列式' },
          { value: 'balance-equation', label: '天平平衡图' },
          { value: 'area-picture',    label: '多边形面积图' },
          { value: 'segment-multiple', label: '线段图（小数倍数）' },
          { value: 'tree-planting',   label: '植树问题示意图' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 50, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'picture', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级看图列式（' + (TYPE_NAMES[type] || '综合看图列式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);