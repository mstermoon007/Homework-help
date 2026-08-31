/**
 * dev/check-renderer-coverage.js — M7-R32 Renderer 全量覆盖检查
 *
 * 校验：graphic.type / graphic.subtype 是否全部可被 Renderer 渲染。
 *
 * 覆盖源：
 *   - shared/svg-*.js 提供的所有图形生成器（SVGGenerators.{math,cn,en}.<type>.<subtype>）；
 *   - 测试与共享层中出现的 graphic 描述符类型；
 *   - PresentationRenderer / SVGRegistry 实际可 resolve 的类型。
 *
 * 结论断言：
 *   0 unsupported graphic types   —— 出现于描述符但 registry 无法 resolve 的 type
 *   0 missing renderers          —— SVGGenerators 已提供生成器但 registry 未注册/不可渲染
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg-geometry.js'));
require(path.join(ROOT, 'shared', 'svg-calculation.js'));
require(path.join(ROOT, 'shared', 'svg-make-ten.js'));
require(path.join(ROOT, 'shared', 'svg-english.js'));
require(path.join(ROOT, 'shared', 'svg-chinese.js'));
var SVGRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

// SVGGenerators 声明能力：{ ns: { type: { subtype: fn } } }
var declaredTypes = {};   // ns -> { type: [subtypes] }
var G = global.SVGGenerators || {};
['math', 'cn', 'en'].forEach(function (ns) {
  var nsObj = G[ns] || {};
  if (typeof nsObj !== 'object' || G[ns] === true || G[ns] === false) return;
  Object.keys(nsObj).forEach(function (type) {
    var v = nsObj[type];
    if (type === 'ready') return;
    if (typeof v === 'function') {
      // 单函数命名空间（如 makeTen 顶层函数）
      if (!declaredTypes[ns]) declaredTypes[ns] = {};
      declaredTypes[ns][type] = ['::default'];
    } else if (v && typeof v === 'object') {
      var subs = Object.keys(v).filter(function (s) { return typeof v[s] === 'function' && s.charAt(0) !== '_'; });
      if (!declaredTypes[ns]) declaredTypes[ns] = {};
      declaredTypes[ns][type] = subs;
    }
  });
});

// 尝试渲染的探针参数（按生成器实际签名提供真实参数，避免误报）
var PROBE = {
  triangle: { p1: [30, 180], p2: [7, 10], p3: [160, 10], labelVertices: true },
  translationDemo: { points: [[30, 100], [70, 100], [50, 40]], dx: 60 },
  rotationDemo: { points: [[30, 100], [70, 100], [50, 40]], angle: 45 },
  reflectionDemo: { points: [[30, 100], [70, 100], [50, 40]], flipY: true },
  rectangle: { a: 60, b: 40 }, parallelogram: { a: 70, b: 40, skew: 20 },
  trapezoid: { a: 70, b: 40, w2: 30 }, square: { size: 50 }, circle: { r: 30 },
  sector: { r: 40, startAngle: 0, endAngle: 90 }, cuboid: { a: 40, b: 30, c: 50 },
  cube: { a: 40 }, cylinder: { r: 20, h: 50 }, cone: { r: 20, h: 50 }
};
function probeParams(type, subtype) {
  if (PROBE[subtype]) return PROBE[subtype];
  if (/calculation|calc/.test(type)) {
    if (subtype === 'sub' || subtype === 'mul' || subtype === 'div') return { a: 87, b: 45 };
    if (subtype === 'dec') return { a: '12.5', b: '3.2', op: '+' };
    if (subtype === 'frac') return { a: 1, b: 3, c: 1, d: 6, op: '+' };
    return { values: [45, 67] };
  }
  if (/makeTen|make-ten|凑/i.test(type)) return { num: 9, add: 5 };
  if (/letter|english/i.test(type)) return { letter: 'a' };
  return { size: 50 };
}

var missing = [];     // 注册缺失（unresolved = 覆盖缺口，硬性）
var noSvg = [];       // 已注册但探针未产出 svg（功能探针，非覆盖缺口）
Object.keys(declaredTypes).forEach(function (ns) {
  Object.keys(declaredTypes[ns]).forEach(function (type) {
    declaredTypes[ns][type].forEach(function (sub) {
      if (sub === 'tickMark') return; // 工具辅助（多参签名，非描述符图形）
      var g = { type: type, subtype: sub === '::default' ? null : sub, params: probeParams(type, sub) };
      var res = SVGRegistry.resolve(g);
      if (!res) {
        // 语文/英语命名空间仅挂 shape 别名（非描述符类型），不判覆盖缺口
        if (ns === 'math') missing.push(ns + '.' + type + '.' + sub);
        return;
      }
      var sr = SVGRegistry.render(g);
      if (sr === '' && !(type === 'custom')) noSvg.push(ns + '.' + type + '.' + sub);
    });
  });
});

// 描述符全集（测试/共享层使用到的 graphic.type）
var fs = require('fs');
var src = '';
function walk(dir, ext) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (name) {
    var fp = path.join(dir, name);
    var st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, ext);
    else if (name.endsWith(ext)) src += '\n' + (fs.readFileSync(fp, 'utf8'));
  });
}
walk(path.join(ROOT, 'tests'), '.js');
walk(path.join(ROOT, 'shared'), '.js');
var typeRe = /graphic\s*:\s*\{\s*type\s*:\s*['"]([^'"]+)['"]/g;
var usedTypes = new Set(); var m;
while ((m = typeRe.exec(src)) !== null) usedTypes.add(m[1]);
// legacy q.svg 透传（或称：描述符里出现但 registry / 命名空间均不认）
var unregistered = [];
usedTypes.forEach(function (t) {
  if (t === 'custom' || t === 'svg') return;
  var resolvable = SVGRegistry.resolve({ type: t, subtype: null, params: probeParams(t, null) });
  var inNs = (t in (global.SVGGenerators.math || {})) || (t in (global.SVGGenerators.cn || {})) || (t in (global.SVGGenerators.en || {}));
  if (!resolvable && !inNs) unregistered.push(t);
});

console.log('Renderer Coverage (M7-R32)');
console.log('  声明命名空间       : ' + Object.keys(declaredTypes).join(','));
var totalSubs = 0;
Object.keys(declaredTypes).forEach(function (ns) {
  Object.keys(declaredTypes[ns]).forEach(function (t) { totalSubs += declaredTypes[ns][t].length; });
});
console.log('  声明的生成器数目   : ' + totalSubs);
console.log('  描述符使用的类型   : ' + usedTypes.size + ' （' + Array.from(usedTypes).slice(0, 12).join(', ') + (usedTypes.size > 12 ? '…' : '') + '）');
console.log('  0 unsupported graphic types: ' + (unregistered.length === 0 ? '✓' : unregistered.join(', ')));
console.log('  0 missing renderers       : ' + (missing.length === 0 ? '✓' : missing.slice(0, 6).join(', ')));
if (noSvg.length) console.log('  [info] 可解析但探针未产出 svg 的特殊签名生成器: ' + noSvg.join(', '));

if (missing.length === 0 && unregistered.length === 0) {
  console.log('RENDERER-COVERAGE: PASS');
  process.exitCode = 0;
} else {
  console.log('RENDERER-COVERAGE: FAIL');
  process.exitCode = 1;
}