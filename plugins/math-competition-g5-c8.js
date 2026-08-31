// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c8.js — 五年级竞赛 C8 最值与逻辑推理（新语义题型）
// 实现题型（type 与知识库一致）：
//   extremum  最值问题   和定积最大 / 周长定面积最大最小 / 积定和最小
//   logic     逻辑推理   真假话（枚举保证唯一解）/ 职业匹配 / 名次推理
//   winning   必胜策略   取子博弈（取到最后胜 / 负），余数法
//
// 设计要点：真假话与匹配/名次题生成时枚举校验「唯一解」后才出题；
// 文本答案用容错分隔符判定。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c8.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: cfg.single ? 'text' : 'multi',
      inputCount: cfg.single ? undefined : cfg.answer.length,
      hint: cfg.hint,
      check: cfg.check,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { halfMax: 24, prodMax: 12, peopleMax: 4, takeMax: 7 };
    if (lv >= 5) return { halfMax: 18, prodMax: 10, peopleMax: 3, takeMax: 5 };
    return { halfMax: 12, prodMax: 8, peopleMax: 3, takeMax: 4 };
  }

  // ============ 1. 最值问题 ============
  function genExtremum(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 周长一定，面积最大 / 最小
      var P = 4 * _PU.randInt(3, sc.halfMax) + (sc.halfMax > 12 && _PU.randInt(0, 1) ? 2 : 0);
      var half = P / 2;
      var a = Math.floor(half / 2), b = half - a;
      var askMin = sc.halfMax > 12 && _PU.randInt(0, 2) === 0;
      if (askMin) {
        return fillQ({
          type: 'extremum',
          text: '用一根长 ' + P + ' 厘米的铁丝围成一个长方形（长、宽都是整厘米数），围成的长方形面积最小是多少平方厘米？',
          answer: [half - 1],
          hint: '长 + 宽 = ' + half + '，长宽相差越大面积越小：1 × ' + (half - 1) + ' = ' + (half - 1) + ' 平方厘米'
        });
      }
      return fillQ({
        type: 'extremum',
        text: '用一根长 ' + P + ' 厘米的铁丝围成一个长方形（长、宽都是整厘米数），围成的长方形面积最大是多少平方厘米？',
        answer: [a * b],
        hint: '长 + 宽 = ' + half + '，差越小积越大：' + a + ' × ' + b + ' = ' + (a * b) + ' 平方厘米'
      });
    }
    if (mode === 1) {
      // 和一定，积最大
      var S = _PU.randInt(4, sc.halfMax * 2);
      var x = Math.floor(S / 2), y = S - x;
      return fillQ({
        type: 'extremum',
        text: '两个自然数的和是 ' + S + '，这两个数的乘积最大是多少？（两数可以是相同的自然数）',
        answer: [x * y],
        hint: '和一定差小积大：' + x + ' × ' + y + ' = ' + (x * y)
      });
    }
    // 积一定，和最小
    var m = _PU.randInt(2, sc.prodMax);
    var n2 = m * m;
    return fillQ({
      type: 'extremum',
      text: '两个自然数的乘积是 ' + n2 + '，这两个数的和最小是多少？（两数可以是相同的自然数）',
      answer: [2 * m],
      hint: '积一定差小和小：' + m + ' × ' + m + ' = ' + n2 + '，和 = ' + (2 * m)
    });
  }

  // ============ 2. 逻辑推理 ============
  /** 真假话：n 条单人断言 + 1 条复合断言（打破「全取反」对称），枚举保证唯一解 */
  var NAMES4 = ['甲', '乙', '丙', '丁'];
  function genTruthLiar(n) {
    for (var t = 0; t < 400; t++) {
      // n 条单人断言：每人恰好说一句
      var claims = [];
      for (var i = 0; i < n; i++) {
        var target = _PU.randInt(0, n - 1);
        while (target === i) target = _PU.randInt(0, n - 1);
        claims.push({ s: i, kind: 'single', a: target, b: -1, v: _PU.randInt(0, 1) === 0 });
      }
      // 复合断言：由第一个人补充说明另两人
      var cx = _PU.randInt(0, n - 1), cy = _PU.randInt(0, n - 1);
      while (cy === cx) cy = _PU.randInt(0, n - 1);
      var compKind = ['both-lie', 'mixed', 'one-lie'][_PU.randInt(0, 2)];
      claims.push({ s: cx === 0 ? n - 1 : 0, kind: compKind, a: cx, b: cy, v: false });
      var evalClaim = function (c, truth) {
        var P;
        if (c.kind === 'single') P = truth[c.a] === c.v;
        else if (c.kind === 'both-lie') P = !truth[c.a] && !truth[c.b];
        else if (c.kind === 'mixed') P = truth[c.a] && !truth[c.b];
        else P = !truth[c.a] || !truth[c.b]; // one-lie
        return P === truth[c.s];
      };
      var sols = [];
      for (var mask = 0; mask < (1 << n); mask++) {
        var truth = [];
        for (var p = 0; p < n; p++) truth.push(!!(mask & (1 << p)));
        var ok = claims.every(function (c) { return evalClaim(c, truth); });
        if (ok) sols.push(truth);
      }
      if (sols.length !== 1) continue;
      var sol = sols[0];
      if (!sol.some(function (x) { return x; })) continue;   // 至少一人说真话
      if (sol.every(function (x) { return x; })) continue;   // 排除全真（太简单）
      var stmts = claims.map(function (c) {
        if (c.kind === 'single') return NAMES4[c.s] + '说：“' + NAMES4[c.a] + (c.v ? '说的是真话' : '说的是假话') + '。”';
        if (c.kind === 'both-lie') return NAMES4[c.s] + '说：“' + NAMES4[c.a] + '和' + NAMES4[c.b] + '都在说谎。”';
        if (c.kind === 'mixed') return NAMES4[c.s] + '说：“' + NAMES4[c.a] + '说的是真话，' + NAMES4[c.b] + '说的是假话。”';
        return NAMES4[c.s] + '说：“' + NAMES4[c.a] + '和' + NAMES4[c.b] + '中至少有一人在说谎。”';
      });
      var trues = [];
      for (var q = 0; q < n; q++) if (sol[q]) trues.push(NAMES4[q]);
      return fillQ({
        type: 'logic',
        text: NAMES4.slice(0, n).join('、') + '这 ' + n + ' 人在一起，每人要么永远说真话，要么永远说假话。' +
          stmts.join('') + '那么谁说了真话？（多个人时用 、 分隔；只填名字）',
        answer: trues,
        single: true,
        check: nameListCheck,
        hint: '假设法：逐一假设某人说真话再验证全部话语是否自洽。说真话的是：' + trues.join('、')
      });
    }
    return genTruthLiar(3);
  }
  /** 容错名单比较：接受「甲、乙」分隔式或「甲乙」连写式 */
  function nameListCheck(userAnswers, idx) {
    var raw = userAnswers ? (userAnswers[idx + ':0'] != null ? userAnswers[idx + ':0'] : userAnswers[idx]) : '';
    var str = String(raw == null ? '' : raw).trim();
    var stripped = str.replace(/[、，,/|\s]+/g, '');
    if (stripped === this.answer.join('')) return true;
    var parts = str.split(/[、，,/|\s]+/).filter(function (s) { return s; });
    if (parts.length !== this.answer.length) return false;
    return this.answer.every(function (name) { return parts.indexOf(name) >= 0; });
  }

  function permute(arr) {
    if (arr.length <= 1) return [arr.slice()];
    var out = [];
    arr.forEach(function (v, i) {
      var rest = arr.slice(0, i).concat(arr.slice(i + 1));
      permute(rest).forEach(function (p) { out.push([v].concat(p)); });
    });
    return out;
  }


  function genMatchJob(n) {
    var JOBS = ['教师', '医生', '司机', '工程师'];
    var jobs = JOBS.slice(0, n), people = NAMES4.slice(0, n);
    var allAsgs = permute(jobs);
    for (var t = 0; t < 200; t++) {
      var truth = allAsgs[_PU.randInt(0, allAsgs.length - 1)];
      var candidates = [];
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        candidates.push({ pos: truth[i] === jobs[j], txt: people[i] + (truth[i] === jobs[j] ? '是' : '不是') + jobs[j], key: 'd' + i + '-' + j });
      }
      candidates = _PU.shuffle(candidates);
      var countSolutions = function (clueList) {
        return allAsgs.filter(function (asg) {
          return clueList.every(function (c) {
            var who = Number(c.key.charAt(1));
            var jobIdx = Number(c.key.charAt(3));
            return (asg[who] === jobs[jobIdx]) === c.pos;
          });
        }).length;
      };
      var cur = [];
      for (var k = 0; k < candidates.length; k++) {
        if (cur.length >= 4) break;
        cur.push(candidates[k]);
        if (countSolutions(cur) === 1) break;
      }
      if (cur.length < 2 || countSolutions(cur) !== 1) continue;
      var clueTxt = cur.map(function (c) { return c.txt; }).join('；');
      var asks = [], ans = [];
      for (var w = 0; w < n; w++) ans.push(truth[w]);
      return fillQ({
        type: 'logic',
        text: people.join('、') + '这 ' + n + ' 人各从事一种不同的工作，他们分别做的是' + jobs.join('、') +
          '。已知：' + clueTxt + '。那么他们的职业分别是什么？（按 ' + people.join('、') + ' 的顺序填写）',
        answer: ans,
        hint: '由线索逐一排除：' + people.map(function (nm, idx2) { return nm + '→' + truth[idx2]; }).join('，')
      });
    }
    return genMatchJob(3);
  }
  function factorial(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }

  function genRank(n) {
    var people = NAMES4.slice(0, n);
    var perms = permute(people); // 每种排列 asg[r]=第 r+1 名的人
    for (var t = 0; t < 200; t++) {
      var order = _PU.shuffle(people); // order[r]=第 r+1 名
      var rankOf = {};
      order.forEach(function (nm, i) { rankOf[nm] = i + 1; });
      var cluePool = [];
      for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
        if (i === j) continue;
        if (rankOf[people[i]] < rankOf[people[j]])
          cluePool.push({ ok: true, txt: people[i] + '的名次比' + people[j] + '靠前', key: 'c' + i + j });
        cluePool.push({ ok: rankOf[people[i]] !== j + 1, txt: people[i] + '不是第' + (j + 1) + '名', key: 'n' + i + j });
      }
      cluePool = _PU.shuffle(cluePool);
      var test = function (clues) {
        return perms.filter(function (asg) {
          var rk = {};
          asg.forEach(function (nm, r2) { rk[nm] = r2 + 1; });
          return clues.every(function (c) {
            var type = c.key.charAt(0), a = Number(c.key.charAt(1)), b = Number(c.key.charAt(2));
            if (type === 'c') return (rk[people[a]] < rk[people[b]]) === c.ok;
            return (rk[people[a]] !== b + 1) === c.ok;
          });
        }).length;
      };
      var cur = [];
      for (var k2 = 0; k2 < cluePool.length; k2++) {
        if (cur.length >= 4) break;
        cur.push(cluePool[k2]);
        if (test(cur) === 1) break;
      }
      if (cur.length < 2 || test(cur) !== 1) continue;
      var clueTxt = cur.map(function (c) { return c.txt; }).join('；');
      var asks = [], ans2 = [];
      for (var r3 = 0; r3 < n; r3++) ans2.push(order[r3]);
      return fillQ({
        type: 'logic',
        text: people.join('、') + '这 ' + n + ' 人参加跑步比赛，没有并列名次。已知：' + clueTxt +
          '。那么比赛名次是怎样的？（依次填第 1、2' + (n === 4 ? '、3、4' : '、3') + '名的名字）',
        answer: ans2,
        hint: '由名次线索逐步确定：' + order.map(function (nm, r4) { return '第' + (r4 + 1) + '名 ' + nm; }).join('，')
      });
    }
    return genRank(3);
  }

  function genLogic(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) return genTruthLiar(_PU.randInt(3, sc.peopleMax));
    if (mode === 1) return genMatchJob(Math.min(sc.peopleMax, 3));
    return genRank(sc.peopleMax);
  }

  // ============ 3. 必胜策略 ============
  function genWinning(sc) {
    var m = _PU.randInt(2, sc.takeMax);
    var lastWins = _PU.randInt(0, 1) === 0;
    var T, r;
    do {
      T = _PU.randInt(m + 2, (m + 1) * 6 + m);
      r = lastWins ? T % (m + 1) : (T - 1) % (m + 1);
    } while (r === 0 || r > m);
    return fillQ({
      type: 'winning',
      text: '桌上有 ' + T + ' 枚棋子，两人轮流取，每次可以取 1 ~ ' + m + ' 枚。规定取到最后一枚的人' +
        (lastWins ? '获胜' : '反而算输') + '。先取的人第一次应取多少枚，才能保证获胜？（假设两人都采用最佳策略）',
      answer: [r],
      hint: '余数法：关键周期为 ' + (m + 1) + '。先手第一步取 ' + r + ' 枚，给对方留下' +
        (lastWins ? ' ' + (m + 1) + ' 的倍数' : ' 「除以 ' + (m + 1) + ' 余 1」的局面') + '，之后每轮与对方凑成 ' + (m + 1) + ' 枚即可控制局面。'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['extremum', 'logic', 'winning'] : [type];
    var count = opts.count || 10;
    var genMap = {
      extremum: function () { return genExtremum(sc); },
      logic: function () { return genLogic(sc); },
      winning: function () { return genWinning(sc); }
    };
    var questions = [], seen = {}, MAXTRY = count * 30;
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

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c8',
    name: '最值与逻辑推理（五年级）',
    subject: 'math',
    category: 'statistics',
    grades: [5],
    moduleId: 'C8',
    knowledgePoints: {
      5: ['math-g5-c8-extremum-problem', 'math-g5-c8-logic-inference', 'math-g5-c8-winning-strategy']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',      label: '综合' },
        { value: 'extremum', label: '最值问题' },
        { value: 'logic',    label: '逻辑推理' },
        { value: 'winning',  label: '必胜策略' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 1, title: '最值与逻辑推理（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
