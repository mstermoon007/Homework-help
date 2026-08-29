/**
 * shared/plugin-loader.js — 插件脚本加载器（任务 3.2 拆分）
 *
 * 统一所有页面/插件的脚本加载：scriptCache 去重、pluginCache 缓存、竞态安全、
 * deps 依赖链、5 秒超时；并注册 Service Worker 离线缓存。
 * 增量挂载到 window.App.PluginLoader / window.App.registerServiceWorker。
 */
(function (global) {
  'use strict';

  // ============ 插件脚本加载器 PluginLoader ============
  // 统一所有页面/插件的脚本加载，提供：
  //  - scriptCache：同 url 只请求一次（避免重复请求，Promise 复用）
  //  - pluginCache：已加载的插件对象按 id 缓存（避免重复注入）
  //  - 竞态安全：每个脚本 onload 时立即抓取 window.__currentPlugin，
  //    配合 async=false 保证多脚本按追加顺序执行，解决「多插件共用全局被覆盖」问题
  //  - deps 依赖链：registry 条目的 deps 先于主文件加载
  //  - 5 秒超时：单脚本加载失败不卡死整页
  var PluginLoader = (function () {
    var scriptCache = {};   // url -> Promise（去重，避免重复请求）
    var pluginCache = {};   // id  -> plugin object（已加载插件对象）
    var META = {};          // url -> 该脚本 onload 时捕获的 window.__currentPlugin
    var TIMEOUT = 5000;

    // 脚本 onload 时立即抓取刚注入的插件元数据（此时 window.__currentPlugin 即本脚本所设）
    function capture(url) {
      var meta = global.__currentPlugin || null;
      META[url] = meta;
      return meta;
    }

    function loadScript(src) {
      if (scriptCache[src]) return scriptCache[src];
      var p;
      if (typeof global.document === 'undefined') {
        // Node 环境（CLI/测试）：同步 require 回退。
        // 本模块位于 shared/，站点根相对路径（plugins/xxx.js、根级文件）需回退一级。
        if (typeof require === 'undefined') {
          p = Promise.resolve(null);
        } else {
          p = new Promise(function (resolve, reject) {
            try {
              var rel = String(src).replace(/^\.\//, '');
              if (rel.indexOf('../') !== 0) rel = '../' + rel; // 站点根相对 → shared/ 的上一级
              var mod = require(rel);
              var meta = (mod && mod.generate) ? mod : (global.__currentPlugin || null);
              if (meta) global.__currentPlugin = meta;
              META[src] = meta;
              resolve(meta);
            } catch (e) {
              reject(e);
            }
          });
        }
      } else {
        p = new Promise(function (resolve, reject) {
          var s = global.document.createElement('script');
          s.src = src;
          s.async = false; // 保证按追加顺序执行，配合 onload 抓取 __currentPlugin 无竞态
          var done = false;
          var timer = setTimeout(function () {
            if (done) return; done = true;
            reject(new Error('脚本加载超时（5 秒）：' + src));
          }, TIMEOUT);
          s.onload = function () {
            if (done) return; done = true; clearTimeout(timer);
            resolve(capture(src));
          };
          s.onerror = function () {
            if (done) return; done = true; clearTimeout(timer);
            reject(new Error('脚本加载失败：' + src));
          };
          global.document.head.appendChild(s);
        });
      }
      scriptCache[src] = p;
      return p;
    }

    function loadPlugin(record) {
      if (!record || !record.id) return Promise.reject(new Error('loadPlugin: 缺少 registry 条目 id'));
      if (pluginCache[record.id]) return Promise.resolve(pluginCache[record.id]);
      var src = record.file || ('plugins/' + record.id + '.js');
      var chain = Promise.resolve();
      (record.deps || []).forEach(function (dep) {
        chain = chain.then(function () { return loadScript(dep); });
      });
      return chain.then(function () {
        return loadScript(src).then(function (meta) {
          var p = meta || global.__currentPlugin || null;
          if (!p || !p.generate || !p.render || !p.check) {
            throw new Error('插件接口不兼容（需要 generate/render/check）：' + src);
          }
          pluginCache[record.id] = p;
          global.__currentPlugin = p; // 同步全局，兼容既有消费方
          return p;
        });
      });
    }

    // 加载某学科某年级的全部插件，返回插件对象数组（按年级过滤）
    function loadSubjectPlugins(subject, grade) {
      var reg = (typeof global.PLUGIN_REGISTRY !== 'undefined') ? global.PLUGIN_REGISTRY : [];
      var list = reg.filter(function (r) { return r.subject === subject; });
      return Promise.all(list.map(function (r) {
        return loadPlugin(r).then(function (p) {
          if (!p) return null;
          if (grade != null && p.grades && p.grades.indexOf(Number(grade)) === -1) return null;
          return p;
        });
      })).then(function (arr) { return arr.filter(Boolean); });
    }

    // 预热：不等待，提前请求脚本（减少点击延迟；配合 Service Worker 跨页复用缓存）
    function prefetch(records) {
      (records || []).forEach(function (r) {
        if (!r) return;
        if (r.file) loadScript(r.file);
        else if (r.id) loadPlugin(r);
      });
    }

    function reset() { scriptCache = {}; pluginCache = {}; META = {}; }

    return {
      TIMEOUT: TIMEOUT,
      loadScript: loadScript,
      loadPlugin: loadPlugin,
      loadSubjectPlugins: loadSubjectPlugins,
      prefetch: prefetch,
      reset: reset
    };
  })();

  // ============ Service Worker 离线缓存注册（浏览器 + http/https） ============
  function registerServiceWorker() {
    try {
      if (typeof global.navigator === 'undefined' || !('serviceWorker' in global.navigator)) return;
      if (!global.location || global.location.protocol.indexOf('http') !== 0) return; // file:// 不支持 SW
      var host = global.location.hostname;
      // 本地预览（localhost/127.0.0.1）直连网络，不注册 SW；并主动注销/清理已存在的旧 SW 与旧缓存，
      // 避免上一版本残留的 SW 继续用旧缓存控制页面（新旧样式混排）。无需手动到 DevTools 清除。
      if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
        if (global.navigator.serviceWorker && global.navigator.serviceWorker.getRegistrations) {
          global.navigator.serviceWorker.getRegistrations().then(function (regs) {
            regs.forEach(function (r) { r.unregister(); });
          }).catch(function () { /* 忽略 */ });
        }
        if (global.caches && global.caches.keys) {
          global.caches.keys().then(function (keys) {
            keys.forEach(function (k) { global.caches.delete(k); });
          }).catch(function () { /* 忽略 */ });
        }
        return;
      }
      global.addEventListener('load', function () {
        global.navigator.serviceWorker.register('./sw.js').catch(function () { /* 忽略注册失败 */ });
      });
    } catch (e) { /* 忽略 */ }
  }

  // ============ 增量挂载 ============
  global.App = global.App || {};
  global.PluginLoader = PluginLoader;
  global.App.PluginLoader = PluginLoader;
  global.App.registerServiceWorker = registerServiceWorker;
  // 浏览器环境下自动注册 Service Worker（离线可用 + 跨页复用插件缓存，减少点击延迟）
  if (typeof window !== 'undefined' && typeof global.navigator !== 'undefined') {
    registerServiceWorker();
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PluginLoader: PluginLoader, registerServiceWorker: registerServiceWorker };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
