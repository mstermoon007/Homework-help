// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c9.js — 六年级竞赛 C9 综合应用深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   ratio    比例应用题（按比例分配 / 反比例分工 / 由差求总量 / 速度比分程）
//   mixture  混合问题（平均价 / 合金含铜率 / 十字交叉反求配比）
//   grass    牛吃草问题（按公顷归一化的多块草地换算）
// 设计要点：构造法保证分配、百分数与天数均为整数；草地数据按每公顷归一。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c9.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { kmax: 12, base: 40 };
    if (lv >= 5) return { kmax: 9, base: 30 };
    return { kmax: 6, base: 20 };
  }

  // ============ 1. 比例应用题 ============
  var RATIO2 = [[2, 3], [3, 4], [3, 5], [4, 5], [5, 7], [2, 5], [5, 9], [7, 12]];
  function genRatio(sc) {
    var mode = _PU.randInt(0, 3);
    if (mode === 3) {
      // 速度比分程：两车相向而行，相遇时路程比 = 速度比
      var ab = RATIO2[_PU.randInt(0, RATIO2.length - 1)];
      var k = _PU.randInt(2, sc.kmax + 4);
      var S = (ab[0] + ab[1]) * k;
      var fast = Math.max(ab[0], ab[1]), slow = Math.min(ab[0], ab[1]);
      return fillQ({
        type: 'ratio',
        text: '甲、乙两车同时从相距 ' + S + ' 千米的两地相向而行，甲车与乙车的速度比是 ' + fast + ' : ' + slow +
          '，两车在途中相遇。相遇时甲车一共行驶了 ____ 千米。',
        answer: [S * fast / (fast + slow)],
        hint: '同时出发到相遇用时相同 → 路程比 = 速度比 = ' + fast + ':' + slow +
          '；总份数 ' + (fast + slow) + '，每份 ' + S + '÷' + (fast + slow) + '=' + k + ' 千米 → 甲行驶 ' + (S * fast / (fast + slow)) + ' 千米'
      });
    }
    if (mode === 0) {
      // 按比例分配
      var ab = RATIO2[_PU.randInt(0, RATIO2.length - 1)];
      var three = sc.kmax >= 9 && _PU.randInt(0, 1) === 0;
      if (three) {
        var c = _PU.randInt(1, 6);
        var k = _PU.randInt(2, sc.kmax);
        var total = (ab[0] + ab[1] + c) * k;
        return fillQ({
          type: 'ratio',
          text: '把 ' + total + ' 个练习本按 ' + ab[0] + ' : ' + ab[1] + ' : ' + c +
            ' 的比例分给甲、乙、丙三个班。甲班分得 ____ 本，乙班分得 ____ 本。（先填甲，再填乙）',
          answer: [ab[0] * k, ab[1] * k],
          hint: '总份数 = ' + (ab[0] + ab[1] + c) + '，每份 = ' + total + ' ÷ ' + (ab[0] + ab[1] + c) + ' = ' + k +
            ' → 甲 ' + (ab[0] * k) + ' 本、乙 ' + (ab[1] * k) + ' 本'
        });
      }
      var k2 = _PU.randInt(2, sc.kmax);
      var t2 = (ab[0] + ab[1]) * k2;
      return fillQ({
        type: 'ratio',
        text: '把 ' + t2 + ' 个气球按 ' + ab[0] + ' : ' + ab[1] + ' 的比例分给两个小组。第一组分得 ____ 个，第二组分得 ____ 个。（先填第一组）',
        answer: [ab[0] * k2, ab[1] * k2],
        hint: '总份数 = ' + (ab[0] + ab[1]) + '，每份 = ' + t2 + ' ÷ ' + (ab[0] + ab[1]) + ' = ' + k2 +
          ' → 第一组 ' + (ab[0] * k2) + ' 个、第二组 ' + (ab[1] * k2) + ' 个'
      });
    }
    if (mode === 1) {
      // 反比例：工作量一定，人数与天数成反比（p1≠d1 保证存在合法 p2=d1）
      var p1 = _PU.randInt(2, 8), d1 = _PU.randInt(2, 10);
      while (p1 === d1) d1 = _PU.randInt(2, 10);
      var work = p1 * d1;
      // d1≠p1 且 d1 整除 work → 合法 p2 必然存在（至少 d1 本身），while 必终止
      var p2 = _PU.randInt(2, 12);
      while (work % p2 !== 0 || p2 === p1) p2 = _PU.randInt(2, 12);
      var d2 = work / p2;
      return fillQ({
        type: 'ratio',
        text: '一批零件，如果由 ' + p1 + ' 名工人加工，需要 ' + d1 + ' 天完成。如果由 ' + p2 + ' 名工人加工（每人每天效率相同），需要 ____ 天完成。',
        answer: [d2],
        hint: '工作量一定，人数与天数成反比：' + p1 + '×' + d1 + ' = ' + p2 + '×天数 → 天数 = ' + work + ' ÷ ' + p2 + ' = ' + d2
      });
    }
    // 由差求总量：两数比 a:b，差 D → 总量 = D(a+b)/(a−b)
    for (var t = 0; t < 100; t++) {
      var r = RATIO2[_PU.randInt(0, RATIO2.length - 1)];
      if (r[0] === r[1]) continue;
      var kk = _PU.randInt(2, sc.kmax);
      var diff = Math.abs(r[0] - r[1]) * kk;
      var big = Math.max(r[0], r[1]) * kk, small = Math.min(r[0], r[1]) * kk;
      return fillQ({
        type: 'ratio',
        text: '甲、乙两数的比是 ' + r[0] + ' : ' + r[1] + '，它们的差是 ' + diff + '。那么这两个数的和是 ____。',
        answer: [big + small],
        hint: '每份 = ' + diff + ' ÷ ' + Math.abs(r[0] - r[1]) + ' = ' + kk + '，和 = (' + r[0] + '＋' + r[1] + ') × ' + kk + ' = ' + (big + small)
      });
    }
    return genRatio(sc);
  }

  // ============ 2. 混合问题 ============
  function genMixture(sc) {
    var mode = _PU.randInt(0, 2);
    if (mode === 2) {
      // 十字交叉反求配比：已知两种单价与混合均价，求质量比（最简整数比）
      var p1 = _PU.randInt(15, 40), p2 = _PU.randInt(4, p1 - 4);
      var avg = _PU.randInt(p2 + 2, p1 - 2);
      var hi = avg - p2, lo = p1 - avg; // 甲(高价):乙(低价) = (avg−p2):(p1−avg)
      function gcd(x, y) { return y ? gcd(y, x % y) : x; }
      var g2 = gcd(hi, lo);
      return fillQ({
        type: 'mixture',
        text: '甲种糖果每千克 ' + p1 + ' 元，乙种糖果每千克 ' + p2 +
          ' 元。把它们混合成每千克 ' + avg + ' 元的什锦糖（假设混合前后质量不变）。甲、乙两种糖果的质量比是多少？（化成最简整数比，先填甲）',
        answer: [hi / g2, lo / g2],
        hint: '十字交叉：甲 : 乙 = (' + avg + '−' + p2 + ') : (' + p1 + '−' + avg + ') = ' + hi + ' : ' + lo + ' = ' + (hi / g2) + ' : ' + (lo / g2)
      });
    }
    if (mode === 0) {
      // 平均价：两种糖果混合
      for (var t = 0; t < 200; t++) {
        var n1 = _PU.randInt(2, 8), n2 = _PU.randInt(2, 8);
        var p1 = _PU.randInt(10, 40), p2 = _PU.randInt(4, p1 - 3);
        var sum = n1 * p1 + n2 * p2;
        var mass = n1 + n2;
        if (sum % mass !== 0) continue;
        var avg = sum / mass;
        return fillQ({
          type: 'mixture',
          text: '奶糖每千克 ' + p1 + ' 元，水果糖每千克 ' + p2 + ' 元。把 ' + n1 + ' 千克奶糖和 ' + n2 +
            ' 千克水果糖混合成什锦糖，什锦糖的平均价格是每千克 ____ 元。',
          answer: [avg],
          hint: '总价 = ' + n1 + '×' + p1 + '＋' + n2 + '×' + p2 + ' = ' + sum + ' 元，总量 = ' + mass + ' 千克，均价 = ' + sum + ' ÷ ' + mass + ' = ' + avg + ' 元'
        });
      }
      return genMixture(scale(5));
    }
    // 合金含铜率
    for (var s = 0; s < 300; s++) {
      var m1 = _PU.randInt(2, 9) * 10, m2 = _PU.randInt(2, 9) * 10;
      var a1 = _PU.randInt(20, 80), a2 = _PU.randInt(5, a1 - 10);
      var copper = m1 * a1 + m2 * a2;
      var tot = m1 + m2;
      if (copper % tot !== 0) continue;
      var rate = copper / tot;
      var askA = _PU.randInt(0, 1) === 0;
      if (askA) {
        return fillQ({
          type: 'mixture',
          text: '有含铜率为 ' + a1 + '% 的甲合金 ' + m1 + ' 克和含铜率为 ' + a2 + '% 的乙合金 ' + m2 +
            ' 克。把它们熔合成一种新合金，新合金的含铜率是 ____ %。（只填数字）',
          answer: [rate],
          hint: '含铜 ' + m1 + '×' + a1 + '%＋' + m2 + '×' + a2 + '% = ' + copper + '/100 克，总质量 ' + tot + ' 克 → 含铜率 = ' + rate + '%'
        });
      }
      return fillQ({
        type: 'mixture',
        text: '有含铜率为 ' + a1 + '% 的甲合金 ' + m1 + ' 克。将它与含铜率为 ' + a2 + '% 的乙合金熔合后，得到含铜率为 ' +
          rate + '% 的新合金共 ' + tot + ' 克。乙合金的质量是 ____ 克。',
        answer: [m2],
        hint: '设乙合金 x 克：( ' + m1 + '×' + a1 + '% ＋ ' + a2 + '%·x ) ÷ ( ' + m1 + '＋x ) = ' + rate + '%，解得 x = ' + m2
      });
    }
    return genMixture(scale(5));
  }

  // ============ 牛吃草（多块草地，按公顷归一） ============
  function genGrassMulti(sc) {
    var g = _PU.randInt(2, 5);            // 每公顷每天长草份数
    var P = _PU.randInt(3, 8) * 4;        // 每公顷原有草份数
    var mode = _PU.randInt(0, 2);
    var A1 = 2, A2 = 3;
    var T1, T2, N1, N2;
    var tries = 0;
    do {
      T1 = _PU.randInt(4, 12); T2 = _PU.randInt(4, 12);
      N1 = A1 * P / T1 + A1 * g;
      N2 = A2 * P / T2 + A2 * g;
      tries++;
    } while ((N1 !== Math.floor(N1) || N2 !== Math.floor(N2) || N1 === N2 || T1 === T2) && tries < 200);
    if (tries >= 200) return genGrassMulti(sc);
    if (mode === 0) {
      // 求另一块草地可供多少头牛吃若干天
      var A3 = 4;
      var found = null;
      for (var t3 = 3; t3 <= 15; t3++) {
        if ((A3 * P) % t3 !== 0) continue;
        var n3 = A3 * P / t3 + A3 * g;
        if (!(A3 === A1 && t3 === T1) && !(A3 === A2 && t3 === T2)) { found = [n3, t3]; break; }
      }
      if (!found) return genGrassMulti(sc);
      return fillQ({
        type: 'grass',
        text: '甲、乙是两块面积分别为 ' + A1 + ' 公顷和 ' + A2 + ' 公顷的同类草地（草均匀生长，设每头牛每天吃 1 份草）。' +
          '甲草地可供 ' + N1 + ' 头牛吃 ' + T1 + ' 天，乙草地可供 ' + N2 + ' 头牛吃 ' + T2 +
          ' 天。另有一块面积为 ' + A3 + ' 公顷的同类草地，恰好也可供 ' + found[0] + ' 头牛吃完（草长尽前的某个时刻），问这块草地可供这些牛吃多少天？',
        answer: [found[1]],
        hint: '按每公顷归一：由两组条件联立解得每公顷每天生长 ' + g + ' 份、每公顷原有草 ' + P +
          ' 份；' + A3 + ' 公顷原有 ' + (A3 * P) + ' 份，每天净消耗 ' + (found[0] - A3 * g) + ' 份 → ' + (A3 * P) + ' ÷ ' + (found[0] - A3 * g) + ' = ' + found[1] + ' 天'
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'grass',
        text: '两块面积分别为 ' + A1 + ' 公顷和 ' + A2 + ' 公顷的同类草地（草均匀生长），分别可供 ' + N1 +
          ' 头牛吃 ' + T1 + ' 天、' + N2 + ' 头牛吃 ' + T2 + ' 天。问每公顷草地每天长出的草是多少份？（设每头牛每天吃 1 份）',
        answer: [g],
        hint: '把两组条件按每公顷归一后联立：总草量差 ÷ 天数差 ÷ 面积差 → 每公顷每天生长 ' + g + ' 份'
      });
    }
    // 至多放牧多少头（恰好等于该草地日生长总量）
    return fillQ({
      type: 'grass',
      text: '两块面积分别为 ' + A1 + ' 公顷和 ' + A2 + ' 公顷的同类草地（草均匀生长），分别可供 ' + N1 +
        ' 头牛吃 ' + T1 + ' 天、' + N2 + ' 头牛吃 ' + T2 + ' 天。若想让一片 ' + A2 +
        ' 公顷的同类草地永远吃不完（草持续生长），至多可以放牧多少头牛？',
      answer: [A2 * g],
      hint: '放牧头数恰等于草地日生长总量时可持续：每公顷日长 ' + g + ' 份 × ' + A2 + ' 公顷 = ' + (A2 * g) + ' 头'
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix' ? ['ratio', 'mixture', 'grass'] : [type];
    var count = opts.count || 10;
    var genMap = {
      ratio: function () { return genRatio(sc); },
      mixture: function () { return genMixture(sc); },
      grass: function () { return genGrassMulti(sc); }
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
    id: 'math-competition-g6-c9',
    name: '基础应用题（六年级）',
    subject: 'math',
    category: 'mixed',
    grades: [6],
    moduleId: 'C9',
    knowledgePoints: {
      6: ['math-g6-c9-ratio-application', 'math-g6-c9-mixture-problem', 'math-g6-c9-grass-problem']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',     label: '综合' },
        { value: 'ratio',   label: '比例应用题' },
        { value: 'mixture', label: '混合问题' },
        { value: 'grass',   label: '牛吃草（多块草地）' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '基础应用题（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
