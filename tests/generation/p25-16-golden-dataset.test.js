'use strict';

/**
 * tests/generation/p25-16-golden-dataset.test.js — P25-16 黄金题集测试
 *
 * 冻结不变量：
 *   1. golden-questions.json 存在且 schemaVersion='p25-16-v1'
 *   2. 总题数 ≥ 200（15 族 × ~20 题，部分小族允许 <20）
 *   3. 15 语义族全覆盖（byFamily 键集 = 15）
 *   4. 每条 10 必填字段（kpId/semanticFamily/learningTarget/questionType/difficulty/
 *      expectedStructure/answer/validationRules/source/humanReview）
 *   5. source='ai-candidate' + humanReview='llm-finalized'（用户 2026-09-30 取消人工复核）
 *   6. 题型仅 apply/choice/fill（核心三题型）
 *   7. 证据状态 ∈ {pass, warn, skip}（不允许 fail）
 *   8. KP 均在 kp-matrix 375 KP 内（A 类概念 + B/C 通用算法，SEMANTIC_PASS 收录）
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

// 合法 KP = kp-matrix 全部 KP（375）；收录门槛为 SEMANTIC_PASS，不再按 draftSemanticLevel 限 A 类。
const knownKpIds = new Set(matrix.kps.map(function (k) { return k.id; }));
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

test('4. 每条 12 必填字段（FINAL-40：KP/family/teaching target/cognitive target/QT/intent/difficulty/variation/structure/semantic evidence/answer/validator）', () => {
  const REQUIRED = ['kpId', 'semanticFamily', 'teachingTarget', 'questionType',
    'difficulty', 'variation', 'structure', 'semanticEvidence', 'answer', 'validator',
    'source', 'humanReview'];
  // cognitiveTarget/intent 必须记录（key 在）但允许 null（诚实缺位，DEF-04 不编造）
  const RECORDED_NULL_OK = ['cognitiveTarget', 'intent'];
  golden.questions.forEach(function (q, i) {
    REQUIRED.forEach(function (f) {
      assert.ok(q[f] !== undefined && q[f] !== null, 'Q' + i + ' 缺字段 ' + f);
    });
    RECORDED_NULL_OK.forEach(function (f) {
      assert.ok(q[f] !== undefined, 'Q' + i + ' 未记录字段 ' + f);
    });
  });
});

test('5. source=ai-candidate + humanReview=llm-finalized', () => {
  golden.questions.forEach(function (q, i) {
    assert.equal(q.source, 'ai-candidate', 'Q' + i + ' source');
    assert.equal(q.humanReview, 'llm-finalized', 'Q' + i + ' humanReview');
  });
});

test('6. 题型仅 apply/choice/fill', () => {
  const VALID = { apply: true, choice: true, fill: true };
  golden.questions.forEach(function (q, i) {
    assert.ok(VALID[q.questionType], 'Q' + i + ' 题型 ' + q.questionType + ' 合法');
  });
});

test('7. 证据状态仅 pass（FINAL-40：WARN 不计 PASS）', () => {
  const VALID = { pass: true };
  golden.questions.forEach(function (q, i) {
    var s = q.validator && q.validator.semanticEvidenceState;
    assert.ok(VALID[s], 'Q' + i + ' 证据状态 ' + s + ' 非法（FINAL-40 仅 pass）');
  });
});

test('8. KP 均在 375 内；A 类全覆盖 + B/C 通用算法覆盖 ≥61（SEMANTIC_PASS 门槛收录）', () => {
  const aIds = new Set(
    matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; }).map(function (k) { return k.id; })
  );
  const covered = new Set();
  let bcCovered = 0;
  golden.questions.forEach(function (q, i) {
    assert.ok(knownKpIds.has(q.kpId), 'Q' + i + ' KP ' + q.kpId + ' 在 kp-matrix 内');
    if (!covered.has(q.kpId)) {
      covered.add(q.kpId);
      if (!aIds.has(q.kpId)) bcCovered++;
    }
  });
  let aCovered = 0;
  aIds.forEach(function (id) { if (covered.has(id)) aCovered++; });
  assert.equal(aCovered, aIds.size, 'A 类 KP 必须全覆盖（' + aCovered + '/' + aIds.size + '）');
  assert.ok(bcCovered >= 62, 'B/C 通用算法 KP 覆盖应 ≥62，实际 ' + bcCovered);
  assert.ok(covered.size >= 369, '语义覆盖 KP 应 ≥369，实际 ' + covered.size);
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
