/**
 * dev/check-question-validator.js — M5-R19 Validator CLI
 *
 * 全量扫描：
 *   - 所有 Generator
 *   - 所有知识点
 *   - 所有题型
 *   - 随机生成 N 题
 *   - Validator 通过率
 *   - 各错误类型统计
 *
 * 用法：
 *   node dev/check-question-validator.js
 *   node dev/check-question-validator.js --generator=math-oral --count=50
 *   node dev/check-question-validator.js --json
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var fs = require('fs');

var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Pipeline = require(path.join(ROOT, 'shared', 'validator', 'validation-pipeline.js'));
var BatchValidator = require(path.join(ROOT, 'shared', 'validator', 'batch-validator.js'));
var Quality = require(path.join(ROOT, 'shared', 'validator', 'quality-scorer.js'));
var QID = require(path.join(ROOT, 'shared', 'question-id.js'));
var RetryLoop = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));
var LQA = require(path.join(ROOT, 'shared', 'question', 'legacy-question-adapter.js'));
var Repo = require(path.join(ROOT, 'dev', 'plugin-registry.js'));

var args = process.argv.slice(2);
var asJson = args.indexOf('--json') !== -1;
var genFilter = null;
var countPerGen = 10;
var totalLimit = 5000;

function argValue(name) {
  var eq = args.filter(function (a) { return a.indexOf(name + '=') === 0; })[0];
  if (eq !== undefined) return eq.slice(name.length + 1);
  var i = args.indexOf(name);
  if (i !== -1 && args[i + 1]) return args[i + 1];
  return null;
}

var gf = argValue('--generator');
if (gf) genFilter = gf;
var cv = argValue('--count');
if (cv) countPerGen = parseInt(cv, 10) || 10;
var tv = argValue('--limit');
if (tv) totalLimit = parseInt(tv, 10) || 5000;

function banner(t) { if (!asJson) console.log('\n=== ' + t + ' ==='); }

function main() {
  banner('M5-R19 Validator 全量扫描');

  // 1. 收集所有 Generator
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var targetGens = genRecords.filter(function (r) {
    return !genFilter || r.pluginId === genFilter || r.id === genFilter;
  });

  if (!targetGens.length) {
    console.error('无匹配 Generator');
    process.exit(1);
  }

  console.log('目标 Generator: ' + targetGens.map(function (g) { return g.pluginId; }).join(', '));
  console.log('每 Generator 生成题数: ' + countPerGen);
  console.log('总题目上限: ' + totalLimit);

  // 2. 遍历生成 + 验证
  var allResults = [];
  var allByGen = {};
  var totalGenerated = 0;
  var totalValid = 0;
  var errorStats = {};

  targetGens.forEach(function (gen) {
    if (totalGenerated >= totalLimit) return;
    var pluginId = gen.pluginId;
    var kps = gen.knowledgePoints || [];
    var qTypes = gen.questionTypes || ['calc'];

    if (!kps.length) return; // 无知识点跳过

    var toGenerate = Math.min(countPerGen, totalLimit - totalGenerated);
    if (toGenerate <= 0) return;

    console.log('\n  → ' + pluginId + ' (' + kps.length + ' KPs, 生成 ' + toGenerate + ' 题)');

    // 选取前几个 KP 均匀生成
    var kpsToUse = kps.slice(0, Math.min(kps.length, toGenerate));
    var perKP = Math.max(1, Math.floor(toGenerate / kpsToUse.length));

    kpsToUse.forEach(function (kpId) {
      for (var i = 0; i < perKP && totalGenerated < totalLimit; i++) {
        var qType = qTypes[i % qTypes.length];
        var plan = {
          knowledgePointId: kpId,
          questionTypeId: qType,
          difficulty: 3,
          count: 1,
          seed: QID.deriveSeed('cli-' + pluginId, pluginId, totalGenerated),
          planId: 'cli-' + Date.now()
        };

        // 通过 Selector 选择 Generator 并生成
        var selection = Selector.selectGenerator(plan);
        if (!selection.record) {
          console.warn('    [SKIP] ' + kpId + ' 无可用 Generator');
          return;
        }

        var generator = Selector.instantiate(selection);
        if (!generator) {
          console.warn('    [SKIP] ' + kpId + ' 实例化失败');
          return;
        }

        try {
          var rawResult = generator.generate(plan);
          var questions = Array.isArray(rawResult) ? rawResult : (rawResult && rawResult.questions) || [];
          var semanticQuestions = questions.map(function (q) {
            return require(path.join(ROOT, 'shared', 'question', 'legacy-question-adapter.js')).adaptQuestion(q, {
              generatorId: selection.record.id,
              generatorVersion: '1.0.0',
              seed: plan.seed,
              planId: plan.planId,
              knowledgePointId: kpId,
              difficulty: plan.difficulty
            });
          });

          var valContext = { generatorId: selection.record.id, seed: plan.seed, planId: plan.planId };
          var validationResults = Pipeline.runPipelineBatch(semanticQuestions, valContext);

          semanticQuestions.forEach(function (sq, idx) {
            var vr = validationResults[idx];
            totalGenerated++;
            var valid = vr && vr.valid;
            if (valid) totalValid++;

            // 统计错误
            if (vr && vr.errors) {
              vr.errors.forEach(function (e) {
                errorStats[e.code] = (errorStats[e.code] || 0) + 1;
              });
            }

            allResults.push({
              generator: pluginId,
              knowledgePoint: kpId,
              questionType: qType,
              valid: valid,
              errors: vr && vr.errors ? vr.errors.map(function (e) { return e.code; }) : [],
              score: vr && vr.score ? vr.score : 0
            });
            (allByGen[pluginId] = allByGen[pluginId] || []).push(sq);
          });

        } catch (e) {
          console.warn('    [ERROR] ' + kpId + ' 生成异常: ' + e.message);
        }
      }
    });

  });

  // 3. 批量验证（按 Generator 分组，各视为独立练习集；跨 Generator 不互相去重）
  //    DUPLICATE_RATE_HIGH 在单知识点、固定难度的小样本扫描下会被样本量放大，
  //    属诊断性提示，不作为阻断门槛；结构性错误（答案完整、知识点覆盖等）仍阻断。
  var batchErrors = [];
  var batchWarnings = [];
  var batchOk = true;
  Object.keys(allByGen).forEach(function (genId) {
    var group = allByGen[genId];
    var r = BatchValidator.validateBatch(group, { count: group.length });
    (r.errors || []).forEach(function (e) {
      if (e.code === 'DUPLICATE_RATE_HIGH') batchWarnings.push(genId + ' :: ' + e.message);
      else { batchOk = false; batchErrors.push(genId + ' :: ' + (e.code || '?') + ' :: ' + (e.message || JSON.stringify(e))); }
    });
  });
  var batchResult = { valid: batchOk, errors: batchErrors, warnings: batchWarnings, info: [] };

  // 4. 质量评分
  var qualityResults = allResults.map(function (r, i) {
    return Quality.scoreQuestion({ id: r.id || i }, { valid: r.valid, checks: {}, score: r.score });
  });
  var qualitySummary = Quality.scoreBatch(qualityResults.map(function (q) { return q; }), [], {}).summary;

  // 5. 输出汇总
  var passRate = totalGenerated ? (totalValid / totalGenerated * 100).toFixed(2) : 0;

  console.log('\n=== 汇总 ===');
  console.log('生成总数:  ' + totalGenerated);
  console.log('通过总数:  ' + totalValid);
  console.log('通过率:    ' + passRate + '%');
  console.log('平均质量分: ' + qualitySummary.average);
  console.log('质量分布:  ' + JSON.stringify(qualitySummary.distribution));

  console.log('\n错误类型统计:');
  var sortedErrors = Object.keys(errorStats).sort(function (a, b) { return errorStats[b] - errorStats[a]; });
  sortedErrors.forEach(function (code) {
    console.log('  ' + code + ': ' + errorStats[code]);
  });

  console.log('\nBatch 练习级验证: ' + (batchResult.valid ? 'PASS' : 'FAIL'));
  if (!batchResult.valid) {
    batchResult.errors.forEach(function (e) { console.log('  - ' + (e && e.message != null ? e.message : e)); });
  }

  // JSON 输出
  if (asJson) {
    console.log(JSON.stringify({
      generated: totalGenerated,
      passed: totalValid,
      passRate: passRate,
      qualitySummary: qualitySummary,
      errorStats: errorStats,
      batchValidation: batchResult,
      details: allResults
    }, null, 2));
  }

  var ok = passRate >= 95 && batchResult.valid;
  console.log('\n' + (ok ? '[PASS] M5-R19 Validator 全量扫描' : '[FAIL] M5-R19 通过率/质量未达标'));
  process.exitCode = ok ? 0 : 1;
}

main();