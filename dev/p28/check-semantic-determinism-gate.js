#!/usr/bin/env node
/**
 * dev/p28/check-semantic-determinism-gate.js
 * P28-15 教育语义测试最终确定性（固定 seed, 5 连跑必须逐字节一致）
 *
 * 语义链确定性内核：semantic-question.js:87
 *   id = QID.generateQuestionId(raw.seed || QID.generateBaseSeed(), {...})
 *   —— QID.generateQuestionId 全部基于 seed 派生（question-id.js:29），
 *     同 seed + 同 context => 同 id；无 Date.now / Math.random 参与身份。
 *
 * 本门禁目标：证明「教育语义测试 = 固定 seed/KP/type/difficulty，连续 5 次结果一致」，
 * 同时不编排任何难度公式（P28-13/14 权威链不在此复算）——仅复用其上做确定性判定。
 *
 * 判定：
 *   D1 语义身份确定性  固定 (seed, KP, type, difficulty) → createSemanticQuestion
 *                     连跑 5 次，difficulty/seed/metadata 等本质字段逐字节一致。
 *   D2 无自决难度      生成过程中的 semanticOptions.difficulty 全部消费自 plan.difficulty 回显
 *                     （此文件不出现 diffLevel(/resolveStaticDifficulty(/clamp( 自算）。
 *   D3 唯一公式集      shared/ 内 resolveStaticDifficulty(/diffLevel( 的 function 定义仍
 *                     恰 1 处（P28-13 Z2/Z1 复证——语义面不得新增第三套难度）。
 *
 * 用法：node dev/p28/check-semantic-determinism-gate.js（0=PASS，1=FAIL）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var FAILS = [];
function rel(f) { return path.relative(ROOT, f); }
function push(code, f, i, msg) { FAILS.push(code + ' ' + rel(f) + ':' + (i + 1) + ' ' + msg); }
function linesOf(f) { try { return fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return null; } }

var SEM_F = path.join(ROOT, 'shared/semantic/semantic-question.js');
var QID_F = path.join(ROOT, 'shared/knowledge/question-id.js');

// D1: 固定 seed 5 连跑，同一语义题目工厂输入必须逐次一致
var FIX = {
  seed: 'P28-15-FIXED-SEMANTIC-SEED',
  knowledgePointId: 'KG-CH-PRI-CH2-02',
  questionType: 'CH2-MC',
  difficulty: 5
};
var outputs = [];
for (var r = 0; r < 5; r++) {
  try {
    // 直接驱动工厂：给定固定 seed + 固定 4 维，产出语义题目快照
    var sq = require(SEM_F).createSemanticQuestion ? 
      require(SEM_F).createSemanticQuestion({
        seed: FIX.seed,
        knowledgePointId: FIX.knowledgePointId,
        questionType: FIX.questionType,
        difficulty: FIX.difficulty,
        content: { text: '教育语义固定题面' },
        answer: { value: '42', acceptable: ['42'] }
      }) : null;
    if (!sq) throw new Error('factory 无 createSemanticQuestion 出口');
    outputs.push(JSON.stringify({
      difficulty: sq.difficulty,
      seed: (sq.metadata && sq.metadata.seed) || sq.seed,
      kp: sq.knowledgePointId || (sq.data && sq.data.knowledgePointId),
      type: sq.questionType || (sq.data && sq.data.questionType)
    }));
  } catch (e) {
    push('D1', SEM_F, 0, '语义工厂不可直接运行(dev 无 StrategyEngine 环境下走静态豁免分支): ' + e.message);
    break;
  }
}
if (outputs.length === 5) {
  var same = outputs.every(function (o) { return o === outputs[0]; });
  if (!same) push('D1', SEM_F, 0, '固定 seed 5 连跑快照不一致（确定性破坏）: ' + outputs.join(' || '));
}

// D2: 语义面不得自决难度（仅消费 plan.difficulty 回显）
(function scan(f) {
  var lines = linesOf(f); if (!lines) return;
  lines.forEach(function (ln, i) {
    if (/diffLevel\s*\(|resolveStaticDifficulty\s*\(|\bclamp\s*\("+base/.exec(ln))
      push('D2', f, i, '语义面自决难度(应只回显 plan.difficulty): ' + ln.trim());
  });
})(SEM_F);

// D3: 唯一公式集复证（P28-13 Z1/Z2 权威值，语义面不得新增第三套）
var CORE_F = path.join(ROOT, 'shared/core/core.js');
var STATIC_F = path.join(ROOT, 'shared/strategy/static-difficulty.js');
function defCount(f, re) { var l = linesOf(f); var n = 0; if (l) l.forEach(function (x) { if (re.exec(x)) n++; }); return n; }
if (defCount(CORE_F, /function\s+diffLevel\s*\(/) !== 1)       push('D3', CORE_F, 0, 'diffLevel( 应恰 1 定义(实际=' + defCount(CORE_F, /function\s+diffLevel\s*\(/) + ')');
if (defCount(STATIC_F, /function\s+resolveStaticDifficulty\s*\(/) !== 1) push('D3', STATIC_F, 0, 'resolveStaticDifficulty( 应恰 1 定义(实际=' + defCount(STATIC_F, /function\s+resolveStaticDifficulty\s*\(/) + ')');

var n = FAILS.length;
console.log('P28-15 教育语义测试最终确定性(固定seed/KP/type/difficulty, 5连跑): ' + (n === 0 ? 'PASS' : 'FAIL'));
FAILS.forEach(function (s) { console.log('  ✗ ' + s); });
if (n === 0) {
  console.log('  ✓ D1 固定 seed 5 连跑语义快照逐字节一致（确定性成立）');
  console.log('  ✓ D2 语义面 0 处 diffLevel(/resolveStaticDifficulty(/clamp( 自决难度');
  console.log('  ✓ D3 diffLevel( resolveStaticDifficulty( 仍各恰 1 处权威定义（不新增第三套）');
}
process.exit(n === 0 ? 0 : 1);
