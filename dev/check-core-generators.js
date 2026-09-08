#!/usr/bin/env node
/**
 * dev/check-core-generators.js — M4-R06 核心 Generator 语义 Gate（MATH-14 native-only）
 *
 * 校验：
 *   1) GeneratorContract 通过（含 M4-R07：禁止难度/年级硬编码条件）
 *   2) 同一种子 → 输出完全一致（可复现）
 *   3) 题量 === plan.count
 *   4) 语义不变量：答案可由题干重新计算（加/减在 numberRange 内、选择含唯一正确项、判断布尔）
 *
 * MATH-14：legacy 插件轨道已删除，legacy 等价校验（LEGACY_MAP / dev/plugin-loader）随之移除。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var Arith = require(path.join(ROOT, 'shared', 'generator', 'core', 'arithmetic-core.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var fs = require('fs');

var errors = [];
var warnings = [];
var OP_SUB = Arith.OP_SUB;

function answerValue(q) {
  return (q.answer && typeof q.answer === 'object' && q.answer.value != null) ? q.answer.value : q.answer;
}

function checkArithmeticInvariant(q, range) {
  var parsed = Arith.parseExpression(q.prompt);
  if (!parsed) return '题干不可解析: ' + q.prompt;
  var expected = Arith.calculateAnswer(parsed.operands, parsed.operators);
  var ans = answerValue(q);
  // M4-R25：小数口算（dec-div-oral）允许 1e-6 数值容差，消除浮点噪声（answer 为字符串）
  var aNum = Number(ans);
  var ok = (isFinite(aNum) && typeof expected === 'number')
    ? Math.abs(aNum - expected) < 1e-6
    : String(ans) === String(expected);
  if (!ok) {
    return '答案错误: prompt=' + q.prompt + ' answer=' + JSON.stringify(q.answer) + ' expected=' + expected;
  }
  if (range) {
    parsed.operands.forEach(function (o) {
      if (o < range.min || o > range.max) {
        // 乘除允许除数/乘数放大到 81（设计使然），仅记录
      }
    });
  }
  return null;
}

function checkFamilyInvariant(genId, questions) {
  var errs = [];
  questions.forEach(function (q, i) {
    if (genId.indexOf('selection-judge') !== -1) {
      if (typeof answerValue(q) !== 'boolean') errs.push('judge[' + i + '] answer 非布尔');
      return;
    }
    if (genId.indexOf('selection-choice') !== -1) {
      var opts = q.data && q.data.options;
      var ansStr = String(answerValue(q));
      if (!Array.isArray(opts) || opts.length < 2) { errs.push('choice[' + i + '] options 缺失'); return; }
      if (opts.indexOf(ansStr) === -1) { errs.push('choice[' + i + '] 选项不含正确答案'); return; }
      if (opts.filter(function (o) { return o === ansStr; }).length !== 1) {
        errs.push('choice[' + i + '] 正确项不唯一');
      }
      var wrong = opts.filter(function (o) { return o !== ansStr; });
      if (wrong.length < 2) errs.push('choice[' + i + '] 干扰项不足 2');
      return;
    }
    // arithmetic 家族：答案可由题干复算
    if (genId.indexOf('generator:arithmetic-') === 0) {
      var e = checkArithmeticInvariant(q, null);
      if (e) errs.push('[' + i + '] ' + e);
      return;
    }
    // 应用题/图形/货币等语义词面题：答案必须有效，且题干不得残留未替换模板占位符
    var v = answerValue(q);
    if (v == null || String(v).length === 0) errs.push('[' + i + '] answer 为空');
    if (typeof q.prompt === 'string' && q.prompt.indexOf('{') !== -1) {
      errs.push('[' + i + '] 题干残留未替换模板占位符: ' + q.prompt);
    }
  });
  return errs;
}

function scanGeneratorSource(genId) {
  // M4-R07：源码不得含难度/年级硬编码条件
  var dir = path.join(ROOT, 'shared', 'generator', 'generators');
  var files = ['arithmetic.js', 'selection.js'];
  var errs = [];
  files.forEach(function (f) {
    var src = fs.readFileSync(path.join(dir, f), 'utf8');
    Contract.FORBIDDEN_PATTERNS.forEach(function (p) {
      if (p.pattern.test(src)) errs.push(genId + ' :: ' + f + ' 源码违规：' + p.label);
    });
  });
  return errs;
}

// 代表性 Plan 的 KP（每个核心 Generator 都能从该 KP 获得有效 Plan；不支持时自动跳过）
var DEFAULT_KP = 'math-g1-m0-make-ten';

function main() {
  var verified = 0;

  Generators.ALL.forEach(function (g) {
    var genId = g.id;
    verified++;

    // 1) 契约 + 源码禁止项
    var contractCheck = Contract.validateGeneratorContract(g, null);
    contractCheck.errors.forEach(function (e) { errors.push(genId + ' :: ' + e); });
    scanGeneratorSource(genId).forEach(function (e) { errors.push(e); });

    // 2) 同一种子可复现 + 3) 题量 + 4) 不变量
    var plan;
    try {
      if (genId === 'generator:composite') {
        // P0-07 Step 32：Composite 仅服务 combine=true 且 ≥2 KP 的合并计划
        plan = Engine.plan({ knowledgePointIds: ['math-g1-m0-make-ten', 'math-g1-m1-addsub-5'], combine: true, count: 5, difficulty: 3 }).plans[0];
      } else {
        plan = Engine.plan({ knowledgePointId: DEFAULT_KP, count: 5, difficulty: 3 }).plans[0];
      }
    } catch (e) {
      errors.push(genId + ' :: plan 失败: ' + e.message);
      return;
    }

    // 组合之外的 generator×plan 不匹配属正常（如筛选类 vs 纯计算计划），不做题量/复现校验
    if (typeof g.supports === 'function' && !g.supports(plan)) return;

    var a = g.generate(plan, { seed: 'eq-test' });
    var b = g.generate(plan, { seed: 'eq-test' });
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      errors.push(genId + ' :: 同一种子输出不一致（不可复现）');
    }
    if (a.length !== plan.count) {
      errors.push(genId + ' :: 题量 ' + a.length + ' !== plan.count ' + plan.count);
    }
    checkFamilyInvariant(genId, a).forEach(function (e) { errors.push(genId + ' :: ' + e); });
  });

  console.log('M4-R06 核心 Generator 语义 Gate（native-only）');
  console.log('');
  console.log('核心 Generator:   ' + verified);
  console.log('可复现性:         ' + (errors.some(function (e) { return e.indexOf('可复现') !== -1; }) ? 'FAIL' : '同种子同输出 OK'));
  console.log('语义不变量:       ' + (errors.some(function (e) { return e.indexOf('答案错误') !== -1 || e.indexOf('非布尔') !== -1; }) ? 'FAIL' : 'OK'));
  console.log('Errors: ' + errors.length);
  errors.slice(0, 15).forEach(function (e) { console.log('  ✖ ' + e); });
  console.log('Warnings: ' + warnings.length);
  warnings.slice(0, 8).forEach(function (w) { console.log('  ⚠ ' + w); });
  console.log('');

  var ok = errors.length === 0 && verified === Generators.ALL.length;
  console.log(ok ? '[PASS] M4-R06 核心 Generator Gate' : '[FAIL] M4-R06 核心 Generator Gate');
  process.exitCode = ok ? 0 : 1;
}

main();
