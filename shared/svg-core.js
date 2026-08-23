// shared/svg-core.js — 通用 SVG 工具函数集（SVGUtil）
//
// 供各题型生成器以纯字符串方式构造几何图形，不依赖 DOM，浏览器 / Node 双环境可用。
// 设计要点：
//   - 所有元素函数返回 SVG 片段字符串（非完整 <svg>），由 svgWrap 统一包裹；
//   - svgWrap 未显式给定 viewBox 时调用 computeViewBox 自动计算边界；
//   - 属性值与文本内容自动 XML 转义；
//   - 默认样式集中在 SVG_DEFAULTS（配色与插件卡片风格一致）。
//
// 验收：控制台执行 SVGUtil.svgWrap('<circle cx="50" cy="50" r="40"/>') 得到合法 SVG 字符串。

(function (global) {
  'use strict';

  // ============ 默认样式常量 ============
  var SVG_DEFAULTS = {
    width: 220,            // svgWrap 兜底宽度
    height: 160,           // svgWrap 兜底高度
    padding: 10,           // computeViewBox 四周留白
    fill: '#eef3fb',       // 形状填充色
    stroke: '#27324a',     // 轮廓色
    strokeWidth: 2,
    fontSize: 14,
    fontFamily: 'Menlo, Consolas, monospace',
    textColor: '#27324a'
  };

  // ============ 内部工具 ============
  function escAttr(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /** 合并默认值：defaults 先铺底，opts 覆盖；undefined/null 的 opts 项被忽略 */
  function merge(defaults, opts) {
    var out = {};
    Object.keys(defaults).forEach(function (k) { out[k] = defaults[k]; });
    if (opts) Object.keys(opts).forEach(function (k) {
      if (opts[k] != null) out[k] = opts[k];
    });
    return out;
  }
  /** attrs 对象 → ' k="v"' 片段 */
  function attrsStr(attrs) {
    var s = '';
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] == null) return;
      s += ' ' + k + '="' + escAttr(attrs[k]) + '"';
    });
    return s;
  }

  // ============ 基础元素创建 ============
  /**
   * 通用元素。children 为字符串或字符串数组；为空时输出自闭合标签。
   * @param {string} tag 标签名（如 'g'、'ellipse'）
   * @param {Object} [attrs] 属性表
   * @param {string|string[]} [children]
   */
  function svgElement(tag, attrs, children) {
    var inner = Array.isArray(children) ? children.join('') : (children || '');
    if (!inner) return '<' + tag + attrsStr(attrs) + '/>';
    return '<' + tag + attrsStr(attrs) + '>' + inner + '</' + tag + '>';
  }

  function svgText(x, y, str, opts) {
    var o = merge({ fontSize: SVG_DEFAULTS.fontSize, fontFamily: SVG_DEFAULTS.fontFamily,
      fill: SVG_DEFAULTS.textColor, 'text-anchor': 'middle' }, opts);
    var attrs = { x: x, y: y, 'font-size': o.fontSize, 'font-family': o.fontFamily,
      fill: o.fill, 'text-anchor': o['text-anchor'], 'font-weight': o.fontWeight };
    if (o.transform) attrs.transform = o.transform;
    return svgElement('text', attrs, escText(str));
  }

  function svgLine(x1, y1, x2, y2, opts) {
    var o = merge({ stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('line', { x1: x1, y1: y1, x2: x2, y2: y2,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linecap': o.linecap || 'round', 'stroke-dasharray': o.dasharray });
  }

  /** points 支持 [[x,y],...] 或 "x,y x,y" 字符串 */
  function normPoints(points) {
    if (Array.isArray(points)) return points.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
    return String(points);
  }

  function svgPolygon(points, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('polygon', { points: normPoints(points), fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linejoin': o.linejoin || 'round', 'stroke-dasharray': o.dasharray });
  }

  function svgPolyline(points, opts) {
    var o = merge({ fill: 'none', stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('polyline', { points: normPoints(points), fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
  }

  function svgCircle(cx, cy, r, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('circle', { cx: cx, cy: cy, r: r, fill: o.fill,
      stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-dasharray': o.dasharray });
  }

  function svgPath(d, opts) {
    var o = merge({ fill: 'none', stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    var attrs = { d: d, fill: o.fill, stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.dasharray };
    if (o.transform) attrs.transform = o.transform;
    return svgElement('path', attrs);
  }

  function svgRect(x, y, w, h, opts) {
    var o = merge({ fill: SVG_DEFAULTS.fill, stroke: SVG_DEFAULTS.stroke, strokeWidth: SVG_DEFAULTS.strokeWidth }, opts);
    return svgElement('rect', { x: x, y: y, width: w, height: h, rx: o.rx || 0,
      fill: o.fill, stroke: o.stroke, 'stroke-width': o.strokeWidth, 'stroke-dasharray': o.dasharray });
  }

  // ============ viewBox 计算 ============
  /**
   * 解析 SVG 片段中的常见形状并估算边界。
   * @param {string|string[]} elements 片段或片段数组
   * @param {Object} [options] { padding }
   * @returns {{minX:number,minY:number,width:number,height:number}}
   * 说明：path 仅粗略提取坐标数字（控制点按在曲线上近似），文本按字号×0.62 估宽。
   */
  function computeViewBox(elements, options) {
    var pad = options && options.padding != null ? options.padding : SVG_DEFAULTS.padding;
    var src = Array.isArray(elements) ? elements.join('') : String(elements || '');
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function grow(x1, y1, x2, y2) {
      if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) return;
      if (x1 < minX) minX = x1; if (y1 < minY) minY = y1;
      if (x2 > maxX) maxX = x2; if (y2 > maxY) maxY = y2;
    }
    var tagRe = /<(circle|ellipse|rect|line|text|polygon|polyline|path)\b([^>]*)>/g;
    var tm;
    while ((tm = tagRe.exec(src))) {
      var tag = tm[1], attrStr = tm[2];
      var attrs = {};
      var am, attrRe = /([\w:-]+)\s*=\s*"([^"]*)"|([\w:-]+)\s*=\s*'([^']*)'/g;
      while ((am = attrRe.exec(attrStr))) {
        if (am[1]) attrs[am[1]] = am[2]; else attrs[am[3]] = am[4];
      }
      var num = function (k, dv) { var v = parseFloat(attrs[k]); return isFinite(v) ? v : dv; };
      var sw = num('stroke-width', 0) / 2;
      if (tag === 'circle') {
        var cr = num('r', 0);
        grow(num('cx') - cr - sw, num('cy') - cr - sw, num('cx') + cr + sw, num('cy') + cr + sw);
      } else if (tag === 'ellipse') {
        grow(num('cx') - num('rx') - sw, num('cy') - num('ry') - sw,
             num('cx') + num('rx') + sw, num('cy') + num('ry') + sw);
      } else if (tag === 'rect') {
        grow(num('x', 0) - sw, num('y', 0) - sw, num('x', 0) + num('width', 0) + sw, num('y', 0) + num('height', 0) + sw);
      } else if (tag === 'line') {
        grow(Math.min(num('x1'), num('x2')) - sw, Math.min(num('y1'), num('y2')) - sw,
             Math.max(num('x1'), num('x2')) + sw, Math.max(num('y1'), num('y2')) + sw);
      } else if (tag === 'polygon' || tag === 'polyline') {
        var pts = String(attrs.points || '').trim().split(/[\s,]+/).map(Number);
        for (var i = 0; i + 1 < pts.length; i += 2) grow(pts[i] - sw, pts[i + 1] - sw, pts[i] + sw, pts[i + 1] + sw);
      } else if (tag === 'text') {
        var fs = num('font-size', SVG_DEFAULTS.fontSize);
        var content = '';
        var closeIdx = src.indexOf('</text>', tm.index);
        if (closeIdx > tm.index) {
          var seg = src.slice(tm.index + tm[0].length, closeIdx).replace(/<[^>]*>/g, '');
          content = seg.replace(/&[a-z]+;|&#\d+;/gi, 'x');
        }
        var estW = fs * 0.62 * Math.max(content.length, 1);
        var anchor = attrs['text-anchor'] || 'start';
        var tx = num('x', 0), ty = num('y', 0);
        var x1 = anchor === 'middle' ? tx - estW / 2 : anchor === 'end' ? tx - estW : tx;
        grow(x1 - sw, ty - fs, x1 + estW + sw, ty + fs * 0.35);
      } else if (tag === 'path') {
        var nums = String(attrs.d || '').match(/-?\d+(?:\.\d+)?/g);
        if (nums) {
          for (var j = 0; j + 1 < nums.length; j += 2) {
            var px = parseFloat(nums[j]), py = parseFloat(nums[j + 1]);
            grow(px - sw, py - sw, px + sw, py + sw);
          }
        }
      }
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, width: SVG_DEFAULTS.width, height: SVG_DEFAULTS.height };
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    return { minX: Math.floor(minX), minY: Math.floor(minY),
      width: Math.ceil(maxX - minX), height: Math.ceil(maxY - minY) };
  }

  // ============ 包裹为完整 SVG ============
  /**
   * @param {string} innerSvg 片段（可含多个元素）
   * @param {Object} [options] { width, height, viewBox, padding, className, background, style }
   * @returns {string} 完整 <svg>…</svg> 字符串
   */
  function svgWrap(innerSvg, options) {
    var o = options || {};
    var vb = o.viewBox ||
      (function () { var b = computeViewBox(innerSvg, { padding: o.padding }); return b.minX + ' ' + b.minY + ' ' + b.width + ' ' + b.height; })();
    var parts = vb.split(/\s+/).map(Number);
    var w = o.width != null ? o.width : (parts[2] || SVG_DEFAULTS.width);
    var h = o.height != null ? o.height : (parts[3] || SVG_DEFAULTS.height);
    var attrs = {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: vb, width: w, height: h,
      role: 'img', preserveAspectRatio: o.preserveAspectRatio || 'xMidYMid meet'
    };
    if (o.className) attrs.class = o.className;
    var bg = o.background ? svgElement('rect', { x: parts[0], y: parts[1], width: parts[2], height: parts[3], fill: o.background }) : '';
    var style = o.style ? ' style="' + escAttr(o.style) + '"' : '';
    return '<svg' + attrsStr(attrs) + style + '>' + bg + (innerSvg || '') + '</svg>';
  }

  // ============ 导出 ============
  var SVGUtil = {
    SVG_DEFAULTS: SVG_DEFAULTS,
    escAttr: escAttr,
    escText: escText,
    svgElement: svgElement,
    svgText: svgText,
    svgLine: svgLine,
    svgPolygon: svgPolygon,
    svgPolyline: svgPolyline,
    svgCircle: svgCircle,
    svgRect: svgRect,
    svgPath: svgPath,
    computeViewBox: computeViewBox,
    svgWrap: svgWrap
  };

  global.SVGUtil = SVGUtil;
  global.SVG_DEFAULTS = SVG_DEFAULTS;
  if (typeof module !== 'undefined') module.exports = SVGUtil;
})(typeof window !== 'undefined' ? window : global);
