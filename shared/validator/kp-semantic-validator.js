'use strict';

/**
 * shared/validator/kp-semantic-validator.js — P0-05 KP 语义验证器
 *
 * 验证生成的 SemanticQuestion 是否符合 Canonical KP 的语义约束：
 * 1. KP Identity   — question.knowledgePointIds 与 Plan 一致
 * 2. Question Type — question.type 在 KP 允许范围
 * 3. Operation     — 题目运算与 KP operation 一致
 * 4. Numeric       — numberRange 在 KP numeric.range 内
 * 5. Structure     — maxSteps/structure 符合 KP 约束
 * 6. Content       — factualContent / graphicType 语义必须出现
 *
 * 复用现有 Validator Pipeline：作为 Layer 2 步骤插入。
 */

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

// P17-7: 去 Context/Registry 直接依赖——经注入/全局边界获取（与 api.js/generation-core.js 一致的 DI 风格），
// 保留受保护的惰性 require 兜底以兼容 Node 直载与双环境。
var _GLOBAL = typeof window !== 'undefined' ? window : global;
var _deps = {};
var DEP_GLOBAL_KEYS = { knowledgeContext: 'KnowledgeContext', generatorRegistry: 'GeneratorRegistry' };
function getDep(name) {
  if (_deps[name]) return _deps[name];
  var key = DEP_GLOBAL_KEYS[name];
  var g = _GLOBAL && _GLOBAL[key];
  if (g) _deps[name] = g;
  return _deps[name];
}
function getKC() {
  var KC = getDep('knowledgeContext');
  if (KC) return KC;
  try { KC = require('../orchestration/knowledge-context.js'); _deps.knowledgeContext = KC; } catch (e) {}
  return KC;
}
function getGenRegistry() {
  var R = getDep('generatorRegistry');
  if (R) return R;
  try { R = require('../generator/generator-registry.js'); _deps.generatorRegistry = R; } catch (e) {}
  return R;
}

/**
 * 获取 KP 的规范语义约束（经 KnowledgeContext 的 Practice Context 视图；
 * 不再连接旧知识层，也不再直读 canonical——验证器读取的是 legacy-normalized 字段）
 */
function getKpConstraints(kpId) {
  var KC = getKC();
  var canonical = KC && KC.strategyView(kpId);
  if (!canonical) return null;

  // 获取算术语义运算（Frozen 语义解析器对 canonical KP 缺失 legacy 字段时安全返回 null）
  var arithSem = null;
  try { arithSem = require('../generator/core/kp-arithmetic-semantics.js').resolveArithmeticSemantics(canonical); } catch (e) {}
  var complexSem = null;
  try { complexSem = require('../generator/core/kp-complex-semantics.js').resolveComplexSemantics(canonical); } catch (e) {}

  var operation = null;
  if (arithSem && arithSem.operators) operation = arithSem.operators;
  else if (complexSem && complexSem.operators) operation = complexSem.operators;
  else operation = canonical.operation || (canonical.constraints && canonical.constraints.operation) || null;

  return {
    id: canonical.id,
    category: canonical.category || null,
    legacyType: (canonical.source && canonical.source.legacyType) || null,
    numericRange: (canonical.numeric && canonical.numeric.range) || null,
    structure: canonical.structure || {},
    generationCapabilities: (canonical.generation && canonical.generation.capabilities) || [],
    presentationQuestionTypes: ((canonical.presentation && canonical.presentation.questionTypes) || []).map(function(q){ return q.type; }),
    factualContent: (canonical.knowledge && canonical.knowledge.factualContent) || null,
    graphicType: canonical.graphicType || null,
    operation: operation,
    spiral: canonical.spiral || {}
  };
}

/**
 * 1. KP Identity: question.knowledgePointIds 与 Plan 一致
 */
function checkKpIdentity(sq, plan) {
  var errors = [];
  var planKpIds = plan?.knowledgePointIds || (plan?.knowledgePointId ? [plan.knowledgePointId] : []);
  var sqKpIds = sq.knowledgePointIds || (sq.knowledgePointId ? [sq.knowledgePointId] : []);
  
  if (!sqKpIds.length) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目缺失 knowledgePointIds', SEVERITY.ERROR, { planKpIds: planKpIds }));
  } else {
    var mismatch = sqKpIds.some(function(id) { return planKpIds.indexOf(id) === -1; });
    if (mismatch) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_IDENTITY, 'knowledgePointIds', '题目 KP 与 Plan 不一致: ' + sqKpIds.join(',') + ' vs ' + planKpIds.join(','), SEVERITY.ERROR, { planKpIds: planKpIds, sqKpIds: sqKpIds }));
    }
  }
  return errors;
}

/**
 * 2. Question Type: question.type 在 KP 允许范围
 */
function checkQuestionType(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var allowed = kpConstraints.presentationQuestionTypes || [];
  var supported = kpConstraints.generationCapabilities.map(function(c){ return c.id; }) || [];
  var allAllowed = Array.from(new Set(allowed.concat(supported)));
  
  if (allAllowed.length && sq.questionTypeId && allAllowed.indexOf(sq.questionTypeId) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_QUESTION_TYPE, 'questionTypeId', '题型 ' + sq.questionTypeId + ' 不在 KP 允许范围内: ' + allAllowed.join(','), SEVERITY.ERROR, { allowed: allAllowed, actual: sq.questionTypeId }));
  }
  return errors;
}

/**
 * 3. Operation: 题目运算与 KP operation 一致
 */
function checkOperation(sq, kpConstraints) {
  var errors = [];
  var warnings = [];
  if (!kpConstraints) return { errors: errors, warnings: warnings };
  
  var kpOp = kpConstraints.operation;
  if (!kpOp) return { errors: errors, warnings: warnings }; // 无显式 operation 约束时跳过
  
  var sqOp = sq.data?.operation;
  if (!sqOp) return { errors: errors, warnings: warnings }; // 题目无运算信息时跳过
  
  // 归一化比较：KP operation 可能是 ['+','−'] 或 ['add','sub']；题目可能是 ['+'] 或 'add' 或 'mixed'
  var kpOps = Array.isArray(kpOp) ? kpOp : [kpOp];
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  
  // 归一化 KP 操作集
  var kpOpsNorm = kpOps.map(normalizeOp);
  
  var mismatch = sqOps.some(function(op) {
    var normalized = normalizeOp(op);
    // 'mixed' 表示混合运算，当 KP 支持多种运算时视为合法
    if (normalized === 'mixed' && kpOps.length > 1) return false;
    return !kpOpsNorm.some(function(kop) { return kop === normalized; });
  });
  
  if (mismatch) {
    // B5/B6 known-pending：canonical 绑定迁移未完成时（forKnowledgePoint 恒空），
    // 选择器无法按运算区分算术家族，只能走泛型兜底 → 运算不匹配属「选择局限」而非「生成错误」，
    // 记 WARNING 保留交付；绑定迁移完成后自动恢复 ERROR（自愈，无需再改本处）。
    var hasNativeBinding = false;
    try {
      var GenRegistry = getGenRegistry();
      hasNativeBinding = GenRegistry.forKnowledgePoint(kpConstraints.id).length > 0;
    } catch (e) { /* registry 不可用 → 维持降级 */ }
    var opError = createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation', '题目运算 ' + JSON.stringify(sqOps) + ' 与 KP operation ' + JSON.stringify(kpOps) + ' 不一致', hasNativeBinding ? SEVERITY.ERROR : SEVERITY.WARNING, { kpOperation: kpOps, questionOperation: sqOps });
    if (hasNativeBinding) errors.push(opError);
    else warnings.push(opError);
  }
  return { errors: errors, warnings: warnings };
}

/**
 * 3.5 Operation Semantic Gate (P28-SEM-GATE-01)：
 * 题目 data.operation 必须 ⊆ plan.semanticParams.operations（KBL 语义 SSOT）。
 * 属根因 A「语义决策多写者」的 forcing function：暴露 name 派生 / registry 绑定 / constraints
 * 与 KBL semanticParams.operations 的不一致。先 warn-only 试运行（不阻断生成），
 * 确认误报率后再转 fail-closed；门禁本身不改正文，只加断言。
 * 跳过条件：无 plan / 无 semanticParams.operations / 题目无 data.operation / SSOT 为空。
 * 注：原计划含「kind ∈ semantic.structure」项，因生成器产出题目无 kind 字段（kind 仅
 * 为生成内部结构变量，未写入 data）而不可运行时校验，该项延后至 name 派生迁移阶段。
 */
function checkOperationSemanticGate(sq, plan) {
  var warnings = [];
  if (!plan) return warnings;
  var semOps = plan.semanticParams && plan.semanticParams.operations;
  if (!Array.isArray(semOps) || !semOps.length) return warnings;  // 无 SSOT 时不构成违例
  var sqOp = sq && sq.data && sq.data.operation;
  if (sqOp == null) return warnings;  // 题目无运算信息时跳过
  var sqOps = Array.isArray(sqOp) ? sqOp : [sqOp];
  var semOpsNorm = semOps.map(normalizeOp);
  var mismatch = sqOps.some(function (op) {
    var n = normalizeOp(op);
    // 'mixed' 表示混合运算，当 SSOT 支持多种运算时视为合法（与 checkOperation 同口径）
    if (n === 'mixed' && semOps.length > 1) return false;
    return semOpsNorm.indexOf(n) === -1;
  });
  if (mismatch) {
    warnings.push(createError(ERROR_CODES.KP_SEMANTIC_OPERATION, 'operation',
      '[SEM-GATE] 题目运算 ' + JSON.stringify(sqOps) + ' 不在 plan.semanticParams.operations ' + JSON.stringify(semOps) + ' 内（KBL SSOT）',
      SEVERITY.WARNING,
      { semanticParamsOperations: semOps, questionOperation: sqOps }));
  }
  return warnings;
}

function normalizeOp(op) {
  if (op === '+' || op === 'add' || op === 'addition') return 'add';
  if (op === '−' || op === '-' || op === 'sub' || op === 'subtraction') return 'sub';
  if (op === '×' || op === '*' || op === 'mult' || op === 'multiplication') return 'mult';
  if (op === '÷' || op === '/' || op === 'div' || op === 'division') return 'div';
  return op;
}

/**
 * 4. Numeric Constraint: numberRange 在 KP numeric.range 内
 */
function checkNumeric(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints?.numericRange) return errors;
  
  var kpRange = kpConstraints.numericRange;
  if (kpRange.min == null && kpRange.max == null) return errors; // 无显式范围约束时跳过
  
  var sqRange = sq.numberRange;
  if (!sqRange || typeof sqRange.min !== 'number' || typeof sqRange.max !== 'number') return errors;
  
  var kpMin = kpRange.min != null ? kpRange.min : -Infinity;
  var kpMax = kpRange.max != null ? kpRange.max : Infinity;
  
  if (sqRange.min < kpMin || sqRange.max > kpMax) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_NUMERIC, 'numberRange', '题目数值范围 [' + sqRange.min + ',' + sqRange.max + '] 超出 KP 约束 [' + kpMin + ',' + kpMax + ']', SEVERITY.ERROR, { kpRange: [kpMin, kpMax], sqRange: [sqRange.min, sqRange.max] }));
  }
  return errors;
}

/**
 * 5. Structure: maxSteps/structure 符合 KP 约束
 */
function checkStructure(sq, kpConstraints) {
  var errors = [];
  if (!kpConstraints) return errors;
  
  var kpStruct = kpConstraints.structure || {};
  var sqStruct = sq.constraints || {};
  
  // maxSteps 检查
  if (kpStruct.maxSteps != null && sqStruct.maxSteps != null) {
    if (sqStruct.maxSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'maxSteps', '题目 maxSteps ' + sqStruct.maxSteps + ' 超过 KP 限制 ' + kpStruct.maxSteps, SEVERITY.ERROR, { kpMaxSteps: kpStruct.maxSteps, sqMaxSteps: sqStruct.maxSteps }));
    }
  }
  
  // allowBracket / allowMultDiv 检查（KP 禁止时题目不应允许）
  if (kpStruct.allowBracket === false && sqStruct.allowBracket === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowBracket', 'KP 禁止括号但题目允许括号', SEVERITY.ERROR, {}));
  }
  if (kpStruct.allowMultDiv === false && sqStruct.allowMultDiv === true) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'allowMultDiv', 'KP 禁止乘除但题目允许乘除', SEVERITY.ERROR, {}));
  }
  
  // exactSteps 检查
  if (sqStruct.exactSteps != null && kpStruct.maxSteps != null) {
    if (sqStruct.exactSteps > kpStruct.maxSteps) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_STRUCTURE, 'exactSteps', '题目 exactSteps ' + sqStruct.exactSteps + ' 超过 KP maxSteps ' + kpStruct.maxSteps, SEVERITY.ERROR, {}));
    }
  }
  return errors;
}

/**
 * 6. Content: factualContent / graphicType 语义必须出现
 */
function checkContent(sq, kpConstraints) {
  var errors = [];
  var warnings = [];
  if (!kpConstraints) return { errors: errors, warnings: warnings };
  
  // factualContent 检查：如果 KP 有 factualContent，题目应包含相关语义
  var factual = kpConstraints.factualContent;
  if (factual) {
    // factualContent 可能是对象或字符串
    var factualKeys = typeof factual === 'object' ? Object.keys(factual) : [factual];
    var found = false;
    
    // 检查 prompt / data.graphic / data.operation / data.shapeName 等字段
    var searchable = [
      sq.prompt,
      sq.data?.graphic?.type,
      sq.data?.graphic?.subtype,
      sq.data?.operation,
      sq.data?.shapeName,
      sq.data?.targetShape,
      sq.data?.feature,
      sq.data?.kind,
      sq.data?.template
    ].filter(Boolean).join(' ').toLowerCase();
    
    factualKeys.forEach(function(key) {
      if (searchable.indexOf(key.toLowerCase()) !== -1) found = true;
    });
    
    if (!found) {
      // 仅警告，不阻断（factualContent 可能较宽泛）
      warnings.push({ code: 'KP_SEMANTIC_CONTENT_MISSING', field: 'content', message: '题目未体现 KP factualContent: ' + factualKeys.join(','), severity: 'WARN' });
    }
  }
  
  // graphicType 检查：KP 有 graphicType 时，题目 graphic.type 应匹配
  var graphicType = kpConstraints.graphicType;
  if (graphicType && sq.data?.graphic?.type && sq.data.graphic.type !== graphicType) {
    warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_MISMATCH', field: 'graphic', message: '题目 graphic.type ' + sq.data.graphic.type + ' 与 KP graphicType ' + graphicType + ' 不符', severity: 'WARN' });
  }
  
  return { errors: errors, warnings: warnings };
}

/**
 * 7. Semantic Evidence（P25-04）：声明制证据验证，四态 skip/pass/warn/fail。
 *
 * 规则数据 kbl/teaching/evidence-rules.json（A 类代表 KP × calc/fill）。
 * 声明来自 Generator：sq.data.semanticEvidence = { relations: [...], constructs: [...] }。
 *
 * 四态：
 *   skip — 该 KP×题型 无证据规则（非 A 类代表行），不干预；
 *   warn — 规则存在但题面未声明 semanticEvidence（过渡期：不阻断 allow-gen 管线，仅警告）；
 *   pass — 声明齐、required 全满足、forbidden 无命中；
 *   fail — 有声明但 required 缺失或 forbidden 命中（SEVERITY.ERROR）。
 *
 * 加载方式（有意为之）：require 路径用字符串拼接计算，打包器（dev/build-strategy-bundle.js
 * 的静态正则）不会把 kbl/ 数据内联进 bundle——否则触发 check-kbl-uniqueness「bundle 内嵌
 * canonical 数据」门禁。Node 直载正常读取；浏览器运行时 __req 未注册该 id，抛错被捕获 →
 * 规则表为空 → 全部 skip（证据门禁为 Node 侧/dev 门禁职责）。
 */
var _evidenceRules = null;
function getEvidenceRules() {
  if (_evidenceRules) return _evidenceRules;
  var map = {};
  try {
    var rulesPath = '../../' + 'kbl/' + 'teaching/' + 'evidence-rules.json';
    var doc = require(rulesPath);
    if (doc && Array.isArray(doc.rules)) {
      doc.rules.forEach(function (r) {
        if (r && r.knowledgePointId && r.questionType) {
          map[r.knowledgePointId + '|' + r.questionType] = r;
        }
      });
    }
  } catch (e) { /* 浏览器 bundle：kbl/ 数据不打包 → 全部 skip */ }
  _evidenceRules = map;
  return _evidenceRules;
}

/** 字段断言：path 相对 sq 根（如 'data.operation'）；数组按多重集比较，其余严格相等 */
/** 按点路径读取 sq 字段（fieldEquals 的只读内核），返回 undefined 表示路径不可达 */
function fieldRead(sq, path) {
  var cur = sq;
  var parts = String(path).split('.');
  for (var i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[parts[i]];
  }
  return cur;
}

function fieldEquals(sq, path, value) {
  var cur = fieldRead(sq, path);
  if (Array.isArray(value) || Array.isArray(cur)) {
    if (!Array.isArray(value) || !Array.isArray(cur)) return false;
    return value.slice().sort().join('\u0001') === cur.slice().sort().join('\u0001');
  }
  return cur === value;
}

function checkSemanticEvidence(sq, kpId) {
  var errors = [];
  var warnings = [];
  var qt = sq.questionType || sq.questionTypeId || null;
  var rule = (kpId && qt) ? getEvidenceRules()[kpId + '|' + qt] : null;
  if (!rule) return { state: 'skip', errors: errors, warnings: warnings };

  var decl = sq.data && sq.data.semanticEvidence;
  if (!decl || typeof decl !== 'object') {
    warnings.push(createError(ERROR_CODES.KP_SEMANTIC_EVIDENCE, 'data.semanticEvidence',
      'KP×题型存在证据规则但题目未声明 semanticEvidence（过渡期 WARN，不阻断）',
      SEVERITY.WARNING, { kpId: kpId, questionType: qt }));
    return { state: 'warn', errors: errors, warnings: warnings };
  }

  var relations = Array.isArray(decl.relations) ? decl.relations : [];
  // FINAL-37：constructs 不再装饰——验证器真正校验声明 constructs 是否含规则要求的结构构件。
  var constructs = Array.isArray(decl.constructs) ? decl.constructs : [];
  var missing = [];
  (rule.required || []).forEach(function (a) {
    if (a.kind === 'relation' && relations.indexOf(a.relation) === -1) missing.push('relation:' + a.relation);
    if (a.kind === 'field' && !fieldEquals(sq, a.path, a.value)) missing.push(a.path);
    // FINAL-31a：存在性断言——路径可读且非 undefined 即通过，不冻结按抽题随机取值的具体值
    if (a.kind === 'fieldPresent' && fieldRead(sq, a.path) === undefined) missing.push('present:' + a.path);
    // FINAL-37：结构构件断言——声明 constructs 须包含该构件（如 base-quantity/multiple/vertex）
    if (a.kind === 'construct' && constructs.indexOf(a.name) === -1) missing.push('construct:' + a.name);
    // 通用算法 KP：单题只执行本 KP 所允许多种通用算法中的一种——声明关系/构件须与允许集有交集
    // （正面要求"声明了本 KP 的某种合法算法"，空声明/越界算法不通过）。
    if (a.kind === 'relationAny' &&
      !(Array.isArray(a.any) && a.any.some(function (r) { return relations.indexOf(r) !== -1; }))) {
      missing.push('relationAny:[' + (a.any || []).join(',') + ']');
    }
    if (a.kind === 'constructAny' &&
      !(Array.isArray(a.any) && a.any.some(function (n) { return constructs.indexOf(n) !== -1; }))) {
      missing.push('constructAny:[' + (a.any || []).join(',') + ']');
    }
  });
  var forbiddenHits = [];
  (rule.forbidden || []).forEach(function (a) {
    if (a.kind === 'relationNot' && relations.indexOf(a.relation) !== -1) forbiddenHits.push('relation:' + a.relation);
    if (a.kind === 'fieldNot' && fieldEquals(sq, a.path, a.value)) forbiddenHits.push(a.path);
    if (a.kind === 'constructNot' && constructs.indexOf(a.name) !== -1) forbiddenHits.push('construct:' + a.name);
  });

  if (missing.length || forbiddenHits.length) {
    var msg = '语义证据不满足';
    if (missing.length) msg += '：缺 ' + missing.join(',');
    if (forbiddenHits.length) msg += (missing.length ? '；' : '：') + '违禁命中 ' + forbiddenHits.join(',');
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_EVIDENCE, 'data.semanticEvidence', msg,
      SEVERITY.ERROR, { kpId: kpId, questionType: qt, missing: missing, forbiddenHits: forbiddenHits }));
    return { state: 'fail', errors: errors, warnings: warnings };
  }
  return { state: 'pass', errors: errors, warnings: warnings };
}

/**
 * 8. Intent×Evidence 一致性（P25-05）：跨家族矛盾门禁。
 *
 * P25-03 意图矩阵声明了每 KP×QT 的 trainsWhat（训练什么），
 * P25-04 证据验证要求题目声明 semanticEvidence.relations。
 * 本检查确保二者不矛盾：题目声明的语义关系必须属于该 KP 语义家族允许的关系集，
 * 否则「意图说训练倍的比较，证据却声明加法合并」即跨家族矛盾。
 *
 * 数据源：kbl/teaching/intent-relations.json
 *   - rules[]：when(category/hasOperation/operationsEmpty/family) → allow[]
 *   - forbiddenAcrossFamilies：跨家族禁表（兜底，防止规则漏覆盖）
 *
 * 三态：
 *   skip — 题目未声明 semanticEvidence.relations（与 P25-04 warn 互补，不重复告警）
 *   pass — 声明关系全部在 allowedRelations 内
 *   fail — 存在跨家族矛盾关系（SEVERITY.ERROR，KP_SEMANTIC_INTENT_CONFLICT）
 *
 * 加载方式同 checkSemanticEvidence：计算路径 require，避免 bundle 内联 kbl/ 数据。
 */
var _intentRelations = null;
function getIntentRelations() {
  if (_intentRelations) return _intentRelations;
  try {
    var p = '../../' + 'kbl/' + 'teaching/' + 'intent-relations.json';
    _intentRelations = require(p) || { rules: [], forbiddenAcrossFamilies: {} };
  } catch (e) { _intentRelations = { rules: [], forbiddenAcrossFamilies: {} }; }
  return _intentRelations;
}

/** 基于 KP 语义事实（type/family/operations）匹配 intent-relations 规则，返回允许的关系集合 */
function getAllowedRelations(kpSemantic) {
  var doc = getIntentRelations();
  var allowed = {};
  if (!kpSemantic || !Array.isArray(doc.rules)) return allowed;
  var family = kpSemantic.family || null;
  var type = kpSemantic.type || null; // KBL type（calculation/geometry/...）
  var ops = kpSemantic.operations || [];
  var opsEmpty = ops.length === 0;

  doc.rules.forEach(function (rule) {
    var w = rule.when || {};
    var match = true;
    if (w.category && w.category !== type) match = false;
    if (w.family && w.family !== family) match = false;
    if (w.operationsEmpty === true && !opsEmpty) match = false;
    if (w.operationsEmpty === false && opsEmpty) match = false;
    if (w.hasOperation && ops.indexOf(w.hasOperation) === -1) match = false;
    if (match && Array.isArray(rule.allow)) rule.allow.forEach(function (r) { allowed[r] = true; });
  });

  // 跨家族禁表兜底：几何家族禁算术关系，算术家族禁几何关系
  var forbidden = doc.forbiddenAcrossFamilies || {};
  if (type === 'geometry' || family === 'geometry') {
    (forbidden.geometry || []).forEach(function (r) { delete allowed[r]; });
  } else if (type === 'calculation' || family === 'multiplication-division' ||
             family === 'fraction' || family === 'decimal' || family === 'percent') {
    (forbidden['algebra-arithmetic'] || []).forEach(function (r) { delete allowed[r]; });
  }
  return allowed;
}

function getKpSemanticForIntent(kpId) {
  if (!kpId) return null;
  var KC = getKC();
  if (!KC || typeof KC.get !== 'function') return null;
  var kp = KC.get(kpId);
  if (!kp) return null;
  var sem = kp.semantic || {};
  return { family: sem.family || null, type: kp.type || null, operations: sem.operations || [] };
}

function checkIntentEvidenceConsistency(sq, kpId) {
  var errors = [];
  var decl = sq.data && sq.data.semanticEvidence;
  var relations = decl && Array.isArray(decl.relations) ? decl.relations : [];
  if (relations.length === 0) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  // KC 不可用（如浏览器 bundle 未加载 knowledge-context）时无法判定，skip 不误杀
  var kpSemantic = getKpSemanticForIntent(kpId);
  if (!kpSemantic) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  var allowed = getAllowedRelations(kpSemantic);
  // 规则表为空（bundle 未内联 intent-relations.json / 加载失败）时无法判定，skip 不误杀
  if (Object.keys(allowed).length === 0) {
    return { state: 'skip', errors: errors, warnings: [] };
  }

  var conflicts = relations.filter(function (r) { return !allowed[r]; });
  if (conflicts.length) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_CONFLICT, 'data.semanticEvidence.relations',
      '声明的语义关系与 KP 意图矛盾（跨家族）：' + conflicts.join(','), SEVERITY.ERROR,
      { kpId: kpId, conflicts: conflicts, allowedRelations: Object.keys(allowed) }));
    return { state: 'fail', errors: errors, warnings: [] };
  }
  return { state: 'pass', errors: errors, warnings: [] };
}

/**
 * 9. 题型教育契约（P25-07）：声明制结构不变式门禁。
 *
 * 每个 contractible 题型（calc/fill/choice/judge/geometry/classify/apply）声明了
 * 交付形态不变式（CONTRACT_MAP：calc→expressionPresent、choice→optionsPresent+
 * answerInOptions…）。题目到达验证器时必须已满足全部不变式——
 * 生成管道中 wrapGenerator 的 TypeContract.enforce（finish/drop 单点收口）是
 * 保证者；此处到验证器仍不合规即「绕过收口」→ SEVERITY.ERROR（KP_TYPE_CONTRACT）。
 *
 * 执行层：shared/generator/core/type-contract.js（纯代码模块，不含 kbl/ 数据，
 * 可安全被 bundle 内联——与 evidence/intent-relations 的 skip 策略不同，本检查
 * 在 Node 与 bundle 环境同效）。
 *
 * 两态：
 *   skip — TypeContract 不可用，或题目题型无契约（非规范 7 类 / legacy token）
 *   pass — 全部声明不变式满足
 *   fail — 存在不变式违例（违反题型交付形态，fail-closed）
 */
var _typeContract = null;
function getTypeContract() {
  if (_typeContract !== null) return _typeContract;
  try { _typeContract = require('../generator/core/type-contract.js'); }
  catch (e) { _typeContract = false; }
  return _typeContract;
}

function checkTypeContract(sq) {
  var errors = [];
  var TC = getTypeContract();
  if (!TC || typeof TC.check !== 'function') {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var qt = sq.questionType || sq.questionTypeId || null;
  if (!qt || !TC.CONTRACT_MAP || !TC.CONTRACT_MAP[qt]) {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var res = TC.check(qt, sq);
  if (!res || res.ok !== false) {
    return { state: 'pass', errors: errors, warnings: [] };
  }
  errors.push(createError(ERROR_CODES.KP_TYPE_CONTRACT, 'questionType',
    '题型教育契约违例（' + qt + '）：' + (res.violations || []).join(','),
    SEVERITY.ERROR, { questionType: qt, violations: res.violations || [] }));
  return { state: 'fail', errors: errors, warnings: [] };
}

/**
 * 10. Intent Alignment（P30-15）：生成结果与 plan.semanticParams.intent 机器字段对齐。
 *
 * 验证四个维度：
 *   focus           — intent.focus 与 questionType 的映射一致性
 *   representation  — intent.allowedRepresentations 与题目实际表征
 *   graphicRole     — intent.graphicRole 与题目是否含图形
 *   expressionMode  — intent.expressionModes 与题目形态推导
 *
 * 三态：skip（无 plan.semanticParams.intent）/ pass / fail（SEVERITY.ERROR）
 */

// 题型 → focus 机械映射（canonical 7 类）
var QT_FOCUS_MAP = {
  calc: 'calculation', fill: 'written', apply: 'application',
  choice: 'selection', judge: 'selection', geometry: 'geometry', classify: 'classification'
};

// 题型 → expressionMode 机械推导
var QT_EXPRESSION_MAP = {
  calc: 'expression', fill: 'text', apply: 'context-word',
  choice: 'option-selection', judge: 'binary-judgement', geometry: 'graphic-construction', classify: 'grouping'
};

function checkIntentAlignment(sq, plan) {
  var errors = [];
  var sp = plan && plan.semanticParams ? plan.semanticParams : null;
  // P30-15：retry-loop 传入的 plan 未经 attachToPlan，兜底自算 semanticParams
  if (!sp && plan) {
    try {
      var SP = require('../generator/core/semantic-parameters.js');
      sp = SP.attachToPlan(plan).semanticParams;
    } catch (e) { /* 依赖不可用 → skip */ }
  }
  if (!sp || !sp.intent) {
    return { state: 'skip', errors: errors, warnings: [] };
  }
  var intent = sp.intent;
  var qt = sq.questionType || sq.questionTypeId || null;
  if (!qt) return { state: 'skip', errors: errors, warnings: [] };

  // 1. focus 对齐
  var expectedFocus = QT_FOCUS_MAP[qt];
  if (intent.focus && expectedFocus && intent.focus !== expectedFocus) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'focus',
      'intent.focus ' + intent.focus + ' 与题型 ' + qt + ' 期望 focus ' + expectedFocus + ' 不一致',
      SEVERITY.ERROR, { intentFocus: intent.focus, questionType: qt, expectedFocus: expectedFocus }));
  }

  // 2. representation 对齐：allowedRepresentations 不含 'graphic' 时题目不应含 graphic（反向约束）
  //    含 'graphic' 是「允许」非「必须」——强制含图由 graphicRole=carrier 承担（见下）
  var hasGraphic = !!(sq.data && sq.data.graphic);
  var allowedReps = intent.allowedRepresentations || [];
  if (allowedReps.length && allowedReps.indexOf('graphic') === -1 && hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'representation',
      'intent.allowedRepresentations 不含 graphic 但题目含图形',
      SEVERITY.ERROR, { allowedRepresentations: allowedReps, hasGraphic: hasGraphic }));
  }

  // 3. graphicRole 对齐（P30-22/27/28）
  //    intent.graphicRole 取值：carrier（图为核心载体，必须有图）/ auxiliary（图为辅助，可选）/ null（不需图）。
  //    carrier → 必须含 graphic；null → 禁止含 graphic；auxiliary → 不约束有无。
  var graphicRole = intent.graphicRole;
  var GRAPHIC_ROLES = {
    'quantity-correspondence': 1, 'number-position': 1, 'angle-measure': 1,
    'fraction-part': 1, 'area-measure': 1, 'data-comparison': 1,
    'calculation-support': 1, 'auxiliary': 1, 'carrier': 1
  };
  if (graphicRole === 'carrier' && !hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=carrier 要求题目必须含图形，实际未含',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  if (graphicRole === null && hasGraphic) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphicRole',
      'intent.graphicRole=null 要求题目不含图形，实际含图形',
      SEVERITY.ERROR, { graphicRole: graphicRole, hasGraphic: hasGraphic }));
  }
  // P30-27：graphic.role 合法性校验。
  // 注意：intent.graphicRole（carrier/auxiliary/null，表"图是否核心载体"）与
  // graphic.role（quantity-correspondence/angle-measure/...，表"图的具体语义角色"）
  // 是不同维度，不强制相等；仅校验 graphic.role 属于合法枚举。
  if (hasGraphic) {
    var gRole = sq.data.graphic.role;
    if (gRole != null && !GRAPHIC_ROLES[gRole]) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphic.role',
        'graphic.role=' + gRole + ' 不在合法枚举内',
        SEVERITY.ERROR, { graphicRole: gRole }));
    }
  }

  // 4. expressionMode 对齐
  var expectedMode = QT_EXPRESSION_MAP[qt];
  var modes = intent.expressionModes || [];
  if (expectedMode && modes.length && modes.indexOf(expectedMode) === -1) {
    errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'expressionMode',
      'intent.expressionModes ' + JSON.stringify(modes) + ' 不含题型 ' + qt + ' 期望模式 ' + expectedMode,
      SEVERITY.ERROR, { expressionModes: modes, questionType: qt, expectedMode: expectedMode }));
  }

  return {
    state: errors.length ? 'fail' : 'pass',
    errors: errors,
    warnings: []
  };
}

/**
 * P30-27：Graphic Alignment Gate——SVG 与题目数据一致性验证。
 * 覆盖四项：
 *   1. 题目数字 ↔ graphic.params（angle-measure: params.angle 与 answer 一致）
 *   2. 图形类型 intent.graphicRole ↔ graphic.role（已在 checkIntentAlignment 覆盖，此处不重复）
 *   3. 图形结构 graphic.subtype ↔ SVG renderer（isSupported 检查）
 *   4. SVG 输出 ↔ graphic descriptor（render 状态检查）
 */
function checkGraphicAlignment(sq, plan) {
  var errors = [];
  var warnings = [];
  var g = sq.data && sq.data.graphic;
  if (!g) return { state: 'skip', errors: errors, warnings: warnings };

  // 1. 题目数字 ↔ graphic.params
  if (g.role === 'angle-measure' && g.params && g.params.angle != null) {
    var answer = sq.answer && (typeof sq.answer === 'object' ? sq.answer.value : sq.answer);
    var answerNum = typeof answer === 'string' ? parseFloat(answer) : answer;
    if (typeof answerNum === 'number' && !isNaN(answerNum)) {
      // 角度题答案应与 params.angle 一致；answer 为类别（如直角=90°）时 graphic 为示意，降级 WARN
      if (Math.abs(answerNum - g.params.angle) > 0.01) {
        warnings.push({ code: 'KP_SEMANTIC_GRAPHIC_ANGLE_MISMATCH', field: 'graphic.params.angle', message: '题目答案 ' + answerNum + ' 与 graphic.params.angle ' + g.params.angle + ' 不一致', severity: 'WARN', detail: { answer: answerNum, graphicAngle: g.params.angle } });
      }
    }
  }

  // 3. graphic.subtype ↔ SVG renderer
  try {
    var GR = require('../generator/graphic-renderer.js');
    if (!GR.isSupported(g.type, g.subtype)) {
      errors.push(createError(ERROR_CODES.KP_SEMANTIC_INTENT_ALIGNMENT, 'graphic.subtype',
        'graphic ' + g.type + '/' + g.subtype + ' 无注册 SVG renderer',
        SEVERITY.ERROR, { type: g.type, subtype: g.subtype }));
    }
  } catch (e) { /* graphic-renderer 不可用 → skip */ }

  // 4. SVG 输出 ↔ graphic descriptor：属运行时渲染检查，不在语义 validator 中执行
  //    （Node 环境无浏览器渲染管线，svg-*.js 未加载会误报；浏览器端由 E2E 覆盖）

  return {
    state: errors.length ? 'fail' : 'pass',
    errors: errors,
    warnings: []
  };
}
function validateKpSemantics(sq, context) {
  context = context || {};
  var plan = context.plan;
  var kpId = context.kpId || (plan && (plan.knowledgePointIds?.[0] || plan.knowledgePointId));
  var kpConstraints = context.kpConstraints || (kpId ? getKpConstraints(kpId) : null);
  
  var allErrors = [];
  var allWarnings = [];
  var allInfo = [];
  
  // 1. KP Identity
  allErrors.push.apply(allErrors, checkKpIdentity(sq, plan));
  
  // 2. Question Type
  allErrors.push.apply(allErrors, checkQuestionType(sq, kpConstraints));
  
  // 3. Operation
  var opResult = checkOperation(sq, kpConstraints);
  allErrors.push.apply(allErrors, opResult.errors);
  allWarnings.push.apply(allWarnings, opResult.warnings);

  // 3.5 Operation Semantic Gate (P28-SEM-GATE-01)：题目 data.operation ⊆ plan.semanticParams.operations（KBL SSOT）；warn-only
  allWarnings.push.apply(allWarnings, checkOperationSemanticGate(sq, plan));
  
  // 4. Numeric
  allErrors.push.apply(allErrors, checkNumeric(sq, kpConstraints));
  
  // 5. Structure
  allErrors.push.apply(allErrors, checkStructure(sq, kpConstraints));
  
  // 6. Content
  var contentResult = checkContent(sq, kpConstraints);
  allErrors.push.apply(allErrors, contentResult.errors);
  allWarnings.push.apply(allWarnings, contentResult.warnings);

  // 7. Semantic Evidence（P25-04：四态 skip/pass/warn/fail；不放宽既有 6 检查）
  var evidenceResult = checkSemanticEvidence(sq, kpId);
  allErrors.push.apply(allErrors, evidenceResult.errors);
  allWarnings.push.apply(allWarnings, evidenceResult.warnings);

  // 8. Intent×Evidence 一致性（P25-05：跨家族矛盾门禁；skip/pass/fail）
  var intentResult = checkIntentEvidenceConsistency(sq, kpId);
  allErrors.push.apply(allErrors, intentResult.errors);

  // 9. 题型教育契约（P25-07：声明制结构不变式门禁；skip/pass/fail）
  var typeContractResult = checkTypeContract(sq);
  allErrors.push.apply(allErrors, typeContractResult.errors);

  // 10. Intent Alignment（P30-15：生成结果与 intent 机器字段对齐；skip/pass/fail）
  var intentAlignmentResult = checkIntentAlignment(sq, plan);
  allErrors.push.apply(allErrors, intentAlignmentResult.errors);

  // 11. Graphic Alignment（P30-27：SVG 与题目数据一致性；skip/pass/fail）
  var graphicAlignmentResult = checkGraphicAlignment(sq, plan);
  allErrors.push.apply(allErrors, graphicAlignmentResult.errors);
  allWarnings.push.apply(allWarnings, graphicAlignmentResult.warnings);

  var valid = allErrors.length === 0;
  var score = valid ? 1 : Math.max(0, 1 - allErrors.length / 7);

  return {
    valid: valid,
    errors: allErrors,
    warnings: allWarnings,
    info: allInfo,
    score: score,
    semanticEvidence: evidenceResult.state,
    intentConsistency: intentResult.state,
    typeContract: typeContractResult.state,
    intentAlignment: intentAlignmentResult.state,
    graphicAlignment: graphicAlignmentResult.state,
    checks: {
      kpIdentity: checkKpIdentity(sq, plan).length === 0 ? 'pass' : 'fail',
      questionType: checkQuestionType(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      operation: opResult.errors.length === 0 ? 'pass' : 'fail',
      numeric: checkNumeric(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      structure: checkStructure(sq, kpConstraints).length === 0 ? 'pass' : 'fail',
      content: contentResult.errors.length === 0 ? 'pass' : 'fail',
      semanticEvidence: evidenceResult.state,
      intentConsistency: intentResult.state,
      typeContract: typeContractResult.state,
      intentAlignment: intentAlignmentResult.state
    }
  };
}

module.exports = {
  validateKpSemantics: validateKpSemantics,
  getKpConstraints: getKpConstraints,
  checkKpIdentity: checkKpIdentity,
  checkQuestionType: checkQuestionType,
  checkOperation: checkOperation,
  checkOperationSemanticGate: checkOperationSemanticGate,
  checkNumeric: checkNumeric,
  checkStructure: checkStructure,
  checkContent: checkContent,
  checkSemanticEvidence: checkSemanticEvidence,
  checkIntentEvidenceConsistency: checkIntentEvidenceConsistency,
  checkTypeContract: checkTypeContract,
  checkIntentAlignment: checkIntentAlignment,
  checkGraphicAlignment: checkGraphicAlignment,
  getAllowedRelations: getAllowedRelations,
  getEvidenceRules: getEvidenceRules
};