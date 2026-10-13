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

// P40-Q-11：KP definition 只读消费——plan.semanticParams.definition 经 SemanticParameters
// resolve 投影（T3 semantic.concept = canonical definition 逐字镜像，name 兜底形态已置 null）。
// 未附 semanticParams / definition 缺失 → null，生成器不编造定义，回退既有诚实解析形态。
function defOf(plan) {
  var sp = plan && plan.semanticParams;
  return (sp && typeof sp.definition === 'string' && sp.definition) ? sp.definition : null;
}

/** definition 逐字引用拼接（原文照抄；末尾无句读时补句号，衔接后续本题应用句） */
function citeDef(def) {
  return def + (/[。！？]$/.test(def) ? '' : '。');
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
  // P32-AS-11 契约 A：acceptable 只许「与 value 不同的标量语义等价答案」
  //（如 2/两、甲/图形甲）。本文件历史上大量 maker 把 value 原样复制进 acceptable
  //（含 judge 的 boolean 复制），在装配口统一剔除；真等价（字符串不同）保留。
  var valueKey = String(answer);
  q.answer = {
    value: answer,
    acceptable: (Array.isArray(acceptable) ? acceptable : []).filter(function (x) {
      return (typeof x === 'string' || typeof x === 'number') && String(x) !== valueKey;
    }),
    explanation: explanation || null
  };
  return q;
}

/** 选择题收尾：options 洗牌 + correctIndex + 答案为正确选项文本（与 selection.js 契约一致） */
function finishChoice(q, rng, correct, wrongs, explanation, provenance) {
  var seen = {}, pool = [];
  [correct].concat(wrongs).forEach(function (o) {
    o = String(o);
    if (!seen[o]) { seen[o] = 1; pool.push(o); }
  });
  // P34-04：凑位选项用中性固定短语（正确项必在池内，两短语恒为假命题），
  // 取代「都不是（3）」式编号占位文案；保持去重，两短语耗尽即止（4 项去重最少 2 项，必够）
  var FILLERS = ['以上说法都不对', '以上都对'];
  while (pool.length < 4) {
    var filler = null;
    for (var fi = 0; fi < FILLERS.length; fi++) {
      if (!seen[FILLERS[fi]]) { filler = FILLERS[fi]; break; }
    }
    if (!filler) break;
    seen[filler] = 1; pool.push(filler);
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  // P40-Q-05：干扰项迷思溯源（可选；传入的 provenance 须与 wrongs 一一对应，
  // 被去重/截断剔除的项同步剔除，保证溯源 expr ⊆ data.options）
  if (Array.isArray(provenance)) {
    q.data.distractors = provenance.filter(function (p) {
      return p && options.indexOf(String(p.expr)) !== -1 && String(p.expr) !== String(correct);
    });
  }
  return finish(q, q.prompt, String(correct), [], explanation || null);
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
  var nr = nrOf(plan);
  var base = riC(rng, 2, 9, nr);
  var times = riC(rng, 2, 5, nr);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, '列式计算：' + base + ' 的 ' + times + ' 倍是多少？', String(ans), [String(ans)],
    base + ' 的 ' + times + ' 倍：' + '求一个数的几倍是多少，用乘法：' + base + ' × ' + times + ' = ' + ans + '（' + times + ' 份，每份 ' + base + '）');
}

function makeTimesFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var base = riC(rng, 2, 9, nr);
  var times = riC(rng, 2, 5, nr);
  var ans = base * times;
  var q = buildBase(plan, context, i, timesData(base, times));
  return finish(q, '求一个数的几倍是多少，用乘法计算：' + base + ' × ' + times + ' = ____', String(ans), [String(ans)],
    '求一个数的几倍是多少，用乘法：' + base + ' × ' + times + ' = ' + ans);
}

function makeTimesApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var base = riC(rng, 3, 9, nr);
  var times = riC(rng, 2, 4, nr);
  var ans = base * times;
  var item = Rng.pick(rng, ['根小棒', '朵红花', '颗星星', '只纸鹤']);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  return finish(q, '第一行摆了 ' + base + ' ' + item + '，第二行摆的数量是第一行的 ' + times + ' 倍。第二行摆了多少' + item + '？',
    String(ans), [String(ans)], '求一个数的几倍是多少，用乘法：' + base + ' × ' + times + ' = ' + ans);
}

function makeTimesChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var base = riC(rng, 3, 9, nr);
  var times = riC(rng, 2, 5, nr);
  var q = buildBase(plan, context, i, { subType: 'times', operation: 'mult', timesRelation: 'times-of', base: base, times: times });
  q.prompt = '下面哪个算式表示「' + base + ' 的 ' + times + ' 倍」？（  ）';
  var correctExpr = base + ' × ' + times;
  // P40-Q-05：迷思桥——按 KP 错误谱构造干扰（#28 修复）：
  //   口诀混淆 → 倍数错位乘式 base×(times±1)；概念混淆/符号错误 → 倍除混淆 base÷times；
  //   计算错误/步骤错误/无素材 → 既有乘加混淆雏形（adjacent-fallback 诚实降级）。
  var miscons = (plan.semanticParams && Array.isArray(plan.semanticParams.miscons))
    ? plan.semanticParams.miscons : [];
  var wrongs = [], provenance = [];
  function addW(expr, et, src) {
    if (wrongs.indexOf(expr) !== -1 || expr === correctExpr || wrongs.length >= 3) return;
    wrongs.push(expr);
    provenance.push({ expr: expr, errorType: et || null, source: src });
  }
  for (var m = 0; m < miscons.length; m++) {
    var et = miscons[m] && miscons[m].errorType;
    if (et === '口诀混淆') {
      if (times + 1 <= 9) addW(base + ' × ' + (times + 1), et, 'misconception');
      if (times - 1 >= 2) addW(base + ' × ' + (times - 1), et, 'misconception');
    } else if (et === '概念混淆' || et === '符号错误') {
      if (base % times === 0) addW(base + ' ÷ ' + times, et, 'misconception');
    }
  }
  addW(base + ' + ' + times, null, 'adjacent-fallback');
  addW(base + ' − ' + times, null, 'adjacent-fallback');
  addW(times + ' − ' + base, null, 'adjacent-fallback');
  return finishChoice(q, rng, correctExpr, wrongs,
    '「' + base + ' 的 ' + times + ' 倍」就是 ' + times + ' 个 ' + base + '，用乘法表示为 '
      + correctExpr + '，正确选项是「' + correctExpr + '」。', provenance);
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
  var nr = nrOf(plan);
  var den = riC(rng, 4, 9, nr);
  var ans = '1/' + den;
  var q = buildBase(plan, context, i, fractionData(true, den, 1));
  return finish(q, '列式计算：把单位“1”平均分成 ' + den + ' 份，每份是单位“1”的几分之几？', ans, [ans],
    '平均分用除法：1 ÷ ' + den + ' = ' + ans + '（每份就是分数单位 1/' + den + '）');
}

function makeFractionFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var den = riC(rng, 4, 9, nr);
  var num = riC(rng, 2, Math.max(2, den - 1), nr);
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
  var nr = nrOf(plan);
  var den = riC(rng, 5, 9, nr);
  var num = riC(rng, 2, Math.max(2, den - 1), nr);
  var q = buildBase(plan, context, i, fractionData(false, den, num));
  q.prompt = '下面哪个分数的分数单位是 1/' + den + '？（  ）';
  var fracAns = num + '/' + den;
  return finishChoice(q, rng, fracAns,
    ['1/' + (den + 1), '2/' + (den + 2), '3/' + (den + 3)],
    '一个分数的分数单位由分母决定：分母是几，分数单位就是几分之一；' + fracAns + ' 的分母是 '
      + den + '，分数单位是 1/' + den + '，正确选项是「' + fracAns + '」。');
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
  // P38 断链修复：角的结构配图（顶点 + 两条边），不标角度（结构认知非度量）
  q.data.graphic = {
    type: 'geometry', subtype: 'angle', role: 'auxiliary',
    params: { angle: 50, rayLength: 2, unitPx: 26, labelAngle: false }
  };
  return finish(q, '一个角有 1 个顶点和 ____ 条边。', '2', ['2', '两'],
    '角由一个顶点和两条边（射线）组成');
}

function makeAngleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var shape = Rng.pick(rng, [['三角形', 3], ['红领巾', 3], ['五角星贴纸', 5], ['正方形', 4]]);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-count' });
  // P38 断链修复：按题设形状配原材料图（不标角数/边长，数角为考点）
  var g;
  if (shape[0] === '五角星贴纸') {
    g = { type: 'geometry', subtype: 'star', role: 'auxiliary', params: { size: 2, unitPx: 26 } };
  } else if (shape[0] === '正方形') {
    g = { type: 'geometry', subtype: 'square', role: 'auxiliary', params: { size: 2, unitPx: 26, labelSides: false, rightAngle: false } };
  } else if (shape[0] === '红领巾') {
    g = { type: 'geometry', subtype: 'triangle', role: 'auxiliary', params: { p1: [0, 0], p2: [4, 0], p3: [0.8, 0.9], unitPx: 26 } };
  } else {
    g = { type: 'geometry', subtype: 'triangle', role: 'auxiliary', params: { p1: [0, 0], p2: [3, 0], p3: [1.5, 2], unitPx: 26 } };
  }
  q.data.graphic = g;
  return finish(q, '观察一块' + shape[0] + '形状的纸板：上面有几个角？', String(shape[1]), [String(shape[1])],
    shape[0] + '有 ' + shape[1] + ' 个角');
}

function makeAngleChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-definition' });
  q.prompt = '下面哪个说法正确地描述了“角”？（  ）';
  // P38 断链修复：角的定义配图（顶点 + 两条射线）
  q.data.graphic = {
    type: 'geometry', subtype: 'angle', role: 'auxiliary',
    params: { angle: 50, rayLength: 2, unitPx: 26, labelAngle: false }
  };
  var angleDef = '从一点引出两条射线所组成的图形';
  // P40-Q-11：解析引用 KP definition 逐字原文（T2 已有「角的定义是…」手写复述非逐字，
  // 换为 semanticParams.definition 逐字镜像；definition 缺失回退既有诚实形态）
  var adef = defOf(plan);
  return finishChoice(q, rng, angleDef,
    ['两条线段组成的图形', '一条直线上的两个点', '由三条边围成的图形'],
    adef
      ? '依据定义：' + citeDef(adef) + '这一点是顶点，两条射线是角的两条边，正确选项是「' + angleDef + '」。'
      : '角的定义是从一点引出两条射线所组成的图形，这一点是顶点、两条射线是角的两条边，正确选项是「' + angleDef + '」。');
}

function makeAngleGeometry(plan, context, i) {
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-size-vs-edge' });
  // P38 断链修复：观察对象配图（一个角，不标角度——角的大小与边长无关为考点）
  q.data.graphic = {
    type: 'geometry', subtype: 'angle', role: 'auxiliary',
    params: { angle: 50, rayLength: 2, unitPx: 26, labelAngle: false }
  };
  return finish(q, '观察一个角：把它的两条边画得更长，这个角的大小 ____。（填“变大”“变小”或“不变”）',
    '不变', ['不变'],
    // P40-Q-11：geometry 图形特征腿——「依据：〈图形特征〉。所以〈本题结论〉」
    '依据：角的大小只与两边张开的程度有关，与边的长短无关。所以把两条边画得更长，角的大小不变');
}

function makeAngleJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // P40-Q-11：judge 解析统一「判断依据：〈依据〉。〈结论〉」模板——定义判断项引用
  // KP definition 逐字原文（旧手写「就是角」非逐字）；性质项以性质本身为依据，不引定义。
  var adef = defOf(plan);
  var items = [
    {
      text: '角的两条边越长，这个角就越大。', value: false,
      explanation: '判断依据：角的大小只与两边张开的程度有关，与边的长短无关。边画得再长角也不会变大，说法错误。',
      misconception: '误认为角的大小由边的长短决定：角的大小只取决于两边张开的程度。'
    },
    {
      text: '一个角有一个顶点和两条边。', value: true,
      explanation: adef
        ? '判断依据：' + citeDef(adef) + '题中说法与定义一致，说法正确。'
        : '角由一个顶点和从这个顶点引出的两条边组成，说法正确。'
    },
    {
      text: '从一点引出两条射线所组成的图形叫做角。', value: true,
      explanation: adef
        ? '判断依据：' + citeDef(adef) + '题中说法与定义一致，说法正确。'
        : '这是角的定义：从一点引出两条射线所组成的图形就是角，说法正确。'
    }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'angle-observe', topic: 'angle-concept', statement: s.text, shownResult: s.value ? '对' : '错' });
  q.answerMode = 'judge'; // P32-AS-12：陈述判断为原生判断题，answerMode 不得沿用 input 默认值
  if (s.misconception) q.data.misconception = s.misconception;
  // P38 断链修复：判断主张的观察材料配图（一个角）；judge 答案为 boolean，图形仅作主张材料
  q.data.graphic = {
    type: 'geometry', subtype: 'angle', role: 'auxiliary',
    params: { angle: 50, rayLength: 2, unitPx: 26, labelAngle: false }
  };
  return finish(q, '判断对错：' + s.text + '（  ）', s.value, [s.value], s.explanation);
}

/* ================================================================
 * g3 面积的认识 — KBL：物体表面或封闭图形的大小
 * ================================================================ */

/** P38 断链修复：面积格子阵列（每行最多 5 格，逐行填充，末行可不满） */
function gridOf(n) {
  var cols = Math.min(5, n), rows = Math.ceil(n / cols), grid = [];
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < cols; c++) row.push(r * cols + c < n ? 1 : 0);
    grid.push(row);
  }
  return grid;
}

function makeAreaFill(plan, context, i) {
  var q = buildBase(plan, context, i, {
    subType: 'area-concept',
    quantityKind: 'area',
    semanticEvidence: {
      relations: ['area-surface'],
      constructs: ['surface', 'size']
    }
  });
  // P38 断链修复：封闭图形表面示意（不标边长——概念认知非度量）
  q.data.graphic = {
    type: 'geometry', subtype: 'rectangle', role: 'auxiliary',
    params: { width: 3, height: 2, unitPx: 26, labelSides: false, rightAngle: false }
  };
  // P40-Q-11：definition 逐字引用（旧手写「叫作面积」为编造尾巴，非 canonical 原文）
  var adef = defOf(plan);
  return finish(q, '测量或比较图形表面的大小，要用 ____ 单位。', '面积', ['面积'],
    adef
      ? '依据定义：' + citeDef(adef) + '这个量就是面积，所以测量、比较表面大小要用面积单位，空格填面积'
      : '物体表面或封闭图形的大小叫作面积，所以测量、比较表面大小要用面积单位，空格填面积');
}

function makeAreaApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var n = Rng.pick(rng, [6, 8, 10, 12, 15]);
  var q = buildBase(plan, context, i, { subType: 'area-measure', quantityKind: 'area', unitSquares: n });
  // P38 断链修复：铺满过程可视化（题面已知量 n 的格子阵列，无文字标注；
  // 铺满计数与面积同源为面积定义本身，AS-16C #2 既有裁决口径）
  q.data.graphic = {
    type: 'geometry', subtype: 'view-cards', role: 'auxiliary',
    params: { views: [{ direction: '', grid: gridOf(n) }], unitPx: 20 }
  };
  return finish(q, '用 1 平方分米的小正方形去铺一张卡片，正好铺满了 ' + n + ' 个。这张卡片的面积是多少平方分米？',
    String(n), [String(n)], '面积就是包含的面积单位的个数：' + n + ' 个 1 平方分米 = ' + n + ' 平方分米');
}

function makeAreaChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area' });
  q.prompt = '下面哪个是面积单位？（  ）';
  // P38 断链修复：面的大小示意（不标边长——概念认知非度量）
  q.data.graphic = {
    type: 'geometry', subtype: 'rectangle', role: 'auxiliary',
    params: { width: 3, height: 2, unitPx: 26, labelSides: false, rightAngle: false }
  };
  // P40-Q-11：definition 逐字引用前缀（定义→单位应用连接），缺失回退既有形态
  var adef = defOf(plan);
  return finishChoice(q, rng, '平方厘米', ['厘米', '千克', '秒'],
    (adef ? '依据定义：' + citeDef(adef) : '')
      + '面积单位用来计量面的大小，平方厘米是面积单位；厘米是长度单位、千克是质量单位、秒是时间单位，正确选项是「平方厘米」。');
}

function makeAreaGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  // P38-05 修复：原 winner=Rng.pick 随机选但 b≤a-2 恒小于 a → 选乙时答案数学错误（60%）；
  // 改为 a/b 同范围随机、避免相等，winner 取面积大者（格数多者），答案恒正确。
  var a = riC(rng, 4, 9, nr);
  var b = riC(rng, 4, 9, nr);
  while (b === a) b = riC(rng, 4, 9, nr);
  var winner = a > b ? ['甲', a] : ['乙', b];
  var q = buildBase(plan, context, i, { subType: 'area-compare', quantityKind: 'area', gridA: a, gridB: b });
  // P38 断链修复：甲/乙格子阵列同尺寸并排（数格比大小为考点，标签为题面材料非答案内容）
  q.data.graphic = {
    type: 'geometry', subtype: 'view-cards', role: 'auxiliary',
    params: {
      views: [{ direction: '甲', grid: gridOf(a) }, { direction: '乙', grid: gridOf(b) }],
      unitPx: 16
    }
  };
  return finish(q, '用同样大的小方格去量两个图形：甲用了 ' + a + ' 个，乙用了 ' + b + ' 个。哪个图形的面积大？（填“甲”或“乙”）',
    winner[0], [winner[0], '图形' + winner[0]],
    // P40-Q-11：geometry 图形特征腿——「依据：〈图形特征〉。所以〈本题结论〉」
    '依据：小方格同样大时，占的格子越多面积越大。' + winner[0] + ' 用了 ' + winner[1] + ' 个，所以面积最大的是' + winner[0]);
}

function makeAreaJudge(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // P40-Q-11：judge 统一「判断依据」模板；定义判断项引用 canonical definition 逐字原文
  //（旧手写「叫做它们的面积」为编造尾巴），性质项以性质本身为依据。
  var adef = defOf(plan);
  var items = [
    {
      text: '黑板面的大小就是黑板面的面积。', value: true,
      explanation: adef
        ? '判断依据：' + citeDef(adef) + '黑板面的大小就是黑板面的面积，说法正确。'
        : '物体表面的大小就是这个面的面积，黑板面的大小就是黑板面的面积，说法正确。'
    },
    {
      text: '1 平方米比 1 米大。', value: false,
      explanation: '判断依据：平方米是面积单位，米是长度单位，两者计量的量不同，不能比较大小，说法错误。',
      misconception: '面积单位与长度单位混淆：不同类的计量单位之间不能比较大小。'
    },
    {
      text: '物体表面或封闭图形的大小叫做它们的面积。', value: true,
      explanation: adef
        ? '判断依据：' + citeDef(adef) + '题中说法与定义一致，说法正确。'
        : '这是面积的定义：物体表面或封闭图形的大小叫做它们的面积，说法正确。'
    }
  ];
  var s = Rng.pick(rng, items);
  var q = buildBase(plan, context, i, { subType: 'area-concept', quantityKind: 'area', statement: s.text, shownResult: s.value ? '对' : '错' });
  q.answerMode = 'judge'; // P32-AS-12：陈述判断为原生判断题，answerMode 不得沿用 input 默认值
  if (s.misconception) q.data.misconception = s.misconception;
  // P38 断链修复：封闭图形观察材料配图（不标边长）；judge 答案为 boolean，图形仅作主张材料
  q.data.graphic = {
    type: 'geometry', subtype: 'rectangle', role: 'auxiliary',
    params: { width: 3, height: 2, unitPx: 26, labelSides: false, rightAngle: false }
  };
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

/* P35-DEBT-1：难度执行端消费——用语义边界 [lo,hi] 与 plan.constraints.numberRange 取交集，
 * 让数值范围随难度分化；语义边界仍为硬地板/天花板，numberRange 在此范围内伸缩。 */
function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
}
function riC(rng, lo, hi, range) {
  var min = Math.max(lo, range.min);
  var max = Math.min(hi, range.max);
  if (min > max) { min = lo; max = hi; }
  return ri(rng, min, max);
}

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

function buildCompositionItem(rng, name, nr) {
  var t = riC(rng, 1, 9, nr), o = riC(rng, 1, 9, nr);
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

function buildNumberConceptItem(rng, name, nr) {
  // P28-FIX6：g1-down-u03-k001「数数」——一个一个地数/十个十个地数，10个一是十、10个十是一百
  // （数=逐次加一/加十，operation 如实标 add 并内嵌加法参考式，承载 calc expressionPresent）
  if (name.indexOf('数数') !== -1) {
    if (rng() < 0.5) {
      var ct = riC(rng, 2, 10, nr);
      var tensTotal = ct * 10;
      // P32-AS-16：参考式含完整得数（…= tensTotal），删得数保留加法支架（末步 = ？），
      // 同时满足 calc expressionPresent（type-contract 要求题面含可求值算式）。
      var tensExpr;
      if (ct <= 6) {
        tensExpr = [];
        for (var kt = 0; kt < ct; kt++) tensExpr.push('10');
        tensExpr = tensExpr.join(' + ') + ' = ？';
      } else {
        tensExpr = ((ct - 1) * 10) + ' + 10 = ？';
      }
      return { stem: '十个十个地数：数 ' + ct + ' 次是多少？（' + tensExpr + '）',
        answer: String(tensTotal), options: [String(tensTotal), String(tensTotal + 10), String(tensTotal - 10)],
        apply: '一捆小棒 10 根，' + ct + ' 捆小棒十个十个地数，' + ct + ' 个十是多少根？',
        operation: 'add' };
    }
    var co = riC(rng, 2, 9, nr);
    var onesExpr;
    if (co <= 5) {
      onesExpr = [];
      for (var ko = 0; ko < co; ko++) onesExpr.push('1');
      onesExpr = onesExpr.join(' + ') + ' = ？';
    } else {
      onesExpr = (co - 1) + ' + 1 = ？';
    }
    return { stem: '一个一个地数：' + co + ' 个一是多少？（' + onesExpr + '）',
      answer: String(co), options: [String(co), String(co + 1), String(co + 10)],
      apply: '数小棒，一根一根地数，数了 ' + co + ' 根，' + co + ' 个一是多少根？',
      operation: 'add' };
  }
  // P28-FIX6：g1-up-u04-k001「11—20数的认识」——素材限定 11~19（1 个十和几个一）
  if (name.indexOf('11—20') !== -1 || name.indexOf('11-20') !== -1 ||
      name.indexOf('11～20') !== -1 || name.indexOf('11~20') !== -1) {
    var o2 = riC(rng, 1, 9, nr);
    var n2 = 10 + o2;
    if (rng() < 0.5) {
      return { stem: n2 + ' 里面有几个十和几个一？（10 + ' + o2 + ' = ？）',
        answer: '1 个十和 ' + o2 + ' 个一',
        options: ['1 个十和 ' + o2 + ' 个一', o2 + ' 个十和 1 个一', n2 + ' 个十'],
        apply: '摆小棒表示 ' + n2 + '，要摆 1 捆（10 根）零几根？' };
    }
    // P32-AS-16：删括号内完整算式（10 + o2 = n2 直接写出写作结果），珠数组成保留；
    // 支架式末步改「= ？」继续承载 calc expressionPresent。
    return { stem: '计数器十位 1 颗珠、个位 ' + o2 + ' 颗珠（1 个十和 ' + o2 + ' 个一，10 + ' + o2 + ' = ？），这个数写作多少？',
      answer: String(n2), options: [String(n2), String(1 + o2), String(o2 * 10 + 1)],
      apply: '数一数：十位拨 1 颗、个位拨 ' + o2 + ' 颗，1 个十和 ' + o2 + ' 个一合起来写作多少？' };
  }
  // P25-09：g1-up-u01-k001「1-5数的认识」——素材必须限定在 1~5，
  // 不能落默认分支的两位数（off-grade）；n∈2..5 保证 n−1 ≥ 1。
  if (name.indexOf('1-5') !== -1 || name.indexOf('1～5') !== -1) {
    var n5 = riC(rng, 2, 5, nr);
    return { stem: '数一数：' + n5 + ' 前面一个数是多少？（' + n5 + ' − 1 = ？）',
      answer: String(n5 - 1), options: [String(n5 - 1), String(n5), String(n5 + 1)],
      // P40-Q-03（#8）：choice 不再回退空壳「下面哪个选项正确」——独立设问
      // 「前面有 X 人」承载序数推理（前面人数 + 1 = 报数），与 stem/apply 骨架互异。
      choice: '排队报数，小明前面有 ' + (n5 - 2) + ' 人，小明报几？',
      apply: '排队报数，小明报 ' + n5 + '，他前面一个同学报几？' };
  }
  if (name.indexOf('百数表') !== -1) {
    var x0 = riC(rng, 12, 88, nr);
    return { stem: '百数表中，' + x0 + ' 右边一个数是多少？（' + x0 + ' + 1 = ？）',
      answer: String(x0 + 1), options: [String(x0 + 1), String(x0 + 10), String(x0 - 1)],
      apply: '在百数表（每行10个数）里圈出 ' + x0 + '，它右边一格的数是多少？（' + x0 + ' + 1 = ？）' };
  }
  if (name.indexOf('近似') !== -1 || name.indexOf('改写') !== -1) {
    var n0 = riC(rng, 2, 8, nr) * 10000;
    return { stem: '把 ' + n0 + ' 改写成用「万」作单位的数：' + n0 + ' = ' + (n0 / 10000) + ' × 10000，等于多少万？',
      answer: String(n0 / 10000) + '万', options: [n0 / 10000 + '万', n0 / 1000 + '万', n0 + '万'],
      fill: '' + n0 + ' = ____ 万',
      apply: '某城市人口约 ' + n0 + ' 人，' + n0 + ' = ' + (n0 / 10000) + ' × 10000，改写成用万作单位是多少万人？' };
  }
  if (name.indexOf('亿') !== -1) {
    return { stem: '10 个一千万是多少？（10 × 10000000 = 100000000）',
      answer: '一亿', options: ['一亿', '一千万', '一百万'],
      apply: '计数器上一千万一千万地数，数 10 次（10 × 10000000 = 100000000），得到的新计数单位是什么？' };
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
    var tens = riC(rng, 1, 9, nr), ones = riC(rng, 1, 9, nr);
    var num0 = tens * 10 + ones;
    return { stem: num0 + ' 中数字 ' + tens + ' 在什么位上？（参考：' + tens + ' 个十和 ' + ones + ' 个一，' + (tens * 10) + ' + ' + ones + ' = ' + num0 + '）',
      answer: '十位', options: ['十位', '个位', '百位'],
      // P40-Q-03（#85/#88）：choice 不再回退空壳问句（独立设问，数字位值语境与 apply 计数器语境互异）；
      // fill 不再走 extractSupport 错位分支（原「80 + 2 = ____」配答案「十位」）——
      // 专用 fill 问数的组成求值，fillAnswer 走分型答案机制（与 buildNegativeItem 同型）。
      choice: '有一个数是 ' + num0 + '（' + tens + ' 个十和 ' + ones + ' 个一），数字 ' + tens + ' 在哪一位上？',
      fill: tens + ' 个十和 ' + ones + ' 个一，' + (tens * 10) + ' + ' + ones + ' = ____',
      fillAnswer: String(num0),
      apply: '计数器拨出 ' + num0 + '（' + tens + ' 个十和 ' + ones + ' 个一，' + (tens * 10) + ' + ' + ones + ' = ' + num0 + '），' + tens + ' 拨在哪一位上？' };
  }
  if (name.indexOf('顺序') !== -1 || name.indexOf('相邻') !== -1) {
    var cur = riC(rng, 11, 88, nr);
    return { stem: '与 ' + cur + ' 相邻的两个数是多少？（参考：' + cur + ' − 1 = ' + (cur - 1) + '）',
      answer: (cur - 1) + ' 和 ' + (cur + 1), options: [(cur - 1) + ' 和 ' + (cur + 1), cur + ' 和 ' + (cur + 1), (cur - 1) + ' 和 ' + cur],
      apply: '发牌时数到 ' + cur + '，它前一个是 ' + (cur - 1) + '（' + cur + ' − 1 = ' + (cur - 1) + '），后一个数是多少？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a0 = riC(rng, 12, 98, nr), b0 = a0 + riC(rng, 1, 9, nr) * (rng() < 0.5 ? 1 : -1);
    if (b0 <= 10) b0 = a0 + 5;
    return { stem: '比较大小：' + Math.min(a0, b0) + ' ○ ' + Math.max(a0, b0) + '（参考：' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '）',
      answer: '<', options: ['>', '<', '='],
      apply: '一年级有 ' + Math.min(a0, b0) + ' 人，二年级有 ' + Math.max(a0, b0) + ' 人，' + Math.max(a0, b0) + ' − ' + Math.min(a0, b0) + ' = ' + Math.abs(a0 - b0) + '，哪个年级人数多（填 > 或 <）？' };
  }
  if (name.indexOf('组成') !== -1) {
    // P28-COMPOSITION-DIVERSIFY-01：纯代码多样化生成（正向/逆向 × 问答/填空/6类语境），
    // 题干不再内嵌答案；详见 buildCompositionItem。
    return buildCompositionItem(rng, name, nr);
  }
  if (name.indexOf('算盘') !== -1) {
    // P25-09：算盘认数（g2-down-u04-k004）——一个上珠表示5、一个下珠表示1
    var abPick = rng();
    if (abPick < 0.34) {
      return { stem: '算盘上一个上珠靠梁表示几？（1 × 5 = ？）',
        answer: '5', options: ['5', '1', '10'],
        apply: '在算盘上拨数，1 个上珠靠梁，它表示数字几？' };
    }
    if (abPick < 0.67) {
      return { stem: '算盘上一个下珠靠梁表示几？（1 × 1 = ？）',
        answer: '1', options: ['1', '5', '10'],
        apply: '在算盘上拨数，1 个下珠靠梁，它表示数字几？' };
    }
    // P32-AS-16：删参考式得数 52（直接给出所表示的数），支架式保留「= ？」承载 expressionPresent；
    // apply 保留「5 × 10 + 2 = ？」问式支架
    return { stem: '算盘的十位上1个上珠靠梁、个位上2个下珠靠梁，表示的数是多少？（5 × 10 + 2 = ？）',
      answer: '52', options: ['52', '25', '70'],
      apply: '算盘十位1个上珠靠梁表示5个十，个位2个下珠靠梁表示2个一，5 × 10 + 2 = ？，表示的数是多少？' };
  }
  // 读写/认识（默认）
  // FINAL-139：同上，计数器位值用「几个十和几个一」+ 整十数加一位数，不用 ×10
  var t1 = riC(rng, 1, 9, nr), o1 = riC(rng, 1, 9, nr);
  // P32-AS-16：删括号内完整算式（t1×10 + o1 = 结果直接写出写作答案），珠数组成保留；
  // 支架式保留「整十数 + 一位数 = ？」承载 expressionPresent
  return { stem: '计数器十位 ' + t1 + ' 颗珠、个位 ' + o1 + ' 颗珠（' + t1 + ' 个十和 ' + o1 + ' 个一，' + (t1 * 10) + ' + ' + o1 + ' = ？），写作多少？',
    answer: String(t1 * 10 + o1), options: [String(t1 * 10 + o1), String(t1 + o1), String(o1 * 10 + t1)],
    apply: '数一数：十位拨 ' + t1 + ' 颗、个位拨 ' + o1 + ' 颗，' + t1 + ' 个十和 ' + o1 + ' 个一合起来写作多少？' };
}

// P28-FIX6：g1-up-u05-k001「凑十法」——拆小数凑十再算（题面是加法，operation 如实标 add；
// KP semantic.operations=[]，attach 会把关系过滤为空，不产生越界声明）
function buildMakeTenItem(rng, name, nr) {
  var a = riC(rng, 8, 9, nr);
  var need = 10 - a;
  var b = riC(rng, need + 1, 9, nr);
  var rest = b - need;
  var sum = a + b;
  // P32-AS-16：删括号内「10 + rest = sum」末步得数；分解式保留（最终 = ？ 承担求答）
  return { stem: '用凑十法计算：' + a + ' + ' + b + ' = ' + a + ' + ' + need + ' + ' + rest + ' = ？（先把 ' + a + ' 凑成 10，再算 10 + ' + rest + '）',
    answer: String(sum), options: [String(sum), String(sum - 1), String(sum + 1)],
    fill: '凑十法最后一步：10 + ' + rest + ' = ____',
    apply: '小兔采蘑菇，上午采 ' + a + ' 个、下午采 ' + b + ' 个。用凑十法：' + a + ' + ' + b + ' = ' + a + ' + ' + need + ' + ' + rest + '，一共采了多少个？',
    operation: 'add' };
}

// P28-FIX6：g3-up-u02-k003「有括号运算顺序」——先算小括号里面的，再算括号外面的
function buildBracketOrderItem(rng, name, nr) {
  var x = riC(rng, 2, 9, nr), y = riC(rng, 2, 9, nr), z = riC(rng, 2, 5, nr);
  var inner = x + y;
  var ans = inner * z;
  return { stem: '先算小括号里面的：(' + x + ' + ' + y + ') × ' + z + ' = ' + inner + ' × ' + z + ' = ？（先算 ' + x + ' + ' + y + ' = ' + inner + '）',
    answer: String(ans), options: [String(ans), String(x + y * z), String(ans - z)],
    fill: '小括号内先求和，再乘 ' + z + '，最后结果是 ____',
    apply: '商店上午卖出 ' + x + ' 个、下午卖出 ' + y + ' 个气球，每个气球 ' + z + ' 元。先算一共卖出多少个，再算卖了多少元：(' + x + ' + ' + y + ') × ' + z + ' = ？元',
    operation: 'mixed' };
}

// P28-FIX6：g3-up-u02-k004「脱式计算规范」——等号上下对齐，一步一计算，不跳步
function buildStepwiseItem(rng, name, nr) {
  var a = riC(rng, 12, 49, nr), b = riC(rng, 11, 39, nr);
  var s1 = a + b;
  var c = riC(rng, 2, Math.max(2, s1 - 1), nr);
  var ans = s1 - c;
  return { stem: '按脱式计算规范一步一步算：' + a + ' + ' + b + ' − ' + c + ' = ' + s1 + ' − ' + c + ' = ？（第一步 ' + a + ' + ' + b + ' = ' + s1 + '）',
    answer: String(ans), options: [String(ans), String(s1), String(a + b + c)],
    fill: '脱式计算：先算加法再算减法，最后得数是 ____',
    apply: '图书角原有 ' + a + ' 本书，又买来 ' + b + ' 本，借出 ' + c + ' 本。脱式：' + a + ' + ' + b + ' − ' + c + ' = ' + s1 + ' − ' + c + '，还剩多少本？',
    operation: 'mixed' };
}

function buildNegativeItem(rng, name, nr) {
  if (name.indexOf('数轴') !== -1) {
    var k0 = riC(rng, 2, 6, nr);
    // P32-AS-16：删「0 − k = −k」参考式的得数（直接写出所求负数）；
    // 减法支架保留「0 − k = ？」承载 expressionPresent，0 左边第 k 格即推导线索
    return { stem: '在数轴上，0 左边第 ' + k0 + ' 格表示什么数？（0 − ' + k0 + ' = ？）',
      answer: '−' + k0, options: ['−' + k0, String(k0), '0'],
      apply: '温度计以 0℃ 为分界，数轴上 0 左边第 ' + k0 + ' 格是什么数？' };
  }
  if (name.indexOf('比较') !== -1) {
    var a1 = riC(rng, 2, 8, nr), b1 = a1 + riC(rng, 1, 5, nr);
    return { stem: '比较大小：−' + b1 + ' ○ −' + a1 + '（参考：' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，负号后越大数越小）',
      answer: '<', options: ['>', '<', '='],
      apply: '哈尔滨 −' + b1 + '℃，北京 −' + a1 + '℃，' + b1 + ' − ' + a1 + ' = ' + (b1 - a1) + '，哪里更冷，即 −' + b1 + ' ○ −' + a1 + '？' };
  }
  // 读写/认识 —— P34-06：读写分离。choice 问读法（answer「负五」，补第 4 个合理干扰项「减五」——
  // 把「−」读成「减」是真实迷思）；fill/calc 问数值（input 答案 −5，不再以读法问句配读法答案
  // 或以读法句充当列式题），fillAnswer/calcAnswer 与 makeByItem 的 applyAnswer 同型分型答案机制。
  return { stem: '读出下面的数：−5 与 +8（参考：0 − 5 = −5），−5 读作什么？',
    answer: '负五', options: ['负五', '正五', '五', '减五'],
    // P40-Q-03（#143）：choice 独立设问（读法问句），不再回退空壳「下面哪个选项正确」；
    // 骨架与 apply（存折情境全句）互异。
    choice: '支出 5 元记作 −5，这个数读作什么？',
    calc: '列式计算：0 − 5 = ？', calcAnswer: '−5',
    fill: '根据算式把答案填在横线上：0 − 5 = ____', fillAnswer: '−5',
    apply: '存折上支出 5 元记作 −5（0 − 5 = −5），−5 应该怎样读？' };
}

function buildMultDivRelationItem(rng, name, nr) {
  if (name.indexOf('平均分') !== -1) {
    var total0 = riC(rng, 2, 9, nr) * riC(rng, 2, 9, nr), groups0 = riC(rng, 2, 6, nr);
    while (total0 % groups0 !== 0) total0 += 1;
    return { stem: '把 ' + total0 + ' 平均分成 ' + groups0 + ' 份，每份多少？（' + total0 + ' ÷ ' + groups0 + ' = ？）',
      answer: String(total0 / groups0), options: [String(total0 / groups0), String(groups0), String(total0)],
      apply: '把 ' + total0 + ' 块糖平均分给 ' + groups0 + ' 个小朋友，' + total0 + ' ÷ ' + groups0 + ' = ？，每人几块？' };
  }
  var a2 = riC(rng, 2, 9, nr), b2 = riC(rng, 2, 9, nr), p2 = a2 * b2;
  return { stem: '因为 ' + a2 + ' × ' + b2 + ' = ' + p2 + '，所以 ' + p2 + ' ÷ ' + a2 + ' = 多少？',
    answer: String(b2), options: [String(b2), String(a2), String(p2)],
    apply: '每盒有 ' + a2 + ' 支笔，' + b2 + ' 盒共 ' + p2 + ' 支（' + a2 + ' × ' + b2 + ' = ' + p2 + '）。反过来 ' + p2 + ' ÷ ' + a2 + ' = ？，是多少盒？' };
}

function buildAlgebraLetterItem(rng, name, nr) {
  if (name.indexOf('数量关系') !== -1) {
    return { stem: '速度用 v 表示，时间用 t 表示，路程 s 等于什么？（参考：80 × 2 = 160）',
      answer: 's = v × t', options: ['s = v × t', 's = v + t', 's = v − t'],
      fill: '速度 × 时间 = 路程，用字母表示为 ____',
      apply: '汽车每小时行 v 千米，行了 t 小时（如 80 × 2 = 160），路程 s 用字母怎样表示？' };
  }
  if (name.indexOf('值') !== -1) {
    var a3 = riC(rng, 2, 6, nr), k3 = riC(rng, 2, 5, nr);
    return { stem: '当 a = ' + a3 + ' 时，' + k3 + 'a + 1 = ' + k3 + ' × ' + a3 + ' + 1 = 多少？',
      answer: String(k3 * a3 + 1), options: [String(k3 * a3 + 1), String(k3 * a3), String(a3 + 1)],
      fill: '当 a = ' + a3 + ' 时，' + k3 + ' × a + 1 = ____',
      apply: '文具店有 a 盒彩笔，每盒 ' + k3 + ' 支还多 1 支样品。当 a = ' + a3 + ' 时，' + k3 + ' × ' + a3 + ' + 1 = ？，共多少支？' };
  }
  // 用字母表示数
  var d0 = riC(rng, 4, 20, nr);
  return { stem: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁。当 a = 10 时，10 + ' + d0 + ' = 多少，爸爸岁数用字母怎样表示？',
    answer: 'a + ' + d0 + '（岁）', options: ['a + ' + d0, 'a − ' + d0, 'a × ' + d0],
    fill: '爸爸比小明大 ' + d0 + ' 岁，用含字母的式子表示爸爸的岁数：____',
    apply: '小明今年 a 岁，爸爸比他大 ' + d0 + ' 岁（a = 10 时 10 + ' + d0 + ' = ' + (10 + d0) + '），爸爸的岁数用含字母的式子怎样表示？' };
}

/* g5-down-u02-k001~k006：因数倍数概念 / 因数倍数特征 / 倍数特征 / 奇偶数 / 质合数 / 和的奇偶性 */
function buildNumberTheoryItem(rng, name, nr) {
  // P28-HOLLOW-03：k001 因数和倍数的概念（operations=[multiplication,division]，
  // 证据行要 data.operation + relationAny[multiply-by-times|divide-share] + constructAny）
  if (name.indexOf('因数和倍数') !== -1) {
    var fa = riC(rng, 2, 8, nr), fb = fa + riC(rng, 1, Math.max(1, 9 - fa), nr), fp = fa * fb;
    var facStmt = fa + ' 和 ' + fb;
    // P34-05：calc 用直问式列式题面 + 数值答案（原 stem 是选择问句「哪一组数」却被 calc
    // 消费成 input 题，答案规格错位）；stem 随之删除——calc/choice/fill/apply 各用专字段，无消费者。
    // 第 4 干扰项 (fb+1)+' 和 '+fp 恒为假：(fb+1)>fa 且 gcd(fb+1,fb)=1，故 fb+1 不整除 fp。
    // P34-05 补（AS-18）：calc 改求积式——原「fp ÷ fa = ？」写法把答案 fb 写进支架
    // 「fa × fb = fp」（L1 真泄露，不可白名单）；求积式答案 fp 不在题面任一 token 中。
    return { operation: 'mult',
      calc: '在整数乘法中，两个乘数都是积的因数：列式计算 ' + fa + ' × ' + fb + ' = ？（积的因数就是这两个乘数）',
      calcAnswer: String(fp),
      answer: facStmt,
      options: [facStmt, fa + ' 和 ' + fp, fb + ' 和 ' + fp, (fb + 1) + ' 和 ' + fp],
      // P30-GEN-06（P30-16）：choice 须含「因数」关键词且骨架与 calc/apply 互异。
      choice: '把 ' + fp + ' 块月饼装盒（' + fa + ' × ' + fb + ' = ' + fp + '）。' + fp + ' 的因数是哪两个？',
      fill: '根据 ' + fa + ' × ' + fb + ' = ' + fp + ' 可知，____ 和 ____ 是 ' + fp + ' 的因数。',
      // P34-10：因数对无序——学生逆序填「fb 和 fa」数学等价，判分须接受（归一去空格后比对）。
      fillAcceptable: [fb + ' 和 ' + fa],
      apply: '礼品店把 ' + fp + ' 块月饼装盒，每盒 ' + fa + ' 块，正好装 ' + fb + ' 盒（'
        + fa + ' × ' + fb + ' = ' + fp + '）。哪两个数是 ' + fp + ' 的因数？' };
  }
  // P28-HOLLOW-03：k002 因数与倍数的特征（operations=[multiplication]，
  // 证据行要 data.operation + multiply-by-times + multiplication）
  if (name.indexOf('因数与倍数') !== -1) {
    var fn2 = riC(rng, 3, 9, nr);
    // P32-AS-16：删首句「fn2 × 1 = fn2」（直接写出最小倍数即答案），保留 ×2、×3 找倍数支架
    return { operation: 'mult',
      stem: '用一个数依次乘 1、2、3……可以找它的倍数：'
        + fn2 + ' × 2 = ' + (fn2 * 2) + '，' + fn2 + ' × 3 = ' + (fn2 * 3) + '。'
        + fn2 + ' 最小的倍数是多少？',
      answer: String(fn2),
      options: [String(fn2), '1', String(fn2 * 2), '0'],
      fill: fn2 + ' × 1 = ____，可见一个数最小的倍数就是它本身。',
      apply: '计数器按 ' + fn2 + ' 的倍数累加：'
        + fn2 + ' × 2 = ' + (fn2 * 2) + '，' + fn2 + ' × 3 = ' + (fn2 * 3)
        + '……照这样能一直写下去吗？' + fn2 + ' 最小的倍数是多少？' };
  }
  // 和的奇偶性（必须先于「奇数」分支）
  if (name.indexOf('奇偶性') !== -1 || name.indexOf('和的奇偶') !== -1) {
    var patterns = [
      { oddA: true, oddB: true, res: '偶数', rule: '奇数 + 奇数 = 偶数' },
      { oddA: false, oddB: false, res: '偶数', rule: '偶数 + 偶数 = 偶数' },
      { oddA: true, oddB: false, res: '奇数', rule: '奇数 + 偶数 = 奇数' }
    ];
    var pt = patterns[ri(rng, 0, patterns.length - 1)];
    var pa = pt.oddA ? riC(rng, 1, 9, nr) * 2 - 1 : riC(rng, 1, 9, nr) * 2;
    var pb = pt.oddB ? riC(rng, 1, 9, nr) * 2 - 1 : riC(rng, 1, 9, nr) * 2;
    // P32-AS-16：规则结论（偶数+偶数=偶数）与已算和 16+8=24 都直接给出答案，
    // 题面只留加法式与「奇数还是偶数」之问，由学生先判两个加数的奇偶再下结论。
    return { stem: '不计算，判断：' + pa + ' + ' + pb + ' = ？的得数是奇数还是偶数？（根据和的奇偶规律判断）',
      answer: pt.res, options: ['偶数', '奇数', '无法确定'],
      fill: pa + ' + ' + pb + ' 的和是 ____（填「奇数」或「偶数」，不计算）',
      apply: '两队人数分别是 ' + pa + ' 和 ' + pb + '，不计算，两队合并后的总人数是奇数还是偶数？' };
  }
  // 质数与合数
  if (name.indexOf('质数') !== -1 || name.indexOf('合数') !== -1) {
    var primes = [7, 11, 13, 17, 19];
    var composites = [4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20];
    var pn = primes[ri(rng, 0, primes.length - 1)];
    var pool = composites.slice();
    var d1 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    var d2 = pool.splice(ri(rng, 0, pool.length - 1), 1)[0];
    // P32-AS-16：删「1 × pn = pn」因式分解（等于在题面指认质数答案）；
    // fill 改为候选集内判定（pn/d1/d2 为任务必需已知量，与 choice 同源）。
    // calc 用候选之外的 5 × 6 = 30 作合数反例承载 expressionPresent，不点名任何选项。
    return { stem: '一个数只有 1 和它本身两个因数就是质数（如 5 × 6 = 30，30 有多个因数，是合数）。下面哪个数是质数？',
      answer: String(pn), options: [String(pn), String(d1), String(d2)],
      fill: '在 ' + pn + '、' + d1 + '、' + d2 + ' 中，____ 只有 1 和它本身两个因数，是质数。',
      // P32-AS-16D 规格缺陷修复：apply 问「质数还是合数」，标准答案必须是分类结论
      // 而非糖果数数字（calc/choice/fill 仍以数字为答案），与 P32-AS-11 奇偶分支同口径。
      applyAnswer: '质数',
      apply: '分糖果时，合数能平均分给多于一个小组（如 3 × 3 = 9），质数不能。糖果数 ' + pn + ' 能分成人数相同且多于1人的小组吗，它是质数还是合数？' };
  }
  // 奇数与偶数
  if (name.indexOf('奇数') !== -1 || name.indexOf('偶数') !== -1) {
    var en = riC(rng, 2, 24, nr) * 2;
    var askEven = rng() < 0.5;
    if (askEven) {
      return { stem: '2 的倍数是偶数：' + en + ' ÷ 2 = ' + (en / 2) + '。下面哪个数是偶数？',
        answer: String(en), options: [String(en), String(en + 1), String(en + 3)],
        fill: '' + en + ' ÷ 2 = ' + (en / 2) + ' 没有余数，____ 是 2 的倍数',
        // P32-AS-11 规格缺陷修复：apply 问「奇数还是偶数」，标准答案必须是奇偶结论
        // 而非门牌号数字（calc/choice/fill 仍以数字为答案）。
        applyAnswer: '偶数',
        // P32-AS-16：删「en ÷ 2 = … 没有余数」证明（直接推出偶/奇结论），奇偶由学生判
        apply: '门牌号按单双号排列，' + en + ' 号是奇数还是偶数？' };
    }
    var on = riC(rng, 2, 24, nr) * 2 - 1;
    return { stem: '不是 2 的倍数的数是奇数，如 ' + on + ' ÷ 2 = ' + ((on - 1) / 2) + '……1。下面哪个数是奇数？',
      answer: String(on), options: [String(on), String(on + 1), String(on - 1)],
      fill: '' + on + ' ÷ 2 余 1，____ 不是 2 的倍数',
      applyAnswer: '奇数',
      // P32-AS-16：同上，删「余 1 不能整除」证明
      apply: '报数时逢双数蹲下，' + on + ' 号同学该蹲下吗，' + on + ' 是奇数还是偶数？' };
  }
  // 2、5、3 的倍数的特征（默认）
  var feats = [
    { f: 2, text: '个位上是 0、2、4、6、8', build: function () { var x = riC(rng, 6, 49, nr) * 2; return x; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 2 === 0 ? b + 1 : b; } },
    { f: 5, text: '个位上是 0 或 5', build: function () { return riC(rng, 2, 19, nr) * 5; },
      bad: function (x) { var b = x + (rng() < 0.5 ? 1 : -1); return b % 5 === 0 ? b + 1 : b; } },
    { f: 3, text: '各位上数字之和是 3 的倍数', build: function () {
        for (var t = 0; t < 30; t++) { var x = riC(rng, 12, 99, nr); var s = Math.floor(x / 10) + x % 10; if (s % 3 === 0) return x; }
        return 12;
      }, bad: function (x) {
        for (var t = 0; t < 30; t++) { var b = riC(rng, 12, 99, nr); var s = Math.floor(b / 10) + b % 10; if (s % 3 !== 0 && b !== x) return b; }
        return x + 1;
      } }
  ];
  var ft = feats[ri(rng, 0, 2)];
  var fn = ft.build();
  var fd1 = ft.bad(fn), fd2 = ft.bad(fn);
  while (fd2 === fd1 || fd2 === fn) fd2 = ft.bad(fn);
  // P32-AS-16：fref 是「fn 能被 f 整除」的完整验证（参考：85 ÷ 5 = 17 / 数字和验证），
  // 等于在题面替学生完成判定、直接指认正确选项；规则陈述 + 候选数保留，验证由学生完成。
  // calc 仍需可求值算式承载 expressionPresent：用与候选无关的 7 ÷ f 做检验示范，不点名正确项。
  return { stem: ft.text + ' 的数是 ' + ft.f + ' 的倍数。下面哪个数是 ' + ft.f + ' 的倍数？'
      + '（仿照 7 ÷ ' + ft.f + ' 的做法，把每个选项除以 ' + ft.f + '，看余数是不是 0）',
    answer: String(fn), options: [String(fn), String(fd1), String(fd2)],
    fill: ft.text + '，____ 是 ' + ft.f + ' 的倍数',
    apply: '体育分组每组 ' + ft.f + ' 人正好分完，人数须是 ' + ft.f + ' 的倍数。班级人数 ' + fn + '，哪个班能正好分完？' };
}

// 从 stem 中提取支撑算式（优先括号内的运算式，其次冒号后的等式），用于 fill 填空题干
function extractSupport(stem) {
  var s = String(stem);
  var m = /（([^）]*[=×÷+\-−*x/][^）]*)）/.exec(s);
  if (m) return m[1].trim();
  var m2 = /[:：]\s*([^，。？?]*[=×÷+\-−*x/][^，。？?]*)/.exec(s);
  if (m2) return m2[1].trim();
  return s.replace(/（[\s\S]*?）/g, '').replace(/多少|什么|几|是[？?]?$|[？?]/g, '').trim();
}

// 取 stem 首段语境（到第一个句读符号前），用于 choice 选择问法的简短题干
function headContext(stem) {
  var s = String(stem).replace(/（[\s\S]*?）/g, '');
  var cut = s.search(/[，。：:？?]/);
  return cut >= 0 ? s.slice(0, cut) : s.slice(0, 14);
}

function makeByItem(plan, context, i, builder, subType) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var params = plan.semanticParams || {};
  var item = builder(rng, params.name || '', nrOf(plan));
  var qt = plan.questionTypeId;
  var q = buildBase(plan, context, i, { subType: subType, operation: item.operation });
  var answer = item.answer;
  // P34-10：fill 可声明语义等价答案（如因数对无序，「3 和 6」「6 和 3」均正确）；
  // 经 finish 的 P32-AS-11 过滤（只保留与最终 value 不同的标量等价答案）。
  var extraAcceptable = [];

  // P30-GEN-06（P30-16）：四题型承担不同 Assessment Target，核心骨架须两两互异
  //   calc  —— 直问式列式求值（stem，含参考算式，operation 满足 expressionPresent）
  //   fill  —— 算式支撑填空：根据参考算式把答案填入横线（骨架=参考算式，与 calc 直问、apply 情境均不同）
  //   apply —— 真实情境问句（item.apply）
  //   choice—— 短语境选择问法：「{首段语境}，下面哪个选项正确？」（骨架含「下面哪个选项正确」，与 calc 不同）
  var prompt;
  if (qt === 'calc') {
    // P34-05：item 可提供专用 calc 题面与分型答案（历史 stem 曾被写成选择问句被 calc 直接消费）；
    // calcAnswer/fillAnswer 与下方 applyAnswer 同型（题问结论随题型切换时答案规格随之切换）
    prompt = item.calc || item.stem;
    if (item.calcAnswer != null) answer = item.calcAnswer;
  } else if (qt === 'fill') {
    if (item.fill) {
      prompt = item.fill;
      if (item.fillAnswer != null) answer = item.fillAnswer;
      if (Array.isArray(item.fillAcceptable)) extraAcceptable = item.fillAcceptable;
    } else {
      // P32-AS-16：支架算式只保留操作数，末尾「= 结果」必须换成空位——
      // extractSupport 抽出的参考式含完整答案（如「60 + 8 = 68」），直接拼「= ____」
      // 会形成双等号病句并在题面写出答案。
      var support = extractSupport(item.stem).replace(/[=＝]\s*[^=＝]*$/, '= ____');
      prompt = '根据算式把答案填在横线上：' + support;
    }
  } else if (qt === 'apply') {
    prompt = item.apply || item.stem;
    // P32-AS-11：题问结论（奇/偶）时答案规格随题型切换，缺省回退 item.answer。
    if (item.applyAnswer != null) answer = item.applyAnswer;
  } else {
    // choice
    var wrongs = (item.options || []).filter(function (o) { return o !== item.answer; });
    finishChoice(q, rng, item.answer, wrongs);
    // choice 用 apply 语境首部（与 calc 的 stem 首部不同），保证核心骨架互异；
    // 若 item 提供了专用 choice 题面（含 KP 关键词），优先使用。
    var ctxSrc = item.choice || (headContext(item.apply || item.stem) + '，下面哪个选项正确？');
    q.prompt = ctxSrc + '（  ）';
    // P34-13：解析指认正确选项（选择题解析的教学职责），不再留 null 由汇聚层抄题面
    q.answer.explanation = '正确选项是「' + item.answer + '」';
    return q;
  }
  // P34-13：解析不再把题面原文（含问号）当解析；item.answer 为独立概念结论
  //（如读法「负五」、因数对陈述）且与本题型答案不同则附上，给出「演算结果 → 概念结论」的教学增量。
  // P40-Q-09（R6/R13/R16 复现 #2/#5/#107/#110/#116/#137/#140/#146）：复述类
  //「题面，答案是 X」升级为结构化解析——calc 逐步演算、fill 演算+归因、apply 四步
  //「题意→列式→计算→答」。素材全部取自 builder 既有变量（题面/stem 内嵌参考式、
  // item.answer 概念结论），不编造；无算式素材时诚实退化为「答案是 X」裸句（P34-14 不引题外信息）。
  var conceptConclusion = (item.answer != null && String(item.answer) !== String(answer))
    ? '；' + item.answer : '';
  var srcExpr = /[+\-−×÷*＝=]/.test(String(prompt)) ? String(prompt) : String(item.stem || '');
  var sup = extractSupport(srcExpr);
  var expr = null, exprAns = null;
  if (/[+\-−×÷*]/.test(sup) && /\d/.test(sup)) {
    var supCore = sup.replace(/[?？]\s*$/, '');
    expr = supCore.replace(/[=＝]\s*[^=＝]*$/, '').trim();
    var eqTail = /[=＝]\s*([^=＝？?]+)$/.exec(supCore);
    if (eqTail && /^[−-]?\d+$/.test(eqTail[1].replace(/[、\s]/g, ''))) exprAns = eqTail[1].trim();
  }
  var isNumAns = /^[-−]?\d+$/.test(String(answer).replace('−', '-'));
  if (exprAns == null && isNumAns) exprAns = String(answer);
  var explanation;
  if (qt === 'calc') {
    explanation = expr
      ? expr + ' = ' + answer + conceptConclusion + '。'
      : '答案是 ' + answer + conceptConclusion + '。';
  } else if (qt === 'fill') {
    explanation = expr
      ? (expr + (exprAns != null ? ' = ' + exprAns : '') + '，所以答案是 ' + answer + conceptConclusion + '。')
      : '答案是 ' + answer + conceptConclusion + '。';
  } else {
    var stem0 = String(prompt).replace(/（参考[^）]*）/g, '')
      .replace(/[=＝]\s*[？?]?\s*$/, '').replace(/[?？]\s*$/, '');
    var stemQ = /[?？]$/.test(String(prompt).trim()) ? '？' : '。';
    explanation = '题意：' + stem0 + stemQ
      + (expr ? ' 列式：' + expr + (exprAns != null ? '，计算：' + expr + ' = ' + exprAns : '') + '。' : '')
      + '答：' + answer + conceptConclusion + '。';
  }
  return finish(q, prompt, answer, [answer].concat(extraAcceptable), explanation);
}

function makeNumberConcept(plan, context, i) { return makeByItem(plan, context, i, buildNumberConceptItem, 'number-concept'); }
function makeNegativeNumber(plan, context, i) { return makeByItem(plan, context, i, buildNegativeItem, 'negative-number'); }
function makeMultDivRelation(plan, context, i) { return makeByItem(plan, context, i, buildMultDivRelationItem, 'multdiv-relation'); }
function makeAlgebraLetter(plan, context, i) { return makeByItem(plan, context, i, buildAlgebraLetterItem, 'algebra-letter'); }
function makeNumberTheory(plan, context, i) { return makeByItem(plan, context, i, buildNumberTheoryItem, 'number-theory'); }
function makeMakeTen(plan, context, i) { return makeByItem(plan, context, i, buildMakeTenItem, 'make-ten'); }
function makeBracketOrder(plan, context, i) { return makeByItem(plan, context, i, buildBracketOrderItem, 'bracket-order'); }
function makeStepwise(plan, context, i) { return makeByItem(plan, context, i, buildStepwiseItem, 'stepwise-format'); }

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
  'number-theory': bindP2509(makeNumberTheory),
  // P28-FIX6：凑十法 / 有括号运算顺序 / 脱式计算规范
  'make-ten': bindP2509(makeMakeTen),
  'bracket-order': bindP2509(makeBracketOrder),
  'stepwise-format': bindP2509(makeStepwise)
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
      var applied = VariationApply.applyToAll(out, plan);
      // P40-T-08：承上启下三段模板——有同族前序锚时，把前序 canonical 名/定义要点接到本题解析前。
      var upstream = params && params.upstream;
      if (upstream && upstream.name) {
        applied.forEach(function (q) {
          if (q && q.answer && typeof q.answer.explanation === 'string' && q.answer.explanation) {
            q.answer.explanation = SemanticParameters.composeExplanation({ upstream: upstream, name: params.name, current: q.answer.explanation });
          }
        });
      }
      return SemanticEvidence.attachAll(applied, plan);
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
