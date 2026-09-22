#!/usr/bin/env node
/**
 * dev/p28/check-kbl-ai-boundary.js — P28-33 KBL→页面→AI 数据边界门禁（只读，不修改任何文件）
 *
 * 契约（docs/archive/phases/p28/P28-33-KBL-AI-BOUNDARY.md，FROZEN）：
 *   公开知识内容单向：KBL → Static Page（knowledge/*.html + knowledge-index.* + sitemap.xml）。
 *   禁止 SEO / AI / Crawler / LLM 反向修改 KBL——KBL 唯一可写方是「离线派生工具链」（人工驱动），
 *   公开面产出脚本只能只读消费 KBL。
 *
 * 检查项：
 *   A) 回写白名单——扫描 dev/ scripts/ tools/ .github/ 所有 JS/SH：
 *       写入目标落在 kbl/ 的调用，其宿主脚本必须 ∈ KBL_WRITER_WHITELIST（离线派生/收口工具）。
 *       公开面产出脚本（robots/sitemap/llms/静态页/爬行体检/LLM 理解体检）一律不得写 kbl/。
 *   B) 页面漂移——运行 node dev/build-knowledge-pages.js --check：
 *       静态页/索引必须与当前 KBL 投影一致（0 漂移）。漂移=页面偏离 KBL，禁止反向修改 KBL，
 *       必须 npm run build:knowledge 由 KBL 单向重建后重新提交页面。
 *   C) 公开面驻留——robots.txt / sitemap.xml / llms.txt 为只读静态公开物，任何脚本不得改写 kbl/。
 *
 * 运行： node dev/p28/check-kbl-ai-boundary.js
 * 退出码：0 = 边界完好；1 = 越界（输出违规清单）。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const KBL_DIR_NAME = 'kbl';

// 允许写 kbl/ 的脚本：全部为离线派生/收口工具（人工驱动）。公开面/运行时一律禁止。
const KBL_WRITER_WHITELIST = [
  'tools/kbl/extract-source.js',
  'tools/kbl/derive-kbl.js',
  'tools/kbl/emit-canonical.js',
  'tools/kbl/build.js',
  'tools/kbl/publish.js',
  'dev/p25/build-baseline.js',            // 基线建档（kp-matrix/generation-matrix 派生）
  'dev/p25/derive-qt-intent.js',          // 人工评审升级确认后写 kbl/teaching/qt-intent.json
  'dev/p25/derive-evidence-candidates.js', // 候选草稿（TEACHING_DIR）
  'dev/p25/apply-evidence-candidates.js',  // 审后合并 kbl/teaching/evidence-rules.json
  'dev/p25/build-golden-dataset.js',       // 金题集（kbl/teaching/golden-questions.json）
  'dev/p25/derive-semantic-families.js',   // 语义族映射（kbl/teaching/semantic-families.json）
  'dev/p25/draft-semantic-matrix.js',      // 评审草稿（kbl/teaching/semantic-review.json，回灌走 KBL）
  'dev/p25/import-qt-intent-review.js',    // 人工评审抄账（kbl/teaching/qt-intent-review.json）
  'dev/p27/derive-variation-profiles.js',   // 变式剖面（kbl/teaching/variation-profiles.json）
  'dev/p27/derive-misconceptions.js'        // 迷思剖面（kbl/teaching/misconception-profiles.json）
];

// ============ A) 回写白名单 ============

const WRITE_API = /(writeFile|appendFile|createWriteStream|outputFile|mkdtemp|copyFile|rename|unlink|rm|truncate)(Sync)?\s*\(/;

function scanDir(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!/^(node_modules|\.git|reports)$/.test(e.name)) scanDir(p, out);
    } else if (/\.(js|mjs|cjs|sh)$/.test(e.name)) {
      out.push(p);
    }
  });
}

// 提取文件内「seed 自 kbl 的目录常量」：const/let/var X = path.join(...'kbl'...)
function kblSeededVars(src) {
  const vars = new Set();
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const init = m[2];
    if (/['"`][^'"`]*kbl['"`]/.test(init)) vars.add(m[1]);
  }
  return vars;
}

// 取参数：若为 path.join(...) 则整段 join 调用；否则取首参表达式（到顶层逗号/右括号）
function argExpr(src, fromOpenParen) {
  const j = src.indexOf('path.join(', fromOpenParen);
  if (j !== -1 && j < fromOpenParen + 12) return balancedText(src, fromOpenParen);
  let i = fromOpenParen, depth = 0;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { if (depth === 0) break; depth--; }
    else if (c === ',') { if (depth === 1) i--; break; }
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    }
  }
  return src.slice(fromOpenParen, Math.min(i + 1, src.length));
}

// 截取从开括号到括号配平的一段文本（跳过注释与字符串）
function balancedText(src, fromOpenParen) {
  let depth = 0, i = fromOpenParen;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) break; }
    else if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; }
    else if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
    }
  }
  return src.slice(fromOpenParen, i + 1);
}

function findKblWrites(file) {
  const src = fs.readFileSync(file, 'utf8');
  const seeded = kblSeededVars(src);
  const hits = [];
  const apiRe = new RegExp(WRITE_API.source, 'g');
  let m;
  while ((m = apiRe.exec(src)) !== null) {
    const openIdx = m.index + m[0].length - 1; // 正则以 '(' 结尾（含前导空白）
    if (openIdx === -1) continue;
    const arg = argExpr(src, openIdx);
    if (!arg) continue;
    // 仅评估「路径参数」：字面量含 kbl 或引用 kbl 种子常量 → 写入目标落在 kbl/
    const touchesKbl = /['"`][^'"`]*kbl['"`]/.test(arg) || kblRefsConst(arg, seeded);
    if (touchesKbl) hits.push({ line: lineOf(src, m.index), text: arg.split('\n')[0].trim().replace(/\\n/g, '').slice(0, 80) });
  }
  return hits;
}

function kblRefsConst(text, seeded) {
  if (!seeded.size) return false;
  const idRe = /\b([A-Za-z_$][\w$]*)\b/g;
  let m;
  while ((m = idRe.exec(text)) !== null) {
    if (seeded.has(m[1])) return true;
  }
  return false;
}

function lineOf(src, index) {
  return src.slice(0, index).split('\n').length;
}

// ============ 主流程 ============

function main() {
  const violations = [];
  const scanned = [];
  ['dev', 'scripts', 'tools', '.github'].forEach((d) => {
    if (fs.existsSync(path.join(ROOT, d))) scanDir(path.join(ROOT, d), scanned);
  });

  scanned.sort().forEach((file) => {
    const rel = path.relative(ROOT, file);
    const hits = findKblWrites(file);
    if (!hits.length) return;
    hits.forEach((h) => {
      if (!KBL_WRITER_WHITELIST.includes(rel)) {
        violations.push(`✗ 越界回写：${rel}:${h.line} 写目标落在 kbl/，但不在离线派生白名单（${h.text}）。` +
          `\n    KBL 只许由白名单离线派生工具链写；SEO/AI/Crawler/LLM/静态页产出脚本一律只读。`);
      }
    });
  });

  // B) 页面漂移（--check：页面哈希 vs 当前 KBL 投影；不写盘）
  let pageOk = true;
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'dev', 'build-knowledge-pages.js'), '--check'], {
      cwd: ROOT, stdio: ['ignore', 'inherit', 'inherit']
    });
  } catch (e) {
    pageOk = false;
  }
  if (!pageOk) {
    violations.push('✗ 静态页面漂移：knowledge/*.html 与当前 KBL 投影不一致——页面已偏离 KBL。' +
      '\n    禁止反向修改 KBL；请 npm run build:knowledge 由 KBL 单向重建静态页并重新提交。');
  }

  // 公开物存在性（只读公开面）
  ['robots.txt', 'sitemap.xml', 'llms.txt'].forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) violations.push(`✗ 公开面缺失：${f}（公开只读物须随静态页驻留）`);
  });

  if (violations.length) {
    console.error('❌ P28-33 KBL→页面→AI 数据边界破损（' + violations.length + ' 项）：');
    violations.forEach((v) => console.error('  ' + v));
    process.exit(1);
  }
  console.log('✅ P28-33 KBL→页面→AI 数据边界完好：kbl/ 回写仅限离线派生白名单；静态页与 KBL 投影零漂移；robots/sitemap/llms 只读驻留。');
}

main();