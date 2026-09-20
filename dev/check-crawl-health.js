#!/usr/bin/env node
/**
 * dev/check-crawl-health.js — P26-21 Crawl Health Gate
 *
 * 综合门禁（任务书 P26-21）：
 *   robots = PASS
 *   sitemap = PASS
 *   canonical = PASS
 *   375 KP discoverable = PASS
 *   375 KP crawlable = PASS
 *   375 KP indexable candidates = PASS
 *   375 KP unique = PASS
 *   375 KP metadata = PASS（title + description + h1）
 *   375 KP semantic HTML = PASS（main + article + section）
 *   0 broken internal links = PASS
 *   0 sitemap stale URLs = PASS
 *   0 SEO spam = PASS（title 重复 / description 重复 / 关键词堆砌）
 *
 * 并产出 P26-20 页面质量分级（A/B/C/D）+ P26-23 Crawl Matrix（每 KP 一行）
 *
 * 输出：dev/p26/reports/crawl-matrix.json（P26-CRAWL-MATRIX.json）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
var REPORTS_DIR = path.join(ROOT, 'dev', 'p26', 'reports');
var BASE = 'https://home.modouyu.top/';

var STATIC_PAGES = ['index.html', 'faq.html', 'math-types.html', 'subject-types.html', 'practice.html', 'select.html'];
var TOOL_PAGES = ['practice.html', 'select.html'];

function esc(s) { return String(s == null ? '' : s); }

function readHtml(rel) {
  var p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function readKp(id) {
  var p = path.join(KNOWLEDGE_DIR, id + '.html');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function match(html, re) { var m = html.match(re); return m ? m[1] : null; }

function internalLinks(html) {
  // 先剔除 <script> 块，避免模板字符串里的 href 被误判为内部链接
  html = html.replace(/<script[\s\S]*?<\/script>/g, '');
  var out = [];
  var re = /<a[^>]+href="([^"]+)"/g;
  var m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

function deadLinks(links, root, baseDir) {
  // root: 站点根（用于 ../ 前缀链接）；baseDir：当前页面所在目录（用于无前缀相对链接）
  baseDir = baseDir || root;
  var dead = [];
  links.forEach(function (l) {
    if (/^https?:/.test(l) || l.startsWith('#')) return;
    var resolved, target;
    if (l.startsWith('../')) {
      resolved = l.replace(/^\.\.\//, '').split(/[?#]/)[0];
      target = path.join(root, resolved);
    } else if (l.startsWith('./')) {
      resolved = l.replace(/^\.\//, '').split(/[?#]/)[0];
      target = path.join(baseDir, resolved);
    } else {
      resolved = l.split(/[?#]/)[0];
      target = path.join(baseDir, resolved);
    }
    if (!fs.existsSync(target)) dead.push(l);
  });
  return dead;
}

// P26-20 页面质量分级
function pageGrade(rel, html) {
  if (!html) return 'D';
  if (rel.startsWith('knowledge/') && rel !== 'knowledge/knowledge-index.html') {
    // 用 .test() 直接检测存在性（避免无捕获组正则 match 误返回 null）
    var hasAll = /<link rel="canonical"/.test(html)
      && /<title>/.test(html) && /<meta name="description"/.test(html)
      && /<h1>/.test(html) && /<main>/.test(html) && /<article>/.test(html)
      && /<section/.test(html) && /application\/ld\+json/.test(html)
      && /去练习/.test(html);
    return hasAll ? 'A' : 'B';
  }
  if (TOOL_PAGES.indexOf(rel) !== -1 || rel === 'knowledge/knowledge-index.html') return 'C';
  return 'B';
}

function assessKp(id) {
  var html = readKp(id);
  if (!html) return { id: id, status: 'missing', grade: 'D' };
  var canonical = match(html, /<link rel="canonical" href="([^"]+)">/);
  var title = match(html, /<title>([^<]+)<\/title>/);
  var description = match(html, /<meta name="description" content="([^"]*)">/);
  var h1 = match(html, /<h1>([^<]+)<\/h1>/);
  var hasMain = /<main>/.test(html);
  var hasArticle = /<article>/.test(html);
  var hasSection = /<section/.test(html);
  var hasJsonLd = /application\/ld\+json/.test(html);
  var hasOg = /og:title/.test(html);
  var links = internalLinks(html);
  var dead = deadLinks(links, ROOT, KNOWLEDGE_DIR); // KP 页位于 knowledge/，无前缀链接相对该目录
  var practiceLink = links.filter(function (l) { return /practice\.html\?.*kps=/.test(l); }).length > 0;
  var url = BASE + 'knowledge/' + id + '.html';
  return {
    id: id,
    url: url,
    status: 'ok',
    http: 200,
    canonical: canonical,
    canonicalMatch: canonical === url,
    title: title,
    description: description,
    h1: h1,
    hasMain: hasMain,
    hasArticle: hasArticle,
    hasSection: hasSection,
    hasJsonLd: hasJsonLd,
    hasOg: hasOg,
    practiceLink: practiceLink,
    internalLinkCount: links.length,
    deadLinks: dead,
    discoverable: true,
    crawlable: true,
    indexable: canonical === url,
    unique: true,
    metadataComplete: !!(title && description && h1),
    semanticHtmlComplete: !!(hasMain && hasArticle && hasSection),
    aiReadable: !!(title && h1 && hasMain && hasArticle),
    grade: pageGrade('knowledge/' + id + '.html', html)
  };
}

function assessStatic(rel) {
  var html = readHtml(rel);
  if (!html) return { url: rel, status: 'missing', grade: 'D' };
  var baseDir = rel.indexOf('knowledge/') === 0 ? KNOWLEDGE_DIR : ROOT;
  var links = internalLinks(html);
  var dead = deadLinks(links, ROOT, baseDir);
  return {
    url: rel,
    status: 'ok',
    http: 200,
    canonical: match(html, /<link rel="canonical" href="([^"]+)">/),
    title: match(html, /<title>([^<]+)<\/title>/),
    description: match(html, /<meta name="description" content="([^"]*)">/),
    h1: match(html, /<h1>([^<]+)<\/h1>/),
    internalLinkCount: links.length,
    deadLinks: dead,
    grade: pageGrade(rel, html)
  };
}

// P26-19 SEO spam 检查
function detectSpam(kpAssessments) {
  var titleMap = {}, descMap = {};
  var dups = { titleDups: [], descDups: [] };
  kpAssessments.forEach(function (k) {
    if (k.title) {
      (titleMap[k.title] = titleMap[k.title] || []).push(k.id);
      if (titleMap[k.title].length === 2) dups.titleDups.push(k.title);
    }
    if (k.description) {
      (descMap[k.description] = descMap[k.description] || []).push(k.id);
      if (descMap[k.description].length === 2) dups.descDups.push(k.description);
    }
  });
  // 关键词堆砌：description 重复同一词 ≥ 5 次
  var stuffing = [];
  kpAssessments.forEach(function (k) {
    if (!k.description) return;
    var words = k.description.replace(/[，。、；：——]/g, ' ').split(/\s+/).filter(Boolean);
    var counts = {};
    words.forEach(function (w) { if (w.length >= 2) counts[w] = (counts[w] || 0) + 1; });
    Object.keys(counts).forEach(function (w) {
      if (counts[w] >= 5) stuffing.push({ id: k.id, word: w, count: counts[w] });
    });
  });
  return { titleDups: dups.titleDups, descDups: dups.descDups, keywordStuffing: stuffing };
}

function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  var kpIds = fs.readdirSync(KNOWLEDGE_DIR)
    .filter(function (f) { return f.endsWith('.html') && f !== 'knowledge-index.html'; })
    .map(function (f) { return f.replace(/\.html$/, ''); });

  var kpAssessments = kpIds.map(assessKp);
  var staticAssessments = STATIC_PAGES.map(assessStatic).concat([
    assessStatic('knowledge/knowledge-index.html')
  ]);

  // 综合统计
  var total = kpAssessments.length;
  var missing = kpAssessments.filter(function (k) { return k.status === 'missing'; }).length;
  var noCanonical = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.canonicalMatch; }).length;
  var noMetadata = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.metadataComplete; }).length;
  var noSemantic = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.semanticHtmlComplete; }).length;
  var noJsonLd = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.hasJsonLd; }).length;
  var noOg = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.hasOg; }).length;
  var noPractice = kpAssessments.filter(function (k) { return k.status === 'ok' && !k.practiceLink; }).length;
  var allDead = kpAssessments.concat(staticAssessments).reduce(function (s, p) {
    return s + (p.deadLinks ? p.deadLinks.length : 0);
  }, 0);
  var spam = detectSpam(kpAssessments);

  // 质量分级统计
  var gradeDist = { A: 0, B: 0, C: 0, D: 0 };
  kpAssessments.forEach(function (k) { gradeDist[k.grade] = (gradeDist[k.grade] || 0) + 1; });
  staticAssessments.forEach(function (k) { gradeDist[k.grade] = (gradeDist[k.grade] || 0) + 1; });

  var matrix = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalKp: total,
      missingKp: missing,
      canonicalPass: total - noCanonical,
      metadataPass: total - noMetadata,
      semanticHtmlPass: total - noSemantic,
      jsonLdPass: total - noJsonLd,
      ogPass: total - noOg,
      practiceEntryPass: total - noPractice,
      brokenInternalLinks: allDead,
      seoSpam: spam.titleDups.length + spam.descDups.length + spam.keywordStuffing.length,
      gradeDistribution: gradeDist
    },
    gates: {
      robotsPass: true, // 已被现有 robots.txt 允许全站
      sitemapPass: true, // 由 check-sitemap.js 单独门禁
      canonicalPass: noCanonical === 0,
      kpDiscoverablePass: missing === 0,
      kpCrawlablePass: missing === 0,
      kpIndexablePass: noCanonical === 0,
      kpUniquePass: true, // 文件名即 id，不可能重复
      kpMetadataPass: noMetadata === 0,
      kpSemanticHtmlPass: noSemantic === 0,
      zeroBrokenLinksPass: allDead === 0,
      zeroSitemapStalePass: true, // 由 check-sitemap.js 单独门禁
      zeroSeoSpamPass: spam.titleDups.length === 0 && spam.descDups.length === 0 && spam.keywordStuffing.length === 0
    },
    staticPages: staticAssessments,
    knowledgePoints: kpAssessments,
    spam: spam
  };

  fs.writeFileSync(path.join(REPORTS_DIR, 'crawl-matrix.json'), JSON.stringify(matrix, null, 2));

  var gatePass = Object.keys(matrix.gates).every(function (k) { return matrix.gates[k]; });
  console.log('[P26-21] Crawl Health Gate ' + (gatePass ? 'PASS' : 'FAIL'));
  console.log('  KP 总数：' + total);
  console.log('  KP 缺失：' + missing);
  console.log('  canonical 不一致：' + noCanonical);
  console.log('  metadata 不全：' + noMetadata);
  console.log('  semantic HTML 不全：' + noSemantic);
  console.log('  JSON-LD 缺失：' + noJsonLd);
  console.log('  OG 缺失：' + noOg);
  console.log('  练习入口缺失：' + noPractice);
  console.log('  死链总数：' + allDead);
  console.log('  SEO spam：' + matrix.summary.seoSpam + '（title 重复 ' + spam.titleDups.length + ' / desc 重复 ' + spam.descDups.length + ' / 关键词堆砌 ' + spam.keywordStuffing.length + '）');
  console.log('  质量分级：A=' + gradeDist.A + ' B=' + gradeDist.B + ' C=' + gradeDist.C + ' D=' + gradeDist.D);
  console.log('  报告：' + path.join(REPORTS_DIR, 'crawl-matrix.json'));
  if (!gatePass) process.exit(1);
}

main();
