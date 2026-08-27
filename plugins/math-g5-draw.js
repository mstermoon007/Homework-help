/**
 * plugins/math-g5-draw.js — 五年级操作题插件（M6 操作）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M6 模块）：
 *   g5-m6-g5-draw-rotate    画旋转后的图形      （type: 'rotation-draw'）
 *   g5-m6-g5-draw-observe   观察物体（三）      （type: 'observe-3d'）
 *   g5-m6-g5-draw-height    画多边形的高        （type: 'polygon-height'）
 *   g5-m6-g5-draw-sym       补全轴对称图形      （type: 'symmetry'）
 *   g5-m6-g5-draw-coord     用数对表示位置      （type: 'coordinate-plot'）
 *   g5-m6-g5-draw-net       长方体展开图        （type: 'solid-net'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-draw.js 依赖 shared/common.js（PluginUtil），请先加载');

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
  function uniqueNums(cands, hi, lo, n) {
    var ans = String(cands[0]);
    var pool = [ans];
    cands.forEach(function (c) {
      var s = String(c);
      if (pool.indexOf(s) === -1 && Number(s) >= lo && Number(s) <= hi) pool.push(s);
    });
    var guard = 0;
    while (pool.length < n && guard < 80) {
      var x = String(rnd(lo, hi));
      if (pool.indexOf(x) === -1) pool.push(x);
      guard++;
    }
    var rest = shuffle(pool.slice(1));
    var out = [ans];
    for (var i = 0; i < n - 1; i++) out.push(rest[i % rest.length]);
    return shuffle(out);
  }

  // ============ 画旋转后的图形 ============
  // 直角三角形绕某顶点旋转 90°，问旋转后的位置/方向
  function buildRotationDraw() {
    var deg = pick([90, 180]);
    var dir = pick(['顺时针', '逆时针']);
    // 旋转前后的图形：画一个三角，旋转后位置变化
    var shape = pick(['三角', '三角']);
    var from = pick(['左上', '右上', '左下', '右下']);
    var toMap = {
      '左上': deg === 90 ? (dir === '顺时针' ? '右上' : '左下') : '右下',
      '右上': deg === 90 ? (dir === '顺时针' ? '右下' : '左上') : '左下',
      '左下': deg === 90 ? (dir === '顺时针' ? '左上' : '右下') : '右上',
      '右下': deg === 90 ? (dir === '顺时针' ? '左下' : '右上') : '左上'
    };
    var to = toMap[from];
    var opts = uniqueNums([1, 2, 3, 4].map(function (i) { return i; }), 4, 1, 4);
    var ansKey = { '左上': 1, '右上': 2, '左下': 3, '右下': 4 };
    return {
      q: '图中的三角形绕 O 点' + dir + '旋转 ' + deg + '° 后，图形会移到（填选项：' + ['左上', '右上', '左下', '右下'].map(function (p, i) { return (i + 1) + '=' + p; }).join('、') + '）',
      options: ['左上', '右上', '左下', '右下'],
      answer: to,
      hint: '旋转后形状大小不变，只是位置方向改变。',
      svg: rotateSVG(deg, dir)
    };
  }
  function rotateSVG(deg, dir) {
    var cx = 80, cy = 65;
    var r = 30;
    var ang = (deg === 90 ? 1 : 2) * (dir === '顺时针' ? -1 : 1);
    var x2 = cx + r * Math.cos(Math.atan2(0, 1) + ang * Math.PI / 2) - r;
    var y2 = cy + r * Math.sin(Math.atan2(0, 1) + ang * Math.PI / 2);
    return '<svg width="160" height="130" viewBox="0 0 160 130">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#3f6fd1"/>' +
      '<text x="' + (cx + 6) + '" y="' + (cy - 6) + '" font-size="12" fill="#3f6fd1">O</text>' +
      '<polygon points="' + cx + ',' + cy + ' ' + (cx + 25) + ',' + cy + ' ' + cx + ',' + (cy - 25) + '" fill="rgba(63,111,209,.25)" stroke="#3f6fd1" stroke-width="2"/>' +
      '<path d="M ' + cx + ' ' + cy + ' A ' + r + ' ' + r + ' 0 0 ' + (dir === '顺时针' ? 1 : 0) + ' ' + x2 + ' ' + y2 + '" fill="none" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<polygon points="' + x2 + ',' + y2 + ' ' + (x2 + 25) + ',' + y2 + ' ' + x2 + ',' + (y2 - 25) + '" fill="rgba(242,169,59,.25)" stroke="#f2a93b" stroke-width="2" transform="rotate(' + (ang * 90) + ' ' + x2 + ' ' + y2 + ')"/>' +
      '</svg>';
  }

  // ============ 观察物体（三） ============
  // 给出小正方体堆的长宽高，问从正面/上面看到的面
  function buildObserve3d() {
    var w = rnd(2, 4), d = rnd(2, 4), h = rnd(2, 3);
    var total = w * d * h;
    var view = pick(['正面', '上面', '侧面']);
    var ans;
    if (view === '正面') ans = w * h;
    else if (view === '上面') ans = w * d;
    else ans = d * h;
    var opts = uniqueNums([ans, total, w * d, d * h, w * h], 64, 1, 4);
    return {
      q: '用小正方体搭成 ' + w + '×' + d + '×' + h + ' 的长方体，从' + view + '看，看到的面由几个小正方形组成？',
      options: opts, answer: String(ans),
      hint: '从' + view + '看，看到的是对应方向的一层。',
      svg: cube3dSVG(w, d, h)
    };
  }
  function cube3dSVG(w, d, h) {
    var W = 150, H = 110;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    var ox = 40, oy = 85, step = 16;
    var dx = step, dy = step * 0.5, dz = step;
    // 画立方体网格
    for (var x = 0; x < w; x++) {
      for (var y = 0; y < d; y++) {
        for (var z = 0; z < h; z++) {
          var px = ox + x * dx - y * dx * 0.5;
          var py = oy - z * dz + y * dy * 0.5;
          out += '<polygon points="' + px + ',' + py + ' ' + (px + dx) + ',' + py + ' ' + (px + dx) + ',' + (py - dz) + ' ' + px + ',' + (py - dz) + '" fill="rgba(63,111,209,.15)" stroke="#3f6fd1" stroke-width="1"/>';
          out += '<polygon points="' + px + ',' + py + ' ' + (px + dx) + ',' + py + ' ' + (px + dx - dx * 0.5) + ',' + (py + dy * 0.5) + ' ' + (px - dx * 0.5) + ',' + (py + dy * 0.5) + '" fill="rgba(63,111,209,.08)" stroke="#3f6fd1" stroke-width="1"/>';
        }
      }
    }
    out += '</svg>';
    return out;
  }

  // ============ 画多边形的高 ============
  // 给出三角形/平行四边形/梯形，问底边对应的高
  function buildPolygonHeight() {
    var shape = pick(['三角形', '平行四边形', '梯形']);
    var q, ans, svg;
    if (shape === '三角形') {
      var b = rnd(3, 6), h = rnd(2, 5);
      var opts = uniqueNums([h, h + 1, h - 1, b], 10, 1, 4);
      q = '三角形的高是（  ）格';
      ans = String(h);
      svg = triSVG(b, h);
    } else if (shape === '平行四边形') {
      var b2 = rnd(3, 6), h2 = rnd(2, 5);
      q = '平行四边形的高是（  ）格';
      ans = String(h2);
      opts = uniqueNums([h2, h2 + 1, h2 - 1, b2], 10, 1, 4);
      svg = paraSVG(b2, h2);
    } else {
      var up = rnd(2, 4), down = rnd(4, 7), h3 = rnd(2, 5);
      q = '梯形的高是（  ）格';
      ans = String(h3);
      opts = uniqueNums([h3, h3 + 1, h3 - 1, down], 10, 1, 4);
      svg = trapSVG(up, down, h3);
    }
    return { q: q, options: opts, answer: ans, hint: '从顶点向底边作垂线段，垂线段的长就是高。', svg: svg };
  }
  function triSVG(b, h) {
    var W = 30 + b * 16, H = 30 + h * 16;
    var x1 = 10, y1 = H - 10, x2 = x1 + b * 16, y2 = y1, x3 = (x1 + x2) / 2, y3 = y1 - h * 16;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + x1 + ',' + y1 + ' ' + x2 + ',' + y2 + ' ' + x3 + ',' + y3 + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + x3 + '" y1="' + y3 + '" x2="' + x3 + '" y2="' + y1 + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (x3 + 3) + '" y="' + ((y3 + y1) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '</svg>';
  }
  function paraSVG(b, h) {
    var W = 30 + b * 16, H = 30 + h * 16;
    var x1 = 10, y1 = H - 10;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + x1 + ',' + y1 + ' ' + (x1 + b * 16) + ',' + y1 + ' ' + (x1 + b * 16 - 16) + ',' + (y1 - h * 16) + ' ' + (x1 - 16) + ',' + (y1 - h * 16) + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + (x1 + 16) + '" y1="' + (y1 - h * 16) + '" x2="' + (x1 + 16) + '" y2="' + y1 + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (x1 + 22) + '" y="' + ((y1 + y1 - h * 16) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '</svg>';
  }
  function trapSVG(up, down, h) {
    var W = 30 + down * 16, H = 30 + h * 16;
    var mid = 8;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<polygon points="' + mid + ',' + (H - 10) + ' ' + (mid + down * 16) + ',' + (H - 10) + ' ' + (mid + down * 16 - 16) + ',' + (H - 10 - h * 16) + ' ' + (mid + 16) + ',' + (H - 10 - h * 16) + '" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/>' +
      '<line x1="' + (mid + 24) + '" y1="' + (H - 10 - h * 16) + '" x2="' + (mid + 24) + '" y2="' + (H - 10) + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (mid + 30) + '" y="' + ((H - 10 + H - 10 - h * 16) / 2) + '" font-size="12" fill="#f2a93b">高</text>' +
      '</svg>';
  }

  // ============ 补全轴对称图形 ============
  function buildSymmetry() {
    var pairs = [
      ['长方形', '2', 'rectSym'],
      ['正方形', '4', 'sqSym'],
      ['等腰三角形', '1', 'isoTriSym'],
      ['等边三角形', '3', 'eqTriSym'],
      ['圆', '无数条', 'circSym']
    ];
    var pr = pick(pairs);
    var opts;
    if (pr[1] === '无数条') opts = shuffle(['无数条', '1', '2', '4']);
    else opts = uniqueNums([Number(pr[1]), Number(pr[1]) + 1, Number(pr[1]) + 2, 1], 8, 1, 4);
    return { q: pr[0] + '有（  ）条对称轴', options: opts, answer: pr[1], hint: '对折后两边完全重合的折痕是它的对称轴。', svg: symSVG(pr[2]) };
  }
  function symSVG(kind) {
    if (kind === 'rectSym') return '<svg width="80" height="60" viewBox="0 0 80 60"><rect x="8" y="8" width="64" height="44" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
    if (kind === 'sqSym') return '<svg width="70" height="70" viewBox="0 0 70 70"><rect x="8" y="8" width="54" height="54" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
    if (kind === 'isoTriSym') return '<svg width="80" height="70" viewBox="0 0 80 70"><polygon points="40,6 74,62 6,62" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
    if (kind === 'eqTriSym') return '<svg width="80" height="70" viewBox="0 0 80 70"><polygon points="40,6 74,62 6,62" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
    return '<svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="28" fill="rgba(63,111,209,.12)" stroke="#3f6fd1" stroke-width="2.5"/></svg>';
  }

  // ============ 用数对表示位置 ============
  function buildCoordinatePlot() {
    var x = rnd(1, 5), y = rnd(1, 5);
    var xChar = String.fromCharCode(64 + x);
    var dir = pick(['row', 'col']);
    if (dir === 'row') {
      return { q: '点在第 ' + x + ' 列第 ' + y + ' 行，用数对表示是（  ）', answer: '(' + x + ', ' + y + ')', hint: '先列后行。', svg: coordSVG(x, y) };
    }
    return { q: '图中第 ' + x + ' 列第 ' + y + ' 行的点，用数对表示是（  ）', answer: '(' + x + ', ' + y + ')', hint: '先列后行。', svg: coordSVG(x, y) };
  }
  function coordSVG(x, y) {
    var W = 110, H = 110;
    var ox = 15, oy = H - 15, step = 16;
    var out = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">';
    for (var i = 0; i <= 5; i++) {
      out += '<line x1="' + (ox + i * step) + '" y1="' + oy + '" x2="' + (ox + i * step) + '" y2="' + (oy - 5 * step) + '" stroke="#d9e2f0" stroke-width="1"/>';
      out += '<line x1="' + ox + '" y1="' + (oy - i * step) + '" x2="' + (ox + 5 * step) + '" y2="' + (oy - i * step) + '" stroke="#d9e2f0" stroke-width="1"/>';
    }
    out += '<circle cx="' + (ox + x * step) + '" cy="' + (oy - y * step) + '" r="4" fill="#3f6fd1"/>';
    out += '<text x="' + (ox + x * step + 5) + '" y="' + (oy - y * step - 5) + '" font-size="12" fill="#3f6fd1">●</text>';
    out += '</svg>';
    return out;
  }

  // ============ 长方体展开图 ============
  function buildSolidNet() {
    var q, ans, opts, svg;
    var shape = pick(['长方体', '正方体']);
    if (shape === '正方体') {
      q = '下面哪个图形能围成正方体？';
      ans = '中间图';
      opts = shuffle(['左图', '中间图', '右图']);
      svg = netSVG(shape);
    } else {
      q = '下面哪个图形能围成长方体？';
      ans = '右图';
      opts = shuffle(['左图', '中间图', '右图']);
      svg = netSVG(shape);
    }
    return { q: q, options: opts, answer: ans, hint: '展开图沿虚线折叠后能围成立体图形的是正确的展开图。', svg: svg };
  }
  function netSVG(kind) {
    var cell = 22;
    var out = '<svg width="200" height="90" viewBox="0 0 200 90">';
    // 三种候选展开图
    var layouts = [
      '0,1,0,0,1,1', // 十字形（可围正方体）
      '0,0,1,1,0,1', // 错位（不可围）
      '1,1,0,1,0,1'  // T 形变体（长方体）
    ];
    for (var g = 0; g < 3; g++) {
      var gx = 6 + g * 66;
      var cells = layouts[g].split(',');
      for (var ci = 0; ci < cells.length; ci++) {
        var col = ci % 3, row = Math.floor(ci / 3);
        if (cells[ci] === '1') {
          var fill = g === 0 ? 'rgba(63,111,209,.15)' : g === 1 ? 'rgba(170,170,170,.25)' : 'rgba(242,169,59,.2)';
          var stroke = g === 0 ? '#3f6fd1' : g === 1 ? '#aaa' : '#f2a93b';
          out += '<rect x="' + (gx + col * cell) + '" y="' + (8 + row * cell) + '" width="' + cell + '" height="' + cell + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.5"/>';
        }
      }
      out += '<text x="' + (gx + 30) + '" y="84" font-size="11" fill="#7a879c">' + (g === 0 ? '左' : g === 1 ? '中' : '右') + '</text>';
    }
    out += '</svg>';
    return out;
  }

  // ============ 综合操作 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 20) return buildRotationDraw();
    if (r <= 40) return buildObserve3d();
    if (r <= 60) return buildPolygonHeight();
    if (r <= 78) return buildSymmetry();
    if (r <= 90) return buildCoordinatePlot();
    return buildSolidNet();
  }

  var TYPE_BUILDERS = {
    'rotation-draw': buildRotationDraw,
    'observe-3d': buildObserve3d,
    'polygon-height': buildPolygonHeight,
    'symmetry': buildSymmetry,
    'coordinate-plot': buildCoordinatePlot,
    'solid-net': buildSolidNet,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'rotation-draw': '画旋转后的图形',
    'observe-3d': '观察物体（三）',
    'polygon-height': '画多边形的高',
    'symmetry': '补全轴对称图形',
    'coordinate-plot': '用数对表示位置',
    'solid-net': '长方体展开图',
    mix: '综合操作'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-draw',
    moduleId: 'M6',
    name: '操作题',
    pageSubtitle: '旋转、观察物体、画高、对称、数对与展开图',
    grades: [5],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g5-m6-g5-draw-rotate',
        'math-g5-m6-g5-draw-observe',
        'math-g5-m6-g5-draw-height',
        'math-g5-m6-g5-draw-sym',
        'math-g5-m6-g5-draw-coord',
        'math-g5-m6-g5-draw-net'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合操作' },
          { value: 'rotation-draw',   label: '画旋转后的图形' },
          { value: 'observe-3d',      label: '观察物体（三）' },
          { value: 'polygon-height',  label: '画多边形的高' },
          { value: 'symmetry',        label: '补全轴对称图形' },
          { value: 'coordinate-plot', label: '用数对表示位置' },
          { value: 'solid-net',       label: '长方体展开图' }
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
        var q = { type: 'draw', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
        if (p.inputType === 'multi') {
          q.inputType = 'multi';
          q.inputCount = p.inputCount;
          q.answerParts = String(p.answer).split('、');
          q.answer = q.answerParts;
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
        title: '小学五年级操作练习（' + (TYPE_NAMES[type] || '综合操作') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);