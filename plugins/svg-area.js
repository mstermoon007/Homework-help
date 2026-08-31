/**
 * plugins/svg-area.js — 面积/几何 SVG 生成器
 * 迁移自 math-area.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-area 依赖 SVGUtil');

  function px(v, opt) { return v * ((opt && opt.unitPx) || 30); }
  function mergeDash(o) { return o && o.dashed ? { strokeDasharray: '6 4' } : {}; }

  var SVGArea = {
    // 长方形
    rectSVG: function (len, wid, opts) {
      opts = opts || {};
      var w = px(len, opts), h = px(wid, opts);
      var inner = U.svgRect(0, 0, w, h, mergeDash(opts));
      return U.svgWrap(inner, Object.assign({ padding: 12 }, opts.wrap));
    },

    // 正方形
    squareSVG: function (side, opts) {
      opts = opts || {};
      var s = px(side, opts);
      var inner = U.svgRect(0, 0, s, s, mergeDash(opts));
      return U.svgWrap(inner, Object.assign({ padding: 12 }, opts.wrap));
    },

    // 网格
    gridSVG: function (rows, cols, opts) {
      opts = opts || {};
      var cell = opts.cell || 24;
      var w = cols * cell, h = rows * cell;
      var inner = '';
      for (var r = 0; r <= rows; r++) {
        inner += U.svgLine(0, r * cell, cols * cell, r * cell, { strokeWidth: 1, stroke: '#8a97ad' });
      }
      for (var c = 0; c <= cols; c++) {
        inner += U.svgLine(c * cell, 0, c * cell, rows * cell, { strokeWidth: 1, stroke: '#8a97ad' });
      }
      return U.svgWrap(inner, Object.assign({ padding: 10 }, opts.wrap));
    }
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.area = SVGArea;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGArea;
})(typeof window !== 'undefined' ? window : global);
