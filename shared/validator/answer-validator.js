/**
 * shared/validator/answer-validator.js — M5-R06 Answer Validator
 *
 * 验证题目答案正确性：
 *   - 数值计算（四则运算、进位/退位、分数、小数）
 *   - 填空题
 *   - 选择题（答案在选项中）
 *   - 判断题（对/错）
 *   - 简单文本答案
 *
 * 核心逻辑：题干 → 计算/规则 → answer，不能只检查 answer != null
 */
'use strict';

var Validator = require('./question-validator.js');
var ERROR_CODES = Validator.ERROR_CODES;
var SEVERITY = Validator.SEVERITY;
var createError = Validator.createError;

function coerceString(v) { return v == null ? '' : String(v); }
function coerceNumber(v) { if (v == null) return null; var n = Number(v); return isNaN(n) ? null : n; }
function safeTrim(v) { return coerceString(v).trim(); }

/**
  * 计算标准算式的正确答案（安全解析器，无 eval/new Function）
  * 支持：number, + - * / ( ), % (postfix percent), decimal
  * 优先级：% (postfix) > * / > + - ; 括号改变优先级；支持一元负号
  * @param {string} prompt
  * @returns {string|null} 正确答案字符串，无法解析返回 null
  */
function computeExpectedAnswer(prompt) {
  var expr = coerceString(prompt).replace(/[？?□_\s]/g, '').replace(/[×xX]/g, '*').replace(/[÷]/g, '/').replace(/[＝=]/g, '');
  if (!expr) return null;

  try {
    var tokens = tokenize(expr);
    var ast = parseExpression(tokens);
    var result = evaluate(ast);
    if (typeof result === 'number' && isFinite(result)) {
      // 整数保持整数，小数保留 2 位
      return Number.isInteger(result) ? String(result) : result.toFixed(2).replace(/\.?0+$/, '');
    }
    return String(result);
  } catch (e) {
    return null;
  }
}

/**
 * 安全数学表达式解析器（Tokenizer → Parser → AST → Evaluator）
 * 仅允许：数字、+ - * / ( ) % (postfix)
 * 拒绝：任何标识符、函数调用、属性访问、赋值、逗号、其他字符
 */

function tokenize(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var ch = str[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') { i++; continue; }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '(' || ch === ')') {
      tokens.push({ type: 'op', value: ch });
      i++;
    } else if ((ch >= '0' && ch <= '9') || ch === '.') {
      var j = i;
      var hasDot = false;
      while (j < str.length) {
        var c = str[j];
        if (c >= '0' && c <= '9') { j++; }
        else if (c === '.' && !hasDot) { hasDot = true; j++; }
        else { break; }
      }
      var numStr = str.slice(i, j);
      // 避免单独的 "." 或 "123." 末尾点号（后者保留为整数部分）
      if (numStr === '.' || numStr.endsWith('.')) {
        // 单独的 "." 不是合法数字，交给后续报错
      }
      tokens.push({ type: 'num', value: numStr });
      i = j;
    } else {
      // 非法字符：标识符、函数、属性、逗号、其他
      throw new Error('Invalid character: ' + ch);
    }
  }
  tokens.push({ type: 'eof' });
  return tokens;
}

function createParser(tokens) {
  var index = 0;
  function peek() { return tokens[index]; }
  function consume() { return tokens[index++]; }
  function expect(type, value) {
    var t = peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new Error('Expected ' + type + (value ? ' ' + value : '') + ', got ' + JSON.stringify(t));
    }
    return consume();
  }

  function parseAddSub() {
    var left = parseMulDiv();
    while (true) {
      var t = peek();
      if (t.type === 'op' && (t.value === '+' || t.value === '-')) {
        var op = consume().value;
        var right = parseMulDiv();
        left = { type: 'bin', op: op, left: left, right: right };
      } else break;
    }
    return left;
  }

  function parseMulDiv() {
    var left = parseUnary();
    while (true) {
      var t = peek();
      if (t.type === 'op' && (t.value === '*' || t.value === '/')) {
        var op = consume().value;
        var right = parseUnary();
        left = { type: 'bin', op: op, left: left, right: right };
      } else break;
    }
    return left;
  }

  function parseUnary() {
    var t = peek();
    if (t.type === 'op' && t.value === '-') {
      consume();
      var operand = parseUnary();
      return { type: 'unary', op: '-', operand: operand };
    }
    return parsePostfix();
  }

  function parsePostfix() {
    var node = parsePrimary();
    while (true) {
      var t = peek();
      if (t.type === 'op' && t.value === '%') {
        consume();
        node = { type: 'postfix', op: '%', operand: node };
      } else break;
    }
    return node;
  }

  function parsePrimary() {
    var t = peek();
    if (t.type === 'num') {
      consume();
      var v = t.value;
      if (v === '.') throw new Error('Invalid number: .');
      if (v.startsWith('.')) v = '0' + v;
      if (v.endsWith('.')) v = v.slice(0, -1);
      return { type: 'num', value: Number(v) };
    }
    if (t.type === 'op' && t.value === '(') {
      consume();
      var node = parseAddSub();
      expect('op', ')');
      return node;
    }
    throw new Error('Unexpected token: ' + JSON.stringify(t));
  }

  return { parse: parseAddSub, peek: peek };
}

function parseExpression(tokens) {
  var parser = createParser(tokens);
  var ast = parser.parse();
  // 确保所有 token 被消费（除 eof），防止 "3 + 4) * 5" 这类残留 token 被静默忽略
  var finalTok = parser.peek();
  if (finalTok && finalTok.type !== 'eof') {
    throw new Error('Unexpected trailing token: ' + JSON.stringify(finalTok));
  }
  return ast;
}

function evaluate(node) {
  switch (node.type) {
    case 'num': return node.value;
    case 'unary':
      if (node.op === '-') return -evaluate(node.operand);
      throw new Error('Unknown unary op: ' + node.op);
    case 'postfix':
      if (node.op === '%') return evaluate(node.operand) / 100;
      throw new Error('Unknown postfix op: ' + node.op);
    case 'bin':
      var l = evaluate(node.left);
      var r = evaluate(node.right);
      switch (node.op) {
        case '+': return l + r;
        case '-': return l - r;
        case '*': return l * r;
        case '/':
          if (r === 0) throw new Error('Division by zero');
          return l / r;
        default: throw new Error('Unknown binary op: ' + node.op);
      }
    default: throw new Error('Unknown AST node: ' + node.type);
  }
}

/**
 * 验证数值答案
 * @param {Object} answerObj { value, acceptable, precision, unit }
 * @param {string} expected 期望正确答案
 * @returns {Object} { match, errors, warnings }
 */
function validateNumericAnswer(answerObj, expected) {
  var errors = [];
  var warnings = [];
  var val = answerObj.value;
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable : [];

  var candidates = [val].concat(acceptable).map(function (v) { return coerceString(v).trim(); }).filter(function (v) { return v !== ''; });
  var expectedStr = coerceString(expected).trim();

  var match = candidates.some(function (c) {
    // 数值比较（允许精度差异）
    var cn = coerceNumber(c);
    var en = coerceNumber(expectedStr);
    if (cn != null && en != null) {
      var precision = answerObj.precision != null ? answerObj.precision : 2;
      return Math.abs(cn - en) < Math.pow(10, -precision);
    }
    return c === expectedStr;
  });

  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案不匹配：期望 ' + expectedStr + '，实际 ' + candidates.join('/'), SEVERITY.ERROR, { expected: expectedStr, actual: candidates }));
  }
  return { match: match, errors: errors, warnings: warnings };
}

/**
 * 验证选择题答案（答案必须在选项中）
 * @param {Object} answerObj
 * @param {Array<string>} options
 * @returns {Object}
 */
function validateChoiceAnswer(answerObj, options) {
  var errors = [];
  var val = coerceString(answerObj.value);
  if (!val) {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '选择题答案为空', SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var optStrs = options.map(function (o) { return coerceString(o).trim(); });
  if (optStrs.indexOf(val) === -1) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '答案 ' + val + ' 不在选项中', SEVERITY.ERROR, { answer: val, options: optStrs }));
    return { match: false, errors: errors, warnings: [] };
  }
  return { match: true, errors: [], warnings: [] };
}

// P32-AS-05/07：判断题布尔词表为全模块唯一 SSOT（质检 validateJudgeAnswer 与
// 运行时 gradeUserAnswer 共用），答案期望只从 answer.value 自证，不再 hardcode true。
var JUDGE_TRUE_SET = ['true', '对', '是', 'yes', 'y', 't', '1', '✓', '正确'];
var JUDGE_FALSE_SET = ['false', '错', '否', 'no', 'n', 'f', '0', '✗', '错误'];

// boolean / 布尔词 → true|false；无法识别 → null
function parseJudgeValue(v) {
  if (v === true) return true;
  if (v === false) return false;
  var s = coerceString(v).toLowerCase().trim();
  if (JUDGE_TRUE_SET.indexOf(s) !== -1) return true;
  if (JUDGE_FALSE_SET.indexOf(s) !== -1) return false;
  return null;
}

/**
 * 验证判断题答案（对/错、true/false、是/否、✓/✗）
 * @param {Object} answerObj
 * @param {boolean} expected 期望布尔值（P32-AS-07 起由 answer.value 自证，调用方不得再 hardcode）
 * @returns {Object}
 */
function validateJudgeAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var parsed = parseJudgeValue(answerObj.value);
  if (parsed === null) {
    errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value', '判断题答案格式非法: ' + val, SEVERITY.ERROR));
    return { match: false, errors: errors, warnings: [] };
  }
  var match = parsed === expected;
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '判断题答案错误：期望 ' + (expected ? '对' : '错') + '，实际 ' + val, SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

// P32-AS-05：运行时批改归一化（判分唯一一处，口径等价旧 core.normalizeAns）：
// 去全部空白 → 余数记号（……/.../余）统一为「……」→ 小写。
function normalizeAnswerText(v) {
  return coerceString(v)
    .replace(/\s+/g, '')
    .replace(/(?:…+|\.{2,}|余)/g, '……')
    .toLowerCase();
}

// 答案标量候选：value + acceptable 中标量元素（嵌套数组等缺陷形态不参与判分）
function answerCandidates(answerSpec) {
  var out = [];
  function push(v) {
    var s = coerceString(v).trim();
    if (s !== '') out.push(s);
  }
  if (!answerSpec) return out;
  push(answerSpec.value);
  if (Array.isArray(answerSpec.acceptable)) {
    for (var i = 0; i < answerSpec.acceptable.length; i++) {
      if (typeof answerSpec.acceptable[i] === 'string' || typeof answerSpec.acceptable[i] === 'number') {
        push(answerSpec.acceptable[i]);
      }
    }
  }
  return out;
}

// P32-AS-13：classify 按 data.groups 做「组→项集合」顺序无关配对。
// 用户串可解析且集合完全一致 → true；确定错误（缺组/多项/错项/越界重复/多余标签）→ false；无法解析 → null（parentCheck）。
function gradeClassify(userRaw, groups) {
  if (!groups || typeof groups !== 'object') return null;
  var normItem = function (v) { return coerceString(v).replace(/\s+/g, ''); };
  var expected = Object.keys(groups).map(function (name) {
    return {
      name: normItem(name),
      items: new Set((Array.isArray(groups[name]) ? groups[name] : []).map(normItem))
    };
  }).filter(function (g) { return g.name !== ''; });
  if (!expected.length) return null;

  var parsed = {};
  var segs = coerceString(userRaw).split(/[;；\n]+/);
  for (var s = 0; s < segs.length; s++) {
    var seg = segs[s].trim();
    if (!seg) continue;
    var mi = seg.match(/^(.+?)[：:](.+)$/);
    if (!mi) return null;
    var name = normItem(mi[1]);
    if (Object.prototype.hasOwnProperty.call(parsed, name)) return false;
    parsed[name] = mi[2].split(/[、，,]/).map(normItem).filter(Boolean);
  }
  if (Object.keys(parsed).length !== expected.length) return false;

  var usedItems = new Set();
  for (var i = 0; i < expected.length; i++) {
    var got = parsed[expected[i].name];
    if (!got) return null;
    if (got.length !== expected[i].items.size) return false;
    for (var j = 0; j < got.length; j++) {
      if (!expected[i].items.has(got[j])) return false;
      if (usedItems.has(got[j])) return false;
      usedItems.add(got[j]);
    }
  }
  return true;
}

/**
 * P32-AS-05：运行时判分唯一入口（computeResult 逐题调用）。
 * @param {*} userRaw 用户原始作答（practice.html 采集值）
 * @param {Object} answerSpec RenderFormat 产出的只读答案规格 {value,acceptable,precision,unit,mode,groups?}
 * @param {Object} ctx {questionType, prompt, data}
 * @returns {boolean|null} true 正确；false 错误；null 不可自动判定（走家长检查通道，禁止非空即对）
 */
function gradeUserAnswer(userRaw, answerSpec, ctx) {
  if (!answerSpec || answerSpec.value == null || coerceString(answerSpec.value).trim() === '') return null;
  var qt = ctx && ctx.questionType ? ctx.questionType : null;
  var raw = coerceString(userRaw);
  if (!raw.trim()) return false;

  // judge：期望由 answer.value 自证
  if (qt === 'judge' || qt === 'true-false') {
    var expected = parseJudgeValue(answerSpec.value);
    if (expected === null) return null;
    var given = parseJudgeValue(raw.trim());
    return given === null ? false : given === expected;
  }

  // choice：与选项值精确匹配（归一化）
  if (qt === 'choice') {
    var targets = answerCandidates(answerSpec).map(normalizeAnswerText);
    return targets.indexOf(normalizeAnswerText(raw)) !== -1;
  }

  // classify：组→项集合顺序无关配对
  if (qt === 'classify') {
    return gradeClassify(raw, answerSpec.groups);
  }

  // none / read-aloud：无自动判分
  if (qt === 'none' || qt === 'read-aloud') return null;

  // P32-AS-14：apply / geometry 的边界——数值/短答可判子问自动判分；
  // 模型答案为长文本说理/作图/实操（「先…再说说…」「按实际测量…」「如…」类开放答案，
  // 逐字匹配必然误判）时不做自动判分，返回 null 走家长检查（parentCheck），
  // 禁止「非空即对」也禁止把开放题机械判错。判据：任一候选为纯数值（容差可判），
  // 或存在汉字数 ≤ 6 的短答候选（如「闰年」「红球」「2020年」）；否则 → null。
  if (qt === 'apply' || qt === 'geometry') {
    var autoGradeable = answerCandidates(answerSpec).some(function (c) {
      var cs = coerceString(c);
      if (coerceNumber(cs) != null) return true;
      return cs.replace(/[^\u4e00-\u9fa5]/g, '').length <= 6;
    });
    if (!autoGradeable) return null;
  }

  // calc / fill / geometry / apply（及其余文本/数值短答）：
  // 余数语义优先 → 数值容差 → 归一化文本白名单
  var cNorm = answerCandidates(answerSpec).map(normalizeAnswerText);
  var uNorm = normalizeAnswerText(raw);
  var prompt = ctx && ctx.prompt ? coerceString(ctx.prompt) : '';

  var hasRemainderExpected = cNorm.some(function (c) { return /^\d+……\d+$/.test(c); });
  var dm = prompt.match(/(\d+)\s*[÷/]\s*(\d+)/);
  var um = uNorm.match(/^(\d+)……(\d+)$/);
  if (hasRemainderExpected && um) {
    if (dm) {
      var a = parseInt(dm[1], 10), b = parseInt(dm[2], 10);
      if (!(b > 0)) return null;
      var q = parseInt(um[1], 10), r = parseInt(um[2], 10);
      if (r >= b) return false;
      return b * q + r === a;
    }
    // 题干无法解析除法结构时退回文本等价比较
    return cNorm.some(function (c) { return c === uNorm; });
  }

  var un = coerceNumber(raw.replace(/\s+/g, ''));
  if (un != null) {
    var precision = answerSpec.precision != null ? Number(answerSpec.precision) : 2;
    if (isNaN(precision)) precision = 2;
    var tolerance = Math.pow(10, -precision);
    for (var i = 0; i < cNorm.length; i++) {
      var cn = coerceNumber(cNorm[i]);
      if (cn != null && Math.abs(cn - un) < tolerance) return true;
    }
  }

  return cNorm.some(function (c) { return c === uNorm; });
}

/**
 * 验证填空/文本答案（宽松匹配，去空格、大小写不敏感）
 * @param {Object} answerObj
 * @param {string|string[]} expected
 * @returns {Object}
 */
function validateTextAnswer(answerObj, expected) {
  var errors = [];
  var val = coerceString(answerObj.value).toLowerCase().trim();
  var acceptable = Array.isArray(answerObj.acceptable) ? answerObj.acceptable.map(function (a) { return coerceString(a).toLowerCase().trim(); }) : [];
  var candidates = [val].concat(acceptable).filter(function (v) { return v !== ''; });
  var expList = Array.isArray(expected) ? expected : [expected];
  var expNorm = expList.map(function (e) { return coerceString(e).toLowerCase().trim(); });

  var match = candidates.some(function (c) { return expNorm.indexOf(c) !== -1; });
  if (!match) {
    errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '文本答案不匹配：期望 ' + expNorm.join('/') + '，实际 ' + candidates.join('/'), SEVERITY.ERROR));
  }
  return { match: match, errors: errors, warnings: [] };
}

/**
 * 验证余数除法答案：a ÷ b = q……r（小学教材余数记号），恒有 0 ≤ r < b、b*q+r = a。
 * 题干形如 "53 ÷ 6 = ?"，答案形如 "8……5" / "8...5" / "8余5"。
 * @returns {boolean|null} true 校验通过；false 确定不匹配；null 非余数题（调用方走常规数值校验）
 */
function validateRemainderAnswer(answerObj, prompt) {
  var candidates = [answerObj && answerObj.value].concat(Array.isArray(answerObj && answerObj.acceptable) ? answerObj.acceptable : [])
    .map(function (v) { return coerceString(v).trim(); })
    .filter(function (v) { return v !== ''; });
  var remCandidates = candidates.filter(function (c) { return /^\d+\s*(?:…+|\.{3,}|余)\s*\d+$/.test(c); });
  if (!remCandidates.length) return null;
  var dm = coerceString(prompt).match(/(\d+)\s*[÷/]\s*(\d+)/);
  if (!dm) return null;
  var a = parseInt(dm[1], 10), b = parseInt(dm[2], 10);
  if (!(b > 0)) return false;
  return remCandidates.some(function (c) {
    var m = c.match(/^(\d+)\s*(?:…+|\.{3,}|余)\s*(\d+)$/);
    if (!m) return false;
    var q = parseInt(m[1], 10), r = parseInt(m[2], 10);
    return r >= 0 && r < b && b * q + r === a;
  });
}

/**
 * 主验证入口
 * @param {Object} sq SemanticQuestion
 * @returns {Object} { valid, errors, warnings, info, score, checks }
 */
function validateAnswer(sq) {
  var errors = [];
  var warnings = [];
  var info = [];

  if (!sq.answer || typeof sq.answer !== 'object') {
    errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer', '缺少 answer 对象', SEVERITY.ERROR));
    return { valid: false, errors: errors, warnings: warnings, info: info, score: 0, checks: { answer: 'fail' } };
  }

  var prompt = sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '';
  var qType = sq.questionType || sq.type || 'calc';
  var answerObj = sq.answer;

  // 根据题型分派验证逻辑
  if (qType === 'choice' && sq.distractors) {
    var options = sq.distractors.map(function (d) { return d.value; });
    if (answerObj.value != null) options.push(coerceString(answerObj.value));
    var optUniq = options.filter(function (v, i, a) { return a.indexOf(v) === i; });
    var res = validateChoiceAnswer(answerObj, optUniq);
    errors.push.apply(errors, res.errors);
    warnings.push.apply(warnings, res.warnings);
  } else if (qType === 'judge' || qType === 'true-false') {
    // P32-AS-07：期望布尔只从 answer.value 自证（生成器契约：value 为布尔或布尔词），
    // 删除 hardcode true + 丢弃比对结果的假阳性 INFO。
    var expectedBool = parseJudgeValue(answerObj.value);
    if (expectedBool === null) {
      errors.push(createError(ERROR_CODES.ANSWER_TYPE_MISMATCH, 'answer.value',
        '判断题答案格式非法: ' + coerceString(answerObj.value), SEVERITY.ERROR));
    } else {
      var res2 = validateJudgeAnswer(answerObj, expectedBool);
      errors.push.apply(errors, res2.errors);
      warnings.push.apply(warnings, res2.warnings);
    }
  } else if (qType === 'fill' || qType === 'calc') {
    // 有余数除法（a ÷ b = q……r）：余数记号无法用表达式求值，走专用语义校验
    var remResult = validateRemainderAnswer(answerObj, prompt);
    if (remResult === true) {
      // 余数答案正确
    } else if (remResult === false) {
      errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value', '余数除法答案不正确（不满足 b×q+r=a 且 0≤r<b）', SEVERITY.ERROR));
    } else {
      // 计算/填空：尝试从题干自动计算期望答案
      var expected = computeExpectedAnswer(prompt);
      if (expected) {
        var res3 = validateNumericAnswer(answerObj, expected);
        errors.push.apply(errors, res3.errors);
        warnings.push.apply(warnings, res3.warnings);
      } else {
        // 无法自动计算，仅做非空校验
        if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
          errors.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '答案为空且无法自动校验', SEVERITY.ERROR));
        } else {
          info.push({ code: 'ANSWER_UNVERIFIED', field: 'answer', message: '题目类型 ' + qType + ' 无法自动验证，需人工核对', severity: 'INFO' });
        }
      }
    }
  } else {
    // 其他类型（apply, open, operate 等）仅做非空
    if (answerObj.value == null && (!answerObj.acceptable || answerObj.acceptable.length === 0)) {
      warnings.push(createError(ERROR_CODES.ANSWER_INVALID, 'answer.value', '题型 ' + qType + ' 答案为空', SEVERITY.WARNING));
    }
  }

  var valid = errors.length === 0;
  return { valid: valid, errors: errors, warnings: warnings, info: info, score: valid ? 1 : 0.5, checks: { answer: valid ? 'pass' : 'fail' } };
}

module.exports = {
  validateAnswer: validateAnswer,
  gradeUserAnswer: gradeUserAnswer,
  parseJudgeValue: parseJudgeValue,
  normalizeAnswerText: normalizeAnswerText,
  computeExpectedAnswer: computeExpectedAnswer,
  validateNumericAnswer: validateNumericAnswer,
  validateRemainderAnswer: validateRemainderAnswer,
  validateChoiceAnswer: validateChoiceAnswer,
  validateJudgeAnswer: validateJudgeAnswer,
  validateTextAnswer: validateTextAnswer
};