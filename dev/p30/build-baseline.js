#!/usr/bin/env node
'use strict';
/**
 * dev/p30/build-baseline.js — P30-01 机器可读基线（唯一机器基线生成器）
 *
 * 只读：仅 READ/PARSE/SPAWN(测试)，不修改任何生产/KBL/教学文件。
 * 输出：dev/p30/reports/p30-baseline.json（可再生报告，.gitignore 忽略）。
 *
 * 人类基线仍以 docs/00-BASELINE.md 为准；本文件是 P30 阶段的机器测量口径，
 * 每次修改数据链后应重跑，并与本快照对账（数字漂移必须能解释）。
 *
 * 用法：node dev/p30/build-baseline.js [--with-tests]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WITH_TESTS = process.argv.indexOf('--with-tests') !== -1;

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}
function sha256(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}
function spread(arr, keyFn) {
  const out = {};
  arr.forEach(function (x) { const k = keyFn(x); out[k] = (out[k] || 0) + 1; });
  return Object.keys(out).sort().reduce(function (o, k) { o[k] = out[k]; return o; }, {});
}
function walk(dir, filter) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p, filter));
    else if (!filter || filter(p)) out.push(p);
  }
  return out;
}

const findings = [];
function note(level, code, message) { findings.push({ level, code, message }); }

// ---------- 1. Source Excel 完整性 ----------
const raw = readJson('kbl/import/extract-raw.json');
const rootRel = 'kbl/root/小学G1-G6数学知识点.xlsx';
const rootHash = sha256(rootRel);
const source = {
  file: rootRel,
  exists: exists(rootRel),
  sha256: rootHash,
  size: fs.statSync(path.join(ROOT, rootRel)).size,
  extractFingerprintHash: raw.fingerprint && raw.fingerprint.fileHash,
  hashMatchesExtract: !!(raw.fingerprint && raw.fingerprint.fileHash === rootHash),
  extractStats: raw.stats
};
if (!source.hashMatchesExtract) note('fail', 'SRC-HASH', 'root Excel SHA256 与 extract-raw.fingerprint 不一致（Excel 被改后未重跑 extract）');

// ---------- 2. Canonical 五类 ----------
const courseDoc = readJson('kbl/canonical/course.json');
const knowDoc = readJson('kbl/canonical/knowledge.json');
const relDoc = readJson('kbl/canonical/relations.json');
const capDoc = readJson('kbl/canonical/capability.json');
const mapDoc = readJson('kbl/canonical/mappings.json');

const ID_RE = /^math-g[1-6]-(up|down)-u\d{2}-k\d{3}$/;
const kps = knowDoc.knowledge;
const kpIds = kps.map(function (k) { return k.id; });
const idSet = new Set(kpIds);
const badIds = kpIds.filter(function (id) { return !ID_RE.test(id); });
const dupKp = kpIds.filter(function (id, i) { return kpIds.indexOf(id) !== i; });
const unitIds = new Set(kps.map(function (k) { return k.unitId; }));
const orphanKp = kps.filter(function (k) { return !(unitIds.has(k.unitId)); });
if (badIds.length) note('fail', 'ID-FORMAT', 'canonical id 不合法: ' + badIds.slice(0, 5).join(','));
if (dupKp.length) note('fail', 'ID-DUP', '重复 KP: ' + dupKp.slice(0, 5).join(','));

const mappings = mapDoc.mappings;
const illegalMappings = mappings.filter(function (m) {
  return !idSet.has(m.knowledgeId) || m.permission === 'allow' && !m.pluginId;
});
const relEdges = relDoc.relations;
const danglingRel = relEdges.filter(function (r) { return !idSet.has(r.fromId) || !idSet.has(r.toId); });
if (illegalMappings.length) note('fail', 'MAP-ILLEGAL', '非法 mapping（孤儿 KP 或 allow 无 pluginId）: ' + illegalMappings.length);
if (danglingRel.length) note('fail', 'REL-DANGLING', '关系端点不存在: ' + danglingRel.length);

const canonical = {
  course: courseDoc.course.length,
  units: unitIds.size,
  knowledge: kps.length,
  idAllCanonical: badIds.length === 0,
  duplicateKp: dupKp.length,
  orphanKp: 0,
  capability: capDoc.capability.length,
  relations: relEdges.length,
  relationRuleSpread: spread(relEdges, function (r) { return String(r.rule || '').split(':')[0]; }),
  relationReviewStatus: spread(relEdges, function (r) { return r.reviewStatus || '(none)'; }),
  mappings: mappings.length,
  mappingPermission: spread(mappings, function (m) { return m.permission; }),
  mappingsByType: spread(mappings, function (m) { return m.questionType; }),
  illegalMappings: illegalMappings.length,
  danglingRelations: danglingRel.length
};

// ---------- 3. 派生链血缘（复用 P30-02 唯一门禁实现，禁止第二套比对） ----------
const { runLineageChecks } = require('./check-kbl-lineage.js');
const lineageResult = runLineageChecks(ROOT);
const kblCurriculum = readJson('kbl/data/math/curriculum.json');
const indexDoc = readJson('kbl/index/index.json');
const lineage = {
  pass: lineageResult.findings.length === 0,
  curriculumUnits: kblCurriculum.units.length,
  indexKpCount: Object.keys(indexDoc.byId).length,
  checks: lineageResult.checks.map(function (c) { return { id: c.id, ok: c.ok, detail: c.detail }; })
};
lineageResult.findings.forEach(function (f) { note(f.level, f.code, f.message); });

// ---------- 4. Manifest ----------
const kblManifest = readJson('kbl/manifest/manifest.json');
const sharedManifest = readJson('shared/knowledge/manifest/manifest.json');
const manifest = {
  kblCounts: kblManifest.counts,
  rootHash: kblManifest.rootHash,
  sharedRootHash: sharedManifest.integrity && sharedManifest.integrity.rootHash,
  rootHashAgrees: kblManifest.rootHash === (sharedManifest.integrity && sharedManifest.integrity.rootHash)
};
if (!manifest.rootHashAgrees) note('fail', 'MANIFEST-HASH', 'kbl manifest rootHash 与 shared manifest 不一致');

// ---------- 5. Canonical 题型 + Generator（运行时注册表真实口径） ----------
let questionTypes = null;
let generators = null;
try {
  const QT = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
  questionTypes = QT.all().map(function (t) { return t.id; });
} catch (e) { note('fail', 'QT-REGISTRY', 'question-type-registry 加载失败: ' + e.message); }

try {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const G = global.GeneratorRegistry;
  const recs = (G && typeof G.all === 'function') ? G.all() : [];
  const usedPlugins = new Set(mappings.filter(function (m) { return m.permission === 'allow'; }).map(function (m) { return m.pluginId; }));
  let production = 0, combineOnly = 0, dormantCarrier = 0;
  recs.forEach(function (r) {
    if (r.id === 'generator:composite') combineOnly++;
    else if (usedPlugins.has(r.id)) production++;
    else dormantCarrier++;
  });
  generators = { total: recs.length, production: production, combineOnly: combineOnly, dormantCarrier: dormantCarrier, ids: recs.map(function (r) { return r.id; }) };
} catch (e) { note('fail', 'GEN-REGISTRY', 'GeneratorRegistry 加载失败: ' + e.message); }

// ---------- 6. Teaching 语义数据（T2） ----------
function t(file) {
  try { return readJson('kbl/teaching/' + file); } catch (e) { return null; }
}
const qt = t('qt-intent.json');
const vr = t('variation-profiles.json');
const mc = t('misconception-profiles.json');
const ev = t('evidence-rules.json');
const gd = t('golden-questions.json');
const sf = t('semantic-families.json');
const tc = t('type-contracts.json');
const teaching = {
  intent: {
    rows: qt.rows.length,
    status: qt.counts,
    byQuestionType: qt.counts.byQuestionType,
    hasAssessmentBlock: qt.rows.every(function (r) { return r.intent && typeof r.intent.trainsWhat === 'string'; })
  },
  variation: { rows: vr.counts.rows, kps: vr.counts.kps, profiled: vr.counts.profiled },
  misconception: { slots: mc.counts.slots, kps: mc.counts.kps, kpsWithSlots: mc.counts.kpsWithSlots },
  evidence: { rules: ev.rules.length, assertionKinds: Object.keys(ev.assertionKinds || {}).length },
  golden: { questions: gd.counts.total, families: gd.counts.families, reviewStatus: gd.reviewStatus },
  semanticFamilies: { families: sf.families.length, kpCoverage: Object.keys(sf.kpFamilies).length },
  typeContracts: { contracts: tc.contracts.length, types: tc.contracts.map(function (c) { return c.questionType; }) },
  files: walk(path.join(ROOT, 'kbl', 'teaching'), function (p) { return p.endsWith('.json'); })
    .map(function (p) { return path.relative(path.join(ROOT, 'kbl', 'teaching'), p); }).sort()
};

// ---------- 7. SVG 渲染器（静态清单：描述符语义类型 + 实现模块） ----------
const registrySrc = fs.readFileSync(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'), 'utf8');
const m = /SUBJECT_TO_TYPE\s*=\s*\{([^}]+)\}/.exec(registrySrc);
const descriptorTypes = m ? m[1].split(',').map(function (s) { return s.split(':')[0].trim(); }).filter(Boolean) : [];
const svgModules = walk(path.join(ROOT, 'shared', 'svg'), function (p) { return /svg-.*\.js$/.test(p); })
  .concat(walk(path.join(ROOT, 'plugins'), function (p) { return /svg-.*\.js$/.test(p); }))
  .map(function (p) { return path.relative(ROOT, p); }).sort();
const svg = { descriptorSemanticTypes: descriptorTypes.length, types: descriptorTypes, alias: ['make-ten'], rendererModules: svgModules.length, modules: svgModules };

// ---------- 8. 测试 ----------
const testFiles = walk(path.join(ROOT, 'tests'), function (p) { return p.endsWith('.test.js'); });
const tests = { files: testFiles.length, cases: null, pass: null, fail: null, countedAtRuntime: false };
if (WITH_TESTS) {
  let out;
  try {
    out = execSync('npm test --silent', { cwd: ROOT, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    out = ((e.stdout || '') + (e.stderr || ''));
  }
  // Node test runner：默认 spec 输出「ℹ tests N」；TAP 输出「# tests N」
  const pick = function (label) {
    const re = new RegExp('(?:ℹ|#)\\s*' + label + '\\s+(\\d+)', 'm');
    const x = re.exec(out); return x ? Number(x[1]) : null;
  };
  tests.cases = pick('tests');
  tests.pass = pick('pass');
  tests.fail = pick('fail');
  tests.countedAtRuntime = true;
}

// ---------- 输出 ----------
const doc = {
  schemaVersion: 'p30-baseline.1',
  generatedBy: 'dev/p30/build-baseline.js',
  deterministic: true,
  source: source,
  canonical: canonical,
  lineage: lineage,
  manifest: manifest,
  questionTypes: questionTypes,
  generators: generators,
  teaching: teaching,
  svg: svg,
  tests: tests,
  findings: findings
};

const outDir = path.join(ROOT, 'dev', 'p30', 'reports');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'p30-baseline.json'), JSON.stringify(doc, null, 2) + '\n');

console.log('=== P30-01 机器基线 ===');
console.log('KP:', canonical.knowledge, '| 册:', canonical.course, '| 单元:', canonical.units,
  '| 关系:', canonical.relations, '| 映射:', canonical.mappings, JSON.stringify(canonical.mappingPermission));
console.log('题型:', (questionTypes || []).length, (questionTypes || []).join('/'));
console.log('Generator:', generators && generators.total, '| Intent:', teaching.intent.rows, JSON.stringify({
  confirmed: teaching.intent.status.confirmed, aiVerified: teaching.intent.status.aiVerified, needsReview: teaching.intent.status.needsReview
}));
console.log('Variation:', teaching.variation.rows, '行/', teaching.variation.kps, 'KP | Misconception:', teaching.misconception.slots, '槽 | Evidence:', teaching.evidence.rules, '| Golden:', teaching.golden.questions);
console.log('SVG:', svg.descriptorSemanticTypes, '语义类型/', svg.rendererModules, '模块 | 测试文件:', tests.files, WITH_TESTS ? ('| 用例: ' + tests.cases + ' pass ' + tests.pass + ' fail ' + tests.fail) : '（加 --with-tests 实测用例数）');
const fails = findings.filter(function (f) { return f.level === 'fail'; });
console.log('lineage 一致:', lineage.pass ? 'YES' : 'NO');
if (fails.length) {
  console.log('\nFAIL 发现:');
  fails.forEach(function (f) { console.log('  [' + f.code + '] ' + f.message); });
  process.exit(1);
}
console.log('\n报告: dev/p30/reports/p30-baseline.json');
