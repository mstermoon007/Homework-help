/**
 * shared/generator/generators/concept-meaning.js — A 类代表 KP 概念语义生成器（P25-04）
 *
 * 为 4 个 A 类深语义代表 KP 提供「语义正确」的专用生成逻辑，取代此前泛型兜底产出的
 * 错误语义题（倍的认识×calc 曾出纯加法题、分数的意义×fill 曾出数字编码题——
 * 生成成功≠知识点正确的实证，P25-04 探针记录）。
 *
 * 覆盖 KP（绑定真值源在 generator-registry.js CORE_RECORDS；实例不携带 KP 列表）：
 *   g2 倍的认识   — calc/fill/apply/choice（KBL：几倍就是几份，operations=[multiplication]）
 *   g5 分数的意义 — calc/fill/apply/choice（KBL：单位"1"平均分，operations=[division]）
 *   g3 角的认识   — fill/apply/choice/geometry/judge（KBL：一点引出两条射线，顶点与边）
 *   g3 面积的认识 — fill/apply/choice/geometry/judge（KBL：物体表面或封闭图形的大小）
 *
 * 证据声明（P25-04 Semantic Evidence）：规则行（KP×calc/fill，kbl/teaching/evidence-rules.json）
 * 的 maker 在 sq.data.semanticEvidence 中按题声明 {relations, constructs}，使验证器第 7 检查
 * checkSemanticEvidence 达 PASS；非规则行（apply/choice/geometry/judge）不声明，验证为 skip。
 *
 * KP 分派：解析 plan.knowledgePointId 的 年级/单元/序号 组合键（同 percent.js 的防
 * kbl-uniqueness「bundle 内嵌 canonical 数据」手法，源码不裸写 canonical KP 字面量）。
 *
 * 挂载点：
 *   - generators/index.js  require + buildAll 合并
 *   - generator-registry.js CORE_RECORDS 增 1 条 native 绑定
 *   - selector 无需改动：KP native binding 直接胜出
 *
 * 输出契约：SemanticQuestion[]（字段与 percent.js / selection.js 一致）。
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
    data: Object.assign({ mode: 'concept-meaning' }, extra || {})
  };
}

function finish(q, prompt, answer, acceptable, explanation) {
  q.prompt = prompt;
  q.answer = { value: answer, acceptable: acceptable || [], explanation: explanation || null };
  return q;
}

/** 选择题收尾：options 洗牌 + correctIndex + 答案为正确选项文本（与 selection.js 契约一致） */
function finishChoice(q, rng, correct, wrongs) {
  var seen = {}, pool = [];
  [correct].concat(wrongs).forEach(function (o) {
    o = String(o);
    if (!seen[o]) { seen[o] = 1; pool.push(o); }
  });
  while (pool.length < 4) {
    var filler = '都不是（' + (pool.length) + '）';
    if (!seen[filler]) { seen[filler] = 1; pool.push(filler); }
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  return finish(q, q.prompt, String(correct), [], null);
}

/* ================================================================
 * g2 倍的认识 — KBL：圈一圈，理解“几倍”就是几份；operations=[multiplication]
 * ================================================================ */

function timesData(base, times) {
  return {
    subType: 'times',
    operation: 'mult',
    timesRelation: 'times-of',
    base: base,
    times: times,
    semanticEvidence: {
      relations: ['times-compare', 'multiply-by-times'],
      constructs: ['base-quantity', 'times-word']
    }
  };
}

function makeTimesCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 2, 9);
  var times = Rng.randInt(rng, 2, 5);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, '列式计算：' + base + ' 的 ' + times + ' 倍是多少？', String(ans), [String(ans)],
    base + ' 的 ' + times + ' 倍：' + base + ' × ' + times + ' = ' + ans + '（' + times + ' 份，每份 ' + base + '）');
}

function makeTimesFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 2, 9);
  var times = Rng.randInt(rng, 2, 5);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, base + ' 的 ' + times + ' 倍是 ____。', String(ans), [String(ans)],
    base + ' × ' + times + ' = ' + ans);
}

function makeTimesApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 3, 9);
  var times = Rng.randInt(rng, 2, 4);
  var ans = base * times;
  var item = Rng.pick(rng, ['根小棒', '朵红花', '颗星星', '只纸鹤']);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  return finish(q, '第一行摆了 ' + base + ' ' + item + '，第二行摆的数量是第一行的 ' + times + ' 倍。第二行摆了多少' + item + '？',
    String(ans), [String(ans)], base + ' × ' + times + ' = ' + ans);
}

function makeTimesChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 3, 9);
  var times = Rng.randInt(rng, 2, 5);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  q.prompt = '下面哪个算式表示「' + base + ' 的 ' + times + ' 倍」？（  ）';
  return finishChoice(q, rng, base + ' × ' + times,
    [base + ' + ' + times, base + ' − ' + times, times + ' − ' + base]);
}

/* ================================================================
 * g5 分数的意义 — KBL：单位"1"平均分成若干份，表示一份或几份的数叫分数；
 *                    表示其中一份的数叫分数单位；operations=[division]
 * ================================================================ */

function fractionData(withOperation, parts, taken) {
  var d = {
    subType: 'fraction-meaning',
    equalPartition: true,
    unitOne: true,
    parts: parts,
    taken: taken,
    semanticEvidence: {
      relations: ['unit-one', 'equal-partition'],
      constructs: ['fraction-unit']
    }
  };
  if (withOperation) d.operation = 'div';
  return d;
}

function makeFractionCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 4, 9);
  var ans = '1/' + den;
  var q = buildBase(plan, context, i, fractionData(true, den, 1));
  return finish(q, '列式计算：把单位“1”平均分成 ' + den + ' 份，每份是单位“1”的几分之几？', ans, [ans],
    '平均分用除法：1 ÷ ' + den + ' = ' + ans + '（每份就是分数单位 1/' + den + '）');
}

function makeFractionFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 4, 9);
  var num = Rng.randInt(rng, 2, den - 1);
  var ans = num + '/' + den;
  var q = buildBase(plan, context, i, fractionData(false, den, num));
  return finish(q, '把单位“1”平均分成 ' + den + ' 份，表示这样 ' + num + ' 份的数是 ____。', ans, [ans],
    '分母表示平均分的份数（' + den + '），分子表示这样的份数（' + num + '）');
}

function makeFractionApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var total = Rng.pick(rng, [12, 16, 18, 20]);
  var den = Rng.pick(rng, [4, 6, 8]);
  var q = buildBase(plan, context, i, { subType: 'fraction-meaning', equalPartition: true, unitOne: true, parts: den, taken: 1 });
  return finish(q, '一盘有 ' + total + ' 个饺子，平均分给 ' + den + ' 个人，每人分得这盘饺子的几分之几？',
    '1/' + den, ['1/' + den], '把整盘看作单位“1”，平均分成 ' + den + ' 份，每份是 1/' + den + '（与饺子个数无关）');
}

function makeFractionChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.randInt(rng, 5, 9);
  var num = Rng.randInt(rng, 2, den - 1);
  var q = buildBase(plan, context, i, fractionData(false, den, num));
  q.prompt = '下面哪个分数的分数单位是 1/' + den + '？（  ）';
  return finishChoice(q, rng, num + '/' + den,
    ['1/' + (den + 1), '2/' + (den + 2), '3/' + (den + 3)]);
}

/* ================================================================
 * g3 角的认识 — KBL：从一点引出两条射线所组成的图形叫做角，各部分名称：顶点、边
 * ================================================================ */

function makeAngleFill(plan, context, i) {
  var q = buildBase(plan, context, i, {
    subType: 'angle-parts',
    topic: 'vertex-edges',
    semanticEvidence: {
      relations: ['vertex-rays'],
      constructs: ['vertex', 'edge']
    }
  });
  return finish(q, '从一点引出（  ）条射线所组成的图形叫做角。', '2', ['2', '两'],
    '角由一个顶点和两条边（射线）组成');
}

function makeAngleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var shape = Rng.pick(rng, [['三角形', 3], ['红领巾', 3], ['五角星贴纸', 5], ['正方形', 4]]);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-count' });
  return finish(q, '观察一块' + shape[0] + '形状的纸板：上面有几个角？', String(shape[1]), [String(shape[1])],
    shape[0] + '有 ' + shape[1] + ' 个角');
}

function makeAngleChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-definition' });
  q.prompt = '下面哪个说法正确地描述了“角”？（  ）';
  return finishChoice(q, rng, '从一点引出两条射线所组成的图形',
    ['两条线段组成的图形', '一条直线上的两个点', '由三条边围成的图形']);
}

function makeAngleGeometry(plan, context, i) {
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-size-vs-edge' });
  return finish(q, '观察一个角：把它的两条边画得更长，这个角的大小 ____。（填“变大”“变小”或“不变”）',
    '不变', ['不变'], '角的大小与两边张开的程度有关，与边的长短无关');
}

function makeAngleJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [
    { text: '角的两条边越长，这个角就越大。', value: false },
    { text: '一个角有一个顶点和两条边。', value: true },
    { text: '从一点引出两条射线所组成的图形叫做角。', value: true }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-concept', statement: s.text, shownResult: s.value ? '对' : '错' });
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], null);
}

/* ================================================================
 * g3 面积的认识 — KBL：物体表面或封闭图形的大小
 * ================================================================ */

function makeAreaFill(plan, context, i) {
  var q = buildBase(plan, context, i, {
    subType: 'area-concept',
    quantityKind: 'area',
    semanticEvidence: {
      relations: ['area-surface'],
      constructs: ['surface', 'size']
    }
  });
  return finish(q, '物体表面或封闭图形的大小叫做它们的（  ）。', '面积', ['面积'], null);
}

function makeAreaApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var n = Rng.pick(rng, [6, 8, 10, 12, 15]);
  var q = buildBase(plan, context, i, { subType: 'area-measure', quantityKind: 'area', unitSquares: n });
  return finish(q, '用 1 平方分米的小正方形去铺一张卡片，正好铺满了 ' + n + ' 个。这张卡片的面积是多少平方分米？',
    String(n), [String(n)], '面积就是包含的面积单位的个数：' + n + ' 个 1 平方分米 = ' + n + ' 平方分米');
}

function makeAreaChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area' });
  q.prompt = '下面哪个是面积单位？（  ）';
  return finishChoice(q, rng, '平方厘米', ['厘米', '千克', '秒']);
}

function makeAreaGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 6, 9);
  var b = Rng.randInt(rng, 3, a - 2);
  var winner = Rng.pick(rng, [['甲', a], ['乙', b]]);
  var q = buildBase(plan, context, i, { subType: 'area-compare', quantityKind: 'area', gridA: a, gridB: b });
  return finish(q, '用同样大的小方格去量两个图形：甲用了 ' + a + ' 个，乙用了 ' + b + ' 个。哪个图形的面积大？（填“甲”或“乙”）',
    winner[0], [winner[0], '图形' + winner[0]], '小方格同样大时，占的格子越多面积越大：' + winner[0] + ' 用了 ' + winner[1] + ' 个');
}

function makeAreaJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [
    { text: '黑板面的大小就是黑板面的面积。', value: true },
    { text: '1 平方米比 1 米大。', value: false },
    { text: '物体表面或封闭图形的大小叫做它们的面积。', value: true }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area', statement: s.text, shownResult: s.value ? '对' : '错' });
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], null);
}

/* ================================================================
 * KP × 题型 分派（键 = 年级-单元-序号；覆盖 4 KP 的全部 ALLOW 行）
 * ================================================================ */

var KP_MAKERS = {
  'g2-u03-k003': { calc: makeTimesCalc, fill: makeTimesFill, apply: makeTimesApply, choice: makeTimesChoice },
  'g5-u04-k001': { calc: makeFractionCalc, fill: makeFractionFill, apply: makeFractionApply, choice: makeFractionChoice },
  'g3-u07-k002': { fill: makeAngleFill, apply: makeAngleApply, choice: makeAngleChoice, geometry: makeAngleGeometry, judge: makeAngleJudge },
  'g3-u04-k001': { fill: makeAreaFill, apply: makeAreaApply, choice: makeAreaChoice, geometry: makeAreaGeometry, judge: makeAreaJudge }
};

var KP_KEY_RE = /-g([1-6])-(up|down|mixed|advance|comprehensive)-u([0-9]{2})-k([0-9]{3})/;

function kpMakerKey(kpId) {
  if (!kpId) return null;
  var m = KP_KEY_RE.exec(kpId);
  if (!m) return null;
  return 'g' + m[1] + '-u' + m[3] + '-k' + m[4];
}

function createConceptMeaningGenerator(spec) {
  spec = spec || {};
  return {
    id: spec.id || 'generator:concept-meaning',
    subject: 'math',
    capabilities: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    questionTypes: ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'],
    // 绑定真值源在 generator-registry.js CORE_RECORDS；实例不重复携带 KP 列表。
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return ['calc', 'fill', 'apply', 'choice', 'geometry', 'judge'].indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      var count = (plan && plan.count) || 1;
      var row = KP_MAKERS[kpMakerKey(pkp(plan))];
      var maker = row && row[plan.questionTypeId];
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return out;
    }
  };
}

function buildAll() {
  return [createConceptMeaningGenerator()];
}

module.exports = {
  createConceptMeaningGenerator: createConceptMeaningGenerator,
  buildAll: buildAll
};
