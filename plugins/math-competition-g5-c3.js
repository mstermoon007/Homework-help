// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c3.js — 五年级竞赛 C3 组合计数（新语义题型）
// 实现题型（type 与知识库一致）：
//   add-principle  加法原理   分类方法数相加
//   mult-principle 乘法原理   分步方法数相乘
//   permutation    排列数     n!（n ≤ 6）
//   combination    组合数     C(n,k)（n ≤ 8，k ≤ 3）
//   enumeration    枚举计数   无重复两位数
//   pigeonhole     抽屉原理   至少 ceil(m/n)
//   worst-case     最不利原则  c 色取 k 同色：c(k-1)+1
// 设计要点：结果均为小整数，答案唯一；注意阶乘大数限制。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c3.js 依赖 shared/common.js');

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
  function comb(n, k) { return fact(n) / (fact(k) * fact(n - k)); }

  // ============ 1. 加法原理 ============
  function genAddPrinciple() {
    var a = _PU.randInt(3, 12), b = _PU.randInt(3, 12);
    return fillQ({
      type: 'add-principle',
      text: '书架上有 ' + a + ' 本语文书和 ' + b + ' 本数学书，从中任取 1 本，一共有 ____ 种取法。',
      answer: [a + b],
      hint: '分类用加法原理：' + a + '＋' + b + ' = ' + (a + b)
    });
  }

  // ============ 2. 乘法原理 ============
  function genMultPrinciple() {
    var a = _PU.randInt(3, 6), b = _PU.randInt(3, 6);
    return fillQ({
      type: 'mult-principle',
      text: '有 ' + a + ' 件上衣和 ' + b + ' 条裤子，每件上衣都能和每条裤子搭配，一共有 ____ 种不同的穿法。',
      answer: [a * b],
      hint: '分步用乘法原理：' + a + '×' + b + ' = ' + (a * b)
    });
  }

  // ============ 3. 排列数（选排列 P(n,k) / 全排列 n!） ============
  function genPermutation() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      var n = _PU.randInt(4, 9), k = _PU.randInt(2, Math.min(4, n - 1));
      var ans = fact(n) / fact(n - k);
      return fillQ({
        type: 'permutation',
        text: '从 ' + n + ' 个不同的同学中选出 ' + k + ' 个，排成一排（顺序不同算不同排法），一共有 ____ 种排法。',
        answer: [ans],
        hint: '选排列 P(' + n + ',' + k + ') = ' + Array.from({ length: k }, function (_, i) { return n - i; }).join('×') + ' = ' + ans
      });
    }
    var m = _PU.randInt(3, 8);
    return fillQ({
      type: 'permutation',
      text: m + ' 个不同的同学排成一排（顺序不同算不同排法），一共有 ____ 种排法。',
      answer: [fact(m)],
      hint: '全排列 ' + m + '! = ' + Array.from({ length: m }, function (_, i) { return m - i; }).join('×') + ' = ' + fact(m)
    });
  }

  // ============ 4. 组合数 ============
  function genCombination() {
    var n = _PU.randInt(4, 8), k = _PU.randInt(2, 3);
    if (k >= n) k = 2;
    return fillQ({
      type: 'combination',
      text: '从 ' + n + ' 个不同的同学中选出 ' + k + ' 个组成一组（不考虑顺序），一共有 ____ 种不同的选法。',
      answer: [comb(n, k)],
      hint: '组合数 C(' + n + ',' + k + ') = ' + n + '!÷(' + k + '!×(' + (n - k) + ')!) = ' + comb(n, k)
    });
  }

  // ============ 5. 枚举计数（无重复两位数 / 三位数） ============
  function genEnumeration() {
    var mode = _PU.randInt(0, 1);
    if (mode === 1) {
      var m = _PU.randInt(4, 7);
      var arr3 = [];
      for (var i = 1; i <= m; i++) arr3.push(i);
      return fillQ({
        type: 'enumeration',
        text: '用数字 ' + arr3.join('、') + ' 各一次，能组成 ____ 个无重复数字的三位数。',
        answer: [m * (m - 1) * (m - 2)],
        hint: '百位 ' + m + ' 种、十位 ' + (m - 1) + ' 种、个位 ' + (m - 2) + ' 种：' + m + '×' + (m - 1) + '×' + (m - 2) + ' = ' + (m * (m - 1) * (m - 2))
      });
    }
    var n = _PU.randInt(3, 9);
    var arr = [];
    for (var j = 1; j <= n; j++) arr.push(j);
    return fillQ({
      type: 'enumeration',
      text: '用数字 ' + arr.join('、') + ' 各一次，能组成 ____ 个无重复数字的两位数。',
      answer: [n * (n - 1)],
      hint: '十位 ' + n + ' 种选法，个位剩 ' + (n - 1) + ' 种：' + n + '×' + (n - 1) + ' = ' + (n * (n - 1))
    });
  }

  // ============ 6. 抽屉原理 ============
  function genPigeonhole() {
    var n = _PU.randInt(3, 5), m = _PU.randInt(n + 1, n + 10);
    var ans = Math.ceil(m / n);
    return fillQ({
      type: 'pigeonhole',
      text: '把 ' + m + ' 个苹果放进 ' + n + ' 个抽屉，无论怎么放，至少有一个抽屉里有 ____ 个或更多苹果。',
      answer: [ans],
      hint: '尽量平均：' + m + '÷' + n + ' = ' + Math.floor(m / n) + '……' + (m % n) + '，商加 1 → 至少 ' + ans + ' 个'
    });
  }

  // ============ 7. 最不利原则 ============
  function genWorstCase() {
    var c = _PU.randInt(3, 6), k = _PU.randInt(2, 4);
    var ans = c * (k - 1) + 1;
    var colors = ['红、黄、蓝', '红、黄、蓝、绿', '红、黄、蓝、绿、紫', '红、黄、蓝、绿、紫、橙'][c - 3];
    return fillQ({
      type: 'worst-case',
      text: '袋中有' + colors + '这 ' + c + ' 种颜色的球各若干个（只看颜色），闭着眼睛至少取出 ____ 个，才能保证其中有 ' + k + ' 个颜色相同。',
      answer: [ans],
      hint: '最不利情况：每种颜色都先取 ' + (k - 1) + ' 个（共 ' + (c * (k - 1)) + ' 个），再多取 1 个 → ' + ans + ' 个'
    });
  }


  // ============ 捆绑法 ============
  function genBundling() {
    var n = _PU.randInt(4, 6), pairs = _PU.randInt(1, Math.floor(n / 2));
    var totalPeople = n, bundles = n - pairs; // 捆绑后元素数
    var fact = function (k) { var r = 1; for (var i = 2; i <= k; i++) r *= i; return r; };
    var ans = fact(bundles) * Math.pow(2, pairs); // 捆绑排列 × 内部排列
    if (pairs > 1) ans = fact(bundles) * Math.pow(2, pairs); // 简化模型
    return fillQ({
      type: 'bundling',
      text: n + ' 名同学排成一排，其中 ' + (pairs * 2) + ' 名同学两两相邻（形成 ' + pairs +
        ' 对），一共有多少种不同的排法？',
      answer: [ans],
      hint: '捆绑法：先把每对看作一个整体，共 ' + bundles + ' 个元素排列 = ' + fact(bundles) +
        ' 种；再乘每对内部排列 2^' + pairs + '=' + Math.pow(2, pairs) + ' → ' + ans
    });
  }

  // ============ 插空法 ============
  function genInsertion() {
    var boys = _PU.randInt(4, 6), girls = _PU.randInt(2, 3);
    var fact = function (k) { var r = 1; for (var i = 2; i <= k; i++) r *= i; return r; };
    var slots = boys + 1;
    var permGirls = fact(girls), permBoys = fact(boys);
    // 从 slots 个空中选 girls 个排列
    var pick = 1;
    for (var i = 0; i < girls; i++) pick *= (slots - i);
    var ans = permBoys * pick;
    return fillQ({
      type: 'insertion',
      text: boys + ' 名男生和 ' + girls + ' 名女生排成一排，要求女生互不相邻，有多少种排法？',
      answer: [ans],
      hint: '先排男生 ' + permBoys + ' 种，产生 ' + slots + ' 个空位；从空位中选 ' + girls + ' 个排女生 = ' + pick + ' → 合计 ' + ans
    });
  }

  // ============ 隔板法 ============
  function genStarsBars() {
    var items = _PU.randInt(8, 15), people = _PU.randInt(2, 4);
    // 正整数解：C(items-1, people-1)
    var nk1 = items - 1, nr = people - 1;
    var result = 1;
    for (var i = 0; i < nr; i++) result = result * (nk1 - i) / (i + 1);
    result = Math.round(result);
    return fillQ({
      type: 'stars-bars',
      text: '把 ' + items + ' 个相同的苹果分给 ' + people + ' 个小朋友，每人至少分 1 个，有多少种不同的分法？',
      answer: [result],
      hint: '隔板法：在 ' + (items - 1) + ' 个空隙中插 ' + (people - 1) + ' 块板 = C(' + (items - 1) + ',' + (people - 1) + ') = ' + result
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['add-principle', 'mult-principle', 'permutation', 'combination', 'enumeration',
         'pigeonhole', 'worst-case', 'bundling', 'insertion', 'stars-bars']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'add-principle': genAddPrinciple, 'mult-principle': genMultPrinciple, permutation: genPermutation,
      combination: genCombination, enumeration: genEnumeration, pigeonhole: genPigeonhole, 'worst-case': genWorstCase, bundling: genBundling, insertion: genInsertion, 'stars-bars': genStarsBars
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c3',
    name: '组合计数（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5],
    moduleId: 'C3',
    knowledgePoints: {
      5: ['math-g5-c3-addition-principle', 'math-g5-c3-multiplication-principle', 'math-g5-c3-permutation',
          'math-g5-c3-combination', 'math-g5-c3-enumeration-counting', 'math-g5-c3-pigeonhole-principle', 'math-g5-c3-bundling-method', 'math-g5-c3-insertion-method', 'math-g5-c3-stars-bars', 'math-g5-c3-worst-case-principle']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'add-principle',  label: '加法原理' },
        { value: 'mult-principle', label: '乘法原理' },
        { value: 'permutation',    label: '排列数' },
        { value: 'combination',    label: '组合数' },
        { value: 'enumeration',    label: '枚举计数' },
        { value: 'pigeonhole',     label: '抽屉原理' },
        { value: 'worst-case',     label: '最不利原则' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '组合计数（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
