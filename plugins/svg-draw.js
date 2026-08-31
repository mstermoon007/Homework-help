/**
 * plugins/svg-draw.js — 绘图/量角器/作图 SVG 生成器
 * 迁移自 math-g4-draw.js、math-g1-operation.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-draw 依赖 SVGUtil');

  var SVGDraw = {
    // 量角器
    protractorSVG: function (opts) {
      opts = opts || {};
      var size = opts.size || 200;
      var cx = size / 2, cy = size;
      var r = size * 0.45;
      var inner = '';

      // 半圆弧
      inner += U.svgPath(
        'M ' + (cx - r) + ' ' + cy + ' A ' + r + ' ' + r + ' 0 0 1 ' + (cx + r) + ' ' + cy,
        { fill: 'none', stroke: '#27324a', strokeWidth: 2 }
      );

      // 刻度
      for (var i = 0; i <= 180; i += 10) {
        var angle = (180 - i) * Math.PI / 180;
        var isMajor = i % 30 === 0;
        var len = isMajor ? 20 : 10;
        var x1 = cx + (r - len) * Math.cos(i * Math.PI / 180);
        var y1 = cy + (r - len) * Math.sin(i * Math.PI / 180);
        var x2 = cx + r * Math.cos(i * Math.PI / 180);
        var y2 = cy + r * Math.sin(i * Math.PI / 180);
        inner += U.svgLine(x1, y1, x2, y2, {
          strokeWidth: i % 30 === 0 ? 2 : 1,
          stroke: i % 30 === 0 ? '#27324a' : '#8a97ad'
        });
        if (i % 30 === 0) {
          var tx = cx + (r - 30) * Math.cos(i * Math.PI / 180);
          var ty = cy + (r - 30) * Math.sin(i * Math.PI / 180) + 4;
          inner += U.svgText(tx, ty, String(i), { fontSize: 11, textAnchor: 'middle', dominantBaseline: 'middle', fill: '#27324a' });
        }
      }
      return U.svgWrap(inner, { width: size, height: size / 2 + 20, viewBox: '0 0 ' + size + ' ' + (size / 2 + 20) });
    },

    // 角度演示
    angleDemoSVG: function (angle, opts) {
      opts = opts || {};
      var size = opts.size || 160;
      var cx = size / 2, cy = size / 2;
      var r = size * 0.35;
      var inner = '';

      // 两条射线
      var a1 = -Math.PI / 2;
      var a2 = -Math.PI / 2 + angle * Math.PI / 180;
      inner += U.svgLine(cx, cy, cx + r * 1.5 * Math.cos(a1), cy + r * 1.5 * Math.sin(a1), { strokeWidth: 2, stroke: '#5b8def' });
      inner += U.svgLine(cx, cy, cx + r * 1.5 * Math.cos(a2), cy + r * 1.5 * Math.sin(a2), { strokeWidth: 2, stroke: '#e8870a' });

      // 角度弧
      var arcR = 40;
      var aStart = -Math.PI / 2;
      var aEnd = a2;
      var x1 = cx + arcR * Math.cos(aStart), y1 = cy + arcR * Math.sin(aStart);
      var x2 = cx + arcR * Math.cos(aEnd), y2 = cy + arcR * Math.sin(aEnd);
      var large = angle > 180 ? 1 : 0;
      inner += U.svgPath(
        'M ' + x1 + ' ' + y1 + ' A ' + arcR + ' ' + arcR + ' 0 0 1 ' + x2 + ' ' + y2,
        { fill: 'none', stroke: '#e8870a', strokeWidth: 2 }
      );
      // 角度标注
      var mid = (aStart + aEnd) / 2;
      inner += U.svgText(cx + (arcR + 18) * Math.cos(mid), cy + (arcR + 18) * Math.sin(mid) + 4,
        angle + '°', { fontSize: 14, textAnchor: 'middle', dominantBaseline: 'middle', fill: '#e8870a', fontWeight: '700' });

      return U.svgWrap(inner, { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    },

    // 图形分类（正方形、圆、三角形等）
    classifySVG: function (shapes, opts) {
      opts = opts || {};
      var cell = opts.cell || 60;
      var cols = Math.min(shapes.length, 4);
      var rows = Math.ceil(shapes.length / cols);
      var w = cols * cell, h = rows * cell;
      var inner = '';

      shapes.forEach(function (s, i) {
        var col = i % cols, row = Math.floor(i / cols);
        var cx = col * cell + cell / 2;
        var cy = row * cell + cell / 2;
        var r = cell * 0.35;

        switch (s.type) {
          case 'square':
            inner += U.svgRect(cx - r, cy - r, 2 * r, 2 * r, { strokeWidth: 2, stroke: '#27324a', fill: 'none' });
            break;
          case 'circle':
            inner += U.svgCircle(cx, cy, r, { strokeWidth: 2, stroke: '#27324a', fill: 'none' });
            break;
          case 'triangle':
            inner += U.svgPolyline([[cx, cy - r], [cx - r * 0.87, cy + r * 0.5], [cx + r * 0.87, cy + r * 0.5], [cx, cy - r]], { strokeWidth: 2, stroke: '#27324a', fill: 'none' });
            break;
          case 'rectangle':
            inner += U.svgRect(cx - r * 1.3, cy - r, 2 * r * 1.3, 2 * r, { strokeWidth: 2, stroke: '#27324a', fill: 'none' });
            break;
        }
        // 标签
        inner += U.svgText(cx, cy + r + 18, s.label || s.type, { fontSize: 11, textAnchor: 'middle', fill: '#555' });
      });

      return U.svgWrap(inner, { width: w, height: h });
    }
  };

  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.draw = SVGDraw;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGDraw;
})(typeof window !== 'undefined' ? window : global);
