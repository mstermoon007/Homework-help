#!/usr/bin/env node
'use strict';
/**
 * dev/p30/check-teaching-schema.js — P30-08 阶段一门禁「Teaching schema」
 *
 * 背景：P30-07 删除第二语义运行时后，shared/schemas 下不再有教学语义独立 schema。
 * T2 教学语义的「契约」= 派生器内置断言 + 本门禁对机读形状的只读校验 + 生产消费方
 * fail-closed。本脚本校验 kbl/teaching/ 现役 JSON（P30-04 审计保留集）：
 *
 *   S1 5 核心文件全部可解析、带 schemaVersion、顶层形状为数组/带 rows
 *   S2 其余现役文件（type-contracts/golden-questions/teaching-denials/intent-relations/
 *      kp-matrix/qt-intent-review）可解析且各自关键集合非空
 *   S3 qt-intent 逐行机读 schema：intent 五问字段齐备（值允许 null，行必须带键）、
 *      assessment 七键齐备且类型闭集（P30-05 机器约束的结构契约）
 *   S4 行数/计数与基线一致：1570 intent / 375 KP kp-matrix
 *
 * 用法：node dev/p30/check-teaching-schema.js（0=PASS，1=FAIL）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'kbl', 'teaching');

const checks = [];
let failCount = 0;
function check(id, name, ok, detail) {
  checks.push({ id: id, name: name, ok: !!ok, detail: detail || '' });
  if (!ok) failCount++;
}
function load(file) {
  return JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
}

// ---------- S1 5 核心文件 ----------
// 每项：[集合键, schemaVersion 所在键]（semantic-families 的版本号在 meta 内）
const CORE = {
  'semantic-families.json': ['families', 'meta.schemaVersion'],
  'qt-intent.json': ['rows', 'schemaVersion'],
  'variation-profiles.json': ['rows', 'schemaVersion'],
  'misconception-profiles.json': ['kps', 'schemaVersion'],
  'evidence-rules.json': ['rules', 'schemaVersion']
};
function versionAt(doc, path2) {
  return path2.split('.').reduce(function (o, k) { return o && o[k]; }, doc);
}
let coreOk = true;
const coreDetail = [];
Object.keys(CORE).forEach(function (file) {
  try {
    const doc = load(file);
    const key = CORE[file][0];
    const verPath = CORE[file][1];
    const coll = doc && doc[key];
    const size = Array.isArray(coll) ? coll.length
      : (coll && typeof coll === 'object' ? Object.keys(coll).length : 0);
    if (!doc || typeof versionAt(doc, verPath) !== 'string' || size === 0) {
      coreOk = false; coreDetail.push(file + ' 形状/schemaVersion 异常');
    } else {
      coreDetail.push(file + '=' + size);
    }
  } catch (e) { coreOk = false; coreDetail.push(file + ' 解析失败: ' + e.message); }
});
check('S1', '5 核心教学文件可解析 / 带 schemaVersion / 顶层集合非空', coreOk, coreDetail.join('，'));

// ---------- S2 现役保留文件 ----------
const ACTIVE = {
  'type-contracts.json': 'contracts',
  'golden-questions.json': 'questions',
  'teaching-denials.json': 'denials',
  'intent-relations.json': 'rules',
  'kp-matrix.json': 'kps',
  'qt-intent-review.json': 'verdicts'
};
let activeOk = true;
const activeDetail = [];
Object.keys(ACTIVE).forEach(function (file) {
  try {
    const doc = load(file);
    const key = ACTIVE[file];
    const coll = Array.isArray(doc) ? doc : doc[key];
    // 只要求集合键存在且非空（数组长度或对象键数），各文件集合形态不同（verdicts 为对象）
    const size = Array.isArray(coll) ? coll.length : (coll && typeof coll === 'object' ? Object.keys(coll).length : 0);
    if (!doc || size === 0) { activeOk = false; activeDetail.push(file + ' 缺/空 ' + key); }
    else activeDetail.push(file + '=' + size);
  } catch (e) { activeOk = false; activeDetail.push(file + ' 解析失败'); }
});
check('S2', '6 个现役保留文件可解析且关键集合存在', activeOk, activeDetail.join('，'));

// ---------- S3 qt-intent 逐行机读 schema ----------
const intent = load('qt-intent.json');
const INTENT_KEYS = ['trainsWhat', 'whyThisType', 'differentiation', 'driftRisk', 'legitimacy'];
const ASSESSMENT_KEYS = ['targetCodes', 'focus', 'requiredRelations', 'requiredConstructs',
  'allowedRepresentations', 'expressionModes', 'graphicRole'];
const FOCUS_ENUM = ['calculation', 'written', 'application', 'selection', 'geometry', 'classification'];
let shapeOk = true;
let focusOk = true;
const firstBad = [];
intent.rows.forEach(function (r, i) {
  const tag = () => (r.knowledgeId + '|' + r.questionType + '#' + i);
  if (!r.intent || typeof r.intent !== 'object') { shapeOk = false; firstBad.push(tag() + ' intent 非对象'); return; }
  INTENT_KEYS.forEach(function (k) {
    if (!(k in r.intent)) { shapeOk = false; firstBad.push(tag() + ' intent.' + k + ' 缺键'); }
  });
  const a = r.assessment;
  if (!a || typeof a !== 'object') { shapeOk = false; firstBad.push(tag() + ' assessment 缺失'); return; }
  ASSESSMENT_KEYS.forEach(function (k) {
    if (!(k in a)) { shapeOk = false; firstBad.push(tag() + ' assessment.' + k + ' 缺键'); }
  });
  ['targetCodes', 'requiredRelations', 'requiredConstructs', 'allowedRepresentations', 'expressionModes']
    .forEach(function (k) {
      if (!Array.isArray(a[k])) { shapeOk = false; firstBad.push(tag() + ' ' + k + ' 非数组'); }
    });
  if (FOCUS_ENUM.indexOf(a.focus) === -1) { focusOk = false; firstBad.push(tag() + ' focus=' + a.focus); }
  if (a.graphicRole !== null && ['carrier', 'auxiliary'].indexOf(a.graphicRole) === -1) {
    shapeOk = false; firstBad.push(tag() + ' graphicRole=' + a.graphicRole);
  }
});
check('S3a', 'qt-intent 1570 行 intent 五问 + assessment 七键齐备、类型闭集', shapeOk,
  intent.rows.length + ' 行' + (firstBad.length ? '；首条 ' + firstBad[0] : ''));
check('S3b', 'assessment.focus 全部落在六类闭式枚举', focusOk,
  firstBad.length ? '首条 ' + firstBad[0] : '枚举=' + FOCUS_ENUM.join('/'));

// ---------- S4 基线计数 ----------
const kpMatrix = load('kp-matrix.json');
check('S4', '基线计数：qt-intent 1570 行 / kp-matrix 375 KP',
  intent.rows.length === 1570 && kpMatrix.kps.length === 375,
  'intent=' + intent.rows.length + '，kp-matrix=' + kpMatrix.kps.length);

console.log('=== P30-08 Teaching schema 门禁（T2 教学语义机读形状） ===');
checks.forEach(function (c) {
  process.stdout.write((c.ok ? '  ✓ ' : '  ✗ ') + c.id + '  ' + c.name);
  if (c.detail) process.stdout.write('  [' + c.detail + ']');
  process.stdout.write('\n');
});
if (failCount) {
  console.log('\nFAIL ' + failCount + ' 项');
  process.exit(1);
}
console.log('\nPASS — T2 教学语义文件形状契约成立（5 核心 + 6 现役，1570 行逐行校验）');
