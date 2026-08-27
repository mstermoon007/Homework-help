// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c4.js — 六年级竞赛 C4 几何深化（新语义题型）
// 实现题型（type 与知识库一致）：
//   circle          圆与扇形组合（内接正方形/最大圆/弓形/叶形/圆环/半圆周长，π 取 3.14）
//   solid           立体几何切割（切面增面 / 多刀 / 八分正方体 / 顶点挖孔不变性）
//   circle-angle    圆角度（圆周角定理：同弧圆周角=圆心角一半；同弧圆周角相等）
//   solid-rotation  旋转体（长方形→圆柱、直角三角形→圆锥的体积/表面积，π 取 3.14）
// 设计要点：角度均为整数；组合图形用特殊参数配对保证 π=3.14 下结果恰为两位以内
// 小数，统一容差判定；切割题答案均为确定整数。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c4.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
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
    if (lv >= 8) return { rMax: 12, hMax: 15, edgeMax: 12 };
    if (lv >= 5) return { rMax: 9, hMax: 12, edgeMax: 9 };
    return { rMax: 6, hMax: 8, edgeMax: 6 };
  }

  // ============ 1. 圆角度 ============
  function genCircleAngle() {
    var mode = _PU.randInt(0, 2);
    var head = '如图（文字描述）：O 为圆心，点 A、B 在圆上，∠AOB 是圆心角。';
    if (mode === 0) {
      var a = 2 * _PU.randInt(20, 85); // 偶数保证圆周角为整数
      return fillQ({
        type: 'circle-angle',
        text: head + '点 C 是圆上另一点（与 A、B 不重合）。若 ∠AOB = ' + a + '°，那么圆周角 ∠ACB = ____°。',
        answer: [a / 2],
        hint: '圆周角定理：同弧上的圆周角 = 圆心角的一半 = ' + a + '° ÷ 2 = ' + (a / 2) + '°'
      });
    }
    if (mode === 1) {
      var b = _PU.randInt(20, 80);
      return fillQ({
        type: 'circle-angle',
        text: '如图（文字描述）：O 为圆心，A、B、C 三点都在圆上。已知圆周角 ∠ACB = ' + b + '°（C 与 A、B 不重合），那么它所对弧的圆心角 ∠AOB = ____°。',
        answer: [2 * b],
        hint: '圆心角 = 同弧圆周角的 2 倍 = ' + b + '° × 2 = ' + (2 * b) + '°'
      });
    }
    var c = _PU.randInt(15, 70);
    return fillQ({
      type: 'circle-angle',
      text: 'O 为圆心，A、B、C、D 四点都在圆上。已知圆周角 ∠ADB = ' + c + '°，那么另一个同弧上的圆周角 ∠ACB = ____°。',
      answer: [c],
      hint: '同弧所对的圆周角相等：∠ACB = ∠ADB = ' + c + '°'
    });
  }

  // ============ 2. 旋转体 ============
  function decAns(cents) { return cents / 100; }
  function tolCheck(userAnswers, idx) {
    var raw = userAnswers ? (userAnswers[idx + ':0'] != null ? userAnswers[idx + ':0'] : userAnswers[idx]) : undefined;
    var u = parseFloat(raw);
    return isFinite(u) && Math.abs(u - this.answer[0]) < 0.005;
  }
  function genSolidRotation(sc) {
    var mode = _PU.randInt(0, 2);
    var pi = 3.14;
    if (mode === 0) {
      // 长方形绕一边旋转 → 圆柱体积 V = πr²h
      var r = _PU.randInt(2, sc.rMax), h = _PU.randInt(2, sc.hMax);
      var cents = Math.round(pi * r * r * h * 100);
      return fillQ({
        type: 'solid-rotation',
        text: '把一个长 ' + h + ' 厘米、宽 ' + r + ' 厘米的长方形绕它的长边旋转一周，得到一个圆柱。这个圆柱的体积是多少立方厘米？（π 取 3.14）',
        answer: [decAns(cents)],
        hint: '旋转半径 = 宽 ' + r + ' cm，高 = 长 ' + h + ' cm；V = πr²h = 3.14 × ' + r + '² × ' + h + ' = ' + decAns(cents).toFixed(2),
        check: tolCheck
      });
    }
    if (mode === 1) {
      // 直角三角形绕直角边 → 圆锥体积 V = πr²h / 3（保证 r²h 被 3 整除）
      var rc, hc;
      do {
        rc = _PU.randInt(2, sc.rMax);
        hc = _PU.randInt(2, sc.hMax);
      } while ((rc * rc * hc) % 3 !== 0);
      var centsK = Math.round(pi * rc * rc * hc / 3 * 100);
      return fillQ({
        type: 'solid-rotation',
        text: '把两条直角边分别为 ' + hc + ' 厘米和 ' + rc + ' 厘米的直角三角形绕长为 ' + hc +
          ' 厘米的直角边旋转一周，得到一个圆锥。这个圆锥的体积是多少立方厘米？（π 取 3.14）',
        answer: [decAns(centsK)],
        hint: 'V = (1/3)πr²h = 3.14 × ' + rc + '² × ' + hc + ' ÷ 3 ≈ ' + decAns(centsK).toFixed(2),
        check: tolCheck
      });
    }
    // 圆柱表面积 S = 2πr(h+r)
    var rr = _PU.randInt(2, Math.min(sc.rMax, 8)), hh = _PU.randInt(2, sc.hMax);
    var centsS = Math.round(2 * pi * rr * (hh + rr) * 100);
    return fillQ({
      type: 'solid-rotation',
      text: '把一个长 ' + hh + ' 厘米、宽 ' + rr + ' 厘米的长方形绕它的长边旋转一周得到圆柱。这个圆柱的表面积是多少平方厘米？（π 取 3.14）',
      answer: [decAns(centsS)],
      hint: 'S = 2πr(h＋r) = 2 × 3.14 × ' + rr + ' × (' + hh + '＋' + rr + ') ≈ ' + decAns(centsS).toFixed(2),
      check: tolCheck
    });
  }

  // ============ 3. 圆与扇形组合（阴影面积，π=3.14） ============
  function decAns(cents) { return cents / 100; }
  function tolCheck(userAnswers, idx) {
    var raw = userAnswers ? (userAnswers[idx + ':0'] != null ? userAnswers[idx + ':0'] : userAnswers[idx]) : undefined;
    var u = parseFloat(raw);
    return isFinite(u) && Math.abs(u - this.answer[0]) < 0.005;
  }
  function genCircleCombo(sc) {
    var tpl = _PU.randInt(0, 5);
    var pi = 3.14;
    var r, a, cents;
    if (tpl === 0) {
      // 圆内最大正方形：圆减正方形 = r²(π−2)
      r = _PU.randInt(2, sc.rMax);
      var v0 = Math.round((pi - 2) * r * r * 100) / 100;
      return fillQ({
        type: 'circle',
        text: '在半径为 ' + r + ' 厘米的圆内画一个最大的正方形（正方形的对角线等于圆的直径）。圆的面积比正方形的面积大多少平方厘米？（π 取 3.14）',
        answer: [v0],
        hint: '正方形面积 = 对角线²÷2 = (2r)²÷2 = 2r² = ' + (2 * r * r) +
          '；圆面积 = ' + pi + '×' + r + '² = ' + (pi * r * r).toFixed(2) + '；差 ≈ ' + v0.toFixed(2),
        check: tolCheck
      });
    }
    if (tpl === 1) {
      // 正方形内最大圆：正方形减圆 = a²(1−π/4)
      do { a = _PU.randInt(2, sc.edgeMax); } while (a % 2 !== 0);
      var v1 = Math.round((a * a - pi * (a / 2) * (a / 2)) * 100) / 100;
      return fillQ({
        type: 'circle',
        text: '在边长为 ' + a + ' 厘米的正方形内画一个最大的圆。正方形的面积比圆的面积大多少平方厘米？（π 取 3.14）',
        answer: [v1],
        hint: '圆半径 = a/2 = ' + (a / 2) + '；差 = ' + (a * a) + ' − ' + pi + '×' + (a / 2) + '² ≈ ' + v1.toFixed(2),
        check: tolCheck
      });
    }
    if (tpl === 2) {
      // 90° 扇形减等腰直角三角形 = 弓形
      r = _PU.randInt(2, sc.rMax);
      var v2 = Math.round((pi * r * r / 4 - r * r / 2) * 100) / 100;
      return fillQ({
        type: 'circle',
        text: '一个半径为 ' + r + ' 厘米、圆心角为 90° 的扇形，两条半径与弧围成扇形；连接两条半径的外端点得到一个等腰直角三角形。弓形（扇形减去这个三角形）的面积是多少平方厘米？（π 取 3.14）',
        answer: [v2],
        hint: '扇形 = ' + pi + '×' + r + '²÷4 ≈ ' + (pi * r * r / 4).toFixed(2) + '，三角形 = ' + r + '×' + r + '÷2 = ' + (r * r / 2) + '，差 ≈ ' + v2.toFixed(2),
        check: tolCheck
      });
    }
    if (tpl === 3) {
      // 叶形：两个四分之一圆叠加 − 正方形
      r = _PU.randInt(2, sc.rMax);
      var v3 = Math.round((pi * r * r / 2 - r * r) * 100) / 100;
      return fillQ({
        type: 'circle',
        text: '边长为 ' + r + ' 厘米的正方形中，分别以两个相对的顶点为圆心、边长为半径在正方形内画两条弧，两弧围成一个叶形。叶形的面积是多少平方厘米？（π 取 3.14）',
        answer: [v3],
        hint: '叶形 = 两个四分之一圆 − 正方形 = 2×' + pi + '×' + r + '²÷4 − ' + (r * r) + ' ≈ ' + v3.toFixed(2),
        check: tolCheck
      });
    }
    if (tpl === 4) {
      // 圆环
      var R = _PU.randInt(4, sc.rMax + 4), rr = _PU.randInt(1, R - 2);
      var v4 = Math.round(pi * (R * R - rr * rr) * 100) / 100;
      return fillQ({
        type: 'circle',
        text: '两个同心圆的半径分别为 ' + R + ' 厘米和 ' + rr + ' 厘米。圆环的面积是多少平方厘米？（π 取 3.14）',
        answer: [v4],
        hint: '圆环 = π(R²−r²) = ' + pi + ' × (' + (R * R) + '−' + (rr * rr) + ') ≈ ' + v4.toFixed(2),
        check: tolCheck
      });
    }
    // 半圆周长（含直径）
    var d = _PU.randInt(2, sc.edgeMax);
    var v5 = Math.round((pi * d / 2 + d) * 100) / 100;
    return fillQ({
      type: 'circle',
      text: '一个半圆的直径是 ' + d + ' 厘米。这个半圆的周长（弧长加直径）是多少厘米？（π 取 3.14）',
      answer: [v5],
      hint: '半圆周长 = πd/2 ＋ d = ' + pi + '×' + d + '/2 ＋ ' + d + ' ≈ ' + v5.toFixed(2),
      check: tolCheck
    });
  }

  // ============ 4. 立体几何切割 ============
  function genSolidCut(sc) {
    var mode = _PU.randInt(0, 3);
    var a = _PU.randInt(3, sc.edgeMax), b = _PU.randInt(2, sc.edgeMax), c = _PU.randInt(2, sc.edgeMax);
    if (mode === 0) {
      // 沿垂直于长的方向切一刀 → 新增 2 个截面（宽×高）
      var faceArea = b * c;
      return fillQ({
        type: 'solid',
        text: '一个长 ' + a + ' 厘米、宽 ' + b + ' 厘米、高 ' + c +
          ' 厘米的长方体木块，沿垂直于长的方向切一刀，正好切成两个小长方体。表面积比原来增加了 ____ 平方厘米。',
        answer: [2 * faceArea],
        hint: '切一刀新增 2 个截面，每个截面为宽×高 = ' + b + '×' + c + ' = ' + faceArea + ' 平方厘米，共增加 ' + (2 * faceArea)
      });
    }
    if (mode === 1) {
      // 切 n 刀（同方向平行切）→ 新增 2n 个截面
      var cuts = _PU.randInt(2, 4);
      var fA = b * c;
      return fillQ({
        type: 'solid',
        text: '一根横截面长 ' + b + ' 厘米、宽 ' + c + ' 厘米的长方体木料，被垂直于长的方向平行地切了 ' + cuts +
          ' 刀（刀刀平行），全部切成小段后，表面积一共比原来增加了 ____ 平方厘米。',
        answer: [2 * cuts * fA],
        hint: '每切一刀增加 2 个截面（每个 ' + fA + ' 平方厘米），' + cuts + ' 刀共增加 2×' + cuts + '×' + fA + ' = ' + (2 * cuts * fA)
      });
    }
    if (mode === 2) {
      // 正方体切成 8 个小正方体：总表面积 = 原 2 倍
      do { a = _PU.randInt(2, sc.edgeMax); } while (a % 2 !== 0);
      var totalSA = 8 * 6 * (a / 2) * (a / 2);
      return fillQ({
        type: 'solid',
        text: '把一个棱长为 ' + a + ' 厘米的正方体切成 8 个相同的小正方体。这 8 个小正方体的表面积之和是 ____ 平方厘米。',
        answer: [totalSA],
        hint: '小正方体棱长 = ' + (a / 2) + '，单个表面积 6×' + (a / 2) + '² = ' + (6 * (a / 2) * (a / 2)) +
          '，8 个共 ' + totalSA + '（恰为原来的 2 倍）'
      });
    }
    // 顶点处挖去小正方体：表面积不变
    do { a = _PU.randInt(4, sc.edgeMax); } while (a < 5);
    var k = _PU.randInt(1, Math.floor(a / 2) - 1 || 1);
    return fillQ({
      type: 'solid',
      text: '一个棱长为 ' + a + ' 厘米的正方体，在其一个顶点处挖去一个棱长为 ' + k +
        ' 厘米的小正方体。剩下立体图形的表面积是 ____ 平方厘米。',
      answer: [6 * a * a],
      hint: '顶点挖孔：减少 3 个面又新露出 3 个同样大小的面 → 表面积不变，仍为 6×' + a + '² = ' + (6 * a * a)
    });
  }

  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['circle', 'solid', 'circle-angle', 'solid-rotation']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      circle: function () { return genCircleCombo(sc); },
      solid: function () { return genSolidCut(sc); },
      'circle-angle': genCircleAngle,
      'solid-rotation': function () { return genSolidRotation(sc); }
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
    id: 'math-competition-g6-c4',
    name: '几何模型（六年级）',
    subject: 'math',
    category: 'geometry',
    grades: [6],
    moduleId: 'C4',
    knowledgePoints: {
      6: ['math-g6-c4-circle-sector', 'math-g6-c4-solid-geometry', 'math-g6-c4-circle-angle', 'math-g6-c4-solid-rotation']
    },
    columns: 2,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',            label: '综合' },
        { value: 'circle',         label: '圆与扇形组合' },
        { value: 'solid',          label: '立体切割' },
        { value: 'circle-angle',   label: '圆角度' },
        { value: 'solid-rotation', label: '旋转体' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 2, title: '几何模型（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
