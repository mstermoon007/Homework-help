// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c4-geometry.js — 竞赛 C4 几何模型
//
// 覆盖 C4 模块六个子题型（type 与 shared/knowledge-bank.js 四年级 C4 知识点一致）：
//   pa        周长与面积（长方形/正方形，含已知周长反求宽）
//   cutfill   割补法（拆分为已知长方形+正方形求和）
//   angle     角度初步（三角形内角和 / 互余 / 互补）
//   count     图形计数（n×n 方格纸中含大小不同的正方形总数）
//   transform 平移旋转与对称（正 n 边形对称轴条数）
//   solid     立体图形初步（长方体由多少个单位小正方体拼成）
//
// 设计要点（竞赛题必须答案唯一）：所有子题型均为确定型计算，题面含全部所需数字，
// 校验器从题面反解参数独立重算比对。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C4'、category:'geometry'、grades 与模块目录一致 [4,5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c4-geometry.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 通用构造 ============
  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模（高难度数字更大） */
  function scale(lv) {
    if (lv >= 8) return { big: 1, span: 20, nmax: 6, sMax: 10 };
    if (lv >= 5) return { big: 0, span: 14, nmax: 5, sMax: 7 };
    return { big: 0, span: 10, nmax: 4, sMax: 5 };
  }

  // ============ 1. 周长与面积 ============
  function genPA(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 1) {
      // 正方形
      var s = _PU.randInt(3, 9 + sc.big * 4);
      return fillQ({
        type: 'pa',
        text: '一个正方形的边长是 ' + s + ' 厘米。它的周长是 ____ 厘米，面积是 ____ 平方厘米。（先填周长，再填面积）',
        answer: [4 * s, s * s],
        hint: '周长 = 边长 × 4；面积 = 边长 × 边长'
      });
    }
    if (mode === 2) {
      // 已知周长与长，求宽
      var L2 = _PU.randInt(4, 9 + sc.big * 4);
      var W2 = _PU.randInt(2, L2 - 1);
      var P = 2 * (L2 + W2);
      return fillQ({
        type: 'pa',
        text: '一个长方形的周长是 ' + P + ' 厘米，长是 ' + L2 + ' 厘米，宽是 ____ 厘米。',
        answer: [W2],
        hint: '宽 = 周长 ÷ 2 − 长 = ' + (P / 2) + ' − ' + L2
      });
    }
    // 已知长与宽，求周长和面积
    var L = _PU.randInt(4, 9 + sc.big * 4);
    var W = _PU.randInt(2, 9 + sc.big * 4);
    return fillQ({
      type: 'pa',
      text: '一个长方形的长是 ' + L + ' 厘米，宽是 ' + W + ' 厘米。它的周长是 ____ 厘米，面积是 ____ 平方厘米。（先填周长，再填面积）',
      answer: [2 * (L + W), L * W],
      hint: '周长 = (长 + 宽) × 2；面积 = 长 × 宽'
    });
  }

  // ============ 2. 割补法 ============
  function genCutFill(sc) {
    var a = _PU.randInt(3, 8 + sc.big * 2);
    var b = _PU.randInt(2, 6 + sc.big * 2);
    var c = _PU.randInt(2, 6 + sc.big * 2);
    var area = a * b + c * c;
    return fillQ({
      type: 'cutfill',
      text: '一个组合图形可以分割成一个长 ' + a + ' 厘米、宽 ' + b + ' 厘米的长方形和一个边长 ' + c + ' 厘米的正方形（用割补法拼合）。这个组合图形的面积是 ____ 平方厘米。',
      answer: [area],
      hint: '面积 = 长方形面积 + 正方形面积 = ' + (a * b) + ' + ' + (c * c)
    });
  }

  // ============ 3. 角度初步 ============
  function genAngle(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 1) {
      // 互余
      var x1 = _PU.randInt(10, 80);
      return fillQ({
        type: 'angle',
        text: '∠A 与 ∠B 互余（∠A + ∠B = 90°），已知 ∠A = ' + x1 + '°，那么 ∠B = ____°。',
        answer: [90 - x1],
        hint: '∠B = 90° − ∠A = 90° − ' + x1 + '°'
      });
    }
    if (mode === 2) {
      // 互补
      var x2 = _PU.randInt(20, 150);
      return fillQ({
        type: 'angle',
        text: '∠A 与 ∠B 互补（∠A + ∠B = 180°），已知 ∠A = ' + x2 + '°，那么 ∠B = ____°。',
        answer: [180 - x2],
        hint: '∠B = 180° − ∠A = 180° − ' + x2 + '°'
      });
    }
    // 三角形内角和
    var a1 = _PU.randInt(20, 80);
    var b1 = _PU.randInt(20, 110 - a1);
    return fillQ({
      type: 'angle',
      text: '一个三角形的三个角中，∠1 = ' + a1 + '°，∠2 = ' + b1 + '°，那么 ∠3 = ____°。',
      answer: [180 - a1 - b1],
      hint: '三角形内角和 180°，∠3 = 180° − ∠1 − ∠2 = 180° − ' + a1 + '° − ' + b1 + '°'
    });
  }

  // ============ 4. 图形计数 ============
  function genCount(sc) {
    // a×b 方格纸中含大小不同的正方形总数 = Σ_{k=1..min(a,b)} (a-k+1)(b-k+1)
    var a = _PU.randInt(2, sc.nmax + 2);
    var b = _PU.randInt(2, sc.nmax + 2);
    if (a === b) b = b + 1; // 尽量矩形，扩大题面空间
    var total = 0, mn = Math.min(a, b);
    for (var k = 1; k <= mn; k++) total += (a - k + 1) * (b - k + 1);
    var phr = _PU.randInt(0, 2);
    var head = phr === 0
      ? '在由 ' + a + '×' + b + ' 个小正方形组成的长方形方格纸中'
      : (phr === 1
        ? '一张画着 ' + a + '×' + b + ' 方格的网格纸'
        : '下面的网格共 ' + a + ' 行、' + b + ' 列小正方形');
    var tail = _PU.randInt(0, 1) === 0
      ? '，一共能数出 ____ 个正方形（包含各种大小）。'
      : '，其中包含大小不同的正方形共有 ____ 个。';
    return fillQ({
      type: 'count',
      text: head + tail,
      answer: [total],
      hint: '分边长统计：边长 1~' + mn + ' 的正方形分别有 ' + (a * b) + '、' + ((a - 1) * (b - 1)) + '…个，求和 = ' + total
    });
  }

  // ============ 5. 平移旋转与对称 ============
  var TRANSFORM_PHR = [
    '一个正 {n} 边形有 ____ 条对称轴。',
    '正 {n} 边形一共有 ____ 条对称轴。',
    '想一想，正 {n} 边形的对称轴条数是 ____。',
    '正 {n} 边形的对称线条数为 ____。',
    '下面图形是正 {n} 边形，它有 ____ 条对称轴。',
    '数一数：正 {n} 边形共有 ____ 条对称轴。'
  ];
  function genTransform() {
    var ns = [3, 4, 5, 6, 7, 8, 9, 10];
    var n = _PU.rand(ns);
    var tpl = TRANSFORM_PHR[_PU.randInt(0, TRANSFORM_PHR.length - 1)];
    return fillQ({
      type: 'transform',
      text: tpl.replace('{n}', n),
      answer: [n],
      hint: '正 n 边形有 n 条对称轴'
    });
  }

  // ============ 6. 立体图形初步 ============
  function genSolid(sc) {
    var a = _PU.randInt(2, sc.sMax);
    var b = _PU.randInt(2, sc.sMax);
    var c = _PU.randInt(2, sc.sMax);
    return fillQ({
      type: 'solid',
      text: '用棱长 1 厘米的小正方体拼成一个 ' + a + '×' + b + '×' + c + ' 的长方体，一共需要 ____ 个小正方体。',
      answer: [a * b * c],
      hint: '长方体体积 = 长 × 宽 × 高 = ' + a + ' × ' + b + ' × ' + c
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['pa', 'cutfill', 'angle', 'count', 'transform', 'solid']
      : [type];
    var count = opts.count || 10;
    var questions = [];
    var seen = {};
    var MAXTRY = count * 50;
    var map = { pa: genPA, cutfill: genCutFill, angle: genAngle, count: genCount, transform: genTransform, solid: genSolid };
    for (var i = 0; i < count; i++) {
      var key, q, tries = 0;
      do {
        key = keys[i % keys.length];
        q = map[key](sc);
        tries++;
      } while (q && seen[q.q] && tries < MAXTRY);
      if (!q) { q = genPA(sc); }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-c4-geometry',
    name: '几何模型',
    subject: 'math',
    category: 'geometry',
    grades: [4],
    moduleIds: ['C4'],
    knowledgePoints: {
      4: [
          'math-g4-c4-c4-pa',
          'math-g4-c4-c4-cutfill',
          'math-g4-c4-c4-angle',
          'math-g4-c4-c4-count',
          'math-g4-c4-c4-transform',
          'math-g4-c4-c4-solid'
      ]
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',       label: '综合' },
        { value: 'pa',        label: '周长与面积' },
        { value: 'cutfill',   label: '割补法' },
        { value: 'angle',     label: '角度初步' },
        { value: 'count',     label: '图形计数' },
        { value: 'transform', label: '对称与变换' },
        { value: 'solid',     label: '立体图形' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 4,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '几何模型'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
