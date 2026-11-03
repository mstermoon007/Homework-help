#!/usr/bin/env node
'use strict';
// dev/p25/derive-evidence-candidates.js — P26 evidence 全量扩建·候选规则派生
//
// 目标：把 P25-04 evidence 体系从 4 个 A 类代表 KP 扩到全部 75 个 A 类 KP（draftSemanticLevel==='A'）。
// 红线：证据规则不得虚构——全部断言机械派生自两类真值源，不做题面 NLP、不写 KP ID 分支：
//   1. 真实生成产出：每个 A 类 KP × ALLOW 题型用 PracticeSession 实际生成 N 题，
//      统计 sq.data 字段稳定性（全样本等值 → required field 候选）、生成器声明
//      semanticEvidence.relations（全样本一致 → required relation 候选）。
//   2. KBL 语义事实（kp-matrix.json semanticFamily/operations + intent-relations.json）：
//      forbidden 仅跨家族守卫（fieldNot data.operation ∉ KP 运算集；relationNot 对侧家族禁表），
//      required relation 必须通过 getAllowedRelations 允许集过滤（否则 check#8 必 fail，不产出）。
//
// 产出：dev/p25/reports/evidence-derive-report.json（人工可审逐行候选 + 基线证据状态 + 抽样题干）
// 消费：dev/p25/apply-evidence-candidates.js（审后合并进 kbl/teaching/evidence-rules.json）
//
// 用法：node dev/p25/derive-evidence-candidates.js [--n 6]

var fs = require('fs');
var path = require('path');
var __dirnameRoot = path.join(__dirname, '..', '..');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(__dirnameRoot, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(__dirnameRoot, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(__dirnameRoot, 'shared', 'engine', 'practice-session.js'));
var KpSemantic = require(path.join(__dirnameRoot, 'shared', 'validator', 'kp-semantic-validator.js'));

var N = 6;
var argN = process.argv.indexOf('--n');
if (argN !== -1 && process.argv[argN + 1]) N = Math.max(2, parseInt(process.argv[argN + 1], 10) || 6);

// P45-08：变体采样固定种子组（仅用于基线已失败行的 probeAgg，只做降级、不强化锚点）。
// 不叠加行号偏移：实测同一 KP×QT 在 260111/260121 为命名形态、260131/260171 为计数形态，
// 需要覆盖到两种形态才能让 probeVaries 判定 subtype 非结构恒定量。
var VARIANT_PROBE_SEEDS = [260111, 260121, 260131, 260141, 260151, 260161, 260171, 260181, 260191, 260201];

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var matrix = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'kp-matrix.json'));
var intentRelations = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'intent-relations.json'));
var evidenceRules = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'evidence-rules.json'));

// ---- A 类 KP 清单（75）----
var aKps = matrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });
var aById = {};
aKps.forEach(function (k) { aById[k.id] = k; });

// ---- ALLOW 行枚举（与 dev/check-allow-generation.js 同机制）----
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!aById[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// ---- 工具 ----
var OP_NORM = { addition: 'add', subtraction: 'sub', multiplication: 'mult', division: 'div', mixed: 'mixed' };
function kpOpsNorm(ops) {
  return (ops || []).map(function (o) { return OP_NORM[o] || o; });
}

/** data 浅层普查：叶路径 → {t, v}；数组记长度；深度 3；跳过 semanticEvidence（单独处理） */
function census(data, out, prefix, depth) {
  if (data == null || typeof data !== 'object') return;
  Object.keys(data).forEach(function (k) {
    if (k === 'semanticEvidence') return;
    var v = data[k];
    var p = prefix ? prefix + '.' + k : k;
    if (v === null || v === undefined) { out[p] = { t: 'null' }; return; }
    if (Array.isArray(v)) { out[p] = { t: 'array', len: v.length }; return; }
    if (typeof v === 'object') {
      if (depth <= 1) { out[p] = { t: 'object' }; return; }
      census(v, out, p, depth - 1);
      return;
    }
    out[p] = { t: typeof v, v: v };
  });
}

/** KP 语义视图（与 validator getKpSemanticForIntent 同构） */
function kpSemanticOf(kpId) {
  var kp = KC.get(kpId);
  if (!kp) return null;
  var sem = kp.semantic || {};
  return { family: sem.family || null, type: kp.type || null, operations: sem.operations || [] };
}

/** 对侧家族禁表（镜像 validator getAllowedRelations 的兜底方向） */
function crossFamilyForbidden(kpSem) {
  var side = null;
  if (kpSem && (kpSem.type === 'geometry' || kpSem.family === 'geometry')) side = 'geometry';
  else if (kpSem && (kpSem.type === 'calculation' ||
    kpSem.family === 'multiplication-division' || kpSem.family === 'fraction' ||
    kpSem.family === 'decimal' || kpSem.family === 'percent')) side = 'algebra-arithmetic';
  if (!side) return [];
  return (intentRelations.forbiddenAcrossFamilies && intentRelations.forbiddenAcrossFamilies[side]) || [];
}

// ---- 主循环 ----
var rows = [];
var done = 0;
var existingKeys = {};
var existingByKey = {};
evidenceRules.rules.forEach(function (r) {
  var k = r.knowledgePointId + '|' + r.questionType;
  existingKeys[k] = true;
  existingByKey[k] = r;
});

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var kpMeta = aById[p.kp];
    var kpSem = kpSemanticOf(p.kp);
    var allowedRels = KpSemantic.getAllowedRelations(kpSem);

    // P44-H9：证据锚点随 KBL 语义事实漂移（源 Excel 变更 → 家族/运算集改写）后，
    // 既有规则行与新语义不再对应。仅把「锚点与当前运行时事实一致」的行计入基线 fail 门，
    // 锚点过期行改由候选派生 + apply --refresh-stale 原子替换（不手编 JSON）。
    // currentAnchor 取运行时 KC 事实（kpSem），不受 kp-matrix 陈旧影响。
    var currentAnchor = 'semantic.family=' + (kpSem && kpSem.family != null ? kpSem.family : 'null')
      + '; semantic.operations=[' + ((kpSem && kpSem.operations) || []).join(',') + ']';
    // 仅「本脚本产出的规范锚点格式（semantic.family=...）」的行参与漂移判定：
    // 历史人工/自由文本锚点（semantic.concept=...、generic-algorithm ...）属标签口径差异，
    // 其规则内容仍受基线 fail 门约束，不得被 --refresh-stale 覆盖。
    var existingRule = existingByKey[p.kp + '|' + p.qt];
    var staleAnchor = !!(existingRule && existingRule.kblAnchor.indexOf('semantic.family=') === 0
      && existingRule.kblAnchor !== currentAnchor);

    var samples = [];
    var probeSamples = [];
    var err = null;
    try {
      var session = new PracticeSession({ subject: 'math', grade: p.grade, count: N, knowledgePointId: p.kp, questionType: p.qt,
        seed: 'p25-derive|' + p.kp + '|' + p.qt });
      await session.start();
      samples = (session.semanticQuestions || []).filter(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return q.questionType === p.qt && qk === p.kp;
      });
      // P28-FIX6b 加固 A：反面采样——主窗口（auto seed）之外，用显式异种子再采 N 题。
      // 任何"主窗口全样本等值"的标量字段，若在反面样本中取到不同值，即非结构恒定量，
      // 冻结成 field 值断言必埋雷（bool/枚举/窄题空间数值同此理），降级 fieldPresent。
      var probe = new PracticeSession({ subject: 'math', grade: p.grade, count: N, knowledgePointId: p.kp, questionType: p.qt, seed: 260101 + i });
      await probe.start();
      probeSamples = (probe.semanticQuestions || []).filter(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return q.questionType === p.qt && qk === p.kp;
      });
    } catch (e) {
      err = String((e && e.message) || e).slice(0, 160);
    }

    // 字段普查聚合 + 声明聚合 + 基线证据状态
    var fieldAgg = {};   // path -> {present, values:{json:count}, types:{}}
    // probeAgg 唯一承载反面样本（始终）+ 变体采样（仅 fail/samples<2 行）：
    //   present/values              → 反面样本（所有行）
    //   variantPresent/variantValues → 变体采样专属计数（仅变体行有值，P45-NEXT-03 起单次遍历同时喂两套）
    var probeAgg = {};
    var variantSamples = 0;
    var declSets = {};   // json( relations ) -> count
    var generators = {};
    var states = {};
    var prompts = [];
    var intentConflicts = [];

    function aggregateProbe(q, asVariant) {
      var flat = {};
      census(q.data, flat, '', 3);
      Object.keys(flat).forEach(function (pth) {
        var f = flat[pth];
        if (f.t === 'object' || f.t === 'array' || f.t === 'null') return;
        if (!probeAgg[pth]) probeAgg[pth] = { present: 0, values: {} };
        probeAgg[pth].present++;
        probeAgg[pth].values[JSON.stringify(f.v)] = true;
        if (asVariant) {
          var pa = probeAgg[pth];
          if (!pa.variantPresent) { pa.variantPresent = 0; pa.variantValues = {}; }
          pa.variantPresent++;
          pa.variantValues[JSON.stringify(f.v)] = true;
        }
      });
    }
    probeSamples.forEach(function (q) { aggregateProbe(q, false); });

    samples.forEach(function (q) {
      var gen = (q.metadata && q.metadata.generator) || '?';
      generators[gen] = (generators[gen] || 0) + 1;

      var flat = {};
      census(q.data, flat, '', 3);
      Object.keys(flat).forEach(function (pth) {
        if (!fieldAgg[pth]) fieldAgg[pth] = { present: 0, values: {}, types: {} };
        var a = fieldAgg[pth];
        a.present++;
        var f = flat[pth];
        a.types[f.t] = true;
        if (f.t !== 'object' && f.t !== 'array' && f.t !== 'null') {
          var j = JSON.stringify(f.v);
          a.values[j] = (a.values[j] || 0) + 1;
        }
      });

      var decl = q.data && q.data.semanticEvidence;
      if (decl && Array.isArray(decl.relations) && decl.relations.length) {
        var key = JSON.stringify(decl.relations.slice().sort());
        declSets[key] = (declSets[key] || 0) + 1;
        // check#8 预演：声明关系越界即意图矛盾（真发现，只上报不派生）
        var conflicts = decl.relations.filter(function (r) { return allowedRels[r] === undefined; });
        if (conflicts.length && Object.keys(allowedRels).length) {
          intentConflicts.push({ generator: gen, relations: decl.relations, conflicts: conflicts });
        }
      }

      if (staleAnchor) {
        states.stale = (states.stale || 0) + 1;
      } else {
        var ev = KpSemantic.checkSemanticEvidence(q, p.kp);
        states[ev.state] = (states[ev.state] || 0) + 1;
      }
      if (prompts.length < 3 && q.prompt) prompts.push(String(q.prompt).slice(0, 80));
    });

    // P45-08（T2 锚）：主样本基线证据失败 = 该行存在多形态产出（如同一 KP×QT 的
    // 计数题 subtype=count / 命名题 subtype=angle）。追加确定性变体采样，让 probeVaries
    // 能挑战到另一形态；否则单形态值会被冻成 field 值断言，另一形态必然误报。
    // 主窗口样本 < 2 时同样不可判定「结构恒定量」（单样本恒等于自身），一并挑战。
    if (states.fail || samples.length < 2) {
      for (var _vi = 0; _vi < VARIANT_PROBE_SEEDS.length; _vi++) {
        try {
          var variantSession = new PracticeSession({ subject: 'math', grade: p.grade, count: N,
            knowledgePointId: p.kp, questionType: p.qt, seed: VARIANT_PROBE_SEEDS[_vi] });
          await variantSession.start();
          (variantSession.semanticQuestions || []).forEach(function (q) {
            var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
            if (q.questionType !== p.qt || qk !== p.kp) return;
            // P45-NEXT-03：单次 census 同时喂反面样本池与变体专属计数（不再重复遍历）
            aggregateProbe(q, true);
            variantSamples++;
          });
        } catch (e3) { /* 变体采样失败不影响主判定 */ }
      }
    }

    // ---- 候选断言派生 ----
    var flags = [];
    if (err) flags.push('gen-error');
    if (samples.length === 0) flags.push('no-sample');
    // P45-NEXT-02（T2 派生器）：确定性产出空间「形态闭合」判定，替代「samples < N 即 partial」。
    // 某些 KP×QT 的生成器有确定性产出上限（如 money 的 fill/choice 恒为 5 题，count=12 仍 5），
    // 该行永远 partial-sample，导致 apply 的 lowSample 门控永久失效、无法刷新失效字段。
    // 判定：仅对 2 ≤ samples < N 的行，用同一种子把 count 放大到 N×2 复采一次；
    //       去重后形态数不再增长 → 空间闭合（同种子确定性），标 saturated-sample 替代 partial-sample。
    // 不用异种子 probe 窗口判闭合：异种子产出本就可能不同；其字段证据已由 probeAgg 单独覆盖。
    // samples === 1 维持既有 partial/single-sample 门控不变（不在本任务扩大范围）。
    if (samples.length < N) {
      if (samples.length === 1) {
        flags.push('partial-sample');
      } else {
        var saturated = false;
        try {
          var growSession = new PracticeSession({
            subject: 'math', grade: p.grade, count: N * 2,
            knowledgePointId: p.kp, questionType: p.qt,
            seed: 'p25-derive|' + p.kp + '|' + p.qt
          });
          await growSession.start();
          var growSamples = (growSession.semanticQuestions || []).filter(function (q) {
            var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
            return q.questionType === p.qt && qk === p.kp;
          });
          saturated = growSamples.length === samples.length;
        } catch (e) { saturated = false; }
        flags.push(saturated ? 'saturated-sample' : 'partial-sample');
      }
    }
    var genIds = Object.keys(generators);
    if (genIds.length > 1) flags.push('multi-generator');

    // 确定性基线（P25 门禁同源）：会话输出确定，samples=1 表示该行 distinct 产出空间就是 1 题
    // （count:N 经会话内去重/生成器上限收敛为 1）。契约冻结成立，但须打标供人工评审。
    if (samples.length === 1) flags.push('single-sample');

    // P45-09（D2）：证据过滤盲区——PracticeSession 会按当前证据规则过滤掉「另一合法形态」
    // （如立体图形 KP 的「长方体…」与「正方体…」同时存在，后者被已有 subtype 值锚拒绝），
    // 导致 derive 只看到少量样本、把 data.graphic.* 冻成单值/恒存在锚；该锚随后在生产冻结 seed
    // 下必然误报。这里用 PracticeSession(skipValidation:true) 的原始输出（不经证据过滤）复核图形字段：
    //   1. 取值出现多值 → 非结构恒定量，按既有 probeVaries 机制降级为 fieldPresent；
    //   2. 某字段只在部分原始产出出现（如 ruler 形态无 params.length、circle 无 params.labelSides）
    //      → 存在性断言不安全，并入 absentInSome 供 apply 删除。
    // 仅复核 data.graphic.* 图形字段（D2 归因域），不扩大到整题面。
    // D16（P45-13）：raw 探针统一经 PracticeSession 单一路径（skipValidation 跳过证据/批验证），
    // 删除原 StrategyEngine.plan + GeneratorSelector + gen.generate 并行调用链。
    var rawVariantPaths = {};
    var rawAbsentPaths = {};
    if (fieldAgg['graphic.subtype']
      && genIds.length === 1 && genIds[0] === 'generator:shape-recognition') {
      try {
        var rawSeed = 'freeze:p28-v1|' + p.kp + '|' + p.qt + '|d3';
        var rawSession = new PracticeSession({
          subject: 'math', grade: p.grade, count: N, difficulty: 3,
          knowledgePointId: p.kp, questionType: p.qt, seed: rawSeed, skipValidation: true
        });
        await rawSession.start();
        var rawQs = (rawSession.semanticQuestions || []).filter(function (q) {
          var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
          return q.questionType === p.qt && qk === p.kp;
        });
        var rawAgg = {};
        var rawN = 0;
        rawQs.forEach(function (q) {
          if (!q) return;
          rawN++;
          var flat = {};
          census(q.data, flat, '', 3);
          Object.keys(flat).forEach(function (pth) {
            if (pth.indexOf('graphic.') !== 0) return;
            var f = flat[pth];
            if (f.t === 'object' || f.t === 'array' || f.t === 'null') return;
            if (!rawAgg[pth]) rawAgg[pth] = { present: 0, values: {} };
            rawAgg[pth].present++;
            rawAgg[pth].values[JSON.stringify(f.v)] = true;
          });
        });
        Object.keys(rawAgg).forEach(function (pth) {
          var ra = rawAgg[pth];
          if (ra.present < rawN) {
            rawAbsentPaths['data.' + pth] = true;
          } else if (Object.keys(ra.values).length > 1) {
            rawVariantPaths['data.' + pth] = true;
          }
        });
      } catch (e4) { /* 原始探针失败不影响派生 */ }
    }

    var stableFields = [];
    Object.keys(fieldAgg).forEach(function (pth) {
      var a = fieldAgg[pth];
      var scalarTypes = Object.keys(a.types).filter(function (t) { return t === 'string' || t === 'number' || t === 'boolean'; });
      var valKeys = Object.keys(a.values);
      if (a.present === samples.length && scalarTypes.length === 1 && valKeys.length === 1) {
        stableFields.push({ path: 'data.' + pth, value: JSON.parse(valKeys[0]), type: scalarTypes[0] });
      }
    });

    // P45-09（D2）：字段存在性证据——仅部分样本出现（0 < present < samples），
    // 供 apply 删除任何「存在性/取值」断言（该字段不是结构恒定量，另一合法形态无此字段）；
    // 全样本出现但值不恒定（不在 stableFields）的路径由 apply 按「候选无断言」判定降级。
    var absentInSome = [];
    Object.keys(fieldAgg).forEach(function (pth) {
      var a = fieldAgg[pth];
      if (a.present > 0 && a.present < samples.length) absentInSome.push('data.' + pth);
    });
    // 原始形态探针发现的「仅部分合法产出出现」的图形字段，同样计入缺失证据
    Object.keys(rawAbsentPaths).forEach(function (p) {
      if (absentInSome.indexOf(p) === -1) absentInSome.push(p);
    });

    var declKeys = Object.keys(declSets);
    var stableRelations = [];
    if (declKeys.length === 1 && declSets[declKeys[0]] === samples.length) {
      stableRelations = JSON.parse(declKeys[0]);
    } else if (declKeys.length > 1) {
      flags.push('unstable-declaration');
      // 取交集保守派生
      var inter = null;
      declKeys.forEach(function (k) {
        var s = JSON.parse(k);
        inter = inter === null ? s : inter.filter(function (r) { return s.indexOf(r) !== -1; });
      });
      stableRelations = inter || [];
    }

    // required relation 必须在允许集内（越界会让 check#8 fail，不产出）
    var hasAllowedSet = Object.keys(allowedRels).length > 0;
    var requiredRelations = stableRelations.filter(function (r) {
      if (!hasAllowedSet) return false;
      if (allowedRels[r] === undefined) { flags.push('relation-outside-allowed:' + r); return false; }
      return true;
    });
    if (requiredRelations.length && samples.length < 3) flags.push('single-sample-declaration');

    // required fields：全样本等值的标量字段（数值随题变化的字段天然不稳定，不会被选中）
    // 数值字段仅在 ≥3 个 distinct 样本下稳定时才可信（单样本数值可能是巧合值），否则丢弃打标
    // boolean 字段不产值断言：bool 仅两值，小样本"全同值"无统计意义（N=6 时概率≈3%），
    // 冻结具体值必然埋雷（P28-FIX6b：judge 题 isTrue 被冻成 true 的 flake）——降级为存在性断言
    // 任何类型的标量再经反面样本挑战：异种子窗口取到不同值即非结构恒定量，同样降级 fieldPresent
    /** P45-08：变体采样（仅基线失败行）对某字段的判定：'absent'=另一形态无此字段；'varies'=值不恒定
     *  合并后读 probeAgg 的 variantPresent/variantValues（同一份变体样本的专属计数） */
    function variantStatus(f) {
      if (!variantSamples) return null;
      var pa = probeAgg[f.path.replace(/^data\./, '')];
      if (!pa || !pa.variantPresent) return 'absent';
      if (pa.variantPresent < variantSamples) return 'absent';
      return Object.keys(pa.variantValues).some(function (j) { return j !== JSON.stringify(f.value); }) ? 'varies' : null;
    }
    function probeVaries(f) {
      if (rawVariantPaths[f.path]) return true;
      if (variantStatus(f)) return true;
      // C6 修复：probeAgg 键为 census(q.data) 产出的无前缀路径（如 graphic.subtype），
      // 而 f.path 带 data. 前缀；与 variantStatus 同口径剥离前缀，否则反面采样永不生效。
      var pa = probeAgg[f.path.replace(/^data\./, '')];
      if (!pa || !pa.present) return false;
      return Object.keys(pa.values).some(function (j) { return j !== JSON.stringify(f.value); });
    }
    var requiredFields = [];
    stableFields.forEach(function (f) {
      if (variantStatus(f) === 'absent') { flags.push('variant-absent:' + f.path); return; }
      var vary = probeVaries(f);
      if (typeof f.value === 'number') {
        if (samples.length < 3) return;
        if (vary) { flags.push('counter-sample-downgraded:' + f.path); requiredFields.push({ kind: 'fieldPresent', path: f.path }); return; }
        requiredFields.push({ kind: 'field', path: f.path, value: f.value });
        return;
      }
      if (typeof f.value === 'boolean') {
        requiredFields.push({ kind: 'fieldPresent', path: f.path });
        return;
      }
      if (vary) { flags.push('counter-sample-downgraded:' + f.path); requiredFields.push({ kind: 'fieldPresent', path: f.path }); return; }
      requiredFields.push({ kind: 'field', path: f.path, value: f.value });
    });
    if (stableFields.some(function (f) { return typeof f.value === 'number'; }) && samples.length < 3) {
      flags.push('numeric-stable-field-dropped');
    }

    // forbidden：跨家族守卫（KBL 派生，不依赖样本）
    var forbidden = [];
    var opsN = kpOpsNorm(kpSem && kpSem.operations);
    if (opsN.length && opsN.indexOf('mixed') === -1) {
      ['add', 'sub', 'mult', 'div'].forEach(function (op) {
        if (opsN.indexOf(op) === -1) forbidden.push({ kind: 'fieldNot', path: 'data.operation', value: op });
      });
    }
    var relRequiredSet = {};
    requiredRelations.forEach(function (r) { relRequiredSet[r] = true; });
    crossFamilyForbidden(kpSem).forEach(function (r) {
      if (!relRequiredSet[r]) forbidden.push({ kind: 'relationNot', relation: r });
    });

    var ruleable = (requiredFields.length + requiredRelations.length) >= 1;
    if (!ruleable && samples.length) flags.push('no-stable-evidence');
    if (existingKeys[p.kp + '|' + p.qt]) flags.push('existing-rule-kept');
    if (staleAnchor) flags.push('stale-anchor');

    rows.push({
      kp: p.kp,
      name: kpMeta ? kpMeta.name : null,
      family: (kpMeta && kpMeta.semanticFamily) || (kpSem && kpSem.family) || null,
      operations: (kpMeta && kpMeta.operations) || [],
      grade: p.grade,
      qt: p.qt,
      generators: generators,
      samples: samples.length,
      baselineStates: states,
      declaredRelations: declKeys.map(function (k) { return { relations: JSON.parse(k), count: declSets[k] }; }),
      allowedRelations: Object.keys(allowedRels),
      stableFields: stableFields,
      absentInSome: absentInSome,
      intentConflicts: intentConflicts.slice(0, 3),
      kblAnchor: currentAnchor,
      staleAnchor: staleAnchor,
      candidate: ruleable ? {
        knowledgePointId: p.kp,
        knowledgePointName: kpMeta ? kpMeta.name : undefined,
        questionType: p.qt,
        kblAnchor: currentAnchor,
        required: requiredRelations.map(function (r) { return { kind: 'relation', relation: r }; }).concat(requiredFields),
        forbidden: forbidden
      } : null,
      flags: flags,
      samplePrompts: prompts
    });

    done++;
    if (done % 40 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  // ---- 汇总 ----
  var summary = {
    aKps: aKps.length,
    pairs: pairs.length,
    genError: 0, noSample: 0, partial: 0, saturated: 0, ruleable: 0, notRuleable: 0, existingKept: 0,
    counterDowngraded: 0,
    baseline: { pass: 0, warn: 0, skip: 0, fail: 0 },
    intentConflictRows: 0,
    byQt: {}
  };
  rows.forEach(function (r) {
    if (r.flags.indexOf('gen-error') !== -1) summary.genError++;
    if (r.flags.indexOf('no-sample') !== -1) summary.noSample++;
    if (r.flags.indexOf('partial-sample') !== -1) summary.partial++;
    if (r.flags.indexOf('saturated-sample') !== -1) summary.saturated++;
    if (r.candidate) summary.ruleable++; else summary.notRuleable++;
    if (r.flags.indexOf('existing-rule-kept') !== -1) summary.existingKept++;
    if (r.intentConflicts.length) summary.intentConflictRows++;
    if (r.flags.some(function (f) { return f.indexOf('counter-sample-downgraded:') === 0; })) summary.counterDowngraded++;
    Object.keys(r.baselineStates).forEach(function (s) { summary.baseline[s] = (summary.baseline[s] || 0) + r.baselineStates[s]; });
    summary.byQt[r.qt] = (summary.byQt[r.qt] || 0) + 1;
  });

  var outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'evidence-derive-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    schemaVersion: 'p26-evidence-derive.2',
    generatedAt: new Date().toISOString(),
    sampling: { n: N, counterSample: { n: N, seedBase: 260101, note: '显式异种子反面采样，挑战字段恒定性' },
      growthProbe: { n: N * 2, note: 'P45-NEXT-02 同种子放大复采，去重形态数不再增长即判空间闭合（saturated-sample）' } },
    builtFrom: {
      aClass: 'kbl/teaching/kp-matrix.json draftSemanticLevel=A',
      allow: 'KCV.buildEligibility ALLOW 动态枚举（同 dev/check-allow-generation.js）',
      relations: 'kbl/teaching/intent-relations.json',
      existing: 'kbl/teaching/evidence-rules.json ' + evidenceRules.schemaVersion
    },
    summary: summary,
    rows: rows
  }, null, 2) + '\n');

  console.log('A 类 KP：' + summary.aKps + '，ALLOW 行：' + summary.pairs);
  console.log('可派生候选行：' + summary.ruleable + '，无稳定证据行：' + summary.notRuleable + '，已有规则保留：' + summary.existingKept);
  console.log('反面采样降级行：' + summary.counterDowngraded + '（field 值断言→fieldPresent）');
  console.log('基线证据状态分布：' + JSON.stringify(summary.baseline));
  console.log('生成失败行：' + summary.genError + '，无样本行：' + summary.noSample + '，意图矛盾行：' + summary.intentConflictRows);
  console.log('报告：' + outPath);
  rows.filter(function (r) { return r.flags.indexOf('gen-error') !== -1; }).slice(0, 20).forEach(function (r) {
    console.log('  GEN-ERROR ' + r.kp + '×' + r.qt);
  });

  // P28-FIX6b 加固 B：基线 fail 硬闸门——任何真实样本不满足既有规则即退出非零，
  // 概率性错误契约（如 bool 被冻成固定值）不得静默混入派生流程。
  if (summary.baseline.fail > 0) {
    console.error('[derive] 基线证据 fail = ' + summary.baseline.fail + '（必须为 0）；相关行：');
    rows.filter(function (r) { return (r.baselineStates.fail || 0) > 0; }).slice(0, 20).forEach(function (r) {
      console.error('  FAIL ' + r.kp + '×' + r.qt + ' ' + JSON.stringify(r.baselineStates) + ' flags=' + JSON.stringify(r.flags));
    });
    process.exit(1);
  }
})().catch(function (e) {
  console.error('派生失败：', e);
  process.exit(1);
});
