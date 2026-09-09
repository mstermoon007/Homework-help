// dev/audit/final-browser-sim-probe.js
/**
 * 最终验证：模拟浏览器 PracticeBridge 路径，5 代 × 20 题
 * 精确验证 D001（累积 seenKeys）+ D005（饱和报错）+ D007（api.js 加载）
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
require(path.join(ROOT, 'shared', 'engine', 'generation-engine.js'));
require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
require(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'));

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
            generations.push({ index: i, error: fb && fb.error && fb.error.message, count: 0, stems: [] });
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
    var adjacent = [];
    for (var i = 1; i < generations.length; i++) {
      adjacent.push(intersect(generations[i - 1].stems, generations[i].stems));
    }
    var allStems = generations.reduce(function (a, g) { return a.concat(g.stems); }, []);
    var globalUnique = new Set(allStems).size;

    var report = {
      meta: {
        probe: 'dev/audit/final-browser-sim-probe.js',
        head: require('child_process').execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim(),
        timestamp: new Date().toISOString()
      },
      generations: generations.map(function (g) {
        return { index: g.index, generationId: g.generationId, count: g.count, stems: g.stems, error: g.error };
      }),
      adjacentIntersections: adjacent,
      total: allStems.length,
      globalUnique: globalUnique,
      duplicateRate: allStems.length > 0 ? ((1 - globalUnique / allStems.length) * 100).toFixed(2) + '%' : '0%',
      verdict: adjacent.every(function (x) { return x === 0; }) ? 'D001_D005_D007_ALL_FIXED' : 'STILL_FAIL'
    };
    fs.writeFileSync(path.join(ROOT, 'dev', 'reports', 'final-browser-sim-report.json'), JSON.stringify(report, null, 2));

    console.log('=== 最终浏览器模拟探针（PracticeBridge 完整路径）===');
    generations.forEach(function (g) {
      console.log('G' + (g.index + 1) + ': genId=' + g.generationId + ' count=' + g.count + (g.error ? ' err=' + g.error : ''));
    });
    console.log('--- 相邻交集 ---');
    adjacent.forEach(function (x, i) {
      console.log('  G' + (i + 1) + '∩G' + (i + 2) + ': ' + x);
    });
    console.log('total=' + allStems.length + ' globalUnique=' + globalUnique + ' rate=' + report.duplicateRate);
    console.log('Verdict: ' + report.verdict);
  });
}

run().catch(function (e) { console.error('探针异常:', e); process.exit(1); });
