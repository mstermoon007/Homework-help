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
 *   R-REL-03: 跨册/跨年级概念主干链（整数认识/加减/乘除/分数/小数/图形/测量/线角/数系/运动），
 *             链内严格年级递增，无环；每阶段锚定该册对应概念单元的首个 KP
 *
 * P40 战役二（T-02/T-04）：R-REL-03 概念链由「族表」声明化；族定义三规则 + 四类演化 op；
 *   38 条概念链边追加 evolution{familyId,fromStageOrder,toStageOrder,op}（链内同族 stageOrder 严格递增、
 *   年级不倒置、跨族前置无环）。capability 侧 familyId/stageOrder 回填由 derive-kbl.js 复用本文件导出的
 *   classifyFamily()/computeStageOrders()（单一 SSOT，树内同文件，无第二知识系统）。
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

// ============================================================================
// 概念族表（P40 战役二 SSOT）— 稳定族 ID → 唯一显示名（同名多族/同族多名一律拒绝）
// ============================================================================
// 每一主线族给出有序阶段表（grade/book/unitName 片段）；阶段表同时是 R-REL-03 概念链锚点。
// ops: 相邻阶段之间的演化 op，长度 = stages-1，取值 extend_number|increase_complexity|abstract_up|inverse。
var CONCEPT_FAMILIES = [
  { familyId: 'fam_integer', name: '整数认识', ops: ['extend_number', 'extend_number', 'extend_number'],
    stages: [['g1', 'up', '11～20的认识'], ['g1', 'down', '100以内数的认识'], ['g2', 'down', '万以内数的认识'], ['g4', 'up', '万以上数的认识']] },
  { familyId: 'fam_addsub', name: '加减运算', ops: ['inverse', 'increase_complexity', 'increase_complexity', 'extend_number'],
    stages: [['g1', 'up', '20以内的进位加法'], ['g1', 'down', '20以内的退位减法'], ['g1', 'down', '100以内的口算加、减法'], ['g1', 'down', '100以内的笔算加、减法'], ['g2', 'down', '万以内的加法和减法']] },
  { familyId: 'fam_multiply', name: '乘法', ops: ['extend_number', 'increase_complexity', 'increase_complexity'],
    stages: [['g2', 'up', '1～6的表内乘法'], ['g2', 'up', '7～9的表内乘、除法'], ['g3', 'up', '多位数乘一位数'], ['g4', 'up', '多位数乘两位数']] },
  { familyId: 'fam_divide', name: '除法', ops: ['extend_number', 'increase_complexity', 'increase_complexity'],
    stages: [['g2', 'up', '1～6的表内除法'], ['g2', 'up', '7～9的表内乘、除法'], ['g2', 'down', '有余数的除法'], ['g3', 'down', '除数是一位数的除法']] },
  { familyId: 'fam_fraction', name: '分数', ops: ['abstract_up', 'increase_complexity', 'increase_complexity', 'increase_complexity'],
    stages: [['g3', 'up', '分数的初步认识'], ['g5', 'down', '分数的意义和性质'], ['g5', 'down', '分数的加法和减法'], ['g6', 'up', '分数乘法'], ['g6', 'up', '分数除法']] },
  { familyId: 'fam_decimal', name: '小数', ops: ['abstract_up', 'increase_complexity', 'increase_complexity', 'increase_complexity'],
    stages: [['g3', 'down', '小数的初步认识'], ['g4', 'down', '小数的意义和性质'], ['g4', 'down', '小数的加法和减法'], ['g5', 'up', '小数乘法'], ['g5', 'up', '小数除法']] },
  { familyId: 'fam_shape', name: '图形认识', ops: ['abstract_up', 'increase_complexity', 'increase_complexity', 'increase_complexity', 'increase_complexity', 'increase_complexity', 'increase_complexity'],
    stages: [['g1', 'up', '认识立体图形'], ['g1', 'down', '认识平面图形'], ['g3', 'down', '长方形和正方形'], ['g4', 'up', '平行四边形和梯形'], ['g4', 'down', '三角形'], ['g5', 'down', '长方体和正方体'], ['g6', 'up', '圆'], ['g6', 'down', '圆柱与圆锥']] },
  { familyId: 'fam_measure', name: '测量', ops: ['extend_number', 'increase_complexity', 'increase_complexity'],
    stages: [['g2', 'up', '厘米和米'], ['g3', 'up', '毫米、分米和千米'], ['g3', 'down', '图形的面积'], ['g5', 'up', '多边形的面积']] },
  { familyId: 'fam_line_angle', name: '线与角', ops: ['increase_complexity'],
    stages: [['g3', 'up', '线和角'], ['g4', 'up', '角的度量']] },
  { familyId: 'fam_number_algebra', name: '数系与代数', ops: ['increase_complexity', 'abstract_up', 'increase_complexity'],
    stages: [['g5', 'up', '用字母表示数和数量关系'], ['g5', 'down', '因数与倍数'], ['g6', 'up', '百分数'], ['g6', 'down', '比例']] },
  { familyId: 'fam_motion', name: '图形运动', ops: ['abstract_up', 'increase_complexity', 'increase_complexity'],
    stages: [['g3', 'down', '生活中的运动现象'], ['g4', 'down', '图形的运动（二）'], ['g5', 'up', '图形的运动'], ['g5', 'down', '图形的运动（三）']] }
];

// 非主干线的概念族（仅 regex 归类，无跨册概念链）：familyId → 唯一显示名。
var EXTRA_FAMILIES = {
  fam_percent: '百分数', fam_ratio: '比例', fam_factor_multiple: '因数与倍数', fam_negative: '负数',
  fam_time: '时间', fam_money: '人民币', fam_direction: '方向与位置', fam_statistics: '统计',
  fam_probability: '可能性', fam_observation: '观察物体', fam_operation_law: '运算律',
  fam_relation: '数量关系', fam_problem_solving: '数学广角', fam_review: '复习与关联'
};

// 归类规则：按优先级自上而下首条命中（输入 = 单元名 + ' ' + 知识点名）。
var FAMILY_RULES = [
  ['fam_fraction', /分数/],
  ['fam_decimal', /小数/],
  ['fam_percent', /百分数|折扣|成数|税率|利率/],
  ['fam_ratio', /比例/],
  ['fam_negative', /负数/],
  ['fam_factor_multiple', /因数与倍数|质数|合数|奇数|偶数|公因数|公倍数/],
  ['fam_relation', /用字母表示数|方程|数量间的加减关系|数量间的乘除关系|加法模型|乘法模型|探索规律/],
  ['fam_divide', /除法|除以|余数/],
  ['fam_multiply', /乘法|表内乘|倍/],
  ['fam_addsub', /加法|减法|加减/],
  ['fam_operation_law', /混合运算|四则运算|运算律/],
  ['fam_time', /时间|年、月、日|时分秒|年月日/],
  ['fam_money', /购物|人民币|元角分|货币/],
  ['fam_direction', /方向|位置|数对/],
  ['fam_statistics', /统计|条形|折线|平均数|数据的收集|分类与整理/],
  ['fam_probability', /可能性/],
  ['fam_observation', /观察物体|观察组合体|观察简单组合体|观察/],
  ['fam_motion', /图形的运动|运动现象|平移|旋转|对称/],
  ['fam_line_angle', /线和角|角的度量/],
  ['fam_measure', /面积|周长|厘米|米|千米|分米|毫米|质量|千克|克|吨/],
  ['fam_shape', /图形|三角形|长方形|正方形|平行四边形|梯形|圆|长方体|正方体|圆柱|圆锥|角/],
  ['fam_problem_solving', /数学广角|鸡兔同笼|找次品|鸽巢|植树/],
  ['fam_integer', /数的认识|数的读写|数位|计数单位|大数|亿|万/],
  ['fam_review', /复习与关联|整理和复习/]
];

var BOOK_RANK = { up: 0, down: 1 };
function gradeNum(g) { return parseInt(String(g).replace(/[^0-9]/g, ''), 10) || 0; }
function kn(kp) { return parseFloat(kp.knowledgeNo); }
function isExcluded(unitName) {
  if (!unitName) return false;
  return /复习与关联|综合实践|整理和复习/.test(unitName);
}

function familyName(familyId) {
  for (var i = 0; i < CONCEPT_FAMILIES.length; i++) if (CONCEPT_FAMILIES[i].familyId === familyId) return CONCEPT_FAMILIES[i].name;
  return EXTRA_FAMILIES[familyId] || familyId;
}

// 单元 → 主干族集合（某单元可被多条概念链共享，如「7～9的表内乘、除法」同属乘法/除法）。
function chainFamiliesForUnit(grade, book, unitName) {
  var ids = [];
  CONCEPT_FAMILIES.forEach(function (fam) {
    var hit = fam.stages.some(function (s) { return s[0] === grade && s[1] === book && (unitName || '').indexOf(s[2]) !== -1; });
    if (hit) ids.push(fam.familyId);
  });
  return ids;
}

function regexFamily(kp) {
  var text = ((kp.unit && kp.unit.unitName) || '') + ' ' + (kp.name || '');
  for (var i = 0; i < FAMILY_RULES.length; i++) if (FAMILY_RULES[i][1].test(text)) return FAMILY_RULES[i][0];
  var domain = kp.domain || '';
  if (/geometry/.test(domain)) return 'fam_shape';
  if (/statistics|probability/.test(domain)) return 'fam_statistics';
  if (/practice/.test(domain)) return 'fam_problem_solving';
  return 'fam_integer';
}

// 节点所属族集合：主干单元按其概念链族（可多族）；其余按 regex 归类。
function familyMembership(kp) {
  var cs = chainFamiliesForUnit(kp.grade, kp.book, (kp.unit && kp.unit.unitName) || '');
  return cs.length ? cs : [regexFamily(kp)];
}
function classifyFamily(kp) { return familyMembership(kp)[0]; }

// 族内 stageOrder：族成员按 (grade, up<down, unitOrdinal, knowledgeNo) 全序排序，分配 1..n（无并列）。
function computeStageOrders(knowledge) {
  var groups = {};
  knowledge.forEach(function (kp) {
    familyMembership(kp).forEach(function (f) { (groups[f] = groups[f] || []).push(kp); });
  });
  var byId = {};
  Object.keys(groups).forEach(function (f) {
    var arr = groups[f].slice().sort(function (a, b) {
      var ga = gradeNum(a.grade), gb = gradeNum(b.grade);
      if (ga !== gb) return ga - gb;
      var ba = BOOK_RANK[a.book] != null ? BOOK_RANK[a.book] : 2, bb = BOOK_RANK[b.book] != null ? BOOK_RANK[b.book] : 2;
      if (ba !== bb) return ba - bb;
      var ua = (a.unit && a.unit.unitOrdinal) || 0, ub = (b.unit && b.unit.unitOrdinal) || 0;
      if (ua !== ub) return ua - ub;
      return kn(a) - kn(b);
    });
    arr.forEach(function (kp, i) { byId[kp.id] = { familyId: f, stageOrder: i + 1 }; });
  });
  return byId;
}

// 族定义三规则 + 语义合法性校验（同名多族/同族多名/阶段数不符/op 非法一律抛错）。
function validateFamilyTable() {
  var names = {}, ids = {};
  CONCEPT_FAMILIES.concat(Object.keys(EXTRA_FAMILIES).map(function (id) { return { familyId: id, name: EXTRA_FAMILIES[id] }; }))
    .forEach(function (f) {
      if (ids[f.familyId]) throw new Error('族表非法：重复 familyId ' + f.familyId);
      if (names[f.name]) throw new Error('族表非法：同名多族 ' + f.name);
      ids[f.familyId] = true; names[f.name] = true;
    });
  var OPS = { extend_number: 1, increase_complexity: 1, abstract_up: 1, inverse: 1 };
  CONCEPT_FAMILIES.forEach(function (f) {
    if (!Array.isArray(f.stages) || !Array.isArray(f.ops)) throw new Error('族表非法：' + f.familyId + ' 缺 stages/ops');
    if (f.ops.length !== f.stages.length - 1) throw new Error('族表非法：' + f.familyId + ' ops/stages 长度不符');
    f.ops.forEach(function (op) { if (!OPS[op]) throw new Error('族表非法：' + f.familyId + ' 非法 op ' + op); });
  });
}

// ============================================================================
// 主流程
// ============================================================================
function main() {
  var knowledge = JSON.parse(fs.readFileSync(KNOW, 'utf8')).knowledge;
  validateFamilyTable();

  var relations = [];
  var seen = new Set();
  function addEdge(fromKp, toKp, rule, evolution) {
    if (!fromKp || !toKp || fromKp.id === toKp.id) return;
    var key = fromKp.id + '|prerequisite|' + toKp.id;
    if (seen.has(key)) return;
    seen.add(key);
    var edge = {
      fromId: fromKp.id,
      toId: toKp.id,
      relation: 'prerequisite',
      inferred: true,
      reviewStatus: REVIEW,
      rule: rule
    };
    if (evolution) edge.evolution = evolution;
    relations.push(edge);
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

  // ---------- R-REL-03: 概念主干链 + evolution ----------
  var stageOrders = computeStageOrders(knowledge);
  function stageKp(grade, book, unitFrag) {
    var hits = knowledge.filter(function (k) {
      return k.grade === grade && k.book === book && (k.unit.unitName || '').indexOf(unitFrag) !== -1;
    });
    if (!hits.length) return null;
    return hits.sort(function (a, b) { return kn(a) - kn(b); })[0];
  }

  var r03 = 0;
  CONCEPT_FAMILIES.forEach(function (fam) {
    var stages = fam.stages.map(function (s) { return stageKp(s[0], s[1], s[2]); });
    for (var i = 1; i < stages.length; i++) {
      if (!stages[i - 1] || !stages[i]) continue;
      var from = stages[i - 1], to = stages[i];
      var evolution = {
        familyId: fam.familyId,
        fromStageOrder: stageOrders[from.id] ? stageOrders[from.id].stageOrder : i,
        toStageOrder: stageOrders[to.id] ? stageOrders[to.id].stageOrder : i + 1,
        op: fam.ops[i - 1]
      };
      addEdge(from, to, 'R-REL-03:概念主干链(' + fam.name + ')', evolution);
      r03++;
    }
  });

  // ---------- 内联校验（T-04）----------
  validateEvolution(relations, knowledge, stageOrders);

  // ---------- 跨族前置派生投影 + 校验报告（T-06；纯校验不落盘）----------
  reportCrossFamily(relations, knowledge);

  // ---------- 写盘 ----------
  var out = {
    schemaVersion: '1.0.0',
    source: 'llm-derived-dev（开发期 LLM 统筹定案；上线零 LLM 依赖）',
    reviewStatus: REVIEW,
    note: '前置关系由 LLM 在开发期基于源 Excel 教学语义统筹推断并直接定案（R-REL-01 同单元序号 + R-REL-02 同册跨单元 + R-REL-03 概念主干链/族表声明化）。inferred=true 为溯源标记；reviewStatus=llm-finalized-dev 表示无人工确认环节、LLM 即最终确认者（用户 2026-09-30 显式指令）。三元组全局去重，链内年级严格递增收敛无环。P40 战役二起 R-REL-03 边携带 evolution{familyId,fromStageOrder,toStageOrder,op}。',
    inferredCount: relations.length,
    conceptFamilies: CONCEPT_FAMILIES.map(function (f) { return { familyId: f.familyId, name: f.name, stages: f.stages.map(function (s) { return s.join('/'); }), ops: f.ops }; }),
    relations: relations
  };

  fs.writeFileSync(REL_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

  var r01 = relations.filter(function (r) { return r.rule.indexOf('R-REL-01') !== -1; }).length;
  var r02 = relations.filter(function (r) { return r.rule.indexOf('R-REL-02') !== -1; }).length;
  console.log('[KBL-REL-DERIVE] OK  relations:', relations.length, '(R-REL-01:', r01, 'R-REL-02:', r02, 'R-REL-03:', r03, ')  families:', CONCEPT_FAMILIES.length);
}

// 链内同族 stageOrder 严格递增；年级不倒置；跨族前置无环（Kahn 拓扑）。
function validateEvolution(relations, knowledge, stageOrders) {
  var byId = {}; knowledge.forEach(function (k) { byId[k.id] = k; });
  relations.forEach(function (r) {
    if (!r.evolution) return;
    var e = r.evolution;
    if (!(e.toStageOrder > e.fromStageOrder)) throw new Error('evolution 非法：stageOrder 未严格递增 ' + r.fromId + '->' + r.toId);
    var gf = gradeNum(byId[r.fromId].grade), gt = gradeNum(byId[r.toId].grade);
    if (gt < gf) throw new Error('evolution 非法：年级倒置 ' + r.fromId + '->' + r.toId);
  });
  // 跨族前置无环：以 fromId->toId 建图做 Kahn。
  var adj = {}, indeg = {}, nodes = {};
  relations.forEach(function (r) {
    if (!r.evolution) return;
    nodes[r.fromId] = 1; nodes[r.toId] = 1;
    (adj[r.fromId] = adj[r.fromId] || []).push(r.toId);
    indeg[r.toId] = (indeg[r.toId] || 0) + 1;
    if (indeg[r.fromId] == null) indeg[r.fromId] = 0;
  });
  var queue = Object.keys(nodes).filter(function (n) { return !indeg[n]; });
  var visited = 0;
  while (queue.length) {
    var n = queue.shift(); visited++;
    (adj[n] || []).forEach(function (m) { if (--indeg[m] === 0) queue.push(m); });
  }
  if (visited !== Object.keys(nodes).length) throw new Error('evolution 非法：跨族前置存在环');
}

// P40 T-06：跨族前置派生投影（source.familyId≠target.familyId）——族间图 + 无环/年级倒挂校验报告。
// 规则矩阵字段裁决：prereqFamily[] 不落盘，仅运行时聚合投影；违规登记 needs-review（不自动改数）。
function reportCrossFamily(relations, knowledge) {
  var byId = {}; knowledge.forEach(function (k) { byId[k.id] = k; });
  var famOf = function (id) { return classifyFamily(byId[id]); };
  var cross = 0, intra = 0, familyEdges = {};
  var inversions = [];
  relations.forEach(function (r) {
    var fa = famOf(r.fromId), fb = famOf(r.toId);
    if (fa === fb) { intra++; return; }
    cross++;
    var k = fa + '->' + fb;
    familyEdges[k] = (familyEdges[k] || 0) + 1;
    if (gradeNum(byId[r.toId].grade) < gradeNum(byId[r.fromId].grade)) inversions.push(r.fromId + '->' + r.toId);
  });
  // 族间无环（Kahn）
  var adj = {}, indeg = {}, nodes = {};
  Object.keys(familyEdges).forEach(function (e) {
    var p = e.split('->'); nodes[p[0]] = 1; nodes[p[1]] = 1;
    (adj[p[0]] = adj[p[0]] || []).push(p[1]); indeg[p[1]] = (indeg[p[1]] || 0) + 1;
    if (indeg[p[0]] == null) indeg[p[0]] = 0;
  });
  var queue = Object.keys(nodes).filter(function (n) { return !indeg[n]; }), visited = 0;
  while (queue.length) { var n = queue.shift(); visited++; (adj[n] || []).forEach(function (m) { if (--indeg[m] === 0) queue.push(m); }); }
  var acyclic = visited === Object.keys(nodes).length;
  var suffix = acyclic ? '✅ 无环' : '⚠ needs-review（存在族间环）';
  console.log('[KBL-REL-T06] 跨族前置投影：族内 ' + intra + ' / 跨族 ' + cross + ' 条；族间边 ' + Object.keys(familyEdges).length +
    ' 条；' + suffix + '；年级倒挂 ' + inversions.length + ' 条' + (inversions.length ? '（needs-review: ' + inversions.slice(0, 3).join(', ') + '…）' : ''));
  return { intra: intra, cross: cross, familyEdges: familyEdges, acyclic: acyclic, inversions: inversions };
}

module.exports = {
  CONCEPT_FAMILIES: CONCEPT_FAMILIES,
  EXTRA_FAMILIES: EXTRA_FAMILIES,
  familyName: familyName,
  classifyFamily: classifyFamily,
  familyMembership: familyMembership,
  computeStageOrders: computeStageOrders,
  validateFamilyTable: validateFamilyTable,
  validateEvolution: validateEvolution,
  reportCrossFamily: reportCrossFamily
};

if (require.main === module) main();
