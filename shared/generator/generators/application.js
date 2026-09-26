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
  // 简单乘法总量（低难度）：每份 × 份数 = 总量
  'equal-groups': {
    zh: '已知条件：每份有 {per} 个，共有 {groups} 份。\n问题：一共有多少个？',
    ops: ['mult'],
    relation: 'total = per × groups'
  },
  // 平均分（低难度除法）：总量 ÷ 份数 = 每份
  'share-equally': {
    zh: '已知条件：一共 {total} 个，平均分给 {groups} 人。\n问题：每人分得多少个？',
    ops: ['div'],
    relation: 'per = total ÷ groups'
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

function pickTemplate(rng, difficulty, allowedOps) {
  // 低难度用简单模板，高难度用复杂模板
  var simpleTemplates = ['total-from-parts', 'part-from-total', 'compare-more', 'compare-less', 'equal-groups', 'share-equally'];
  var complexTemplates = ['multiple', 'divide-multiple', 'grouping', 'distance', 'work'];
  var pool = difficulty >= 4 ? TEMPLATE_KEYS : simpleTemplates;
  // FINAL-31c：KP 运算约束过滤（真源 semanticParams.operations；无约束不过滤）
  if (allowedOps) {
    pool = pool.filter(function (k) {
      return PROBLEM_TEMPLATES[k].ops.every(function (op) { return allowedOps.indexOf(op) !== -1; });
    });
    if (pool.length === 0) return null; // fail-closed：无合规模板不出题，不产出运算错位题
  }
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
    case 'equal-groups':
      var gp = randInt(rng, 2, 9);
      var gs = randInt(rng, 2, 6);
      return { per: gp, groups: gs };
    case 'share-equally':
      var sg = randInt(rng, 2, 6);
      var sp = randInt(rng, 2, 9);
      return { total: sg * sp, groups: sg };
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
    case 'equal-groups': return nums.per * nums.groups;
    case 'share-equally': return nums.total / nums.groups;
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
  var template = pickTemplate(rng, plan.difficulty, kpAllowedOps(plan));
  if (!template) return null; // FINAL-31c：fail-closed，不产出运算错位题
  var nums = generateNumbers(rng, template, plan.difficulty);
  var answer = computeAnswer(template, nums);
  var prompt = formatTemplate(template, nums);
  
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
    return {
      knowledgePointId: pkp(plan),
      questionType: 'choice',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: String(ans),
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
    capabilities: ['apply', 'fill', 'choice', 'judge', 'calc'],
    questionTypes: ['apply', 'fill', 'choice', 'judge', 'calc'],
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
        var q = makeApplicationQuestion(plan, context, i, meta);
        if (!q) continue; // FINAL-31c：KP 运算约束下无合规模板 → fail-closed 跳过
        q.data.graphic = makeGraphicForApplication(q.data.template, q.data.numbers);
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