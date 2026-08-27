// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c8-logic.js — 竞赛 C8 最值与逻辑推理
//
// 覆盖 C8 模块三个子题型（type 与 shared/knowledge-bank.js 四年级 C8 知识点一致）：
//   extreme 最值问题（给定数字组成最大/最小数 / 定和求最大积）
//   drawer  抽屉原理（N 个物体放入 M 个抽屉，至少有 ⌈N/M⌉ 个同屉）
//   logic   逻辑推理（比较链排位 / 唯一真话推理）
//
// 设计要点（竞赛题必须答案唯一）：所有子题型均为确定型计算，题面含全部所需数字/条件，
// 校验器从题面反解参数独立重算比对。答案统一为「数值」或「汉字名」，题面显式标注填法。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C8'、category:'statistics'、grades 与模块目录一致 [4,5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c8-logic.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 通用构造 ============
  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); },
      // 最值/抽屉/逻辑的答案是数值或汉字名，按精确字符串判定（委托 defaultQCheck）
      check: function (answers, idx) { return _PU.defaultQCheck(this, answers, idx); }
    };
  }

  /** 难度 → 规模（dmax 最值题数字个数上限 / smax 定和上限 / mMax 抽屉个数上限） */
  function scale(lv) {
    if (lv >= 8) return { dmax: 4, smax: 60, mMax: 6 };
    if (lv >= 5) return { dmax: 4, smax: 40, mMax: 5 };
    return { dmax: 3, smax: 24, mMax: 4 };
  }

  // ============ 1. 最值问题 ============
  // mode 0：给定互异数字组成最大的数（降序排列）
  // mode 1：定和求最大积（a+b=S，a*b 在 a、b 最接近时最大 = floor(S/2)*ceil(S/2)）
  // mode 2：给定互异数字组成最小的数（升序，但 0 不能作首位，需与首个非零交换）
  function genExtreme(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode !== 1) {
      var d = _PU.randInt(3, sc.dmax);
      var digits = _PU.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, d);
      if (mode === 0) {
        var desc = digits.slice().sort(function (a, b) { return b - a; });
        return fillQ({
          type: 'extreme',
          text: '用数字 ' + digits.join('、') + ' 各一次，组成最大的 ' + d + ' 位数是 ____。',
          answer: [Number(desc.join(''))],
          hint: '把数字从大到小排列：' + desc.join('') + ' 最大'
        });
      }
      // mode 2：最小数
      var asc = digits.slice().sort(function (a, b) { return a - b; });
      var arr = asc.slice();
      if (arr[0] === 0) {
        var ni = 1;
        for (var i = 1; i < arr.length; i++) { if (arr[i] !== 0) { ni = i; break; } }
        var tmp = arr[0]; arr[0] = arr[ni]; arr[ni] = tmp;   // 把首个非零换到最前，避免前导 0
      }
      return fillQ({
        type: 'extreme',
        text: '用数字 ' + digits.join('、') + ' 各一次，组成最小的 ' + d + ' 位数是 ____。',
        answer: [Number(arr.join(''))],
        hint: '把数字从小到大排，但 0 不能放最前面：' + arr.join('')
      });
    }
    // mode 1：定和求最大积
    var S = _PU.randInt(8, sc.smax);
    var a = Math.floor(S / 2), b = S - a;
    return fillQ({
      type: 'extreme',
      text: '把 ' + S + ' 拆成两个正整数，使它们的乘积最大，最大的乘积是 ____。',
      answer: [a * b],
      hint: '和一定时两数越接近积越大：' + a + ' + ' + b + ' = ' + S + '，积 = ' + a + ' × ' + b + ' = ' + (a * b)
    });
  }

  // ============ 2. 抽屉原理 ============
  // 把 N 个物体放进 M 个抽屉，至少有一个抽屉里放了不少于 ⌈N/M⌉ 个（N > M 保证答案 ≥ 2 且非平凡）
  function genDrawer(sc) {
    var M = _PU.randInt(2, sc.mMax);
    var N = _PU.randInt(M + 1, M * sc.mMax);
    var ans = Math.floor((N - 1) / M) + 1;   // = ⌈N/M⌉
    var phr = _PU.randInt(0, 2);
    var head;
    if (phr === 0) head = '把 ' + N + ' 个物品放进 ' + M + ' 个抽屉里，根据抽屉原理，至少有一个抽屉里放了不少于 ____ 个物品。';
    else if (phr === 1) head = '有 ' + N + ' 支铅笔要分给 ' + M + ' 个小朋友，至少有一个小朋友分到 ____ 支或更多。';
    else head = '把 ' + N + ' 本书放到 ' + M + ' 个书架上，至少有一个书架放了不少于 ____ 本。';
    return fillQ({
      type: 'drawer',
      text: head,
      answer: [ans],
      hint: N + ' ÷ ' + M + ' = ' + Math.floor(N / M) + ' 余 ' + (N % M) + '，至少有 1 个抽屉多放 1 个，故至少 ' + ans + ' 个'
    });
  }

  // ============ 3. 逻辑推理 ============
  var NAMES = ['甲', '乙', '丙'];
  var DIMS = [
    { pos: '高', neg: '矮', max: '最高', min: '最矮' },
    { pos: '重', neg: '轻', max: '最重', min: '最轻' },
    { pos: '快', neg: '慢', max: '最快', min: '最慢' },
    { pos: '大', neg: '小', max: '最大', min: '最小' }
  ];

  // 模式 A：比较链排位（三条人按某一维度构成全序链 o0 < o1 < o2，问最值端）
  // 关键点：比较句一律写成「前者 比 后者 维度词」，pos 词（高/重/快/大）表示前者更大、
  // neg 词（矮/轻/慢/小）表示前者更小。两种问法都描述同一条 o0<o1<o2 链，答案才不会错位。
  function genChain() {
    var names = _PU.shuffle(NAMES.slice());   // [o0, o1, o2]，统一约定 o0 < o1 < o2，统一约定 o0 < o1 < o2
    var dim = DIMS[_PU.randInt(0, DIMS.length - 1)];
    if (_PU.randInt(0, 1) === 0) {
      // 问最大：用 pos 词描述 o0<o1<o2（o1 比 o0 高、o2 比 o1 高），最大是 o2
      var ans = names[2];
      return fillQ({
        type: 'logic',
        text: names[1] + '比' + names[0] + dim.pos + '，' + names[2] + '比' + names[1] + dim.pos + '。三个人中' + dim.max + '的是谁？____',
        answer: [ans],
        hint: '关系链：' + names[0] + ' < ' + names[1] + ' < ' + names[2] + '，' + dim.max + '的是' + ans
      });
    }
    // 问最小：用 neg 词描述同一条 o0<o1<o2（o0 比 o1 轻、o1 比 o2 轻），最小是 o0
    var ans2 = names[0];
    return fillQ({
      type: 'logic',
      text: names[0] + '比' + names[1] + dim.neg + '，' + names[1] + '比' + names[2] + dim.neg + '。三个人中' + dim.min + '的是谁？____',
      answer: [ans2],
      hint: '关系链：' + names[0] + ' < ' + names[1] + ' < ' + names[2] + '，' + dim.min + '的是' + ans2
    });
  }

  // 模式 B：唯一真话推理（p 指认 q、q 与 r 都否认，恰一人说真话 → 是 r 拿的）
  function genWhodunit() {
    var names = _PU.shuffle(NAMES.slice());   // [p, q, r]
    var p = names[0], q = names[1], r = names[2];
    return fillQ({
      type: 'logic',
      text: p + '、' + q + '、' + r + ' 三人中，有一人拿走了老师的书。'
        + p + '说：「是' + q + '拿的。」' + q + '说：「不是我拿的。」' + r + '说：「不是我拿的。」'
        + '已知三人中只有一人说了真话。书是____拿的。',
      answer: [r],
      hint: '假设是' + r + '拿的：' + p + '说「是' + q + '」为假，' + q + '说「不是我」为真，' + r + '说「不是我」为假 → 恰一人说真话，成立'
    });
  }

  function genLogic() {
    return _PU.randInt(0, 1) === 0 ? genChain() : genWhodunit();
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var sc = scale(opts.difficulty || 6);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['extreme', 'drawer', 'logic'] : [type];
    var count = opts.count || 10;
    var map = { extreme: genExtreme, drawer: genDrawer, logic: genLogic };
    var questions = [], seen = {};
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var gen = map[key] || genExtreme;
      var q = null, tries = 0;
      do { q = gen(sc); tries++; } while (q && seen[q.q] && tries < 400);
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-c8-logic',
    name: '最值与逻辑推理',
    subject: 'math',
    category: 'statistics',
    grades: [4],
    moduleIds: ['C8'],
    knowledgePoints: {
      4: ['math-g4-c8-c8-extreme', 'math-g4-c8-c8-drawer', 'math-g4-c8-c8-logic']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',     label: '综合' },
        { value: 'extreme', label: '最值问题' },
        { value: 'drawer',  label: '抽屉原理' },
        { value: 'logic',   label: '逻辑推理' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 4,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '最值与逻辑推理'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
