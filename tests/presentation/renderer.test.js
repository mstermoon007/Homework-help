'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const RenderOptions = require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
const RenderResult = require(path.join(ROOT, 'shared', 'presentation', 'render-result.js'));
const SVGRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));
const HTMLRenderer = require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));
const Renderer = require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
const SemanticQuestion = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));

// svg-*.js 需先于首次渲染就绪（浏览器端由脚本/延迟加载保证；Node 测试显式前置），
// 否则 svg-registry 的懒种子扫描捕获不到 geometry/calculation/makeTen 生成器。
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-calculation.js'));

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

// ============ M7-R04 graphic 描述符（MATH-14：仅认 SemanticQuestion.graphic） ============
test('M7-R04 graphic 描述符经 graphicOf 原样解析', () => {
  const g = Renderer.graphicOf({ graphic: { type: 'geometry', subtype: 'square', params: { size: 4 } } });
  assert.strictEqual(g.type, 'geometry');
  assert.strictEqual(g.subtype, 'square');
});

test('M7-R04 无图形描述符返回 null', () => {
  assert.strictEqual(Renderer.graphicOf({ prompt: '1+1=' }), null);
  assert.strictEqual(Renderer.graphicOf(null), null);
});

test('MATH-14 legacy q.svg 字段不再被消费（native-only）', () => {
  const r = Renderer.render({ q: '看图', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>图</text></svg>' }, { mode: 'screen' }, 3);
  assert.strictEqual(r.graphic, '');
  assert.strictEqual(RenderResult.validate(r).valid, true);
});

// ============ M7-R03 SVG Renderer ============
test('M7-R03 register + custom rawSvg', () => {
  const g = SVGRegistry.render({ type: 'custom', params: { rawSvg: '<svg></svg>' } });
  assert.strictEqual(g.status, 'SUCCESS');
  assert.ok(g.svg.indexOf('<svg') === 0);
  SVGRegistry.register('shape-test', 'box', () => '<svg><rect/></svg>');
  const out = SVGRegistry.render({ type: 'shape-test', subtype: 'box', params: {} });
  assert.strictEqual(out.status, 'SUCCESS');
  assert.ok(out.svg.indexOf('rect') !== -1);
});

test('M7-R03 未注册类型返回 UNSUPPORTED', () => {
  const r1 = SVGRegistry.render({ type: 'nope', subtype: 'x', params: {} });
  assert.strictEqual(r1.status, 'UNSUPPORTED');
  const r2 = SVGRegistry.render(null);
  assert.strictEqual(r2.status, 'UNSUPPORTED');
});

test('M7-R03 几何描述符接入 svg-geometry 生成器', () => {
  const r = Renderer.render({ prompt: '求正方形面积', answer: { value: 16 }, graphic: { type: 'geometry', subtype: 'square', params: { size: 4 } } }, { mode: 'screen' }, 0);
  assert.ok(/^<svg/.test(r.graphic));
  assert.ok(r.graphic.indexOf('rect') !== -1);
});

test('M7-R03 竖式 calculation 描述符（数组/双参适配）', () => {
  const a = SVGRegistry.render({ type: 'calculation', subtype: 'add', params: { values: [456, 378] } });
  assert.strictEqual(a.status, 'SUCCESS');
  assert.ok(/<svg/.test(a.svg) && a.svg.length > 200);
  const m = SVGRegistry.render({ type: 'calculation', subtype: 'mul', params: { a: 123, b: 45 } });
  assert.strictEqual(m.status, 'SUCCESS');
  assert.ok(m.svg.length > 200);
});

// ============ M7-R02 HTML Renderer ============
test('M7-R02 卡片语义类名', () => {
  const html = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 8 } }, 0, { mode: 'screen' });
  // P28-INLINE-ANSWER-01：横向算式作答框内联于等号后（问号虚化 placeholder），不再有独立 question-answer
  ['question-card', 'question-stem', 'eq-answer', 'answer-inp-inline', 'placeholder="？"', 'data-index="0"'].forEach(sel => {
    assert.ok(html.indexOf(sel) !== -1, '缺少 ' + sel);
  });
  assert.ok(!/question-answer/.test(html), '横向算式不应再输出独立 question-answer');
});

test('P28-INLINE-ANSWER-01 print 模式等号后空白盒（无问号）', () => {
  const html = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 8 } }, 0, { mode: 'print' });
  assert.ok(/eq-answer/.test(html) && /answer-inp-printblank/.test(html), '应渲染等宽空白盒');
  assert.ok(!/placeholder/.test(html) && !/<input/.test(html), 'print 不应含问号或输入框');
});

// ============ P28-FORM-CONTRACT-01 形态契约：response.layout 声明字段 ============
test('P28-FORM-CONTRACT-01 声明 inline-after-equals → 内联 eq-answer（screen）', () => {
  const html = HTMLRenderer.render({ prompt: '6 + 4 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 10 } }, 0, { mode: 'screen' });
  assert.ok(/eq-answer/.test(html), '应输出 .eq-answer 内联作答框');
  assert.ok(/answer-inp-inline/.test(html), '应含内联输入框');
  assert.ok(html.indexOf('6 + 4') !== -1, '应保留等号左侧表达式');
  assert.ok(!/question-answer/.test(html), '不应再输出独立 question-answer 行');
});

test('P28-FORM-CONTRACT-01 缺 response 字段 → 回落 block（形态识别不靠字符串）', () => {
  // 旧行为靠「= ?」结尾正则识别内联；新契约下缺声明即 block，删除正则后字符串不再驱动形态
  const html = HTMLRenderer.render({ prompt: '7 + 1 = ?', answerMode: 'input', answer: { value: 8 } }, 0, { mode: 'screen' });
  assert.ok(html.indexOf('eq-answer') === -1, '缺 response.layout 不应内联');
  assert.ok(/question-answer/.test(html), '应输出独立 question-answer 行（block）');
});

test('P28-FORM-CONTRACT-01 声明 inline 但题干无「= ?」尾缀 → 回落 block（fallback 等价旧正则未匹配）', () => {
  // 多分支生成器非算式分支：声明了 inline 但题干不以「= ?」结尾，回落 block
  const html = HTMLRenderer.render({ prompt: '请计算结果。', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 5 } }, 0, { mode: 'screen' });
  assert.ok(html.indexOf('eq-answer') === -1, '无「= ?」尾缀不应内联');
  assert.ok(/question-answer/.test(html), '应回落 block');
});

test('P28-FORM-CONTRACT-01 选择题即使声明 inline 也不内联（optionsOf 护栏）', () => {
  const html = HTMLRenderer.render({ prompt: '3 + 2 = ?', answerMode: 'choice', response: { layout: 'inline-after-equals' }, options: ['4', '5', '6'], answer: { value: '5' } }, 0, { mode: 'screen' });
  assert.ok(html.indexOf('eq-answer') === -1, '选择题不应内联');
  assert.ok(/question-options/.test(html), '应输出选项区');
});

test('P28-FORM-CONTRACT-01 Schema 认 response.layout 枚举 + normalize 透传', () => {
  const SQ = SemanticQuestion;
  const Schema = SQ.Schema;
  assert.strictEqual(Schema.isValidResponseLayout('inline-after-equals'), true);
  assert.strictEqual(Schema.isValidResponseLayout('block'), true);
  assert.strictEqual(Schema.isValidResponseLayout('bogus'), false);
  // 归一化透传：response 字段经 normalizeSemanticQuestion 保留
  const sq = SQ.normalizeSemanticQuestion({ knowledgePoint: 'math-test-k001', questionType: 'calc', prompt: '1+1=?', answer: { value: 2 }, response: { layout: 'inline-after-equals' } });
  assert.strictEqual(sq && sq.response && sq.response.layout, 'inline-after-equals', 'normalize 应透传 response.layout');
  // Schema 校验：合法 layout 不阻断
  const v = SQ.validateSchema(sq);
  assert.strictEqual(v.valid, true, '合法 layout 不应阻断');
  // 未知 layout 值出 warning（不阻断）
  const sqBad = SQ.normalizeSemanticQuestion({ knowledgePoint: 'math-test-k002', questionType: 'calc', prompt: '2+2=?', answer: { value: 4 }, response: { layout: 'bogus' } });
  const vBad = SQ.validateSchema(sqBad);
  assert.strictEqual(vBad.valid, true, '未知 layout 仅 warning 不阻断');
  assert.ok((vBad.warnings || []).some(function (w) { return w.field === 'response.layout'; }), '应出 response.layout warning');
});

// ============ P2: density 契约生效（Issue #1 延伸） ============
test('P2 density=compact → 卡片带 compact 类', () => {
  const html = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 8 } }, 0, { mode: 'screen', density: 'compact' });
  assert.ok(/class="question-card compact"/.test(html), '应输出 class="question-card compact"');
});

test('P2 density 缺省/normal → 不输出 compact 类（屏幕回归）', () => {
  const def = HTMLRenderer.render({ prompt: '5 + 3 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 8 } }, 0, { mode: 'screen' });
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
    { id: 'q1', prompt: '12 + 7 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 19 } },
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

test('MATH-14 legacy q.svg 不再经适配器渲染（graphic 保持空）', () => {
  // 原 M7-R01 用例断言 q.svg 经 LegacySvgAdapter 渲染；MATH-14 后适配器删除，
  // 仅 SemanticQuestion.graphic 描述符参与渲染，svg 字段被忽略（graphic=''）。
  const r = Renderer.render({ q: '看图', svg: '<svg xmlns="http://www.w3.org/2000/svg"><text>图</text></svg>' }, { mode: 'screen' }, 3);
  assert.strictEqual(r.graphic, '');
});

test('M7-R06 Print.buildFromQuestions 直接由题组出打印文档', () => {
  const Mod = require(path.join(ROOT, 'shared', 'presentation', 'print.js'));
  const Print = Mod.Print || Mod;
  assert.strictEqual(typeof Print.buildFromQuestions, 'function');
  const html = Print.buildFromQuestions([
    { prompt: '7 × 8 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 56 } },
    { prompt: '选出最大', answerMode: 'choice', options: ['3', '9', '5'], answer: { value: '9' } }
  ], { title: '二年级 数学（2题）', columns: 2 });
  assert.ok(html.indexOf('ps-title') !== -1);
  assert.ok(html.indexOf('question-card') !== -1);
  assert.ok(html.indexOf('<input') === -1, '打印题面不应含输入框');
  assert.ok(html.indexOf('@page') !== -1);
});

// ============ FINAL-71 HTML 安全边界：题目/答案/SVG 入 DOM 前必须过边界 ============

test('FINAL-71 题目/选项文本经 esc 边界：敌意载荷只出现为转义文本', () => {
  const hostilePrompt = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
  const sq = {
    prompt: hostilePrompt,
    answerMode: 'choice',
    answer: { value: 'x' },
    options: ['<script>alert(3)</script>', 'x" onerror="alert(4)" y="', '正常选项']
  };
  const html = HTMLRenderer.render(sq, 0, { mode: 'screen' });
  // 原始可执行片段不得出现
  assert.ok(html.indexOf('<script>') === -1, '不得含原始 <script>');
  assert.ok(html.indexOf('<img') === -1, '不得含原始 <img>');
  assert.ok(!/\sonerror\s*=\s*"/.test(html), '不得形成原始 onerror= 属性');
  // 必须以转义形态存在
  assert.ok(html.indexOf('&lt;script&gt;') !== -1, 'script 必须转义');
  assert.ok(html.indexOf('&lt;img') !== -1, 'img 必须转义');
  assert.ok(html.indexOf('&quot;') !== -1, '选项中的双引号必须转义（radio value 属性注入收口）');
  // 合法文本不被破坏
  assert.ok(html.indexOf('正常选项') !== -1);
});

test('FINAL-71 graphicGuard：敌意 SVG 直注 HTMLRenderer 必须整体丢弃', () => {
  const hostile = [
    '<svg><script>alert(1)</script><rect/></svg>',
    '<svg onload="alert(1)"><rect/></svg>',
    '<svg><foreignObject><body onload="x()"/></foreignObject></svg>',
    '<svg><rect fill="url(javascript:alert(1))"/></svg>',
    '<svg><iframe src="javascript:alert(1)"/></svg>',
  ];
  hostile.forEach(function (svg) {
    const html = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'screen', graphic: svg });
    assert.ok(html.indexOf('question-graphic') === -1, '敌意图形不得进入图形区: ' + svg);
    assert.ok(!/<script|onload|foreignObject|javascript:|iframe/i.test(html), '敌意特征不得出现: ' + svg);
  });
  // 对照：白名单内合法 SVG 正常渲染
  const ok = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'screen', graphic: '<svg><rect width="4"/></svg>' });
  assert.ok(ok.indexOf('question-graphic') !== -1);
  assert.ok(ok.indexOf('<rect') !== -1);
});

test('FINAL-71 rawSvg 唯一通道：SVGRegistry custom 敌意输入必须拒收或中和', () => {
  const hostileFeature = /<script|on[a-z]+\s*=|foreignobject|<iframe|<object\b|<embed\b|javascript:|<image\b/i;
  // 无白名单元素 / 纯外联载体 → sanitizer 返回空 → FAILED
  ['<script>alert(1)</script>',
    'javascript:alert(1)',
    '<a href="javascript:alert(1)">x</a>'].forEach(function (raw) {
    const r = SVGRegistry.render({ type: 'custom', params: { rawSvg: raw } });
    assert.strictEqual(r.status, 'FAILED', '必须拒收: ' + raw);
    assert.ok(!('svg' in r), 'FAILED 不得携带 svg: ' + raw);
  });
  // 携带可剥离敌意特征的输入：允许 SUCCESS，但敌意特征必须被白名单清洗净尽
  const neutralizable = [
    '<svg onload="alert(1)"><rect width="2"/></svg>',
    '<svg><script>alert(1)</script><rect width="2"/></svg>',
    '<svg><image href="x" onerror="alert(1)"/><rect width="2"/></svg>'
  ];
  neutralizable.forEach(function (raw) {
    const r = SVGRegistry.render({ type: 'custom', params: { rawSvg: raw } });
    if (r.status === 'SUCCESS') {
      assert.ok(!hostileFeature.test(r.svg), 'SUCCESS 产物不得残留敌意特征: ' + raw + ' => ' + r.svg);
    } else {
      assert.strictEqual(r.status, 'FAILED', '只允许 SUCCESS（已中和）或 FAILED（拒收）: ' + raw);
    }
  });
  // 对照：合法 rawSvg 正常 SUCCESS
  const ok = SVGRegistry.render({ type: 'custom', params: { rawSvg: '<svg viewBox="0 0 10 10"><rect width="3"/></svg>' } });
  assert.strictEqual(ok.status, 'SUCCESS');
  assert.ok(ok.svg.indexOf('rect') !== -1);
});

test('FINAL-71 语义契约：SemanticQuestion 顶层禁止 rawSvg/svg/html（rawSvg 只能在 params 内）', () => {
  const rawSvgSq = { questionType: 'calc', prompt: '1+1=', answer: { value: 2 }, graphic: { type: 'custom', rawSvg: '<svg/>' } };
  const svgSq = { questionType: 'calc', prompt: '1+1=', answer: { value: 2 }, graphic: { type: 'custom', svg: '<svg/>' } };
  const htmlSq = { questionType: 'calc', prompt: '1+1=', answer: { value: 2 }, graphic: { type: 'custom', html: '<div/>' } };
  [rawSvgSq, svgSq, htmlSq].forEach(function (sq) {
    const res = SemanticQuestion.validateSchema(sq);
    assert.ok(res.errors.some(function (e) { return e.code === 'GRAPHIC_INVALID'; }),
      '顶层原始 SVG/HTML 必须 GRAPHIC_INVALID: ' + JSON.stringify(Object.keys(sq.graphic)));
    assert.strictEqual(res.valid, false);
  });
  // 对照：rawSvg 位于 custom.params 内（registry 会强制 sanitize）不触发该 ERROR
  const control = SemanticQuestion.validateSchema({
    questionType: 'calc', prompt: '1+1=', answer: { value: 2 },
    graphic: { type: 'custom', params: { rawSvg: '<svg/>' } }
  });
  assert.ok(!control.errors.some(function (e) { return e.code === 'GRAPHIC_INVALID'; }),
    'params.rawSvg 是受控通道，不应报 GRAPHIC_INVALID');
});

test('FINAL-71 端到端：Renderer 渲染敌意 custom graphic 的题目，成品 HTML 不含任何敌意特征', () => {
  const sq = { prompt: '看图计算', answer: { value: 1 }, graphic: { type: 'custom', params: { rawSvg: '<script>alert(1)</script>' } } };
  const r = Renderer.render(sq, { mode: 'screen' }, 0);
  assert.ok(!/<script|on[a-z]+\s*=|javascript:/i.test(r.html), '成品 HTML 必须干净: ' + r.html);
  assert.ok(!/<script/i.test(r.graphic), 'graphic 字段必须干净: ' + r.graphic);
});

// ============ V5.1.0 judge 教学闭环：二值按钮 + 打印留空 + legacy 适配 ============
test('V5.1.0 judge：归一化后 answerMode=input 仍以 questionType 判为大按钮（屏/打）', () => {
  // 复现浏览器实测根因：createSemanticQuestion 把顶层 answerMode 归一为 'input'，
  // 判断题只能靠 questionType=judge + booleanAnswer 识别，不得回落文本框。
  const sq = {
    questionType: 'judge', answerMode: 'input',
    prompt: '角的两条边越长，角就越大。',
    answer: { value: false, explanation: '角的大小与边的长短无关。' },
    data: { misconception: '误认为角的大小由边的长短决定' }
  };
  const scr = HTMLRenderer.render(sq, 0, { mode: 'screen' });
  assert.ok(scr.indexOf('judge-btn') !== -1, '屏幕态应渲染大按钮');
  assert.strictEqual((scr.match(/judge-btn-true|judge-btn-false/g) || []).length, 2, '正确/错误各一个按钮');
  assert.ok(scr.indexOf('name="q0"') !== -1 && scr.indexOf('value="true"') !== -1, 'true 单选');
  assert.ok(scr.indexOf('value="false"') !== -1, 'false 单选');
  assert.ok(scr.indexOf('answer-inp') === -1, 'judge 不得渲染文本框');
  const prn = HTMLRenderer.render(sq, 0, { mode: 'print' });
  assert.ok(prn.indexOf('正确（　）') !== -1 && prn.indexOf('错误（　）') !== -1, '打印态为括号留空');
});

test('V5.1.0 judge：显式 answerMode=judge 同样走按钮（兼容直造 SQ）', () => {
  const sq = { questionType: 'judge', answerMode: 'judge', prompt: '1 米 = 100 厘米。', answer: { value: true } };
  const html = HTMLRenderer.render(sq, 2, { mode: 'screen' });
  assert.ok(html.indexOf('name="q2"') !== -1);
  assert.ok(html.indexOf('judge-btn') !== -1);
});

test('V5.1.0 judge：render-format 以 questionType 收敛 inputType 并透传解析/错因', () => {
  const RF = require(path.join(ROOT, 'shared', 'presentation', 'render-format.js'));
  const sq = {
    questionType: 'judge', answerMode: 'input',
    prompt: 'p',
    answer: { value: true, explanation: '说法正确。' },
    data: { misconception: null }
  };
  const q = RF.toRenderableQuestion(sq);
  assert.strictEqual(q.inputType, 'judge');
  assert.strictEqual(q.answer, true);
  assert.strictEqual(q.explanation, '说法正确。');
  assert.strictEqual(q.misconception, null);
});

// ============ P28-UI-PRINT-WYSIWYG-01：预览/打印排版同源契约 ============
const fs = require('node:fs');
const PrintMod = require(path.join(ROOT, 'shared', 'presentation', 'print.js'));
const Print = PrintMod.Print || PrintMod;
const coreMod = require(path.join(ROOT, 'shared', 'core', 'core.js'));
const Layout = (typeof globalThis !== 'undefined' && globalThis.PluginUtil && globalThis.PluginUtil.layout) || coreMod.Layout;

test('P28-UI-PRINT-WYSIWYG-01 Print.LAYOUT：A4 契约常量（190mm / 12mm 10mm / 718px）', () => {
  assert.strictEqual(Print.LAYOUT.pageMargin, '12mm 10mm');
  assert.strictEqual(Print.LAYOUT.pageWidthMm, 210);
  assert.strictEqual(Print.LAYOUT.contentWidthMm, 190);
  assert.strictEqual(Print.LAYOUT.printableWidthPx, 718);
});

test('P28-UI-PRINT-WYSIWYG-01 token 兜底值必须与 tokens.css 解析值一致（防两处真相漂移）', () => {
  const tokensCss = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'tokens.css'), 'utf8');
  Object.keys(Print.TOKEN_DEFAULTS).forEach(function (name) {
    const m = tokensCss.match(new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*([^;]+);'));
    assert.ok(m, 'tokens.css 应定义 ' + name);
    assert.strictEqual(m[1].trim(), Print.TOKEN_DEFAULTS[name], name + ' 兜底值漂移');
  });
});

test('P28-UI-PRINT-WYSIWYG-01 buildPrintDocument：CSP 禁 script / @page 同源 / shell 190mm', () => {
  const doc = Print.buildPrintDocument({ title: '二年级 数学', extraCss: '.x{}', bodyHtml: '<b>B</b>' });
  assert.ok(doc.indexOf("script-src 'none'") !== -1, 'CSP 必须显式禁 script');
  assert.ok(doc.indexOf('margin: 12mm 10mm') !== -1, '@page 边距取 LAYOUT');
  assert.ok(doc.indexOf('max-width: 190mm') !== -1, 'shell 内容宽 190mm');
  assert.ok(doc.indexOf('class="print-sheet"') !== -1 && doc.indexOf('ps-title') !== -1, '双链统一 shell/标题');
  assert.ok(doc.indexOf('二年级 数学') !== -1, '标题经转义后注入');
  assert.ok(doc.indexOf('10mm 8mm') === -1, '不得再出现旧直渲链边距');
});

test('P28-UI-PRINT-WYSIWYG-01 judge 打印形态唯一实现：克隆链去按钮 + （　）', () => {
  const css = Print.buildJudgePrintCss();
  assert.ok(css.indexOf('.judge-input { display:none; }') !== -1, 'radio 隐藏');
  assert.ok(css.indexOf('.judge-btn::after { content:"（　）"; }') !== -1, '按钮后输出空括号');
  assert.ok(css.indexOf('border:none !important') !== -1, '去边框');
  assert.ok(css.indexOf('.judge-mark { display:none; }') !== -1, '去 ✓/✗ 标记');
});

test('P28-UI-PRINT-WYSIWYG-01 layout 单一阈值：prompt 度量 / graphic 加分 / spanForLength', () => {
  assert.strictEqual(Layout.coreText({ prompt: '5 + 3 = ?' }), '5 + 3 = ?', 'coreText 认 SemanticQuestion.prompt');
  assert.ok(Layout.renderLen({ prompt: '一'.repeat(50) }) >= 50);
  assert.ok(Layout.renderLen({ prompt: '看图列式', graphic: { type: 'geometry' } }) >= 10, '图形题 +8 占宽');
  assert.strictEqual(Layout.spanForLength(50, 3), '1 / -1');
  assert.strictEqual(Layout.spanForLength(26, 3), 'span 2');
  assert.strictEqual(Layout.spanForLength(26, 1), 'span 1', '单列时最多 span 1');
  assert.strictEqual(Layout.spanForLength(25, 4), null);
});

test('P28-UI-PRINT-WYSIWYG-01 coreText 与 html-renderer promptOf 同源（DTO 嵌套题干不漏度量）', () => {
  assert.strictEqual(Layout.coreText({ content: { prompt: 'content 题干' } }), 'content 题干');
  assert.strictEqual(Layout.coreText({ question: { prompt: '嵌套题干' } }), '嵌套题干');
  assert.strictEqual(Layout.coreText({ stem: 'stem 题干' }), 'stem 题干');
  assert.strictEqual(Layout.coreText({ q: 'legacy q' }), 'legacy q');
  assert.strictEqual(Layout.coreText({ text: 'legacy text' }), 'legacy text');
  assert.strictEqual(Layout.coreText({ question: 'legacy 字符串题干' }), 'legacy 字符串题干');
});

test('P28-UI-PRINT-WYSIWYG-01 直渲链：题干在 content.prompt 的原始 DTO 也必须正确列跨', () => {
  const qs = [
    { content: { prompt: '1' }, answerMode: 'input', answer: { value: 1 } },
    { content: { prompt: '应'.repeat(30) }, answerMode: 'input', answer: { value: 'x' } },
    { content: { prompt: '应'.repeat(60) }, answerMode: 'input', answer: { value: 'y' } }
  ];
  const html = Print.buildFromQuestions(qs, { title: 'DTO卷', columns: 2 });
  assert.ok(html.indexOf('grid-column:span 2') !== -1, '30 字 content.prompt → span 2');
  assert.ok(html.indexOf('grid-column:1 / -1') !== -1, '60 字 content.prompt → 通栏');
});

test('P28-UI-PRINT-WYSIWYG-01 html-renderer span 白名单：合法透传 / 非法拒绝', () => {
  const ok = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'print', span: '1 / -1' });
  assert.ok(ok.indexOf('style="grid-column:1 / -1"') !== -1);
  const ok2 = HTMLRenderer.render({ prompt: 'p' }, 1, { mode: 'print', span: 'span 2' });
  assert.ok(ok2.indexOf('style="grid-column:span 2"') !== -1);
  const evil = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'print', span: 'x:expression(alert(1))' });
  assert.ok(evil.indexOf('expression') === -1, '非白名单 span 不得进入 style');
});

test('P28-UI-PRINT-WYSIWYG-01 renderAll 透传 spans：长题通栏 / 短题单格', () => {
  const all = Renderer.renderAll(
    [{ prompt: '1' }, { prompt: '应'.repeat(50) }],
    { mode: 'print' },
    { columns: 4, spans: ['span 1', '1 / -1'] }
  );
  assert.ok(all.html.indexOf('style="grid-column:span 1"') !== -1);
  assert.ok(all.html.indexOf('style="grid-column:1 / -1"') !== -1);
});

test('P28-UI-PRINT-WYSIWYG-01 直渲链：按 718px 动态列数 + 长题列跨 + 双链同源骨架', () => {
  const qs = [];
  for (let i = 0; i < 8; i++) qs.push({ prompt: String(i), answerMode: 'input', answer: { value: i } });
  qs.push({ prompt: '应'.repeat(60), answerMode: 'input', answer: { value: '长' } });
  const html = Print.buildFromQuestions(qs, { title: '动态列数卷' });
  assert.ok(html, '应成功构建');
  assert.ok(html.indexOf('--grid-cols:4') !== -1, '8 张极短卡 @718px 应排 4 列');
  assert.ok(html.indexOf('grid-column:1 / -1') !== -1, '60 字长题应通栏');
  assert.ok(html.indexOf('margin: 12mm 10mm') !== -1 && html.indexOf("script-src 'none'") !== -1,
    '直渲链与克隆链共用骨架（边距/CSP）');
  assert.ok(html.indexOf('10mm 8mm') === -1, '旧边距不得回归');
});

test('P28-UI-PRINT-WYSIWYG-01 固定列数（fixed）不输出列跨，列数以调用方为准', () => {
  const html = Print.buildFromQuestions(
    [{ prompt: '应'.repeat(60), answerMode: 'input', answer: { value: 'x' } }],
    { title: '固定卷', columns: 2, fixed: true }
  );
  assert.ok(html.indexOf('--grid-cols:2') !== -1);
  assert.ok(html.indexOf('grid-column:') === -1, '固定模式不做列跨');
});
