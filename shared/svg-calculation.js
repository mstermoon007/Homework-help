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
  Canvas.prototype.dot = function (row, col, label) {
    this.minCol = Math.min(this.minCol, col); this.maxCol = Math.max(this.maxCol, col);
    this.rowN = Math.max(this.rowN, row + 1);
    if (this.markStyle === 'digit' && label != null) {
      this.parts.push(U.svgText(this.x(col), this.y(row), String(label),
        { fontSize: this.fs * 0.55, fill: RED, 'text-anchor': 'middle' }));
    } else {
      this.parts.push(U.svgCircle(this.x(col), this.y(row), 2.6, { fill: RED, stroke: 'none' }));
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
        c.dot(sumRow - addends.length, colIdx - 1, newCarry); // 进位点标在下一列上方
      } else if (!noCarry && newCarry > 0 && k < cols - 1) {
        c.dot(sumRow - addends.length, colIdx - 1, newCarry);
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
        if (!noBorrow) c.dot(borrowRow, endCol - k - 1, 1); // 被借位的那一位打点
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
        if (!noCarry && Math.floor(v / 10) > 0 && k > 0) c.dot(row, endCol - (Ad.length - k), Math.floor(v / 10));
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
        if (!noCarry && Math.floor(v2 / 10) > 0 && k2 > 0) c.dot(row, endCol - shift - (Ad2.length - k2), Math.floor(v2 / 10));
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

  global.SVGCalculation = { add: add, sub: sub, mul: mul, div: div };
  if (typeof module !== 'undefined') module.exports = global.SVGCalculation;
})(typeof window !== 'undefined' ? window : global);
