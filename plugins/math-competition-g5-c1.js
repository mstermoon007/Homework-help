// @ts-check
/// <reference path="../shared/plugin-types.js" />

// plugins/math-competition-g5-c1.js — 五年级竞赛 C1 数字谜与数阵图（新语义题型）
// 实现题型（type 与知识库一致）：
//   vertical      竖式谜     加/减竖式遮数字，枚举保证唯一解
//   horizontal    横式谜     固定数字串填运算符（从左到右依次计算），唯一解
//   symbol        字母符号代表数  AA±BB 型 / 双条件图形代数
//   array-closed  封闭型数阵  三角形(1~6)/正方形(1~8) 边和相等，全局唯一补全
//   array-radial  辐射型数阵  中心+3~4条线线和相等，全局唯一补全
//   magic3        三阶幻方   1~9 幻方（洛书 8 对称态），遮格后唯一还原
//   magic4        四阶幻方初步 达雷尔幻方对称变换，完整行列/对角线定缺格；幻和概念
// （复合型数阵 g5-c1-number-array-composite 属进阶题型，暂留占位）
//
// 设计要点：谜题生成时经枚举校验「答案唯一」后才出题；数阵/幻方解空间固定，
// 解集一次性缓存复用。竖式/幻方用 rawHtml 排版。

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU || !_PU.createPlugin) throw new Error('plugins/math-competition-g5-c1.js 依赖 shared/common.js');

  function fillQ(cfg) {
    return {
      type: cfg.type,
      q: cfg.text,
      rawHtml: !!cfg.raw,
      answer: cfg.answer,
      inputType: 'multi',
      inputCount: cfg.answer.length,
      hint: cfg.hint,
      check: cfg.check,
      render: function (idx) { return _PU.renderCard(this, idx); }
    };
  }

  /** 难度 → 规模 */
  function scale(lv) {
    if (lv >= 8) return { digitsMax: 3, hideMax: 3, seqLen: 5, arrayHide: [3, 4], magicHide: [4, 6] };
    if (lv >= 5) return { digitsMax: 3, hideMax: 2, seqLen: 4, arrayHide: [2, 3], magicHide: [3, 4] };
    return { digitsMax: 2, hideMax: 1, seqLen: 4, arrayHide: [2, 2], magicHide: [2, 3] };
  }

  function randNum(len) {
    var lo = Math.pow(10, len - 1);
    return _PU.randInt(lo, lo * 10 - 1);
  }
  function setChar(s, i, ch) { return s.slice(0, i) + String(ch) + s.slice(i + 1); }

  // ============ 1. 竖式谜 ============
  function verticalUnique(rows, cells, op) {
    var n = cells.length, sols = 0;
    for (var v = 0; v < Math.pow(10, n) && sols < 2; v++) {
      var tmp = v, ok = true, strs = rows.slice();
      for (var i = 0; i < n; i++) {
        var d = tmp % 10; tmp = (tmp - d) / 10;
        if (cells[i].c === 0 && d === 0) { ok = false; break; } // 首位不为 0
        strs[cells[i].r] = setChar(strs[cells[i].r], cells[i].c, d);
      }
      if (!ok) continue;
      var x = parseInt(strs[0], 10), y = parseInt(strs[1], 10), z = parseInt(strs[2], 10);
      if ((op === '+' && x + y === z) || (op === '-' && x - y === z)) sols++;
    }
    return sols === 1;
  }

  function genVertical(sc) {
    var lenA = _PU.randInt(2, sc.digitsMax), lenB = _PU.randInt(2, sc.digitsMax);
    var isAdd = _PU.randInt(0, 1) === 0;
    if (!isAdd && lenB > lenA) { var tl = lenA; lenA = lenB; lenB = tl; } // 保证被减数不短于减数
    var a, b;
    do { a = randNum(lenA); b = randNum(lenB); } while (!isAdd && a <= b + 1);
    var c = isAdd ? a + b : a - b;
    var rows = [String(a), String(b), String(c)];
    var opCh = isAdd ? '+' : '-';
    for (var t = 0; t < 300; t++) {
      var k = _PU.randInt(1, sc.hideMax);
      var cells = [], used = {};
      while (cells.length < k) {
        var r = _PU.randInt(0, 2), col = _PU.randInt(0, rows[r].length - 1);
        var key = r + ':' + col;
        if (!used[key]) { used[key] = 1; cells.push({ r: r, c: col }); }
      }
      if (!verticalUnique(rows, cells, opCh)) continue;
      cells.sort(function (p, q) { return p.r === q.r ? p.c - q.c : p.r - q.r; });
      var answers = cells.map(function (cell) { return Number(rows[cell.r].charAt(cell.c)); });
      var disp = rows.map(function (row, ri) {
        return row.split('').map(function (ch, ci) {
          return cells.some(function (cell) { return cell.r === ri && cell.c === ci; })
            ? '<b style="color:var(--bad);">□</b>' : ch;
        }).join('');
      });
      var html = '<div style="font-family:Menlo,Consolas,monospace;font-size:17px;font-weight:800;color:var(--ink);line-height:1.8;">' +
        '<div style="padding-left:24px;">' + disp[0] + '</div>' +
        '<div><span style="display:inline-block;width:24px;text-align:center;font-weight:800;">' + opCh + '</span>' + disp[1] + '</div>' +
        '<div style="border-top:2px solid var(--ink);width:104px;margin:2px 0;"></div>' +
        '<div style="padding-left:24px;">' + disp[2] + '</div></div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">请按从上到下、从左到右的顺序依次写出 □ 中的数字。</div>';
      return fillQ({
        type: 'vertical', text: html, raw: true, answer: answers,
        hint: '逐列分析进位/退位：原式为 ' + a + ' ' + opCh + ' ' + b + ' = ' + c
      });
    }
    // 兜底：只遮第二行一个非首位数字（a、c 全可见时该数字唯一确定）
    var col0 = _PU.randInt(1, rows[1].length - 1);
    var posName = col0 === 1 ? '十位' : (col0 === 2 ? '百位' : '个位');
    return fillQ({
      type: 'vertical',
      text: '在一个' + (isAdd ? '加法' : '减法') + '竖式中，' + opCh + ' 号下面一行的数是 ' + rows[1] +
        '，它的' + posName + '上的数字被遮住了。已知这个竖式的结果是 ' + rows[2] + '，第一行的数是 ' + rows[0] +
        '。被遮住的数字是多少？',
      answer: [Number(rows[1].charAt(col0))],
      hint: '原式为 ' + a + ' ' + opCh + ' ' + b + ' = ' + c
    });
  }

  // ============ 2. 横式谜 ============
  var OPS = ['+', '-', '×', '÷'];
  function evalSeq(nums, ops) { // 从左到右依次计算，要求每步为正整数
    var v = nums[0];
    for (var i = 0; i < ops.length; i++) {
      var b = nums[i + 1];
      if (ops[i] === '÷') { if (v % b !== 0) return null; v = v / b; }
      else if (ops[i] === '×') v = v * b;
      else if (ops[i] === '+') v = v + b;
      else v = v - b;
      if (v <= 0 || v > 20000) return null;
    }
    return v;
  }
  function opCheck(userAnswers, idx) {
    function norm(s) {
      return String(s == null ? '' : s).trim()
        .replace(/[xX*＊]/g, '×').replace(/[/÷]/g, '÷')
        .replace(/[−–—ー]/g, '-').replace(/[＋]/g, '+');
    }
    for (var j = 0; j < this.answer.length; j++) {
      if (norm(userAnswers ? userAnswers[idx + ':' + j] : '') !== norm(this.answer[j])) return false;
    }
    return true;
  }
  function genHorizontal(sc) {
    for (var t = 0; t < 60; t++) {
      var n = sc.seqLen;
      var nums = [];
      for (var i = 0; i < n; i++) nums.push(_PU.randInt(1, 9));
      var byResult = {};
      var total = Math.pow(4, n - 1);
      for (var code = 0; code < total; code++) {
        var ops = [], tmp = code;
        for (var j = 0; j < n - 1; j++) { ops.push(OPS[tmp % 4]); tmp = (tmp - tmp % 4) / 4; }
        var r = evalSeq(nums, ops);
        if (r != null && r >= 2 && r <= 999) (byResult[r] = byResult[r] || []).push(ops);
      }
      var uniq = Object.keys(byResult).filter(function (k) { return byResult[k].length === 1; });
      if (!uniq.length) continue;
      var res = Number(uniq[_PU.randInt(0, uniq.length - 1)]);
      var sol = byResult[res][0];
      return fillQ({
        type: 'horizontal',
        text: '在下面各数之间填上 +、-、×、÷（从左到右依次计算），使等式成立：' +
          nums.join(' □ ') + ' = ' + res + '。请按顺序填写 ' + (n - 1) + ' 个运算符号。',
        answer: sol,
        check: opCheck,
        hint: '可行填法：' + nums.join(' ' + sol.join(' ') + ' ')
      });
    }
    return genHorizontal(scale(5));
  }

  // ============ 3. 字母符号代表数 ============
  function genSymbol() {
    var mode = _PU.randInt(0, 1);
    if (mode === 0) {
      // AA ± BB：答案按从小到大（交换 A/B 等价）
      var x = _PU.randInt(1, 9), y;
      do { y = _PU.randInt(1, 9); } while (y === x);
      var lo = Math.min(x, y), hi = Math.max(x, y);
      if (_PU.randInt(0, 1) === 0) {
        var V = 11 * (x + y);
        return fillQ({
          type: 'symbol',
          text: '已知 A、B 代表不同的数字，两位数 AA 与 BB 满足 AA + BB = ' + V + '。求 A 和 B 代表的数字。（两个数字按从小到大填写）',
          answer: [lo, hi],
          hint: 'AA + BB = 11×(A+B)，故 A+B = ' + V + ' ÷ 11 = ' + (x + y) + '，又 A≠B → {' + lo + ', ' + hi + '}'
        });
      }
      var D = 11 * (hi - lo);
      return fillQ({
        type: 'symbol',
        text: '已知 A、B 代表不同的数字，且大数减小数时 AA - BB = ' + D + '。求 A 和 B 代表的数字。（两个数字按从小到大填写）',
        answer: [lo, hi],
        hint: 'AA - BB = 11×|A-B|，故 |A-B| = ' + D + ' ÷ 11 = ' + (hi - lo) + '，结合 AA-BB>0 与差值 → {' + lo + ', ' + hi + '}'
      });
    }
    // 双条件图形代数：cx△+cy○=P，○−△=d（唯一解）
    var cx = _PU.randInt(1, 3), cy = _PU.randInt(1, 2);
    var tx, ty;
    do { tx = _PU.randInt(0, 9); ty = _PU.randInt(0, 9); } while (ty <= tx);
    var P = cx * tx + cy * ty, d = ty - tx;
    return fillQ({
      type: 'symbol',
      text: '△ 和 ○ 各代表一个 0~9 中的不同数字，满足：' +
        (cx > 1 ? '△×' + cx : '△') + ' + ' + (cy > 1 ? '○×' + cy : '○') + ' = ' + P + '，且 ○ − △ = ' + d +
        '。求 △ 和 ○ 代表的数字。（先填 △，再填 ○）',
      answer: [tx, ty],
      hint: '由 ○=△+' + d + ' 代入第一式：(' + cx + '+' + cy + ')×△=' + (P - cy * d) + '，得 △=' + tx + '，○=' + ty
    });
  }

  // ============ 4/5. 数阵图（封闭型 + 辐射型，通用引擎） ============
  // 形状定义：cells 格位（labels 供题面描述），groups 每组和相等，nums 可用数字
  var ARRAY_SHAPES = {
    tri: {
      nums: [1, 2, 3, 4, 5, 6],
      labels: ['顶点 A', '顶点 B', '顶点 C', 'AB 边中点 D', 'BC 边中点 E', 'CA 边中点 F'],
      groups: [[0, 3, 1], [1, 4, 2], [2, 5, 0]]
    },
    sq: {
      nums: [1, 2, 3, 4, 5, 6, 7, 8],
      labels: ['顶点 A', '顶点 B', '顶点 C', '顶点 D', 'AB 中点 E', 'BC 中点 F', 'CD 中点 G', 'DA 中点 H'],
      groups: [[0, 4, 1], [1, 5, 2], [2, 6, 3], [3, 7, 0]]
    },
    rad3: {
      nums: [1, 2, 3, 4, 5, 6, 7],
      labels: ['中心 O', '第 1 线内圈 a1', '第 1 线外圈 a2', '第 2 线内圈 b1', '第 2 线外圈 b2', '第 3 线内圈 c1', '第 3 线外圈 c2'],
      short: ['O', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2'],
      groups: [[0, 1, 2], [0, 3, 4], [0, 5, 6]]
    },
    rad4: {
      nums: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      labels: ['中心 O', '一线内 d1', '一线外 d2', '二线内 e1', '二线外 e2', '三线内 f1', '三线外 f2', '四线内 g1', '四线外 g2'],
      short: ['O', 'd1', 'd2', 'e1', 'e2', 'f1', 'f2', 'g1', 'g2'],
      groups: [[0, 1, 2], [0, 3, 4], [0, 5, 6], [0, 7, 8]]
    }
  };
  var _solCache = {};
  function arraySolutions(key) { // 解集缓存（数字固定，解空间不变）
    if (_solCache[key]) return _solCache[key];
    var shape = ARRAY_SHAPES[key];
    var n = shape.nums.length, sols = [], assign = [];
    function rec(idx, usedMask) {
      if (idx === n) {
        var s0 = null, ok = true;
        for (var g = 0; g < shape.groups.length; g++) {
          var s = 0, grp = shape.groups[g];
          for (var i = 0; i < grp.length; i++) s += assign[grp[i]];
          if (s0 == null) s0 = s; else if (s !== s0) { ok = false; break; }
        }
        if (ok) sols.push(assign.slice());
        return;
      }
      for (var j = 0; j < n; j++) {
        if (usedMask & (1 << j)) continue;
        assign[idx] = shape.nums[j];
        rec(idx + 1, usedMask | (1 << j));
      }
    }
    rec(0, 0);
    _solCache[key] = sols;
    return sols;
  }

  function genArray(kind, sc) {
    var sols = arraySolutions(kind);
    var shape = ARRAY_SHAPES[kind];
    var n = shape.nums.length;
    for (var t = 0; t < 200; t++) {
      var truth = sols[_PU.randInt(0, sols.length - 1)];
      var kHide = _PU.randInt(sc.arrayHide[0], sc.arrayHide[1]);
      var hidden = [], used = {};
      while (hidden.length < kHide && hidden.length < n - 1) {
        var idx = _PU.randInt(0, n - 1);
        if (!used[idx]) { used[idx] = 1; hidden.push(idx); }
      }
      hidden.sort(function (a, b) { return a - b; });
      // 全局唯一性：所有解中与可见格一致的必须只有真值这一个
      var match = sols.filter(function (s) {
        return shape.nums.every(function (_, i) {
          return used[i] || s[i] === truth[i];
        });
      });
      if (match.length !== 1) continue;
      var names = shape.short || shape.labels;
      var given = [];
      for (var i = 0; i < n; i++) if (!used[i]) given.push(names[i] + '＝' + truth[i]);
      var asks = hidden.map(function (h) { return names[h]; });
      var structDesc = kind === 'tri'
        ? '在三角形数阵中，三个顶点为 A、B、C，D、E、F 分别是 AB、BC、CA 三条边的中点圆圈，每条边上的三个数之和相等。'
        : kind === 'sq'
          ? '在正方形数阵中，四个顶点为 A、B、C、D（按顺序），E、F、G、H 分别是 AB、BC、CD、DA 四条边的中点圆圈，每条边上的三个数之和相等。'
          : kind === 'rad3'
            ? '在辐射型数阵中，中心为 O，三条线从中心出发，每条线上有内外两个圈（依次记为 a1、a2；b1、b2；c1、c2），每条线上三个数之和相等。'
            : '在辐射型数阵中，中心为 O，四条线从中心出发，每条线上有内外两个圈（依次记为 d1、d2；e1、e2；f1、f2；g1、g2），每条线上三个数之和相等。';
      return fillQ({
        type: kind === 'tri' || kind === 'sq' ? 'array-closed' : 'array-radial',
        text: structDesc + '把 ' + shape.nums[0] + '~' + shape.nums[n - 1] + ' 填入各圆圈。已知：' +
          given.join('，') + '。那么 ' + asks.join('＝____，') + '＝____。（按所问顺序填写）',
        answer: hidden.map(function (h) { return truth[h]; }),
        hint: '关键：重叠格（顶点/中心）被多条线共用。总和＋重叠数×(重复次数−1)＝线和×线数；本题完整填法唯一。'
      });
    }
    return genArray(kind, scale(5));
  }

  // ============ 6. 三阶幻方 ============
  var MAGIC3_BASE = [[8, 1, 6], [3, 5, 7], [4, 9, 2]];
  function rot90(m) {
    var n = m.length, r = [];
    for (var i = 0; i < n; i++) { r.push([]); for (var j = 0; j < n; j++) r[i].push(m[n - 1 - j][i]); }
    return r;
  }
  function mirror(m) { return m.map(function (row) { return row.slice().reverse(); }); }
  function magic3Boards() {
    var boards = [], cur = MAGIC3_BASE;
    for (var k = 0; k < 4; k++) { boards.push(cur); boards.push(mirror(cur)); cur = rot90(cur); }
    return boards.map(function (b) {
      var f = [];
      for (var i = 0; i < 3; i++) for (var j = 0; j < 3; j++) f.push(b[i][j]);
      return f;
    });
  }
  function genMagic3(sc) {
    var boards = magic3Boards();
    var N = 3, S = 15;
    for (var t = 0; t < 200; t++) {
      var board = boards[_PU.randInt(0, boards.length - 1)];
      var flat = board.slice();
      var kHide = _PU.randInt(sc.magicHide[0], sc.magicHide[1]);
      var hidden = [], used = {};
      while (hidden.length < kHide) {
        var idx = _PU.randInt(0, 8);
        if (!used[idx]) { used[idx] = 1; hidden.push(idx); }
      }
      var match = boards.filter(function (b) {
        for (var p = 0; p < 9; p++) if (!used[p] && b[p] !== flat[p]) return false;
        return true;
      });
      if (match.length !== 1) continue;
      hidden.sort(function (a, b) { return a - b; });
      var rowsHtml = '';
      for (var r = 0; r < N; r++) {
        rowsHtml += '<div style="display:flex;">';
        for (var cc = 0; cc < N; cc++) {
          var p2 = r * N + cc;
          rowsHtml += '<span style="width:44px;height:40px;border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-family:Menlo,monospace;font-size:17px;font-weight:800;color:var(--ink);">' +
            (used[p2] ? '<b style="color:var(--bad);">□</b>' : flat[p2]) + '</span>';
        }
        rowsHtml += '</div>';
      }
      var html = '<div style="display:inline-block;border:2px solid var(--ink);margin-top:4px;">' + rowsHtml + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">□ 处的数字按从上到下、从左到右的顺序填写。</div>';
      return fillQ({
        type: 'magic3', text: html, raw: true,
        answer: hidden.map(function (p) { return flat[p]; }),
        hint: '三阶幻方幻和 = 15，中心必是 5，角上是偶数，四边中间是奇数。'
      });
    }
    return genMagic3(scale(5));
  }

  // ============ 7. 四阶幻方初步 ============
  var MAGIC4_BASE = [[16, 3, 2, 13], [5, 10, 11, 8], [9, 6, 7, 12], [4, 15, 14, 1]]; // 达雷尔幻方
  function genMagic4() {
    if (_PU.randInt(0, 3) === 0) {
      // 幻和概念题
      return fillQ({
        type: 'magic4',
        text: '一个四阶幻方由 1~16 组成。它的幻和（每行、每列、每条对角线的和）是多少？',
        answer: [(1 + 16) * 16 / 2 / 4],
        hint: '幻和 = 全部数之和 ÷ 行数 = (1+…+16) ÷ 4 = 136 ÷ 4 = 34'
      });
    }
    var board = MAGIC4_BASE.slice();
    for (var k = 0, rndT = _PU.randInt(0, 3); k < rndT; k++) board = rot90(board);
    if (_PU.randInt(0, 1)) board = mirror(board);
    var lines = [];
    for (var i = 0; i < 4; i++) {
      lines.push([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]);       // 行
      lines.push([i, i + 4, i + 8, i + 12]);                       // 列
    }
    lines.push([0, 5, 10, 15]); lines.push([3, 6, 9, 12]);         // 对角线
    var flat = [];
    for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) flat.push(board[r][c]);
    for (var t = 0; t < 200; t++) {
      var kHide = _PU.randInt(2, 3), chosen = [], used = {};
      while (chosen.length < kHide) {
        var idx = _PU.randInt(0, 15);
        if (!used[idx]) { used[idx] = 1; chosen.push(idx); }
      }
      // 每个缺格必须落在一条「其余三格均可见」的线上 → 必然可确定
      var determined = chosen.every(function (cell) {
        return lines.some(function (ln) {
          return ln.indexOf(cell) >= 0 && ln.every(function (p) { return p === cell || !used[p]; });
        });
      });
      if (!determined) continue;
      chosen.sort(function (a, b) { return a - b; });
      var rowsHtml = '';
      for (var rr = 0; rr < 4; rr++) {
        rowsHtml += '<div style="display:flex;">';
        for (var cc2 = 0; cc2 < 4; cc2++) {
          var p2 = rr * 4 + cc2;
          rowsHtml += '<span style="width:42px;height:38px;border:1px solid var(--line-strong);display:flex;align-items:center;justify-content:center;font-family:Menlo,monospace;font-size:15px;font-weight:800;color:var(--ink);">' +
            (used[p2] ? '<b style="color:var(--bad);">□</b>' : flat[p2]) + '</span>';
        }
        rowsHtml += '</div>';
      }
      var html = '<div style="font-size:13px;color:var(--ink);margin-bottom:4px;">下面是四阶幻方（1~16），每行、列、对角线之和均为 34：</div>' +
        '<div style="display:inline-block;border:2px solid var(--ink);margin-top:2px;">' + rowsHtml + '</div>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:4px;">□ 处的数字按从上到下、从左到右的顺序填写。</div>';
      return fillQ({
        type: 'magic4', text: html, raw: true,
        answer: chosen.map(function (p) { return flat[p]; }),
        hint: '找穿过每个 □ 的完整行/列/对角线：34 − 另外三数之和 = 该格数字。'
      });
    }
    return genMagic4();
  }

  // ============ 生成调度 ============
  function generateQuestions(opts) {
    opts = opts || {};
    var lv = opts.difficulty || 6;
    var sc = scale(lv);
    var type = opts.type || 'mix';
    var keys = type === 'mix'
      ? ['vertical', 'horizontal', 'symbol', 'array-closed', 'array-radial', 'magic3', 'magic4']
      : [type];
    if (type === 'array-composite') keys = ['array-composite'];
    var count = opts.count || 10;
    var genMap = {
      vertical: function () { return genVertical(sc); },
      horizontal: function () { return genHorizontal(sc); },
      symbol: function () { return genSymbol(); },
      'array-closed': function () { return genArray(lv >= 8 && _PU.randInt(0, 1) === 0 ? 'sq' : 'tri', sc); },
      'array-radial': function () { return genArray(lv >= 8 && _PU.randInt(0, 1) === 0 ? 'rad4' : 'rad3', sc); },
      'array-composite': function () {
        // 复合数阵：封闭+辐射叠加，取三角形骨架加中心约束
        var sols = arraySolutions('tri');
        var shape = ARRAY_SHAPES.tri;
        for (var t = 0; t < 200; t++) {
          var truth = sols[_PU.randInt(0, sols.length - 1)];
          // 复合型额外要求中心格(顶点A)与对边中点(E)之和为定值
          var keySum = truth[0] + truth[4];
          var match = sols.filter(function (sol) {
            return sol[0] + sol[4] === keySum;
          });
          if (match.length !== 1) continue;
          // 遮住 A 和 E
          var hid = [0, 4];
          var given = [];
          for (var i2 = 0; i2 < 6; i2++) if (!hid.includes(i2)) given.push(shape.labels[i2] + '＝' + truth[i2]);
          return fillQ({
            type: 'array-composite',
            text: '在三角形数阵中，三个顶点为 A、B、C，D、E、F 分别是 AB、BC、CA 三条边的' +
              '中点圆圈，每条边上三个数之和相等。此外还要求：顶点 A 与中点 E 的和等于一个固定值。' +
              '把 1~6 填入。已知：' + given.join('，') + '。那么 A＝____，E＝____。',
            answer: [truth[0], truth[4]],
            hint: '先按封闭型方法确定各数，再验证 A＋E 的附加条件筛选唯一解。'
          });
        }
        return genArray('tri', sc);
      },
      magic3: function () { return genMagic3(sc); },
      magic4: function () { return genMagic4(); }
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

  // ============ 注册 ============
  var plugin = _PU.createPlugin({
    id: 'math-competition-g5-c1',
    name: '数字谜与数阵图（五年级）',
    subject: 'math',
    category: 'number',
    grades: [5],
    moduleId: 'C1',
    knowledgePoints: {
      5: ['g5-c1-digit-puzzle-vertical', 'g5-c1-digit-puzzle-horizontal', 'g5-c1-digit-puzzle-symbol',
        'g5-c1-number-array-closed', 'g5-c1-number-array-radial', 'g5-c1-magic-square-3', 'g5-c1-magic-square-4']
    },
    columns: 1,
    settings: [
      { key: 'type', label: '题型', options: [
        { value: 'mix',           label: '综合' },
        { value: 'vertical',      label: '竖式谜' },
        { value: 'horizontal',    label: '横式谜' },
        { value: 'symbol',        label: '字母符号代表数' },
        { value: 'array-closed',  label: '封闭型数阵' },
        { value: 'array-radial',  label: '辐射型数阵' },
        { value: 'array-composite', label: '复合型数阵' },
        { value: 'magic3',        label: '三阶幻方' },
        { value: 'magic4',        label: '四阶幻方初步' }
      ] }
    ],
    generateQuestions: generateQuestions,
    meta: function (opts) {
      return { grade: 5, count: (opts && opts.count) || 10, columns: 1, title: '数字谜与数阵图（五年级）' };
    }
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined') module.exports = plugin;
  global[plugin.id] = plugin;

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
