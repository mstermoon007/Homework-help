#!/usr/bin/env node
/**
 * dev/check-kbl-quality.js — KBL 收口 M17 数据质量门禁（9 项，全新 canonical 数据层）
 *
 * 9 项：
 *   Q1  数量守恒：unit 98 / KP 375 / relations 0 / mappings 1570 with kbl/manifest 一致
 *   Q2  Canonical relations 为空集（释义派生，无迁移关系）；roundtrip 保障 source 一致
 *   Q3  ID 规则：全部 KP id 匹配规范 pattern 且全局唯一
 *   Q4  引用完整性：KP.unitId→单元、mapping.knowledgeId→KP、relation 端点→KP 零悬空
 *   Q5  关系质量：无自环、无重复三元组、prerequisite 无环（canonical 下恒真）
 *   Q6  映射真实性：permission∈{allow,missing}；allow⇒questionType∈规范7类且 pluginId 非空（canonical 全 allow）
 *   Q7  Canonical↔Release 快照一致：kbl/manifest.counts == shared manifest.counts（三方一致）
 *   Q8  Runtime 一致性：运行时 KP / 单元 / 关系 / permission 计数与 canonical 完全一致
 *   Q9  Schema/计数审计：释放包 10 文件 rootHash 复算一致（kbl/manifest.rootHash ↔ shared integrity.rootHash）
 *
 * ALL PASS 才退出码 0。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var ROOT = path.join(__dirname, '..');

var Registry = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var REG_TYPES = (Registry.TYPES || []).map(function (t) { return t.id; });
var CANON_ID = /^math-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;

var EXPECT = { knowledgePoints: 375, units: 98, relations: 0, mappings: 1570 };

function readJson(p) { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }

var pass = true;
var results = [];
function item(name, cond, detail) {
  results.push({ name: name, pass: !!cond, detail: cond ? '' : detail });
  console.log((cond ? '  [PASS] ' : '  [FAIL] ') + name + (cond ? '' : '  -> ' + detail));
  pass = pass && cond;
}

console.log('=== KBL M17 数据质量门禁（9 项，canonical） ===');
console.log('');

var manifest = readJson('kbl/manifest/manifest.json');
var distManifest = readJson('shared/knowledge/manifest/manifest.json');
var index = readJson('kbl/index/index.json');
var units = Object.keys(index.byUnit || {});
var kpIds = Object.keys(index.byId || {});
var byId = index.byId || {};
var rels = readJson('kbl/relations/math/relations.json').relations;
var mappings = readJson('kbl/mappings/generation-contract/math.json');
if (!Array.isArray(mappings)) mappings = mappings.mappings || [];

// ---- Q1 数量守恒 ----
var mc = manifest.counts || {};
item('Q1 数量守恒(kbl/manifest 98/375/0/1570)',
  mc.units === EXPECT.units && mc.knowledgePoints === EXPECT.knowledgePoints && mc.relations === EXPECT.relations && mc.mappings === EXPECT.mappings,
  JSON.stringify(mc));

// ---- Q2 Canonical relations 空集 ----
item('Q2 relations==0（释义派生、无迁移关系集）', rels.length === 0, 'relations=' + rels.length);

// ---- Q3 ID 规则 ----
var badIds = kpIds.filter(function (id) { return !CANON_ID.test(id); });
var uniqOk = new Set(kpIds).size === kpIds.length;
item('Q3 ID pattern+唯一', badIds.length === 0 && uniqOk, 'badPattern=' + badIds.length + ' uniq=' + uniqOk);

// ---- Q4 引用完整性 ----
var kpSet = {}; kpIds.forEach(function (id) { kpSet[id] = 1; });
var unitSet = {}; units.forEach(function (u) { unitSet[u] = 1; });
var danglingUnit = 0, danglingMap = 0, danglingRel = 0;
kpIds.forEach(function (id) { if (!unitSet[byId[id].unitId]) danglingUnit++; });
mappings.forEach(function (m) { if (!kpSet[m.knowledgeId]) danglingMap++; });
rels.forEach(function (r) { if (!kpSet[r.fromId] || !kpSet[r.toId]) danglingRel++; });
item('Q4 引用完整性零悬空(unit/mapping/relation)',
  danglingUnit === 0 && danglingMap === 0 && danglingRel === 0,
  'dangling unit=' + danglingUnit + ' mapping=' + danglingMap + ' relation=' + danglingRel);

// ---- Q5 关系质量 ----
var self = rels.filter(function (r) { return r.fromId === r.toId; }).length;
var triples = new Set(rels.map(function (r) { return r.fromId + '|' + r.relation + '|' + r.toId; }));
var dupTriples = rels.length - triples.size;
var out = {};
rels.filter(function (r) { return r.relation === 'prerequisite'; }).forEach(function (r) {
  (out[r.fromId] = out[r.fromId] || []).push(r.toId);
});
var state = {}; var cycles = 0;
function dfs(n) {
  state[n] = 1; (out[n] || []).forEach(function (m) { if (state[m] === 1) cycles++; else if (!state[m]) dfs(m); }); state[n] = 2;
}
Object.keys(out).forEach(function (n) { if (!state[n]) dfs(n); });
item('Q5 关系质量(自环0/重复0/环0)', self === 0 && dupTriples === 0 && cycles === 0,
  'self=' + self + ' dupTriples=' + dupTriples + ' cycles=' + cycles);

// ---- Q6 映射真实性 ----
var allowCount = 0, missingCount = 0, badPerm = 0, badAllowQt = 0, badAllowPlugin = 0;
mappings.forEach(function (m) {
  if (m.permission === 'allow') {
    allowCount++;
    if (REG_TYPES.indexOf(m.questionType) === -1) badAllowQt++;
    if (!m.pluginId) badAllowPlugin++;
  } else if (m.permission === 'missing') {
    missingCount++;
  } else badPerm++;
});
item('Q6 映射真实性(allow1570/missing0/派生合规)',
  allowCount === EXPECT.mappings && missingCount === 0 && badPerm === 0 && badAllowQt === 0 && badAllowPlugin === 0,
  'allow=' + allowCount + ' missing=' + missingCount + ' badPerm=' + badPerm + ' badAllowQt=' + badAllowQt + ' badPlugin=' + badAllowPlugin);

// ---- Q7 Canonical↔Release 快照一致（kbl/manifest ↔ shared manifest 计数三方一致） ----
var dc = distManifest.counts || {};
item('Q7 kbl/manifest ↔ shared manifest 计数一致(98/375/0/1570)',
  dc.units === EXPECT.units && dc.knowledgePoints === EXPECT.knowledgePoints && dc.relations === EXPECT.relations && dc.mappings === EXPECT.mappings,
  'shared counts=' + JSON.stringify(dc));

// ---- Q8 Runtime 一致性 ----
var runtimeOk = (function () {
  try {
    var K = require(path.join(ROOT, 'shared', 'knowledge', 'runtime', 'knowledge-runtime.js'));
    var KB = K && (K.KB || K);
    var s = KB.stats ? KB.stats() : null;
    if (!s) return false;
    return s.units === EXPECT.units && s.knowledgePoints === EXPECT.knowledgePoints && s.relations === EXPECT.relations && s.mappings === EXPECT.mappings
      && s.permissions.allow === EXPECT.mappings && s.permissions.forbid === 0 && s.permissions.degrade === 0 && s.permissions.missing === 0;
  } catch (e) { return false; }
})();
item('Q8 运行时 stats 一致(98/375/0/1570)', runtimeOk, 'runtime 未通过');

// ---- Q9 释放包 rootHash 复算审计（复刻 build.js 算法：10 数据文件序 path:hash\n → sha256） ----
var hashOk = (function () {
  try {
    var DATA_RELS = ['data/math/curriculum.json', 'data/math/g1/knowledge-points.json', 'data/math/g2/knowledge-points.json', 'data/math/g3/knowledge-points.json', 'data/math/g4/knowledge-points.json', 'data/math/g5/knowledge-points.json', 'data/math/g6/knowledge-points.json', 'relations/math/relations.json', 'mappings/generation-contract/math.json', 'index/index.json'];
    var sha = function (s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); };
    var rootInput = DATA_RELS.map(function (rel) { return rel + ':' + sha(fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', rel), 'utf8')) + '\n'; }).join('');
    var recomputed = sha(rootInput);
    var distRoot = distManifest.integrity && distManifest.integrity.rootHash;
    return recomputed === manifest.rootHash && (!!distRoot && recomputed === distRoot);
  } catch (e) { return false; }
})();
item('Q9 释放包 rootHash 复算(kbl/manifest ↔ shared integrity)', hashOk, 'rootHash 不一致');

console.log('');
var allPass = pass && results.filter(function (x) { return !x.pass; }).length === 0;
console.log(allPass ? 'M17 数据质量门禁: ALL PASS (9/9)' : 'M17 数据质量门禁: ' + results.filter(function (x) { return x.pass; }).length + '/9 PASS --- 存在缺陷');
process.exitCode = allPass ? 0 : 1;