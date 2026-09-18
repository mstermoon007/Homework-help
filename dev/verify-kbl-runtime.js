#!/usr/bin/env node
/**
 * dev/verify-kbl-runtime.js — KBL Runtime E2E（Phase C 门禁）
 *
 * 覆盖：数据装载 + rootHash 完整性、Public API 白名单、核心查询、
 *       可练性/权限裁决、关系闭包、单元/索引一致性。
 * 运行：node dev/verify-kbl-runtime.js   （exit 非 0 = 失败）
 */
'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');

global.App = global.App || {};
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-contract.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-loader.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-relation.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-policy.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-index.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-query.js'));
require(path.join(ROOT, 'shared/knowledge/runtime/knowledge-api.js'));

const Contract = global.App.KNOWLEDGE_CONTRACT;
const Loader = global.App.KNOWLEDGE_LOADER;
const Relation = global.App.KNOWLEDGE_RELATION;
const Policy = global.App.KNOWLEDGE_POLICY;
const Index = global.App.KNOWLEDGE_INDEX;
const Query = global.App.KNOWLEDGE_QUERY;
const K = global.App.KNOWLEDGE;

const fail = [];
function assert(name, cond, detail) {
  if (!cond) fail.push(name + (detail ? ' — ' + detail : ''));
  console.log((cond ? '  ✓ ' : '  ✗ ') + name);
}

// ---- 1. 数据装载 + 完整性 ----
const s = K.stats();
assert('数量守恒: 375 KP', s.knowledgePoints === 375, JSON.stringify(s.byGrade));
assert('单元 98 / 关系 0 / 映射 1570', s.units === 98 && s.relations === 0 && s.mappings === 1570);
assert('permission 全 allow(canonical: 1570 allow)', s.permissions.allow === 1570 && s.permissions.forbid === 0 && s.permissions.degrade === 0 && s.permissions.missing === 0);

const manifest = require(path.join(ROOT, 'shared/knowledge/manifest/manifest.json'));
const rels = ['data/math/curriculum.json', 'data/math/g1/knowledge-points.json', 'data/math/g2/knowledge-points.json', 'data/math/g3/knowledge-points.json', 'data/math/g4/knowledge-points.json', 'data/math/g5/knowledge-points.json', 'data/math/g6/knowledge-points.json', 'relations/math/relations.json', 'mappings/generation-contract/math.json', 'index/index.json'];
const rootInput = rels.map(r => {
  const b = fs.readFileSync(path.join(ROOT, 'shared/knowledge', r));
  return r + ':' + crypto.createHash('sha256').update(b).digest('hex') + '\n';
}).join('');
const rootHash = crypto.createHash('sha256').update(rootInput).digest('hex');
assert('rootHash 一致性: ' + rootHash.slice(0, 12), rootHash === manifest.integrity.rootHash);

// ---- 2. Public API 白名单 ----
assert('Public API 白名单', JSON.stringify(Object.keys(K).sort()) === JSON.stringify(Contract.publicApi), Object.keys(K).sort().join(','));
Contract.publicApi.forEach(name => assert('API 存在: ' + name, typeof K[name] === 'function'));

// ---- 2b. 内部模块存在（runtime 内部分层按方案 §19 固化）----
const drillId = 'math-g1-up-u05-k001';
const judgeId = 'math-g1-down-u01-k001';
assert('KNOWLEDGE_INDEX 存在', !!Index && typeof Index.byUnit === 'function');
assert('KNOWLEDGE_QUERY 存在', !!Query && typeof Query.byGrade === 'function');
assert('Index byId(凑十)=published', Index.byId(drillId) && Index.byId(drillId).status === 'active');
assert('Index byGrade g1 × 39', Index.byGrade('g1').length === 39);
assert('Index byUnit 凑十单元 × 3', Index.byUnit('math-g1-up-u05').length === 3);
assert('Index 总数 375', Index.count() === 375);

// ---- 3. 核心查询 ----
assert('get(凑十 KP)', K.get(drillId) && K.get(drillId).name === '凑十法');
assert('byGrade g1 × 39', K.byGrade('g1').length === 39);
assert('byBook g2/up × 28', K.byBook('g2', 'up').length === 28);
assert('byUnit 凑十单元 × 3', K.byUnit('math-g1-up-u05').length === 3);
assert('unit() 元数据', K.unit('math-g1-up-u05').knowledgePointCount === 3 && K.unit('math-g1-up-u05').unitName === '20以内的进位加法');
const selG1 = K.selectable({ grade: 'g1' });
assert('selectable(g1) 全部可生成', selG1.every(k => Policy.isSelectable(k)) && selG1.length <= 39);

// ---- 4. 权限裁决 ----
// canonical：全部映射 allow；无映射类型（essay）→ missing；未知 KP → unknown
const judgeRes = K.canGenerate(judgeId, 'judge');
assert('canGenerate(judge)=allow', judgeRes.allowed && judgeRes.permission === 'allow');
const realRes = K.canGenerate(drillId, 'calc');
assert('canGenerate(calc 凑十)=allow', realRes.allowed && realRes.permission === 'allow');
const noEssay = K.canGenerate(drillId, 'essay');
assert('canGenerate(essay)=missing', !noEssay.allowed && noEssay.permission === 'missing');
assert('canGenerate(未知 KP)=unknown', !K.canGenerate('math-g0-up-u01-k001', 'calc').allowed);

// ---- 5. 关系 + 闭包（canonical relations 为空集 → 空语义断言）----
assert('关系完整性 0 issue', Relation.integrityCheck().pass === true && Relation.integrityCheck().issues.length === 0);
assert('relationsFor(凑十) 0 出边', K.relationsFor(drillId).outgoing.length === 0 && K.relationsFor(drillId).incoming.length === 0);
const cls = Relation.closure(drillId, { types: ['related'], direction: 'out', maxDepth: 5 });
assert('closure(related) 空结果', Array.isArray(cls) && cls.length === 0, 'closure size ' + cls.length);

// ---- 6. 搜索与别名 ----
assert('searchByName 定位凑十 KP', K.searchByName('凑十').some(k => k.knowledgeId === drillId));

// ---- 结果 ----
console.log('\n=== KBL Runtime E2E 结果 ===');
if (fail.length) {
  console.error('FAIL ' + fail.length);
  fail.forEach(f => console.error('  ✗ ' + f));
  process.exit(1);
}
console.log('PASS — KBL Runtime E2E 全部通过');