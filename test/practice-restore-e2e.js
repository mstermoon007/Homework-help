#!/usr/bin/env node
/* practice.html 恢复验收：jsdom 全链路闭环测试
 * 覆盖：页面加载 / URL 解析 / 题目生成 / 渲染 / 答题 / 批改 / 错题 / 打印 / 自适应
 * 运行：node test/practice-restore-e2e.js  （需先 npm i jsdom 于隔离 workspace）
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8765;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

// ---- 静态服务器（file:// 下 jsdom resources 不可用，须走 http）----
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/practice.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end('404'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

const { JSDOM } = require('jsdom');
const assert = require('assert');

const CASES = [
  { name: '数学G1口算',        url: '/practice.html?subject=math&grade=1&plugin=math-oral',          expectType: 'input', multi: false },
  { name: '数学G4竖式',        url: '/practice.html?subject=math&grade=4&plugin=math-g4-vertical',   expectType: 'input', multi: false },
  { name: '数学G6选择',        url: '/practice.html?subject=math&grade=6&plugin=math-g6-choice',     expectType: 'opt',   multi: false },
  { name: '数学G1凑十(SVG)',   url: '/practice.html?subject=math&grade=1&plugin=math-make-ten',      expectType: 'svg',   multi: false },
  { name: '数学综合(异步)',    url: '/practice.html?subject=math&grade=2&plugin=math-comprehensive', expectType: 'mixed', multi: false },
  { name: '语文G1拼音',        url: '/practice.html?subject=chinese&grade=1&plugin=chinese-pinyin',  expectType: 'opt',   multi: false },
  // 跟读类（noCheck）：无书面输入，check 恒全对，checkBtn 隐藏 → 走专用断言分支
  { name: '英语G3字母(跟读)',  url: '/practice.html?subject=english&grade=3&plugin=english-alphabet', expectType: 'listen', multi: false, noCheck: true },
];

let pass = 0, fail = 0;
const failures = [];

function waitFor(win, cond, timeoutMs, step) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      let ok = false;
      try { ok = cond(win); } catch (e) { /* ignore */ }
      if (ok) { clearInterval(iv); resolve(true); }
      else if (Date.now() - t0 > timeoutMs) { clearInterval(iv); reject(new Error('超时等待: ' + step)); }
    }, 100);
  });
}

async function runCase(c) {
  const dom = await JSDOM.fromURL('http://127.0.0.1:' + PORT + c.url, {
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    beforeParse(window) {
      // 打印：拦截新窗口（桩对象需含 print，否则 popupAndPrint 定时器内 pw.print 抛错）
      window.open = function () { return { document: { write() {}, close() {} }, close() {}, print() {} }; };
      window.alert = function () {};
      window.scrollTo = function () {};
      window.print = function () {};
      // jsdom 缺 scrollIntoView：showResult 中 ra.scrollIntoView(...) 会抛 TypeError 中断
      if (window.HTMLElement && !window.HTMLElement.prototype.scrollIntoView) {
        window.HTMLElement.prototype.scrollIntoView = function () {};
      }
    }
  });
  const win = dom.window;
  const doc = win.document;
  const R = { name: c.name };

  try {
    // 1) 页面加载 + URL 解析：等待 controlsPanel 显示（boot 完成、插件加载成功）
    //    标题断言仅校验非空——不同插件标题各异（如「四年级 竖式计算（混合竖式）（10题）」不含"练习"二字）
    await waitFor(win, w => {
      const cp = w.document.getElementById('controlsPanel');
      const t = w.document.getElementById('sheetTitle');
      return cp && cp.style.display !== 'none' && t && t.textContent.trim().length > 0;
    }, 15000, 'controlsPanel 显示');
    R.controlsShown = true;

    // 2) 题目生成：genBtn 点击后出现题目卡
    const cardCount0 = doc.querySelectorAll('#problemsArea .question-card, #problemsArea .problem').length;
    if (cardCount0 === 0) {
      doc.getElementById('genBtn').click();
    }
    await waitFor(win, w => w.document.querySelectorAll('#problemsArea .question-card, #problemsArea .problem').length > 0, 15000, '题目生成');
    R.cards = doc.querySelectorAll('#problemsArea .question-card, #problemsArea .problem').length;
    assert(R.cards >= 1, '题目卡数量 >= 1');

    if (c.noCheck) {
      // ---- 跟读类专用分支（english-alphabet：无书面答案） ----
      // 3) 渲染形态：字母卡 + 发音按钮
      R.rendered = {
        letterCards: doc.querySelectorAll('#problemsArea .letter-card').length,
        playBtns: doc.querySelectorAll('#problemsArea .play-btn').length
      };
      assert(R.rendered.letterCards >= 1, '存在字母卡');
      assert(R.rendered.playBtns >= 1, '存在发音按钮');

      // 4) 批改入口：checkBtn 应被隐藏（practice.html 对 noCheck 隐藏）
      const cb = doc.getElementById('checkBtn');
      R.checkBtnHidden = cb && cb.style.display === 'none';
      assert(R.checkBtnHidden, '跟读类隐藏「检查答案」按钮');

      // 5) check 兜底：插件自身恒返回全对
      const plugin = win.__currentPlugin;
      assert(plugin && typeof plugin.check === 'function', '插件存在且提供 check');
      const res = plugin.check({ questions: [] }, {});
      assert(res && res.score === 100 && res.correct === res.total, 'check 兜底恒全对');
      R.score = res.score + '分(跟读)';
      R.adaptiveStored = false; // 自适应难度记录功能已移除（hw_adaptive_v2 不再写入）
      R.redoReduced = null;
      R.allCorrect = true;
    } else {
      // ---- 书面作答类 ----
      // 3) 渲染形态：input / 选择 / SVG
      const hasInput = doc.querySelectorAll('#problemsArea input').length > 0;
      const hasOpt = doc.querySelectorAll('#problemsArea .opt, #problemsArea input[type="radio"]').length > 0;
      const hasSvg = doc.querySelectorAll('#problemsArea svg').length > 0;
      R.rendered = { inputs: doc.querySelectorAll('#problemsArea input').length, opts: doc.querySelectorAll('#problemsArea .opt, #problemsArea input[type="radio"]').length, svgs: doc.querySelectorAll('#problemsArea svg').length };
      assert(hasInput || hasOpt || hasSvg, '存在可作答控件');

      // 4) 答题：填全部输入框（选择类点第一个选项）
      doc.querySelectorAll('#problemsArea input[data-index], #problemsArea input[data-idx]').forEach(i => { i.value = '1'; });
      doc.querySelectorAll('#problemsArea input[type="radio"]').forEach((r, idx) => { if (idx === 0) r.checked = true; });
      doc.querySelectorAll('#problemsArea .opt').forEach((o, idx) => { if (idx === 0) o.click(); });

      // 5) 批改：checkBtn
      doc.getElementById('checkBtn').click();
      await waitFor(win, w => w.document.getElementById('resultArea').classList.contains('show'), 10000, '批改结果');
      const score = doc.querySelector('#resultArea .score');
      assert(score, '结果区出现分数');
      R.score = score.textContent;
      R.detail = doc.querySelector('#resultArea .detail') ? doc.querySelector('#resultArea .detail').textContent : '';
      assert(/分/.test(R.score), '分数格式');
      R.adaptiveStored = false; // 自适应难度记录功能已移除（hw_adaptive_v2 不再写入）

      // 6) 错题重做：点击 redoBtn 后进入错题答题态
      //    注：全部答错时 wrong==before，重做题数不变（10→10），故不要求数量严格减少；
      //    核心断言 = 题数不增且非空 + 结果区关闭（回到答题态）+ 检查按钮重新可用
      const wrongCount = doc.querySelectorAll('#problemsArea .question-card.wrong, #problemsArea .problem.wrong').length;
      const redoBtn = doc.getElementById('redoBtn');
      if (redoBtn) {
        const before = doc.querySelectorAll('#problemsArea .question-card, #problemsArea .problem').length;
        redoBtn.click();
        await waitFor(win, w => {
          const cards = w.document.querySelectorAll('#problemsArea .question-card, #problemsArea .problem').length;
          const ra = w.document.getElementById('resultArea');
          const cb = w.document.getElementById('checkBtn');
          return cards > 0 && cards <= before && ra && !ra.classList.contains('show') && cb && !cb.disabled;
        }, 5000, '错题重做');
        R.redoReduced = true;
        R.redoWrong = wrongCount;
      } else {
        R.redoReduced = null; // 全对无错题
        R.allCorrect = true;
      }
    }

    // 7) 打印：printBtn → Print.open 被调用（新窗口被拦截，不抛错即 PASS）
    doc.getElementById('printBtn').click();
    await new Promise(r => setTimeout(r, 400));
    R.printClicked = true;

    // 8) 显示答案
    const revealBtn = doc.getElementById('revealBtn');
    if (revealBtn && !revealBtn.disabled) {
      revealBtn.click();
      await new Promise(r => setTimeout(r, 300));
      R.revealShown = doc.querySelectorAll('#problemsArea .revealed-answer').length > 0;
    }

    console.log('✅ PASS  ' + c.name + '  cards=' + R.cards + ' ' + JSON.stringify(R.rendered) + ' score=' + R.score + ' adaptive=' + R.adaptiveStored + ' redo=' + (R.redoReduced === null ? '全对' : R.redoReduced));
    pass++;
  } catch (e) {
    fail++;
    failures.push({ name: c.name, err: e.message });
    console.log('❌ FAIL  ' + c.name + '  ' + e.message);
  } finally {
    dom.window.close();
  }
}

(async () => {
  await new Promise(r => server.listen(PORT, r));
  console.log('静态服务器启动 :' + PORT);
  for (const c of CASES) await runCase(c);
  server.close();
  console.log('\n========== 结果 ==========');
  console.log('通过 ' + pass + ' / ' + CASES.length);
  if (failures.length) { failures.forEach(f => console.log('  ❌ ' + f.name + ': ' + f.err)); process.exit(1); }
  console.log('🎉 practice.html 全链路闭环验收通过');
})();
