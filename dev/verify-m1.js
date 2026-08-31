#!/usr/bin/env node
/**
 * dev/verify-m1.js — M1 统一 Ontology Gate (M1-R08)
 *
 * 顺序执行：
 *   M1-01 Schema            -> check-ontology-schema.js
 *   M1-02.1 Operation       -> check-operation-ontology.js
 *   M1-02.2 Factual         -> check-factual-content.js
 *   M1-02.3 Error           -> check-error-ontology.js
 *   M1-R01 Schema (复用上面) 已含于 M1-01 + schema 文件
 *   M1-R02 KB Gate          -> verify-knowledge-bank.js
 *   M1-R03 Canonical Access  -> 内联：KnowledgePoint.get 冒烟测试
 *   M1-R04 Knowledge         -> 已含于 check-knowledge-point.js
 *   M1-R05 Generation Cap.   -> 已含于 check-knowledge-point.js
 *   M1-R06 Full Scan         -> check-knowledge-point.js
 *
 * 任一子步骤非 0 退出 ⇒ 整体 FAIL。WARNING 不阻断。
 */
'use strict';

var path = require('path');
var child = require('child_process');
var ROOT = path.join(__dirname, '..');

var STEPS = [
  { name: 'M1-01 Ontology Schema', cmd: 'node dev/check-ontology-schema.js' },
  { name: 'M1-02.1 Operation', cmd: 'node dev/check-operation-ontology.js' },
  { name: 'M1-02.2 Factual', cmd: 'node dev/check-factual-content.js' },
  { name: 'M1-02.3 Error', cmd: 'node dev/check-error-ontology.js' },
  { name: 'M1-R02 KB Gate', cmd: 'node dev/verify-knowledge-bank.js' },
  { name: 'M1-R06 Full Scan', cmd: 'node dev/check-knowledge-point.js' }
];

function runStep(step) {
  console.log('\n──────── ' + step.name + ' ────────');
  var parts = step.cmd.replace(/^node\s+/, '').split(/\s+/);
  var r = child.spawnSync('node', parts, { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

function checkCanonicalAccess() {
  console.log('\n──────── M1-R03 Canonical Access ────────');
  try {
    var KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));
    var sample = KP.get('math-g1-m0-make-ten');
    if (!sample) { console.log('[FAIL] 未找到可用于冒烟测试的已知 KP'); return false; }
    var checks = [
      ['id', typeof sample.id === 'string' && sample.id.length > 0],
      ['knowledge.operations', Array.isArray(sample.knowledge.operations)],
      ['generation.capabilities', Array.isArray(sample.generation.capabilities)],
      ['identity', !!sample.identity]
    ];
    var ok = true;
    checks.forEach(function (c) { if (!c[1]) { ok = false; console.log('  missing: ' + c[0]); } });
    var unknown = KP.get('__definitely_not_a_real_id__');
    if (unknown !== null) { ok = false; console.log('  get(unknown) 应返回 null'); }
    console.log(ok ? '[PASS] M1-R03 Canonical Access 冒烟测试' : '[FAIL] M1-R03 Canonical Access');
    return ok;
  } catch (e) {
    console.log('[FAIL] ' + e.message);
    return false;
  }
}

var allOk = true;
STEPS.forEach(function (s) { if (!runStep(s)) allOk = false; });
if (!checkCanonicalAccess()) allOk = false;

console.log('\n══════════════════════════════════════');
console.log(allOk ? '[PASS] M1 Unified Ontology Gate' : '[FAIL] M1 Unified Ontology Gate');
console.log('══════════════════════════════════════');
process.exitCode = allOk ? 0 : 1;
