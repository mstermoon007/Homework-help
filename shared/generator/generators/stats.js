'use strict';

/**
 * shared/generator/generators/stats.js — Statistics / Data Generator
 *
 * 统计族 Generator：数据收集、统计表、条形图、折线图、扇形图、平均数、可能性
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
  if (context && context.seed != null) return context.seed + ':stats:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':stats:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':stats:' + i;
}

function makeStatsQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // P25-09：名称以 selector 注入的 semanticParams.name 为准（kp={} 占位曾使分派恒落 chart-read）。
  var name = (plan && plan.semanticParams && plan.semanticParams.name)
    || (kp && (kp.name || (kp.identity && kp.identity.name)))
    || '统计问题';

  var qt = plan.questionTypeId;
  var type = 'generic';
  if (name.indexOf('平均') !== -1) type = 'average';
  else if (name.indexOf('可能') !== -1) type = 'probability';
  // P25-09：复式（复式折线/复式条形）须先于单式折线，否则被「折线」截胡成单式
  else if (name.indexOf('复式') !== -1) type = 'double-chart';
  else if (name.indexOf('折线') !== -1) type = 'line-chart';
  else if (name.indexOf('条形') !== -1) type = 'bar-chart';
  else if (name.indexOf('扇形') !== -1 || name.indexOf('饼') !== -1) type = 'pie-chart';
  // P25-09：时间/日历族（顺序敏感：经过→平闰→钟面→单位换算→年月日兜底；
  // 平年闰年含「年」字须先于日历，时间单位先于图表兜底）
  else if (name.indexOf('经过') !== -1) type = 'elapsed-time';
  else if (name.indexOf('平年') !== -1 || name.indexOf('闰年') !== -1) type = 'leap-year';
  else if (name.indexOf('钟面') !== -1 || name.indexOf('时针') !== -1 || name.indexOf('分针') !== -1 || name.indexOf('秒针') !== -1) type = 'clock';
  else if (name.indexOf('时间单位') !== -1 || name.indexOf('时、分、秒') !== -1) type = 'time-convert';
  else if (name.indexOf('年') !== -1 || name.indexOf('月') !== -1) type = 'calendar';
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
  // P25-09：互异取值序列（choice 问最高/最低时保证答案唯一，选项串也互不相同）
  function distinctSeries(labels, lo, hi) {
    var pool = [];
    for (var v = lo; v <= hi; v++) pool.push(v);
    var picked = Rng.shuffle(rng, pool).slice(0, labels.length);
    return labels.map(function (l, li) { return { label: l, value: picked[li] }; });
  }

  var prompt, answer, steps, graphic;
  var chOpts = null;
  var data = { mode: 'apply', steps: steps, questionType: qt };
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
    if (qt === 'choice') {
      // P25-09：分数答案非纯数值，finisher 无法机械建项，源码自建 4 个互异分数选项
      var pPool = [favorable, favorable - 1, favorable + 1, favorable + 2];
      var pSeen = {};
      var pUniq = [];
      pPool.forEach(function (x) {
        if (x >= 1 && x <= total - 1 && !pSeen[x]) { pSeen[x] = 1; pUniq.push(x); }
      });
      var pPad = 1;
      while (pUniq.length < 4) {
        var pCand = ((favorable + pPad * 2) % (total - 1)) + 1;
        if (!pSeen[pCand]) { pSeen[pCand] = 1; pUniq.push(pCand); }
        pPad++;
      }
      chOpts = Rng.shuffle(rng, pUniq.slice(0, 4).map(function (x) { return x + '/' + total; }));
      answer = favorable + '/' + total;
      prompt = name + '：盒子里有' + total + '个球，其中' + favorable + '个红球，其余是白球。摸到红球的可能性是多少？';
      data.choiceForm = true;
    }
  } else if (type === 'line-chart') {
    var wdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    series = distinctSeries(wdays, 18, 35);
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
    if (qt === 'choice') {
      // P25-09：最高/最低日选项取自 7 个数据点（标签互异⇒选项串互异），答案值约定
      var lcTarget = (i % 2 === 0) ? hi : lo;
      chOpts = Rng.shuffle(rng, series.map(function (s) { return s.label + '，' + s.value + '℃'; }));
      answer = lcTarget.label + '，' + lcTarget.value + '℃';
      prompt = name + '：根据折线图回答：' + ((i % 2 === 0) ? '哪一天的温度最高？' : '哪一天的温度最低？') + '（  ）';
      data.choiceForm = true;
    }
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

    // P25-07 题型形态适配：choice/judge/calc 计划下产出对应教育形态
    //（原生只产「读图问答题」，choice 无选项、judge 非布尔、calc 无算式，均不合规）。
    if (plan.questionTypeId === 'choice') {
      var chOpts, chAns;
      if (i % 3 === 2) {
        var diffV = hiBar.value - loBar.value;
        chAns = diffV + '人';
        chOpts = [chAns, (diffV + 1) + '人', (diffV - 1) + '人', (diffV + 2) + '人'];
      } else {
        var targetC = (i % 3 === 0) ? hiBar : loBar;
        chAns = targetC.label + '，' + targetC.value + '人';
        chOpts = series.map(function (s) { return s.label + '，' + s.value + '人'; });
      }
      chOpts = Rng.shuffle(rng, chOpts);
      prompt = name + '：根据条形图回答：' + bq.q + '（  ）';
      answer = chAns;
      data.choiceForm = true;
    } else if (plan.questionTypeId === 'judge') {
      var targetJ = (i % 3 === 0) ? hiBar : loBar;
      var isTrueJ = rng() < 0.5;
      var deltaJ = (targetJ.value > 21 && rng() < 0.5) ? -1 : 1;
      var shownJ = isTrueJ ? targetJ.value : targetJ.value + deltaJ;
      prompt = name + '：根据条形图判断：「' + targetJ.label + '有 ' + shownJ + ' 人」——对还是错？';
      answer = isTrueJ;
      data.judgeForm = true;
    } else if (plan.questionTypeId === 'calc') {
      // 列式计算形态：问法收敛为「最多 − 最少」差值，题干内嵌可求值算式
      prompt = name + '：根据条形图列式计算，人数最多的年级比最少的年级多多少人？'
        + '列式：' + hiBar.value + ' − ' + loBar.value + ' = ？';
      answer = hiBar.value - loBar.value;
      data.calcForm = true;
    }
  } else if (type === 'pie-chart') {
    var PIE = [
      { p: [30, 25, 25, 20], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [30, 25, 25, 20], ask: '喜欢数学和英语的一共有多少人？', idx: -1, extra: 45 },
      { p: [40, 20, 25, 15], ask: '喜欢语文的有多少人？', idx: 0 },
      { p: [20, 30, 30, 20], ask: '喜欢英语的有多少人？', idx: 2 }
    ];
    // P25-09：choice 改问「占比最大的科目」，只在最大值唯一的变体上轮换（避免双解）
    var pie = (qt === 'choice') ? ((i % 2 === 0) ? PIE[0] : PIE[2]) : PIE[i % PIE.length];
    var pieData = SUBJECT_LABELS.map(function (l, pi) { return { label: l, percent: pie.p[pi] }; });
    var pieAns = pie.idx < 0 ? pie.extra + '人' : pieData[pie.idx].percent + '人';
    prompt = name + '：根据扇形图，如果总人数是100人，' + pie.ask;
    answer = pieAns; steps = 2;
    graphic = { type: 'chart', subtype: 'pie', params: { title: '最喜欢的科目', data: pieData } };
    if (qt === 'choice') {
      var pieMax = pieData.slice().sort(function (x, y) { return y.percent - x.percent; })[0];
      chOpts = Rng.shuffle(rng, SUBJECT_LABELS.slice());
      answer = pieMax.label;
      prompt = name + '：根据扇形图，最喜欢哪一科的人数所占百分比最大？';
      data.choiceForm = true;
    }
  } else if (type === 'double-chart') {
    var dLabels = ['跳绳', '跑步', '踢毽', '篮球'];
    // P25-09：男/女各自取互异且彼此分离的取值，保证「人数最多项」与差距极值唯一
    var aVals = Rng.shuffle(rng, [16, 22, 28, 35]);
    var bVals = Rng.shuffle(rng, [18, 24, 31, 37]);
    series = dLabels.map(function (l, di) {
      return { label: l, a: aVals[di], b: bVals[di] };
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
    graphic = {
      type: 'chart',
      subtype: name.indexOf('折线') !== -1 ? 'line' : 'bar',
      params: { title: '男生女生运动情况', yLabel: '人数', data: series }
    };
    if (qt === 'choice') {
      // P25-09：文本答案无法靠 finisher 建项；问男/女生参加人数最多的项目（4 个互异标签）
      var dcIsBoy = (i % 2 === 0);
      var dcPick = series.slice().sort(function (x, y) {
        return dcIsBoy ? (y.a - x.a) : (y.b - x.b);
      })[0];
      chOpts = Rng.shuffle(rng, dLabels.slice());
      answer = dcPick.label;
      prompt = name + '：复式统计图中，' + (dcIsBoy ? '男生' : '女生') + '参加人数最多的是哪一项？';
      data.choiceForm = true;
    }
  } else if (type === 'data-collect') {
    // R6：数据收集类增加真实语义变体（不同统计对象 / 不同记录方式 / 不同单位），
    // 提升 Effective Capacity（原仅单一水果正字模板 → 去重后容量 ≈1~2）。
    // P25-09：按题型形态产出——choice 问最多/最少类别（标签互异），
    // fill 问合计数值，apply 保留「整理统计表」任务并回答具体结论。
    var TALLY_VARIANTS = [
      { labels: FRUIT_LABELS, title: '最喜欢的果汁', unit: '人', ask: '用正字法收集全班同学喜欢的水果，数据如下，请整理成统计表。' },
      { labels: ['跳绳', '跑步', '踢毽', '篮球', '乒乓球'], title: '喜欢的运动', unit: '人', ask: '调查同学们喜欢的运动项目，用画“√”的方法记录，请整理成数据表。' },
      { labels: ['故事书', '科普书', '漫画', '作文书'], title: '图书角类别', unit: '本', ask: '图书角有各类图书，分类清点数量后请填入统计表。' },
      { labels: ['晴', '阴', '雨', '雪'], title: '一周天气', unit: '天', ask: '记录一周的天气情况，用统计表整理各类天气的天数。' }
    ];
    var tv = TALLY_VARIANTS[i % TALLY_VARIANTS.length];
    // 分段取值 + 段内抖动，保证各类数量互异（最多/最少结论唯一）
    var tallyBase = Rng.shuffle(rng, tv.labels.map(function (_, ti) {
      return 12 + ti * 7 + Rng.randInt(rng, 0, 4);
    }));
    series = tv.labels.map(function (l, ti) { return { label: l, value: tallyBase[ti] }; });
    var dcMax = series.slice().sort(function (x, y) { return y.value - x.value; })[0];
    var dcMin = series.slice().sort(function (x, y) { return x.value - y.value; })[0];
    var dcTotal = series.reduce(function (acc, s) { return acc + s.value; }, 0);
    graphic = { type: 'chart', subtype: 'bar', params: { title: tv.title, yLabel: tv.unit, data: series } };
    if (qt === 'choice') {
      var dcAskMax = (i % 2 === 0);
      chOpts = Rng.shuffle(rng, tv.labels.slice());
      answer = dcAskMax ? dcMax.label : dcMin.label;
      prompt = name + '：调查记录整理成统计表后，数量' + (dcAskMax ? '最多' : '最少') + '的是哪一类？';
      data.choiceForm = true;
      steps = 2;
    } else if (qt === 'fill') {
      answer = dcTotal;
      prompt = name + '：' + tv.ask + '表中各类数量一共有多少' + tv.unit + '？（合计：____）';
      steps = 2;
    } else {
      answer = dcMax.label + '（' + dcMax.value + tv.unit + '）';
      prompt = name + '：' + tv.ask + '并回答：数量最多的是哪一类，有多少' + tv.unit + '？';
      steps = 2;
    }
  } else if (type === 'clock') {
    // P25-09：钟面结构 native maker（g2-down-u01-k001，calc/fill/choice/apply）
    steps = 1;
    if (qt === 'calc') {
      var CLK_CALC = [
        { q: '钟面上有12个大格，每个大格有5个小格，钟面上一共有多少个小格？列式：12 × 5 = ？', a: 60 },
        { q: '分针从12走到6，走了6个大格，一共走了多少分钟？列式：6 × 5 = ？', a: 30 },
        { q: '时针从2走到5，走了几个大格、是多少小时？列式：(5 − 2) × 1 = ？', a: 3 }
      ];
      var clkC = CLK_CALC[i % CLK_CALC.length];
      prompt = name + '：' + clkC.q; answer = clkC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CLK_OPTS = [
        { q: '钟面上一共有多少个大格？', a: '12个', o: ['10个', '11个', '12个', '24个'] },
        { q: '分针走1个大格是多少分钟？', a: '5分钟', o: ['1分钟', '5分钟', '15分钟', '60分钟'] },
        { q: '时针从3走到7，经过了几小时？', a: '4小时', o: ['3小时', '4小时', '5小时', '7小时'] },
        { q: '时针指向8、分针指向12，这时是几时？', a: '8时', o: ['7时', '8时', '9时', '12时'] }
      ];
      var clkO = CLK_OPTS[i % CLK_OPTS.length];
      prompt = name + '：' + clkO.q; answer = clkO.a;
      chOpts = Rng.shuffle(rng, clkO.o); data.choiceForm = true;
    } else {
      var CLK_FILL = [
        { q: '看钟面：时针指向9、分针指向12，现在是几时？', a: '9时' },
        { q: '看钟面：时针走过3、分针指向6，现在是几时几分？', a: '3时30分' },
        { q: '分针从12走到4，走了几个大格？是多少分钟？', a: '4个大格，20分钟' },
        { q: '钟面上一共有多少个大格？每个大格分成几个小格？', a: '12个大格，每个大格5个小格' }
      ];
      var clkF = CLK_FILL[i % CLK_FILL.length];
      prompt = name + '：' + clkF.q; answer = clkF.a;
    }
  } else if (type === 'time-convert') {
    // P25-09：时、分、秒单位换算 native maker（g2-down-u01-k002）
    steps = 1;
    if (qt === 'calc') {
      var TC_CALC = [
        { q: '3时等于多少分？列式：3 × 60 = ？', a: 180 },
        { q: '2分等于多少秒？列式：2 × 60 = ？', a: 120 },
        { q: '1时20分等于多少分？列式：60 + 20 = ？', a: 80 },
        { q: '180秒等于多少分？列式：180 ÷ 60 = ？', a: 3 }
      ];
      var tcC = TC_CALC[i % TC_CALC.length];
      prompt = name + '：' + tcC.q; answer = tcC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var TC_OPTS = [
        { q: '3时 = （ ）分', a: '180分', o: ['30分', '60分', '180分', '300分'] },
        { q: '2分 = （ ）秒', a: '120秒', o: ['12秒', '60秒', '120秒', '200秒'] },
        { q: '180秒 = （ ）分', a: '3分', o: ['2分', '3分', '4分', '18分'] },
        { q: '1时15分 = （ ）分', a: '75分', o: ['60分', '75分', '115分', '150分'] }
      ];
      var tcO = TC_OPTS[i % TC_OPTS.length];
      prompt = name + '：' + tcO.q; answer = tcO.a;
      chOpts = Rng.shuffle(rng, tcO.o); data.choiceForm = true;
    } else {
      var TC_FILL = [
        { q: '4时 = （ ）分', a: '240分' },
        { q: '5分 = （ ）秒', a: '300秒' },
        { q: '120秒 = （ ）分', a: '2分' },
        { q: '1分40秒 = （ ）秒', a: '100秒' }
      ];
      var tcF = TC_FILL[i % TC_FILL.length];
      prompt = name + '：' + tcF.q; answer = tcF.a;
    }
  } else if (type === 'elapsed-time') {
    // P25-09：计算简单经过时间 native maker（g2-down-u01-k003）
    steps = 2;
    if (qt === 'calc') {
      var ET_CALC = [
        { q: '小明7:30从家出发，7:45到达学校，经过了多少分钟？列式：45 − 30 = ？', a: 15 },
        { q: '一列火车8:40从甲站开出，9:10到达乙站，经过了多少分钟？列式：(60 − 40) + 10 = ？', a: 30 },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了多少小时？列式：4 − 2 = ？', a: 2 }
      ];
      var etC = ET_CALC[i % ET_CALC.length];
      prompt = name + '：' + etC.q; answer = etC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var ET_OPTS = [
        { q: '小明7:30从家出发，7:45到达学校，他路上用了多长时间？', a: '15分钟', o: ['10分钟', '15分钟', '20分钟', '25分钟'] },
        { q: '一节课8:50开始，9:30结束，这节课有多少分钟？', a: '40分钟', o: ['30分钟', '40分钟', '50分钟', '60分钟'] },
        { q: '一场电影下午2:00开始，下午4:00结束，放映了几小时？', a: '2小时', o: ['1小时', '2小时', '3小时', '4小时'] },
        { q: '小红晚上8:00睡觉，第二天早上6:00起床，她睡了几小时？', a: '10小时', o: ['8小时', '9小时', '10小时', '12小时'] }
      ];
      var etO = ET_OPTS[i % ET_OPTS.length];
      prompt = name + '：' + etO.q; answer = etO.a;
      chOpts = Rng.shuffle(rng, etO.o); data.choiceForm = true;
    } else {
      var ET_FILL = [
        { q: '小明7:30从家出发，7:45到达学校，路上经过了多少分钟？', a: '15分钟' },
        { q: '一节课8:50开始，9:30结束，这节课上了多少分钟？', a: '40分钟' },
        { q: '妈妈上午8:00上班，在公司工作8小时，妈妈下午几时下班？', a: '下午4:00（16:00）' },
        { q: '一列火车9:10进站，9:55开出，在车站停靠了多少分钟？', a: '45分钟' }
      ];
      var etF = ET_FILL[i % ET_FILL.length];
      prompt = name + '：' + etF.q; answer = etF.a;
    }
  } else if (type === 'calendar') {
    // P25-09：年、月、日基本知识 native maker（g3-down-u06-k001）
    steps = 2;
    if (qt === 'calc') {
      var CAL_CALC = [
        { q: '7月和8月都是大月，两个月一共有多少天？列式：31 + 31 = ？', a: 62 },
        { q: '平年的2月有28天，4月有30天，4月比2月多多少天？列式：30 − 28 = ？', a: 2 },
        { q: '一年有4个小月，每个小月都是30天，4个小月一共有多少天？列式：4 × 30 = ？', a: 120 }
      ];
      var calC = CAL_CALC[i % CAL_CALC.length];
      prompt = name + '：' + calC.q; answer = calC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var CAL_OPTS = [
        { q: '下面的月份中，哪个月是有31天的大月？', a: '7月', o: ['4月', '6月', '7月', '11月'] },
        { q: '一年一共有多少个月？', a: '12个月', o: ['10个月', '11个月', '12个月', '24个月'] },
        { q: '11月一共有多少天？', a: '30天', o: ['28天', '29天', '30天', '31天'] },
        { q: '平年全年一共有多少天？', a: '365天', o: ['364天', '365天', '366天', '400天'] }
      ];
      var calO = CAL_OPTS[i % CAL_OPTS.length];
      prompt = name + '：' + calO.q; answer = calO.a;
      chOpts = Rng.shuffle(rng, calO.o); data.choiceForm = true;
    } else {
      var CAL_FILL = [
        { q: '一年有多少个月？哪几个月是有31天的大月？', a: '12个月；1月、3月、5月、7月、8月、10月、12月是大月' },
        { q: '4月有多少天？它是大月还是小月？', a: '30天，是小月' },
        { q: '6月1日的前一天是几月几日？', a: '5月31日' },
        { q: '7月和8月是连续的两个大月，两个月一共有多少天？', a: '62天' }
      ];
      var calF = CAL_FILL[i % CAL_FILL.length];
      prompt = name + '：' + calF.q; answer = calF.a;
    }
  } else if (type === 'leap-year') {
    // P25-09：平年与闰年判断 native maker（g3-down-u06-k002）
    steps = 2;
    if (qt === 'calc') {
      var LY_CALC = [
        { q: '闰年全年有多少天？（7个大月、4个小月，2月29天）列式：7 × 31 + 4 × 30 + 29 = ？', a: 366 },
        { q: '平年全年有多少天？（7个大月、4个小月，2月28天）列式：7 × 31 + 4 × 30 + 28 = ？', a: 365 },
        { q: '闰年的2月比平年的2月多多少天？列式：29 − 28 = ？', a: 1 }
      ];
      var lyC = LY_CALC[i % LY_CALC.length];
      prompt = name + '：' + lyC.q; answer = lyC.a; data.calcForm = true;
    } else if (qt === 'choice') {
      var LY_OPTS = [
        { q: '下面哪一年是闰年？', a: '2024年', o: ['2021年', '2022年', '2023年', '2024年'] },
        { q: '下面哪一年是平年？', a: '2023年', o: ['2016年', '2020年', '2023年', '2024年'] },
        { q: '下面哪个整百年份是闰年？', a: '2000年', o: ['1900年', '2000年', '2100年', '2200年'] },
        { q: '闰年的2月有多少天？', a: '29天', o: ['28天', '29天', '30天', '31天'] }
      ];
      var lyO = LY_OPTS[i % LY_OPTS.length];
      prompt = name + '：' + lyO.q; answer = lyO.a;
      chOpts = Rng.shuffle(rng, lyO.o); data.choiceForm = true;
    } else {
      var LY_FILL = [
        { q: '2024年是平年还是闰年？写出判断理由。', a: '闰年；2024 ÷ 4 = 506，没有余数，公历年份是4的倍数的一般是闰年' },
        { q: '1900年是平年还是闰年？为什么？', a: '平年；整百年份必须是400的倍数才是闰年，1900不是400的倍数' },
        { q: '闰年全年有多少天？比平年多几天？', a: '366天，比平年多1天' },
        { q: '小明是2016年2月29日出生的，他下一次能在2月29日过生日是哪一年？', a: '2020年' }
      ];
      var lyF = LY_FILL[i % LY_FILL.length];
      prompt = name + '：' + lyF.q; answer = lyF.a;
    }
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

  if (graphic) data.graphic = graphic;
  data.steps = steps;
  if (data.choiceForm) {
    data.options = chOpts;
    data.correctIndex = chOpts.indexOf(String(answer));
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: typeof answer === 'boolean' ? { value: answer, acceptable: [] } : { value: String(answer), acceptable: [] },
    answerMode: data.choiceForm ? 'choice' : (data.judgeForm ? 'judge' : 'input'),
    data: data
  };
}

// P25-06 H2：原 STATS_KPS（math-gN-mN-* 模块制 历史 ID）已随旧体系 KP 全部剔除，
// 对 canonical 375 永不命中；绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function createStatsGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:stats';

  return {
    id: id,
    subject: 'math',
    // P25-09：补 fill/choice——数据收集/时间类 native KP 的 ALLOW 含 fill/choice；
    // fill 由 finisher 补空位，choice 读图题在源码内自建选项（bar-chart/chart-read 分支）。
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
        questions.push(makeStatsQuestion(plan, context, i, kp));
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

function buildAll() {
  return [createStatsGenerator()];
}

module.exports = {
  createStatsGenerator: createStatsGenerator,
  buildAll: buildAll
};
