/**
 * plugins/svg-competition.js — 竞赛/数字谜题 SVG 生成器
 * 迁移自 math-competition-*.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-competition 依赖 SVGUtil');

  var SVGCompetition = {
    // 数字谜题网格
    numberPuzzle: function (grid, opts) {
      opts = opts || {};
      var cell = opts.cell || 40;
      var rows = grid.length, cols = grid[0].length;
      var w = cols * cell, h = rows * cell;
      var inner = '';

      for (var r = 0; r <= rows; r++) {
        inner += U.svgLine(0, r * cell, cols * cell, r * cell, { strokeWidth: 1.5, stroke: '#27324a' });
      }
      for (var c = 0; c <= cols; c++) {
        inner += U.svgLine(c * cell, 0, c * cell, rows * cell, { strokeWidth: 1.5, stroke: '#27324a' });
      }

      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var val = grid[r][c];
          if (val != null && val !== '') {
            var cx = c * cell + cell / 2;
            var cy = r * cell + cell / 2;
            inner += U.svgText(cx, cy + 5, String(val), { fontSize: 18, textAnchor: 'middle', dominantBaseline: 'middle', fontWeight: '700', fill: '#27324a' });
          }
        }
      }
      return U.svgWrap(inner, { width: w, height: h });
    },

    // 逻辑推理图
    logicGrid: function (data, opts) {
      opts = opts || {};
      return U.svgWrap('<text x="10" y="20" font-size="12" fill="#888">逻辑图</text>', { width: 200, height: 100 });
    }
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.competition = SVGCompetition;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGCompetition;
})(typeof window !== 'undefined' ? window : global);
