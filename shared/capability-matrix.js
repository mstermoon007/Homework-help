/**
 * shared/capability-matrix.js — KnowledgePoint × QuestionType × Capability Matrix (M2-R04)
 *
 * 建立 574 KP × 标准题型 的三维能力关系，并给出明确决策规则：
 *
 *   ALLOW    ：该题型属于该 KP 的解析能力集 → 可生成
 *   FORBID   ：该题型不在能力集，且与能力集存在语义冲突（如 geometry 与纯口算）→ 明确禁止
 *   MISSING  ：该 KP 未解析出任何能力（数据缺失）→ 需人工补数据
 *   DEGRADE  ：该 KP 能力集存在但题型覆盖稀疏 → 标记待核查
 *
 * 纯数据计算，不调用任何 Generator，不修改插件/KB/practice.html。
 */
'use strict';

var Registry = require('./question-type-registry.js');

// 语义冲突规则：某些标准题型与该题型类型互斥。
// 依据 Registry.category：calculation / written / selection / application / open / geometry / recognition
var CONFLICT_CATEGORIES = {
  geometry: ['geometry'],
  oral: ['calculation'],
  calc: ['calculation'],
  recognize: ['recognition']
};

function decisionFor(capSet, qtId) {
  // capSet: 解析出的能力 id 集合
  var qt = Registry.get(qtId);
  if (!qt) return 'FORBID'; // 未知题型一律禁止

  if (capSet.has(qtId)) return 'ALLOW';

  // 能力集为空 → 数据缺失，无法判定 → MISSING
  if (capSet.size === 0) return 'MISSING';

  // 语义冲突：能力集中存在与该题型 category 互斥的题型 → FORBID
  var conflictCats = CONFLICT_CATEGORIES[qtId];
  if (conflictCats) {
    var catHasConflict = false;
    capSet.forEach(function (id) {
      var t = Registry.get(id);
      if (t && conflictCats.indexOf(t.category) !== -1) catHasConflict = true;
    });
    if (catHasConflict) return 'FORBID';
  }

  return 'DEGRADE';
}

function buildMatrix(kp, cap) {
  // 允许外部注入已解析的 capability（避免 capability-resolver <-> capability-matrix 循环依赖）
  if (!cap) {
    var CapabilityModel = require('./capability-model.js');
    cap = CapabilityModel.resolveCapability(kp);
  }
  var capSet = new Set(cap.questionTypes.map(function (q) { return q.id; }));

  var questionTypes = {};
  Registry.all().forEach(function (qt) {
    var decision = decisionFor(capSet, qt.id);
    questionTypes[qt.id] = {
      supported: decision === 'ALLOW',
      decision: decision,
      capability: qt.category
    };
  });

  return {
    knowledgePointId: kp.id,
    subject: kp.subject || null,
    grade: kp.grade || null,
    allowed: cap.questionTypes.map(function (q) { return q.id; }),
    questionTypes: questionTypes,
    status: capSet.size === 0 ? 'MISSING' : 'RESOLVED'
  };
}

module.exports = {
  decisionFor: decisionFor,
  buildMatrix: buildMatrix,
  CONFLICT_CATEGORIES: CONFLICT_CATEGORIES
};
