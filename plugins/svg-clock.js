/**
 * plugins/svg-clock.js — 时钟 SVG 生成器
 * 迁移自 math-clock.js 的内联 SVG 生成逻辑
 */
(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'function') throw new Error('svg-clock 依赖 SVGUtil');

  var SVGClock = {
    // 模拟钟表：hour 为 1-12，minute 为 0-59
    clockSVG: function (hour, minute, opts) {
      opts = opts || {};
      var size = opts.size || 120;
      var cx = size / 2, cy = size / 2;
      var r = size * 0.45;
      var inner = '';

      // 表盘圆
      inner += U.svgCircle(cx, cy, r, { fill: '#fff', stroke: '#27324a', strokeWidth: 2 });

      // 刻度
      for (var i = 0; i < 60; i++) {
        var angle = i * Math.PI / 30 - Math.PI / 2;
        var isHour = i % 5 === 0;
        var len = isHour ? 16 : 8;
        var x1 = cx + (r - len) * Math.cos(angle);
        var y1 = cy + (r - len) * Math.sin(angle);
        var x2 = cx + r * Math.cos(angle);
        var y2 = cy + r * Math.sin(angle);
        inner += U.svgLine(x1, y1, x2, y2, { strokeWidth: isHour ? 2.5 : 1, stroke: isHour ? '#27324a' : '#8a97ad' });
      }

      // 时针
      var hourAngle = (hour % 12 + minute / 60) * Math.PI / 6 - Math.PI / 2;
      var hr = r * 0.5;
      inner += U.svgLine(cx, cy, cx + hr * Math.cos(hourAngle), cy + hr * Math.sin(hourAngle), { strokeWidth: 4, stroke: '#27324a', strokeLinecap: 'round' });

      // 分针
      var minAngle = minute * Math.PI / 30 - Math.PI / 2;
      var mr = r * 0.8;
      inner += U.svgLine(cx, cy, cx + mr * Math.cos(minAngle), cy + mr * Math.sin(minAngle), { strokeWidth: 2.5, stroke: '#27324a', strokeLinecap: 'round' });

      // 中心点
      inner += U.svgCircle(cx, cy, 4, { fill: '#27324a' });

      // 数字
      for (var h = 1; h <= 12; h++) {
        var a = (h % 12) * Math.PI / 6 - Math.PI / 2;
        var tx = cx + (r - 22) * Math.cos(a);
        var ty = cy + (r - 22) * Math.sin(a) + 5;
        inner += U.svgText(tx, ty, String(h), { fontSize: 14, textAnchor: 'middle', dominantBaseline: 'middle', fontWeight: '700', fill: '#27324a' });
      }

      return U.svgWrap(inner, { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    },

    // 数字钟表
    digitalSVG: function (hour, opts) {
      opts = opts || {};
      var w = opts.width || 160, h = opts.height || 60;
      var str = String(hour).padStart(2, '0') + ':00';
      var inner = U.svgText(opts.padding || 20, h / 2 + 10, str, { fontSize: 36, fontWeight: '700', fill: '#27324a', fontFamily: 'monospace' });
      return U.svgWrap(inner, { width: w, height: h });
    },

    // 钟面（仅表盘，无指针，用于画时钟题目）
    clockFace: function (opts) {
      opts = opts || {};
      var size = opts.size || 120;
      var cx = size / 2, cy = size / 2;
      var r = size * 0.45;
      var inner = '';

      inner += U.svgCircle(size / 2, size / 2, r, { fill: '#fff', stroke: '#27324a', strokeWidth: 2 });

      for (var i = 0; i < 60; i++) {
        var angle = i * Math.PI / 30 - Math.PI / 2;
        var isHour = i % 5 === 0;
        var len = isHour ? 16 : 8;
        var x1 = cx + (r - len) * Math.cos(angle);
        var y1 = cy + (r - len) * Math.sin(angle);
        var x2 = cx + r * Math.cos(angle);
        var y2 = cy + r * Math.sin(angle);
        inner += U.svgLine(x1, y1, x2, y2, { strokeWidth: isHour ? 2.5 : 1, stroke: isHour ? '#27324a' : '#8a97ad' });
      }

      for (var h = 1; h <= 12; h++) {
        var a = (h % 12) * Math.PI / 6 - Math.PI / 2;
        var tx = cx + (r - 22) * Math.cos(a);
        var ty = cy + (r - 22) * Math.sin(a) + 5;
        inner += U.svgText(tx, ty, String(h), { fontSize: 14, textAnchor: 'middle', dominantBaseline: 'middle', fontWeight: '700', fill: '#27324a' });
      }

      return U.svgWrap(inner, { width: size, height: size, viewBox: '0 0 ' + size + ' ' + size });
    }
  };

  // 注册到 SVGGenerators
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.clock = SVGClock;

  if (typeof module !== 'undefined' && module.exports) module.exports = SVGClock;
})(typeof window !== 'undefined' ? window : global);
