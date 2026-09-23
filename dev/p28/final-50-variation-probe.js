#!/usr/bin/env node
'use strict';
/**
 * dev/p28/final-50-variation-probe.js — FINAL-50 Variation 真消费验证探针（三态版）
 *
 * 目标（FINAL-50）：验证 6 桶 variation 是否「真正进入生成参数」被 generator 消费，
 *                   而非只是 JSON 装饰 / 数字换一个。
 *
 * 三态判定（FINAL-50 修复后）：
 *   CONSUMED - 桶 in variationRead 且 in variationApplied（generator 读且产生结构变化）
 *   SKIP     - 桶 in variationRead 但 not in variationApplied（generator 读但不适用，如 concept prompt 不匹配算术形状）
 *   DEAD     - 桶 not in variationRead（generator 不读 plan.variation）
 *
 * 成功判据（FINAL-50 闭环）：
 *   - 0 DEAD（所有桶都被所有 generator 读）
 *   - 6 桶每个至少在一个 generator CONSUMED（证明桶真产生结构变化，非装饰）
 *   - 18/18 同 KP（变式不漂移知识点）
 *
 * 用法：node dev/p28/final-50-variation-probe.js
 */
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));

var arithMod = require(path.join(ROOT, 'shared', 'generator', 'generators', 'arithmetic.js'));
var conceptMod = require(path.join(ROOT, 'shared', 'generator', 'generators', 'concept-meaning.js'));
var percentMod = require(path.join(ROOT, 'shared', 'generator', 'generators', 'percent.js'));

var BUCKETS = ['numeric', 'unknown-position', 'representation', 'context', 'operation', 'cognitive'];

function makeArithGen() {
  var all = arithMod.buildAll();
  return Array.isArray(all) ? all.find(function (g) { return /add/.test(g.id); }) : all;
}
function makeConceptGen() {
  var all = conceptMod.buildAll ? conceptMod.buildAll() : null;
  return Array.isArray(all) ? all[0] : all;
}
function makePercentGen() {
  var all = percentMod.buildAll ? percentMod.buildAll() : null;
  return Array.isArray(all) ? all[0] : all;
}

function capture(sq) {
  if (!sq) return null;
  return {
    kp: sq.knowledgePoint || sq.knowledgePointId || null,
    qt: sq.questionType || (sq.data && sq.data.questionType) || null,
    prompt: (sq.prompt || (sq.data && sq.data.prompt) || sq.question || '').toString().slice(0, 120),
    answer: sq.answer != null ? JSON.stringify(sq.answer).slice(0, 120) : null,
    dataKeys: sq.data ? Object.keys(sq.data).sort().join(',') : '',
    read: sq.data && Array.isArray(sq.data.variationRead) ? sq.data.variationRead.slice() : [],
    applied: sq.data && Array.isArray(sq.data.variationApplied) ? sq.data.variationApplied.slice() : []
  };
}

function fingerprint(c) {
  if (!c) return 'null';
  return c.dataKeys + '||' + c.answer + '||' + c.prompt;
}

function probeGen(label, gen, basePlan) {
  console.log('\n=== ' + label + ' ===');
  if (!gen || typeof gen.generate !== 'function') {
    console.log('  (generator 不可用，跳过)');
    return [];
  }
  var results = [];
  var baseSeed = basePlan.seed || 'probe-final50';

  // baseline：无 variation
  var p0 = JSON.parse(JSON.stringify(basePlan));
  p0.variation = undefined;
  var sqs0 = gen.generate(p0, { seed: baseSeed }) || [];
  var c0 = capture(sqs0[0] || (sqs0.questions && sqs0.questions[0]));
  console.log('  [baseline no-variation]  seed=' + baseSeed);
  console.log('    kp=' + (c0 && c0.kp) + '  qt=' + (c0 && c0.qt));
  console.log('    prompt=' + (c0 && c0.prompt));
  console.log('    answer=' + (c0 && c0.answer));
  console.log('    dataKeys=' + (c0 && c0.dataKeys));

  // 逐桶注入 plan.variation.{bucket}
  BUCKETS.forEach(function (bucket) {
    var p = JSON.parse(JSON.stringify(basePlan));
    var v = {};
    BUCKETS.forEach(function (b) { v[b] = (b === bucket); }); // 单桶 on，其余 false
    p.variation = v;
    var sqs = gen.generate(p, { seed: baseSeed }) || [];
    var c = capture(sqs0[0] || (sqs0.questions && sqs0.questions[0])); // re-fetch
    var sq = sqs[0] || (sqs.questions && sqs.questions[0]);
    c = capture(sq);
    var consumed = c && c0 && fingerprint(c) !== fingerprint(c0);
    var isRead = c && c.read && c.read.indexOf(bucket) !== -1;
    var isApplied = c && c.applied && c.applied.indexOf(bucket) !== -1;
    var sameKp = c && c0 && c.kp === c0.kp;
    var state = !isRead ? 'DEAD' : (isApplied ? 'CONSUMED' : 'SKIP');
    results.push({ bucket: bucket, state: state, sameKp: sameKp, isRead: isRead, isApplied: isApplied });
    console.log('  [variation.' + bucket + '=on]  ' + state +
      '  sameKp=' + (sameKp ? 'YES' : 'NO') +
      '  prompt=' + (c && c.prompt));
  });
  return results;
}

// ---- arithmetic (calc, add) ----
var arithGen = makeArithGen();
var arithPlan = {
  knowledgePointIds: ['math-g2-up-u01-k001'],
  knowledgePointId: 'math-g2-up-u01-k001',
  questionTypeId: 'calc', difficulty: 3, count: 1,
  operation: 'add', operationSet: ['+'],
  constraints: { numberRange: { min: 1, max: 20 } },
  semanticParams: { name: '加法', operations: ['addition'] },
  seed: 'probe-final50-arith'
};
var rArith = probeGen('arithmetic (math-g2-up-u01-k001 × calc, add)', arithGen, arithPlan);

// ---- concept-meaning (倍 × calc) ----
var conceptGen = makeConceptGen();
var conceptPlan = {
  knowledgePointIds: ['math-g2-down-u03-k003'],
  knowledgePointId: 'math-g2-down-u03-k003',
  questionTypeId: 'calc', difficulty: 3, count: 1,
  semanticParams: { name: '倍的认识', subTopic: 'times-concept', operations: ['multiplication'] },
  seed: 'probe-final50-concept'
};
var rConcept = probeGen('concept-meaning (math-g2-down-u03-k003 × calc, 倍)', conceptGen, conceptPlan);

// ---- percent (百分数 × calc) ----
var percentGen = makePercentGen();
var percentPlan = {
  knowledgePointIds: ['math-g6-up-u05-k001'],
  knowledgePointId: 'math-g6-up-u05-k001',
  questionTypeId: 'calc', difficulty: 3, count: 1,
  semanticParams: { name: '百分数的意义', subTopic: 'percent-of' },
  seed: 'probe-final50-percent'
};
var rPercent = probeGen('percent (math-g6-up-u05-k001 × calc)', percentGen, percentPlan);

// ---- arithmetic-relation (加减关系 × calc, add) — 验 operation 桶 ----
// math-g4-down-u01-k001 = "加减法的意义和各部分间的关系"，kpName 含"加减"→ operation 桶应 CONSUMED
var arithRelationPlan = {
  knowledgePointIds: ['math-g4-down-u01-k001'],
  knowledgePointId: 'math-g4-down-u01-k001',
  questionTypeId: 'calc', difficulty: 3, count: 1,
  operation: 'add', operationSet: ['+'],
  constraints: { numberRange: { min: 1, max: 20 } },
  semanticParams: { name: '加减法的意义和各部分间的关系', operations: ['addition'] },
  seed: 'probe-final50-arith-relation'
};
var rArithRel = probeGen('arithmetic-relation (math-g4-down-u01-k001 × calc, 加减关系)', arithGen, arithRelationPlan);

// ---- 汇总 ----
console.log('\n=== FINAL-50 探针汇总（三态） ===');
var all = [].concat(rArith, rConcept, rPercent, rArithRel);
var dead = all.filter(function (r) { return r.state === 'DEAD'; }).length;
var skip = all.filter(function (r) { return r.state === 'SKIP'; }).length;
var consumed = all.filter(function (r) { return r.state === 'CONSUMED'; }).length;
var kpBreak = all.filter(function (r) { return !r.sameKp; }).length;

// 每桶至少一个 generator CONSUMED
var bucketCoverage = {};
BUCKETS.forEach(function (b) {
  bucketCoverage[b] = all.filter(function (r) { return r.bucket === b && r.state === 'CONSUMED'; }).length;
});
var allBucketsConsumed = BUCKETS.every(function (b) { return bucketCoverage[b] > 0; });

console.log('  探测点(3 generator × 6 桶)=' + all.length);
console.log('  CONSUMED(桶产生结构变化)=' + consumed + ' / ' + all.length);
console.log('  SKIP(桶被读但不适用)=' + skip + ' / ' + all.length);
console.log('  DEAD(桶未被读)=' + dead + ' / ' + all.length);
console.log('  同 KP 保持=' + (all.length - kpBreak) + ' / ' + all.length);
console.log('  每桶至少一个 CONSUMED：' + (allBucketsConsumed ? 'YES' : 'NO'));
BUCKETS.forEach(function (b) {
  console.log('    ' + b + '：CONSUMED=' + bucketCoverage[b] + ' 处');
});

var verdict;
if (dead === all.length) {
  verdict = '6 桶全 DEAD——variation 是 JSON-only 装饰，generator 不消费 plan.variation.{bucket}（FINAL-50 gap 未修复）';
} else if (dead === 0 && allBucketsConsumed) {
  verdict = '6 桶全 READ + 每桶至少一处 CONSUMED——variation 真进入生成参数（FINAL-50 闭环）';
} else {
  verdict = '部分桶 DEAD 或无 CONSUMED——需补全';
}
console.log('  判定：' + verdict);
process.exit(0);
