/**
 * shared/generator/graphic-renderer.js — M4-R11 GraphicRenderer（图形能力剥离）
 *
 * Generator 只输出结构化图形描述 graphic: { type, subtype, params }；
 * SVG 生成全部收敛到 GraphicRenderer → SVG Generator 管线。
 *
 * 本模块是纯注册表/调度：根据 graphic.type 选择对应 SVG 渲染器，
 * 自身不拼接 SVG 字符串、不接触 DOM。
 *
 * 渲染器命名约定：shared/svg-*.js（现有浏览器端 SVG 模块）。
 */
'use strict';

// graphic.type → SVG 渲染器（现有 shared/svg-*.js 模块）
var GRAPHIC_RENDERERS = {
  'calculation': { module: 'svg-calculation', label: '四则运算竖式' },
  'geometry': { module: 'svg-geometry', label: '几何图形' },
  'make-ten': { module: 'svg-make-ten', label: '凑十法' },
  'chinese': { module: 'svg-chinese', label: '汉字书写' },
  'english': { module: 'svg-english', label: '英语字母' },
  'core': { module: 'svg-core', label: '基础 SVG 原语' }
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
  return GRAPHIC_RENDERERS[type] != null;
}

module.exports = {
  GRAPHIC_RENDERERS: GRAPHIC_RENDERERS,
  resolveGraphicRenderer: resolveGraphicRenderer,
  isSupported: isSupported
};
