/**
 * 数学练习页公共 JS
 * 由 math-unit-convert / math-number-sense / math-measurement / math-geometry 共享
 *
 * 目前承载跨页复用的 SVG 辅助函数。原本 clockSVG 在 unit-convert 与 measurement
 * 两页各自实现且不一致，现统一为单一定义，避免漂移。
 *
 * 用法：<script src="shared/math-common.js"></script>
 *      页面生成器内直接调用 clockSVG(hour, minute)
 */
(function (global) {
  'use strict';

  /**
   * 统一的时钟 SVG。
   * @param {number} hour   12 小时制小时（0~12，自动 %12）
   * @param {number} minute 分钟（默认 0）
   * @returns {string} SVG 字符串
   */
  function clockSVG(hour, minute) {
    hour = ((hour % 12) + 12) % 12;
    minute = minute || 0;
    var cx = 50, cy = 50, r = 44;
    var hAngle = ((hour % 12) * 30 + minute * 0.5 - 90) * Math.PI / 180;
    var mAngle = (minute * 6 - 90) * Math.PI / 180;
    var hx = cx + r * 0.5 * Math.cos(hAngle);
    var hy = cy + r * 0.5 * Math.sin(hAngle);
    var mx = cx + r * 0.78 * Math.cos(mAngle);
    var my = cy + r * 0.78 * Math.sin(mAngle);

    // 刻度（整点更长）
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = (i * 30 - 90) * Math.PI / 180;
      var r1 = (i % 3 === 0) ? 38 : 41;
      ticks += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#9aa6bd" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }

    function numeral(n, x, y) {
      return '<text x="' + x + '" y="' + y + '" text-anchor="middle" font-size="10" fill="#7a879c" font-weight="700">' + n + '</text>';
    }

    return '<svg class="clock-svg" width="120" height="120" viewBox="0 0 100 100">' +
      '<circle cx="50" cy="50" r="44" fill="#fff" stroke="#5b8def" stroke-width="3"/>' +
      ticks +
      '<circle cx="50" cy="50" r="2" fill="#5b8def"/>' +
      '<line x1="50" y1="50" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#27324a" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="50" y1="50" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#5b8def" stroke-width="2.5" stroke-linecap="round"/>' +
      numeral('12', 50, 12) + numeral('3', 86, 54) + numeral('6', 50, 96) + numeral('9', 14, 54) +
      '</svg>';
  }

  // 暴露为全局，供页面生成器直接调用
  global.clockSVG = clockSVG;
})(typeof window !== 'undefined' ? window : this);
