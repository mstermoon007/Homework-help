#!/usr/bin/env node
'use strict';
// dev/p25/audit-type-contract.js — P25-07 七题型教育契约审计（只读，阻断式）
//
// A. 契约 SSOT ↔ 执行层对齐断言：
//    kbl/teaching/type-contracts.json（contracts[].invariants / invariantKinds / conversion）
//    必须与 shared/generator/core/type-contract.js（CONTRACT_MAP / INVARIANT_IDS / FORM_BOUND）
//    完全一致——双入口漂移即阻断（与 families --check 同源的防漂移纪律）。
//
// B. 全量 ALLOW 真实性复扫（与 dev/check-allow-generation.js 同一枚举）：
//    逐对生成题目，按题型教育契约逐题断言 0 违例（TypeContract.check），
//    且验证器第 9 检查 checkTypeContract 状态 ≠ fail。
//    任何违例 → exit 1（阻断 CI）。
//
// 用法：node dev/p25/audit-type-contract.js

var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
var ContractDoc = require(path.join(ROOT, 'kbl', 'teaching', 'type-contracts.json'));
var Validator = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

var failures = [];

/* ---------------- A. JSON ↔ code 对齐 ---------------- */

function sortedJoin(arr) { return (arr || []).slice().sort().join(','); }

(function alignContracts() {
  var jsonTypes = {};
  (ContractDoc.contracts || []).forEach(function (c) { jsonTypes[c.questionType] = c; });
  var codeTypes = TC.CONTRACT_MAP || {};

  Object.keys(codeTypes).forEach(function (qt) {
    if (!jsonTypes[qt]) { failures.push('A: code 契约含 ' + qt + ' 但 JSON 缺失'); return; }
    if (sortedJoin(codeTypes[qt]) !== sortedJoin(jsonTypes[qt].invariants)) {
      failures.push('A: ' + qt + ' 不变式漂移 code=[' + sortedJoin(codeTypes[qt]) + '] json=[' + sortedJoin(jsonTypes[qt].invariants) + ']');
    }
  });
  Object.keys(jsonTypes).forEach(function (qt) {
    if (!codeTypes[qt]) failures.push('A: JSON 契约含 ' + qt + ' 但 code 缺失');
  });

  var jsonKinds = Object.keys(ContractDoc.invariantKinds || {}).sort().join(',');
  var codeKinds = (TC.INVARIANT_IDS || []).slice().sort().join(',');
  if (jsonKinds !== codeKinds) {
    failures.push('A: invariantKinds 漂移 json=[' + jsonKinds + '] code=[' + codeKinds + ']');
  }

  var jsonFormBound = (ContractDoc.contracts || [])
    .filter(function (c) { return c.conversion === 'form-bound'; })
    .map(function (c) { return c.questionType; }).sort().join(',');
  var codeFormBound = (TC.FORM_BOUND || []).slice().sort().join(',');
  if (jsonFormBound !== codeFormBound) {
    failures.push('A: form-bound 漂移 json=[' + jsonFormBound + '] code=[' + codeFormBound + ']');
  }
})();

console.log('A. JSON↔code 对齐：' + (failures.length ? 'FAIL' : 'PASS') +
  '（' + Object.keys(TC.CONTRACT_MAP).length + ' 题型 / ' + TC.INVARIANT_IDS.length + ' 不变式）');

/* ---------------- B. 全量 ALLOW 复扫 ---------------- */

var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

var ALL = QTR.TYPES.map(function (t) { return t.id; });

var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

(async function run() {
  var viol = 0;
  var checked = 0;
  var genFails = [];
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    try {
      var session = new PracticeSession({
        subject: 'math', grade: p.grade, count: 1,
        knowledgePointId: p.kp, questionType: p.qt
      });
      await session.start();
      var qs = session.semanticQuestions || [];
      if (!qs.length) { genFails.push(p.kp + '|' + p.qt + ' n=0'); continue; }
      for (var j = 0; j < qs.length; j++) {
        var q = qs[j];
        checked++;
        var c = TC.check(q.questionType || q.questionTypeId, q);
        if (!c.ok) {
          viol++;
          failures.push('B: ' + p.kp + '|' + (q.questionType || p.qt) + ' 违例 ' + (c.violations || []).join(','));
        }
        var v = Validator.checkTypeContract(q);
        if (v.state === 'fail') {
          viol++;
          failures.push('B: ' + p.kp + '|' + (q.questionType || p.qt) + ' 验证器第 9 检查 fail');
        }
      }
    } catch (e) {
      genFails.push(p.kp + '|' + p.qt + ' err=' + String((e && e.message) || e).slice(0, 80));
    }
    if ((i + 1) % 300 === 0) process.stdout.write('\r  进度 ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + pairs.length + '/' + pairs.length + '          \n');

  if (genFails.length) {
    failures.push('B: ' + genFails.length + ' 对无法生成（契约门禁不得以「产不出」替代「产出合规」）');
    genFails.slice(0, 10).forEach(function (f) { console.log('  NOGEN ' + f); });
  }

  console.log('B. 全量复扫：' + pairs.length + ' 对 / ' + checked + ' 题，契约违例 ' + viol);
  failures.slice(0, 20).forEach(function (f) { console.log('  FAIL ' + f); });
  if (failures.length > 20) console.log('  …另有 ' + (failures.length - 20) + ' 项失败');

  console.log(failures.length ? '\n审计结果：FAIL（' + failures.length + ' 项）' : '\n审计结果：PASS');
  process.exit(failures.length ? 1 : 0);
})();
