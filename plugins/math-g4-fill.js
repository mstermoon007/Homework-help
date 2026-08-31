/**
 * plugins/math-g4-fill.js — 四年级填空题插件（M4 填空）
 *
 * 知识点覆盖（shared/knowledge-bank.js 四年级 M4 模块）：
 *   g4-m4-g4-fill-bignum    大数的认识            （type: 'big-num'）
 *   g4-m4-g4-fill-hectare   公顷和平方千米        （type: 'hectare'）
 *   g4-m4-g4-fill-line      线段、射线、直线      （type: 'line-ray'）
 *   g4-m4-g4-fill-angle     角的度量与分类        （type: 'angle-metric'）
 *   g4-m4-g4-fill-quad      平行四边形和梯形      （type: 'quad'）
 *   g4-m4-g4-fill-op        四则运算意义与0的运算 （type: 'op-meaning'）
 *   g4-m4-g4-fill-quotient  商不变规律            （type: 'quotient-law'）
 *   g4-m4-g4-fill-dec       小数                 （type: 'decimal'）
 *   g4-m4-g4-fill-tri       三角形               （type: 'triangle'）
 *   g4-m4-g4-fill-avg       平均数               （type: 'average'）
 *
 * 提供标准 ExercisePlugin 接口。随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g4-fill.js 依赖 shared/common.js（PluginUtil），请先加载');


  // ============ 数字转中文读法（大数，万以内完整规则） ============
  var CN_D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  // 将 1~9999 的数字（不含 0）转为中文读数（用于万级/个级部分）
  function segToCn(n) {
    if (n === 0) return '零';
    var s = String(n), len = s.length, out = '';
    for (var i = 0; i < len; i++) {
      var d = Number(s[i]);
      var pos = len - i; // 4千 3百 2十 1个
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
        // 个级若不足千位，需补一个「零」
        var geS = String(ge);
        if (geS.length < 4) out += '零';
        out += segToCn(ge);
      }
    } else {
      out += segToCn(ge);
    }
    return out;
  }

  // ============ 大数的认识 ============
  function buildBigNum() {
    var v = _PU.rand(['read', 'write', 'approxW', 'approxY', 'maxmin', 'digits', 'countUnit']);
    if (v === 'read') {
      // 给出数字，填中文读法（八位数以内）
      var n = _PU.randInt(10000000, 99999999);
      var cn = numToCn(n);
      // 去掉中间的零不重复校验由外层 seen 完成
      return { q: n + ' 读作：', answer: cn, hint: '从高位读起，先读万级再读个级，中间或末尾的 0 注意省略。' };
    }
    if (v === 'write') {
      // 给出中文读法，填数字（由数字生成读法，保证一一对应）
      var n2 = _PU.randInt(10000000, 99999999);
      var cn2 = numToCn(n2);
      return { q: cn2 + ' 写作：', answer: n2,
        hint: '从高位写起，哪一位上一个单位也没有，就在那一位上写 0。' };
    }
    if (v === 'approxW') {
      // 省略万位后面的尾数（四舍五入到万位）
      var n3 = _PU.randInt(10000, 99999999);
      var ap = Math.round(n3 / 10000);
      if (ap === 0) ap = 1;
      var app = ap * 10000;
      if (app > 100000000) { n3 = _PU.randInt(10000, 9999999); ap = Math.round(n3 / 10000); app = ap * 10000; }
      return { q: n3 + ' ≈ （省略万位后面的尾数）', answer: ap + '万', hint: '看千位上的数字，大于或等于 5 向前一位进 1，否则直接舍去，再写上「万」。' };
    }
    if (v === 'approxY') {
      // 省略亿位后面的尾数
      var n4 = _PU.randInt(100000000, 999999999);
      var ap4 = Math.round(n4 / 100000000);
      if (ap4 === 0) ap4 = 1;
      var app4 = ap4 * 100000000;
      if (app4 > 1000000000) { n4 = _PU.randInt(100000000, 999999999); ap4 = Math.round(n4 / 100000000); app4 = ap4 * 100000000; }
      return { q: n4 + ' ≈ （省略亿位后面的尾数）', answer: ap4 + '亿', hint: '看千万位上的数字，四舍五入到亿位。' };
    }
    if (v === 'maxmin') {
      // 用几个数字组成最大/最小数（数字池随机，可能含 0）
      var pool = _PU.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 7);
      var isMax = _PU.rand([true, false]);
      var sorted = pool.slice().sort(isMax ? function (a, b) { return b - a; } : function (a, b) { return a - b; });
      if (!isMax && sorted[0] === 0) {
        // 最小的数首位不能是 0：把最小的非零数换到首位
        var zi = 0;
        while (sorted[zi] === 0) zi++;
        var tz = sorted[0]; sorted[0] = sorted[zi]; sorted[zi] = tz;
      }
      return { q: '用 ' + pool.join('、') + ' 组成一个最' + (isMax ? '大' : '小') + '的七位数是：', answer: sorted.join(''),
        hint: isMax ? '从大到小排列。' : '从小到大排列，但首位不能是 0。' };
    }
    if (v === 'digits') {
      // 判断位数与最高位
      var d = _PU.randInt(5, 8);
      var n6 = _PU.randInt(1, 9);
      var full = '';
      for (var k = 0; k < d; k++) full += (k === 0 ? n6 : '0');
      var posName = d === 5 ? '万' : d === 6 ? '十万' : d === 7 ? '百万' : '千万';
      return { q: full + ' 是 ' + d + ' 位数，最高位是（  ）位', answer: posName + '位',
        hint: '从右边起，第一位是个位……第五位是万位，依次类推。' };
    }
    // countUnit：某一位上的数字表示几个计数单位
    var n7 = _PU.randInt(12345678, 98765432);
    var posIdx = _PU.rand([1, 2, 3, 4]); // 从高到低第几位（万级）
    // 提取该位的数字与计数单位
    var s7 = String(n7), len7 = s7.length;
    var digit7 = Number(s7[posIdx]);
    var units7 = ['千万', '百万', '十万', '万', '千', '百', '十', '个'];
    var startUnitIdx = 8 - len7; // 最高位对应 units 下标
    var unit7 = units7[startUnitIdx + posIdx];
    var unitValMap = { '千万': 10000000, '百万': 1000000, '十万': 100000, '万': 10000, '千': 1000, '百': 100, '十': 10, '个': 1 };
    return { q: n7 + ' 中，' + unit7 + '位上的数字 ' + digit7 + ' 表示 ' + digit7 + ' 个（  ）',
      answer: unitValMap[unit7],
      hint: '这个数字在' + unit7 + '位上，就表示 ' + digit7 + ' 个' + unit7 + '。' };
  }

  // ============ 公顷和平方千米 ============
  function buildHectare() {
    var v = _PU.rand(['hm2m2', 'km2hm2', 'km2m2', 'm2hm2', 'hm2km2', 'concept']);
    if (v === 'hm2m2') {
      var a = _PU.randInt(1, 99);
      return { q: a + ' 公顷 =（  ）平方米', answer: a * 10000,
        hint: '1 公顷 = 10000 平方米。' };
    }
    if (v === 'km2hm2') {
      var b = _PU.randInt(1, 99);
      return { q: b + ' 平方千米 =（  ）公顷', answer: b * 100,
        hint: '1 平方千米 = 100 公顷。' };
    }
    if (v === 'km2m2') {
      var c = _PU.randInt(1, 9);
      return { q: c + ' 平方千米 =（  ）平方米', answer: c * 1000000,
        hint: '1 平方千米 = 1000000 平方米。' };
    }
    if (v === 'm2hm2') {
      var d = _PU.randInt(1, 99);
      return { q: d * 10000 + ' 平方米 =（  ）公顷', answer: d,
        hint: '10000 平方米 = 1 公顷。' };
    }
    if (v === 'hm2km2') {
      var e = _PU.randInt(1, 99);
      return { q: e * 100 + ' 公顷 =（  ）平方千米', answer: e,
        hint: '100 公顷 = 1 平方千米。' };
    }
    return { q: '边长是 100 米的正方形，面积是 1（  ）', answer: '公顷',
      hint: '100×100 = 10000 平方米 = 1 公顷。' };
  }

  // ============ 线段、射线、直线 ============
  function buildLineRay() {
    var v = _PU.rand(['endpoint', 'segments', 'through', 'extend', 'name']);
    if (v === 'endpoint') {
      var kind = _PU.rand(['线段', '射线', '直线']);
      var n;
      if (kind === '线段') n = '2';
      else if (kind === '射线') n = '1';
      else n = '0';
      return { q: kind + '有（  ）个端点', answer: n,
        hint: '线段有两个端点，射线有一个端点，直线没有端点。' };
    }
    if (v === 'segments') {
      // 数线段：在同一直线上有 n 个点，共几条线段
      var pts = _PU.randInt(3, 6);
      var cnt = pts * (pts - 1) / 2;
      var dots = [];
      for (var i = 0; i < pts; i++) dots.push('•');
      return { q: '直线上有 ' + pts + ' 个点，一共有（  ）条线段（' + dots.join('—') + '）',
        answer: cnt,
        hint: pts + ' 个点任取 2 个都能连成一条线段：' + pts + '×' + (pts - 1) + '÷2 = ' + cnt + '。' };
    }
    if (v === 'through') {
      var kind2 = _PU.rand(['一点', '两点']);
      var n2 = kind2 === '一点' ? '无数' : '一';
      return { q: '过' + kind2 + '能画（  ）条直线', answer: n2,
        hint: '过一点能画无数条直线，过两点只能画一条直线。' };
    }
    if (v === 'extend') {
      var q2 = _PU.rand(['线段', '射线', '直线']);
      var phrase;
      if (q2 === '线段') phrase = '有限长，可以量出长度';
      else if (q2 === '射线') phrase = '有一个端点，向一端无限延伸';
      else phrase = '没有端点，向两端无限延伸';
      return { q: '（  ）' + phrase + '。', answer: q2,
        hint: '根据端点个数和延伸方向判断。' };
    }
    return { q: '线段是（  ）的一部分，射线是（  ）的一部分', answer: ['直线', '直线'],
      hint: '线段、射线都是直线的一部分。' };
  }

  // ============ 角的度量与分类 ============
  function buildAngleMetric() {
    var v = _PU.rand(['classify', 'relation', 'clock', 'obtuse', 'tri-relation', 'compute']);
    if (v === 'classify') {
      // 给出度数判断角类型
      var degs = [0, 30, 45, 60, 89, 90, 91, 120, 150, 179, 180, 270, 360];
      var deg = _PU.rand(degs);
      var cls;
      if (deg === 0) cls = '零角';
      else if (deg < 90) cls = '锐角';
      else if (deg === 90) cls = '直角';
      else if (deg < 180) cls = '钝角';
      else if (deg === 180) cls = '平角';
      else if (deg === 360) cls = '周角';
      else cls = '大于平角的角';
      if (cls === '大于平角的角') { deg = 270; }
      return { q: deg + '° 的角是（  ）', answer: cls,
        hint: '小于 90° 是锐角，等于 90° 是直角，大于 90° 小于 180° 是钝角，180° 是平角，360° 是周角。' };
    }
    if (v === 'relation') {
      var r = _PU.rand(['周平', '平直', '周直']);
      var q, ans;
      if (r === '周平') { q = '1 周角 =（  ）平角'; ans = '2'; }
      else if (r === '平直') { q = '1 平角 =（  ）直角'; ans = '2'; }
      else { q = '1 周角 =（  ）直角'; ans = '4'; }
      return { q: q, answer: ans, hint: '周角 360°，平角 180°，直角 90°。' };
    }
    if (v === 'clock') {
      // 钟面整点夹角
      var h = _PU.rand([1, 2, 3, 4, 5, 6]);
      var ang = h * 30;
      var cls2 = ang === 90 ? '直角' : (ang < 90 ? '锐角' : '钝角');
      if (ang === 180) cls2 = '平角';
      return { q: h + ' 时整，时针和分针所成的角是（  ）', answer: cls2,
        hint: '钟面上一个大格 30°，' + h + ' 时两针夹角 ' + ang + '°。' };
    }
    if (v === 'obtuse') {
      // 求补角（180 - 已知角）或直角内分解
      var k = _PU.rand([30, 45, 60, 120, 135, 150]);
      return { q: '与 ' + k + '° 互补的角是（  ）°', answer: 180 - k,
        hint: '两角之和为 180° 称互补。' };
    }
    if (v === 'compute') {
      // 两个角度数求和/差
      var c = _PU.rand(['sum', 'diff']);
      var x = _PU.rand([20, 25, 30, 35, 40, 45, 50, 55, 60]);
      var y = _PU.rand([20, 25, 30, 35, 40, 45]);
      if (c === 'sum') {
        return { q: x + '° + ' + y + '° =（  ）°', answer: x + y,
          hint: '直接相加。' };
      }
      var mx = Math.max(x, y), mn = Math.min(x, y);
      return { q: mx + '° − ' + mn + '° =（  ）°', answer: mx - mn,
        hint: '直接相减。' };
    }
    // 三角尺：三角尺上有 3 个角，分别求出各角度数
    var tri2 = _PU.rand([['30°', '60°', '90°'], ['45°', '45°', '90°']]);
    var pickAngle = _PU.rand(tri2);
    return { q: '三角尺中有 ' + pickAngle + ' 的角（写出一个即可），它是（  ）角',
      answer: pickAngle.indexOf('90') !== -1 ? '直角' : '锐角',
      hint: '三角尺是直角三角形：一副三角尺的角分别是 30°、60°、90° 或 45°、45°、90°。' };
  }

  // ============ 平行四边形和梯形 ============
  function buildQuad() {
    var v = _PU.rand(['para-feat', 'trap-feat', 'para-angle', 'trap-angle', 'height', 'parallel']);
    if (v === 'para-feat') {
      return { q: '平行四边形的两组对边分别（  ）且（  ）', answer: ['平行', '相等'],
        hint: '平行四边形对边平行且相等，对角相等。' };
    }
    if (v === 'trap-feat') {
      return { q: '只有一组对边平行的四边形叫做（  ）', answer: '梯形',
        hint: '梯形只有一组对边平行，另一组对边不平行。' };
    }
    if (v === 'para-angle') {
      var a = _PU.rand([30, 45, 60, 70, 80, 100, 110, 120, 135]);
      var b = 180 - a;
      return { q: '平行四边形的一个角是 ' + a + '°，与它相邻的角是（  ）°，对角是（  ）°',
        answer: [b, a],
        hint: '平行四边形相邻两角互补（和 180°），对角相等。' };
    }
    if (v === 'trap-angle') {
      var t = _PU.rand([30, 45, 60, 120, 135]);
      var t2 = 180 - t;
      return { q: '梯形中与一个 60° 角相邻的另一个角是（  ）°（两底平行）', answer: '120',
        hint: '两底平行，同旁内角互补：180° − 60° = 120°。' };
    }
    if (v === 'height') {
      var w = _PU.rand(['平行四边形', '梯形']);
      return { q: w + '有（  ）条高', answer: '无数',
        hint: w + '可以作无数条高。' };
    }
    return { q: '在梯形里互相平行的一组边分别叫做（  ）', answer: '上底和下底',
      hint: '梯形互相平行的一组对边叫上底和下底。' };
  }

  // ============ 四则运算的意义与关系、0 的运算 ============
  function buildOpMeaning() {
    var v = _PU.rand(['zero-add', 'zero-mul', 'zero-div', 'zero-nodiv', 'relation', 'bracket']);
    if (v === 'zero-add') {
      var a = _PU.randInt(25, 98);
      return { q: a + ' + 0 =（  ），a + 0 =（  ）', answer: [a, 'a'],
        hint: '任何数加 0 还得原数。' };
    }
    if (v === 'zero-mul') {
      var b = _PU.randInt(25, 98);
      return { q: b + ' × 0 =（  ），0 × a =（  ）', answer: ['0', '0'],
        hint: '0 乘任何数都得 0。' };
    }
    if (v === 'zero-div') {
      var c = _PU.randInt(25, 98);
      return { q: '0 ÷ ' + c + ' =（  ），0 ÷ a（a≠0）=（  ）', answer: ['0', '0'],
        hint: '0 除以任何非零数都得 0。' };
    }
    if (v === 'zero-nodiv') {
      return { q: '0 不能作（  ）', answer: '除数',
        hint: '0 作除数没有意义，不能作除数。' };
    }
    if (v === 'relation') {
      var r = _PU.rand(['被减数', '被除数', '除数']);
      var q, ans;
      if (r === '被减数') { q = '被减数 = 减数 +（  ）'; ans = '差'; }
      else if (r === '被除数') { q = '被除数 = 除数 ×（  ） + 余数'; ans = '商'; }
      else { q = '除数 =（被除数 − 余数）÷（  ）'; ans = '商'; }
      return { q: q, answer: ans, hint: '根据加、减、乘、除各部分间的关系填空。' };
    }
    // 填运算符号使等式成立（用 0 或 1 巧算）
    var kind = _PU.rand(['zerom', 'onet']);
    if (kind === 'zerom') {
      var x = _PU.randInt(2, 9), y = _PU.randInt(2, 9);
      return { q: x + ' ×（  ）= 0，括号里填（  ）', answer: ['0', '0'],
        hint: '0 乘任何数都得 0。' };
    }
    var x2 = _PU.randInt(2, 9);
    return { q: x2 + ' ÷（  ）= ' + x2 + '，括号里填（  ）', answer: ['1', '1'],
      hint: '一个数除以它本身（非零）等于 1。' };
  }

  // ============ 商不变规律 ============
  function buildQuotientLaw() {
    var v = _PU.rand(['same-mul', 'same-div', 'find', 'rule']);
    if (v === 'same-mul') {
      var a = _PU.randInt(12, 99), b = _PU.randInt(2, 12), q = Math.floor(a / b);
      if (q === 0) q = 1;
      var m = _PU.rand([2, 3, 5, 10]);
      return { q: a + ' ÷ ' + b + ' = ' + q + '，被除数和除数同时乘 ' + m + '，商是（  ）',
        answer: q, hint: '被除数和除数同时乘或除以相同的数（0 除外），商不变。' };
    }
    if (v === 'same-div') {
      var a2 = _PU.randInt(12, 99), b2 = _PU.randInt(2, 12), q2 = Math.floor(a2 / b2);
      if (q2 === 0) q2 = 1;
      var d2 = _PU.rand([2, 5]);
      return { q: a2 + ' ÷ ' + b2 + ' = ' + q2 + '，被除数和除数同时除以 ' + d2 + '，商是（  ）',
        answer: q2, hint: '商不变规律：被除数和除数同时除以相同的数（0 除外），商不变。' };
    }
    if (v === 'find') {
      // 用商不变规律求值：被除数×m ÷ 除数
      var a3 = _PU.randInt(120, 999), b3 = _PU.randInt(2, 20), q3 = Math.floor(a3 / b3);
      if (q3 === 0) q3 = 1;
      var m3 = _PU.rand([10, 100]);
      return { q: a3 + '0 ÷ ' + b3 + '0 =（  ）', answer: q3,
        hint: '被除数、除数末尾同时去掉一个 0，商不变。' };
    }
    return { q: '被除数和除数同时乘或除以相同的数（0 除外），（  ）不变', answer: '商',
      hint: '这就是商不变规律。' };
  }

  // ============ 小数 ============
  function buildDecimal() {
    var v = _PU.rand(['count', 'compose', 'nature', 'place', 'frac']);
    if (v === 'count') {
      var t = _PU.randInt(1, 9);
      return { q: t + ' 个 0.1 是（  ）', answer: (t / 10).toFixed(1),
        hint: '0.1 是十分之一，' + t + ' 个十分之一是 ' + (t / 10).toFixed(1) + '。' };
    }
    if (v === 'compose') {
      var w = _PU.randInt(1, 9), t2 = _PU.randInt(1, 9), h = _PU.randInt(1, 9);
      var num = w + t2 / 10 + h / 100;
      var ansStr = w + '、' + t2 + '、' + h;
      return { q: num.toFixed(2) + ' 是由 ' + w + ' 个一、' + t2 + ' 个 0.1 和 ' + h + ' 个 0.01 组成的，写作（  ）',
        answer: num.toFixed(2),
        hint: '把整数部分、十分位、百分位上的数合起来。' };
    }
    if (v === 'nature') {
      var x = _PU.randInt(2, 99) / 10;
      var xS = x.toFixed(1);
      return { q: xS + ' = ' + xS + '0（填 >、< 或 =）', answer: '=',
        hint: '小数的末尾添上 0 或去掉 0，小数的大小不变。' };
    }
    if (v === 'place') {
      var r = _PU.rand(['十分位', '百分位']);
      var num2 = (_PU.randInt(10, 99) / 100).toFixed(2);
      var digit = r === '十分位' ? Math.floor(num2 * 10) % 10 : Math.floor(num2 * 100) % 10;
      return { q: '在 ' + num2 + ' 中，' + r + '上的数字是（  ）', answer: digit,
        hint: '小数点右边第一位是十分位，第二位是百分位。' };
    }
    // 小数与分数互化（分母 10/100）
    var den = _PU.rand([10, 100]);
    var v3 = _PU.randInt(1, 9);
    var dec = (v3 / den).toFixed(den === 10 ? 1 : 2);
    return { q: v3 + '/' + den + ' =（  ）（填小数）', answer: dec,
      hint: '十分之几等于零点几，百分之几等于零点几几。' };
  }

  // ============ 三角形 ============
  function buildTriangle() {
    var v = _PU.rand(['third', 'isosceles', 'classify', 'peri', 'inner']);
    if (v === 'third') {
      var a = _PU.rand([30, 40, 50, 60, 70, 80, 20, 10]);
      var b = _PU.rand([40, 50, 60, 70, 80, 30]);
      if (a + b >= 180) b = _PU.randInt(20, 80);
      return { q: '三角形一个角是 ' + a + '°，另一个角是 ' + b + '°，第三个角是（  ）°',
        answer: 180 - a - b,
        hint: '三角形内角和为 180°。' };
    }
    if (v === 'isosceles') {
      var base = _PU.rand([30, 40, 50, 60, 70, 80]);
      var apex = 180 - 2 * base;
      return { q: '等腰三角形的一个底角是 ' + base + '°，顶角是（  ）°',
        answer: apex,
        hint: '等腰三角形两底角相等，内角和 180°。' };
    }
    if (v === 'classify') {
      var k = _PU.rand(['3 个角都小于 90°', '有 1 个角是 90°', '有 1 个角大于 90°']);
      var cls;
      if (k.indexOf('都小于') !== -1) cls = '锐角';
      else if (k.indexOf('90°') !== -1 && k.indexOf('大于') === -1) cls = '直角';
      else cls = '钝角';
      return { q: '一个三角形' + k + '，它是（  ）三角形', answer: cls + '三角形',
        hint: '按角分：三个锐角是锐角三角形，一个直角是直角三角形，一个钝角是钝角三角形。' };
    }
    if (v === 'peri') {
      var side = _PU.randInt(3, 12);
      return { q: '等边三角形每条边 ' + side + ' 厘米，周长是（  ）厘米', answer: side * 3,
        hint: '等边三角形三边相等，周长 = 边长 × 3。' };
    }
    return { q: '三角形内角和是（  ）°', answer: '180',
      hint: '任意三角形内角和都是 180°。' };
  }

  // ============ 平均数 ============
  function buildAverage() {
    var v = _PU.rand(['simple', 'sum', 'count', 'concept']);
    if (v === 'simple') {
      var a = _PU.randInt(10, 90), b = _PU.randInt(10, 90), c = _PU.randInt(10, 90), d = _PU.randInt(10, 90);
      var avg = Math.round((a + b + c + d) / 4);
      return { q: '4 个数分别是 ' + a + '、' + b + '、' + c + '、' + d + '，它们的平均数是（  ）',
        answer: avg,
        hint: '平均数 = 总数量 ÷ 总份数。' };
    }
    if (v === 'sum') {
      var n = _PU.rand([3, 4, 5]);
      var avg2 = _PU.randInt(20, 80);
      return { q: n + ' 个数的平均数是 ' + avg2 + '，这 ' + n + ' 个数的总和是（  ）',
        answer: avg2 * n,
        hint: '总数量 = 平均数 × 总份数。' };
    }
    if (v === 'count') {
      var tot = _PU.randInt(100, 200);
      var cnt = _PU.rand([4, 5, 10]);
      while (tot % cnt !== 0) tot++;
      return { q: '总数量是 ' + tot + '，平均分成 ' + cnt + ' 份，每份是（  ）',
        answer: tot / cnt,
        hint: '每份数 = 总数量 ÷ 份数。' };
    }
    return { q: '平均数 = 总数量 ÷（  ）', answer: '总份数',
      hint: '求平均数的公式。' };
  }

  // ============ 综合填空（按知识点权重混合） ============
  function buildMixed() {
    var r = _PU.randInt(1, 100);
    if (r <= 12) return buildBigNum();
    if (r <= 22) return buildHectare();
    if (r <= 32) return buildLineRay();
    if (r <= 42) return buildAngleMetric();
    if (r <= 52) return buildQuad();
    if (r <= 62) return buildOpMeaning();
    if (r <= 72) return buildQuotientLaw();
    if (r <= 84) return buildDecimal();
    if (r <= 94) return buildTriangle();
    return buildAverage();
  }

  var TYPE_BUILDERS = {
    'big-num': buildBigNum,
    'hectare': buildHectare,
    'line-ray': buildLineRay,
    'angle-metric': buildAngleMetric,
    'quad': buildQuad,
    'op-meaning': buildOpMeaning,
    'quotient-law': buildQuotientLaw,
    'decimal': buildDecimal,
    'triangle': buildTriangle,
    'average': buildAverage,
    mix: buildMixed
  };
  var TYPE_NAMES = {
    'big-num': '大数的认识',
    'hectare': '公顷和平方千米',
    'line-ray': '线段射线直线',
    'angle-metric': '角的度量与分类',
    'quad': '平行四边形和梯形',
    'op-meaning': '四则运算与0',
    'quotient-law': '商不变规律',
    'decimal': '小数',
    'triangle': '三角形',
    'average': '平均数',
    mix: '综合填空'
  };

  var plugin = _PU.createPlugin({
    id: 'math-g4-fill',
    moduleId: 'M4',
    name: '填空题',
    pageSubtitle: '大数、单位换算、几何概念、小数与平均数',
    grades: [4],
    subject: 'math',
    category: 'mixed',
    printConfig: { pageType: 'math' },
    knowledgePoints: [
        'math-g4-m4-g4-fill-bignum',
        'math-g4-m4-g4-fill-hectare',
        'math-g4-m4-g4-fill-line',
        'math-g4-m4-g4-fill-angle',
        'math-g4-m4-g4-fill-quad',
        'math-g4-m4-g4-fill-op',
        'math-g4-m4-g4-fill-quotient',
        'math-g4-m4-g4-fill-dec',
        'math-g4-m4-g4-fill-tri',
        'math-g4-m4-g4-fill-avg'
    ],

    settings: [
      {
        key: 'type',
        label: '题型',
        default: 'mix',
        options: [
          { value: 'mix', label: '综合填空' },
          { value: 'big-num', label: '大数的认识' },
          { value: 'hectare', label: '公顷和平方千米' },
          { value: 'line-ray', label: '线段射线直线' },
          { value: 'angle-metric', label: '角的度量与分类' },
          { value: 'quad', label: '平行四边形和梯形' },
          { value: 'op-meaning', label: '四则运算与0' },
          { value: 'quotient-law', label: '商不变规律' },
          { value: 'decimal', label: '小数' },
          { value: 'triangle', label: '三角形' },
          { value: 'average', label: '平均数' }
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
        // 多空答案（如“相邻的角（ ）°，对角（ ）°”）→ multi 双输入框，分字段作答
        if (Array.isArray(p.answer)) {
          return { type: 'fill', q: p.q, answer: p.answer, hint: p.hint,
            inputType: 'multi', inputCount: p.answer.length };
        }
        return { type: 'fill', q: p.q, answer: String(p.answer), hint: p.hint, inputType: 'text' };
      });
    },

    meta: function (opts) {
      var type = (opts && opts.type) || 'mix';
      return {
        type: type,
        count: (opts && opts.count) || 10,
        title: '小学四年级填空练习（' + (TYPE_NAMES[type] || '综合填空') + '）'
      };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);