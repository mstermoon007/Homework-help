/**
 * shared/generation/adapters/capability-service.adapter.js
 * 能力模型服务适配器 — 包装 capability-*.js 集群的推理逻辑
 *
 * @implements CapabilityService (services/capability-service.js)
 * 适配器不修改原模块，仅做转发。
 */
(function (global) {
  'use strict';

  // ---------- capability-* 集群获取 (Node require；browser 不起效就空运行) ----------
  function dep(name, key) {
    if (typeof window !== 'undefined' && global[key]) return global[key];
    if (typeof require === 'function') {
      try { return require(name); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function getCapabilityModel() { return dep('../../capability-model.js', 'CapabilityModel'); }
  function getCapabilityContract() { return dep('../../capability-contract.js', 'CapabilityContract'); }
  function getCapabilityMatrix() { return dep('../../capability-matrix.js', 'CapabilityMatrix'); }
  function getCapabilityResolver() { return dep('../../capability-resolver.js', 'CapabilityResolver'); }

  // ---------- CapabilityService 接口实现 (转发) ----------

  function resolveCapability(kpId, questionType, cognitiveLevel) {
    var CM = getCapabilityModel();
    var CR = getCapabilityResolver();
    if (CR && typeof CR.resolve === 'function') return CR.resolve({ kpId: kpId, questionType: questionType, cognitiveLevel: cognitiveLevel });
    if (CM && typeof CM.resolveCapability === 'function') return CM.resolveCapability({ kpId: kpId, questionType: questionType, cognitiveLevel: cognitiveLevel });
    return { kpId: kpId, questionType: questionType, cognitiveLevel: cognitiveLevel };
  }

  function buildCapabilityMatrix(kpIds, options) {
    var CMX = getCapabilityMatrix();
    var ks = kpIds || [];
    var rows = (CMX && typeof CMX.build === 'function') ? CMX.build(ks, options) : ks;
    return { rows: rows, metadata: {}, ...(options || {}) };
  }

  var Adapter = Object.freeze({
    resolveCapability: resolveCapability,
    buildCapabilityMatrix: buildCapabilityMatrix
  });

  global.CapabilityAdapter = Adapter;
  if (global.App && typeof global.App === 'object') global.App.CapabilityAdapter = Adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = Adapter;

})(typeof window !== 'undefined' ? window : global);
