/**
 * shared/generation/services/module-catalog-service.js
 * 模块目录服务接口定义 (Phase 0 Task 0.3)
 *
 * @interface ModuleCatalogService
 * @module shared/generation/services/module-catalog-service
 */

/**
 * @typedef {Object} CatalogModuleEntry
 * @typedef {Object} CatalogEntry
 */

/**
 * @interface ModuleCatalogService
 */
var ModuleCatalogService = {
  /**
   * 获取全部模块目录
   * @returns {Array<CatalogEntry>} 模块列表 {id, name, type, grade, ...}
   */
  getAllModules: function () {},

  /**
   * 按 ID 查询模块
   * @param {string} id - 模块 ID
   * @returns {CatalogEntry|null} 模块或 null
   */
  getModuleById: function (id) {},

  /**
   * 按类型过滤模块 (如 number/geometry/application)
   * @param {string} type - 模块类型
   * @returns {Array<CatalogEntry>} 模块列表
   */
  getModulesByType: function (type) {}
};

if (typeof module !== 'undefined' && module.exports) module.exports = ModuleCatalogService;
