// scripts/migrate-knowledge-ids.js
// 正式迁移脚本：基于审核后的最终映射表（migration-map-final.csv），更新 shared/knowledge-bank.js。
//  - 将知识点 id 替换为映射表 newId
//  - 新增字段：prerequisites / related / difficulty / status
//  - 保持 name、pluginId、weight、type、description、example 不变
//  - 保持原有 IIFE 风格与辅助函数（findGrade/getEntries/getCoverage 等）
// 用法：node scripts/migrate-knowledge-ids.js
'use strict';

const fs = require('fs');
const path = require('path');

const KB_FILE = path.join(__dirname, '..', 'shared', 'knowledge-bank.js');
const MAP_FILE = path.join(__dirname, '..', 'migration-map-final.csv');
const BACKUP_DIR = path.join(__dirname, '..', 'archive');

// ---------- CSV 解析（支持引号转义） ----------
function parseCSV(s) {
  const rows = [];
  let row = [], field = '', q = false, i = 0;
  while (i < s.length) {
    const c = s[i];
    if (q) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else q = false;
      } else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
    i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.length && r.join('').replace(/[\s,]/g, ''); });
}

// ---------- JS 字符串序列化 ----------
function jsStr(v) { return JSON.stringify(String(v == null ? '' : v)); }

// ---------- 序列化知识库（保持可读、无尾逗号） ----------
function serPoint(p) {
  const props = [
    '              id: ' + jsStr(p.id),
    '              name: ' + jsStr(p.name),
    '              pluginId: ' + jsStr(p.pluginId),
    '              weight: ' + p.weight,
    '              type: ' + jsStr(p.type),
    '              description: ' + jsStr(p.description),
    '              example: ' + jsStr(p.example),
    '              prerequisites: ' + JSON.stringify(p.prerequisites),
    '              related: ' + JSON.stringify(p.related),
    '              difficulty: ' + p.difficulty,
    '              status: ' + jsStr(p.status)
  ];
  return '            {\n' + props.join(',\n') + '\n            }';
}

function serModule(m) {
  const points = m.knowledgePoints.map(serPoint);
  return '        {\n' +
    '          moduleId: ' + jsStr(m.moduleId) + ',\n' +
    '          knowledgePoints: [\n' + points.join(',\n') + '\n' +
    '          ]\n' +
    '        }';
}

function serGrade(g) {
  const modules = g.modules.map(serModule);
  return '    // ========== 年级' + g.grade + ' ==========\n' +
    '    {\n' +
    '      grade: ' + g.grade + ',\n' +
    '      modules: [\n' + modules.join(',\n') + '\n' +
    '      ]\n' +
    '    }';
}

// ---------- 主流程 ----------
function main() {
  // 1) 读取并解析最终映射表
  const csvText = fs.readFileSync(MAP_FILE, 'utf8').replace(/\r/g, '');
  const rows = parseCSV(csvText);
  const header = rows.shift();
  if (!header || header.length !== 12) throw new Error('映射表表头异常');
  const lookup = {}; // grade|moduleId|oldId -> row
  rows.forEach(function (r) {
    lookup[r[2] + '|' + r[3] + '|' + r[0]] = r;
  });

  // 2) 读取原始知识库
  const KB = require(KB_FILE);
  const total = KB.reduce(function (n, g) {
    return n + g.modules.reduce(function (m2, m) { return m2 + m.knowledgePoints.length; }, 0);
  }, 0);
  console.log('原知识库知识点数:', total);

  // 3) 备份（安全）
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const bak = path.join(BACKUP_DIR, 'knowledge-bank-pre-migrate-' + ts + '.js');
  fs.copyFileSync(KB_FILE, bak);
  console.log('已备份原文件 ->', bak);

  // 4) 遍历替换
  let mapped = 0, missing = 0;
  const missingList = [];
  KB.forEach(function (g) {
    g.modules.forEach(function (m) {
      m.knowledgePoints.forEach(function (p) {
        const key = g.grade + '|' + m.moduleId + '|' + p.id;
        const row = lookup[key];
        if (!row) { missing++; missingList.push(key); return; }
        p.id = row[1]; // newId
        p.prerequisites = String(row[8] || '').split(/[|,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
        p.related = String(row[9] || '').split(/[|,;]/).map(function (s) { return s.trim(); }).filter(Boolean);
        p.difficulty = Number(row[10]);
        p.status = row[11];
        mapped++;
      });
    });
  });
  if (missing) {
    console.error('未找到映射的知识点:', missingList.join(' ; '));
    process.exit(1);
  }
  console.log('已映射知识点:', mapped);

  // 5) 组装新文件（保持 IIFE 与辅助函数）
  const src = fs.readFileSync(KB_FILE, 'utf8');
  const marker = 'var KnowledgeBank = [';
  const arrStart = src.indexOf(marker);
  if (arrStart === -1) throw new Error('未找到 KnowledgeBank 数组');
  // 括号配对扫描，定位数组闭合
  let depth = 0, quote = null, j = arrStart + marker.indexOf('[');
  for (; j < src.length; j++) {
    const c = src[j];
    if (quote) {
      if (c === '\\') { j++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === '/' && src[j + 1] === '/') { while (j < src.length && src[j] !== '\n') j++; continue; }
    if (c === '/' && src[j + 1] === '*') { j += 2; while (j < src.length && !(src[j] === '*' && src[j + 1] === '/')) j++; j++; continue; }
    if (c === '[' || c === '{' || c === '(') depth++;
    else if (c === ']' || c === '}' || c === ')') {
      depth--;
      if (depth === 0) break;
    }
  }
  const semicolon = src.indexOf(';', j);
  if (depth !== 0 || semicolon === -1) throw new Error('数组边界定位失败');

  const newArray = 'var KnowledgeBank = [\n' +
    KB.map(serGrade).join(',\n') + '\n' +
    '  ];';

  const newSrc = src.slice(0, arrStart) + newArray + src.slice(semicolon + 1);
  fs.writeFileSync(KB_FILE, newSrc, 'utf8');
  console.log('已写回', KB_FILE);
}

main();
