// shared/svg/svg-currency.js — 人民币图形生成器（SVGCurrency）
//
// 依赖 shared/svg/svg-core.js。输出完整 <svg> 字符串。
// 挂载 SVGGenerators.math.currency.{rmb}。
//
// 描述符参数：
//   rmb  { amounts:[fen], op?:'+'|'-'|null, unit?:'元' }  —— 每笔金额按 元/角/分 拆成币值图标；
//          op 存在时在两组之间画运算符（人民币加减），末尾留 ? 答案框；
//          无 op 时（单位换算）单组金额图。
//
// 无效参数返回 ''（不抛异常）。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg/svg-currency.js 依赖 shared/svg/svg-core.js，请先加载');

  var INK = '#27324a', GOLD = '#b8860b', BLUE = '#3f6fd1', RED = '#e05252';

  /** fen → [[amountText, unitText, isNote], ...]：币值分解，大于等于 1 元的用纸币框，角/分用币圆 */
  function decompose(fen) {
    var parts = [];
    var yuan = Math.floor(fen / 100);
    var jiao = Math.floor((fen % 100) / 10);
    var fenR = fen % 10;
    if (yuan > 0) parts.push([yuan, '元', true]);
    if (jiao > 0) parts.push([jiao, '角', false]);
    if (fenR > 0) parts.push([fenR, '分', false]);
    return parts;
  }

  function drawGroup(parts, x, y, color) {
    var out = '';
    var unitW = 46, gap = 8;
    parts.forEach(function (p) {
      if (p[2]) {
        // 纸币框
        out += U.svgRect(x, y, unitW, 30, { rx: 4, fill: '#fff8e6', stroke: color, strokeWidth: 1.6 });
        out += U.svgText(x + unitW / 2, y + 20, p[0] + p[1], { fontSize: 13, fill: color, 'text-anchor': 'middle', fontWeight: 700 });
        x += unitW + gap;
      } else {
        // 硬币圆
        var r = 14;
        out += U.svgCircle(x + r, y + 15, r, { fill: '#fdf3d7', stroke: GOLD, strokeWidth: 1.8 });
        out += U.svgText(x + r, y + 20, p[0] + p[1], { fontSize: 11, fill: INK, 'text-anchor': 'middle' });
        x += 2 * r + gap;
      }
    });
    return { svg: out, nextX: x };
  }

  function rmb(o) {
    var amounts = Array.isArray(o && o.amounts) ? o.amounts.map(Number).filter(function (n) { return isFinite(n) && n >= 0; }) : [];
    if (!amounts.length) return '';
    var op = o.op == null ? null : String(o.op);
    var W = 380, y = 76;
    var inner = '';
    var maxGroups = op ? 2 : 1;
    var groups = amounts.slice(0, maxGroups);
    var cxAcc = 26;

    groups.forEach(function (fen, i) {
      var parts = decompose(fen);
      if (!parts.length) return;
      var isMulti = op != null;
      var grp = drawGroup(parts, cxAcc, y, isMulti ? (op === '+' ? BLUE : '#7c5cff') : BLUE);
      inner += grp.svg;
      cxAcc = grp.nextX + 12;
      if (op && i < groups.length - 1) {
        inner += U.svgText(cxAcc + 4, y + 22, op, { fontSize: 22, fill: INK, fontWeight: 700, 'text-anchor': 'middle' });
        cxAcc += 34;
      }
    });

    // 答案框（尾部 '?'）
    if (op) {
      inner += U.svgText(cxAcc + 2, y + 22, '=', { fontSize: 20, fill: INK, 'text-anchor': 'middle', fontWeight: 700 });
      inner += U.svgRect(cxAcc + 22, y - 4, 52, 38, { rx: 8, fill: '#ffffff', stroke: RED, strokeWidth: 2, dasharray: '6 4' });
      inner += U.svgText(cxAcc + 48, y + 27, '?', { fontSize: 20, fill: RED, 'text-anchor': 'middle', fontWeight: 700 });
    } else {
      inner += U.svgRect(cxAcc - 6, y - 4, 52, 38, { rx: 8, fill: '#ffffff', stroke: RED, strokeWidth: 2, dasharray: '6 4' });
      inner += U.svgText(cxAcc + 20, y + 27, '?', { fontSize: 20, fill: RED, 'text-anchor': 'middle', fontWeight: 700 });
    }

    return U.svgWrap(inner, { viewBox: '0 0 ' + W + ' 130', width: o.width, padding: 10 });
  }

  var SVGCurrency = { rmb: rmb };

  global.SVGCurrency = SVGCurrency;
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.currency = SVGCurrency;

  if (typeof module !== 'undefined') module.exports = SVGCurrency;
})(typeof window !== 'undefined' ? window : global);