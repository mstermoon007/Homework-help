// dev/audit/c2-dedup-stats-probe.js
/**
 * V4.1 Phase 4 — C2 去重统计探针（只读）
 *
 * 用户原计划：
 *   4.1 单批次：10 / 20 / 30 / 50 题，统计 total/unique/duplicate/duplicateRate
 *   4.2 跨 Plan：A=5+B=5+C=5 题，A∩B / A∩C / B∩C 必须 = 0
 *   压力：10 代 × 20 题 = 200 题，全局 unique=200/duplicate=0
 *
 * 实现：直接调用 GenerationEngine.generate()，统计 questionFingerprint 集合。
 *   跨代用 previousSeenKeys 滚动注入（与 cross-generation-dedup.test.js 同手法）。
 *
 * 输出：dev/reports/c2-dedup-stats-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'engine', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

var GE = require(path.join(ROOT, 'shared', 'engine', 'generation-engine.js'));
var Dup = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));

var KP_G1 = 'math-g1-m1-addsub-10';
var KP_MAKE_TEN = 'math-g1-m0-make-ten';
var KP_G2 = 'math-g2-m1-add-100';

function fpsOf(qs) {
  return new Set((qs || []).map(function (q) { return q.questionFingerprint || Dup.buildQuestionFingerprint(q); }));
}
function intersection(a, b) {
  var n = 0; b.forEach(function (k) { if (a.has(k)) n++; }); return n;
}
function unionCount(sets) {
  var u = new Set();
  sets.forEach(function (s) { s.forEach(function (k) { u.add(k); }); });
  return u.size;
}

function gen(req, opts) {
  return GE.generate(req, opts || {}).then(function (g) {
    return {
      questions: g.questions,
      count: (g.questions || []).length,
      fps: fpsOf(g.questions),
      failedPlans: (g.failedPlans || []).length,
      generationId: g.generationId || null
    };
  });
}

function run() {
  var report = { meta: { generatedAt: new Date().toISOString(), head: '', probe: 'dev/audit/c2-dedup-stats-probe.js' }, sections: {} };
  report.meta.head = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();

  // === 4.1 单批次：10/20/30/50 ===
  var batchSizes = [10, 20, 30, 50];
  var batchStats = [];
  var seq = Promise.resolve();
  batchSizes.forEach(function (n) {
    seq = seq.then(function () {
      return gen({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP_G1, count: n, difficulty: 4 });
    }).then(function (r) {
      batchStats.push({
        size: n,
        total: r.count,
        unique: r.fps.size,
        duplicates: r.count - r.fps.size,
        duplicateRate: ((r.count - r.fps.size) / r.count * 100).toFixed(2) + '%',
        failedPlans: r.failedPlans
      });
    });
  });

  // === 4.2 跨 Plan：A=5+B=5+C=5，A∩B / A∩C / B∩C = 0 ===
  // 用 combine=false + multi-kp；每个 plan 独立 generate（不同 KP）
  var planKps = [KP_G1, KP_MAKE_TEN, KP_G2];
  var planResults = [];
  seq = seq.then(function () { return gen({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: planKps[0], count: 5, difficulty: 4 }); })
    .then(function (rA) { planResults.push(rA); return gen({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: planKps[1], count: 5, difficulty: 4 }); })
    .then(function (rB) { planResults.push(rB); return gen({ subject: 'math', grade: 2, mode: 'single-kp', knowledgePointId: planKps[2], count: 5, difficulty: 4 }); })
    .then(function (rC) {
      planResults.push(rC);
      report.sections.crossPlan = {
        A: { kp: planKps[0], count: planResults[0].count, fps: Array.from(planResults[0].fps) },
        B: { kp: planKps[1], count: planResults[1].count, fps: Array.from(planResults[1].fps) },
        C: { kp: planKps[2], count: planResults[2].count, fps: Array.from(planResults[2].fps) },
        intersection_AB: intersection(planResults[0].fps, planResults[1].fps),
        intersection_AC: intersection(planResults[0].fps, planResults[2].fps),
        intersection_BC: intersection(planResults[1].fps, planResults[2].fps),
        expectation: '0/0/0'
      };
    });

  // === 4.3 跨代：10 代 × 20 题 = 200 题，全局 unique=200/duplicate=0 ===
  // D001 修复后探针改为累积 seenKeys（与 PracticeBridge._seenKeysAccum 一致），
  // 不再只传上一代 fps。
  seq = seq.then(function () {
    var generations = [];
    var accum = new Set();  // 累积全历史
    var prevGenId = null;
    var chain = Promise.resolve();
    var _loopGen = function (i) {
      chain = chain.then(function () {
        return gen({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP_G1, count: 20, difficulty: 4 },
          accum.size > 0 ? { previousSeenKeys: accum, previousGenerationId: prevGenId } : {});
      }).then(function (r) {
        generations.push(r);
        // 累积本代 fps
        r.fps.forEach(function (k) { accum.add(k); });
        prevGenId = r.generationId || 'gen-' + i;
      }).catch(function (err) {
        // D005：空间饱和时 GE.generate 抛错（GENERATION_SPACE_EXHAUSTED）
        generations.push({ error: String(err && err.message || err), count: 0, fps: new Set(), index: i });
      });
    };
    for (var i = 0; i < 10; i++) { _loopGen(i); }
    return chain.then(function () {
      var allFps = generations.map(function (g) { return g.fps; });
      var globalUnique = unionCount(allFps);
      var totalCount = generations.reduce(function (s, g) { return s + g.count; }, 0);
      // 检查相邻代际交集 + 全局重复
      var pairIntersections = [];
      for (var i = 1; i < generations.length; i++) {
        pairIntersections.push({ pair: 'G' + i + '_G' + (i + 1), intersection: intersection(generations[i - 1].fps, generations[i].fps) });
      }
      report.sections.crossGeneration = {
        generations: 10,
        perGenCount: 20,
        totalQuestions: totalCount,
        globalUnique: globalUnique,
        globalDuplicates: totalCount - globalUnique,
        duplicateRate: ((totalCount - globalUnique) / totalCount * 100).toFixed(2) + '%',
        pairIntersections: pairIntersections,
        allGenerationIds: generations.map(function (g) { return g.generationId; }),
        allFailedPlans: generations.map(function (g) { return g.failedPlans; }),
        expectation: 'globalUnique=200, duplicateRate=0%'
      };
    });
  });

  return seq.then(function () {
    report.sections.batchSizes = batchStats;
    var batchPass = batchStats.every(function (s) { return s.duplicates === 0 && s.failedPlans === 0; });
    var crossPlanPass = report.sections.crossPlan.intersection_AB === 0 && report.sections.crossPlan.intersection_AC === 0 && report.sections.crossPlan.intersection_BC === 0;
    var crossGenPass = report.sections.crossGeneration.globalDuplicates === 0 && report.sections.crossGeneration.pairIntersections.every(function (p) { return p.intersection === 0; });
    report.verdict = (batchPass && crossPlanPass && crossGenPass) ? 'PASS' : 'FAIL';
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'c2-dedup-stats-report.json'), JSON.stringify(report, null, 2));

    console.log('=== C2 去重统计探针 ===');
    console.log('--- 4.1 单批次 ---');
    batchStats.forEach(function (s) {
      console.log('  ' + s.size + ' 题: total=' + s.total + ' unique=' + s.unique + ' dup=' + s.duplicates + ' rate=' + s.duplicateRate + ' failed=' + s.failedPlans);
    });
    console.log('--- 4.2 跨 Plan ---');
    console.log('  A∩B=' + report.sections.crossPlan.intersection_AB + ' A∩C=' + report.sections.crossPlan.intersection_AC + ' B∩C=' + report.sections.crossPlan.intersection_BC);
    console.log('--- 4.3 跨代 10×20=200 ---');
    console.log('  total=' + report.sections.crossGeneration.totalQuestions + ' globalUnique=' + report.sections.crossGeneration.globalUnique + ' dup=' + report.sections.crossGeneration.globalDuplicates + ' rate=' + report.sections.crossGeneration.duplicateRate);
    console.log('  pairIntersections(all 0): ' + report.sections.crossGeneration.pairIntersections.map(function (p) { return p.intersection; }).join(','));
    console.log('Verdict: ' + report.verdict);
    console.log('报告: dev/reports/c2-dedup-stats-report.json');
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
