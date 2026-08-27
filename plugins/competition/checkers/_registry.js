'use strict';
/* plugins/competition/checkers/_registry.js — 题型求解器注册表（避免 index ↔ 各模块循环依赖） */

var registry = {};

function register(type, fn) {
  if (typeof fn === 'function') registry[type] = fn;
}

function solve(question) {
  var type = question && question.type;
  var fn = registry[type];
  if (!fn) return { problems: ['未注册的题型: ' + type] };
  var r;
  try { r = fn(question); }
  catch (e) { return { problems: ['求解器异常: ' + ((e && e.message) || e)] }; }
  if (!r) return { problems: ['求解器未返回结果'] };
  if (r.problems && r.problems.length) return { problems: r.problems };
  if (!('expected' in r)) return { problems: ['求解器未返回 expected'] };
  return r;
}

/** 把任意答案规范化为可比较的数组 */
function norm(v) {
  var arr = Array.isArray(v) ? v : [v];
  return arr.map(function (x) {
    if (typeof x === 'number') return x;
    return String(x == null ? '' : x).trim();
  });
}
function same(a, b) {
  if (a === b) return true;
  var na = Number(a), nb = Number(b);
  if (!isNaN(na) && !isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na === nb;
  return false;
}

/**
 * 统一检查接口（任务04核心接口）
 * @param {Object} question 题目对象 {type, q, svg, answer, ...}
 * @param {*} answer 待验证答案（数组或单值）
 * @returns {{correct: boolean, expected: any, reason: string}}
 */
function check(question, answer) {
  var r = solve(question);
  if (r.problems && r.problems.length) {
    return { correct: false, expected: null, reason: r.problems[0] };
  }
  var exp = norm(r.expected);
  var got = norm(answer);
  if (got.length !== exp.length) {
    return { correct: false, expected: r.expected, reason: '答案字段数不符：应为 ' + exp.length + ' 个，实为 ' + got.length + ' 个' };
  }
  for (var i = 0; i < exp.length; i++) {
    if (!same(exp[i], got[i])) {
      return { correct: false, expected: r.expected, reason: '第 ' + (i + 1) + ' 空不符：独立求解应为「' + exp[i] + '」，实际「' + got[i] + '」' };
    }
  }
  return { correct: true, expected: r.expected, reason: '答案与独立求解结果一致' };
}

function types() { return Object.keys(registry); }
function has(type) { return Object.prototype.hasOwnProperty.call(registry, type); }

module.exports = {
  register: register,
  solve: solve,
  check: check,
  types: types,
  has: has
};
