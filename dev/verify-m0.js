#!/usr/bin/env node
/**
 * dev/verify-m0.js — M0 统一验证入口（M0-10）
 *
 * 依次执行 7 个步骤，聚合 PASS / FAIL，列出失败项，退出码 1 表示存在 FAIL。
 *   1. 语法检查            dev/check-syntax.js
 *   2. 知识库契约          dev/check-knowledge-contract.js
 *   3. 插件契约            dev/check-plugin-contract.js
 *   4. 难度双轨测试        dev/check-difficulty-dual.js
 *   5. Golden Path         dev/check-golden.js
 *   6. Snapshot 基线       dev/check-snapshot.js
 *   7. 架构护栏            dev/check-architecture-rules.js
 *
 * 每个步骤独立、可重复、零副作用。任何步骤 FAIL 均计入最终 FAIL。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

const steps = [
  { key: 'syntax', mod: require(path.join(ROOT, 'dev', 'check-syntax.js')) },
  { key: 'kb', mod: require(path.join(ROOT, 'dev', 'check-knowledge-contract.js')) },
  { key: 'plugin', mod: require(path.join(ROOT, 'dev', 'check-plugin-contract.js')) },
  { key: 'difficulty', mod: require(path.join(ROOT, 'dev', 'check-difficulty-dual.js')) },
  { key: 'golden', mod: require(path.join(ROOT, 'dev', 'check-golden.js')) },
  { key: 'snapshot', mod: require(path.join(ROOT, 'dev', 'check-snapshot.js')) },
  { key: 'rules', mod: require(path.join(ROOT, 'dev', 'check-architecture-rules.js')) }
];

const PLUGIN_REQUIRES_ASYNC = false;

function runStep(step) {
  try {
    const r = step.mod.run();
    if (r && typeof r.then === 'function') return r;
    return Promise.resolve(r);
  } catch (e) {
    return Promise.resolve({
      name: step.key, pass: false,
      errors: ['步骤执行异常: ' + e.message], warnings: [],
      summary: '异常'
    });
  }
}

function main() {
  const start = Date.now();
  const results = [];
  let chain = Promise.resolve();
  steps.forEach(function (step) {
    chain = chain.then(function () {
      return runStep(step).then(function (r) {
        results.push(r);
        const tag = r.pass ? 'PASS' : 'FAIL';
        console.log('[' + tag + '] ' + (r.name || step.key) + ' — ' + (r.summary || ''));
        (r.errors || []).forEach(function (e) { console.log('      ✗ ' + e); });
        (r.warnings || []).slice(0, 12).forEach(function (w) { console.log('      ⚠ ' + w); });
        if ((r.warnings || []).length > 12) console.log('      ⚠ ...（另有 ' + (r.warnings.length - 12) + ' 条警告）');
      });
    });
  });

  return chain.then(function () {
    const failed = results.filter(function (r) { return !r.pass; });
    const totalErr = results.reduce(function (s, r) { return s + (r.errors ? r.errors.length : 0); }, 0);
    const totalWarn = results.reduce(function (s, r) { return s + (r.warnings ? r.warnings.length : 0); }, 0);
    console.log('\n' + '='.repeat(56));
    console.log('M0 验证网关（verify gate）');
    console.log('='.repeat(56));
    results.forEach(function (r) {
      console.log('  [' + (r.pass ? 'PASS' : 'FAIL') + '] ' + (r.name || '?')); });
    console.log('-'.repeat(56));
    console.log('步骤 ' + results.length + ' 项，通过 ' + (results.length - failed.length) +
      ' / 失败 ' + failed.length);
    console.log('错误 ' + totalErr + ' 条，警告 ' + totalWarn + ' 条');
    console.log('总耗时 ' + (Date.now() - start) + ' ms');
    if (failed.length) {
      console.log('\n未通过项：');
      failed.forEach(function (r) {
        console.log('  - ' + (r.name || '?') + '：' + (r.summary || ''));
        (r.errors || []).slice(0, 8).forEach(function (e) { console.log('      ✗ ' + e); });
      });
      console.log('\n结果：FAIL');
      process.exitCode = 1;
    } else {
      console.log('\n结果：PASS');
    }
    return results;
  });
}

if (require.main === module) {
  main();
}

module.exports = { main: main, steps: steps };
