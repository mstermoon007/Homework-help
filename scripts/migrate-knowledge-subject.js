#!/usr/bin/env node
/**
 * scripts/migrate-knowledge-subject.js — 知识点 ID 科目化一次性迁移（任务2）
 *
 * 变更内容：
 *   1. 数学知识点 ID 加科目前缀：g{grade}-{module}-{slug} → math-g{grade}-{module}-{slug}
 *      （knowledge-bank.js、plugins 声明与标注、dev 测试硬编码、根页面链接、sitemap.xml）
 *   2. knowledge/ 详情页文件同步重命名：{oldId}.html → math-{oldId}.html
 *   3. 归档快照 archive/dead-code-20260823/knowledge-slug-map.js 的键加前缀：
 *      '{grade}-{slug}' → 'math-{grade}-{slug}'（值保持旧 slug 作历史对照；
 *      注意：shared/knowledge-slug-map.js 已于 dead-code 清理时移除，运行时零引用）
 *   4. 迁移前备份至 archive/knowledge-subject-migration/
 *
 * 幂等性：若知识库已无未加前缀的数学 ID，脚本直接退出（可安全重复执行）。
 *
 * 用法：
 *   node scripts/migrate-knowledge-subject.js [--dry]   # --dry 仅预演不落盘
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const dry = process.argv.includes('--dry');
const PREFIX = 'math-';
const BACKUP_DIR = path.join(ROOT, 'archive', 'knowledge-subject-migration');

// ---- 目标文件集合 ----
function listDir(dir, ext) {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => f.endsWith(ext)).map(f => path.join(p, f));
}
const textTargets = []
  .concat(listDir('shared', '.js'))
  .concat(listDir('plugins', '.js'))
  .concat(listDir('dev', '.js'))
  .concat(listDir('scripts', '.js').filter(f => !f.endsWith('migrate-knowledge-subject.js')))
  .concat([path.join(ROOT, 'sitemap.xml')])
  .concat(listDir('.', '.html'));
// 链接形态（oldId.html）仅作用于站点可见文件；引号形态（'oldId'/"oldId"）作用于全部 JS

const SLUG_MAP_FILE = path.join(ROOT, 'archive', 'dead-code-20260823', 'knowledge-slug-map.js');

// ---- 读取旧 ID 清单 ----
delete require.cache[require.resolve(path.join(ROOT, 'shared', 'knowledge-bank.js'))];
const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const oldIds = [];
bank.forEach(entry => (entry.modules || []).forEach(mod =>
  (mod.knowledgePoints || []).forEach(kp => {
    if (/^g[1-6]-/.test(kp.id)) oldIds.push(kp.id);
  })
));
if (!oldIds.length) {
  console.log('✅ 未发现未迁移的数学知识点 ID（可能已完成迁移），退出。');
  process.exit(0);
}
// 长 ID 优先，防止短 ID 撞长 ID 前缀（引号全等匹配本身已安全，双保险）
oldIds.sort((a, b) => b.length - a.length);
console.log(`待迁移数学知识点：${oldIds.length} 个`);

// ---- 备份 ----
if (!dry) {
  let dest = BACKUP_DIR;
  let n = 2;
  while (fs.existsSync(dest)) dest = BACKUP_DIR + '-run' + (n++);
  fs.mkdirSync(dest, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'shared', 'knowledge-bank.js'), path.join(dest, 'knowledge-bank.bak.js'));
  fs.cpSync(path.join(ROOT, 'knowledge'), path.join(dest, 'knowledge'), { recursive: true });
  fs.writeFileSync(path.join(dest, 'README.md'),
    '# 知识点 ID 科目化迁移备份（任务2，2026-08-24）\n\n' +
    '- `knowledge-bank.bak.js`：迁移前知识库（旧三段式 ID）\n' +
    '- `knowledge/`：迁移前全部静态详情页（旧文件名）\n' +
    '- `manifest.json`：本次迁移的替换统计与重命名清单\n\n' +
    '回滚方式：以本目录覆盖回 `shared/knowledge-bank.js` 与 `knowledge/`，\n' +
    '并对 plugins/dev/scripts/sitemap.xml 反向应用 manifest 中的 ID 替换。\n');
  console.log('📦 备份目录：' + path.relative(ROOT, dest));
  var backupDest = dest;
}

// ---- 文本替换 ----
const replaceStats = {}; // file -> count
function migrateTextFile(fp) {
  const rel = path.relative(ROOT, fp);
  let src;
  try { src = fs.readFileSync(fp, 'utf8'); } catch (e) { return; }
  let count = 0;
  let out = src;
  for (const id of oldIds) {
    // 引号全等形式（JS 字符串）
    out = out.split("'" + id + "'").join("'" + PREFIX + id + "'");
    count += occurrences(src, "'" + id + "'");
    src = out;
    out = out.split('"' + id + '"').join('"' + PREFIX + id + '"');
    count += occurrences(src, '"' + id + '"');
    src = out;
  }
  if (/\.xml$|\.html$/.test(fp)) {
    for (const id of oldIds) {
      // URL/链接形式：knowledge/gX-....html 或独立 gX-....html
      const re = new RegExp('(?<![a-z0-9-])' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.html', 'g');
      const hits = (out.match(re) || []).length;
      if (hits) {
        out = out.replace(re, PREFIX + id + '.html');
        count += hits;
        src = out;
      }
    }
  }
  if (count > 0 && !dry) fs.writeFileSync(fp, out, 'utf8');
  if (count > 0) replaceStats[rel] = count;
}
function occurrences(haystack, needle) {
  let n = 0, i = 0;
  while ((i = haystack.indexOf(needle, i)) !== -1) { n++; i += needle.length; }
  return n;
}
textTargets.forEach(migrateTextFile);

// ---- knowledge/ 文件重命名 ----
const KNOW_DIR = path.join(ROOT, 'knowledge');
const renames = [];
for (const id of oldIds) {
  const from = path.join(KNOW_DIR, id + '.html');
  const to = path.join(KNOW_DIR, PREFIX + id + '.html');
  if (fs.existsSync(from)) {
    renames.push(id + '.html -> ' + PREFIX + id + '.html');
    if (!dry) fs.renameSync(from, to);
  }
}

// ---- 归档 slug 字典键前缀（仅键，值保留旧 slug）----
// 键为两段式 {grade}-{slug}（如 '1-addsub-20'）；行首引号键位置匹配，值不动
let slugMapKeys = 0;
if (fs.existsSync(SLUG_MAP_FILE)) {
  let src = fs.readFileSync(SLUG_MAP_FILE, 'utf8');
  const out = src.replace(/^(\s*)'(\d-[^']*)'\s*:/gm,
    (m, sp, key) => { slugMapKeys++; return `${sp}'${PREFIX}${key}':`; });
  if (slugMapKeys > 0 && !dry) fs.writeFileSync(SLUG_MAP_FILE, out, 'utf8');
}

// ---- manifest ----
const manifest = {
  date: new Date().toISOString(),
  idCount: oldIds.length,
  renamedPages: renames.length,
  slugMapKeysPrefixed: slugMapKeys,
  replacements: replaceStats
};
if (!dry && backupDest) {
  fs.writeFileSync(path.join(backupDest, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

// ---- 摘要 ----
console.log((dry ? '[dry-run] ' : '') + '文本替换 ' +
  Object.values(replaceStats).reduce((a, b) => a + b, 0) + ' 处，涉及 ' +
  Object.keys(replaceStats).length + ' 个文件；详情页重命名 ' + renames.length + ' 个；slug 字典键 ' + slugMapKeys + ' 个。');
Object.keys(replaceStats).sort().forEach(f => console.log('  ' + f + ': ' + replaceStats[f]));
if (dry) console.log('[dry-run] 未写入任何文件、未重命名、未备份。');
else console.log('✅ 迁移完成。下一步：node scripts/generate-knowledge-pages.js 再生成页面。');
