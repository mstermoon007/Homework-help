#!/usr/bin/env node
'use strict';
/**
 * dev/p30/check-kbl-lineage.js — P30-02 Excel→KBL 唯一派生链血缘门禁
 *
 * 锁定唯一链路（任何最终数据必须可沿此链追溯到 root Excel）：
 *
 *   kbl/root/*.xlsx（T0 人工事实源，只读）
 *     → tools/kbl/extract-source.js   → kbl/import/extract-raw.json
 *     → tools/kbl/derive-kbl.js       → kbl/canonical/{course,knowledge,capability,mappings,relations(空集)}
 *     → tools/kbl/derive-relations.js → kbl/canonical/relations.json（373 inferred 覆盖空集）
 *     → tools/kbl/emit-canonical.js  → kbl/data · kbl/relations · kbl/mappings · kbl/index（发射副本）
 *     → tools/kbl/build.js           → shared/knowledge（运行时只读镜像）+ manifest/rootHash
 *
 * 职责裁决（P30-02，消除 relations 双位置混淆）：
 *   - kbl/canonical/relations.json 是关系集**唯一派生真源**（derive-relations.js 专责写入）；
 *   - kbl/relations/math/relations.json 与 shared/knowledge/relations/math/relations.json
 *     都是**发射副本**（emit/build 复制），禁止任何手工/脚本旁路写入；
 *   - mappings 同理：canonical/mappings.json 真源，两处副本只允许发射链写入。
 *
 * 本门禁断言：
 *   L1 root Excel SHA256 == extract-raw.fingerprint.fileHash（Excel 改后必须重跑 extract）
 *   L2 extract 统计 == canonical 计数（course/units/knowledge）
 *   L3 canonical/relations == kbl/relations == shared/relations（逐字节内容相等）
 *   L4 canonical/mappings（去 derivation 投影）== kbl/mappings == shared/mappings
 *   L5 kbl/data 课程树/各年级 KP/index == shared/knowledge 镜像
 *   L6 kbl manifest 与 shared manifest rootHash 一致且可重算
 *
 * 用法：node dev/p30/check-kbl-lineage.js（0=PASS，1=FAIL）
 * 导出：runLineageChecks(rootDir) → { checks: [{id,name,ok,detail}], findings }
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function runLineageChecks(ROOT) {
  ROOT = ROOT || path.resolve(__dirname, '..', '..');
  const readJson = function (rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); };
  const eq = function (a, b) { return JSON.stringify(a) === JSON.stringify(b); };
  const sha = function (rel) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); };

  const findings = [];
  const checks = [];
  function check(id, name, ok, detail) {
    checks.push({ id: id, name: name, ok: !!ok, detail: detail || '' });
    if (!ok) findings.push({ level: 'fail', code: id, message: name + (detail ? ' — ' + detail : '') });
  }

  // L1 source traceability
  const raw = readJson('kbl/import/extract-raw.json');
  const rootRel = 'kbl/root/小学G1-G6数学知识点.xlsx';
  const rootHash = sha(rootRel);
  check('L1', 'root Excel 指纹 == extract-raw.fingerprint',
    !!(raw.fingerprint && raw.fingerprint.fileHash === rootHash),
    raw.fingerprint ? raw.fingerprint.fileHash.slice(0, 12) + ' vs ' + rootHash.slice(0, 12) : 'fingerprint 缺失');

  // L2 extract stats == canonical
  const knowDoc = readJson('kbl/canonical/knowledge.json');
  const courseDoc = readJson('kbl/canonical/course.json');
  const unitSet = new Set(knowDoc.knowledge.map(function (k) { return k.unitId; }));
  check('L2a', 'extract knowledge 行数 == canonical knowledge',
    raw.stats.sourceRows === knowDoc.knowledge.length, raw.stats.sourceRows + ' vs ' + knowDoc.knowledge.length);
  check('L2b', 'extract course 数 == canonical course',
    raw.stats.courseCount === courseDoc.course.length, raw.stats.courseCount + ' vs ' + courseDoc.course.length);
  check('L2c', 'extract unit 数 == canonical unitId 去重数',
    raw.stats.unitCount === unitSet.size, raw.stats.unitCount + ' vs ' + unitSet.size);

  // L3 relations lineage
  const canonRel = readJson('kbl/canonical/relations.json').relations;
  const kblRel = readJson('kbl/relations/math/relations.json').relations;
  const sharedRel = readJson('shared/knowledge/relations/math/relations.json').relations;
  check('L3a', 'canonical/relations → kbl/relations（emit 副本相等）', eq(canonRel, kblRel),
    canonRel.length + ' vs ' + kblRel.length);
  check('L3b', 'kbl/relations → shared/relations（build 镜像相等）', eq(kblRel, sharedRel),
    kblRel.length + ' vs ' + sharedRel.length);

  // L4 mappings lineage（emit 剥离 derivation 字段）
  const canonMap = readJson('kbl/canonical/mappings.json').mappings.map(function (m) {
    const x = JSON.parse(JSON.stringify(m)); delete x.derivation; return x;
  });
  const kblMap = readJson('kbl/mappings/generation-contract/math.json').mappings;
  const sharedMap = readJson('shared/knowledge/mappings/generation-contract/math.json').mappings;
  let mapDrift = 0;
  if (!eq(canonMap, kblMap)) {
    const cIndex = {}; canonMap.forEach(function (m) { cIndex[m.knowledgeId + '|' + m.questionType] = m; });
    kblMap.forEach(function (m) {
      const c = cIndex[m.knowledgeId + '|' + m.questionType];
      if (c && !eq(c, m)) mapDrift++;
    });
  }
  check('L4a', 'canonical/mappings → kbl/mappings（emit 投影相等）', eq(canonMap, kblMap),
    mapDrift ? mapDrift + ' 行内容漂移（典型：canonical 残留旧 pluginId）' : canonMap.length + ' 行一致');
  check('L4b', 'kbl/mappings → shared/mappings（build 镜像相等）', eq(kblMap, sharedMap),
    kblMap.length + ' vs ' + sharedMap.length);

  // L5 data/index lineage
  const grades = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'];
  let dataOk = true; const detail = [];
  grades.forEach(function (g) {
    const a = readJson('kbl/data/math/' + g + '/knowledge-points.json');
    const b = readJson('shared/knowledge/data/math/' + g + '/knowledge-points.json');
    if (!eq(a, b)) { dataOk = false; detail.push(g + ':' + a.knowledgePoints.length + 'vs' + b.knowledgePoints.length); }
  });
  check('L5a', 'kbl/data 各年级 KP → shared/knowledge 镜像相等', dataOk, detail.join('; '));
  check('L5b', 'kbl/data curriculum → shared curriculum 相等',
    eq(readJson('kbl/data/math/curriculum.json'), readJson('shared/knowledge/data/math/curriculum.json')));
  check('L5c', 'kbl/index → shared index 相等',
    eq(readJson('kbl/index/index.json'), readJson('shared/knowledge/index/index.json')));

  // L6 manifest rootHash
  const kblManifest = readJson('kbl/manifest/manifest.json');
  const sharedManifest = readJson('shared/knowledge/manifest/manifest.json');
  const DATA_RELS = ['data/math/curriculum.json',
    'data/math/g1/knowledge-points.json', 'data/math/g2/knowledge-points.json',
    'data/math/g3/knowledge-points.json', 'data/math/g4/knowledge-points.json',
    'data/math/g5/knowledge-points.json', 'data/math/g6/knowledge-points.json',
    'relations/math/relations.json', 'mappings/generation-contract/math.json', 'index/index.json'];
  const recomputed = DATA_RELS.map(function (rel) {
    return rel + ':' + crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', rel))).digest('hex') + '\n';
  }).join('');
  const rootHashCalc = crypto.createHash('sha256').update(recomputed).digest('hex');
  check('L6a', 'shared manifest rootHash 可重算', rootHashCalc === (sharedManifest.integrity || {}).rootHash,
    rootHashCalc.slice(0, 12) + ' vs ' + ((sharedManifest.integrity || {}).rootHash || '').slice(0, 12));
  check('L6b', 'kbl manifest rootHash == shared manifest rootHash',
    kblManifest.rootHash === (sharedManifest.integrity || {}).rootHash);
  check('L6c', 'manifest counts == 实测（375/98/373/1570）',
    kblManifest.counts && kblManifest.counts.knowledgePoints === knowDoc.knowledge.length &&
    kblManifest.counts.units === unitSet.size &&
    kblManifest.counts.relations === canonRel.length &&
    kblManifest.counts.mappings === canonMap.length,
    JSON.stringify(kblManifest.counts));

  return { checks: checks, findings: findings };
}

if (require.main === module) {
  const result = runLineageChecks(path.resolve(__dirname, '..', '..'));
  console.log('=== P30-02 KBL 血缘门禁（Excel→canonical→runtime 唯一派生链） ===');
  result.checks.forEach(function (c) {
    process.stdout.write((c.ok ? '  ✓ ' : '  ✗ ') + c.id + '  ' + c.name);
    if (c.detail) process.stdout.write('  [' + c.detail + ']');
    process.stdout.write('\n');
  });
  if (result.findings.length) {
    console.log('\nFAIL ' + result.findings.length + ' 项 — 按链路重跑：npm run kbl:rebuild（禁止手改 canonical/runtime/teaching）');
    process.exit(1);
  }
  console.log('\nPASS — 全部最终数据可沿唯一派生链追溯到 root Excel');
}

module.exports = { runLineageChecks: runLineageChecks };
