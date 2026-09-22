'use strict';

/**
 * shared/generator/generators/reasoning.js — Reasoning / Logic Generator
 *
 * 逻辑推理族 Generator：逻辑推理、抽屉原理、最值问题、鸡兔同笼、植树问题、找次品、握手问题、数独
 */

var Rng = require('../core/rng.js');

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

function makeReasoningQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // P25-09：名称以 selector 注入的 semanticParams.name 为准（kp={} 占位曾使分派恒落 logic）；
  // 直连调用兜底读传入 kp，再兜底「逻辑推理」。
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '逻辑推理';

  // P25-09：calc 为 form-bound 题型（题干必须内嵌算式 EXPR_RE）。
  // 推理族中仅 g2-up-u07-k001（7～9 的乘、除法）ALLOW calc，走 7~9 表乘除列式；
  // 其余名称兜底为带算式的规律计算题。
  if (plan.questionTypeId === 'calc') {
    var cPrompt, cAnswer;
    if (name.indexOf('除') !== -1 || name.indexOf('乘') !== -1 || name.indexOf('口诀') !== -1) {
      var a = Rng.randInt(rng, 7, 9);
      var b = Rng.randInt(rng, 2, 9);
      if (i % 2 === 0) {
        // P26：意图矩阵 driftRisk 警告「题面退化为纯算式」——补口诀运用情境词（calc form-bound，算式保留）
        cPrompt = '运用乘法口诀计算：' + a + ' × ' + b + ' = ____';
        cAnswer = a * b;
      } else {
        cPrompt = '用乘法口诀求商：' + (a * b) + ' ÷ ' + a + ' = ____';
        cAnswer = b;
      }
    } else {
      var x = Rng.randInt(rng, 2, 9);
      var y = Rng.randInt(rng, 2, 9);
      var z = Rng.randInt(rng, 1, 9);
      cPrompt = '找规律列式：' + x + ' × ' + y + ' + ' + z + ' = ____';
      cAnswer = x * y + z;
    }
    return {
      knowledgePointId: pkp(plan),
      questionType: 'calc',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: cPrompt,
      answer: { value: String(cAnswer), acceptable: [] },
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
  else if (name.indexOf('数独') !== -1) type = 'sudoku';
  else if (name.indexOf('必胜') !== -1) type = 'winning';
  else if (name.indexOf('优化') !== -1 || name.indexOf('沏茶') !== -1 || name.indexOf('烙饼') !== -1 || name.indexOf('统筹') !== -1) type = 'optimization';
  else if (name.indexOf('规律') !== -1 || name.indexOf('线段') !== -1 || name.indexOf('数字推理') !== -1) type = 'seq';
  else type = 'logic';

  // P25-07：choicePool/logicOptions 供 choice 题型构建选项（值约定）；其余题型忽略。
  var prompt, answer, steps, logicOptions = null, choicePool = null;
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
    answer = d.ans; steps = 2;
  } else if (type === 'extreme') {
    if (v % 3 === 0) {
      var twoSum = Rng.randInt(rng, 10, 50);
      var half = Math.floor(twoSum / 2);
      prompt = '两个数的和是' + twoSum + '，这两个数的乘积最大是多少？';
      answer = half * (twoSum - half); steps = 2;
    } else if (v % 3 === 1) {
      var twoSum2 = Rng.randInt(rng, 10, 50);
      var half2 = Math.floor(twoSum2 / 2);
      prompt = '两个数的和是' + twoSum2 + '，这两个数相差最小时分别是多少？';
      answer = half2 + ' 和 ' + (twoSum2 - half2); steps = 2;
    } else {
      var threeSum = Rng.randInt(rng, 12, 60);
      var base = Math.floor(threeSum / 3);
      var rem = threeSum - 3 * base;
      var parts = [base, base, base]; parts[2] += rem;
      prompt = '三个数的和是' + threeSum + '，这三个数尽可能接近时乘积最大，最大乘积是多少？';
      answer = parts[0] * parts[1] * parts[2]; steps = 2;
    }
  } else if (type === 'chicken-rabbit') {
    if (v % 3 === 0) {
      var heads = Rng.randInt(rng, 8, 20);
      var rabb0 = Rng.randInt(rng, 3, Math.max(3, heads - 2));
      var feet = heads * 2 + rabb0 * 2;
      prompt = '鸡兔同笼，共有' + heads + '个头，' + feet + '只脚。鸡和兔各多少只？';
      var r0 = (feet - heads * 2) / 2;
      answer = '鸡' + (heads - r0) + '只，兔' + r0 + '只'; steps = 3;
      choicePool = ['鸡' + (heads - r0) + '只，兔' + r0 + '只',
        '鸡' + r0 + '只，兔' + (heads - r0) + '只',
        '鸡' + (heads - r0 - 1) + '只，兔' + (r0 + 1) + '只',
        '鸡' + (heads - r0 + 1) + '只，兔' + (r0 - 1) + '只'];
    } else if (v % 3 === 1) {
      var D = Rng.randInt(rng, 1, 5);
      var R = Rng.randInt(rng, 3, 8);
      var F = 6 * R + 2 * D;
      prompt = '鸡兔同笼，鸡比兔多' + D + '只，共有' + F + '只脚。鸡和兔各多少只？';
      answer = '鸡' + (R + D) + '只，兔' + R + '只'; steps = 3;
      choicePool = ['鸡' + (R + D) + '只，兔' + R + '只',
        '鸡' + R + '只，兔' + (R + D) + '只',
        '鸡' + (R + D - 1) + '只，兔' + (R + 1) + '只',
        '鸡' + (R + D + 1) + '只，兔' + (R - 1) + '只'];
    } else {
      var D2 = Rng.randInt(rng, 1, 4);
      var C = Rng.randInt(rng, 3, 8);
      var F2 = 6 * C + 4 * D2;
      prompt = '鸡兔同笼，兔比鸡多' + D2 + '只，共有' + F2 + '只脚。鸡和兔各多少只？';
      answer = '鸡' + C + '只，兔' + (C + D2) + '只'; steps = 3;
      choicePool = ['鸡' + C + '只，兔' + (C + D2) + '只',
        '鸡' + (C + D2) + '只，兔' + C + '只',
        '鸡' + (C - 1) + '只，兔' + (C + D2 + 1) + '只',
        '鸡' + (C + 1) + '只，兔' + (C + D2 - 1) + '只'];
    }
  } else if (type === 'tree-planting') {
    var L = Rng.randInt(rng, 100, 500);
    var G = Rng.randInt(rng, 5, 20);
    var TP = [
      { desc: '两端都栽', ans: Math.floor(L / G) + 1 },
      { desc: '两端都不栽', ans: Math.floor(L / G) - 1 },
      { desc: '只在一端栽', ans: Math.floor(L / G) },
      { desc: '在环形操场周围栽（封闭）', ans: Math.floor(L / G) }
    ];
    var tp = TP[v % TP.length];
    prompt = '在一条长' + L + '米的公路一边植树，每隔' + G + '米栽一棵（' + tp.desc + '），一共要栽多少棵？';
    answer = tp.ans; steps = 2;
  } else if (type === 'find-defect') {
    var DEFECT = [
      { n: 3, ans: 1 }, { n: 9, ans: 2 }, { n: 27, ans: 3 }, { n: 81, ans: 4 }
    ];
    var df = DEFECT[v % DEFECT.length];
    prompt = '有' + df.n + '瓶水，其中1瓶是次品（略轻）。用天平称，至少称几次就能找出次品？';
    answer = df.ans; steps = 2;
  } else if (type === 'handshake') {
    var HSK = [
      { w: '个人，每两个人握一次手', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '支球队进行单循环比赛，每两队赛一场', ans: function (n) { return n * (n - 1) / 2; } },
      { w: '个点，每两个点连一条线段', ans: function (n) { return n * (n - 1) / 2; } }
    ];
    var hs = HSK[v % HSK.length];
    var n = Rng.randInt(rng, 4, 12);
    prompt = n + hs.w + '，一共需要多少次？';
    answer = hs.ans(n); steps = 2;
  } else if (type === 'sudoku') {
    var SUD = [
      { w: '请根据已知数字推理出空格中的数字。' },
      { w: '在 4×4 数独中，根据已知数字填出空格。' },
      { w: '在 6×6 数独中，根据已知数字填出空格。' }
    ];
    var su = SUD[v % SUD.length];
    prompt = name + '：' + su.w;
    answer = '（推理过程略）'; steps = 4;
  } else if (type === 'winning') {
    var WIN = [
      { w: '两堆棋子，每次只能从一堆中取 1~3 个，取到最后一个棋子者胜', a: '先手必胜（对称策略）' },
      { w: '一堆石子，每次可取 1~4 个，取到最后一个者胜', a: '先手必胜（凑 5 策略）' },
      { w: '三堆石子，每次从一堆取任意个，取到最后一个者胜', a: '先手必胜（尼姆和策略）' }
    ];
    var win = WIN[v % WIN.length];
    prompt = name + '：' + win.w + '。先手必胜还是后手必胜？';
    answer = win.a; steps = 3;
  } else if (type === 'optimization') {
    if (v % 3 === 0) {
      var pans = Rng.randInt(rng, 2, 5);
      prompt = '用一口锅烙' + pans + '张饼，每张饼两面都要烙，每面需要 2 分钟。至少需要多少分钟？';
      answer = pans * 2; steps = 3;
    } else if (v % 3 === 1) {
      prompt = '煮一个鸡蛋需要 8 分钟，同时可以洗锅 2 分钟。至少需要多少分钟？';
      answer = 8; steps = 2;
    } else {
      prompt = '看一集动画需要 15 分钟，同时可以写完作业 10 分钟。至少需要多少分钟？';
      answer = 15; steps = 2;
    }
  } else if (type === 'seq') {
    var SEQ = [
      { s: '2, 4, 6, 8', ans: 10 },
      { s: '1, 3, 5, 7', ans: 9 },
      { s: '1, 2, 4, 8', ans: 16 },
      { s: '1, 1, 2, 3, 5', ans: 8 }
    ];
    var sq = SEQ[v % SEQ.length];
    prompt = name + '：观察数列规律，写出下一个数：' + sq.s + ', ?';
    answer = sq.ans; steps = 1;
  } else {
    // P25-07：可解答的逻辑推理实例（替换原「（逻辑推理略）」不可解答桩）。
    // 三个模板均为唯一解，答案可机械验证；logicOptions 供 choice 题型构建选项。
    var LGV = v % 3;
    if (LGV === 0) {
      prompt = '甲、乙、丙三人中只有一人说真话。甲说：「乙在说谎。」乙说：「丙在说谎。」丙说：「甲和乙都在说谎。」谁说了真话？';
      answer = '乙'; steps = 3;
      logicOptions = ['甲', '乙', '丙'];
    } else if (LGV === 1) {
      var ageTop = Rng.randInt(rng, 9, 12);
      prompt = '小明比小红大 2 岁，小红比小刚大 3 岁，小明今年 ' + ageTop + ' 岁。三人中谁最大？';
      answer = '小明'; steps = 2;
      logicOptions = ['小明', '小红', '小刚'];
    } else {
      prompt = '三个盒子上分别标着「苹果」「橘子」「混合」，标签全都贴错了。只从其中一个盒子里摸出一个水果，就能判断所有盒子里装的是什么。应该从哪个盒子摸？';
      answer = '标着「混合」的盒子'; steps = 3;
      logicOptions = ['标着「苹果」的盒子', '标着「橘子」的盒子', '标着「混合」的盒子'];
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
      prompt: prompt,
      answer: { value: ansText, acceptable: [] },
      answerMode: 'choice',
      data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId, options: opts, correctIndex: opts.indexOf(ansText) }
    };
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'number' ? { value: String(answer), acceptable: [] } : { value: String(answer), acceptable: [] },
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
      return questions;
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
