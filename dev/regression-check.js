#!/usr/bin/env node
/**
 * dev/regression-check.js — 全插件「满分回填」回归
 *
 * 目的：模拟学生把每道题全部答对（按 practice.html 的 collectAnswers 约定回填），
 * 期望任何插件 / 任何年级的批改结果都是 100 分。出现非 100 分即说明：
 *   - 题面空位数与答案结构不一致（如两空一框、拼接串答案）；
 *   - 或自定义 check 与渲染输入框的收集方式不匹配。
 *
 * 用法：node dev/regression-check.js [--count 20] [--only g4,g5]
 * 输出：逐插件得分 + 综合练习各年级得分，全部 100 则退出码 0。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

// 1) 依赖加载（顺序：common → knowledge-bank → registry）
require(path.join(ROOT, 'shared/common.js'));            // global.PluginUtil / App
require(path.join(ROOT, 'shared/knowledge-bank.js'));    // global.KnowledgeBank
require(path.join(ROOT, 'plugins/registry.js'));         // global.PLUGIN_REGISTRY

var PLUGIN_REGISTRY = global.PLUGIN_REGISTRY || [];
var ONLY = null, COUNT = 20;
process.argv.slice(2).forEach(function (a, i, arr) {
  if (a === '--count') COUNT = Number(arr[i + 1]) || 20;
  if (a === '--only') ONLY = String(arr[i + 1] || '').split(',');
});

/** 从题目对象推导「第 j 个输入框」的正确答案（与 collectAnswers 的 i:j 对应） */
function answerPart(q, j) {
  var a = q.answer;
  // 有余数除法（math-oral 等）：answer 为 { q, r } 对象 → 商/余数双框
  if (a && typeof a === 'object' && !Array.isArray(a) && 'q' in a && 'r' in a) {
    return j === 0 ? String(a.q) : j === 1 ? String(a.r) : '';
  }
  if (q.answerParts && q.answerParts.length > j) return String(q.answerParts[j]);
  var parts;
  if (Array.isArray(a)) parts = a;
  else parts = String(a).split(/……|、|,|，/).filter(function (s) { return s !== ''; });
  return parts.length > j ? String(parts[j]) : '';
}

/** 从题目对象推导「单输入框」的正确答案 */
function answerWhole(q) {
  return String(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
}

/**
 * 模拟 practice.html 的 collectAnswers：解析题目渲染输出中的输入框，
 * 按 data-index（单框）/ data-idx:data-field（多框）回填正确答案。
 * 渲染来源：优先逐题 q.render(i)；无逐题 render 的插件（如 chinese-pinyin，
 * 由 plugin.render 整组输出）回退到整组 HTML 按 .question-card 卡片切片。
 */
function collectPerfectAnswers(plugin, set) {
  var answers = {};
  var whole = '';
  try { whole = plugin.render(set) || ''; } catch (e) { whole = ''; }
  var cards = [];
  var reCard = /<div class="question-card[^"]*"/g, cm, starts = [];
  while ((cm = reCard.exec(whole))) starts.push(cm.index);
  for (var c = 0; c < starts.length; c++) {
    cards.push(whole.slice(starts[c], c + 1 < starts.length ? starts[c + 1] : whole.length));
  }
  set.questions.forEach(function (q, i) {
    var html = '';
    if (typeof q.render === 'function') html = q.render(i);
    else if (cards[i]) html = cards[i];
    if (!html) return;
    // 多框（data-idx + data-field）
    var reMulti = /data-idx="(\d+)"\s+data-field="(\d+)"/g, m;
    var hasMulti = false;
    while ((m = reMulti.exec(html))) {
      hasMulti = true;
      answers[m[1] + ':' + m[2]] = answerPart(q, Number(m[2]));
    }
    if (hasMulti) return;
    // 单框（data-index），choice 的隐藏 input 同样适用
    var reSingle = /data-index="(\d+)"/g, s;
    while ((s = reSingle.exec(html))) {
      answers[s[1]] = answerWhole(q);
    }
  });
  return answers;
}

/** 预加载 registry 声明的 deps（如 pinyin-bank.js），返回错误信息或 null */
function loadDeps(rec) {
  var missing = null;
  (rec.deps || []).forEach(function (d) {
    try { require(path.join(ROOT, d)); } catch (e) { missing = '依赖加载失败 ' + d + ': ' + e.message; }
  });
  return missing;
}

/** 需要完整 Generator Runtime（strategy-engine.bundle.js）的插件 id 集 */
var RUNTIME_PLUGIN_IDS = {
  'math-comprehensive': true
};

/** 跑单个插件：逐年级生成 → 渲染 → 满分回填 → 批改（generate 可能返回 Promise） */
function runPlugin(rec) {
  var depErr = loadDeps(rec);
  if (depErr) return Promise.resolve({ rec: rec, grades: [{ grade: '-', score: -1, detail: depErr }] });

  var plugin;
  if (RUNTIME_PLUGIN_IDS[rec.id]) {
    // 综合练习类依赖 Generator Runtime（M4-19），需经 dev/plugin-loader 在浏览器等效
    // 沙箱内装配 strategy-engine.bundle.js 等共享层，而非裸 require（否则会抛
    // 「Generator Runtime 未加载」）。加载器与 regression-check 同样兼容
    // module.exports 与 window.__currentPlugin 两种导出。
    var loaded = require(path.join(ROOT, 'dev/plugin-loader.js')).loadPlugin(rec.id);
    if (loaded.error) {
      return Promise.resolve({ rec: rec, grades: [{ grade: '-', score: -1, detail: loaded.error }] });
    }
    plugin = loaded.plugin;
  } else {
    var mod = require(path.join(ROOT, rec.file));
    plugin = (mod && mod.generate) ? mod : global.__currentPlugin;
    if (!plugin || !plugin.generate) {
      return Promise.resolve({ rec: rec, grades: [{ grade: '-', score: -1, detail: '无法加载插件对象' }] });
    }
  }

  var grades = plugin.grades || rec.grades || [1];
  // 串行处理各年级，兼容异步 generate（math-comprehensive 等）
  var results = [];
  var chain = Promise.resolve();
  grades.forEach(function (g) {
    chain = chain.then(function () {
      return Promise.resolve()
        .then(function () { return plugin.generate({ grade: g, count: COUNT }); })
        .then(function (set) {
          if (!set || !set.questions || !set.questions.length) {
            results.push({ grade: g, score: -1, detail: '生成题目为空' });
            return;
          }
          plugin.render(set); // 确认整组渲染不抛错
          var answers = collectPerfectAnswers(plugin, set);
          var result = plugin.check(set, answers);
          var entry = { grade: g, score: result.score, total: result.total };
          if (result.score !== 100) {
            var wrong = [];
            result.results.forEach(function (ok, i) { if (!ok) wrong.push(i); });
            entry.wrong = wrong;
            entry.wrongDetail = wrong.map(function (i) {
              var q = set.questions[i];
              return '#' + (i + 1) + ' type=' + (q.type || '?') + ' inputType=' + (q.inputType || '?') +
                ' answer=' + JSON.stringify(q.answer) +
                (q.answerParts ? ' answerParts=' + JSON.stringify(q.answerParts) : '');
            }).join(' | ');
          }
          results.push(entry);
        })
        .catch(function (e) {
          results.push({ grade: g, score: -1, detail: '异常: ' + e.message });
        });
    });
  });
  return chain.then(function () { return { rec: rec, grades: results }; });
}

function report(r) {
  r.grades.forEach(function (g) {
    if (g.score === 100) {
      console.log('✓ ' + r.rec.id + '（' + g.grade + ' 年级）' + g.score + '/' + g.total);
      return false;
    }
    console.log('✗ ' + r.rec.id + '（' + g.grade + ' 年级）score=' + g.score +
      (g.detail || '') + (g.wrong ? ' 错题: ' + g.wrong.join(',') : ''));
    if (g.wrongDetail) console.log('    ' + g.wrongDetail);
    return true;
  });
}

function inScope(rec) {
  if (!ONLY) return true;
  return ONLY.some(function (k) { return rec.id.indexOf(k) !== -1; });
}

// 2) 主流程：逐插件回归（跳过占位；综合练习最后跑）
var failures = 0, totalGrades = 0;
var allResults = [];
var edgeTotal = 0, edgePass = 0;

/** 任务12：边界值用例——count=0 / count=-1 / grade=99，要求不崩溃且返回合理结构 */
function runEdgeCases(rec) {
  var mod;
  try { mod = require(path.join(ROOT, rec.file)); } catch (e) { return Promise.resolve({ pass: 0, total: 0 }); }
  var plugin = (mod && mod.generate) ? mod : global.__currentPlugin;
  if (!plugin || !plugin.generate) return Promise.resolve({ pass: 0, total: 0 });
  var base = { grade: (Array.isArray(plugin.grades) && plugin.grades[0]) || 1, type: 'mix' };
  var CASES = [
    ['count=0', { count: 0 }],
    ['count=-1', { count: -1 }],
    ['grade=99', { grade: 99 }]
  ];
  // 降噪：工厂的「count 应为正整数」提醒在边界用例中属预期输出
  var origWarn = console.warn;
  console.warn = function () {
    var m = arguments[0] || '';
    if (String(m).indexOf('应为正整数') !== -1) return;
    return origWarn.apply(console, arguments);
  };
  var pass = 0, total = 0;
  var chain = Promise.resolve();
  CASES.forEach(function (c) {
    chain = chain.then(function () {
      total++;
      var opts = Object.assign({}, base, c[1]);
      return Promise.resolve().then(function () { return plugin.generate(opts); }).then(function (r) {
        if (r && typeof r === 'object' && Array.isArray(r.questions)) { pass++; return; }
        console.log('  ✗ [边界] ' + rec.id + ' ' + c[0] + '：返回结构不合理');
      }, function (e) {
        // 语义分级：TypeError/undefined 类 = 真崩溃（判失败）；
        // 带友好文案的业务拒绝（如「该年级暂无可用题型」）视为优雅降级（判通过）
        var msg = String((e && e.message) || e);
        if (/Cannot read|of (undefined|null)|is not a function|TypeError|ReferenceError/i.test(msg)) {
          console.log('  ✗ [边界] ' + rec.id + ' ' + c[0] + '：' + msg);
          return;
        }
        pass++;
      });
    });
  });
  return chain.then(function () {
    console.warn = origWarn;
    return { pass: pass, total: total };
  }, function (e) {
    console.warn = origWarn;
    console.log('  ✗ [边界] ' + rec.id + '：' + (e.message || e));
    return { pass: pass, total: total };
  });
}
var queue = PLUGIN_REGISTRY.filter(function (rec) {
  if (!inScope(rec)) return false;
  if (rec.isPlaceholder) { console.log('跳过占位插件: ' + rec.id); return false; }
  return true;
});
// 综合练习挪到队尾（确保其子插件已全部 require 缓存）
queue.sort(function (a, b) { return (a.id === 'math-comprehensive' ? 1 : 0) - (b.id === 'math-comprehensive' ? 1 : 0); });

var main = Promise.resolve();
queue.forEach(function (rec) {
  main = main.then(function () {
    return runPlugin(rec).then(function (r) {
      if (r.error) { console.log('✗ ' + rec.id + '：' + r.error); failures++; return null; }
      allResults.push(r);
      r.grades.forEach(function (g) {
        totalGrades++;
        if (g.score !== 100) failures++;
      });
      report(r);
      // 任务12：逐插件边界值用例（含语文/英语插件）
      return runEdgeCases(rec);
    }).then(function (er) {
      if (!er) return;
      edgeTotal += er.total; edgePass += er.pass;
      if (er.total !== er.pass) failures++;
    });
  });
});

main.then(function () {
  console.log('\n========== 回归结果：' + (failures ? '✗ ' + failures + ' 项失败' : '✓ 全部通过') +
    '（共 ' + totalGrades + ' 个插件·年级组合，每组合 ' + COUNT + ' 题）==========');
  console.log('边界用例：' + edgePass + '/' + edgeTotal + ' 通过（count=0 / count=-1 / grade=99）');
  // 任务14：分科目回归统计（语文/英语插件已随 registry 全量纳入，此处显式汇报）
  var bySubject = {};
  allResults.forEach(function (r) {
    var s = r.rec.subject || 'unknown';
    bySubject[s] = bySubject[s] || { pass: 0, total: 0 };
    r.grades.forEach(function (g) {
      bySubject[s].total++;
      if (g.score === 100) bySubject[s].pass++;
    });
  });
  Object.keys(bySubject).sort().forEach(function (s) {
    var b = bySubject[s];
    console.log('  · ' + s + '：' + b.pass + '/' + b.total + ' 组合满分');
  });
  process.exit(failures ? 1 : 0);
});
