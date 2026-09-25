#!/usr/bin/env node
'use strict';

// dev/check-all.js
// P28-40 + FINAL-90 + FINAL-91 · 唯一全量检查入口
// npm run check-all
//
// 一次性执行 FINAL-90 要求的 17 项检查域：
// version / KBL / lint / syntax / unit / generation / education / golden /
// difficulty / presentation / SVG / security / sitemap / crawl / browser /
// bundle / determinism
// （Coverage / LLM / Doc / Dead Code / Legacy 作为附加门禁列于 17 项之后）
//
// FINAL-91 只读门禁：运行前后对关键目录做 hash 快照，任何源码/测试/冻结文件
// 变更即 FAIL（CI 是 verify 不是 repair）。报告目录与 archive 允许写入。

const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const results = [];
let totalPass = 0, totalFail = 0, totalSkip = 0;

// ── FINAL-91 只读门禁：关键目录 hash 快照 ──
// 只快照「不得被 CI 修改」的目录/文件：源码、测试、KBL 冻结数据、当前架构文档、根配置。
// 报告目录（dev/reports/、dev/p26/reports/）与 archive 目录允许写入。
const READONLY_PATHS = [
  'shared', 'tests', 'kbl/canonical', 'kbl/manifest', 'kbl/data', 'kbl/relations', 'kbl/mappings', 'kbl/index',
  'plugins', 'feedback',
  'index.html', 'practice.html', 'select.html', 'faq.html', 'contact.html',
  'package.json', 'VERSION', 'sw.js', 'README.md',
];
// docs/ 非 archive 的 md 文件单独处理
function listDocsNonArchive() {
  const out = [];
  function walk(d, base) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'archive') continue;
      const rel = base ? base + '/' + e.name : e.name;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p, rel);
      else if (e.name.endsWith('.md')) out.push('docs/' + rel);
    }
  }
  try { walk(path.join(ROOT, 'docs'), ''); } catch (e) {}
  return out;
}
function hashFile(rel) {
  const abs = path.join(ROOT, rel);
  try { return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'); }
  catch (e) { return null; }
}
function snapshot() {
  const snap = {};
  for (const p of READONLY_PATHS) {
    const abs = path.join(ROOT, p);
    try {
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        function walk(d, base) {
          for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const rel = base ? base + '/' + e.name : e.name;
            const fp = path.join(d, e.name);
            if (e.isDirectory()) walk(fp, rel);
            else snap[p + '/' + rel] = crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
          }
        }
        walk(abs, '');
      } else {
        snap[p] = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
      }
    } catch (e) {}
  }
  for (const d of listDocsNonArchive()) snap[d] = hashFile(d);
  return snap;
}
const BEFORE = snapshot();

function run(label, command, opts = {}) {
  const { timeout = 300000 } = opts;
  process.stdout.write(`▶ ${label} ... `);
  try {
    const output = execSync(command, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts.env && { env: { ...process.env, ...opts.env } },
    });
    process.stdout.write('✓ PASS\n');
    results.push({ label, status: 'PASS' });
    totalPass++;
    return { ok: true, output };
  } catch (e) {
    // exit code 2 = SKIPPED（浏览器不可用等，非发布环境）—— 不得冒充 PASS
    if (e.status === 2) {
      process.stdout.write('⊘ SKIPPED\n');
      const out = (e.stdout || '') + (e.stderr || '');
      const lines = out.split('\n').filter(l => l.trim()).slice(-2);
      for (const l of lines) process.stdout.write('  ' + l + '\n');
      results.push({ label, status: 'SKIPPED' });
      totalSkip++;
      return { ok: false, skipped: true, output: out };
    }
    process.stdout.write('✗ FAIL\n');
    if (e.killed) {
      process.stdout.write('  (timeout)\n');
    }
    const err = (e.stdout || '') + (e.stderr || '');
    const lines = err.split('\n').filter(l => l.trim()).slice(-5);
    for (const l of lines) process.stdout.write('  ' + l + '\n');
    results.push({ label, status: 'FAIL' });
    totalFail++;
    return { ok: false, error: err };
  }
}

console.log('============================================');
console.log('  Homework Help — 全量检查（check-all）');
console.log('  FINAL-90 唯一最终门禁 · 17 项核心 + 附加门禁');
console.log('============================================\n');

// ── 1. Version ──
run('1.  Version      (SW 版本一致)', 'node scripts/sync-sw-version.js');

// ── 2. KBL ──
run('2.  KBL          (M0 聚合门禁)', 'node dev/verify-m0.js');
run('    KBL         (AI 边界 + 页面漂移)', 'node dev/p28/check-kbl-ai-boundary.js');

// ── 3. Lint ──
run('3.  Lint         (静态质量)', 'node dev/lint-check.js');

// ── 4. Syntax ──
run('4.  Syntax       (全量 JS 语法)', 'node dev/check-syntax.js');

// ── 5. Unit ──
run('5.  Unit         (全链测试)', 'node --test "tests/**/*.test.js"');

// ── 6. Generation ──
run('6a. Generation   (1570 ALLOW 真实生成)', 'node dev/check-allow-generation.js', { timeout: 600000 });
run('6b. Generation   (矩阵冻结)', 'node dev/p28/check-generation-matrix-freeze.js');
run('6c. Generation   (Generator Registry)', 'node dev/p28/check-generator-matrix.js');
run('6d. Generation   (四轴不夺权)', 'node dev/p28/check-generator-noninterference.js');

// ── 7. Education ──
run('7.  Education    (教育语义生成)', 'node dev/check-educational-generation.js');

// ── 8. Golden ──
run('8.  Golden       (金题集校验)', 'node dev/p25/validate-golden-dataset.js');

// ── 9. Difficulty ──
run('9a. Difficulty   (权威链唯一)', 'node dev/p28/check-difficulty-authority-gate.js');
run('9b. Difficulty   (溯源)', 'node dev/p28/check-difficulty-provenance-gate.js');

// ── 10. Presentation ──
run('10. Presentation (渲染 + Legacy 隔离)', 'node --test tests/presentation/renderer.test.js');

// ── 11. SVG ──
run('11. SVG          (契约 + Sanitizer)', 'node --test tests/presentation/svg-contract.test.js tests/presentation/svg-contract-full.test.js tests/presentation/svg-sanitizer.test.js');

// ── 12. Security ──
run('12. Security     (eval/Function + AnswerValidator + HTML + KBL写保护)', 'node dev/p28/check-security.js');

// ── 13. Sitemap ──
run('13. Sitemap      (381 URL 冻结)', 'node dev/p28/check-sitemap-freeze.js', { timeout: 120000 });

// ── 14. Crawl ──
run('14a. Crawl       (AI Agent 抓取 375/375)', 'node dev/p28/check-ai-agent-crawl.js', { timeout: 120000 });
run('14b. Crawl       (爬虫健康)', 'node dev/check-crawl-health.js');

// ── 15. Browser/E2E ──
// 真实浏览器 9 步路径（首页→快速→教师→KP→7类→生成→重生成→刷新→打印）；
// 浏览器不可用 → SKIPPED（不得冒充 PASS）；发布环境（REQUIRE_BROWSER_E2E=1）强制真实执行，不可用即 FAIL。
run('15. Browser/E2E  (真实浏览器 9 步路径)', 'node dev/p28/check-browser-e2e.js', { timeout: 300000 });

// ── 16. Bundle（source==bundle，hash 一致）──
run('16. Bundle       (source==bundle，hash 一致)', 'node dev/p28/check-bundle-determinism.js --mode bundle');

// ── 17. Determinism（构建确定性）──
run('17. Determinism  (构建确定性，重跑 hash 不变)', 'node dev/p28/check-bundle-determinism.js --mode determinism');

// ── 附加门禁（Bonus）──
run('18. Coverage     (覆盖率报告)', 'node dev/p25/build-coverage-report.js --strict');
run('19. LLM          (AI 可读体检)', 'node dev/check-llm-understanding.js');
run('20. Doc          (历史数字扫描)', 'node dev/p28/check-doc-consistency.js');
run('21. Dead Code    (死代码矩阵)', 'node dev/p28/check-dead-code.js');
run('22. Legacy       (Legacy 治理矩阵)', 'node dev/p28/check-legacy-matrix.js');

// ── FINAL-91 只读门禁复核 ──
const AFTER = snapshot();
const readonlyDiffs = [];
for (const k of Object.keys(BEFORE)) {
  if (AFTER[k] !== BEFORE[k]) readonlyDiffs.push(k);
}
for (const k of Object.keys(AFTER)) {
  if (!(k in BEFORE)) readonlyDiffs.push(k + ' (新增)');
}
if (readonlyDiffs.length === 0) {
  console.log('\n✅ FINAL-91 只读门禁 PASS：关键目录前后 hash 一致，CI 未修改源码/测试/冻结文件');
} else {
  console.log('\n❌ FINAL-91 只读门禁 FAIL：发现 ' + readonlyDiffs.length + ' 处关键文件被 CI 修改：');
  readonlyDiffs.slice(0, 20).forEach(function (f) { console.log('  - ' + f); });
  totalFail++;
  results.push({ label: 'FINAL-91 只读门禁', status: 'FAIL' });
}

// ── Summary ──
console.log('\n============================================');
console.log('  全量检查结果汇总');
console.log('============================================');
for (const r of results) {
  const mark = r.status === 'PASS' ? '✓' : (r.status === 'SKIPPED' ? '⊘' : '✗');
  console.log(`  ${mark} ${r.status.padEnd(7)}  ${r.label}`);
}
console.log('--------------------------------------------');
console.log(`  合计：${totalPass} PASS / ${totalFail} FAIL / ${totalSkip} SKIP / ${results.length} 项`);
console.log('============================================');
process.exit(totalFail > 0 ? 1 : 0);
