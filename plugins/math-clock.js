/**
 * plugins/math-clock.js — 认识钟表插件（一年级：整时）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；钟表全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-clock.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }

  // 钟表 SVG 统一由 shared/common.js 的全局 clockSVG(hour, minute) 提供，此处不再重复定义。

  // ============ 题目生成 ============
  // 读钟面：说出钟面表示的整时（1~12 时）
  function buildRead() {
    var hour = rnd(1, 12);
    return {
      kind: 'read',
      hour: hour,
      svg: clockSVG(hour, 0),
      question: '钟面上是几时？',
      answer: String(hour),
      options: (function () {
        var opts = [String(hour), String(((hour % 12) + 1)), String(((hour + 10) % 12) + 1)];
        return _PU.shuffle(opts.slice());
      })()
    };
  }

  // 画整时：给出整时，问时针指向数字几（简化：只考时针）
  function buildPoint() {
    var hour = rnd(1, 12);
    var choices = [hour, ((hour % 12) + 1), ((hour + 10) % 12) + 1];
    return {
      kind: 'point',
      hour: hour,
      question: hour + '时，时针应该指向数字几？',
      answer: String(hour),
      options: _PU.shuffle(choices.slice())
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 60) return buildRead();
    return buildPoint();
  }

  function generateProblems(type, count) {
    var builder = { read: buildRead, point: buildPoint, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.hour + '|' + q.question;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var optsHTML = '';
    p.options.forEach(function (o) {
      optsHTML += '<button type="button" class="opt-btn" data-val="' + o + '" onclick="window.__currentPlugin.__choose(this)" ' +
        'style="cursor:pointer;border:1.5px solid #d5dff0;background:#fafbff;color:#2b3a55;border-radius:9px;padding:10px 18px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '时</button>';
    });

    var svgHTML = p.svg ? '<div style="display:flex;justify-content:flex-start;margin:4px 0;">' + p.svg + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 0.5cm;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header" style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:6px;">' +
      '<span class="num" style="flex:0 0 auto;width:22px;height:22px;border-radius:50%;background:#eef3fb;color:var(--brand);font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      '<span class="q-text" style="font-size:15px;font-weight:800;color:var(--ink);line-height:1.4;display:inline;vertical-align:middle;">' + p.question + '</span>' +
      '</div>' +
      svgHTML +
      '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:flex-start;gap:2px;">' + optsHTML + '</div>' +
      '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">' +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(v) === String(q.answer);
  }

  /** 钟表题目对象（标准 Question 接口：render/check） */
  function toClockQuestion(p) {
    return {
      type: 'clock',
      kind: p.kind,
      data: p,
      answer: String(p.answer),
      hint: p.kind === 'read' ? '分针指向 12，时针指向几就是几时。' : '分针指向 12 时，时针指向几就是几时。',
      render: function (idx, ctx) { return renderCard(this.data, idx); },
      check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
    };
  }

  // ============ ExercisePlugin ============
  var mathClockPlugin = {
    id: 'math-clock',
    moduleId: 'M4',
    name: '认识钟表',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'clock' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'clock',
        options: [
          { value: 'clock',         label: '钟表练习' },
          { value: 'money',         label: '认识人民币' },
          { value: 'comprehensive', label: '综合练习' }
        ]
      }
    ],

    // 动态加载认识人民币插件（money / comprehensive 题型复用其出题逻辑，单一来源）
    loadMoney: function () {
      var loader = (typeof App !== 'undefined' && App.PluginLoader) ? App.PluginLoader : null;
      if (loader && typeof loader.loadPlugin === 'function') {
        return loader.loadPlugin({ id: 'math-money', file: 'plugins/math-money.js' }).then(function (p) {
          global.__currentPlugin = mathClockPlugin; // 恢复当前插件，保证选项按钮 __choose 正确
          return p;
        });
      }
      return Promise.resolve(null);
    },

    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'clock';
      var count = opts.count || 8;
      var grade = opts.grade || 1;

      // 认识人民币 / 综合练习：异步加载 math-money 复用其生成逻辑
      if (type === 'money' || type === 'comprehensive') {
        return mathClockPlugin.loadMoney().then(function (moneyPlugin) {
          if (!moneyPlugin) throw new Error('加载认识人民币插件失败');
          // 认识人民币出满题量；综合练习时钟表与人民币各占一半
          var moneyCount = (type === 'money') ? count : Math.ceil(count / 2);
          var moneySet = moneyPlugin.generate({ grade: grade, count: moneyCount, difficulty: opts.difficulty });
          var moneyQs = (moneySet && moneySet.questions) || [];
          if (type === 'money') {
            return {
              questions: moneyQs,
              meta: { type: 'money', count: moneyQs.length, title: '小学一年级认识人民币' }
            };
          }
          // 综合练习：钟表 + 人民币 各占一半，混合打乱
          var clockQs = generateProblems('mix', count - moneyQs.length).map(toClockQuestion);
          var all = _PU.shuffle(clockQs.concat(moneyQs));
          return {
            questions: all,
            meta: { type: 'comprehensive', count: all.length, title: '小学一年级单位认识综合练习' }
          };
        });
      }

      // 兼容旧类型（math-comprehensive 按知识库 type 调用 read/mix）
      var clockType = (type === 'clock' || type === 'mix') ? 'mix' : type;
      var list = generateProblems(clockType, count);
      var typeNames = { mix: '混合练习', read: '读钟面', point: '时针指向' };
      var label = typeNames[clockType] || '混合';
      var questions = list.map(toClockQuestion);
      return {
        questions: questions,
        meta: { type: clockType, count: questions.length, title: '小学一年级认识钟表（' + label + '）' }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkQuestion(q, userAnswers, i);
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
  global.__currentPlugin = mathClockPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathClockPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
