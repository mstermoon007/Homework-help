#!/usr/bin/env node
/**
 * dev/check-comprehensive-pipeline.js — M4-19 综合练习切换完整性门禁
 *
 * 通过 dev/plugin-loader（与浏览器共用同一 strategy-engine.bundle.js）在沙箱内
 * 加载 math-comprehensive，逐模式（kb/average/domain/weighted/exam）生成试题，
 * 断言：
 *  1. 每题具备标准 Question 接口：q/text/answer + render/check；
 *  2. 每题带 knowledgePointId 元信息；
 *  3. 生成不依赖运行时 require（若 Generator Runtime 未通过全局注入，会抛 M4-19 错误）；
 *  4. 迁移知识点（含复杂生成器）可经综合练习产出。
 *
 * 用法：node dev/check-comprehensive-pipeline.js
 * 退出码 0 = PASS（供 verify:m4 串联）。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var loader = require('./plugin-loader.js');

var bad = [];
function check(name, cond) {
  var ok = !!cond;
  if (!ok) bad.push(name);
  console.log((ok ? '  ✓ ' : '  ✗ ') + name);
  return ok;
}

var comp = loader.loadPlugin('math-comprehensive');
if (comp.error) {
  console.log('  ✗ 加载 math-comprehensive 失败：' + comp.error);
  console.log('=== M4-19 综合练习门禁 ===\nFAIL');
  process.exit(1);
}
var P = comp.plugin;

var modes = ['kb', 'average', 'domain', 'weighted', 'exam'];
var grade = 2;

function generateSequential(i, acc) {
  if (i >= modes.length) return Promise.resolve(acc);
  var mode = modes[i];
  return P.generate({ grade: grade, count: mode === 'exam' ? 54 : 20, type: mode })
    .then(function (set) { acc.push({ mode: mode, set: set }); return generateSequential(i + 1, acc); })
    .catch(function (e) { acc.push({ mode: mode, error: e }); return generateSequential(i + 1, acc); });
}

Promise.resolve().then(function () {
  return generateSequential(0, []);
}).then(function (results) {
  console.log('[综合练习全模式（grade ' + grade + '）]');
  results.forEach(function (r) {
    if (r.error) { check(r.mode + ' 生成无异常', false); return; }
    var qs = r.set.questions;
    var allInterface = qs.length > 0 && qs.every(function (q) {
      return q && typeof q.render === 'function' && typeof q.check === 'function'
        && typeof q.q === 'string' && q.answer != null;
    });
    var allKp = qs.length > 0 && qs.every(function (q) { return !!q.knowledgePointId; });
    var hasMeta = r.set.meta && (typeof r.set.meta.distribution === 'string' || r.set.meta.exam === true);
    check(r.mode + ' → ' + qs.length + ' 题，接口齐全', allInterface);
    check(r.mode + ' → 每题含 knowledgePointId', allKp);
    check(r.mode + ' → meta 完整', hasMeta);
  });

  // exam 额外：sections 结构
  var exam = results.filter(function (r) { return r.mode === 'exam'; })[0];
  if (exam && exam.set) {
    check('exam → sections 非空', Array.isArray(exam.set.meta.sections) && exam.set.meta.sections.length > 0);
    check('exam → meta.exam=true', exam.set.meta.exam === true);
  }

  console.log('\n=== M4-19 综合练习门禁 ===');
  if (bad.length) {
    console.log('FAIL:' + bad.length + ' 项未通过 → ' + JSON.stringify(bad));
    process.exit(1);
  }
  console.log('PASS');
  process.exit(0);
}).catch(function (e) {
  console.log('  ✗ 综合练习管线异常：' + (e && e.stack || e));
  console.log('\n=== M4-19 综合练习门禁 ===\nFAIL');
  process.exit(1);
});
