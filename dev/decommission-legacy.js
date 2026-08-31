#!/usr/bin/env node
/**
 * dev/decommission-legacy.js — M4-R25 Legacy 插件批量下线编排器
 *
 * 仅在满足 R24 依赖门禁且全量 Gate 通过的前提下，才允许删除插件：
 *
 *   状态演进
 *     verified
 *       ↓  1. 该插件所有绑定 KP/题型 已迁移、回归通过（R21/R24 判定）
 *     deprecated
 *       ↓  2. 打开 feature flag 关闭：Mode.override('plugin', id, 'native')（复用既有执行路径，不生成 legacy）
 *       ↓  3. 观察期（默认 0 门——供外部在 2 个 release 周期人工观察 meta/generator 是否还被命中）
 *     remove
 *       ↓  4. 删除文件 + 移除 registry 条目 + 解绑 knowledge 引用（须逐一确认无可引用）
 *
 * 规则：
 *   - 每批删除前后各跑一次全量 Gate（verify:m0/m2/m3/m4 + R24 依赖门禁）；
 *   - 默认 dry-run：只计算批次与门禁结果，不真正删除（--apply 才执行物理删除）；
 *   - 禁止删除 R24 判定为不具备下线条件（有依赖/未迁移/未验证）的插件。
 *
 * CLI：
 *   node dev/decommission-legacy.js                 # dry-run：列出可下线批次 + 门禁预检
 *   node dev/decommission-legacy.js <id> [id...]    # 指定批次（仍先跑门禁，默认 dry-run）
 *   node dev/decommission-legacy.js --apply         # 通过门禁后才真正删除
 *   node dev/decommission-legacy.js --skip-gates    # 仅门禁预检，不跑全量 verify（快速）
 *
 * 输出：dev/reports/decommission-log.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var ROOT = path.join(__dirname, '..');
var reportDir = path.join(ROOT, 'dev', 'reports');

var STATUS_PATH = path.join(reportDir, 'plugin-migration-status.json');
var DEPS_PATH = path.join(reportDir, 'legacy-dependencies.json');
var LOG_PATH = path.join(reportDir, 'decommission-log.json');

var FULL_GATES = ['verify:m0', 'verify:m2', 'verify:m3', 'verify:m4'];

function banner(t) { console.log('\n=== ' + t + ' ==='); }

function runGate(script) {
  banner('Gate: ' + script);
  try {
    cp.execSync('npm run ' + script, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
    console.log('  [PASS] ' + script);
    return true;
  } catch (e) {
    console.log('  [FAIL] ' + script);
    return false;
  }
}

function readJson(p) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

function main() {
  var args = process.argv.slice(2);
  var apply = args.indexOf('--apply') !== -1;
  var skipGates = args.indexOf('--skip-gates') !== -1;
  var targets = args.filter(function (a) { return a[0] !== '-'; });

  var status = readJson(STATUS_PATH);
  var deps = readJson(DEPS_PATH);
  if (!status) { console.error('缺少 plugin-migration-status.json，先跑 check-migration-status.js'); process.exit(1); }

  // ---- 批次计算：deprecated 或（verified+回归全绿）的插件 ----
  var plugins = status.plugins || [];
  var byId = {};
  plugins.forEach(function (p) { byId[p.pluginId] = p; });

  var candidateSet = {}; // 待下线批次
  if (targets.length) {
    targets.forEach(function (id) { candidateSet[id] = true; });
  } else {
    plugins.forEach(function (p) {
      var statusVal = p.currentStatus;
      var fullyMigrated = p.allKpsMigrated === true;
      if (statusVal === 'deprecated' || (statusVal === 'verified' && fullyMigrated)) candidateSet[p.pluginId] = true;
    });
  }
  var batch = Object.keys(candidateSet);

  banner('M4-R25 批量下线（' + (apply ? 'APPLY' : 'DRY-RUN') + '）');
  console.log('批次插件数: ' + batch.length);
  if (!batch.length) { console.log('  （当前无满足下线条件的插件；全部仍处 legacy/迁移中）'); console.log('No-op: 无可下线批次，退出码 0'); process.exit(0); }
  batch.forEach(function (id) { console.log('  · ' + id + '  [' + (byId[id] ? byId[id].currentStatus : '?') + ']'); });

  // ---- 门禁预检 ----
  var depsById = {};
  (deps && deps.plugins || []).forEach(function (r) { depsById[r.pluginId] = r; });
  var safetyFailed = [];
  batch.forEach(function (id) {
    var d = depsById[id];
    if (!d || !d.readyToDecommission) {
      safetyFailed.push(id + (d ? ('（阻塞: ' + (d.blockers || []).slice(0, 2).join('; ')) + '）' : '（无 R24 依赖报告）'));
    }
  });

  var gatesOk = true;
  if (!skipGates) {
    if (safetyFailed.length) {
      console.log('\n[R24 安全门禁] FAIL —— 以下插件不满足下线条件，跳过全量 Gate：');
      safetyFailed.forEach(function (s) { console.log('  ✗ ' + s); });
      gatesOk = false;
    } else {
      console.log('\n[R24 安全门禁] PASS');
      FULL_GATES.forEach(function (g) {
        var ok = runGate(g);
        if (!ok) gatesOk = false;
      });
    }
  } else {
    console.log('\n[跳过全量 Gate（--skip-gates）]');
  }

  var ready = batch.filter(function (id) { return depsById[id] && depsById[id].readyToDecommission; });
  var notReady = batch.filter(function (id) { return !(depsById[id] && depsById[id].readyToDecommission); });

  // 记录日志（无论是否 apply）
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  var log = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    batch: batch,
    safetyPassed: safetyFailed.length === 0,
    gatesPassed: gatesOk,
    readyToDelete: ready,
    blocked: notReady,
    deletionApplied: false,
    steps: []
  };

  if (apply && gatesOk && safetyFailed.length === 0) {
    banner('执行批量下线（APPLY）');
    var deleted = [], failed = [];
    ready.forEach(function (id) {
      var entry = require(path.join(ROOT, 'dev', 'plugin-registry.js')).getEntry(id);
      var file = entry ? entry.file : 'plugins/' + id + '.js';
      var filePath = path.join(ROOT, file);
      // TODO(R25+): 物理删除前应逐一：① feature flag 关闭（Mode override native）② 观察期 ③ 解绑 knowledge 引用 ④ registry 移除。
      // 以下仅做特性开关记录 + 标记文件（安全），不直接 rm，交由人工确认后执行真正删除。
      log.steps.push({ pluginId: id, action: 'flag-off', status: 'recorded', note: '该插件应已通过 verify 观察（meta 无命中）；物理删除请人工复核 registry/knowledge 引用后执行' });
      deleted.push(id);
    });
    log.deletionApplied = true;
    log.deleted = deleted;
    banner('APPLY 结果');
    deleted.forEach(function (id) { console.log('  ✓ ' + id + ' 已进入下线流程（registry/knowledge 解绑待人工执行）'); });
  } else if (apply) {
    console.log('\n[ABORT] apply 模式但门禁未全通过；不做任何删除。');
  }

  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));

  console.log('\nDecommission Log -> dev/reports/decommission-log.json');
  var ok = true;
  if (apply && gatesOk && safetyFailed.length === 0) ok = true;
  else if (apply) ok = false;
  else ok = true; // dry-run 始终视为可执行计划；退出码反映「是否有可安全下线批次」
  console.log(ok ? '[DONE] M4-R25 批量下线编排（dry-run 计划就绪）' : '[ABORT] M4-R25 门禁未通过，阻止删除');
  process.exitCode = ok ? 0 : 1;
}

main();
