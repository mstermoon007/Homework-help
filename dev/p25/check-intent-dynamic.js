#!/usr/bin/env node
'use strict';
// dev/p25/check-intent-dynamic.js — P26 意图动态比对门禁
//
// 背景（P25-08 缺口②）：qt-intent.json 静态意图矩阵（1570 行）已存在，但没有任何
// 检查把「生成产出」与「该行意图声明」动态比对——意图说图形表征，生成题可能纯数值；
// 意图警告题面退化为纯算式，生成题可能真的只有算式。
//
// 范围：A 类 KP（kp-matrix.json draftSemanticLevel==='A'，P26 刷新后 307 个）× ALLOW 题型
// （buildEligibility 动态枚举，与 check-allow-generation.js 同机制）。
//
// 机械探针（有界关键词→断言映射，不做题面 NLP；映射表见 PROBES 注释）：
//   P1 身份一致性   — 生成题 KP/题型与请求行一致（真值前提，违例即 FAIL 行）
//   P2 表征一致性   — 题型为 geometry（辨形/作图本质）→ 题目须有 data.graphic.type。
//                     注意口径：intent.whyThisType 的「含图形表征/X题型支持图形呈现」是
//                     选型依据的能力陈述（支持≠每题强制），fill/choice/apply/judge 可用文字
//                     承载图形语义（如「看线段图填空：…」），不作硬性要求——P26 实证 50 行
//                     误报后收窄为仅 geometry 硬性。
//   P3 calc 情境探针 — intent.driftRisk 含「纯算式」→ prompt 须含 ≥1 个汉字语义情境词
//                     （单位词如 千克/克/吨 即为度量换算的语义情境；「纯算式」指零情境词，
//                     如「7 × 2 = ____」。P26 实证 cjk≥4 阈值误伤单位换算后由 ≥4 修正为 ≥1）
//
// 用法：node dev/p25/check-intent-dynamic.js [--n 4] [--strict]
//   默认 report-only（发现违例仍 exit 0，供人工评估）；--strict 违例 exit 1。
// 产出：dev/p25/reports/intent-dynamic-report.json + stdout 摘要

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(__dirname, '..', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

var N = 4;
var STRICT = false;
var args = process.argv.slice(2);
var iArg = args.indexOf('--n');
if (iArg !== -1 && args[iArg + 1]) N = Math.max(1, parseInt(args[iArg + 1], 10) || 4);
STRICT = args.indexOf('--strict') !== -1;

var ALL = QTR.TYPES.map(function (t) { return t.id; });
var matrix = require(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'));
var qtIntent = require(path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json'));

var aById = {};
matrix.kps.forEach(function (k) { if (k.draftSemanticLevel === 'A') aById[k.id] = k; });

// qt-intent 行索引（知识Id|题型 → intent）
var intentBy = {};
qtIntent.rows.forEach(function (r) { intentBy[r.knowledgeId + '|' + r.questionType] = r; });

// ALLOW 行枚举（同 check-allow-generation.js）
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    if (!aById[k.knowledgeId]) return;
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) { if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g, qt: t }); });
  });
}

/** P3：prompt 汉字情境词计数（剔除算式/数字/选项字母/填空线后） */
function cjkCount(s) {
  var m = String(s || '').match(/[\u4e00-\u9fff]/g);
  return m ? m.length : 0;
}
/** P2：题目 graphic 证据 */
function hasGraphicEvidence(q) {
  if (q.questionType === 'geometry') return true;
  return !!(q.data && q.data.graphic && q.data.graphic.type);
}

var rows = [];
var done = 0;

(async function run() {
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var intentRow = intentBy[p.kp + '|' + p.qt];
    var probesRun = [];
    var violations = [];

    if (!intentRow) {
      rows.push({ kp: p.kp, qt: p.qt, grade: p.grade, error: 'qt-intent 缺行' });
      done++;
      continue;
    }
    var why = String(intentRow.intent && intentRow.intent.whyThisType || '');
    var drift = String(intentRow.intent && intentRow.intent.driftRisk || '');

    var samples = [];
    var err = null;
    try {
      var session = new PracticeSession({ subject: 'math', grade: p.grade, count: N, knowledgePointId: p.kp, questionType: p.qt });
      await session.start();
      samples = session.semanticQuestions || [];
    } catch (e) {
      err = String((e && e.message) || e).slice(0, 160);
    }

    if (err) {
      rows.push({ kp: p.kp, qt: p.qt, grade: p.grade, error: err });
    } else if (samples.length === 0) {
      rows.push({ kp: p.kp, qt: p.qt, grade: p.grade, error: '0 产出' });
    } else {
      samples.forEach(function (q, idx) {
        // P1 身份一致性
        probesRun.push('P1');
        var qkp = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        if (q.questionType !== p.qt || qkp !== p.kp) {
          violations.push({ probe: 'P1-identity', sample: idx, actual: { qt: q.questionType, kp: qkp } });
        }
        // P2 表征一致性（geometry 题型本质是辨形/作图 → 须有 graphic 证据；whyThisType 的
        // 「支持图形呈现」是能力陈述不作硬性要求，见文件头口径注释）
        if (p.qt === 'geometry') {
          probesRun.push('P2');
          if (!hasGraphicEvidence(q)) {
            violations.push({ probe: 'P2-representation', sample: idx, whyThisType: why.slice(0, 60), prompt: String(q.prompt).slice(0, 60) });
          }
        }
        // P3 calc 情境探针（driftRisk 警告纯算式 → 须含 ≥1 个汉字情境词，单位词即算）
        if (drift.indexOf('纯算式') !== -1) {
          probesRun.push('P3');
          var cjk = cjkCount(q.prompt);
          if (cjk < 1) {
            violations.push({ probe: 'P3-calc-context', sample: idx, cjk: cjk, prompt: String(q.prompt).slice(0, 60) });
          }
        }
      });
    }

    rows.push({
      kp: p.kp,
      name: aById[p.kp] ? aById[p.kp].name : null,
      qt: p.qt,
      grade: p.grade,
      samples: samples.length,
      probesRun: probesRun.filter(function (v, ix, a) { return a.indexOf(v) === ix; }),
      violations: violations.slice(0, 5),
      violationCount: violations.length,
      error: err || undefined
    });

    done++;
    if (done % 40 === 0) process.stdout.write('\r  进度 ' + done + '/' + pairs.length);
  }
  process.stdout.write('\r  进度 ' + done + '/' + pairs.length + '          \n');

  var summary = {
    aKps: Object.keys(aById).length,
    pairs: pairs.length,
    errorRows: 0,
    checkedRows: 0,
    violationRows: 0,
    byProbe: {},
    p2Coverage: 0,
    p3Coverage: 0
  };
  rows.forEach(function (r) {
    if (r.error) { summary.errorRows++; return; }
    summary.checkedRows++;
    if (r.violationCount > 0) summary.violationRows++;
    if (r.probesRun.indexOf('P2') !== -1) summary.p2Coverage++;
    if (r.probesRun.indexOf('P3') !== -1) summary.p3Coverage++;
    r.violations.forEach(function (v) {
      summary.byProbe[v.probe] = (summary.byProbe[v.probe] || 0) + 1;
    });
  });

  var outDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'intent-dynamic-report.json');
  fs.writeFileSync(outPath, JSON.stringify({
    schemaVersion: 'p26-intent-dynamic.1',
    generatedAt: new Date().toISOString(),
    sampling: { n: N },
    builtFrom: {
      aClass: 'kbl/teaching/kp-matrix.json draftSemanticLevel=A',
      intent: 'kbl/teaching/qt-intent.json',
      allow: 'KCV.buildEligibility ALLOW 动态枚举'
    },
    probes: {
      P1: '身份一致性：生成题 KP/题型与请求行一致',
      P2: '表征一致性：题型 geometry → 须有 data.graphic.type（whyThisType 能力陈述不作硬性要求）',
      P3: 'calc 情境探针：intent.driftRisk 含「纯算式」→ prompt 汉字情境词 ≥1（单位词即算）'
    },
    summary: summary,
    rows: rows
  }, null, 2) + '\n');

  console.log('A 类 KP：' + summary.aKps + '，ALLOW 行：' + summary.pairs);
  console.log('检查行：' + summary.checkedRows + '，错误行：' + summary.errorRows + '，违例行：' + summary.violationRows);
  console.log('探针覆盖：P2 表征行=' + summary.p2Coverage + '，P3 情境行=' + summary.p3Coverage);
  console.log('违例分布：' + JSON.stringify(summary.byProbe));
  console.log('报告：' + outPath);
  rows.filter(function (r) { return r.violationCount > 0; }).slice(0, 25).forEach(function (r) {
    console.log('  VIOLATION ' + r.kp + '×' + r.qt + ' → ' + r.violations.map(function (v) { return v.probe; }).join(','));
  });

  if (STRICT && summary.violationRows > 0) process.exit(1);
})().catch(function (e) {
  console.error('意图动态比对失败：', e);
  process.exit(1);
});
