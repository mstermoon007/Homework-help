// test/helpers.js — 测试公共装配
// 每个 node:test 文件在独立子进程中运行，因此在此统一挂载全局依赖：
//   - PluginUtil（shared/core/common.js 聚合器）
// MATH-14：legacy 插件轨道已删除，不再装配 PLUGIN_REGISTRY。
'use strict';
require('../shared/core/common.js');

/** 调用插件 generate 并做最小健全校验；loader 已决定 grade 默认取值 */
function generate(plugin, opts) {
  var grade = (plugin.grades && plugin.grades[0]) || 1;
  var options = Object.assign({ grade: grade, count: 5, difficulty: 3 }, opts || {});
  return plugin.generate(options);
}

module.exports = { generate: generate };
