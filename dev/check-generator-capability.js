#!/usr/bin/env node
/**
 * dev/check-generator-capability.js — M2-R05 Generator Capability Gate
 *
 * 扫描 99 个真实插件，与 KnowledgeBank / QuestionType / Capability 对齐：
 *   R05.2 全量扫描 -> generator-capability-inventory.json
 *   R05.3 Plugin → QuestionType 对齐（normalizeQuestionType）
 *   R05.4 Plugin → KnowledgePoint 对齐（KB pluginId 权威）
 *   R05.5 Contract Gate（ERROR/WARNING 分类）
 *
 * ERROR:
 *   - 注册表插件文件不存在
 *   - 非法 QuestionType（registry 不识别）
 *   - 出现 generateFunction/generator 等执行引用
 *   - Generator → Ontology mutation / Strategy 依赖（扫描源码文本，仅检查不得出现）
 *
 * WARNING:
 *   - 未声明能力（无 KP 关联）
 *   - 历史字段无法完全归一化
 *
 * 允许 WARNING > 0，但必须可审计。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var pluginRegistry = require(path.join(ROOT, 'plugins', 'registry.js'));

// 源码级禁止项：不得出现执行引用（只读检查，不修改插件）
var FORBIDDEN_PATTERNS = [
  { pattern: /generateFunction\s*[:=]/, label: 'generateFunction' },
  { pattern: /generatorFunction\s*[:=]/, label: 'generatorFunction' },
  { pattern: /strategyEngine/, label: 'Strategy 依赖' },
  { pattern: /Ontology\.mutate|Ontology\.set/, label: 'Ontology mutation' }
];

function checkPluginSource(pluginId) {
  var entry = pluginRegistry.find(function (e) { return e.id === pluginId; });
  if (!entry || !entry.file) return { errors: [], warnings: [] };
  var fp = path.join(ROOT, entry.file);
  if (!fs.existsSync(fp)) return { errors: ['插件文件不存在: ' + entry.file], warnings: [] };
  var src = fs.readFileSync(fp, 'utf8');
  var errors = [], warnings = [];
  FORBIDDEN_PATTERNS.forEach(function (f) {
    var m = src.match(f.pattern);
    if (m) errors.push(pluginId + ' :: 源码含 ' + f.label + (m.index != null ? ' @' + m.index : ''));
  });
  return { errors: errors, warnings: warnings };
}

function run() {
  var records = GenCap.buildGeneratorCapabilityRegistry();
  var totalPlugins = records.length;
  var withKp = 0, noKp = 0;
  var invalidQT = [];
  var invalidCap = [];
  var sourceErrors = [];
  var warnings = [];

  records.forEach(function (rec) {
    if (rec.knowledgePoints.length) withKp++; else noKp++;

    rec.questionTypes.forEach(function (qt) {
      if (!Registry.has(qt)) invalidQT.push(rec.pluginId + ' :: ' + qt);
    });
    rec.invalidCapabilities.forEach(function (c) { invalidCap.push(rec.pluginId + ' :: ' + c); });

    var srcCheck = checkPluginSource(rec.pluginId);
    srcCheck.errors.forEach(function (e) { sourceErrors.push(e); });
    srcCheck.warnings.forEach(function (w) { warnings.push(w); });

    if (rec.knowledgePoints.length === 0 && !rec.isPlaceholder) {
      warnings.push(rec.pluginId + ' :: 未关联任何 KB 知识点（能力未声明）');
    }
  });

  var report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pluginCount: totalPlugins,
    pluginsWithKp: withKp,
    pluginsWithoutKp: noKp,
    invalidQuestionType: invalidQT.length,
    invalidQuestionTypeSamples: invalidQT.slice(0, 10),
    invalidCapability: invalidCap.length,
    invalidCapabilitySamples: invalidCap.slice(0, 10),
    sourceErrors: sourceErrors.length,
    sourceErrorSamples: sourceErrors.slice(0, 10),
    warnings: warnings.length,
    warningSamples: warnings.slice(0, 20),
    records: records
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'generator-capability-inventory.json'), JSON.stringify(report, null, 2));

  console.log('M2-R05 Generator Capability Gate');
  console.log('');
  console.log('Plugins scanned:      ' + totalPlugins);
  console.log('With KP linkage:      ' + withKp);
  console.log('Without KP linkage:   ' + noKp);
  console.log('Invalid QuestionType: ' + invalidQT.length);
  console.log('Invalid Capability:   ' + invalidCap.length);
  console.log('Source errors:        ' + sourceErrors.length);
  console.log('Warnings:             ' + warnings.length);
  console.log('');
  console.log('Inventory -> dev/reports/generator-capability-inventory.json');

  var ok = invalidQT.length === 0 && invalidCap.length === 0 && sourceErrors.length === 0;
  console.log('');
  console.log(ok ? '[PASS] M2-R05 Generator Capability Gate' : '[FAIL] M2-R05 Generator Capability Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
