// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c1-numberpuzzle.js — 竞赛 C1 数字谜与数阵图
//
// 覆盖 C1 模块五个子题型（type 与 shared/knowledge-bank.js 四年级 C1 知识点一致）：
//   vertical   竖式数字谜（加/减竖式填缺失数字）
//   horizontal 横式数字谜（等式中填运算符号）
//   symbol     符号代表数（相同图形=相同数字，位值原理推理）
//   array      数阵图（辐射型，每条线三数之和相等）
//   magic      幻方（三阶幻方补全）
//
// 设计要点（竞赛题不同于常规练习，必须保证「答案唯一」）：
//   所有子题型均采用「先随机构造 → 再暴力枚举校验解唯一 → 不唯一就重抽」的生成策略。
//   若不校验唯一性，学生给出另一个同样成立的答案会被误判为错误。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C1'、category:'number'（勿填 'competition'）、grades 与模块目录一致 [4,5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数统一走 PluginUtil、题面图形走 q.svg
//   （renderCard 输出 .scene-box），样式由 shared/components.css 维护，插件内不写内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c1-numberpuzzle.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 通用构造 ============
  // answer：数字/符号数组（按题面声明的填写顺序）；inputType:'multi' 由 defaultQCheck 分字段判定
  // figure：题面图形 HTML，交给 renderCard 的 q.svg 槽位（渲染进 .scene-box，样式全在 components.css）
  function fillQ(cfg) {
    var q = {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
    if (cfg.check) q.check = cfg.check;
    return q;
  }

  /** 难度 → 各子题型规模（practice.html 传 opts.difficulty，1-10，默认 3） */
  function scale(lv) {
    if (lv >= 8) return { vBlank: 3, hNum: 4, mBlank: 4 };
    if (lv >= 5) return { vBlank: 2, hNum: _PU.randInt(3, 4), mBlank: 3 };
    return { vBlank: 2, hNum: 3, mBlank: 3 };
  }

  function digits3(n) {
    var s = String(n);
    while (s.length < 3) s = '0' + s;
    return s.split('').map(Number);
  }

  // ============ 1. 竖式数字谜 ============
  // 构造 a + b = s（三位数），随机挖 vBlank 个空；减法形态只是换个显示：s － a = b。
  // 唯一性：枚举空位的所有数字组合（10^vBlank ≤ 1000），要求恰有一组解使竖式成立。
  function genVertical(sc) {
    var nBlank = sc.vBlank;
    for (var t = 0; t < 400; t++) {
      var a = _PU.randInt(102, 798);
      var b = _PU.randInt(102, 999 - a);
      var s = a + b;
      if (s < 100 || s > 999) continue;
      var d = digits3(a).concat(digits3(b), digits3(s));   // 9 位：0-2 加数a / 3-5 加数b / 6-8 和
      var pos = _PU.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, nBlank);

      // —— 唯一性校验：枚举所有填法 ——
      var sols = 0;
      var total = Math.pow(10, nBlank);
      for (var n = 0; n < total; n++) {
        var dd = d.slice(), rest = n;
        for (var i = 0; i < nBlank; i++) { dd[pos[i]] = rest % 10; rest = Math.floor(rest / 10); }
        if (dd[0] === 0 || dd[3] === 0 || dd[6] === 0) continue;      // 三个数首位均不为 0
        var na = dd[0] * 100 + dd[1] * 10 + dd[2];
        var nb = dd[3] * 100 + dd[4] * 10 + dd[5];
        var ns = dd[6] * 100 + dd[7] * 10 + dd[8];
        if (na + nb === ns) { sols++; if (sols > 1) break; }
      }
      if (sols !== 1) continue;

      // —— 显示：加法 a+b=s；减法 s-a=b（行序不同，答案顺序随显示顺序） ——
      var isSub = _PU.randInt(0, 1) === 1;
      var origOrder = isSub ? [6, 7, 8, 0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
      var rank = {};
      origOrder.forEach(function (orig, i) { rank[orig] = i; });
      var sorted = pos.slice().sort(function (p, q2) { return rank[p] - rank[q2]; });
      var answer = sorted.map(function (p) { return d[p]; });

      function triple(start) {
        return [0, 1, 2].map(function (i) {
          return pos.indexOf(start + i) >= 0 ? '□' : d[start + i];
        }).join('');
      }
      var rows = isSub ? [triple(6), triple(0), triple(3)] : [triple(0), triple(3), triple(6)];
      var op = isSub ? '－' : '＋';
      var figure = '<div class="vert-eq">' +
        '<div class="ve-row"><span class="ve-op"></span>' + rows[0] + '</div>' +
        '<div class="ve-row"><span class="ve-op">' + op + '</span>' + rows[1] + '</div>' +
        '<div class="ve-rule"></div>' +
        '<div class="ve-row"><span class="ve-op"></span>' + rows[2] + '</div>' +
        '</div>';
      return fillQ({
        type: 'vertical',
        text: '在竖式的 □ 里填上合适的数字（按从上到下、从左到右的顺序填写）。',
        figure: figure,
        answer: answer,
        hint: '从个位算起逐位推理，注意进位与借位'
      });
    }
    return null;
  }

  // ============ 2. 横式数字谜（填运算符号） ============
  var H_OPS = ['＋', '－', '×', '÷'];
  // 键盘无法直接输入 ×÷，判定时把常见等价写法归一（+ - * / x X 全角半角通吃）
  var OP_SYN = {
    '+': '+', '＋': '+', '－': '-', '-': '-', '−': '-', '–': '-', '—': '-',
    '×': '*', '*': '*', 'x': '*', '✕': '*', 'ｘ': '*',
    '÷': '/', '/': '/', '／': '/', '\\': '/'
  };
  function normOp(v) {
    var s = String(v == null ? '' : v).trim();
    return OP_SYN[s] || OP_SYN[s.toLowerCase()] || s.toLowerCase();
  }
  function opCheck(answers, idx) {
    var ans = this.answer;
    for (var j = 0; j < ans.length; j++) {
      var uv = answers ? answers[idx + ':' + j] : undefined;
      if (normOp(uv) !== normOp(ans[j])) return false;
    }
    return true;
  }

  /** 按四则运算优先级求值；除不尽、除以 0、出现负数中间值 → 返回 null（四年级不出负数） */
  function evalOps(nums, ops) {
    var v = nums.slice(), o = ops.slice(), i = 0;
    while (i < o.length) {
      if (o[i] === '×' || o[i] === '÷') {
        var x = v[i], y = v[i + 1], r;
        if (o[i] === '×') r = x * y;
        else { if (y === 0 || x % y !== 0) return null; r = x / y; }
        v.splice(i, 2, r); o.splice(i, 1);
      } else i++;
    }
    var acc = v[0];
    for (var j = 0; j < o.length; j++) {
      acc = (o[j] === '＋') ? acc + v[j + 1] : acc - v[j + 1];
      if (acc < 0) return null;
    }
    return acc;
  }

  function opCombos(k) {
    var out = [[]];
    for (var i = 0; i < k; i++) {
      var next = [];
      out.forEach(function (c) { H_OPS.forEach(function (o) { next.push(c.concat([o])); }); });
      out = next;
    }
    return out;
  }

  // 唯一性：枚举全部 4^(n-1) 种符号组合，只取「该结果仅有一种填法」的目标值，
  // 并要求至少用到两种不同符号（排除「全是 ＋」这类过易题）。
  function genHorizontal(sc) {
    for (var t = 0; t < 300; t++) {
      var n = sc.hNum;
      var nums = [];
      for (var i = 0; i < n; i++) nums.push(_PU.randInt(2, 12));
      var byVal = {};
      opCombos(n - 1).forEach(function (c) {
        var r = evalOps(nums, c);
        if (r === null || r < 1 || r > 120) return;
        (byVal[r] = byVal[r] || []).push(c);
      });
      var cands = Object.keys(byVal).filter(function (k) {
        if (byVal[k].length !== 1) return false;
        var kinds = {};
        byVal[k][0].forEach(function (o) { kinds[o] = 1; });
        return Object.keys(kinds).length >= 2;
      });
      if (!cands.length) continue;
      var target = _PU.rand(cands);
      var ops = byVal[target][0];
      var expr = String(nums[0]);
      for (var j = 0; j < ops.length; j++) expr += ' □ ' + nums[j + 1];
      expr += ' ＝ ' + target;
      return fillQ({
        type: 'horizontal',
        text: '在 □ 里填入 ＋、－、×、÷，使等式成立（按从左到右的顺序填写，也可输入 + - * /）。',
        figure: '<div class="puzzle-expr">' + expr + '</div>',
        answer: ops,
        hint: '先看结果比原数大还是小，缩小符号范围；注意先乘除后加减',
        check: opCheck
      });
    }
    return null;
  }

  // ============ 3. 符号代表数 ============
  /** 枚举 △∈1..9、○∈0..9（△≠○）中满足条件的解 */
  function solveSymbol(pred) {
    var out = [];
    for (var x = 1; x <= 9; x++) {
      for (var y = 0; y <= 9; y++) {
        if (x === y) continue;
        if (pred(x, y)) out.push([x, y]);
      }
    }
    return out;
  }

  function genSymbol() {
    for (var t = 0; t < 300; t++) {
      var kind = _PU.randInt(1, 3);
      var tri, cir, expr, hint, pred;

      if (kind === 1) {
        // △○ ＋ ○△ ＝ S 且 △○ － ○△ ＝ D（两式联立才唯一：和定 △+○，差定 △-○）
        tri = _PU.randInt(2, 9); cir = _PU.randInt(1, 8);
        if (tri <= cir) continue;
        var ab = tri * 10 + cir, ba = cir * 10 + tri;
        var S1 = ab + ba, D1 = ab - ba;
        pred = function (x, y) { return (x * 10 + y) + (y * 10 + x) === S1 && (x * 10 + y) - (y * 10 + x) === D1; };
        expr = '△○ ＋ ○△ ＝ ' + S1 + '<br>△○ － ○△ ＝ ' + D1;
        hint = '△○ ＋ ○△ ＝ 11×(△＋○)，△○ － ○△ ＝ 9×(△－○)';
      } else if (kind === 2) {
        // △△ ＋ ○ ＝ S（11×△ ＋ ○ ＝ S，因 ○≤9 故解唯一）
        tri = _PU.randInt(1, 9); cir = _PU.randInt(0, 9);
        if (tri === cir) continue;
        var S2 = tri * 11 + cir;
        pred = function (x, y) { return x * 11 + y === S2; };
        expr = '△△ ＋ ○ ＝ ' + S2;
        hint = '把 △△ 看作 11×△，先估 △ 大约是多少';
      } else {
        // △ × ○ ＝ P 且 △ ＋ ○ ＝ S，且 △ ＞ ○
        tri = _PU.randInt(2, 9); cir = _PU.randInt(1, 8);
        if (tri <= cir) continue;
        var P3 = tri * cir, S3 = tri + cir;
        pred = function (x, y) { return x > y && x * y === P3 && x + y === S3; };
        expr = '△ × ○ ＝ ' + P3 + '<br>△ ＋ ○ ＝ ' + S3 + '<br>（△ ＞ ○）';
        hint = '把 P 拆成两个数的积，再看哪一对的和符合要求';
      }

      if (solveSymbol(pred).length !== 1) continue;   // 唯一性守卫
      return fillQ({
        type: 'symbol',
        text: '相同图形代表相同数字，不同图形代表不同数字。求 △ 和 ○（按 △、○ 的顺序填写）。',
        figure: '<div class="puzzle-expr">' + expr + '</div>',
        answer: [tri, cir],
        hint: hint
      });
    }
    return null;
  }

  // ============ 4. 数阵图（辐射型） ============
  // 中心 c，外圈用 1~7 中除 c 以外的 6 个数各一次，三条线（中心＋两端）三数之和都等于 S。
  // 由 3S = 2c + 28 推出 c 只能取 1、4、7（S 分别为 10、12、14）。
  // 唯一性：每条线只留一个空 → 该空 = S － 中心 － 另一端，必然唯一（若一条线留两个空，
  // 两数只知其和、顺序不定，答案就不唯一，因此这里严格保证「每线一空」）。
  function genArray() {
    var c = _PU.rand([1, 4, 7]);
    var S = (2 * c + 28) / 3;
    var pairSum = S - c;
    var rest = [1, 2, 3, 4, 5, 6, 7].filter(function (v) { return v !== c; });
    var used = {}, pairs = [];
    rest.forEach(function (v) {
      if (used[v]) return;
      var w = pairSum - v;
      if (w === v || used[w] || rest.indexOf(w) < 0) return;
      used[v] = 1; used[w] = 1;
      pairs.push([v, w]);
    });
    if (pairs.length !== 3) return null;
    pairs = _PU.shuffle(pairs).map(function (p) { return _PU.shuffle(p); });

    var blankAt = pairs.map(function () { return _PU.randInt(0, 1); });
    var answer = pairs.map(function (p, i) { return p[blankAt[i]]; });
    var LBL = ['①', '②', '③'];
    var rows = pairs.map(function (p, i) {
      var e0 = blankAt[i] === 0 ? '<span class="al-blank">□</span>' : p[0];
      var e1 = blankAt[i] === 1 ? '<span class="al-blank">□</span>' : p[1];
      return '<div class="al-row">线' + LBL[i] + '：' + c + ' ＋ ' + e0 + ' ＋ ' + e1 + ' ＝ ' + S + '</div>';
    });
    return fillQ({
      type: 'array',
      text: '辐射型数阵图：中心是 ' + c + '，外圈的 6 个数是 1~7 中除 ' + c + ' 以外的数各用一次，'
        + '三条线（中心＋两端）的三数之和都等于 ' + S + '。填出 □ 里的数（按线①→线③ 的顺序填写）。',
      figure: '<div class="array-lines">' + rows.join('') + '</div>',
      answer: answer,
      hint: '每条线的和是固定的，用 ' + S + ' 减去这条线上已知的两个数'
    });
  }

  // ============ 5. 幻方（三阶） ============
  var LOSHU = [[8, 1, 6], [3, 5, 7], [4, 9, 2]];   // 幻和 15；三阶幻方在旋转/翻转下唯一
  function rot90(m) {
    return [[m[2][0], m[1][0], m[0][0]], [m[2][1], m[1][1], m[0][1]], [m[2][2], m[1][2], m[0][2]]];
  }
  function mirror(m) {
    return [m[0].slice().reverse(), m[1].slice().reverse(), m[2].slice().reverse()];
  }
  function variant(k) {
    var m = LOSHU;
    for (var i = 0; i < (k % 4); i++) m = rot90(m);
    return k >= 4 ? mirror(m) : m;
  }
  function isMagic(f) {
    var S = 15, r, c;
    for (r = 0; r < 3; r++) if (f[r * 3] + f[r * 3 + 1] + f[r * 3 + 2] !== S) return false;
    for (c = 0; c < 3; c++) if (f[c] + f[c + 3] + f[c + 6] !== S) return false;
    return (f[0] + f[4] + f[8] === S) && (f[2] + f[4] + f[6] === S);
  }
  function permutations(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var out = [];
    arr.forEach(function (v, i) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permutations(rest).forEach(function (p) { out.push([v].concat(p)); });
    });
    return out;
  }

  // 唯一性：把挖掉的数打乱重填（全排列 ≤ 24 种），要求只有一种排法能构成幻方
  function genMagic(sc) {
    var nBlank = sc.mBlank;
    for (var t = 0; t < 200; t++) {
      var m = variant(_PU.randInt(0, 7));
      var flat = [];
      for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) flat.push(m[r][c]);
      var pos = _PU.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, nBlank)
        .sort(function (a, b) { return a - b; });
      var vals = pos.map(function (p) { return flat[p]; });

      var okCount = 0;
      permutations(vals).forEach(function (pm) {
        var f = flat.slice();
        pos.forEach(function (p, i) { f[p] = pm[i]; });
        if (isMagic(f)) okCount++;
      });
      if (okCount !== 1) continue;

      var cells = '';
      for (var i = 0; i < 9; i++) {
        if (i % 3 === 0) cells += (i ? '</tr>' : '') + '<tr>';
        cells += pos.indexOf(i) >= 0
          ? '<td class="mg-blank">□</td>'
          : '<td>' + flat[i] + '</td>';
      }
      cells += '</tr>';
      return fillQ({
        type: 'magic',
        text: '补全三阶幻方：1~9 各用一次，使每行、每列、两条对角线的三数之和都等于 15。'
          + '（按从左到右、从上到下的顺序填写 □）',
        figure: '<table class="magic-tbl">' + cells + '</table>',
        answer: pos.map(function (p) { return flat[p]; }),
        hint: '先找已知数最多的一行或一列，用 15 减去已知的两个数'
      });
    }
    return null;
  }

  // ============ 子题型分发 ============
  var GENERATORS = {
    vertical: genVertical,
    horizontal: genHorizontal,
    symbol: genSymbol,
    array: genArray,
    magic: genMagic
  };
  var ALL_KEYS = ['vertical', 'horizontal', 'symbol', 'array', 'magic'];

  var plugin = _PU.createPlugin({
    id: 'math-competition-c1-numberpuzzle',
    name: '数字谜与数阵图',
    subject: 'math',
    grades: [4],
    category: 'number',              // 三点六：数字谜属 number，勿填 'competition'
    moduleId: 'C1',
    description: '竖式/横式数字谜、符号代表数、数阵图与幻方，训练位值分析与枚举推理',
    columns: 2,                      // 题面含竖式/表格，2 列更舒展
    printConfig: { pageType: 'math' },

    // 题型筛选（practice.html 渲染为 chips，选中值透传 opts.type）
    settings: [
      {
        key: 'type', type: 'chip', label: '题型', default: 'mix',
        options: [
          { value: 'mix', label: '随机混合' },
          { value: 'vertical', label: '竖式数字谜' },
          { value: 'horizontal', label: '横式数字谜' },
          { value: 'symbol', label: '符号代表数' },
          { value: 'array', label: '数阵图' },
          { value: 'magic', label: '幻方' }
        ]
      }
    ],

    // 声明覆盖的知识点（须已在 shared/knowledge-bank.js 四年级 C1 下登记）
    knowledgePoints: {
      4: [
          'math-g4-c1-c1-vertical',
          'math-g4-c1-c1-horizontal',
          'math-g4-c1-c1-symbol',
          'math-g4-c1-c1-array',
          'math-g4-c1-c1-magic'
      ]
    },

    generateQuestions: function (opts) {
      opts = opts || {};
      var count = Math.max(1, opts.count || 10);
      var sc = scale(opts.difficulty || 3);
      var keys = (opts.type && opts.type !== 'mix' && GENERATORS[opts.type]) ? [opts.type] : ALL_KEYS;
      var out = [], seen = {}, guard = 0;

      // 一轮：去重收题（同一份练习里不出现完全相同的题面）
      while (out.length < count && guard < count * 40) {
        guard++;
        var k = keys.length === 1 ? keys[0] : _PU.rand(keys);
        var q = GENERATORS[k](sc);
        if (!q) continue;
        var sig = k + '|' + q.q + '|' + (q.svg || '');
        if (seen[sig]) continue;
        seen[sig] = 1;
        out.push(q);
      }
      // 兜底：题型可枚举空间被穷尽时（如只选幻方且题量很大）允许重复补齐，保证题量
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
        title: '数字谜与数阵图'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
