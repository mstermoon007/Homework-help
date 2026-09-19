/**
 * shared/capability/capability-resolver.js — Capability 解析器 (M2-05 / M2-R06)
 *
 * 将 KnowledgePoint 归一化为 CapabilityModel，并提供最终能力决策。
 *
 * API
 * -----
 * resolve(kp)                  -> CapabilityModel（M2-05，能力模型）
 * resolveFinal({knowledgePointId, questionType}) -> 最终能力状态（M2-R06）
 * canGenerate(kpId, qtId)      -> boolean
 * matrix(kp)                   -> { supported: [...], unsupported: [...] }
 *
 * 最终决策优先级（R06.2）：
 *   INVALID → FORBID → MISSING → ALLOW → DEGRADE
 * 其中 DEGRADE 绝不自动升级为 ALLOW。
 *
 * 决策来源（R06.3，MATH-14 后为三源）：
 *   knowledgePoint : ontology
 *   questionType   : registry
 *   matrix         : R04 capability-matrix
 */
'use strict';

var Ontology = require('../knowledge/knowledge-ontology.js');
var Registry = require('../knowledge/question-type-registry.js');
var KnowledgePoint = require('../knowledge/knowledge-point.js');
var CapabilityModel = require('./capability-model.js');
var Matrix = require('./capability-matrix.js');

// P25-06 教学裁决覆盖层（teaching denials）。
// canonical 粗派生给 ALLOW、但教学层否认当前运行时执行的 KP×QT（execution-gap：
// 无原生语义生成器、兜底产出语义无关题）。裁决理由/证据/批次 SSOT 在
// kbl/teaching/teaching-denials.json；此处仅以 KP ID 引用承载运行时执行——
// 必须双环境（Node/浏览器 bundle）一致生效，故内联 ID 引用而非计算路径 require JSON；
// 不内嵌 canonical 数据载荷，符合 check-kbl-uniqueness（同 generator-registry 的 knowledgePoints 先例）。
// tests/generator/p25-06 断言本表（ACTIVE）与 teaching-denials.json（status!=revoked）集合一致，防漂移。
//
// P25-06 本体：首批 4 条（g1-down-u06-k002 / g2-down-u02-k005 / g6-down-u04-k007 /
// g6-down-u04-k008 × calc）已随 generator:semantic-relations 参数化族生成器补齐而全部撤销
// （账本保留 revoked 留痕，runtime 有效能力恢复 1570）。当前 ACTIVE 集合为空；
// 机制保留：未来若再出现 execution-gap，在此登记新表并在账本记一条非 revoked 行。
var TEACHING_DENIALS = {};

function isTeachingDenied(kpId, qtId) {
  return !!kpId && !!qtId &&
    Object.prototype.hasOwnProperty.call(TEACHING_DENIALS, kpId + '|' + qtId);
}

function listTeachingDenials() {
  return Object.keys(TEACHING_DENIALS).map(function (key) {
    var parts = key.split('|');
    return { knowledgeId: parts[0], questionType: parts[1], batch: TEACHING_DENIALS[key] };
  });
}

function resolve(kp) {
  // canonicalKp 已经是 Canonical KP，直接从 presentation.questionTypes 和 generation.capabilities 推导
  // 防御：传入 raw legacy KP 时（gate / KB.getCapabilities / 浏览器深链）先归一化，保证能力来源一致
  if (kp && !kp.presentation && (kp.applicable_question_types || kp.grade || kp.modules)) {
    try { kp = Ontology.normalize(kp); } catch (e) { /* 保持原样，由 resolveCapability 兜底空结果 */ }
  }
  return CapabilityModel.resolveCapability(kp);
}

function canGenerate(kpId, qtId) {
  var r = resolveFinal({ knowledgePointId: kpId, questionType: qtId });
  return r.decision === 'ALLOW';
}

function resolveFinal(input) {
  var kpId = input && input.knowledgePointId;
  var qtId = input && input.questionType;

  // 1) 未知题型 -> INVALID
  var qt = Registry.get(qtId);
  if (!qt) {
    return { knowledgePointId: kpId, questionType: qtId, capability: null, decision: 'INVALID', source: { questionType: 'registry' }, confidence: 'none' };
  }

  // 2) 未知知识点 -> INVALID
  var kp = KnowledgePoint.get(kpId);
  if (!kp) {
    return { knowledgePointId: kpId, questionType: qtId, capability: qt.category, decision: 'INVALID', source: { knowledgePoint: 'ontology' }, confidence: 'none' };
  }

  // 3) 构建 R04 矩阵决策
  // MATH-14：plugin 决策源（generator-capability-registry）随 legacy 插件轨道一并删除，
  // 最终能力由 ontology/registry/matrix 三源决策。
  var mx = Matrix.buildMatrix(kp);
  var cell = mx.questionTypes[qtId];
  var matrixDecision = cell ? cell.decision : 'FORBID';

  var decision;
  if (matrixDecision === 'MISSING') decision = 'MISSING';
  else if (matrixDecision === 'FORBID') decision = 'FORBID';
  else if (matrixDecision === 'ALLOW') decision = 'ALLOW';
  else decision = 'DEGRADE'; // 不自动升级

  // P25-06 教学裁决覆盖：R04 矩阵 ALLOW/DEGRADE 但被教学层 deny（execution-gap）
  // → FORBID，source.teachingDenial 标记批次（buildEligibility 自然归入 skip）。
  var teachingDenial = null;
  if ((decision === 'ALLOW' || decision === 'DEGRADE') && isTeachingDenied(kpId, qtId)) {
    teachingDenial = 'P25-06';
    decision = 'FORBID';
  }

  var confidence = 'declared';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';
  else if (decision === 'MISSING') confidence = 'unknown';
  if (teachingDenial) confidence = 'teaching-denied';

  return {
    knowledgePointId: kpId,
    questionType: qtId,
    capability: qt.category,
    decision: decision,
    source: {
      knowledgePoint: 'ontology',
      questionType: 'registry',
      matrix: 'R04',
      teachingDenial: teachingDenial
    },
    confidence: confidence
  };
}

function matrix(kp) {
  var canonical = Ontology.normalize(kp);
  var supported = [];
  var unsupported = [];

  (canonical.presentation.questionTypes || []).forEach(function (q) {
    if (!q || !q.type) return;
    var std = Registry.normalizeQuestionType(q.type);
    if (std.id) {
      if (supported.indexOf(std.id) === -1) supported.push(std.id);
    } else {
      unsupported.push(q.type);
    }
  });

  (canonical.generation.capabilities || []).forEach(function (cap) {
    if (cap && cap.id && Registry.has(cap.id) && supported.indexOf(cap.id) === -1) supported.push(cap.id);
  });

  return { supported: supported, unsupported: unsupported };
}

function getCapabilities(kp) {
  // 获取指定 KP 的能力描述：{ questionTypes, cognitiveLevels, difficultyRange }
  var cap = resolve(kp);
  // resolveCapability 产出的 cap.knowledgePointId 依赖 canonicalKp.id（部分数据源以
  // knowledgeId/knowledgePointId 为标识，该字段可能为空），故从入参多态取真实 KP ID。
  var kpId = (typeof kp === 'string') ? kp
    : (kp && (kp.id || kp.knowledgePointId || kp.knowledgeId)) || cap.knowledgePointId || '';
  // P25-06：与 resolveFinal 同一教学裁决覆盖，被 deny 的题型不进入能力列表
  //（strategy Step3 selectQuestionType 经此取题型，保证两处决策一致）。
  var liveTypes = cap.questionTypes.filter(function (q) {
    return !isTeachingDenied(kpId, q.id);
  });
  var questionTypes = liveTypes.map(function (q) { return q.id; });
  var cognitiveLevels = {};
  var difficultyRange = {};
  liveTypes.forEach(function (q) {
    cognitiveLevels[q.id] = q.cognitiveLevels;
    difficultyRange[q.id] = q.difficultyRange;
  });
  return {
    questionTypes: questionTypes,
    cognitiveLevels: cognitiveLevels,
    difficultyRange: difficultyRange
  };
}

module.exports = {
  resolve: resolve,
  resolveFinal: resolveFinal,
  canGenerate: canGenerate,
  matrix: matrix,
  getCapabilities: getCapabilities,
  isTeachingDenied: isTeachingDenied,
  listTeachingDenials: listTeachingDenials
};
