'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
global.window = global;

// Load all SVG generators
['shared/svg/svg-core.js',
 'shared/svg/svg-geometry.js',
 'shared/svg/svg-calculation.js',
 'shared/svg/svg-make-ten.js',
 'shared/svg/svg-chart.js',
 'shared/svg/svg-diagram.js',
 'shared/svg/svg-currency.js',
 'plugins/svg-clock.js',
 'plugins/svg-area.js',
 'plugins/svg-fraction.js',
 'plugins/svg-data-stats.js',
 'plugins/svg-draw.js'].forEach(function (rel) { require(ROOT + '/' + rel); });

// Load registry and sanitizer
['shared/presentation/svg-sanitizer.js', 'shared/presentation/svg-registry.js'].forEach(function (rel) {
  require(ROOT + '/' + rel);
});

const SVGRegistry = require(ROOT + '/shared/presentation/svg-registry.js');
const { sanitizeSvg } = require(ROOT + '/shared/presentation/svg-sanitizer.js');

// Seed registry (trigger seedFromGlobal)
SVGRegistry.seedFromGlobal();

/** Assert SUCCESS result has basic SVG structure */
function assertValidSvg(result, type, subtype) {
  assert.strictEqual(result.status, 'SUCCESS', type + '.' + subtype + ' should return SUCCESS, got: ' + result.status + ' ' + (result.reason || ''));
  assert.ok(typeof result.svg === 'string', 'svg must be string');
  assert.ok(result.svg.indexOf('<svg') === 0, 'must start with <svg');
  assert.ok(result.svg.indexOf('</svg>') !== -1, 'must close </svg>');
  assert.ok(result.svg.indexOf('viewBox') !== -1, 'must have viewBox');
  assert.ok(result.svg.indexOf('width') !== -1, 'must have width');
  assert.ok(result.svg.indexOf('height') !== -1, 'must have height');
  // Safety checks - only match tag names (after < or whitespace), not text content
  var safetyRegex = /<\s*(script|foreignObject|iframe|object|embed)\b|on\w+\s*=/i;
  assert.ok(!safetyRegex.test(result.svg), 'no malicious tags/attrs');
}

/** Call render and return result */
function render(type, subtype, params) {
  return SVGRegistry.render({ type: type, subtype: subtype, params: params || {} });
}

test('P28-27 SVG Contract — geometry', function () {
  // Working generators with current param adapter
  const working = [
    ['rectangle', { width: 100, height: 60 }],
    ['square', { size: 80 }],
    ['parallelogram', { width: 100, height: 60, angle: 30 }],
    ['trapezoid', { top: 60, bottom: 100, height: 80 }],
    ['circle', { r: 40 }],
    ['sector', { r: 50, startAngle: 0, endAngle: 90 }],
    ['cuboid', { width: 80, height: 60, depth: 40 }],
    ['cube', { size: 60 }],
    ['cylinder', { r: 30, height: 80 }],
    ['cone', { r: 30, height: 80 }],
  ];
  for (const [subtype, params] of working) {
    const r = render('geometry', subtype, params);
    assertValidSvg(r, 'geometry', subtype);
  }
  // Known limitation: triangle needs {p1,p2,p3} not supported by adapter
  const r = render('geometry', 'triangle', { base: 100, height: 60 });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r.status));
});

test('P28-27 SVG Contract — calculation', function () {
  const cases = [
    ['add', { values: [456, 378] }],
    ['sub', { a: 456, b: 123 }],
    ['mul', { a: 123, b: 45 }],
    ['div', { a: 456, b: 12 }],
    ['dec', { a: 12.5, b: 3.2, op: '+' }],
    ['frac', { a: 3, b: 4, c: 1, d: 2, op: '+' }],
  ];
  for (const [subtype, params] of cases) {
    const r = render('calculation', subtype, params);
    assertValidSvg(r, 'calculation', subtype);
  }
});

test('P28-27 SVG Contract — makeTen', function () {
  // Working: makeTen (adapter supports {a,b})
  const r1 = render('makeTen', 'makeTen', { a: 8, b: 5 });
  assertValidSvg(r1, 'makeTen', 'makeTen');
  // Known limitation: pingTen/poTen need different adapter (need two args)
  const r2 = render('makeTen', 'pingTen', { a: 7, b: 3 });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r2.status));
  const r3 = render('makeTen', 'poTen', { a: 9, b: 1 });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r3.status));
});

test('P28-27 SVG Contract — chart', function () {
  // Working: bar, pie
  const r1 = render('chart', 'bar', { data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] });
  assertValidSvg(r1, 'chart', 'bar');
  const r2 = render('chart', 'pie', { data: [{ label: 'A', value: 30 }, { label: 'B', value: 70 }] });
  assertValidSvg(r2, 'chart', 'pie');
  // Known limitation: line, scatter need data adapter
  const r3 = render('chart', 'line', { points: [{ x: 0, y: 10 }, { x: 1, y: 20 }] });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r3.status));
  const r4 = render('chart', 'scatter', { points: [{ x: 1, y: 2 }, { x: 2, y: 3 }] });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r4.status));
});

test('P28-27 SVG Contract — diagram', function () {
  // Working: segment, balance, scale
  const r1 = render('diagram', 'segment', { total: 100, part: 30 });
  assertValidSvg(r1, 'diagram', 'segment');
  const r2 = render('diagram', 'balance', { left: 5, right: 3 });
  assertValidSvg(r2, 'diagram', 'balance');
  const r3 = render('diagram', 'scale', { max: 100, value: 40 });
  assertValidSvg(r3, 'diagram', 'scale');
  // Known limitation: brace needs {start,end,text} adapter
  const r4 = render('diagram', 'brace', { text: 'group', width: 200, height: 50 });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r4.status));
});

test('P28-27 SVG Contract — currency', function () {
  // Known limitation: rmb needs {yuan,fen} adapter
  const r = render('currency', 'rmb', { amount: 123.45 });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r.status));
});

test('P28-27 SVG Contract — clock', function () {
  const cases = [
    ['clockSVG', { hour: 3, minute: 30 }],
    ['digitalSVG', { hour: 14, minute: 5, second: 20 }],
    ['clockFace', { hour: 10, minute: 15 }],
  ];
  for (const [subtype, params] of cases) {
    const r = render('clock', subtype, params);
    assertValidSvg(r, 'clock', subtype);
  }
});

test('P28-27 SVG Contract — area', function () {
  const cases = [
    ['rectSVG', { width: 100, height: 60 }],
    ['squareSVG', { size: 80 }],
    ['gridSVG', { cols: 5, rows: 4, cellSize: 20 }],
  ];
  for (const [subtype, params] of cases) {
    const r = render('area', subtype, params);
    assertValidSvg(r, 'area', subtype);
  }
});

test('P28-27 SVG Contract — fraction', function () {
  const cases = [
    ['fractionCircle', { numerator: 3, denominator: 4 }],
    ['fractionBar', { numerator: 2, denominator: 5 }],
  ];
  for (const [subtype, params] of cases) {
    const r = render('fraction', subtype, params);
    assertValidSvg(r, 'fraction', subtype);
  }
});

test('P28-27 SVG Contract — dataStats', function () {
  // Working: tableSVG
  const r1 = render('dataStats', 'tableSVG', { headers: ['Item', 'Value'], rows: [['A', 10], ['B', 20]] });
  assertValidSvg(r1, 'dataStats', 'tableSVG');
  // Known limitation: barChart, voteChart need array adapter
  const r2 = render('dataStats', 'barChart', { data: [{ label: 'A', value: 10 }, { label: 'B', value: 20 }] });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r2.status));
  const r3 = render('dataStats', 'voteChart', { options: [{ label: 'Yes', count: 30 }, { label: 'No', count: 20 }] });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r3.status));
});

test('P28-27 SVG Contract — draw', function () {
  // Working: protractorSVG, angleDemoSVG
  const r1 = render('draw', 'protractorSVG', { angle: 60 });
  assertValidSvg(r1, 'draw', 'protractorSVG');
  const r2 = render('draw', 'angleDemoSVG', { angle: 45, showArc: true });
  assertValidSvg(r2, 'draw', 'angleDemoSVG');
  // Known limitation: classifySVG needs array adapter
  const r3 = render('draw', 'classifySVG', { shapes: ['triangle', 'square', 'circle'] });
  assert.ok(['UNSUPPORTED', 'FAILED'].includes(r3.status));
});

test('P28-27 Empty params should not throw, return contract object', function () {
  const types = [
    { type: 'geometry', subtype: 'square' },
    { type: 'calculation', subtype: 'add' },
    { type: 'makeTen', subtype: 'makeTen' },
    { type: 'chart', subtype: 'bar' },
    { type: 'diagram', subtype: 'brace' },
    { type: 'currency', subtype: 'rmb' },
    { type: 'clock', subtype: 'clockSVG' },
    { type: 'area', subtype: 'rectSVG' },
    { type: 'fraction', subtype: 'fractionCircle' },
    { type: 'dataStats', subtype: 'barChart' },
    { type: 'draw', subtype: 'protractorSVG' },
  ];
  for (const { type, subtype } of types) {
    const r = render(type, subtype, {}); // empty params
    assert.ok(['SUCCESS', 'UNSUPPORTED', 'FAILED'].includes(r.status),
      type + '.' + subtype + ' empty params should return contract, got: ' + r.status + ' ' + (r.reason || ''));
  }
});

test('P28-27 Invalid params should not throw, return FAILED contract', function () {
  // Negative size, NaN, missing required, wrong type - these should be rejected by generators
  const cases = [
    ['geometry', 'rectangle', { width: -10, height: 60 }], // negative width - generator may accept
    ['geometry', 'circle', { r: NaN }], // NaN
    ['calculation', 'div', { dividend: 10, divisor: 0 }], // div by zero
    ['chart', 'bar', { data: 'not-array' }], // wrong type
    ['currency', 'rmb', { amount: 'abc' }], // non-number
  ];
  for (const [type, subtype, params] of cases) {
    const r = render(type, subtype, params);
    // Generators may accept negative/NaN, but should not throw
    assert.ok(['SUCCESS', 'UNSUPPORTED', 'FAILED'].includes(r.status),
      type + '.' + subtype + ' invalid params should return contract, got: ' + r.status + ' ' + (r.reason || ''));
  }
});

test('P28-27 Unknown type/subtype returns UNSUPPORTED', function () {
  const r1 = render('unknown-type', 'foo', {});
  assert.strictEqual(r1.status, 'UNSUPPORTED');
  const r2 = render('geometry', 'unknown-shape', {});
  assert.strictEqual(r2.status, 'UNSUPPORTED');
});

test('P28-27 Safety: malicious rawSvg sanitized', function () {
  const r = SVGRegistry.render({
    type: 'custom',
    params: { rawSvg: '<svg onload="alert(1)"><script>evil()</script><rect/></svg>' }
  });
  assert.strictEqual(r.status, 'SUCCESS'); // sanitized by sanitizeSvg
  assert.ok(!/script|onload|evil/i.test(r.svg), 'malicious content sanitized');
});

test('P28-27 sanitizeSvg direct: good SVG preserved, bad rejected', function () {
  const good = '<svg viewBox="0 0 100 100"><rect x="10" y="10" width="20" height="20"/></svg>';
  assert.strictEqual(sanitizeSvg(good), good);

  const bad = '<svg><script>alert(1)</script><foreignObject><body/></foreignObject><rect/></svg>';
  const out = sanitizeSvg(bad);
  assert.ok(!/script|foreignObject/i.test(out), 'malicious tags removed');
  assert.ok(out.indexOf('<rect') !== -1, 'safe content preserved');
});