// shared/svg/svg-chart.js — 统计图表生成器（SVGChart）
//
// 依赖 shared/svg/svg-core.js。输出完整 <svg> 字符串。
// 挂载 SVGGenerators.math.chart.{bar,line,pie,scatter}，供 svg-registry 按
// { type:'chart', subtype, params } 描述符索引。
//
// 描述符参数：
//   bar    { title, xLabel, yLabel, barColor, data:[{label,value}] 或 [{label,a,b}]（复式） }
//   line   { title, data:[{label,value}] }
//   pie    { title, data:[{label,percent}] }           —— percent 为百分数(0~100)
//   scatter{ title, data:[{label,value}] }             —— 单轴点阵散点
//
// 无效/空数据返回 ''（由渲染层空图形兜底），不抛异常。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg/svg-chart.js 依赖 shared/svg/svg-core.js，请先加载');

  var D = U.SVG_DEFAULTS;
  var INK = '#27324a', AXIS = '#8a97ad', GRID = '#e5eaf3';
  var PALETTE = ['#3f6fd1', '#e05252', '#2f9e6b', '#c77f2a', '#7c5cff', '#d9822b'];

  function items(data) {
    return Array.isArray(data) ? data.filter(function (d) { return d && d.label != null; }) : [];
  }
  function num(v) {
    var n = Number(v);
    return isFinite(n) ? n : null;
  }
  function maxOf(list, isMulti) {
    var m = 0;
    list.forEach(function (it) {
      [isMulti ? it.a : it.value].forEach(function (v) {
        var n = num(v);
        if (n != null && n > m) m = n;
      });
      if (isMulti) { var n2 = num(it.b); if (n2 != null && n2 > m) m = n2; }
    });
    return m;
  }
  function titleBox(title) {
    if (!title) return '';
    return U.svgText(10, 18, title, { fontSize: 14, fill: '#5a677d', fontWeight: 700 });
  }

  /** 条形图（单式/复式） */
  function bar(o) {
    var list = items(o && o.data);
    if (!list.length) return '';
    var isMulti = list.some(function (it) { return it.a != null && it.b != null; });
    var maxV = o.yMax != null ? Number(o.yMax) : maxOf(list, isMulti);
    if (!(maxV > 0)) maxV = 1;

    var M = { l: 44, r: 12, t: 30, b: 36 };
    var W = 380, H = 240;
    var plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    var n = list.length;
    var slotW = plotW / n;
    var scale = plotH / maxV;
    var top = M.t;

    var inner = titleBox(o.title);

    // 网格线 + Y 刻度（4 等分）
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var yv = top + plotH - (plotH * t / ticks);
      var lab = (maxV * t / ticks).toFixed(maxV >= 100 ? 0 : 1).replace(/\.0$/, '');
      inner += U.svgLine(M.l, yv, W - M.r, yv, { stroke: GRID, strokeWidth: 1 });
      inner += U.svgText(M.l - 6, yv + 4, lab, { fontSize: 11, fill: AXIS, 'text-anchor': 'end' });
    }

    list.forEach(function (it, i) {
      var cx = M.l + slotW * i + slotW / 2;
      var label = U.svgText(cx, H - M.b + 16, String(it.label), { fontSize: 12, fill: INK, 'text-anchor': 'middle' });
      inner += label;
      if (isMulti) {
        var bw = Math.min(16, slotW * 0.22);
        [['a', PALETTE[0]], ['b', PALETTE[1]]].forEach(function (kv, k) {
          var v = num(it[kv[0]]);
          if (v == null) return;
          var bh = Math.max(0, v * scale);
          if (bh < 1 && v > 0) bh = 1;
          var bx = cx - bw + k * bw * 2;
          inner += U.svgRect(bx, top + plotH - bh, bw, bh, { fill: kv[1], rx: 2 });
          inner += U.svgText(bx + bw / 2, top + plotH - bh - 4, v, { fontSize: 11, fill: kv[1], 'text-anchor': 'middle' });
        });
      } else {
        var v = num(it.value);
        if (v == null) return;
        var bh = Math.max(0, v * scale);
        if (bh < 1 && v > 0) bh = 1;
        var bw = Math.min(28, slotW * 0.55);
        var color = it.color || PALETTE[i % PALETTE.length];
        var bx = cx - bw / 2;
        inner += U.svgRect(bx, top + plotH - bh, bw, bh, { fill: color, rx: 2 });
        inner += U.svgText(cx, top + plotH - bh - 4, v, { fontSize: 11, fill: color, 'text-anchor': 'middle' });
      }
    });

    // 坐标轴
    inner += U.svgLine(M.l, top + plotH, W - M.r, top + plotH, { stroke: AXIS, strokeWidth: 1.4 });
    inner += U.svgLine(M.l, top, M.l, top + plotH, { stroke: AXIS, strokeWidth: 1.4 });
    if (o.yLabel) inner += U.svgText(12, top + 4, o.yLabel, { fontSize: 11, fill: AXIS });

    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 8 });
  }

  /** 折线图 */
  function line(o) {
    var list = items(o && o.data);
    if (!list.length) return '';
    var pts = list.map(function (it) { return { x: it.x, y: num(it.y != null ? it.y : it.value), label: it.label }; });
    var maxV = o.yMax != null ? Number(o.yMax) : maxOf(pts, false);
    if (!(maxV > 0)) maxV = 1;

    var M = { l: 44, r: 14, t: 30, b: 36 };
    var W = 380, H = 240;
    var plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    var n = pts.length;
    var scale = plotH / maxV;
    var top = M.t;
    var pos = pts.map(function (p, i) {
      var x = n === 1 ? M.l + plotW / 2 : M.l + (plotW * i) / (n - 1);
      var y = top + plotH - Math.max(0, p.y) * scale;
      return { x: x, y: y, p: p };
    });

    var inner = titleBox(o.title);
    var ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var yv = top + plotH - (plotH * t / ticks);
      inner += U.svgLine(M.l, yv, W - M.r, yv, { stroke: GRID, strokeWidth: 1 });
      inner += U.svgText(M.l - 6, yv + 4, (maxV * t / ticks).toFixed(0), { fontSize: 11, fill: AXIS, 'text-anchor': 'end' });
    }
    if (pos.length === 1) {
      inner += U.svgCircle(pos[0].x, pos[0].y, 4, { fill: PALETTE[0], stroke: '#fff', strokeWidth: 2 });
      inner += U.svgText(pos[0].x, pos[0].y - 10, String(pos[0].p.y), { fontSize: 11, fill: PALETTE[0], 'text-anchor': 'middle' });
    } else {
      inner += U.svgPolyline(pos.map(function (q) { return [q.x, q.y]; }),
        { fill: 'none', stroke: PALETTE[0], strokeWidth: 2.4, strokeLinejoin: 'round' });
      pos.forEach(function (q) {
        inner += U.svgCircle(q.x, q.y, 4, { fill: PALETTE[0], stroke: '#fff', strokeWidth: 2 });
        inner += U.svgText(q.x, q.y - 10, String(q.p.y), { fontSize: 11, fill: PALETTE[0], 'text-anchor': 'middle' });
      });
    }
    pos.forEach(function (q) {
      inner += U.svgText(q.x, H - M.b + 16, String(q.p.label), { fontSize: 12, fill: INK, 'text-anchor': 'middle' });
    });
    inner += U.svgLine(M.l, top + plotH, W - M.r, top + plotH, { stroke: AXIS, strokeWidth: 1.4 });
    inner += U.svgLine(M.l, top, M.l, top + plotH, { stroke: AXIS, strokeWidth: 1.4 });

    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 8 });
  }

  /** 扇形图（percent 为百分数） */
  function pie(o) {
    var list = items(o && o.data);
    if (!list.length) return '';
    var tot = list.reduce(function (s, it) { return s + Math.max(0, num(it.percent != null ? it.percent : it.value) || 0); }, 0);
    if (!(tot > 0)) return '';

    var cx = 120, cy = 118, R = 82;
    var inner = titleBox(o.title);
    var angle = -90;
    var labelsX = 235, labelY = 46;
    list.forEach(function (it, i) {
      var pct = Math.max(0, num(it.percent != null ? it.percent : it.value) || 0);
      var sweep = (pct / tot) * 360;
      var a1 = angle, a2 = angle + sweep;
      var x1 = cx + R * Math.cos((a1 * Math.PI) / 180), y1 = cy + R * Math.sin((a1 * Math.PI) / 180);
      var x2 = cx + R * Math.cos((a2 * Math.PI) / 180), y2 = cy + R * Math.sin((a2 * Math.PI) / 180);
      var large = sweep > 180 ? 1 : 0;
      var color = it.color || PALETTE[i % PALETTE.length];
      inner += U.svgPath('M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + R + ' ' + R + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z',
        { fill: color, stroke: '#ffffff', strokeWidth: 2 });
      // 图例
      inner += U.svgRect(labelsX, labelY, 12, 12, { fill: color, rx: 2 });
      inner += U.svgText(labelsX + 18, labelY + 11, it.label + ' ' + Math.round(pct) + '%', { fontSize: 12, fill: INK });
      labelY += 22;
      angle = a2;
    });
    return U.svgWrap(inner, { viewBox: '0 0 380 240', width: o.width, padding: 8 });
  }

  /** 散点（单轴点阵），数据同上折线形态 */
  function scatter(o) {
    var list = items(o && o.data);
    if (!list.length) return '';
    var M = { l: 44, r: 14, t: 30, b: 36 };
    var W = 380, H = 240;
    var plotW = W - M.l - M.r, plotH = H - M.t - M.b;
    var n = list.length;
    var maxV = maxOf(list, false);
    if (!(maxV > 0)) maxV = 1;
    var inner = titleBox(o.title);
    inner += U.svgLine(M.l, M.t + plotH, W - M.r, M.t + plotH, { stroke: AXIS, strokeWidth: 1.4 });
    inner += U.svgLine(M.l, M.t, M.l, M.t + plotH, { stroke: AXIS, strokeWidth: 1.4 });
    list.forEach(function (it, i) {
      var x = M.l + (plotW * (i + 0.5)) / n;
      var y = M.t + plotH - Math.max(0, num(it.value) || 0) * (plotH / maxV);
      inner += U.svgCircle(x, y, 5, { fill: PALETTE[i % PALETTE.length], stroke: '#fff', strokeWidth: 1.5 });
      inner += U.svgText(x, H - M.b + 16, String(it.label), { fontSize: 12, fill: INK, 'text-anchor': 'middle' });
    });
    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' ' + H, width: o.width, padding: 8 });
  }

  var SVGChart = { bar: bar, line: line, pie: pie, scatter: scatter };

  global.SVGChart = SVGChart;
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.chart = SVGChart;

  if (typeof module !== 'undefined') module.exports = SVGChart;
})(typeof window !== 'undefined' ? window : global);