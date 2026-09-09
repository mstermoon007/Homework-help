// dev/audit/kp-coverage-probe.js
/**
 * V4.1 Phase 9 — 549 KP 生成路径覆盖审计（只读探针）
 *
 * 目标：
 *   1) 枚举全部 math KP × 全部 canonical 题型，统计决策分布
 *      ALLOW / DEGRADE / FORBID / MISSING / INVALID
 *   2) 对每个 KP 判定是否存在至少 1 条合法生成路径（ALLOW 或 DEGRADE）
 *   3) 输出 MISSING 清单（应 = 0）
 *
 * 依据：shared/capability-resolver.js 的 resolveFinal()
 *   决策优先级：INVALID → FORBID → MISSING → ALLOW → DEGRADE
 *   DEGRADE 不自动升级为 ALLOW
 *
 * 输出：dev/reports/kp-coverage-report.json
 * 运行：node dev/audit/kp-coverage-probe.js
 *
 * 不修改任何业务代码、Gate、Frozen Core baseline。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

// CapabilityResolver 是 CommonJS module（非 IIFE 全局）
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
var CapabilityResolver = require(path.join(ROOT, 'shared', 'capability-resolver.js'));

// 549 math KP 全枚举
function loadAllMathKps() {
  var out = [];
  KnowledgeBank.math.forEach(function (g) {
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push({ id: kp.id, name: kp.name, grade: g.grade, moduleId: m.moduleId });
      });
    });
  });
  return out;
}

function main() {
  var kps = loadAllMathKps();
  var qts = Registry.all();
  var qtIds = qts.map(function (q) { return q.id; });

  var decisionCounts = { ALLOW: 0, DEGRADE: 0, FORBID: 0, MISSING: 0, INVALID: 0 };
  var kpRecords = [];
  var missingKps = [];
  var coveredKps = 0;

  kps.forEach(function (kp) {
    var perQt = [];
    var hasLegalPath = false;
    qtIds.forEach(function (qtId) {
      var r = CapabilityResolver.resolveFinal({ knowledgePointId: kp.id, questionType: qtId });
      decisionCounts[r.decision] = (decisionCounts[r.decision] || 0) + 1;
      perQt.push({ qt: qtId, decision: r.decision });
      if (r.decision === 'ALLOW' || r.decision === 'DEGRADE') hasLegalPath = true;
    });
    if (hasLegalPath) coveredKps++;
    else missingKps.push(kp);
    kpRecords.push({
      id: kp.id, name: kp.name, grade: kp.grade, moduleId: kp.moduleId,
      covered: hasLegalPath,
      legalPathCount: perQt.filter(function (p) { return p.decision === 'ALLOW' || p.decision === 'DEGRADE'; }).length,
      allowCount: perQt.filter(function (p) { return p.decision === 'ALLOW'; }).length,
      degradeCount: perQt.filter(function (p) { return p.decision === 'DEGRADE'; }).length,
      forbidCount: perQt.filter(function (p) { return p.decision === 'FORBID'; }).length,
      missingCount: perQt.filter(function (p) { return p.decision === 'MISSING'; }).length
    });
  });

  // 上一基线对比（若存在）
  var prevPath = path.join(ROOT, 'dev', 'reports', 'kp-coverage-report.json');
  var previous = null;
  if (fs.existsSync(prevPath)) {
    try { previous = JSON.parse(fs.readFileSync(prevPath, 'utf8')); } catch (e) { previous = null; }
  }

  var report = {
    meta: {
      generatedAt: new Date().toISOString(),
      head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
      probe: 'dev/audit/kp-coverage-probe.js',
      note: '只读探针；不修改任何业务代码、Gate、Frozen Core baseline'
    },
    summary: {
      totalKp: kps.length,
      coveredKp: coveredKps,
      missingKp: missingKps.length,
      coverageRate: ((coveredKps / kps.length) * 100).toFixed(2) + '%',
      totalKpQtPairs: kps.length * qtIds.length,
      questionTypeCount: qtIds.length
    },
    decisionDistribution: decisionCounts,
    missingKps: missingKps.map(function (k) { return { id: k.id, name: k.name, grade: k.grade, moduleId: k.moduleId }; }),
    questionTypeIds: qtIds,
    records: kpRecords
  };

  if (previous && previous.summary) {
    report.deltaFromPrevious = {
      previousCoverageRate: previous.summary.coverageRate,
      previousMissing: previous.summary.missingKp,
      previousDecision: previous.decisionDistribution || null
    };
  }

  var outPath = path.join(ROOT, 'dev', 'reports', 'kp-coverage-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  // 摘要
  console.log('=== KP 549 覆盖审计 ===');
  console.log('total KP        :', report.summary.totalKp);
  console.log('covered (≥1 path):', report.summary.coveredKp);
  console.log('MISSING         :', report.summary.missingKp);
  console.log('coverage rate   :', report.summary.coverageRate);
  console.log('qt count        :', report.summary.questionTypeCount);
  console.log('total KP×QT     :', report.summary.totalKpQtPairs);
  console.log('--- decision distribution ---');
  Object.keys(decisionCounts).forEach(function (k) {
    console.log('  ' + k.padEnd(10) + ': ' + decisionCounts[k]);
  });
  if (missingKps.length > 0) {
    console.log('--- MISSING KP (' + missingKps.length + ') ---');
    missingKps.slice(0, 20).forEach(function (k) {
      console.log('  ' + k.id + ' | ' + k.name);
    });
    if (missingKps.length > 20) console.log('  ... +' + (missingKps.length - 20) + ' more');
  }
  console.log('报告已写出: ' + outPath);
}

main();
