#!/usr/bin/env node
/**
 * dev/verify-g5-competition.js — 五年级竞赛新题型生成器校验
 *
 * 对 5 个 g5 竞赛插件（C2/C3/C5/C7/C9）的每个子题型：
 *   1. 生成 count 题（断言非空、题面不重复）
 *   2. 逐题渲染（断言无异常、含题目卡片）
 *   3. 满分回填 + 批改（断言 100 分，自洽性检查）
 *
 * 用法：node dev/verify-g5-competition.js [--count 10]
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var COUNT = 10;
process.argv.forEach(function (a, i, arr) { if (a === '--count') COUNT = Number(arr[i + 1]) || 10; });

require(path.join(ROOT, 'shared/common.js'));
require(path.join(ROOT, 'shared/knowledge-bank.js'));
require(path.join(ROOT, 'plugins/registry.js'));

var PLUGINS = ['math-competition-g5-c2', 'math-competition-g5-c3', 'math-competition-g5-c5', 'math-competition-g5-c7', 'math-competition-g5-c9'];
var FAIL = 0, TOTAL = 0;

function answerPart(q, j) {
  var a = q.answer;
  if (a && typeof a === 'object' && !Array.isArray(a) && 'q' in a && 'r' in a) return j === 0 ? String(a.q) : String(a.r);
  if (q.answerParts && q.answerParts.length > j) return String(q.answerParts[j]);
  var parts;
  if (Array.isArray(a)) parts = a; else parts = String(a).split(/……|、|,|，/).filter(function (s) { return s !== ''; });
  return parts.length > j ? String(parts[j]) : '';
}

function collectPerfect(plugin, set) {
  var answers = {};
  var cardsHtml = '';
  try { cardsHtml = plugin.render(set) || ''; } catch (e) { cardsHtml = ''; }
  // 逐题渲染，收集输入框并回填
  set.questions.forEach(function (q, i) {
    var html = '';
    try { html = (q.render ? q.render(i) : plugin.render(set)) || ''; } catch (e) { html = ''; }
    var multi = /data-idx="[0-9]+" data-field="[0-9]+"/.test(html) || (q.inputType === 'multi');
    if (multi) {
      var n = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      for (var j = 0; j < n; j++) answers[i + ':' + j] = answerPart(q, j);
    } else {
      answers[i] = String(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
    }
  });
  return answers;
}

PLUGINS.forEach(function (pid) {
  var p = require(path.join(ROOT, 'plugins', pid + '.js'));
  if (!p || !p.generate) { console.log('❌ ' + pid + ' 无法加载'); FAIL++; return; }
  var types = ((p.settings && p.settings[0] && p.settings[0].options) || []).map(function (o) { return o.value; }).filter(function (v) { return v !== 'mix'; });

  types.forEach(function (t) {
    var set;
    try { set = p.generate({ grade: 5, count: COUNT, type: t }); } catch (e) { console.log('❌ ' + pid + '[' + t + '] generate 出错: ' + e.message); FAIL++; return; }
    var qs = set.questions || set;
    TOTAL++;
    if (!qs || !qs.length) { console.log('❌ ' + pid + '[' + t + '] 生成 0 题'); FAIL++; return; }

    // 题面不重复
    var seen = {}, dup = 0;
    qs.forEach(function (q) { if (seen[q.q]) dup++; seen[q.q] = true; });

    // 逐题渲染
    var renderFail = 0;
    qs.forEach(function (q, i) {
      var html = '';
      try { html = q.render ? q.render(i) : ''; } catch (e) { renderFail++; }
      if (html.indexOf('question-card') === -1) renderFail++;
    });

    // 满分回填批改
    var answers = collectPerfect(p, set);
    var res = null;
    try { res = p.check(set, answers); } catch (e) { res = null; }
    var score = res && typeof res.score === 'number' ? res.score : -1;
    var status = (dup === 0 && renderFail === 0 && score === 100) ? '✓' : '❌';
    if (status === '❌') {
      FAIL++;
      console.log(status + ' ' + pid + '[' + t + '] 生成' + qs.length + '题 重复' + dup + ' 渲染失败' + renderFail + ' 得分' + score + '/' + COUNT);
    }
  });
});

console.log('\n========== g5 竞赛生成器校验：' + (FAIL === 0 ? '✓ 全部通过' : '❌ ' + FAIL + ' 项失败') + '（' + TOTAL + ' 个子题型）==========');
process.exit(FAIL ? 1 : 0);
