#!/usr/bin/env node
/**
 * dev/test-generator-equivalence.js — M4-R15 新旧 Generator 生成结果一致性测试
 *
 * 对旧插件（经 LegacyAdapter）与新核心 Generator（native）用【相同 plan】分别生成样本批次，
 * 在语义层面比较 10 个字段——不要求文本/数值完全一致，只要求语义等价：
 *
 *   knowledgePoint / questionType / operation / operands / structure / answer /
 *   difficulty / graphic / check / renderability
 *
 * 「语义等价」判定（profile 级）：
 *   operation  —— 两条轨道在本 plan 下产生的运算集合一致（native 超集视为可迁移）
 *   operands   —— 操作数都在 plan.numberRange 内（不要求数值相同）
 *   structure  —— 步数均不超过 plan.maxSteps
 *   answer     —— 每条样本的「题干表达式 → 答案」自身正确（不要求两边答案相等）
 *   difficulty / graphic / check / renderability —— 结构一致
 *
 * 各字段若无法归一解析（如几何命题、应用题叙述）标记 n/a，不参与判定；
 * 少于 4 个可比字段的 case 判 PARTIAL。
 *
 * 结论分级：EQUIVALENT（可迁移）/ DIFFERS / PARTIAL / N/A / PLAN_ERROR /
 *          LEGACY_ERROR / NATIVE_ERROR / LOAD_ERROR
 *
 * 输出：控制台摘要 + dev/reports/generator-equivalence-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var Adapter = require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var CoreGen = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var GraphicRenderer = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var SP = require(path.join(ROOT, 'dev', 'semantic-parse.js'));

// native 能力 → 目标核心 Generator（仅算术 / 选择两类有 native 对应）
var NATIVE_TARGET = {
  calc: 'generator:arithmetic-mixed-calculation',
  oral: 'generator:arithmetic-mixed-calculation',
  fill: 'generator:selection-fill',
  choice: 'generator:selection-choice',
  judge: 'generator:selection-judge'
};

var DIFFICULTIES = [2, 5, 8];
var SEEDS = ['equiv-a', 'equiv-b', 'equiv-c'];
var BATCH = 4;

/* ---------- 批次 profile 工具 ---------- */

async function profile(questions, plugin, plan) {
  var first = questions[0] || {};
  var parsedAll = questions.map(function (q) { return SP.parseExpression(q.prompt); });
  var ops = {}, opsCount = 0, minOp = Infinity, maxOp = -Infinity, minSteps = Infinity, maxSteps = -Infinity, answers = [];
  var parseable = 0;

  parsedAll.forEach(function (p) {
    if (!p) return;
    parseable++;
    (p.operators).forEach(function (o) { ops[o] = true; if (parseable === null) {} });
    opsCount = Object.keys(ops).length;
    p.operands.forEach(function (v) { minOp = Math.min(minOp, v); maxOp = Math.max(maxOp, v); });
    if (p.operators.length < minSteps) minSteps = p.operators.length;
    if (p.operators.length > maxSteps) maxSteps = p.operators.length;
  });
  questions.forEach(function (q) { answers.push(SP.answerIsCorrect(q)); });

  var valid = questions.every(function (q) {
    return Contract.validateSemanticQuestion(q).valid;
  });

  var graphic = first.graphic && first.graphic.type ? first.graphic.type : 'none';
  var embedded = first && (typeof first.check === 'function' || typeof first.render === 'function');
  var renderable = true;
  if (plugin) {
    try {
      var set = await Adapter.runLegacyFallback(plugin, plan);
      renderable = !!(set && Array.isArray(set.questions) && set.questions.length > 0);
    } catch (e) { renderable = false; }
  } else {
    renderable = graphic === 'none' || GraphicRenderer.isSupported(graphic);
  }

  return {
    kp: first.knowledgePointId,
    qt: first.questionType,
    difficulty: first.difficulty,
    numberRange: first.numberRange,
    opSet: parseable ? Object.keys(ops).sort() : null,
    operandRange: parseable ? { min: minOp, max: maxOp } : null,
    steps: parseable ? { min: minSteps, max: maxSteps } : null,
    answers: answers,
    allAnswersCorrect: answers.every(function (a) { return a === true; }),
    answersDeterminable: answers.some(function (a) { return a !== 'n/a'; }),
    valid: valid,
    graphic: graphic,
    checkEmbedded: embedded,
    renderable: renderable
  };
}

/* ---------- 10 字段比较（profile） ---------- */

function compareProfiles(legacy, native, plan) {
  kp: {};
  var fields = {};

  fields.knowledgePoint = {
    legacy: legacy.kp, native: native.kp,
    equal: legacy.kp === plan.knowledgePointId && native.kp === plan.knowledgePointId
  };

  fields.questionType = {
    legacy: legacy.qt, native: native.qt,
    equal: legacy.qt === plan.questionTypeId && native.qt === plan.questionTypeId
  };

  // operation：集合一致（native 超集视为可迁移）
  if (legacy.opSet && native.opSet) {
    var lSet = legacy.opSet, nSet = native.opSet;
    var legacyInNative = lSet.every(function (o) { return nSet.indexOf(o) !== -1; });
    fields.operation = { legacy: lSet, native: nSet, equal: legacyInNative, note: legacyInNative && lSet.length !== nSet.length ? 'native 超集' : null };
  } else {
    fields.operation = { legacy: legacy.opSet, native: native.opSet, equal: null };
  }

  // operands：两边都在 plan.numberRange 内
  if (legacy.operandRange && native.operandRange && plan.constraints && plan.constraints.numberRange) {
    var nr = { min: plan.constraints.numberRange.min != null ? plan.constraints.numberRange.min : (plan.numberRange ? plan.numberRange.min : null), max: plan.constraints.numberRange.max != null ? plan.constraints.numberRange.max : (plan.numberRange ? plan.numberRange.max : null) };
    var lIn = legacy.operandRange.min >= nr.min && legacy.operandRange.max <= nr.max;
    var nIn = native.operandRange.min >= nr.min && native.operandRange.max <= nr.max;
    fields.operands = { legacy: legacy.operandRange, native: native.operandRange, equal: lIn && nIn };
  } else {
    fields.operands = { legacy: legacy.operandRange, native: native.operandRange, equal: null };
  }

  // structure：步数均不超 maxSteps
  if (legacy.steps && native.steps && plan.constraints && plan.constraints.maxSteps != null) {
    fields.structure = {
      legacy: legacy.steps, native: native.steps,
      equal: legacy.steps.max <= plan.constraints.maxSteps && native.steps.max <= plan.constraints.maxSteps
    };
  } else {
    fields.structure = { legacy: legacy.steps, native: native.steps, equal: null };
  }

  // answer：各自表达式→答案自身正确
  if (legacy.answersDeterminable && native.answersDeterminable) {
    fields.answer = { legacy: legacy.allAnswersCorrect, native: native.allAnswersCorrect, equal: legacy.allAnswersCorrect && native.allAnswersCorrect };
  } else {
    fields.answer = { legacy: legacy.allAnswersCorrect, native: native.allAnswersCorrect, equal: null };
  }

  // difficulty
  fields.difficulty = {
    legacy: { d: legacy.difficulty, r: legacy.numberRange }, native: { d: native.difficulty, r: native.numberRange },
    equal: legacy.difficulty === native.difficulty &&
      String(legacy.numberRange && legacy.numberRange.min) === String(native.numberRange && native.numberRange.min) &&
      String(legacy.numberRange && legacy.numberRange.max) === String(native.numberRange && native.numberRange.max)
  };

  // graphic
  fields.graphic = { legacy: legacy.graphic, native: native.graphic, equal: legacy.graphic === native.graphic };

  // check（语义题不得内嵌渲染）
  fields.check = { legacy: legacy.checkEmbedded, native: native.checkEmbedded, equal: legacy.checkEmbedded === native.checkEmbedded };

  // renderability
  fields.renderability = { legacy: legacy.renderable, native: native.renderable, equal: legacy.renderable === native.renderable && legacy.renderable };

  // 两项生成都通过契约校验也是等价的前提
  var bothValid = legacy.valid && native.valid;
  return { fields: fields, bothValid: bothValid };
}

/* ---------- 主流程 ---------- */

async function runCase(entry, rec, kpId, qt, difficulty, seed) {
  var result = { pluginId: entry.id, knowledgePointId: kpId, questionTypeId: qt, difficulty: difficulty, seed: seed, fields: {}, verdict: null, note: null };

  var targetId = NATIVE_TARGET[qt];
  if (!targetId) {
    result.verdict = 'N/A';
    result.note = '无对应 native 生成器';
    return result;
  }
  var nativeGen = CoreGen.get(targetId);
  if (!nativeGen) {
    result.verdict = 'N/A';
    result.note = 'native 生成器缺失: ' + targetId;
    return result;
  }

  var plan;
  try {
    plan = Engine.plan({ knowledgePointId: kpId, questionType: qt, count: BATCH, difficulty: difficulty }).plans[0];
  } catch (e) {
    result.verdict = 'PLAN_ERROR';
    result.note = e.message;
    return result;
  }

  var gen = Adapter.createLegacyGenerator(entry.plugin, { capabilities: rec.questionTypes, knowledgePoints: rec.knowledgePoints });
  var legacyQs = null, nativeQs = null, legacyErr = null, nativeErr = null;

  try {
    var outL = gen.generate(plan, { seed: seed });
    if (outL && typeof outL.then === 'function') outL = await outL;
    legacyQs = Array.isArray(outL) ? outL : null;
  } catch (e) { legacyErr = e.message; }
  if (!legacyQs) {
    result.verdict = 'LEGACY_ERROR';
    result.note = legacyErr || 'legacy 未返回题目';
    return result;
  }

  try {
    var outN = nativeGen.generate(plan, { seed: seed });
    if (outN && typeof outN.then === 'function') outN = await outN;
    nativeQs = Array.isArray(outN) ? outN : null;
  } catch (e) { nativeErr = e.message; }
  if (!nativeQs) {
    result.verdict = 'NATIVE_ERROR';
    result.note = nativeErr || 'native 未返回题目';
    return result;
  }

  var pL = await profile(legacyQs, entry.plugin, plan);
  var pN = await profile(nativeQs, null, plan);
  var compared = compareProfiles(pL, pN, plan);

  result.fields = compared.fields;
  if (!compared.bothValid) {
    result.verdict = 'INVALID';
    result.note = '存在未通过契约校验的 SemanticQuestion';
    return result;
  }

  var entries = Object.keys(compared.fields).map(function (k) { return [k, compared.fields[k]]; });
  var comparable = entries.filter(function ([k, v]) { return v.equal != null; });
  var differed = comparable.filter(function ([k, v]) { return v.equal === false; });

  result.comparableFields = comparable.map(function ([k]) { return k; });
  result.diffFields = differed.map(function ([k]) { return k; });

  if (comparable.length < 4) {
    result.verdict = 'PARTIAL';
    result.note = '可比字段不足 4（' + comparable.length + '）';
  } else if (differed.length === 0) {
    result.verdict = 'EQUIVALENT';
  } else {
    result.verdict = 'DIFFERS';
    result.note = compared.fields.operation && compared.fields.operation.note || null;
  }
  return result;
}

async function main() {
  var reports = [];
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();

  for (var i = 0; i < genRecords.length; i++) {
    var rec = genRecords[i];
    if (rec.subject !== 'math') continue;
    var sharedQt = (rec.questionTypes || []).filter(function (qt) { return NATIVE_TARGET[qt]; });
    if (!sharedQt.length) continue;

    var entry = loader.loadPlugin(rec.pluginId);
    if (entry.error || !entry.compatible) {
      reports.push({ pluginId: rec.pluginId, verdict: 'LOAD_ERROR', note: entry.error || entry.missingInterfaces.join('/') });
      continue;
    }

    var kps = rec.knowledgePoints.slice(0, 3);
    var qtUsed = sharedQt[0];

    for (var k = 0; k < kps.length; k++) {
      for (var d = 0; d < DIFFICULTIES.length; d++) {
        for (var s = 0; s < SEEDS.length; s++) {
          reports.push(await runCase(entry, rec, kps[k], qtUsed, DIFFICULTIES[d], SEEDS[s]));
        }
      }
    }
  }

  var summary = {};
  reports.forEach(function (r) { summary[r.verdict] = (summary[r.verdict] || 0) + 1; });

  var report = {
    generatedAt: new Date().toISOString(),
    description: 'M4-R15 新旧 Generator 生成结果一致性（语义等价，不要求文本一致）',
    matrix: { difficulties: DIFFICULTIES, seeds: SEEDS, batch: BATCH },
    summary: summary,
    results: reports
  };
  fs.mkdirSync(path.join(ROOT, 'dev', 'reports'), { recursive: true });
  var outPath = path.join(ROOT, 'dev', 'reports', 'generator-equivalence-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('M4-R15 新旧 Generator 生成一致性');
  console.log('');
  console.log('等价矩阵:      ' + reports.length + ' cases');
  console.log('  EQUIVALENT:  ' + (summary.EQUIVALENT || 0) + '  （语义等价，可迁移 native）');
  console.log('  DIFFERS:     ' + (summary.DIFFERS || 0) + '  （存在语义差异，迁移需评估）');
  console.log('  PARTIAL:     ' + (summary.PARTIAL || 0) + '  （可比字段不足）');
  console.log('  PLAN_ERROR:  ' + (summary.PLAN_ERROR || 0));
  console.log('  LEGACY_ERROR:' + (summary.LEGACY_ERROR || 0));
  console.log('  NATIVE_ERROR:' + (summary.NATIVE_ERROR || 0));
  console.log('  INVALID:     ' + (summary.INVALID || 0));
  console.log('  LOAD_ERROR:  ' + (summary.LOAD_ERROR || 0));
  console.log('');

  reports.filter(function (r) { return r.verdict === 'DIFFERS' || r.verdict === 'PARTIAL'; })
    .slice(0, 12).forEach(function (r) {
      console.log('  ⚠ ' + r.pluginId + ' [' + r.knowledgePointId + ' @' + r.difficulty + '/' + r.seed + '] ' +
        r.verdict + ' —— 差异字段: ' + (r.diffFields || []).join(','));
    });
  var errors = reports.filter(function (r) { return ['LEGACY_ERROR', 'NATIVE_ERROR', 'LOAD_ERROR', 'INVALID'].indexOf(r.verdict) !== -1; });
  errors.slice(0, 10).forEach(function (r) { console.log('  ✖ ' + r.pluginId + ' ' + r.verdict + ': ' + r.note); });
  console.log('');
  console.log('报告: ' + outPath);
  console.log('');

  var ok = reports.length > 0 && errors.length === 0 && (summary.EQUIVALENT || 0) > 0;
  console.log(ok ? '[PASS] M4-R15 Generator 一致性测试' : '[FAIL] M4-R15 Generator 一致性测试');
  process.exitCode = ok ? 0 : 1;
}

main().catch(function (e) {
  console.error('M4-R15 执行失败: ' + e.stack);
  process.exitCode = 1;
});