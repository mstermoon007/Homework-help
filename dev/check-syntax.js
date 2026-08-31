#!/usr/bin/env node
/**
 * dev/check-syntax.js — 语法检查（M0-10 步骤 1）
 *
 * 对 shared/ plugins/ dev/ scripts/ test/ tests/ 下所有 .js 执行 `node --check`，
 * 捕获语法错误。纯静态、零副作用、可重复。
 */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['shared', 'plugins', 'dev', 'scripts', 'test', 'tests'];

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(function (e) {
    const p = path.join(dir, e);
    let st;
    try { st = fs.statSync(p); } catch (err) { return; }
    if (st.isDirectory()) walk(p, out);
    else if (e.endsWith('.js')) out.push(p);
  });
}

const files = [];
DIRS.forEach(function (d) { walk(path.join(ROOT, d), files); });

const errors = [];
files.forEach(function (f) {
  try {
    execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (err) {
    const first = (err.stderr ? err.stderr.toString() : err.message || '').split('\n').filter(Boolean)[0] || 'syntax error';
    errors.push(f.replace(ROOT + path.sep, '') + ' :: ' + first);
  }
});

function run() {
  return {
    name: '语法检查 (Syntax Check)',
    pass: errors.length === 0,
    errors: errors,
    warnings: [],
    summary: '检查 ' + files.length + ' 个 JS 文件，发现 ' + errors.length + ' 处语法错误'
  };
}

module.exports = { run: run };
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
