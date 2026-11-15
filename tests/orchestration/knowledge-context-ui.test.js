'use strict';

/**
 * tests/orchestration/knowledge-context-ui.test.js — P46-01 KnowledgeContext UI 投影与课本顺序
 *
 * 验证：
 *   1. uiKp 投影新增 unitId/unitNo/knowledgeNo/sourceIndex 字段，缺失统一 null；
 *   2. knowledgeNo 按点分段数值比较（5.1 < 5.10，2.2 < 2.10）；
 *   3. uiListForGrade 返回 KP 按课本顺序（up→down → unitNo → knowledgeNo 数值 → sourceIndex）；
 *   4. 排序只影响 UI 视图，不改 runtime 原始数据；
 *   5. 同单元内 knowledgeNo 缺失时 sourceIndex 作为稳定 tie-break。
 *
 * 不进入生成链；仅 UI 投影层。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KC = Env.KnowledgeContext;

const UI_KEYS = [
  'id', 'name', 'moduleId', 'unit', 'unitId', 'unitNo', 'knowledgeNo',
  'book', 'grade', 'weight', 'type', 'pluginId', 'category',
  'applicable_question_types', 'difficulty', 'cognitive_level', 'status',
  'sourceIndex'
];

test('① uiKp 新增课本顺序字段且全部恒存在', () => {
  const list = KC.uiListForGrade('math', 1);
  assert.ok(list.length > 0, '一年级应存在 KP');
  const kp = list[0];
  for (const key of UI_KEYS) {
    assert.ok(key in kp, `uiKp 应恒含字段 ${key}`);
  }
  assert.equal(typeof kp.unitId, 'string');
  assert.equal(typeof kp.unitNo, 'number');
  assert.equal(typeof kp.knowledgeNo, 'string');
  assert.equal(typeof kp.sourceIndex, 'number');
});

test('② uiKp(null/undefined) 返回 null；空对象返回全 null 投影（无 undefined）', () => {
  assert.equal(KC.uiKp(null), null);
  assert.equal(KC.uiKp(undefined), null);
  const empty = KC.uiKp({});
  assert.ok(empty && typeof empty === 'object');
  assert.equal(empty.id, null);
  assert.equal(empty.unitId, null);
  assert.equal(empty.unitNo, null);
  assert.equal(empty.knowledgeNo, null);
  assert.equal(empty.sourceIndex, null);
  for (const v of Object.values(empty)) {
    assert.notEqual(v, undefined, '投影值不得出现 undefined');
  }
});

test('③ compareKnowledgeNo：按点分段数值比较，不按字符串字典序', () => {
  assert.ok(KC.compareKnowledgeNo('5.1', '5.10') < 0, '5.1 < 5.10');
  assert.ok(KC.compareKnowledgeNo('5.10', '5.1') > 0, '5.10 > 5.1');
  assert.ok(KC.compareKnowledgeNo('2.2', '2.10') < 0, '2.2 < 2.10');
  assert.equal(KC.compareKnowledgeNo('3.1', '3.1'), 0, '相等');
  assert.ok(KC.compareKnowledgeNo('10', '2') > 0, '整数 10 > 2');
  assert.equal(KC.compareKnowledgeNo(null, null), 0, '缺失相等');
  assert.ok(KC.compareKnowledgeNo('1', null) > 0, '有值 > 缺失');
});

test('④ uiListForGrade 按课本顺序：上册 → 下册', () => {
  const list = KC.uiListForGrade('math', 1);
  let seenDown = false;
  for (const kp of list) {
    if (kp.book === 'down') seenDown = true;
    if (kp.book === 'up') {
      assert.equal(seenDown, false, '上册 KP 不应出现在下册之后');
    }
  }
});

test('⑤ uiListForGrade 同册内 unitNo 升序', () => {
  const list = KC.uiListForGrade('math', 1);
  const ups = list.filter((k) => k.book === 'up');
  for (let i = 1; i < ups.length; i++) {
    assert.ok(ups[i - 1].unitNo <= ups[i].unitNo, `unitNo 应升序：${ups[i - 1].unitNo} <= ${ups[i].unitNo}`);
  }
});

test('⑥ uiListForGrade 同单元内 knowledgeNo 数值升序', () => {
  const list = KC.uiListForGrade('math', 1);
  const byUnit = {};
  for (const kp of list) {
    (byUnit[kp.unitId] ||= []).push(kp);
  }
  for (const unitId of Object.keys(byUnit)) {
    const arr = byUnit[unitId];
    for (let i = 1; i < arr.length; i++) {
      assert.ok(
        KC.compareKnowledgeNo(arr[i - 1].knowledgeNo, arr[i].knowledgeNo) <= 0,
        `同单元 ${unitId} 内 knowledgeNo 应数值升序：${arr[i - 1].knowledgeNo} <= ${arr[i].knowledgeNo}`
      );
    }
  }
});

test('⑦ uiListForGrade 不修改 runtime 原始顺序（kpsForGrade 不变）', () => {
  const before = KC.kpsForGrade('math', 1).map((k) => k.knowledgeId);
  KC.uiListForGrade('math', 1);
  const after = KC.kpsForGrade('math', 1).map((k) => k.knowledgeId);
  assert.deepEqual(after, before, 'uiListForGrade 不得改变 runtime 数据');
});

test('⑧ sortByTextbookOrder 不修改原数组且保持确定性', () => {
  const a = { book: 'up', unitNo: 2, knowledgeNo: '1.2', sourceIndex: 5, id: 'a' };
  const b = { book: 'up', unitNo: 1, knowledgeNo: '1.1', sourceIndex: 0, id: 'b' };
  const c = { book: 'down', unitNo: 1, knowledgeNo: '1.1', sourceIndex: 1, id: 'c' };
  const original = [a, b, c];
  const sorted = KC.sortByTextbookOrder(original);
  assert.deepEqual(original, [a, b, c], '原数组不变');
  assert.deepEqual(sorted.map((x) => x.id), ['b', 'a', 'c'], 'b(up,u1) → a(up,u2) → c(down)');
  // 重复排序幂等
  assert.deepEqual(KC.sortByTextbookOrder(sorted).map((x) => x.id), ['b', 'a', 'c']);
});

test('⑨ sourceIndex 在 knowledgeNo 缺失/相同时提供稳定 tie-break', () => {
  const a = { book: 'up', unitNo: 1, knowledgeNo: '1.1', sourceIndex: 3, id: 'a' };
  const b = { book: 'up', unitNo: 1, knowledgeNo: '1.1', sourceIndex: 1, id: 'b' };
  const sorted = KC.sortByTextbookOrder([a, b]);
  assert.deepEqual(sorted.map((x) => x.id), ['b', 'a'], '同 knowledgeNo 时按 sourceIndex 升序');
});

test('⑩ 课本顺序在所有年级均成立（不破坏跨年级）', () => {
  for (let grade = 1; grade <= 6; grade++) {
    const list = KC.uiListForGrade('math', grade);
    for (let i = 1; i < list.length; i++) {
      assert.ok(
        KC.compareByTextbookOrder(list[i - 1], list[i]) <= 0,
        `年级 ${grade} 第 ${i - 1} → ${i} 项应满足课本顺序：${list[i - 1].id} <= ${list[i].id}`
      );
    }
  }
});
