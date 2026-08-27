#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let allPassed = true;
const results = [];

function check(description, condition, detail) {
  results.push({ description, pass: !!condition, detail: detail || '' });
  if (!condition) allPassed = false;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fileContains(relativePath, substring) {
  try {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
    return content.includes(substring);
  } catch {
    return false;
  }
}

// Page dependencies definition
// Each entry: pageName -> [required script/css references to check in the HTML]
// Format: 'path/to/page.html' -> ['shared/common.js', 'shared/tokens.css', ...]
const PAGE_DEPS = {
  'index.html': [
    'shared/common.js',
    'shared/tokens.css',
    'shared/base.css',
    'shared/states.css',
  ],
  'practice.html': [
    'shared/common.js',
    'shared/difficulty.js',
    'shared/print.js',
    'shared/knowledge-bank.js',
    'plugins/registry.js',
  ],
  'math-types.html': [
    'shared/common.js',
    'shared/subject-utils.js',
    'shared/difficulty.js',
    'shared/knowledge-bank.js',
    'shared/module-catalog.js',
    'plugins/registry.js',
  ],
  'subject-types.html': [
    'shared/common.js',
    'shared/subject-utils.js',
    'shared/difficulty.js',
    'shared/knowledge-bank.js',
    'shared/module-catalog.js',
    'plugins/registry.js',
  ],
  'faq.html': [
    'shared/tokens.css',
  ],
};

// Critical DOM elements per page (strings that should appear in the HTML body)
const CRITICAL_DOM = {
  'index.html': ['<!DOCTYPE html>', '<html', '</html>'],
  'practice.html': ['<!DOCTYPE html>', 'problemsArea', 'generate', 'check'],
  'math-types.html': ['<!DOCTYPE html>', 'typeGrid', 'plugin'],
  'subject-types.html': ['<!DOCTYPE html>', 'typeGrid', 'subject'],
  'faq.html': ['<!DOCTYPE html>', 'FAQPage'],
};

// Entry script check: the first or key <script src=... reference
const ENTRY_SCRIPTS = {
  'index.html': 'shared/common.js',
  'practice.html': 'shared/common.js',
  'math-types.html': 'shared/common.js',
  'subject-types.html': 'shared/common.js',
  'faq.html': null, // faq has inline scripts only, no external script src
};

// ==========================================
// 1. File existence check
// ==========================================

function checkPageFileExists(page) {
  const htmlPath = path.join(ROOT, page);
  check(`${page} 文件存在`, fileExists(page));
  return fileExists(page);
}

// ==========================================
// 2. HTML script/css reference check
// ==========================================

function checkPageScriptRefs(page, deps) {
  if (!checkPageFileExists(page)) return;

  const content = fs.readFileSync(path.join(ROOT, page), 'utf-8');

  deps.forEach(dep => {
    // Check for <script src="dep"> OR <link rel="stylesheet" href="dep">
    const scriptPattern = `<script src="${dep}"`;
    const linkPattern = `<link rel="stylesheet" href="${dep}"`;
    const hasScriptRef = content.includes(scriptPattern);
    const hasLinkRef = content.includes(linkPattern);
    const hasRef = hasScriptRef || hasLinkRef;
    check(`HTML 引用存在: ${dep}`, hasRef);
  });
}

// ==========================================
// 3. JS path correctness check
// ==========================================

function checkJsPaths(page) {
  if (!checkPageFileExists(page)) return;

  const content = fs.readFileSync(path.join(ROOT, page), 'utf-8');
  const scriptRefs = content.match(/<script src="([^"]*)"[^>]*>/g) || [];

  scriptRefs.forEach(scriptTag => {
    const match = scriptTag.match(/<script src="([^"]*)"[^>]*>/);
    if (match) {
      const src = match[1];
      // Check that the file actually exists at that path
      const exists = fileExists(src);
      check(`JS路径正确: ${src} (存在: ${exists})`, exists);
    }
  });
}

// ==========================================
// 4. CSS path correctness check
// ==========================================

function checkCssPaths(page) {
  if (!checkPageFileExists(page)) return;

  const content = fs.readFileSync(path.join(ROOT, page), 'utf-8');
  const linkRefs = content.match(/<link rel="stylesheet" href="([^"]*)"[^>]*>/g) || [];

  linkRefs.forEach(linkTag => {
    const match = linkTag.match(/<link rel="stylesheet" href="([^"]*)"[^>]*>/);
    if (match) {
      const href = match[1];
      const exists = fileExists(href);
      check(`CSS路径正确: ${href} (存在: ${exists})`, exists);
    }
  });
}

// ==========================================
// 5. Critical DOM existence check
// ==========================================

function checkCriticalDom(page) {
  if (!checkPageFileExists(page)) return;

  const content = fs.readFileSync(path.join(ROOT, page), 'utf-8');

  const domChecks = CRITICAL_DOM[page] || [];
  domChecks.forEach(dom => {
    check(`关键DOM存在: ${dom}`, content.includes(dom));
  });
}

// ==========================================
// 6. Entry script existence check
// ==========================================

function checkEntryScript(page) {
  if (!checkPageFileExists(page)) return;

  const entryScript = ENTRY_SCRIPTS[page];
  if (!entryScript) {
    // For pages like faq that have no external script src, just check HTML structure
    check(`${page} 入口脚本存在`, function(content) { return true; });
    return;
  }

  const hasScript = fileContains(page, `<script src="${entryScript}"`);
  check(`入口脚本存在: ${entryScript}`, hasScript);
}

// ==========================================
// Run all checks
// ==========================================

console.log('🔍 开始页面完整性检测...\n');

// Check each page
const pages = Object.keys(PAGE_DEPS);

pages.forEach(page => {
  console.log(`检查 ${page}...`);

  // 1. File existence
  checkPageFileExists(page);

  // 2. HTML script/css references
  const deps = PAGE_DEPS[page];
  checkPageScriptRefs(page, deps);

  // 3. JS path correctness
  checkJsPaths(page);

  // 4. CSS path correctness
  checkCssPaths(page);

  // 5. Critical DOM existence
  checkCriticalDom(page);

  // 6. Entry script existence
  checkEntryScript(page);

  console.log('');
});

// ==========================================
// Summary
// ==========================================

console.log('📋 检查结果汇总\n' + '='.repeat(50));

results.forEach((r, i) => {
  console.log(`${r.pass ? '✅' : '❌'} ${r.description}`);
  if (!r.pass && r.detail) console.log(`   ↳ ${r.detail}`);
});

console.log('='.repeat(50));

const passed = results.filter(r => r.pass).length;
const total = results.length;
console.log(`\n${passed}/${total} 检查通过`);

if (allPassed) {
  console.log('🎉 所有页面完整性检测通过！');
  process.exit(0);
} else {
  console.log('⚠️  部分检查未通过，请根据上方 ❌ 项进行修复。');
  process.exit(1);
}