#!/usr/bin/env node
/**
 * dev/p28/check-ai-agent-crawl.js — P28-36 AI Agent 抓取最终测试（只读）
 *
 * 模拟「不执行 JavaScript」的 AI Agent 抓取：真实 HTTP GET → 解析 HTML 中的 <a href> →
 * 沿链接图发现 knowledge 页 → 到达 practice。
 *   GET → HTML → link → knowledge → practice
 *
 * 对 375 个官方 KP 页逐一要求：
 *   1. 375/375 可发现：从入口（index.html）仅靠静态 href 链接图可达（不执行任何 JS）
 *   2. 375/375 可读取：GET 200 且服务端已含可读正文（名称 + 释义），无需 JS 渲染
 *   3. 375/375 identity 正确：canonical / 知识点 ID / h1 名称 与 KBL 事实一致
 *
 * 运行： node dev/p28/check-ai-agent-crawl.js
 * 退出码：0 = 通过；1 = 违约（输出清单）。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://home.modouyu.top/';
const KP_PATH_RE = /^knowledge\/(math-g\d-(up|down)-u\d+-k\d+)\.html$/;
const HREF_RE = /href\s*=\s*["']([^"']+)["']/gi;

function read(p) { return fs.readFileSync(p, 'utf8'); }

function kpFacts() {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const KC = global.KnowledgeContext;
  const map = new Map();
  for (let g = 1; g <= 6; g++) {
    (KC.selectable({ grade: g }) || []).forEach((k) => {
      map.set(k.knowledgeId, { name: k.name, definition: k.definition || '' });
    });
  }
  return map;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.on('error', reject);
  });
}

function httpGet(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/' + pathname, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, redirect: res.headers.location || null, body }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout ' + pathname)));
  });
}

// 解析 <a href>，解析为站内相对路径（去 query/hash）；仅保留 .html 站内链接
function extractLinks(html, fromPath) {
  const out = [];
  let m;
  HREF_RE.lastIndex = 0;
  while ((m = HREF_RE.exec(html)) !== null) {
    let href = m[1].trim();
    if (!href || href.startsWith('#') || /^(mailto:|javascript:|tel:)/i.test(href)) continue;
    if (/^https?:\/\//i.test(href)) {
      if (!href.startsWith(BASE) && !href.startsWith('http://127.0.0.1')) continue;
    }
    let pathname;
    try {
      const u = new URL(href, 'http://127.0.0.1/' + fromPath);
      pathname = u.pathname.replace(/^\//, '');
    } catch (e) { continue; }
    if (!/\.html$/.test(pathname)) continue;
    out.push(pathname);
  }
  return out;
}

async function main() {
  const facts = kpFacts();
  const violations = [];
  const port = await freePort();
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });

  try {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try { const r = await httpGet(port, 'index.html'); if (r.status === 200) break; } catch (e) {}
      await new Promise((r) => setTimeout(r, 150));
    }

    // ---- 仅靠静态链接图 BFS（不执行 JS）----
    const visited = new Set();
    const queue = ['index.html'];
    const kpDiscovered = new Set();
    const practiceFromKp = new Set();
    let reachedPractice = false;

    while (queue.length) {
      const p = queue.shift();
      if (visited.has(p)) continue;
      visited.add(p);

      const res = await httpGet(port, p);
      if (res.status !== 200) { violations.push(`✗ 发现路径上 HTTP ${res.status}：${p}`); continue; }
      if (res.redirect) violations.push(`✗ 发现路径上 redirect：${p} → ${res.redirect}`);

      const isKp = KP_PATH_RE.test(p);
      if (isKp) {
        kpDiscovered.add(p);
        const id = p.match(KP_PATH_RE)[1];
        const fact = facts.get(id);
        // 可读取：服务端正文含名称 + 释义（无需 JS）
        if (!res.body.includes(fact.name)) violations.push(`✗ 不可读取（正文缺名称）：${p}`);
        if (fact.definition && !res.body.includes(fact.definition.slice(0, 24))) violations.push(`✗ 不可读取（正文缺释义）：${p}`);
        // identity：canonical / 知识点 ID / h1
        const canonical = (res.body.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*/) || [])[1];
        if (canonical !== BASE + p) violations.push(`✗ identity：canonical 不符 ${p} → ${canonical || '(无)'}`);
        if (!res.body.includes('知识点 ID：' + id)) violations.push(`✗ identity：知识点 ID 标记不符 ${p}`);
        const h1 = (res.body.match(/<h1>([^<]*)<\/h1>/) || [])[1];
        if (h1 !== fact.name) violations.push(`✗ identity：h1 名称不符 ${p} → ${h1 || '(无)'} ≠ ${fact.name}`);
      }
      if (p === 'practice.html') reachedPractice = true;

      extractLinks(res.body, p).forEach((n) => {
        if (n === 'practice.html' && isKp) practiceFromKp.add(p);
        if (!visited.has(n)) queue.push(n);
      });
    }

    // ---- 375/375 可发现 ----
    const officialPaths = new Set([...facts.keys()].map((id) => 'knowledge/' + id + '.html'));
    const missing = [...officialPaths].filter((p) => !kpDiscovered.has(p));
    const extra = [...kpDiscovered].filter((p) => !officialPaths.has(p));
    if (missing.length) violations.push(`✗ 不可发现 ${missing.length}/${officialPaths.size}：${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ' …' : ''}`);
    if (extra.length) violations.push(`✗ 发现非官方 KP 页：${extra.slice(0, 8).join(', ')}`);

    // ---- 到 practice 的链路 ----
    if (!reachedPractice) violations.push('✗ 链接图未能到达 practice.html（GET→HTML→link→practice 断裂）');
    const kpReached = [...kpDiscovered];
    const kpWithoutPractice = kpReached.filter((p) => !practiceFromKp.has(p));
    if (kpWithoutPractice.length) violations.push(`✗ ${kpWithoutPractice.length} 个 KP 页无 →practice 链接：${kpWithoutPractice.slice(0, 5).join(', ')} …`);

    if (violations.length) {
      console.error('❌ P28-36 AI Agent 抓取最终测试违约（' + violations.length + ' 项）：');
      violations.slice(0, 40).forEach((v) => console.error('  ' + v));
      if (violations.length > 40) console.error('  …（其余 ' + (violations.length - 40) + ' 项省略）');
      process.exit(1);
    }
    console.log(`✅ P28-36 AI Agent 抓取（不执行 JS）：375/375 可发现 · 375/375 可读取 · 375/375 identity 正确；` +
      `入口 index.html 仅靠静态链接图可达全部 KP 与 practice（链：GET→HTML→link→knowledge→practice）。共抓取 ${visited.size} 页。`);
  } finally {
    srv.kill('SIGKILL');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });