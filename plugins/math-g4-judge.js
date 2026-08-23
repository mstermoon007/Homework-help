/**
 * plugins/math-g4-judge.js — 四年级判断题插件（M11 判断）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M11 模块）：
 *   g4-m11-g4-judge-read     大数读写      （type: 'read'）
 *   g4-m11-g4-judge-law      运算律        （type: 'law'）
 *   g4-m11-g4-judge-angle    几何概念      （type: 'angle'）
 *   g4-m11-g4-judge-line     线段射线直线  （type: 'line-ray'）
 *   g4-m11-g4-judge-quotient 商不变规律    （type: 'quotient'）
 *   g4-m11-g4-judge-dec      小数性质      （type: 'dec'）
 *   g4-m11-g4-judge-tri      三角形        （type: 'triangle'）
 *   g4-m11-stats    统计          （type: 'stats'）
 *
 * 判断题以 choice 呈现（√ / ×）。提供标准 ExercisePlugin 接口。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-judge.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // 每条：{ q: 题干, right: boolean, hint: 解析 }
  function buildRead() {
    return pick([
      { q: '读多位数时，每级末尾不管有几个 0，都不读。', right: true, hint: '末尾的 0 不读，中间连续的 0 只读一个。' },
      { q: '五位数一定比四位数大。', right: true, hint: '数位多的数大。' },
      { q: '6006000 读作六百万六千。', right: true, hint: '中间两个 0 只读一个零，末尾三个 0 不读。' },
      { q: '一个数的最高位是万位，这个数是五位数。', right: true, hint: '万位是第五位。' },
      { q: '8 个万和 5 个千组成的数是 85000。', right: true, hint: '8 万 = 80000，加 5 千 = 85000。' },
      { q: '近似数一定比准确数大。', right: false, hint: '四舍五入后可能比准确数大，也可能小。' },
      { q: '403000 读作四十万三千。', right: true, hint: '中间 0 不读。' },
      { q: '最小的五位数是 10000。', right: true, hint: '10000 是五个数位。' },
      { q: '读 8008008 时只读一个零。', right: true, hint: '8008008 读作八百万八千零八，中间零只读一个。' }
    ]);
  }

  function buildLaw() {
    return pick([
      { q: '25×4×8 = 25×8×4 运用了乘法交换律。', right: true, hint: '交换两个因数的位置，积不变。' },
      { q: '(a+b)+c = a+(b+c) 是加法结合律。', right: true, hint: '三个数相加，先加前两个或后两个，和不变。' },
      { q: '125×(8+4) = 125×8+125×4 是乘法分配律。', right: true, hint: '乘法分配律：(a+b)×c = a×c+b×c。' },
      { q: '25×(40×8) = 25×40×8 运用了乘法分配律。', right: false, hint: '这是乘法结合律（先结合 40×8），不是分配律。' },
      { q: 'a×b = b×a 是乘法结合律。', right: false, hint: '这是乘法交换律。' },
      { q: '99×36 = 36×100−36 运用了乘法分配律。', right: true, hint: '99 = 100−1，36×(100−1) = 3600−36。' },
      { q: '加法交换律可以写成 a+b = b+a。', right: true, hint: '两个数相加，交换加数位置，和不变。' }
    ]);
  }

  function buildAngle() {
    return pick([
      { q: '大于 90° 的角都是钝角。', right: false, hint: '大于 90° 且小于 180° 才是钝角，平角 180° 不是。' },
      { q: '一个平角等于两个直角。', right: true, hint: '180° = 2×90°。' },
      { q: '一个周角等于四个直角。', right: true, hint: '360° = 4×90°。' },
      { q: '两个锐角的和一定大于 90°。', right: false, hint: '如 30°+40°=70°，小于 90°。' },
      { q: '直角是 90°。', right: true, hint: '直角 = 90°。' },
      { q: '用量角器量角时，角的顶点要和量角器的中心重合。', right: true, hint: '量角的正确操作。' },
      { q: '1 时整，时针和分针所成的角是 30°。', right: true, hint: '一个大格 30°。' },
      { q: '180° 的角是锐角。', right: false, hint: '180° 是平角。' }
    ]);
  }

  function buildLineRay() {
    return pick([
      { q: '线段有两个端点，可以量出长度。', right: true, hint: '线段有限长。' },
      { q: '射线只有一个端点。', right: true, hint: '射线向一端无限延伸。' },
      { q: '直线可以向两端无限延伸，不能量出长度。', right: true, hint: '直线没有端点。' },
      { q: '过一点只能画一条直线。', right: false, hint: '过一点能画无数条直线。' },
      { q: '过两点只能画一条直线。', right: true, hint: '两点确定一条直线。' },
      { q: '线段是直线的一部分。', right: true, hint: '在直线上截取一段就是线段。' },
      { q: '直线比射线长。', right: false, hint: '直线和射线都无限延伸，不能比较长短。' },
      { q: '射线和直线都不能量出长度。', right: true, hint: '它们都无限延伸。' }
    ]);
  }

  function buildQuotient() {
    return pick([
      { q: '被除数和除数同时乘 5，商不变。', right: true, hint: '商不变规律。' },
      { q: '被除数和除数同时除以 10，商不变。', right: true, hint: '商不变规律。' },
      { q: '被除数乘 3，除数不变，商乘 3。', right: true, hint: '除数不变，被除数扩大几倍商也扩大几倍。' },
      { q: '被除数和除数同时加上相同的数，商不变。', right: false, hint: '是同时乘或除以相同的数（0 除外），不是加或减。' },
      { q: '0 不能作除数。', right: true, hint: '0 作除数没有意义。' },
      { q: '600÷30 = 60÷3。', right: true, hint: '被除数和除数同时除以 10，商不变，都是 20。' }
    ]);
  }

  function buildDec() {
    return pick([
      { q: '小数的末尾添上 0 或去掉 0，小数的大小不变。', right: true, hint: '小数的性质。' },
      { q: '0.5 和 0.50 大小相等。', right: true, hint: '末尾添 0，大小不变。' },
      { q: '小数点右边的第一位是百分位。', right: false, hint: '右边第一位是十分位。' },
      { q: '3.60 的计数单位是 0.01。', right: true, hint: '两位小数的计数单位是 0.01。' },
      { q: '0.1 和 0.10 大小不相等。', right: false, hint: '末尾添 0 大小不变，0.1 = 0.10。' },
      { q: '整数部分最小的计数单位是个位。', right: true, hint: '整数部分从个位起。' },
      { q: '把 0.9 改写成两位小数是 0.09。', right: false, hint: '应写成 0.90，末尾添 0。' }
    ]);
  }

  function buildTriangle() {
    return pick([
      { q: '三角形内角和是 180°。', right: true, hint: '任意三角形内角和 180°。' },
      { q: '三角形按角分可分为锐角三角形、直角三角形和钝角三角形。', right: true, hint: '按角分类。' },
      { q: '等边三角形一定是锐角三角形。', right: true, hint: '三个角都是 60°。' },
      { q: '一个三角形最多有一个钝角。', right: true, hint: '两个钝角和超过 180°。' },
      { q: '等腰三角形是轴对称图形。', right: true, hint: '沿顶角平分线对折重合。' },
      { q: '三角形任意两边之和大于第三边。', right: true, hint: '三角形三边关系。' },
      { q: '直角三角形只有一条高。', right: false, hint: '任何三角形都有三条高。' },
      { q: '两个完全一样的三角形一定能拼成一个平行四边形。', right: true, hint: '拼图结论。' }
    ]);
  }

  function buildStats() {
    return pick([
      { q: '条形统计图能直观地看出数量的多少。', right: true, hint: '条形越高数量越多。' },
      { q: '平均数是反映一组数据总体水平的数。', right: true, hint: '平均数的意义。' },
      { q: '一组数据的平均数一定比这组数据的最大值大。', right: false, hint: '平均数介于最小值和最大值之间。' },
      { q: '在条形统计图中，1 格可以表示多个单位。', right: true, hint: '数据大时 1 格可表示 2、5 等。' },
      { q: '平均数等于总数除以份数。', right: true, hint: '平均数公式。' },
      { q: '复式条形统计图可以同时比较两组数据。', right: true, hint: '复式图有两个图例。' }
    ]);
  }

  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 14) return buildRead();
    if (r <= 28) return buildLaw();
    if (r <= 42) return buildAngle();
    if (r <= 56) return buildLineRay();
    if (r <= 70) return buildQuotient();
    if (r <= 82) return buildDec();
    if (r <= 92) return buildTriangle();
    return buildStats();
  }

  var TYPE_BUILDERS = {
    'read': buildRead,
    'law': buildLaw,
    'angle': buildAngle,
    'line-ray': buildLineRay,
    'quotient': buildQuotient,
    'dec': buildDec,
    'triangle': buildTriangle,
    'stats': buildStats,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'read': '大数读写',
    'law': '运算律',
    'angle': '几何概念',
    'line-ray': '线段射线直线',
    'quotient': '商不变规律',
    'dec': '小数性质',
    'triangle': '三角形',
    'stats': '统计',
    mix: '综合判断'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-judge',
    moduleId: 'M11',
    name: '判断题',
    pageSubtitle: '大数、运算律、几何、小数、三角形与统计',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g4-m11-g4-judge-read',
        'g4-m11-g4-judge-law',
        'g4-m11-g4-judge-angle',
        'g4-m11-g4-judge-line',
        'g4-m11-g4-judge-quotient',
        'g4-m11-g4-judge-dec',
        'g4-m11-g4-judge-tri',
        'g4-m11-stats'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',       label: '综合判断' },
          { value: 'read',      label: '大数读写' },
          { value: 'law',       label: '运算律' },
          { value: 'angle',     label: '几何概念' },
          { value: 'line-ray',  label: '线段射线直线' },
          { value: 'quotient',  label: '商不变规律' },
          { value: 'dec',       label: '小数性质' },
          { value: 'triangle',  label: '三角形' },
          { value: 'stats',     label: '统计' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 60, 400);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'judge', q: p.q, answer: p.right ? '√' : '×',
          options: shuffle(['√', '×']), inputType: 'choice', hint: p.hint };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级判断练习（' + (TYPE_NAMES[type] || '综合判断') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);