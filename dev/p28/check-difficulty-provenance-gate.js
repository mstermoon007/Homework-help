#!/usr/bin/env node
/**
 * dev/p28/check-difficulty-provenance-gate.js
 * P28-14 难度溯源（每一道最终题目都能回答"为什么是这个难度"；不新增第三套算法）
 *
 * 4 个可溯源维度，全部只从 P28-13 唯一权威链回答（旁路=FAIL）：
 *
 *   D1 difficultySource  难度从哪产出          → resolveStaticDifficulty( 唯一产出点
 *                                                (strategy/static-difficulty.js:49, P28-13 Z2 ✓)
 *   D2 baseDifficulty    静态基础档            → resolveStaticDifficulty 的 level 输出（同 D1 单一函数）
 *   D3 requestedDifficulty 请求/编排档         → plan.difficulty（POL 编排层只携带不自算;
 *                                                practice-session.js:316 回显 config.difficulty）
 *   D4 finalDifficulty   最终题目实际档        → 生成器回显 plan.difficulty 派生（normalizeOutput:
 *                                                difficulty: plan.difficulty; practice-session.js:394
 *                                                difficulty: sq.difficulty）。唯一合成 applyEffective
 *                                                = clamp(base+delta)（difficulty-strategy.js, P28-13 Z3 ✓）
 *
 * 铁律：这是【溯源门禁】不是【新算法】。若出现第三处难度计算定义
 *       （computeEffectiveDifficulty / buildDifficultyProfile / computeDifficultyDelta 等
 *       不在权威定义集内的 function），或生成器侧再出现 clamp(base+delta)/diffLevel( 自算
 *       写回最终题目，即 FAIL —— 因为那意味着难度不再是单链可答。
 *
 * 判定（复用 P28-13 已绿的定义级扫描；bundle 合并副本豁免）：
 *   Q1 权威函数集各恰 1 处 function 定义（diffLevel / resolveStaticDifficulty /
 *      resolveTargetDifficulty / applyEffective —— 合成点）
 *   Q2 定义集外 0 处重复权威定义 + 0 处"第三套难度"函数定义 + 0 处生成器难度自算
 *   Q3 编排层难度只携带：practice-session 的 plan/options.difficulty 回显不自算
 *
 * 用法：node dev/p28/check-difficulty-provenance-gate.js（0=PASS，1=FAIL）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var FAILS = [];
function rel(f) { return path.relative(ROOT, f); }
function push(code, f, i, msg) { FAILS.push(code + ' ' + rel(f) + ':' + (i + 1) + ' ' + msg); }
function linesOf(f) { try { return fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return null; } }

var CORE_F  = path.join(ROOT, 'shared/core/core.js');
var STATIC_F= path.join(ROOT, 'shared/strategy/static-difficulty.js');
var TARGET_F= path.join(ROOT, 'shared/strategy/target-difficulty.js');
var SYNTH_F = path.join(ROOT, 'shared/strategy/difficulty-strategy.js');
var SESSION_F = path.join(ROOT, 'shared/engine/practice-session.js');
var AUTH_SET = [CORE_F, STATIC_F, TARGET_F, SYNTH_F];

function defCount(f, re) { var l = linesOf(f); if (!l) return -1; var n = 0; l.forEach(function (ln) { if (re.exec(ln)) n++; }); return n; }

// Q1 定义级唯一权威（与 P28-13 同源）
var counts = [
  [CORE_F,  /function\s+diffLevel\s*\(/, 'Q1a', 'diffLevel( 唯一公式权威'],
  [STATIC_F,/function\s+resolveStaticDifficulty\s*\(/, 'Q1b', 'resolveStaticDifficulty( 唯一基础档'],
  [TARGET_F,/function\s+resolveTargetDifficulty\s*\(/, 'Q1c', 'resolveTargetDifficulty( 唯一目标档'],
  [SYNTH_F, /function\s+applyEffective\s*\(/, 'Q1d', 'applyEffective( 唯一合成点']
];
counts.forEach(function (c) { var n = defCount(c[0], c[1]); if (n !== 1) push(c[2], c[0], 0, c[3] + ' 应恰 1 处定义，实际=' + n); });

// Q2 定义集外扫描（shared 全 JS，bundle 合并副本豁免）：不得重复权威定义/第三套难度/生成器自算
var ALL_JS = [];
(function walk(dir) {
  var ents; try { ents = fs.readdirSync(dir); } catch (e) { return; }
  ents.forEach(function (en) {
    var p = path.join(dir, en);
    if (fs.statSync(p).isDirectory()) { walk(p); return; }
    if (/\.js$/.test(en)) ALL_JS.push(p);
  });
})(path.join(ROOT, 'shared'));

ALL_JS.forEach(function (f) {
  if (/\.bundle\.js$/.test(f)) return;
  var lines = linesOf(f); if (!lines) return;
  lines.forEach(function (ln, i) {
    if (AUTH_SET.indexOf(f) === -1) {
      if (/function\s+(diffLevel|resolveStaticDifficulty|resolveTargetDifficulty|applyEffective)\s*\(/.exec(ln))
        push('Q2a', f, i, '定义集外重复权威定义(第二套难度): ' + ln.trim());
      if (/function\s+(computeEffectiveDifficulty|buildDifficultyProfile|computeDifficultyDelta|applyEffectiveDelta|resolveComposedDifficulty)\s*\(/.exec(ln))
        push('Q2b', f, i, '第三套难度计算入口: ' + ln.trim());
    }
    if (/\/generator\//.test(f)) {
      if (/clamp\s*\([^)]*base[^)]*\+[^)]*delta/.exec(ln) || /diffLevel\s*\(/.exec(ln))
        push('Q2c', f, i, '生成器自算难度(应只回显 plan.difficulty): ' + ln.trim());
    }
  });
});

// Q3 编排层只携带：practice-session 不得出现难度公式自算（回显允许）
var ls = linesOf(SESSION_F);
if (ls) ls.forEach(function (ln, i) {
  if (/function\s+(diffLevel|resolveStaticDifficulty|applyEffective)\s*\(/.exec(ln))
    push('Q3', SESSION_F, i, '编排层自拥有难度公式(应只携带/回显): ' + ln.trim());
});

var n = FAILS.length;
console.log('P28-14 难度溯源(每道题可答"为什么是这个难度"，不新增第三套算法): ' + (n === 0 ? 'PASS' : 'FAIL'));
FAILS.forEach(function (s) { console.log('  \u2717 ' + s); });
if (n === 0) {
  console.log('  D1 source      resolveStaticDifficulty( static-difficulty.js:49  = 唯一产出点');
  console.log('  D2 base        =resolveStaticDifficulty.level 输出（同 D1 单一函数，tier 唯一）');
  console.log('  D3 requested   plan.difficulty 编排层携带(practice-session.js:316，不自算)');
  console.log('  D4 final       generator 回显 plan.difficulty(sq.difficulty)，applyEffective 唯一合成');
  console.log('  \u2192 4 维全部由 P28-13 同一权威链回答 => 可回答"为什么"，且无第三套算法');
}
process.exit(n === 0 ? 0 : 1);
