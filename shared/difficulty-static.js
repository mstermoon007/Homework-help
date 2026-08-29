// @ts-check
/**
 * shared/difficulty-static.js — 静态多维难度引擎（挂载 window.App.DifficultyStatic）
 *
 * 职责：仅依据「知识点静态元数据 + 题型」计算难度分，不依赖任何学生历史表现。
 * 输出的 profile 与现有 shared/difficulty.js 的 Difficulty.paramsFor('math', level)
 * 返回结构兼容（含 difficulty / scale / steps / allowBracket / allowMultDiv），
 * 额外附带 staticMeta 供插件细控。
 *
 * 七个维度评分（均归一化到 0~1）：
 *   G  螺旋进度   = (spiral_level - 1) / (max_spiral_level - 1)，首轮 0、末轮 1
 *   S  结构复杂度 = calcStructureScore(steps, allowBracket, allowMultDiv)，复用 difficultyToStructure 量纲
 *   C  认知层级   = mapCognitive(cognitive_level)
 *   T  题型系数   = getTypeCoefficient(questionType)
 *   St 步骤数     = (max_steps_default - 1) / 4
 *   N  数值范围   = calcNumberScore(number_range_default) = log10(max)/log10(100000)
 *   A  情境       = getContextScore(context_default)
 *
 * 合成：D = 1 + 9 * (0.15*G + 0.20*S + 0.15*C + 0.10*T + 0.15*St + 0.10*N + 0.15*A)
 *      level = clamp(round(D), 1, 10)
 *
 * 依赖：shared/difficulty.js（App.Difficulty 必须已加载；浏览器先加载 difficulty.js，
 * Node 端自动 require）。加载顺序须在 difficulty.js 之后。
 */
(function (global) {
  'use strict';

  var Difficulty = (typeof global.App !== 'undefined' && global.App.Difficulty)
    ? global.App.Difficulty
    : (typeof require !== 'undefined' ? require('./difficulty.js') : null);
  if (!Difficulty || typeof Difficulty.paramsFor !== 'function') {
    throw new Error('shared/difficulty-static.js 依赖 shared/difficulty.js（App.Difficulty）');
  }

  function clamp10(n) {
    n = Math.round(Number(n));
    if (!isFinite(n)) n = 3;
    if (n < 1) n = 1;
    if (n > 10) n = 10;
    return n;
  }
  function clamp01(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  var COGNITIVE_MAP = { '了解': 0, '理解': 0.33, '掌握': 0.67, '运用': 1.0 };
  function mapCognitive(level) {
    return COGNITIVE_MAP[level] != null ? COGNITIVE_MAP[level] : 0.67; // 缺省「掌握」
  }

  // 题型系数表（规范类别），并兼容插件 type 代码别名
  var TYPE_COEFF = {
    '计算': 0.20, 'calc': 0.20, 'calculation': 0.20,
    '填空': 0.25, 'fill': 0.25, 'blank': 0.25,
    '判断': 0.30, 'judge': 0.30, 'truefalse': 0.30,
    '选择': 0.35, 'choice': 0.35, 'select': 0.35,
    '操作': 0.50, 'operate': 0.50, 'manipulate': 0.50,
    '应用': 0.70, 'apply': 0.70, 'application': 0.70,
    '开放': 0.80, 'open': 0.80, 'openended': 0.80
  };
  var TYPE_ALIAS = {
    'cushi': 'calc', 'mixed': 'apply', 'mix': 'apply', 'word': 'apply',
    'oral': 'operate', 'recognize': 'operate', 'picture': 'operate',
    'matching': 'choice', 'column': 'fill', 'comparison': 'judge'
  };
  function getTypeCoefficient(qt) {
    if (qt == null) return 0.5;
    if (TYPE_COEFF[qt] != null) return TYPE_COEFF[qt];
    var key = String(qt).toLowerCase();
    if (TYPE_COEFF[key] != null) return TYPE_COEFF[key];
    var mapped = TYPE_ALIAS[key];
    if (mapped && TYPE_COEFF[mapped] != null) return TYPE_COEFF[mapped];
    return 0.5; // 未知题型回落中值
  }

  // 结构复杂度：复用 difficultyToStructure 的复杂度量纲（steps*10 + 括号*6 + 乘除*8），归一化 0~1
  function calcStructureScore(steps, allowBracket, allowMultDiv) {
    var raw = (Number(steps) || 1) * 10 + (allowBracket ? 6 : 0) + (allowMultDiv ? 8 : 0);
    var minRaw = 1 * 10;            // 最低档 steps=1
    var maxRaw = 5 * 10 + 6 + 8;    // 最高档 steps=5 + 括号 + 乘除
    return clamp01((raw - minRaw) / (maxRaw - minRaw));
  }

  // 数值范围：log10(max)/log10(100000)（max<=1 记 0）
  function calcNumberScore(range) {
    if (!range || typeof range.max !== 'number') return 0;
    var max = Math.max(1, range.max);
    return clamp01(Math.log10(max) / Math.log10(100000));
  }

  var CONTEXT_MAP = { pure: 0, simple: 0.3, standard: 0.5, complex: 0.8 };
  function getContextScore(ctx) {
    return CONTEXT_MAP[ctx] != null ? CONTEXT_MAP[ctx] : 0.5; // 缺省 standard
  }

  /**
   * 主函数：依据知识点元数据与题型计算静态难度。
   * @param {Object} kpMeta 知识点元数据（至少含 difficulty；其余 7 字段由阶段1迁移提供）
   * @param {string|{type:string}|undefined} [questionType] 题型；缺省时取 applicable_question_types 中系数最高者
   * @param {Object} [customParams] 自定义覆盖（可覆盖 scale/steps 等生成参数）
   * @returns {{difficulty:number, level:number, scale:number, steps:number,
   *            allowBracket:boolean, allowMultDiv:boolean,
   *            staticMeta:{G:number,S:number,C:number,T:number,St:number,N:number,A:number,D:number,level:number}}}
   */
  function paramsForKnowledgePoint(kpMeta, questionType, customParams) {
    kpMeta = kpMeta || {};
    customParams = customParams || {};

    var qt = questionType;
    if (qt == null && Array.isArray(kpMeta.applicable_question_types) && kpMeta.applicable_question_types.length) {
      var best = kpMeta.applicable_question_types[0];
      kpMeta.applicable_question_types.forEach(function (a) {
        if ((a.coefficient || 0) > (best.coefficient || 0)) best = a;
      });
      qt = best.type;
    }

    var st = Difficulty.difficultyToStructure(kpMeta.difficulty != null ? kpMeta.difficulty : 3);
    var G = (kpMeta.max_spiral_level && kpMeta.max_spiral_level > 1)
      ? clamp01((kpMeta.spiral_level - 1) / (kpMeta.max_spiral_level - 1)) : 0;
    var S = calcStructureScore(st.steps, st.allowBracket, st.allowMultDiv);
    var C = mapCognitive(kpMeta.cognitive_level);
    var T = getTypeCoefficient(qt);
    var St = clamp01((Number(kpMeta.max_steps_default || 1) - 1) / 4);
    var N = calcNumberScore(kpMeta.number_range_default);
    var A = getContextScore(kpMeta.context_default);

    var wsum = 0.15 * G + 0.20 * S + 0.15 * C + 0.10 * T + 0.15 * St + 0.10 * N + 0.15 * A;
    var D = 1 + 9 * wsum;
    var level = clamp10(Math.round(D));

    var base = Difficulty.paramsFor('math', level);
    var out = { difficulty: level };
    for (var k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    }
    for (var c in customParams) {
      if (Object.prototype.hasOwnProperty.call(customParams, c)) out[c] = customParams[c];
    }
    out.staticMeta = { G: G, S: S, C: C, T: T, St: St, N: N, A: A, D: D, level: level };
    return out;
  }

  // ============ 导出：挂载 App.DifficultyStatic（Node 端默认导出同一对象） ============
  global.App = global.App || {};
  var DifficultyStatic = {
    mapCognitive: mapCognitive,
    getTypeCoefficient: getTypeCoefficient,
    calcStructureScore: calcStructureScore,
    calcNumberScore: calcNumberScore,
    getContextScore: getContextScore,
    paramsForKnowledgePoint: paramsForKnowledgePoint,
    COGNITIVE_MAP: COGNITIVE_MAP,
    TYPE_COEFF: TYPE_COEFF,
    CONTEXT_MAP: CONTEXT_MAP
  };
  global.App.DifficultyStatic = DifficultyStatic;

  if (typeof module !== 'undefined' && module.exports) module.exports = DifficultyStatic;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
