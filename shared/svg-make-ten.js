// shared/svg-make-ten.js — 凑十 / 平十 / 破十 图解生成器（SVGMakeTen）
//
// 依赖 shared/svg-core.js。输出完整 <svg> 字符串（可直接赋给 q.svg），
// 无效数字组合返回 null（由调用方回退普通口算题）。
//
// API：
//   SVGMakeTen.makeTen(9, 5)   凑十：标准教材连线图（见 renderMakeTenFigure）
//   SVGMakeTen.pingTen(15, 8)  平十：8=5+3 → 15−5=10 → 10−3=7
//   SVGMakeTen.poTen(15, 8)    破十：15=10+5 → 10−8=2 → 2+5=7
//
// 凑十法为教材标准连线图：顶行 a + b = ▢（答案框）；
// b 经弧线拆为两个小框（c1 凑整蓝 / c2 剩余橙）；
// a 折线①下行接左框引线并标注 10（a+c1=10）；
// 括线自 10 接入右框（10+c2），底部 "+" 与答案框回连线②构成 10+c2=答案。
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

  // ============ 凑十法·标准教材连线图 ============
  // 结构（对照教材标准图式，布局以 22px 字号为基准、按 k=fs/22 缩放）：
  //   ① 顶行  a + b = ┌──┐        （答案红色填入答案框）
  //   ② 拆分  b 下弧线 ⌒ 下接两小框（c1 凑整蓝 / c2 剩余橙）
  //   ③ 凑十  a 折线下行 → 右接左框竖引线，线下标注 10（蓝）
  //   ④ 汇总  括线自 10 右行 → 上折接入右框；底部 "+"；答案框回连线接入括线竖段
  // 动画分四步淡入（同 mt-step 约定），printMode 强制静态。
  function renderMakeTenFigure(a, b, opts) {
    var steps = makeTenSteps(a, b);
    if (!steps) return null;
    opts = opts || {};
    var fs = opts.fontSize || 22, k = fs / 22;

    // —— 布局常量（22px 基准）——
    var xa = 30 * k, xop = 66 * k, xb = 102 * k, xeq = 140 * k;      // 顶行各元素中心
    var abW = 58 * k, abH = 38 * k, abX = 166 * k, abY = 6 * k;     // 答案框
    var abCx = abX + abW / 2;
    var bw = 46 * k, bh = 30 * k, bY = 78 * k, bCy = bY + bh / 2;   // 拆分小框
    var lbCx = 76 * k, rbCx = 128 * k;                              // 左/右小框中心
    var y1 = 32 * k;                                                // 顶行基线
    var arcFoot = 72 * k, arcPeak = 52 * k;                         // 拆分弧线脚/峰
    var yL = 142 * k;                                               // 底部连线层
    var x10 = 58 * k, y10 = 166 * k;                                // “10” 标注（中心/基线）
    var xbv = 172 * k;                                              // 括线竖段 x
    var xpl = 161 * k;                                              // 底部 “+” 中心
    var IN = { stroke: INK, strokeWidth: 2 };                       // 结构线样式

    var hasTitle = steps.title !== false;
    var shift = hasTitle ? 44 : 0;
    var animate = !!opts.animate && !opts.printMode;

    function step(i, els) {
      var s = els.join('');
      if (!animate) return s;
      return U.svgElement('g', { 'class': 'mt-step',
        style: 'animation-delay:' + (i * 0.45).toFixed(2) + 's' }, s);
    }

    var parts = [];
    if (hasTitle) {
      parts.push(U.svgText(121 * k, 26, (opts.title || steps.title),
        { fontSize: 15, fill: '#7a879c', 'text-anchor': 'middle', fontWeight: 700 }));
    }

    // ① 顶行：a + b = [答案]
    parts.push(step(0, [
      U.svgText(xa, y1 + shift, a, { fontSize: fs, fill: INK, fontWeight: 700 }),
      U.svgText(xop, y1 + shift, '+', { fontSize: fs, fill: INK, fontWeight: 700 }),
      U.svgText(xb, y1 + shift, b, { fontSize: fs, fill: INK, fontWeight: 700 }),
      U.svgText(xeq, y1 + shift, '=', { fontSize: fs, fill: INK, fontWeight: 700 }),
      U.svgRect(abX, abY + shift, abW, abH, { fill: '#ffffff', stroke: INK, strokeWidth: 2 }),
      U.svgText(abCx, 33 * k + shift, steps.answer, { fontSize: fs, fill: RED, fontWeight: 700 })
    ]));

    // ② 拆分：弧线（左框顶 → b 下方峰 → 右框顶）+ 两小框
    var ctrlY = 2 * arcPeak - arcFoot;
    parts.push(step(1, [
      U.svgPath('M' + lbCx + ',' + (arcFoot + shift) +
        ' Q' + xb + ',' + (ctrlY + shift) + ' ' + rbCx + ',' + (arcFoot + shift), IN),
      U.svgRect(lbCx - bw / 2, bY + shift, bw, bh, { fill: '#ffffff', stroke: INK, strokeWidth: 2 }),
      U.svgRect(rbCx - bw / 2, bY + shift, bw, bh, { fill: '#ffffff', stroke: INK, strokeWidth: 2 }),
      U.svgText(lbCx, bCy + 8 * k + shift, 10 - a, { fontSize: fs, fill: BLUE, fontWeight: 700 }),
      U.svgText(rbCx, bCy + 8 * k + shift, b - (10 - a), { fontSize: fs, fill: ORANGE, fontWeight: 700 })
    ]));

    // ③ 凑十：a 折线① + 左框竖引线 + “10” 标注
    parts.push(step(2, [
      U.svgPolyline([[xa, y1 + 10 * k + shift], [xa, yL + shift], [lbCx, yL + shift]], IN),
      U.svgLine(lbCx, bY + bh + 4 * k + shift, lbCx, yL + shift, IN),
      U.svgText(x10, y10 + shift, '10', { fontSize: fs, fill: BLUE, fontWeight: 700 })
    ]));

    // ④ 汇总：括线（10 → 右框缘）+ 底部 “+” + 答案框回连线②
    parts.push(step(3, [
      U.svgPolyline([[x10 + 14 * k, y10 - 8 * k + shift], [xbv, y10 - 8 * k + shift],
        [xbv, bCy + shift], [rbCx + bw / 2, bCy + shift]], IN),
      U.svgText(xpl, yL + 3 * k + shift, '+', { fontSize: fs, fill: INK, fontWeight: 700 }),
      U.svgPolyline([[abCx, abY + abH + 4 * k + shift], [abCx, yL + shift], [xbv, yL + shift]], IN)
    ]));

    var w = 218 * k, h = 176 * k + shift;
    return U.svgWrap((animate ? MT_ANIM_STYLE : '') + parts.join(''),
      { viewBox: (12 * k) + ' ' + (hasTitle ? 4 : 0) + ' ' + w + ' ' + h,
        width: opts.width, printMode: opts.printMode });
  }

  function makeTen(a, b, opts) { return renderMakeTenFigure(a, b, opts); }
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
