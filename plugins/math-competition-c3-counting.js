// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c3-counting.js — 竞赛 C3 组合计数
//
// 覆盖 C3 模块五个子题型（type 与 shared/knowledge-bank.js 四年级 C3 知识点一致）：
//   enum       枚举法（满足条件的小集合计数）
//   am         加法与乘法原理（m×n / 分类相加）
//   perm       排列组合初步（选 k 排列 P(n,k) 或 选 k 组合 C(n,k)）
//   geomcount  几何计数（线段 C(p,2) / 长方形网格）
//   worst      最不利原则（抽屉原理应用：最不利 +1）
//
// 设计要点：计数题最易「答案不唯一」或「漏算/重算」，故每题均为「构造即唯一」的确定计数，
// 校验器从题面反解参数独立重算比对。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C3'、category:'number'、grades [4,5,6]、多空题数组 answer + inputType:'multi'、无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c3-counting.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

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

  function fact(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function C(n, k) { if (k < 0 || k > n) return 0; return fact(n) / (fact(k) * fact(n - k)); }
  function P(n, k) { if (k < 0 || k > n) return 0; return fact(n) / fact(n - k); }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { small: 6, mid: 9, big: 12 };
    if (lv >= 5) return { small: 5, mid: 7, big: 9 };
    return { small: 4, mid: 6, big: 8 };
  }

  // ============ 1. 枚举法 ============
  // 给定 1..N 中满足「是某数倍数」或「数字和固定」的数的个数，直接计数唯一。
  function genEnum(sc) {
    for (var t = 0; t < 300; t++) {
      var N = _PU.randInt(15, sc.big + 20);
      var d = _PU.rand([2, 3, 4, 5]);               // 问「1..N 中是 d 的倍数的数有几个」
      var cnt = 0;
      for (var x = 1; x <= N; x++) if (x % d === 0) cnt++;
      if (cnt < 3) continue;                         // 太少了没意思
      return fillQ({
        type: 'enum',
        text: '在 1 到 ' + N + ' 中，是 ' + d + ' 的倍数的数一共有 ____ 个。（可一个一个列举出来数一数）',
        answer: [cnt],
        hint: '从 ' + d + ' 开始，每次加 ' + d + '：' + d + '、' + (d * 2) + '、' + (d * 3) + '……数到不超过 ' + N
      });
    }
    return null;
  }

  // ============ 2. 加法与乘法原理 ============
  function genAM() {
    if (_PU.randInt(0, 1) === 0) {
      // 乘法原理：m 件上衣 × n 条裤子
      var m = _PU.randInt(2, 9), n = _PU.randInt(2, 9);
      var ans = m * n;
      return fillQ({
        type: 'am',
        text: '衣柜里有 ' + m + ' 件不同的上衣和 ' + n + ' 条不同的裤子，每件上衣都能和每条裤子搭配。一共可以搭配出 ____ 套不同的穿法。',
        answer: [ans],
        hint: '每件上衣有 ' + n + ' 种裤子可选，共有 ' + m + ' 件上衣 → ' + m + ' × ' + n
      });
    }
    // 加法原理：m 本科技书 + n 本故事书，任选 1 本
    var a = _PU.randInt(3, 12), b = _PU.randInt(3, 12);
    return fillQ({
      type: 'am',
      text: '书架上有 ' + a + ' 本科技书和 ' + b + ' 本故事书，从中任选 1 本，一共有 ____ 种不同的选法。',
      answer: [a + b],
      hint: '选科技书有 ' + a + ' 种选法，选故事书有 ' + b + ' 种选法，两类任选其一 → ' + a + ' + ' + b
    });
  }

  // ============ 3. 排列组合初步 ============
  function genPerm() {
    if (_PU.randInt(0, 1) === 0) {
      // 选 k 个排列：从 n 个不同同学中选 k 个排成一排
      var n = _PU.randInt(4, 9), k = _PU.randInt(2, n - 1);
      var ans = P(n, k);
      return fillQ({
        type: 'perm',
        text: '从 ' + n + ' 个不同的同学中选出 ' + k + ' 个，排成一排（顺序不同算不同排法）。一共有 ____ 种排法。',
        answer: [ans],
        hint: '第 1 个位置有 ' + n + ' 种选法，第 2 个有 ' + (n - 1) + ' 种……相乘'
      });
    }
    // 选 k 个组合：从 n 个不同物品中选 k 个（不考虑顺序）
    var n2 = _PU.randInt(4, 9), k2 = _PU.randInt(2, Math.min(4, n2 - 1));
    var ans2 = C(n2, k2);
    return fillQ({
      type: 'perm',
      text: '从 ' + n2 + ' 个不同的物品中任选 ' + k2 + ' 个组成一组（不考虑顺序）。一共有 ____ 种不同的选法。',
      answer: [ans2],
      hint: '组合数 = ' + n2 + '! ÷ (' + k2 + '! × (' + n2 + '-' + k2 + ')!)'
    });
  }

  // ============ 4. 几何计数 ============
  function genGeomCount(sc) {
    if (_PU.randInt(0, 1) === 0) {
      // 数线段：一条直线上 p 个点 → C(p,2)
      var p = _PU.randInt(4, 20);
      var ans = C(p, 2);
      return fillQ({
        type: 'geomcount',
        text: '在一条直线上标了 ' + p + ' 个不同的点，以这些点为端点可以连出 ____ 条不同的线段。',
        answer: [ans],
        hint: '每 2 个点确定一条线段，从 ' + p + ' 个点中任选 2 个'
      });
    }
    // 数长方形：a×b 网格（横线 a+1 条、竖线 b+1 条）→ C(a+1,2)×C(b+1,2)
    var a = _PU.randInt(2, 6), b = _PU.randInt(2, 6);
    var ans2 = C(a + 1, 2) * C(b + 1, 2);
    return fillQ({
      type: 'geomcount',
      text: '一个由 ' + a + ' × ' + b + ' 个小正方形组成的长方形网格中，一共有 ____ 个长方形（含正方形）。',
      answer: [ans2],
      hint: '长方形由「选 2 条横线 + 选 2 条竖线」确定'
    });
  }

  // ============ 5. 最不利原则 ============
  function genWorst() {
    // 抽屉原理：c 种颜色的球各若干个，至少取几个保证有 k 个同色 → c*(k-1)+1
    var c = _PU.randInt(2, 10), k = _PU.randInt(2, 6);
    var ans = c * (k - 1) + 1;
    var colors = ['红', '黄', '蓝', '绿'].slice(0, c).join('、');
    return fillQ({
      type: 'worst',
      text: '抽屉里有 ' + colors + ' 这 ' + c + ' 种颜色的球各 ' + (k + 2) + ' 个（只看颜色，不看大小）。闭着眼睛至少取出 ____ 个，才能保证其中有 ' + k + ' 个颜色相同。',
      answer: [ans],
      hint: '先想最倒霉的情况：每种颜色都先取到 ' + (k - 1) + ' 个，再多取 1 个就必然有 ' + k + ' 个同色'
    });
  }

  // ============ 子题型分发 ============
  var GENERATORS = {
    enum: genEnum,
    am: genAM,
    perm: genPerm,
    geomcount: genGeomCount,
    worst: genWorst
  };
  var ALL_KEYS = ['enum', 'am', 'perm', 'geomcount', 'worst'];

  var plugin = _PU.createPlugin({
    id: 'math-competition-c3-counting',
    name: '组合计数',
    subject: 'math',
    grades: [4],
    category: 'number',
    moduleId: 'C3',
    description: '加乘原理、排列组合初步、枚举与容斥、几何计数与最不利原则',
    columns: 2,
    printConfig: { pageType: 'math' },

    settings: [
      {
        key: 'type', type: 'chip', label: '题型', default: 'mix',
        options: [
          { value: 'mix', label: '随机混合' },
          { value: 'enum', label: '枚举法' },
          { value: 'am', label: '加乘原理' },
          { value: 'perm', label: '排列组合' },
          { value: 'geomcount', label: '几何计数' },
          { value: 'worst', label: '最不利原则' }
        ]
      }
    ],

    knowledgePoints: {
      4: ['g4-c3-c3-enum', 'g4-c3-c3-am', 'g4-c3-c3-perm', 'g4-c3-c3-geomcount', 'g4-c3-c3-worst'],
      6: ['g6-c3-c3-enum', 'g6-c3-c3-am', 'g6-c3-c3-perm', 'g6-c3-c3-geomcount', 'g6-c3-c3-worst']
    },

    generateQuestions: function (opts) {
      opts = opts || {};
      var count = Math.max(1, opts.count || 10);
      var sc = scale(opts.difficulty || 3);
      var keys = (opts.type && opts.type !== 'mix' && GENERATORS[opts.type]) ? [opts.type] : ALL_KEYS;
      var out = [], seen = {}, guard = 0;

      while (out.length < count && guard < count * 60) {
        guard++;
        var k = keys.length === 1 ? keys[0] : _PU.rand(keys);
        var q = GENERATORS[k](sc);
        if (!q) continue;
        var sig = k + '|' + q.q + '|' + (q.svg || '');
        if (seen[sig]) continue;
        seen[sig] = 1;
        out.push(q);
      }
      var fill = 0;
      while (out.length < count && fill < count * 10) {
        fill++;
        var k2 = keys.length === 1 ? keys[0] : _PU.rand(keys);
        var q2 = GENERATORS[k2](sc);
        if (q2) out.push(q2);
      }
      return out;
    },

    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 4,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '组合计数'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
