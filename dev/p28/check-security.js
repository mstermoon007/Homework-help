#!/usr/bin/env node
'use strict';

// dev/p28/check-security.js
// P28-40 · 安全面扫描（FINAL-70/71 强化）
// 1. 全交付面无 eval( / new Function(（shared 含 bundle / plugins / feedback / 根 js / 全部 html 内联脚本）
// 2. AnswerValidator 安全测试（含 FINAL-70 嵌入式恶意输入 FAIL + 哨兵 + 子进程不执行证据）
// 3. SVG Sanitizer 安全测试
// 4. HTML 安全边界（FINAL-71 Presentation 对抗测试 + 打印窗口 CSP script-src 'none'）
// 5. KBL 写保护
// 6. SEO/AI 历史隔离

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let pass = 0, fail = 0;

console.log('============================================');
console.log('  P28-40 · 安全面扫描');
console.log('============================================\n');

// FINAL-70/71：交付面文件清单——只扫真实交付给浏览器的产物，
// 不扫 dev/ tests/ scripts/ archive/ 等开发/历史目录。
function listProductionFiles() {
  const files = [];
  function walk(dir, ext) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, ext);
      else if (e.isFile() && p.endsWith(ext)) files.push(p);
    }
  }
  // JS：shared（含两个 bundle）/ plugins / feedback 递归 + 根目录直挂 js（sw.js）
  ['shared', 'plugins', 'feedback'].forEach(function (d) { walk(path.join(ROOT, d), '.js'); });
  fs.readdirSync(ROOT, { withFileTypes: true }).forEach(function (e) {
    if (e.isFile() && e.name.endsWith('.js')) files.push(path.join(ROOT, e.name));
  });
  // HTML：根目录公共页（非递归）+ knowledge/ 375 知识页（内联脚本同口径）
  fs.readdirSync(ROOT, { withFileTypes: true }).forEach(function (e) {
    if (e.isFile() && e.name.endsWith('.html')) files.push(path.join(ROOT, e.name));
  });
  walk(path.join(ROOT, 'knowledge'), '.html');
  return files;
}

const DANGEROUS = [
  { re: /\beval\s*\(/, label: 'eval(' },
  { re: /new\s+Function\s*\(/, label: 'new Function(' }
];

// 1. 全交付面 eval( / new Function( 扫描（逐行剔除纯注释行）
console.log('▶ [1] eval / new Function 全交付面扫描（shared/plugins/feedback/sw.js/全部 HTML）');
{
  const hits = [];
  const scanned = listProductionFiles();
  scanned.forEach(function (file) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach(function (line, idx) {
      const t = line.trim();
      if (!t || t.startsWith('//') || t.startsWith('*') || t.startsWith('<!--')) return; // 纯注释行
      DANGEROUS.forEach(function (d) {
        if (d.re.test(line)) hits.push(path.relative(ROOT, file) + ':' + (idx + 1) + ' [' + d.label + '] ' + t.slice(0, 120));
      });
    });
  });
  if (hits.length) {
    console.log('  ✗ FAIL — 交付面发现动态执行汇点：');
    hits.forEach(function (h) { console.log('    ' + h); });
    fail++;
  } else {
    console.log('  ✓ PASS — 扫描 ' + scanned.length + ' 个交付文件，eval/new Function 0 命中');
    pass++;
  }
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

// 4. HTML 安全边界（FINAL-71）：Presentation 全链对抗测试 + 打印窗口 CSP
console.log('\n▶ [4] HTML 安全边界（Presentation 对抗测试 + 打印窗口 CSP）');
{
  let boundaryOk = true;
  // 4a. 题目/选项转义、graphicGuard、SVGRegistry rawSvg 拒收/中和、
  //     SemanticQuestion 顶层 rawSvg/svg/html GRAPHIC_INVALID、端到端干净
  try {
    execSync('node --test tests/presentation/renderer.test.js', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (e) {
    boundaryOk = false;
    console.log('  ✗ FAIL — Presentation HTML 安全边界对抗测试失败');
    console.log('    ' + (e.stderr || e.stdout || '').slice(-400));
  }
  // 4b. 打印窗口 CSP 必须禁脚本：即使敌意标记混入序列化 DOM 也不能执行
  try {
    const printSrc = fs.readFileSync(path.join(ROOT, 'shared/presentation/print.js'), 'utf8');
    // 源码内为 JS 单引号字符串转义形态：script-src \'none\'
    if (!/script-src\s+\\?'none\\?'/.test(printSrc)) {
      boundaryOk = false;
      console.log('  ✗ FAIL — print.js 打印窗口缺少 CSP script-src \'none\'');
    }
  } catch (e) {
    boundaryOk = false;
    console.log('  ✗ FAIL — 无法读取 shared/presentation/print.js');
  }
  if (boundaryOk) {
    console.log('  ✓ PASS — Presentation 对抗测试全过 + print CSP script-src \'none\'');
    pass++;
  } else {
    fail++;
  }
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
