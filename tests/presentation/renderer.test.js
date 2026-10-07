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
require(path.join(ROOT, 'shared', 'svg', 'svg-diagram.js')); // P31-07：diagram brace（graphic-small 真实渲染）

// ============ M7-R07 统一 renderOptions ============
test('M7-R07 screen 默认值', () => {
  const ro = RenderOptions.normalize(undefined, 'screen');
  assert.strictEqual(ro.mode, 'screen');
  assert.strictEqual(ro.theme, 'default');
  assert.strictEqual(ro.device, 'desktop');
  // P31-FIX-10：density 已从 renderOptions 默认值移除（密度档位唯一走 QuestionLayoutPlan）
  assert.ok(!('density' in ro), 'screen 默认不再含 density');
});

test('M7-R07 print 默认值（paper A4；P31-FIX-10 起无 density）', () => {
  const ro = RenderOptions.normalize({}, 'print');
  assert.strictEqual(ro.mode, 'print');
  assert.strictEqual(ro.paper, 'A4');
  assert.ok(!('density' in ro), 'print 默认不再含 density');
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

// ============ P28-FIX-C：normalize 必须透传 spiralLevel（与 D003 context 同型漏映射） ============
test('P28-FIX-C normalizeSemanticQuestion 透传 spiralLevel（保留/缺省/非法兜底）', () => {
  const SQ = SemanticQuestion;
  assert.strictEqual(SQ.normalizeSemanticQuestion({ questionType: 'calc', prompt: 'p', answer: { value: 1 }, spiralLevel: 2 }).spiralLevel, 2, 'spiralLevel=2 应保留');
  assert.strictEqual(SQ.normalizeSemanticQuestion({ questionType: 'calc', prompt: 'p', answer: { value: 1 }, spiralLevel: 6 }).spiralLevel, 6, 'spiralLevel=6 应保留');
  assert.strictEqual(SQ.normalizeSemanticQuestion({ questionType: 'calc', prompt: 'p', answer: { value: 1 } }).spiralLevel, 1, '缺省应回落 1');
  assert.strictEqual(SQ.normalizeSemanticQuestion({ questionType: 'calc', prompt: 'p', answer: { value: 1 }, spiralLevel: 'abc' }).spiralLevel, 1, '非法值应回落 1');
});

// ============ P31-FIX-10：裸 compact 死双轨删除（原 P2 density 契约，随证据重写） ============
// 原 P2.1/P2.2「renderOptions.density='compact' → 卡片挂裸 .compact 类」已物理删除：
// 其 CSS 早于 P28-UI-PRINTSTYLE-CLEANUP-01 删除（门禁 21 矩阵登记），生产方幸存为零消费挂类；
// P31-04 后密度档位唯一轨道=QuestionLayoutPlan 的 density-* 白名单类（见下方 P31-04/07 用例）。
test('P31-FIX-10 renderOptions 传 density=compact 不再产生裸 compact 类（防双轨回归）', () => {
  const html = HTMLRenderer.render(
    { prompt: '5 + 3 = ?', answerMode: 'input', response: { layout: 'inline-after-equals' }, answer: { value: 8 } },
    0, { mode: 'screen', density: 'compact' });
  assert.ok(!/class="question-card compact"/.test(html), '裸 compact 类不得复活');
  assert.ok(/class="question-card"/.test(html), '无 plan 档位时为纯 question-card');
});

test('P31-FIX-10 print 默认 renderOptions 不再带 density → 单题 render 不挂裸 compact 类', () => {
  const r = Renderer.render({ prompt: '1 + 1 = 2', answer: { value: '2' } }, { mode: 'print' }, 0);
  assert.ok(!/class="question-card compact"/.test(r.html), 'print 模式不得再含裸 compact 类（单题直渲无 plan 档位）');
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
// P31-02：排版 SSOT 物理迁至 shared/presentation/layout.js（全局 QuestionLayout）
const Layout = (typeof globalThis !== 'undefined' && globalThis.QuestionLayout)
  || require(path.join(ROOT, 'shared', 'presentation', 'layout.js'));

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

test('P31-03 layout 决策表：prompt/graphic 度量保留；跨列改由 plan 结构决策（spanForLength 已删）', () => {
  assert.strictEqual(Layout.coreText({ prompt: '5 + 3 = ?' }), '5 + 3 = ?', 'coreText 认 SemanticQuestion.prompt');
  assert.ok(Layout.renderLen({ prompt: '一'.repeat(50) }) >= 50);
  assert.ok(Layout.renderLen({ prompt: '看图列式', graphic: { type: 'geometry' } }) >= 10, '图形题 +8 占宽度量保留（列数估算仍消费）');
  assert.strictEqual(typeof Layout.spanForLength, 'undefined', 'P31-05：纯长度跨列函数已随克隆链物理删除');
  // B 桶：geometry 短题 → expanded/full；F 桶：calc 长题不再被长度拉宽 → compact/span1
  const p = Layout.plan([
    { questionType: 'geometry', prompt: '看图' },
    { questionType: 'calc', prompt: '计'.repeat(60) }
  ], { columns: 3 });
  assert.deepStrictEqual([p.items[0].density, p.items[0].span], ['expanded', 'full']);
  assert.deepStrictEqual([p.items[1].density, p.items[1].span], ['compact', 1]);
  // 标准档长度分层仅对 choice/classify/apply/未知 DTO 保留：26 半宽 / 50 通栏
  const dto = Layout.plan([
    { content: { prompt: '应'.repeat(30) } },
    { content: { prompt: '应'.repeat(60) } }
  ], { columns: 2 }).items;
  assert.strictEqual(dto[0].span, 2);
  assert.strictEqual(dto[1].span, 'full');
  assert.strictEqual(Layout.spanToCss(dto[0].span), 'span 2');
  assert.strictEqual(Layout.spanToCss(dto[1].span), '1 / -1');
  assert.strictEqual(Layout.spanToCss(1), 'span 1', '单列/单格档');
});

// ============ P31-04：plan 字段真实被 HTML 消费（渲染后不再改 DOM） ============

test('P31-04 renderAll 先算 plan 并透传：span/density/stem/options 档位出现在成品 HTML', () => {
  const qs = [
    { questionType: 'geometry', prompt: '看图', graphic: { type: 'geometry', subtype: 'triangle', params: {} } },
    { questionType: 'calc', prompt: '计'.repeat(60) },
    { questionType: 'choice', prompt: '选式', options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] },
    { questionType: 'fill', prompt: '列式：6 × 5 = ？', response: { layout: 'inline-after-equals' } }
  ];
  const all = Renderer.renderAll(qs, { mode: 'screen' });
  // 容器列数来自 plan（cols-N 类 + --grid-cols 内联，CSS .q-grid 消费）
  assert.ok(/cols-[1-6]/.test(all.html), '容器带 cols-N 类');
  assert.ok(/--grid-cols:[1-6]/.test(all.html), '容器注入 --grid-cols');
  // span：geometry → 通栏内联（html-renderer 白名单形态）；P31-05：expanded/keep 卡随 style 附带分页内联
  assert.ok(all.html.indexOf('style="grid-column:1 / -1;page-break-inside:avoid;break-inside:avoid"') !== -1, 'geometry 通栏 span + keep 分页经渲染期注入');
  // density 档位类（plan 决策，白名单 density-*）
  assert.ok(/question-card[^"]*density-expanded/.test(all.html), 'geometry/带图题 expanded 档位类');
  assert.ok(/question-card[^"]*density-compact/.test(all.html), 'calc 题 compact 档位类');
  // options mode 类（G 桶：表达式选项 two-column）
  assert.ok(/class="question-options options-two-column"/.test(all.html), '选项容器 two-column mode 类');
  // stem 类（H 桶：inline-after-equals → stem-inline）
  assert.ok(/question-card[^"]*stem-inline/.test(all.html), 'inline-after-equals 题 stem-inline 类');
});

test('P31-04 graphicGear 档位类：.question-graphic 带 graphic-medium；非法档位不进 class', () => {
  const html = HTMLRenderer.render({ questionType: 'fill', prompt: '看图填空' }, 0,
    { mode: 'screen', graphic: '<svg></svg>', graphicGear: 'medium' });
  assert.ok(/class="question-graphic graphic-medium"/.test(html), 'medium 档 → graphic-medium 类');
  const noGear = HTMLRenderer.render({ questionType: 'fill', prompt: '纯文本' }, 0,
    { mode: 'screen', graphic: '<svg></svg>' });
  assert.ok(/class="question-graphic"/.test(noGear), '无档位不带 graphic-* 类');
  const evil = HTMLRenderer.render({ questionType: 'fill', prompt: 'p' }, 0,
    { mode: 'screen', graphic: '<svg></svg>', graphicGear: 'x:expression(alert(1))' });
  assert.ok(evil.indexOf('expression') === -1, '白名单外档位不得进入 class');
});

test('P31-04 renderGrid：plan 列数注入 --grid-cols；dense flow 随容器（接替 fitColumns 网格语义）', () => {
  const html = HTMLRenderer.renderGrid([{ html: '<div class="question-card"></div>' }], { columns: 2 });
  assert.ok(html.indexOf('cols-2') !== -1 && html.indexOf('--grid-cols:2') !== -1);
  assert.ok(html.indexOf('grid-auto-flow:row dense') !== -1, 'dense flow 随渲染期注入');
});

test('P31-04 layout 导出：fitColumns 已物理删除（主链渲染后零 DOM 改写）', () => {
  assert.strictEqual(typeof Layout.fitColumns, 'undefined', 'fitColumns 零消费者后删除');
  assert.strictEqual(typeof Layout.plan, 'function');
  assert.strictEqual(typeof Layout.planFor, 'function', 'P31-05：plan 缓存取数入口');
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

// ============ P31-05：plan 缓存（planFor）+ 克隆/直渲链统一取数 + 分页档位 ============

test('P31-05 planFor 缓存：同题集对象 + 同决策面返回同一结果；决策面变化重算；不同题集不共享', () => {
  const qs = [
    { questionType: 'geometry', prompt: '看图' },
    { questionType: 'calc', prompt: '计'.repeat(60) }
  ];
  const a = Layout.planFor(qs, { mode: 'print', availWidth: 718 });
  assert.strictEqual(Layout.planFor(qs, { mode: 'print', availWidth: 718 }), a, '缓存命中：同一引用');
  assert.notStrictEqual(Layout.planFor(qs, { mode: 'print', availWidth: 718, columns: 2 }), a, '决策面（columns）变化 → 重算');
  assert.strictEqual(Layout.planFor(qs, { mode: 'print', availWidth: 718, columns: 2 }).columns, 2, '显式 columns 生效');
  assert.notStrictEqual(Layout.planFor(qs, { mode: 'screen', availWidth: 718 }), a, '决策面（mode）变化 → 重算');
  assert.notStrictEqual(Layout.planFor([...qs], { mode: 'print', availWidth: 718 }), a, '不同题集对象不共享缓存');
  const set = { questions: qs, meta: { columns: 3 } };
  const d = Layout.planFor(set, { mode: 'print', availWidth: 718 });
  assert.strictEqual(Layout.planFor(set, { mode: 'print', availWidth: 718 }), d, '{questions,meta} 包装形态同样命中');
  assert.strictEqual(d.columns, a.columns, 'P31-10：meta.columns 死数据面已删，对象形态与数组形态同动态列数');
});

test('P31-05 renderAll 经 planFor 取数：渲染列数与直取 planFor 同键同值', () => {
  const qs = [
    { questionType: 'geometry', prompt: '看图', graphic: { type: 'geometry', subtype: 'triangle', params: {} } },
    { questionType: 'calc', prompt: '计'.repeat(60) },
    { questionType: 'choice', prompt: '选式', options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] }
  ];
  const all = Renderer.renderAll(qs, { mode: 'screen' }, { availWidth: 718 });
  const cached = Layout.planFor(qs, { mode: 'screen', availWidth: 718 });
  assert.ok(all.html.indexOf('--grid-cols:' + cached.columns) !== -1, '渲染容器列数 = planFor 缓存结果');
});

test('P31-05 plan.break 真实消费：expanded 卡内联不跨页 + PRINT_QCSS 分页三档随 density 类', () => {
  const qs = [
    { questionType: 'geometry', prompt: '看图', graphic: { type: 'geometry', subtype: 'triangle', params: {} } },
    { questionType: 'calc', prompt: '计'.repeat(60) },
    { questionType: 'choice', prompt: '选式', options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] }
  ];
  const html = Print.buildFromQuestions(qs, { title: '分页卷' });
  // expanded（geometry）卡：span full + break:keep → 内联 page-break（最高优先不拆卡）
  assert.ok(html.indexOf('style="grid-column:1 / -1;page-break-inside:avoid;break-inside:avoid"') !== -1,
    'expanded/keep 卡内联避免跨页拆分');
  // 分页三档 CSS（消费渲染期注入的 density-* 类）
  assert.ok(html.indexOf('.density-compact { page-break-inside:auto; break-inside:auto; }') !== -1, 'compact 档连续排');
  assert.ok(html.indexOf('.density-standard { page-break-inside:avoid; break-inside:avoid; }') !== -1, 'standard 档不拆卡');
  assert.ok(html.indexOf('.density-expanded { page-break-inside:avoid; break-inside:avoid; }') !== -1, 'expanded 档不拆卡');
  // 非 keep 卡不输出内联分页（auto 档交 CSS）
  assert.ok(html.indexOf('style="grid-column:span 1;page-break-inside') === -1, '非 keep 卡无内联分页');
  // 旧无差别 avoid / :has 兜底规则不得回归
  assert.ok(html.indexOf(':has(') === -1, 'P3.3 :has 兜底规则已由分页三档取代');
});

test('P31-05 html-renderer break 白名单：keep 输出内联分页；auto/非白名单不进 style', () => {
  const keep = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'print', break: 'keep' });
  assert.ok(keep.indexOf('style="page-break-inside:avoid;break-inside:avoid"') !== -1);
  const auto = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'print', break: 'auto' });
  assert.ok(auto.indexOf('page-break-inside') === -1, 'auto 不输出分页内联');
  const evil = HTMLRenderer.render({ prompt: 'p' }, 0, { mode: 'print', break: 'x"onmouseover="alert(1)' });
  assert.ok(evil.indexOf('onmouseover') === -1, '白名单外 break 不得进入 style');
});

test('P31-05 Print.tokenVal：Node 回落契约字面量（与 TOKEN_DEFAULTS 同源）', () => {
  assert.strictEqual(Print.tokenVal('--grid-gap-print'), '8px 6px');
  assert.strictEqual(Print.tokenVal('--card-padding-print'), '6px 8px');
  assert.strictEqual(Print.tokenVal('--unknown-token'), undefined, '未知 token 无兜底');
});

test('P31-05 打印链收口：克隆链二次度量与路由列数决策已物理删除', () => {
  assert.strictEqual(typeof Layout.gridColumnsFromDom, 'undefined', '克隆 DOM 列数估算已删');
  assert.strictEqual(typeof Layout.applySpanning, 'undefined', '克隆 DOM 列跨重写已删');
  assert.strictEqual(typeof Layout.spanForLength, 'undefined', '纯长度跨列已删');
  assert.strictEqual(typeof Print.ROUTES, 'undefined', 'PRINT_ROUTES（beforeClone 列数覆写）已删');
  const printSrc = fs.readFileSync(path.join(ROOT, 'shared', 'presentation', 'print.js'), 'utf8');
  assert.ok(printSrc.indexOf('options.pageType') === -1, 'pageType 参数已删（零调用语义）');
});

// ============ P31-06 raw 题集转正 + 唯一应急链 ============

test('P31-06 ① 错题本/重做 raw 题集（Legacy DTO __semantic）经 renderAll 正常渲染：完整卡 + data-index + 批改绑定结构', () => {
  const RF = require(path.join(ROOT, 'shared', 'presentation', 'render-format.js'));
  const sqs = [
    { id: 'r1', questionType: 'calc', prompt: '3 + 4 = ?', answerMode: 'input', answer: { value: 7 } },
    { id: 'r2', questionType: 'choice', prompt: '选答案', answerMode: 'choice', options: ['4', '5', '6'], answer: { value: '5' } },
    { id: 'r3', questionType: 'judge', prompt: '判断：3 > 2', answer: { value: true } }
  ];
  // redo 场景真实数据形态：RenderFormat Legacy DTO（带 __semantic 原始 SQ 引用），
  // 页面 renderRawSetHtml 经 __semantic 取 SQ 走唯一渲染链（renderGeneric 已物理删除）。
  const legacy = RF.toRenderableQuestions(sqs);
  assert.ok(legacy.every(q => q.__semantic), '前置：raw 题集每条带 __semantic 引用');
  const html = Renderer.renderAll(legacy.map(q => q.__semantic || q), { mode: 'screen' }, { availWidth: 718 }).html;
  assert.strictEqual((html.match(/class="question-card/g) || []).length, 3, '三题三卡');
  [0, 1, 2].forEach(i => {
    assert.ok(html.indexOf('data-index="' + i + '"') !== -1, 'data-index 连续（collectAnswers/computeResult 绑定面）');
  });
  assert.ok(html.indexOf('3 + 4 = ?') !== -1, '题干完整');
  assert.ok(/question-options/.test(html) && /type="radio"/.test(html), 'choice 输出真实选项 radio（不再退化为文本框）');
  assert.ok(/name="q2" value="true"/.test(html), 'judge 输出同组 radio（value=true/false，radio 同组批改契约保持）');
});

test('P31-06 ② SVG 失败（status≠SUCCESS）题目仍完整显示：题干/作答在，失败图形不注入', () => {
  const sq = { questionType: 'fill', prompt: '看图填名称', answerMode: 'input', answer: { value: '三角形' }, graphic: { type: 'no-such-graphic-type' } };
  const all = Renderer.renderAll([sq], { mode: 'screen' }, {});
  assert.notStrictEqual(all.items[0]._gfxStatus, 'SUCCESS', '图形状态非 SUCCESS');
  assert.ok(all.html.indexOf('看图填名称') !== -1, '题干仍完整显示');
  assert.ok(/answer-inp/.test(all.html), '作答输入框仍在');
  assert.ok(!/<svg/.test(all.html) && all.html.indexOf('question-graphic') === -1, '失败图形不注入也不吞题');
});

test('P31-06 ③ 单题渲染异常 → 唯一应急出口 renderEmergency（纯文本题干 + 标准作答，无选项区）', () => {
  const orig = HTMLRenderer.render;
  HTMLRenderer.render = function () { throw new Error('模拟渲染器异常'); };
  try {
    const sqs = [
      { questionType: 'choice', prompt: '应急选择题', answerMode: 'choice', options: ['A 项', 'B 项'], answer: { value: 'A 项' } },
      { questionType: 'calc', prompt: '应急算式 2 + 2 = ?', answer: { value: 4 } }
    ];
    const all = Renderer.renderAll(sqs, { mode: 'screen' }, {});
    assert.ok(!/question-options/.test(all.html), '应急卡无选项区（正常 choice 链必有，据此可辨应急产物）');
    assert.ok(all.html.indexOf('应急选择题') !== -1 && all.html.indexOf('应急算式') !== -1, '纯文本题干不丢');
    assert.strictEqual((all.html.match(/class="answer-inp"/g) || []).length, 2, '每题一个标准作答 input');
    [0, 1].forEach(i => {
      assert.ok(all.html.indexOf('data-index="' + i + '"') !== -1, 'data-index 绑定保留');
    });
    assert.ok(!all.items.some(r => r.html === ''), '禁止 catch→\'\'：应急产物非空');
  } finally {
    HTMLRenderer.render = orig;
  }
});

test('P31-06 ④ plan 异常 → 安全单列 plan（columns=1 全 compact），渲染不中断', () => {
  const orig = Layout.planFor;
  Layout.planFor = function () { throw new Error('模拟排版决策异常'); };
  try {
    const qs = [
      { questionType: 'calc', prompt: '1 + 1 = ?', answer: { value: 2 } },
      { questionType: 'fill', prompt: '填'.repeat(60), answer: { value: 'x' } }
    ];
    const all = Renderer.renderAll(qs, { mode: 'screen' }, {});
    assert.ok(all.html.indexOf('--grid-cols:1') !== -1, '容器安全单列');
    assert.ok(!/grid-column:span 2|grid-column:1 \/ -1/.test(all.html), '安全档无跨列');
    assert.ok(/density-compact/.test(all.html), '全 compact 档');
    assert.ok(/answer-inp/.test(all.html), '渲染不中断，题目完整');
    assert.strictEqual((all.html.match(/class="question-card/g) || []).length, 2);
  } finally {
    Layout.planFor = orig;
  }
});

// ============ P31-07：graphic/options 档位 CSS 接线 + 打印作答框 token ============

test('P31-07 带图题在三档 density 下 graphic-* 与 density-* 类共存（真实 SVG 成功渲染）', () => {
  const brace = { type: 'diagram', subtype: 'brace', params: { left: 3, right: 5, unit: '个' } };
  const square = { type: 'geometry', subtype: 'square', params: { size: 4 } };
  const cylinder = { type: 'geometry', subtype: 'cylinder', params: { r: 30, height: 60 } };
  const qs = [
    { questionType: 'calc', prompt: '看图列式', graphic: brace, answer: { value: 8 } },        // compact + small
    { questionType: 'choice', prompt: '看图选择', graphic: brace, options: ['3 个', '5 个', '8 个', '9 个'], answer: { value: '8 个' } }, // standard + small
    { questionType: 'fill', prompt: '求正方形面积', graphic: square, answer: { value: 16 } },   // expanded + medium
    { questionType: 'geometry', prompt: '求圆柱体积', graphic: cylinder, answer: { value: 1 } } // expanded + large
  ];
  const all = Renderer.renderAll(qs, { mode: 'screen' }, {});
  // 前置：四题图形均真实渲染（容器存在的前提）
  assert.strictEqual(all.items.filter(r => r._gfxStatus === 'SUCCESS').length, 4, '四图均 SUCCESS');
  assert.ok(/density-compact[^"]*[^>]*>[\s\S]{0,400}?graphic-small/.test(all.html) ||
    /question-card[^"]*density-compact[\s\S]*?question-graphic graphic-small/.test(all.html),
    'compact 卡携带 graphic-small');
  assert.ok(/question-card[^"]*density-standard[\s\S]*?question-graphic graphic-small/.test(all.html),
    'standard 卡携带 graphic-small');
  assert.ok(/question-card[^"]*density-expanded[\s\S]*?question-graphic graphic-medium/.test(all.html),
    'expanded 卡携带 graphic-medium');
  assert.ok(/question-card[^"]*density-expanded[\s\S]*?question-graphic graphic-large/.test(all.html),
    'expanded 卡携带 graphic-large');
});

test('P31-07 components.css 真实消费档位类：图形三档尺寸 + 选项两列网格（tokens 引用）', () => {
  const css = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'components.css'), 'utf8');
  ['.question-graphic.graphic-small svg', '.question-graphic.graphic-medium svg', '.question-graphic.graphic-large svg']
    .forEach(sel => assert.ok(css.indexOf(sel) !== -1, 'CSS 缺图形档位规则: ' + sel));
  assert.ok(/\.question-graphic\.graphic-small svg\s*\{[^}]*var\(--graphic-w-small\)/.test(css), 'small 走 token');
  assert.ok(/\.question-graphic\.graphic-medium svg\s*\{[^}]*var\(--graphic-w-medium\)/.test(css), 'medium 走 token');
  assert.ok(/\.question-graphic\.graphic-large svg\s*\{[^}]*var\(--graphic-w-large\)/.test(css), 'large 走 token');
  assert.ok(/\.question-options\.options-two-column\s*\{[^}]*display:\s*grid/.test(css), 'two-column → 两列网格');
  assert.ok(/grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(css), '两列等宽');
  // 屏幕作答框 96×32 保持（任务书：屏幕保持）
  assert.ok(/\.answer-inp\s*\{[^}]*width:\s*96px;\s*height:\s*32px/.test(css), '屏幕作答框保持 96×32');
});

test('P31-07 tokens.css 定义图形三档宽度 + 打印作答框尺寸（屏打唯一真相）', () => {
  const tokens = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'tokens.css'), 'utf8');
  [
    ['--graphic-w-small: 120px'], ['--graphic-w-medium: 220px'], ['--graphic-w-large: 360px'],
    ['--answer-w-print: 72px'], ['--answer-h-print: 30px']
  ].forEach(([decl]) => assert.ok(tokens.indexOf(decl) !== -1, 'tokens.css 缺: ' + decl));
});

test('P31-07 Print.tokenVal 新 token 兜底 + 与 tokens.css 字面量同源', () => {
  assert.strictEqual(Print.tokenVal('--graphic-w-small'), '120px');
  assert.strictEqual(Print.tokenVal('--graphic-w-medium'), '220px');
  assert.strictEqual(Print.tokenVal('--graphic-w-large'), '360px');
  assert.strictEqual(Print.tokenVal('--answer-w-print'), '72px');
  assert.strictEqual(Print.tokenVal('--answer-h-print'), '30px');
});

test('P31-07 直渲打印文档：图形三档/选项两列规则与屏幕同源；inline 空白盒尺寸走 token', () => {
  const brace = { type: 'diagram', subtype: 'brace', params: { left: 3, right: 5, unit: '个' } };
  const square = { type: 'geometry', subtype: 'square', params: { size: 4 } };
  const cylinder = { type: 'geometry', subtype: 'cylinder', params: { r: 30, height: 60 } };
  const qs = [
    { questionType: 'calc', prompt: '看图列式', graphic: brace, answer: { value: 8 } },
    { questionType: 'choice', prompt: '选算式', graphic: brace, options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'], answer: { value: '15 − 11' } },
    { questionType: 'fill', prompt: '求正方形面积', graphic: square, answer: { value: 16 } },
    { questionType: 'geometry', prompt: '求圆柱体积', graphic: cylinder, answer: { value: 1 } }
  ];
  const html = Print.buildFromQuestions(qs, { title: 'P31-07 档位卷' });
  assert.ok(html.indexOf('.question-graphic.graphic-small svg') !== -1 && html.indexOf('max-width:120px') !== -1, '打印 small 档');
  assert.ok(html.indexOf('.question-graphic.graphic-medium svg') !== -1 && html.indexOf('max-width:220px') !== -1, '打印 medium 档');
  assert.ok(html.indexOf('.question-graphic.graphic-large svg') !== -1 && html.indexOf('max-width:360px') !== -1, '打印 large 档');
  assert.ok(html.indexOf('.question-options.options-two-column') !== -1, '打印选项两列规则同源');
  assert.ok(/\.answer-inp-inline\s*\{[^}]*width:72px;\s*height:30px/.test(html), '打印 inline 空白盒 72×30 经 token 拼出');
});

// ==================== P31-08：CSS 物理清理 + 视觉微调（题号纯文本/题卡题干/三表归位） ====================

test('P31-08 tokens.css 题卡圆角 + 题干字号/行高/字重 SSOT', () => {
  const tokens = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'tokens.css'), 'utf8');
  [
    ['--card-radius: 8px'], ['--stem-size: 17px'],
    ['--stem-line-height: 1.6'], ['--stem-weight: 600']
  ].forEach(([decl]) => assert.ok(tokens.indexOf(decl) !== -1, 'tokens.css 缺: ' + decl));
});

test('P31-08 components.css：圆徽章物理消失→纯文本「N.」、q-text 死规则清除、题干走 token', () => {
  const css = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'components.css'), 'utf8');
  // 卡片圆角走 token（任务书 6-8px）
  assert.ok(/\.question-card\s*\{[\s\S]*?border-radius:\s*var\(--card-radius\)/.test(css), '卡片圆角走 --card-radius');
  // 题号：纯文本规则 + ::after 句号
  assert.ok(/\.question-card \.num\s*\{[^}]*font-weight:\s*var\(--stem-weight\)[^}]*color:\s*var\(--ink\)/.test(css), '题号纯文本（token 字重/ink 色）');
  assert.ok(/\.question-card \.num::after\s*\{\s*content:\s*'\.'/.test(css), '句号由 ::after 纯视觉生成');
  // 圆徽章视觉物理消失：任何 .num 规则块不得再含 50% 圆底/22px 盒/徽章底色
  const numBlocks = css.match(/\.num\s*\{[^}]*\}/g) || [];
  numBlocks.forEach(b => {
    assert.ok(!/border-radius:\s*50%/.test(b), '题号规则残留圆底: ' + b);
    assert.ok(!/background:/.test(b), '题号规则残留徽章底色: ' + b);
    assert.ok(!/width:\s*22px/.test(b), '题号规则残留 22px 盒: ' + b);
  });
  // 旧 renderGeneric 链死样式物理清除
  assert.ok(!/\.q-text\s*[,.{:]/.test(css), '.q-text 死规则应物理删除（唯一生产方 renderGeneric 已于 P31-06 删除）');
  assert.ok(!/\.question-stem \.num\s*\{/.test(css), '题号规则不得再在 .question-stem 下重复定义');
  // 题干 17px/1.6/600 走 token；删 800 粗体
  assert.ok(/\.question-stem\s*\{[^}]*font-size:\s*var\(--stem-size\)[^}]*line-height:\s*var\(--stem-line-height\)[^}]*font-weight:\s*var\(--stem-weight\)/.test(css), '题干三值走 token');
  const stemBlock = css.match(/\.question-stem\s*\{[^}]*\}/)[0];
  assert.ok(!/font-weight:\s*800/.test(stemBlock), '题干不得残留 800 粗体');
});

test('P31-08 components.css：practice.html 题目内联段迁入（screen 边界保持）+ 反馈色类驱动', () => {
  const css = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'components.css'), 'utf8');
  // @media screen 边界：屏幕去作答线 + 实线细边框；打印 media 不命中（克隆/直渲各自自持）
  const screenBlock = css.match(/@media screen\s*\{[\s\S]*?\n\}/)[0];
  assert.ok(/\.question-answer\s*\{[^}]*border-bottom:\s*none/.test(screenBlock), '屏幕去作答线迁入');
  assert.ok(/\.answer-inp\s*\{[^}]*border-style:\s*solid[^}]*border-width:\s*1\.5px/.test(screenBlock), '屏幕作答框实线 1.5px 迁入');
  // 批改反馈三行样式迁入 + 颜色由卡 correct/wrong 类驱动（替代 JS 内联）
  assert.ok(/\.question-card \.feedback \.fb-line\s*\{[^}]*12\.5px/.test(css), 'fb-line 迁入');
  assert.ok(/\.question-card \.feedback \.fb-explain\s*\{[^}]*var\(--muted\)/.test(css), 'fb-explain 迁入');
  assert.ok(/\.question-card \.feedback \.fb-mis\s*\{[^}]*var\(--warn\)/.test(css), 'fb-mis 迁入');
  assert.ok(/\.question-card\.correct \.feedback\s*\{[^}]*var\(--ok\)/.test(css), '答对反馈色类驱动');
  assert.ok(/\.question-card\.wrong \.feedback\s*\{[^}]*var\(--bad\)/.test(css), '答错反馈色类驱动');
  // 屏幕作答框 96×32 不改（P31-07 锁定）
  assert.ok(/\.answer-inp\s*\{[^}]*width:\s*96px;\s*height:\s*32px/.test(css), '屏幕作答框保持 96×32');
});

test('P31-08 pages.css：网格规则唯一归并、480 断点单一、题卡覆写迁出', () => {
  const pages = fs.readFileSync(path.join(ROOT, 'shared', 'styles', 'pages.css'), 'utf8');
  assert.ok(/\.questions-grid,\s*\.q-grid\s*\{[\s\S]*?gap:\s*var\(--grid-gap-screen\)[\s\S]*?grid-template-columns:\s*repeat\(var\(--grid-cols,\s*1\),\s*minmax\(0,\s*1fr\)\)/.test(pages), '网格唯一规则 + token 间距 + plan 注入列数');
  assert.ok(!/^\s*\.q-grid\s*\{/m.test(pages), '裸 .q-grid 网格声明应归并删除');
  assert.ok(!/^\s*\.questions-grid\s*\{/m.test(pages), '裸 .questions-grid 网格声明应归并删除');
  assert.strictEqual((pages.match(/max-width:\s*480px/g) || []).length, 1, '<480px 断点只能有一处');
  assert.ok(!/#problemsArea[^{]*\.question-card[^}]*!important/.test(pages), '题卡 text-align/padding !important 覆写应归位 components 基础规则');
});

test('P31-08 print.js：克隆链徽章覆盖删除（同源继承）、直渲链纯文本题号、打印题干 15px 保持', () => {
  const printSrc = fs.readFileSync(path.join(ROOT, 'shared', 'styles', '..', 'presentation', 'print.js'), 'utf8');
  assert.ok(!/\.print-sheet \.question-card \.num/.test(printSrc), '克隆链圆徽章覆盖整条删除');
  assert.ok(!/\.num\s*\{[^}]*border-radius:50%/.test(printSrc), 'print.js 不得残留任何圆徽章 .num 规则');
  assert.ok(!/background:#eef0f3[^;]*;[^;]*;[^\n]*num|num[^\n]*background:#eef0f3/.test(printSrc), '徽章灰底字面量清除');
  // 直渲打印文档实证
  const html = Print.buildFromQuestions(
    [{ questionType: 'calc', prompt: '1 + 1 = ?', answer: { value: 2 } }],
    { title: 'P31-08 题号卷' }
  );
  assert.ok(html.indexOf('.question-card .num { display:inline-block; min-width:1.6em') !== -1, '直渲纯文本题号');
  assert.ok(html.indexOf(".question-card .num::after { content:'.'; }") !== -1, '直渲 ::after 句号');
  assert.ok(!/\.num[^{]*\{[^}]*50%/.test(html), '直渲文档无圆底');
  assert.ok(/\.question-stem\s*\{[^}]*font-size:15px;\s*line-height:1\.5;\s*font-weight:600/.test(html), '打印题干保持纸张口径 15px/1.5/600');
});

test('P31-08 practice.html 题目组件内联样式清零（含渲染后 fb.style.color）；.num DOM 文本仍为纯数字', () => {
  const page = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  assert.ok(!/#problemsArea \.question-card \.num/.test(page), '页面不再私写题号样式');
  assert.ok(!/#problemsArea \.answer-inp/.test(page), '页面不再私写作答框样式');
  assert.ok(!/#problemsArea \.question-answer/.test(page), '页面不再私写作答区样式');
  assert.ok(!/#problemsArea \.feedback/.test(page), '页面不再私写反馈样式');
  assert.ok(!/fb\.style\.color/.test(page), '批改反馈色不再渲染后写内联（类驱动）');
  // DOM 契约不动：句号纯视觉，.num 文本仍为纯数字
  const all = Renderer.renderAll(
    [{ questionType: 'calc', prompt: '1 + 1 = ?', answer: { value: 2 } }],
    { mode: 'screen' }, {}
  );
  assert.ok(/<span class="num">1<\/span>/.test(all.html), '.num DOM 文本为纯数字（无句号）');
  assert.ok(!/<span class="num">1\.<\/span>/.test(all.html), '句号不得进入 DOM');
});
