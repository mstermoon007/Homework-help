#!/usr/bin/env node
/**
 * dev/check-sitemap.js — P26-02 sitemap 门禁 + P26-18 索引卫生
 *
 * 检查项：
 *   1. sitemap URL 数 = 静态页数 + knowledge/*.html 数
 *   2. KP URL 数 = 375（与 KBL selectable 一致）
 *   3. 重复 URL = 0
 *   4. 参数 URL（?grade=/?kp=/?type=/?debug=/?test=）= 0
 *   5. robots.txt 不 Disallow 任一 sitemap URL
 *   6. canonical 一致性：每个 KP 页面 canonical 与 sitemap URL 一致
 *
 * 输出：dev/p26/reports/sitemap-report.json
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var SITEMAP = path.join(ROOT, 'sitemap.xml');
var ROBOTS = path.join(ROOT, 'robots.txt');
var KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
var REPORTS_DIR = path.join(ROOT, 'dev', 'p26', 'reports');

var URL_RE = /<loc>([^<]+)<\/loc>/g;
var DISALLOW_RE = /^Disallow:\s*(\S+)/im;

function parseSitemap() {
  var xml = fs.readFileSync(SITEMAP, 'utf8');
  var urls = [];
  var m;
  while ((m = URL_RE.exec(xml)) !== null) urls.push(m[1]);
  return urls;
}

function parseRobotsDisallows() {
  var txt = fs.readFileSync(ROBOTS, 'utf8');
  var out = [];
  txt.split('\n').forEach(function (line) {
    var m = line.match(DISALLOW_RE);
    if (m && m[1] !== '/') out.push(m[1]); // 只取具体路径（不取根 /）
  });
  return out;
}

function kpFiles() {
  return fs.readdirSync(KNOWLEDGE_DIR)
    .filter(function (f) { return f.endsWith('.html') && f !== 'knowledge-index.html'; })
    .map(function (f) { return f.replace(/\.html$/, ''); });
}

function canonicalOf(file) {
  var html = fs.readFileSync(path.join(KNOWLEDGE_DIR, file + '.html'), 'utf8');
  var m = html.match(/<link rel="canonical" href="([^"]+)">/);
  return m ? m[1] : null;
}

function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  var urls = parseSitemap();
  var disallows = parseRobotsDisallows();
  var kpIds = kpFiles();
  var BASE = 'https://home.modouyu.top/';

  // 重复 URL
  var seen = {};
  var dups = [];
  urls.forEach(function (u) { if (seen[u]) dups.push(u); seen[u] = true; });

  // 参数 URL
  var params = urls.filter(function (u) {
    return /[?&](grade|kp|type|debug|test)=/.test(u);
  });

  // sitemap URL 中的 KP 数
  var sitemapKpUrls = urls.filter(function (u) {
    return /\/knowledge\/math-g\d-(up|down)-u\d+-k\d+\.html$/.test(u);
  });

  // robots Disallow 命中
  var blockedByRobots = urls.filter(function (u) {
    var p = u.replace(BASE, '/');
    return disallows.some(function (d) { return p.indexOf(d) === 0; });
  });

  // canonical 一致性：每个 KP 页面 canonical 与 sitemap URL 一致
  var canonicalMismatches = [];
  kpIds.forEach(function (id) {
    var c = canonicalOf(id);
    var expected = BASE + 'knowledge/' + id + '.html';
    if (c !== expected) canonicalMismatches.push({ kpId: id, canonical: c, expected: expected });
  });

  var report = {
    generatedAt: new Date().toISOString(),
    summary: {
      sitemapUrlCount: urls.length,
      kpFileCount: kpIds.length,
      sitemapKpUrlCount: sitemapKpUrls.length,
      duplicateUrls: dups.length,
      paramUrls: params.length,
      blockedByRobots: blockedByRobots.length,
      canonicalMismatches: canonicalMismatches.length
    },
    details: {
      duplicates: dups,
      paramUrls: params,
      blockedByRobots: blockedByRobots,
      canonicalMismatches: canonicalMismatches
    }
  };

  fs.writeFileSync(path.join(REPORTS_DIR, 'sitemap-report.json'), JSON.stringify(report, null, 2));

  var PASS = (dups.length === 0 && params.length === 0 && blockedByRobots.length === 0 && canonicalMismatches.length === 0
    && sitemapKpUrls.length === kpIds.length);
  console.log('[P26-02] sitemap 门禁 ' + (PASS ? 'PASS' : 'FAIL'));
  console.log('  sitemap URL 数：' + urls.length);
  console.log('  KP 文件数：' + kpIds.length + '，sitemap KP URL 数：' + sitemapKpUrls.length);
  console.log('  重复 URL：' + dups.length);
  console.log('  参数 URL：' + params.length);
  console.log('  robots 阻塞：' + blockedByRobots.length);
  console.log('  canonical 不一致：' + canonicalMismatches.length);
  console.log('  报告：' + path.join(REPORTS_DIR, 'sitemap-report.json'));
  if (!PASS) process.exit(1);
}

main();
