'use strict';

/**
 * tests/generation/p40-t08-explanation-bridge.test.js — P40-T-08 解释承上启下三段模板
 *
 * 断言：
 *   ①composeExplanation 逐字：桥接文本严格由 upstream.name/definition + current 拼装，
 *     无编造、无改写；
 *   ②无前序不硬加（upstream 缺失 / name 相同 → 原样返回 current）；
 *   ③resolve().upstream 逐字取自 canonical（前序 KP name + semantic.concept）；
 *   ④端到端：有同族前序的 KP，concept-meaning 解析被前置桥接句（逐字引用 canonical 前序）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const K = global.App.KNOWLEDGE;
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const cmMod = require(path.join(ROOT, 'shared', 'generator', 'generators', 'concept-meaning.js'));

const RESOLVER = SP.createSemanticParameterResolver({});

test('P40-T-08 composeExplanation 逐字拼装（含定义要点）', () => {
  const out = SP.composeExplanation({
    upstream: { name: '认识小数', definition: '像0.1、0.5这样带有小数点的数叫小数' },
    name: '小数的大小比较',
    current: '依据定义：……'
  });
  assert.equal(out,
    '我们之前学过〈认识小数〉（像0.1、0.5这样带有小数点的数叫小数）。把〈认识小数〉和〈小数的大小比较〉结合起来看：依据定义：……');
});

test('P40-T-08 composeExplanation 无定义要点仅引用名称', () => {
  const out = SP.composeExplanation({
    upstream: { name: '平移', definition: null }, name: '旋转', current: 'C'
  });
  assert.equal(out, '我们之前学过〈平移〉。把〈平移〉和〈旋转〉结合起来看：C');
});

test('P40-T-08 无前序不硬加', () => {
  assert.equal(SP.composeExplanation({ name: 'X', current: 'C' }), 'C', 'upstream 缺失');
  assert.equal(SP.composeExplanation({ upstream: { name: 'X' }, name: 'X', current: 'C' }), 'C', '前序同名');
  assert.equal(SP.composeExplanation({}), '', '空参数安全');
});

test('P40-T-08 resolve().upstream 逐字取自 canonical', () => {
  let checked = 0;
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach((g) => K.byGrade(g).forEach((kp) => {
    const sp = RESOLVER.resolve(kp.knowledgeId, 'judge');
    if (!sp || !sp.upstream) return;
    const up = sp.upstream;
    const canonical = K.get(up.knowledgeId);
    assert.ok(canonical, 'upstream 必存在：' + up.knowledgeId);
    assert.equal(up.name, canonical.name, kp.knowledgeId + ' upstream.name 逐字');
    const def = canonical.semantic && typeof canonical.semantic.concept === 'string' ? canonical.semantic.concept : null;
    assert.equal(up.definition, (def && def !== canonical.name) ? def : null,
      kp.knowledgeId + ' upstream.definition 逐字（缺失或等于名时为空，不编造）');
    assert.ok(up.familyId && up.stageOrder != null, 'upstream 带族/序锚');
    checked++;
  }));
  assert.ok(checked >= 20, '应覆盖足量有前序 KP（实得 ' + checked + '）');
});

test('P40-T-08 端到端：concept-meaning 解析前置桥接句且逐字引 canonical 前序', () => {
  const kpId = 'math-g3-down-u04-k001'; // 面积的认识（同族前序：常用长度单位）
  const sp = RESOLVER.resolve(kpId, 'judge');
  assert.ok(sp.upstream, '样本 KP 应有同族前序');
  const upName = sp.upstream.name;
  const gen = cmMod.createConceptMeaningGenerator({});
  const plan = {
    questionTypeId: 'judge', count: 3, difficulty: 2,
    knowledgePointIds: [kpId],
    constraints: { numberRange: { min: 1, max: 20 } },
    seed: 'p40t08', semanticParams: sp
  };
  const out = gen.generate(plan, { seed: 'p40t08' });
  assert.ok(out.length >= 1, '应产出题目');
  const ex = String(out[0].answer.explanation || '');
  assert.ok(ex.indexOf('我们之前学过〈' + upName + '〉') === 0,
    '解析应以 canonical 前序桥接句开头：' + ex.slice(0, 40));
  assert.ok(ex.indexOf('结合起来看：') !== -1, '含 bridge 段');
  assert.ok(ex.indexOf('依据') !== -1, '保留 current 段（本题解析）');
});
