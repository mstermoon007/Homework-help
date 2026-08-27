// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c3.js — 六年级竞赛 C3 组合计数深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   inclusion-exclusion  容斥原理（三集合公式及变形）
//   recursion            递推计数（爬楼梯 1~2 / 1~2~3 级、铺砖）
//   derangement          错排问题（D(n)：0,1,2,9,44,265…）
//   geometry-count       几何计数（网格长方形/正方形、凸多边形三角形、直线分平面）
//   add-principle        加法原理（分类直达/选购物）
//   mult-principle       乘法原理（两步路径/三件套搭配）
//   permutation          排列（全排/固定端点/有序选取 A(n,k)）
//   combination          组合（无序选取/分组 C(n,k)）
//   enumeration          枚举计数（和小于定值的取法分类枚举）
//   bundling             捆绑法（相邻元素整体化）
//   insertion            插空法（女生互不相邻）
//   stars-bars           隔板法（允许空/不允许空）
//   pigeonhole           抽屉原理（构造抽屉保证 m 个同类）
//   worst-case           最不利原则（扑克点数/花色、袜子配双）
// 设计要点：公式型直接构造；容斥数据按「分块人数」构造保证自洽；
// 计数题答案均为正整数，抽屉/最不利题参数空间小但答案固定可校验。

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
        text: head + '（其中 ' + none + ' 人三个社都没有参加）。三个社都参加的有 ____ 人。',
        answer: [tri],
        hint: '|A∪B∪C| = ' + union + ' = ' + total + ' − ' + none + '（总数减去没参加的）；代入三集合容斥反解：都参加 = |A∪B∪C| − (' + aAll +
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
  var DERANGEMENTS = { 3: 2, 4: 9, 5: 44, 6: 265, 7: 1854, 8: 14833 };
  var FACTS = { 3: 6, 4: 24, 5: 120, 6: 720, 7: 5040, 8: 40320 };
  var DER_STORIES = [
    function (n) { return n + ' 位同学互赠礼物，每人准备一份礼物随机分配（每人拿到一份），恰好每个人都拿到别人的礼物（没有人拿对自己的礼物）的分法有'; },
    function (n) { return n + ' 封信与 ' + n + ' 个信封编号一一对应，把信全部装错信封（没有一封装对）的装法有'; },
    function (n) { return n + ' 位同学重新排座位，要求每个人都不坐自己原来的座位，共有'; },
    function (n) { return '把 ' + n + ' 把钥匙与 ' + n + ' 把锁一一配对打乱后随机试开，全部配错的分配方式有'; }
  ];
  function genDerangement() {
    var n = _PU.randInt(3, 8);
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

  // ============ 计数工具 ============
  function fact(n) { var r = 1; for (var i = 2; i <= n; i++) r *= i; return r; }
  function C(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }
  function P(n, k) { var r = 1; for (var i = 0; i < k; i++) r *= (n - i); return r; }

  // ============ 5. 加法原理（复杂分类） ============
  function genAddPrinciple() {
    var m = _PU.randInt(3, 8), n = _PU.randInt(3, 9), k = _PU.randInt(2, 7);
    var stories = [
      { mk: '从甲城到乙城，乘高铁每天有 ' + m + ' 班，乘普通列车每天有 ' + n + ' 班，乘长途汽车每天有 ' + k + ' 班。一天之内从甲城到乙城（只乘坐一种交通工具、直达）共有 ____ 种不同的走法。', parts: [m, n, k] },
      { mk: '文具店里的笔记本有三种包装：小包 ' + m + ' 种花色、中包 ' + n + ' 种花色、大包 ' + k + ' 种花色。买一本（一种包装选一种花色）共有 ____ 种不同的选法。', parts: [m, n, k] }
    ];
    var st = stories[_PU.randInt(0, stories.length - 1)];
    return fillQ({
      type: 'add-principle',
      text: st.mk,
      answer: [m + n + k],
      hint: '三大类互不重叠、每一类都能独立完成任务 → 用加法原理：' + m + '+' + n + '+' + k + '=' + (m + n + k) + ' 种'
    });
  }

  // ============ 6. 乘法原理（多步骤） ============
  function genMultPrinciple() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      var m = _PU.randInt(3, 6), n = _PU.randInt(3, 7);
      return fillQ({
        type: 'mult-principle',
        text: '从甲村到乙村有 ' + m + ' 条路，从乙村到丙村有 ' + n + ' 条路。从甲村经乙村到丙村，共有 ____ 种不同的走法。',
        answer: [m * n],
        hint: '分两步完成：第一步 ' + m + ' 种 × 第二步 ' + n + ' 种 = ' + (m * n) + ' 种（乘法原理）'
      });
    }
    var tops = _PU.randInt(3, 6), pants = _PU.randInt(3, 6), hats = _PU.randInt(2, 4);
    return fillQ({
      type: 'mult-principle',
      text: '衣柜里有 ' + tops + ' 件上衣、' + pants + ' 条裤子、' + hats + ' 顶帽子。一件上衣、一条裤子、一顶帽子各选一件穿在身上，共有 ____ 种不同的搭配方法。',
      answer: [tops * pants * hats],
      hint: '分三步：' + tops + '×' + pants + '×' + hats + ' = ' + (tops * pants * hats) + ' 种'
    });
  }

  // ============ 7. 排列（含限制条件） ============
  function genPermutation() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      var n = _PU.randInt(4, 6);
      return fillQ({
        type: 'permutation',
        text: n + ' 名同学排成一排照相，一共有 ____ 种不同的排法。',
        answer: [fact(n)],
        hint: '全排列：' + n + '! = ' + Array.from({ length: n }, function (_, i) { return n - i; }).join('×') + ' = ' + fact(n)
      });
    }
    if (mode === 1) {
      var m = _PU.randInt(4, 6);
      var who = ['小明', '小红', '小刚'][_PU.randInt(0, 2)];
      var endName = _PU.randInt(0, 1) === 0 ? '排头' : '排尾';
      return fillQ({
        type: 'permutation',
        text: m + ' 名同学排成一排，要求 ' + who + ' 必须站在' + endName + '，一共有 ____ 种不同的排法。',
        answer: [fact(m - 1)],
        hint: who + ' 的位置固定，其余 ' + (m - 1) + ' 人全排列：(' + (m - 1) + ')! = ' + fact(m - 1)
      });
    }
    var nn = _PU.randInt(5, 7), kk = _PU.randInt(2, nn - 2);
    return fillQ({
      type: 'permutation',
      text: '从 ' + nn + ' 名选手中选出 ' + kk + ' 人，分别授予冠、亚、季军等不同名次（每人一个名次），一共有 ____ 种不同的结果。',
      answer: [P(nn, kk)],
      hint: '有序选取用排列数：A(' + nn + ',' + kk + ') = ' + nn + '×' + (nn - 1) + '×…共 ' + kk + ' 个因数 = ' + P(nn, kk)
    });
  }

  // ============ 8. 组合（含分组问题） ============
  function genCombination() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      var n = _PU.randInt(6, 12), k = _PU.randInt(2, 4);
      return fillQ({
        type: 'combination',
        text: '班里要从 ' + n + ' 名同学中选出 ' + k + ' 名参加大扫除（不分先后顺序），一共有 ____ 种不同的选法。',
        answer: [C(n, k)],
        hint: '无序选取用组合数：C(' + n + ',' + k + ') = ' + C(n, k) +
          '（从 ' + n + ' 起连乘 ' + k + ' 个数再除以 ' + k + '!）'
      });
    }
    var total = _PU.randInt(8, 12), g1 = _PU.randInt(3, Math.floor(total / 2));
    var g2 = total - g1;
    return fillQ({
      type: 'combination',
      text: '将 ' + total + ' 名同学分成两组，第一组 ' + g1 + ' 人、第二组 ' + g2 + ' 人（组内不分顺序），一共有 ____ 种不同的分组方法。',
      answer: [C(total, g1)],
      hint: '先选出第一组即可，剩下自动成为第二组：C(' + total + ',' + g1 + ') = ' + C(total, g1)
    });
  }

  // ============ 9. 枚举计数（有序技巧） ============
  function genEnumeration() {
    // 多种枚举场景：变化数字范围(1~M)与比较关系(小于/大于)，保证题面多样性足以产出≥25道不重复题
    var scen = _PU.randInt(0, 4);
    var M, op, Klo, Khi;
    if (scen === 0) { M = 9; op = '小于'; Klo = 8; Khi = 13; }
    else if (scen === 1) { M = 9; op = '大于'; Klo = 11; Khi = 17; }
    else if (scen === 2) { M = 10; op = '小于'; Klo = 9; Khi = 15; }
    else if (scen === 3) { M = 8; op = '小于'; Klo = 7; Khi = 12; }
    else { M = 10; op = '大于'; Klo = 13; Khi = 19; }
    var K = _PU.randInt(Klo, Khi);
    var cnt = 0;
    for (var a = 1; a <= M; a++) {
      for (var b = a + 1; b <= M; b++) {
        var s = a + b;
        if (op === '小于' && s < K) cnt++;
        else if (op === '大于' && s > K) cnt++;
        else if (op === '不超过' && s <= K) cnt++;
      }
    }
    return fillQ({
      type: 'enumeration',
      text: '从 1~' + M + ' 这 ' + M + ' 个数字中取出两个不同的数字，使它们的和' + op + ' ' + K + '，一共有 ____ 种取法（两种取法只要有一个数字不同就算不同）。',
      answer: [cnt],
      hint: '按较小数分类枚举：逐类相加得 ' + cnt + ' 种'
    });
  }

  // ============ 10. 捆绑法（多组相邻） ============
  function genBundling() {
    var n = _PU.randInt(4, 8), m = _PU.randInt(2, 6);
    if (m > n - 2) m = n - 2;
    var ways = fact(n - m + 1) * fact(m);
    var text;
    if (_PU.randInt(0, 1) === 0) {
      text = n + ' 个文艺节目陆续演出，其中 ' + m + ' 个舞蹈节目必须相邻出场。一共有 ____ 种不同的出场顺序。';
    } else {
      text = n + ' 位同学站成一排合影，其中 ' + m + ' 名好朋友必须相邻。一共有 ____ 种不同的站法。';
    }
    return fillQ({
      type: 'bundling',
      text: text,
      answer: [ways],
      hint: '捆绑法：把相邻的 ' + m + ' 个捆成一个整体，共 ' + (n - m + 1) + ' 个元素全排 (' + (n - m + 1) +
        ')! = ' + fact(n - m + 1) + '，整体内部再排 ' + m + '! = ' + fact(m) + ' → 共 ' + ways + ' 种'
    });
  }

  // ============ 11. 插空法（多组不相邻） ============
  function genInsertion() {
    var boys = _PU.randInt(3, 9), girls;
    do { girls = _PU.randInt(2, 6); } while (girls > boys + 1);
    var ways = fact(boys) * P(boys + 1, girls);
    return fillQ({
      type: 'insertion',
      text: boys + ' 名男生和 ' + girls + ' 名女生站成一排，要求任何两名女生都不相邻（男生之间可以相邻）。一共有 ____ 种不同的站法。',
      answer: [ways],
      hint: '先排男生：' + boys + '! = ' + fact(boys) + '；形成 ' + (boys + 1) +
        ' 个空位，选 ' + girls + ' 个插入女生（有序）：A(' + (boys + 1) + ',' + girls + ') = ' +
        P(boys + 1, girls) + ' → 共 ' + ways + ' 种'
    });
  }

  // ============ 12. 隔板法（允许空） ============
  function genStarsBars() {
    var mode = _PU.randInt(0, 1);
    var k = _PU.randInt(3, 4);
    if (mode === 0) {
      var n = _PU.randInt(5, 12);
      var ans = C(n + k - 1, k - 1);
      return fillQ({
        type: 'stars-bars',
        text: '把 ' + n + ' 个完全相同的小球放进 ' + k + ' 个不同的盒子里，允许盒子空着，一共有 ____ 种放法。',
        answer: [ans],
        hint: '允许空盒：球与隔板同排，' + n + ' 球插 ' + (k - 1) +
          ' 块隔板 → C(' + (n + k - 1) + ',' + (k - 1) + ') = ' + ans
      });
    }
    var n2 = _PU.randInt(k + 2, 14);
    var ans2 = C(n2 - 1, k - 1);
    return fillQ({
      type: 'stars-bars',
      text: '把 ' + n2 + ' 个完全相同的小球放进 ' + k + ' 个不同的盒子里，要求每个盒子至少放一个球，一共有 ____ 种放法。',
      answer: [ans2],
      hint: '不允许空盒：' + n2 + ' 个球的 ' + (n2 - 1) + ' 个空隙中插 ' + (k - 1) +
        ' 块隔板 → C(' + (n2 - 1) + ',' + (k - 1) + ') = ' + ans2
    });
  }

  // ============ 13. 抽屉原理（构造抽屉） ============
  function genPigeonhole() {
    // 多种抽屉场景：变化类别数 kinds 与保证同类数 want，保证题面多样性足以产出≥25道不重复题
    var setups = [
      { what: '一副去掉大小王的扑克牌按红桃、黑桃、梅花、方块分为 4 类', kinds: 4, want: _PU.randInt(3, 6), tail: '张点数花色相同的牌（同一花色）', unit: '张' },
      { what: '全班同学按出生月份分为 12 类', kinds: 12, want: _PU.randInt(3, 5), tail: '人生日在同一个月的同学', unit: '人' },
      { what: '箱子里有黑、白、蓝、绿、紫、橙 6 种颜色的袜子（每色都足够多）', kinds: 6, want: _PU.randInt(2, 4), tail: '只颜色相同的袜子', unit: '只' },
      { what: '盒子里有红、橙、黄、绿、蓝、靛、紫 7 种颜色的积木（每种都足够多）', kinds: 7, want: _PU.randInt(2, 4), tail: '块颜色相同的积木', unit: '块' },
      { what: '信封里有 0~9 共 10 种数字卡片（每种都足够多）', kinds: 10, want: _PU.randInt(2, 4), tail: '张数字相同的卡片', unit: '张' },
      { what: '篮子里有苹果、香蕉、橘子、葡萄、芒果 5 种水果（每种都足够多）', kinds: 5, want: _PU.randInt(3, 4), tail: '个相同的水果', unit: '个' },
      { what: '衣柜里有春、夏、秋、冬 4 类衣物', kinds: 4, want: _PU.randInt(2, 3), tail: '件同一季节的衣物', unit: '件' },
      { what: '挂钩上有红、黄、蓝 3 种颜色的帽子（每种都足够多）', kinds: 3, want: _PU.randInt(2, 3), tail: '顶颜色相同的帽子', unit: '顶' },
      { what: '书架上摆着 8 种不同样式的书包（每种都足够多）', kinds: 8, want: _PU.randInt(2, 3), tail: '个同一款式的书包', unit: '个' },
      { what: '调色盘里有 9 种颜色的颜料（每种都足够多）', kinds: 9, want: _PU.randInt(2, 3), tail: '支颜色相同的颜料', unit: '支' }
    ];
    var st = setups[_PU.randInt(0, setups.length - 1)];
    var ans = (st.want - 1) * st.kinds + 1;
    return fillQ({
      type: 'pigeonhole',
      text: st.what + '。至少要取出多少 ' + st.unit + '，才能保证一定有 ' + st.want + ' ' + st.tail + '？答案：____ ' + st.unit + '。',
      answer: [ans],
      hint: '最不利时每类都取了 ' + (st.want - 1) + ' ' + st.unit + '：' + (st.want - 1) + '×' + st.kinds +
        '+1 = ' + ans + ' ' + st.unit + '（再多取一个必然使某一类达到 ' + st.want + '）'
    });
  }

  // ============ 14. 最不利原则（复杂保证） ============
  function genWorstCase() {
    var setups = [
      // 扑克点数/花色：answer = 类别数×(K−1) + 干扰张 + 1
      function () {
        var K = _PU.randInt(3, 5);
        var withJoker = _PU.randInt(0, 1) === 0;
        var extra = withJoker ? 2 : 0;
        var ans = 13 * (K - 1) + extra + 1;
        return {
          text: '一副扑克牌共 ' + (52 + extra) + ' 张' + (withJoker ? '（含大、小王，不算点数）' : '（去掉大小王）') +
            '。至少要抽出 ____ 张，才能保证其中有 ' + K + ' 张牌的点数相同。',
          ans: ans,
          hint: '最不利：' + 13 + ' 种点数各抽 ' + (K - 1) + ' 张 = ' + (13 * (K - 1)) +
            (extra ? '，再加大小王 ' + extra + ' 张' : '') + '，此时任抽一张必有某点数达 ' + K +
            ' 张 → ' + (13 * (K - 1)) + (extra ? '+' + extra : '') + '+1 = ' + ans
        };
      },
      function () {
        var K = _PU.randInt(4, 6);
        var ans = 4 * (K - 1) + 1;
        return {
          text: '一副扑克牌去掉大小王共 52 张。至少要抽出 ____ 张，才能保证其中有 ' + K + ' 张牌的花色相同。',
          ans: ans,
          hint: '按 4 种花色构造抽屉：最不利时每种花色各 ' + (K - 1) + ' 张共 ' + (4 * (K - 1)) +
            ' 张，下一张必达 ' + K + ' 张同花色 → ' + (4 * (K - 1)) + '+1 = ' + ans
        };
      },
      function () {
        var withJoker = _PU.randInt(0, 1) === 0;
        var suitName = ['黑桃', '红桃', '梅花', '方块'][_PU.randInt(0, 3)];
        var total = withJoker ? 54 : 52;
        var bad = total - 13;
        return {
          text: '一副扑克牌共 ' + total + ' 张' + (withJoker ? '（含大、小王）' : '') +
            '。至少要抽出 ____ 张，才能保证一定能抽出一张' + suitName + '。',
          ans: bad + 1,
          hint: '最不利：把非' + suitName + '的 ' + bad + ' 张全部抽完仍未抽到，下一张必是' + suitName +
            ' → ' + bad + '+1 = ' + (bad + 1)
        };
      },
      // 袜子配双：k 色 P 双 → answer = 2P−1+k（预算全堆一种颜色）
      function () {
        var k = _PU.randInt(3, 6);
        var pairs = _PU.randInt(1, 3);
        var colors = ['黑', '白', '灰', '蓝', '红', '绿'];
        var ans = 2 * pairs - 1 + k;
        return {
          text: '抽屉里有' + colors.slice(0, k).join('、') + '共 ' + k +
            ' 种颜色的袜子（每色都足够多）。至少要取出 ____ 只，才能保证一定有 ' + pairs + ' 双颜色相同的袜子？（一双=同色两只）',
          ans: ans,
          hint: '最不利：让其中一色集中出现 ' + (2 * pairs - 1) + ' 只（仅 ' + (pairs - 1) + ' 双），其余每色各 1 只 → 共 ' +
            ((2 * pairs - 1) + (k - 1)) + ' 只仍不达标，再取 1 只必成 ' + pairs + ' 双 → ' + ans
        };
      },
      // 每类至少 m 个的一般形式
      function () {
        var kinds = [_PU.randInt(5, 9)][0];
        var m = _PU.randInt(2, 4);
        var items = ['弹珠', '积木', '卡片'][_PU.randInt(0, 2)];
        var ans = kinds * (m - 1) + 1;
        return {
          text: '箱子里有 ' + kinds + ' 种不同样式的' + items + '（每种都足够多）。至少要取出 ____ 个，才能保证其中恰有同一款式的 ' + m + ' 个？',
          ans: ans,
          hint: '最不利：每种样式各取 ' + (m - 1) + ' 个共 ' + (kinds * (m - 1)) + ' 个仍不满足，再取 1 个必有某样式达 ' + m +
            ' 个 → ' + (kinds * (m - 1)) + '+1 = ' + ans
        };
      }
    ];
    var st = setups[_PU.randInt(0, setups.length - 1)]();
    return fillQ({
      type: 'worst-case',
      text: st.text,
      answer: [st.ans],
      hint: st.hint
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['inclusion-exclusion', 'recursion', 'derangement', 'geometry-count',
        'add-principle', 'mult-principle', 'permutation', 'combination',
        'enumeration', 'bundling', 'insertion', 'stars-bars', 'pigeonhole', 'worst-case']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'inclusion-exclusion': genInclusion, recursion: genRecursion,
      derangement: genDerangement, 'geometry-count': genGeometryCount,
      'add-principle': genAddPrinciple, 'mult-principle': genMultPrinciple,
      permutation: genPermutation, combination: genCombination,
      enumeration: genEnumeration, bundling: genBundling,
      insertion: genInsertion, 'stars-bars': genStarsBars,
      pigeonhole: genPigeonhole, 'worst-case': genWorstCase
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
      6: ['math-g6-c3-inclusion-exclusion', 'math-g6-c3-recursion-counting', 'math-g6-c3-derangement', 'math-g6-c3-geometry-counting',
        'math-g6-c3-addition-principle', 'math-g6-c3-multiplication-principle', 'math-g6-c3-permutation', 'math-g6-c3-combination',
        'math-g6-c3-enumeration-counting', 'math-g6-c3-bundling-method', 'math-g6-c3-insertion-method', 'math-g6-c3-stars-bars',
        'math-g6-c3-pigeonhole-principle', 'math-g6-c3-worst-case-principle']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',                label: '综合' },
        { value: 'inclusion-exclusion', label: '容斥原理' },
        { value: 'recursion',          label: '递推计数' },
        { value: 'derangement',        label: '错排问题' },
        { value: 'geometry-count',     label: '几何计数' },
        { value: 'add-principle',      label: '加法原理' },
        { value: 'mult-principle',     label: '乘法原理' },
        { value: 'permutation',        label: '排列' },
        { value: 'combination',        label: '组合与分组' },
        { value: 'enumeration',        label: '枚举计数' },
        { value: 'bundling',           label: '捆绑法' },
        { value: 'insertion',          label: '插空法' },
        { value: 'stars-bars',         label: '隔板法' },
        { value: 'pigeonhole',         label: '抽屉原理' },
        { value: 'worst-case',         label: '最不利原则' }
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
