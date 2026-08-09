/**
 * MathOralAgent — 数学口算题目生成器
 * 
 * 无状态设计：每个实例仅通过 generate() 返回数据，不持有题目状态。
 * 多用户并发：每个请求 new 一个实例即可，互不干扰。
 * 
 * 规则：
 * 1. 年级越高，难度越高（gradeFactor 递增）
 * 2. maxNum 越大，难度越高（操作数下限等比提高）
 * 3. maxNum 越大，小数值加减乘除越少（操作数下限 = maxNum × factor）
 * 4. 扩大随机数值阈，避免重复（乘法/除法因子范围 = maxNum/minOp，生成时 Set 去重 + Fisher-Yates 洗牌）
 * 
 * 用法：
 *   const agent = new MathOralAgent({ grade: 2, maxNum: 100, count: 30 });
 *   const { questions, meta } = agent.generate();
 */
var MathOralAgent = (function () {
  'use strict';

  var GRADE_CONFIG = {
    1: { factor: 0.03, defaultMax: 20,  defaultCount: 20, allowMulDiv: false },
    2: { factor: 0.06, defaultMax: 50,  defaultCount: 30, allowMulDiv: true  },
    3: { factor: 0.10, defaultMax: 100, defaultCount: 40, allowMulDiv: true  },
  };

  var OP_NAMES = { '+': '加法', '-': '减法', '×': '乘法', '÷': '除法' };

  function MathOralAgent(options) {
    options = options || {};
    var cfg = GRADE_CONFIG[options.grade] || GRADE_CONFIG[1];
    this.grade      = options.grade;
    this.maxNum     = options.maxNum != null ? options.maxNum : cfg.defaultMax;
    this.count      = options.count  != null ? options.count  : cfg.defaultCount;
    this.noNegative = options.noNegative !== false;
    this.exactDiv   = options.exactDiv !== false;
    this.operators  = options.operators || (cfg.allowMulDiv ? ['+', '-', '×', '÷'] : ['+', '-']);
    this._factor    = cfg.factor;
  }

  // ── 操作数下限：maxNum × 年级系数 ──
  Object.defineProperty(MathOralAgent.prototype, 'operandMin', {
    get: function () {
      return Math.max(1, Math.floor(this.maxNum * this._factor));
    }
  });

  // ── 随机工具（crypto优先） ──
  MathOralAgent.prototype._randInt = function (min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  };

  MathOralAgent.prototype._pick = function (arr) {
    return arr[this._randInt(0, arr.length - 1)];
  };

  MathOralAgent.prototype._shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = this._randInt(0, i);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  };

  // ── 单题生成 ──
  MathOralAgent.prototype._generateOne = function () {
    var op = this._pick(this.operators);
    var min = this.operandMin;
    var maxNum = this.maxNum;
    var a, b, answer, text;

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

      case '\u00d7': // ×
        var maxF1 = Math.max(min, Math.floor(maxNum / min));
        a = this._randInt(min, maxF1);
        var maxF2 = Math.floor(maxNum / a);
        b = this._randInt(min, Math.max(min, maxF2));
        answer = a * b;
        text = a + ' \u00d7 ' + b + ' =';
        break;

      case '\u00f7': // ÷
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

  // ── 批量生成 ──
  MathOralAgent.prototype.generate = function () {
    var questions = [];
    var seen = {};
    var maxAttempts = Math.max(this.count * 3, 50);
    var attempts = 0;

    while (questions.length < this.count && attempts < maxAttempts) {
      var q = this._generateOne();
      attempts++;
      if (!seen[q.text]) {
        seen[q.text] = true;
        questions.push(q);
      }
    }

    while (questions.length < this.count) {
      questions.push(this._generateOne());
    }

    var shuffled = this._shuffle(questions);
    var opNames = OP_NAMES;
    var opStr = this.operators.map(function (o) { return opNames[o]; }).join('\u3001');

    return {
      questions: shuffled,
      meta: {
        grade:      this.grade,
        maxNum:     this.maxNum,
        count:      this.count,
        operators:  this.operators,
        title:      this.maxNum + '\u4ee5\u5185' + opStr + '\u53e3\u7b97\u7ec3\u4e60\u9898',
        minOperand: this.operandMin,
        time:       new Date().toISOString(),
      },
    };
  };

  return MathOralAgent;
})();