/**
 * shared/presentation/legacy-svg-adapter.js — M7-R04 Legacy SVG Adapter
 *
 * 旧链路上 SVG 由插件生成并直接塞进题目对象 q.svg；
 * 新链路要求「SVG 只由 Renderer 产出」，SemanticQuestion 不保存最终 SVG 字符串，
 * 图形以描述符 graphic = { type, subtype, params } 存在。
 *
 * 本适配器把遗留形态（q.svg 字符串 / q.graphic 对象）规范成统一 graphic 描述符，
 * 使 PresentationRenderer 能把旧题直接搬上新渲染管线。
 *
 * 规则：
 *   - 已是指南符对象（{type,...}）→ 原样返回；
 *   - q.svg 为字符串 → { type:'custom', subtype:null, params:{ rawSvg } }；
 *   - 都无 → null（无图形，渲染层跳过）。
 */
(function (global) {
  'use strict';

  function isDescriptor(v) {
    return v != null && typeof v === 'object' && typeof v.type === 'string';
  }

  /**
   * 把单题可能携带的图形信息统一为 graphic 描述符。
   * @param {Object} question SemanticQuestion 或 Legacy Question
   * @returns {Object|null} { type, subtype, params }；无图时返回 null
   */
  function toGraphic(question) {
    if (!question || typeof question !== 'object') return null;

    if (isDescriptor(question.graphic)) {
      return {
        type: question.graphic.type,
        subtype: question.graphic.subtype != null ? question.graphic.subtype : null,
        params: question.graphic.params || {}
      };
    }
    if (typeof question.svg === 'string' && question.svg.trim().length > 0) {
      return { type: 'custom', subtype: null, params: { rawSvg: question.svg } };
    }
    if (typeof question.illustration === 'string' && question.illustration.trim().length > 0) {
      return { type: 'custom', subtype: null, params: { rawSvg: question.illustration } };
    }
    return null;
  }

  /**
   * M7-R04 命名入口：question → 统一 graphic（供外部显式调用）。
   */
  function convert(question) {
    return toGraphic(question);
  }

  var API = {
    convert: convert,
    toGraphic: toGraphic,
    isDescriptor: isDescriptor
  };

  global.LegacySvgAdapter = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);