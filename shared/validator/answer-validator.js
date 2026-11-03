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

/* ================================================================
 * P45-07（V-A / V-B / V-D / V-E）：实例一致性门禁
 *   只做「答案/题面 + 生成器已声明字段」的一致性比对，不重算题、不改题。
 *   信号来源单一：data.figureCount（A 类）、data.answerForm（B 类）、
 *   data.graphic（D 类）、prompt 空位形态（E 类），均为既有 Generator 产出。
 * ================================================================ */
var JUDGE_BLANK_RE = /____/;              // 填空式空位（E1）
var INNER_PAREN_RE = /[（(]\s*[）)]/;      // 题干内部空括号（E1）

// V-D 图文同名（D2）：题面点名的具体图形 → 描述符 subtype。
// 长名词优先（「圆柱」先于「圆」，防「圆」吞「圆柱」）；按字符占位避免重复命中。
var SHAPE_NOUNS = [
  { noun: '正方体', subtype: 'cube' },
  { noun: '长方体', subtype: 'cuboid' },
  { noun: '圆柱', subtype: 'cylinder' },
  { noun: '圆锥', subtype: 'cone' },
  { noun: '平行四边形', subtype: 'parallelogram' },
  { noun: '长方形', subtype: 'rectangle' },
  { noun: '正方形', subtype: 'square' },
  { noun: '三角形', subtype: 'triangle' },
  { noun: '梯形', subtype: 'trapezoid' },
  { noun: '线段', subtype: 'line-segment' },
  // 「球」是常用构词成分（乒乓球/羽毛球/足球/地球仪…），这些词里不是图形对象，跳过该次命中。
  { noun: '球', subtype: 'sphere', skipPrefix: /(乒乓|羽毛|网|足|篮|排|皮|气|地|眼|台|棒|铅|垒|高尔夫)$/ },
  { noun: '圆', subtype: 'circle' }
];
var SHAPE_SUBTYPES = SHAPE_NOUNS.map(function (n) { return n.subtype; });

/** 题面提及的全部具体图形 subtype（同名去重，长名词优先占位） */
function allShapeSubtypes(prompt) {
  var p = coerceString(prompt);
  var out = [];
  if (!p) return out;
  var used = [];
  var i, k;
  for (i = 0; i < p.length; i++) used.push(false);
  SHAPE_NOUNS.forEach(function (n) {
    var from = 0;
    while (true) {
      var idx = p.indexOf(n.noun, from);
      if (idx === -1) break;
      var overlap = false;
      for (k = idx; k < idx + n.noun.length; k++) { if (used[k]) { overlap = true; break; } }
      // 构词成分（如「羽毛球」的「球」）不计为图形名
      var isCompound = !!(n.skipPrefix && n.skipPrefix.test(p.slice(Math.max(0, idx - 6), idx)));
      if (!overlap && !isCompound) {
        for (k = idx; k < idx + n.noun.length; k++) used[k] = true;
        if (out.indexOf(n.subtype) === -1) out.push(n.subtype);
      }
      from = idx + n.noun.length;
    }
  });
  return out;
}

/** 题面中「主对象位置」出现的具体图形 subtype 列表（同名去重）
 *  只认两类位置：① 指示词（图中/下图/如图/看图/这个/下面）后 12 字内；
 *  ② 图形名紧跟「有」或「的」。命题文本中作单位/举例提到的图形名（如
 *  「小正方形可以拼成」「线段、射线、直线」「平行四边形面积相等」）不计入。
 */
function primaryShapeSubtypes(prompt) {
  var p = coerceString(prompt);
  var out = [];
  if (!p) return out;
  var used = [];
  var i, k;
  for (i = 0; i < p.length; i++) used.push(false);
  SHAPE_NOUNS.forEach(function (n) {
    var from = 0;
    while (true) {
      var idx = p.indexOf(n.noun, from);
      if (idx === -1) break;
      var overlap = false;
      for (k = idx; k < idx + n.noun.length; k++) { if (used[k]) { overlap = true; break; } }
      if (!overlap) {
        for (k = idx; k < idx + n.noun.length; k++) used[k] = true;
        var before = p.slice(Math.max(0, idx - 12), idx);
        var after = p.slice(idx + n.noun.length, idx + n.noun.length + 6);
        var byDeictic = /(图中|下图|上图|如图|看图|这个|这些|下面)/.test(before);
        var bySubject = /^(有|的)/.test(after);
        if ((byDeictic || bySubject) && out.indexOf(n.subtype) === -1) out.push(n.subtype);
      }
      from = idx + n.noun.length;
    }
  });
  return out;
}
// judge 末尾的「（  ）」是标准作答括号（学生填 √/×），不是空位——不计入 V-E，
// 与 P45-06 变更记录口径一致（该处曾被误判，测试已收窄为只判 ____）。
function stripTrailingJudgeBracket(p) {
  return coerceString(p).replace(/[（(]\s*[）)]\s*$/, '');
}

/**
 * 实例一致性校验（供 validateAnswer 与门禁 23 复用）
 * @param {Object} sq SemanticQuestion
 * @returns {Array<Object>} errors（ERROR 级）
 */
function validateInstanceConsistency(sq) {
  var errors = [];
  if (!sq || !sq.answer) return errors;
  var data = sq.data || {};
  var answerObj = sq.answer;
  var qType = sq.questionType || sq.type || 'calc';
  var prompt = coerceString(sq.prompt || (sq.content && sq.content.prompt) || '');

  // V-A 图元计数一致：计数题答案必须等于描述符实际图元数（Generator 显式写 data.figureCount）
  if (data.figureCount != null) {
    var fcAnswer = coerceNumber(answerObj.value);
    if (fcAnswer == null || fcAnswer !== Number(data.figureCount)) {
      errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value',
        'V-A 图元计数与答案不一致：figureCount=' + data.figureCount + '，答案=' + coerceString(answerObj.value),
        SEVERITY.ERROR));
    }
  }

  // V-B 设问-答案形态一致：Generator 已声明 data.answerForm 时，差值形态答案必须含差值数值
  var form = data.answerForm;
  if (form === 'difference' || form === 'label-difference') {
    if (!/[0-9]/.test(coerceString(answerObj.value))) {
      errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'answer.value',
        'V-B 设问问差值，答案不含数值：answerForm=' + form + '，答案=' + coerceString(answerObj.value),
        SEVERITY.ERROR));
    }
    if (qType === 'choice') {
      var opts = Array.isArray(data.options) ? data.options
        : (Array.isArray(sq.distractors) ? sq.distractors.map(function (d) { return d && d.value; }) : []);
      var hasNumericOption = opts.some(function (o) { return /[0-9]/.test(coerceString(o)); });
      if (!opts.length || !hasNumericOption) {
        errors.push(createError(ERROR_CODES.ANSWER_MISMATCH, 'data.options',
          'V-B 设问问差值，选项集无任何数值项：' + opts.join('/'), SEVERITY.ERROR));
      }
    }
  }

  // V-D 描述符-题面一致
  var g = data.graphic;
  if (g && g.type) {
    var params = g.params || {};
    // D5 装饰指纹：P45-05 前的固定装饰矩形（8×3、不标注边长）；已是禁止形态
    if (g.type === 'geometry' && g.subtype === 'rectangle' &&
        params.width === 8 && params.height === 3 && params.labelSides === false) {
      errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'data.graphic.params',
        'V-D 禁止固定装饰矩形（8×3、labelSides=false）', SEVERITY.ERROR));
    }
    // D1 刻度尺：题面两处刻度读数 = 描述符 from/to
    var rm = prompt.match(/刻度\s*(\d+(?:\.\d+)?)[^\d]{0,12}刻度\s*(\d+(?:\.\d+)?)/);
    if (rm && g.subtype === 'ruler' &&
        (Number(params.from) !== Number(rm[1]) || Number(params.to) !== Number(rm[2]))) {
      errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'data.graphic.params',
        'V-D 刻度尺 from/to ' + params.from + '/' + params.to + ' ≠ 题面读数 ' + rm[1] + '/' + rm[2],
        SEVERITY.ERROR));
    }
    // D3 题面点名的长方形/正方形尺寸 = 描述符 params。
    //   只在描述符「声明了尺寸」时比对：labelSides !== false（图上限标边长）且参数是
    //   该图形自有尺寸（rectangle: 有 height、无通用 size；square: 有 size、无通用 width）。
    //   主题图标（params 同时带 width+size、尺寸为归一化值）不宣称题面边长，不纳入比对
    //   ——否则会把「KP 名首命中 → 主题图标」的 R5 议题（用户裁决搁置）误判为本门禁命中。
    var rect = prompt.match(/长方形长\s*(\d+(?:\.\d+)?)\s*厘米[、，,]\s*宽\s*(\d+(?:\.\d+)?)\s*厘米/);
    if (rect && g.subtype === 'rectangle' && params.labelSides !== false &&
        params.height != null && params.size == null &&
        (Number(params.width) !== Number(rect[1]) || Number(params.height) !== Number(rect[2]))) {
      errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'data.graphic.params',
        'V-D 长方形 params ' + params.width + '×' + params.height + ' ≠ 题面 ' + rect[1] + '×' + rect[2],
        SEVERITY.ERROR));
    }
    var sqm = prompt.match(/正方形边长\s*(\d+(?:\.\d+)?)\s*厘米/);
    if (sqm && g.subtype === 'square' && params.labelSides !== false &&
        params.size != null && params.width == null &&
        Number(params.size) !== Number(sqm[1])) {
      errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'data.graphic.params',
        'V-D 正方形 params.size ' + params.size + ' ≠ 题面边长 ' + sqm[1], SEVERITY.ERROR));
    }
    // D2 图文同名：题面唯一命名的具体图形必须与描述符同名（count 取 params.shape）。
    //   作用域：仅具体图形 subtype；主题图标（params 同时带 width+size，归一化尺寸）与
    //   复合描述符（view-cards/segment/ruler 等）不宣称单一图形名，跳过。
    //   题面提及多个图形（如「平行四边形、长方形、正方形都有…」）属比较/拼组/推导题，
    //   不做单一归属判定；仅单图形且处于主对象位置（指示词邻近或后接「有/的」）才比对。
    //   judge 题干是命题文本（如「圆有无数条对称轴」），不宣称配图对象，不纳入同名比对；
    //   其空位/结构仍由 V-E 覆盖。
    var named = (qType === 'judge' || qType === 'true-false') ? [] : (function () {
      var allShapes = allShapeSubtypes(prompt);
      return allShapes.length === 1 ? primaryShapeSubtypes(prompt) : [];
    })();
    if (named.length === 1) {
      var actualSub = g.subtype === 'count' ? params.shape : g.subtype;
      var isThemeIcon = params.width != null && params.size != null;
      if (actualSub && SHAPE_SUBTYPES.indexOf(actualSub) !== -1 && !isThemeIcon && actualSub !== named[0]) {
        errors.push(createError(ERROR_CODES.GRAPHIC_INVALID, 'data.graphic.subtype',
          'V-D 题面图形名与描述符不符：题面 ' + named[0] + '，描述符 ' + actualSub, SEVERITY.ERROR));
      }
    }
  }

  // V-E judge 无空位：题干不得含 ____ / 内部空括号（末尾作答括号除外）
  if (qType === 'judge' || qType === 'true-false') {
    var stripped = stripTrailingJudgeBracket(prompt);
    if (JUDGE_BLANK_RE.test(stripped) || INNER_PAREN_RE.test(stripped)) {
      errors.push(createError(ERROR_CODES.STRUCTURE_INVALID, 'prompt',
        'V-E 判断题题干残留空位：' + coerceString(prompt).slice(0, 80), SEVERITY.ERROR));
    }
  }

  return errors;
}


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

  // P45-07：实例一致性门禁（V-A / V-B / V-D / V-E）——与题型分派正交，
  // 任何题型产出都必须满足（失败属 Generation 面硬失败，触发重生成）。
  errors.push.apply(errors, validateInstanceConsistency(sq));

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
  validateTextAnswer: validateTextAnswer,
  validateInstanceConsistency: validateInstanceConsistency
};