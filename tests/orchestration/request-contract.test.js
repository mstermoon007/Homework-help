'use strict';
/**
 * R02 / R03 / R07 收口回归：统一 PracticeRequest 归一 + 统一 URL Builder。
 * 仅校验大服务层（UI ↔ 生成 之间）契约，不触碰生成算法 / 知识点库。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const RN = require(path.join(ROOT, 'shared', 'request', 'request-normalize.js'));
const CU = require(path.join(ROOT, 'shared', 'catalog', 'catalog-utils.js'));

test('R07 七种题型归一：spec ID + 旧别名 → 内部 canonical', () => {
  assert.deepStrictEqual(
    RN.normalizeQuestionTypes(['calculation', 'fill_blank', 'choice', 'true_false', 'operation', 'classification', 'word_problem']),
    ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply']
  );
  // 旧别名回退（兼容旧深链）；去重后每个 canonical 仅出现一次
  assert.deepStrictEqual(RN.normalizeQuestionTypes(['oral', 'vertical', 'cushi', 'recognize', 'sort', 'operate']),
    ['calc', 'geometry', 'classify']);
  // 去重
  assert.deepStrictEqual(RN.normalizeQuestionTypes(['calc', 'calculation']), ['calc']);
});

test('R02 createPracticeRequest：统一外壳 + 默认值', () => {
  const r = RN.createPracticeRequest({ subject: 'math', grade: 3, questionTypes: ['calc', 'judge'] });
  assert.strictEqual(r.subject, 'math');
  assert.strictEqual(r.grade, 3);
  assert.strictEqual(r.mode, 'quick');
  assert.strictEqual(r.count, 20);
  assert.strictEqual(r.difficulty, 6, '难度默认归一为数值 6（normal）');
  assert.deepStrictEqual(r.questionTypes, ['calc', 'judge']);
  assert.ok(Array.isArray(r.scope.knowledgePoints));
});

test('R02 createPracticeRequest：非数学科目返回占位 scope，不抛错', () => {
  const r = RN.createPracticeRequest({ subject: 'chinese', grade: 2, mode: 'teacher' });
  assert.strictEqual(r.subject, 'chinese');
  assert.strictEqual(r.mode, 'teacher');
});

test('R11 难度边界归一：UI 用语 → 引擎 1-10 整数', () => {
  assert.strictEqual(RN.normalizeDifficulty('easy'), 4);
  assert.strictEqual(RN.normalizeDifficulty('normal'), 6);
  assert.strictEqual(RN.normalizeDifficulty('hard'), 9);
  assert.strictEqual(RN.normalizeDifficulty(8), 8, '已是数值则原样');
  assert.strictEqual(RN.normalizeDifficulty('xx'), 6, '未知回退 normal');
  assert.strictEqual(RN.createPracticeRequest({ difficulty: 'hard' }).difficulty, 9);
});

test('R03 buildPracticeUrl：统一输出（kps / types / count / difficulty / book）', () => {
  const url = CU.buildPracticeUrl({
    mode: 'quick', subject: 'math', grade: 3,
    scope: { book: 'up', knowledgePoints: ['math-g3-m1-x', 'math-g3-m1-y'] },
    questionTypes: ['calc', 'judge'], count: 30, difficulty: 'hard'
  });
  assert.ok(url.startsWith('practice.html?subject=math&grade=3&mode=quick'), '基础段');
  assert.ok(url.indexOf('kps=math-g3-m1-x%2Cmath-g3-m1-y') !== -1, 'kps csv');
  assert.ok(url.indexOf('qt=calc') !== -1, '主题型 qt');
  assert.ok(url.indexOf('types=calc%2Cjudge') !== -1, '题型白名单 types');
  assert.ok(url.indexOf('count=30') !== -1, '总预算 count');
  assert.ok(url.indexOf('difficulty=hard') !== -1, '难度透传');
  assert.ok(url.indexOf('book=up') !== -1, '上下册透传');
});

test('R03 buildPracticeUrl：兼容旧深链参数（knowledgePointId / questionType）', () => {
  const url = CU.buildPracticeUrl({ subject: 'math', grade: 1, mode: 'multi-kp', knowledgePoints: ['math-g1-m1-a'], questionType: 'fill', count: 20 });
  assert.ok(url.indexOf('kps=math-g1-m1-a') !== -1, '单 KP 走 kps');
  assert.ok(url.indexOf('qt=fill') !== -1, '旧 qt 透传');
});

test('R14 路由边界：math 委托既有链，chinese/english 返回 NOT_IMPLEMENTED', async () => {
  const API = require(path.join(ROOT, 'shared', 'generation', 'api.js'));
  const e = API.routeBySubject({ knowledgePointIds: ['math-g1-m1-a'] });
  assert.strictEqual(e.subject, 'math', '纯数学（无显式 subject）仍走数学链');
  const ec = API.routeBySubject({ subject: 'chinese', knowledgePoints: [] });
  assert.strictEqual(ec.subject, 'chinese');
  const r = await ec.generate({ subject: 'chinese', count: 10 });
  assert.strictEqual(r.status, 'NOT_IMPLEMENTED');
  assert.strictEqual(r.producedCount, 0);
});
