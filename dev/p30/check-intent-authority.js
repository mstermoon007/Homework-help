#!/usr/bin/env node
'use strict';
/**
 * dev/p30/check-intent-authority.js — P30-06 qt-intent 生成权威门禁
 *
 * 规则（用户 P30-06 验收）：
 *   confirmed / ai-verified → 可作为强生成约束（intent 块含五问 + P30-05/10 机器七字段）
 *   needs-review           → 不得作为生成权威（resolve 时 intent/expression/graphic 必须为 null，
 *                            仅允许进入审查/覆盖报告）
 *
 * 断言：
 *   A1 qt-intent.json 行状态计数与 counts 自洽，状态枚举闭集
 *   A2 全部 1570 行经真实 GenerationParameters.resolve() 实测：
 *      权威行 → params.intent 非空且 intent 含 7 个机器字段（targetCodes/focus/requiredRelations/requiredConstructs/allowedRepresentations/expressionModes/graphicRole）
 *      needs-review → params.intent === null 且 params.expression === null 且 params.graphic === null，
 *                     sources.intent === 'blocked:qt-intent:needs-review'
 *   A4 Intent 覆盖：ALLOW(KP×题型) 1570 行与 qt-intent 行集合双向一一对应
 *      （覆盖与权威分离：needs-review 行同样计入覆盖，但不具生成权威）
 *   A3 两个生产读取点（semantic-parameters.resolve / generation/api.getTrainsWhatFromIntent）
 *      源码含同一权威白名单口径（静态断言，防静默移除）
 *
 * 用法：node dev/p30/check-intent-authority.js（0=PASS，1=FAIL）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json'), 'utf8'));
const rows = Array.isArray(doc.rows) ? doc.rows : [];

const checks = [];
let failCount = 0;
function check(id, name, ok, detail) {
  checks.push({ id: id, name: name, ok: !!ok, detail: detail || '' });
  if (!ok) failCount++;
}

// ---------- A1 数据自洽 ----------
const STATUS_ENUM = ['confirmed', 'ai-verified', 'needs-review'];
const tally = { confirmed: 0, 'ai-verified': 0, 'needs-review': 0 };
rows.forEach(function (r) {
  if (STATUS_ENUM.indexOf(r.status) !== -1) tally[r.status]++;
});
check('A1a', '行数 == 1570', rows.length === 1570, String(rows.length));
check('A1b', '状态枚举闭集（无未知状态）',
  rows.every(function (r) { return STATUS_ENUM.indexOf(r.status) !== -1; }),
  JSON.stringify(tally));
check('A1c', 'counts 与实测一致',
  doc.counts && doc.counts.rows === rows.length &&
  doc.counts.confirmed === tally.confirmed &&
  doc.counts.aiVerified === tally['ai-verified'] &&
  doc.counts.needsReview === tally['needs-review'],
  JSON.stringify(tally));
check('A1d', '三类状态均非空（门禁有实际防护面）',
  tally.confirmed > 0 && tally['ai-verified'] > 0 && tally['needs-review'] > 0,
  JSON.stringify(tally));

// ---------- A2 经真实 resolve 全量实测 ----------
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

const ASSESSMENT_KEYS = ['targetCodes', 'focus', 'requiredRelations', 'requiredConstructs',
  'allowedRepresentations', 'expressionModes', 'graphicRole'];
let authOk = true, blockedOk = true, assessOk = true;
const bad = [];
rows.forEach(function (r) {
  const p = SP.resolve(r.knowledgeId, r.questionType);
  if (!p) { bad.push(r.knowledgeId + '|' + r.questionType + ' resolve=null'); authOk = blockedOk = false; return; }
  if (r.status === 'needs-review') {
    if (p.intent !== null || p.expression !== null || p.graphic !== null ||
      p.sources.intent !== 'blocked:qt-intent:needs-review') {
      blockedOk = false; bad.push(r.knowledgeId + '|' + r.questionType + ' needs-review 泄漏生成参数');
    }
  } else {
    if (!p.intent) { authOk = false; bad.push(r.knowledgeId + '|' + r.questionType + ' 权威行缺 intent'); return; }
    ASSESSMENT_KEYS.forEach(function (k) {
      if (!(k in p.intent)) { assessOk = false; bad.push(r.knowledgeId + '|' + r.questionType + ' intent.' + k + ' 缺失'); }
    });
    if (p.intent.targetCodes.length !== 1 || p.intent.targetCodes[0] !== r.knowledgeId) {
      assessOk = false; bad.push(r.knowledgeId + '|' + r.questionType + ' targetCodes 不溯源本 KP');
    }
  }
});
check('A2a', 'needs-review 行零生成权威（intent/expression/graphic 全 null，285 行全测）', blockedOk,
  tally['needs-review'] + ' 行实测' + (bad.length ? '；首条: ' + bad[0] : ''));
check('A2b', 'confirmed/ai-verified 行挂载 intent（1285 行全测）', authOk,
  (tally.confirmed + tally['ai-verified']) + ' 行实测' + (bad.length ? '；首条: ' + bad[0] : ''));
check('A2c', '权威行 intent 含 7 个机器字段且 targetCodes 溯源', assessOk,
  bad.length ? '首条: ' + bad[0] : '7/7 字段 × ' + (tally.confirmed + tally['ai-verified']) + ' 行');

// ---------- A4 Intent 覆盖：ALLOW(KP×题型) 与 qt-intent 行集合双向一一对应 ----------
const mappingsRaw = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'kbl', 'mappings', 'generation-contract', 'math.json'), 'utf8'));
const mappings = Array.isArray(mappingsRaw) ? mappingsRaw : mappingsRaw.mappings;
const allowKeys = new Set(mappings.filter(function (m) {
  return m.permission === 'allow'; // 映射文件本身 math 专属，行内无 subject 字段
}).map(function (m) { return m.knowledgeId + '|' + m.questionType; }));
const intentKeys = new Set(rows.map(function (r) { return r.knowledgeId + '|' + r.questionType; }));
const missing = [], extra = [];
allowKeys.forEach(function (k) { if (!intentKeys.has(k)) missing.push(k); });
intentKeys.forEach(function (k) { if (!allowKeys.has(k)) extra.push(k); });
check('A4a', 'Intent 覆盖：1570 ALLOW 行均有意图行', allowKeys.size === 1570 && missing.length === 0,
  'ALLOW=' + allowKeys.size + '，缺意图 ' + missing.length + (missing.length ? '；首条 ' + missing[0] : ''));
check('A4b', 'Intent 无越权行：每行都对应一条 ALLOW', extra.length === 0,
  '多余 ' + extra.length + (extra.length ? '；首条 ' + extra[0] : ''));

// ---------- A3 两读取点源码静态断言 ----------
const spSrc = fs.readFileSync(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(ROOT, 'shared', 'generation', 'api.js'), 'utf8');
check('A3a', 'semantic-parameters.js 读取点含权威白名单',
  /INTENT_AUTHORITY_STATUSES\s*=\s*\{\s*confirmed:\s*true,\s*'ai-verified':\s*true\s*\}/.test(spSrc) &&
  spSrc.indexOf('INTENT_AUTHORITY_STATUSES[intentRow.status]') !== -1);
check('A3b', 'generation/api.js 读取点含权威白名单',
  /INTENT_AUTHORITY_STATUSES\s*=\s*\{\s*confirmed:\s*true,\s*'ai-verified':\s*true\s*\}/.test(apiSrc) &&
  apiSrc.indexOf('INTENT_AUTHORITY_STATUSES[r.status]') !== -1);

console.log('=== P30-06 qt-intent 生成权威门禁（needs-review ≠ generation authority） ===');
checks.forEach(function (c) {
  process.stdout.write((c.ok ? '  ✓ ' : '  ✗ ') + c.id + '  ' + c.name);
  if (c.detail) process.stdout.write('  [' + c.detail + ']');
  process.stdout.write('\n');
});
if (failCount) {
  console.log('\nFAIL ' + failCount + ' 项');
  process.exit(1);
}
console.log('\nPASS — confirmed ' + tally.confirmed + ' / ai-verified ' + tally['ai-verified'] +
  ' 行为生成权威；needs-review ' + tally['needs-review'] + ' 行仅进审查，不控制 Generator');
