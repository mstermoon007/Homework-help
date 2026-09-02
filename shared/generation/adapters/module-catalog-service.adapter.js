/**
 * shared/generation/adapters/module-catalog-service.adapter.js
 * 模块目录服务适配器 — 直接代理 module-catalog.js
 *
 * @implements ModuleCatalogService (services/module-catalog-service.js)
 * 适配器不修改原模块，仅做转发。
 */
(function (global) {
  'use strict';

  function dep(name, key) {
    if (typeof window !== 'undefined' && global[key]) return global[key];
    if (typeof require === 'function') {
      try { return require(name); } catch (e) { /* ignore */ }
    }
    return null;
  }

  function getModuleCatalog() { return dep('../../module-catalog.js', 'MODULE_CATALOG'); }

  function getAllModules() {
    var MC = getModuleCatalog();
    return (MC && MC.byId) ? (Array.isArray(MC) ? MC.slice() : []) : [];
  }

  function getModuleById(id) {
    var MC = getModuleCatalog();
    if (!MC) return null;
    return MC.byId ? MC.byId(id) : (Array.isArray(MC) ? MC.filter(function (m) { return m.id === id; })[0] || null : null);
  }

  function getModulesByType(type) {
    var MC = getModuleCatalog();
    var list = MC && MC.byId ? (Array.isArray(MC) ? MC.slice() : []) : [];
    return list.filter(function (m) { return m && m.category === type; });
  }

  var Adapter = Object.freeze({
    getAllModules: getAllModules,
    getModuleById: getModuleById,
    getModulesByType: getModulesByType
  });

  global.ModuleCatalogAdapter = Adapter;
  if (global.App && typeof global.App === 'object') global.App.ModuleCatalogAdapter = Adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = Adapter;

})(typeof window !== 'undefined' ? window : global);
