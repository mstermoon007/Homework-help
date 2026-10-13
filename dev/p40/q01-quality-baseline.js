#!/usr/bin/env node
'use strict';
// dev/p40/q01-quality-baseline.js — P40-Q-01 质量基线抽样（只读扫描，不写生产数据）
//
// 任务书口径（P40 §1.2 Q-SCAN）：
//   G1-G6 × 7 题型 × 4 domain 分层抽样 ≥120 题（6a 真实生成路径），
//   按五层 23 维（R1-R23）逐维评分：可脚本化维度脚本评（R7-R11/R19/R20），
//   其余人工评（产出评审清单供人工/复核）。
//
// 生成口径：与 6b 冻结 policy 一致 —— difficulty=3、确定性 seed='p40q01|<kp>|<qt>|d3'，可复跑。
//
// 产出（运行期工作产物，不入 docs/）：
//   dev/p40/out/q01-evidence.json  逐题证据 + 脚本化维度自动评分 + 抽样表
//   dev/p40/out/q01-review.md      人工评审清单（题面/答案/解析/图形紧凑列表）
//
// 用法：node dev/p40/q01-quality-baseline.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var SQ = require(path.join(ROOT, 'shared', 'semantic', 'semantic-question.js'));
var KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
var TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
var AV = require(path.join(ROOT, 'shared', 'validator', 'answer-validator.js'));

var OUT_DIR = path.join(ROOT, 'dev', 'p40', 'out');
var TARGET_N = 140; // ≥120，比例分配后总量约 140±5
var FREEZE_DIFFICULTY = 3;

var ALL = QTR.TYPES.map(function (t) { return t.id; });

// ---------- 数据面 ----------
var capRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'canonical', 'capability.json'), 'utf8')).capability;
var capMap = {};
capRows.forEach(function (r) { capMap[r.knowledgeId] = r; });
var qiRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json'), 'utf8')).rows;
var qiMap = {};
qiRows.forEach(function (r) { qiMap[r.knowledgeId + '/' + r.questionType] = r; });

// ---------- 1570 枚举（与 6b 同源） ----------
var pairs = [];
for (var g = 1; g <= 6; g++) {
  (KC.kpsForGrade('math', g) || []).forEach(function (k) {
    var ev = KCV.buildEligibility([k.knowledgeId], ALL);
    var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
    ALL.forEach(function (t) {
      if (m[t] === 'ALLOW') {
        pairs.push({
          kp: k.knowledgeId, qt: t,
          grade: Number(/^math-g(\d)-/.exec(k.knowledgeId)[1]),
          domain: (capMap[k.knowledgeId] || {}).domain || 'unknown'
        });
      }
    });
  });
}

// ---------- 分层抽样（确定性：层内按键排序等距取点） ----------
function stratumKey(p) { return p.grade + '|' + p.domain + '|' + p.qt; }
var strata = {};
pairs.forEach(function (p) {
  var k = stratumKey(p);
  (strata[k] = strata[k] || []).push(p);
});
var keys = Object.keys(strata).sort();
var sample = [];
keys.forEach(function (k) {
  var rows = strata[k].slice().sort(function (a, b) { return (a.kp + a.qt).localeCompare(b.kp + b.qt); });
  var alloc = Math.min(rows.length, Math.max(1, Math.round(rows.length * TARGET_N / pairs.length)));
  for (var i = 0; i < alloc; i++) {
    sample.push(rows[Math.floor(i * rows.length / alloc)]);
  }
});

// ---------- 维度评估 ----------
var UNIT_RE = /(厘米|分米|毫米|千米|克|千克|吨|毫升|升|角|元|分|秒|日|年|时|米|cm|mm|km|kg|°)/g;

function graphicOf(sq) {
  if (sq.graphic && typeof sq.graphic === 'object' && typeof sq.graphic.type === 'string') return sq.graphic;
  if (sq.data && sq.data.graphic && typeof sq.data.graphic === 'object') return sq.data.graphic;
  return null;
}

function normNum(v) {
  if (v == null) return null;
  var s = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null; // 仅纯数字串（选项文本/分数串不参与数值比对）
  var n = Number(s);
  return isNaN(n) ? null : n;
}

async function genOnce(p, tag) {
  var session = new PracticeSession({
    subject: 'math', grade: p.grade, count: 1, difficulty: FREEZE_DIFFICULTY,
    knowledgePointId: p.kp, questionType: p.qt, seed: 'p40q01|' + p.kp + '|' + p.qt + '|d' + FREEZE_DIFFICULTY + (tag ? '|' + tag : '')
  });
  await session.start();
  return (session.semanticQuestions || [])[0] || null;
}

(async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  var evidence = [];
  var genErr = 0;

  for (var i = 0; i < sample.length; i++) {
    var p = sample[i];
    var capRow = capMap[p.kp] || {};
    var intent = qiMap[p.kp + '/' + p.qt] || null;
    var rec = {
      i: i, kp: p.kp, qt: p.qt, grade: p.grade, domain: p.domain,
      knowledgeName: capRow.knowledgeName || '', cognitiveLevel: capRow.cognitiveLevel || null,
      seedDifficulty: capRow.seedDifficulty || null, numberRange: capRow.numberRange || null,
      assessment: intent ? intent.assessment : null, status: intent ? intent.status : null,
      prompt: null, answerValue: null, answerUnit: null, acceptable: null, precision: null,
      explanation: null, explanationLen: 0, style: null, svgTemplate: null, layout: null,
      graphic: null, generator: null, distractors: null, dataOptions: null, err: null,
      // 脚本化维度
      d: {}
    };
    try {
      var q = await genOnce(p, 'a');
      if (!q) { rec.err = 'no question'; genErr++; evidence.push(rec); continue; }
      var prompt = String(q.prompt || (q.content && q.content.prompt) || '');
      rec.prompt = prompt;
      rec.answerValue = q.answer ? String(q.answer.value) : null;
      rec.answerUnit = q.answer && q.answer.unit != null ? String(q.answer.unit) : null;
      rec.acceptable = q.answer && Array.isArray(q.answer.acceptable) ? q.answer.acceptable : null;
      rec.precision = q.answer && q.answer.precision != null ? q.answer.precision : null;
      rec.explanation = q.answer ? (q.answer.explanation == null ? null : String(q.answer.explanation)) : null;
      rec.explanationLen = rec.explanation ? rec.explanation.length : 0;
      rec.style = q.style || null;
      rec.svgTemplate = q.svgTemplate || null;
      rec.layout = q.response ? (q.response.layout || null) : null;
      rec.graphic = graphicOf(q) ? { type: graphicOf(q).type, subtype: graphicOf(q).subtype, role: graphicOf(q).role || (graphicOf(q).params && graphicOf(q).params.role) || null, params: graphicOf(q).params || {} } : null;
      rec.generator = q.metadata ? q.metadata.generator : null;
      rec.distractors = Array.isArray(q.distractors) ? q.distractors.map(function (d) { return typeof d === 'object' ? (d.value != null ? d.value : JSON.stringify(d).slice(0, 40)) : d; }) : null;
      rec.dataOptions = q.data && q.data.options ? q.data.options : null;
      rec.qtFingerprint = q.questionFingerprint || null;

      // R7 数学正确性（脚本可判部分：纯算式题 + 纯数字答案；U+2212/全角减号归一化；
      // 含空槽（____/（ ））的填空形态交给存量 answer-validator 门禁，脚本剥空会破坏算式结构 → n/a）
      var hasBlank = /_{2,}|（\s*）|\(\s*\)/.test(prompt);
      var expected = hasBlank ? null : AV.computeExpectedAnswer(prompt.replace(/[−－]/g, '-'));
      var got7 = normNum(rec.answerValue);
      if (expected == null || got7 == null) rec.d.r7 = 'n/a';
      else {
        var exp = normNum(expected);
        rec.d.r7 = (exp != null && Math.abs(got7 - exp) < 1e-9) ? 'pass' : 'FAIL';
        if (rec.d.r7 === 'FAIL') rec.d.r7detail = 'expect ' + expected + ' got ' + rec.answerValue;
      }

      // R8 单位一致性（题面单位 token vs answer.unit vs graphic.params.unit）
      var promptUnits = (prompt.match(UNIT_RE) || []).filter(function (u) { return u !== '分' || /分钟|几分|得分/.test(prompt); });
      var uniqUnits = [];
      promptUnits.forEach(function (u) { if (uniqUnits.indexOf(u) < 0) uniqUnits.push(u); });
      var gu = rec.graphic && rec.graphic.params && rec.graphic.params.unit != null ? String(rec.graphic.params.unit) : null;
      rec.d.r8 = {
        promptUnits: uniqUnits, answerUnit: rec.answerUnit, graphicUnit: gu,
        mismatch: (rec.answerUnit != null && uniqUnits.length > 0 && uniqUnits.indexOf(rec.answerUnit) < 0) ? 'answer-unit-not-in-prompt' : null
      };

      // R9 数值合理性（脚本可判部分：纯加减法题结果域 vs numberRange.numMax 数值上限）。
      // P40-Q-17 口径订正（用户批准方案 A）：P30-14 双轨——max 为难度等级（供 R02 难度加分）非数值上限，
      // numMax 才是数值上限（emit-canonical 仅 numMax!=null 时透出 generation.numberRange）。
      //   numMax=null → 无数值约束 → n/a；
      //   乘法/除法/组合等开放域（numMax 语义为算子域非结果域）→ n/a 交人工评审；
      //   仅纯加减法（ops 只含 addition/subtraction）按封闭数域「N 以内加减法」判结果域。
      // 迭代史：第一轮口径误用 max 致 G6 百分数 4 例伪影；第二轮 numMax 一刀切新暴露乘法/组合 4 例伪影；均已甄别。
      var nr = capRow.numberRange || {};
      var ansNum = normNum(rec.answerValue);
      var opsArr = capRow.operations || [];
      var closedAddSub = opsArr.length > 0 && opsArr.every(function (o) { return o === 'addition' || o === 'subtraction'; });
      rec.d.r9 = {
        answerNum: ansNum, numMax: nr.numMax != null ? nr.numMax : null,
        overRange: (closedAddSub && ansNum != null && nr.numMax != null && ansNum > nr.numMax) || false,
        verdict: (nr.numMax == null || ansNum == null || !closedAddSub) ? 'n/a' : (ansNum > nr.numMax ? 'FAIL' : 'pass')
      };

      // R10 结构完整（schema + kpSem + tc，与 6b 同口径）
      var sv = SQ.validateSchema(q);
      var plan = { knowledgePointIds: [p.kp], questionTypeId: p.qt, difficulty: FREEZE_DIFFICULTY, count: 1 };
      var kv = KpSem.validateKpSemantics(q, { plan: plan, kpId: p.kp });
      var tv = TC.check(p.qt, q);
      rec.d.r10 = { schema: sv.valid ? 1 : 0, kpSem: kv.valid ? 1 : 0, tc: tv.ok ? 1 : 0 };
      if (!sv.valid) rec.d.r10.schemaErr = (sv.errors && sv.errors[0] && (sv.errors[0].message || sv.errors[0].code)) || 'schema';
      if (!kv.valid) rec.d.r10.kpSemErr = JSON.stringify((kv.errors && kv.errors[0]) || kv).slice(0, 160);
      if (!tv.ok) rec.d.r10.tcErr = JSON.stringify((tv.errors && tv.errors[0]) || tv).slice(0, 160);

      // R11 答案唯一性（脚本代理：choice 答案须在选项集内；classify 答案组合法）
      if (p.qt === 'choice') {
        var opts = rec.dataOptions || [];
        var inOpts = opts.length ? opts.some(function (o) {
          var ov = typeof o === 'object' ? (o.value != null ? o.value : o.text) : o;
          return String(ov) === String(rec.answerValue);
        }) : null;
        rec.d.r11 = inOpts == null ? 'n/a-options-missing' : (inOpts ? 'pass' : 'FAIL-answer-not-in-options');
      } else rec.d.r11 = 'manual';

      // R19 可复现性（同 seed 二次生成，规范化比对）
      var q2 = await genOnce(p, 'a');
      var sig = function (x) {
        return JSON.stringify({ p: x.prompt, a: x.answer, g: graphicOf(x), s: x.style, t: x.svgTemplate, d: x.data, r: x.response, fp: x.questionFingerprint });
      };
      rec.d.r19 = (q2 && sig(q) === sig(q2)) ? 'pass' : (q2 ? 'FAIL-volatile' : 'FAIL-no-regen');

      // R20 可评分性（gradeUserAnswer 判分回放；镜像 buildAnswerSpec：classify 透传 data.groups）
      var spec = { value: q.answer ? q.answer.value : null, acceptable: q.answer ? q.answer.acceptable : undefined, precision: q.answer ? q.answer.precision : undefined, unit: q.answer ? q.answer.unit : undefined };
      if (p.qt === 'classify' && q.data && q.data.groups) spec.groups = q.data.groups;
      var gCtx = { questionType: p.qt, prompt: prompt, data: q.data };
      var gOk = AV.gradeUserAnswer(String(rec.answerValue), spec, gCtx);
      var wrong = null;
      if (ansNum != null) wrong = AV.gradeUserAnswer(String(ansNum + 1), spec, gCtx);
      else if (p.qt === 'judge') wrong = AV.gradeUserAnswer(String(rec.answerValue) === '正确' ? '错误' : '正确', spec, gCtx);
      rec.d.r20 = { correct: gOk, wrongProbe: wrong };
      // 判分口径：calc/fill/choice/judge/classify 必须 true；apply/geometry 允许 null（家长检查）
      var mustGrade = ['calc', 'fill', 'choice', 'judge', 'classify'].indexOf(p.qt) >= 0;
      rec.d.r20.verdict = (gOk === true) ? 'pass' : (gOk === null && !mustGrade) ? 'parent-check' : 'FAIL';

      rec.difficulty = q.difficulty;
    } catch (e) {
      rec.err = String((e && e.message) || e).slice(0, 160);
      genErr++;
    }
    evidence.push(rec);
    if ((i + 1) % 20 === 0) process.stdout.write('\r  抽样进度 ' + (i + 1) + '/' + sample.length);
  }
  process.stdout.write('\r  抽样进度 ' + sample.length + '/' + sample.length + '          \n');

  // ---------- 汇总 ----------
  var summary = { sampled: sample.length, pairs: pairs.length, genErr: genErr, strata: keys.length };
  var dims = {};
  ['r7', 'r8', 'r9', 'r10', 'r11', 'r19', 'r20'].forEach(function (k) { dims[k] = {}; });
  evidence.forEach(function (r) {
    Object.keys(dims).forEach(function (k) {
      var v = r.d[k];
      if (v == null) return;
      var tag = typeof v === 'object' ? (v.verdict || (v.mismatch ? 'mismatch' : (v.overRange ? 'over' : (v.schema === 0 || v.kpSem === 0 || v.tc === 0 ? 'fail' : 'pass')))) : v;
      dims[k][tag] = (dims[k][tag] || 0) + 1;
    });
  });
  summary.dims = dims;

  // ---------- 产出 ----------
  var evidenceOut = {
    task: 'P40-Q-01 质量基线抽样', date: new Date().toISOString().slice(0, 10),
    seedPolicy: { version: 'p40q01', difficulty: FREEZE_DIFFICULTY, formula: 'p40q01|<kp>|<qt>|d<difficulty>' },
    sampling: { strata: keys.length, target: TARGET_N, perStratum: keys.map(function (k) { return { key: k, total: strata[k].length, sampled: sample.filter(function (s) { return stratumKey(s) === k; }).length }; }) },
    summary: summary, evidence: evidence
  };
  fs.writeFileSync(path.join(OUT_DIR, 'q01-evidence.json'), JSON.stringify(evidenceOut, null, 1) + '\n');

  // 人工评审清单
  var md = ['# P40-Q-01 人工评审清单（' + evidence.length + ' 题）', '', '格式：#i 层(kp|qt|domain) | 题面 | 答案 | 解析(60字) | 图形 | 标记', ''];
  evidence.forEach(function (r, idx) {
    if (r.err) { md.push('#' + idx + ' ' + r.kp + '|' + r.qt + '|' + r.domain + ' | GEN-ERROR ' + r.err); return; }
    var g = r.graphic ? r.graphic.type + '/' + r.graphic.subtype + '/' + r.graphic.role : 'none';
    var expl = r.explanation ? r.explanation.replace(/\n/g, ' ').slice(0, 60) : (r.explanation === null ? 'NULL' : '');
    var flags = [];
    if (r.d.r7 === 'FAIL') flags.push('R7FAIL(' + r.d.r7detail + ')');
    if (r.d.r8 && r.d.r8.mismatch) flags.push('R8:' + r.d.r8.mismatch);
    if (r.d.r9 && r.d.r9.overRange) flags.push('R9over(numMax=' + r.d.r9.numMax + ')');
    if (r.d.r10 && (r.d.r10.schema === 0 || r.d.r10.kpSem === 0 || r.d.r10.tc === 0)) flags.push('R10fail');
    if (String(r.d.r11).indexOf('FAIL') === 0) flags.push('R11:' + r.d.r11);
    if (r.d.r19 && r.d.r19 !== 'pass') flags.push('R19:' + r.d.r19);
    if (r.d.r20 && r.d.r20.verdict !== 'pass') flags.push('R20:' + r.d.r20.verdict);
    md.push('#' + idx + ' ' + r.kp + '|' + r.qt + '|g' + r.grade + '|' + r.domain + ' | ' + r.prompt + ' | ans=' + JSON.stringify(r.answerValue) + (r.answerUnit ? '[' + r.answerUnit + ']' : '') + ' | expl=' + expl + (r.explanationLen ? '(' + r.explanationLen + ')' : '') + ' | gfx=' + g + (flags.length ? ' | FLAGS: ' + flags.join(',') : ''));
  });
  fs.writeFileSync(path.join(OUT_DIR, 'q01-review.md'), md.join('\n') + '\n');

  console.log('P40-Q-01 抽样完成：' + evidence.length + ' 题（层 ' + keys.length + ' 个，全对 1570 比例分配），genErr=' + genErr);
  console.log('脚本化维度汇总：' + JSON.stringify(dims));
  console.log('产出：dev/p40/out/q01-evidence.json + dev/p40/out/q01-review.md');
})().catch(function (e) { console.error('FATAL', e); process.exit(1); });
