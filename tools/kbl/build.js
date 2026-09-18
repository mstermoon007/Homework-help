'use strict';
/**
 * tools/kbl/build.js — Canonical Build（Step 13/15-16：镜像发布 + 完整性指纹）
 *
 * 源：kbl/（Canonical Source，含迁移期 oldUnitId 溯源字段）
 * 目标：shared/knowledge/（Runtime 分发数据，剥离迁移字段，含 per-file sha256 + rootHash）
 *   data/math/curriculum.json
 *   data/math/g{1..6}/knowledge-points.json
 *   relations/math/relations.json
 *   mappings/generation-contract/math.json
 *   index/index.json
 *   manifest/manifest.json
 *
 * 幂等：无变更时产物与哈希不变。rootHash 同时回填 kbl/manifest/manifest.json。
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var SRC = path.join(__dirname, '../../kbl');
var DST = path.join(__dirname, '../../shared/knowledge');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) {
  var text = JSON.stringify(obj, null, 2) + '\n';
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text, 'utf8');
  return text;
}
function sha(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }

// ---- 1. 装载 Canonical Source ----
var curriculum = readJson(path.join(SRC, 'data/math/curriculum.json'));
var grades = {};
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  grades[g] = readJson(path.join(SRC, 'data/math', g, 'knowledge-points.json'));
});
var relations = readJson(path.join(SRC, 'relations/math/relations.json'));
var mappings = readJson(path.join(SRC, 'mappings/generation-contract/math.json'));

// ---- 2. Strip 迁移期溯源字段（distribution = runtime 数据，仅 canonical 字段） ----
// 注意：顶层 generatedAt 也须剥离 —— 否则每次 normalize 会刷新时间戳，导致 rootHash 随重建漂移，
//      无法满足「ID/Index/Manifest/Hash 均为可复现产物」的要求（时间戳仅保留在源 manifest 溯源）。
var distCurriculum = JSON.parse(JSON.stringify(curriculum));
delete distCurriculum.generatedAt;
distCurriculum.units = distCurriculum.units.map(function (u) {
  var copy = JSON.parse(JSON.stringify(u));
  delete copy.oldUnitId;
  return copy;
});

// ---- 3. 写入分发目录并计算数据文件哈希（rootHash 仅覆盖数据，manifest 不入指纹） ----
var files = {};
function emit(rel, text) {
  var target = path.join(DST, rel);
  writeJson(target, JSON.parse(text));
  var content = readJson(target);
  writeJson(target, content); // 幂等规范化后回写
  files[rel] = sha(fs.readFileSync(target, 'utf8'));
}

emit('data/math/curriculum.json', JSON.stringify(distCurriculum));
Object.keys(grades).forEach(function (g) { emit('data/math/' + g + '/knowledge-points.json', JSON.stringify(grades[g])); });
emit('relations/math/relations.json', JSON.stringify(relations));
emit('mappings/generation-contract/math.json', JSON.stringify(mappings));

// index 由源拷贝（不含迁移字段）
var index = readJson(path.join(SRC, 'index/index.json'));
emit('index/index.json', JSON.stringify(index));

// ---- 4. Manifest + rootHash（数据文件序: path:hash） ----
var kpCount = Object.keys(grades).reduce(function (n, g) { return n + grades[g].knowledgePoints.length; }, 0);
var DATA_RELS = ['data/math/curriculum.json', 'data/math/g1/knowledge-points.json', 'data/math/g2/knowledge-points.json', 'data/math/g3/knowledge-points.json', 'data/math/g4/knowledge-points.json', 'data/math/g5/knowledge-points.json', 'data/math/g6/knowledge-points.json', 'relations/math/relations.json', 'mappings/generation-contract/math.json', 'index/index.json'];
var rootInput = DATA_RELS.map(function (rel) { return rel + ':' + files[rel] + '\n'; }).join('');
var rootHash = sha(rootInput);
var manifest = {
  schemaVersion: curriculum.schemaVersion,
  catalogVersion: 'math-v1.0.0',
  packageVersion: 'kbl-math-' + new Date().toISOString().slice(0, 10),
  buildTool: 'tools/kbl/build.js',
  buildAt: new Date().toISOString(),
  counts: { knowledgePoints: kpCount, units: curriculum.units.length, relations: relations.relations.length, mappings: mappings.mappings.length },
  idRules: { pattern: '^(math|chinese|english)-g[1-6]-(up|down|mixed|advance|comprehensive)-u\\d{2}-k\\d{3}$', stable: true, generatedOnce: true, runtimePositionIndependent: true },
  integrity: { algorithm: 'sha256', files: files, rootHash: rootHash }
};
writeJson(path.join(DST, 'manifest/manifest.json'), manifest);

// ---- 5. rootHash 回填 canonical source manifest（溯源一致） ----
var srcManifest = readJson(path.join(SRC, 'manifest/manifest.json'));
srcManifest.rootHash = rootHash;
srcManifest.distributedRootHash = rootHash;
srcManifest.counts = manifest.counts;
writeJson(path.join(SRC, 'manifest/manifest.json'), srcManifest);

console.log('=== KBL Build（Canonical → Runtime Mirror） ===');
console.log('KP:', kpCount, '总数 | shared/knowledge 文件:', Object.keys(files).length);
console.log('rootHash:', rootHash);
console.log('目标: shared/knowledge/');