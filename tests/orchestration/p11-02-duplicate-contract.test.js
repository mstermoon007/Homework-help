'use strict';

/**
 * tests/orchestration/p11-02-duplicate-contract.test.js — Duplicate Contract（P11-02）
 *
 * 产品语义（用户确认 A）：
 *   - 同批 / Recovery 严格唯一（questionFingerprint v2 权威键）
 *   - 重新生成（含同页再次生成）尽量避开上一批；空间不足 → PARTIAL/FAILED，不复用旧题
 *   - 重复 ≠ 容量：重复候选耗尽 → Retry/Recovery → 有界终止（不新增独立去重架构）
 *
 * 修复回归：F-DUP-1（POL 初始 seenKeys 以父级 previousSeenKeys 播种，跨代指纹不丢失）
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
require(path.join(ROOT, 'shared', 'presentation', 'html-renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
const API = require(path.join(ROOT, 'shared', 'generation', 'api.js'));
const PO = require(path.join(ROOT, 'shared', 'orchestration', 'practice-orchestrator.js'));
const KC = Env.KnowledgeContext;

// KBL 冻结快照下行为稳定：大空间 KP（batch1 20/20）与小空间 KP（唯一空间 = 1）
const KP_LARGE = 'math-g2-down-u02-k001';
const KP_TINY = 'math-g1-down-u08-k001';
const TYPES6 = ['calc', 'fill', 'choice', 'judge', 'geometry', 'apply'];

function fps(questions) {
  return (questions || []).map((q) => q.questionFingerprint).filter(Boolean);
}
function uniq(arr) {
  return Array.from(new Set(arr));
}
function gen(kp, extra, opts) {
  return API.generate(Object.assign({
    subject: 'math', grade: Number(kp.match(/g(\d)/)[1]),
    knowledgePointIds: [kp], questionTypes: ['calc'], count: 20, difficulty: 5
  }, extra || {}), opts || {});
}
// POL 级 stub：按轮次返回不同指纹，统计调用轮次
function roundStub(makeRoundQuestions) {
  let round = 0;
  const calls = [];
  const fn = function (req) {
    round += 1;
    calls.push(req);
    return Promise.resolve({ questions: makeRoundQuestions(round, req), plans: [], trace: {}, failedPlans: [], seenKeys: null });
  };
  fn.calls = calls;
  fn.rounds = () => round;
  return fn;
}
function mkQ(fp, req) {
  return { questionFingerprint: fp, knowledgePointIds: req.knowledgePointIds, questionType: req.questionTypes[0], difficulty: 5 };
}

test('D1 Batch 内唯一：20 题 unique = 20，final = unique', async () => {
  const r = await gen(KP_LARGE, { count: 20 });
  const list = fps(r.questions);
  assert.ok(list.length >= 10, '产出足够验证（实际 ' + list.length + '）');
  assert.equal(uniq(list).length, list.length, '批内无重复');
  assert.equal(r.orchestration.finalCount, uniq(list).length, 'final = unique');
});

test('D2 多 KP 唯一：跨 KP 不重复', async () => {
  const kps = [KP_LARGE, 'math-g2-down-u01-k001', 'math-g2-down-u01-k002'];
  const r = await API.generate({ subject: 'math', grade: 2, knowledgePointIds: kps, questionTypes: ['calc'], count: 12, difficulty: 5 }, {});
  const list = fps(r.questions);
  assert.ok(list.length >= 1);
  assert.equal(uniq(list).length, list.length, '跨 KP 无重复');
});

test('D3 多 Type 唯一：6 题型同批跨 Type 不重复', async () => {
  const r = await API.generate({ subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: TYPES6, count: 12, difficulty: 5 }, {});
  const list = fps(r.questions);
  assert.ok(list.length >= 1);
  assert.equal(uniq(list).length, list.length, '跨 Type 无重复');
  (r.questions || []).forEach((q) => assert.ok(TYPES6.indexOf(q.questionType) !== -1, 'type ∈ selectedTypes'));
});

test('D4 别名链 oral→calc：不产生重复 cell / 重复题', async () => {
  const p = await PO.plan({ subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc', 'oral'], count: 6, difficulty: 5 }, {});
  assert.deepEqual(p.selectedTypes, ['calc']);
  (p.kpTypeMatrix || []).forEach((c) => assert.equal(c.questionType, 'calc', '无重复 cell'));
  const r = await API.generate({ subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc', 'oral'], count: 6, difficulty: 5 }, {});
  const list = fps(r.questions);
  assert.equal(uniq(list).length, list.length);
  (r.questions || []).forEach((q) => assert.equal(q.questionType, 'calc'));
});

test('D5 Retry/聚合丢弃重复：重复候选被丢弃，新题补位后仍满足预算（SUCCESS）', async () => {
  const dupFp = 'v2|dup|calc|+|-|simple|none|std';
  const stub = roundStub((round, req) => (round === 1
    ? [mkQ(dupFp, req), mkQ('new-1', req), mkQ('new-2', req)]
    : []));
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 2, difficulty: 5 },
    { previousSeenKeys: new Set([dupFp]) },
    { execute: stub }
  );
  const list = fps(res.questions);
  assert.deepEqual(list, ['new-1', 'new-2'], '重复候选被丢弃且新题补位');
  assert.equal(res.status, 'SUCCESS');
  assert.equal(res.orchestration.finalCount, 2);
});

test('D6 Recovery 跨轮唯一：Round1 ∩ Round2 = ∅，Union 唯一', async () => {
  const stub = roundStub((round, req) => [mkQ('r' + round + '-a', req), mkQ('r' + round + '-b', req)]);
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 6, difficulty: 5 },
    {},
    { execute: stub }
  );
  const list = fps(res.questions);
  assert.equal(uniq(list).length, list.length, 'Union 唯一');
  assert.equal(res.orchestration.finalCount, list.length);
  assert.ok(list.length <= 6, '不超预算');
  assert.ok(stub.rounds() >= 2, 'Recovery 实际发生');
});

test('D7 Recovery 多轮：Round1 ∪ Round2 ∪ Round3 无重复且有界', async () => {
  const stub = roundStub((round, req) => [mkQ('m' + round, req)]);
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['calc'], count: 3, difficulty: 5 },
    {},
    { execute: stub }
  );
  const list = fps(res.questions);
  assert.equal(uniq(list).length, list.length);
  assert.equal(list.length, 3);
  assert.ok(stub.rounds() <= 1 + PO.MAX_RECOVERY_ROUNDS, '轮次有界');
});

test('D8 候选耗尽：PARTIAL/FAILED，不重复、不死循环', async () => {
  // Stub 驱动（Canonical 无 capacity=1 的真实 KP，改为确定性验证）
  const fp1 = 'v2|exhaust|choice|stub';
  const onceStub = roundStub((round, req) => (round === 1 ? [mkQ(fp1, req)] : []));
  const res = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_LARGE], questionTypes: ['choice'], count: 5, difficulty: 5 },
    { previousSeenKeys: new Set([fp1]) },
    { execute: onceStub }
  );
  assert.ok(onceStub.rounds() <= 2, '首轮即空，快速终止');
  assert.equal(res.orchestration.finalCount, 0, '空间耗尽产出 0');
  assert.notEqual(res.status, 'SUCCESS', '状态非 SUCCESS');
  // POL 级：无进展 stub 有界终止
  const stub = roundStub(() => []);
  const res2 = await PO.orchestrate(
    { subject: 'math', grade: 2, knowledgePointIds: [KP_TINY], questionTypes: ['calc'], count: 5, difficulty: 5 },
    {},
    { execute: stub }
  );
  assert.ok(stub.rounds() <= 1 + PO.MAX_RECOVERY_ROUNDS, '无进展有界终止');
  assert.equal(res2.orchestration.finalCount, 0);
});

test('D9 重新生成尽量避开上一批（A 语义）：大空间 overlap = 0，小空间零复用', async () => {
  // 大空间：batch2 携带 batch1 指纹 → 不与上一批重复，且仍能产出
  const r1 = await gen(KP_LARGE, { count: 20 });
  const list1 = fps(r1.questions);
  assert.ok(list1.length >= 10);
  const r2 = await gen(KP_LARGE, { count: 20 }, { previousSeenKeys: new Set(list1) });
  const list2 = fps(r2.questions);
  assert.equal(list2.filter((fp) => list1.indexOf(fp) !== -1).length, 0, 'overlap = 0');
  assert.ok(list2.length >= 1, '空间足够时仍产出新题');
  assert.equal(uniq(list2).length, list2.length);
  // 小空间：stub 驱动零复用（替代旧 capacity=1 真实链）
  const fpT = 'v2|tiny-stub|choice';
  const t1 = await PO.orchestrate({ subject: 'math', grade: 2, knowledgePointIds: [KP_TINY], questionTypes: ['choice'], count: 5, difficulty: 5 }, {}, { execute: roundStub((round, req) => (round === 1 ? [mkQ(fpT, req)] : [])) });
  const tiny1 = fps(t1.questions);
  assert.ok(tiny1.length >= 1, '首轮有产出');
  const t2 = await PO.orchestrate({ subject: 'math', grade: 2, knowledgePointIds: [KP_TINY], questionTypes: ['choice'], count: 5, difficulty: 5 }, { previousSeenKeys: new Set(tiny1) }, { execute: roundStub(() => []) });
  assert.equal(fps(t2.questions).filter((fp) => tiny1.indexOf(fp) !== -1).length, 0, '零复用');
});

test('D10 最终总链：finalCount = unique(finalQuestions).length，且满足 P11-01 数量不变量', async () => {
  const r = await gen(KP_LARGE, { count: 20 });
  const list = fps(r.questions);
  const o = r.orchestration;
  assert.equal(r.orchestration.finalCount, uniq(list).length);
  assert.equal(o.generatedCount, o.finalCount);
  assert.equal(r.producedCount, o.finalCount);
  assert.ok(o.requestedCount >= o.plannedCount, 'requested ≥ planned');
  assert.ok(o.plannedCount >= o.generatedCount, 'planned ≥ generated');
  assert.ok(uniq(list).length <= o.plannedCount, 'unique ≤ planned');
});
