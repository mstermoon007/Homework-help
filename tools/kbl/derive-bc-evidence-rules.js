#!/usr/bin/env node
'use strict';
// tools/kbl/derive-bc-evidence-rules.js — P28 B/C 通用算法 KP 语义证据规则派生
//
// 目标：为 draftSemanticLevel≠A 的"通用算法 KP"补 kbl/teaching/evidence-rules.json 规则行，
//   让 307 A（概念族）之外的通用算法题也达到 SEMANTIC_PASS，而非 204/204 能生成却全 skip。
//
// 语义口径（不绑定进位/退位/竖式等特定方法，直接用通用算法类型）：
//   Generator（shared/generator/core/semantic-evidence.js）按题 data.operation 兜底声明
//   constructs = addition/subtraction/multiplication/division；'mixed' 按 KP 显式列出的
//   基础运算展开（纯 ['mixed'] 才放开四则）。本脚本与该口径严格同源。
//
// 红线（证据不得虚构）：规则只在"真实生成的每一道题"都满足下列条件时才产出，否则跳过该
//   KP×题型（保持 skip，不用规则粉饰题面与 KP 语义不符的绑定缺陷）：
//     1) data.operation 在场（fieldPresent）；
//     2) 声明 relations 与 KP semantic.operations 允许关系集"有交集"（relationAny）；
//     3) 声明 constructs 与允许构件集"有交集"（constructAny）；
//     4) 题面声明的四则关系/构件不越出允许集（无 intent 冲突）。
//
// 幂等：以 kpId|qt 为键，写盘时剔除本批 B/C KP 的全部旧规则后再追加，可安全重跑；
//   A 类 1299 条规则原样保留。
//
// 用法：node tools/kbl/derive-bc-evidence-rules.js [--n 4] [--write]
//   不带 --write 只预演打印；带 --write 才合并写盘。

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

var N = 4;
var argN = process.argv.indexOf('--n');
if (argN !== -1 && process.argv[argN + 1]) N = Math.max(2, parseInt(process.argv[argN + 1], 10) || 4);
var WRITE = process.argv.indexOf('--write') !== -1;

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var matrixPath = path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json');
var rulesPath = path.join(ROOT, 'kbl', 'teaching', 'evidence-rules.json');
var matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
var doc = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

var OPN = { addition: 'add', subtraction: 'sub', multiplication: 'mult', division: 'div' };
var BASE4 = ['add', 'sub', 'mult', 'div'];
var REL = { add: 'add-combine', sub: 'sub-take-away', mult: 'multiply-by-times', div: 'divide-share' };
var CON = { add: 'addition', sub: 'subtraction', mult: 'multiplication', div: 'division' };
var ALL_REL = BASE4.map(function (o) { return REL[o]; });
var ALL_CON = BASE4.map(function (o) { return CON[o]; });

function uniq(a) { return a.filter(function (x, i) { return a.indexOf(x) === i; }); }
function gradeOf(id) { var x = String(id).match(/math-g(\d)/); return x ? +x[1] : 1; }

/** KP 允许的"基础算法"集（与 semantic-evidence.js derive 口径同源） */
function allowedBaseOf(kpId) {
  var kp = KC.get(kpId);
  var ops = (kp && kp.semantic && kp.semantic.operations) || [];
  var norm = uniq(ops.map(function (o) { return OPN[o] || o; }));
  var base = BASE4.filter(function (b) { return norm.indexOf(b) !== -1; });
  var hasMixed = norm.indexOf('mixed') !== -1;
  if (base.length) return base;
  if (hasMixed) return BASE4.slice(); // 纯 mixed：混合运算定义，放开四则
  return [];
}

var bcKps = matrix.kps.filter(function (k) { return k.draftSemanticLevel !== 'A'; });
var bcIds = {};
bcKps.forEach(function (k) { bcIds[k.id] = k; });

// 枚举 B/C KP × ALLOW 题型（与 dev/p25/derive-evidence-candidates.js 同机制）
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!bcIds[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var mm = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (mm[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

function fieldRead(sq, p) {
  var cur = sq;
  String(p).split('.').forEach(function (seg) { cur = (cur == null ? undefined : cur[seg]); });
  return cur;
}

(async function run() {
  var produced = [];
  var skipped = [];
  var seenPair = {};
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var key = p.kp + '|' + p.qt;
    if (seenPair[key]) continue; seenPair[key] = 1;

    var allowed = allowedBaseOf(p.kp);
    if (!allowed.length) { skipped.push({ kp: p.kp, qt: p.qt, why: 'no-algorithm-anchor' }); continue; }
    var allowRel = allowed.map(function (o) { return REL[o]; });
    var allowCon = allowed.map(function (o) { return CON[o]; });

    var sqs = [];
    try {
      var s = new PracticeSession({ subject: 'math', grade: p.grade, count: N, knowledgePointId: p.kp, questionType: p.qt });
      await s.start();
      sqs = (s.semanticQuestions || []).filter(function (q) { return q.questionType === p.qt; });
    } catch (e) { skipped.push({ kp: p.kp, qt: p.qt, why: 'gen-error' }); continue; }
    if (!sqs.length) { skipped.push({ kp: p.kp, qt: p.qt, why: 'no-sample' }); continue; }

    var bad = null;
    for (var j = 0; j < sqs.length; j++) {
      var sq = sqs[j];
      var evd = (sq.data && sq.data.semanticEvidence) || {};
      var rs = Array.isArray(evd.relations) ? evd.relations : [];
      var cs = Array.isArray(evd.constructs) ? evd.constructs : [];
      if (fieldRead(sq, 'data.operation') === undefined) { bad = 'no-data.operation'; break; }
      var hitRel = rs.some(function (r) { return allowRel.indexOf(r) !== -1; });
      var hitCon = cs.some(function (c) { return allowCon.indexOf(c) !== -1; });
      var overflowRel = rs.filter(function (r) { return ALL_REL.indexOf(r) !== -1 && allowRel.indexOf(r) === -1; });
      var overflowCon = cs.filter(function (c) { return ALL_CON.indexOf(c) !== -1 && allowCon.indexOf(c) === -1; });
      if (!hitRel) { bad = 'relation-miss'; break; }
      if (!hitCon) { bad = 'construct-miss'; break; }
      if (overflowRel.length) { bad = 'relation-overflow:' + overflowRel.join(','); break; }
      if (overflowCon.length) { bad = 'construct-overflow:' + overflowCon.join(','); break; }
    }
    if (bad) { skipped.push({ kp: p.kp, qt: p.qt, why: bad }); continue; }

    var meta = bcIds[p.kp];
    produced.push({
      knowledgePointId: p.kp,
      knowledgePointName: meta ? meta.name : undefined,
      questionType: p.qt,
      kblAnchor: 'generic-algorithm draftSemanticLevel=' + (meta ? meta.draftSemanticLevel : '?') +
        '; semantic.operations=[' + ((meta && meta.operations) || []).join(',') + ']',
      inferred: true,
      reviewStatus: 'llm-finalized-dev',
      required: [
        { kind: 'fieldPresent', path: 'data.operation' },
        { kind: 'relationAny', any: allowRel },
        { kind: 'constructAny', any: allowCon }
      ],
      forbidden: []
    });
  }

  // 幂等：剔除本批 B/C KP 的全部旧规则，保留 A 类规则
  var kept = doc.rules.filter(function (r) { return !bcIds[r.knowledgePointId]; });
  var removedBc = doc.rules.length - kept.length;

  console.log('B/C KP：' + bcKps.length + '，ALLOW 对：' + Object.keys(seenPair).length);
  console.log('派生规则：' + produced.length + '；跳过对：' + skipped.length + '；重跑剔除旧 B/C 规则：' + removedBc);
  var whyCount = {};
  skipped.forEach(function (x) { whyCount[x.why] = (whyCount[x.why] || 0) + 1; });
  console.log('跳过原因：' + JSON.stringify(whyCount));
  var skipKps = uniq(skipped.map(function (x) { return x.kp; }));
  skipKps.forEach(function (id) {
    var ws = skipped.filter(function (x) { return x.kp === id; });
    console.log('  SKIP ' + id + ' ' + (bcIds[id] && bcIds[id].name) + ' :: ' + uniq(ws.map(function (x) { return x.why; })).join(','));
  });

  if (!WRITE) { console.log('\n[预演] 未写盘。加 --write 合并写 ' + path.relative(ROOT, rulesPath)); return; }

  doc.rules = kept.concat(produced);
  doc.schemaVersion = 'p26-evidence.2';
  // assertionKinds 登记新断言
  var reqKinds = doc.assertionKinds.required;
  function addKind(line) { if (reqKinds.indexOf(line) === -1) reqKinds.push(line); }
  addKind('relationAny(any[]): 声明 relations 须与给定允许关系数组有交集（通用算法 KP：单题只执行本 KP 所允许多种通用算法中的一种；空声明/不相交不通过）');
  addKind('constructAny(any[]): 声明 constructs 须与给定允许构件数组有交集（同上，空声明不通过）');
  doc.note = 'P28-GENERIC-ALGO-EVIDENCE：B/C 通用算法 KP（draftSemanticLevel≠A）补语义证据规则——不绑定进位/退位等特定方法，直接以通用算法类型为构件。Generator shared/generator/core/semantic-evidence.js 按题 data.operation 兜底声明 constructs=addition/subtraction/multiplication/division（mixed 按 KP 显式基础运算展开，纯 mixed 才放开四则）；validator checkSemanticEvidence 新增 relationAny/constructAny 正面断言。规则机械派生自真实生成（tools/kbl/derive-bc-evidence-rules.js，逐题校验 data.operation 在场 + 关系/构件与 KP semantic.operations 允许集相交且不越界），不达标 KP（题面与语义不符或无算法锚）不产规则、保持 skip。本批规则 inferred=true、reviewStatus=llm-finalized-dev。｜' + doc.note;
  fs.writeFileSync(rulesPath, JSON.stringify(doc, null, 2) + '\n');
  console.log('\n已写盘：' + produced.length + ' 条 B/C 规则，规则总数 ' + doc.rules.length + '（A 类保留 ' + kept.length + '）');
})().catch(function (e) { console.error('派生失败：', e); process.exit(1); });
