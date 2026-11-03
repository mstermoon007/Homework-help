#!/usr/bin/env node
'use strict';
// dev/p25/apply-evidence-candidates.js — P26 evidence 全量扩建·候选合并
//
// 将 derive-evidence-candidates.js 的审后候选合并进 kbl/teaching/evidence-rules.json：
//   - 既有规则行（P25-04 的 6 行）原样保留，键冲突即失败（不静默覆盖）
//     --refresh-stale：仅当既有行 kblAnchor 与候选锚点不一致（KBL 语义事实已漂移）时，
//     用同一候选原子替换该行（P44-H9 口径：锚点过期 = 规则失效，须随派生链刷新，禁止手编）。
//     --refresh-stale-fields=<gen...>：既有行 required 引用了当前候选已不存在的字段路径
//     （字段形态/语义已变化，旧断言必然 fail），且该行真实生成器全部在给定范围内时，
//     用同一候选原子替换该行（禁止手编）。范围必须显式给出：字段消亡的因果只在被改动的
//     生成器身上，其它生成器（如 shape-recognition）的单样本/部分样本候选会把锚点误收紧。
//     --prune-stale-fields=<gen...>：同上判定，但只删除候选里已不存在的 required 断言，
//     不整行替换、不新增断言（P45-19）。用于确定性产出空间 < N、被判定为 partial-sample 的
//     合法行（如 money-measurement 的 fill/choice 恒为 5 题）：删除不引入未采样断言，
//     故不受 lowSample 门控限制。
//     --refresh-incomplete=<gen...>：既有 required 是候选 required 的严格子集（只缺断言、无失效/
//     冲突断言，forbidden 完全相同）且样本充分时，原子替换为候选行（P45-NEXT-01）——语义等价于
//     纯追加断言；受 lowSample 门控（未充分采样的行不得补断言）。
//   - 新增行为 75 个 A 类 KP × ALLOW 题型的机械派生契约（真值源见报告 builtFrom）
//   - schemaVersion 升级；note 记录派生口径与四态语义不变
//
// 断言合法性闸门（写入前全量校验，任一失败即退出非零）：
//   kind ∈ {field, fieldNot, relation, relationNot}；键不重复；required ≥ 1；
//   KP 在 A 类清单内；题型合法；relation 断言必须在 intent-relations 允许集内；
//   relationNot 必须在跨家族禁表内；同一行 required/forbidden 无键冲突。
//
// 用法：node dev/p25/apply-evidence-candidates.js [--report <path>] [--refresh-stale] [--refresh-stale-fields=<gen...>] [--refresh-value-drift=<gen...>] [--prune-stale-fields=<gen...>] [--refresh-incomplete=<gen...>]

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var REPORT = path.join(__dirname, 'reports', 'evidence-derive-report.json');
var iArg = process.argv.indexOf('--report');
if (iArg !== -1 && process.argv[iArg + 1]) REPORT = path.resolve(process.argv[iArg + 1]);
var REFRESH_STALE = process.argv.indexOf('--refresh-stale') !== -1;
// null = 不刷新字段锚；数组 = 仅当该行生成器全部命中此范围时才刷新（P45-05 收窄口径）
var REFRESH_FIELD_SCOPE = null;
process.argv.forEach(function (a) {
  if (a.indexOf('--refresh-stale-fields') !== 0) return;
  var eq = a.indexOf('=');
  REFRESH_FIELD_SCOPE = eq === -1 ? [] : a.slice(eq + 1).split(',').filter(Boolean);
});
// P45-08（T2 锚）：值漂移刷新范围——仅当该行真实生成器全部命中时，把派生器已实证
// 「非结构恒定量」（flags 含 counter-sample-downgraded:<path>）的 field 值断言原位降级为
// fieldPresent，其余断言与 forbidden 原样保留（不整行替换，避免收紧/放开无关字段）。
var REFRESH_VALUE_SCOPE = null;
process.argv.forEach(function (a) {
  if (a.indexOf('--refresh-value-drift') !== 0) return;
  var eq = a.indexOf('=');
  REFRESH_VALUE_SCOPE = eq === -1 ? [] : a.slice(eq + 1).split(',').filter(Boolean);
});
// P45-19（T2 锚）：stale 字段纯删除范围——只删既有行 required 中「候选已完全不存在的字段路径」，
// 不整行替换、不新增断言（因此不受 lowSample 门控限制：删除不会写入未采样的新断言）。
var PRUNE_FIELD_SCOPE = null;
process.argv.forEach(function (a) {
  if (a.indexOf('--prune-stale-fields') !== 0) return;
  var eq = a.indexOf('=');
  PRUNE_FIELD_SCOPE = eq === -1 ? [] : a.slice(eq + 1).split(',').filter(Boolean);
});
// P45-NEXT-01（T2 锚）：规则补全范围——既有 required 是候选 required 的严格子集（kind+path+value
// 全部原样存在，且候选断言更多）、forbidden 完全相同、样本充分时，原子替换为候选行。
// 语义等价于「纯追加断言」：不修改、不删除任何既有断言（失效路径另有 refresh/prune 通道处理）。
var INCOMPLETE_SCOPE = null;
process.argv.forEach(function (a) {
  if (a.indexOf('--refresh-incomplete') !== 0) return;
  var eq = a.indexOf('=');
  INCOMPLETE_SCOPE = eq === -1 ? [] : a.slice(eq + 1).split(',').filter(Boolean);
});

var RULES_PATH = path.join(ROOT, 'kbl', 'teaching', 'evidence-rules.json');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));
var intentRelations = require(path.join(ROOT, 'kbl', 'teaching', 'intent-relations.json'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

var QT_IDS = {};
QTR.TYPES.forEach(function (t) { QT_IDS[t.id] = true; });
var KINDS = ['field', 'fieldNot', 'fieldPresent', 'relation', 'relationNot'];

var aIds = {};
matrix.kps.forEach(function (k) { if (k.draftSemanticLevel === 'A') aIds[k.id] = k; });

var report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
var doc = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));

function fail(msg) {
  console.error('[P26-apply] INVARIANT FAIL: ' + msg);
  process.exit(1);
}

if (REFRESH_FIELD_SCOPE && !REFRESH_FIELD_SCOPE.length) {
  fail('--refresh-stale-fields 必须显式给出生成器范围，如 --refresh-stale-fields=generator:money-measurement');
}
if (REFRESH_VALUE_SCOPE && !REFRESH_VALUE_SCOPE.length) {
  fail('--refresh-value-drift 必须显式给出生成器范围，如 --refresh-value-drift=generator:shape-recognition');
}
if (PRUNE_FIELD_SCOPE && !PRUNE_FIELD_SCOPE.length) {
  fail('--prune-stale-fields 必须显式给出生成器范围，如 --prune-stale-fields=generator:money-measurement');
}
if (INCOMPLETE_SCOPE && !INCOMPLETE_SCOPE.length) {
  fail('--refresh-incomplete 必须显式给出生成器范围，如 --refresh-incomplete=generator:money-measurement');
}

// ---------- 断言合法性校验 ----------
var FORBIDDEN_SIDES = intentRelations.forbiddenAcrossFamilies || {};

/** KP 语义视图 + 对侧家族判定：与 derive-evidence-candidates.js crossFamilyForbidden 逐字同构（勿单方修改） */
function kpSemanticOf(kpId) {
  var kp = KC.get(kpId);
  if (!kp) return null;
  var sem = kp.semantic || {};
  return { family: sem.family || null, type: kp.type || null, operations: sem.operations || [] };
}
function sideOf(kpId) {
  var kpSem = kpSemanticOf(kpId);
  if (!kpSem) return null;
  if (kpSem.type === 'geometry' || kpSem.family === 'geometry') return 'geometry';
  if (kpSem.type === 'calculation' ||
    kpSem.family === 'multiplication-division' || kpSem.family === 'fraction' ||
    kpSem.family === 'decimal' || kpSem.family === 'percent') return 'algebra-arithmetic';
  return null;
}

var seen = {}; // key -> doc.rules 下标
doc.rules.forEach(function (r, idx) {
  var key = r.knowledgePointId + '|' + r.questionType;
  if (seen[key] !== undefined) fail('既有规则键重复: ' + key);
  seen[key] = idx;
});

var added = 0;
var refreshed = 0;
var refreshedFields = 0;
var refreshedValueDrift = 0;
var prunedFields = 0;
var refreshedIncomplete = 0;
var skipped = 0;
(report.rows || []).forEach(function (row) {
  if (!row.candidate) return;
  var c = row.candidate;
  var key = c.knowledgePointId + '|' + c.questionType;

  if (!aIds[c.knowledgePointId]) fail('KP 不在 A 类清单: ' + c.knowledgePointId);
  if (!QT_IDS[c.questionType]) fail('非法题型: ' + key);

  // 校验前置：刷新行同样必须过全部断言合法性闸门
  if (!Array.isArray(c.required) || c.required.length < 1) fail('required 为空: ' + key);
  var reqKeys = {};
  var relAllowed = {};
  (row.allowedRelations || []).forEach(function (r) { relAllowed[r] = true; });
  var side = sideOf(c.knowledgePointId);
  var sideForbidden = side ? (FORBIDDEN_SIDES[side] || []) : null;

  (c.required || []).concat(c.forbidden || []).forEach(function (a) {
    if (KINDS.indexOf(a.kind) === -1) fail('非法 kind: ' + key + ' ← ' + a.kind);
    if (a.kind === 'field' || a.kind === 'fieldNot' || a.kind === 'fieldPresent') {
      if (typeof a.path !== 'string' || a.path.indexOf('data.') !== 0) fail('field 路径必须以 data. 开头: ' + key);
    }
    if (a.kind === 'relation') {
      if (!relAllowed[a.relation]) fail('required relation 不在允许集: ' + key + ' ← ' + a.relation);
    }
    if (a.kind === 'relationNot') {
      if (!sideForbidden || sideForbidden.indexOf(a.relation) === -1) fail('relationNot 不在对侧禁表: ' + key + ' ← ' + a.relation);
    }
    var ak = a.kind + ':' + (a.relation || a.path) + ':' + JSON.stringify(a.value === undefined ? null : a.value);
    if (reqKeys[ak]) fail('行内断言重复: ' + key + ' ← ' + ak);
    reqKeys[ak] = true;
  });
  // required relation 与 forbidden relationNot 不得互相矛盾
  var reqRels = {};
  (c.required || []).forEach(function (a) { if (a.kind === 'relation') reqRels[a.relation] = true; });
  (c.forbidden || []).forEach(function (a) {
    if (a.kind === 'relationNot' && reqRels[a.relation]) fail('required 与 forbidden 矛盾: ' + key + ' ← ' + a.relation);
  });

  var nextRule = {
    knowledgePointId: c.knowledgePointId,
    knowledgePointName: c.knowledgePointName,
    questionType: c.questionType,
    kblAnchor: c.kblAnchor,
    required: c.required,
    forbidden: c.forbidden
  };

  var prevIdx = seen[key];
  if (prevIdx !== undefined) {
    var prev = doc.rules[prevIdx];
    if (REFRESH_STALE && prev.kblAnchor.indexOf('semantic.family=') === 0
      && prev.kblAnchor !== c.kblAnchor) {
      doc.rules[prevIdx] = nextRule;   // 锚点过期：原子替换为当前语义事实派生行
      refreshed++;
      return;
    }
    // 旧断言引用了当前候选已不存在的字段路径（字段形态/语义已变化）→ 整行刷新
    var candPaths = {};
    (c.required || []).forEach(function (a) { if (a.path) candPaths[a.path] = true; });
    var staleField = (prev.required || []).some(function (a) {
      return a.path && !candPaths[a.path];
    });
    // 仅当该行真实生成器全部落在本次改动的生成器范围内才刷新：
    // 其它生成器的 stale 路径来自样本波动或历史遗留，按候选收紧锚点会误伤（P45-05 实证 6f 回归）。
    var rowGens = Object.keys(row.generators || {});
    var inScope = REFRESH_FIELD_SCOPE && rowGens.length > 0 && rowGens.every(function (g) {
      return REFRESH_FIELD_SCOPE.indexOf(g) !== -1;
    });
    // P45-17-FIX：partial/single-sample 行的 candidate 不可靠——样本 < N 时派生器无法判定字段是否真正恒定，
    // 原子替换会把 counter-sample-downgraded 实证的「非结构恒定量」写进规则，导致生产产出不满足。
    // 跳过样本不足行；锚点漂移（--refresh-stale）不受此门控——锚点是 KBL 语义事实变更，与样本质量无关。
    var flags = row.flags || [];
    var lowSample = flags.indexOf('partial-sample') !== -1 || flags.indexOf('single-sample') !== -1;
    if (inScope && staleField && !lowSample) {
      doc.rules[prevIdx] = nextRule;
      refreshedFields++;
      return;
    }
    // P45-08：值漂移刷新的范围判定（与字段锚刷新用各自的显式范围，互不借用）
    var valueInScope = REFRESH_VALUE_SCOPE && rowGens.length > 0 && rowGens.every(function (g) {
      return REFRESH_VALUE_SCOPE.indexOf(g) !== -1;
    });
    // P45-08（T2 锚）：字段值本身漂移（路径仍存在，但派生器已实证该值非结构恒定量）。
    // 只把 flags 明确点名的断言原位降级为 fieldPresent，其余断言原样保留。
    if (valueInScope) {
      var downgradedPaths = {};
      var absentPaths = {};
      (row.flags || []).forEach(function (f) {
        var downPre = 'counter-sample-downgraded:';
        var absentPre = 'variant-absent:';
        if (f.indexOf(downPre) === 0) downgradedPaths[f.slice(downPre.length)] = true;
        if (f.indexOf(absentPre) === 0) absentPaths[f.slice(absentPre.length)] = true;
      });
      var changed = 0;
      // P45-09（D2）：字段存在性证据——变体采样 variant-absent 或主样本窗口 present < samples
      // 已实证该路径只在部分合法产出中出现，则「取值/存在性」断言一律删除：该字段不是结构恒定量，
      // 保留任何断言都会让另一合法形态必然 fail。
      var absentInSomePaths = {};
      (row.absentInSome || []).forEach(function (p) { absentInSomePaths[p] = true; });
      // 删除该值断言（其余断言原样保留）
      var keptRequired = (prev.required || []).filter(function (a) {
        if (a.path && (absentPaths[a.path] || absentInSomePaths[a.path])) { changed++; return false; }
        return true;
      });
      if (keptRequired.length !== (prev.required || []).length) prev.required = keptRequired;
      (prev.required || []).forEach(function (a, ai) {
        if (a.kind !== 'field' || !a.path || !downgradedPaths[a.path]) return;
        var candPresent = (c.required || []).some(function (x) {
          return x.kind === 'fieldPresent' && x.path === a.path;
        });
        if (!candPresent) return;
        prev.required[ai] = { kind: 'fieldPresent', path: a.path };
        changed++;
      });
      // P45-09（D2，用户授权）：既有值断言与当前派生产出不再一致（候选同路径断言取值不同，
      // 或候选只声明存在性——该值在多形态产出中非恒定），原位降级为 fieldPresent；
      // 只降级取值的判据，不删路径、不改 forbidden，避免把「值错了」当成「字段没了」。
      var candValByPath = {};
      var candPresentByPath = {};
      (c.required || []).forEach(function (x) {
        if (!x.path) return;
        if (x.kind === 'field') candValByPath[x.path] = JSON.stringify(x.value === undefined ? null : x.value);
        if (x.kind === 'fieldPresent') candPresentByPath[x.path] = true;
      });
      (prev.required || []).forEach(function (a, ai) {
        if (a.kind !== 'field' || !a.path) return;
        var prevVal = JSON.stringify(a.value === undefined ? null : a.value);
        var candAsserts = candValByPath[a.path] !== undefined || !!candPresentByPath[a.path];
        var mismatch = candValByPath[a.path] !== undefined
          ? candValByPath[a.path] !== prevVal
          : !!candPresentByPath[a.path];
        // 候选对该路径完全无断言、且该路径出现在全部样本（非 absentInSome）：
        // 说明值在多形态产出中不恒定（或样本次数不足），只剩「存在」可证，降级为 fieldPresent。
        // 仅对枚举型（字符串）取值放宽；数值稳定字段被小样本丢弃时保留原值断言（数值仍可复现）。
        if (!candAsserts && !absentInSomePaths[a.path] && typeof a.value === 'string') mismatch = true;
        if (!mismatch) return;
        prev.required[ai] = { kind: 'fieldPresent', path: a.path };
        changed++;
      });
      if (changed) {
        refreshedValueDrift += changed;
        return;
      }
    }
    // P45-19：字段消亡的纯删除通道（--prune-stale-fields=<gen...>）。
    // 只删除候选里已不存在的 required 断言，不整行替换、不新增断言；因此不受 lowSample 门控限制
    // （删除不引入未采样断言），用于 fill/choice 这类确定性产出空间 < N 的合法行
    // （P45-NEXT-02 起同种子放大复采可判 saturated-sample，届时该行走 refresh 通道）。
    var pruneInScope = PRUNE_FIELD_SCOPE && rowGens.length > 0 && rowGens.every(function (g) {
      return PRUNE_FIELD_SCOPE.indexOf(g) !== -1;
    });
    if (pruneInScope && staleField) {
      var before = (prev.required || []).length;
      var kept = (prev.required || []).filter(function (a) { return !(a.path && !candPaths[a.path]); });
      // 至少保留 1 条断言：required 为空不是合法规则（与写入前校验口径一致）
      if (kept.length !== before && kept.length >= 1) {
        prev.required = kept;
        prunedFields += before - kept.length;
        return;
      }
    }
    // P45-NEXT-01：规则补全通道（--refresh-incomplete=<gen...>）。
    // 前置：无失效字段（staleField=false，失效路径交给 refresh/prune）、样本充分（非 partial/single-sample）。
    // 判定：既有 required 每条断言都在候选中原样存在（kind+path+value 全等）且候选断言更多，
    // 同时 forbidden 集合完全相同；满足则整行替换为候选（等价于纯追加断言）。
    var incompleteInScope = INCOMPLETE_SCOPE && rowGens.length > 0 && rowGens.every(function (g) {
      return INCOMPLETE_SCOPE.indexOf(g) !== -1;
    });
    if (incompleteInScope && !staleField && !lowSample) {
      var assertKeyOf = function (a) {
        return a.kind + ':' + (a.path || a.relation) + ':' + JSON.stringify(a.value === undefined ? null : a.value);
      };
      var candAssertKeys = {};
      (c.required || []).forEach(function (a) { candAssertKeys[assertKeyOf(a)] = true; });
      var prevIsSubset = (prev.required || []).every(function (a) { return candAssertKeys[assertKeyOf(a)]; });
      var prevFb = (prev.forbidden || []).map(assertKeyOf).sort().join('|');
      var candFb = (c.forbidden || []).map(assertKeyOf).sort().join('|');
      var grow = (c.required || []).length - (prev.required || []).length;
      if (prevIsSubset && prevFb === candFb && grow > 0) {
        doc.rules[prevIdx] = nextRule;
        refreshedIncomplete++;
        return;
      }
    }
    skipped++;                        // 既有规则保留（保守：不覆盖人工规则）
    return;
  }
  doc.rules.push(nextRule);
  seen[key] = doc.rules.length - 1;
  added++;
});

// A 类规则范围收敛：报告 rows 枚举与 A 类 ALLOW 行同源；不在报告中的 A 类规则
// （其 ALLOW 行已被源数据移除，如 H9 后 k001 的 geometry/judge）为无消费者的死规则，
// 物理剔除（脚本化清理，不手编 JSON）。B/C 规则由 derive-bc-evidence-rules.js 维护，不动。
var reportKeys = {};
(report.rows || []).forEach(function (row) { reportKeys[row.kp + '|' + row.qt] = true; });
var pruned = 0;
doc.rules = doc.rules.filter(function (r) {
  if (!aIds[r.knowledgePointId]) return true;
  if (reportKeys[r.knowledgePointId + '|' + r.questionType]) return true;
  pruned++;
  return false;
});

// ---------- 稳定排序 + 写出 ----------
doc.rules.sort(function (a, b) {
  return a.knowledgePointId === b.knowledgePointId
    ? (a.questionType < b.questionType ? -1 : 1)
    : (a.knowledgePointId < b.knowledgePointId ? -1 : 1);
});

doc.schemaVersion = 'p26-evidence.3';
doc.note = 'P25-04 起步（4 代表 KP 人工规则），P26 扩建为 A 类全量（' + Object.keys(aIds).length +
  ' KP × ALLOW 题型，机械派生）；P28-FIX6 后 A 类扩至 313（6 个误绑 B 类 KP 升 A 重绑 concept-meaning）。' +
  'B/C 类通用算法规则（relationAny/constructAny 形态，247 行）由 tools/kbl/derive-bc-evidence-rules.js 独立维护，本脚本只增补缺 A 类行、不动 B/C 行。' +
  '派生真值源：dev/p25/reports/evidence-derive-report.json' +
  '（真实生成产出字段稳定性 + KBL 语义事实跨家族守卫），派生脚本 dev/p25/derive-evidence-candidates.js，' +
  '合并闸门 dev/p25/apply-evidence-candidates.js。断言 kind：A 类仅 field/fieldNot/relation/relationNot；' +
  'B/C 类另有 relationAny/constructAny（算法类型∈允许集正面断言）。' +
  'required relation 均经 intent-relations 允许集过滤（与 validator check#8 同源）。' +
  '消费方：shared/validator/kp-semantic-validator.js checkSemanticEvidence；' +
  '供给方：generator 在 sq.data.semanticEvidence 中按题声明 {relations:[],constructs:[]}。' +
  '四态不变：skip=无规则行 / warn=有规则未声明（过渡期）/ pass=声明齐且 required 全满足 / fail=required 缺或 forbidden 命中。' +
  'P44-H9：--refresh-stale 按锚点漂移原子替换失效行（不改 B/C 行、不手编语义）。' +
  'P45-08：--refresh-value-drift=<gen...> 按派生器 counter-sample-downgraded 实证，把非结构恒定量的 field 值断言原位降级为 fieldPresent（其余断言不动）。' +
  'P45-19：--prune-stale-fields=<gen...> 只删除候选已不存在的 required 字段断言（不整行替换、不新增断言），用于确定性产出空间 < N 的合法行。' +
  'P45-NEXT-01：--refresh-incomplete=<gen...> 在既有 required 为候选严格子集且样本充分时整行替换（纯追加断言）。';

fs.writeFileSync(RULES_PATH, JSON.stringify(doc, null, 2) + '\n');

console.log('既有规则保留：' + (doc.rules.length - added) + ' 行，新增：' + added + ' 行，锚点刷新：' + refreshed + ' 行，字段锚刷新：' + refreshedFields + ' 行，值漂移降级断言：' + refreshedValueDrift + ' 条，失效字段剔除：' + prunedFields + ' 条，规则补全：' + refreshedIncomplete + ' 行，死规则剔除：' + pruned + ' 行，键冲突跳过：' + skipped);
console.log('总规则行：' + doc.rules.length + '，覆盖 KP：' + new Set(doc.rules.map(function (r) { return r.knowledgePointId; })).size);
console.log('schemaVersion：' + doc.schemaVersion);
console.log('写入：' + RULES_PATH);
