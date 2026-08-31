/**
 * shared/feature-flags.js — M5-R21 Feature Flags (questionValidation)
 *
 * 支持模式：
 *   off    - 关闭验证（兼容/性能）
 *   warn   - 仅记录警告，不阻断
 *   strict - 严格模式：错误阻断/重试
 *
 * 全局注册：window.FeatureFlags / global.FeatureFlags
 */
(function (global) {
  'use strict';

  var DEFAULT_FLAGS = {
    questionValidation: {
      enabled: true,
      mode: 'warn',      // 'off' | 'warn' | 'strict'
      maxRetries: 3,
      logLevel: 'info'   // 'debug' | 'info' | 'warn' | 'error'
    },
    // 后续可扩展
    generatorRetry: { enabled: true },
    batchValidation: { enabled: true },
    qualityScoring: { enabled: true }
  };

  var flags = Object.assign({}, DEFAULT_FLAGS);

  function getFlag(path) {
    var keys = path.split('.');
    var obj = flags;
    for (var i = 0; i < keys.length; i++) {
      if (obj == null) return undefined;
      obj = obj[keys[i]];
    }
    return obj;
  }

  function setFlag(path, value) {
    var keys = path.split('.');
    var obj = flags;
    for (var i = 0; i < keys.length - 1; i++) {
      if (obj[keys[i]] == null) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  }

  function reset() {
    flags = Object.assign({}, DEFAULT_FLAGS);
  }

  function all() { return Object.assign({}, flags); }

  var API = {
    get: getFlag,
    set: setFlag,
    reset: reset,
    all: all,

    // 便捷方法
    isValidationEnabled: function () { return getFlag('questionValidation.enabled') === true; },
    getValidationMode: function () { return getFlag('questionValidation.mode') || 'warn'; },
    getMaxRetries: function () { return getFlag('questionValidation.maxRetries') || 3; },
    isStrictMode: function () { return getFlag('questionValidation.mode') === 'strict'; },
    isWarnMode: function () { return getFlag('questionValidation.mode') === 'warn'; },
    isOffMode: function () { return getFlag('questionValidation.mode') === 'off'; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.FeatureFlags = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));