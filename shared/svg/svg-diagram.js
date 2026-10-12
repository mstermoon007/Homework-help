// shared/svg/svg-diagram.js — 看图列式示意图生成器（SVGDiagram）
//
// 依赖 shared/svg/svg-core.js。输出完整 <svg> 字符串。
// 挂载 SVGGenerators.math.diagram.{brace,segment,balance,scale,pattern}。
//
// 描述符参数：
//   brace    { left, right, unit, leftLabel?, rightLabel?, totalLabel? }  大括号合整体
//   segment  { total, part, unit, totalLabel?, partLabel?, otherLabel? }  线段图（未知段留 ?）
//   balance  { left, leftLabel, rightUnknown, rightLabel, unit?, weightLabel? } 天平平衡
//   scale    { scale, mapDist, ratioLabel? }                              比例尺
//   pattern  { pattern, times? }                                          周期排列（P31-FIX-05）
//   groups   { boxes, boxText, topText } | { dots, topText }              份数组图（P38 断链修复）
//   ratio    { rows:[{label, text, parts}] }                              成比例条形图（P38 断链修复）
//
// 无效参数返回 ''（不抛异常）。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg/svg-diagram.js 依赖 shared/svg/svg-core.js，请先加载');

  var D = U.SVG_DEFAULTS;
  var INK = '#27324a', BLUE = '#3f6fd1', ORANGE = '#d9822b', RED = '#e05252', AXIS = '#8a97ad';

  /** 大括号合体（左右两组 + 顶部总括线 + 问号） */
  function brace(o) {
    var a = Math.max(0, Number(o.left) || 0);
    var b = Math.max(0, Number(o.right) || 0);
    if (a <= 0 && b <= 0) return '';
    var unit = o.unit || '';

    var W = 380, groupH = 58, yGroup = 58;
    var geW = 130, gapW = 26;
    var xa = 30, xb = xa + geW + gapW;
    var yAppleY0 = yGroup + groupH + 14, applePitch = 26;
    var showTotal = o.totalLabel !== false;

    var inner = '';
    // 组框 + 数量居中
    [[xa, a, (o.leftLabel != null ? o.leftLabel : a) + unit, BLUE],
     [xb, b, (o.rightLabel != null ? o.rightLabel : b) + unit, ORANGE]].forEach(function (g) {
      var bx = g[0];
      inner += U.svgRect(bx, yGroup, geW, groupH, { fill: '#ffffff', stroke: g[3], strokeWidth: 2, rx: 6 });
      inner += U.svgText(bx + geW / 2, yGroup + groupH / 2 + 6, g[2], { fontSize: 22, fill: g[3], 'text-anchor': 'middle', fontWeight: 700 });
    });
    // 底部小图（苹果，最多画 10 个避免拥挤）
    [[xa, a, BLUE], [xb, b, ORANGE]].forEach(function (g) {
      var val = g[1];
      var maxShow = Math.min(val, 10);
      var cols = 10;
      for (var k = 0; k < maxShow; k++) {
        inner += U.svgCircle(g[0] + 14 + (k % cols) * 12, yAppleY0 + Math.floor(k / cols) * 20, 5, { fill: g[2] });
      }
    });
    // 顶部总括线（两框之上）+ 问号
    if (showTotal) {
      var xc = (xa + xb + geW) / 2, yTop = yGroup - 24, y0 = yGroup - 14;
      inner += U.svgElement('g', {
        stroke: INK, strokeWidth: 1.8, fill: 'none'
      }, [
        U.svgPath('M ' + xa + ' ' + y0 + ' L ' + xa + ' ' + yTop + ' L ' + (xc - 9) + ' ' + yTop +
          ' L ' + (xc - 9) + ' ' + (yTop + 6) + ' L ' + (xc + 9) + ' ' + (yTop + 6) + ' L ' + (xc + 9) + ' ' + yTop +
          ' L ' + (xa + geW + gapW + geW) + ' ' + yTop + ' L ' + (xa + geW + gapW + geW) + ' ' + y0 + ' Z'),
        U.svgText(xc, yGroup - 38, '？', { stroke: 'none', fill: RED, fontSize: 22, fontWeight: 700, 'text-anchor': 'middle' })
      ]);
    }
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' 190', width: o.width, padding: 12 });
  }

  /** 线段图：total 分段，part 已知，另一段留 ? */
  function segment(o) {
    var total = Math.max(0, Number(o.total) || 0);
    var part = Math.max(0, Number(o.part) || 0);
    if (total <= 0) return '';
    var unit = o.unit || '';
    var other = Math.max(0, total - part);
    var W = 380, y = 92;
    var x0 = 24, x1 = W - 24, L = x1 - x0;
    var lenPart = total > 0 ? (Math.min(part, total) / total) * L : 0;

    var inner = '';
    // 主线段
    inner += U.svgLine(x0, y, x1, y, { stroke: INK, strokeWidth: 3 });
    // 分隔点
    var midX = x0 + Math.min(L, lenPart);
    inner += U.svgLine(midX, y - 12, midX, y + 12, { stroke: INK, strokeWidth: 2 });
    // 第一部分标注
    inner += U.svgPath('M ' + x0 + ' ' + (y - 46) + ' L ' + x0 + ' ' + (y - 36) + ' L ' + midX + ' ' + (y - 36) + ' L ' + midX + ' ' + (y - 46), { stroke: BLUE, strokeWidth: 1.6, fill: 'none' });
    inner += U.svgText((x0 + midX) / 2, y - 32, (o.partLabel != null ? o.partLabel : part) + unit, { fontSize: 13, fill: BLUE, 'text-anchor': 'middle' });
    // 第二部分问号
    inner += U.svgPath('M ' + midX + ' ' + (y + 12) + ' L ' + midX + ' ' + (y + 32) + ' L ' + x1 + ' ' + (y + 32) + ' L ' + x1 + ' ' + (y + 12), { stroke: ORANGE, strokeWidth: 1.6, fill: 'none' });
    inner += U.svgText((midX + x1) / 2, y + 47, (o.otherLabel != null ? o.otherLabel : '?'), { fontSize: 14, fill: RED, 'text-anchor': 'middle', fontWeight: 700 });
    // 总括线
    inner += U.svgPath('M ' + x0 + ' ' + (y + 62) + ' L ' + x0 + ' ' + (y + 58) + ' L ' + x1 + ' ' + (y + 58) + ' L ' + x1 + ' ' + (y + 62), { stroke: INK, strokeWidth: 1.6, fill: 'none' });
    inner += U.svgText((x0 + x1) / 2, y + 78, (o.totalLabel != null ? o.totalLabel : total) + unit, { fontSize: 13, fill: INK, 'text-anchor': 'middle' });

    void other;
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' 190', width: o.width, padding: 10 });
  }

  /** P31-FIX-05：周期排列图——一组图形重复 times 次 + 省略号 + 未知位置问号 */
  function pattern(o) {
    var shapes = String(o.pattern || '').replace(/[\s，、,]/g, '').split('');
    if (!shapes.length) return '';
    var times = Math.max(1, Math.min(4, Number(o.times) || 2));
    var W = 380, y = 92;
    var cells = shapes.length * times + 2;
    var pitch = (W - 48) / cells;
    var inner = '';
    var x = 24 + pitch / 2;
    for (var r = 0; r < times; r++) {
      for (var s = 0; s < shapes.length; s++) {
        inner += U.svgText(x, y, shapes[s], { fontSize: 24, fill: INK, 'text-anchor': 'middle', fontWeight: 700 });
        x += pitch;
      }
    }
    // 省略号（延续）+ 未知位置（红问号，与 segment 图 ? 同色语义）
    inner += U.svgText(x, y, '…', { fontSize: 24, fill: AXIS, 'text-anchor': 'middle' });
    x += pitch;
    inner += U.svgText(x, y, '?', { fontSize: 28, fill: RED, 'text-anchor': 'middle', fontWeight: 700 });
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' 150', width: o.width, padding: 10 });
  }

  /** 天平平衡：左边重量已知，右边未知 + 补偿 */
  function balance(o) {
    var left = Math.max(0, Number(o.left) || 0);
    if (left <= 0) return '';
    var W = 380, H = 200;
    var cx = W / 2, beamY = 62;
    var cupY = 92, cupW = 84;
    var xL = cx - 118, xR = cx + 34;
    var inner = '';
    // 支架
    inner += U.svgLine(cx, beamY, cx, H - 24, { stroke: INK, strokeWidth: 3 });
    var foot = cx - 30;
    inner += U.svgLine(foot, H - 24, cx + 30, H - 24, { stroke: INK, strokeWidth: 3 });
    // 横梁与吊绳
    inner += U.svgLine(cx - 132, beamY, cx + 132, beamY, { stroke: INK, strokeWidth: 3 });
    inner += U.svgLine(xL + cupW / 2, beamY, xL + cupW / 2, cupY, { stroke: AXIS, strokeWidth: 1.4 });
    inner += U.svgLine(xR + cupW / 2, beamY, xR + cupW / 2, cupY, { stroke: AXIS, strokeWidth: 1.4 });
    // 托盘
    [xL, xR].forEach(function (bx) {
      inner += U.svgRect(bx, cupY, cupW, 16, { fill: '#f4f6fb', stroke: INK, strokeWidth: 1.6, rx: 4 });
    });
    // 左：数值；右：unknown + ?（补偿）
    var uk = Math.max(0, Number(o.rightUnknown) || 0);
    inner += U.svgText(xL + cupW / 2, cupY - 12, (o.leftLabel != null ? o.leftLabel : left) + (o.unit || ''), { fontSize: 18, fill: BLUE, 'text-anchor': 'middle', fontWeight: 700 });
    inner += U.svgText(xR + cupW / 2, cupY - 12, (o.rightLabel != null ? o.rightLabel : (uk + ' + ?')) + (o.unit || ''), { fontSize: 18, fill: ORANGE, 'text-anchor': 'middle', fontWeight: 700 });
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 10 });
  }

  /** 比例尺：地图线段 + 实际距离换算标注 */
  function scale(o) {
    var s = Math.max(1, Number(o.scale) || 1);
    var mapDist = Math.max(0, Number(o.mapDist) || 0);
    var W = 380, y = 120;
    var x0 = 30, x1 = W - 30, L = x1 - x0;
    var seg = mapDist > 0 ? Math.min(1, mapDist / Math.max(mapDist, 1)) * 0.6 : 0;
    var inner = '';
    // 地图段
    inner += U.svgLine(x0, y, x1, y, { stroke: INK, strokeWidth: 3 });
    inner += U.svgText((x0 + seg * L), y - 40, o.mapLabel != null ? o.mapLabel : (mapDist + 'cm'), { fontSize: 13, fill: BLUE, 'text-anchor': 'middle' });
    // 已知地图比例
    inner += U.svgText(x0 + (seg * L) / 2, y - 14, '图上 ' + (mapDist || '1') + 'cm', { fontSize: 12, fill: AXIS, 'text-anchor': 'middle' });
    // 实际距离线
    inner += U.svgLine(x0, y, x0 + seg * L, y, { stroke: ORANGE, strokeWidth: 6, opacity: 0.85 });
    inner += U.svgRect(x0, y - 7, seg * L, 14, { fill: 'none', stroke: ORANGE, strokeWidth: 1.2 });
    inner += U.svgText(x0 + (seg * L) / 2, y + 30, '比例尺 1:' + s, { fontSize: 13, fill: INK, 'text-anchor': 'middle' });
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' 180', width: o.width, padding: 10 });
  }

  /**
   * P38 断链修复：份数组图——表达「每份数 × 份数 = 总量」语义。
   *  盒子模式 { boxes, boxText, topText }：boxes=盒子数（1..8），boxText=盒内标注
   *    （纯数字 1..10 画圆点，否则画文字），topText=顶部总括标注。
   *  散点模式 { dots, topText }：dots=散点总数（份数未知、仅示总量）。
   *  topText 为 '?' 时渲染红色问号（与 brace/segment/pattern 问号同色语义）。
   */
  function groups(o) {
    var topText = o.topText != null ? String(o.topText) : '?';
    var W = 380, yBox = 56, boxH = 52;
    var inner = '', H = 150;

    if (o.dots != null) {
      var dots = Math.floor(Number(o.dots) || 0);
      if (dots <= 0) return '';
      var perRow = Math.min(10, dots);
      var rows = Math.ceil(dots / perRow);
      var pitch = (W - 48) / perRow;
      for (var i = 0; i < dots; i++) {
        var rr = Math.floor(i / perRow), cc = i % perRow;
        inner += U.svgCircle(24 + pitch * (cc + 0.5), yBox + 16 + rr * 22, 6, { fill: INK });
      }
      H = yBox + 16 + (rows - 1) * 22 + 30;
    } else {
      var n = Math.floor(Number(o.boxes) || 0);
      if (n < 1) return '';
      n = Math.min(n, 8);
      var gap = 14;
      var boxW = Math.min(70, (W - 48 - gap * (n - 1)) / n);
      var totalW = boxW * n + gap * (n - 1);
      var x0 = (W - totalW) / 2;
      var label = String(o.boxText != null ? o.boxText : '');
      var isDot = /^\d+$/.test(label) && Number(label) >= 1 && Number(label) <= 10;
      for (var b = 0; b < n; b++) {
        var bx = x0 + b * (boxW + gap);
        inner += U.svgRect(bx, yBox, boxW, boxH, { fill: '#ffffff', stroke: BLUE, strokeWidth: 2, rx: 6 });
        if (isDot) {
          var cnt = Number(label);
          var pc = Math.min(cnt, 5), pr = Math.ceil(cnt / 5);
          var dp = Math.min(boxW / 6, 14);
          for (var d = 0; d < cnt; d++) {
            var dc = d % pc, dr = Math.floor(d / pc);
            inner += U.svgCircle(bx + boxW / 2 - (pc - 1) * dp / 2 + dc * dp,
              yBox + boxH / 2 - (pr - 1) * dp / 2 + dr * dp, 4, { fill: BLUE });
          }
        } else {
          inner += U.svgText(bx + boxW / 2, yBox + boxH / 2 + 6, label,
            { fontSize: 18, fill: ORANGE, 'text-anchor': 'middle', fontWeight: 700 });
        }
      }
    }

    var isQ = topText === '?';
    var x1 = 60, x2 = W - 60, yc = yBox - 22;
    inner += U.svgPath('M ' + x1 + ' ' + (yc + 10) + ' L ' + x1 + ' ' + yc +
      ' L ' + x2 + ' ' + yc + ' L ' + x2 + ' ' + (yc + 10), { stroke: INK, strokeWidth: 1.6, fill: 'none' });
    inner += U.svgText((x1 + x2) / 2, yc - 8, isQ ? '？' : topText,
      { fontSize: 20, fill: isQ ? RED : INK, 'text-anchor': 'middle', fontWeight: isQ ? 700 : 400 });
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 10 });
  }

  /**
   * P38 断链修复：成比例条形图——表达「两种量成比例（正/反比例）」语义。
   *  { rows:[{label, text, parts}] }：label=行名，text=行值（'?' 渲染红色问号），
   *  parts=条长权重（≥0，条宽 ∝ parts/max）。
   */
  function ratio(o) {
    var rows = (Array.isArray(o.rows) ? o.rows : []).filter(function (r) {
      return r && Number(r.parts) > 0;
    });
    if (rows.length < 2) return '';
    var max = Math.max.apply(null, rows.map(function (r) { return Number(r.parts) || 0; }));
    if (!(max > 0)) return '';
    var W = 380, labelW = 64, valueW = 70;
    var barMax = W - labelW - valueW - 24;
    var rowH = 46, y0 = 30;
    var inner = '';
    rows.forEach(function (r, i) {
      var y = y0 + i * rowH;
      var bw = Math.max(14, (Number(r.parts) / max) * barMax);
      var isQ = String(r.text) === '?';
      inner += U.svgText(0, y + 20, String(r.label || ''), { fontSize: 14, fill: INK, 'text-anchor': 'start' });
      inner += U.svgRect(labelW, y, bw, 26, { fill: i % 2 ? '#fdf0e2' : '#eaf0fb', stroke: i % 2 ? ORANGE : BLUE, strokeWidth: 1.6, rx: 4 });
      inner += U.svgText(labelW + bw + 10, y + 20, isQ ? '？' : String(r.text),
        { fontSize: 17, fill: isQ ? RED : INK, 'text-anchor': 'start', fontWeight: isQ ? 700 : 400 });
    });
    var H = y0 + rows.length * rowH;
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 10 });
  }

  var SVGDiagram = { brace: brace, segment: segment, balance: balance, scale: scale, pattern: pattern,
    groups: groups, ratio: ratio };

  global.SVGDiagram = SVGDiagram;
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.diagram = SVGDiagram;

  if (typeof module !== 'undefined') module.exports = SVGDiagram;
})(typeof window !== 'undefined' ? window : global);