// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c8.js — 六年级竞赛 C8 最值与策略深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   optimization  统筹优化（烙饼、排队打水、三人/四人过桥）
//   winning       必胜策略深化（单堆取最后胜/负、双堆对称博弈）
//   extremum      最值问题（和定积最大 / 三数积最大 / 周长定面积最大）
//   logic         逻辑推理（名次列表排除 / 真话人数推盒 / 经典兜底题）
// 设计要点：均为经典可解模型，答案为确定整数或固定字词；
// 逻辑推理题在生成时暴力验证线索组合唯一确定答案。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c8.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: cfg.single ? 'text' : 'multi',
      inputCount: cfg.single ? undefined : cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  // ============ 统筹优化 ============
  function genOptimization() {
    var mode = _PU.randInt(0, 3);
    if (mode === 0) {
      // 烙饼：n 张饼、每面 t 分钟、一次最多烙两张 → n×t（n≥2）
      var n = _PU.randInt(3, 9), t = _PU.randInt(1, 3) * 2;
      return fillQ({
        type: 'optimization',
        text: '一个平底锅每次最多可以烙 2 张饼，每张饼要烙两面，每面需要 ' + t +
          ' 分钟。现在要烙 ' + n + ' 张饼，最少需要 ____ 分钟。',
        answer: [n * t],
        hint: '总面数 = ' + (2 * n) + ' 面，每次最多烙 2 面且能安排交替（n≥2 时无空锅）→ 至少 ' + (2 * n) + '÷2 × ' + t + ' = ' + (n * t) + ' 分钟'
      });
    }
    if (mode === 1) {
      // 排队打水：升序接水使总等待（含接水）最小 = 升序前缀和之和
      var k = _PU.randInt(3, 5);
      var times = [];
      while (times.length < k) {
        var v = _PU.randInt(1, 10);
        if (times.indexOf(v) < 0) times.push(v);
      }
      times.sort(function (a, b) { return a - b; });
      var total = 0, prefix = 0;
      var chain = [];
      for (var i = 0; i < k; i++) {
        prefix += times[i];
        total += prefix;
        chain.push(times[i]);
      }
      return fillQ({
        type: 'optimization',
        text: k + ' 个人到只有一个水龙头的排队处接水，接水时间分别为 ' + _PU.shuffle(times).join('、') +
          ' 分钟。一人接水时其余人都要等待。接水顺序安排得当时，所有人「接水时间＋等待时间」的总和最少是 ____ 分钟。',
        answer: [total],
        hint: '用时少的人先接：升序 ' + chain.join('→') + '，总和 = ' + chain.join('＋') + ' 的前缀和相加 = ' + total + ' 分钟'
      });
    }
    if (mode === 2) {
      // 四人过桥：a≤b≤c≤d，ans = min(a+3b+d, 2a+b+c+d)
      var a4 = _PU.randInt(1, 4), b4 = a4 + _PU.randInt(0, 2), c4 = b4 + _PU.randInt(1, 3), d4 = c4 + _PU.randInt(1, 5);
      var planA = a4 + 3 * b4 + d4;
      var planB = 2 * a4 + b4 + c4 + d4;
      var best = Math.min(planA, planB);
      return fillQ({
        type: 'optimization',
        text: '甲、乙、丙、丁四人夜里过一座桥，过桥分别需要 ' + d4 + '、' + c4 + '、' + b4 + '、' + a4 +
          ' 分钟。桥上每次最多容纳两人，过桥必须用手电筒，而手电筒只有一把，两人同行按较慢者的速度计算。四人最少需要 ____ 分钟才能全部过桥。',
        answer: [best],
        hint: '方案一（最快的两人护送）：' + a4 + '＋3×' + b4 + '＋' + d4 + ' = ' + planA + '；方案二（最快者逐个送）：2×' + a4 + '＋' + b4 + '＋' + c4 + '＋' + d4 + ' = ' + planB + '，取较小值 ' + best
      });
    }
    // 三人过桥：a≤b≤c → a+b+c（最快的往返护送）
    var e1 = _PU.randInt(1, 6), e2 = e1 + _PU.randInt(0, 3), e3 = e2 + _PU.randInt(1, 6);
    return fillQ({
      type: 'optimization',
      text: '甲、乙、丙三人夜里过一座桥，过桥分别需要 ' + e3 + '、' + e2 + '、' + e1 +
        ' 分钟。桥上每次最多容纳两人，必须用手电筒且手电筒只有一把，两人同行按较慢者的速度计算。三人最少需要 ____ 分钟才能全部过桥。',
      answer: [e1 + e2 + e3],
      hint: '最快的甲陪乙过（' + e2 + '），甲回（' + e1 + '），再陪丙过（' + e3 + '）→ 合计 ' + e1 + '＋' + e2 + '＋' + e3 + ' = ' + (e1 + e2 + e3) + ' 分钟'
    });
  }

  // ============ 必胜策略深化 ============
  function genWinning(sc) {
    var mode = _PU.randInt(0, 3);
    var m = _PU.randInt(2, sc.takeMax);
    if (mode === 0 || mode === 1) {
      // 单堆取子：取到最后胜 / 负
      var lastWins = mode === 0;
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
        hint: '余数法：关键周期为 ' + (m + 1) + '。先手第一步取 ' + r + ' 枚，之后每一轮与对方凑成 ' + (m + 1) +
          ' 枚，把「剩 ' + (lastWins ? T : T - 1) + '」的控制权牢牢握在手中。'
      });
    }
    if (mode === 2) {
      // 双堆不等：先手取差值造对称
      var x = _PU.randInt(2, 15), y;
      do { y = _PU.randInt(1, 14); } while (y === x);
      var big = Math.max(x, y), small = Math.min(x, y);
      return fillQ({
        type: 'winning',
        text: '桌上有两堆棋子，一堆 ' + x + ' 枚、另一堆 ' + y +
          ' 枚。两人轮流取，每次可以从任意一堆中取走至少 1 枚（也可以取光整堆），取得最后一枚者获胜。先取的人第一次应从较多的一堆中取走多少枚，才能保证获胜？',
        answer: [big - small],
        hint: '先取 ' + (big - small) + ' 枚使两堆相等（各 ' + small + ' 枚）；此后对方在一堆取几枚，我就在另一堆取同样多枚，始终保持对称 → 我取到最后一枚'
      });
    }
    // 双堆相等：对称局面，后手必胜
    var eq = _PU.randInt(2, 15);
    return fillQ({
      type: 'winning',
      text: '桌上有两堆棋子，每堆各有 ' + eq +
        ' 枚。两人轮流取，每次可以从任意一堆中取走至少 1 枚，取得最后一枚者获胜。先取的人有必胜策略吗？（有填“胜”，没有填“败”）',
      answer: ['败'],
      single: true,
      hint: '两堆相等是对称局面：无论先手在哪堆取几枚，后手都在另一堆取同样多枚保持对称 → 必胜策略属于后手，先手填“败”'
    });
  }

  // ============ 最值问题（均值、乘积最大） ============
  function genExtremum() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 和一定两数积最大：拆成最接近的两数
      var S = _PU.randInt(10, 50);
      var x = Math.floor(S / 2), y = S - x;
      return fillQ({
        type: 'extremum',
        text: '两个自然数的和是 ' + S + '（都至少为 1）。当这两个数分别是多少时，它们的乘积最大？最大乘积是 ____。',
        answer: [x * y],
        hint: '和一定时，两数越接近乘积越大：拆成 ' + x + ' 和 ' + y + ' → 最大乘积 ' + x + '×' + y + '=' + (x * y)
      });
    }
    if (mode === 1) {
      // 三数和定积最大：相等时最大
      var n = 3;
      do { var S3 = _PU.randInt(15, 90); } while (S3 % n !== 0);
      var v = S3 / n;
      return fillQ({
        type: 'extremum',
        text: '三个自然数的和是 ' + S3 + '（都至少为 1）。当这三个数分别取多少时，它们的乘积最大？最大乘积是 ____。',
        answer: [v * v * v],
        hint: '和一定时，各数相等乘积最大：' + v + '+' + v + '+' + v + '=' + S3 + ' → 最大乘积 ' + v + '³=' + (v * v * v)
      });
    }
    // 周长一定面积最大的长方形是正方形
    var per = _PU.randInt(8, 30) * 4;
    var side = per / 4;
    return fillQ({
      type: 'extremum',
      text: '一个长方形的周长是 ' + per + ' 厘米。当它的长、宽分别取多少厘米时面积最大？最大面积是 ____ 平方厘米。',
      answer: [side * side],
      hint: '周长一定时长=宽的正方形面积最大：边长 ' + side + ' 厘米 → 面积 ' + side + '²=' + (side * side)
    });
  }

  // ============ 逻辑推理（多条件、表格法） ============
  function genLogic() {
    if (_PU.randInt(0, 1) === 0) {
      // 名次推断：枚举全部排列，验证线索组合恰好唯一确定目标名次
      var names = ['甲', '乙', '丙'];
      for (var t = 0; t < 300; t++) {
        var target = _PU.shuffle([1, 2, 3]);
        var clues = [];
        var idxs = _PU.shuffle([0, 1, 2]).slice(0, _PU.randInt(2, 3));
        for (var ii = 0; ii < idxs.length; ii++) {
          var p = idxs[ii];
          if (_PU.randInt(0, 1) === 0) {
            clues.push({ text: names[p] + ' 是第 ' + target[p] + ' 名', who: p, rank: target[p], neg: false });
          } else {
            var wrong = target[p] % 3 + 1;
            clues.push({ text: names[p] + ' 不是第 ' + wrong + ' 名', who: p, rank: wrong, neg: true });
          }
        }
        var match = [];
        for (var a1 = 1; a1 <= 3 && match.length < 2; a1++) {
          for (var a2 = 1; a2 <= 3 && match.length < 2; a2++) {
            for (var a3 = 1; a3 <= 3 && match.length < 2; a3++) {
              if (a1 === a2 || a1 === a3 || a2 === a3) continue;
              var perm = [a1, a2, a3];
              var ok = true;
              for (var ci = 0; ci < clues.length; ci++) {
                var cl = clues[ci];
                if (cl.neg ? perm[cl.who] === cl.rank : perm[cl.who] !== cl.rank) { ok = false; break; }
              }
              if (ok) match.push(perm);
            }
          }
        }
        if (match.length === 1 && match[0].join(',') === target.join(',')) {
          return fillQ({
            type: 'logic',
            text: '甲、乙、丙三人参加百米赛跑，成绩分别为第 1、2、3 名（无并列）。已知：「' +
              clues.map(function (c) { return c.text; }).join('」，「') +
              '」。那么乙是第几名？____',
            answer: [target[1]],
            hint: '列表排除法：由这几条线索逐一排除，只有一种分配成立——甲第 ' + target[0] +
              '、乙第 ' + target[1] + '、丙第 ' + target[2]
          });
        }
      }
    }
    // 硬币在哪号盒：构造后验证「指定真话人数」的盒子唯一
    for (var s = 0; s < 500; s++) {
      var claims = [_PU.randInt(1, 3), _PU.randInt(1, 3), _PU.randInt(1, 3)];
      var wantTrues = _PU.randInt(0, 1) === 0 ? 1 : 2;
      var goodBoxes = [];
      for (var bx = 1; bx <= 3; bx++) {
        var cnt = 0;
        for (var pc = 0; pc < 3; pc++) { if (claims[pc] === bx) cnt++; }
        if (cnt === wantTrues) goodBoxes.push(bx);
      }
      if (goodBoxes.length === 1) {
        var truth = goodBoxes[0];
        var stmts = ['甲', '乙', '丙'].map(function (nm, i) {
          return nm + '说：「硬币在第 ' + claims[i] + ' 号盒子里」';
        }).join('，');
        return fillQ({
          type: 'logic',
          text: '一枚硬币藏在三个盒子之一中。' + stmts + '。已知这三人中恰好只有 ' + wantTrues +
            ' 人说了真话。硬币在第 ____ 号盒子里。',
          answer: [truth],
          hint: '逐盒假设并统计说真话的人数：假设在第 1/2/3 号盒时真话人数分别为 ' +
            [1, 2, 3].map(function (b) {
              var c = 0;
              for (var i2 = 0; i2 < 3; i2++) { if (claims[i2] === b) c++; }
              return c;
            }).join('、') + ' 人，只有第 ' + truth + ' 号符合「恰好 ' + wantTrues + ' 人真话」'
        });
      }
    }
    // 兜底（经典题，必然成立）
    return fillQ({
      type: 'logic',
      text: '一枚硬币藏在三个盒子之一中。甲说：「在第 1 号盒子里」，乙说：「不在第 1 号盒子里」，丙说：「不在第 3 号盒子里」。已知三人中恰好只有一人说真话。硬币在第 ____ 号盒子里。',
      answer: [3],
      hint: '逐盒假设：在第 1 号 → 甲真丙真（两人）；在第 2 号 → 乙真丙真（两人）；在第 3 号 → 只有乙真，恰好一人 ✓'
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = { takeMax: lv >= 8 ? 7 : (lv >= 5 ? 5 : 4) };
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['optimization', 'winning', 'extremum', 'logic'] : [type];
    var count = opts.count || 10;
    var genMap = {
      optimization: genOptimization,
      winning: function () { return genWinning(sc); },
      extremum: genExtremum,
      logic: genLogic
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
    id: 'math-competition-g6-c8',
    name: '最值与逻辑推理（六年级）',
    subject: 'math',
    category: 'statistics',
    grades: [6],
    moduleId: 'C8',
    knowledgePoints: {
      6: ['math-g6-c8-optimization', 'math-g6-c8-winning-strategy', 'math-g6-c8-extremum-problem', 'math-g6-c8-logic-inference']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',          label: '综合' },
        { value: 'optimization', label: '统筹优化' },
        { value: 'winning',      label: '必胜策略' },
        { value: 'extremum',     label: '最值问题' },
        { value: 'logic',        label: '逻辑推理' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 1, title: '最值与逻辑推理（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
