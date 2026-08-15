/**
 * plugins/math-combination-set.js — 搭配、排列与集合插件（三年级）
 *
 * 题型：
 *   dress  —— 搭配问题：上衣×裤子×鞋 的搭配种数（choice）
 *   menu   —— 用餐搭配：主食×饮品（choice）
 *   set    —— 集合：喜欢A又喜欢B/只喜欢A 的人数（text）
 *   queue  —— 排队：几个小朋友站成一排的种数（choice，枚举思想）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-combination-set.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  var CLOTHES = { top: ['红T恤', '蓝T恤', '白T恤', '灰T恤'], pants: ['牛仔裤', '黑长裤', '卡其裤'], shoes: ['运动鞋', '皮鞋'] };
  var MENU_FOOD = ['米饭', '面条', '馒头', '饺子'];
  var MENU_DRINK = ['牛奶', '豆浆', '果汁', '可乐', '酸奶'];

  // ============ 题目生成 ============
  // 搭配问题：n件上衣 × m条裤子 = 种数
  function buildDress() {
    var nTop = rnd(2, 4), nPants = rnd(2, 4), nShoes = pick([1, 2, 2, 3]);
    var tops = shuffleArr(CLOTHES.top).slice(0, nTop);
    var pants = shuffleArr(CLOTHES.pants).slice(0, nPants);
    var shoes = shuffleArr(CLOTHES.shoes).slice(0, nShoes);
    var total = nTop * nPants * nShoes;
    return {
      kind: 'dress',
      nTop: nTop, topName: tops[0] + '等' + nTop + '件上衣',
      pantsName: nPants + '条裤子', shoesName: nShoes + '双鞋',
      question: '有' + tops[0] + '等 ' + nTop + ' 件上衣，' + pants[0] + '等 ' + nPants + ' 条裤子，' + shoes[0] + '等 ' + nShoes + ' 双鞋。每次选 1 件上衣、1 条裤子和 1 双鞋，一共有多少种不同的穿法？',
      answer: String(total),
      options: shuffleArr([String(total), String(nTop + nPants + nShoes), String(nTop * nPants), String(total + 1)]),
      inputType: 'choice',
      hint: '每种上衣配每种裤子，再分别配上每种鞋：' + nTop + '×' + nPants + '×' + nShoes + '=' + total + '种。'
    };
  }

  // 用餐搭配：m种主食 × n种饮品
  function buildMenu() {
    var nFood = rnd(2, 4), nDrink = rnd(2, 5);
    var foods = shuffleArr(MENU_FOOD).slice(0, nFood);
    var drinks = shuffleArr(MENU_DRINK).slice(0, nDrink);
    var total = nFood * nDrink;
    return {
      kind: 'menu',
      nFood: nFood, nDrink: nDrink,
      question: '早餐店有' + foods[0] + '、' + foods[1] + '等 ' + nFood + ' 种主食，' + drinks[0] + '、' + drinks[1] + '等 ' + nDrink + ' 种饮品。选 1 种主食配 1 种饮品，一共有多少种不同的搭配？',
      answer: String(total),
      options: shuffleArr([String(total), String(nFood + nDrink), String(nFood * nDrink + 1), String(nDrink)]),
      inputType: 'choice',
      hint: '每种主食可以配 ' + nDrink + ' 种饮品：' + nFood + '×' + nDrink + '=' + total + '种。'
    };
  }

  // 集合：喜欢A∪B 与 只喜欢A
  function buildSet() {
    var variant = rnd(1, 3);
    var theme = pick([
      { setA: '喜欢篮球', setB: '喜欢足球', unit: '人' },
      { setA: '喜欢吃苹果', setB: '喜欢吃香蕉', unit: '人' },
      { setA: '订了《故事大王》', setB: '订了《少年科学》', unit: '人' }
    ]);
    var total = rnd(20, 40);
    var likeA = rnd(14, total - 4);
    var likeB = rnd(10, total - 4);
    var both = rnd(4, Math.min(likeA, likeB, 12));
    if (variant === 1) {
      // 只喜欢A
      return {
        kind: 'set',
        variant: 'onlyA',
        question: '三(1)班有 ' + total + ' 人，其中 ' + likeA + ' 人' + theme.setA + '，' + likeB + ' 人' + theme.setB + '，' + both + ' 人两种都喜欢。' + '只' + theme.setA + '的有多少人？',
        answer: String(likeA - both),
        hint: '只喜欢篮球 = 喜欢篮球的总人数 − 两种都喜欢的：' + likeA + '−' + both + '=' + (likeA - both) + '人。',
        inputType: 'text'
      };
    }
    if (variant === 2) {
      // 至少喜欢一种（并集）
      return {
        kind: 'set',
        variant: 'union',
        question: '三(1)班有 ' + total + ' 人，其中 ' + likeA + ' 人' + theme.setA + '，' + likeB + ' 人' + theme.setB + '，' + both + ' 人两种都喜欢。' + theme.setA + '或' + theme.setB + '（至少喜欢一种）的有多少人？',
        answer: String(likeA + likeB - both),
        hint: '把喜欢A的和喜欢B的加起来，两种都喜欢的被算了两次，要减去一次：' + likeA + '+' + likeB + '−' + both + '=' + (likeA + likeB - both) + '人。',
        inputType: 'text'
      };
    }
    // 两种都喜欢（交集）
    return {
      kind: 'set',
      variant: 'intersect',
      question: '三(1)班有 ' + total + ' 人，其中 ' + likeA + ' 人' + theme.setA + '，' + likeB + ' 人' + theme.setB + '，' + theme.setA + '和' + theme.setB + '都喜欢的有 ' + both + ' 人，这个班' + theme.setA + '或' + theme.setB + '的有多少人？',
      answer: String(likeA + likeB - both),
      hint: '同样用加法再减重复：' + likeA + '+' + likeB + '−' + both + '=' + (likeA + likeB - both) + '人。',
      inputType: 'text'
    };
  }

  // 排队：n个小朋友站成一排的种数（2~3人）
  function buildQueue() {
    var n = rnd(2, 3);
    var total = n === 2 ? 2 : 6;
    var kids = pick([['小明', '小红', '小刚'], ['小华', '小丽', '小美'], ['小强', '小芳', '小军']]);
    var question = n === 2
      ? kids[0] + '和' + kids[1] + '两人站成一排合影，有几种不同的站法？'
      : kids[0] + '、' + kids[1] + '、' + kids[2] + '三人站成一排合影，有几种不同的站法？';
    return {
      kind: 'queue',
      n: n,
      question: question,
      answer: String(total),
      options: shuffleArr([String(total), String(total + 1), String(n)]) ,
      inputType: 'choice',
      hint: n === 2 ? '先站一个人，另一个人有 2 种站法。' : '可以这样想：先把' + kids[0] + '固定，另外两人有 2 种站法；' + kids[0] + '换 3 个位置，就有 3×2=6 种。',
      kids: kids
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 30) return buildDress();
    if (r <= 55) return buildMenu();
    if (r <= 80) return buildSet();
    return buildQueue();
  }

  function generateProblems(type, count) {
    var builder = { dress: buildDress, menu: buildMenu, set: buildSet, queue: buildQueue, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.question + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCombCard(p, i) {
    var inputHTML = '';
    if (p.inputType === 'choice') {
      var optsHTML = '';
      p.options.forEach(function (o) {
        optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
          'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        '<span style="font-size:13px;color:#7a879c;font-weight:600;">人</span>' +
        '</div>';
    }

    var hintHTML = p.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#5b8def;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (i + 1) + '</span>' +
      hintHTML +
      '<div style="font-size:15px;font-weight:800;color:#27324a;margin:4px 0 8px;line-height:1.5;">' + p.question + '</div>' +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkCombQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return _PU.normHZ(v) === _PU.normHZ(q.answer);
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(q.answer).replace(/\s/g, '');
  }

  // ============ ExercisePlugin ============
  var mathCombinationSetPlugin = {
    id: 'math-combination-set',
    moduleId: 'M10',
    name: '搭配与集合',
    grades: [3],
    subject: 'math',
    category: 'statistics',
    printConfig: { pageType: 'combinationSet' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',   label: '混合' },
          { value: 'dress', label: '穿搭搭配' },
          { value: 'menu',  label: '用餐搭配' },
          { value: 'set',   label: '集合' },
          { value: 'queue', label: '排队' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', dress: '穿搭搭配', menu: '用餐搭配', set: '集合', queue: '排队' };
      var label = typeNames[type] || '混合';
      var questions = list.map(function (p) {
        return {
          type: 'combination-set',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          hint: p.kind === 'dress' ? '把选上衣、选裤子、选鞋的种数乘起来。' :
                p.kind === 'menu' ? '用乘法算搭配种数。' :
                p.kind === 'set' ? '两种都喜欢的人被算了两次，要减去一次。' :
                p.kind === 'queue' ? '可以先固定一个人，再排另外的。' : undefined,
          render: function (idx, ctx) { return renderCombCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkCombQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: '小学三年级搭配与集合（' + label + '）' }
      };
    },

    render: function (exerciseSet) {
      var html = '';
      exerciseSet.questions.forEach(function (q, i) { html += q.render(i); });
      return html;
    },

    check: function (exerciseSet, userAnswers) {
      var correct = 0;
      var results = [];
      var correctAnswers = [];
      exerciseSet.questions.forEach(function (q, i) {
        var isRight = q.check ? q.check(userAnswers, i) : checkCombQuestion(q, userAnswers, i);
        if (isRight) correct++;
        results.push(isRight);
        correctAnswers.push(String(q.answer));
      });
      var total = exerciseSet.questions.length;
      var score = total === 0 ? 0 : Math.round((correct / total) * 100);
      var message = '继续加油！';
      if (score === 100) message = '太棒了！全对！';
      else if (score >= 80) message = '很不错！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    },

    // 选项按钮点击（choice 题型）
    __choose: function (btn) {
      var card = btn;
      while (card && card.className.indexOf('question-card') === -1) card = card.parentElement;
      if (!card) return;
      var inp = card.querySelector('.choice-inp');
      if (inp) inp.value = btn.getAttribute('data-val');
      var btns = card.querySelectorAll('.opt-btn');
      for (var i = 0; i < btns.length; i++) {
        btns[i].style.background = '#fafbff';
        btns[i].style.borderColor = '#d5dff0';
      }
      btn.style.background = '#5b8def';
      btn.style.borderColor = '#3b5bdb';
      btn.style.color = '#fff';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathCombinationSetPlugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = mathCombinationSetPlugin;

})(typeof window !== 'undefined' ? window : globalThis);