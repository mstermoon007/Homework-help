/**
 * plugins/math-geometry.js — 图形与几何插件（二年级：角的认识/图形的运动/方格纸）
 *
 * 题型：
 *   angleCount —— 数角：数一数图形中共有几个角
 *   angleClass —— 角的分类：锐角 / 直角 / 钝角 判断（choice）
 *   motion      —— 图形的运动：平移 / 旋转 判断（choice）
 *   grid        —— 方格纸：数一数图形向右平移了几格（text）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；图形全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-geometry.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-geometry.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  var _GRADE = 2;

  // 带尺寸标注的长方形/正方形（三年级周长/面积用）
  // w/h 为真实厘米数；同比例缩放显示；labelW/labelH 显示的平均分位置
  function rectSVG(w, h, unit) {
    var maxDim = Math.max(w, h);
    var scale = 200 / maxDim;            // 最长边 200px
    var W = Math.max(30, w * scale), H = Math.max(30, h * scale);
    var padding = 24;
    var svgW = W + padding * 2, svgH = H + padding * 2 + 6;
    var html = '<svg width="' + Math.round(svgW) + '" height="' + Math.round(svgH) + '" viewBox="0 0 ' + Math.round(svgW) + ' ' + Math.round(svgH) + '">';
    var x0 = padding, y0 = padding;
    html += '<rect x="' + x0 + '" y="' + y0 + '" width="' + W.toFixed(1) + '" height="' + H.toFixed(1) + '" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>';
    // 长标注（底部）
    var lx = x0 + W / 2;
    html += '<text x="' + lx + '" y="' + (y0 + H + 18) + '" font-size="15" font-weight="800" fill="#3b5bdb" text-anchor="middle">' + w + ' ' + unit + '</text>';
    // 宽标注（左侧，旋转）
    html += '<text x="' + (x0 - 12) + '" y="' + (y0 + H / 2) + '" font-size="15" font-weight="800" fill="#e8870a" text-anchor="middle" transform="rotate(-90 ' + (x0 - 12) + ' ' + (y0 + H / 2) + ')">' + h + ' ' + unit + '</text>';
    return html + '</svg>';
  }

  // ============ 角的 SVG ============
  // 画一个角：vertex 为顶点，aDeg/bDeg 为两条射线的角度（度），len 为边长
  function angleSVG(aDeg, bDeg, len, vertexLabel) {
    var cx = 55, cy = 60;
    function pt(deg, L) {
      var rad = (deg * Math.PI) / 180;
      return { x: cx + L * Math.cos(rad), y: cy - L * Math.sin(rad) };
    }
    var p1 = pt(aDeg, len), p2 = pt(bDeg, len);
    return '<svg width="130" height="110" viewBox="0 0 130 110">' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + p1.x + '" y2="' + p1.y + '" stroke="#2b3a55" stroke-width="3"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + p2.x + '" y2="' + p2.y + '" stroke="#2b3a55" stroke-width="3"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#e8870a"/>' +
      (vertexLabel ? '<text x="' + (cx - 12) + '" y="' + (cy + 22) + '" font-size="14" font-weight="700" fill="#5b8def">' + vertexLabel + '</text>' : '') +
      '</svg>';
  }
  // 直角：两条线垂直（带直角标记）
  function rightAngleSVG(len) {
    var cx = 55, cy = 60;
    return '<svg width="130" height="110" viewBox="0 0 130 110">' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + (cx + len) + '" y2="' + cy + '" stroke="#2b3a55" stroke-width="3"/>' +
      '<line x1="' + cx + '" y1="' + cy + '" x2="' + cx + '" y2="' + (cy - len) + '" stroke="#2b3a55" stroke-width="3"/>' +
      '<path d="M' + (cx + 15) + ',' + cy + ' L' + (cx + 15) + ',' + (cy - 15) + ' L' + cx + ',' + (cy - 15) + '" fill="none" stroke="#e8870a" stroke-width="2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#e8870a"/>' +
      '</svg>';
  }

  // 简单多边形：按顶点比例画 n 边形（用于数角）
  function polygonSVG(n) {
    var cx = 50, cy = 55, R = 40;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var ang = (-90 + i * (360 / n)) * Math.PI / 180;
      pts.push((cx + R * Math.cos(ang)).toFixed(1) + ',' + (cy + R * Math.sin(ang)).toFixed(1));
    }
    return '<svg width="105" height="110" viewBox="0 0 105 110">' +
      '<polygon points="' + pts.join(' ') + '" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>' +
      '</svg>';
  }
  // 复杂图形（中间有分割线，用于数角）：如五角星 / 十字等
  function complexSVG(kind) {
    if (kind === 'star') {
      return '<svg width="110" height="105" viewBox="0 0 110 105">' +
        '<polygon points="55,8 64,40 97,41 71,61 80,94 55,74 30,94 39,61 13,41 46,40" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>' +
        '</svg>';
    }
    // 十字：两个长方形相交（8 个直角）
    return '<svg width="110" height="110" viewBox="0 0 110 110">' +
      '<rect x="35" y="10" width="40" height="90" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>' +
      '<rect x="10" y="35" width="90" height="40" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>' +
      '</svg>';
  }
  // 三角形 → 三个角
  function triangleSVG() {
    return '<svg width="105" height="90" viewBox="0 0 105 90">' +
      '<polygon points="52,6 6,84 98,84" fill="#eef3fb" stroke="#2b3a55" stroke-width="2.5"/>' +
      '</svg>';
  }

  // 图形的运动：给定图形，显示原图与运动后的图（choice 平移/旋转）
  // 用箭头图形作平移示例：向右移动、旋转后朝向变化
  function motionSVG(kind) {
    // 箭头图形（默认朝右）
    function arrow(cx, cy, fill) {
      return '<path d="M' + cx + ',' + (cy - 14) + ' L' + cx + ',' + (cy + 14) + ' L' + (cx + 34) + ',' + (cy + 14) + ' L' + (cx + 34) + ',' + (cy + 24) + ' L' + (cx + 54) + ',' + cy + ' L' + (cx + 34) + ',' + (cy - 24) + ' L' + (cx + 34) + ',' + (cy - 14) + ' Z" fill="' + fill + '" stroke="#2b3a55" stroke-width="2"/>';
    }
    if (kind === 'translate') {
      // 平移：箭头整体右移，方向不变
      return '<svg width="160" height="70" viewBox="0 0 160 70">' +
        arrow(6, 35, '#5b8def') + arrow(70, 35, '#e8870a') +
        '<text x="62" y="18" font-size="12" font-weight="700" fill="#27ae60">→</text>' +
        '</svg>';
    }
    // 旋转：箭头绕中心旋转（朝右 → 朝下）
    return '<svg width="160" height="90" viewBox="0 0 160 90">' +
      '<g transform="rotate(0 40 45)">' + arrow(12, 45, '#5b8def') + '</g>' +
      '<g transform="rotate(90 115 45)">' + arrow(88, 45, '#e8870a') + '</g>' +
      '<text x="62" y="30" font-size="14" font-weight="700" fill="#27ae60">↻</text>' +
      '</svg>';
  }

  // 方格纸：在 5x3 网格中画一个方块图形，并显示平移后的位置（text 填格数）
  function gridSVG(gap) {
    var cell = 22, cols = 5, rows = 3;
    var w = cols * cell, h = rows * cell;
    var html = '<svg width="' + (w + 12) + '" height="' + (h + 12) + '" viewBox="0 0 ' + (w + 12) + ' ' + (h + 12) + '">';
    // 网格线
    for (var x = 0; x <= cols; x++) {
      html += '<line x1="' + (6 + x * cell) + '" y1="6" x2="' + (6 + x * cell) + '" y2="' + (6 + h) + '" stroke="#c9d4e6" stroke-width="1"/>';
    }
    for (var y = 0; y <= rows; y++) {
      html += '<line x1="6" y1="' + (6 + y * cell) + '" x2="' + (6 + w) + '" y2="' + (6 + y * cell) + '" stroke="#c9d4e6" stroke-width="1"/>';
    }
    // 原图形（在第 1 列），平移后的图形（第 gap+1 列）
    html += '<rect x="' + (8 + 0 * cell) + '" y="8" width="' + (cell - 4) + '" height="' + (cell - 4) + '" fill="#5b8def" stroke="#3b5bdb" stroke-width="2"/>';
    html += '<rect x="' + (8 + gap * cell) + '" y="8" width="' + (cell - 4) + '" height="' + (cell - 4) + '" fill="#e8870a" stroke="#2b3a55" stroke-width="2"/>';
    html += '</svg>';
    return html;
  }

  // ============ 题目生成 ============
  // 数角：简单图形（三角形 3、四边形 4、五边形 5、六边形 6）
  function buildAngleCount() {
    var variant = rnd(1, 2);
    if (variant === 1) {
      var shapes = [
        { n: 3, svg: triangleSVG() },
        { n: 4, svg: polygonSVG(4) },
        { n: 5, svg: polygonSVG(5) },
        { n: 6, svg: polygonSVG(6) }
      ];
      var s = pick(shapes);
      return {
        kind: 'angleCount',
        svg: s.svg,
        question: '数一数，这个图形中有几个角？',
        answer: String(s.n),
        options: shuffleArr([String(s.n), String(Math.max(1, s.n - 1)), String(s.n + 1)]),
        inputType: 'choice'
      };
    }
    // 复杂图形：五角星（5 个尖角）或十字（8 个直角）
    var complex = rnd(1, 2) === 1 ? { kind: 'star', n: 5 } : { kind: 'cross', n: 8 };
    return {
      kind: 'angleCount',
      svg: complexSVG(complex.kind === 'star' ? 'star' : 'cross'),
      question: '数一数，这个图形中有几个角？',
      answer: String(complex.n),
      options: shuffleArr([String(complex.n), String(complex.n + 2), String(complex.n + 4)]),
      inputType: 'choice'
    };
  }

  // 角的分类：锐角 / 直角 / 钝角（choice）
  function buildAngleClass() {
    var items = [
      { name: '锐角', svg: angleSVG(200, 260, 46) },
      { name: '直角', svg: rightAngleSVG(42) },
      { name: '钝角', svg: angleSVG(150, 250, 46) }
    ];
    var it = pick(items);
    return {
      kind: 'angleClass',
      svg: it.svg,
      question: '下面的角是什么角？',
      answer: it.name,
      options: shuffleArr(['锐角', '直角', '钝角']),
      inputType: 'choice'
    };
  }

  // 图形的运动：平移 / 旋转（choice）
  function buildMotion() {
    var kind = rnd(1, 2) === 1 ? 'translate' : 'rotate';
    return {
      kind: 'motion',
      svg: motionSVG(kind),
      question: '观察下面两个图形，从左边的图形得到右边的图形，是什么运动？',
      answer: kind === 'translate' ? '平移' : '旋转',
      options: shuffleArr(['平移', '旋转']),
      inputType: 'choice'
    };
  }

  // 方格纸：数一数图形向右平移了几格（text）
  function buildGrid() {
    var gap = rnd(1, 4);
    return {
      kind: 'grid',
      svg: gridSVG(gap),
      question: '在方格纸上，蓝色图形向右平移，变成了橙色图形。它向右平移了几格？',
      answer: String(gap),
      hint: '从一个图形中的同一个顶点出发，数一数向右移动了几个格子。',
      inputType: 'text'
    };
  }

  // 三年级：长方形/正方形周长
  function buildPerimeter() {
    var variant = rnd(1, 5);
    if (variant === 1) {
      // 正方形：边长已知
      var side = rnd(3, 12);
      return {
        kind: 'perimeter',
        svg: rectSVG(side, side, '厘米'),
        shape: '正方形', w: side, h: side,
        question: '下面正方形的边长是 ' + side + ' 厘米，它的周长是多少厘米？',
        answer: String(side * 4),
        hint: '正方形周长 = 边长 × 4',
        inputType: 'text'
      };
    }
    if (variant === 2) {
      // 长方形：长、宽已知（整厘米）
      var w = rnd(4, 18), h = rnd(2, Math.max(2, Math.min(9, w - 1)));
      if (h >= w) h = w - 1;
      return {
        kind: 'perimeter',
        svg: rectSVG(w, h, '厘米'),
        shape: '长方形', w: w, h: h,
        question: '下面长方形的长是 ' + w + ' 厘米，宽是 ' + h + ' 厘米，它的周长是多少厘米？',
        answer: String(2 * (w + h)),
        hint: '长方形周长 =（长 + 宽）× 2',
        inputType: 'text'
      };
    }
    if (variant === 3) {
      // 反向：已知周长求边长（正方形）
      var side = rnd(3, 12);
      var perim = side * 4;
      return {
        kind: 'perimeter',
        variant: 'findSide',
        svg: rectSVG(side, side, '厘米'),
        shape: '正方形', w: side, h: side,
        question: '一个正方形的周长是 ' + perim + ' 厘米，它的边长是多少厘米？',
        answer: String(side),
        hint: '正方形边长 = 周长 ÷ 4',
        inputType: 'text'
      };
    }
    if (variant === 4) {
      // 反向：已知周长和长，求宽（长方形）
      var w = rnd(5, 15), h = rnd(3, Math.max(3, w - 1));
      if (h >= w) h = w - 1;
      var perim = 2 * (w + h);
      return {
        kind: 'perimeter',
        variant: 'findWidth',
        svg: rectSVG(w, h, '厘米'),
        shape: '长方形', w: w, h: h,
        question: '一个长方形的周长是 ' + perim + ' 厘米，长是 ' + w + ' 厘米，宽是多少厘米？',
        answer: String(h),
        hint: '长方形宽 = 周长 ÷ 2 − 长',
        inputType: 'text'
      };
    }
    // 反向：已知周长和宽，求长（长方形）
    var w2 = rnd(5, 15), h2 = rnd(3, Math.max(3, w2 - 1));
    if (h2 >= w2) h2 = w2 - 1;
    var perim2 = 2 * (w2 + h2);
    return {
      kind: 'perimeter',
      variant: 'findLength',
      svg: rectSVG(w2, h2, '厘米'),
      shape: '长方形', w: w2, h: h2,
      question: '一个长方形的周长是 ' + perim2 + ' 厘米，宽是 ' + h2 + ' 厘米，长是多少厘米？',
      answer: String(w2),
      hint: '长方形长 = 周长 ÷ 2 − 宽',
      inputType: 'text'
    };
  }

  // 三年级：长方形/正方形面积
  function buildArea() {
    var variant = rnd(1, 5);
    if (variant === 1) {
      // 正方形面积
      var side = rnd(3, 12);
      return {
        kind: 'area',
        svg: rectSVG(side, side, '厘米'),
        shape: '正方形', w: side, h: side,
        question: '下面正方形的边长是 ' + side + ' 厘米，它的面积是多少平方厘米？',
        answer: String(side * side),
        hint: '正方形面积 = 边长 × 边长',
        inputType: 'text'
      };
    }
    if (variant === 2) {
      // 长方形面积
      var w = rnd(4, 18), h = rnd(2, Math.max(2, Math.min(9, w - 1)));
      if (h >= w) h = w - 1;
      return {
        kind: 'area',
        svg: rectSVG(w, h, '厘米'),
        shape: '长方形', w: w, h: h,
        question: '下面长方形的长是 ' + w + ' 厘米，宽是 ' + h + ' 厘米，它的面积是多少平方厘米？',
        answer: String(w * h),
        hint: '长方形面积 = 长 × 宽',
        inputType: 'text'
      };
    }
    if (variant === 3) {
      // 反向：已知面积求边长（正方形）
      var side = rnd(3, 12);
      var area = side * side;
      return {
        kind: 'area',
        variant: 'findSide',
        svg: rectSVG(side, side, '厘米'),
        shape: '正方形', w: side, h: side,
        question: '一个正方形的面积是 ' + area + ' 平方厘米，它的边长是多少厘米？',
        answer: String(side),
        hint: '正方形边长 × 边长 = 面积，想一想几乘几等于 ' + area,
        inputType: 'text'
      };
    }
    if (variant === 4) {
      // 反向：已知面积和长，求宽（长方形）
      var w = rnd(4, 12), h = rnd(3, Math.max(3, Math.min(10, w - 1)));
      if (h >= w) h = w - 1;
      var area = w * h;
      return {
        kind: 'area',
        variant: 'findWidth',
        svg: rectSVG(w, h, '厘米'),
        shape: '长方形', w: w, h: h,
        question: '一个长方形的面积是 ' + area + ' 平方厘米，长是 ' + w + ' 厘米，宽是多少厘米？',
        answer: String(h),
        hint: '长方形宽 = 面积 ÷ 长',
        inputType: 'text'
      };
    }
    // 反向：已知面积和宽，求长（长方形）
    var w2 = rnd(4, 12), h2 = rnd(3, Math.max(3, Math.min(10, w2 - 1)));
    if (h2 >= w2) h2 = w2 - 1;
    var area2 = w2 * h2;
    return {
      kind: 'area',
      variant: 'findLength',
      svg: rectSVG(w2, h2, '厘米'),
      shape: '长方形', w: w2, h: h2,
      question: '一个长方形的面积是 ' + area2 + ' 平方厘米，宽是 ' + h2 + ' 厘米，长是多少厘米？',
      answer: String(w2),
      hint: '长方形长 = 面积 ÷ 宽',
      inputType: 'text'
    };
  }

  // 三年级：方格纸画指定周长/面积的图形
  function buildDrawPerimeter() {
    // 生成几个可能的长宽组合，周长固定
    var perim = rnd(12, 24) * 2; // 偶数周长
    var pairs = [];
    for (var w = 1; w <= perim / 2 - 1; w++) {
      var h = perim / 2 - w;
      if (h >= 1 && h <= w) pairs.push({ w: w, h: h });
    }
    var correct = pick(pairs);
    var distractors = shuffleArr(pairs.filter(function (p) { return p.w !== correct.w || p.h !== correct.h; })).slice(0, 2);
    var options = shuffleArr([correct].concat(distractors));
    return {
      kind: 'drawPerimeter',
      perim: perim,
      correct: correct,
      options: options,
      question: '在方格纸上，画一个周长是 ' + perim + ' 厘米的长方形（或正方形）。下面哪个是正确的长和宽？',
      answer: correct.w + '×' + correct.h,
      hint: '周长 = (长 + 宽) × 2，所以 长 + 宽 = ' + (perim / 2) + '。',
      inputType: 'choice'
    };
  }

  function buildDrawArea() {
    // 生成几个可能的长宽组合，面积固定
    var areas = [12, 16, 18, 20, 24, 30, 36];
    var area = pick(areas);
    var pairs = [];
    for (var w = 1; w <= area; w++) {
      if (area % w === 0) {
        var h = area / w;
        if (h <= w) pairs.push({ w: w, h: h });
      }
    }
    var correct = pick(pairs);
    var distractors = shuffleArr(pairs.filter(function (p) { return p.w !== correct.w || p.h !== correct.h; })).slice(0, 2);
    var options = shuffleArr([correct].concat(distractors));
    return {
      kind: 'drawArea',
      area: area,
      correct: correct,
      options: options,
      question: '在方格纸上，画一个面积是 ' + area + ' 平方厘米的长方形（或正方形）。下面哪个是正确的长和宽？',
      answer: correct.w + '×' + correct.h,
      hint: '面积 = 长 × 宽，想一想哪两个数相乘等于 ' + area + '。',
      inputType: 'choice'
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (_GRADE >= 3) {
      // 三年级：周长/面积/画图/反向求边长为主，穿插角的复习
      if (r <= 20) return buildPerimeter();
      if (r <= 40) return buildArea();
      if (r <= 55) return buildDrawPerimeter();
      if (r <= 70) return buildDrawArea();
      if (r <= 82) return buildAngleCount();
      return buildAngleClass();
    }
    if (r <= 35) return buildAngleCount();
    if (r <= 60) return buildAngleClass();
    if (r <= 80) return buildMotion();
    return buildGrid();
  }

  function generateProblems(type, count) {
    var builder = { angleCount: buildAngleCount, angleClass: buildAngleClass, motion: buildMotion, grid: buildGrid, perimeter: buildPerimeter, area: buildArea, drawPerimeter: buildDrawPerimeter, drawArea: buildDrawArea, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.answer + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderGeomCard(p, i) {
    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      // drawPerimeter/drawArea 的 options 是 {w, h} 对象数组，需要格式化显示
      var displayOptions = p.options.map(function (opt) {
        if (typeof opt === 'object' && opt.w != null && opt.h != null) {
          return opt.w + '×' + opt.h;
        }
        return String(opt);
      });
      displayOptions.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      var unit = (p.kind === 'grid') ? '格' : (p.kind === 'perimeter' || p.kind === 'area') ? '厘米' : '';
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        (unit ? '<span style="font-size:13px;color:var(--muted);font-weight:600;">' + unit + '</span>' : '') +
        '</div>';
    }

    var hintHTML = p.hint ? '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    // drawPerimeter/drawArea 没有 svg，显示简单提示
    var mid = '';
    if (p.kind === 'drawPerimeter' || p.kind === 'drawArea') {
      mid = '<div style="font-size:13px;color:var(--brand);margin:6px 0;">(在方格纸上作答，此处选择正确的长×宽)</div>';
    } else if (p.svg) {
      mid = '<div class="q-shape" style="margin:4px auto 6px;">' + p.svg + '</div>';
    }

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:var(--card);box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header" style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:6px;">' +
        '<span class="num" style="position:static;width:22px;height:22px;border-radius:50%;background:var(--brand-bg);color:var(--brand);font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      mid +
      '<div style="font-size:15px;font-weight:800;color:var(--ink);margin:4px 0 8px;">' + p.question + '</div>' +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkGeomQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return _PU.normHZ(v) === _PU.normHZ(q.answer);
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(q.answer).replace(/\s/g, '');
  }

  // ============ ExercisePlugin ============
  var mathGeometryPlugin = {
    id: 'math-geometry',
    moduleId: 'M6',
    name: '图形与几何',
    grades: [2, 3],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'geometry' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',           label: '混合' },
          { value: 'angleCount',    label: '数角' },
          { value: 'angleClass',    label: '角的分类' },
          { value: 'motion',        label: '图形的运动' },
          { value: 'grid',          label: '方格纸平移' },
          { value: 'perimeter',     label: '周长计算' },
          { value: 'area',          label: '面积计算' },
          { value: 'drawPerimeter', label: '画指定周长图形' },
          { value: 'drawArea',      label: '画指定面积图形' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.consume 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      _GRADE = opts.grade || 2;
      // 子题型 → 知识点（按年级区分；未映射的组合不标注，保持纯插件级统计）
      var KP_BY_GRADE_KIND = {
        2: {
          angleCount: 'g2-m6-angles', angleClass: 'g2-m6-angles',
          motion: 'g2-m6-motion', grid: 'g2-m6-grid'
        },
        3: {
          perimeter: 'g3-m6-g3-perimeter', drawPerimeter: 'g3-m6-g3-perimeter'
        }
      };
      var kpMap = KP_BY_GRADE_KIND[_GRADE] || null;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', angleCount: '数角', angleClass: '角的分类', motion: '图形的运动', grid: '方格纸平移', perimeter: '周长计算', area: '面积计算', drawPerimeter: '画指定周长', drawArea: '画指定面积' };
      var label = typeNames[type] || '图形';
      var gradeName = { 1: '一', 2: '二', 3: '三' }[_GRADE] || '三';
      var questions = list.map(function (p) {
        var q = {
          type: 'geometry',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          knowledgePointId: kpMap ? (kpMap[p.kind] || undefined) : undefined,
          hint: p.kind === 'angleCount' ? '一个一个地数，标上记号，不要漏数哦。' :
                p.kind === 'motion' ? '想一想：图形是平移着过去的，还是转了一个方向？' :
                p.kind === 'grid' ? '从图形的同一个点出发数格子。' :
                p.kind === 'perimeter' ? '绕着图形走一圈的长度就是周长。' :
                p.kind === 'area' ? '面积就是图形所占平面的大小。' :
                p.kind === 'drawPerimeter' ? '周长 = (长 + 宽) × 2，先算长+宽等于几。' :
                p.kind === 'drawArea' ? '面积 = 长 × 宽，想一想哪两个数相乘等于面积。' :
                '拿直角比一比，比直角小的是锐角，比直角大的是钝角。',
          render: function (idx, ctx) { return renderGeomCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkGeomQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学' + gradeName + '年级图形与几何（' + label + '）' }
      };
    },

    render: function (exerciseSet) {
      var html = '';
      exerciseSet.questions.forEach(function (q, i) { html += q.render(i); });
      return html;
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkGeomQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = total === 0 ? 0 : Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    },

    // 选项按钮点击（choice 题型）
    __choose: function (btn) {
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathGeometryPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathGeometryPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
