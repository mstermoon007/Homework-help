#!/usr/bin/env node
/**
 * scripts/generate-sitemap.js
 * 生成 sitemap.xml，包含站点全部静态 HTML 页面（首页、FAQ、题型页、知识库页）。
 * 运行：node scripts/generate-sitemap.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://mstermoon007.github.io/Homework-help/';

// 需纳入 sitemap 的静态页面（相对站点根）
const STATIC_PAGES = [
  'index.html',
  'math-types.html',
  'chinese-types.html',
  'english-types.html',
  'subject-types.html',
  'practice.html',
  'faq.html'
];

// 收集 knowledge/ 下所有 .html
const knowledgeDir = path.join(ROOT, 'knowledge');
const knowledgePages = [];
if (fs.existsSync(knowledgeDir)) {
  fs.readdirSync(knowledgeDir).forEach((f) => {
    if (f.endsWith('.html')) knowledgePages.push('knowledge/' + f);
  });
}

const allPages = STATIC_PAGES.concat(knowledgePages).sort();

const urlNodes = allPages.map((p) => {
  const fp = path.join(ROOT, p);
  let lastmod = '';
  try {
    const t = fs.statSync(fp).mtime;
    lastmod = t.toISOString().split('T')[0];
  } catch (e) {}
  return '  <url>\n    <loc>' + BASE + p + '</loc>' +
    (lastmod ? '\n    <lastmod>' + lastmod + '</lastmod>' : '') +
    '\n    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>';
}).join('\n');

const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urlNodes + '\n</urlset>\n';

fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
console.log('✅ 已生成 sitemap.xml：');
console.log('   静态页：' + STATIC_PAGES.length + ' 个');
console.log('   知识库页：' + knowledgePages.length + ' 个');
console.log('   总计：' + allPages.length + ' 个');
