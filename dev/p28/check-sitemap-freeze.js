#!/usr/bin/env node
/**
 * dev/p28/check-sitemap-freeze.js — P28-35 sitemap 最终冻结门禁（只读）
 *
 * 冻结契约：sitemap = 375 KP（KBL Runtime selectable 精确集合）+ 官方公共页面
 *           （index / math-types / subject-types / select / practice / faq），
 *            且仅此集合（无遗漏、无多余、无重复、无参数/历史 URL）。
 * 逐一验证每个 URL：
 *   1. HTTP 200（本地真实 HTTP 服务；python3 -m http.server 同 e2e 口径）
 *   2. 无 redirect（响应不得带 Location / 3xx）
 *   3. 实际存在（对应静态文件存在且响应体非空）
 *   4. canonical 与 sitemap URL 完全一致
 *
 * 运行： node dev/p28/check-sitemap-freeze.js
 * 退出码：0 = 冻结成立；1 = 违约（输出清单）。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const net = require('net');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://home.modouyu.top/';

const TOP_OFFICIAL = ['index.html', 'math-types.html', 'subject-types.html', 'select.html', 'practice.html', 'faq.html'];
const KP_RE = /^knowledge\/(math-g\d-(up|down)-u\d+-k\d+)\.html$/;

function read(p) { return fs.readFileSync(p, 'utf8'); }

function officialKpIds() {
  require(path.join(ROOT, 'dev', '_bundle-env.js'));
  const KC = global.KnowledgeContext;
  const ids = [];
  for (let g = 1; g <= 6; g++) {
    (KC.selectable({ grade: g }) || []).forEach((k) => ids.push(k.knowledgeId));
  }
  return ids.sort();
}

function parseSitemap() {
  const xml = read(path.join(ROOT, 'sitemap.xml'));
  const out = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const u = m[1].trim();
    if (u.startsWith(BASE)) out.push(u.slice(BASE.length));
    else out.push(u.replace(/^https?:\/\/[^/]+\//, ''));
  }
  return out;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const p = srv.address().port;
      srv.close(() => resolve(p));
    });
    srv.on('error', reject);
  });
}

function httpGet(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/' + pathname, agent: false }, (res) => {
      let body = '';
      let redirect = null;
      if (res.headers.location) redirect = res.headers.location;
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, redirect, bytes: Buffer.byteLength(body) }));
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout ' + pathname)));
  });
}

async function main() {
  const violations = [];
  const urls = parseSitemap();
  const kpOfficial = new Set(officialKpIds());
  const expectedCount = TOP_OFFICIAL.length + kpOfficial.size + 1; // + knowledge-index.html

  // ---- 1. 组成冻结 ----
  if (urls.length !== expectedCount) {
    violations.push(`✗ sitemap 总数 ${urls.length} ≠ 官方冻结 ${expectedCount}（${TOP_OFFICIAL.length} 公共页 + ${kpOfficial.size} KP + 索引）`);
  }
  const seen = new Map();
  urls.forEach((p) => { seen.set(p, (seen.get(p) || 0) + 1); });
  seen.forEach((c, p) => { if (c > 1) violations.push(`✗ sitemap 重复：${p}（×${c}）`); });
  urls.forEach((p) => {
    const kp = p.match(KP_RE);
    if (kp) {
      if (!kpOfficial.has(kp[1])) violations.push(`✗ sitemap 含非官方 KP：${p}`);
    } else if (p === 'knowledge/knowledge-index.html') {
      // ok
    } else if (TOP_OFFICIAL.includes(p)) {
      // ok
    } else {
      violations.push(`✗ sitemap 含冻结集外页面：${p}`);
    }
  });
  // 官方 KP 不得在 sitemap 中缺失
  kpOfficial.forEach((id) => {
    if (!seen.has('knowledge/' + id + '.html')) violations.push(`✗ 官方 KP 缺失于 sitemap：${id}`);
  });
  TOP_OFFICIAL.forEach((f) => { if (!seen.has(f)) violations.push(`✗ 官方公共页缺失于 sitemap：${f}`); });
  if (!seen.has('knowledge/knowledge-index.html')) violations.push('✗ knowledge-index.html 缺失于 sitemap');

  // ---- 2/3/4. 逐一：实际存在 + canonical + HTTP 200 + 无 redirect ----
  for (const p of urls) {
    const fp = path.join(ROOT, p);
    if (!fs.existsSync(fp)) { violations.push(`✗ 文件不存在：${p}`); continue; }
    const html = read(fp);
    const canonical = (html.match(/<link\s+rel="canonical"\s+href="([^"]*)"\s*/)) || (html.match(/<link\s+rel="canonical"[^>]*href="([^"]*)"/));
    if (!canonical || canonical[1] !== BASE + p) violations.push(`✗ canonical 不一致/缺失：${p} → ${(canonical && canonical[1]) || '(无)'}`);
  }

  const port = await freePort();
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  try {
    // 等待服务就绪（e2e 同口径）
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        const probe = await httpGet(port, 'index.html');
        if (probe.status === 200) break;
      } catch (e) { /* 未就绪，重试 */ }
      await new Promise((r) => setTimeout(r, 150));
    }
    for (const p of urls) {
      const r = await httpGet(port, p);
      if (r.status !== 200) violations.push(`✗ HTTP ${r.status}（非 200）：${p}`);
      if (r.redirect) violations.push(`✗ redirect 到 ${r.redirect}：${p}`);
      if (r.bytes === 0) violations.push(`✗ 响应体为空：${p}`);
    }
  } finally {
    srv.kill('SIGKILL');
  }

  if (violations.length) {
    console.error('❌ P28-35 sitemap 最终冻结违约（' + violations.length + ' 项）：');
    violations.forEach((v) => console.error('  ' + v));
    process.exit(1);
  }
  console.log(`✅ P28-35 sitemap 最终冻结成立：${urls.length} 条 = ${TOP_OFFICIAL.length} 公共页 + ${kpOfficial.size} KP + 索引；` +
    '逐一 HTTP 200、无 redirect、文件存在、canonical 一致。');
}

main().catch((e) => { console.error(e); process.exit(1); });