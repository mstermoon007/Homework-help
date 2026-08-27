/**
 * plugins/math-g6-matching.js — 六年级连线题插件（M5 正反比例与图形公式连线）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M5 模块）：
 *   g6-m5-g6-match-proportion  正反比例判断连线      （type: 'proportion'）
 *   g6-m5-g6-match-formula     圆与圆柱圆锥公式连线  （type: 'formula'）
 *   g6-m5-g6-match-chart       扇形统计图特点连线    （type: 'chart'）
 *
 * 连线题以「左项 → 选项」形式实现：题干展示左侧待连项，右侧为候选
 * （含干扰项，3-5 个），学生点击正确匹配项即可（choice 交互）。
 *
 * 题池扩容（目标：重复率 ≤10%）：
 *   - 每类 ≥10 组配对：正反比例 22 情境 / 图形公式 20 条 / 统计图描述 8 + 百分比圆心角参数化 21 /
 *     分数百分数互化 35+（新增 convert 类）
 *   - 混合知识点连线：综合模式跨类抽题，干扰项可跨类抽取（一道题的候选项来自不同知识点）
 *   - 干扰项：每题随机 2-4 个（候选共 3-5 个），同类优先、跨类补充
 *   - 题目池缓存：模块级牌堆（按题型），首次构建全量配对池并洗牌，跨 generate 调用连续发牌，
 *     用尽后重新洗牌——同一轮 5×20 次生成内无重复签名
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-matching.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // ============ 配对池（[左项, 右项] 全量清单） ============

  // 正反比例判断：22 情境（工作效率/面积/体积/单价/速度/出油率等）
  var PROPORTION_PAIRS = [
    ['速度一定，路程和时间', '成正比例'],
    ['路程一定，速度和时间', '成反比例'],
    ['单价一定，总价和数量', '成正比例'],
    ['长方形面积一定，长和宽', '成反比例'],
    ['圆的周长和直径', '成正比例'],
    ['工作总量一定，工作效率和工作时间', '成反比例'],
    ['工作效率一定，工作总量和工作时间', '成正比例'],
    ['一个人的年龄和身高', '不成比例'],
    ['正方形的边长和周长', '成正比例'],
    ['正方形的边长和面积', '不成比例'],
    ['长方形周长一定，长和宽', '不成比例'],
    ['圆的面积和半径', '不成比例'],
    ['比值一定，比的前项和后项', '成正比例'],
    ['乘积一定，两个因数', '成反比例'],
    ['每天读的页数一定，读的天数和总页数', '成正比例'],
    ['一本书总页数一定，每天读的页数和天数', '成反比例'],
    ['长方体体积一定，底面积和高', '成反比例'],
    ['平行四边形面积一定，底和高', '成反比例'],
    ['三角形面积一定，底和高', '成反比例'],
    ['和一定，两个加数', '不成比例'],
    ['车轮直径一定，行驶的路程和车轮转数', '成正比例'],
    ['出油率一定，花生的质量和榨出油的质量', '成正比例']
  ];

  // 圆与圆柱圆锥公式：20 条（圆/圆柱/圆锥/扇形/梯形/三角形/立方体等）
  var FORMULA_PAIRS = [
    ['圆的周长（知直径）', 'C = πd'],
    ['圆的周长（知半径）', 'C = 2πr'],
    ['圆的面积', 'S = πr²'],
    ['直径与半径', 'd = 2r'],
    ['圆柱的体积', 'V = Sh'],
    ['圆锥的体积', 'V = Sh ÷ 3'],
    ['圆柱的侧面积', 'S = 2πrh'],
    ['圆柱的表面积', 'S = 2πrh + 2πr²'],
    ['圆环的面积', 'S = π(R² − r²)'],
    ['扇形的面积', 'S = πr² × n/360'],
    ['半圆的周长', 'C = πr + 2r'],
    ['三角形的面积', 'S = ah ÷ 2'],
    ['平行四边形的面积', 'S = ah'],
    ['梯形的面积', 'S = (a + b)h ÷ 2'],
    ['正方体的体积', 'V = a³'],
    ['正方体的表面积', 'S = 6a²'],
    ['长方体的体积', 'V = abh'],
    ['圆柱的高（知体积和底面积）', 'h = V ÷ S'],
    ['圆锥的高（知体积和底面积）', 'h = 3V ÷ S'],
    ['圆的半径（知周长）', 'r = C ÷ π ÷ 2']
  ];

  // 统计图特点：描述类 8 条
  var CHART_PAIRS = [
    ['扇形统计图最适合表示', '各部分与整体的关系'],
    ['折线统计图最能反映', '数量的增减变化趋势'],
    ['条形统计图便于', '比较数量的多少'],
    ['扇形统计图各部分百分比之和', '100%'],
    ['折线统计图不仅能表示数量多少，还能表示', '变化趋势'],
    ['要表示病人 24 小时体温变化，应选用', '折线统计图'],
    ['要表示校园内各种树木占比，应选用', '扇形统计图'],
    ['要比较各班人数多少，应选用', '条形统计图']
  ];

  // 百分比 → 圆心角参数化（扇形统计图）：21 个整好算的百分比
  var PERCENT_FOR_ANGLE = [5, 10, 12, 15, 18, 20, 25, 30, 36, 40, 45, 50, 54, 60, 66, 70, 75, 80, 84, 90, 96];
  var percentPairs = PERCENT_FOR_ANGLE.map(function (n) {
    return ['占 ' + n + '% 的扇形对应的圆心角', (n * 3.6) + '°'];
  });

  // 分数 ↔ 百分数互化（新增 convert 类）：20 条
  var FRAC_PERCENT = [
    ['1/2', '50%'], ['1/4', '25%'], ['3/4', '75%'], ['1/5', '20%'], ['2/5', '40%'],
    ['3/5', '60%'], ['4/5', '80%'], ['1/8', '12.5%'], ['3/8', '37.5%'], ['5/8', '62.5%'],
    ['7/8', '87.5%'], ['1/10', '10%'], ['3/10', '30%'], ['7/10', '70%'], ['9/10', '90%'],
    ['1/20', '5%'], ['3/20', '15%'], ['1/25', '4%'], ['1/16', '6.25%'], ['1/50', '2%']
  ];
  var fracPercentPairs = FRAC_PERCENT.map(function (p) {
    return ['分数 ' + p[0] + ' 化成百分数', p[1]];
  });

  // 小数 ↔ 最简分数互化：15 条
  var DEC_FRAC = [
    ['0.5', '1/2'], ['0.25', '1/4'], ['0.75', '3/4'], ['0.2', '1/5'], ['0.4', '2/5'],
    ['0.6', '3/5'], ['0.8', '4/5'], ['0.125', '1/8'], ['0.375', '3/8'], ['0.625', '5/8'],
    ['0.875', '7/8'], ['0.05', '1/20'], ['0.35', '7/20'], ['0.65', '13/20'], ['0.85', '17/20']
  ];
  var decFracPairs = DEC_FRAC.map(function (p) {
    return ['小数 ' + p[0] + ' 化成最简分数', p[1]];
  });

  // 比 ↔ 分数/比值：6 条
  var RATIO_PAIRS = [
    ['比 3:4 化成分数', '3/4'],
    ['比 2:5 化成分数', '2/5'],
    ['比 5:8 化成分数', '5/8'],
    ['比值 0.5 化成最简比', '1:2'],
    ['比值 0.25 化成最简比', '1:4'],
    ['比的前项 ÷ 比的后项', '比值']
  ];

  // ============ 类别右项池（干扰项来源） ============
  var CATEGORY_POOLS = {
    proportion: PROPORTION_PAIRS.map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
    formula: FORMULA_PAIRS.map(function (p) { return p[1]; }),
    chart: CHART_PAIRS.concat(percentPairs).map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
    convert: fracPercentPairs.concat(decFracPairs).concat(RATIO_PAIRS).map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; })
  };

  // 类别 → 配对清单
  var PAIRS_OF = {
    proportion: PROPORTION_PAIRS,
    formula: FORMULA_PAIRS,
    chart: CHART_PAIRS.concat(percentPairs),
    convert: fracPercentPairs.concat(decFracPairs).concat(RATIO_PAIRS)
  };

  /**
   * 构建 choice 题：left + right（正确）+ 2-4 个干扰右项（候选共 3-5 个）。
   * 干扰项同类优先、跨类补充（混合知识点连线：一道题的候选项可来自不同知识点）。
   */
  function mk(left, right, sameCat, allCats) {
    var distractors = [];
    function tryAdd(v) {
      if (v === right) return;
      if (distractors.indexOf(v) !== -1) return;
      if (distractors.length >= 4) return;
      distractors.push(v);
    }
    var want = rnd(2, 4); // 干扰项个数 → 候选总数 3-5
    var same = shuffle(sameCat);
    for (var i = 0; i < same.length && distractors.length < want; i++) tryAdd(same[i]);
    if (distractors.length < want) {
      var others = [];
      Object.keys(allCats).forEach(function (k) {
        if (k === sameCatKey) return;
        allCats[k].forEach(function (v) { others.push(v); });
      });
      others = shuffle(others);
      for (var j = 0; j < others.length && distractors.length < want; j++) tryAdd(others[j]);
    }
    return {
      q: '把「' + left + '」连到对应的',
      answer: right,
      options: shuffle([right].concat(distractors)),
      hint: '记住对应的概念、公式或数量关系。'
    };
  }
  var sameCatKey = ''; // mk 内部标记当前类别（构建池时设置）

  // ============ 题目池：公共 PoolCache（buildFn 一次性构建完整题目，跨调用连续发牌） ============
  var POOL_OF = {
    proportion: PROPORTION_PAIRS,
    formula: FORMULA_PAIRS,
    chart: CHART_PAIRS.concat(percentPairs),
    convert: fracPercentPairs.concat(decFracPairs).concat(RATIO_PAIRS)
  };
  var CAT_KEY = { proportion: 'proportion', formula: 'formula', chart: 'chart', convert: 'convert' };

  /** 把配对清单构建为完整题目（干扰项同类优先、跨类补充，候选 3-5 个） */
  function buildQuestionsOf(type) {
    var pairs = POOL_OF[type] || POOL_OF.proportion.concat(POOL_OF.formula, POOL_OF.chart, POOL_OF.convert);
    return pairs.map(function (p) {
      sameCatKey = type === 'mix' ? catOf(p) : type;
      var q = mk(p[0], p[1], CATEGORY_POOLS[sameCatKey] || [], CATEGORY_POOLS);
      return { q: q.q, answer: q.answer, options: q.options, hint: q.hint };
    });
  }
  function catOf(p) {
    var left = p[0];
    if (PROPORTION_PAIRS.some(function (x) { return x[0] === left; })) return 'proportion';
    if (FORMULA_PAIRS.some(function (x) { return x[0] === left; })) return 'formula';
    if (fracPercentPairs.concat(decFracPairs, RATIO_PAIRS).some(function (x) { return x[0] === left; })) return 'convert';
    return 'chart';
  }

  var pools = {};
  function poolOf(type) {
    if (!pools[type]) {
      pools[type] = _PU.createPoolCache('math-g6-matching:' + type, function () {
        return type === 'mix'
          ? buildQuestionsOf('proportion').concat(buildQuestionsOf('formula'), buildQuestionsOf('chart'), buildQuestionsOf('convert'))
          : buildQuestionsOf(type);
      });
    }
    return pools[type];
  }

  var TYPE_BUILDERS = {
    'proportion': function () { return poolOf('proportion').take(1)[0]; },
    'formula': function () { return poolOf('formula').take(1)[0]; },
    'chart': function () { return poolOf('chart').take(1)[0]; },
    'convert': function () { return poolOf('convert').take(1)[0]; },
    mix: function () { return poolOf('mix').take(1)[0]; }
  };
  var TYPE_NAMES = {
    'proportion': '正反比例判断',
    'formula': '圆与圆柱圆锥公式',
    'chart': '扇形统计图特点',
    'convert': '分数百分数与比互化',
    mix: '综合连线'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-matching',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '正反比例判断、图形公式、统计图特点与分数百分数互化',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['math-g6-m5-g6-match-proportion', 'math-g6-m5-g6-match-formula', 'math-g6-m5-g6-match-chart'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',        label: '综合连线' },
          { value: 'proportion', label: '正反比例判断' },
          { value: 'formula',    label: '圆与圆柱圆锥公式' },
          { value: 'chart',      label: '扇形统计图特点' },
          { value: 'convert',    label: '分数百分数互化' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || TYPE_BUILDERS.mix;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        // 签名去重（题干+答案）；干扰项差异不参与签名，但牌堆发牌保证题干+答案本身不重复
        var sig = p.q + '|' + p.answer;
        if (!seen[sig]) { seen[sig] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'match', q: p.q, answer: String(p.answer), options: p.options, hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级连线练习（' + (TYPE_NAMES[type] || '综合连线') + '）'
      };
    }
  });

  plugin.poolCache = poolOf('mix'); // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
