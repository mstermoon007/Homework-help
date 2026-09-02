/**
 * shared/generation/services/knowledge-graph-service.js
 * 知识图谱服务接口定义 (Phase 0 Task 0.3)
 *
 * @interface KnowledgeGraphService
 * @module shared/generation/services/knowledge-graph-service
 */

/**
 * @typedef {Object} KnowledgePoint
 * @property {string} id - 知识点 ID
 * @property {string} name - 知识点名称
 * @property {string} moduleId - 所属模块 ID
 * @property {Array<Object>} [skills] - 关联技能列表
 * @property {number} [grade] - 年级
 * @property {string} [subject] - 学科
 */

/**
 * @typedef {Object} ModuleInfo
 * @property {string} id - 模块 ID
 * @property {string} name - 模块名
 * @property {string} type - 模块类型 (如 'number','geometry','application' 等)
 * @property {Array<Object>} [knowledgePoints] - 模块内知识点列表
 */

/**
 * @typedef {Object} QuestionType
 * @property {string} id - 题型 ID
 * @property {string} name - 题型名
 * @property {string} label - 中文标签
 * @property {Array<string>} [subtypes] - 子题型标识
 */

/**
 * @interface KnowledgeGraphService
 */
var KnowledgeGraphService = {
  /**
   * 按 ID 查询知识点详情
   * @param {string} kpId - 知识点 ID
   * @returns {KnowledgePoint|null} 知识点或 null
   */
  getKnowledgePoint: function (kpId) {},

  /**
   * 按 ID 查询模块详情
   * @param {string} moduleId - 模块 ID
   * @returns {ModuleInfo|null} 模块或 null
   */
  getModule: function (moduleId) {},

  /**
   * 按知识点 ID 返回可用题型列表
   * @param {string} kpId - 知识点 ID
   * @returns {Array<QuestionType>} 题型列表
   */
  getQuestionTypesForKP: function (kpId) {},

  /**
   * 按模块 ID 返回该模块下全部可用题型
   * @param {string} moduleId - 模块 ID
   * @returns {Array<QuestionType>} 题型列表
   */
  getModuleQuestionTypes: function (moduleId) {},

  /**
   * 构建练习页跳转链接 (用于知识图谱层衔接)
   * @param {string} kpId - 知识点 ID
   * @returns {string} 练习页链接 (HTML/路由)
   */
  buildPracticeLink: function (kpId) {},

  /**
   * 渲染知识模块卡片 HTML
   * @param {string} moduleId - 模块 ID
   * @returns {string} 卡片 HTML 片段
   */
  renderModuleCard: function (moduleId) {}
};

if (typeof module !== 'undefined' && module.exports) module.exports = KnowledgeGraphService;
