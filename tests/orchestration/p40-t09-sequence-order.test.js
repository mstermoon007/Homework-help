'use strict';

/**
 * tests/orchestration/p40-t09-sequence-order.test.js — P40-T-09 巩固/拓展序列 stageOrder 排序
 *
 * 断言：orderByStageOrder 读信号 + 序列有序（同族内 stageOrder 递增）；
 *   只读消费——输入元素集合不变（不改数量/题型/难度/KP 选择，Z1-Z4 不夺权）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev/_bundle-env.js'));
const K = global.App.KNOWLEDGE;
const Adaptive = require(path.join(ROOT, 'shared/strategy/adaptive-strategy.js'));

const getKp = (id) => { const kp = K.get(id); return kp && kp.semantic ? kp.semantic.conceptFamily : null; };

test('P40-T-09 同族序列按 stageOrder 递增排序', () => {
  const fam = {};
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach((g) => K.byGrade(g).forEach((kp) => {
    const cf = kp.semantic.conceptFamily;
    (fam[cf.id] = fam[cf.id] || []).push(kp.knowledgeId);
  }));
  const familyId = Object.keys(fam).find((f) => fam[f].length >= 5);
  const members = fam[familyId].slice().reverse(); // 打乱顺序
  const ordered = Adaptive.orderByStageOrder(members, { getKp });
  assert.equal(ordered.length, members.length, '元素集合不变');
  assert.deepEqual(ordered.slice().sort(), members.slice().sort(), '仅重排，不增删');
  for (let i = 1; i < ordered.length; i++) {
    assert.ok(getKp(ordered[i]).stageOrder >= getKp(ordered[i - 1]).stageOrder,
      familyId + ' 内 stageOrder 非递减');
  }
});

test('P40-T-09 无 getKp 时原样返回（生产行为不变）', () => {
  const input = ['b', 'a'];
  const out = Adaptive.orderByStageOrder(input, {});
  assert.deepEqual(out, ['b', 'a']);
});
