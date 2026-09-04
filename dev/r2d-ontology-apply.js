#!/usr/bin/env node
/**
 * dev/r2d-ontology-apply.js — 应用 R2-d 五类本体补全批次 1（G1）到 knowledge-math/cn.js（Frozen Core 数据）
 *
 * 依据 docs/r2d-g1-ontology-draft.json（已评审确认）。行为：
 *   1) 归档备份 knowledge-math/cn.js → archive/knowledge-<sub>-r2d-<ts>.js
 *   2) math G1（53 个）：common_errors 已有 → 替换为草案 errors（bundle 整数组消费、无按 id 引用，替换安全；草案为知识点级完整错题模式）
 *   3) cn G1（7 个）：插入 concept / factualContent / graphicType / common_errors（cn 原无这些字段）
 *   行级最小改写，保留原文件其余内容/格式
 *   4) 输出统计
 *
 * 改后验证：npm run verify:m1 && npm run verify:m2 && npm run check-regression && npm test
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const DRAFT = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'r2d-g1-ontology-draft.json'), 'utf8'));

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}
function archive(fp, tag) {
  const dir = path.join(ROOT, 'archive');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, path.basename(fp).replace(/\.js$/, '') + '-' + tag + '-' + ts() + '.js');
  fs.copyFileSync(fp, dst);
  return dst;
}

// 只匹配行首的 KP id（避免 common_errors 内联 "id" 干扰 curId 跟踪）
const ID_RE = /^(\s*)(?:["']?id["']?\s*:\s*")([^"]+)(")/;
const COMMON_ERR_RE = /^(\s*common_errors\s*:\s*)(\[.*\])(,?\s*)$/;
const STATUS_RE = /^(\s*"status"\s*:\s*"active")(,?\s*)$/;

// 按 kpId 组织
const byId = {};
DRAFT.entries.forEach((en) => { byId[en.kpId] = en; });

let mathReplaced = 0, cnInserted = 0;
const pendingCns = DRAFT.entries.filter((e) => e.subject === 'cn').map((e) => e.kpId);

// ---------- math：替换 common_errors ----------
{
  const fp = path.join(ROOT, 'shared', 'knowledge-math.js');
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  let curId = null;
  const out = lines.map((line) => {
    const im = ID_RE.exec(line);
    if (im) curId = im[2];
    const en = curId ? byId[curId] : null;
    if (!en || en.subject !== 'math') return line;
    const cm = COMMON_ERR_RE.exec(line);
    if (!cm || !en.errors) return line;
    mathReplaced++;
    return cm[1] + JSON.stringify(en.errors) + cm[3];
  });
  const changed = out.join('\n');
  if (changed !== lines.join('\n')) {
    const bak = archive(fp, 'r2d');
    fs.writeFileSync(fp, changed, 'utf8');
    console.log('[math] 替换 common_errors ' + mathReplaced + ' 个 KP → 备份 ' + path.basename(bak));
  } else {
    console.log('[math] 无改动（应替换 ' + mathReplaced + ' 个）');
  }
}

// ---------- cn：插入 4 字段 ----------
{
  const fp = path.join(ROOT, 'shared', 'knowledge-cn.js');
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  let curId = null;
  const done = {}; // 幂等：同一 KP 只插一次
  const indent = '              ';
  const out = lines.map((line) => {
    const im = ID_RE.exec(line);
    if (im) curId = im[2];
    if (!curId || pendingCns.indexOf(curId) === -1 || done[curId]) return line;
    const sm = STATUS_RE.exec(line);
    if (!sm) return line;
    done[curId] = true;
    const en = byId[curId];
    const ins = [];
    if (en.concept) ins.push(indent + '"concept": ' + JSON.stringify(en.concept) + ',');
    if (en.factualContent) ins.push(indent + '"factualContent": ' + JSON.stringify(en.factualContent) + ',');
    if (en.graphicType) ins.push(indent + '"graphicType": ' + JSON.stringify(en.graphicType) + ',');
    if (en.errors && en.errors.length) ins.push(indent + '"common_errors": ' + JSON.stringify(en.errors) + ',');
    cnInserted++;
    // status 行若本身无逗号（对象末字段）需补逗号，否则紧跟插入字段会语法错误
    const fixed = line.replace(/("status"\s*:\s*"active")(,?)(\s*)$/, '$1,$3');
    return fixed + '\n' + ins.join('\n');
  });
  const changed = out.join('\n');
  if (changed !== lines.join('\n')) {
    const bak = archive(fp, 'r2d');
    fs.writeFileSync(fp, changed, 'utf8');
    console.log('[cn] 插入字段 ' + cnInserted + ' 个 KP → 备份 ' + path.basename(bak));
  } else {
    console.log('[cn] 无改动');
  }
}

console.log('---');
console.log('math 替换：' + mathReplaced + '（期望 53）| cn 插入：' + cnInserted + '（期望 7）');
console.log('下一步验证：npm run verify:m1 && npm run verify:m2 && npm run check-regression && npm test');
