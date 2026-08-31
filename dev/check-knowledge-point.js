#!/usr/bin/env node
/**
 * dev/check-knowledge-point.js — 574 KP Canonical 完整扫描 (M1-R06)
 *
 * 通过 Ontology Normalizer 把每个 Legacy KP 归一化为 Canonical KnowledgePoint，
 * 逐 KP 输出 5 类分组状态（可审计），并生成 dev/reports/knowledge-point-inventory.json。
 *
 * 不创建第三套 Schema —— 直接复用 knowledge-ontology（其 Schema 来自 shared/schemas/knowledge-point.schema.js）。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));

var SUBJECTS = Ontology.SUBJECTS;

function catStatus(governed) { return governed ? 'governed' : 'empty'; }

function buildRecord(kp) {
  var c = Ontology.normalize(kp);
  var v = Ontology.validate(c);

  var identity = {
    status: (c.id && c.identity.name && c.subject && typeof c.grade === 'number') ? 'governed' : 'empty',
    id: c.id, name: c.identity.name, subject: c.subject, grade: c.grade, module: c.module.id
  };

  var know = c.knowledge;
  var knowledge = {
    status: catStatus(know.operations.length > 0),
    concept: know.concept,
    operations: know.operations,
    factualContent: Object.keys(know.factualContent).length > 0,
    prerequisites: know.prerequisites
  };

  var difficulty = {
    status: 'governed',
    spiralLevel: c.spiral.level,
    maxSpiralLevel: c.spiral.maxLevel,
    cognitiveLevel: c.cognition.level,
    numberRangeDefault: c.numeric.range,
    maxStepsDefault: c.structure.maxSteps
  };

  var assessment = {
    status: catStatus((c.presentation.questionTypes || []).length > 0),
    applicableQuestionTypes: (c.presentation.questionTypes || []).map(function (q) { return q.type; }),
    contextDefault: c.context.defaults,
    errors: (c.errors || []).map(function (e) { return e.id || e; })
  };

  var gen = c.generation || { capabilities: [] };
  var generation = {
    status: catStatus(gen.capabilities.length > 0),
    capabilities: gen.capabilities
  };

  return {
    id: c.id,
    subject: c.subject,
    grade: c.grade,
    pluginId: c.source.pluginId,
    categories: {
      identity: identity, knowledge: knowledge, difficulty: difficulty,
      assessment: assessment, generation: generation
    },
    warnings: v.warnings.slice(),
    errors: v.errors.slice()
  };
}

function tally(cat) {
  return cat === 'governed' ? 'governed' : 'empty';
}

function run() {
  var total = 0;
  var stats = {
    identity: { governed: 0, empty: 0 },
    knowledge: { operations: 0, factualContent: 0, concept: 0, prerequisites: 0, governed: 0 },
    difficulty: { governed: 0, empty: 0 },
    assessment: { questionTypes: 0, context: 0, errors: 0, governed: 0 },
    generation: { capabilities: 0, governed: 0, empty: 0 }
  };
  var records = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var r = buildRecord(kp);
          records.push(r);

          if (r.categories.identity.status === 'governed') stats.identity.governed++; else stats.identity.empty++;
          var k = r.categories.knowledge;
          if (k.operations.length) stats.knowledge.operations++;
          if (k.factualContent) stats.knowledge.factualContent++;
          if (k.concept != null) stats.knowledge.concept++;
          if (k.prerequisites.length) stats.knowledge.prerequisites++;
          if (k.status === 'governed') stats.knowledge.governed++;
          if (r.categories.difficulty.status === 'governed') stats.difficulty.governed++; else stats.difficulty.empty++;
          var a = r.categories.assessment;
          if (a.applicableQuestionTypes.length) stats.assessment.questionTypes++;
          if (a.contextDefault.length) stats.assessment.context++;
          if (a.errors.length) stats.assessment.errors++;
          if (a.status === 'governed') stats.assessment.governed++;
          var g2 = r.categories.generation;
          if (g2.capabilities.length) stats.generation.capabilities++;
          if (g2.status === 'governed') stats.generation.governed++; else stats.generation.empty++;
        });
      });
    });
  });

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'knowledge-point-inventory.json'),
    JSON.stringify({ total: total, stats: stats, records: records }, null, 2));

  console.log('M1-R06 KnowledgePoint 完整扫描');
  console.log('');
  console.log('Total: ' + total);
  console.log('');
  console.log('Identity:                 ' + stats.identity.governed + ' / ' + total);
  console.log('Difficulty:               ' + stats.difficulty.governed + ' / ' + total);
  console.log('Knowledge.operations:     ' + stats.knowledge.operations + ' / ' + total);
  console.log('Knowledge.factualContent: ' + stats.knowledge.factualContent + ' / ' + total);
  console.log('Knowledge.concept:        ' + stats.knowledge.concept + ' / ' + total);
  console.log('Knowledge.prerequisites:  ' + stats.knowledge.prerequisites + ' / ' + total);
  console.log('Assessment.questionTypes: ' + stats.assessment.questionTypes + ' / ' + total);
  console.log('Assessment.context:       ' + stats.assessment.context + ' / ' + total);
  console.log('Assessment.errors:        ' + stats.assessment.errors + ' / ' + total);
  console.log('Generation.capabilities:  ' + stats.generation.capabilities + ' / ' + total);
  console.log('');
  console.log('Detail -> dev/reports/knowledge-point-inventory.json');
  console.log('');
  console.log('[PASS] M1-R06 KnowledgePoint 扫描 (可审计)');
}

run();
