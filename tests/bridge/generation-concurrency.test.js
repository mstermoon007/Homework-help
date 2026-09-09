'use strict';

/**
 * C1 — Generation Request Concurrency Closure 回归测试
 *
 * 验证 PracticeBridge 的 latest-request-wins 语义：
 *   - 异步回调不得重读可变全局 _session（闭包持有本次 session）
 *   - 旧请求即使先完成/失败，也不得向 UI emit（最新请求唯一提交权）
 *   - combine 标志经 ControlService → sessionConfig → PracticeSession config 完整透传
 *
 * 手段：桩 PracticeSession（global.PracticeSession）注入可控 deferred，
 * 不加载真实生成层（竞态是关联层职责，与生成层无关）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..', '..');

function defer() {
  const d = {};
  d.promise = new Promise(function (res, rej) { d.resolve = res; d.reject = rej; });
  return d;
}

function installStubSession() {
  function StubSession(config) {
    this.config = config;
    this._start = null;
    this._submit = null;
    StubSession.instances.push(this);
  }
  StubSession.instances = [];
  StubSession.prototype.start = function () { this._start = defer(); return this._start.promise; };
  StubSession.prototype.submit = function () { this._submit = defer(); return this._submit.promise; };
  global.PracticeSession = StubSession;
  return StubSession;
}

const flush = () => new Promise(function (r) { setImmediate(r); }).then(() => new Promise(function (r) { setImmediate(r); }));

function freshBridge(Stub) {
  // 桥为单例：每轮换回调收集器；instances 清空
  Stub.instances.length = 0;
  delete require.cache[require.resolve(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'))];
  const Bridge = require(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'));
  return Bridge;
}

const baseUi = (kp) => ({ knowledgePointId: kp || 'math-g1-m1-addsub-10', count: 20, difficulty: 2 });

test('C1-T1：A、B 连续启动，A 先完成 → UI 只收到 B 的成功反馈', async () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  const events = [];
  Bridge.onStartFeedback((fb) => events.push(fb));

  Bridge.start(baseUi('kp-a'));
  const A = Stub.instances[0];
  Bridge.start(baseUi('kp-b'));
  const B = Stub.instances[1];

  A._start.resolve({ questions: ['qa'], html: 'A', meta: { id: 'A' } });
  await flush();
  B._start.resolve({ questions: ['qb'], html: 'B', meta: { id: 'B' } });
  await flush();

  assert.equal(events.length, 1, '旧请求 A 不得 emit');
  assert.equal(events[0].ok, true);
  assert.equal(events[0].session, B, '反馈必须归属最新会话 B');
  assert.deepEqual(events[0].questions, ['qb']);
});

test('C1-T2：A、B 连续启动，B 先完成 → UI 仍只收到 B', async () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  const events = [];
  Bridge.onStartFeedback((fb) => events.push(fb));

  Bridge.start(baseUi('kp-a'));
  const A = Stub.instances[0];
  Bridge.start(baseUi('kp-b'));
  const B = Stub.instances[1];

  B._start.resolve({ questions: ['qb'], html: 'B', meta: { id: 'B' } });
  await flush();
  A._start.resolve({ questions: ['qa'], html: 'A', meta: { id: 'A' } });
  await flush();

  assert.equal(events.length, 1);
  assert.equal(events[0].session, B);
});

test('C1-T3：A 失败、B 成功 → UI 只收到 B 成功，不弹 A 错误', async () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  const events = [];
  Bridge.onStartFeedback((fb) => events.push(fb));

  Bridge.start(baseUi('kp-a'));
  const A = Stub.instances[0];
  Bridge.start(baseUi('kp-b'));
  const B = Stub.instances[1];

  A._start.reject(new Error('A boom'));
  await flush();
  B._start.resolve({ questions: ['qb'], html: 'B', meta: { id: 'B' } });
  await flush();

  assert.equal(events.length, 1);
  assert.equal(events[0].ok, true);
  assert.equal(events[0].session, B);
});

test('C1-T4：A 成功、B 失败 → UI 只收到 B 失败，不显示 A 成功', async () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  const events = [];
  Bridge.onStartFeedback((fb) => events.push(fb));

  Bridge.start(baseUi('kp-a'));
  const A = Stub.instances[0];
  Bridge.start(baseUi('kp-b'));
  const B = Stub.instances[1];

  A._start.resolve({ questions: ['qa'], html: 'A', meta: { id: 'A' } });
  await flush();
  B._start.reject(new Error('B boom'));
  await flush();

  assert.equal(events.length, 1);
  assert.equal(events[0].ok, false);
  assert.equal(events[0].session, B, '失败反馈也必须归属最新会话 B');
  assert.equal(events[0].error.code, 'E_GENERATE');
});

test('C1-T5：combine=true 经 Bridge → PracticeSession config 完整透传', () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  Bridge.onStartFeedback(() => {});

  Bridge.start({ combine: true, knowledgePoints: ['math-g1-m1-addsub-10', 'math-g1-m0-make-ten'], count: 20, difficulty: 2 });
  const session = Stub.instances[Stub.instances.length - 1];
  assert.equal(session.config.combine, true, 'config.combine 必须为 true');
  assert.ok(Array.isArray(session.config.knowledgePointIds) && session.config.knowledgePointIds.length === 2);
});

test('C1-T6：未传 combine → config.combine 为 false（单 KP 不进合并）', () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  Bridge.onStartFeedback(() => {});

  Bridge.start(baseUi());
  const session = Stub.instances[Stub.instances.length - 1];
  assert.strictEqual(session.config.combine, false);
});

test('C1-T7：submit 回调期间开启新生成 → 旧批改反馈丢弃，新会话反馈正常', async () => {
  const Stub = installStubSession();
  const Bridge = freshBridge(Stub);
  const startEvents = [];
  const submitEvents = [];
  Bridge.onStartFeedback((fb) => startEvents.push(fb));
  Bridge.onSubmitFeedback((fb) => submitEvents.push(fb));

  Bridge.start(baseUi('kp-a'));
  const A = Stub.instances[0];
  A._start.resolve({ questions: ['qa'], html: 'A' });
  await flush();

  // A 会话上发起批改（未返回）
  Bridge.submit();
  // 期间用户重新生成 B
  Bridge.start(baseUi('kp-b'));
  const B = Stub.instances[1];
  A._submit.resolve({ score: 1, total: 1 }); // A 的批改迟到
  await flush();
  B._start.resolve({ questions: ['qb'], html: 'B' });
  await flush();

  assert.equal(submitEvents.length, 0, '旧批改不得 emit');
  // A 的生成反馈在 B 启动前已合法发出（A 当时为最新请求）；B 启动后只应再有 B 一条
  assert.equal(startEvents.length, 2, 'A（当时最新）与 B 各一条生成反馈');
  assert.equal(startEvents[0].session, A);
  assert.equal(startEvents[1].session, B, '最后一条反馈归属最新会话 B');
});
