/**
 * GAP-4 + P0-05 FINAL Step 20：题量/难度冻结规则回归（只验证，不修改）
 * 冻结规则：
 *   题量：requested ≥ planned ≥ generated = final；Σ cells = planned
 *   题型：selectedTypes = allowed set（产出 ⊆ selected ⊆ 请求）
 *   难度：difficulty ∈ 1..10 整数（difficulty.js 唯一公式，Strategy 只消费）
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

function sumCells(cells) {
  return (cells || []).reduce(function (a, c) { return a + (c.count || 0); }, 0);
}
function intDiff(n) { return Number.isInteger(n) && n >= 1 && n <= 10; }

async function runCase(name, cfg, reqTypes) {
  var session = new PracticeSession(cfg);
  var r = await session.start();
  var last = session.lastSemantic || {};
  var ledger = last.orchestration || {};
  var plans = last.plans || [];
  var qs = session.semanticQuestions || [];
  var legacy = (r && r.questions) || [];

  var requested = ledger.requestedCount;
  var planned = ledger.plannedCount;
  var generated = ledger.generatedCount;
  var fin = ledger.finalCount;

  console.log('\n--- ' + name + ' ---');
  console.log('    requested=' + requested + ' planned=' + planned + ' generated=' + generated +
    ' final=' + fin + ' legacy=' + legacy.length + ' cells=' + JSON.stringify(ledger.kpTypeMatrix));

  // 题量闭环：requested ≥ planned ≥ generated = final
  assert(name + ' requested ≥ planned', requested >= planned,
    requested + ' vs ' + planned);
  assert(name + ' planned ≥ generated', planned >= generated, planned + ' vs ' + generated);
  assert(name + ' generated = final（账本/语义题/legacy 三处一致）',
    generated === fin && qs.length === fin && legacy.length === fin,
    'ledger=' + generated + '/' + fin + ' semantic=' + qs.length + ' legacy=' + legacy.length);

  // Σ cells = planned（POL 预算守恒）
  var sc = sumCells(ledger.kpTypeMatrix);
  assert(name + ' Σ cells = planned', sc === planned, 'Σ cells=' + sc + ' planned=' + planned);

  // 题型：selectedTypes = allowed set
  var sel = ledger.selectedTypes || [];
  assert(name + ' selectedTypes ⊆ 请求题型',
    sel.length > 0 && sel.every(function (t) { return reqTypes.indexOf(t) !== -1; }),
    'selected=[' + sel.join(',') + '] allowed=[' + reqTypes.join(',') + ']');
  assert(name + ' 产出题型 ⊆ selectedTypes',
    qs.every(function (q) { return sel.indexOf(q.questionType) !== -1; }),
    '产出=[' + qs.map(function (q) { return q.questionType; }).join(',') + ']');

  // 难度：plan 与 question 均 1..10 整数（difficulty.js 唯一公式口径；Strategy 只消费）
  var planDok = plans.every(function (p) { return intDiff(p.difficulty); });
  var qDok = qs.every(function (q) { return intDiff(Number(q.difficulty)); });
  assert(name + ' 难度域 1..10 整数（plan × question）', planDok && qDok,
    'plan=[' + plans.map(function (p) { return p.difficulty; }).join(',') + '] q=[' +
    qs.slice(0, 5).map(function (q) { return q.difficulty; }).join(',') + '...]');
}

(async function main() {
  console.log('=== Step 20 题量/难度冻结规则回归 ===');

  // Case A：单 KP × 单题型（显式 KP → POL cell 编排）
  await runCase('A 单KP×calc count=5', {
    subject: 'math', grade: 2, count: 5,
    knowledgePointId: 'math-g1-up-u05-k001', questionType: 'calc'
  }, ['calc']);

  // Case B：多 KP × 多题型（cell = KP×QT，跨题型预算分配）
  await runCase('B 多KP×[calc,fill] count=6', {
    subject: 'math', grade: 2, count: 6,
    knowledgePointIds: ['math-g1-up-u05-k001', 'math-g2-down-u07-k002'],
    questionTypes: ['calc', 'fill']
  }, ['calc', 'fill']);

  // Case C：单 KP × 双题型（小题量，验证 PARTIAL 语义下账本仍守恒）
  await runCase('C 单KP×[calc,fill] count=4', {
    subject: 'math', grade: 2, count: 4,
    knowledgePointId: 'math-g2-down-u07-k002',
    questionTypes: ['calc', 'fill']
  }, ['calc', 'fill']);

  if (fails.length) { console.error('\nFAIL ' + fails.length + ' — ' + fails.join(' | ')); process.exit(1); }
  console.log('\nPASS — Step 20 题量/难度冻结规则回归（requested ≥ planned ≥ generated = final；Σ cells = planned；selectedTypes = allowed set；难度 1..10）');
})().catch(function (e) { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
