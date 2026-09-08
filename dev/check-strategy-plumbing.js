#!/usr/bin/env node
/**
 * dev/check-strategy-plumbing.js — M3-21 Strategy → Generator 管道验收（MATH-14 native-only）
 *
 * 对全部 math 知识点（Core Domain 收缩：语文/英语已移出核心生成链）全量验证
 * 7 个决策维度真正落在 Strategy 产出的 QuestionPlan 上（native Generator 直接消费 plan）：
 *   ① questionType   plan.questionTypeId 为合法题型
 *   ② cognitiveLevel plan.cognitiveLevel 非空
 *   ③ difficulty     plan.difficulty 为有限数值
 *   ④ structure      plan.constraints.{maxSteps,allowBracket,allowMultDiv,scale} 已定义
 *   ⑤ spiralLevel    plan.spiralLevel 非空
 *   ⑥ context        plan.contextType 非空
 *   ⑦ count          plan.count === request.count
 *
 * 验证 M3-22 Debug Trace：request.debug=true 时 result.strategyTrace 含 11 步决策链。
 *
 * MATH-14：legacy Adapter.adaptPlanToLegacyOptions 管道探针已删除，
 *          决策维度以 QuestionPlan 为唯一载体直接校验。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));

function run() {
  var errors = [];
  var total = 0;
  var dimChecks = { '① questionType': 0, '② cognitiveLevel': 0, '③ difficulty': 0, '④ structure': 0, '⑤ spiralLevel': 0, '⑥ context': 0, '⑦ count': 0 };
  var VALID_QT = ['oral', 'calc', 'fill', 'choice', 'judge', 'apply', 'open', 'geometry', 'recognize'];

  function isGeneratorUnsupportedError(e) {
    return e && e.code === 'GENERATOR_UNSUPPORTED';
  }

  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          // Core Domain 收缩（Refactor Step 1）：语文(cn)/英语(en) 已移出核心生成链，
          // 不再进入 StrategyEngine，探针只覆盖 math 域。
          if (kp.id.indexOf('cn-') === 0 || kp.id.indexOf('en-') === 0) return;
          total++;
          var plan;
          try {
            var result = Engine.plan({ knowledgePointId: kp.id, count: 3, debug: true });
            plan = result.plans[0];
          } catch (e) {
            if (isGeneratorUnsupportedError(e)) {
              // P0-03 Step 14: KP 无 native generator 支持时返回 GENERATOR_UNSUPPORTED，
              // 这是预期行为，不计入错误（MATH-14 后无 legacy fallback，该 KP 由矩阵决策禁用）。
              total--; // 不计入管道验收总量
              return;
            }
            errors.push(kp.id + ' :: plan 失败: ' + e.message);
            return;
          }

          // ①
          if (plan.questionTypeId && VALID_QT.indexOf(plan.questionTypeId) !== -1) dimChecks['① questionType']++;
          else errors.push(kp.id + ' :: ① questionTypeId 缺失或非法（plan=' + plan.questionTypeId + '）');

          // ②
          if (plan.cognitiveLevel) dimChecks['② cognitiveLevel']++;
          else errors.push(kp.id + ' :: ② cognitiveLevel 未落入 plan');

          // ③
          if (typeof plan.difficulty === 'number' && isFinite(plan.difficulty)) dimChecks['③ difficulty']++;
          else errors.push(kp.id + ' :: ③ difficulty 未落入 plan（' + plan.difficulty + '）');

          // ④
          var cst = plan.constraints || {};
          if (cst.maxSteps != null && cst.allowBracket != null && cst.allowMultDiv != null && cst.scale != null) dimChecks['④ structure']++;
          else errors.push(kp.id + ' :: ④ structure 约束未落入 plan（' + JSON.stringify(cst) + '）');

          // ⑤
          if (plan.spiralLevel != null) dimChecks['⑤ spiralLevel']++;
          else errors.push(kp.id + ' :: ⑤ spiralLevel 未落入 plan');

          // ⑥
          if (plan.contextType) dimChecks['⑥ context']++;
          else errors.push(kp.id + ' :: ⑥ contextType 未落入 plan');

          // ⑦
          if (plan.count === 3) dimChecks['⑦ count']++;
          else errors.push(kp.id + ' :: ⑦ count 未落入 plan（plan=' + plan.count + '）');

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
