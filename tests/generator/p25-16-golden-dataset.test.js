'use strict';

/**
 * tests/generator/p25-16-golden-dataset.test.js — P25-16 黄金题集测试
 *
 * 冻结不变量：
 *   1. golden-questions.json 存在且 schemaVersion='p25-16-v1'
 *   2. 总题数 ≥ 200（15 族 × ~20 题，部分小族允许 <20）
 *   3. 15 语义族全覆盖（byFamily 键集 = 15）
 *   4. 每条 10 必填字段（kpId/semanticFamily/learningTarget/questionType/difficulty/
 *      expectedStructure/answer/validationRules/source/humanReview）
 *   5. source='ai-candidate' + humanReview='pending'
 *   6. 题型仅 apply/choice/fill（核心三题型）
 *   7. 证据状态 ∈ {pass, warn, skip}（不允许 fail）
 *   8. KP 均为 A 类（draftSemanticLevel==='A'）
 *   9. 无重复题（kpId+questionType+answer 唯一）
 *  10. validate-golden-dataset.js 通过（0 errors）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const GOLDEN_PATH = path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json');
const MATRIX_PATH = path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json');
const FAMILIES_PATH = path.join(ROOT, 'kbl', 'teaching', 'semantic-families.json');

const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
const families = JSON.parse(fs.readFileSync(FAMILIES_PATH, 'utf8'));

const aClassKpIds = new Set(
  matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; }).map(function (k) { return k.id; })
);
const familyIds = (families.families || []).map(function (f) { return f.id; });

test('1. golden-questions.json 存在且 schema 正确', () => {
  assert.ok(fs.existsSync(GOLDEN_PATH), 'golden-questions.json 存在');
  assert.equal(golden.schemaVersion, 'p25-16-v1');
  assert.ok(Array.isArray(golden.questions));
  assert.ok(golden.counts.total > 0);
});

test('2. 总题数 ≥ 200', () => {
  assert.ok(golden.questions.length >= 200, '总题数 ≥ 200，实际 ' + golden.questions.length);
  assert.equal(golden.counts.total, golden.questions.length);
});

test('3. 15 语义族全覆盖', () => {
  const covered = Object.keys(golden.counts.byFamily || {});
  assert.equal(covered.length, 15, '族覆盖数 = 15');
  familyIds.forEach(function (fid) {
    assert.ok(covered.indexOf(fid) !== -1, '族 ' + fid + ' 已覆盖');
  });
});

test('4. 每条 10 必填字段', () => {
  const REQUIRED = ['kpId', 'semanticFamily', 'learningTarget', 'questionType',
    'difficulty', 'expectedStructure', 'answer', 'validationRules', 'source', 'humanReview'];
  golden.questions.forEach(function (q, i) {
    REQUIRED.forEach(function (f) {
      assert.ok(q[f] !== undefined && q[f] !== null, 'Q' + i + ' 缺字段 ' + f);
    });
  });
});

test('5. source=ai-candidate + humanReview=pending', () => {
  golden.questions.forEach(function (q, i) {
    assert.equal(q.source, 'ai-candidate', 'Q' + i + ' source');
    assert.equal(q.humanReview, 'pending', 'Q' + i + ' humanReview');
  });
});

test('6. 题型仅 apply/choice/fill', () => {
  const VALID = { apply: true, choice: true, fill: true };
  golden.questions.forEach(function (q, i) {
    assert.ok(VALID[q.questionType], 'Q' + i + ' 题型 ' + q.questionType + ' 合法');
  });
});

test('7. 证据状态 ∈ {pass, warn, skip}（不允许 fail）', () => {
  const VALID = { pass: true, warn: true, skip: true };
  golden.questions.forEach(function (q, i) {
    var s = q.validationRules && q.validationRules.semanticEvidenceState;
    assert.ok(VALID[s], 'Q' + i + ' 证据状态 ' + s + ' 合法');
  });
});

test('8. KP 均为 A 类', () => {
  golden.questions.forEach(function (q, i) {
    assert.ok(aClassKpIds.has(q.kpId), 'Q' + i + ' KP ' + q.kpId + ' 是 A 类');
  });
});

test('9. 无重复题（kpId+questionType+answer 前50字符唯一）', () => {
  const seen = new Set();
  let dupes = 0;
  golden.questions.forEach(function (q) {
    var key = q.kpId + '|' + q.questionType + '|' + String(q.answer || '').slice(0, 50);
    if (seen.has(key)) dupes++;
    else seen.add(key);
  });
  assert.equal(dupes, 0, '无重复题');
});

test('10. validate-golden-dataset.js 通过（0 errors）', () => {
  const reportPath = path.join(ROOT, 'dev', 'p25', 'reports', 'golden-validation-report.json');
  assert.ok(fs.existsSync(reportPath), '验证报告存在');
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(report.errors.length, 0, '0 errors');
  assert.equal(report.passed, true, '验证通过');
});
