/**
 * shared/capability-resolver.js — Capability 解析器 (M2-05 / M2-R06)
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
 * 决策来源（R06.3）：
 *   knowledgePoint : ontology
 *   questionType   : registry
 *   plugin         : generator-capability-registry（declared/inferred）
 *   matrix         : R04 capability-matrix
 */
'use strict';

var Ontology = require('./knowledge-ontology.js');
var Registry = require('./question-type-registry.js');
var KnowledgePoint = require('./knowledge-point.js');
var CapabilityModel = require('./capability-model.js');
var Matrix = require('./capability-matrix.js');
var GenCap = require('./generator-capability-registry.js');

function resolve(canonicalKp) {
  // canonicalKp 已经是 Canonical KP，直接从 presentation.questionTypes 和 generation.capabilities 推导
  return CapabilityModel.resolveCapability(canonicalKp);
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
  var mx = Matrix.buildMatrix(kp);
  var cell = mx.questionTypes[qtId];
  var matrixDecision = cell ? cell.decision : 'FORBID';

  // 4) Plugin 能力（generator capability registry）
  var pluginRec = null;
  var allGen = GenCap.buildGeneratorCapabilityRegistry();
  for (var i = 0; i < allGen.length; i++) {
    if (allGen[i].pluginId === kp.pluginId) { pluginRec = allGen[i]; break; }
  }
  var pluginHas = pluginRec ? pluginRec.questionTypes.indexOf(qtId) !== -1 : null;

  var decision;
  if (matrixDecision === 'MISSING') decision = 'MISSING';
  else if (matrixDecision === 'FORBID') decision = 'FORBID';
  else if (matrixDecision === 'ALLOW') decision = 'ALLOW';
  else decision = 'DEGRADE'; // 不自动升级

  // 若 plugin 明确缺失该能力但 matrix ALLOW，降级为 DEGRADE（声明不足，不伪造）
  if (decision === 'ALLOW' && pluginHas === false) decision = 'DEGRADE';

  var confidence = 'declared';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';
  else if (decision === 'MISSING') confidence = 'unknown';

  return {
    knowledgePointId: kpId,
    questionType: qtId,
    capability: qt.category,
    decision: decision,
    source: {
      knowledgePoint: 'ontology',
      questionType: 'registry',
      plugin: pluginRec ? 'declared' : 'none',
      matrix: 'R04'
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
  var questionTypes = cap.questionTypes.map(function (q) { return q.id; });
  var cognitiveLevels = {};
  var difficultyRange = {};
  cap.questionTypes.forEach(function (q) {
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
  getCapabilities: getCapabilities
};
