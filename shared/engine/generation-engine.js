/**
 * shared/engine/generation-engine.js — 生成层引擎门面（P0-13 冻结期清理版）
 *
 * GAP-4 收口：规划（build）与执行（runPlans）唯一实现收敛于 shared/generation/api.js，
 * 本模块不再持有第二套规划/执行实现。
 *
 * P0-13 Step 15 清理记录（全项目引用统计后删除，均为零调用生产死代码）：
 *   删除导出 generateBudget / generateSync / validatePlan / render / generateAndRender /
 *   resolveGenerator / pipeline / assertGenerationBoundary / rng / canonicalKey
 *   及其死辅助（PIPELINE / getPresentation / getGeneratorRegistry / requireOrGlobal /
 *   _boundaryEnabled / _boundaryLog）。
 *   保留 generate：practice-session.js 浏览器兜底链（global.GenerationEngine → .generate）
 *   的唯一消费入口；页面真实主链为 global.GenerationAPI（api.js）。
 *
 * 生产链（冻结）：
 *   PracticeSession → GenerationAPI.generate → POL.orchestrate → executeInline(build → runPlans)
 *   → PresentationEngine(Selector → Generator → Validator) → PresentationRenderer
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';

  function ensure(kind, key, rel) {
    if (isBrowser && global[key]) return global[key];
    if (typeof require !== 'function') return null;
    try { return require(rel); } catch (e) { /* ignore */ }
    return null;
  }

  // 委托给 GenerationAPI（生成执行唯一门面）
  var GenerationAPI = ensure(null, 'GenerationAPI', '../generation/api.js');

  /**
   * 生成（主链出口）—— 纯委托 GenerationAPI.generate（GAP-4：唯一执行体在 api.js）。
   * @param {Object} request GenerationRequest
   * @param {Object} [options] { renderOptions, columns, skipValidation }
   * @returns {Promise<{ questions, items, html, plans, trace, renderOptions }>}
   */
  function generate(request, options) {
    if (GenerationAPI && typeof GenerationAPI.generate === 'function') {
      return GenerationAPI.generate(request, options);
    }
    throw new Error('GenerationAPI.generate 不可用（GAP-4：生成执行唯一入口为 shared/generation/api.js）');
  }

  var API = {
    // P0-13 冻结期清理：唯一保留的执行入口（generate）。规划/执行实现见 shared/generation/api.js。
    generate: generate
  };

  global.GenerationEngine = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationEngine = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
