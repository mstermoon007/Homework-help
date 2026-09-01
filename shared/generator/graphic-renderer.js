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
    'chinese': { module: 'svg-chinese', label: '汉字书写' },
    'english': { module: 'svg-english', label: '英语字母' },
    'core': { module: 'svg-core', label: '基础 SVG 原语' },
    'custom': { module: 'svg-legacy', label: '既有 SVG 透传' },
    'illustration': { module: 'svg-legacy', label: '既有 SVG 透传' }
  };

  /**
   * 解析 graphic 描述 → 渲染器元信息。
   * @param {Object} graphic { type, subtype, params }
   * @returns {Object|null} { type, subtype, params, renderer: 'svg-xxx', label }
   */
  function resolveGraphicRenderer(graphic) {
    if (!graphic || typeof graphic.type !== 'string') return null;
    var entry = GRAPHIC_RENDERERS[graphic.type];
    if (!entry) return null;
    return {
      type: graphic.type,
      subtype: graphic.subtype || null,
      params: graphic.params || {},
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

  /**
   * 实际底层 SVG 引擎：浏览器取 global.SVGRenderer（svg-registry 挂载），
   * Node 回退 require('./../presentation/svg-registry.js')。
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
   * 运行时派发：归一化 graphic 并委托底层 SVG Renderer 产出 <svg> 字符串。
   * 无法渲染（无描述 / 类型不支持 / 引擎缺失）返回 ''。
   * @param {Object} graphic { type, subtype, params }
   * @param {Object} [options] renderOptions（透传，不微调）
   * @returns {string}
   */
  function render(graphic, options) {
    if (!graphic || typeof graphic !== 'object' || typeof graphic.type !== 'string') return '';
    var engine = getSVGEngine();
    if (!engine) return '';
    return engine.render(graphic, options) || '';
  }

  var API = {
    GRAPHIC_RENDERERS: GRAPHIC_RENDERERS,
    resolveGraphicRenderer: resolveGraphicRenderer,
    isSupported: isSupported,
    render: render
  };

  global.GraphicRenderer = API;
  if (global.App && typeof global.App === 'object') global.App.GraphicRenderer = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);
