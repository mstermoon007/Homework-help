/**
 * shared/generator/generators/index.js — M4-R06 核心 Generator 索引
 *
 * Generator id → 工厂/实例映射。
 *   Arithmetic: addition / subtraction / multiplication / division / mixed-calculation
 *   Selection: fill / choice / judge
 *   Complex: complex-calc
 *   Shape: shape-recognition
 *   Position: position-direction
 *   Money: money-measurement
 *   Application: application-word
 *   Composite: composite
 */
'use strict';

// 数学生成引擎版本标签（V2.1：native-only 单轨 + 23 Generator 语义路由 +
// legacy 插件轨道退役 + math-g2-column 答案/check 归一化挂账清零）。
// 注意：这是「生成引擎」版本，与 shared/version.js 的 APP_VERSION（PWA 缓存版本）是两个独立概念。
var ENGINE_VERSION = '2.1.0';

var Arithmetic = require('./arithmetic.js');
var Selection = require('./selection.js');
var Complex = require('./complex.js');
var Shape = require('./shape.js');
var Position = require('./position.js');
var Money = require('./money.js');
var Application = require('./application.js');
var Composite = require('./composite.js');
var Counting = require('./counting.js');
var Reasoning = require('./reasoning.js');
var Stats = require('./stats.js');
var PictureEquation = require('./picture-equation.js');
var C1 = require('./c1-number-puzzle.js');
var C2 = require('./c2-number-theory.js');
var C5C6 = require('./c5-c6-journey-engineering.js');
var C7 = require('./c7-clever-calc.js');
var C9 = require('./c9-comprehensive.js');
var SemanticSpecial = require('./semantic-special.js');

var ALL = [].concat(
  Arithmetic.buildAll(),
  Selection.buildAll(),
  Complex.buildAll(),
  Shape.buildAll(),
  Position.buildAll(),
  Money.buildAll(),
  Application.buildAll(),
  Composite.buildAll(),
  Counting.buildAll(),
  Reasoning.buildAll(),
  Stats.buildAll(),
  PictureEquation.buildAll(),
  C1.buildAll(),
  C2.buildAll(),
  C5C6.buildAll(),
  C7.buildAll(),
  C9.buildAll(),
  SemanticSpecial.buildAll()
);

var BY_ID = {};
ALL.forEach(function (g) { BY_ID[g.id] = g; });

module.exports = {
  ENGINE_VERSION: ENGINE_VERSION,
  ALL: ALL,
  BY_ID: BY_ID,
  get: function (id) { return BY_ID[id] || null; }
};
