/**
 * shared/generator/generators/index.js — M4-R06 核心 Generator 索引
 *
 * Generator id → 工厂/实例映射。首批 8 个：
 *   addition / subtraction / multiplication / division / mixed-calculation
 *   fill / choice / judge
 */
'use strict';

var Arithmetic = require('./arithmetic.js');
var Selection = require('./selection.js');
var Complex = require('./complex.js');

var ALL = [].concat(
  Arithmetic.buildAll(),
  Selection.buildAll(),
  Complex.buildAll()
);

var BY_ID = {};
ALL.forEach(function (g) { BY_ID[g.id] = g; });

module.exports = {
  ALL: ALL,
  BY_ID: BY_ID,
  get: function (id) { return BY_ID[id] || null; }
};
