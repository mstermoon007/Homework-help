// scripts/migrate-plugin-knowledge-points.js
// 将各插件 createPlugin config 中的 knowledgePoints 旧 id 批量迁移为新 id。
//   - 单年级插件：保持数组格式，逐 id 映射到新 id。
//   - 多年级插件：改为按年级对象格式 { grade: [newId...] }（与工厂 getEntries 校验一致）。
//   - 某旧 id 在某年级缺失（如 C8 在 5/6 年级无知识库条目）则跳过该年级，避免悬空声明。
// 用法：node scripts/migrate-plugin-knowledge-points.js
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

// ---- 映射表：grade|oldId -> newId ----
const csvText = fs.readFileSync(path.join(ROOT, 'migration-map-final.csv'), 'utf8').replace(/\r/g, '');
function parseCSV(s) {
  const rows = []; let row = [], field = '', q = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else field += c; }
    i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const newIdByKey = {};
parseCSV(csvText).slice(1).forEach(r => { newIdByKey[r[2] + '|' + r[0]] = r[1]; });

// ---- 注册表：pluginId -> grades ----
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));
const pluginGrades = new Map(registry.map(p => [p.id, p.grades]));

// ---- 提取 knowledgePoints 字面量（括号配对） ----
function extractLiteral(src, kpIdx) {
  let i = src.indexOf(':', kpIdx);
  while (i + 1 < src.length && (src[i + 1] === ' ' || src[i + 1] === '\t' || src[i + 1] === '\n')) i++;
  const open = src[i + 1];
  if (open !== '[' && open !== '{') return null;
  let depth = 0, quote = null, j = i + 1;
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) { if (c === '\\') j++; else if (c === quote) quote = null; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') { depth--; if (depth === 0) break; }
  }
  if (depth !== 0) return null;
  return { start: i + 1, end: j, text: src.slice(i + 1, j + 1) };
}

// ---- 序列化 ----
function serArr(arr, indent) {
  if (!arr.length) return '[]';
  const inner = arr.map(x => "'" + x + "'").join(', ');
  if (inner.length <= 90) return '[' + inner + ']';
  return '[\n' + arr.map(x => indent + "    '" + x + "'").join(',\n') + '\n' + indent + ']';
}
function serKP(value) {
  if (Array.isArray(value)) return serArr(value, '    ');
  const keys = Object.keys(value).map(Number).sort((a, b) => a - b);
  const lines = keys.map(g => "      " + g + ': ' + serArr(value[g], '      '));
  return '{\n' + lines.join(',\n') + '\n    }';
}

// ---- 主流程 ----
const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.js'));
let changed = 0, skipped = 0;
const issues = [];

files.forEach(f => {
  const file = path.join(PLUGINS_DIR, f);
  let src = fs.readFileSync(file, 'utf8');
  const kpIdx = src.indexOf('knowledgePoints:');
  if (kpIdx === -1) return; // 无声明
  if (src.indexOf('knowledgePoints:', kpIdx + 1) !== -1) { issues.push(f + '：存在多处 knowledgePoints，跳过'); skipped++; return; }

  const lit = extractLiteral(src, kpIdx);
  if (!lit) { issues.push(f + '：字面量提取失败，跳过'); skipped++; return; }

  let value;
  try { value = eval('(' + lit.text + ')'); }
  catch (e) { issues.push(f + '：字面量解析失败，跳过'); skipped++; return; }

  // 插件 id 与 grades
  const idMatch = /id:\s*['"]([^'"]+)['"]/.exec(src);
  const pid = idMatch ? idMatch[1] : f.replace(/\.js$/, '');
  const grades = pluginGrades.get(pid) || (value && !Array.isArray(value) ? Object.keys(value).map(Number) : null);
  if (!grades || !grades.length) { issues.push(f + '(' + pid + ')：无法确定 grades，跳过'); skipped++; return; }

  // 映射
  function mapIds(ids, grade) {
    return ids.map(oldId => {
      const nid = newIdByKey[grade + '|' + oldId];
      if (!nid) issues.push(f + '(' + pid + ')：旧 id 在年级 ' + grade + ' 无映射: ' + oldId);
      return nid;
    }).filter(Boolean);
  }

  let newValue;
  if (Array.isArray(value)) {
    if (grades.length === 1) {
      newValue = mapIds(value, grades[0]);
    } else {
      newValue = {};
      grades.forEach(g => {
        const mapped = mapIds(value, g);
        if (mapped.length) newValue[g] = mapped;
      });
    }
  } else {
    newValue = {};
    Object.keys(value).forEach(g => { newValue[g] = mapIds(value[g], Number(g)); });
  }

  const newLit = serKP(newValue);
  if (newLit === lit.text) { skipped++; return; }
  src = src.slice(0, lit.start) + newLit + src.slice(lit.end + 1);
  fs.writeFileSync(file, src, 'utf8');
  changed++;
});

console.log('已更新插件:', changed, ' 跳过/未变:', skipped);
if (issues.length) {
  console.log('\n⚠️  提示/问题（' + issues.length + ' 条）：');
  issues.forEach(s => console.log('  - ' + s));
}
