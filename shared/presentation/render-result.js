/**
 * shared/presentation/render-result.js — M7-R05 Render Result 契约
 *
 * RenderResult = { html, graphic, metadata: { renderer, version } }
 *
 * 约束（R05）：
 *   - 禁止携带 plugin / generator / difficultyParams 等实现细节 —— 渲染产物对生成层不透明；
 *   - graphic 为已生成的 <svg> 字符串（无图时为空字符串 ''，不得为 null/undefined）；
 *   - 每题一个 RenderResult；列表层由 PresentationRenderer.renderAll 聚合。
 */
(function (global) {
  'use strict';

  var RENDERER_ID = 'presentation.v1';
  var RENDERER_VERSION = '1.0.0';

  var FORBIDDEN_KEYS = ['plugin', 'generator', 'difficultyParams', 'knowledgePoint', 'plan'];

  /**
   * 创建一份 RenderResult。
   * @param {Object} sq 题目对象（仅读取 id/prompt 等元数据用于索引，不强制要求）
   * @param {string} html 卡片 HTML
   * @param {string} [graphic] SVG 字符串，默认 ''
   * @returns {Object} RenderResult
   */
  function create(sq, html, graphic) {
    var g = typeof graphic === 'string' ? graphic : '';
    var out = {
      html: html,
      graphic: g,
      metadata: { renderer: RENDERER_ID, version: RENDERER_VERSION }
    };
    if (sq && typeof sq === 'object') {
      if (sq.id != null) out.id = String(sq.id);
      if (sq.questionType != null) out.questionType = sq.questionType;
    }
    return out;
  }

  /** 校验一份 RenderResult 是否符合契约；返回 { valid, errors } */
  function validate(result) {
    var errors = [];
    if (!result || typeof result !== 'object') {
      return { valid: false, errors: ['RenderResult 必须是对象'] };
    }
    if (typeof result.html !== 'string') errors.push('result.html 必须是字符串');
    if (typeof result.graphic !== 'string') errors.push('result.graphic 必须是字符串（空图用 ""）');
    if (!result.metadata || typeof result.metadata !== 'object') {
      errors.push('result.metadata 缺失');
    } else {
      if (!result.metadata.renderer) errors.push('result.metadata.renderer 缺失');
      if (!result.metadata.version) errors.push('result.metadata.version 缺失');
    }
    for (var i = 0; i < FORBIDDEN_KEYS.length; i++) {
      if (result[FORBIDDEN_KEYS[i]] !== undefined) {
        errors.push('RenderResult 不得携带字段: ' + FORBIDDEN_KEYS[i]);
      }
    }
    return { valid: errors.length === 0, errors: errors };
  }

  var API = {
    create: create,
    validate: validate,
    RENDERER_ID: RENDERER_ID,
    RENDERER_VERSION: RENDERER_VERSION
  };

  global.RenderResult = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);