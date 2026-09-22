#!/usr/bin/env node
/**
 * P28-03 跨层禁止调用门禁（只读）
 *
 * 基于 P28-00 依赖矩阵 docs/archive/phases/p28/P28-DEPENDENCY-MATRIX.json 检查禁止边：
 *   NEW 违规边（不在 §6 存量白名单内）→ 打印并 exit 1
 *   存量白名单边 → 提示仅警告（治理中）
 * 只读：仅读 JSON，不写任何源文件。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const MATRIX = path.join(ROOT, 'docs', 'archive', 'phases', 'p28', 'P28-DEPENDENCY-MATRIX.json');

const LAYER = (p) => {
  if (p.startsWith('kbl/')) return 'KBL';
  if (p.startsWith('shared/knowledge/')) return 'KnowledgeContext';
  if (p.startsWith('shared/orchestration/')) return 'POL';
  if (p.startsWith('shared/catalog/') && /difficulty/.test(p)) return 'Difficulty';
  if (p.startsWith('shared/strategy/')) return 'Strategy';
  if (p.startsWith('shared/generator/') || p.startsWith('shared/generation/')) return 'Generator';
  if (p.startsWith('shared/validator/')) return 'Validator';
  if (p.startsWith('shared/semantic/')) return 'SemanticQuestion';
  if (p.startsWith('shared/presentation/')) return 'Presentation';
  if (p.startsWith('shared/svg/') || p.startsWith('plugins/')) return 'SVG';
  if (p.startsWith('shared/learner/')) return 'Learner';
  if (p.startsWith('scripts/') || p.startsWith('.github/') || p.startsWith('dev/')) return 'Crawl';
  return 'other';
};

// §6 存量白名单（P28-00 实测，治理中）
const KNOWN = new Set([
  'shared/validator/kp-semantic-validator.js|shared/generator/generator-registry.js',
  'shared/validator/kp-semantic-validator.js|shared/generator/core/kp-arithmetic-semantics.js',
  'shared/validator/kp-semantic-validator.js|shared/generator/core/kp-complex-semantics.js',
  'shared/validator/kp-semantic-validator.js|shared/generator/core/type-contract.js',
  'shared/generation/api.js|shared/orchestration/practice-orchestrator.js',
]);

// §5 硬红线：callerLayer → calleeLayer 判定
const FORBIDDEN = [
  ['Generator', 'KBL'],
  ['Generator', 'POL'],
  ['Generator', 'Difficulty'],
  ['Presentation', 'Generator'],
  ['SVG', 'Generator'],
  ['Validator', 'Generator'],
];

function main() {
  if (!fs.existsSync(MATRIX)) {
    console.error('缺少依赖矩阵，请先运行：node dev/p28/build-baseline.js');
    process.exit(2);
  }
  const m = JSON.parse(fs.readFileSync(MATRIX, 'utf8'));
  const newHits = [];
  const knownHits = [];
  for (const e of m.edges) {
    const lf = LAYER(e.from);
    const lt = LAYER(e.to);
    if (FORBIDDEN.some(([a, b]) => a === lf && b === lt)) {
      const key = e.from + '|' + e.to;
      if (KNOWN.has(key)) knownHits.push({ from: e.from, to: e.to });
      else newHits.push({ from: e.from, to: e.to });
    }
  }

  console.log('P28-03 跨层禁止调用门禁');
  console.log('  数据源：' + path.relative(ROOT, MATRIX) + '（generatedAt=' + m.meta.generatedAt + '）');
  console.log('');
  console.log('  存量白名单边（治理中，仅警告）：' + knownHits.length + ' 条');
  for (const h of knownHits) console.log('    [KNOWN] ' + h.from + ' -> ' + h.to);
  console.log('  新增违规边：' + newHits.length + ' 条');
  for (const h of newHits) console.log('    [NEW-VIOLATION] ' + h.from + ' -> ' + h.to);
  console.log('');

  if (newHits.length > 0) {
    console.error('✗ FAIL：存在新增跨层禁止调用，回退并走 P28-01 流水线（docs/01-ARCHITECTURE.md §7）。');
    process.exit(1);
  }
  console.log('✓ PASS：无新增跨层禁止调用。');
}

main();