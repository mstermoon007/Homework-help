'use strict';

/**
 * tests/generation/p28-hollow-plan1-native.test.js — P28-HOLLOW-01 方案 1（空心治理）
 *
 * 背景：因数和倍数 2 KP（8 行）原绑 arithmetic，产出纯算式题（与因数/倍数语义无关）；
 * 分数乘整数 g6-up-u02-k001 的 4 个非几何行（fill/choice/judge/apply）此前回落
 * shape 泛型认图（空心）。统计族 25 KP × 5 行（125 行）的路由与真实生成由
 * tests/orchestration/p17-10-classify.test.js 收口，本文件不重复。
 *
 * 冻结不变量：
 *   1. 选择器精确路由：因数 8 行 → generator:concept-meaning；
 *      分数乘整数 5 行 → generator:shape-recognition（match 全 1）。
 *   2. 原生 maker 真实产出：题型/KP 回显、TypeContract 通过、KpSemantic 通过、
 *      answer 非空、题干含 KP 语义关键词；分数乘整数行不回落泛型认图、不挂算术 operation
 *      （该 KP relationNot 八条算术/分数关系），5 行 graphic 均可真实渲染 SVG。
 *   3. PracticeSession E2E（固定冻结 seed）元数据 generator 与路由一致。
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

const CONCEPT = 'generator:concept-meaning';
const SHAPE = 'generator:shape-recognition';

// [kpId, 题型, 期望 producer, 题干语义关键词正则]
const ROWS = [
  // 因数和倍数的概念 / 因数与倍数的特征（number-theory maker，2 KP × 4 行）
  ['math-g5-down-u02-k001', 'calc', CONCEPT, /因数|倍数/],
  ['math-g5-down-u02-k001', 'fill', CONCEPT, /因数|倍数|____/],
  ['math-g5-down-u02-k001', 'choice', CONCEPT, /因数|倍数/],
  ['math-g5-down-u02-k001', 'apply', CONCEPT, /因数|倍数|盒/],
  ['math-g5-down-u02-k002', 'calc', CONCEPT, /倍数|因数/],
  ['math-g5-down-u02-k002', 'fill', CONCEPT, /倍数|因数|____/],
  ['math-g5-down-u02-k002', 'choice', CONCEPT, /倍数|因数/],
  ['math-g5-down-u02-k002', 'apply', CONCEPT, /倍数|因数/],
  // 分数乘整数（shape 内部参数化 maker，1 KP × 5 行）
  ['math-g6-up-u02-k001', 'geometry', SHAPE, /分数|单位“1”|\d+\/\d+/],
  ['math-g6-up-u02-k001', 'fill', SHAPE, /分数|\d+\/\d+|×|____/],
  ['math-g6-up-u02-k001', 'choice', SHAPE, /分数|\d+\/\d+|×/],
  ['math-g6-up-u02-k001', 'judge', SHAPE, /分数|\d+\/\d+|×/],
  ['math-g6-up-u02-k001', 'apply', SHAPE, /分数|\d+\/\d+|×|彩带/]
];

function gradeOf(kp) {
  return Number(/^math-g(\d)-/.exec(kp)[1]);
}

/* ---------------- 1. 选择器精确路由 ---------------- */

test('selector：因数 8 行 → concept-meaning，分数乘整数 5 行 → shape-recognition', () => {
  ROWS.forEach(function (row) {
    const plan = { knowledgePointIds: [row[0]], questionTypeId: row[1], difficulty: 3, count: 1 };
    const sel = Selector.selectGenerator(plan);
    assert.equal(sel.generatorId, row[2], row[0] + ' / ' + row[1] + ' 应路由到 ' + row[2]);
    assert.deepEqual(sel.match, { kp: 1, capability: 1, questionType: 1 });
  });
});

/* ---------------- 2. 原生 maker 产出/契约/语义 ---------------- */

test('maker：题型/KP 回显，TypeContract + KpSemantic 通过，题干含 KP 语义、答案非空', () => {
  ROWS.forEach(function (row) {
    const kp = row[0], qt = row[1], producer = row[2], kw = row[3];
    const plan = SP.attachToPlan({
      knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 1,
      seed: 'p28-hollow-plan1:' + kp + ':' + qt
    });
    const gen = Generators.get(producer);
    assert.ok(gen, producer + ' 实例存在');
    const qs = gen.generate(plan, {});
    assert.equal(qs.length, 1, kp + ' / ' + qt + ' 产出 1 题');
    const q = qs[0];

    assert.equal(q.questionType, qt, kp + ' / ' + qt + ' 题型回显');
    assert.equal(q.knowledgePointId, kp, kp + ' / ' + qt + ' KP 回显');

    const tv = TC.check(qt, q);
    assert.ok(tv.ok, kp + ' / ' + qt + ' TypeContract 通过: ' + JSON.stringify(tv.violations));
    const kv = KpSem.validateKpSemantics(q, {
      plan: { knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 1 },
      kpId: kp
    });
    assert.ok(kv.valid, kp + ' / ' + qt + ' KpSemantic 证据通过: ' + JSON.stringify(kv.violations || kv.errors));

    assert.ok(q.answer && q.answer.value !== '' && q.answer.value != null, kp + ' / ' + qt + ' 答案非空');
    assert.ok(kw.test(String(q.prompt)), kp + ' / ' + qt + ' 题干含 KP 语义关键词: ' + q.prompt);

    if (producer === SHAPE) {
      // 不回落泛型认图
      assert.ok(!/写出它的名称|它叫什么名字|是什么图形/.test(String(q.prompt)),
        kp + ' / ' + qt + ' 不得回落泛型认图: ' + q.prompt);
      // 该 KP operations=[]、relationNot 八条算术/分数关系：禁止挂算术 operation
      assert.ok(!q.data || q.data.operation === undefined, kp + ' / ' + qt + ' 不得挂 data.operation');
      // 5 行均带单位分数条 graphic，且可真实渲染
      const graphic = q.data && q.data.graphic;
      assert.ok(graphic && graphic.type, kp + ' / ' + qt + ' 带 graphic 描述符');
      const rendered = SvgRegistry.renderFor(graphic);
      assert.equal(rendered.status, 'SUCCESS',
        kp + ' / ' + qt + ' graphic ' + graphic.type + '/' + graphic.subtype + ' 可渲染: ' + rendered.reason);
      assert.ok(/<svg/.test(rendered.svg));
    }
  });
});

/* ---------------- 3. PracticeSession E2E（经 bundle 全链，冻结 seed） ---------------- */

ROWS.forEach(function (row) {
  test('E2E：' + row[0] + ' / ' + row[1] + ' 由 ' + row[2] + ' 出题', async () => {
    const kp = row[0], qt = row[1], producer = row[2];
    const session = new PracticeSession({
      subject: 'math', grade: gradeOf(kp), count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: qt,
      seed: 'freeze:p28-v1|' + kp + '|' + qt + '|d3'
    });
    await session.start();
    const q = (session.semanticQuestions || [])[0];
    assert.ok(q, kp + ' / ' + qt + ' E2E 有产出');
    assert.equal(q.metadata && q.metadata.generator, producer, kp + ' / ' + qt + ' E2E producer');
    assert.equal(q.questionType, qt);
    assert.equal(q.knowledgePointId, kp);
    assert.ok(TC.check(qt, q).ok, kp + ' / ' + qt + ' E2E TypeContract');
  });
});
