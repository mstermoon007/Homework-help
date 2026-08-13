/**
 * plugins/math-oral.js — 口算练习插件（迁移自根目录 math-oral-agent.js）
 *
 * 同时提供：
 *   1) 兼容旧页面：全局 MathOralAgent（math-practice.html 仍直接 new）
 *   2) ExercisePlugin 接口（id/name/grades/subject/generate/render/check），
 *      供 practice.html / dev/plugin-check.html 使用
 *
 * 随机数统一使用 shared/common.js 的 PluginUtil。
 */
// @ts-check
/// <reference path="../shared/plugin-types.js" />

(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-oral.js 依赖 shared/common.js（PluginUtil），请先加载');

  // ============ MathOralAgent 引擎（原 math-oral-agent.js） ============
  var GRADE_CONFIG = {
    1: { factor: 0.03, defaultMax: 20,  defaultCount: 20, allowMulDiv: false },
    2: { factor: 0.06, defaultMax: 50,  defaultCount: 30, allowMulDiv: true  },
    3: { factor: 0.10, defaultMax: 100, defaultCount: 40, allowMulDiv: true  },
  };

  var OP_NAMES = { '+': '加法', '-': '减法', '×': '乘法', '÷': '除法' };

  // 三年级专项题型：{ 子类型: 中文名 }
  var SUB_TYPE_NAMES = {
    g3:       '三年级混合口算',
    md:       '三年级乘除法口算',
    multi1:   '多位数乘一位数',
    twodigit: '两位数乘两位数',
    div1:     '除数是一位数的除法',
    fraction: '同分母分数加减',
    decimal:  '一位小数加减'
  };

  function MathOralAgent(options) {
    options = options || {};
    var cfg = GRADE_CONFIG[options.grade] || GRADE_CONFIG[1];
    // 难度（1-10）→ 最大值缩放：level 3 用基准，更高难度数值增大
    var baseMax = options.maxNum != null ? options.maxNum : cfg.defaultMax;
    var diff = _PU.diffLevel(options.difficulty);
    this.grade      = options.grade;
    this.difficulty = diff;
    this.maxNum     = Math.round(baseMax * _PU.diffScale(diff));
    this.count      = options.count  != null ? options.count  : cfg.defaultCount;
    this.noNegative = options.noNegative !== false;
    // 二年级：默认表内乘除法（乘法口诀表范围内，÷ 必整除）；
    // 开启 remainder 后生成有余数除法（商……余数 两个输入框）
    this.remainder  = options.remainder === true && this.grade >= 2;
    this.operators  = options.operators || (cfg.allowMulDiv ? ['+', '-', '×', '÷'] : ['+', '-']);
    // 混合运算：一个算式含两级运算（如 3×4+5），二年级可选
    this.mixed      = options.mixed === true && this.grade >= 2;
    this._factor    = cfg.factor;
    // 表内乘法口诀上限（1~9 相乘，结果 ≤ 81）
    this.tableMax = Math.min(9, this.grade >= 3 ? 12 : 9);
    // 三年级专项题型（subType）：grade>=3 时才生效
    this.subType = (this.grade >= 3) ? (options.subType || null) : null;
    // grade>=3 且未指定运算集/专项题型时，默认三年级混合口算（g3）
    if (this.grade >= 3 && !this.subType && !this.operators) this.subType = 'g3';
  }

  Object.defineProperty(MathOralAgent.prototype, 'operandMin', {
    get: function () {
      return Math.max(1, Math.floor(this.maxNum * this._factor));
    }
  });

  MathOralAgent.prototype._randInt = function (min, max) { return _PU.randInt(min, max); };
  MathOralAgent.prototype._pick = function (arr) { return arr[this._randInt(0, arr.length - 1)]; };
  MathOralAgent.prototype._shuffle = function (arr) { return _PU.shuffle(arr); };

  // 表内乘法：两个因数 1~9（二年级乘法口诀表）
  MathOralAgent.prototype._mulTable = function () {
    var t = this.tableMax;
    var a = this._randInt(2, t);
    var b = this._randInt(2, t);
    return { text: a + ' × ' + b + ' =', answer: a * b };
  };

  // 表内除法：被除数 = 因数×因数，恰好整除（二年级除法口诀）
  MathOralAgent.prototype._divTable = function () {
    var t = this.tableMax;
    var a = this._randInt(2, t);
    var b = this._randInt(2, t);
    var dividend = a * b;
    return { text: dividend + ' ÷ ' + b + ' =', answer: a };
  };

  // 有余数除法：商……余数（两个输入框）
  MathOralAgent.prototype._divRemainder = function () {
    var t = Math.min(this.tableMax, 9);
    var divisor = this._randInt(2, t);
    var maxQ = Math.floor(this.maxNum / divisor);
    var q = this._randInt(2, Math.max(2, maxQ));
    var r = this._randInt(1, divisor - 1);
    var dividend = divisor * q + r;
    return {
      text: dividend + ' ÷ ' + divisor + ' =',
      answer: { q: q, r: r },
      multi: true
    };
  };

  // 混合运算：两级运算（×÷ 优先），结果非负，二年级
  MathOralAgent.prototype._generateMixed = function () {
    var t = this.tableMax;
    var a = this._randInt(2, t), b = this._randInt(2, t), c = this._randInt(1, 9);
    var op1 = this._pick(['×', '÷']);
    var op2 = this._pick(['+', '-']);
    var part, total, expr;
    if (op1 === '×') {
      part = a * b;
      expr = a + ' × ' + b + ' ' + op2 + ' ' + c;
    } else {
      part = a * b;          // 用 a×b 作为被除数，保证整除
      expr = part + ' ÷ ' + b + ' ' + op2 + ' ' + c;
      part = a;
    }
    total = op2 === '+' ? part + c : part - c;
    if (total < 0) return this._generateMixed();
    return { text: expr + ' =', answer: total };
  };

  // ---- 三年级专项：多位数乘一位数 ----
  MathOralAgent.prototype._genMulti1 = function () {
    var f = this._randInt(2, 9);
    var k = this._randInt(1, 6);
    var num;
    if (k <= 2) {                 // 整十整百口算（如 30×4、600×5）
      num = this._pick([20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 600, 800]);
    } else if (k <= 4) {          // 两位数乘一位数
      num = this._randInt(12, 98);
    } else {                      // 三位数乘一位数（含十位为 0，如 204×3）
      var h = this._randInt(1, 4);
      var tens = this._pick([0, this._randInt(1, 9)]);
      num = h * 100 + tens * 10 + this._randInt(1, 9);
      if (tens === 0 && this._randInt(1, 3) === 1) num = h * 100 + this._randInt(1, 9);
    }
    var answer = num * f;
    return { text: num + ' × ' + f + ' =', answer: answer };
  };

  // ---- 三年级专项：两位数乘两位数 ----
  MathOralAgent.prototype._genTwoDigit = function () {
    var a = this._randInt(12, 29);
    if (this._randInt(1, 3) === 1) a = this._randInt(21, 49);
    var b = this._randInt(12, 29);
    return { text: a + ' × ' + b + ' =', answer: a * b };
  };

  // ---- 三年级专项：除数是一位数的除法 ----
  MathOralAgent.prototype._genDiv1 = function () {
    var d = this._randInt(2, 9);
    var k = this._randInt(1, 5);
    var q, a, text;
    if (k <= 2) {                 // 整十整百口算（如 420÷6、800÷4）
      q = this._pick([30, 40, 50, 60, 70, 80, 90, 100, 120, 200, 240, 300, 360, 400, 500, 600, 800]);
      a = d * q;
    } else if (k === 3) {         // 商为两位数
      q = this._randInt(11, 99);
      a = d * q;
    } else {                      // 商为三位数（含商中间/末尾有 0，如 408÷4=102）
      var type = this._randInt(1, 3);
      if (type === 1) q = this._randInt(101, 199);          // 中间百位后随机
      else if (type === 2) q = this._randInt(100, 190) - (this._randInt(100, 190) % 10); // 末尾为 0
      else q = Math.floor(this._randInt(101, 399) / 10) * 10;
      a = d * q;
    }
    text = a + ' ÷ ' + d + ' =';
    return { text: text, answer: a / d };
  };

  // ---- 三年级专项：同分母分数加减（答为 a/b 形式） ----
  MathOralAgent.prototype._genFraction = function () {
    var op = this._pick(['+', '-']);
    var ansText, text;
    if (op === '+') {
      // 加法结果须为真分数：分母从 3 起，分子 ≤ d-2，保证 a+c < d
      var d = this._pick([3, 4, 5, 6, 8, 10]);
      var a = this._randInt(1, d - 2);
      var c = this._randInt(1, d - 1 - a);
      ansText = (a + c) + '/' + d;
      text = a + '/' + d + ' + ' + c + '/' + d + ' =';
    } else {
      var d2 = this._pick([2, 3, 4, 5, 6, 8, 10]);
      if (this._randInt(1, 2) === 1 || d2 === 2) {  // 1 - b/d = (d-b)/d（d=2 时只能走此分支）
        var b = this._randInt(1, d2 - 1);
        ansText = (d2 - b) + '/' + d2;
        text = '1 - ' + b + '/' + d2 + ' =';
      } else {                                    // 同分母相减 a/d - c/d（a≥2 保证差为正）
        var a2 = this._randInt(2, d2 - 1);
        var c2 = this._randInt(1, Math.min(a2 - 1, d2 - 1));
        ansText = (a2 - c2) + '/' + d2;
        text = a2 + '/' + d2 + ' - ' + c2 + '/' + d2 + ' =';
      }
    }
    return { text: text, answer: ansText };
  };

  // ---- 三年级专项：一位小数加减 ----
  MathOralAgent.prototype._genDecimal = function () {
    var aT = this._randInt(0, 9), bT = this._randInt(0, 9);
    if (aT === 0 && bT === 0) { aT = this._randInt(1, 9); }
    var aW = this._randInt(0, 9), bW = this._randInt(0, 9);
    var op = this._pick(['+', '-']);
    var af = aW * 10 + aT, bf = bW * 10 + bT, answer, text;
    if (op === '+') {
      answer = (af + bf) / 10;
      text = (aW + '.' + aT) + ' + ' + (bW + '.' + bT) + ' =';
    } else {
      if (af < bf) { var t = af; af = bf; bf = t; }
      answer = (af - bf) / 10;
      text = (Math.floor(af / 10) + '.' + (af % 10)) + ' - ' + (Math.floor(bf / 10) + '.' + (bf % 10)) + ' =';
    }
    return { text: text, answer: answer };
  };

  MathOralAgent.prototype._generateOne = function () {
    // 混合运算模式：整卷都用混合运算
    if (this.mixed) return this._generateMixed();

    // ===== 三年级专项题型（subType）=====
    if (this.subType) {
      switch (this.subType) {
        case 'multi1': return this._genMulti1();
        case 'twodigit': return this._genTwoDigit();
        case 'div1': return this._genDiv1();
        case 'fraction': return this._genFraction();
        case 'decimal': return this._genDecimal();
        case 'md': {
          var mk = this._randInt(1, 5);
          if (mk <= 2) return this._genMulti1();
          if (mk <= 3) return this._genTwoDigit();
          return this._genDiv1();
        }
      }
      var k = this._randInt(1, 10);
      if (k <= 2) return this._genDecimal();
      if (k <= 3) return this._genFraction();
      if (k <= 6) return this._genMulti1();
      if (k <= 8) return this._genDiv1();
      // 剩余为万以内加减法
      var op = this._pick(['+', '-']);
      if (op === '+') {
        var a2 = this._randInt(100, 900), b2 = this._randInt(100, 900);
        return { text: a2 + ' + ' + b2 + ' =', answer: a2 + b2 };
      }
      var m1 = this._randInt(200, 999), m2 = this._randInt(100, m1 - 100);
      return { text: m1 + ' - ' + m2 + ' =', answer: m1 - m2 };
    }

    var op = this._pick(this.operators);
    var min = this.operandMin;
    var maxNum = this.maxNum;
    var a, b, answer, text;

    // 二年级表内乘除法优先使用乘法口诀表范围
    if (this.grade >= 2 && (op === '\u00d7' || op === '\u00f7')) {
      if (op === '\u00f7' && this.remainder) return this._divRemainder();
      return op === '\u00d7' ? this._mulTable() : this._divTable();
    }

    switch (op) {
      case '+':
        a = this._randInt(min, maxNum);
        b = this._randInt(min, maxNum);
        answer = a + b;
        if (answer > maxNum) {
          var scale = maxNum / answer;
          a = Math.max(min, Math.floor(a * scale));
          b = Math.max(min, Math.floor(b * scale));
          answer = a + b;
        }
        text = a + ' + ' + b + ' =';
        break;

      case '-':
        a = this._randInt(Math.max(2, min), maxNum);
        b = this._randInt(min, maxNum);
        if (this.noNegative) {
          if (b > a) { var t = a; a = b; b = t; }
          if (a === b) a = this._randInt(Math.max(b + 1, min + 1), maxNum);
        }
        answer = a - b;
        text = a + ' \u2212 ' + b + ' =';
        break;

      case '\u00d7': // ×（三年级以上非表内，仍走原逻辑）
        var maxF1 = Math.max(min, Math.floor(maxNum / min));
        a = this._randInt(min, maxF1);
        var maxF2 = Math.floor(maxNum / a);
        b = this._randInt(min, Math.max(min, maxF2));
        answer = a * b;
        text = a + ' \u00d7 ' + b + ' =';
        break;

      case '\u00f7': // ÷（三年级以上非表内）
        var maxDiv = Math.max(min, Math.floor(maxNum / min));
        b = this._randInt(min, Math.min(maxDiv, maxNum));
        if (this.exactDiv) {
          var maxQ = Math.floor(maxNum / b);
          var q = this._randInt(Math.max(1, min), Math.max(min, maxQ));
          a = b * q;
          answer = q;
        } else {
          a = this._randInt(Math.max(b, min * b), maxNum);
          answer = parseFloat((a / b).toFixed(2));
        }
        text = a + ' \u00f7 ' + b + ' =';
        break;
    }
    return { text: text, answer: answer };
  };

  MathOralAgent.prototype.generate = function () {
    var questions = [];
    var seen = {};
    var maxAttempts = Math.max(this.count * 3, 50);
    var attempts = 0;

    while (questions.length < this.count && attempts < maxAttempts) {
      var q = this._generateOne();
      attempts++;
      var key = q.text + (q.multi ? '...' + q.answer.q + 'r' + q.answer.r : '');
      if (!seen[key]) {
        seen[key] = true;
        questions.push(q);
      }
    }

    while (questions.length < this.count) {
      questions.push(this._generateOne());
    }

    var shuffled = this._shuffle(questions);
    var opStr = this.operators.map(function (o) { return OP_NAMES[o]; }).join('\u3001');
    var hasRemainder = shuffled.some(function (q) { return q.multi; });
    var title = this.subType
      ? ((SUB_TYPE_NAMES[this.subType] || '三年级') + '口算练习题' + (hasRemainder ? '（含有余数除法）' : ''))
      : (this.maxNum + '以内' + (this.mixed ? '混合运算' : opStr) + '口算练习题' + (hasRemainder ? '（含有余数除法）' : ''));

    return {
      questions: shuffled,
      meta: {
        grade:      this.grade,
        maxNum:     this.maxNum,
        count:      this.count,
        operators:  this.operators,
        subType:    this.subType || null,
        title:      title,
        minOperand: this.operandMin,
        time:       new Date().toISOString(),
      },
    };
  };

  // ============ 批改（复用 PluginUtil.computeResult，自定义 checkFn 保持原判定） ============
  /** 数值容错比较（与原 isOralRight 一致：允许 0.005 内误差，兼容小数除法） */
  function isOralRight(user, real) {
    if (user == null || user === '') return false;
    var u = parseFloat(user);
    var t = Number(real);
    if (isNaN(u) || isNaN(t)) return String(user).trim() === String(real).trim();
    return Math.abs(u - t) < 0.005;
  }
  /** computeResult 的 checkFn：普通题比对单值，有余数除法比对 商/余 两框 */
  function oralCheckFn(q, ua, i) {
    var ans = q.answer;
    if (ans && typeof ans === 'object' && ans.q != null) {
      return isOralRight(ua[i + ':0'], ans.q) && isOralRight(ua[i + ':1'], ans.r);
    }
    return isOralRight(ua[i], ans);
  }

  // ============ ExercisePlugin ============
  /** @type {ExercisePlugin} */
  var mathOralPlugin = {
    id: 'math-oral',
    name: '表内乘除法口算',
    grades: [1, 2, 3],
    subject: 'math',
    category: 'number',
    printConfig: { pageType: 'math' },

    // 设置面板元数据（practice.html 据此动态生成控件）
settings: [
      {
        key: 'type',
        label: '运算类型',
        default: 'mix',
        options: [
          { value: 'mix',    label: '混合' },
          { value: 'addsub', label: '加减法' },
          { value: 'muldiv', label: '乘除法' },
          { value: 'remainder', label: '有余数除法' },
          { value: 'mixed', label: '混合运算' },
          { value: 'multi1', label: '多位数乘一位数' },
          { value: 'twodigit', label: '两位数乘两位数' },
          { value: 'div1', label: '除数是一位数的除法' },
          { value: 'fraction', label: '同分母分数加减' },
          { value: 'decimal', label: '一位小数加减' }
        ]
      }
    ],

    generate(options) {
      var opts = options || {};
      var grade = opts.grade || 1;
      var operators = opts.operators;
      var remainder = opts.remainder;
      var mixed = opts.mixed;
      var subType = null;
      // 三年级专项题型（仅三年级及以上可用）
      var g3Types = { multi1: 1, twodigit: 1, div1: 1, fraction: 1, decimal: 1 };
      if (opts.type && g3Types[opts.type]) {
        if (grade >= 3) subType = opts.type;
        else operators = null; // 低年级选择三年级题型时回退默认
      } else if (opts.type === 'muldiv' && grade >= 3) {
        subType = 'md'; // 三年级「乘除法」＝多位数乘一位数/两位数乘两位数/除数是一位数
      }
      if (!operators && opts.type) {
        // 有余数除法/混合运行为二年级特性，一年级不可用
        if (opts.type === 'addsub') operators = ['+', '-'];
        else if (opts.type === 'muldiv') { if (grade < 3) operators = ['×', '÷']; }
        else if (opts.type === 'remainder') { operators = grade >= 2 ? ['÷'] : null; remainder = grade >= 2; }
        else if (opts.type === 'mixed') { operators = grade >= 2 ? ['+', '-', '×', '÷'] : null; mixed = grade >= 2; }
        else operators = null; // mix → 使用年级默认
      }
      var agent = new MathOralAgent({
        grade: opts.grade || 1,
        maxNum: opts.maxNum,
        count: opts.count || 10,
        operators: operators,
        subType: subType,
        noNegative: opts.noNegative,
        exactDiv: opts.exactDiv,
        remainder: remainder,
        mixed: mixed,
        difficulty: opts.difficulty
      });
      var result = agent.generate();
      var questions = result.questions.map(function (q) {
        var isRem = q.answer && typeof q.answer === 'object' && q.answer.q != null;
        return {
          type: 'oral',
          q: q.text,
          answer: q.answer,
          inputType: isRem ? 'multi' : 'text',
          inputCount: isRem ? 2 : 1,
          answerParts: isRem ? [q.answer.q + '……' + q.answer.r] : undefined,
          hint: isRem ? '前框填商，后框填余数' : undefined
        };
      });
      return { questions: questions, meta: result.meta };
    },

    render(exerciseSet) {
      var cols = (exerciseSet.meta && exerciseSet.meta.columns) || 4;
      // 统一使用 PluginUtil.renderGrid（renderCard），减少自定义渲染代码
      return _PU.renderGrid(exerciseSet.questions, { columns: cols });
    },

    check(exerciseSet, userAnswers) {
      // 复用 PluginUtil.computeResult，自定义 oralCheckFn 保持原判定（含小数容差与有余数双框）
      return _PU.computeResult(exerciseSet.questions, userAnswers, { checkFn: oralCheckFn });
    }
  };

  // ============ 导出 ============
  global.MathOralAgent = MathOralAgent;        // 兼容旧页面 math-practice.html
  global.__currentPlugin = mathOralPlugin;     // practice.html / dev/plugin-check.html

  if (typeof module !== 'undefined' && module.exports) module.exports = mathOralPlugin;

})(typeof window !== 'undefined' ? window : globalThis);