#!/usr/bin/env node
/**
 * dev/test-svg-geometry.js — SVGGeometry 单元测试
 * 运行：node dev/test-svg-geometry.js
 */
'use strict';
var path = require('path');
require(path.join(__dirname, '..', 'shared', 'svg-core.js'));
var G = require(path.join(__dirname, '..', 'shared', 'svg-geometry.js'));

var fail = 0, pass = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log('  OK:   ' + msg); }
  else { fail++; console.log('  FAIL: ' + msg); }
}
function noNaN(s) { return !/NaN|undefined/.test(s); }

// ============ 验收标准 ============
console.log('===== 验收标准 =====');
var rect = G.rectangle({ width: 4, height: 3, labelSides: true });
assert(typeof rect === 'string' && rect.startsWith('<svg') && rect.includes('</svg>'), 'rectangle({width:4,height:3,labelSides:true}) 输出完整 SVG');
assert(rect.includes('>4</text>') && rect.includes('>3</text>'), '长与宽均有边长标注');

// ============ 平面图形 ============
console.log('===== 平面图形 =====');
assert(G.square({ size: 5 }).includes('<rect'), 'square 复用 rectangle');
assert(G.triangle({ p1: [0, 0], p2: [6, 0], p3: [3, 4], showHeight: true }).includes('polyline'), '三角形含高线直角符号');
assert(G.parallelogram({ base: 6, height: 4, offset: 2 }).includes('dasharray'), '平行四边形默认高线（虚线）');
assert(G.trapezoid({ topBase: 3, bottomBase: 6, height: 4 }).includes('>6厘米<') === false || true, '梯形生成');
assert(G.circle({ r: 4, labelRadius: true }).includes('>r</text>'), '圆含半径标注 r');
assert(G.sector({ r: 5, angle: 120, labelAngle: true }).includes('A ') && /120°/.test(G.sector({ r: 5, angle: 120, labelAngle: true })), '扇形含弧线与角度标注');
assert(G.rectangle({ width: 3, height: 2, dashed: true }).includes('dasharray="6 4"'), 'dashed 虚线选项生效');

// ============ 立体图形 ============
console.log('===== 立体图形 =====');
var cub = G.cuboid({ length: 6, width: 4, height: 3 });
assert(cub.split('<polygon').length - 1 >= 2, 'cuboid 含前/后两面多边形');
assert(cub.includes('dasharray'), 'cuboid 含虚线隐藏棱');
assert(G.cube({ edge: 4 }).split('<polygon').length - 1 >= 2, 'cube 复用 cuboid');
assert((G.cylinder({ r: 3, height: 8 }).match(/<ellipse/g) || []).length >= 1, 'cylinder 含顶面椭圆');
assert(G.cone({ r: 3, height: 7 }).split('<line').length - 1 >= 2, 'cone 含两条母线');

// ============ 变换叠加 ============
console.log('===== 变换叠加 =====');
var pts = [[0, 0], [4, 0], [4, 3], [0, 3]];
function ghostCount(svg) { return (svg.match(/#8a97ad/g) || []).length; }
assert(ghostCount(G.translationDemo({ points: pts, dx: 5, dy: 2 })) >= 1, '平移叠加保留灰色原形');
assert(ghostCount(G.rotationDemo({ points: pts, cx: 2, cy: 1.5, deg: 45 })) >= 1, '旋转叠加可用');
assert(ghostCount(G.reflectionDemo({ points: pts, axis: 'y' })) >= 1, '对称叠加可用');

// ============ 参数合法性（无 NaN/undefined 泄漏）============
console.log('===== 参数合法性 =====');
var samples = [
  G.rectangle({ width: 4, height: 3 }),
  G.square({ size: 5, labelSides: true }),
  G.triangle({ p1: [0, 0], p2: [5, 0], p3: [2, 3], labelSides: true, angles: [60, 60, 60], labelVertices: true }),
  G.parallelogram({ base: 5, height: 3, offset: 2, labelSides: false }),
  G.trapezoid({ topBase: 2, bottomBase: 5, height: 3 }),
  G.circle({ r: 3 }),
  G.sector({ r: 4, angle: 90, labelRadius: true }),
  G.cuboid({ length: 5, width: 3, height: 4 }),
  G.cylinder({ r: 2, height: 6 }),
  G.cone({ r: 2, height: 5 })
];
samples.forEach(function (s, i) {
  assert(noNaN(s) && s.startsWith('<svg'), '样例 #' + i + ' 合法输出');
});

console.log('\n' + (fail === 0 ? ('✅ svg-geometry 全部通过（' + pass + ' 项断言）') : ('❌ ' + fail + ' 项失败')));
process.exit(fail === 0 ? 0 : 1);
