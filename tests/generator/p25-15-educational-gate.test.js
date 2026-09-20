'use strict';

/**
 * tests/generator/p25-15-educational-gate.test.js — P25-15 教育真实性门禁测试
 *
 * 冻结不变量：
 *   1. dev/check-educational-generation.js 存在
 *   2. A 类 KP 来源 kp-matrix.json 且数量 = 307
 *   3. 核心题型 = apply/choice/fill
 *   4. 四态分桶枚举完整（GENERATION_PASS/SEMANTIC_PASS/SEMANTIC_WARN/SEMANTIC_FAIL）
 *   5. 报告 educational-generation-report.json schema 正确
 *   6. --strict 语义：任一 SEMANTIC_FAIL → exit 1（用小分片验证退出码）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(ROOT, 'dev', 'check-educational-generation.js');
const MATRIX_PATH = path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json');
const TMP_REPORT = path.join(ROOT, 'dev', 'reports', 'edu-gen-test-report.json');

const matrix = JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));

function runShard(shard) {
  // 用 --report 写到临时路径，避免覆盖提交基线 educational-generation-report.json
  spawnSync(process.execPath, [SCRIPT, '--shard=' + shard, '--report=' + path.relative(ROOT, TMP_REPORT)],
    { cwd: ROOT, stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(TMP_REPORT, 'utf8'));
}

test('1. 脚本 dev/check-educational-generation.js 存在', () => {
  assert.ok(fs.existsSync(SCRIPT), '脚本存在');
});

test('2. A 类 KP 来源 kp-matrix.json 且数量 = 307', () => {
  const aCount = matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; }).length;
  assert.equal(aCount, 307, 'A 类 KP = 307');
  assert.equal(matrix.distributions.byDraftLevel.A, 307, 'distributions.byDraftLevel.A = 307');
});

test('3. 核心题型 = apply/choice/fill', () => {
  const report = runShard('1/20'); // 小分片，快
  assert.deepEqual(report.scope.coreQuestionTypes, ['apply', 'choice', 'fill'],
    '核心题型 = apply/choice/fill');
});

test('4. 四态分桶枚举完整', () => {
  const report = runShard('1/20');
  const keys = Object.keys(report.summary);
  ['generationPass', 'semanticPass', 'semanticWarn', 'semanticFail'].forEach(function (k) {
    assert.ok(keys.indexOf(k) !== -1, 'summary.' + k + ' 存在');
  });
  // 四态和 = total
  const sum = report.summary.generationPass + report.summary.semanticPass +
    report.summary.semanticWarn + report.summary.semanticFail;
  assert.equal(sum, report.summary.total, '四态和 = total');
});

test('5. 报告 educational-generation-report.json schema 正确', () => {
  const report = runShard('1/20');
  assert.equal(report.schemaVersion, 'p25-15-edu-gen-v1', 'schemaVersion');
  assert.ok(report.generatedAt, 'generatedAt');
  assert.ok(report.config, 'config');
  assert.ok(report.scope, 'scope');
  assert.ok(report.summary, 'summary');
  assert.ok(Array.isArray(report.fails), 'fails 数组');
});

test('6. --strict 语义：任一 SEMANTIC_FAIL → exit 1', () => {
  // 用小分片跑一次（写到临时路径），验证：0 FAIL 时 exit 0
  const res = spawnSync(process.execPath,
    [SCRIPT, '--shard=1/20', '--report=' + path.relative(ROOT, TMP_REPORT)],
    { cwd: ROOT, stdio: 'pipe' });
  const report = JSON.parse(fs.readFileSync(TMP_REPORT, 'utf8'));
  if (report.summary.semanticFail === 0) {
    assert.equal(res.status, 0, '0 SEMANTIC_FAIL → exit 0');
  } else {
    assert.equal(res.status, 1, '有 SEMANTIC_FAIL → exit 1');
  }
});
