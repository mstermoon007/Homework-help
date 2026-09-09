// dev/audit/d007-repro-probe.js
/**
 * D007 复现探针：经 PracticeBridge 完整流程跑 5 代 × 20 题
 *
 * 目的：判断 D007（G3∩G4=20/20 完全相同）是代码 bug 还是浏览器环境特有
 *
 * 路径：PracticeBridge.start → PracticeSession.start → GenerationAPI.generate
 *   （与浏览器同路径，唯一差异：Node 用 require，浏览器用 script+bundle）
 *
 * 输出：dev/reports/d007-repro-report.json
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..', '..');

// 加载依赖到 global（Node require 链，非 bundle）
require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));
require(path.join(ROOT, 'shared', 'generation-engine.js'));
require(path.join(ROOT, 'shared', 'practice-session.js'));
require(path.join(ROOT, 'shared', 'practice-bridge.js'));

var Bridge = global.PracticeBridge;

function extractStems(qs) {
  return (qs || []).map(function (q) {
    var p = q.question && (q.question.prompt || q.question.stem);
    if (!p) p = q.prompt;
    if (!p) p = q.content && q.content.prompt;
    return String(p || '').trim();
  });
}

function intersect(a, b) {
  var setB = new Set(b);
  return a.filter(function (x) { return setB.has(x); }).length;
}

function run() {
  var generations = [];
  var seq = Promise.resolve();
  var _loop = function (i) {
    seq = seq.then(function () {
      return new Promise(function (resolve) {
        Bridge.onStartFeedback(function (fb) {
          if (fb && fb.ok) {
            var qs = fb.session && fb.session.lastSemantic && fb.session.lastSemantic.questions;
            var genId = fb.session && fb.session.lastSemantic && fb.session.lastSemantic.generationId;
            var stems = extractStems(qs);
            generations.push({ index: i, generationId: genId, stems: stems, count: stems.length });
          } else {
            generations.push({ index: i, error: fb && fb.error && fb.error.message });
          }
          resolve();
        });
        Bridge.start({
          state: { count: 20, difficulty: 4, kp: 'math-g1-m1-addsub-10', subject: 'math', grade: 1 },
          knowledgePointId: 'math-g1-m1-addsub-10'
        });
      });
    });
  };
  for (var i = 0; i < 5; i++) { _loop(i); }

  return seq.then(function () {
    var report = {
      meta: { probe: 'dev/audit/d007-repro-probe.js', head: '' },
      generations: generations.map(function (g) {
        return { index: g.index, generationId: g.generationId, count: g.count, stems: g.stems, error: g.error };
      }),
      adjacentIntersections: [],
      verdict: ''
    };
    report.meta.head = require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();

    for (var i = 1; i < generations.length; i++) {
      var inter = intersect(generations[i - 1].stems, generations[i].stems);
      report.adjacentIntersections.push({ pair: 'G' + i + '_G' + (i + 1), intersection: inter });
    }

    var anyAdjacentDup = report.adjacentIntersections.some(function (p) { return p.intersection > 0; });
    report.verdict = anyAdjacentDup ? 'FAIL (adjacent dup reproduced)' : 'PASS (no adjacent dup)';

    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'd007-repro-report.json'), JSON.stringify(report, null, 2));

    console.log('=== D007 复现探针（经 PracticeBridge）===');
    generations.forEach(function (g) {
      console.log('G' + (g.index + 1) + ': genId=' + g.generationId + ' count=' + g.count + (g.error ? ' err=' + g.error : ''));
    });
    console.log('--- adjacent intersections ---');
    report.adjacentIntersections.forEach(function (p) {
      console.log('  ' + p.pair + ': ' + p.intersection);
    });
    console.log('Verdict: ' + report.verdict);
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
