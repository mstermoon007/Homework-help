// shared/svg-make-ten.js — 凑十 / 平十 / 破十 图解生成器（SVGMakeTen）
//
// 依赖 shared/svg-core.js。输出完整 <svg> 字符串（可直接赋给 q.svg），
// 无效数字组合返回 null（由调用方回退普通口算题）。
//
// API：
//   SVGMakeTen.makeTen(9, 5)   凑十：5=1+4 → 9+1=10 → 10+4=14
//   SVGMakeTen.pingTen(15, 8)  平十：8=5+3 → 15−5=10 → 10−3=7
//   SVGMakeTen.poTen(15, 8)    破十：15=10+5 → 10−8=2 → 2+5=7
//
// 颜色约定：原式墨色、凑整/拆分蓝、剩余橙、结果红。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg-make-ten.js 依赖 shared/svg-core.js，请先加载');

  var INK = '#27324a', BLUE = '#3f6fd1', ORANGE = '#d9822b', RED = '#e05252';

  function intIn(n, lo, hi) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi;
  }
  /** 彩色行：segs=[[text,color],...] */
  function segLine(segs, x, y, fs) {
    var spans = segs.filter(function (s) { return s[0] !== ''; })
      .map(function (s) { return U.svgElement('tspan', { fill: s[1] }, s[0]); });
    return U.svgElement('text', {
      x: x, y: y, 'font-size': fs || 22, 'font-family': D_FONT(),
      'text-anchor': 'middle', 'font-weight': 700
    }, spans);
  }
  function D_FONT() { return (global.SVGUtil.SVG_DEFAULTS || {}).fontFamily || 'Menlo, monospace'; }

  // ============ 步骤计算 ============
  function makeTenSteps(a, b) {
    if (!intIn(a, 1, 10) || !intIn(b, 1, 10) || a + b <= 10) return null;
    var c1 = 10 - a, c2 = b - c1;          // 把 b 拆为 c1(凑十) + c2(剩)
    if (c1 <= 0 || c2 <= 0) return null;
    return {
      title: '凑十法',
      lines: [
        [[a + ' + ' + b + ' = ?', INK]],
        [[b + ' = ', INK], [c1 + '', BLUE], [' + ', INK], [c2 + '', ORANGE]],
        [['(', INK], [a + ' + ' + c1, BLUE], [') ＋ ', INK], [c2 + '', ORANGE]],
        [['= 10 + ' + c2 + ' = ', INK], [(a + b) + '', RED]]
      ],
      answer: a + b
    };
  }
  function pingTenSteps(a, b) {
    var ones = a % 10;
    if (!intIn(a, 11, 18) || !intIn(b, 2, 9)) return null;
    var p1 = ones, p2 = b - p1;
    if (p2 <= 0) return null;              // 平十要求减数大于个位
    return {
      title: '平十法',
      lines: [
        [[a + ' - ' + b + ' = ?', INK]],
        [[b + ' = ', INK], [p1 + '', BLUE], [' + ', INK], [p2 + '', ORANGE]],
        [['(', INK], [a + ' - ' + p1, BLUE], [') - ', INK], [p2 + '', ORANGE]],
        [['= 10 - ' + p2 + ' = ', INK], [(a - b) + '', RED]]
      ],
      answer: a - b
    };
  }
  function poTenSteps(a, b) {
    var r = a - 10;
    if (!intIn(a, 10, 19) || !intIn(b, 1, 10)) return null;
    if (a - b < 0) return null;
    return {
      title: '破十法',
      lines: [
        [[a + ' - ' + b + ' = ?', INK]],
        [[a + ' = ', INK], ['10', BLUE], [' + ', INK], [r + '', ORANGE]],
        [['(', INK], ['10 - ' + b, BLUE], [') ＋ ', INK], [r + '', ORANGE]],
        [['= ' + (10 - b) + ' + ' + r + ' = ', INK], [(a - b) + '', RED]]
      ],
      answer: a - b
    };
  }

  // ============ 渲染 ============
  // 步骤动画（任务：SVG 细化）：opts.animate=true 时逐行淡入（内嵌 <style> + 类延迟），
  // 纯 CSS 实现、无 JS；printMode（打印/预览）强制静态；prefers-reduced-motion 自动关闭。
  var MT_ANIM_STYLE = '<style>' +
    '@keyframes mtFadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}' +
    '.mt-step{opacity:0;animation:mtFadeIn .5s ease-out forwards}' +
    '@media (prefers-reduced-motion:reduce){.mt-step{animation:none;opacity:1}}' +
    '</style>';

  function render(steps, opts) {
    if (!steps) return null;
    opts = opts || {};
    var fs = opts.fontSize || 22, lh = fs * 1.55;
    var rows = [];
    if (steps.title !== false) {
      rows.push(U.svgText(150, 26, (opts.title || steps.title),
        { fontSize: 15, fill: '#7a879c', 'text-anchor': 'middle', fontWeight: 700 }));
    }
    var y0 = steps.title === false ? 34 : 58;
    var animate = !!opts.animate && !opts.printMode;
    steps.lines.forEach(function (segs, i) {
      var lineSvg = segLine(segs, 150, y0 + i * lh, fs);
      if (animate) {
        lineSvg = U.svgElement('g', { 'class': 'mt-step',
          style: 'animation-delay:' + (i * 0.45).toFixed(2) + 's' }, lineSvg);
      }
      rows.push(lineSvg);
    });
    var h = y0 + steps.lines.length * lh;
    return U.svgWrap((animate ? MT_ANIM_STYLE : '') + rows.join(''),
      { viewBox: '0 0 300 ' + h, width: opts.width || 300, height: h, printMode: opts.printMode });
  }

  function makeTen(a, b, opts) { return render(makeTenSteps(a, b), opts); }
  function pingTen(a, b, opts) { return render(pingTenSteps(a, b), opts); }
  function poTen(a, b, opts) { return render(poTenSteps(a, b), opts); }

  global.SVGMakeTen = {
    makeTen: makeTen, pingTen: pingTen, poTen: poTen,
    makeTenSteps: makeTenSteps, pingTenSteps: pingTenSteps, poTenSteps: poTenSteps
  };

  // 任务7：挂载到科目化命名空间（全局旧名 SVGMakeTen 保留兼容）
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.makeTen = global.SVGMakeTen;

  if (typeof module !== 'undefined') module.exports = global.SVGMakeTen;
})(typeof window !== 'undefined' ? window : global);
