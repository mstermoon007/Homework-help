/**
 * shared/presentation/svg-sanitizer.js — SVG 唯一安全边界（P28-23）
 *
 * 职责：任何将要进入 DOM 的 SVG 字符串都必须经 sanitizeSvg() 校验后才放行。
 * 这是「raw SVG 禁止直接进 DOM」的收口点：
 *   - 仅允许白名单内的 SVG 标签（几何/文本/渐变/裁剪等非执行能力子集）；
 *   - 仅允许白名单属性；事件处理（on*）、外部引用（href/xlink:href/xml:base）、
 *     脚本（script）、foreignObject/image 等有执行/外联能力的元素一律并子树丢弃；
 *   - 属性值与文本内容统一 XML 转义（与 svg-core 的 escAttr/escText 同策略）；
 *   - style 属性值拒绝 url( / expression / import / < / script 形态；
 *   - 最终输出仍含脚本/外联特征时整体拒收（返回 ''）。
 *
 * 消费方：svg-registry.js 的 custom/illustration（rawSvg 透传）分支；注册生成器
 * （svg-core 构建）产出不需要本边界（已在 svg-core 内转义），但经 html-renderer.js
 * 注入 DOM 前仍有防御性复核。
 *
 * 使用：var safe = sanitizeSvg(input)   —— 非法/空返回 ''。
 */
(function (global) {
  'use strict';

  // 允许的标签（无脚本、无外联、无嵌入能力的安全子集；键一律小写）
  var ALLOWED_TAGS = {
    svg: 1, g: 1, defs: 1, desc: 1, title: 1,
    marker: 1, mask: 1, pattern: 1, clippath: 1,
    lineargradient: 1, radialgradient: 1, stop: 1,
    circle: 1, ellipse: 1, rect: 1, line: 1,
    polyline: 1, polygon: 1, path: 1, text: 1, tspan: 1
  };

  // 允许的属性（形状/几何/外观/标注；不含事件与引用）
  var ALLOWED_ATTRS = {
    'xmlns': 1, 'xmlns:xlink': 1,
    'viewbox': 1, 'preserveaspectratio': 1,
    'width': 1, 'height': 1,
    'role': 1, 'aria-label': 1, 'focusable': 1,
    'class': 1, 'id': 1, 'transform': 1,
    'd': 1, 'x': 1, 'y': 1, 'x1': 1, 'y1': 1, 'x2': 1, 'y2': 1,
    'cx': 1, 'cy': 1, 'r': 1, 'rx': 1, 'ry': 1,
    'points': 1, 'fill': 1, 'stroke': 1,
    'stroke-width': 1, 'stroke-dasharray': 1,
    'stroke-linecap': 1, 'stroke-linejoin': 1,
    'stroke-opacity': 1, 'fill-opacity': 1, 'fill-rule': 1,
    'clip-rule': 1, 'clip-path': 1, 'opacity': 1,
    'font-size': 1, 'font-family': 1, 'font-weight': 1,
    'font-style': 1, 'text-anchor': 1,
    'stop-color': 1, 'stop-opacity': 1, 'offset': 1,
    'gradientunits': 1, 'gradienttransform': 1, 'spreadmethod': 1,
    'marker-start': 1, 'marker-mid': 1, 'marker-end': 1,
    'style': 1
  };

  // 已知执行/外联特征（终检仍命中即整体拒收）
  var HOSTILE = /<script|<foreignObject|<iframe|<object\b|<embed\b|on[A-Za-z]+\s*=|\sstyle\s*=\s*["']?\s*(?:url\s*\(|expression|import|<|javascript)|url\s*\(\s*["']?\s*(?:javascript|data:[^,]*\<)/i;

  function escAttr(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escText(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 解析标签属性串 → { name: value }（双/单引号与裸值）。 */
  function parseAttrs(attrStr) {
    var attrs = {};
    var re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    var m;
    while ((m = re.exec(attrStr))) {
      attrs[m[1]] = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : ''));
    }
    return attrs;
  }

  /**
   * 流式清洗：白名单标签 + 白名单属性（转义）+ 文本转义；非白名单子树整体丢弃；
   * 结果保持标签配对（栈式平衡），最终仍含执行/外联特征时返回 ''。
   * @param {*} input 任意 SVG 字符串片段
   * @returns {string} 安全 SVG（可含 <svg> 根）或 ''
   */
  function sanitizeSvg(input) {
    if (typeof input !== 'string') return '';
    var src = String(input);
    if (!src) return '';

    var re = /<!--[\s\S]*?-->|<\/?([A-Za-z][\w:-]*)((?:\s+[\w:-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))*)\s*(\/?)>/g;
    var out = '';
    var stack = [];
    var pos = 0;
    var m;

    function inDiscarded() {
      for (var i = stack.length - 1; i >= 0; i--) if (!stack[i].allowed) return true;
      return false;
    }

    while ((m = re.exec(src))) {
      if (!inDiscarded()) out += escText(src.slice(pos, m.index));  // 丢弃子树外文本（转义）
      pos = re.lastIndex;
      if (m[0].indexOf('<!--') === 0) continue;  // 丢弃注释

      var name = m[1];                 // 原始大小写（SVG 渐变等标签大小写敏感，须保留）
      var keyName = name.toLowerCase();
      var selfClose = m[3] === '/';
      var discarded = inDiscarded();

      if (m[0].charAt(1) === '/') {
        // 闭合标签：弹出至同名（自动收拢中间未配对帧），仅当本帧被允许且祖先未被丢弃才输出
        var f = null;
        while (stack.length) {
          var top = stack.pop();
          if (top.key === keyName) { f = top; break; }
        }
        if (f && f.allowed && !inDiscarded()) out += '</' + name + '>';
        continue;
      }

      if (selfClose) {
        if (!discarded && ALLOWED_TAGS[keyName]) {
          out += '<' + name + emitAttrs(m[2]) + '/>';
        }
        continue;
      }

      var allowedHere = !discarded && !!ALLOWED_TAGS[keyName];
      stack.push({ key: keyName, allowed: allowedHere });
      if (allowedHere) out += '<' + name + emitAttrs(m[2]) + '>';
    }
    out += escText(src.slice(pos));              // 尾部文本（转义）

    if (HOSTILE.test(out)) return '';
    // 空白 / 无任何白名单元素 → 拒收
    if (!/<([A-Za-z])/.test(out)) return '';
    return out;
  }

  function emitAttrs(attrStr) {
    var attrs = parseAttrs(attrStr);
    var out = '';
    Object.keys(attrs).forEach(function (k) {
      var lk = k.toLowerCase();
      if (!ALLOWED_ATTRS[lk]) return;
      var v = attrs[k];
      if (lk === 'style' && /url\s*\(|expression|import|<|javascript/i.test(v)) return;
      out += ' ' + k + '="' + escAttr(v) + '"';
    });
    return out;
  }

  var API = {
    sanitizeSvg: sanitizeSvg,
    ALLOWED_TAGS: ALLOWED_TAGS,
    ALLOWED_ATTRS: ALLOWED_ATTRS
  };

  global.SVGSanitizer = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);