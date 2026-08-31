#!/usr/bin/env node
/**
 * dev/check-knowledge-contract.js — 知识库 Schema / Contract 验证（M0-05）
 *
 * 检查每个知识点是否具备下列必填字段（含类型/范围）：
 *   id, name, pluginId, type, weight, spiral_level, cognitive_level,
 *   applicable_question_types, number_range_default, max_steps_default,
 *   context_default, max_spiral_level
 *
 * 分类：VALID（通过项）/ WARNING（已知缺口，不阻断）/ ERROR（结构违规，阻断）。
 * 不修改任何知识点数据（规则：M0 不强制改 574 个知识点）。
 *
 * 输出结构化结果，供 M0 Verify Gate 聚合。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));

const COGNITIVE = ['了解', '理解', '掌握', '运用'];
const CONTEXT = ['pure', 'simple', 'standard', 'complex'];
const registeredIds = new Set(registry.map(p => p.id));

const errors = [];
const warnings = [];
let total = 0;
const bySubject = {};

function isFilled(v) {
  return (typeof v === 'string' && v.trim().length > 0) || (typeof v === 'number' && isFinite(v));
}

function addErr(loc, msg) { errors.push('[ERROR] ' + loc + ' ' + msg); }
function addWarn(loc, msg) { warnings.push('[WARN] ' + loc + ' ' + msg); }

function validatePoint(kp, subject, grade, moduleId) {
  const loc = subject + '/g' + grade + '/' + moduleId + '/' + (kp.id || '?');
  const isPlaceholder = kp.status === 'placeholder';
  total++;

  // 通用必填（字符串/数字非空）
  ['id', 'name', 'type', 'weight'].forEach(function (f) {
    if (!isFilled(kp[f])) {
      if (f === 'type' || f === 'weight') addErr(loc, '缺必填字段 ' + f);
      else addErr(loc, '缺必填字段 ' + f);
    }
  });

  // pluginId
  if (!kp.pluginId) {
    if (isPlaceholder) addWarn(loc, '占位条目未声明 pluginId（已知缺口，待补）');
    else addErr(loc, '非占位条目缺 pluginId');
  } else if (!registeredIds.has(kp.pluginId)) {
    addErr(loc, 'pluginId 未在注册表登记: ' + kp.pluginId);
  }

  // 难度元数据字段（类型/范围）
  if (!Number.isInteger(kp.spiral_level) || kp.spiral_level < 1) addErr(loc, 'spiral_level 非法: ' + JSON.stringify(kp.spiral_level));
  if (!Number.isInteger(kp.max_spiral_level) || kp.max_spiral_level < 1) addErr(loc, 'max_spiral_level 非法: ' + JSON.stringify(kp.max_spiral_level));
  else if (Number.isInteger(kp.spiral_level) && kp.max_spiral_level < kp.spiral_level) addErr(loc, 'max_spiral_level < spiral_level');
  if (COGNITIVE.indexOf(kp.cognitive_level) === -1) addErr(loc, 'cognitive_level 非法: ' + JSON.stringify(kp.cognitive_level));
  if (!Array.isArray(kp.applicable_question_types)) addErr(loc, 'applicable_question_types 非数组');
  else kp.applicable_question_types.forEach(function (a, i) {
    if (!a || typeof a.type !== 'string') addErr(loc, 'applicable_question_types[' + i + '].type 非法');
    if (typeof a.coefficient !== 'number' || !isFinite(a.coefficient)) addErr(loc, 'applicable_question_types[' + i + '].coefficient 非法');
  });
  const nr = kp.number_range_default;
  if (!nr || typeof nr !== 'object' || typeof nr.min !== 'number' || typeof nr.max !== 'number') addErr(loc, 'number_range_default 非法: ' + JSON.stringify(nr));
  else if (nr.min > nr.max) addErr(loc, 'number_range_default.min>max');
  if (!Number.isInteger(kp.max_steps_default) || kp.max_steps_default < 1) addErr(loc, 'max_steps_default 非法: ' + JSON.stringify(kp.max_steps_default));
  if (CONTEXT.indexOf(kp.context_default) === -1) addErr(loc, 'context_default 非法: ' + JSON.stringify(kp.context_default));
}

Object.keys(bank).forEach(function (subject) {
  const arr = bank[subject];
  if (!Array.isArray(arr)) return;
  bySubject[subject] = { total: 0, errors: 0, warnings: 0 };
  arr.forEach(function (entry) {
    const g = entry.grade;
    (entry.modules || []).forEach(function (mod) {
      (mod.knowledgePoints || []).forEach(function (kp) {
        const before = errors.length;
        const beforeW = warnings.length;
        validatePoint(kp, subject, g, mod.moduleId);
        bySubject[subject].total++;
        if (errors.length > before) bySubject[subject].errors++;
        if (warnings.length > beforeW) bySubject[subject].warnings++;
      });
    });
  });
});

function run() {
  const status = errors.length ? 'ERROR' : (warnings.length ? 'WARNING' : 'VALID');
  return {
    name: '知识库契约 (KnowledgeBank Contract)',
    pass: errors.length === 0,
    status: status,
    errors: errors.slice(),
    warnings: warnings.slice(),
    summary: '校验知识点 ' + total + ' 个；ERROR ' + errors.length + ' / WARNING ' + warnings.length +
      '；分科：' + Object.keys(bySubject).map(s => s + '(' + bySubject[s].total + ')').join(', ')
  };
}

module.exports = { run: run };
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
