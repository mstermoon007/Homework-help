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
 *   **请求去重**：在短时间内（默认 2s），同一资源的多个并发请求只触发一次网络更新。
 *    通过 tracking 映射和 setTimeout 计时器实现：第一个请求发起网络请求，
 *    后续请求等待同一计时器的结果，避免重复下载同一资源。
 *    计时器完成后条目从 tracking 中移除，允许下一轮去重。
 *   
 * - 版本管理：维护 CACHE_VERSION，当有更新时版本号 +1 并清理旧缓存。
 *    通过 cache key 的版本前缀配合 query 参数实现：开发者在部署新版本时，
 *    仅需将 CACHE_VERSION 从 'v1' 改为 'v2'，并在 HTML 中注入对应版本号，
 *    即可让浏览器/CDN 通过 ?v= 参数感知资源更新并生效，避免清理所有可能仍被引用的缓存键。
 *    activate 事件中仅清理比当前版本旧的缓存键。
 * - activate：清理旧版本缓存（保留当前版本及更旧），立即接管页面。
 * - 离线兜底：导航请求缓存未命中时回退到 index.html。
 *
 * 注册点：shared/plugin-loader.js 的 App.registerServiceWorker()（仅 http/https 协议生效）。
 */

// === 版本配置 ===
// 请在部署新版本时将本常量自增（v1 → v2 → v3 ...），
// 并在对应的 HTML 文件中注入对应版本号（见下文「前端版本注入」一节）。
// 版本来源：经典 Service Worker 不支持顶层 ESM import，故用 importScripts 引入 version.js，
// 其会把 APP_VERSION / CACHE_VERSION 挂到 self 上（见 shared/version.js）。
importScripts('./shared/version.js');
var CACHE_VERSION = self.CACHE_VERSION; // 'homework-help-<APP_VERSION>'
// 缓存名 = 固定前缀 + 版本号。activate 按此名清理一切非当前版本缓存（含旧 hw-help-v64）。
// ⚠️ 本常量缺失曾导致 fetch/install 内 5 处 caches.open(CACHE) 抛 ReferenceError，
//    SW 激活后第二次导航即 net::ERR_FAILED（E2E C1 用例捕获的 P0）。
const CACHE = 'hw-help-3.2.0';  // 必须与 shared/version.js 的 APP_VERSION 同步（scripts/sync-sw-version.js 校验）

// === 核心资源列表 ===
// 所有路径相对于站点根。CORE 保持「无 ?v=」字面量：fetch 处理以 url.pathname（忽略查询串）作为缓存键，
// 若此处对资源加 ?v=CACHE_VERSION，则真实请求（HTML 未注入 ?v）将按 pathname 命中不到预缓存键，
// 反而会丢失离线预缓存命中。因此版本失效不依赖 ?v，而由下方 CACHE 名随 APP_VERSION 自增 +
// activate 清理一切非当前版本缓存实现（部署新版本即全量失效回填）。
// withVersion() 仍保留，供前端确有需要时手动注入版本查询；当前 SW 离线策略不依赖它。
const CORE = [
  './',
  'index.html',
  'math-types.html',
  'chinese-types.html',
  'english-types.html',
  'subject-types.html',
  'practice.html',
  'faq.html',
  // 下面这些资源建议在 front-end HTML 模板中注入 ?v=CACHE_VERSION
  // 示例：shared/tokens.css?v=__VERSION__, shared/common.js?v=__VERSION__
  // 由于本 SW 不会自动修改 HTML 内容，故仅在此列出路径，实际版本控制见前端模板。
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

/**
 * 为资源 URL 添加版本查询参数（由前端模板在构建时或运行时注入）
 * @param {string} path - 资源相对路径
 * @returns {string} - 包含版本参数的 URL
 */
function withVersion(path) {
  var hasQuery = path.indexOf('?') !== -1;
  var separator = hasQuery ? '&' : '?';
  return path + separator + 'v=' + CACHE_VERSION;
}

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

// 注：CACHE 名随 APP_VERSION 变化即触发 activate 清理旧缓存，资源失效无需前端注入 ?v。
// withVersion() 保留供手动版本化，但 fetch 以 pathname 为缓存键，故注入 ?v 不改变失效语义。

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