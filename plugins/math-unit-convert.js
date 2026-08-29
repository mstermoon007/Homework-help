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
  // 难度统一经 App.Difficulty.consume 解析（批次8）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-unit-convert.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

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

  // 生活常识「填合适单位」题库（模板化：句子中的数字随机化，增加题目多样性；答案/单位不变）
  // 每项：{ grades, value, options, tmpl, nums }，tmpl 中的 {n} 由 nums 随机选取替换。
  var FILL_TEMPLATES = [
    { grades: [1, 2], value: '厘米', options: ['米', '毫米', '厘米'], tmpl: '一支铅笔长约 {n}（  ）', nums: [15, 16, 17, 18, 19, 20] },
    { grades: [1, 2], value: '厘米', options: ['米', '厘米', '千米'], tmpl: '课桌的高大约是 {n}（  ）', nums: [60, 65, 70, 75, 80, 85] },
    { grades: [1, 2], value: '米', options: ['厘米', '米', '千米'], tmpl: '一张床长约 {n}（  ）', nums: [2, 2, 3, 4] },
    { grades: [1, 2], value: '米', options: ['厘米', '米', '毫米'], tmpl: '教室的黑板长约 {n}（  ）', nums: [3, 4, 4, 5] },
    { grades: [1, 2], value: '毫米', options: ['厘米', '毫米', '米'], tmpl: '一枚硬币的厚度大约是 {n}（  ）', nums: [1, 2, 2, 3] },
    { grades: [1, 2], value: '千米', options: ['米', '千米', '厘米'], tmpl: '从家到学校大约 {n}（  ）', nums: [1, 2, 2, 3] },
    { grades: [1, 2], value: '克', options: ['克', '千克', '吨'], tmpl: '一个鸡蛋大约重 {n}（  ）', nums: [50, 55, 60, 65] },
    { grades: [1, 2], value: '千克', options: ['克', '千克', '吨'], tmpl: '一袋大米重 {n}（  ）', nums: [5, 10, 25, 30] },
    { grades: [1, 2], value: '克', options: ['千克', '克', '吨'], tmpl: '一个苹果大约重 {n}（  ）', nums: [150, 180, 200, 220] },
    { grades: [1, 2], value: '千克', options: ['克', '千克', '吨'], tmpl: '小明的体重约 {n}（  ）', nums: [22, 25, 28, 30] },
    { grades: [1, 2], value: '克', options: ['千克', '克', '吨'], tmpl: '一盒牛奶大约重 {n}（  ）', nums: [200, 250, 300, 350] },
    { grades: [1, 2], value: '千米', options: ['米', '千米', '厘米'], tmpl: '一辆小汽车每时行驶 {n}（  ）', nums: [60, 80, 90, 100] },
    { grades: [1, 2], value: '厘米', options: ['米', '厘米', '毫米'], tmpl: '一支钢笔长约 {n}（  ）', nums: [13, 14, 15, 16] },
    { grades: [1, 2], value: '克', options: ['克', '千克', '吨'], tmpl: '一袋盐大约重 {n}（  ）', nums: [400, 500, 500, 600] },
    { grades: [1, 2], value: '千克', options: ['克', '千克', '吨'], tmpl: '一个西瓜大约重 {n}（  ）', nums: [3, 4, 5, 6] },
    // ===== 三年级：时间 =====
    { grades: [3], value: '分', options: ['分', '时', '秒'], tmpl: '一节课的时间是 {n}（  ）', nums: [35, 40, 40, 45] },
    { grades: [3], value: '时', options: ['时', '分', '秒'], tmpl: '一场电影大约放映 {n}（  ）', nums: [2, 2, 3, 3] },
    { grades: [3], value: '秒', options: ['秒', '分', '时'], tmpl: '眨一下眼睛大约用 {n}（  ）', nums: [1, 1, 2, 2] },
    { grades: [3], value: '时', options: ['时', '分', '秒'], tmpl: '从下午 2 时到下午 4 时，经过了 {n}（  ）', nums: [2, 2, 3, 3] },
    { grades: [3], value: '秒', options: ['秒', '分', '时'], tmpl: '跑 100 米大约需要 {n}（  ）', nums: [12, 15, 16, 18] },
    // ===== 三年级：质量（吨） =====
    { grades: [3], value: '吨', options: ['吨', '千克', '克'], tmpl: '一头大象大约重 {n}（  ）', nums: [3, 4, 5, 6] },
    { grades: [3], value: '吨', options: ['吨', '千克', '克'], tmpl: '一艘轮船大约载重 {n}（  ）', nums: [150, 200, 300, 500] },
    // ===== 三年级：面积 =====
    { grades: [3], value: '平方分米', options: ['平方分米', '平方米', '平方厘米'], tmpl: '一块手帕的面积大约是 {n}（  ）', nums: [4, 4, 6, 9] },
    { grades: [3], value: '平方厘米', options: ['平方厘米', '平方分米', '平方米'], tmpl: '数学书封面的面积大约是 {n}（  ）', nums: [300, 350, 400, 450] },
    { grades: [3], value: '平方米', options: ['平方米', '平方分米', '平方厘米'], tmpl: '一块黑板的面积大约是 {n}（  ）', nums: [4, 4, 5, 6] },
    { grades: [3], value: '平方分米', options: ['平方分米', '平方米', '平方厘米'], tmpl: '课桌面的大小大约是 {n}（  ）', nums: [24, 30, 40, 48] },
    // ===== 三年级：长度（毫米、分米、千米）=====
    { grades: [3], value: '毫米', options: ['毫米', '厘米', '米'], tmpl: '一根火柴长约 {n}（  ）', nums: [40, 45, 50, 55] },
    { grades: [3], value: '分米', options: ['分米', '厘米', '米'], tmpl: '一条毛巾长约 {n}（  ）', nums: [6, 7, 8, 9] },
    { grades: [3], value: '米', options: ['米', '千米', '分米'], tmpl: '校园跑道一圈长 {n}（  ）', nums: [200, 300, 400, 500] },
    { grades: [3], value: '千米', options: ['千米', '米', '厘米'], tmpl: '从北京到上海大约 {n}（  ）', nums: [1000, 1100, 1200, 1300] },
    { grades: [3], value: '毫米', options: ['毫米', '厘米', '分米'], tmpl: '一张纸的厚度大约 {n}（  ）', nums: [1, 1, 2, 2] },
    { grades: [3], value: '分米', options: ['分米', '厘米', '米'], tmpl: '一把尺子长 {n}（  ）', nums: [2, 3, 3, 4] },
    // ===== 三年级：质量（吨）更多 =====
    { grades: [3], value: '吨', options: ['吨', '千克', '克'], tmpl: '一辆大货车载重 {n}（  ）', nums: [8, 10, 12, 15] },
    { grades: [3], value: '千克', options: ['千克', '吨', '克'], tmpl: '一头成年牛重约 {n}（  ）', nums: [400, 450, 500, 600] },
    // ===== 三年级：面积更多 =====
    { grades: [3], value: '平方厘米', options: ['平方厘米', '平方分米', '平方米'], tmpl: '一张邮票的面积约 {n}（  ）', nums: [4, 6, 8, 9] },
    { grades: [3], value: '平方米', options: ['平方米', '平方分米', '平方千米'], tmpl: '操场的面积大约 {n}（  ）', nums: [3000, 4000, 5000, 6000] },
    { grades: [3], value: '平方米', options: ['平方米', '平方分米', '平方厘米'], tmpl: '一块地毯的面积约 {n}（  ）', nums: [4, 6, 8, 10] }
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
        var n = rnd(1, maxN);
        return { q: n + ' 米 = ? 厘米', answer: String(n * 100), unit: '厘米', tip: '1 米 = 100 厘米' };
      },
      // 厘米 → 米
      function () {
        var n = rnd(1, Math.max(2, maxN)) * 100;
        return { q: n + ' 厘米 = ? 米', answer: String(n / 100), unit: '米', tip: '100 厘米 = 1 米' };
      },
      // 厘米 → 毫米
      function () {
        var n = rnd(1, maxN);
        return { q: n + ' 厘米 = ? 毫米', answer: String(n * 10), unit: '毫米', tip: '1 厘米 = 10 毫米' };
      },
      // 毫米 → 厘米
      function () {
        var n = rnd(1, Math.max(2, maxN)) * 10;
        return { q: n + ' 毫米 = ? 厘米', answer: String(n / 10), unit: '厘米', tip: '10 毫米 = 1 厘米' };
      },
      // 千克 → 克
      function () {
        var n = rnd(1, maxN);
        return { q: n + ' 千克 = ? 克', answer: String(n * 1000), unit: '克', tip: '1 千克 = 1000 克' };
      },
      // 克 → 千克
      function () {
        var n = rnd(1, Math.max(2, maxN)) * 1000;
        return { q: n + ' 克 = ? 千克', answer: String(n / 1000), unit: '千克', tip: '1000 克 = 1 千克' };
      }
    ];
    // 难度高时追加：千米 ↔ 米
    if (_DIFF >= 6) {
      builders.push(
        function () {
          var n = rnd(1, Math.max(9, maxN));
          return { q: n + ' 千米 = ? 米', answer: String(n * 1000), unit: '米', tip: '1 千米 = 1000 米' };
        },
        function () {
          var n = rnd(1, Math.max(9, maxN)) * 1000;
          return { q: n + ' 米 = ? 千米', answer: String(n / 1000), unit: '千米', tip: '1000 米 = 1 千米' };
        },
        // 米 ↔ 分米
        function () {
          var n = rnd(1, Math.max(5, maxN));
          return { q: n + ' 米 = ? 分米', answer: String(n * 10), unit: '分米', tip: '1 米 = 10 分米' };
        },
        function () {
          var n = rnd(1, Math.max(5, maxN)) * 10;
          return { q: n + ' 分米 = ? 米', answer: String(n / 10), unit: '米', tip: '10 分米 = 1 米' };
        }
      );
    }
    // 三年级追加：时间、吨、面积换算
    if (_GRADE >= 3) {
      builders.push(
        // 时 ↔ 分
        function () {
          var n = rnd(1, 12);
          return { q: n + ' 时 = ? 分', answer: String(n * 60), unit: '分', tip: '1 时 = 60 分' };
        },
        function () {
          var n = rnd(1, 11) * 60;
          return { q: n + ' 分 = ? 时', answer: String(n / 60), unit: '时', tip: '60 分 = 1 时' };
        },
        // 分 ↔ 秒
        function () {
          var n = rnd(1, 12);
          return { q: n + ' 分 = ? 秒', answer: String(n * 60), unit: '秒', tip: '1 分 = 60 秒' };
        },
        function () {
          var n = rnd(1, 11) * 60;
          return { q: n + ' 秒 = ? 分', answer: String(n / 60), unit: '分', tip: '60 秒 = 1 分' };
        },
        // 吨 ↔ 千克
        function () {
          var n = rnd(2, 20);
          return { q: n + ' 吨 = ? 千克', answer: String(n * 1000), unit: '千克', tip: '1 吨 = 1000 千克' };
        },
        function () {
          var n = rnd(2, 15) * 1000;
          return { q: n + ' 千克 = ? 吨', answer: String(n / 1000), unit: '吨', tip: '1000 千克 = 1 吨' };
        },
        // 平方米 ↔ 平方分米
        function () {
          var n = rnd(2, 50);
          return { q: n + ' 平方米 = ? 平方分米', answer: String(n * 100), unit: '平方分米', tip: '1 平方米 = 100 平方分米' };
        },
        function () {
          var n = rnd(1, 40) * 100;
          return { q: n + ' 平方分米 = ? 平方米', answer: String(n / 100), unit: '平方米', tip: '100 平方分米 = 1 平方米' };
        },
        // 平方分米 ↔ 平方厘米
        function () {
          var n = rnd(2, 60);
          return { q: n + ' 平方分米 = ? 平方厘米', answer: String(n * 100), unit: '平方厘米', tip: '1 平方分米 = 100 平方厘米' };
        },
        function () {
          var n = rnd(1, 50) * 100;
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
    var pool = FILL_TEMPLATES.filter(function (it) {
      return it.grades.indexOf(_GRADE) !== -1;
    });
    // 边界兜底（任务12）：未知/超纲年级回退全量题池，避免 pick(undefined) 崩溃
    if (!pool.length) pool = FILL_TEMPLATES.slice();
    var it = pick(pool);
    var n = pick(it.nums);
    var sentence = it.tmpl.replace('{n}', String(n));
    return {
      kind: 'fillUnit',
      inputType: 'choice',
      sentence: sentence,
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
          'style="cursor:pointer;border:1.5px solid var(--line-strong);background:var(--soft-bg);color:var(--ink);border-radius:9px;padding:6px 14px;font-size:16px;font-weight:800;margin:3px;transition:.15s;">' + o + '</button>';
      });
      inputHTML = '<div class="opt-row" style="display:flex;flex-wrap:wrap;justify-content:center;gap:2px;">' + optsHTML + '</div>' +
        '<input type="hidden" class="choice-inp" data-index="' + i + '" autocomplete="off">';
    } else {
      inputHTML = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;">' +
        '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off">' +
        (p.unit ? '<span class="unit">' + p.unit + '</span>' : '') +
        '</div>';
    }

    var hintHTML = p.hint ? '<div class="q-hint">💡 ' + p.hint + '</div>' : '';

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        hintHTML +
      '</div>' +
      '<div>' + (p.question || '') + '</div>' +
      mid +
      inputHTML +
      '<div class="feedback"></div>' +
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
      // 难度统一经 App.Difficulty.consume 解析（批次8）：profile.effectiveLevel 替代直调 diffLevel
      var prof = _D.consume(opts);
      _DIFF = prof.effectiveLevel;
      var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
      _GRADE = opts.grade || 2;
      // 子题型 → 知识点（按年级区分；未映射的组合不标注，保持纯插件级统计）
      var KP_BY_GRADE_KIND = {
        2: { convert: 'math-g2-m4-unit-convert', fillUnit: 'math-g2-m4-fill-unit' },
        3: { convert: 'math-g3-m4-g3-measure', fillUnit: 'math-g3-m4-g3-measure' }
      };
      var kpMap = KP_BY_GRADE_KIND[_GRADE] || null;
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var list = generateProblems(type, count);
      var typeNames = { mix: '混合练习', convert: '单位换算', fillUnit: '填合适单位' };
      var label = typeNames[type] || '混合';
      var gradeLabel = '小学' + (_GRADE >= 3 ? '三年级' : '二年级') + '单位换算（' + label + '）';
      var questions = list.map(function (p) {
        var q = {
          type: 'unit-convert',
          kind: p.kind,
          data: p,
          q: p.q || p.sentence || '',
          svg: p.svg || '',
          answer: Array.isArray(p.answer) ? p.answer.join('、') : String(p.answer),
          knowledgePointId: kpMap ? (kpMap[p.kind] || undefined) : undefined,
          hint: p.hint,
          render: function (idx, ctx) { return renderUnitCard(this.data, idx); },
          check: function (userAnswers, idx) { return checkUnitQuestion(this, userAnswers, idx); }
        };
        if (diffStamp != null) q.difficulty = diffStamp;
        return q;
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
        btns[i].style.background = 'var(--soft-bg)';
        btns[i].style.borderColor = 'var(--line-strong)';
      }
      btn.style.background = 'var(--brand)';
      btn.style.borderColor = 'var(--brand-d)';
      btn.style.color = 'var(--card)';
    }
  };

  // ============ 导出 ============
  global.__currentPlugin = mathUnitConvertPlugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = mathUnitConvertPlugin;

})(typeof window !== 'undefined' ? window : globalThis);
