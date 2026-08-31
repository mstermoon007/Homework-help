/**
 * plugins/svg-data-stats.js — 统计/图表 SVG 生成器
 * 迁移自 math-data-stats.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-data-stats 依赖 SVGUtil');

  var SVGDataStats = {
    // 柱状图
    barChart: function (data, opts) {
      opts = opts || {};
      var w = opts.width || 400, h = opts.height || 200;
      var margin = { top: 20, right: 20, bottom: 40, left: 40 };
      var innerW = w - margin.left - margin.right;
      var innerH = h - margin.top - margin.bottom;
      var maxVal = Math.max.apply(null, data.map(function(d) { return d.value; }));
      var barW = innerW / data.length * 0.7;
      var gap = innerW / data.length * 0.3;
      var inner = '';

      // Y轴
      inner += U.svgLine(0, 0, 0, innerH, { stroke: '#27324a', strokeWidth: 1 });
      // X轴
      inner += U.svgLine(0, innerH, innerW, innerH, { stroke: '#27324a', strokeWidth: 1 });

      data.forEach(function (d, i) {
        var x = i * (barW + gap) + barW / 2;
        var barH = innerH * (d.value / maxVal);
        var x = i * (barW + gap);
        inner += U.svgRect(x, innerH - barH, barW, barH, { fill: '#5b8def', stroke: '#3d6bc8', strokeWidth: 1 });
        // 标签
        inner += U.svgText(x + barW/2, innerH + 18, d.label || '', { fontSize: 11, textAnchor: 'middle', fill: '#27324a' });
        // 数值
        inner += UsvgText(x + barW/2, innerH - barH - 4, d.value, { fontSize: 11, textAnchor: 'middle', fill: '#27324a', fontWeight: '600' });
      });

      return U.svgWrap(inner, { width: w, height: h });
    },

    // 表格
    tableSVG: function (rows, opts) {
      opts = opts || {};
      var cellW = opts.cellWidth || 80;
      var cellH = opts.cellHeight || 28;
      var cols = opts.columns || (rows[0] ? rows[0].length : 0);
      var rowsCount = rows.length;
      var w = cols * cellW, h = rowsCount * cellH;
      var inner = '';

      for (var r = 0; r < rowsCount; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * cellW, y = r * cellH;
          var isHeader = r === 0;
          inner += U.svgRect(c * cellW, r * cellH, cellW, cellH, {
            fill: isHeader ? '#e8eefc' : '#fff',
            stroke: '#c9d4e6',
            strokeWidth: 1
          });
          var val = rows[r][c] || '';
          inner += U.svgText(c * cellW + cellW/2, r * cellH + cellH/2 + 4, String(val), {
            fontSize: 12, textAnchor: 'middle', dominantBaseline: 'middle',
            fontWeight: isHeader ? '700' : '400', fill: isHeader ? '#27324a' : '#27324a'
          });
        }
      }
      return U.svgWrap(inner, { width: w, height: h });
    },

    // 投票/统计图
    voteChart: function (data, opts) {
      opts = opts || {};
      var w = opts.width || 300, h = opts.height || 160;
      var cx = w / 2, cy = h / 2;
      var r = Math.min(w, h) * 0.35;
      var total = data.reduce(function(s, d) { return s + (d.count || 0); }, 0);
      var inner = '';
      var start = -Math.PI / 2;

      data.forEach(function(d) {
        var angle = (d.count || 0) / total * 2 * Math.PI;
        var a1 = start, a2 = start + angle;
        var x1 = 300 + r * Math.cos(a1), y1 = 150 + r * Math.sin(a1);
        var x2 = 300 + r * Math.cos(a2), y2 = 150 + r * Math.sin(a2);
        var large = angle > Math.PI ? 1 : 0;
        var path = 'M 300 150 L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + (angle > Math.PI ? '1' : '0') + ' 1 ' + x2 + ' ' + y2 + ' Z';
        inner += U.svgPath(path, { fill: d.color || '#5b8def', stroke: '#fff', strokeWidth: 1 });
        start = a2;
      });

      return U.svgWrap(inner, { width: w, height: h });
    }
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.dataStats = SVGDataStats;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGDataStats;
})(typeof window !== 'undefined' ? window : global);
