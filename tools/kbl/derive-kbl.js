/**
 * KBL Deriver（P16-02 起：Canonical 五类数据的唯一程序化派生入口）
 *
 * 派生来源：仅 root Excel 抽取结果（kbl/import/extract-raw.json）。不读取 Root Excel，不产生第二人工知识源。
 * 输出：
 *   kbl/canonical/course.json      —— 册（grade × book）视图，来自 raw.course 投影
 *   kbl/canonical/knowledge.json   —— 375 知识点的 canonical 视图（id/unit/name/domain/… 规范化）
 *   kbl/canonical/relations.json   —— 关系集（root 无关系字段 → 空集，保持真实，不猜测）
 *   kbl/canonical/capability.json  —— 每 KP 能力视图（numberRange/cognitiveLevel/seedDifficulty/maxSteps/allowedTypes/capacity）
 *   kbl/canonical/mappings.json    —— 每 KP × allowedType 生成映射（capability=canonical 题型词表；pluginId 校验自生成器注册表）
 *
 * 可审计性：capability/mappings 每个派生值记录 derivation.rule（命中规则编号）与 evidence（命中关键词），非黑盒。
 * 确定性（P28-05）：canonical 数据禁止 generatedAt / random ID / random ordering / 环境相关路径；
 *   同一 extract-raw（同一 Excel）重复派生，输出 byte 级一致（SHA256 完全一致）。
 * 约束：不写回 Excel；不改变 canonical 数据结构与 ID 规则；不新增旧 ID 兼容；permission 仅 allow/missing；relations 空缺保持空集。
 */
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..', '..');
var RAW = path.join(ROOT, 'kbl', 'import', 'extract-raw.json');
var COURSE_OUT = path.join(ROOT, 'kbl', 'canonical', 'course.json');
var KNOW_OUT = path.join(ROOT, 'kbl', 'canonical', 'knowledge.json');
var REL_OUT = path.join(ROOT, 'kbl', 'canonical', 'relations.json');
var CAP_OUT = path.join(ROOT, 'kbl', 'canonical', 'capability.json');
var MAP_OUT = path.join(ROOT, 'kbl', 'canonical', 'mappings.json');

// ---------- 题型 domain 基准（rule R01） ----------
var DOMAIN_TYPES = {
  algebra: ['calc', 'fill', 'apply', 'choice'],
  geometry: ['geometry', 'fill', 'apply', 'judge', 'choice'],
  statistics: ['fill', 'choice', 'apply', 'classify', 'judge'],
  practice: ['apply', 'fill', 'choice']
};
var GRADE_DIFF_BASE = { g1: 2, g2: 3, g3: 4, g4: 5, g5: 6, g6: 7 };
var GRADE_STEPS_BASE = { g1: 1, g2: 1, g3: 2, g4: 2, g5: 3, g6: 3 };
var TYPE_CAPACITY = { calc: 20, apply: 20, fill: 14, choice: 12, judge: 12, geometry: 10, classify: 6 };

// ---------- 释义文本规则（R 系列；evidence 取自命中片段） ----------
function ranges(s) {
  // 返回 { descriptor, maxVal, evidence }
  var ev = [];
  var max = 0;
  ['亿以内', '万以内', '千以内'].forEach(function (w) {
    if (s.indexOf(w) !== -1) { max = Math.max(max, w === '亿以内' ? 9 : w === '万以内' ? 5 : 4); ev.push(w); }
  });
  var m;
  m = /(\d+)[～~\-至](\d+)/.exec(s);
  if (m) { max = Math.max(max, Number(m[2])); ev.push(m[0]); }
  m = /(\d+)以内/.exec(s);
  if (m) { max = Math.max(max, Number(m[1])); ev.push(m[0]); }
  m = /两位/.test(s) ? [2] : null; if (m) { max = Math.max(max, 100); ev.push('两位数'); }
  if (/三位/.test(s)) { max = Math.max(max, 1000); ev.push('三位数'); }
  if (/一位/.test(s)) { max = Math.max(max, 10); ev.push('一位数'); }
  if (/整数/.test(s) || /自然数/.test(s) || /数/ .test(s)) { max = Math.max(max, 100); ev.push('整数域'); }
  var descriptor = max >= 8 ? '亿级' : max >= 6 ? '百万级' : max >= 5 ? '万级' : max >= 4 ? '千级' : max >= 3 ? '百级' : max >= 2 ? '十级' : '二十以内';
  return { max: max, evidence: ev };
}

function detectFamilies(s) {
  var families = [];
  [['fraction', '分数'], ['decimal', '小数'], ['percent', '百分'], ['negative', '负'], ['equation', '方程'], ['ratio', '比'], ['proportion', '比例'], ['time', '钟|时分秒'], ['money', '币|元角分|钱'], ['measure', '长度|米|厘米|千克|克|面积|体积'], ['direction', '方向|位置|上下左右'], ['graph', '图形|角|对称|圆|三角形|长方形|正方形|梯形|平行四边形|周长|面积|体积|数对']].forEach(function (x) {
    if (new RegExp(x[1]).test(s)) { families.push(x[0]); }
  });
  return families;
}

function detectOps(s) {
  var ops = [];
  [['addition', '加'], ['subtraction', '减'], ['multiplication', '乘|倍'], ['division', '除|平均'], ['mixed', '混合|综合'], ['sequential', '连加|连减|连乘']].forEach(function (x) {
    if (new RegExp(x[1]).test(s)) { ops.push(x[0]); }
  });
  return ops;
}

function detectWordProblem(s) {
  return /解决|应用|购物|行程|工程|植树|实际|问题|情境|正文|故事/.test(s) ? true : false;
}

function detectSteps(s) {
  var steps = 0;
  if (/三步|两步|两步以上|多步/.test(s)) steps = 2;
  else if (/两步/.test(s)) steps = 1; // 与上合并兜底，保留规则痕
  if (/两步/.test(s) && /多步/.test(s)) steps = 2;
  return steps;
}

// ---------- Deriver ----------

function derive() {
  var raw = JSON.parse(fs.readFileSync(RAW, 'utf8'));
  var kps = raw.knowledge;
  var srcFile = (raw.source && raw.source.file) || 'kbl/root/小学G1-G6数学知识点.xlsx';
  var canonSchema = '1.0.0';

  // ---------- 1. course（册视图；raw.course 投影，结构与 schema 固定） ----------
  var course = (raw.course || []).slice();

  // ---------- 2. knowledge（canonical 视图；从 raw.knowledge 规范化映射） ----------
  var knowledge = kps.map(function (k) {
    return {
      id: k.canonicalId,
      unitId: k.unitId,
      name: k.knowledgeName,
      grade: k.grade,
      book: k.book,
      unit: { unitNoRaw: k.unitNoRaw, unitName: k.unitName, unitOrdinal: k.unitOrdinal },
      domain: k.domainNorm,
      definition: k.definition,
      edition: k.edition,
      status: k.status,
      knowledgeNo: k.knowledgeNo,
      metadata: { source: { sheet: 0, row: k.sourceRow } }
    };
  });

  // ---------- 3. relations（root 无关系字段 → 空集；保持真实，禁止猜测） ----------
  var relations = [];

  // ---------- 4. capability / mappings（既有派生逻辑） ----------
  var capability = kps.map(function (k) {
    var s = (k.knowledgeName || '') + ' ' + (k.definition || '');
    var rng = ranges(s);
    var fam = detectFamilies(s);
    var ops = detectOps(s);
    var word = detectWordProblem(s);
    var stepsBoost = detectSteps(s);
    var grade = k.grade;
    var baseDiff = GRADE_DIFF_BASE[grade] || 4;
    var diff = baseDiff;
    var ev = [];
    // 数域修改难度
    if (rng.max >= 8) { diff += 2; ev.push('R02:数域=' + rng.evidence[0]); }
    else if (rng.max >= 5) { diff += 1; ev.push('R02:数域=' + rng.evidence[0]); }
    else if (rng.max >= 3) ev.push('R02:数域=' + (rng.evidence[0] || '百级'));
    // 运算步数
    if (stepsBoost > 0) { diff += stepsBoost; ev.push('R03:多步'); }
    // 综合/问题场景
    if (word) { diff += 1; ev.push('R04:问题情境'); }
    if (fam.indexOf('fraction') !== -1 || fam.indexOf('decimal') !== -1 || fam.indexOf('percent') !== -1 || fam.indexOf('equation') !== -1 || fam.indexOf('proportion') !== -1) { diff += 1; ev.push('R05:高阶数系'); }
    diff = Math.max(1, Math.min(10, diff));

    // 认知水平
    var cog = 'apply';
    if (/初步认识|认识|记忆|读写/.test(s)) { cog = 'recognize'; ev.push('R06:初始认识'); }
    else if (/理解|意义|含义/.test(s)) { cog = 'understand'; ev.push('R07:理解'); }
    else if (/解决|综合|灵活/.test(s)) { cog = 'analyze'; ev.push('R08:综合应用'); }
    else if (/计算|运算/.test(s)) { cog = 'understand'; ev.push('R09:运算'); }

    // 步数（排除纯认知）
    var steps = GRADE_STEPS_BASE[grade] || 1;
    steps += stepsBoost;
    if (word) steps += 1;
    steps = Math.max(1, Math.min(6, steps));
    ev.push('R10:步数=' + steps);

    // allowedTypes
    var types = (DOMAIN_TYPES[k.domainNorm] || ['calc', 'fill', 'apply']).slice();
    if (fam.indexOf('graph') !== -1 && k.domainNorm === 'algebra') types.push('geometry'); // 数对/图形与代数交叉
    types = types.filter(function (t, i) { return types.indexOf(t) === i; });
    var allowedTypes = types.filter(function (t) { return TYPE_CAPACITY[t] !== undefined; });
    var capacitySum = allowedTypes.reduce(function (n, t) { return n + TYPE_CAPACITY[t]; }, 0);

    return {
      knowledgeId: k.canonicalId,
      grade: k.grade,
      book: k.book,
      unitId: k.unitId,
      knowledgeName: k.knowledgeName,
      domain: k.domainNorm,
      numberRange: rng.max > 0 ? { descriptor: rng.descriptor, max: rng.max } : null,
      operations: ops,
      families: fam,
      cognitiveLevel: cog,
      seedDifficulty: diff,
      maxSteps: steps,
      allowedTypes: allowedTypes,
      capacity: capacitySum,
      derivation: { rules: ev, evidence: (rng.evidence.concat(fam, ops).slice(0, 8)) }
    };
  });

  // 生成器注册表（运行时真实能力词表）用于映射 pluginId 校验
  var genList = [];
  try {
    var Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
    var G = global.GeneratorRegistry;
    genList = (G && typeof G.all === 'function' ? G.all() : []).filter(function (x) { return x && x.id; });
  } catch (e) { genList = []; }
  var genIds = genList.map(function (x) { return x.id; });

  // 按题型找注册生成器（capabilities 含该题型）
  function pickPlugin(t) {
    for (var i = 0; i < genList.length; i++) {
      var g = genList[i];
      var caps = g.capabilities || g.questionTypes || [];
      if (caps.indexOf(t) !== -1) return g.id;
    }
    return null;
  }

  var mappings = [];
  capability.forEach(function (c) {
    c.allowedTypes.forEach(function (t) {
      var pluginId = pickPlugin(t);
      mappings.push({
        knowledgeId: c.knowledgeId,
        questionType: t,
        capability: t, // canonical 词表
        permission: pluginId ? 'allow' : 'missing',
        pluginId: pluginId,
        coefficient: 1.0,
        source: 'kbl-derived',
        derivation: c.derivation.rules.join(';')
      });
    });
  });

  fs.mkdirSync(path.dirname(CAP_OUT), { recursive: true });
  fs.writeFileSync(COURSE_OUT, JSON.stringify({ schemaVersion: canonSchema, source: srcFile, course: course }, null, 2));
  fs.writeFileSync(KNOW_OUT, JSON.stringify({ schemaVersion: canonSchema, source: srcFile, count: knowledge.length, knowledge: knowledge }, null, 2));
  fs.writeFileSync(REL_OUT, JSON.stringify({ schemaVersion: canonSchema, source: srcFile, note: 'SRC 无关系字段；旧关系 1287 行已按裁决清除。关系集为空，待人工源补充或后续从释义派生。', count: relations.length, relations: relations }, null, 2));
  fs.writeFileSync(CAP_OUT, JSON.stringify({ schemaVersion: '1.0.0', source: 'root extract + 释义规则派生', count: capability.length, capability: capability }, null, 2));
  fs.writeFileSync(MAP_OUT, JSON.stringify({ schemaVersion: '1.0.0', source: 'kbl-derived', subject: 'math', count: mappings.length, mappings: mappings }, null, 2));

  return { course: course.length, knowledge: knowledge.length, relations: relations.length, capability: capability.length, mappings: mappings.length, generatorCount: genIds.length, diffSpread: {}, typeSpread: {}, permission: {} };
}

var r = derive();
console.log('[KBL-DERIVE] OK  course:', r.course, 'knowledge:', r.knowledge, 'relations:', r.relations, 'capability:', r.capability, 'mappings:', r.mappings, ' (generators:', r.generatorCount + ')');
var cap = require(path.join(ROOT, 'kbl', 'canonical', 'capability.json'));
var grd = {}; cap.capability.forEach(function (c) { grd[c.seedDifficulty] = (grd[c.seedDifficulty] || 0) + 1; });
console.log('seedDifficulty 分布:', JSON.stringify(grd));
var tp = {}; cap.capability.forEach(function (c) { c.allowedTypes.forEach(function (t) { tp[t] = (tp[t] || 0) + 1; }); });
console.log('allowedTypes 分布:', JSON.stringify(tp));
var mp = require(path.join(ROOT, 'kbl', 'canonical', 'mappings.json'));
var pm = {}; mp.mappings.forEach(function (m) { pm[m.permission] = (pm[m.permission] || 0) + 1; });
console.log('mapping permission:', JSON.stringify(pm));