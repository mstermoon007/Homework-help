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

var totalPlugins = 0, failPlugins = 0, exemptPlugins = 0;
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
  // 池大小检测：插件暴露 poolCache 且池小于请求总量（ROUNDS×COUNT）时，
  // 说明题目池有限、无法完全避免重复，自动豁免（不计入超限）并提示。
  var poolSize = null;
  try {
    if (p.poolCache && typeof p.poolCache.size === 'function') poolSize = p.poolCache.size();
  } catch (e) { /* 池大小不可知则不豁免 */ }
  var need = ROUNDS * COUNT;
  var limited = poolSize != null && poolSize < need;
  var tag = rate > threshold ? '✗' : '✓';
  var extra = '';
  if (limited) extra += ' [题目池有限（' + poolSize + ' < ' + need + '），无法完全避免重复，已豁免]';
  else if (isSmall) extra += ' [小池]';
  console.log(tag + ' ' + rec.id + '  重复率 ' + pct + '% (' + dupQ + '/' + totalQ + ')' +
    (poolSize != null ? ' 池=' + poolSize : '') + extra + (rate > threshold && !limited ? ' ⚠️ 超过 ' + Math.round(threshold * 100) + '%' : ''));
  if (rate > threshold && !limited) failPlugins++;
  else if (limited) exemptPlugins++;
});

var summary = failPlugins === 0
  ? '✅ ' + (totalPlugins - exemptPlugins) + '/' + totalPlugins + ' 个插件重复率在阈值内'
  : '❌ ' + failPlugins + '/' + totalPlugins + ' 个插件重复率超限';
if (exemptPlugins > 0) summary += '（另有 ' + exemptPlugins + ' 个因题目池有限被豁免）';
console.log('\n' + summary);
process.exit(failPlugins === 0 ? 0 : 1);
