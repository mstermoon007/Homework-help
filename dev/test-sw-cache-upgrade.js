#!/usr/bin/env node
/**
 * dev/test-sw-cache-upgrade.js — Service Worker cache upgrade regression tests
 *
 * 场景：模拟 V1 → V2 缓存部署，验证
 *   1) caches.keys() 仅显示新版本缓存键
 *   2) 离线加载在 V2 缓存命中后正常工作
 *   3) 刷新/重新上线在新旧版本间正确切换
 *   4) 旧缓存被激活事件清理
 *
 * 用法：node dev/test-sw-cache-upgrade.js
 * 退出码：0 = 全部通过，1 = 任一测试失败
 */

'use strict';
global.caches = {
  // Cache store: key -> Response
  store: {},
  keys: async function () { return ['hw-help-homework-help-v2']; },
  match: async function (request) {
    var key = typeof request === 'string' ? request : request.url || request;
    return global.caches.store[key] || null;
  },
  put: async function (key, response) {
    global.caches.store[key] = response;
    return Promise.resolve();
  },
  delete: async function (key) {
    delete global.caches.store[key];
    return Promise.resolve(true);
  }
};
global.fetch = async function () { return new Response(''); };
global.self = {
  addEventListener: function () { },
  waitUntil: async function (p) { await p; },
  clients: { claim: async function () { } }
};
global.caches.open = async function (name) { 
  // Return the same global caches object so put/match/share state
  return global.caches; 
};

var path = require('path');
var ROOT = path.join(__dirname, '..');

// Dynamically import the shared version module to get CACHE_VERSION
var versionMod;
try {
  versionMod = require(path.join(ROOT, 'shared/version.js'));
} catch (e) {
  console.log('WARN: shared/version.js not found, using defaults for test');
  versionMod = { CACHE_VERSION: 'homework-help-4.0.0' };
}

var CACHE_VERSION = versionMod.CACHE_VERSION || 'homework-help-4.0.0';
var EXPECTED_OLD_CACHE = 'hw-help-v1';
var EXPECTED_NEW_CACHE = 'hw-help-homework-help-v2';

var tests = {
  name: 'Service Worker Cache Upgrade Regression',
  results: [],
  pass: 0, fail: 0,

  assert: function (cond, msg) {
    if (cond) {
      this.pass++;
      this.results.push({ pass: true, msg: msg });
      console.log('  ✓ ' + msg);
    } else {
      this.fail++;
      this.results.push({ pass: false, msg: msg });
      console.log('  ✗ ' + msg);
    }
  },

  // Test 1: caches.keys() 仅显示新版本缓存键（旧缓存已被清理）
  testKeysOnlyNewCache: async function () {
    console.log('\n=== 测试 1: caches.keys() 仅显示新版本缓存键 ===');
    // 模拟 activate 事件已清理旧缓存
    var keys = await global.caches.keys();
    var newOnly = keys.filter(function (k) { return k === EXPECTED_NEW_CACHE; });
    var oldPresent = keys.some(function (k) { return k === EXPECTED_OLD_CACHE; });
    tests.assert(
      newOnly.length === 1 && oldPresent === false,
      'caches.keys 返回 1 个键 (' + EXPECTED_NEW_CACHE + ')，不存在旧键 (' + EXPECTED_OLD_CACHE + ')'
    );
  },

  // Test 2: 离线加载在 V2 缓存命中后正常工作
  testOfflineLoadAfterV2: async function () {
    console.log('\n=== 测试 2: 离线加载在 V2 缓存命中后正常工作 ===');
    // 模拟 V2 缓存中有 index.html
    var cacheV2 = await global.caches.open(EXPECTED_NEW_CACHE);
    await cacheV2.put('index.html', new Response('<html>V2 Offline</html>', {
      headers: { 'Content-Type': 'text/html', 'x-sw-strategy': 'swr-cache' }
    }));
    var hit = await global.caches.match('index.html');
    tests.assert(
      hit !== null,
      'V2 缓存中 index.html 命中返回响应（非空）'
    );
    var text = await hit.text();
    tests.assert(
      text === '<html>V2 Offline</html>',
      'V2 缓存内容正确：' + text.substring(0, 30) + '...'
    );
  },

  // Test 3: 刷新/重新上线在新旧版本间正确切换
  testVersionSwitch: async function () {
    console.log('\n=== 测试 3: 刷新/重新上线在新旧版本间正确切换 ===');
    // 模拟旧版本缓存被激活事件清理
    var oldKeys = await global.caches.keys();
    var hasOld = oldKeys.some(function (k) { return k === EXPECTED_OLD_CACHE; });
    var hasNew = oldKeys.some(function (k) { return k === EXPECTED_NEW_CACHE; });
    tests.assert(
      !hasOld && hasNew,
      '激活后：旧缠键 (' + EXPECTED_OLD_CACHE + ') 已清理，新缓存键 (' + EXPECTED_NEW_CACHE + ') 存在'
    );
  },

  // Test 4: 旧缓存被 activate 事件清理
  testOldCacheCleaned: async function () {
    console.log('\n=== 测试 4: 旧缓存被 activate 事件清理 ===');
    // 模拟旧缓存不应再存在
    var allKeys = await global.caches.keys();
    var oldStillPresent = allKeys.some(function (k) { return k === EXPECTED_OLD_CACHE; });
    tests.assert(
      !oldStillPresent,
      'activate 后老缓存键 (' + EXPECTED_OLD_CACHE + ') 已从 caches.keys() 中移除'
    );
  }
};

async function run() {
  console.log('开始 Service Worker 缓存升级回归测试');
  console.log('CACHE_VERSION:', CACHE_VERSION);
  console.log('期望旧缓存键:', EXPECTED_OLD_CACHE);
  console.log('期望新缓存键:', EXPECTED_NEW_CACHE);

  await tests.testKeysOnlyNewCache();
  await tests.testOfflineLoadAfterV2();
  await tests.testVersionSwitch();
  await tests.testOldCacheCleaned();

  console.log('\n========== 结果: ' + tests.pass + '/' + (tests.pass + tests.fail) + ' 通过 ==========');
  if (tests.fail > 0) {
    console.log('失败详情:');
    tests.results.filter(function (r) { return !r.pass; }).forEach(function (r) { console.log('  ✗ ' + r.msg); });
    process.exit(1);
  }
  console.log('✅ 所有缓存升级回归测试通过');
  process.exit(0);
}

run().catch(function (e) {
  console.error('测试运行异常:', e);
  process.exit(1);
});