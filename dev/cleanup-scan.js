const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');

// 整个目录直接跳过（不递归、不删除其中文件）
const skipDirs = ['.git', '.venv', '.workbuddy', 'node_modules'];

// 应保留的根级文件（正则或确切文件名）
const keepFiles = [
  /^index\.html$/,
  /^practice\.html$/,
  /^math-types\.html$/,
  /^chinese-types\.html$/,
  /^english-types\.html$/,
  /^subject-types\.html$/,
  /^faq\.html$/,
  /^README\.md$/,
  /^CONTRIBUTING\.md$/,
  /^MEMORY\.md$/,
  /^overview\.md$/,
  /^LICENSE$/,
  /^\.gitignore$/,
  /^banner\.jpg$/,
  /^pinyin-bank\.js$/,
  /^sw\.js$/,
  /^CNAME$/, // GitHub Pages 自定义域名文件，合法保留
  /^llms\.txt$/,
  /^robots\.txt$/,
  /^sitemap\.xml$/,
  // 模块目录与竞赛占位插件：核心数据源与兜底插件，永不清理
  // （g4/g5 基础占位插件已随全量真实插件落地而移除，不再入白名单）
  /^shared\/module-catalog\.js$/,
  /^plugins\/math-competition-placeholder\.js$/,
  // 已完成插件化迁移的旧练习页不再保留
  // （comprehensive/english-alphabet/math-shapes 已迁移为 plugins/ 对应插件）
];

// 应保留的目录前缀
const keepDirs = [/^\.github\//, /^assets\//, /^shared\//, /^plugins\//, /^dev\//, /^docs\//, /^archive\//, /^scripts\//, /^knowledge\//, /^tests\//];

function shouldKeep(filePath) {
  const relative = path.relative(ROOT, filePath);
  if (relative === '') return true;
  if (keepFiles.some(p => p.test(relative))) return true;
  return keepDirs.some(p => p.test(relative));
}

function scanDir(dir, skipTop) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let removable = [];
  files.forEach(f => {
    const fullPath = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (skipTop && skipDirs.includes(f.name)) return;
      removable = removable.concat(scanDir(fullPath));
    } else {
      if (!shouldKeep(fullPath)) {
        removable.push(fullPath);
      }
    }
  });
  return removable;
}

const dryRun = process.argv.includes('--dry-run');
const candidates = scanDir(ROOT, true);

if (candidates.length === 0) {
  console.log('✅ 没有发现需要清理的文件。');
  process.exit(0);
}

console.log(dryRun ? '🔍 扫描结果（--dry-run，未删除）:' : '⚠️  以下文件可能已无效，建议删除：');
candidates.forEach((f, i) => console.log(`  ${i + 1}. ${path.relative(ROOT, f)}`));

if (dryRun) process.exit(0);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question(`共 ${candidates.length} 个文件，是否删除？(y/N) `, answer => {
  if (answer.toLowerCase() === 'y') {
    candidates.forEach(f => {
      fs.unlinkSync(f);
      console.log(`已删除: ${path.relative(ROOT, f)}`);
    });
    console.log('清理完成。');
  } else {
    console.log('取消删除。');
  }
  rl.close();
});
