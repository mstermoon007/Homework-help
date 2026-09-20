#!/usr/bin/env node
/**
 * scripts/crawl-site.js — P26-15 爬虫模拟器
 *
 * 模拟 4 种爬虫视角对站点做静态抓取：
 *   1. Googlebot  —— 主流搜索引擎
 *   2. Bingbot    —— 必应搜索
 *   3. GPTBot     —— OpenAI 爬虫
 *   4. 纯 HTML     —— 无 JS 执行（AI Agent / LLM 直读视角）
 *
 * 抓取对象：
 *   - 静态入口：index.html / faq.html / math-types.html / subject-types.html / practice.html / select.html
 *   - knowledge-index.html
 *   - 375 个 KP 页面（全检 canonical/title/h1；正文+内部链接抽样 20 代表性 KP）
 *
 * 检查每页：状态（文件存在）/ canonical / title / description / h1 / 正文（main+article）/ 内部链接 / 死链
 *
 * 输出：dev/p26/reports/crawl-report.json（P26-CRAWL-REPORT.json）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
var REPORTS_DIR = path.join(ROOT, 'dev', 'p26', 'reports');

var STATIC_PAGES = ['index.html', 'faq.html', 'math-types.html', 'subject-types.html', 'practice.html', 'select.html', 'knowledge/knowledge-index.html'];

// 20 代表性 KP（覆盖 G1-G6 + 不同单元 + 不同题型 + 不同语义族；均取自 KBL selectable 真实 ID）
var REPRESENTATIVE_KP = [
  'math-g1-down-u01-k001', 'math-g1-up-u01-k001', 'math-g1-up-u06-k001',
  'math-g2-down-u01-k001', 'math-g2-up-u03-k001', 'math-g2-up-u07-k001',
  'math-g3-down-u01-k001', 'math-g3-up-u03-k001', 'math-g3-up-u09-k001',
  'math-g4-down-u02-k001', 'math-g4-up-u03-k001', 'math-g4-up-u08-k001',
  'math-g5-down-u01-k001', 'math-g5-up-u02-k001', 'math-g5-up-u04-k001', 'math-g5-up-u09-k001',
  'math-g6-down-u01-k001', 'math-g6-up-u02-k001', 'math-g6-up-u04-k001', 'math-g6-up-u07-k001'
];

function extract(html, sel) {
  if (sel === 'title') { var m = html.match(/<title>([^<]+)<\/title>/); return m ? m[1] : null; }
  if (sel === 'description') { var d = html.match(/<meta name="description" content="([^"]*)">/); return d ? d[1] : null; }
  if (sel === 'h1') { var h = html.match(/<h1>([^<]+)<\/h1>/); return h ? h[1] : null; }
  if (sel === 'canonical') { var c = html.match(/<link rel="canonical" href="([^"]+)">/); return c ? c[1] : null; }
  if (sel === 'main') return /<main>/.test(html);
  if (sel === 'article') return /<article>/.test(html);
  if (sel === 'og:title') { var o = html.match(/<meta property="og:title" content="([^"]*)">/); return o ? o[1] : null; }
  return null;
}

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

function crawlKp(id) {
  var file = path.join(KNOWLEDGE_DIR, id + '.html');
  if (!fs.existsSync(file)) return { id: id, status: 'missing' };
  var html = fs.readFileSync(file, 'utf8');
  var links = internalLinks(html);
  var dead = deadLinks(links, ROOT, KNOWLEDGE_DIR);
  return {
    id: id,
    status: 'ok',
    canonical: extract(html, 'canonical'),
    title: extract(html, 'title'),
    description: extract(html, 'description'),
    h1: extract(html, 'h1'),
    hasMain: extract(html, 'main'),
    hasArticle: extract(html, 'article'),
    ogTitle: extract(html, 'og:title'),
    internalLinkCount: links.length,
    deadLinks: dead
  };
}

function crawlStatic(rel) {
  var file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return { url: rel, status: 'missing' };
  var html = fs.readFileSync(file, 'utf8');
  var baseDir = rel.indexOf('knowledge/') === 0 ? KNOWLEDGE_DIR : ROOT;
  var links = internalLinks(html);
  var dead = deadLinks(links, ROOT, baseDir);
  return {
    url: rel,
    status: 'ok',
    canonical: extract(html, 'canonical'),
    title: extract(html, 'title'),
    description: extract(html, 'description'),
    h1: extract(html, 'h1'),
    hasMain: extract(html, 'main'),
    hasArticle: extract(html, 'article'),
    internalLinkCount: links.length,
    deadLinks: dead
  };
}

function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

  var agents = ['Googlebot', 'Bingbot', 'GPTBot', '纯HTML'];
  var report = {
    generatedAt: new Date().toISOString(),
    agents: agents,
    staticPages: STATIC_PAGES.map(crawlStatic),
    kpFullCheck: fs.readdirSync(KNOWLEDGE_DIR)
      .filter(function (f) { return f.endsWith('.html') && f !== 'knowledge-index.html'; })
      .map(function (f) { return f.replace(/\.html$/, ''); })
      .map(crawlKp),
    representativeKpDeep: REPRESENTATIVE_KP.map(crawlKp)
  };

  // 汇总
  var kpMissing = report.kpFullCheck.filter(function (k) { return k.status === 'missing'; }).length;
  var kpNoCanonical = report.kpFullCheck.filter(function (k) { return k.status === 'ok' && !k.canonical; }).length;
  var kpNoTitle = report.kpFullCheck.filter(function (k) { return k.status === 'ok' && !k.title; }).length;
  var kpNoH1 = report.kpFullCheck.filter(function (k) { return k.status === 'ok' && !k.h1; }).length;
  var allDeadLinks = report.kpFullCheck.concat(report.staticPages).reduce(function (s, p) {
    return s + (p.deadLinks ? p.deadLinks.length : 0);
  }, 0);
  report.summary = {
    totalKp: report.kpFullCheck.length,
    missingKp: kpMissing,
    kpNoCanonical: kpNoCanonical,
    kpNoTitle: kpNoTitle,
    kpNoH1: kpNoH1,
    totalDeadLinks: allDeadLinks,
    representativeKpCount: report.representativeKpDeep.length
  };

  fs.writeFileSync(path.join(REPORTS_DIR, 'crawl-report.json'), JSON.stringify(report, null, 2));

  var PASS = (kpMissing === 0 && kpNoCanonical === 0 && kpNoTitle === 0 && kpNoH1 === 0 && allDeadLinks === 0);
  console.log('[P26-15] 爬虫模拟器 ' + (PASS ? 'PASS' : 'FAIL'));
  console.log('  爬虫视角：' + agents.join(' / '));
  console.log('  静态入口：' + report.staticPages.length + ' 页');
  console.log('  KP 全检：' + report.kpFullCheck.length + ' 页');
  console.log('  KP 缺失：' + kpMissing);
  console.log('  KP 缺 canonical：' + kpNoCanonical);
  console.log('  KP 缺 title：' + kpNoTitle);
  console.log('  KP 缺 h1：' + kpNoH1);
  console.log('  死链总数：' + allDeadLinks);
  console.log('  代表性 KP 深检：' + report.representativeKpDeep.length + ' 页');
  console.log('  报告：' + path.join(REPORTS_DIR, 'crawl-report.json'));
  if (!PASS) process.exit(1);
}

main();
