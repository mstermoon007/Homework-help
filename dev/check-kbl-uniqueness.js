#!/usr/bin/env node
/**
 * dev/check-kbl-uniqueness.js — KBL Runtime 唯一性审计门禁（只读，不修改任何业务代码）
 *
 * 审计命题（不是"旧 Knowledge 引用清零"，而是）：
 *   生产运行时是否存在第二条知识事实链；所有知识访问是否最终经过 KBL Runtime。
 *
 * 三层面验证：
 *   1) 静态：全仓扫描 → 按文件分类（Production / Runtime / Context / Bridge / Test / Build / Archive / Docs）
 *      仅对 Production 面判定；命中模式分"已知 pending"与"新增违规"。
 *   2) Bundle：构建产物不得内嵌 KBL 数据 / 定义旧知识全局 / 绕过 Runtime；重复 Runtime/适配器副本单独报告。
 *   3) 动态：页面等价装载 + 运行时 API 插桩（挂载次数 / 调用次数 / 兼容桥委托 / 旧全局存在性）
 *      + 真实链路（POL 池展开 → Strategy → Generator → SemanticQuestion）。
 *
 * 退出码：0 = 无任何 findings（唯一性成立）；1 = 存在 findings（含已登记 pending，逐条列出）。
 * 本门禁只扫描 / 分类 / 报告，禁止自动修复；发现问题登记 docs/pol-kbl-pending.md。
 *
 * 报告：dev/reports/kbl-uniqueness-report.json
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

// ---------- 已知 pending（与 docs/pol-kbl-pending.md 对应；新增命中必须登记后加入此处） ----------
var FROZEN_LEGACY_ACCESS = [
  'shared/capability/capability-resolver.js',
  'shared/generator/generator-registry.js',
  'shared/generator/generator-selector.js',
  'shared/strategy/strategy-engine.js',
  'shared/strategy/strategy-resolver.js',
  'shared/strategy/cognitive-strategy.js',
  'shared/strategy/context-strategy.js',
  'shared/strategy/difficulty-strategy.js',
  'shared/strategy/number-range-strategy.js',
  'shared/strategy/spiral-strategy.js',
  'shared/strategy/structure-constraints.js',
  'shared/strategy/strategy-validator.js',
  'shared/strategy/target-difficulty.js',
  'shared/strategy/comprehensive-strategy.js'
];
var BRIDGE_FILES = [
  'dev/build-strategy-bundle.js'
  // FINAL-22：shared/engine/knowledge-compat.js 已物理删除（源码假引用清除后无消费者），
  // 不再列入受控 bridge 清单。
];
// Phase 2 已收口 FAIL-001/002/003（render.js 死代码 / kp-semantic-validator 死 combine / bundle 副本）。
// 此后若再出现，按新增违规处理（回归保护）。
var KNOWN_FINDINGS = {};

// ---------- 扫描配置 ----------
var EXCLUDE_DIRS = ['node_modules', '.git', 'archive', 'audit-results', 'dev/reports', 'kbl/releases'];
var PROD_PATTERNS = [
  { id: 'legacy-bank', re: /\bKnowledgeBank\b(?!Compat)/ },
  { id: 'legacy-point', re: /\bKnowledgePoint\b(?!Compat)\s*[.(=]/ },
  { id: 'legacy-ontology', re: /\bKnowledgeOntology\b(?!Compat)\s*[.(=]/ },
  { id: 'legacy-file', re: /knowledge\/(knowledge-bank|knowledge-math|knowledge-point|knowledge-ontology|knowledge-ontology-normalizer|knowledge-ontology-validator|knowledge-factual|knowledge-operation|knowledge-error|ontology-book-map|ontology-category-map|ontology-error-map|ontology-factual-map|ontology-operation-map)\.js/ },
  { id: 'kbl-data-direct', re: /shared\/knowledge\/(data|relations|mappings|index|manifest)\// },
  { id: 'app-knowledge-direct', re: /App\.KNOWLEDGE\b/ }
];
var GLOBAL_DEF_PATTERN = /global\.(KnowledgeBank|KnowledgePoint|KnowledgeOntology)\s*=/;
var BUNDLE_DATA_ID = /math-g[1-6]-(up|down|mixed|advance|comprehensive)-u[0-9]{2}-k[0-9]{3}/;

function classify(rel) {
  if (/\.md$/.test(rel)) return 'F-docs';
  if (rel.indexOf('shared/knowledge/runtime/') === 0) return 'A-runtime';
  if (rel === 'shared/orchestration/knowledge-context.js') return 'B-context';
  if (BRIDGE_FILES.indexOf(rel) !== -1) return 'C-bridge';
  if (rel.indexOf('tests/') === 0) return 'D-test';
  if (rel.indexOf('dev/') === 0 || rel.indexOf('tools/') === 0 || rel.indexOf('scripts/') === 0 || rel.indexOf('kbl/') === 0) return 'E-build';
  if (rel.indexOf('docs/') === 0 || rel.indexOf('migration/') === 0) return 'F-docs';
  if (rel.indexOf('archive/') === 0) return 'G-archive';
  if (rel.indexOf('shared/engine/') === 0 && /\.bundle\.js$/.test(rel)) return 'Bundle-artifact';
  if (rel.indexOf('shared/') === 0 || rel === 'sw.js' || /^[^/]+\.html$/.test(rel)) return 'P-production';
  return 'K-unknown';
}

// 审计扫描用注释剥离（仅内存处理，不回写文件）：
// JS 去 /* */ 与 //；HTML 去 <!-- --> 及 <script> 内 JS 注释；避免注释文本误报。
function stripJsComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:])\/\/.*$/gm, '$1');
}
function stripComments(content, rel) {
  if (/\.html$/.test(rel)) {
    return content
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, function (m, open, body, close) {
        return open + stripJsComments(body) + close;
      });
  }
  if (/\.js$/.test(rel)) return stripJsComments(content);
  return content;
}

function walk(dir, acc) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    var rel = path.relative(ROOT, path.join(dir, e.name)).replace(/\\/g, '/');
    if (EXCLUDE_DIRS.some(function (d) { return rel === d || rel.indexOf(d + '/') === 0; })) return;
    var full = path.join(dir, e.name);
    if (e.isDirectory()) { walk(full, acc); return; }
    if (/\.(js|html|md|mjs|cjs)$/.test(e.name)) acc.push(rel);
  });
}

function scanStatic() {
  var files = [];
  walk(ROOT, files);
  var hits = [];
  var sanctioned = [];
  var knownFindings = [];
  var newFindings = [];
  var globalDefs = [];

  files.forEach(function (rel) {
    if (rel.indexOf('dev/reports/') === 0) return;
    var content;
    try { content = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
    var cat = classify(rel);
    var scannable = (cat === 'P-production' || cat === 'C-bridge' || cat === 'A-runtime' || cat === 'B-context' || cat === 'E-build' || cat === 'D-test' || cat === 'K-unknown');
    if (!scannable) return;
    var code = stripComments(content, rel);
    if (cat === 'P-production' && GLOBAL_DEF_PATTERN.test(code)) globalDefs.push(rel);
    PROD_PATTERNS.forEach(function (p) {
      if (!p.re.test(code)) return;
      hits.push({ file: rel, category: cat, pattern: p.id });
      if (cat !== 'P-production') return;
      if (FROZEN_LEGACY_ACCESS.indexOf(rel) !== -1 || BRIDGE_FILES.indexOf(rel) !== -1) {
        sanctioned.push({ file: rel, pattern: p.id, kind: 'frozen/bridge 受控' });
        return;
      }
      var kf = KNOWN_FINDINGS[rel];
      if (kf) { knownFindings.push({ file: rel, pattern: p.id, kind: kf }); return; }
      newFindings.push({ file: rel, pattern: p.id });
    });
  });

  return { files: files.length, hits: hits, sanctioned: sanctioned, knownFindings: knownFindings, newFindings: newFindings, globalDefs: globalDefs };
}

function scanBundles() {
  var out = { bundles: [], dupAdapter: [], embeddedData: [], legacyGlobals: [] };
  ['shared/engine/strategy-engine.bundle.js', 'shared/engine/presentation-engine.bundle.js'].forEach(function (rel) {
    var p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) return;
    var src = fs.readFileSync(p, 'utf8');
    // 绑定引用 ≠ 数据内嵌：generator 的 knowledgePoints 数组为 canonical ID 引用列表，
    // 检测 KBL 数据内嵌前先剥离（数据内嵌会携带 knowledgeId+name/semantic/unitName 等载荷）。
    // P25-06：capability-resolver 的 TEACHING_DENIALS 同为「ID 引用表」（键=kpId|qt，无数据载荷；
    // 理由/证据 SSOT 在 kbl/teaching/teaching-denials.json），一并剥离，按合法引用对待。
    var dataText = src
      .replace(/knowledgePoints:\s*\[[\s\S]*?\]/g, '')
      .replace(/TEACHING_DENIALS\s*=\s*\{[\s\S]*?\n\};/g, '');
    var rec = {
      file: rel,
      // 副本判定：内联 KC/Runtime 会挂载全局（shim 委托不会）
      hasRuntimeCopy: /global\.App\.KNOWLEDGE\s*=\s*exposed/.test(src),
      hasContextCopy: /global\.KnowledgeContext\s*=\s*API/.test(src),
      hasContextShim: src.indexOf('__defs["shared/orchestration/knowledge-context.js"]') !== -1 && /global\.KnowledgeContext == null/.test(src),
      remountsKnowledge: /global\.App\.KNOWLEDGE\s*=/.test(src),
      legacyGlobalDef: GLOBAL_DEF_PATTERN.test(src),
      canonicalIds: (dataText.match(new RegExp(BUNDLE_DATA_ID.source, 'g')) || []).length
    };
    out.bundles.push(rec);
    if (rec.hasRuntimeCopy || rec.hasContextCopy) {
      out.dupAdapter.push({ file: rel, runtimeDef: rec.hasRuntimeCopy, contextDef: rec.hasContextCopy, remounts: rec.remountsKnowledge, known: !!KNOWN_FINDINGS[rel] });
    }
    if (rec.canonicalIds > 0) out.embeddedData.push({ file: rel, count: rec.canonicalIds });
    if (rec.legacyGlobalDef) out.legacyGlobals.push(rel);
  });
  return out;
}

function runDynamic() {
  var result = {
    loaded: false, mounts: 0, apiCalls: {}, contextCopyOverwrite: false,
    legacyGlobals: { KnowledgeBank: 'undefined', KnowledgePoint: 'undefined', KnowledgeOntology: 'undefined' },
    compatCalls: {},
    planOk: false, plans: 0, poolKpIds: 0, semanticQuestions: 0, errors: []
  };
  try {
    if (typeof global.window === 'undefined') global.window = global;
    if (!global.App) global.App = {};

    Object.defineProperty(global.App, 'KNOWLEDGE', {
      configurable: true,
      get: function () { return this.__k; },
      set: function (v) { result.mounts++; this.__k = v; }
    });

    function load(rel) { require(path.join(ROOT, rel)); }
    load('shared/core/common.js');
    load('shared/catalog/difficulty.js');
    load('shared/catalog/difficulty-static.js');
    load('shared/knowledge/runtime/knowledge-runtime.js');
    load('shared/orchestration/knowledge-context.js');
    var KC_page = global.KnowledgeContext;
    // FINAL-22：knowledge-compat.js 已删除（compat 桥无消费者），动态审计不再加载与接线。
    load('shared/engine/strategy-engine.bundle.js');
    load('shared/engine/presentation-engine.bundle.js');
    result.contextCopyOverwrite = (global.KnowledgeContext !== KC_page);
    result.loaded = true;

    var K = global.App.KNOWLEDGE;
    ['get', 'byGrade', 'byBook', 'byUnit', 'selectable', 'canGenerate', 'searchByName', 'unit', 'relationsFor', 'stats'].forEach(function (m) {
      var orig = K[m];
      if (typeof orig !== 'function') return;
      result.apiCalls[m] = 0;
      K[m] = function () { result.apiCalls[m]++; return orig.apply(K, arguments); };
    });

    var KC = global.KnowledgeContext;
    var pool = KC.poolKpIds({ subject: 'math', grade: 2 });
    result.poolKpIds = pool.length;
    var id = pool[0];
    var r = global.StrategyEngine.plan({ subject: 'math', grade: 2, knowledgePointIds: [id], questionTypes: ['calc'], count: 3, difficulty: 3, mode: 'single-kp' });
    var plan = (r && r.plans && r.plans[0]) || null;
    result.planOk = !!plan;
    result.plans = (r && r.plans) ? r.plans.length : 0;
    if (plan) {
      var sel = global.GeneratorSelector.selectGenerator(plan);
      var inst = global.GeneratorSelector.instantiate(sel);
      var sems = inst.generate(plan, { seed: 'kbl-uniqueness', count: 3 });
      result.semanticQuestions = Array.isArray(sems) ? sems.length : 0;
    }
    result.legacyGlobals = {
      KnowledgeBank: typeof global.KnowledgeBank,
      KnowledgePoint: typeof global.KnowledgePoint,
      KnowledgeOntology: typeof global.KnowledgeOntology
    };
  } catch (e) {
    result.errors.push(String((e && e.message) || e));
  }
  return result;
}

function main() {
  var started = Date.now();
  var staticRes = scanStatic();
  var bundleRes = scanBundles();
  var dynamicRes = runDynamic();

  var newFindings = staticRes.newFindings.slice();
  if (bundleRes.embeddedData.length) bundleRes.embeddedData.forEach(function (x) { newFindings.push({ file: x.file, pattern: 'embedded KBL canonical data x' + x.count }); });
  bundleRes.dupAdapter.forEach(function (x) { if (!x.known) newFindings.push({ file: x.file, pattern: 'duplicate runtime/adapter' }); });
  if (bundleRes.legacyGlobals.length) bundleRes.legacyGlobals.forEach(function (f) { newFindings.push({ file: f, pattern: 'bundle defines legacy knowledge global' }); });
  staticRes.globalDefs.forEach(function (f) { newFindings.push({ file: f, pattern: 'defines global legacy knowledge object' }); });
  if (dynamicRes.mounts > 1) newFindings.push({ file: '(dynamic)', pattern: 'App.KNOWLEDGE mounted ' + dynamicRes.mounts + ' times' });
  if (dynamicRes.legacyGlobals.KnowledgeBank !== 'undefined') newFindings.push({ file: '(dynamic)', pattern: 'global.KnowledgeBank defined at runtime' });
  if (!dynamicRes.loaded || dynamicRes.errors.length) newFindings.push({ file: '(dynamic)', pattern: 'dynamic chain failed: ' + (dynamicRes.errors.join('; ') || 'not loaded') });
  if (dynamicRes.poolKpIds <= 0 || !dynamicRes.planOk) newFindings.push({ file: '(dynamic)', pattern: 'runtime knowledge not reached in E2E' });

  var knownFindings = staticRes.knownFindings.slice();
  bundleRes.dupAdapter.forEach(function (x) {
    if (x.known) knownFindings.push({ file: x.file, pattern: 'duplicate runtime/adapter', kind: KNOWN_FINDINGS[x.file] });
  });

  var failCount = newFindings.length + knownFindings.length;
  var report = {
    generatedAt: new Date().toISOString(),
    audit: 'KBL Runtime Uniqueness',
    static: {
      scannedFiles: staticRes.files,
      hits: staticRes.hits,
      sanctioned: staticRes.sanctioned,
      knownFindings: knownFindings,
      newFindings: newFindings,
      globalLegacyDefs: staticRes.globalDefs
    },
    bundle: bundleRes,
    dynamic: dynamicRes,
    verdict: {
      sanctioned: staticRes.sanctioned.length,
      knownFindings: knownFindings.length,
      newViolations: newFindings.length,
      uniqueness: failCount === 0 ? 'PASS' : 'FAIL'
    },
    durationMs: Date.now() - started
  };
  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'kbl-uniqueness-report.json'), JSON.stringify(report, null, 2) + '\n');

  // ---------- 输出 ----------
  console.log('=== KBL Runtime 唯一性审计 ===');
  console.log('扫描文件: ' + staticRes.files + '（生产面命中 ' + staticRes.hits.filter(function (h) { return h.category === 'P-production'; }).length + ' 处）');
  console.log('受控（frozen/bridge）: ' + staticRes.sanctioned.length + ' 处');
  if (knownFindings.length) knownFindings.forEach(function (k) { console.log('  [KNOWN-FAIL] ' + k.file + ' :: ' + k.pattern + ' — ' + k.kind); });
  console.log('Bundle 副本: ' + (bundleRes.dupAdapter.length ? bundleRes.dupAdapter.map(function (x) { return x.file + (x.runtimeDef ? ' [runtime]' : '') + (x.contextDef ? ' [context]' : '') + (x.remounts ? ' [remount]' : ''); }).join('; ') : '无'));
  console.log('动态: mounts=' + dynamicRes.mounts + ' poolKpIds=' + dynamicRes.poolKpIds + ' plans=' + dynamicRes.plans + ' semantic=' + dynamicRes.semanticQuestions);
  console.log('动态 Runtime API 调用: ' + JSON.stringify(dynamicRes.apiCalls));
  console.log('动态 旧全局: ' + JSON.stringify(dynamicRes.legacyGlobals) + (dynamicRes.contextCopyOverwrite ? ' | KnowledgeContext 被 bundle 副本覆盖=true' : ''));
  console.log('新增违规: ' + newFindings.length);
  newFindings.forEach(function (f) { console.log('  [NEW] ' + f.file + ' :: ' + f.pattern); });
  console.log('结论: KBL Runtime Uniqueness = ' + report.verdict.uniqueness + '（known ' + knownFindings.length + ' / new ' + newFindings.length + '）');
  console.log('Report -> dev/reports/kbl-uniqueness-report.json');

  process.exitCode = failCount === 0 ? 0 : 1;
}

main();
