/**
 * plugins/math-g4-match.js — 四年级连线题插件（M5 连线）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M5 模块）：
 *   g4-match-read     大数与读法连线      （type: 'read'）
 *   g4-match-angle    角与度数连线        （type: 'angle-degree'）
 *   g4-match-shape    图形与特征连线      （type: 'shape-feature'）
 *   g4-match-law      运算律与字母表达式  （type: 'law-formula'）
 *   g4-match-decfrac  小数与分数连线      （type: 'dec-frac'）
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
    var pairs = [
      ['锐角', '小于 90°'],
      ['直角', '等于 90°'],
      ['钝角', '大于 90°且小于 180°'],
      ['平角', '等于 180°'],
      ['周角', '等于 360°'],
      ['30° 的角', '锐角'],
      ['90° 的角', '直角'],
      ['120° 的角', '钝角'],
      ['180° 的角', '平角'],
      ['360° 的角', '周角']
    ];
    var pr = pick(pairs);
    var left = pr[0], right = pr[1];
    // 干扰项：同类别其他右项
    var distractors = [];
    pairs.forEach(function (p) { if (p[1] !== right && distractors.length < 3) distractors.push(p[1]); });
    var options = shuffle([right].concat(distractors));
    return { q: '把「' + left + '」连到对应的', answer: right, options: options,
      hint: '记住角的分类与度数范围。' };
  }

  // ============ 图形与特征连线 ============
  function buildShapeFeature() {
    var pairs = [
      ['长方形', '对边平行且相等，四个角都是直角'],
      ['正方形', '四条边相等，四个角都是直角'],
      ['平行四边形', '对边平行且相等'],
      ['梯形', '只有一组对边平行'],
      ['三角形', '由三条线段围成'],
      ['等腰三角形', '两条边相等'],
      ['等边三角形', '三条边都相等'],
      ['直角梯形', '有一个角是直角的梯形']
    ];
    var pr = pick(pairs);
    var left = pr[0], right = pr[1];
    var distractors = [];
    pairs.forEach(function (p) { if (p[0] !== left && distractors.length < 3) distractors.push(p[1]); });
    var options = shuffle([right].concat(distractors));
    return { q: '把「' + left + '」连到对应的特征', answer: right, options: options,
      hint: '根据图形的边、角特征判断。' };
  }

  // ============ 运算律与字母表达式连线 ============
  function buildLawFormula() {
    var pairs = [
      ['加法交换律', 'a + b = b + a'],
      ['加法结合律', '(a + b) + c = a + (b + c)'],
      ['乘法交换律', 'a × b = b × a'],
      ['乘法结合律', '(a × b) × c = a × (b × c)'],
      ['乘法分配律', '(a + b) × c = a × c + b × c']
    ];
    var pr = pick(pairs);
    var left = pr[0], right = pr[1];
    var distractors = [];
    pairs.forEach(function (p) { if (p[0] !== left && distractors.length < 4) distractors.push(p[1]); });
    var options = shuffle([right].concat(distractors));
    return { q: '把「' + left + '」连到对应的字母表达式', answer: right, options: options,
      hint: '运算律的字母公式要牢记。' };
  }

  // ============ 小数与分数连线 ============
  function buildDecFrac() {
    var pairs = [
      ['0.1', '1/10'],
      ['0.3', '3/10'],
      ['0.5', '5/10'],
      ['0.01', '1/100'],
      ['0.07', '7/100'],
      ['0.25', '25/100'],
      ['0.9', '9/10'],
      ['0.6', '6/10']
    ];
    var pr = pick(pairs);
    var left = pr[0], right = pr[1];
    var distractors = [];
    pairs.forEach(function (p) { if (p[1] !== right && distractors.length < 3) distractors.push(p[1]); });
    var options = shuffle([right].concat(distractors));
    return { q: '把「' + left + '」连到相等的分数', answer: right, options: options,
      hint: '一位小数是几分之几，两位小数是百分之几。' };
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
    pageTitle: '四年级连线练习',
    pageSubtitle: '大数读法、角、图形特征、运算律与小数分数',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g4-match-read', 'g4-match-angle', 'g4-match-shape', 'g4-match-law', 'g4-match-decfrac'],

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