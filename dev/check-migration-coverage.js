#!/usr/bin/env node
/**
 * dev/check-migration-coverage.js — M4-R17 迁移候选逐 KP 原生覆盖分析
 *
 * 目的：R15 等价测试每个插件采样 3 个 KP；迁移必须【全部 KP】皆可由 native
 * 自洽覆盖（生成、不越界、答案自洽、无重复、可渲染、满足 Plan）。
 * 该工具对候选插件逐一 KP × 难度 × seed 运行 native 生成并做 R16 语义自检，
 * 产出 KP 级覆盖结论：FULL / PARTIAL / NONE，供第一批迁移选批。
 */
'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.join(__dirname, '..');
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var CoreGen = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
var GraphicRenderer = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));
var SP = require(path.join(ROOT, 'dev', 'semantic-parse.js'));

var NATIVE_TARGET = {
  calc: 'generator:arithmetic-mixed-calculation',
  oral: 'generator:arithmetic-mixed-calculation',
  fill: 'generator:selection-fill',
  choice: 'generator:selection-choice',
  judge: 'generator:selection-judge'
};

var DIFFICULTIES = [2, 5, 8];
var SEEDS = ['migr-a', 'migr-b'];
var BATCH = 4;
var CANDIDATES = process.argv[2] ? process.argv[2].split(',')
  : ['math-oral', 'math-g1-multiplication-table', 'math-g4-vertical', 'math-g4-stats', 'math-g6-picture-equation', 'math-g6-choice'];

function nativeSelfCheck(questions, plan, generatorId) {
  var fail = [];
  var range = (plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
  var aw = 0, oob = 0, na = 0;
  var seen = {};

  if (!Array.isArray(questions) || questions.length === 0) return { fail: ['未生成'], ok: false };

  questions.forEach(function (q) {
    var p = SP.parseExpression(q.prompt);
    if (p) {
      p.operands.forEach(function (v) {
        if (v < range.min || v > range.max) oob++;
      });
    }
    var a = SP.answerIsCorrect(q);
    if (a === false) aw++;
    if (a === 'n/a') na++;
    var k = String(q.prompt);
    if (seen[k]) fail.push('重复 prompt');
    seen[k] = true;
    if (q.knowledgePointId != null && q.knowledgePointId !== plan.knowledgePointId) fail.push('kp 不匹配');
  });

  var hasGraphic = questions.some(function (q) { return q.graphic && q.graphic.type; });
  if (hasGraphic && !questions.every(function (q) { return !q.graphic || !q.graphic.type || GraphicRenderer.isSupported(q.graphic.type); })) fail.push('不可渲染图形');

  if (oob > 0) fail.push('越界 ' + oob);
  if (aw > 0) fail.push('答案错误 ' + aw + '（另 ' + na + ' 无法判定）');
  else if (na > 0) fail.push('答案无法判定 ' + na);

  return { fail: fail, ok: fail.length === 0 };
}

async function main() {
  var recs = GenCap.buildGeneratorCapabilityRegistry();
  var rows = [];

  for (var i = 0; i < recs.length; i++) {
    var rec = recs[i];
    if (CANDIDATES.indexOf(rec.pluginId) === -1) continue;

    var row = { pluginId: rec.pluginId, kps: [], nativeKpOk: 0, nativeKpTotalOk: 0, summary: null };
    rec.knowledgePoints.forEach(function (kpId) {
      var kpRow = { kpId: kpId, qts: {}, best: null, ok: 0, total: 0 };
      (rec.questionTypes || []).forEach(function (qt) {
        var targetId = NATIVE_TARGET[qt];
        if (!targetId) return;
        var gen = CoreGen.get(targetId);
        if (!gen) return;
        var results = [];
        DIFFICULTIES.forEach(function (d) {
          SEEDS.forEach(function (s) {
            var plan;
            try {
              plan = Engine.plan({ knowledgePointId: kpId, questionType: qt, count: BATCH, difficulty: d }).plans[0];
            } catch (e) { return; }
            var r = { difficulty: d, seed: s, ok: false, fail: [] };
            try {
              var out = gen.generate(plan, { seed: s });
              r = nativeSelfCheck(out, plan, targetId);
              r.difficulty = d; r.seed = s;
            } catch (e) {
              r.fail = ['崩溃: ' + e.message];
            }
            results.push(r);
          });
        });
        var okCount = results.filter(function (r) { return r.ok; }).length;
        kpRow.qts[qt] = { target: targetId, total: results.length, ok: okCount, diag: results.length === okCount ? null : (results.find(function (r) { return !r.ok; }) || {}).fail };
        if (okCount > 0) kpRow.ok++;
        kpRow.total++;
      });
      kpRow.best = kpRow.ok === kpRow.total && kpRow.total > 0 ? 'FULL' : (kpRow.ok > 0 ? 'PARTIAL' : 'NONE');
      if (kpRow.best === 'FULL') { row.nativeKpOk++; row.nativeKpTotalOk++; }
      else if (kpRow.best === 'PARTIAL') row.nativeKpTotalOk++;
      row.kps.push(kpRow);
    });
    var none = row.kps.filter(function (k) { return k.best === 'NONE'; }).length;
    row.summary = row.kps.length === 0 ? 'NO_KP' : (row.nativeKpOk === row.kps.length ? 'FULL' : (none === row.kps.length ? 'NONE' : 'PARTIAL'));
    rows.push(row);
  }

  // 输出
  console.log('M4-R17 迁移候选 KP 级原生覆盖');
  console.log('');
  rows.forEach(function (r) {
    console.log('=== ' + r.pluginId + '  [' + r.summary + ']  全灰 KP=' + r.nativeKpOk + '/' + r.kps.length);
    r.kps.forEach(function (k) {
      var qs = Object.keys(k.qts).map(function (qt) {
        var q = k.qts[qt];
        return qt + ':' + q.ok + '/' + q.total + (q.diag && q.diag.length ? '(' + q.diag.slice(0, 2).join(';') + ')' : '');
      }).join('  ');
      console.log('  ' + k.kpId.padEnd(34) + k.best.padEnd(9) + qs);
    });
  });
  console.log('');
  var ok = rows.length > 0 && rows.some(function (r) { return r.summary === 'FULL'; });
  console.log(ok ? '[PASS] M4-R17 迁移覆盖分析' : '[WARN] M4-R17 无 FULL 覆盖候选');
  process.exitCode = ok ? 0 : 1;
}

main().catch(function (e) { console.error(e.stack); process.exitCode = 1; });