/**
 * shared/generator/generator-registry.js — M4-R03 Generator Registry
 *
 * 只读、纯数据的 Generator 注册表。仅保存声明：
 *   Generator ID / subject / capabilities / supported question types /
 *   supported knowledge points / version
 *
 * 禁止保存执行函数源码（运行时 Gate 校验：所有记录必须 JSON 可序列化）。
 *
 * 查询关系（KnowledgePoint → Capability → Generator）：
 *   forKnowledgePoint(kpId)     → 服务该 KP 的 Generator 列表
 *   forQuestionType(qtId)       → 具备该题型的 Generator 列表
 *   resolveChain(kpId)          → { kp, capabilityQuestionTypes, generators }
 */
'use strict';

var GenCap = require('../generator-capability-registry.js');

// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
var CORE_RECORDS = [
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec', 'math-g4-m3-g4-mix-addlaw'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-addsub-100', 'math-g1-m1-carry-add-20', 'math-g1-m1-retreat-sub-20', 'math-g1-m1-two-digit-add', 'math-g2-m1-addsub-1000', 'math-g4-m1-g4-oral-big', 'math-g4-m1-g4-oral-dec'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g2-m1-mult-table', 'math-g2-m2-mult-col', 'math-g2-m4-multiplication-meaning', 'math-g2-m7-pic-mult', 'math-g2-m8-mult-total', 'math-g2-m5-match-multdiv', 'math-g3-m1-g3-mul-multi1', 'math-g4-m1-g4-oral-mul3x1', 'math-g4-m1-g4-oral-mul2t', 'math-g4-m1-g4-oral-law', 'math-g4-m3-g4-mix-mullaw', 'math-g5-m1-g5-oral-decmul', 'math-g6-c1-vertical-multidigit', 'math-g6-c3-multiplication-principle'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: ['math-g1-m13-division-table', 'math-g2-m1-div-table', 'math-g2-m1-muldiv-relation', 'math-g2-m2-div-col', 'math-g2-m4-division-meaning', 'math-g2-m7-pic-div', 'math-g2-m7-pic-div-include', 'math-g2-m8-div-partitive', 'math-g2-m8-div-quotative', 'math-g3-m1-g3-div1', 'math-g4-c2-c2-divisible', 'math-g4-m1-g4-oral-divt', 'math-g5-m1-g5-oral-decdiv', 'math-g4-m2-g4-v-div2', 'math-g4-m2-g4-v-div2q', 'math-g4-m8-g4-word-div', 'math-g5-c2-divisibility', 'math-g6-c2-divisibility'], scope: 'core', version: 1 },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['oral', 'calc'], questionTypes: ['oral', 'calc'], knowledgePoints: [], scope: 'core', version: 1 },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill'], questionTypes: ['fill'], knowledgePoints: ['math-g1-m13-multiplication-table', 'math-g1-m13-division-table', 'math-g1-m13-fill-blank', 'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit', 'math-g2-m4-fill-length', 'math-g2-m4-fill-mass', 'math-g2-m4-fill-time', 'math-g3-m4-g3-measure', 'math-g4-c4-c4-cutfill', 'math-g4-c4-c4-pa', 'math-g4-c4-c4-solid', 'math-g4-c4-c4-count'], scope: 'core', version: 1 },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice'], questionTypes: ['choice'], knowledgePoints: ['math-g1-m12-choice-mixed', 'math-g1-m5-match-calc', 'math-g1-m5-match-shape', 'math-g1-m5-match-clock', 'math-g1-m5-match-rmb', 'math-g2-m12-choice-mixed'], scope: 'core', version: 1 },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge'], questionTypes: ['judge'], knowledgePoints: ['math-g1-m0-make-ten-cushi', 'math-g1-m11-judge-mixed', 'math-g2-m11-judge-mixed'], scope: 'core', version: 1 },
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill', 'oral'], questionTypes: ['calc', 'fill', 'oral'],
    knowledgePoints: ['math-g1-m1-mixed-chain', 'math-g2-m1-mixed-addsub', 'math-g2-m1-mixed-multdiv', 'math-g2-m3-chain-addsub', 'math-g2-m3-multdiv-mixed', 'math-g2-m3-mixed-no-bracket', 'math-g2-m3-mixed-bracket', 'math-g1-m4-num-fill-unknown', 'math-g2-m3-fill-operator'],
    scope: 'core', version: 1 }
];

function buildRecords() {
  // 数据来源：M2 Generator Capability Registry（只读）；无 KP 关联者不入册（非 Generator）
  var legacy = GenCap.buildGeneratorCapabilityRegistry()
    .filter(function (r) { return r.knowledgePoints.length > 0; })
    .map(function (r) {
      return {
        id: 'legacy:' + r.pluginId,
        subject: r.subject,
        capabilities: r.capabilities.slice(),
        questionTypes: r.questionTypes.slice(),
        knowledgePoints: r.knowledgePoints.slice(),
        scope: 'legacy',
        version: 1
      };
    });
  return legacy.concat(CORE_RECORDS);
}

var _records = null;

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function get(id) {
  for (var i = 0; i < records().length; i++) {
    if (records()[i].id === id) return records()[i];
  }
  return null;
}

function all() {
  return records().slice();
}

function forKnowledgePoint(kpId) {
  return records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
}

function forQuestionType(qtId) {
  return records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require('../knowledge-point.js');
  var Resolver = require('../capability-resolver.js');
  var kp = KnowledgePoint.get(kpId);
  if (!kp) return null;
  var capabilityQuestionTypes = Resolver.getCapabilities(kp).questionTypes || [];
  return {
    knowledgePointId: kpId,
    capabilityQuestionTypes: capabilityQuestionTypes,
    generators: forKnowledgePoint(kpId).map(function (r) { return r.id; })
  };
}

/**
 * M4-R12 知识点绑定迁移：KnowledgePoint → Capabilities → Generator Registry。
 *
 * 在 Canonical KP 上注入：
 *   capabilities     —— 该 KP 能由哪些能力生成（Generator Registry 推导，覆盖类型级 capability）
 *   legacyPluginId   —— 迁移兼容字段（保留原 pluginId 引用，逐步淘汰）
 *
 * 不修改 KnowledgeBank / 插件；只读增强返回同一对象（浅注入）。
 */
function enhanceKp(kp) {
  if (!kp || typeof kp !== 'object' || !kp.id) return kp;

  var generators = forKnowledgePoint(kp.id);
  var capabilities = [];
  generators.forEach(function (g) {
    (g.capabilities || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
    // 核心 Generator 的语义能力（scope=core 无 KP 绑定，由题型/能力反查补充）
    (g.questionTypes || []).forEach(function (c) {
      if (capabilities.indexOf(c) === -1) capabilities.push(c);
    });
  });

  // 无 Generator 直接绑定该 KP 时，回退解析链（CapabilityResolver 的能力集）
  if (capabilities.length === 0) {
    var Resolver = require('../capability-resolver.js');
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  kp.legacyPluginId = (kp.source && kp.source.pluginId) || null;
  return kp;
}

module.exports = {
  records: records,
  get: get,
  all: all,
  forKnowledgePoint: forKnowledgePoint,
  forQuestionType: forQuestionType,
  forSubject: forSubject,
  resolveChain: resolveChain,
  enhanceKp: enhanceKp
};
