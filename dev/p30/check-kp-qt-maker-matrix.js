#!/usr/bin/env node
'use strict';
// dev/p30/check-kp-qt-maker-matrix.js — P30-GEN-05（P30-16）
//
// KP × QuestionType → Assessment Target → Generator Maker 最终矩阵
//
// 目的：物化并冻结 1570 行 ALLOW 的完整链路
//   KP（ALLOW）→ QT → Assessment Target（kbl/teaching/qt-intent.json：
//   intentStatus/focus）→ Generator Maker（实际选择器路由 + 产出题的 maker 签名），
// 并逐格判定题型分工级别：
//   target        —— 同 (KP, Generator) 内跨题型题面核心结构互异（不同 Assessment Target
//                    由不同 maker 承担，如倍的认识 calc=列式 / choice=算式辨析 / apply=情境）
//   format        —— 同 (KP, Generator) 内存在跨题型题面核心结构相同（仅 ____/选项/判断包装
//                    不同），即「7 题型 → 同核任务换壳」债务
//   target-frozen —— P28-HOLLOW-02 SHAPE_THEME 冻结裁决的 shape-recognition 主题行，
//                    经用户裁决的历史特化承载，P30 不翻案，不计入 format 债务
//
// 跨生成器的同 KP 行（如 calc@arithmetic / apply@application-word）天然承担不同
// Assessment Target，默认 target（不同 Generator 即不同 Maker 族）。
//
// 判定为纯机械证据（冻结 seed 下的题面核心骨架 3-gram 相似度 ≥0.85 判同核），
// 不引入新的教学语义数据。
//
// 产物：docs/archive/phases/p30/P30-KP-QT-MAKER-MATRIX.{json,md}
// 用法：node dev/p30/check-kp-qt-maker-matrix.js          只读复核（产物漂移 → FAIL）
//       node dev/p30/check-kp-qt-maker-matrix.js --write 重生成并冻结产物
//
// 注意：本门禁不阻断 format 债务存量（只读计数 + 冻结），债务只允许通过 maker 真分工
//       修复后随 --write 单调下降；不得通过降低分类阈值或白名单掩盖。

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

require(path.join(ROOT, 'dev', '_bundle-env.js'));
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

var MATRIX_FILE = path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json');
var INTENT_FILE = path.join(ROOT, 'kbl', 'teaching', 'qt-intent.json');
var SHAPE_SRC = path.join(ROOT, 'shared', 'generator', 'generators', 'shape.js');
var OUT_JSON = path.join(ROOT, 'docs', 'archive', 'phases', 'p30', 'P30-KP-QT-MAKER-MATRIX.json');
var OUT_MD = path.join(ROOT, 'docs', 'archive', 'phases', 'p30', 'P30-KP-QT-MAKER-MATRIX.md');

var FREEZE_SEED_VERSION = 'p28-v1';
var FREEZE_DIFFICULTY = 3;
var SAME_CORE_THRESHOLD = 0.85;
var WRITE = process.argv.indexOf('--write') !== -1;

function fail(msg) { console.error('INVARIANT FAIL: ' + msg); process.exit(1); }

// ---------- 1. 载入 ----------
var matrix = JSON.parse(fs.readFileSync(MATRIX_FILE, 'utf8'));
var allowRows = (matrix.mappings || []).filter(function (m) { return m.permission === 'allow'; });
if (allowRows.length !== 1570) fail('ALLOW 行数 ' + allowRows.length + ' ≠ 1570');

var intentDoc = JSON.parse(fs.readFileSync(INTENT_FILE, 'utf8'));
var intentByKey = {};
(intentDoc.rows || []).forEach(function (r) { intentByKey[r.knowledgeId + '|' + r.questionType] = r; });

// SHAPE_THEME 冻结白名单（正则取 shape.js 源码 SSOT，不另存清单防漂移，同 P28 冻结测试口径）
var shapeSrc = fs.readFileSync(SHAPE_SRC, 'utf8');
var shapeBlock = /var SHAPE_THEME = \{([\s\S]*?)\n\};/.exec(shapeSrc);
if (!shapeBlock) fail('shape.js SHAPE_THEME 块未找到');
var SHAPE_THEMED = {};
shapeBlock[1].replace(/'(math-[^']+)':\s*shapeTheme\(/g, function (_, id) { SHAPE_THEMED[id] = 1; return _; });

// ---------- 2. 题面核心骨架（剥离数字/选项/题型后缀包装） ----------
function coreStem(s) {
  return String(s)
    .replace(/（[\s\S]*?）/g, '')   // 括号区（选项区/注音）
    .replace(/\n[\s\S]*$/g, '')    // 多行只取首行
    .replace(/\d+(\.\d+)?/g, '#')  // 数字占位
    .replace(/_{2,}/g, '')         // 填空线
    .replace(/（?\s*[）)]/g, '')
    .replace(/选出正确答案|答[:：]?/g, '')
    .replace(/[\s。，、；：？?！!（）\.\,\;\:→○□=]/g, '');
}
function ngrams(s, n) { var a = []; for (var i = 0; i + n <= s.length; i++) a.push(s.substr(i, n)); return a; }
function coreSim(a, b) {
  var A = {}, B = {}, aa = ngrams(a, 3), bb = ngrams(b, 3);
  aa.forEach(function (x) { A[x] = 1; });
  bb.forEach(function (x) { B[x] = 1; });
  var na = Object.keys(A).length, nb = Object.keys(B).length;
  if (!na || !nb) return a === b ? 1 : 0;
  var inter = 0;
  Object.keys(A).forEach(function (x) { if (B[x]) inter++; });
  return inter / Math.min(na, nb);
}

// ---------- 3. 逐行采集 ----------
var cells = [];
var byKpGen = {};
var missing = [];

allowRows.forEach(function (m, idx) {
  var kp = m.knowledgeId, qt = m.questionType;
  var intent = intentByKey[kp + '|' + qt] || null;
  var rec = {
    kp: kp, qt: qt,
    pluginId: m.pluginId,
    intentStatus: intent ? intent.status : 'missing',
    focus: intent && intent.assessment ? intent.assessment.focus : null,
    generator: null, makerKey: null,
    hasOptions: false, isJudge: false, hasBlank: false,
    sample: '', core: '', level: null
  };
  try {
    var plan = SP.attachToPlan({
      knowledgePointIds: [kp], questionTypeId: qt,
      difficulty: FREEZE_DIFFICULTY, count: 1,
      seed: 'freeze:' + FREEZE_SEED_VERSION + '|' + kp + '|' + qt + '|d' + FREEZE_DIFFICULTY
    });
    var sel = Selector.selectGenerator(plan);
    var gen = Selector.instantiate(sel);
    var qs = gen.generate(plan, {});
    var q = Array.isArray(qs) ? qs[0] : qs;
    if (!q) { missing.push(kp + '|' + qt + ':no-question'); }
    else {
      rec.generator = sel.generatorId;
      var d = q.data || {};
      rec.makerKey = sel.generatorId + '|' + (d.subType || d.shapeName || d.mode || qt);
      rec.hasOptions = !!(q.options || d.options);
      rec.isJudge = qt === 'judge';
      rec.hasBlank = /_{2,}|□/.test(String(q.prompt || ''));
      rec.sample = String(q.prompt || '').slice(0, 48);
      rec.core = coreStem(q.prompt);
    }
  } catch (e) {
    missing.push(kp + '|' + qt + ':' + String((e && e.message) || e).slice(0, 80));
  }
  cells.push(rec);
  (byKpGen[kp + '@' + rec.generator] = byKpGen[kp + '@' + rec.generator] || []).push(rec);
  if (idx % 200 === 0) process.stdout.write('\r  采集进度 ' + (idx + 1) + '/' + allowRows.length);
});
process.stdout.write('\r  采集进度 ' + allowRows.length + '/' + allowRows.length + '          \n');

if (missing.length) fail('存在未真实生成行（共 ' + missing.length + '）：' + missing.slice(0, 5).join('；'));

// ---------- 4. 分工级别判定（同 KP×Generator 组内跨题型核心骨架比对） ----------
cells.forEach(function (c) {
  if (c.generator === 'generator:shape-recognition' && SHAPE_THEMED[c.kp]) {
    c.level = 'target-frozen';
    return;
  }
  var group = byKpGen[c.kp + '@' + c.generator] || [];
  var sameCore = false;
  for (var i = 0; i < group.length; i++) {
    var o = group[i];
    if (o === c || o.qt === c.qt) continue;
    if (o.level === 'target-frozen') continue;
    if (c.core && o.core && coreSim(c.core, o.core) >= SAME_CORE_THRESHOLD) { sameCore = true; break; }
  }
  c.level = sameCore ? 'format' : 'target';
});

// ---------- 5. 汇总 ----------
var levelCount = { target: 0, format: 0, 'target-frozen': 0 };
var formatByGen = {};
var formatKps = {};
cells.forEach(function (c) {
  levelCount[c.level]++;
  if (c.level === 'format') {
    formatByGen[c.generator] = (formatByGen[c.generator] || 0) + 1;
    formatKps[c.kp] = 1;
  }
});
var intentStatusCount = {};
cells.forEach(function (c) { intentStatusCount[c.intentStatus] = (intentStatusCount[c.intentStatus] || 0) + 1; });

// KP 级滚动
var kpRollup = {};
cells.forEach(function (c) {
  var k = kpRollup[c.kp] || { levels: {} };
  k.levels[c.level] = (k.levels[c.level] || 0) + 1;
  kpRollup[c.kp] = k;
});
var kpClass = { 'pure-target': 0, 'pure-format': 0, mixed: 0, 'frozen-only': 0 };
Object.keys(kpRollup).forEach(function (kp) {
  var lv = kpRollup[kp].levels;
  var hasFmt = !!lv.format, hasT = !!(lv.target || lv['target-frozen']);
  if (lv.format && hasT) kpClass.mixed++;
  else if (lv.format) kpClass['pure-format']++;
  else if (lv['target-frozen'] && !lv.target) kpClass['frozen-only']++;
  else kpClass['pure-target']++;
});

var artifact = {
  task: 'P30-GEN-05 KP×QT→Assessment Target→Generator Maker 分工矩阵',
  seedPolicy: { version: FREEZE_SEED_VERSION, difficulty: FREEZE_DIFFICULTY, formula: 'freeze:{v}|{kp}|{qt}|d{d}', sameCoreThreshold: SAME_CORE_THRESHOLD },
  counts: {
    rows: cells.length,
    byLevel: levelCount,
    byIntentStatus: intentStatusCount,
    kpClass: kpClass,
    formatKps: Object.keys(formatKps).length,
    formatByGenerator: formatByGen
  },
  rows: cells.map(function (c) {
    return {
      kp: c.kp, qt: c.qt, generator: c.generator, makerKey: c.makerKey,
      intentStatus: c.intentStatus, focus: c.focus, level: c.level,
      hasOptions: c.hasOptions, isJudge: c.isJudge, hasBlank: c.hasBlank,
      core: c.core, sample: c.sample
    };
  })
};

// ---------- 6. MD 报告 ----------
function buildMd() {
  var L = [];
  L.push('# P30-GEN-05｜KP × QT → Assessment Target → Generator Maker 分工矩阵');
  L.push('');
  L.push('> 机器产物：`node dev/p30/check-kp-qt-maker-matrix.js --write`，手工编辑无效。');
  L.push('> 冻结 seed `' + FREEZE_SEED_VERSION + '`，难度 ' + FREEZE_DIFFICULTY + '，同核阈值 ' + SAME_CORE_THRESHOLD + '。');
  L.push('');
  L.push('## 分级口径');
  L.push('');
  L.push('- **target**：同 (KP, Generator) 内跨题型题面核心骨架互异——不同 Assessment Target 由不同 maker 承担。');
  L.push('- **format**：跨题型题面核心骨架相同（仅 ____/选项/判断包装不同）——「同核任务换壳」债务。');
  L.push('- **target-frozen**：P28-HOLLOW-02 SHAPE_THEME 冻结裁决行（用户裁决的历史特化承载，P30 不翻案）。');
  L.push('');
  L.push('## 总量');
  L.push('');
  L.push('| 级别 | 行数 |');
  L.push('|---|---|');
  L.push('| target | ' + levelCount.target + ' |');
  L.push('| format（债务） | ' + levelCount.format + ' |');
  L.push('| target-frozen | ' + levelCount['target-frozen'] + ' |');
  L.push('');
  L.push('KP 级分类：纯 target **' + kpClass['pure-target'] + '** / 混合 **' + kpClass.mixed + '** / 纯 format **' + kpClass['pure-format'] + '** / 仅 frozen **' + kpClass['frozen-only'] + '**。');
  L.push('');
  L.push('format 债务行共 **' + levelCount.format + '** 行 / **' + Object.keys(formatKps).length + '** KP，按实际承载生成器：');
  L.push('');
  L.push('| Generator | format 行数 |');
  L.push('|---|---|');
  Object.keys(formatByGen).sort(function (a, b) { return formatByGen[b] - formatByGen[a]; })
    .forEach(function (g) { L.push('| ' + g + ' | ' + formatByGen[g] + ' |'); });
  L.push('');
  L.push('## format 债务明细（逐格）');
  L.push('');
  L.push('| KP | QT | Generator | sample |');
  L.push('|---|---|---|---|');
  cells.filter(function (c) { return c.level === 'format'; })
    .forEach(function (c) {
      L.push('| ' + c.kp + ' | ' + c.qt + ' | ' + c.generator.replace('generator:', '') + ' | ' + String(c.sample).replace(/\|/g, '/') + ' |');
    });
  L.push('');
  return L.join('\n');
}

// ---------- 7. 输出/复核 ----------
var jsonText = JSON.stringify(artifact, null, 2) + '\n';
var mdText = buildMd();

if (WRITE) {
  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, jsonText);
  fs.writeFileSync(OUT_MD, mdText);
  console.log('[P30-GEN-05] 矩阵已冻结');
} else {
  if (!fs.existsSync(OUT_JSON)) fail('冻结产物不存在，请先运行 --write：' + path.relative(ROOT, OUT_JSON));
  var frozen = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
  var frozenText = JSON.stringify(frozen, null, 2) + '\n';
  if (frozenText !== jsonText) {
    console.error('矩阵产物漂移（机器字段不一致）。');
    console.error('  当前：target=' + levelCount.target + ' format=' + levelCount.format + ' target-frozen=' + levelCount['target-frozen']);
    console.error('  冻结：target=' + frozen.counts.byLevel.target + ' format=' + frozen.counts.byLevel.format + ' target-frozen=' + frozen.counts.byLevel['target-frozen']);
    console.error('  maker 真分工修复后显式运行：node dev/p30/check-kp-qt-maker-matrix.js --write');
    process.exit(1);
  }
  if (fs.readFileSync(OUT_MD, 'utf8') !== mdText) fail('MD 报告漂移，请重跑 --write');
  console.log('[P30-GEN-05] 矩阵复核一致');
}

console.log('  行数 ' + cells.length +
  '：target=' + levelCount.target +
  ' / format(债务)=' + levelCount.format +
  ' / target-frozen=' + levelCount['target-frozen']);
console.log('  KP：纯target=' + kpClass['pure-target'] + ' 混合=' + kpClass.mixed + ' 纯format=' + kpClass['pure-format'] + ' 仅frozen=' + kpClass['frozen-only']);
console.log('  intent 状态：' + JSON.stringify(intentStatusCount));
if (levelCount.format > 0) {
  console.log('  format 债务（' + levelCount.format + ' 行 / ' + Object.keys(formatKps).length + ' KP）按生成器：');
  Object.keys(formatByGen).sort(function (a, b) { return formatByGen[b] - formatByGen[a]; })
    .forEach(function (g) { console.log('    ' + g + ' ' + formatByGen[g]); });
}
process.exit(0);
