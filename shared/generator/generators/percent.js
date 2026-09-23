/**
 * shared/generator/generators/percent.js — 百分数语义生成器（P24-02 补充）
 *
 * 为六上「百分数」单元 6 个 canonical KP 提供语义正确的 calc/fill/apply 题目，
 * 取代此前被误绑到 generator:shape-recognition 后产出的图形兜底题
 * （「图中共有几个图形？」与百分数 KP 语义无关）。
 *
 * 挂载点：
 *   - generators/index.js  require + buildAll 合并
 *   - generator-registry.js CORE_RECORDS 1 条 native 绑定
 *   - selector 无需改动：KP native binding 直接胜出
 *
 * P25-06：6 个子类型（意义/互化/折扣/利率/达标线/增减百分之几）不再按 KP ID 尾缀
 * 切片猜测，统一消费 selector 注入的 plan.semanticParams.subTopic
 * （SemanticParameters 按语义族 + KBL name/concept 机械派生，证据可溯源）；
 * subTopic 缺失或无对应 maker 时返回 []（fail-closed，不静默兜底）。
 *
 * 题型：calc（直接列式）/ fill（填空）/ apply（应用情境），答案均为数值（answerMode=input）。
 * 不声明 choice：选择题由 generation-contract 指定的 generator:selection-choice 承载。
 *
 * 输出契约：SemanticQuestion（字段与 arithmetic.js 输出一致）。
 */
'use strict';

var Rng = require('../core/rng.js');
var SemanticParameters = require('../core/semantic-parameters.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
}

// 干净百分数集合（与常见基数相乘必得整数/有限小数）
var CLEAN_PERCENTS = [10, 20, 25, 40, 50, 60, 75, 80, 90];
// 折扣（折数 → 百分率）
var DISCOUNTS = [
  { label: '八折', rate: 80 }, { label: '七五折', rate: 75 },
  { label: '九折', rate: 90 }, { label: '八五折', rate: 85 },
  { label: '六五折', rate: 65 }, { label: '六折', rate: 60 }
];
// 常见分数 → 百分数
var FRACTION_PERCENT = [
  { num: 1, den: 2, percent: 50 }, { num: 1, den: 4, percent: 25 },
  { num: 3, den: 4, percent: 75 }, { num: 1, den: 5, percent: 20 },
  { num: 2, den: 5, percent: 40 }, { num: 3, den: 5, percent: 60 },
  { num: 4, den: 5, percent: 80 }, { num: 1, den: 10, percent: 10 },
  { num: 1, den: 20, percent: 5 }, { num: 1, den: 50, percent: 2 }
];

function buildBase(plan, context, i, extra) {
  var constraints = plan.constraints || {};
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    difficultyParams: {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    },
    numberRange: constraints.numberRange || { min: 1, max: 100 },
    spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
    context: plan.contextType != null ? plan.contextType : 'standard',
    seed: seedFor(plan, context, i),
    prompt: '',
    answer: null,
    answerMode: 'input',
    hint: null,
    data: Object.assign({ mode: 'percent-calc' }, extra || {})
  };
}

function finish(q, prompt, answer, explanation) {
  q.prompt = prompt;
  q.answer = { value: String(answer), acceptable: [], explanation: explanation || (prompt.replace(/[？?]\s*$/, '') + ' = ' + answer) };
  return q;
}

var qt = function (plan) { return plan.questionTypeId; };

/* ---------- k001 百分数的意义：求一个数的百分之几 ---------- */
function makePercentOf(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.pick(rng, [100, 200, 300, 400, 500, 800]);
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var ans = Math.round(base * p / 100 * 100) / 100;
  var prompt;
  if (qt(plan) === 'apply') {
    prompt = '图书室有 ' + base + ' 本图书，其中 ' + p + '% 是故事书。故事书有多少本？';
  } else if (qt(plan) === 'fill') {
    prompt = base + ' 的 ' + p + '% 等于 ____。';
  } else {
    prompt = '列式计算：' + base + ' × ' + p + '% = ？';
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-of', base: base, percent: p }),
    prompt, ans, base + ' × ' + p + '% = ' + ans);
}

/* ---------- k002 百分数与分数、小数的互化 ---------- */
function makeConversion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var variant = i % 3;
  var isCalc = qt(plan) === 'calc';
  var q = buildBase(plan, context, i, { subType: 'percent-conversion', variant: variant });
  if (variant === 0) {
    var d = (Rng.randInt(rng, 1, 9) * 10 + Rng.randInt(rng, 1, 9)) / 100;
    var dpct = Math.round(d * 100);
    var stem0 = isCalc
      ? '把小数 ' + d.toFixed(2) + ' 化成百分数，列式：' + d.toFixed(2) + ' =（ ）%（只填数字）。'
      : '把小数 ' + d.toFixed(2) + ' 化成百分数是（ ）%（只填数字）。';
    return finish(q, stem0, dpct, d.toFixed(2) + ' = ' + dpct + '%');
  }
  if (variant === 1) {
    var f = Rng.pick(rng, FRACTION_PERCENT);
    var stem = qt(plan) === 'fill'
      ? '把分数 ' + f.num + '/' + f.den + ' 化成百分数：____%（只填数字）'
      : (isCalc
        ? '把分数 ' + f.num + '/' + f.den + ' 化成百分数，列式：' + f.num + '/' + f.den + ' =（ ）%（只填数字）'
        : f.num + '/' + f.den + ' 化成百分数是多少？（只填数字）');
    return finish(q, stem, f.percent, f.num + '/' + f.den + ' = ' + f.percent + '%');
  }
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var dec = (p / 100).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  if (isCalc) {
    // P25-07：calc 列式形态「80 ÷ 100 =（ ）」
    return finish(q, '把 ' + p + '% 化成小数，列式：' + p + ' ÷ 100 =（ ）。', dec, p + '% = ' + dec);
  }
  return finish(q, '把 ' + p + '% 化成小数是（ ）。', dec, p + '% = ' + dec);
}

/* ---------- k003 百分数的应用——折扣 ---------- */
function makeDiscount(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var price = Rng.pick(rng, [100, 200, 300, 400, 500, 600, 800]);
  var d = Rng.pick(rng, DISCOUNTS);
  var cur = Math.round(price * d.rate) / 100;
  var askSaved = (i % 2 === 1);
  var prompt;
  // P25-07：calc 列式计算形态「price × rate% = ？」
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'current' }),
      '列式计算：一件商品原价 ' + price + ' 元，现在' + d.label + '出售，现价是多少元？列式：' + price + ' × ' + d.rate + '% = ？',
      cur, '现价 ' + price + ' × ' + d.rate + '% = ' + cur + ' 元');
  }
  if (askSaved) {
    prompt = '一件商品原价 ' + price + ' 元，现在' + d.label + '出售，买这件商品可以便宜多少元？';
    return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'saved' }),
      prompt, price - cur, '便宜 ' + price + ' − ' + cur + ' = ' + (price - cur) + ' 元');
  }
  prompt = '一件商品原价 ' + price + ' 元，现在' + d.label + '出售，现价是多少元？';
  return finish(buildBase(plan, context, i, { subType: 'percent-discount', price: price, rate: d.rate, ask: 'current' }),
    prompt, cur, '现价 ' + price + ' × ' + d.rate + '% = ' + cur + ' 元');
}

/* ---------- k004 百分数的应用——利率 ---------- */
function makeInterest(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var principal = Rng.pick(rng, [1000, 2000, 3000, 5000, 8000]);
  var rate = Rng.pick(rng, [2, 3, 4, 5]);
  var years = Rng.randInt(rng, 1, 3);
  var interest = principal * rate * years / 100;
  var askTotal = (i % 2 === 1);
  // P25-07：calc 列式计算形态「principal × rate% × years = ？」（利息问法）
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'interest' }),
      '列式计算：' + principal + ' 元存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。列式求到期利息：' + principal + ' × ' + rate + '% × ' + years + ' = ？',
      interest, '利息 ' + principal + ' × ' + rate + '% × ' + years + ' = ' + interest + ' 元');
  }
  if (askTotal) {
    return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'total' }),
      '小明把 ' + principal + ' 元压岁钱存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。到期时一共可以取回多少元？',
      principal + interest, '本息合计 ' + principal + ' + ' + interest + ' = ' + (principal + interest) + ' 元');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-interest', principal: principal, rate: rate, years: years, ask: 'interest' }),
    '小明把 ' + principal + ' 元存入银行，年利率 ' + rate + '%，存期 ' + years + ' 年。到期可得利息多少元？',
    interest, '利息 ' + principal + ' × ' + rate + '% × ' + years + ' = ' + interest + ' 元');
}

/* ---------- k005 确定达标线：达标率 / 至少达标人数 ---------- */
function makeRateLine(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'percent-target-rate' });
  // P25-07：calc 列式计算形态「total × rate% = ？」（求达标人数问法）
  if (qt(plan) === 'calc') {
    var ctotal = Rng.pick(rng, [50, 100, 200, 400, 500]);
    var crate = Rng.pick(rng, [80, 90, 95, 75, 60]);
    var cneed = Math.round(ctotal * crate / 100);
    return finish(q,
      '列式计算：学校规定体育达标率不低于 ' + crate + '%，全年级共 ' + ctotal + ' 人。列式求至少达标人数：' + ctotal + ' × ' + crate + '% = ？',
      cneed, ctotal + ' × ' + crate + '% = ' + cneed + ' 人');
  }
  if (i % 2 === 1) {
    // 已知达标率与总人数，求至少达标人数
    var total = Rng.pick(rng, [50, 100, 200, 400, 500]);
    var ratePct = Rng.pick(rng, [80, 90, 95, 75, 60]);
    var need = Math.round(total * ratePct / 100);
    return finish(q,
      '学校规定体育达标率不低于 ' + ratePct + '%。全年级共 ' + total + ' 人，至少要有多少人达标？',
      need, total + ' × ' + ratePct + '% = ' + need + ' 人');
  }
  // 已知总人数与达标人数，求达标率
  var total2 = Rng.pick(rng, [40, 50, 100, 200, 250]);
  var pct = Rng.pick(rng, CLEAN_PERCENTS.concat([95, 85]));
  var reached = Math.round(total2 * pct / 100);
  return finish(q,
    '六年级共有 ' + total2 + ' 人，体育达标 ' + reached + ' 人。达标率是（ ）%（只填数字）。',
    Math.round(reached / total2 * 100), reached + ' ÷ ' + total2 + ' ×100% = ' + Math.round(reached / total2 * 100) + '%');
}

/* ---------- k006 解决问题：求比一个数多/少百分之几 ---------- */
function makePercentChange(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.pick(rng, [100, 200, 250, 400, 500]);
  var p = Rng.pick(rng, CLEAN_PERCENTS);
  var increase = (i % 2 === 0);
  var ans = increase ? base + base * p / 100 : base - base * p / 100;
  var prompt;
  // P25-07：calc 列式计算形态「base ± base × p% = ？」
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-change', base: base, percent: p, increase: increase }),
      '列式计算：' + base + (increase ? ' + ' : ' − ') + base + ' × ' + p + '% = ？',
      ans, base + ' × (1' + (increase ? '+' : '−') + p + '%) = ' + ans);
  }
  if (increase) {
    prompt = '果园去年收苹果 ' + base + ' 千克，今年比去年增产 ' + p + '%，今年收苹果多少千克？';
  } else {
    prompt = '一件衣服原价 ' + base + ' 元，店庆期间降价 ' + p + '% 出售，现价多少元？';
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-change', base: base, percent: p, increase: increase }),
    prompt, ans,
    base + ' × (1' + (increase ? '+' : '−') + p + '%) = ' + ans);
}

/* ---------- P25-09 k003 百分数的应用——税率 ---------- */
function makeTax(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var income = Rng.pick(rng, [3000, 5000, 8000, 10000, 20000, 50000]);
  var rate = Rng.pick(rng, [3, 5, 6, 10]);
  var tax = Math.round(income * rate) / 100;
  var goods = Rng.pick(rng, ['商店某月的营业额', '一家餐馆某月的营业额', '某公司某月的营业额']);
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
      '列式计算：' + goods + '是 ' + income + ' 元，按 ' + rate + '% 的税率缴纳税款，应缴纳税款多少元？列式：' + income + ' × ' + rate + '% = ？',
      tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
      income + ' × ' + rate + '% = ____（元）',
      tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-tax', income: income, rate: rate }),
    goods + '是 ' + income + ' 元，按规定要按 ' + rate + '% 的税率缴纳税款。这家应缴纳税款多少元？',
    tax, '应纳税额 ' + income + ' × ' + rate + '% = ' + tax + ' 元');
}

/* ---------- P25-09 k002 百分数的应用——成数（几成 = 十分之几 = 百分之几十） ---------- */
var CHENGSHU = [
  { label: '一成', num: 1, rate: 10 }, { label: '二成', num: 2, rate: 20 },
  { label: '三成', num: 3, rate: 30 }, { label: '三成五', num: 3.5, rate: 35 },
  { label: '四成', num: 4, rate: 40 }, { label: '七成五', num: 7.5, rate: 75 }
];
function makeChengshu(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = Rng.pick(rng, CHENGSHU);
  // 变体 0：成数 → 百分数；变体 1：成数应用（求增产量）
  if (i % 2 === 0) {
    var q = buildBase(plan, context, i, { subType: 'percent-chengshu', chengshu: c.label, ask: 'convert' });
    var stemC = qt(plan) === 'calc'
      ? '列式：把' + c.label + '改写成百分数，' + c.num + ' ÷ 10 = （ ）%（只填数字）。'
      : (qt(plan) === 'fill'
        ? c.label + ' = ' + c.num + ' ÷ 10 = ____%（只填数字）'
        : '农业收成常用「成数」表示：' + c.label + ' = ' + c.num + ' ÷ 10，' + c.label + '改写成百分数是多少？（只填数字）');
    return finish(q, stemC, c.rate, c.label + ' = ' + c.num + '/10 = ' + c.rate + '%');
  }
  var base = Rng.pick(rng, [200, 300, 400, 500, 600, 800]);
  var gain = Math.round(base * c.rate) / 100;
  var crop = Rng.pick(rng, ['小麦', '玉米', '水稻', '苹果']);
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
      '列式计算：去年产' + crop + ' ' + base + ' 吨，今年比去年增产' + c.label + '（' + c.rate + '%），今年增产多少吨？列式：' + base + ' × ' + c.rate + '% = ？',
      gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
      '去年产' + crop + ' ' + base + ' 吨，今年增产' + c.label + '（' + c.rate + '%）：' + base + ' × ' + c.rate + '% = ____（吨）',
      gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-chengshu', base: base, rate: c.rate, ask: 'gain' }),
    '李叔叔家去年产' + crop + ' ' + base + ' 吨，今年风调雨顺，比去年增产' + c.label + '（也就是 ' + c.rate + '%）。今年比去年增产多少吨？',
    gain, '增产量 ' + base + ' × ' + c.rate + '% = ' + gain + ' 吨');
}

/* ---------- P25-09 k005 生活与百分数：促销/普及率等综合生活情境 ---------- */
function makeLife(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var scenario;
  if (i % 2 === 0) {
    // 普及率/合格率：总量 × 百分率
    var total = Rng.pick(rng, [300, 500, 800, 1000, 2000]);
    var pct = Rng.pick(rng, [80, 85, 90, 95, 96]);
    var part = Math.round(total * pct) / 100;
    var things = Rng.pick(rng, [
      ['小区居民', '参与垃圾分类的家庭'],
      ['学校学生', '每天坚持阅读的学生'],
      ['全村农户', '参加了新农合的农户']
    ]);
    scenario = {
      total: total, pct: pct, ans: part,
      story: things[0] + '共 ' + total + ' 户（人），其中 ' + pct + '% 是' + things[1] + '。' + things[1] + '有多少户（人）？',
      expr: total + ' × ' + pct + '%'
    };
  } else {
    // 会员促销：原价 × 会员折扣率
    var price = Rng.pick(rng, [150, 200, 300, 400, 500, 600]);
    var rate2 = Rng.pick(rng, [80, 85, 88, 90, 95]);
    var cur = Math.round(price * rate2) / 100;
    var goods2 = Rng.pick(rng, ['一套科普书', '一个书包', '一双运动鞋', '一件外套']);
    scenario = {
      total: price, pct: rate2, ans: cur,
      story: '书店（商场）店庆，' + goods2 + '原价 ' + price + ' 元，会员可按原价的 ' + rate2 + '% 购买。会员买' + goods2 + '要花多少元？',
      expr: price + ' × ' + rate2 + '%'
    };
  }
  if (qt(plan) === 'calc') {
    return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
      '列式计算：' + scenario.story + '列式：' + scenario.expr + ' = ？',
      scenario.ans, scenario.expr + ' = ' + scenario.ans);
  }
  if (qt(plan) === 'fill') {
    return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
      scenario.story + '（列式：' + scenario.expr + ' = ____）',
      scenario.ans, scenario.expr + ' = ' + scenario.ans);
  }
  return finish(buildBase(plan, context, i, { subType: 'percent-life', base: scenario.total, percent: scenario.pct }),
    scenario.story,
    scenario.ans, scenario.expr + ' = ' + scenario.ans);
}

// 子类型按 GenerationParameters.subTopic 分派（键与 semantic-parameters 规则一一对应）。
// 完整 KP→生成器绑定的唯一真值源是 generator-registry.js 的 knowledgePoints。
var SUBTOPIC_MAKERS = {
  'percent-of': makePercentOf,
  'percent-conversion': makeConversion,
  'percent-discount': makeDiscount,
  'percent-interest': makeInterest,
  'percent-target-rate': makeRateLine,
  'percent-change': makePercentChange,
  'percent-tax': makeTax,
  'percent-chengshu': makeChengshu,
  'percent-life': makeLife
};

/** 取本 plan 的语义参数：优先 selector 注入；缺省时即时派生（直连调用方/单测兜底，同一 SSOT） */
function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
}

function createPercentGenerator(spec) {
  spec = spec || {};
  return {
    id: 'generator:percent-calc',
    subject: 'math',
    capabilities: ['calc', 'fill', 'apply'],
    questionTypes: ['calc', 'fill', 'apply'],
    // 绑定真值源在 generator-registry.js CORE_RECORDS；实例不重复携带 KP 列表。
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'apply'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      var params = paramsOf(plan);
      var maker = params ? SUBTOPIC_MAKERS[params.subTopic] : null;
      // fail-closed：语义参数缺失或子类型无 maker → 不产出，交 retry/上层判失败，禁止猜测兜底
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return SemanticEvidence.attachAll(VariationApply.applyToAll(out, plan), plan);
    }
  };
}

function buildAll() {
  return [createPercentGenerator()];
}

module.exports = {
  createPercentGenerator: createPercentGenerator,
  buildAll: buildAll
};
