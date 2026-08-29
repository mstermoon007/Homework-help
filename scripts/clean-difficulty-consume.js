#!/usr/bin/env node
/*
 * 阶段4 一次性清理：将插件内 Difficulty.consume 调用替换为工厂注入的 opts.difficultyParams。
 * 仅处理「无模块级 _DIFF 变量」的插件（_DIFF 仅作为隐式全局在 generate 内使用）。
 * 含模块级 _DIFF（math-money 等 6 个）由人工处理。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const FILES = [
  'math-g6-calc', 'math-oral', 'math-g6-oral', 'math-patterns',
  'math-logic-reasoning', 'math-number-sense', 'math-shapes', 'math-geometry',
  'math-decimal', 'math-picture-equations', 'math-data-stats', 'math-g4-vertical',
  // 含模块级 _DIFF 的 6 个（_DIFF 仅经 generate 闭包可达，故全局替换 _DIFF->dpLevel 安全）
  'math-money', 'math-statistics', 'math-make-ten', 'math-fraction', 'math-area', 'math-unit-convert'
].map(n => path.join(ROOT, 'plugins', n + '.js'));

FILES.forEach(file => {
  let text = fs.readFileSync(file, 'utf8');
  // 1) 导入守卫：不再要求 .consume
  text = text.replace(/!_D\.consume/g, '!_D.paramsFor');
  // 2) 注释中的 consume 引用（保留语义连贯，仅移除 Difficulty.consume 字面量）
  text = text.replace(/App\.Difficulty\.consume/g, 'App.Difficulty.paramsFor');
  // 2b) 删除模块级 _DIFF 声明
  text = text.replace(/var _DIFF = 3;\s*/g, '');
  // 3) 消费调用替换为注入参数 + 局部变量
  text = text.replace(/var prof = _D\.consume\((\w+)\);/g, (m, NAME) => {
    return `var dp = ${NAME}.difficultyParams || (_D && _D.paramsFor ? _D.paramsFor('math', (${NAME}.difficulty != null ? ${NAME}.difficulty : (${NAME}.level || 3))) : { level: ${NAME}.difficulty != null ? ${NAME}.difficulty : (${NAME}.level || 3) });\n      var dpLevel = dp.level, dpScale = dp.scale, dpSteps = dp.steps, dpAllowBracket = dp.allowBracket, dpAllowMultDiv = dp.allowMultDiv, dpHasOwnLevel = (${NAME}.level != null && ${NAME}.level !== '');`;
  });
  // 4) 删除隐式全局 _DIFF 赋值（_DIFF = prof.effectiveLevel;）
  text = text.replace(/^\s*_DIFF = prof\.effectiveLevel;\s*$/gm, '');
  // 5) prof.* 字段映射
  text = text.replace(/prof\.effectiveLevel/g, 'dpLevel');
  text = text.replace(/prof\.scale/g, 'dpScale');
  text = text.replace(/prof\.structure\./g, '');
  text = text.replace(/prof\.structure/g, 'dp');
  text = text.replace(/prof\.hasOwnLevel/g, 'dpHasOwnLevel');
  // 6) 隐式全局 _DIFF 读取 -> dpLevel（这些文件 _DIFF 仅在 generate 内使用）
  text = text.replace(/\b_DIFF\b/g, 'dpLevel');

  fs.writeFileSync(file, text);
  console.log('✅ ' + path.basename(file));
});
console.log('\n完成（无模块级 _DIFF 的插件）。含模块级 _DIFF 的 6 个文件请人工处理。');
