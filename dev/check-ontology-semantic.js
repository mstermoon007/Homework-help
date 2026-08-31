#!/usr/bin/env node
/**
 * dev/check-ontology-semantic.js — M1-02.1~M1-02.3 统一语义治理 Gate
 *
 * 对 574 KP 执行 Operation / Factual / Error 三轮归一化与校验，
 * 生成 dev/reports/ontology-semantic-governance.json（逐 KP 质量模型 + 等级 A/B/C/D），
 * 并作为 `npm run verify:m1` 的聚合入口。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var OpsOnt = require(path.join(ROOT, 'shared', 'knowledge-operation.js'));
var OpsMap = require(path.join(ROOT, 'shared', 'ontology-operation-map.js'));
var FactOnt = require(path.join(ROOT, 'shared', 'knowledge-factual.js'));
var FactMap = require(path.join(ROOT, 'shared', 'ontology-factual-map.js'));
var ErrOnt = require(path.join(ROOT, 'shared', 'knowledge-error.js'));
var ErrMap = require(path.join(ROOT, 'shared', 'ontology-error-map.js'));

var SUBJECTS = ['math', 'cn', 'en'];

function run() {
  var total = 0;
  var stats = {
    ops: { covered: 0, missing: 0, invalid: 0, canon: OpsOnt.CANONICAL_IDS.length, aliases: Object.keys(OpsOnt.ALIASES).length },
    fact: { present: 0, empty: 0, invalid: 0, high: 0, medium: 0, low: 0, unverified: 0 },
    err: { withErr: 0, without: 0, invalid: 0, unique: {}, categories: {} },
    grade: { A: 0, B: 0, C: 0, D: 0 }
  };
  var records = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var c = Ontology.normalize(kp);
          var ops = c.knowledge.operations || [];
          var fc = c.knowledge.factualContent || {};
          var errs = c.errors || [];

          var opsInvalid = ops.some(function (o) { return OpsOnt.CANONICAL_IDS.indexOf(o) === -1; });
          if (ops.length) stats.ops.covered++; else stats.ops.missing++;
          if (opsInvalid) stats.ops.invalid++;

          var fv = FactOnt.validate(fc);
          var factPresent = Object.keys(fc).length > 0;
          if (factPresent) stats.fact.present++; else stats.fact.empty++;
          if (!fv.valid) stats.fact.invalid++;
          var fmeta = FactMap.metaForPlugin(kp.pluginId);
          var fconf = fmeta ? fmeta.confidence : null;
          if (fconf === 'high') stats.fact.high++;
          else if (fconf === 'medium') stats.fact.medium++;
          else if (fconf === 'low') stats.fact.low++;
          else stats.fact.unverified++;

          var ev = ErrOnt.validate(errs);
          if (errs.length) stats.err.withErr++; else stats.err.without++;
          if (!ev.valid) stats.err.invalid++;
          errs.forEach(function (e) {
            var n = ErrOnt.normalizeError(e);
            if (n && n.id) stats.err.unique[n.id] = (stats.err.unique[n.id] || 0) + 1;
            if (n && n.category) stats.err.categories[n.category] = (stats.err.categories[n.category] || 0) + 1;
          });

          var ometa = OpsMap.metaForPlugin(kp.pluginId);
          var emeta = ErrMap.metaForPlugin(kp.pluginId);

          var grade = 'C';
          if (opsInvalid || !fv.valid || !ev.valid) grade = 'D';
          else if (ops.length && factPresent && errs.length) grade = 'A';
          else if (ops.length && (factPresent || errs.length)) grade = 'B';
          stats.grade[grade]++;

          records.push({
            knowledgePointId: kp.id,
            operations: { status: ops.length ? 'governed' : 'unresolved', values: ops, confidence: ometa ? ometa.confidence : null },
            factualContent: { status: factPresent ? 'governed' : 'empty', confidence: fconf },
            errors: { status: errs.length ? 'governed' : 'empty', count: errs.length },
            grade: grade
          });
        });
      });
    });
  });

  stats.err.uniqueCount = Object.keys(stats.err.unique).length;

  var warnings = [];
  warnings.push('Operation unresolved: ' + stats.ops.missing + ' / ' + total);
  warnings.push('Factual empty: ' + stats.fact.empty + ' / ' + total);
  warnings.push('Error empty: ' + stats.err.without + ' / ' + total);
  warnings.push('Quality grade C (语义缺口): ' + stats.grade.C);

  var unresolved = {
    operations: stats.ops.missing,
    factualEmpty: stats.fact.empty,
    errorEmpty: stats.err.without,
    qualityC: stats.grade.C
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var reportJson = {
    version: Ontology.VERSION,
    generatedAt: new Date().toISOString(),
    total: total,
    operation: {
      covered: stats.ops.covered, unresolved: stats.ops.missing, invalid: stats.ops.invalid,
      canonical: stats.ops.canon, aliases: stats.ops.aliases
    },
    factualContent: {
      present: stats.fact.present, empty: stats.fact.empty, invalid: stats.fact.invalid,
      confidence: { high: stats.fact.high, medium: stats.fact.medium, low: stats.fact.low, unverified: stats.fact.unverified }
    },
    errors: {
      withErrors: stats.err.withErr, without: stats.err.without, invalid: stats.err.invalid,
      unique: stats.err.uniqueCount, categories: stats.err.categories
    },
    quality: stats.grade,
    unresolved: unresolved,
    warnings: warnings,
    records: records
  };
  fs.writeFileSync(path.join(outDir, 'ontology-semantic-governance.json'),
    JSON.stringify(reportJson, null, 2));

  console.log('M1-02 Semantic Governance Report');
  console.log('');
  console.log('Total Knowledge Points: ' + total);
  console.log('');
  console.log('Operations:');
  console.log('  Covered:  ' + stats.ops.covered + ' / ' + total);
  console.log('  Missing:   ' + stats.ops.missing);
  console.log('  Invalid:   ' + stats.ops.invalid);
  console.log('  Canonical Vocabulary: ' + stats.ops.canon + ', Aliases: ' + stats.ops.aliases);
  console.log('');
  console.log('Factual Content:');
  console.log('  Present:   ' + stats.fact.present + ' / ' + total);
  console.log('  Empty:     ' + stats.fact.empty);
  console.log('  Invalid:   ' + stats.fact.invalid);
  console.log('  Confidence high/medium/low/unverified: ' +
    stats.fact.high + '/' + stats.fact.medium + '/' + stats.fact.low + '/' + stats.fact.unverified);
  console.log('');
  console.log('Errors:');
  console.log('  With:      ' + stats.err.withErr);
  console.log('  Without:   ' + stats.err.without);
  console.log('  Unique:    ' + stats.err.uniqueCount);
  console.log('  Invalid:   ' + stats.err.invalid);
  console.log('  Categories: ' + JSON.stringify(stats.err.categories));
  console.log('');
  console.log('Quality Grade A/B/C/D: ' +
    stats.grade.A + '/' + stats.grade.B + '/' + stats.grade.C + '/' + stats.grade.D);
  console.log('');
  console.log('Detail -> dev/reports/ontology-semantic-governance.json');

  var ok = stats.ops.invalid === 0 && stats.fact.invalid === 0 && stats.err.invalid === 0;
  console.log('');
  console.log(ok ? '[PASS] M1-02 Semantic Governance' : '[FAIL] M1-02 Semantic Governance');
  process.exitCode = ok ? 0 : 1;
}

run();
