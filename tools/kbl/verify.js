'use strict';
/**
 * tools/kbl/verify.js — KBL 最终门禁（方案 §31 日常工具 verify + §45 Final Gate）
 *
 * 一键顺序执行完整迁移门禁链，任一失败即退出 1：
 *   1. validate          —— Schema / ID / Curriculum / Semantic / Relation / Capability / Lifecycle / Count Conservation
 *   2. roundtrip         —— Excel 往返重建 ≡ 迁移 Canonical + editorial 幂等
 *   3. build             —— Canonical → Runtime 镜像（含确定性 rootHash）
 *   4. runtime E2E       —— Loader / Query / Policy / Index / Hash / 白名单
 *   5. access audit      —— 单入口封锁（无新增越权访问）
 *   6. publish           —— KBL Snapshot + latest.json（含 rootHash 重算审计）
 *
 * 用法：node tools/kbl/verify.js
 */
var child = require('child_process');
var path = require('path');

var ROOT = path.join(__dirname, '../..');
function run(label, cmd, args) {
  console.log('\n[verify] ' + label);
  var r = child.spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('FAIL — ' + label + ' 未通过');
    process.exit(r.status === null ? 1 : r.status);
  }
  return true;
}

run('KBL Validate', 'validate', [path.join(__dirname, 'validate.js')]);
run('KBL Roundtrip（Excel ↔ Canonical + 幂等）', 'roundtrip', [path.join(__dirname, 'roundtrip.js')]);
run('KBL Build（Canonical → Runtime 镜像）', 'build', [path.join(__dirname, 'build.js')]);
run('KBL Runtime E2E', 'runtime', [path.join(ROOT, 'dev/verify-kbl-runtime.js')]);
run('KBL Access Audit（单入口封锁）', 'access', [path.join(ROOT, 'dev/check-knowledge-access.js')]);
run('KBL Generator-Capability Gate（canonical M2-R05）', 'gate', [path.join(ROOT, 'dev/check-generator-capability.js')]);
run('KBL Quality Gate（M17 数据质量 9 项）', 'quality', [path.join(ROOT, 'dev/check-kbl-quality.js')]);
run('KBL F-Type-2 回归门禁（canonical 题型归一零错型）', 'f-type-2', [path.join(ROOT, 'dev/check-f-type-2.js')]);
run('KBL Publish（Snapshot + latest.json）', 'publish', [path.join(__dirname, 'publish.js')]);

console.log('\n=== KBL VERIFY: ALL PASS ===');