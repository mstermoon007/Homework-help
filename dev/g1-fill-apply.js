#!/usr/bin/env node
/**
 * dev/g1-fill-apply.js — 将 docs/g1-knowledge-fill-draft.json 应用到 shared/knowledge-math.js
 *
 * 外科式行级插入：
 *   - 在每个 KP 的 example: 行后插入 concept / operations / factualContent / common_errors / graphicType
 *   - 替换该 KP 的 applicable_question_types 行为 canonical 值
 *   - prerequisites 保持现状（根节点已显式 []）
 * 保护：若 KP 已存在任一待插字段，则报错退出，不落盘。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const patch = require(path.join(ROOT, 'docs', 'g1-knowledge-fill-draft.json'));
const FILE = path.join(ROOT, 'shared', 'knowledge-math.js');

const lines = fs.readFileSync(FILE, 'utf8').split('\n');
const byId = {};
patch.items.forEach(it => { byId[it.id] = it.patch; });

const NEW_FIELDS = ['concept', 'operations', 'factualContent', 'common_errors', 'graphicType'];

let applied = 0;
const problems = [];

for (let i = 0; i < lines.length; i++) {
  const m = /^\s*id:\s*"([^"]+)",\s*$/.exec(lines[i]);
  if (!m) continue;
  const kpId = m[1];
  if (!byId[kpId]) continue;
  const p = byId[kpId];

  // 定位本 KP 块内字段：从 id 行向后搜索，遇下一个 id: 行即止（纯内容定位，抗行号偏移）
  function findField(from, fieldRe) {
    for (let j = from; j < lines.length; j++) {
      if (fieldRe.test(lines[j])) return j;
      if (/^\s*id:\s*"/.test(lines[j])) return -1;
    }
    return -1;
  }

  // 已存在字段保护
  for (const f of NEW_FIELDS) {
    if (findField(i + 1, new RegExp('^\\s*' + f + '\\s*:')) !== -1) {
      problems.push(kpId + ' 已存在字段 ' + f);
    }
  }
  if (problems.length) continue;

  // example 行
  const exIdx = findField(i + 1, /^\s*example:/);
  if (exIdx === -1) { problems.push(kpId + ' 缺 example 行'); continue; }
  const indent = lines[exIdx].match(/^\s*/)[0];

  // 插入新字段
  const block = [
    'concept: ' + JSON.stringify(p.concept) + ',',
    'operations: ' + JSON.stringify(p.operations) + ',',
    'factualContent: ' + JSON.stringify(p.factualContent) + ',',
    'common_errors: ' + JSON.stringify(p.common_errors) + ',',
    'graphicType: ' + JSON.stringify(p.graphicType) + ','
  ].map(s => indent + s);
  lines.splice(exIdx + 1, 0, ...block);

  // applicable_question_types 行（splice 后仍按内容定位，坐标含偏移，直接替换）
  const qtIdx = findField(i + 1, /^\s*applicable_question_types:/);
  if (qtIdx === -1) { problems.push(kpId + ' 缺 applicable_question_types 行'); continue; }
  lines[qtIdx] = indent + 'applicable_question_types: ' + JSON.stringify(p.applicable_question_types) + ',';

  applied++;
  i = qtIdx; // 跳到插入区之后
}

if (problems.length) {
  console.error('[FAIL] 未应用，存在以下问题：');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}

fs.writeFileSync(FILE, lines.join('\n'), 'utf8');
console.log('[OK] 已应用 ' + applied + ' 条补全到 ' + FILE);
