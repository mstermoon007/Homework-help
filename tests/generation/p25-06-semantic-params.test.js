'use strict';

/**
 * tests/generation/p25-06-semantic-params.test.js — GenerationParameters 语义参数链路
 *
 * 冻结 P25-06 本体核心不变量：
 *   1. 14 个语义消费 KP（percent×6 + concept×4 + semantic-relations×4）经
 *      SemanticProfile→QuestionIntent 机械派生出正确 subTopic（Node 环境带
 *      teaching 细族收窄；bundle 降级等价由 dev/p25 审计 A3 守护）。
 *   2. read model 结构完整：schemaVersion/operations/representations/intent/
 *      subTopicEvidence/sources，证据可审计；未知 KP 返回 null（fail-closed）。
 *   3. attachToPlan 是注入唯一通道：返回浅拷贝且不改写入参；retry-loop 的
 *      Object.assign({}, plan) 保留 semanticParams。
 *   4. 消费方 fail-closed：plan.semanticParams 缺失或 subTopic 无 maker 时
 *      percent/concept 生成器返回 []，禁止静默猜测兜底。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

// kpId → 期望 subTopic（与 SUBTOPIC_MAKERS 键一一对应，错一个即语义错配）
const EXPECTED = {
  'math-g6-up-u05-k001': 'percent-of',
  'math-g6-up-u05-k002': 'percent-conversion',
  'math-g6-up-u05-k003': 'percent-discount',
  'math-g6-up-u05-k004': 'percent-interest',
  'math-g6-up-u05-k005': 'percent-target-rate',
  'math-g6-up-u05-k006': 'percent-change',
  'math-g2-down-u03-k003': 'times-concept',
  'math-g3-up-u07-k002': 'angle-concept',
  'math-g3-down-u04-k001': 'area-concept',
  'math-g5-down-u04-k001': 'fraction-meaning',
  'math-g1-down-u06-k002': 'pictorial-additive-relation',
  'math-g2-down-u02-k005': 'periodic-pattern',
  'math-g6-down-u04-k007': 'scale-transform',
  'math-g6-down-u04-k008': 'proportion-application'
};

test('read model 版本与 API 形状', () => {
  assert.equal(SP.SCHEMA_VERSION, 1);
  ['resolve', 'attachToPlan', 'deriveSubTopic', 'readFacts'].forEach(function (fn) {
    assert.equal(typeof SP[fn], 'function');
  });
});

Object.keys(EXPECTED).forEach(function (kpId) {
  test('subTopic 派生：' + kpId + ' → ' + EXPECTED[kpId], () => {
    const p = SP.resolve(kpId, 'calc');
    assert.ok(p, '未知/取不到 KP 时应返回非 null（' + kpId + '）');
    assert.equal(p.schemaVersion, 1);
    assert.equal(p.knowledgePointId, kpId);
    assert.equal(p.questionType, 'calc');
    assert.equal(p.subTopic, EXPECTED[kpId]);
    assert.ok(p.name, 'read model 应带 name');
    assert.ok(p.semanticFamily, '应派生 semanticFamily');
    assert.ok(Array.isArray(p.families) && p.families.length >= 1, 'families 至少含主族');
    assert.ok(Array.isArray(p.operations), 'operations 必须是数组（空数组合法）');
    assert.ok(Array.isArray(p.representations) && p.representations.length >= 1, 'representations 非空');
    // 机械证据链：命中规则 + 命中字段可审计
    assert.ok(p.subTopicEvidence && p.subTopicEvidence.matched, kpId + ' 缺 subTopicEvidence.matched');
    assert.ok(p.subTopicEvidence.rule, '证据需带 rule 名');
    assert.ok(['name', 'concept'].indexOf(p.subTopicEvidence.field) !== -1, '证据 field 须为 name/concept');
    assert.ok(p.sources && p.sources.subTopic === 'mechanical-rule:kbl-name-concept',
      'sources.subTopic 应声明机械规则派生来源');
  });
});

test('同 KP 跨题型 subTopic 稳定（不随 questionType 漂移）', () => {
  ['calc', 'fill', 'apply', 'choice', 'geometry'].forEach(function (qt) {
    const p = SP.resolve('math-g2-down-u02-k005', qt);
    assert.equal(p.subTopic, 'periodic-pattern');
    assert.equal(p.questionType, qt);
  });
});

test('未知 KP fail-closed：返回 null 而非伪造参数', () => {
  assert.equal(SP.resolve('math-g0-down-u99-k999', 'calc'), null);
});

test('attachToPlan：浅拷贝注入、不改写入参', () => {
  const plan = { knowledgePointIds: ['math-g6-up-u05-k003'], questionTypeId: 'calc', difficulty: 2, count: 1 };
  const attached = SP.attachToPlan(plan);
  assert.notEqual(attached, plan);
  assert.equal(plan.semanticParams, undefined, '入参不得被写改');
  assert.ok(attached.semanticParams, '拷贝应挂 semanticParams');
  assert.equal(attached.semanticParams.subTopic, 'percent-discount');
  // 原 plan 其余字段保留
  assert.deepEqual(attached.knowledgePointIds, plan.knowledgePointIds);
  assert.equal(attached.questionTypeId, 'calc');
  assert.equal(attached.count, 1);
});

test('attachToPlan：retry-loop Object.assign 浅拷贝保留 semanticParams', () => {
  const attached = SP.attachToPlan({ knowledgePointIds: ['math-g1-down-u06-k002'], questionTypeId: 'calc' });
  const retryCopy = Object.assign({}, attached); // retry-loop 重建计划的形态
  assert.ok(retryCopy.semanticParams, 'retry 拷贝必须保留语义参数');
  assert.equal(retryCopy.semanticParams.subTopic, 'pictorial-additive-relation');
});

test('消费方 fail-closed：percent 语义参数缺失/子类型无 maker → 返回 []', () => {
  const createPercent = require(path.join(ROOT, 'shared', 'generator', 'generators', 'percent.js')).createPercentGenerator;
  const gen = createPercent();
  // 无 KP 无 semanticParams：不猜测
  assert.deepEqual(gen.generate({ questionTypeId: 'calc', count: 1 }, {}), []);
  // subTopic 无对应 maker：不兜底
  const bogus = SP.attachToPlan({ knowledgePointIds: ['math-g6-up-u05-k001'], questionTypeId: 'calc' });
  bogus.semanticParams = Object.assign({}, bogus.semanticParams, { subTopic: 'no-such-subtopic' });
  assert.deepEqual(gen.generate(bogus, {}), []);
  // 正常参数：产出 1 题且 subType 与语义参数一致
  const ok = gen.generate(SP.attachToPlan({ knowledgePointIds: ['math-g6-up-u05-k001'], questionTypeId: 'calc', count: 1 }), {});
  assert.equal(ok.length, 1);
  assert.equal(ok[0].data.subType, 'percent-of');
});

test('P30-05 权威行挂载 intent 机器约束（confirmed 行，运行时投影路径）', () => {
  const p = SP.resolve('math-g1-up-u03-k001', 'geometry'); // confirmed
  assert.ok(p.intent, 'confirmed 行必须挂载 intent');
  assert.deepEqual(p.intent.targetCodes, ['math-g1-up-u03-k001'], 'targetCodes 溯源本 KP');
  assert.equal(p.intent.focus, 'geometry');
  assert.ok(Array.isArray(p.intent.requiredRelations), 'requiredRelations 为数组');
  assert.ok(Array.isArray(p.intent.requiredConstructs), 'requiredConstructs 为数组');
  assert.deepEqual(p.intent.allowedRepresentations, ['graphic']);
  assert.deepEqual(p.intent.expressionModes, ['graphic-construction']);
  assert.equal(p.intent.graphicRole, 'carrier');
  // P38-DATA-01：运行时投影行仅含机器约束（status+assessment），教学五问文本不进运行时
  assert.equal(p.intent.trainsWhat, undefined, '投影行无五问文本（trainsWhat 不出运行时）');
  assert.deepEqual(p.expression, { modes: ['graphic-construction'] }, 'expression 投影');
  assert.deepEqual(p.graphic, { role: 'carrier' }, 'graphic 投影');
  assert.equal(p.sources.intent, 'teaching:qt-intent-runtime:confirmed');
});

test('P30-05 Node 直连兜底路径挂载五问全文（confirmed 行）', () => {
  // P38-DATA-01：屏蔽 runtime intentFor（模拟无 KBL Runtime 的 Node 工具链环境），
  // getIntent 走 loadTeaching 直连 kbl/teaching/qt-intent.json → 全量行含五问文本。
  const saved = global.App && global.App.KNOWLEDGE;
  global.App.KNOWLEDGE = Object.assign({}, saved, { intentFor: undefined });
  try {
    const p = SP.resolve('math-g1-up-u03-k001', 'geometry');
    assert.ok(p.intent, 'confirmed 行必须挂载 intent');
    assert.equal(p.intent.focus, 'geometry');
    assert.deepEqual(p.intent.allowedRepresentations, ['graphic']);
    assert.equal(p.intent.graphicRole, 'carrier');
    assert.ok(typeof p.intent.trainsWhat === 'string', 'Node 直连全量行五问可读');
    assert.equal(p.sources.intent, 'teaching:qt-intent:confirmed');
  } finally {
    global.App.KNOWLEDGE = saved;
  }
});

test('P30-05 ai-verified 行同样挂载 intent 机器约束（运行时投影路径）', () => {
  const p = SP.resolve('math-g1-up-u01-k002', 'calc'); // ai-verified
  assert.ok(p.intent, 'ai-verified 行必须挂载 intent');
  assert.equal(p.intent.focus, 'calculation');
  assert.deepEqual(p.intent.expressionModes, ['expression']);
  assert.ok(p.intent.requiredConstructs.indexOf('addition') !== -1, '操作构念来自 KBL semantic.operations');
  assert.deepEqual(p.expression, { modes: ['expression'] }, 'expression 投影');
  assert.equal(p.graphic, null, 'graphicRole 为 null 时 graphic 投影为 null');
  assert.equal(p.sources.intent, 'teaching:qt-intent-runtime:ai-verified');
});

test('P38-GEN-03 收口：意图矩阵 needs-review=0，4 行 representation-conflict calc 全部 auxiliary 配图', () => {
  // P38-GEN-01：扩容题型认知区间，283 行 cognitive-out-of-range 升级 ai-verified；
  // P38-GEN-02：2 行 representation-conflict 经人工裁决 confirmed（numeric-only）；
  // P38-GEN-03（用户 2026-10-12 二次裁决）：4 行 calc 均属图形辅助理解算理，账本
  // correctedAssessment 改判 graphicRole=auxiliary / reps 含 graphic，calc 补辅助图。
  const fs = require('node:fs');
  const doc = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'shared', 'knowledge', 'teaching', 'qt-intent-runtime.json'), 'utf8'));
  const dist = {};
  doc.rows.forEach((r) => { dist[r.status] = (dist[r.status] || 0) + 1; });
  assert.equal(dist['needs-review'] || 0, 0, 'P38-GEN 序列后 needs-review 行应为 0：' + JSON.stringify(dist));
  // 4 行 confirmed + auxiliary：机器约束挂载 graphic 投影（驱动 Generator 配图闸门）
  ['math-g1-down-u06-k002', 'math-g2-down-u02-k005',
   'math-g6-down-u04-k007', 'math-g6-down-u04-k008'].forEach((kpId) => {
    const r = doc.rows.find((x) => x.knowledgeId === kpId && x.questionType === 'calc');
    assert.equal(r.status, 'confirmed', kpId + ' 应为人工 confirmed 权威行');
    assert.equal(r.assessment.graphicRole, 'auxiliary', kpId + ' P38-GEN-03 改判 auxiliary');
    assert.deepEqual(r.assessment.allowedRepresentations, ['numeric', 'graphic']);
    const p = SP.resolve(kpId, 'calc');
    assert.equal(p.sources.intent, 'teaching:qt-intent-runtime:confirmed', kpId + ' 运行时权威来源');
    assert.equal(p.graphic && p.graphic.role, 'auxiliary', kpId + ' graphic 投影挂载');
  });
});

test('P30-06 闸门：合成 needs-review 行零生成权威（KC 注入，活矩阵已无 needs-review 行）', () => {
  // P38-GEN-02 后活矩阵 needs-review=0，闸门分支改由合成行经 KC.intentFor 注入验证：
  // needs-review + graphicRole=null（2 行 calc 裁决前的真实形态）→ intent/expression/graphic 全 null。
  const KC = global.KnowledgeContext;
  const orig = KC.intentFor;
  try {
    KC.intentFor = function (kpId, qt) {
      if (kpId === 'math-g6-down-u04-k007' && qt === 'calc') {
        return {
          knowledgeId: kpId, questionType: qt, status: 'needs-review',
          assessment: {
            targetCodes: [kpId], focus: 'calculation', requiredRelations: [],
            requiredConstructs: [], allowedRepresentations: ['numeric'],
            expressionModes: ['expression'], graphicRole: null
          }
        };
      }
      return orig.call(KC, kpId, qt);
    };
    const p = SP.resolve('math-g6-down-u04-k007', 'calc');
    assert.equal(p.intent, null, 'needs-review 的教学意图与机器约束不得进入生成参数');
    assert.equal(p.expression, null, 'needs-review 的 expression 投影为 null');
    assert.equal(p.graphic, null, 'needs-review（gr=null）的 graphic 投影为 null');
    assert.equal(p.sources.intent, 'blocked:qt-intent:needs-review', 'sources 须显式标注被拦状态');
    // subTopic 等 KBL 机械派生不受影响（被拦的是教学意图，不是知识点事实）
    assert.ok(p.subTopic === null || typeof p.subTopic === 'string');
  } finally {
    KC.intentFor = orig;
  }
  // 恢复后回到活矩阵 confirmed 形态（防止桩泄漏污染后续用例）
  const restored = SP.resolve('math-g6-down-u04-k007', 'calc');
  assert.equal(restored.sources.intent, 'teaching:qt-intent-runtime:confirmed');
});

test('P38-07 闸门例外：needs-review + graphicRole 非空 → 图形机器约束挂载、意图文本仍 null', () => {
  const KC = global.KnowledgeContext;
  const orig = KC.intentFor;
  try {
    KC.intentFor = function (kpId, qt) {
      if (kpId === 'math-g6-down-u04-k007' && qt === 'calc') {
        return {
          knowledgeId: kpId, questionType: qt, status: 'needs-review',
          assessment: {
            targetCodes: [kpId], focus: 'calculation', requiredRelations: [],
            requiredConstructs: [], allowedRepresentations: ['numeric', 'graphic'],
            expressionModes: ['expression'], graphicRole: 'auxiliary'
          }
        };
      }
      return orig.call(KC, kpId, qt);
    };
    const p = SP.resolve('math-g6-down-u04-k007', 'calc');
    assert.equal(p.graphic && p.graphic.role, 'auxiliary', 'P38-07：needs-review auxiliary 行图形约束挂载');
    assert.equal(p.intent.graphicRole, 'auxiliary');
    assert.equal(p.sources.intent, 'teaching:qt-intent-runtime:needs-review', '仅机器约束投影，无教学文本');
  } finally {
    KC.intentFor = orig;
  }
});

test('消费方 fail-closed：concept-meaning 子类型无 maker → 返回 []', () => {
  const createConcept = require(path.join(ROOT, 'shared', 'generator', 'generators', 'concept-meaning.js')).createConceptMeaningGenerator;
  const gen = createConcept();
  assert.deepEqual(gen.generate({ questionTypeId: 'calc', count: 1 }, {}), []);
  const bogus = SP.attachToPlan({ knowledgePointIds: ['math-g2-down-u03-k003'], questionTypeId: 'calc' });
  bogus.semanticParams = Object.assign({}, bogus.semanticParams, { subTopic: 'no-such-subtopic' });
  assert.deepEqual(gen.generate(bogus, {}), []);
});
