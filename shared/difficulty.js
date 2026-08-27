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

  /**
   * 插件统一消费入口（批次4）。
   * @param {{difficulty?:number, adaptiveDelta?:number, typeBias?:string,
   *           level?:*}} options 插件 generate(options) 原样传入即可：
   *   - options.level 存在（插件自带难度分档 chip）→ hasOwnLevel=true，
   *     通用难度不叠加（effectiveLevel 回落默认档），插件保持自身逻辑；
   *   - 否则按 difficulty(+adaptiveDelta) 解析 profile。
   * @returns {Object} createProfile 结果 + hasOwnLevel 标记
   */
  function consume(options) {
    options = options || {};
    var hasOwnLevel = options.level != null && options.level !== '';
    var prof = hasOwnLevel
      ? createProfile(undefined, 0)
      : createProfile(options.difficulty, Number(options.adaptiveDelta) || 0,
                      { typeBias: options.typeBias });
    prof.hasOwnLevel = hasOwnLevel;
    return prof;
  }

  // ============ 任务10：按科目差异化策略 ============

  /** 科目代号规范化：兼容注册表全称（chinese/english）与前缀缩写（cn/en） */
  function canonSubject(subject) {
    var m = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };
    return m[subject] || subject;
  }

  /**
   * 正确率反馈调整规则（数学现行规则的显式化；cn/en 暂沿用同一反馈框架）。
   * @param {{emaRate:number, lastRate:number}} s
   * @returns {{delta:number, bias:string|null}}
   */
  function applyDeltaRule(s) {
    if (s.emaRate >= 0.85 && s.lastRate >= 0.999) return { delta: 2, bias: 'hard' };
    if (s.emaRate >= 0.8) return { delta: 1, bias: 'hard' };
    if (s.emaRate <= 0.5) return { delta: -2, bias: 'easy' };
    if (s.emaRate <= 0.65) return { delta: -1, bias: 'easy' };
    return { delta: 0, bias: null };
  }

  var DELTA_RULES = { apply: applyDeltaRule };

  /**
   * 科目难度档案：toParams 把 1–10 难度映射为该科目的生成参数，
   * 插件在 generateQuestions 中按需消费（未消费的键被安全忽略）。
   */
  var DifficultyProfiles = {
    math: {
      subject: 'math',
      label: '数学',
      defaultLevel: 3,
      /** 现有能力：diffScale 数值缩放 + 五档结构映射 */
      createProfile: function (base, delta, opts) { return createProfile(base, delta, opts); },
      toParams: function (level) {
        var p = createProfile(level);
        return {
          level: p.effectiveLevel,
          scale: p.scale,
          steps: p.structure.steps,
          allowBracket: p.structure.allowBracket,
          allowMultDiv: p.structure.allowMultDiv
        };
      }
    },
    cn: {
      subject: 'cn',
      label: '语文',
      defaultLevel: 3,
      /** 语文映射：字词复杂度（字数上限/词档）与句子长度 */
      toParams: function (level) {
        var l = clamp10(level);
        return {
          level: l,
          charCountMax: l <= 3 ? 8 : (l <= 6 ? 12 : 16),   // 字词复杂度：字数上限
          sentenceLength: 6 + l * 2,                        // 句子长度（字）
          vocabTier: l <= 3 ? 'basic' : (l <= 6 ? 'common' : (l <= 8 ? 'advanced' : 'extension'))
        };
      }
    },
    en: {
      subject: 'en',
      label: '英语',
      defaultLevel: 3,
      /** 英语映射：词汇长度、语法复杂度、句型层级 */
      toParams: function (level) {
        var l = clamp10(level);
        return {
          level: l,
          wordLengthMax: l <= 3 ? 4 : (l <= 6 ? 6 : (l <= 8 ? 8 : 10)),  // 词汇长度上限（字母）
          grammarTier: l <= 3 ? 1 : (l <= 6 ? 2 : (l <= 8 ? 3 : 4)),     // 语法复杂度分档
          sentencePattern: l <= 3 ? 'simple' : (l <= 6 ? 'compound' : 'complex')
        };
      }
    }
  };

  /** 取科目档案：chinese/english 归一为 cn/en；未知科目回落 math（安全默认） */
  function profileFor(subject) {
    return DifficultyProfiles[canonSubject(subject)] || DifficultyProfiles.math;
  }

  /** 按科目把难度（可叠加 delta）翻译成生成参数 */
  function paramsFor(subject, level, delta) {
    var prof = profileFor(subject);
    var base = (Number(level) || prof.defaultLevel) + (Number(delta) || 0);
    return prof.toParams(base);
  }

  /** 取科目调整策略（正确率反馈规则）；未知科目返回 null，调用方回退内置逻辑 */
  function strategyFor(subject) {
    var prof = profileFor(subject);
    return prof === DifficultyProfiles.math ? DELTA_RULES
      : (prof.subject === 'cn' || prof.subject === 'en') ? DELTA_RULES
      : null;
  }

  // ============ 导出：挂载 App.Difficulty（Node 端默认导出同一对象） ============
  global.App = global.App || {};
  var Difficulty = {
    TIERS: TIERS,
    difficultyToStructure: difficultyToStructure,
    createProfile: createProfile,
    consumeProfile: consumeProfile,
    consume: consume,
    DifficultyProfiles: DifficultyProfiles,
    profileFor: profileFor,
    paramsFor: paramsFor,
    strategyFor: strategyFor
  };
  global.App.Difficulty = Difficulty;

  if (typeof module !== 'undefined' && module.exports) module.exports = Difficulty;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
