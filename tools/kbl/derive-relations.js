#!/usr/bin/env node
/**
 * tools/kbl/derive-relations.js — KBL 前置关系派生（LLM 开发期统筹定案）
 *
 * 治理状态（用户 2026-09-30 显式指令）：
 *   不设单独人工确认环节；全部关系由 LLM 在开发期基于源 Excel 教学语义统筹推断并直接定案；
 *   上线零 LLM 依赖（产物为静态 JSON）。inferred:true 保留作溯源；reviewStatus='llm-finalized-dev'
 *   表示 LLM 即开发期最终确认者；不再有 pending/human 环节。
 *
 * 派生依据（教学语义规则，可重跑可审计）：
 *   R-REL-01: 同 grade+book+unit 内按 knowledgeNo 教学顺序连边（认识→读写→比较→计算→应用）
 *   R-REL-02: 同 grade+book 跨 unit 按 unitOrdinal 递进（排除复习与关联/综合实践单元）
 *   R-REL-03: LLM 跨册/跨年级概念主干链（整数认识/加减/乘除/分数/小数/图形/测量/线角/数系/运动），
 *             链内严格年级递增，无环；每阶段锚定该册对应概念单元的首个 KP
 *
 * 输出：kbl/canonical/relations.json（覆盖式重生；三元组 fromId|relation|toId 全局去重）
 *
 * 用法：node tools/kbl/derive-relations.js（须在 derive-kbl.js 之后运行）
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var KNOW = path.join(ROOT, 'kbl', 'canonical', 'knowledge.json');
var REL_OUT = path.join(ROOT, 'kbl', 'canonical', 'relations.json');

var REVIEW = 'llm-finalized-dev';
var knowledge = JSON.parse(fs.readFileSync(KNOW, 'utf8')).knowledge;

function isExcluded(unitName) {
  if (!unitName) return false;
  return /复习与关联|综合实践|整理和复习/.test(unitName);
}
function kn(kp) { return parseFloat(kp.knowledgeNo); }

var relations = [];
var seen = new Set();
function addEdge(fromKp, toKp, rule) {
  if (!fromKp || !toKp || fromKp.id === toKp.id) return;
  var key = fromKp.id + '|prerequisite|' + toKp.id;
  if (seen.has(key)) return;
  seen.add(key);
  relations.push({
    fromId: fromKp.id,
    toId: toKp.id,
    relation: 'prerequisite',
    inferred: true,
    reviewStatus: REVIEW,
    rule: rule
  });
}

// ---------- R-REL-01: 同 unit 内 knowledgeNo 顺序 ----------
var byUnit = {};
knowledge.forEach(function (k) {
  var key = k.grade + '-' + k.book + '-' + k.unitId;
  (byUnit[key] = byUnit[key] || []).push(k);
});
Object.keys(byUnit).forEach(function (key) {
  var kps = byUnit[key].sort(function (a, b) { return kn(a) - kn(b); });
  for (var i = 1; i < kps.length; i++) addEdge(kps[i - 1], kps[i], 'R-REL-01:同单元序号顺序');
});

// ---------- R-REL-02: 同 grade+book 跨 unit 递进 ----------
var byGradeBook = {};
knowledge.forEach(function (k) {
  var key = k.grade + '-' + k.book;
  (byGradeBook[key] = byGradeBook[key] || []).push(k);
});
Object.keys(byGradeBook).forEach(function (gb) {
  var units = {};
  byGradeBook[gb].forEach(function (k) {
    var ord = k.unit.unitOrdinal;
    if (!units[ord]) units[ord] = { ordinal: ord, name: k.unit.unitName, kps: [] };
    units[ord].kps.push(k);
  });
  var ords = Object.keys(units).map(Number).sort(function (a, b) { return a - b; });
  for (var i = 1; i < ords.length; i++) {
    var prev = units[ords[i - 1]];
    var curr = units[ords[i]];
    if (isExcluded(prev.name) || isExcluded(curr.name)) continue;
    var prevKps = prev.kps.sort(function (a, b) { return kn(a) - kn(b); });
    var currKps = curr.kps.sort(function (a, b) { return kn(a) - kn(b); });
    addEdge(prevKps[prevKps.length - 1], currKps[0], 'R-REL-02:同册跨单元递进');
  }
});

// ---------- R-REL-03: LLM 跨册/跨年级概念主干链 ----------
// 每族为有序阶段 [grade, book, unitName 包含片段]；链内严格按列出顺序（年级递增），无环。
// 由 LLM 依人教版数学教学结构固化为锚点表；缺失阶段自动跳过该边（容错，不报错）。
var CONCEPT_CHAINS = [
  ['整数认识', [['g1', 'up', '11～20的认识'], ['g1', 'down', '100以内数的认识'], ['g2', 'down', '万以内数的认识'], ['g4', 'up', '万以上数的认识']]],
  ['加减运算', [['g1', 'up', '20以内的进位加法'], ['g1', 'down', '20以内的退位减法'], ['g1', 'down', '100以内的口算加、减法'], ['g1', 'down', '100以内的笔算加、减法'], ['g2', 'down', '万以内的加法和减法']]],
  ['乘法', [['g2', 'up', '1～6的表内乘法'], ['g2', 'up', '7～9的表内乘、除法'], ['g3', 'up', '多位数乘一位数'], ['g4', 'up', '多位数乘两位数']]],
  ['除法', [['g2', 'up', '1～6的表内除法'], ['g2', 'up', '7～9的表内乘、除法'], ['g2', 'down', '有余数的除法'], ['g3', 'down', '除数是一位数的除法']]],
  ['分数', [['g3', 'up', '分数的初步认识'], ['g5', 'down', '分数的意义和性质'], ['g5', 'down', '分数的加法和减法'], ['g6', 'up', '分数乘法'], ['g6', 'up', '分数除法']]],
  ['小数', [['g3', 'down', '小数的初步认识'], ['g4', 'down', '小数的意义和性质'], ['g4', 'down', '小数的加法和减法'], ['g5', 'up', '小数乘法'], ['g5', 'up', '小数除法']]],
  ['图形认识', [['g1', 'up', '认识立体图形'], ['g1', 'down', '认识平面图形'], ['g3', 'down', '长方形和正方形'], ['g4', 'up', '平行四边形和梯形'], ['g4', 'down', '三角形'], ['g5', 'down', '长方体和正方体'], ['g6', 'up', '圆'], ['g6', 'down', '圆柱与圆锥']]],
  ['测量', [['g2', 'up', '厘米和米'], ['g3', 'up', '毫米、分米和千米'], ['g3', 'down', '图形的面积'], ['g5', 'up', '多边形的面积']]],
  ['线与角', [['g3', 'up', '线和角'], ['g4', 'up', '角的度量']]],
  ['数系与代数', [['g5', 'up', '用字母表示数和数量关系'], ['g5', 'down', '因数与倍数'], ['g6', 'up', '百分数'], ['g6', 'down', '比例']]],
  ['图形运动', [['g3', 'down', '生活中的运动现象'], ['g4', 'down', '图形的运动（二）'], ['g5', 'up', '图形的运动'], ['g5', 'down', '图形的运动（三）']]]
];

function stageKp(grade, book, unitFrag) {
  var hits = knowledge.filter(function (k) {
    return k.grade === grade && k.book === book && (k.unit.unitName || '').indexOf(unitFrag) !== -1;
  });
  if (!hits.length) return null;
  return hits.sort(function (a, b) { return kn(a) - kn(b); })[0];
}

var r03 = 0;
CONCEPT_CHAINS.forEach(function (chain) {
  var stages = chain[1].map(function (s) { return stageKp(s[0], s[1], s[2]); });
  for (var i = 1; i < stages.length; i++) {
    if (stages[i - 1] && stages[i]) { addEdge(stages[i - 1], stages[i], 'R-REL-03:LLM概念链(' + chain[0] + ')'); r03++; }
  }
});

// ---------- 写盘 ----------
var out = {
  schemaVersion: '1.0.0',
  source: 'llm-derived-dev（开发期 LLM 统筹定案；上线零 LLM 依赖）',
  reviewStatus: REVIEW,
  note: '前置关系由 LLM 在开发期基于源 Excel 教学语义统筹推断并直接定案（R-REL-01 同单元序号 + R-REL-02 同册跨单元 + R-REL-03 跨册/跨年级概念主干链）。inferred=true 为溯源标记；reviewStatus=llm-finalized-dev 表示无人工确认环节、LLM 即最终确认者（用户 2026-09-30 显式指令）。三元组全局去重，链内年级严格递增收敛无环。',
  inferredCount: relations.length,
  relations: relations
};

fs.writeFileSync(REL_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

var r01 = relations.filter(function (r) { return r.rule.indexOf('R-REL-01') !== -1; }).length;
var r02 = relations.filter(function (r) { return r.rule.indexOf('R-REL-02') !== -1; }).length;
console.log('[KBL-REL-DERIVE] OK  relations:', relations.length, '(R-REL-01:', r01, 'R-REL-02:', r02, 'R-REL-03:', r03, ')');
