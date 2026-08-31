/**
 * plugins/svg-fraction.js — 分数/分数运算 SVG 生成器
 * 迁移自 math-fraction.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-fraction 依赖 SVGUtil');

  var SVGFraction = {
    // 分数圆盘：num/den
    fractionCircle: function (num, den, opts) {
      opts = opts || {};
      var size = opts.size || 120;
      var cx = size / 2, cy = size / 2;
      var r = size * 0.4;
      var inner = '';
      var angleStep = 2 * Math.PI / den;
      for (var i = 0; i < den; i++) {
        var a1 = i * 2 * Math.PI / den - Math.PI / 2;
        var a2 = (i + 1) * 2 * Math.PI / den - Math.PI / 2;
        var fill = i < num ? '#5b8def' : '#e8eefc';
        var x1 = cx + r * Math.cos(a1);
        var y1 = cy + r * Math.sin(a1);
        var x2 = cx + r * Math.cos(a2);
        var y2 = cy + r * Math.sin(a2);
        var path = 'M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2 + ' Z';
        inner += U.svgPath(path, { fill: fill, stroke: '#fff', strokeWidth: 1 });
      }
      inner += U.svgCircle(cx, cy, 8, { fill: '#fff' });
      return U.svgWrap(inner, { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    },

    // 分数条形：num/den
    fractionBar: function (num, den, opts) {
      opts = opts || {};
      var w = opts.width || 200, h = opts.height || 40;
      var unitW = w / den;
      var inner = '';
      for (var i = 0; i < den; i++) {
        var x = i * (w / den);
        var fill = i < num ? '#5b8def' : '#e8eefc';
        inner += U.svgRect(x, 0, unitW, h, { fill: fill, stroke: '#fff', strokeWidth: 1 });
      }
      inner += U.svgRect(0, 0, w, h, { fill: 'none', stroke: '#27324a', strokeWidth: 2 });
      return U.svgWrap(inner, { width: w, height: h });
    }
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.fraction = SVGFraction;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGFraction;
})(typeof window !== 'undefined' ? window : global);
