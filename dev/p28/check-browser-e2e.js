#!/usr/bin/env node
'use strict';

/**
 * dev/p28/check-browser-e2e.js — FINAL-12 Browser E2E 门禁 wrapper
 *
 * 语义（exit code）：
 *   0  PASS     浏览器可用 → 真实运行 dev/e2e/browser-e2e.js final-12（9 步路径），全 PASS
 *   1  FAIL     运行失败 / 发布环境（REQUIRE_BROWSER_E2E=1）下浏览器不可用
 *   2  SKIPPED  浏览器不可用（非发布环境）——不得冒充 PASS
 *
 * 浏览器查找顺序（与 browser-e2e.js 一致）：CHROME_BIN → PATH(chrome → chromium → chromium-browser)
 * 运行时要求：全局 WebSocket（Node ≥22 内置）
 *
 * 正式发布环境（CI）设 REQUIRE_BROWSER_E2E=1 + CHROME_BIN=google-chrome → 真实执行。
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// 不抛错版的浏览器查找：返回路径或 null
function findChrome() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  candidates.push('chrome', 'chromium', 'chromium-browser');
  for (const c of candidates) {
    try {
      if (path.isAbsolute(c)) {
        if (fs.existsSync(c)) return c;
      } else {
        const r = spawnSync('command', ['-v', c], { encoding: 'utf8', shell: true, stdio: ['ignore', 'pipe', 'ignore'] });
        const found = r.stdout && r.stdout.trim();
        if (found) return found;
      }
    } catch (e) { /* 尝试下一个候选 */ }
  }
  return null;
}

function hasGlobalWebSocket() {
  return typeof WebSocket !== 'undefined';
}

function main() {
  const chrome = findChrome();
  const ws = hasGlobalWebSocket();

  if (!chrome || !ws) {
    const reasons = [];
    if (!chrome) reasons.push('未找到 Chrome/Chromium（设置 CHROME_BIN 或将 chrome/chromium/chromium-browser 置于 PATH）');
    if (!ws) reasons.push('运行时无全局 WebSocket（需 Node ≥22）');
    const msg = reasons.join('；');

    if (process.env.REQUIRE_BROWSER_E2E === '1') {
      // 正式发布环境：浏览器不可用即失败（不得 SKIPPED/PASS）
      console.error('✗ Browser E2E FAIL（发布强制）：' + msg);
      process.exit(1);
    }
    // 非发布环境：SKIPPED（不得冒充 PASS）
    console.log('⊘ Browser E2E SKIPPED：' + msg);
    process.exit(2);
  }

  // 浏览器可用 → 真实执行 9 步路径
  console.log('▶ Browser E2E：真实运行 9 步路径（Chrome=' + chrome + '）');
  const r = spawnSync(process.execPath, [path.join('dev', 'e2e', 'browser-e2e.js'), 'final-12'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, CHROME_BIN: chrome }
  });

  if (r.error || r.status !== 0) {
    console.error('✗ Browser E2E FAIL（exit ' + (r.status != null ? r.status : '?') + '）');
    process.exit(1);
  }
  console.log('✓ Browser E2E PASS');
  process.exit(0);
}

main();
