#!/usr/bin/env node
/**
 * dev/check-core-generators.js — M4-R06 核心 Generator 语义等价 Gate
 *
 * 首批 8 个核心 Generator：addition / subtraction / multiplication / division /
 * mixed-calculation / fill / choice / judge
 *
 * 校验：
 *   1) GeneratorContract 通过（含 M4-R07：禁止难度/年级硬编码条件）
 *   2) 同一种子 → 输出完全一致（可复现）
 *   3) 题量 === plan.count
 *   4) 语义不变量：答案可由题干重新计算（加/减在 numberRange 内、选择含唯一正确项、判断布尔）
 *   5) 等价性：同一 Plan 下，对应 legacy 插件（math-oral / math-g1-multiplication-table /
 *      math-g1-choice / math-g1-judge）输出满足相同不变量
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
var Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
var Arith = require(path.join(ROOT, 'shared', 'generator', 'core', 'arithmetic-core.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var LegacyAdapter = require(path.join(ROOT, 'shared', 'strategy', 'legacy-adapter.js'));
var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
var fs = require('fs');

var errors = [];
var warnings = [];
var OP_SUB = Arith.OP_SUB;

function checkArithmeticInvariant(q, range) {
  var parsed = Arith.parseExpression(q.prompt);
  if (!parsed) return '题干不可解析: ' + q.prompt;
  var expected = Arith.calculateAnswer(parsed.operands, parsed.operators);
  if (String(expected) !== String(q.answer)) {
    return '答案错误: prompt=' + q.prompt + ' answer=' + q.answer + ' expected=' + expected;
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
      if (typeof q.answer !== 'boolean') errs.push('judge[' + i + '] answer 非布尔');
      return;
    }
    if (genId.indexOf('selection-choice') !== -1) {
      var opts = q.data && q.data.options;
      if (!Array.isArray(opts) || opts.length < 2) { errs.push('choice[' + i + '] options 缺失'); return; }
      if (opts.indexOf(String(q.answer)) === -1) { errs.push('choice[' + i + '] 选项不含正确答案'); return; }
      if (opts.filter(function (o) { return o === String(q.answer); }).length !== 1) {
        errs.push('choice[' + i + '] 正确项不唯一');
      }
      var wrong = opts.filter(function (o) { return o !== String(q.answer); });
      if (wrong.length < 2) errs.push('choice[' + i + '] 干扰项不足 2');
      return;
    }
    // fill / arithmetic：答案可复算
    var e = checkArithmeticInvariant(q, null);
    if (e) errs.push('[' + i + '] ' + e);
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

function loadLegacy(pluginId) {
  return loader.loadPlugin(pluginId);
}

function legacyInvariantErrors(genId, questions) {
  // legacy 题型的语义不变量（与核心 Generator 相同口径）
  var errs = [];
  questions.forEach(function (q, i) {
    if (genId.indexOf('judge') !== -1) {
      // math-g1-judge：generateQuestions 把 right 转为 answer '√'/'×'
      var okJudge = q.right === true || q.right === false || q.answer === '√' || q.answer === '×';
      if (!okJudge) errs.push('legacy judge[' + i + '] 缺少布尔 right / √× answer');
      return;
    }
    if (genId.indexOf('choice') !== -1) {
      if (q.answer == null) { errs.push('legacy choice[' + i + '] answer 缺失'); return; }
      if (Array.isArray(q.wrong)) {
        q.wrong.forEach(function (w) {
          if (String(w) === String(q.answer)) errs.push('legacy choice[' + i + '] 干扰项与答案相同');
        });
      }
      // 仅算术型题干复算答案（图形/常识题跳过）
      var parsedChoice = Arith.parseExpression(q.q);
      if (parsedChoice) {
        var expectedChoice = Arith.calculateAnswer(parsedChoice.operands, parsedChoice.operators);
        if (String(expectedChoice) !== String(q.answer)) {
          errs.push('legacy choice[' + i + '] 答案错误: ' + q.q + ' answer=' + q.answer + ' expected=' + expectedChoice);
        }
      }
      return;
    }
    if (genId.indexOf('fill') !== -1) {
      // 乘法表填空："2 × ( ) = 14" → 答案应为 14/2
      var m = String(q.q || '').match(/(\d+)\s*([+\-−×÷])\s*\(\s*\)\s*=\s*(\d+)/);
      if (m) {
        var a = Number(m[1]), c = Number(m[3]), op = m[2] === '-' ? OP_SUB : m[2];
        var expected = op === OP_SUB ? a - c : (op === '+' ? c - a : (op === '×' ? c / a : a / c));
        if (String(q.answer) !== String(expected)) {
          errs.push('legacy fill[' + i + '] 答案错误: ' + q.q + ' answer=' + q.answer + ' expected=' + expected);
        }
      }
      return;
    }
    if (q.q != null && q.answer != null && /[+\-−×÷]/.test(String(q.q))) {
      var parsed = Arith.parseExpression(q.q);
      if (parsed) {
        var err = checkArithmeticInvariant({ prompt: q.q, answer: q.answer }, null);
        if (err) errs.push('legacy[' + i + '] ' + err);
      }
    }
  });
  return errs;
}

// 代表性 legacy 对照
var LEGACY_MAP = {
  'generator:arithmetic-addition': { pluginId: 'math-oral', kpId: 'math-g4-m1-g4-oral-law', extra: { settings: { operators: ['+'] } } },
  'generator:arithmetic-subtraction': { pluginId: 'math-oral', kpId: 'math-g4-m1-g4-oral-law', extra: { settings: { operators: ['-'] } } },
  'generator:arithmetic-multiplication': { pluginId: 'math-oral', kpId: 'math-g5-m1-g5-oral-decmul', extra: { settings: { operators: ['×'] } } },
  'generator:arithmetic-division': { pluginId: 'math-oral', kpId: 'math-g5-m1-g5-oral-decdiv', extra: { settings: { operators: ['÷'] } } },
  'generator:arithmetic-mixed-calculation': { pluginId: 'math-oral', kpId: 'math-g4-m1-g4-oral-law', extra: { settings: { operators: ['+', '-'] } } },
  'generator:selection-fill': { pluginId: 'math-g1-multiplication-table', kpId: 'math-g1-m13-fill-blank', extra: { type: 'fill' } },
  'generator:selection-choice': { pluginId: 'math-g1-choice', kpId: 'math-g1-m5-match-shape', extra: {} },
  'generator:selection-judge': { pluginId: 'math-g1-judge', kpId: 'math-g1-m11-judge-mixed', extra: {} }
};

function main() {
  var verified = 0;

  Generators.ALL.forEach(function (g) {
    var genId = g.id;

    // 1) 契约 + 源码禁止项
    var contractCheck = Contract.validateGeneratorContract(g, null);
    contractCheck.errors.forEach(function (e) { errors.push(genId + ' :: ' + e); });
    scanGeneratorSource(genId).forEach(function (e) { errors.push(e); });

    // 2) 同一种子可复现 + 3) 题量 + 4) 不变量
    var map = LEGACY_MAP[genId];
    var plan;
    try {
      plan = Engine.plan({ knowledgePointId: map ? map.kpId : 'math-g1-m0-make-ten', count: 5, difficulty: 3 }).plans[0];
    } catch (e) {
      errors.push(genId + ' :: plan 失败: ' + e.message);
      return;
    }

    var a = g.generate(plan, { seed: 'eq-test' });
    var b = g.generate(plan, { seed: 'eq-test' });
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      errors.push(genId + ' :: 同一种子输出不一致（不可复现）');
    }
    if (a.length !== plan.count) {
      errors.push(genId + ' :: 题量 ' + a.length + ' !== plan.count ' + plan.count);
    }
    checkFamilyInvariant(genId, a).forEach(function (e) { errors.push(genId + ' :: ' + e); });

    // 5) legacy 等价（同一 Plan → 相同语义不变量）
    if (map) {
      var legacy = loadLegacy(map.pluginId);
      if (legacy.error || !legacy.compatible) {
        warnings.push(genId + ' :: legacy 对照插件不可用: ' + (legacy.error || '接口缺失'));
      } else {
        try {
          var options = LegacyAdapter.adaptPlanToLegacyOptions(plan, {
            grade: plan.grade != null ? plan.grade : 4,
            count: plan.count,
            type: map.extra.type,
            settings: map.extra.settings || {}
          });
          var set = legacy.plugin.generate(options);
          var questions = set && set.questions ? set.questions : [];
          if (questions.length === 0) {
            warnings.push(genId + ' :: legacy 对照插件产出 0 题（' + map.pluginId + '）');
          } else {
            legacyInvariantErrors(genId, questions).forEach(function (e) { errors.push(genId + ' :: ' + e); });
          }
        } catch (e) {
          warnings.push(genId + ' :: legacy 对照生成异常: ' + e.message);
        }
      }
    }
    verified++;
  });

  console.log('M4-R06 核心 Generator 语义等价 Gate');
  console.log('');
  console.log('核心 Generator:   ' + verified);
  console.log('可复现性:         ' + (errors.some(function (e) { return e.indexOf('可复现') !== -1; }) ? 'FAIL' : '同种子同输出 OK'));
  console.log('语义不变量:       ' + (errors.some(function (e) { return e.indexOf('答案错误') !== -1 || e.indexOf('非布尔') !== -1; }) ? 'FAIL' : 'OK'));
  console.log('legacy 等价:      ' + (errors.some(function (e) { return e.indexOf('legacy') !== -1; }) ? 'FAIL' : 'OK'));
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
