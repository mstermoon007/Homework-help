#!/usr/bin/env node
/**
 * dev/check-capability-matrix.js — M2-R04 Matrix Gate
 *
 * 对 574 KP 全量计算 KnowledgePoint × QuestionType × Capability Matrix：
 *   - 每 KP 至少 1 个 ALLOW 题型
 *   - 每个 ALLOW 题型都能解析到 Registry 能力
 *   - 不允许的组合明确拒绝（FORBID）
 *   - 不调用任何 Generator
 * 输出 dev/reports/knowledge-capability-matrix.json
 *
 * M2-R08: 通过 ScanContext 复用单次扫描结果
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var ScanContext = require(path.join(ROOT, 'shared', 'capability-scan-context.js'));
var Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));

function run() {
  var forceRefresh = process.argv.indexOf('--refresh') !== -1;
  var scan = ScanContext.getScanContext({ forceRefresh: forceRefresh });
  var data = scan.data;
  var scanInfo = data.scanInfo;
  var stats = data.stats;

  var noAllow = [];
  var matrix = {};

  Object.keys(data.kpResults).forEach(function (id) {
    var mx = data.kpResults[id].matrix;
    matrix[id] = mx;

    var allowIds = Object.keys(mx.questionTypes).filter(function (qt) {
      return mx.questionTypes[qt].decision === 'ALLOW';
    });
    if (allowIds.length === 0) noAllow.push(id);
  });

  var allowTotal = 0;
  Object.keys(matrix).forEach(function (id) {
    allowTotal += matrix[id].allowed.length;
  });

  var summary = {
    total: data.totalKp,
    kpsWithAllow: data.totalKp - noAllow.length,
    kpsWithoutAllow: noAllow.length,
    decisions: {
      ALLOW: allowTotal,
      FORBID: stats.FORBID,
      DEGRADE: stats.DEGRADE,
      MISSING: stats.MISSING,
      INVALID: stats.INVALID
    },
    registryTypes: Registry.TYPES.length
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'knowledge-capability-matrix.json'),
    JSON.stringify({ summary: summary, matrix: matrix }, null, 2));

  console.log('M2-R04 KnowledgePoint × QuestionType × Capability Matrix');
  console.log('');
  console.log('Total KP:          ' + summary.total);
  console.log('KP with ALLOW:     ' + summary.kpsWithAllow);
  console.log('KP without ALLOW:  ' + summary.kpsWithoutAllow);
  console.log('Decisions:         ' + JSON.stringify(summary.decisions));
  console.log('  ALLOW   = 可生成题型');
  console.log('  FORBID  = 语义冲突/明确禁止');
  console.log('  DEGRADE = 未声明但无硬冲突（潜在可用）');
  console.log('  MISSING = 数据缺失');
  console.log('');
  console.log('Scan Info: count=' + scan.scanCount + ', time=' + scanInfo.scanTime + 'ms, cacheHit=' + scan.cacheHit);
  console.log('');
  console.log('Report -> dev/reports/knowledge-capability-matrix.json');

  var ok = summary.kpsWithoutAllow === 0 && summary.decisions.MISSING === 0;
  console.log('');
  console.log(ok ? '[PASS] M2-R04 Capability Matrix Gate' : '[FAIL] M2-R04 Capability Matrix Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
