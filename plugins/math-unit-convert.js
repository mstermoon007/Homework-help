/**
 * plugins/math-unit-convert.js — 单位换算插件（二年级：长度/质量单位）
 *
 * 题型：
 *   convert  —— 单位换算：长度（米/厘米/毫米/千米）与质量（克/千克）互化
 *   fillUnit —— 填合适单位：根据生活常识为数量选择正确的单位（choice）
 *
 * 提供 ExercisePlugin 接口（id/name/grades/subject/category/generate/render/check），
 * 供 practice.html / dev/plugin-check.html / math-comprehensive 使用。
 * 随机数统一使用 shared/common.js 的 PluginUtil；标准 Question 对象走 render/check。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-unit-convert.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffleArr(arr) { return _PU.shuffle(arr.slice()); }

  // ============ 难度/年级（generate 时设置） ============
  var _DIFF = 3;
  var _GRADE = 2;

  // ============ 单位定义 ============
  // 长度换算：单位 → 相对基准（厘米）
  var LENGTH_UNITS = [
    { name: '厘米', unit: 'cm', factor: 1, cn: '厘米' },
    { name: '毫米', unit: 'mm', factor: 10, cn: '毫米' },
    { name: '米', unit: 'm', factor: 100, cn: '米' },
    { name: '千米', unit: 'km', factor: 100000, cn: '千米' }
  ];
  // 质量换算：单位 → 相对基准（克）
  var MASS_UNITS = [
    { name: '克', unit: 'g', factor: 1, cn: '克' },
    { name: '千克', unit: 'kg', factor: 1000, cn: '千克' }
  ];
  // 时间换算：单位 → 相对基准（秒）
  var TIME_UNITS = [
    { name: '秒', unit: 's', factor: 1, cn: '秒' },
    { name: '分', unit: 'min', factor: 60, cn: '分' },
    { name: '时', unit: 'h', factor: 3600, cn: '时' }
  ];
  // 面积换算：单位 → 相对基准（平方厘米）
  var AREA_UNITS = [
    { name: '平方厘米', unit: 'cm²', factor: 1, cn: '平方厘米' },
    { name: '平方分米', unit: 'dm²', factor: 100, cn: '平方分米' },
    { name: '平方米', unit: 'm²', factor: 10000, cn: '平方米' }
  ];
  // 长度/质量/时间/面积单位的中文别名（提示用）
  var UNIT_CN = {
    '米': '米', '厘米': '厘米', '毫米': '毫米', '千米': '千米',
    '克': '克', '千克': '千克', '吨': '吨',
    '秒': '秒', '分': '分', '时': '时', '时': '时',
    '平方厘米': '平方厘米', '平方分米': '平方分米', '平方米': '平方米'
  };

  // 生活常识「填合适单位」题库：{ value: 正确单位, sentence: 描述, options: 干扰项 }
  var FILL_ITEMS = [
    { grades: [1, 2], sentence: '一支铅笔长约 18（  ）', value: '厘米', options: ['米', '毫米', '厘米'] },
    { grades: [1, 2], sentence: '课桌的高大约是 70（  ）', value: '厘米', options: ['米', '厘米', '千米'] },
    { grades: [1, 2], sentence: '一张床长约 2（  ）', value: '米', options: ['厘米', '米', '千米'] },
    { grades: [1, 2], sentence: '教室的黑板长约 4（  ）', value: '米', options: ['厘米', '米', '毫米'] },
    { grades: [1, 2], sentence: '一枚硬币的厚度大约是 2（  ）', value: '毫米', options: ['厘米', '毫米', '米'] },
    { grades: [1, 2], sentence: '从家到学校大约 1（  ）', value: '千米', options: ['米', '千米', '厘米'] },
    { grades: [1, 2], sentence: '一个鸡蛋大约重 60（  ）', value: '克', options: ['克', '千克', '吨'] },
    { grades: [1, 2], sentence: '一袋大米重 25（  ）', value: '千克', options: ['克', '千克', '吨'] },
    { grades: [1, 2], sentence: '一个苹果大约重 200（  ）', value: '克', options: ['千克', '克', '吨'] },
    { grades: [1, 2], sentence: '小明今年 8 岁，体重约 25（  ）', value: '千克', options: ['克', '千克', '吨'] },
    { grades: [1, 2], sentence: '一盒牛奶大约重 250（  ）', value: '克', options: ['千克', '克', '吨'] },
    { grades: [1, 2], sentence: '一辆小汽车每时行驶 60（  ）', value: '千米', options: ['米', '千米', '厘米'] },
    { grades: [1, 2], sentence: '一支钢笔长约 14（  ）', value: '厘米', options: ['米', '厘米', '毫米'] },
    { grades: [1, 2], sentence: '一袋盐大约重 500（  ）', value: '克', options: ['克', '千克', '吨'] },
    { grades: [1, 2], sentence: '一个西瓜大约重 4（  ）', value: '千克', options: ['克', '千克', '吨'] },
    // ===== 三年级：时间 =====
    { grades: [3], sentence: '一节课的时间是 40（  ）', value: '分', options: ['分', '时', '秒'] },
    { grades: [3], sentence: '一场电影大约放映 2（  ）', value: '时', options: ['时', '分', '秒'] },
    { grades: [3], sentence: '眨一下眼睛大约用 1（  ）', value: '秒', options: ['秒', '分', '时'] },
    { grades: [3], sentence: '从下午 2 时到下午 4 时，经过了 2（  ）', value: '时', options: ['时', '分', '秒'] },
    { grades: [3], sentence: '跑 100 米大约需要 15（  ）', value: '秒', options: ['秒', '分', '时'] },
    // ===== 三年级：质量（吨） =====
    { grades: [3], sentence: '一头大象大约重 4（  ）', value: '吨', options: ['吨', '千克', '克'] },
    { grades: [3], sentence: '一艘轮船大约载重 200（  ）', value: '吨', options: ['吨', '千克', '克'] },
    // ===== 三年级：面积 =====
    { grades: [3], sentence: '一块手帕的面积大约是 4（  ）', value: '平方分米', options: ['平方分米', '平方米', '平方厘米'] },
    { grades: [3], sentence: '数学书封面的面积大约是 300（  ）', value: '平方厘米', options: ['平方厘米', '平方分米', '平方米'] },
    { grades: [3], sentence: '一块黑板的面积大约是 4（  ）', value: '平方米', options: ['平方米', '平方分米', '平方厘米'] },
    { grades: [3], sentence: '课桌面的大小大约是 40（  ）', value: '平方分米', options: ['平方分米', '平方米', '平方厘米'] },
    // ===== 三年级：长度（毫米、分米、千米）=====
    { grades: [3], sentence: '一根火柴长约 40（  ）', value: '毫米', options: ['毫米', '厘米', '米'] },
    { grades: [3], sentence: '一条毛巾长约 8（  ）', value: '分米', options: ['分米', '厘米', '米'] },
    { grades: [3], sentence: '校园跑道一圈长 400（  ）', value: '米', options: ['米', '千米', '分米'] },
    { grades: [3], sentence: '从北京到上海大约 1200（  ）', value: '千米', options: ['千米', '米', '厘米'] },
    { grades: [3], sentence: '一张纸的厚度大约 0.1（  ）', value: '毫米', options: ['毫米', '厘米', '分米'] },
    { grades: [3], sentence: '一把尺子长 3（  ）', value: '分米', options: ['分米', '厘米', '米'] },
    // ===== 三年级：质量（吨）更多 =====
    { grades: [3], sentence: '一辆大货车载重 10（  ）', value: '吨', options: ['吨', '千克', '克'] },
    { grades: [3], sentence: '一头成年牛重约 500（  ）', value: '千克', options: ['千克', '吨', '克'] },
    // ===== 三年级：面积更多 =====
    { grades: [3], sentence: '一张邮票的面积约 4（  ）', value: '平方厘米', options: ['平方厘米', '平方分米', '平方米'] },
    { grades: [3], sentence: '操场的面积大约 4000（  ）', value: '平方米', options: ['平方米', '平方分米', '平方千米'] },
    { grades: [3], sentence: '一块地毯的面积约 6（  ）', value: '平方米', options: ['平方米', '平方分米', '平方厘米'] }
  ];

  // 难度越高，允许更大的数值
  function bigNum() {
    if (_DIFF <= 4) return 5;
    if (_DIFF <= 6) return 20;
    if (_DIFF <= 8) return 50;
    return 100;
  }

  // ============ 题目生成 ============
  // 单位换算：长度/质量单位互化（text 单输入）
  function buildConvert() {
    var maxN = bigNum();
    var builders = [
      // 米 → 厘米
      function () {
        var n = rnd(1, Math.min(maxN, 10));
        return { q: n + ' 米 = ? 厘米', answer: String(n * 100), unit: '厘米', tip: '1 米 = 100 厘米' };
      },
      // 厘米 → 米
      function () {
        var n = rnd(1, Math.min(maxN, 10)) * 100;
        return { q: n + ' 厘米 = ? 米', answer: String(n / 100), unit: '米', tip: '100 厘米 = 1 米' };
      },
      // 厘米 → 毫米
      function () {
        var n = rnd(1, maxN);
        return { q: n + ' 厘米 = ? 毫米', answer: String(n * 10), unit: '毫米', tip: '1 厘米 = 10 毫米' };
      },
      // 毫米 → 厘米
      function () {
        var n = rnd(1, Math.min(maxN, 10)) * 10;
        return { q: n + ' 毫米 = ? 厘米', answer: String(n / 10), unit: '厘米', tip: '10 毫米 = 1 厘米' };
      },
      // 千克 → 克
      function () {
        var n = rnd(1, Math.min(maxN, 5));
        return { q: n + ' 千克 = ? 克', answer: String(n * 1000), unit: '克', tip: '1 千克 = 1000 克' };
      },
      // 克 → 千克
      function () {
        var n = rnd(1, Math.min(maxN, 5)) * 1000;
        return { q: n + ' 克 = ? 千克', answer: String(n / 1000), unit: '千克', tip: '1000 克 = 1 千克' };
      }
    ];
    // 难度高时追加：千米 ↔ 米
    if (_DIFF >= 6) {
      builders.push(
        function () {
          var n = rnd(1, Math.min(maxN, 9));
          return { q: n + ' 千米 = ? 米', answer: String(n * 1000), unit: '米', tip: '1 千米 = 1000 米' };
        },
        function () {
          var n = rnd(1, Math.min(maxN, 9)) * 1000;
          return { q: n + ' 米 = ? 千米', answer: String(n / 1000), unit: '千米', tip: '1000 米 = 1 千米' };
        }
      );
    }
    // 三年级追加：时间、吨、面积换算
    if (_GRADE >= 3) {
      builders.push(
        // 时 ↔ 分
        function () {
          var n = rnd(1, 10);
          return { q: n + ' 时 = ? 分', answer: String(n * 60), unit: '分', tip: '1 时 = 60 分' };
        },
        function () {
          var n = rnd(1, 9) * 60;
          return { q: n + ' 分 = ? 时', answer: String(n / 60), unit: '时', tip: '60 分 = 1 时' };
        },
        // 分 ↔ 秒
        function () {
          var n = rnd(1, 10);
          return { q: n + ' 分 = ? 秒', answer: String(n * 60), unit: '秒', tip: '1 分 = 60 秒' };
        },
        function () {
          var n = rnd(1, 9) * 60;
          return { q: n + ' 秒 = ? 分', answer: String(n / 60), unit: '分', tip: '60 秒 = 1 分' };
        },
        // 吨 ↔ 千克
        function () {
          var n = rnd(2, 12);
          return { q: n + ' 吨 = ? 千克', answer: String(n * 1000), unit: '千克', tip: '1 吨 = 1000 千克' };
        },
        function () {
          var n = rnd(2, 10) * 1000;
          return { q: n + ' 千克 = ? 吨', answer: String(n / 1000), unit: '吨', tip: '1000 千克 = 1 吨' };
        },
        // 平方米 ↔ 平方分米
        function () {
          var n = rnd(2, 30);
          return { q: n + ' 平方米 = ? 平方分米', answer: String(n * 100), unit: '平方分米', tip: '1 平方米 = 100 平方分米' };
        },
        function () {
          var n = rnd(1, 20) * 100;
          return { q: n + ' 平方分米 = ? 平方米', answer: String(n / 100), unit: '平方米', tip: '100 平方分米 = 1 平方米' };
        },
        // 平方分米 ↔ 平方厘米
        function () {
          var n = rnd(2, 40);
          return { q: n + ' 平方分米 = ? 平方厘米', answer: String(n * 100), unit: '平方厘米', tip: '1 平方分米 = 100 平方厘米' };
        },
        function () {
          var n = rnd(1, 30) * 100;
          return { q: n + ' 平方厘米 = ? 平方分米', answer: String(n / 100), unit: '平方分米', tip: '100 平方厘米 = 1 平方分米' };
        }
      );
    }
    // 最高难度追加：米 ↔ 分米、复合换算（千米 → 厘米）
    if (_DIFF >= 9) {
      builders.push(
        function () {
          var n = rnd(1, 9);
          return { q: n + ' 米 = ? 厘米 = ? 毫米', answer: String(n * 10000), unit: '毫米', tip: '1 米 = 100 厘米 = 1000 毫米' };
        }
      );
    }
    var b = pick(builders)();
    return { kind: 'convert', inputType: 'text', q: b.q, answer: b.answer, unit: b.unit, hint: '想想 ' + b.tip + '。' };
  }

  // 填合适单位：根据生活常识选正确单位（choice）
  function buildFillUnit() {
    var pool = FILL_ITEMS.filter(function (it) {
      return it.grades.indexOf(_GRADE) !== -1;
    });
    var it = pick(pool);
    return {
      kind: 'fillUnit',
      inputType: 'choice',
      sentence: it.sentence,
      question: '在括号里填上合适的单位：',
      answer: it.value,
      options: shuffleArr(it.options.slice())
    };
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 60) return buildConvert();
    return buildFillUnit();
  }

  function generateProblems(type, count) {
    var builder = { convert: buildConvert, fillUnit: buildFillUnit, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + (q.q || q.sentence) + '|' + q.answer;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return shuffleArr(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderUnitCard(p, i) {
    var mid = '';
    if (p.kind === 'fillUnit') {
      mid = '<div style="font-size:18px;font-weight:800;color:var(--ink);margin:6px 0;">' + p.sentence.replace('（  ）', '（<span style="display:inline-block;min-width:36px;border-bottom:2px dashed var(--brand);">&nbsp;&nbsp;&nbsp;</span>）') + '</div>';
    }

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
        (p.unit ? '<span style="font-size:13px;color:var(--muted);font-weight:600;">' + p.unit + '</span>' : '') +
        '</div>';
    }

    var hintHTML = p.hint ? '<div style="font-size:11px;color:var(--muted);margin-bottom:6px;">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '" style="border:1px solid var(--line);border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<div class="q-header" style="display:flex;align-items:center;justify-content:center;gap:0;margin-bottom:6px;">' +
        '<span class="num" style="position:static;width:22px;height:22px;border-radius:50%;background:#eef3fb;color:var(--brand);font-weight:800;font-size:12px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div style="font-size:15px;font-weight:800;color:var(--ink);margin:4px 0 6px;">' + (p.question || '') + '</div>' +
      mid +
      inputHTML +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:8px;"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkUnitQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    if (q.inputType === 'choice') {
      var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
      return _PU.normHZ(v) === _PU.normHZ(q.answer);
    }
    var val = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return String(val).replace(/\s/g, '') === String(q.answer).replace(/\s/g, '');
  }

  // ============ ExercisePlugin ============
  var mathUnitConvertPlugin = {
    id: 'math-unit-convert',
    moduleId: 'M4',
    name: '单位换算',
    grades: [2, 3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'unitConvert' },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',      label: '混合' },
          { value: 'convert',  label: '单位换算' },
          { value: 'fillUnit', label: '填合适单位' }
        ]
      }
    ],

    generate: function (options) {
      var opts = options || {};
      _DIFF = _PU.diffLevel(opts.difficulty);
      _GRADE = opts.grade || 2;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', convert: '单位换算', fillUnit: '填合适单位' };
      var label = typeNames[type] || '混合';
      var gradeLabel = '小学' + (_GRADE >= 3 ? '三年级' : '二年级') + '单位换算（' + label + '）';
      var questions = list.map(function (p) {
        return {
          type: 'unit-convert',
          kind: p.kind,
          data: p,
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          hint: p.hint,
          render: function (idx, ctx) { return renderUnitCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkUnitQuestion(this, userAnswers, idx); }
        };
      });
      return {
        questions: questions,
        meta: { type: type, count: questions.length, title: gradeLabel }
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
        var isRight = q.check ? q.check(userAnswers, i) : checkUnitQuestion(q, userAnswers, i);
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
  global.__currentPlugin = mathUnitConvertPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathUnitConvertPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
