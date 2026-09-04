'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RenderOptions = require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
const RenderResult = require(path.join(ROOT, 'shared', 'presentation', 'render-result.js'));
const LegacyAdapter = require(path.join(ROOT, 'shared', 'presentation', 'legacy-svg-adapter.js'));
const SVGRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
const HTMLRenderer = require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));
const Renderer = require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));

// svg-*.js 需先于首次渲染就绪（浏览器端由脚本/延迟加载保证；Node 测试显式前置），
// 否则 svg-registry 的懒种子扫描捕获不到 geometry/calculation/makeTen 生成器。
require(path.join(ROOT, 'shared', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg-geometry.js'));
require(path.join(ROOT, 'shared', 'svg-calculation.js'));

// ============ M7-R07 统一 renderOptions ============
test('M7-R07 screen 默认值', () => {
  const ro = RenderOptions.normalize(undefined, 'screen');
  assert.strictEqual(ro.mode, 'screen');
  assert.strictEqual(ro.theme, 'default');
  assert.strictEqual(ro.device, 'desktop');
  assert.strictEqual(ro.density, 'normal');
});

test('M7-R07 print 默认值（paper A4 / density compact）', () => {
  const ro = RenderOptions.normalize({}, 'print');
  assert.strictEqual(ro.mode, 'print');
  assert.strictEqual(ro.paper, 'A4');
  assert.strictEqual(ro.density, 'compact');
});

test('M7-R07 normalize 不修改调用方输入', () => {
  const input = { mode: 'screen', theme: 'dark' };
  const ro = RenderOptions.normalize(input);
  assert.deepStrictEqual(Object.keys(input).sort(), ['mode', 'theme']);
  assert.strictEqual(ro.theme, 'dark');
  assert.strictEqual(input.theme, 'dark');
});

test('M7-R07 非法 mode 回落 screen', () => {
  const ro = RenderOptions.normalize({ mode: 'bogus' });
  assert.strictEqual(ro.mode, 'screen');
});

test('M7-R07 validate 校验', () => {
  assert.throws(() => RenderOptions.validate({ mode: 'nope' }), /mode 非法/);
  assert.strictEqual(RenderOptions.validate(RenderOptions.normalize()), true);
});

// ============ M7-R05 RenderResult 契约 ============
test('M7-R05 RenderResult 结构 + 元数据', () => {
  const r = RenderResult.create({ id: 'q1', questionType: 'calc' }, '<div></div>', '<svg/>');
  assert.strictEqual(r.html, '<div></div>');
  assert.strictEqual(r.graphic, '<svg/>');
  assert.strictEqual(r.metadata.renderer, 'presentation.v1');
  assert.ok(r.metadata.version);
  assert.strictEqual(r.id, 'q1');
});

test('M7-R05 RenderResult 禁带 plugin/generator/difficultyParams', () => {
  const ok = RenderResult.create({}, '<div></div>');
  ok.plugin = 'x';
  const c = RenderResult.validate(ok);
  assert.strictEqual(c.valid, false);
  assert.ok(c.errors.some(e => e.indexOf('plugin') !== -1));
});

test('M7-R05 graphic 缺省为空串', () => {
  const r = RenderResult.create({}, '<div></div>');
  assert.strictEqual(r.graphic, '');
  assert.strictEqual(RenderResult.validate(r).valid, true);
});

// ============ M7-R04 Legacy SVG Adapter ============
test('M7-R04 question.svg → graphic.custom.rawSvg', () => {
  const g = LegacyAdapter.convert({ q: '看图', svg: '<svg xmlns="x"><circle/></svg>' });
  assert.strictEqual(g.type, 'custom');
  assert.strictEqual(g.params.rawSvg, '<svg xmlns="x"><circle/></svg>');
});

test('M7-R04 graphic 描述符原样返回', () => {
  const g = LegacyAdapter.convert({ graphic: { type: 'geometry', subtype: 'square', params: { size: 4 } } });
  assert.strictEqual(g.type, 'geometry');
  assert.strictEqual(g.subtype, 'square');
});

test('M7-R04 无图返回 null', () => {
  assert.strictEqual(LegacyAdapter.convert({ prompt: '1+1=' }), null);
  assert.strictEqual(LegacyAdapter.convert(null), null);
});

// ============ M7-R03 SVG Renderer ============
test('M7-R03 register + custom rawSvg', () => {
  const g = SVGRegistry.render({ type: 'custom', params: { rawSvg: '<svg></svg>' } });
  assert.ok(g.indexOf('<svg') === 0);
  SVGRegistry.register('shape-test', 'box', () => '<svg><rect/></svg>');
  const out = SVGRegistry.render({ type: 'shape-test', subtype: 'box', params: {} });
  assert.ok(out.indexOf('rect') !== -1);
});

test('M7-R03 未注册类型返回空串', () => {
  assert.strictEqual(SVGRegistry.render({ type: 'nope', subtype: 'x', params: {} }), '');
  assert.strictEqual(SVGRegistry.render(null), '');
});

test('M7-R03 几何描述符接入 svg-geometry 生成器', () => {
  const r = Renderer.render({ prompt: '求正方形面积', answer: { value: 16 }, graphic: { type: 'geometry', subtype: 'square', params: { size: 4 } } }, { mode: 'screen' }, 0);
  assert.ok(/^<svg/.test(r.graphic));
  assert.ok(r.graphic.indexOf('rect') !== -1);
});

test('M7-R03 竖式 calculation 描述符（数组/双参适配）', () => {
  const a = SVGRegistry.render({ type: 'calculation', subtype: 'add', params: { values: [456, 378] } });
  assert.ok(/<svg/.test(a) && a.length > 200);
  const m = SVGRegistry.render({ type: 'calculation', subtype: 'mul', params: { a: 123, b: 45 } });
  assert.ok(m.length > 200);
});

// ============ M7-R02 HTML Renderer ============
test('M7-R02 卡片语义类名', () => {
  const html = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', answer: { value: 8 } }, 0, { mode: 'screen' });
  ['question-card', 'question-stem', 'question-answer', 'answer-inp', 'data-index="0"'].forEach(sel => {
    assert.ok(html.indexOf(sel) !== -1, '缺少 ' + sel);
  });
});

// ============ P2: density 契约生效（Issue #1 延伸） ============
test('P2 density=compact → 卡片带 compact 类', () => {
  const html = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', answer: { value: 8 } }, 0, { mode: 'screen', density: 'compact' });
  assert.ok(/class="question-card compact"/.test(html), '应输出 class="question-card compact"');
});

test('P2 density 缺省/normal → 不输出 compact 类（屏幕回归）', () => {
  const def = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', answer: { value: 8 } }, 0, { mode: 'screen' });
  assert.ok(/class="question-card"/.test(def), '缺省应为纯 question-card');
  const norm = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'screen', density: 'normal' });
  assert.ok(/class="question-card"/.test(norm), 'normal 不应带 compact');
});

test('P2 Renderer.render 透传 normalize 后 density（print 默认 compact）', () => {
  const r = Renderer.render({ prompt: '1 + 1 = 2', answer: { value: '2' } }, { mode: 'print' }, 0);
  assert.ok(/class="question-card compact"/.test(r.html), 'print 模式 HTML 应含 compact 类');
  assert.ok(!('density' in r) && !('density' in (r.metadata || {})), 'density 不得进入 RenderResult 元数据');
});

test('M7-R02 图形注入 .question-graphic；无图省略', () => {
  const withG = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'screen', graphic: '<svg/>' });
  assert.ok(withG.indexOf('question-graphic') !== -1);
  const without = HTMLRenderer.render({ prompt: 'p' }, 1, { mode: 'screen', graphic: '' });
  assert.ok(without.indexOf('question-graphic') === -1);
});

test('M7-R02 choice 题渲染选项 + print 模式不留输入框', () => {
  const sq = { prompt: '选答案', answerMode: 'choice', answer: { value: 'B' }, options: ['A 项', 'B 项', 'C 项'] };
  const scr = HTMLRenderer.render(sq, 2, { mode: 'screen' });
  assert.ok(scr.indexOf('question-options') !== -1);
  assert.ok(scr.indexOf('type="radio"') !== -1);
  const prn = HTMLRenderer.render(sq, 2, { mode: 'print' });
  assert.ok(prn.indexOf('option-print') !== -1);
  assert.ok(prn.indexOf('<input') === -1);
});

test('M7-R02 multi 题渲染（answerText 参数修复）', () => {
  // 回归：renderAnswer 曾缺 answerText 形参（调用处传 5 参、签名只收 4 参）
  // 导致 answerMode:'multi' 时 ReferenceError: answerText is not defined。
  const sq = { prompt: '分步计算', answerMode: 'multi', answerText: [2, 2, 2], answer: { value: 8 } };
  const scr = HTMLRenderer.render(sq, 0, { mode: 'screen' });
  assert.ok(scr.indexOf('question-answer-multi') !== -1);
  assert.strictEqual((scr.match(/class="answer-inp"/g) || []).length, 3);
  const print = HTMLRenderer.render(sq, 0, { mode: 'print' });
  assert.ok(print.indexOf('<input') === -1);
});

test('M7-R02 multi 题缺 answerText 回落 1 空（不崩溃）', () => {
  const sq = { prompt: '分步', answerMode: 'multi', answer: { value: [2, 2] } };
  const scr = HTMLRenderer.render(sq, 1, { mode: 'screen' });
  assert.ok(scr.indexOf('question-answer-multi') !== -1);
  assert.strictEqual((scr.match(/class="answer-inp"/g) || []).length, 1);
});

test('M7-R02 HTML 转义防注入', () => {
  const html = HTMLRenderer.render({ prompt: '<script>alert(1)</script>&"' }, 0, { mode: 'screen' });
  assert.ok(html.indexOf('<script>') === -1);
  assert.ok(html.indexOf('&lt;script&gt;') !== -1);
});

// ============ M7-R01/R05 统一 Renderer ============
test('M7-R01 render/renderAll → RenderResult[] + 契约合规', () => {
  const qs = [
    { id: 'q1', prompt: '12 + 7 = ?', answerMode: 'input', answer: { value: 19 } },
    { id: 'q2', prompt: '选一选', answerMode: 'choice', answer: { value: '2' }, options: ['1', '2', '3'] }
  ];
  const all = Renderer.renderAll(qs, { mode: 'screen' }, { columns: 2 });
  assert.strictEqual(all.items.length, 2);
  assert.ok(all.html.indexOf('questions-grid') !== -1);
  assert.strictEqual(all.renderOptions.mode, 'screen');
  const check = Renderer.validateResults(all.items);
  assert.strictEqual(check.valid, true);
});

test('M7-R01 renderer 不修改题目数据', () => {
  const sq = { id: 'q1', prompt: '1+1=', answer: { value: 2 }, graphic: { type: 'custom', params: { rawSvg: '<svg/>' } } };
  const snapshot = JSON.stringify(sq);
  Renderer.render(sq, { mode: 'screen' }, 0);
  assert.strictEqual(JSON.stringify(sq), snapshot);
});

test('M7-R01 legacy q.svg 经适配器渲染', () => {
  const r = Renderer.render({ q: '看图', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>图</text></svg>' }, { mode: 'screen' }, 3);
  assert.ok(/^<svg/.test(r.graphic));
  assert.strictEqual(RenderResult.validate(r).valid, true);
});

test('M7-R06 Print.buildFromQuestions 直接由题组出打印文档', () => {
  const Mod = require(path.join(ROOT, 'shared', 'print.js'));
  const Print = Mod.Print || Mod;
  assert.strictEqual(typeof Print.buildFromQuestions, 'function');
  const html = Print.buildFromQuestions([
    { prompt: '7 × 8 = ?', answerMode: 'input', answer: { value: 56 } },
    { prompt: '选出最大', answerMode: 'choice', options: ['3', '9', '5'], answer: { value: '9' } }
  ], { title: '二年级 数学（2题）', columns: 2 });
  assert.ok(html.indexOf('ps-title') !== -1);
  assert.ok(html.indexOf('question-card') !== -1);
  assert.ok(html.indexOf('<input') === -1, '打印题面不应含输入框');
  assert.ok(html.indexOf('@page') !== -1);
});