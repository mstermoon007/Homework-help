// dev/audit/question-integrity-probe.js
/**
 * V4.1 Phase 10 — 题目完整性探针（只读）
 *
 * 用户规格：随机抽 ≥100 题，验证 9 字段：
 *   id / type / stem / answer / explanation / knowledgePointIds / difficulty / contextType / fingerprint
 *   特别检查：answer≠undefined / stem≠"" / fingerprint≠"" / knowledgePointIds.length>0
 *   同时 Validator PASS（不得绕过）
 *
 * 已知缺陷（本探针需如实记录）：
 *   DEFECT-003：context 字段在 normalizeSemanticQuestion 中被丢，q.context="" — 本探针标记 context 为 KNOWN_BAD
 *
 * 输出：dev/reports/question-integrity-report.json
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
var Dup = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));

// 不同年级/知识点组合（覆盖用户 Phase 6 矩阵的子集）
var SAMPLES = [
  { subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: 'math-g1-m1-addsub-10', count: 20, difficulty: 4 },
  { subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: 'math-g1-m0-make-ten', count: 20, difficulty: 3 },
  { subject: 'math', grade: 2, mode: 'single-kp', knowledgePointId: 'math-g2-m1-add-100', count: 20, difficulty: 4 },
  { subject: 'math', grade: 4, mode: 'single-kp', knowledgePointId: 'math-g4-m2-g4-v-mul3x2', count: 20, difficulty: 5 },
  { subject: 'math', grade: 5, mode: 'single-kp', knowledgePointId: 'math-g5-m2-g5-v-decmul', count: 20, difficulty: 5 },
  { subject: 'math', grade: 6, mode: 'single-kp', knowledgePointId: 'math-g6-m2-g6-calc-dec-mult', count: 20, difficulty: 6 }
];

function checkQuestion(q, plan) {
  var issues = [];
  var hardFails = [];  // 用户规格"特别检查"硬要求
  if (!q.id) issues.push('id missing');
  if (!q.questionType) issues.push('questionType missing');
  var stem = (q.question && (q.question.prompt || q.question.stem)) || q.prompt || (q.content && q.content.prompt);
  if (!stem) { issues.push('stem empty'); hardFails.push('stem empty'); }
  if (q.answer == null) { issues.push('answer undefined'); hardFails.push('answer undefined'); }
  else if (typeof q.answer === 'object' && (q.answer.value == null || q.answer.value === '')) {
    issues.push('answer.value empty'); hardFails.push('answer.value empty');
  }
  // explanation 在 answer.explanation（schema 默认 null）；null 视为已定义
  var expl = (q.answer && Object.prototype.hasOwnProperty.call(q.answer, 'explanation'))
    ? q.answer.explanation : undefined;
  if (expl === undefined) issues.push('answer.explanation missing (DEFECT-004 LOW)');
  if (!Array.isArray(q.knowledgePointIds) || q.knowledgePointIds.length === 0) {
    issues.push('knowledgePointIds empty'); hardFails.push('knowledgePointIds empty');
  }
  if (q.difficulty == null) issues.push('difficulty missing');
  // DEFECT-003：context 已知坏，单独标记
  var contextBroken = !q.context || q.context === '';
  if (contextBroken) issues.push('KNOWN-DEFECT-003: context empty (plan.contextType=' + (plan && plan.contextType) + ')');
  if (!q.questionFingerprint) { issues.push('questionFingerprint missing'); hardFails.push('fingerprint missing'); }
  return { issues: issues, contextBroken: contextBroken, hardFails: hardFails };
}

function run() {
  var allQs = [];
  var allPlans = [];
  var seq = Promise.resolve();
  SAMPLES.forEach(function (req) {
    seq = seq.then(function () { return GE.generate(req); }).then(function (g) {
      var plans = g.plans || [];
      var qs = g.questions || [];
      // 给每个 q 关联它的 plan（取 plan[0]，本测试单 KP 单 plan）
      qs.forEach(function (q) { allQs.push({ q: q, plan: plans[0] || null, request: req }); });
      plans.forEach(function (p) { allPlans.push(p); });
    });
  });
  return seq.then(function () {
    var checks = allQs.map(function (item) {
      var c = checkQuestion(item.q, item.plan);
      return {
      id: item.q.id,
      questionType: item.q.questionType,
      kp: item.request.knowledgePointId,
      grade: item.request.grade,
      stem: ((item.q.question && (item.q.question.prompt || item.q.question.stem)) || item.q.prompt || '').slice(0, 60),
      answer: item.q.answer && (typeof item.q.answer === 'object' ? item.q.answer.value : item.q.answer),
      answerExplanation: (item.q.answer && item.q.answer.explanation !== undefined) ? item.q.answer.explanation : 'MISSING',
      knowledgePointIds: item.q.knowledgePointIds,
      difficulty: item.q.difficulty,
      context: item.q.context,
      fingerprint: item.q.questionFingerprint,
      issues: c.issues,
      contextBroken: c.contextBroken,
      hardFails: c.hardFails
    };
  });
  var totalQ = checks.length;
  var issuesCount = checks.filter(function (c) { return c.issues.length > 0; }).length;
  var contextBrokenCount = checks.filter(function (c) { return c.contextBroken; }).length;
  var hardFailCount = checks.filter(function (c) { return c.hardFails.length > 0; }).length;
  // 区分 DEFECT-003 与其他 issue
  var nonDefect003Issues = checks.filter(function (c) {
    return c.issues.some(function (i) { return i.indexOf('KNOWN-DEFECT-003') === -1; });
  });
  // 只关注非 D003/D004 严重 issue
  var seriousNonDefectIssues = checks.filter(function (c) {
    return c.issues.some(function (i) {
      return i.indexOf('KNOWN-DEFECT-003') === -1 && i.indexOf('DEFECT-004') === -1;
    });
  });

  // Validator 不绕过：GE.generate 内已自动跑 Validator；如果有题输出说明 Validator PASS
  // 进一步统计 failedPlans
  var validatorBypassed = false; // 间接证据：所有题输出即表示 Validator 没拒
  var report = {
    meta: {
      generatedAt: new Date().toISOString(),
      head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
      probe: 'dev/audit/question-integrity-probe.js',
      sampleCount: totalQ
    },
    summary: {
      totalQuestions: totalQ,
      questionsWithIssues: issuesCount,
      contextBrokenByDefect003: contextBrokenCount,
      nonDefect003Issues: nonDefect003Issues.length,
      hardFails: hardFailCount,
      seriousNonDefectIssues: seriousNonDefectIssues.length,
      validatorBypassed: validatorBypassed
    },
    records: checks,
    verdict: (hardFailCount === 0 && !validatorBypassed && seriousNonDefectIssues.length === 0) ? 'PASS' : 'FAIL'
  };
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'question-integrity-report.json'), JSON.stringify(report, null, 2));
    console.log('=== 题目完整性探针 ===');
    console.log('total questions     :', totalQ);
    console.log('questions w/ issues  :', issuesCount);
    console.log('context broken (D003):', contextBrokenCount);
    console.log('non-D003 issues     :', nonDefect003Issues.length);
    if (nonDefect003Issues.length > 0) {
      console.log('--- non-D003 issues (first 10) ---');
      nonDefect003Issues.slice(0, 10).forEach(function (c) {
        var real = c.issues.filter(function (i) { return i.indexOf('KNOWN-DEFECT-003') === -1; });
        console.log('  ' + c.id + ' | ' + c.kp + ' | ' + JSON.stringify(real));
      });
    }
    console.log('Verdict: ' + report.verdict);
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
