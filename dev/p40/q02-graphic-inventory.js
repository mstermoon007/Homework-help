#!/usr/bin/env node
'use strict';
// dev/p40/q02-graphic-inventory.js — P40-Q-02 竖式/分数/图文消费盘点（只读扫描）
//
// 任务书口径（P40 §1.2 Q-SCAN）：
//   ① svg-calculation 全 API 的生产调用图（静态：另见 grep 证据，本脚本输出运行时注册面）；
//   ② calc 多位数题竖式命中率（应配未配清单）；
//   ③ 分数题图示覆盖率；
//   ④ graphic 各 subtype 在 1570 行上的分布。
//
// 生成口径：与 6b 冻结 policy 一致 —— difficulty=3、seed='p40q02|<kp>|<qt>|d3'，全 1570 行逐行生成。
// 产出：dev/p40/out/q02-evidence.json + dev/p40/out/q02-summary.json
//
// 用法：node dev/p40/q02-graphic-inventory.js

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');
var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

var OUT_DIR = path.join(ROOT, 'dev', 'p40', 'out');
var FREEZE_DIFFICULTY = 3;
var ALL = QTR.TYPES.map(function (t) { return t.id; });

var capRows = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'canonical', 'capability.json'), 'utf8')).capability;
var capMap = {};
capRows.forEach(function (r) { capMap[r.knowledgeId] = r; });

function graphicOf(sq) {
  if (sq.graphic && typeof sq.graphic === 'object' && typeof sq.graphic.type === 'string') return sq.graphic;
  if (sq.data && sq.data.graphic && typeof sq.data.graphic === 'object') return sq.data.graphic;
  return null;
}

// ---------- 课标竖式规则（Q-06 待接通口径的基线镜像） ----------
// 仅单步算式配竖式；两步及以上为脱式/连算；表内乘除（一位数）不配竖式
// G2 起笔算加减（两位数及以上）；G3 起多位数乘除竖式；G4 起小数竖式；G5 异分母分数加减竖式
function opCount(prompt) {
  // P40-Q-06 复盘口径修正：分数 a/b 的分数线不参与运算符计数（替换为数字占位），
  // 否则「1/4 + 2/4」被计 3 步 → L49 分数分支死代码 → 分数应配行漏盘。
  var s = String(prompt).replace(/(\d+)\/(\d+)/g, '9');
  var m = s.match(/\d\s*[+\-−－×xX*÷/]\s*\d/g);
  return m ? m.length : 0;
}
function shouldVertical(prompt, qt, grade) {
  if (qt !== 'calc') return false;
  if (opCount(prompt) !== 1) return false; // 单步
  if (/\d+\/\d+|\d+分之\d+/.test(prompt)) return grade >= 5; // 分数加减（异分母）
  if (/\d+\.\d+/.test(prompt)) return grade >= 4; // 小数竖式
  var m = prompt.match(/(\d+(?:\.\d+)?)\s*([+\-−－×xX*÷/])\s*(\d+(?:\.\d+)?)/);
  if (!m) return false;
  var a = String(m[1]).replace('.', ''), b = String(m[3]).replace('.', ''), op = m[2];
  if (op === '+' || op === '-' || op === '−' || op === '－') return grade >= 2 && Math.max(a.length, b.length) >= 2;
  if (op === '*' || op === '×' || op === 'x' || op === 'X') return grade >= 3 && Math.max(a.length, b.length) >= 2;
  if (op === '/' || op === '÷') return grade >= 3 && a.length >= 2;
  return false;
}

(async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // ---------- 静态注册面（①） ----------
  var GR = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));
  var staticInfo = {
    graphicRendererTypeRegistry_calculation: (GR.GRAPHIC_TYPE_MODULES && GR.GRAPHIC_TYPE_MODULES.calculation) || '见 graphic-renderer.js L61（grep 证据）',
    apiSurface: ['add', 'sub', 'mul', 'div', 'dec', 'frac'],
    knownProducers: ['shared/generator/generators/money.js:567 (type: calculation)'],
    svgTemplateTag: 'question-style-strategy.js 将 calc/fill/classify 的 svgTemplate 标为 svg-calculation，但表现层 renderFor 仅消费 graphic 描述符——无描述符时 0 个 <svg> 输出（探针证据）'
  };

  // ---------- 全 1570 逐行生成 ----------
  var pairs = [];
  for (var g = 1; g <= 6; g++) {
    (KC.kpsForGrade('math', g) || []).forEach(function (k) {
      var ev = KCV.buildEligibility([k.knowledgeId], ALL);
      var m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
      ALL.forEach(function (t) {
        if (m[t] === 'ALLOW') pairs.push({ kp: k.knowledgeId, qt: t, grade: Number(/^math-g(\d)-/.exec(k.knowledgeId)[1]) });
      });
    });
  }

  var rows = [];
  var genErr = 0;
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var capRow = capMap[p.kp] || {};
    var rec = { kp: p.kp, qt: p.qt, grade: p.grade, domain: capRow.domain || 'unknown', err: null };
    try {
      var session = new PracticeSession({
        subject: 'math', grade: p.grade, count: 1, difficulty: FREEZE_DIFFICULTY,
        knowledgePointId: p.kp, questionType: p.qt, seed: 'p40q02|' + p.kp + '|' + p.qt + '|d' + FREEZE_DIFFICULTY
      });
      await session.start();
      var q = (session.semanticQuestions || [])[0];
      if (!q) { rec.err = 'no question'; genErr++; }
      else {
        rec.prompt = String(q.prompt || '');
        var gph = graphicOf(q);
        rec.graphic = gph ? { type: gph.type, subtype: gph.subtype, role: gph.role || (gph.params && gph.params.role) || null } : null;
        rec.answerValue = q.answer ? String(q.answer.value) : null;
        rec.explanation = q.answer && q.answer.explanation != null ? String(q.answer.explanation) : null;
      }
    } catch (e) {
      rec.err = String((e && e.message) || e).slice(0, 120);
      genErr++;
    }
    rows.push(rec);
    if ((i + 1) % 200 === 0) process.stdout.write('\r  全量进度 ' + (i + 1) + '/' + pairs.length);
  }
  process.stdout.write('\r  全量进度 ' + pairs.length + '/' + pairs.length + '          \n');

  // ---------- ④ graphic subtype 分布 ----------
  var typeDist = {}, typeSubDist = {}, roleDist = {};
  var graphicTotal = 0;
  rows.forEach(function (r) {
    if (!r.graphic) return;
    graphicTotal++;
    typeDist[r.graphic.type] = (typeDist[r.graphic.type] || 0) + 1;
    var tk = r.graphic.type + '/' + (r.graphic.subtype || '-');
    typeSubDist[tk] = (typeSubDist[tk] || 0) + 1;
    roleDist[r.graphic.role || '-'] = (roleDist[r.graphic.role || '-'] || 0) + 1;
  });

  // graphic 覆盖率 × 题型
  var covByQt = {}, totByQt = {};
  rows.forEach(function (r) {
    totByQt[r.qt] = (totByQt[r.qt] || 0) + 1;
    if (r.graphic) covByQt[r.qt] = (covByQt[r.qt] || 0) + 1;
  });

  // ---------- ② calc 竖式命中率 ----------
  var calcRows = rows.filter(function (r) { return r.qt === 'calc' && !r.err; });
  var shouldList = calcRows.filter(function (r) { return shouldVertical(r.prompt || '', 'calc', r.grade); });
  var verticalHit = shouldList.filter(function (r) { return r.graphic && r.graphic.type === 'calculation'; });
  var missByGrade = {};
  shouldList.forEach(function (r) {
    var hit = r.graphic && r.graphic.type === 'calculation';
    var k = 'g' + r.grade;
    missByGrade[k] = missByGrade[k] || { total: 0, hit: 0 };
    missByGrade[k].total++;
    if (hit) missByGrade[k].hit++;
  });

  // ---------- ③ 分数题图示覆盖率 ----------
  function isFractionKp(kp, prompt) {
    var name = (capMap[kp] || {}).knowledgeName || '';
    return /分数/.test(name) || /\d+\/\d+/.test(prompt || '');
  }
  var fracRows = rows.filter(function (r) { return !r.err && isFractionKp(r.kp, r.prompt); });
  var fracWithGraphic = fracRows.filter(function (r) { return r.graphic; });
  var fracByType = {};
  fracRows.forEach(function (r) {
    var k = r.graphic ? r.graphic.type + '/' + (r.graphic.subtype || '-') : 'NO-GRAPHIC';
    fracByType[k] = (fracByType[k] || 0) + 1;
  });
  var fracExplTongfen = fracRows.filter(function (r) { return r.explanation && /通分|约分/.test(r.explanation); }).length;

  var summary = {
    task: 'P40-Q-02 竖式/分数/图文消费盘点', date: new Date().toISOString().slice(0, 10),
    total: pairs.length, genErr: genErr,
    static: staticInfo,
    graphicCoverage: { withGraphic: graphicTotal, rate: Number((graphicTotal / pairs.length).toFixed(4)), byQt: totByQt && Object.keys(totByQt).reduce(function (o, k) { o[k] = { total: totByQt[k], withGraphic: covByQt[k] || 0, rate: Number(((covByQt[k] || 0) / totByQt[k]).toFixed(4)) }; return o; }, {}) },
    typeDist: typeDist, typeSubDist: typeSubDist, roleDist: roleDist,
    vertical: {
      calcTotal: calcRows.length,
      shouldVertical: shouldList.length,
      hit: verticalHit.length,
      miss: shouldList.length - verticalHit.length,
      byGrade: missByGrade,
      missSample: shouldList.filter(function (r) { return !(r.graphic && r.graphic.type === 'calculation'); }).slice(0, 20).map(function (r) { return { kp: r.kp, grade: r.grade, prompt: (r.prompt || '').slice(0, 50) }; })
    },
    fraction: {
      rows: fracRows.length, withGraphic: fracWithGraphic.length,
      rate: fracRows.length ? Number((fracWithGraphic.length / fracRows.length).toFixed(4)) : null,
      byGraphicType: fracByType,
      explanationTongfenYuefen: fracExplTongfen
    }
  };

  fs.writeFileSync(path.join(OUT_DIR, 'q02-summary.json'), JSON.stringify(summary, null, 1) + '\n');
  fs.writeFileSync(path.join(OUT_DIR, 'q02-evidence.json'), JSON.stringify({ rows: rows }, null, 1) + '\n');

  console.log('P40-Q-02 盘点完成：1570 行（genErr=' + genErr + '）');
  console.log('graphic 覆盖：' + graphicTotal + '/' + pairs.length + ' (' + (graphicTotal * 100 / pairs.length).toFixed(1) + '%)');
  console.log('竖式应配 ' + shouldList.length + ' 命中 ' + verticalHit.length + ' 未配 ' + (shouldList.length - verticalHit.length));
  console.log('分数题 ' + fracRows.length + ' 配图 ' + fracWithGraphic.length + '（' + (fracRows.length ? (fracWithGraphic.length * 100 / fracRows.length).toFixed(1) : 0) + '%）解析含通分/约分 ' + fracExplTongfen);
  console.log('产出：dev/p40/out/q02-summary.json + dev/p40/out/q02-evidence.json');
})().catch(function (e) { console.error('FATAL', e); process.exit(1); });
