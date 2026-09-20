#!/usr/bin/env node
'use strict';
// dev/p25/apply-evidence-candidates.js — P26 evidence 全量扩建·候选合并
//
// 将 derive-evidence-candidates.js 的审后候选合并进 kbl/teaching/evidence-rules.json：
//   - 既有规则行（P25-04 的 6 行）原样保留，键冲突即失败（不静默覆盖）
//   - 新增行为 75 个 A 类 KP × ALLOW 题型的机械派生契约（真值源见报告 builtFrom）
//   - schemaVersion 升级；note 记录派生口径与四态语义不变
//
// 断言合法性闸门（写入前全量校验，任一失败即退出非零）：
//   kind ∈ {field, fieldNot, relation, relationNot}；键不重复；required ≥ 1；
//   KP 在 A 类清单内；题型合法；relation 断言必须在 intent-relations 允许集内；
//   relationNot 必须在跨家族禁表内；同一行 required/forbidden 无键冲突。
//
// 用法：node dev/p25/apply-evidence-candidates.js [--report <path>]

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var REPORT = path.join(__dirname, 'reports', 'evidence-derive-report.json');
var iArg = process.argv.indexOf('--report');
if (iArg !== -1 && process.argv[iArg + 1]) REPORT = path.resolve(process.argv[iArg + 1]);

var RULES_PATH = path.join(ROOT, 'kbl', 'teaching', 'evidence-rules.json');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));
var intentRelations = require(path.join(ROOT, 'kbl', 'teaching', 'intent-relations.json'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

var QT_IDS = {};
QTR.TYPES.forEach(function (t) { QT_IDS[t.id] = true; });
var KINDS = ['field', 'fieldNot', 'relation', 'relationNot'];

var aIds = {};
matrix.kps.forEach(function (k) { if (k.draftSemanticLevel === 'A') aIds[k.id] = k; });

var report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
var doc = JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));

function fail(msg) {
  console.error('[P26-apply] INVARIANT FAIL: ' + msg);
  process.exit(1);
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

var seen = {};
doc.rules.forEach(function (r) {
  var key = r.knowledgePointId + '|' + r.questionType;
  if (seen[key]) fail('既有规则键重复: ' + key);
  seen[key] = true;
});

var added = 0;
var skipped = 0;
(report.rows || []).forEach(function (row) {
  if (!row.candidate) return;
  var c = row.candidate;
  var key = c.knowledgePointId + '|' + c.questionType;

  if (!aIds[c.knowledgePointId]) fail('KP 不在 A 类清单: ' + c.knowledgePointId);
  if (!QT_IDS[c.questionType]) fail('非法题型: ' + key);
  if (seen[key]) { skipped++; return; } // 既有规则保留（保守：不覆盖人工规则）

  if (!Array.isArray(c.required) || c.required.length < 1) fail('required 为空: ' + key);
  var reqKeys = {};
  var relAllowed = {};
  (row.allowedRelations || []).forEach(function (r) { relAllowed[r] = true; });
  var side = sideOf(c.knowledgePointId);
  var sideForbidden = side ? (FORBIDDEN_SIDES[side] || []) : null;

  (c.required || []).concat(c.forbidden || []).forEach(function (a) {
    if (KINDS.indexOf(a.kind) === -1) fail('非法 kind: ' + key + ' ← ' + a.kind);
    if (a.kind === 'field' || a.kind === 'fieldNot') {
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

  doc.rules.push({
    knowledgePointId: c.knowledgePointId,
    knowledgePointName: c.knowledgePointName,
    questionType: c.questionType,
    kblAnchor: c.kblAnchor,
    required: c.required,
    forbidden: c.forbidden
  });
  seen[key] = true;
  added++;
});

// ---------- 稳定排序 + 写出 ----------
doc.rules.sort(function (a, b) {
  return a.knowledgePointId === b.knowledgePointId
    ? (a.questionType < b.questionType ? -1 : 1)
    : (a.knowledgePointId < b.knowledgePointId ? -1 : 1);
});

doc.schemaVersion = 'p26-evidence.1';
doc.note = 'P25-04 起步（4 代表 KP 人工规则），P26 扩建为 A 类全量（' + aIds.length +
  ' KP × ALLOW 题型，机械派生）。派生真值源：dev/p25/reports/evidence-derive-report.json' +
  '（真实生成产出字段稳定性 + KBL 语义事实跨家族守卫），派生脚本 dev/p25/derive-evidence-candidates.js，' +
  '合并闸门 dev/p25/apply-evidence-candidates.js。断言 kind 仅 field/fieldNot/relation/relationNot；' +
  'required relation 均经 intent-relations 允许集过滤（与 validator check#8 同源）。' +
  '消费方：shared/validator/kp-semantic-validator.js checkSemanticEvidence；' +
  '供给方：generator 在 sq.data.semanticEvidence 中按题声明 {relations:[],constructs:[]}。' +
  '四态不变：skip=无规则行 / warn=有规则未声明（过渡期）/ pass=声明齐且 required 全满足 / fail=required 缺或 forbidden 命中。';

fs.writeFileSync(RULES_PATH, JSON.stringify(doc, null, 2) + '\n');

console.log('既有规则保留：' + (doc.rules.length - added) + ' 行，新增：' + added + ' 行，键冲突跳过：' + skipped);
console.log('总规则行：' + doc.rules.length + '，覆盖 KP：' + new Set(doc.rules.map(function (r) { return r.knowledgePointId; })).size);
console.log('schemaVersion：' + doc.schemaVersion);
console.log('写入：' + RULES_PATH);
