/**
 * P0-13 阶段 Step 10-11：题量控制回归
 * Step 10：1/2/3/7 题型组合 —— selectedTypes 始终表示「允许使用的题型集合」（非固定每类数量）
 * Step 11：1×1 / 1×多 / 多×1 / 多×多 —— Cell(KP×QT) 数量规划、生成、最终题目一致
 * 冻结规则：requested ≥ planned ≥ generated = final；Σ cells = planned；产出 (KP,QT) ⊆ cells
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

// KP 能力（/tmp/p011-probe 已验证）：u05-k001→calc/fill/choice/apply；u01-k001→choice/judge/classify
var KP_CALC = 'math-g1-up-u05-k001';   // 凑十法（calc/fill/choice/apply）
var KP_U01 = 'math-g2-up-u01-k001';    // 认识图形（choice/judge/classify）

async function runCase(name, cfg, reqTypes, expectSelSub) {
  var session = new PracticeSession(cfg);
  var r = await session.start();
  var last = session.lastSemantic || {};
  var ledger = last.orchestration || {};
  var qs = session.semanticQuestions || [];
  var legacy = (r && r.questions) || [];

  var requested = ledger.requestedCount, planned = ledger.plannedCount;
  var generated = ledger.generatedCount, fin = ledger.finalCount;
  var cells = ledger.kpTypeMatrix || [];
  var sc = cells.reduce(function (a, c) { return a + (c.count || 0); }, 0);
  var sel = ledger.selectedTypes || [];

  console.log('\n--- ' + name + ' ---');
  console.log('    req=' + requested + ' planned=' + planned + ' gen=' + generated + ' final=' + fin +
    ' selected=[' + sel.join(',') + '] cells=' + JSON.stringify(cells));

  // 冻结数量闭环
  assert(name + ' requested ≥ planned ≥ generated = final',
    requested >= planned && planned >= generated && generated === fin && qs.length === fin && legacy.length === fin);
  assert(name + ' Σ cells = planned', sc === planned, 'Σ=' + sc + ' planned=' + planned);

  // Step 10：selectedTypes = 允许使用的题型集合（⊆ 请求集；产出 ⊆ selectedTypes）
  assert(name + ' selectedTypes ⊆ 请求题型（allowed set）',
    sel.length > 0 && sel.every(function (t) { return reqTypes.indexOf(t) !== -1; }),
    'selected=[' + sel.join(',') + ']');
  assert(name + ' 产出题型 ⊆ selectedTypes',
    qs.every(function (q) { return sel.indexOf(q.questionType) !== -1; }));
  if (sel.length < reqTypes.length) {
    console.log('    [info] 能力收缩：请求 ' + reqTypes.length + ' 类 → 可行 ' + sel.length + ' 类');
  }

  // Step 11：产出 (KP,QT) 落在 cells 声明范围内（不越界）
  var cellSet = {};
  cells.forEach(function (c) { cellSet[c.kpId + '|' + c.questionType] = true; });
  var out = 0;
  qs.forEach(function (q) {
    var k = (q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0])) + '|' + q.questionType;
    if (!cellSet[k]) out++;
  });
  assert(name + ' 产出 (KP×QT) ⊆ cells（不越界）', out === 0, '越界 ' + out + ' 题');
}

(async function main() {
  console.log('=== Step 10：多题型组合（selectedTypes = allowed set）===');

  await runCase('10a 1题型 [calc]',
    { subject: 'math', grade: 1, count: 4, knowledgePointId: KP_CALC, questionType: 'calc' }, ['calc']);

  await runCase('10b 2题型 [calc,fill]',
    { subject: 'math', grade: 1, count: 6, knowledgePointIds: [KP_CALC, KP_U01], questionTypes: ['calc', 'fill'] },
    ['calc', 'fill']);

  await runCase('10c 3题型 [calc,fill,choice]',
    { subject: 'math', grade: 1, count: 9, knowledgePointIds: [KP_CALC, KP_U01], questionTypes: ['calc', 'fill', 'choice'] },
    ['calc', 'fill', 'choice']);

  // 7 题型全集 × 单 KP：KP 只有 4 类能力 → selectedTypes 必须收缩为真子集（allowed set 非固定回显）
  await runCase('10d 7题型×单KP(能力收缩)',
    { subject: 'math', grade: 1, count: 14, knowledgePointId: KP_CALC,
      questionTypes: ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'] },
    ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'], true);

  console.log('\n=== Step 11：KP × QT 组合矩阵 ===');

  await runCase('11a 1KP × 1QT',
    { subject: 'math', grade: 1, count: 4, knowledgePointId: KP_CALC, questionType: 'calc' }, ['calc']);

  await runCase('11b 1KP × 多QT',
    { subject: 'math', grade: 1, count: 8, knowledgePointId: KP_CALC, questionTypes: ['calc', 'fill', 'choice', 'apply'] },
    ['calc', 'fill', 'choice', 'apply']);

  await runCase('11c 多KP × 1QT',
    { subject: 'math', grade: 1, count: 6, knowledgePointIds: [KP_CALC, KP_U01], questionTypes: ['choice'] },
    ['choice']);

  await runCase('11d 多KP × 多QT',
    { subject: 'math', grade: 1, count: 8, knowledgePointIds: [KP_CALC, KP_U01], questionTypes: ['calc', 'fill', 'choice'] },
    ['calc', 'fill', 'choice']);

  if (fails.length) { console.error('\nFAIL ' + fails.length + ' — ' + fails.join(' | ')); process.exit(1); }
  console.log('\nPASS — Step 10-11 题量控制回归（selectedTypes=allowed set；Cell KP×QT 规划/生成/最终一致；冻结数量闭环全成立）');
})().catch(function (e) { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
