/**
 * shared/generation/services/plugin-loader-service.js
 * 插件装载服务接口定义 (Phase 0 Task 0.3)
 *
 * @interface PluginLoaderService
 * @module shared/generation/services/plugin-loader-service
 */

/**
 * @typedef {Object} PluginInfo
 * @property {string} id - 插件 ID
 * @property {string} name - 插件名
 * @property {string} [version] - 版本号
 * @property {Function} [generate] - 生成函数 (request) => Promise<questions>
 */

/**
 * @interface PluginLoaderService
 */
var PluginLoaderService = {
  /**
   * 装载插件 (从 registry/legacy 加载并注册)
   * @param {string} pluginId - 插件 ID
   * @returns {PluginInfo} 插件对象
   */
  loadPlugin: function (pluginId) {},

  /**
   * 判断插件是否已装载
   * @param {string} pluginId - 插件 ID
   * @returns {boolean}
   */
  isPluginLoaded: function (pluginId) {},

  /**
   * 直接注册插件实例 (绕过加载，用于本地测试或动态注入)
   * @param {string} pluginId - 插件 ID
   * @param {PluginInfo} plugin - 插件对象
   * @returns {PluginInfo} 注册结果
   */
  registerPlugin: function (pluginId, plugin) {}
};

if (typeof module !== 'undefined' && module.exports) module.exports = PluginLoaderService;
