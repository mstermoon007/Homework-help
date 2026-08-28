/**
 * plugins/math-g4-draw.js — 四年级操作题插件（M6 操作）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M6 模块）：
 *   g4-m6-g4-draw-protractor   用量角器量角、画角    （type: 'protractor'）
 *   g4-m6-g4-draw-para         画平行线、垂线        （type: 'parallel-perp'）
 *   g4-m6-g4-draw-grid         在方格纸上画图形      （type: 'grid-quad'）
 *   g4-m6-g4-draw-view         观察物体              （type: 'observe'）
 *   g4-m6-g4-draw-sym          画轴对称图形          （type: 'symmetry'）
 *   g4-m6-g4-draw-move         图形平移              （type: 'translate'）
 *
 * 操作题以「图形 + 结果判断」形式呈现：展示 SVG 操作示意图与操作过程，
 * 学生通过选择/填空确认操作结果，兼顾动手操作的知识点与机器判分。
 * 提供标准 ExercisePlugin 接口。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-draw.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  // 从候选数字中生成 n 个两两不同的选项（均限制在 [lo, hi)，字符串形式）
  function uniqueNums(cands, hi, lo, n) {
    var out = [];
    var pool = [];
    cands.forEach(function (c) {
      if (c >= lo && c < hi && pool.indexOf(c) === -1) pool.push(c);
    });
    var guard = 0;
    while (pool.length < n && guard < 60) {
      var extra = rnd(lo, hi - 1);
      if (pool.indexOf(extra) === -1) pool.push(extra);
      guard++;
    }
    // 打乱取前 n 个（不足则用重复补足，保证数量）
    var shuffled = shuffle(pool);
    for (var i = 0; i < n; i++) out.push(shuffled[i % shuffled.length]);
    return shuffle(out);
  }

  // ============ 量角器量角、画角 ============
  // 画角结果判断：给定角，选择正确的度数 / 画法
  function buildProtractor() {
    var v = pick(['measure', 'draw', 'read']);
    if (v === 'measure') {
      // 量角：给出角度 SVG（用弧线标注），选择度数
      var degs = pick([[30, 0], [45, 0], [60, 0], [90, 0], [120, 0], [135, 0], [150, 0]]);
      var deg = degs[0];
      var svg = angleSVG(deg);
      var opts = uniqueNums([deg, deg + 10, deg - 10, deg + 20], 180, 1, 4);
      return { q: '用量角器量一量，下面这个角是（  ）°', answer: deg, options: opts,
        svg: svg, hint: '角的顶点对准量角器中心，一条边对准 0° 刻度线，看另一条边指到的刻度。' };
    }
    if (v === 'draw') {
      // 画角：给出要画的度数，选择正确的画法步骤
      var deg2 = pick([30, 45, 60, 90, 120, 135]);
      var step = deg2 + '° 角的画法：①画一条射线；②用（  ）量出 ' + deg2 + '°；③连接并标出度数';
      var correct = '量角器';
      var opts2 = shuffle(['量角器', '直尺', '三角尺', '圆规']);
      return { q: step + '。②中应用到的工具是（  ）', answer: correct, options: opts2,
        hint: '画指定度数的角用量角器。' };
    }
    // 读：判断角是锐/直/钝/平
    var d3 = pick([35, 60, 90, 120, 150, 180]);
    var svg3 = angleSVG(d3);
    var cls = d3 < 90 ? '锐角' : d3 === 90 ? '直角' : d3 === 180 ? '平角' : '钝角';
    var opts3 = shuffle(['锐角', '直角', '钝角', '平角']);
    return { q: '下面的角是（  ）', answer: cls, options: opts3,
      svg: svg3, hint: '小于 90° 是锐角，等于 90° 是直角，大于 90° 小于 180° 是钝角，180° 是平角。' };
  }

  function angleSVG(deg) {
    // 画一个角：一条水平边 + 一条给定角度的边 + 弧线标注
    var x = 90, y = 100;
    var rad = deg * Math.PI / 180;
    var ex = x + 70 * Math.cos(rad), ey = y - 70 * Math.sin(rad);
    var arc = (deg >= 180 ? 1 : 0);
    return '<svg width="150" height="120" viewBox="0 0 150 120">' +
      '<path d="M' + x + ',' + y + ' L' + (x + 100) + ',' + y + '" stroke="#3f6fd1" stroke-width="2.5" fill="none"/>' +
      '<path d="M' + x + ',' + y + ' L' + ex.toFixed(1) + ',' + ey.toFixed(1) + '" stroke="#3f6fd1" stroke-width="2.5" fill="none"/>' +
      '<path d="M' + (x + 28) + ',' + y + ' A28,28 0 ' + arc + ' 0 ' + (x + 28 * Math.cos(rad)).toFixed(1) + ',' + (y - 28 * Math.sin(rad)).toFixed(1) + '" stroke="#ff6b6b" stroke-width="1.8" fill="none" stroke-dasharray="3,2"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#27324a"/>' +
      '<text x="' + (x + 34) + '" y="' + (y - 8) + '" font-size="12" fill="#7a879c">' + deg + '°</text>' +
      '</svg>';
  }

  // ============ 画平行线、垂线 ============
  function buildParallelPerp() {
    var v = pick(['parallel', 'perp', 'judge']);
    if (v === 'parallel') {
      var n = rnd(2, 6);
      var pt = pick(['P', 'A', 'M', '点 O']);
      var ln = pick(['l', 'm', '已知直线', '这条线']);
      var q = '过直线外' + pt + '画' + ln + '的平行线，应让三角尺的一条直角边靠住' + ln + '，再用（  ）紧贴三角尺的另一条边推动';
      var correct = '直尺';
      var opts = shuffle(['直尺', '量角器', '圆规', '三角尺的另一边']);
      return { q: q, answer: correct, options: opts,
        hint: '画平行线：一靠、二推、三画。' };
    }
    if (v === 'perp') {
      var pt2 = pick(['P', 'A', 'M', '点 O']);
      var ln2 = pick(['l', 'm', '已知直线', '这条线']);
      var q2 = '过' + ln2 + '上' + pt2 + '画' + ln2 + '的垂线，用（  ）画出的线一定互相垂直';
      var correct2 = '三角尺的直角边';
      var opts2 = shuffle(['三角尺的直角边', '直尺的刻度', '圆规的两脚', '量角器的中心']);
      return { q: q2, answer: correct2, options: opts2,
        hint: '两条直线相交成直角，就说这两条直线互相垂直。' };
    }
    // 判断：两条线的位置关系
    var pair = pick([
      ['互相平行', '两条直线不相交'],
      ['互相垂直', '两条直线相交成直角'],
      ['相交', '两条直线有一个交点但不垂直']
    ]);
    var svg = linePairSVG(pair[0]);
    var opts3 = shuffle(['互相平行', '互相垂直', '相交']);
    return { q: '下面两条直线的位置关系是（  ）', answer: pair[0], options: opts3,
      svg: svg, hint: '不相交的两条直线互相平行；相交成直角的两条直线互相垂直。' };
  }

  function linePairSVG(kind) {
    if (kind === '互相平行') {
      return '<svg width="130" height="70" viewBox="0 0 130 70">' +
        '<line x1="10" y1="20" x2="120" y2="20" stroke="#3f6fd1" stroke-width="2.5"/>' +
        '<line x1="10" y1="50" x2="120" y2="50" stroke="#3f6fd1" stroke-width="2.5"/>' +
        '</svg>';
    }
    if (kind === '互相垂直') {
      return '<svg width="130" height="80" viewBox="0 0 130 80">' +
        '<line x1="15" y1="70" x2="115" y2="70" stroke="#3f6fd1" stroke-width="2.5"/>' +
        '<line x1="65" y1="75" x2="65" y2="5" stroke="#3f6fd1" stroke-width="2.5"/>' +
        '<rect x="60" y="65" width="10" height="10" fill="none" stroke="#ff6b6b" stroke-width="1.5"/>' +
        '</svg>';
    }
    return '<svg width="130" height="80" viewBox="0 0 130 80">' +
      '<line x1="10" y1="70" x2="120" y2="10" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="30" y1="75" x2="115" y2="20" stroke="#e0a33b" stroke-width="2.5"/>' +
      '</svg>';
  }

  // ============ 在方格纸上画平行四边形、梯形 ============
  function buildGridQuad() {
    var v = pick(['count', 'draw', 'sides']);
    if (v === 'count') {
      // 数格子：给出方格图，数图形的底/高
      var kind = pick(['平行四边形', '梯形']);
      var b = rnd(2, 6), h = rnd(2, 4);
      var svg = gridQuadSVG(kind, b, h);
      return { q: '下面' + kind + '的底是（  ）格，高是（  ）格', answer: b + '、' + h,
        inputCount: 2, inputType: 'multi', svg: svg,
        hint: '底和高分别在方格纸上数小方格。' };
    }
    if (v === 'draw') {
      // 画图结果：哪个图形是平行四边形（选项为文字+简要 SVG）
      var opts = shuffle(['平行四边形', '梯形', '长方形', '三角形']);
      var phr = pick([
        '在方格纸上画图形：两组对边分别平行且相等的四边形是（  ）',
        '在方格纸上画一个四边形，要求对边互相平行，它是（  ）',
        '下面哪类四边形满足「对边平行且相等」（  ）'
      ]);
      return { q: phr, answer: '平行四边形', options: opts,
        hint: '平行四边形的两组对边分别平行。' };
    }
    // sides：根据方格判断图形边的长度
    var w = rnd(2, 5), h2 = rnd(2, 4);
    var svg2 = gridQuadSVG('长方形', w, h2);
    return { q: '下面长方形长（  ）格、宽（  ）格', answer: w + '、' + h2,
      inputCount: 2, inputType: 'multi', svg: svg2,
      hint: '数一数长和宽各占几个小方格。' };
  }

  function gridQuadSVG(kind, b, h) {
    var cell = 20;
    var W = b * cell + 2, H = h * cell + 2;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var x = 0; x <= b; x++) {
      out += '<line x1="' + (x * cell) + '" y1="0" x2="' + (x * cell) + '" y2="' + H + '" stroke="#e3e9f2" stroke-width="1"/>';
    }
    for (var y = 0; y <= h; y++) {
      out += '<line x1="0" y1="' + (y * cell) + '" x2="' + W + '" y2="' + (y * cell) + '" stroke="#e3e9f2" stroke-width="1"/>';
    }
    if (kind === '平行四边形') {
      var shift = cell * Math.max(1, Math.round(b * 0.3));
      out += '<polygon points="' + shift + ',0 ' + W + ',0 ' + (W - shift) + ',' + H + ' 0,' + H + '" fill="rgba(63,111,209,.14)" stroke="#3f6fd1" stroke-width="2.5"/>';
    } else if (kind === '梯形') {
      var tShift = cell;
      out += '<polygon points="' + tShift + ',0 ' + (W - tShift) + ',0 ' + W + ',' + H + ' 0,' + H + '" fill="rgba(63,111,209,.14)" stroke="#3f6fd1" stroke-width="2.5"/>';
    } else {
      out += '<rect x="1" y="1" width="' + (W - 2) + '" height="' + (H - 2) + '" fill="rgba(63,111,209,.14)" stroke="#3f6fd1" stroke-width="2.5"/>';
    }
    return out + '</svg>';
  }

  // ============ 观察物体 ============
  function buildObserve() {
    var v = pick(['front', 'cubes']);
    // 立体图形三视图/小方块数量
    var n = rnd(2, 5);
    var w = rnd(2, 4), d = rnd(2, 3), hgt = rnd(2, 3);
    var svg = cubeViewSVG(w, d, hgt);
    var total = w * d * hgt;
    if (v === 'front') {
      var opts = uniqueNums([total, w * hgt, d * hgt, w * d], 200, 1, 4);
      return { q: '下面长方体从正面看，能看到（  ）个小方格', answer: w * hgt, options: opts,
        svg: svg, hint: '从正面看，看到的是长×高（w×h）那一面。' };
    }
    var opts2 = uniqueNums([total, total + 1, total - 1, w * d], 200, 1, 4);
    return { q: '下面长方体一共由（  ）个小正方体组成', answer: total, options: opts2,
      svg: svg, hint: '小正方体个数 = 长 × 宽 × 高。' };
  }

  function cubeViewSVG(w, d, hgt) {
    // 简化的长方体（斜二测）：画外框 + 数量标注
    var cell = 16;
    var W = w * cell, H = hgt * cell;
    var out = '<svg width="' + (W + 40) + '" height="' + (H + 30) + '" viewBox="0 0 ' + (W + 40) + ' ' + (H + 30) + '">';
    // 正面
    out += '<rect x="10" y="5" width="' + W + '" height="' + H + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2"/>';
    // 背面偏移
    var shift = 30;
    out += '<polygon points="' + (10 + shift) + ',' + (5 - 10) + ' ' + (10 + W + shift) + ',' + (5 - 10) + ' ' + (10 + W) + ',5 ' + 10 + ',5" fill="rgba(63,111,209,.06)" stroke="#3f6fd1" stroke-width="1.5"/>';
    out += '<polygon points="' + (10 + W + shift) + ',' + (5 - 10) + ' ' + (10 + W + shift) + ',' + (5 - 10 + H) + ' ' + (10 + W) + ',' + (5 + H) + ' ' + (10 + W) + ',5" fill="rgba(63,111,209,.08)" stroke="#3f6fd1" stroke-width="1.5"/>';
    out += '<text x="' + (10 + W / 2) + '" y="' + (5 + H + 20) + '" font-size="12" fill="#7a879c" text-anchor="middle">长 ' + w + ' 宽 ' + d + ' 高 ' + hgt + '</text>';
    return out + '</svg>';
  }

  // ============ 画轴对称图形 ============
  function buildSymmetry() {
    var v = pick(['axis-count', 'sym', 'not-sym']);
    if (v === 'axis-count') {
      var shapes = [
        ['正方形', 4, squareSVG()],
        ['长方形', 2, rectSVG()],
        ['等边三角形', 3, triSVG()],
        ['等腰三角形', 1, triIsosSVG()],
        ['圆', '无数', circleSVG()]
      ];
      var pr = pick(shapes);
      var ansS = String(pr[1]);
      var optPool = ['无数', '1', '2', '3', '4'].filter(function (o) { return o !== ansS; });
      var shuffled = shuffle(optPool).slice(0, 3);
      var opts = shuffle([ansS].concat(shuffled));
      return { q: '「' + pr[0] + '」有（  ）条对称轴', answer: ansS, options: opts,
        svg: pr[2], hint: '对折后两边完全重合的折痕就是对称轴。' };
    }
    if (v === 'sym') {
      var letters = ['A', 'B', 'C', 'D', 'E', 'H', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y'];
      var c = pick(letters);
      return { q: '大写字母「' + c + '」是轴对称图形吗？', answer: '是', options: shuffle(['是', '不是']),
        hint: '看沿某条直线对折能否完全重合。' };
    }
    var notSym = ['F', 'G', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z'];
    var c2 = pick(notSym);
    return { q: '大写字母「' + c2 + '」是轴对称图形吗？', answer: '不是', options: shuffle(['是', '不是']),
      hint: '沿任何直线对折都不能完全重合，就不是轴对称图形。' };
  }

  function squareSVG() {
    return '<svg width="70" height="70" viewBox="0 0 70 70"><rect x="8" y="8" width="54" height="54" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }
  function rectSVG() {
    return '<svg width="90" height="60" viewBox="0 0 90 60"><rect x="8" y="8" width="74" height="44" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }
  function triSVG() {
    return '<svg width="80" height="70" viewBox="0 0 80 70"><polygon points="40,6 74,62 6,62" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }
  function triIsosSVG() {
    return '<svg width="80" height="70" viewBox="0 0 80 70"><polygon points="40,6 74,62 6,62" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }
  function circleSVG() {
    return '<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }

  // ============ 图形平移 ============
  function buildTranslate() {
    var v = pick(['dx', 'dy', 'both']);
    var dx = rnd(2, 5), dy = rnd(1, 3);
    var svg = translateSVG(dx, dy);
    if (v === 'dx') {
      return { q: '下图中图形向（  ）平移了 ' + dx + ' 格', answer: '右',
        options: shuffle(['右', '左']), svg: svg,
        hint: '看对应顶点移动的方向与格数。' };
    }
    if (v === 'dy') {
      return { q: '下图中图形向（  ）平移了 ' + dy + ' 格', answer: '下',
        options: shuffle(['上', '下']), svg: svg,
        hint: '看对应顶点移动的方向与格数。' };
    }
    var steps = dx + ' 格、再向下 ' + dy + ' 格';
    return { q: '下图中图形先向右平移 ' + dx + ' 格，再向下平移 ' + dy + ' 格，一共平移了（  ）', answer: steps,
      inputCount: 1, inputType: 'text', svg: svg,
      hint: '先平移后平移组合即可。' };
  }

  function translateSVG(dx, dy) {
    var cell = 22;
    var W = (dx + 3) * cell, H = (dy + 3) * cell;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var x = 0; x <= dx + 3; x++) out += '<line x1="' + x * cell + '" y1="0" x2="' + x * cell + '" y2="' + H + '" stroke="#eef2f8" stroke-width="1"/>';
    for (var y = 0; y <= dy + 3; y++) out += '<line x1="0" y1="' + y * cell + '" x2="' + W + '" y2="' + y * cell + '" stroke="#eef2f8" stroke-width="1"/>';
    // 原图形（左上）
    out += '<rect x="' + cell + '" y="' + cell + '" width="' + cell + '" height="' + cell + '" fill="rgba(63,111,209,.14)" stroke="#3f6fd1" stroke-width="2"/>';
    // 平移后图形
    out += '<rect x="' + ((1 + dx) * cell) + '" y="' + ((1 + dy) * cell) + '" width="' + cell + '" height="' + cell + '" fill="rgba(255,107,107,.16)" stroke="#ff6b6b" stroke-width="2"/>';
    out += '<path d="M' + (cell + cell / 2) + ',' + (cell + cell / 2) + ' L' + ((1 + dx) * cell + cell / 2) + ',' + ((1 + dy) * cell + cell / 2) + '" stroke="#e0a33b" stroke-width="1.8" stroke-dasharray="4,3" marker-end="url(#arrow)"/>';
    out += '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#e0a33b"/></marker></defs>';
    return out + '</svg>';
  }

  // ============ 综合操作题（按知识点权重混合） ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 18) return buildProtractor();
    if (r <= 36) return buildParallelPerp();
    if (r <= 52) return buildGridQuad();
    if (r <= 68) return buildObserve();
    if (r <= 86) return buildSymmetry();
    return buildTranslate();
  }

  var TYPE_BUILDERS = {
    'protractor': buildProtractor,
    'parallel-perp': buildParallelPerp,
    'grid-quad': buildGridQuad,
    'observe': buildObserve,
    'symmetry': buildSymmetry,
    'translate': buildTranslate,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'protractor': '量角与画角',
    'parallel-perp': '平行与垂直',
    'grid-quad': '方格纸画图',
    'observe': '观察物体',
    'symmetry': '轴对称',
    'translate': '图形平移',
    mix: '综合操作'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-draw',
    moduleId: 'M6',
    name: '操作题',
    pageSubtitle: '量角画角、平行垂直、方格画图、观察物体、对称与平移',
    grades: [4],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g4-m6-g4-draw-protractor',
        'math-g4-m6-g4-draw-para',
        'math-g4-m6-g4-draw-grid',
        'math-g4-m6-g4-draw-view',
        'math-g4-m6-g4-draw-sym',
        'math-g4-m6-g4-draw-move'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',           label: '综合操作' },
          { value: 'protractor',    label: '量角与画角' },
          { value: 'parallel-perp', label: '平行与垂直' },
          { value: 'grid-quad',     label: '方格纸画图' },
          { value: 'observe',       label: '观察物体' },
          { value: 'symmetry',      label: '轴对称' },
          { value: 'translate',     label: '图形平移' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 50, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var svgOut = p.svg || '';
        if (svgOut) svgOut = svgOut + '<!--s' + rnd(0, 999999) + '-->';
        var q = { type: 'draw', q: p.q, answer: String(p.answer), hint: p.hint, svg: svgOut };
        if (p.inputType === 'multi') {
          q.inputType = 'multi';
          q.inputCount = p.inputCount;
          q.answerParts = String(p.answer).split('、');
          q.answer = q.answerParts;
          // 多空答案：按字段分别比对（容器用 answers['i:j'] 收集）
          q.check = function (answers, idx) {
            var parts = q.answerParts;
            for (var j = 0; j < parts.length; j++) {
              if (_PU.normalizeAns(answers[idx + ':' + j]) !== _PU.normalizeAns(parts[j])) return false;
            }
            return true;
          };
        } else if (p.options) {
          q.inputType = 'choice';
          q.options = p.options;
        } else {
          q.inputType = 'text';
        }
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级操作练习（' + (TYPE_NAMES[type] || '综合操作') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);