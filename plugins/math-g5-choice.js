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
        e = _PU.rand([1, 2, 3, 4, 5]) + '/' + _PU.rand([2, 3, 4, 5, 6, 8]);
      } else if (genKind === 'text') {
        e = '其他';
      } else {
        e = String(_PU.randInt(2, 99));
      }
      if (e !== ans && pool.indexOf(e) === -1) pool.push(e);
      guard++;
    }
    var rest = _PU.shuffle(pool.slice(1));
    var out = [ans];
    for (var i = 0; i < n - 1; i++) out.push(rest[i % rest.length]);
    return _PU.shuffle(out);
  }

  // ============ 小数乘除法 ============
  function buildDec() {
    var v = _PU.rand(['mul', 'div', 'cmp']);
    if (v === 'mul') {
      var a = _PU.randInt(2, 9) / 10, b = _PU.randInt(2, 9) / 10;
      var ans = a * b;
      var cands = [trimD(ans), trimD(ans + 1), trimD(ans * 10), trimD(ans / 10), trimD(ans + 0.5)];
      return { q: trimD(a) + ' × ' + trimD(b) + ' =（  ）', answer: trimD(ans), options: mkOptions(trimD(ans), cands, 4, 'num'), hint: '小数乘法：0.' + String(ans).replace('.', '') + ' 先按整数乘再点小数点。' };
    }
    if (v === 'div') {
      var d = _PU.randInt(2, 9) / 10;
      var q = _PU.randInt(2, 9);
      var dividend = d * q;
      var cands2 = [String(q), String(q + 1), String(q - 1), String(q * 10), String(q / 10)];
      return { q: trimD(dividend) + ' ÷ ' + trimD(d) + ' =（  ）', answer: String(q), options: mkOptions(String(q), cands2, 4, 'num'), hint: trimD(dividend) + ' ÷ ' + trimD(d) + ' = ' + q + '（除数化成整数再算）。' };
    }
    var n = _PU.randInt(3, 9);
    var ans3 = n * 0.1;
    var cands3 = [trimD(ans3), String(n), trimD(n / 10) + '0', trimD(n * 10), trimD(n + 0.1)];
    return { q: n + ' × 0.1 =（  ）', answer: trimD(ans3), options: mkOptions(trimD(ans3), cands3, 4, 'num'), hint: '乘 0.1 相当于除以 10。' };
  }

  // ============ 方程 ============
  function buildEquation() {
    var v = _PU.rand(['which', 'solve', 'prop']);
    if (v === 'which') {
      var x = _PU.randInt(2, 9), b = _PU.randInt(2, 9);
      var eqAns = 'x + ' + b + ' = ' + (x + b);
      var cands = [eqAns, x + ' + ' + b, 'x + ' + b + ' > ' + (x + b + 1), b + ' = ' + b];
      return { q: '下面（  ）是方程', answer: eqAns, options: mkOptions(eqAns, cands, 4, 'text'), hint: '方程必须含未知数且是等式。' };
    }
    if (v === 'solve') {
      var x2 = _PU.randInt(2, 9), b2 = _PU.randInt(2, 9);
      var sum = x2 + b2;
      var cands2 = [String(x2), String(b2), String(sum), String(sum + 1)];
      return { q: 'x + ' + b2 + ' = ' + sum + '，x =（  ）', answer: String(x2), options: mkOptions(String(x2), cands2, 4, 'num'), hint: 'x = ' + sum + ' − ' + b2 + ' = ' + x2 + '。' };
    }
    var a = _PU.randInt(2, 9), k = _PU.randInt(3, 12);
    var cands3 = [String(a), String(k), String(a * k), String(Math.round(k / a))];
    return { q: '方程 ' + k + 'x = ' + (k * a) + ' 的解是 x =（  ）', answer: String(a), options: mkOptions(String(a), cands3, 4, 'num'), hint: 'x = ' + (k * a) + ' ÷ ' + k + ' = ' + a + '。' };
  }

  // ============ 因数与倍数 ============
  function buildFactorMultiple() {
    var v = _PU.rand(['prime', 'lcm', 'div']);
    if (v === 'prime') {
      var p = _PU.rand([2, 3, 5, 7, 11, 13, 17, 19]);
      var cands = [String(p), String(p + 1), String(p * 2), String(p * p)];
      return { q: '下面（  ）是质数', answer: String(p), options: mkOptions(String(p), cands, 4, 'num'), hint: '质数只有 1 和它本身两个因数。' };
    }
    if (v === 'lcm') {
      var m = _PU.rand([4, 6, 8, 9, 10, 12]);
      var n2 = _PU.rand([2, 3, 4]);
      var lcm = m * n2 / gcd(m, n2);
      var cands2 = [String(lcm), String(m * n2), String(m + n2), String(Math.max(m, n2))];
      return { q: m + ' 和 ' + n2 + ' 的最小公倍数是（  ）', answer: String(lcm), options: mkOptions(String(lcm), cands2, 4, 'num'), hint: '用短除法求最小公倍数。' };
    }
    var base = _PU.randInt(11, 49), k2 = _PU.randInt(2, 9);
    var val = base * k2;
    var cands3 = [String(k2), String(val), String(base), String(val + 1)];
    return { q: '一个数的最大因数是 ' + base + '，它是 ' + k2 + ' 的倍数，这个数是（  ）', answer: String(val), options: mkOptions(String(val), cands3, 4, 'num'), hint: '最大因数是它本身：' + base + '，再找它的倍数。' };
  }
  function gcd(a, b) { return b ? gcd(b, a % b) : a; }

  // ============ 分数的意义与性质 ============
  function buildFraction() {
    var v = _PU.rand(['unit', 'eq', 'dec']);
    if (v === 'unit') {
      var d = _PU.rand([3, 4, 5, 6, 8]);
      var n = _PU.randInt(1, d - 1);
      var ans = '1/' + d;
      var cands = [ans, String(n), '1', n + '/' + d];
      return { q: n + '/' + d + ' 的分数单位是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'frac'), hint: '分数单位是 1/分母。' };
    }
    if (v === 'eq') {
      var n2 = _PU.randInt(1, 3), d2 = _PU.rand([4, 6, 8, 10]);
      var ans2 = n2 + '/' + d2;
      var cands2 = [ans2, (n2 * 2) + '/' + d2, (n2 + 1) + '/' + d2, n2 + '/' + (d2 * 2 + 1)];
      return { q: '与 ' + n2 + '/' + d2 + ' 相等的是（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'frac'), hint: '约分或通分后相等的分数。' };
    }
    var f = _PU.rand([0.5, 0.25, 0.75, 0.2, 0.4, 0.6]);
    var fS = f === 0.5 ? '1/2' : f === 0.25 ? '1/4' : f === 0.75 ? '3/4' : f === 0.2 ? '1/5' : f === 0.4 ? '2/5' : '3/5';
    var cands3 = ['1/2', '1/4', '3/4', '1/5', '2/5', '3/5'].filter(function (x) { return x !== fS; }).slice(0, 3);
    return { q: f + ' =（  ）', answer: fS, options: mkOptions(fS, cands3, 4, 'frac'), hint: f + ' 化成分数并约分。' };
  }

  // ============ 多边形的面积 ============
  function buildArea() {
    var v = _PU.rand(['tri', 'trap', 'formula']);
    if (v === 'tri') {
      var b = _PU.randInt(4, 10), h = _PU.randInt(3, 8);
      var ans = b * h / 2;
      var cands = [String(ans), String(b * h), String(b * h / 4), String((b + h) / 2)];
      return { q: '底 ' + b + '、高 ' + h + ' 的三角形面积 =（  ）', answer: String(ans), options: mkOptions(String(ans), cands, 4, 'num'), hint: '三角形面积 = 底 × 高 ÷ 2。' };
    }
    if (v === 'trap') {
      var up = _PU.randInt(3, 6), down = _PU.randInt(7, 10), h3 = _PU.randInt(3, 7);
      var ans3 = (up + down) * h3 / 2;
      var cands2 = [String(ans3), String(up * down), String((up + down) * h3), String((up + down) * h3 / 4)];
      return { q: '上底 ' + up + '、下底 ' + down + '、高 ' + h3 + ' 的梯形面积 =（  ）', answer: String(ans3), options: mkOptions(String(ans3), cands2, 4, 'num'), hint: '梯形面积 =（上底+下底）×高÷2。' };
    }
    var s = _PU.randInt(3, 8);
    var cands3 = [String(s * s), String(s * 4), String(s + s), String(s * s * 2)];
    return { q: '边长 ' + s + ' 的正方形面积 =（  ）', answer: String(s * s), options: mkOptions(String(s * s), cands3, 4, 'num'), hint: '正方形面积 = 边长 × 边长。' };
  }

  // ============ 长方体正方体容积 ============
  function buildSolid() {
    var v = _PU.rand(['vol', 'unit', 'surface']);
    if (v === 'vol') {
      var a = _PU.randInt(2, 9), b = _PU.randInt(2, 9), c = _PU.randInt(2, 9);
      var ans = a * b * c;
      var cands = [String(ans), String(a + b + c), String(2 * (a * b + b * c + a * c)), String(a * b * c + 1)];
      return { q: '长 ' + a + '、宽 ' + b + '、高 ' + c + ' 的长方体体积 =（  ）', answer: String(ans), options: mkOptions(String(ans), cands, 4, 'num'), hint: '体积 = 长 × 宽 × 高。' };
    }
    if (v === 'unit') {
      var ansU = _PU.rand(['1000 毫升', '1 升']);
      var qText = ansU === '1000 毫升' ? '1 升 =（  ）' : '1000 毫升 =（  ）';
      var cands2 = _PU.shuffle([ansU, '1 升', '100 毫升', '10 毫升']);
      return { q: qText, answer: ansU, options: mkOptions(ansU, cands2, 4, 'text'), hint: '1 升 = 1000 毫升。' };
    }
    var s = _PU.randInt(2, 4);
    var surf = 6 * s * s;
    var cands3 = [String(surf), String(s * s), String(s * s * s), String(12 * s)];
    return { q: '棱长 ' + s + ' 的正方体表面积 =（  ）', answer: String(surf), options: mkOptions(String(surf), cands3, 4, 'num'), hint: '正方体表面积 = 6 × 棱长 × 棱长。' };
  }

  // ============ 图形的运动 ============
  function buildRotation() {
    var v = _PU.rand(['sym', 'rot', 'order']);
    if (v === 'sym') {
      var symOpts = ['长方形', '正方形', '圆形', '等腰梯形', '等腰三角形'];
      var ans = _PU.rand(symOpts);
      var others = _PU.shuffle(symOpts.filter(function (o) { return o !== ans; })).slice(0, 3);
      var cands = _PU.shuffle([ans].concat(others));
      return { q: '下面（  ）是轴对称图形', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: ans + '沿对称轴对折能完全重合。' };
    }
    if (v === 'rot') {
      var rotSet = [['直角', '平角', 90], ['锐角', '直角', 60], ['平角', '周角', 180], ['直角', '周角', 270], ['锐角', '平角', 150]];
      var rp = _PU.rand(rotSet);
      var ans2 = rp[2] + '°';
      var cands2 = _PU.shuffle([ans2, (rp[2] / 2) + '°', (rp[2] * 2) + '°', (rp[2] + 30) + '°']);
      return { q: rp[0] + '旋转成' + rp[1] + '，旋转了（  ）', answer: ans2, options: mkOptions(ans2, cands2, 4, 'text'), hint: rp[0] + '到' + rp[1] + '相差 ' + ans2 + '。' };
    }
    var orderSet = [['正方形', '4 条'], ['长方形', '2 条'], ['等边三角形', '3 条'], ['圆', '无数条'], ['等腰梯形', '1 条']];
    var op = _PU.rand(orderSet);
    var ans3 = op[1];
    var cands3 = _PU.shuffle([ans3, '1 条', '2 条', '3 条', '无数条'].filter(function (x) { return x !== ans3; }).slice(0, 3));
    return { q: op[0] + '有（  ）条对称轴', answer: ans3, options: mkOptions(ans3, cands3, 4, 'text'), hint: op[0] + '沿对称轴对折能重合 ' + ans3 + '。' };
  }

  // ============ 可能性 ============
  function buildPossibility() {
    var v = _PU.rand(['frac', 'bigger']);
    if (v === 'frac') {
      var red = _PU.randInt(2, 8), white = _PU.randInt(2, 8);
      var total = red + white;
      var ans = red + '/' + total;
      var cands = [ans, white + '/' + total, '1/2', '1'];
      return { q: '袋里有 ' + red + ' 个红球、' + white + ' 个白球，摸到红球的可能性是（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'frac'), hint: '红球数 ÷ 总数。' };
    }
    var r1 = _PU.randInt(1, 9), t1 = r1 + _PU.randInt(1, 9);
    var r2 = _PU.randInt(1, 4), t2 = r2 + _PU.randInt(1, 4);
    var p1 = r1 / t1, p2 = r2 / t2;
    var ans = p1 === p2 ? '一样大' : p1 > p2 ? '袋子一' : '袋子二';
    var cands2 = ['袋子一', '袋子二', '一样大'];
    return { q: '袋子一红球 ' + r1 + '/' + t1 + '，袋子二红球 ' + r2 + '/' + t2 + '，摸到红球可能性大的是（  ）', answer: ans, options: mkOptions(ans, cands2, 3, 'text'), hint: '比较分数大小：' + r1 + '/' + t1 + ' 和 ' + r2 + '/' + t2 + '。' };
  }

  // ============ 统计 ============
  function buildStats() {
    var v = _PU.rand(['chart', 'trend']);
    if (v === 'chart') {
      var chartSet = [['数量增减变化情况', '折线统计图'], ['各部分与总数的关系', '扇形统计图'], ['数量的多少', '条形统计图']];
      var cp = _PU.rand(chartSet);
      var ans = cp[1];
      var cands = _PU.shuffle([ans, '折线统计图', '条形统计图', '扇形统计图', '统计表'].filter(function (x) { return x !== ans; }).slice(0, 3));
      return { q: '表示' + cp[0] + '，应选（  ）', answer: ans, options: mkOptions(ans, cands, 4, 'text'), hint: ans + '适合表示' + cp[0] + '。' };
    }
    var vals = [];
    for (var i = 0; i < 5; i++) vals.push(_PU.randInt(20, 80));
    var cands2 = ['上升', '下降', '不变', '无法判断'];
    var ans = vals[4] > vals[0] ? '上升' : vals[4] < vals[0] ? '下降' : '不变';
    return { q: '数据 ' + vals.join('、') + ' 的整体趋势是（  ）', answer: ans, options: mkOptions(ans, cands2, 4, 'text'), hint: '比较第一个和最后一个数。' };
  }

  // ============ 综合选择 ============
  function buildMixed() {
    var r = _PU.randInt(1, 100);
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