// dev/audit/stress-probe.js
/**
 * V4.1 Phase 13 — 压力探针（只读）
 *
 * 用户规格：10 代 × 20 题 = 200 题；若题库空间允许，跨代不重复。
 * 进一步：20 代 × 20 题 = 400 题跨代不重复。
 *
 * 统计：
 *   total / unique / duplicates / duplicateRate / failedPlans / retry 次数 / generationId 数
 *
 * 理想：total=200/400 unique=200/400 duplicate=0 generationId=10/20
 *
 * 已知缺陷（如实记录）：
 *   DEFECT-001：previousSeenKeys 仅滚动上一代 → 跨非邻代大量重复
 *
 * 输出：dev/reports/stress-probe-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

var GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
var Dup = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));

var KP = 'math-g1-m1-addsub-10';

function fpsOf(qs) {
  return new Set((qs || []).map(function (q) { return q.questionFingerprint || Dup.buildQuestionFingerprint(q); }));
}
function union(sets) { var u = new Set(); sets.forEach(function (s) { s.forEach(function (k) { u.add(k); }); }); return u.size; }
function intersect(a, b) { var n = 0; b.forEach(function (k) { if (a.has(k)) n++; }); return n; }

function runGenerations(numGens, perGen) {
  var generations = [];
  var accum = new Set();   // D001 修复后：累积全历史 seenKeys
  var prevGenId = null;
  var seq = Promise.resolve();
  var _loop = function (i) {
    seq = seq.then(function () {
      return GE.generate({ subject: 'math', grade: 1, mode: 'single-kp', knowledgePointId: KP, count: perGen, difficulty: 4 },
        accum.size > 0 ? { previousSeenKeys: accum, previousGenerationId: prevGenId } : {});
    }).then(function (g) {
      generations.push({
        index: i,
        generationId: g.generationId,
        count: (g.questions || []).length,
        fps: fpsOf(g.questions),
        failedPlans: (g.failedPlans || []).length
      });
      // D001 修复：累积本代 fps 入全局集（与 PracticeBridge._seenKeysAccum 一致）
      generations[generations.length - 1].fps.forEach(function (k) { accum.add(k); });
      prevGenId = g.generationId;
    }).catch(function (err) {
      // D005：空间饱和时 GE.generate 抛错（GENERATION_SPACE_EXHAUSTED）
      generations.push({
        index: i,
        generationId: null,
        count: 0,
        fps: new Set(),
        failedPlans: 1,
        saturationError: String(err && err.message || err)
      });
    });
  };
  for (var i = 0; i < numGens; i++) { _loop(i); }
  return seq.then(function () { return generations; });
}

function summarize(generations) {
  var totalCount = generations.reduce(function (s, g) { return s + g.count; }, 0);
  var allFps = generations.map(function (g) { return g.fps; });
  var globalUnique = union(allFps);
  var pairIntersections = [];
  for (var i = 1; i < generations.length; i++) {
    pairIntersections.push({ pair: 'G' + i + '_G' + (i + 1), intersection: intersect(generations[i - 1].fps, generations[i].fps) });
  }
  // 计算跨非邻代交集（如 G1 vs G3, G1 vs G5, ...）
  var nonAdjacentIntersections = [];
  for (var i = 0; i < generations.length; i++) {
    for (var j = i + 2; j < generations.length; j++) {
      var x = intersect(generations[i].fps, generations[j].fps);
      if (x > 0) nonAdjacentIntersections.push({ pair: 'G' + (i + 1) + '_G' + (j + 1), intersection: x });
    }
  }
  return {
    generations: generations.length,
    perGen: generations[0] ? generations[0].count : 0,
    totalQuestions: totalCount,
    globalUnique: globalUnique,
    globalDuplicates: totalCount - globalUnique,
    duplicateRate: ((totalCount - globalUnique) / totalCount * 100).toFixed(2) + '%',
    generationIds: generations.map(function (g) { return g.generationId; }).filter(Boolean),
    uniqueGenerationIds: new Set(generations.map(function (g) { return g.generationId; }).filter(Boolean)).size,
    allFailedPlans: generations.map(function (g) { return g.failedPlans; }),
    pairIntersectionsAdjacent: pairIntersections,
    nonAdjacentIntersectionsSample: nonAdjacentIntersections.slice(0, 20),
    nonAdjacentIntersectionCount: nonAdjacentIntersections.length
  };
}

function run() {
  var r200, r400;
  return runGenerations(10, 20).then(function (gens) {
    r200 = summarize(gens);
    return runGenerations(20, 20);
  }).then(function (gens) {
    r400 = summarize(gens);
    var report = {
      meta: {
        generatedAt: new Date().toISOString(),
        head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
        probe: 'dev/audit/stress-probe.js',
        knownDefect: 'DEFECT-001: previousSeenKeys 仅滚动上一代，跨非邻代重复'
      },
      n200: r200,
      n400: r400,
      verdict: (r200.globalDuplicates === 0 && r400.globalDuplicates === 0) ? 'PASS' :
               (r200.pairIntersectionsAdjacent.every(function (p) { return p.intersection === 0; }) &&
                r400.pairIntersectionsAdjacent.every(function (p) { return p.intersection === 0; })
                ? 'PASS_ADJACENT_ONLY_FAIL_GLOBAL' : 'FAIL')
    };
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'stress-probe-report.json'), JSON.stringify(report, null, 2));
    console.log('=== 压力探针 ===');
    console.log('--- 10 代 × 20 题 = 200 ---');
    console.log('  total=' + r200.totalQuestions + ' unique=' + r200.globalUnique + ' dup=' + r200.globalDuplicates + ' rate=' + r200.duplicateRate);
    console.log('  genIds count=' + r200.uniqueGenerationIds + ' allFailedPlans=' + JSON.stringify(r200.allFailedPlans));
    console.log('  adjacent pair intersections (all 0?): ' + r200.pairIntersectionsAdjacent.map(function (p) { return p.intersection; }).join(','));
    console.log('  non-adjacent intersecting pairs: ' + r200.nonAdjacentIntersectionCount);
    console.log('--- 20 代 × 20 题 = 400 ---');
    console.log('  total=' + r400.totalQuestions + ' unique=' + r400.globalUnique + ' dup=' + r400.globalDuplicates + ' rate=' + r400.duplicateRate);
    console.log('  non-adjacent intersecting pairs: ' + r400.nonAdjacentIntersectionCount);
    console.log('Verdict: ' + report.verdict);
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
