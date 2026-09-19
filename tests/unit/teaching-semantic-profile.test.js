// tests/unit/teaching-semantic-profile.test.js — P25-01 Schema + Read Model 校验
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');

const Schema = require('../../shared/schemas/teaching-semantic-profile.schema.js');
const TSP = require('../../shared/knowledge/runtime/teaching-semantic-profile.js');

// KBL 权威 KP 库（与 runtime 副本逐字节一致；直读 kbl/ 侧以合 kbl-access 门禁）
function loadAllKps() {
  const all = [];
  ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(g => {
    const k = require(path.join('../../kbl/data/math/', g, 'knowledge-points.json'));
    all.push(...k.knowledgePoints);
  });
  return all;
}

test.describe('TeachingSemanticProfile Schema（P25-01）', () => {
  test('核心 13 字段齐备', () => {
    const core = Schema.coreFields();
    ['knowledgePointId', 'concept', 'learningTargets', 'knowledgeRelations', 'operations',
      'representations', 'contexts', 'cognitiveTargets', 'questionIntent', 'variationDimensions',
      'misconceptionTargets', 'prerequisiteKnowledge', 'semanticConstraints'
    ].forEach(f => assert.ok(core.includes(f), '缺少核心字段 ' + f));
    assert.strictEqual(core.length, 13);
  });

  test('合法 profile 通过校验', () => {
    const p = {
      knowledgePointId: 'math-g2-up-u01-k001',
      concept: '分类',
      learningTargets: null,
      knowledgeRelations: null,
      operations: [],
      representations: ['graphic'],
      contexts: null,
      cognitiveTargets: null,
      questionIntent: null,
      variationDimensions: null,
      misconceptionTargets: [],
      prerequisiteKnowledge: null,
      semanticConstraints: null,
      semanticFamily: 'geometry',
      cognitiveLevel: 'recognize',
      difficultyAnchor: { seedDifficulty: 2, maxSteps: 1, numberRange: null },
      sourceStatus: {
        knowledgePointId: 'kbl-derived', concept: 'kbl-derived', learningTargets: 'needs-review',
        knowledgeRelations: 'needs-review', operations: 'kbl-derived', representations: 'kbl-derived',
        contexts: 'needs-review', cognitiveTargets: 'needs-review', questionIntent: 'needs-review',
        variationDimensions: 'needs-review', misconceptionTargets: 'kbl-derived',
        prerequisiteKnowledge: 'needs-review', semanticConstraints: 'needs-review',
        semanticFamily: 'kbl-derived', cognitiveLevel: 'kbl-derived', difficultyAnchor: 'kbl-derived'
      },
      meta: { schemaVersion: 1, kblUnitId: 'math-g2-up-u01', unitName: 'x', grade: 'g2', book: 'up', module: 'geometry' }
    };
    const r = Schema.validateProfile(p);
    assert.strictEqual(r.errors.length, 0, JSON.stringify(r.errors));
    assert.ok(r.valid);
  });

  test('E01 未知字段被拒绝（防第二套 KBL）', () => {
    const r = Schema.validateProfile({ knowledgePointId: 'x', foo: 1 });
    assert.ok(r.errors.some(e => e.code === 'E01' && e.field === 'foo'));
  });

  test('E05 NEEDS_REVIEW 字段携带内容 = 伪造，被拒绝', () => {
    const r = Schema.validateProfile({
      knowledgePointId: 'math-g2-up-u01-k001',
      learningTargets: ['瞎猜的目标'],
      sourceStatus: { learningTargets: 'needs-review' },
      meta: {}
    });
    assert.ok(r.errors.some(e => e.code === 'E05' && e.field === 'learningTargets'));
  });

  test('E07 CONFIRMED 字段为空被拒绝', () => {
    const r = Schema.validateProfile({
      knowledgePointId: 'math-g2-up-u01-k001',
      learningTargets: null,
      sourceStatus: { learningTargets: 'confirmed' },
      meta: {}
    });
    assert.ok(r.errors.some(e => e.code === 'E07' && e.field === 'learningTargets'));
  });
});

test.describe('Read Model：KBL → TeachingSemanticProfile 投影', () => {
  const kps = loadAllKps();
  const byId = new Map(kps.map(k => [k.knowledgeId, k]));

  test('KBL 已有字段被投影为 kbl-derived 事实', () => {
    const kp = byId.get('math-g2-up-u01-k001');
    assert.ok(kp, 'fixture KP 必须存在');
    const p = TSP.deriveTeachingProfile(kp);
    assert.strictEqual(p.knowledgePointId, 'math-g2-up-u01-k001');
    assert.strictEqual(p.concept, kp.semantic.concept);
    assert.deepStrictEqual(p.operations, kp.semantic.operations);
    assert.deepStrictEqual(p.representations, kp.semantic.representations);
    assert.deepStrictEqual(p.misconceptionTargets, kp.assessment.errors);
    assert.strictEqual(p.semanticFamily, kp.semantic.family);
    assert.strictEqual(p.cognitiveLevel, kp.difficultyAnnotation.cognitiveLevel);
    assert.strictEqual(p.sourceStatus.concept, 'kbl-derived');
  });

  test('KBL 尚无字段显式 NEEDS_REVIEW 且值为空（红线：不猜测）', () => {
    const p = TSP.deriveTeachingProfile(byId.get('math-g2-up-u01-k001'));
    ['learningTargets', 'knowledgeRelations', 'cognitiveTargets', 'questionIntent',
      'variationDimensions', 'prerequisiteKnowledge', 'semanticConstraints'
    ].forEach(f => {
      assert.strictEqual(p[f], null, f + ' 必须为 null');
      assert.strictEqual(p.sourceStatus[f], 'needs-review', f + ' 必须标记 needs-review');
    });
  });

  test('全量 375 KP 投影全部通过 Schema 校验', () => {
    assert.strictEqual(kps.length, 375);
    kps.forEach(kp => {
      const r = Schema.validateProfile(TSP.deriveTeachingProfile(kp));
      assert.ok(r.valid, kp.knowledgeId + ' 校验失败: ' + JSON.stringify(r.errors));
    });
  });

  test('resolver：DI 取用 + 缓存 + 未知 KP 返回 null', () => {
    const resolver = TSP.createTeachingProfileResolver({ getKp: id => byId.get(id) || null });
    const a = resolver.get('math-g6-up-u05-k001');
    assert.ok(a && a.semanticFamily);
    assert.strictEqual(resolver.get('math-g6-up-u05-k001'), a, '应命中缓存');
    assert.strictEqual(resolver.get('math-g1-up-u99-k999'), null);
  });
});
