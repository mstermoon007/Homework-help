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
 * 加载方式（有意为之，同 kp-semantic-validator.js evidence-rules 先例）：
 *   require 路径用字符串拼接计算，打包器静态正则不会把 kbl/ 数据内联进 bundle
 *   （check-kbl-uniqueness 门禁）。Node 直载正常读取；浏览器运行时 __req 未注册
 *   该 id，抛错被捕获 → overlay=null → 指令为空（fail-open，行为与现状一致；
 *   易错点门禁的完整链路由 Node 测试与 dev 门禁覆盖）。
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

  var _overlay = null;
  var _overlayLoaded = false;

  function getOverlay() {
    if (_overlayLoaded) return _overlay;
    _overlayLoaded = true;
    try {
      var p = '../../' + 'kbl/' + 'teaching/' + 'misconception-profiles.json';
      var doc = require(p);
      if (doc && doc.kps && typeof doc.kps === 'object') _overlay = doc;
    } catch (e) { /* 浏览器 bundle：kbl/ 数据不打包 → 无指令 */ }
    return _overlay;
  }

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
   *   kpId            : string   （KP，overlay 键）
   *   errorTypes      : string[] （错因聚焦，来自 adaptive errorFocus / learner getErrors）
   *   questionTypeId  : string   （canonical 题型）
   *   operationTokens?: string[]|string（计划运算 token，符号/标签混排均可）
   * }
   * @returns {Array<{errorType:string, variant:string, axis:string, basis:string}>}
   */
  function resolveForPlan(opts) {
    var overlay = getOverlay();
    if (!overlay || !opts || !opts.kpId) return [];
    if (!Array.isArray(opts.errorTypes) || !opts.errorTypes.length) return [];
    var entry = overlay.kps[opts.kpId];
    if (!entry || !Array.isArray(entry.slots)) return [];
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
    getOverlay: getOverlay,
    CHAIN_SEGMENTS: CHAIN_SEGMENTS
  };

  global.VariationDirective = VariationDirective;
  if (typeof module !== 'undefined' && module.exports) module.exports = VariationDirective;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
