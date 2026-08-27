// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c9.js — 五年级竞赛 C9 基础应用题（新语义题型）
// 实现题型（type 与知识库一致）：
//   chicken-rabbit 鸡兔同笼（假设法）
//   profit-loss    盈亏问题
//   age            年龄问题（年龄差不变）
//   average        平均数问题
//   periodic       周期问题
//   sum-diff       和差问题
//   grass          牛吃草问题（草匀速生长，设每头牛每天吃 1 份）
//   economics      经济问题（成本/售价/利润率/折扣）
//   inclusion-exclusion 容斥原理（两集合 / 三集合，构造法保证一致）
//   eq1            一元一次方程（解为整数）
//   eq2            二元一次方程组（整数解）
//   diophantine    不定方程正整数解（枚举保证唯一）
// 设计要点：逻辑简单、答案唯一；先定答案再反推题干参数。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c9.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模（C 模块难度集中在 3~5 档，数值温和放大） */
  function scale(lv) {
    if (lv >= 8) return { kmax: 5, umax: 10, xmax: 20, coefMax: 12 };
    if (lv >= 5) return { kmax: 3, umax: 8, xmax: 15, coefMax: 9 };
    return { kmax: 2, umax: 6, xmax: 12, coefMax: 6 };
  }

  // ============ 1. 鸡兔同笼 ============
  function genChickenRabbit() {
    var c = _PU.randInt(5, 20), r = _PU.randInt(3, 12);
    var H = c + r, F = 2 * c + 4 * r;
    return fillQ({
      type: 'chicken-rabbit',
      text: '鸡兔同笼，笼中共有 ' + H + ' 个头、' + F + ' 只脚。鸡有 ____ 只，兔有 ____ 只。（先填鸡，再填兔）',
      answer: [c, r],
      hint: '假设全是兔：' + H + '×4 = ' + (H * 4) + ' 只脚，多出 ' + (H * 4 - F) + ' 只，每只鸡少 2 只脚 → 鸡 ' + c + ' 只、兔 ' + r + ' 只'
    });
  }

  // ============ 2. 盈亏问题 ============
  function genProfitLoss() {
    var d = _PU.randInt(2, 5);                 // 每人两次分配数之差
    var people = _PU.randInt(3, 15);
    var per1 = _PU.randInt(3, 6), per2 = per1 + d;
    var extra = _PU.randInt(1, 6);
    var short = d * people - extra;
    if (short <= 0) short = 1;
    var total = per1 * people + extra;
    return fillQ({
      type: 'profit-loss',
      text: '把一些苹果分给小朋友，每人分 ' + per1 + ' 个，还多 ' + extra + ' 个；每人分 ' + per2 + ' 个，则少 ' + short + ' 个。一共有 ____ 个小朋友。',
      answer: [people],
      hint: '人数 = (多 + 少) ÷ 每人相差 = (' + extra + '＋' + short + ')÷' + d + ' = ' + people
    });
  }

  // ============ 3. 年龄问题 ============
  function genAge() {
    var k = _PU.randInt(2, 4);
    var c = _PU.randInt(4, 10);                // 儿子年龄
    var x = _PU.randInt(3, 20);                // 几年后（答案）
    var f = k * c + (k - 1) * x;               // 父亲年龄
    if (f > 72 || f <= c) return null;
    return fillQ({
      type: 'age',
      text: '父亲今年 ' + f + ' 岁，儿子今年 ' + c + ' 岁。____ 年后，父亲的年龄正好是儿子的 ' + k + ' 倍。',
      answer: [x],
      hint: '设 x 年后：' + f + '＋x = ' + k + '×(' + c + '＋x)，解得 x = ' + x
    });
  }

  // ============ 4. 平均数问题 ============
  function genAverage() {
    var m = _PU.randInt(3, 8), avg = _PU.randInt(70, 95);
    return fillQ({
      type: 'average',
      text: '小明前 ' + m + ' 次测验的平均分是 ' + avg + ' 分，他前 ' + m + ' 次测验的总分是 ____ 分。',
      answer: [m * avg],
      hint: '总数 = 平均数 × 份数 = ' + avg + '×' + m + ' = ' + (m * avg)
    });
  }

  // ============ 5. 周期问题 ============
  var COLOR_SET = [['红', '黄', '蓝'], ['红', '黄', '蓝', '绿'], ['红', '黄', '蓝', '绿', '紫']];
  function genPeriodic() {
    var idx = _PU.randInt(0, 2);
    var colors = COLOR_SET[idx];
    var n = _PU.randInt(15, 45);
    var ans = colors[(n - 1) % colors.length];
    return fillQ({
      type: 'periodic',
      text: '彩灯按 ' + colors.join('、') + ' 的顺序循环排列，第 ' + n + ' 个彩灯是 ____ 色。',
      answer: [ans],
      hint: '周期为 ' + colors.length + '：' + n + ' ÷ ' + colors.length + ' = ' + Math.floor(n / colors.length) + '……' + ((n - 1) % colors.length + 1) + '，对应第 ' + ((n - 1) % colors.length + 1) + ' 个 → ' + ans
    });
  }

  // ============ 6. 和差问题 ============
  function genSumDiff() {
    var s = _PU.randInt(20, 80), d = _PU.randInt(2, 10);
    if ((s + d) % 2 !== 0) d = d + 1;          // 保证同奇偶
    var big = (s + d) / 2, small = (s - d) / 2;
    if (small < 1) return null;
    return fillQ({
      type: 'sum-diff',
      text: '两个数的和是 ' + s + '，差是 ' + d + '。较大的数是 ____，较小的数是 ____。（先填较大的，再填较小的）',
      answer: [big, small],
      hint: '大数 = (' + s + '＋' + d + ')÷2 = ' + big + '；小数 = (' + s + '−' + d + ')÷2 = ' + small
    });
  }

  // ============ 7. 牛吃草问题 ============
  function genGrass(sc) {
    var g = _PU.randInt(2, 6);                     // 每天长草份数
    var u = _PU.randInt(2, sc.umax), v;
    do { v = _PU.randInt(2, sc.umax); } while (v === u);
    var k = _PU.randInt(1, sc.kmax);
    var S = u * v * k;                             // 原有草量
    var d1 = Math.min(v, u) * k, d2 = Math.max(v, u) * k;
    var cow1 = S / d1 + g, cow2 = S / d2 + g;
    if (cow1 === cow2) return genGrass(sc);
    var mode = _PU.randInt(0, 3);
    var base = '一片草地，草每天匀速生长（设每头牛每天吃 1 份草）。这片地可供 ' + cow1 + ' 头牛吃 ' + d1 +
      ' 天，也可供 ' + cow2 + ' 头牛吃 ' + d2 + ' 天。';
    if (mode === 0) {
      // 求第三组牛数可吃的天数
      var ws = [];
      for (var w = 1; w <= 12; w++) {
        if (w !== u && w !== v && S % w === 0) ws.push(w);
      }
      if (!ws.length) return genGrass(sc);
      var wPick = ws[_PU.randInt(0, ws.length - 1)];
      var cow3 = g + wPick, days = S / wPick;
      return fillQ({
        type: 'grass',
        text: base + '那么这片草地可供 ' + cow3 + ' 头牛吃多少天？',
        answer: [days],
        hint: '每天长草 g = (' + (cow1 * d1) + '−' + (cow2 * d2) + ')÷(' + (d2 - d1) + ') = ' + g +
          ' 份；原有草 S = ' + (cow1 * d1) + ' − ' + g + '×' + d1 + ' = ' + S + ' 份；' +
          cow3 + ' 头牛每天净消耗 ' + (cow3 - g) + ' 份 → ' + S + ' ÷ ' + (cow3 - g) + ' = ' + days + ' 天'
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'grass',
        text: base + '问每天长出的草量是多少份？（设每头牛每天吃 1 份）',
        answer: [g],
        hint: '对比两种吃法总草量差：(' + (cow1 * d1) + ' − ' + (cow2 * d2) + ') ÷ (' + (d2 - d1) + ' 天) = ' + g + ' 份/天'
      });
    }
    if (mode === 2) {
      return fillQ({
        type: 'grass',
        text: base + '问草地原有的草量是多少份？（设每头牛每天吃 1 份）',
        answer: [S],
        hint: '原有草 = ' + cow1 + ' 头牛吃 ' + d1 + ' 天总量 − 生长量 = ' + (cow1 * d1) + ' − ' + g + '×' + d1 + ' = ' + S + ' 份'
      });
    }
    return fillQ({
      type: 'grass',
      text: base + '如果不让草吃完，这片草地至多可以放牧多少头牛？',
      answer: [g],
      hint: '放牧头数恰好等于每天生长量时草永远吃不完 → 至多 ' + g + ' 头'
    });
  }

  // ============ 8. 经济问题 ============
  function genEconomics(sc) {
    var mode = _PU.randInt(0, 3);
    if (mode <= 1 || mode === 3) {
      // 成本/售价/利润率互求
      for (var t = 0; t < 200; t++) {
        var cost = _PU.randInt(4, 40) * 5;
        var rate = _PU.randInt(4, 50);
        if ((cost * rate) % 100 !== 0) continue;
        var profit = cost * rate / 100;
        var price = cost + profit;
        if (mode === 0) {
          return fillQ({
            type: 'economics',
            text: '一件商品的成本是 ' + cost + ' 元，按利润率 ' + rate + '% 定价出售。这件商品的售价是 ____ 元。',
            answer: [price],
            hint: '售价 = 成本 ×(1＋利润率) = ' + cost + ' × (1＋' + rate + '%) = ' + cost + ' ＋ ' + profit + ' = ' + price + ' 元'
          });
        }
        if (mode === 1) {
          return fillQ({
            type: 'economics',
            text: '一件商品的售价是 ' + price + ' 元，利润率为 ' + rate + '%。这件商品的成本是 ____ 元。',
            answer: [cost],
            hint: '成本 × (1＋' + rate + '%) = ' + price + ' → 成本 = ' + price + ' ÷ ' + (100 + rate) + ' × 100 = ' + cost + ' 元'
          });
        }
        return fillQ({
          type: 'economics',
          text: '一件商品成本 ' + cost + ' 元，售价 ' + price + ' 元。它的利润率是 ____ %。（只填数字）',
          answer: [rate],
          hint: '利润率 = 利润 ÷ 成本 ×100% = ' + profit + ' ÷ ' + cost + ' ×100% = ' + rate + '%'
        });
      }
      return genEconomics(scale(5));
    }
    // 折扣
    var orig = _PU.randInt(3, 30) * 10;
    var zhe = _PU.randInt(5, 9);
    var now = orig * zhe / 10;
    if (_PU.randInt(0, 1) === 0) {
      return fillQ({
        type: 'economics',
        text: '一件外套原价 ' + orig + ' 元，商场打 ' + zhe + ' 折出售。现价是 ____ 元。',
        answer: [now],
        hint: '现价 = 原价 ×折扣/10 = ' + orig + ' × ' + zhe + '/10 = ' + now + ' 元'
      });
    }
    return fillQ({
      type: 'economics',
      text: '一双鞋打 ' + zhe + ' 折后的售价是 ' + now + ' 元。这双鞋的原价是 ____ 元。',
      answer: [orig],
      hint: '原价 = 现价 ÷ 折扣 ×10 = ' + now + ' ÷ ' + zhe + ' ×10 = ' + orig + ' 元'
    });
  }

  // ============ 9. 容斥原理 ============
  function genInclusion() {
    if (_PU.randInt(0, 1) === 0) {
      // 两集合
      var A = _PU.randInt(14, 28), B = _PU.randInt(12, 24);
      var inter = _PU.randInt(4, Math.min(A, B) - 3);
      var union = A + B - inter;
      var none = _PU.randInt(2, 10);
      var total = union + none;
      var mode = _PU.randInt(0, 2);
      var head = '某班共有 ' + total + ' 名同学，其中喜欢数学的有 ' + A + ' 人，喜欢语文的有 ' + B + ' 人。';
      if (mode === 0) {
        return fillQ({
          type: 'inclusion-exclusion',
          text: head + '数学、语文都喜欢的有 ____ 人。',
          answer: [inter],
          hint: '容斥：A＋B−都喜欢 = 至少喜欢一科 → 都喜欢 = ' + A + '＋' + B + '−' + union + ' = ' + inter
        });
      }
      if (mode === 1) {
        return fillQ({
          type: 'inclusion-exclusion',
          text: head + '两科都不喜欢的有 ____ 人。',
          answer: [none],
          hint: '至少喜欢一科的 = ' + A + '＋' + B + '−' + inter + ' = ' + union + ' 人，都不喜欢的 = ' + total + ' − ' + union + ' = ' + none + ' 人'
        });
      }
      return fillQ({
        type: 'inclusion-exclusion',
        text: head + '已知两科都喜欢的有 ' + inter + ' 人，至少喜欢其中一科的有 ____ 人。',
        answer: [union],
        hint: '至少一科 = A＋B−交集 = ' + A + '＋' + B + '−' + inter + ' = ' + union + ' 人'
      });
    }
    // 三集合（构造一致数据）
    var tri = _PU.randInt(2, 4);
    var pAB = _PU.randInt(1, 3), pBC = _PU.randInt(1, 3), pAC = _PU.randInt(1, 3);
    var sa = _PU.randInt(2, 6), sb = _PU.randInt(2, 6), sC = _PU.randInt(2, 6);
    var onlyNone = _PU.randInt(1, 6);
    var total3 = sa + sb + sC + pAB + pBC + pAC + tri + onlyNone;
    var aAll = sa + pAB + pAC + tri, bAll = sb + pAB + pBC + tri, cAll = sC + pBC + pAC + tri;
    var union3 = total3 - onlyNone;
    var ask = _PU.randInt(0, 2);
    var head2 = '对 ' + total3 + ' 名同学的兴趣调查：参加书法小组的有 ' + aAll + ' 人，参加绘画小组的有 ' + bAll +
      ' 人，参加围棋小组的有 ' + cAll + ' 人；同时参加书法和绘画的有 ' + (pAB + tri) + ' 人，绘画和围棋的有 ' + (pBC + tri) +
      ' 人，书法和围棋的有 ' + (pAC + tri) + ' 人。';
    if (ask === 0) {
      return fillQ({
        type: 'inclusion-exclusion',
        text: head2 + '三个小组都参加的有 ____ 人。',
        answer: [tri],
        hint: '容斥变形：都参加 = 至少一组 − [(单组合计) − (两两组合计)] …代入得 ' + tri + ' 人'
      });
    }
    if (ask === 1) {
      return fillQ({
        type: 'inclusion-exclusion',
        text: head2 + '三个小组中至少参加一个的有 ____ 人。',
        answer: [union3],
        hint: '|A∪B∪C| = ' + aAll + '＋' + bAll + '＋' + cAll + '−' + (pAB + tri) + '−' + (pBC + tri) + '−' + (pAC + tri) + '＋都参加人数'
      });
    }
    return fillQ({
      type: 'inclusion-exclusion',
      text: head2 + '三个小组都没有参加的有 ____ 人。',
      answer: [onlyNone],
      hint: '先求至少参加一组的人数，再用总人数相减：' + total3 + ' − ' + union3 + ' = ' + onlyNone + ' 人'
    });
  }

  // ============ 10. 一元一次方程 ============
  function fmtSigned(n, first) { // 输出 "+ 5" / "- 5" / "5"
    if (first) return String(n);
    return n < 0 ? '− ' + Math.abs(n) : '+ ' + n;
  }
  function genEq1(sc) {
    var x = _PU.randInt(2, sc.xmax);
    var form = _PU.randInt(0, 2);
    if (form === 0) {
      var a = _PU.randInt(2, sc.coefMax), b = _PU.randInt(-15, 15);
      while (b === 0) b = _PU.randInt(-15, 15);
      var c = a * x + b;
      return fillQ({
        type: 'eq1',
        text: '解方程：' + a + 'x ' + fmtSigned(b) + ' = ' + c + '。x = ____。',
        answer: [x],
        hint: a + 'x = ' + c + ' ' + (b < 0 ? '＋' : '−') + ' ' + Math.abs(b) + ' = ' + (c - b) + '，x = ' + (c - b) + ' ÷ ' + a + ' = ' + x
      });
    }
    if (form === 1) {
      var a1 = _PU.randInt(3, sc.coefMax), c1;
      do { c1 = _PU.randInt(2, sc.coefMax - 1); } while (c1 === a1);
      var b1 = _PU.randInt(-12, 12);
      var d1 = b1 + (a1 - c1) * x;
      return fillQ({
        type: 'eq1',
        text: '解方程：' + a1 + 'x ' + fmtSigned(b1) + ' = ' + c1 + 'x ' + fmtSigned(d1) + '。x = ____。',
        answer: [x],
        hint: '移项合并：(' + (a1 - c1) + ')x = ' + (d1 - b1) + '，x = ' + x
      });
    }
    var a2 = _PU.randInt(2, 6), k = _PU.randInt(2, sc.xmax), b2 = _PU.randInt(1, 20);
    var xAns = a2 * k, c2v = b2 + k;
    return fillQ({
      type: 'eq1',
      text: '解方程：x ÷ ' + a2 + ' ' + fmtSigned(b2) + ' = ' + c2v + '。x = ____。',
      answer: [xAns],
      hint: 'x ÷ ' + a2 + ' = ' + c2v + ' − ' + b2 + ' = ' + k + '，x = ' + k + ' × ' + a2 + ' = ' + xAns
    });
  }

  // ============ 11. 二元一次方程组 ============
  function genEq2(sc) {
    for (var t = 0; t < 100; t++) {
      var x0 = _PU.randInt(-6, 8), y0 = _PU.randInt(-6, 8);
      if (x0 === 0 && y0 === 0) continue;
      var a1 = 1, b1 = _PU.randInt(-6, 6); // 第一个方程 x 的系数固定为 1
      var a2 = _PU.randInt(1, sc.coefMax), b2 = _PU.randInt(-6, 6);
      if (b1 === 0 || b2 === 0) continue;
      if (a1 * b2 - a2 * b1 === 0) continue; // 行列式非零保证唯一解
      var c1 = a1 * x0 + b1 * y0, c2 = a2 * x0 + b2 * y0;
      return fillQ({
        type: 'eq2',
        text: '解方程组：x ' + fmtSigned(b1) + 'y = ' + c1 + '；' + a2 + 'x ' + fmtSigned(b2) +
          'y = ' + c2 + '。则 x = ____，y = ____。（先填 x，再填 y）',
        answer: [x0, y0],
        hint: '由第一个方程得 x = ' + c1 + ' ' + (b1 < 0 ? '＋' : '−') + ' ' + Math.abs(b1) + 'y，代入第二个方程得 y = ' + y0 + '，进而 x = ' + x0
      });
    }
    return genEq2(scale(5));
  }

  // ============ 12. 不定方程整数解 ============
  function genDiophantine(sc) {
    for (var t = 0; t < 300; t++) {
      var a = _PU.randInt(2, sc.coefMax), b = _PU.randInt(2, sc.coefMax);
      if (a === b) continue;
      var x0 = _PU.randInt(1, 12), y0 = _PU.randInt(1, 12);
      var c = a * x0 + b * y0;
      // 枚举正整数解，要求恰好唯一
      var sols = [];
      for (var xx = 1; xx * a < c; xx++) {
        var rem = c - a * xx;
        if (rem % b === 0 && rem / b >= 1) sols.push([xx, rem / b]);
      }
      if (sols.length !== 1) continue;
      return fillQ({
        type: 'diophantine',
        text: '求不定方程 ' + a + 'x + ' + b + 'y = ' + c + ' 的正整数解（该方程只有一组）。x = ____，y = ____。（先填 x，再填 y）',
        answer: sols[0],
        hint: '用 x 试值：x = ' + x0 + ' 时，y = (' + c + ' − ' + a + '×' + x0 + ')÷' + b + ' = ' + y0 + '，且仅此一组为正整数'
      });
    }
    return genDiophantine(scale(5));
  }


  function genPlanting(sc) {
    var mode = _PU.randInt(0, 1);
    var gap = _PU.randInt(2, 6), len = gap * _PU.randInt(4, 15);
    if (mode === 0) {
      // 不封闭（两端都栽）：棵数 = 距离/间隔 + 1
      return fillQ({ type: 'planting',
        text: '在一条长 ' + len + ' 米的小路一侧植树，每隔 ' + gap + ' 米栽一棵（两端都栽）。一共需要多少棵树苗？',
        answer: [len / gap + 1],
        hint: '两端都栽：棵数 = 距离÷间隔＋1 = ' + len + '÷' + gap + '＋1 = ' + (len/gap+1) + ' 棵'
      });
    }
    // 封闭（圆形水池边）：棵数 = 周长/间隔
    return fillQ({ type: 'planting',
      text: '在一个周长为 ' + len + ' 米的圆形水池边植树，每隔 ' + gap + ' 米栽一棵。一共需要多少棵树苗？',
      answer: [len / gap],
      hint: '封闭路线：棵数 = 周长÷间隔 = ' + len + '÷' + gap + ' = ' + (len/gap) + ' 棵'
    });
  }

  function genPhalanx(sc) {
    var n = _PU.randInt(4, 10);
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 实心方阵
      return fillQ({ type: 'phalanx',
        text: '一个 ' + n + '×' + n + ' 的实心方阵，一共有多少人？',
        answer: [n * n], hint: '实心方阵总人数 = 边长² = ' + n + '² = ' + (n*n)
      });
    }
    // 空心方阵：外层 n 人，去掉内层（n-4）人
    var outer = n * 4 - 4; // 最外层人数
    return fillQ({ type: 'phalanx',
      text: '一个空心方阵，最外层每边有 ' + n + ' 人，共一层。这一层有多少人？',
      answer: [outer], hint: '最外层人数 = 每边人数×4 − 4（四角重复）= ' + n + '×4−4 = ' + outer
    });
  }

  function genFracPercent(sc) {
    var mode = _PU.randInt(0, 1);
    var price = _PU.randInt(40, 200);
    if (mode === 0) {
      // 打折
      var zhe = _PU.randInt(5, 8);
      var now = price * zhe / 10;
      return fillQ({ type: 'frac-percent',
        text: '一件衣服原价 ' + price + ' 元，打 ' + zhe + ' 折出售。现价是多少元？',
        answer: [now], hint: '现价 = 原价×折扣/10 = ' + price + '×' + zhe + '/10 = ' + now + ' 元'
      });
    }
    // 求百分比
    var total = _PU.randInt(20, 60), part = _PU.randInt(5, Math.floor(total / 2));
    while ((part * 100) % total !== 0) part++;
    var pct = part * 100 / total;
    return fillQ({ type: 'frac-percent',
      text: '某班有 ' + total + ' 名学生，其中 ' + part + ' 名参加了体育小组。参加体育小组的人数占全班人数的百分之几？（只填数字）',
      answer: [pct], hint: pct + '% = ' + part + '/' + total + '×100%'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['chicken-rabbit', 'profit-loss', 'age', 'average', 'periodic', 'sum-diff',
         'grass', 'economics', 'inclusion-exclusion', 'eq1', 'eq2', 'diophantine', 'planting', 'phalanx', 'frac-percent']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'chicken-rabbit': genChickenRabbit, 'profit-loss': genProfitLoss, age: genAge,
      average: genAverage, periodic: genPeriodic, 'sum-diff': genSumDiff,
      grass: function () { return genGrass(sc); },
      economics: function () { return genEconomics(sc); },
      'inclusion-exclusion': genInclusion,
      eq1: function () { return genEq1(sc); },
      eq2: function () { return genEq2(sc); },
      diophantine: function () { return genDiophantine(sc); },
      planting: function () { return genPlanting(sc); },
      phalanx: genPhalanx,
      'frac-percent': function () { return genFracPercent(sc); }
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
    id: 'math-competition-g5-c9',
    name: '基础应用题（五年级）',
    subject: 'math',
    category: 'mixed',
    grades: [5, 6],
    moduleId: 'C9',
    knowledgePoints: {
      6: ['math-g6-c9-sum-diff-problem','math-g6-c9-age-problem','math-g6-c9-profit-loss-problem',
        'math-g6-c9-chicken-rabbit','math-g6-c9-average-problem','math-g6-c9-periodic-problem',
        'math-g6-c9-grass-problem','math-g6-c9-economics-problem','math-g6-c9-inclusion-exclusion',
        'math-g6-c9-equation-linear-1','math-g6-c9-equation-linear-2','math-g6-c9-fraction-percent-application',
        'math-g6-c9-planting-problem','math-g6-c9-phalanx-problem'],
      5: ['math-g5-c9-chicken-rabbit', 'math-g5-c9-profit-loss-problem', 'math-g5-c9-age-problem',
          'math-g5-c9-average-problem', 'math-g5-c9-periodic-problem', 'math-g5-c9-sum-diff-problem',
          'math-g5-c9-grass-problem', 'math-g5-c9-economics-problem', 'math-g5-c9-inclusion-exclusion',
          'math-g5-c9-equation-linear-1', 'math-g5-c9-equation-linear-2', 'math-g5-c9-diophantine-equation',
          'math-g5-c9-planting-problem', 'math-g5-c9-phalanx-problem', 'math-g5-c9-fraction-percent-application']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',                 label: '综合' },
        { value: 'chicken-rabbit',      label: '鸡兔同笼' },
        { value: 'profit-loss',         label: '盈亏问题' },
        { value: 'age',                 label: '年龄问题' },
        { value: 'average',             label: '平均数问题' },
        { value: 'periodic',            label: '周期问题' },
        { value: 'sum-diff',            label: '和差问题' },
        { value: 'grass',               label: '牛吃草' },
        { value: 'economics',           label: '经济问题' },
        { value: 'inclusion-exclusion', label: '容斥原理' },
        { value: 'eq1',                 label: '一元一次方程' },
        { value: 'eq2',                 label: '二元一次方程组' },
        { value: 'diophantine',         label: '不定方程整数解' },
        { value: 'planting',            label: '植树问题' },
        { value: 'phalanx',             label: '方阵问题' },
        { value: 'frac-percent',        label: '分数百分数应用' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '基础应用题（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
