'use strict';
/**
 * tools/kbl/root-hash.js — P41-B1：KBL rootHash 输入清单的单一权威来源
 *
 * 背景：tools/kbl/build.js 计算 rootHash 时覆盖「数据文件序」path:hash\n 列表；
 *   dev/p30/check-kbl-lineage.js（L6a）与 dev/check-kbl-quality.js（Q9）各自硬编码了一份
 *   旧列表（缺 teaching/ 三份镜像文件），导致复算值与 manifest.rootHash 不一致，
 *   且脚本未接入统一门禁 → 长期未被发现。
 *
 * 本模块是该列表与算法的唯一权威：构建与全部校验脚本一律从此读取，
 *   禁止再维护第二份手工文件清单。
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

// rootHash 计算的输入文件与顺序（与 build.js emit 顺序中参与指纹的数据文件一致；
// manifest 自身不入指纹）。修改此列表即变更 rootHash 定义，须同步重跑 kbl:rebuild。
var DATA_RELS = [
  'data/math/curriculum.json',
  'data/math/g1/knowledge-points.json',
  'data/math/g2/knowledge-points.json',
  'data/math/g3/knowledge-points.json',
  'data/math/g4/knowledge-points.json',
  'data/math/g5/knowledge-points.json',
  'data/math/g6/knowledge-points.json',
  'relations/math/relations.json',
  'mappings/generation-contract/math.json',
  'index/index.json',
  'teaching/misconception-profiles.json',
  'teaching/qt-intent-runtime.json',
  'teaching/context-library.json'
];

function sha(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 按 DATA_RELS 顺序拼装 `rel:sha256(file)\n` 再取 sha256 */
function hashInput(entries) {
  return sha(entries.join(''));
}

/** 从 baseDir 读取 DATA_RELS 全部文件并复算 rootHash */
function computeRootHash(baseDir) {
  var entries = DATA_RELS.map(function (rel) {
    return rel + ':' + sha(fs.readFileSync(path.join(baseDir, rel), 'utf8')) + '\n';
  });
  return hashInput(entries);
}

module.exports = {
  DATA_RELS: DATA_RELS,
  sha: sha,
  hashInput: hashInput,
  computeRootHash: computeRootHash
};
