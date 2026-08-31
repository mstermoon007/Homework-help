/**
 * shared/legacy/plugin-adapter.js — M7-R18 旧插件唯一桥接层
 *
 * 全系统唯一允许触碰「旧 Plugin」的边界：
 *
 *   GenerationEngine
 *        ↓
 *   LegacyPluginAdapter（本模块）
 *        ↓
 *   旧 Plugin（plugin.generate / plugin.render）
 *
 * 禁止（R18）：
 *   - UI 直接调用旧 Plugin
 *   - Strategy 直接调用旧 Plugin（只认 capability）
 *   - Renderer 直接调用旧 Plugin
 *
 * 本模块职责：
 *   - 加载已装载的插件对象（浏览器缓存在全局；Node 经 dev/plugin-loader）
 *   - 以统一 Promise 包装 plugin.generate → exerciseSet
 *   - 提供 plugin.render 的桥（供 GenerationEngine.renderLegacySet 使用）
 *   - 复用 M4-R02 createLegacyGenerator（实现保留在 shared/generator/legacy-plugin-adapter.js，
 *     本模块为获得该能力的唯一路径）
 *
 * R19 扫描：全仓库的 plugin.generate / plugin.render 仅允许出现在
 *   shared/legacy/plugin-adapter.js（与 shared/generator/legacy-plugin-adapter.js 实现）。
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';
  var cache = {};

  /**
   * 取插件对象。优先走已装载缓存（浏览器端插件由 boot/PluginLoader 预先装入）：
   *   ① 本模块缓存 ② window.__mathSubPlugins / __currentPlugin ③ Node dev/plugin-loader
   * 返回 plugin 或 null。浏览器端未命中时返回 null（调用方应传入已装载的插件）。
   */
  function loadPlugin(id) {
    if (!id) return null;
    if (cache[id]) return cache[id];
    var found = null;
    if (isBrowser) {
      // 浏览器端插件对象已在启动时装载（App.PluginLoader 脚本机制），此处只在全局缓存中查找
      if (global.__mathSubPlugins && global.__mathSubPlugins[id]) found = global.__mathSubPlugins[id];
      else if (global.__currentPlugin && global.__currentPlugin.id === id) found = global.__currentPlugin;
      else if (global.App && global.App.plugins && global.App.plugins[id]) found = global.App.plugins[id];
    } else {
      try {
        var loader = require('../../dev/plugin-loader.js');
        var entry = loader.loadPlugin(id);
        found = entry && !entry.error ? entry.plugin : null;
      } catch (e) { /* 插件不可用时返回 null，由调用方处理 */ }
    }
    if (found) cache[id] = found;
    return found || null;
  }

  /** 预置/登记插件对象（幂等）。 */
  function setPlugin(id, plugin) {
    if (id && plugin) cache[id] = plugin;
    return plugin;
  }

  /**
   * 统一生成入口：plugin.generate(options) 的 Promise 包装。
   * （UI 经 GenerationEngine.generateLegacy → 本函数到达旧插件）
   * @returns {Promise<{ questions:Array, meta:Object }>} 原始 exerciseSet
   */
  function generateByPluginId(pluginId, options) {
    return Promise.resolve().then(function () {
      var plugin = loadPlugin(pluginId);
      if (!plugin || typeof plugin.generate !== 'function') {
        throw new Error('Legacy 插件不可用或未装载: ' + pluginId);
      }
      var set = plugin.generate(options || {});
      return (set && typeof set.then === 'function') ? set : Promise.resolve(set);
    });
  }

  /**
   * 渲染桥：plugin.render(exerciseSet) → html（供 GenerationEngine.renderLegacySet）。
   * 插件未提供 render 时返回 null，由上层走通用降级。
   */
  function renderSet(set, pluginId) {
    var plugin = loadPlugin(pluginId);
    if (!plugin || typeof plugin.render !== 'function') return null;
    try {
      return plugin.render(set);
    } catch (e) {
      return null;
    }
  }

  /**
   * 实例化 legacy 纪录：plugin（可注入，缺省时自装载）→ GeneratorContract。
   * 供 GeneratorSelector.instantiate 的唯一 legacy 入口（R18：Selector 也不再直接 loader）。
   */
  function hydrateLegacyGenerator(selection, plugin) {
    if (!selection || !selection.record) return null;
    if (!plugin) {
      var pid = selection.record.pluginId;
      if (!pid && typeof selection.record.id === 'string' && selection.record.id.indexOf('legacy:') === 0) {
        pid = selection.record.id.slice('legacy:'.length);
      }
      plugin = loadPlugin(pid);
    }
    if (!plugin) return null;
    var GenAdapter = require('../generator/legacy-plugin-adapter.js');
    return GenAdapter.createLegacyGenerator(plugin, {
      capabilities: selection.record.capabilities,
      knowledgePoints: selection.record.knowledgePoints
    });
  }

  var API = {
    loadPlugin: loadPlugin,
    setPlugin: setPlugin,
    generateByPluginId: generateByPluginId,
    renderSet: renderSet,
    hydrateLegacyGenerator: hydrateLegacyGenerator,
    createLegacyGenerator: function (plugin, meta) {
      return require('../generator/legacy-plugin-adapter.js').createLegacyGenerator(plugin, meta);
    }
  };

  global.LegacyPluginAdapter = API;
  if (global.App && typeof global.App === 'object') global.App.LegacyPluginAdapter = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);