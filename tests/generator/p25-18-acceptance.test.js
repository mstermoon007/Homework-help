'use strict';

/**
 * tests/generator/p25-18-acceptance.test.js — P25-18 最终产品化验收测试
 *
 * 12 项验收数字（任务书 L1245-L1281），每项一断言。
 * 读取 dev/p25/reports/p25-final-acceptance.json（由 build-final-acceptance.js 产出）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'dev', 'p25', 'reports', 'p25-final-acceptance.json');

const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
const byKey = {};
(report.metrics || []).forEach(function (m) { byKey[m.key] = m; });

function assertMetric(key, expected) {
  const m = byKey[key];
  assert.ok(m, '指标 ' + key + ' 存在');
  assert.equal(m.expected, expected, key + ' expected = ' + expected);
  assert.ok(m.status === 'pass' || m.status === 'pass (derived)',
    key + ' status 应为 pass，实际: ' + m.status + '（actual=' + m.actual + ')');
}

test('1. kbl = 375', () => assertMetric('kbl', 375));
test('2. allow = 1570', () => assertMetric('allow', 1570));
test('3. realGen = 1570', () => assertMetric('realGen', 1570));
test('4. questionTypes = 7', () => assertMetric('questionTypes', 7));
test('5. aClassSemanticPass = 921', () => assertMetric('aClassSemanticPass', 921));
test('6. goldenPass = 100', () => assertMetric('goldenPass', 100));
test('7. variation = pass', () => assertMetric('variation', 'pass'));
test('8. misconception = pass', () => assertMetric('misconception', 'pass'));
test('9. learnerFeedback = pass', () => assertMetric('learnerFeedback', 'pass'));
test('10. browser = pass', () => assertMetric('browser', 'pass'));
test('11. print = pass', () => assertMetric('print', 'pass'));
test('12. ci = pass', () => assertMetric('ci', 'pass'));

test('overallStatus = pass', () => {
  assert.equal(report.overallStatus, 'pass', 'P25 最终验收 overallStatus = pass');
});
