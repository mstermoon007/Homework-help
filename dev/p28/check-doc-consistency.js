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

// 词边界正则：仅当 token 不被字母/数字包围时才算违规。
// 目的：拦截历史"计数"泄露（如 "598 KP"），不误判 sha256 哈希内部的子串（如 "...45988..." 中的 598）。
function buildRegex(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('(?<![A-Za-z0-9])' + escaped + '(?![A-Za-z0-9])');
}
const LEGACY_REGEX = LEGACY_TOKENS.map(function (t) { return { token: t.token, desc: t.desc, re: buildRegex(t.token) }; });

// 非.archive 目录下的 .md 文件
// 豁免审计日志（change-log.md / CHANGELOG.md）：它们需引用被禁历史 token 来记录治理修复本身，
// 属于元文档；扫描它们会对「描述扫描器」的合法引用产生假阳性（FINAL-01 已确立反假阳性原则）。
const AUDIT_LOG_BASENAMES = new Set(['change-log.md', 'changelog.md']);
function collectDocs(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    // 跳过 archive 目录
    if (entry.name === 'archive') continue;
    if (entry.isDirectory()) {
      results.push(...collectDocs(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith('.md')) {
      if (AUDIT_LOG_BASENAMES.has(entry.name.toLowerCase())) continue;
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
    for (const { token, desc, re } of LEGACY_REGEX) {
      if (re.test(line)) {
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
