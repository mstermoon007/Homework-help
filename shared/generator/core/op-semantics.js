/**
 * shared/generator/core/op-semantics.js — 操作 ID → 符号/计算方法/视觉别名 查询助手
 *
 * 唯一数据源：shared/knowledge/ontology-operation-map.js 的 OP_SEMANTICS。
 * 生成器/渲染器拿到 operation* ID 后禁止硬编码符号（+ − × ÷ 或 加法/减法…），
 * 一律经本助手查询；查询不到返回 null/'' 由调用方兜底。
 *
 * 浏览器：<script src="shared/knowledge/ontology-operation-map.js"></script> 之后引入本文件 → global.GenOpSemantics
 * Node：const OpSem = require('./op-semantics.js')
 */
(function (global) {
  'use strict';

  var OpsMap = (typeof require === 'function')
    ? require('../../knowledge/ontology-operation-map.js')
    : (global.OntologyOperationMap || null);

  var NORM = {
    add: 'add', addition: 'add',
    sub: 'subtract', subtraction: 'subtract', subtract: 'subtract',
    mult: 'multiply', mul: 'multiply', multiplication: 'multiply', multiply: 'multiply',
    div: 'divide', division: 'divide', divide: 'divide',
    '+': 'add', '−': 'subtract', '-': 'subtract', '×': 'multiply', 'x': 'multiply', '÷': 'divide'
  };

  function normalize(opId) {
    if (typeof opId !== 'string') return null;
    if (NORM.hasOwnProperty(opId)) return NORM[opId];
    return OpsMap && OpsMap.semanticsFor(opId) ? opId : null;
  }

  function symbol(opId) {
    var n = normalize(opId);
    if (!n) return null;
    var s = OpsMap.semanticsFor(n);
    return s ? s.symbol : null;
  }

  function calc(opId) {
    var n = normalize(opId);
    if (!n) return null;
    var s = OpsMap.semanticsFor(n);
    return s ? s.calcMethod : null;
  }

  function visual(opId) {
    var n = normalize(opId);
    if (!n) return null;
    var s = OpsMap.semanticsFor(n);
    return s ? s.visualAlias : null;
  }

  var API = { normalize: normalize, symbol: symbol, calc: calc, visual: visual, NORM: NORM };

  global.GenOpSemantics = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));