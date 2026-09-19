#!/usr/bin/env node
'use strict';
/**
 * dev/p25/audit-generator-hardcode.js — P25-06 Generator KP 硬编码审计（只读）
 *
 * 扫描四类「以编码手段承载教学事实」的模式，输出可审计清单。不修改任何文件。
 *
 *   H1 尾缀分派      —— 以 kpId.slice(-n) / 尾缀正则决定生成行为（跨单元碰撞风险 + 静默 fallback）
 *   H2 STALE KP 清单 —— generator 内 knowledgePoints 使用了不在 canonical 375 KP 中的 ID
 *   H3 pluginId 子串 —— 以 pluginId.indexOf('c3-'/'money'/...) 猜语义（字符串约定脆弱）
 *   H4 ID override   —— resolver 内按完整 KP ID 指定语义 profile（已声明正当，仅登记）
 *
 * 另做两项一致性断言（防漂移）：
 *   A1 capability-resolver 的 TEACHING_DENIALS 与 kbl/teaching/teaching-denials.json 集合一致
 *   A2 selector 已无「引用未定义 g 的坏 hasShapeSemantics」死函数
 *
 * 用法：node dev/p25/audit-generator-hardcode.js
 * 退出码：断言失败（A1/A2）=1；债务清单存在不阻断（H1-H4 为可见性审计）。
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var GEN_DIR = path.join(ROOT, 'shared', 'generator');
var CAP_RESOLVER = path.join(ROOT, 'shared', 'capability', 'capability-resolver.js');
var DENIALS_JSON = path.join(ROOT, 'kbl', 'teaching', 'teaching-denials.json');

function walk(dir, re) {
  var out = [];
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var st = fs.statSync(full);
    if (st.isDirectory()) out = out.concat(walk(full, re));
    else if (re.test(name)) out.push(full);
  });
  return out;
}

function lines(file) {
  return fs.readFileSync(file, 'utf8').split('\n');
}

var findings = { H1: [], H2: [], H3: [], H4: [] };
var failures = [];

// ---------- H1 尾缀分派：slice(- / 尾缀正则 / lastIndexOf('-k') ----------
var H1_RE = /\.(?:slice|substring|substr)\(\s*-\d|split\(['"][^'"]*k['"]\)|lastIndexOf\(['"]-k['"]\)/;
walk(path.join(GEN_DIR, 'generators'), /\.js$/).forEach(function (f) {
  lines(f).forEach(function (ln, i) {
    if (H1_RE.test(ln)) findings.H1.push({ file: path.relative(ROOT, f), line: i + 1, code: ln.trim() });
  });
});

// ---------- H2 STALE KP 清单：generators/*.js 内的 'math-...' ID 不在 canonical（按文件聚合） ----------
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var ID_RE = /['"](math-[a-z0-9]+(?:-[a-z0-9]+)+)['"]/g;
walk(path.join(GEN_DIR, 'generators'), /\.js$/).forEach(function (f) {
  var stale = {};
  lines(f).forEach(function (ln, i) {
    if (/^\s*(\*|\/\/)/.test(ln)) return; // 跳过注释
    var m;
    while ((m = ID_RE.exec(ln)) !== null) {
      var id = m[1];
      if (!KC.get(id)) stale[id] = i + 1;
    }
  });
  var ids = Object.keys(stale);
  if (ids.length) findings.H2.push({ file: path.relative(ROOT, f), count: ids.length, ids: ids });
});

// ---------- H3 pluginId 子串语义判定（generator-selector.js，调用计数排除注释） ----------
var selectorFile = path.join(GEN_DIR, 'generator-selector.js');
var H3_FN_RE = /function (has\w+Semantics|isC\w+Family)\s*\((\w+)\)\s*\{/g;
var selectorText = fs.readFileSync(selectorFile, 'utf8');
var selectorCodeLines = selectorText.split('\n').filter(function (ln) {
  return !/^\s*(\*|\/\/)/.test(ln);
}).join('\n');
var m3;
while ((m3 = H3_FN_RE.exec(selectorCodeLines)) !== null) {
  var fnName = m3[1];
  // 统计文件内调用点（排除定义行与注释）
  var callCount = (selectorCodeLines.match(new RegExp(fnName + '\\s*\\(', 'g')) || []).length - 1;
  var bodyStart = m3.index;
  var body = selectorCodeLines.slice(bodyStart, bodyStart + 400);
  var usesSubstring = /\.indexOf\(/.test(body);
  findings.H3.push({ fn: fnName, called: callCount > 0, calls: callCount, substringHeuristic: usesSubstring });
}

// ---------- H4 ID override：kp-arithmetic-semantics CANONICAL_KP_OVERRIDES ----------
var arithSem = path.join(GEN_DIR, 'core', 'kp-arithmetic-semantics.js');
lines(arithSem).forEach(function (ln, i) {
  var m = ln.match(/knowledgePoints:\s*\[([^\]]+)\]/);
  if (m && /CANONICAL_KP_OVERRIDES|dec-mult/.test(selectorText + fs.readFileSync(arithSem, 'utf8').split('\n').slice(Math.max(0, i - 8), i).join('\n'))) {
    var ids = (m[1].match(/'([^']+)'/g) || []).map(function (s) { return s.slice(1, -1); });
    ids.forEach(function (id) {
      findings.H4.push({ file: path.relative(ROOT, arithSem), line: i + 1, id: id, exists: !!KC.get(id) });
    });
  }
});

// ---------- A1 teaching denials 代码表 ↔ JSON SSOT 一致性 ----------
var resolverText = fs.readFileSync(CAP_RESOLVER, 'utf8');
var codeDenials = {};
var tableBlock = resolverText.match(/var TEACHING_DENIALS = \{([\s\S]*?)\};/);
if (!tableBlock) failures.push('A1: resolver 中未找到 TEACHING_DENIALS 表');
else {
  var rowRe = /['"](math-[a-z0-9-]+)\|([a-z]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
  var rm;
  while ((rm = rowRe.exec(tableBlock[1])) !== null) codeDenials[rm[1] + '|' + rm[2]] = rm[3];
}
var jsonDoc = JSON.parse(fs.readFileSync(DENIALS_JSON, 'utf8'));
var jsonDenials = {};
(jsonDoc.denials || []).forEach(function (d) {
  jsonDenials[d.knowledgeId + '|' + d.questionType] = d;
});
Object.keys(jsonDenials).forEach(function (k) {
  if (!Object.prototype.hasOwnProperty.call(codeDenials, k)) failures.push('A1: 教学裁决未在 resolver 执行：' + k);
});
Object.keys(codeDenials).forEach(function (k) {
  if (!Object.prototype.hasOwnProperty.call(jsonDenials, k)) failures.push('A1: resolver 存在无 SSOT 裁决：' + k);
});

// ---------- A2 selector 坏死函数已清除 ----------
if (/function hasShapeSemantics\(kp\)\s*\{\s*return g\.id/.test(selectorText)) {
  failures.push('A2: selector 仍存在引用未定义变量 g 的坏 hasShapeSemantics 死函数');
}

// ---------- 报告 ----------
function p(title, items) {
  console.log('\n## ' + title + '（' + items.length + '）');
  items.forEach(function (x) { console.log('  ' + JSON.stringify(x)); });
}

console.log('# P25-06 Generator 硬编码审计  ' + new Date().toISOString().slice(0, 10));
p('H1 尾缀分派', findings.H1);
p('H2 STALE KP 清单（不在 canonical 375）', findings.H2);
p('H3 pluginId 子串语义判定（called=false 即无调用死代码）', findings.H3);
p('H4 显式 ID override（已声明正当，仅登记）', findings.H4);
console.log('\n## 一致性断言');
if (failures.length === 0) {
  console.log('  A1 teaching denials 代码表 ↔ SSOT JSON：一致（' + Object.keys(codeDenials).length + ' 条）');
  console.log('  A2 selector 坏死函数：已清除');
  console.log('\n结果：PASS（债务 ' + (findings.H1.length + findings.H2.length + findings.H3.length + findings.H4.length) + ' 项已列账，断言全过）');
  process.exit(0);
} else {
  failures.forEach(function (f) { console.log('  FAIL ' + f); });
  console.log('\n结果：FAIL（' + failures.length + ' 项断言失败）');
  process.exit(1);
}
