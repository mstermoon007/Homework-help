/**
 * shared/generator/graphic-renderer.js — M4-R11 GraphicRenderer（图形能力剥离 / 派发门面）
 *
 * Generator 只输出结构化图形描述 graphic: { type, subtype, params }；
 * 运行时 SVG 生成经本门面（GraphicRenderer）统一派发，再委托给 M7 的
 * SVG Renderer（shared/presentation/svg-registry.js，即 global.SVGRenderer）产出 <svg>。
 *
 * 派发链：GraphicRenderer.render(graphic, options)
 *            → SVGRenderer.render(graphic, options)（svg-registry，冻结底层引擎）
 *
 * 本模块是注册表/门面：根据 graphic.type 选定语义渲染器并归一化，
 * 自身不拼接 SVG 字符串、不接触 DOM。既可作为独立 Node 白名单
 * （isSupported / resolveGraphicRenderer），也可在浏览器端作为界面门面挂载。
 *
 * 渲染器语义类型命名约定：shared/svg-*.js（现有浏览器端 SVG 模块），
 * 以 shared/presentation/svg-registry.js 的语义类型表为准（含 makeTen/make-ten 双名）。
 */
(function (global) {
  'use strict';

  // P30-22：graphic.role 枚举——图形必须回答「为什么需要这个图」。
  // 取值与 kbl/teaching qt-intent.assessment.graphicRole 对齐；
  // Generator 依据 Intent 设定，缺省按 graphic.type 映射（见 GRAPHIC_TYPE_ROLES）。
  var GRAPHIC_ROLES = {
    'quantity-correspondence': true,  // 数量对应（如数图形个数、人民币计数）
    'number-position': true,          // 数与位置（钟表、数轴、方位）
    'angle-measure': true,            // 角度度量
    'fraction-part': true,            // 分数份数
    'area-measure': true,             // 面积度量
    'data-comparison': true,          // 数据比较（统计图表）
    'calculation-support': true,      // 计算辅助（竖式、凑十、线段图）
    'auxiliary': true,                // 辅助载体（非核心语义，如涂色/认识图形）
    null: true                        // 无需配图
  };

  // graphic.type → 默认 role（Generator 未显式设定 role 时使用）
  var GRAPHIC_TYPE_ROLES = {
    'geometry': 'quantity-correspondence',
    'calculation': 'calculation-support',
    'make-ten': 'calculation-support',
    'makeTen': 'calculation-support',
    'clock': 'number-position',
    'area': 'area-measure',
    'fraction': 'fraction-part',
    'dataStats': 'data-comparison',
    'draw': 'auxiliary',
    'competition': 'auxiliary',
    'chart': 'data-comparison',
    'diagram': 'calculation-support',
    'currency': 'quantity-correspondence',
    'core': null,
    'custom': 'auxiliary',
    'illustration': 'auxiliary'
  };

  // graphic.type → SVG 渲染器（语义类型，与 svg-registry SUBJECT_TO_TYPE 对齐）
  var GRAPHIC_RENDERERS = {
    'calculation': { module: 'svg-calculation', label: '四则运算竖式' },
    'geometry': { module: 'svg-geometry', label: '几何图形' },
    'make-ten': { module: 'svg-make-ten', label: '凑十法' },
    'makeTen': { module: 'svg-make-ten', label: '凑十法' },
    'clock': { module: 'svg-clock', label: '钟表' },
    'area': { module: 'svg-area', label: '面积' },
    'fraction': { module: 'svg-fraction', label: '分数' },
    'dataStats': { module: 'svg-datastats', label: '数据统计' },
    'draw': { module: 'svg-draw', label: '作图' },
    'competition': { module: 'svg-competition', label: '竞赛' },
    'chart': { module: 'svg-chart', label: '统计图表' },
    'diagram': { module: 'svg-diagram', label: '示意图' },
    'currency': { module: 'svg-currency', label: '人民币' },
    'core': { module: 'svg-core', label: '基础 SVG 原语' },
    'custom': { module: 'svg-legacy', label: '既有 SVG 透传' },
    'illustration': { module: 'svg-legacy', label: '既有 SVG 透传' }
  };

  /**
   * 解析 graphic 描述 → 渲染器元信息。
   * P30-22：输出含 role（显式 graphic.role 优先，否则按 type 默认映射）。
   * @param {Object} graphic { type, subtype, params, role? }
   * @returns {Object|null} { type, subtype, params, role, renderer, label }
   */
  function resolveGraphicRenderer(graphic) {
    if (!graphic || typeof graphic.type !== 'string') return null;
    var entry = GRAPHIC_RENDERERS[graphic.type];
    if (!entry) return null;
    var role = graphic.role != null ? graphic.role : (GRAPHIC_TYPE_ROLES[graphic.type] || null);
    return {
      type: graphic.type,
      subtype: graphic.subtype || null,
      params: graphic.params || {},
      role: role,
      renderer: entry.module,
      label: entry.label
    };
  }

  function isSupported(type) {
    if (!type || typeof type !== 'string') return false;
    if (GRAPHIC_RENDERERS[type]) return true;
    // makeTen / make-ten 同源映射
    if (type === 'makeTen' || type === 'make-ten') return true;
    return false;
  }

  // P30-22：role 合法性校验
  function isValidRole(role) {
    return role === null || role === undefined || GRAPHIC_ROLES.hasOwnProperty(role);
  }

  // P30-23：从 Intent 派生 role（plan.semanticParams.graphic.role），
  // 无 intent 时按 graphic.type 取默认。
  function resolveRoleFromIntent(plan, graphicType) {
    var intentRole = plan && plan.semanticParams && plan.semanticParams.graphic
      ? plan.semanticParams.graphic.role : null;
    if (intentRole != null && GRAPHIC_ROLES.hasOwnProperty(intentRole)) return intentRole;
    return GRAPHIC_TYPE_ROLES[graphicType] || null;
  }

  /**
   * 实际底层 SVG 引擎：浏览器取 global.SVGRenderer（svg-registry 挂载），
   * Node 回退 require('../presentation/svg-registry.js')。
   */
  function getSVGEngine() {
    var c = global && global.SVGRenderer;
    if (c && typeof c.render === 'function') return c;
    try {
      return require('../presentation/svg-registry.js');
    } catch (e) {
      return null;
    }
  }

  /**
   * 运行时派发：归一化 graphic 并委托底层 SVG Renderer 产出 RenderResult。
   * 返回标准契约：{ status: 'SUCCESS'|'UNSUPPORTED'|'FAILED', svg?, reason?, error? }
   * @param {Object} graphic { type, subtype, params }
   * @param {Object} [options] renderOptions（透传，不微调）
   * @returns {Object}
   */
  function render(graphic, options) {
    if (!graphic || typeof graphic !== 'object' || typeof graphic.type !== 'string') {
      return { status: 'UNSUPPORTED', reason: 'Invalid graphic descriptor' };
    }
    var engine = getSVGEngine();
    if (!engine) {
      return { status: 'FAILED', reason: 'SVG engine not available' };
    }
    return engine.render(graphic, options);
  }

  var API = {
    GRAPHIC_RENDERERS: GRAPHIC_RENDERERS,
    GRAPHIC_ROLES: GRAPHIC_ROLES,
    GRAPHIC_TYPE_ROLES: GRAPHIC_TYPE_ROLES,
    resolveGraphicRenderer: resolveGraphicRenderer,
    isSupported: isSupported,
    isValidRole: isValidRole,
    resolveRoleFromIntent: resolveRoleFromIntent,
    render: render
  };

  global.GraphicRenderer = API;
  if (global.App && typeof global.App === 'object') global.App.GraphicRenderer = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
