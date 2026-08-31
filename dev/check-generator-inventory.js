#!/usr/bin/env node
/**
 * dev/check-generator-inventory.js — M4-R04 插件能力盘点（自动扫描 plugins/）
 *
 * 为每个插件提取：
 *   pluginId / subject / knowledgePoints / questionTypes / operations /
 *   difficulty usage / SVG·render usage / random usage / shared utility usage
 *
 * 自动计算：
 *   功能相似度 / 知识点重叠 / 题型重叠 → Generator 候选组
 *
 * 输出：
 *   dev/reports/plugin-capability-inventory.json
 *   dev/reports/generator-migration-map.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var registryMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));

var GROUP_THRESHOLD = 0.7; // 强相似（同 subject 同题型且 KP/操作高度重叠）才进候选组

function jaccard(a, b) {
  var setA = {}, setB = {};
  a.forEach(function (x) { setA[x] = true; });
  b.forEach(function (x) { setB[x] = true; });
  var inter = 0, union = 0;
  var keys = {};
  a.forEach(function (x) { keys[x] = true; });
  b.forEach(function (x) { keys[x] = true; });
  Object.keys(keys).forEach(function (k) {
    union++;
    if (setA[k] && setB[k]) inter++;
  });
  return union === 0 ? 0 : inter / union;
}

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function scanSource(relFile) {
  var usage = { difficulty: false, svg: false, render: false, mathRandom: false, cryptoRandom: false, utilities: [] };
  if (!relFile) return usage;
  var fp = path.join(ROOT, relFile);
  if (!fs.existsSync(fp)) return usage;
  var src = stripComments(fs.readFileSync(fp, 'utf8'));

  usage.difficulty = /\bdifficulty\b|difficultyParams|paramsFor|diffLevel/.test(src);
  usage.svg = /\bSVGUtil\b|\bsvgUtil\b|createSVG|<svg/i.test(src);
  usage.render = /\brender\s*[:=]\s*function|\brender\s*\(/.test(src);
  usage.mathRandom = /\bMath\.random\b/.test(src);
  usage.cryptoRandom = /\brandInt\b|getRandomValues\b/.test(src);

  ['PluginUtil', '_PU', 'SVGUtil', 'ChineseUtil', 'EnglishUtil', 'PrintUtil', 'Layout'].forEach(function (u) {
    if (src.indexOf(u + '.') !== -1 && usage.utilities.indexOf(u) === -1) usage.utilities.push(u);
  });
  return usage;
}

function main() {
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var recById = {};
  genRecords.forEach(function (r) { recById[r.pluginId] = r; });

  // KB canonical 索引（pluginId → operations 并集）
  var opsByPlugin = {};
  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          if (!kp.pluginId) return;
          var canonical = Ontology.normalize(kp);
          var ops = (canonical.knowledge && canonical.knowledge.operations) || [];
          var set = opsByPlugin[kp.pluginId] = opsByPlugin[kp.pluginId] || [];
          ops.forEach(function (op) { if (set.indexOf(op) === -1) set.push(op); });
        });
      });
    });
  });

  var entries = registryMod.readRegistry();
  var inventory = entries.map(function (entry) {
    var rec = recById[entry.id] || null;
    var usage = scanSource(entry.file);
    return {
      pluginId: entry.id,
      subject: entry.subject,
      category: entry.category || null,
      grades: entry.grades || [],
      knowledgePoints: rec ? rec.knowledgePoints : [],
      questionTypes: rec ? rec.questionTypes : [],
      operations: opsByPlugin[entry.id] || [],
      difficultyUsage: usage.difficulty,
      svgUsage: usage.svg,
      renderUsage: usage.render,
      randomUsage: usage.mathRandom ? 'Math.random' : (usage.cryptoRandom ? 'crypto' : 'none'),
      sharedUtilities: usage.utilities,
      file: entry.file || null
    };
  });

  // 功能相似度 / 知识点重叠 / 题型重叠
  var similarity = [];
  for (var i = 0; i < inventory.length; i++) {
    for (var j = i + 1; j < inventory.length; j++) {
      var a = inventory[i], b = inventory[j];
      var kpOverlap = jaccard(a.knowledgePoints, b.knowledgePoints);
      var qtOverlap = jaccard(a.questionTypes, b.questionTypes);
      var opOverlap = jaccard(a.operations, b.operations);
      var subjectMatch = a.subject === b.subject ? 1 : 0;
      var functional = 0.3 * subjectMatch + 0.3 * qtOverlap + 0.2 * kpOverlap + 0.2 * opOverlap;
      similarity.push({
        a: a.pluginId, b: b.pluginId,
        subjectMatch: subjectMatch,
        knowledgePointOverlap: round2(kpOverlap),
        questionTypeOverlap: round2(qtOverlap),
        operationOverlap: round2(opOverlap),
        functionalSimilarity: round2(functional)
      });
    }
  }

  // Generator 候选组（贪心：以组长为中心，仅吸纳与组长相似度达阈值的同 subject 插件）
  var grouped = {};
  var groups = [];
  var simByPair = {};
  similarity.forEach(function (s) { simByPair[s.a + '|' + s.b] = s.functionalSimilarity; });
  function simBetween(a, b) {
    var v = simByPair[a + '|' + b];
    if (v != null) return v;
    return simByPair[b + '|' + a] != null ? simByPair[b + '|' + a] : 0;
  }
  inventory.forEach(function (p) {
    if (grouped[p.pluginId]) return;
    var members = [p.pluginId];
    grouped[p.pluginId] = true;
    inventory.forEach(function (q) {
      if (grouped[q.pluginId] || q.pluginId === p.pluginId) return;
      if (q.subject !== p.subject) return;
      if (simBetween(p.pluginId, q.pluginId) >= GROUP_THRESHOLD) {
        members.push(q.pluginId);
        grouped[q.pluginId] = true;
      }
    });
    var memberData = members.map(function (id) { return inventory.find(function (x) { return x.pluginId === id; }); });
    var allTypes = [];
    memberData.forEach(function (m) { m.questionTypes.forEach(function (t) { if (allTypes.indexOf(t) === -1) allTypes.push(t); }); });
    groups.push({
      groupId: 'group-' + groups.length,
      subject: p.subject,
      members: members,
      memberCount: members.length,
      unionQuestionTypes: allTypes,
      unionKnowledgePoints: memberData.reduce(function (n, m) { return n + m.knowledgePoints.length; }, 0)
    });
  });

  var reportDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  var inventoryOut = {
    version: 1,
    generatedAt: new Date().toISOString(),
    pluginCount: inventory.length,
    plugins: inventory
  };
  fs.writeFileSync(path.join(reportDir, 'plugin-capability-inventory.json'), JSON.stringify(inventoryOut, null, 2));

  var migrationOut = {
    version: 1,
    generatedAt: new Date().toISOString(),
    groupThreshold: GROUP_THRESHOLD,
    generatorCandidateGroups: groups,
    similarityMatrix: similarity
  };
  fs.writeFileSync(path.join(reportDir, 'generator-migration-map.json'), JSON.stringify(migrationOut, null, 2));

  console.log('M4-R04 插件能力盘点');
  console.log('');
  console.log('插件扫描:          ' + inventory.length);
  console.log('有 KP 关联:        ' + inventory.filter(function (p) { return p.knowledgePoints.length > 0; }).length);
  console.log('使用难度参数:      ' + inventory.filter(function (p) { return p.difficultyUsage; }).length);
  console.log('使用 SVG:          ' + inventory.filter(function (p) { return p.svgUsage; }).length);
  console.log('直调 Math.random:  ' + inventory.filter(function (p) { return p.randomUsage === 'Math.random'; }).length);
  console.log('相似度对:          ' + similarity.length);
  console.log('Generator 候选组:  ' + groups.length + '（阈值 ' + GROUP_THRESHOLD + '）');
  groups.filter(function (g) { return g.memberCount >= 3; }).slice(0, 8).forEach(function (g) {
    console.log('  · ' + g.subject + ' [' + g.memberCount + ']: ' + g.members.slice(0, 5).join(', ') + (g.memberCount > 5 ? ' …' : ''));
  });
  console.log('');
  console.log('Inventory -> dev/reports/plugin-capability-inventory.json');
  console.log('Migration -> dev/reports/generator-migration-map.json');

  var ok = inventory.length > 0;
  console.log('');
  console.log(ok ? '[PASS] M4-R04 插件能力盘点' : '[FAIL] M4-R04 插件能力盘点');
  process.exitCode = ok ? 0 : 1;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

main();
