'use strict';

/**
 * shared/generator/generators/c9-comprehensive.js — C9 Comprehensive Application Generator
 *
 * 竞赛级 C9 综合应用题族 Generator：
 *   和差倍、年龄、盈亏（分配）、鸡兔同笼、平均数、植树、方阵、周期、牛吃草、
 *   分数百分数应用、经济（折扣利润）、容斥原理、一元一次/二元一次方程工具、
 *   不定方程、比例应用、混合问题，以及综合/杂题/模拟卷。
 *
 * 语义边界：
 *   - 容斥（c9-inclusion-exclusion）与 counting 的 c3 容斥、不定方程与 c2 数论版、
 *     鸡兔同笼/植树与 reasoning 标准版均为不同 KP（id 不同），靠 id 显式绑定 +
 *     hasC9Semantics(pluginId 含 c9 且 competition) 硬阻断隔离，互不抢单。
 *   - mock（模拟竞赛卷）题型为 open，故本族 capabilities 含 open。
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge/knowledge-point.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c9:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':c9:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c9:' + i;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '综合应用';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  // —— 题型判定：优先稳定 id slug，中文用完整词，避免泛化兜底误捕 ——
  var isSumDiff = id.indexOf('sum-diff') !== -1 || name.indexOf('和差') !== -1 || name.indexOf('和倍') !== -1;
  var isAge = id.indexOf('age') !== -1 || name.indexOf('年龄') !== -1;
  var isProfitLoss = id.indexOf('profit-loss') !== -1 || name.indexOf('盈亏') !== -1;
  var isChicken = id.indexOf('chicken') !== -1 || name.indexOf('鸡兔') !== -1;
  var isAverage = id.indexOf('average') !== -1 || name.indexOf('平均数') !== -1;
  var isPlanting = id.indexOf('planting') !== -1 || name.indexOf('植树') !== -1;
  var isPhalanx = id.indexOf('phalanx') !== -1 || name.indexOf('方阵') !== -1;
  var isPeriodic = id.indexOf('periodic') !== -1 || name.indexOf('周期') !== -1;
  var isGrass = id.indexOf('grass') !== -1 || name.indexOf('牛吃草') !== -1;
  var isFracPct = id.indexOf('fraction-percent') !== -1 || name.indexOf('分数百分数') !== -1;
  var isEconomics = id.indexOf('economics') !== -1 || name.indexOf('经济') !== -1;
  var isInclusion = id.indexOf('inclusion-exclusion') !== -1 || name.indexOf('容斥') !== -1;
  var isEq2 = id.indexOf('equation-linear-2') !== -1 || name.indexOf('二元') !== -1;
  var isEq1 = id.indexOf('equation-linear-1') !== -1 || name.indexOf('一元一次') !== -1;
  var isDiophantine = id.indexOf('diophantine') !== -1 || name.indexOf('不定方程') !== -1;
  var isRatio = id.indexOf('ratio-application') !== -1 || id.indexOf('ratio') !== -1 || name.indexOf('比例应用') !== -1;
  var isMixture = id.indexOf('mixture') !== -1 || name.indexOf('混合') !== -1;
  var isMisc = id.indexOf('misc') !== -1 || name.indexOf('杂题') !== -1 || name.indexOf('统筹') !== -1;
  var isMock = id.indexOf('mock') !== -1 || name.indexOf('模拟') !== -1;
  var isIntegrated = id.indexOf('integrated') !== -1 || name.indexOf('综合应用') !== -1;

  var v = i; // 变体序号：同 KP 同题型下轮换不同参数/设问，提升语义容量（R6）
  var prompt, answer, steps;

  if (isSumDiff) {
    // 和倍问题：甲+乙=S，甲是乙的 r 倍 → 乙=S/(r+1)
    var SD = [{ s: 48, r: 3 }, { s: 60, r: 2 }, { s: 72, r: 5 }, { s: 96, r: 3 }];
    var sd = SD[v % SD.length];
    prompt = '甲、乙两数的和是 ' + sd.s + '，甲数是乙数的 ' + sd.r + ' 倍。乙数是多少？';
    answer = sd.s / (sd.r + 1);
    steps = 2;
  } else if (isAge) {
    // 年龄差不变：父 F、子 C，k 倍时子=(F-C)/(k-1)
    var AGE = [{ f: 40, c: 12, k: 2 }, { f: 45, c: 15, k: 2 }, { f: 38, c: 10, k: 3 }, { f: 50, c: 20, k: 2 }];
    var age = AGE[v % AGE.length];
    var ageYears = (age.f - age.c) / (age.k - 1) - age.c;
    prompt = '爸爸今年 ' + age.f + ' 岁，儿子今年 ' + age.c + ' 岁。多少年后爸爸的年龄正好是儿子的 ' + age.k + ' 倍？';
    answer = ageYears;
    steps = 3;
  } else if (isProfitLoss) {
    // 盈亏：每人 p1 多 e1，每人 p2 少 s2 → 人数=(e1+s2)/(p2-p1)
    var PL = [{ p1: 3, e1: 7, p2: 4, s2: 5 }, { p1: 5, e1: 8, p2: 7, s2: 6 }, { p1: 4, e1: 10, p2: 6, s2: 2 }, { p1: 6, e1: 4, p2: 8, s2: 6 }];
    var pl = PL[v % PL.length];
    var plN = (pl.e1 + pl.s2) / (pl.p2 - pl.p1);
    prompt = '幼儿园分苹果：如果每人分 ' + pl.p1 + ' 个，则多出 ' + pl.e1 + ' 个；如果每人分 ' + pl.p2 + ' 个，则还差 ' + pl.s2 + ' 个。幼儿园一共有多少个小朋友？';
    answer = plN;
    steps = 3;
  } else if (isChicken) {
    // 鸡兔同笼：头 H、脚 F → 兔=(F-2H)/2
    var CR = [{ h: 20, f: 56 }, { h: 30, f: 84 }, { h: 25, f: 70 }, { h: 18, f: 52 }];
    var cr = CR[v % CR.length];
    prompt = '鸡兔同笼，共有 ' + cr.h + ' 个头、' + cr.f + ' 只脚。笼中兔子有多少只？';
    answer = (cr.f - 2 * cr.h) / 2;
    steps = 3;
  } else if (isAverage) {
    // 平均数：三次平均 A，前两次 x、y → 第三次=3A-x-y
    var AV = [{ a: 18, x: 15, y: 20 }, { a: 90, x: 85, y: 92 }, { a: 88, x: 90, y: 86 }, { a: 80, x: 76, y: 82 }];
    var av = AV[v % AV.length];
    prompt = '小明三次数学测验的平均分是 ' + av.a + ' 分，前两次分别得 ' + av.x + ' 分和 ' + av.y + ' 分。第三次测验得了多少分？';
    answer = 3 * av.a - av.x - av.y;
    steps = 2;
  } else if (isPlanting) {
    // 植树（两端都栽）：路长 L、间隔 G → L/G+1
    var PLT = [{ l: 100, g: 5 }, { l: 120, g: 6 }, { l: 150, g: 5 }, { l: 200, g: 8 }];
    var plt = PLT[v % PLT.length];
    prompt = '在一条长 ' + plt.l + ' 米的小路一旁植树，每隔 ' + plt.g + ' 米栽一棵，两端都要栽。一共要栽多少棵树？';
    answer = plt.l / plt.g + 1;
    steps = 2;
  } else if (isPhalanx) {
    // 实心方阵最外层：每边 n → 4(n-1)
    var PHX = [8, 10, 6, 12];
    var phx = PHX[v % PHX.length];
    prompt = '同学们排成一个实心方阵，最外层每边有 ' + phx + ' 人。最外层一共有多少人？';
    answer = 4 * (phx - 1);
    steps = 2;
  } else if (isPeriodic) {
    // 周期：颜色序列循环，第 pos 盏
    var PER = [{ cols: ['红', '黄', '蓝'], pos: 30 }, { cols: ['红', '黄', '蓝', '绿'], pos: 25 }, { cols: ['红', '黄', '蓝'], pos: 22 }, { cols: ['黑', '白'], pos: 17 }];
    var per = PER[v % PER.length];
    prompt = '节日彩灯按「' + per.cols.join('、') + '」的顺序循环排列。第 ' + per.pos + ' 盏灯是什么颜色？';
    answer = per.cols[(per.pos - 1) % per.cols.length];
    steps = 2;
  } else if (isGrass) {
    // 牛吃草：a 头 b 天、c 头 d 天 → 长 g=(a*b-c*d)/(b-d)，原 n0=a*b-g*b；e 头吃 t=n0/(e-g)
    var GRASS = [{ a: 10, b: 20, c: 15, d: 10, e: 25, t: 5 }, { a: 10, b: 30, c: 15, d: 15, e: 20, t: 10 }, { a: 8, b: 20, c: 12, d: 10, e: 14, t: 8 }];
    var gr = GRASS[v % GRASS.length];
    prompt = '一片牧场的草均匀生长。可供 ' + gr.a + ' 头牛吃 ' + gr.b + ' 天，或供 ' + gr.c + ' 头牛吃 ' + gr.d + ' 天。照此计算，可供 ' + gr.e + ' 头牛吃多少天？';
    answer = gr.t;
    steps = 4;
  } else if (isFracPct) {
    // 分数应用：第一天 f1、第二天 f2，剩 rem 页 → 全书=rem/(1-f1-f2)
    var FR = [{ f1: '1/4', f2: '1/3', rem: 50, ans: 120 }, { f1: '1/3', f2: '1/4', rem: 60, ans: 144 }, { f1: '1/2', f2: '1/5', rem: 30, ans: 100 }];
    var fr = FR[v % FR.length];
    prompt = '小明读一本书，第一天读了全书的 ' + fr.f1 + '，第二天读了全书的 ' + fr.f2 + '，还剩 ' + fr.rem + ' 页没读。这本书一共有多少页？';
    answer = fr.ans;
    steps = 3;
  } else if (isEconomics) {
    // 经济利润：进价 cost、标价 price、折扣 disc → 利润=price*disc-cost
    var ECO = [{ cost: 80, price: 120, disc: 0.8, ans: 16 }, { cost: 100, price: 150, disc: 0.9, ans: 35 }, { cost: 60, price: 100, disc: 0.85, ans: 25 }];
    var eco = ECO[v % ECO.length];
    var ecoSale = Math.round(eco.price * eco.disc);
    prompt = '一件商品进价 ' + eco.cost + ' 元，标价 ' + eco.price + ' 元。商店按标价打 ' + Math.round(eco.disc * 10) + ' 折出售，每件可获利多少元？';
    answer = ecoSale - eco.cost;
    steps = 2;
  } else if (isInclusion) {
    // 容斥（三集合）
    var INC = [
      { total: 40, aN: 20, bN: 18, cN: 16, ab: 8, ac: 7, bc: 6, abc: 3 },
      { total: 50, aN: 25, bN: 22, cN: 20, ab: 10, ac: 9, bc: 8, abc: 4 },
      { total: 45, aN: 18, bN: 16, cN: 15, ab: 7, ac: 6, bc: 5, abc: 2 }
    ];
    var inc = INC[v % INC.length];
    prompt = '某班 ' + inc.total + ' 人，参加数学小组 ' + inc.aN + ' 人、英语小组 ' + inc.bN + ' 人、科学小组 ' + inc.cN + ' 人；'
      + '同时参加数学和英语的 ' + inc.ab + ' 人，数学和科学的 ' + inc.ac + ' 人，英语和科学的 ' + inc.bc + ' 人；三个小组都参加的 ' + inc.abc + ' 人。三个小组都没参加的有多少人？';
    answer = inc.total - (inc.aN + inc.bN + inc.cN - inc.ab - inc.ac - inc.bc + inc.abc);
    steps = 3;
  } else if (isEq2) {
    // 二元一次方程组：x+y=S，x-y=D → x=(S+D)/2
    var EQ2 = [{ s: 10, d: 4 }, { s: 14, d: 6 }, { s: 20, d: 8 }, { s: 16, d: 4 }];
    var eq2 = EQ2[v % EQ2.length];
    prompt = '已知甲、乙两数之和是 ' + eq2.s + '，甲数比乙数大 ' + eq2.d + '。甲数是多少？';
    answer = (eq2.s + eq2.d) / 2;
    steps = 2;
  } else if (isEq1) {
    // 一元一次方程：ax+b=c → x=(c-b)/a
    var EQ1 = [{ a: 3, b: 5, c: 20 }, { a: 2, b: 3, c: 11 }, { a: 4, b: 7, c: 9 }, { a: 5, b: 8, c: 28 }];
    var eq1 = EQ1[v % EQ1.length];
    prompt = '一个数的 ' + eq1.a + ' 倍加上 ' + eq1.b + ' 等于 ' + eq1.c + '。这个数是多少？（列方程解答）';
    answer = (eq1.c - eq1.b) / eq1.a;
    steps = 2;
  } else if (isDiophantine) {
    // 不定方程正整数解组数
    var DIO = [{ s: '3x + 2y = 17', ans: 3 }, { s: '5x + 2y = 24', ans: 3 }, { s: '2x + 3y = 18', ans: 4 }];
    var dio = DIO[v % DIO.length];
    prompt = '求方程 ' + dio.s + ' 的正整数解一共有多少组？';
    answer = dio.ans;
    steps = 3;
  } else if (isRatio) {
    // 按比例分配：比例 r1:r2:r3 分 T → 第三份=T*r3/(r1+r2+r3)
    var RAT = [{ r: [2, 3, 5], t: 100 }, { r: [1, 2, 3], t: 120 }, { r: [3, 4, 5], t: 120 }, { r: [2, 5, 3], t: 100 }];
    var rat = RAT[v % RAT.length];
    var ratSum = rat.r[0] + rat.r[1] + rat.r[2];
    prompt = '把 ' + rat.t + ' 元奖金按 ' + rat.r[0] + ':' + rat.r[1] + ':' + rat.r[2] + ' 的比例分给甲、乙、丙三人。丙分得多少元？';
    answer = rat.t * rat.r[2] / ratSum;
    steps = 2;
  } else if (isMixture) {
    // 混合浓度：(m1*w1 + m2*w2)/(m1+m2)
    var MIX = [{ m1: 300, w1: 20, m2: 200, w2: 30, ans: 24 }, { m1: 200, w1: 10, m2: 300, w2: 20, ans: 16 }, { m1: 400, w1: 15, m2: 100, w2: 25, ans: 17 }];
    var mix = MIX[v % MIX.length];
    prompt = '把 ' + mix.m1 + ' 克浓度 ' + mix.w1 + '% 的盐水和 ' + mix.m2 + ' 克浓度 ' + mix.w2 + '% 的盐水混合。混合后盐水的浓度是百分之多少？';
    answer = (mix.m1 * mix.w1 + mix.m2 * mix.w2) / (mix.m1 + mix.m2);
    steps = 3;
  } else if (isMisc) {
    // 统筹（烙饼）：锅每次 2 张、每面 s 分，烙 k 张最少 = k*s（每面均需 s，可重叠批）
    var MISC = [{ k: 3, s: 3 }, { k: 3, s: 2 }, { k: 5, s: 3 }, { k: 4, s: 2 }];
    var misc = MISC[v % MISC.length];
    prompt = '一口平底锅每次最多能烙 2 张饼，每张饼两面都要烙，每面需 ' + misc.s + ' 分钟。烙熟 ' + misc.k + ' 张饼最少需要多少分钟？';
    answer = misc.k * misc.s;
    steps = 3;
  } else if (isMock || isIntegrated) {
    // 模拟卷 / 综合应用：和倍综合（总量 T，甲是乙 r 倍 → 乙=T/(r+1)）
    var INT = [{ t: 120, r: 3 }, { t: 200, r: 4 }, { t: 160, r: 3 }, { t: 240, r: 5 }];
    var it = INT[v % INT.length];
    prompt = '商店运来苹果和梨共 ' + it.t + ' 千克，其中苹果的质量是梨的 ' + it.r + ' 倍。梨有多少千克？';
    answer = it.t / (it.r + 1);
    steps = 2;
  } else {
    // 兜底：简单和倍（随种子变化）
    var ga = Rng.randInt(rng, 2, 9);
    prompt = name + '：甲、乙两数的和是 ' + (ga * 4) + '，甲数是乙数的 3 倍，乙数是多少？';
    answer = ga;
    steps = 2;
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: steps,
      questionType: plan.questionTypeId,
      family: 'c9-comprehensive'
    }
  };
}

var C9_KPS = [
  // —— G4 C9 综合（math-competition-g4-c9，3 个；mock 为 open 题型）——
  'math-g4-c9-c9-integrated',
  'math-g4-c9-c9-misc',
  'math-g4-c9-c9-mock',
  // —— G5 C9 综合（math-competition-g5-c9，15 个）——
  'math-g5-c9-sum-diff-problem',
  'math-g5-c9-age-problem',
  'math-g5-c9-profit-loss-problem',
  'math-g5-c9-chicken-rabbit',
  'math-g5-c9-average-problem',
  'math-g5-c9-planting-problem',
  'math-g5-c9-phalanx-problem',
  'math-g5-c9-periodic-problem',
  'math-g5-c9-grass-problem',
  'math-g5-c9-fraction-percent-application',
  'math-g5-c9-economics-problem',
  'math-g5-c9-inclusion-exclusion',
  'math-g5-c9-equation-linear-1',
  'math-g5-c9-equation-linear-2',
  'math-g5-c9-diophantine-equation',
  // —— G6 C9 综合（math-competition-g6-c9，16 个）——
  'math-g6-c9-sum-diff-problem',
  'math-g6-c9-age-problem',
  'math-g6-c9-profit-loss-problem',
  'math-g6-c9-chicken-rabbit',
  'math-g6-c9-average-problem',
  'math-g6-c9-planting-problem',
  'math-g6-c9-phalanx-problem',
  'math-g6-c9-periodic-problem',
  'math-g6-c9-grass-problem',
  'math-g6-c9-fraction-percent-application',
  'math-g6-c9-economics-problem',
  'math-g6-c9-equation-linear-1',
  'math-g6-c9-equation-linear-2',
  'math-g6-c9-inclusion-exclusion',
  'math-g6-c9-ratio-application',
  'math-g6-c9-mixture-problem'
];

function createC9Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c9-comprehensive';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc', 'open'],
    questionTypes: ['apply', 'calc', 'open'],
    knowledgePoints: spec.knowledgePoints || C9_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makeQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC9Generator({
      id: 'generator:c9-comprehensive',
      knowledgePoints: C9_KPS
    })
  ];
}

module.exports = {
  C9_KPS: C9_KPS,
  createC9Generator: createC9Generator,
  buildAll: buildAll
};
