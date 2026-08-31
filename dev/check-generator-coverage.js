/**
 * dev/check-generator-coverage.js — M7-R31 Generator 全量覆盖检查
 *
 * 数据流：
 *   KnowledgePoint
 *        ↓
 *   Capability（generator-capability-registry / 平台 subject 归一）
 *        ↓
 *   Generator（generator-registry：core 与 legacy 记录）
 *
 * 输出：
 *   0 orphan knowledge points
 *   0 orphan capabilities
 *   0 unresolved generators
 *
 * 归一化：能力注册表 subject 用中文语义（math/chinese/english），
 * 知识点库 subject 用 short code（math/cn/en）——两侧映射到平台别名统一比较。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

function canonicalSubject(sub) {
  var m = { 'cn': 'chinese', 'chinese': 'chinese', 'en': 'english', 'english': 'english', 'math': 'math' };
  return m[sub] || sub;
}

var KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var CR = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var GR = require(path.join(ROOT, 'shared', 'generator-registry.js'));

// ---- 1. KnowledgePoint 全集 ----
var allKP = [];
['math', 'cn', 'en'].forEach(function (subj) {
  [1, 2, 3, 4, 5, 6].forEach(function (grade) {
    KB.getEntries(subj, grade).forEach(function (e) { allKP.push(e); });
  });
});
var kpById = {};
allKP.forEach(function (e) { kpById[e.id] = e; });

// ---- 2. Capability 覆盖（能力注册表 + generator-registry 记录 + 插件自身 knowledgePoints 声明）----
var capEntries = CR.buildGeneratorCapabilityRegistry() || [];
var capabilities = capEntries.map(function (e) { return e; });
// 附加 generator-registry 中的 core 记录能力（native generators）
GR.records().forEach(function (r) {
  if (r.scope !== 'core') return;
  capabilities.push({ pluginId: r.id, subject: r.subject, knowledgePoints: r.knowledgePoints || [], capabilities: r.capabilities || [], questionTypes: r.questionTypes || [] });
});
// 附加插件自身声明的 knowledgePoints（R31 权威覆盖源；能力注册表可能滞后）
(function () {
  var registryPath = path.join(ROOT, 'plugins', 'registry.js');
  try {
    var config = require(registryPath);
    var reg = config.list && config.list().length ? config.list() : (config.plugins || config || []);
    if (!Array.isArray(reg)) reg = config && config.list ? [].concat(config.list()) : [];
    reg.forEach(function (entry) {
      if (!entry || !entry.id || !entry.file) return;
      var pluginPath = path.join(ROOT, entry.file.replace(/^plugins\//, '')) || path.join(ROOT, entry.file);
      var abs = (entry.file.indexOf('/') === -1) ? path.join(ROOT, 'plugins', entry.file) : path.join(ROOT, entry.file);
      if (!fs.existsSync(abs)) return;
      var src = fs.readFileSync(abs, 'utf8');
      var m = /knowledgePoints\s*:\s*(\{[\s\S]*?\})\s*,?\n/m.exec(src);
      if (!m) return;
      var kpDecl;
      try { kpDecl = Function('return ' + m[1])(); } catch (e) { return; }
      var kps = [];
      Object.keys(kpDecl || {}).forEach(function (g) {
        var arr = kpDecl[g];
        if (Array.isArray(arr)) arr.forEach(function (k) { if (typeof k === 'string') kps.push(k); });
      });
      if (kps.length) {
        capabilities.push({ pluginId: entry.id, subject: entry.subject, knowledgePoints: kps, capabilities: [], questionTypes: [] });
      }
    });
  } catch (e) { /* registry 不可用则跳过 */ }
})();

// KP -> 覆盖来源（capability 记录索引）
var kpCovered = {};
capabilities.forEach(function (cap) {
  var subj = canonicalSubject(cap.subject);
  (cap.knowledgePoints || []).forEach(function (kp) {
    if (!kpCovered[kp]) kpCovered[kp] = [];
    if (kpCovered[kp].indexOf(subj) === -1) kpCovered[kp].push(subj);
  });
});

// 占位 KP 描述：从原始知识分片读取（getEntries 不含 description）
var descMap = {};
(function () {
  ['math', 'cn', 'en'].forEach(function (shard) {
    try {
      var mod = require(path.join(ROOT, 'shared', 'knowledge-' + (shard === 'math' ? 'math' : shard) + '.js'));
      if (shard !== 'math') { try { require(path.join(ROOT, 'shared', 'knowledge-bank.js')); } catch (e) {} }
      var root = mod;
      if (mod && mod.subjects) root = mod.subjects;
      function collect(node) {
        if (!node) return;
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (typeof node === 'object' && node !== null) {
          if (typeof node.id === 'string') {
            var d = (node.description != null ? String(node.description) : (node.desc != null ? String(node.desc) : ''));
            if (d) descMap[node.id] = d;
          }
          Object.keys(node).forEach(function (k) { var v = node[k]; if (v && typeof v === 'object') collect(v); });
        }
      }
      collect(mod);
    } catch (e) { /* 分片不可用则跳过 */ }
  });
})();

function isPlaceholder(kpId) {
  var d = descMap[kpId] || '';
  return /占位|placeholder|待\s*\S*\s*实现|待插件实现/.test(d);
}

var placeholderKP = [];
allKP.forEach(function (e) { if (isPlaceholder(e.id)) placeholderKP.push(e.id); });

var orphanKP = [];
allKP.forEach(function (e) {
  if (isPlaceholder(e.id)) return; // 占位点不判 orphan
  if (!kpCovered[e.id]) orphanKP.push(e.id);
});

var knownKps = Object.keys(kpById);
var orphanCap = [];
capabilities.forEach(function (cap) {
  (cap.knowledgePoints || []).forEach(function (kp) {
    if (knownKps.indexOf(kp) === -1) orphanCap.push({ plugin: cap.pluginId, kp: kp });
  });
});
// 去重
var seenCap = {};
orphanCap = orphanCap.filter(function (o) {
  var k = o.plugin + '::' + o.kp;
  if (seenCap[k]) return false; seenCap[k] = true; return true;
});

// ---- 4. 未解析 Generator（记录存在但 register/可用性缺失）----
var unresolvedGen = [];
var regById = {};
GR.records().forEach(function (r) { regById[r.id] = r; });
// core 记录必须有对应 native generator 文件可用；legacy 记录必须有插件可解析
GR.records().forEach(function (r) {
  if (r.scope === 'core') {
    var g = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js')).get(r.id);
    if (!g) unresolvedGen.push(r.id);
  } else {
    // legacy：能经 bridge 装载（能力注册表有对应 pluginId 或不要求）
    if ((r.capabilities || []).length === 0 && (r.questionTypes || []).length === 0 && !r.knowledgePoints) {
      unresolvedGen.push(r.id);
    }
  }
});

// ---- 输出 ----
console.log('Generator Coverage (M7-R31)');
  console.log('  KnowledgePoint 总数 : ' + allKP.length);
  console.log('  Capability 记录     : ' + capabilities.length);
  console.log('  占位 KP（待实现）   : ' + placeholderKP.length + (placeholderKP.length ? ' (' + placeholderKP.slice(0, 8).join(', ') + ')' : ''));
  console.log('  orphan knowledge points: ' + orphanKP.length);
  console.log('  orphan capabilities    : ' + orphanCap.length);
  console.log('  unresolved generators  : ' + unresolvedGen.length);

var fail = false;
if (orphanKP.length) { fail = true; console.log('  ❌ orphan KP: ' + orphanKP.slice(0, 8).join(', ')); }
if (orphanCap.length) { fail = true; console.log('  ❌ orphan cap: ' + orphanCap.slice(0, 5).map(function (o) { return o.plugin + '→' + o.kp; }).join(', ')); }
if (unresolvedGen.length) { fail = true; console.log('  ❌ unresolved gen: ' + unresolvedGen.slice(0, 5).join(', ')); }

if (!fail) {
  console.log('GENERATOR-COVERAGE: PASS（0 orphan KP / 0 orphan capability / 0 unresolved generator）');
  process.exitCode = 0;
} else {
  console.log('GENERATOR-COVERAGE: FAIL');
  process.exitCode = 1;
}