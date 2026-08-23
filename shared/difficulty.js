// @ts-check
/** 
 * shared/difficulty.js — 统一难度解析模块（挂载 window.App.Difficulty）
 *
 * 职责：把「用户基础难度(1-10) + 自适应调整量 delta + 插件选项」解析为
 * 一个 DifficultyProfile，同时给出数值缩放（scale）与结构复杂度参数
 * （steps/allowBracket/allowMultDiv），供各插件按题型消费。
 *
 * 结构分档（difficultyToStructure）：
 *   1–2   steps=1  无括号 无乘除
 *   3–4   steps=2  无括号 无乘除（可连加连减）
 *   5–6   steps=3  有括号 有乘除
 *   7–8   steps=4  有括号 有乘除（多种符号交替）
 *   9–10  steps=5+ 有括号 有乘除（多层括号）
 *
 * 依赖：shared/common.js（复用 diffLevel/diffScale/diffMax；浏览器先加载 common.js，
 * Node 端自动 require）。加载顺序必须在 common.js 之后。
 */
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('./common.js') : null);
  if (!_PU || !_PU.diffLevel) throw new Error('shared/difficulty.js 依赖 shared/common.js（PluginUtil.diffLevel）');

  /** 结构分档表：max 为该档最高难度；min 由上一档 max+1 推得 */
  var TIERS = [
    { min: 1, max: 2, steps: 1, bracket: false, md: false, chainAddSub: false },
    { min: 3, max: 4, steps: 2, bracket: false, md: false, chainAddSub: true },
    { min: 5, max: 6, steps: 3, bracket: true, md: true, chainAddSub: true },
    { min: 7, max: 8, steps: 4, bracket: true, md: true, chainAddSub: true, altOps: true },
    { min: 9, max: 10, steps: 5, bracket: true, md: true, chainAddSub: true, altOps: true, nested: true }
  ];

  function tierOf(level) {
    for (var i = 0; i < TIERS.length; i++) {
      if (level <= TIERS[i].max) return TIERS[i];
    }
    return TIERS[TIERS.length - 1];
  }

  /**
   * 难度 → 结构复杂度。
   * @param {number} level 1–10（非法值按 diffLevel 规则回退）
   * @returns {{steps:number, allowBracket:boolean, allowMultDiv:boolean,
   *            complexityScore:number, chainAddSub:boolean, alternateOps:boolean,
   *            nestedBrackets:boolean, tier:number}}
   *   complexityScore 全档严格单调递增，可用于断言与排序。
   */
  function difficultyToStructure(level) {
    var l = _PU.diffLevel(level);
    var t = tierOf(l);
    var score = t.steps * 10
      + (t.bracket ? 6 : 0)
      + (t.md ? 8 : 0)
      + (t.altOps ? 4 : 0)
      + (t.nested ? 5 : 0)
      + (l - t.min); // 档内随难度递增，保证 1..10 严格单调
    return {
      steps: t.steps,
      allowBracket: !!t.bracket,
      allowMultDiv: !!t.md,
      complexityScore: score,
      chainAddSub: !!t.chainAddSub,
      alternateOps: !!t.altOps,
      nestedBrackets: !!t.nested,
      tier: TIERS.indexOf(t) + 1
    };
  }

  function clamp10(n) {
    n = Math.round(Number(n));
    if (!isFinite(n)) n = 3;
    if (n < 1) n = 1;
    if (n > 10) n = 10;
    return n;
  }

  /**
   * 合并「用户选择 + 自适应 delta + 插件选项」生成难度档案。
   * @param {number} baseLevel 用户选择的基础难度（默认 3）
   * @param {number} delta     自适应调整量（-2..+2，见 App.Adaptive.computeAdjustment）
   * @param {{typeBias?:('hard'|'easy'|null), preferredType?:string}|undefined} [opts]
   * @returns {{effectiveLevel:number, scale:number, structure:Object, typePreference:*}}
   */
  function createProfile(baseLevel, delta, opts) {
    opts = opts || {};
    var eff = clamp10((Number(baseLevel) || 3) + (Number(delta) || 0));
    var typePref = opts.typeBias !== undefined
      ? opts.typeBias
      : ((delta || 0) > 0 ? 'hard' : ((delta || 0) < 0 ? 'easy' : null));
    return {
      effectiveLevel: eff,
      scale: _PU.diffScale(eff),
      structure: difficultyToStructure(eff),
      typePreference: typePref
    };
  }

  /** ES5 浅合并（不引入 Object.assign，保持与现有代码风格一致） */
  function extend(target, extra) {
    for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) target[k] = extra[k]; }
    return target;
  }

  /**
   * 插件消费入口：把 profile 翻译成适合插件类型的参数对象。
   * pluginType 取值：'expression' | 'geometry' | 'application' | 'oral' | 其他→默认透传。
   * @returns {Object} 始终含 difficulty/scale/steps，其余按键随插件类型扩展
   */
  function consumeProfile(profile, pluginType) {
    if (!profile || !profile.structure) throw new Error('consumeProfile: 缺少有效 DifficultyProfile');
    var lvl = profile.effectiveLevel;
    var st = profile.structure;
    var base = { difficulty: lvl, scale: profile.scale, steps: st.steps };

    if (pluginType === 'expression') {
      return extend(base, {
        allowBracket: st.allowBracket,
        allowMultDiv: st.allowMultDiv,
        nestedBrackets: st.nestedBrackets,
        alternateOps: st.alternateOps,
        maxOperand: _PU.diffMax(20, lvl)
      });
    }
    if (pluginType === 'geometry') {
      return extend(base, {
        compositeShapes: st.allowBracket, // 高档才出组合图形
        decimals: lvl >= 7                // 高档引入小数边长/结果
      });
    }
    if (pluginType === 'application') {
      return extend(base, {
        multiStep: st.steps >= 3,         // 三步以上应用题
        fractionsPercent: lvl >= 6        // 六档起掺入分数百分数
      });
    }
    if (pluginType === 'oral') {
      return extend(base, {
        maxOperand: _PU.diffMax(10, lvl),
        carry: lvl >= 4                   // 四档起含进退位
      });
    }
    // 默认：仅透传通用三键，插件自行解读
    return extend({}, base);
  }

  // ============ 导出：挂载 App.Difficulty（Node 端默认导出同一对象） ============
  global.App = global.App || {};
  var Difficulty = {
    TIERS: TIERS,
    difficultyToStructure: difficultyToStructure,
    createProfile: createProfile,
    consumeProfile: consumeProfile
  };
  global.App.Difficulty = Difficulty;

  if (typeof module !== 'undefined' && module.exports) module.exports = Difficulty;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
