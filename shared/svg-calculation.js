// shared/svg-calculation.js — 竖式计算图形生成器（SVGCalculation）
//
// 依赖 shared/svg-core.js。输出完整 <svg> 字符串，可直接赋给题目 q.svg。
//
// API：
//   SVGCalculation.add([456, 378], opts)    加法竖式（自动进位点）
//   SVGCalculation.sub(502, 217, opts)      减法竖式（借位点）
//   SVGCalculation.mul(123, 45, opts)       乘法竖式（部分积错位 + 进位点）
//   SVGCalculation.div(47, 5, opts)         长除竖式（商/余数）
//
// opts：{ fontSize, cellW, rowH, markStyle:'dot'|'digit', errorType:'no-carry'|'no-borrow', color }
// errorType 会按典型学生错误生成「错误结果竖式」（如加法不进位：456+378→724）。

(function (global) {
  'use strict';

  var U = global.SVGUtil;
  if (!U && typeof require !== 'undefined') U = require('./svg-core.js');
  if (!U) throw new Error('shared/svg-calculation.js 依赖 shared/svg-core.js，请先加载');

  var RED = '#e05252';
  var INK = '#27324a';

  function checkInt(n, name) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new RangeError(name + ' 必须为非负整数');
    }
    return n;
  }
  function digitsOf(n) { return String(n).split('').map(Number); }

  /** 竖式画布：网格布局，col 自左向右，row 自上向下 */
  function Canvas(o) {
    this.cellW = o.cellW || 26; this.rowH = o.rowH || o.rowH === 0 ? o.rowH : (o.rowH || 30);
    this.fs = o.fontSize || 20;
    this.color = o.color || INK;
    this.markStyle = o.markStyle || 'dot';
    // 进位/借位点颜色区分（任务：SVG 细化）：进位橙、借位紫，默认与结果红区分
    this.carryColor = o.carryColor || '#e0862c';
    this.borrowColor = o.borrowColor || '#7c5cff';
    this.minCol = 0; this.maxCol = 0; this.rowN = 0;
    this.parts = [];
  }
  Canvas.prototype.x = function (col) { return col * this.cellW + this.cellW / 2; };
  Canvas.prototype.y = function (row) { return row * this.rowH + this.rowH * 0.75; };
  Canvas.prototype.put = function (row, col, ch, opt) {
    opt = opt || {};
    this.minCol = Math.min(this.minCol, col); this.maxCol = Math.max(this.maxCol, col);
    this.rowN = Math.max(this.rowN, row + 1);
    if (ch === '' || ch == null) return;
    this.parts.push(U.svgText(this.x(col), this.y(row), String(ch), {
      fontSize: opt.fs || this.fs,
      fontFamily: 'Menlo, Consolas, monospace',
      fill: opt.color || this.color,
      fontWeight: opt.bold ? 700 : 400,
      'text-anchor': 'middle'
    }));
  };
  Canvas.prototype.rightPut = function (row, endCol, str, opt) {
    var ds = String(str).split('');
    for (var i = 0; i < ds.length; i++) this.put(row, endCol - (ds.length - 1 - i), ds[i], opt);
    return endCol;
  };
  Canvas.prototype.dot = function (row, col, label, kind) {
    this.minCol = Math.min(this.minCol, col); this.maxCol = Math.max(this.maxCol, col);
    this.rowN = Math.max(this.rowN, row + 1);
    var markColor = kind === 'borrow' ? this.borrowColor : this.carryColor;
    if (this.markStyle === 'digit' && label != null) {
      this.parts.push(U.svgText(this.x(col), this.y(row), String(label),
        { fontSize: this.fs * 0.55, fill: markColor, 'text-anchor': 'middle' }));
    } else {
      this.parts.push(U.svgCircle(this.x(col), this.y(row), 2.6, { fill: markColor, stroke: 'none' }));
    }
  };
  Canvas.prototype.hline = function (row, colFrom, colTo) {
    this.parts.push(U.svgLine(this.x(colFrom) - this.cellW * 0.38, this.y(row) - this.rowH * 0.62,
      this.x(colTo) + this.cellW * 0.38, this.y(row) - this.rowH * 0.62,
      { stroke: this.color, strokeWidth: 2.2 }));
  };
  Canvas.prototype.render = function () {
    var w = (this.maxCol - this.minCol + 1) * this.cellW + this.cellW;
    var h = this.rowN * this.rowH + 6;
    return U.svgWrap(this.parts.join(''),
      { viewBox: (this.minCol * this.cellW - this.cellW / 2) + ' -4 ' + w + ' ' + h });
  };

  // ============ 加法 ============
  function add(addends, opts) {
    opts = opts || {};
    if (!Array.isArray(addends) || addends.length < 2) throw new Error('add 需要至少两个加数');
    addends = addends.map(function (n) { return checkInt(n, '加数'); });
    var c = new Canvas(opts);
    var noCarry = opts.errorType === 'no-carry';
    var maxLen = Math.max.apply(null, addends.map(function (n) { return String(n).length; }).concat([String(addends.reduce(function (a, b) { return a + b; }, 0)).length]));
    var endCol = maxLen + 1;
    // 加数行
    addends.forEach(function (n, i) {
      c.rightPut(i, endCol, n);
    });
    c.put(addends.length - 1, endCol - maxLen - 1, '+', { bold: true });
    c.hline(addends.length, endCol - maxLen - 1, endCol);
    // 逐列求和（含进位）
    var sumRow = addends.length;
    var carry = 0, resDigits = [];
    var cols = maxLen;
    for (var k = 0; k < cols; k++) {
      var colIdx = endCol - k;
      var s = carry, carryIn = carry;
      addends.forEach(function (n) {
        var ds = String(n);
        var dch = ds[ds.length - 1 - k];
        if (dch != null) s += Number(dch);
      });
      var outDigit = noCarry ? s % 10 : s % 10;
      resDigits.unshift(outDigit % 10);
      var newCarry = noCarry ? 0 : Math.floor(s / 10);
      if (!noCarry && carryIn === 0 && newCarry > 0 && k < cols - 1) {
        c.dot(sumRow - addends.length, colIdx - 1, newCarry, "carry"); // 进位点(橙)标在下一列上方
      } else if (!noCarry && newCarry > 0 && k < cols - 1) {
        c.dot(sumRow - addends.length, colIdx - 1, newCarry, "carry");
      }
      carry = newCarry;
    }
    var resStr = noCarry ? resDigits.join('') : String(addends.reduce(function (x, y) { return x + y; }, 0));
    c.rightPut(sumRow, endCol, resStr, { bold: true });
    return c.render();
  }

  // ============ 减法 ============
  function sub(a, b, opts) {
    opts = opts || {};
    checkInt(a, '被减数'); checkInt(b, '减数');
    if (a < b) throw new RangeError('被减数必须不小于减数');
    var c = new Canvas(opts);
    var noBorrow = opts.errorType === 'no-borrow';
    var A = digitsOf(a), B = digitsOf(b);
    var endCol = Math.max(A.length, B.length) + 1;
    var borrowRow = 0;
    c.rightPut(1, endCol, a);
    c.rightPut(2, endCol, b);
    c.put(2, endCol - Math.max(A.length, B.length) - 1, '−', { bold: true });
    c.hline(3, endCol - Math.max(A.length, B.length) - 1, endCol);
    // 逐列借位
    var diffRow = 3;
    var borrow = 0, ds = [];
    for (var k = 0; k < A.length; k++) {
      var ai = A[A.length - 1 - k] - borrow;
      var bi = B[B.length - 1 - k] || 0;
      if (ai < bi) {
        ai += 10;
        if (!noBorrow) c.dot(borrowRow, endCol - k - 1, 1, "borrow"); // 被借位的那一位打点(紫)
        borrow = 1;
      } else { borrow = 0; }
      var d = ai - bi;
      ds.unshift(noBorrow ? Math.abs(A[A.length - 1 - k] - bi) % 10 : d);
    }
    while (ds.length > 1 && ds[0] === 0) ds.shift();
    c.rightPut(diffRow, endCol, ds.join(''), { bold: true });
    return c.render();
  }

  // ============ 乘法 ============
  function mul(a, b, opts) {
    opts = opts || {};
    checkInt(a, '因数'); checkInt(b, '因数');
    var c = new Canvas(opts);
    var noCarry = opts.errorType === 'no-carry';
    var B = digitsOf(b), A = a;
    var prod = a * b;
    var endCol = Math.max(String(a).length, String(b).length, String(prod).length) + 1;
    c.rightPut(0, endCol, a);
    c.rightPut(1, endCol, b);
    c.put(1, endCol - Math.max(String(a).length, String(b).length) - 1, '×', { bold: true });
    c.hline(2, endCol - Math.max(String(a).length, String(b).length) - 1, endCol);
    var row = 2;
    if (B.length === 1) {
      // 多位数 × 一位数
      var carry = 0, out = [];
      var Ad = digitsOf(a);
      for (var k = Ad.length - 1; k >= 0; k--) {
        var v = Ad[k] * B[0] + carry;
        out.unshift(v % 10);
        if (!noCarry && Math.floor(v / 10) > 0 && k > 0) c.dot(row, endCol - (Ad.length - k), Math.floor(v / 10), "carry");
        carry = noCarry ? 0 : Math.floor(v / 10);
      }
      if (!noCarry && carry > 0) out.unshift(carry);
      c.rightPut(++row, endCol, out.join(''), { bold: true });
      return c.render();
    }
    // 多位 × 多位：逐位部分积
    var partials = [];
    for (var i = B.length - 1; i >= 0; i--) {
      row++;
      var shift = B.length - 1 - i;
      var carry2 = 0, pOut = [];
      var Ad2 = digitsOf(a);
      for (var k2 = Ad2.length - 1; k2 >= 0; k2--) {
        var v2 = Ad2[k2] * B[i] + carry2;
        pOut.unshift(v2 % 10);
        if (!noCarry && Math.floor(v2 / 10) > 0 && k2 > 0) c.dot(row, endCol - shift - (Ad2.length - k2), Math.floor(v2 / 10), "carry");
        carry2 = noCarry ? 0 : Math.floor(v2 / 10);
      }
      if (!noCarry && carry2 > 0) pOut.unshift(carry2);
      c.rightPut(row, endCol - shift, pOut.join(''));
      partials.push({ val: Number(pOut.join('')) * Math.pow(10, shift), endCol: endCol - shift });
      if (i > 0) continue;
      c.hline(row + 1, endCol - String(prod).length + 1, endCol);
    }
    if (B.length > 1) {
      c.rightPut(++row, endCol, String(noCarry ? partials.reduce(function (s, p2) { return s + p2.val; }, 0) : prod), { bold: true });
    }
    return c.render();
  }

  // ============ 除法（长除格式） ============
  function div(dividend, divisor, opts) {
    opts = opts || {};
    checkInt(dividend, '被除数'); checkInt(divisor, '除数');
    if (divisor < 1) throw new RangeError('除数必须为正');
    var c = new Canvas(opts);
    var Dd = digitsOf(dividend);
    var q = Math.floor(dividend / divisor), r = dividend % divisor;
    var Q = digitsOf(q);
    var dCols = Dd.length;
    var divEndCol = dCols + 2;          // 被除数最右列
    var divStartCol = 3;                // 被除数起始列
    // 商（顶部，与对应被除数位对齐）
    var qStart = divStartCol + (Dd.length - Q.length);
    for (var i = 0; i < Q.length; i++) c.put(0, qStart + i, Q[i], { bold: true });
    // 除数 | 被除数 与角线
    c.rightPut(1, divStartCol - 1, divisor, {});
    c.put(1, divStartCol - 1, null);
    var dvx = c.x(divStartCol - 1) + c.cellW * 0.42;
    c.parts.push(U.svgLine(dvx, c.y(1) - c.rowH * 0.85, dvx, c.y(1) + c.rowH * 0.35, { stroke: INK, strokeWidth: 2 }));
    c.parts.push(U.svgLine(dvx, c.y(1) - c.rowH * 0.85, c.x(divEndCol) + c.cellW * 0.38, c.y(1) - c.rowH * 0.85, { stroke: INK, strokeWidth: 2 }));
    c.rightPut(1, divEndCol, dividend);
    // 长除过程行
    var row = 2, idx = 0, cur = 0;
    while (idx < Dd.length) {
      cur = cur * 10 + Dd[idx];
      if (cur >= divisor || idx === Dd.length - 1) {
        var qd = Math.floor(cur / divisor);
        var prod = qd * divisor;
        var prodStr = String(prod);
        c.rightPut(row + 1, divStartCol + idx, '-' + prodStr, { color: RED });
        c.hline(row + 2, divStartCol + idx - prodStr.length + 1, divStartCol + idx);
        cur -= prod;
        if (!(idx === Dd.length - 1 && cur === 0)) {
          var bringDown = '';
        }
        row += 2;
        if (idx < Dd.length - 1) {
          c.rightPut(row, divStartCol + idx + 1, String(Dd[idx + 1]), { fs: c.fs });
        }
      }
      idx++;
      if (idx < Dd.length && cur < divisor && cur !== 0) {
        // 继续落下一位（已在上分支处理显示）
      }
    }
    if (r > 0) {
      c.rightPut(++row, divEndCol, r, { bold: true, color: RED });
    }
    return c.render();
  }

  // ============ 小数竖式（任务：SVG 细化） ============
  /** 解析非负小数字符串 → {int:'12', frac:'5'}；非法返回 null */
  function parseDec(s) {
    var m = /^(\d+)(?:\.(\d+))?$/.exec(String(s).trim());
    return m ? { int: m[1], frac: m[2] || '' } : null;
  }
  /**
   * 小数加减竖式：小数点独立占列、上下对齐，进/借位点颜色区分。
   * SVGCalculation.dec('12.5', '3.48', '+', opts)
   * 列布局（自左向右）：整数区(intMax 列) · 小数点独占列 · 小数区(fracMax 列)。
   */
  function dec(aText, bText, op, opts) {
    opts = opts || {};
    if (op !== '+' && op !== '−' && op !== '-') throw new Error("dec 的 op 仅支持 '+' / '-'");
    var isSub = op === '−' || op === '-';
    var A = parseDec(aText), B = parseDec(bText);
    if (!A || !B) throw new Error("dec 需要形如 '12.5' / '48' 的非负小数");
    // 以 10^fracMax 缩放为整数做精确运算
    var fracMax = Math.max(A.frac.length, B.frac.length);
    var scale = Math.pow(10, fracMax);
    var ai = Number(A.int + A.frac + '0'.repeat(fracMax - A.frac.length));
    var bi = Number(B.int + B.frac + '0'.repeat(fracMax - B.frac.length));
    if (isSub && ai < bi) throw new RangeError('dec 被减数必须不小于减数');
    var ri = isSub ? ai - bi : ai + bi;
    var rRaw = String(ri);
    while (rRaw.length <= fracMax) rRaw = '0' + rRaw;   // 补零保证小数位完整（如 81 → 0.081）
    var rStr = fracMax > 0 ? rRaw.slice(0, -fracMax) + '.' + rRaw.slice(-fracMax) : rRaw;
    var R = parseDec(rStr);

    var intMax = Math.max(A.int.length, B.int.length, R.int.length);
    // 视觉列：[0..intMax-1]=整数区 | intMax=小数点 | [intMax+1..intMax+fracMax]=小数区
    var pointCol = fracMax > 0 ? intMax : -1;
    var endCol = intMax - 1 + (fracMax > 0 ? 1 + fracMax : 0);
    var c = new Canvas(opts);
    /** 自右起第 r 位数字（r=0 为最低位）所在视觉列（跨越小数点列时偏移 1） */
    function colOf(r) {
      return endCol - r - (fracMax > 0 && r >= fracMax ? 1 : 0);
    }
    function putNum(row, numObj) {
      var Li = numObj.int.length;
      for (var i = 0; i < Li; i++) c.put(row, (intMax - Li) + i, numObj.int.charAt(i));
      if (pointCol >= 0) c.put(row, pointCol, '.', { bold: true });
      for (var f = 0; f < numObj.frac.length; f++) {
        c.put(row, intMax + 1 + f, numObj.frac.charAt(f));
      }
    }
    putNum(0, A);
    putNum(1, B);
    c.put(1, -1, isSub ? '−' : '+', { bold: true });
    c.hline(2, -1, endCol);
    putNum(2, R);

    // 进/借位点：逐位检查（aD/bD 低位在前；点标在更高一位的列上方）
    var aD = [], bD = [];
    var sa = A.int + A.frac + '0'.repeat(fracMax - A.frac.length);
    var sb = B.int + B.frac + '0'.repeat(fracMax - B.frac.length);
    var padLen = Math.max(sa.length, sb.length);
    while (sa.length < padLen) sa = '0' + sa;
    while (sb.length < padLen) sb = '0' + sb;
    for (var t = 0; t < padLen; t++) { aD.push(Number(sa.charAt(padLen - 1 - t))); bD.push(Number(sb.charAt(padLen - 1 - t))); }
    var carryRow = 0;
    if (!isSub) {
      var carry = 0;
      for (var ka = 0; ka < padLen; ka++) {
        var sumC = aD[ka] + bD[ka] + carry;
        carry = Math.floor(sumC / 10);
        if (carry > 0 && ka < padLen - 1) c.dot(carryRow, colOf(ka + 1), carry, 'carry');
      }
    } else {
      var borrow = 0;
      for (var kb = 0; kb < padLen; kb++) {
        if (aD[kb] - borrow < bD[kb]) {
          if (kb < padLen - 1) c.dot(carryRow, colOf(kb + 1), 1, 'borrow');
          borrow = 1;
        } else borrow = 0;
      }
    }
    return c.render();
  }

  // ============ 分数竖式（任务：SVG 细化） ============
  /**
   * 分数加减图示：a/b ⊕ c/d = □（结果留白框供填写）。
   * SVGCalculation.frac(1, 2, 1, 3, '+', opts)
   * opts：{ fontSize, color, resultBox } resultBox=false 时显示计算结果分数（约分后）。
   */
  function gcd(x, y) { while (y) { var t = x % y; x = y; y = t; } return x; }
  function frac(n1, d1, n2, d2, op, opts) {
    opts = opts || {};
    [n1, d1, n2, d2].forEach(function (v, i) {
      if (!(typeof v === 'number' && isFinite(v) && v > 0 && Math.floor(v) === v)) {
        throw new RangeError('frac 分子分母必须为正整数（参数 #' + (i + 1) + '）');
      }
    });
    if (op !== '+' && op !== '-' && op !== '−') throw new Error("frac 的 op 仅支持 '+' / '-'");
    var fs = opts.fontSize || 22;
    var color = opts.color || INK;
    var cellW = fs * 2.4, barHalf = fs * 1.05, gapY = fs * 0.62;
    var midY = 46;
    function fraction(cx, n, d) {
      return U.svgText(cx, midY - gapY, String(n), { fontSize: fs, fill: color, fontFamily: 'Menlo, monospace', fontWeight: 700 }) +
        U.svgLine(cx - barHalf, midY, cx + barHalf, midY, { stroke: color, strokeWidth: 2.2 }) +
        U.svgText(cx, midY + fs * 0.55 + gapY, String(d), { fontSize: fs, fill: color, fontFamily: 'Menlo, monospace', fontWeight: 700 });
    }
    var x1 = 40, x2 = x1 + cellW + 26, eqX = x2 + cellW + 30, resX = eqX + 44;
    var inner =
      fraction(x1, n1, d1) +
      U.svgText((x1 + x2) / 2, midY, op,
        { fontSize: fs + 4, fill: color, fontWeight: 700 }) +
      fraction(x2, n2, d2) +
      U.svgText(eqX, midY, '=', { fontSize: fs + 4, fill: color, fontWeight: 700 });
    if (opts.resultBox === false) {
      var dn = n1 * d2 + (op === '+' ? 1 : -1) * n2 * d1;
      var dd = d1 * d2;
      if (dn < 0) throw new RangeError('frac 结果为负，请调换操作数');
      var g2 = gcd(Math.abs(dn), dd); dn /= g2; dd /= g2;
      inner += fraction(resX + 10, dn, dd);
    } else {
      // 结果留白框：圆角矩形 + 问号
      var bw = fs * 2.2, bh = fs * 3.2;
      inner += U.svgRect(resX, midY - bh / 2, bw, bh, { rx: 8, fill: '#ffffff', stroke: '#c9d4e6', strokeWidth: 2, dasharray: '6 4' }) +
        U.svgText(resX + bw / 2, midY + fs * 0.36, '?', { fontSize: fs + 6, fill: RED, fontWeight: 700 });
    }
    return U.svgWrap(inner, { padding: 14 });
  }

  global.SVGCalculation = { add: add, sub: sub, mul: mul, div: div, dec: dec, frac: frac };

  // 任务7：挂载到科目化命名空间（全局旧名 SVGCalculation 保留兼容）
  global.SVGGenerators = global.SVGGenerators || {};
  global.SVGGenerators.math = global.SVGGenerators.math || {};
  global.SVGGenerators.math.calculation = global.SVGCalculation;

  if (typeof module !== 'undefined') module.exports = global.SVGCalculation;
})(typeof window !== 'undefined' ? window : global);
