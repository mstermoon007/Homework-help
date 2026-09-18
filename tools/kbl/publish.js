'use strict';
/**
 * tools/kbl/publish.js — KBL Snapshot / Release（方案 §12 快照 + §44 发布步骤）
 *
 * 基于 Canonical Build 产物（shared/knowledge，即 Runtime 镜像，其文件被 rootHash 覆盖）
 * 生成不可变发布快照：
 *   kbl/releases/kbl-math-<catalogVersion>-<rootHash8>/
 *     ├── <rootHash 覆盖的 10 个数据文件>（与 shared/knowledge 字节一致）
 *     └── MANIFEST.json（含 per-file sha256 + rootHash）
 *   kbl/releases/latest.json —— 指向当前版本指针
 *
 * 特性：
 *   - rootHash 为内容指纹且已确定性（generatedAt 不入分布数据），同一内容发布目录不重复生成。
 *   - 发布时不复制 manifest/manifest.json（避免时间戳污染），仅复制 integrity.files 所列数据，
 *     另写独立 MANIFEST.json 交付完整性。
 *   - 发布后审计：重算拷贝数据的 rootHash 必须等于上传值。
 *
 * 用法：node tools/kbl/publish.js
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var DST = path.join(__dirname, '../../shared/knowledge');
var RELEASES = path.join(__dirname, '../../kbl/releases');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function sha(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }

var manifest = readJson(path.join(DST, 'manifest/manifest.json'));
var integrity = manifest.integrity;
if (!integrity || !integrity.rootHash || !integrity.files) {
  console.error('FAIL — shared/knowledge/manifest 缺少 integrity，请先运行 build');
  process.exit(1);
}
var rootHash = integrity.rootHash;
var catalogVersion = String(manifest.catalogVersion || 'math-v1.0.0').replace(/[^ \w.-]/g, '-');

var relName = 'kbl-' + catalogVersion + '-' + rootHash.slice(0, 8);
var relDir = path.join(RELEASES, relName);

// ---- 1. 快照拷贝（仅 integrity.files 覆盖的数据文件）----
var changed = false;
Object.keys(integrity.files).forEach(function (rel) {
  var src = path.join(DST, rel);
  if (!fs.existsSync(src)) {
    console.error('FAIL — 缺少分布数据: ' + rel);
    process.exit(1);
  }
  var dst = path.join(relDir, rel);
  if (fs.existsSync(dst)) {
    if (fs.readFileSync(dst, 'utf8') !== fs.readFileSync(src, 'utf8')) changed = true;
  } else {
    changed = true;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, fs.readFileSync(src)); // 字节级拷贝
});

// ---- 2. 独立 MANIFEST.json（快照完整性，含时间戳但 rootHash 不覆盖自身）----
var snapshotManifest = {
  schemaVersion: manifest.schemaVersion,
  catalogVersion: manifest.catalogVersion,
  packageVersion: manifest.packageVersion,
  publishedAt: new Date().toISOString(),
  publisher: 'tools/kbl/publish.js',
  counts: manifest.counts,
  idRules: manifest.idRules,
  integrity: { algorithm: integrity.algorithm, filesCount: Object.keys(integrity.files).length, rootHash: rootHash }
};
fs.mkdirSync(relDir, { recursive: true });
fs.writeFileSync(path.join(relDir, 'MANIFEST.json'), JSON.stringify(snapshotManifest, null, 2) + '\n', 'utf8');

// ---- 3. 重算拷贝数据 rootHash 审计 ----
var dataRels = Object.keys(integrity.files);
var rootInput = dataRels.map(function (rel) {
  var text = fs.readFileSync(path.join(relDir, rel), 'utf8');
  return rel + ':' + sha(text) + '\n';
}).join('');
var verifyHash = sha(rootInput);
if (verifyHash !== rootHash) {
  console.error('FAIL — 快照 rootHash 不匹配（期望 ' + rootHash + ' 实际 ' + verifyHash + '）');
  process.exit(1);
}

// ---- 4. latest.json 指针 ----
fs.mkdirSync(RELEASES, { recursive: true });
var latest = {
  catalogVersion: manifest.catalogVersion,
  packageVersion: manifest.packageVersion,
  rootHash: rootHash,
  publishedAt: snapshotManifest.publishedAt,
  snapshot: relName,
  counts: manifest.counts
};
fs.writeFileSync(path.join(RELEASES, 'latest.json'), JSON.stringify(latest, null, 2) + '\n', 'utf8');

console.log('=== KBL Publish ===');
console.log('版本:', manifest.catalogVersion, '| rootHash:', rootHash.slice(0, 16) + '…');
console.log('快照:', 'kbl/releases/' + relName + (changed ? '（新建）' : '（内容未变，复用）'));
console.log('latest.json:', 'kbl/releases/latest.json');
console.log('审计: 重算 rootHash 一致 ✓  文件:', dataRels.length);