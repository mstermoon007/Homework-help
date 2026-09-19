#!/usr/bin/env node
'use strict';
// dev/check-syntax.js — JS 语法门禁：对全部源码/脚本/测试执行 node --check
// 冻结基线门禁之一（输出 N/0：检查文件数 / 语法错误数）

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// P24-05：补入 plugins / feedback（原漏检 7 个 JS）。
const DIRS = ['shared', 'dev', 'scripts', 'tests', 'tools', 'plugins', 'feedback'];

function collectJs(dir, out) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJs(rel, out);
    else if (entry.name.endsWith('.js')) out.push(rel);
  }
}

const files = [];
DIRS.forEach((d) => collectJs(d, files));

let failed = 0;
for (const file of files) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, file)], {
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    failed += 1;
    console.error(`[FAIL] ${file}`);
    console.error(r.stderr);
  }
}

console.log(`语法检查：${files.length} 个文件，${failed} 个错误`);
process.exit(failed > 0 ? 1 : 0);
