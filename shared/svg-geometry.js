// shared/svg-geometry.js — 1~6 年级常见几何图形生成器（SVGGeometry）
//
// 依赖 shared/svg-core.js（须先加载），输出完整 <svg> 字符串，可直接赋给题目 q.svg。
// 尺寸参数按「单位」传入（如厘米），经 unitPx（默认 30px/单位）映射为像素。
//
// 主要 API：
//   rectangle / square / triangle / parallelogram / trapezoid / circle / sector
//   cuboid / cube / cylinder / cone            —— 简化透视立体图
//   translationDemo / rotationDemo / reflectionDemo —— 变换叠加演示（原形虚线灰）
// 通用标注选项：labelSides（边长标注）、labelAngles（角度弧线）、showHeight（高线）、
//   dashed（虚线轮廓）、rightAngle（直角符号）、unit（长度单位文案）、unitPx。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg-geometry.js 依赖 shared/svg-core.js，请先加载');

  var D = U.SVG_DEFAULTS;

  // ============ 内部工具 ============
  function px(v, opt) { return v * ((opt && opt.unitPx) || 30); }
  function ghostAttrs(opts) {
    return { fill: 'none', stroke: '#8a97ad', strokeWidth: 1.5, dasharray: '5 4' };
  }
  function isDashed(opts) {
    return opts && opts.dashed ? { strokedasharray: undefined, dasharray: '6 4' } : {};
  }
  /** 边长标注：取线段中点外侧偏移放置文本 */
  function sideLabel(x1, y1, x2, y2, text, opts, off) {
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var o = off == null ? 14 : off;
    return U.svgText(mx - dy / len * o, my + dx / len * o, text,
      { fontSize: 13, fill: D.textColor });
  }
  /** 直角符号：在 corner 处沿 d1/d2 两方向画小方块 */
  function rightAngleMark(cx, cy, d1x, d1y, d2x, d2y, size) {
    var s = size || 10;
    var pts = [
      [cx + d1x * s, cy + d1y * s],
      [cx + (d1x + d2x) * s, cy + (d1y + d2y) * s],
      [cx + d2x * s, cy + d2y * s]
    ];
    return U.svgPolyline(pts, { strokeWidth: 1.5 });
  }
  /** 角度弧线：vertex 为角顶点，p1/p2 为两边上任意点 */
  function angleArc(vx, vy, p1x, p1y, p2x, p2y, r, label) {
    var a1 = Math.atan2(p1y - vy, p1x - vx);
    var a2 = Math.atan2(p2y - vy, p2x - vx);
    var start = a1, end = a2;
    while (end - start > Math.PI) end -= 2 * Math.PI;
    while (end - start < -Math.PI) end += 2 * Math.PI;
    var x1 = vx + r * Math.cos(start), y1 = vy + r * Math.sin(start);
    var x2 = vx + r * Math.cos(end), y2 = vy + r * Math.sin(end);
    var large = Math.abs(end - start) > Math.PI ? 1 : 0;
    var sweep = end > start ? 1 : 0;
    var arc = U.svgPath('M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' ' + sweep + ' ' + x2 + ' ' + y2,
      { strokeWidth: 1.5 });
    var lab = '';
    if (label != null) {
      var mid = (start + end) / 2;
      lab = U.svgText(vx + (r + 13) * Math.cos(mid), vy + (r + 13) * Math.sin(mid) + 4, label, { fontSize: 12 });
    }
    return arc + lab;
  }
  /** 线段等分标记（任务：SVG 细化）：在线段 n 等分的各分点画垂直短刻线。
   *  @param {number} x1,y1,x2,y2 线段端点
   *  @param {number} n 等分数（≥2 才有分点）
   *  @param {Object} [opts] { size 刻线半长(默认6), color } */
  function tickMark(x1, y1, x2, y2, n, opts) {
    opts = opts || {};
    if (!(n >= 2)) return '';
    var dx = x2 - x1, dy = y2 - y1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;         // 线段方向
    var nx = -uy, ny = ux;                    // 法向
    var s = opts.size || 6;
    var out = '';
    for (var i = 1; i < n; i++) {
      var t = i / n;
      var cx = x1 + dx * t, cy = y1 + dy * t;
      out += U.svgLine(cx - nx * s, cy - ny * s, cx + nx * s, cy + ny * s,
        { strokeWidth: 1.4, stroke: opts.color || '#8a97ad' });
    }
    return out;
  }

  function finish(inner, opt, extraW) {
    return U.svgWrap(inner, Object.assign({ padding: 12 }, opt && opt.wrap));
  }

  // ============ 平面图形 ============
  /** 长方形：{width, height, labelSides, rightAngle, dashed, unit, unitPx} */
  function rectangle(o) {
    var w = px(o.width, o), h = px(o.height, o);
    var unit = o.unit || '';
    var inner = U.svgRect(0, 0, w, h, mergeDash(o));
    if (o.labelSides !== false) {
      inner += sideLabel(0, h, w, h, o.width + unit, o);
      inner += sideLabel(w, 0, w, h, o.height + unit, o, -14);
    }
    if (o.rightAngle !== false) {
      inner += rightAngleMark(0, 0, 1, 0, 0, 1);
      inner += rightAngleMark(w, 0, -1, 0, 0, 1);
    }
    if (o.showDiagonal) inner += U.svgLine(0, 0, w, h, { strokeWidth: 1.5, dasharray: o.dashed ? '6 4' : null });
    return finish(inner, o, 30);
  }
  /** 正方形 */
  function square(o) {
    return rectangle(Object.assign({}, o, { width: o.size, height: o.size }));
  }

  /** 三角形：{p1,p2,p3 单位数组, labelSides, labelVertices, showHeight, angles:[三角度], dashed} */
  function triangle(o) {
    var P = [o.p1, o.p2, o.p3].map(function (p) { return [px(p[0], o), px(p[1], o)]; });
    var names = o.labelVertices === true ? ['A', 'B', 'C'] : (o.labelVertices || []);
    var inner = U.svgPolygon(P, mergeDash(o, { fill: o.fill || 'none' }));
    if (names.length) {
      for (var i = 0; i < 3; i++) {
        var q1 = P[(i + 2) % 3], q2 = P[i], q3 = P[(i + 1) % 3];
        var mx = (q1[0] + q3[0]) / 2, my = (q1[1] + q3[1]) / 2;
        inner += U.svgText(mx + (mx - q2[0]) * 0.18, my + (my - q2[1]) * 0.18 + 4, names[i], { fontSize: 13 });
      }
    }
    if (o.labelSides) {
      var L = o.sides || [];
      var seg = [[P[1], P[2]], [P[0], P[2]], [P[0], P[1]]];
      for (var s = 0; s < 3; s++) {
        var txt = L[s] != null ? L[s] : roundLen(seg[s]);
        inner += sideLabel(seg[s][0][0], seg[s][0][1], seg[s][1][0], seg[s][1][1], txt + '', o, 16);
      }
    }
    if (o.showHeight) {
      // 从 p3 向底边(p1-p2)作垂线
      var ax = P[0][0], ay = P[0][1], bx = P[1][0], by = P[1][1];
      var t = ((P[2][0] - ax) * (bx - ax) + (P[2][1] - ay) * (by - ay)) / ((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
      var fx = ax + t * (bx - ax), fy = ay + t * (by - ay);
      inner += U.svgLine(P[2][0], P[2][1], fx, fy, { strokeWidth: 1.5, dasharray: '5 4' });
      var d1x = (bx - ax) / Math.hypot(bx - ax, by - ay), d1y = (by - ay) / Math.hypot(bx - ax, by - ay);
      inner += rightAngleMark(fx, fy, -d1x, -d1y, (P[2][0] - fx) / 60, (P[2][1] - fy) / 60, 9);
    }
    if (o.angles) {
      for (var v = 0; v < 3; v++) {
        if (o.angles[v] != null) {
          var V = P[v], A = P[(v + 1) % 3], B = P[(v + 2) % 3];
          inner += angleArc(V[0], V[1], A[0], A[1], B[0], B[1], 20, o.angles[v] + '°');
        }
      }
    }
    if (o.ticks) {
      // 线段等分标记：o.ticks=[[边序号(0底边,1右边,2左边), 等分数],...]
      var segs = [[P[1], P[2]], [P[0], P[2]], [P[0], P[1]]];
      o.ticks.forEach(function (tk) {
        var sg = segs[tk[0]];
        if (sg) inner += tickMark(sg[0][0], sg[0][1], sg[1][0], sg[1][1], tk[1]);
      });
    }
    return finish(inner, o);
  }
  function roundLen(seg) {
    return Math.round(Math.hypot(seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]) / 30 * 10) / 10;
  }
  function mergeDash(o, extra) {
    var out = extra ? JSON.parse(JSON.stringify(extra)) : {};
    if (o && o.dashed) out.dasharray = '6 4';
    return out;
  }

  /** 平行四边形：{base, height, offset(>0 底边起点右移量)} */
  function parallelogram(o) {
    var b = px(o.base, o), h = px(o.height, o), f = px(o.offset, o);
    var P = [[f, 0], [f + b, 0], [b, h], [0, h]];
    var inner = U.svgPolygon([[P[3][0], P[3][1]], [P[2][0], P[2][1]], [P[1][0], P[1][1]], [P[0][0], P[0][1]]], mergeDash(o));
    if (o.labelSides !== false) {
      inner += sideLabel(0, h, b, h, o.base + (o.unit || ''), o);
    }
    if (o.showHeight !== false) {
      inner += U.svgLine(f, 0, f, h, { strokeWidth: 1.5, dasharray: '5 4' });
      inner += rightAngleMark(f, h, 0, -1, 1, 0, 9);
    }
    return finish(inner, o);
  }

  /** 梯形：{topBase, bottomBase, height} 等腰居中 */
  function trapezoid(o) {
    var tb = px(o.topBase, o), bb = px(o.bottomBase, o), h = px(o.height, o);
    var inset = (bb - tb) / 2;
    var P = [[inset, 0], [inset + tb, 0], [bb, h], [0, h]];
    var inner = U.svgPolygon([P[3], P[2], P[1], P[0]].map(function (p) { return [p[0], p[1]]; }), mergeDash(o));
    if (o.labelSides !== false) {
      inner += sideLabel(inset, 0, inset + tb, 0, o.topBase + (o.unit || ''), o, -14);
      inner += sideLabel(0, h, bb, h, o.bottomBase + (o.unit || ''), o);
    }
    if (o.showHeight !== false) {
      var mx = inset + tb / 2;
      inner += U.svgLine(mx, 0, mx, h, { strokeWidth: 1.5, dasharray: '5 4' });
      inner += rightAngleMark(mx, h, 0, -1, 1, 0, 9);
    }
    return finish(inner, o);
  }

  /** 圆：{r, labelRadius(半径标注值或 true)} */
  function circle(o) {
    var r = px(o.r, o), c = r;
    var inner = U.svgCircle(c, c, r, mergeDash(o));
    if (o.labelRadius) {
      inner += U.svgLine(c, c, c + r, c, { strokeWidth: 1.5 });
      inner += U.svgText(c + r / 2, c - 8, o.labelRadius === true ? 'r' : (o.labelRadius + (o.unit || '')), { fontSize: 13 });
      inner += U.svgCircle(c, c, 2, { fill: D.stroke, stroke: 'none' });
    }
    return finish(inner, o);
  }

  /** 扇形：{r, angle(度), labelAngle, labelRadius} 从正右方向逆时针 */
  function sector(o) {
    var r = px(o.r, o), ang = o.angle, rad = ang * Math.PI / 180;
    var cx = r + 10, cy = r + 10;
    var ex = cx + r * Math.cos(rad), ey = cy - r * Math.sin(rad);
    var large = ang > 180 ? 1 : 0;
    var inner = U.svgPath('M ' + cx + ' ' + cy + ' L ' + (cx + r) + ' ' + cy + ' A ' + r + ' ' + r +
      ' 0 ' + large + ' 0 ' + ex + ' ' + ey + ' Z',
      mergeDash(o, { fill: o.fill || D.fill }));
    if (o.labelAngle) inner += angleArc(cx, cy, cx + Math.min(r, 34), cy, ex, ey, Math.min(r, 34), o.angle + '°');
    if (o.labelRadius) {
      inner += U.svgText(cx + r * Math.cos(rad / 2) / 2 + 14, cy - r * Math.sin(rad / 2) / 2, o.r + (o.unit || ''), { fontSize: 12 });
    }
    return finish(inner, o);
  }

  // ============ 立体图形（简化斜二测透视） ============
  function cuboid(o) {
    var w = px(o.length, o), h = px(o.height, o), d = px(o.width, o) * 0.55;
    var dx = d * 0.75, dy = -d * 0.55;
    var F = [[0, h], [w, h], [w, 0], [0, 0]];                 // 前面
    var B = F.map(function (p) { return [p[0] + dx, p[1] + dy]; }); // 后面
    function poly(pts, dashed) { return U.svgPolygon(pts.map(function (p) { return [p[0], p[1]]; }), dashed ? { fill: 'none', stroke: '#8a97ad', strokeWidth: 1.4, dasharray: '5 4' } : {}); }
    var inner = poly(F) + poly(B, true);
    inner += U.svgLine(F[0][0], F[0][1], B[0][0], B[0][1], { strokeWidth: 1.4, dasharray: '5 4' });
    inner += U.svgLine(F[1][0], F[1][1], B[1][0], B[1][1], {});
    inner += U.svgLine(F[2][0], F[2][1], B[2][0], B[2][1], {});
    inner += U.svgLine(F[3][0], F[3][1], B[3][0], B[3][1], { strokeWidth: 1.4, dasharray: '5 4' });
    if (o.labelSides !== false) {
      var u = o.unit || '';
      inner += U.svgText(w / 2, h + 16, o.length + u, { fontSize: 12 });
      inner += U.svgText(w + 14, h / 2, o.height + u, { fontSize: 12 });
      inner += U.svgText((w + B[1][0]) / 2 + 12, (h + B[1][1]) / 2, o.width + u, { fontSize: 12 });
    }
    return finish(inner, o);
  }
  function cube(o) { return cuboid(Object.assign({}, o, { width: o.edge, length: o.edge, height: o.edge })); }

  function cylinder(o) {
    var r = px(o.r, o), h = px(o.height, o), ry = r * 0.32;
    var cx = r + 10;
    var inner =
      U.svgElement('ellipse', { cx: cx, cy: 10 + ry, rx: r, ry: ry }) +
      U.svgPath('M ' + (cx - r) + ' ' + (10 + ry + h) + ' A ' + r + ' ' + ry + ' 0 0 0 ' + (cx + r) + ' ' + (10 + ry + h),
        { fill: 'none' }) +
      U.svgPath('M ' + (cx - r) + ' ' + (10 + ry + h) + ' A ' + r + ' ' + ry + ' 0 0 1 ' + (cx + r) + ' ' + (10 + ry + h),
        { fill: 'none', stroke: '#8a97ad', strokeWidth: 1.4, dasharray: '5 4' }) +
      U.svgLine(cx - r, 10 + ry, cx - r, 10 + ry + h, {}) +
      U.svgLine(cx + r, 10 + ry, cx + r, 10 + ry + h, {});
    if (o.labelSides !== false) {
      inner += U.svgText(cx + 8, 10 + ry + h / 2, o.height + (o.unit || ''), { fontSize: 12 });
    }
    return finish(inner, o);
  }

  function cone(o) {
    var r = px(o.r, o), h = px(o.height, o), ry = r * 0.32;
    var cx = r + 10, topY = 12, baseY = topY + h;
    var inner =
      U.svgElement('ellipse', { cx: cx, cy: baseY, rx: r, ry: ry }) +
      U.svgLine(cx - r, baseY, cx, topY, {}) +
      U.svgLine(cx + r, baseY, cx, topY, {});
    if (o.labelSides !== false) {
      inner += U.svgText(cx + r / 2 + 10, (topY + baseY) / 2, o.height + (o.unit || ''), { fontSize: 12 });
      inner += U.svgLine(cx, baseY, cx + r, baseY, { strokeWidth: 1.2, dasharray: '5 4' });
      inner += U.svgText(cx + r / 2, baseY + ry + 14, o.r + (o.unit || ''), { fontSize: 12 });
    }
    return finish(inner, o);
  }

  // ============ 图形变换（原形虚线灰 + 新形实线叠加） ============
  function transformPts(pts, f) { return pts.map(function (p) { return f(p[0], p[1]); }); }
  function overlay(o, movedPts) {
    var base = (o.points || []).map(function (p) { return [px(p[0], o), px(p[1], o)]; });
    var inner = U.svgPolygon(base, { fill: 'none', stroke: '#8a97ad', strokeWidth: 1.5, dasharray: '5 4' }) +
      U.svgPolygon(movedPts.map(function (p) { return [px(p[0], o), px(p[1], o)]; }), { fill: o.fill || '#dbe7ff', stroke: '#3f6fd1', strokeWidth: 2 });
    return finish(inner, o);
  }
  /** 平移叠加：{points, dx, dy} */
  function translationDemo(o) { return overlay(o, transformPts(o.points, function (x, y) { return [x + (o.dx || 0), y + (o.dy || 0)]; })); }
  /** 旋转叠加：{points, cx, cy, deg} 绕指定点逆时针旋转 */
  function rotationDemo(o) {
    var rad = -(o.deg || 0) * Math.PI / 180, cx = o.cx || 0, cy = o.cy || 0;
    return overlay(o, transformPts(o.points, function (x, y) {
      var ddx = x - cx, ddy = y - cy;
      return [cx + ddx * Math.cos(rad) - ddy * Math.sin(rad), cy + ddx * Math.sin(rad) + ddy * Math.cos(rad)];
    }));
  }
  /** 对称叠加：{points, axis:'x'|'y'} 关于水平/垂直轴镜像 */
  function reflectionDemo(o) {
    if (o.axis === 'x') {
      var maxY = Math.max.apply(null, o.points.map(function (p) { return p[1]; }));
      return overlay(o, transformPts(o.points, function (x, y) { return [x, 2 * maxY - y]; }));
    }
    var maxX = Math.max.apply(null, o.points.map(function (p) { return p[0]; }));
    return overlay(o, transformPts(o.points, function (x, y) { return [2 * maxX - x, y]; }));
  }

  // ============ 导出 ============
  var SVGGeometry = {
    rectangle: rectangle, square: square, triangle: triangle,
    parallelogram: parallelogram, trapezoid: trapezoid,
    circle: circle, sector: sector,
    cuboid: cuboid, cube: cube, cylinder: cylinder, cone: cone,
    translationDemo: translationDemo, rotationDemo: rotationDemo, reflectionDemo: reflectionDemo,
    tickMark: tickMark,
    _helpers: { rightAngleMark: rightAngleMark, angleArc: angleArc, tickMark: tickMark }
  };

  global.SVGGeometry = SVGGeometry;

  // 任务7：挂载到科目化命名空间（全局旧名 SVGGeometry 保留兼容既有插件/测试）
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.geometry = SVGGeometry;

  if (typeof module !== 'undefined') module.exports = SVGGeometry;
})(typeof window !== 'undefined' ? window : global);
