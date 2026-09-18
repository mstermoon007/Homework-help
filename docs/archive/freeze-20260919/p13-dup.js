/**
 * P0-11 产品回归 Step 09：重复题回归（Node 层）
 * 同轮重复 = 0；跨轮重复 = 0（previousGeneration.fingerprints 注入）；容量降级如实入账
 */
'use strict';
var ROOT = '/Users/zhanggaozhang/Code/Homework Help';
require(ROOT + '/dev/_bundle-env.js');
var PracticeSession = require(ROOT + '/shared/engine/practice-session.js');

var fails = [];
function assert(name, cond, detail) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) fails.push(name);
}
function qfingerprint(q) {
  var stem = (q.question && q.question.prompt) || q.q || q.prompt || q.text || JSON.stringify(q.content || '');
  return String(stem).trim() + '#' + String(q.answer != null ? JSON.stringify(q.answer) : '');
}

(async function main() {
  console.log('=== Step 09 重复题回归 ===');

  // --- 1. 同轮重复（单轮 12 题 calc） ---
  var s1 = new PracticeSession({ subject: 'math', grade: 1, count: 12,
    knowledgePointId: 'math-g1-up-u05-k001', questionType: 'calc' });
  var r1 = await s1.start();
  var q1 = s1.semanticQuestions || [];
  var fp1 = {};
  var dupInRound = 0;
  q1.forEach(function (q) { var f = qfingerprint(q); if (fp1[f]) dupInRound++; fp1[f] = 1; });
  assert('同轮 12 题：指纹重复 = 0', dupInRound === 0, '重复 ' + dupInRound + ' / 生成 ' + q1.length + ' 题');
  assert('同轮 seenKeys 已记录（去重账本）', !!(s1.lastSemantic && s1.lastSemantic.seenKeys),
    'seenKeys=' + (s1.lastSemantic && s1.lastSemantic.seenKeys ? Object.keys(s1.lastSemantic.seenKeys).length : '无'));

  // --- 2. 跨轮重复（注入上一代指纹） ---
  var s2 = new PracticeSession({ subject: 'math', grade: 1, count: 12,
    knowledgePointId: 'math-g1-up-u05-k001', questionType: 'calc',
    previousGeneration: {
      generationId: s1.lastSemantic && s1.lastSemantic.generationId,
      fingerprints: s1.lastSemantic && s1.lastSemantic.seenKeys
    } });
  await s2.start();
  var q2 = s2.semanticQuestions || [];
  var crossDup = 0;
  q2.forEach(function (q) { if (fp1[qfingerprint(q)]) crossDup++; });
  assert('跨轮 12 题（注入 fingerprints）：与上一代重复 = 0', crossDup === 0,
    '重复 ' + crossDup + ' / 第二轮 ' + q2.length + ' 题');

  // --- 3. 刷新后重新生成（无注入 = 新会话语义）+ 大题量降级真实性 ---
  var s3 = new PracticeSession({ subject: 'math', grade: 1, count: 40,
    knowledgePointId: 'math-g1-up-u05-k001', questionType: 'calc' });
  var r3 = await s3.start();
  var ledger3 = (s3.lastSemantic && s3.lastSemantic.orchestration) || {};
  var q3 = s3.semanticQuestions || [];
  var fp3 = {}; var dup3 = 0;
  q3.forEach(function (q) { var f = qfingerprint(q); if (fp3[f]) dup3++; fp3[f] = 1; });
  console.log('    大题量: requested=' + ledger3.requestedCount + ' planned=' + ledger3.plannedCount +
    ' generated=' + ledger3.generatedCount + ' status=' + ledger3.status + ' reason=' + ledger3.reason);
  assert('大题量 40：同轮指纹重复 = 0（容量内不伪造重复）', dup3 === 0, '重复 ' + dup3);
  assert('大题量 40：账本如实入账（generated ≤ planned，status/reason 如实）',
    ledger3.generatedCount <= ledger3.plannedCount && ledger3.plannedCount <= ledger3.requestedCount,
    'status=' + ledger3.status + ' reason=' + ledger3.reason);
  assert('刷新/新会话语义：无注入的新会话正常生成', q3.length > 0, q3.length + ' 题');

  if (fails.length) { console.error('\nFAIL ' + fails.length + ' — ' + fails.join(' | ')); process.exit(1); }
  console.log('\nPASS — Step 09 重复题回归（同轮=0 / 跨轮=0 / 降级如实入账）');
})().catch(function (e) { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
