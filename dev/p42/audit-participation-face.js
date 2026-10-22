#!/usr/bin/env node
'use strict';
// dev/p42/audit-participation-face.js — P42-2B 1570 确定性面本质参与度审计（只读，不写生产数据）
//
// 逐条复现 P42 审计面（seed p42|<kp>|<qt>|d3，count=1，d3），三族静态规则：
//   P1 Prompt 跨 KP 复用指标（精确/模板归一，≥2 KP 告警）——P42-023 工具缺口；
//   P2 概念回指差分（同 KP 有题回指、有题不回指 → FAIL 候选）——基线 §7 静态规则；
//   P3 Apply 答案结构化分类（仅计数，不做真伪判定）——P42-025 工具缺口。
// 输出：dev/p42/out/p42-2b-participation-audit.json；FAIL 候选>0 时 exit 1（须甄别登记，不得顺手修）。
//
// 用法：node dev/p42/audit-participation-face.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var C = require(path.join(__dirname, 'participation-checker.js'));

var ALL = QTR.TYPES.map(function (t) { return t.id; });

var pairs = [];
for (var g = 1; g <= 6; g++) {
  (env.KnowledgeContext.kpsForGrade('math', g) || []).forEach(function (k) {
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

// KP 名称表（KC 展示名，与 plan.semanticParams.name 同源）
var NAME = {};
for (var gg = 1; gg <= 6; gg++) {
  (env.KnowledgeContext.kpsForGrade('math', gg) || []).forEach(function (k) { NAME[k.knowledgeId] = k.name; });
}

var rows = [];
var errors = 0;
var done = 0;

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    try {
      var session = new PracticeSession({
        subject: 'math', grade: p.grade, count: 1, difficulty: 3,
        knowledgePointId: p.kp, questionType: p.qt, seed: 'p42|' + p.kp + '|' + p.qt + '|d3'
      });
      await session.start();
      var q = (session.semanticQuestions || [])[0];
      if (!q) throw new Error('no question');
      rows.push({
        rowId: p.kp + '|' + p.qt,
        kp: p.kp, grade: p.grade, qt: p.qt,
        name: NAME[p.kp] || null,
        prompt: q.prompt,
        answerValue: q.answer && q.answer.value,
        explanation: q.answer && q.answer.explanation,
        sq: q
      });
    } catch (e) {
      errors++;
    }
    done++;
    if (done % 200 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');
  console.log('生成面：' + rows.length + ' 题（session 错误 ' + errors + '）');

  // ---- P1 复用指标 ----
  var reuse = C.reuseMetrics(rows.map(function (r) {
    return { rowId: r.rowId, kp: r.kp, grade: r.grade, qt: r.qt, prompt: r.prompt };
  }));
  var exactMax = reuse.exact.alerts.reduce(function (n, x) { return Math.max(n, x.kps.length); }, 0);
  var tplMax = reuse.template.alerts.reduce(function (n, x) { return Math.max(n, x.kps.length); }, 0);
  var tplWatchMax = reuse.template.watch.reduce(function (n, x) { return Math.max(n, x.kps.length); }, 0);
  var tplCrossGrade = reuse.template.alerts.filter(function (x) { return x.grades.length >= 2; }).length;
  console.log('P1 复用指标（P42-3 分级阈值：精确 ≥2 alert；模板 ≥2 watch / ≥10 alert）：');
  console.log('  精确同字面跨 KP 告警组：' + reuse.exact.alerts.length + '（最大扇出 ' + exactMax + ' KP）');
  console.log('  模板归一跨 KP 告警组（≥10 KP）：' + reuse.template.alerts.length + '（最大扇出 ' + tplMax + ' KP；跨年级组 ' + tplCrossGrade + '）');
  console.log('  模板归一 watch 组（2~9 KP，记录级）：' + reuse.template.watch.length + '（最大扇出 ' + tplWatchMax + ' KP）');

  // ---- P2 概念回指差分（按 KP 聚合） ----
  var byKp = {};
  rows.forEach(function (r) { (byKp[r.kp] = byKp[r.kp] || []).push({ rowId: r.rowId, q: r.sq }); });
  var kpStats = { withSignal: 0, noSignal: 0, noHit: 0 };
  var candidates = [];
  Object.keys(byKp).forEach(function (kp) {
    var d = C.differentialCheck(byKp[kp], NAME[kp]);
    if (d.status === 'UNVERIFIED') {
      if (d.reason === 'name-no-signal') kpStats.noSignal++;
      else kpStats.noHit++;
      return;
    }
    kpStats.withSignal++;
    d.missingRows.forEach(function (mr) {
      var row = rows.find(function (r) { return r.rowId === mr.rowId; });
      candidates.push({
        kp: kp, name: NAME[kp], rowId: mr.rowId, tokens: d.tokens,
        prompt: row ? String(row.prompt).slice(0, 80) : null,
        expl: row ? String(row.explanation || '').slice(0, 80) : null
      });
    });
  });
  console.log('P2 概念回指差分：');
  console.log('  有信号 KP：' + kpStats.withSignal + '（UNVERIFIED：无内容词 ' + kpStats.noSignal + ' / 全零回指 ' + kpStats.noHit + '）');
  console.log('  FAIL 候选行（差分不回指）：' + candidates.length);

  // ---- P3 Apply 答案分类 ----
  var applyRows = rows.filter(function (r) { return r.qt === 'apply'; });
  var p3 = C.classifyApplyFace(applyRows.map(function (r) {
    return { rowId: r.rowId, kp: r.kp, qt: r.qt, answerValue: r.answerValue };
  }));
  console.log('P3 Apply 答案分类（apply ' + applyRows.length + ' 行）：' + JSON.stringify(p3.counts));

  var outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'p42-2b-participation-audit.json'), JSON.stringify({
    seed: 'p42|<kp>|<qt>|d3',
    face: rows.length, sessionErrors: errors,
    p1: {
      exactAlerts: reuse.exact.alerts.map(function (x) { return { key: x.key, kps: x.kps, grades: x.grades }; }),
      templateAlerts: reuse.template.alerts.map(function (x) { return { key: x.key, kpCount: x.kps.length, kps: x.kps, grades: x.grades }; }),
      templateWatch: reuse.template.watch.map(function (x) { return { key: x.key, kpCount: x.kps.length }; }),
      summary: { exactAlertGroups: reuse.exact.alerts.length, exactMaxFanout: exactMax, templateAlertGroups: reuse.template.alerts.length, templateMaxFanout: tplMax, templateCrossGrade: tplCrossGrade, templateWatchGroups: reuse.template.watch.length, templateWatchMaxFanout: tplWatchMax }
    },
    p2: { kpStats: kpStats, candidates: candidates },
    p3: { applyRows: applyRows.length, counts: p3.counts, byClass: p3.byClass }
  }, null, 2));
  console.log('产物：dev/p42/out/p42-2b-participation-audit.json');

  candidates.slice(0, 20).forEach(function (c) {
    console.log('  候选 ' + c.rowId + ' tokens=' + c.tokens.join('/'));
    console.log('    P: ' + (c.prompt || '').slice(0, 70));
  });
  if (candidates.length > 20) console.log('  …另有 ' + (candidates.length - 20) + ' 行，详见产物 JSON');
  process.exit(candidates.length ? 1 : 0);
})();
