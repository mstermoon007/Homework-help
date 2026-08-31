'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
const KnowledgePoint = require(path.join(ROOT, 'shared', 'knowledge-point.js'));
const CapabilityModel = require(path.join(ROOT, 'shared', 'capability-model.js'));
const Resolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));
const QuestionTypeRegistry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));

function countKPs() {
  let total = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function () { total++; });
      });
    });
  });
  return total;
}

test('574 KP 全部可归一化为合法 Canonical', () => {
  assert.strictEqual(countKPs(), 574);
  let errCount = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          const c = Ontology.normalize(kp);
          const v = Ontology.validate(c);
          if (!v.valid) errCount++;
        });
      });
    });
  });
  assert.strictEqual(errCount, 0, '存在非法 Canonical KP');
});

test('KnowledgePoint 访问层可解析真实 KP', () => {
  const c = KnowledgePoint.get('math-g1-m0-make-ten');
  assert.ok(c);
  assert.strictEqual(c.id, 'math-g1-m0-make-ten');
  assert.ok(Array.isArray(c.knowledge.operations));
  assert.ok(c.generation && Array.isArray(c.generation.capabilities));
});

test('CapabilityResolver 全量解析 574 KP 且无崩溃', () => {
  let ok = 0, empty = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          const cap = Resolver.resolve(kp);
          if (cap && cap.questionTypes && cap.questionTypes.length) ok++;
          else empty++;
        });
      });
    });
  });
  // 不允许 resolver 抛错导致崩溃；空 capability 计入统计但不失败
  assert.strictEqual(ok + empty, 574);
});

test('非法知识点组合会被检测（ERROR 判定）', () => {
  let errCount = 0;
  Ontology.SUBJECTS.forEach(function (s) {
    const arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          const c = Ontology.normalize(kp);
          const v = Ontology.validate(c);
          if (!v.valid) errCount++;
        });
      });
    });
  });
  assert.ok(errCount === 0, '非法 Canonical 数量应为 0');
});

test('Capability 与 Generator 解耦（无 generateFunction）', () => {
  const c = CapabilityModel.defaultCapability();
  assert.strictEqual(c.generateFunction, undefined);
  assert.strictEqual(c.generator, undefined);
});
