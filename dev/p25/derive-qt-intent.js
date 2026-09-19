'use strict';

/**
 * dev/p25/derive-qt-intent.js — P25-03 KP×QuestionType×题目意图矩阵推导（AI 受限推导核准流程）
 *
 * 职责：对 1570 条 ALLOW（KP×题型）逐行推导指令要求的「五问」意图：
 *   ① trainsWhat      这道题训练哪个知识点
 *   ② whyThisType     为什么用这个题型
 *   ③ differentiation 这道题与同一 KP 其他题型有何不同
 *   ④ driftRisk       出这道题时最容易出现什么语义漂移
 *   ⑤ legitimacy      这道题的教育正当性
 *
 * 数据纪律（AI 验证流程，用户已授权）：
 *   - 推导输入只有 KBL 源（kbl/data）+ 题型注册表元数据 + ALLOW 映射；不读任何中间评审文件
 *   - 组句全部为「KBL 事实 × 题型元数据」的模板化组合，不引入外部教材内容（受限推导，可溯源）
 *   - 状态机：ai-verified（五问全部推导成功且无冲突旗标）/ needs-review（任一问无法可靠推导，
 *     该问内容必须为 null，冲突以机械旗标记录于 evidence.flags）
 *   - 不改 ALLOW、不写正式 KBL；抽查通过后由人工批量升级 confirmed
 *
 * 输入：kbl/data/math/g1..g6/knowledge-points.json
 *       kbl/mappings/generation-contract/math.json（ALLOW 真值源）
 *       shared/knowledge/question-type-registry.js（题型元数据：category/cognitiveLevels/supports）
 * 输出：kbl/teaching/qt-intent.json（1570 行意图矩阵）
 *       kbl/teaching/qt-intent-sample.xlsx（人工抽查单：按语义族分层抽样）
 *       docs/p25/P25-KP-QT-INTENT.md（报告）
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var TEACHING_DIR = path.join(ROOT, 'kbl', 'teaching');
var DOCS_DIR = path.join(ROOT, 'docs', 'p25');
var XLSX = require(path.join(ROOT, 'tools', 'kbl', 'xlsx.js'));

function assert(cond, msg) {
  if (!cond) { console.error('[P25-03] INVARIANT FAIL: ' + msg); process.exit(1); }
}

// ---------- 1. 载入 KBL 源 ----------
var kps = [];
['g1', 'g2', 'g3', 'g4', 'g5', 'g6'].forEach(function (g) {
  kps = kps.concat(require(path.join(ROOT, 'kbl', 'data', 'math', g, 'knowledge-points.json')).knowledgePoints);
});
assert(kps.length === 375, 'KP 应为 375，实际 ' + kps.length);
var byId = {};
kps.forEach(function (k) { byId[k.knowledgeId] = k; });

var mappingsRaw = require(path.join(ROOT, 'kbl', 'mappings', 'generation-contract', 'math.json'));
var mappings = Array.isArray(mappingsRaw) ? mappingsRaw : mappingsRaw.mappings;
var allow = mappings.filter(function (m) { return m.permission === 'allow'; });
assert(allow.length === 1570, 'ALLOW 应为 1570，实际 ' + allow.length);

var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));

// ---------- 2. 题型元数据（源自 QTR，题型级 7 条，非 KP 级硬编码） ----------
var LEVEL_CN = { recognize: '认识', understand: '理解', apply: '应用', analyze: '分析', recall: '了解' };
var CATEGORY_CN = {
  calculation: '计算操作', written: '书面表达', selection: '辨认判断',
  geometry: '图形操作', classification: '分类整理', application: '综合应用'
};
// 题型级通用语义漂移（教学法常识，作用于该题型所有行，非 KP 专属断言）
var TYPE_DRIFT = {
  calc: '题面退化为纯算式，知识点语义情境丢失（算对≠理解该知识的意义）',
  fill: '答案唯一性约束下退化为机械计算或抄写，考查点从理解滑向记忆',
  choice: '干扰项排除法使「辨认」替代「理解」，答对不代表掌握（猜测成分）',
  judge: '50% 猜测成分，判断正确不能独立证明理解',
  geometry: '作图/操作要求在非交互载体上退化为文字描述，图形表征降级',
  classify: '若分组元素可被单一表面特征（数值大小）分组，退化为排序/计算',
  apply: '情境阅读负担淹没数学内核，考查点从数学滑向语文阅读'
};

function typeMeta(qt) {
  var t = null;
  QTR.TYPES.forEach(function (x) { if (x.id === qt) t = x; });
  assert(t, '未知题型 ' + qt);
  return t;
}

// ---------- 3. KP 静态事实 ----------
function kpFacts(kp) {
  var sem = kp.semantic || {};
  var ann = kp.difficultyAnnotation || {};
  var def = (kp.content && typeof kp.content.description === 'string') ? kp.content.description : '';
  var firstSentence = def.split(/[。；;]/).map(function (s) { return s.trim(); }).filter(Boolean)[0] || '';
  return {
    id: kp.knowledgeId,
    name: kp.name || '',
    unitName: kp.unitName || '',
    concept: sem.concept || '',
    definitionHead: firstSentence,
    level: ann.cognitiveLevel || '',
    graphic: (sem.representations || []).indexOf('graphic') !== -1,
    module: kp.module || '',
    family: sem.family || ''
  };
}
var facts = {};
kps.forEach(function (k) { facts[k.knowledgeId] = kpFacts(k); });

// ALLOW 按 KP 分组
var allowByKp = {};
allow.forEach(function (m) {
  (allowByKp[m.knowledgeId] = allowByKp[m.knowledgeId] || []).push(m.questionType);
});

// ---------- 4. 五问推导（模板化，全部引用可溯源事实） ----------
function deriveRow(knowledgeId, questionType) {
  var f = facts[knowledgeId];
  var t = typeMeta(questionType);
  var cats = (t.cognitiveLevels || []).map(function (l) { return LEVEL_CN[l] || l; }).join('/');
  var flags = [];
  var st = {}; // 每问状态

  // ① trainsWhat —— KBL 事实投影，恒可推导
  var what = '训练「' + f.name + '」（' + f.unitName + (f.concept ? ' · ' + f.concept : '') + '）';
  if (f.definitionHead) what += '：' + f.definitionHead;
  st.trainsWhat = 'kbl-derived';

  // ② whyThisType —— 认知/表征/范畴匹配证据，≥1 条才可推导
  var matches = [];
  if ((t.cognitiveLevels || []).indexOf(f.level) !== -1) {
    matches.push('认知匹配：本知识点认知层级「' + (LEVEL_CN[f.level] || f.level) + '」在' + questionType + '题型认知区间[' + cats + ']内');
  }
  if (f.graphic && t.supports && t.supports.graphic) {
    matches.push('表征支持：本知识点含图形表征，' + questionType + '题型支持图形呈现');
  }
  if (!f.graphic && questionType === 'calc') {
    matches.push('数值表征：本知识点为数值表征，与计算题的算式形态一致');
  }
  if (f.module === 'geometry' && questionType === 'geometry') {
    matches.push('范畴对应：图形与几何域知识点对应操作/作图题型');
  }
  if (f.module === 'practice' && t.supports && t.supports.context) {
    matches.push('情境支持：综合与实践域知识点适合有情境载体的题型');
  }
  var why = matches.length ? questionType + '（' + t.name + '，' + (CATEGORY_CN[t.category] || t.category) + '）选取依据——' + matches.join('；') : null;
  st.whyThisType = matches.length ? 'ai-verified' : 'needs-review';
  if (!matches.length) flags.push('no-type-evidence');

  // ③ differentiation —— 与同 KP 其他 ALLOW 题型的元数据差异
  var others = (allowByKp[knowledgeId] || []).filter(function (q) { return q !== questionType; }).sort();
  var diff = null;
  if (others.length) {
    var dims = [];
    var sup = t.supports || {};
    others.forEach(function (o) {
      var ot = typeMeta(o); var osup = ot.supports || {};
      if ((ot.category || '') !== (t.category || '')) dims.push(o + '属' + (CATEGORY_CN[ot.category] || ot.category) + '而本题型属' + (CATEGORY_CN[t.category] || t.category));
      if (!!osup.distractors !== !!sup.distractors) dims.push(o + (osup.distractors ? '含干扰项（辨认成分重）' : '无干扰项（需独立产出）'));
      if (!!osup.context !== !!sup.context) dims.push(o + (osup.context ? '带情境' : '不带情境'));
      if (!!osup.graphic !== !!sup.graphic) dims.push(o + (osup.graphic ? '支持图形' : '仅文字/算式'));
      var spanO = (ot.cognitiveLevels || []).length, spanT = (t.cognitiveLevels || []).length;
      if (spanO !== spanT) dims.push(o + '认知跨度[' + (ot.cognitiveLevels || []).map(function (l) { return LEVEL_CN[l] || l; }).join('/') + ']与本题型[' + cats + ']不同');
    });
    if (dims.length) {
      diff = '同 KP 其他允许题型：' + others.join('、') + '。本题型差异——' + dims.slice(0, 3).join('；');
      st.differentiation = 'ai-verified';
    } else { st.differentiation = 'needs-review'; flags.push('no-type-contrast'); }
  } else {
    st.differentiation = 'needs-review';
    flags.push('single-type-kp');
  }

  // ④ driftRisk —— 题型级通用漂移 + KP 冲突旗标，恒可推导
  var risks = [TYPE_DRIFT[questionType]];
  if (f.graphic && !(t.supports && t.supports.graphic)) {
    risks.push('表征冲突：本知识点含图形表征而该题型不支持图形，图形语义将降级为文字/算式');
    flags.push('representation-conflict');
  }
  var risk = '风险（' + questionType + '）：' + risks.join('；');
  st.driftRisk = 'ai-verified';

  // ⑤ legitimacy —— 认知区间内且无表征冲突才可给出
  var cognitiveOk = (t.cognitiveLevels || []).indexOf(f.level) !== -1;
  var repOk = !(f.graphic && !(t.supports && t.supports.graphic));
  if (!cognitiveOk) flags.push('cognitive-out-of-range');
  var legit;
  if (cognitiveOk && repOk) {
    legit = '成立：认知层级「' + (LEVEL_CN[f.level] || f.level) + '」落于' + questionType + '认知区间[' + cats + ']' +
      (f.graphic ? '，图形表征获支持' : '，数值表征与题型形态兼容') + '；配合 driftRisk 所列风险的命题侧规避，该 KP×题型组合具备教育正当性';
    st.legitimacy = 'ai-verified';
  } else {
    legit = null;
    st.legitimacy = 'needs-review';
    if (!cognitiveOk && repOk) flags.push('legitimacy-cognitive-only');
  }

  var values = {
    trainsWhat: what,
    whyThisType: why,
    differentiation: diff,
    driftRisk: risk,
    legitimacy: legit
  };
  var statuses = ['trainsWhat', 'whyThisType', 'differentiation', 'driftRisk', 'legitimacy'].map(function (k) { return st[k]; });
  var rowStatus = statuses.indexOf('needs-review') === -1 ? 'ai-verified' : 'needs-review';

  return {
    knowledgeId: knowledgeId,
    questionType: questionType,
    status: rowStatus,
    intent: values,
    intentStatus: st,
    evidence: {
      kbl: { cognitiveLevel: f.level, representations: f.graphic ? ['numeric', 'graphic'] : ['numeric'], module: f.module, family: f.family },
      type: { category: t.category, cognitiveLevels: t.cognitiveLevels, supports: t.supports },
      matches: matches,
      flags: flags
    }
  };
}

// ---------- 5. 全量 1570 行 ----------
var rows = allow.map(function (m) { return deriveRow(m.knowledgeId, m.questionType); });
assert(rows.length === 1570, '行数应为 1570');
// 集合相等断言：与 ALLOW 一一对应
var keySet = {};
rows.forEach(function (r) { keySet[r.knowledgeId + '|' + r.questionType] = true; });
allow.forEach(function (m) { assert(keySet[m.knowledgeId + '|' + m.questionType], '缺行 ' + m.knowledgeId + '|' + m.questionType); });
assert(Object.keys(keySet).length === 1570, '行集合应恰为 1570');
// 红线断言：needs-review 行的空问必须为 null；ai-verified 行五问全部非空
rows.forEach(function (r) {
  ['trainsWhat', 'whyThisType', 'differentiation', 'driftRisk', 'legitimacy'].forEach(function (k) {
    if (r.intentStatus[k] === 'needs-review') assert(r.intent[k] === null, 'needs-review 问携带内容: ' + r.knowledgeId + '|' + r.questionType + '.' + k);
    if (r.status === 'ai-verified') assert(r.intent[k] !== null, 'ai-verified 行有空问: ' + r.knowledgeId + '|' + r.questionType + '.' + k);
  });
});

var aiRows = rows.filter(function (r) { return r.status === 'ai-verified'; });
var nrRows = rows.filter(function (r) { return r.status === 'needs-review'; });

// ---------- 5.5 人工抽查账本合并（P25-03 AI 验证流程：裁决在重推导中持久） ----------
// ledger 由 dev/p25/import-qt-intent-review.js 从人工回填的 qt-intent-sample.xlsx 生成；
// verdict=通过 → confirmed（含 needs-review 行的人工接受，旗标保留）；verdict=打回 → 保留原状态并记录 humanReview
var reviewLedger = null;
try { reviewLedger = JSON.parse(fs.readFileSync(path.join(TEACHING_DIR, 'qt-intent-review.json'), 'utf8')); } catch (e) { /* 首次推导无账本，合法 */ }
var confirmedRows = [], rejectedRows = [];
function applyVerdict(key, v, batchTag) {
  var hit = null;
  rows.forEach(function (r) { if (r.knowledgeId + '|' + r.questionType === key) hit = r; });
  if (!hit) { console.warn('[P25-03] 账本行不在矩阵中，跳过: ' + key); return; }
  if (v.verdict === '通过') {
    hit.status = 'confirmed';
    hit.evidence.humanReview = { verdict: 'confirmed', batch: batchTag };
    confirmedRows.push(hit);
  } else if (v.verdict === '打回') {
    hit.evidence.humanReview = { verdict: 'rejected', batch: batchTag, note: v.note || '' };
    rejectedRows.push(hit);
  }
}
if (reviewLedger) {
  if (reviewLedger.verdicts) Object.keys(reviewLedger.verdicts).forEach(function (key) {
    applyVerdict(key, reviewLedger.verdicts[key], reviewLedger.batch || 'sample-1');
  });
  (reviewLedger.supplements || []).forEach(function (sup) {
    Object.keys(sup.verdicts || {}).forEach(function (key) {
      applyVerdict(key, sup.verdicts[key], sup.batch || 'supplement');
    });
  });
}
var flagDist = {};
rows.forEach(function (r) { r.evidence.flags.forEach(function (x) { flagDist[x] = (flagDist[x] || 0) + 1; }); });
var byQt = {}, byModule = {};
rows.forEach(function (r) {
  byQt[r.questionType] = (byQt[r.questionType] || 0) + 1;
  byModule[r.evidence.kbl.module] = (byModule[r.evidence.kbl.module] || 0) + 1;
});
// 合并后状态口径：confirmed（含 AI 核准后人工抽查通过与 needs-review 行人工接受）/
// ai-verified（待抽查，含被「打回」行——它们带 humanReview.rejected 旗标）/
// needs-review（未裁决或推导不可行）
aiRows = rows.filter(function (r) { return r.status === 'ai-verified'; });
nrRows = rows.filter(function (r) { return r.status === 'needs-review'; });

// ---------- 6. 产出 qt-intent.json ----------
var extract = require(path.join(ROOT, 'kbl', 'import', 'extract-raw.json'));
var out = {
  schemaVersion: '1.0.0',
  purpose: 'P25-03 KP×QuestionType×题目意图矩阵（五问）。AI 受限推导核准流程：ai-verified=五问全部推导成功，待人工抽查升级 confirmed；needs-review 问以机械旗标记录于 evidence.flags',
  builtFrom: {
    kblData: 'kbl/data/math/g1..g6/knowledge-points.json',
    allowMappings: 'kbl/mappings/generation-contract/math.json',
    qtr: 'shared/knowledge/question-type-registry.js',
    sourceFingerprint: extract.fingerprint.fileHash.slice(0, 8),
    counts: { knowledgePoints: 375, allow: 1570 }
  },
  statuses: { AI_VERIFIED: 'ai-verified', NEEDS_REVIEW: 'needs-review', CONFIRMED: 'confirmed' },
  counts: {
    rows: rows.length, confirmed: confirmedRows.length, aiVerified: aiRows.length, needsReview: nrRows.length,
    rejected: rejectedRows.length,
    byQuestionType: byQt, byModule: byModule, flags: flagDist
  },
  rows: rows
};
fs.writeFileSync(path.join(TEACHING_DIR, 'qt-intent.json'), JSON.stringify(out, null, 2) + '\n');

// ---------- 7. 抽查单（按语义族分层：每族前 2 个 KP 的全部 ALLOW 行；另补前 8 个 needs-review KP） ----------
var families = {};
kps.forEach(function (k) {
  var fam = (k.semantic && k.semantic.family) || '(无族)';
  (families[fam] = families[fam] || []).push(k.knowledgeId);
});
var sampledKp = {};
Object.keys(families).sort().forEach(function (fam) {
  families[fam].sort().slice(0, 2).forEach(function (id) { sampledKp[id] = fam; });
});
var nrKpSeen = 0;
Object.keys(allowByKp).sort().forEach(function (id) {
  if (nrKpSeen >= 8) return;
  var hasNr = allowByKp[id].some(function (q) {
    var hit = rows.filter(function (r) { return r.knowledgeId === id && r.questionType === q; })[0];
    return hit && hit.status === 'needs-review';
  });
  if (hasNr && !sampledKp[id]) { sampledKp[id] = '(needs-review 补样)'; nrKpSeen++; }
});
var sampleRows = rows.filter(function (r) { return sampledKp[r.knowledgeId]; });

function s(v) { return { v: v == null ? '' : String(v), t: 's' }; }
var sheetRows = [[
  'KP ID', '语义族', '题型', '行状态', '①训练什么', '②为何此题型', '③与其他题型差异', '④语义漂移风险', '⑤教育正当性', '机械旗标', '人工结论（通过/打回）', '备注'
]];
sampleRows.forEach(function (r) {
  sheetRows.push([
    s(r.knowledgeId), s(sampledKp[r.knowledgeId] || ''), s(r.questionType), s(r.status),
    s(r.intent.trainsWhat), s(r.intent.whyThisType), s(r.intent.differentiation), s(r.intent.driftRisk), s(r.intent.legitimacy),
    s(r.evidence.flags.join(',')), s(''), s('')
  ]);
});
var dictRows = [['项', '说明']];
[
  ['行状态 ai-verified', '五问全部由 KBL 事实×题型元数据模板化推导，无冲突旗标；抽查通过后升级 confirmed'],
  ['行状态 needs-review', '至少一问无法可靠推导（内容为 null），原因见机械旗标'],
  ['机械旗标含义', 'no-type-evidence=无题型匹配证据；single-type-kp=该 KP 仅一种 ALLOW 题型，无从对比；no-type-contrast=题型元数据无差异维度；representation-conflict=图形表征×不支持图形的题型；cognitive-out-of-range=认知层级在题型区间外'],
  ['抽查方式', '逐行核对五问是否与你的教学判断一致；「通过」= 该行可升级 confirmed；「打回」= 在备注写正确表述，AI 按备注修正后重新送审'],
  ['抽样规则', '每语义族前 2 个 KP 全行 + 8 个含 needs-review 的 KP（确保负面样本可见）']
].forEach(function (r) { dictRows.push(r.map(s)); });
XLSX.writeXlsx([
  { name: '抽查行', rows: sheetRows },
  { name: '口径', rows: dictRows }
], path.join(TEACHING_DIR, 'qt-intent-sample.xlsx'));

// ---------- 8. 报告 MD ----------
var md = [];
md.push('# P25-KP-QT-INTENT — KP×题型×题目意图矩阵（P25-03）');
md.push('');
md.push('> 由 `dev/p25/derive-qt-intent.js` 从 KBL 源受限推导生成；**AI 验证流程**（用户已授权）：`ai-verified` 行待人工抽查后升级 `confirmed`。未改 ALLOW、未写正式 KBL。');
md.push('');
md.push('| 指标 | 值 |');
md.push('| --- | --- |');
md.push('| 覆盖 | 1570/1570 ALLOW 行（集合相等断言） |');
if (confirmedRows.length) {
  md.push('| **confirmed（人工抽查通过）** | **' + confirmedRows.length + '** |');
  md.push('| ai-verified（待抽查） | ' + aiRows.length + '（其中被「打回」' + rejectedRows.length + ' 行待修正重审） |');
  md.push('| needs-review（未裁决） | ' + nrRows.length + '（旗标：' + JSON.stringify(flagDist) + '） |');
} else {
  md.push('| ai-verified | **' + aiRows.length + '**（' + (aiRows.length / 15.7).toFixed(1) + '%） |');
  md.push('| needs-review | ' + nrRows.length + '（旗标：' + JSON.stringify(flagDist) + '） |');
}
md.push('| 题型分布 | ' + JSON.stringify(byQt) + ' |');
md.push('');
md.push('## needs-review 旗标语义（内容为 null 的原因，全部为机械可判定事实）');
md.push('');
md.push('- `single-type-kp`（' + (flagDist['single-type-kp'] || 0) + '）：该 KP 仅一种 ALLOW 题型，「与其他题型差异」一问无从对比 → 留待题型扩充或人工补写');
md.push('- `representation-conflict`（' + (flagDist['representation-conflict'] || 0) + '）：图形表征 KP × 不支持图形的题型 → 正当性存疑，是 P25-06/07 的治理输入');
md.push('- `cognitive-out-of-range`（' + (flagDist['cognitive-out-of-range'] || 0) + '）：KP 认知层级在该题型认知区间外 → 正当性存疑。**词表口径注意**：KBL 用 `recognize`（认识），QTR calc/fill/classify/apply 区间为 `[recall(了解), understand, apply]` 而不含 recognize——「认识级知识练计算」是否越界属课程标准解释问题，机械旗标从严标记，**交人工抽查裁决**，不静默放行');
md.push('- `no-type-evidence` / `no-type-contrast`：推导证据不足');
md.push('');
md.push('## 产物');
md.push('');
md.push('- [qt-intent.json](../../kbl/teaching/qt-intent.json) — 1570 行意图矩阵（五问 + 逐问状态 + evidence 溯源）');
md.push('- [qt-intent-sample.xlsx](../../kbl/teaching/qt-intent-sample.xlsx) — 人工抽查单（' + sampleRows.length + ' 行，按语义族分层 + needs-review 负面样本）');
md.push('');
fs.writeFileSync(path.join(DOCS_DIR, 'P25-KP-QT-INTENT.md'), md.join('\n'));

// ---------- 9. 汇总 ----------
console.log('[P25-03] 意图矩阵推导完成（AI 受限推导核准流程）');
console.log('  1570/1570 行；confirmed=' + confirmedRows.length + ' ai-verified=' + aiRows.length + ' needs-review=' + nrRows.length + ' 打回=' + rejectedRows.length);
console.log('  旗标：' + JSON.stringify(flagDist));
console.log('  抽查单：' + sampleRows.length + ' 行（' + Object.keys(sampledKp).length + ' 个 KP）');
console.log('  产出：kbl/teaching/qt-intent.json, kbl/teaching/qt-intent-sample.xlsx, docs/p25/P25-KP-QT-INTENT.md');
