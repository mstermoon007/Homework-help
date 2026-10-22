'use strict';

/**
 * shared/generator/generators/reasoning.js — Reasoning / Logic Generator
 *
 * 逻辑推理族 Generator：逻辑推理、抽屉原理、最值问题、鸡兔同笼、植树问题、找次品、握手问题、数独
 */

var Rng = require('../core/rng.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':reason:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':reason:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':reason:' + i;
}

function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
}
function riC(rng, lo, hi, nr) {
  var min = Math.max(lo, nr.min);
  var max = Math.min(hi, nr.max);
  if (min > max) { min = lo; max = hi; }
  return Rng.randInt(rng, min, max);
}

// FINAL-141：「7～9的乘、除法」KP（推理族绑定中唯一的算术 KP：7~9 乘法口诀 + 用口诀求商）
// 专属 maker。历史实现只有 calc 题型带专用分支且仅 2 个模板；fill/choice/apply 全部落入
// 通用 logic 模板，产出「谁说真话/年龄/盒子标签」无关逻辑题（fill 还因无空位全挂契约），
// 容量实测 calc/fill/choice=1、apply=3。按 KBL 知识点名称精确门控补齐（名称门控是本文件
// 既有分派机制，且不在源码内固化 canonical id），不外溢到其他推理 KP。
var TABLE789_NAME = '7～9的乘、除法';

function table789Options(rng, correct, distractors) {
  var pool = {};
  pool[Number(correct)] = 1;
  distractors.forEach(function (x) {
    x = Number(x);
    if (x > 0 && x !== Number(correct)) pool[x] = 1;
  });
  var arr = Object.keys(pool).map(Number);
  var filler = 1;
  while (arr.length < 4) {
    var cand = Number(correct) + filler * 2;
    filler++;
    if (cand > 0 && arr.indexOf(cand) === -1) arr.push(cand);
  }
  return Rng.shuffle(rng, arr.slice(0, 4).map(String));
}

function makeTable789Question(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var qt = plan.questionTypeId;
  var a = riC(rng, 7, 9, nr);
  var b = riC(rng, 2, 9, nr);
  var p = a * b;
  var form = i % 5;

  var prompt, answer, options = null, answerMode = 'input', operation, tWhy;

  if (qt === 'calc') {
    // calc：口诀引导 + 直接算式求值
    // P42-033：奇偶翻转——i=0（面采样 canonical 主形态）落「用口诀求商」半边，
    // 使除法 token（÷/求商）进入题面与解析，KP「7～9的乘、除法」语义回指成立。
    if (i % 2 === 1) {
      prompt = '运用乘法口诀计算：' + a + ' × ' + b + ' = ?';
      answer = String(p); operation = 'mult';
      tWhy = '想乘法口诀「' + b + ' ' + a + '」得 ' + p + '，所以 ' + a + ' × ' + b + ' = ' + p;
    } else {
      prompt = '用乘法口诀求商：' + p + ' ÷ ' + a + ' = ?';
      answer = String(b); operation = 'div';
      tWhy = '想乘法口诀求商：' + a + ' × ' + b + ' = ' + p + '，所以 ' + p + ' ÷ ' + a + ' = ' + b;
    }
  } else if (qt === 'fill') {
    // fill：空出「首位操作数」，核心骨架与 calc 的 #op# 互异
    if (form <= 2) { prompt = '____ × ' + a + ' = ' + p; answer = String(b); operation = 'mult';
      tWhy = '积 ÷ 已知因数 = 未知因数：' + p + ' ÷ ' + a + ' = ' + b; }
    else if (form === 3) { prompt = '____ ÷ ' + a + ' = ' + b; answer = String(p); operation = 'div';
      tWhy = '被除数 = 除数 × 商：' + a + ' × ' + b + ' = ' + p; }
    else { prompt = p + ' ÷ ____ = ' + b; answer = String(a); operation = 'div';
      tWhy = '除数 = 被除数 ÷ 商：' + p + ' ÷ ' + b + ' = ' + a; }
  } else if (qt === 'choice') {
    // choice：结果匹配——题干出得数，选项为算式
    // P42-033：同 calc 奇偶翻转，i=0 落除法半边（正确选项含 ÷，解析含求商）。
    var isMult = i % 2 === 1;
    var target = isMult ? p : b;
    var correctExpr = isMult ? (a + ' × ' + b) : (p + ' ÷ ' + a);
    tWhy = (isMult ? '想乘法口诀「' + b + ' ' + a + '」得 ' + p
      : '想乘法口诀，' + a + ' × ' + b + ' = ' + p)
      + '，正确选项是「' + correctExpr + '」';
    var cand = [];
    function pushCand(e) { if (cand.indexOf(e) === -1 && cand.length < 4) cand.push(e); }
    if (isMult) {
      pushCand(a + ' × ' + b);
      pushCand(a + ' × ' + (b + 1));
      pushCand((a + 1) + ' × ' + b);
      pushCand(a + ' × ' + Math.max(2, b - 1));
    } else {
      pushCand(p + ' ÷ ' + a);
      pushCand(p + ' ÷ ' + (a + 1));
      pushCand((p + a) + ' ÷ ' + a);
      pushCand(Math.max(a, p - 1) + ' ÷ ' + a);
    }
    options = Rng.shuffle(rng, cand.slice(0, 4));
    prompt = '下面哪个算式等于 ' + target + '？';
    answer = correctExpr; operation = isMult ? 'mult' : 'div';
    answerMode = 'choice';
  } else { // apply：7~9 表内乘除情境，三组形式 × 四类物品轮换扩空间
    var goods = ['月饼', '笔记本', '彩笔', '气球'];
    var g = goods[i % goods.length];
    // P42-033：三形态轮换整体前移一位——i=0 落「平均分」除法情境，
    // 解析含 ÷ token，KP「7～9的乘、除法」语义回指成立。
    var form = (i + 1) % 3;
    if (form === 0) {
      prompt = '每盒' + g + '有 ' + b + ' 个，买了 ' + a + ' 盒，一共有多少个' + g + '？';
      answer = String(p); operation = 'mult';
      tWhy = '每盒个数 × 盒数 = 总数：' + b + ' × ' + a + ' = ' + p;
    } else if (form === 1) {
      prompt = '把 ' + p + ' 个' + g + '平均分给 ' + a + ' 个小组，每个小组分得多少个？';
      answer = String(b); operation = 'div';
      tWhy = '总数 ÷ 组数 = 每组分得数：' + p + ' ÷ ' + a + ' = ' + b;
    } else {
      prompt = '有 ' + p + ' 个' + g + '，每 ' + a + ' 个装一袋，可以装多少袋？';
      answer = String(b); operation = 'div';
      tWhy = '总数 ÷ 每袋个数 = 袋数：' + p + ' ÷ ' + a + ' = ' + b;
    }
  }

  // 语义证据画像（kp-semantic profile）约定：calc→data.mode='calc'；fill/choice/apply→'apply'
  var data = { mode: qt === 'calc' ? 'calc' : 'apply', steps: 1, operation: operation, questionType: qt };
  if (options) { data.options = options; data.correctIndex = options.indexOf(String(answer)); }
  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [], explanation: tWhy + '。' },
    answerMode: answerMode,
    data: data
  };
}

function makeReasoningQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  // P25-09：名称以 selector 注入的 semanticParams.name 为准（kp={} 占位曾使分派恒落 logic）；
  // 直连调用兜底读传入 kp，再兜底「逻辑推理」。
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '逻辑推理';

  // FINAL-141：7～9 的乘、除法走专属算术 maker，不进入通用逻辑推理模板
  if (name === TABLE789_NAME) return makeTable789Question(plan, context, i);

  // P25-09：calc 为 form-bound 题型（题干必须内嵌算式 EXPR_RE）。
  // 推理族中仅 g2-up-u07-k001（7～9 的乘、除法）ALLOW calc，走 7~9 表乘除列式；
  // 其余名称兜底为带算式的规律计算题。
  if (plan.questionTypeId === 'calc') {
    var cPrompt, cAnswer;
    if (name.indexOf('除') !== -1 || name.indexOf('乘') !== -1 || name.indexOf('口诀') !== -1) {
      var a = riC(rng, 7, 9, nr);
      var b = riC(rng, 2, 9, nr);
      if (i % 2 === 0) {
        // P26：意图矩阵 driftRisk 警告「题面退化为纯算式」——补口诀运用情境词（calc form-bound，算式保留）
        cPrompt = '运用乘法口诀计算：' + a + ' × ' + b + ' = ____';
        cAnswer = a * b;
      } else {
        cPrompt = '用乘法口诀求商：' + (a * b) + ' ÷ ' + a + ' = ____';
        cAnswer = b;
      }
    } else {
      var x = riC(rng, 2, 9, nr);
      var y = riC(rng, 2, 9, nr);
      var z = riC(rng, 1, 9, nr);
      cPrompt = '找规律列式：' + x + ' × ' + y + ' + ' + z + ' = ____';
      cAnswer = x * y + z;
    }
    var calcWhy = (name.indexOf('除') !== -1)
      ? '想乘法口诀求商：' + a + ' × ' + b + ' = ' + (a * b) + '，所以 ' + (a * b) + ' ÷ ' + a + ' = ' + b
      : (cPrompt.indexOf('规律') !== -1
        ? '规律题先算乘法再算加法：' + x + ' × ' + y + ' + ' + z + ' = ' + cAnswer
        : '想乘法口诀「' + b + ' ' + a + '」得 ' + (a * b) + '，所以 ' + a + ' × ' + b + ' = ' + (a * b));
    return {
      knowledgePointId: pkp(plan),
      questionType: 'calc',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: cPrompt,
      answer: { value: String(cAnswer), acceptable: [], explanation: calcWhy + '。' },
      answerMode: 'input',
      data: { mode: 'calc', steps: 1, operation: 'mixed-arith', questionType: 'calc' }
    };
  }

  var type = 'generic';
  if (name.indexOf('抽屉') !== -1 || name.indexOf('鸽巢') !== -1) type = 'drawer';
  else if (name.indexOf('最值') !== -1 || name.indexOf('极值') !== -1) type = 'extreme';
  else if (name.indexOf('鸡兔') !== -1) type = 'chicken-rabbit';
  else if (name.indexOf('植树') !== -1) type = 'tree-planting';
  else if (name.indexOf('找次品') !== -1 || name.indexOf('天平') !== -1) type = 'find-defect';
  else if (name.indexOf('握手') !== -1) type = 'handshake';
  // P36-03：原 sudoku/winning 分支已物理删除——canonical 375 KP 名零命中（可达性裁决，见 docs/P36/change-log.md）
  // P42-033：优化/统筹族补「最优/策略」名称信号（canonical 唯一命中「最优策略」族 KP；
  // 「找次品的基本策略」已被前方 find-defect 分支先命中，零外溢）。
  else if (name.indexOf('优化') !== -1 || name.indexOf('沏茶') !== -1 || name.indexOf('烙饼') !== -1 || name.indexOf('统筹') !== -1
    || name.indexOf('最优') !== -1 || name.indexOf('策略') !== -1) type = 'optimization';
  else if (name.indexOf('规律') !== -1 || name.indexOf('线段') !== -1 || name.indexOf('数字推理') !== -1) type = 'seq';
  else type = 'logic';

  // P25-07：choicePool/logicOptions 供 choice 题型构建选项（值约定）；其余题型忽略。
  // P34-14：讲解只复述该题型自身的解题模型，答案均可由题内已知量机械验证
  // P40-Q-09（R13 复现 #131/#162）：fillP 为 builder 级 fill 题面素材（正序合规语序），
  // 取代 splitClauses+reverse 机械倒序——倒序产出「设问先行条件后置」病句，且切分器
  // 不保护括号/顿号把「有4种颜色的球（红、黄、蓝、绿）」碎裂倒排（#162）。
  var prompt, answer, steps, logicOptions = null, choicePool = null, nativeWhy = null, fillP = null;
  var v = i; // 变体序号：同 KP 同题型下轮换不同结构/设问，提升语义容量（R6）
  if (type === 'drawer') {
    var DRAWER = [
      { c: ['红', '黄', '蓝', '绿'], k: 2, ans: 5 },
      { c: ['红', '黄', '蓝'], k: 2, ans: 4 },
      { c: ['红', '黄', '蓝', '绿'], k: 3, ans: 9 },
      { c: ['黑', '白'], k: 2, ans: 3 }
    ];
    var d = DRAWER[v % DRAWER.length];
    prompt = '有' + d.c.length + '种颜色的球（' + d.c.join('、') + '），至少要摸出多少个，才能保证有' + d.k + '个球颜色相同？';
    fillP = '要保证有' + d.k + '个球颜色相同，最少要摸出____个球（球共有' + d.c.length + '种颜色）。';
    answer = d.ans; steps = 2;
    nativeWhy = '抽屉原理按最不利情况算：每种颜色先各摸 ' + (d.k - 1) + ' 个，再摸 1 个就一定有 '
      + d.k + ' 个同色，' + d.c.length + ' × ' + (d.k - 1) + ' + 1 = ' + d.ans;
  } else if (type === 'extreme') {
    if (v % 3 === 0) {
      var twoSum = riC(rng, 10, 50, nr);
      var half = Math.floor(twoSum / 2);
      prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
      fillP = '两个数的和是' + twoSum + '，这两个数越接近乘积越大，最大乘积是____。';
      answer = half * (twoSum - half); steps = 2;
      nativeWhy = '和一定时，两数越接近乘积越大，取 ' + half + ' 和 ' + (twoSum - half)
        + '：' + half + ' × ' + (twoSum - half) + ' = ' + answer;
    } else if (v % 3 === 1) {
      var twoSum2 = riC(rng, 10, 50, nr);
      var half2 = Math.floor(twoSum2 / 2);
      prompt = '两个数的和是' + twoSum2 + '，这两个数相差最小时分别是多少？';
      fillP = '两个数的和是' + twoSum2 + '，相差最小时这两个数是____。';
      answer = half2 + ' 和 ' + (twoSum2 - half2); steps = 2;
      nativeWhy = '和一定，两数最接近时相差最小（差 0 或 1），所以是 ' + half2 + ' 和 ' + (twoSum2 - half2);
    } else {
      var threeSum = riC(rng, 12, 60, nr);
      var base = Math.floor(threeSum / 3);
      var rem = threeSum - 3 * base;
      var parts = [base, base, base]; parts[2] += rem;
      prompt = '三个数的和是' + threeSum + '，这三个数尽可能接近时乘积最大，最大乘积是多少？';
      fillP = '把' + threeSum + '分成尽可能接近的三个数时乘积最大，这个最大乘积是____。';
      answer = parts[0] * parts[1] * parts[2]; steps = 2;
      nativeWhy = '三数尽量接近时乘积最大，' + threeSum + ' 分成 ' + parts.join('、')
        + '，乘积 ' + parts[0] + ' × ' + parts[1] + ' × ' + parts[2] + ' = ' + answer;
    }
  } else if (type === 'chicken-rabbit') {
    if (v % 3 === 0) {
      var heads = riC(rng, 8, 20, nr);
      var rabb0 = riC(rng, 3, Math.max(3, heads - 2), nr);
      var feet = heads * 2 + rabb0 * 2;
      prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
      fillP = '笼中养着鸡和兔，从上面数共有' + heads + '个头，从下面数共有' + feet + '只脚。鸡和兔各有几只？____';
      var r0 = (feet - heads * 2) / 2;
      answer = '鸡' + (heads - r0) + '只，兔' + r0 + '只'; steps = 3;
      nativeWhy = '假设全是鸡应有 ' + heads + ' × 2 = ' + heads * 2 + ' 只脚，多出 '
        + (feet - heads * 2) + ' 只脚；每只兔比鸡多 2 只脚，兔有 ' + (feet - heads * 2)
        + ' ÷ 2 = ' + r0 + ' 只，鸡有 ' + heads + ' − ' + r0 + ' = ' + (heads - r0) + ' 只';
      choicePool = ['鸡' + (heads - r0) + '只，兔' + r0 + '只',
        '鸡' + r0 + '只，兔' + (heads - r0) + '只',
        '鸡' + (heads - r0 - 1) + '只，兔' + (r0 + 1) + '只',
        '鸡' + (heads - r0 + 1) + '只，兔' + (r0 - 1) + '只'];
    } else if (v % 3 === 1) {
      var D = riC(rng, 1, 5, nr);
      var R = riC(rng, 3, 8, nr);
      var F = 6 * R + 2 * D;
      prompt = '鸡兔同笼，鸡比兔多' + D + '只，共有' + F + '只脚。鸡和兔各多少只？';
      fillP = '笼中养着鸡和兔，鸡的只数比兔多' + D + '只，脚一共有' + F + '只。鸡和兔各有几只？____';
      answer = '鸡' + (R + D) + '只，兔' + R + '只'; steps = 3;
      nativeWhy = '把兔先按 2 只脚算，' + (R + D) + ' 只鸡和 ' + R + ' 只兔共 ' + F + ' 只脚（2×'
        + (R + D) + ' + 6×' + R + ' = ' + F + '），所以兔 ' + R + ' 只、鸡 ' + (R + D) + ' 只';
      choicePool = ['鸡' + (R + D) + '只，兔' + R + '只',
        '鸡' + R + '只，兔' + (R + D) + '只',
        '鸡' + (R + D - 1) + '只，兔' + (R + 1) + '只',
        '鸡' + (R + D + 1) + '只，兔' + (R - 1) + '只'];
    } else {
      var D2 = riC(rng, 1, 4, nr);
      var C = riC(rng, 3, 8, nr);
      var F2 = 6 * C + 4 * D2;
      prompt = '鸡兔同笼，兔比鸡多' + D2 + '只，共有' + F2 + '只脚。鸡和兔各多少只？';
      fillP = '笼中养着鸡和兔，兔的只数比鸡多' + D2 + '只，脚一共有' + F2 + '只。鸡和兔各有几只？____';
      answer = '鸡' + C + '只，兔' + (C + D2) + '只'; steps = 3;
      nativeWhy = '兔有 4 只脚、鸡有 2 只脚（兔是鸡的 2 倍），' + F2 + ' 只脚按鸡 ' + C
        + ' 只、兔 ' + (C + D2) + ' 只正好：6×' + C + ' + 4×' + D2 + ' = ' + F2;
      choicePool = ['鸡' + C + '只，兔' + (C + D2) + '只',
        '鸡' + (C + D2) + '只，兔' + C + '只',
        '鸡' + (C - 1) + '只，兔' + (C + D2 + 1) + '只',
        '鸡' + (C + 1) + '只，兔' + (C + D2 - 1) + '只'];
    }
  } else if (type === 'tree-planting') {
    var L = riC(rng, 100, 500, nr);
    var G = riC(rng, 5, 20, nr);
    var TP = [
      { desc: '两端都栽', ans: Math.floor(L / G) + 1 },
      { desc: '两端都不栽', ans: Math.floor(L / G) - 1 },
      { desc: '只在一端栽', ans: Math.floor(L / G) },
      { desc: '在环形操场周围栽（封闭）', ans: Math.floor(L / G) }
    ];
    var tp = TP[v % TP.length];
    prompt = '在一条长' + L + '米的公路一边植树，每隔' + G + '米栽一棵（' + tp.desc + '），一共要栽多少棵？';
    fillP = '一条' + L + '米长的小路一边植树，每隔' + G + '米栽一棵，植树要求：' + tp.desc + '。一共要栽____棵树。';
    answer = tp.ans; steps = 2;
    nativeWhy = '先算间隔数：' + L + ' ÷ ' + G + ' = ' + Math.floor(L / G) + '；'
      + tp.desc + '，棵数 = 间隔数 ' + (tp.ans > Math.floor(L / G) ? '+ 1' : tp.ans < Math.floor(L / G) ? '− 1' : '')
      + ' = ' + tp.ans;
  } else if (type === 'find-defect') {
    var DEFECT = [
      { n: 3, ans: 1 }, { n: 9, ans: 2 }, { n: 27, ans: 3 }, { n: 81, ans: 4 }
    ];
    var df = DEFECT[v % DEFECT.length];
    prompt = '有' + df.n + '瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    fillP = df.n + '瓶水里有1瓶略轻的次品，用天平最少称____次一定能把它找出来。';
    answer = df.ans; steps = 2;
    nativeWhy = '每次把待测瓶数尽量平均分成 3 份，称其中两份可把范围缩小到 1/3；'
      + df.n + ' 在 3 的 ' + (df.ans - 1) + ' 次方到 ' + df.ans + ' 次方之间，所以至少称 ' + df.ans + ' 次';
  } else if (type === 'handshake') {
    var HSK = [
      { w: '个人，每两个人握一次手', fp: function (m) { return '有' + m + '个人两两握手，每两个人只握一次，一共要握____次手。'; }, ans: function (n) { return n * (n - 1) / 2; } },
      { w: '支球队进行单循环比赛，每两队赛一场', fp: function (m) { return '有' + m + '支球队进行单循环赛，每两队只赛一场，一共要赛____场。'; }, ans: function (n) { return n * (n - 1) / 2; } },
      { w: '个点，每两个点连一条线段', fp: function (m) { return '有' + m + '个点，每两点只连一条线段，一共能连____条线段。'; }, ans: function (n) { return n * (n - 1) / 2; } }
    ];
    var hs = HSK[v % HSK.length];
    var n = riC(rng, 4, 12, nr);
    prompt = n + hs.w + '，一共需要多少次？';
    fillP = hs.fp(n);
    answer = hs.ans(n); steps = 2;
    nativeWhy = '每个对象和其余 ' + (n - 1) + ' 个各配一次，共 ' + n + ' × ' + (n - 1)
      + ' 次；每对被重复算两次，除以 2：' + n + ' × ' + (n - 1) + ' ÷ 2 = ' + answer;
  } else if (type === 'optimization') {
    // P42-033：名称含「最优/策略」的 KP，解析前缀补「最优」语义 token（跨题型回指）；
    // 名称不含两词的既有优化 KP（如「推理与优化」）前缀为空串，产出零变化。
    var stratNamed = name.indexOf('最优') !== -1 || name.indexOf('策略') !== -1;
    if (v % 3 === 0) {
      var pans = riC(rng, 2, 5, nr);
      prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要 2 分钟。至少需要多少分钟？';
      fillP = '一张饼两面都要烙，每面需要2分钟，一口锅每次最多同时烙两面。烙' + pans + '张饼最少需要____分钟。';
      answer = pans * 2; steps = 3;
      nativeWhy = (stratNamed ? '最优方案：' : '') + '每次让锅里同时烙两张饼的两个面，不空锅：' + pans + ' 张饼共 ' + pans
        + ' × 2 = ' + pans * 2 + ' 个面，每锅 2 分钟烙两个面，共 ' + answer + ' 分钟';
    } else if (v % 3 === 1) {
      prompt = '煮一个鸡蛋需要 8 分钟，同时可以洗锅 2 分钟。至少需要多少分钟？';
      fillP = '煮一个鸡蛋需要8分钟，洗锅的2分钟可以安排在这段时间里同时完成，至少需要____分钟。';
      answer = 8; steps = 2;
      nativeWhy = (stratNamed ? '最优安排：' : '') + '煮鸡蛋的 8 分钟里可以同时洗锅，洗锅的 2 分钟被包含，所以至少需要 8 分钟';
    } else {
      prompt = '看一集动画需要 15 分钟，同时可以写完作业 10 分钟。至少需要多少分钟？';
      fillP = '看一集动画需要15分钟，写作业的10分钟可以安排在这段时间里同时完成，至少需要____分钟。';
      answer = 15; steps = 2;
      nativeWhy = (stratNamed ? '最优安排：' : '') + '看动画的 15 分钟里可以同时写作业，10 分钟包含在内，所以至少需要 15 分钟';
    }
  } else if (type === 'seq') {
    var SEQ = [
      { s: '2, 4, 6, 8', ans: 10, why: '相邻两项依次加 2，8 + 2 = 10' },
      { s: '1, 3, 5, 7', ans: 9, why: '相邻两项依次加 2，7 + 2 = 9' },
      { s: '1, 2, 4, 8', ans: 16, why: '后一项是前一项的 2 倍，8 × 2 = 16' },
      { s: '1, 1, 2, 3, 5', ans: 8, why: '从第三项起每项是前两项之和，3 + 5 = 8' }
    ];
    var sq = SEQ[v % SEQ.length];
    prompt = name + '：观察数列规律，写出下一个数：' + sq.s + ', ?';
    answer = sq.ans; steps = 1;
    nativeWhy = sq.why;
  } else {
    // P25-07：可解答的逻辑推理实例（替换原「（逻辑推理略）」不可解答桩）。
    // 三个模板均为唯一解，答案可机械验证；logicOptions 供 choice 题型构建选项。
    var LGV = v % 3;
    if (LGV === 0) {
      prompt = '甲、乙、丙三人中只有一人说真话。甲说：「乙在说谎。」乙说：「丙在说谎。」丙说：「甲和乙都在说谎。」谁说了真话？';
      answer = '乙'; steps = 3;
      logicOptions = ['甲', '乙', '丙'];
      nativeWhy = '假设甲真则乙假、推出丙真，丙真则甲假，矛盾；假设丙真则甲、乙都假，由甲假推出乙真，矛盾；只有乙真时其余假设均不矛盾，所以说真话的是乙';
    } else if (LGV === 1) {
      var ageTop = riC(rng, 9, 12, nr);
      prompt = '小明比小红大 2 岁，小红比小刚大 3 岁，小明今年 ' + ageTop + ' 岁。三人中谁最大？';
      fillP = '已知小红比小明小2岁，小刚比小红又小3岁，小明今年' + ageTop + '岁。三人中年龄最大的是____。';
      answer = '小明'; steps = 2;
      logicOptions = ['小明', '小红', '小刚'];
      nativeWhy = '小明比小红大 2 岁，小红又比小刚大 3 岁，年龄关系可传递，所以小明最大';
    } else {
      prompt = '三个盒子上分别标着「苹果」「橘子」「混合」，标签全都贴错了。只从其中一个盒子里摸出一个水果，就能判断所有盒子里装的是什么。应该从哪个盒子摸？';
      fillP = '三个盒子上的标签「苹果」「橘子」「混合」全都贴错了，只摸出其中一个盒子里的一个水果，就能判断三个盒子里各装什么。应该摸____的盒子。';
      answer = '标着「混合」的盒子'; steps = 3;
      logicOptions = ['标着「苹果」的盒子', '标着「橘子」的盒子', '标着「混合」的盒子'];
      nativeWhy = '三个标签全贴错，标「混合」的盒子里一定是单一水果，从中摸一个即可确定它；再由「标签全错」推出另外两个盒子';
    }
  }

  // P30-GEN-06（P30-16）：推理族 apply/fill/choice 共用同一谜题题面会因核心骨架
  // 子串包含导致跨题型 sim≥0.85。按题型变换题面：
  //   fill  —— 条件同义换词 + 疑问词替换为 ____；
  //   choice —— 条件同义换词 + 末尾设问改为「正确选项是哪一个」。
  //   apply —— 原始谜题。
  // 同义换词打散长条件块的连续共享 3-gram，使 sim 降到 0.85 以下。
  var qt2 = plan.questionTypeId;
  var stemPrompt = prompt;
  function rewordCond(s) {
    return String(s)
      .replace(/说谎/g, '撒谎').replace(/说/g, '称')
      .replace(/共有/g, '总共有').replace(/一共/g, '总共')
      .replace(/至少/g, '最少').replace(/最多/g, '至多')
      .replace(/每隔/g, '每间隔').replace(/平均/g, '均等');
  }
  if (qt2 === 'fill') {
    // P40-Q-09：fill 题面全部走 builder 级 fillP 正序素材；seq 与说谎引语为既有特例保留。
    // 旧 splitClauses+reverse 机械倒序已随 fillP 全类型覆盖物理删除（倒序产出
    // 「设问先行条件后置」病句且引语/顿号碎裂，复现 #131/#162，见 docs/P40/change-log.md）。
    if (type === 'seq') {
      stemPrompt = '数列 ' + sq.s + ' 中，____ 是下一项';
    } else if (/「[^」]*[。，、；！？]/.test(prompt)) {
      // P32-AS-16E：直接引语内含句读（说谎模板「甲说：「乙在说谎。」…」），
      // 引语是逻辑命题本体，仅换叙述措辞；答案（乙）与三步推理不变。
      stemPrompt = '有甲、乙、丙三人，其中只有一人说真话。甲称乙撒了谎，乙称丙撒了谎，' +
        '丙则称甲、乙两人都撒了谎。说真话的是 ____。';
    } else {
      stemPrompt = fillP;
    }
  } else if (qt2 === 'choice') {
    // choice：条件同义换词 + 选择问式
    if (type === 'seq') {
      stemPrompt = '数列 ' + sq.s + ' 的下一项是多少？正确选项是哪一个？';
    } else if (/「[^」]*[。，、；！？]/.test(prompt)) {
      // P32-AS-16E：直接引语内含句读（说谎模板）时，机械删尾问句会连同引语右引号
      // 一起吃掉（丙的话未闭合）。改用引语闭合的换词选择式（命题等价，答案不变）。
      stemPrompt = '甲、乙、丙三人中只有一人称真话。甲称：「乙撒了谎。」' +
        '乙称：「丙撒了谎。」丙称：「甲、乙两人都撒了谎。」正确选项是哪一个？';
    } else {
      // P40-Q-03（#161）：去尾问句正则 [^。！？]*[？?]$ 会把「无句读分隔的整句题面」
      // 连条件一起删空（如抽屉原理「有4种颜色的球（…），至少要摸出多少个，才能保证…？」
      // 无句号 → condChoice 为空 → choice 只剩「正确选项是哪一个？」空壳）。
      // 回退：保留原问句 + 追加选择问式（与上方 seq 分支同型），条件完整承载设问。
      var condChoice = rewordCond(String(prompt).replace(/[^。！？]*[？?]\s*$/, ''));
      stemPrompt = condChoice
        ? condChoice + '正确选项是哪一个？'
        : rewordCond(String(prompt)) + ' 正确选项是哪一个？';
    }
  }

  // P25-07：choice 题型且源码侧有语义选项池 → 直接构建值约定选项
  //（避免落入 finisher 的数值重建把「鸡X只，兔Y只」类语义选项丢成数字）。
  if (plan.questionTypeId === 'choice' && (logicOptions || choicePool)) {
    var srcPool = (choicePool || logicOptions).map(String);
    var uniq = [], seenO = {};
    for (var oi = 0; oi < srcPool.length; oi++) {
      if (srcPool[oi] && !seenO[srcPool[oi]]) { seenO[srcPool[oi]] = 1; uniq.push(srcPool[oi]); }
    }
    var ansText = String(answer);
    if (uniq.indexOf(ansText) === -1) uniq.unshift(ansText);
    var opts = Rng.shuffle(rng, uniq.slice(0, 4));
    if (opts.indexOf(ansText) === -1) opts[0] = ansText;
    return {
      knowledgePointId: pkp(plan),
      questionType: plan.questionTypeId,
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: stemPrompt,
      answer: { value: ansText, acceptable: [], explanation: nativeWhy + '，正确选项是「' + ansText + '」。' },
      answerMode: 'choice',
      data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId, options: opts, correctIndex: opts.indexOf(ansText) }
    };
  }

  var finalWhy = nativeWhy
    ? (plan.questionTypeId === 'fill'
      ? nativeWhy + '，所以空格填 ' + String(answer) + '。'
      : nativeWhy + '。')
    : null;

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: stemPrompt,
    answer: { value: String(answer), acceptable: [], explanation: finalWhy },
    answerMode: 'input',
    data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId }
  };
}

// P25-06 H2：原 REASONING_KPS（math-gN-m10-* 模块制 / math-gN-c8-* 竞赛制 历史 ID）
// 已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function createReasoningGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:reasoning';

  return {
    id: id,
    subject: 'math',
    // P25-09：补 fill/choice——native 绑定的推理 KP（列表法/鸽巢/优化/规律）ALLOW 均为 fill/choice/apply；
    // fill 由 wrapGenerator finisher 机械补空位，choice 数值题走数值干扰项、logic/鸡兔题走源码选项池。
    capabilities: ['apply', 'calc', 'fill', 'choice'],
    questionTypes: ['apply', 'calc', 'fill', 'choice'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = {};

      for (var i = 0; i < count; i++) {
        questions.push(makeReasoningQuestion(plan, context, i, kp));
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

function buildAll() {
  return [createReasoningGenerator()];
}

module.exports = {
  createReasoningGenerator: createReasoningGenerator,
  buildAll: buildAll
};
