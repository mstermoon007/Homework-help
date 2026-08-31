#!/usr/bin/env node
/**
 * dev/check-strategy-config.js — M3 Feature Flag 验证
 *
 * 验证：
 * 1. strategy-config 模块可加载
 * 2. 默认 strategy 为 'legacy'
 * 2. 可通过环境变量切换
 * 3. API 完整性
 */
'use strict';

var StrategyConfig = require('../shared/strategy-config.js');

function run() {
  console.log('M3-00 Feature Flag Verification');
  console.log('');

  // 1. 基础 API
  console.log('1. StrategyConfig API check...');
  var config = StrategyConfig.getConfig();
  console.log('  config:', JSON.stringify(config, null, 2));

  // 3. 默认值
  var defaultStrategy = StrategyConfig.getStrategy();
  console.log('  default strategy:', defaultStrategy);
  if (defaultStrategy !== 'legacy') {
    console.error('FAIL: default strategy should be "legacy", got:', defaultStrategy);
    process.exitCode = 1;
    return;
  }

  // 4. API 完整性
  var api = ['getStrategy', 'setStrategy', 'isLegacy', 'isStrategyV1', 'getConfig', 'setConfigOverrides', 'reset'];
  api.forEach(function (m) {
    if (typeof StrategyConfig[m] !== 'function') {
      console.error('FAIL: missing method', m);
      process.exitCode = 1;
    }
  });

  // 5. 切换测试
  console.log('5. Switch test...');
  StrategyConfig.setStrategy('strategy-v1');
  if (!StrategyConfig.isStrategyV1()) {
    console.error('FAIL: isStrategyV1() should be true after setStrategy');
    process.exitCode = 1;
    return;
  }
  StrategyConfig.setStrategy('legacy');
  if (!StrategyConfig.isLegacy()) {
    console.error('FAIL: isLegacy() should be true after reset');
    process.exitCode = 1;
    return;
  }

  // 6. 环境变量测试（通过子进程验证）
  console.log('6. Env var test...');
  var child = require('child_process');
  var r = child.spawnSync('node', ['-e', 'process.env.GENERATION_STRATEGY="strategy-v1"; var c=require("./shared/strategy-config.js"); console.log(c.getStrategy())'], {
    cwd: __dirname + '/..',
    encoding: 'utf8'
  });
  if (r.status !== 0 || !r.stdout.includes('strategy-v1')) {
    console.error('FAIL: env var test failed', r.stdout, r.stderr);
    process.exitCode = 1;
    return;
  }

  console.log('');
  console.log('[PASS] M3-00 Feature Flag Verification');
  process.exitCode = 0;
}

run();