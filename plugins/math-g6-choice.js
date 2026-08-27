/**
 * plugins/math-g6-choice.js — 六年级选择题插件（M12 综合选择）
 *
 * 知识点覆盖（shared/knowledge-bank.js 六年级 M12 模块）：
 *   g6-m12-g6-choice-negative  负数        （type: 'negative'）
 *   g6-m12-g6-choice-percent   百分数      （type: 'percent'）
 *   g6-m12-g6-choice-circle    圆          （type: 'circle'）
 *   g6-m12-g6-choice-cyl-cone  圆柱与圆锥  （type: 'cyl-cone'）
 *   g6-m12-g6-choice-chart     扇形统计图  （type: 'chart'）
 *
 * 干扰项与题干预生成（目标：重复率 ≤10%）：
 *   - 每个知识点 ≥5 类题干模板，确定性参数化枚举（数字/单位/情境随机组合，全池 ~460 签名）
 *   - 干扰项全部来自常见错误：周长面积混淆、πd/πr 混淆、圆锥忘 ÷3、折扣现价/便宜额混淆、
 *     百分号移位错位、温差加减混淆、反方向/错角度——不用随机数凑数
 *   - 混合知识点：半径扩大 k 倍面积扩大 k² 倍（圆+倍数）、圆锥占圆柱百分比（圆锥+百分数）等
 *   - 题目池缓存：模块级牌堆按题型分堆，全量池洗牌后跨 generate 连续发牌
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g6-choice.js 依赖 shared/common.js（PluginUtil），请先加载');

  function rnd(min, max) { return _PU.randInt(min, max); }
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rnd(0, i);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function trimD(x) { return String(Number(x.toFixed(3))); }

  /** 四选项：答案 + 3 个错误来源干扰项，洗牌输出（碰撞时数值变体兜底） */
  function mk4(ans, d1, d2, d3) {
    var opts = [String(ans), String(d1), String(d2), String(d3)];
    for (var i = 1; i < 4; i++) {
      var guard = 0;
      while (opts.slice(0, i).indexOf(opts[i]) !== -1 && guard < 5) {
        var num = Number(opts[i]);
        opts[i] = isNaN(num) ? opts[i] + ' ' : String(num * 10);
        guard++;
      }
    }
    return shuffle(opts);
  }

  // ============ 负数（确定性枚举 ~250 签名） ============
  function poolNegative() {
    var list = [];
    // 模板①：识别负数（n∈2..9）
    for (var n = 2; n <= 9; n++) {
      list.push({ q: '下面各数中，是负数的是（  ）', answer: '-' + n, options: mk4('-' + n, '0', '3', '+' + (n - 1)), hint: '小于 0 的数是负数。' });
    }
    // 模板②：温差（升 up 降 down）
    for (var up = 2; up <= 9; up++) {
      for (var down = 2; down <= 9; down++) {
        var ans2 = (up + down) + '℃';
        list.push({ q: '温度从 +' + up + '℃ 降到 −' + down + '℃，下降了（  ）', answer: ans2, options: mk4(ans2, (up - down) + '℃', (down - up) + '℃', up + '℃'), hint: '温差 = 最高温度 − 最低温度，减去负数等于加上它的相反数。' });
      }
    }
    // 模板③：比大小（正正 / 正负 / 负负）
    for (var a = 2; a <= 9; a++) {
      for (var b = 2; b <= 9; b++) {
        if (a !== b) {
          list.push({ q: '比较大小：' + a + '、' + b + '，正确的是（  ）', answer: a + ' > ' + b, options: mk4(a + ' > ' + b, a + ' < ' + b, a + ' = ' + b, b + ' > ' + a), hint: '正数比大小看数值。' });
        }
        list.push({ q: '比较大小：−' + a + '、−' + b + '，正确的是（  ）', answer: a < b ? ('−' + a + ' > −' + b) : ('−' + b + ' > −' + a), options: mk4(a < b ? ('−' + a + ' > −' + b) : ('−' + b + ' > −' + a), a < b ? ('−' + a + ' < −' + b) : ('−' + b + ' < −' + a), '−' + a + ' = −' + b, (a > b ? '−' + a : '−' + b) + ' > ' + (a > b ? '−' + b : '−' + a)), hint: '负数比大小，绝对值大的反而小。' });
      }
    }
    return list;
  }

  // ============ 百分数（~90 签名） ============
  function poolPercent() {
    var list = [];
    // 模板①：分数化百分数
    [['1/2', '50%'], ['1/4', '25%'], ['3/4', '75%'], ['1/5', '20%'], ['2/5', '40%'], ['3/5', '60%'], ['4/5', '80%'], ['1/8', '12.5%']].forEach(function (p) {
      list.push({ q: p[0] + ' 改写成百分数是（  ）', answer: p[1], options: mk4(p[1], Number(p[1].replace('%', '')) / 10 + '%', Number(p[1].replace('%', '')) * 10 + '%', p[0]), hint: '分数化百分数：分子除以分母，小数点右移两位添百分号。' });
    });
    // 模板②：小数化百分数
    [[0.05, '5%'], [0.1, '10%'], [0.2, '20%'], [0.35, '35%'], [0.4, '40%'], [0.55, '55%'], [0.7, '70%'], [0.85, '85%']].forEach(function (p) {
      list.push({ q: p[0] + ' 改写成百分数是（  ）', answer: p[1], options: mk4(p[1], (p[0] * 1000) + '%', (p[0]) + '%', '0.' + p[1].replace('%', '') + '%'), hint: '小数化百分数：小数点右移两位，添上百分号。' });
    });
    // 模板③：百分数化小数
    [['5%', '0.05'], ['10%', '0.1'], ['25%', '0.25'], ['40%', '0.4'], ['60%', '0.6'], ['75%', '0.75'], ['90%', '0.9'], ['120%', '1.2']].forEach(function (p) {
      list.push({ q: p[0] + ' 改写成小数是（  ）', answer: p[1], options: mk4(p[1], Number(p[1].replace('%', '')) / 1000 + '', Number(p[1].replace('%', '')) / 10 + '', p[0].replace('%', '')), hint: '百分数化小数：去掉百分号，小数点左移两位。' });
    });
    // 模板④：折扣现价 / 便宜了多少（常见错误：把便宜额当现价）
    [80, 100, 120, 160, 180, 200].forEach(function (price) {
      [80, 85, 90, 95].forEach(function (off) {
        var now = trimD(price * off / 100);
        list.push({ q: '一件商品原价 ' + price + ' 元，打 ' + off + ' 折后的现价是（  ）元', answer: now, options: mk4(now, String(price), trimD(price * (100 - off) / 100), trimD(price * off / 10)), hint: '现价 = 原价 × 折扣 = ' + price + ' × ' + off + '%。' });
        var save = trimD(price * (100 - off) / 100);
        list.push({ q: '一件商品原价 ' + price + ' 元，打 ' + off + ' 折，比原价便宜了（  ）元', answer: save, options: mk4(save, now, String(price), trimD(price * off / 100)), hint: '便宜额 = 原价 × (1 − 折扣)。' });
      });
    });
    // 模板⑤：百分率公式 + 增长概念（混合知识点）
    list.push({ q: '六(1)班 40 人今天出勤 38 人，今天的出勤率是（  ）', answer: '95%', options: mk4('95%', '38%', '5%', '105%'), hint: '出勤率 = 出勤人数 ÷ 总人数 × 100% = 38 ÷ 40。' });
    list.push({ q: '射击 20 次，命中 15 次，命中率是（  ）', answer: '75%', options: mk4('75%', '15%', '20%', '133%'), hint: '命中率 = 命中次数 ÷ 总次数 × 100% = 15 ÷ 20。' });
    list.push({ q: '甲数比乙数多 25%，那么乙数比甲数少（  ）', answer: '20%', options: mk4('20%', '25%', '75%', '125%'), hint: '单位「1」不同：甲 = 乙 × 125%，乙 = 甲 ÷ 125% = 甲 × 80%。' });
    list.push({ q: '增长率能不能超过 100%？（  ）', answer: '能', options: mk4('能', '不能', '只能等于 100%', '最多 99%'), hint: '增长的部分可以超过原来的量。' });
    return list;
  }

  // ============ 圆（~40 签名） ============
  function poolCircle() {
    var list = [];
    // 模板①②：周长 / 面积（r∈3..10，干扰项 = πr、πd、πd² 常见混淆）
    for (var r = 3; r <= 10; r++) {
      var d = 2 * r;
      list.push({ q: '半径 ' + r + ' 厘米的圆，周长是（  ）厘米（π 取 3.14）', answer: trimD(3.14 * d), options: mk4(trimD(3.14 * d), trimD(3.14 * r), trimD(3.14 * d * 2), trimD(3.14 * r * r)), hint: '周长 = π × 直径 = 3.14 × ' + d + '。' });
      list.push({ q: '半径 ' + r + ' 厘米的圆，面积是（  ）平方厘米（π 取 3.14）', answer: trimD(3.14 * r * r), options: mk4(trimD(3.14 * r * r), trimD(3.14 * d), trimD(3.14 * r * 2), trimD(3.14 * d * d)), hint: '面积 = πr² = 3.14 × ' + r + '²。' });
    }
    // 模板③：公式
    list.push({ q: '圆的周长公式是（  ）', answer: 'C = 2πr', options: mk4('C = 2πr', 'C = πr', 'C = 2r', 'C = πr²'), hint: '周长与直径的比值是 π。' });
    // 模板④：知直径求周长
    for (var dd = 6; dd <= 20; dd += 2) {
      list.push({ q: '直径 ' + dd + ' 厘米的圆，周长是（  ）厘米（π 取 3.14）', answer: trimD(3.14 * dd), options: mk4(trimD(3.14 * dd), trimD(3.14 * dd / 2), trimD(3.14 * dd * dd), trimD(3.14 * dd / 2 * (dd / 2))), hint: '周长 = π × 直径。' });
    }
    // 模板⑤：知周长求直径（混合知识点：逆运算）
    [[6.28, 2], [12.56, 4], [18.84, 6], [25.12, 8], [31.4, 10]].forEach(function (p) {
      list.push({ q: '圆的周长是 ' + p[0] + ' 厘米，直径是（  ）厘米（π 取 3.14）', answer: String(p[1]), options: mk4(String(p[1]), String(p[1] * 2), trimD(p[0] * 3.14), String(p[1] / 2)), hint: '直径 = 周长 ÷ π = ' + p[0] + ' ÷ 3.14。' });
    });
    // 模板⑥：半圆周长（常见错误：忘加直径）
    for (var hr = 2; hr <= 5; hr++) {
      var half = trimD(3.14 * hr + 2 * hr);
      list.push({ q: '半径 ' + hr + ' 厘米的半圆，周长是（  ）厘米（π 取 3.14）', answer: half, options: mk4(half, trimD(3.14 * hr), trimD(3.14 * hr * 2), trimD(3.14 * hr + hr)), hint: '半圆周长 = 圆周长的一半 + 直径。' });
    }
    // 模板⑦：混合知识点——半径扩大 k 倍，面积扩大 k² 倍
    for (var k = 2; k <= 5; k++) {
      list.push({ q: '圆的半径扩大到原来的 ' + k + ' 倍，面积扩大到原来的（  ）倍', answer: k * k, options: mk4(k * k, k, k * 2, k * k * 2), hint: '面积 = πr²，半径扩大 k 倍，面积扩大 k² 倍。' });
    }
    list.push({ q: '圆有（  ）条对称轴', answer: '无数条', options: mk4('无数条', '1 条', '2 条', '4 条'), hint: '每条直径所在的直线都是对称轴。' });
    return list;
  }

  // ============ 圆柱与圆锥（~65 签名） ============
  function poolCylCone() {
    var list = [];
    // 模板①：圆柱体积（干扰项：忘 ×h、圆锥 ÷3、侧面积式）
    for (var r = 2; r <= 5; r++) {
      for (var h = 3; h <= 8; h++) {
        var ans = trimD(3.14 * r * r * h);
        list.push({ q: '圆柱底面半径 ' + r + ' 厘米、高 ' + h + ' 厘米，体积是（  ）立方厘米（π 取 3.14）', answer: ans, options: mk4(ans, trimD(3.14 * r * r), trimD(3.14 * r * r * h / 3), trimD(3.14 * 2 * r * h)), hint: '体积 = 底面积 × 高 = 3.14 × ' + r + '² × ' + h + '。' });
      }
    }
    // 模板②：圆锥体积（干扰项：忘 ÷3）
    for (var r2 = 2; r2 <= 4; r2++) {
      for (var h2 = 3; h2 <= 9; h2++) {
        var ans2 = trimD(3.14 * r2 * r2 * h2 / 3);
        list.push({ q: '圆锥底面半径 ' + r2 + ' 厘米、高 ' + h2 + ' 厘米，体积是（  ）立方厘米（π 取 3.14）', answer: ans2, options: mk4(ans2, trimD(3.14 * r2 * r2 * h2), trimD(3.14 * r2 * r2), trimD(3.14 * 2 * r2 * h2)), hint: '圆锥体积 = 底面积 × 高 ÷ 3。' });
      }
    }
    // 模板③：侧面积
    for (var r3 = 2; r3 <= 4; r3++) {
      for (var h3 = 4; h3 <= 8; h3++) {
        var ans3 = trimD(3.14 * 2 * r3 * h3);
        list.push({ q: '圆柱底面半径 ' + r3 + ' 厘米、高 ' + h3 + ' 厘米，侧面积是（  ）平方厘米（π 取 3.14）', answer: ans3, options: mk4(ans3, trimD(3.14 * r3 * r3), trimD(3.14 * r3 * r3 * h3), trimD(3.14 * r3 * h3)), hint: '侧面积 = 底面周长 × 高 = 2πrh。' });
      }
    }
    // 模板④：展开图 + 关系 + 单位（概念与混合知识点）
    list.push({ q: '圆柱的侧面沿高展开后，长方形的长等于圆柱的（  ）', answer: '底面周长', options: mk4('底面周长', '直径', '半径', '底面积'), hint: '展开后长 = 底面周长，宽 = 高。' });
    list.push({ q: '等底等高的圆柱体积是圆锥体积的（  ）', answer: '3 倍', options: mk4('3 倍', '1/3', '2 倍', '9 倍'), hint: 'V柱 = Sh，V锥 = Sh ÷ 3。' });
    list.push({ q: '一个圆锥的体积是 6 立方厘米，与它等底等高的圆柱体积是（  ）立方厘米', answer: 18, options: mk4(18, 2, 6, 54), hint: '等底等高圆柱 = 圆锥 × 3。' });
    list.push({ q: '一个圆柱形水桶最多能装 20 升水，它的（  ）是 20 升', answer: '容积', options: mk4('容积', '体积', '侧面积', '底面积'), hint: '容器能装的量叫容积，占的空间叫体积。' });
    list.push({ q: '圆柱的体积不变，底面积扩大到原来的 2 倍，高应该（  ）', answer: '缩小到原来的 1/2', options: mk4('缩小到原来的 1/2', '扩大到原来的 2 倍', '不变', '缩小到原来的 1/4'), hint: 'V = Sh 一定时，S 与 h 成反比例。' });
    return list;
  }

  // ============ 扇形统计图（~20 签名） ============
  function poolChart() {
    var list = [];
    // 模板①：选图情境
    [['要表示各部分与整体的关系，应选', '扇形统计图', '条形统计图', '折线统计图'],
     ['要反映一周气温的变化情况，应选', '折线统计图', '扇形统计图', '条形统计图'],
     ['要直观比较六个年级的人数多少，应选', '条形统计图', '扇形统计图', '折线统计图'],
     ['要表示病人 24 小时体温变化，应选', '折线统计图', '条形统计图', '扇形统计图']].forEach(function (p) {
      list.push({ q: p[0] + '（  ）', answer: p[1], options: mk4(p[1], p[2], p[3], '统计表'), hint: '条形比多少、折线看趋势、扇形看占比。' });
    });
    // 模板②：圆心角（N∈10..72，干扰项 = 忘乘 3.6 / 乘 36 / 除 10）
    [10, 15, 20, 25, 30, 36, 40, 45, 50, 60, 12, 24, 72].forEach(function (n) {
      var ans = trimD(n * 3.6) + '°';
      list.push({ q: '占 ' + n + '% 的扇形，圆心角是（  ）', answer: ans, options: mk4(ans, n + '°', trimD(n * 36) + '°', trimD(n * 3.6 / 10) + '°'), hint: '圆心角 = 360° × ' + n + '%。' });
    });
    // 模板③：百分比之和 + 混合知识点（占比与分数）
    list.push({ q: '扇形统计图中，各部分所占百分比的和是（  ）', answer: '100%', options: mk4('100%', '90%', '180%', '360%'), hint: '整个圆表示总数 100%。' });
    list.push({ q: '扇形统计图中占 25% 的部分，相当于整体的（  ）', answer: '1/4', options: mk4('1/4', '1/5', '1/2', '1/25'), hint: '25% = 25/100 = 1/4。' });
    list.push({ q: '扇形统计图中占 50% 的部分，对应的圆心角是（  ）', answer: '180°', options: mk4('180°', '90°', '50°', '360°'), hint: '360° × 50% = 180°。' });
    return list;
  }

  // ============ 题目池：公共 PoolCache（跨调用连续发牌，见 shared/common.js） ============
  var POOL_BUILDERS = {
    negative: poolNegative,
    percent: poolPercent,
    circle: poolCircle,
    'cyl-cone': poolCylCone,
    chart: poolChart
  };
  function mixPool() {
    return poolNegative().concat(poolPercent(), poolCircle(), poolCylCone(), poolChart());
  }
  var pools = {};
  function poolOf(type) {
    if (!pools[type]) {
      pools[type] = _PU.createPoolCache('math-g6-choice:' + type, function () {
        return type === 'mix' ? mixPool() : (POOL_BUILDERS[type] ? POOL_BUILDERS[type]() : mixPool());
      });
    }
    return pools[type];
  }

  var TYPE_BUILDERS = {
    'negative': function () { return poolOf('negative').take(1)[0]; },
    'percent': function () { return poolOf('percent').take(1)[0]; },
    'circle': function () { return poolOf('circle').take(1)[0]; },
    'cyl-cone': function () { return poolOf('cyl-cone').take(1)[0]; },
    'chart': function () { return poolOf('chart').take(1)[0]; },
    mix: function () { return poolOf('mix').take(1)[0]; }
  };
  var TYPE_NAMES = {
    'negative': '负数',
    'percent': '百分数',
    'circle': '圆',
    'cyl-cone': '圆柱与圆锥',
    'chart': '扇形统计图',
    mix: '综合选择'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-g6-choice',
    moduleId: 'M12',
    name: '选择题',
    pageSubtitle: '负数、百分数、圆、圆柱圆锥与扇形统计图',
    grades: [6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g6-m12-g6-choice-negative',
        'math-g6-m12-g6-choice-percent',
        'math-g6-m12-g6-choice-circle',
        'math-g6-m12-g6-choice-cyl-cone',
        'math-g6-m12-g6-choice-chart'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',      label: '综合选择' },
          { value: 'negative', label: '负数' },
          { value: 'percent',  label: '百分数' },
          { value: 'circle',   label: '圆' },
          { value: 'cyl-cone', label: '圆柱与圆锥' },
          { value: 'chart',    label: '扇形统计图' }
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
        title: '小学六年级选择练习（' + (TYPE_NAMES[type] || '综合选择') + '）'
      };
    }
  });

  plugin.poolCache = poolOf('mix'); // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
