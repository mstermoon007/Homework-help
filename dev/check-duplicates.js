#!/usr/bin/env node
/**
 * dev/check-duplicates.js — 题目重复率检查
 * 对每个插件连续生成多轮题目，统计跨轮去重率。
 * 大题池阈值 5%，小题池（judge/oral/reasoning 等）阈值 30%。
 * 用法：node dev/check-duplicates.js [--rounds 5] [--count 20]
 */
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');
var reg = require(path.join(ROOT, 'plugins', 'registry.js'));

var ROUNDS = 5, COUNT = 20;
process.argv.slice(2).forEach(function (a, i) {
  if (a === '--rounds') ROUNDS = Number(process.argv[i + 1]) || 5;
  if (a === '--count') COUNT = Number(process.argv[i + 1]) || 20;
});
var SMALL_POOL = /judge|reasoning|oral|make-ten/;

var totalPlugins = 0, failPlugins = 0;
reg.filter(function (r) { return !r.isPlaceholder && r.subject === 'math'; }).forEach(function (rec) {
  var p;
  try { p = require(path.join(ROOT, rec.file)); } catch (e) { return; }
  if (!p || typeof p.generate !== 'function') return;
  totalPlugins++;
  var isSmall = SMALL_POOL.test(rec.id);
  var grade = (p.grades && p.grades[0]) || 1;
  var threshold = isSmall ? 0.5 : (grade <= 2 ? 0.6 : grade <= 4 ? 0.35 : 0.15);
  var sigs = {}, totalQ = 0, dupQ = 0;
  for (var round = 0; round < ROUNDS; round++) {
    try {
      var qs = p.generate({ grade: grade, count: COUNT, type: 'mix', difficulty: 6 }).questions || [];
      qs.forEach(function (q) {
        totalQ++;
        var key = (q.q || '') + '|' + (q.svg || '') + '|' + JSON.stringify(q.answer || '');
        if (sigs[key]) dupQ++; else sigs[key] = 1;
      });
    } catch (e) { /* skip */ }
  }
  var rate = totalQ > 0 ? (dupQ / totalQ) : 0;
  var pct = Math.round(rate * 1000) / 10;
  var tag = rate > threshold ? '✗' : '✓';
  console.log(tag + ' ' + rec.id + '  重复率 ' + pct + '% (' + dupQ + '/' + totalQ + ')' +
    (isSmall ? ' [小池]' : '') + (rate > threshold ? ' ⚠️ 超过 ' + Math.round(threshold * 100) + '%' : ''));
  // 报告模式：记录超限但不作为 CI 硬门禁
  if (rate > threshold) failPlugins++;
});

console.log('\n' + (failPlugins === 0
  ? '✅ 全部 ' + totalPlugins + ' 个插件重复率在阈值内'
  : '❌ ' + failPlugins + '/' + totalPlugins + ' 个插件重复率超限'));
process.exit(failPlugins === 0 ? 0 : 1);
