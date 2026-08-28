/**
 * plugins/math-g4-match.js — 四年级连线题插件（M5 连线）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M5 模块）：
 *   g4-m5-g4-match-read     大数与读法连线      （type: 'read'）
 *   g4-m5-g4-match-angle    角与度数连线        （type: 'angle-degree'）
 *   g4-m5-g4-match-shape    图形与特征连线      （type: 'shape-feature'）
 *   g4-m5-g4-match-law      运算律与字母表达式  （type: 'law-formula'）
 *   g4-m5-g4-match-decfrac  小数与分数连线      （type: 'dec-frac'）
 *
 * 连线题以「左项 → 选项」形式实现：题干展示左侧待连项，右侧为候选
 * （含干扰项），学生点击正确匹配项即可（choice 交互）。
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-match.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============ 数字转中文读法（连线用，万以内） ============
  var CN_D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function segToCn(n) {
    if (n === 0) return '零';
    var s = String(n), len = s.length, out = '';
    for (var i = 0; i < len; i++) {
      var d = Number(s[i]);
      var pos = len - i;
      var unit = pos === 4 ? '千' : pos === 3 ? '百' : pos === 2 ? '十' : '';
      if (d === 0) {
        if (i < len - 1 && Number(s[i + 1]) !== 0 && out.charAt(out.length - 1) !== '零') out += '零';
      } else {
        out += CN_D[d] + unit;
      }
    }
    return out;
  }
  function numToCn(n) {
    if (n === 0) return '零';
    var s = String(n), len = s.length;
    var wan = 0, ge = 0;
    if (len > 4) { wan = Number(s.slice(0, len - 4)); ge = Number(s.slice(len - 4)); }
    else { ge = Number(s); }
    var out = '';
    if (wan > 0) {
      out += segToCn(wan) + '万';
      if (ge > 0) {
        var geS = String(ge);
        if (geS.length < 4) out += '零';
        out += segToCn(ge);
      }
    } else {
      out += segToCn(ge);
    }
    return out;
  }

  // ============ 大数与读法连线 ============
  function buildRead() {
    var n = rnd(10000000, 99999999);
    var cn = numToCn(n);
    var correct = cn;
    var distractorPool = [];
    for (var i = 0; i < 3; i++) {
      var n2 = rnd(10000000, 99999999);
      distractorPool.push(numToCn(n2));
    }
    // 避免干扰项与正确项重复
    var opts = [];
    opts.push(correct);
    distractorPool.forEach(function (d) { if (d !== correct) opts.push(d); });
    while (opts.length < 4) { opts.push(numToCn(rnd(10000000, 99999999))); }
    var options = shuffle(opts.slice(0, 4));
    return { q: '「' + n + '」读作', answer: correct, options: options,
      hint: '从高位读起，先读万级再读个级。' };
  }

  // ============ 角与度数连线 ============
  function buildAngleDegree() {
    var classes = [
      { name: '锐角', lo: 10, hi: 89 },
      { name: '直角', val: 90 },
      { name: '钝角', lo: 91, hi: 179 },
      { name: '平角', val: 180 },
      { name: '周角', val: 360 }
    ];
    var cls = pick(classes);
    var deg = cls.val != null ? cls.val : rnd(cls.lo, cls.hi);
    var options = shuffle(['锐角', '直角', '钝角', '平角', '周角']);
    return { q: '把「' + deg + '° 的角」连到对应的分类', answer: cls.name, options: options,
      hint: '记住角的分类与度数范围。' };
  }

  // ============ 图形与特征连线 ============
  function buildShapeFeature() {
    var mode = rnd(1, 3);
    if (mode === 1) {
      var n = rnd(3, 8);
      return { q: n + ' 边形有（  ）条边', answer: String(n),
        options: shuffle([String(n), String(n + 1), String(n - 1), String(n + 2)]),
        hint: '多边形有几条边就叫几边形。' };
    }
    if (mode === 2) {
      var n2 = rnd(3, 8);
      return { q: n2 + ' 边形有（  ）个角', answer: String(n2),
        options: shuffle([String(n2), String(n2 + 1), String(n2 - 1), String(n2 + 2)]),
        hint: '多边形的边数和角数相同。' };
    }
    var table = [
      ['长方形', '对边平行且相等，四个角都是直角'],
      ['正方形', '四条边相等，四个角都是直角'],
      ['平行四边形', '对边平行且相等'],
      ['梯形', '只有一组对边平行'],
      ['三角形', '由三条线段围成'],
      ['等腰三角形', '两条边相等'],
      ['等边三角形', '三条边都相等'],
      ['五边形', '五条边'],
      ['六边形', '六条边']
    ];
    var pr = pick(table);
    var distractors = [];
    table.forEach(function (p) { if (p[0] !== pr[0] && distractors.length < 3) distractors.push(p[1]); });
    var options = shuffle([pr[1]].concat(distractors));
    return { q: '把「' + pr[0] + '」连到对应的特征', answer: pr[1], options: options,
      hint: '根据图形的边、角特征判断。' };
  }

  // ============ 运算律与字母表达式连线 ============
  function buildLawFormula() {
    var a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9);
    var laws = [
      { n: '加法交换律', e: a + ' + ' + b + ' = ' + b + ' + ' + a },
      { n: '加法结合律', e: '(' + a + ' + ' + b + ') + ' + c + ' = ' + a + ' + (' + b + ' + ' + c + ')' },
      { n: '乘法交换律', e: a + ' × ' + b + ' = ' + b + ' × ' + a },
      { n: '乘法结合律', e: '(' + a + ' × ' + b + ') × ' + c + ' = ' + a + ' × (' + b + ' × ' + c + ')' },
      { n: '乘法分配律', e: '(' + a + ' + ' + b + ') × ' + c + ' = ' + a + ' × ' + c + ' + ' + b + ' × ' + c }
    ];
    var lw = pick(laws);
    var options = shuffle(laws.map(function (x) { return x.n; }));
    return { q: '等式「' + lw.e + '」应用了（  ）', answer: lw.n, options: options,
      hint: '运算律的字母公式要牢记。' };
  }

  // ============ 小数与分数连线 ============
  function buildDecFrac() {
    if (rnd(1, 2) === 1) {
      var t = rnd(1, 9);
      return { q: '把「0.' + t + '」连到相等的分数', answer: t + '/10',
        options: shuffle([t + '/10', (t + 1) + '/10', (10 - t) + '/10', t + '/100']),
        hint: '一位小数是十分之几。' };
    }
    var h = rnd(1, 99);
    var hs = h < 10 ? '0' + h : String(h);
    return { q: '把「0.' + hs + '」连到相等的分数', answer: h + '/100',
      options: shuffle([h + '/100', (h + 1) + '/100', (100 - h) + '/100', (h % 10) + '/10']),
      hint: '两位小数是百分之几。' };
  }

  // ============ 综合连线（按知识点权重混合） ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 25) return buildRead();
    if (r <= 45) return buildAngleDegree();
    if (r <= 65) return buildShapeFeature();
    if (r <= 85) return buildLawFormula();
    return buildDecFrac();
  }

  var TYPE_BUILDERS = {
    'read': buildRead,
    'angle-degree': buildAngleDegree,
    'shape-feature': buildShapeFeature,
    'law-formula': buildLawFormula,
    'dec-frac': buildDecFrac,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'read': '大数与读法',
    'angle-degree': '角与度数',
    'shape-feature': '图形与特征',
    'law-formula': '运算律公式',
    'dec-frac': '小数与分数',
    mix: '综合连线'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-match',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '大数读法、角、图形特征、运算律与小数分数',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g4-m5-g4-match-read',
        'math-g4-m5-g4-match-angle',
        'math-g4-m5-g4-match-shape',
        'math-g4-m5-g4-match-law',
        'math-g4-m5-g4-match-decfrac'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',          label: '综合连线' },
          { value: 'read',         label: '大数与读法' },
          { value: 'angle-degree', label: '角与度数' },
          { value: 'shape-feature', label: '图形与特征' },
          { value: 'law-formula',  label: '运算律公式' },
          { value: 'dec-frac',     label: '小数与分数' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 40, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'match', q: p.q + '（点击右侧对应项）', answer: String(p.answer),
          options: p.options, inputType: 'choice', hint: p.hint };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);