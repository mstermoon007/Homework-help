/**
 * shared/generation/services/capability-service.js
 * 能力模型服务接口定义 (Phase 0 Task 0.3)
 *
 * @interface CapabilityService
 * @module shared/generation/services/capability-service
 */

/**
 * @typedef {Object} CapabilityMatrix
 * @property {Array<Object>} rows - 矩阵每行 {knowledgePointId, ability, level}
 * @property {Object} [metadata] - 元数据 {source, version, generatedAt}
 */

/**
 * @interface CapabilityService
 */
var CapabilityService = {
  /**
   * 按知识点/题型/认知层级解析能力要求 (用于生成难度/能力匹配)
   * @param {string} kpId - 知识点 ID
   * @param {string} questionType - 题型
   * @param {string} cognitiveLevel - 认知层级: 'recognize'|'understand'|'apply'
   * @returns {Object} 能力解析结果 {ability, difficultyBand, focusPoints, ...}
   */
  resolveCapability: function (kpId, questionType, cognitiveLevel) {},

  /**
   * 批量构建多个知识点的能力矩阵
   * @param {Array<string>} kpIds - 知识点 ID 列表
   * @param {Object} [options] - { levelOverride, sortBy }
   * @returns {CapabilityMatrix} 能力矩阵
   */
  buildCapabilityMatrix: function (kpIds, options) {}
};

if (typeof module !== 'undefined' && module.exports) module.exports = CapabilityService;
