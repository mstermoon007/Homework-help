#!/usr/bin/env node
'use strict';
/**
 * dev/p28/final-50-apply-generators.js — FINAL-50 批量给 24 个 generator 注入 VariationApply
 *
 * 幂等：重复运行不重复注入（检测标记 `variation-apply.js` require 是否存在）。
 * 两种模式：
 *   A) `return SemanticEvidence.attachAll(XXX, plan);` → `return SemanticEvidence.attachAll(VariationApply.applyToAll(XXX, plan), plan);`
 *   B) `return questions;` → `return VariationApply.applyToAll(questions, plan);`
 *
 * 用法：node dev/p28/final-50-apply-generators.js [--dry]
 */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..', '..');
var GEN_DIR = path.join(ROOT, 'shared', 'generator', 'generators');

var REQUIRE_LINE = "var VariationApply = require('../core/variation-apply.js');";
var REQUIRE_MARKER = "variation-apply.js";

// Category A: return SemanticEvidence.attachAll(XXX, plan) — 包裹 XXX
// Category B: return questions; — 替换为 applyToAll
var FILES = {
  // Category A (16)
  'arithmetic.js': { mode: 'A', varName: 'questions' },
  'shape.js': { mode: 'A', varName: 'questions' },
  'position.js': { mode: 'A', varName: 'questions' },
  'money.js': { mode: 'A', varName: 'questions' },
  'reasoning.js': { mode: 'A', varName: 'questions' },
  'stats.js': { mode: 'A', varName: 'questions' },
  'percent.js': { mode: 'A', varName: 'out' },
  'semantic-relations.js': { mode: 'A', varName: 'out' },
  'decimal.js': { mode: 'A', varName: 'out' },
  'fraction.js': { mode: 'A', varName: 'out' },
  'application.js': { mode: 'A', varName: 'questions' },
  'counting.js': { mode: 'A', varName: 'questions' },
  'picture-equation.js': { mode: 'A', varName: 'questions' },
  'concept-meaning.js': { mode: 'A', varName: 'out' },
  'classify.js': { mode: 'A-inline', varName: 'buildQuestions(plan, context, count, makeSort)' },
  'semantic-special.js': { mode: 'A-multi-inline', varNames: [
    'buildQuestions(plan, context, count, makeCodeChoice)',
    'buildQuestions(plan, context, count, makeCodeApply)',
    'buildQuestions(plan, context, count, makeCodeJudge)',
    'buildQuestions(plan, context, count, makeCodeFill)'
  ]},
  // Category B (8)
  'c1-number-puzzle.js': { mode: 'B' },
  'c2-number-theory.js': { mode: 'B' },
  'c7-clever-calc.js': { mode: 'B' },
  'c9-comprehensive.js': { mode: 'B' },
  'c5-c6-journey-engineering.js': { mode: 'B' },
  'composite.js': { mode: 'B' },
  'complex.js': { mode: 'B' },
  'selection.js': { mode: 'B' }
};

var dry = process.argv.indexOf('--dry') !== -1;
var changed = [];
var skipped = [];
var errors = [];

Object.keys(FILES).forEach(function (fname) {
  var fpath = path.join(GEN_DIR, fname);
  var cfg = FILES[fname];
  if (!fs.existsSync(fpath)) { errors.push('NOT FOUND: ' + fname); return; }
  var src = fs.readFileSync(fpath, 'utf8');
  var orig = src;

  // 1. 注入 require（幂等：已存在则跳过）
  if (src.indexOf(REQUIRE_MARKER) === -1) {
    // 找最后一个 require('../core/...') 行，在其后插入
    var lines = src.split('\n');
    var lastCoreRequireIdx = -1;
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf("require('../core/") !== -1 || lines[i].indexOf('require("../core/")') !== -1) {
        lastCoreRequireIdx = i;
      }
    }
    if (lastCoreRequireIdx === -1) {
      // 找任意最后一个 require 行
      for (var j = 0; j < lines.length; j++) {
        if (lines[j].indexOf('require(') !== -1) lastCoreRequireIdx = j;
      }
    }
    if (lastCoreRequireIdx === -1) {
      // 兜底：在 'use strict' 后
      for (var k = 0; k < lines.length; k++) {
        if (lines[k].indexOf("'use strict'") !== -1 || lines[k].indexOf('"use strict"') !== -1) {
          lastCoreRequireIdx = k; break;
        }
      }
    }
    if (lastCoreRequireIdx === -1) { errors.push('NO REQUIRE HOOK: ' + fname); return; }
    lines.splice(lastCoreRequireIdx + 1, 0, REQUIRE_LINE);
    src = lines.join('\n');
  }

  // 2. 包裹 return（按模式）
  if (cfg.mode === 'A') {
    var re = new RegExp("return SemanticEvidence\\.attachAll\\(" + cfg.varName + ", plan\\);", 'g');
    if (!re.test(src)) {
      // 可能已经包裹过（幂等检查）
      if (src.indexOf('VariationApply.applyToAll(' + cfg.varName + ', plan)') !== -1) {
        // 已包裹，跳过
      } else {
        errors.push('A PATTERN NOT FOUND: ' + fname + ' (var=' + cfg.varName + ')');
      }
    } else {
      src = src.replace(re, "return SemanticEvidence.attachAll(VariationApply.applyToAll(" + cfg.varName + ", plan), plan);");
    }
  } else if (cfg.mode === 'A-inline') {
    // classify: return SemanticEvidence.attachAll(buildQuestions(...), plan);
    var target = "return SemanticEvidence.attachAll(" + cfg.varName + ", plan);";
    var replacement = "return SemanticEvidence.attachAll(VariationApply.applyToAll(" + cfg.varName + ", plan), plan);";
    if (src.indexOf(target) === -1) {
      if (src.indexOf('VariationApply.applyToAll(' + cfg.varName + ', plan)') === -1) {
        errors.push('A-inline PATTERN NOT FOUND: ' + fname);
      }
    } else {
      src = src.split(target).join(replacement);
    }
  } else if (cfg.mode === 'A-multi-inline') {
    // semantic-special: 4 个 return 点
    cfg.varNames.forEach(function (vn) {
      var t = "return SemanticEvidence.attachAll(" + vn + ", plan);";
      var r = "return SemanticEvidence.attachAll(VariationApply.applyToAll(" + vn + ", plan), plan);";
      if (src.indexOf(t) !== -1) {
        src = src.split(t).join(r);
      } else if (src.indexOf('VariationApply.applyToAll(' + vn + ', plan)') === -1) {
        errors.push('A-multi PATTERN NOT FOUND: ' + fname + ' (var=' + vn + ')');
      }
    });
  } else if (cfg.mode === 'B') {
    // return questions; → return VariationApply.applyToAll(questions, plan);
    var targetB = 'return questions;';
    var replacementB = 'return VariationApply.applyToAll(questions, plan);';
    if (src.indexOf(targetB) === -1) {
      if (src.indexOf('VariationApply.applyToAll(questions, plan)') !== -1) {
        // 已包裹
      } else {
        errors.push('B PATTERN NOT FOUND: ' + fname);
      }
    } else {
      src = src.split(targetB).join(replacementB);
    }
  }

  if (src !== orig) {
    changed.push(fname);
    if (!dry) fs.writeFileSync(fpath, src, 'utf8');
  } else {
    skipped.push(fname);
  }
});

console.log('=== FINAL-50 generator 注入汇总 ===');
console.log('  改动: ' + changed.length + ' 文件');
changed.forEach(function (f) { console.log('    ✓ ' + f); });
console.log('  跳过(已注入或无变化): ' + skipped.length + ' 文件');
skipped.forEach(function (f) { console.log('    - ' + f); });
console.log('  错误: ' + errors.length);
errors.forEach(function (e) { console.log('    ✗ ' + e); });
if (dry) console.log('\n(dry run — 未写盘)');
process.exit(errors.length > 0 ? 1 : 0);
