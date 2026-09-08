#!/usr/bin/env node
/**
 * dev/check-frozen-core.js — Frozen Core 保护门禁
 *
 * 扫描 M0-M7 核心文件，生成基线清单。
 * 后续 CI 可对比基线，检测未授权修改。
 *
 * 用法：
 *   node dev/check-frozen-core.js           # 输出基线/检测变更
 *   node dev/check-frozen-core.js --baseline # 生成/更新基线
 *   node dev/check-frozen-core.js --check    # 对比基线检测变更
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var BASELINE_FILE = path.join(ROOT, 'dev', 'frozen-core-baseline.json');

var MODE = process.argv[2] || '--check';

// ============================================
// 冻结核心文件清单（M0-M7）
// ============================================
var FROZEN_CORE = {
  'M0 基础设施': [
    'shared/common.js',
    'shared/version.js',
    'shared/tokens.css',
    'shared/base.css',
    'shared/states.css',
    'shared/components.css',
    'shared/pages.css',
    'shared/toolbar.css',
    'shared/subjects.css',
  ],
  'M1 本体/知识库': [
    'shared/knowledge-bank.js',
    'shared/knowledge-ontology.js',
    'shared/module-catalog.js',
    'shared/capability-model.js',
    'shared/capability-matrix.js',
    'shared/capability-resolver.js',
    'shared/question-type-registry.js',
    'shared/strategy/strategy-config.js',
    // NOTE 数据分片（knowledge-math/cn/en.js 等 818KB 纯数据）不纳入代码哈希：
    // 单个 KP 编辑（改 weight/涉及 new KP）即触发 whole-KB 重锁已违背「数据契约」原则，
    // 知识库数据由 verify-knowledge-bank / check-knowledge-point / check-plugin-reachability /
    // check-type-module-consistency 等按变更范围门禁保障
  ],
  'M2 能力/生成器契约': [
    'shared/generator/generator-contract.js',
    'shared/generator/generator-registry.js',
    'shared/generator/generator-selector.js',
    'shared/generator/generator-mode.js',
    'shared/generator/retry-loop.js',
    'shared/generator/generators/arithmetic.js',
    'shared/generator/generators/selection.js',
    'shared/generator/generators/complex.js',
    'shared/generator/generators/index.js',
    'shared/generator/core/rng.js',
    'shared/generator/core/arithmetic-core.js',
    'shared/generator/core/kp-complex-semantics.js',
    'shared/generator/semantic-question-bridge.js',
    // MATH-14：legacy-adapter / migration-switch 已删除，移出冻结清单
  ],
  'M3 策略引擎': [
    'shared/strategy/strategy-engine.js',
    'shared/strategy/comprehensive-strategy.js',
    'shared/strategy/strategy-error.js',
    'shared/strategy/strategy-request.js',
    'shared/strategy/strategy-resolver.js',
    'shared/strategy/strategy-result.js',
    'shared/strategy/strategy-validator.js',
    'shared/strategy/adaptive-strategy.js',
    'shared/strategy/cognitive-strategy.js',
    'shared/strategy/context-strategy.js',
    'shared/strategy/difficulty-strategy.js',
    'shared/strategy/static-difficulty.js',
    'shared/strategy/number-range-strategy.js',
    'shared/strategy/target-difficulty.js',
    'shared/strategy/spiral-strategy.js',
    'shared/strategy/constraint-builder.js',
    'shared/strategy/structure-constraints.js',
    'shared/strategy/question-plan.js',
    'shared/strategy/question-type-strategy.js',
    'shared/strategy/question-type-allocation.js',
  ],
  'M4 生成器实现': [
    'shared/generator/core/arithmetic-semantics.js',
    'shared/generator/core/kp-arithmetic-semantics.js',
  ],
  'M5 验证管线': [
    'shared/validator/validation-pipeline.js',
    'shared/validator/question-validator.js',
    'shared/validator/answer-validator.js',
    'shared/validator/difficulty-validator.js',
    'shared/validator/duplicate-validator.js',
    'shared/validator/batch-validator.js',
    'shared/validator/quality-scorer.js',
  ],
  'M6 学习者模型': [
    'shared/learner/learner-model.js',
    'shared/learner/learner-storage.js',
    'shared/learner/practice-result.js',
    'shared/learner/result-collector.js',
    'shared/learner/error-model.js',
    'shared/storage.js',
    'shared/difficulty.js',
    'shared/difficulty-static.js',
  ],
  'M7 统一渲染/生成/打印': [
    'shared/presentation/renderer.js',
    'shared/presentation/html-renderer.js',
    'shared/presentation/render-options.js',
    'shared/presentation/render-result.js',
    'shared/presentation/render-format.js',
    'shared/presentation/svg-registry.js',
    'shared/generation-engine.js',
    'shared/presentation-engine.js',
    'shared/print.js',
    'shared/practice-session.js',
    'shared/check.js',
    'shared/svg-core.js',
    'shared/svg-geometry.js',
    'shared/svg-calculation.js',
    'shared/svg-make-ten.js',
    // MATH-14：legacy-svg-adapter 已删除，移出冻结清单
  ],
};

// 额外允许变更的文件（明确排除）
var ALLOWLIST = [
  'dev/',
  'tests/',
  'plugins/',
  'practice.html',
  'math-types.html',
  'subject-types.html',
  'index.html',
  'faq.html',
  '.github/',
  'package.json',
  'package-lock.json',
  'README.md',
  'llms.txt',
  'robots.txt',
  '技术文档--基础.md',
  '设计文档.md',
  'docs/DEV_LOG.md',
  'docs/',
];

// ============================================
// 工具函数
// ============================================
function hashFile(filepath) {
  var content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function collectFrozenFiles() {
  var files = [];
  Object.values(FROZEN_CORE).forEach(function (list) {
    list.forEach(function (f) {
      var abs = path.join(ROOT, f);
      if (fs.existsSync(abs)) files.push(f);
    });
  });
  return files;
}

function isAllowed(file) {
  return ALLOWLIST.some(function (a) { return file.startsWith(a); });
}

// ============================================
// 基线生成
// ============================================
function generateBaseline() {
  var files = collectFrozenFiles();
  var baseline = {
    generatedAt: new Date().toISOString(),
    version: '1.0',
    files: {}
  };
  files.forEach(function (f) {
    var abs = path.join(ROOT, f);
    baseline.files[f] = {
      hash: hashFile(abs),
      size: fs.statSync(path.join(ROOT, f)).size,
      mtime: fs.statSync(path.join(ROOT, f)).mtimeMs
    };
  });
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
  console.log('Baseline 生成完成:', Object.keys(baseline.files).length, 'files ->', BASELINE_FILE);
}

// ============================================
// 基线对比检查
// ============================================
function checkAgainstBaseline() {
  if (!fs.existsSync(BASELINE_FILE)) {
    console.log('❌ 基线文件不存在，请先运行 --baseline 生成');
    process.exit(1);
  }
  var baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  var currentFiles = collectFrozenFiles();
  var changed = [];
  var missing = [];
  var added = [];

  currentFiles.forEach(function (f) {
    var abs = path.join(ROOT, f);
    var currentHash = hashFile(abs);
    var base = baseline.files[f];
    if (!base) {
      added.push(f);
    } else if (base.hash !== currentHash) {
      changed.push({ file: f, oldHash: base.hash, newHash: currentHash });
    }
  });

  Object.keys(baseline.files).forEach(function (f) {
    if (!currentFiles.includes(f)) missing.push(f);
  });

  console.log('\n=== Frozen Core 变更检测 ===');
  console.log('基线时间:', baseline.generatedAt);
  console.log('当前文件数:', currentFiles.length);
  console.log('基线文件数:', Object.keys(baseline.files).length);
  console.log('');

  if (added.length) {
    console.log('➕ 新增文件 (' + added.length + '):');
    added.forEach(function (f) { console.log('  + ' + f); });
  }
  if (missing.length) {
    console.log('➖ 缺失文件 (' + missing.length + '):');
    missing.forEach(function (f) { console.log('  - ' + f); });
  }
  if (changed.length) {
    console.log('🔄 修改文件 (' + changed.length + '):');
    changed.forEach(function (c) {
      console.log('  ~ ' + c.file);
      console.log('    old: ' + c.oldHash);
      console.log('    new: ' + c.newHash);
    });
  }

  var totalChanges = added.length + missing.length + changed.length;
  if (totalChanges === 0) {
    console.log('✅ 无变更 - Frozen Core 完整性完好');
    process.exitCode = 0;
  } else {
    console.log('\n⚠️  检测到 ' + totalChanges + ' 处变更');
    console.log('如为授权 Bug Fix，请运行: node dev/check-frozen-core.js --baseline 更新基线');
    console.log('或在 PR 中说明 Bug Fix 编号并申请基线更新');
    process.exitCode = 1;
  }
}

// ============================================
// 入口
// ============================================
if (MODE === '--baseline') {
  generateBaseline();
} else {
  checkAgainstBaseline();
}