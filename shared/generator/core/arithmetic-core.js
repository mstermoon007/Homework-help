/**
 * shared/generator/core/arithmetic-core.js — M4-R06 核心算术抽取件 (P7 Task 4.3 配置化)
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成。
 * 纯函数，不读 DOM、不生成 HTML/SVG、不解释全局难度（全部来自约束参数）。
 *
 * 特殊口算结构（SPECIAL_KINDS）：15 种 kind 映射到独立构造函数，
 * buildSpecialKind 查表调用，新增 kind 只需在配置表添加一行。
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
  if (op === OP_DIV) return b === 0 ? a : a / b;
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

// ─── M4-R24 特殊口算结构（镜像 legacy plugins/math-g4-oral.js 的粒度）───────────

/**
 * 大数加减口算（big-addsub，万以内）：整百/整千/千+百/两个三位数，差为正。
 * @returns {{ operands:[a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildBigAddsub(rng) {
  function mul100(lo, hi) { return Rng.randInt(rng, lo, hi) * 100; }
  if (Rng.pick(rng, [1, 2]) === 1) {
    var kind = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
    var a, b;
    if (kind === 'hh') { a = mul100(1, 9); b = mul100(1, 90 - a / 100); }
    else if (kind === 'kk') { a = Rng.randInt(rng, 1, 8) * 1000; b = Rng.randInt(rng, 1, Math.max(1, Math.floor((10000 - a) / 1000))) * 1000; }
    else if (kind === 'hk') { a = Rng.randInt(rng, 1, 8) * 1000; b = mul100(1, 90 - a / 100); }
    else { a = Rng.randInt(rng, 100, 499); b = Rng.randInt(rng, 100, 499); }
    return { operands: [a, b], operators: [OP_ADD], steps: 1, answer: a + b };
  }
  var kind2 = Rng.pick(rng, ['hh', 'kk', 'hk', 'dd']);
  var a2, b2;
  if (kind2 === 'hh') { a2 = mul100(2, 90); b2 = mul100(1, a2 / 100 - 1); }
  else if (kind2 === 'kk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = Rng.randInt(rng, 1, a2 / 1000 - 1) * 1000; }
  else if (kind2 === 'hk') { a2 = Rng.randInt(rng, 2, 9) * 1000; b2 = mul100(1, a2 / 100 - 1); }
  else { a2 = Rng.randInt(rng, 300, 900); b2 = Rng.randInt(rng, 100, a2 - 100); }
  return { operands: [a2, b2], operators: [OP_SUB], steps: 1, answer: a2 - b2 };
}

/**
 * 三位数乘一位数口算（mul3x1）：40% 整十三位数，60% 一般三位数 × 一位数。
 * @returns {{ operands:[a,f], operators:[×], steps:1, answer:number }}
 */
function buildMul3x1(rng) {
  var a = (Rng.pick(rng, [1, 2, 3]) === 1) ? Rng.randInt(rng, 10, 99) * 10 : Rng.randInt(rng, 100, 999);
  var f = Rng.randInt(rng, 2, 9);
  return { operands: [a, f], operators: [OP_MUL], steps: 1, answer: a * f };
}

/**
 * 两位数乘整十数口算（mul2tens）：2 位数 × 整十数（20/30/…/90）。
 * @returns {{ operands:[a,t*10], operators:[×], steps:1, answer:number }}
 */
function buildMul2tens(rng) {
  var a = Rng.randInt(rng, 11, 99);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: a * b };
}

/**
 * 除数是整十数口算（div-tens）：被除数 = (整十除数) × 商，商为一位/两位/整十数。
 * @returns {{ operands:[a,t*10], operators:[÷], steps:1, answer:number }}
 */
function buildDivTens(rng, range) {
  var max = Math.max(20, (range && range.max) || 5000);
  var t = Rng.randInt(rng, 2, 9);
  var b = t * 10;
  // 被除数 a = b*q 不得超过 range.max（整十除数的语义范围）
  var qMax = Math.max(2, Math.floor(max / b));
  var v = qMax < 11 ? 's' : Rng.pick(rng, ['s', 'd', 'tens']);
  var q;
  if (v === 's') q = Rng.randInt(rng, 2, Math.min(9, qMax));
  else if (v === 'd') q = Rng.randInt(rng, 11, Math.min(49, qMax));
  else q = Rng.randInt(rng, 2, Math.max(2, Math.min(9, Math.floor(qMax / 10)))) * 10;
  var a = b * q;
  return { operands: [a, b], operators: [OP_DIV], steps: 1, answer: q };
}

/**
 * M4-R25 小数点清理：去掉浮点噪声（0.1+0.2 → 0.3），并去除多余尾 0（6.90 → 6.9）。
 */
function trimDec(x) {
  return String(Number(Number(x).toFixed(2)));
}

/**
 * 小数加减法口算（dec-addsub，一位小数）：a=aW.aT ± bW.bT，被减数不小于减数。
 * @returns {{ operands:[a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildDecAddsub(rng) {
  var fmt = function (w, t) { return w + '.' + t; };
  var aW = Rng.randInt(rng, 0, 6), aT = Rng.randInt(rng, 1, 9);
  var bW = Rng.randInt(rng, 0, 6), bT = Rng.randInt(rng, 1, 9);
  var a = aW * 10 + aT, b = bW * 10 + bT;
  if (Rng.pick(rng, [1, 2]) === 1) {
    return { operands: [a / 10, b / 10], operators: [OP_ADD], steps: 1, answer: (a + b) / 10 };
  }
  if (a < b) { var tw = aW; aW = bW; bW = tw; var tt = aT; aT = bT; bT = tt; a = aW * 10 + aT; b = bW * 10 + bT; }
  return { operands: [a / 10, b / 10], operators: [OP_SUB], steps: 1, answer: (a - b) / 10 };
}

/**
 * 运用运算律简便口算（law-oral）：25/125/99/101 × n，镜像 legacy 的凑整结构。
 * @returns {{ operands:[a,n], operators:[×], steps:1, answer:number }}
 */
function buildLawOral(rng) {
  var v = Rng.pick(rng, ['25', '125', '99', '101']);
  var a, n;
  if (v === '25') { a = 25; n = Rng.pick(rng, [4, 8, 12, 16, 24, 28, 32, 36, 40]); }
  else if (v === '125') { a = 125; n = Rng.pick(rng, [8, 16, 24, 32, 40, 48, 56, 64, 72, 80]); }
  else if (v === '99') { a = 99; n = Rng.randInt(rng, 2, 9); }
  else { a = 101; n = Rng.randInt(rng, 2, 9); }
  return { operands: [a, n], operators: [OP_MUL], steps: 1, answer: a * n };
}

/**
 * 小数乘法口算（dec-mul-oral）：一位小数×整数 / 一位小数×一位小数 / 整十、整百×一位小数。
 * @returns {{ operands:[a,b], operators:[×], steps:1, answer:number }}
 */
function buildDecMulOral(rng, range) {
  var max = Math.max(10, (range && range.max) || 1000);
  var v = Rng.pick(rng, ['i', 'ii', 'tens', 'zero']);
  var a, b;
  if (v === 'i') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 2, 99); }
  else if (v === 'ii') { a = Rng.randInt(rng, 1, 9) / 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else if (v === 'tens') { a = Rng.randInt(rng, 2, 9) * 10; b = Rng.randInt(rng, 1, 9) / 10; }
  else { a = Rng.randInt(rng, 2, 9) * 100; b = Rng.randInt(rng, 1, 9) / 10; }
  if (a > max) a = Rng.randInt(rng, 2, Math.max(2, Math.floor(max / 100))) * 100;
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(trimDec(a * b)) };
}

/**
 * 小数除法口算（dec-div-oral）：被除数 = 除数 × 商（除数一位小数），商为整数或一位小数。
 * @returns {{ operands:[a,divisor], operators:[÷], steps:1, answer:number }}
 */
function buildDecDivOral(rng, range) {
  var min = Math.max(0.1, (range && range.min != null) ? range.min : 0.1);
  var v = Rng.pick(rng, ['int', 'dec']);
  var divisor = Rng.randInt(rng, 2, 9) / 10;
  var q;
  if (v === 'int') q = Rng.randInt(rng, 2, 9);
  else q = Rng.randInt(rng, 1, 9) / 10;
  // 保证被除数 a = divisor × q 不低于 range.min（整十除数语义最低单位）
  var a = divisor * q;
  if (a < min) { q = Math.max(v === 'int' ? 2 : 1, Math.ceil(min / divisor / 0.1) * 0.1); a = divisor * q; }
  return { operands: [Number(trimDec(a)), Number(trimDec(divisor))], operators: [OP_DIV], steps: 1, answer: Number(trimDec(q)) };
}

/**
 * 负数加减口算（neg-add-sub，镜像 legacy math-g6-oral）：−a + b / −a − b。
 *   add：−a + b = b − a（异号相加，结果可正可负）
 *   sub：−a − b = −(a + b)（负号相减）
 * 操作数含负数，需配合 KP numberRange 允许负值（如 {min:-20, max:20}）。
 * @returns {{ operands:[-a,b], operators:[+|−], steps:1, answer:number }}
 */
function buildNegAddsub(rng) {
  if (Rng.pick(rng, ['add', 'sub']) === 'add') {
    var a = Rng.randInt(rng, 2, 9), b = Rng.randInt(rng, 1, 9);
    return { operands: [-a, b], operators: [OP_ADD], steps: 1, answer: b - a };
  }
  var a2 = Rng.randInt(rng, 1, 9), b2 = Rng.randInt(rng, 1, 9);
  return { operands: [-a2, b2], operators: [OP_SUB], steps: 1, answer: -(a2 + b2) };
}

/**
 * 小数乘法笔算（dec-mult，镜像 legacy math-g6-calc）：一位/两位小数因数 × 整数或小数。
 *   dd  —— a.b × c.d（一位小数 × 一位小数）
 *   di  —— a.b × 整数
 *   dd2 —— 0.ab × 0.cd（两位小数 × 两位小数）
 * 答案用 toFixed(6) 清理浮点噪声（legacy trimD 同款），保留小数点位数。
 * @returns {{ operands:[a,b], operators:[×], steps:1, answer:number }}
 */
function buildDecMult(rng) {
  var v = Rng.pick(rng, ['dd', 'di', 'dd2']);
  var a, b;
  if (v === 'dd') {
    a = Rng.randInt(rng, 10, 99) / 10;
    b = Rng.randInt(rng, 10, 99) / 10;
  } else if (v === 'di') {
    a = Rng.randInt(rng, 10, 999) / 10;
    b = Rng.randInt(rng, 2, 99);
  } else {
    a = Rng.randInt(rng, 11, 99) / 100;
    b = Rng.randInt(rng, 11, 99) / 100;
  }
  return { operands: [a, b], operators: [OP_MUL], steps: 1, answer: Number(String(Number((a * b).toFixed(6)))) };
}

/**
 * 加法运算律简便计算（add-law）：a+b+c，其中 a+c 或 b+c 凑整十/百（镜像 legacy）。
 * @returns {{ operands:[a,b,c], operators:[+,+], steps:2, answer:number }}
 */
function buildAddLaw(rng) {
  var a = Rng.randInt(rng, 11, 99), b = Rng.randInt(rng, 11, 99);
  var t = Rng.pick(rng, [10, 100]);
  var ac = t - (a % t); if (ac <= 0) ac = t;
  var c = ac;
  return { operands: [a, b, c], operators: [OP_ADD, OP_ADD], steps: 2, answer: a + b + c };
}

/**
 * 乘法运算律简便计算（mul-law）：p1×p2×rest，p1×p2 为凑整积（25×4/125×8…），因子打乱（镜像 legacy）。
 * @returns {{ operands:[p1,p2,rest], operators:[×,×], steps:2, answer:number }}
 */
function buildMulLaw(rng) {
  var pairs = [[25, 4], [125, 8], [25, 8], [125, 4], [50, 2], [20, 5]];
  var idx = Rng.randInt(rng, 0, pairs.length - 1);
  var p1 = pairs[idx][0], p2 = pairs[idx][1];
  var rest = Rng.randInt(rng, 3, 9);
  var factors = [p1, p2, rest];
  for (var i = factors.length - 1; i > 0; i--) { var j = Rng.randInt(rng, 0, i); var t = factors[i]; factors[i] = factors[j]; factors[j] = t; }
  return { operands: factors, operators: [OP_MUL, OP_MUL], steps: 2, answer: p1 * p2 * rest };
}

/**
 * 特殊口算结构配置表（15 种 kind → 独立构造函数）
 * 新增 kind 只需在此表添加一行：{ kind: 'xxx', build: buildXxx, needsRange: true/false }
 * needsRange: true 表示需要传递 cfg.numberRange 作为第二个参数
 * @type {Object}
 */
var SPECIAL_KINDS = {
  // 整数域口算
  'big-addsub':    { build: buildBigAddsub,    needsRange: false }, // 大数加减
  'mul3x1':        { build: buildMul3x1,       needsRange: false }, // 三位数乘一位数
  'mul2tens':      { build: buildMul2tens,     needsRange: false }, // 两位数乘整十数
  'div-tens':      { build: buildDivTens,      needsRange: true  }, // 除数是整十数
  'add-law':       { build: buildAddLaw,       needsRange: false }, // 加法运算律
  'mul-law':       { build: buildMulLaw,       needsRange: false }, // 乘法运算律
  'neg-add-sub':   { build: buildNegAddsub,    needsRange: false }, // 负数加减

  // 小数口算
  'dec-addsub':    { build: buildDecAddsub,    needsRange: false }, // 小数加减
  'law-oral':      { build: buildLawOral,      needsRange: false }, // 运算律简便口算
  'dec-mul-oral':  { build: buildDecMulOral,   needsRange: true  }, // 小数乘法口算
  'dec-div-oral':  { build: buildDecDivOral,   needsRange: true  }, // 小数除法口算
  'dec-mult':      { build: buildDecMult,      needsRange: true  }, // 小数乘法笔算

  // 括号/填空/填运算符结构
  'bracket':       { build: buildBracket,      needsRange: true  }, // 括号两步运算
  'fill-operand':  { build: buildFillOperand,  needsRange: true  }, // 填未知数
  'fill-operator': { build: buildFillOperator, needsRange: true  }  // 填运算符
};

/**
 * 特殊口算结构入口：查表调用（P7 Task 4.3 配置化）
 * 其余 kind 返回 null（由调用方回退通用 generateStructure）。
 * @param {function} rng 种子随机源
 * @param {Object} cfg { kind, numberRange }
 * @returns {Object|null}
 */
function buildSpecialKind(rng, cfg) {
  cfg = cfg || {};
  var kind = cfg.kind;
  var entry = SPECIAL_KINDS[kind];
  if (!entry) return null;
  return entry.needsRange ? entry.build(rng, cfg.numberRange) : entry.build(rng);
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
  buildFillOperator: buildFillOperator,
  buildBigAddsub: buildBigAddsub,
  buildMul3x1: buildMul3x1,
  buildMul2tens: buildMul2tens,
  buildDivTens: buildDivTens,
  buildDecAddsub: buildDecAddsub,
  buildLawOral: buildLawOral,
  buildDecMulOral: buildDecMulOral,
  buildDecDivOral: buildDecDivOral,
  buildAddLaw: buildAddLaw,
  buildMulLaw: buildMulLaw,
  buildNegAddsub: buildNegAddsub,
  buildDecMult: buildDecMult,
  trimDec: trimDec,
  buildSpecialKind: buildSpecialKind,
  SPECIAL_KINDS: SPECIAL_KINDS
};
