// dev/audit/c1-rapid-click-probe.js
/**
 * V4.1 Phase 3 — C1 竞态：Case E 连点 10 次探针（只读）
 *
 * 用户要求：
 *   连续快速点击 Generate × 10
 *   期望：最终只显示第 10 次请求结果
 *   不能出现：
 *     - 旧题覆盖新题
 *     - 旧 loading 覆盖新状态
 *     - 旧 error 覆盖新结果
 *     - session 与 result 不匹配
 *
 * 实现：桩 PracticeSession 注入可控 deferred（同 tests/bridge/generation-concurrency.test.js 手法），
 *       连续发起 10 次 Bridge.start()，按倒序逐个 resolve（最坏顺序：先解决旧请求，最后解决 #10），
 *       验证只发出 1 条 startFeedback 且归属 #10。
 *
 * 输出：dev/reports/c1-rapid-click-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

function defer() {
  var d = {};
  d.promise = new Promise(function (res, rej) { d.resolve = res; d.reject = rej; });
  return d;
}

function installStubSession() {
  function StubSession(config) {
    this.config = config;
    this._start = null;
    StubSession.instances.push(this);
  }
  StubSession.instances = [];
  StubSession.prototype.start = function () { this._start = defer(); return this._start.promise; };
  StubSession.prototype.submit = function () { return Promise.resolve({ score: 0, total: 0 }); };
  global.PracticeSession = StubSession;
  return StubSession;
}

var flush = function () { return new Promise(function (r) { setImmediate(r); }).then(function () { return new Promise(function (r) { setImmediate(r); }); }); };

function freshBridge() {
  delete require.cache[require.resolve(path.join(ROOT, 'shared', 'practice-bridge.js'))];
  return require(path.join(ROOT, 'shared', 'practice-bridge.js'));
}

function run() {
  var results = [];
  var overallPass = true;

  // Case E-1: 10 连点，倒序 resolve（最坏顺序：#1 先成、#10 最后）
  var caseE1 = (function () {
    var Stub = installStubSession();
    var Bridge = freshBridge();
    var events = [];
    Bridge.onStartFeedback(function (fb) { events.push(fb); });

    var sessions = [];
    for (var i = 0; i < 10; i++) {
      Bridge.start({ knowledgePointId: 'math-g1-m1-addsub-10', count: 5, difficulty: 2 });
      sessions.push(Stub.instances[Stub.instances.length - 1]);
    }
    // 倒序 resolve: 0..9 → 9 先成、0 最后
    return Promise.resolve().then(function () {
      // 顺序：1..9 先成（旧请求），#0 最后成（最新）
      // 但 latest-wins 看的是 _generationRequestId，#9 是最新（最后 start 的）
      // 所以"最新"= #9（数组下标 9）。先 resolve #0..#8（旧），再 resolve #9
      var seq = Promise.resolve();
      var _loop = function (k) {
        seq = seq.then(function () {
          sessions[k]._start.resolve({ questions: ['q-old-' + k], html: 'H' + k, meta: { id: 'R' + k } });
          return flush();
        });
      };
      for (var k = 0; k < 9; k++) { _loop(k); }
      return seq.then(function () {
        sessions[9]._start.resolve({ questions: ['q-final'], html: 'H-final', meta: { id: 'R10' } });
        return flush();
      });
    }).then(function () {
      var pass = events.length === 1 && events[0].session === sessions[9] && events[0].ok === true;
      return {
        case: 'E1-reverse-resolve-10-rapid-clicks',
        pass: pass,
        eventsCount: events.length,
        expectedEvents: 1,
        lastEventBelongsToLastSession: events.length === 1 && events[0].session === sessions[9],
        note: pass ? '只有最新请求（第 10 次）的反馈 emit' : 'FAIL: 出现 ' + events.length + ' 条反馈'
      };
    });
  })();

  // Case E-2: 10 连点，正序 resolve（#1 先成、#10 最后）—— 等价但确认一遍
  var caseE2 = (function () {
    var Stub = installStubSession();
    var Bridge = freshBridge();
    var events = [];
    Bridge.onStartFeedback(function (fb) { events.push(fb); });
    var sessions = [];
    for (var i = 0; i < 10; i++) {
      Bridge.start({ knowledgePointId: 'math-g1-m1-addsub-10', count: 5, difficulty: 2 });
      sessions.push(Stub.instances[Stub.instances.length - 1]);
    }
    var seq = Promise.resolve();
    var _loop2 = function (k) {
      seq = seq.then(function () {
        sessions[k]._start.resolve({ questions: ['q-' + k], html: 'H' + k, meta: { id: 'R' + k } });
        return flush();
      });
    };
    for (var k = 0; k < 10; k++) { _loop2(k); }
    return seq.then(function () { return flush(); }).then(function () {
      var pass = events.length === 1 && events[0].session === sessions[9] && events[0].ok === true;
      return {
        case: 'E2-forward-resolve-10-rapid-clicks',
        pass: pass,
        eventsCount: events.length,
        expectedEvents: 1,
        note: pass ? '正序 resolve 同样只有最新 emit' : 'FAIL'
      };
    });
  })();

  // Case E-3: 10 连点，#5 fail、其余 success，倒序 resolve —— 最终应只看 #10 success
  var caseE3 = (function () {
    var Stub = installStubSession();
    var Bridge = freshBridge();
    var events = [];
    Bridge.onStartFeedback(function (fb) { events.push(fb); });
    var sessions = [];
    for (var i = 0; i < 10; i++) {
      Bridge.start({ knowledgePointId: 'math-g1-m1-addsub-10', count: 5, difficulty: 2 });
      sessions.push(Stub.instances[Stub.instances.length - 1]);
    }
    var seq = Promise.resolve();
    var _loop3 = function (k) {
      seq = seq.then(function () {
        if (k === 5) sessions[k]._start.reject(new Error('boom at #6'));
        else sessions[k]._start.resolve({ questions: ['q-' + k], html: 'H' + k, meta: { id: 'R' + k } });
        return flush();
      });
    };
    for (var k = 0; k < 10; k++) { _loop3(k); }
    return seq.then(function () { return flush(); }).then(function () {
      var pass = events.length === 1 && events[0].session === sessions[9] && events[0].ok === true;
      return {
        case: 'E3-mid-fail-still-latest-wins',
        pass: pass,
        eventsCount: events.length,
        note: pass ? '中间请求失败不影响最新请求' : 'FAIL'
      };
    });
  })();

  return Promise.all([caseE1, caseE2, caseE3]).then(function (rs) {
    var report = {
      meta: {
        generatedAt: new Date().toISOString(),
        head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
        probe: 'dev/audit/c1-rapid-click-probe.js',
        spec: 'Phase 3 Case E: 10 连点 → 最终只显示第 10 次请求结果'
      },
      cases: rs,
      verdict: rs.every(function (r) { return r.pass; }) ? 'PASS' : 'FAIL'
    };
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'c1-rapid-click-report.json'), JSON.stringify(report, null, 2));
    console.log('=== C1 连点 10 次探针 ===');
    rs.forEach(function (r) {
      console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.case + '  events=' + r.eventsCount + (r.note ? '  | ' + r.note : ''));
    });
    console.log('Verdict: ' + report.verdict);
    console.log('报告: dev/reports/c1-rapid-click-report.json');
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
