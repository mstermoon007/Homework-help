#!/usr/bin/env node
/**
 * dev/competition-report.js — 竞赛插件任务06：压力测试 + 错误答案拒绝测试 + 报告
 *
 * 与 verify-competition.js 的分工：
 *   verify-competition.js  — 每子题型×难度抽样的正确性/唯一性/去重门禁（提交前必跑）
 *   competition-report.js  — 大规模随机压力测试（每 type ≥100 题，高风险 type ≥500 题）
 *                            + 错误答案必须被拒绝（防宽松匹配/漏判）
 *                            + 产出根目录 competition-report.json
 *
 * 设计要点：
 *   1. 压力测试按「type 全局计数」而非按组合计数：先跑一轮全组合摸清 type→组合 映射，
 *      再对未达标 type 轮询其所属组合分轮生成（每轮 25 题，与真实练习一致，
 *      避免单轮超量触发参数空间不足的题面重复误报）。
 *   2. 错误答案集（对每个答案值 a）：
 *        数字 → a+1 / a−1 / 随机(≠a) / 空串 / 'abc'
 *        分数 → 分子+1 / 空串 / 'abc'
 *        其他 → 空串 / 'abc' / 原文乱改
 *      multi 数组 → 仅错一个字段（其余字段保持正确），验证单字段错误也被拒绝。
 *      若任一错误答案被判对 ⇒ 宽松匹配缺陷（如 includes 子串匹配）。
 *
 * 用法：
 *   node dev/competition-report.js                 # 全量压测并生成报告
 *   node dev/competition-report.js --only C5       # 只压测某模块（调试用）
 */
'use strict';
var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

var args = process.argv.slice(2);
function argVal(name, def) {
  var i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
var ONLY = (argVal('--only', '') || '').toUpperCase();
var PER_TYPE = Number(argVal('--per-type', 100)) || 100;
var HIGH_RISK_N = Number(argVal('--high-risk', 500)) || 500;
var BATCH = 25; // 每轮生成题量，与真实练习一致

/* 高风险 type：本批开发中出现过真实缺陷（类型碰撞 / 共享 type 跨年级格式 / π 舍入 /
   参数空间不足 / 反鞅制取子 / 宽松正则），压测加码到 HIGH_RISK_N 题 */
var HIGH_RISK = {
  train: 1, chase: 1, meet: 1, competition: 1, solid: 1, logic: 1, winning: 1,
  grass: 1, pigeonhole: 1, enumeration: 1, 'interval-departure': 1, 'pick-up': 1,
  circle: 1, 'circle-angle': 1, 'solid-rotation': 1, clock: 1
};

require(path.join(ROOT, 'shared/common.js'));
var PLUGIN_REGISTRY = require(path.join(ROOT, 'plugins/registry.js'));
var CHECKERS = require(path.join(ROOT, 'plugins/competition/checkers/index.js'));

/* ==================== 工具 ==================== */
function subTypes(plugin) {
  var s = (plugin.settings || []).find(function (x) { return x && x.key === 'type'; });
  if (!s || !Array.isArray(s.options)) return [null];
  return s.options.map(function (o) { return o.value; });
}
var RAND = (typeof crypto !== 'undefined' && crypto.getRandomValues)
  ? function () { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  : Math.random;
function randInt(lo, hi) { return lo + Math.floor(RAND() * (hi - lo + 1)); }

var NUM_RE = /^-?\d+(\.\d+)?$/;
var FRAC_RE = /^-?(\d+)\/(\d+)$/;

/** 合法运算符号全集（含全半角、键盘等价写法——见 c1 插件 OP_SYN 表）——
 *  符号题的「错误答案」必须避开这些，否则测的是键盘等价特性而非缺陷 */
var OP_SET = {
  '+': 1, '＋': 1, '-': 1, '－': 1, '−': 1, '–': 1, '—': 1,
  '*': 1, '×': 1, 'x': 1, 'X': 1, '✕': 1, 'ｘ': 1,
  '/': 1, '÷': 1, '／': 1, '\\': 1, '(': 1, ')': 1
};

/* 多解题例外表：题面命中的题存在多个合法答案（产品有意容忍，如「写出其中一个」类题面），
 * 错误答案恰为另一合法解时应单独统计为 multiTolerated，不计入失败。 */
var MULTI_SOLUTION_EXCEPTIONS = [
  { type: 'perfect-square', pattern: /不可能的个位数字/, note: '多解题：2/3/7/8 任一均正确（产品设计）' }
];

function multiSolutionException(q) {
  for (var i = 0; i < MULTI_SOLUTION_EXCEPTIONS.length; i++) {
    var e = MULTI_SOLUTION_EXCEPTIONS[i];
    if (e.type === q.type && e.pattern.test(String(q.q || ''))) return e;
  }
  return null;
}

/** 对单个答案值构造错误写法集合（全部必须被 check 拒绝） */
function wrongValues(a) {
  var s = String(a);
  var out = ['', 'abc'];
  if (NUM_RE.test(s)) {
    var n = Number(s);
    out.push(String(n + 1));
    if (n - 1 !== n) out.push(String(n - 1));
    var r;
    do { r = n + randInt(2, 200); } while (r === n);
    out.push(String(r));
  } else if (FRAC_RE.test(s)) {
    var m = s.match(FRAC_RE);
    out.push((Number(m[1]) + 1) + '/' + m[2]);
  } else if (OP_SET[s] || OP_SET[s.toLowerCase()]) {
    // 单运算符号：轮转会得到另一个合法符号（多解题的另一个正解），
    // 键盘等价写法（x/X/* 等）也被产品有意接受，都不能当错误答案——
    // 必须用「非任何合法符号及其等价写法」才算真正的错误答案
    out.push('?');
    out.push('#');
  } else if (s.length > 1) {
    out.push(s.slice(1) + s[0]); // 多字符：轮转（≠原文）
  } else {
    out.push('Z');
  }
  return out;
}

/** 构造完整错误 answers 对象（模拟 practice.html collectAnswers 的键结构），每题返回多个变体 */
function wrongAnswerVariants(q, i) {
  var variants = [];
  if (q.inputType === 'multi' && Array.isArray(q.answer) && q.answer.length > 0) {
    // 仅错一个字段，其余字段保持正确
    q.answer.forEach(function (a, j) {
      if (a && typeof a === 'object') return; // {q,r} 等对象答案跳过字段级变体
      wrongValues(a).forEach(function (wv) {
        var ans = {};
        q.answer.forEach(function (b, k) { ans[i + ':' + k] = String(b); });
        ans[i + ':' + j] = wv;
        variants.push({ answers: ans, label: '字段' + j + '=' + JSON.stringify(wv) });
      });
    });
  } else if (Array.isArray(q.answer)) {
    // 数组整串（text 输入拼接）：错第一项
    var first = q.answer[0];
    if (first != null && typeof first !== 'object') {
      wrongValues(first).forEach(function (wv) {
        var arr = q.answer.map(function (x) { return String(x); });
        arr[0] = wv;
        variants.push({ answers: (function () { var o = {}; o[i] = arr.join(''); return o; })(), label: '整串=' + JSON.stringify(arr.join('')) });
      });
    }
  } else if (q.answer != null && typeof q.answer !== 'object') {
    wrongValues(q.answer).forEach(function (wv) {
      var o = {}; o[i] = wv;
      variants.push({ answers: o, label: JSON.stringify(wv) });
    });
  }
  return variants;
}

/* ==================== 统计 ==================== */
var stats = {}; // type -> {questions, solveFail, wrongChecks, wrongAccepted}
var failures = [];
function st(type) {
  if (!stats[type]) stats[type] = { questions: 0, solveFail: 0, wrongChecks: 0, wrongAccepted: 0 };
  return stats[type];
}
function addFailure(kind, rec, type, difficulty, q, detail) {
  failures.push({
    kind: kind, plugin: rec.id, type: type, difficulty: difficulty,
    q: String(q.q || '').slice(0, 120),
    expected: q.answer === undefined ? null : (typeof q.answer === 'object' ? JSON.parse(JSON.stringify(q.answer)) : q.answer),
    detail: detail
  });
  if (failures.length <= 40) {
    console.log('    ✗ [' + kind + '][' + type + ' lv' + difficulty + '] ' + detail);
    console.log('       题干：' + String(q.q || '').slice(0, 90));
  }
}

/** 校验一题：独立求解 + 错误答案拒绝 */
function checkQuestion(rec, q, i, difficulty) {
  var s = st(q.type);
  s.questions++;
  // ① 独立求解（答案正确 + 解唯一）
  var r = CHECKERS.solve(q);
  if (r.problems && r.problems.length) {
    s.solveFail++;
    addFailure('solve', rec, q.type, difficulty, q, r.problems[0]);
  } else {
    var chk = CHECKERS.check(q, q.answer);
    if (!chk.correct) {
      s.solveFail++;
      addFailure('answer', rec, q.type, difficulty, q, chk.reason + '（expected=' + JSON.stringify(chk.expected) + '）');
    }
  }
  // ② 错误答案必须被拒绝（多解题例外：另一合法解被接受属产品设计，单独统计）
  if (typeof q.check === 'function') {
    var msex = multiSolutionException(q);
    wrongAnswerVariants(q, i).forEach(function (v) {
      s.wrongChecks++;
      var res = q.check(v.answers, i);
      if (res) {
        if (msex) {
          s.multiTolerated = (s.multiTolerated || 0) + 1;
        } else {
          s.wrongAccepted++;
          addFailure('reject', rec, q.type, difficulty, q, '错误答案被误判为对：' + v.label + '（expected=' + JSON.stringify(q.answer) + '）');
        }
      }
    });
  }
}

/* ==================== 主流程 ==================== */
var comp = PLUGIN_REGISTRY.filter(function (r) {
  return !r.isPlaceholder
    && Array.isArray(r.moduleIds) && r.moduleIds.some(function (id) { return /^C\d$/.test(id); })
    && !/g5-c\d/.test(r.id)
    && (!ONLY || r.moduleIds.indexOf(ONLY) >= 0);
});

console.log('🏆 竞赛插件压力测试 + 错误答案拒绝测试');
console.log('   目标：每 type ≥' + PER_TYPE + ' 题；高风险 type ≥' + HIGH_RISK_N + ' 题（' + Object.keys(HIGH_RISK).length + ' 个）');

// 组合 = {rec, plugin, type, grade}；difficulties=[3,6,9]
var combos = [];
comp.forEach(function (rec) {
  var plugin;
  try {
    plugin = require(path.join(ROOT, rec.file));
  } catch (e) {
    failures.push({ kind: 'load', plugin: rec.id, detail: e.message });
    console.log('✗ ' + rec.id + ' 加载失败：' + e.message);
    return;
  }
  var grade = (rec.grades && rec.grades[0]) || 4;
  subTypes(plugin).forEach(function (type) {
    combos.push({ rec: rec, plugin: plugin, type: type, grade: grade });
  });
});

function genBatch(c, difficulty) {
  var opts = { grade: c.grade, count: BATCH, difficulty: difficulty };
  if (c.type) opts.type = c.type;
  var set;
  try {
    set = c.plugin.generate(opts);
  } catch (e) {
    addFailure('generate', c.rec, c.type || 'default', difficulty, { q: '' }, 'generate 抛错：' + e.message);
    return [];
  }
  return (set && set.questions) || [];
}

function targetOf(type) { return HIGH_RISK[type] ? HIGH_RISK_N : PER_TYPE; }

// ---- pass 1：每组合一轮，摸清 type → 组合 映射并累计 ----
var typeCount = {};
var typeCombos = {};
console.log('\n▶ 第一轮全组合扫描（' + combos.length + ' 个组合）…');
combos.forEach(function (c) {
  var qs = genBatch(c, 6);
  qs.forEach(function (q, i) {
    typeCount[q.type] = (typeCount[q.type] || 0) + 1;
    (typeCombos[q.type] = typeCombos[q.type] || []).push(c);
    checkQuestion(c.rec, q, i, 6);
  });
});

// ---- pass 2：对未达标 type 轮询其组合分轮生成 ----
var rounds = 0;
var totalRoundsBudget = 4000; // 安全阀
while (rounds < totalRoundsBudget) {
  var need = Object.keys(typeCount).filter(function (t) { return typeCount[t] < targetOf(t); });
  if (!need.length) break;
  // 本轮处理的 type（挑缺口最大的几个，减少无效组合生成）
  need.sort(function (a, b) { return (targetOf(b) - typeCount[b]) - (targetOf(a) - typeCount[a]); });
  var batchTypes = need.slice(0, 10);
  var did = 0;
  batchTypes.forEach(function (t) {
    var cs = typeCombos[t] || [];
    if (!cs.length) { typeCount[t] = targetOf(t); return; } // 无组合可生成（不该发生）
    var c = cs[rounds % cs.length];
    var difficulty = [3, 6, 9][rounds % 3];
    var qs = genBatch(c, difficulty);
    var picked = 0;
    qs.forEach(function (q, i) {
      typeCount[q.type] = (typeCount[q.type] || 0) + 1;
      checkQuestion(c.rec, q, i, difficulty);
      if (q.type === t) picked++;
    });
    did++;
    // 该组合本轮没产出目标 type（如 mix 组合混合出题）→ 也计入轮次，靠多轮凑齐
  });
  rounds++;
  if (rounds % 20 === 0) {
    var remaining = need.length;
    console.log('  … 第 ' + rounds + ' 轮补测，剩余未达标 type：' + remaining + '，累计题量：' + Object.keys(typeCount).reduce(function (s, t) { return s + typeCount[t]; }, 0));
  }
}

/* ==================== 报告 ==================== */
var allTypes = Object.keys(typeCount).sort();
var below = allTypes.filter(function (t) { return typeCount[t] < targetOf(t); });
var totals = {
  plugins: comp.length,
  types: allTypes.length,
  questions: allTypes.reduce(function (s, t) { return s + typeCount[t]; }, 0),
  solveFail: allTypes.reduce(function (s, t) { return s + (stats[t] ? stats[t].solveFail : 0); }, 0),
  wrongChecks: allTypes.reduce(function (s, t) { return s + (stats[t] ? stats[t].wrongChecks : 0); }, 0),
  wrongAccepted: allTypes.reduce(function (s, t) { return s + (stats[t] ? stats[t].wrongAccepted : 0); }, 0),
  multiSolutionTolerated: allTypes.reduce(function (s, t) { return s + (stats[t] && stats[t].multiTolerated || 0); }, 0)
};
var byType = {};
allTypes.forEach(function (t) {
  byType[t] = {
    questions: typeCount[t],
    target: targetOf(t),
    highRisk: !!HIGH_RISK[t],
    solveFail: stats[t] ? stats[t].solveFail : 0,
    wrongAnswerChecks: stats[t] ? stats[t].wrongChecks : 0,
    wrongAccepted: stats[t] ? stats[t].wrongAccepted : 0,
    multiSolutionTolerated: stats[t] && stats[t].multiTolerated || 0
  };
});

var report = {
  generatedAt: new Date().toISOString(),
  suite: 'dev/competition-report.js',
  scope: ONLY ? ('--only ' + ONLY) : '全部竞赛插件（C1-C9，g4/g6；g5 由 verify-g5-competition.js 覆盖）',
  targets: { perType: PER_TYPE, highRisk: HIGH_RISK_N, batchPerRound: BATCH, extraRounds: rounds },
  highRiskTypes: Object.keys(HIGH_RISK),
  summary: totals,
  belowTarget: below,
  byType: byType,
  failures: failures
};

var outPath = path.join(ROOT, 'competition-report.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log('\n' + '='.repeat(60));
console.log('题量：' + totals.questions + ' 题 / ' + totals.types + ' 种 type / ' + totals.plugins + ' 个插件');
console.log('错误答案拒绝测试：' + totals.wrongChecks + ' 次，误接受 ' + totals.wrongAccepted + ' 次'
  + (totals.multiSolutionTolerated ? '，多解题容忍（产品设计，非缺陷）' + totals.multiSolutionTolerated + ' 次' : ''));
if (below.length) console.log('⚠️  以下 type 未达目标题量：' + below.map(function (t) { return t + '(' + typeCount[t] + '/' + targetOf(t) + ')'; }).join('、'));
console.log('失败明细：' + failures.length + ' 条（已写入 ' + path.basename(outPath) + '）');
if (!failures.length && !below.length) {
  console.log('✅ 压力测试与错误答案拒绝测试全部通过。');
  process.exit(0);
} else {
  console.log('❌ 存在失败项，请查看 competition-report.json。');
  process.exit(1);
}
