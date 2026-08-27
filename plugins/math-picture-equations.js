/**
 * plugins/math-picture-equations.js — 看图列式插件（一年级：看图写加法/减法算式）
 *
 * 使用 shared/common.js 的 PluginUtil.createPlugin 工厂（标准契约）：
 * 通过 generateQuestions + meta 实现 generate/render/check；题型「找规律」
 * 复用 math-patterns 插件（异步加载，单一来源）。
 * 随机数统一使用 PluginUtil；图示全部为动态 SVG。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-picture-equations.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');
  // 难度统一经 App.Difficulty.consume 解析（批次7）
  var _D = (typeof App !== 'undefined' && App.Difficulty) ? App.Difficulty
    : (typeof require !== 'undefined' ? require('../shared/difficulty.js') : null);
  if (!_D || !_D.consume) throw new Error('plugins/math-picture-equations.js 依赖 shared/difficulty.js（App.Difficulty），请先加载');

  // ============ 随机工具（统一走 PluginUtil） ============
  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 图形 SVG（小动物/水果用彩色圆点示意） ============
  var COLORS = ['#5b8def', '#e8870a', '#27ae60', '#9b59b6', '#e74c3c'];
  function dotsSVG(n, color) {
    var rows = Math.ceil(n / 5);
    var width = rows > 1 ? 120 : Math.max(40, n * 24);
    var html = '<svg width="' + width + '" height="' + (rows * 26 + 6) + '" viewBox="0 0 ' + width + ' ' + (rows * 26 + 6) + '">';
    for (var i = 0; i < n; i++) {
      var x = 12 + (i % 5) * 24;
      var y = 14 + Math.floor(i / 5) * 26;
      html += '<circle cx="' + x + '" cy="' + y + '" r="10" fill="' + color + '" stroke="#2b3a55" stroke-width="1.5"/>';
    }
    return html + '</svg>';
  }

  // ============ 难度（1-10，由 generate 设置） ============
  var _DIFF = 3;
  // 结果上限：难度 3 基准 20，难度越高数值越大
  function sumMax() { return Math.min(50, _PU.diffMax(20, _DIFF)); }

  // ============ 题目生成 ============
  // 难度越高 → 每堆图形的个数越大（数值增大，与 sumMax 上限同步缩放）
  function operandMax() {
    var m = Math.round(9 * _PU.diffScale(_DIFF));
    return Math.max(9, Math.min(20, m));
  }

  // 加法：左边 a 个 + 右边 b 个 = a+b
  function buildAdd() {
    var hi = operandMax();
    var a = rnd(2, hi), b = rnd(1, hi);
    var sum = a + b;
    if (sum > sumMax()) return buildAdd();
    var c1 = pick(COLORS), c2 = pick(COLORS);
    if (c1 === c2) c2 = COLORS[(COLORS.indexOf(c1) + 1) % COLORS.length];
    return {
      kind: 'add',
      a: a, b: b, sum: sum, c1: c1, c2: c2,
      question: '看图列算式：',
      expr: a + ' + ' + b + ' = (  )',
      answer: String(sum),
      inputType: 'text'
    };
  }

  // 减法：总数 a+b 个，圈走 b 个，剩 a 个
  function buildSub() {
    var hi = operandMax();
    var a = rnd(2, hi), b = rnd(1, hi);
    var total = a + b;
    if (total > sumMax()) return buildSub();
    var color = pick(COLORS);
    return {
      kind: 'sub',
      a: a, b: b, total: total, color: color,
      question: '看图列算式：',
      expr: total + ' - ' + b + ' = (  )',
      answer: String(a),
      inputType: 'text'
    };
  }

  function buildMixed() {
    return rnd(0, 1) === 0 ? buildAdd() : buildSub();
  }

  function generateProblems(type, count) {
    var builder = { add: buildAdd, sub: buildSub, mix: buildMixed }[type];
    var seen = {};
    var list = [];
    var attempts = 0;
    var maxAttempts = Math.max(count * 20, 300);
    while (list.length < count && attempts < maxAttempts) {
      var q = builder();
      var key = q.kind + '|' + q.a + '|' + q.b;
      if (!seen[key]) { seen[key] = true; list.push(q); }
      attempts++;
    }
    return _PU.shuffle(list);
  }

  // ============ 标准题目对象：渲染 / 判定 ============
  /** 渲染单题卡片（标准 Question.render） */
  function renderCard(p, i) {
    var picHTML;
    if (p.kind === 'add') {
      picHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;">' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + dotsSVG(p.a, p.c1) + '</div>' +
        '<span style="font-size:20px;font-weight:800;color:var(--ink);">+</span>' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + dotsSVG(p.b, p.c2) + '</div>' +
        '</div>';
    } else {
      var totalSVG = dotsSVG(p.total, p.color);
      // 圈出后 b 个：在下方用斜线覆盖示意“去掉”
      picHTML = '<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin:6px 0;">' +
        '<div style="display:flex;flex-direction:column;align-items:center;border:1.5px dashed var(--line-strong);border-radius:10px;padding:6px 8px;">' + totalSVG +
        '<div style="font-size:11px;color:#e74c3c;font-weight:800;margin-top:2px;">划去 ' + p.b + ' 个</div></div>' +
        '</div>';
    }

    return '<div class="question-card" data-index="' + i + '">' +
      '<div class="q-header">' +
        '<span class="num">' + (i + 1) + '</span>' +
        '&nbsp;&nbsp;&nbsp;&nbsp;' +
        '<span class="q-text">' + p.question + '</span>' +
      '</div>' +
      picHTML +
      '<div style="font-size:20px;font-weight:800;color:var(--ink);margin:6px 0;">' + p.expr.replace('(  )', '<input type="text" class="answer-inp" data-index="' + i + '" placeholder="?" autocomplete="off" style="width:52px;height:32px;border:2px dashed var(--line-strong);border-radius:7px;font-size:16px;font-weight:800;text-align:center;color:var(--brand-d);background:var(--soft-bg);outline:none;">') + '</div>' +
      '<div class="feedback"></div>' +
      '</div>';
  }

  /** 单题判定（标准 Question.check） */
  function checkQuestion(question, userAnswers, idx) {
    var q = question.data || question;
    var v = userAnswers && userAnswers[idx] != null ? String(userAnswers[idx]).trim() : '';
    return v === String(q.answer);
  }

  // ============ 题型元数据 ============
  var TYPE_NAMES = { mix: '混合练习', add: '看图列加法', sub: '看图列减法' };

  // meta 为 createPlugin 保留字段，不挂载到插件对象；这里单独定义，供 generate / meta 复用
  function buildMeta(opts) {
    var type = (opts && opts.type) || 'mix';
    var label = (type === 'pattern') ? '找规律' : (TYPE_NAMES[type] || '混合练习');
    return { type: type, count: (opts && opts.count) || 8, title: '小学一年级看图列式（' + label + '）' };
  }

  function buildQuestions(options) {
    var opts = options || {};
    // 难度统一经 App.Difficulty.consume 解析（批次7）：profile.effectiveLevel 替代直调 diffLevel
    var prof = _D.consume(opts);
    _DIFF = prof.effectiveLevel;
    var diffStamp = prof.hasOwnLevel ? null : prof.effectiveLevel;
    var type = opts.type || 'mix';
    var count = opts.count || 8;
    var list = generateProblems(type, count);
    var label = TYPE_NAMES[type] || '混合练习';
    var questions = list.map(function (p) {
      var q = {
        type: 'picture-eq',
        kind: p.kind,
        data: p,
        answer: String(p.answer),
        knowledgePointId: 'math-g1-m7-picture-equations',
        hint: p.kind === 'add' ? '左边有几个，右边有几个，合起来一共有几个？' : '一共有几个，划去几个，还剩几个？',
        render: function (idx) { return renderCard(this.data, idx); },
        check: function (userAnswers, idx) { return checkQuestion(this, userAnswers, idx); }
      };
      if (diffStamp != null) q.difficulty = diffStamp;
      return q;
    });
    plugin._lastLabel = label;
    return questions;
  }

  // ============ 用工厂创建插件（标准契约） ============
  var plugin = _PU.createPlugin({
    id: 'math-picture-equations',
    moduleId: 'M7',
    name: '看图列式',
    pageSubtitle: '看图写加法、减法算式',
    grades: [1],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'pictureEq' },
    // 声明本插件覆盖的知识点（用于开发期覆盖校验与提示）
    knowledgePoints: ['math-g1-m7-picture-equations'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',     label: '混合' },
          { value: 'add',     label: '加法' },
          { value: 'sub',     label: '减法' },
          { value: 'pattern', label: '找规律' }
        ]
      }
    ],

    // 标准同步生成（混合/加法/减法）
    generateQuestions: function (options) {
      var type = (options && options.type) || 'mix';
      if (type === 'pattern') {
        // 找规律由自定义 generate 异步委托 math-patterns，不应走到这里
        throw new Error('找规律需经异步加载 math-patterns 插件，请使用 generate()');
      }
      return buildQuestions(options);
    },

    // 自定义 generate：找规律（异步委托 math-patterns，单一来源）；其余走标准同步路径
    generate: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';

      if (type === 'pattern') {
        var loader = (typeof App !== 'undefined' && App.PluginLoader) ? App.PluginLoader : null;
        if (loader && typeof loader.loadPlugin === 'function') {
          return loader.loadPlugin({ id: 'math-patterns', file: 'plugins/math-patterns.js' }).then(function (patternPlugin) {
            if (!patternPlugin) throw new Error('加载找规律插件失败');
            global.__currentPlugin = plugin; // 恢复当前插件，保证选项按钮 __choose 正确
            return patternPlugin.generate({ grade: 1, count: opts.count, type: 'mix', difficulty: opts.difficulty });
          });
        }
        throw new Error('当前环境不支持动态加载找规律插件');
      }

      var questions = buildQuestions(opts);
      return { questions: questions, meta: buildMeta(opts) };
    },

    meta: function (opts) {
      return buildMeta(opts);
    }
  });

  // ============ 导出 ============
  global.__currentPlugin = plugin;  // practice.html / dev/plugin-check.html
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);