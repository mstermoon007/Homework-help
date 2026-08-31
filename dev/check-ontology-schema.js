#!/usr/bin/env node
/**
 * dev/check-ontology-schema.js — Knowledge Ontology Schema Check (M1-01)
 *
 * 扫描 574 个 Legacy KnowledgePoint：
 *   Legacy -> Normalizer -> Canonical -> Validator
 * 输出：
 *   - 总体 VALID / WARNING / ERROR 计数
 *   - Ontology Coverage Report（按「源数据是否提供该维度」统计，暴露 M1-02 需治理项）
 *
 * 不修改 KnowledgeBank；只读解析。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));

var DIMS = [
  'identity',
  'knowledge.operations',
  'knowledge.factualContent',
  'structure',
  'cognition',
  'presentation.questionTypes',
  'numeric',
  'context',
  'errors',
  'spiral',
  'generation.capabilities'
];

function covered(c, dim) {
  switch (dim) {
    case 'identity':
      return !!(c.id && c.identity.name);
    case 'knowledge.operations':
      return Array.isArray(c.knowledge.operations) && c.knowledge.operations.length > 0;
    case 'knowledge.factualContent':
      return c.knowledge.factualContent && Object.keys(c.knowledge.factualContent).length > 0;
    case 'structure':
      return c.structure != null;
    case 'cognition':
      return c.cognition != null && typeof c.cognition.level === 'number';
    case 'presentation.questionTypes':
      return Array.isArray(c.presentation.questionTypes) && c.presentation.questionTypes.length > 0;
    case 'numeric':
      return c.numeric != null && c.numeric.range != null;
    case 'context':
      return c.context != null && Array.isArray(c.context.defaults);
    case 'errors':
      return Array.isArray(c.errors) && c.errors.length > 0;
    case 'spiral':
      return c.spiral != null;
    case 'generation.capabilities':
      return Array.isArray(c.generation.capabilities) && c.generation.capabilities.length > 0;
  }
  return false;
}

function run() {
  var SUBJECTS = ['math', 'cn', 'en'];
  var total = 0, valid = 0, warn = 0, err = 0;
  var cov = {};
  DIMS.forEach(function (d) { cov[d] = 0; });
  var errSamples = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var c = Ontology.normalize(kp);
          var v = Ontology.validate(c);
          if (v.errors.length) { err++; if (errSamples.length < 10) errSamples.push(kp.id + ' :: ' + v.errors.join('; ')); }
          else if (v.warnings.length) warn++;
          else valid++;
          DIMS.forEach(function (d) { if (covered(c, d)) cov[d]++; });
        });
      });
    });
  });

  console.log('Knowledge Ontology Schema Check');
  console.log('');
  console.log('Total:   ' + total);
  console.log('VALID:   ' + valid);
  console.log('WARNING: ' + warn);
  console.log('ERROR:   ' + err);
  if (errSamples.length) {
    console.log('');
    console.log('ERROR 样本:');
    errSamples.forEach(function (e) { console.log('  - ' + e); });
  }

  console.log('');
  console.log('Ontology Coverage Report（源数据是否提供该维度；未覆盖 = M1-02 治理项）');
  console.log('------------------------------------------------------------');
  DIMS.forEach(function (d) {
    var pct = total ? Math.round(cov[d] / total * 100) : 0;
    console.log(d.padEnd(28) + String(cov[d]).padStart(4) + '/' + String(total).padStart(4) + '  (' + pct + '%)');
  });

  var ok = (err === 0);
  console.log('');
  console.log(ok ? '[PASS] Ontology Schema 扫描完成，0 ERROR' : '[FAIL] 存在 ' + err + ' 个 ERROR');
  process.exitCode = ok ? 0 : 1;
}

run();
