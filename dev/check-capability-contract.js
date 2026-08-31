#!/usr/bin/env node
/**
 * dev/check-capability-contract.js — M2-R03 Capability Contract Gate
 *
 * 对全部 574 KnowledgePoint 执行：
 *   KP -> Canonical -> QuestionType -> Capability Resolver -> Capability Contract
 *
 * 检查：
 *   R03.2 574 KP Capability 扫描（resolve 全量不崩溃）
 *   R03.3 QuestionType 合法性（全部属于标准 Registry）
 *   R03.4 Capability Resolver 一致性（resolve / matrix / canGenerate 可调用且合法）
 *   R03.5 输出 dev/reports/capability-contract-report.json
 *
 * ERROR = 0 才 PASS；WARNING 分类输出，不阻断。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));
var Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
var Contract = require(path.join(ROOT, 'shared', 'capability-contract.js'));

var SUBJECTS = Ontology.SUBJECTS;

function run() {
  var total = 0;
  var resolved = 0;
  var unresolved = 0;
  var invalidQT = [];
  var invalidCap = [];
  var resolverErrors = [];
  var matrixErrors = [];
  var warnings = [];
  var stats = {};
  var byType = {};

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var cap = null;
          var matrix = null;

          // R03.2: resolve 全量
          try {
            cap = Resolver.resolve(kp);
            if (cap && Array.isArray(cap.questionTypes) && cap.questionTypes.length) resolved++;
            else unresolved++;
          } catch (e) {
            resolverErrors.push(kp.id + ' :: ' + e.message);
          }

          // R03.3: QuestionType 合法性 + R03.4 resolver 一致性
          try {
            var contract = Contract.validateCapabilityContract(cap);
            if (!contract.valid) invalidCap.push(kp.id + ' :: ' + contract.errors.join('; '));
            contract.warnings.forEach(function (w) { warnings.push(kp.id + ' :: ' + w); });
            (cap.questionTypes || []).forEach(function (qt) {
              if (!Registry.has(qt.id)) invalidQT.push(kp.id + ' :: ' + qt.id);
              byType[qt.id] = (byType[qt.id] || 0) + 1;
            });
            matrix = Resolver.matrix(kp);
            if (!Array.isArray(matrix.supported)) matrixErrors.push(kp.id + ' :: matrix 无 supported');
          } catch (e) {
            invalidCap.push(kp.id + ' :: resolver 抛错 ' + e.message);
          }
        });
      });
    });
  });

  var report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    total: total,
    resolved: resolved,
    unresolved: unresolved,
    invalidQuestionType: invalidQT.length,
    invalidQuestionTypeSamples: invalidQT.slice(0, 10),
    invalidCapability: invalidCap.length,
    invalidCapabilitySamples: invalidCap.slice(0, 10),
    resolverErrors: resolverErrors.length,
    resolverErrorSamples: resolverErrors.slice(0, 10),
    matrixErrors: matrixErrors.length,
    warnings: warnings.length,
    questionTypeDistribution: byType,
    registryTypes: Registry.TYPES.map(function (t) { return t.id; })
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'capability-contract-report.json'), JSON.stringify(report, null, 2));

  console.log('M2-R03 Capability Contract Gate');
  console.log('');
  console.log('Total KP:            ' + total);
  console.log('Resolved:            ' + resolved);
  console.log('Unresolved:          ' + unresolved);
  console.log('Invalid QuestionType:' + invalidQT.length);
  console.log('Invalid Capability:  ' + invalidCap.length);
  console.log('Resolver Errors:     ' + resolverErrors.length);
  console.log('Matrix Errors:       ' + matrixErrors.length);
  console.log('Warnings:            ' + warnings.length);
  console.log('');
  console.log('QuestionType 分布:   ' + JSON.stringify(byType));
  console.log('');
  console.log('Report -> dev/reports/capability-contract-report.json');

  var ok = invalidQT.length === 0 && invalidCap.length === 0 &&
    resolverErrors.length === 0 && matrixErrors.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M2-R03 Capability Contract Gate' : '[FAIL] M2-R03 Capability Contract Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
