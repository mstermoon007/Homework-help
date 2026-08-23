// scripts/rename-knowledge-files.js
// 同步 knowledge/ 详情页文件名以匹配迁移后的新 ID。
//   - 详情页：grade-{grade}-{moduleId}-{oldId}.html  ->  {newId}.html
//   - 模块页：grade-{grade}-{moduleId}.html          ->  g{grade}-{moduleIdLower}.html
//   - index.html 保持不变（枢纽页，内容链接需另行再生成）
// 安全：先全量校验（映射完整、无重名冲突），再逐个 rename；
//       任一 rename 失败即按日志回滚已执行项并报错退出。
// 用法：node scripts/rename-knowledge-files.js
'use strict';

const fs = require('fs');
const path = require('path');

const KNOW_DIR = path.join(__dirname, '..', 'knowledge');
const MAP_FILE = path.join(__dirname, '..', 'migration-map-final.csv');

function parseCSV(s) {
  const rows = [];
  let row = [], field = '', q = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function main() {
  const csvText = fs.readFileSync(MAP_FILE, 'utf8').replace(/\r/g, '');
  const rows = parseCSV(csvText).slice(1); // 跳过表头
  const lookup = {};
  rows.forEach(function (r) { lookup[r[2] + '|' + r[3] + '|' + r[0]] = r[1]; });

  const files = fs.readdirSync(KNOW_DIR).filter(function (f) { return f.endsWith('.html'); });
  const detailRe = /^grade-(\d)-([MC]\d+)-(.+)\.html$/;
  const moduleRe = /^grade-(\d)-([MC]\d+)\.html$/;

  // 1) 生成重命名计划
  const plan = [];       // {from, to, kind}
  const seenTargets = {};
  const errors = [];

  files.forEach(function (f) {
    if (f === 'index.html') return;
    let m = detailRe.exec(f);
    if (m) {
      const key = m[1] + '|' + m[2] + '|' + m[3];
      const nid = lookup[key];
      if (!nid) { errors.push('详情页缺少映射: ' + f); return; }
      plan.push({ from: f, to: nid + '.html', kind: 'detail' });
      return;
    }
    m = moduleRe.exec(f);
    if (m) {
      plan.push({ from: f, to: 'g' + m[1] + '-' + m[2].toLowerCase() + '.html', kind: 'module' });
      return;
    }
    errors.push('无法识别的文件（已跳过）: ' + f);
  });

  // 2) 冲突检测：目标重名 / 目标已存在 / 源即目标
  const existing = new Set(files);
  plan.forEach(function (p) {
    if (p.from === p.to) { errors.push('源等于目标: ' + p.from); return; }
    if (seenTargets[p.to]) { errors.push('重复目标 ' + p.to + '：' + seenTargets[p.to] + ' 与 ' + p.from); return; }
    seenTargets[p.to] = p.from;
    if (existing.has(p.to)) errors.push('目标已存在: ' + p.to + '（来自 ' + p.from + '）');
  });

  if (errors.length) {
    console.error('校验失败，取消重命名：');
    errors.forEach(function (e) { console.error('  ' + e); });
    process.exit(1);
  }

  console.log('计划重命名文件数:', plan.length, '（详情页 + 模块页）');

  // 3) 执行重命名（带回滚日志）
  const journal = []; // 已执行 {from,to}
  let done = 0;
  try {
    plan.forEach(function (p) {
      const fromAbs = path.join(KNOW_DIR, p.from);
      const toAbs = path.join(KNOW_DIR, p.to);
      fs.renameSync(fromAbs, toAbs);
      journal.push(p);
      done++;
    });
  } catch (err) {
    console.error('重命名中断（' + err.message + '），正在回滚已执行的 ' + journal.length + ' 项...');
    journal.reverse().forEach(function (p) {
      try { fs.renameSync(path.join(KNOW_DIR, p.to), path.join(KNOW_DIR, p.from)); }
      catch (e2) { console.error('  回滚失败 ' + p.to + ' -> ' + p.from + ' : ' + e2.message); }
    });
    process.exit(1);
  }

  console.log('重命名完成:', done, '项');

  // 4) 校验：无旧命名残留
  const now = fs.readdirSync(KNOW_DIR);
  const residue = now.filter(function (f) { return /^grade-/.test(f); });
  console.log('剩余旧命名(grade-*)文件:', residue.length);
  residue.forEach(function (f) { console.log('  ' + f); });
}

main();
