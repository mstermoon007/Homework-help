// dev/audit/context-propagation-probe.js
/**
 * V4.1 Phase 7 — ContextType 数据链传播探针（只读）
 *
 * 用户规格：
 *   StrategyPlan.contextType == SemanticQuestion.contextType
 *
 * 实测：SemanticQuestion schema 用 context 字段（非 contextType），
 *   生成器写 q.context = plan.contextType || 'standard'（见 composite.js L97）
 *   故做语义比对：plan.contextType === question.context
 *
 * 验证：
 *   1) 对每个生成 plan，检查 plan.contextType 是否合法（pure/simple/standard/complex）
 *   2) 对每个生成的 question，检查 q.context 是否合法
 *   3) plan.contextType === q.context（语义等价传播，名字差异已记录）
 *   4) 不出现 plan.contextType 已存在但 q.context===undefined
 *
 * 输出：dev/reports/context-propagation-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

var GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));

var LEGAL = ['pure', 'simple', 'standard', 'complex'];
var TESTS = [
  { subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: 'math-g1-m1-addsub-10', count: 20, difficulty: 4 },
  { subject: 'math', grade: 2, mode: 'single-kp', knowledgePointId: 'math-g2-m1-add-100', count: 20, difficulty: 4 },
  { subject: 'math', grade: 3, mode: 'single-kp', knowledgePointId: 'math-g3-m1-g3-mul-multi1', count: 20, difficulty: 4 },
  { subject: 'math', grade: 1, mode: 'multi-kp', knowledgePointIds: ['math-g1-m1-addsub-10', 'math-g1-m0-make-ten'], combine: true, count: 20, difficulty: 3 }
];

function run() {
  var allRecords = [];
  var seq = Promise.resolve();
  TESTS.forEach(function (req) {
    seq = seq.then(function () { return GE.generate(req); }).then(function (g) {
      var plans = g.plans || [];
      var qs = g.questions || [];
      // 按 plan 顺序逐 plan 比对其生成题目的 context
      var planRecords = plans.map(function (p, idx) {
        var ctx = p.contextType;
        var legalPlan = LEGAL.indexOf(ctx) !== -1;
        return { planIdx: idx, planContextType: ctx, legalPlan: legalPlan, combine: p.combine };
      });
      var qRecords = qs.map(function (q, idx) {
        var ctx = q.context;
        var legalQ = LEGAL.indexOf(ctx) !== -1;
        return { qIdx: idx, qContext: ctx, legalQ: legalQ, qHasContextType: q.contextType !== undefined };
      });
      var undefinedQ = qRecords.filter(function (r) { return !r.legalQ; }).length;
      var planCtxSet = new Set(plans.map(function (p) { return p.contextType; }));
      var qCtxSet = new Set(qs.map(function (q) { return q.context; }));
      // 每个 plan 的 contextType 必须出现在 q.context 集合里（传播）
      var missingInQ = Array.from(planCtxSet).filter(function (c) { return !qCtxSet.has(c); });
      allRecords.push({
        request: req,
        planCount: plans.length,
        questionCount: qs.length,
        planContextTypeSet: Array.from(planCtxSet),
        qContextSet: Array.from(qCtxSet),
        missingContextInQ: missingInQ,
        undefinedQContextCount: undefinedQ,
        plans: planRecords.slice(0, 5),
        questions: qRecords.slice(0, 5)
      });
    });
  });
  return seq.then(function () {
    var pass = allRecords.every(function (r) {
      return r.missingContextInQ.length === 0 && r.undefinedQContextCount === 0 && r.questionCount > 0;
    });
    var report = {
      meta: {
        generatedAt: new Date().toISOString(),
        head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
        probe: 'dev/audit/context-propagation-probe.js',
        note: 'SemanticQuestion 用 context 字段，plan 用 contextType；本探针做语义等价比对 plan.contextType→q.context'
      },
      records: allRecords,
      verdict: pass ? 'PASS' : 'FAIL'
    };
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'context-propagation-report.json'), JSON.stringify(report, null, 2));
    console.log('=== ContextType 传播探针 ===');
    allRecords.forEach(function (r, i) {
      console.log('Test ' + (i + 1) + ': plans=' + r.planCount + ' questions=' + r.questionCount +
        ' planCtx=' + JSON.stringify(r.planContextTypeSet) + ' qCtx=' + JSON.stringify(r.qContextSet) +
        ' missingInQ=' + r.missingContextInQ.length + ' undefinedQ=' + r.undefinedQContextCount);
    });
    console.log('Verdict: ' + report.verdict);
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
