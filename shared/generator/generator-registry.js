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

// MATH-14：legacy 插件轨道已删除。注册表仅保留 native core Generator，
// 不再合并 generator-capability-registry 的 legacy 记录（无 fallback 宿主）。

// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
// M4-R06 核心 Generator 声明（纯数据；执行实现位于 shared/generator/generators/）
var CORE_RECORDS = [
  { id: 'generator:arithmetic-addition', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g4-down-u03-k003', 'math-g6-down-u01-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-subtraction', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g1-down-u02-k001', 'math-g1-down-u03-k001', 'math-g1-down-u04-k001', 'math-g1-up-u04-k001', 'math-g1-up-u06-k001', 'math-g2-down-u06-k001', 'math-g2-up-u02-k002', 'math-g2-up-u02-k004', 'math-g4-down-u06-k002', 'math-g4-up-u01-k001'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-multiplication', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g2-up-u04-k001', 'math-g2-up-u04-k002', 'math-g4-down-u03-k002', 'math-g4-up-u03-k001', 'math-g4-up-u03-k002', 'math-g4-up-u03-k003', 'math-g4-up-u04-k002', 'math-g4-up-u04-k003', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002', 'math-g5-up-u01-k002', 'math-g5-up-u02-k002', 'math-g6-down-u04-k005'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-division', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: ['math-g2-up-u03-k001', 'math-g2-up-u03-k002', 'math-g2-up-u03-k003', 'math-g2-up-u03-k004', 'math-g2-down-u02-k003', 'math-g2-down-u02-k005', 'math-g2-down-u05-k001', 'math-g2-down-u05-k002', 'math-g2-down-u05-k003', 'math-g3-down-u02-k001', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g5-down-u02-k001', 'math-g5-down-u02-k002', 'math-g5-up-u03-k003'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:arithmetic-mixed-calculation', subject: 'math', capabilities: ['oral', 'calc', 'fill', 'apply'], questionTypes: ['oral', 'calc', 'fill', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-fill', subject: 'math', capabilities: ['fill', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['fill', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: ['math-g2-down-u07-k002'], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-choice', subject: 'math', capabilities: ['choice', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['choice', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:selection-judge', subject: 'math', capabilities: ['judge', 'recognize', 'calc', 'oral', 'apply'], questionTypes: ['judge', 'recognize', 'calc', 'oral', 'apply'], knowledgePoints: [], scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:complex-calc', subject: 'math', capabilities: ['calc', 'fill', 'oral'], questionTypes: ['calc', 'fill', 'oral'],
    knowledgePoints: ['math-g1-up-u03-k001', 'math-g2-down-u04-k002', 'math-g2-down-u04-k003', 'math-g2-down-u04-k004', 'math-g2-down-u04-k006'],
    scope: 'core', version: 1, supportsComposite: false },

  // P0-04 Step 15-20: 新增形状/位置/金钱/应用题 Generator
  { id: 'generator:shape-recognition', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'], questionTypes: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g3-down-u05-k001', 'math-g3-up-u06-k001', 'math-g4-down-u02-k001', 'math-g4-down-u07-k001', 'math-g4-down-u07-k002', 'math-g5-down-u01-k001', 'math-g5-down-u03-k004', 'math-g5-down-u03-k005', 'math-g5-down-u05-k001', 'math-g5-down-u05-k002', 'math-g5-down-u05-k003', 'math-g5-down-u05-k004', 'math-g5-up-u06-k001', 'math-g5-up-u06-k002', 'math-g5-up-u06-k003', 'math-g5-up-u06-k004', 'math-g5-up-u06-k005', 'math-g5-up-u06-k006', 'math-g6-down-u03-k001', 'math-g6-down-u03-k002', 'math-g6-down-u03-k003', 'math-g6-down-u03-k004', 'math-g6-up-u02-k001', 'math-g6-up-u07-k001'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:position-direction', subject: 'math', capabilities: ['choice', 'judge', 'fill', 'oral'], questionTypes: ['choice', 'judge', 'fill', 'oral'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:money-measurement', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'], questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:application-word', subject: 'math', capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'], questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    knowledgePoints: ['math-g4-up-u06-k001', 'math-g5-down-u03-k006'],
    scope: 'core', version: 1, supportsComposite: false },

  // P0-07 Step 32: Composite Generator（仅三种模式，supportsComposite=true）
  { id: 'generator:counting', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g3-down-u08-k001', 'math-g3-up-u08-k001'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:reasoning', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-up-u07-k001', 'math-g4-down-u09-k002', 'math-g4-up-u08-k002', 'math-g5-down-u08-k001', 'math-g5-up-u07-k002', 'math-g6-down-u05-k001'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:stats', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-down-u01-k001', 'math-g2-down-u01-k002', 'math-g3-down-u03-k001', 'math-g4-down-u08-k004', 'math-g4-up-u07-k001', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003', 'math-g5-down-u08-k002', 'math-g5-up-u04-k003', 'math-g6-up-u07-k001', 'math-g6-up-u07-k002', 'math-g6-up-u07-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:picture-equation', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: ['math-g2-down-u04-k005', 'math-g4-down-u01-k001', 'math-g4-down-u06-k004', 'math-g5-up-u07-k003', 'math-g6-down-u04-k003'],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c1-number-puzzle', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c2-number-theory', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c5-c6-journey-engineering', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c7-clever-calc', subject: 'math', capabilities: ['apply', 'calc'], questionTypes: ['apply', 'calc'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:c9-comprehensive', subject: 'math', capabilities: ['apply', 'calc', 'open'], questionTypes: ['apply', 'calc', 'open'],
    knowledgePoints: [],
    scope: 'core', version: 1, supportsComposite: false },
  { id: 'generator:composite', subject: 'math', capabilities: ['calc', 'judge', 'fill', 'apply', 'oral'], questionTypes: ['calc', 'judge', 'fill', 'apply', 'oral'],
    knowledgePoints: ['math-g1-up-u01-k001', 'math-g2-down-u07-k001', 'math-g2-up-u01-k005', 'math-g3-up-u02-k001', 'math-g4-up-u03-k001'],
    scope: 'core', version: 1, supportsComposite: true },

  // V2.1 专项语义生成器（新教材补录 KP 的专用逻辑，native 绑定保证语义正确路由）
  { id: 'generator:code-recognition', subject: 'math', capabilities: ['fill', 'choice', 'judge', 'recognize'], questionTypes: ['fill', 'choice', 'judge', 'recognize'],
    knowledgePoints: ['math-g4-up-u01-k002'],
    scope: 'core', version: 2, supportsComposite: false },
  { id: 'generator:equivalent-reasoning', subject: 'math', capabilities: ['fill', 'choice', 'apply'], questionTypes: ['fill', 'choice', 'apply'],
    knowledgePoints: [],
    scope: 'core', version: 2, supportsComposite: false },

  // V2.1 补充：分类整理生成器（补齐 7 类规范题型中唯一无生成器的 classify）
  // P17-10：knowledgePoints 重对齐为 canonical 生成映射（shared/knowledge/mappings/generation-contract/math.json
  // 真值源，classify→generator:classification 共 25 条）。旧绑定（g3-g4 4 条）为 legacy 残留（DEV_LOG:1838「非运行时绑定」）。
  // 25 个 canonical classify 载体同时被 shape-recognition 等泛型家族部分绑定；classify 计划下
  // classification 依 kp 并列后靠 capability/qt 胜出（配合 generator-selector 分类语义域提升），非 classify 计划不受影响。
  { id: 'generator:classification', subject: 'math', capabilities: ['classify'], questionTypes: ['classify'],
    knowledgePoints: ['math-g2-up-u01-k001', 'math-g2-up-u01-k002', 'math-g2-up-u01-k003', 'math-g2-up-u01-k004', 'math-g2-up-u01-k005', 'math-g2-up-u01-k006', 'math-g3-down-u05-k001', 'math-g3-down-u05-k002', 'math-g3-down-u05-k003', 'math-g3-down-u05-k004', 'math-g4-up-u06-k001', 'math-g4-up-u06-k002', 'math-g4-up-u06-k003', 'math-g4-up-u06-k004', 'math-g4-down-u08-k001', 'math-g4-down-u08-k002', 'math-g4-down-u08-k003', 'math-g4-down-u08-k004', 'math-g5-up-u07-k001', 'math-g5-up-u07-k002', 'math-g5-up-u07-k003', 'math-g5-up-u07-k004', 'math-g5-down-u07-k001', 'math-g5-down-u07-k002', 'math-g5-down-u07-k003'],
    scope: 'core', version: 2, supportsComposite: false },

  // P24-02：百分数单元语义生成器（意义/互化/折扣/利率/达标线/解决问题）。
  // 6 个 canonical KP 此前被误绑 shape-recognition，calc 真实生成 0 题（1570 探针 15 失败项）。
  // choice 仍由 generation-contract 指定的 generator:selection-choice 承载。
  { id: 'generator:percent-calc', subject: 'math', capabilities: ['calc', 'fill', 'apply'], questionTypes: ['calc', 'fill', 'apply'],
    knowledgePoints: ['math-g6-up-u05-k001', 'math-g6-up-u05-k002', 'math-g6-up-u05-k003', 'math-g6-up-u05-k004', 'math-g6-up-u05-k005', 'math-g6-up-u05-k006'],
    scope: 'core', version: 1, supportsComposite: false }
];

// 7 类规范题型改造（知识点驱动）：manifest 历史 token（oral/recognize/open）在注册时
// 经 question-type-registry 归一为规范 7 类（oral→calc / recognize→geometry / open→apply），
// 避免逐生成器改写；保证 capability / questionTypes 全为 canonical 7 类。
var QTR = (function () {
  try { return require('../knowledge/question-type-registry.js'); }
  catch (e) {
    return (typeof window !== 'undefined' && window.QuestionTypeRegistry) ||
      (typeof globalThis !== 'undefined' && globalThis.QuestionTypeRegistry) || null;
  }
})();

function normToken(tok) {
  if (!tok || typeof tok !== 'string') return tok;
  if (!QTR) return tok;
  var r = QTR.normalizeQuestionType(tok, { allowHeuristic: false });
  return (r && r.id) ? r.id : tok;
}

function normList(arr) {
  if (!Array.isArray(arr)) return arr;
  var seen = {}, out = [];
  arr.forEach(function (t) {
    var n = normToken(t);
    if (n && !seen[n]) { seen[n] = 1; out.push(n); }
  });
  return out;
}

function buildRecords() {
  // MATH-14：legacy 轨道已删除，注册表仅含 native core Generator。
  // （历史上曾合并 generator-capability-registry 的 legacy 插件记录，已移除。）
  return CORE_RECORDS.map(function (r) {
    return {
      id: r.id,
      subject: r.subject,
      capabilities: normList(r.capabilities),
      questionTypes: normList(r.questionTypes),
      knowledgePoints: r.knowledgePoints,
      scope: r.scope,
      version: r.version,
      supportsComposite: r.supportsComposite
    };
  });
}

var _records = null;
var _kpCache = null;      // M11-R02: kpId -> generators[]
var _qtCache = null;      // M11-R02: qtId -> generators[]

function records() {
  if (!_records) _records = buildRecords();
  return _records;
}

function invalidateCaches() {
  _kpCache = null;
  _qtCache = null;
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
  if (!_kpCache) _kpCache = {};
  if (_kpCache[kpId]) return _kpCache[kpId];
  var result = records().filter(function (r) {
    return r.knowledgePoints.indexOf(kpId) !== -1;
  });
  return (_kpCache[kpId] = result);
}

function forQuestionType(qtId) {
  if (!_qtCache) _qtCache = {};
  if (_qtCache[qtId]) return _qtCache[qtId];
  var result = records().filter(function (r) {
    return r.questionTypes.indexOf(qtId) !== -1;
  });
  return (_qtCache[qtId] = result);
}

function forSubject(subject) {
  return records().filter(function (r) { return r.subject === subject; });
}

function resolveChain(kpId) {
  var KnowledgePoint = require('../knowledge/knowledge-point.js');
  var Resolver = require('../capability/capability-resolver.js');
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
    var Resolver = require('../capability/capability-resolver.js');
    var caps = Resolver.getCapabilities(kp).questionTypes || [];
    capabilities = caps.slice();
  }

  kp.capabilities = capabilities;
  // MATH-14：legacy 轨道已删，不再注入 legacyPluginId。
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
  enhanceKp: enhanceKp,
  invalidateCaches: invalidateCaches
};
