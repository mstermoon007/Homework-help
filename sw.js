/**
 * sw.js — Homework Help 离线缓存 Service Worker
 *
 * 策略：
 * - install：预缓存核心壳页（各 HTML、shared/、pinyin-bank.js、assets、registry.js、插件文件），
 *    并从 registry.js 解析出全部插件文件路径一并预缓存，实现「缓存所有插件和共享文件」。
 *    **版本控制**：在 CORE 数组中通过 `?v=` 查询参数维护版本号，便于在插件/共享文件更新时强制浏览器/CDN 回填新缓存。
 * - fetch：同源静态资源采用 Cache-First（命中即返回，未命中走网络并回填），
 *   配合 HTML 注入的 ?v=<版本号> 与完整 URL 缓存键，每个版本形成独立缓存条目，
 *   版本升级即令旧缓存失效，彻底避免新旧样式混排。导航请求保留 network-first。
 *   
 * - 版本管理：缓存名 CACHE = 'hw-help-' + APP_VERSION；部署新版本时 APP_VERSION 自增，
 *    activate 清理一切非当前版本缓存，使全部静态资源（含样式）整体失效并回填。
 * - activate：清理旧版本缓存（保留当前版本及更旧），立即接管页面。
 * - 离线兜底：导航请求缓存未命中时回退到 index.html。
 *
 * 注册点：shared/plugin-loader.js 的 App.registerServiceWorker()（仅 http/https 协议生效）。
 */

// === 版本配置 ===
// 版本来源：经典 Service Worker 不支持顶层 ESM import，故用 importScripts 引入 version.js，
// 其会把 APP_VERSION 挂到 self 上（见 shared/version.js）。CACHE 名必须与 APP_VERSION 同步。
importScripts('./shared/version.js');
// 缓存名 = 固定前缀 + 版本号。activate 按此名清理一切非当前版本缓存（含旧 hw-help-v64）。
// ⚠️ 本常量缺失曾导致 fetch/install 内 5 处 caches.open(CACHE) 抛 ReferenceError，
//    SW 激活后第二次导航即 net::ERR_FAILED（E2E C1 用例捕获的 P0）。
const CACHE = 'hw-help-3.3.0';  // 必须与 shared/version.js 的 APP_VERSION 同步（scripts/sync-sw-version.js 校验）

// === 核心资源列表 ===
// 所有路径相对于站点根。CORE 保持「无 ?v=」字面量：运行时 HTML 已由 scripts/add-asset-version.js
// 注入 ?v=APP_VERSION，fetch 以完整 URL（含 ?v）为缓存键，故版本升级后旧 ?v URL 不再命中 →
// 走网络取新资源；旧缓存随 activate 清理整体失效。
const CORE = [
  './',
  'index.html',
  'math-types.html',
  'chinese-types.html',
  'english-types.html',
  'subject-types.html',
  'practice.html',
  'faq.html',
  // 这些静态资源在部署时由 scripts/add-asset-version.js 自动注入 ?v=APP_VERSION（见 HTML 产物）。
  'shared/tokens.css',
  'shared/base.css',
  'shared/components.css',
  'shared/states.css',
  'shared/toolbar.css',
  'shared/pages.css',
  'shared/common.js',
  'shared/subject-utils.js',
  'shared/difficulty.js',
  'assets/banner.webp',
  'assets/logo.webp',
  'assets/logo-math.webp',
  'assets/logo-chinese.webp',
  'assets/logo-english.webp',
  'shared/print.js',
  'shared/knowledge-bank.js',
  'shared/knowledge-math.js',
  'shared/knowledge-cn.js',
  'shared/knowledge-en.js',
  'shared/module-catalog.js',
  'shared/plugin-types.js',
  'shared/svg-core.js',
  'shared/svg-calculation.js',
  'shared/svg-geometry.js',
  'shared/svg-make-ten.js',
  'shared/svg-chinese.js',
  'shared/svg-english.js',
  'pinyin-bank.js',
  'plugins/registry.js'
];

// （版本查询参数由 front-end 构建：scripts/add-asset-version.js 注入 ?v=APP_VERSION）

/**
 * 从 registry.js 文本提取插件文件路径：file: 'plugins/xxx.js'
 */
function pluginFilesFromRegistry(text) {
  var files = [];
  var re = /file:\s*'([^']+\.js)'/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (files.indexOf(m[1]) === -1) files.push(m[1]);
  }
  return files;
}

// 逐个缓存（单个失败不影响整体安装）——与 install 内 cacheAll(cache, CORE) 调用配套。
// ⚠️ SWR 重写时曾丢失本函数定义，install 事件抛 ReferenceError（被吞，静默跳过全部预缓存）。
function cacheAll(cache, list) {
  return Promise.all(list.map(function (url) {
    return cache.add(url).catch(function () { /* 忽略单个失败 */ });
  }));
}

// 注：CACHE 名随 APP_VERSION 变化即触发 activate 清理旧缓存，全部静态资源整体失效并回填。

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cacheAll(cache, CORE);
    }).then(function () {
      // 解析 registry.js，预缓存全部插件文件
      return fetch('plugins/registry.js')
        .then(function (r) { return r.text(); })
        .then(function (txt) {
          var files = pluginFilesFromRegistry(txt);
          return caches.open(CACHE).then(function (c) { return cacheAll(c, files); });
        })
        .catch(function () { /* 解析失败不阻塞安装，运行时再缓存 */ });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      // 清理旧版本缓存，保留当前 CACHE
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); }) // 立即控制所有页面
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // 仅处理同源
  if (url.pathname.endsWith('/sw.js')) return;                // SW 自身永不缓存

  // 导航请求（HTML）：network-first 新鲜度护栏 + 离线回退（缓存键忽略查询串）
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(url.pathname, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(url.pathname).then(function (hit) {
          return hit || caches.match('index.html') || new Response('', { status: 504, statusText: 'offline' });
        });
      })
    );
    return;
  }

  // 同源静态资源（CSS/JS/图片等）：Cache-First。
  // 配合 HTML 注入的 ?v=<版本号> 与完整 URL 缓存键，每个版本形成独立缓存条目；
  // 版本升级后旧 ?v URL 不再被请求 → 直接取新资源，彻底避免新旧样式混排。
  e.respondWith(cacheFirst(req));
});

// 缓存优先：命中即返回，未命中走网络并回填缓存
function cacheFirst(request) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.ok) {
          try { cache.put(request, response.clone()); } catch (_) {}
        }
        return response;
      });
    });
  });
}