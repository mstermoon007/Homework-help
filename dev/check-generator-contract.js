#!/usr/bin/env node
/**
 * dev/check-generator-contract.js — M5-R17 Generator 契约静态检查 (P6 Task 4.2)
 *
 * 对所有 Generator 源码进行禁止项正则扫描：
 *   - Math.random
 *   - DOM 操作
 *   - SVG 字符串/直接渲染
 *   - 难度/年级硬编码
 *   - 违规语义字段
 *
 * 用法：npm run check-contracts
 * 返回非零码表示发现违规。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

// 加载合同定义
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var FORBIDDEN_PATTERNS = Contract.FORBIDDEN_PATTERNS;
var GENERATOR_DIFFICULTY_PATTERNS = Contract.GENERATOR_DIFFICULTY_PATTERNS;
var FORBIDDEN_KEYS = Contract.FORBIDDEN_KEYS;

// ============ 扫描目录 ============
function walk(dir, ext) {
  var files = [];
  function rec(d) {
    fs.readdirSync(d).forEach(function (f) {
      var p = path.join(d, f);
      var stat = fs.statSync(p);
      if (stat.isDirectory()) {
        if (f !== 'node_modules' && f !== '.git' && f !== 'dist' && f !== 'coverage') rec(p);
      } else if (stat.isFile() && (ext == null || f.endsWith(ext))) {
        files.push(p);
      }
    });
  }
  rec(dir);
  return files;
}

// ============ 扫描单文件 ============
function scanFile(filePath) {
  var content = fs.readFileSync(filePath, 'utf8');
  var errors = [];

  // 1) Generator 核心禁止模式
  FORBIDDEN_PATTERNS.forEach(function (f) {
    var matches = content.match(f.pattern);
    if (matches) {
      errors.push({
        file: path.relative(ROOT, filePath),
        type: 'forbidden',
        label: f.label,
        matches: matches.slice(0, 3).join(', ')
      });
    }
  });

  // 2) 难度/年级硬编码
  GENERATOR_DIFFICULTY_PATTERNS.forEach(function (f) {
    if (f.pattern.test(content)) {
      errors.push({
        file: path.relative(ROOT, filePath),
        type: 'hardcoded',
        label: f.label
      });
    }
  });

  return errors;
}

// ============ 校验 Generator 实例基本契约 ============
function validateInstance(filePath) {
  var errors = [];
  try {
    var gen = require(filePath);
    if (!gen || typeof gen !== 'object') return [{ file: path.relative(ROOT, filePath), type: 'contract', label: '非对象导出' }];
    if (typeof gen.generate !== 'function') {
      errors.push({ file: path.relative(ROOT, filePath), type: 'contract', label: '缺少 generate(plan) 函数' });
    }
    if (typeof gen.supports !== 'function') {
      errors.push({ file: path.relative(ROOT, filePath), type: 'contract', label: '缺少 supports(plan) 函数' });
    }
    if (!gen.id || typeof gen.id !== 'string') {
      errors.push({ file: path.relative(ROOT, filePath), type: 'contract', label: '缺少 id 字段' });
    }
    if (!Array.isArray(gen.capabilities) || gen.capabilities.length === 0) {
      errors.push({ file: path.relative(ROOT, filePath), type: 'contract', label: 'capabilities 必须是非空数组' });
    }
  } catch (e) {
    errors.push({ file: path.relative(ROOT, filePath), type: 'require', label: 'require 失败: ' + e.message });
  }
  return errors;
}

// ============ 主程序 ============
function main() {
  var generatorDir = path.join(ROOT, 'shared', 'generator');
  var coreDir = path.join(generatorDir, 'generators');
  var legacyDir = path.join(ROOT, 'plugins');

  var targetDirs = [coreDir, legacyDir].filter(function (d) { return fs.existsSync(d); });

  var allErrors = [];
  var fileCount = 0;

  targetDirs.forEach(function (dir) {
    var files = walk(dir, '.js');
    files.forEach(function (f) {
      if (path.basename(f) === 'index.js') return; // 入口文件跳过
      fileCount++;
      var scanErrs = scanFile(f);
      if (scanErrs.length) allErrors.push.apply(allErrors, scanErrs);
      // 仅对 core generators 做实例契约校验
      if (dir === coreDir) {
        var instErrs = validateInstance(f);
        if (instErrs.length) allErrors.push.apply(allErrors, instErrs);
      }
    });
  });

  // 输出结果
  console.log('');
  console.log('=== Generator 契约静态扫描 ===');
  console.log('扫描目录: ' + targetDirs.map(function (d) { return path.relative(ROOT, d); }).join(', '));
  console.log('文件数: ' + fileCount);
  console.log('');

  if (allErrors.length === 0) {
    console.log('[PASS] 无违规');
    process.exitCode = 0;
  } else {
    console.error('[FAIL] 发现 ' + allErrors.length + ' 处违规:');
    console.error('');
    allErrors.forEach(function (e) {
      console.error('  ✖ [' + e.type + '] ' + e.file + ' → ' + e.label + (e.matches ? ' (' + e.matches + ')' : ''));
    });
    console.error('');
    process.exitCode = 1;
  }
}

main();