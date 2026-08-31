/**
 * shared/generation-config.js — 题目生成 Feature Flag（M0-07）
 *
 * 职责（仅护栏，不改变任何现有线上生成逻辑）：
 *   - 集中管理「当前生成模式」：legacy（默认）/ strategy-v1。
 *   - 任何非法 mode、或 strategy 引擎缺失/异常时，自动回退 legacy（绝不抛错、绝不中断）。
 *   - 为后续 Knowledge Ontology → Strategy Engine → Generator 升级提供安全的选路入口，
 *     M0 阶段 strategy-v1 没有真正的引擎实现，因此一律回退 legacy（见 resolveGenerator）。
 *
 * 约束（M0 执行规则）：
 *   - 不修改现有 Legacy 难度规则；不把 difficulty-static 接入 UI。
 *   - 本模块不被 practice.html 引用（生产入口不变），仅由后续 Strategy 集成与 M0 验证调用。
 *
 * 用法（Node / 浏览器通用）：
 *   const cfg = require('./shared/generation-config.js');
 *   cfg.getMode();                       // 'legacy'
 *   cfg.setMode('strategy-v1');
 *   cfg.resolveGenerator({ plan, legacyFactory, strategyFactory });
 */
(function (global) {
  'use strict';

  // 受支持的模式。M0 仅 legacy 真实可用；strategy-v1 为占位（无引擎，回退 legacy）。
  var SUPPORTED = ['legacy', 'strategy-v1'];
  var DEFAULT_MODE = 'legacy';

  // 当前模式（进程/标签页级单例）。默认 legacy。
  var _mode = DEFAULT_MODE;

  function normalize(m) {
    return (typeof m === 'string' && SUPPORTED.indexOf(m) !== -1) ? m : DEFAULT_MODE;
  }

  /** 读取当前模式（始终为受支持值） */
  function getMode() { return _mode; }

  /**
   * 设置模式。传入非法值时静默回退 legacy（不抛错）。
   * @param {string} m
   * @returns {string} 实际生效的模式
   */
  function setMode(m) {
    _mode = normalize(m);
    return _mode;
  }

  /** 是否启用 strategy 模式（M0 下即使为 true，resolveGenerator 也会因无引擎回退 legacy） */
  function isStrategyEnabled() { return _mode === 'strategy-v1'; }

  /**
   * 选路：根据当前模式选择生成器。
   *
   * 规则：
   *  - legacy：调用 legacyFactory(plan) 产出 legacy 插件（或生成器）并直接使用。
   *  - strategy-v1：仅当 strategyFactory 返回合法生成器时使用；否则回退 legacy。
   *  - 任何异常（legacyFactory / strategyFactory 抛错）一律回退 legacy，并返回 error 标记。
   *
   * @param {{plan?:Object, legacyFactory?:function, strategyFactory?:function}} opts
   * @returns {{generator:?, mode:string, error?:string}}
   */
  function resolveGenerator(opts) {
    opts = opts || {};
    var chosen = normalize(_mode);

    function failLegacy(reason) {
      var lg = (typeof opts.legacyFactory === 'function') ? safeCall(opts.legacyFactory, opts.plan) : null;
      return { generator: lg, mode: 'legacy(fallback)', error: reason };
    }

    if (chosen === 'strategy-v1') {
      try {
        if (typeof opts.strategyFactory === 'function') {
          var s = opts.strategyFactory(opts.plan);
          if (s && typeof s.generate === 'function') {
            return { generator: s, mode: 'strategy-v1' };
          }
        }
        // 未提供可用 strategy 引擎 → 回退 legacy（M0 阶段常态）
        return failLegacy('strategy-v1 无可用引擎，回退 legacy');
      } catch (e) {
        return failLegacy('strategy-v1 异常，回退 legacy: ' + (e && e.message));
      }
    }

    // legacy
    try {
      var lf = (typeof opts.legacyFactory === 'function') ? opts.legacyFactory(opts.plan) : null;
      return { generator: lf, mode: 'legacy' };
    } catch (e) {
      return { generator: null, mode: 'legacy', error: 'legacyFactory 异常: ' + (e && e.message) };
    }
  }

  function safeCall(fn, plan) {
    try { return fn(plan); } catch (e) { return null; }
  }

  var API = {
    SUPPORTED: SUPPORTED,
    DEFAULT: DEFAULT_MODE,
    getMode: getMode,
    setMode: setMode,
    isStrategyEnabled: isStrategyEnabled,
    resolveGenerator: resolveGenerator
  };

  global.GenerationConfig = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
