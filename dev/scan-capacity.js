#!/usr/bin/env node
/**
 * dev/scan-capacity.js — R3/R4 Capacity Inventory 扫描器
 *
 * 用法：
 *   node dev/scan-capacity.js            # 读缓存（缺失则扫描）
 *   node dev/scan-capacity.js --refresh  # 强制重新扫描全量 566 KP
 *
 * 输出：shared/capacity/capacity-map.json（含分级 tiers + collapse 报告）
 */
'use strict';
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
// P13-04：Node 侧需浏览器等价环境（bundle 全局）方可运行扫描（冻结 Strategy/Generator 不可裸 require）
require(path.join(ROOT, 'dev', '_bundle-env.js'));
require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'generation', 'api.js'));
var CI = require(path.join(ROOT, 'shared', 'capacity', 'capacity-inventory.js'));

var refresh = process.argv.indexOf('--refresh') !== -1;

CI.getCapacityMap({ refresh: refresh }).then(function (map) {
  var tiers = {};
  Object.keys(map).forEach(function (k) { var t = map[k].tier; tiers[t] = (tiers[t] || 0) + 1; });
  var report = CI.collapseReport(map);
  var limitedTotal = Object.keys(report).reduce(function (a, k) { return a + report[k].length; }, 0);
  console.log('=== Capacity Inventory (' + Object.keys(map).length + ' KP) ===');
  console.log('分级:', JSON.stringify(tiers));
  console.log('低容量(KP<=2):', limitedTotal);
  Object.keys(report).forEach(function (k) {
    console.log('  ' + k + ': ' + report[k].length + (report[k].length ? '  e.g. ' + report[k].slice(0, 6).join(', ') : ''));
  });
  console.log('\n缓存已写:', CI.CACHE_FILE);
}).catch(function (e) {
  console.error('扫描失败:', e);
  process.exit(1);
});
