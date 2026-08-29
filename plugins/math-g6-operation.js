/**
 * plugins/math-g6-operation.js — 六年级图形操作插件（M6 图形操作与位置描述）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M6 模块）：
 *   g6-m6-g6-op-circle        画圆                          （type: 'circle'）
 *   g6-m6-g6-op-symmetry      轴对称                        （type: 'symmetry'）
 *   g6-m6-g6-op-rotate-scale  图形的旋转与放大缩小          （type: 'rotate-scale'）
 *   g6-m6-g6-op-position      位置与方向                    （type: 'position'）
 *
 * 参数化扩容（目标：重复率 ≤15%）：
 *   - 图形对象扩容：圆/圆柱/圆锥展开图/组合图形/对称图形
 *   - 旋转参数化：旋转角度（90°/180°）× 方向（顺/逆）× 图形（三角形/L形/凸形）→ 读图判断
 *   - 平移参数化：方向（上/下/左/右）× 距离（2/3/5 格）→ 读图判断
 *   - 变换组合概念题：先平移再旋转的不变量
 *   - 读图判断：题干 SVG 内含原图 + A/B/C/D 四候选（1 正确 + 错向/错角/镜像干扰），选项有区分度
 *   - 题目池缓存：模块级牌堆（按题型），全量参数化签名池洗牌后跨 generate 调用连续发牌
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
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============ SVG 基础工具（内联，Node/浏览器通用） ============
  function rotPts(pts, deg, cx, cy) {
    // SVG 坐标系（y 向下）：deg 为视觉顺时针角度
    var rad = deg * Math.PI / 180;
    return pts.map(function (p) {
      var dx = p[0] - cx, dy = p[1] - cy;
      return [cx + dx * Math.cos(rad) - dy * Math.sin(rad), cy + dx * Math.sin(rad) + dy * Math.cos(rad)];
    });
  }
  function mirrorPts(pts, cx) {
    return pts.map(function (p) { return [2 * cx - p[0], p[1]]; });
  }
  function polyAttr(pts) {
    return pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ');
  }
  function polySvg(pts, fill, stroke) {
    return '<polygon points="' + polyAttr(pts) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="2" stroke-linejoin="round"/>';
  }
  var BLUE = '#3f6fd1', ORANGE = '#f2a93b', GHOST = '#8a97ad'; /* allow-color */

  // 三种可操作图形（单位格）
  var OP_SHAPES = [
    { key: 'tri', name: '三角形', pts: [[1, 1], [4, 1], [1, 3]] },
    { key: 'elle', name: 'L 形', pts: [[1, 1], [3, 1], [3, 2], [2, 2], [2, 4], [1, 4]] },
    { key: 'conv', name: '凸形', pts: [[1, 1], [4, 1], [4, 2], [3, 2], [3, 3], [1, 3]] }
  ];

  /** 读图判断组合 SVG：原图 + A/B/C/D 四候选面板（correctLabel 固定于 combo，保证签名稳定） */
  function transformChoiceSVG(shapePts, candidates, correctLabel) {
    var W = 610, H = 120, panel = 110, pad = 10;
    var labels = ['A', 'B', 'C', 'D'];
    var svg = '<svg style="width:100%;height:auto;max-width:' + W + 'px;" viewBox="0 0 ' + W + ' ' + (H + 24) + '">';
    svg += '<rect x="0" y="0" width="' + W + '" height="' + (H + 24) + '" fill="none"/>';
    // 原图面板
    svg += '<g transform="translate(' + pad + ',10)">';
    svg += '<rect x="0" y="0" width="' + panel + '" height="' + panel + '" fill="rgba(63,111,209,.04)" stroke="#d9e2f0" rx="8"/>';
    svg += '<text x="' + (panel / 2 - 22) + '" y="' + (panel + 16) + '" font-size="13" fill="#27324a" font-weight="700">原图</text>';
    svg += polySvg(shapePts.map(function (p) { return [p[0] * 22 + 11, p[1] * 22 + 11]; }), 'rgba(63,111,209,.15)', BLUE); /* allow-color */
    svg += '<circle cx="' + (1 * 22 + 11) + '" cy="' + (1 * 22 + 11) + '" r="3" fill="#27324a"/>';
    svg += '<text x="' + (1 * 22 + 15) + '" y="' + (1 * 22 + 6) + '" font-size="11" fill="#27324a">O</text>';
    svg += '</g>';
    // 候选面板（correctLabel 固定，干扰项顺序确定 → 同 combo 签名稳定）
    candidates.forEach(function (cand, i) {
      var lab = labels[i];
      var x = pad + panel + 14 + i * (panel + 6);
      svg += '<g transform="translate(' + x + ',10)">';
      svg += '<rect x="0" y="0" width="' + panel + '" height="' + panel + '" fill="rgba(63,111,209,.04)" stroke="#d9e2f0" rx="8"/>';
      svg += '<text x="' + (panel / 2 - 6) + '" y="' + (panel + 16) + '" font-size="13" font-weight="700" fill="#27324a">' + lab + '</text>';
      svg += polySvg(cand.pts.map(function (p) { return [p[0] * 22, p[1] * 22]; }), cand.fill, cand.stroke);
      svg += '</g>';
    });
    svg += '</svg>';
    return svg;
  }

  // ============ ① 画圆（参数化 26 签名） ============
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

  // ============ 位置罗盘 SVG ============
  function compassSVG(highlight) {
    var dirs = ['北', '东', '南', '西'];
    var out = '<svg width="110" height="110" viewBox="0 0 110 110">';
    out += '<circle cx="55" cy="55" r="44" fill="rgba(63,111,209,.06)" stroke="#d9e2f0" stroke-width="1"/>';
    var pos = { '北': [55, 8], '东': [102, 55], '南': [55, 102], '西': [8, 55] };
    dirs.forEach(function (d) {
      var fill = d === highlight ? '#f2a93b' : '#3f6fd1'; /* allow-color */
      out += '<text x="' + (pos[d][0] - 6) + '" y="' + (pos[d][1] + 5) + '" font-size="15" fill="' + fill + '" font-weight="700">' + d + '</text>';
    });
    out += '<line x1="55" y1="55" x2="55" y2="12" stroke="#27324a" stroke-width="2"/>';
    out += '<circle cx="55" cy="55" r="3" fill="#27324a"/>';
    out += '</svg>';
    return out;
  }

  // ============ 全量参数化签名池（确定性枚举） ============
  function poolCircle() {
    var list = [];
    for (var r = 2; r <= 9; r++) {
      list.push({ q: '用圆规画一个半径 ' + r + ' 厘米的圆，圆规两脚之间的距离是（  ）厘米', answer: r, svg: circleSVG(r), hint: '圆规两脚之间的距离就是半径。' });
    }
    for (var d = 4; d <= 18; d += 2) {
      list.push({ q: '用圆规画一个直径 ' + d + ' 厘米的圆，圆规两脚之间的距离是（  ）厘米', answer: d / 2, svg: circleSVG(d / 2), hint: '圆规两脚间的距离 = 直径 ÷ 2 = 半径。' });
    }
    for (var a = 1; a <= 9; a++) {
      list.push({ q: '把圆规两脚之间的距离定为 ' + a + ' 厘米，画出的圆的半径是（  ）厘米', answer: a, svg: circleSVG(a), hint: '两脚间距离就是半径。' });
    }
    list.push({ q: '要画一个和已知圆同样大小的圆，圆规两脚间的距离应等于已知圆的（  ）', options: ['半径', '直径', '周长'], answer: '半径', svg: circleSVG(3), hint: '圆的大小由半径决定。' });
    return list;
  }

  function poolSymmetry() {
    var list = [];
    var shapes = [
      ['圆', '无数条'], ['圆环', '无数条'], ['长方形', '2 条'], ['正方形', '4 条'],
      ['等边三角形', '3 条'], ['等腰三角形', '1 条'], ['等腰梯形', '1 条'],
      ['正六边形', '6 条'], ['角', '1 条'], ['线段', '2 条'], ['扇形', '1 条']
    ];
    shapes.forEach(function (pair) {
      list.push({ q: pair[0] + '有（  ）条对称轴', answer: pair[1], options: ['无数条', '1 条', '2 条', '3 条', '4 条', '6 条'], hint: '沿对称轴对折后两边完全重合。' });
    });
    list.push({ q: '圆的对称轴是（  ）', options: ['直径所在的直线', '任意一条线段', '圆周上的点', '半径本身'], answer: '直径所在的直线', hint: '经过圆心的直线都是对称轴，这样的直线有无数条。' });
    list.push({ q: '长方形有（  ）条对称轴', answer: 2, options: ['1', '2', '4', '无数条'], hint: '沿对边中点的连线对折可以完全重合。' });
    list.push({ q: '正方形的对称轴方向是（  ）', options: ['横、竖和对角线方向', '只有横和竖', '只有对角线', '只有一条'], answer: '横、竖和对角线方向', hint: '正方形有 4 条对称轴。' });
    list.push({ q: '长方形的对称轴是（  ）', options: ['对边中点连线', '对角线', '任意过中心的线', '对角线和中线都是'], answer: '对边中点连线', hint: '沿对角线对折长方形并不能重合。' });
    return list;
  }

  function poolRotateScale() {
    var list = [];
    // 概念题
    list.push({ q: '图形旋转后，它的（  ）不变', options: ['形状和大小', '位置', '方向', '角度'], answer: '形状和大小', hint: '旋转只改变位置和朝向。' });
    list.push({ q: '图形旋转的三要素是（  ）', options: ['旋转中心、旋转方向和旋转角度', '形状、大小和颜色', '边、角和顶点', '位置、方向和距离'], answer: '旋转中心、旋转方向和旋转角度', hint: '描述旋转必须说清绕哪点、往哪转、转多少度。' });
    list.push({ q: '图形先向右平移 3 格，再绕点 O 顺时针旋转 90°，它的（  ）不变', options: ['形状和大小', '位置和方向', '方向', '位置'], answer: '形状和大小', hint: '平移和旋转都不改变图形的形状与大小。' });
    list.push({ q: '同时经过平移和旋转的图形，发生改变的是（  ）', options: ['位置和方向', '形状', '大小', '周长'], answer: '位置和方向', hint: '两种变换都只动位置与朝向。' });
    // 放大缩小参数化 k∈2..5
    for (var k = 2; k <= 5; k++) {
      list.push({ q: '把一个图形各边放大到原来的 ' + k + ' 倍，是把它按（  ）放大', options: [k + ' : 1', '1 : ' + k, '1 : 2', k + ' : 2'], answer: k + ' : 1', hint: '放大后与放大前各边的比是 ' + k + ':1。' });
      list.push({ q: '把图形各边放大到原来的 ' + k + ' 倍，面积会扩大到原来的（  ）倍', answer: k * k, options: [String(k), String(k * 2), String(k * k), String(k * k * 2)], hint: '面积比 = 边长比的平方。' });
      list.push({ q: '把一个图形按 1 : ' + k + ' 缩小，缩小后图形各边是原来的（  ）', options: ['1/' + k, k + ' 倍', '1/' + (k * 2), '不变'], answer: '1/' + k, hint: '按 1:' + k + ' 缩小，即各边缩小到原来的 1/' + k + '。' });
      list.push({ q: '把图形各边放大到原来的 ' + k + ' 倍，周长会扩大到原来的（  ）倍', answer: k, options: [String(k), String(k * k), String(k * 2), String(k + 1)], hint: '周长比 = 边长比（一维）。' });
    }
    // 读图旋转判断：3 图形 × 2 角度 × 2 方向 = 12（SVG 内嵌四候选）
    OP_SHAPES.forEach(function (sh) {
      [90, 180].forEach(function (ang) {
        ['顺时针', '逆时针'].forEach(function (dirTxt) {
          var cw = dirTxt === '顺时针';
          var deg = cw ? ang : 360 - ang;
          function norm(pts) {
            // 包围盒平移回 (1,1) 起，保证候选在面板内（旋转/镜像只看形状方向）
            var minX = 1e9, minY = 1e9;
            pts.forEach(function (p) { if (p[0] < minX) minX = p[0]; if (p[1] < minY) minY = p[1]; });
            return pts.map(function (p) { return [p[0] - minX + 1, p[1] - minY + 1]; });
          }
          var correct = norm(rotPts(sh.pts, deg, 1, 1));
          var wrongDir = norm(rotPts(sh.pts, 360 - ang, 1, 1)); // 反方向同角度
          var wrongAng = norm(rotPts(sh.pts, ang === 90 ? 180 : 90, 1, 1)); // 错角度
          if (JSON.stringify(wrongAng) === JSON.stringify(wrongDir) || JSON.stringify(wrongAng) === JSON.stringify(correct)) {
            wrongAng = norm(rotPts(sh.pts, 270, 1, 1));
          }
          var mirrored = norm(mirrorPts(sh.pts, 5));
          // 四候选：正确 + 反方向 + 错角度 + 镜像
          var cands = [
            { pts: correct, fill: 'rgba(45,164,78,.18)', stroke: '#2da44e' },
            { pts: wrongDir, fill: 'rgba(63,111,209,.10)', stroke: GHOST },
            { pts: wrongAng, fill: 'rgba(63,111,209,.10)', stroke: GHOST },
            { pts: mirrored, fill: 'rgba(242,169,59,.12)', stroke: ORANGE }
          ];
          var correctLabel = ['A', 'B', 'C', 'D'][(ang + (cw ? 0 : 1) + sh.key.length) % 4];
          var svg = transformChoiceSVG(sh.pts, cands, correctLabel);
          var labels = ['A', 'B', 'C', 'D'];
          list.push({
            q: '把左图的' + sh.name + '（点 O 为旋转中心）' + dirTxt + '旋转 ' + ang + '°，得到的图形是（  ）',
            answer: correctLabel,
            options: labels.slice(),
            svg: svg,
            hint: '抓准旋转方向和角度，注意旋转不改变图形形状大小，镜像不是旋转。'
          });
        });
      });
    });
    // 读图平移判断：4 方向 × 3 距离 = 12
    var DIRS = [['向右', 1, 0], ['向左', -1, 0], ['向上', 0, -1], ['向下', 0, 1]];
    DIRS.forEach(function (dv) {
      [2, 3, 5].forEach(function (dist) {
        var sh = OP_SHAPES[0]; // 三角形
        var K = 0.3, OFF = 20;
        function shift(dx, dy) {
          return sh.pts.map(function (p) { return [p[0] + OFF + dx, p[1] + OFF + dy]; });
        }
        var correct = shift(dv[1] * dist * K, dv[2] * dist * K);
        var wrongA = shift(-dv[1] * dist * K, -dv[2] * dist * K);
        var wrongB = shift(dv[2] * dist * K, dv[1] * dist * K);
        var wrongC = shift(dv[1] * (dist + 1) * K * (dist < 5 ? 1 : -1), dv[2] * (dist + 1) * K * (dist < 5 ? 1 : -1));
        var cands = [
          { pts: correct, fill: 'rgba(45,164,78,.18)', stroke: '#2da44e' },
          { pts: wrongA, fill: 'rgba(63,111,209,.10)', stroke: GHOST },
          { pts: wrongB, fill: 'rgba(63,111,209,.10)', stroke: GHOST },
          { pts: wrongC, fill: 'rgba(63,111,209,.10)', stroke: GHOST }
        ];
        var correctLabel = ['A', 'B', 'C', 'D'][(dist + DIRS.indexOf(dv)) % 4];
        var svg = transformChoiceSVG(sh.pts, cands, correctLabel);
        list.push({
          q: '把左图的三角形' + dv[0] + '平移 ' + dist + ' 格，得到的图形是（  ）',
          answer: correctLabel,
          options: ['A', 'B', 'C', 'D'],
          svg: svg,
          hint: '平移只改变位置，方向和距离要对应。'
        });
      });
    });
    return list;
  }

  function poolPosition() {
    var list = [];
    var opp = [['正东', '正西'], ['正北', '正南'], ['正西', '正东'], ['正南', '正北']];
    opp.forEach(function (dir) {
      list.push({ q: '学校在小明家的' + dir[0] + '方向 500 米处，小明家在学校的（  ）方向 500 米处', answer: dir[1], options: ['正东', '正西', '正南', '正北'], svg: compassSVG(dir[1]), hint: '方向相反、距离不变。' });
    });
    var angPairs = [
      ['北偏东 30°', '东偏北 60°'], ['北偏西 45°', '西偏北 45°'], ['南偏东 40°', '东偏南 50°'],
      ['南偏西 25°', '西偏南 65°'], ['北偏东 60°', '东偏北 30°'], ['南偏东 70°', '东偏南 20°']
    ];
    angPairs.forEach(function (pair) {
      list.push({ q: pair[0] + '方向，也可以说成（  ）方向', answer: pair[1], options: [pair[1], '北偏东 30°', '南偏西 30°', '正东'], svg: compassSVG('东'), hint: '两个方向角的和是 90°。' });
    });
    [30, 45, 60].forEach(function (x) {
      list.push({ q: 'A 在 B 的北偏东 ' + x + '° 方向，那么 B 在 A 的（  ）方向', answer: '南偏西 ' + x + '°', options: ['南偏西 ' + x + '°', '北偏西 ' + x + '°', '南偏东 ' + x + '°', '北偏东 ' + x + '°'], svg: compassSVG('南'), hint: '观测点互换，方向正好相反，角度不变。' });
    });
    [200, 300, 500, 800].forEach(function (dist) {
      list.push({ q: '确定物体位置需要方向和（  ）两个要素，如「邮局在市政府正北方向 ' + dist + ' 米处」', answer: '距离', options: ['距离', '形状', '颜色', '大小'], svg: compassSVG('北'), hint: '用方向和距离可以准确描述物体的位置。' });
    });
    return list;
  }

  function poolShape() {
    var list = [];
    list.push({ q: '圆柱的展开图由（  ）组成', options: ['两个相同的圆和一个长方形', '一个圆和一个扇形', '两个长方形和一个圆', '三个圆'], answer: '两个相同的圆和一个长方形', hint: '侧面沿高展开是长方形，底面是两个相同的圆。' });
    list.push({ q: '圆柱的侧面沿高展开后得到一个长方形，长方形的长等于圆柱的（  ）', options: ['底面周长', '高', '半径', '直径'], answer: '底面周长', hint: '侧面卷起来时，长正好绕底面一圈。' });
    list.push({ q: '圆锥的展开图由（  ）组成', options: ['一个圆和一个扇形', '两个圆和一个长方形', '两个扇形', '一个长方形和一个三角形'], answer: '一个圆和一个扇形', hint: '底面是圆，侧面展开是扇形。' });
    list.push({ q: '计算组合图形面积的基本思路是（  ）', options: ['分割或添补成基本图形', '只能数格子', '必须用公式直接算', '测量每条边再相加'], answer: '分割或添补成基本图形', hint: '把复杂图形转化成学过的基本图形。' });
    list.push({ q: '一个长方形和一个小三角形拼成的组合图形，面积等于（  ）', options: ['长方形面积 + 三角形面积', '长方形面积 − 三角形面积', '两者面积相乘', '无法计算'], answer: '长方形面积 + 三角形面积', hint: '拼接组合图形面积相加（不重叠时）。' });
    list.push({ q: '把一张长方形纸对折后剪出图案，展开后的图案是（  ）', options: ['轴对称图形', '中心对称图形', '任意图形', '圆形'], answer: '轴对称图形', hint: '对折剪纸利用的就是轴对称。' });
    return list;
  }

  // ============ 题目池：公共 PoolCache（跨调用连续发牌，见 shared/common.js） ============
  var POOL_BUILDERS = {
    circle: poolCircle,
    symmetry: poolSymmetry,
    'rotate-scale': poolRotateScale,
    position: poolPosition,
    shape: poolShape
  };
  function mixPool() {
    return poolCircle().concat(poolSymmetry(), poolRotateScale(), poolPosition(), poolShape());
  }
  var pools = {};
  function poolOf(type) {
    if (!pools[type]) {
      pools[type] = _PU.createPoolCache('math-g6-operation:' + type, function () {
        return type === 'mix' ? mixPool() : (POOL_BUILDERS[type] ? POOL_BUILDERS[type]() : mixPool());
      });
    }
    return pools[type];
  }

  // ============ 综合操作 ============
  function buildMixed() { return poolOf('mix').take(1)[0]; }

  var TYPE_BUILDERS = {
    'circle': function () { return poolOf('circle').take(1)[0]; },
    'symmetry': function () { return poolOf('symmetry').take(1)[0]; },
    'rotate-scale': function () { return poolOf('rotate-scale').take(1)[0]; },
    'position': function () { return poolOf('position').take(1)[0]; },
    'shape': function () { return poolOf('shape').take(1)[0]; },
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'circle': '画圆',
    'symmetry': '轴对称',
    'rotate-scale': '图形的旋转与放大缩小',
    'position': '位置与方向',
    'shape': '圆柱圆锥与组合图形',
    mix: '综合操作'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-operation',
    moduleId: 'M6',
    name: '操作题',
    pageSubtitle: '画圆、轴对称、旋转与放大缩小、位置与方向、圆柱圆锥与组合图形',
    grades: [6],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g6-m6-g6-op-circle',
        'math-g6-m6-g6-op-symmetry',
        'math-g6-m6-g6-op-rotate-scale',
        'math-g6-m6-g6-op-position'
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
          { value: 'position',     label: '位置与方向' },
          { value: 'shape',        label: '圆柱圆锥与组合图形' }
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
        var key = p.q + '|' + (p.svg || '') + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        var q = { type: 'draw', q: p.q, answer: String(p.answer), hint: p.hint, svg: p.svg };
        if (p.options) { q.inputType = 'choice'; q.options = shuffle(p.options.slice()); }
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

  plugin.poolCache = poolOf('mix'); // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
