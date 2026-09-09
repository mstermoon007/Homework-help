'use strict';

/**
 * shared/generator/generators/application.js — Application / Word Problem Generator
 *
 * 应用题 Generator：基于 KP 语义约束生成应用题
 * - 已知条件 / 问题 / 数量关系 / 运算 / 答案 全链路一致
 * - 支持多步、逆向、比较、行程、工程等典型数量关系
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge/knowledge-point.js');
var Arith = require('../core/arithmetic-core.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':apply:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':apply:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':apply:' + i;
}

// 典型应用题模板
var PROBLEM_TEMPLATES = {
  // 总量 = 分量 + 分量
  'total-from-parts': {
    zh: '已知条件：{a} 和 {b}。\n问题：一共多少？',
    ops: ['add'],
    relation: 'total = part1 + part2'
  },
  // 总量 - 分量 = 分量
  'part-from-total': {
    zh: '已知条件：一共 {total}，其中 {part1}。\n问题：剩下多少？',
    ops: ['sub'],
    relation: 'part2 = total - part1'
  },
  // 比较：多几个 / 少几个
  'compare-more': {
    zh: '已知条件：A 有 {a}，B 比 A 多 {diff}。\n问题：B 有多少？',
    ops: ['add'],
    relation: 'B = A + diff'
  },
  'compare-less': {
    zh: '已知条件：A 有 {a}，B 比 A 少 {diff}。\n问题：B 有多少？',
    ops: ['sub'],
    relation: 'B = A - diff'
  },
  // 倍数关系
  'multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 倍。\n问题：B 有多少？',
    ops: ['mult'],
    relation: 'B = A × n'
  },
  'divide-multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 分之 1。\n问题：B 有多少？',
    ops: ['div'],
    relation: 'B = A ÷ n'
  },
  // 分配/分组
  'grouping': {
    zh: '已知条件：一共 {total}，每组 {per}。\n问题：能分几组？',
    ops: ['div'],
    relation: 'groups = total ÷ per'
  },
  // 行程：速度 × 时间 = 路程
  'distance': {
    zh: '已知条件：速度 {speed}，时间 {time}。\n问题：路程多少？',
    ops: ['mult'],
    relation: 'distance = speed × time'
  },
  // 工程：效率 × 时间 = 总量
  'work': {
    zh: '已知条件：效率 {rate}，时间 {time}。\n问题：完成多少？',
    ops: ['mult'],
    relation: 'work = rate × time'
  }
};

var TEMPLATE_KEYS = Object.keys(PROBLEM_TEMPLATES);

function getApplicationMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickTemplate(rng, difficulty) {
  // 低难度用简单模板，高难度用复杂模板
  var simpleTemplates = ['total-from-parts', 'part-from-total', 'compare-more', 'compare-less'];
  var complexTemplates = ['multiple', 'divide-multiple', 'grouping', 'distance', 'work'];
  var pool = difficulty >= 4 ? TEMPLATE_KEYS : simpleTemplates;
  return Rng.pick(rng, pool);
}

function generateNumbers(rng, template, difficulty) {
  var maxVal = Math.min(100, 10 + difficulty * 15);
  var minVal = 1;
  
  switch (template) {
    case 'total-from-parts':
      var a = randInt(rng, minVal, maxVal);
      var b = randInt(rng, minVal, maxVal);
      return { a: a, b: b };
    case 'compare-more':
      var a = randInt(rng, minVal + 2, maxVal);
      var diff = randInt(rng, minVal, maxVal - a);
      return { a: a, diff: diff };
    case 'part-from-total':
      var total = randInt(rng, minVal + 2, maxVal);
      var part1 = randInt(rng, minVal, total - 1);
      return { total: total, part1: part1 };
    case 'compare-less':
      var a = randInt(rng, minVal + 2, maxVal);
      var diff = randInt(rng, minVal, a - 1);
      return { a: a, diff: diff };
    case 'multiple':
      var a = randInt(rng, minVal, Math.floor(maxVal / 3));
      var n = randInt(rng, 2, 5);
      return { a: a, n: n };
    case 'divide-multiple':
      var n = randInt(rng, 2, 5);
      var b = randInt(rng, minVal, maxVal);
      var a = b * n;
      return { a: a, n: n };
    case 'grouping':
      var per = randInt(rng, 2, 10);
      var groups = randInt(rng, 2, 10);
      var total = per * groups;
      return { total: total, per: per };
    case 'distance':
      var speed = randInt(rng, 10, 100);
      var time = randInt(rng, 1, 5);
      return { speed: speed, time: time };
    case 'work':
      var rate = randInt(rng, 5, 50);
      var time = randInt(rng, 1, 10);
      return { rate: rate, time: time };
  }
  return { a: randInt(rng, 1, 20), b: randInt(rng, 1, 20) };
}

function computeAnswer(template, nums) {
  switch (template) {
    case 'total-from-parts': return nums.a + nums.b;
    case 'part-from-total': return nums.total - nums.part1;
    case 'compare-more': return nums.a + nums.diff;
    case 'compare-less': return nums.a - nums.diff;
    case 'multiple': return nums.a * nums.n;
    case 'divide-multiple': return nums.a / nums.n;
    case 'grouping': return nums.total / nums.per;
    case 'distance': return nums.speed * nums.time;
    case 'work': return nums.rate * nums.time;
  }
  return nums.a + (nums.b || 0);
}

function formatTemplate(template, nums) {
  var tpl = PROBLEM_TEMPLATES[template];
  var str = tpl.zh;
  
  Object.keys(nums).forEach(function(key) {
    var placeholder = '{' + key + '}';
    var val = nums[key];
    if (typeof val === 'number') {
      str = str.replace(placeholder, String(val));
    } else {
      str = str.replace(placeholder, val);
    }
  });
  return str;
}

function makeApplicationQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var template = pickTemplate(rng, plan.difficulty);
  var nums = generateNumbers(rng, template, plan.difficulty);
  var answer = computeAnswer(template, nums);
  var prompt = formatTemplate(template, nums);
  
  // 添加干扰项（用于 choice）
  var distractors = [];
  var ans = answer;
  for (var d = 0; d < 3; d++) {
    var offset = randInt(rng, -5, 5);
    if (offset === 0) offset = 1;
    var dist = ans + offset;
    if (dist > 0 && distractors.indexOf(dist) === -1 && dist !== ans) {
      distractors.push(dist);
    }
  }
  
  var qt = plan.questionTypeId;
  if (qt === 'choice') {
    var options = Rng.shuffle(rng, [ans].concat(distractors).slice(0, 4));
    var correctIndex = options.indexOf(ans);
    return {
      knowledgePointId: pkp(plan),
      questionType: 'choice',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: String(correctIndex),
      answerMode: 'choice',
      data: {
        mode: 'choice',
        steps: Object.keys(nums).length > 2 ? 2 : 1,
        template: template,
        numbers: nums,
        options: options,
        correctIndex: correctIndex,
        relation: PROBLEM_TEMPLATES[template].relation
      }
    };
  }
  
  if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    var shown = isTrue ? ans : ans + randInt(rng, -5, 5) || 1;
    return {
      knowledgePointId: pkp(plan),
      questionType: 'judge',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt + ' 答案是 ' + shown + ' —— 对还是错？',
      answer: isTrue,
      answerMode: 'judge',
      data: {
        mode: 'judge',
        steps: Object.keys(nums).length > 2 ? 2 : 1,
        template: template,
        numbers: nums,
        shownAnswer: shown,
        relation: PROBLEM_TEMPLATES[template].relation
      }
    };
  }
  
  // fill / apply / calc / oral
  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: qt === 'apply' ? 'input' : 'input',
    data: {
      mode: qt,
      steps: Object.keys(nums).length > 2 ? 2 : 1,
      template: template,
      numbers: nums,
      relation: PROBLEM_TEMPLATES[template].relation,
      operation: PROBLEM_TEMPLATES[template].ops[0]
    }
  };
}

function makeGraphicForApplication(template, nums) {
  // 根据模板类型生成辅助图形
  return {
    type: 'geometry',
    subtype: 'rectangle',
    params: {
      width: 6,
      height: 3,
      labelSides: false,
      dashed: true,
      unit: '',
      unitPx: 30
    }
  };
}

function createApplicationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:application';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'oral', 'open'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var meta = getApplicationMeta(kp);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        if (qt === 'open') {
          // open qt：竞赛开放题，综合运用知识点
          var rng = Rng.createSeededRandom(seedFor(plan, context, i));
          var a = randInt(rng, 10, 99);
          var b = randInt(rng, 2, 12);
          var ops = ['加', '减', '乘', '除'];
          var opWord = Rng.pick(rng, ops);
          var answer = computeAnswer('multiplication', { a: a, n: b });
          q = {
            knowledgePointId: pkp(plan),
            questionType: 'open',
            difficulty: plan.difficulty,
            spiralLevel: plan.spiralLevel || 1,
            context: plan.contextType || 'standard',
            seed: seedFor(plan, context, i),
            prompt: '【竞赛开放题】一个数是' + a + '，另一个数是' + b + '的多少倍？请写出完整的解题过程并说明你的思路。',
            answer: { value: String(answer), acceptable: [] },
            answerMode: 'input',
            data: {
              mode: 'open',
              steps: 3,
              graphic: makeGraphicForApplication('multiplication', { a: a, n: b }),
              numbers: { a: a, b: b, answer: answer },
              template: 'competition-open'
            }
          };
        } else {
          q = makeApplicationQuestion(plan, context, i, meta);
          q.data.graphic = makeGraphicForApplication(q.data.template, q.data.numbers);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

var APPLICATION_KPS = [
  'math-g1-m8-rmb-shopping',
  'math-g2-m8-money',
  'math-g3-m4-g3-measure',
  'math-g4-m8-g4-word-div',
  'math-g4-m8-g4-word-div', // duplicate intentionally for weight
  'math-g5-m8-g5-word-solid',
  'math-g6-c4-area-basic',
  'math-g6-c4-solid-geometry',
  'math-g6-m10-g6-reason-number-shape'
  // 注：math-g4-c9-c9-mock（open qt 竞赛模拟卷）已移至 generator:c9-comprehensive
];

function buildAll() {
  return [
    createApplicationGenerator({
      id: 'generator:application-word',
      knowledgePoints: APPLICATION_KPS
    })
  ];
}

module.exports = {
  PROBLEM_TEMPLATES: PROBLEM_TEMPLATES,
  createApplicationGenerator: createApplicationGenerator,
  buildAll: buildAll
};