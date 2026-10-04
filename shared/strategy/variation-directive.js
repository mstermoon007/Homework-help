/**
 * shared/strategy/variation-directive.js — P27-11 Misconception→NextVariation 指令解析
 *
 * 链路（收口 P25-11 缺口：error-model 有记录链、无消费链）：
 *   LearnerModel.getErrors（error-model 8 错因聚焦，已有记录链）
 *     → 本模块 resolveForPlan：KP 的 MisconceptionProfile（P27-10 overlay）按
 *       triggerPattern（计划期可判定谓词：题型 + 运算标签）过滤 → 变式指令
 *     → AdaptiveStrategy.resolve 用指令转向 R18 六变体（variant steering）
 *     → StrategyEngine 把指令与转向后 variant 挂上 QuestionPlan（trace 可溯）
 *     → Generator 通用消费（axis='numeric' → 数值低位巩固，见 arithmetic.js）
 *
 * 数据源：kbl/teaching/misconception-profiles.json（P27-10 overlay）。
 * 加载方式（P30-31 正规通道重建）：
 *   Strategy 禁直读 kbl/（FINAL-22 红线）。overlay 经运行时镜像
 *   shared/knowledge/teaching/misconception-profiles.json → KBL Runtime 公开 API
 *   misconceptionsFor → KnowledgeContext.misconceptionsFor → strategy-engine 按 KP
 *   取出条目注入本模块 opts.profile。本模块保持纯解析：不读文件、不读全局、不缓存数据。
 *   profile 缺失/无 slots → 空指令（数据缺失如实返回空，非兜底伪造）。
 *
 * 红线：纯解析；不改 Learner 状态、不选生成器、不做 KP ID 分支——一切命中
 * 都来自 overlay 数据（P27-10 机械派生，每 slot 带 basis 引文）。
 *
 * P28-19 五段链声明（同一模型面，串行可溯源）：
 *   Misconception      →  overlay.kps[kpId].slots[]            （错因剖面 slot 集合）
 *   Trigger            →  slot.triggerPattern                  （触发谓词：题型 + 运算标签）
 *   QuestionVariation  →  slot.response.{variant,axis}         （变式转向，R18 六变体）
 *   ExpectedError      →  slot.errorType                       （预期错因，error-model 8 类）
 *   Feedback           →  slot.feedback                        （反馈文案，缺省空串）
 */
(function (global) {
  'use strict';

  // P28-19 五段链段名（供门禁与溯源消费；不承载逻辑，仅声明链面）
  var CHAIN_SEGMENTS = ['Misconception', 'Trigger', 'QuestionVariation', 'ExpectedError', 'Feedback'];

  // P30-31：overlay 经 KnowledgeContext 正规通道注入（见 opts.profile）；
  // 本模块无数据源读取（FINAL-22 直读 KBL 已移除，P30-31 以注入方式重建消费链）。

  // 运算形态归一（计划期 token：符号 / 标签 / KBL 运算名 → {add,sub,mult,div} 标签集）
  var OP_NORM = {
    '+': 'add', '−': 'sub', '-': 'sub', '×': 'mult', '*': 'mult', '÷': 'div', '/': 'div',
    'add': 'add', 'sub': 'sub', 'mult': 'mult', 'div': 'div',
    'addition': 'add', 'subtraction': 'sub', 'multiplication': 'mult', 'division': 'div'
  };

  function normalizeOps(tokens) {
    var out = [];
    var arr = Array.isArray(tokens) ? tokens : (tokens == null ? [] : [tokens]);
    arr.forEach(function (t) {
      if (t == null) return;
      var key = String(t);
      var n = OP_NORM[key] || OP_NORM[key.toLowerCase()];
      if (n && out.indexOf(n) === -1) out.push(n);
    });
    return out;
  }

  /**
   * 计划期变式指令解析（Misconception→NextVariation 唯一入口）。
   * @param {Object} opts {
   *   kpId            : string   （KP，溯源/日志用）
   *   errorTypes      : string[] （错因聚焦，来自 adaptive errorFocus / learner getErrors）
   *   questionTypeId  : string   （canonical 题型）
   *   operationTokens?: string[]|string（计划运算 token，符号/标签混排均可）
   *   profile         : Object|null（P30-31：KnowledgeContext.misconceptionsFor(kpId)
   *                     返回的该 KP overlay 条目 { knowledgePointId, slots }，注入消费）
   * }
   * @returns {Array<{errorType:string, expectedError:string, variant:string, axis:string, feedback:string, basis:string}>}
   */
  function resolveForPlan(opts) {
    if (!opts || !opts.kpId) return [];
    var entry = opts.profile || null; // P30-31：数据经 KnowledgeContext 注入（Strategy 禁直读 KBL）
    if (!entry || !Array.isArray(entry.slots)) return [];
    if (!Array.isArray(opts.errorTypes) || !opts.errorTypes.length) return [];
    var focus = {};
    opts.errorTypes.forEach(function (t) { if (typeof t === 'string') focus[t] = true; });
    var planOps = normalizeOps(opts.operationTokens);
    var out = [];
    entry.slots.forEach(function (slot) {
      if (!slot || !focus[slot.errorType]) return;
      var tp = slot.triggerPattern || {};
      if (Array.isArray(tp.questionTypes) && tp.questionTypes.indexOf(opts.questionTypeId) === -1) return;
      if (Array.isArray(tp.operations) && tp.operations.length) {
        var hit = false;
        tp.operations.forEach(function (op) { if (planOps.indexOf(op) !== -1) hit = true; });
        if (!hit) return;
      }
      var resp = slot.response || {};
      out.push({
        errorType: slot.errorType,
        expectedError: slot.errorType,
        variant: resp.variant,
        axis: resp.axis,
        feedback: typeof slot.feedback === 'string' ? slot.feedback : '',
        basis: slot.basis
      });
    });
    return out;
  }

  var VariationDirective = {
    resolveForPlan: resolveForPlan,
    normalizeOps: normalizeOps,
    CHAIN_SEGMENTS: CHAIN_SEGMENTS
  };

  global.VariationDirective = VariationDirective;
  if (typeof module !== 'undefined' && module.exports) module.exports = VariationDirective;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
