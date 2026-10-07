'use strict';

/**
 * tests/generation/p31-fix05-graphic-descriptors.test.js — P31-FIX-05/09 NO-DESC 断链修复
 *
 * FIX-05 背景（P31-09 登记 2 条 NO-DESC，P30 类断链：题面引用图而 q.graphic/q.data.graphic 均缺）：
 *   G1 geometry 长「看线段图…（在图上标出长出来的那一段）」→ semantic-relations
 *      makeAddRelGeometry 零 graphic；
 *   G2 geometry 中「观察排列图…照这样接着画」→ makePeriodGeometry 零 graphic。
 * 修复：两 maker 补 data.graphic 描述符；svg-diagram.js 的 diagram 族新增 pattern
 * subtype（brace/segment/balance/scale 同模块）。修正口径复测：同批探针中
 * shape-recognition / money-measurement 的 NO-DESC 均系探针只查 q.graphic 顶层
 * 字段的假阳性（其 data.graphic 本就存在），真实 NO-DESC 仅此两条。
 *
 * FIX-09 复核（FIX-05 risk① 登记同族 4 maker 逐题型证据分流，非机械扩修）：
 *   真断链且补图合法 → makeAddRelFill / makeAddRelChoice（题面「看线段图填空」/
 *     「线段图把总数分成两部分」欠图；该题型 intent graphicRole=auxiliary +
 *     allowedRepresentations 含 'graphic'），补同款 geometry/segment 描述符；
 *   证据销账（非断链，不加图）→ makePeriodCalc（FIX-09 当时 intent 行为
 *     needs-review 零权威；题面只问余数，周期组引号内自足、无看图指示）、
 *     makePeriodFill（intent 允许 graphic 但不要求；周期组以引号字符自足给出，
 *     无「看图/观察排列图」指示，numeric 表征交付合法）；
 *   新登记挂人工（T2 已裁决口径，AI 两侧皆不可动）→ makeAddRelCalc：题面有
 *     「看图列式…（在图中圈出）」强指示，但该题型 intent 明确
 *     allowedRepresentations=['numeric'] / graphicRole=null（driftRisk 明文
 *     「图形语义将降级为文字/算式」），注入图形 validator 双 ERROR；改题面属
 *     题面文案禁改面 → 仅登记不修复。
 *
 * FIX-11 人工裁决落地（用户 2026-10-06 显式裁决，change-log P31-FIX-11 留指令依据）：
 *   g1 calc（math-g1-down-u06-k002|calc）→ 遵从 sample-1 已「通过」的 numeric-only
 *     意图：makeAddRelCalc 两变式题面「看图列式…（在图中圈出/画出）」改为
 *     「列式计算…」，删图上操作指令；情境/数字/答案/解析逐字保留（driftRisk
 *     记载的图形语义降级为文字/算式）。
 *   g2 calc（math-g2-down-u02-k005|calc）→ 人工评审账本 supplement 批次
 *     p31-fix11-2026-10-06 裁决「通过」，接受机器提案 numeric-only 与 legitimacy
 *     空问；重跑 derive-qt-intent 后行升级 confirmed，运行时由零权威变为
 *     teaching:qt-intent:confirmed 强约束。题面/maker 不动。
 *
 * 冻结不变量：
 *   1. 四个修复 maker（geometry 两条 + fill/choice 两条）真实产出描述符且经
 *      SvgRegistry 渲染 SUCCESS（接通证据）。
 *   2. 描述符参数与题目已确定语义一致（segment total=两部分和；pattern=周期组）。
 *   3. FIX-05/09 范围题面/答案零变化（固定 seed 同形重放逐字一致）；
 *      FIX-11 仅 g1 calc 两变式题面按人工裁决去图，变化有定向断言。
 *   4. 证据销账/裁决行不携带 graphic（FIX-09/11 分流口径，注释附证据）。
 *   5. KpSemantic intent 对齐维持 PASS（graphicRole=auxiliary 不约束有无、
 *      graphic.role 在合法枚举、allowedRepresentations 含 graphic）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
// _bundle-env 副作用装载 KnowledgeContext/注册表（SP.attachToPlan 依赖其全局态）
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

// SVG 渲染链（Node 直载）
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'plugins', 'svg-area.js'));
require(path.join(ROOT, 'plugins', 'svg-fraction.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-diagram.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
const SvgRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

const REL = 'generator:semantic-relations';

function gen(kp, qt, count) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: count || 3,
    seed: 'p31-fix05:' + kp + ':' + qt
  });
  return { plan: plan, qs: Generators.get(REL).generate(plan, {}) };
}

/* ---------------- 1. G1 segment 描述符：产出 + SUCCESS + 参数与题意一致 ---------------- */

test('G1 makeAddRelGeometry：segment 描述符 SUCCESS，total=答案=第一条+长出', () => {
  const out = gen('math-g1-down-u06-k002', 'geometry', 6);
  assert.equal(out.qs.length, 6);
  out.qs.forEach(function (q, i) {
    const g = q.data && q.data.graphic;
    assert.ok(g && g.type === 'geometry' && g.subtype === 'segment', '#'+i+' segment 描述符');
    assert.equal(g.role, 'quantity-correspondence', '#'+i+' role 枚举内');
    assert.equal(g.params.total, Number(q.answer.value), '#'+i+' total=答案（第二条长）');
    assert.equal(g.params.total, g.params.part + Number(String(g.params.otherLabel).replace(/\D/g, '')),
      '#'+i+' 第一条+长出=第二条');
    assert.equal(g.params.partLabel, String(g.params.part), '#'+i+' partLabel=第一条的量');
    assert.equal(g.params.totalLabel, '?', '#'+i+' 总括为未知 ?');
    const r = SvgRegistry.renderFor(g);
    assert.equal(r.status, 'SUCCESS', '#'+i+' 可渲染: ' + r.reason);
    assert.ok(/<svg/.test(r.svg), '#'+i+' 输出 svg');
  });
});

/* ---------------- 2. G2 pattern 描述符：产出 + SUCCESS + 参数与题意一致 ---------------- */

test('G2 makePeriodGeometry：diagram/pattern 描述符 SUCCESS，pattern=周期组且含答案图形', () => {
  const out = gen('math-g2-down-u02-k005', 'geometry', 6);
  assert.equal(out.qs.length, 6);
  out.qs.forEach(function (q, i) {
    const g = q.data && q.data.graphic;
    assert.ok(g && g.type === 'diagram' && g.subtype === 'pattern', '#'+i+' diagram/pattern 描述符');
    assert.equal(g.role, 'auxiliary', '#'+i+' role 枚举内');
    assert.equal(g.params.pattern, q.data.graphicPattern, '#'+i+' pattern=周期组（与既有 graphicPattern 同源）');
    assert.ok(g.params.pattern.indexOf(q.answer.value) !== -1, '#'+i+' 答案图形在周期组内');
    const r = SvgRegistry.renderFor(g);
    assert.equal(r.status, 'SUCCESS', '#'+i+' 可渲染: ' + r.reason);
    assert.ok(/<svg/.test(r.svg), '#'+i+' 输出 svg');
    assert.ok(r.svg.indexOf('?') !== -1, '#'+i+' 未知位置问号在图');
  });
});

/* ---------------- 2b. FIX-09：G1 fill/choice segment 描述符（证据判定真断链） ---------------- */

test('G1 makeAddRelFill：segment 描述符 SUCCESS，total=答案=a+b，固定 seed 题面逐字不变', () => {
  const out = gen('math-g1-down-u06-k002', 'fill', 6);
  assert.equal(out.qs.length, 6);
  out.qs.forEach(function (q, i) {
    const g = q.data && q.data.graphic;
    assert.ok(g && g.type === 'geometry' && g.subtype === 'segment', '#'+i+' segment 描述符');
    assert.equal(g.role, 'quantity-correspondence', '#'+i+' role 枚举内');
    const a = Number(g.params.partLabel), b = Number(g.params.otherLabel);
    assert.equal(g.params.total, a + b, '#'+i+' total=两部分之和');
    assert.equal(g.params.total, Number(q.answer.value), '#'+i+' total=填空答案');
    assert.equal(g.params.part, a, '#'+i+' part=第一条 a');
    assert.equal(g.params.totalLabel, '?', '#'+i+' 总括为未知 ?');
    const r = SvgRegistry.renderFor(g);
    assert.equal(r.status, 'SUCCESS', '#'+i+' 可渲染: ' + r.reason);
    assert.ok(/<svg/.test(r.svg), '#'+i+' 输出 svg');
  });
  // RNG 调用序零变化 → FIX-09 前固定 seed 的题面/答案逐字保持（仅新增 data.graphic）
  const plan = SP.attachToPlan({
    knowledgePointIds: ['math-g1-down-u06-k002'], questionTypeId: 'fill', difficulty: 3, count: 1,
    seed: 'p31-fix09:math-g1-down-u06-k002:fill'
  });
  const q0 = Generators.get(REL).generate(plan, {})[0];
  assert.equal(q0.prompt, '看线段图填空：第一条线段表示 7，第二条线段表示 9，两条线段合起来表示（  ）。');
  assert.equal(q0.answer.value, '16');
});

test('G1 makeAddRelChoice：segment 描述符 SUCCESS，total=两部分和，题面/选项零变化', () => {
  const out = gen('math-g1-down-u06-k002', 'choice', 6);
  assert.equal(out.qs.length, 6);
  out.qs.forEach(function (q, i) {
    const g = q.data && q.data.graphic;
    assert.ok(g && g.type === 'geometry' && g.subtype === 'segment', '#'+i+' segment 描述符');
    assert.equal(g.role, 'quantity-correspondence', '#'+i+' role 枚举内');
    const a = Number(g.params.partLabel), b = Number(g.params.otherLabel);
    assert.equal(g.params.total, a + b, '#'+i+' total=两部分之和');
    assert.equal(g.params.part, a, '#'+i+' part=第一部分 a');
    assert.equal(g.params.totalLabel, '?', '#'+i+' 总括为未知 ?');
    assert.ok(Array.isArray(q.data.options) && q.data.options.length === 4, '#'+i+' 四选项保持');
    assert.equal(q.data.options[q.data.correctIndex], q.answer.value, '#'+i+' 正确项=答案');
    const r = SvgRegistry.renderFor(g);
    assert.equal(r.status, 'SUCCESS', '#'+i+' 可渲染: ' + r.reason);
    assert.ok(/<svg/.test(r.svg), '#'+i+' 输出 svg');
  });
  const plan = SP.attachToPlan({
    knowledgePointIds: ['math-g1-down-u06-k002'], questionTypeId: 'choice', difficulty: 3, count: 1,
    seed: 'p31-fix09:math-g1-down-u06-k002:choice'
  });
  const q0 = Generators.get(REL).generate(plan, {})[0];
  assert.equal(q0.prompt, '线段图把总数分成两部分：第一部分是 9，第二部分是 5。求总数应该用下面哪个算式？（  ）');
  assert.equal(q0.answer.value, '9 + 5');
});

/* ---------------- 3. 题面/答案零变化（geometry 登记 seed） ---------------- */

test('P31-09 登记 seed 同形重放：题面逐字一致（仅新增 data.graphic）', () => {
  const plan = SP.attachToPlan({
    knowledgePointIds: ['math-g1-down-u06-k002'], questionTypeId: 'geometry', difficulty: 3, count: 1,
    seed: '20261009|math-g1-down-u06-k002|geometry|d3'
  });
  const q = Generators.get(REL).generate(plan, {})[0];
  assert.equal(q.prompt, '看线段图：第一条线段表示 9，第二条线段比第一条长 3（在图上标出长出来的那一段）。第二条线段表示多少？');
  assert.equal(q.answer.value, '12');
  assert.ok(q.data && q.data.graphic, '登记题现已带描述符');
});

/* ---------------- 3b. FIX-09 证据分流：销账/挂账行维持不带 graphic（附证据，防误修） ---------------- */

test('证据销账行（g2 calc/fill/choice/apply）不携带 graphic——非断链，口径见头注释', () => {
  // g2 calc：intent 整体缺失（缺失不猜）+ 题面只问余数、周期组引号内自足；
  // g2 fill/choice：intent auxiliary 允许但不要求 graphic，引号字符已给出周期组，
  //                无看图指示，numeric 表征合法；
  // g2 apply：文字情境（彩旗），无图指示。
  [['math-g2-down-u02-k005', 'calc'], ['math-g2-down-u02-k005', 'fill'],
   ['math-g2-down-u02-k005', 'choice'], ['math-g2-down-u02-k005', 'apply']].forEach(function (row) {
    const out = gen(row[0], row[1], 3);
    out.qs.forEach(function (q, i) {
      assert.ok(!(q.data && q.data.graphic), row[0] + '/' + row[1] + ' #' + i + ' 不带 graphic');
    });
  });
});

test('挂人工裁决行（g1 calc/apply）不携带 graphic——calc intent 禁图，apply 要求学生自画', () => {
  // g1 calc：intent allowedRepresentations=['numeric']/graphicRole=null，
  //          driftRisk 明文图形语义降级为文字/算式；题面「看图列式」与该 T2 口径的
  //          张力挂人工裁决（AI 加图=validator 双 ERROR，改题面=禁改面），只登记不修复；
  // g1 apply：题面「先画一画，再列式」要求学生自己画，不属于题目应配图示。
  [['math-g1-down-u06-k002', 'calc'], ['math-g1-down-u06-k002', 'apply']].forEach(function (row) {
    const out = gen(row[0], row[1], 3);
    out.qs.forEach(function (q, i) {
      assert.ok(!(q.data && q.data.graphic), row[0] + '/' + row[1] + ' #' + i + ' 不带 graphic');
    });
  });
});

/* ---------------- 4. KpSemantic intent 对齐：补图行 PASS（geometry + FIX-09 fill/choice） ---------------- */

test('KpSemantic：两 KP geometry + g1 fill/choice 补图后 intent 对齐维持 PASS', () => {
  [['math-g1-down-u06-k002', 'geometry'], ['math-g2-down-u02-k005', 'geometry'],
   ['math-g1-down-u06-k002', 'fill'], ['math-g1-down-u06-k002', 'choice']].forEach(function (row) {
    const out = gen(row[0], row[1], 2);
    out.qs.forEach(function (q, i) {
      const v = KpSem.validateKpSemantics(q, { plan: out.plan, kpId: row[0] });
      assert.ok(v.valid, row[0] + '/' + row[1] + ' #'+i+': ' + JSON.stringify(v.violations || v.errors));
    });
  });
});
