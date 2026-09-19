'use strict';

/**
 * tests/generator/p25-06-semantic-params.test.js — GenerationParameters 语义参数链路
 *
 * 冻结 P25-06 本体核心不变量：
 *   1. 14 个语义消费 KP（percent×6 + concept×4 + semantic-relations×4）经
 *      SemanticProfile→QuestionIntent 机械派生出正确 subTopic（Node 环境带
 *      teaching 细族收窄；bundle 降级等价由 dev/p25 审计 A3 守护）。
 *   2. read model 结构完整：schemaVersion/operations/representations/intent/
 *      subTopicEvidence/sources，证据可审计；未知 KP 返回 null（fail-closed）。
 *   3. attachToPlan 是注入唯一通道：返回浅拷贝且不改写入参；retry-loop 的
 *      Object.assign({}, plan) 保留 semanticParams。
 *   4. 消费方 fail-closed：plan.semanticParams 缺失或 subTopic 无 maker 时
 *      percent/concept 生成器返回 []，禁止静默猜测兜底。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

// kpId → 期望 subTopic（与 SUBTOPIC_MAKERS 键一一对应，错一个即语义错配）
const EXPECTED = {
  'math-g6-up-u05-k001': 'percent-of',
  'math-g6-up-u05-k002': 'percent-conversion',
  'math-g6-up-u05-k003': 'percent-discount',
  'math-g6-up-u05-k004': 'percent-interest',
  'math-g6-up-u05-k005': 'percent-target-rate',
  'math-g6-up-u05-k006': 'percent-change',
  'math-g2-down-u03-k003': 'times-concept',
  'math-g3-up-u07-k002': 'angle-concept',
  'math-g3-down-u04-k001': 'area-concept',
  'math-g5-down-u04-k001': 'fraction-meaning',
  'math-g1-down-u06-k002': 'pictorial-additive-relation',
  'math-g2-down-u02-k005': 'periodic-pattern',
  'math-g6-down-u04-k007': 'scale-transform',
  'math-g6-down-u04-k008': 'proportion-application'
};

test('read model 版本与 API 形状', () => {
  assert.equal(SP.SCHEMA_VERSION, 1);
  ['resolve', 'attachToPlan', 'deriveSubTopic', 'readFacts'].forEach(function (fn) {
    assert.equal(typeof SP[fn], 'function');
  });
});

Object.keys(EXPECTED).forEach(function (kpId) {
  test('subTopic 派生：' + kpId + ' → ' + EXPECTED[kpId], () => {
    const p = SP.resolve(kpId, 'calc');
    assert.ok(p, '未知/取不到 KP 时应返回非 null（' + kpId + '）');
    assert.equal(p.schemaVersion, 1);
    assert.equal(p.knowledgePointId, kpId);
    assert.equal(p.questionType, 'calc');
    assert.equal(p.subTopic, EXPECTED[kpId]);
    assert.ok(p.name, 'read model 应带 name');
    assert.ok(p.semanticFamily, '应派生 semanticFamily');
    assert.ok(Array.isArray(p.families) && p.families.length >= 1, 'families 至少含主族');
    assert.ok(Array.isArray(p.operations), 'operations 必须是数组（空数组合法）');
    assert.ok(Array.isArray(p.representations) && p.representations.length >= 1, 'representations 非空');
    // 机械证据链：命中规则 + 命中字段可审计
    assert.ok(p.subTopicEvidence && p.subTopicEvidence.matched, kpId + ' 缺 subTopicEvidence.matched');
    assert.ok(p.subTopicEvidence.rule, '证据需带 rule 名');
    assert.ok(['name', 'concept'].indexOf(p.subTopicEvidence.field) !== -1, '证据 field 须为 name/concept');
    assert.ok(p.sources && p.sources.subTopic === 'mechanical-rule:kbl-name-concept',
      'sources.subTopic 应声明机械规则派生来源');
  });
});

test('同 KP 跨题型 subTopic 稳定（不随 questionType 漂移）', () => {
  ['calc', 'fill', 'apply', 'choice', 'geometry'].forEach(function (qt) {
    const p = SP.resolve('math-g2-down-u02-k005', qt);
    assert.equal(p.subTopic, 'periodic-pattern');
    assert.equal(p.questionType, qt);
  });
});

test('未知 KP fail-closed：返回 null 而非伪造参数', () => {
  assert.equal(SP.resolve('math-g0-down-u99-k999', 'calc'), null);
});

test('attachToPlan：浅拷贝注入、不改写入参', () => {
  const plan = { knowledgePointIds: ['math-g6-up-u05-k003'], questionTypeId: 'calc', difficulty: 2, count: 1 };
  const attached = SP.attachToPlan(plan);
  assert.notEqual(attached, plan);
  assert.equal(plan.semanticParams, undefined, '入参不得被写改');
  assert.ok(attached.semanticParams, '拷贝应挂 semanticParams');
  assert.equal(attached.semanticParams.subTopic, 'percent-discount');
  // 原 plan 其余字段保留
  assert.deepEqual(attached.knowledgePointIds, plan.knowledgePointIds);
  assert.equal(attached.questionTypeId, 'calc');
  assert.equal(attached.count, 1);
});

test('attachToPlan：retry-loop Object.assign 浅拷贝保留 semanticParams', () => {
  const attached = SP.attachToPlan({ knowledgePointIds: ['math-g1-down-u06-k002'], questionTypeId: 'calc' });
  const retryCopy = Object.assign({}, attached); // retry-loop 重建计划的形态
  assert.ok(retryCopy.semanticParams, 'retry 拷贝必须保留语义参数');
  assert.equal(retryCopy.semanticParams.subTopic, 'pictorial-additive-relation');
});

test('消费方 fail-closed：percent 语义参数缺失/子类型无 maker → 返回 []', () => {
  const createPercent = require(path.join(ROOT, 'shared', 'generator', 'generators', 'percent.js')).createPercentGenerator;
  const gen = createPercent();
  // 无 KP 无 semanticParams：不猜测
  assert.deepEqual(gen.generate({ questionTypeId: 'calc', count: 1 }, {}), []);
  // subTopic 无对应 maker：不兜底
  const bogus = SP.attachToPlan({ knowledgePointIds: ['math-g6-up-u05-k001'], questionTypeId: 'calc' });
  bogus.semanticParams = Object.assign({}, bogus.semanticParams, { subTopic: 'no-such-subtopic' });
  assert.deepEqual(gen.generate(bogus, {}), []);
  // 正常参数：产出 1 题且 subType 与语义参数一致
  const ok = gen.generate(SP.attachToPlan({ knowledgePointIds: ['math-g6-up-u05-k001'], questionTypeId: 'calc', count: 1 }), {});
  assert.equal(ok.length, 1);
  assert.equal(ok[0].data.subType, 'percent-of');
});

test('消费方 fail-closed：concept-meaning 子类型无 maker → 返回 []', () => {
  const createConcept = require(path.join(ROOT, 'shared', 'generator', 'generators', 'concept-meaning.js')).createConceptMeaningGenerator;
  const gen = createConcept();
  assert.deepEqual(gen.generate({ questionTypeId: 'calc', count: 1 }, {}), []);
  const bogus = SP.attachToPlan({ knowledgePointIds: ['math-g2-down-u03-k003'], questionTypeId: 'calc' });
  bogus.semanticParams = Object.assign({}, bogus.semanticParams, { subTopic: 'no-such-subtopic' });
  assert.deepEqual(gen.generate(bogus, {}), []);
});
