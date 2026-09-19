'use strict';

/**
 * dev/p25/draft-semantic-matrix.js — P25-02 教学语义覆盖矩阵起草（只读 + 人工评审产物生成）
 *
 * 职责：为 375 KP 生成人工评审矩阵（A/B/C/D semanticLevel + 9 项语义字段）。
 * 数据纪律（P25 红线）：
 *   - 禁止自动虚构教学目标：所有字段值只允许三种状态
 *       kbl-derived    —— KBL 现有字段的事实投影（与 P25-00 矩阵同源）
 *       draft-proposal —— 对 KBL 定义文本的机械分句提取（仅 A 类；必须经人工改写确认）
 *       needs-review   —— 无可靠来源，留空等人工填写（默认状态）
 *   - 本脚本不产出任何 confirmed 数据；confirmed 只能由人工评审写回（回灌走 KBL，另行流程）
 *   - 暂不修改正式 root Excel / kbl/canonical
 *
 * 输入：docs/p25/P25-KP-MATRIX.json（P25-00 基线）
 * 输出：docs/p25/P25-KP-SEMANTIC-REVIEW.json（机读评审文件）
 *       docs/p25/P25-KP-SEMANTIC-MATRIX.xlsx（人工评审表：总览 / A类评审 / D类治理 / 字段口径）
 *       docs/p25/P25-SEMANTIC-MATRIX.md（摘要）
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var OUT_DIR = path.join(ROOT, 'docs', 'p25');
var XLSX = require(path.join(ROOT, 'tools', 'kbl', 'xlsx.js'));

function assert(cond, msg) {
  if (!cond) { console.error('[P25-02] INVARIANT FAIL: ' + msg); process.exit(1); }
}

// ---------- 1. 载入基线 ----------
var matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', 'p25', 'P25-KP-MATRIX.json'), 'utf8'));
var kps = matrix.kps;
assert(kps.length === 375, 'KP 矩阵应为 375，实际 ' + kps.length);
assert(matrix.counts.allowMappings === 1570, 'ALLOW 应为 1570');

// ---------- 2. 字段起草 ----------
// A 类提案：把 KBL definition（矩阵 description）按中文分号/句号机械分句，
// 每条候选都必须是定义文本的原文子串（断言保证），状态 draft-proposal。
function extractProposalClauses(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split(/[；;。；]/)
    .map(function (s) { return s.replace(/^[，,\s]+|[，,\s]+$/g, '').replace(/\s+/g, ' ').trim(); })
    .filter(function (s) { return s.length >= 4; })
    .filter(function (s, i, arr) { return arr.indexOf(s) === i; });
}
// 去除分隔符后做子串校验（定义文本本身含分号）
function isSubstringOfDefinition(clause, definition) {
  if (!definition) return false;
  var flat = clause.replace(/\s+/g, '');
  var defFlat = definition.replace(/\s+/g, '');
  return defFlat.indexOf(flat) !== -1;
}

var FIELD_STATUS = { DERIVED: 'kbl-derived', PROPOSAL: 'draft-proposal', REVIEW: 'needs-review' };

var rows = kps.map(function (k) {
  var isA = k.draftSemanticLevel === 'A';
  var proposal = isA ? extractProposalClauses(k.description) : [];
  // 断言：提案必须是定义原文子串（防任何形式的虚构）
  proposal.forEach(function (c) {
    assert(isSubstringOfDefinition(c, k.description),
      '提案子串校验失败（虚构嫌疑）: ' + k.id + ' ← ' + c);
  });
  return {
    knowledgePointId: k.id,
    semanticLevel: k.draftSemanticLevel,
    levelBasis: k.draftBasis,
    grade: k.grade, book: k.book, unitNo: k.unitNo, unitId: k.unitId, unitName: k.unitName,
    module: k.module, name: k.name,
    semanticFamily: k.semanticFamily,
    seedDifficulty: k.seedDifficulty, maxSteps: k.maxSteps,
    allowByQuestionType: k.allowByQuestionType,
    generatorBindings: k.generatorBindings,
    fields: {
      concept:               { value: k.semanticConcept, status: k.semanticConcept ? FIELD_STATUS.DERIVED : FIELD_STATUS.REVIEW },
      learningTargets:       { value: proposal.length ? proposal : null, status: proposal.length ? FIELD_STATUS.PROPOSAL : FIELD_STATUS.REVIEW },
      operations:            { value: k.operations, status: FIELD_STATUS.DERIVED },
      representations:       { value: k.representations, status: FIELD_STATUS.DERIVED },
      cognitiveTargets:      { value: null, status: FIELD_STATUS.REVIEW, reference: k.cognitiveLevel },
      questionIntent:        { value: null, status: FIELD_STATUS.REVIEW, note: 'P25-03 KP×QT×Intent 矩阵填充' },
      variationDimensions:   { value: null, status: FIELD_STATUS.REVIEW, note: 'P25-09 VariationProfile 填充' },
      misconceptionTargets:  { value: k.misconceptionSlots, status: FIELD_STATUS.DERIVED, note: 'KBL errors 空槽，P25-10 治理' },
      prerequisiteKnowledge: { value: null, status: FIELD_STATUS.REVIEW }
    },
    definitionReference: k.description
  };
});

// 断言：无 confirmed；全量覆盖；A/B/C/D 与基线一致
assert(rows.length === 375, '行数应为 375');
rows.forEach(function (r) {
  assert(['A', 'B', 'C', 'D'].indexOf(r.semanticLevel) !== -1, '非法 semanticLevel: ' + r.knowledgePointId);
  Object.keys(r.fields).forEach(function (f) {
    assert(r.fields[f].status !== 'confirmed', '出现未授权 confirmed: ' + r.knowledgePointId + '.' + f);
  });
});

var levelDist = rows.reduce(function (o, r) { o[r.semanticLevel] = (o[r.semanticLevel] || 0) + 1; return o; }, {});
var aRows = rows.filter(function (r) { return r.semanticLevel === 'A'; });
var dRows = rows.filter(function (r) { return r.semanticLevel === 'D'; });
var proposalCount = aRows.filter(function (r) { return r.fields.learningTargets.status === FIELD_STATUS.PROPOSAL; }).length;

// ---------- 3. REVIEW.json ----------
var review = {
  schemaVersion: '1.0.0',
  purpose: 'P25-02 人工评审文件：semanticLevel 确认 + 9 项语义字段治理。confirmed 只能由人工写回，回灌 KBL 走另行流程',
  builtFrom: { kpMatrix: matrix.builtFrom, counts: matrix.counts },
  statuses: FIELD_STATUS,
  counts: {
    kps: rows.length, bySemanticLevel: levelDist,
    aWithLearningTargetProposal: proposalCount,
    aWithoutProposal: aRows.length - proposalCount,
    needsReviewFieldCells: rows.reduce(function (n, r) {
      return n + Object.keys(r.fields).filter(function (f) { return r.fields[f].status === FIELD_STATUS.REVIEW; }).length;
    }, 0)
  },
  humanReviewWorkflow: [
    '1. 确认/修正每行 semanticLevel（A/B/C/D 依据见 levelBasis；口径见 P25-BASELINE.md §8）',
    '2. A 类：把 learningTargets 的 draft-proposal 分句改写为规范目标语句（可增删），并补 cognitiveTargets/prerequisiteKnowledge',
    '3. 全部 KP：concept/operations/representations 为 KBL 事实投影，仅当 KBL 本身有误时修正（记录修正理由）',
    '4. misconceptionTargets 本阶段留空（P25-10 专项治理）；questionIntent 留待 P25-03；variationDimensions 留待 P25-09',
    '5. 确认结果以 KP 为单位回写 review json（status: draft-proposal→confirmed / needs-review→confirmed），禁止跳过人工直接 confirmed'
  ],
  kps: rows
};
fs.writeFileSync(path.join(OUT_DIR, 'P25-KP-SEMANTIC-REVIEW.json'), JSON.stringify(review, null, 2) + '\n');

// ---------- 4. XLSX ----------
function s(v) { return { v: v == null ? '' : String(v), t: 's' }; }

var overviewRows = [[
  'KP ID', '年级', '册', '单元号', '单元', '域', '名称', 'semanticLevel', '分级依据',
  '语义族', '认知层级', '初始难度', '最大步数', 'ALLOW 题型分布', 'learningTargets 状态'
]];
rows.forEach(function (r) {
  overviewRows.push([
    s(r.knowledgePointId), s(r.grade), s(r.book), s(r.unitNo), s(r.unitName), s(r.module), s(r.name),
    s(r.semanticLevel), s(r.levelBasis.join(' + ')), s(r.semanticFamily || ''),
    s(r.fields.cognitiveTargets.reference || ''), s(r.seedDifficulty != null ? r.seedDifficulty : ''),
    s(r.maxSteps != null ? r.maxSteps : ''),
    s(Object.keys(r.allowByQuestionType).map(function (q) { return q + '×' + r.allowByQuestionType[q]; }).join(' ')),
    s(r.fields.learningTargets.status)
  ]);
});

var aReviewRows = [[
  'KP ID', '单元', '名称', 'concept（KBL）', '认知层级（参考）',
  'learningTargets 提案（定义分句，需人工改写）', 'learningTargets（人工确认）',
  'cognitiveTargets（人工）', 'prerequisiteKnowledge（人工）', 'variationDimensions（P25-09）', 'misconceptionTargets（P25-10）'
]];
aRows.forEach(function (r) {
  aReviewRows.push([
    s(r.knowledgePointId), s(r.unitName), s(r.name),
    s(r.fields.concept.value || ''), s(r.fields.cognitiveTargets.reference || ''),
    s((r.fields.learningTargets.value || []).map(function (c, i) { return (i + 1) + '. ' + c; }).join('\n')),
    s(''), s(''), s(''), s(''), s('')
  ]);
});

var dReviewRows = [[
  'KP ID', '单元', '名称', '域', '表征', 'ALLOW 题型', '现有 Generator 绑定', '治理方向建议'
]];
dRows.forEach(function (r) {
  dReviewRows.push([
    s(r.knowledgePointId), s(r.unitName), s(r.name), s(r.module),
    s(r.fields.representations.value.join('/') || ''),
    s(Object.keys(r.allowByQuestionType).map(function (q) { return q + '×' + r.allowByQuestionType[q]; }).join(' ')),
    s(r.generatorBindings.length ? r.generatorBindings.join(', ') : '（无专项绑定）'),
    s(r.module === 'geometry' ? '图形/空间语义专项（P25 语义族→Generator 参数化）' :
      r.module === 'statistics' ? '统计语义专项（图表/数据整理）' : '按语义族专项治理')
  ]);
});

var dictRows = [[
  '字段', '类型', '状态取值', '说明 / 人工职责'
]];
[
  ['semanticLevel', 'A/B/C/D', 'draft→confirmed', 'A 深语义/B 结构语义/C 通用基础/D 待治理；依据 P25-BASELINE §8，人工可改判'],
  ['concept', 'string', 'kbl-derived', 'KBL semantic.concept 事实投影；仅 KBL 本身有误时修正并记录理由'],
  ['learningTargets', 'string[]', 'draft-proposal / needs-review→confirmed', 'A 类为定义分句提案，须人工改写为规范目标语句；其余人工编写'],
  ['operations', 'string[]', 'kbl-derived', 'KBL semantic.operations 事实投影'],
  ['representations', 'string[]', 'kbl-derived', 'KBL semantic.representations 事实投影'],
  ['cognitiveTargets', 'string[]', 'needs-review→confirmed', '人工编写；参考 cognitiveLevel（了解/认识/理解/掌握/运用锚点）'],
  ['questionIntent', 'object', 'needs-review', 'P25-03 KP×QT×Intent 矩阵统一填充，本表不填'],
  ['variationDimensions', 'string[]', 'needs-review', 'P25-09 VariationProfile 统一填充，本表不填'],
  ['misconceptionTargets', 'object[]', 'kbl-derived(空)→confirmed', 'P25-10 易错点专项治理，本表不填'],
  ['prerequisiteKnowledge', 'string[]', 'needs-review→confirmed', '人工编写前置知识点（建议引用 KP ID 或教材单元）']
].forEach(function (r) { dictRows.push(r.map(s)); });

XLSX.writeXlsx([
  { name: '总览', rows: overviewRows },
  { name: 'A类评审', rows: aReviewRows },
  { name: 'D类治理', rows: dReviewRows },
  { name: '字段口径', rows: dictRows }
], path.join(OUT_DIR, 'P25-KP-SEMANTIC-MATRIX.xlsx'));

// ---------- 5. 摘要 MD ----------
var md = [];
md.push('# P25-SEMANTIC-MATRIX — 375 KP 教学语义覆盖矩阵（P25-02 起草）');
md.push('');
md.push('> 由 `dev/p25/draft-semantic-matrix.js` 生成；**人工数据治理阶段产物，不写入任何正式数据**。');
md.push('');
md.push('| 项 | 值 |');
md.push('| --- | --- |');
md.push('| 覆盖 | 375/375 KP |');
md.push('| semanticLevel 分布 | ' + JSON.stringify(levelDist) + ' |');
md.push('| A 类带 learningTargets 提案 | ' + proposalCount + ' / ' + aRows.length + '（提案=KBL 定义机械分句，子串断言防虚构） |');
md.push('| NEEDS_REVIEW 字段格 | ' + review.counts.needsReviewFieldCells + ' |');
md.push('');
md.push('## 产物');
md.push('');
md.push('- [P25-KP-SEMANTIC-MATRIX.xlsx](./P25-KP-SEMANTIC-MATRIX.xlsx) — 人工评审表（总览 / A类评审 / D类治理 / 字段口径）');
md.push('- [P25-KP-SEMANTIC-REVIEW.json](./P25-KP-SEMANTIC-REVIEW.json) — 机读评审文件（含 workflow 与逐字段状态）');
md.push('');
md.push('## 状态机');
md.push('');
md.push('```');
md.push('kbl-derived（事实投影，人工可修正）  ──人工确认──▶  confirmed');
md.push('draft-proposal（A类定义分句提案）    ──人工改写──▶  confirmed');
md.push('needs-review（无可靠来源，留空）    ──人工编写──▶  confirmed');
md.push('```');
md.push('');
md.push('禁止：AI 直接 confirmed；confirmed 数据未回灌 KBL 前不得进入正式数据链路（P25-01 Schema E05 会拒绝 NEEDS_REVIEW 携带内容）。');
md.push('');
fs.writeFileSync(path.join(OUT_DIR, 'P25-SEMANTIC-MATRIX.md'), md.join('\n'));

// ---------- 6. 汇总 ----------
console.log('[P25-02] 语义覆盖矩阵起草完成（只读，未修改任何正式数据）');
console.log('  覆盖 375/375；semanticLevel：' + JSON.stringify(levelDist));
console.log('  A 类提案覆盖：' + proposalCount + '/' + aRows.length + '；NEEDS_REVIEW 字段格：' + review.counts.needsReviewFieldCells);
console.log('  产出：docs/p25/P25-KP-SEMANTIC-MATRIX.xlsx, P25-KP-SEMANTIC-REVIEW.json, P25-SEMANTIC-MATRIX.md');
