/**
 * shared/generator/core/arithmetic-core.js — M4-R06 核心算术抽取件
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成。
 * 纯函数，不读 DOM、不生成 HTML/SVG、不解释全局难度（全部来自约束参数）。
 */
'use strict';

var Rng = require('./rng.js');

var OP_ADD = '+', OP_SUB = '−', OP_MUL = '×', OP_DIV = '÷';

function normalizeOperation(op) {
  var m = { add: 'add', addition: 'add', sub: 'sub', subtraction: 'sub',
    mult: 'mult', mul: 'mult', multiplication: 'mult',
    div: 'div', division: 'div', mixed: 'mixed' };
  return m[op] || 'mixed';
}

function defaultOperators(op, allowMultDiv) {
  if (op === 'add') return [OP_ADD];
  if (op === 'sub') return [OP_SUB];
  if (op === 'mult') return [OP_MUL];
  if (op === 'div') return [OP_DIV];
  return allowMultDiv ? [OP_ADD, OP_SUB, OP_MUL, OP_DIV] : [OP_ADD, OP_SUB];
}

/**
 * 操作数生成 + 结构生成（由 QuestionPlan 约束驱动，不解释难度）。
 * @param {function} rng 种子随机源
 * @param {Object} cfg { operation, numberRange:{min,max}, maxSteps, allowBracket, allowMultDiv, noNegative,
 *                       exactSteps, operationSet }
 *
 * M4-R17：支持 KP 级语义约束
 *   - cfg.operationSet —— 数组，限制算符池（如 ['+','−']；默认由 operation/allowMultDiv 推导）
 *   - cfg.exactSteps   —— 精确步数（固定为 1 而非按 maxSteps 随机 1..n）
 */
function generateStructure(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = normalizeOperation(cfg.operation);
  var noNegative = cfg.noNegative !== false;

  var steps = cfg.exactSteps != null && cfg.exactSteps >= 1
    ? cfg.exactSteps
    : (cfg.maxSteps != null && cfg.maxSteps > 1
      ? Rng.randInt(rng, 1, Math.min(cfg.maxSteps, 3))
      : 1);

  var maxForMult = Math.min(max, 20);

  // 算符池：KP 语义 operationSet 优先；否则按 operation/allowMultDiv 推导
  var opPool = Array.isArray(cfg.operationSet) && cfg.operationSet.length
    ? cfg.operationSet.slice()
    : defaultOperators(op, cfg.allowMultDiv);

  // 运算符链：×/÷ 之后不再接 ×/÷（避免连续乘除的整除性耦合）
  var operators = [];
  for (var i = 0; i < steps; i++) {
    var prev = operators[i - 1];
    var pool = (prev === OP_MUL || prev === OP_DIV)
      ? [OP_ADD, OP_SUB]
      : opPool;
    operators.push(Rng.pick(rng, pool));
  }

  // 操作数：先随机，再按运算符约束修正（减法非负 / 除法可整除）
  var operands = [];
  for (i = 0; i <= steps; i++) {
    operands.push(Rng.randInt(rng, min, max));
  }
  for (i = 0; i < steps; i++) {
    // 减法交换仅在“未被前一乘/除步骤固定操作数槽位”时安全：
    // 若前一运算符是 ×/÷，operands[i+1] 已被固定为除数/因子，交换会破坏整除性/因子上限。
    var subSwapSafe = operands[i + 1] > operands[i] &&
      (i === 0 || (operators[i - 1] !== OP_MUL && operators[i - 1] !== OP_DIV));
    if (operators[i] === OP_SUB && noNegative && subSwapSafe) {
      var tmp = operands[i + 1];
      operands[i + 1] = operands[i];
      operands[i] = tmp;
    } else if (operators[i] === OP_DIV) {
      // 被除数 = 商 × 除数（先定除数再定被除数，保证整除且被除数 ≤ max）
      var divisor = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      var maxQuotient = Math.max(1, Math.floor(max / divisor));
      var quotient = Rng.randInt(rng, 1, Math.min(Math.min(maxForMult, 9), maxQuotient));
      operands[i + 1] = divisor;
      operands[i] = divisor * quotient;
    } else if (operators[i] === OP_MUL) {
      operands[i] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
      operands[i + 1] = Rng.randInt(rng, 1, Math.min(maxForMult, 9));
    }
  }

  // 链式非负校验：保证每一步中间结果 >= 0（小学口算约束）
  // 注意：若后继运算符是 ×/÷，operands[i+1] 是其后被除数/因子，不可下调（否则破坏整除性）。
  if (noNegative) {
    for (i = 0; i < steps; i++) {
      if (operators[i] !== OP_SUB) continue;
      var prefix = calculateAnswer(operands.slice(0, i + 1), operators.slice(0, i));
      var partial = prefix - operands[i + 1];
      var nextLocked = i + 1 < steps && (operators[i + 1] === OP_DIV || operators[i + 1] === OP_MUL);
      if (partial < 0) {
        if (prefix >= min && !nextLocked) {
          operands[i + 1] = Rng.randInt(rng, Math.max(1, min), Math.max(min, prefix));
        } else {
          operators[i] = OP_ADD;
        }
      }
    }
  }

  return { operands: operands, operators: operators, steps: steps };
}

/** 答案计算：先乘除后加减（从左到右） */
function calculateAnswer(operands, operators) {
  var vals = operands.slice();
  var ops = operators.slice();

  for (var i = 0; i < ops.length; i++) {
    if (ops[i] === OP_MUL || ops[i] === OP_DIV) {
      var r = apply(ops[i], vals[i], vals[i + 1]);
      vals.splice(i, 2, r);
      ops.splice(i, 1);
      i--;
    }
  }
  var acc = vals[0];
  for (i = 0; i < ops.length; i++) {
    acc = apply(ops[i], acc, vals[i + 1]);
  }
  return acc;
}

function apply(op, a, b) {
  if (op === OP_ADD) return a + b;
  if (op === OP_SUB) return a - b;
  if (op === OP_MUL) return a * b;
  if (op === OP_DIV) return b === 0 ? a : Math.floor(a / b);
  return a;
}

function formatExpression(operands, operators) {
  var s = String(operands[0]);
  for (var i = 0; i < operators.length; i++) {
    s += ' ' + operators[i] + ' ' + operands[i + 1];
  }
  return s;
}

/** 干扰项生成：答案附近 ±1..±3 的唯一值 */
function generateDistractors(rng, answer, count, range) {
  var dist = [];
  var guard = 0;
  while (dist.length < count && guard < 40) {
    guard++;
    var delta = Rng.randInt(rng, 1, 3) * (Rng.pick(rng, [-1, 1]));
    var v = answer + delta;
    if (range && (v < range.min || v > range.max)) continue;
    if (v === answer || dist.indexOf(v) !== -1) continue;
    dist.push(v);
  }
  return dist;
}

/** 解析题干中的操作数与运算符（支持最多 4 个操作数 / 3 步，供语义等价 Gate 复核答案） */
function parseExpression(text) {
  var m = String(text).match(/(-?\d+(?:\.\d+)?)\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?)(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?(?:\s*([+\-−×÷])\s*(-?\d+(?:\.\d+)?))?/);
  if (!m) return null;
  var operands = [Number(m[1]), Number(m[3])];
  var operators = [m[2] === '-' ? OP_SUB : m[2]];
  if (m[4]) {
    operators.push(m[4] === '-' ? OP_SUB : m[4]);
    operands.push(Number(m[5]));
  }
  if (m[6]) {
    operators.push(m[6] === '-' ? OP_SUB : m[6]);
    operands.push(Number(m[7]));
  }
  return { operands: operands, operators: operators };
}

// ─── M4-R18 括号结构 ────────────────────────────────────────────────────────────

/**
 * 有括号两步运算：(a op1 b) op2 c
 *   op1 ∈ [+,-]（括号内），op2 ∈ [×,÷]（括号外）
 *   保证：op2 为 ÷ 时 (a op1 b) 可整除 op2 操作数；noNegative 时 (a op1 b) >= 0
 * @returns {{ operands: [a,b,c], operators: [op1,op2], answer: number }}
 */
function buildBracket(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var noNegative = cfg.noNegative !== false;
  var OP_INSIDE = [OP_ADD, OP_SUB];
  var OP_OUTSIDE = [OP_MUL, OP_DIV];

  var guard = 0;
  while (guard++ < 200) {
    var op1 = Rng.pick(rng, OP_INSIDE);
    var op2 = Rng.pick(rng, OP_OUTSIDE);
    var a, b, c, inner, answer;

    if (op2 === OP_MUL) {
      // (a +/- b) * c — just ensure noNegative
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, Math.min(max, 9));
      c = Rng.randInt(rng, 2, Math.min(max, 9));
      inner = op1 === OP_ADD ? a + b : a - b;
      if (noNegative && inner < 0) { var t = a; a = b; b = t; inner = a - b; }
      if (noNegative && inner < 0) continue;
      answer = inner * c;
      return { operands: [a, b, c], operators: [op1, op2], answer: answer };
    }

    // op2 === OP_DIV — ensure (a +/- b) % c === 0
    c = Rng.randInt(rng, 2, Math.min(max, 9));
    var maxQuotient = Math.floor(max / c);
    if (maxQuotient < 1) continue;
    var q = Rng.randInt(rng, 1, Math.min(maxQuotient, 9));
    var target = c * q; // (a +/- b) must equal this
    if (op1 === OP_ADD) {
      a = Rng.randInt(rng, Math.max(min, 1), Math.min(max, target - 1));
      b = target - a;
      if (b < min || b > max) continue;
      inner = a + b;
    } else {
      // a - b = target → a = target + b
      b = Rng.randInt(rng, min, Math.min(max, 9));
      a = target + b;
      if (a < min || a > max) continue;
      inner = a - b;
    }
    if (inner !== target) continue;
    answer = q;
    return { operands: [a, b, c], operators: [op1, op2], answer: answer };
  }

  // fallback: (2 + 3) * 4 = 20
  return { operands: [2, 3, 4], operators: [OP_ADD, OP_MUL], answer: 20 };
}

/** 括号格式化：(a op1 b) op2 c */
function formatBracketExpression(operands, operators) {
  return '(' + operands[0] + ' ' + operators[0] + ' ' + operands[1] + ') ' + operators[1] + ' ' + operands[2];
}

// ─── M4-R18 逆向题结构 ──────────────────────────────────────────────────────────

/**
 * 填未知数（带等式右端目标）：a + □ = total  /  □ + b = total  /  a − □ = r  /  □ − b = r
 * mode: 'fill-operand'
 * @returns {{ prompt, known, unknown, operator, position }}  answer = unknown
 */
function buildFillOperand(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 20 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));
  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB]);

  var a, b, total, r;
  var i = 0;
  while (i++ < 80) {
    if (op === OP_ADD) {
      a = Rng.randInt(rng, min, max);
      b = Rng.randInt(rng, min, max);
      total = a + b;
      if (total > max) continue;
      var position = rng() < 0.5 ? 'first' : 'second';
      if (position === 'first') {
        // □ + b = total → answer = a
        return { prompt: '□ + ' + b + ' = ' + total, known: b, unknown: a, operator: op, position: position };
      }
      // a + □ = total → answer = b
      return { prompt: a + ' + □ = ' + total, known: a, unknown: b, operator: op, position: position };
    }
    // op === OP_SUB
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, Math.min(max - 1, Math.max(min, 1)), a - 1);
    r = a - b;
    var pos = rng() < 0.5 ? 'first' : 'second';
    if (pos === 'first') {
      // □ − b = r → answer = a
      return { prompt: '□ − ' + b + ' = ' + r, known: b, unknown: a, operator: op, position: pos };
    }
    // a − □ = r → answer = b
    return { prompt: a + ' − □ = ' + r, known: a, unknown: b, operator: op, position: pos };
  }
  return { prompt: '5 − □ = 3', known: 5, unknown: 2, operator: OP_SUB, position: 'second' };
}

/**
 * 填运算符：a □ b = answer, answer 是已知值，□ 是运算符
 * @returns {{ prompt, answer (string), operands }}
 */
function buildFillOperator(rng, cfg) {
  cfg = cfg || {};
  var range = cfg.numberRange || { min: 1, max: 100 };
  var min = Math.max(1, Math.floor(range.min));
  var max = Math.max(min, Math.floor(range.max));

  var op = Rng.pick(rng, cfg.operators || [OP_ADD, OP_SUB, OP_MUL, OP_DIV]);
  var a, b, answer;
  if (op === OP_ADD) {
    a = Rng.randInt(rng, min, max);
    b = Rng.randInt(rng, min, max);
    answer = a + b;
    if (answer > max) { var t = a; a = Math.max(min, Math.floor(a * 0.6)); b = Math.max(min, Math.floor(b * 0.6)); answer = a + b; }
  } else if (op === OP_SUB) {
    a = Rng.randInt(rng, Math.max(min, 2), max);
    b = Rng.randInt(rng, min, a - 1);
    answer = a - b;
  } else if (op === OP_MUL) {
    a = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    b = Rng.randInt(rng, Math.max(min, 2), Math.min(max, 9));
    answer = a * b;
  } else {
    // div — ensure exact
    b = Rng.randInt(rng, 2, Math.min(max, 9));
    var q = Rng.randInt(rng, 2, Math.min(max, 9));
    a = b * q;
    answer = q;
    if (a > max) { a = b * 2; answer = 2; }
  }
  return { prompt: a + ' □ ' + b + ' =', answer: op, operator: op, operands: [a, b] };
}

module.exports = {
  OP_ADD: OP_ADD, OP_SUB: OP_SUB, OP_MUL: OP_MUL, OP_DIV: OP_DIV,
  normalizeOperation: normalizeOperation,
  defaultOperators: defaultOperators,
  generateStructure: generateStructure,
  calculateAnswer: calculateAnswer,
  formatExpression: formatExpression,
  generateDistractors: generateDistractors,
  parseExpression: parseExpression,
  buildBracket: buildBracket,
  formatBracketExpression: formatBracketExpression,
  buildFillOperand: buildFillOperand,
  buildFillOperator: buildFillOperator
};
