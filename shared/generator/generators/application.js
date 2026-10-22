'use strict';

/**
 * shared/generator/generators/application.js — Application / Word Problem Generator
 *
 * 应用题 Generator：基于 KP 语义约束生成应用题
 * - 已知条件 / 问题 / 数量关系 / 运算 / 答案 全链路一致
 * - 支持多步、逆向、比较、行程、工程等典型数量关系
 */

var Rng = require('../core/rng.js');
var Arith = require('../core/arithmetic-core.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

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

// 典型应用题模板。choiceZh 为 choice/judge 专用精简题面（单行、措辞与 apply 的
// 「已知条件…\n问题：…」双行结构互异，避免核心骨架子串包含导致跨题型 sim=1.0）。
var PROBLEM_TEMPLATES = {
  // 总量 = 分量 + 分量
  'total-from-parts': {
    zh: '已知条件：{a} 和 {b}。\n问题：一共多少？',
    choiceZh: '{a} 与 {b} 相加，和是多少？',
    ops: ['add'],
    relation: 'total = part1 + part2'
  },
  // 总量 - 分量 = 分量
  'part-from-total': {
    zh: '已知条件：一共 {total}，其中 {part1}。\n问题：剩下多少？',
    choiceZh: '从 {total} 里去掉 {part1}，还剩多少？',
    ops: ['sub'],
    relation: 'part2 = total - part1'
  },
  // 比较：多几个 / 少几个
  'compare-more': {
    zh: '已知条件：A 有 {a}，B 比 A 多 {diff}。\n问题：B 有多少？',
    choiceZh: '{a} 增加 {diff} 后是多少？',
    ops: ['add'],
    relation: 'B = A + diff'
  },
  'compare-less': {
    zh: '已知条件：A 有 {a}，B 比 A 少 {diff}。\n问题：B 有多少？',
    choiceZh: '{a} 减少 {diff} 后是多少？',
    ops: ['sub'],
    relation: 'B = A - diff'
  },
  // 倍数关系
  'multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 倍。\n问题：B 有多少？',
    choiceZh: '{a} 的 {n} 倍是多少？',
    ops: ['mult'],
    relation: 'B = A × n'
  },
  // 简单乘法总量（低难度）：每份 × 份数 = 总量
  'equal-groups': {
    zh: '已知条件：每份有 {per} 个，共有 {groups} 份。\n问题：一共有多少个？',
    choiceZh: '每份 {per} 个，{groups} 份一共多少个？',
    ops: ['mult'],
    relation: 'total = per × groups'
  },
  // 平均分（低难度除法）：总量 ÷ 份数 = 每份
  'share-equally': {
    zh: '已知条件：一共 {total} 个，平均分给 {groups} 人。\n问题：每人分得多少个？',
    choiceZh: '{total} 个平均分给 {groups} 人，每人几个？',
    ops: ['div'],
    relation: 'per = total ÷ groups'
  },
  'divide-multiple': {
    zh: '已知条件：A 有 {a}，B 是 A 的 {n} 分之 1。\n问题：B 有多少？',
    choiceZh: '{a} 的 {n} 分之一是多少？',
    ops: ['div'],
    relation: 'B = A ÷ n'
  },
  // 分配/分组
  'grouping': {
    zh: '已知条件：一共 {total}，每组 {per}。\n问题：能分几组？',
    choiceZh: '{total} 个按每组 {per} 个分，能分几组？',
    ops: ['div'],
    relation: 'groups = total ÷ per'
  },
  // 行程：速度 × 时间 = 路程
  'distance': {
    zh: '已知条件：速度 {speed}，时间 {time}。\n问题：路程多少？',
    choiceZh: '速度 {speed}，时间 {time}，路程是多少？',
    ops: ['mult'],
    relation: 'distance = speed × time'
  },
  // 工程：效率 × 时间 = 总量
  'work': {
    zh: '已知条件：效率 {rate}，时间 {time}。\n问题：完成多少？',
    choiceZh: '效率 {rate}，时间 {time}，总量是多少？',
    ops: ['mult'],
    relation: 'work = rate × time'
  }
};

var TEMPLATE_KEYS = Object.keys(PROBLEM_TEMPLATES);

// P34-13：calc 题型的运算意义讲解（按模板主运算映射，教学口径与 arithmetic 族一致）。
var OP_MEANING = {
  add: '这是把两部分合起来求总数，用加法',
  sub: '这是从总数里去掉一部分求剩余（或比较多少），用减法',
  mult: '这是求几个相同加数的和（或求一个数的几倍），用乘法',
  div: '这是把总数平均分求每份（或求能分几份），用除法'
};

// FINAL-31c：KP 运算约束——模板运算必须 ⊆ KP 语义允许运算，杜绝「加法 KP 产出减法应用题」。
// 运算真源：plan.semanticParams.operations（SemanticParameters.attachToPlan 注入的 KBL
// semantic.operations，token 为 addition/subtraction/multiplication/division）。
// operations 为空（KP 无显式运算约束）时不过滤，保持原行为。
var OP_ALIAS = {
  addition: 'add', subtraction: 'sub', multiplication: 'mult', division: 'div',
  add: 'add', sub: 'sub', mult: 'mult', div: 'div'
};

function kpAllowedOps(plan) {
  var ops = plan && plan.semanticParams && plan.semanticParams.operations;
  var out = [];
  if (Array.isArray(ops)) {
    ops.forEach(function (o) {
      var t = OP_ALIAS[o];
      if (t && out.indexOf(t) === -1) out.push(t);
    });
  }
  // FINAL-137：KP 显式声明的运算最权威（如 G2「2～6的乘法口诀」声明 multiplication，
  // 低难度档位仍应出乘法应用题），维持 FINAL-31c 语义不过滤。
  // 仅当 KP 未声明可映射运算（综合/解决问题类，operations 为空或仅 mixed·sequential）时，
  // 消费 Strategy 层下发的结构约束 allowMultDiv——false 则模板池只留加减。
  // 年级边界由 Strategy 层裁决（G1 恒 false），本层不做任何年级判断。
  if (!out.length) {
    var forbidMultDiv = plan && plan.constraints && plan.constraints.allowMultDiv === false;
    return forbidMultDiv ? ['add', 'sub'] : null;
  }
  return out;
}

function getApplicationMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
}
function riC(rng, lo, hi, nr) {
  var min = Math.max(lo, nr.min);
  var max = Math.min(hi, nr.max);
  if (min > max) { min = lo; max = hi; }
  return randInt(rng, min, max);
}

function pickTemplate(rng, nr, allowedOps) {
  // 低难度用简单模板，高难度用复杂模板（以 numberRange.max 作为难度档位信号）
  var simpleTemplates = ['total-from-parts', 'part-from-total', 'compare-more', 'compare-less', 'equal-groups', 'share-equally'];
  var complexTemplates = ['multiple', 'divide-multiple', 'grouping', 'distance', 'work'];
  var pool = nr.max >= 50 ? TEMPLATE_KEYS : simpleTemplates;
  // FINAL-31c：KP 运算约束过滤（真源 semanticParams.operations；无约束不过滤）
  if (allowedOps) {
    pool = pool.filter(function (k) {
      return PROBLEM_TEMPLATES[k].ops.every(function (op) { return allowedOps.indexOf(op) !== -1; });
    });
    if (pool.length === 0) return null; // fail-closed：无合规模板不出题，不产出运算错位题
  }
  return Rng.pick(rng, pool);
}

function generateNumbers(rng, template, nr) {
  var maxVal = Math.min(100, Math.max(1, nr.max));
  var minVal = 1;
  
  switch (template) {
    case 'total-from-parts':
      var a = riC(rng, minVal, maxVal, nr);
      var b = riC(rng, minVal, maxVal, nr);
      return { a: a, b: b };
    case 'compare-more':
      var a = riC(rng, minVal + 2, maxVal, nr);
      var diff = riC(rng, minVal, maxVal - a, nr);
      return { a: a, diff: diff };
    case 'part-from-total':
      var total = riC(rng, minVal + 2, maxVal, nr);
      var part1 = riC(rng, minVal, total - 1, nr);
      return { total: total, part1: part1 };
    case 'compare-less':
      var a = riC(rng, minVal + 2, maxVal, nr);
      var diff = riC(rng, minVal, a - 1, nr);
      return { a: a, diff: diff };
    case 'multiple':
      var a = riC(rng, minVal, Math.floor(maxVal / 3), nr);
      var n = riC(rng, 2, 5, nr);
      return { a: a, n: n };
    case 'equal-groups':
      var gp = riC(rng, 2, 9, nr);
      var gs = riC(rng, 2, 6, nr);
      return { per: gp, groups: gs };
    case 'share-equally':
      var sg = riC(rng, 2, 6, nr);
      var sp = riC(rng, 2, 9, nr);
      return { total: sg * sp, groups: sg };
    case 'divide-multiple':
      var n = riC(rng, 2, 5, nr);
      var b = riC(rng, minVal, maxVal, nr);
      var a = b * n;
      return { a: a, n: n };
    case 'grouping':
      var per = riC(rng, 2, 10, nr);
      var groups = riC(rng, 2, 10, nr);
      var total = per * groups;
      return { total: total, per: per };
    case 'distance':
      var speed = riC(rng, 10, 100, nr);
      var time = riC(rng, 1, 5, nr);
      return { speed: speed, time: time };
    case 'work':
      var rate = riC(rng, 5, 50, nr);
      var time = riC(rng, 1, 10, nr);
      return { rate: rate, time: time };
  }
  return { a: riC(rng, 1, 20, nr), b: riC(rng, 1, 20, nr) };
}

function computeAnswer(template, nums) {
  switch (template) {
    case 'total-from-parts': return nums.a + nums.b;
    case 'part-from-total': return nums.total - nums.part1;
    case 'compare-more': return nums.a + nums.diff;
    case 'compare-less': return nums.a - nums.diff;
    case 'multiple': return nums.a * nums.n;
    case 'equal-groups': return nums.per * nums.groups;
    case 'share-equally': return nums.total / nums.groups;
    case 'divide-multiple': return nums.a / nums.n;
    case 'grouping': return nums.total / nums.per;
    case 'distance': return nums.speed * nums.time;
    case 'work': return nums.rate * nums.time;
  }
  return nums.a + (nums.b || 0);
}

// P30-GEN-06（P30-16）：由模板派生「操作数 + 运算符」序列，供 calc/fill 生成
// 与 apply 故事题面互异的算式骨架。
var OP_SYM = { add: '+', sub: '−', mult: '×', div: '÷' };
function buildExpression(template, nums) {
  switch (template) {
    case 'total-from-parts': return { operands: [nums.a, nums.b], ops: ['+'] };
    case 'part-from-total': return { operands: [nums.total, nums.part1], ops: ['−'] };
    case 'compare-more': return { operands: [nums.a, nums.diff], ops: ['+'] };
    case 'compare-less': return { operands: [nums.a, nums.diff], ops: ['−'] };
    case 'multiple': return { operands: [nums.a, nums.n], ops: ['×'] };
    case 'equal-groups': return { operands: [nums.per, nums.groups], ops: ['×'] };
    case 'share-equally': return { operands: [nums.total, nums.groups], ops: ['÷'] };
    case 'divide-multiple': return { operands: [nums.a, nums.n], ops: ['÷'] };
    case 'grouping': return { operands: [nums.total, nums.per], ops: ['÷'] };
    case 'distance': return { operands: [nums.speed, nums.time], ops: ['×'] };
    case 'work': return { operands: [nums.rate, nums.time], ops: ['×'] };
  }
  return { operands: [nums.a || 0, nums.b || 0], ops: ['+'] };
}
function formatExpr(expr) {
  return expr.operands[0] + ' ' + expr.ops[0] + ' ' + expr.operands[1];
}

// P38 断链修复闸门：意图驱动——仅当该 (KP, 题型) 行 intent.graphicRole 非空
// （plan.semanticParams.graphic 为 P30-10 权威行投影）时挂图；意图无图的行零改动。
function intentWantsGraphic(plan) {
  return !!(plan && plan.semanticParams && plan.semanticParams.graphic &&
    plan.semanticParams.graphic.role != null);
}

// P38 断链修复：应用题关系图——按模板×题型派生「题设材料」图形（role 统一
// quantity-correspondence）。铁律：图形只画已知量与未知标记（'？'），绝不把答案、
// judge 的 shown 值、fill 空位值（operands[0]）印成图形文字；线段/份数比例长度
// 为教科书式示意，不承载文字语义。
function buildRelationGraphic(template, nums, ans, qt, expr) {
  function seg(p) {
    return { type: 'diagram', subtype: 'segment', role: 'quantity-correspondence',
      params: Object.assign({ unit: '' }, p) };
  }
  function br(p) {
    return { type: 'diagram', subtype: 'brace', role: 'quantity-correspondence', params: p };
  }
  function grp(p) {
    return { type: 'diagram', subtype: 'groups', role: 'quantity-correspondence', params: p };
  }
  if (qt === 'fill') {
    // fill：空位 = expr.operands[0]（禁印），题面已印 expr.operands[1] 与等式结果 ans
    var op = expr.ops[0], b = expr.operands[1];
    if (op === '+') return seg({ total: ans, part: b, partLabel: String(b), otherLabel: '？', totalLabel: String(ans) });
    if (op === '−') return seg({ total: ans + b, part: ans, partLabel: String(ans), otherLabel: String(b), totalLabel: '？' });
    if (op === '×') return grp({ boxes: b, boxText: '？', topText: String(ans) });
    return grp({ boxes: b, boxText: String(ans), topText: '？' }); // ÷：份数=除数，每份=结果，总量=空位
  }
  // choice/judge/apply：答案不在题面，图形展示已知量 + '？'
  switch (template) {
    case 'total-from-parts': return br({ left: nums.a, right: nums.b });
    case 'part-from-total': return seg({ total: nums.total, part: nums.part1 });
    case 'compare-more': return seg({ total: nums.a + nums.diff, part: nums.a,
      partLabel: String(nums.a), otherLabel: String(nums.diff), totalLabel: '？' });
    case 'compare-less': return seg({ total: nums.a, part: nums.a - nums.diff,
      partLabel: '？', otherLabel: String(nums.diff), totalLabel: String(nums.a) });
    case 'multiple': return grp({ boxes: nums.n, boxText: nums.a, topText: '?' });
    case 'equal-groups': return grp({ boxes: nums.groups, boxText: nums.per, topText: '?' });
    case 'share-equally': return grp({ boxes: nums.groups, boxText: '？', topText: nums.total });
    case 'divide-multiple': return grp({ boxes: nums.n, boxText: '？', topText: nums.a });
    case 'grouping': return grp({ dots: nums.total, topText: '？组' });
    case 'distance': return grp({ boxes: nums.time, boxText: nums.speed, topText: '?' });
    case 'work': return grp({ boxes: nums.time, boxText: nums.rate, topText: '?' });
  }
  return null;
}

function formatTemplate(template, nums, tplText) {
  var tpl = PROBLEM_TEMPLATES[template];
  var str = tplText || tpl.zh;
  
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

// P28-GEO-NATIVE-04：g5-down-u03-k006「不规则物体的体积」geometry 原生 maker。
// 排水法：长方体玻璃缸底面积 × 水面上升高度 = 不规则物体体积。
// 图形用已注册的 geometry.cuboid 描述符画玻璃缸（对象参数、渲染器现成）。
function makeDisplacementVolumeQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var length = Rng.pick(rng, [10, 12]);
  var width = Rng.pick(rng, [6, 8]);
  var waterBefore = 5;
  var rise = Rng.pick(rng, [2, 3]);
  var waterAfter = waterBefore + rise;
  var volume = length * width * rise;
  var prompt = '看图解决问题：一个长方体玻璃缸（无盖），从里面量长 ' + length + ' 厘米、宽 ' +
    width + ' 厘米，缸里装有深 ' + waterBefore + ' 厘米的水。把一块不规则的石块完全浸没在水中' +
    '（水没有溢出），水面上升到 ' + waterAfter + ' 厘米。这块石块的体积是多少立方厘米？____';
  var graphic = {
    type: 'geometry',
    subtype: 'cuboid',
    role: 'quantity-correspondence',
    params: { length: length, height: waterAfter, width: width, labelSides: true, unit: 'cm', unitPx: 22 }
  };
  return {
    knowledgePointId: pkp(plan),
    questionType: 'geometry',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: {
      value: String(volume),
      acceptable: [volume + '立方厘米'],
      explanation: '石块体积 = 玻璃缸底面积 × 水面上升高度 = ' + length + ' × ' + width +
        ' × (' + waterAfter + '−' + waterBefore + ') = ' + volume + '（立方厘米）'
    },
    answerMode: 'input',
    data: {
      mode: 'geometry',
      steps: 2,
      kind: 'displacement-volume',
      tankLength: length,
      tankWidth: width,
      waterBefore: waterBefore,
      waterAfter: waterAfter,
      rise: rise,
      operation: 'mult',
      graphic: graphic
    }
  };
}

// P42-033：g5-down-u03-k006「不规则物体的体积」fill/choice/judge/apply 四题型
// 原生 maker。此前这些题型落入通用应用题模板（买东西/行程等无关情境），跨 KP
// 错挂家族根因。数字与 P28-GEO-NATIVE-04 排水法镜像（同组数、同 cuboid 描述符），
// 四题型措辞互异（防跨题型 sim≥0.85）；该 KP ALLOW 集合无 calc，null 分支防御性兜底。
function makeIrregularVolumeTyped(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var qt = plan.questionTypeId;
  var length = Rng.pick(rng, [10, 12]);
  var width = Rng.pick(rng, [6, 8]);
  var waterBefore = 5;
  var rise = Rng.pick(rng, [2, 3]);
  var waterAfter = waterBefore + rise;
  var volume = length * width * rise;
  var graphic = intentWantsGraphic(plan) ? {
    type: 'geometry',
    subtype: 'cuboid',
    role: 'quantity-correspondence',
    params: { length: length, height: waterAfter, width: width, labelSides: true, unit: 'cm', unitPx: 22 }
  } : null;
  var dims = '长 ' + length + ' 厘米、宽 ' + width + ' 厘米';
  var why = '石块体积 = 玻璃缸底面积 × 水面上升高度 = ' + length + ' × ' + width
    + ' × ' + rise + ' = ' + volume + '（立方厘米）';
  var base = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    answerMode: 'input',
    data: {
      mode: qt,
      steps: 2,
      kind: 'displacement-volume',
      tankLength: length,
      tankWidth: width,
      waterBefore: waterBefore,
      waterAfter: waterAfter,
      rise: rise,
      operation: 'mult',
      graphic: graphic
    }
  };
  if (qt === 'fill') {
    base.prompt = '做一个实验：长方体玻璃缸从里面量' + dims + '，水深 5 厘米。放入一块不规则石块后水面上升到 '
      + waterAfter + ' 厘米（水未溢出）。石块的体积是 ____ 立方厘米。';
    base.answer = { value: String(volume), acceptable: [], explanation: why + '。' };
    return base;
  }
  if (qt === 'apply') {
    base.prompt = '小科做了一个排水法实验：长方体玻璃缸从里面量' + dims + '，缸里水深 5 厘米。他把一块不规则'
      + '的石块完全浸没入水中（水没有溢出），水面上升到 ' + waterAfter + ' 厘米。这块石块的体积是多少立方厘米？';
    base.answer = { value: String(volume), acceptable: [volume + '立方厘米'], explanation: why + '。' };
    return base;
  }
  if (qt === 'choice') {
    // 值约定镜像既有 choice：3 个为正、互异且不等于答案的干扰项，answer.value ∈ options
    var distractors = [];
    var guard = 0;
    while (distractors.length < 3 && guard < 50) {
      guard++;
      var offset = randInt(rng, -30, 30);
      if (offset === 0) offset = 1;
      var dist = volume + offset;
      if (dist > 0 && distractors.indexOf(dist) === -1 && dist !== volume) distractors.push(dist);
    }
    var options = Rng.shuffle(rng, [volume].concat(distractors).slice(0, 4)).map(function (n) { return String(n); });
    base.prompt = '数学实验课上，长方体玻璃缸的内部' + dims + '，原有 5 厘米深的水。一块不规则石块完全浸入后，'
      + '水面升到 ' + waterAfter + ' 厘米。石块的体积是多少？';
    base.answer = { value: String(volume), acceptable: [], explanation: why + '，正确选项是「' + volume + '」。' };
    base.answerMode = 'choice';
    base.data.options = options;
    base.data.correctIndex = options.indexOf(String(volume));
    return base;
  }
  if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    var judgeDelta = randInt(rng, -30, 30);
    if (judgeDelta === 0) judgeDelta = 10;
    var shown = isTrue ? volume : volume + judgeDelta;
    base.prompt = '实验测量：长方体玻璃缸从里面量' + dims + '，水深 5 厘米。放入一块不规则石块完全浸没后'
      + '水面上升到 ' + waterAfter + ' 厘米（水未溢出）。计算得石块体积是 ' + shown + ' 立方厘米 —— 对还是错？';
    base.answer = { value: isTrue, acceptable: [], explanation: isTrue
      ? '底面积 × 水面上升高度 = ' + length + ' × ' + width + ' × ' + rise + ' = ' + volume + '，计算正确，说法对。'
      : '正确答案是 ' + volume + '，不是 ' + shown + '，说法错误。' };
    base.answerMode = 'judge';
    base.data.shownAnswer = shown;
    if (!isTrue) {
      base.data.misconception = '排水法理解错误：石块体积 = 底面积 × 水面上升高度 = ' + volume + '，题中给成了 ' + shown + '。';
    }
    return base;
  }
  return null;
}

function makeApplicationQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var template = pickTemplate(rng, nr, kpAllowedOps(plan));
  if (!template) return null; // FINAL-31c：fail-closed，不产出运算错位题
  var nums = generateNumbers(rng, template, nr);
  var answer = computeAnswer(template, nums);
  // P40-Q-13：情境叙事选取——plan.semanticParams.contextScenes.scenes（KP grade 命中 +
  // confirmed 场景条目）× relation 锚（PROBLEM_TEMPLATES[k].relation 逐字匹配语料 key）。
  // 数量关系与情境类型失配的关系（如行程 KP 无 shopping 叙事格）自然落空回退抽象模板；
  // 语料缺失/grade 无命中时不消耗 rng，保持回退形态与既有 rng 面完全一致。
  var narrative = null;
  var cs = plan && plan.semanticParams && plan.semanticParams.contextScenes;
  if (cs && Array.isArray(cs.scenes) && cs.scenes.length) {
    var rel = PROBLEM_TEMPLATES[template].relation;
    var pool = [];
    cs.scenes.forEach(function (s) {
      var n = s.narratives ? s.narratives[rel] : null;
      if (n && n.apply && n.brief) pool.push(n);
    });
    if (pool.length) narrative = pool[Math.floor(rng() * pool.length)];
  }
  var prompt = formatTemplate(template, nums, narrative ? narrative.apply : null);
  // choice/judge 专用精简题面（与 apply 故事骨架互异）
  var choiceZh = narrative ? narrative.brief
    : (PROBLEM_TEMPLATES[template].choiceZh || PROBLEM_TEMPLATES[template].zh);
  var choicePrompt = choiceZh;
  Object.keys(nums).forEach(function (key) {
    choicePrompt = choicePrompt.replace('{' + key + '}', String(nums[key]));
  });
  
  // 添加干扰项（用于 choice）：必须凑齐 3 个为正、互异且不等于答案的干扰项。
  // FINAL-13：此前仅抽 3 次、合法才入集 → 可能只剩 2 个干扰项（3 选项），
  // 且索引约定答案 String(correctIndex) 可能与某个选项值撞串（如 options=[1,4,6]、
  // correctIndex=1），被 TypeContract choice finisher fail-closed 丢弃——是否出题
  // 退化为取决于随机种子。改为有界补足干扰项 + 值约定答案（answer.value ∈ options）。
  var distractors = [];
  var ans = answer;
  var guard = 0;
  while (distractors.length < 3 && guard < 50) {
    guard++;
    var offset = randInt(rng, -5, 5);
    if (offset === 0) offset = 1;
    var dist = ans + offset;
    if (dist > 0 && distractors.indexOf(dist) === -1 && dist !== ans) {
      distractors.push(dist);
    }
  }

  var qt = plan.questionTypeId;
  if (qt === 'choice') {
    // 值约定：options 字符串化（optionsPresent 要求 string 元素），answer.value ∈ options
    var options = Rng.shuffle(rng, [ans].concat(distractors).slice(0, 4)).map(function (n) { return String(n); });
    var correctIndex = options.indexOf(String(ans));
    // P34-14：讲解只取本题模板的运算意义与本题数字，列式与得数均可由题目自身确定
    var choiceExpr = buildExpression(template, nums);
    var choiceExpl = OP_MEANING[PROBLEM_TEMPLATES[template].ops[0]]
      + '，列式 ' + formatExpr(choiceExpr) + ' = ' + ans
      + '，正确选项是「' + ans + '」。';
    return {
      knowledgePointId: pkp(plan),
      questionType: 'choice',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: choicePrompt,
      answer: { value: String(ans), acceptable: [], explanation: choiceExpl },
      answerMode: 'choice',
      data: {
        mode: 'choice',
        steps: Object.keys(nums).length > 2 ? 2 : 1,
        template: template,
        numbers: nums,
        options: options,
        correctIndex: correctIndex,
        relation: PROBLEM_TEMPLATES[template].relation,
        graphic: intentWantsGraphic(plan) ? buildRelationGraphic(template, nums, ans, 'choice') : null
      }
    };
  }

  if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    // V5.1.0：假命题扰动必须非 0，保证命题真值唯一（delta=0 会把假命题说成正确结果）
    var judgeDelta = randInt(rng, -5, 5);
    if (judgeDelta === 0) judgeDelta = 1;
    var shown = isTrue ? ans : ans + judgeDelta;
    var judgeExplanation = isTrue
      ? '题中数量关系正确，答案就是 ' + ans + '，说法正确。'
      : '根据题中数量关系，正确答案是 ' + ans + '，不是 ' + shown + '，说法错误。';
    var judgeData = {
      mode: 'judge',
      steps: Object.keys(nums).length > 2 ? 2 : 1,
      template: template,
      numbers: nums,
      shownAnswer: shown,
      relation: PROBLEM_TEMPLATES[template].relation,
      // judge 图形同 choice：主张材料只含已知量 + '？'，绝不含 answer/shown
      graphic: intentWantsGraphic(plan) ? buildRelationGraphic(template, nums, ans, 'judge') : null
    };
    if (!isTrue) {
      judgeData.misconception = '数量关系理解错误：按题意正确答案应为 ' + ans + '，题中给成了 ' + shown + '。';
    }
    return {
      knowledgePointId: pkp(plan),
      questionType: 'judge',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: choicePrompt + ' 答案是 ' + shown + ' —— 对还是错？',
      answer: { value: isTrue, acceptable: [], explanation: judgeExplanation },
      answerMode: 'judge',
      data: judgeData
    };
  }
  
  // fill / apply / calc：apply 保留完整情境故事；calc 用直接算式；fill 用逆推填空
  // （空首位操作数，使核心骨架与 calc 的 #op# 互异）。
  var appExpr = buildExpression(template, nums);
  var stemPrompt = prompt;
  var stemAnswer = String(answer);
  if (qt === 'calc') {
    stemPrompt = formatExpr(appExpr) + ' = ?';
  } else if (qt === 'fill') {
    stemPrompt = '____ ' + appExpr.ops[0] + ' ' + appExpr.operands[1] + ' = ' + answer;
    stemAnswer = String(appExpr.operands[0]);
  }
  // P34-13：calc 用模板主运算给运算意义讲解（素材取自该题 PROBLEM_TEMPLATES.ops），
  // 不再让汇聚层只补「算式 = 得数」的裸演算。
  // P34-14：apply/fill 补同口径讲解——运算意义 + 由本题数字确定的列式与得数，
  // 不引入题目以外的信息；fill 还原完整算式并指出空格值。
  var answerField = stemAnswer;
  var stemOpMeaning = OP_MEANING[PROBLEM_TEMPLATES[template].ops[0]];
  if (qt === 'calc') {
    answerField = {
      value: stemAnswer, acceptable: [],
      explanation: stemOpMeaning + '：' + formatExpr(appExpr) + ' = ' + stemAnswer
    };
  } else if (qt === 'apply') {
    answerField = {
      value: stemAnswer, acceptable: [],
      explanation: stemOpMeaning + '，列式 ' + formatExpr(appExpr) + ' = ' + stemAnswer + '。'
    };
  } else if (qt === 'fill') {
    answerField = {
      value: stemAnswer, acceptable: [],
      explanation: stemOpMeaning + '，完整算式是 ' + formatExpr(appExpr) + ' = ' + answer
        + '，所以空格填 ' + stemAnswer + '。'
    };
  }

  // P38 断链修复：fill/apply 补关系图（calc 意图无图，不挂键）
  var appData = {
    mode: qt,
    steps: Object.keys(nums).length > 2 ? 2 : 1,
    template: template,
    numbers: nums,
    relation: PROBLEM_TEMPLATES[template].relation,
    operation: PROBLEM_TEMPLATES[template].ops[0]
  };
  if ((qt === 'fill' || qt === 'apply') && intentWantsGraphic(plan)) {
    appData.graphic = buildRelationGraphic(template, nums, answer, qt, appExpr);
  }
  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: stemPrompt,
    answer: answerField,
    answerMode: 'input',
    data: appData
  };
}

function createApplicationGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:application';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['apply', 'fill', 'choice', 'judge', 'calc', 'geometry'],
    questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc', 'geometry'],
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
      var meta = getApplicationMeta(kp);

      for (var i = 0; i < count; i++) {
        var q;
        // P28-GEO-NATIVE-04：geometry 行（不规则物体的体积/排水法）走原生几何 maker
        if (plan.questionTypeId === 'geometry') {
          questions.push(makeDisplacementVolumeQuestion(plan, context, i));
          continue;
        }
        // P42-033：不规则物体的体积 fill/choice/judge/apply 四题型走排水法原生 maker，
        // 不再落入通用应用题模板（跨 KP 错挂家族根因修复，名称信号 canonical 唯一命中）。
        var volName = (plan.semanticParams && plan.semanticParams.name) || '';
        if (volName.indexOf('不规则') !== -1 && volName.indexOf('体积') !== -1) {
          var qv = makeIrregularVolumeTyped(plan, context, i);
          if (!qv) continue; // 未授权题型 fail-closed（镜像 FINAL-31c）
          questions.push(qv);
          continue;
        }
        q = makeApplicationQuestion(plan, context, i, meta);
        if (!q) continue; // FINAL-31c：KP 运算约束下无合规模板 → fail-closed 跳过
        // DEF-009：不再附加无教学信息的空虚线矩形（原 makeGraphicForApplication 输出），题面以文字承载条件
        questions.push(q);
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

// P25-06 H2：原 APPLICATION_KPS（math-gN-mN-* 模块制 / math-gN-c4-* 竞赛制 历史 ID，
// 含一条故意重复的权重项）已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function buildAll() {
  return [createApplicationGenerator({ id: 'generator:application-word' })];
}

module.exports = {
  PROBLEM_TEMPLATES: PROBLEM_TEMPLATES,
  createApplicationGenerator: createApplicationGenerator,
  buildAll: buildAll
};