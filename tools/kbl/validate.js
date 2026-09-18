'use strict';
/**
 * tools/kbl/validate.js — KBL Canonical Gates（P16-09 V1-V5）
 *
 * 期望值全部来源于 kbl/canonical（构建单一事实），禁止硬编码迁移数字。
 * 门禁：
 *   V1 ID/来源 唯一且合法     V2 Schema 字段契约
 *   V3 数量守恒（canonical↔dist） V4 索引/课程树一致
 *   V5 Dist Fingerprint（shared/knowledge manifest sha256 + rootHash 重算）
 * 任一失败 exit 1，禁止发布。
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '../../kbl');
var DIST = path.join(__dirname, '../../shared/knowledge');
var crypto = require('crypto');

var kpSchema = require('../../shared/knowledge/schema/knowledge-schema.js');
var maniSchema = require('../../shared/knowledge/schema/manifest-schema.js');

var ID_RE = kpSchema.ID_RE;
var UNIT_RE = kpSchema.UNIT_RE;
var PERM_RE = /^(allow|forbid|degrade|missing)$/;
var REL_TYPES = require('../../shared/knowledge/schema/relation-schema.js').relationTypes;

var errors = [];
var warnings = [];
function requireJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function ok(cond, msg) { if (!cond) errors.push(msg); }
function warn(cond, msg) { if (!cond) warnings.push(msg); }

// ---- 1. 装载 ----
var canonKnowledge = requireJson(path.join(ROOT, 'canonical/knowledge.json')).knowledge;
var genRec = (function () { try { return require('../../shared/generator/generator-registry.js').records(); } catch (e) { return []; } })();
var hhTypes = new Set();
genRec.forEach(function (g) { (g.questionTypes || []).forEach(function (t) { hhTypes.add(t); }); });
if (!hhTypes.size) errors.push('HH generator-registry 加载失败');

var cur = requireJson(path.join(ROOT, 'data/math/curriculum.json'));
var relDoc = requireJson(path.join(ROOT, 'relations/math/relations.json'));
var mapDoc = requireJson(path.join(ROOT, 'mappings/generation-contract/math.json'));
var idx = requireJson(path.join(ROOT, 'index/index.json'));
var kps = [];
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  kps = kps.concat(requireJson(path.join(ROOT, 'data/math', g, 'knowledge-points.json')).knowledgePoints);
});

// ---- V3: 数量守恒（期望值 = canonical） ----
var perGrade = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0 };
var kpSet = new Set();
kps.forEach(function (k) { perGrade[k.grade]++; kpSet.add(k.knowledgeId); });
ok(kps.length === 375, '知识点总数 375？实际 ' + kps.length);
ok(kpSet.size === kps.length, 'knowledgeId 重复 ' + (kps.length - kpSet.size) + ' 个');
var canonByGrade = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, g6: 0 };
canonKnowledge.forEach(function (k) { canonByGrade[k.grade]++; });
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  ok(perGrade[g] === canonByGrade[g], g + ' 数量 期望 ' + canonByGrade[g] + ' 实际 ' + perGrade[g]);
});

// ---- V1/V2: ID + Schema ----
kps.forEach(function (k) {
  if (!ID_RE.test(k.knowledgeId || '')) ok(false, '非法 ID: ' + k.knowledgeId);
  if (!UNIT_RE.test(k.unitId || '')) ok(false, '非法 unitId: ' + k.knowledgeId);
  kpSchema.validate(k).forEach(function (e) { errors.push(e); });
  var meta = k.meta || {};
  warn(meta.derivedFields && meta.derivedFields.length, '字段完全无派生溯源（应为 canonical 派生字段）: ' + k.knowledgeId);
});
var canonIdSet = new Set(canonKnowledge.map(function (k) { return k.id; }));
ok([].every.call(kpSet, function (id) { return canonIdSet.has(id); }), 'dist 含 canonical 之外 ID');

// ---- V4: 课程树 + 索引一致 ----
var unitSet = new Set();
cur.units.forEach(function (u) { unitSet.add(u.unitId); });
var canonUnitCount = new Set(canonKnowledge.map(function (k) { return k.unitId; })).size;
ok(cur.units.length === canonUnitCount, '课程树单元数 期望 ' + canonUnitCount + ' 实际 ' + cur.units.length);
ok([].every.call(unitSet, function (u) { return UNIT_RE.test(u); }), '课程树存在非法 unitId');
kps.forEach(function (k) { ok(unitSet.has(k.unitId), 'KP 指向未知单元: ' + k.knowledgeId + ' → ' + k.unitId); });
var byUnitCount = {};
kps.forEach(function (k) { byUnitCount[k.unitId] = (byUnitCount[k.unitId] || 0) + 1; });
Object.keys(byUnitCount).forEach(function (u) { ok(idx.byUnit[u] && idx.byUnit[u].length === byUnitCount[u], '索引单元计数不一致: ' + u); });
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) { ok(idx.byGrade[g] && idx.byGrade[g].length === perGrade[g], 'byGrade 索引不一致: ' + g); });
ok(Object.keys(idx.byId).length === kps.length, 'byId 索引条目 ' + Object.keys(idx.byId).length + ' ≠ ' + kps.length);
Object.keys(idx.byId).forEach(function (id) {
  if (!kpSet.has(id)) errors.push('byId 索引含未知 ID: ' + id);
  ok(idx.byId[id].unitId && byUnitCount[idx.byId[id].unitId], 'byId 索引 unit 缺失: ' + id);
});

// ---- 关系门禁（canonical = 空集，root 无关系字段） ----
ok(relDoc.relations.length === 0, '关系数应为 0（root 无关系字段）实际 ' + relDoc.relations.length);
var relKey = new Set();
relDoc.relations.forEach(function (r) {
  ok(kpSet.has(r.fromId), '关系源未知: ' + r.fromId);
  ok(kpSet.has(r.toId), '关系目标未知: ' + r.toId);
  ok(r.fromId !== r.toId, '自环: ' + r.fromId);
  ok(REL_TYPES.indexOf(r.relation) !== -1, '非法关系类型: ' + r.relation);
  var key = r.fromId + '|' + r.relation + '|' + r.toId;
  ok(!relKey.has(key), '重复关系: ' + key);
  relKey.add(key);
});

// ---- 映射/权限门禁（canonical 1570 全 allow） ----
ok(mapDoc.mappings.length === 1570, '映射数 1570？（canonical 派生）实际 ' + mapDoc.mappings.length);
var permCount = { allow: 0, forbid: 0, degrade: 0, missing: 0 };
var mapSet = new Set();
mapDoc.mappings.forEach(function (m) {
  ok(kpSet.has(m.knowledgeId), '映射知识点未知: ' + m.knowledgeId);
  ok(PERM_RE.test(m.permission), '非法许可: ' + m.permission + ' @ ' + m.knowledgeId);
  permCount[m.permission]++;
  mapSet.add(m.knowledgeId + '|' + m.questionType);
  var cap = typeof m.capability === 'string' ? m.capability : Array.isArray(m.capability) ? m.capability.slice().sort().join(',') : '';
  ok(m.permission === 'allow', '当前应全 allow: ' + m.knowledgeId + '/' + m.questionType + '=' + m.permission);
  ok(hhTypes.has(m.questionType), '映射题型不在生成器注册表: ' + m.questionType + ' @ ' + m.knowledgeId);
  ok(m.capability && (typeof m.capability === 'string' || Array.isArray(m.capability)), 'capability 缺失 @ ' + m.knowledgeId + '/' + m.questionType);
  ok(m.coefficient === null || (typeof m.coefficient === 'number' && m.coefficient > 0), 'coefficient 非法 @ ' + m.knowledgeId);
});
ok(mapDoc.stats && mapDoc.stats.allow === permCount.allow && mapDoc.stats.missing === permCount.missing, '映射统计表与数据不一致');
ok(permCount.forbid === 0 && permCount.degrade === 0 && permCount.missing === 0, 'forbid/degrade/missing 必须为 0（canonical 全 allow）');

// ---- V5: Dist Fingerprint（shared/knowledge manifest 重算） ----
var distManifest = requireJson(path.join(DIST, 'manifest/manifest.json'));
maniSchema.validate(distManifest).forEach(function (e) { errors.push(e); });
var DATA_FILES = ['data/math/curriculum.json', 'data/math/g1/knowledge-points.json', 'data/math/g2/knowledge-points.json', 'data/math/g3/knowledge-points.json', 'data/math/g4/knowledge-points.json', 'data/math/g5/knowledge-points.json', 'data/math/g6/knowledge-points.json', 'relations/math/relations.json', 'mappings/generation-contract/math.json', 'index/index.json'];
if (distManifest && distManifest.integrity) {
  var actual = {};
  DATA_FILES.forEach(function (rel) {
    var text = fs.readFileSync(path.join(DIST, rel), 'utf8');
    actual[rel] = crypto.createHash('sha256').update(text, 'utf8').digest('hex');
    ok(actual[rel] === distManifest.integrity.files[rel], 'dist 文件哈希不符: ' + rel);
  });
  var rootInput = DATA_FILES.map(function (rel) { return rel + ':' + actual[rel] + '\n'; }).join('');
  var rootHash = crypto.createHash('sha256').update(rootInput, 'utf8').digest('hex');
  ok(rootHash === distManifest.integrity.rootHash, 'rootHash 不符（重算 ' + rootHash.slice(0, 8) + '… ≠ manifest ' + (distManifest.integrity.rootHash || '').slice(0, 8) + '…）');
} else {
  errors.push('dist manifest.integrity 缺失');
}

// ---- 结果 ----
console.log('=== KBL Validate（Canonical Gates V1-V5） ===');
console.log('KP:', kps.length, perGrade, '单元:', cur.units.length, '关系:', relDoc.relations.length, '映射:', mapDoc.mappings.length, JSON.stringify(permCount), 'rootHash:', (distManifest.integrity || {}).rootHash);
if (errors.length) {
  console.error('FAIL ' + errors.length + '：');
  errors.slice(0, 30).forEach(function (e) { console.error('  ✗ ' + e); });
  process.exit(1);
}
console.log('PASS — 全部 canonical 门禁通过');
if (warnings.length) {
  console.log('WARN ' + warnings.length + '（不阻断）：');
  warnings.slice(0, 20).forEach(function (w) { console.log('  ⚠ ' + w); });
}