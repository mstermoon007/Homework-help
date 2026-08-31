#!/usr/bin/env node
/**
 * dev/test-migration-equiv.js — M4-R17 迁移批次「Adapter 对照」全量等价验证
 *
 * 对迁移候选插件运行【全部 KP】×【全部可迁移 QT】× 难度 × seed 的语义等价比较
 * （R15 仅采样前 3 KP 与首个 QT，且对 legacy 空 prompt 的图形/模板插件给出空洞等价）
 *
 * 本工具比 R15 更严格：
 *   ① legacy.opSet 必须可解析 —— 空 prompt（竖式/图表等模板渲染）不计入等价，
 *      标记 NO_PARSE（需 native 模板/图形生成器，不列入本批迁移）
 *   ② 逐 KP 输出 FULL（全部 case 等价）/ PARTIAL / DIFFERS / NO_PARSE
 *   ③ 迁移判定：插件 FULL 的 KP 数 = 100% 才算可整体切换；否则输出可切 KP 清单
 *
 * 用法: node dev/test-migration-equiv.js math-oral[,math-g1-multiplication-table]
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
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var SP = require(path.join(ROOT, 'dev', 'semantic-parse.js'));

var NATIVE_TARGET = {
  calc: 'generator:arithmetic-mixed-calculation',
  oral: 'generator:arithmetic-mixed-calculation',
  fill: 'generator:selection-fill',
  choice: 'generator:selection-choice',
  judge: 'generator:selection-judge'
};

var KpArith = require(path.join(ROOT, 'shared', 'generator', 'core', 'kp-arithmetic-semantics.js'));

var DIFFICULTIES = [2, 5, 8];
var SEEDS = ['migr-a', 'migr-b', 'migr-c'];
var BATCH = 4;

var CANDIDATES = (process.argv[2] || 'math-oral,math-g1-multiplication-table').split(',');

function profile(questions, plugin, plan) {
  var first = questions[0] || {};
  var parsedAll = questions.map(function (q) { return SP.parseExpression(q.prompt); });
  var ops = {}, minOp = Infinity, maxOp = -Infinity, minSteps = Infinity, maxSteps = -Infinity, answers = [];
  var parseable = 0;
  parsedAll.forEach(function (p) {
    if (!p) return;
    parseable++;
    (p.operators).forEach(function (o) { ops[o] = true; });
    p.operands.forEach(function (v) { if (v < minOp) minOp = v; if (v > maxOp) maxOp = v; });
    if (p.operators.length < minSteps) minSteps = p.operators.length;
    if (p.operators.length > maxSteps) maxSteps = p.operators.length;
  });
  questions.forEach(function (q) { answers.push(SP.answerIsCorrect(q)); });
  var valid = questions.every(function (q) { return Contract.validateSemanticQuestion(q).valid; });
  return {
    kp: first.knowledgePointId, qt: first.questionType, difficulty: first.difficulty,
    numberRange: first.numberRange,
    opSet: parseable ? Object.keys(ops).sort() : null,
    operandRange: parseable ? { min: minOp, max: maxOp } : null,
    steps: parseable ? { min: minSteps, max: maxSteps } : null,
    allAnswersCorrect: answers.every(function (a) { return a === true; }),
    answersDeterminable: answers.some(function (a) { return a !== 'n/a'; }),
    valid: valid
  };
}

async function runQTCase(entry, rec, kpId, qt, difficulty, seed) {
  var targetId = NATIVE_TARGET[qt];
  var r = { questionTypeId: qt, difficulty: difficulty, seed: seed, verdict: null, note: null, nativeOpSet: null, legacyOpSet: null };
  var nativeGen = CoreGen.get(targetId);
  if (!nativeGen) { r.verdict = 'N/A'; r.note = '无 native 生成器: ' + targetId; return r; }

  var kpCanon = require(path.join(ROOT, 'shared', 'knowledge-point.js')).get(kpId);
  var sem = kpCanon ? KpArith.resolveArithmeticSemantics(kpCanon) : null;
  r.kpSemantics = sem ? { legacyType: sem.legacyType, operators: sem.operators, steps: sem.steps } : null;

  // M4-R17：仅 calc/oral 且 KP 可由纯算术核心覆盖时才判定等价；
  // 其余（mult 之外的 selection 题型、无算术语义的 KP）标记 N/A（不可由原生算术迁移）
  if (!sem && (qt === 'calc' || qt === 'oral')) {
    r.verdict = 'NOT_MIGRATABLE';
    r.note = 'KP 无纯算术语义（legacyType=' + (kpCanon && kpCanon.source && kpCanon.source.legacyType) + '）';
    return r;
  }

  var plan;
  try {
    plan = Engine.plan({ knowledgePointId: kpId, questionType: qt, count: BATCH, difficulty: difficulty }).plans[0];
  } catch (e) { r.verdict = 'PLAN_ERROR'; r.note = e.message; return r; }

  var gen = Adapter.createLegacyGenerator(entry.plugin, { capabilities: rec.questionTypes, knowledgePoints: rec.knowledgePoints });
  var legacyQs, nativeQs;
  try {
    // M4-R17：legacy 侧以与 native 相同的 KP 语义驱动（operators），对照才公平
    var legacyExtra = {};
    if (kpCanon && kpCanon.grade != null) legacyExtra.grade = kpCanon.grade;
    if (sem && (qt === 'calc' || qt === 'oral')) {
      // M4-R17：legacy 以与 native 相同的语义算符集驱动（operators 直传），对照一致
      legacyExtra.operators = sem.operators.slice();
    }
    var outL = gen.generate(plan, { seed: seed, legacy: legacyExtra });
    legacyQs = Array.isArray(outL) ? outL : null;
  } catch (e) { r.verdict = 'LEGACY_ERROR'; r.note = e.message; return r; }
  if (!legacyQs) { r.verdict = 'LEGACY_ERROR'; r.note = 'legacy 未返回题目'; return r; }
  try {
    var outN = nativeGen.generate(plan, { seed: seed });
    nativeQs = Array.isArray(outN) ? outN : null;
  } catch (e) { r.verdict = 'NATIVE_ERROR'; r.note = e.message; return r; }
  if (!nativeQs) { r.verdict = 'NATIVE_ERROR'; r.note = 'native 未返回题目'; return r; }

  var pL = profile(legacyQs, entry.plugin, plan);
  var pN = profile(nativeQs, null, plan);
  r.legacyOpSet = pL.opSet;
  r.nativeOpSet = pN.opSet;

  if (!pL.opSet) { r.verdict = 'NO_PARSE'; r.note = 'legacy prompt 不可解析（模板/图形渲染），不计入等价'; return r; }
  if (!pN.opSet) { r.verdict = 'NATIVE_NO_PARSE'; r.note = 'native 输出不可解析'; return r; }
  if (!pL.valid || !pN.valid) { r.verdict = 'INVALID'; r.note = '未通过契约校验'; return r; }

  // 运算集合：M4-R17 以「KP 语义算符集」为界——两边都不得超出语义；
  // 不要求两边「采样到相同算符」（addsub 一批全 + 另一批全 − 属正常随机分布）。
  // legacy 单算子（表内运算）时要求 strict 匹配语义集；native 必须覆盖语义集在能力上可产出。
  var semOps = (r.kpSemantics ? r.kpSemantics.operators : null) || [];
  // M4-R17：归一化算符字形（语义用 U+2212 − / ×；parseExpression 输出 ASCII -）
  function canonOp(o) {
    if (o === '+' || o === '＋') return '+';
    if (o === '-' || o === '−' || o === '–' || o === '－') return '-';
    if (o === '×' || o === '*' || o === 'x' || o === 'X') return '×';
    if (o === '÷' || o === '/') return '÷';
    return o;
  }
  var outside = function (opSet) { return opSet.map(canonOp).some(function (o) { return semOps.map(canonOp).indexOf(o) === -1; }); };
  var lWithin = pL.opSet.map(canonOp).every(function (o) { return semOps.map(canonOp).indexOf(o) !== -1; });
  var nWithin = pN.opSet.map(canonOp).every(function (o) { return semOps.map(canonOp).indexOf(o) !== -1; });
  if (!lWithin || !nWithin) {
    r.verdict = 'DIFFERS';
    r.note = '算符超出 KP 语义: legacy=' + pL.opSet.join(',') + ' native=' + pN.opSet.join(',') + ' sem=' + semOps.join(',');
    return r;
  }
  var nr = (plan.constraints && plan.constraints.numberRange) || {};
  var lIn = pL.operandRange.min >= nr.min && pL.operandRange.max <= nr.max;
  var nIn = pN.operandRange.min >= nr.min && pN.operandRange.max <= nr.max;
  // 步数不超 maxSteps
  var lSteps = pL.steps.max <= (plan.constraints.maxSteps != null ? plan.constraints.maxSteps : Infinity);
  var nSteps = pN.steps.max <= (plan.constraints.maxSteps != null ? plan.constraints.maxSteps : Infinity);
  // 两边答案都自洽
  var lAns = pL.answersDeterminable && pL.allAnswersCorrect;
  var nAns = pN.answersDeterminable && pN.allAnswersCorrect;

  if (!lIn) {
    // legacy 越界（如表内除法被除数可达 81，但 plan.range.max=20）而 native 合规：
    // legacy 不遵守 plan 范围属既有缺陷，native 更合规 → 仍判 EQUIVALENT 并记 note
    if (nIn && lAns && nAns && lSteps && nSteps) {
      r.verdict = 'EQUIVALENT';
      r.note = 'legacy 越界（native 合规）legacy=' + JSON.stringify(pL.operandRange) + ' range=' + JSON.stringify(nr);
      return r;
    }
    r.verdict = 'DIFFERS'; r.note = '操作数出界 legacy=' + JSON.stringify(pL.operandRange) + ' native=' + JSON.stringify(pN.operandRange) + ' range=' + JSON.stringify(nr); return r;
  }
  if (!nIn) { r.verdict = 'DIFFERS'; r.note = '操作数出界 native=' + JSON.stringify(pN.operandRange) + ' range=' + JSON.stringify(nr); return r; }
  if (!lSteps || !nSteps) { r.verdict = 'DIFFERS'; r.note = '步数超限 legacy=' + JSON.stringify(pL.steps) + ' native=' + JSON.stringify(pN.steps) + ' max=' + plan.constraints.maxSteps; return r; }
  if (!lAns || !nAns) { r.verdict = 'DIFFERS'; r.note = '答案不自洽 legacy=' + lAns + ' native=' + nAns; return r; }

  r.verdict = 'EQUIVALENT';
  return r;
}

async function runTool() {
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var out = { candidates: {}, summary: {} };

  for (var i = 0; i < genRecords.length; i++) {
    var rec = genRecords[i];
    if (rec.subject !== 'math' || CANDIDATES.indexOf(rec.pluginId) === -1) continue;
    var sharedQt = (rec.questionTypes || []).filter(function (qt) { return NATIVE_TARGET[qt]; });
    if (!sharedQt.length) { out.candidates[rec.pluginId] = { verdict: 'NO_NATIVE_QT' }; continue; }

    var entry = loader.loadPlugin(rec.pluginId);
    if (entry.error || !entry.compatible) {
      out.candidates[rec.pluginId] = { verdict: 'LOAD_ERROR', note: entry.error || entry.missingInterfaces.join('/') };
      continue;
    }

    var kps = rec.knowledgePoints || [];
    var c = { kps: [], fullKps: 0, noParseKps: 0, differsKps: 0, planErrKps: 0, verdict: null };
    out.candidates[rec.pluginId] = c;

    for (var k = 0; k < kps.length; k++) {
      var kpId = kps[k];
      var kpRow = { kpId: kpId, qts: {}, verdict: null, note: null };
      c.kps.push(kpRow);

      for (var q = 0; q < sharedQt.length; q++) {
        var qt = sharedQt[q];
        var cases = [];
        for (var d = 0; d < DIFFICULTIES.length; d++) {
          for (var s = 0; s < SEEDS.length; s++) {
            cases.push(await runQTCase(entry, rec, kpId, qt, DIFFICULTIES[d], SEEDS[s]));
          }
        }
        var byV = {};
        cases.forEach(function (cc) { byV[cc.verdict] = (byV[cc.verdict] || 0) + 1; });
        kpRow.qts[qt] = { detail: cases, counts: byV };
      }

      // KP 级判定
      var all = [];
      Object.keys(kpRow.qts).forEach(function (qt) { all = all.concat(kpRow.qts[qt].detail); });
      var combined = {};
      all.forEach(function (cc) { combined[cc.verdict] = (combined[cc.verdict] || 0) + 1; });
      var eqCount = combined.EQUIVALENT || 0;
      if (eqCount === all.length && all.length > 0) kpRow.verdict = 'FULL-EQ';
      else if (eqCount === 0 && all.length > 0 && Object.keys(combined).every(function (v) { return v === 'NOT_MIGRATABLE'; })) kpRow.verdict = 'N/A';
      else if (eqCount === 0 && all.length > 0 && Object.keys(combined).every(function (v) { return v === 'PLAN_ERROR'; })) kpRow.verdict = 'PLAN-ERR';
      else if (combined.NO_PARSE > 0) kpRow.verdict = 'NO_PARSE';
      else if (eqCount > 0) kpRow.verdict = 'PARTIAL';
      else if (eqCount === 0 && combined.PLAN_ERROR > 0) kpRow.verdict = 'PLAN-ERR';
      else kpRow.verdict = 'DIFFERS';

      if (kpRow.verdict === 'FULL-EQ') c.fullKps++;
      else if (kpRow.verdict === 'NO_PARSE') c.noParseKps++;
      else if (kpRow.verdict === 'DIFFERS') c.differsKps++;
      else if (kpRow.verdict === 'PLAN-ERR') c.planErrKps++;
    }

    c.verdict = c.fullKps === kps.length ? 'MIGRATABLE' : 'PARTIAL-MIGRATE';
    out.summary[rec.pluginId] = c.verdict;
  }

  // 输出
  console.log('M4-R17 迁移批次 Adapter 对照（逐 KP 全量）');
  console.log('');
  Object.keys(out.candidates).forEach(function (pid) {
    var c = out.candidates[pid];
    console.log('=== ' + pid + ' [' + c.verdict + ']  FULL-EQ:' + c.fullKps + '/' + c.kps.length + (c.noParseKps ? ' NO_PARSE:' + c.noParseKps : '') + (c.differsKps ? ' DIFFERS:' + c.differsKps : ''));
    c.kps.forEach(function (k) {
      var qs = Object.keys(k.qts).map(function (qt) {
        var q = k.qts[qt];
        var diag = Object.keys(q.counts).filter(function (v) { return q.counts[v] < DIFFICULTIES.length * SEEDS.length; }).map(function (v) { return v + ':' + q.counts[v]; });
        return qt + '=' + q.counts.EQUIVALENT + '/' + (DIFFICULTIES.length * SEEDS.length) + (diag.length ? '(' + diag.join(';') + ')' : '');
      }).join('  ');
      console.log('  ' + k.kpId.padEnd(34) + k.verdict.padEnd(12) + qs);
    });
  });
  console.log('');

  var ok = Object.keys(out.candidates).length > 0 && Object.keys(out.candidates).every(function (pid) { return out.summary[pid] === 'MIGRATABLE'; });
  console.log(ok ? '[PASS] M4-R17 Adapter 对照：全批次可迁移' : '[INFO] M4-R17 Adapter 对照：部分迁移（见 KP 清单）');
  return out;
}

module.exports = { runTool: runTool };

if (require.main === module) {
  runTool().catch(function (e) { console.error('M4-R17 Adapter 对照失败: ' + e.stack); process.exitCode = 1; });
}