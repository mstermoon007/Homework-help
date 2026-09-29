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
 * P25-06 分派：不再解析 KP ID 的年级/单元/序号组合键，统一消费 selector 注入的
 * plan.semanticParams.subTopic（times-concept / fraction-meaning / angle-concept /
 * area-concept，SemanticParameters 按语义族 + KBL name/concept 机械派生）；
 * subTopic 缺失或该题型无 maker 时返回 []（fail-closed，不静默兜底）。
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
      // FINAL-37：与 evidence-rules 同源——倍的结构构件 base/multiple/comparison
      constructs: ['base-quantity', 'multiple', 'comparison']
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
      // FINAL-37：分数的结构构件 whole/part/fraction-relation
      constructs: ['whole', 'part', 'fraction-relation']
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
      // FINAL-37：角的结构构件 vertex/rays/angle
      constructs: ['vertex', 'rays', 'angle']
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
    {
      text: '角的两条边越长，这个角就越大。', value: false,
      explanation: '角的大小只与两边张开的程度有关，与边的长短无关，边画得再长角也不会变大，说法错误。',
      misconception: '误认为角的大小由边的长短决定：角的大小只取决于两边张开的程度。'
    },
    {
      text: '一个角有一个顶点和两条边。', value: true,
      explanation: '角由一个顶点和从这个顶点引出的两条边组成，说法正确。'
    },
    {
      text: '从一点引出两条射线所组成的图形叫做角。', value: true,
      explanation: '这是角的定义：从一点引出两条射线所组成的图形就是角，说法正确。'
    }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-concept', statement: s.text, shownResult: s.value ? '对' : '错' });
  if (s.misconception) q.data.misconception = s.misconception;
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], s.explanation);
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
    {
      text: '黑板面的大小就是黑板面的面积。', value: true,
      explanation: '物体表面的大小就是这个面的面积，黑板面的大小就是黑板面的面积，说法正确。'
    },
    {
      text: '1 平方米比 1 米大。', value: false,
      explanation: '平方米是面积单位，米是长度单位，两者计量的量不同，不能比较大小，说法错误。',
      misconception: '面积单位与长度单位混淆：不同类的计量单位之间不能比较大小。'
    },
    {
      text: '物体表面或封闭图形的大小叫做它们的面积。', value: true,
      explanation: '这是面积的定义：物体表面或封闭图形的大小叫做它们的面积，说法正确。'
    }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area', statement: s.text, shownResult: s.value ? '对' : '错' });
  if (s.misconception) q.data.misconception = s.misconception;
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], s.explanation);
}

/* ================================================================
 * P25-09 扩展概念族：number-concept / negative-number /
 * multdiv-relation / algebra-letter（每个子类型 4 题型）
 *
 * item builder 返回 {stem, answer, options, apply}：
 *   stem 内嵌支撑算式（满足 calc expressionPresent）；apply 为生活情境题干。
 * ================================================================ */

function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }

/* ================================================================
 * P28-COMPOSITION-DIVERSIFY-01：「数的组成」纯代码多样化生成
 *
 * 不调用大模型、不维护完整句子模板库：数字分解 n=10×t+o → 方向/词项槽位 →
 * 规则组合 → validateCompositionItem 程序校验；题干不再内嵌「（参考：…）」
 * 向学生泄露答案（calc 的 expressionPresent 改由 data.operation='add' 承载；
 * KP operations=[]，semantic-evidence 据此过滤不声明算术关系，不冲突）。
 * ================================================================ */

// 语境词项库：物品 / 个体量词 / 分组量词 / 分组动作
var COMPOSITION_SCENES = [
  { item: '苹果', unit: '个', group: '堆', action: '堆成' },
  { item: '汽车', unit: '辆', group: '排', action: '排成' },
  { item: '小棒', unit: '根', group: '捆', action: '捆成' },
  { item: '鸡蛋', unit: '个', group: '盒', action: '装成' },
  { item: '糖果', unit: '颗', group: '袋', action: '装成' },
  { item: '书本', unit: '本', group: '摞', action: '摞成' }
];

function compositionPhrase(t, o) { return t + '个十和' + o + '个一'; }

/* 正向干扰项：写反 / 置1 / ±1 三类经典错误；穷尽兜底保证 ≥3 个互异 */
function compositionForwardOptions(t, o) {
  var correct = compositionPhrase(t, o);
  var wrongs = [];
  function add(tt, oo) {
    if (tt < 1 || tt > 9 || oo < 1 || oo > 9) return;
    var s = compositionPhrase(tt, oo);
    if (s !== correct && wrongs.indexOf(s) === -1) wrongs.push(s);
  }
  if (t !== o) add(o, t);      // 十位个位写反（经典错误）
  add(1, o);                   // 十位误为 1
  add(t, 1);                   // 个位误为 1
  add(t - 1, o); add(t + 1, o);
  add(t, o - 1); add(t, o + 1);
  for (var tt = 1; tt <= 9 && wrongs.length < 3; tt++) {
    for (var oo = 1; oo <= 9; oo++) add(tt, oo);
  }
  return [correct].concat(wrongs.slice(0, 3));
}

/* 逆向干扰项：前 3 个有效候选恒互异（t+o、n−1、n−10 两两不重合有整数解证明，
 * n≥11 保证非负），无需兜底循环——P28-COMPOSITION-DIVERSIFY-01b 死代码清除 */
function compositionReverseOptions(t, o) {
  var n = t * 10 + o;
  var correct = String(n);
  var wrongs = [];
  function addNum(x) {
    var s = String(x);
    if (x !== n && x >= 0 && wrongs.indexOf(s) === -1) wrongs.push(s);
  }
  if (t !== o) addNum(o * 10 + t);  // 数位写反
  addNum(t + o);                    // 十位个位直接相加（漏乘10的经典错误）
  addNum(n - 1); addNum(n + 1);
  addNum(n - 10); addNum(n + 10);
  return [correct].concat(wrongs.slice(0, 3));
}

/** 程序校验（对应方案校验规则）：位值不写反、题干要素齐全、填空有空位、选项互异且含答案、无答案泄露 */
function validateCompositionItem(item, t, o, n) {
  var reverse = item.answer === String(n);
  function compact(s) { return String(s).replace(/\s/g, ''); }
  // 非判断题：任何题干禁止出现写反的位值（o个十 / t个一）
  if (t !== o) {
    [item.stem, item.apply].forEach(function (s) {
      var c = compact(s);
      if (c.indexOf(o + '个十') !== -1 || c.indexOf(t + '个一') !== -1) {
        throw new Error('composition: 题干十位个位写反');
      }
    });
  }
  if (!reverse) {
    if (compact(item.stem).indexOf(String(n)) === -1) throw new Error('composition: 正向题干缺数字');
    if (item.stem.indexOf('十') === -1 || item.stem.indexOf('几') === -1) throw new Error('composition: 正向题干缺提问');
    var cf = compact(item.apply);
    if (cf.indexOf(String(n)) === -1 || cf.indexOf('每10') === -1) throw new Error('composition: 语境缺每10分组');
  } else {
    var cs = compact(item.stem);
    // 组成可为「t个十/o个一」短语或计数器「t颗/o颗珠子」形式
    var hasParts = (cs.indexOf(t + '个十') !== -1 && cs.indexOf(o + '个一') !== -1)
      || (cs.indexOf(t + '颗') !== -1 && cs.indexOf(o + '颗') !== -1);
    if (!hasParts) throw new Error('composition: 逆向题干缺组成');
    var ca = compact(item.apply);
    if (ca.indexOf('10') === -1 || ca.indexOf('多少') === -1) throw new Error('composition: 语境逆向缺条件');
  }
  if (!/____|（\s*）/.test(item.fill)) throw new Error('composition: fill 缺空位');
  var opts = item.options, seen = {};
  if (opts.length < 4) throw new Error('composition: 选项不足 4 个');
  for (var i = 0; i < opts.length; i++) {
    if (seen[opts[i]]) throw new Error('composition: 选项重复');
    seen[opts[i]] = 1;
  }
  if (opts.indexOf(item.answer) === -1) throw new Error('composition: 答案不在选项中');
  if (/参考/.test(item.stem + item.apply + item.fill)) throw new Error('composition: 题干仍含答案显示');
}

function buildCompositionItem(rng) {
  var t = ri(rng, 1, 9), o = ri(rng, 1, 9);
  var n = t * 10 + o;
  var reverse = rng() < 0.5;

  // calc 题干：正向 5 式 / 逆向 3 式（槽位组合，方向由种子决定）
  var stem;
  if (!reverse) {
    switch (ri(rng, 0, 4)) {
      case 0: stem = n + ' 是由几个十和几个一组成的？'; break;
      case 1: stem = n + ' 里面有几个十和几个一？'; break;
      case 2: stem = n + ' 中有几个十、几个一？'; break;
      case 3: stem = n + ' 的十位上是几？个位上是几？'; break;
      default: stem = n + ' 可以分成几个十和几个一？';
    }
  } else {
    switch (ri(rng, 0, 2)) {
      case 0: stem = compositionPhrase(t, o) + '合起来是多少？'; break;
      case 1: stem = '一个数由' + compositionPhrase(t, o) + '组成，这个数是多少？'; break;
      default: stem = '十位上有' + t + ' 颗珠子，个位上有' + o + ' 颗珠子，这个数是多少？';
    }
  }

  // fill 题干：专用双空位 / 单空位形式（calc 多问句的机械替换不可靠）
  var fillStem = !reverse
    ? n + ' 是由（ ）个十和（ ）个一组成的。'
    : compositionPhrase(t, o) + '合起来是 ____。';

  // apply 题干：语境词项槽位，方向与 item 一致（保证答案同源）
  var scene = COMPOSITION_SCENES[ri(rng, 0, COMPOSITION_SCENES.length - 1)];
  var applyStem;
  if (!reverse) {
    applyStem = '有 ' + n + ' ' + scene.unit + scene.item + '，每 10 ' + scene.unit + scene.item +
      scene.action + '一' + scene.group + '，可以' + scene.action + '几' + scene.group + '？还剩几' + scene.unit + '？';
  } else {
    applyStem = t + ' ' + scene.group + scene.item + '，每' + scene.group + ' 10 ' + scene.unit +
      '，另外还有 ' + o + ' ' + scene.unit + '，一共有多少' + scene.unit + scene.item + '？';
  }

  var item = {
    stem: stem,
    fill: fillStem,
    apply: applyStem,
    answer: reverse ? String(n) : compositionPhrase(t, o),
    options: reverse ? compositionReverseOptions(t, o) : compositionForwardOptions(t, o),
    operation: 'add'
  };
  validateCompositionItem(item, t, o, n);
  return item;
}

function buildNumberConceptItem(rng, name) {
  // P25-09：g1-up-u01-k001「1-5数的认识」——素材必须限定在 1~5，
  // 不能落默认分支的两位数（off-grade）；n∈2..5 保证 n−1 ≥ 1。
  if (name.indexOf('1-5') !== -1 || name.indexOf('1～5') !== -1) {
    var n5 = ri(rng, 2, 5);
    return { stem: '数一数：' + n5 + ' 前面一个数是多少？（参考：' + n5 + ' − 1 = ' + (n5 - 1) + '）',
      answer: String(n5 - 1), options: [String(n5 - 1), String(n5), String(n5 + 1)],
      apply: '排队报数，小明报 ' + n5 + '（' + n5 + ' − 1 = ' + (n5 - 1) + '），他前面一个同学报几？' };
  }
  if (name.indexOf('百数表') !== -1) {
    var x0 = ri(rng, 12, 88);
    return { stem: '百数表中，' + x0 + ' 右边一个数是多少？（参考：' + x0 + ' + 1 = ' + (x0 + 1) + '）',
      answer: String(x0 + 1), options: [String(x0 + 1), String(x0 + 10), String(x0 - 1)],
      apply: '在百数表（每行10个数）里圈出 ' + x0 + '，它右边一格的数是多少？（' + x0 + ' + 1 = ？）' };
  }
  if (name.indexOf('近似') !== -1 || name.indexOf('改写') !== -1) {
    var n0 = ri(rng, 2, 8) * 10000;
    return { stem: '把 ' + n0 + ' 改写成用「万」作单位的数：' + n0 + ' = ' + (n0 / 10000) + ' × 10000，等于多少万？',
      answer: String(n0 / 10000) + '万', options: [n0 / 10000 + '万', n0 / 1000 + '万', n0 + '万'],
      apply: '某城市人口约 ' + n0 + ' 人，' + n0 + ' = ' + (n0 / 10000) + ' × 10000，改写成用万作单位是多少万人？' };
  }
  if (name.indexOf('亿') !== -1) {
    return { stem: '10 个一千万是多少？（10 × 10000000 = 100000000）',
      answer: '一亿', options: ['一亿', '一千万', '一百万'],
      apply: '计数器上一千万一千万地数，10 × 10000000 = 100000000，10 个一千万是多少？' };
  }
  if (name.indexOf('计数单位') !== -1) {
    var units = [['一百', '一千', 100, 1000], ['一十', '一百', 10, 100], ['一千', '一万', 1000, 10000]];
    var u = units[ri(rng, 0, 2)];
    return { stem: '10 个' + u[0] + '是多少？（10 × ' + u[2] + ' = ' + u[3] + '）',
      answer: u[1], options: [u[1], u[0], '一亿'],
      apply: '数数时，10 × ' + u[2] + ' = ' + u[3] + '，10 个' + u[0] + '组成的计数单位是什么？' };
  }
  if (name.indexOf('数位') !== -1) {
    // FINAL-139：位值用「几个十几个一」语言 + 整十数加一位数（G1 已学），不用未教学的 ×10
    var tens = ri(rng, 1, 9), ones = ri(rng, 1, 9);
    var num0 = tens * 10 + ones;
    return { stem: num0 + ' 中数字 ' + tens + ' 在什么位上？（参考：' + tens + ' 个十和 ' + ones + ' 个一，' + (tens * 10) + ' + ' + ones + ' = ' + num0 + '）',
      answer: '十位', options: ['十位', '个位', '百位'],
      apply: '计数器拨出 ' + num0 + '（' + tens + ' 个十和 ' + ones + ' 个一，' + (tens * 10) + ' + ' + ones + ' = ' + num0 + '），' + tens + ' 拨在哪一位上？' };
  }
  if (name.indexOf('顺序') !== -1 || name.indexOf('相邻') !== -1) {
    var cur = ri(rng, 11, 88);
    return { stem: '与 ' + cur + ' 相邻的两个数是多少？（参考：' + cur + ' − 1 = ' + (cur - 1) + '）',
      answer: (cur - 1) + ' 和 ' + (cur + 1), options: [(cur - 1) + ' 和 ' + (cur + 1), cur + ' 和 ' + (cur + 1), (cur - 1) + ' 和 ' + cur],
      apply: '发牌时数到 ' + cur + '，它前一个是 ' + (cur - 1) + '（' + cur + ' − 1 = ' + (cur - 1) + '），后一个数是多少？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a0 = ri(rng, 12, 98), b0 = a0 + ri(rng, 1, 9) * (rng() < 0.5 ? 1 : -1);
    if (b0 <= 10) b0 = a0 + 5;
    return { stem: '比较大小：' + Math.min(a0, b0) + ' ○ ' + Math.max(a0, b0) + '（参考：' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '）',
      answer: '<', options: ['>', '<', '='],
      apply: '一年级有 ' + Math.min(a0, b0) + ' 人，二年级有 ' + Math.max(a0, b0) + ' 人，' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '，哪个年级人数多（填 > 或 <）？' };
  }
  if (name.indexOf('组成') !== -1) {
    // P28-COMPOSITION-DIVERSIFY-01：纯代码多样化生成（正向/逆向 × 问答/填空/6类语境），
    // 题干不再内嵌答案；详见 buildCompositionItem。
    return buildCompositionItem(rng);
  }
  if (name.indexOf('算盘') !== -1) {
    // P25-09：算盘认数（g2-down-u04-k004）——一个上珠表示5、一个下珠表示1
    var abPick = rng();
    if (abPick < 0.34) {
      return { stem: '算盘上一个上珠靠梁表示几？（参考：1 × 5 = 5）',
        answer: '5', options: ['5', '1', '10'],
        apply: '在算盘上拨数，1 个上珠靠梁，1 × 5 = 5，它表示数字几？' };
    }
    if (abPick < 0.67) {
      return { stem: '算盘上一个下珠靠梁表示几？（参考：1 × 1 = 1）',
        answer: '1', options: ['1', '5', '10'],
        apply: '在算盘上拨数，1 个下珠靠梁，1 × 1 = 1，它表示数字几？' };
    }
    return { stem: '算盘的十位上1个上珠靠梁、个位上2个下珠靠梁，表示的数是多少？（参考：5 × 10 + 2 = 52）',
      answer: '52', options: ['52', '25', '70'],
      apply: '算盘十位1个上珠靠梁表示5个十，个位2个下珠靠梁表示2个一，5 × 10 + 2 = ？，表示的数是多少？' };
  }
  // 读写/认识（默认）
  // FINAL-139：同上，计数器位值用「几个十和几个一」+ 整十数加一位数，不用 ×10
  var t1 = ri(rng, 1, 9), o1 = ri(rng, 1, 9);
  return { stem: '计数器十位 ' + t1 + ' 颗珠、个位 ' + o1 + ' 颗珠（' + t1 + ' 个十和 ' + o1 + ' 个一，' + (t1 * 10) + ' + ' + o1 + ' = ' + (t1 * 10 + o1) + '），写作多少？',
    answer: String(t1 * 10 + o1), options: [String(t1 * 10 + o1), String(t1 + o1), String(o1 * 10 + t1)],
    apply: '数一数：十位拨 ' + t1 + ' 颗、个位拨 ' + o1 + ' 颗，' + t1 + ' 个十和 ' + o1 + ' 个一合起来写作多少？（' + (t1 * 10) + ' + ' + o1 + ' = ' + (t1 * 10 + o1) + '）' };
}

function buildNegativeItem(rng, name) {
  if (name.indexOf('数轴') !== -1) {
    var k0 = ri(rng, 2, 6);
    return { stem: '在数轴上，0 左边第 ' + k0 + ' 格表示什么数？（参考：0 − ' + k0 + ' = −' + k0 + '）',
      answer: '−' + k0, options: ['−' + k0, String(k0), '0'],
      apply: '温度计以 0℃ 为分界，0 − ' + k0 + ' = −' + k0 + '，数轴上 0 左边第 ' + k0 + ' 格是什么数？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a1 = ri(rng, 2, 8), b1 = a1 + ri(rng, 1, 5);
    return { stem: '比较大小：−' + b1 + ' ○ −' + a1 + '（参考：' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，负号后越大数越小）',
      answer: '<', options: ['>', '<', '='],
      apply: '哈尔滨 −' + b1 + '℃，北京 −' + a1 + '℃，' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，哪里更冷，即 −' + b1 + ' ○ −' + a1 + '？' };
  }
  // 读写/认识
  return { stem: '读出下面的数：−5 与 +8（参考：0 − 5 = −5），−5 读作什么？',
    answer: '负五', options: ['负五', '正五', '五'],
    apply: '存折上支出 5 元记作 −5（0 − 5 = −5），−5 应该怎样读？' };
}

function buildMultDivRelationItem(rng, name) {
  if (name.indexOf('平均分') !== -1) {
    var total0 = ri(rng, 2, 9) * ri(rng, 2, 9), groups0 = ri(rng, 2, 6);
    while (total0 % groups0 !== 0) total0 += 1;
    return { stem: '把 ' + total0 + ' 平均分成 ' + groups0 + ' 份，每份多少？（' + total0 + ' ÷ ' + groups0 + ' = ？）',
      answer: String(total0 / groups0), options: [String(total0 / groups0), String(groups0), String(total0)],
      apply: '把 ' + total0 + ' 块糖平均分给 ' + groups0 + ' 个小朋友，' + total0 + ' ÷ ' + groups0 + ' = ？，每人几块？' };
  }
  var a2 = ri(rng, 2, 9), b2 = ri(rng, 2, 9), p2 = a2 * b2;
  return { stem: '因为 ' + a2 + ' × ' + b2 + ' = ' + p2 + '，所以 ' + p2 + ' ÷ ' + a2 + ' = 多少？',
    answer: String(b2), options: [String(b2), String(a2), String(p2)],
    apply: '每盒有 ' + a2 + ' 支笔，' + b2 + ' 盒共 ' + p2 + ' 支（' + a2 + ' × ' + b2 + ' = ' + p2 + '）。反过来 ' + p2 + ' ÷ ' + a2 + ' = ？，是多少盒？' };
}

function buildAlgebraLetterItem(rng, name) {
  if (name.indexOf('数量关系') !== -1) {
    return { stem: '速度用 v 表示，时间用 t 表示，路程 s 等于什么？（参考：80 × 2 = 160）',
      answer: 's = v × t', options: ['s = v × t', 's = v + t', 's = v − t'],
      apply: '汽车每小时行 v 千米，行了 t 小时（如 80 × 2 = 160），路程 s 用字母怎样表示？' };
  }
  if (name.indexOf('值') !== -1) {
    var a3 = ri(rng, 2, 6), k3 = ri(rng, 2, 5);
    return { stem: '当 a = ' + a3 + ' 时，' + k3 + 'a + 1 = ' + k3 + ' × ' + a3 + ' + 1 = 多少？',
      answer: String(k3 * a3 + 1), options: [String(k3 * a3 + 1), String(k3 * a3), String(a3 + 1)],
      apply: '文具店有 a 盒彩笔，每盒 ' + k3 + ' 支还多 1 支样品。当 a = ' + a3 + ' 时，' + k3 + ' × ' + a3 + ' + 1 = ？，共多少支？' };
  }
  // 用字母表示数
  var d0 = ri(rng, 4, 20);
  return { stem: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁。当 a = 10 时，10 + ' + d0 + ' = 多少，爸爸岁数用字母怎样表示？',
    answer: 'a + ' + d0 + '（岁）', options: ['a + ' + d0, 'a − ' + d0, 'a × ' + d0],
    apply: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁（a = 10 时 10 + ' + d0 + ' = ' + (10 + d0) + '），爸爸的岁数用含字母的式子怎样表示？' };
}

/* g5-down-u02-k003~k006：倍数特征 / 奇偶数 / 质合数 / 和的奇偶性 */
function buildNumberTheoryItem(rng, name) {
  // 和的奇偶性（必须先于「奇数」分支）
  if (name.indexOf('奇偶性') !== -1 || name.indexOf('和的奇偶') !== -1) {
    var patterns = [
      { oddA: true, oddB: true, res: '偶数', rule: '奇数 + 奇数 = 偶数' },
      { oddA: false, oddB: false, res: '偶数', rule: '偶数 + 偶数 = 偶数' },
      { oddA: true, oddB: false, res: '奇数', rule: '奇数 + 偶数 = 奇数' }
    ];
    var pt = patterns[ri(rng, 0, patterns.length - 1)];
    var pa = pt.oddA ? ri(rng, 1, 9) * 2 - 1 : ri(rng, 1, 9) * 2;
    var pb = pt.oddB ? ri(rng, 1, 9) * 2 - 1 : ri(rng, 1, 9) * 2;
    var ps = pa + pb;
    return { stem: pt.rule + '：' + pa + ' + ' + pb + ' = ' + ps + '，' + pa + ' 与 ' + pb + ' 的和是奇数还是偶数？',
      answer: pt.res, options: ['偶数', '奇数', '无法确定'],
      apply: '两队人数分别是 ' + pa + ' 和 ' + pb + '（' + pt.rule + '），' + pa + ' + ' + pb + ' = ' + ps + '，两队合并后的总人数是奇数还是偶数？' };
  }
  // 质数与合数
  if (name.indexOf('质数') !== -1 || name.indexOf('合数') !== -1) {
    var primes = [7, 11, 13, 17, 19];
    var composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
    var pn = primes[ri(rng, 0, primes.length - 1)];
    var pool = composites.slice();
    var d1 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    var d2 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    return { stem: '一个数只有 1 和它本身两个因数就是质数：1 × ' + pn + ' = ' + pn + '。下面哪个数是质数？',
      answer: String(pn), options: [String(pn), String(d1), String(d2)],
      apply: '分糖果时，合数能平均分给多于一个小组（如 3 × 3 = 9），质数不能。糖果数 ' + pn + '（1 × ' + pn + ' = ' + pn + '）能分成人数相同且多于1人的小组吗，它是质数还是合数？' };
  }
  // 奇数与偶数
  if (name.indexOf('奇数') !== -1 || name.indexOf('偶数') !== -1) {
    var en = ri(rng, 2, 24) * 2;
    var askEven = rng() < 0.5;
    if (askEven) {
      return { stem: '2 的倍数是偶数：' + en + ' ÷ 2 = ' + (en / 2) + '。下面哪个数是偶数？',
        answer: String(en), options: [String(en), String(en + 1), String(en + 3)],
        apply: '门牌号按单双号排列，' + en + ' ÷ 2 = ' + (en / 2) + ' 没有余数，' + en + ' 号是奇数还是偶数？' };
    }
    var on = ri(rng, 2, 24) * 2 - 1;
    return { stem: '不是 2 的倍数的数是奇数，如 ' + on + ' ÷ 2 = ' + ((on - 1) / 2) + '……1。下面哪个数是奇数？',
      answer: String(on), options: [String(on), String(on + 1), String(on - 1)],
      apply: '报数时逢双数蹲下，' + on + ' ÷ 2 余 1 不能整除，' + on + ' 号同学该蹲下吗，' + on + ' 是奇数还是偶数？' };
  }
  // 2、5、3 的倍数的特征（默认）
  var feats = [
    { f: 2, text: '个位上是 0、2、4、6、8', build: function () { var x = ri(rng, 6, 49) * 2; return x; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 2 === 0 ? b + 1 : b; } },
    { f: 5, text: '个位上是 0 或 5', build: function () { return ri(rng, 2, 19) * 5; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 5 === 0 ? b + 1 : b; } },
    { f: 3, text: '各位上数字之和是 3 的倍数', build: function () {
        for (var t = 0; t < 30; t++) { var x = ri(rng, 12, 99); var s = Math.floor(x / 10) + x % 10; if (s % 3 === 0) return x; }
        return 12;
      }, bad: function (x) {
        for (var t = 0; t < 30; t++) { var b = ri(rng, 12, 99); var s = Math.floor(b / 10) + b % 10; if (s % 3 !== 0 && b !== x) return b; }
        return x + 1;
      } }
  ];
  var ft = feats[ri(rng, 0, 2)];
  var fn = ft.build();
  var fd1 = ft.bad(fn), fd2 = ft.bad(fn);
  while (fd2 === fd1 || fd2 === fn) fd2 = ft.bad(fn);
  var fsum = Math.floor(fn / 10) + fn % 10;
  var fref = ft.f === 3 ? '（数字和 ' + fsum + '，' + fsum + ' ÷ 3 = ' + (fsum / 3) + '）'
    : '（参考：' + fn + ' ÷ ' + ft.f + ' = ' + (fn / ft.f) + '）';
  return { stem: ft.text + ' 的数是 ' + ft.f + ' 的倍数' + fref + '。下面哪个数是 ' + ft.f + ' 的倍数？',
    answer: String(fn), options: [String(fn), String(fd1), String(fd2)],
    apply: '体育分组每组 ' + ft.f + ' 人正好分完，人数须是 ' + ft.f + ' 的倍数。班级人数 ' + fn + fref + '，哪个班能正好分完？' };
}

/** 统一按题型包装 item（calc 直接用 stem；fill 补空位；choice 取 options；apply 取情境题干） */
function makeByItem(plan, context, i, builder, subType) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var params = plan.semanticParams || {};
  var item = builder(rng, params.name || '');
  var qt = plan.questionTypeId;
  // item.operation 透传为 data.operation（仅 composition 项提供 'add'，承载 calc expressionPresent）
  var q = buildBase(plan, context, i, { subType: subType, operation: item.operation });
  var stem = item.stem, answer = item.answer;
  if (qt === 'apply') stem = item.apply || item.stem;
  if (qt === 'fill') {
    if (item.fill) {
      stem = item.fill;  // builder 专用填空形式（多问句机械替换不可靠）
    } else {
      stem = stem.replace('多少？', '____').replace('什么？', '____').replace('？', '____');
      if (!/____|\(\s*\)/.test(stem)) stem += ' ____';
    }
  }
  if (qt === 'choice') {
    finishChoice(q, rng, item.answer, item.options.filter(function (o) { return o !== item.answer; }));
    q.prompt = stem;
    return q;
  }
  return finish(q, stem, answer, [answer], stem.replace(/（参考.*?）/, ''));
}

function makeNumberConcept(plan, context, i) { return makeByItem(plan, context, i, buildNumberConceptItem, 'number-concept'); }
function makeNegativeNumber(plan, context, i) { return makeByItem(plan, context, i, buildNegativeItem, 'negative-number'); }
function makeMultDivRelation(plan, context, i) { return makeByItem(plan, context, i, buildMultDivRelationItem, 'multdiv-relation'); }
function makeAlgebraLetter(plan, context, i) { return makeByItem(plan, context, i, buildAlgebraLetterItem, 'algebra-letter'); }
function makeNumberTheory(plan, context, i) { return makeByItem(plan, context, i, buildNumberTheoryItem, 'number-theory'); }

var P25_09_SUBTOPIC_QTS = ['calc', 'fill', 'apply', 'choice'];
function bindP2509(fn) {
  var row = {};
  P25_09_SUBTOPIC_QTS.forEach(function (qt) { row[qt] = fn; });
  return row;
}

/* ================================================================
 * subTopic × 题型 分派（键 = SemanticParameters.subTopic；覆盖 4 KP 的全部 ALLOW 行）
 * ================================================================ */

var SUBTOPIC_MAKERS = {
  'times-concept': { calc: makeTimesCalc, fill: makeTimesFill, apply: makeTimesApply, choice: makeTimesChoice },
  'fraction-meaning': { calc: makeFractionCalc, fill: makeFractionFill, apply: makeFractionApply, choice: makeFractionChoice },
  'angle-concept': { fill: makeAngleFill, apply: makeAngleApply, choice: makeAngleChoice, geometry: makeAngleGeometry, judge: makeAngleJudge },
  'area-concept': { fill: makeAreaFill, apply: makeAreaApply, choice: makeAreaChoice, geometry: makeAreaGeometry, judge: makeAreaJudge },
  // P25-09
  'number-concept': bindP2509(makeNumberConcept),
  'negative-number': bindP2509(makeNegativeNumber),
  'multdiv-relation': bindP2509(makeMultDivRelation),
  'algebra-letter': bindP2509(makeAlgebraLetter),
  'number-theory': bindP2509(makeNumberTheory)
};

/** 取本 plan 的语义参数：优先 selector 注入；缺省时即时派生（直连调用方/单测兜底，同一 SSOT） */
function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
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
      var params = paramsOf(plan);
      var row = params ? SUBTOPIC_MAKERS[params.subTopic] : null;
      var maker = row && row[plan.questionTypeId];
      // fail-closed：语义参数缺失或该 subTopic×题型无 maker → 不产出，禁止猜测兜底
      if (!maker) return [];
      var out = [];
      for (var i = 0; i < count; i++) out.push(maker(plan, context, i));
      return SemanticEvidence.attachAll(VariationApply.applyToAll(out, plan), plan);
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
