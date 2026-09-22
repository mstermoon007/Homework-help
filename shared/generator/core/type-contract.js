/**
 * shared/generator/core/type-contract.js — P25-07 七题型教育契约执行层
 *
 * 契约 SSOT：kbl/teaching/type-contracts.json（声明制，计算路径读取，禁止 bundle 内联）。
 * 本模块是契约的可执行投影：
 *   ① check(qt, sq)        — 按 7 题型结构不变式逐题断言（纯代码，bundle 可用）；
 *   ② finishers            — convertible 题型（choice/judge/fill/apply）的机械转换器：
 *                            不合规产出在 selector 单点 finish 成合规形态，不可转换 → 返回 null；
 *   ③ enforce(sqs, plan)   — wrapGenerator 单点接入：合规保留 / convertible finish 后复检 /
 *                            form-bound（calc/geometry/classify）不合规直接 drop（fail-closed）。
 *
 * 红线映射：
 *   - 不新增题型、不改写教育语义：finisher 只做形态归一（空位/选项/布尔/情境包装），
 *     答案数值与运算关系保持不变（judge 的 shown 值派生自原答案 ±1，真值随之机械确定）。
 *   - fail-closed：finisher 不可转换 → drop，绝不静默放行或回退其他题型。
 *   - choice 双约定归一：selection 系用「值约定」（answer.value ∈ options），
 *     shape 系历史用「索引约定」（answer.value = String(correctIndex)）——
 *     不变式两者都接受，finisher 统一归一为值约定。
 *   - 纯代码模块：不读知识层文件（kbl-access 门禁），不依赖 KnowledgeContext；
 *     契约 JSON 仅由 dev 审计脚本对齐校验（JSON↔code 不变式 id 一致性）。
 */
(function (global) {
  'use strict';

  var Rng = require('./rng.js');

  var SCHEMA_VERSION = 'p25-07.1';

  /**
   * 题型 → 不变式 id 序列（与 kbl/teaching/type-contracts.json contracts[].invariants
   * 逐条对齐；dev/p25/audit-type-contract.js 断言两侧一致）。
   */
  var CONTRACT_MAP = {
    calc: ['expressionPresent'],
    fill: ['blankPresent'],
    choice: ['optionsPresent', 'answerInOptions'],
    judge: ['booleanAnswer'],
    geometry: ['graphicOrInstruction'],
    classify: ['groupStructure'],
    apply: ['contextPresent']
  };

  /** form-bound 题型：形态与内容绑定，候选生成器必须声明该题型（selector 声明门） */
  var FORM_BOUND = ['calc', 'geometry', 'classify'];

  /** 全部不变式 id（与 JSON invariantKinds 键集对齐） */
  var INVARIANT_IDS = ['optionsPresent', 'answerInOptions', 'booleanAnswer', 'blankPresent',
    'expressionPresent', 'contextPresent', 'graphicOrInstruction', 'groupStructure'];

  /* ------------------------------------------------------------------ *
   * 不变式判定
   * ------------------------------------------------------------------ */

  var BLANK_RE = /____|\(\s*\)|（\s*）/;
  var EXPR_RE = /\d\s*[+\-−×x*÷\/]\s*[\d.]/;
  var BLANK_EQ_RE = /\d\s*=\s*(____|\(\s*\)|（\s*）)/;
  var SETTING_RE = /[？?]/;
  var QWORD_RE = /多少|几|求/;
  var TASK_VERB_RE = /排列|整理|分类|排序|分组|推理|设计|搭配|解决|涂色|数一数/;
  var GEO_RE = /作图|画一画|画出|量一量|认一认|观察|看图|看示|示意图|线段图|在图上|图形|钟面|摆一摆|数一数|剪一|拼一|折一|七巧板/;
  var GROUP_RE = /分类|整理|排列|排序|分组/;

  function dataOf(sq) { return (sq && sq.data) ? sq.data : {}; }

  function checkOptionsPresent(sq) {
    var opts = dataOf(sq).options;
    if (!Array.isArray(opts) || opts.length < 3) return false;
    var seen = {};
    for (var i = 0; i < opts.length; i++) {
      if (typeof opts[i] !== 'string' || opts[i].length === 0) return false;
      if (seen[opts[i]]) return false;
      seen[opts[i]] = 1;
    }
    return true;
  }

  function checkAnswerInOptions(sq) {
    var d = dataOf(sq);
    var opts = d.options;
    if (!Array.isArray(opts) || !sq.answer || sq.answer.value == null) return false;
    var v = String(sq.answer.value);
    if (opts.map(String).indexOf(v) !== -1) return true;                       // 值约定
    if (d.correctIndex != null && v === String(d.correctIndex)                 // 索引约定
      && d.correctIndex >= 0 && d.correctIndex < opts.length) return true;
    return false;
  }

  function checkBooleanAnswer(sq) {
    return !!(sq.answer && typeof sq.answer.value === 'boolean');
  }

  function checkBlankPresent(sq) { return BLANK_RE.test(String(sq.prompt || '')); }

  function checkExpressionPresent(sq) {
    var p = String(sq.prompt || '');
    if (EXPR_RE.test(p)) return true;                    // 可求值算式
    if (dataOf(sq).operation) return true;               // data.operation 运算声明
    if (BLANK_EQ_RE.test(p)) return true;                // 空位等式（数字 = 空位）
    return false;
  }

  function checkContextPresent(sq) {
    var p = String(sq.prompt || '');
    if (p.replace(/\s/g, '').length < 10) return false;
    if (SETTING_RE.test(p)) return true;
    if (BLANK_RE.test(p)) return true;
    if (QWORD_RE.test(p)) return true;
    if (TASK_VERB_RE.test(p)) return true;
    return false;
  }

  function checkGraphicOrInstruction(sq) {
    var d = dataOf(sq);
    if (d.graphic && d.graphic.type) return true;
    if (d.shapeName) return true;
    return GEO_RE.test(String(sq.prompt || ''));
  }

  function checkGroupStructure(sq) {
    var d = dataOf(sq);
    if (d.sort || d.groups || d.categories) return true;
    return GROUP_RE.test(String(sq.prompt || ''));
  }

  var INVARIANTS = {
    optionsPresent: checkOptionsPresent,
    answerInOptions: checkAnswerInOptions,
    booleanAnswer: checkBooleanAnswer,
    blankPresent: checkBlankPresent,
    expressionPresent: checkExpressionPresent,
    contextPresent: checkContextPresent,
    graphicOrInstruction: checkGraphicOrInstruction,
    groupStructure: checkGroupStructure
  };

  /**
   * check(qt, sq) → { ok, violations[] }
   * violations 元素为不变式 id（与 CONTRACT_MAP / JSON invariantKinds 同一命名空间）。
   */
  function check(qt, sq) {
    var invariants = CONTRACT_MAP[qt];
    if (!invariants) return { ok: true, violations: [] };   // 非规范题型不约束（上游已归一）
    if (!sq) return { ok: false, violations: invariants.slice() };
    var violations = [];
    for (var i = 0; i < invariants.length; i++) {
      var fn = INVARIANTS[invariants[i]];
      if (fn && !fn(sq)) violations.push(invariants[i]);
    }
    return { ok: violations.length === 0, violations: violations };
  }

  /* ------------------------------------------------------------------ *
   * Finisher 公共工具（确定性：种子取自题目自身）
   * ------------------------------------------------------------------ */

  function rngFor(sq) {
    var base = (sq && sq.seed != null) ? String(sq.seed)
      : String((sq && sq.knowledgePointId) || '') + '|' + String((sq && sq.prompt) || '');
    return Rng.createSeededRandom(base + ':type-contract');
  }

  /** 答案字符串 → 纯数值 { num, suffix }（suffix 支持 '%'）；非纯数值返回 null */
  function parseAnswerNum(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    var m = /^(-?\d+(?:\.\d+)?)(%)?$/.exec(s);
    if (!m) return null;
    return { num: parseFloat(m[1]), suffix: m[2] || '' };
  }

  /** 余数答案「q……r」/「q余r」→ { q, r, mark }；否则 null */
  function parseAnswerRemainder(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    var m = /^(\d+)\s*(……|余)\s*(\d+)$/.exec(s);
    if (!m) return null;
    return { q: parseInt(m[1], 10), mark: m[2], r: parseInt(m[3], 10) };
  }

  /** 答案字符串为纯数字序列（≥3 个）→ number[]；否则 null */
  function parseSeq(sq) {
    if (!sq || !sq.answer || sq.answer.value == null) return null;
    var s = String(sq.answer.value).trim();
    if (!/^[\d，,\s、.]+$/.test(s)) return null;
    var parts = s.split(/[，,、\s]+/).filter(Boolean);
    if (parts.length < 3) return null;
    var nums = [];
    for (var i = 0; i < parts.length; i++) {
      var n = Number(parts[i]);
      if (!isFinite(n)) return null;
      nums.push(n);
    }
    return nums;
  }

  function sortNums(nums, desc) {
    var c = nums.slice().sort(function (a, b) { return a - b; });
    return desc ? c.reverse() : c;
  }

  /** 相邻交换产生一个必然不同的排列（fail 时整体反转） */
  function swapped(seq, rng) {
    if (!seq || seq.length < 2) return null;
    for (var t = 0; t < seq.length * 2; t++) {
      var i = Rng.randInt(rng, 0, seq.length - 2);
      var s = seq.slice();
      var tmp = s[i]; s[i] = s[i + 1]; s[i + 1] = tmp;
      var same = true;
      for (var k = 0; k < s.length; k++) { if (s[k] !== seq[k]) { same = false; break; } }
      if (!same) return s;
    }
    return seq.slice().reverse();
  }

  function numStr(n) { return String(n); }

  /* ------------------------------------------------------------------ *
   * choice finisher
   * ------------------------------------------------------------------ */

  function tidyChoicePrompt(p) {
    p = String(p || '');
    p = p.replace(/^列式计算[:：]\s*/, '');
    p = p.replace(/=\s*[？?]\s*$/, '=（ ）');
    p = p.replace(/=\s*$/, '=（ ）');
    return p;
  }

  function buildNumericOptions(rng, correct, suffix) {
    var abs = Math.abs(correct);
    var step = abs < 20 ? 1 : (abs < 100 ? 10 : 100);
    var cands = [correct + step, correct - step, correct + 2 * step, correct - 2 * step, correct * 2];
    if (correct > 0 && correct % 2 === 0) cands.push(correct / 2);
    var opts = [correct];
    for (var i = 0; i < cands.length && opts.length < 4; i++) {
      var c = cands[i];
      if (correct >= 0 && c < 0) continue;                 // 小学场景不出负数干扰项
      if (c !== correct && opts.indexOf(c) === -1) opts.push(c);
    }
    var pad = 1;
    while (opts.length < 4) {
      var e = correct + pad * step + pad;
      if (e !== correct && opts.indexOf(e) === -1) opts.push(e);
      pad++;
    }
    return Rng.shuffle(rng, opts).map(function (n) { return numStr(n) + (suffix || ''); });
  }

  function finishChoice(sq, rng) {
    var d = dataOf(sq);
    var opts = d.options;

    // ① options 可信但 answer.value 与 options 脱节（索引约定/错位）→ 归一为值约定
    if (Array.isArray(opts) && opts.length >= 3 && sq.answer && sq.answer.value != null
      && d.correctIndex != null && d.correctIndex >= 0 && d.correctIndex < opts.length
      && opts.every(function (o) { return typeof o === 'string' || typeof o === 'number'; })
      && opts.map(String).indexOf(String(sq.answer.value)) === -1
      && String(sq.answer.value) === String(d.correctIndex)) {
      d.options = opts.map(String);
      sq.answer.value = String(d.options[d.correctIndex]);
      return { fixed: ['answerInOptions'] };
    }

    // ② options 缺失/过短 + 纯数值答案 → 数值近邻干扰项重建
    if (!Array.isArray(opts) || opts.length < 3) {
      var an = parseAnswerNum(sq);
      if (an) {
        var built = buildNumericOptions(rng, an.num, an.suffix);
        d.options = built;
        d.correctIndex = built.indexOf(String(an.num) + an.suffix);
        sq.answer.value = String(an.num) + an.suffix;
        sq.prompt = tidyChoicePrompt(sq.prompt);
        return { fixed: ['optionsPresent', 'answerInOptions'] };
      }
      var rem = parseAnswerRemainder(sq);
      if (rem) {
        var cand = [];
        var push = function (q, r) { var s = q + '……' + r; if (cand.indexOf(s) === -1 && s !== rem.q + '……' + rem.r) cand.push(s); };
        push(rem.q + 1, rem.r); if (rem.q > 1) push(rem.q - 1, rem.r);
        push(rem.q, rem.r + 1); if (rem.r > 0) push(rem.q, rem.r - 1);
        push(rem.q + 1, rem.r + 1);
        if (cand.length < 3) return null;
        var ropts = [rem.q + '……' + rem.r, cand[0], cand[1], cand[2]];
        var shuffled = Rng.shuffle(rng, ropts);
        d.options = shuffled;
        d.correctIndex = shuffled.indexOf(rem.q + '……' + rem.r);
        sq.answer.value = rem.q + '……' + rem.r;
        sq.prompt = tidyChoicePrompt(sq.prompt);
        return { fixed: ['optionsPresent', 'answerInOptions'] };
      }
    }

    // ③ 序列答案（分类排列）→ 置换干扰项
    var seq = parseSeq(sq);
    if (seq) {
      var correctStr = seq.join('，');
      var sopts = [correctStr];
      var guard = 0;
      while (sopts.length < 4 && guard < 10) {
        guard++;
        var sw = swapped(seq, rng);
        var s = sw ? sw.join('，') : null;
        if (s && sopts.indexOf(s) === -1) sopts.push(s);
      }
      if (sopts.length < 3) return null;
      var sh = Rng.shuffle(rng, sopts);
      d.options = sh;
      d.correctIndex = sh.indexOf(correctStr);
      d.sort = true;
      sq.answer.value = correctStr;
      return { fixed: ['optionsPresent', 'answerInOptions'] };
    }

    return null;   // 不可机械转换 → drop（fail-closed）
  }

  /* ------------------------------------------------------------------ *
   * judge finisher
   * ------------------------------------------------------------------ */

  function finishJudge(sq, rng) {
    var d = dataOf(sq);
    var p = String(sq.prompt || '');
    p = p.replace(/^列式计算[:：]\s*/, '');
    var an = parseAnswerNum(sq);

    if (an) {
      var isTrue = rng() < 0.5;
      var shown = isTrue ? an.num : an.num + 1;
      var shownStr = numStr(shown) + an.suffix;
      if (/=\s*[？?]\s*$/.test(p)) {
        p = p.replace(/=\s*[？?]\s*$/, '= ' + shownStr + '（对还是错？）');
      } else if (/=\s*$/.test(p)) {
        p = p.replace(/=\s*$/, '= ' + shownStr + '（对还是错？）');
      } else {
        p = p.replace(/[。？?]\s*$/, '') + '。有人说结果是 ' + shownStr + '，对还是错？';
      }
      sq.prompt = p;
      sq.answer.value = (shown === an.num);
      d.shownResult = shownStr;
      d.expectedResult = numStr(an.num) + an.suffix;
      return { fixed: ['booleanAnswer'] };
    }

    var rem = parseAnswerRemainder(sq);
    if (rem) {
      var isTrue2 = rng() < 0.5;
      var shown2 = isTrue2 ? rem : { q: rem.q + 1, mark: rem.mark, r: rem.r };
      var shownStr2 = shown2.q + '……' + shown2.r;
      var p2 = /=\s*[？?]?\s*$/.test(p)
        ? p.replace(/=\s*[？?]\s*$/, '').replace(/=\s*$/, '= ' + shownStr2 + '（对还是错？）')
        : (p.replace(/[。？?]\s*$/, '') + '。有人说结果是 ' + shownStr2 + '，对还是错？');
      sq.prompt = p2;
      sq.answer.value = isTrue2;
      d.shownResult = shownStr2;
      return { fixed: ['booleanAnswer'] };
    }

    var seq = parseSeq(sq);
    if (seq) {
      var desc = /从大到小|大到小/.test(p);
      var correct = sortNums(seq, desc);
      var isTrue3 = rng() < 0.5;
      var shownSeq = isTrue3 ? correct : swapped(correct, rng);
      if (!isTrue3 && shownSeq.join('，') === correct.join('，')) shownSeq = correct.slice().reverse();
      var base = p.replace(/[。？?]\s*$/, '');
      sq.prompt = base + '。小明排出：' + shownSeq.join('，') + '——对还是错？';
      sq.answer.value = isTrue3;
      d.shownResult = shownSeq.join('，');
      d.expectedResult = correct.join('，');
      return { fixed: ['booleanAnswer'] };
    }

    return null;
  }

  /* ------------------------------------------------------------------ *
   * fill finisher
   * ------------------------------------------------------------------ */

  function finishFill(sq) {
    var p = String(sq.prompt || '');
    if (BLANK_RE.test(p)) return { fixed: [] };
    if (parseSeq(sq) && /[。]\s*$/.test(p)) {
      sq.prompt = p.replace(/[。]\s*$/, '') + '，排序结果是 ____。';
      return { fixed: ['blankPresent'] };
    }
    if (/=\s*[？?]\s*$/.test(p)) { sq.prompt = p.replace(/=\s*[？?]\s*$/, '= ____'); return { fixed: ['blankPresent'] }; }
    if (/=\s*$/.test(p)) { sq.prompt = p.replace(/=\s*$/, '= ____'); return { fixed: ['blankPresent'] }; }
    if (/[？?]\s*$/.test(p)) { sq.prompt = p.replace(/\s+$/, '') + ' 答：____'; return { fixed: ['blankPresent'] }; }
    if (/[:：]\s*$/.test(p)) { sq.prompt = p + ' ____'; return { fixed: ['blankPresent'] }; }
    if (/[。]\s*$/.test(p)) { sq.prompt = p.replace(/[。]\s*$/, '') + ' → ____。'; return { fixed: ['blankPresent'] }; }
    sq.prompt = p + ' ____';
    return { fixed: ['blankPresent'] };
  }

  /* ------------------------------------------------------------------ *
   * apply finisher（裸算式 → 情境包装；答案数值不变）
   * ------------------------------------------------------------------ */

  function parseSingleExpr(p) {
    var ops = String(p || '').match(/[+\-−×x*÷\/]/g);
    if (!ops || ops.length !== 1) return null;
    var m = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)/.exec(p);
    if (!m) return null;
    return { a: parseFloat(m[1]), op: m[2], b: parseFloat(m[3]) };
  }

  function parseDoubleExpr(p) {
    var m = /(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷\/])\s*(-?\d+(?:\.\d+)?)/.exec(p || '');
    if (!m) return null;
    return { a: parseFloat(m[1]), op1: m[2], b: parseFloat(m[3]), op2: m[4], c: parseFloat(m[5]) };
  }

  function opName(ch) {
    if (ch === '+') return 'add';
    if (ch === '-' || ch === '−') return 'sub';
    if (ch === '×' || ch === 'x' || ch === '*') return 'mult';
    return 'div';
  }

  function applyStorySingle(e, p) {
    var a = e.a, b = e.b, op = e.op;
    if ((op === '×' || op === 'x' || op === '*') && /%/.test(p)) {
      // 百分数乘法：a × b% 或 a% × b（谁带 % 谁是比率）
      var m1 = /(\d+(?:\.\d+)?)\s*%\s*[×x*]/.exec(p);
      if (m1) {
        var rate = parseFloat(m1[1]);
        return '一件商品现价是原价的 ' + rate + '%，原价 ' + b + ' 元，现价是多少元？';
      }
      var rate2 = /%/.test(String(b) ) ? a : b;
      var base2 = /%/.test(String(b)) ? b : a;
      return '一件商品原价 ' + base2 + ' 元，现按原价的 ' + rate2 + '% 出售，现价是多少元？';
    }
    if (op === '+') return '小明买一支钢笔用去 ' + a + ' 元，又买一个笔袋用去 ' + b + ' 元，一共用去多少元？';
    if (op === '-' || op === '−') {
      if (a >= b) return '小明有 ' + a + ' 元零花钱，买文具用去 ' + b + ' 元，还剩多少元？';
      return '小明买文具用去 ' + a + ' 元，付给收银员 ' + b + ' 元，应找回多少元？';
    }
    if (op === '×' || op === 'x' || op === '*') {
      return '每盒鸡蛋有 ' + a + ' 个，买了 ' + b + ' 盒，一共有多少个鸡蛋？';
    }
    // ÷
    if (b === 0) return null;
    if (a % b === 0) return '把 ' + a + ' 个苹果平均分给 ' + b + ' 个小朋友，每人分得多少个？';
    return '有 ' + a + ' 个苹果，每 ' + b + ' 个装一袋，可以装满多少袋，还剩几个？';
  }

  function applyStoryDouble(e) {
    var o1 = opName(e.op1), o2 = opName(e.op2);
    var a = e.a, b = e.b, c = e.c;
    var key = o1 + ',' + o2;
    switch (key) {
      case 'add,add': return '水果店上午卖出 ' + a + ' 箱苹果，中午卖出 ' + b + ' 箱，下午卖出 ' + c + ' 箱，一天一共卖出多少箱？';
      case 'add,sub': return '小明有 ' + a + ' 元，爸爸又给他 ' + b + ' 元，买文具用去 ' + c + ' 元，现在有多少元？';
      case 'sub,add': return '公交车上有 ' + a + ' 人，到站后下去 ' + b + ' 人，又上来 ' + c + ' 人，现在车上有多少人？';
      case 'sub,sub': return '小明有 ' + a + ' 元，买书用去 ' + b + ' 元，买笔用去 ' + c + ' 元，还剩多少元？';
      case 'mult,add': return '一套书每本 ' + a + ' 元，买 ' + b + ' 本，加配送费 ' + c + ' 元，一共要付多少元？';
      case 'mult,sub': return '每支笔 ' + a + ' 元，买 ' + b + ' 支，用会员卡立减 ' + c + ' 元，一共要付多少元？';
      case 'div,add': return '把 ' + a + ' 颗糖平均分给 ' + b + ' 个小朋友后，老师又给每人 ' + c + ' 颗，每人现在有多少颗？';
      case 'div,sub': return '把 ' + a + ' 颗糖平均分给 ' + b + ' 个小朋友，小华分到后吃掉 ' + c + ' 颗，小华还剩多少颗？';
      default:
        return '按下面的数量关系解决问题：' + a + ' ' + e.op1 + ' ' + b + ' ' + e.op2 + ' ' + c
          + '。先算出最后结果，再写清每一步求的是什么，结果是多少？';
    }
  }

  function finishApply(sq) {
    if (checkContextPresent(sq)) return { fixed: [] };     // 情境/任务指令已合规 → noop
    var p = String(sq.prompt || '');
    var single = parseSingleExpr(p);
    if (single) {
      var story = applyStorySingle(single, p);
      if (story) { sq.prompt = story; return { fixed: ['contextPresent'] }; }
    }
    var dbl = parseDoubleExpr(p);
    if (dbl) {
      sq.prompt = applyStoryDouble(dbl);
      return { fixed: ['contextPresent'] };
    }
    return null;
  }

  /* ------------------------------------------------------------------ *
   * enforce：wrapGenerator 单点接入（fail-closed）
   * ------------------------------------------------------------------ */

  var FINISHERS = { choice: finishChoice, judge: finishJudge, fill: finishFill, apply: finishApply };

  function trace(sq, action, violations, fixed) {
    sq.metadata = sq.metadata || {};
    sq.metadata.typeContract = { action: action, violations: violations || [], fixed: fixed || [] };
  }

  /**
   * enforce(sqs, plan) → 过滤后的题目集合（原对象或同构 {questions}）。
   *   合规                     → 保留（trace: pass）
   *   convertible 且可 finish  → finish 后复检合规才保留（trace: finish）
   *   form-bound 不合规 / 不可转换 / 复检仍不合规 → drop（trace: drop）
   */
  function enforce(sqs, plan) {
    if (!sqs) return sqs;
    var isArr = Array.isArray(sqs);
    var arr = isArr ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
    if (!arr) return sqs;
    var qt = plan ? String(plan.questionTypeId || plan.questionType || '') : '';
    var out = [];
    for (var i = 0; i < arr.length; i++) {
      var sq = arr[i];
      if (!sq) continue;
      // 裸值答案归一：legacy 生成器存在 answer 为裸 string/number/boolean（索引约定/布尔约定）
      // 而非 { value, acceptable } 对象形态的产出，先机械归一为对象形态再检查。
      // boolean 保留原始类型（judge 契约要求 answer.value 为 boolean，不得串化）。
      if (sq.answer != null && (typeof sq.answer === 'string' || typeof sq.answer === 'number' || typeof sq.answer === 'boolean')) {
        sq.answer = { value: typeof sq.answer === 'boolean' ? sq.answer : String(sq.answer), acceptable: [] };
      }
      var res = check(qt, sq);
      // P28-48：choice 题的作答形态恒为选项点选（optionsPresent 已成立）。
      // 原生生成器（如 arithmetic 经机械转换路径）可能仍写 answerMode:'input'，
      // 会让渲染层同时画出 radio 与文本框；enforce 是形态归一收口，统一纠正为 'choice'。
      if (res.ok) { if (qt === 'choice') sq.answerMode = 'choice'; trace(sq, 'pass', [], []); out.push(sq); continue; }
      var finisher = FORM_BOUND.indexOf(qt) === -1 ? FINISHERS[qt] : null;
      var fixed = null;
      if (finisher) {
        try { fixed = finisher(sq, rngFor(sq)); } catch (e) { fixed = null; }
      }
      if (!fixed) { trace(sq, 'drop', res.violations, []); continue; }
      var re = check(qt, sq);
      if (!re.ok) { trace(sq, 'drop', re.violations, fixed.fixed || []); continue; }
      if (qt === 'choice') sq.answerMode = 'choice';
      trace(sq, 'finish', res.violations, fixed.fixed || []);
      out.push(sq);
    }
    if (isArr) { arr.length = 0; for (var j = 0; j < out.length; j++) arr.push(out[j]); return sqs; }
    sqs.questions = out;
    return sqs;
  }

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    CONTRACT_MAP: CONTRACT_MAP,
    FORM_BOUND: FORM_BOUND,
    INVARIANT_IDS: INVARIANT_IDS,
    INVARIANTS: INVARIANTS,
    check: check,
    enforce: enforce
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.TypeContract = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
