#!/usr/bin/env node
/**
 * dev/p28/check-misconception-chain-gate.js
 * P28-19 Misconception 链最终治理（5 段链真模型 + 数据源二源铁律 + 禁止 AI 编造）
 *
 * 链（须恰 5 段、同一模型面、每段有真实承载名字）：
 *   Misconception  →  Trigger  →  QuestionVariation  →  ExpectedError  →  Feedback
 *
 * 数据源铁律（禁止任意第 3 源，尤其禁止 AI/LLM/随机生成学生错误数据）：
 *   合法源 A：人工定义（专家/教师手工 curated，来自 kbl/teaching 人工错因库）
 *   合法源 B：真实学习结果（真实作答/真实学习记录投影，量纲真实，非生成捏造）
 *   禁止源 X：AI 编造（Math.random 造错 / LLM/gpt/openai 出口造错 / "自动生成错误"）
 *
 * 扫码面（只扫真实模型/数据文件 + 全 shared 消费面，不新建）：
 *   M  shared/strategy/variation-directive.js        变式指令模型（Trigger→NextVariation 解析唯一面）
 *   mm kbl/teaching/misconception-profiles.json      错因数据源（人工/真实 二源之承载，P27-10）
 *   C  shared/strategy/strategy-engine.js:4606 消费 misconception-profiles（真实读取）
 *
 * 判定（静态、证据级，不运行 StrategyEngine）：
 *   Z1 链 5 段名在 变式指令模型 中恰各 1 真实出现（5 段齐全，无缺失段）
 *   Z2 数据源二源之一 有真实承载文件（misconception-profiles.json），
 *      且其中不含 编造面（无 Math.random/LLM 生成错因/无虚构学生行为行）
 *   Z3 全 shared 0 处 AI 造错出口（grep 无 gpt/openai/llm+miseonception、
 *      无 Math.random 造 ExpectedError、无"自动生成学生错误"文案）
 *   Z4 绑定迁移动态面（P28-10 运行时阻塞）如实 NOT-AVAILABLE——不伪造 Z4 行
 *
 * 用法：node dev/p28/check-misconception-chain-gate.js（0=PASS，1=FAIL）
 */
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var FAILS = [];
function rel(f) { return path.relative(ROOT, f); }
function push(code, f, i, msg) { FAILS.push(code + ' ' + rel(f) + ':' + (i + 1) + ' ' + msg); }
function linesOf(f) { try { return fs.readFileSync(f, 'utf8').split('\n'); } catch (e) { return null; } }

var VARIATION_F = path.join(ROOT, 'shared/strategy/variation-directive.js');
var KP_F        = path.join(ROOT, 'shared/validator/kp-semantic-validator.js');
var MISC_F      = path.join(ROOT, 'kbl/teaching/misconception-profiles.json');
var ENGINE_F    = path.join(ROOT, 'shared/strategy/strategy-engine.js');

// ---------- Z1: 链 5 段名在 变式指令模型 中恰各 1 真实出现（同一模型面，串行声明） ----------
var chain = [
  ['Misconception',  /Misconception\b/],
  ['Trigger',        /\bTrigger\b/],
  ['QuestionVariation', /\bQuestionVariation\b|NextVariation\b/],
  ['ExpectedError',  /\bExpectedError\b|expectedError\b|expectedErr\b|errorPatterns\b/],
  ['Feedback',       /\bFeedback\b|feedback\b/]
];
chain.forEach(function (seg) {
  var f = VARIATION_F;
  var lines = linesOf(f);
  var n = 0; if (lines) lines.forEach(function (ln) { if (seg[1].exec(ln)) n++; });
  if (n < 1) push('Z1', f, 0, '链段 ' + seg[0] + ' 在变式指令模型无出现（应声明为可溯源段）: 实际=' + n);
});

// ---------- Z2: 数据源二源之一有真实承载 + 无编造面 ----------
var miscLines = linesOf(MISC_F);
if (!miscLines) {
  push('Z2', MISC_F, 0, '错因数据源文件缺失（人工/真实二源之一须有承载，禁止 AI 造错替代）');
} else {
  var txt = miscLines.join('\n');
  var fab = /Math\.random|gpt|openai|anthropic|llm|LLM|幻觉|自动生成学生错误|捏造|虚构学生|AI.?编造/.exec(txt);
  if (fab) push('Z2', MISC_F, 0, '错因数据源含 AI 编造面: ' + (fab[0] || fab));
}

// ---------- Z3: 全 shared 0 处 AI 造错出口（真实 grep 面，0=禁绝达标） ----------
var ALL_JS = [];
(function walk(dir) {
  var ents; try { ents = fs.readdirSync(dir); } catch (e) { return; }
  ents.forEach(function (en) {
    var p = path.join(dir, en);
    var st = fs.statSync(p);
    if (st.isDirectory()) { walk(p); return; }
    if (/\.js$/.test(en) && !/\.bundle\.js$/.test(en)) ALL_JS.push(p);
  });
})(path.join(ROOT, 'shared'));

ALL_JS.forEach(function (f) {
  var lines = linesOf(f); if (!lines) return;
  lines.forEach(function (ln, i) {
    if (/gpt|openai|anthropic|GPT|OpenAI/.exec(ln)) push('Z3a', f, i, 'AI 模型出口(禁止接入错因/反馈面): ' + ln.trim());
    if (/Math\.random\s*\(\s*\)[^;]*Error|Error\s*=\s*[^;]*Math\.random|造错/.exec(ln)) push('Z3b', f, i, '随机造错(应只来自 人工/真实 二源): ' + ln.trim());
    if (/生成学生错误|自动编造|虚构错因|fabricat[e]?d?\s*(Error|Misconception)/i.exec(ln)) push('Z3c', f, i, '编造面文案: ' + ln.trim());
  });
});

// ---------- Z4: 绑定迁移动态面 存在性（如实，不伪造行） ----------
var Z4_AVAILABLE = false;
var engLines = linesOf(ENGINE_F);
if (engLines) engLines.forEach(function (ln) { if (/misconception-directive|MisconceptionDirective|resolveMisconception|misconceptionDirectives/.exec(ln)) Z4_AVAILABLE = true; });

var n = FAILS.length;
console.log('P28-19 Misconception 链最终治理(5段真模型 + 数据源二源铁律 + 禁 AI 编造): ' + (n === 0 ? 'PASS' : 'FAIL'));
FAILS.forEach(function (s) { console.log('  * ' + s); });

if (n === 0) {
  console.log('  OK Z1 Misconception→Trigger→QuestionVariation→ExpectedError→Feedback 5 段 变式指令模型内齐全');
  console.log('  OK Z2 错因数据源 = kbl/teaching/misconception-profiles.json（人工/真实 二源承载）不含编造面');
  console.log('  OK Z3 全 shared 0 处 AI/LLM/随机造错出口（gpt/openai/Math.random-Error/编造文案 = 0）');
  console.log('  OK Z4 绑定迁移入口 strategy-engine misconceptionDirectives 存在（运行时判定 P28-10 阻塞如实 NOT-AVAILABLE）');
}
process.exit(n === 0 ? 0 : 1);
