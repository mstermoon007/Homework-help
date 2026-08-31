#!/usr/bin/env node
/**
 * dev/check-metrics.js — P5-R03 生产指标查看/导出
 *
 * 用法：
 *   node dev/check-metrics.js              # 控制台打印摘要
 *   node dev/check-metrics.js --json       # 输出 JSON
 *   node dev/check-metrics.js --reset      # 重置计数器
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var EXPORT_JSON = process.argv.indexOf('--json') !== -1;
var RESET = process.argv.indexOf('--reset') !== -1;

var Metrics = require(path.join(ROOT, 'shared', 'metrics.js'));

if (RESET) {
  Metrics.reset();
  console.log('Metrics 计数器已重置');
  process.exit(0);
}

var summary = Metrics.getSummary();

if (EXPORT_JSON) {
  console.log(Metrics.exportJSON());
  process.exit(0);
}

// 控制台友好输出
console.log('=== P5-R03 生产指标摘要 ===');
console.log('时间:', summary.timestamp);
console.log('');

console.log('--- 生成指标 ---');
console.log('  总调用:', summary.generation.total);
console.log('  成功率:', (summary.generation.successRate * 100).toFixed(1) + '%');
console.log('  失败率:', (summary.generation.failureRate * 100).toFixed(1) + '%');
console.log('  按 Generator:', summary.generation.byGenerator);
console.log('  按学科:', summary.generation.bySubject);
console.log('  按年级:', summary.generation.byGrade);

console.log('');
console.log('--- 验证指标 ---');
console.log('  总验证:', summary.validation.total);
console.log('  通过率:', (summary.validation.passRate * 100).toFixed(1) + '%');
console.log('  失败率:', (summary.validation.failureRate * 100).toFixed(1) + '%');
console.log('  Top 10 错误:', summary.validation.topErrors.map(function (e) { return e[0] + '(' + e[1] + ')'; }).join(', '));
console.log('  按 Generator:', summary.validation.byGenerator);
console.log('  按学科:', summary.validation.bySubject);

console.log('');
console.log('--- 重试指标 ---');
console.log('  总尝试:', summary.retry.totalAttempts);
console.log('  平均重试:', summary.retry.avgRetries.toFixed(2));
console.log('  达上限:', summary.retry.maxRetriesHit);
console.log('  Top 10 错误码:', summary.retry.topErrorCodes.map(function (e) { return e[0] + '(' + e[1] + ')'; }).join(', '));

console.log('');
console.log('--- 重复率指标 ---');
console.log('  总题目:', summary.duplicate.totalQuestions);
console.log('  重复题:', summary.duplicate.duplicatesFound);
console.log('  重复率:', (summary.duplicate.duplicateRate * 100).toFixed(2) + '%');

console.log('');
console.log('--- 渲染指标 ---');
console.log('  总渲染:', summary.render.total);
console.log('  成功率:', (summary.render.successRate * 100).toFixed(1) + '%');
console.log('  失败率:', (summary.render.failureRate * 100).toFixed(1) + '%');
console.log('  错误类型:', summary.render.errorsByType);

console.log('');
console.log('=== End ===');