#!/usr/bin/env node
'use strict';

// dev/check-all.js
// P28-40 · 唯一全量检查入口
// npm run check-all
//
// 执行全部 17 个检查域：
// version / KBL / lint / syntax / unit / generation / education / coverage /
// golden / difficulty / presentation / SVG / security / sitemap / crawl / LLM / browser-e2e

const { execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const results = [];
let totalPass = 0, totalFail = 0;

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
run('5.  Unit         (全链测试 534)', 'node --test "tests/**/*.test.js"');

// ── 6. Generation ──
run('6a. Generation   (1570 ALLOW 真实生成)', 'node dev/check-allow-generation.js', { timeout: 600000 });
run('6b. Generation   (矩阵冻结)', 'node dev/p28/check-generation-matrix-freeze.js');
run('6c. Generation   (Generator Registry)', 'node dev/p28/check-generator-matrix.js');
run('6d. Generation   (四轴不夺权)', 'node dev/p28/check-generator-noninterference.js');

// ── 7. Education ──
run('7.  Education    (教育语义生成)', 'node dev/check-educational-generation.js');

// ── 8. Coverage ──
run('8.  Coverage     (覆盖率报告)', 'node dev/p25/build-coverage-report.js --strict');

// ── 9. Golden ──
run('9.  Golden       (金题集校验)', 'node dev/p25/validate-golden-dataset.js');

// ── 10. Difficulty ──
run('10a. Difficulty   (权威链唯一)', 'node dev/p28/check-difficulty-authority-gate.js');
run('10b. Difficulty   (溯源)', 'node dev/p28/check-difficulty-provenance-gate.js');

// ── 11. Presentation ──
run('11. Presentation (渲染 + Legacy 隔离)', 'node --test tests/presentation/renderer.test.js');

// ── 12. SVG ──
run('12. SVG          (契约 + Sanitizer)', 'node --test tests/presentation/svg-contract.test.js tests/presentation/svg-contract-full.test.js tests/presentation/svg-sanitizer.test.js');

// ── 13. Security ──
run('13. Security     (eval/Function + AnswerValidator + HTML + KBL写保护)', 'node dev/p28/check-security.js');

// ── 14. Sitemap ──
run('14. Sitemap      (381 URL 冻结)', 'node dev/p28/check-sitemap-freeze.js', { timeout: 120000 });

// ── 15. Crawl ──
run('15a. Crawl       (AI Agent 抓取 375/375)', 'node dev/p28/check-ai-agent-crawl.js', { timeout: 120000 });
run('15b. Crawl       (爬虫健康)', 'node dev/check-crawl-health.js');

// ── 16. LLM ──
run('16. LLM          (AI 可读体检)', 'node dev/check-llm-understanding.js');

// ── 17. Browser/E2E ──
// 归档的 p005-e2e.js 为冻结 E2E 资产；当前全链 E2E 由 unit tests (tests/bridge/generation-concurrency.test.js) 覆盖
run('17. Browser/E2E  (并发契约 + 生成链)', 'node --test tests/bridge/generation-concurrency.test.js');

// ── Bonus: Doc Consistency ──
run('18. Doc          (历史数字扫描)', 'node dev/p28/check-doc-consistency.js');

// ── Bonus: Dead Code Matrix ──
run('19. Dead Code    (死代码矩阵)', 'node dev/p28/check-dead-code.js');

// ── Bonus: Legacy Matrix ──
run('20. Legacy       (Legacy 治理矩阵)', 'node dev/p28/check-legacy-matrix.js');

// ── Summary ──
console.log('\n============================================');
console.log('  全量检查结果汇总');
console.log('============================================');
for (const r of results) {
  const mark = r.status === 'PASS' ? '✓' : '✗';
  console.log(`  ${mark} ${r.status.padEnd(4)}  ${r.label}`);
}
console.log('--------------------------------------------');
console.log(`  合计：${totalPass} PASS / ${totalFail} FAIL / ${results.length} 项`);
console.log('============================================');
process.exit(totalFail > 0 ? 1 : 0);
