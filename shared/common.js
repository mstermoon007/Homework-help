/**
 * shared/common.js — 共享基础模块（站点 + 插件，统一入口 · 任务 3.2 聚合出口）
 *
 * 旧版单体（~1160 行）已拆分为职责单一的子模块（均 <300 行，增量挂载到 window.PluginUtil / window.App）：
 *   core.js        运行时核心：站点常量/路由/年级参数、随机·标准化工具、灵活列数布局、知识点覆盖
 *   plugin-loader.js 插件脚本加载器 PluginLoader + ServiceWorker 注册
 *   render.js       renderCard / renderGrid / clockSVG / createPlugin 及科目化工厂
 *   check.js        defaultQCheck / computeResult / pickOpt
 *   ui-state.js     escHtml / UIState
 *   storage.js      本地练习状态持久化 StorageManager
 *
 * 浏览器：经 document.write 按站点根相对路径注入子模块（路径由 document.currentScript.src 推导，
 *         兼容各页面从不同深度引用 shared/common.js）；子模块自挂载后本文件无需再组装。
 * Node：经 require 加载子模块并导出 PluginUtil（保持 `const PluginUtil = require('./shared/common.js')` 契约不变）。
 *
 * 浏览器：<script src="shared/common.js"></script>
 *   全局 App：页面路由、年级参数、页面控制器
 *   全局 PluginUtil：插件随机/标准化工具（插件内不得直接用 Math.random()）
 * Node：const PluginUtil = require('./shared/common.js')
 */
(function (global) {
  'use strict';

  if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.currentScript) {
    // 浏览器：推导 shared/ 目录（兼容页面从不同深度引用本文件），注入子模块
    var base = (document.currentScript.src || 'shared/common.js').replace(/[^\/]*$/, '');
    document.write('<script src="' + base + 'core.js"></script>');
    document.write('<script src="' + base + 'plugin-loader.js"></script>');
    document.write('<script src="' + base + 'render.js"></script>');
    document.write('<script src="' + base + 'check.js"></script>');
    document.write('<script src="' + base + 'ui-state.js"></script>');
    document.write('<script src="' + base + 'storage.js"></script>');
  } else if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    // Node：子模块经 require 加载后已增量挂载到 global.PluginUtil / global.App
    require('./core.js');
    require('./plugin-loader.js');
    require('./render.js');
    require('./check.js');
    require('./ui-state.js');
    require('./storage.js');
  }

  // 兜底：确保 App / PluginUtil 存在（子模块已增量挂载，这里仅防御性补全）
  global.App = global.App || {};
  global.PluginUtil = global.PluginUtil || {};

  if (typeof module !== 'undefined' && module.exports) module.exports = global.PluginUtil;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
