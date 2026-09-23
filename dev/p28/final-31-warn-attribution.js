#!/usr/bin/env node
'use strict';
// dev/p28/final-31-warn-attribution.js — FINAL-31 A 类 KP 语义 WARN 逐项归因（只读审计）
//
// 背景：P25-15 门禁基线 A 类 KP=307 / 对=921 / SEMANTIC_WARN=914 / SEMANTIC_PASS=7 / FAIL=0。
// WARN 机制（kp-semantic-validator.checkSemanticEvidence）：KP×题型存在证据规则但题目未声明
// data.semanticEvidence → warn（过渡期）。本脚本不修改统计，逐 (kp,qt) 真实生成 1 题并归因。
//
// 归因分类（每条 WARN 恰一个主类，其余为辅助标记）：
//   W4  题目缺语义证据声明——生成器已消费 semanticParams，产出字段全部满足规则断言，仅缺声明
//   W5  生成器没有消费 semantic profile——产出字段满足规则断言，但生成器源码不读 semanticParams
//   W10 当前生成器不适合该语义——实际产出与证据规则（golden 锚定）字段断言背离
//   W7  题型与教育目标不匹配——仅当 qt-intent legitimacy 明确否定（当前数据无此信号，保留分支）
//   W8  variation 改变知识点本质——仅当 variation 指令实际进入计划（FINAL-22a 后计划不携带，保留分支）
//   辅助标记（非主类，逐条记录）：
//   W1  learningTargets 缺失（TeachingSemanticProfile NEEDS_REVIEW）
//   W2  cognitiveTargets 缺失（同上）
//   W3  qt-intent 意图行缺失
//   W6  系统性：validator warn 路径不评测规则字段断言（WARN 态 = 零验证）
//   W9  misconception 档案覆盖该 (kp,qt) 但生成链未实现其 response
//
// 生成链路与 P25-15 门禁完全一致（同 _bundle-env / PracticeSession / KpSemantic），
// 重跑应复现 921/0/7/914/0 基线分桶。产物：dev/p28/reports/final-31-warn-attribution.json

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

var kpMatrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'), 'utf8'));
var evidenceRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'evidence-rules.json'), 'utf8'));
var qtIntent = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json'), 'utf8'));
var variationProfiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'variation-profiles.json'), 'utf8'));
var misconceptionProfiles = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'misconception-profiles.json'), 'utf8'));

// ---------- 静态事实：生成器 id → 是否消费 semanticParams（依据 generators/*.js 源码 grep 核验） ----------
var GEN_CONSUMES_PROFILE = {
  'generator:arithmetic-addition': true,   // arithmetic.js:99
  'generator:arithmetic-subtraction': true,
  'generator:arithmetic-multiplication': true,
  'generator:arithmetic-division': true,
  'generator:arithmetic-mixed-calculation': true,
  'generator:selection-fill': false,       // selection.js 无 semanticParams 引用
  'generator:selection-choice': false,
  'generator:selection-judge': false,
  'generator:shape-recognition': true,     // shape.js:617
  'generator:position-direction': true,    // position.js:434
  'generator:money-measurement': true,     // money.js:462
  'generator:application-word': true,      // application.js:110 读 semanticParams.operations（+FINAL-33 attachAll）
  'generator:counting': true,              // counting.js:68 读 semanticParams.name（+FINAL-33 attachAll）
  'generator:reasoning': true,             // reasoning.js:30
  'generator:stats': true,                 // stats.js:29
  'generator:picture-equation': true,      // FINAL-33 attachAll 消费 semanticParams.operations
  'generator:composite': false,            // composite.js 仅 combine>=2 KP 计划激活（本门禁单 KP 不触达）
  'generator:code-recognition': true,      // semantic-special.js:72
  'generator:classification': true,        // FINAL-33 attachAll 消费 semanticParams.operations
  'generator:percent-calc': true,          // percent.js:365
  'generator:concept-meaning': true,       // concept-meaning.js:584（且声明 semanticEvidence）
  'generator:semantic-relations': true,    // semantic-relations.js:697
  'generator:decimal-number': true,        // decimal.js:154
  'generator:fraction-number': true        // fraction.js:158
};

// ---------- 索引 ----------
var ruleIndex = {};
evidenceRules.rules.forEach(function (r) {
  if (r && r.knowledgePointId && r.questionType) ruleIndex[r.knowledgePointId + '|' + r.questionType] = r;
});
var intentIndex = {};
(qtIntent.rows || []).forEach(function (r) {
  if (r && r.knowledgeId && r.questionType) intentIndex[r.knowledgeId + '|' + r.questionType] = r;
});
var variationIndex = {};
(variationProfiles.rows || []).forEach(function (r) {
  if (r && r.knowledgePointId && r.questionType) variationIndex[r.knowledgePointId + '|' + r.questionType] = r;
});
var misconceptionMap = misconceptionProfiles.kps || {};

// KBL 原始条目字段存在性（W1/W2 数据级证据，非假设）
var rawFieldPresence = {};
for (var g = 1; g <= 6; g++) {
  var doc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'data', 'math', 'g' + g, 'knowledge-points.json'), 'utf8'));
  (Array.isArray(doc) ? doc : (doc.knowledgePoints || [])).forEach(function (e) {
    rawFieldPresence[e.knowledgeId] = {
      learningTargets: e.learningTargets != null,
      cognitiveTargets: e.cognitiveTargets != null
    };
  });
}

// ---------- A 类 KP 与对枚举（与 P25-15 门禁一致） ----------
var aClassKps = kpMatrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });
var CORE_QTS = ['apply', 'choice', 'fill'];
var ALL_TYPES = QTR.TYPES.map(function (t) { return t.id; });

function gradeFromKpId(kpId) {
  var gm = String(kpId || '').match(/math-g(\d)/);
  return gm ? parseInt(gm[1], 10) : 1;
}
function allowedQts(kpId) {
  var ev = KCV.buildEligibility([kpId], ALL_TYPES);
  var row = (ev.matrix && ev.matrix[kpId]) || {};
  var out = [];
  ALL_TYPES.forEach(function (t) { if (row[t] === 'ALLOW') out.push(t); });
  return out;
}
var pairs = [];
aClassKps.forEach(function (k) {
  allowedQts(k.id).filter(function (qt) { return CORE_QTS.indexOf(qt) !== -1; })
    .forEach(function (qt) { pairs.push({ kp: k.id, qt: qt }); });
});

// ---------- 与 validator 相同的字段断言评测（fieldEquals 语义克隆） ----------
function fieldEquals(sq, dotPath, value) {
  var cur = sq;
  var parts = String(dotPath).split('.');
  for (var i = 0; i < parts.length; i++) {
    if (cur == null || typeof cur !== 'object') return false;
    cur = cur[parts[i]];
  }
  if (Array.isArray(value) || Array.isArray(cur)) {
    if (!Array.isArray(value) || !Array.isArray(cur)) return false;
    return value.slice().sort().join('\u0001') === cur.slice().sort().join('\u0001');
  }
  return cur === value;
}

function evalRuleFields(sq, rule) {
  var missing = [], forbiddenHits = [], relationRequired = 0, relationForbidden = 0;
  (rule.required || []).forEach(function (a) {
    if (a.kind === 'field' && !fieldEquals(sq, a.path, a.value)) missing.push(a.path + '=' + JSON.stringify(a.value));
    if (a.kind === 'relation') relationRequired++;
  });
  (rule.forbidden || []).forEach(function (a) {
    if (a.kind === 'fieldNot' && fieldEquals(sq, a.path, a.value)) forbiddenHits.push(a.path + '=' + JSON.stringify(a.value));
    if (a.kind === 'relationNot') relationForbidden++;
  });
  return { missing: missing, forbiddenHits: forbiddenHits, relationRequired: relationRequired, relationForbidden: relationForbidden };
}

// ---------- 归因 ----------
function attribute(sq, kpId, qt, ruleEval) {
  var gen = (sq && sq.metadata && sq.metadata.generator) || null;
  var declared = !!(sq && sq.data && sq.data.semanticEvidence);
  var intent = intentIndex[kpId + '|' + qt] || null;
  var flags = [];
  if (rawFieldPresence[kpId] && !rawFieldPresence[kpId].learningTargets) flags.push('W1');
  if (rawFieldPresence[kpId] && !rawFieldPresence[kpId].cognitiveTargets) flags.push('W2');
  if (!intent) flags.push('W3');
  if (!declared) flags.push('W6'); // warn 路径未评测字段断言（系统性，凡 WARN 皆记录）
  var mc = misconceptionMap[kpId];
  var mcHit = !!(mc && Array.isArray(mc.slots) && mc.slots.some(function (s) {
    var qp = s && s.triggerPattern && s.triggerPattern.questionTypes;
    return Array.isArray(qp) && qp.indexOf(qt) !== -1;
  }));
  if (mcHit) flags.push('W9');
  if (variationIndex[kpId + '|' + qt]) flags.push('W8-note');

  var divergence = ruleEval.missing.length > 0 || ruleEval.forbiddenHits.length > 0;
  var primary = null, detail = null;
  if (!declared) {
    if (divergence) {
      // 产出与 golden 锚定规则背离：生成器形态 ≠ 规则锚定形态
      var legit = intent && intent.intent && intent.intent.legitimacy;
      if (typeof legit === 'string' && /不成立|不匹配|不适合/.test(legit)) {
        primary = 'W7';
        detail = { legitimacy: legit.slice(0, 80) };
      } else if (process.env.F31_VARIATION_ACTIVE === '1') {
        primary = 'W8'; // 当前计划不携带 variationDirectives（FINAL-22a），仅显式开关时归此
      } else {
        primary = 'W10';
        detail = { missing: ruleEval.missing, forbiddenHits: ruleEval.forbiddenHits };
      }
    } else {
      var consumes = GEN_CONSUMES_PROFILE[gen];
      if (consumes === false) { primary = 'W5'; detail = { generator: gen }; }
      else { primary = 'W4'; detail = { generator: gen }; }
    }
  }
  return { generator: gen, declared: declared, mcHit: mcHit, flags: flags, primary: primary, detail: detail,
    intentStatus: intent ? intent.status : null, divergence: divergence };
}

// ---------- 主循环 ----------
(async function run() {
  var buckets = { GENERATION_PASS: 0, SEMANTIC_PASS: 0, SEMANTIC_WARN: 0, SEMANTIC_FAIL: 0 };
  var wDist = {}, genMatrix = {}, perKp = {}, divergenceSamples = [];
  var records = [];
  var total = pairs.length, done = 0;

  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var kpRow = kpMatrix.kps.find(function (k) { return k.id === p.kp; });
    var state = null, sq = null, err = null, ruleEval = null, attr = null;
    try {
      var session = new PracticeSession({
        subject: 'math', grade: gradeFromKpId(p.kp), count: 1,
        knowledgePointId: p.kp, questionType: p.qt
      });
      await session.start();
      sq = (session.semanticQuestions || [])[0] || null;
      if (!sq) { state = 'SEMANTIC_FAIL'; err = '0 questions'; }
      else {
        var ev = KpSemantic.checkSemanticEvidence(sq, p.kp);
        state = ev.state === 'pass' ? 'SEMANTIC_PASS' : (ev.state === 'warn' ? 'SEMANTIC_WARN' : (ev.state === 'skip' ? 'GENERATION_PASS' : 'SEMANTIC_FAIL'));
        var rule = ruleIndex[p.kp + '|' + p.qt];
        ruleEval = rule ? evalRuleFields(sq, rule) : { missing: [], forbiddenHits: [], relationRequired: 0, relationForbidden: 0 };
        attr = attribute(sq, p.kp, p.qt, ruleEval);
      }
    } catch (e) {
      state = 'SEMANTIC_FAIL';
      err = String((e && e.message) || e).slice(0, 120);
    }
    buckets[state] = (buckets[state] || 0) + 1;

    var rec = { kp: p.kp, qt: p.qt, state: state, generator: attr ? attr.generator : null,
      declared: attr ? attr.declared : null, primary: attr ? attr.primary : null,
      flags: attr ? attr.flags : [], intentStatus: attr ? attr.intentStatus : null,
      divergence: attr ? attr.divergence : null, ruleEval: ruleEval, err: err };
    records.push(rec);

    if (state === 'SEMANTIC_WARN' && attr && attr.primary) {
      wDist[attr.primary] = (wDist[attr.primary] || 0) + 1;
      genMatrix[attr.generator] = genMatrix[attr.generator] || { pairs: 0 };
      genMatrix[attr.generator].pairs++;
      genMatrix[attr.generator][attr.primary] = (genMatrix[attr.generator][attr.primary] || 0) + 1;
      if (attr.primary === 'W10' && divergenceSamples.length < 40) {
        divergenceSamples.push({ kp: p.kp, qt: p.qt, generator: attr.generator, missing: ruleEval.missing, forbiddenHits: ruleEval.forbiddenHits });
      }
    }
    if (state === 'SEMANTIC_FAIL' && divergenceSamples.length < 40) {
      divergenceSamples.push({ kp: p.kp, qt: p.qt, generator: attr ? attr.generator : null, err: err });
    }

    var e = perKp[p.kp] || (perKp[p.kp] = { kp: p.kp, unit: kpRow ? kpRow.unitName : null, family: kpRow ? kpRow.semanticFamily : null,
      bindings: kpRow ? kpRow.generatorBindings : [], pairs: [], w1: !!(rawFieldPresence[p.kp] && !rawFieldPresence[p.kp].learningTargets),
      w2: !!(rawFieldPresence[p.kp] && !rawFieldPresence[p.kp].cognitiveTargets) });
    e.pairs.push({ qt: p.qt, state: state, primary: attr ? attr.primary : null, generator: attr ? attr.generator : null });
    done++;
    if (done % 50 === 0) process.stdout.write('\r  进度 ' + done + '/' + total + '   ');
  }
  process.stdout.write('\r  进度 ' + done + '/' + total + '          \n');

  // legitimacy 分布（W7 数据信号核查）
  var legDist = {};
  records.forEach(function (r) {
    var it = intentIndex[r.kp + '|' + r.qt];
    var l = it && it.intent && it.intent.legitimacy;
    var key = l == null ? 'null' : (String(l).indexOf('成立') === 0 ? '成立' : String(l).slice(0, 20));
    legDist[key] = (legDist[key] || 0) + 1;
  });

  var perKpList = Object.keys(perKp).sort().map(function (k) { return perKp[k]; });
  var report = {
    schemaVersion: 'final-31-warn-attribution-v1',
    generatedAt: new Date().toISOString(),
    baseline: {
      aClassKps: aClassKps.length, pairsTotal: pairs.length,
      generationPass: buckets.GENERATION_PASS, semanticPass: buckets.SEMANTIC_PASS,
      semanticWarn: buckets.SEMANTIC_WARN, semanticFail: buckets.SEMANTIC_FAIL
    },
    aggregates: {
      wDistribution: wDist,
      generatorMatrix: genMatrix,
      divergenceSamples: divergenceSamples,
      dataGaps: {
        learningTargetsMissing: perKpList.filter(function (x) { return x.w1; }).length,
        cognitiveTargetsMissing: perKpList.filter(function (x) { return x.w2; }).length,
        intentMissingPairs: records.filter(function (r) { return r.flags.indexOf('W3') !== -1; }).length,
        misconceptionTriggeredPairs: records.filter(function (r) { return r.flags.indexOf('W9') !== -1; }).length,
        variationRowsDescriptiveOnly: Object.keys(variationIndex).length,
        legitimacyDistribution: legDist
      }
    },
    perKp: perKpList,
    pairs: records
  };

  var outDir = path.join(ROOT, 'dev', 'p28', 'reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  var outPath = path.join(outDir, 'final-31-warn-attribution.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

  console.log('FINAL-31 WARN 归因');
  console.log('  基线分桶：GENERATION_PASS=' + buckets.GENERATION_PASS + ' SEMANTIC_PASS=' + buckets.SEMANTIC_PASS +
    ' SEMANTIC_WARN=' + buckets.SEMANTIC_WARN + ' SEMANTIC_FAIL=' + buckets.SEMANTIC_FAIL);
  console.log('  WARN 主类分布：' + JSON.stringify(wDist));
  console.log('  生成器×主类：');
  Object.keys(genMatrix).sort().forEach(function (gid) {
    var mrow = genMatrix[gid];
    console.log('    ' + gid + '  pairs=' + mrow.pairs + '  ' + JSON.stringify(
      Object.keys(mrow).filter(function (k) { return k !== 'pairs'; }).reduce(function (o, k) { o[k] = mrow[k]; return o; }, {})));
  });
  console.log('  数据缺口：learningTargets 缺 ' + report.aggregates.dataGaps.learningTargetsMissing + ' KP；cognitiveTargets 缺 ' +
    report.aggregates.dataGaps.cognitiveTargetsMissing + ' KP；intent 缺 ' + report.aggregates.dataGaps.intentMissingPairs +
    ' 对；misconception 触达 ' + report.aggregates.dataGaps.misconceptionTriggeredPairs + ' 对；legitimacy ' + JSON.stringify(legDist));
  if (divergenceSamples.length) {
    console.log('  背离/失败样例（前 20）：');
    divergenceSamples.slice(0, 20).forEach(function (d) {
      console.log('    ' + d.kp + ' ' + d.qt + (d.generator ? ' [' + d.generator + ']' : '') +
        (d.missing && d.missing.length ? ' 缺:' + d.missing.slice(0, 3).join(',') : '') +
        (d.forbiddenHits && d.forbiddenHits.length ? ' 违禁:' + d.forbiddenHits.join(',') : '') +
        (d.err ? ' err:' + d.err : ''));
    });
  }
  console.log('  报告：' + path.relative(ROOT, outPath));
})();
