/**
 * plugins/math-g1-operation.js — 一年级操作题插件（M6 操作）
 *
 * 知识点覆盖（shared/knowledge-math.js 一年级相关模块）：
 *   math-g1-m6-draw-shape   画图形          （cat: draw-shape）
 *   math-g1-m4-clock-read     钟面画指针      （cat: clock-read）
 *   math-g1-m6-count-graph    圈出指定数量    （cat: count-graph）
 *   math-g1-m9-classify       涂色分类        （cat: classify）
 *
 * 操作题为「家长批改」题型：题目以 SVG 呈现（画图/钟面/圈数/分类），
 * 学生在线下完成，批改结果标记 parentCheck: true（显示「请家长检查」，
 * 不显示数字得分），既满足回归校验（score 为数值）又满足业务需求。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-operation.js 依赖 shared/common.js（PluginUtil），请先加载');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ============ SVG 工具（内联，Node/浏览器通用） ============
  function clockFace() {
    var cx = 60, cy = 60, r = 54, ticks = '', i, a, r1, x, y;
    for (i = 0; i < 12; i++) {
      a = (i * 30 - 90) * Math.PI / 180;
      r1 = (i % 3 === 0) ? 46 : 49;
      ticks += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#9aa6bd" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }
    var nums = [[12, 0], [3, 90], [6, 180], [9, 270]], numHtml = '';
    nums.forEach(function (n) {
      a = (n[1] - 90) * Math.PI / 180;
      x = cx + 40 * Math.cos(a); y = cy + 40 * Math.sin(a) + 4;
      numHtml += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" font-size="14" fill="#5b6b85" font-weight="700">' + n[0] + '</text>';
    });
    return '<svg width="120" height="120" viewBox="0 0 120 120" style="background:var(--card);border-radius:50%;">' +
      '<circle cx="60" cy="60" r="54" fill="#fafbff" stroke="#5b8def" stroke-width="3"/>' + ticks + numHtml +
      '<circle cx="60" cy="60" r="4" fill="#27324a"/></svg>';
  }
  function sample(kind) {
    var inner = kind === 'square'
      ? '<rect x="30" y="20" width="60" height="60" fill="none" stroke="#3b5bdb" stroke-width="3"/>'
      : kind === 'circle'
      ? '<circle cx="60" cy="50" r="32" fill="none" stroke="#3b5bdb" stroke-width="3"/>'
      : '<polygon points="60,18 30,82 90,82" fill="none" stroke="#3b5bdb" stroke-width="3"/>';
    return '<svg width="120" height="100" viewBox="0 0 120 100">' + inner +
      '<rect x="6" y="6" width="108" height="88" fill="none" stroke="#d9e2f0" stroke-dasharray="4 3" rx="8"/></svg>';
  }
  function grid(n, kind) {
    var s = '<svg width="320" height="80" viewBox="0 0 320 80">';
    for (var i = 0; i < n; i++) {
      var x = kind === 'square' ? (20 + i * 30) : (24 + i * 30);
      var cy = 40;
      s += kind === 'square'
        ? '<rect x="' + x + '" y="' + (cy - 12) + '" width="24" height="24" fill="none" stroke="#3b5bdb" stroke-width="2.5"/>'
        : '<circle cx="' + x + '" cy="' + cy + '" r="12" fill="none" stroke="#3b5bdb" stroke-width="2.5"/>';
    }
    return s + '</svg>';
  }
  function classifyRow() {
    return '<svg width="350" height="80" viewBox="0 0 350 80">' +
      '<circle cx="34" cy="40" r="18" fill="none" stroke="#27ae60" stroke-width="2.5"/>' +
      '<rect x="80" y="22" width="36" height="36" fill="none" stroke="#3b5bdb" stroke-width="2.5"/>' +
      '<rect x="140" y="22" width="36" height="36" fill="none" stroke="#e8870a" stroke-width="2.5"/>' +
      '<ellipse cx="220" cy="40" rx="18" ry="22" fill="none" stroke="#9b59b6" stroke-width="2.5"/>' +
      '<polygon points="296,22 274,64 318,64" fill="none" stroke="#e8870a" stroke-width="2.5"/>' +
      '<text x="34" y="74" text-anchor="middle" font-size="11" fill="#5b6b85">球</text>' +
      '<text x="98" y="74" text-anchor="middle" font-size="11" fill="#5b6b85">正方体</text>' +
      '<text x="158" y="74" text-anchor="middle" font-size="11" fill="#5b6b85">长方形</text>' +
      '<text x="220" y="74" text-anchor="middle" font-size="11" fill="#5b6b85">圆柱</text>' +
      '<text x="296" y="74" text-anchor="middle" font-size="11" fill="#5b6b85">三角形</text>' +
      '</svg>';
  }

  var ITEMS = [
    { q: '在虚线框里画一个正方形（和示例一样）', cat: 'draw-shape', svg: sample('square') },
    { q: '在虚线框里画一个圆（和示例一样）', cat: 'draw-shape', svg: sample('circle') },
    { q: '在虚线框里画一个三角形（和示例一样）', cat: 'draw-shape', svg: sample('triangle') },
    { q: '在钟面上画出 3 时（时针短、分针长，指向正确位置）', cat: 'clock-read', svg: clockFace() },
    { q: '在钟面上画出 9 时（时针短、分针长，指向正确位置）', cat: 'clock-read', svg: clockFace() },
    { q: '把 7 个○圈出来', cat: 'count-graph', svg: grid(10, 'circle') },
    { q: '把 5 个□圈出来', cat: 'count-graph', svg: grid(10, 'square') },
    { q: '把下面的立体图形（球、正方体、圆柱）涂上颜色，平面图形不涂', cat: 'classify', svg: classifyRow() }
  ];

  function buildOf(cat) {
    var pool = ITEMS.filter(function (s) { return s.cat === cat; });
    return pool[_PU.randInt(0, pool.length - 1)];
  }
  function buildMixed() { return ITEMS[_PU.randInt(0, ITEMS.length - 1)]; }

  var TYPE_BUILDERS = {
    'mix': buildMixed,
    'draw-shape': function () { return buildOf('draw-shape'); },
    'clock-read': function () { return buildOf('clock-read'); },
    'count-graph': function () { return buildOf('count-graph'); },
    'classify': function () { return buildOf('classify'); }
  };
  var TYPE_NAMES = {
    'mix': '综合操作', 'draw-shape': '画图形', 'clock-read': '钟面画指针',
    'count-graph': '圈出数量', 'classify': '涂色分类'
  };

  function renderOp(q, i) {
    return '<div class="question-card operation-layout" data-index="' + i + '">' +
      '<div class="q-header"><span class="num">' + (i + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;<span class="q-text">' + esc(q.q) + '</span></div>' +
      (q.svg ? '<div class="scene-box">' + q.svg + '</div>' : '') +
      '<div class="op-note">✍ 请按要求完成，完成后请家长检查。</div>' +
      '<div class="feedback"></div></div>';
  }

  var _pool = _PU.createPoolCache('math-g1-operation:mix', function () { return ITEMS.slice(); });

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-operation',
    moduleId: 'M6',
    name: '操作题',
    pageSubtitle: '画图形、钟面画指针、圈出数量、涂色分类',
    grades: [1, 2],
    subject: 'math',
    category: 'geometry',
    printConfig: { pageType: 'math' },
    knowledgePoints: {
      1: [
        'math-g1-m6-draw-shape',
        'math-g1-m4-clock-read',
        'math-g1-m6-count-graph',
        'math-g1-m9-classify'
      ],
      2: [
        'math-g2-m6-draw-line',
        'math-g2-m6-draw-angle',
        'math-g2-m6-clock-draw',
        'math-g2-m6-measure'
      ]
    },

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',         label: '综合操作' },
          { value: 'draw-shape',  label: '画图形' },
          { value: 'clock-read',  label: '钟面画指针' },
          { value: 'count-graph', label: '圈出数量' },
          { value: 'classify',    label: '涂色分类' }
        ]
      }
    ],

    // 家长批改：始终返回满分结构 + parentCheck 标记（不显示数字得分）
    check: function (set) {
      var qs = (set && set.questions) || [];
      var total = qs.length;
      return {
        score: 100,
        total: total,
        correct: total,
        message: '请家长检查',
        parentCheck: true,
        results: qs.map(function () { return true; }),
        correctAnswers: qs.map(function (q) { return q.hint || ''; })
      };
    },

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 8;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 200);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return {
          type: 'operation',
          q: p.q,
          svg: p.svg,
          _operation: true,
          answer: '',
          // 家长批改：单题判定恒为真（综合练习按题调用 q.check 时也走家长批改）
          check: function () { return true; },
          render: function (idx) { return renderOp(this, idx); }
        };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 8,
        title: '小学一年级图形操作练习（' + (TYPE_NAMES[type] || '综合操作') + '）'
      };
    }
  });

  plugin.poolCache = _pool;

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
