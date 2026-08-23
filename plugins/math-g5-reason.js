/**
 * plugins/math-g5-reason.js — 五年级推理与数学广角插件（M10 推理）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M10 模块）：
 *   g5-m10-g5-reason-tree3   植树问题（三种情况）  （type: 'tree-three'）
 *   g5-m10-g5-reason-defect  找次品（天平称量）    （type: 'defective-scale'）
 *   g5-m10-logic-reasoning   逻辑推理              （type: 'logic'）
 *   g5-m10-g5-reason-seq     数字推理              （type: 'sequence'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-reason.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============ 植树问题（三种情况） ============
  function buildTreeThree() {
    var v = pick(['both', 'one', 'none', 'ring']);
    var interval = pick([2, 3, 5, 10]);
    var n = rnd(4, 10); // 段数
    var q, ans;
    var dist = n * interval;
    if (v === 'both') {
      ans = n + 1;
      q = '在一条 ' + dist + ' 米的小路一边植树，每隔 ' + interval + ' 米栽一棵，两端都栽，要栽（  ）棵';
    } else if (v === 'one') {
      ans = n;
      q = '在一条 ' + dist + ' 米的小路一边植树，每隔 ' + interval + ' 米栽一棵，只栽一端，要栽（  ）棵';
    } else if (v === 'none') {
      if (n < 3) n = 4;
      ans = n - 1;
      q = '在一条 ' + (n * interval) + ' 米的小路一边植树，每隔 ' + interval + ' 米栽一棵，两端都不栽，要栽（  ）棵';
    } else {
      ans = n;
      q = '在一个周长 ' + dist + ' 米的圆形花坛周围种树，每隔 ' + interval + ' 米种一棵，一共种（  ）棵';
    }
    var hint = v === 'both' ? '两端都栽：棵数 = 段数 + 1' : v === 'one' || v === 'ring' ? '棵数 = 段数' : '两端都不栽：棵数 = 段数 − 1';
    return { q: q, answer: ans, hint: hint };
  }

  // ============ 找次品（天平称量） ============
  function buildDefectiveScale() {
    var n = rnd(2, 4);
    var items = Math.pow(3, n);
    return { q: '有 ' + items + ' 个零件，其中 1 个是次品（稍轻），用天平至少称（  ）次保证找出次品', answer: n, hint: '每次分成 3 份，' + items + ' = 3^' + n + '，至少称 ' + n + ' 次。' };
  }

  // ============ 逻辑推理 ============
  function buildLogic() {
    var v = pick(['color', 'job', 'order']);
    if (v === 'color') {
      var q = '有三个小朋友分别穿红、黄、蓝三件上衣。甲说：我不是红的。乙说：我是黄的。丙说：我穿的是蓝色的。已知丙说的是真的。请问丙穿（  ）色上衣';
      return { q: q, answer: '蓝', hint: '丙说真话，穿蓝色。' };
    }
    if (v === 'job') {
      var people = ['甲', '乙', '丙'];
      var jobs = ['老师', '医生', '警察'];
      var q = '甲、乙、丙三人分别是老师、医生、警察。甲说：我不是老师。乙说：我是警察。已知乙说的是真的。请问乙的职业是（  ）';
      return { q: q, answer: '警察', hint: '乙说真话，是警察。' };
    }
    // 数字排序
    var nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 3);
    var sorted = nums.slice().sort(function (x, y) { return x - y; });
    return { q: '把 ' + nums.join('、') + ' 按从小到大排列是（  ）', answer: sorted.join('<'), hint: '按大小排序。' };
  }

  // ============ 数字推理 ============
  function buildSequence() {
    var v = pick(['add', 'mul', 'pattern']);
    var seq = [];
    if (v === 'add') {
      var start = rnd(1, 9), step = rnd(2, 6);
      for (var i = 0; i < 5; i++) seq.push(start + i * step);
      var next = seq[4] + step;
      return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next, hint: '每次增加 ' + step + '。' };
    }
    if (v === 'mul') {
      var start2 = rnd(2, 5), factor = rnd(2, 3);
      for (var j = 0; j < 5; j++) seq.push(start2 * Math.pow(factor, j));
      var next2 = seq[4] * factor;
      return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next2, hint: '每次乘 ' + factor + '。' };
    }
    // 交叉/间隔规律：奇数项加2，偶数项不变（简化为等差数列）
    var start3 = rnd(1, 9), step3 = rnd(3, 5);
    for (var k = 0; k < 5; k++) seq.push(start3 + k * step3);
    var next3 = seq[4] + step3;
    return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next3, hint: '每次增加 ' + step3 + '。' };
  }

  // ============ 综合推理 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 28) return buildTreeThree();
    if (r <= 52) return buildDefectiveScale();
    if (r <= 76) return buildLogic();
    return buildSequence();
  }

  var TYPE_BUILDERS = {
    'tree-three': buildTreeThree,
    'defective-scale': buildDefectiveScale,
    'logic': buildLogic,
    'sequence': buildSequence,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'tree-three': '植树问题（三种情况）',
    'defective-scale': '找次品（天平称量）',
    'logic': '逻辑推理',
    'sequence': '数字推理',
    mix: '综合推理'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-reason',
    moduleId: 'M10',
    name: '推理与数学广角',
    pageSubtitle: '植树、找次品、逻辑与数字推理',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g5-m10-g5-reason-tree3',
        'g5-m10-g5-reason-defect',
        'g5-m10-logic-reasoning',
        'g5-m10-g5-reason-seq'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合推理' },
          { value: 'tree-three', label: '植树问题（三种情况）' },
          { value: 'defective-scale', label: '找次品（天平称量）' },
          { value: 'logic', label: '逻辑推理' },
          { value: 'sequence', label: '数字推理' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'reason', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级推理与数学广角（' + (TYPE_NAMES[type] || '综合推理') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);