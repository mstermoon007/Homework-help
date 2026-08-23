// scripts/migrate-knowledge-ids-dry.js
// 干跑（dry-run）：读取知识库与 slug 字典，生成 旧ID → 新ID 的映射 CSV，供人工审查。
// 不修改任何源文件。
'use strict';

const fs = require('fs');
const path = require('path');

const KB = require('../shared/knowledge-bank.js');
const SLUGS = require('../shared/knowledge-slug-map.js');

function csvEscape(v) {
  if (v == null) v = '';
  v = String(v);
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function difficultyFor(grade, moduleId) {
  if (/^C/i.test(moduleId)) {
    if (grade === 4) return 3;
    if (grade === 5) return 4;
    if (grade === 6) return 5;
    return 3;
  }
  return 1; // M 开头及其他基础模块
}

const HEADER = [
  'oldId', 'newId', 'grade', 'moduleId', 'slug', 'name',
  'description', 'example', 'prerequisiteSuggestion', 'relatedSuggestion',
  'difficulty', 'status'
];

const rows = [HEADER];
let missingSlug = 0;

KB.forEach(function (g) {
  const grade = g.grade;
  g.modules.forEach(function (m) {
    const moduleId = m.moduleId;
    m.knowledgePoints.forEach(function (p) {
      const oldId = p.id;
      const slugVal = SLUGS[grade + '-' + oldId]; // slug 字典键为 {grade}-{id}
      if (!slugVal) missingSlug++;
      const slug = slugVal || oldId;
      // slug 字典值带年级前缀（如 4-c5-meet），组合新 ID 时剥掉该前缀，
      // 避免与 g{grade} 前缀重复年级（g4-c5-c5-meet）
      const gradePrefix = grade + '-';
      const baseSlug = slug.indexOf(gradePrefix) === 0 ? slug.slice(gradePrefix.length) : slug;
      const newId = 'g' + grade + '-' + moduleId.toLowerCase() + '-' + baseSlug;
      const isPlaceholder = /placeholder/i.test(p.pluginId);
      const status = isPlaceholder ? 'placeholder' : 'active';
      rows.push([
        oldId, newId, grade, moduleId, slug, p.name || '',
        p.description || '', p.example || '',
        '',                           // prerequisiteSuggestion（人工填写）
        '',                           // relatedSuggestion（人工填写）
        difficultyFor(grade, moduleId),
        status
      ]);
    });
  });
});

const csv = rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\n');
fs.writeFileSync(path.join(__dirname, '..', 'migration-map.csv'), csv, 'utf8');

console.log('已写入 migration-map.csv');
console.log('数据行数(不含表头):', rows.length - 1);
console.log('缺少 slug 对应的知识点数:', missingSlug);
console.log('placeholder 状态行数:', rows.filter(function (r) { return r[11] === 'placeholder'; }).length - (rows[0][11] === 'placeholder' ? 1 : 0));
