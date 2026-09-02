/**
 * shared/generation/adapters/plugin-loader-service.adapter.js
 * 插件装载服务适配器 — 包装 plugin-loader.js 的加载逻辑，并提供缓存
 *
 * @implements PluginLoaderService (services/plugin-loader-service.js)
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

  function getPluginLoader() { return dep('../../plugin-loader.js', 'PluginLoader'); }

  // 独立缓存，避免因为 PluginLoader.reset() 抹掉注册信息
  var _cache = {};

  function loadPlugin(pluginId) {
    var PL = getPluginLoader();
    if (_cache[pluginId]) return Promise.resolve(_cache[pluginId]);
    if (!PL || typeof PL.loadPlugin !== 'function') return Promise.reject(new Error('PluginLoader 不可用'));
    return PL.loadPlugin({ id: pluginId }).then(function (p) {
      _cache[pluginId] = p || { id: pluginId, name: pluginId };
      return _cache[pluginId];
    });
  }

  function isPluginLoaded(pluginId) {
    return Object.prototype.hasOwnProperty.call(_cache, pluginId);
  }

  function registerPlugin(pluginId, plugin) {
    _cache[pluginId] = plugin || { id: pluginId, name: pluginId };
    return _cache[pluginId];
  }

  var Adapter = Object.freeze({
    loadPlugin: loadPlugin,
    isPluginLoaded: isPluginLoaded,
    registerPlugin: registerPlugin
  });

  global.PluginLoaderAdapter = Adapter;
  if (global.App && typeof global.App === 'object') global.App.PluginLoaderAdapter = Adapter;
  if (typeof module !== 'undefined' && module.exports) module.exports = Adapter;

})(typeof window !== 'undefined' ? window : global);
