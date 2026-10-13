'use strict';
/**
 * dev/p40/t14-mainline-audit.js — P40-T-14 三主线全链抽查（加法/分数/面积，G1-G6）
 *
 * 每条主线五个维度：
 *   ① familyId 一致（该族全成员 conceptFamily.id === 族）
 *   ② stageOrder 递增（族内唯一且沿链严格递增）
 *   ③ 难度不倒挂（validateFamilyDifficultyMonotonic；违规登记 needs-review，不自动改数）
 *   ④ 解释衔接（每个有同族前序的 KP 经 resolve().upstream 获承上启下桥接；前序须同族）
 *   ⑤ 组合合规（主线的跨族前置组合经 validateCrossFamilyPrerequisite 判定为可满足）
 * 输出：dev/p40/out/t14-mainline-audit.json + t14-mainline-audit.md（链路图 + 证据）
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
var K = global.App.KNOWLEDGE;
var KC = global.App.KnowledgeContext;
var SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
var DiffVal = require(path.join(ROOT, 'shared', 'validator', 'difficulty-integrity-validator.js'));
var CompositeVal = require(path.join(ROOT, 'shared', 'validator', 'composite-validator.js'));
var RESOLVER = SP.createSemanticParameterResolver({});

var MAINLINES = [
  { familyId: 'fam_addsub', name: '加法（加减运算）' },
  { familyId: 'fam_fraction', name: '分数' },
  { familyId: 'fam_measure', name: '面积（测量）' }
];

var relationsFor = function (id, dir) { return KC.relationsFor(id, dir); };
var familyOf = function (id) { var kp = K.get(id); return kp && kp.semantic ? kp.semantic.conceptFamily : null; };
var CAP = {};
JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'canonical', 'capability.json'), 'utf8')).capability.forEach(function (c) { CAP[c.knowledgeId] = c; });

var out = { task: 'P40-T-14', generatedBy: 'dev/p40/t14-mainline-audit.js', mainlines: [], problems: [] };

MAINLINES.forEach(function (ml) {
  var members = [];
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
    K.byGrade(g).forEach(function (kp) { if (kp.semantic && kp.semantic.conceptFamily && kp.semantic.conceptFamily.id === ml.familyId) members.push(kp); });
  });
  members.sort(function (a, b) { return a.semantic.conceptFamily.stageOrder - b.semantic.conceptFamily.stageOrder; });

  // ① familyId 一致
  var famBad = members.filter(function (kp) { return kp.semantic.conceptFamily.id !== ml.familyId; }).map(function (kp) { return kp.knowledgeId; });

  // ② stageOrder 递增（唯一）
  var seen = {}, dup = [], nonInc = [];
  members.forEach(function (kp, i) {
    var so = kp.semantic.conceptFamily.stageOrder;
    if (seen[so]) dup.push(so); seen[so] = 1;
    if (i > 0 && so <= members[i - 1].semantic.conceptFamily.stageOrder) nonInc.push(kp.knowledgeId);
  });

  // ③ 难度不倒挂
  var diffRows = members.map(function (kp) {
    var cf = kp.semantic.conceptFamily;
    var c = CAP[kp.knowledgeId];
    return { knowledgeId: kp.knowledgeId, familyId: cf.id, stageOrder: cf.stageOrder, seedDifficulty: c ? c.seedDifficulty : null };
  });
  var diffP = DiffVal.validateFamilyDifficultyMonotonic(diffRows);

  // ④ 解释衔接
  var withUp = [], upstreamWrongFamily = [];
  members.forEach(function (kp) {
    var sp = RESOLVER.resolve(kp.knowledgeId, 'judge');
    if (sp && sp.upstream) {
      withUp.push(kp.knowledgeId);
      if (sp.upstream.familyId !== ml.familyId) upstreamWrongFamily.push(kp.knowledgeId);
    }
  });

  // ⑤ 组合合规：主线的跨族前置组合（prereqFrom 与 KP 跨族）须经 validateCrossFamilyPrerequisite 判定可满足
  var combos = [], comboOk = 0, comboBad = [];
  var rels = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'canonical', 'relations.json'), 'utf8')).relations;
  var memberSet = {}; members.forEach(function (kp) { memberSet[kp.knowledgeId] = 1; });
  rels.forEach(function (r) {
    if (!memberSet[r.toId]) return;
    var fa = familyOf(r.fromId), fb = familyOf(r.toId);
    if (!fa || !fb || fa.id === fb.id) return;
    var v = CompositeVal.validateCrossFamilyPrerequisite([r.fromId, r.toId], { relationsFor: relationsFor, familyOf: familyOf });
    combos.push({ kp: r.toId, prereq: r.fromId, fromFamily: fa.id, valid: v.valid });
    if (v.valid) comboOk++; else comboBad.push(r.fromId + '->' + r.toId);
  });

  var chain = members.map(function (kp) {
    var cf = kp.semantic.conceptFamily;
    var sp = RESOLVER.resolve(kp.knowledgeId, 'judge');
    return {
      knowledgeId: kp.knowledgeId, name: kp.name, grade: kp.grade, book: kp.book,
      stageOrder: cf.stageOrder, seedDifficulty: diffRows.filter(function (d) { return d.knowledgeId === kp.knowledgeId; })[0].seedDifficulty,
      upstream: sp && sp.upstream ? sp.upstream.knowledgeId : null
    };
  });

  var checks = {
    familyIdConsistent: famBad.length === 0,
    stageOrderStrict: dup.length === 0 && nonInc.length === 0,
    difficultyMonotonic: diffP.valid,
    explanationContinuity: upstreamWrongFamily.length === 0,
    compositeCompliance: comboBad.length === 0
  };
  var entry = {
    familyId: ml.familyId, name: ml.name, members: members.length,
    checks: checks,
    difficultyInversions: diffP.violations,               // needs-review（T-07 挂人工）
    withUpstream: withUp.length, upstreamWrongFamily: upstreamWrongFamily,
    crossFamilyCombos: combos.length, comboOk: comboOk, comboBad: comboBad,
    chain: chain
  };
  out.mainlines.push(entry);
  if (!checks.familyIdConsistent) out.problems.push(ml.familyId + ' familyId 不一致');
  if (!checks.stageOrderStrict) out.problems.push(ml.familyId + ' stageOrder 重复/非递增');
  if (!checks.explanationContinuity) out.problems.push(ml.familyId + ' 前序跨族错配');
  if (!checks.compositeCompliance) out.problems.push(ml.familyId + ' 跨族组合前置未满足');
  // difficultyMonotonic 违规为 needs-review，不进 problems（T-07 口径）
});

out.verdict = out.problems.length === 0 ? 'PASS' : 'FAIL';
out.needsReview = { difficultyInversions: out.mainlines.reduce(function (n, m) { return n + m.difficultyInversions.length; }, 0) };

fs.mkdirSync(path.join(ROOT, 'dev', 'p40', 'out'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dev', 'p40', 'out', 't14-mainline-audit.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');

// ---- Markdown 链路图 ----
var md = [];
md.push('# P40-T-14 三主线全链抽查（加法 / 分数 / 面积，G1-G6）');
md.push('');
md.push('> 维度：①familyId 一致 ②stageOrder 递增 ③难度不倒挂（needs-review） ④解释衔接 ⑤组合合规。');
md.push('');
out.mainlines.forEach(function (m) {
  md.push('## ' + m.name + '（`' + m.familyId + '`，' + m.members + ' KP）');
  md.push('');
  md.push('| 维度 | 结果 |');
  md.push('|---|---|');
  md.push('| ① familyId 一致 | ' + (m.checks.familyIdConsistent ? '✓' : '✗') + ' |');
  md.push('| ② stageOrder 递增 | ' + (m.checks.stageOrderStrict ? '✓' : '✗') + ' |');
  md.push('| ③ 难度不倒挂 | ' + (m.checks.difficultyMonotonic ? '✓' : 'needs-review ' + m.difficultyInversions.length + ' 处（挂人工，T-07 口径）') + ' |');
  md.push('| ④ 解释衔接 | ' + (m.checks.explanationContinuity ? '✓ ' + m.withUpstream + '/' + m.members + ' 有同族前序桥接' : '✗') + ' |');
  md.push('| ⑤ 组合合规 | ' + (m.checks.compositeCompliance ? '✓ ' + m.comboOk + '/' + m.crossFamilyCombos + ' 跨族前置组合可满足' : '✗') + ' |');
  md.push('');
  md.push('```');
  var curGrade = '';
  m.chain.forEach(function (c) {
    var gk = c.grade + c.book;
    if (gk !== curGrade) { curGrade = gk; md.push('[' + c.grade + '-' + c.book + ']'); }
    md.push('  ' + String(c.stageOrder).padStart(2, ' ') + '. ' + c.name + '  (diff=' + c.seedDifficulty + (c.upstream ? ', ↑' + c.upstream : '') + ')');
  });
  md.push('```');
  md.push('');
});
md.push('## 全量结论');
md.push('');
md.push('- 结构三维（familyId/序/衔接）+ 组合合规：' + (out.problems.length === 0 ? '**PASS**' : '**FAIL** ' + out.problems.join('；')));
md.push('- 难度不倒挂：needs-review ' + out.needsReview.difficultyInversions + ' 处（登记人工，不自动改数）');
md.push('- 全量门禁证据见 change-log P40-T-14 条目（npm test / check-all）。');
md.push('');
fs.writeFileSync(path.join(ROOT, 'dev', 'p40', 'out', 't14-mainline-audit.md'), md.join('\n') + '\n', 'utf8');

console.log('[P40-T-14] 三主线抽查：' + (out.verdict === 'PASS' ? '✅ 结构/组合全过' : '❌ ' + out.problems.join('；')) +
  '；难度 needs-review ' + out.needsReview.difficultyInversions + ' 处');
out.mainlines.forEach(function (m) {
  console.log('  ' + m.name + '：' + m.members + ' KP | 衔接 ' + m.withUpstream + ' | 组合 ' + m.comboOk + '/' + m.crossFamilyCombos +
    ' | 难度倒挂 ' + m.difficultyInversions.length);
});
console.log('  证据：dev/p40/out/t14-mainline-audit.json + .md');
