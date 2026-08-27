#!/usr/bin/env node
/**
 * dev/verify-competition.js — 竞赛插件（C1-C9）专项校验
 *
 * 为什么单独一个工具：竞赛题与常规练习的质量标准不同。常规口算题「答案唯一」是天然的，
 * 而数字谜/数阵/幻方/计数这类题目，随机构造出来的题面很容易出现
 *   ① 答案根本不成立（构造时算错）
 *   ② 存在多组解（学生答另一组同样正确的答案会被误判为错）
 * 这两类缺陷都无法靠「插件自答自批一致」发现——自答自批只能证明 answer 与 check 自洽。
 * 因此本工具不信任插件给出的 answer，而是通过 plugins/competition/checkers/ 的
 * 独立求解器从题面反解出期望答案，再与插件 answer 比对。
 *
 * 校验维度：
 *   1. 满分回填必须判对（模拟 practice.html 的 collectAnswers）
 *   2. 同一份练习内题面不得重复
 *   3. 独立求解：答案正确 + 解唯一（checkers 按 question.type 分派）
 *   4. 键盘等价写法（× 打成 *、÷ 打成 /）必须判对（填运算符号类题目）
 *
 * 独立求解器位于 plugins/competition/checkers/（任务04建立的 Checker 框架），
 * 新增 Cx 插件/题型时：在 checkers/cN.js 中 register(question.type, solver)。
 * 未登记求解器的 type 会被计为「未覆盖独立校验」并使 checkerCoverage < 100%（校验失败）。
 *
 * 用法：
 *   node dev/verify-competition.js                    # 校验全部已注册竞赛插件
 *   node dev/verify-competition.js --only C1          # 只校验某模块
 *   node dev/verify-competition.js --count 60         # 每个子题型的抽样题量（默认 40）
 */
'use strict';
var path = require('path');
var ROOT = path.join(__dirname, '..');

var args = process.argv.slice(2);
function argVal(name, def) {
  var i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
var ONLY = (argVal('--only', '') || '').toUpperCase();
var COUNT = Number(argVal('--count', 40)) || 40;

require(path.join(ROOT, 'shared/common.js'));
var PLUGIN_REGISTRY = require(path.join(ROOT, 'plugins/registry.js'));
var CHECKERS = require(path.join(ROOT, 'plugins/competition/checkers/index.js'));

var FAIL = 0;
var seenTypes = {};      // 出现过的全部 question.type
var coveredTypes = {};   // 有独立求解器且被成功调用的 type
function bad(msg, q) {
  FAIL++;
  console.log('    ✗ ' + msg);
  console.log('       题干：' + String(q.q || '').slice(0, 80));
  if (q.svg) console.log('       图形：' + String(q.svg).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90));
  console.log('       答案：' + JSON.stringify(q.answer));
}
var strip = function (s) { return String(s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim(); };

/* ==================== 主流程 ==================== */

/** 从插件 settings 里取 type chip 的候选值（无则只跑默认一轮） */
function subTypes(plugin) {
  var s = (plugin.settings || []).find(function (x) { return x && x.key === 'type'; });
  if (!s || !Array.isArray(s.options)) return [null];
  return s.options.map(function (o) { return o.value; });
}

function runOne(plugin, rec) {
  var modules = (rec.moduleIds || []).join('/');
  console.log('\n▶ ' + rec.id + '（' + modules + ' ' + rec.name + '） grades=' + JSON.stringify(rec.grades));
  var grade = (rec.grades && rec.grades[0]) || 4;
  var cases = 0;
  [3, 6, 9].forEach(function (difficulty) {
    subTypes(plugin).forEach(function (type) {
      var before = FAIL;
      var opts = { grade: grade, count: COUNT, difficulty: difficulty };
      if (type) opts.type = type;
      var set;
      try {
        set = plugin.generate(opts);
      } catch (e) {
        FAIL++;
        console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] generate 抛错：' + e.message);
        return;
      }
      var qs = set.questions || [];
      var sigs = {};
      var dup = 0, selfFail = 0;
      qs.forEach(function (q, i) {
        // ① 满分回填（模拟 practice.html 的 collectAnswers：text 用 data-index → answers[i]；multi 用 data-idx+data-field → answers['i:j']）
        var answers = {};
        if (q.inputType === 'multi') {
          if (Array.isArray(q.answer)) q.answer.forEach(function (a, j) { answers[i + ':' + j] = String(a); });
          else answers[i] = String(q.answer);
        } else {
          answers[i] = Array.isArray(q.answer) ? q.answer.join('') : String(q.answer);
        }
        var ok = typeof q.check === 'function' ? q.check(answers, i) : null;
        if (ok === false) { selfFail++; bad('满分回填未判对', q); }
        // ② 题面去重
        var sig = q.q + '|' + (q.svg || '');
        if (sigs[sig]) dup++; else sigs[sig] = 1;
        // ③ 独立求解（Checker 框架：从题面反解 expected，再与插件 answer 比对）
        seenTypes[q.type] = 1;
        var r = CHECKERS.solve(q);
        if (r.problems && r.problems.length) {
          bad('[' + q.type + '] 独立求解失败：' + r.problems[0], q);
        } else {
          coveredTypes[q.type] = 1;
          var chk = CHECKERS.check(q, q.answer);
          if (!chk.correct) bad('[' + q.type + '] ' + chk.reason + '（expected=' + JSON.stringify(chk.expected) + '）', q);
        }
      });
      if (qs.length < COUNT) { FAIL++; console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] 题量不足：' + qs.length + '/' + COUNT); }
      if (dup) { FAIL++; console.log('    ✗ [' + (type || 'default') + ' lv' + difficulty + '] 题面重复 ' + dup + ' 题'); }
      cases++;
      var tag = FAIL === before ? '✓' : '✗';
      console.log('  ' + tag + ' [' + (type || 'default') + ' lv' + difficulty + '] ' + qs.length + ' 题'
        + (dup ? '  重复 ' + dup : '') + (selfFail ? '  自批失败 ' + selfFail : ''));
    });
  });
  return cases;
}

var comp = PLUGIN_REGISTRY.filter(function (r) {
  return !r.isPlaceholder
    && Array.isArray(r.moduleIds) && r.moduleIds.some(function (id) { return /^C\d$/.test(id); })
    // 五年级竞赛新语义题型由 dev/verify-g5-competition.js 专项校验，此处跳过
    && !/g5-c\d/.test(r.id)
    && (!ONLY || r.moduleIds.indexOf(ONLY) >= 0);
});

console.log('🏆 竞赛插件专项校验（答案正确性 / 解唯一性 / 题面去重）');
console.log('   独立求解器：plugins/competition/checkers/（已注册 ' + CHECKERS.types().length + ' 种题型）');
console.log('   抽样：每子题型 × 难度 3/6/9 各 ' + COUNT + ' 题');
if (!comp.length) {
  console.log('\n⚠️  没有匹配的已实现竞赛插件' + (ONLY ? '（--only ' + ONLY + '）' : '') + '，跳过。');
  process.exit(0);
}

var totalCases = 0;
comp.forEach(function (rec) {
  var plugin;
  try {
    plugin = require(path.join(ROOT, rec.file));
  } catch (e) {
    FAIL++;
    console.log('\n✗ ' + rec.id + ' 加载失败：' + e.message);
    return;
  }
  totalCases += runOne(plugin, rec);
});

console.log('\n' + '='.repeat(60));
var allTypes = Object.keys(seenTypes);
var uncovered = allTypes.filter(function (t) { return !CHECKERS.has(t); });
var covPct = allTypes.length ? Math.round(allTypes.filter(function (t) { return coveredTypes[t]; }).length / allTypes.length * 100) : 100;
console.log('checkerCoverage: ' + covPct + '%（' + allTypes.filter(function (t) { return coveredTypes[t]; }).length + '/' + allTypes.length + ' 种 question.type 有可用的独立求解器）');
if (uncovered.length) {
  console.log('❌ 以下 question.type 尚无独立求解器：' + uncovered.join('、'));
  console.log('   请在 plugins/competition/checkers/cN.js 中 register 该 type 的求解器。');
}
if (FAIL === 0 && uncovered.length === 0) {
  console.log('✅ 竞赛插件校验通过：' + comp.length + ' 个插件 / ' + totalCases + ' 组抽样，答案正确、解唯一、题面无重复。');
  process.exit(0);
} else {
  console.log('❌ 竞赛插件校验未通过：共 ' + FAIL + ' 个问题' + (uncovered.length ? ' + ' + uncovered.length + ' 种 type 无独立求解器' : '') + '，请修复后重跑。');
  process.exit(1);
}
