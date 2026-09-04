#!/usr/bin/env node
/**
 * dev/check-knowledge-dir.js
 *
 * R3 守卫：knowledge/ 目录的「纯粹存放」校验。
 *
 * 依据 docs/AI_REFACTOR_PLAN.html 阶段 R3：
 *   knowledge/ 只允许 .html 且必须由生成脚本产出（hash 对照）；
 *   禁止混入非 html / 手工散落文件。
 *
 * 检查项：
 *   1. knowledge/ 下不得存在任何非 .html 文件（禁止混入）。
 *   2. 每个 .html 必须携带生成器权威标记 `<!-- kbgen:hash=<sha256> -->`
 *      （scripts/generate-knowledge-pages.js 写入），否则视为手工散落文件。
 *
 * 运行：
 *   node dev/check-knowledge-dir.js
 *
 * 退出码：0 = 通过；1 = 校验失败（输出违规清单）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KB_DIR = path.join(ROOT, 'knowledge');

// 与 scripts/generate-knowledge-pages.js 保持一致：
// 生成器在页面尾部写入的权威哈希标记。
const HASH_RE = /<!--\s*kbgen:hash=([0-9a-f]{64})\s*-->/;

function main() {
  if (!fs.existsSync(KB_DIR)) {
    console.error('❌ knowledge/ 目录不存在');
    process.exit(1);
  }

  const entries = fs.readdirSync(KB_DIR).sort();
  const violations = [];

  entries.forEach((name) => {
    const fp = path.join(KB_DIR, name);
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      violations.push(`目录混入：${name}/（knowledge/ 不允许子目录）`);
      return;
    }
    if (!name.endsWith('.html')) {
      violations.push(`非 html 混入：${name}`);
      return;
    }
    // .html：必须是生成脚本权威产出（带 kbgen:hash 标记）
    const txt = fs.readFileSync(fp, 'utf8');
    if (!HASH_RE.test(txt)) {
      violations.push(`手工散落 html（无 kbgen:hash 标记）：${name}`);
    }
  });

  if (violations.length) {
    console.error(`❌ knowledge/ 纯粹存放校验失败（${violations.length} 处违规）：`);
    violations.forEach((v) => console.error('   - ' + v));
    process.exit(1);
  }

  console.log(`✅ knowledge/ 纯粹存放校验通过：${entries.length} 个文件，全部为生成脚本权威产出的 .html`);
}

main();
