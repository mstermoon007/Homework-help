#!/usr/bin/env node
'use strict';
/**
 * ============================================================
 * 真实用户流程 E2E（test/e2e-real-flow.js）
 * ============================================================
 * 测试对象：用户真实操作链 ——
 *   首页 → 选科目 → 选年级 → 选题型 → 进入练习
 *   → 生成题目 → 答题 → 提交批改 → 查看结果/错题 → 错题重做 → 打印
 *
 * 设计原则：
 *  1. 不注入任何探针脚本，不依赖页面内部渲染结构（旧版 _e2e.html 探针已删除）。
 *  2. 元素定位优先「用户可见文本」（find text），回退稳定语义 id；
 *     断言全部基于用户可见输出（标题/文案/分数/题目数量/URL）。
 *  3. 导航目标一律取自页面真实链接 href，由真实 Chromium（agent-browser）地址栏加载，
 *     等价于用户点击后的到达页（headless 环境不支持页面内 location 赋值导航，见 README 注）。
 *  4. 覆盖验收矩阵：正常流程 / 错误参数 / 刷新 / 返回 / 直接访问 / 打印 / 移动端。
 *
 * 用法：node test/e2e-real-flow.js
 * 退出码：0=全过，1=有失败
 *
 * ⚠️ 关键陷阱（已踩坑并修复）：
 *  本测试的静态服务器与 agent-browser 调用运行在【同一 node 进程】。
 *  agent-browser 的 open 会等待页面 load 事件，页面会向本进程的服务器请求 JS/CSS——
 *  若用 spawnSync（阻塞事件循环），服务器无法响应这些请求 → open 永远等不到 load → 死锁挂起。
 *  因此所有 agent-browser 调用必须用【异步 spawn】保持事件循环可用。实测：
 *  同步 spawnSync + 进程内服务器 → open 必挂 20s+；异步 spawn → 秒开。
 *  2. open / reload / back 内部已等待页面 load 完成后再返回——其后【绝不能】再跟
 *  `wait --load <event>`：它等待的是【下一次】导航的 load 事件，页面已加载时永不触发，
 *  会一直挂到超时（实测：open 成功后 wait --load domcontentloaded 被看门狗 8s 强杀）。
 *  3. agent-browser eval 的参数是【原始 JS 表达式】（输出为 JSON 编码结果）——
 *  不要 JSON.stringify 包一层，否则页面求值的是字符串字面量，返回表达式原文。
 * ============================================================
 */
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml', '.json': 'application/json'
};

// ---------- 本地静态服务器（自动避让端口） ----------
let server = null;
function startServer() {
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const s = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        if (p === '/') p = '/index.html';
        const f = path.join(ROOT, p);
        if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('404'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        fs.createReadStream(f).pipe(res);
      });
      s.on('error', (e) => { if (e.code === 'EADDRINUSE') tryListen(port + 1); else reject(e); });
      s.listen(port, () => { server = s; resolve(port); });
    };
    tryListen(8899);
  });
}

// ---------- agent-browser 封装 ----------
// 必须用异步 spawn（见文件头「关键陷阱」）：页面加载会请求本进程静态服务器，
// 同步阻塞会导致 open 死锁。
function ab(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn('agent-browser', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) { /* ignore */ }
      reject(new Error('agent-browser 超时: ' + args[0]));
    }, timeoutMs || 20000);
    child.stdout.on('data', (d) => { out += d; });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', () => { clearTimeout(timer); resolve((out || '').trim()); });
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 冷启动清理：优雅终止 daemon（SIGTERM → 兜底 SIGKILL）+ 清陈旧状态文件。
// 下次命令会自动拉起全新 daemon + Chromium（确定性冷启动）。
// 注意：绝不可 pkill -f "agent-browser|chrome|headless" 等宽泛 pattern——
// 会误杀用户自己运行的 Google Chrome（曾导致 17 个残留进程 + 目录锁挂起）。
async function cleanupBrowser() {
  const st = process.env.HOME + '/.agent-browser';
  try {
    const pid = parseInt(fs.readFileSync(st + '/default.pid', 'utf8'), 10);
    if (pid) {
      try { process.kill(pid, 'SIGTERM'); } catch (e) { /* 已退出 */ }
      await sleep(2000);
      try { process.kill(pid, 0); spawnSync('kill', ['-9', String(pid)]); } catch (e) { /* 已优雅退出 */ }
    }
  } catch (e) { /* 无 pid 文件 */ }
  try { spawnSync('pkill', ['-9', '-f', 'agent-browser/browsers']); } catch (e) { /* 孤儿兜底 */ }
  try { spawnSync('rm', ['-f', st + '/default.pid', st + '/default.sock', st + '/default.stream']); } catch (e) { /* ignore */ }
}

async function open(url) {
  // headless 浏览器会话偶发启动竞态：失败自动重试
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      await ab(['open', url]); // open 内部已等 load 完成；不可再跟 wait --load（见文件头陷阱 2）
      // 校验导航成功（非 chrome-error / about:blank）
      const u = await getUrl();
      if (!u || u.indexOf('chrome-error') !== -1 || u === 'about:blank') throw new Error('导航失败: ' + u);
      return;
    } catch (e) { lastErr = e; await sleep(2000); }
  }
  throw lastErr;
}
async function getUrl() { return ab(['get', 'url']); }
async function getText(sel) { try { return await ab(['get', 'text', sel]); } catch (e) { return ''; } }
async function getCount(sel) { try { return parseInt(await ab(['get', 'count', sel]), 10) || 0; } catch (e) { return 0; } }
async function click(sel) { return ab(['click', sel]); }
async function evalJs(expr) {
  // 陷阱：agent-browser eval 直接接收【原始 JS 表达式】并求值，stdout 输出 JSON 编码的结果。
  // 绝不能 JSON.stringify(expr) —— 那会把表达式变成字符串字面量传给页面，
  // 求值结果=表达式原文（字符串），所有依赖 evalJs 的断言会静默失败。
  const out = await ab(['eval', expr]);
  try { return JSON.parse(out); } catch (e) { return out; }
}
async function waitForEval(expr, timeoutMs, label) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try { if (await evalJs(expr)) return true; } catch (e) { /* 页面未就绪 */ }
    await sleep(250);
  }
  console.error('  ⏱ 等待超时: ' + label);
  return false;
}

// ---------- 断言统计 ----------
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log((ok ? '  ✅ PASS  ' : '  ❌ FAIL  ') + name + (detail ? '   [' + String(detail).slice(0, 90) + ']' : ''));
}
function section(title) { console.log('\n== ' + title + ' =='); }
function summary() {
  const fail = results.filter((r) => !r.ok).length;
  const pass = results.length - fail;
  console.log('\n========== E2E 结果 ==========');
  console.log('通过 ' + pass + ' / ' + results.length + (fail ? '，失败 ' + fail : ''));
  if (fail) {
    console.log('失败用例：');
    results.forEach((r) => { if (!r.ok) console.log('  ❌ ' + r.name); });
  } else {
    console.log('🎉 E2E: PASS');
  }
  return fail === 0 ? 0 : 1;
}

// ---------- 用例 ----------
const CARD_SEL = '#problemsArea .question-card, #problemsArea .problem';
const INPUT_SEL = '#problemsArea input[data-index], #problemsArea input[data-idx]';
// 注意：不能用 CARD_SEL + '.wrong' —— 逗号拼接会让 .wrong 只修饰第二个选择器，
// 实际匹配「全部 .question-card」（批改标记断言会侥幸通过、重做断言则永不满足）。
const WRONG_SEL = '#problemsArea .question-card.wrong, #problemsArea .problem.wrong';

async function case1_normalFlow(BASE) {
  section('C1 正常流程：首页 → 数学 → 一年级 → 口算 → 练习 → 答题 → 批改 → 错题 → 重做 → 打印');

  // 1) 打开首页
  await open(BASE + '/');
  check('首页加载：出现「开始练习」按钮',
    (await getCount('#startBtn')) === 1 && (await getText('#startBtn')).indexOf('开始练习') !== -1,
    await getText('#startBtn'));
  check('首页加载：年级 1~6 选项齐全', (await getCount('input[name="grade"]')) === 6, await getCount('input[name="grade"]') + ' 个');

  // 2) 选择科目/年级（默认：数学 + 一年级），验证目标 URL 由页面真实逻辑生成
  const intent = await evalJs(`(() => {
    var sel = {
      grade: document.querySelector('input[name="grade"]:checked').value,
      subject: document.querySelector('input[name="subject"]:checked').value
    };
    var target = { math: 'math-types.html', chinese: 'subject-types.html?subject=chinese', english: 'subject-types.html?subject=english' }[sel.subject];
    return { sel: sel, url: App.buildLink(target, sel.grade) };
  })()`);
  check('首页默认选择：数学 + 一年级', intent.sel.subject === 'math' && intent.sel.grade === '1', JSON.stringify(intent.sel));
  check('「开始练习」目标 URL 正确', intent.url === 'math-types.html?grade=1', intent.url);

  // 3) 到达题型选择页（等价于点击「开始练习」后）
  await open(BASE + '/' + intent.url);
  check('题型页加载：标题「数学」', (await getText('.pt-subject')).indexOf('数学') !== -1, await getText('.pt-subject'));
  const nCards = await getCount('a.type-card');
  check('题型页渲染题型卡 ≥5', nCards >= 5, nCards + ' 张');

  // 4) 点击「口算练习」卡（href 取自页面真实链接）
  const oralHref = await evalJs(`(() => {
    var a = [].slice.call(document.querySelectorAll('a.type-card')).filter(function (x) {
      return (x.textContent || '').indexOf('口算') !== -1;
    })[0];
    return a ? a.getAttribute('href') : '';
  })()`);
  check('题型卡「口算练习」存在', !!oralHref && oralHref.indexOf('math-oral') !== -1, oralHref || '(未找到)');

  // 5) 进入练习页
  await open(BASE + '/' + oralHref);
  check('练习页 URL 携带 plugin 参数', (await getUrl()).indexOf('math-oral') !== -1, await getUrl());
  const genOk = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 10', 15000, '题目生成');
  const nQ = await getCount(CARD_SEL);
  check('生成 10 题', genOk && nQ === 10, nQ + ' 题');
  const nInp = await getCount(INPUT_SEL);
  check('题目可作答（有输入框）', nInp >= 10, nInp + ' 个');
  check('检查/打印按钮已启用',
    (await evalJs("document.getElementById('checkBtn').disabled === false && document.getElementById('printBtn').disabled === false")) === true, '');

  // 6) 填写答案（全部填错，验证批改与错题链路）
  const filled = await evalJs(`(() => {
    var ins = document.querySelectorAll('${INPUT_SEL}');
    ins.forEach(function (i) { i.value = '999'; });
    return ins.length;
  })()`);
  check('填写答案', filled >= 10, filled + ' 题');
  await click('#checkBtn');
  const resOk = await waitForEval("document.getElementById('resultArea').classList.contains('show')", 8000, '批改结果');
  const scoreTxt = await getText('#resultArea .score');
  const detailTxt = await getText('#resultArea .detail');
  check('批改：结果区出现得分', resOk && scoreTxt.indexOf('分') !== -1, scoreTxt + ' | ' + detailTxt);
  const wrongCards = await getCount(WRONG_SEL);
  check('批改：错题被标记', wrongCards >= 10, wrongCards + ' 张');
  check('批改：出现「错题重做」入口', (await getCount('#redoBtn')) === 1, await getText('#redoBtn'));

  // 7) 错题重做
  await click('#redoBtn');
  const redoOk = await waitForEval(
    "!document.getElementById('resultArea').classList.contains('show')" +
    " && document.querySelectorAll('" + CARD_SEL + "').length >= 1" +
    " && document.querySelectorAll('" + WRONG_SEL + "').length === 0",
    8000, '错题重做');
  check('错题重做：题目重新生成', redoOk, await getCount(CARD_SEL) + ' 题，无历史标记');

  // 8) 显示答案 → 回填正确答案 → 全对批改
  await click('#revealBtn');
  const revOk = await waitForEval("document.querySelectorAll('#problemsArea .revealed-answer').length >= 10", 5000, '显示答案');
  check('显示答案：全部答案可见', revOk, await getCount('#problemsArea .revealed-answer') + ' 个');
  const filled2 = await evalJs(`(() => {
    var n = 0;
    document.querySelectorAll('${CARD_SEL}').forEach(function (card) {
      var ra = card.querySelector('.revealed-answer');
      var inp = card.querySelector('${INPUT_SEL}');
      if (ra && inp) {
        var ans = ra.textContent.replace('✔ 答案：', '').trim();
        if (ans && ans !== '—') { inp.value = ans; n++; }
      }
    });
    return n;
  })()`);
  check('回填正确答案', filled2 >= 10, filled2 + ' 题');
  await click('#checkBtn');
  const fullOk = await waitForEval(
    "document.getElementById('resultArea').classList.contains('show')" +
    " && (document.getElementById('resultArea').querySelector('.score') || {}).textContent.indexOf('100') !== -1",
    8000, '全对批改');
  check('全对批改：100 分', fullOk, await getText('#resultArea .score') + ' | ' + await getText('#resultArea .detail'));
  check('全对：无「错题重做」按钮', (await getCount('#redoBtn')) === 0, '');

  // 9) 打印
  await evalJs("window.__printOpened = false; window.open = function () { window.__printOpened = true; return { document: { write: function () {}, close: function () {} }, close: function () {}, print: function () {} }; }; true");
  await click('#printBtn');
  await sleep(600);
  check('打印：点击「打印页面」触发打印流程', (await evalJs('window.__printOpened')) === true, 'window.open 被调用');
}

async function case2_badParams(BASE) {
  section('C2 错误参数：错误 grade / 错误 subject / 错误 plugin / 无参数');

  // 2a. 题型页错误 grade
  await open(BASE + '/math-types.html?grade=99');
  const e1 = await getText('.error-state');
  check('错误 grade：题型页显示友好错误', e1.indexOf('年级参数好像不对') !== -1, e1.slice(0, 40));
  check('错误页提供「返回首页」入口', (await getText('.error-state')).indexOf('返回首页') !== -1, '');

  // 2b. 统一题型页错误 subject
  await open(BASE + '/subject-types.html?subject=bad');
  const e2 = await getText('.error-state');
  check('错误 subject：显示友好错误', e2.indexOf('学科参数好像不对') !== -1, e2.slice(0, 40));

  // 2c. 练习页不存在 plugin
  await open(BASE + '/practice.html?plugin=no-such-plugin&grade=1');
  const n1 = await getText('#problemsArea .notice');
  check('不存在 plugin：提示「题型不存在」', n1.indexOf('题型不存在') !== -1, n1.slice(0, 50));
  check('错误提示提供「重新加载」按钮', (await getCount('#problemsArea .notice .btn')) >= 1, '');

  // 2d. 无参数直接访问 practice
  await open(BASE + '/practice.html');
  const n2 = await getText('#problemsArea .notice');
  check('无参数：提示「题型不存在」', n2.indexOf('题型不存在') !== -1, n2.slice(0, 50));

  // 2e. 练习页错误 grade：插件不支持时自动容错（切最近可用年级出题）
  await open(BASE + '/practice.html?plugin=math-oral&grade=99');
  const tolOk = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 1', 10000, '容错出题');
  check('错误 grade：自动容错并出题', tolOk, await getCount(CARD_SEL) + ' 题');
}

async function case3_refresh(BASE) {
  section('C3 刷新：练习页 reload 后状态与题目恢复');

  await open(BASE + '/practice.html?subject=math&grade=1&plugin=math-oral');
  await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 10', 15000, '首次生成');
  // 做一次批改，写入自适应记录
  await evalJs('document.querySelectorAll("' + INPUT_SEL + '").forEach(function (i) { i.value = "999"; }); true');
  await click('#checkBtn');
  await waitForEval("document.getElementById('resultArea').classList.contains('show')", 8000, '批改写入');
  const saved = await evalJs("localStorage.getItem('hw_adaptive_v2')");
  check('批改后自适应记录已写入', !!saved && saved.indexOf('math') !== -1, saved ? saved.slice(0, 60) : '(空)');

  // 刷新（reload 内部已等 load 完成；下方 waitForEval 轮询就绪）
  await ab(['reload']);
  const regen = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 10', 15000, '刷新后重新生成');
  check('刷新后题目重新生成', regen, await getCount(CARD_SEL) + ' 题');
  const kept = await evalJs("localStorage.getItem('hw_adaptive_v2')");
  check('刷新后自适应记录保留', !!kept, '');
  check('刷新后无全局错误',
    (await evalJs("!document.getElementById('global-error') || getComputedStyle(document.getElementById('global-error')).display === 'none'")) === true, '');
}

async function case4_back(BASE) {
  section('C4 返回：浏览器后退回到题型页');

  await open(BASE + '/math-types.html?grade=1');
  await waitForEval('document.querySelectorAll("a.type-card").length >= 5', 10000, '题型页渲染');
  await open(BASE + '/practice.html?plugin=math-oral&grade=1&module=M1');
  await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 10', 15000, '练习页生成');
  await ab(['back']); // back 内部已等导航完成；下方轮询题型卡渲染以保证稳健
  check('返回：回到题型页', (await getUrl()).indexOf('math-types') !== -1, await getUrl());
  const backOk = await waitForEval('document.querySelectorAll("a.type-card").length >= 5', 10000, '返回后题型页渲染');
  check('返回后题型卡仍可渲染', backOk && (await getCount('a.type-card')) >= 5, await getCount('a.type-card') + ' 张');
}

async function case5_directAccess(BASE) {
  section('C5 直接访问：地址栏直达练习 URL（分享/收藏场景）');

  // 语文
  await open(BASE + '/practice.html?subject=chinese&grade=1&plugin=chinese-pinyin');
  const c1 = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 5', 15000, '语文拼音生成');
  check('直接访问：语文拼音练习正常生成', c1, await getCount(CARD_SEL) + ' 题');
  check('语文拼音：批改可用', (await evalJs("document.getElementById('checkBtn').disabled === false")) === true, '');

  // 英语（noCheck 跟读类：无「检查答案」）。注意题卡被 A4 自适应列容器包裹，
  // 不能用 problemsArea.children 计数，须按 .question-card 语义查询。
  await open(BASE + '/practice.html?subject=english&grade=3&plugin=english-alphabet');
  const c2 = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 5', 15000, '英语字母生成');
  check('直接访问：英语字母跟读正常生成', c2, await getCount(CARD_SEL) + ' 卡');
  // noCheck 插件的「检查答案」按 practice.html 约定以 display:none 隐藏（非 disabled）
  check('英语跟读类：隐藏「检查答案」', (await evalJs("getComputedStyle(document.getElementById('checkBtn')).display === 'none'")) === true, '');
}

async function case6_print(BASE) {
  section('C6 打印：独立验证打印链路');

  await open(BASE + '/practice.html?subject=math&grade=4&plugin=math-g4-vertical');
  const ok = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 5', 15000, '竖式生成');
  check('竖式练习生成', ok, await getCount(CARD_SEL) + ' 题');
  await evalJs("window.__printOpened = false; window.open = function () { window.__printOpened = true; return { document: { write: function () {}, close: function () {} }, close: function () {}, print: function () {} }; }; true");
  await click('#printBtn');
  await sleep(600);
  check('打印：触发打印流程', (await evalJs('window.__printOpened')) === true, 'window.open 被调用');
}

async function case7_mobile(BASE) {
  section('C7 移动端：375px 视口下完整可用');

  await ab(['set', 'viewport', '375', '812']);
  await open(BASE + '/practice.html?subject=math&grade=1&plugin=math-oral');
  const ok = await waitForEval('document.querySelectorAll("' + CARD_SEL + '").length >= 10', 15000, '移动端生成');
  check('移动端(375px)：题目正常生成', ok, await getCount(CARD_SEL) + ' 题');
  const w = await evalJs('document.documentElement.clientWidth');
  check('移动端视口生效', w <= 375, w + 'px');
  check('移动端无全局错误',
    (await evalJs("!document.getElementById('global-error') || getComputedStyle(document.getElementById('global-error')).display === 'none'")) === true, '');
  try { await ab(['screenshot', '/tmp/e2e-mobile.png']); console.log('  📸 截图已存 /tmp/e2e-mobile.png'); } catch (e) { /* 截图失败不阻断 */ }
  await ab(['set', 'viewport', '1280', '800']);
}

// ---------- 主入口 ----------
async function main() {
  const PORT = await startServer();
  const BASE = 'http://127.0.0.1:' + PORT;
  console.log('本地静态服务器: ' + BASE);
  try {
    await cleanupBrowser(); // 冷启动（TERM 优雅退出 daemon；不用 close：spawn 下 close 后 open 有目录锁风险）
    await sleep(2000);
    await case1_normalFlow(BASE);
    await case2_badParams(BASE);
    await case3_refresh(BASE);
    await case4_back(BASE);
    await case5_directAccess(BASE);
    await case6_print(BASE);
    await case7_mobile(BASE);
  } finally {
    await cleanupBrowser(); // 结束时清理测试浏览器进程（不用 close：spawn 下 close 后 open 有目录锁风险）
    if (server) server.close();
  }
  process.exit(summary());
}

main().catch((e) => {
  console.error('E2E 执行异常:', e);
  cleanupBrowser().finally(() => {
    if (server) server.close();
    process.exit(1);
  });
});
