/**
 * plugins/math-g6-judge.js — 六年级判断题插件（M11 易错概念判断）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M11 模块）：
 *   g6-m11-g6-judge-circle        圆                  （type: 'circle'）
 *   g6-m11-g6-judge-cyl-cone      圆柱与圆锥          （type: 'cyl-cone'）
 *   g6-m11-g6-judge-negative      负数                （type: 'negative'）
 *   g6-m11-g6-judge-percent-ratio 百分数与比          （type: 'percent-ratio'）
 *   g6-m11-g6-judge-chart         扇形统计图          （type: 'chart'）
 *
 * 变体扩充（目标：重复率 ≤10%）：
 *   - 每个知识点多角度判断句（正确 / 错误 / 条件缺失），每类 ≥15 条
 *   - 条件变体：如「圆锥体积是圆柱的 1/3」（缺条件，×）→「等底等高」（√）→「3 倍」（×）
 *   - 数字参数化：半径扩大 k 倍、占 N% 圆心角、−a 与 −b 比大小、比值 a÷b 等
 *   - 混合知识点出题：跨类综合判断（如圆柱体积与反比例、圆锥占比与百分数）
 *   - 题目池缓存：模块级牌堆按题型分堆，全量池洗牌后跨 generate 连续发牌（池 ≥110 签名）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-judge.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function J(q, right, hint) { return { q: q, right: right, hint: hint }; }

  // ============ 圆（静态 9 + 参数化 16 = 25） ============
  function poolCircle() {
    var list = [
      J('在同一个圆里，直径是半径的 2 倍。', true, 'd = 2r。'),
      J('圆的周长与直径的比值是 π。', true, 'π 是圆周率。'),
      J('半径 2 厘米的圆的周长和面积相等。', false, '数值都是 12.56，但周长是长度、面积是大小，不能比较。'),
      J('半圆的周长等于圆周长的一半。', false, '还要加上直径的长度。'),
      J('π 是一个无限不循环小数。', true, 'π ≈ 3.14159……'),
      J('圆是轴对称图形，有无数条对称轴。', true, '任意一条直径所在直线都是对称轴。'),
      J('圆心决定圆的位置，半径决定圆的大小。', true, '圆的要素。'),
      J('两端都在圆上的线段叫做直径。', false, '必须经过圆心才是直径。'),
      J('大圆的圆周率比小圆的圆周率大。', false, '圆周率是一个固定的数，与圆的大小无关。')
    ];
    // 参数化：半径/直径扩大 k 倍（k∈2..5），周长正比（√）与面积平方（×）
    for (var k = 2; k <= 5; k++) {
      list.push(J('圆的半径扩大到原来的 ' + k + ' 倍，周长也扩大到原来的 ' + k + ' 倍。', true, '周长 = 2πr，与半径成正比。'));
      list.push(J('圆的半径扩大到原来的 ' + k + ' 倍，面积扩大到原来的 ' + k + ' 倍。', false, '面积 = πr²，应扩大到原来的 ' + (k * k) + ' 倍。'));
      if (k <= 3) list.push(J('圆的直径扩大到原来的 ' + k + ' 倍，周长扩大到原来的 ' + (k * 2) + ' 倍。', false, '周长与直径成正比，应扩大 ' + k + ' 倍。'));
    }
    // 直径求半径参数化
    [4, 6, 8, 10].forEach(function (d) {
      list.push(J('圆的直径是 ' + d + ' 厘米，半径是 ' + (d / 2) + ' 厘米。', true, '半径 = 直径 ÷ 2 = ' + (d / 2) + ' 厘米。'));
    });
    // 混合知识点：圆 + 比/不变量
    list.push(J('圆的半径扩大 3 倍，周长和面积都扩大 3 倍。', false, '周长扩大 3 倍，面积扩大 9 倍，不能一概而论。'));
    return list;
  }

  // ============ 圆柱与圆锥（静态 9 + 变体 12 = 21） ============
  function poolCylCone() {
    var list = [
      J('圆柱有无数条高。', true, '两个底面间的距离处处相等。'),
      J('圆锥的体积是圆柱体积的 1/3。', false, '必须等底等高时才是 1/3，题目缺少条件。'),
      J('圆锥的体积是等底等高圆柱体积的 1/3。', true, '等底等高时圆锥体积 = 圆柱 × 1/3。'),
      J('等底等高的圆柱体积是圆锥体积的 3 倍。', true, '圆柱与圆锥的关系。'),
      J('圆锥的体积是等底等高圆柱体积的 3 倍。', false, '正好说反了，圆柱才是圆锥的 3 倍。'),
      J('圆柱的侧面沿高展开是一个长方形。', true, '底面周长 = 长，高 = 宽。'),
      J('圆锥只有 1 条高。', true, '顶点到底面圆心的距离。'),
      J('圆柱的体积 = 底面积 × 高。', true, '圆柱体积公式。'),
      J('圆柱的侧面展开一定是一个长方形。', false, '沿高展开才是长方形，斜着剪开是平行四边形。'),
      J('圆柱的侧面沿斜线剪开，展开后是平行四边形。', true, '斜剪展开是平行四边形。'),
      J('圆锥的体积 = 底面积 × 高 ÷ 3。', true, '圆锥体积公式。'),
      J('圆柱有 2 个底面，圆锥有 1 个底面。', true, '立体图形的特征。'),
      J('等底等高的圆锥体积占圆柱和圆锥体积之和的 1/4。', true, '圆锥占 1 份、圆柱占 3 份，共 4 份。')
    ];
    // 参数化：高扩大 k 倍（底面积不变）体积正比
    [2, 3, 4].forEach(function (k) {
      list.push(J('圆柱的底面积不变，高扩大到原来的 ' + k + ' 倍，体积扩大到原来的 ' + k + ' 倍。', true, 'V = Sh，高与体积成正比。'));
    });
    [2, 3].forEach(function (k) {
      list.push(J('圆柱的体积不变，高扩大到原来的 ' + k + ' 倍，底面积也扩大到原来的 ' + k + ' 倍。', false, '体积不变时，底面积应缩小到原来的 1/' + k + '。'));
    });
    // 混合知识点：圆柱 + 反比例
    list.push(J('圆柱体积一定，底面积和高成反比例。', true, '底面积 × 高 = 体积（一定）。'));
    return list;
  }

  // ============ 负数（静态 8 + 参数化 11 = 19） ============
  function poolNegative() {
    var list = [
      J('0 既不是正数也不是负数。', true, '0 是正负数的分界。'),
      J('负数都比 0 小。', true, '负数小于 0。'),
      J('温度上升 3℃ 记作 +3℃，下降 3℃ 记作 −3℃。', true, '相反意义的量。'),
      J('正数都比负数大。', true, '正数 > 0 > 负数。'),
      J('整数包括正整数、0 和负整数。', true, '整数的分类。'),
      J('海拔低于海平面通常记作负数。', true, '海平面是 0 米基准。'),
      J('收入记作正数时，支出也应记作正数。', false, '支出与收入意义相反，应记作负数。'),
      J('不带符号的数都是正数。', false, '0 不带符号，但 0 不是正数。')
    ];
    // 参数化：−a 与 −b 比大小（a>b → −a<−b）
    var pairs = [[5, 3], [7, 2], [9, 4], [6, 1], [8, 3], [4, 1]];
    pairs.forEach(function (p) {
      list.push(J('−' + p[0] + ' 比 −' + p[1] + ' 大。', false, '−' + p[0] + ' < −' + p[1] + '，负数绝对值大的反而小。'));
    });
    // 参数化：温度 −x 比 −y 高（x<y）
    [[2, 6], [3, 8], [1, 5]].forEach(function (p) {
      list.push(J('气温 −' + p[0] + '℃ 比 −' + p[1] + '℃ 高。', true, '−' + p[0] + ' > −' + p[1] + '。'));
    });
    return list;
  }

  // ============ 百分数与比（静态 22 + 参数化 14 = 36） ============
  function poolPercentRatio() {
    var list = [
      J('百分数也叫百分率或百分比。', true, '百分数的别名。'),
      J('百分数的分母是 100。', false, '百分数通常不写成分数形式，不讨论分母。'),
      J('一件商品先提价 10%，再降价 10%，价格不变。', false, '提价后价格 × 110%，再降 10% 后为原价的 99%。'),
      J('1/4 改写成百分数是 25%。', true, '1 ÷ 4 = 0.25 = 25%。'),
      J('出勤率 = 出勤人数 ÷ 总人数 × 100%。', true, '出勤率公式。'),
      J('百分数可以超过 100%。', true, '如增长率可以超过 100%。'),
      J('小数 0.5 改写成百分数是 5%。', false, '0.5 = 50%。'),
      J('百分数表示一个数是另一个数的百分之几。', true, '百分数的意义。'),
      J('比的前项和后项同时乘或除以相同的数（0 除外），比值不变。', true, '比的基本性质。'),
      J('比的后项可以是任意数。', false, '比的后项不能是 0。'),
      J('足球比赛 2:0 中的比和我们学的比意义相同。', false, '比赛比分不是数学中的比。'),
      J('比值通常用分数、小数或整数表示。', true, '比值是一个数。'),
      J('比的前项相当于除法中的被除数。', true, '比、分数、除法三者的关系。'),
      J('最简整数比的前项和后项都是整数且互质。', true, '最简整数比的定义。'),
      J('正方形的边长和周长成正比例。', true, '周长 ÷ 边长 = 4（一定）。'),
      J('正方形的面积和边长成正比例。', false, '面积 ÷ 边长 = 边长（不一定）。'),
      J('圆的周长和直径成正比例。', true, '周长 ÷ 直径 = π（一定）。'),
      J('路程一定，速度和时间成反比例。', true, '速度 × 时间 = 路程（一定）。'),
      J('比例尺 = 图上距离 × 实际距离。', false, '比例尺 = 图上距离 ÷ 实际距离。'),
      J('在比例中，两个内项的积等于两个外项的积。', true, '比例的基本性质。'),
      J('正比例图象是一条过原点的直线。', true, '正比例图象。'),
      J('一批种子发芽率不可能超过 100%。', true, '发芽粒数不会超过总粒数。')
    ];
    // 参数化：分数 → 百分数
    [['1/2', '50%'], ['3/4', '75%'], ['2/5', '40%']].forEach(function (p) {
      list.push(J('分数 ' + p[0] + ' 改写成百分数是 ' + p[1] + '。', true, p[0] + ' = ' + p[1] + '。'));
    });
    // 参数化：小数化百分数错误变体
    [['0.3', '3%', '30%'], ['0.05', '50%', '5%']].forEach(function (p) {
      list.push(J('小数 ' + p[0] + ' 改写成百分数是 ' + p[1] + '。', false, p[0] + ' = ' + p[2] + '。'));
    });
    // 参数化：比值计算（前项 ÷ 后项）
    [[4, 2], [6, 3], [8, 4], [9, 3], [10, 5]].forEach(function (p) {
      list.push(J('一个比的前项是 ' + p[0] + '，后项是 ' + p[1] + '，比值是 ' + (p[0] / p[1]) + '。', true, p[0] + ' ÷ ' + p[1] + ' = ' + (p[0] / p[1]) + '。'));
    });
    // 参数化：提价降价 x%
    [10, 20, 50].forEach(function (x) {
      list.push(J('一件商品先提价 ' + x + '%，再降价 ' + x + '%，价格回到原价。', false, '提价后再降价，最终是原价的 ' + (100 - x * x / 100) + '%。'));
    });
    // 参数化：命中率公式变体
    list.push(J('命中率 = 命中次数 ÷ 总次数 × 100%。', true, '命中率公式。'));
    list.push(J('含糖率 = 糖的质量 ÷ 糖水质量 × 100%。', true, '含糖率公式。'));
    return list;
  }

  // ============ 扇形统计图（静态 6 + 参数化 10 = 16） ============
  function poolChart() {
    var list = [
      J('扇形统计图能清楚地表示各部分与总数之间的关系。', true, '扇形统计图的特点。'),
      J('折线统计图能反映数量的增减变化情况。', true, '折线统计图的特点。'),
      J('条形统计图适合表示各部分与整体的关系。', false, '条形图适合比较数量多少，扇形图适合表示与整体的关系。'),
      J('扇形统计图中，各部分百分比之和是 100%。', true, '整体是 100%。'),
      J('要表示气温变化趋势应选用扇形统计图。', false, '应选用折线统计图。'),
      J('扇形统计图能直观反映数量的增减变化。', false, '那是折线统计图的特点。')
    ];
    // 参数化：占 N% 圆心角 = 3.6N°（正确 6 + 错误 4）
    [10, 20, 25, 40, 50, 60].forEach(function (n) {
      list.push(J('扇形统计图中，占 ' + n + '% 的部分，圆心角是 ' + (n * 3.6) + '°。', true, '360° × ' + n + '% = ' + (n * 3.6) + '°。'));
    });
    [[30, 30], [25, 25], [50, 50], [20, 2]].forEach(function (p) {
      list.push(J('扇形统计图中，占 ' + p[0] + '% 的部分，圆心角是 ' + p[1] + '°。', false, '圆心角 = 360° × ' + p[0] + '% = ' + (p[0] * 3.6) + '°。'));
    });
    return list;
  }

  // ============ 题目池：公共 PoolCache（跨调用连续发牌，见 shared/common.js） ============
  var POOL_BUILDERS = {
    circle: poolCircle,
    'cyl-cone': poolCylCone,
    negative: poolNegative,
    'percent-ratio': poolPercentRatio,
    chart: poolChart
  };
  function mixPool() {
    return poolCircle().concat(poolCylCone(), poolNegative(), poolPercentRatio(), poolChart());
  }
  var pools = {};
  function poolOf(type) {
    if (!pools[type]) {
      pools[type] = _PU.createPoolCache('math-g6-judge:' + type, function () {
        return type === 'mix' ? mixPool() : (POOL_BUILDERS[type] ? POOL_BUILDERS[type]() : mixPool());
      });
    }
    return pools[type];
  }

  var TYPE_BUILDERS = {
    'circle': function () { return poolOf('circle').take(1)[0]; },
    'cyl-cone': function () { return poolOf('cyl-cone').take(1)[0]; },
    'negative': function () { return poolOf('negative').take(1)[0]; },
    'percent-ratio': function () { return poolOf('percent-ratio').take(1)[0]; },
    'chart': function () { return poolOf('chart').take(1)[0]; },
    mix: function () { return poolOf('mix').take(1)[0]; }
  };
  var TYPE_NAMES = {
    'circle': '圆',
    'cyl-cone': '圆柱与圆锥',
    'negative': '负数',
    'percent-ratio': '百分数与比',
    'chart': '扇形统计图',
    mix: '综合判断'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-judge',
    moduleId: 'M11',
    name: '判断题',
    pageSubtitle: '圆、圆柱圆锥、负数、百分数与比、扇形统计图',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g6-m11-g6-judge-circle',
        'math-g6-m11-g6-judge-cyl-cone',
        'math-g6-m11-g6-judge-negative',
        'math-g6-m11-g6-judge-percent-ratio',
        'math-g6-m11-g6-judge-chart'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',           label: '综合判断' },
          { value: 'circle',        label: '圆' },
          { value: 'cyl-cone',      label: '圆柱与圆锥' },
          { value: 'negative',      label: '负数' },
          { value: 'percent-ratio', label: '百分数与比' },
          { value: 'chart',         label: '扇形统计图' }
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
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'judge', q: p.q, answer: p.right ? '√' : '×', options: shuffle(['√', '×']), hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学六年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  plugin.poolCache = poolOf('mix'); // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
