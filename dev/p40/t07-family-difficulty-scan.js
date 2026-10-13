'use strict';
/**
 * dev/p40/t07-family-difficulty-scan.js — P40-T-07 概念族内难度递进扫描（只读）
 *
 * 消费 difficulty-integrity-validator.validateFamilyDifficultyMonotonic：
 *   同 familyId 内 stageOrder 靠后的 KP，seedDifficulty ≥ 前序；
 *   倒挂登记 needs-review（挂人工，不自动改数）。
 * 输出：stdout 报告 + dev/p40/out/t07-family-difficulty.json（本战役验收证据）。
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var Validator = require(path.join(ROOT, 'shared', 'validator', 'difficulty-integrity-validator.js'));
var cap = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'canonical', 'capability.json'), 'utf8')).capability;

var r = Validator.validateFamilyDifficultyMonotonic(cap);
var report = {
  task: 'P40-T-07',
  generatedBy: 'dev/p40/t07-family-difficulty-scan.js',
  rule: '同 familyId 内 stageOrder 靠后者 seedDifficulty ≥ 前序（倒挂→needs-review，不自动改数）',
  rowsScanned: cap.length,
  checkedInFamilies: r.checked,
  families: r.families,
  violations: r.violations.length,
  needsReview: r.needsReview
};
fs.mkdirSync(path.join(ROOT, 'dev', 'p40', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dev', 'p40', 'out', 't07-family-difficulty.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

console.log('[P40-T-07] 族内难度递进扫描：rows ' + cap.length + '；族 ' + r.families + '；倒挂 ' + r.violations.length + ' 条' + (r.violations.length ? '（needs-review 挂人工）' : ' ✅'));
