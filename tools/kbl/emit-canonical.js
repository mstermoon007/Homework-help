/**
 * tools/kbl/emit-canonical.js — KBL Canonical → 运行时分发布局（P16-08 Cutover 前置）
 *
 * 输入：kbl/canonical/（course / knowledge / capability / mappings / relations）
 * 输出：与 tools/kbl/build.js 同源布局（build.js 消费）：
 *   kbl/data/math/curriculum.json
 *   kbl/data/math/{g}/knowledge-points.json
 *   kbl/relations/math/relations.json
 *   kbl/mappings/generation-contract/math.json
 *   kbl/index/index.json
 *
 * 原则：全部字段可溯源（meta.notes/derivedFields）；不产生第二人工知识源；
 *       旧模型字段结构保持（冻结层消费面），值来自 root 释义派生。
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var CANON = path.join(ROOT, 'kbl', 'canonical');
var OUT = path.join(ROOT, 'kbl');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

var course = readJson(path.join(CANON, 'course.json')).course;
var knowledge = readJson(path.join(CANON, 'knowledge.json')).knowledge;
var capability = readJson(path.join(CANON, 'capability.json')).capability;
var capById = {}; capability.forEach(function (c) { capById[c.knowledgeId] = c; });
var mappings = readJson(path.join(CANON, 'mappings.json')).mappings;
var mapByKp = {};
mappings.forEach(function (m) { (mapByKp[m.knowledgeId] = mapByKp[m.knowledgeId] || []).push(m); });
var relationsDoc = readJson(path.join(CANON, 'relations.json'));

// ---------- semantic / type 派生桶 ----------
function bucketType(domain) {
  if (domain === 'geometry') return 'geometry';
  if (domain === 'statistics') return 'statistics';
  if (domain === 'practice') return 'application';
  return 'calculation';
}
function familyOf(c) {
  if (c.domain === 'geometry') return 'geometry';
  if (c.domain === 'statistics') return 'statistics';
  if (c.domain === 'practice') return 'application-word';
  if (c.families.indexOf('fraction') !== -1) return 'fraction';
  if (c.families.indexOf('decimal') !== -1) return 'decimal';
  if (c.families.indexOf('percent') !== -1) return 'percent';
  if (c.families.indexOf('equation') !== -1) return 'equation';
  if (c.operations.indexOf('division') !== -1 || c.operations.indexOf('multiplication') !== -1) return 'multiplication-division';
  return 'calculation';
}
var OP_MAP = { addition: 'addition', subtraction: 'subtraction', multiplication: 'multiplication', division: 'division', mixed: 'mixed', sequential: 'sequential' };

// ---------- 1. curriculum ----------
var books = course.map(function (c) { return { grade: c.grade, book: c.book, bookName: c.book === 'up' ? '上册' : '下册' }; });
var unitRows = [];
// 从 knowledge 提取单元（按 canonical 顺序去重）
var unitSeen = {};
knowledge.forEach(function (k) {
  if (unitSeen[k.unitId]) return;
  unitSeen[k.unitId] = true;
  var rev = /P-|p-/.test(String(k.unit.unitNoRaw));
  unitRows.push({ unitId: k.unitId, grade: k.grade, book: k.book, unitNo: k.unit.unitOrdinal, unitName: k.unit.unitName, unitType: rev ? 'review' : 'textbook', status: k.status });
});
var curriculum = { schemaVersion: '1.0.0', subject: 'math', subjectName: '小学数学', edition: '2025-pep', source: 'kbl/root/小学G1-G6数学知识点.xlsx', books: books, units: unitRows };

// ---------- 2. knowledge-points（per grade） ----------
function buildKpEntry(k) {
  var c = capById[k.id];
  var def = k.definition || k.name;
  var primaryTypeOrder = ['calc', 'apply', 'fill', 'choice', 'judge', 'geometry', 'classify'];
  var maps = (mapByKp[k.id] || []);
  maps.sort(function (a, b) { return primaryTypeOrder.indexOf(a.questionType) - primaryTypeOrder.indexOf(b.questionType); });
  var primary = maps[0] || null;
  var questionTypes = (c.allowedTypes || []).map(function (t) { return { type: t, coefficient: 1, rawType: null }; });
  var isGeo = k.domain === 'geometry';
  var ops = (c.operations || []).map(function (o) { return OP_MAP[o] || o; });
  if (isGeo) ops = [];
  var representations = ['numeric'];
  if (isGeo || c.families.indexOf('graph') !== -1) representations.push('graphic');
  var steps = c.maxSteps != null ? c.maxSteps : 1;
  var nr = c.numberRange && !isGeo ? { min: 1, max: c.numberRange.max || 100 } : null;
  var entry = {
    knowledgeId: k.id,
    subject: 'math',
    grade: k.grade,
    book: k.book,
    unitId: k.unitId,
    unitNo: k.unit.unitOrdinal,
    knowledgeNo: k.knowledgeNo.split('.')[1],
    unitName: k.unit.unitName,
    module: k.domain, // 派生分组（原 module=M13 无源，改用 domain 桶）
    name: k.name,
    aliases: [],
    type: bucketType(k.domain),
    semantic: {
      family: familyOf(c),
      concept: def,
      operations: ops,
      representations: representations,
      category: k.domain,
      tags: []
    },
    content: { description: def, example: null, factualContent: {}, graphicType: c.families.indexOf('graph') !== -1 ? 'graphic' : null },
    assessment: { questionTypes: questionTypes, contextDefault: ['standard'], errors: [] },
    generation: {
      pluginId: primary ? primary.pluginId : null,
      capabilities: (c.allowedTypes || []).map(function (t) { return { id: t, type: 'question-format' }; }),
      numberRange: nr,
      maxSteps: steps
    },
    weight: 1,
    status: 'active',
    publication: 'published',
    difficultyAnnotation: { seedDifficulty: c.seedDifficulty, cognitiveLevel: c.cognitiveLevel, maxSteps: steps, numberRange: null, note: 'root 释义派生展示值；难度权威见 shared/catalog/difficulty.js' },
    source: { system: 'kbl-root-derived' },
    meta: { schemaVersion: '1.0.0', hash: null, version: 1, deprecatedReason: null, notes: (c.derivation.rules || []).join(';'), derivedFields: ['module', 'type', 'semantic', 'content', 'assessment', 'generation', 'difficultyAnnotation', 'publication', 'numberRange'], updatedAt: null }
  };
  return entry;
}

var grades = {};
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  grades[g] = { schemaVersion: '1.0.0', subject: 'math', grade: g, knowledgePoints: knowledge.filter(function (k) { return k.grade === g; }).map(buildKpEntry) };
});

// ---------- 3. relations / mappings / index ----------
var relationsDocOut = { schemaVersion: '1.0.0', subject: 'math', source: 'kbl/root/小学G1-G6数学知识点.xlsx', note: relationsDoc.note || '空集（root 无关系字段）', relations: relationsDoc.relations || [] };
var mappingOut = { schemaVersion: '1.0.0', subject: 'math', source: 'kbl-derived', count: mappings.length, stats: { allow: mappings.filter(function (m) { return m.permission === 'allow'; }).length, forbid: 0, degrade: 0, missing: 0 }, mappings: mappings.map(function (m) { var x = JSON.parse(JSON.stringify(m)); delete x.derivation; return x; }) };

// index
var byId = {}, byGrade = {}, byBook = {}, byUnit = {}, byModule = {}, byFamily = {}, byStatus = {}, byPublication = {};
knowledge.forEach(function (k) {
  var c = capById[k.id];
  var entry = { unitId: k.unitId, name: k.name, status: 'active', publication: 'published', domain: k.domain };
  byId[k.id] = entry;
  (byGrade[k.grade] = byGrade[k.grade] || []).push(k.id);
  (byBook[k.grade + '-' + k.book] = byBook[k.grade + '-' + k.book] || []).push(k.id);
  (byUnit[k.unitId] = byUnit[k.unitId] || []).push(k.id);
  var mod = k.domain; (byModule[mod] = byModule[mod] || []).push(k.id);
  byFamily[familyOf(c) || 'none'] = byFamily[familyOf(c) || 'none'] || []; byFamily[familyOf(c)].push(k.id);
  (byStatus['active'] = byStatus['active'] || []).push(k.id);
  (byPublication['published'] = byPublication['published'] || []).push(k.id);
});
var indexDoc = { schemaVersion: '1.0.0', byId: byId, byGrade: byGrade, byBook: byBook, byUnit: byUnit, byModule: byModule, byFamily: byFamily, byStatus: byStatus, byPublication: byPublication };

// ---------- 写盘 ----------
writeJson(path.join(OUT, 'data/math/curriculum.json'), curriculum);
Object.keys(grades).forEach(function (g) { writeJson(path.join(OUT, 'data/math', g, 'knowledge-points.json'), grades[g]); });
writeJson(path.join(OUT, 'relations/math/relations.json'), relationsDocOut);
writeJson(path.join(OUT, 'mappings/generation-contract/math.json'), mappingOut);
writeJson(path.join(OUT, 'index/index.json'), indexDoc);

var totalKP = Object.keys(grades).reduce(function (n, g) { return n + grades[g].knowledgePoints.length; }, 0);
console.log('[KBL-EMIT] OK  知识:', totalKP, '| 单元:', unitRows.length, '| 册:', books.length, '| 关系:', relationsDocOut.relations.length, '| 映射:', mappings.length);
console.log('输出: kbl/data/math/*, relations, mappings/generation-contract, index');