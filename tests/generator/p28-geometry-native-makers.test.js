'use strict';

/**
 * tests/generator/p28-geometry-native-makers.test.js — P28-GEO-NATIVE
 *
 * 背景：11 个 geometry ALLOW 行（分数乘法单元 4 KP + 长度/面积 6 KP + 排水法体积 1 KP）
 * 源 Excel 标注 domain=图形与几何，此前由 shape-recognition 以 kp=0 泛型兜底，
 * 产出与 KP 无关的「认三角形/平行四边形」题（结构闭合、语义空心）。
 *
 * 冻结不变量：
 *   1. 选择器对 11 行精确路由：10 行换原生 producer（kp=1 + geometry 声明），
 *      k001 仍由 shape 承接但 shape 内部走分数乘整数原生分支。
 *   2. 原生 maker 真实产出：geometry 题型、TypeContract 通过、graphic 描述符可真实渲染 SVG、
 *      answer 非空、题干含 KP 语义关键词（分数/长度单位/面积/体积），不回落泛型认图。
 *   3. PracticeSession E2E（bundle 重建后）元数据 generator 与路由一致。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
const KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

// SVG 渲染链（Node 直载）
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'plugins', 'svg-area.js'));
require(path.join(ROOT, 'plugins', 'svg-fraction.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-diagram.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
const SvgRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

const SHAPE = 'generator:shape-recognition';
const MIXED = 'generator:arithmetic-mixed-calculation';
const MONEY = 'generator:money-measurement';
const APP = 'generator:application-word';

// [kpId, 期望 producer, 题干语义关键词正则]
const ROWS = [
  ['math-g6-up-u02-k001', SHAPE, /分数|单位“1”/],
  ['math-g6-up-u02-k002', MIXED, /几分之几|×/],
  ['math-g6-up-u02-k003', MIXED, /分配律/],
  ['math-g6-up-u02-k004', MIXED, /几分之几|占\s*\d\/\d/],
  ['math-g2-up-u05-k001', MONEY, /厘米|米/],
  ['math-g2-up-u05-k005', MONEY, /长度单位|厘米|米/],
  ['math-g3-down-u04-k002', MONEY, /面积单位|平方厘米/],
  ['math-g3-down-u04-k004', MONEY, /平方分米|平方厘米/],
  ['math-g3-up-u03-k001', MONEY, /长度单位/],
  ['math-g3-up-u03-k002', MONEY, /分米|进率/],
  ['math-g5-down-u03-k006', APP, /体积|水面/]
];

function gradeOf(kp) {
  return Number(/^math-g(\d)-/.exec(kp)[1]);
}

/* ---------------- 1. 选择器精确路由 ---------------- */

test('selector：11 个 geometry 行精确路由到原生 producer', () => {
  ROWS.forEach(function (row) {
    const plan = { knowledgePointIds: [row[0]], questionTypeId: 'geometry', difficulty: 3, count: 1 };
    const sel = Selector.selectGenerator(plan);
    assert.equal(sel.generatorId, row[1], row[0] + ' 应路由到 ' + row[1]);
    assert.deepEqual(sel.match, { kp: 1, capability: 1, questionType: 1 });
  });
});

/* ---------------- 2. 原生 maker 产出/契约/图形渲染 ---------------- */

test('maker：产出 geometry 题，TypeContract 通过，图形真实可渲染，语义与 KP 相关', () => {
  ROWS.forEach(function (row) {
    const kp = row[0], producer = row[1], kw = row[2];
    const plan = SP.attachToPlan({
      knowledgePointIds: [kp], questionTypeId: 'geometry', difficulty: 3, count: 1,
      seed: 'p28-geo-test:' + kp
    });
    const gen = Generators.get(producer);
    assert.ok(gen, producer + ' 实例存在');
    const qs = gen.generate(plan, {});
    assert.equal(qs.length, 1, kp + ' 产出 1 题');
    const q = qs[0];

    assert.equal(q.questionType, 'geometry', kp + ' 题型 geometry');
    assert.equal(q.knowledgePointId, kp);
    const tv = TC.check('geometry', q);
    assert.ok(tv.ok, kp + ' TypeContract 通过: ' + JSON.stringify(tv.violations));

    // KpSemantic 证据规则：geometry 行必须带 data.mode=geometry、graphic.type=geometry、
    // graphic.params.unit=cm，且不声明 forbidden 算术关系（与冻结门禁同口径，防再次漏报）
    const kv = KpSem.validateKpSemantics(q, {
      plan: { knowledgePointIds: [kp], questionTypeId: 'geometry', difficulty: 3, count: 1 },
      kpId: kp
    });
    assert.ok(kv.valid, kp + ' KpSemantic 证据通过: ' + JSON.stringify(kv.violations || kv.errors));

    const graphic = q.data && q.data.graphic;
    assert.ok(graphic && graphic.type, kp + ' 带 graphic 描述符');
    const rendered = SvgRegistry.renderFor(graphic);
    assert.equal(rendered.status, 'SUCCESS',
      kp + ' graphic ' + graphic.type + '/' + graphic.subtype + ' 可渲染: ' + rendered.reason);
    assert.ok(/<svg/.test(rendered.svg));

    assert.ok(q.answer && q.answer.value !== '' && q.answer.value != null, kp + ' 答案非空');
    assert.ok(kw.test(String(q.prompt)), kp + ' 题干含 KP 语义关键词: ' + q.prompt);
    // 不回落泛型认图：题干不得是「图中画了一个图形，它叫什么名字」类空心问法
    assert.ok(!/写出它的名称|它叫什么名字|是什么图形/.test(String(q.prompt)),
      kp + ' 不得回落泛型认图: ' + q.prompt);
  });
});

/* ---------------- 3. PracticeSession E2E（经 bundle 全链） ---------------- */

ROWS.forEach(function (row) {
  test('E2E：' + row[0] + ' geometry 经 PracticeSession 由 ' + row[1] + ' 出题', async () => {
    const kp = row[0], producer = row[1];
    const seed = 'freeze:p28-v1|' + kp + '|geometry|d3';
    const session = new PracticeSession({
      subject: 'math', grade: gradeOf(kp), count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: 'geometry', seed: seed
    });
    await session.start();
    const q = (session.semanticQuestions || [])[0];
    assert.ok(q, kp + ' E2E 有产出');
    assert.equal(q.metadata && q.metadata.generator, producer, kp + ' E2E producer');
    assert.equal(q.questionType, 'geometry');
    assert.ok(TC.check('geometry', q).ok, kp + ' E2E TypeContract');
    assert.ok(q.data && q.data.graphic && q.data.graphic.type, kp + ' E2E 带 graphic');
  });
});
