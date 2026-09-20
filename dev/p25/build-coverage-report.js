#!/usr/bin/env node
'use strict';
// dev/p25/build-coverage-report.js — P25-14 375 KP 教育覆盖率报告
//
// 7 维覆盖率统计（任务书 P25-14 原文）：
//   1. KP semantic coverage       — kbl/teaching/kp-matrix.json
//   2. QuestionType semantic      — kbl/teaching/qt-intent.json
//   3. Generator semantic         — kbl/teaching/semantic-families.json + generator-registry.js
//   4. Evidence                   — kbl/teaching/evidence-rules.json
//   5. Variation                  — kbl/teaching/variation-profiles.json
//   6. Misconception              — kbl/teaching/misconception-profiles.json
//   7. Learner feedback           — shared/learner/learner-model.js（P27-12 KnowledgePracticeState）
//
// 「被消费」判定（任务书红线："禁止用'有字段'冒充'已实现'"）：
//   检查 kbl/teaching/*.json 数据文件是否被生产代码（shared/generator、
//   shared/validator、shared/strategy、shared/learner 任一目录下的 .js）
//   以 require 路径形式引用。仅当生产代码至少有一处读引用，才计为
//   consumedByProduction:true。declared-only（仅 JSON 存在但无生产消费）
//   字段计入 declaredOnlyFields。
//
//   补充字段级检测：对每个维度的代表性字段名（非通用名），扫描源码的属性访问
//   形式 .field 或 ['field']，作为辅助证据。
//
// 用法：node dev/p25/build-coverage-report.js [--strict]
//   --strict  任一 declared-only 字段 → exit 1
// 产出：dev/p25/reports/coverage-report.json + stdout 摘要

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var STRICT = process.argv.indexOf('--strict') !== -1;

// ---------- 数据加载 ----------

function loadJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch (e) { return null; }
}

var kpMatrix = loadJson('kbl/teaching/kp-matrix.json');
var qtIntent = loadJson('kbl/teaching/qt-intent.json');
var semanticFamilies = loadJson('kbl/teaching/semantic-families.json');
var evidenceRules = loadJson('kbl/teaching/evidence-rules.json');
var variationProfiles = loadJson('kbl/teaching/variation-profiles.json');
var misconceptionProfiles = loadJson('kbl/teaching/misconception-profiles.json');

// ---------- 源码扫描工具 ----------

function listJsFiles(dir, out) {
  out = out || [];
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    var full = path.join(dir, name);
    var st = fs.statSync(full);
    if (st.isDirectory()) listJsFiles(full, out);
    else if (name.endsWith('.js')) out.push(full);
  });
  return out;
}

function readFileContent(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch (e) { return ''; }
}

// 剥离注释 + 字符串，避免误判
function stripCommentsAndStrings(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
}

// 预读全部生产代码（一次 IO + 一次 strip）
var PROD_DIRS = [
  'shared/generator',
  'shared/validator',
  'shared/strategy',
  'shared/learner',
  'shared/engine'
].map(function (rel) { return path.join(ROOT, rel); });

var prodFiles = [];
PROD_DIRS.forEach(function (d) { listJsFiles(d, prodFiles); });

var prodCorpus = prodFiles.map(function (f) {
  return {
    path: f,
    rel: path.relative(ROOT, f),
    raw: readFileContent(f),
    stripped: null  // lazy
  };
});

function getStripped(entry) {
  if (entry.stripped === null) entry.stripped = stripCommentsAndStrings(entry.raw);
  return entry.stripped;
}

// 检测文件名是否被生产代码引用（用于 kbl/teaching/X.json 的 require 匹配）
// 模式覆盖：
//   1. 完整文件名 'X.json'（直接 require 路径）
//   2. 带引号的 base name 'X' / "X"（loadTeaching('X') 等函数参数模式）
function fileReferencedBy(fileName) {
  var baseName = fileName.replace(/\.json$/, '');
  // 引号包裹的 base name（避免子串误判，如 'semantic-families' 不会匹配 'my-semantic-families-list'）
  var quotedBase = new RegExp('[\'"]' + baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\'"]');
  var consumers = [];
  prodCorpus.forEach(function (entry) {
    if (entry.raw.indexOf(fileName) !== -1 || quotedBase.test(entry.raw)) {
      consumers.push(entry.rel);
    }
  });
  return consumers;
}

// 检测字段名是否在 stripped 源码中以属性访问形式出现
function fieldReferencedIn(field, dirs) {
  if (!field) return false;
  var dotPattern = new RegExp('\\.' + field + '\\b');
  var bracketPattern = new RegExp('\\[\\s*[\'"]' + field + '[\'"]\\s*\\]');
  return prodCorpus.some(function (entry) {
    if (dirs && dirs.indexOf(path.dirname(entry.rel)) === -1 && !dirs.some(function (d) { return entry.rel.indexOf(d) === 0; })) return false;
    var s = getStripped(entry);
    return dotPattern.test(s) || bracketPattern.test(s);
  });
}

// ---------- 7 维覆盖率统计 ----------

var dimensions = [];

function makeDim(key, name, declared, fields) {
  fields.forEach(function (f) {
    var consumers = fileReferencedBy(f.dataFile);
    f.consumers = consumers;
    f.consumedByProduction = consumers.length > 0;
    if (f.fieldName) {
      f.fieldReferenced = fieldReferencedIn(f.fieldName);
    }
    f.status = f.consumedByProduction ? 'implemented' : 'declared-only';
  });
  var impl = fields.filter(function (f) { return f.status === 'implemented'; }).length;
  return {
    key: key, name: name, declared: declared,
    fields: fields,
    summary: { total: fields.length, implemented: impl, declaredOnly: fields.length - impl }
  };
}

// 维 1：KP semantic
dimensions.push(makeDim(
  'kpSemantic', 'KP semantic coverage',
  {
    totalKPs: kpMatrix ? kpMatrix.counts.knowledgePoints : 0,
    byDraftLevel: kpMatrix ? kpMatrix.distributions.byDraftLevel : {}
  },
  [{ dataFile: 'kp-matrix.json', source: 'kbl/teaching/kp-matrix.json', fieldName: 'draftSemanticLevel' }]
));

// 维 2：QuestionType semantic
dimensions.push(makeDim(
  'questionTypeSemantic', 'QuestionType semantic coverage',
  { rows: qtIntent ? qtIntent.counts.rows : 0, byStatus: qtIntent ? qtIntent.counts : {} },
  [
    { dataFile: 'qt-intent.json', source: 'kbl/teaching/qt-intent.json', fieldName: 'trainsWhat' },
    { dataFile: 'qt-intent.json', source: 'kbl/teaching/qt-intent.json', fieldName: 'whyThisType' }
  ]
));

// 维 3：Generator semantic
dimensions.push(makeDim(
  'generatorSemantic', 'Generator semantic coverage',
  { semanticFamilies: semanticFamilies ? (semanticFamilies.families || []).length : 0 },
  [
    { dataFile: 'semantic-families.json', source: 'kbl/teaching/semantic-families.json', fieldName: 'semanticFamily' },
    { dataFile: 'generator-registry.js', source: 'shared/generator/generator-registry.js', fieldName: 'knowledgePoints' }
  ]
));

// 维 4：Evidence
dimensions.push(makeDim(
  'evidence', 'Evidence coverage',
  { kpsWithEvidenceRules: evidenceRules ? (evidenceRules.rules || []).length : 0 },
  [
    { dataFile: 'evidence-rules.json', source: 'kbl/teaching/evidence-rules.json', fieldName: 'semanticEvidence' }
  ]
));

// 维 5：Variation
dimensions.push(makeDim(
  'variation', 'Variation coverage',
  { kpsWithVariationProfiles: variationProfiles ? Object.keys(variationProfiles.kps || {}).length : 0 },
  [
    { dataFile: 'variation-profiles.json', source: 'kbl/teaching/variation-profiles.json', fieldName: 'variationDirectives' },
    { dataFile: 'variation-directive.js', source: 'shared/strategy/variation-directive.js', fieldName: 'variationDirectives' }
  ]
));

// 维 6：Misconception
dimensions.push(makeDim(
  'misconception', 'Misconception coverage',
  { kpsWithMisconceptionProfiles: misconceptionProfiles ? Object.keys(misconceptionProfiles.kps || {}).length : 0 },
  [
    { dataFile: 'misconception-profiles.json', source: 'kbl/teaching/misconception-profiles.json', fieldName: 'triggerPattern' },
    { dataFile: 'misconception-profiles.json', source: 'kbl/teaching/misconception-profiles.json', fieldName: 'errorFocus' }
  ]
));

// 维 7：Learner feedback
dimensions.push(makeDim(
  'learnerFeedback', 'Learner feedback coverage',
  { model: 'shared/learner/learner-model.js (P27-12 KnowledgePracticeState)' },
  [
    { dataFile: 'learner-model.js', source: 'shared/learner/learner-model.js', fieldName: 'KnowledgePracticeState' },
    { dataFile: 'practice-result.js', source: 'shared/learner/practice-result.js', fieldName: 'semanticTarget' }
  ]
));

// ---------- 汇总 ----------

var declaredOnlyFields = [];
dimensions.forEach(function (dim) {
  dim.fields.forEach(function (f) {
    if (f.status === 'declared-only') declaredOnlyFields.push(dim.key + '.' + (f.dataFile || f.fieldName));
  });
});

// CI allowlist：已知 declared-only 字段（dev 基线/观察产物，非生产消费对象）。
// --strict 仅对 allowlist 之外的新增 declared-only 字段阻断，避免回归。
// 详见 docs/p25/P25-14-COVERAGE-REPORT.md §4。
var KNOWN_DECLARED_ONLY = {
  'kpSemantic.kp-matrix.json': true,           // dev 基线矩阵，生产运行时直读 kbl/root
  'variation.variation-profiles.json': true    // P27-09 观察产物，生产由 variation-directive.js 接入
};
var newDeclaredOnly = declaredOnlyFields.filter(function (k) { return !KNOWN_DECLARED_ONLY[k]; });

var report = {
  generatedAt: new Date().toISOString(),
  baseline: {
    knowledgePoints: kpMatrix ? kpMatrix.counts.knowledgePoints : null,
    allowMappings: kpMatrix ? kpMatrix.counts.allowMappings : null,
    aClassKPs: kpMatrix ? (kpMatrix.distributions.byDraftLevel.A || 0) : null
  },
  dimensions: dimensions,
  overall: {
    dimensionsTotal: dimensions.length,
    dimensionsImplemented: dimensions.filter(function (d) { return d.summary.declaredOnly === 0; }).length,
    declaredOnlyFields: declaredOnlyFields,
    knownDeclaredOnly: Object.keys(KNOWN_DECLARED_ONLY),
    newDeclaredOnly: newDeclaredOnly
  }
};

// ---------- 输出 ----------

var reportDir = path.join(__dirname, 'reports');
if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
var reportPath = path.join(reportDir, 'coverage-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('P25-14 教育覆盖率报告');
console.log('='.repeat(56));
console.log('基线：KP=' + report.baseline.knowledgePoints + ' / ALLOW=' + report.baseline.allowMappings + ' / A 类=' + report.baseline.aClassKPs);
console.log('-'.repeat(56));
dimensions.forEach(function (d) {
  var tag = d.summary.declaredOnly === 0 ? '✓' : '⚠';
  console.log(tag + ' ' + d.name + ' — implemented ' + d.summary.implemented + '/' + d.summary.total);
  d.fields.forEach(function (f) {
    if (f.status === 'declared-only') {
      console.log('    ✗ ' + f.dataFile + ' (declared-only; 无生产消费)');
    } else {
      console.log('    ✓ ' + f.dataFile + ' → ' + f.consumers.length + ' 处消费');
    }
  });
});
console.log('-'.repeat(56));
console.log('维度总数：' + report.overall.dimensionsTotal + '，全 implemented：' + report.overall.dimensionsImplemented);
if (declaredOnlyFields.length) {
  console.log('declared-only 字段 ' + declaredOnlyFields.length + ' 项（known ' + Object.keys(KNOWN_DECLARED_ONLY).length + ' / new ' + newDeclaredOnly.length + '）：');
  declaredOnlyFields.forEach(function (f) {
    var tag = KNOWN_DECLARED_ONLY[f] ? 'known' : 'NEW';
    console.log('  - [' + tag + '] ' + f);
  });
}
console.log('报告已写入：' + path.relative(ROOT, reportPath));

if (STRICT && newDeclaredOnly.length) {
  console.log('\n--strict 模式：检测到 ' + newDeclaredOnly.length + ' 项新增 declared-only 字段（allowlist 之外），exit 1');
  newDeclaredOnly.forEach(function (f) { console.log('  ✗ ' + f); });
  process.exit(1);
}
