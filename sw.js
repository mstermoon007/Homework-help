/**
 * sw.js — Homework Help 离线缓存 Service Worker
 *
 * 策略：
 * - install：预缓存核心壳页（各 HTML、shared/、pinyin-bank.js、assets、registry.js、插件文件），
 *    并从 registry.js 解析出全部插件文件路径一并预缓存，实现「缓存所有插件和共享文件」。
 *    **版本控制**：在 CORE 数组中通过 `?v=` 查询参数维护版本号，便于在插件/共享文件更新时强制浏览器/CDN 回填新缓存。
 * - fetch（任务：SWR 升级 + 请求去重）：
 *   同源静态 GET 采用 stale-while-revalidate：
 *   缓存命中立即返回（x-sw-strategy: swr-cache），同时后台拉取最新并回写缓存。
 *   未命中则走网络、回填后首响。导航请求保留 network-first（无哈希文件名下防止新旧 HTML/JS 错配）。
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
 * 注册点：shared/common.js 的 App.registerServiceWorker()（仅 http/https 协议生效）。
 */

// === 版本配置 ===
// 请在部署新版本时将本常量自增（v1 → v2 → v3 ...），
// 并在对应的 HTML 文件中注入对应版本号（见下文「前端版本注入」一节）。
/** Shared version module — imported from shared/version.js */
import { CACHE_VERSION } from './shared/version.js';
// 缓存名 = 固定前缀 + 版本号。activate 按此名清理一切非当前版本缓存（含旧 hw-help-v64）。
// ⚠️ 本常量缺失曾导致 fetch/install 内 5 处 caches.open(CACHE) 抛 ReferenceError，
//    SW 激活后第二次导航即 net::ERR_FAILED（E2E C1 用例捕获的 P0）。
const CACHE = 'hw-help-' + CACHE_VERSION;

// === 核心资源列表 ===
// 所有路径相对于站点根（home.modouyu.top），CDN 会根据 CACHE_VERSION 自动补全缓存键策略。
// 笔记：HTML 入口页（index.html、math-types.html 等）不添加 ?v=，保持 no-cache；
// 非入口页资源（shared/、插件、SVG 生成器等）请在前端 index.html 中通过模板注入 ?v=CACHE_VERSION，
// 以实现「HTML 即时生效 + 资源长缓存 + 更新时自动回填」的混合策略。
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

// === 请求去重调度：key -> { promise, timer }
var requestQueue = {};

/** 发起（或等待）一次去重的网络请求 */
function makeRequest(key, url) {
  // 若已有进行中的请求，直接返回相同的 Promise，避免重复下载
  if (requestQueue[key]) {
    return requestQueue[key];
  }

  // 首次请求：创建计时器并发起网络请求
  var timer = setTimeout(function () {
    // 计时器完成：从 tracking 中移除，允许下一轮去重
    delete requestQueue[key];
  }, 2000); // 2秒去重窗口

  var promise = fetch(url).then(function (res) {
    // 成功后回写缓存（静默，不影响响应）
    var cacheName = CACHE;
    caches.open(cacheName).then(function (cache) {
      try { cache.put(key, res.clone()); } catch (_) {}
    });
    return res;
  }).catch(function () {
    // 网络失败：不改变缓存状态，让调用端得到 undefined / 错误响应
    return null;
  });

  // 记入调度，等待中的请求将拿到同一 promise
  requestQueue[key] = promise;

  return promise;
}

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

// 注入版本参数到 CORE 中需要长缓存的资源
// 仅在前端 HTML 模板中使用：document.write('<script src="shared/common.js?v=' + CACHE_VERSION + '"></script>')
// 这些路径在 SW 层仅作逻辑 reference，实际版本控制由前端模板注入决定。
// 入口页 HTML 不应添加 v 参数，以保持 no-cache 行为；非入口资源建议在 HTML 中注入 v=版本号。

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
      // 删除一切非当前版本的缓存（旧版本号前缀匹配 '/NaN' 的写法永远匹配不到，已废弃）
      return Promise.all(keys.filter(function (k) {
        return k !== CACHE;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
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

  // 同源静态资源：stale-while-revalidate + 请求去重
  // 关键：用路径名作为去重 Key，避免同一 CSS/JS 文件的并发请求导致多次下载
  // 注意：若资源已在 HTML 中注入 ?v=CACHE_VERSION，则 Key 应包含该参数以保证版本有效性
  var cacheKey = url.pathname; // 仅路径，忽略查询串/哈希，保证去重有效

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(cacheKey).then(function (hit) {
        // 后台再验证：无论是否命中都发起网络请求刷新缓存（失败静默，不影响响应）
        var network = makeRequest(cacheKey, req).then(function (res) {
          // 成功回写缓存（静默）
          if (res) {
            try { cache.put(cacheKey, res.clone()); } catch (_) {}
          }
          return res;
        }).catch(function () { return null; });
        if (e.waitUntil) e.waitUntil(network);

        if (hit) {
          // 命中：立即以缓存响应，标记策略
          try {
            var served = hit.clone();
            var h = new Headers(served.headers);
            h.set('x-sw-strategy', 'swr-cache');
            return new Response(served.body, { status: served.status, statusText: served.statusText, headers: h });
          } catch (_) { return hit; }
        }
        // 未命中：等待网络请求（去重调度），成功则已回填缓存
        return network.then(function (res) {
          if (res) {
            try {
              var h2 = new Headers(res.headers);
              h2.set('x-sw-strategy', 'swr-network');
              return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h2 });
            } catch (_) { return res; }
          }
          return new Response('', { status: 504, statusText: 'offline' });
        });
      });
    })
  );
});