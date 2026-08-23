// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-c7-fraction.js — 竞赛 C7 分数与巧算
//
// 覆盖 C7 模块四个子题型（type 与 shared/knowledge-bank.js 知识点一致）：
//   telescope 裂项相消（1/(1×2)+1/(2×3)+… 型连加，用裂项公式相消）
//   complex   繁分数化简（1 ÷ (a + 1/b) 型多层分式，逐层通分取倒数）
//   clever    分数巧算（提取公因数 / 连乘裂项 / 等比凑整）
//   pattern   分数数列规律（给出前 4 项推第 k 项，换元与通项思想）
//
// 设计要点（竞赛题必须答案唯一）：
//   ① 四个子题型都是确定型计算，题面含全部所需数字，校验器可从题面反解独立重算；
//   ② 答案统一为「最简分数字符串」或整数字符串，题面显式标注填法；
//   ③ 分数答案不能用字符串比较判分——学生写 6/14 与 3/7 数学上同样正确，
//      故每题自带 check 走有理数精确比较（同时接受等值的精确小数），不用 defaultQCheck。
//
// 规范对齐（CONTRIBUTING 三点六）：
//   moduleId:'C7'、category:'number'、grades 与模块目录一致 [5,6]、
//   多空题一律数组 answer + inputType:'multi'、随机数走 PluginUtil、题面无内联 style。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-c7-fraction.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');

  // ============ 分数工具 ============
  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = b; b = a % b; a = t; }
    return a || 1;
  }

  /** 约分并格式化：分母为 1 输出整数，否则输出「分子/分母」 */
  function fmtFrac(n, d) {
    if (d < 0) { n = -n; d = -d; }
    var g = gcd(n, d);
    return (d / g) === 1 ? String(n / g) : (n / g) + '/' + (d / g);
  }

  /** 解析「整数 / a/b / 小数」为 {n,d}，无法解析返回 null */
  function parseFrac(s) {
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '');
    if (!s) return null;
    var m = s.match(/^(-?\d+)\/(\d+)$/);
    if (m) {
      var d = Number(m[2]);
      return d ? { n: Number(m[1]), d: d } : null;
    }
    if (/^-?\d+$/.test(s)) return { n: Number(s), d: 1 };
    m = s.match(/^(-?)(\d*)\.(\d+)$/);
    if (m) {
      var den = Math.pow(10, m[3].length);
      return { n: (m[1] === '-' ? -1 : 1) * (Number(m[2] || '0') * den + Number(m[3])), d: den };
    }
    return null;
  }

  /** 有理数等值比较：等值的非最简分数、精确小数同样判对 */
  function fracEq(user, right) {
    var a = parseFrac(user), b = parseFrac(right);
    return !!(a && b) && a.n * b.d === b.n * a.d;
  }

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
      // 分数题必须按数值判定，不能沿用 defaultQCheck 的字符串比较
      check: function (answers, idx) {
        for (var j = 0; j < cfg.answer.length; j++) {
          if (!fracEq(answers ? answers[idx + ':' + j] : '', cfg.answer[j])) return false;
        }
        return true;
      }
    };
  }

  /** 难度 → 规模（nMax 连加项数上限 / kMax 项数与倍数上限 / aMax 分式基数上限 / deep 是否出三层连分数） */
  function scale(lv) {
    if (lv >= 8) return { nMax: 60, kMax: 40, aMax: 12, deep: true };
    if (lv >= 5) return { nMax: 40, kMax: 30, aMax: 9, deep: true };
    return { nMax: 25, kMax: 20, aMax: 7, deep: false };
  }

  var TAIL_FRAC = ['（结果填最简分数）', '（结果写成最简分数）', '（答案填最简分数）'];
  var TAIL_MIX = ['（结果填最简分数或整数）', '（结果写成最简分数或整数）'];
  var HEAD_CLEVER = ['巧算：', '简算：', '用简便方法计算：'];
  function tailFrac() { return TAIL_FRAC[_PU.randInt(0, TAIL_FRAC.length - 1)]; }

  // ============ 1. 裂项相消 ============
  // 三个系列：分母 k×(k+1) / (2k−1)×(2k+1) / 2k×(2k+2)
  // 题面固定展示前 3 项 + 省略号 + 末项，故 n 从 5 起（避免末项与已展示项重复）
  function genTelescope(sc) {
    var mode = _PU.randInt(0, 2);
    var n = _PU.randInt(5, sc.nMax);
    var tail = tailFrac();
    if (mode === 0) {
      return fillQ({
        type: 'telescope',
        text: '计算：1/(1×2) + 1/(2×3) + 1/(3×4) + … + 1/(' + n + '×' + (n + 1) + ') = ____' + tail,
        answer: [fmtFrac(n, n + 1)],
        hint: '裂项：1/(k×(k+1)) = 1/k − 1/(k+1)，逐项相消后只剩 1 − 1/' + (n + 1)
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'telescope',
        text: '计算：1/(1×3) + 1/(3×5) + 1/(5×7) + … + 1/(' + (2 * n - 1) + '×' + (2 * n + 1) + ') = ____' + tail,
        answer: [fmtFrac(n, 2 * n + 1)],
        hint: '裂项：1/((2k−1)×(2k+1)) = 1/2 × (1/(2k−1) − 1/(2k+1))，相消后为 1/2 × (1 − 1/' + (2 * n + 1) + ')'
      });
    }
    return fillQ({
      type: 'telescope',
      text: '计算：1/(2×4) + 1/(4×6) + 1/(6×8) + … + 1/(' + (2 * n) + '×' + (2 * n + 2) + ') = ____' + tail,
      answer: [fmtFrac(n, 4 * n + 4)],
      hint: '裂项：1/(2k×(2k+2)) = 1/2 × (1/(2k) − 1/(2k+2))，相消后为 1/2 × (1/2 − 1/' + (2 * n + 2) + ')'
    });
  }

  // ============ 2. 繁分数化简 ============
  function genComplex(sc) {
    var mode = sc.deep ? _PU.randInt(0, 2) : _PU.randInt(0, 1);
    if (mode === 0) {
      // 1 ÷ (a + 1/b) = b/(ab+1)
      var a = _PU.randInt(1, sc.aMax), b = _PU.randInt(2, sc.aMax + 2);
      return fillQ({
        type: 'complex',
        text: '化简繁分数：1 ÷ (' + a + ' + 1/' + b + ') = ____（结果填最简分数）',
        answer: [fmtFrac(b, a * b + 1)],
        hint: '先把括号内化成一个分数：' + a + ' + 1/' + b + ' = ' + (a * b + 1) + '/' + b + '，再用「除以一个分数等于乘它的倒数」'
      });
    }
    if (mode === 1) {
      // (1 + 1/a) ÷ (1 - 1/a) = (a+1)/(a-1)
      var a2 = _PU.randInt(2, sc.aMax + 6);
      return fillQ({
        type: 'complex',
        text: '化简繁分数：(1 + 1/' + a2 + ') ÷ (1 - 1/' + a2 + ') = ____（结果填最简分数）',
        answer: [fmtFrac(a2 + 1, a2 - 1)],
        hint: '分子 1 + 1/' + a2 + ' = ' + (a2 + 1) + '/' + a2 + '，分母 1 − 1/' + a2 + ' = ' + (a2 - 1) + '/' + a2 + '，分母相同时相除只看分子'
      });
    }
    // 三层连分数：1 ÷ (a + 1 ÷ (b + 1/c))
    var a3 = _PU.randInt(1, 5), b3 = _PU.randInt(1, 5), c3 = _PU.randInt(2, 9);
    var inner = b3 * c3 + 1;               // b + 1/c = inner/c
    return fillQ({
      type: 'complex',
      text: '化简繁分数：1 ÷ (' + a3 + ' + 1 ÷ (' + b3 + ' + 1/' + c3 + ')) = ____（结果填最简分数）',
      answer: [fmtFrac(inner, a3 * inner + c3)],
      hint: '从最里层算起：' + b3 + ' + 1/' + c3 + ' = ' + inner + '/' + c3 + '，取倒数后与 ' + a3 + ' 相加，最后再取倒数'
    });
  }

  // ============ 3. 分数巧算 ============
  // 连乘型与等比型题面固定展示前 3 项 + 省略号 + 末项，故末项下标从 5 起（避免末项与已展示项重复）
  function genClever(sc) {
    var mode = _PU.randInt(0, 2);
    var head = HEAD_CLEVER[_PU.randInt(0, HEAD_CLEVER.length - 1)];
    if (mode === 0) {
      // 提取公因数：a/b × m + a/b × n = a/b × (m+n)
      var b = _PU.randInt(3, sc.aMax + 5);
      var a = _PU.randInt(1, b - 1);
      var m = _PU.randInt(2, sc.kMax);
      var n = _PU.randInt(2, sc.kMax);
      if (m === n) n = n + 1;
      return fillQ({
        type: 'clever',
        text: head + a + '/' + b + ' × ' + m + ' + ' + a + '/' + b + ' × ' + n + ' = ____'
          + TAIL_MIX[_PU.randInt(0, TAIL_MIX.length - 1)],
        answer: [fmtFrac(a * (m + n), b)],
        hint: '提取公因数 ' + a + '/' + b + '，原式 = ' + a + '/' + b + ' × (' + m + ' + ' + n + ')'
      });
    }
    if (mode === 1) {
      // 连乘裂项：(1−1/2)(1−1/3)…(1−1/n) = 1/n
      var n2 = _PU.randInt(5, sc.nMax);
      return fillQ({
        type: 'clever',
        text: head + '(1 - 1/2) × (1 - 1/3) × (1 - 1/4) × … × (1 - 1/' + n2 + ') = ____' + tailFrac(),
        answer: [fmtFrac(1, n2)],
        hint: '每个括号 1 − 1/k = (k−1)/k，相乘时前一项的分母与后一项的分子逐个约掉'
      });
    }
    // 等比凑整：1/2 + 1/4 + … + 1/2^k = (2^k − 1)/2^k（k 从 5 起，末项才不会落进已展示的 1/2、1/4、1/8）
    var k = _PU.randInt(5, 12);
    var pw = Math.pow(2, k);
    return fillQ({
      type: 'clever',
      text: head + '1/2 + 1/4 + 1/8 + … + 1/' + pw + ' = ____' + tailFrac(),
      answer: [fmtFrac(pw - 1, pw)],
      hint: '每加一项就补满剩下的一半，用 1 减去最后一项即可：1 − 1/' + pw
    });
  }

  // ============ 4. 分数数列规律 ============
  // 四个通项族：题面固定展示前 4 项，四族在前 4 项上互不相同，故规律唯一可辨
  var FAMILIES = [
    { term: function (k) { return [k, k + 1]; },             kMin: 6, kMax: 40, hint: '分子就是项数，分母比分子大 1' },
    { term: function (k) { return [1, Math.pow(2, k)]; },    kMin: 5, kMax: 12, hint: '分子都是 1，分母依次乘 2' },
    { term: function (k) { return [2 * k - 1, 2 * k + 1]; }, kMin: 6, kMax: 40, hint: '分子是第 k 个奇数，分母比分子大 2' },
    { term: function (k) { return [k, 2 * k + 1]; },         kMin: 6, kMax: 40, hint: '分子是项数，分母 = 分子 × 2 + 1' }
  ];
  var PAT_HEAD = ['按规律填空：', '找规律：', '观察下面各分数的规律：'];
  var PAT_TAIL = ['项是 ____', '个数是 ____'];

  function genPattern(sc) {
    var f = FAMILIES[_PU.randInt(0, FAMILIES.length - 1)];
    var kMax = Math.max(f.kMin, Math.min(f.kMax, sc.kMax));
    var k = _PU.randInt(f.kMin, kMax);
    var shown = [];
    for (var i = 1; i <= 4; i++) {
      var t = f.term(i);
      shown.push(t[0] + '/' + t[1]);
    }
    var ans = f.term(k);
    return fillQ({
      type: 'pattern',
      text: PAT_HEAD[_PU.randInt(0, PAT_HEAD.length - 1)] + shown.join('，') + '，…，第 ' + k + ' '
        + PAT_TAIL[_PU.randInt(0, PAT_TAIL.length - 1)] + '（结果填最简分数）',
      answer: [fmtFrac(ans[0], ans[1])],
      hint: f.hint
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var sc = scale(opts.difficulty || 6);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['telescope', 'complex', 'clever', 'pattern'] : [type];
    var count = opts.count || 10;
    var map = { telescope: genTelescope, complex: genComplex, clever: genClever, pattern: genPattern };
    var questions = [], seen = {};
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var gen = map[key] || genTelescope;
      var q = null, tries = 0;
      do { q = gen(sc); tries++; } while (q && seen[q.q] && tries < 400);
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-c7-fraction',
    name: '分数与巧算',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleIds: ['C7'],
    knowledgePoints: {
      6: ['g6-c7-c7-telescope', 'g6-c7-c7-complex', 'g6-c7-c7-clever', 'g6-c7-c7-pattern']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',       label: '综合' },
        { value: 'telescope', label: '裂项相消' },
        { value: 'complex',   label: '繁分数化简' },
        { value: 'clever',    label: '分数巧算' },
        { value: 'pattern',   label: '分数规律' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return {
        grade: (opts && opts.grade) || 5,
        count: (opts && opts.count) || 10,
        columns: 2,
        title: '分数与巧算'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
