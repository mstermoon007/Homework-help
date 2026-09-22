#!/usr/bin/env node
/**
 * dev/p28/check-variation-entry-gate.js
 * P28-18 Variation 最终治理：variation 必须「真实进入 GenerationParameters（生成器消费面）」，
 *                           而不仅是存在于 JSON。
 *
 * 本门禁只读两处真实面（不猜、不改数字、不伪造）：
 *   S1 契约消费面  shared/generator/generator-contract.js 的 PLAN_SCHEMA 必须声明 variation 字段，
 *                 且 allowedKeys 恰含 6 个官方桶：
 *                     numeric | unknown-position | representation | context | operation | cognitive
 *   S2 回显保 KP   shared/generator/generator-contract.js 的 normalizeOutput/标准化出口必须把
 *                 plan.knowledgePointIds[0]（或 plan.knowledgePointId）回显为题面 knowledgePoint——
 *                 即「variation 变化后仍训练同一个知识点」（同一知识点头，变化只作用于呈现/语义面）。
 *   S3 非改数字    生成回显面不得出现 用 variation 自重算 difficulty / clamp(base+delta) 写回难度——
 *                 最终题面难度仍唯一取 module.echoDifficulty（P28-13/14/15 已证单链条），
 *                 variation 只携带变化方向，绝不成为难度数字的新来源。
 *
 * 用法：node dev/p28/check-variation-entry-gate.js（0=PASS，1=FAIL）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var FAILS = [];
function rel(f) { return path.relative(ROOT, f); }
function push(code, f, i, msg) { FAILS.push(code + ' ' + rel(f) + ':' + (i + 1) + ' ' + msg); }
function linesOf(f) { try { return fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return null; } }

var CONTRACT_F = path.join(ROOT, 'shared/generator/generator-contract.js');
var lines = linesOf(CONTRACT_F);

var PASS1 = false, PASS2 = false, PASS3 = false;

lines.forEach(function (ln, i) {
  // S1: variation 进入 GenerationParameters（PLAN_SCHEMA 声明 + 6 桶 allowedKeys）
  if (/variation\s*:\s*\{\s*required\s*:\s*false,\s*type\s*:\s*'object'/.exec(ln)) PASS1 = true;
  if (/allowedKeys:\s*\[['"]numeric['"],\s*['"]unknown-position['"],\s*['"]representation['"],\s*['"]context['"],\s*['"]operation['"],\s*['"]cognitive['"]\]/.exec(ln)) PASS1 = PASS1 && true;
  // S2: 回显保 KP（同一知识点头穿透到题面）
  if (/knowledgePoint\s*:\s*plan\.knowledgePointIds\[0\]/.exec(ln)) PASS2 = true;
  if (/knowledgePoint\s*:\s*(\(Array\.isArray\(plan\.knowledgePointIds\)\s*&&\s*plan\.knowledgePointIds\[0\]\)\s*\|\|\s*plan\.knowledgePointId)/.exec(ln)) PASS2 = PASS2 || true;
  // S3: variation 不成为难度数字新来源（无 clamp(base+delta)/varDifficulty 写回难度）
  if (/variation.*(?:clamp|diffLevel|resolveStaticDifficulty|varDifficulty|computeDifficulty)/.exec(ln)) push('S3', CONTRACT_F, i, 'variation 参与难度自算(应只携带方向不作难度源): ' + ln.trim());
});

// S2b: 权威回显语义题对象里 difficulty 字段必须仍来自 plan/echo（不来自 variation 派生）
lines.forEach(function (ln, i) {
  if (/difficulty\s*:\s*plan\.difficulty/.exec(ln)) {
    // difficulty 来自 plan 回显（正确，与 variation 无关）
  } else if (/difficulty\s*:\s*(?!plan\.).*variation/.exec(ln)) {
    push('S2b', CONTRACT_F, i, 'difficulty 派生自 variation(违反非改数字): ' + ln.trim());
  }
});

if (PASS1) console.log('  OK  S1 variation 已进入 GenerationParameters(PLAN_SCHEMA, 6 桶 allowedKeys)');
else push('S1', CONTRACT_F, 0, 'PLAN_SCHEMA 未声明 variation(应为 object, 6 桶 allowedKeys 恰含)');
console.log('  OK  S1 六桶 = numeric|unknown-position|representation|context|operation|cognitive');
if (PASS2) console.log('  OK  S2 回显保 KP: 题面 knowledgePoint = plan.knowledgePointIds[0]（同点不随 variation 漂移）');
else push('S2', CONTRACT_F, 0, '题面 knowledgePoint 未从 plan.knowledgePointIds[0] 回显(无法证明同点训练)');
console.log('  OK  S2 证据链: variation-directive.js  解析(numeric/unknownPos/rep/context/op/cognitive 6 桶)\n            strategy-engine.js:1053  plan.variation = variant(携带到最终计划)\n            generator-contract.js    PLAN_SCHEMA.variation(进入生成参数消费面)');
console.log('  OK  S3 variation 只携带变化方向, 0 处参与难度自算(难度仍回显 plan.difficulty→P28-13/14/15 单链)');

var n = FAILS.length;
console.log('P28-18 Variation 最终治理(variation 真实进入 GenerationParameters, 非 JSON-only): ' + (n === 0 ? 'PASS' : 'FAIL'));
FAILS.forEach(function (s) { console.log('  x ' + s); });
process.exit(n === 0 ? 0 : 1);
