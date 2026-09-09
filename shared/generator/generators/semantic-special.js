/**
 * shared/generator/generators/semantic-special.js — 知识库专项语义生成器（V2.1）
 *
 * 专为新教材补录的语义型知识点提供「语义正确」的专用生成逻辑，
 * 避免泛型生成器（selection-fill / application-word）对非算术语义 KP 输出错误语义题。
 *
 * 本文件内两个生成器：
 *   generator:code-recognition        —— 数字编码（三上综合实践：认识数字编码/编制学号）
 *   generator:equivalent-reasoning    —— 等量代换（三上综合实践：曹冲称象 / 等量代换推理）
 *
 * 挂载点：
 *   - generators/index.js  require + buildAll 合并（frozen 清单，改动需 baseline 重锚）
 *   - generator-registry.js CORE_RECORDS 增补 2 条 native 绑定（frozen 清单，同上）
 *   - selector 无需改动：native binding 最高优先 + 新 id 不触发任何家族硬阻断
 *
 * 输出契约：SemanticQuestion[]（字段与 selection.js buildBase 一致）
 */
'use strict';

var Rng = require('../core/rng.js');

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
    hint: null,
    answerMode: 'input',
    data: extra || {}
  };
}

function buildQuestions(plan, context, count, make) {
  var out = [];
  for (var i = 0; i < count; i++) out.push(make(plan, context, i));
  return out;
}

/* ================================================================
 * generator:code-recognition — 数字编码
 * ================================================================ */

function makeCodeFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var year = Rng.randInt(rng, 2022, 2025);
  var cls = Rng.randInt(rng, 1, 6);
  var seq = Rng.randInt(rng, 1, 30);
  var name = Rng.pick(rng, ['小华', '小明', '小红', '小刚', '小丽']);
  var code = String(year) + String(cls < 10 ? '0' + cls : cls) + String(seq < 10 ? '0' + seq : seq);
  var q = buildBase(plan, context, i, { mode: 'fill', codeType: 'student-id' });
  q.prompt = '光明小学给每位同学编学号：前 4 位是入学年份，第 5~6 位是班级，第 7~8 位是学号。'
    + name + ' ' + year + ' 年入学，在 ' + cls + ' 班，学号是 ' + seq + '，他的学号是（  ）。';
  q.answer = { value: code, acceptable: [] };
  return q;
}

function makeCodeChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var year = Rng.randInt(rng, 2022, 2025);
  var cls = Rng.randInt(rng, 1, 6);
  var seq = Rng.randInt(rng, 1, 30);
  var code = String(year) + String(cls < 10 ? '0' + cls : cls) + String(seq < 10 ? '0' + seq : seq);
  var wrongs = [
    year + ' 年入学' + '，' + seq + ' 班',
    (year + 1) + ' 年入学',
    (year - 1) + ' 年入学'
  ];
  var options = Rng.shuffle(rng, [year + ' 年入学'].concat(wrongs));
  var q = buildBase(plan, context, i, { mode: 'choice', codeType: 'student-id' });
  q.prompt = '光明小学的学号前 4 位表示入学年份，第 5~6 位表示班级，第 7~8 位表示学号。'
    + '小芳的学号是 ' + code + '，她的学号说明她（  ）。';
  q.answer = { value: String(year) + ' 年入学', acceptable: [] };
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(year) + ' 年入学');
  return q;
}

function makeCodeJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var statements = [
    { text: '数字编码的每一位都有特定的含义，不能随意改变。', value: true },
    { text: '数字编码可以用来表示学号、身份证号等信息。', value: true },
    { text: '数字编码的位数越少，表示的信息就越准确。', value: false },
    { text: '同一所学校里，两位同学的学号可以完全相同。', value: false }
  ];
  var s = Rng.pick(rng, statements);
  var q = buildBase(plan, context, i, { mode: 'judge', codeType: 'concept' });
  q.prompt = '判断对错：' + s.text + '（  ）';
  q.answer = { value: s.value, acceptable: [] };
  return q;
}

function createCodeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:code-recognition';
  var generator = {
    id: id,
    subject: 'math',
    capabilities: ['fill', 'choice', 'judge', 'recognize'],
    questionTypes: ['fill', 'choice', 'judge', 'recognize'],
    knowledgePoints: spec.knowledgePoints || ['math-g3-m10-g3-code'],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = plan.count || 1;
      var qt = plan.questionTypeId;
      if (qt === 'choice') return buildQuestions(plan, context, count, makeCodeChoice);
      if (qt === 'judge') return buildQuestions(plan, context, count, makeCodeJudge);
      return buildQuestions(plan, context, count, makeCodeFill);
    }
  };
  return generator;
}

/* ================================================================
 * generator:equivalent-reasoning — 等量代换
 * ================================================================ */

var ITEMS = [
  ['盒奶糖', '袋薯片', '支铅笔'],
  ['个苹果', '个橙子', '块饼干'],
  ['个书包', '个笔袋', '支钢笔'],
  ['辆玩具汽车', '个魔方', '块积木']
];

function pickChain(rng) {
  var trio = Rng.pick(rng, ITEMS);
  var p = Rng.randInt(rng, 2, 4);
  var q = Rng.randInt(rng, 2, 4);
  return { X: trio[0], Y: trio[1], Z: trio[2], p: p, q: q };
}

function makeEquivalentFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var q = buildBase(plan, context, i, { mode: 'fill', chain: [c.p, c.q] });
  q.prompt = '1' + c.X + ' = ' + c.p + c.Y + '，1' + c.Y + ' = ' + c.q + c.Z
    + '。1' + c.X + ' = （  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  return q;
}

function makeEquivalentChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var wrongs = [c.p, c.q, c.p + c.q, c.p + c.q - 1].filter(function (v) { return v !== ans; });
  var pool = [ans].concat(wrongs);
  while (pool.length < 4) pool.push(ans + Rng.randInt(rng, 1, 3));
  var options = Rng.shuffle(rng, pool.slice(0, 4).map(String));
  var q = buildBase(plan, context, i, { mode: 'choice', chain: [c.p, c.q] });
  q.prompt = '1' + c.X + ' = ' + c.p + c.Y + '，1' + c.Y + ' = ' + c.q + c.Z
    + '。1' + c.X + ' = （  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(ans));
  return q;
}

function makeEquivalentApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var c = pickChain(rng);
  var ans = c.p * c.q;
  var buyer = Rng.pick(rng, ['妈妈', '爸爸', '王老师', '李阿姨']);
  var q = buildBase(plan, context, i, { mode: 'apply', chain: [c.p, c.q] });
  q.prompt = buyer + '买 1' + c.X + '的钱可以买 ' + c.p + c.Y + '，买 1' + c.Y + '的钱可以买 '
    + c.q + c.Z + '。' + buyer + '买 1' + c.X + '的钱可以买（  ）' + c.Z + '。';
  q.answer = { value: String(ans), acceptable: [] };
  return q;
}

function createEquivalentGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:equivalent-reasoning';
  var generator = {
    id: id,
    subject: 'math',
    capabilities: ['fill', 'choice', 'apply'],
    questionTypes: ['fill', 'choice', 'apply'],
    knowledgePoints: spec.knowledgePoints || ['math-g3-m8-g3-equivalent'],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return generator.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = plan.count || 1;
      var qt = plan.questionTypeId;
      if (qt === 'choice') return buildQuestions(plan, context, count, makeEquivalentChoice);
      if (qt === 'apply') return buildQuestions(plan, context, count, makeEquivalentApply);
      return buildQuestions(plan, context, count, makeEquivalentFill);
    }
  };
  return generator;
}

function buildAll() {
  return [
    createCodeGenerator(),
    createEquivalentGenerator()
  ];
}

module.exports = {
  createCodeGenerator: createCodeGenerator,
  createEquivalentGenerator: createEquivalentGenerator,
  buildAll: buildAll
};
