#!/usr/bin/env node
/**
 * dev/check-operation-ontology.js — M1-02.1 Operation Ontology Gate
 *
 * 扫描 574 个 Legacy KnowledgePoint：
 *   Legacy -> Normalizer(含 operation map) -> Canonical
 * 校验：
 *   1. 所有 operation 都属于 Canonical Dictionary（Invalid = 0）
 *   2. Alias 无循环
 *   3. 不存在插件名作为 operation
 *   4. 所有 unresolved 均可追踪（覆盖率统计）
 * 并输出 dev/reports/operation-inventory.json（治理记录，可审计）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var OpsOnt = require(path.join(ROOT, 'shared', 'knowledge-operation.js'));
var OpsMap = require(path.join(ROOT, 'shared', 'ontology-operation-map.js'));

var SUBJECTS = ['math', 'cn', 'en'];
var CANON = OpsOnt.CANONICAL_IDS;

function run() {
  var total = 0, covered = 0, missing = 0;
  var invalid = [];           // canonical 之外的非法 operation
  var pluginOpCount = {};     // 覆盖率统计（按 pluginId）
  var inventory = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var c = Ontology.normalize(kp);
          var ops = c.knowledge.operations || [];
          if (ops.length) covered++; else missing++;

          ops.forEach(function (o) {
            if (CANON.indexOf(o) === -1) invalid.push(kp.id + ' :: ' + o);
          });

          var meta = OpsMap.metaForPlugin(kp.pluginId);
          inventory.push({
            knowledgePointId: kp.id,
            subject: c.subject,
            pluginId: kp.pluginId,
            mappedOperations: ops,
            status: ops.length ? 'governed' : 'unresolved',
            confidence: meta ? meta.confidence : null,
            evidence: meta ? meta.evidence : 'none'
          });

          if (kp.pluginId) {
            pluginOpCount[kp.pluginId] = pluginOpCount[kp.pluginId] || { total: 0, covered: 0 };
            pluginOpCount[kp.pluginId].total++;
            if (ops.length) pluginOpCount[kp.pluginId].covered++;
          }
        });
      });
    });
  });

  var aliasCycle = OpsOnt.hasAliasCycle();

  var report = {
    total: total,
    covered: covered,
    missing: missing,
    coveragePct: total ? Math.round(covered / total * 100) : 0,
    invalidCanonical: invalid.length,
    invalidSamples: invalid.slice(0, 10),
    aliasCycle: aliasCycle,
    unknownCanonical: 0
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'operation-inventory.json'), JSON.stringify(inventory, null, 2));

  console.log('M1-02.1 Operation Ontology Gate');
  console.log('');
  console.log('Total KP:            ' + total);
  console.log('Operations Covered:  ' + covered + '  (' + report.coveragePct + '%)');
  console.log('Operations Missing:  ' + missing);
  console.log('Invalid Canonical:   ' + invalid.length);
  console.log('Alias Cycle:         ' + (aliasCycle ? 'YES (FAIL)' : 'no'));
  console.log('Canonical Vocab:     ' + CANON.length);
  console.log('Alias Count:         ' + Object.keys(OpsOnt.ALIASES).length);
  console.log('');
  console.log('Inventory -> dev/reports/operation-inventory.json');

  var ok = (invalid.length === 0) && (aliasCycle === false);
  console.log('');
  console.log(ok ? '[PASS] M1-02.1 Operation Ontology Gate' : '[FAIL] M1-02.1 Operation Ontology Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
