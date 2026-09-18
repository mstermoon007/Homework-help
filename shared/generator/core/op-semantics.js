/**
 * shared/generator/core/op-semantics.js — 操作 ID → 符号 查询助手
 *
 * 基础四则运算符语义内置（Generator 已与旧知识层 ontology-operation-map 断开）；
 * 非基础操作符查询不到返回 null，由调用方兜底（如 arithmetic-core 的 `|| '+'`）。
 *
 * 浏览器：经 strategy bundle 内联 → global.GenOpSemantics
 * Node：const OpSem = require('./op-semantics.js')
 */
(function (global) {
  'use strict';

  var NORM = {
    add: 'add', addition: 'add',
    sub: 'subtract', subtraction: 'subtract', subtract: 'subtract',
    mult: 'multiply', mul: 'multiply', multiplication: 'multiply', multiply: 'multiply',
    div: 'divide', division: 'divide', divide: 'divide',
    '+': 'add', '−': 'subtract', '-': 'subtract', '×': 'multiply', 'x': 'multiply', '÷': 'divide'
  };

  var SYMBOLS = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷'
  };

  function normalize(opId) {
    if (typeof opId !== 'string') return null;
    return NORM.hasOwnProperty(opId) ? NORM[opId] : null;
  }

  function symbol(opId) {
    var n = normalize(opId);
    if (!n) return null;
    return SYMBOLS.hasOwnProperty(n) ? SYMBOLS[n] : null;
  }

  var API = { normalize: normalize, symbol: symbol };

  global.GenOpSemantics = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));