'use strict';
/**
 * tests/presentation/svg-sanitizer.test.js — P28-23 SVG 安全边界
 *
 * 验证 shared/presentation/svg-sanitizer.js：
 *   - 白名单保护：script / 事件属性 / foreignObject / image 等一律清洗；
 *   - 合法构建器输出保持原样；
 *   - 文本与属性转义；
 *   - 非白名单内容 → ''。
 */
const { test } = require('node:test');
const assert = require('node:assert');
const { sanitizeSvg } = require('../../shared/presentation/svg-sanitizer.js');

test('P28-23 合法 SVG 原样保留', function () {
  const ok = '<svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg">' +
    '<rect x="1" y="2" width="30" height="10" fill="#fff" stroke="#27324a" stroke-width="2"/>' +
    '<text x="5" y="6" font-size="14">3 + 4</text></svg>';
  assert.strictEqual(sanitizeSvg(ok), ok);
});

test('P28-23 嵌套 g / 渐变 / 几何元素保持', function () {
  const svg = '<svg><defs><linearGradient id="lg"><stop offset="0" stop-color="#fff"/></linearGradient></defs>' +
    '<g transform="translate(1,2)"><rect fill="url(#lg)" width="3" height="3"/><path d="M0 0 L4 4"/></g></svg>';
  assert.strictEqual(sanitizeSvg(svg), svg);
});

test('P28-23 script 子树整体移除', function () {
  const out = sanitizeSvg('<svg><script>alert(1)</script><rect width="4"/></svg>');
  assert.ok(!/<script/i.test(out));
  assert.ok(out.indexOf('rect') !== -1);
});

test('P28-23 事件属性剔除（onload / onmouseover / onclick）', function () {
  const svg = '<svg onload="evil()"><circle cx="1" cy="1" r="2" onmouseover="x()" onclick="y()"/></svg>';
  const out = sanitizeSvg(svg);
  assert.ok(!/onload|onmouseover|onclick|evil|x\(\)|y\(\)/i.test(out));
  assert.ok(out.indexOf('circle') !== -1);
});

test('P28-23 foreignObject / image / iframe / object 剔除', function () {
  ['<foreignObject><div onclick="x()">hi</div></foreignObject>',
   '<image href="x" onerror="x()"/>',
   '<iframe src="https://x/"/>',
   '<object data="x"/>'].forEach(function (snippet) {
    const out = sanitizeSvg('<svg>' + snippet + '<rect width="3" height="1"/></svg>');
    assert.ok(out.indexOf('rect') !== -1, '保留安全元素: ' + snippet);
    assert.ok(!/foreignObject|image|iframe|object\b|onerror|onclick/i.test(out), '清洗: ' + snippet);
  });
});

test('P28-23 style url(javascript:) 剔除', function () {
  const out = sanitizeSvg('<svg style="background:url(javascript:alert(1))"><path d="M0 0"/></svg>');
  assert.ok(!/url\s*\(|javascript|alert/i.test(out));
  assert.ok(out.indexOf('path') !== -1);
});

test('P28-23 文本与属性值 XML 转义', function () {
  const out = sanitizeSvg('<svg><text x="0" y="0">1 < 2 & "q"</text></svg>');
  assert.ok(out.indexOf('&lt;') !== -1 && out.indexOf('&amp;') !== -1);
});

test('P28-23 注释丢弃', function () {
  const out = sanitizeSvg('<svg><!-- <script> --><line x1="0" y1="0" x2="1" y2="1"/></svg>');
  assert.ok(out.indexOf('<!') === -1);
  assert.ok(out.indexOf('line') !== -1);
});

test('P28-23 非 SVG 垃圾/空输入返回空串', function () {
  assert.strictEqual(sanitizeSvg(''), '');
  assert.strictEqual(sanitizeSvg('<a href="javascript:alert(1)">x</a>'), '');
  assert.strictEqual(sanitizeSvg(undefined), '');
});