/**
 * plugins/math-g4-word.js — 四年级解决问题插件（M8 解决问题）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M8 模块）：
 *   g4-m8-g4-word-big      大数应用          （type: 'big-app'）
 *   g4-m8-g4-word-speed    乘法问题（行程）   （type: 'mul-travel'）
 *   g4-m8-g4-word-div      除法问题（分配）   （type: 'div-share'）
 *   g4-m8-g4-word-price    单价、数量、总价   （type: 'price-qty'）
 *   g4-m8-g4-word-area     面积问题（公顷）   （type: 'area-hectare'）
 *   g4-m8-g4-word-opt      优化问题          （type: 'optimize'）
 *   g4-m8-g4-word-cr       鸡兔同笼          （type: 'chicken-rabbit'）
 *   g4-m8-g4-word-dec      小数加减问题      （type: 'dec-pay'）
 *   g4-m8-g4-word-avg      平均数问题        （type: 'avg-score'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-word.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function pick(arr) { return arr[rnd(0, arr.length - 1)]; }

  // ============ 大数应用 ============
  function buildBigApp() {
    var v = pick(['read-pop', 'compare']);
    if (v === 'read-pop') {
      // 大数读法应用：城市人口
      var pop = rnd(3000000, 99999999);
      var q = '某市去年人口约 ' + pop + ' 人，这个数读作（  ）';
      // 答案用中文读法太复杂，改为问省略到万位的近似
      var approx = Math.round(pop / 10000);
      var q2 = '某市去年人口约 ' + pop + ' 人，省略万位后面的尾数约是（  ）万';
      return { q: q2, answer: approx + '万',
        hint: '看千位上的数四舍五入到万位，再写「万」。' };
    }
    // 比较两个大数
    var n1 = rnd(100000, 99999999), n2 = rnd(100000, 99999999);
    while (n1 === n2) n2 = rnd(100000, 99999999);
    var bigger = Math.max(n1, n2);
    return { q: '比较大小：' + n1 + ' ○ ' + n2 + '（填 >、< 或 =）', answer: n1 > n2 ? '>' : '<',
      hint: '数位多的数大；数位相同，从高位比起。' };
  }

  // ============ 乘法问题（速度×时间=路程） ============
  function buildMulTravel() {
    var v = pick(['car', 'train', 'plane', 'walk']);
    var sp, tm, unit;
    if (v === 'car') { sp = pick([50, 60, 70, 80, 90]); tm = pick([2, 3, 4, 5, 6]); unit = '千米'; }
    else if (v === 'train') { sp = pick([120, 140, 160, 180, 200]); tm = pick([2, 3, 4, 5]); unit = '千米'; }
    else if (v === 'plane') { sp = pick([600, 700, 800, 900]); tm = pick([2, 3, 4]); unit = '千米'; }
    else { sp = pick([60, 70, 80, 90, 100]); tm = pick([2, 3, 4, 5]); unit = '米'; }
    var dist = sp * tm;
    var vehicle = v === 'car' ? '汽车' : v === 'train' ? '火车' : v === 'plane' ? '飞机' : '人步行';
    var who = v === 'walk' ? '每小时走 ' + sp + ' 米' : '每小时行 ' + sp + ' 千米';
    return { q: '一辆' + vehicle + ' ' + who + '，' + tm + ' 小时可行（  ）' + unit,
      answer: dist, hint: '路程 = 速度 × 时间 = ' + sp + ' × ' + tm + '。' };
  }

  // ============ 除法问题（总量÷份数=每份数） ============
  function buildDivShare() {
    var v = pick(['per', 'boxes', 'classes']);
    var tot = rnd(40, 200);
    var share = pick([2, 4, 5, 8, 10]);
    while (tot % share !== 0) tot++;
    var each = tot / share;
    var thing = v === 'boxes' ? '箱' : v === 'classes' ? '个班' : '份';
    var q = '把 ' + tot + ' 个苹果平均分给 ' + share + ' 个小朋友，每人分得（  ）个';
    return { q: q, answer: each, hint: '每份数 = 总数 ÷ 份数 = ' + tot + ' ÷ ' + share + '。' };
  }

  // ============ 单价、数量、总价问题 ============
  function buildPriceQty() {
    var v = pick(['total', 'unit', 'qty']);
    var price = pick([2, 3, 5, 8, 10, 12, 15, 20, 25]);
    var qty = rnd(3, 9);
    var total = price * qty;
    if (v === 'total') {
      return { q: '每支钢笔 ' + price + ' 元，买 ' + qty + ' 支，一共（  ）元',
        answer: total, hint: '总价 = 单价 × 数量。' };
    }
    if (v === 'unit') {
      var total2 = price * qty;
      return { q: qty + ' 个笔记本共 ' + total2 + ' 元，每个笔记本（  ）元',
        answer: price, hint: '单价 = 总价 ÷ 数量。' };
    }
    var total3 = price * qty;
    return { q: '用 ' + total3 + ' 元买单价 ' + price + ' 元的书，可以买（  ）本',
      answer: qty, hint: '数量 = 总价 ÷ 单价。' };
  }

  // ============ 面积问题（公顷/平方千米） ============
  function buildAreaHectare() {
    var v = pick(['rect', 'square', 'convert']);
    if (v === 'rect') {
      var L = rnd(100, 500), W = rnd(50, 200);
      // 让面积是整公顷
      var areaM = L * W;
      var areaH = areaM / 10000;
      if (areaH < 1) { L = rnd(200, 500); W = rnd(100, 200); areaM = L * W; areaH = areaM / 10000; }
      var areaHs = (Math.round(areaH * 10) / 10).toFixed(areaH % 1 === 0 ? 0 : 1);
      return { q: '一块长方形地长 ' + L + ' 米、宽 ' + W + ' 米，面积是（  ）平方米，合（  ）公顷',
        answer: [areaM, areaHs],
        hint: '面积 = 长 × 宽 = ' + L + ' × ' + W + ' 平方米；10000 平方米 = 1 公顷。' };
    }
    if (v === 'square') {
      var side = pick([100, 200, 300, 400, 500]);
      var areaS = side * side;
      var ha = areaS / 10000;
      return { q: '一块正方形地边长 ' + side + ' 米，面积是（  ）平方米，合（  ）公顷',
        answer: [areaS, ha],
        hint: '面积 = 边长 × 边长；10000 平方米 = 1 公顷。' };
    }
    var a = rnd(1, 99);
    return { q: a + ' 公顷 =（  ）平方千米（填小数）', answer: (a / 100).toFixed(2),
      hint: '100 公顷 = 1 平方千米。' };
  }

  // ============ 优化问题 ============
  function buildOptimize() {
    var v = pick(['tea', 'pancake']);
    if (v === 'tea') {
      // 沏茶问题：有几件事可同时做
      var wash = rnd(1, 2); // 洗水壶
      var boil = rnd(5, 8); // 烧水
      var prepare = rnd(2, 4); // 准备茶杯茶叶
      // 烧水时准备茶杯茶叶 → 总时间 = 洗水壶 + 烧水
      var total = wash + boil;
      var q = '沏茶需要：洗水壶 ' + wash + ' 分钟、烧水 ' + boil + ' 分钟、准备茶杯茶叶 ' + prepare + ' 分钟。至少需要（  ）分钟';
      return { q: q, answer: total,
        hint: '烧水的同时可以准备茶杯茶叶，所以总时间 = 洗水壶 + 烧水 = ' + wash + ' + ' + boil + '。' };
    }
    // 烙饼问题：每次最多烙 2 张，每张两面各 a 分钟
    var min = pick([2, 3]);
    var n = pick([3, 4, 5, 6]);
    var totalT = n * min; // 烙 n 张饼，每张两面，平底锅每次 2 张：总时间 = n × 每面时间
    var q = '一个平底锅每次最多能烙 2 张饼，两面都要烙，每面需要 ' + min + ' 分钟。烙 ' + n + ' 张饼至少需要（  ）分钟';
    return { q: q, answer: totalT, hint: '总时间 = 饼数 × 每面时间 = ' + n + ' × ' + min + '（锅够大时）。' };
  }

  // ============ 鸡兔同笼 ============
  function buildChickenRabbit() {
    var head = pick([10, 12, 15, 16, 18, 20]);
    var rabbit = rnd(2, head - 2);
    var chicken = head - rabbit;
    var legs = rabbit * 4 + chicken * 2;
    var q = '鸡兔同笼，共有 ' + head + ' 个头、' + legs + ' 只脚。兔有（  ）只，鸡有（  ）只';
    return { q: q, answer: [rabbit, chicken],
      hint: '假设全是鸡：脚数 = ' + head + '×2 = ' + (head * 2) + '，多出 ' + (legs - head * 2) + ' 只脚，每把一只鸡换成兔多 2 只脚。' };
  }

  // ============ 小数加减问题 ============
  function buildDecPay() {
    var v = pick(['buy', 'change', 'diff']);
    var a = rnd(10, 99) / 10, b = rnd(10, 99) / 10;
    var aS = a.toFixed(1), bS = b.toFixed(1);
    if (v === 'buy') {
      var sum = (a + b).toFixed(1);
      return { q: '买一支钢笔花 ' + aS + ' 元，买一本书花 ' + bS + ' 元，一共花（  ）元',
        answer: sum, hint: aS + ' + ' + bS + ' = ？（小数点对齐）' };
    }
    if (v === 'change') {
      var pay = Math.ceil(a / 10) * 10;
      var change = (pay - a).toFixed(1);
      return { q: '一支笔 ' + aS + ' 元，付 ' + pay + ' 元，应找回（  ）元',
        answer: change, hint: pay + ' − ' + aS + ' = ？（小数点对齐）' };
    }
    var mx = Math.max(a, b), mn = Math.min(a, b);
    var diff = (mx - mn).toFixed(1);
    return { q: mx.toFixed(1) + ' 元比 ' + mn.toFixed(1) + ' 元多（  ）元',
      answer: diff, hint: mx.toFixed(1) + ' − ' + mn.toFixed(1) + ' = ？' };
  }

  // ============ 平均数问题 ============
  function buildAvgScore() {
    var v = pick(['avg', 'sum', 'weighted']);
    if (v === 'avg') {
      var a = rnd(70, 95), b = rnd(70, 95), c = rnd(70, 95);
      var avg = Math.round((a + b + c) / 3);
      return { q: '小明三次数学测验分别是 ' + a + ' 分、' + b + ' 分、' + c + ' 分，平均分是（  ）分',
        answer: avg, hint: '平均数 = 总分 ÷ 次数 = (' + a + '+' + b + '+' + c + ')÷3。' };
    }
    if (v === 'sum') {
      var avg2 = pick([75, 80, 85, 90]);
      var n2 = pick([3, 4, 5]);
      var tot2 = avg2 * n2;
      return { q: n2 + ' 次成绩的平均数是 ' + avg2 + ' 分，这 ' + n2 + ' 次的总分是（  ）分',
        answer: tot2, hint: '总分 = 平均数 × 次数。' };
    }
    // 移多补少：两个数平均
    var a3 = rnd(20, 60), b3 = rnd(20, 60);
    var avg3 = Math.round((a3 + b3) / 2);
    return { q: '甲数 ' + a3 + '、乙数 ' + b3 + '，它们的平均数是（  ）', answer: avg3,
      hint: '平均数 = (' + a3 + ' + ' + b3 + ') ÷ 2。' };
  }

  // ============ 综合解决问题 ============
  function buildMixed() {
    var r = rnd(1, 100);
    if (r <= 10) return buildBigApp();
    if (r <= 23) return buildMulTravel();
    if (r <= 35) return buildDivShare();
    if (r <= 48) return buildPriceQty();
    if (r <= 60) return buildAreaHectare();
    if (r <= 70) return buildOptimize();
    if (r <= 82) return buildChickenRabbit();
    if (r <= 94) return buildDecPay();
    return buildAvgScore();
  }

  var TYPE_BUILDERS = {
    'big-app': buildBigApp,
    'mul-travel': buildMulTravel,
    'div-share': buildDivShare,
    'price-qty': buildPriceQty,
    'area-hectare': buildAreaHectare,
    'optimize': buildOptimize,
    'chicken-rabbit': buildChickenRabbit,
    'dec-pay': buildDecPay,
    'avg-score': buildAvgScore,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'big-app': '大数应用',
    'mul-travel': '乘法行程问题',
    'div-share': '除法分配问题',
    'price-qty': '单价数量总价',
    'area-hectare': '面积公顷问题',
    'optimize': '优化问题',
    'chicken-rabbit': '鸡兔同笼',
    'dec-pay': '小数加减问题',
    'avg-score': '平均数问题',
    mix: '综合解决问题'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-word',
    moduleId: 'M8',
    name: '解决问题',
    pageSubtitle: '乘除应用、单价面积、优化、鸡兔同笼、小数与平均数',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'g4-m8-g4-word-big',
        'g4-m8-g4-word-speed',
        'g4-m8-g4-word-div',
        'g4-m8-g4-word-price',
        'g4-m8-g4-word-area',
        'g4-m8-g4-word-opt',
        'g4-m8-g4-word-cr',
        'g4-m8-g4-word-dec',
        'g4-m8-g4-word-avg'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',            label: '综合解决问题' },
          { value: 'big-app',        label: '大数应用' },
          { value: 'mul-travel',     label: '乘法行程问题' },
          { value: 'div-share',      label: '除法分配问题' },
          { value: 'price-qty',      label: '单价数量总价' },
          { value: 'area-hectare',   label: '面积公顷问题' },
          { value: 'optimize',       label: '优化问题' },
          { value: 'chicken-rabbit', label: '鸡兔同笼' },
          { value: 'dec-pay',        label: '小数加减问题' },
          { value: 'avg-score',      label: '平均数问题' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var builder = TYPE_BUILDERS[type] || buildMixed;
      var seen = {}, list = [], attempts = 0, maxA = Math.max(count * 50, 300);
      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = p.q + '|' + p.answer;
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }
      return list.map(function (p) {
        // 多空答案（如“面积是（ ）平方米，合（ ）公顷”）→ multi 双输入框，分字段作答
        if (Array.isArray(p.answer)) {
          return { type: 'word', q: p.q, answer: p.answer, hint: p.hint,
            inputType: 'multi', inputCount: p.answer.length };
        }
        return { type: 'word', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级解决问题（' + (TYPE_NAMES[type] || '综合') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);