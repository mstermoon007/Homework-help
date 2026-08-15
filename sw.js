/**
 * sw.js — Homework Help 离线缓存 Service Worker
 *
 * 策略：
 *  - install：预缓存核心壳页（各 HTML、shared/、pinyin-bank.js、banner.jpg、registry.js），
 *    并从 plugins/registry.js 解析出全部插件文件路径一并预缓存，实现「缓存所有插件和共享文件」。
 *  - fetch：同源 GET 采用 cache-first；未命中再走网络并回填缓存（运行时持续扩充缓存）。
 *  - activate：清理旧版本缓存，立即接管页面。
 *  - 离线兜底：导航请求缓存未命中时回退到 index.html。
 *
 * 注册点：shared/common.js 的 App.registerServiceWorker()（仅 http/https 协议生效）。
 */
const CACHE = 'hw-help-v26';

const CORE = [
  './',
  'index.html',
  'math-types.html',
  'chinese-types.html',
  'english-types.html',
  'practice.html',
  'shared/common.css',
  'shared/tokens.css',
  'shared/toolbar.css',
  'shared/common.js',
  'shared/print.js',
  'shared/knowledge-bank.js',
  'shared/plugin-types.js',
  'pinyin-bank.js',
  'banner.jpg',
  'assets/logo.png',
  'assets/logo-math.png',
  'assets/logo-chinese.png',
  'assets/logo-english.png',
  'plugins/registry.js'
];

// 逐个缓存（单个失败不影响整体安装）
function cacheAll(cache, list) {
  return Promise.all(list.map(function (url) {
    return cache.add(url).catch(function () { /* 忽略单个失败 */ });
  }));
}

// 从 registry.js 文本提取插件文件路径：file: 'plugins/xxx.js'
function pluginFilesFromRegistry(text) {
  var files = [];
  var re = /file:\s*'([^']+\.js)'/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (files.indexOf(m[1]) === -1) files.push(m[1]);
  }
  return files;
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return cacheAll(c, CORE);
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
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 仅缓存同源静态资源

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // 离线且缓存未命中：导航请求回退首页，其余返回离线提示
        if (req.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 504, statusText: 'offline' });
      });
    })
  );
});
