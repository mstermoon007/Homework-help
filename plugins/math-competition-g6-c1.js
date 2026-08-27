// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g6-c1.js — 六年级竞赛 C1 数字谜与数阵图深化（新语义题型）
// 实现题型（type 与知识库一致，全部唯一解保证）：
//   vertical-multi   多位数竖式数字谜（乘法/加法遮格，枚举验证唯一）
//   carry-complex    复杂进位竖式谜（强制连续进位链构造 + 唯一性校验）
//   horizontal       横式数字谜（5 数填运算符，唯一解筛选）
//   symbol           符号代表数（AA±BB / 双条件图形代数）
//   magic-adv        幻方进阶（四阶缺格补全 / 三阶中心性质 / 幻和反求）
//   array-adv        九宫格行列等和数阵（半幻方，全局唯一补全）
//   digit-reason     数字推理综合（□中段□ 被整除，两端数字推理）
//   competition      竞赛级综合（数字和+余数双条件最值）

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g6-c1.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type, q: cfg.text, rawHtml: !!cfg.raw, svg: cfg.svg || '',
      answer: cfg.answer, inputType: 'multi', inputCount: cfg.answer.length,
      hint: cfg.hint, check: cfg.check,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  // ============ 通用工具 ============
  function setChar(s, i, ch) { return s.slice(0, i) + String(ch) + s.slice(i + 1); }
  /** 全角运算符归一化：接受键盘 ASCII 输入 */
  function normOp(s) {
    return String(s == null ? '' : s).trim()
      .replace(/[＋+]/g, '＋').replace(/[－–—-]/g, '－')
      .replace(/[xX*＊]/g, '×').replace(/[÷/／]/g, '÷');
  }
  function opCheck(userAnswers, idx) {
    for (var j = 0; j < this.answer.length; j++)
      if (normOp(userAnswers ? userAnswers[idx + ':' + j] : '') !== normOp(this.answer[j])) return false;
    return true;
  }
  /** 四则运算优先级求值（与 dev/verify-competition.js 的 evalOps 一致） */
  function evalPre(nums, ops) {
    var v = nums.slice(), o = ops.slice();
    var i = 0;
    while (i < o.length) {
      if (o[i] === '×' || o[i] === '÷') {
        var x = v[i], y = v[i + 1];
        if (o[i] === '÷') { if (y === 0 || x % y !== 0) return null; v.splice(i, 2, x / y); }
        else v.splice(i, 2, x * y);
        o.splice(i, 1);
      } else i++;
    }
    var acc = v[0];
    for (var j = 0; j < o.length; j++) {
      acc = o[j] === '＋' ? acc + v[j + 1] : acc - v[j + 1];
      if (acc < 0 || !Number.isInteger(acc)) return null;
    }
    return acc;
  }

  // ============ 1. 多位数竖式数字谜 ============
  function setChar(s, i, ch) { return s.slice(0, i) + String(ch) + s.slice(i + 1); }
  function verticalUnique(rows, cells, op) {
    var n = cells.length, sols = 0;
    for (var v = 0; v < Math.pow(10, n) && sols < 2; v++) {
      var tmp = v, ok = true, strs = rows.slice();
      for (var i = 0; i < n; i++) {
        var d = tmp % 10; tmp = (tmp - d) / 10;
        if (cells[i].c === 0 && d === 0 && rows[cells[i].r].length > 1) { ok = false; break; }
        strs[cells[i].r] = setChar(strs[cells[i].r], cells[i].c, d);
      }
      if (!ok) continue;
      var x = parseInt(strs[0], 10), y = parseInt(strs[1], 10), z = parseInt(strs[2], 10);
      if ((op === '+' && x + y === z) || (op === '-' && x - y === z) || (op === '×' && x * y === z)) sols++;
    }
    return sols === 1;
  }
  function dispVertical(rows, cells, opCh) {
    function row(r) {
      return rows[r].split('').map(function (ch, ci) {
        var masked = cells.some(function (c) { return c.r === r && c.c === ci; });
        return masked ? '<b style="color:var(--bad);">□</b>' : ch;
      }).join('');
    }
    return '<div style="font-family:Menlo,Consolas,monospace;font-size:17px;font-weight:800;color:var(--ink);line-height:1.8;">' +
      '<div style="padding-left:26px;">' + row(0) + '</div>' +
      '<div><span style="display:inline-block;width:26px;text-align:center;">' + opCh + '</span>' + row(1) + '</div>' +
      '<div style="border-top:2px solid var(--ink);width:' + (26 + rows[2].length * 15) + 'px;margin:2px 0;"></div>' +
      '<div style="padding-left:26px;">' + row(2) + '</div></div>' +
      '<div style="font-size:12px;color:var(--muted);margin-top:4px;">请按从上到下、从左到右的顺序依次写出 □ 中的数字。</div>';
  }
  function genVerticalMulti() {
    for (var t = 0; t < 300; t++) {
      var isMul = _PU.randInt(0, 1) === 0;
      var a, b;
      if (isMul) { a = _PU.randInt(102, 998); b = _PU.randInt(3, 9); }
      else { a = _PU.randInt(1000, 9999); b = _PU.randInt(1000, 9999); }
      var cc = isMul ? a * b : a + b;
      var rows = [String(a), String(b), String(cc)];
      var kMask = isMul ? 2 : 3;
      var cells = [], used = {};
      while (cells.length < kMask) {
        var r = _PU.randInt(0, 2), col = _PU.randInt(0, rows[r].length - 1);
        var key = r + ':' + col;
        if (!used[key]) { used[key] = 1; cells.push({ r: r, c: col }); }
      }
      if (!verticalUnique(rows, cells, isMul ? '×' : '+')) continue;
      cells.sort(function (p, q) { return p.r === q.r ? p.c - q.c : p.r - q.r; });
      var answers = cells.map(function (cell) { return Number(rows[cell.r].charAt(cell.c)); });
      return fillQ({
        type: 'vertical-multi', text: dispVertical(rows, cells, isMul ? '×' : '+'), raw: true,
        answer: answers,
        hint: '逐位分析' + (isMul ? '乘积与进位' : '进位') + '：完整算式为 ' + a + ' ' + (isMul ? '×' : '+') + ' ' + b + ' = ' + cc
      });
    }
    return genVerticalMulti();
  }

  // ============ 2. 复杂进位竖式谜 ============
  function carryCount(a, b) { // 加法连续进位次数
    var sa = String(a), sb = String(b), off = sa.length - sb.length, carry = 0, n = 0;
    for (var i = sa.length - 1; i >= 0; i--) {
      var s = Number(sa.charAt(i)) + (i - off >= 0 ? Number(sb.charAt(i - off)) : 0) + carry;
      carry = s >= 10 ? 1 : 0; n += carry;
    }
    return n;
  }
  function genCarryComplex() {
    for (var t = 0; t < 500; t++) {
      var len = _PU.randInt(3, 4);
      var a = _PU.randInt(Math.pow(10, len - 1), Math.pow(10, len) - 1);
      var b = _PU.randInt(Math.pow(10, len - 1), Math.pow(10, len) - 1);
      if (carryCount(a, b) < 2) continue; // 至少连续两级涉及进位
      var cc = a + b;
      var rows = [String(a), String(b), String(cc)];
      var cells = [], used = {};
      while (cells.length < 2) {
        var r = _PU.randInt(0, 1), col = _PU.randInt(0, rows[r].length - 1);
        var key = r + ':' + col;
        if (!used[key]) { used[key] = 1; cells.push({ r: r, c: col }); }
      }
      if (!verticalUnique(rows, cells, '+')) continue;
      cells.sort(function (p, q) { return p.r === q.r ? p.c - q.c : p.r - q.r; });
      var answers = cells.map(function (cell) { return Number(rows[cell.r].charAt(cell.c)); });
      return fillQ({
        type: 'carry-complex', text: dispVertical(rows, cells, '+'), raw: true, answer: answers,
        hint: '本题存在连续进位：完整算式为 ' + a + ' + ' + b + ' = ' + cc
      });
    }
    return genCarryComplex();
  }

  // ============ 3. 横式数字谜 ============
  var OPS = ['+', '-', '×', '÷'];
  var OPS = ['＋', '－', '×', '÷'];
  function genHorizontal() {
    for (var t = 0; t < 120; t++) {
      var nums = [];
      for (var i = 0; i < 5; i++) nums.push(_PU.randInt(2, 9));
      var byResult = {};
      for (var code = 0; code < 256; code++) {
        var ops = [], tmp = code;
        for (var j = 0; j < 4; j++) { ops.push(OPS[tmp % 4]); tmp = (tmp - tmp % 4) / 4; }
        var r = evalPre(nums, ops);
        if (r != null && r >= 2 && r <= 999) (byResult[r] = byResult[r] || []).push(ops);
      }
      var uniqKeys = Object.keys(byResult).filter(function (k) { return byResult[k].length === 1; });
      if (!uniqKeys.length) continue;
      var res = Number(uniqKeys[_PU.randInt(0, uniqKeys.length - 1)]);
      var sol = byResult[res][0];
      return fillQ({
        type: 'horizontal',
        svg: nums.join(' □ ') + ' ＝ ' + res,
        text: '在下面各数之间填上 ＋、－、×、÷（先乘除，后加减），使等式成立。请按顺序填写 4 个运算符号。',
        answer: sol, check: opCheck,
        hint: '可行填法：' + nums.join(' ' + sol.join(' ') + ' ')
      });
    }
    return genHorizontal();
  }

  // ============ 4. 符号代表数 ============
  function genSymbol() {
    // 双条件图形代数：cx△＋cy○＝P，○−△＝d（△∈1..9，唯一解）
    for (var tt = 0; tt < 300; tt++) {
      var cx = _PU.randInt(2, 4), cy = _PU.randInt(1, 3);
      var tx = _PU.randInt(1, 9), ty = _PU.randInt(1, 9);
      if (ty <= tx) continue;
      var Pv = cx * tx + cy * ty, dv = ty - tx;
      var cnt = 0;
      for (var xx = 1; xx <= 9 && cnt < 2; xx++) {
        for (var yy = 0; yy <= 9; yy++) {
          if (yy === xx) continue;
          if (cx * xx + cy * yy === Pv && yy - xx === dv) cnt++;
        }
      }
      if (cnt !== 1) continue;
      return fillQ({
        type: 'symbol',
        svg: '△×' + cx + ' ＋ ○×' + cy + ' ＝ ' + Pv + '<br>○ － △ ＝ ' + dv,
        text: '△×' + cx + '＋○×' + cy + '＝' + Pv + '，○－△＝' + dv + '。求 △ 和 ○。（先填 △）',
        answer: [tx, ty],
        hint: '代入 ○＝△+' + dv + '：(' + (cx + cy) + ')×△＝' + (Pv - cy * dv) + '，得 △＝' + tx + '，○＝' + ty
      });
    }
    return genSymbol();
  }

  // ============ 5. 幻方进阶 ============
  var M4 = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]];
  function rot90(m) {
    var n = m.length, r = [];
    for (var i = 0; i < n; i++) { r.push([]); for (var j = 0; j < n; j++) r[i].push(m[n - 1 - j][i]); }
    return r;
  }
  function mirror(m) { return m.map(function (row) { return row.slice().reverse(); }); }
  function flatten(m) {
    var f = []; for (var i = 0; i < m.length; i++) for (var j = 0; j < m[i].length; j++) f.push(m[i][j]);
    return f;
  }
  function genMagicAdv() {
    var mode = _PU.randInt(0, 2);
    if (mode === 0) {
      // 三阶变式：已知幻和反求中心
      var S3 = _PU.randInt(12, 40) * 3;
      return fillQ({
        type: 'magic-adv',
        text: '一个三阶幻方的幻和是 ' + S3 + '。它正中心的数是多少？（提示：幻和 = 3 × 中心数）',
        answer: [S3 / 3],
        hint: '三阶幻方中，过中心的行、列、对角线共 4 条，其和恰为全方格和 → 中心 = 幻和 ÷ 3 = ' + (S3 / 3)
      });
    }
    var board = M4;
    var k = _PU.randInt(0, 3);
    while (k-- > 0) board = rot90(board);
    if (_PU.randInt(0, 1)) board = mirror(board);
    var flat = flatten(board), N = 4, SUM = 34;
    if (mode === 1) {
      // 四阶幻和概念
      return fillQ({
        type: 'magic-adv',
        text: '一个四阶幻方由 1~16 组成。它的幻和是多少？',
        answer: [(1 + 16) * 16 / 2 / 4],
        hint: '(1＋…＋16)÷4 = 136÷4 = 34'
      });
    }
    var lines = [];
    for (var ii = 0; ii < N; ii++) {
      lines.push([ii * N, ii * N + 1, ii * N + 2, ii * N + 3]);
      lines.push([ii, ii + N, ii + 2 * N, ii + 3 * N]);
    }
    lines.push([0, N + 1, 2 * N + 2, 3 * N + 3]);
    lines.push([N - 1, 2 * N - 2, 3 * N - 3, 3 * N]);
    for (var t = 0; t < 300; t++) {
      var chosen = [], used = {};
      while (chosen.length < 3) {
        var idxx = _PU.randInt(0, 15);
        if (!used[idxx]) { used[idxx] = 1; chosen.push(idxx); }
      }
      var det = chosen.every(function (cell) {
        return lines.some(function (ln) {
          return ln.indexOf(cell) >= 0 && ln.every(function (p) { return p === cell || !used[p]; });
        });
      });
      if (!det) continue;
      chosen.sort(function (x, y) { return x - y; });
      var html = '';
      for (var rr = 0; rr < N; rr++) {
        html += '<div style="display:flex;">';
        for (var cc2 = 0; cc2 < N; cc2++) {
          var p2 = rr * N + cc2;
          html += '<span style="width:42px;height:38px;border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-family:Menlo,monospace;font-size:15px;font-weight:800;color:var(--ink);">' +
            (used[p2] ? '<b style="color:var(--bad);">□</b>' : flat[p2]) + '</span>';
        }
        html += '</div>';
      }
      return fillQ({
        type: 'magic-adv', text:
          '<div style="font-size:13px;color:var(--ink);margin-bottom:4px;">四阶幻方（1~16），每行、每列、每条对角线之和均为 34：</div>' +
          '<div style="display:inline-block;border:2px solid var(--ink);margin-top:2px;">' + html + '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-top:4px;">□ 处的数字按从上到下、从左到右的顺序填写。</div>',
        raw: true,
        answer: chosen.map(function (p) { return flat[p]; }),
        hint: '找穿过每个 □ 的完整行/列/对角线：34 − 另外三数之和 = 该格数字。'
      });
    }
    return genMagicAdv();
  }

  // ============ 6. 数阵图进阶（九宫格行列等和·半幻方） ============
  var _semiCache = null;
  function semiMagicSolutions() {
    if (_semiCache) return _semiCache;
    var nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    var sols = [], assign = [];
    function rec(idx, used) {
      if (idx === 9) {
        var r0 = assign[0] + assign[1] + assign[2], ok = true;
        for (var g = 1; g < 6 && ok; g++) {
          var base = g < 3 ? g * 3 : (g % 3), step = g < 3 ? 1 : 3;
          var s2 = 0;
          for (var i = 0; i < 3; i++) s2 += assign[g < 3 ? base + i : base + i * 3];
          if (s2 !== r0) ok = false;
        }
        if (ok) sols.push(assign.slice());
        return;
      }
      for (var jj = 0; jj < 9; jj++) {
        if (used & (1 << jj)) continue;
        assign[idx] = nums[jj];
        rec(idx + 1, used | (1 << jj));
      }
    }
    rec(0, 0);
    _semiCache = sols;
    return sols;
  }
  function genArrayAdv() {
    var sols = semiMagicSolutions(); // 每行列等和
    for (var t = 0; t < 400; t++) {
      var truth = sols[_PU.randInt(0, sols.length - 1)];
      var hidden = [], used = {};
      var kHide = _PU.randInt(3, 5);
      while (hidden.length < kHide) {
        var idx = _PU.randInt(0, 8);
        if (!used[idx]) { used[idx] = 1; hidden.push(idx); }
      }
      hidden.sort(function (a, b) { return a - b; });
      var match = sols.filter(function (s) {
        for (var p = 0; p < 9; p++) if (!used[p] && s[p] !== truth[p]) return false;
        return true;
      });
      if (match.length !== 1) continue;
      hidden.sort(function (a, b) { return a - b; });
      var names = ['r1c1', 'r1c2', 'r1c3', 'r2c1', 'r2c2', 'r2c3', 'r3c1', 'r3c2', 'r3c3'];
      var given = [];
      for (var i = 0; i < 9; i++) if (!used[i]) given.push('第' + (Math.floor(i / 3) + 1) + '行第' + (i % 3 + 1) + '格＝' + truth[i]);
      return fillQ({
        type: 'array-adv',
        text: '把 1~9 填入九宫格（每格一个，不重复），使每行、每列三个数之和都相等。已知：' +
          given.join('，') + '。那么被遮住的格子（按从上到下、从左到右的顺序）依次是 ____。',
        answer: hidden.map(function (h) { return truth[h]; }),
        hint: '先由已给整行/整列确定等和值 S，再用 S 减出各空格；本题满足条件的填法唯一。'
      });
    }
    return genArrayAdv();
  }

  // ============ 7. 数字推理综合 ============
  function genDigitReason() {
    var mids = ['199', '28', '37', '456', '73', '81', '52', '64'];
    var divis = [45, 36, 54, 72, 24];
    for (var t = 0; t < 300; t++) {
      var mid = mids[_PU.randInt(0, mids.length - 1)];
      var div = divis[_PU.randInt(0, divis.length - 1)];
      var sols = [];
      for (var first = 1; first <= 9; first++) {
        for (var last = 0; last <= 9; last++) {
          var n = Number(first + mid + last);
          if (n % div === 0) sols.push([first, last, n]);
        }
      }
      if (!sols.length) continue;
      if (_PU.randInt(0, 1) === 0 || sols.length === 1) {
        var so = sols[0]; // 最小的一组
        return fillQ({
          type: 'digit-reason',
          text: '五位数 □' + mid + '□ 能被 ' + div + ' 整除，满足条件的最小数是 ' + so[2] +
            '。求两端被遮住的数字。（先填万位，再填个位）',
          answer: [so[0], so[1]],
          hint: div + ' 的整除特征定末位与数字和：' + so[2] + ' ✓（共 ' + sols.length + ' 组解，取最小）'
        });
      }
      // 多解：问最大/最小的完整数
      var askMax = _PU.randInt(0, 1) === 0;
      var target = askMax ? sols[sols.length - 1][2] : sols[0][2];
      return fillQ({
        type: 'digit-reason',
        text: '在形如 □' + mid + '□ 的五位数中，能被 ' + div + ' 整除的共有 ' + sols.length +
          ' 个。其中' + (askMax ? '最大' : '最小') + '的是 ____。',
        answer: [target],
        hint: '枚举两端组合（≤90 种），能被 ' + div + ' 整除的有 ' + sols.length +
          ' 个：' + sols.map(function (x) { return x[2]; }).join('、') + ' → 取' + (askMax ? '最大' : '最小')
      });
    }
    return genDigitReason();
  }

  // ============ 8. 竞赛级数字谜综合 ============
  function genCompetition() {
    for (var t = 0; t < 60; t++) {
      var D = [7, 11, 13][_PU.randInt(0, 2)], R = _PU.randInt(1, D - 1);
      var askMax = _PU.randInt(0, 1) === 0;
      var found = null;
      if (askMax) {
        for (var n = 999999; n >= 100000; n--) if (n % D === R) { found = n; break; }
      } else {
        for (var m = 100000; m <= 999999; m++) if (m % D === R) { found = m; break; }
      }
      if (found == null) continue;
      return fillQ({
        type: 'competition',
        text: '在所有六位数中，除以 ' + D + ' 余 ' + R + ' 的数里，' + (askMax ? '最大' : '最小') + '的是 ____。',
        answer: [found],
        hint: '999999 ÷ ' + D + ' 的余数为锚点：沿六位数范围按周期 ' + D + ' 移动到首个余 ' + R + ' 的数即 ' + found +
          '（下一个相差 ±' + D + '）'
      });
    }
    return genCompetition();
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['vertical-multi', 'carry-complex', 'horizontal', 'symbol', 'magic-adv', 'array-adv', 'digit-reason', 'competition']
      : [type];
    var count = opts.count || 10;
    var genMap = {
      'vertical-multi': genVerticalMulti, 'carry-complex': genCarryComplex,
      horizontal: genHorizontal, symbol: genSymbol, 'magic-adv': genMagicAdv,
      'array-adv': genArrayAdv, 'digit-reason': genDigitReason, competition: genCompetition
    };
    var questions = [], seen = {}, MAXTRY = count * 30;
    for (var i = 0; i < count; i++) {
      var key = keys[i % keys.length];
      var q = null;
      for (var tries = 0; tries < MAXTRY; tries++) {
        q = genMap[key]();
        if (q && !seen[q.q]) break;
      }
      if (q) { seen[q.q] = true; questions.push(q); }
    }
    return questions;
  }

  var plugin = _PU.createPlugin({
    id: 'math-competition-g6-c1',
    name: '数字谜与数阵图（六年级）',
    subject: 'math',
    category: 'number',
    grades: [6],
    moduleId: 'C1',
    knowledgePoints: {
      6: ['math-g6-c1-vertical-multidigit', 'math-g6-c1-vertical-carry-complex', 'math-g6-c1-horizontal-puzzle',
        'math-g6-c1-symbol-number', 'math-g6-c1-magic-square-adv', 'math-g6-c1-number-array',
        'math-g6-c1-digit-reasoning', 'math-g6-c1-number-puzzle-competition']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',                label: '综合' },
        { value: 'vertical-multi',     label: '多位数竖式谜' },
        { value: 'carry-complex',      label: '复杂进位竖式' },
        { value: 'horizontal',         label: '横式数字谜' },
        { value: 'symbol',             label: '符号代表数' },
        { value: 'magic-adv',          label: '幻方进阶' },
        { value: 'array-adv',          label: '数阵图进阶' },
        { value: 'digit-reason',       label: '数字推理综合' },
        { value: 'competition',        label: '竞赛级综合' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 6, count: (opts && opts.count) || 10, columns: 1, title: '数字谜与数阵图（六年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
