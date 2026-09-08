'use strict';

/**
 * shared/generator/generators/stats.js — Statistics / Data Generator
 *
 * 统计族 Generator：数据收集、统计表、条形图、折线图、扇形图、平均数、可能性
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
  if (context && context.seed != null) return context.seed + ':stats:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':stats:' + i;
}

function makeStatsQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '统计问题';

  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('统计表') !== -1 || name.indexOf('正字') !== -1 || name.indexOf('收集') !== -1) type = 'data-collect';
  else type = 'chart-read';

  var prompt, answer, steps;
  if (type === 'average') {
    var nums = [];
    for (var i = 0; i < 4; i++) nums.push(Rng.randInt(rng, 20, 100));
    var avg = Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
    prompt = name + '：四个同学的身高分别是' + nums.join('cm、') + 'cm，求他们的平均身高。';
    answer = avg; steps = 2;
  } else if (type === 'probability') {
    var total = Rng.randInt(rng, 6, 12);
    var favorable = Rng.randInt(rng, 1, total - 1);
    prompt = '盒子里有' + total + '个球，其中' + favorable + '个红球，摸到红球的可能性是多少？';
    answer = favorable + '/' + total; steps = 1;
  } else if (type === 'line-chart') {
    prompt = name + '：根据折线图回答：哪一天的温度最高？最高温度是多少？';
    answer = '（从图中读取）'; steps = 1;
  } else if (type === 'bar-chart') {
    prompt = name + '：根据条形图回答：哪个年级的人数最多？多多少？';
    answer = '（从图中读取）'; steps = 1;
  } else if (type === 'pie-chart') {
    prompt = name + '：根据扇形图，如果总人数是100人，喜欢语文的有多少人？';
    answer = '（从图中读取百分比×100）'; steps = 2;
  } else if (type === 'double-chart') {
    prompt = name + '：复式统计图中，男生和女生在哪一项上的差距最大？';
    answer = '（从图中对比）'; steps = 2;
  } else if (type === 'data-collect') {
    prompt = name + '：用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。';
    answer = '（统计整理略）'; steps = 2;
  } else {
    prompt = name + '：根据统计表中的数据，回答相关问题。';
    answer = '（从表中读取）'; steps = 1;
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
    data: { mode: 'apply', steps: steps, questionType: plan.questionTypeId, graphic: { type: 'chart' } }
  };
}

var STATS_KPS = [
  'math-g2-m9-data-tally',
  'math-g2-m9-data-question',
  'math-g3-m9-g3-stats-table',
  'math-g4-m9-g4-stats-bar',
  'math-g4-m9-g4-stats-double',
  'math-g4-m9-g4-stats-avg',
  'math-g4-m11-stats',
  'math-g5-m4-g5-fill-linechart',
  'math-g5-m8-g5-word-linechart',
  'math-g5-m9-g5-stats-possib',
  'math-g5-m9-g5-stats-line1',
  'math-g5-m9-g5-stats-line2',
  'math-g5-m11-stats',
  'math-g5-m12-stats',
  'math-g6-m4-g6-fill-pie-chart',
  'math-g6-m5-g6-match-chart',
  'math-g6-m7-g6-pic-pie-chart',
  'math-g6-m9-g6-stat-pie-chart',
  'math-g6-m9-g6-stat-possibility',
  'math-g6-m11-g6-judge-chart',
  'math-g6-m12-g6-choice-chart'
];

function createStatsGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:stats';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || STATS_KPS,

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
        questions.push(makeStatsQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createStatsGenerator({
      id: 'generator:stats',
      knowledgePoints: STATS_KPS
    })
  ];
}

module.exports = {
  STATS_KPS: STATS_KPS,
  createStatsGenerator: createStatsGenerator,
  buildAll: buildAll
};
