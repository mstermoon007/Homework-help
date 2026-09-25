#!/usr/bin/env node
'use strict';

/**
 * dev/e2e/browser-e2e.js — P12 真实浏览器 E2E 驱动器（dev-only，无第三方依赖）
 *
 * 方案：python3 静态服务器 + 本机 Chrome headless + CDP（Node ≥22 内置 WebSocket）。
 * 观测点：页面内包装唯一生成入口 GenerationAPI.generate（记录 Request/Result/题目归属），
 *         读取 DOM 渲染结果与错误；不进入生产链、不新增运行时架构。
 *
 * 用法：
 *   node dev/e2e/browser-e2e.js p12-01        # P12-01 场景集
 *   node dev/e2e/browser-e2e.js url "<path>"  # 单 URL 调试
 */

const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

// 浏览器查找顺序：CHROME_BIN → PATH(chrome → chromium → chromium-browser)
// 禁止硬编码开发者机器路径（如 macOS .app 包内可执行文件全路径）。
function resolveChrome() {
  const candidates = [];
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  candidates.push('chrome', 'chromium', 'chromium-browser');
  for (const c of candidates) {
    try {
      if (path.isAbsolute(c)) {
        if (fs.existsSync(c)) return c;
      } else {
        const found = execSync('command -v ' + c + ' 2>/dev/null', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
        if (found) return found;
      }
    } catch (e) { /* 尝试下一个候选 */ }
  }
  throw new Error('E2E: 未找到 Chrome/Chromium。请设置 CHROME_BIN 环境变量，或将 chrome/chromium/chromium-browser 置于 PATH。');
}
const CHROME = resolveChrome();
const HTTP_PORT = 8123;
let CDP_PORT = 0;
let CHROME_USER_DIR = '';

// CDP HTTP：agent:false 禁用 keep-alive（规避 undici 连接复用断言）
function httpJson(url, method) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: method || 'GET', agent: false }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(body) }); }
        catch (e) { resolve({ status: res.statusCode, json: null, body: body }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ }
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout: ' + label);
    await sleep(150);
  }
}

function startServer() {
  const p = spawn('python3', ['-m', 'http.server', String(HTTP_PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  return p;
}

function startChrome() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hh-e2e-'));
  CHROME_USER_DIR = dir;
  const p = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--mute-audio',
    '--remote-debugging-port=0',
    '--user-data-dir=' + dir,
    'about:blank'
  ], { stdio: 'ignore', detached: true });
  p._userDataDir = dir;
  return p;
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', (e) => reject(new Error('ws error')));
  });
  function send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  async function evaluate(expression, awaitPromise) {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, awaitPromise: awaitPromise !== false, returnByValue: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('cdp eval timeout')), 20000))
    ]);
    if (r.exceptionDetails) throw new Error('page eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  }
  return { ready, send, evaluate, close: () => ws.close() };
}

const HOOK_SOURCE = `
(function () {
  window.__e2e = { calls: [], errors: [], installed: false, via: [] };
  window.addEventListener('error', function (e) { window.__e2e.errors.push(String((e && e.message) || e)); });

  function record(via, req, opts, promise) {
    var call = { via: via, req: null, opts: null, t0: performance.now() };
    try {
      call.req = JSON.parse(JSON.stringify({
        subject: req.subject, grade: req.grade, count: req.count, difficulty: req.difficulty,
        questionTypes: req.questionTypes || (req.questionType ? [req.questionType] : null),
        knowledgePointIds: req.knowledgePointIds || (req.knowledgePointId ? [req.knowledgePointId] : null),
        mode: req.mode
      }));
    } catch (e) { call.req = { err: String(e) }; }
    call.opts = { hasPrevSeen: !!(opts && opts.previousSeenKeys), previousGenerationId: (opts && opts.previousGenerationId) || null };
    window.__e2e.calls.push(call);
    return Promise.resolve(promise).then(function (r) {
      call.t1 = performance.now();
      try {
        call.result = {
          status: r.status, producedCount: r.producedCount, requestedCount: r.requestedCount,
          generationId: r.generationId,
          ledger: r.orchestration ? {
            req: r.orchestration.requestedCount, planned: r.orchestration.plannedCount,
            gen: r.orchestration.generatedCount, final: r.orchestration.finalCount,
            reason: r.orchestration.reason, coverage: r.orchestration.coverageStatus,
            outOfScope: r.orchestration.outOfScopeDropped, recovered: r.orchestration.budgetRecovered
          } : null,
          // FINAL-64：全链产品验收——捕获各层可观测证据（非仅 API 边界 status/produced）
          plans: (r.plans || []).length,                                  // Strategy 层产出（plan 数）
          planKeys: (r.plans && r.plans[0]) ? Object.keys(r.plans[0]).slice(0, 10) : [],
          failedPlans: (r.failedPlans || []).length,                     // Validator 层（失败计划数）
          htmlPresent: typeof r.html === 'string' && r.html.length > 0,   // Presentation 层渲染产物
          questions: (r.questions || []).map(function (q) {
            return {
              type: q.questionType, kp: (q.knowledgePointIds || [q.knowledgePointId])[0],
              difficulty: q.difficulty, fp: q.questionFingerprint,
              // SemanticQuestion 层契约字段存在性（FINAL-32d：semanticTarget 注入）
              hasAnswer: q.answer != null,
              hasPrompt: !!(q.question || q.prompt),
              semanticTarget: q.semanticTarget != null
            };
          })
        };
      } catch (e) { call.result = { err: String(e) }; }
      return r;
    });
  }

  function installOn(target, via) {
    if (!target || typeof target.generate !== 'function' || target.generate.__e2e) return;
    var orig = target.generate;
    var wrapped = function (req, opts) { return record(via, req, opts, orig.apply(this, arguments)); };
    wrapped.__e2e = true;
    try { target.generate = wrapped; } catch (e) {}
    window.__e2e.installed = true;
    window.__e2e.via.push(via);
  }

  ['GenerationAPI', 'GenerationEngine'].forEach(function (name) {
    var val;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        get: function () { return val; },
        set: function (v) { val = v; installOn(v, name); }
      });
    } catch (e) { /* ignore */ }
  });

  var t = setInterval(function () {
    installOn(window.GenerationAPI, 'GenerationAPI');
    installOn(window.GenerationEngine, 'GenerationEngine');
    if (window.__e2e.installed) clearInterval(t);
  }, 10);
})();
`;

async function runScenario(urlPath, opts) {
  opts = opts || {};
  const targetRes = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
  const target = targetRes.json;
  const c = cdpClient(target.webSocketDebuggerUrl);
  await c.ready;
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SOURCE });
  await c.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + urlPath });

  await waitFor(async () => c.evaluate('!!(window.__e2e && window.__e2e.installed)', false), 15000, 'hook install');
  const firstCount = opts.expectCalls || 1;
  await waitFor(async () => {
    const n = await c.evaluate('(window.__e2e && window.__e2e.calls.length) || 0', false);
    if (n < firstCount) return false;
    return await c.evaluate('!!(window.__e2e.calls[' + (firstCount - 1) + '] && window.__e2e.calls[' + (firstCount - 1) + '].result)', false);
  }, opts.timeoutMs || 60000, 'generation result');

  // 等待渲染稳定
  await sleep(opts.settleMs || 500);
  const data = await c.evaluate(`(function () {
    var e = window.__e2e;
    var area = document.getElementById('problemsArea');
    var noticeEl = area ? area.querySelector('.notice .big') : null;
    var grid = area ? area.querySelector('.questions-grid') : null;
    var cards = grid ? grid.querySelectorAll('.question-card').length : (area ? area.querySelectorAll('.question-card').length : 0);
    var measure = area ? area.querySelectorAll('#printMeasure .question-card').length : 0;
    var answers = area ? area.querySelectorAll('.answer-inp, .choice-option, .question-answer').length : 0;
    return {
      calls: e.calls,
      errors: e.errors,
      dom: {
        cards: cards,
        measureCards: measure,
        answers: answers,
        notice: noticeEl ? noticeEl.textContent : '',
        printDisabled: !!(document.getElementById('printBtn') && document.getElementById('printBtn').disabled),
        title: (document.getElementById('sheetTitle') || {}).textContent || '',
        genProgressHidden: !!(document.getElementById('genProgress') && document.getElementById('genProgress').hidden),
        genProgressText: (document.getElementById('genProgressText') || {}).textContent || ''
      }
    };
  })()`, false);

  // 交互场景（可选）：重新生成 / 刷新后重新生成 / 打印
  if (opts.action === 'regenerate') {
    // 完整闭环：Practice → Finish(check) → Result → Regenerate
    await c.evaluate(`(function(){ var cb = document.getElementById('checkBtn'); if (cb) cb.click(); return true; })()`, false);
    await waitFor(async () => c.evaluate(`!!document.getElementById('redoAllBtn')`, false), 15000, 'redo button');
    await c.evaluate(`document.getElementById('redoAllBtn').click()`, false);
    await waitFor(async () => {
      const n = await c.evaluate('window.__e2e.calls.length', false);
      if (n < 2) return false;
      return await c.evaluate('!!window.__e2e.calls[1].result', false);
    }, 60000, 'regenerate result');
    await sleep(400);
    data.calls = await c.evaluate('window.__e2e.calls', false);
    data.dom = await c.evaluate(`(function(){var a=document.getElementById('problemsArea');return {cards:a?a.querySelectorAll('.question-card').length:0, notice:(a&&a.querySelector('.notice .big'))?a.querySelector('.notice .big').textContent:''};})()`, false);
  }
  if (opts.action === 'reload') {
    data.beforeReload = data.calls.slice();
    await c.send('Page.reload', { ignoreCache: false });
    await waitFor(async () => c.evaluate('!!(window.__e2e && window.__e2e.calls.length && window.__e2e.calls[0].result)', false), 60000, 'reload regenerate');
    await sleep(400);
    data.calls = await c.evaluate('window.__e2e.calls', false);
  }

  c.close();
  return data;
}

function summarize(data) {
  const call = data.calls[data.calls.length - 1];
  const r = call.result || {};
  const types = {};
  (r.questions || []).forEach((q) => { types[q.type] = (types[q.type] || 0) + 1; });
  const kps = {};
  (r.questions || []).forEach((q) => { kps[q.kp] = (kps[q.kp] || 0) + 1; });
  const uniqFp = new Set((r.questions || []).map((q) => q.fp).filter(Boolean)).size;
  return {
    status: r.status,
    ledger: r.ledger,
    produced: (r.questions || []).length,
    unique: uniqFp,
    types: types,
    kps: kps,
    domCards: data.dom && data.dom.cards,
    notice: data.dom && data.dom.notice,
    genProgress: data.dom ? { hidden: data.dom.genProgressHidden, text: data.dom.genProgressText } : null,
    printDisabled: data.dom && data.dom.printDisabled,
    errors: data.errors,
    calls: data.calls.length
  };
}

async function main() {
  const mode = process.argv[2] || 'p12-01';
  const server = startServer();
  const chrome = startChrome();
  const cleanup = () => {
    try { process.kill(-chrome.pid, 'SIGKILL'); } catch (e) { try { chrome.kill('SIGKILL'); } catch (e2) {} }
    try { server.kill('SIGKILL'); } catch (e) {}
    try { if (CHROME_USER_DIR) execSync('rm -rf ' + JSON.stringify(CHROME_USER_DIR)); } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  try {
    const portFile = path.join(CHROME_USER_DIR, 'DevToolsActivePort');
    await waitFor(async () => fs.existsSync(portFile), 15000, 'DevToolsActivePort');
    CDP_PORT = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    await waitFor(async () => { const r = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/version'); return r.status === 200; }, 15000, 'chrome cdp');
    await waitFor(async () => { const r = await httpJson('http://127.0.0.1:' + HTTP_PORT + '/practice.html'); return r.status === 200; }, 10000, 'http server');

    if (mode === 'url') {
      const data = await runScenario(process.argv[3], {});
      console.log(JSON.stringify({ summary: summarize(data), raw: data }, null, 2));
      return;
    }

    if (mode === 'debug') {
      const targetRes = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
      const target = targetRes.json;
      const c = cdpClient(target.webSocketDebuggerUrl);
      await c.ready;
      await c.send('Page.enable');
      await c.send('Runtime.enable');
      await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SOURCE });
      await c.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + process.argv[3] });
      await sleep(8000);
      const dump = await c.evaluate(`(function(){
        var area = document.getElementById('problemsArea');
        var e = window.__e2e || {};
        return {
          installed: !!e.installed, calls: (e.calls||[]).length, errors: e.errors || [],
          wrapped: (window.GenerationAPI && typeof window.GenerationAPI.generate === 'function') ? String(window.GenerationAPI.generate).indexOf('__e2e') !== -1 : null,
          geWrapped: (window.GenerationEngine && typeof window.GenerationEngine.generate === 'function') ? String(window.GenerationEngine.generate).indexOf('__e2e') !== -1 : null,
          hasKC: !!window.KnowledgeContext, hasBridge: !!window.PracticeBridge,
          hasAPI: !!window.GenerationAPI,
          kpCount: (window.KnowledgeContext && window.KnowledgeContext.poolKpIds) ? window.KnowledgeContext.poolKpIds({subject:'math',grade:2}).length : -1,
          notice: area ? area.innerText.slice(0,200) : '',
          cards: area ? area.querySelectorAll('.question-card').length : -1,
          cardDetail: area ? Array.from(area.querySelectorAll('.question-card')).map(function(c){return {i:c.getAttribute('data-index'), p:(c.parentElement&&(c.parentElement.id||c.parentElement.className||'')).toString().slice(0,40), vis: c.offsetParent !== null};}).slice(0,8) : [],
          cardParents: area ? Array.from(new Set(Array.from(area.querySelectorAll('.question-card')).map(function(c){return (c.parentElement&&(c.parentElement.id||c.parentElement.className||'')).toString().slice(0,40);}))).slice(0,8) : [],
          grouped: area ? (function(){ var g={}; area.querySelectorAll('.question-card').forEach(function(c){ var k=((c.parentElement&&(c.parentElement.id||c.parentElement.className||'?'))||'?').toString(); g[k]=(g[k]||0)+1; }); return g; })() : {},
          anonSample: area ? (function(){ var out=[]; area.querySelectorAll('.question-card').forEach(function(c){ if(out.length<2 && !(c.parentElement&&(c.parentElement.id||c.parentElement.className))){ var chain=[]; var n=c; while(n && n!==area){ chain.push((n.tagName||'')+((n.id)?'#'+n.id:'')+((n.className)?'.'+String(n.className).split(' ')[0]:'')); n=n.parentElement; } out.push({chain:chain.join(' < '), html:c.outerHTML.slice(0,160)}); } }); return out; })() : [],
          totalAreaCards: area ? area.querySelectorAll('.question-card').length : -1,
          bodyCards: document.querySelectorAll('.question-card').length
        };
      })()`, false);
      console.log(JSON.stringify(dump, null, 2));
      c.close();
      return;
    }

    if (mode === 'p12-01') {
      const A = 'math-g2-down-u02-k001';
      const B = 'math-g2-down-u01-k001';
      const scenarios = [
        { name: 'S1 1type×1kp', url: '/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=10&difficulty=5' },
        { name: 'S2 Ntype×1kp', url: '/practice.html?subject=math&grade=2&kps=' + A + '&types=calc,fill&count=10&difficulty=5' },
        { name: 'S3 1type×Nkp', url: '/practice.html?subject=math&grade=2&kps=' + A + ',' + B + '&types=calc&count=10&difficulty=5' },
        { name: 'S4 Ntype×Nkp', url: '/practice.html?subject=math&grade=2&kps=' + A + ',' + B + '&types=calc,fill&count=12&difficulty=5' }
      ];
      const out = [];
      let failed = 0;
      for (const sc of scenarios) {
        const data = await runScenario(sc.url, {});
        const s = summarize(data);
        const req = data.calls[0].req || {};
        const selKps = req.knowledgePointIds || [];
        const selTypes = req.questionTypes || [];
        const checks = {
          'request.count': req.count,
          'request.difficulty': req.difficulty,
          'request.types ⊆ selected': (s.types && Object.keys(s.types).every((t) => selTypes.indexOf(t) !== -1)),
          'request.kps ⊆ selected': (s.kps && Object.keys(s.kps).every((k) => selKps.indexOf(k) !== -1)),
          'unique = produced': s.unique === s.produced,
          'domCards = produced': s.domCards === s.produced,
          'no JS errors': (s.errors || []).length === 0,
          'status SUCCESS': s.status === 'SUCCESS'
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true || k.indexOf('request.') === 0);
        if (!ok) failed++;
        out.push({ scenario: sc.name, ok: ok, summary: s, checks: checks, request: req });
      }
      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    if (mode === 'p12-02') {
      const A = 'math-g2-down-u02-k001';
      const B = 'math-g2-down-u01-k001';
      const T6 = 'calc,fill,choice,judge,geometry,apply';
      const scenarios = [
        { name: 'T6×1kp', url: '/practice.html?subject=math&grade=2&kps=' + A + '&types=' + T6 + '&count=12&difficulty=5' },
        { name: 'T6×2kp', url: '/practice.html?subject=math&grade=2&kps=' + A + ',' + B + '&types=' + T6 + '&count=12&difficulty=5' }
      ];
      const out = []; let failed = 0;
      for (const sc of scenarios) {
        const data = await runScenario(sc.url, {});
        const s = summarize(data);
        const req = data.calls[0].req || {};
        const selT = req.questionTypes || []; const selK = req.knowledgePointIds || [];
        const L = s.ledger || {};
        const checks = {
          'types ⊆ selected': Object.keys(s.types).every((t) => selT.indexOf(t) !== -1),
          'kps ⊆ selected': Object.keys(s.kps).every((k) => selK.indexOf(k) !== -1),
          'unique = produced': s.unique === s.produced,
          'domCards = produced': s.domCards === s.produced,
          'req ≥ planned ≥ gen = final': L.req >= L.planned && L.planned >= L.gen && L.gen === L.final,
          'no JS errors': (s.errors || []).length === 0,
          'deliverable (SUCCESS|PARTIAL)': s.status === 'SUCCESS' || s.status === 'PARTIAL'
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: sc.name, ok: ok, summary: s, checks: checks });
      }
      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    if (mode === 'p12-03') {
      const A = 'math-g2-down-u02-k001';
      const out = []; let failed = 0;
      for (const d of [1, 3, 5, 7, 10]) {
        const data = await runScenario('/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=10&difficulty=' + d, {});
        const s = summarize(data);
        const req = data.calls[0].req || {};
        const diffs = (data.calls[0].result.questions || []).map((q) => q.difficulty);
        const checks = {
          'request.difficulty = UI': req.difficulty === d,
          'all questions have difficulty 1..10': diffs.length > 0 && diffs.every((x) => typeof x === 'number' && x >= 1 && x <= 10),
          'unique = produced': s.unique === s.produced,
          'domCards = produced': s.domCards === s.produced,
          'no JS errors': (s.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: 'd=' + d, ok: ok, summary: s, checks: checks, actualDifficultyRange: diffs.length ? [Math.min.apply(null, diffs), Math.max.apply(null, diffs)] : null });
      }
      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    if (mode === 'p14-05') {
      const A = 'math-g2-down-u02-k001';
      const data = await runScenario('/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=20&difficulty=5', {});
      const call = data.calls[0] || {};
      const perf = await (async () => null)();
      // 资源与页面指标（在新 target 内重新评估）
      const targetRes = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/list');
      const metrics = {
        generationMs: call.t1 && call.t0 ? Math.round(call.t1 - call.t0) : null,
        scriptTags: 0, failedResources: [], resourceCount: 0, domNodes: 0
      };
      const targets = (targetRes.json || []).filter((t) => t.url && t.url.indexOf('practice.html') !== -1);
      if (targets.length) {
        const cc = cdpClient(targets[0].webSocketDebuggerUrl);
        await cc.ready;
        const m = await cc.evaluate(`(function(){
          var res = performance.getEntriesByType('resource');
          var failed = res.filter(function(r){ return r.responseStatus >= 400; }).map(function(r){ return r.name.split('/').pop() + ':' + r.responseStatus; });
          return {
            scriptTags: document.querySelectorAll('script[src]').length,
            resourceCount: res.length,
            failedResources: failed,
            domNodes: document.getElementsByTagName('*').length,
            navMs: (performance.timing && performance.timing.loadEventEnd && performance.timing.navigationStart) ? (performance.timing.loadEventEnd - performance.timing.navigationStart) : null
          };
        })()`, false);
        Object.assign(metrics, m);
        cc.close();
      }
      const real404 = metrics.failedResources.filter((f) => f.indexOf('favicon.ico') === -1);
      console.log(JSON.stringify({ mode: mode, metrics: metrics, real404: real404, jsErrors: (data.errors || []).length }, null, 2));
      process.exitCode = (real404.length === 0 && (data.errors || []).length === 0) ? 0 : 1;
      return;
    }

    if (mode === 'p13-02') {
      require(path.join(ROOT, 'dev', '_bundle-env.js'));
      const KC = global.KnowledgeContext;
      const picks = [];
      for (let g = 1; g <= 6; g++) {
        const list = KC.selectable({ grade: g });
        if (list.length) picks.push({ grade: g, kp: list[0].knowledgeId });
      }
      const out = []; let failed = 0;
      for (const pick of picks) {
        // 读取知识页真实 CTA（../practice.html?...）并解析为站点绝对路径
        const khtml = fs.readFileSync(path.join(ROOT, 'knowledge', pick.kp + '.html'), 'utf8');
        const m = khtml.match(/href="(\.\.\/practice\.html\?[^"]+)"/);
        const cta = m ? '/' + m[1].replace('../', '') : ('/practice.html?subject=math&grade=' + pick.grade + '&kps=' + pick.kp);
        const data = await runScenario(cta, {});
        const req = (data.calls[0] || {}).req || {};
        const result = (data.calls[0] || {}).result || {};
        const kpsOut = Array.from(new Set((result.questions || []).map((q) => q.kp)));
        const checks = {
          'request.kps = 深链 KP': JSON.stringify(req.knowledgePointIds) === JSON.stringify([pick.kp]),
          '题目 KP = 深链 KP': kpsOut.length > 0 && kpsOut.every((k) => k === pick.kp),
          '可交付': result.status === 'SUCCESS' || result.status === 'PARTIAL',
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: 'G' + pick.grade + ' ' + pick.kp, ok: ok, checks: checks, produced: (result.questions || []).length, status: result.status });
      }
      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    if (mode === 'p12-05') {
      const A = 'math-g2-down-u02-k001';
      const targetRes = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
      const target = targetRes.json;
      const cc = cdpClient(target.webSocketDebuggerUrl);
      await cc.ready;
      await cc.send('Page.enable'); await cc.send('Runtime.enable');
      await cc.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SOURCE + `
        window.__print = { opens: 0, writes: 0, prints: 0, lastHtml: '', errors: [] };
        var origOpen = window.open;
        window.open = function (url, name, features) {
          if (String(url) === '' && String(name) === '_blank') {
            window.__print.opens++;
            return {
              document: {
                write: function (h) { window.__print.writes++; window.__print.lastHtml += String(h); },
                close: function () {}
              },
              print: function () { window.__print.prints++; },
              focus: function () {}, close: function () {}
            };
          }
          return origOpen.apply(window, arguments);
        };
      ` });
      await cc.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=10&difficulty=5' });
      await waitFor(async () => cc.evaluate('!!(window.__e2e && window.__e2e.calls.length && window.__e2e.calls[0].result)', false), 60000, 'gen for print');
      await sleep(400);
      const before = await cc.evaluate('window.__e2e.calls.length', false);
      await cc.evaluate("document.getElementById('printBtn').click()", false);
      await waitFor(async () => cc.evaluate('window.__print.prints >= 1', false), 10000, 'print invoked');
      const pr = await cc.evaluate(`(function(){
        var html = window.__print.lastHtml || '';
        var cards = (html.match(/class="question-card/g) || []).length;
        var svgs = (html.match(/<svg/g) || []).length;
        var hasTitle = /ps-title/.test(html) || /<title>/.test(html);
        return { print: { opens: window.__print.opens, writes: window.__print.writes, prints: window.__print.prints }, cards: cards, svgs: svgs, hasTitle: hasTitle, genCalls: window.__e2e.calls.length, errors: window.__e2e.errors };
      })()`, false);
      const produced = (await cc.evaluate('window.__e2e.calls[0].result.questions.length', false)) || 0;
      const checks = {
        'print popup + print invoked': pr.print.prints >= 1,
        'printed cards ≥ produced': pr.cards >= produced,
        'print title present': pr.hasTitle === true,
        'no new generation on print': pr.genCalls === before,
        'no JS errors': (pr.errors || []).length === 0
      };
      cc.close();
      if (!checks['no JS errors']) console.error('PRINT ERRORS:', JSON.stringify(pr.errors));
      const failed = Object.keys(checks).every((k) => checks[k] === true) ? 0 : 1;
      console.log(JSON.stringify({ mode: mode, failed: failed, results: [{ scenario: 'print', ok: failed === 0, checks: checks, print: pr.print, printedCards: pr.cards, printedSvgs: pr.svgs, produced: produced }] }, null, 2));
      process.exitCode = failed;
      return;
    }

    if (mode === 'p12-06' || mode === 'p12-07' || mode === 'p12-08') {
      const A = 'math-g2-down-u02-k001';
      const url = '/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=20&difficulty=5';
      const out = []; let failed = 0;

      if (mode === 'p12-06' || mode === 'p12-07') {
        const data = await runScenario(url, { action: 'reload' });
        const before = data.beforeReload[0] || {};
        const after = data.calls[0] || {};
        const fpsBefore = new Set((before.result && before.result.questions || []).map((q) => q.fp).filter(Boolean));
        const overlap = (after.result && after.result.questions || []).filter((q) => fpsBefore.has(q.fp)).length;
        const storageOk = await (async () => {
          // sessionStorage 检查需在页面内进行；runScenario 已关闭 target，这里通过新 debug 轻量验证
          return null;
        })();
        const checks = {
          'reload 后自动生成': !!after.result,
          '请求参数保持（count/difficulty/types/kps）': JSON.stringify(before.req) === JSON.stringify(after.req),
          'hasPrevSeen = true（跨刷新记忆注入）': after.opts && after.opts.hasPrevSeen === true,
          'overlap = 0（大空间）': overlap === 0,
          'no JS errors': (data.errors || []).length === 0
        };
        if (mode === 'p12-06') {
          delete checks['overlap = 0（大空间）'];
          checks['状态可交付'] = after.result && (after.result.status === 'SUCCESS' || after.result.status === 'PARTIAL');
        }
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: 'reload', ok: ok, checks: checks, overlap: overlap, before: { status: before.result && before.result.status, n: (before.result && before.result.questions || []).length }, after: { status: after.result && after.result.status, n: (after.result && after.result.questions || []).length } });
      }

      if (mode === 'p12-08' || mode === 'p12-07') {
        const data = await runScenario(url, { action: 'regenerate' });
        const first = data.calls[0] || {};
        const second = data.calls[1] || {};
        const fps1 = new Set((first.result && first.result.questions || []).map((q) => q.fp).filter(Boolean));
        const overlap = (second.result && second.result.questions || []).filter((q) => fps1.has(q.fp)).length;
        const checks = {
          '重新生成触发第二次生成': !!second.result,
          '请求参数保持（subject/grade/types/kps/count/difficulty）': JSON.stringify(first.req) === JSON.stringify(second.req),
          'hasPrevSeen = true': second.opts && second.opts.hasPrevSeen === true,
          'overlap = 0（A 语义）': overlap === 0,
          '新批可交付': second.result && (second.result.status === 'SUCCESS' || second.result.status === 'PARTIAL'),
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: 'regenerate', ok: ok, checks: checks, overlap: overlap, batch1: (first.result && first.result.questions || []).length, batch2: (second.result && second.result.questions || []).length });
      }

      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    if (mode === 'p12-04') {
      const A = 'math-g2-down-u02-k001';
      const TINY = 'math-g1-down-u08-k001';
      const scenarios = [
        { name: 'SUCCESS 20/20', url: '/practice.html?subject=math&grade=2&kps=' + A + '&types=calc&count=20&difficulty=5', expectStatus: 'SUCCESS' },
        { name: 'PARTIAL 小空间', url: '/practice.html?subject=math&grade=1&kps=' + TINY + '&types=choice&count=5&difficulty=5', expectStatus: 'PARTIAL' },
        { name: 'FAILED 越界耗尽', url: '/practice.html?subject=math&grade=1&kps=' + TINY + '&types=calc&count=5&difficulty=5', expectStatus: 'FAILED' }
      ];
      const out = []; let failed = 0;
      for (const sc of scenarios) {
        const data = await runScenario(sc.url, {});
        const s = summarize(data);
        const r = data.calls[0].result || {};
        const L = r.ledger || {};
        const checks = {
          'status = expected': r.status === sc.expectStatus,
          'final = produced = dom': L.final === s.produced && s.domCards === (sc.expectStatus === 'FAILED' ? 0 : s.produced),
          'no JS errors': (s.errors || []).length === 0
        };
        if (sc.expectStatus === 'PARTIAL') {
          checks['partial notice shown'] = /本次已生成/.test(s.genProgress && s.genProgress.text || '');
        }
        if (sc.expectStatus === 'FAILED') {
          checks['failed notice shown'] = /生成失败/.test(s.notice || '') || /没有可生成/.test(s.notice || '');
          checks['print disabled'] = s.printDisabled === true;
        }
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ scenario: sc.name, ok: ok, summary: s, checks: checks });
      }
      console.log(JSON.stringify({ mode: mode, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }

    // ── FINAL-12：9 步全路径（真实浏览器 E2E）──
    // 首页 → 快速练习 → 教师模式 → 知识点入口 → 7 类题型 → 生成 → 重新生成 → 刷新 → 打印
    if (mode === 'final-12') {
      const DOWN = 'math-g2-down-u02-k001'; // calc/fill/choice/judge/apply
      const UP = 'math-g2-up-u01-k001';      // classify
      const GEO = 'math-g2-up-u04-k001';    // geometry
      const KPS7 = DOWN + ',' + UP + ',' + GEO; // 合并覆盖 7 类
      const T7 = 'calc,fill,choice,judge,geometry,classify,apply';
      const out = []; let failed = 0;

      // Step 1: 首页 index.html（无生成，仅断言入口）
      {
        const tr = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
        const c = cdpClient(tr.json.webSocketDebuggerUrl); await c.ready;
        await c.send('Page.enable'); await c.send('Runtime.enable');
        await c.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/index.html' });
        await waitFor(async () => c.evaluate('document.readyState === "complete"', false), 15000, 'index ready');
        const info = await c.evaluate(`(function(){
          var btn = document.getElementById('startBtn');
          return { title: document.title, startHref: btn ? btn.getAttribute('href') : null };
        })()`, false);
        const checks = {
          '首页 title=小学练习本': info.title === '小学练习本',
          '首页 开始学习→select.html': info.startHref === 'select.html'
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '1 首页', ok, checks, info });
        c.close();
      }

      // Step 2: 快速练习 mode=quick + 生成
      {
        const data = await runScenario('/practice.html?subject=math&grade=2&mode=quick&kps=' + DOWN + '&types=calc&count=8&difficulty=5', {});
        const r = (data.calls[0] || {}).result || {};
        const checks = {
          '快速练习 生成结果': !!r.status,
          '可交付 SUCCESS|PARTIAL': r.status === 'SUCCESS' || r.status === 'PARTIAL',
          'DOM cards>0': (data.dom && data.dom.cards) > 0,
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '2 快速练习', ok, checks, produced: (r.questions || []).length, status: r.status });
      }

      // Step 3: 教师模式 mode=teacher
      {
        const data = await runScenario('/practice.html?subject=math&grade=2&mode=teacher&kps=' + DOWN + '&types=calc&count=8&difficulty=5', {});
        const r = (data.calls[0] || {}).result || {};
        const checks = {
          '教师模式 生成结果': !!r.status,
          '可交付 SUCCESS|PARTIAL': r.status === 'SUCCESS' || r.status === 'PARTIAL',
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '3 教师模式', ok, checks, produced: (r.questions || []).length, status: r.status });
      }

      // Step 4: 知识点入口（FINAL-64：用户点击 CTA 全链产品验收，非 URL 导航）
      // 链：用户点击 → 页面 → 参数 → Session → POL → Strategy → Generator → Validator → SemanticQuestion → Presentation → DOM
      {
        // 核验知识页 CTA 真实存在（页面完整性）
        const khtml = fs.readFileSync(path.join(ROOT, 'knowledge', UP + '.html'), 'utf8');
        const m = khtml.match(/href="(\.\.\/practice\.html\?[^"]+)"/);
        const ctaHref = m ? m[1] : null;

        // 真实用户点击：在知识页内点击 CTA <a> 触发导航（非 URL 导航）
        const tr = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
        const c = cdpClient(tr.json.webSocketDebuggerUrl); await c.ready;
        await c.send('Page.enable'); await c.send('Runtime.enable');
        await c.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SOURCE });
        await c.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/knowledge/' + UP + '.html' });
        await waitFor(async () => c.evaluate('document.readyState === "complete"', false), 15000, 'knowledge page ready');
        const clickInfo = await c.evaluate(`(function(){
          var a = document.querySelector('a[href*="practice.html"]');
          if (!a) return { clicked: false };
          var href = a.getAttribute('href');
          a.click();
          return { clicked: true, href: href };
        })()`, false);
        await waitFor(async () => c.evaluate('location.href.indexOf("practice.html") !== -1 && !!(window.__e2e && window.__e2e.installed && window.__e2e.calls.length && window.__e2e.calls[0].result)', false), 60000, 'click→practice generation');
        await sleep(500);
        const data = await c.evaluate(`(function(){
          var e = window.__e2e || { calls: [], errors: [] };
          var area = document.getElementById('problemsArea');
          var grid = area ? area.querySelector('.questions-grid') : null;
          var cards = grid ? grid.querySelectorAll('.question-card').length : (area ? area.querySelectorAll('.question-card').length : 0);
          return { calls: e.calls, errors: e.errors, dom: { cards: cards, href: location.href } };
        })()`, false);
        c.close();

        const call = (data.calls[0] || {});
        const req = call.req || {};
        const r = call.result || {};
        const qs = r.questions || [];
        const fps = qs.map((q) => q.fp).filter(Boolean);
        const uniqFp = new Set(fps).size;
        const sqOk = qs.length > 0 && qs.every((q) => q.type && q.kp && typeof q.difficulty === 'number' && q.fp && q.hasAnswer && q.hasPrompt);
        // 注：知识页 CTA 为单 KP 原生路径，api.js 透明回退 executeInline（无 orchestration 账本，设计如此）；
        // POL 编排层（多 KP+types）在 Step 5+6 验证。本步证明：用户点击→页面→参数→Session→Strategy→Generator→Validator→SemanticQuestion→Presentation→DOM。
        const checks = {
          '知识页 CTA 存在': !!ctaHref,
          '用户点击 CTA→导航': !!clickInfo.clicked && String(data.dom && data.dom.href || '').indexOf('practice.html') !== -1,
          '页面=practice.html': String(data.dom && data.dom.href || '').indexOf('practice.html') !== -1,
          '参数=深链 KP': JSON.stringify(req.knowledgePointIds) === JSON.stringify([UP]),
          'Session=generationId': !!r.generationId,
          'Strategy plans>0': typeof r.plans === 'number' && r.plans > 0,
          'Generator 题目数>0': qs.length > 0,
          'Validator failedPlans=0+指纹唯一': r.failedPlans === 0 && uniqFp === fps.length,
          'SemanticQuestion 契约字段齐全': sqOk,
          'Presentation html 已渲染': r.htmlPresent === true,
          'DOM cards=produced': !!data.dom && data.dom.cards === (r.producedCount || 0),
          '可交付 SUCCESS|PARTIAL': r.status === 'SUCCESS' || r.status === 'PARTIAL',
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '4 知识点入口(用户点击全链)', ok, checks, ctaHref: ctaHref || '', produced: qs.length, plans: r.plans, semanticTargetHits: qs.filter((q) => q.semanticTarget).length, status: r.status });
      }

      // Step 5+6: 7 类题型 生成（FINAL-64：POL 全链产品验收——多 KP+types 走 POL 编排，账本可观测）
      {
        const data = await runScenario('/practice.html?subject=math&grade=2&kps=' + KPS7 + '&types=' + T7 + '&count=21&difficulty=5', {});
        const s = summarize(data);
        const r = (data.calls[0] || {}).result || {};
        const L = s.ledger || {};
        const qs = r.questions || [];
        const producedTypes = Object.keys(s.types || {});
        const expected = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
        const sqOk = qs.length > 0 && qs.every((q) => q.type && q.kp && typeof q.difficulty === 'number' && q.fp && q.hasAnswer && q.hasPrompt);
        const checks = {
          'POL 账本 req≥planned≥gen=final': L.req != null && L.req >= L.planned && L.planned >= L.gen && L.gen === L.final,
          'Strategy plans>0': typeof r.plans === 'number' && r.plans > 0,
          '7 类题型全部出现': expected.every((t) => producedTypes.indexOf(t) !== -1),
          'Generator 题目数=produced': s.produced > 0 && s.produced === (r.producedCount || 0),
          'Validator failedPlans=0+指纹唯一': r.failedPlans === 0 && s.unique === s.produced,
          'SemanticQuestion 契约字段齐全': sqOk,
          'Presentation html 已渲染': r.htmlPresent === true,
          'DOM cards=produced': s.domCards === s.produced,
          '可交付 SUCCESS|PARTIAL': s.status === 'SUCCESS' || s.status === 'PARTIAL',
          'no JS errors': (s.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '5+6 7类题型生成(POL全链)', ok, checks, types: s.types, produced: s.produced, producedTypes: producedTypes, plans: r.plans, ledger: L });
      }

      // Step 7: 重新生成
      {
        const data = await runScenario('/practice.html?subject=math&grade=2&kps=' + KPS7 + '&types=' + T7 + '&count=21&difficulty=5', { action: 'regenerate' });
        const first = data.calls[0] || {}, second = data.calls[1] || {};
        const fps1 = new Set(((first.result || {}).questions || []).map((q) => q.fp).filter(Boolean));
        const overlap = ((second.result || {}).questions || []).filter((q) => fps1.has(q.fp)).length;
        const checks = {
          '重新生成 第二批存在': !!(second.result && second.result.status),
          '请求参数保持': JSON.stringify(first.req) === JSON.stringify(second.req),
          'hasPrevSeen=true': second.opts && second.opts.hasPrevSeen === true,
          'overlap=0': overlap === 0,
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '7 重新生成', ok, checks, overlap, batch1: ((first.result || {}).questions || []).length, batch2: ((second.result || {}).questions || []).length });
      }

      // Step 8: 刷新（reload 自动生成）
      {
        const data = await runScenario('/practice.html?subject=math&grade=2&kps=' + KPS7 + '&types=' + T7 + '&count=21&difficulty=5', { action: 'reload' });
        const before = data.beforeReload[0] || {}, after = data.calls[0] || {};
        const checks = {
          '刷新后自动生成': !!(after.result && after.result.status),
          '请求参数保持': JSON.stringify(before.req) === JSON.stringify(after.req),
          'hasPrevSeen=true': after.opts && after.opts.hasPrevSeen === true,
          'no JS errors': (data.errors || []).length === 0
        };
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '8 刷新', ok, checks });
      }

      // Step 9: 打印（mock window.open/print）
      {
        const tr = await httpJson('http://127.0.0.1:' + CDP_PORT + '/json/new?' + encodeURIComponent('about:blank'), 'PUT');
        const cc = cdpClient(tr.json.webSocketDebuggerUrl); await cc.ready;
        await cc.send('Page.enable'); await cc.send('Runtime.enable');
        await cc.send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK_SOURCE + `
          window.__print = { opens: 0, writes: 0, prints: 0, lastHtml: '', errors: [] };
          var origOpen = window.open;
          window.open = function (url, name, features) {
            if (String(url) === '' && String(name) === '_blank') {
              window.__print.opens++;
              return { document: { write: function (h) { window.__print.writes++; window.__print.lastHtml += String(h); }, close: function () {} }, print: function () { window.__print.prints++; }, focus: function () {}, close: function () {} };
            }
            return origOpen.apply(window, arguments);
          };
        ` });
        await cc.send('Page.navigate', { url: 'http://127.0.0.1:' + HTTP_PORT + '/practice.html?subject=math&grade=2&kps=' + DOWN + '&types=calc&count=10&difficulty=5' });
        await waitFor(async () => cc.evaluate('!!(window.__e2e && window.__e2e.calls.length && window.__e2e.calls[0].result)', false), 60000, 'print gen');
        await sleep(400);
        const before = await cc.evaluate('window.__e2e.calls.length', false);
        await cc.evaluate("document.getElementById('printBtn').click()", false);
        await waitFor(async () => cc.evaluate('window.__print.prints >= 1', false), 10000, 'print invoked');
        const pr = await cc.evaluate(`(function(){
          var html = window.__print.lastHtml || '';
          return { print: { opens: window.__print.opens, writes: window.__print.writes, prints: window.__print.prints }, cards: (html.match(/class="question-card/g) || []).length, hasTitle: /<title>/.test(html) || /ps-title/.test(html), genCalls: window.__e2e.calls.length, errors: window.__e2e.errors };
        })()`, false);
        const produced = (await cc.evaluate('window.__e2e.calls[0].result.questions.length', false)) || 0;
        const checks = {
          '打印弹窗+print 调用': pr.print.prints >= 1,
          '打印 cards≥produced': pr.cards >= produced,
          '打印标题存在': pr.hasTitle === true,
          '打印不触发新生成': pr.genCalls === before,
          'no JS errors': (pr.errors || []).length === 0
        };
        cc.close();
        if (!checks['no JS errors']) console.error('PRINT ERRORS:', JSON.stringify(pr.errors));
        const ok = Object.keys(checks).every((k) => checks[k] === true);
        if (!ok) failed++;
        out.push({ step: '9 打印', ok, checks, print: pr.print, printedCards: pr.cards, produced: produced });
      }

      console.log(JSON.stringify({ mode: mode, steps: 9, failed: failed, results: out }, null, 2));
      process.exitCode = failed ? 1 : 0;
      return;
    }
  } finally {
    cleanup();
  }
}

main().catch((e) => { console.error('E2E ERROR:', e.message); process.exit(2); });
