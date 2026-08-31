#!/usr/bin/env node
/**
 * dev/check-factual-content.js — M1-02.2 Factual Content Gate
 *
 * 校验 574 KP 的 semantics.factualContent：
 *   - 非法策略字段 = 0
 *   - 未知非法类型不阻断（WARNING）
 *   - 空事实合法（覆盖率可统计）
 * 并输出 dev/reports/factual-content-governance.json。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var FactOnt = require(path.join(ROOT, 'shared', 'knowledge-factual.js'));
var FactMap = require(path.join(ROOT, 'shared', 'ontology-factual-map.js'));

var SUBJECTS = ['math', 'cn', 'en'];

function run() {
  var total = 0, present = 0, empty = 0, invalid = [], high = 0, medium = 0, low = 0, unverified = 0;
  var governance = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var c = Ontology.normalize(kp);
          var fc = c.knowledge.factualContent || {};
          var keys = Object.keys(fc);
          var has = keys.length > 0;
          if (has) present++; else empty++;
          var v = FactOnt.validate(fc);
          if (!v.valid) invalid.push(kp.id + ' :: ' + v.errors.join('; '));
          var meta = FactMap.metaForPlugin(kp.pluginId);
          var conf = meta ? meta.confidence : null;
          if (conf === 'high') high++;
          else if (conf === 'medium') medium++;
          else if (conf === 'low') low++;
          else unverified++;
          governance.push({
            knowledgePointId: kp.id, pluginId: kp.pluginId,
            present: has, confidence: conf, invalid: !v.valid
          });
        });
      });
    });
  });

  var report = {
    total: total, present: present, empty: empty,
    coveragePct: total ? Math.round(present / total * 100) : 0,
    invalid: invalid.length, invalidSamples: invalid.slice(0, 10),
    confidence: { high: high, medium: medium, low: low, unverified: unverified }
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'factual-content-governance.json'), JSON.stringify(governance, null, 2));

  console.log('M1-02.2 Factual Content Gate');
  console.log('');
  console.log('Total KP:            ' + total);
  console.log('Factual Present:     ' + present + '  (' + report.coveragePct + '%)');
  console.log('Factual Empty:       ' + empty);
  console.log('Invalid (策略字段等): ' + invalid.length);
  console.log('Confidence  high/medium/low/unverified: ' + high + '/' + medium + '/' + low + '/' + unverified);
  console.log('');
  console.log('Governance -> dev/reports/factual-content-governance.json');

  var ok = invalid.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M1-02.2 Factual Content Gate' : '[FAIL] M1-02.2 Factual Content Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
