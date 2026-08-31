#!/usr/bin/env node
/**
 * dev/verify-m2.js — M2 Unified Gate (M2-R07.1)
 *
 * 固定执行顺序：
 *   1. M0
 *   2. M1
 *   3. M2-R02 Tests
 *   4. M2-R03 Capability Contract
 *   5. M2-R04 Capability Matrix
 *   6. M2-R05 Generator Capability
 *   7. M2-R06 Resolver
 *
 * 任一子步骤失败 ⇒ 整体 FAIL（exitCode=1）。
 */
'use strict';

var path = require('path');
var child = require('child_process');
var ROOT = path.join(__dirname, '..');

var STEPS = [
  { name: 'M0 (verify)', cmd: 'node dev/verify-m0.js' },
  { name: 'M1 (verify:m1)', cmd: 'node dev/verify-m1.js' },
  { name: 'M2-R02 Capability Tests', cmd: 'node --test tests/capability/*.test.js' },
  { name: 'M2-R03 Capability Contract', cmd: 'node dev/check-capability-contract.js' },
  { name: 'M2-R04 Capability Matrix', cmd: 'node dev/check-capability-matrix.js' },
  { name: 'M2-R05 Generator Capability', cmd: 'node dev/check-generator-capability.js' },
  { name: 'M2-R06 Resolver', cmd: 'node dev/check-capability-resolver.js' },
  { name: 'M2-R07 Final Report + Architecture', cmd: 'node dev/check-m2-final.js' }
];

function runStep(step) {
  console.log('\n──────── ' + step.name + ' ────────');
  var parts = step.cmd.replace(/^node\s+/, '').split(/\s+/);
  var r = child.spawnSync('node', parts, { cwd: ROOT, stdio: 'inherit' });
  return r.status === 0;
}

var allOk = true;
STEPS.forEach(function (s) { if (!runStep(s)) allOk = false; });

console.log('\n══════════════════════════════════════');
console.log(allOk ? '[PASS] M2 Unified Gate' : '[FAIL] M2 Unified Gate');
console.log('══════════════════════════════════════');
process.exitCode = allOk ? 0 : 1;
