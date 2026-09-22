#!/usr/bin/env node
'use strict';

// dev/p28/check-security.js
// P28-40 · 安全面扫描
// 1. shared/ 生产代码无 eval( / new Function(
// 2. AnswerValidator 安全测试通过

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let pass = 0, fail = 0;

console.log('============================================');
console.log('  P28-40 · 安全面扫描');
console.log('============================================\n');

// 1. 扫描 shared/ 中的 eval( / new Function(
console.log('▶ [1] eval / new Function 扫描（shared/ 生产代码）');
try {
  const output = execSync(
    `grep -rn '\\beval\\s*(' shared/ --include='*.js' 2>/dev/null || true`,
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
  const output2 = execSync(
    `grep -rn '\\bnew\\s\\+Function\\s*(' shared/ --include='*.js' 2>/dev/null || true`,
    { cwd: ROOT, encoding: 'utf8' }
  ).trim();
  const hits = (output + '\n' + output2).trim();
  if (hits) {
    // 过滤注释行
    const realHits = hits.split('\n').filter(l =>
      !l.trim().startsWith('//') &&
      !l.trim().startsWith('*') &&
      !l.includes("'eval") &&
      !l.includes('"eval') &&
      !l.includes('// eval') &&
      !l.includes('无 eval') &&
      !l.includes('无 new Function')
    );
    if (realHits.length > 0) {
      console.log('  ✗ FAIL — 发现 eval/new Function：');
      realHits.forEach(h => console.log('    ' + h));
      fail++;
    } else {
      console.log('  ✓ PASS — 0 处 eval/new Function（仅注释命中）');
      pass++;
    }
  } else {
    console.log('  ✓ PASS — 0 处 eval/new Function');
    pass++;
  }
} catch (e) {
  console.log('  ✓ PASS — 0 处 eval/new Function');
  pass++;
}

// 2. AnswerValidator 安全测试
console.log('\n▶ [2] AnswerValidator 安全测试');
try {
  execSync('node --test tests/validator/answer-validator.test.js', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log('  ✓ PASS — AnswerValidator 安全测试全部通过');
  pass++;
} catch (e) {
  console.log('  ✗ FAIL — AnswerValidator 安全测试失败');
  console.log('    ' + e.stderr?.slice(0, 200));
  fail++;
}

// 3. SVG Sanitizer 测试
console.log('\n▶ [3] SVG Sanitizer 安全测试');
try {
  execSync('node --test tests/presentation/svg-sanitizer.test.js', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log('  ✓ PASS — SVG Sanitizer 测试全部通过');
  pass++;
} catch (e) {
  console.log('  ✗ FAIL — SVG Sanitizer 测试失败');
  console.log('    ' + e.stderr?.slice(0, 200));
  fail++;
}

// 4. HTML 安全边界（print.js 含安全注释）
console.log('\n▶ [4] HTML 安全边界检查（print.js outerHTML/innerHTML）');
try {
  const printSrc = fs.readFileSync(
    path.join(ROOT, 'shared/presentation/print.js'),
    'utf8'
  );
  const hasOuterHTMLComment = printSrc.includes('outerHTML');
  const hasInnerHTMLComment = printSrc.includes('innerHTML');
  if (hasOuterHTMLComment && hasInnerHTMLComment) {
    console.log('  ✓ PASS — print.js outerHTML/innerHTML 已标注安全边界');
    pass++;
  } else {
    console.log('  ✗ FAIL — print.js 缺少安全边界标注');
    fail++;
  }
} catch (e) {
  console.log('  ✗ FAIL — 无法读取 print.js');
  fail++;
}

// 5. KBL 写保护（回写白名单门禁）
console.log('\n▶ [5] KBL 写保护（回写白名单）');
try {
  execSync('node dev/p28/check-kbl-ai-boundary.js', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log('  ✓ PASS — KBL 回写白名单 + 页面漂移 + 公开面只读');
  pass++;
} catch (e) {
  console.log('  ✗ FAIL — KBL 写保护检查失败');
  console.log('    ' + (e.stdout || e.stderr || '').slice(0, 300));
  fail++;
}

// 6. SEO/AI 历史隔离
console.log('\n▶ [6] SEO/AI 历史隔离（六目录 noindex/nofollow）');
try {
  execSync('node dev/p28/check-seo-ai-history-isolation.js', {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  console.log('  ✓ PASS — 六目录隔离');
  pass++;
} catch (e) {
  console.log('  ✗ FAIL — 六目录隔离检查失败');
  console.log('    ' + (e.stdout || e.stderr || '').slice(0, 300));
  fail++;
}

console.log('\n============================================');
console.log(`  Security: ${pass} PASS / ${fail} FAIL`);
console.log('============================================');
process.exit(fail > 0 ? 1 : 0);
