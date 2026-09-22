#!/usr/bin/env node
'use strict';

// dev/p28/check-doc-consistency.js
// P28-39 · 文档一致性扫描器
// 搜索历史数字在非 archive 文档中的出现；命中即 FAIL

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DOCS_DIR = path.join(ROOT, 'docs');

// 历史数字清单（出现即违规）
const LEGACY_TOKENS = [
  { token: '598', desc: '旧 KP 计数（当前 375）' },
  { token: '566', desc: '旧 legacy 基线 KP 计数' },
  { token: '564', desc: '旧能力注册表冷启动计数' },
  { token: '1293', desc: '旧 Relations 计数（当前 0）' },
  { token: '639', desc: '旧 Mappings 计数（当前 1570）' },
  { token: '26 generators', desc: '旧 Generator 计数（当前 31）' },
  { token: '239 tests', desc: '旧测试数（当前 534）' },
  { token: '218 syntax', desc: '旧语法检查文件数（当前 286）' },
];

// 非.archive 目录下的 .md 文件
function collectDocs(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    // 跳过 archive 目录
    if (entry.name === 'archive') continue;
    if (entry.isDirectory()) {
      results.push(...collectDocs(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.md')) {
      results.push({ rel, abs: path.join(dir, entry.name) });
    }
  }
  return results;
}

const docs = collectDocs(DOCS_DIR);

const violations = [];

for (const doc of docs) {
  const content = fs.readFileSync(doc.abs, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { token, desc } of LEGACY_TOKENS) {
      if (line.includes(token)) {
        violations.push({
          file: doc.rel,
          line: i + 1,
          token,
          desc,
          content: line.trim(),
        });
      }
    }
  }
}

// 输出
console.log('============================================');
console.log('  P28-39 · 文档一致性扫描器');
console.log('============================================');
console.log(`扫描范围：docs/ 非 archive 的 .md 文件（${docs.length} 个）`);
console.log(`历史数字清单：${LEGACY_TOKENS.map(t => t.token).join(' / ')}`);
console.log('');

if (violations.length === 0) {
  console.log('✅ PASS — 非 archive 文档中未发现历史数字。');
  process.exit(0);
} else {
  console.log(`❌ FAIL — 发现 ${violations.length} 处违规：`);
  console.log('');
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  [${v.token}] ${v.desc}`);
    console.log(`    ${v.content}`);
    console.log('');
  }
  process.exit(1);
}
