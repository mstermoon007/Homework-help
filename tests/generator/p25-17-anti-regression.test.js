'use strict';

/**
 * tests/generator/p25-17-anti-regression.test.js — P25-17 防退化测试纳入 CI
 *
 * 10 项断言：4 项 CI 接线 + 6 项防退化。
 *
 * CI 接线（4）：
 *   1. package.json 含 verify:education 脚本
 *   2. package.json 含 verify:coverage 脚本（--strict）
 *   3. package.json 含 verify:golden 脚本
 *   4. verify-m0.js steps 含 edu-gen/coverage/golden 三键
 *
 * 防退化（6）：
 *   5. ALLOW 基线 = 1570（实时跑 buildEligibility 统计）
 *   6. educational-generation-report.json 存在且 semanticFail = 0
 *   7. golden-validation-report.json passed = true（0 errors）
 *   8. 黄金题 kpId 全部 ∈ A 类 KP 集合
 *   9. 黄金题 questionType 全部 ∈ apply/choice/fill
 *  10. coverage-report.json 无新增 declared-only 字段（newDeclaredOnly = 0）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

// 加载 bundle 环境（buildEligibility 依赖 KBL Runtime）
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MATRIX = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'), 'utf8'));
const GOLDEN = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json'), 'utf8'));
const EDU_GEN_REPORT = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'p25', 'reports', 'educational-generation-report.json'), 'utf8'));
const GOLDEN_VAL_REPORT = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'p25', 'reports', 'golden-validation-report.json'), 'utf8'));
const COVERAGE_REPORT = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'p25', 'reports', 'coverage-report.json'), 'utf8'));

const aClassKpIds = new Set(
  MATRIX.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; }).map(function (k) { return k.id; })
);

// ---------- CI 接线（4） ----------

test('1. package.json 含 verify:education 脚本', () => {
  assert.ok(PKG.scripts['verify:education'], 'verify:education 脚本存在');
  assert.ok(PKG.scripts['verify:education'].indexOf('check-educational-generation.js') !== -1,
    '指向 dev/check-educational-generation.js');
});

test('2. package.json 含 verify:coverage 脚本（--strict）', () => {
  assert.ok(PKG.scripts['verify:coverage'], 'verify:coverage 脚本存在');
  assert.ok(PKG.scripts['verify:coverage'].indexOf('--strict') !== -1,
    '含 --strict 标志');
});

test('3. package.json 含 verify:golden 脚本', () => {
  assert.ok(PKG.scripts['verify:golden'], 'verify:golden 脚本存在');
  assert.ok(PKG.scripts['verify:golden'].indexOf('validate-golden-dataset.js') !== -1,
    '指向 dev/p25/validate-golden-dataset.js');
});

test('4. verify-m0.js steps 含 edu-gen/coverage/golden 三键', () => {
  const verifyM0 = fs.readFileSync(path.join(ROOT, 'dev', 'verify-m0.js'), 'utf8');
  ['edu-gen', 'coverage', 'golden'].forEach(function (k) {
    assert.ok(verifyM0.indexOf("'" + k + "'") !== -1 || verifyM0.indexOf('key: ' + "'" + k + "'") !== -1,
      'verify-m0.js 含 step key: ' + k);
  });
});

// ---------- 防退化（6） ----------

test('5. ALLOW 基线 = 1570（实时跑 buildEligibility）', () => {
  const ALL = QTR.TYPES.map(function (t) { return t.id; });
  let count = 0;
  for (var g = 1; g <= 6; g++) {
    const kps = global.KnowledgeContext.kpsForGrade('math', g) || [];
    kps.forEach(function (k) {
      const ev = KCV.buildEligibility([k.knowledgeId], ALL);
      const row = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
      ALL.forEach(function (t) { if (row[t] === 'ALLOW') count++; });
    });
  }
  assert.equal(count, 1570, 'ALLOW 实时统计 = 1570（防退化基线）');
});

test('6. educational-generation-report.json 存在且 semanticFail = 0', () => {
  assert.ok(EDU_GEN_REPORT, '报告存在');
  assert.equal(EDU_GEN_REPORT.summary.semanticFail, 0, 'SEMANTIC_FAIL = 0（无生成失败/规则违例）');
});

test('7. golden-validation-report.json passed = true（0 errors）', () => {
  assert.equal(GOLDEN_VAL_REPORT.passed, true, '黄金题验证通过');
  assert.equal(GOLDEN_VAL_REPORT.errors.length, 0, '0 errors');
});

test('8. 黄金题 kpId 全部 ∈ A 类 KP 集合', () => {
  (GOLDEN.questions || []).forEach(function (q, i) {
    assert.ok(aClassKpIds.has(q.kpId), 'Q' + i + ' kpId ' + q.kpId + ' ∈ A 类 KP');
  });
});

test('9. 黄金题 questionType 全部 ∈ apply/choice/fill', () => {
  const VALID = { apply: true, choice: true, fill: true };
  (GOLDEN.questions || []).forEach(function (q, i) {
    assert.ok(VALID[q.questionType], 'Q' + i + ' questionType ' + q.questionType + ' ∈ apply/choice/fill');
  });
});

test('10. coverage-report.json 无新增 declared-only 字段', () => {
  const newFields = COVERAGE_REPORT.overall.newDeclaredOnly || [];
  assert.equal(newFields.length, 0,
    '无新增 declared-only 字段（防生产消费退化）；实际: ' + JSON.stringify(newFields));
});
