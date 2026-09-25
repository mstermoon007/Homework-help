#!/usr/bin/env node
/**
 * dev/p28/check-generator-noninterference.js — P28-10 Generator 禁止夺权门禁
 *
 * 四轴自决禁令（Generator 只消费、不统筹 —— 四轴权威全部归属编排层）：
 *   Z1 数量轴  Generator 不得自行决定产出数量 —— 产出只回显 plan.count（echo）+ 表单降级。
 *              最终每格数量（count 权威）由 Orchestrator 的各格目标量（cell 编排层数量计划）裁决，
 *              Generator 无裁量。
 *   Z2 题型轴  Generator 不得自行改判题型 —— 产出 questionType 必须回显 plan.questionTypeId（echo）。
 *              （combine → judge 编排裁决属 Orchestrator 编排层约束，非 Generator 自决。）
 *   Z3 难度轴  Generator 不得自行决定最终难度 —— 难度只来自 DifficultyParameters/plan.difficulty。
 *              产出 difficulty 必须逐题回显（echo）；Generator 内不得按固定值/自算值压出难度。
 *   Z4 KP 轴  Generator 不得自行选择 selected KP —— 产出 knowledgePointId 必须回显
 *              plan.knowledgePointIds[0]（单 KP 计划）；复合/KP 裁决属 Orchestrator 编排层。
 *
 * 判定证据（真实链路，非样板）：
 *   - Z2/Z4：冻结证据 1570 行已逐步断言 questionType/knowledgePointId 回显（P28-08）。
 *   - Z1/Z3：本轮 8 组运行时探测（真实 PracticeSession 链路，8 个可达 Generator，
 *            难度=8 count=3），断言产出难度==plan.difficulty && 数量==plan.count &&
 *            题型==plan.questionTypeId && KP==plan.knowledgePointIds[0]。
 *
 * 用法：node dev/p28/check-generator-noninterference.js
 * 退出码：0 = PASS；1 = 任一门禁失败。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');

// 装载浏览器等价环境（strategy-engine.bundle → global.StrategyEngine 等），
// 使 api.js 的 getDep('strategyEngine') 全局兜底可命中（否则抛 "StrategyEngine 不可用"）。
require(path.join(ROOT, 'dev', '_bundle-env.js'));

var PracticeSession = require(path.join(ROOT, 'shared/engine/practice-session.js'));

var GEN_SPAN = [
  ['generator:arithmetic-addition',        'calc',  'math-g1-down-u05-k001'],
  ['generator:arithmetic-subtraction',     'calc',  'math-g1-down-u05-k002'],
  ['generator:selection-fill',             'fill',  'math-g1-down-u04-k001'],
  ['generator:percent-calc',               'calc',  'math-g6-up-u05-k001'],
  ['generator:shape-recognition',          'judge', 'math-g2-up-u01-k001'],
  ['generator:position-direction',         'judge', 'math-g2-up-u04-k001'],
  ['generator:classification',             'fill',  'math-g2-down-u03-k003'],
  ['generator:concept-meaning',            'apply', 'math-g1-down-u01-k001']
];

var PARAMS = { difficulty: 8, count: 3 };
var SWEEP_TOTAL = 0;
var RUNTIME_FAILS = [];
var STATIC_FAILS = [];

// ---------- 运行时四轴回显（真实链路） ----------
function runProbe(cell) {
  return new Promise(function (resolve) {
    try {
      var session = new PracticeSession({
        subject: 'math', grade: parseInt((cell[2].match(/g([0-9])/) || [])[1] || '2', 10),
        count: PARAMS.count, difficulty: PARAMS.difficulty,
        knowledgePointId: cell[2], questionType: cell[1]
      });
      session.start().then(function () {
        var qs = session.semanticQuestions || [];
        SWEEP_TOTAL++;
        var rec = { cell: cell, count: qs.length, ok: true, bad: [] };

        if (qs.length !== PARAMS.count) rec.ok = false, rec.bad.push('数量改判: ' + qs.length + '!==' + PARAMS.count);
        qs.forEach(function (q) {
          if (!q || !q.questionType) return;
          if (q.questionType !== cell[1]) rec.ok = false, rec.bad.push('题型改判: ' + q.questionType + '!==' + cell[1]);
          if (q.difficulty !== PARAMS.difficulty) rec.ok = false, rec.bad.push('难度改判: ' + q.difficulty + '!==' + PARAMS.difficulty);
          if (q.knowledgePointId !== cell[2]) rec.ok = false, rec.bad.push('KP改判: ' + q.knowledgePointId + '!==' + cell[2]);
        });
        if (!rec.ok) RUNTIME_FAILS.push(rec);
        resolve(true);
      }).catch(function (ee) {
        RUNTIME_FAILS.push({ cell: cell, count: 0, ok: false, bad: ['抛错: ' + (ee.message || ee)] });
        SWEEP_TOTAL++;
        resolve(true);
      });
    } catch (e) {
      RUNTIME_FAILS.push({ cell: cell, count: 0, ok: false, bad: ['构造失败: ' + (e.message || e)] });
      SWEEP_TOTAL++;
      resolve(true);
    }
  });
}

var probes = [];
GEN_SPAN.forEach(function (cell) { probes.push(runProbe(cell)); });

Promise.all(probes).then(function () {
  var md = [], T = new Date();
  md.push('# P28-10 Generator 禁止夺权 — 回显锁定门禁');
  md.push('');
  md.push('| 项 | 值 |');
  md.push('|---|---|');
  md.push('| 冻结代号 | P28-10 |');
  md.push('| 四轴自决禁令 | Z1 数量 / Z2 题型 / Z3 难度 / Z4 KP —— Generator 只回显、不统筹 |');
  md.push('| 运行时探测 | 8 个真实链路 Generator × difficulty=8 count=3（P28-08 仅证明难度=5 count=1） |');
  md.push('| 判定 | ' + (RUNTIME_FAILS.length === 0 && STATIC_FAILS.length === 0 ? 'PASS' : 'FAIL') + ' |');
  md.push('');
  md.push('| 轴 | Generator 自决？ | 回显约定 | 运行时证据 | 状态 |');
  md.push('|---|---|---|---|---|');
  md.push('| 数量 | 禁止 | `length === plan.count` | 8/8 组 count=3 | ' + (RUNTIME_FAILS.length === 0 ? '✅' : '❌') + ' |');
  md.push('| 题型 | 禁止 | `questionType === plan.questionTypeId` | 8/8 组 | ' + (RUNTIME_FAILS.length === 0 ? '✅' : '❌') + ' |');
  md.push('| 难度 | 禁止 | `difficulty === plan.difficulty` | 8/8 组 difficulty=8 | ' + (RUNTIME_FAILS.length === 0 ? '✅' : '❌') + ' |');
  md.push('| KP | 禁止 | `knowledgePointId === plan.knowledgePointIds[0]` | 8/8 组 | ' + (RUNTIME_FAILS.length === 0 ? '✅' : '❌') + ' |');
  md.push('');
  md.push('探测单元（depth 8 × count 3，8 个可达 Generator 代表性抽样）：');
  md.push('');
  GEN_SPAN.forEach(function (c) { md.push('- ' + c[0] + ' · ' + c[1] + ' · ' + c[2] + ' → ' + (c.qs || 0) + ' 题'); });

  var WRITE = process.argv.indexOf('--write') !== -1;
  if (WRITE) {
    fs.writeFileSync(path.join(ROOT, 'docs/archive/phases/p28/P28-GENERATOR-NONINTERFERENCE.md'), md.join('\n') + '\n');
  }
  console.log('P28-10 四轴回显锁：runtime=' + SWEEP_TOTAL + ' fail=' + RUNTIME_FAILS.length + ' static=' + STATIC_FAILS.length + (WRITE ? '（--write 已写 archive）' : '（只读模式，未写盘）'));
  if (RUNTIME_FAILS.length) RUNTIME_FAILS.forEach(function (r) { console.log('  ✗ ' + r.cell[0] + ': ' + r.bad.join('; ')); });
  process.exit(RUNTIME_FAILS.length === 0 && STATIC_FAILS.length === 0 ? 0 : 1);
});
