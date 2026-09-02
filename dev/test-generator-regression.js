#!/usr/bin/env node
/**
 * dev/test-generator-regression.js — M4-R16 Generator 回归矩阵
 *
 * 自动测试矩阵：Generator × KnowledgePoint × QuestionType × Difficulty × Seed
 *
 * 矩阵维度：
 *   legacy 轨道 —— 每个绑定 KP 的旧插件：采样 KP × 题型 × 难度(2/5/8) × seed(2)
 *   native 轨道 —— 每个核心 Generator：采样共享能力 KP × 题型 × 难度 × seed
 *
 * 每 case 检查：
 *   generated   是否生成（不崩溃、返回数组、题量非空）
 *   crash       是否崩溃
 *   outOfBounds 操作数是否越界（超 plan.numberRange / 非正整数）
 *   answer      答案是否正确（题干表达式 → 答案自洽；无法解析记 n/a）
 *   duplicate   同批次是否重复（prompt 两两不同）
 *   renderable  是否可渲染（legacy exerciseSet 有 render 且题量一致 / native 文本或图形受支持）
 *   satisfiesPlan 是否满足 Plan（kp / questionType / difficulty / steps ≤ maxSteps）
 *
 * 输出：dev/reports/generator-regression-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var Adapter = require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var CoreGen = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var GraphicRenderer = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));
var SP = require(path.join(ROOT, 'dev', 'semantic-parse.js'));
var CapabilityResolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));
var KPStore = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

/**
 * 解析单个 KP 实际支持的题型（per-KP，与 Engine.plan 的第 4 步同一来源）。
 * 矩阵必须以 per-KP 能力为准构造 KP×QT 用例——插件级能力是并集，不能用于逐 KP 规划，
 * 否则会产生无法构造 plan 的伪用例（PLAN_ERROR，非产品缺陷）。
 * @param {string} kpId
 * @returns {string[]} 该 KP 支持的题型 id（空表示无法解析）
 */
function kpQuestionTypes(kpId) {
  var kp = KPStore.get(kpId);
  if (!kp) return [];
  var caps = CapabilityResolver.getCapabilities(kp);
  return Array.isArray(caps.questionTypes) ? caps.questionTypes.slice() : [];
}

var DIFFICULTIES = [2, 5, 8];
var SEEDS = ['regr-a', 'regr-b'];
var BATCH = 4;

/* ---------- 单 case 校验 ---------- */

async function checkBatch(questions, plugin, plan, generatorId) {
  var check = { generated: false, crash: false, outOfBounds: 0, answerWrong: 0, answerNA: 0, duplicates: 0, renderable: false, satisfiesPlan: true, failReasons: [] };

  if (!Array.isArray(questions) || questions.length === 0) return check;

  check.generated = true;
  var count = questions.length;
  var range = (plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
  var minOp = Infinity, maxOp = -Infinity;

  questions.forEach(function (q) {
    var contractedValid = Contract.validateSemanticQuestion(q).valid;
    if (!contractedValid) check.failReasons.push('契约校验失败');

    var parsed = SP.parseExpression(q.prompt);
    if (parsed && !plugin) {
      parsed.operands.forEach(function (v) {
        minOp = Math.min(minOp, v); maxOp = Math.max(maxOp, v);
        if (v < range.min || v > range.max) check.outOfBounds++;
      });
    }
    var a = SP.answerIsCorrect(q);
    if (a === false) check.answerWrong++;
    if (a === 'n/a') check.answerNA++;

    // satisfiesPlan
    if (q.knowledgePointId != null && q.knowledgePointId !== plan.knowledgePointId) { check.satisfiesPlan = false; check.failReasons.push('kp 不匹配: ' + q.knowledgePointId); }
    if (q.questionType != null && q.questionType !== plan.questionTypeId) { check.satisfiesPlan = false; check.failReasons.push('qt 不匹配: ' + q.questionType); }
    if (q.difficulty != null && q.difficulty !== plan.difficulty) { check.satisfiesPlan = false; check.failReasons.push('难度不匹配: ' + q.difficulty + ' ≠ ' + plan.difficulty); }
  });

  // 重复：prompt 顶层去重（旧版插件/图形型无文本 prompt 的跳过，避免全空串被误判为重复）
  var seen = {};
  if (!plugin) {
    questions.forEach(function (q) {
      var key = String(q.prompt);
      if (seen[key]) check.duplicates++;
      else seen[key] = true;
    });
  }

  // 越界汇总
  if (check.outOfBounds > 0) check.failReasons.push('操作数越界 ' + check.outOfBounds + ' 处 [' + minOp + ',' + maxOp + '] 超出 ' + JSON.stringify(range));
  if (check.answerWrong > 0) check.failReasons.push('答案错误 ' + check.answerWrong + ' 处');

  // renderable
  if (plugin) {
    try {
      var set = await Adapter.runLegacyFallback(plugin, plan);
      check.renderable = !!(set && Array.isArray(set.questions) && set.questions.length === count && typeof plugin.render === 'function');
    } catch (e) { check.renderable = false; }
  } else {
    var hasGraphic = questions.some(function (q) { return q.graphic && q.graphic.type; });
    check.renderable = !hasGraphic || questions.every(function (q) {
      return !q.graphic || !q.graphic.type || GraphicRenderer.isSupported(q.graphic.type);
    });
  }
  if (!check.renderable) check.failReasons.push('不可渲染');
  if (check.duplicates > 0) check.failReasons.push('存在重复 prompt ' + check.duplicates + ' 处');

  check.outOfBoundsSummary = { min: minOp === Infinity ? null : minOp, max: maxOp === -Infinity ? null : maxOp, range: minOp === Infinity ? null : range };
  return check;
}

/* ---------- 执行矩阵 ---------- */

function caseStatus(check) {
  if (!check.generated) return 'CRASH';
  if (check.failReasons.length) return 'FAIL';
  return 'PASS';
}

async function main() {
  var cases = [];

  // —— legacy 轨道 ——
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var cache = {};

  for (var i = 0; i < genRecords.length; i++) {
    var rec = genRecords[i];
    if (rec.subject !== 'math' || !rec.knowledgePoints.length) continue;
    if (!cache[rec.pluginId]) {
      cache[rec.pluginId] = loader.loadPlugin(rec.pluginId);
    }
    var entry = cache[rec.pluginId];
    if (entry.error || !entry.compatible) {
      cases.push({ generatorId: 'legacy:' + rec.pluginId, kpId: null, questionTypeId: null, difficulty: null, seed: null, status: 'LOAD_ERROR', failReasons: [entry.error || entry.missingInterfaces.join('/')] });
      continue;
    }

    var gen = Adapter.createLegacyGenerator(entry.plugin, { capabilities: rec.questionTypes, knowledgePoints: rec.knowledgePoints });
    var kps = rec.knowledgePoints;

    for (var k = 0; k < kps.length; k++) {
      // per-KP 能力交集：插件声明 ∪ 该 KP 实际支持 —— 只测可构造的 KP×QT 组合。
      // 全量枚举（不做采样）：每个 KP 只与它自己实际支持的 QT 配对，杜绝 RC-PLAN-01
      // （插件级能力并集逐 KP 规划 → 伪 PLAN_ERROR）再次出现。
      var kpQts = kpQuestionTypes(kps[k]).filter(function (q) {
        return (rec.questionTypes || []).indexOf(q) !== -1 && gen.supports({ questionTypeId: q });
      });
      var qts = kpQts;
      if (!qts.length) continue;
      for (var q = 0; q < qts.length; q++) {
        for (var d = 0; d < DIFFICULTIES.length; d++) {
          for (var s = 0; s < SEEDS.length; s++) {
            var plan;
            try {
              plan = Engine.plan({ knowledgePointId: kps[k], questionType: qts[q], count: BATCH, difficulty: DIFFICULTIES[d] }).plans[0];
            } catch (e) {
              cases.push({ generatorId: 'legacy:' + rec.pluginId, kpId: kps[k], questionTypeId: qts[q], difficulty: DIFFICULTIES[d], seed: SEEDS[s], status: 'PLAN_ERROR', failReasons: [e.message] });
              continue;
            }
            var check = { generated: false, crash: false, outOfBounds: 0, answerWrong: 0, answerNA: 0, duplicates: 0, renderable: false, satisfiesPlan: true, failReasons: [] };
            try {
              var outL = gen.generate(plan, { seed: SEEDS[s] });
              if (outL && typeof outL.then === 'function') outL = await outL;
              check = await checkBatch(outL, entry.plugin, plan);
            } catch (e) {
              check.crash = true;
              check.failReasons.push('崩溃: ' + e.message);
            }
            cases.push({ generatorId: 'legacy:' + rec.pluginId, kpId: kps[k], questionTypeId: qts[q], difficulty: DIFFICULTIES[d], seed: SEEDS[s], status: caseStatus(check), checks: check });
          }
        }
      }
    }
  }

  // —— native 轨道 ——
  // 全量枚举：每个核心 Generator 遍历其注册的全部 KP × 该 KP 实际支持的 QT
  // （per-KP 校验，与 plan 第 4 步一致；杜绝 RC-PLAN-01 伪用例）。
  var registry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
  var coreRecByGen = {};
  registry.records().forEach(function (r) {
    if (r.scope === 'core' && r.id) coreRecByGen[r.id] = r;
  });

  // calc/oral → 加法/混合算数 KP 样本，仅作为无注册 KP 的兜底（如 arithmetic-mixed-calculation）
  function fallbackKp(cap) {
    var candidates = cap === 'calc' ? ['math-g1-m1-addsub-10', 'math-g2-m1-addsub-1000'] : ['math-g1-m1-addsub-10'];
    for (var i = 0; i < candidates.length; i++) {
      if (kpQuestionTypes(candidates[i]).indexOf(cap) !== -1) return candidates[i];
    }
    return 'math-g1-m1-addsub-10';
  }

  CoreGen.ALL.forEach(async function (g) {
    var caps = (g.capabilities || []);
    var rec = coreRecByGen[g.id];
    var kps = (rec && rec.knowledgePoints && rec.knowledgePoints.length) ? rec.knowledgePoints : [fallbackKp(caps[0] || 'calc')];
    for (var k = 0; k < kps.length; k++) {
      // per-KP 能力交集：生成器能力 ∩ 该 KP 实际支持 —— 只测可构造的 KP×QT 组合
      var kpQts = kpQuestionTypes(kps[k]).filter(function (q) {
        return caps.indexOf(q) !== -1;
      });
      var qts = kpQts;
      if (!qts.length) continue;
      for (var q = 0; q < qts.length; q++) {
        for (var d = 0; d < DIFFICULTIES.length; d++) {
          for (var s = 0; s < SEEDS.length; s++) {
            var plan;
            try {
              plan = Engine.plan({ knowledgePointId: kps[k], questionType: qts[q], count: BATCH, difficulty: DIFFICULTIES[d] }).plans[0];
            } catch (e) {
              cases.push({ generatorId: g.id, kpId: kps[k], questionTypeId: qts[q], difficulty: DIFFICULTIES[d], seed: SEEDS[s], status: 'PLAN_ERROR', failReasons: [e.message] });
              continue;
            }
            var check = { generated: false, crash: false, outOfBounds: 0, answerWrong: 0, answerNA: 0, duplicates: 0, renderable: false, satisfiesPlan: true, failReasons: [] };
            try {
              var outN = g.generate(plan, { seed: SEEDS[s] });
              if (outN && typeof outN.then === 'function') outN = await outN;
              check = await checkBatch(outN, null, plan);
            } catch (e) {
              check.crash = true;
              check.failReasons.push('崩溃: ' + e.message);
            }
            cases.push({ generatorId: g.id, kpId: kps[k], questionTypeId: qts[q], difficulty: DIFFICULTIES[d], seed: SEEDS[s], status: caseStatus(check), checks: check });
          }
        }
      }
    }
  });

  // —— 报告 ——
  var summary = {};
  cases.forEach(function (c) { summary[c.status] = (summary[c.status] || 0) + 1; });

  var failures = cases.filter(function (c) {
    return ['FAIL', 'CRASH', 'LOAD_ERROR'].indexOf(c.status) !== -1;
  });

  var byIssue = {};
  function reasonsOf(c) {
    if (c.checks && Array.isArray(c.checks.failReasons)) return c.checks.failReasons;
    if (Array.isArray(c.failReasons)) return c.failReasons;
    return c.status === 'PLAN_ERROR' ? ['PLAN_ERROR'] : [c.status];
  }
  failures.forEach(function (c) {
    reasonsOf(c).forEach(function (r) { byIssue[r] = (byIssue[r] || 0) + 1; });
  });

  var report = {
    generatedAt: new Date().toISOString(),
    description: 'M4-R16 Generator 回归矩阵（Generator×KP×QT×Difficulty×Seed）',
    matrix: { difficulties: DIFFICULTIES, seeds: SEEDS, batch: BATCH },
    summary: summary,
    failures: summary.FAIL || 0,
    crashes: summary.CRASH || 0,
    byIssue: byIssue,
    cases: cases
  };

  fs.mkdirSync(path.join(ROOT, 'dev', 'reports'), { recursive: true });
  var outPath = path.join(ROOT, 'dev', 'reports', 'generator-regression-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('M4-R16 Generator 回归矩阵');
  console.log('');
  console.log('矩阵 cases:    ' + cases.length);
  console.log('  PASS:        ' + (summary.PASS || 0));
  console.log('  FAIL:        ' + (summary.FAIL || 0) + '  （越界/答案错/重复/不可渲染/不满足 Plan）');
  console.log('  CRASH:       ' + (summary.CRASH || 0));
  console.log('  PLAN_ERROR:  ' + (summary.PLAN_ERROR || 0) + '  （该 KP×QT×难度无法构造 plan）');
  console.log('  LOAD_ERROR:  ' + (summary.LOAD_ERROR || 0));
  console.log('');
  Object.keys(byIssue).slice(0, 8).forEach(function (k) { console.log('  ✖ ' + k + '  x' + byIssue[k]); });
  console.log('');
  failures.slice(0, 10).forEach(function (f) {
    console.log('  ✖ ' + f.generatorId + ' [' + (f.kpId || '-') + ' ' + (f.questionTypeId || '-') + ' @' + (f.difficulty ?? '-') + '/' + f.seed + '] ' + reasonsOf(f).slice(0, 2).join('；'));
  });
  console.log('');
  console.log('报告: ' + outPath);
  console.log('');
  var ok = failures.length === 0 && (summary.PASS || 0) > 0;
  console.log(ok ? '[PASS] M4-R16 Generator 回归矩阵' : '[FAIL] M4-R16 Generator 回归矩阵（见报告）');
  process.exitCode = ok ? 0 : 1;
}

main().catch(function (e) {
  console.error('M4-R16 执行失败: ' + e.stack);
  process.exitCode = 1;
});