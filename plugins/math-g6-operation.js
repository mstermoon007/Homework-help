/**
 * plugins/math-g6-operation.js — 六年级图形操作插件（M6 图形操作与位置描述）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M6 模块）：
 *   g6-m6-g6-op-circle        画圆                          （type: 'circle'）
 *   g6-m6-g6-op-symmetry      轴对称                        （type: 'symmetry'）
 *   g6-m6-g6-op-rotate-scale  图形的旋转与放大缩小          （type: 'rotate-scale'）
 *   g6-m6-g6-op-position      位置与方向                    （type: 'position'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-operation.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 画圆 ============
  function buildCircle() {
    var v = pick(['radius', 'diam', 'same']);
    if (v === 'radius') {
      var r = rnd(2, 6);
      return { q: '用圆规画一个半径 ' + r + ' 厘米的圆，圆规两脚之间的距离是（  ）厘米', answer: r, svg: circleSVG(r), hint: '圆规两脚之间的距离就是半径。' };
    }
    if (v === 'diam') {
      var d = rnd(2, 6) * 2;
      return { q: '用圆规画一个直径 ' + d + ' 厘米的圆，圆规两脚之间的距离是（  ）厘米', answer: d / 2, svg: circleSVG(d / 2), hint: '圆规两脚间的距离 = 直径 ÷ 2 = 半径。' };
    }
    return { q: '要画一个和已知圆同样大小的圆，圆规两脚间的距离应等于已知圆的（  ）', options: ['半径', '直径', '周长'], answer: '半径', svg: circleSVG(3), hint: '圆的大小由半径决定。' };
  }
  function circleSVG(r) {
    var c = 45, W = 90, H = 90;
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + (r * 9) + '" fill="rgba(63,111,209,.1)" stroke="#3f6fd1" stroke-width="2"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="2.5" fill="#3f6fd1"/>' +
      '<line x1="' + c + '" y1="' + c + '" x2="' + (c + r * 9) + '" y2="' + c + '" stroke="#f2a93b" stroke-width="2" stroke-dasharray="4 3"/>' +
      '<text x="' + (c + 6) + '" y="' + (c - 6) + '" font-size="12" fill="#3f6fd1">O</text>' +
      '<text x="' + (c + r * 4.5 - 4) + '" y="' + (c - 8) + '" font-size="11" fill="#f2a93b">r</text>' +
      '</svg>';
  }

  // ============ 轴对称 ============
  function buildSymmetry() {
    var v = pick(['count', 'line', 'half']);
    if (v === 'count') {
      var pair = pick([['圆', '无数条'], ['长方形', '2 条'], ['正方形', '4 条'], ['等边三角形', '3 条'], ['等腰三角形', '1 条'], ['扇形', '1 条']]);
      return { q: pair[0] + '有（  ）条对称轴', answer: pair[1], options: ['无数条', '1 条', '2 条', '3 条', '4 条'], hint: '沿对称轴对折后两边完全重合。' };
    }
    if (v === 'line') {
      return { q: '圆的对称轴是（  ）', options: ['直径所在的直线', '任意一条线段', '圆周上的点', '半径本身'], answer: '直径所在的直线', hint: '想一想：圆的对称轴应当是一条经过圆心的直线，这样的直线有多少条。' };
    }
    return { q: '长方形有（  ）条对称轴', answer: 2, options: ['1', '2', '4', '无数条'], hint: '沿对边中点的连线对折可以完全重合，想一想这样的连线有几条。' };
  }

  // ============ 图形的旋转与放大缩小 ============
  function buildRotateScale() {
    var v = pick(['rotate', 'enlarge', 'area', 'shrink']);
    if (v === 'rotate') {
      return { q: '图形旋转后，它的（  ）不变', options: ['形状和大小', '位置', '方向', '角度'], answer: '形状和大小', hint: '想一想：旋转后图形只是换了位置和朝向，什么没有变。' };
    }
    if (v === 'enlarge') {
      return { q: '把一个图形各边放大到原来的 3 倍，是把它按（  ）放大', options: ['3 : 1', '1 : 3', '1 : 2', '3 : 2'], answer: '3 : 1', hint: '想一想：放大后与放大前各边的比是多少比多少。' };
    }
    if (v === 'area') {
      var k = pick([2, 3, 4]);
      return { q: '把图形各边放大到原来的 ' + k + ' 倍，面积会扩大到原来的（  ）倍', answer: k * k, options: [String(k), String(k * 2), String(k * k), String(k * k * 2)], hint: '面积比 = 边长比的平方，想一想放大倍数的平方是多少。' };
    }
    return { q: '把一个图形按 1 : 3 缩小，缩小后图形各边是原来的（  ）', options: ['1/3', '3 倍', '1/6', '不变'], answer: '1/3', hint: '按 1:3 缩小，即缩小后与原来的比是 1:3，想一想各边缩小到原来的几分之几。' };
  }

  // ============ 位置与方向 ============
  function buildPosition() {
    var v = pick(['opposite', 'angle', 'dist']);
    if (v === 'opposite') {
      var dir = pick([['正东', '正西'], ['正北', '正南'], ['正西', '正东'], ['正南', '正北']]);
      return { q: '学校在小明家的' + dir[0] + '方向 500 米处，小明家在学校的（  ）方向 500 米处', answer: dir[1], options: ['正东', '正西', '正南', '正北'], svg: compassSVG(dir[1]), hint: '方向相反、距离不变。' };
    }
    if (v === 'angle') {
      var pair = pick([['北偏东 30°', '东偏北 60°'], ['北偏西 45°', '西偏北 45°'], ['南偏东 40°', '东偏南 50°']]);
      return { q: pair[0] + '方向，也可以说成（  ）方向', answer: pair[1], options: [pair[1], '北偏东 30°', '南偏西 30°', '正东'], svg: compassSVG('东'), hint: '两个方向角的和是 90°。' };
    }
    return { q: '确定物体位置需要方向和（  ）两个要素', answer: '距离', options: ['距离', '形状', '颜色', '大小'], svg: compassSVG('北'), hint: '用方向和距离可以准确描述物体的位置。' };
  }
  function compassSVG(highlight) {
    var dirs = ['北', '东', '南', '西'];
    var out = '<svg width="110" height="110" viewBox="0 0 110 110">';
    out += '<circle cx="55" cy="55" r="44" fill="rgba(63,111,209,.06)" stroke="#d9e2f0" stroke-width="1"/>';
    var pos = { '北': [55, 8], '东': [102, 55], '南': [55, 102], '西': [8, 55] };
    dirs.forEach(function (d) {
      var fill = d === highlight ? '#f2a93b' : '#3f6fd1';
      out += '<text x="' + (pos[d][0] - 6) + '" y="' + (pos[d][1] + 5) + '" font-size="15" fill="' + fill + '" font-weight="700">' + d + '</text>';
    });
    out += '<line x1="55" y1="55" x2="55" y2="12" stroke="#27324a" stroke-width="2"/>';
    out += '<circle cx="55" cy="55" r="3" fill="#27324a"/>';
    out += '</svg>';
    return out;
  }

  // ============ 综合操作 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildCircle();
    if (r <= 55) return buildSymmetry();
    if (r <= 75) return buildRotateScale();
    return buildPosition();
  }

  var TYPE_BUILDERS = {
    'circle': buildCircle,
    'symmetry': buildSymmetry,
    'rotate-scale': buildRotateScale,
    'position': buildPosition,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'circle': '画圆',
    'symmetry': '轴对称',
    'rotate-scale': '图形的旋转与放大缩小',
    'position': '位置与方向',
    mix: '综合操作'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-operation',
    moduleId: 'M6',
    name: '操作题',
    pageSubtitle: '画圆、轴对称、旋转与放大缩小、位置与方向',
    grades: [6],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g6-m6-g6-op-circle',
        'g6-m6-g6-op-symmetry',
        'g6-m6-g6-op-rotate-scale',
        'g6-m6-g6-op-position'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合操作' },
          { value: 'circle',       label: '画圆' },
          { value: 'symmetry',     label: '轴对称' },
          { value: 'rotate-scale', label: '图形的旋转与放大缩小' },
          { value: 'position',     label: '位置与方向' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = { type: 'draw', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
        if (p.options) { q.inputType = 'choice'; q.options = p.options; }
        else q.inputType = 'text';
        return q;
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级图形操作练习（' + (TYPE_NAMES[type] || '综合操作') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);