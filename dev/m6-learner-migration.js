#!/usr/bin/env node
/**
 * dev/m6-learner-migration.js — M6-R27 Learner Model 迁移
 *
 * 原则：
 *   - 旧自适应数据（difficultyState EMA / currentDelta）保留不删除（R01/R30 过渡期仍被 legacy 路径使用）。
 *   - 新 Learner Model（learnerState）从默认空模型开始，不 Copy 旧 EMA 值，避免污染 KP 级掌握度。
 *   - 仅做结构性兼容：缺 learnerState → 初始化默认空模型；已有 → 原样保留。
 */
'use strict';

var LearnerModel = require('../shared/learner/learner-model.js');

/**
 * 确保状态对象与 M6 Learner Model 结构兼容（R26 容错）。
 * @param {Object} legacyState StorageManager.load() 的原始状态（可为 null）
 * @returns {Object} 兼容对象：保留全部旧字段 + learnerState
 */
function ensureCompatible(legacyState) {
  legacyState = (legacyState && typeof legacyState === 'object') ? legacyState : {};
  if (legacyState.learnerState && typeof legacyState.learnerState === 'object') {
    legacyState.learnerState = LearnerModel.normalizeLearnerState(legacyState.learnerState);
  } else {
    legacyState.learnerState = LearnerModel.normalizeLearnerState(null); // 从默认空模型开始
  }
  if (legacyState.difficultyState == null || typeof legacyState.difficultyState !== 'object') {
    legacyState.difficultyState = {};
  }
  legacyState.version = legacyState.version || 2;
  return legacyState;
}

/**
 * 命令行入口：读入并迁移 StorageManager 状态 JSON。
 * 用法：node dev/m6-learner-migration.js [input.json] [output.json]
 * 缺省：读取真实 StorageManager 状态并仅打印迁移摘要（无文件写入时只读）。
 */
if (require.main === module) {
  var path = require('path');
  var fs = require('fs');
  var argv = process.argv.slice(2);
  var input = argv[0];
  var output = argv[1];

  var raw = (input && fs.existsSync(input)) ? JSON.parse(fs.readFileSync(input, 'utf8')) : null;
  var migrated = ensureCompatible(raw);

  var kpCount = Object.keys(migrated.learnerState.knowledgePoints || {}).length;
  var diffCount = Object.keys(migrated.difficultyState || {}).length;

  console.log('M6-R27 Learner Model 迁移摘要');
  console.log('  旧 difficultyState 保留: ' + diffCount + ' 个插件（EMA/currentDelta 未删除）');
  console.log('  新 learnerState 知识点数: ' + kpCount + '（从默认模型开始）');

  if (output) {
    fs.writeFileSync(output, JSON.stringify(migrated, null, 2));
    console.log('  已写出: ' + output);
  }
}

module.exports = { ensureCompatible: ensureCompatible };