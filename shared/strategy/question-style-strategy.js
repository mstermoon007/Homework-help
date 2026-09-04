/**
 * shared/strategy/question-style-strategy.js — M3-13 Question Style Strategy
 *
 * 题目固定样式统筹：根据「知识点类别 × 题型」决定题目的固定视觉样式（SVG 模板族）。
 *
 * 目标：每个知识点 + 题型都有确定性的固定样式，生成层据此渲染统一外观；
 *       样式是「知识点与题目固定样式」的映射层，与难度（复杂度档）解耦——
 *       复杂度影响题目内容（数值范围/步数/混合度），样式影响呈现骨架。
 *
 * 样式族（style）与 SVG 模板：
 *   calc      → 计算式（横式/竖式，svg-calculation）
 *   fill      → 填空格（算式留空 / 数轴填数）
 *   choice    → 选项卡（A/B/C/D 单选）
 *   judge     → 判断陈述（对/错）
 *   apply     → 图文应用（生活场景 + 条件陈述）
 *   shape     → 图形操作（立体/平面图形，svg-geometry）
 *   link      → 连线配对（svg-geometry 连线）
 *   open      → 开放表达（自由作答区）
 */
'use strict';

var StrategyError = require('./strategy-error.js').StrategyError;
var CODES = require('./strategy-error.js').StrategyError.CODES;

// 固定样式注册表：questionTypeId → 样式族（含 SVG 模板族引用）
var STYLE_REGISTRY = {
  calc:     { style: 'calc',   svgTemplate: 'svg-calculation', label: '计算式' },
  oral:     { style: 'calc',   svgTemplate: 'svg-calculation', label: '口算' },
  fill:     { style: 'fill',   svgTemplate: 'svg-calculation', label: '填空格' },
  choice:   { style: 'choice', svgTemplate: 'svg-choice',      label: '选项卡' },
  judge:    { style: 'judge',  svgTemplate: 'svg-judge',       label: '判断陈述' },
  apply:    { style: 'story',  svgTemplate: 'svg-story',       label: '图文应用' },
  geometry: { style: 'shape',  svgTemplate: 'svg-geometry',    label: '图形操作' },
  recognize: { style: 'choice', svgTemplate: 'svg-choice',     label: '认读识别' },
  open:     { style: 'open',   svgTemplate: 'svg-open',        label: '开放表达' }
};

// 知识点类别对样式的修正（同一题型在不同类别下微调呈现骨架）
var CATEGORY_STYLE_OVERRIDE = {
  geometry: { calc: 'shape' },     // 几何类出计算 → 图形计算
  measurement: { apply: 'story' }, // 度量类应用 → 图文应用（含单位）
  synthesis: { choice: 'choice' }
};

/**
 * 解析题目的固定样式。
 * options: {
 *   questionTypeId: string,   // canonical 题型
 *   category: string,         // 知识点类别 algebra|geometry|measurement|synthesis
 *   knowledgePointId: string  // 仅用于错误提示
 * }
 * 输出：{ style, svgTemplate, label }
 */
function resolveQuestionStyle(options) {
  options = options || {};
  var qt = options.questionTypeId;
  if (typeof qt !== 'string' || !qt) {
    throw new StrategyError('questionTypeId 必填字符串', CODES.INVALID_REQUEST, { questionTypeId: qt });
  }
  var base = STYLE_REGISTRY[qt];
  if (!base) {
    throw new StrategyError('未知题型，无法确定固定样式: ' + qt, CODES.INVALID_REQUEST, { questionTypeId: qt, knowledgePointId: options.knowledgePointId });
  }
  var style = base.style;
  var category = options.category;
  if (category && CATEGORY_STYLE_OVERRIDE[category] && CATEGORY_STYLE_OVERRIDE[category][qt]) {
    style = CATEGORY_STYLE_OVERRIDE[category][qt];
  }
  return {
    style: style,
    svgTemplate: base.svgTemplate,
    label: base.label
  };
}

/** 列出全部固定样式族（供 SVG 整理/文档/校验使用） */
function listStyles() {
  var seen = {};
  var out = [];
  Object.keys(STYLE_REGISTRY).forEach(function (qt) {
    var r = STYLE_REGISTRY[qt];
    if (seen[r.style]) return;
    seen[r.style] = true;
    out.push({ style: r.style, svgTemplate: r.svgTemplate, label: r.label });
  });
  return out;
}

module.exports = {
  resolveQuestionStyle: resolveQuestionStyle,
  listStyles: listStyles,
  STYLE_REGISTRY: STYLE_REGISTRY
};
