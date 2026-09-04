#!/usr/bin/env node
/**
 * dev/r2d-ontology-apply.js — 应用 R2-d 五类本体补全草案（分批次）到 knowledge-*.js（Frozen Core 数据）
 *
 * 用法：node dev/r2d-ontology-apply.js <draft-file>
 *   - 默认 docs/r2d-g1-ontology-draft.json（G1）
 *   - G2: docs/r2d-g2-ontology-draft.json
 *
 * 行为（按条目与 KP 现状自适应）：
 *   1) 归档备份 knowledge-{math,cn}.js → archive/knowledge-<sub>-r2d-<ts>.js
 *   2) math G1（已有 common_errors、仅 errors）→ 替换 common_errors
 *   3) 其余（KP 无 concept/factual/graphic/common_errors）→ 在 status 行后插入缺失字段
 *      - math 文件：无引号键（concept: "…"）
 *      - cn 文件：引号键（"concept": "…"）
 *   行级最小改写，保留原文件其余内容/格式；幂等（重复运行不重复插入）
 *
 * 改后验证：npm run verify:m1 && npm run verify:m2 && npm run check-regression && npm test
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const DRAFT_FILE = process.argv[2] || 'docs/r2d-g1-ontology-draft.json';
const DRAFT = JSON.parse(fs.readFileSync(path.join(ROOT, DRAFT_FILE), 'utf8'));

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
const ID_RE = /^(\s*)(["']?id["']?\s*:\s*")([^"]+)(")/;
const COMMON_ERR_RE = /^(\s*["']?common_errors["']?\s*:\s*)(\[.*\])(,?\s*)$/;
// status 行：math 无引号键（status: "active"）/ cn 引号键（"status": "active"）
const STATUS_RE = /^(\s*["']?status["']?\s*:\s*"active")(,?\s*)$/;

const byId = {};
DRAFT.entries.forEach((en) => { byId[en.kpId] = en; });

function quoteKeys(text) {
  // 判断文件书写风格：含 "id": 视为引号键（cn），含 id: 视为无引号键（math）
  return /"id"\s*:/.test(text.slice(0, 4000));
}

function processFile(fp, want) {
  const lines = fs.readFileSync(fp, 'utf8').split('\n');
  const quoted = quoteKeys(lines.join('\n'));
  const indent = '              ';
  let curId = null;
  const done = {};
  const kpHasField = {}; // 幂等：KP 已有 concept/common_errors 等 → 不再插入
  const FIELD_RE = /^\s*["']?(concept|factualContent|graphicType|common_errors)["']?\s*:/;
  let replaced = 0, inserted = 0;
  const out = lines.map((line) => {
    const im = ID_RE.exec(line);
    if (im) curId = im[3];
    if (curId && FIELD_RE.test(line)) kpHasField[curId] = true;
    const en = curId ? byId[curId] : null;
    if (!en || en.subject !== want || done[curId]) return line;

    // 情形 A：KP 已有 common_errors 且草案仅 errors → 替换
    if (en.errors && !en.concept && !en.factualContent && !en.graphicType) {
      const cm = COMMON_ERR_RE.exec(line);
      if (!cm) return line;
      done[curId] = true;
      replaced++;
      return cm[1] + JSON.stringify(en.errors) + cm[3];
    }

    // 情形 B：插入缺失字段（concept/factualContent/graphicType/common_errors）；已插过则跳过（幂等）
    const sm = STATUS_RE.exec(line);
    if (!sm) return line;
    if (kpHasField[curId]) return line;
    done[curId] = true;
    const ins = [];
    const ser = (key, val) => (quoted ? indent + '"' + key + '": ' : indent + key + ': ') + JSON.stringify(val) + ',';
    if (en.concept) ins.push(ser('concept', en.concept));
    if (en.factualContent) ins.push(ser('factualContent', en.factualContent));
    if (en.graphicType) ins.push(ser('graphicType', en.graphicType));
    if (en.errors && en.errors.length) ins.push(ser('common_errors', en.errors));
    if (!ins.length) return line;
    inserted++;
    const fixed = line.replace(/^(\s*["']?status["']?\s*:\s*"active")(,?)(\s*)$/, '$1,$3');
    return fixed + '\n' + ins.join('\n');
  });
  const changed = out.join('\n');
  if (changed !== lines.join('\n')) {
    const bak = archive(fp, 'r2d');
    fs.writeFileSync(fp, changed, 'utf8');
    return { changed: true, replaced, inserted, bak: path.basename(bak) };
  }
  return { changed: false, replaced, inserted };
}

const stats = {};
for (const sub of ['math', 'cn']) {
  const entries = DRAFT.entries.filter((e) => e.subject === sub);
  if (!entries.length) continue;
  const fp = path.join(ROOT, 'shared', 'knowledge-' + sub + '.js');
  const r = processFile(fp, sub);
  stats[sub] = r;
  if (r.changed) console.log('[' + sub + '] 替换 ' + r.replaced + ' / 插入 ' + r.inserted + ' → 备份 ' + r.bak);
  else console.log('[' + sub + '] 无改动（替换 ' + r.replaced + ' / 插入 ' + r.inserted + '，幂等）');
}
console.log('---');
console.log('批次文件：' + DRAFT_FILE + '，条目 ' + DRAFT.entries.length);
console.log('下一步验证：npm run verify:m1 && npm run verify:m2 && npm run check-regression && npm test');
