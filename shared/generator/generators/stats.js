'use strict';

/**
 * shared/generator/generators/stats.js — Statistics / Data Generator
 *
 * 统计族 Generator：数据收集、统计表、条形图、折线图、扇形图、平均数、可能性
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
  if (context && context.seed != null) return context.seed + ':stats:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':stats:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':stats:' + i;
}

function makeStatsQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = (kp && (kp.name || (kp.identity && kp.identity.name))) || '统计问题';

  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('统计表') !== -1 || name.indexOf('正字') !== -1 || name.indexOf('收集') !== -1) type = 'data-collect';
  else type = 'chart-read';

  // 确定性数据序列（图表类型共用）
  var PEOPLE_LABELS = ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'];
  var FRUIT_LABELS = ['苹果', '香蕉', '西瓜', '葡萄'];
  var SUBJECT_LABELS = ['语文', '数学', '英语', '科学'];
  var series;
  function buildSeries(labels, lo, hi) {
    return labels.map(function (l) { return { label: l, value: Rng.randInt(rng, lo, hi) }; });
  }

  var prompt, answer, steps, graphic;
  if (type === 'average') {
    var nums = [];
    for (var ai = 0; ai < 4; ai++) nums.push(Rng.randInt(rng, 20, 100));
    var avg = Math.round(nums.reduce(function (a, b) { return a + b; }, 0) / nums.length);
    prompt = name + '：四个同学的身高分别是' + nums.join('cm、') + 'cm，求他们的平均身高。';
    answer = avg; steps = 2;
  } else if (type === 'probability') {
    var total = Rng.randInt(rng, 6, 12);
    var favorable = Rng.randInt(rng, 1, total - 1);
    prompt = '盒子里有' + total + '个球，其中' + favorable + '个红球，摸到红球的可能性是多少？';
    answer = favorable + '/' + total; steps = 1;
  } else if (type === 'line-chart') {
    var wdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    series = buildSeries(wdays, 18, 35);
    series.sort(function (x, y) { return wdays.indexOf(x.label) - wdays.indexOf(y.label); });
    var hi = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var lo = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var LC_Q = [
      { q: '哪一天的温度最高？最高温度是多少？', a: hi.label + '，' + hi.value + '℃' },
      { q: '哪一天的温度最低？最低温度是多少？', a: lo.label + '，' + lo.value + '℃' },
      { q: '温度最高的一天比最低的一天高多少℃？', a: (hi.value - lo.value) + '℃' }
    ];
    var lcq = LC_Q[i % LC_Q.length];
    prompt = name + '：根据折线图回答：' + lcq.q;
    answer = lcq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'line', params: { title: '一周气温变化', data: series } };
  } else if (type === 'bar-chart' || type === 'chart-read') {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiBar = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loBar = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var BAR_Q = [
      { q: '哪个年级的人数最多？多多少？', a: hiBar.label + '，' + hiBar.value + '人' },
      { q: '哪个年级的人数最少？少多少？', a: loBar.label + '，' + loBar.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiBar.value - loBar.value) + '人' }
    ];
    var bq = BAR_Q[i % BAR_Q.length];
    prompt = name + '：根据条形图回答：' + bq.q;
    answer = bq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', params: { title: '各年级人数统计', yLabel: '人数', data: series } };
  } else if (type === 'pie-chart') {
    var PIE = [
      { p: [30, 25, 25, 20], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [30, 25, 25, 20], ask: '喜欢数学和英语的一共有多少人？', idx: -1, extra: 45 },
      { p: [40, 20, 25, 15], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [20, 30, 30, 20], ask: '喜欢英语的有多少人？', idx: 2 }
    ];
    var pie = PIE[i % PIE.length];
    var pieData = SUBJECT_LABELS.map(function (l, pi) { return { label: l, percent: pie.p[pi] }; });
    var pieAns = pie.idx < 0 ? pie.extra + '人' : pieData[pie.idx].percent + '人';
    prompt = name + '：根据扇形图，如果总人数是100人，' + pie.ask;
    answer = pieAns; steps = 2;
    graphic = { type: 'chart', subtype: 'pie', params: { title: '最喜欢的科目', data: pieData } };
  } else if (type === 'double-chart') {
    var dLabels = ['跳绳', '跑步', '踢毽', '篮球'];
    series = dLabels.map(function (l) {
      return { label: l, a: Rng.randInt(rng, 15, 40), b: Rng.randInt(rng, 15, 40) };
    });
    var gapMax = series.slice().sort(function (x, y) {
      return Math.abs(y.a - y.b) - Math.abs(x.a - x.b);
    })[0];
    var gapMin = series.slice().sort(function (x, y) {
      return Math.abs(x.a - x.b) - Math.abs(y.a - y.b);
    })[0];
    var DC_Q = [
      { q: '男生和女生在哪一项上的差距最大？', a: gapMax.label + '（差 ' + Math.abs(gapMax.a - gapMax.b) + ' 人）' },
      { q: '男生和女生在哪一项上的差距最小？', a: gapMin.label + '（差 ' + Math.abs(gapMin.a - gapMin.b) + ' 人）' },
      { q: '男生在哪一项上参加的人数最多？', a: series.slice().sort(function (x, y) { return y.a - x.a; })[0].label + '（' + series.slice().sort(function (x, y) { return y.a - x.a; })[0].a + ' 人）' }
    ];
    var dcq = DC_Q[i % DC_Q.length];
    prompt = name + '：复式统计图中，' + dcq.q;
    answer = dcq.a; steps = 2;
    graphic = { type: 'chart', subtype: 'bar', params: { title: '男生女生运动情况', yLabel: '人数', data: series } };
  } else if (type === 'data-collect') {
    // R6：数据收集类增加真实语义变体（不同统计对象 / 不同记录方式 / 不同单位），
    // 提升 Effective Capacity（原仅单一水果正字模板 → 去重后容量 ≈1~2）。
    var TALLY_VARIANTS = [
      { labels: FRUIT_LABELS, title: '最喜欢的果汁', unit: '人', ask: '用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。' },
      { labels: ['跳绳', '跑步', '踢毽', '篮球', '乒乓球'], title: '喜欢的运动', unit: '人', ask: '调查同学们喜欢的运动项目，用画“√”的方法记录，请整理成数据表。' },
      { labels: ['故事书', '科普书', '漫画', '作文书'], title: '图书角类别', unit: '本', ask: '图书角有各类图书，分类清点数量后请填入统计表。' },
      { labels: ['晴', '阴', '雨', '雪'], title: '一周天气', unit: '天', ask: '记录一周的天气情况，用统计表整理各类天气的天数。' }
    ];
    var tv = TALLY_VARIANTS[i % TALLY_VARIANTS.length];
    series = buildSeries(tv.labels, 10, 40);
    prompt = name + '：' + tv.ask;
    answer = '（统计整理略）'; steps = 2;
    graphic = { type: 'chart', subtype: 'bar', params: { title: tv.title, yLabel: tv.unit, data: series } };
  } else {
    series = buildSeries(PEOPLE_LABELS, 20, 60);
    series.sort(function (x, y) { return PEOPLE_LABELS.indexOf(x.label) - PEOPLE_LABELS.indexOf(y.label); });
    var hiRead = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var loRead = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var READ_Q = [
      { q: '人数最多的年级是哪一年级？有多少人？', a: hiRead.label + '，' + hiRead.value + '人' },
      { q: '人数最少的年级是哪一年级？有多少人？', a: loRead.label + '，' + loRead.value + '人' },
      { q: '人数最多的年级比最少的年级多多少人？', a: (hiRead.value - loRead.value) + '人' }
    ];
    var rq = READ_Q[i % READ_Q.length];
    prompt = name + '：根据统计表中的数据，' + rq.q;
    answer = rq.a; steps = 1;
    graphic = { type: 'chart', subtype: 'bar', params: { title: '各年级人数统计', yLabel: '人数', data: series } };
  }

  var data = { mode: 'apply', steps: steps, questionType: plan.questionTypeId };
  if (graphic) data.graphic = graphic;

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
    data: data
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
