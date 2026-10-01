#!/usr/bin/env node
'use strict';
// dev/p25/build-golden-dataset.js — P25-16 黄金题集候选生成器
//
// 任务书 P25-16：按 Semantic Family 建立代表性黄金题，每族 10-30 道。
// 第一阶段不覆盖 375 KP，仅按语义族抽样。
//
// 流程：
//   1. 遍历 kbl/teaching/semantic-families.json 15 族
//   2. 每族从 kp-matrix.json 过滤 draftSemanticLevel==='A' 的 KP
//   3. 优先选有 evidence-rules.json 规则行的 KP（保证 SEMANTIC_PASS 可达）
//   4. 对每个 (族, KP, 核心题型 apply/choice/fill)：
//      new PracticeSession({count:1}) → session.start() → 收 1 题
//   5. 自动结构验证：KpSemantic.checkSemanticEvidence(sq, kpId) 必须 'pass'
//      （不收 warn/skip/fail）；不通过则换下一 KP 重试
//   6. 每条 12 字段 + source:'ai-candidate' + humanReview:'llm-finalized'
//      （用户 2026-09-30 取消人工复核环节；质量保险＝真实 PracticeSession 生成
//        + KpSemantic.checkSemanticEvidence 仅收 pass 的机器行为验证，非 LLM 自证）
//
// 用法：
//   node dev/p25/build-golden-dataset.js [--per-family 20] [--max-families 15]   # 默认：按族抽样（原行为）
//   node dev/p25/build-golden-dataset.js --fill-missing [--grade g1]             # 覆盖模式：为未覆盖 A 类 KP 补题（追加，不重生成已有题）
// 产出：kbl/teaching/golden-questions.json

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');

var env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KC = env.KnowledgeContext;
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

var semanticFamilies = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/semantic-families.json'), 'utf8'));
var kpMatrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/kp-matrix.json'), 'utf8'));
var evidenceRules = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/evidence-rules.json'), 'utf8'));
var qtIntentDoc = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/qt-intent.json'), 'utf8'));
var intentByKpQt = {};
(qtIntentDoc.rows || []).forEach(function (r) {
  intentByKpQt[r.knowledgeId + '|' + r.questionType] = r;
});

// 参数解析
var args = process.argv.slice(2);
var PER_FAMILY = 20;
var MAX_FAMILIES = 15;
var idx = args.indexOf('--per-family');
if (idx !== -1 && args[idx + 1]) PER_FAMILY = Math.max(1, parseInt(args[idx + 1], 10));
idx = args.indexOf('--max-families');
if (idx !== -1 && args[idx + 1]) MAX_FAMILIES = Math.max(1, parseInt(args[idx + 1], 10));
// 覆盖模式：为尚未进入题集的 A 类 KP 真实生成金题并追加（默认抽样行为不变）
var FILL_MISSING = args.indexOf('--fill-missing') !== -1;
idx = args.indexOf('--grade');
var FILL_GRADE = (idx !== -1 && args[idx + 1]) ? args[idx + 1] : null; // 如 'g1'；null=全年级
var PER_KP_CAP = 3; // 用户决策：每个缺额 KP 按适用核心题型最多收 3 条（题型不足则按实际数）

// A 类 KP 按族分组（用 kpFamilies[kpId].primary 映射，不用 kp.semanticFamily）
var aClassKps = kpMatrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });
var kpFamiliesMap = semanticFamilies.kpFamilies || {};
var kpsByFamily = {};
aClassKps.forEach(function (k) {
  var entry = kpFamiliesMap[k.id];
  var fam = (entry && entry.primary) || 'unknown';
  if (!kpsByFamily[fam]) kpsByFamily[fam] = [];
  kpsByFamily[fam].push(k);
});

// evidence-rules KP 集合（优先选择）
var kpsWithEvidence = {};
(evidenceRules.rules || []).forEach(function (r) {
  kpsWithEvidence[r.knowledgePointId + '|' + r.questionType] = true;
});

// 核心题型（A 类全量 307 的唯一三题型）
var CORE_QTS = ['apply', 'choice', 'fill'];
var ALL_TYPES = QTR.TYPES.map(function (t) { return t.id; });

// grade 映射（KP.id 如 'math-g1-up-u01-k001' → grade=1）
function gradeFromKpId(kpId) {
  var m = String(kpId || '').match(/math-g(\d)/);
  return m ? parseInt(m[1], 10) : 1;
}

// 允许题型（用 buildEligibility 真值，不靠 kpMatrix.questionTypes 静态声明）
function allowedQts(kpId) {
  var ev = KCV.buildEligibility([kpId], ALL_TYPES);
  var m = (ev.matrix && ev.matrix[kpId]) || {};
  var out = [];
  ALL_TYPES.forEach(function (t) { if (m[t] === 'ALLOW') out.push(t); });
  return out;
}

var goldenQuestions = [];
var familyStats = [];

// 真实生成单题并仅在 SEMANTIC_PASS 时收录（抽样/覆盖两模式共用的核心采集单元）
async function collectOne(kp, qt, famId) {
  var grade = gradeFromKpId(kp.id);
  var session = new PracticeSession({
    subject: 'math', grade: grade, count: 1,
    knowledgePointId: kp.id, questionType: qt
  });
  await session.start();
  var sqs = session.semanticQuestions || [];
  if (!sqs.length) return null;
  var sq = sqs[0];
  var evResult = KpSemantic.checkSemanticEvidence(sq, kp.id);
  if (evResult.state !== 'pass') return null; // 不伪造 PASS
  var intentRow = intentByKpQt[kp.id + '|' + qt] || null;
  var intentObj = intentRow && intentRow.intent || null;
  return {
    kpId: kp.id,
    semanticFamily: famId,
    teachingTarget: (intentObj && intentObj.trainsWhat) || kp.name,
    cognitiveTarget: sq.cognitiveLevel || null,
    questionType: qt,
    intent: intentObj ? {
      whyThisType: intentObj.whyThisType || null,
      legitimacy: intentObj.legitimacy || null,
      driftRisk: intentObj.driftRisk || null
    } : null,
    difficulty: sq.difficulty || (sq.plan && sq.plan.difficulty) || null,
    // 变式维度：A 类概念题取 subType/mode；B/C 通用算法题无概念子型，退而取题内真实
    // 算法类型 operation（add/sub/mult/div/mixed）——同为题面已构造事实，不虚构。
    variation: (sq.data && (sq.data.subType || sq.data.mode || sq.data.operation)) || null,
    structure: {
      stem: sq.stem || sq.question || (sq.data && sq.data.prompt) || sq.prompt || null,
      options: sq.options || (sq.data && sq.data.options) || null,
      answer: sq.answer != null ? sq.answer : (sq.data && sq.data.answer)
    },
    semanticEvidence: sq.data && sq.data.semanticEvidence || null,
    answer: sq.answer != null
      ? (typeof sq.answer === 'object' ? JSON.stringify(sq.answer) : String(sq.answer))
      : (sq.data && sq.data.answer != null
        ? (typeof sq.data.answer === 'object' ? JSON.stringify(sq.data.answer) : String(sq.data.answer))
        : null),
    validator: {
      semanticEvidenceState: evResult.state,
      errors: (evResult.errors || []).length,
      warnings: (evResult.warnings || []).length
    },
    source: 'ai-candidate',
    humanReview: 'llm-finalized'
  };
}

// 覆盖模式：保留已生成题，仅为未覆盖 A 类 KP 追加真实生成的 pass 题（不重生成已有题）
async function runFillMissing() {
  var outPath = path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json');
  var existing = fs.existsSync(outPath)
    ? JSON.parse(fs.readFileSync(outPath, 'utf8'))
    : { questions: [] };
  var base = Array.isArray(existing.questions) ? existing.questions.slice() : [];
  var covered = {};
  base.forEach(function (q) { covered[q.kpId] = true; });

  // 候选为全部未覆盖 KP（不限 A 类）：collectOne 仅在 SEMANTIC_PASS 时收录，
  // 故无通用算法锚/题面与语义不符的 KP（无 evidence 规则 → skip）自然收不进来，不靠层级硬卡。
  var candidates = kpMatrix.kps.filter(function (k) {
    if (covered[k.id]) return false;
    return FILL_GRADE ? k.grade === FILL_GRADE : true;
  });
  console.log('覆盖模式：缺额候选 ' + candidates.length + ' 个 KP' + (FILL_GRADE ? '（' + FILL_GRADE + '）' : '') + '，已有题 ' + base.length);

  var added = [];
  for (var ci = 0; ci < candidates.length; ci++) {
    var kp = candidates[ci];
    var entry = kpFamiliesMap[kp.id];
    var famId = (entry && entry.primary) || 'unknown';
    var qts = allowedQts(kp.id).filter(function (qt) { return CORE_QTS.indexOf(qt) !== -1; }).slice(0, PER_KP_CAP);
    for (var qi = 0; qi < qts.length; qi++) {
      try {
        var q = await collectOne(kp, qts[qi], famId);
        if (q) { added.push(q); process.stdout.write('\r  + ' + kp.id + ' [' + qts[qi] + '] pass（新增 ' + added.length + '）        '); }
      } catch (e) { /* 单题失败跳过 */ }
    }
  }
  process.stdout.write('\n');

  // 合并 + 全量去重（kpId|questionType|answer前50，与 validate 口径一致）
  var seenKeys = {};
  var merged = [];
  base.concat(added).forEach(function (q) {
    var key = q.kpId + '|' + q.questionType + '|' + String(q.answer || '').slice(0, 50);
    if (seenKeys[key]) return;
    seenKeys[key] = true;
    merged.push(q);
  });

  var byFamily = {};
  merged.forEach(function (q) { byFamily[q.semanticFamily] = (byFamily[q.semanticFamily] || 0) + 1; });
  var output = {
    schemaVersion: 'p25-16-v1',
    generatedAt: new Date().toISOString(),
    purpose: 'P25-16 黄金题集 — 15 语义族抽样 + A 类 KP 覆盖补漏；真实生成 + SEMANTIC_PASS 机器验证（LLM 开发期定案）',
    source: 'ai-candidate',
    reviewStatus: 'llm-finalized-dev',
    counts: { total: merged.length, families: Object.keys(byFamily).length, byFamily: byFamily },
    questions: merged
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log('覆盖补漏完成：新增 ' + added.length + '，总题 ' + merged.length + '，覆盖族 ' + Object.keys(byFamily).length + '/15');
}

(async function run() {
  if (FILL_MISSING) { await runFillMissing(); return; }
  var families = (semanticFamilies.families || []).slice(0, MAX_FAMILIES);
  var totalCollected = 0;

  for (var fi = 0; fi < families.length; fi++) {
    var fam = families[fi];
    var kpsInFamily = kpsByFamily[fam.id] || [];
    var collected = 0;

    // 优先有 evidence-rules 的 KP
    kpsInFamily.sort(function (a, b) {
      var aHas = CORE_QTS.some(function (qt) { return kpsWithEvidence[a.id + '|' + qt]; });
      var bHas = CORE_QTS.some(function (qt) { return kpsWithEvidence[b.id + '|' + qt]; });
      return (bHas ? 1 : 0) - (aHas ? 1 : 0);
    });

    for (var ki = 0; ki < kpsInFamily.length && collected < PER_FAMILY; ki++) {
      var kp = kpsInFamily[ki];
      var grade = gradeFromKpId(kp.id);
      var allowed = allowedQts(kp.id);
      // 仅核心题型（避免非全量题型假阴性）
      var qts = allowed.filter(function (qt) { return CORE_QTS.indexOf(qt) !== -1; });

      for (var qi = 0; qi < qts.length && collected < PER_FAMILY; qi++) {
        var qt = qts[qi];
        try {
          var session = new PracticeSession({
            subject: 'math', grade: grade, count: 1,
            knowledgePointId: kp.id, questionType: qt
          });
          await session.start();
          var sqs = session.semanticQuestions || [];
          if (!sqs.length) continue;
          var sq = sqs[0];

          // 自动语义验证（FINAL-40）：仅接受 SEMANTIC_PASS——WARN 不计 PASS。
          // - pass：规则全满足（semanticEvidence 声明匹配 + constructs 构件齐全，FINAL-37 强校验）
          // - warn/skip/fail：拒绝并换下一 KP×QT 重试（不伪造 PASS）
          var evResult = KpSemantic.checkSemanticEvidence(sq, kp.id);
          if (evResult.state !== 'pass') continue;

          var intentRow = intentByKpQt[kp.id + '|' + qt] || null;
          var intentObj = intentRow && intentRow.intent || null;

          goldenQuestions.push({
            kpId: kp.id,
            semanticFamily: fam.id,
            // FINAL-40：12 字段记录——KP/family/teaching target/cognitive target/QT/intent/
            //            difficulty/variation/structure/semantic evidence/answer/validator
            teachingTarget: (intentObj && intentObj.trainsWhat) || kp.name,
            cognitiveTarget: sq.cognitiveLevel || null, // DEF-04：KBL 认知目标待人工治理，AI 不编造
            questionType: qt,
            intent: intentObj ? {
              whyThisType: intentObj.whyThisType || null,
              legitimacy: intentObj.legitimacy || null,
              driftRisk: intentObj.driftRisk || null
            } : null,
            difficulty: sq.difficulty || (sq.plan && sq.plan.difficulty) || null,
            // 变式维度：A 类概念题取 subType/mode；B/C 通用算法题无概念子型，退而取题内真实
    // 算法类型 operation（add/sub/mult/div/mixed）——同为题面已构造事实，不虚构。
    variation: (sq.data && (sq.data.subType || sq.data.mode || sq.data.operation)) || null,
            structure: {
              stem: sq.stem || sq.question || (sq.data && sq.data.prompt) || sq.prompt || null,
              options: sq.options || (sq.data && sq.data.options) || null,
              answer: sq.answer != null ? sq.answer : (sq.data && sq.data.answer)
            },
            semanticEvidence: sq.data && sq.data.semanticEvidence || null,
            answer: sq.answer != null
              ? (typeof sq.answer === 'object' ? JSON.stringify(sq.answer) : String(sq.answer))
              : (sq.data && sq.data.answer != null
                ? (typeof sq.data.answer === 'object' ? JSON.stringify(sq.data.answer) : String(sq.data.answer))
                : null),
            validator: {
              semanticEvidenceState: evResult.state,
              errors: (evResult.errors || []).length,
              warnings: (evResult.warnings || []).length
            },
            source: 'ai-candidate',
            humanReview: 'llm-finalized'
          });
          collected++;
          totalCollected++;
        } catch (e) {
          // 生成失败 → 跳过该 (KP, QT)
        }
      }
    }
    familyStats.push({ family: fam.id, name: fam.name, collected: collected });
    process.stdout.write('\r  族 ' + (fi + 1) + '/' + families.length + ' ' + fam.id + ' — 收 ' + collected + ' 题（总 ' + totalCollected + '）  ');
  }
  process.stdout.write('\n');

  var output = {
    schemaVersion: 'p25-16-v1',
    generatedAt: new Date().toISOString(),
    purpose: 'P25-16 黄金题集 — 15 语义族 × ~20 题 AI 候选 + 自动结构验证（SEMANTIC_PASS）',
    source: 'ai-candidate',
    reviewStatus: 'llm-finalized-dev',
    counts: {
      total: goldenQuestions.length,
      families: familyStats.length,
      byFamily: familyStats.reduce(function (acc, s) { acc[s.family] = s.collected; return acc; }, {})
    },
    questions: goldenQuestions
  };

  var outPath = path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log('黄金题集生成完成：');
  console.log('  总题数：' + goldenQuestions.length);
  console.log('  覆盖族：' + familyStats.length + '/15');
  console.log('  每族分布：');
  familyStats.forEach(function (s) {
    console.log('    ' + s.family + ' (' + s.name + ') — ' + s.collected + ' 题');
  });
  console.log('  产出：' + path.relative(ROOT, outPath));
  console.log('  全部 humanReview=llm-finalized（LLM 开发期定案；机器生成 + SEMANTIC_PASS 验证为质量保险）');
})();
