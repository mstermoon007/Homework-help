#!/usr/bin/env node
/**
 * dev/p28/check-seo-ai-history-isolation.js — P28-34 SEO/AI 历史数据隔离门禁（只读）
 *
 * 目标：AI/爬虫/搜索引擎只能把「正式发布知识页面」当作产品知识源。
 * 历史/迁移/审计/辅助目录（archive/ migration/ audit-results/ .trae/ test/ dev/）必须：
 *   1. 不进 sitemap
 *   2. 不进入任何内部公开导航（首页/题型选择/练习页/knowledge 页面链接）
 *   3. robots.txt 明确 Disallow；目录内历史 html 一律 noindex（防直链收录）
 *   4. llms.txt 不得把六目录当知识资源引用（只可能出现在技术文档来源声明）
 *
 * 运行： node dev/p28/check-seo-ai-history-isolation.js
 * 退出码：0 = 隔离开；1 = 泄漏（输出清单）。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// 需隔离的工程目录（历史/迁移/审计/AI 辅助/测试/开发）
const ISOLATED = ['archive', 'migration', 'audit-results', '.trae', 'test', 'dev'];
const ISOLATED_PATTERN = new RegExp('(^|/)\\b(' + ISOLATED.map(esc).join('|') + ')(/|$)', 'i');

function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function read(p) { return fs.readFileSync(p, 'utf8'); }
function listDir(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !/^(node_modules|\.git)$/.test(e.name)) listDir(p, out);
    else out.push(p);
  });
  return out;
}

// A) sitemap 隔离 + 官方单源（B) 复用 official 集合）
function officialKnowledgeIds() {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const KC = global.KnowledgeContext;
  const ids = [];
  for (let g = 1; g <= 6; g++) {
    (KC.selectable({ grade: g }) || []).forEach((k) => ids.push(k.knowledgeId));
  }
  return ids;
}

function parseSitemap() {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const urls = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].replace(/^https?:\/\/[^/]+/, '');
    urls.push(u.startsWith('/') ? u.slice(1) : u);
  }
  return urls;
}

function main() {
  const violations = [];
  const sitemap = parseSitemap();
  const officialKP = new Set(officialKnowledgeIds());
  const topOfficial = new Set(['index.html', 'math-types.html', 'subject-types.html', 'practice.html', 'faq.html', 'select.html', 'contact.html']);

  // A) sitemap 不得含六目录；知识页必须 ∈ 官方投影（KBL 375 + 索引）
  if (!sitemap.length) violations.push('✗ sitemap.xml 为空或无法解析');
  sitemap.forEach((p) => {
    if (ISOLATED_PATTERN.test(p)) violations.push(`✗ sitemap 泄漏历史目录：${p}`);
    const kp = p.match(/^knowledge\/(.+)$/);
    if (kp) {
      const id = kp[1].replace(/\.html$/, '');
      if (id !== 'knowledge-index' && !officialKP.has(id)) violations.push(`✗ sitemap 含非官方知识页：${p}`);
    } else if (!topOfficial.has(p)) {
      violations.push(`✗ sitemap 含非官方页面：${p}`);
    }
  });

  // B) robots.txt 必须 Disallow 六目录
  const robots = read(path.join(ROOT, 'robots.txt'));
  ISOLATED.forEach((d) => {
    if (!robots.includes('Disallow: /' + d + '/')) violations.push(`✗ robots.txt 缺少 /${d}/ Disallow`);
  });

  // C) 内部公开导航不得链接六目录（顶层页 + knowledge 页）
  const publicHtml = fs.readdirSync(ROOT).filter((f) => /\.html$/.test(f)).map((f) => f);
  fs.readdirSync(path.join(ROOT, 'knowledge')).filter((f) => /\.html$/.test(f)).forEach((f) => publicHtml.push(path.join('knowledge', f)));
  publicHtml.forEach((f) => {
    if (!fs.existsSync(path.join(ROOT, f))) return;
    const html = read(path.join(ROOT, f));
    const re = /(?:href|src)\s*=\s*["']([^"']+)["']/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const t = m[1];
      if (/^https?:/.test(t)) continue; // 外链不判
      const clean = t.replace(/^\.\.?\/+/, '');
      if (ISOLATED_PATTERN.test(clean)) violations.push(`✗ 内部导航泄漏：${f} → ${t}`);
    }
  });

  // D) llms.txt 不得把六目录当知识资源引用（路径级）
  const llms = read(path.join(ROOT, 'llms.txt'));
  ISOLATED_PATTERN.lastIndex = 0;
  const llmsIsolated = llms.split('\n').filter((ln) => /\]\(([^)]*?)\b(archive|migration|audit-results|\.trae|test|dev)\//.test(ln) || /\]\(\.?\/(archive|migration|audit-results|\.trae)\//.test(ln));
  if (llmsIsolated.length) violations.push('✗ llms.txt 引用隔离目录：\n    ' + llmsIsolated.join('\n    '));

  // E) 隔离目录内历史 html 一律 noindex；knowledge/ 无混入历史页
  ISOLATED.forEach((d) => {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) return;
    listDir(dir, []).forEach((fp) => {
      if (!/\.html$/.test(fp)) return;
      const src = read(fp);
      if (!/content=["']noindex/.test(src)) violations.push(`✗ 隔离目录内 html 缺 noindex：${path.relative(ROOT, fp)}`);
    });
  });
  const knowledgeFiles = fs.readdirSync(path.join(ROOT, 'knowledge'));
  knowledgeFiles.forEach((f) => {
    if (/\.html$/.test(f)) {
      const id = f.replace(/\.html$/, '');
      if (id !== 'knowledge-index' && !officialKP.has(id)) violations.push(`✗ knowledge/ 混入历史/非官方页：${f}`);
    } else if (f !== 'knowledge-index.json') {
      violations.push(`✗ knowledge/ 混入非产物文件：${f}`);
    }
  });

  if (violations.length) {
    console.error('❌ P28-34 SEO/AI 历史数据隔离破损（' + violations.length + ' 项）：');
    violations.forEach((v) => console.error('  ' + v));
    process.exit(1);
  }
  console.log('✅ P28-34 SEO/AI 历史数据隔离完好：' + sitemap.length + ' 条 sitemap 全为官方页面（' +
    officialKP.size + ' KP + 索引）；六目录不进 sitemap/内部导航/llms 知识源，robots 全 Disallow，历史 html 全 noindex。' +
    'AI 知识源单点 = 正式发布知识页面。');
}

main();