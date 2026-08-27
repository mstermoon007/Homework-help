#!/usr/bin/env node
/**
 * scripts/inject-schema.js
 * 为核心页面注入 JSON-LD 结构化数据（WebSite / Organization / CollectionPage）
 * 以及 <noscript> 静态题型列表（供不执行 JS 的爬虫抓取）。
 *
 * 注意：chinese-types.html / english-types.html 为 JS 重定向页，
 * 其真实内容在 subject-types.html，因此中文/英语的 CollectionPage 同时写入
 * 重定向页（源可见）与 subject-types.html（渲染页）。
 *
 * 运行：node scripts/inject-schema.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://home.modouyu.top/';
const reg = require(path.join(ROOT, 'plugins', 'registry.js'));

function ld(obj) {
  return '<script type="application/ld+json">\n' + JSON.stringify(obj, null, 2) + '\n</script>';
}

function insertBeforeHeadEnd(file, snippet) {
  const p = path.join(ROOT, file);
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf('application/ld+json') !== -1) {
    console.log('跳过（已有 JSON-LD）：' + file);
    return;
  }
  t = t.replace('</head>', snippet + '\n</head>');
  fs.writeFileSync(p, t, 'utf8');
  console.log('已注入 JSON-LD：' + file);
}

function insertNoscript(file, html) {
  const p = path.join(ROOT, file);
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf('class="noscript-types"') !== -1) return;
  // 在 <body> 之后插入静态列表
  t = t.replace(/<body[^>]*>/, function (m) { return m + '\n<noscript><div class="noscript-types" style="max-width:860px;margin:24px auto;padding:0 20px;font-family:sans-serif;line-height:1.8;">' + html + '</div></noscript>'; });
  fs.writeFileSync(p, t, 'utf8');
  console.log('已注入 noscript：' + file);
}

const practice = (id, g) => BASE + 'practice.html?plugin=' + id + '&grade=' + g;

// ===== 数学题型（去重 by name）=====
const mathItems = [];
const seen = {};
reg.filter(p => p.subject === 'math').forEach(p => {
  if (seen[p.name]) return; seen[p.name] = 1;
  mathItems.push({ '@type': 'WebPage', name: p.name, url: practice(p.id, p.grades[0]) });
});
const mathNoscript = '<h2>数学题型（按年级）</h2><ul>' + mathItems.map(i =>
  '<li><a href="' + i.url + '">' + i.name + '</a></li>').join('') + '</ul>';

const chineseItems = reg.filter(p => p.subject === 'chinese').map(p =>
  ({ '@type': 'WebPage', name: p.name, url: practice(p.id, 1) }));
const englishItems = reg.filter(p => p.subject === 'english').map(p =>
  ({ '@type': 'WebPage', name: p.name, url: practice(p.id, 1) }));

const chineseNoscript = '<h2>语文题型</h2><ul>' + chineseItems.map(i =>
  '<li><a href="' + i.url + '">' + i.name + '</a></li>').join('') + '</ul>';
const englishNoscript = '<h2>英语题型</h2><ul>' + englishItems.map(i =>
  '<li><a href="' + i.url + '">' + i.name + '</a></li>').join('') + '</ul>';

// ===== 1) index.html : WebSite + Organization =====
insertBeforeHeadEnd('index.html',
  ld({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': 'Homework Help 小学家庭作业生成器',
    'url': BASE,
    'description': '免费无广告的小学 1-6 年级数学、语文、英语练习题生成与打印工具。'
  }) + '\n' + ld({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': 'Homework Help',
    'url': BASE,
    'logo': BASE + 'assets/banner.webp',
    'sameAs': []
  }));

// ===== 2) math-types.html : CollectionPage =====
insertBeforeHeadEnd('math-types.html',
  ld({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': '数学题型选择 · Homework Help',
    'url': BASE + 'math-types.html',
    'description': '小学 1-6 年级数学题型目录，按年级提供口算、应用题、图形、统计、竖式、竞赛等练习。',
    'hasPart': mathItems
  }));
insertNoscript('math-types.html', mathNoscript);

// ===== 3) chinese / english 重定向页 : CollectionPage + noscript =====
insertBeforeHeadEnd('chinese-types.html',
  ld({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': '语文题型选择 · Homework Help',
    'url': BASE + 'chinese-types.html',
    'description': '小学 1-6 年级语文题型目录：拼音练习、看拼音写字、综合练习。',
    'hasPart': chineseItems
  }));
insertNoscript('chinese-types.html', chineseNoscript);

insertBeforeHeadEnd('english-types.html',
  ld({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': '英语题型选择 · Homework Help',
    'url': BASE + 'english-types.html',
    'description': '小学 1-6 年级英语题型目录：字母跟读练习。',
    'hasPart': englishItems
  }));
insertNoscript('english-types.html', englishNoscript);

// ===== 4) subject-types.html（中文/英语真实渲染页）=====
insertBeforeHeadEnd('subject-types.html',
  ld({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': '题型选择 · Homework Help',
    'url': BASE + 'subject-types.html',
    'description': '小学 1-6 年级语文与英语题型选择页，包含拼音、看拼音写字、综合练习与字母跟读。',
    'hasPart': chineseItems.concat(englishItems)
  }));
insertNoscript('subject-types.html', chineseNoscript + englishNoscript);

console.log('✅ 结构化数据注入完成。');
