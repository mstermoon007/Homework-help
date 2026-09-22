#!/usr/bin/env node
/**
 * dev/p28/check-difficulty-authority-gate.js
 * P28-13 难度单一权威链最终收口门禁（仅定义级判定，调用=授权消费不算旁路）
 *
 * 唯一权威链：
 *   diffLevel( 归一化公式  —— 唯一定义 shared/core/core.js:119（难度 1-10 归一唯一权威）
 *   resolveStaticDifficulty( —— 唯一定义 shared/strategy/static-difficulty.js:49
 *   resolveTargetDifficulty( —— 唯一定义 shared/strategy/target-difficulty.js:41
 *   resolveDifficultyContext( —— 仅编排归一（orchestration/difficulty-orchestrator.js），不自算
 *   applyEffective / clamp(base+delta) —— 唯一合成点 shared/strategy/difficulty-strategy.js
 *
 * 判定规则（本门禁只看「定义」不看「调用」——调用权威=正确消费）：
 *   Z1 diffLevel( 之主 function 定义 全局应恰 1 处（=core/core.js:119）
 *   Z2 resolveStaticDifficulty( 之 function 定义 应恰 1 处（=static-difficulty.js:49；bundle 副本豁免）
 *   Z3 resolveTargetDifficulty( 之 function 定义 应恰 1 处（=target-difficulty.js:41；bundle 副本豁免）
 *   Z4 定义集外不得再出现任一权威的 function 定义（第二处定义 = 第二套难度公式）
 *      —— 但允许这些文件「调用」权威（strategy-engine/target-difficulty/number-range 等 = 消费者）
 *
 * 用法：node dev/p28/check-difficulty-authority-gate.js（退出码 0=PASS，1=FAIL）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var FAILS = [];
function rel(f) { return path.relative(ROOT, f); }
function push(code, f, i, msg) { FAILS.push(code + ' ' + rel(f) + ':' + (i + 1) + ' ' + msg); }
function linesOf(f) { try { return fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return null; } }

var CORE_F = path.join(ROOT, 'shared/core/core.js');
var STATIC_F = path.join(ROOT, 'shared/strategy/static-difficulty.js');
var TARGET_F = path.join(ROOT, 'shared/strategy/target-difficulty.js');
var SYNTH_F = path.join(ROOT, 'shared/strategy/difficulty-strategy.js');

// ---------- Z1/Z2/Z3 唯一权威定义（主文件内恰 1 处 function 定义） ----------
function countDefs(f, re, code, label) {
  var lines = linesOf(f); if (!lines) { return; }
  var n = 0;
  lines.forEach(function (ln) { if (re.exec(ln)) n++; });
  if (n !== 1) push(code, f, 0, label + ' 主权威文件内应恰 1 处 function 定义，实际=' + n);
}
countDefs(CORE_F,    /function\s+diffLevel\s*\(/, 'Z1', 'diffLevel( 归一化公式');
countDefs(STATIC_F,  /function\s+resolveStaticDifficulty\s*\(/, 'Z2', 'resolveStaticDifficulty(');
countDefs(TARGET_F,  /function\s+resolveTargetDifficulty\s*\(/, 'Z3', 'resolveTargetDifficulty(');

// ---------- 全 shared 定义级扫描：除主权威文件外，不得再有任一权威的 function 定义 ----------
var ALL_JS = [];
(function walk(dir) {
  var ents; try { ents = fs.readdirSync(dir); } catch (e) { return; }
  ents.forEach(function (en) {
    var p = path.join(dir, en);
    var st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); return; }
    if (/\.js$/.test(en)) ALL_JS.push(p);
  });
})(path.join(ROOT, 'shared'));

ALL_JS.forEach(function (f) {
  if (/\.bundle\.js$/.test(f)) return; // 打包副本 = 同链合并，豁免
  if (f === CORE_F || f === STATIC_F || f === TARGET_F || f === SYNTH_F) return; // 主权威文件(Z1-Z3 已单独核对)
  var lines = linesOf(f); if (!lines) return;
  lines.forEach(function (ln, i) {
    [['diffLevel(', 'Z4a', 'diffLevel( 公式'],
     ['resolveStaticDifficulty(', 'Z4b', 'resolveStaticDifficulty('],
     ['resolveTargetDifficulty(', 'Z4c', 'resolveTargetDifficulty('],
     ['applyEffective(', 'Z4d', 'applyEffective( 合成']
    ].forEach(function (t) {
      if (new RegExp('function\\s+' + t[0].replace('(','\\s*\\(')).exec(ln))
        push(t[1], f, i, '定义集外重复权威定义(第二套难度): ' + ln.trim());
    });
  });
});

var n = FAILS.length;
console.log('P28-13 难度单一权威链最终收口(定义级):' + (n === 0 ? 'PASS' : 'FAIL'));
FAILS.forEach(function (s) { console.log('  * ' + s); });
if (n === 0) {
  console.log('  OK Z1 diffLevel( 唯一定义 core/core.js:119');
  console.log('  OK Z2 resolveStaticDifficulty( 唯一定义 strategy/static-difficulty.js:49');
  console.log('  OK Z3 resolveTargetDifficulty( 唯一定义 strategy/target-difficulty.js:41');
  console.log('  OK Z4 定义集外 0 处重复权威 function 定义（bundle 合并副本已豁免）');
}
process.exit(n === 0 ? 0 : 1);
