/**
 * shared/orchestration/difficulty-orchestrator.js — M3-04 编排层难度参数域（DifficultyContext）
 *
 * 职责：编排层唯一难度入口，只做「参数整理 / 结构归一 / 约束携带」，**禁止计算难度**：
 *   - 不调用 Difficulty.paramsFor / DifficultyStatic.paramsForKnowledgePoint
 *   - 不复制 DELTA_RULES / 权重表 / 难度档位公式（一律由 shared/catalog/difficulty*.js 负责）
 *   - 不出现 `1 + 9 * ...`
 *
 * 输入：request.difficulty≥三种形态
 *   number/string        → { requested: level(1-10), source: 'user' }
 *   {requested,min,max,tolerance,source} → 结构化难度参数域
 *   null / 缺省          → { requested: null, source: 'auto' }（生成难度由策略 7 维静态+合成决定）
 * 也兼容旧 req.scope.difficulty（number，practice-orchestrator 既有路径）。
 *
 * 输出：DifficultyContext = { requested, base, target, min, max, tolerance, source }
 *   requested  用户显式难度（1-10 整数）或 null
 *   base       该 KP 的静态基础难度（M4 起由 strategy static-difficulty 产出；接入前为 null）
 *   target     最终难度目标 = requested override base（requested 有值取 requested，否则取 base）
 *   min/max    用户给出的难度上下限约束（null = 不限）
 *   tolerance  容差（>=0，仅编排约束，不参与计算）
 *   source     'user' | 'auto' | 'static'
 *
 * 挂载：window.App.DifficultyOrchestrator（浏览器）；module.exports（Node）。
 * 加载顺序：建议在 shared/catalog/difficulty.js 之后（本模块不依赖它，仅语义约定）。
 *
 * @module shared/orchestration/difficulty-orchestrator
 */
(function (global) {
  'use strict';

  var DIFF_MIN = 1;
  var DIFF_MAX = 10;

  function isFiniteNum(n) {
    return typeof n === 'number' && isFinite(n);
  }
  function clamp(n, lo, hi) {
    return Math.min(hi, Math.max(lo, n));
  }
  /** 难度级归整：null/空 → null；其余 → clamp(round, 1, 10) */
  function toLevel(n) {
    if (n == null || n === '') return null;
    var v = Number(n);
    if (!isFiniteNum(v)) return null;
    return clamp(Math.round(v), DIFF_MIN, DIFF_MAX);
  }
  /** 范围约束（min/max）：null/非法 → null，其余原样（不 clamp，纯携带约束） */
  function toBound(n) {
    if (n == null || n === '') return null;
    var v = Number(n);
    return isFiniteNum(v) ? v : null;
  }
  /** 容差：null/非法 → 0；负数 → 0 */
  function toTolerance(n) {
    if (n == null || n === '') return 0;
    var v = Number(n);
    return (isFiniteNum(v) && v >= 0) ? v : 0;
  }
  function toSource(s, fallback) {
    var v = String(s == null ? '' : s).toLowerCase();
    if (v === 'user' || v === 'auto' || v === 'static') return v;
    return fallback || 'auto';
  }

  /**
   * 归一 request 中的难度输入 → 内部难度参数域。
   * @param {Object} req { difficulty, scope?{difficulty} }
   * @returns {{
   *   requested: number|null, min: number|null, max: number|null,
   *   tolerance: number, source: 'user'|'auto'|'static'
   * }}
   */
  function normalizeDifficultyInput(req) {
    req = req || {};
    var raw = req.difficulty;
    if (raw == null && req.scope) raw = req.scope.difficulty;

    // 结构化对象形态：{requested,min,max,tolerance,source}
    if (raw != null && typeof raw === 'object') {
      var requested = toLevel(raw.requested);
      return {
        requested: requested,
        min: toBound(raw.min),
        max: toBound(raw.max),
        tolerance: toTolerance(raw.tolerance),
        source: toSource(raw.source, requested != null ? 'user' : 'auto')
      };
    }

    // number / 数字字符串 / null 形态
    var n = toLevel(raw);
    return {
      requested: n,
      min: null,
      max: null,
      tolerance: 0,
      source: toSource(typeof raw === 'object' && raw ? raw.source : null, n != null ? 'user' : 'auto')
    };
  }

  /**
   * 组装 DifficultyContext。
   * 仅做字段选择与约束携带，不做任何难度计算（target 选值非公式）。
   * @param {Object} input normalizeDifficultyInput 输出
   * @param {number|null} [base] 该 KP 静态基础难度（M5 接入前调用方可传 null）
   * @returns {{
   *   requested: number|null, base: number|null, target: number|null,
   *   min: number|null, max: number|null, tolerance: number, source: string
   * }}
   */
  function resolveContext(input, base) {
    input = input || {};
    var requested = toLevel(input.requested);
    var b = (base != null) ? toLevel(base) : null;
    var target = requested != null ? requested : b;
    return {
      requested: requested,
      base: b,
      target: target,
      min: toBound(input.min),
      max: toBound(input.max),
      tolerance: toTolerance(input.tolerance),
      source: toSource(input.source, requested != null ? 'user' : 'auto')
    };
  }

  var API = {
    DIFF_MIN: DIFF_MIN,
    DIFF_MAX: DIFF_MAX,
    normalizeDifficultyInput: normalizeDifficultyInput,
    resolveContext: resolveContext
  };

  global.DifficultyOrchestrator = API;
  if (global.App && typeof global.App === 'object') global.App.DifficultyOrchestrator = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));