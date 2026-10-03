#!/usr/bin/env node
'use strict';
// dev/p30/check-generation-failure-classify.js — P30-19 全量真实生成矩阵失败分类
//
// 目的：对 1570 行 ALLOW(KP, QT) 做「真实执行链」失败分类（P30 阶段二收尾证据）。
//       与 6b 冻结门禁（check-generation-matrix-freeze.js，只看终态）互补：
//       本脚本把失败按链路位置细分归类，并暴露 6b 不可见的 plan 级中间观测
//       （重试消耗 / 容量缺口 / FAILED 计划 / 中间验证错误码）。
//
// 纯 dev 检查：不改任何生产代码，不新增架构，不改 T0–T3 数据。
//
// 两层观测（统一冻结 seed 口径 freeze:p28-v1|kp|qt|d3，与 P28-GENERATION-MATRIX-FROZEN 一致）：
//
//   Layer A · 真实整链终态（PracticeSession，count=1，同 6b 口径）：
//     A1 exception        —— session.start() 抛错
//     A2 noQuestion       —— 0 题（生成空/PARTIAL 空）
//     A3 typeDrift        —— 产出 questionType ≠ 请求 QT（Z2 夺权信号）
//     A4 kpDrift          —— 产出 KP ≠ 请求 KP（Z1 夺权信号）
//     A5 schema           —— SemanticQuestion Schema 校验失败
//     A6 kpSem            —— KpSemantic 校验失败（错误码细分）
//     A7 typeContract     —— TypeContract 7 类不变量违反
//     A8 placeholder      —— 题面含占位符（fake/placeholder/empty/fallback）
//     A9 emptyStem        —— 题面 <4 字符
//     A10 emptyAnswer     —— answer 缺失
//     A11 fallbackGen     —— metadata.generator 不在 GeneratorRegistry（回退/适配器题）
//
//   Layer B · plan 级深观测（StrategyEngine.plan + presentation-engine.generateQuestions，count=6）：
//     B1 status           —— SUCCESS / PARTIAL / FAILED（RetryLoop 终态）
//     B2 retries          —— 重试消耗分布（0 / 1-2 / ≥3；重试是合法机制，只记账）
//     B3 capacityGap      —— 实产 < 请求（容量缺口，FINAL-142 容量记账口径，只记账）
//     B4 failedPlan       —— plan 抛错（FATAL_ERROR / NON_RETRYABLE / MAX_RETRIES_EXCEEDED，
//                            presentation-engine 对真实错误码显式失败）
//     B5 errorCodes       —— 行内 validationResults 错误码分布（终态成功行应为空）
//
//   判定：Layer A 零 FAIL 行 且 Layer B 无 B4 failedPlan 且无 0 题行 → PASS（退出 0）。
//         B2/B3 为能力记账（FINAL-142 判例：语义空间饱和是 Generator 能力上限的如实表达），
//         只记录不判 FAIL；修复决策交 P30-20 阶段二门禁。
//
// 产物（--write）：dev/p30/reports/p30-generation-failure-classify.json（确定性内容，无时间戳；
//                  freeze seed 下重跑字节一致）。
//
// 用法：node dev/p30/check-generation-failure-classify.js            只跑并输出摘要，不落盘
//       node dev/p30/check-generation-failure-classify.js --write    落盘分类报告

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var SQ = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
var KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
var TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
var R = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var SE = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var Orch = require(path.join(ROOT, 'shared', 'engine', 'presentation-engine.js'));
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var RL = require(path.join(ROOT, 'shared', 'generator', 'retry-loop.js'));

var OUT_JSON = path.join(ROOT, 'dev', 'p30', 'reports', 'p30-generation-failure-classify.json');
var WRITE = process.argv.indexOf('--write') !== -1;

var CANONICAL = QTR.TYPES.map(function (t) { return t.id; });
var PLACEHOLDER = /占位|placeholder|TODO|待定|待补充|Lorem|^\.{3,}$/;

// 与 6b 相同的冻结口径（同 seed 同难度，保证与 P28-GENERATION-MATRIX-FROZEN 可对账）
var FREEZE_SEED_VERSION = 'p28-v1';
var FREEZE_DIFFICULTY = 3;
var LAYER_B_COUNT = 6;

function freezeSeed(kp, qt) {
  return 'freeze:' + FREEZE_SEED_VERSION + '|' + kp + '|' + qt + '|d' + FREEZE_DIFFICULTY;
}

function gradeOf(kp) {
  var m = /^math-g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

// ---------- 1. 动态枚举 1570 行（与 6a/6b 同机制） ----------
var ALL = CANONICAL;
var kps = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    kps.push({ id: k.knowledgeId, grade: g });
  });
}
var pairs = [];
kps.forEach(function (k) {
  var ev = KCV.buildEligibility([k.id], ALL);
  var m = (ev.matrix && ev.matrix[k.id]) || {};
  ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.id, grade: k.grade, qt: t }); });
});
if (pairs.length !== 1570) {
  console.error('INVARIANT FAIL: 动态枚举 ' + pairs.length + ' != 1570');
  process.exit(1);
}

var registryIds = {};
R.all().forEach(function (rec) { registryIds[rec.id] = 1; });

// ---------- 2. Layer A · 真实整链终态 ----------
var aCats = {
  exception: 0, noQuestion: 0, typeDrift: 0, kpDrift: 0, schema: 0,
  kpSem: 0, typeContract: 0, placeholder: 0, emptyStem: 0,
  emptyAnswer: 0, fallbackGen: 0
};
var aKpSemCodes = {};
var aTcViolations = {};
var aFailRows = [];
var aOk = 0;

// FAILED 行归因重放：复刻 presentation-engine 的 RetryLoop 调用（非 attachToPlan，
// 与真链一致），拿抛错路径丢失的 attempts 错误码（只读诊断，无副作用）
function classifyFailedPlan(plan) {
  return new Promise(function (resolve) {
    try {
      var sel = Selector.selectGenerator(plan);
      var gen = Selector.instantiate(sel);
      if (!gen) { resolve({ generator: sel ? sel.generatorId : null, codes: {}, messages: {} }); return; }
      RL.generateWithRetry(function (p) { return gen.generate(p); }, plan, {
        generatorId: sel.generatorId,
        generatorVersion: sel.record && sel.record.version || '1.0.0',
        seed: plan.seed != null ? plan.seed : undefined,
        validatorContext: { generatorId: sel.generatorId, seenKeys: new Set(), mathSeenKeys: new Map() }
      }).then(function (res) {
        var codes = {}, messages = {};
        (res.attempts || []).forEach(function (a) {
          (a.errors || []).forEach(function (e) {
            codes[e.code] = (codes[e.code] || 0) + 1;
            if (!messages[e.code]) messages[e.code] = String(e.message).slice(0, 120);
          });
        });
        resolve({ generator: sel.generatorId, codes: codes, messages: messages });
      }).catch(function () {
        resolve({ generator: sel.generatorId, codes: {}, messages: {} });
      });
    } catch (e) {
      resolve({ generator: null, codes: {}, messages: {} });
    }
  });
}

(async function run() {
  // ----- Layer A -----
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var rowFails = [];
    try {
      var session = new PracticeSession({
        subject: 'math', grade: p.grade, count: 1,
        difficulty: FREEZE_DIFFICULTY,
        knowledgePointId: p.kp, questionType: p.qt,
        seed: freezeSeed(p.kp, p.qt)
      });
      await session.start();
      var qs = session.semanticQuestions || [];
      var q = qs[0];
      if (!q) {
        rowFails.push('A2:noQuestion');
      } else {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        if (q.questionType !== p.qt) rowFails.push('A3:typeDrift(' + q.questionType + ')');
        if (qk !== p.kp) rowFails.push('A4:kpDrift(' + qk + ')');
        var gen = (q.metadata && q.metadata.generator) || null;
        if (!gen || !registryIds[gen]) rowFails.push('A11:fallbackGen(' + gen + ')');
        var sv = SQ.validateSchema(q);
        if (!sv.valid) rowFails.push('A5:schema');
        var planA = { knowledgePointIds: [p.kp], questionTypeId: p.qt, difficulty: FREEZE_DIFFICULTY, count: 1 };
        var kv = KpSem.validateKpSemantics(q, { plan: planA, kpId: p.kp });
        if (!kv.valid) {
          (kv.errors || []).forEach(function (e) {
            aKpSemCodes[e.code] = (aKpSemCodes[e.code] || 0) + 1;
            rowFails.push('A6:kpSem(' + e.code + ')');
          });
        }
        var tv = TC.check(p.qt, q);
        if (!tv.ok) {
          (tv.violations || []).forEach(function (v) {
            var key = v.code || v.rule || String(v && v.message).slice(0, 40);
            aTcViolations[key] = (aTcViolations[key] || 0) + 1;
          });
          rowFails.push('A7:typeContract');
        }
        var prompt = String(q.prompt || '');
        if (prompt.trim().length < 4) rowFails.push('A9:emptyStem');
        if (PLACEHOLDER.test(prompt)) rowFails.push('A8:placeholder');
        var an = q.answer;
        if (!an || an.value === undefined || an.value === null || an.value === '') rowFails.push('A10:emptyAnswer');
      }
    } catch (e) {
      rowFails.push('A1:exception(' + String((e && e.message) || e).slice(0, 80) + ')');
    }
    if (rowFails.length) {
      aFailRows.push({ kp: p.kp, qt: p.qt, fails: rowFails });
      rowFails.forEach(function (f) { aCats[f.split(':')[0]]++; });
    } else {
      aOk++;
    }
    if ((i + 1) % 200 === 0) process.stdout.write('\r  Layer A ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  Layer A ' + pairs.length + '/' + pairs.length + '          \n');

  // ----- Layer B -----
  var bRows = [];
  var bStatus = { SUCCESS: 0, PARTIAL: 0, FAILED: 0, exception: 0 };
  var bRetries = { '0': 0, '1-2': 0, '3+': 0 };
  var bErrorCodes = {};
  var bCapacityGap = [];
  var bGapByGen = {};
  var bGapBuckets = { '1-2': 0, '3-4': 0, '5+': 0 };
  var bFailedPlans = [];
  var bZeroRows = [];

  for (var j = 0; j < pairs.length; j++) {
    var pb = pairs[j];
    var rec = { kp: pb.kp, qt: pb.qt, status: null, retries: 0, produced: 0, requested: 0, generator: null, failedPlan: null, errorCodes: {} };
    try {
      var built = SE.plan({
        subject: 'math', grade: gradeOf(pb.kp), count: LAYER_B_COUNT,
        difficulty: FREEZE_DIFFICULTY,
        knowledgePointIds: [pb.kp], mode: 'single-kp',
        questionType: pb.qt, questionTypes: [pb.qt],
        seed: freezeSeed(pb.kp, pb.qt)
      });
      var plans = (built && built.plans) || [];
      if (plans.length !== 1) rec.failedPlan = 'planCount:' + plans.length;
      var produced = 0;
      for (var pi = 0; pi < plans.length; pi++) {
        var plan = plans[pi];
        try {
          var res = await Orch.generateQuestions(plan, { seenKeys: new Set(), mathSeenKeys: new Map() });
          var sqs = res.semanticQuestions || res.questions || [];
          produced += sqs.length;
          rec.status = res.status || (sqs.length ? 'SUCCESS' : 'FAILED');
          rec.retries = Math.max(rec.retries, res.retries || 0);
          rec.generator = res.generator || rec.generator;
          if (sqs.length === 0 && !rec.failedPlan) rec.failedPlan = 'zeroQuestions:' + (res.status || 'UNKNOWN');
          (res.validationResults || []).forEach(function (vr) {
            (vr && vr.errors ? vr.errors : []).forEach(function (e) {
              rec.errorCodes[e.code] = (rec.errorCodes[e.code] || 0) + 1;
              bErrorCodes[e.code] = (bErrorCodes[e.code] || 0) + 1;
            });
          });
        } catch (e) {
          var code = e && e.generationError ? e.generationError : 'EXCEPTION';
          rec.status = 'FAILED';
          rec.failedPlan = code;
          produced += (e && e.questions && e.questions.length) || 0;
        }
      }
      rec.produced = produced;
      rec.requested = LAYER_B_COUNT * Math.max(plans.length, 1);
      if (rec.produced < rec.requested) {
        var gap = rec.requested - rec.produced;
        var bucket = gap <= 2 ? '1-2' : (gap <= 4 ? '3-4' : '5+');
        bGapBuckets[bucket]++;
        if (rec.generator) bGapByGen[rec.generator] = (bGapByGen[rec.generator] || 0) + 1;
        bCapacityGap.push({ kp: pb.kp, qt: pb.qt, produced: rec.produced, requested: rec.requested, generator: rec.generator });
      }
      if (rec.produced === 0) bZeroRows.push({ kp: pb.kp, qt: pb.qt, why: rec.failedPlan });
      if (rec.failedPlan) {
        // 归因重放：拿抛错路径丢失的 attempts 错误码（仅失败行，开销可忽略）
        var attr = await classifyFailedPlan(plan);
        bFailedPlans.push({
          kp: pb.kp, qt: pb.qt, error: rec.failedPlan, generator: attr.generator,
          evidenceCodes: attr.codes, evidenceMessages: attr.messages
        });
      }
      bStatus[rec.status] = (bStatus[rec.status] || 0) + 1;
      var rb = rec.retries === 0 ? '0' : (rec.retries <= 2 ? '1-2' : '3+');
      bRetries[rb]++;
    } catch (e) {
      rec.status = 'exception';
      rec.failedPlan = 'EXCEPTION';
      bStatus.exception++;
      bFailedPlans.push({ kp: pb.kp, qt: pb.qt, error: 'EXCEPTION', generator: null,
        evidenceCodes: {}, evidenceMessages: { EXCEPTION: String((e && e.message) || e).slice(0, 120) } });
    }
    bRows.push(rec);
    if ((j + 1) % 200 === 0) process.stdout.write('\r  Layer B ' + (j + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  Layer B ' + pairs.length + '/' + pairs.length + '          \n');

  // ----- 汇总判定 -----
  var aFailRowCount = aFailRows.length;
  var pass = aFailRowCount === 0 && bFailedPlans.length === 0 && bZeroRows.length === 0;

  console.log('');
  console.log('=== P30-19 全量真实生成矩阵失败分类 ===');
  console.log('Layer A（整链终态 count=1）：rows=' + pairs.length + '，PASS ' + aOk + '，FAIL ' + aFailRowCount);
  Object.keys(aCats).forEach(function (k) { if (aCats[k]) console.log('  ' + k + ' = ' + aCats[k]); });
  var ksemKeys = Object.keys(aKpSemCodes);
  if (ksemKeys.length) console.log('  kpSem 错误码：' + JSON.stringify(aKpSemCodes));
  var tcKeys = Object.keys(aTcViolations);
  if (tcKeys.length) console.log('  typeContract 违例：' + JSON.stringify(aTcViolations));
  aFailRows.slice(0, 20).forEach(function (f) {
    console.log('  FAIL ' + f.kp + ' ' + f.qt + ' → ' + f.fails.join(', '));
  });
  if (aFailRows.length > 20) console.log('  …另有 ' + (aFailRows.length - 20) + ' 行失败');
  console.log('Layer B（plan 级 count=' + LAYER_B_COUNT + '）：status=' + JSON.stringify(bStatus) +
    '，retries=' + JSON.stringify(bRetries));
  console.log('  capacityGap 行数=' + bCapacityGap.length + '，缺口分桶=' + JSON.stringify(bGapBuckets) +
    '，failedPlan 行数=' + bFailedPlans.length + '，zeroQuestion 行数=' + bZeroRows.length);
  var gk = Object.keys(bGapByGen).sort(function (a, b) { return bGapByGen[b] - bGapByGen[a]; });
  if (gk.length) console.log('  capacityGap 按生成器：' + gk.slice(0, 10).map(function (k) { return k + '=' + bGapByGen[k]; }).join(', '));
  var ecKeys = Object.keys(bErrorCodes);
  if (ecKeys.length) {
    console.log('  行内验证错误码：' + JSON.stringify(bErrorCodes));
  }
  bFailedPlans.slice(0, 20).forEach(function (f) {
    console.log('  FAILED ' + f.kp + ' ' + f.qt + ' gen=' + f.generator + ' → ' + f.error +
      (Object.keys(f.evidenceCodes).length ? ' | 证据: ' + JSON.stringify(f.evidenceCodes) : ''));
  });

  var artifact = {
    task: 'P30-19 全量真实生成矩阵失败分类',
    schemaVersion: 'p30-failure-classify.1',
    deterministic: true,
    seedPolicy: {
      version: FREEZE_SEED_VERSION,
      difficulty: FREEZE_DIFFICULTY,
      formula: 'freeze:<version>|<kp>|<qt>|d<difficulty>',
      layerBCount: LAYER_B_COUNT,
      deterministic: true
    },
    layerA: {
      rows: pairs.length,
      pass: aOk,
      failRows: aFailRowCount,
      categories: aCats,
      kpSemErrorCodes: aKpSemCodes,
      typeContractViolations: aTcViolations,
      failRowDetails: aFailRows
    },
    layerB: {
      rows: pairs.length,
      requestedPerRow: LAYER_B_COUNT,
      statusCount: bStatus,
      retriesBuckets: bRetries,
      errorCodes: bErrorCodes,
      capacityGapCount: bCapacityGap.length,
      capacityGapBuckets: bGapBuckets,
      capacityGapByGenerator: bGapByGen,
      capacityGapRows: bCapacityGap,
      failedPlanCount: bFailedPlans.length,
      failedPlanDetails: bFailedPlans,
      zeroQuestionRows: bZeroRows
    },
    verdict: {
      pass: pass,
      rule: 'Layer A 零 FAIL 行 且 Layer B 无 failedPlan 且无 0 题行 → PASS；retries/capacityGap 为能力记账（FINAL-142），不判 FAIL',
      summary: pass
        ? '1570 行全量真实生成：Layer A 全绿（11 类失败分类均 0），Layer B 无 FAILED 计划、无 0 题行'
        : '存在失败行，见 layerA.failRowDetails / layerB.failedPlanDetails'
    }
  };

  if (WRITE) {
    fs.writeFileSync(OUT_JSON, JSON.stringify(artifact, null, 1) + '\n');
    console.log('报告已写入 dev/p30/reports/p30-generation-failure-classify.json（--write）');
  }
  process.exit(pass ? 0 : 1);
})().catch(function (e) {
  console.error('FATAL', e);
  process.exit(1);
});
