#!/usr/bin/env node
/**
 * dev/check-error-ontology.js — M1-02.3 Error Ontology Gate
 *
 * 校验 574 KP 的 errors[]：
 *   - Error ID 合法（kebab，非插件/题目相关）
 *   - 无重复 ID
 *   - category 合法
 *   - 无插件依赖
 * 空 errors[] 合法。输出 dev/reports/error-governance.json。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var ErrOnt = require(path.join(ROOT, 'shared', 'knowledge-error.js'));
var ErrMap = require(path.join(ROOT, 'shared', 'ontology-error-map.js'));

var SUBJECTS = ['math', 'cn', 'en'];

function run() {
  var total = 0, withErr = 0, without = 0, invalid = [], uniqueTypes = {}, categories = {};
  var governance = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var c = Ontology.normalize(kp);
          var errs = c.errors || [];
          if (errs.length) withErr++; else without++;
          var v = ErrOnt.validate(errs);
          if (!v.valid) invalid.push(kp.id + ' :: ' + v.errors.join('; '));
          errs.forEach(function (e) {
            var n = ErrOnt.normalizeError(e);
            if (n && n.id) uniqueTypes[n.id] = (uniqueTypes[n.id] || 0) + 1;
            if (n && n.category) categories[n.category] = (categories[n.category] || 0) + 1;
          });
          var meta = ErrMap.metaForPlugin(kp.pluginId);
          governance.push({
            knowledgePointId: kp.id, pluginId: kp.pluginId,
            errorCount: errs.length, invalid: !v.valid
          });
        });
      });
    });
  });

  var report = {
    total: total, withErrors: withErr, withoutErrors: without,
    uniqueErrorTypes: Object.keys(uniqueTypes).length,
    categories: categories,
    invalid: invalid.length, invalidSamples: invalid.slice(0, 10)
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'error-governance.json'), JSON.stringify(governance, null, 2));

  console.log('M1-02.3 Error Ontology Gate');
  console.log('');
  console.log('Total KP:            ' + total);
  console.log('With Errors:          ' + withErr);
  console.log('Without Errors:       ' + without);
  console.log('Unique Error Types:   ' + report.uniqueErrorTypes);
  console.log('Categories:          ' + JSON.stringify(categories));
  console.log('Invalid:             ' + invalid.length);
  console.log('');
  console.log('Governance -> dev/reports/error-governance.json');

  var ok = invalid.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M1-02.3 Error Ontology Gate' : '[FAIL] M1-02.3 Error Ontology Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
