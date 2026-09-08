'use strict';

/**
 * shared/generator/generators/c5-c6-journey-engineering.js
 * — C5/C6 Competition Journey & Engineering Generator
 *
 * 竞赛级 C5 行程族 + C6 工程/浓度族 Generator：
 *   基本行程、相遇、追及、火车过桥、流水行船、环形跑道、平均速度、比例行程、
 *   行程综合、发车间隔、接送问题、工程问题（合作/休息/变速）、浓度问题（混合/十字交叉）
 *
 * 注：C5 中两个「时钟问题」KP（math-g5-c5-clock-problem / math-g6-c5-clock）的
 *     题型为 recognize（元题型），按 recognize 豁免哲学保留给 selection 家族，不在本族。
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
  if (context && context.seed != null) return context.seed + ':c5c6:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c5c6:' + i;
}

function makeQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && kp.identity && kp.identity.name) || (kp && kp.name) || '行程问题';
  var id = (kp && (kp.identity && kp.identity.id)) || (kp && kp.id) || '';

  // —— 题型判定（优先按稳定的 id 英文 slug，其次中文名）——
  var isWork = id.indexOf('work') !== -1 || name.indexOf('工程') !== -1;
  var isConcentration = id.indexOf('concentration') !== -1 || name.indexOf('浓度') !== -1;
  var isMeet = id.indexOf('meet') !== -1 || name.indexOf('相遇') !== -1;
  var isChase = id.indexOf('chase') !== -1 || name.indexOf('追及') !== -1;
  var isTrain = id.indexOf('train') !== -1 || name.indexOf('火车') !== -1;
  var isBoat = id.indexOf('boat') !== -1 || id.indexOf('river') !== -1 || name.indexOf('流水') !== -1 || name.indexOf('行船') !== -1;
  var isCircular = id.indexOf('circular') !== -1 || id.indexOf('ring') !== -1 || name.indexOf('环形') !== -1 || name.indexOf('跑道') !== -1;
  var isAverage = id.indexOf('average-speed') !== -1 || name.indexOf('平均速度') !== -1;
  var isRatio = id.indexOf('ratio-motion') !== -1 || name.indexOf('比例行程') !== -1;
  var isInterval = id.indexOf('interval') !== -1 || name.indexOf('发车间隔') !== -1 || name.indexOf('间隔') !== -1;
  var isPickup = id.indexOf('pick-up') !== -1 || id.indexOf('pickup') !== -1 || name.indexOf('接送') !== -1;
  var isComplex = id.indexOf('complex') !== -1 || id.indexOf('competition') !== -1 || name.indexOf('综合') !== -1;
  var isBasic = id.indexOf('basic') !== -1 || name.indexOf('基本行程') !== -1;

  var prompt, answer, steps;

  if (isWork) {
    // 工程问题：A 独做 a 天，B 独做 b 天，合作天数 = ab/(a+b)
    var pairs = [[6, 3], [12, 6], [10, 15], [8, 8], [20, 30], [12, 4]];
    var wp = pairs[Rng.randInt(rng, 0, pairs.length - 1)];
    var a = wp[0], b = wp[1];
    var together = a * b / (a + b);
    prompt = '一项工程，甲队单独做需要 ' + a + ' 天完成，乙队单独做需要 ' + b + ' 天完成。'
      + '如果两队合作，多少天可以完成？';
    answer = together;
    steps = 3;
  } else if (isConcentration) {
    // 浓度问题：求盐的质量（溶液 × 浓度）
    var solution = [200, 300, 400, 500][Rng.randInt(rng, 0, 3)];
    var pct = [10, 15, 20, 25][Rng.randInt(rng, 0, 3)];
    var salt = solution * pct / 100;
    prompt = '现有 ' + solution + ' 克盐水，浓度为 ' + pct + '%。这杯盐水中含盐多少克？';
    answer = salt;
    steps = 2;
  } else if (isMeet) {
    // 相遇问题：相向而行，相遇时间 = 路程 / 速度和
    var v1 = Rng.randInt(rng, 4, 8) * 10;   // 40~80 km/h
    var v2 = Rng.randInt(rng, 4, 8) * 10;
    var t = Rng.randInt(rng, 2, 5);
    var dist = (v1 + v2) * t;
    prompt = '甲、乙两车分别从相距 ' + dist + ' 千米的两地同时出发，相向而行。'
      + '甲车每小时行 ' + v1 + ' 千米，乙车每小时行 ' + v2 + ' 千米。两车经过几小时相遇？';
    answer = t;
    steps = 2;
  } else if (isChase) {
    // 追及问题：同向而行，追及时间 = 路程差 / 速度差
    var vf = Rng.randInt(rng, 6, 9) * 10;
    var vs = Rng.randInt(rng, 3, 5) * 10;
    var ct = Rng.randInt(rng, 2, 5);
    var gap = (vf - vs) * ct;
    prompt = '弟弟以每小时 ' + vs + ' 千米的速度先出发，哥哥在距弟弟 ' + gap + ' 千米处骑自行车追赶，'
      + '哥哥每小时行 ' + vf + ' 千米。哥哥几小时后追上弟弟？';
    answer = ct;
    steps = 2;
  } else if (isTrain) {
    // 火车过桥：时间 = (车长 + 桥长) / 车速；取车长、桥长均为 15 的倍数，保证秒数为整数
    var trainLen = [150, 180][Rng.randInt(rng, 0, 1)];
    var bridgeLen = [300, 450, 600][Rng.randInt(rng, 0, 2)];
    var speed = 15; // m/s
    var total = trainLen + bridgeLen;
    var tt = total / speed;
    prompt = '一列火车长 ' + trainLen + ' 米，以每秒 ' + speed + ' 米的速度通过一座长 ' + bridgeLen + ' 米的大桥。'
      + '从车头上桥到车尾离桥，一共需要多少秒？';
    answer = tt;
    steps = 2;
  } else if (isBoat) {
    // 流水行船：顺水速度 = 船速 + 水速；求顺水行某距离时间
    var vb = Rng.randInt(rng, 20, 30);   // 静水速度 km/h
    var vw = Rng.randInt(rng, 3, 6);     // 水速
    var down = vb + vw;
    var bd = down * Rng.randInt(rng, 2, 4);
    var bt = bd / down;
    prompt = '一艘轮船在静水中每小时行 ' + vb + ' 千米，水流速度为每小时 ' + vw + ' 千米。'
      + '这艘船顺水航行 ' + bd + ' 千米，需要多少小时？';
    answer = bt;
    steps = 2;
  } else if (isCircular) {
    // 环形跑道：背向而行，第一次相遇时间 = 周长 / 速度和
    var sp1 = Rng.randInt(rng, 3, 6) * 10;   // 30~60 米/分（题目尺度）
    var sp2 = Rng.randInt(rng, 2, 4) * 10;   // 20~40 米/分
    var ctime0 = Rng.randInt(rng, 2, 4);     // 相遇时间（分）
    var circ = (sp1 + sp2) * ctime0;
    prompt = '甲、乙两人在周长 ' + circ + ' 米的环形跑道上从同一地点同时出发，背向而行。'
      + '甲每分钟跑 ' + sp1 + ' 米，乙每分钟跑 ' + sp2 + ' 米。两人经过多少分钟第一次相遇？';
    answer = ctime0;
    steps = 2;
  } else if (isAverage) {
    // 平均速度：往返等路程，avg = 2ab/(a+b)
    var av1 = 30, av2 = 60;
    var avg = 2 * av1 * av2 / (av1 + av2);
    prompt = '小明骑车从家到书店，去时每小时行 ' + av1 + ' 千米，沿原路返回时每小时行 ' + av2 + ' 千米。'
      + '求小明往返的平均速度。';
    answer = avg;
    steps = 3;
  } else if (isRatio) {
    // 比例行程：同路程，速度比 3:2，甲用 4 小时，乙用？小时（时间与速度成反比）
    prompt = '走同一段路，甲、乙两人的速度比是 3:2。甲走完全程用了 4 小时，乙走完全程需要多少小时？';
    answer = 6; // 时间比 = 速度反比 = 2:3 → 4 / 2 * 3 = 6
    steps = 3;
  } else if (isInterval) {
    // 发车间隔：同向，车速与发车间隔
    prompt = '一条公交线路上，公交车每隔 6 分钟发一班，车速为每分钟 500 米。'
      + '小明沿公交线路以每分钟 100 米的速度与公交车同向步行。'
      + '每隔多少分钟会有一辆公交车从身后追上小明？';
    // 相邻两车间距 = 500*6 = 3000 米；相对速度 = 500-100 = 400；追及间隔 = 3000/400 = 7.5
    answer = 7.5;
    steps = 3;
  } else if (isPickup) {
    // 接送问题（简化定量版）
    prompt = '汽车送一批人去机场，去程每小时行 60 千米，返程（空车）每小时行 90 千米，往返共用 5 小时（不含上下车时间）。'
      + '出发点到机场的距离是多少千米？';
    // 设距离 x：x/60 + x/90 = 5 → x*(3+2)/180 = 5 → x = 180
    answer = 180;
    steps = 3;
  } else if (isComplex || isBasic) {
    // 基本行程 / 行程综合：路程 = 速度 × 时间
    var bv = Rng.randInt(rng, 5, 9) * 10;
    var bt2 = Rng.randInt(rng, 2, 6);
    var bd2 = bv * bt2;
    if (isComplex) {
      prompt = '一辆汽车从甲地开往乙地，前 ' + (bt2 - 1) + ' 小时每小时行 ' + bv + ' 千米，'
        + '最后 1 小时又行了 ' + bv + ' 千米正好到达。甲、乙两地相距多少千米？';
      answer = bv * bt2;
    } else {
      prompt = '一列火车以每小时 ' + bv + ' 千米的速度行驶，' + bt2 + ' 小时可以行驶多少千米？';
      answer = bd2;
    }
    steps = 2;
  } else {
    // 兜底：基本行程
    var gv = Rng.randInt(rng, 5, 9) * 10;
    var gt = Rng.randInt(rng, 2, 5);
    prompt = name + '：一辆车以每小时 ' + gv + ' 千米的速度行驶 ' + gt + ' 小时，共行驶多少千米？';
    answer = gv * gt;
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
      family: 'c5-c6-journey-engineering'
    }
  };
}

var C5C6_KPS = [
  // —— G4 C5 行程（math-competition-c5-journey，5 个）——
  'math-g4-c5-c5-basic',
  'math-g4-c5-c5-meet',
  'math-g4-c5-c5-chase',
  'math-g4-c5-c5-train',
  'math-g4-c5-c5-river',
  // —— G5 C5 行程（math-competition-g5-c5，8 个 apply；clock-problem 为 recognize 留 selection）——
  'math-g5-c5-basic-motion',
  'math-g5-c5-meet-problem',
  'math-g5-c5-chase-problem',
  'math-g5-c5-train-bridge',
  'math-g5-c5-boat-stream',
  'math-g5-c5-circular-track',
  'math-g5-c5-average-speed',
  'math-g5-c5-ratio-motion',
  // —— G5 C6 工程/浓度（math-competition-g5-c6，2 个）——
  'math-g5-c6-work-problem',
  'math-g5-c6-concentration-problem',
  // —— G6 C5 行程（math-competition-g6-c5，10 个 apply；clock 为 recognize 留 selection）——
  'math-g6-c5-basic',
  'math-g6-c5-meet',
  'math-g6-c5-chase',
  'math-g6-c5-train-bridge',
  'math-g6-c5-boat-stream',
  'math-g6-c5-ring-runway',
  'math-g6-c5-journey-complex',
  'math-g6-c5-competition',
  'math-g6-c5-interval-departure',
  'math-g6-c5-pick-up-problem',
  // —— G6 C6 工程/浓度（math-competition-g6-c6，2 个）——
  'math-g6-c6-work-problem',
  'math-g6-c6-concentration-problem'
];

function createJourneyEngineeringGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c5-c6-journey-engineering';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C5C6_KPS,

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
    createJourneyEngineeringGenerator({
      id: 'generator:c5-c6-journey-engineering',
      knowledgePoints: C5C6_KPS
    })
  ];
}

module.exports = {
  C5C6_KPS: C5C6_KPS,
  createJourneyEngineeringGenerator: createJourneyEngineeringGenerator,
  buildAll: buildAll
};
