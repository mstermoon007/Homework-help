#!/usr/bin/env node
/**
 * dev/verify-m0.js — M0 统一验证入口（M0-10）
 *
 * 依次执行以下步骤，聚合 PASS / FAIL / REPORT，列出失败项，退出码 1 表示存在 FAIL。
 *   1. KBL 校验            tools/kbl/validate.js
 *   2. KBL 运行时          dev/verify-kbl-runtime.js
 *   3. KBL 唯一性          dev/check-kbl-uniqueness.js
 *   4. KBL 访问            dev/check-knowledge-access.js
 *   5. KBL 目录            dev/check-knowledge-dir.js
 *   6. 教育真实性门禁      dev/check-educational-generation.js  （P25-15，307 A 类 × 核心题型）
 *   7. 教育覆盖率          dev/p25/build-coverage-report.js --strict  （P25-14，7 维防 declared-only 回归）
 *   8. 黄金题集            dev/p25/validate-golden-dataset.js  （P25-16，结构验证 0 errors）
 *
 * MATH-14：插件契约（check-plugin-contract）与 Snapshot 基线（check-snapshot）
 *          随 legacy 插件轨道删除，从本网关移除。
 * KBL 收口：旧本体完整性（check-ontology-integrity）随旧知识层删除。
 * P25-17：新增 3 步防退化守卫（edu-gen/coverage/golden），均 blocking。
 *
 * 每个步骤独立、可重复、零副作用。`nonBlocking` 步骤失败仅记为
 * REPORT，不计入最终 FAIL；其余任何步骤 FAIL 均计入最终 FAIL。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

const steps = [
  {
    key: 'kbl-validate',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'tools', 'kbl', 'validate.js')] }
  },
  {
    key: 'kbl-runtime',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'verify-kbl-runtime.js')] }
  },
  {
    key: 'kbl-uniqueness',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'check-kbl-uniqueness.js')] }
  },
  {
    key: 'kbl-access',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'check-knowledge-access.js')] }
  },
  {
    key: 'kbl-dir',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'check-knowledge-dir.js')] }
  },
  // P25-17 防退化守卫：教育真实性 + 覆盖率 + 黄金题
  {
    key: 'edu-gen',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'check-educational-generation.js')] }
  },
  {
    key: 'coverage',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'p25', 'build-coverage-report.js'), '--strict'] }
  },
  {
    key: 'golden',
    spawn: { cmd: process.execPath, args: [path.join(ROOT, 'dev', 'p25', 'validate-golden-dataset.js')] }
  }
];

const PLUGIN_REQUIRES_ASYNC = false;

function runStep(step) {
  if (step.spawn) {
    return new Promise((resolve) => {
      const { execFile } = require('child_process');
      execFile(step.spawn.cmd, step.spawn.args, { maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
        resolve({
          name: step.key, pass: !err && err === null,
          errors: err ? [(stderr || '').slice(0, 500) || ('退出码 ' + (err.code != null ? err.code : err.message))] : [],
          warnings: [], summary: (stdout || '').split('\n').filter(Boolean).pop() || ''
        });
      });
    });
  }
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
        const tag = r.pass ? 'PASS' : (r.nonBlocking ? 'REPORT' : 'FAIL');
        console.log('[' + tag + '] ' + (r.name || step.key) + ' — ' + (r.summary || ''));
        (r.errors || []).forEach(function (e) { console.log('      ✗ ' + e); });
        (r.warnings || []).slice(0, 12).forEach(function (w) { console.log('      ⚠ ' + w); });
        if ((r.warnings || []).length > 12) console.log('      ⚠ ...（另有 ' + (r.warnings.length - 12) + ' 条警告）');
      });
    });
  });

  return chain.then(function () {
    const failed = results.filter(function (r) { return !r.pass && r.nonBlocking !== true; });
    const reported = results.filter(function (r) { return !r.pass && r.nonBlocking === true; });
    const totalErr = results.reduce(function (s, r) { return s + (r.errors ? r.errors.length : 0); }, 0);
    const totalWarn = results.reduce(function (s, r) { return s + (r.warnings ? r.warnings.length : 0); }, 0);
    console.log('\n' + '='.repeat(56));
    console.log('M0 验证网关（verify gate）');
    console.log('='.repeat(56));
    results.forEach(function (r) {
      const tag = r.pass ? 'PASS' : (r.nonBlocking ? 'REPORT' : 'FAIL');
      console.log('  [' + tag + '] ' + (r.name || '?')); });
    console.log('-'.repeat(56));
    console.log('步骤 ' + results.length + ' 项，通过 ' + (results.length - failed.length - reported.length) +
      ' / 失败 ' + failed.length + ' / 报告 ' + reported.length);
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
