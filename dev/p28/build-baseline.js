#!/usr/bin/env node
/**
 * P28-00 建立最终治理基线 — 只读扫描器
 *
 * 只读行为声明：
 *  - 仅遍历/读取文件内容，不写任何源文件、不删任何文件、不改任何测试。
 *  - 仅输出 docs/archive/phases/p28/ 5 件产物（4 矩阵 JSON + BASELINE.md）+ dev/p28/reports/ 报告副本。
 *  - 可重复运行，结果只随数据源变化。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'docs', 'archive', 'phases', 'p28');
const REPORT_DIR = path.join(ROOT, 'dev', 'p28', 'reports');

const TARGET_DIRS = [
  'src',
  'shared',
  'scripts',
  'tools',
  'tests',
  'docs',
  'kbl',
  'knowledge',
  'plugins',
  'archive',
  'migration',
  '.github',
];

const SKIP_DIRS = new Set(['.git', 'node_modules', '.DS_Store', 'docs/archive/phases/p28', 'dev/p28']);
const SKIP_FILES = new Set(['.DS_Store']);

const EXT_ORDER = ['js', 'html', 'css', 'json', 'md', 'svg', 'mjs', 'cjs', 'yml', 'yaml', 'txt', 'xml', 'jsonld', 'other'];

const LEGACY_TOKENS = ['TODO', 'FIXME', 'HACK', 'LEGACY', 'DEPRECATED', 'COMPAT', 'BRIDGE', 'TEMP', 'DEBUG'];

const RISK_PATTERNS = [
  { token: 'eval', risk: 'high', regex: /\beval\s*\(/g },
  { token: 'new Function', risk: 'high', regex: /new\s+Function\s*\(/g },
  { token: 'document.write', risk: 'high', regex: /document\.write\s*\(/g },
  { token: 'innerHTML', risk: 'high', regex: /\binnerHTML\b/g },
  { token: 'outerHTML', risk: 'high', regex: /\bouterHTML\b/g },
  { token: 'rawHtml', risk: 'medium', regex: /\brawHtml\b/g },
  { token: 'rawSvg', risk: 'medium', regex: /\brawSvg\b/g },
  { token: 'Math.random', risk: 'medium', regex: /\bMath\.random\s*\(/g },
  { token: 'require', risk: 'info', regex: /\brequire\s*\(/g },
  { token: 'import', risk: 'info', regex: /\bimport\s/g },
];

const CODE_EXTS = new Set(['js', 'mjs', 'cjs']);

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const relDir = rel(full);
      if (SKIP_DIRS.has(e.name) || [...SKIP_DIRS].some((s) => s.includes('/') && relDir.startsWith(s)) || SKIP_FILES.has(e.name)) continue;
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile()) {
        files.push(full);
      }
    }
  }
  return files;
}

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function extOf(file) {
  const base = path.basename(file);
  const i = base.lastIndexOf('.');
  if (i <= 0) return 'other';
  const e = base.slice(i + 1).toLowerCase();
  return EXT_ORDER.includes(e) ? e : 'other';
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function countMatches(text, re) {
  if (!text) return 0;
  let n = 0;
  const rx = new RegExp(re.source, 'g');
  let m;
  while ((m = rx.exec(text)) !== null) n++;
  return n;
}

function categoryOf(relPath) {
  const lower = relPath.toLowerCase();
  const cats = [];
  if (/generator|generation|generate/.test(lower)) cats.push('Generator');
  if (/validator|validation|quality-scorer/.test(lower)) cats.push('Validator');
  if (/renderer|render-|presentation|svg-registry|print/.test(lower)) cats.push('Renderer');
  if (/plugin/.test(lower)) cats.push('Plugin');
  if (lower.startsWith('kbl/')) cats.push('KBL');
  if (lower.startsWith('tests/') || /\.test\./.test(lower) || /test-/.test(lower)) cats.push('Tests');
  if (/bundle/.test(lower)) cats.push('Bundles');
  return cats;
}

function resolveImport(fromFile, spec, text) {
  if (typeof spec !== 'string') return null;
  let target = null;
  if (spec.startsWith('.')) {
    target = path.resolve(path.dirname(fromFile), spec);
  } else {
    // 尝试解析本地模块（无 node_modules 场景：shared/scripts/dev/tools/plugins/kbl/tests 顶层裸导入）
    for (const base of ['shared', 'scripts', 'dev', 'tools', 'plugins', 'kbl', 'tests', 'migration', 'archive']) {
      const cand = path.join(ROOT, base, ...spec.split('/'));
      if (fs.existsSync(cand)) {
        target = cand;
        break;
      }
    }
  }
  if (!target) return null;

  const candidates = [
    target,
    target + '.js',
    target + '.mjs',
    target + '.cjs',
    target + '.json',
    path.join(target, 'index.js'),
    path.join(target, 'index.mjs'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

function extractImports(file, text) {
  const out = [];
  // require('x')
  let re = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  // import x from 'y'
  re = /import\s+(?:[^'"]*\s+from\s+)?['"]([^'"]+)['"]/g;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  // dynamic import('y')
  re = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = re.exec(text)) !== null) out.push(m[1]);
  return out;
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const generatedAt = new Date().toISOString();
  let commit = null;
  let branch = null;
  try {
    commit = require('child_process')
      .execSync('git -C "' + ROOT + '" rev-parse --short HEAD', { encoding: 'utf8' })
      .trim();
    branch = require('child_process')
      .execSync('git -C "' + ROOT + '" rev-parse --abbrev-ref HEAD', { encoding: 'utf8' })
      .trim();
  } catch {}
  const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf8').trim();

  // ---------- 1. 收集文件 ----------
  const fileRows = [];
  for (const dir of TARGET_DIRS) {
    const abs = path.join(ROOT, dir);
    const exists = fs.existsSync(abs);
    if (!exists) continue;
    for (const f of walk(abs)) {
      const r = rel(f);
      const st = fs.statSync(f);
      fileRows.push({ path: r, dir, ext: extOf(f), bytes: st.size, lines: 0, categories: categoryOf(r) });
    }
  }
  // 为防止 'other' 把 config 类文件吞掉，逐行数仅对文本类统计
  const TEXT_EXTS = new Set(['js', 'mjs', 'cjs', 'html', 'css', 'json', 'md', 'svg', 'yml', 'yaml', 'txt', 'xml']);
  for (const row of fileRows) {
    if (!TEXT_EXTS.has(row.ext)) continue;
    const t = readText(path.join(ROOT, row.path));
    row.lines = t ? t.split(/\r?\n/).length : 0;
  }

  // ---------- 2. 文件类型矩阵（dir × ext） ----------
  const dirExtCount = {};
  for (const row of fileRows) {
    dirExtCount[row.dir] = dirExtCount[row.dir] || {};
    dirExtCount[row.dir][row.ext] = (dirExtCount[row.dir][row.ext] || 0) + 1;
  }
  const extTotal = {};
  const dirTotal = {};
  for (const row of fileRows) {
    extTotal[row.ext] = (extTotal[row.ext] || 0) + 1;
    dirTotal[row.dir] = (dirTotal[row.dir] || 0) + 1;
  }

  // ---------- 3. 行为类别矩阵 ----------
  const catCount = {};
  const catFiles = {};
  for (const row of fileRows) {
    for (const c of row.categories) {
      catCount[c] = (catCount[c] || 0) + 1;
      catFiles[c] = catFiles[c] || [];
      catFiles[c].push(row.path);
    }
  }

  // ---------- 4. LEGACY 标记扫描 ----------
  const legacy = {};
  const legacyByToken = {};
  const legacyFilesByToken = {};
  for (const row of fileRows) {
    const text = TEXT_EXTS.has(row.ext) ? readText(path.join(ROOT, row.path)) : null;
    if (!text) continue;
    const matched = [];
    for (const tok of LEGACY_TOKENS) {
      const re = new RegExp('\\b' + tok + '\\b', 'gi');
      const n = countMatches(text, re);
      if (n > 0) {
        legacyByToken[tok] = (legacyByToken[tok] || 0) + n;
        legacyFilesByToken[tok] = legacyFilesByToken[tok] || [];
        legacyFilesByToken[tok].push(row.path);
        matched.push({ token: tok, count: n });
      }
    }
    if (matched.length) {
      legacy[row.path] = { tokens: matched, total: matched.reduce((a, b) => a + b.count, 0), ext: row.ext };
    }
  }

  // ---------- 5. 风险调用扫描 ----------
  const risk = {};
  const riskByToken = {};
  const riskFilesByToken = {};
  for (const row of fileRows) {
    const text = TEXT_EXTS.has(row.ext) ? readText(path.join(ROOT, row.path)) : null;
    if (!text) continue;
    const hits = [];
    for (const p of RISK_PATTERNS) {
      const n = countMatches(text, p.regex);
      if (n > 0) {
        riskByToken[p.token] = riskByToken[p.token] || [];
        riskByToken[p.token].push({ file: row.path, count: n });
        hits.push({ token: p.token, risk: p.risk, count: n });
      }
    }
    if (hits.length) {
      const high = hits.filter((h) => h.risk === 'high').reduce((a, b) => a + b.count, 0);
      const med = hits.filter((h) => h.risk === 'medium').reduce((a, b) => a + b.count, 0);
      risk[row.path] = {
        hits,
        total: hits.reduce((a, b) => a + b.count, 0),
        high,
        med,
        maxRisk: high > 0 ? 'high' : med > 0 ? 'medium' : 'info',
        ext: row.ext,
      };
    }
  }

  // ---------- 6. 依赖矩阵 ----------
  const moduleFiles = fileRows.filter((r) => CODE_EXTS.has(r.ext));
  const depEdges = [];
  const depByFile = {};
  for (const row of moduleFiles) {
    const abs = path.join(ROOT, row.path);
    const text = readText(abs);
    if (!text) continue;
    const specs = extractImports(abs, text);
    const touched = new Set();
    for (const spec of specs) {
      const resolved = resolveImport(abs, spec, text);
      if (resolved && resolved !== abs && fs.existsSync(resolved)) {
        const to = rel(resolved);
        if (!touched.has(to)) {
          touched.add(to);
          depEdges.push({ from: row.path, to });
        }
      }
    }
    depByFile[row.path] = { imports: Array.from(touched).length };
  }
  const fanIn = {};
  for (const e of depEdges) fanIn[e.to] = (fanIn[e.to] || 0) + 1;
  const topFanIn = Object.entries(fanIn)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30);
  const depNodes = moduleFiles.map((r) => r.path);

  // ---------- 7. 聚合 ----------
  const totalFiles = fileRows.length;
  const totalLines = fileRows.reduce((a, r) => a + r.lines, 0);
  const totalBytes = fileRows.reduce((a, r) => a + r.bytes, 0);

  const summary = {
    generatedAt,
    version,
    git: { commit, branch, worktreeDirty: null },
    totalFiles,
    totalLines,
    totalBytes,
    dirs: TARGET_DIRS.map((d) => ({ dir: d, exists: fs.existsSync(path.join(ROOT, d)), files: dirTotal[d] || 0 })),
    extTotal,
    dirExtCount,
    categories: catCount,
    legacyTokens: legacyByToken,
    legacyTokenFiles: Object.fromEntries(LEGACY_TOKENS.map((t) => [t, (legacyFilesByToken[t] || []).length])),
    legacyFiles: Object.keys(legacy).length,
    riskHighFiles: Object.values(risk).filter((r) => r.high > 0).length,
    riskMedFiles: Object.values(risk).filter((r) => r.med > 0).length,
    riskInfoFiles: Object.values(risk).filter((r) => r.maxRisk === 'info').length,
    depEdges: depEdges.length,
    depModules: depNodes.length,
  };

  // 严格只读：禁止任何业务/测试文件被修改
  // （本脚本只写 OUT_DIR 与 REPORT_DIR）

  // ---------- 8. 写产物 ----------
  const fileMatrix = {
    meta: {
      task: 'P28-00',
      tool: 'dev/p28/build-baseline.js',
      generatedAt,
      version,
      git: { commit, branch },
      scope: TARGET_DIRS,
      readOnly: true,
      totalFiles,
      totalLines,
      totalBytes,
    },
    extTotal,
    dirExtCount,
    dirTotal,
    categories: { count: catCount, files: catFiles },
    files: fileRows,
  };

  const depMatrix = {
    meta: {
      task: 'P28-00',
      tool: 'dev/p28/build-baseline.js',
      generatedAt,
      version,
      git: { commit, branch },
      readOnly: true,
      totalModules: depNodes.length,
      totalEdges: depEdges.length,
    },
    nodes: depNodes,
    edges: depEdges,
    fanIn,
    topFanIn,
  };

  const legacyMatrix = {
    meta: {
      task: 'P28-00',
      tool: 'dev/p28/build-baseline.js',
      generatedAt,
      version,
      git: { commit, branch },
      readOnly: true,
      tokensScanned: LEGACY_TOKENS,
      matches: legacyByToken,
      filesAffected: Object.keys(legacy).length,
    },
    files: legacy,
  };

  const riskMatrix = {
    meta: {
      task: 'P28-00',
      tool: 'dev/p28/build-baseline.js',
      generatedAt,
      version,
      git: { commit, branch },
      readOnly: true,
      patternsScanned: RISK_PATTERNS.map((p) => ({ token: p.token, risk: p.risk })),
      highRiskFiles: summary.riskHighFiles,
      mediumRiskFiles: summary.riskMedFiles,
      infoRiskFiles: summary.riskInfoFiles,
    },
    byToken: riskByToken,
    files: risk,
  };

  writeJson(path.join(OUT_DIR, 'P28-FILE-MATRIX.json'), fileMatrix);
  writeJson(path.join(OUT_DIR, 'P28-DEPENDENCY-MATRIX.json'), depMatrix);
  writeJson(path.join(OUT_DIR, 'P28-LEGACY-MATRIX.json'), legacyMatrix);
  writeJson(path.join(OUT_DIR, 'P28-RISK-MATRIX.json'), riskMatrix);

  writeJson(path.join(REPORT_DIR, 'file-matrix.json'), fileMatrix);
  writeJson(path.join(REPORT_DIR, 'dependency-matrix.json'), depMatrix);
  writeJson(path.join(REPORT_DIR, 'legacy-matrix.json'), legacyMatrix);
  writeJson(path.join(REPORT_DIR, 'risk-matrix.json'), riskMatrix);

  const baseline = renderBaseline(summary, topFanIn);
  fs.writeFileSync(path.join(OUT_DIR, 'P28-BASELINE.md'), baseline, 'utf8');

  console.log('P28-00 基线生成完毕');
  console.log('  files=' + totalFiles + ' lines=' + totalLines + ' bytes=' + totalBytes);
  console.log('  categories=' + JSON.stringify(catCount));
  console.log('  legacy files=' + Object.keys(legacy).length + ' deps edges=' + depEdges.length);
  console.log('  out=' + OUT_DIR);
}

function writeJson(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), 'utf8');
}

function renderBaseline(summary, topFanIn) {
  const lines = [];
  const fmt = (n) => n.toLocaleString('en-US');
  lines.push('# P28-BASELINE — 最终治理基线（P28-00）');
  lines.push('');
  lines.push('> 由 `dev/p28/build-baseline.js` **只读**生成；可重复运行，结果仅随数据源变化。');
  lines.push('> 本阶段（P28-00）红线：不修改业务代码、不删除文件、不修改测试；本脚本仅产出 `docs/archive/phases/p28/` 与 `dev/p28/reports/`。');
  lines.push('');
  lines.push('## 0. 基线快照');
  lines.push('');
  lines.push('| 项 | 值 |');
  lines.push('| --- | --- |');
  lines.push('| 生成时间 | ' + summary.generatedAt + ' |');
  lines.push('| 版本 | ' + summary.version + ' |');
  lines.push('| Git commit | ' + (summary.git.commit || '(n/a)') + ' (' + (summary.git.branch || 'n/a') + ') |');
  lines.push('| 扫描目录 | ' + summary.dirs.filter((d) => d.exists).map((d) => '`' + d.dir + '`').join(' ') + ' |');
  lines.push('| 文件总数 | **' + fmt(summary.totalFiles) + '** |');
  lines.push('| 代码行总数（文本类） | **' + fmt(summary.totalLines) + '** |');
  lines.push('| 字节数 | ' + fmt(summary.totalBytes) + ' |');
  lines.push('| 依赖边数（repo 内 JS 模块间） | ' + summary.depEdges + ' / 模块数 ' + summary.depModules + ' |');
  lines.push('');
  lines.push('### 目录存在性');
  lines.push('');
  lines.push('| 目录 | 存在 | 文件数 |');
  lines.push('| --- | --- | --- |');
  for (const d of summary.dirs) {
    lines.push('| `' + d.dir + '` | ' + (d.exists ? '✅' : '❌ **缺失**') + ' | ' + d.files + ' |');
  }
  lines.push('');
  lines.push('> ⚠️ 任务书目标目录 `src/` **不存在**：本仓库业务源码承载于 `shared/`（319 目录为铺设基准），扫描按实际目录归集。');
  lines.push('');
  lines.push('## 1. 文件类型统计');
  lines.push('');
  lines.push('| 扩展名 | 文件数 | 占比 |');
  lines.push('| --- | --- | --- |');
  const extT = Object.entries(summary.extTotal).sort((a, b) => b[1] - a[1]);
  for (const [ext, n] of extT) {
    lines.push('| `.' + ext + '` | ' + n + ' | ' + (n / summary.totalFiles * 100).toFixed(1) + '% |');
  }
  if (!summary.extTotal.svg) {
    lines.push('| `.svg` | 0 | 0.0%（SVG 由 JS 生成器/插件动态产出，无静态 SVG 文件） |');
  }
  lines.push('');
  lines.push('## 2. 行为类别统计');
  lines.push('');
  lines.push('| 类别 | 文件数 |');
  lines.push('| --- | --- |');
  const catT = Object.entries(summary.categories).sort((a, b) => b[1] - a[1]);
  for (const [c, n] of catT) lines.push('| ' + c + ' | ' + n + ' |');
  lines.push('');
  lines.push('> 口径：按路径关键字归类（Generator=generator/generation、Validator=validator、Renderer=presentation/render、Plugin=plugin、KBL=kbl/、Tests=tests/、Bundles=bundle）。一个文件可属多类。');
  lines.push('');
  lines.push('## 3. LEGACY 标记扫描');
  lines.push('');
  lines.push('| 标记 | 命中次数 | 命中文件数 |');
  lines.push('| --- | --- | --- |');
  for (const tok of ['TODO', 'FIXME', 'HACK', 'LEGACY', 'DEPRECATED', 'COMPAT', 'BRIDGE', 'TEMP', 'DEBUG']) {
    const n = summary.legacyTokens[tok] || 0;
    const f = summary.legacyTokenFiles[tok] || 0;
    lines.push('| ' + tok + ' | ' + n + ' | ' + f + ' |');
  }
  lines.push('');
  lines.push('影响文件数：**' + summary.legacyFiles + '**（全量逐文件见 `P28-LEGACY-MATRIX.json`）。');
  lines.push('');
  lines.push('> 提示：`BRIDGE/DEBUG/TEMP` 在本仓库存在架构性/日志性正当用途（如 `shared/bridge`、`console.debug`），命中数不代表缺陷，仅作治理扫描基线；后续 P28.02 由人工判定。');
  lines.push('');
  lines.push('## 4. 风险调用扫描');
  lines.push('');
  lines.push('| 级别 | 文件数 |');
  lines.push('| --- | --- |');
  lines.push('| HIGH（eval/new Function/write/innerHTML/outerHTML/rawHtml/rawSvg） | ' + summary.riskHighFiles + ' |');
  lines.push('| MEDIUM（Math.random） | ' + summary.riskMedFiles + ' |');
  lines.push('| INFO（require/import 常规模块使用） | ' + summary.riskInfoFiles + ' |');
  lines.push('');
  lines.push('> 提示：本项目数学 RNG 约束**禁止用 Math.random**（`shared/generator/core/rng.js`），命中文件为后续专项审查对象；require/import 仅作依赖统计、不算风险。全量见 `P28-RISK-MATRIX.json`。');
  lines.push('');
  lines.push('## 5. 依赖矩阵摘要');
  lines.push('');
  lines.push('- Repo 内可解析 JS 模块：' + summary.depModules);
  lines.push('- 解析到的同仓依赖边：' + summary.depEdges);
  lines.push('- Fan-in Top 10：');
  lines.push('');
  for (const [i, [p, n]] of topFanIn.slice(0, 10).entries()) {
    lines.push((i + 1) + '. `' + p + '` × ' + n);
  }
  lines.push('');
  lines.push('全量节点与边见 `P28-DEPENDENCY-MATRIX.json`。');
  lines.push('');
  lines.push('## 6. 产物清单');
  lines.push('');
  lines.push('| 文件 | 说明 |');
  lines.push('| --- | --- |');
  lines.push('| `docs/archive/phases/p28/P28-BASELINE.md` | 本文档（聚合基线） |');
  lines.push('| `docs/archive/phases/p28/P28-FILE-MATRIX.json` | 文件清单 + 类型/类别矩阵 |');
  lines.push('| `docs/archive/phases/p28/P28-DEPENDENCY-MATRIX.json` | 同仓依赖边矩阵（含 fan-in） |');
  lines.push('| `docs/archive/phases/p28/P28-LEGACY-MATRIX.json` | LEGACY 标记命中矩阵 |');
  lines.push('| `docs/archive/phases/p28/P28-RISK-MATRIX.json` | 风险调用命中矩阵 |');
  lines.push('| `dev/p28/reports/*.json` | 相同内容副本（CI 消费） |');
  lines.push('');
  lines.push('## 7. 复现');
  lines.push('');
  lines.push('```bash');
  lines.push('node dev/p28/build-baseline.js   # 只读；产出 docs/archive/phases/p28/ 五件套');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

main();