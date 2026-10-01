'use strict';
/**
 * semantic-evidence.js — FINAL-31b：消费处派生语义证据声明（generator/core 纯代码模块）。
 *
 * 原则（用户 FINAL-31 决策「消费处派生声明」）：
 *   ① 声明只描述题内已构造的事实（当前可判明事实：data.operation），不从 evidence-rules
 *      反推（避免"照规则答题"式伪声明）。
 *   ② 关系词汇与粒度遵循 kbl/teaching/intent-relations.json：每个基础运算对应单一基础
 *      关系（addition→add-combine / subtraction→sub-take-away / multiplication→
 *      multiply-by-times / division→divide-share；mixed 按该文件 when.hasOperation='mixed'
 *      的 allow 集声明四者）。倍比/等分等细粒度关系仅由确知构造语义的生成器 maker 自行
 *      声明（如 concept-meaning 深语义 makers），本模块不越权代答。
 *   ③ 无可判明事实时声明空 relations（诚实：不虚构）。
 *   ④ 诚实性由 validator 把关：检查 7（规则 required/forbidden 含 fieldPresent）、
 *      检查 8（声明 ⊆ KP 语义家族允许集 + forbiddenAcrossFamilies 跨家族禁表）。
 *
 * 浏览器/Node 同效：纯函数、无 kbl/ 数据依赖、无 require。
 */

var OP_TO_RELATION = {
  add: 'add-combine',
  sub: 'sub-take-away',
  mult: 'multiply-by-times',
  div: 'divide-share'
};

var MIXED_RELATIONS = ['add-combine', 'sub-take-away', 'multiply-by-times', 'divide-share'];

/** 与 validator checkOperation 同一归一化词汇：+/-/×/÷ → add/sub/mult/div */
function normalizeOp(op) {
  var s = String(op == null ? '' : op);
  if (s === '+' || s === 'add' || s === 'addition') return 'add';
  if (s === '−' || s === '-' || s === 'sub' || s === 'subtraction') return 'sub';
  if (s === '×' || s === '*' || s === 'mult' || s === 'multiplication') return 'mult';
  if (s === '÷' || s === '/' || s === 'div' || s === 'division') return 'div';
  if (s === 'mixed') return 'mixed';
  return s;
}

/**
 * 从题目已构造数据派生语义证据声明。
 * @param {Object} sq SemanticQuestion（生成器产出，wrapGenerator 收口点）
 * @param {?string[]} [kpOpsNorm] KP 语义运算归一化集合（add/sub/mult/div；来自
 *   plan.semanticParams.operations 经 normalizeOp）；为 null 表示不过滤（兼容旧调）；
 *   为空数组 [] 表示 KP 非算术语义族（statistics/spatial-reasoning 等），data.operation
 *   是模板制品（如 application-word 的 compare-more 模板发射 'sub'），不应声明算术关系。
 * @returns {{relations: string[], constructs: Array}} data.semanticEvidence 声明
 */
function derive(sq, kpOpsNorm) {
  var data = sq && sq.data;
  var relations = [];
  var algoOps = []; // 本题实际声明的通用算法类型（归一化 add/sub/mult/div；mixed 展开四者）
  if (data && data.operation != null) {
    var raw = Array.isArray(data.operation) ? data.operation : [data.operation];
    // mixed 的算法域 = KP 显式列出的基础运算之并；仅当 KP 只声明 mixed、未列任何基础运算
    // （如"混合运算的定义"）时才放开全部四则。这样"连加连减 [add,sub,mixed,sequential]"
    // 只展开加减，不会越界声明乘除。
    var kpBase = kpOpsNorm ? ['add', 'sub', 'mult', 'div'].filter(function (n) { return kpOpsNorm.indexOf(n) !== -1; }) : null;
    var opAllowed = function (n) {
      if (!kpOpsNorm) return true;
      if (kpOpsNorm.indexOf(n) !== -1) return true; // 显式列出该基础运算
      if (kpOpsNorm.indexOf('mixed') !== -1 && kpBase.length === 0) return true; // 纯 mixed → 四则
      return false;
    };
    raw.forEach(function (op) {
      var norm = normalizeOp(op);
      // mixed（连加连减/运算顺序）：KP 常只列基础词 [add,sub] 而题面发射 'mixed'。
      // 不整体丢弃——展开为四则，逐个按 KP 允许集过滤（只声明落在集内的基础算法，不越界）。
      if (norm === 'mixed') {
        ['add', 'sub', 'mult', 'div'].forEach(function (n) {
          if (!opAllowed(n)) return;
          var mr = OP_TO_RELATION[n];
          if (mr && relations.indexOf(mr) === -1) relations.push(mr);
          if (algoOps.indexOf(n) === -1) algoOps.push(n);
        });
        return;
      }
      // FINAL-32：KP 语义过滤——若 kpOpsNorm 为 truthy（KP 提供 operations 数组，可能为空
      // 如 statistics 族）且 norm 不在其中，跳过该 operation（不声明算术关系）。
      if (!opAllowed(norm)) return;
      var rel = OP_TO_RELATION[norm];
      if (rel && relations.indexOf(rel) === -1) relations.push(rel);
      if (rel && algoOps.indexOf(norm) === -1) algoOps.push(norm);
    });
  }
  // FINAL-37：constructs 不再恒空——从题目已构造 data 真实字段派生结构构件。
  // 仅描述题内确实存在的事实（字段在场即构件在场），不虚构；由 validator check#7 把关。
  return { relations: relations, constructs: deriveConstructs(data, algoOps) };
}

function pushUniq(arr, v) { if (v && arr.indexOf(v) === -1) arr.push(v); }

/**
 * FINAL-37：从 sq.data 真实结构字段派生 constructs（5 个 A 类概念族）。
 * 诚实原则：仅当字段在场时声明对应构件，缺字段即不声明（不凑）。
 *   倍的认识   base+times(+timesRelation) → base-quantity / multiple / comparison
 *   分数的意义 unitOne|equalPartition + parts+taken → whole / part / fraction-relation
 *   角的认识   vertex-edges/angle-parts → vertex / rays / angle；angle-observe → angle
 *   百分数     mode=percent-calc → percentage；whole+part 字段 → part-whole
 *   分类整理   mode=classify + sort → classification-criterion / items / ordered-or-classified-result
 * 已显式声明 semanticEvidence 的 maker（concept-meaning 深语义 makers）不经过本函数
 * （attach 已声明即跳过），故 maker 自声明 constructs 须与规则命名同源。
 */
// 通用算法类型 → 算法执行构件（不绑定进位/退位/竖式等特定方法，只描述题内执行的通用算法）
var ALGO_CONSTRUCT = {
  add: 'addition',
  sub: 'subtraction',
  mult: 'multiplication',
  div: 'division'
};

function deriveConstructs(data, algoOps) {
  if (!data || typeof data !== 'object') return [];
  var c = [];
  // 倍的认识
  if (data.base != null && data.times != null) {
    pushUniq(c, 'base-quantity');
    pushUniq(c, 'multiple');
    if (data.timesRelation != null) pushUniq(c, 'comparison');
  }
  // 分数的意义
  if (data.unitOne || data.equalPartition) pushUniq(c, 'whole');
  if (data.parts != null && data.taken != null) {
    pushUniq(c, 'part');
    pushUniq(c, 'fraction-relation');
  }
  // 角的认识
  if (data.subType === 'angle-parts' || data.topic === 'vertex-edges') {
    pushUniq(c, 'vertex');
    pushUniq(c, 'rays');
    pushUniq(c, 'angle');
  } else if (data.subType === 'angle-observe' || /^(angle-|.*angle)/.test(data.topic || '')) {
    pushUniq(c, 'angle');
  }
  if (data.topic === 'angle-count' && data.shape != null) pushUniq(c, 'shape');
  // 百分数
  if (data.mode === 'percent-calc') pushUniq(c, 'percentage');
  if ((data.base != null || data.price != null || data.principal != null ||
       data.income != null || data.total != null) &&
      (data.percent != null || data.rate != null)) {
    pushUniq(c, 'part-whole');
  }
  // 分类整理
  if (data.mode === 'classify' && data.sort != null) {
    pushUniq(c, 'classification-criterion');
    if (data.items != null) pushUniq(c, 'items');
    pushUniq(c, 'ordered-or-classified-result');
  }
  // 通用算法（B/C 通用算法 KP）：题目未命中任何概念族构件时，按本题实际执行的通用算法类型
  // 兜底声明算法构件（data.operation 在场即事实，互斥——已有概念构件则不叠加，避免污染 A 类）。
  if (c.length === 0 && Array.isArray(algoOps)) {
    algoOps.forEach(function (op) { pushUniq(c, ALGO_CONSTRUCT[op]); });
  }
  return c;
}

/**
 * Generator generate 收口自声明：为产出 sq 派生 semanticEvidence。
 * FINAL-33 根因修复——Generator 自声明，不再由 wrapper 替注入。
 * 已声明的 maker（如 concept-meaning 深语义 makers）不覆盖；诚实性由 validator
 * 检查 7/8 把关。kpOperations 来自 plan.semanticParams.operations，做 KP 语义过滤：
 *   非算术族 KP 的 data.operation 是模板制品，声明空 relations 更诚实。
 *
 * @param {Object} sq SemanticQuestion
 * @param {?string[]} [kpOperations] KP 语义运算原值（如 ['addition','subtraction'] 或 []）；
 *   经 normalizeOp 归一后传 derive 做 KP 语义过滤。null/undefined 表示无 KP 语义信息
 *   可得（旧路径或直载测试），derive 不过滤（保持向后兼容）。
 */
function attach(sq, kpOperations) {
  if (!sq || !sq.data || sq.data.semanticEvidence) return sq;
  var kpOpsNorm = null;
  if (kpOperations && kpOperations.length) {
    // 保留 'mixed'：derive 据其判定 allowsAll（混合运算允许其展开出的各基础算法），
    // 剔除会让 operations=['mixed'] 的 KP 退化为空集、声明空证据。
    kpOpsNorm = kpOperations.map(normalizeOp).filter(Boolean);
  } else if (kpOperations && Array.isArray(kpOperations) && kpOperations.length === 0) {
    // 显式传入空数组（KP 语义 operations=[]，非算术族）：传 [] 让 derive 过滤掉所有
    // 模板制品的 data.operation，声明空 relations。
    kpOpsNorm = [];
  }
  sq.data.semanticEvidence = derive(sq, kpOpsNorm);
  return sq;
}

/**
 * Generator generate 收口批量自声明（遍历 sqs 数组或 {questions:[...]}）。
 * 每个 Generator 在 return 前调用：return SemanticEvidence.attachAll(out, plan);
 * @param {Object|Object[]} sqs 产出集合
 * @param {Object} plan QuestionPlan（含 semanticParams.operations）
 */
function attachAll(sqs, plan) {
  if (!sqs) return sqs;
  var arr = Array.isArray(sqs) ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
  if (!arr) return sqs;
  var kpOps = (plan && plan.semanticParams && plan.semanticParams.operations) || null;
  for (var i = 0; i < arr.length; i++) attach(arr[i], kpOps);
  return sqs;
}

var api = {
  derive: derive,
  attach: attach,
  attachAll: attachAll
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
