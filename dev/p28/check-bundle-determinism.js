#!/usr/bin/env node
'use strict';
/**
 * dev/p28/check-bundle-determinism.js
 * FINAL-90 · Bundle 一致性 + 构建确定性联合门禁
 *
 * 用法：
 *   node dev/p28/check-bundle-determinism.js --mode bundle        # 验证 source==bundle（hash 一致）
 *   node dev/p28/check-bundle-determinism.js --mode determinism   # 验证构建确定性（重跑 hash 不变）
 *
 * 逻辑（两种 mode 同一机制）：
 *   1. 记录 strategy-engine.bundle.js / presentation-engine.bundle.js 原始 SHA256
 *   2. 重跑两个 build 脚本
 *   3. 比对重建后 hash 与原始 hash
 *   4. 一致 → PASS；不一致 → FAIL（说明源码漂移未重建 / 构建非确定性）
 *
 * bundle 模式语义：hash 一致 = bundle 与 source 同步（源码改了则重建 hash 必变）
 * determinism 模式语义：hash 一致 = 构建确定性（同输入同输出）
 */
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var { execSync } = require('child_process');

var ROOT = path.resolve(__dirname, '../..');
var STRATEGY_BUNDLE = path.join(ROOT, 'shared', 'engine', 'strategy-engine.bundle.js');
var PRESENTATION_BUNDLE = path.join(ROOT, 'shared', 'engine', 'presentation-engine.bundle.js');

var mode = 'bundle';
var idx = process.argv.indexOf('--mode');
if (idx !== -1 && process.argv[idx + 1]) mode = process.argv[idx + 1];

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function fail(msg) {
  console.error('❌ check-bundle-determinism [' + mode + '] FAIL: ' + msg);
  process.exit(1);
}

// 1. 记录原始 hash
var before = {};
try {
  before.strategy = sha256(STRATEGY_BUNDLE);
  before.presentation = sha256(PRESENTATION_BUNDLE);
} catch (e) {
  fail('无法读取 bundle 文件: ' + e.message);
}

// 2. 重跑两个 build 脚本
try {
  execSync('node dev/build-strategy-bundle.js', { cwd: ROOT, stdio: 'pipe' });
  execSync('node dev/build-presentation-bundle.js', { cwd: ROOT, stdio: 'pipe' });
} catch (e) {
  fail('build 脚本执行失败: ' + (e.stderr || e.message));
}

// 3. 比对重建后 hash
var after = {};
after.strategy = sha256(STRATEGY_BUNDLE);
after.presentation = sha256(PRESENTATION_BUNDLE);

var strategyMatch = before.strategy === after.strategy;
var presentationMatch = before.presentation === after.presentation;

if (!strategyMatch) {
  fail('strategy-engine.bundle.js 重建后 hash 不一致\n  before: ' + before.strategy + '\n  after:  ' + after.strategy);
}
if (!presentationMatch) {
  fail('presentation-engine.bundle.js 重建后 hash 不一致\n  before: ' + before.presentation + '\n  after:  ' + after.presentation);
}

console.log('✅ check-bundle-determinism [' + mode + '] PASS');
console.log('   strategy-engine.bundle.js:     ' + after.strategy.slice(0, 16) + '... (稳定)');
console.log('   presentation-engine.bundle.js: ' + after.presentation.slice(0, 16) + '... (稳定)');
console.log('   结论: source==bundle，构建确定性');
process.exit(0);
