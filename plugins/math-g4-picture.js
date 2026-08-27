/**
 * plugins/math-g4-picture.js — 四年级看图列式插件（M7 看图列式）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M7 模块）：
 *   g4-m7-g4-pic-segment  线段图列式（倍数问题）  （type: 'segment-multiple'）
 *   g4-m7-g4-pic-brace    大括号图列式（加减）    （type: 'brace-addsub'）
 *   g4-m7-g4-pic-speed    速度时间路程图          （type: 'speed-distance'）
 *   g4-m7-g4-pic-dec      小数加减情境图          （type: 'dec-scene'）
 *
 * 看图列式以 SVG 示意图 + 列式/填数实现，学生根据图示列算式并求出结果。
 * 提供标准 ExercisePlugin 接口。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-picture.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 线段图列式（倍数问题） ============
  // 甲线段 1 份，乙线段 k 份，问总和/差
  function buildSegmentMultiple() {
    var k = pick([2, 3, 4, 5]);
    var base = rnd(20, 99);
    var total = base + base * k;
    var diff = base * (k - 1);
    var svg = segmentSVG(base, k, total);
    var v = pick(['total', 'diff']);
    if (v === 'total') {
      return { q: '看图列式并计算：甲是 ' + base + '，乙是甲的 ' + k + ' 倍，甲和乙一共是（  ）',
        answer: total, svg: svg,
        hint: '乙 = 甲 × ' + k + ' = ' + (base * k) + '，总数 = 甲 + 乙。' };
    }
    return { q: '看图列式并计算：甲是 ' + base + '，乙是甲的 ' + k + ' 倍，乙比甲多（  ）',
      answer: diff, svg: svg,
      hint: '乙 = 甲 × ' + k + '，乙 − 甲 = ' + (base * k) + ' − ' + base + '。' };
  }

  function segmentSVG(base, k, total) {
    var u = 8; // 每单位像素
    var aW = base * u, bW = base * k * u;
    var W = Math.max(aW, bW) + 40;
    var H = 92;
    var out = '<svg width="' + (W + 10) + '" height="' + H + '" viewBox="0 0 ' + (W + 10) + ' ' + H + '">';
    // 甲（1 份）
    out += '<text x="5" y="22" font-size="12" fill="#27324a">甲</text>';
    out += '<rect x="32" y="10" width="' + aW + '" height="18" fill="rgba(63,111,209,.16)" stroke="#3f6fd1" stroke-width="2"/>';
    // 乙（k 份）
    out += '<text x="5" y="58" font-size="12" fill="#27324a">乙</text>';
    out += '<rect x="32" y="46" width="' + bW + '" height="18" fill="rgba(255,107,107,.16)" stroke="#ff6b6b" stroke-width="2"/>';
    // 括号（总长）
    out += '<path d="M32,76 L32,86 M32,86 L' + (32 + bW) + ',86 M' + (32 + bW) + ',86 L' + (32 + bW) + ',76" stroke="#7a879c" stroke-width="1.5" fill="none"/>';
    out += '<text x="' + (32 + bW / 2) + '" y="100" font-size="12" fill="#7a879c" text-anchor="middle">？</text>';
    return out + '</svg>';
  }

  // ============ 大括号图列式（加减） ============
  function buildBraceAddsub() {
    var v = pick(['add', 'sub']);
    var a = rnd(20, 99), b = rnd(20, 99);
    var svg = braceSVG(a, b, v);
    if (v === 'add') {
      return { q: '看图列式并计算：两部分一共是（  ）', answer: a + b,
        svg: svg, hint: '求总数用加法：' + a + ' + ' + b + '。' };
    }
    // 减法：总数 - 一部分 = 另一部分
    var tot = a + b;
    var known = pick([a, b]);
    var rest = tot - known;
    var svg2 = braceSubSVG(tot, known);
    return { q: '看图列式并计算：总共有 ' + tot + '，其中一部分是 ' + known + '，另一部分是（  ）',
      answer: rest, svg: svg2, hint: '求另一部分用减法：' + tot + ' − ' + known + '。' };
  }

  function braceSVG(a, b, v) {
    var aW = a * 3, bW = b * 3;
    var W = Math.max(aW, bW) + 10;
    var H = 74;
    var out = '<svg width="' + (W + 10) + '" height="' + H + '" viewBox="0 0 ' + (W + 10) + ' ' + H + '">';
    out += '<rect x="5" y="8" width="' + aW + '" height="22" fill="rgba(63,111,209,.16)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<text x="' + (5 + aW / 2) + '" y="22" font-size="12" fill="#27324a" text-anchor="middle">' + a + '</text>';
    out += '<rect x="' + (aW + 5) + '" y="8" width="' + bW + '" height="22" fill="rgba(255,107,107,.16)" stroke="#ff6b6b" stroke-width="2"/>';
    out += '<text x="' + (aW + 5 + bW / 2) + '" y="22" font-size="12" fill="#27324a" text-anchor="middle">' + b + '</text>';
    out += '<path d="M5,40 L5,50 M5,50 L' + (aW + bW + 5) + ',50 M' + (aW + bW + 5) + ',50 L' + (aW + bW + 5) + ',40" stroke="#7a879c" stroke-width="1.5" fill="none"/>';
    out += '<text x="' + ((aW + bW + 10) / 2) + '" y="64" font-size="12" fill="#7a879c" text-anchor="middle">？</text>';
    return out + '</svg>';
  }

  function braceSubSVG(tot, known) {
    var W = tot * 3, kW = known * 3;
    var H = 74;
    var out = '<svg width="' + (W + 10) + '" height="' + H + '" viewBox="0 0 ' + (W + 10) + ' ' + H + '">';
    out += '<rect x="5" y="8" width="' + W + '" height="22" fill="rgba(63,111,209,.16)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<text x="' + (5 + W / 2) + '" y="22" font-size="12" fill="#27324a" text-anchor="middle">' + tot + '</text>';
    out += '<rect x="5" y="42" width="' + kW + '" height="22" fill="rgba(255,107,107,.16)" stroke="#ff6b6b" stroke-width="2"/>';
    out += '<text x="' + (5 + kW / 2) + '" y="56" font-size="12" fill="#27324a" text-anchor="middle">' + known + '</text>';
    out += '<rect x="' + (5 + kW) + '" y="42" width="' + (W - kW) + '" height="22" fill="none" stroke="#e0a33b" stroke-width="2" stroke-dasharray="5,3"/>';
    out += '<text x="' + (5 + kW + (W - kW) / 2) + '" y="56" font-size="12" fill="#e0a33b" text-anchor="middle">？</text>';
    return out + '</svg>';
  }

  // ============ 速度时间路程图 ============
  function buildSpeedDistance() {
    var v = pick(['dist', 'speed', 'time']);
    var sp = pick([40, 50, 60, 70, 80, 90, 120]);
    var tm = pick([2, 3, 4, 5, 6]);
    var dist = sp * tm;
    var svg = speedSVG(sp, tm, dist);
    if (v === 'dist') {
      return { q: '一辆汽车每小时行 ' + sp + ' 千米，行驶 ' + tm + ' 小时，一共行了（  ）千米',
        answer: dist, svg: svg, hint: '路程 = 速度 × 时间。' };
    }
    if (v === 'speed') {
      var sp2 = dist / tm;
      return { q: '一辆汽车 ' + tm + ' 小时行了 ' + dist + ' 千米，平均每小时行（  ）千米',
        answer: sp2, svg: svg, hint: '速度 = 路程 ÷ 时间。' };
    }
    var tm2 = dist / sp;
    return { q: '一辆汽车每小时行 ' + sp + ' 千米，行了 ' + dist + ' 千米，一共用了（  ）小时',
      answer: tm2, svg: svg, hint: '时间 = 路程 ÷ 速度。' };
  }

  function speedSVG(sp, tm, dist) {
    var H = 90, W = 170;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    // 简易汽车示意
    out += '<rect x="15" y="38" width="52" height="18" rx="4" fill="rgba(63,111,209,.2)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<circle cx="27" cy="58" r="6" fill="#27324a"/>';
    out += '<circle cx="55" cy="58" r="6" fill="#27324a"/>';
    // 路线
    out += '<line x1="67" y1="47" x2="140" y2="47" stroke="#e0a33b" stroke-width="2.5" stroke-dasharray="6,4" marker-end="url(#arrowS)"/>';
    out += '<defs><marker id="arrowS" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#e0a33b"/></marker></defs>';
    out += '<text x="80" y="34" font-size="11" fill="#7a879c">速度 ' + sp + ' 千米/时</text>';
    out += '<text x="80" y="78" font-size="11" fill="#7a879c">时间 ' + tm + ' 小时</text>';
    return out + '</svg>';
  }

  // ============ 小数加减情境图 ============
  function buildDecScene() {
    var v = pick(['add', 'sub']);
    var aT = rnd(10, 99), bT = rnd(10, 99);
    var a = aT / 10, b = bT / 10;
    var svg = decSceneSVG(a, b);
    if (v === 'add') {
      var sum = (a + b).toFixed(1);
      return { q: '看图列式并计算：两种水果一共（  ）千克', answer: sum,
        svg: svg, hint: a.toFixed(1) + ' + ' + b.toFixed(1) + ' = ？（小数点对齐）' };
    }
    var mx = Math.max(a, b), mn = Math.min(a, b);
    var diff = (mx - mn).toFixed(1);
    return { q: '看图列式并计算：' + mx.toFixed(1) + ' 千克比 ' + mn.toFixed(1) + ' 千克多（  ）千克',
      answer: diff, svg: svg, hint: mx.toFixed(1) + ' − ' + mn.toFixed(1) + ' = ？（小数点对齐）' };
  }

  function decSceneSVG(a, b) {
    var aW = Math.round(a * 12), bW = Math.round(b * 12);
    var W = Math.max(aW, bW) + 20;
    var H = 72;
    var out = '<svg width="' + (W + 10) + '" height="' + H + '" viewBox="0 0 ' + (W + 10) + ' ' + H + '">';
    out += '<circle cx="' + (8 + aW / 2) + '" cy="18" r="12" fill="rgba(255,107,107,.3)" stroke="#ff6b6b" stroke-width="2"/>';
    out += '<text x="' + (8 + aW / 2) + '" y="22" font-size="11" fill="#27324a" text-anchor="middle">' + a.toFixed(1) + '</text>';
    out += '<circle cx="' + (8 + aW / 2 + 40) + '" cy="18" r="12" fill="rgba(63,111,209,.3)" stroke="#3f6fd1" stroke-width="2"/>';
    out += '<text x="' + (8 + aW / 2 + 40) + '" y="22" font-size="11" fill="#27324a" text-anchor="middle">' + b.toFixed(1) + '</text>';
    out += '<rect x="8" y="40" width="' + aW + '" height="14" fill="rgba(255,107,107,.3)" stroke="#ff6b6b" stroke-width="1.5"/>';
    out += '<text x="' + (8 + aW / 2) + '" y="51" font-size="10" fill="#27324a" text-anchor="middle">' + a.toFixed(1) + ' kg</text>';
    out += '<rect x="' + (8 + aW + 10) + '" y="40" width="' + bW + '" height="14" fill="rgba(63,111,209,.3)" stroke="#3f6fd1" stroke-width="1.5"/>';
    out += '<text x="' + (8 + aW + 10 + bW / 2) + '" y="51" font-size="10" fill="#27324a" text-anchor="middle">' + b.toFixed(1) + ' kg</text>';
    return out + '</svg>';
  }

  // ============ 综合看图列式 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 35) return buildSegmentMultiple();
    if (r <= 60) return buildBraceAddsub();
    if (r <= 80) return buildSpeedDistance();
    return buildDecScene();
  }

  var TYPE_BUILDERS = {
    'segment-multiple': buildSegmentMultiple,
    'brace-addsub': buildBraceAddsub,
    'speed-distance': buildSpeedDistance,
    'dec-scene': buildDecScene,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'segment-multiple': '线段图倍数',
    'brace-addsub': '大括号图',
    'speed-distance': '速度路程',
    'dec-scene': '小数情境',
    mix: '综合看图列式'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-picture',
    moduleId: 'M7',
    name: '看图列式',
    pageSubtitle: '线段图、大括号图、速度路程与小数情境',
    grades: [4],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g4-m7-g4-pic-segment', 'math-g4-m7-g4-pic-brace', 'math-g4-m7-g4-pic-speed', 'math-g4-m7-g4-pic-dec'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合看图列式' },
          { value: 'segment-multiple', label: '线段图倍数' },
          { value: 'brace-addsub',    label: '大括号图' },
          { value: 'speed-distance',  label: '速度路程' },
          { value: 'dec-scene',       label: '小数情境' }
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
        return { type: 'picture', q: p.q, answer: String(p.answer), svg: p.svg, hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级看图列式（' + (TYPE_NAMES[type] || '综合') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);