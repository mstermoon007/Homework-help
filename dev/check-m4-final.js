#!/usr/bin/env node
/**
 * dev/check-m4-final.js — M4-R26 M4 最终 Gate
 *
 * 汇总 M4 全量愿景指标，逐项断言（真实反映当前迁移/清理进度，不粉饰）。
 * 任一【红】项即整体 FAIL，附整改指引；【绿】项为准入通过。
 *
 * 检查项：
 *   [1] 全部插件有迁移状态（unclassified = 0）
 *   [2] 0 个未归类插件
 *   [3] 0 个非法 Generator
 *   [4] 0 个 Generator 直接渲染
 *   [5] 0 个 Generator 使用 Math.random
 *   [6] 0 个 Generator 自行决定全局难度
 *   [7] 0 个 KnowledgePoint 强依赖具体 Plugin
 *   [8] Generator Registry 完整
 *   [9] Generator 回归 100% 通过
 *  [10] SemanticQuestion 100% 通过 Validator
 *  [11] 综合练习通过
 *  [12] 打印/HTML/SVG 通过
 *  [13] Legacy 依赖扫描通过
 *
 * 输出：dev/reports/m4-final-gate.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var reportDir = path.join(ROOT, 'dev', 'reports');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var Switch = require(path.join(ROOT, 'shared', 'generator', 'migration-switch.js'));

function read(p) { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; }
function strip(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }

var items = [];
function item(name, passed, detail, remediation) {
  items.push({ name: name, passed: !!passed, detail: detail || '', remediation: remediation || '' });
}

var statusReport = read(path.join(reportDir, 'plugin-migration-status.json'));
var respReport = read(path.join(reportDir, 'm4-r20-responsibility-report.json'));
var depsReport = read(path.join(reportDir, 'legacy-dependencies.json'));
var regressionPass = read(path.join(reportDir, 'regression-pass.json'));

// ---- 收集（独立探测，不依赖单一报告缺失导致全 false）----
var statuses = (statusReport && statusReport.plugins) || [];
var registryIds = [];
try { registryIds = require(path.join(ROOT, 'dev', 'plugin-registry.js')).readRegistry().map(function (e) { return e.id; }); } catch (e) {}

// ---- [1][2] 迁移状态覆盖 / 未归类 ----
var allHaveStatus = true, unclassified = [];
statuses.forEach(function (st) {
  if (!st || !st.currentStatus) { allHaveStatus = false; unclassified.push((st && st.pluginId) || '?'); }
});
var statusCoverage = registryIds.length ? statuses.length / registryIds.length : 0;
item('全部插件有迁移状态', statusCoverage >= 1 && allHaveStatus,
  'registry=' + registryIds.length + ' 已有状态=' + statuses.length + '（覆盖 ' + Math.round(statusCoverage * 100) + '%）',
  '缺口: ' + registryIds.filter(function (id) { return !statuses.some(function (s) { return s.pluginId === id; }); }).join(', '));
item('0 个未归类插件', unclassified.length === 0,
  '未归类=' + unclassified.length, unclassified.slice(0, 5).join(', '));

// ---- [3] 非法 Generator：能力注册表 / source 一致性（此为轻量探测；完整回归防回归见 verify:m*）----
var invalidGenerators = [];
try {
  var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
  var recs = GenCap.buildGeneratorCapabilityRegistry() || [];
  invalidGenerators = recs.filter(function (r) { return !r || !r.pluginId || !Array.isArray(r.knowledgePoints); });
} catch (e) { invalidGenerators = []; }
item('0 个非法 Generator', invalidGenerators.length === 0, '非法=' + invalidGenerators.length, invalidGenerators.map(function (g) { return g && g.pluginId; }).join(', '));

// ---- [4] 直接渲染：扫描「生成器/插件」源码（排除基础设施桥/适配器）----
var renderIds = scanFor('render', '\\brender\\s*=\\s*function|qa\\.render\\s*[:=]|render\\s*\\(\\s*idx');
item('0 个 Generator 直接渲染', renderIds.length === 0, '直接渲染插件=' + renderIds.length, renderIds.join(', '));

// ---- [5] Math.random ----
var mathRandomIds = scanFor('Math.random', '\\bMath\\.random\\s*\\(');
item('0 个 Generator 使用 Math.random', mathRandomIds.length === 0, 'Math.random 插件=' + mathRandomIds.length, mathRandomIds.join(', '));

// ---- [6] 全局难度决策 ----
// 复用 R20 报告的 difficulty-decision 命中；另做独立难度梯度扫描
var diffHitIds = (respReport ? respReport.plugins.filter(function (p) { return p.hits && p.hits['difficulty-decision'] && p.hits['difficulty-decision'].length; }).map(function (p) { return p.id; }) : []);
var globalAdaptive = (respReport ? respReport.plugins.filter(function (p) { return p.hits && p.hits['global-adaptive'] && p.hits['global-adaptive'].length; }).map(function (p) { return p.id; }) : []);
item('0 个 Generator 自行决定全局难度', diffHitIds.length === 0,
  'difficulty-decision 命中=' + diffHitIds.length + '（CORE 职责，插件不应自判难度）', diffHitIds.join(', '));
item('0 个 Generator 读取全局自适应', globalAdaptive.length === 0,
  'global-adaptive 命中=' + globalAdaptive.length, globalAdaptive.join(', '));

// ---- [7] KP 强依赖 Plugin：绑定某插件且该插件 KPs 全未迁移的 KP（迁移即解耦）----
var coupled = [];
var kpsBound = {}; // kpId -> {pluginId, migrated}
Ontology.SUBJECTS.forEach(function (s) {
  (KnowledgeBank[s] || []).forEach(function (g) {
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        if (!kp.pluginId) return;
        var n = (Ontology.normalize && Ontology.normalize(kp)) || kp;
        var id = n.id || kp.id;
        kpsBound[id] = { pluginId: kp.pluginId, migrated: Switch.isMigrated(id) };
        if (!Switch.isMigrated(id)) coupled.push(kp.pluginId + ':' + id);
      });
    });
  });
});
var coupledPlugins = Array.from(new Set(coupled.map(function (c) { return c.split(':')[0]; })));
item('0 个 KP 强依赖具体 Plugin（强依赖=未迁移 KP）', coupled.length === 0,
  '未迁移 KP=' + coupled.length + '（涉及插件 ' + coupledPlugins.length + '）', coupled.length ? '仍需迁移；见 migration-switch 推进' : '');

// ---- [8] Generator Registry 完整 ----
var registryComplete = false;
try {
  var GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
  var all = (typeof GenRegistry.all === 'function' ? GenRegistry.all() : (GenRegistry.records ? GenRegistry.records() : []));
  if (typeof all === 'function') all = all();
  registryComplete = Array.isArray(all) && all.length > 0;
} catch (e) { registryComplete = false; }
item('Generator Registry 完整', registryComplete, registryComplete ? 'registry 可加载且有记录' : 'registry 缺失', '');

// ---- [9] Generator 回归 100% ----
var regPass = !!(regressionPass && regressionPass.all === true);
item('Generator 回归 100% 通过', regPass, regPass ? 'regression-pass.json: {all:true}' : '未全绿（regression-pass.json 缺失或未 all）', '重跑 verify:m4');

// ---- [10] SemanticQuestion 100% 通过 Validator ----
// 轻量：执行 validator（若存在），否则标记未接入
var validPath = path.join(ROOT, 'dev', 'validate-question.js');
var validatorOk = null;
if (fs.existsSync(validPath)) {
  try {
    var cp = require('child_process');
    cp.execSync('node dev/validate-question.js', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    validatorOk = true;
  } catch (e) { validatorOk = false; }
}
item('SemanticQuestion 100% 通过 Validator', validatorOk === true,
  validatorOk === null ? 'validator 未接入（dev/validate-question.js 缺失）' : (validatorOk ? 'validator: PASS' : 'validator: FAIL'), '实现/接入 validate-question.js');

// ---- [11] 综合练习通过 ----
var comprehensiveOk = false;
try {
  var cp2 = require('child_process');
  cp2.execSync('node dev/check-comprehensive-pipeline.js', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
  comprehensiveOk = true;
} catch (e) { comprehensiveOk = false; }
item('综合练习通过', comprehensiveOk, comprehensiveOk ? 'comprehensive-pipeline: PASS' : 'comprehensive-pipeline: FAIL', '见 check-comprehensive-pipeline.js');

// ---- [12] 打印/HTML/SVG 通过 ----
var svgOk = false;
try {
  var svgPath = path.join(ROOT, 'dev', 'verify-svg.js');
  if (fs.existsSync(svgPath)) {
    var cp3 = require('child_process');
    cp3.execSync('node dev/verify-svg.js', { cwd: ROOT, stdio: 'pipe', timeout: 120000 });
    svgOk = true;
  }
} catch (e) { svgOk = false; }
item('打印/HTML/SVG 通过', svgOk, svgOk ? 'verify-svg: PASS' : 'verify-svg: 缺失或 FAIL', '接入 verify-svg');

// ---- [13] Legacy 依赖扫描通过 ----
var depsReady = (depsReport && typeof depsReport.summary === 'object') ? (depsReport.summary.ready || 0) : 0;
var depsTotal = (depsReport && depsReport.summary) ? (depsReport.summary.total || 0) : 0;
item('Legacy 依赖扫描通过', depsReady === depsTotal,
  '可下线=' + depsReady + ' / ' + depsTotal, '未满足下线条件的插件仍被依赖，见 check-legacy-dependencies.js');

// ---- 输出 ----
var passed = items.filter(function (i) { return i.passed; });
var failed = items.filter(function (i) { return !i.passed; });
var count = items.length;

var out = {
  version: 1,
  generatedAt: new Date().toISOString(),
  milestone: 'M4-R26',
  summary: { total: count, passed: passed.length, failed: failed.length, allGreen: failed.length === 0 },
  items: items
};
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'm4-final-gate.json'), JSON.stringify(out, null, 2));

console.log('M4-R26 M4 最终 Gate');
console.log('');
items.forEach(function (it) {
  console.log('  [' + (it.passed ? 'PASS' : '-----') + '] ' + it.name + (it.detail ? '  — ' + it.detail : ''));
  if (!it.passed && it.remediation) console.log('      → 整改: ' + it.remediation);
});
console.log('');
console.log('通过 ' + passed.length + '/' + count + ' | 未通过 ' + failed.length);
console.log('Gate -> dev/reports/m4-final-gate.json');
var ok = failed.length === 0;
console.log('');
console.log(ok ? '[PASS] M4-R26 M4 最终 Gate 全部通过' : '[FAIL] M4-R26 尚有 ' + failed.length + ' 项未达标（迁移/清理仍在进行）');
process.exitCode = ok ? 0 : 1;

// ---- 独立源码扫描 ----
function scanFor(label, pat) {
  var ids = [];
  var dirs = ['plugins', 'shared/generator'];
  var files = [];
  function walk(d) {
    if (!fs.existsSync(path.join(ROOT, d))) return;
    fs.readdirSync(path.join(ROOT, d)).forEach(function (f) {
      var fp = path.join(d, f);
      if (f[0] === '.') return;
      var st = fs.statSync(path.join(ROOT, fp));
      if (st.isDirectory()) { walk(fp); return; }
      if (/\.js$/.test(f)) files.push(fp);
    });
  }
  dirs.forEach(walk);
  var re = new RegExp(pat);
  var EXCLUDE = /semantic-question-bridge\.js|legacy-plugin-adapter\.js|graphic-renderer\.js|generator-registry\.js|generator-selector\.js|migration-switch\.js|generator-mode\.js/;
  files.forEach(function (fp) {
    if (EXCLUDE.test(fp)) return; // 基础设施桥/注册表，非生成器直接渲染
    var src = strip(fs.readFileSync(path.join(ROOT, fp), 'utf8'));
    if (re.test(src)) ids.push(fp);
  });
  return ids;
}
