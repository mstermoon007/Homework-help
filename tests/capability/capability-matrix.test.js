'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');
const Matrix = require(path.join(ROOT, 'shared', 'capability-matrix.js'));
const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));

test('matrix 输出包含全部标准题型', () => {
  const mx = Matrix.buildMatrix({ id: 'math-g1-m0-make-ten' });
  Registry.all().forEach(t => {
    assert.ok(mx.questionTypes[t.id], '缺少题型 ' + t.id);
  });
});

test('已知 KP 的 allowed 题型全部判定为 ALLOW', () => {
  const mx = Matrix.buildMatrix({ id: 'math-g1-m0-make-ten' });
  mx.allowed.forEach(id => {
    assert.strictEqual(mx.questionTypes[id].decision, 'ALLOW', id + ' 应 ALLOW');
  });
});

test('未知题型 ID 一律 FORBID', () => {
  const mx = Matrix.buildMatrix({ id: 'x' });
  assert.strictEqual(Matrix.decisionFor(new Set(), '__not_a_type__'), 'FORBID');
});

test('空能力集 → MISSING', () => {
  assert.strictEqual(Matrix.decisionFor(new Set(), 'calc'), 'MISSING');
});

test('574 KP 每个都有 ≥1 ALLOW 且无 MISSING', () => {
  let noAllow = 0, missing = 0;
  Ontology.SUBJECTS.forEach(s => {
    (KnowledgeBank[s] || []).forEach(g => {
      (g.modules || []).forEach(m => {
        (m.knowledgePoints || []).forEach(kp => {
          const mx = Matrix.buildMatrix(Ontology.normalize(kp));
          const hasAllow = Object.keys(mx.questionTypes).some(qt => mx.questionTypes[qt].decision === 'ALLOW');
          if (!hasAllow) noAllow++;
          Object.keys(mx.questionTypes).forEach(qt => {
            if (mx.questionTypes[qt].decision === 'MISSING') missing++;
          });
        });
      });
    });
  });
  assert.strictEqual(noAllow, 0);
  assert.strictEqual(missing, 0);
});

test('Matrix 不携带任何 Generator 逻辑', () => {
  const mx = Matrix.buildMatrix({ id: 'math-g1-m0-make-ten' });
  assert.strictEqual(mx.generateFunction, undefined);
  assert.strictEqual(mx.generator, undefined);
  assert.strictEqual(mx.plugin, undefined);
});
