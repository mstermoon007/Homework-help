/**
 * shared/capability/knowledge-capability-view.js — 能力判定视图（P0-03）
 *
 * 编排层「能力（Capability）≠ 容量（Capacity）」的判定来源：
 *   - Capability = 该 (KP × QuestionType) 组合是否具备「可生成」资格（能力侧）
 *   - Capacity   = 该组合当前可稳定产出的题量上限（容量侧，见 capacity-inventory）
 *   Capability=0 绝不等于 Capacity=0；可行性只由 Capability 决定，容量仅作预算封顶。
 *
 * 判定（纯函数，确定性）：
 *   buildEligibility(kpIds, questionTypes) -> {
 *     matrix             { kpId: { qt: decision } }
 *     eligibleKpsForType { qt: [kpId] }
 *     skip               { kpId: [qt] }   // FORBID / MISSING / (已知 KP 的) INVALID
 *     resolvable         boolean          // CapabilityResolver 是否可用
 *   }
 *
 * 降级规则（与 R4「浏览器无 fs → 容量 Infinity，由 recovery 兜底」同理）：
 *   - resolver 不可用（浏览器未加载 / require 抛错）→ 全量可生成（乐观回调，由编排 recovery 兜底）
 *   - KP 在知识库中不存在（legacy 深链 / 测试 mock）→ 可生成（不因缺数据阻断）
 *   - 已知 KP + FORBID / MISSING → 不可生成，记入 skip（供编排账本 capabilitySkips 审计）
 *   - 已知 KP + DEGRADE → 该 (KP,类型) 存在但不完整能力，仍可生成（不自动升级，亦不丢弃）
 *
 * 浏览器 / CommonJS 双入口：挂载 global.KnowledgeCapabilityView 与 module.exports。
 *
 * @module shared/capability/knowledge-capability-view
 */
(function (global) {
  'use strict';

  function getResolver() {
    try { return require('./capability-resolver.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.CapabilityResolver) ? global.CapabilityResolver : null;
  }

  function getKnowledgePoint() {
    try { return require('../knowledge/knowledge-point.js'); } catch (e) {}
    return (typeof global !== 'undefined' && global.KnowledgePoint) ? global.KnowledgePoint : null;
  }

  function isEligible(decision) {
    return decision === 'ALLOW' || decision === 'DEGRADE';
  }

  /**
   * 构建 (KP × QuestionType) 能力判定矩阵。
   * @param {string[]} kpIds
   * @param {string[]} questionTypes  输入应已通过 RequestNormalize 归一化为 canonical ID
   * @returns {Object}
   */
  function buildEligibility(kpIds, questionTypes) {
    var Resolver = getResolver();
    var KP = getKnowledgePoint();
    var kps = Array.isArray(kpIds) ? kpIds.slice() : [];
    var qts = Array.isArray(questionTypes) ? questionTypes.slice() : [];

    if (!Resolver) {
      var permissive = {};
      kps.forEach(function (kp) {
        permissive[kp] = {};
        qts.forEach(function (qt) { permissive[kp][qt] = 'ALLOW'; });
      });
      var allKpsFor = {};
      qts.forEach(function (qt) { allKpsFor[qt] = kps.slice(); });
      return { matrix: permissive, eligibleKpsForType: allKpsFor, skip: {}, resolvable: false };
    }

    var matrix = {};
    var eligibleKpsForType = {};
    var allowedKpsForType = {};
    var skip = {};
    var $allow = {}, $degrade = {};

    kps.forEach(function (kp) {
      var row = {};
      var legacy = (KP && typeof KP.findLegacy === 'function') ? KP.findLegacy(kp) : null;
      qts.forEach(function (qt) {
        var decision;
        if (!legacy) {
          decision = 'ALLOW'; // 未知 KP：乐观可生成，由 recovery 兜底
        } else {
          try {
            var r = Resolver.resolveFinal({ knowledgePointId: kp, questionType: qt });
            decision = (r && r.decision) ? r.decision : 'MISSING';
          } catch (e) {
            decision = 'ALLOW'; // 解析异常不阻断（乐观）
          }
        }
        row[qt] = decision;
        if (decision === 'ALLOW') {
          if (!$allow[qt]) $allow[qt] = [];
          if ($allow[qt].indexOf(kp) === -1) $allow[qt].push(kp);
        } else if (decision === 'DEGRADE') {
          if (!$degrade[qt]) $degrade[qt] = [];
          if ($degrade[qt].indexOf(kp) === -1) $degrade[qt].push(kp);
        } else {
          if (!skip[kp]) skip[kp] = [];
          if (skip[kp].indexOf(qt) === -1) skip[kp].push(qt);
        }
      });
      matrix[kp] = row;
    });

    qts.forEach(function (qt) {
      // 按决策强度排序：ALLOW（强）在前，DEGRADE（弱）在后——
      // 供 KP×题型 预算均匀分摊时优先落在「真正支持该题型」的 KP（§24 二维预算）。
      allowedKpsForType[qt] = ($allow[qt] || []).slice();
      eligibleKpsForType[qt] = ($allow[qt] || []).concat($degrade[qt] || []);
    });

    return { matrix: matrix, eligibleKpsForType: eligibleKpsForType, allowedKpsForType: allowedKpsForType, skip: skip, resolvable: true };
  }

  /**
   * 过滤出「可生成的题型」（按能力判定，非容量）。
   * @param {Object} eligibility buildEligibility 结果
   * @param {string[]} questionTypes 候选题型
   * @param {string[]} [kpIds] 限定 KP（默认取 eligibility 全量 KP）
   * @returns {string[]}
   */
  function eligibleTypes(eligibility, questionTypes, kpIds) {
    var e = eligibility || {};
    var kps = Array.isArray(kpIds) && kpIds.length ? kpIds.slice() : Object.keys(e.matrix || {});
    var out = [];
    (questionTypes || []).forEach(function (qt) {
      var ok = kps.some(function (kp) {
        var row = (e.matrix || {})[kp];
        return row && isEligible(row[qt]);
      });
      if (ok && out.indexOf(qt) === -1) out.push(qt);
    });
    return out;
  }

  var API = {
    buildEligibility: buildEligibility,
    eligibleTypes: eligibleTypes,
    isEligible: isEligible
  };

  global.KnowledgeCapabilityView = API;
  if (global.App && typeof global.App === 'object') global.App.KnowledgeCapabilityView = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));