/**
 * plugins/math-g5-choice.js — 五年级选择题插件（M12 选择）
 *
 * 知识点覆盖（shared/knowledge-bank.js 五年级 M12 模块）：
 *   g5-m12-g5-choice-decmul    小数乘除法        （type: 'dec'）
 *   g5-m12-g5-choice-equ       方程              （type: 'equation'）
 *   g5-m12-g5-choice-fm        因数与倍数        （type: 'factor-multiple'）
 *   g5-m12-g5-choice-frac      分数的意义与性质  （type: 'fraction'）
 *   g5-m12-g5-choice-area      多边形的面积      （type: 'area'）
 *   g5-m12-g5-choice-solid     长方体正方体容积  （type: 'solid'）
 *   g5-m12-motion    图形的运动        （type: 'rotation'）
 *   g5-m12-g5-choice-possib    可能性            （type: 'possibility'）
 *   g5-m12-stats     统计              （type: 'stats'）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g5-choice.js 依赖 shared/common.js（PluginUtil），请先加载');

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
  function trimD(x) { return String(Number(x.toFixed(3))); }

  // 生成 n 个两两不同选项（answer 必在首位并被选中）。
  // genExtra(kind) 生成补充干扰项：'num' 随机整数，'frac' 随机分数，'text' 备用文本
  function mkOptions(answer, cands, n, genKind) {
    n = n || 4;
    var ans = String(answer);
    var pool = [ans];
    cands.forEach(function (c) {
      var s = String(c);
      if (s && s !== ans && pool.indexOf(s) === -1) pool.push(s);
    });
    var guard = 0;
    while (pool.length < n && guard < 80) {
      var e;
      if (genKind === 'frac') {
        e = pick([1, 2, 3, 4, 5]) + '/' + pick([2, 3, 4, 5, 6, 8]);
      } else if (genKind === 'text') {
        e = '其他';
      } else {
        e = String(rnd(2, 99));
      }
      if (e !== ans && pool.indexOf(e) === -1) pool.push(e);
      guard++;
    }
    var rest = shuffle(pool.slice(1));
    var out = [ans];
    for (var i = 0; i < n - 1; i++) out.push(rest[i % rest.length]);
    return shuffle(out);
  }

  // ============ 小数乘除法 ============
  function buildDec() {
    var v = pick(['mul', 'div', 'cmp']);
    if (v === 'mul') {
      var a = rnd(2, 9) / 10, b = rnd(2, 9) / 10;
      var ans = a * b;
      var cands = [trimD(ans), trimD(ans + 1), trimD(ans * 10), trimD(ans / 10), trimD(ans + 0.5)];
      return { q: trimD(a) + ' × ' + trimD(b) + ' =（  ）', answer: trimD(ans), options: mkOptions(trimD(ans), cands, 4, 'num'), hint: '小数乘法：0.' + String(ans).replace('.', '') + ' 先按整数乘再点小数点。' };
    }
    if (v === 'div') {
      var d = rnd(2, 9) / 10;
      var q = rnd(2, 9);
      var dividend = d * q;
      var cands2 = [String(q), String(q + 1), String(q - 1), String(q * 10), String(q / 10)];
      return { q: trimD(dividend) + ' ÷ ' + trimD(d) + ' =（  ）', answer: String(q), options: mkOptions(String(q), cands2, 4, 'num'), hint: trimD(dividend) + ' ÷ ' + trimD(d) + ' = ' + q + '（除数化成整数再算）。' };
    }
    var n = rnd(3, 9);
    var ans3 = n * 0.1;
    var cands3 = [trimD(ans3), String(n), trimD(n / 10) + '0', trimD(n * 10), trimD(n + 0.1)];
    return { q: n + ' × 0.1 =（  ）', answer: trimD(ans3), options: mkOptions(trimD(ans3), cands3, 4, 'num'), hint: '乘 0.1 相当于除以 10。' };
  }

  // ============ 方程 ============
  function buildEquation() {
    var v = pick(['which', 'solve', 'prop']);
    if (v === 'which') {
      var x = rnd(2, 9), b = rnd(2, 9);
      var eqAns = 'x + ' + b + ' = ' + (x + b);
      var cands = [eqAns, x + ' + ' + b, 'x + ' + b + ' > ' + (x + b + 1), b + ' = ' + b];
      return { q: '下面（  ）是方程', answer: eqAns, options: mkOptions(eqAns, cands, 4, 'text'), hint: '方程必须含未知数且是等式。' };
    }
    if (v === 'solve') {
      var x2 = rnd(2, 9), b2 = rnd(2, 9);
      var sum = x2 + b2;
      var cands2 = [String(x2), String(b2), String(sum), String(sum + 1)];
      return { q: 'x + ' + b2 + ' = ' + sum + '，x =（  ）', answer: String(x2), options: mkOptions(String(x2), cands2, 4, 'num'), hint: 'x = ' + sum + ' − ' + b2 + ' = ' + x2 + '。' };
    }
    var a = rnd(2, 5), k = rnd(3, 9);
    var cands3 = [String(a), String(k), String(a * k), String(Math.round(k / a))];
    return { q: '方程 ' + k + 'x = ' + (k * a) + ' 的解是 x =（  ）', answer: String(a), options: mkOptions(String(a), cands3, 4, 'num'), hint: 'x = ' + (k * a) + ' ÷ ' + k + ' = ' + a + '。' };
  }

  // ============ 因数与倍数 ============
  function buildFactorMultiple() {
    var v = pick(['prime', 'lcm', 'div']);
    if (v === 'prime') {
      var p = pick([2, 3, 5, 7, 11, 13, 17, 19]);
      var cands = [String(p), String(p + 1), String(p * 2), String(p * p)];
      return { q: '下面（  ）是质数', answer: String(p), options: mkOptions(String(p), cands, 4, 'num'), hint: '质数只有 1 和它本身两个因数。' };
    }
    if (v === 'lcm') {
      var m = pick([4, 6, 8, 9, 10, 12]);
      var n2 = pick([2, 3, 4]);
      var lcm = m * n2 / gcd(m, n2);
      var cands2 = [String(lcm), String(m * n2), String(m + n2), String(Math.max(m, n2))];
      return { q: m + ' 和 ' + n2 + ' 的最小公倍数是（  ）', answer: String(lcm), options: mkOptions(String(lcm), cands2, 4, 'num'), hint: '用短除法求最小公倍数。' };
    }
    var base = rnd(11, 30), k2 = rnd(2, 5);
    var val = base * k2;
    var cands3 = [String(k2), String(val), String(base), String(val + 1)];
    return { q: '一个数的最大因数是 ' + base + '，它是 ' + k2 + ' 的倍数，这个数是（  ）', answer: String(val), options: mkOptions(String(val), cands3, 4, 'num'), hint: '最大因数是它本身：' + base + '，再找它的倍数。' };
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // ============ 分数的意义与性质 ============
  function buildFraction() {
    var v = pick(['unit', 'eq', 'dec']);
    if (v === 'unit') {
      var d = pick([3, 4, 5, 6, 8]);
      var n = rnd(1, d - 1);
      var ans = '1/' + d;
      var cands = [ans, String(n), '1', n + '/' + d];
      return { q: n + '/' + d + ' 的分数单位是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'frac'), hint: '分数单位是 1/分母。' };
    }
    if (v === 'eq') {
      var n2 = rnd(1, 3), d2 = pick([4, 6, 8, 10]);
      var ans2 = n2 + '/' + d2;
      var cands2 = [ans2, (n2 * 2) + '/' + d2, (n2 + 1) + '/' + d2, n2 + '/' + (d2 * 2 + 1)];
      return { q: '与 ' + n2 + '/' + d2 + ' 相等的是（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'frac'), hint: '约分或通分后相等的分数。' };
    }
    var f = pick([0.5, 0.25, 0.75]);
    var fS = f === 0.5 ? '1/2' : f === 0.25 ? '1/4' : '3/4';
    var cands3 = ['1/2', '1/4', '3/4', '2/5'];
    return { q: f + ' =（  ）', answer: fS, options: mkOptions(fS, cands3, 4, 'frac'), hint: f + ' 化成分数并约分。' };
  }

  // ============ 多边形的面积 ============
  function buildArea() {
    var v = pick(['tri', 'trap', 'formula']);
    if (v === 'tri') {
      var b = rnd(4, 10), h = rnd(3, 8);
      var ans = b * h / 2;
      var cands = [String(ans), String(b * h), String(b * h / 4), String((b + h) / 2)];
      return { q: '底 ' + b + '、高 ' + h + ' 的三角形面积 =（  ）', answer: String(ans), options: mkOptions(String(ans), cands, 4, 'num'), hint: '三角形面积 = 底 × 高 ÷ 2。' };
    }
    if (v === 'trap') {
      var up = rnd(3, 6), down = rnd(7, 10), h3 = rnd(3, 7);
      var ans3 = (up + down) * h3 / 2;
      var cands2 = [String(ans3), String(up * down), String((up + down) * h3), String((up + down) * h3 / 4)];
      return { q: '上底 ' + up + '、下底 ' + down + '、高 ' + h3 + ' 的梯形面积 =（  ）', answer: String(ans3), options: mkOptions(String(ans3), cands2, 4, 'num'), hint: '梯形面积 =（上底+下底）×高÷2。' };
    }
    var s = rnd(3, 8);
    var cands3 = [String(s * s), String(s * 4), String(s + s), String(s * s * 2)];
    return { q: '边长 ' + s + ' 的正方形面积 =（  ）', answer: String(s * s), options: mkOptions(String(s * s), cands3, 4, 'num'), hint: '正方形面积 = 边长 × 边长。' };
  }

  // ============ 长方体正方体容积 ============
  function buildSolid() {
    var v = pick(['vol', 'unit', 'surface']);
    if (v === 'vol') {
      var a = rnd(2, 5), b = rnd(2, 5), c = rnd(2, 5);
      var ans = a * b * c;
      var cands = [String(ans), String(a + b + c), String(2 * (a * b + b * c + a * c)), String(a * b * c + 1)];
      return { q: '长 ' + a + '、宽 ' + b + '、高 ' + c + ' 的长方体体积 =（  ）', answer: String(ans), options: mkOptions(String(ans), cands, 4, 'num'), hint: '体积 = 长 × 宽 × 高。' };
    }
    if (v === 'unit') {
      var ansU = '1000 毫升';
      var cands2 = ['1 升', '100 毫升', ansU, '10 毫升'];
      return { q: '1 升 =（  ）', answer: ansU, options: mkOptions(ansU, cands2, 4, 'text'), hint: '1 升 = 1000 毫升。' };
    }
    var s = rnd(2, 4);
    var surf = 6 * s * s;
    var cands3 = [String(surf), String(s * s), String(s * s * s), String(12 * s)];
    return { q: '棱长 ' + s + ' 的正方体表面积 =（  ）', answer: String(surf), options: mkOptions(String(surf), cands3, 4, 'num'), hint: '正方体表面积 = 6 × 棱长 × 棱长。' };
  }

  // ============ 图形的运动 ============
  function buildRotation() {
    var v = pick(['sym', 'rot', 'order']);
    if (v === 'sym') {
      var ans = '长方形';
      var cands = [ans, '平行四边形', '梯形', '三角形'];
      return { q: '下面（  ）是轴对称图形', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: '长方形沿对称轴对折能完全重合。' };
    }
    if (v === 'rot') {
      var ans2 = '90°';
      var cands2 = [ans2, '45°', '60°', '180°'];
      return { q: '一个直角旋转成平角，旋转了（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'text'), hint: '直角 90°，平角 180°，180−90 = 90°。' };
    }
    var ans3 = '4 条';
    var cands3 = [ans3, '2 条', '3 条', '1 条'];
    return { q: '正方形有（  ）条对称轴', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: '两条对角线 + 两条中位线。' };
  }

  // ============ 可能性 ============
  function buildPossibility() {
    var v = pick(['frac', 'bigger']);
    if (v === 'frac') {
      var red = rnd(2, 4), white = rnd(2, 4);
      var total = red + white;
      var ans = red + '/' + total;
      var cands = [ans, white + '/' + total, '1/2', '1'];
      return { q: '袋里有 ' + red + ' 个红球、' + white + ' 个白球，摸到红球的可能性是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'frac'), hint: '红球数 ÷ 总数。' };
    }
    var r1 = rnd(1, 4), t1 = r1 + rnd(1, 4);
    var r2 = rnd(1, 4), t2 = r2 + rnd(1, 4);
    var p1 = r1 / t1, p2 = r2 / t2;
    var ans = p1 === p2 ? '一样大' : p1 > p2 ? '袋子一' : '袋子二';
    var cands2 = ['袋子一', '袋子二', '一样大'];
    return { q: '袋子一红球 ' + r1 + '/' + t1 + '，袋子二红球 ' + r2 + '/' + t2 + '，摸到红球可能性大的是（  ）', answer: ans, options: mkOptions(ans, cands2, 3, 'text'), hint: '比较分数大小：' + r1 + '/' + t1 + ' 和 ' + r2 + '/' + t2 + '。' };
  }

  // ============ 统计 ============
  function buildStats() {
    var v = pick(['chart', 'trend']);
    if (v === 'chart') {
      var ans = '折线统计图';
      var cands = [ans, '条形统计图', '统计表', '以上都可以'];
      return { q: '表示数量增减变化情况，应选（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: '折线统计图能反映变化趋势。' };
    }
    var vals = [];
    for (var i = 0; i < 5; i++) vals.push(rnd(20, 80));
    var cands2 = ['上升', '下降', '不变', '无法判断'];
    var ans = vals[4] > vals[0] ? '上升' : vals[4] < vals[0] ? '下降' : '不变';
    return { q: '数据 ' + vals.join('、') + ' 的整体趋势是（  ）', answer: ans, options: mkOptions(ans, cands2, 4, 'text'), hint: '比较第一个和最后一个数。' };
  }

  // ============ 综合选择 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 14) return buildDec();
    if (r <= 28) return buildEquation();
    if (r <= 42) return buildFactorMultiple();
    if (r <= 56) return buildFraction();
    if (r <= 70) return buildArea();
    if (r <= 80) return buildSolid();
    if (r <= 88) return buildRotation();
    if (r <= 95) return buildPossibility();
    return buildStats();
  }

  var TYPE_BUILDERS = {
    'dec': buildDec,
    'equation': buildEquation,
    'factor-multiple': buildFactorMultiple,
    'fraction': buildFraction,
    'area': buildArea,
    'solid': buildSolid,
    'rotation': buildRotation,
    'possibility': buildPossibility,
    'stats': buildStats,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'dec': '小数乘除法',
    'equation': '方程',
    'factor-multiple': '因数与倍数',
    'fraction': '分数的意义与性质',
    'area': '多边形的面积',
    'solid': '长方体正方体容积',
    'rotation': '图形的运动',
    'possibility': '可能性',
    'stats': '统计',
    mix: '综合选择'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g5-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '小数、方程、因数倍数、分数、面积、立体图形、运动、可能性与统计',
    grades: [5],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g5-m12-g5-choice-decmul',
        'math-g5-m12-g5-choice-equ',
        'math-g5-m12-g5-choice-fm',
        'math-g5-m12-g5-choice-frac',
        'math-g5-m12-g5-choice-area',
        'math-g5-m12-g5-choice-solid',
        'math-g5-m12-motion',
        'math-g5-m12-g5-choice-possib',
        'math-g5-m12-stats'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合选择' },
          { value: 'dec', label: '小数乘除法' },
          { value: 'equation', label: '方程' },
          { value: 'factor-multiple', label: '因数与倍数' },
          { value: 'fraction', label: '分数的意义与性质' },
          { value: 'area', label: '多边形的面积' },
          { value: 'solid', label: '长方体正方体容积' },
          { value: 'rotation', label: '图形的运动' },
          { value: 'possibility', label: '可能性' },
          { value: 'stats', label: '统计' }
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
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'choice', q: p.q, answer: String(p.answer), options: p.options, hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学五年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);