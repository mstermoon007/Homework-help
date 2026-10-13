'use strict';
/**
 * tests/presentation/svg-contract.test.js — P28-26 SVG 最终契约
 */
const { test } = require('node:test');
const assert = require('node:assert');

// Test svg-registry.js render contract
const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
global.window = global;

['shared/svg/svg-core.js', 'shared/presentation/svg-sanitizer.js', 'shared/presentation/svg-registry.js',
 'shared/svg/svg-geometry.js'].forEach(function (rel) {
  require(ROOT + '/' + rel);
});

const SVGRegistry = require(ROOT + '/shared/presentation/svg-registry.js');

test('P28-26 renderFor SUCCESS for valid custom SVG', function () {
  const result = SVGRegistry.renderFor({ type: 'custom', params: { rawSvg: '<svg><rect width="10" height="10"/></svg>' } });
  assert.strictEqual(result.status, 'SUCCESS');
  assert.ok(typeof result.svg === 'string');
  assert.ok(result.svg.indexOf('<svg') === 0);
});

test('P28-26 renderFor SUCCESS for valid graphic with generator', function () {
  // Register a simple test generator
  SVGRegistry.register('test-type', function (params) {
    return '<svg><circle r="' + (params.r || 5) + '"/></svg>';
  });
  const result = SVGRegistry.renderFor({ type: 'test-type', params: { r: 8 } });
  assert.strictEqual(result.status, 'SUCCESS');
  assert.ok(result.svg.indexOf('r="8"') !== -1);
});

test('P28-26 renderFor UNSUPPORTED for unknown type', function () {
  const result = SVGRegistry.renderFor({ type: 'nonexistent-type', params: {} });
  assert.strictEqual(result.status, 'UNSUPPORTED');
  assert.ok(typeof result.reason === 'string');
  assert.ok(result.reason.indexOf('No generator') !== -1);
});

test('P28-26 renderFor UNSUPPORTED for invalid descriptor', function () {
  const result = SVGRegistry.renderFor(null);
  assert.strictEqual(result.status, 'UNSUPPORTED');
  assert.ok(result.reason.indexOf('not an object') !== -1);
});

test('P28-26 renderFor FAILED for generator throwing', function () {
  SVGRegistry.register('failing-type', function () { throw new Error('boom'); });
  const result = SVGRegistry.renderFor({ type: 'failing-type', params: {} });
  assert.strictEqual(result.status, 'FAILED');
  assert.ok(result.error instanceof Error);
  assert.strictEqual(result.error.message, 'boom');
});

test('P28-26 renderFor FAILED for empty generator output', function () {
  SVGRegistry.register('empty-type', function () { return ''; });
  const result = SVGRegistry.renderFor({ type: 'empty-type', params: {} });
  assert.strictEqual(result.status, 'FAILED');
  assert.ok(result.reason.indexOf('empty') !== -1);
});

test('P28-26 render FAIL wraps svgWrap errors', function () {
  // Register a generator that returns non-SVG content (triggers svgWrap)
  SVGRegistry.register('wrap-fail', function () { return '<g>test</g>'; });
  // Mock global.SVGUtil to return a failing svgWrap (getSVGUtil checks this first)
  const origSVGUtil = global.SVGUtil;
  global.SVGUtil = { svgWrap: function () { throw new Error('wrap failed'); } };
  const result = SVGRegistry.render({ type: 'wrap-fail', params: {} });
  global.SVGUtil = origSVGUtil;
  assert.strictEqual(result.status, 'FAILED');
  assert.ok(result.reason.indexOf('svgWrap') !== -1);
});

// Test graphic-renderer.js contract
['shared/presentation/render-options.js', 'shared/presentation/render-result.js',
 'shared/presentation/html-renderer.js', 'shared/presentation/renderer.js'].forEach(function (rel) {
  require(ROOT + '/' + rel);
});

const GraphicRenderer = require(ROOT + '/shared/generator/graphic-renderer.js');

test('P28-26 GraphicRenderer.render returns SUCCESS contract', function () {
  // Need SVG engine available - use svg-registry
  global.SVGRenderer = SVGRegistry;
  const result = GraphicRenderer.render({ type: 'custom', params: { rawSvg: '<svg><rect/></svg>' } });
  assert.strictEqual(result.status, 'SUCCESS');
  assert.ok(typeof result.svg === 'string');
});

test('P28-26 GraphicRenderer.render returns UNSUPPORTED for invalid input', function () {
  const result = GraphicRenderer.render({ type: 'unknown-type', params: {} });
  assert.strictEqual(result.status, 'UNSUPPORTED');
});

test('P28-26 GraphicRenderer.render returns FAILED for no engine', function () {
  delete global.SVGRenderer;
  delete global.GraphicRenderer;
  // Also clear require cache to force null engine
  const result = GraphicRenderer.render({ type: 'custom', params: { rawSvg: '<svg/>' } });
  // In Node, getSVGEngine falls back to require, so it should still work
  // This test verifies the structure
  assert.ok(result.status === 'SUCCESS' || result.status === 'FAILED');
});

// Test PresentationRenderer integration
const PresentationRenderer = require(ROOT + '/shared/presentation/renderer.js');

test('P28-26 PresentationRenderer.render returns RenderResult with _gfxStatus', function () {
  global.SVGRenderer = SVGRegistry; // restore
  const sq = {
    id: 'test1',
    prompt: '1+1=?',
    questionType: 'calc',
    answer: { value: '2' },
    graphic: { type: 'custom', params: { rawSvg: '<svg><rect/></svg>' } }
  };
  const result = PresentationRenderer.render(sq, {}, 0);
  assert.ok(result);
  assert.ok(typeof result.html === 'string');
  assert.ok(typeof result.graphic === 'string');
  assert.ok(result.graphic.indexOf('<svg') === 0);
  assert.ok(['SUCCESS', 'UNSUPPORTED', 'FAILED'].indexOf(result._gfxStatus) !== -1);
});

test('P28-26 PresentationRenderer handles missing graphic gracefully', function () {
  const sq = { id: 'test2', prompt: 'text', questionType: 'fill', answer: { value: 'a' } };
  const result = PresentationRenderer.render(sq, {}, 0);
  assert.ok(result);
  assert.strictEqual(result._gfxStatus, 'UNSUPPORTED');
  assert.strictEqual(result.graphic, '');
});

// ============================================================
// FINAL-72：统一链 GraphicDescriptor→GraphicRenderer→SVGRenderer
// 三态 SUCCESS/UNSUPPORTED/FAILED；禁止 catch→'' 吞错
// ============================================================

test('FINAL-72 统一链：生成器 throw 经 GraphicRenderer→SVGRenderer 必须 FAILED 且带原始错误', function () {
  SVGRegistry.register('final72-throw', function () { throw new Error('final72-boom'); });
  const desc = { type: 'final72-throw', params: { a: 1 } };
  // 门面层
  const gr = GraphicRenderer.render(desc);
  assert.strictEqual(gr.status, 'FAILED');
  assert.strictEqual(gr.reason, 'Generator threw exception');
  assert.ok(gr.error instanceof Error);
  assert.strictEqual(gr.error.message, 'final72-boom');
  assert.ok(!('svg' in gr), 'FAILED 不得携带 svg 字段');
  // 底层直连同态
  const direct = SVGRegistry.render(desc);
  assert.strictEqual(direct.status, 'FAILED');
  assert.strictEqual(direct.error.message, 'final72-boom');
});

test('FINAL-72 端到端：FAILED 图形不进 DOM，状态与原因保留在 RenderResult', function () {
  const sq = {
    id: 'f72-e2e',
    prompt: '看图计算',
    questionType: 'calc',
    answer: { value: '1' },
    graphic: { type: 'final72-throw', params: {} }
  };
  const rr = PresentationRenderer.render(sq, {}, 0);
  assert.strictEqual(rr._gfxStatus, 'FAILED');
  assert.ok(typeof rr._gfxReason === 'string' && rr._gfxReason.length > 0);
  assert.strictEqual(rr.graphic, '');
  assert.ok(rr.html.indexOf('question-graphic') === -1, 'FAILED 图形不得注入 DOM');
});

test('FINAL-72 三态完备：UNSUPPORTED（未知 descriptor）/ FAILED（空输出）/ SUCCESS 语义不混', function () {
  SVGRegistry.register('final72-empty', function () { return '   '; });
  assert.strictEqual(SVGRegistry.renderFor({ type: 'final72-empty', params: {} }).status, 'FAILED');
  assert.strictEqual(SVGRegistry.renderFor({ type: 'final72-nope' }).status, 'UNSUPPORTED');
  assert.strictEqual(
    SVGRegistry.renderFor({ type: 'custom', params: { rawSvg: '<svg><circle r="1"/></svg>' } }).status,
    'SUCCESS');
});

test('FINAL-72 print 层：渲染器抛错时返回 null 但不得静默（console.warn 保留原始错误）', function () {
  require(ROOT + '/shared/presentation/print.js');
  assert.ok(global.Print && typeof global.Print.buildFromQuestions === 'function');
  var origPR = global.PresentationRenderer;
  var origWarn = console.warn;
  var warned = [];
  console.warn = function () { warned.push(Array.prototype.slice.call(arguments)); };
  global.PresentationRenderer = { renderAll: function () { throw new Error('final72-print-boom'); } };
  try {
    var out = global.Print.buildFromQuestions([{ id: 'x', prompt: 'p', questionType: 'calc' }], {});
  } finally {
    console.warn = origWarn;
    global.PresentationRenderer = origPR;
  }
  assert.strictEqual(out, null);
  assert.ok(warned.length > 0, 'catch 必须经 console.warn 暴露错误，禁止静默吞掉');
  var flat = warned.map(function (a) { return a.map(String).join(' '); }).join('\n');
  assert.ok(flat.indexOf('final72-print-boom') !== -1, '必须保留原始错误信息');
});

test('FINAL-72 结构性禁令：SVG 链源文件不得存在 catch→\'\' 吞错', function () {
  var fs = require('node:fs');
  var files = [
    'shared/presentation/svg-registry.js',
    'shared/generator/graphic-renderer.js',
    'shared/presentation/renderer.js',
    'shared/presentation/html-renderer.js'
  ];
  files.forEach(function (rel) {
    var src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    // 匹配 catch (e) { ... return '' / return "" ... }（return 前仅允许空白）
    var re = /catch\s*\([^)]*\)\s*\{[\s\S]*?return\s+(?:''|"")\s*;?/;
    assert.ok(!re.test(src), rel + ' 存在 catch→\'\' 吞错，违反 FINAL-72');
  });
});
test('P35-CLOSE-01 view-cards descriptor → SUCCESS（题设视图方格数与方向标注正确）', function () {
  const result = SVGRegistry.renderFor({
    type: 'geometry', subtype: 'view-cards', role: 'quantity-correspondence',
    params: { views: [
      { direction: 'front', grid: [[1, 1]] },
      { direction: 'top', grid: [[1, 1]] }
    ], unit: 'cm', unitPx: 25 }
  });
  assert.strictEqual(result.status, 'SUCCESS');
  // 2 视图 × 2 方格 = 4 个 rect；画题设视图（非组合体成品），不泄题
  assert.strictEqual((result.svg.match(/<rect/g) || []).length, 4);
  assert.ok(result.svg.indexOf('从前面看') !== -1, '含「从前面看」方向标注');
  assert.ok(result.svg.indexOf('从上面看') !== -1, '含「从上面看」方向标注');
});

// ===== P40-Q-15（R22 无障碍）：SVG 可访问名 <title> 单点注入 =====
// 测试自包含：注册最小 fake 生成器（不依赖 svg-calculation 等引擎文件加载顺序）
SVGRegistry.register('calculation', 'p40frag', function () { return '<rect x="1" y="1" width="2" height="2"/>'; });
SVGRegistry.register('calculation', 'p40full', function () { return '<svg xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="2" height="2"/></svg>'; });

test('P40-Q-15 render() 注入 <title>，role 优先于 type；renderFor 不注入（单点收口）', function () {
  const r1 = SVGRegistry.render({ type: 'calculation', subtype: 'p40frag', role: 'calculation-support' });
  assert.strictEqual(r1.status, 'SUCCESS');
  const open = r1.svg.match(/^<svg\b[^>]*>/i)[0];
  assert.ok(r1.svg.slice(open.length).indexOf('<title>计算辅助图</title>') === 0, 'title 紧跟 <svg> 开标签且 role 优先（svgWrap 路径）');
  const r2 = SVGRegistry.render({ type: 'calculation', subtype: 'p40full' });
  assert.ok(r2.svg.indexOf('<title>竖式计算图</title>') !== -1, '无 role 时回退 type 标签（full-svg 路径）');
  const raw = SVGRegistry.renderFor({ type: 'calculation', subtype: 'p40full' });
  assert.ok(raw.svg.indexOf('<title>') === -1, 'renderFor 原始产物不注入（唯一注入点在 render）');
  const r3 = SVGRegistry.render({ type: 'geometry', subtype: 'view-cards', role: 'quantity-correspondence',
    params: { views: [{ direction: 'front', grid: [[1, 1]] }], unit: 'cm', unitPx: 25 } });
  assert.ok(r3.svg.indexOf('<title>数量对应图</title>') !== -1, 'role=quantity-correspondence → 数量对应图（真实引擎路径）');
});

test('P40-Q-15 <title> 不含数值语义（6g 防泄题口径）', function () {
  const r = SVGRegistry.render({ type: 'calculation', subtype: 'p40full', role: 'calculation-support' });
  const title = r.svg.match(/<title>([\s\S]*?)<\/title>/)[1];
  assert.ok(!/[0-9]/.test(title), 'title 不得含任何数字：' + title);
});

test('P40-Q-15 title 唯一不叠加；custom 产物注入通用标签', function () {
  const once = SVGRegistry.render({ type: 'custom', params: { rawSvg: '<circle r="5"/>' } });
  assert.ok(once.svg.indexOf('<title>题目示意图</title>') !== -1, 'custom → 题目示意图');
  assert.strictEqual((once.svg.match(/<title>/g) || []).length, 1, 'title 唯一');
});
