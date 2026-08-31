#!/usr/bin/env node
/**
 * dev/check-generator-clusters.js — M4-R05 插件聚类（按生成能力，非插件名称）
 *
 * 候选类别：
 *   Arithmetic: addition / subtraction / multiplication / division
 *   ArithmeticStructure: vertical / multi-step / bracket
 *   WordProblem: quantity / comparison / change / relation
 *   Geometry: shape / measurement / graphic
 *   Chinese: pinyin / character / vocabulary / sentence
 *   English: vocabulary / spelling / sentence
 *
 * 每个插件标记迁移归属：merge / keep / adapter-only / deprecated
 * 输出 dev/reports/generator-clusters.json
 * Gate：每个插件必须有明确迁移归属。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var registryMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));

var TAXONOMY = {
  'Arithmetic': ['addition', 'subtraction', 'multiplication', 'division'],
  'ArithmeticStructure': ['vertical', 'multi-step', 'bracket'],
  'WordProblem': ['quantity', 'comparison', 'change', 'relation'],
  'Geometry': ['shape', 'measurement', 'graphic'],
  'Chinese': ['pinyin', 'character', 'vocabulary', 'sentence'],
  'English': ['vocabulary', 'spelling', 'sentence']
};

// 分类信号：操作 → 类别
var OP_CATEGORY = {
  add: { category: 'Arithmetic', sub: 'addition' },
  addition: { category: 'Arithmetic', sub: 'addition' },
  subtract: { category: 'Arithmetic', sub: 'subtraction' },
  subtraction: { category: 'Arithmetic', sub: 'subtraction' },
  multiply: { category: 'Arithmetic', sub: 'multiplication' },
  multiplication: { category: 'Arithmetic', sub: 'multiplication' },
  divide: { category: 'Arithmetic', sub: 'division' },
  division: { category: 'Arithmetic', sub: 'division' }
};

function classify(plugin) {
  var subject = plugin.subject;
  var ops = plugin.operations || [];
  var types = plugin.questionTypes || [];
  var id = plugin.pluginId;

  // Chinese
  if (subject === 'chinese' || subject === 'cn') {
    var cSub = 'vocabulary';
    if (/pinyin/.test(id)) cSub = 'pinyin';
    else if (/hanzi|character/.test(id)) cSub = 'character';
    else if (/comprehensive|sentence/.test(id)) cSub = 'sentence';
    return { category: 'Chinese', sub: cSub, reason: 'subject + plugin id 信号' };
  }

  // English
  if (subject === 'english' || subject === 'en') {
    var eSub = 'vocabulary';
    if (/spelling/.test(id)) eSub = 'spelling';
    else if (/alphabet|letter/.test(id)) eSub = 'sentence';
    return { category: 'English', sub: eSub, reason: 'subject + plugin id 信号' };
  }

  // Geometry：题型或 id 信号
  if (types.indexOf('geometry') !== -1 || /geometry|shape|area|solid|clock|angle/.test(id)) {
    var gSub = 'shape';
    if (/area|measure|unit|convert/.test(id)) gSub = 'measurement';
    else if (/draw|picture|graphic/.test(id)) gSub = 'graphic';
    return { category: 'Geometry', sub: gSub, reason: '题型/命名含几何信号' };
  }

  // WordProblem：题型 apply 或命名信号
  if (types.indexOf('apply') !== -1 || /word|problem|application/.test(id)) {
    var wSub = 'quantity';
    if (/comparison|compare/.test(id)) wSub = 'comparison';
    else if (/change|increase|decrease/.test(id)) wSub = 'change';
    else if (/relation|match/.test(id)) wSub = 'relation';
    return { category: 'WordProblem', sub: wSub, reason: '题型 apply / 命名信号' };
  }

  // ArithmeticStructure：命名信号（vertical/chain/bracket）
  if (/vertical|column/.test(id)) return { category: 'ArithmeticStructure', sub: 'vertical', reason: '竖式信号' };
  if (/chain|multi-step|two-step/.test(id)) return { category: 'ArithmeticStructure', sub: 'multi-step', reason: '多步信号' };
  if (/bracket/.test(id)) return { category: 'ArithmeticStructure', sub: 'bracket', reason: '括号信号' };

  // Arithmetic：按操作
  for (var i = 0; i < ops.length; i++) {
    if (OP_CATEGORY[ops[i]]) return OP_CATEGORY[ops[i]];
  }
  if (/oral|make-ten|mul|div|add|sub/.test(id)) return { category: 'Arithmetic', sub: 'addition', reason: '命名算术信号（默认 addition）' };

  return { category: null, sub: null, reason: '无明确生成能力信号' };
}

function assignMark(plugin, cls) {
  var rec = plugin.record || {};
  if (rec.isPlaceholder) return 'deprecated';
  if (!plugin.knowledgePoints || plugin.knowledgePoints.length === 0) return 'adapter-only';
  if (/comprehensive/.test(plugin.pluginId)) return 'adapter-only'; // 聚合插件保留 adapter
  if (!cls.category) return 'keep'; // 无明确聚类信号 → 保留独立 Generator
  return 'merge';
}

function main() {
  var genRecords = GenCap.buildGeneratorCapabilityRegistry();
  var recById = {};
  genRecords.forEach(function (r) { recById[r.pluginId] = r; });

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
  var clusters = {};
  var assignments = [];
  var missingMarks = [];

  entries.forEach(function (entry) {
    var rec = recById[entry.id] || {};
    var plugin = {
      pluginId: entry.id,
      subject: entry.subject,
      knowledgePoints: rec.knowledgePoints || [],
      questionTypes: rec.questionTypes || [],
      operations: opsByPlugin[entry.id] || [],
      record: rec
    };
    var cls = classify(plugin);
    var mark = assignMark(plugin, cls);

    if (!mark) missingMarks.push(entry.id);

    var key = cls.category ? (cls.category + '/' + cls.sub) : (mark + '/' + plugin.subject);
    clusters[key] = clusters[key] || { category: cls.category || '(独立保留)', sub: cls.sub || '-', mark: mark, members: [] };
    if (clusters[key].members.indexOf(entry.id) === -1) clusters[key].members.push(entry.id);

    assignments.push({
      pluginId: entry.id,
      subject: entry.subject,
      category: cls.category,
      subcategory: cls.sub,
      mark: mark,
      reason: cls.reason
    });
  });

  var markCount = { merge: 0, keep: 0, 'adapter-only': 0, deprecated: 0 };
  assignments.forEach(function (a) { markCount[a.mark] = (markCount[a.mark] || 0) + 1; });

  var report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    taxonomy: TAXONOMY,
    markCounts: markCount,
    clusters: clusters,
    assignments: assignments
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'generator-clusters.json'), JSON.stringify(report, null, 2));

  console.log('M4-R05 插件聚类（按生成能力）');
  console.log('');
  console.log('插件总数:    ' + assignments.length);
  console.log('merge:       ' + markCount.merge);
  console.log('keep:        ' + markCount.keep);
  console.log('adapter-only:' + markCount['adapter-only']);
  console.log('deprecated:  ' + markCount.deprecated);
  console.log('');
  Object.keys(clusters).sort().forEach(function (k) {
    var c = clusters[k];
    console.log('  ' + k + ' [' + c.members.length + ']: ' + c.members.slice(0, 4).join(', ') + (c.members.length > 4 ? ' …' : ''));
  });
  console.log('');
  console.log('Clusters -> dev/reports/generator-clusters.json');

  var ok = missingMarks.length === 0 && assignments.length > 0;
  if (missingMarks.length) {
    console.log('');
    console.log('无归属插件: ' + missingMarks.join(', '));
  }
  console.log('');
  console.log(ok ? '[PASS] M4-R05 插件聚类 Gate（每插件均有明确迁移归属）' : '[FAIL] M4-R05 插件聚类 Gate');
  process.exitCode = ok ? 0 : 1;
}

main();
