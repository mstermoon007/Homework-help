/**
 * shared/presentation/render-options.js — M7-R07 统一渲染选项
 *
 * renderOptions 是三段式渲染（screen/print/preview）的唯一配置来源，
 * 所有 PresentationRenderer 消费方共用同一套默认值，禁止各页各自拼参数。
 *
 * 默认值（M7-R07 规范）：
 *   screen  { mode:'screen', theme:'default', device:'desktop', density:'normal' }
 *   print   { mode:'print',  paper:'A4',      density:'compact' }
 *
 * 约束：
 *   - normalize() 只返回合并后的新对象，绝不修改调用方传入的 options；
 *   - Renderer 只负责按 options 渲染，不修改题目数据。
 */
(function (global) {
  'use strict';

  var MODE_DEFAULTS = {
    screen: { mode: 'screen', theme: 'default', device: 'desktop', density: 'normal' },
    print:  { mode: 'print',  theme: 'default', paper: 'A4',      density: 'compact' },
    preview: { mode: 'preview', theme: 'default', device: 'desktop', density: 'normal' }
  };

  var VALID_MODES = Object.keys(MODE_DEFAULTS); // ['screen','print','preview']

  function isPlainObject(v) {
    return v != null && typeof v === 'object' && !Array.isArray(v);
  }

  /**
   * 规范化 renderOptions：按 mode 取默认值并叠加用户覆盖。
   * @param {Object} [options] 调用方选项（可为空）
   * @param {string} [modeHint] 未指定 mode 时使用的模式（screen|print|preview）
   * @returns {Object} 归一化后的新选项（不修改入参）
   */
  function normalize(options, modeHint) {
    var src = isPlainObject(options) ? options : {};
    var mode = src.mode || modeHint || 'screen';
    if (VALID_MODES.indexOf(mode) === -1) mode = 'screen';
    var base = MODE_DEFAULTS[mode];

    var out = {};
    var keys = Object.keys(base);
    for (var i = 0; i < keys.length; i++) out[keys[i]] = base[keys[i]];
    // 用户显式覆盖（key 存在即采用，允许 null 清空）；非法 mode 保持回退，不被覆盖
    var sKeys = Object.keys(src);
    for (var j = 0; j < sKeys.length; j++) {
      var key = sKeys[j];
      if (key === 'mode' && VALID_MODES.indexOf(src[key]) === -1) continue;
      if (src[key] !== undefined) out[key] = src[key];
    }
    if (out.mode !== mode) {
      // 用户显式改了 mode → 以其为准再补该模式缺失字段
      var b2 = MODE_DEFAULTS[out.mode] || MODE_DEFAULTS.screen;
      var k2 = Object.keys(b2);
      for (var k = 0; k < k2.length; k++) {
        if (out[k2[k]] === undefined) out[k2[k]] = b2[k2[k]];
      }
    }
    return out;
  }

  /**
   * 校验 renderOptions：非法字段抛出，合法返回 true。
   * 供测试与 print 系统做防御检查。
   */
  function validate(options) {
    if (!isPlainObject(options)) throw new Error('renderOptions 必须是对象');
    if (VALID_MODES.indexOf(options.mode) === -1) {
      throw new Error('renderOptions.mode 非法: ' + options.mode);
    }
    return true;
  }

  var API = {
    normalize: normalize,
    validate: validate,
    MODE_DEFAULTS: MODE_DEFAULTS,
    modeNames: VALID_MODES
  };

  global.RenderOptions = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);