#!/usr/bin/env node
/**
 * dev/r2-difficulty-anchor-apply.js — 应用 R2 难度锚点标定到 knowledge-*.js（Frozen Core 数据）
 *
 * 依据 Q6 年级难度锚点表（dev/difficulty-anchor-table.js）：G1 1-2 / G2 2-4 / G3 3-5 / G4 4-7 / G5 5-8 / G6 6-10。
 * 行为：
 *   1) 归档备份 knowledge-math/cn/en.js → archive/knowledge-<sub>-difficulty-<ts>.js
 *   2) 逐行处理：跟踪当前 grade，将 `difficulty: <d>`（d ∈ 1-5）按锚点表线性映射为绝对难度（1-10）
 *      已映射值（6-10 或其它）不动；行级最小改写，保留文件其余内容/格式
 *   3) 输出每年级映射统计
 *
 * 改后验证：node dev/check-difficulty-anchor.js && npm run verify:m1 && npm run check-regression && npm test
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
const { mapToAbs } = require(path.join(ROOT, 'dev', 'difficulty-anchor-table.js'));

const FILES = ['math', 'cn', 'en'].map((sub) => ({
  sub,
  fp: path.join(ROOT, 'shared', 'knowledge-' + sub + '.js')
}));

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

const GRADE_RE = /^\s*["']?grade["']?\s*:\s*(\d+)\s*,?\s*$/;
const DIFF_RE = /^(\s*["']?difficulty["']?\s*:\s*)(\d+)(\s*,?\s*)$/;

// ---- 幂等保护：检测是否已标定（存在 difficulty > 5）----
// 原始 1-5 数据不可能出现 >5；一旦任一 KP 出现 >5 即视为已标定，拒绝重跑防止二次映射。
{
  let already = false;
  FILES.forEach(({ fp }) => {
    const text = fs.readFileSync(fp, 'utf8');
    if (/(["']?difficulty["']?\s*:\s*)(6|7|8|9|10)(\s*,?\s*$)/m.test(text)) already = true;
  });
  if (already) {
    console.error('[ABORT] 检测到 knowledge-*.js 已存在难度 > 5，疑似已标定。');
    console.error('  重复执行会产生二次映射（G2/G3 等低锚点年级无法按值域区分）。');
    console.error('  如需重跑，请先恢复原始数据：git checkout HEAD -- shared/knowledge-math.js shared/knowledge-cn.js shared/knowledge-en.js');
    process.exit(1);
  }
}

let totalMapped = 0;
const gradeStat = {};

FILES.forEach(({ sub, fp }) => {
  const text = fs.readFileSync(fp, 'utf8');
  const lines = text.split('\n');
  let curGrade = null;
  let mapped = 0;
  const gmap = {};

  const out = lines.map((line) => {
    const gm = GRADE_RE.exec(line);
    if (gm) { curGrade = Number(gm[1]); return line; }
    const dm = DIFF_RE.exec(line);
    if (!dm) return line;
    const d = Number(dm[2]);
    if (curGrade == null || d < 1 || d > 5) return line; // 无法定年级或已映射/越界，不动
    const abs = mapToAbs(curGrade, d);
    if (abs == null) return line;
    mapped++;
    gmap[curGrade] = gmap[curGrade] || { old: {}, nw: {} };
    gmap[curGrade].old[d] = (gmap[curGrade].old[d] || 0) + 1;
    gmap[curGrade].nw[abs] = (gmap[curGrade].nw[abs] || 0) + 1;
    return dm[1] + abs + dm[3];
  });

  const changedText = out.join('\n');
  if (changedText !== text) {
    const bak = archive(fp, 'difficulty');
    fs.writeFileSync(fp, changedText, 'utf8');
    console.log('[' + sub + '] 标定 ' + mapped + ' 个 KP → 备份 ' + path.basename(bak));
  } else {
    console.log('[' + sub + '] 无改动');
  }
  totalMapped += mapped;
  Object.keys(gmap).forEach((g) => {
    gradeStat[g] = gradeStat[g] || { old: {}, nw: {} };
    Object.keys(gmap[g].old).forEach((k) => { gradeStat[g].old[k] = (gradeStat[g].old[k] || 0) + gmap[g].old[k]; });
    Object.keys(gmap[g].nw).forEach((k) => { gradeStat[g].nw[k] = (gradeStat[g].nw[k] || 0) + gmap[g].nw[k]; });
  });
});

console.log('---');
console.log('标定 KP 合计：' + totalMapped);
Object.keys(gradeStat).sort((a, b) => Number(a) - Number(b)).forEach((g) => {
  console.log('  G' + g + '  原 difficulty ' + JSON.stringify(gradeStat[g].old) + ' → 新 difficulty ' + JSON.stringify(gradeStat[g].nw));
});
console.log('备份：archive/knowledge-<sub>-difficulty-*.js');
console.log('下一步验证：node dev/check-difficulty-anchor.js && npm run verify:m1 && npm run check-regression && npm test');
