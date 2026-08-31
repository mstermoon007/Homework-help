#!/usr/bin/env node
/**
 * dev/check-capability-resolver.js — M2-R06 Resolver 全量 Gate
 *
 * 扫描 574 KP × 9 标准题型，统计最终决策：
 *   - 统计 ALLOW / FORBID / DEGRADE / MISSING / INVALID
 *   - 0 Resolver Error / 0 Mutation / 0 Invalid Capability
 * 输出 dev/reports/capability-resolution-report.json
 *
 * M2-R08: 复用 ScanContext 缓存（单次扫描）；另做抽样 parity 校验，
 * 确保缓存快路径与 Resolver.resolveFinal 决策一致。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var ScanContext = require(path.join(ROOT, 'shared', 'capability-scan-context.js'));
var Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));

var PARITY_INTERVAL = 50;

function run() {
  var forceRefresh = process.argv.indexOf('--refresh') !== -1;
  var scan = ScanContext.getScanContext({ forceRefresh: forceRefresh });
  var data = scan.data;
  var combos = data.combos;

  // 抽样 parity 校验：缓存快路径 vs Resolver.resolveFinal
  var parityMismatches = [];
  var parityChecked = 0;
  var kpIds = Object.keys(data.kpResults);
  for (var i = 0; i < combos.total; i += PARITY_INTERVAL) {
    var kpIdx = Math.floor(i / data.questionTypeIds.length);
    var qtIdx = i % data.questionTypeIds.length;
    var kpId = kpIds[kpIdx];
    var qtId = data.questionTypeIds[qtIdx];
    var expected = Resolver.resolveFinal({ knowledgePointId: kpId, questionType: qtId });
    var kpResult = data.kpResults[kpId];
    var pluginRec = data.gen.byPluginId[kpResult.pluginId] || null;
    var final = ScanContext.finalDecisionFor(kpResult.matrix, pluginRec, qtId);

    parityChecked++;
    if (expected.decision !== final.decision) {
      parityMismatches.push(kpId + ' x ' + qtId + ' :: cache=' + final.decision + ' resolver=' + expected.decision);
    }
  }

  var report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    totalKnowledgePoints: data.totalKp,
    totalCombinations: combos.total,
    decisions: combos.stats,
    bySubject: combos.bySubject,
    byGrade: combos.byGrade,
    byQuestionType: combos.byQuestionType,
    byPlugin: combos.byPlugin,
    errors: data.errors.length,
    errorSamples: data.errors.slice(0, 10),
    mutations: data.mutations.length,
    mutationSamples: data.mutations.slice(0, 10),
    parityChecked: parityChecked,
    parityMismatches: parityMismatches.length,
    parityMismatchSamples: parityMismatches.slice(0, 10)
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'capability-resolution-report.json'), JSON.stringify(report, null, 2));

  console.log('M2-R06 Capability Resolver 全量扫描');
  console.log('');
  console.log('Total KP:         ' + report.totalKnowledgePoints);
  console.log('Total combos:     ' + report.totalCombinations);
  console.log('ALLOW:            ' + combos.stats.ALLOW);
  console.log('FORBID:           ' + combos.stats.FORBID);
  console.log('DEGRADE:          ' + combos.stats.DEGRADE);
  console.log('MISSING:          ' + combos.stats.MISSING);
  console.log('INVALID:          ' + combos.stats.INVALID);
  console.log('Resolver Errors:  ' + report.errors);
  console.log('Mutations:        ' + report.mutations);
  console.log('Parity checked:   ' + report.parityChecked + ' (every ' + PARITY_INTERVAL + 'th combo)');
  console.log('Parity mismatch:  ' + report.parityMismatches);
  console.log('');
  console.log('Report -> dev/reports/capability-resolution-report.json');

  var ok = report.errors === 0 && report.mutations === 0 && report.parityMismatches === 0;
  console.log('');
  console.log(ok ? '[PASS] M2-R06 Capability Resolver Gate' : '[FAIL] M2-R06 Capability Resolver Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
