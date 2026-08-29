// test/helpers.js — 测试公共装配
// 每个 node:test 文件在独立子进程中运行，因此在此统一挂载全局依赖：
//   - PluginUtil（shared/common.js 聚合器）
//   - PLUGIN_REGISTRY（插件注册表，综合/中文题型依赖）
//   - PINYIN_BANK（中文拼音题型数据源）
'use strict';
require('../shared/common.js');
if (typeof global.PLUGIN_REGISTRY === 'undefined') {
  try { global.PLUGIN_REGISTRY = require('../plugins/registry.js'); } catch (e) { /* 单插件测试无需 */ }
}
try { require('../pinyin-bank.js'); } catch (e) { /* 仅中文拼音题型需要 */ }

/** 调用插件 generate 并做最小健全校验；loader 已决定 grade 默认取值 */
function generate(plugin, opts) {
  var grade = (plugin.grades && plugin.grades[0]) || 1;
  var options = Object.assign({ grade: grade, count: 5, difficulty: 3 }, opts || {});
  return plugin.generate(options);
}

module.exports = { generate: generate };
