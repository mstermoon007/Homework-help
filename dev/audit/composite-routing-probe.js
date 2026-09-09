// dev/audit/composite-routing-probe.js
/**
 * V4.1 Phase 6 — Composite 路由探针（只读）
 *
 * 用户要求三 case：
 *   Case 1: combine=true + KP1+KP2 → 必须 generator=composite
 *   Case 2: combine=false + KP1    → 不得 generator=composite
 *   Case 3: combine=true + 1 KP    → 必须被拒绝（不得偷偷降级）
 *
 * 实现：
 *   Case 1/2 直接 GE.generate()，从 plan.combine 标志 + plan.knowledgePointIds.length
 *     + 通过 GeneratorSelector.selectGenerator(plan).record.id 验证候选生成器身份
 *   Case 3 用 try/catch 包 GE.build()，期望抛 StrategyError
 *
 * 输出：dev/reports/composite-routing-report.json
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
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var QuestionPlan = require(path.join(ROOT, 'shared', 'strategy', 'question-plan.js'));

var KP1 = 'math-g1-m1-addsub-10';
var KP2 = 'math-g1-m0-make-ten';

function cases() {
  var results = [];

  // Case 1: combine=true + 2 KP → composite
  var c1 = GE.build({
    subject: 'math', grade: 1, mode: 'multi-kp',
    knowledgePointIds: [KP1, KP2], combine: true, count: 5, difficulty: 3
  }).then(function (built) {
    var plans = built.plans || [];
    var compositePlans = plans.filter(function (p) { return p.combine === true && (QuestionPlan.planKnowledgePointIds(p).length >= 2); });
    var selectorResults = plans.map(function (p) {
      try {
        var sel = Selector.selectGenerator(p);
        return { planCombine: p.combine, kpCount: QuestionPlan.planKnowledgePointIds(p).length, generatorId: sel && sel.record && sel.record.id, supportsComposite: sel && sel.record && sel.record.supportsComposite };
      } catch (e) { return { error: String(e && e.message || e) }; }
    });
    var allComposite = selectorResults.every(function (r) { return r.supportsComposite === true || r.generatorId === 'generator:composite'; });
    results.push({
      case: 'C1-combine-true-2kp-must-route-composite',
      pass: plans.length > 0 && compositePlans.length > 0 && allComposite,
      planCount: plans.length,
      compositePlanCount: compositePlans.length,
      selectorResults: selectorResults,
      expectation: 'generator=composite'
    });
  }).catch(function (e) {
    results.push({ case: 'C1-combine-true-2kp-must-route-composite', pass: false, error: String(e && e.message || e) });
  });

  // Case 2: combine=false + 1 KP → not composite
  var c2 = GE.build({
    subject: 'math', grade: 1, mode: 'single-kp',
    knowledgePointId: KP1, count: 5, difficulty: 3
  }).then(function (built) {
    var plans = built.plans || [];
    var selectorResults = plans.map(function (p) {
      try {
        var sel = Selector.selectGenerator(p);
        return { generatorId: sel && sel.record && sel.record.id, supportsComposite: sel && sel.record && sel.record.supportsComposite };
      } catch (e) { return { error: String(e && e.message || e) }; }
    });
    var anyComposite = selectorResults.some(function (r) { return r.supportsComposite === true || r.generatorId === 'generator:composite'; });
    results.push({
      case: 'C2-combine-false-1kp-must-not-route-composite',
      pass: !anyComposite,
      planCount: plans.length,
      selectorResults: selectorResults,
      expectation: 'generator≠composite'
    });
  }).catch(function (e) {
    results.push({ case: 'C2-combine-false-1kp-must-not-route-composite', pass: false, error: String(e && e.message || e) });
  });

  // Case 3: combine=true + 1 KP → must reject (StrategyError)
  var c3 = GE.build({
    subject: 'math', grade: 1, mode: 'multi-kp',
    knowledgePointIds: [KP1], combine: true, count: 5, difficulty: 3
  }).then(function () {
    results.push({
      case: 'C3-combine-true-1kp-must-reject',
      pass: false,
      note: '未抛错，偷偷降级为普通题（违背规格）'
    });
  }).catch(function (e) {
    var msg = String(e && e.message || e);
    var pass = /combine.*至少.*2|至少.*2.*知识点/i.test(msg);
    results.push({
      case: 'C3-combine-true-1kp-must-reject',
      pass: pass,
      error: msg,
      expectation: 'StrategyError: combine=true 要求至少 2 个知识点'
    });
  });

  return Promise.all([c1, c2, c3]).then(function () { return results; });
}

cases().then(function (rs) {
  var report = {
    meta: {
      generatedAt: new Date().toISOString(),
      head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
      probe: 'dev/audit/composite-routing-probe.js'
    },
    cases: rs,
    verdict: rs.every(function (r) { return r.pass; }) ? 'PASS' : 'FAIL'
  };
  fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'composite-routing-report.json'), JSON.stringify(report, null, 2));
  console.log('=== Composite 路由探针 ===');
  rs.forEach(function (r) {
    console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.case + (r.note ? '  | ' + r.note : '') + (r.error ? '  | err: ' + r.error : ''));
  });
  console.log('Verdict: ' + report.verdict);
}).catch(function (e) { console.error('探针异常:', e); process.exit(1); });
