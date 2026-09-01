#!/usr/bin/env node
/**
 * scripts/sync-sw-version.js — Service Worker 缓存名 / 版本号同步校验（任务1.2）
 *
 * 背景：Service Worker 的缓存名（CACHE）与 shared/version.js 的 APP_VERSION 必须保持一致，
 *       否则会出现「部署了新版本但离线缓存未失效 / 或缓存键错乱」。为防止手动改版本号却漏改
 *       sw.js 的遗漏，本脚本在 CI / npm test 中自动比对二者。
 *
 * 策略（零构建）：sw.js 中 CACHE 使用字面量（如 'hw-help-4.0.0'），本脚本读取 version.js 的
 *       APP_VERSION 拼出期望缓存名 'hw-help-<APP_VERSION>'，与 sw.js 的实际字面量比对。
 *
 * 用法：node scripts/sync-sw-version.js   （不一致时退出码 1）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function fail(msg) {
  console.error('❌ sync-sw-version: ' + msg);
  process.exit(1);
}

// 1) 读取 shared/version.js 的 APP_VERSION
const verSrc = fs.readFileSync(path.join(ROOT, 'shared', 'version.js'), 'utf8');
const mApp = verSrc.match(/const\s+APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!mApp) fail('shared/version.js 未找到 APP_VERSION 定义');
const APP_VERSION = mApp[1];
const expected = 'hw-help-' + APP_VERSION;

// 2) 读取 sw.js 的 CACHE 定义
const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const mLit = swSrc.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);
if (mLit) {
  const actual = mLit[1];
  if (actual !== expected) {
    fail(
      `Service Worker 缓存名与版本号不一致！\n` +
      `  sw.js  : CACHE = '${actual}'\n` +
      `  version.js: APP_VERSION = '${APP_VERSION}' → 期望缓存名 '${expected}'\n` +
      `请同步修改 sw.js 的 CACHE 常量（或 shared/version.js 的 APP_VERSION）。`
    );
  }
  console.log(`✅ sync-sw-version: SW 缓存名 '${actual}' 与 APP_VERSION '${APP_VERSION}' 一致。`);
  process.exit(0);
}

// 表达式形式（const CACHE = 'hw-help-' + CACHE_VERSION）已被弃用：
// 它会拼出 'hw-help-homework-help-<APP_VERSION>'（双重前缀）且无法被本脚本校验。
const mExpr = swSrc.match(/const\s+CACHE\s*=\s*['"]hw-help-['"]\s*\+\s*CACHE_VERSION/);
if (mExpr) {
  fail(
    `sw.js 的 CACHE 仍通过 CACHE_VERSION 动态拼接（当前等效 'hw-help-homework-help-${APP_VERSION}'，双重前缀）。\n` +
    `请改为字面量：const CACHE = '${expected}'; 以便 scripts/sync-sw-version.js 校验版本同步。`
  );
}

fail("sw.js 未找到 CACHE 常量定义（期望形如：const CACHE = 'hw-help-<APP_VERSION>';）");
