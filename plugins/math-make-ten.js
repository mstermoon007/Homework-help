/**
 * plugins/math-make-ten.js — 拆十法（凑十/平十/破十）插件
 *
 * 迁移自 math-make-ten.html 内联脚本，提供 ExercisePlugin 接口
 * （id/name/grades/subject/generate/render/check）。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-make-ten.js 依赖 shared/common.js（PluginUtil），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次7）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-make-ten.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffleArr(arr) { return _PU.shuffle(arr); }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  // 被减数上限：难度 3 基准 19（一年级 20 以内），难度越高数值越大
  function totalMax() { return Math.min(99, _PU.diffMax(19, _DIFF)); }

  // ============ 卡片式渲染（固定版式，数字随机生成） ============
  // 三种题型统一使用共享 common.js 的 renderGrid 标准 question-card 卡片：
  // 卡片内展示算式 + 拆分解法提示 + 单个答案输入框；版式固定，仅数字随机变化。

  // ============ 题目生成 ============
  function buildCushi() {
    var big = rnd(5, 9);
    var need = 10 - big;
    var small = rnd(Math.max(2, need), 9);
    var rest = small - need;
    return {
      kind: 'cushi', label: '凑十法',
      big: big, small: small, need: need, rest: rest,
      answer: big + small,
      hint: '看大数，想' + big + '加几为10？将' + small + '分成' + need + '和' + rest + '，' + big + '+' + need + '=10，再算 10+' + rest + '。'
    };
  }

  function buildPingshi() {
    var total = rnd(11, totalMax());
    var to10 = total - 10;
    var sub = rnd(Math.max(2, to10 + 1), Math.min(9, total - 1));
    var rest = sub - to10;
    return {
      kind: 'pingshi', label: '平十法',
      total: total, sub: sub, to10: to10, rest: rest,
      answer: total - sub,
      hint: '平十法：看减数，把减数拆成两部分，先减到10，再减去剩下的数。'
    };
  }

  function buildPoshi() {
    var total = rnd(11, totalMax());
    var to10 = total - 10;
    var sub = rnd(2, 9);
    var tenSub = 10 - sub;
    return {
      kind: 'poshi', label: '破十法',
      total: total, sub: sub, to10: to10, tenSub: tenSub,
      answer: total - sub,
      hint: '破十法：把被减数拆成10和几，先用10去减，再把剩下的数加回来。'
    };
  }

  function buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 35) return buildCushi();
    if (r <= 65) return buildPingshi();
    return buildPoshi();
  }

  function generateProblems(type, count) {
    var builder = { cushi: buildCushi, pingshi: buildPingshi, poshi: buildPoshi, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 10, 200);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind === 'cushi' ? (q.kind + '|' + q.big + '+' + q.small) : (q.kind + '|' + q.total + '−' + q.sub);
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 单题判定（标准 Question.card：仅校验主答案，统一 data-index 输入） */
  function checkMakeTenQuestion(question, userAnswers, idx) {
    var v = userAnswers && userAnswers[idx] != null ? userAnswers[idx] : '';
    return String(v).trim() === String(question.answer);
  }

  // ============ ExercisePlugin ============
  var mathMakeTenPlugin = {
    id: 'math-make-ten',
    moduleId: 'M0',
    name: '凑十法',
    pageSubtitle: '凑十法、平十法、破十法',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'makeTen' },
    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '混合' },
          { value: 'cushi', label: '凑十法' },
          { value: 'pingshi', label: '平十法' },
          { value: 'poshi', label: '破十法' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      // 难度统一经 App.Difficulty.consume 解析（批次7）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      // 子题型 → 知识点（凑十/平十/破十，供 Adaptive v2 KP 级统计）
      var KP_BY_KIND = {
        cushi: 'g1-m0-make-ten',
        pingshi: 'g1-m0-make-ten-ping',
        poshi: 'g1-m0-make-ten-po'
      };
      var type = opts.type || 'cushi';
      var count = opts.count || 5;
      var list = generateProblems(type, count);
      var typeNames = { cushi: '凑十法', pingshi: '平十法', poshi: '破十法', mix: '混合' };
      var label = opts.label || typeNames[type] || type;
      var questions = list.map(function (p) {
        var qText = (p.kind === 'cushi')
          ? p.big + ' + ' + p.small + ' = ?'
          : p.total + ' − ' + p.sub + ' = ?';
        var q = {
          type: 'make-ten',
          kind: p.kind,
          q: qText,
          answer: String(p.answer),
          knowledgePointId: KP_BY_KIND[p.kind],
          hint: p.hint,
          render: function (idx, ctx) {
            // 统一卡片式渲染（固定版式、数字随机）：复用共享 renderGrid 的单题卡片结构
            return _PU.renderCard(this, idx, (ctx && ctx.renderOpts) || {});
          },
          check: function (userAnswers, idx) { return checkMakeTenQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
      });
      return {
        questions: questions,
        meta: {
          type: type,
          count: questions.length,
          title: '小学一年级' + label + '练习',
          // 固定列数（卡片式·一行三题）：屏幕与 A4 竖版打印均按 3 列等宽排版，题目不自动跨列
          columns: 3
        }
      };
    },

    render: function (exerciseSet) {
      return _PU.renderGrid(exerciseSet.questions, { columns: 3 });
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkMakeTenQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathMakeTenPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathMakeTenPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
