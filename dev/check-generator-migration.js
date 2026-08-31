#!/usr/bin/env node
/**
 * dev/check-generator-migration.js — M4-R17 迁移 Validator Gate
 *
 * 对已选批次（math-oral）运行逐 KP 全量 Adapter 对照，并断言：
 *   - 具备纯算术语义的 KP（isArithmeticMigratable）必须全部 FULL-EQ 才可通过；
 *   - 无纯算术语义（N/A / NOT_MIGRATABLE）的 KP 属于设计外范围，不计入门禁；
 *   - 可迁移 KP 中不允许出现 DIFFERS / INVALID / NO_PARSE。
 *
 * 用途：npm run verify:m4 迁移门禁；违反时以非零退出码阻断。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Equiv = require(path.join(ROOT, 'dev', 'test-migration-equiv.js'));
var KpArith = require(path.join(ROOT, 'shared', 'generator', 'core', 'kp-arithmetic-semantics.js'));
var KP = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

var BATCH = process.argv[2] || 'math-oral';

function run() {
  Equiv.runTool().then(function (out) {
    var errors = [];
    var summary = out.summary;
    Object.keys(summary).forEach(function (pid) {
      // 只对本次迁移批次做门禁
      if (BATCH.split(',').indexOf(pid) === -1) return;
      var c = out.candidates[pid];
      if (!c) { errors.push(pid + ': 无对照结果'); return; }
      var exempt = 0, gatedOk = 0, gatedBad = [];
      c.kps.forEach(function (k) {
        var kpCanon = KP.get(k.kpId);
        var sem = kpCanon ? KpArith.resolveArithmeticSemantics(kpCanon) : null;
        if (!sem) { exempt++; return; }
        if (k.verdict === 'FULL-EQ') gatedOk++;
        else gatedBad.push(k.kpId + '(' + k.verdict + ')');
      });
      console.log('[MIGRATION-GATE] ' + pid + ': 可迁移=' + gatedOk + ' 设计外=' + exempt + (gatedBad.length ? ' 违规=' + gatedBad.join(',') : ''));
      gatedBad.forEach(function (b) { errors.push(pid + ' -> ' + b); });
      if (exempt + gatedOk !== c.kps.length) errors.push(pid + ': 存在未归类 KP 结果');
    });

    if (!errors.length) {
      console.log('[PASS] M4-R17 迁移门禁：' + BATCH + ' 全部可迁移 KP FULL-EQ');
      process.exitCode = 0;
    } else {
      console.error('[FAIL] M4-R17 迁移门禁：');
      errors.forEach(function (e) { console.error('  - ' + e); });
      process.exitCode = 1;
    }
  }, function (err) {
    console.error('[FAIL] M4-R17 迁移对照执行失败: ' + (err && err.stack || err));
    process.exitCode = 1;
  });
}

run();