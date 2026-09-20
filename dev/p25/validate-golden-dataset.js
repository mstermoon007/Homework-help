#!/usr/bin/env node
'use strict';
// dev/p25/validate-golden-dataset.js — P25-16 黄金题集结构验证器
//
// 任务书 P25-16：AI 候选 + 自动结构验证 + 人工复核 三阶段。
// 本脚本执行第二阶段「自动结构验证」，对 golden-questions.json 做完整性/一致性校验：
//   1. schema 完整性：每条 9 必填字段 + source + humanReview
//   2. KP 存在性：kpId 必须在 kp-matrix.json A 类 KP 中
//   3. 族一致性：semanticFamily 必须在 semantic-families.json 15 族中
//   4. 题型合法：questionType 必须在核心题型 apply/choice/fill 中
//   5. 证据状态合法：semanticEvidenceState ∈ {pass, warn, skip}（不允许 fail）
//   6. source='ai-candidate' + humanReview='pending'
//   7. 族覆盖：15 族全部有题（每族 ≥1）
//   8. 答案非空：answer 非空字符串/非 null
//   9. 无重复题：同 (kpId, questionType, answer) 不重复
//
// 用法：node dev/p25/validate-golden-dataset.js [--strict]
//   --strict：族覆盖不足 15 或每族 < 10 时 exit 1
// 产出：dev/p25/reports/golden-validation-report.json

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var golden = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json'), 'utf8'));
var kpMatrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'), 'utf8'));
var semanticFamilies = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'semantic-families.json'), 'utf8'));

var STRICT = process.argv.indexOf('--strict') !== -1;

var aClassKpIds = {};
kpMatrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; }).forEach(function (k) {
  aClassKpIds[k.id] = true;
});

var familyIds = {};
(semanticFamilies.families || []).forEach(function (f) { familyIds[f.id] = f.name; });

var CORE_QTS = { apply: true, choice: true, fill: true };
var VALID_EVIDENCE_STATES = { pass: true, warn: true, skip: true };

// 必填字段（expectedEvidence 可选——生成器过渡期不发 semanticEvidence 时为 null）
var REQUIRED_FIELDS = [
  'kpId', 'semanticFamily', 'learningTarget', 'questionType', 'difficulty',
  'expectedStructure', 'answer',
  'validationRules', 'source', 'humanReview'
];

var errors = [];
var warnings = [];
var stats = {
  total: 0,
  byFamily: {},
  byEvidenceState: {},
  byQuestionType: {},
  duplicates: 0,
  invalidKp: 0,
  invalidFamily: 0,
  invalidQt: 0,
  invalidEvidenceState: 0,
  missingFields: 0,
  emptyAnswer: 0
};

var seenKeys = {};

(golden.questions || []).forEach(function (q, idx) {
  stats.total++;

  // 1. 必填字段
  REQUIRED_FIELDS.forEach(function (f) {
    if (q[f] === undefined || q[f] === null) {
      errors.push('Q' + idx + ' 缺字段 ' + f);
      stats.missingFields++;
    }
  });

  // 2. KP 存在性
  if (q.kpId && !aClassKpIds[q.kpId]) {
    errors.push('Q' + idx + ' KP ' + q.kpId + ' 不在 A 类 KP 中');
    stats.invalidKp++;
  }

  // 3. 族一致性
  if (q.semanticFamily && !familyIds[q.semanticFamily]) {
    errors.push('Q' + idx + ' 族 ' + q.semanticFamily + ' 不在 semantic-families 15 族中');
    stats.invalidFamily++;
  }
  if (q.semanticFamily) {
    stats.byFamily[q.semanticFamily] = (stats.byFamily[q.semanticFamily] || 0) + 1;
  }

  // 4. 题型合法
  if (q.questionType && !CORE_QTS[q.questionType]) {
    errors.push('Q' + idx + ' 题型 ' + q.questionType + ' 不在核心题型 apply/choice/fill 中');
    stats.invalidQt++;
  }
  if (q.questionType) {
    stats.byQuestionType[q.questionType] = (stats.byQuestionType[q.questionType] || 0) + 1;
  }

  // 5. 证据状态合法
  var evState = q.validationRules && q.validationRules.semanticEvidenceState;
  if (evState && !VALID_EVIDENCE_STATES[evState]) {
    errors.push('Q' + idx + ' 证据状态 ' + evState + ' 非法（允许 pass/warn/skip，不允许 fail）');
    stats.invalidEvidenceState++;
  }
  if (evState) {
    stats.byEvidenceState[evState] = (stats.byEvidenceState[evState] || 0) + 1;
  }

  // 6. source + humanReview
  if (q.source !== 'ai-candidate') {
    errors.push('Q' + idx + ' source 应为 ai-candidate，实际 ' + q.source);
  }
  if (q.humanReview !== 'pending') {
    errors.push('Q' + idx + ' humanReview 应为 pending，实际 ' + q.humanReview);
  }

  // 8. 答案非空
  if (q.answer === null || q.answer === '' || q.answer === '[object Object]') {
    errors.push('Q' + idx + ' 答案为空或序列化失败');
    stats.emptyAnswer++;
  }

  // 9. 无重复题
  var dedupKey = q.kpId + '|' + q.questionType + '|' + (q.answer || '').slice(0, 50);
  if (seenKeys[dedupKey]) {
    warnings.push('Q' + idx + ' 与前题重复 ' + dedupKey);
    stats.duplicates++;
  } else {
    seenKeys[dedupKey] = true;
  }
});

// 7. 族覆盖
var familiesCovered = Object.keys(stats.byFamily).length;
var totalFamilies = (semanticFamilies.families || []).length;
if (familiesCovered < totalFamilies) {
  errors.push('族覆盖不足：' + familiesCovered + '/' + totalFamilies);
}
if (STRICT) {
  Object.keys(familyIds).forEach(function (fam) {
    var cnt = stats.byFamily[fam] || 0;
    if (cnt < 10) {
      warnings.push('族 ' + fam + ' 题数不足 10：' + cnt);
    }
  });
}

var report = {
  schemaVersion: 'p25-16-validation-v1',
  validatedAt: new Date().toISOString(),
  strict: STRICT,
  total: stats.total,
  familiesCovered: familiesCovered,
  totalFamilies: totalFamilies,
  stats: stats,
  errors: errors,
  warnings: warnings,
  passed: errors.length === 0
};

var reportDir = path.join(ROOT, 'dev', 'p25', 'reports');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
var reportPath = path.join(reportDir, 'golden-validation-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('黄金题集验证完成：');
console.log('  总题数：' + stats.total);
console.log('  族覆盖：' + familiesCovered + '/' + totalFamilies);
console.log('  证据状态分布：' + JSON.stringify(stats.byEvidenceState));
console.log('  题型分布：' + JSON.stringify(stats.byQuestionType));
console.log('  错误数：' + errors.length);
console.log('  警告数：' + warnings.length);
console.log('  结果：' + (report.passed ? 'PASS' : 'FAIL'));
if (errors.length) {
  console.log('  首批错误（前 5）：');
  errors.slice(0, 5).forEach(function (e) { console.log('    - ' + e); });
}
console.log('  报告：' + path.relative(ROOT, reportPath));

if (!report.passed || (STRICT && warnings.length > 0)) {
  process.exit(1);
}
