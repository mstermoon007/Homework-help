#!/usr/bin/env node
'use strict';
// dev/check-educational-generation.js — P25-15 教育真实性最终门禁
//
// 任务书 P25-15：307 A 类 KP × 核心题型（apply/choice/fill）全量 E2E 门禁。
// 对每个 (kp, qt) 真实生成 1 题，并跑 KpSemantic.checkSemanticEvidence 分桶。
//
// 四态分桶：
//   GENERATION_PASS  — 生成 ≥1 题 且 证据状态 = skip（KP×QT 无证据规则）
//   SEMANTIC_PASS    — 生成 ≥1 题 且 证据状态 = pass（规则全满足）
//   SEMANTIC_WARN    — 生成 ≥1 题 且 证据状态 = warn（规则存在但题未声明 semanticEvidence，过渡期）
//   SEMANTIC_FAIL    — 生成 0 题 / 抛错 / 证据状态 = fail（规则违例）
//
// 第一阶段门禁（当前）：任一 SEMANTIC_FAIL → exit 1。
//   理由：黄金题集（P25-16）显示 253/259 为 warn（生成器尚未普遍声明
//   semanticEvidence），若要求 SEMANTIC_PASS 将阻断 98% 合法生成。当前
//   与 B2「接受 pass/warn/skip，拒绝 fail」一致。--require-semantic-pass
//   留作未来生成器普遍声明 semanticEvidence 后启用。
//
// 用法：
//   node dev/check-educational-generation.js                 # 921 对核心题型
//   node dev/check-educational-generation.js --extended      # 1299 对全题型（含 geometry/judge/calc/classify）
//   node dev/check-educational-generation.js --shard 1/3     # CI 分片（片 i 共 N 片）
//   node dev/check-educational-generation.js --cache         # 启用持久缓存（dev/reports/edu-gen-cache.json）
//   node dev/check-educational-generation.js --require-semantic-pass  # 未来严格模式（warn 也 FAIL）
//
// 产出：dev/p25/reports/educational-generation-report.json（提交，作 P25-17 diff 基线）

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');

// _bundle-env.js 装配 KBL Runtime / KnowledgeContext / strategy+presentation bundle 到 global；
// require 的副作用（挂载全局）是本脚本运行的前置条件，无返回值消费。
require(path.join(ROOT, 'dev', '_bundle-env.js'));
var KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
var QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
var PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
var KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));

var kpMatrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'kp-matrix.json'), 'utf8'));

// ---------- 参数 ----------
var args = process.argv.slice(2);
var EXTENDED = args.indexOf('--extended') !== -1;
var REQUIRE_SEMANTIC_PASS = args.indexOf('--require-semantic-pass') !== -1;
var USE_CACHE = args.indexOf('--cache') !== -1;

// 自定义报告路径（测试用，避免覆盖提交基线）
var REPORT_PATH = null;
for (var ri = 0; ri < args.length; ri++) {
  var rm = String(args[ri]).match(/^--report=(.+)$/);
  if (rm) { REPORT_PATH = path.resolve(ROOT, rm[1]); }
}

var CORE_QTS = ['apply', 'choice', 'fill'];
var ALL_TYPES = QTR.TYPES.map(function (t) { return t.id; });

// 分片
var SHARD_I = 1, SHARD_N = 1;
for (var ai = 0; ai < args.length; ai++) {
  var m = String(args[ai]).match(/^--shard=(\d+)\/(\d+)$/);
  if (m) { SHARD_I = parseInt(m[1], 10); SHARD_N = parseInt(m[2], 10); }
  var sm = String(args[ai]).match(/^--shard[=\s](\d+)\/(\d+)$/);
  if (sm) { SHARD_I = parseInt(sm[1], 10); SHARD_N = parseInt(sm[2], 10); }
}

// ---------- A 类 KP 枚举 ----------
var aClassKps = kpMatrix.kps.filter(function (k) { return k.draftSemanticLevel === 'A'; });

function gradeFromKpId(kpId) {
  var g = String(kpId || '').match(/math-g(\d)/);
  return g ? parseInt(g[1], 10) : 1;
}

function allowedQts(kpId) {
  var ev = KCV.buildEligibility([kpId], ALL_TYPES);
  var row = (ev.matrix && ev.matrix[kpId]) || {};
  var out = [];
  ALL_TYPES.forEach(function (t) { if (row[t] === 'ALLOW') out.push(t); });
  return out;
}

// 枚举 (kp, qt) 对
var pairs = [];
aClassKps.forEach(function (k) {
  var allowed = allowedQts(k.id);
  var qts = EXTENDED ? allowed : allowed.filter(function (qt) { return CORE_QTS.indexOf(qt) !== -1; });
  qts.forEach(function (qt) { pairs.push({ kp: k.id, grade: gradeFromKpId(k.id), qt: qt }); });
});

// 分片过滤
function shardIndex(idx, n) { return ((idx % n) + n) % n; }
var shardedPairs = pairs.filter(function (_, i) { return shardIndex(i, SHARD_N) === (SHARD_I - 1); });

// ---------- 持久缓存（可选） ----------
var cachePath = path.join(ROOT, 'dev', 'reports', 'edu-gen-cache.json');
var cache = {};
if (USE_CACHE && fs.existsSync(cachePath)) {
  try { cache = JSON.parse(fs.readFileSync(cachePath, 'utf8')); } catch (e) { cache = {}; }
}
function cacheKey(p) { return p.kp + '|' + p.qt; }

// ---------- 主循环 ----------
var buckets = {
  GENERATION_PASS: 0,
  SEMANTIC_PASS: 0,
  SEMANTIC_WARN: 0,
  SEMANTIC_FAIL: 0
};
var fails = [];
var details = [];
var done = 0;

function classify(sq, kpId) {
  if (!sq) return 'SEMANTIC_FAIL';
  var r = KpSemantic.checkSemanticEvidence(sq, kpId);
  if (r.state === 'pass') return 'SEMANTIC_PASS';
  if (r.state === 'warn') return 'SEMANTIC_WARN';
  if (r.state === 'skip') return 'GENERATION_PASS';
  return 'SEMANTIC_FAIL'; // fail
}

(async function run() {
  var total = shardedPairs.length;
  for (var i = 0; i < shardedPairs.length; i++) {
    var p = shardedPairs[i];
    var key = cacheKey(p);
    var state = null;
    var err = null;

    // 缓存命中（仅当启用 --cache）
    if (USE_CACHE && cache[key] && cache[key].state) {
      state = cache[key].state;
    } else {
      try {
        var session = new PracticeSession({
          subject: 'math', grade: p.grade, count: 1,
          knowledgePointId: p.kp, questionType: p.qt
        });
        await session.start();
        var qs = session.semanticQuestions || [];
        if (qs.length === 0) {
          state = 'SEMANTIC_FAIL';
          err = '0 questions';
        } else {
          state = classify(qs[0], p.kp, p.qt);
          if (state === 'SEMANTIC_FAIL') err = 'evidence=fail';
        }
      } catch (e) {
        state = 'SEMANTIC_FAIL';
        err = String((e && e.message) || e).slice(0, 120);
      }
      if (USE_CACHE) cache[key] = { state: state, err: err };
    }

    buckets[state] = (buckets[state] || 0) + 1;
    if (state === 'SEMANTIC_FAIL') {
      fails.push({ kp: p.kp, qt: p.qt, err: err });
    }
    details.push({ kp: p.kp, qt: p.qt, state: state });
    done++;
    if (done % 100 === 0) process.stdout.write('\r  进度 ' + done + '/' + total + '   ');
  }
  process.stdout.write('\r  进度 ' + done + '/' + total + '          \n');

  // 写缓存
  if (USE_CACHE) {
    if (!fs.existsSync(path.dirname(cachePath))) {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    }
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
  }

  // ---------- 报告 ----------
  var passCount = buckets.GENERATION_PASS + buckets.SEMANTIC_PASS + buckets.SEMANTIC_WARN;
  var failCount = buckets.SEMANTIC_FAIL;
  var strictPassCount = buckets.GENERATION_PASS + buckets.SEMANTIC_PASS;

  var report = {
    schemaVersion: 'p25-15-edu-gen-v1',
    generatedAt: new Date().toISOString(),
    config: {
      extended: EXTENDED,
      requireSemanticPass: REQUIRE_SEMANTIC_PASS,
      shard: SHARD_I + '/' + SHARD_N,
      cache: USE_CACHE
    },
    scope: {
      aClassKps: aClassKps.length,
      coreQuestionTypes: CORE_QTS,
      pairsTotal: pairs.length,
      pairsSharded: shardedPairs.length
    },
    summary: {
      total: done,
      generationPass: buckets.GENERATION_PASS,
      semanticPass: buckets.SEMANTIC_PASS,
      semanticWarn: buckets.SEMANTIC_WARN,
      semanticFail: buckets.SEMANTIC_FAIL,
      pass: passCount,
      fail: failCount,
      strictPass: strictPassCount
    },
    fails: fails.slice(0, 200),
    details: SHARD_N > 1 || EXTENDED ? null : details
  };

  var reportPath = REPORT_PATH || path.join(ROOT, 'dev', 'p25', 'reports', 'educational-generation-report.json');
  var reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('P25-15 教育真实性门禁');
  console.log('  A 类 KP：' + aClassKps.length + '，对数：' + shardedPairs.length +
    (SHARD_N > 1 ? '（片 ' + SHARD_I + '/' + SHARD_N + '）' : '') +
    (EXTENDED ? ' [extended 全题型]' : ' [核心题型 apply/choice/fill]'));
  console.log('  GENERATION_PASS：' + buckets.GENERATION_PASS);
  console.log('  SEMANTIC_PASS  ：' + buckets.SEMANTIC_PASS);
  console.log('  SEMANTIC_WARN  ：' + buckets.SEMANTIC_WARN);
  console.log('  SEMANTIC_FAIL  ：' + buckets.SEMANTIC_FAIL);
  console.log('  合计 PASS ' + passCount + ' / FAIL ' + failCount);
  if (fails.length) {
    console.log('  失败样例（前 30）：');
    fails.slice(0, 30).forEach(function (f) {
      console.log('    ✗ ' + f.kp + ' ' + f.qt + (f.err ? ' — ' + f.err : ''));
    });
    if (fails.length > 30) console.log('    …另有 ' + (fails.length - 30) + ' 项失败');
  }
  console.log('  报告：' + path.relative(ROOT, reportPath));

  var shouldFail = failCount > 0;
  if (REQUIRE_SEMANTIC_PASS && buckets.SEMANTIC_WARN > 0) {
    shouldFail = true;
    console.log('  [--require-semantic-pass] ' + buckets.SEMANTIC_WARN + ' 个 warn 视为 FAIL');
  }
  if (shouldFail) process.exit(1);
})();
