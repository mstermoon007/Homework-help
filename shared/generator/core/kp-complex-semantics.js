/**
 * shared/generator/core/kp-complex-semantics.js — M4-R18 KP 级复杂运算语义解析
 *
 * 将 Canonical KnowledgePoint（源中 type = mixed/bracket/chain/multdiv/operator/mix）
 * 解析为可供 native 生成器消费的结构化约束：
 *
 *   { family, operators, steps, allowBracket, inverse? }
 *
 * 族分类（按 Plan 可表达性划分）：
 *   chain     — 纯链式运算（连加连减、乘除混合）
 *   no-bracket — 无括号混合运算（先乘除后加减，实质也是链式）
 *   bracket   — 有括号混合运算（括号包裹前两步）
 *   inverse   — 求未知数 / 填运算符
 *
 * 该模块是「Plan 语义承载」的核心：Generator 按 family 选择表达路径，
 * 不解释难度（难度→numberRange/maxSteps/allowBracket 由 StructureConstraints 完成）。
 */
'use strict';

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

/**
 * Complex KP 结构描述表（仅限 R18 round-1 可迁移的 KP）。
 * key = KP id；若 KP 不在表中 → resolveComplexSemantics 返回 null（非本批迁移对象）。
 */
var COMPLEX_PROFILES = {
  // ─── chain（链式，纯算术）──────────────────────
  // g1: 连加连减：[+,−]，2 operators（3 operands），无括号，all positive
  'math-g1-m1-mixed-chain': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减与加减混合（g1）'
  },
  // g2-m3: 连加连减脱式：[+,−]，2 operators（3 operands），无括号，脱式显式
  'math-g2-m3-chain-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '连加连减脱式（g2-m3）'
  },
  // g2-m3: 乘除混合脱式：[×,÷]，2 operators（3 operands），无括号
  'math-g2-m3-multdiv-mixed': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合脱式（g2-m3）'
  },
  // g2-m1: 加减混合运算：[+,−]，2 operators（3 operands），无括号
  'math-g2-m1-mixed-addsub': {
    family: 'chain',
    operators: [OP_ADD, OP_SUB],
    steps: 2,
    allowBracket: false,
    comment: '加减混合运算（g2-m1）'
  },
  // g2-m1: 乘除混合运算：[×,÷]，2 operators（3 operands），无括号
  'math-g2-m1-mixed-multdiv': {
    family: 'chain',
    operators: [OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '乘除混合运算（g2-m1）'
  },

  // ─── no-bracket（混合运算，无括号）─────────────
  // g2-m3: 无括号混合运算：混合四种，2 operators（3 operands），无括号
  'math-g2-m3-mixed-no-bracket': {
    family: 'no-bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: false,
    comment: '无括号混合运算（先乘除后加减）'
  },

  // ─── bracket（有括号混合运算）───────────────────
  // g2-m3: 带括号混合运算：混合四种，2 operators（3 operands），括号包前两步
  'math-g2-m3-mixed-bracket': {
    family: 'bracket',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 2,
    allowBracket: true,
    comment: '带括号混合运算（先算括号内）'
  },

  // ─── inverse（求未知数 / 填运算符）─────────────
  // g1-m4: 填未知数：+/-，求缺失加数/减数
  'math-g1-m4-num-fill-unknown': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operand' },
    comment: '在算式中填写未知的加数或减数'
  },
  // g2-m3: 填运算符号：任意四种运算符，缺失运算符
  'math-g2-m3-fill-operator': {
    family: 'inverse',
    operators: [OP_ADD, OP_SUB, OP_MUL, OP_DIV],
    steps: 1,
    allowBracket: false,
    inverse: { mode: 'fill-operator' },
    comment: '在○填+、−、×、÷使等式成立'
  }
};

var COMPLEX_KP_IDS = Object.keys(COMPLEX_PROFILES);

/**
 * 解析 KP 的复杂运算结构语义；不在本批迁移范围时返回 null。
 * @param {Object} kp  Canonical KnowledgePoint
 * @returns {Object|null} { family, operators, steps, allowBracket, inverse? } 或 null
 */
function resolveComplexSemantics(kp) {
  if (!kp || !kp.id) return null;
  var profile = COMPLEX_PROFILES[kp.id];
  if (!profile) return null;

  return {
    family: profile.family,
    operators: profile.operators.slice(),
    steps: profile.steps,
    allowBracket: !!profile.allowBracket,
    inverse: profile.inverse ? { mode: profile.inverse.mode } : null
  };
}

/** 判断 KP 是否属于本批复杂语义迁移范围 */
function isComplexMigratable(kpId) {
  return COMPLEX_KP_IDS.indexOf(kpId) !== -1;
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  COMPLEX_PROFILES: COMPLEX_PROFILES,
  COMPLEX_KP_IDS: COMPLEX_KP_IDS,
  resolveComplexSemantics: resolveComplexSemantics,
  isComplexMigratable: isComplexMigratable
};
