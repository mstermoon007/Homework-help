// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c4.js — 五年级竞赛 C4 几何模型（新语义题型）
// 实现题型（type 与知识库一致）：
//   bird-head     鸟头模型   一角相等/互补，面积比 = 夹角两边乘积比
//   butterfly     蝴蝶模型   任意四边形 S1×S3=S2×S4；梯形上下 = 底比平方、左右相等
//   swallow-tail  燕尾模型   D 在 BC 上，S△ABO:S△ACO = BD:DC
//   half          一半模型   平行四边形内一点对边三角形和 = 一半；中线平分
//   circle        圆与扇形   扇形面积 / 弧长（π 取 3.14，结果保留两位小数）
//   solid         立体图形   长方体 / 正方体表面积与体积
//   painted-cube  表面涂色   三面 8、两面 12(n−2)、一面 6(n−2)²、无色 (n−2)³
//   pythagorean   勾股定理   常用勾股数求斜边或直角边
//   lattice       格点面积   皮克定理 S = N + L/2 − 1（L 取偶数保证整数）
//   angle         角度计算   多边形内角和 / 正多边形内角 / 三角形四边形求角
//
// 设计要点：题面纯文字描述图形（不依赖 SVG），参数均为正整数且答案为整数；
// 扇形题通过「角度—半径」整除配对保证结果最多两位小数，并用容差自定义判定。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c4.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      svg: cfg.figure || '',
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      check: cfg.check,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { kmax: 9, sideMax: 12, nMin: 3, nMax: 8, rCount: 99 };
    if (lv >= 5) return { kmax: 6, sideMax: 9, nMin: 3, nMax: 6, rCount: 99 };
    return { kmax: 4, sideMax: 6, nMin: 3, nMax: 5, rCount: 2 };
  }

  // 简单比例池（按难度递增排列，取前 n 个）
  var RATIO_POOL = [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [1, 3], [3, 1], [1, 4], [4, 1], [3, 4], [4, 3]];

  function pickRatio(sc) {
    var pool = sc.sideMax >= 12 ? RATIO_POOL : RATIO_POOL.slice(0, sc.sideMax >= 9 ? 9 : 5);
    return pool[_PU.randInt(0, pool.length - 1)];
  }

  // ============ 1. 鸟头模型 ============
  function genBirdHead(sc) {
    var r1 = pickRatio(sc), r2 = pickRatio(sc);
    var denom = (r1[0] + r1[1]) * (r2[0] + r2[1]);
    var k = _PU.randInt(1, sc.kmax);
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // 已知大三角形面积，求小三角形 ADE
      var S = denom * k;
      var small = r1[0] * r2[0] * k;
      return fillQ({
        type: 'bird-head',
        text: '在三角形 ABC 中，点 D 在边 AB 上，AD:DB = ' + r1[0] + ':' + r1[1] +
          '；点 E 在边 AC 上，AE:EC = ' + r2[0] + ':' + r2[1] +
          '。若三角形 ABC 的面积为 ' + S + ' 平方厘米，那么三角形 ADE 的面积是 ____ 平方厘米。',
        answer: [small],
        hint: '鸟头模型：S△ADE:S△ABC = (AD/AB)×(AE/AC)，' + S + ' × ' + r1[0] + '/' + (r1[0] + r1[1]) + ' × ' + r2[0] + '/' + (r2[0] + r2[1]) + ' = ' + small
      });
    }
    // 已知小三角形面积，反求大三角形面积
    var s2 = r1[0] * r2[0] * k;
    return fillQ({
      type: 'bird-head',
      text: '在三角形 ABC 中，点 D 在边 AB 上，AD:DB = ' + r1[0] + ':' + r1[1] +
        '；点 E 在边 AC 上，AE:EC = ' + r2[0] + ':' + r2[1] +
        '。若三角形 ADE 的面积为 ' + s2 + ' 平方厘米，那么三角形 ABC 的面积是 ____ 平方厘米。',
      answer: [denom * k],
      hint: '鸟头模型逆用：S△ABC = S△ADE ÷ [' + r1[0] + '/' + (r1[0] + r1[1]) + ' × ' + r2[0] + '/' + (r2[0] + r2[1]) + '] = ' + (denom * k)
    });
  }

  // ============ 2. 蝴蝶模型（任意四边形） ============
  var BFLY_NAMES = ['AOB', 'BOC', 'COD', 'AOD'];
  function genButterflyQuad(sc) {
    var m = sc.sideMax >= 12 ? 9 : (sc.sideMax >= 9 ? 6 : 4);
    var x = _PU.randInt(1, m), y = _PU.randInt(1, m), z = _PU.randInt(1, m), w = _PU.randInt(1, m);
    var v = [x * y, y * z, z * w, x * w];
    var h = _PU.randInt(0, 3);
    var knowns = [];
    for (var i = 0; i < 4; i++) if (i !== h) knowns.push('三角形 ' + BFLY_NAMES[i] + ' 的面积为 ' + v[i]);
    var ans = v[(h + 1) % 4] * v[(h + 3) % 4] / v[(h + 2) % 4];
    return fillQ({
      type: 'butterfly',
      text: '在四边形 ABCD 中，对角线 AC、BD 相交于点 O。已知' + knowns.join('，') +
        '，求三角形 ' + BFLY_NAMES[h] + ' 的面积。',
      answer: [ans],
      hint: '蝴蝶定理：S△AOB × S△COD = S△BOC × S△AOD，所以所求面积 = ' + v[(h + 1) % 4] + ' × ' + v[(h + 3) % 4] + ' ÷ ' + v[(h + 2) % 4] + ' = ' + ans
    });
  }

  // ============ 2. 蝴蝶模型（梯形） ============
  var TRAP_RATIOS = [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5], [3, 5], [1, 4], [4, 5]];
  function genButterflyTrap(sc) {
    var idx = _PU.randInt(0, (sc.sideMax >= 12 ? TRAP_RATIOS.length : TRAP_RATIOS.length - 4) - 1);
    var ab = TRAP_RATIOS[idx];
    var a = ab[0], b = ab[1];
    var k = _PU.randInt(1, sc.kmax);
    var top = a * a * k, bottom = b * b * k, side = a * b * k;
    var mode = _PU.randInt(0, 2);
    var head = '在梯形 ABCD 中，AD∥BC（AD 为上底），对角线 AC、BD 相交于点 O，上底 AD 与下底 BC 的长度比为 ' + a + ':' + b + '。';
    if (mode === 0) {
      return fillQ({
        type: 'butterfly',
        text: head + '已知三角形 AOD 的面积为 ' + top + '，求三角形 BOC 的面积。',
        answer: [bottom],
        hint: '梯形蝴蝶模型：S上:S下 = a²:b² = ' + (a * a) + ':' + (b * b) + '，故 S△BOC = ' + top + ' ÷ ' + (a * a) + ' × ' + (b * b) + ' = ' + bottom
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'butterfly',
        text: head + '已知三角形 BOC 的面积为 ' + bottom + '，求三角形 AOD 的面积。',
        answer: [top],
        hint: '梯形蝴蝶模型：S上:S下 = a²:b² = ' + (a * a) + ':' + (b * b) + '，故 S△AOD = ' + bottom + ' ÷ ' + (b * b) + ' × ' + (a * a) + ' = ' + top
      });
    }
    return fillQ({
      type: 'butterfly',
      text: head + '已知三角形 AOB 的面积为 ' + side + '，求三角形 COD 的面积。',
      answer: [side],
      hint: '梯形蝴蝶模型：左右两个三角形面积相等，S△COD = S△AOB = ' + side
    });
  }

  function genButterfly(sc) {
    return _PU.randInt(0, 1) === 0 ? genButterflyQuad(sc) : genButterflyTrap(sc);
  }

  // ============ 3. 燕尾模型 ============
  function genSwallowTail(sc) {
    var r = pickRatio(sc);
    var bd = r[0], dc = r[1];
    var k = _PU.randInt(2, sc.kmax + 4);
    var dir = _PU.randInt(0, 1);
    if (dir === 0) {
      var given = bd * k;
      return fillQ({
        type: 'swallow-tail',
        text: '在三角形 ABC 中，点 D 在边 BC 上，BD:DC = ' + bd + ':' + dc + '，点 O 在线段 AD 上。若三角形 ABO 的面积为 ' + given + '，那么三角形 ACO 的面积是 ____。',
        answer: [dc * k],
        hint: '燕尾模型：S△ABO:S△ACO = BD:DC = ' + bd + ':' + dc + '，' + given + ' ÷ ' + bd + ' × ' + dc + ' = ' + (dc * k)
      });
    }
    var given2 = dc * k;
    return fillQ({
      type: 'swallow-tail',
      text: '在三角形 ABC 中，点 D 在边 BC 上，BD:DC = ' + bd + ':' + dc + '，点 O 在线段 AD 上。若三角形 ACO 的面积为 ' + given2 + '，那么三角形 ABO 的面积是 ____。',
      answer: [bd * k],
      hint: '燕尾模型：S△ABO:S△ACO = BD:DC = ' + bd + ':' + dc + '，' + given2 + ' ÷ ' + dc + ' × ' + bd + ' = ' + (bd * k)
    });
  }

  // ============ 4. 一半模型 ============
  function genHalf(sc) {
    var m = _PU.randInt(2, sc.kmax + 4);
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 平行四边形内一点，一组对边三角形和 = 一半
      var s1 = _PU.randInt(2, sc.kmax + 4), s2v = _PU.randInt(2, sc.kmax + 4);
      return fillQ({
        type: 'half',
        text: '在平行四边形 ABCD 中，P 是内部任意一点，连接 PA、PB、PC、PD。已知三角形 PAB 的面积为 ' + s1 + '，三角形 PCD 的面积为 ' + s2v + '，那么平行四边形 ABCD 的面积是 ____。',
        answer: [2 * (s1 + s2v)],
        hint: '一半模型：S△PAB + S△PCD = 平行四边形面积的一半 = ' + (s1 + s2v) + '，整体 = ' + (2 * (s1 + s2v))
      });
    }
    if (mode === 1) {
      // 三角形中线平分
      var S = 2 * m;
      return fillQ({
        type: 'half',
        text: '三角形 ABC 的面积为 ' + S + '，D 是边 BC 的中点，连接 AD。那么三角形 ABD 的面积是 ____。',
        answer: [m],
        hint: '等底等高：中线把三角形分成面积相等的两部分，' + S + ' ÷ 2 = ' + m
      });
    }
    // 长方形内一点，上下三角形和 = 一半（已知一半求整体）
    var half = _PU.randInt(3, sc.kmax + 8);
    return fillQ({
      type: 'half',
      text: '在长方形 ABCD 内部任取一点 P，分别连接 PA、PB、PC、PD。已知三角形 PAB 与三角形 PCD 的面积之和为 ' + half + '，那么长方形 ABCD 的面积是 ____。',
      answer: [2 * half],
      hint: '一半模型：上下两个三角形面积之和恒等于长方形面积的一半，整体 = ' + half + ' × 2 = ' + (2 * half)
    });
  }

  // ============ 5. 圆与扇形 ============
  // 「角度—半径」按整除关系配对，保证 π=3.14 时结果恰为两位以内小数
  var SECTOR_ANGLES = [
    { a: 30, rs: [6, 12] },
    { a: 45, rs: [4, 8, 12] },
    { a: 60, rs: [3, 6, 9, 12] },
    { a: 90, rs: [2, 4, 6, 8, 10] },
    { a: 120, rs: [3, 6, 9, 12] },
    { a: 180, rs: [2, 3, 4, 5, 6, 8, 10] },
    { a: 270, rs: [2, 4, 6, 8, 10] }
  ];
  function decAns(cents) { return cents / 100; }
  function tolCheck(userAnswers, idx) {
    var raw = userAnswers ? (userAnswers[idx + ':0'] != null ? userAnswers[idx + ':0'] : userAnswers[idx]) : undefined;
    var u = parseFloat(raw);
    return isFinite(u) && Math.abs(u - this.answer[0]) < 0.005;
  }
  function genCircleSector(sc) {
    var pool = SECTOR_ANGLES.slice(-Math.min(SECTOR_ANGLES.length, Math.max(3, 2 + sc.rCount)));
    var item = pool[_PU.randInt(0, pool.length - 1)];
    var r = item.rs[_PU.randInt(0, Math.min(item.rs.length, Math.max(2, sc.rCount)) - 1)];
    var askArea = _PU.randInt(0, 1) === 0;
    if (askArea) {
      var cents = Math.round(314 * r * r * item.a / 360);
      return fillQ({
        type: 'circle',
        text: '一个扇形所在圆的半径为 ' + r + ' 厘米，圆心角为 ' + item.a + '°。这个扇形的面积是多少平方厘米？（π 取 3.14，结果保留两位小数）',
        answer: [decAns(cents)],
        hint: '扇形面积 = (n/360)×πr² = ' + item.a + '/360 × 3.14 × ' + r + '² ≈ ' + decAns(cents).toFixed(2),
        check: tolCheck
      });
    }
    var centsL = Math.round(314 * 2 * r * item.a / 360);
    return fillQ({
      type: 'circle',
      text: '一个扇形所在圆的半径为 ' + r + ' 厘米，圆心角为 ' + item.a + '°。这个扇形的弧长是多少厘米？（π 取 3.14，结果保留两位小数）',
      answer: [decAns(centsL)],
      hint: '弧长 = (n/360)×2πr = ' + item.a + '/360 × 2 × 3.14 × ' + r + ' ≈ ' + decAns(centsL).toFixed(2),
      check: tolCheck
    });
  }

  // ============ 6. 立体图形表面积与体积 ============
  function genSolid(sc) {
    var hi = sc.sideMax;
    var a = _PU.randInt(2, hi), b = _PU.randInt(2, hi), c = _PU.randInt(2, hi);
    var mode = _PU.randInt(0, 3);
    if (mode === 0) {
      return fillQ({
        type: 'solid',
        text: '一个长方体的长、宽、高分别为 ' + a + ' 厘米、' + b + ' 厘米、' + c + ' 厘米。它的体积是 ____ 立方厘米。',
        answer: [a * b * c],
        hint: 'V = 长×宽×高 = ' + a + ' × ' + b + ' × ' + c + ' = ' + (a * b * c)
      });
    }
    if (mode === 1) {
      return fillQ({
        type: 'solid',
        text: '一个长方体的长、宽、高分别为 ' + a + ' 厘米、' + b + ' 厘米、' + c + ' 厘米。它的表面积是 ____ 平方厘米。',
        answer: [2 * (a * b + a * c + b * c)],
        hint: 'S = (ab+ac+bc)×2 = (' + (a * b) + '+' + (a * c) + '+' + (b * c) + ')×2 = ' + (2 * (a * b + a * c + b * c))
      });
    }
    if (mode === 2) {
      var e = _PU.randInt(2, hi);
      return fillQ({
        type: 'solid',
        text: '一个正方体的棱长是 ' + e + ' 厘米。它的体积是 ____ 立方厘米。',
        answer: [e * e * e],
        hint: 'V = 棱³ = ' + e + '³ = ' + (e * e * e)
      });
    }
    var e2 = _PU.randInt(2, hi);
    return fillQ({
      type: 'solid',
      text: '一个正方体的棱长是 ' + e2 + ' 厘米。它的表面积是 ____ 平方厘米。',
      answer: [6 * e2 * e2],
      hint: 'S = 6棱² = 6 × ' + (e2 * e2) + ' = ' + (6 * e2 * e2)
    });
  }

  // ============ 7. 表面涂色问题 ============
  var PAINT_CATS = [
    { name: '三面涂色', f: function (n) { return 8; }, hint: '三面涂色的小正方体位于 8 个顶点，恒为 8 个' },
    { name: '两面涂色', f: function (n) { return 12 * (n - 2); }, hint: '两面涂色位于棱中间：12×(n−2)' },
    { name: '一面涂色', f: function (n) { return 6 * (n - 2) * (n - 2); }, hint: '一面涂色位于面中间：6×(n−2)²' },
    { name: '没有涂色', f: function (n) { return (n - 2) * (n - 2) * (n - 2); }, hint: '没有涂色位于内部：(n−2)³' }
  ];
  function genPaintedCube(sc) {
    var n = _PU.randInt(sc.nMin, sc.nMax);
    var cat = PAINT_CATS[_PU.randInt(0, 3)];
    return fillQ({
      type: 'painted-cube',
      text: '把一个棱长为 ' + n + ' 的大正方体表面涂色后，切成棱长为 1 的单位小正方体。其中' + cat.name + '的小正方体有 ____ 个。',
      answer: [cat.f(n)],
      hint: cat.hint + '，本题 n=' + n + '，共 ' + cat.f(n) + ' 个'
    });
  }

  // ============ 8. 勾股定理 ============
  var PYTH_EASY = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17]];
  var PYTH_MID = [[7, 24, 25], [9, 12, 15], [12, 16, 20], [20, 21, 29]];
  var PYTH_HARD = [[9, 40, 41], [10, 24, 26], [12, 35, 37], [15, 20, 25], [16, 30, 34]];
  function pythPool(sc) {
    if (sc.sideMax >= 12) return PYTH_EASY.concat(PYTH_MID).concat(PYTH_HARD);
    if (sc.sideMax >= 9) return PYTH_EASY.concat(PYTH_MID);
    return PYTH_EASY;
  }
  function genPythagorean(sc) {
    var pool = pythPool(sc);
    var t = pool[_PU.randInt(0, pool.length - 1)];
    if (_PU.randInt(0, 1) === 0) {
      return fillQ({
        type: 'pythagorean',
        text: '直角三角形的两条直角边分别为 ' + t[0] + ' 和 ' + t[1] + '，那么斜边的长度是 ____。',
        answer: [t[2]],
        hint: '勾股定理：c² = a² + b²，斜边 = √(' + t[0] + '²+' + t[1] + '²) = ' + t[2]
      });
    }
    var swap = _PU.randInt(0, 1) === 0;
    var leg = swap ? t[1] : t[0];
    var other = swap ? t[0] : t[1];
    return fillQ({
      type: 'pythagorean',
      text: '直角三角形的一条直角边为 ' + leg + '，斜边为 ' + t[2] + '，那么另一条直角边的长度是 ____。',
      answer: [other],
      hint: '勾股定理变形：b² = c² − a²，另一条直角边 = √(' + t[2] + '²−' + leg + '²) = ' + other
    });
  }

  // ============ 9. 格点面积（皮克定理） ============
  function genLattice(sc) {
    var N = _PU.randInt(1, sc.kmax + 5);
    var L = 2 * _PU.randInt(2, sc.kmax + 4); // 边界格点数取偶数
    var S = N + L / 2 - 1;
    return fillQ({
      type: 'lattice',
      text: '在方格纸（每个小方格边长为 1）上画有一个格点多边形，它的内部有 ' + N + ' 个格点，边界上有 ' + L + ' 个格点。这个多边形的面积是 ____。',
      answer: [S],
      hint: '皮克定理：S = N + L/2 − 1 = ' + N + ' + ' + (L / 2) + ' − 1 = ' + S
    });
  }

  // ============ 10. 角度计算 ============
  function genAngleCalc(sc) {
    var mode = _PU.randInt(0, 3);
    if (mode === 0) {
      var n = _PU.randInt(sc.nMin, sc.nMax + 2);
      return fillQ({
        type: 'angle',
        text: '一个 ' + n + ' 边形的内角和是多少度？',
        answer: [(n - 2) * 180],
        hint: '内角和 = (n−2)×180° = (' + n + '−2)×180° = ' + ((n - 2) * 180) + '°'
      });
    }
    if (mode === 1) {
      var reg = [[3, 60], [4, 90], [5, 108], [6, 120]][_PU.randInt(0, 3)];
      return fillQ({
        type: 'angle',
        text: '正 ' + reg[0] + ' 边形的每个内角是多少度？',
        answer: [reg[1]],
        hint: '每个内角 = (n−2)×180°÷n = ' + ((reg[0] - 2) * 180) + '° ÷ ' + reg[0] + ' = ' + reg[1] + '°'
      });
    }
    if (mode === 2) {
      var a1 = _PU.randInt(25, 80), b1 = _PU.randInt(25, 175 - a1);
      return fillQ({
        type: 'angle',
        text: '在三角形 ABC 中，∠A = ' + a1 + '°，∠B = ' + b1 + '°，那么∠C = ____°。',
        answer: [180 - a1 - b1],
        hint: '三角形内角和 180°：∠C = 180° − ' + a1 + '° − ' + b1 + '° = ' + (180 - a1 - b1) + '°'
      });
    }
    var d1 = _PU.randInt(40, 120), d2 = _PU.randInt(40, 150), d3 = _PU.randInt(30, Math.min(160, 320 - d1 - d2));
    return fillQ({
      type: 'angle',
      text: '在四边形 ABCD 中，∠A = ' + d1 + '°，∠B = ' + d2 + '°，∠C = ' + d3 + '°，那么∠D = ____°。',
      answer: [360 - d1 - d2 - d3],
      hint: '四边形内角和 360°：∠D = 360° − ' + d1 + '° − ' + d2 + '° − ' + d3 + '° = ' + (360 - d1 - d2 - d3) + '°'
    });
  }


  // ============ 基本面积公式 ============
  function genAreaBasic() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      var base = _PU.randInt(4, 20), h = _PU.randInt(3, 15);
      return fillQ({
        type: 'area-basic',
        text: '一个三角形的底是 ' + base + ' 厘米，高是 ' + h + ' 厘米。它的面积是多少平方厘米？',
        answer: [base * h / 2],
        hint: '三角形面积 = 底×高÷2 = ' + base + '×' + h + '÷2 = ' + (base * h / 2)
      });
    }
    var a = _PU.randInt(3, 15), b = a + _PU.randInt(1, 8), hh = _PU.randInt(3, 12);
    return fillQ({
      type: 'area-basic',
      text: '一个梯形的上底是 ' + a + ' 厘米，下底是 ' + b + ' 厘米，高是 ' + hh +
        ' 厘米。它的面积是多少平方厘米？',
      answer: [(a + b) * hh / 2],
      hint: '梯形面积 = (上底＋下底)×高÷2 = (' + a + '＋' + b + ')×' + hh + '÷2 = ' + ((a + b) * hh / 2)
    });
  }

  // ============ 等积变形 ============
  function genEqualArea() {
    var base = _PU.randInt(6, 18), h = _PU.randInt(4, 12);
    var area = base * h / 2;
    var newBase = base * 2;
    return fillQ({
      type: 'equal-area',
      text: '一个三角形的底是 ' + base + ' 厘米，高是 ' + h + ' 厘米，面积为 ' + (base * h / 2) +
        ' 平方厘米。如果把底扩大到原来的 2 倍（新底为 ' + newBase + ' 厘米），要保持面积不变，高应变为多少厘米？',
      answer: [h / 2],
      hint: '等积变形：底×2 → 高÷2 = ' + h + '/2 = ' + (h / 2) + ' 厘米'
    });
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['bird-head', 'butterfly', 'swallow-tail', 'half', 'circle', 'solid', 'painted-cube', 'pythagorean', 'lattice', 'angle']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'bird-head': genBirdHead, butterfly: genButterfly, 'swallow-tail': genSwallowTail,
      half: genHalf, circle: genCircleSector, solid: genSolid, 'painted-cube': genPaintedCube,
      pythagorean: genPythagorean, lattice: genLattice, angle: genAngleCalc,
      'area-basic': genAreaBasic, 'equal-area': genEqualArea
    };
    var questions = [], seen = {}, MAXTRY = count * 80;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key](sc, opts);
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c4',
    name: '几何模型（五年级）',
    subject: 'math',
    category: 'geometry',
    grades: [5, 6],
    moduleId: 'C4',
    knowledgePoints: {
      6: ['g6-c4-area-basic','g6-c4-equal-area-transform','g6-c4-bird-head-model','g6-c4-butterfly-model',
        'g6-c4-swallow-tail-model','g6-c4-half-model','g6-c4-circle-sector','g6-c4-solid-geometry',
        'g6-c4-painted-cube','g6-c4-pythagorean-theorem'],
      5: ['g5-c4-bird-head-model', 'g5-c4-butterfly-model', 'g5-c4-swallow-tail-model', 'g5-c4-half-model',
        'g5-c4-circle-sector', 'g5-c4-solid-geometry', 'g5-c4-painted-cube', 'g5-c4-pythagorean-theorem',
        'g5-c4-lattice-area', 'g5-c4-angle-calculation']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',           label: '综合' },
        { value: 'bird-head',     label: '鸟头模型' },
        { value: 'butterfly',     label: '蝴蝶模型' },
        { value: 'swallow-tail',  label: '燕尾模型' },
        { value: 'half',          label: '一半模型' },
        { value: 'circle',        label: '圆与扇形' },
        { value: 'solid',         label: '立体图形' },
        { value: 'painted-cube',  label: '表面涂色' },
        { value: 'pythagorean',   label: '勾股定理' },
        { value: 'lattice',       label: '格点面积' },
        { value: 'angle',         label: '角度计算' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 2, title: '几何模型（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
