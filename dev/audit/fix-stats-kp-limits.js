// dev/audit/fix-stats-kp-limits.js
/**
 * 修复规则：清理 M1-M12 知识点模块限制出题
 *
 * 根因：30 个统计/概率 KP 缺少 category 和 operations 字段，
 *   导致 capability-matrix 无法正确解析能力集 → allow=1, degrade=8,
 *   generator 路由受限 → 语义空间极窄 → D005 饱和过早触发。
 *
 * 修复规则（按子类型分组）：
 *   R-stat-chart: 统计图类（bar/line/pie/chart）→ category="statistics", operations=["read","interpret"]
 *   R-stat-avg:   平均数类（avg/average）→ category="statistics", operations=["calculate","average"]
 *   R-stat-prob:  概率类（possib*）→ category="statistics", operations=["compare","describe"]
 *   R-stat-data:  统计表/数据类（tally/question/multiTable/stats）→ category="statistics", operations=["read","interpret"]
 *
 * 作用：在 knowledge-math.js 中为这 30 个 KP 补充字段，不修改已有字段。
 * 安全：只在目标 KP 的 `type: "xxx"` 行后插入，不改变其他内容。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var FILE = path.join(ROOT, 'shared', 'knowledge-math.js');

// 修复规则表：type → { category, operations }
var RULES = {
  // R-stat-chart: 统计图类
  'bar-chart':         { category: 'statistics', operations: ['read','represent'] },
  'double-bar':        { category: 'statistics', operations: ['read','represent'] },
  'linechart-feature': { category: 'statistics', operations: ['read','represent'] },
  'linechart-app':     { category: 'statistics', operations: ['read','represent'] },
  'linechart-single':  { category: 'statistics', operations: ['read','represent'] },
  'linechart-double':  { category: 'statistics', operations: ['read','represent'] },
  'pie-chart':         { category: 'statistics', operations: ['read','represent'] },
  'chart':             { category: 'statistics', operations: ['read','represent'] },
  // R-stat-avg: 平均数类
  'average':           { category: 'statistics', operations: ['calculate','divide'] },
  'avg-score':         { category: 'statistics', operations: ['calculate','divide'] },
  'avg-stats':         { category: 'statistics', operations: ['calculate','divide'] },
  // R-stat-prob: 概率类
  'possibility':           { category: 'statistics', operations: ['compare','reason'] },
  'possibility-desc':      { category: 'statistics', operations: ['compare','reason'] },
  'possibility-app':       { category: 'statistics', operations: ['compare','reason'] },
  'possibility-compare':   { category: 'statistics', operations: ['compare','reason'] },
  // R-stat-data: 统计表/数据类
  'tally':             { category: 'statistics', operations: ['calculate','read'] },
  'question':          { category: 'statistics', operations: ['read','represent'] },
  'multiTable':        { category: 'statistics', operations: ['read','represent'] },
  'stats':             { category: 'statistics', operations: ['read','represent'] }
};

function run() {
  var content = fs.readFileSync(FILE, 'utf8');
  var lines = content.split('\n');
  var patched = 0;
  var skipped = 0;
  var report = [];

  for (var i = 0; i < lines.length; i++) {
    // 匹配 `type: "xxx",` 或 `type: 'xxx',` 行
    var match = lines[i].match(/^\s+type:\s*["']([^"']+)["'],?\s*$/);
    if (!match) continue;
    var typeVal = match[1];
    var rule = RULES[typeVal];
    if (!rule) continue;

    // 检查后续 5 行是否已有 category 字段（避免重复插入）
    var hasCategory = false;
    for (var j = i + 1; j < Math.min(i + 6, lines.length); j++) {
      if (/^\s+category:\s*/.test(lines[j])) { hasCategory = true; break; }
    }
    if (hasCategory) { skipped++; continue; }

    // 获取 type 行的缩进
    var indent = lines[i].match(/^(\s+)/);
    var indentStr = indent ? indent[1] : '              ';

    // 在 type 行后插入 category 和 operations
    var insertLines = [
      indentStr + 'category: "' + rule.category + '",',
      indentStr + 'operations: ' + JSON.stringify(rule.operations) + ','
    ];

    lines.splice(i + 1, 0, insertLines.join('\n'));
    patched++;
    report.push({ line: i + 1, type: typeVal, category: rule.category, operations: rule.operations });
    i += 2; // 跳过插入的 2 行
  }

  if (patched === 0 && skipped > 0) {
    console.log('所有目标 KP 已有 category 字段，无需修复（skipped=' + skipped + '）');
    return;
  }

  fs.writeFileSync(FILE, lines.join('\n'));
  console.log('=== 修复规则执行完成 ===');
  console.log('patched: ' + patched + ' KP');
  console.log('skipped (已有 category): ' + skipped);
  console.log('--- 修复明细 ---');
  report.forEach(function (r) {
    console.log('  L' + r.line + ' type=' + r.type + ' → category=' + r.category + ' operations=' + JSON.stringify(r.operations));
  });

  // 输出报告 JSON
  var reportPath = path.join(ROOT, 'dev', 'reports', 'fix-stats-kp-limits-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    meta: { script: 'dev/audit/fix-stats-kp-limits.js', target: 'shared/knowledge-math.js' },
    summary: { patched: patched, skipped: skipped },
    rules: Object.keys(RULES).map(function (k) {
      return { type: k, category: RULES[k].category, operations: RULES[k].operations };
    }),
    patches: report
  }, null, 2));
  console.log('报告: ' + reportPath);
}

run();
