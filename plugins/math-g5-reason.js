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


  // ============ 植树问题（三种情况） ============
  function buildTreeThree() {
    var v = _PU.rand(['both', 'one', 'none', 'ring']);
    var interval = _PU.rand([2, 3, 4, 5, 6, 10]);
    var n = _PU.randInt(4, 12); // 段数
    var scene = _PU.rand(['小路', '街道', '河堤', '走廊', '操场']);
    var q, ans;
    var dist = n * interval;
    if (v === 'both') {
      ans = n + 1;
      q = '在一条 ' + dist + ' 米的' + scene + '一边植树，每隔 ' + interval + ' 米栽一棵，两端都栽，要栽（  ）棵';
    } else if (v === 'one') {
      ans = n;
      q = '在一条 ' + dist + ' 米的' + scene + '一边植树，每隔 ' + interval + ' 米栽一棵，只栽一端，要栽（  ）棵';
    } else if (v === 'none') {
      if (n < 3) n = 4;
      ans = n - 1;
      q = '在一条 ' + (n * interval) + ' 米的' + scene + '一边植树，每隔 ' + interval + ' 米栽一棵，两端都不栽，要栽（  ）棵';
    } else {
      ans = n;
      q = '在一个周长 ' + dist + ' 米的圆形花坛周围种树，每隔 ' + interval + ' 米种一棵，一共种（  ）棵';
    }
    var hint = v === 'both' ? '两端都栽：棵数 = 段数 + 1' : v === 'one' || v === 'ring' ? '棵数 = 段数' : '两端都不栽：棵数 = 段数 − 1';
    return { q: q, answer: ans, hint: hint };
  }

  // ============ 找次品（天平称量） ============
  function buildDefectiveScale() {
    var n = _PU.randInt(8, 400);
    var ans = Math.ceil(Math.log(n) / Math.log(3));
    return { q: '有 ' + n + ' 个零件，其中 1 个是次品（稍轻），用天平至少称（  ）次保证找出次品', answer: ans, hint: '每次尽量平均分成 3 份，需要称 ' + ans + ' 次（3^' + ans + ' = ' + Math.pow(3, ans) + ' ≥ ' + n + '）。' };
  }

  // ============ 逻辑推理 ============
  function buildLogic() {
    var v = _PU.rand(['truth', 'job', 'order']);
    if (v === 'order') {
      var nums = _PU.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, _PU.randInt(3, 4));
      var sorted = nums.slice().sort(function (x, y) { return x - y; });
      return { q: '把 ' + nums.join('、') + ' 按从小到大排列是（  ）', answer: sorted.join('<'), hint: '按大小排序。' };
    }
    if (v === 'job') {
      var jobs = _PU.shuffle(['老师', '医生', '警察']);
      var t = _PU.randInt(0, 2);
      var others = jobs.filter(function (j) { return j !== jobs[t]; });
      var kids = ['甲', '乙', '丙'];
      var ok = kids.filter(function (k) { return k !== kids[t]; });
      var s1 = kids[t] + '说：我是' + jobs[t] + '。';
      var s2 = ok[0] + '说：我是' + others[1] + '。';
      var s3 = ok[1] + '说：' + ok[0] + '是' + jobs[t] + '。';
      return { q: '甲、乙、丙三人分别是' + jobs[0] + '、' + jobs[1] + '、' + jobs[2] + '。' + s1 + s2 + s3 + '已知只有一人说真话。请问' + kids[t] + '的职业是（  ）', answer: jobs[t], hint: kids[t] + '说真话，是' + jobs[t] + '。' };
    }
    // 真话推理（颜色）
    var kids2 = ['甲', '乙', '丙'];
    var t2 = _PU.randInt(0, 2);
    var cols = _PU.shuffle(['红', '黄', '蓝']);
    var tc = cols[_PU.randInt(0, 2)];
    var rest = cols.filter(function (c) { return c !== tc; });
    var ok2 = kids2.filter(function (k) { return k !== kids2[t2]; });
    var st1 = kids2[t2] + '说：我穿的是' + tc + '色的。';
    var st2 = ok2[0] + '说：我穿的是' + rest[1] + '色的。';
    var st3 = ok2[1] + '说：' + ok2[0] + '穿的是' + tc + '色的。';
    return { q: '甲、乙、丙三人分别穿红、黄、蓝三件上衣（每人一件，颜色不同）。' + st1 + st2 + st3 + '已知三人中只有一个人说的是真话。问：' + kids2[t2] + '穿（  ）色上衣', answer: tc, hint: kids2[t2] + '说的是真话，所以穿' + tc + '色。' };
  }

  // ============ 数字推理 ============
  function buildSequence() {
    var v = _PU.rand(['add', 'mul', 'pattern', 'fib']);
    var seq = [];
    if (v === 'add') {
      var start = _PU.randInt(1, 15), step = _PU.randInt(2, 9);
      for (var i = 0; i < 5; i++) seq.push(start + i * step);
      var next = seq[4] + step;
      return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next, hint: '每次增加 ' + step + '。' };
    }
    if (v === 'mul') {
      var start2 = _PU.randInt(2, 7), factor = _PU.randInt(2, 4);
      for (var j = 0; j < 5; j++) seq.push(start2 * Math.pow(factor, j));
      var next2 = seq[4] * factor;
      return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next2, hint: '每次乘 ' + factor + '。' };
    }
    if (v === 'fib') {
      var f1 = _PU.randInt(1, 6), f2 = _PU.randInt(1, 6);
      var fa = f1, fb = f2;
      var arr = [fa, fb];
      for (var fi = 0; fi < 3; fi++) { var fn = fa + fb; arr.push(fn); fa = fb; fb = fn; }
      return { q: '找规律填数：' + arr.join('、') + '、（  ）', answer: fa + fb, hint: '从第三项起，每项等于前两项之和。' };
    }
    // 间隔规律：奇数项、偶数项分别成等差
    var start3 = _PU.randInt(1, 9), step3 = _PU.randInt(3, 7);
    for (var k = 0; k < 5; k++) seq.push(start3 + k * step3);
    var next3 = seq[4] + step3;
    return { q: '找规律填数：' + seq.join('、') + '、（  ）', answer: next3, hint: '每次增加 ' + step3 + '。' };
  }

  // ============ 综合推理 ============
  function buildMixed() {
    var r = _PU.randInt(1, 100);
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
        'math-g5-m10-g5-reason-tree3',
        'math-g5-m10-g5-reason-defect',
        'math-g5-m10-logic-reasoning',
        'math-g5-m10-g5-reason-seq'
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