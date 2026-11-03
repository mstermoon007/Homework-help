'use strict';

/**
 * shared/generator/core/distractors.js — P45-10（X3）选择题干扰项唯一派生点
 *
 * 按正确答案形态确定性派生有意义干扰项，替代「以上说法都不对 / 都不对（N）」凑位短语。
 * 纯函数、无随机、无 IO；天然三元域（> < = / 奇数 偶数 无法确定 / 方向三选一 等）
 * 无可派生形态时返回 []，调用方保留 3 项。
 */

/**
 * @param {Array<string>} pool 已去重的现有选项（必含正确项）
 * @param {string} correct 正确选项文本
 * @param {number} need 需要补足的干扰项数量
 * @returns {string[]} 至多 need 个、与正确项及 pool 均不重复的干扰项
 */
function deriveDistractors(pool, correct, need) {
  var seen = {};
  pool.forEach(function (o) { seen[String(o)] = 1; });
  var c = String(correct);
  var cands = [];
  var m, n;

  m = /^([−\-]?)(\d+)$/.exec(c);
  if (m) {
    var neg = !!m[1], mark = m[1] || '';
    var v = Number(m[2]) * (neg ? -1 : 1);
    cands = [v + 1, v - 1, v + 10, v - 10, v * 2]
      .filter(function (x) { return neg || x > 0; })
      .map(function (x) { return x < 0 ? mark + String(Math.abs(x)) : String(x); });
  } else if ((m = /^(\d+)万$/.exec(c))) {
    n = Number(m[1]);
    cands = [(n + 1) + '万', (n - 1) + '万', (n * 2) + '万'];
  } else if ((m = /^(\d+) 个十和 (\d+) 个一$/.exec(c))) {
    var t = Number(m[1]), o = Number(m[2]);
    cands = [(t + 1) + ' 个十和 ' + o + ' 个一', t + ' 个十和 ' + (o + 1) + ' 个一',
      o + ' 个十和 ' + t + ' 个一'];
  } else if ((m = /^(\d+) 和 (\d+)$/.exec(c))) {
    var a = Number(m[1]), b = Number(m[2]);
    cands = [(a + 1) + ' 和 ' + b, (a - 1) + ' 和 ' + b, a + ' 和 ' + (b + 1), a + ' 和 ' + (b - 1)];
  } else if ((m = /^(\d+)\s*([+\-−×÷])\s*(\d+)$/.exec(c))) {
    var ops = ['+', '−', '×', '÷'];
    cands = ops.filter(function (op) { return op !== m[2]; })
      .map(function (op) { return m[1] + ' ' + op + ' ' + m[3]; });
  } else if ((m = /^([a-zA-Z])\s*=\s*([a-zA-Z])\s*([+\-−×÷])\s*([a-zA-Z])$/.exec(c))) {
    var ops2 = ['×', '÷', '+', '−'];
    cands = ops2.filter(function (op) { return op !== m[3]; })
      .map(function (op) { return m[1] + ' = ' + m[2] + ' ' + op + ' ' + m[4]; });
  } else if (['个位', '十位', '百位', '千位', '万位'].indexOf(c) !== -1) {
    cands = ['个位', '十位', '百位', '千位', '万位'];
  } else {
    var UNITS = {
      '一十': ['一百', '一千'], '一百': ['一千', '一万'], '一千': ['一万', '一百'],
      '一万': ['一亿', '十亿', '一千'], '一亿': ['十亿', '一万'], '十亿': ['一百亿', '一亿']
    };
    if (UNITS[c]) cands = UNITS[c];
  }

  var out = [];
  for (var i = 0; i < cands.length && out.length < need; i++) {
    var d = String(cands[i]);
    if (d !== c && !seen[d]) { seen[d] = 1; out.push(d); }
  }
  return out;
}

module.exports = { deriveDistractors: deriveDistractors };
