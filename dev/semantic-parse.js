'use strict';

/**
 * dev/semantic-parse.js — M4-R15/R16 共用的表达式解析与求值工具
 *
 * 仅对「纯数值算术题干」（如 "3 + 5 ="、"0.3 × 0.5 ="）做操作数/运算符解析与答案验证；
 * 分数（"4/5 − 1/5"）、方程（"x − 20 = 12"）、叙述题（"396 是 9 的倍数吗？"）一律判 'n/a'，
 * 避免把分母斜杠当除法、把字母/汉字当数字造成误报。
 */

var OP_SYMBOLS = { '+': '+', '−': '-', '-': '-', '×': '×', 'x': '×', '*': '×', '÷': '÷', '/': '÷' };

/** 提取题干中的算术表达式（去掉 '=' 之后、括号注释、问号） */
function extractExpression(prompt) {
  if (typeof prompt !== 'string') return null;
  var p = prompt
    .replace(/[？?]/g, '')
    .replace(/[=＝][^\n]*.*$/, '')
    .replace(/（对还是错？）|（.*？）(\s*)$/, '')
    .trim();
  return p;
}

function containsHan(s) {
  return /[\u4e00-\u9fff]/.test(s);
}

function containsLetter(s) {
  return /[a-zA-Z]/.test(s);
}

/** 分数记法：两个整数间斜杠（非小数、非除法运算符语气），如 "2/10"、"4/5" */
function isFractionNotation(expr) {
  return /(^|[^\d.])-?\d+\s*\/\s*\d+/.test(expr);
}

/** 括号算术（如 "0.4 × (5 + 4)"）：当前求值器不支持括号，判 n/a 避免误报 */
function hasParenthesis(expr) {
  return /[()（）]/.test(expr);
}

/** 是否是「纯数值算术」题干（无字母、无汉字、无分数记法） */
function isPureArithmetic(prompt) {
  var expr = extractExpression(prompt);
  if (!expr) return false;
  if (containsHan(expr) || containsLetter(expr)) return false;
  if (isFractionNotation(expr)) return false;
  return true;
}

/** 解析纯算术表达式 → { operands, operators, expr }；非纯算术返回 null */
function parseExpression(prompt) {
  if (!isPureArithmetic(prompt)) return null;
  var expr = extractExpression(prompt);
  if (!expr) return null;
  if (hasParenthesis(expr)) return null;
  var tokens = expr.match(/\d+(?:\.\d+)?|[\+\−\-\×x\*/÷\/]/g);
  if (!tokens || tokens.length === 0) return null;
  var operands = [], operators = [], numeric = 0;
  tokens.forEach(function (t) {
    if (/^-?\d+(\.\d+)?$/.test(t)) { operands.push(parseFloat(t)); numeric++; }
    else if (OP_SYMBOLS[t]) operators.push(OP_SYMBOLS[t]);
  });
  if (numeric === 0) return null;
  return { operands: operands, operators: operators, expr: expr };
}

/** 求值：先乘除后加减（从左到右）。验证用浮点除法；
 *  除法题均为可整除构造，浮点与取整一致，且不误伤小数除法。 */
function evaluate(operands, operators) {
  var vals = operands.slice(), ops = operators.slice();
  for (var i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      var r = ops[i] === '×' ? vals[i] * vals[i + 1] : (vals[i + 1] === 0 ? NaN : vals[i] / vals[i + 1]);
      vals.splice(i, 2, r); ops.splice(i, 1); i--;
    }
  }
  var acc = vals[0];
  for (i = 0; i < ops.length; i++) acc = ops[i] === '+' ? acc + vals[i + 1] : acc - vals[i + 1];
  return acc;
}

function shownValue(prompt) {
  var m = prompt.match(/=\s*(-?\d+(?:\.\d+)?)\s*[（(]/);
  if (m) return parseFloat(m[1]);
  m = prompt.match(/=\s*(-?\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

var TRUTH_MAP = { '√': true, '对': true, '正确': true, 'true': true, '×': false, '错': false, '错误': false, 'false': false };

/**
 * 答案正确性校验：
 *   true  —— 题干表达式 → 答案自洽；
 *   false —— 不一致（视为错误答案）；
 *   'n/a' —— 无法验证（分数/方程/叙述/判断命题无法自动求值）。
 */
function answerIsCorrect(q) {
  var parsed = parseExpression(q.prompt);
  if (!parsed || parsed.operators.length === 0) return 'n/a';
  var computed = evaluate(parsed.operands, parsed.operators);
  // 支持对象/标量两种答案格式（SemanticQuestion 契约：{ value, acceptable }）
  var answer = q.answer && typeof q.answer === 'object'
    ? (q.answer.value != null ? q.answer.value : '')
    : q.answer;
  var isJudge = q.prompt.indexOf('（') !== -1 || q.prompt.indexOf('对还是错') !== -1;
  if (isJudge) {
    var shown = shownValue(q.prompt);
    if (shown == null) return 'n/a';
    var truth = Math.abs(computed - shown) < 1e-9;
    if (typeof answer === 'boolean') return truth === answer;
    if (typeof answer === 'string' && answer in TRUTH_MAP) return truth === TRUTH_MAP[answer];
    return 'n/a';
  }
  var n = Number(answer);
  if (typeof answer !== 'number' && !(typeof answer === 'string' && answer.trim() !== '')) return 'n/a';
  if (!isFinite(n)) return 'n/a';
  return Math.abs(computed - n) < 1e-9;
}

module.exports = {
  OP_SYMBOLS: OP_SYMBOLS,
  extractExpression: extractExpression,
  isPureArithmetic: isPureArithmetic,
  parseExpression: parseExpression,
  evaluate: evaluate,
  shownValue: shownValue,
  answerIsCorrect: answerIsCorrect
};