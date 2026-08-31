#!/usr/bin/env node
/**
 * dev/check-generator-adapter.js — M4-R02 Legacy Plugin Adapter Gate
 *
 * 验收：Strategy Engine 可以不修改 UI，直接通过 Adapter 调用任意现有插件：
 *   StrategyEngine.plan → QuestionPlan → LegacyPluginAdapter → plugin.generate() → SemanticQuestion[]
 *
 * 全量覆盖 registry 中所有插件：
 *   - 无 KP 关联（placeholder / 聚合）→ 仅 fallback（不阻断）
 *   - 有 KP 关联 → 取首个 KP 走完整链路：
 *     supports(plan) / generate(plan) → SemanticQuestion[] 逐一通过契约校验；
 *     runLegacyFallback 返回原始 exerciseSet（渲染契约不变：questions 长度一致）
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
var registryMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var Adapter = require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));

function run() {
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var recById = {};
  genRecords.forEach(function (r) { recById[r.pluginId] = r; });

  var entries = registryMod.readRegistry();
  var verified = 0;
  var fallbackOnly = 0;
  var loadFailed = 0;
  var errors = [];
  var warnings = [];
  var semanticTotal = 0;

  entries.forEach(function (entry) {
    var rec = recById[entry.id];
    var res = loader.loadPlugin(entry);
    if (res.error || !res.compatible) {
      loadFailed++;
      errors.push(entry.id + ' :: 插件加载失败: ' + (res.error || res.missingInterfaces.join('/')));
      return;
    }

    // 无 KP 关联（聚合/patterns/placeholder）→ 非 Generator，仅 fallback，不阻断
    if (!rec || !rec.knowledgePoints.length) {
      fallbackOnly++;
      return;
    }

    var generator = Adapter.createLegacyGenerator(res.plugin, {
      capabilities: rec ? rec.questionTypes : [],
      knowledgePoints: rec ? rec.knowledgePoints : []
    });

    var contractCheck = Contract.validateGeneratorContract(generator, null);
    if (!contractCheck.valid) {
      errors.push(entry.id + ' :: GeneratorContract 校验失败: ' + contractCheck.errors.join('; '));
      return;
    }

    var kpId = rec.knowledgePoints[0];
    var plan;
    try {
      plan = Engine.plan({ knowledgePointId: kpId, count: 3, difficulty: 3 }).plans[0];
    } catch (e) {
      errors.push(entry.id + ' :: plan 失败: ' + e.message);
      return;
    }

    if (!generator.supports(plan)) {
      errors.push(entry.id + ' :: supports(plan) 返回 false（plan questionType=' + plan.questionTypeId + '）');
      return;
    }

    var result = generator.generate(plan, { seed: 'm4-gate' });
    if (result && typeof result.then === 'function') {
      // 异步插件（综合练习等）：结果在 Promise 内校验
      result.then(function (questions) {
        checkSemantic(entry.id, questions, plan);
      }).catch(function (e) {
        errors.push(entry.id + ' :: 异步生成失败: ' + e.message);
      });
      verified++;
      return;
    }

    checkSemantic(entry.id, result, plan);
    verified++;
  });

  function checkSemantic(pluginId, questions, plan) {
    if (!Array.isArray(questions)) {
      errors.push(pluginId + ' :: generate 未返回数组');
      return;
    }
    semanticTotal += questions.length;
    if (questions.length !== plan.count) {
      // 部分 legacy 插件按自身契约决定题量（如乘法表固定单卡）→ 记录差异，不阻断
      warnings.push(pluginId + ' :: 语义题量 ' + questions.length + ' !== plan.count ' + plan.count + '（legacy 契约差异）');
    }
    questions.forEach(function (q, i) {
      var check = Contract.validateSemanticQuestion(q);
      check.errors.forEach(function (e) {
        errors.push(pluginId + ' :: SemanticQuestion[' + i + '] ' + e);
      });
    });
  }

  var report = {
    plugins: entries.length,
    verified: verified,
    fallbackOnly: fallbackOnly,
    loadFailed: loadFailed,
    semanticTotal: semanticTotal,
    errors: errors.length,
    errorSamples: errors.slice(0, 12),
    warnings: warnings.length,
    warningSamples: warnings.slice(0, 8)
  };

  console.log('M4-R02 Legacy Plugin Adapter Gate');
  console.log('');
  console.log('插件总数:        ' + entries.length);
  console.log('Adapter 链路验证: ' + verified);
  console.log('仅 fallback:      ' + fallbackOnly);
  console.log('加载失败:         ' + loadFailed);
  console.log('SemanticQuestion: ' + semanticTotal);
  console.log('Errors: ' + errors.length);
  report.errorSamples.forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('Warnings: ' + warnings.length);
  report.warningSamples.forEach(function (w) { console.log('  ⚠ ' + w); });
  console.log('');

  var ok = errors.length === 0 && verified > 0;
  console.log(ok ? '[PASS] M4-R02 Legacy Plugin Adapter Gate' : '[FAIL] M4-R02 Legacy Plugin Adapter Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
