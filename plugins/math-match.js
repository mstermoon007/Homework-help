/**
 * plugins/math-match.js — 连线题插件（M5 连线，四年级/五年级/六年级 合并版）
 *
 * 原三个文件（math-g4-match.js / math-g5-match.js / math-g6-matching.js）合并而来；
 * 内容保持原样，仅按年级命名空间前缀（g4_/g5_/g6_）避免标识符冲突。
 *   g4: 大数读法、角与度数、图形特征、运算律公式、小数与分数
 *   g5: 面积公式、立体图形特征、可能性、方程与解、分数与小数
 *   g6: 正反比例判断、圆与圆柱圆锥公式、统计图特点、分数百分数互化（题目池发牌）
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-match.js 依赖 shared/common.js（PluginUtil），请先加载');


  // 构建 choice 题：left + right(正确) + 最多 3 个干扰右项
  function mk(left, right, rightPool) {
    var distractors = [];
    (rightPool || []).forEach(function (r) { if (r !== right && distractors.indexOf(r) === -1 && distractors.length < 3) distractors.push(r); });
    // 若干扰不足，用通用池补充
    var fillPool = rightPool && rightPool.length ? rightPool : [];
    var i = 0;
    while (distractors.length < 3 && fillPool.length && i < fillPool.length) {
      var c = fillPool[i];
      if (c !== right && distractors.indexOf(c) === -1) distractors.push(c);
      i++;
    }
    while (distractors.length < 3) {
      var x = '干扰项' + _PU.randInt(1, 99);
      if (x !== right && distractors.indexOf(x) === -1) distractors.push(x);
    }
    return { q: '把「' + left + '」连到对应的', answer: right, options: _PU.shuffle([right].concat(distractors)), hint: '记住对应的概念或公式。' };
  }


  // ==================== 四年级 ====================

  // 数字转中文读法（连线用，万以内）
  var g4_CN_D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  function g4_segToCn(n) {
    if (n === 0) return '零';
    var s = String(n), len = s.length, out = '';
    for (var i = 0; i < len; i++) {
      var d = Number(s[i]);
      var pos = len - i;
      var unit = pos === 4 ? '千' : pos === 3 ? '百' : pos === 2 ? '十' : '';
      if (d === 0) {
        if (i < len - 1 && Number(s[i + 1]) !== 0 && out.charAt(out.length - 1) !== '零') out += '零';
      } else {
        out += g4_CN_D[d] + unit;
      }
    }
    return out;
  }
  function g4_numToCn(n) {
    if (n === 0) return '零';
    var s = String(n), len = s.length;
    var wan = 0, ge = 0;
    if (len > 4) { wan = Number(s.slice(0, len - 4)); ge = Number(s.slice(len - 4)); }
    else { ge = Number(s); }
    var out = '';
    if (wan > 0) {
      out += g4_segToCn(wan) + '万';
      if (ge > 0) {
        var geS = String(ge);
        if (geS.length < 4) out += '零';
        out += g4_segToCn(ge);
      }
    } else {
      out += g4_segToCn(ge);
    }
    return out;
  }

  // 大数与读法连线
  function g4_buildRead() {
    var n = _PU.randInt(10000000, 99999999);
    var cn = g4_numToCn(n);
    var correct = cn;
    var distractorPool = [];
    for (var i = 0; i < 3; i++) {
      var n2 = _PU.randInt(10000000, 99999999);
      distractorPool.push(g4_numToCn(n2));
    }
    // 避免干扰项与正确项重复
    var opts = [];
    opts.push(correct);
    distractorPool.forEach(function (d) { if (d !== correct) opts.push(d); });
    while (opts.length < 4) { opts.push(g4_numToCn(_PU.randInt(10000000, 99999999))); }
    var options = _PU.shuffle(opts.slice(0, 4));
    return { q: '「' + n + '」读作', answer: correct, options: options,
      hint: '从高位读起，先读万级再读个级。' };
  }

  // 角与度数连线
  function g4_buildAngleDegree() {
    var classes = [
      { name: '锐角', lo: 10, hi: 89 },
      { name: '直角', val: 90 },
      { name: '钝角', lo: 91, hi: 179 },
      { name: '平角', val: 180 },
      { name: '周角', val: 360 }
    ];
    var cls = _PU.rand(classes);
    var deg = cls.val != null ? cls.val : _PU.randInt(cls.lo, cls.hi);
    var options = _PU.shuffle(['锐角', '直角', '钝角', '平角', '周角']);
    return { q: '把「' + deg + '° 的角」连到对应的分类', answer: cls.name, options: options,
      hint: '记住角的分类与度数范围。' };
  }

  // 图形与特征连线
  function g4_buildShapeFeature() {
    var mode = _PU.randInt(1, 3);
    if (mode === 1) {
      var n = _PU.randInt(3, 8);
      return { q: n + ' 边形有（  ）条边', answer: String(n),
        options: _PU.shuffle([String(n), String(n + 1), String(n - 1), String(n + 2)]),
        hint: '多边形有几条边就叫几边形。' };
    }
    if (mode === 2) {
      var n2 = _PU.randInt(3, 8);
      return { q: n2 + ' 边形有（  ）个角', answer: String(n2),
        options: _PU.shuffle([String(n2), String(n2 + 1), String(n2 - 1), String(n2 + 2)]),
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
    var pr = _PU.rand(table);
    var distractors = [];
    table.forEach(function (p) { if (p[0] !== pr[0] && distractors.length < 3) distractors.push(p[1]); });
    var options = _PU.shuffle([pr[1]].concat(distractors));
    return { q: '把「' + pr[0] + '」连到对应的特征', answer: pr[1], options: options,
      hint: '根据图形的边、角特征判断。' };
  }

  // 运算律与字母表达式连线
  function g4_buildLawFormula() {
    var a = _PU.randInt(2, 9), b = _PU.randInt(2, 9), c = _PU.randInt(2, 9);
    var laws = [
      { n: '加法交换律', e: a + ' + ' + b + ' = ' + b + ' + ' + a },
      { n: '加法结合律', e: '(' + a + ' + ' + b + ') + ' + c + ' = ' + a + ' + (' + b + ' + ' + c + ')' },
      { n: '乘法交换律', e: a + ' × ' + b + ' = ' + b + ' × ' + a },
      { n: '乘法结合律', e: '(' + a + ' × ' + b + ') × ' + c + ' = ' + a + ' × (' + b + ' × ' + c + ')' },
      { n: '乘法分配律', e: '(' + a + ' + ' + b + ') × ' + c + ' = ' + a + ' × ' + c + ' + ' + b + ' × ' + c }
    ];
    var lw = _PU.rand(laws);
    var options = _PU.shuffle(laws.map(function (x) { return x.n; }));
    return { q: '等式「' + lw.e + '」应用了（  ）', answer: lw.n, options: options,
      hint: '运算律的字母公式要牢记。' };
  }

  // 小数与分数连线
  function g4_buildDecFrac() {
    if (_PU.randInt(1, 2) === 1) {
      var t = _PU.randInt(1, 9);
      return { q: '把「0.' + t + '」连到相等的分数', answer: t + '/10',
        options: _PU.shuffle([t + '/10', (t + 1) + '/10', (10 - t) + '/10', t + '/100']),
        hint: '一位小数是十分之几。' };
    }
    var h = _PU.randInt(1, 99);
    var hs = h < 10 ? '0' + h : String(h);
    return { q: '把「0.' + hs + '」连到相等的分数', answer: h + '/100',
      options: _PU.shuffle([h + '/100', (h + 1) + '/100', (100 - h) + '/100', (h % 10) + '/10']),
      hint: '两位小数是百分之几。' };
  }

  // 综合连线（按知识点权重混合）
  function g4_buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 25) return g4_buildRead();
    if (r <= 45) return g4_buildAngleDegree();
    if (r <= 65) return g4_buildShapeFeature();
    if (r <= 85) return g4_buildLawFormula();
    return g4_buildDecFrac();
  }

  var g4_TYPE_BUILDERS = {
    'read': g4_buildRead,
    'angle-degree': g4_buildAngleDegree,
    'shape-feature': g4_buildShapeFeature,
    'law-formula': g4_buildLawFormula,
    'dec-frac': g4_buildDecFrac,
    mix: g4_buildMixed
  };
  var g4_TYPE_NAMES = {
    'read': '大数与读法',
    'angle-degree': '角与度数',
    'shape-feature': '图形与特征',
    'law-formula': '运算律公式',
    'dec-frac': '小数与分数',
    mix: '综合连线'
  };


  // ==================== 五年级 ====================

  // 图形与面积公式连线（随机维度，题面池极大）
  function g5_buildAreaFormula() {
    var rights = ['长 × 宽', '边长 × 边长', '底 × 高 ÷ 2', '底 × 高', '(上底 + 下底) × 高 ÷ 2', 'π × 半径 × 半径', '(长×宽 + 长×高 + 宽×高) × 2', '棱长 × 棱长 × 6', 'π × 半径² ÷ 2', '(长 + 宽) × 2', '边长 × 4'];
    var makers = [
      function () { var a = _PU.randInt(2, 40), b = _PU.randInt(2, 40); return ['一个长方形长 ' + a + ' 厘米、宽 ' + b + ' 厘米，面积 = ？', '长 × 宽']; },
      function () { var s = _PU.randInt(2, 40); return ['一个正方形的边长是 ' + s + ' 厘米，面积 = ？', '边长 × 边长']; },
      function () { var d = _PU.randInt(2, 40), h = _PU.randInt(2, 40); return ['一个三角形的底是 ' + d + ' 厘米、高是 ' + h + ' 厘米，面积 = ？', '底 × 高 ÷ 2']; },
      function () { var d = _PU.randInt(2, 40), h = _PU.randInt(2, 40); return ['一个平行四边形底 ' + d + ' 厘米、高 ' + h + ' 厘米，面积 = ？', '底 × 高']; },
      function () { var a = _PU.randInt(2, 30), b = _PU.randInt(2, 30), h = _PU.randInt(2, 30); return ['一个梯形上底 ' + a + '、下底 ' + b + '、高 ' + h + '，面积 = ？', '(上底 + 下底) × 高 ÷ 2']; },
      function () { var r = _PU.randInt(2, 30); return ['一个圆半径 ' + r + ' 厘米，面积 = ？', 'π × 半径 × 半径']; },
      function () { var a = _PU.randInt(2, 20), b = _PU.randInt(2, 20), c = _PU.randInt(2, 20); return ['一个长方体长 ' + a + '、宽 ' + b + '、高 ' + c + '，表面积 = ？', '(长×宽 + 长×高 + 宽×高) × 2']; },
      function () { var e = _PU.randInt(2, 20); return ['一个正方体棱长 ' + e + '，表面积 = ？', '棱长 × 棱长 × 6']; },
      function () { var r = _PU.randInt(2, 30); return ['一个半圆半径 ' + r + ' 厘米，面积 = ？', 'π × 半径² ÷ 2']; },
      function () { var a = _PU.randInt(2, 40), b = _PU.randInt(2, 40); return ['一个长方形长 ' + a + '、宽 ' + b + '，周长 = ？', '(长 + 宽) × 2']; },
      function () { var s = _PU.randInt(2, 40); return ['一个正方形边长 ' + s + '，周长 = ？', '边长 × 4']; }
    ];
    var pr = _PU.rand(makers)();
    return mk(pr[0], pr[1], rights);
  }

  // 立体图形特征连线（随机编号，题面池极大）
  function g5_buildSolidFeature() {
    var rights = ['6 个面都是长方形（特殊情况下有两个相对面是正方形）', '6 个面都是完全相同的正方形', '相对的面完全相同', '12 条棱都相等', '有 8 个顶点，12 条棱', '棱长总和 = 棱长 × 12', '体积 = 长 × 宽 × 高', '体积 = 棱长 × 棱长 × 棱长', '上下两个底面是完全相同的圆', '侧面展开一般是长方形', '只有一个顶点', '侧面展开是扇形', '表面积 = (长×宽 + 长×高 + 宽×高) × 2', '有 6 个完全相同的面', '高有无数条', '表面是一个曲面', '棱长总和 = （长 + 宽 + 高） × 4', '半径处处相等', '是特殊的长方体', '上下一样粗', '两个底面之间的距离叫做高', '高只有一条', '任意一个面的面积都相等', '占地面的面积 = 长 × 宽'];
    var shapes = ['长方体', '正方体', '圆柱', '圆锥', '球'];
    var tag = '【图' + _PU.randInt(1, 9) + _PU.randInt(1, 9) + '】';
    var shape = _PU.rand(shapes);
    var right = _PU.rand(rights);
    return mk(tag + shape, right, rights);
  }

  // 事件与可能性描述连线（含随机数字模板）
  function g5_buildPossibilityDesc() {
    var r3 = ['一定发生', '可能发生', '不可能发生'];
    var makers = [
      function () { var x = _PU.randInt(2, 20), y = _PU.randInt(1, 20); return ['盒子里有 ' + x + ' 个红球和 ' + y + ' 个蓝球，摸出一个，是红球', '可能发生']; },
      function () { var x = _PU.randInt(2, 20); return ['盒子里只有 ' + x + ' 个红球，摸出一个，是红球', '一定发生']; },
      function () { var x = _PU.randInt(2, 20); return ['盒子里只有 ' + x + ' 个红球，摸出一个，是蓝球', '不可能发生']; },
      function () { var n = _PU.randInt(1, 6); return ['掷一个骰子，点数是 ' + n, '可能发生']; },
      function () { return ['太阳从东方升起', '一定发生']; },
      function () { return ['猴子在天上飞', '不可能发生']; },
      function () { var n = _PU.randInt(2, 12); return ['一年有 ' + n + ' 个月', '不可能发生']; },
      function () { var n = _PU.randInt(2, 12); return ['一个月最多有 ' + n + ' 天', '可能发生']; },
      function () { return ['1 分钟 = 60 秒', '一定发生']; },
      function () { var n = _PU.randInt(2, 30); return ['从 ' + n + ' 名同学中至少有 2 人同月出生', '可能发生']; },
      function () { var n = _PU.randInt(2, 30); return ['从 ' + n + ' 名同学中至少有 2 人生日同天', '可能发生']; }
    ];
    var pr = _PU.rand(makers)();
    return mk(pr[0], pr[1], r3);
  }

  // 方程与解连线（多模板 + 随机数字）
  function g5_buildEquationSolve() {
    var x = _PU.randInt(2, 60);
    var tmpl = _PU.randInt(0, 3);
    var left, right = 'x = ' + x;
    if (tmpl === 0) { var b = _PU.randInt(2, 60); left = 'x + ' + b + ' = ' + (x + b); }
    else if (tmpl === 1) { var b2 = _PU.randInt(2, 60); left = 'x - ' + b2 + ' = ' + (x - b2); }
    else if (tmpl === 2) { var a = _PU.randInt(2, 12); left = a + ' x = ' + (a * x); }
    else { var a2 = _PU.randInt(2, 12); left = 'x ÷ ' + a2 + ' = ' + (x / a2); }
    var rightPool = ['x = ' + x];
    for (var d = 0; d < 5; d++) { var other = x + _PU.randInt(1, 9) * (_PU.randInt(0, 1) ? 1 : -1); if (other !== x) rightPool.push('x = ' + other); }
    return mk(left, right, rightPool);
  }

  // 分数与小数连线
  function g5_buildFracDecimal() {
    // 由 2/5 因子分母（必为有限小数）批量生成，保证题面池充足
    var denoms = [2, 4, 5, 8, 10, 16, 20, 25, 32, 40, 50, 64, 80, 100, 125, 200, 250, 500];
    var raw = [];
    denoms.forEach(function (den) {
      for (var num = 1; num < den; num++) {
        var val = num / den;
        var dec = (val % 1 === 0) ? String(val) : val.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
        raw.push([num + '/' + den, dec]);
      }
    });
    var seen = {}, pairs = [];
    raw.forEach(function (p) { if (!seen[p[1]]) { seen[p[1]] = 1; pairs.push(p); } });
    var pr = _PU.rand(pairs);
    var rightPool = pairs.map(function (p) { return p[1]; });
    return mk(pr[0], pr[1], rightPool);
  }

  // 综合连线
  function g5_buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 22) return g5_buildAreaFormula();
    if (r <= 44) return g5_buildSolidFeature();
    if (r <= 66) return g5_buildPossibilityDesc();
    if (r <= 84) return g5_buildEquationSolve();
    return g5_buildFracDecimal();
  }

  var g5_TYPE_BUILDERS = {
    'area-formula': g5_buildAreaFormula,
    'solid-feature': g5_buildSolidFeature,
    'possibility-desc': g5_buildPossibilityDesc,
    'equation-solve': g5_buildEquationSolve,
    'frac-decimal': g5_buildFracDecimal,
    mix: g5_buildMixed
  };
  var g5_TYPE_NAMES = {
    'area-formula': '图形与面积公式',
    'solid-feature': '立体图形特征',
    'possibility-desc': '事件与可能性',
    'equation-solve': '方程与解',
    'frac-decimal': '分数与小数',
    mix: '综合连线'
  };


  // ==================== 六年级（题目池发牌） ====================

  // 正反比例判断：22 情境
  var g6_PROPORTION_PAIRS = [
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

  // 圆与圆柱圆锥公式：20 条
  var g6_FORMULA_PAIRS = [
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
  var g6_CHART_PAIRS = [
    ['扇形统计图最适合表示', '各部分与整体的关系'],
    ['折线统计图最能反映', '数量的增减变化趋势'],
    ['条形统计图便于', '比较数量的多少'],
    ['扇形统计图各部分百分比之和', '100%'],
    ['折线统计图不仅能表示数量多少，还能表示', '变化趋势'],
    ['要表示病人 24 小时体温变化，应选用', '折线统计图'],
    ['要表示校园内各种树木占比，应选用', '扇形统计图'],
    ['要比较各班人数多少，应选用', '条形统计图']
  ];

  // 百分比 → 圆心角参数化：21 个
  var g6_PERCENT_FOR_ANGLE = [5, 10, 12, 15, 18, 20, 25, 30, 36, 40, 45, 50, 54, 60, 66, 70, 75, 80, 84, 90, 96];
  var g6_percentPairs = g6_PERCENT_FOR_ANGLE.map(function (n) {
    return ['占 ' + n + '% 的扇形对应的圆心角', (n * 3.6) + '°'];
  });

  // 分数 ↔ 百分数互化：20 条
  var g6_FRAC_PERCENT = [
    ['1/2', '50%'], ['1/4', '25%'], ['3/4', '75%'], ['1/5', '20%'], ['2/5', '40%'],
    ['3/5', '60%'], ['4/5', '80%'], ['1/8', '12.5%'], ['3/8', '37.5%'], ['5/8', '62.5%'],
    ['7/8', '87.5%'], ['1/10', '10%'], ['3/10', '30%'], ['7/10', '70%'], ['9/10', '90%'],
    ['1/20', '5%'], ['3/20', '15%'], ['1/25', '4%'], ['1/16', '6.25%'], ['1/50', '2%']
  ];
  var g6_fracPercentPairs = g6_FRAC_PERCENT.map(function (p) {
    return ['分数 ' + p[0] + ' 化成百分数', p[1]];
  });

  // 小数 ↔ 最简分数互化：15 条
  var g6_DEC_FRAC = [
    ['0.5', '1/2'], ['0.25', '1/4'], ['0.75', '3/4'], ['0.2', '1/5'], ['0.4', '2/5'],
    ['0.6', '3/5'], ['0.8', '4/5'], ['0.125', '1/8'], ['0.375', '3/8'], ['0.625', '5/8'],
    ['0.875', '7/8'], ['0.05', '1/20'], ['0.35', '7/20'], ['0.65', '13/20'], ['0.85', '17/20']
  ];
  var g6_decFracPairs = g6_DEC_FRAC.map(function (p) {
    return ['小数 ' + p[0] + ' 化成最简分数', p[1]];
  });

  // 比 ↔ 分数/比值：6 条
  var g6_RATIO_PAIRS = [
    ['比 3:4 化成分数', '3/4'],
    ['比 2:5 化成分数', '2/5'],
    ['比 5:8 化成分数', '5/8'],
    ['比值 0.5 化成最简比', '1:2'],
    ['比值 0.25 化成最简比', '1:4'],
    ['比的前项 ÷ 比的后项', '比值']
  ];

  // 类别右项池（干扰项来源）
  var g6_CATEGORY_POOLS = {
    proportion: g6_PROPORTION_PAIRS.map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
    formula: g6_FORMULA_PAIRS.map(function (p) { return p[1]; }),
    chart: g6_CHART_PAIRS.concat(g6_percentPairs).map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; }),
    convert: g6_fracPercentPairs.concat(g6_decFracPairs).concat(g6_RATIO_PAIRS).map(function (p) { return p[1]; }).filter(function (v, i, a) { return a.indexOf(v) === i; })
  };

  // 类别 → 配对清单
  var g6_POOL_OF = {
    proportion: g6_PROPORTION_PAIRS,
    formula: g6_FORMULA_PAIRS,
    chart: g6_CHART_PAIRS.concat(g6_percentPairs),
    convert: g6_fracPercentPairs.concat(g6_decFracPairs).concat(g6_RATIO_PAIRS)
  };

  var g6_sameCatKey = ''; // 构建池时标记当前类别
  function g6_catOf(p) {
    var left = p[0];
    if (g6_PROPORTION_PAIRS.some(function (x) { return x[0] === left; })) return 'proportion';
    if (g6_FORMULA_PAIRS.some(function (x) { return x[0] === left; })) return 'formula';
    if (g6_fracPercentPairs.concat(g6_decFracPairs, g6_RATIO_PAIRS).some(function (x) { return x[0] === left; })) return 'convert';
    return 'chart';
  }

  // 把配对清单构建为完整题目（干扰项同类优先，候选 3 个）
  function g6_buildQuestionsOf(type) {
    var pairs = g6_POOL_OF[type] || g6_POOL_OF.proportion.concat(g6_POOL_OF.formula, g6_POOL_OF.chart, g6_POOL_OF.convert);
    return pairs.map(function (p) {
      g6_sameCatKey = type === 'mix' ? g6_catOf(p) : type;
      var q = mk(p[0], p[1], g6_CATEGORY_POOLS[g6_sameCatKey] || []);
      return { q: q.q, answer: q.answer, options: q.options, hint: q.hint };
    });
  }

  var g6_pools = {};
  function g6_poolOf(type) {
    if (!g6_pools[type]) {
      g6_pools[type] = _PU.createPoolCache('math-match:' + type, function () {
        return type === 'mix'
          ? g6_buildQuestionsOf('proportion').concat(g6_buildQuestionsOf('formula'), g6_buildQuestionsOf('chart'), g6_buildQuestionsOf('convert'))
          : g6_buildQuestionsOf(type);
      });
    }
    return g6_pools[type];
  }

  var g6_TYPE_BUILDERS = {
    'proportion': function () { return g6_poolOf('proportion').take(1)[0]; },
    'formula': function () { return g6_poolOf('formula').take(1)[0]; },
    'chart': function () { return g6_poolOf('chart').take(1)[0]; },
    'convert': function () { return g6_poolOf('convert').take(1)[0]; },
    mix: function () { return g6_poolOf('mix').take(1)[0]; }
  };
  var g6_TYPE_NAMES = {
    'proportion': '正反比例判断',
    'formula': '圆与圆柱圆锥公式',
    'chart': '扇形统计图特点',
    'convert': '分数百分数与比互化',
    mix: '综合连线'
  };


  // ==================== 年级分派 ====================

  // 跨年级综合连线（年级未知时的混合构建）
  function g_buildCombinedMixed() {
    var r = _PU.randInt(1, 3);
    if (r === 1) return g4_buildMixed();
    if (r === 2) return g5_buildMixed();
    return g6_TYPE_BUILDERS.mix();
  }

  function g_pickGrade(opts) {
    var g = opts.grade;
    if (g == null && opts.grades != null) {
      g = Array.isArray(opts.grades) ? opts.grades[_PU.randInt(0, opts.grades.length - 1)] : opts.grades;
    }
    return (g == null ? 5 : g);
  }

  var GRADE_CFG = {
    4: {
      builders: g4_TYPE_BUILDERS,
      names: g4_TYPE_NAMES,
      key: function (p) { return p.q + '|' + p.answer; },
      maxA: function (count) { return Math.max(count * 40, 300); },
      suffix: '（点击右侧对应项）'
    },
    5: {
      builders: g5_TYPE_BUILDERS,
      names: g5_TYPE_NAMES,
      key: function (p) { return p.q; },
      maxA: function (count) { return Math.max(count * 60, 400); },
      suffix: ''
    },
    6: {
      builders: g6_TYPE_BUILDERS,
      names: g6_TYPE_NAMES,
      key: function (p) { return p.q + '|' + p.answer; },
      maxA: function (count) { return Math.max(count * 60, 400); },
      suffix: ''
    }
  };
  var GRADE_TITLE = {
    4: '小学四年级连线练习（',
    5: '小学五年级连线练习（',
    6: '小学六年级连线练习（'
  };

  // ============ 用工厂创建插件 ============
  var plugin = _PU.createPlugin({
    id: 'math-match',
    moduleId: 'M5',
    name: '连线题',
    pageSubtitle: '大数读法、角、图形特征、运算律与小数分数；面积公式、立体图形、可能性、方程与分数小数；正反比例判断、图形公式、统计图特点与分数百分数互化',
    grades: [4, 5, 6],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
      'math-g4-m5-g4-match-read',
      'math-g4-m5-g4-match-angle',
      'math-g4-m5-g4-match-shape',
      'math-g4-m5-g4-match-law',
      'math-g4-m5-g4-match-decfrac',
      'math-g5-m5-g5-match-areaf',
      'math-g5-m5-g5-match-solid',
      'math-g5-m5-g5-match-possib',
      'math-g5-m5-g5-match-equ',
      'math-g5-m5-g5-match-fracdec',
      'math-g6-m5-g6-match-proportion',
      'math-g6-m5-g6-match-formula',
      'math-g6-m5-g6-match-chart'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix',             label: '综合连线' },
          { value: 'read',            label: '大数与读法' },
          { value: 'angle-degree',    label: '角与度数' },
          { value: 'shape-feature',   label: '图形与特征' },
          { value: 'law-formula',     label: '运算律公式' },
          { value: 'dec-frac',        label: '小数与分数' },
          { value: 'area-formula',    label: '图形与面积公式' },
          { value: 'solid-feature',   label: '立体图形特征' },
          { value: 'possibility-desc', label: '事件与可能性' },
          { value: 'equation-solve',  label: '方程与解' },
          { value: 'frac-decimal',    label: '分数与小数' },
          { value: 'proportion',      label: '正反比例判断' },
          { value: 'formula',         label: '圆与圆柱圆锥公式' },
          { value: 'chart',           label: '扇形统计图特点' },
          { value: 'convert',         label: '分数百分数互化' }
        ]
      },
      {
        key: 'grade',
        label: '年级',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合' },
          { value: 4, label: '四年级' },
          { value: 5, label: '五年级' },
          { value: 6, label: '六年级' }
        ]
      }
    ],

    generateQuestions: function (options) {
      var opts = options || {};
      var type = opts.type || 'mix';
      var count = opts.count || 10;
      var grade = g_pickGrade(opts);
      var cfg = GRADE_CFG[grade];
      var seen = {}, list = [], attempts = 0, maxA, builder, keyFn, suffix;

      if (cfg) {
        builder = cfg.builders[type] || cfg.builders.mix;
        keyFn = cfg.key;
        suffix = cfg.suffix;
        maxA = cfg.maxA(count);
      } else {
        builder = g_buildCombinedMixed;
        keyFn = function (p) { return p.q + '|' + p.answer; };
        suffix = '';
        maxA = Math.max(count * 60, 400);
      }

      while (list.length < count && attempts < maxA) {
        var p = builder();
        var key = keyFn(p);
        if (!seen[key]) { seen[key] = 1; list.push(p); }
        attempts++;
      }

      return list.map(function (p) {
        return { type: 'match', q: suffix ? p.q + suffix : p.q, answer: String(p.answer),
          options: p.options, hint: p.hint, inputType: 'choice' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      var grade = g_pickGrade(opts || {});
      var cfg = GRADE_CFG[grade];
      var prefix = GRADE_TITLE[grade] || '连线练习（';
      var typeName = cfg ? (cfg.names[type] || '综合连线') : '综合连线';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        grade: grade,
        title: prefix + typeName + '）'
      };
    }
  });

  plugin.poolCache = g6_poolOf('mix'); // 供 dev/check-duplicates.js 读取池大小

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
