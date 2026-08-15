/**
 * plugins/math-g4-mixed.js — 四年级脱式计算插件（M3 脱式）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M3 模块）：
 *   g4-mix-order   四则混合运算顺序    （type: 'order'）
 *   g4-mix-addlaw  加法运算律简便计算  （type: 'add-law'）
 *   g4-mix-mullaw  乘法运算律简便计算  （type: 'mul-law'）
 *   g4-mix-dist    乘法分配律简便计算  （type: 'dist-law'）
 *   g4-mix-dec     小数加减简便计算    （type: 'dec-simple'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-mixed.js 依赖 shared/common.js（PluginUtil），请先加载');

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

  // ============ 四则混合运算顺序 ============
  // 产生「两步或三步、含括号/不含括号」的脱式：answer 为最终结果，hint 提示运算顺序
  function buildOrder() {
    var v = pick(['np2', 'np3', 'br2', 'br3']);
    var a, b, c, d, expr, ans;
    if (v === 'np2') {
      // 无括号两步：乘除优先，再加减
      var hi = pick(['mul', 'div']);
      a = rnd(2, 9);
      b = rnd(2, 9);
      c = rnd(2, 30);
      var mid = a * b;
      if (hi === 'div') {
        // a × b ÷ c 形式（乘法优先，除法随后，保证整除）
        c = pick([2, 3, 4, 5, 6, 7, 8, 9]);
        while (mid % c !== 0) { c = rnd(2, 9); }
        expr = a + ' × ' + b + ' ÷ ' + c;
        ans = mid / c;
        return { q: expr, answer: ans, hint: '脱式计算：' + a + '×' + b + '=' + mid + '，再÷' + c + '=' + ans + '。' };
      }
      // 乘加/乘减
      if (pick([1, 2]) === 1) {
        expr = a + ' × ' + b + ' + ' + c;
        ans = mid + c;
      } else {
        expr = a + ' × ' + b + ' − ' + c;
        ans = mid - c;
      }
      return { q: expr, answer: ans, hint: '脱式计算：先算 ' + a + '×' + b + '=' + mid + '，再算加减。' };
    }
    if (v === 'np3') {
      // 无括号三步：乘除混在加减中
      a = rnd(2, 9); b = rnd(2, 9); d = rnd(2, 9);
      c = a * b * rnd(2, 5); // 构造被除数，保证整除
      expr = a + ' × ' + b + ' + ' + c + ' ÷ ' + d;
      ans = a * b + c / d;
      return { q: expr, answer: ans, hint: '脱式计算：先乘除后加减，' + a + '×' + b + '=' + (a * b) + '，' + c + '÷' + d + '=' + (c / d) + '。' };
    }
    if (v === 'br2') {
      // 带括号两步
      var p2 = pick(['add', 'sub']);
      a = rnd(2, 30); b = rnd(2, 30); c = rnd(2, 9);
      var inner = p2 === 'add' ? a + b : Math.max(a, b) - Math.min(a, b);
      if (inner === 0) inner = a + b;
      expr = '(' + (p2 === 'add' ? a + ' + ' + b : Math.max(a, b) + ' − ' + Math.min(a, b)) + ') × ' + c;
      ans = inner * c;
      return { q: expr, answer: ans, hint: '脱式计算：括号里先算，再算括号外的乘法。' };
    }
    // 带括号三步：(a + b − c) × d 或 (a × b + c) ÷ d，保证整除
    var p3 = pick(['addsub', 'muladd']);
    var a1 = rnd(2, 9), b1 = rnd(2, 9);
    if (p3 === 'addsub') {
      var c2 = rnd(1, a1 + b1 - 1);
      var innerA = a1 + b1 - c2;
      var d2 = rnd(2, 9);
      expr = '(' + a1 + ' + ' + b1 + ' − ' + c2 + ') × ' + d2;
      ans = innerA * d2;
      return { q: expr, answer: ans, hint: '脱式计算：先算括号内的加减，再算括号外的乘法。' };
    }
    var ab = a1 * b1;
    var d1 = rnd(2, 9);
    var c1 = (d1 - (ab % d1)) % d1; // 使 ab + c1 为 d1 的倍数
    if (c1 === 0) c1 = d1;
    var inner3 = ab + c1;
    var q3 = inner3 / d1;
    expr = '(' + a1 + ' × ' + b1 + ' + ' + c1 + ') ÷ ' + d1;
    ans = q3;
    return { q: expr, answer: ans, hint: '脱式计算：先算括号内的乘、加，再算括号外的除法。' };
  }

  // ============ 加法运算律简便计算 ============
  // 交换律/结合律凑整：a + b + c（其中两项相加为整十/整百）
  function buildAddLaw() {
    var kind = pick(['swap', 'group']);
    var a = rnd(11, 99), b = rnd(11, 99);
    var c;
    if (kind === 'swap') {
      // a + b + c，其中 a + c 凑整十/百
      var t = pick([10, 100]);
      var ac = t - (a % t); // 使 a+c 为 t 的倍数
      if (ac <= 0) ac = t;
      c = ac;
      // 但也要让 b 保证和不过大
      return { q: a + ' + ' + b + ' + ' + c, answer: a + b + c,
        hint: '简便计算：先算 ' + a + ' + ' + c + ' = ' + (a + c) + '（凑整），再加 ' + b + '。' };
    }
    // 结合律：先把后两项凑整
    var tb = pick([10, 100]);
    var bc = tb - (b % tb);
    if (bc <= 0) bc = tb;
    return { q: a + ' + ' + b + ' + ' + bc, answer: a + b + bc,
      hint: '简便计算：先算 ' + b + ' + ' + bc + ' = ' + (b + bc) + '（凑整），再加 ' + a + '。' };
  }

  // ============ 乘法运算律简便计算 ============
  // 交换/结合：25×4、125×8 等凑整
  function buildMulLaw() {
    var pair = pick(['25×4', '125×8', '25×8', '125×4', '50×2', '20×5']);
    var parts = pair.split('×').map(Number);
    var p1 = parts[0], p2 = parts[1];
    var rest = rnd(3, 9);
    // 打乱三因子的顺序展示
    var factors = shuffle([p1, p2, rest]);
    return { q: factors[0] + ' × ' + factors[1] + ' × ' + factors[2],
      answer: p1 * p2 * rest,
      hint: '简便计算：先算 ' + p1 + ' × ' + p2 + ' = ' + (p1 * p2) + '（凑整），再乘 ' + rest + '。' };
  }

  // ============ 乘法分配律简便计算 ============
  function buildDistLaw() {
    var v = pick(['a(b+c)', 'ab+ac', '99n', '101n']);
    if (v === 'a(b+c)') {
      var a = pick([8, 12, 15, 25, 125, 4, 5]);
      var b = rnd(2, 20), c = rnd(2, 20);
      return { q: a + ' × (' + b + ' + ' + c + ')', answer: a * (b + c),
        hint: '乘法分配律：' + a + '×' + b + ' + ' + a + '×' + c + ' = ' + (a * b) + ' + ' + (a * c) + '。' };
    }
    if (v === 'ab+ac') {
      var a2 = rnd(2, 9), b2 = rnd(11, 99), c2 = rnd(11, 99);
      return { q: a2 + ' × ' + b2 + ' + ' + a2 + ' × ' + c2, answer: a2 * (b2 + c2),
        hint: '提取公因数 ' + a2 + '：' + a2 + ' × (' + b2 + ' + ' + c2 + ') = ' + a2 + ' × ' + (b2 + c2) + '。' };
    }
    if (v === '99n') {
      var n = rnd(2, 9);
      return { q: '99 × ' + n, answer: 99 * n,
        hint: '99 = 100 − 1，' + n + ' × 100 − ' + n + ' = ' + (n * 100) + ' − ' + n + '。' };
    }
    var n4 = rnd(2, 9);
    return { q: '101 × ' + n4, answer: 101 * n4,
      hint: '101 = 100 + 1，' + n4 + ' × 100 + ' + n4 + ' = ' + (n4 * 100) + ' + ' + n4 + '。' };
  }

  // ============ 小数加减简便计算（一位/两位小数凑整） ============
  function buildDecSimple() {
    var v = pick(['a+b+c', 'a+b−c']);
    // 选一对和为整数的数
    var dp = pick([1, 1, 2]);
    var sc = pick([1, 10]);
    var x = rnd(1, 20) / (dp === 1 ? 10 : 100);
    var y = sc - x; // x + y = 整数
    if (y <= 0) { y = sc + x; }
    var z = rnd(10, 99) / (dp === 1 ? 10 : 100);
    if (v === 'a+b+c') {
      return { q: x.toFixed(dp) + ' + ' + z.toFixed(dp) + ' + ' + y.toFixed(dp),
        answer: (x + z + y).toFixed(dp),
        hint: '简便计算：先算 ' + x.toFixed(dp) + ' + ' + y.toFixed(dp) + ' = ' + (x + y).toFixed(dp) + '，再加 ' + z.toFixed(dp) + '。' };
    }
    // a + b − c，让 b − c 或 a+b 凑整，保证结果非负
    var sum = x + y; // 整数
    var c2 = rnd(1, sum - 1) / (dp === 1 ? 10 : 100);
    if (sum - c2 < 0) c2 = 0.1;
    return { q: x.toFixed(dp) + ' + ' + y.toFixed(dp) + ' − ' + c2.toFixed(dp),
      answer: (x + y - c2).toFixed(dp),
      hint: '简便计算：先算 ' + x.toFixed(dp) + ' + ' + y.toFixed(dp) + ' = ' + sum.toFixed(dp) + '，再减 ' + c2.toFixed(dp) + '。' };
  }

  // ============ 综合脱式（按知识点权重混合） ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 25) return buildOrder();
    if (r <= 45) return buildAddLaw();
    if (r <= 65) return buildMulLaw();
    if (r <= 85) return buildDistLaw();
    return buildDecSimple();
  }

  var TYPE_BUILDERS = {
    'order': buildOrder,
    'add-law': buildAddLaw,
    'mul-law': buildMulLaw,
    'dist-law': buildDistLaw,
    'dec-simple': buildDecSimple,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'order': '四则混合运算',
    'add-law': '加法简便计算',
    'mul-law': '乘法简便计算',
    'dist-law': '乘法分配律',
    'dec-simple': '小数简便计算',
    mix: '综合脱式'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-mixed',
    moduleId: 'M3',
    name: '脱式计算',
    pageTitle: '四年级脱式计算',
    pageSubtitle: '四则混合运算顺序与简便计算',
    grades: [4],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },
    knowledgePoints: ['g4-mix-order', 'g4-mix-addlaw', 'g4-mix-mullaw', 'g4-mix-dist', 'g4-mix-dec'],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',        label: '综合脱式' },
          { value: 'order',      label: '四则混合运算' },
          { value: 'add-law',    label: '加法简便计算' },
          { value: 'mul-law',    label: '乘法简便计算' },
          { value: 'dist-law',   label: '乘法分配律' },
          { value: 'dec-simple', label: '小数简便计算' }
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
        if (!seen[p.q]) { seen[p.q] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        return { type: 'mixed', q: p.q + ' =', answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级脱式计算（' + (TYPE_NAMES[type] || '综合脱式') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);