// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c3.js — 六年级竞赛 C3 组合计数深化（新语义题型）
// 实现题型（本轮激活部分）：
//   inclusion-exclusion  容斥原理（三集合公式及变形）
//   recursion            递推计数（爬楼梯 1~2 / 1~2~3 级、铺砖）
//   derangement          错排问题（D(n)：0,1,2,9,44,265…）
//   geometry-count       几何计数（网格长方形/正方形、凸多边形三角形、直线分平面）
// 设计要点：公式型直接构造；容斥数据按「分块人数」构造保证自洽。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c3.js 依赖 shared/common.js');

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

  // ============ 1. 容斥原理（三集合） ============
  function genInclusion() {
    var tri = _PU.randInt(2, 5);
    var pAB = _PU.randInt(2, 6), pBC = _PU.randInt(2, 6), pAC = _PU.randInt(2, 6);
    var sa = _PU.randInt(3, 9), sb = _PU.randInt(3, 9), sC = _PU.randInt(3, 9);
    var none = _PU.randInt(2, 8);
    var aAll = sa + pAB + pAC + tri, bAll = sb + pAB + pBC + tri, cAll = sC + pBC + pAC + tri;
    var union = sa + sb + sC + pAB + pBC + pAC + tri;
    var total = union + none;
    var mode = _PU.randInt(0, 3);
    var head = '某年级对 ' + total + ' 名同学的兴趣调查显示：参加数学社的有 ' + aAll + ' 人，参加文学社的有 ' + bAll +
      ' 人，参加英语社的有 ' + cAll + ' 人；同时参加数学社和文学社的有 ' + (pAB + tri) + ' 人，同时参加文学社和英语社的有 ' +
      (pBC + tri) + ' 人，同时参加数学社和英语社的有 ' + (pAC + tri) + ' 人。';
    if (mode === 0) {
      return fillQ({
        type: 'inclusion-exclusion',
        text: head + '三个社都参加的有 ____ 人。',
        answer: [tri],
        hint: '|A∪B∪C| = ' + union + '（总数减去没参加的），代入三集合容斥公式反解：都参加 = |A∪B∪C| − (' + aAll +
          '＋' + bAll + '＋' + cAll + ') ＋ (' + (pAB + tri) + '＋' + (pBC + tri) + '＋' + (pAC + tri) + ') = ' + tri
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'inclusion-exclusion',
        text: head.replace('的调查显示', '的调查显示').replace('人。', '人。') + '已知三个社都参加的有 ' + tri + ' 人，那么至少参加一个社的有 ____ 人。',
        answer: [union],
        hint: '至少一组 = 单项和 − 两两项和 ＋ 三项 = (' + aAll + '＋' + bAll + '＋' + cAll + ') − (' + (pAB + tri) + '＋' + (pBC + tri) + '＋' + (pAC + tri) + ') ＋ ' + tri + ' = ' + union
      });
    }
    if (mode === 2) {
      return fillQ({
        type: 'inclusion-exclusion',
        text: head + '已知三个社都参加的有 ' + tri + ' 人，那么三个社都没有参加的有 ____ 人。',
        answer: [none],
        hint: '先由容斥求至少参加一组的人数 = ' + union + '，都没参加 = ' + total + ' − ' + union + ' = ' + none
      });
    }
    // 恰好只参加一个社
    var onlyOne = sa + sb + sC;
    return fillQ({
      type: 'inclusion-exclusion',
      text: head + '已知三个社都参加的有 ' + tri + ' 人，那么恰好只参加其中一个社的有 ____ 人。',
      answer: [onlyOne],
      hint: '只参加数学社 = ' + aAll + ' − (' + (pAB + tri) + '＋' + (pAC + tri) + '－' + tri + ') = ' + sa +
        '；同理文学社 ' + sb + ' 人、英语社 ' + sC + ' 人，合计 ' + onlyOne + ' 人'
    });
  }

  // ============ 2. 递推计数 ============
  function genRecursion() {
    var mode = _PU.randInt(0, 4);
    if (mode === 0) {
      // 爬楼梯每次 1 或 2 级：f(n)=f(n-1)+f(n-2)，f(0)=f(1)=1
      var n = _PU.randInt(7, 18);
      var f = [1, 1];
      for (var i = 2; i <= n; i++) f[i] = f[i - 1] + f[i - 2];
      return fillQ({
        type: 'recursion',
        text: '小明上楼梯，每步只能跨 1 级或 2 级台阶。楼梯共有 ' + n + ' 级台阶，他一共有 ____ 种不同的上法。',
        answer: [f[n]],
        hint: '递推：f(n)=f(n−1)＋f(n−2)，f(1)=1、f(2)=2 → f(' + n + ')=' + f[n]
      });
    }
    if (mode === 1) {
      // 每次跨 1、2 或 3 级：三阶递推
      var m = _PU.randInt(6, 14);
      var g = [1, 1, 2, 4];
      for (var j = 4; j <= m; j++) g[j] = g[j - 1] + g[j - 2] + g[j - 3];
      return fillQ({
        type: 'recursion',
        text: '上楼梯时每步可以跨 1 级、2 级或 3 级台阶。楼梯共有 ' + m + ' 级台阶，一共有 ____ 种不同的上法。',
        answer: [g[m]],
        hint: '递推：f(n)=f(n−1)＋f(n−2)＋f(n−3)，f(1)=1、f(2)=2、f(3)=4 → f(' + m + ')=' + g[m]
      });
    }
    if (mode === 2) {
      // 覆盖问题：1×2 地砖铺 2×n 地面（同斐波那契）
      var w = _PU.randInt(5, 15);
      var h = [0, 1, 2];
      for (var k = 3; k <= w; k++) h[k] = h[k - 1] + h[k - 2];
      return fillQ({
        type: 'recursion',
        text: '用 1×2 的地砖铺满一条 2×' + w + ' 的走廊（地砖可横放或竖放，不能重叠、不能超出），一共有 ____ 种不同的铺法。',
        answer: [h[w]],
        hint: '递推：考虑最左列竖放（剩 2×(n−1)）或两块横放叠放（剩 2×(n−2)）→ f(n)=f(n−1)＋f(n−2)，f(' + w + ')=' + h[w]
      });
    }
    if (mode === 3) {
      // 斐波那契兔子繁殖
      var mo = _PU.randInt(8, 13);
      var rab = [0, 1, 1];
      for (var r2 = 3; r2 <= mo; r2++) rab[r2] = rab[r2 - 1] + rab[r2 - 2];
      return fillQ({
        type: 'recursion',
        text: '一对小兔出生后第 3 个月起每个月都生一对新兔（小兔长大同样繁殖，兔子不死）。从刚出生的一对兔子开始，到第 ' + mo + ' 个月一共有 ____ 对兔子。',
        answer: [rab[mo]],
        hint: '斐波那契递推：第 n 月对数 = 上月对数 ＋ 新生对数（等于两个月前的对数）→ F(' + mo + ')=' + rab[mo]
      });
    }
    // 传球问题：4 人传球，n 次后回到发球人：(3^n + 3×(−1)^n)/4
    var ps = _PU.randInt(3, 9);
    var ways = (Math.pow(3, ps) + 3 * (ps % 2 === 0 ? 1 : -1)) / 4;
    return fillQ({
      type: 'recursion',
      text: '甲、乙、丙、丁四人在玩传球游戏，每次传球都必须传给另一人。由甲发球，经过 ' + ps +
        ' 次传球后，球恰好又回到甲手中的传球方式有 ____ 种。',
      answer: [ways],
      hint: '递推：设 a(n) 为 n 次后回到甲的方式数，a(n)=(3^(n−1)＋…)；也可用公式 (3^n＋3×(±1))÷4 → ' + ways
    });
  }

  // ============ 3. 错排问题 ============
  var DERANGEMENTS = { 3: 2, 4: 9, 5: 44, 6: 265 };
  var FACTS = { 3: 6, 4: 24, 5: 120, 6: 720 };
  var DER_STORIES = [
    function (n) { return n + ' 位同学互赠礼物，每人准备一份礼物随机分配（每人拿到一份），恰好每个人都拿到别人的礼物（没有人拿对自己的礼物）的分法有'; },
    function (n) { return n + ' 封信与 ' + n + ' 个信封编号一一对应，把信全部装错信封（没有一封装对）的装法有'; },
    function (n) { return n + ' 位同学重新排座位，要求每个人都不坐自己原来的座位，共有'; },
    function (n) { return '把 ' + n + ' 把钥匙与 ' + n + ' 把锁一一配对打乱后随机试开，全部配错的分配方式有'; }
  ];
  function genDerangement() {
    var n = _PU.randInt(3, 6);
    var story = DER_STORIES[_PU.randInt(0, DER_STORIES.length - 1)](n);
    if (_PU.randInt(0, 1) === 0) {
      return fillQ({
        type: 'derangement',
        text: story + ' ____ 种。',
        answer: [DERANGEMENTS[n]],
        hint: '错排数列 D(n)：D(2)=1，D(n)=(n−1)[D(n−1)＋D(n−2)] → D(3)=2、D(4)=9、D(5)=44、D(6)=265；本题 D(' + n + ')=' + DERANGEMENTS[n]
      });
    }
    var good = FACTS[n] - DERANGEMENTS[n];
    return fillQ({
      type: 'derangement',
      text: n + ' 位同学互赠礼物，每人准备一份礼物随机分配（每人拿到一份）。如果「至少有一位同学拿到自己的礼物」，那么共有 ____ 种分法。',
      answer: [good],
      hint: '总数 ' + FACTS[n] + ' 种 − 全错位 D(' + n + ')=' + DERANGEMENTS[n] + ' 种 = 至少一人拿对的 ' + good + ' 种'
    });
  }

  // ============ 4. 几何计数 ============
  function comb2(n) { return n * (n - 1) / 2; }
  function genGeometryCount() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // m×n 网格长方形个数 = C(m+1,2)×C(n+1,2)
      var m = _PU.randInt(3, 6), nn = _PU.randInt(4, 8);
      if (m === nn) nn++;
      var total = comb2(m + 1) * comb2(nn + 1);
      return fillQ({
        type: 'geometry-count',
        text: '在一个 ' + m + '×' + nn + ' 的方格网中（由若干个小方格组成），一共可以数出 ____ 个长方形（含正方形）。',
        answer: [total],
        hint: '长方形 = 长、宽各选两条横竖线：C(' + (m + 1) + ',2)×C(' + (nn + 1) + ',2) = ' + comb2(m + 1) + '×' + comb2(nn + 1) + ' = ' + total
      });
    }
    if (mode === 1) {
      // 凸 n 边形顶点取三点构成三角形 C(n,3)
      var v = _PU.randInt(5, 10);
      var c3 = v * (v - 1) * (v - 2) / 6;
      return fillQ({
        type: 'geometry-count',
        text: '凸 ' + v + ' 边形的 ' + v + ' 个顶点中任取三个都能构成一个三角形，一共能构成 ____ 个三角形。',
        answer: [c3],
        hint: 'C(' + v + ',3) = ' + v + '×' + (v - 1) + '×' + (v - 2) + ' ÷ 6 = ' + c3
      });
    }
    // 直线分平面最多区域数 = n(n+1)/2 + 1
    var L = _PU.randInt(4, 12);
    var parts = L * (L + 1) / 2 + 1;
    return fillQ({
      type: 'geometry-count',
      text: '平面上画 ' + L + ' 条直线，任意两条都相交且任意三条不共点，最多能把平面分成 ____ 部分。',
      answer: [parts],
      hint: '递推：第 k 条直线最多新增 k 部分，共 1＋(1＋2＋…＋' + L + ') = ' + parts
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['inclusion-exclusion', 'recursion', 'derangement', 'geometry-count']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'inclusion-exclusion': genInclusion, recursion: genRecursion,
      derangement: genDerangement, 'geometry-count': genGeometryCount
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
    id: 'math-competition-g6-c3',
    name: '组合计数（六年级）',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleId: 'C3',
    knowledgePoints: {
      6: ['g6-c3-inclusion-exclusion', 'g6-c3-recursion-counting', 'g6-c3-derangement', 'g6-c3-geometry-counting']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',                label: '综合' },
        { value: 'inclusion-exclusion', label: '容斥原理' },
        { value: 'recursion',          label: '递推计数' },
        { value: 'derangement',        label: '错排问题' },
        { value: 'geometry-count',     label: '几何计数' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '组合计数（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
