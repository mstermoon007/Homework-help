'use strict';
/**
 * tools/kbl/roundtrip.js — Source 往返回归门禁（P16 重建）
 *
 * 断言：
 *   ① 同一 root Excel → 两次完整重建（extract→derive→emit→validate→build）数据一致（幂等）
 *   ② 当前 kbl/data 产物与重建结果一致（source 可靠 → 产物可复现）
 * 比较时剔除易变时间戳（generatedAt/buildAt/packageVersion/rootHash）。
 *
 * 用法：node tools/kbl/roundtrip.js
 */
var cp = require('child_process');
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
function run(script, args) {
  var r = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools/kbl', script)].concat(args || []), { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) {
    console.error('[roundtrip] ' + script + ' FAILED\n' + (r.stdout || '') + (r.stderr || ''));
    process.exit(r.status || 1);
  }
  return r.stdout;
}

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function strip(o) {
  var c = JSON.parse(JSON.stringify(o));
  if (c && typeof c === 'object') {
    delete c.generatedAt; delete c.buildAt; delete c.updatedAt; delete c.packageVersion; delete c.rootHash; delete c.distributedRootHash;
    Object.keys(c).forEach(function (k) {
      if (['generatedAt', 'buildAt', 'updatedAt', 'packageVersion', 'rootHash', 'distributedRootHash'].indexOf(k) !== -1) delete c[k];
      if (c[k] && typeof c[k] === 'object') c[k] = strip(c[k]);
    });
  }
  return c;
}
function fingerprint() {
  var out = {};
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
    out['kp-' + g] = strip(readJson(path.join(ROOT, 'kbl/data/math', g, 'knowledge-points.json')));
  });
  out.curriculum = strip(readJson(path.join(ROOT, 'kbl/data/math/curriculum.json')));
  out.relations = strip(readJson(path.join(ROOT, 'kbl/relations/math/relations.json')));
  out.mappings = strip(readJson(path.join(ROOT, 'kbl/mappings/generation-contract/math.json')));
  out.index = strip(readJson(path.join(ROOT, 'kbl/index/index.json')));
  out.manifest = strip(readJson(path.join(ROOT, 'kbl/manifest/manifest.json')));
  return out;
}

function rebuild() {
  run('extract-source.js');
  run('derive-kbl.js');
  run('emit-canonical.js');
  run('validate.js');
  run('build.js');
}

// ---- 执行 ----
var mig = fingerprint();                       // 阶段 0：当前 canonical 产物
rebuild();
var ed1 = fingerprint();
rebuild();
var ed2 = fingerprint();

function cmp(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
var okMig = cmp(mig, ed1);
var okIdem = cmp(ed1, ed2);

console.log('=== KBL Roundtrip（Source 往返回归门禁） ===');
console.log('当前产物 ↔ 重建一致（数据一致，时间戳剔除）:', okMig ? 'PASS' : 'FAIL');
console.log('Source 重建两次幂等性:', okIdem ? 'PASS' : 'FAIL');
if (!okMig) {
  console.error('FAIL — 当前产物与 Source 重建不一致');
  process.exit(1);
}
if (!okIdem) {
  console.error('FAIL — 同一 Source 两次重建不一致（非幂等）');
  process.exit(1);
}
var mf = readJson(path.join(ROOT, 'shared/knowledge/manifest/manifest.json'));
console.log('rootHash:', mf.integrity.rootHash);
console.log('PASS — root Excel 为可靠唯一人工输入源（数据一致 + 幂等 + 门禁全过）');