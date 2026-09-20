'use strict';

/**
 * tests/generator/p25-14-coverage.test.js — P25-14 375 KP 教育覆盖率报告
 *
 * 验收：
 *   1. dev/p25/build-coverage-report.js 产出 dev/p25/reports/coverage-report.json
 *   2. 报告含 7 维覆盖率统计（kpSemantic/questionTypeSemantic/generatorSemantic/
 *      evidence/variation/misconception/learnerFeedback）
 *   3. 基线数字匹配：375 KP / 1570 ALLOW / 307 A 类
 *   4. 每个 dimension 的 fields 含 status 字段（implemented | declared-only）
 *   5. 至少 5/7 维全 implemented（允许 2 项 declared-only：kp-matrix.json 与
 *      variation-profiles.json 为 dev-only 基线/观察产物，非生产消费对象）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const REPORT_PATH = path.join(ROOT, 'dev', 'p25', 'reports', 'coverage-report.json');

function runReport() {
  execFileSync(process.execPath, [path.join(ROOT, 'dev', 'p25', 'build-coverage-report.js')], {
    cwd: ROOT, stdio: 'pipe'
  });
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
}

test('P25-14 #1：脚本产出 coverage-report.json', () => {
  const report = runReport();
  assert.ok(report, '报告必须产出');
  assert.ok(report.generatedAt, '含 generatedAt');
  assert.ok(Array.isArray(report.dimensions), '含 dimensions 数组');
});

test('P25-14 #2：含 7 维覆盖率统计', () => {
  const report = runReport();
  const keys = report.dimensions.map(function (d) { return d.key; });
  const expected = ['kpSemantic', 'questionTypeSemantic', 'generatorSemantic', 'evidence', 'variation', 'misconception', 'learnerFeedback'];
  expected.forEach(function (k) {
    assert.ok(keys.indexOf(k) !== -1, '缺维度: ' + k);
  });
  assert.equal(report.dimensions.length, 7, '维度总数 = 7');
});

test('P25-14 #3：基线数字匹配 375 / 1570 / 307', () => {
  const report = runReport();
  assert.equal(report.baseline.knowledgePoints, 375, 'KP 总数 = 375');
  assert.equal(report.baseline.allowMappings, 1570, 'ALLOW 总数 = 1570');
  assert.equal(report.baseline.aClassKPs, 307, 'A 类 KP = 307');
});

test('P25-14 #4：每个 dimension fields 含 status 字段', () => {
  const report = runReport();
  report.dimensions.forEach(function (d) {
    assert.ok(d.fields && d.fields.length > 0, d.key + ' 应有 fields');
    d.fields.forEach(function (f) {
      assert.ok(f.status === 'implemented' || f.status === 'declared-only',
        d.key + '.' + f.dataFile + ' status 应是 implemented|declared-only，实际: ' + f.status);
      assert.equal(typeof f.consumedByProduction, 'boolean',
        d.key + '.' + f.dataFile + ' consumedByProduction 应是 boolean');
    });
    assert.ok(d.summary, d.key + ' 应有 summary');
    assert.equal(d.summary.total, d.fields.length, d.key + ' summary.total 应等于 fields.length');
  });
});

test('P25-14 #5：至少 5/7 维全 implemented（允许 2 项 dev-only declared-only）', () => {
  const report = runReport();
  const fullyImpl = report.dimensions.filter(function (d) { return d.summary.declaredOnly === 0; }).length;
  assert.ok(fullyImpl >= 5,
    '至少 5/7 维全 implemented，实际 ' + fullyImpl + '/7；declaredOnlyFields: ' + JSON.stringify(report.overall.declaredOnlyFields));
});
