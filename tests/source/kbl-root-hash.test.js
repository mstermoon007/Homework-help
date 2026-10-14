/**
 * tests/source/kbl-root-hash.test.js — P41-B1
 *
 * 缺陷：rootHash 输入清单曾有多份手工副本（build.js 13 文件；lineage/quality 10 文件），
 *   lineage L6a 与 quality Q9 长期复算不一致。修复后统一为 tools/kbl/root-hash.js。
 *
 * 覆盖：权威清单完整性（含曾缺失的 3 份 teaching 文件）、真实镜像可复算、
 *   以及「篡改内容 / 变更顺序必须失败」的负例。
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
const RootHash = require(path.join(ROOT, 'tools', 'kbl', 'root-hash.js'));

test('P41-B1 权威清单含全部 13 份输入（含曾缺失的 3 份 teaching 文件）', () => {
  assert.strictEqual(RootHash.DATA_RELS.length, 13);
  for (const rel of [
    'teaching/misconception-profiles.json',
    'teaching/qt-intent-runtime.json',
    'teaching/context-library.json'
  ]) {
    assert.ok(RootHash.DATA_RELS.includes(rel), 'DATA_RELS 应包含 ' + rel);
  }
  assert.strictEqual(new Set(RootHash.DATA_RELS).size, 13, 'DATA_RELS 不得有重复项');
});

test('P41-B1 真实分发镜像 rootHash 可复算 == manifest.rootHash', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', 'manifest', 'manifest.json'), 'utf8'));
  assert.strictEqual(RootHash.computeRootHash(path.join(ROOT, 'shared', 'knowledge')), manifest.integrity.rootHash);
});

test('P41-B1 负例：任一输入内容被篡改 → hash 变化', () => {
  const base = RootHash.DATA_RELS.map((rel) => rel + ':deadbeef\n');
  const tampered = base.slice();
  tampered[0] = RootHash.DATA_RELS[0] + ':cafebabe\n';
  assert.notStrictEqual(RootHash.hashInput(base), RootHash.hashInput(tampered));
});

test('P41-B1 负例：输入顺序变化 → hash 变化', () => {
  const base = RootHash.DATA_RELS.map((rel) => rel + ':00\n');
  const swapped = base.slice();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  assert.notStrictEqual(RootHash.hashInput(base), RootHash.hashInput(swapped));
});

test('P41-B1 正例：完全相同的输入 → hash 稳定（确定性）', () => {
  const base = RootHash.DATA_RELS.map((rel) => rel + ':00\n');
  assert.strictEqual(RootHash.hashInput(base), RootHash.hashInput(base.slice()));
});
