#!/usr/bin/env node
'use strict';
// dev/p27/derive-misconceptions.js — P27-10 MisconceptionProfile 易错点剖面派生
//
// 目标：把 P25-10 任务书缺口「kp-matrix misconceptionSlots 空槽（不伪造自觉留白），
// 无 triggerPattern→变式机制」收口为显式 overlay。
// 红线（不伪造）：
//   - 槽位不是人工编写的教学断言，而是「固定策略规则表 × KBL 事实」的机械匹配产物：
//     每条 slot 必须带 basis（触发它的 KBL 事实引文），无 KBL 事实支撑的 errorType
//     对该 KP 不产出 slot（留空）。
//   - response（变式响应）必须被 P27-09 变式剖面实测证据支撑：响应轴在该 KP 的
//     ALLOW 行剖面上有非平凡观测（evidenceRows>0），否则不产出（变式无承载=空谈）。
//   - errorType 全集与 shared/learner/error-model.js ERROR_TYPES 机械对齐（8 类）；
//     variant 全集与 shared/strategy/adaptive-strategy.js VARIANTS 机械对齐（6 变体）。
//   - 独立 overlay（kbl/teaching/misconception-profiles.json），不改 kp-matrix.json
//     （那是 build-baseline.js 再生产物）。
//
// triggerPattern 为计划期可判定谓词：questionTypes ∈ canonical 7 类 + operations
// ∈ {add,sub,mult,div}（标签形态；运行时匹配由 P27-11 resolver 归一）。
//
// 产出：
//   kbl/teaching/misconception-profiles.json        —— 易错点 overlay SSOT（P27-11 消费）
//   dev/p27/reports/misconception-derive-report.json —— 逐 KP 命中明细
//
// 用法：node dev/p27/derive-misconceptions.js

var fs = require('fs');
var path = require('path');
var __dirnameRoot = path.join(__dirname, '..', '..');

var ErrorModel = require(path.join(__dirnameRoot, 'shared', 'learner', 'error-model.js'));
var Adaptive = require(path.join(__dirnameRoot, 'shared', 'strategy', 'adaptive-strategy.js'));
var matrix = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'kp-matrix.json'));
var profile = require(path.join(__dirnameRoot, 'kbl', 'teaching', 'variation-profiles.json'));

function assert(cond, msg) {
  if (!cond) { console.error('[P27-10] INVARIANT FAIL: ' + msg); process.exit(1); }
}

// ---- 0. 全集对齐（防策略表漂移出 error-model / VARIANTS 之外）----
assert(ErrorModel.ERROR_TYPES.length === 8, 'error-model ERROR_TYPES 应为 8 类');
var RULE_ERROR_TYPES = ['计算错误', '口诀混淆', '概念混淆', '符号错误', '步骤错误', '审题错误', '单位错误', '格式错误'];
RULE_ERROR_TYPES.forEach(function (t) {
  assert(ErrorModel.ERROR_TYPES.indexOf(t) !== -1, '策略表 errorType 越界: ' + t);
});
var VARIANTS = Adaptive.VARIANTS;
assert(VARIANTS.length === 6, 'adaptive VARIANTS 应为 6 变体');

// ---- 1. 变式剖面按 KP 索引 ----
var rowsByKp = {};
profile.rows.forEach(function (r) {
  (rowsByKp[r.knowledgePointId] = rowsByKp[r.knowledgePointId] || []).push(r);
});

/** 响应轴证据：该 KP 剖面上轴的非平凡观测行数 */
function axisEvidence(kpId, axis) {
  var rows = rowsByKp[kpId] || [];
  var n = 0;
  rows.forEach(function (r) {
    if (!r.variation) return;
    var v = r.variation;
    var hit = false;
    if (axis === 'numeric') hit = v.numeric.varies === true;
    else if (axis === 'context') hit = v.context.present === true;
    else if (axis === 'representation') hit = v.representation.present === true;
    else if (axis === 'structure') hit = v.structure.steps.length >= 1;
    else if (axis === 'unknown') hit = v.unknown.positions.length > 0;
    if (hit) n++;
  });
  return n;
}

// ---- 2. 固定策略规则表（SSOT；errorType → 触发 KBL 事实谓词 + 计划期 trigger + 变式响应）----
// each: { errorType, when(kp)→basis|null, trigger, variant, axis }
var RULES = [
  {
    errorType: '计算错误',
    when: function (kp) {
      var ops = kp.operations || [];
      return ops.length ? 'semantic.operations=[' + ops.join(',') + ']' : null;
    },
    trigger: { questionTypes: ['calc', 'fill'] },
    variant: '数值', axis: 'numeric'
  },
  {
    errorType: '口诀混淆',
    when: function (kp) {
      var ops = kp.operations || [];
      var has = ops.indexOf('multiplication') !== -1 || ops.indexOf('division') !== -1;
      var g = parseInt(String(kp.grade).replace(/\D/g, ''), 10); // grade 形态 "g2" → 2
      return (has && g >= 1 && g <= 3) ? 'semantic.operations∋乘除; grade=' + kp.grade + '≤g3（表内段）' : null;
    },
    trigger: { questionTypes: ['calc', 'fill'], operations: ['mult', 'div'] },
    variant: '数值', axis: 'numeric'
  },
  {
    errorType: '概念混淆',
    when: function (kp) {
      return kp.semanticFamily ? 'semantic.family=' + kp.semanticFamily : null;
    },
    trigger: { questionTypes: ['choice', 'judge', 'classify'] },
    variant: '呈现', axis: 'representation'
  },
  {
    errorType: '符号错误',
    when: function (kp) {
      var ops = kp.operations || [];
      return ops.indexOf('subtraction') !== -1 ? 'semantic.operations∋subtraction（退位/负向语境）' : null;
    },
    trigger: { questionTypes: ['calc', 'fill'], operations: ['sub'] },
    variant: '呈现', axis: 'representation'
  },
  {
    errorType: '步骤错误',
    when: function (kp) {
      return kp.maxSteps >= 2 ? 'capability.maxSteps=' + kp.maxSteps + '≥2' : null;
    },
    trigger: { questionTypes: ['calc', 'fill', 'apply'] },
    variant: '结构', axis: 'structure'
  },
  {
    errorType: '审题错误',
    when: function (kp) {
      return axisEvidence(kp.id, 'context') > 0
        ? 'variation profile context.present（' + axisEvidence(kp.id, 'context') + ' 行）' : null;
    },
    trigger: { questionTypes: ['apply', 'judge', 'choice'] },
    variant: '情境', axis: 'context'
  },
  {
    errorType: '单位错误',
    when: function (kp) {
      // 粗族守卫 + 名称单位词正则（防跨族误配，同 subTopic 规则教训）
      var fams = ['geometry', 'application-word'];
      var UNIT_RE = /厘米|分米|毫米|千米|克|千克|吨|元|角|分$|面积|周长|长度|质量|时间|人民币|秒/;
      return (fams.indexOf(kp.semanticFamily) !== -1 && UNIT_RE.test(kp.name || ''))
        ? 'semantic.family=' + kp.semanticFamily + ' + name 单位词命中（' + (kp.name || '').slice(0, 20) + '）' : null;
    },
    trigger: { questionTypes: ['fill', 'apply'] },
    variant: '情境', axis: 'context'
  },
  {
    errorType: '格式错误',
    when: function (kp) {
      return kp.allowByQuestionType && kp.allowByQuestionType.fill
        ? 'ALLOW questionTypes∋fill（答案格式敏感）' : null;
    },
    trigger: { questionTypes: ['fill'] },
    variant: '基础', axis: 'representation'
  }
];

// ---- 3. 主循环：固定规则表 × 375 KP 机械匹配 ----
var kpsOut = {};
var stats = { kps: 0, kpsWithSlots: 0, slots: 0, droppedByAxisEvidence: 0, byErrorType: {} };
matrix.kps.forEach(function (kp) {
  stats.kps++;
  var slots = [];
  RULES.forEach(function (rule) {
    var basis = rule.when(kp);
    if (!basis) return;
    var evRows = axisEvidence(kp.id, rule.axis);
    if (evRows === 0) { stats.droppedByAxisEvidence++; return; } // 响应轴无实测承载 → 不产出
    assert(VARIANTS.indexOf(rule.variant) !== -1, 'variant 越界: ' + rule.variant);
    assert(ErrorModel.normalizeErrorType(rule.errorType) === rule.errorType, 'errorType 非法: ' + rule.errorType);
    slots.push({
      errorType: rule.errorType,
      basis: basis,
      triggerPattern: rule.trigger,
      response: { variant: rule.variant, axis: rule.axis, evidenceRows: evRows }
    });
    stats.byErrorType[rule.errorType] = (stats.byErrorType[rule.errorType] || 0) + 1;
  });
  if (slots.length) {
    stats.kpsWithSlots++;
    stats.slots += slots.length;
    kpsOut[kp.id] = { knowledgePointId: kp.id, slots: slots };
  }
});

// ---- 4. 不变式 ----
assert(Object.keys(kpsOut).every(function (id) {
  return matrix.kps.some(function (k) { return k.id === id; });
}), 'overlay KP id 必须是矩阵 375 子集');

// ---- 5. 写出 ----
var out = {
  schemaVersion: 'p27-misconception.1',
  note: 'P27-10 MisconceptionProfile：固定策略规则表 × KBL 事实机械匹配（每 slot 带 basis 引文），响应轴须有 P27-09 变式剖面实测证据；独立 overlay，不改 kp-matrix.json',
  builtFrom: {
    errorTypes: 'shared/learner/error-model.js ERROR_TYPES（8 类）',
    variants: 'shared/strategy/adaptive-strategy.js VARIANTS（6 变体）',
    kblFacts: 'kbl/teaching/kp-matrix.json（operations/semanticFamily/maxSteps/allowByQuestionType/grade）',
    axisEvidence: 'kbl/teaching/variation-profiles.json（P27-09 实测变式剖面）'
  },
  policy: {
    triggerPattern: '计划期可判定谓词：questionTypes ∈ canonical 7 类；operations ∈ {add,sub,mult,div} 标签（运行时匹配归一符号/标签两种形态）',
    axisEvidenceGate: 'response.axis 在该 KP 变式剖面无实测承载（evidenceRows=0）→ 不产出 slot'
  },
  counts: { kps: stats.kps, kpsWithSlots: stats.kpsWithSlots, slots: stats.slots, byErrorType: stats.byErrorType, droppedByAxisEvidence: stats.droppedByAxisEvidence },
  kps: kpsOut
};
fs.writeFileSync(path.join(__dirnameRoot, 'kbl', 'teaching', 'misconception-profiles.json'),
  JSON.stringify(out, null, 2) + '\n');

var outDir = path.join(__dirname, 'reports');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'misconception-derive-report.json'), JSON.stringify({
  schemaVersion: 'p27-misconception-derive.1',
  generatedAt: new Date().toISOString(),
  summary: stats,
  kps: kpsOut
}, null, 2) + '\n');

console.log('KP：' + stats.kps + '，有槽 KP：' + stats.kpsWithSlots + '，slot 总数：' + stats.slots);
console.log('按错因：' + JSON.stringify(stats.byErrorType));
console.log('响应轴无承载被裁掉：' + stats.droppedByAxisEvidence);
console.log('overlay：kbl/teaching/misconception-profiles.json');
