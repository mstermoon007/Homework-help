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
var KP = require('../../knowledge-point.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':c9:' + i;
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

  var prompt, answer, steps;

  if (isSumDiff) {
    // 和倍问题：甲+乙=48，甲是乙的 3 倍 → 乙=12，甲=36
    prompt = '甲、乙两数的和是 48，甲数是乙数的 3 倍。乙数是多少？';
    answer = 12;
    steps = 2;
  } else if (isAge) {
    // 年龄差不变：父 40、子 12，几年后父年龄是子 2 倍 → 差 28，子=28 时，28-12=16
    prompt = '爸爸今年 40 岁，儿子今年 12 岁。多少年后爸爸的年龄正好是儿子的 2 倍？';
    answer = 16;
    steps = 3;
  } else if (isProfitLoss) {
    // 盈亏问题：每人 3 个多 7，每人 4 个少 5 → 人数=(7+5)/(4-3)=12
    prompt = '幼儿园分苹果：如果每人分 3 个，则多出 7 个；如果每人分 4 个，则还差 5 个。'
      + '幼儿园一共有多少个小朋友？';
    answer = 12;
    steps = 3;
  } else if (isChicken) {
    // 鸡兔同笼：头 20、脚 56 → 兔=(56-2×20)/2=8，鸡=12
    prompt = '鸡兔同笼，共有 20 个头、56 只脚。笼中兔子有多少只？';
    answer = 8;
    steps = 3;
  } else if (isAverage) {
    // 平均数（移多补少）：三次平均 18，前两次 15、20 → 第三次=18×3-15-20=19
    prompt = '小明三次数学测验的平均分是 18 分（满分 20），前两次分别得 15 分和 20 分。'
      + '第三次测验得了多少分？';
    answer = 19;
    steps = 2;
  } else if (isPlanting) {
    // 植树（两端都栽）：路长 100 米，每隔 5 米一棵 → 100/5+1=21
    prompt = '在一条长 100 米的小路一旁植树，每隔 5 米栽一棵，两端都要栽。一共要栽多少棵树？';
    answer = 21;
    steps = 2;
  } else if (isPhalanx) {
    // 实心方阵最外层：每边 8 人 → 4×(8-1)=28
    prompt = '同学们排成一个实心方阵，最外层每边有 8 人。最外层一共有多少人？';
    answer = 28;
    steps = 2;
  } else if (isPeriodic) {
    // 周期：彩灯按红、黄、蓝循环，第 30 盏 → 30÷3=10 整除 → 蓝
    prompt = '节日彩灯按「红、黄、蓝」的顺序循环排列。第 30 盏灯是什么颜色？';
    answer = '蓝';
    steps = 2;
  } else if (isGrass) {
    // 牛吃草：10 头吃 20 天、15 头吃 10 天 → 每天长 5 份、原有 100 份；25 头吃 5 天
    prompt = '一片牧场的草均匀生长。可供 10 头牛吃 20 天，或供 15 头牛吃 10 天。'
      + '照此计算，可供 25 头牛吃多少天？';
    answer = 5;
    steps = 4;
  } else if (isFracPct) {
    // 分数应用：第一天 1/4、第二天 1/3，剩 50 页 → 剩 5/12，全书 120
    prompt = '小明读一本书，第一天读了全书的 1/4，第二天读了全书的 1/3，还剩 50 页没读。'
      + '这本书一共有多少页？';
    answer = 120;
    steps = 3;
  } else if (isEconomics) {
    // 经济利润：进价 80，标价 120，打八折 → 售价 96，利润 16
    prompt = '一件商品进价 80 元，标价 120 元。商店按标价打八折出售，每件可获利多少元？';
    answer = 16;
    steps = 2;
  } else if (isInclusion) {
    // 容斥（三集合）：40 人，数 20、英 18、科 16，数英 8、数科 7、英科 6，三者都参加 3
    var total = 40, aN = 20, bN = 18, cN = 16, ab = 8, ac = 7, bc = 6, abc = 3;
    prompt = '某班 40 人，参加数学小组 20 人、英语小组 18 人、科学小组 16 人；'
      + '同时参加数学和英语的 8 人，数学和科学的 7 人，英语和科学的 6 人；三个小组都参加的 3 人。'
      + '三个小组都没参加的有多少人？';
    answer = total - (aN + bN + cN - ab - ac - bc + abc);
    steps = 3;
  } else if (isEq2) {
    // 二元一次方程组：x+y=10，x-y=4 → x=7
    prompt = '已知甲、乙两数之和是 10，甲数比乙数大 4。甲数是多少？';
    answer = 7;
    steps = 2;
  } else if (isEq1) {
    // 一元一次方程：3x+5=20 → x=5
    prompt = '一个数的 3 倍加上 5 等于 20。这个数是多少？（列方程解答）';
    answer = 5;
    steps = 2;
  } else if (isDiophantine) {
    // 不定方程：3x+2y=17 正整数解 → (1,7)(3,4)(5,1) 共 3 组
    prompt = '求方程 3x + 2y = 17 的正整数解一共有多少组？';
    answer = 3;
    steps = 3;
  } else if (isRatio) {
    // 按比例分配：2:3:5 分 100 → 丙=100×5/10=50
    prompt = '把 100 元奖金按 2:3:5 的比例分给甲、乙、丙三人。丙分得多少元？';
    answer = 50;
    steps = 2;
  } else if (isMixture) {
    // 混合浓度：300 克 20% 与 200 克 30% 混合 → 盐 60+60=120，浓度 120/500=24%
    prompt = '把 300 克浓度 20% 的盐水和 200 克浓度 30% 的盐水混合。混合后盐水的浓度是百分之多少？';
    answer = 24;
    steps = 3;
  } else if (isMisc) {
    // 统筹（烙饼）：锅每次烙 2 张、每面 3 分钟，烙 3 张最少 → 9 分钟
    prompt = '一口平底锅每次最多能烙 2 张饼，每张饼两面都要烙，每面需 3 分钟。'
      + '烙熟 3 张饼最少需要多少分钟？';
    answer = 9;
    steps = 3;
  } else if (isMock || isIntegrated) {
    // 模拟卷 / 综合应用：和倍综合
    prompt = '商店运来苹果和梨共 120 千克，其中苹果的质量是梨的 3 倍。梨有多少千克？';
    answer = 30;
    steps = 2;
  } else {
    // 兜底：简单和倍
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
