/**
 * shared/generator/generators/arithmetic.js — M4-R06 算术族核心 Generator
 *
 * addition / subtraction / multiplication / division / mixed-calculation
 *
 * 抽离核心随机数生成 / 操作数生成 / 结构生成 / 答案计算 / 干扰项生成；
 * 输出 SemanticQuestion（无渲染逻辑）；难度/结构全部来自 QuestionPlan 约束。
 */
'use strict';

var Rng = require('../core/rng.js');
var Arith = require('../core/arithmetic-core.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

// P28-NAME-MIGRATION-02：kind 派生迁至 semantic-parameters.js（SSOT 边界），
// 经 plan.semanticParams.kind 暴露。本生成器只读不改写；保留 op='div' 防御层确保
// mixed 生成器在余数 KP 上不误派生（mixed op≠'div' 不命中 → 走通用结构）。余数 KP
// （math-g2-down-u02-k001）路由到 generator:arithmetic-division → op='div' → 命中。

// Refactor Step 2：QuestionPlan 主知识点 ID（数组唯一语义；边界兼容旧单数）
function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

var FAMILY = {
  addition: { op: 'add' },
  subtraction: { op: 'sub' },
  multiplication: { op: 'mult' },
  division: { op: 'div' },
  'mixed-calculation': { op: 'mixed' }
};

// P34-12：解析必须讲清「为什么这样算」，不再用题面复述（问号尾）或裸算式冒充 explanation。
// 运算意义词为各运算的教学含义（与 buildApplyStory 的情境语义一一对应），按生成器运算取。
var OP_MEANING = {
  add: '把两部分合起来求总数，用加法',
  sub: '从总数里去掉一部分求剩余，用减法',
  mult: '求几个相同加数的和，用乘法',
  div: '把总数平均分成几份、求每份是多少，用除法',
  mixed: '按照先乘除后加减的运算顺序计算'
};

// P28-GEO-NATIVE-02：分数乘法单元 geometry 原生 maker（g6-up-u02-k002/k003/k004）。
// 源 Excel 将该单元标在「图形与几何」域，三 KP 各有 geometry ALLOW 行，此前被 shape
// kp=0 泛型兜底成无关认图题。mixed 生成器 kp=1 且声明 geometry 后自然承接，
// 用线段图（diagram.segment，对象参数、渲染器现成）承载「求一个数的几分之几」。
function makeFractionMultiplyGeometryQuestion(plan, context, i, seedFn) {
  var rng = Rng.createSeededRandom(seedFn(plan, context, i));
  var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
  var prompt, answer, graphic, modelKind, geoWhy = null;

  if (kpName.indexOf('混合') !== -1) {
    // k003：运算律——乘法分配律的线段模型 (1/4 + 2/4) × 8
    var total3 = 8;
    var part3 = 6;
    modelKind = 'fraction-distributive';
    prompt = '看图用乘法分配律简便计算：一条线段长 ' + total3 + ' 米，先取它的 1/4，' +
      '再取它的 2/4，两次一共取了多少米？(1/4 + 2/4) × ' + total3 + ' = ____';
    answer = String(part3);
    geoWhy = '两次共取全长的 1/4 + 2/4 = 3/4，用乘法分配律：(1/4 + 2/4) × ' + total3
      + ' = 3/4 × ' + total3 + ' = ' + part3 + '（米）';
    graphic = {
      type: 'geometry', subtype: 'segment',
      role: 'quantity-correspondence',
      params: { total: total3, part: part3, unit: 'cm', partLabel: '?', totalLabel: String(total3) }
    };
  } else if (kpName.indexOf('解决问题') !== -1) {
    // k004：连续求一个数的几分之几（找准单位“1”）
    var total4 = 24;
    var first4 = 18; // 3/4
    var answer4 = 12; // 再取 2/3
    modelKind = 'fraction-twice';
    prompt = '看图解决问题：果园里共有 ' + total4 + ' 棵果树，苹果树占 3/4，' +
      '红富士苹果树又占苹果树的 2/3。红富士苹果树有多少棵？____';
    answer = String(answer4);
    geoWhy = '连续求一个数的几分之几要找准单位「1」：先求苹果树 ' + total4 + ' × 3/4 = '
      + first4 + '（棵），再求红富士 ' + first4 + ' × 2/3 = ' + answer4 + '（棵）';
    graphic = {
      type: 'geometry', subtype: 'segment',
      role: 'quantity-correspondence',
      params: { total: total4, part: first4, unit: 'cm', partLabel: String(first4), totalLabel: String(total4) }
    };
  } else {
    // k002：一个数乘分数——单位“1”的量 × 对应分率 = 对应分量
    var den = Rng.pick(rng, [3, 4, 6]);
    var whole = den * Rng.randInt(rng, 2, 4);
    var num = Rng.randInt(rng, 1, den - 1);
    var part = (whole / den) * num;
    modelKind = 'fraction-of-quantity';
    prompt = '看图列式计算：一袋面粉重 ' + whole + ' 千克，做点心用去了它的 ' +
      num + '/' + den + '，用去了多少千克？' + whole + ' × ' + num + '/' + den + ' = ____';
    answer = String(part);
    geoWhy = '求一个数的几分之几是多少，用单位「1」的量乘对应分率：' + whole + ' × '
      + num + '/' + den + ' = ' + answer + '（千克）';
    graphic = {
      type: 'geometry', subtype: 'segment',
      role: 'quantity-correspondence',
      params: { total: whole, part: part, unit: 'cm', partLabel: '?', totalLabel: String(whole) }
    };
  }

  return {
    knowledgePointId: (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) || plan.knowledgePointId,
    questionType: 'geometry',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFn(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [], explanation: geoWhy + '。' },
    answerMode: 'input',
    data: {
      mode: 'geometry',
      steps: 1,
      kind: modelKind,
      graphic: graphic,
      operation: 'mult'
    }
  };
}

// P30-GEN-06（P30-16）：算术族 apply 题面生成器。
// - 单运算：真实情境（苹果/分物），不含符号算式，核心骨架与 calc 互异。
// - 多步：用「加上/减去/乘/除以」文字运算词串联，自动尊重先乘除后加减，
//   符号不进题面，核心骨架（仅数字与汉字）与 calc（符号序列）互异。
function buildApplyStory(structure, op) {
  var ops = structure.operands, oprs = structure.operators;
  var a = ops[0], b = ops[1];
  if (ops.length === 2) {
    if (op === 'add') return '小明有 ' + a + ' 个苹果，又买来 ' + b + ' 个，一共有多少个？';
    if (op === 'sub') return '小明有 ' + a + ' 个苹果，吃了 ' + b + ' 个，还剩多少个？';
    if (op === 'mult') return '每盒有 ' + a + ' 个苹果，' + b + ' 盒一共有多少个？';
    if (op === 'div') return '把 ' + a + ' 个苹果平均分给 ' + b + ' 个小朋友，每人多少个？';
  }
  // 多步：先把 ×/÷ 段合成「A 乘 B / A 除以 B」短语，再用「加/减」串联
  var terms = [String(a)];
  var termOps = [];
  for (var i = 0; i < oprs.length; i++) {
    var o = oprs[i], v = String(ops[i + 1]);
    if (o === '×' || o === '*' || o === '÷' || o === '/') {
      var w = (o === '×' || o === '*') ? '乘' : '除以';
      terms[terms.length - 1] = terms[terms.length - 1] + ' ' + w + ' ' + v;
    } else {
      termOps.push(o === '+' ? '加' : '减');
      terms.push(v);
    }
  }
  var s = '把 ' + terms[0];
  for (var j = 0; j < termOps.length; j++) {
    s += '，' + termOps[j] + ' ' + terms[j + 1];
  }
  return s + '，结果是多少？';
}

// P30-GEN-06：算术 choice 干扰项——扰动最后一个操作数生成结果不同的算式。
// P40-Q-05：迷思桥——按 KP 错误谱（plan.semanticParams.miscons，T2 misconception-profiles
// 轻量投影）选择扰动策略并携带溯源：概念混淆/符号错误 → 运算符共轭互换（+↔−、×↔÷）；
// 口诀混淆 → 乘/除数错位（±1）；计算错误/步骤错误 → off-by-one。无匹配迷思或扰动不足时
// 既有 deltas 邻近数兜底（source:'adjacent-fallback' 诚实降级，不编造迷思）。
function conjugateOp(o) { return o === '+' ? '−' : (o === '−' ? '+' : (o === '*' ? '/' : (o === '/' ? '*' : null))); }

function buildDistractorExpressions(structure, correctAnswer, miscons) {
  var baseOps = structure.operands.slice();
  var oprs = structure.operators;
  var last = baseOps.length - 1;
  var out = [];
  var provenance = [];

  function tryExpr(trialOps, trialOprs, errorType, source) {
    var res = Arith.calculateAnswer(trialOps, trialOprs);
    if (String(res) === String(correctAnswer)) return false;
    var expr = Arith.formatExpression(trialOps, trialOprs);
    if (out.indexOf(expr) !== -1) return false;
    out.push(expr);
    provenance.push({ expr: expr, errorType: errorType || null, source: source });
    return true;
  }

  // 迷思策略（按 KP 错误谱 slots 顺序）
  if (Array.isArray(miscons)) {
    for (var m = 0; m < miscons.length && out.length < 3; m++) {
      var et = miscons[m] && miscons[m].errorType;
      if (!et) continue;
      if (et === '概念混淆' || et === '符号错误') {
        var conj = conjugateOp(oprs[oprs.length - 1]);
        if (conj) {
          var cOps = baseOps.slice();
          var cOprs = oprs.slice();
          cOprs[cOprs.length - 1] = conj;
          tryExpr(cOps, cOprs, et, 'misconception');
        }
      } else if (et === '口诀混淆' && (oprs[oprs.length - 1] === '*' || oprs[oprs.length - 1] === '/')) {
        [-1, 1].forEach(function (d) {
          if (out.length >= 3) return;
          var mOps = baseOps.slice();
          var nv = mOps[last] + d;
          if (nv < 1) return; // 口诀错位须保持正操作数
          mOps[last] = nv;
          tryExpr(mOps, oprs.slice(), et, 'misconception');
        });
      }
    }
  }

  // 计算错误/步骤错误迷思 = off-by-one 邻近数（与既有雏形同构，升级为迷思溯源）
  var calcSlot = Array.isArray(miscons) && miscons.some(function (s) {
    return s && (s.errorType === '计算错误' || s.errorType === '步骤错误');
  });
  var deltas = [1, 2, -1, -2];
  for (var i = 0; i < deltas.length && out.length < 3; i++) {
    var nv = baseOps[last] + deltas[i];
    if (nv < 0) continue;
    var trialOps = baseOps.slice();
    trialOps[last] = nv;
    tryExpr(trialOps, oprs.slice(),
      calcSlot ? (miscons.filter(function (s) { return s.errorType === '计算错误' || s.errorType === '步骤错误'; })[0] || {}).errorType : null,
      calcSlot ? 'misconception' : 'adjacent-fallback');
  }
  // 若扰动不足 3 个，扰动倒数第二个操作数兜底
  var guard = 0;
  while (out.length < 3 && guard < 8 && baseOps.length >= 2) {
    guard++;
    var nv2 = baseOps[last - 1] + (guard % 2 === 0 ? guard : -guard);
    if (nv2 < 0) continue;
    var t2 = baseOps.slice();
    t2[last - 1] = nv2;
    tryExpr(t2, oprs.slice(), null, 'adjacent-fallback');
  }
  while (out.length < 3) {
    var filler = baseOps.join(' + ') + ' + ' + (out.length + 1);
    out.push(filler);
    provenance.push({ expr: filler, errorType: null, source: 'adjacent-fallback' });
  }
  return { exprs: out.slice(0, 3), provenance: provenance.slice(0, 3) };
}

// P38 断链修复闸门：意图驱动——仅当该 (KP, 题型) 行 intent.graphicRole 非空
// （plan.semanticParams.graphic 为 P30-10 权威行投影）时挂图；意图无图的行零改动。
function intentWantsGraphic(plan) {
  return !!(plan && plan.semanticParams && plan.semanticParams.graphic &&
    plan.semanticParams.graphic.role != null);
}

// P40-Q-06：KP 年级解析与课标竖式判定单点在 arithmetic-core（Arith.gradeOfKp / Arith.verticalPlan），
// arithmetic.js 与 decimal.js 共用，禁止本地第二实现。

// P38 断链修复：混合运算计算辅助图（role 统一 calculation-support）。
// calc/judge/apply 统一「首步表示法」：仅展示前两个操作数与首个运算符，结果以 '？'
// 标记（judge 的 shown 绝不入图，经 finishJudge 转换时 graphic 原样透传）。
// fill 2-op：按运算符派生逆推图（空位 = operands[0]，禁印空位值）；
// fill 3-op / choice：天平图（等式结果已印题面，空位/正确算式不入图）。
function normCalcOp(o) { return o === '*' ? '×' : (o === '/' ? '÷' : (o === '-' ? '−' : o)); }
function buildCalcGraphic(qt, structure, answer) {
  var ops = structure.operands, oprs = structure.operators;
  function seg(p) {
    return { type: 'diagram', subtype: 'segment', role: 'calculation-support',
      params: Object.assign({ unit: '' }, p) };
  }
  function br(p) {
    return { type: 'diagram', subtype: 'brace', role: 'calculation-support', params: p };
  }
  function grp(p) {
    return { type: 'diagram', subtype: 'groups', role: 'calculation-support', params: p };
  }
  function bal() {
    return { type: 'diagram', subtype: 'balance', role: 'calculation-support',
      params: { left: answer, rightLabel: '？' } };
  }
  function firstStep() {
    var a = ops[0], b = ops[1], o = normCalcOp(oprs[0]);
    if (o === '+') return br({ left: a, right: b });
    if (o === '−') return seg({ total: a, part: b });
    if (o === '×') return grp({ boxes: b, boxText: a, topText: '?' });
    return grp({ boxes: b, boxText: '？', topText: a }); // ÷：总数已知，每份未知
  }
  if (qt === 'choice') return bal();
  if (qt === 'fill') {
    if (ops.length > 2) return bal();
    var b = ops[1], o = normCalcOp(oprs[0]), ans = answer;
    if (o === '+') return seg({ total: ans, part: b, partLabel: String(b), otherLabel: '？', totalLabel: String(ans) });
    if (o === '−') return seg({ total: ans + b, part: ans, partLabel: String(ans), otherLabel: String(b), totalLabel: '？' });
    if (o === '×') return grp({ boxes: b, boxText: '？', topText: String(ans) });
    return grp({ boxes: b, boxText: String(ans), topText: '？' }); // ÷
  }
  return firstStep();
}

// P42-033：g6-up-u02-k003「分数、小数混合运算及运算律」专属 maker。此前该 KP 的
// calc/fill/choice/apply/judge 行落入通用四则结构（整数连算，跨 KP 错挂家族根因）。
// 名称信号「小数混合运算」为 canonical 连续子串唯一命中（g4-down-u06-k003「小数加减
// 混合运算」不含该连续子串且不在 mixed 绑定内；g4-down-u03-k004「综合运用运算律」
// 不含连续子串），零外溢。数族恒定整数精确：a×100=x（0.25×4=1、0.5×2=1、0.2×5=1、
// 0.4×5=2），ax/ay/ans 全整数，judge finisher 加扰动安全。
// 返回值镜像通用 pushedQ（difficultyParams/response/distractors 契约同源）。
function makeFractionDecimalMixedQuestion(plan, context, i, seedFn, normOp) {
  var constraints = plan.constraints || {};
  var rng = Rng.createSeededRandom(seedFn(plan, context, i));
  var MIXED_DEC_A = [0.25, 0.5, 0.2, 0.4];
  var MIXED_DEC_PAIR = { '0.25': 4, '0.5': 2, '0.2': 5, '0.4': 5 };
  var a = MIXED_DEC_A[i % 4];
  var x = MIXED_DEC_PAIR[String(a)];
  var k = Rng.pick(rng, [2, 3]);
  var y = x * k;
  var ah = Math.round(a * 100);
  var axI = ah * x / 100;
  var ayI = ah * y / 100;
  var ansI = axI + ayI;
  var qt = plan.questionTypeId;
  var fullExpr = a + ' × (' + x + ' + ' + y + ')';
  // 解析明写「运算律」「小数混合运算」token（跨题型语义回指）
  var distWhy = '运用乘法分配律（运算律）：' + fullExpr + ' = ' + a + ' × ' + x + ' + ' + a + ' × ' + y
    + ' = ' + axI + ' + ' + ayI + ' = ' + ansI + '。小数混合运算先观察数的特点，用运算律凑整更简便。';
  var prompt, outAnswer, explanationText = distWhy;
  var options = null;
  var choiceDistractors = null;

  if (qt === 'fill') {
    // fill = 分配律过程填空（空系数），与 calc 直接求值承担不同 Assessment Target
    prompt = '在 ____ 里填数（用运算律简便计算）：' + fullExpr + ' = ' + a + ' × ' + x + ' + ____ × ' + y + ' = ' + ansI;
    outAnswer = a;
    explanationText = distWhy + ' 空格里填 ' + a + '。';
  } else if (qt === 'choice') {
    // choice = 得数选式；干扰项为分配律常见错式（互异且≠答案，已逐组验算）
    prompt = '下面哪个算式等于 ' + ansI + '？';
    var correctExpr = fullExpr;
    var cands = [a + ' × (' + (x + y + 1) + ')', a + ' + ' + x + ' + ' + y, (a + 1) + ' × (' + x + ' + ' + y + ')'];
    options = Rng.shuffle(rng, [correctExpr].concat(cands));
    outAnswer = correctExpr;
    explanationText = distWhy + ' 正确选项是「' + correctExpr + '」。';
    choiceDistractors = cands.map(function (e) { return { expr: e, errorType: null, source: 'adjacent-fallback' }; });
  } else if (qt === 'apply') {
    prompt = '每瓶矿泉水重 ' + a + ' 千克，甲箱装了 ' + x + ' 瓶，乙箱装了 ' + y + ' 瓶。两箱矿泉水一共重多少千克？（用运算律简便计算）';
    outAnswer = ansI;
    explanationText = distWhy + ' 两箱共重 ' + ansI + ' 千克。';
  } else {
    // calc / judge：judge 产 calc 形状交 finisher 转换（镜像 generic 路径）。
    // P42-033：judge 经 finishJudge 转换后解析被机械解析覆盖（V5.1.0 冻结行为），
    // 概念 token 通道改走题面前缀「用运算律简便计算」（转换保留前缀，进 P2 检索域）。
    prompt = '用运算律简便计算：' + fullExpr + ' = ?';
    outAnswer = ansI;
  }

  var q = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    difficultyParams: {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    numberRange: constraints.numberRange || { min: 1, max: 20 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFn(plan, context, i),
    prompt: prompt,
    answer: { value: String(outAnswer), acceptable: [], explanation: explanationText },
    answerMode: 'input',
    response: { layout: 'inline-after-equals' },
    hint: null,
    data: { operation: normOp, steps: 2, distractors: choiceDistractors }
  };
  if (options) q.data.options = options;
  // P42-033 修复补丁：镜像通用路径 P38 意图闸门（L503 intentWantsGraphic）——k003 全部
  // 题型 intent.graphicRole=auxiliary/carrier 强制配图（kp-semantic-validator
  // checkIntentAlignment fail-closed），此前本 maker 零 graphic → 4 行全部校验拒绝（0 产出）。
  // 复用 buildCalcGraphic 同族 calculation-support 词汇：fill/choice 天平（结果已印题面，
  // 空位值/正确算式不入图）、apply/calc/judge 首步分组图（每份 a × 份数 x，总量以？标记）。
  if (intentWantsGraphic(plan)) {
    if (qt === 'fill' || qt === 'choice') {
      q.data.graphic = { type: 'diagram', subtype: 'balance', role: 'calculation-support',
        params: { left: ansI, rightLabel: '？' } };
    } else {
      q.data.graphic = { type: 'diagram', subtype: 'groups', role: 'calculation-support',
        params: { boxes: x, boxText: a, topText: '？' } };
    }
  }
  return q;
}

function createArithmeticGenerator(spec) {
  spec = spec || {};
  var op = spec.operation || 'add';
  var id = spec.id || 'generator:arithmetic-' + op;
  var subject = spec.subject || 'math';

  function seedFor(plan, context, i) {
    if (context && context.seed != null) return context.seed + ':' + i;
    // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
    // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
    if (plan && plan.seed != null) return plan.seed + ':' + i;
    return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
  }

  // M4-R17：兼容 operation 为 字符串（旧）或 KP 语义数组（新）。
  // operationSet 始终是「算符数组」；operation 字符串仅用于旧路径。
  function planOperationSet(plan) {
    return (plan.operationSet || (Array.isArray(plan.operation) ? plan.operation : null));
  }
  function planOperationStr(plan) {
    return (typeof plan.operation === 'string'
      ? plan.operation
      : (plan.operationStr || null));
  }

  // P28-GEO-NATIVE-02：mixed-calculation 承接 g6 分数乘法单元 geometry 行（注册表同步声明）
  var declaredTypes = id === 'generator:arithmetic-mixed-calculation'
    ? ['calc', 'fill', 'apply', 'geometry']
    : ['calc', 'fill', 'apply'];

  return {
    id: id,
    subject: subject,
    capabilities: declaredTypes,
    questionTypes: declaredTypes,
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return plan.questionTypeId === 'calc';
    },

    generate: function (plan, context) {
      context = context || {};
      var constraints = plan.constraints || {};
      var count = plan.count || 1;
      var questions = [];

      // P27-11：变式指令通用消费（无 KP 分支）。指令来自 strategy-engine 挂载的
      // plan.variationDirectives（Misconception→NextVariation，P27-10 overlay 派生）。
      // axis='numeric' → 数值低位巩固：运算数在本行 numberRange 的下半区生成，
      // 报告值仍用原始 numberRange（不动 validator check#4 的语义边界）。
      var vDirectives = Array.isArray(plan && plan.variationDirectives) ? plan.variationDirectives : [];
      var numericSteer = vDirectives.some(function (d) { return d && d.axis === 'numeric'; });
      var genRange = constraints.numberRange;
      if (numericSteer && genRange && typeof genRange.min === 'number' && typeof genRange.max === 'number' &&
          genRange.max > genRange.min) {
        var mid = Math.floor((genRange.min + genRange.max) / 2);
        genRange = { min: genRange.min, max: Math.max(genRange.min, mid) };
      }

      for (var i = 0; i < count; i++) {
        // P28-GEO-NATIVE-02：mixed 的 geometry 行走分数乘法线段/运算律模型
        if (id === 'generator:arithmetic-mixed-calculation' && plan.questionTypeId === 'geometry') {
          questions.push(makeFractionMultiplyGeometryQuestion(plan, context, i, seedFor));
          continue;
        }
        // P42-033：「分数、小数混合运算及运算律」其余题型走分配律专属 maker
        // （此前落入通用四则结构，跨 KP 错挂家族根因；名称信号唯一性见 maker 注释）。
        if (id === 'generator:arithmetic-mixed-calculation' && plan.questionTypeId !== 'geometry') {
          var mixName = (plan.semanticParams && plan.semanticParams.name) || '';
          if (mixName.indexOf('小数混合运算') !== -1) {
            var normOpMix = Arith.normalizeOperation(context.operation || planOperationStr(plan) || op);
            questions.push(makeFractionDecimalMixedQuestion(plan, context, i, seedFor, normOpMix));
            continue;
          }
        }
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var opSet = context.operationSet || planOperationSet(plan);
        // P28-NAME-MIGRATION-02：kind 来自 plan.semanticParams.kind（SSOT 派生）；
        // op='div' 防御层仅 division 生成器命中，mixed 生成器跳过避免误派生
        var semKind = (op === 'div' && plan.semanticParams) ? plan.semanticParams.kind : null;
        var kind = constraints.kind ||
          ((plan.constraints && plan.constraints.kind) || (plan.kind || null)) || semKind;
        // P40-Q-SEM（#1 复现题）：封闭数域结果域守卫——操作数在 numberRange 内不代表结果在
        // （91+26=117>numMax=100 越界）。R9 方案 A 口径：仅纯加减法按封闭数域判结果域；
        // 乘除/混合不适用（结果域不封闭）。越界即重采样（rng 顺序推进，确定性保持），
        // 12 次仍越界 → 钳制最后一个操作数兜底（add：max−前缀和；sub：结果域下限天然满足 noNegative）。
        var isPureAddSub = true;
        var structGuard = 0;
        var structure;
        function structInRange(s) {
          var a = s.answer != null ? s.answer : Arith.calculateAnswer(s.operands, s.operators);
          if (genRange && typeof genRange.max === 'number' && a > genRange.max) return false;
          if (genRange && typeof genRange.min === 'number' && a < genRange.min) return false;
          return true;
        }
        do {
          isPureAddSub = true;
          var structure0 = Arith.buildSpecialKind(rng, { kind: kind, numberRange: genRange });
          if (!structure0) {
            structure0 = Arith.generateStructure(rng, {
              operation: context.operation || planOperationStr(plan) || ((opSet && opSet.filter(function (o) { return o === '+' || o === '−'; }).length === opSet.length) ? 'add' : op),
              operationSet: opSet,
              exactSteps: constraints.exactSteps,
              numberRange: genRange,
              maxSteps: constraints.exactSteps != null ? constraints.exactSteps : constraints.maxSteps,
              allowBracket: constraints.allowBracket,
              allowMultDiv: constraints.allowMultDiv,
              noNegative: true
            });
          }
          structure = structure0;
          for (var oi = 0; oi < structure.operators.length; oi++) {
            if (structure.operators[oi] !== '+' && structure.operators[oi] !== '−') { isPureAddSub = false; break; }
          }
          if (!isPureAddSub) break; // 乘除/混合不适用封闭数域
          structGuard++;
        } while (!structInRange(structure) && structGuard < 12);
        if (isPureAddSub && !structInRange(structure) && structure.operators[structure.operators.length - 1] === '+') {
          // 兜底钳制：add 末操作数 = max − 其余操作数和（≥1 才有效，否则保留原样交由 validator 判定）
          var prefixSum = 0;
          for (var pi = 0; pi < structure.operands.length - 1; pi++) prefixSum += structure.operands[pi];
          var clamped = genRange.max - prefixSum;
          if (clamped >= 1) {
            structure.operands[structure.operands.length - 1] = clamped;
            structure.answer = Arith.calculateAnswer(structure.operands, structure.operators);
          }
        }
        var answer = structure.answer != null ? structure.answer : Arith.calculateAnswer(structure.operands, structure.operators);
        var qt = plan.questionTypeId;
        // P38 断链修复：意图闸门 + 计算辅助图（judge 经 finishJudge 转换时 graphic 透传）
        var wantsG = intentWantsGraphic(plan);
        var calcGraphic = null;
        var prompt, outAnswer = answer, options = null;
        // P34-12：题型分型讲解（运算意义 + 完整演算），统一在各分支赋值
        var fullExpr = Arith.formatExpression(structure.operands, structure.operators);
        var explanationText;
        var choiceDistractors = null; // P40-Q-05：choice 干扰项迷思溯源（{expr, errorType, source}[]）

        if (qt === 'fill') {
          // P30-GEN-06（P30-16）：fill = 逆推填空（空出一个操作数，已知得数求操作数），
          // 与 calc 的「直接求值」承担不同 Assessment Target；缺失操作数使核心骨架
          // （#op# 模式）与 calc 互异。
          var ops = structure.operands, oprs = structure.operators;
          // 空「非末尾」操作数：末尾空位会因等号右侧得数仍保留 # 而使核心骨架
          // 退化为 #op#（与 calc 相同）；空首位/中位可保证骨架互异。
          var blankIdx = ops.length > 2 ? Rng.randInt(rng, 0, ops.length - 2) : 0;
          var fillParts = [];
          for (var fi = 0; fi < ops.length; fi++) {
            fillParts.push(fi === blankIdx ? '____' : ops[fi]);
            if (fi < oprs.length) fillParts.push(oprs[fi]);
          }
          prompt = '填空：' + fillParts.join(' ') + ' = ' + answer;
          outAnswer = ops[blankIdx];
          if (wantsG) calcGraphic = buildCalcGraphic('fill', structure, answer);
          // 解析：先指认空格应填的数，再代入验证等式成立
          explanationText = '空格里填 ' + outAnswer + '：' + fullExpr + ' = ' + answer + '，等式成立';
        } else if (qt === 'apply') {
          // P30-GEN-06：apply = 真实情境迁移，直接生成情境题面（不依赖 finisher 包装，
          // 避免「= ?」被 contextPresent 短路而退化为裸算式）。
          prompt = buildApplyStory(structure, op);
          if (wantsG) calcGraphic = buildCalcGraphic('apply', structure, answer);
          // 解析：情境 → 运算意义 → 列式演算
          explanationText = OP_MEANING[op] + '，列式 ' + fullExpr + ' = ' + answer;
        } else if (qt === 'choice') {
          // P30-GEN-06：choice = 结果匹配。题干给出得数，选项为算式，选出结果等于该
          // 数的算式。题干不含符号算式，核心骨架与 calc/fill/apply 互异。
          var correctExpr = Arith.formatExpression(structure.operands, structure.operators);
          prompt = '下面哪个算式等于 ' + answer + '？';
          // P40-Q-05：迷思桥——KP 错误谱驱动扰动策略 + data.distractors 溯源字段
          var miscons = (plan.semanticParams && Array.isArray(plan.semanticParams.miscons))
            ? plan.semanticParams.miscons : [];
          var distractorBuild = buildDistractorExpressions(structure, answer, miscons);
          var distractorExprs = distractorBuild.exprs;
          options = Rng.shuffle(rng, [correctExpr].concat(distractorExprs));
          outAnswer = correctExpr;
          if (wantsG) calcGraphic = buildCalcGraphic('choice', structure, answer);
          // 解析：指认正确算式并验算
          explanationText = '结果等于 ' + answer + ' 的算式是 ' + correctExpr +
            '（验算：' + correctExpr + ' = ' + answer + '）';
          choiceDistractors = distractorBuild.provenance;
        } else {
          prompt = fullExpr + ' = ?';
          // P40-Q-06：课标笔算竖式（两数单步 + 年级达标）仅接管无意图图授权的行
          // （vPlan && !wantsG）；intent.graphicRole 授权了示意图的行走原 diagram 路径，
          // 行为与 Q-06 前完全一致（否则非目标行被带竖式 → intent 门拒，6f FAIL）。
          // descriptor 只声明结构（type/subtype/role/params），遮蔽形态（maskResult）
          // 由 SVG 层防泄题呈现；小数轨传 trimDec 字符串（dec/小数 mul 适配器契约）。
          var vPlan = null;
          if (structure.operands.length === 2 && structure.operators.length === 1) {
            vPlan = Arith.verticalPlan(Arith.gradeOfKp(pkp(plan)),
              structure.operands[0], structure.operands[1], structure.operators[0]);
          }
          if (vPlan && !wantsG) {
            if (vPlan.kind === 'dec') {
              calcGraphic = vPlan.sub === 'mul'
                ? { type: 'calculation', subtype: 'mul', role: 'calculation-support',
                    params: { a: Arith.trimDec(structure.operands[0]), b: Arith.trimDec(structure.operands[1]),
                      options: { maskResult: true } } }
                : { type: 'calculation', subtype: 'dec', role: 'calculation-support',
                    params: { a: Arith.trimDec(structure.operands[0]), b: Arith.trimDec(structure.operands[1]),
                      op: structure.operators[0], options: { maskResult: true } } };
            } else {
              calcGraphic = { type: 'calculation', subtype: vPlan.sub, role: 'calculation-support',
                params: { a: structure.operands[0], b: structure.operands[1], options: { maskResult: true } } };
            }
          } else if (wantsG) {
            calcGraphic = buildCalcGraphic(qt, structure, answer);
          }
          // 解析：运算意义 + 完整演算
          explanationText = OP_MEANING[op] + '：' + fullExpr + ' = ' + answer;
        }

        var pushedQ = {
          knowledgePointId: pkp(plan),
          questionType: qt,
          difficulty: plan.difficulty,
          difficultyParams: {
            level: plan.difficulty,
            scale: constraints.scale != null ? constraints.scale : 1,
            steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
            allowBracket: !!constraints.allowBracket,
            allowMultDiv: !!constraints.allowMultDiv
          },
          numberRange: constraints.numberRange || { min: 1, max: 20 },
          spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
          context: plan.contextType != null ? plan.contextType : 'standard',
          seed: seedFor(plan, context, i),
          prompt: prompt,
          // P34-12：explanation 为题型分型真讲解（运算意义+演算），不再 prompt.replace 抄题面
          answer: { value: String(outAnswer), acceptable: [], explanation: explanationText },
          answerMode: 'input',
          // P28-FORM-CONTRACT-01：声明横向算式作答框内联到等号后（替代渲染器正则识别）
          response: { layout: 'inline-after-equals' },
          hint: null,
          data: {
            operation: Arith.normalizeOperation(context.operation || planOperationStr(plan) || op),
            steps: structure.steps,
            // P40-Q-05：choice 干扰项迷思溯源（非 choice 题为 null）
            distractors: choiceDistractors
          }
        };
        if (calcGraphic) pushedQ.data.graphic = calcGraphic;
        if (options) pushedQ.data.options = options;
        questions.push(pushedQ);
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

function buildAll() {
  var out = [];
  Object.keys(FAMILY).forEach(function (name) {
    out.push(createArithmeticGenerator({ id: 'generator:arithmetic-' + name, operation: FAMILY[name].op }));
  });
  return out;
}

module.exports = {
  FAMILY: FAMILY,
  createArithmeticGenerator: createArithmeticGenerator,
  buildAll: buildAll
};
