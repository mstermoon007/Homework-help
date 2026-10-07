'use strict';
/**
 * tests/presentation/layout-plan.test.js — P31-03 QuestionLayoutPlan 决策表契约
 *
 * 每条断言对应 P31-01 真实链 516 题取样的六类误排证据（docs/P31/P31-TASK-BOOK.md 证据③）：
 *   A 带图短题被压 span1 ｜ B geometry L<50 不通栏 ｜ F calc/fill 被长度拉宽
 *   G 表达式选项无两列档 ｜ H inline-after-equals 零消费 ｜ I 图形档位映射
 * 另含固定列模式、DTO 长度档（直渲打印契约）、字段枚举白名单。
 */
const assert = require('node:assert');
const { test } = require('node:test');
const path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
const Layout = require(path.join(ROOT, 'shared', 'presentation', 'layout.js'));

function planOf(qs, ctx) { return Layout.plan(qs, Object.assign({ availWidth: 718 }, ctx || {})); }
function itemOf(q, ctx) { return planOf([q], ctx).items[0]; }

// ---------- 契约形状 ----------

test('P31-03 plan 契约：列数 + items 七字段，枚举不越界', () => {
  const p = planOf([
    { questionType: 'calc', prompt: '1+1=?' },
    { questionType: 'choice', prompt: '选一个', options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] },
    { questionType: 'geometry', prompt: '看图说名称', graphic: { type: 'geometry', subtype: 'triangle', role: 'quantity-correspondence', params: {} } }
  ]);
  assert.ok(p.columns >= 1 && p.columns <= 4, 'columns ∈ [1,4]');
  assert.strictEqual(p.items.length, 3);
  p.items.forEach(function (it) {
    assert.ok(['compact', 'standard', 'expanded'].indexOf(it.density) !== -1);
    assert.ok([1, 2, 'full'].indexOf(it.span) !== -1);
    assert.ok(['inline', 'block'].indexOf(it.stem) !== -1);
    assert.ok(['none', 'small', 'medium', 'large'].indexOf(it.graphic) !== -1);
    assert.ok(['inline', 'two-column'].indexOf(it.options) !== -1, 'single-column 档位无证据，本轮不做');
    assert.ok(['auto', 'keep'].indexOf(it.break) !== -1);
    assert.strictEqual(typeof it.index, 'number');
  });
});

test('P31-03 spanToCss 与 html-renderer span 白名单同源', () => {
  assert.strictEqual(Layout.spanToCss('full'), '1 / -1');
  assert.strictEqual(Layout.spanToCss(2), 'span 2');
  assert.strictEqual(Layout.spanToCss(1), 'span 1');
});

// ---------- A/B/I：图形与几何 ----------

test('证据 A：带图短题（fill L23 / choice L20）→ expanded/full/keep，不再被压 span1', () => {
  const desc = { type: 'geometry', subtype: 'triangle', role: 'quantity-correspondence', params: { p1: {}, p2: {}, p3: {} } };
  const fill = itemOf({ questionType: 'fill', prompt: '请写出该图形的名称： ____', graphic: desc });
  assert.deepStrictEqual([fill.density, fill.span, fill.break], ['expanded', 'full', 'keep']);
  assert.strictEqual(fill.graphic, 'medium');
  const choice = itemOf({ questionType: 'choice', prompt: '下列哪个是三角形的特征？', graphic: desc,
    options: ['手帕', '棋盘格', '无棱无面', '4个角都是直角'] });
  assert.strictEqual(choice.span, 'full', '带图选择题同样通栏');
  assert.strictEqual(choice.density, 'expanded');
});

test('证据 B：geometry 不论长短（L23/L29）一律 expanded/full', () => {
  [23, 24, 29, 49].forEach(function (n) {
    const it = itemOf({ questionType: 'geometry', prompt: '图'.repeat(n) });
    assert.strictEqual(it.span, 'full', 'L=' + n + ' geometry 必须通栏');
    assert.strictEqual(it.density, 'expanded');
    assert.strictEqual(it.break, 'keep');
  });
});

test('证据 I：图形档位由 type/role/subtype/params 确定性映射（描述符无顶层 size）', () => {
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'diagram', subtype: 'brace', role: 'calculation-support', params: { left: 6, right: 10 } } }, 0), 'small');
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'geometry', subtype: 'rectangle', role: 'quantity-correspondence', params: { width: 1, height: 2 } } }, 0), 'medium');
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'geometry', subtype: 'square', role: 'quantity-correspondence', params: { width: 1 } } }, 0), 'medium');
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'geometry', role: 'number-position', params: { gridSize: 10 } } }, 0), 'large');
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'geometry', subtype: 'cylinder', params: { r: 1, height: 2 } } }, 0), 'large');
  assert.strictEqual(Layout.graphicGear({ graphic: { type: 'geometry', params: { r: 2, height: 3 } } }, 0), 'large', 'r+height 立体参数 → large');
  assert.strictEqual(Layout.graphicGear({ prompt: 'legacy' }, 0), 'none');
  assert.strictEqual(Layout.graphicGear({ render: function () { return '<svg></svg>'; } }, 0), 'medium', 'legacy render svg → medium');
});

test('证据 I：calculation-support(brace) 小图不夺权——choice L37 保持 standard（图档 small）', () => {
  const it = itemOf({ questionType: 'choice', prompt: '看'.repeat(37),
    graphic: { type: 'diagram', subtype: 'brace', role: 'calculation-support', params: { left: 8, right: 15 } },
    options: ['8 + 15 = 23', '15 − 8 = 7', '8 + 15 = 24', '15 + 8 = 24'] });
  assert.strictEqual(it.graphic, 'small');
  assert.strictEqual(it.density, 'standard');
});

// ---------- F：calc/fill/judge 长度不跨列 ----------

test('证据 F：calc/fill/judge 不论长短（L42/L51/L61）一律 compact/span1', () => {
  [10, 26, 42, 51, 61].forEach(function (n) {
    ['calc', 'fill', 'judge'].forEach(function (qt) {
      const it = itemOf({ questionType: qt, prompt: '题'.repeat(n) });
      assert.strictEqual(it.density, 'compact', qt + ' L=' + n);
      assert.strictEqual(it.span, 1, qt + ' L=' + n + ' 长度不得驱动跨列');
      assert.strictEqual(it.break, 'auto');
    });
  });
});

// ---------- G：选项两列档 ----------

test('证据 G：4 项 × 最长 7 字表达式选项 → options=two-column；短选项保持 inline', () => {
  const two = itemOf({ questionType: 'choice', prompt: '下面哪个算式等于 3？',
    options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] });
  assert.strictEqual(two.options, 'two-column');
  assert.strictEqual(two.density, 'standard');
  const inline = itemOf({ questionType: 'choice', prompt: '几加几？', options: ['1+1', '2+2', '3+3'] });
  assert.strictEqual(inline.options, 'inline', '短选项不两列');
  assert.deepStrictEqual(Layout.optionMeta({ options: ['a', 'b'] }), { n: 2, max: 1, two: false }, '不足 3 项不两列');
});

test('P31-03 options 兼容 data.options / 对象选项 / distractors 字段面', () => {
  // 对象选项取 label；两列档仍须满足 n≥3 且 max≥6（G 桶口径，字段面兼容不改阈值）
  const longLabels = [{ label: '长方体图形类' }, { label: '正方体图形类' }, { label: '圆柱体图形类' }];
  assert.deepStrictEqual(Layout.optionMeta({ data: { options: longLabels } }), { n: 3, max: 6, two: true });
  assert.strictEqual(itemOf({ questionType: 'classify', prompt: '分一分', data: { options: longLabels } }).options, 'two-column');
  assert.strictEqual(Layout.optionMeta({ distractors: ['x', 'y'] }).n, 2);
  // 3 字短类别标签：字段可读但不触发两列
  assert.strictEqual(itemOf({ questionType: 'classify', prompt: '分一分',
    data: { options: [{ label: '长方体' }, { label: '正方体' }, { label: '圆柱' }] } }).options, 'inline');
});

// ---------- H：inline-after-equals ----------

test('证据 H：response.layout=inline-after-equals → stem=inline（真实存在的作答信号）', () => {
  const it = itemOf({ questionType: 'fill', prompt: '列式：6 × 5 = ？', response: { layout: 'inline-after-equals' } });
  assert.strictEqual(it.stem, 'inline');
  assert.strictEqual(itemOf({ questionType: 'fill', prompt: '普通填空' }).stem, 'block');
});

// ---------- story / 长应用 ----------

test('决策表：style=story 与长应用（apply L≥50）→ expanded/full；短应用 standard', () => {
  const story = itemOf({ questionType: 'apply', style: 'story', prompt: '短题干' });
  assert.deepStrictEqual([story.density, story.span, story.break], ['expanded', 'full', 'keep']);
  const longApply = itemOf({ questionType: 'apply', prompt: '应'.repeat(50) });
  assert.deepStrictEqual([longApply.density, longApply.span], ['expanded', 'full']);
  const midApply = itemOf({ questionType: 'apply', prompt: '应'.repeat(30) }, { columns: 2 });
  assert.strictEqual(midApply.density, 'standard');
  assert.strictEqual(midApply.span, 2, '中等应用在 ≥2 列网格可跨 2 列');
});

// ---------- 列数 / 固定列 / DTO 兼容 ----------

test('plan 列数：ctx.columns 优先；否则按宽度动态 [1,4]', () => {
  assert.strictEqual(planOf([{ questionType: 'calc', prompt: '1+1' }], { columns: 2 }).columns, 2);
  assert.ok(planOf([]).columns === 3, '空集回落 3 列');
});

test('固定列模式：ctx.fixed=true 时任何题 span=1（P31-10：meta.columns 死数据面已删）', () => {
  const qs = [{ questionType: 'geometry', prompt: '看图', graphic: { type: 'geometry', subtype: 'circle', params: {} } },
             { questionType: 'apply', prompt: '长'.repeat(60) }];
  planOf(qs, { columns: 3, fixed: true }).items.forEach(function (it) {
    assert.strictEqual(it.span, 1);
  });
});

test('直渲打印契约：无 questionType 的原始 DTO 保留长度档（26 半宽 / 50 通栏）', () => {
  const qs = [
    { content: { prompt: '1' } },
    { content: { prompt: '应'.repeat(30) } },
    { content: { prompt: '应'.repeat(60) } }
  ];
  const items = planOf(qs, { columns: 2 }).items;
  assert.strictEqual(items[0].span, 1);
  assert.strictEqual(items[1].span, 2);
  assert.strictEqual(items[2].span, 'full');
});

test('plan 为纯函数：同输入两次调用逐字段相等', () => {
  const qs = [{ questionType: 'choice', prompt: 'p', options: ['15 − 14', '15 − 13', '15 − 12', '15 − 11'] }];
  assert.deepStrictEqual(planOf(qs), planOf(qs));
});

// ---------- 真实链重放（固定 seed，锁死信号抽取与决策表的连接） ----------

test('真实链重放（seed=20261004）：geometry 全 expanded/full；calc 长题 compact/span1；choice 存在 two-column', async () => {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
  async function gen(kp, grade, qt) {
    const s = new PracticeSession({ subject: 'math', grade: grade, count: 6, knowledgePointId: kp, questionType: qt, seed: 20261004 });
    await s.start();
    return s.semanticQuestions || [];
  }
  // B 桶：g1 geometry（math-g1-down-u01-k001）
  const geo = await gen('math-g1-down-u01-k001', 1, 'geometry');
  assert.ok(geo.length >= 4);
  planOf(geo).items.forEach(function (it) {
    assert.strictEqual(it.span, 'full');
    assert.strictEqual(it.density, 'expanded');
    assert.ok(it.graphic === 'medium' || it.graphic === 'large');
  });
  // F 桶：g2 钟面 calc（math-g2-down-u01-k001），取样中含 L42/L51
  const calc = await gen('math-g2-down-u01-k001', 2, 'calc');
  assert.ok(calc.some(function (q, i) { return Layout.renderLen(q, i) >= 42; }), '样本中应存在长 calc 题');
  planOf(calc).items.forEach(function (it) {
    assert.strictEqual(it.density, 'compact');
    assert.strictEqual(it.span, 1);
  });
  // G 桶：g1 退位减 choice（math-g1-down-u02-k001）
  const choice = await gen('math-g1-down-u02-k001', 1, 'choice');
  assert.ok(planOf(choice).items.some(function (it) { return it.options === 'two-column'; }), '应出现表达式选项两列档');
}, 120000);
