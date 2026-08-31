#!/usr/bin/env node
/**
 * dev/test-runner.js — M2 统一测试运行器 (M2-R02-C)
 *
 * 职责：确定 ROOT -> 定位测试文件 -> 交给 node:test 执行 -> 统一 exitCode。
 * 用法：node dev/test-runner.js [pattern]   （pattern 默认 tests/capability/*.test.js）
 */
'use strict';

var path = require('path');
var child = require('child_process');
var ROOT = path.resolve(__dirname, '..');

var pattern = process.argv[2] || 'tests/capability/*.test.js';

console.log('[test-runner] ROOT = ' + ROOT);
console.log('[test-runner] pattern = ' + pattern);

var r = child.spawnSync('node', ['--test', pattern], {
  cwd: ROOT,
  stdio: 'inherit'
});

console.log('[test-runner] exit code = ' + r.status);
process.exit(r.status === 0 ? 0 : 1);
