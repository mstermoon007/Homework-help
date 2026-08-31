#!/usr/bin/env node
/**
 * dev/check-strategy-plumbing.js — M3-21 Strategy → Plugin 管道验收
 *
 * 对 574 KP 全量验证 7 个决策维度真正从 Strategy 进入 Plugin options：
 *   ① questionType   options.questionType === plan.questionTypeId
 *   ② cognitiveLevel options.cognitiveLevel === plan.cognitiveLevel
 *   ③ difficulty     options.difficulty === plan.difficulty
 *                     options.difficultyParams.level === plan.difficulty
 *   ④ structure      options.difficultyParams.{steps,allowBracket,allowMultDiv,scale}
 *                     === plan.constraints.{maxSteps,allowBracket,allowMultDiv,scale}
 *   ⑤ spiralLevel    options.spiralLevel === plan.spiralLevel
 *   ⑥ context        options.contextType === plan.contextType
 *   ⑦ count          options.count === plan.count
 *
 * 验证 M3-22 Debug Trace：request.debug=true 时 result.strategyTrace 含 11 步决策链。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var Adapter = require(path.join(ROOT, 'shared', 'strategy', 'legacy-adapter.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));

function run() {
  var errors = [];
  var total = 0;
  var dimChecks = { '① questionType': 0, '② cognitiveLevel': 0, '③ difficulty': 0, '④ structure': 0, '⑤ spiralLevel': 0, '⑥ context': 0, '⑦ count': 0 };

  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          total++;
          var plan;
          try {
            var result = Engine.plan({ knowledgePointId: kp.id, count: 3, debug: true });
            plan = result.plans[0];
          } catch (e) {
            errors.push(kp.id + ' :: plan 失败: ' + e.message);
            return;
          }

          var options;
          try {
            options = Adapter.adaptPlanToLegacyOptions(plan, {});
          } catch (e) {
            errors.push(kp.id + ' :: adapter 失败: ' + e.message);
            return;
          }

          // ①
          if (options.questionType === plan.questionTypeId) dimChecks['① questionType']++;
          else errors.push(kp.id + ' :: ① questionType 未进入 options（plan=' + plan.questionTypeId + ' options=' + options.questionType + '）');

          // ②
          if (options.cognitiveLevel === plan.cognitiveLevel) dimChecks['② cognitiveLevel']++;
          else errors.push(kp.id + ' :: ② cognitiveLevel 未进入 options');

          // ③
          if (options.difficulty === plan.difficulty && options.difficultyParams && options.difficultyParams.level === plan.difficulty) dimChecks['③ difficulty']++;
          else errors.push(kp.id + ' :: ③ difficulty 未进入 options');

          // ④
          var dp = options.difficultyParams || {};
          var cst = plan.constraints || {};
          if (dp.steps === cst.maxSteps && dp.allowBracket === cst.allowBracket && dp.allowMultDiv === cst.allowMultDiv && dp.scale === cst.scale) dimChecks['④ structure']++;
          else errors.push(kp.id + ' :: ④ structure 未进入 options（' + JSON.stringify(dp) + ' vs ' + JSON.stringify(cst) + '）');

          // ⑤
          if (options.spiralLevel === plan.spiralLevel) dimChecks['⑤ spiralLevel']++;
          else errors.push(kp.id + ' :: ⑤ spiralLevel 未进入 options');

          // ⑥
          if (options.contextType === plan.contextType) dimChecks['⑥ context']++;
          else errors.push(kp.id + ' :: ⑥ context 未进入 options');

          // ⑦
          if (options.count === plan.count) dimChecks['⑦ count']++;
          else errors.push(kp.id + ' :: ⑦ count 未进入 options');

          // M3-22 Debug Trace
          if (!result.strategyTrace || !Array.isArray(result.strategyTrace) || result.strategyTrace.length !== 11) {
            errors.push(kp.id + ' :: strategyTrace 缺失或步数不为 11');
          }
        });
      });
    });
  });

  var report = {
    totalKp: total,
    dimensionChecks: dimChecks,
    errors: errors.length,
    errorSamples: errors.slice(0, 10)
  };

  var outDir = path.join(ROOT, 'dev', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'strategy-plumbing-report.json'), JSON.stringify(report, null, 2));

  console.log('M3-21 Strategy → Plugin 管道验收');
  console.log('');
  Object.keys(dimChecks).forEach(function (d) {
    console.log(d + ': ' + dimChecks[d] + '/' + total);
  });
  console.log('M3-22 strategyTrace: ' + (errors.some(function (e) { return e.indexOf('strategyTrace') !== -1; }) ? 'FAIL' : '11 步决策链 OK'));
  console.log('Errors: ' + errors.length);
  errors.slice(0, 10).forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('');
  console.log('Report -> dev/reports/strategy-plumbing-report.json');

  var ok = errors.length === 0 && total > 0;
  console.log('');
  console.log(ok ? '[PASS] M3-21 Strategy → Plugin 管道' : '[FAIL] M3-21 Strategy → Plugin 管道');
  process.exitCode = ok ? 0 : 1;
}

run();
