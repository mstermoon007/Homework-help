#!/usr/bin/env node
/**
 * dev/check-knowledge-access.js — KBL ACCESS AUDIT 静态门禁（Phase D，Step 35）
 *
 * 规则：
 *   1) 知识库数据产物（data/ relations/ mappings/ index/ manifest/ 下 JSON）与旧知识层文件
 *      （18 项待删除清单）不得被 runtime 之外的代码直接引用。
 *   2) 门禁以 migration/knowledge-access-expectations.json 为基线：
 *      当前命中集合 ⊆ 基线 ⇒ PASS；多出任何一个文件 ⇒ FAIL（新增越权访问，必须经 runtime 单入口）。
 *   3) 基线内分类输出审计：
 *        legacy-layer      —— 待删除旧层（Phase E 前自引用，合法）
 *        downstream-pending —— 既有下游（记录断链，不修复；Phase E 一并处理）
 *        pages-pending     —— 页面层（select.html / practice.html 固有引用，待接线）
 *        tools             —— 迁移工具 / 运行时验证（新增代码不得外溢）
 *
 * 退出码：非 0 = 阻断。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const LEGACY_FILES = [
  'knowledge-bank.js', 'knowledge-math.js', 'knowledge-point.js', 'knowledge-ontology.js',
  'knowledge-ontology-normalizer.js', 'knowledge-ontology-validator.js', 'knowledge-factual.js',
  'knowledge-operation.js', 'knowledge-error.js', 'ontology-book-map.js', 'ontology-category-map.js',
  'ontology-error-map.js', 'ontology-factual-map.js', 'ontology-operation-map.js'
];
const LEGACY_PATTERNS = LEGACY_FILES.map(lf => new RegExp('knowledge/' + lf.replace('.', '\\.'), 'g'));
const DATA_PATTERNS = ['data', 'relations', 'mappings', 'index', 'manifest'].map(d => new RegExp('[\'"]shared/knowledge/' + d + '[/\\\\][^\'"]*[\'\"]', 'g'));

// runtime（唯一数据入口）与迁移工具允许访问；门禁自检查文件与运行时验证属工具，放行。
// migration/ 与 archive/ 为迁移工程与文档（非运行面，引用旧路径仅为断链清单记录）；
// docs/ 为文档（非运行面）。
// compat-bridge（knowledge-compat.js / build-strategy-bundle.js）为 Frozen Strategy bundle 的
// 构建期接线：旧模块名 → KBL Runtime 委托，属受控例外（不得扩散）。
const IGNORE_DIRS = ['node_modules', '.git', 'archive', 'migration', 'docs', 'shared/knowledge/runtime'];
const TOOLS = new Set(['tools/kbl/build.js', 'tools/kbl/publish.js', 'tools/kbl/verify.js', 'dev/verify-kbl-runtime.js', 'dev/build-knowledge-runtime.js', 'dev/check-knowledge-access.js', 'dev/check-kbl-quality.js']);

function hitKind(content) {
  const kinds = [];
  DATA_PATTERNS.forEach((p, i) => { const m = content.match(p); if (m) kinds.push(['data/relations/mappings/index/manifest'.split('/')[i], m[0]]); });
  LEGACY_PATTERNS.forEach(p => { const m = content.match(p); if (m) kinds.push(['legacy', m[0]]); });
  return kinds;
}

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (IGNORE_DIRS.indexOf(e.name) === -1) walk(p, acc); }
    else if (/\.(js|html|md|mjs|cjs)$/.test(e.name)) acc.push(p);
  });
}

const files = [];
walk(ROOT, files);
const hits = {}; // rel → kind[]
files.forEach(f => {
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');
  if (TOOLS.has(rel)) return;
  const kinds = hitKind(fs.readFileSync(f, 'utf8'));
  if (kinds.length) hits[rel] = kinds;
});

// ---- 基线 ----
const basePath = path.join(ROOT, 'migration/knowledge-access-expectations.json');
const baseline = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const entries = baseline.entries || {};
const known = Object.keys(entries);

const current = Object.keys(hits).sort();
const newUnauthorized = current.filter(rel => known.indexOf(rel) === -1 && TOOLS.has(rel) === false);

console.log('=== KBL ACCESS AUDIT ===');
const byCat = {};
known.forEach(f => { const c = entries[f]; if (hits[f]) { (byCat[c] = byCat[c] || []).push(f); } });
Object.keys(byCat).sort().forEach(c => console.log('  [' + c + '] ' + byCat[c].length + ' 文件'));
console.log('（legacy-layer 旧层已删除；downstream-pending ' + (byCat['downstream-pending'] || []).length + ' 项记录断链不修复；compat-bridge ' + (byCat['compat-bridge'] || []).length + ' 项为 Frozen bundle 构建期接线）');

if (newUnauthorized.length) {
  console.error('\nFAIL ' + newUnauthorized.length + ' 新增越权访问（必须改走 runtime 单入口 App.KNOWLEDGE）：');
  newUnauthorized.forEach(f => console.error('  ✗ ' + f + ' → ' + hits[f].map(h => h[1]).join(', ')));
  process.exit(1);
}
console.log('\nPASS — 已发现访问点全部在基线内，无新增越权访问；实际断链下游待 Phase E/接线收敛。');