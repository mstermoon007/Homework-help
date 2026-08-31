/**
 * shared/legacy/legacy-plugin-adapter.js — Legacy 适配器（M0-08）
 *
 * 职责（仅接口 + 最小实现，不改变当前线上生成入口）：
 *   定义「标准化 QuestionPlan → Legacy options → Legacy Plugin」的转换契约，
 *   为后续 Knowledge Ontology → Strategy Engine → Generator 架构升级预留适配层。
 *
 *   M0 阶段：本模块不被 practice.html 引用，默认不接管线上流程；仅由 M0 验证/后续
 *   Strategy 集成调用。它只是把结构化 Plan 翻译为 Legacy 插件 generate(options)
 *   所能消费的 options，并安全地调用该插件。
 *
 * 标准化 QuestionPlan（后续 Strategy Engine 的输出契约）：
 *   {
 *     subject:   'math'|'chinese'|'english',
 *     grade:      number,
 *     pluginId:   string,                 // 目标 Legacy 插件 id（对应 registry）
 *     type:       string|'',              // 子题型（传给 opts.type）
 *     subtype:    string|'',              // 子子题型（传给 opts.subtype）
 *     count:      number,                 // 题量
 *     difficulty: number,                 // 1-10 基础难度
 *     difficultyParams: Object|null,      // 已由难度引擎算好的参数（原样透传）
 *     knowledgePointId: string|null       // 知识点 id（透传，便于插件溯源）
 *   }
 *
 * 约束：
 *   - 不修改任何现有插件的 generate 行为；只做参数映射与转发。
 *   - 全程不使用 Math.random（随机性由 Legacy 插件内部 crypto 随机源负责）。
 */
(function (global) {
  'use strict';

  /**
   * 将标准化 QuestionPlan 映射为 Legacy 插件 generate(options) 所需的 options 对象。
   * 仅透传 Legacy 插件已知字段；不新增任何 Legacy 不识别的业务语义。
   * @param {Object} plan
   * @returns {Object} legacy options
   */
  function toLegacyOptions(plan) {
    plan = plan || {};
    var opts = {};
    if (plan.grade != null) opts.grade = plan.grade;
    if (plan.type != null && plan.type !== '') opts.type = plan.type;
    if (plan.subtype != null && plan.subtype !== '') opts.subtype = plan.subtype;
    if (plan.count != null) opts.count = plan.count;
    if (plan.difficulty != null) opts.difficulty = plan.difficulty;
    if (plan.knowledgePointId != null) opts.knowledgePointId = plan.knowledgePointId;
    // difficultyParams 原样透传（createPlugin 的 _wrapDifficultyParams 会按需消费）
    if (plan.difficultyParams != null) opts.difficultyParams = plan.difficultyParams;
    return opts;
  }

  /**
   * 运行：给定 Plan 与已加载的 Legacy 插件对象，调用其 generate。
   * 兼容综合练习等返回 Promise 的异步插件。
   * @param {Object} plan
   * @param {Object} plugin 已加载的 Legacy 插件（含 generate）
   * @returns {Promise<{questions:Array, meta:Object}>}
   */
  function runPlan(plan, plugin) {
    if (!plugin || typeof plugin.generate !== 'function') {
      return Promise.reject(new Error('legacy-plugin-adapter: 插件无 generate 接口（pluginId=' +
        (plan && plan.pluginId) + '）'));
    }
    var opts = toLegacyOptions(plan);
    var res = plugin.generate(opts);
    if (res && typeof res.then === 'function') return res;
    return Promise.resolve(res);
  }

  /**
   * 便捷工厂：用 registry 条目 + Plan 构造一个 Legacy 生成器闭包。
   * 该闭包接收 Plan，透过 toLegacyOptions 调用 plugin.generate（不缓存、无副作用）。
   * @param {Object} plugin Legacy 插件对象
   * @returns {function(plan):Promise}
   */
  function makeLegacyGenerator(plugin) {
    return function (plan) { return runPlan(plan, plugin); };
  }

  var API = {
    toLegacyOptions: toLegacyOptions,
    runPlan: runPlan,
    makeLegacyGenerator: makeLegacyGenerator
  };

  global.LegacyPluginAdapter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
