/**
 * shared/generator/generators/semantic-relations.js — 数量/比例关系图形语义族生成器（P25-06）
 *
 * 为 4 个「numeric+graphic 双表征、按关系理解」的 canonical KP 补参数化生成能力，
 * 撤销 P25-05 的 teaching calc deny（此前 calc 被迫落到 arithmetic 兜底，
 * 其余题型误路由到 code-recognition / equivalent-reasoning 等语义无关生成器）：
 *
 *   subTopic                         | KP                      | KBL 语义要点
 *   ---------------------------------|-------------------------|----------------------------
 *   pictorial-additive-relation      | g1-down-u06-k002 图形表述数量关系 | 画图理解数量间加减关系（一步）
 *   periodic-pattern                 | g2-down-u02-k005 周期问题       | 有余数除法定周期中第 k 个
 *   scale-transform                  | g6-down-u04-k007 图形的放大与缩小 | 按比变换：新长度=原长度×k
 *   proportion-application           | g6-down-u04-k008 解决问题       | 正/反比例、归一（总量/单价/速度）
 *
 * 分派完全消费 plan.semanticParams.subTopic（SemanticParameters 机械派生，键见
 * shared/generator/core/semantic-parameters.js），源码不裸写 canonical KP 字面量、
 * 不做 KP ID 猜测；subTopic 缺失或该题型无 maker → []（fail-closed）。
 *
 * 每 KP 覆盖 ALLOW 5 题型：calc / fill / apply / choice / geometry
 * （native binding kp=1 不分题型胜出，未覆盖题型会 0 产出破坏 allow-gen 门禁）。
 *
 * 验证器约束（kp-semantic-validator，native binding 下 operation 不一致即 ERROR）：
 *   pictorial-additive-relation → data.operation ∈ add/sub
 *   periodic-pattern            → data.operation = div
 *   scale/proportion            → KBL operations 为 []/mixed，不声明 operation（跳过检查）
 *
 * 挂载点：generators/index.js require + buildAll；generator-registry.js CORE_RECORDS
 * 增 1 条 native 绑定 4 KP；selector 无需改动。
 *
 * 输出契约：SemanticQuestion[]（字段与 percent.js / concept-meaning.js 一致）。
 */
'use strict';

var Rng = require('../core/rng.js');
var SemanticParameters = require('../core/semantic-parameters.js');
var SemanticEvidence = require('../core/semantic-evidence.js');
var VariationApply = require('../core/variation-apply.js');

var QTYPES = ['calc', 'fill', 'apply', 'choice', 'geometry'];

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

/* P35-DEBT-1：难度执行端消费——数值范围与 numberRange 取交集 */
function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 100 };
}
function riC(rng, lo, hi, range) {
  var min = Math.max(lo, range.min);
  var max = Math.min(hi, range.max);
  if (min > max) { min = lo; max = hi; }
  return Rng.randInt(rng, min, max);
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':' + i;
  if (plan && plan.seed != null) return plan.seed + ':' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':' + i;
}

// P38 修正：图形挂载意图闸门（镜像 position.js intentWantsGraphic 既有模式）——
// 仅当 T2 意图（经 P38-DATA-01 运行时投影挂到 plan.semanticParams.graphic.role）
// 授权配图时才允许 maker 挂图。graphicRole=null 的权威意图行（实证：正/反比例
// fill/choice/apply）明确不配图；无条件挂图会被 Validator 的
// KP_SEMANTIC_INTENT_ALIGNMENT 拒收（6g GEN-FAIL 复现），符合冻结链
// 「SVG 只表达 Generator 已确定的语义、图形由意图授权」约束。
function intentWantsGraphic(plan) {
  return !!(plan && plan.semanticParams && plan.semanticParams.graphic &&
    plan.semanticParams.graphic.role != null);
}

function buildBase(plan, context, i, extra) {
  var constraints = plan.constraints || {};
  var extraData = extra || {};
  // P38 意图闸门：意图未授权配图时剥离 maker 附加的 graphic（单点收口，覆盖全部 maker）
  if (extraData.graphic && !intentWantsGraphic(plan)) {
    extraData = Object.assign({}, extraData);
    delete extraData.graphic;
  }
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
    data: Object.assign({ mode: 'semantic-relations' }, extraData)
  };
}

function finish(q, prompt, answer, acceptable, explanation) {
  var value = String(answer);
  q.prompt = prompt;
  q.answer = {
    value: value,
    // P32-AS-11 契约 A：acceptable 只许「与 value 不同的标量语义等价答案」。
    // value 复制（本文件历史上各 maker 普遍传 [String(ans)]）与嵌套数组
    //（周期题误把整组形状当等价）在装配口剔除，不进判分白名单。
    acceptable: (Array.isArray(acceptable) ? acceptable : []).filter(function (x) {
      return (typeof x === 'string' || typeof x === 'number') && String(x) !== value;
    }),
    // P34-13：不再用「题面 + = + 答案」机械拼解析（对情境/周期/比例题会拼出病句或抄题面）。
    // 各 maker 有真讲解时显式传入；缺省 null——汇聚层仅对完整「算式 = ？」题面补演算，
    // 其余按缺失处理，不用题面冒充 explanation（语义关系说理待各 maker 按需补，登记不遮盖）。
    explanation: explanation || null
  };
  return q;
}

/** 选择题收尾：options 洗牌 + correctIndex + 答案为正确选项文本（与 selection.js 契约一致） */
function finishChoice(q, rng, correct, wrongs, explanation) {
  var seen = {}, pool = [];
  [correct].concat(wrongs).forEach(function (o) {
    o = String(o);
    if (!seen[o]) { seen[o] = 1; pool.push(o); }
  });
  while (pool.length < 4) {
    var filler = '都不对（' + pool.length + '）';
    if (!seen[filler]) { seen[filler] = 1; pool.push(filler); }
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  return finish(q, q.prompt, String(correct), [], explanation || null);
}

/* ================================================================
 * ① pictorial-additive-relation（g1）：画图理解一步加减数量关系
 * ================================================================ */

function makeAddRelCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var take = riC(rng, 2, 9, nr);
  var left = riC(rng, 2, 9, nr);
  var subtract = (i % 2 === 0);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: subtract ? 'sub' : 'add',
    barModel: true
  });
  // P31-FIX-11（用户 2026-10-06 显式裁决，覆盖 P31 题面文案禁改面，依据留存 change-log）：
  // 本 KP×calc 意图已经 sample-1 人工评审「通过」——calc 题型原生不支持图形
  // （type.supports.graphic=false），driftRisk 明示「图形语义将降级为文字/算式」。
  // 原题面「看图列式…（在图中圈出/画出）」引用不存在的图，违反已确认意图；
  // 改为纯文字情境「列式计算」，保留具象情境（防 driftRisk 所警告的退化为纯算式）、
  // 数字/答案/解析逐字不变。
  if (subtract) {
    return finish(q, '列式计算：盘子里原来有 ' + (take + left) + ' 个桃，小猴子吃掉 ' + take
      + ' 个。还剩多少个？', left, [],
      '总数 − 吃掉的部分 = 剩下的部分：' + (take + left) + ' − ' + take + ' = ' + left);
  }
  return finish(q, '列式计算：草地上左边有 ' + left + ' 只羊，右边又来了 ' + take
    + ' 只羊。一共有多少只羊？', take + left, [],
    '两部分合起来：' + left + ' + ' + take + ' = ' + (take + left));
}

function makeAddRelFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var a = riC(rng, 3, 9, nr);
  var b = riC(rng, 3, 9, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true,
    // P31-FIX-09：题面「看线段图填空」此前零 graphic（P31-FIX-05 risk① 登记同族
    // NO-DESC）。fill 行 intent graphicRole=auxiliary / allowedRepresentations 含
    // 'graphic'（逐题型核实），补图合法；接通既有 diagram.segment 渲染器（与
    // makeAddRelGeometry 同款）：蓝括号=第一条 a，橙括号=第二条 b，总括=所求 ?。
    graphic: {
      type: 'geometry', subtype: 'segment', role: 'quantity-correspondence',
      params: {
        total: a + b, part: a, unit: '',
        partLabel: String(a), otherLabel: String(b), totalLabel: '?'
      }
    }
  });
  return finish(q, '看线段图填空：第一条线段表示 ' + a + '，第二条线段表示 ' + b
    + '，两条线段合起来表示（  ）。', a + b, [String(a + b)],
    '两条线段合起来的总数 = 第一条 + 第二条：' + a + ' + ' + b + ' = ' + (a + b));
}

function makeAddRelApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var base = riC(rng, 5, 12, nr);
  var diff = riC(rng, 2, 8, nr);
  var more = (i % 2 === 0);
  // P38 断链修复：apply 行（more/less 双形态）此前零 graphic。接通既有 diagram.segment
  // 渲染器（makeAddRelFill/Geometry 同款）：more 求较大数→总括标 ?；less 求较小数→
  // 第一段标 ?。参数全部来自本题已确定语义（base/diff 与所求），所求值不入图形文字。
  var graphic = more ? {
    type: 'geometry', subtype: 'segment', role: 'quantity-correspondence',
    params: {
      total: base + diff, part: base, unit: '',
      partLabel: String(base), otherLabel: String(diff), totalLabel: '?'
    }
  } : {
    type: 'geometry', subtype: 'segment', role: 'quantity-correspondence',
    params: {
      total: base + diff, part: base, unit: '',
      partLabel: '?', otherLabel: String(diff), totalLabel: String(base + diff)
    }
  };
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: more ? 'add' : 'sub',
    barModel: true,
    comparison: more ? 'more' : 'less',
    graphic: graphic
  });
  if (more) {
    return finish(q, '先画一画，再列式：小红有 ' + base + ' 朵小红花，小丽比小红多 ' + diff
      + ' 朵。小丽有多少朵？', base + diff, [String(base + diff)],
      '小红的朵数 + 多出来的部分 = 小丽的朵数：' + base + ' + ' + diff + ' = ' + (base + diff));
  }
  return finish(q, '先画一画，再列式：小红有 ' + (base + diff) + ' 朵小红花，小丽比小红少 ' + diff
    + ' 朵。小丽有多少朵？', base, [String(base)],
    '小红的朵数 − 少的部分 = 小丽的朵数：' + (base + diff) + ' − ' + diff + ' = ' + base);
}

function makeAddRelChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var a = riC(rng, 4, 9, nr);
  var b = riC(rng, 4, 9, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true,
    // P31-FIX-09：题面「线段图把总数分成两部分」此前零 graphic（P31-FIX-05 risk①
    // 登记同族 NO-DESC）。choice 行 intent graphicRole=auxiliary /
    // allowedRepresentations 含 'graphic'（逐题型核实），补图合法；接通既有
    // diagram.segment 渲染器（与 makeAddRelGeometry 同款）：蓝括号=第一部分 a，
    // 橙括号=第二部分 b，总括=所求总数 ?。
    graphic: {
      type: 'geometry', subtype: 'segment', role: 'quantity-correspondence',
      params: {
        total: a + b, part: a, unit: '',
        partLabel: String(a), otherLabel: String(b), totalLabel: '?'
      }
    }
  });
  q.prompt = '线段图把总数分成两部分：第一部分是 ' + a + '，第二部分是 ' + b
    + '。求总数应该用下面哪个算式？（  ）';
  var addExpr = a + ' + ' + b;
  return finishChoice(q, rng, addExpr,
    [a + ' − ' + b, b + ' − ' + a, a + ' × ' + b],
    '线段图两部分合起来求总数，用加法：' + a + ' + ' + b + ' = ' + (a + b)
      + '，正确选项是「' + addExpr + '」。');
}

function makeAddRelGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var a = riC(rng, 4, 9, nr);
  var longer = riC(rng, 2, 6, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true,
    // P31-FIX-05：题面「看线段图…（在图上标出长出来的那一段）」此前零 graphic
    // （P31-09 登记 G1 geometry 长桶 NO-DESC 断链）。接通既有 diagram.segment 渲染器
    // （arithmetic.js P28-GEO-NATIVE-02 同款先例）：蓝括号=第一条的量 a，
    // 橙括号=长出的部分，总括=所求 ?。参数全部来自本题已确定语义（a/longer/未知总长）。
    graphic: {
      type: 'geometry', subtype: 'segment', role: 'quantity-correspondence',
      params: {
        total: a + longer, part: a, unit: '',
        partLabel: String(a), otherLabel: '长出 ' + longer, totalLabel: '?'
      }
    }
  });
  return finish(q, '看线段图：第一条线段表示 ' + a + '，第二条线段比第一条长 ' + longer
    + '（在图上标出长出来的那一段）。第二条线段表示多少？', a + longer, [String(a + longer)],
    '第一条 + 长出的部分 = 第二条：' + a + ' + ' + longer + ' = ' + (a + longer));
}

/* ================================================================
 * ② periodic-pattern（g2）：周期 n，第 k 个由 k÷n 的余数决定
 *    余数几 → 周期第几个；余数 0 → 周期末位
 * ================================================================ */

var PATTERN_SHAPES = ['△', '○', '□', '☆'];

function patternPick(rng, nr) {
  var n = Rng.randInt(rng, 2, 4);
  var shapes = Rng.shuffle(rng, PATTERN_SHAPES).slice(0, n);
  var period = riC(rng, 7, 30, nr);
  var rem = period % n;
  var shape = rem === 0 ? shapes[n - 1] : shapes[rem - 1];
  var quotient = Math.floor(period / n);
  return { n: n, shapes: shapes, period: period, rem: rem, shape: shape, quotient: quotient };
}

function makePeriodCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  return finish(q, '图形按「' + p.shapes.join('') + '」为一组重复排列。要确定第 ' + p.period
    + ' 个图形是什么，列式 ' + p.period + ' ÷ ' + p.n + ' 的余数是几？（只填余数）',
    p.rem, [String(p.rem)],
    p.period + ' ÷ ' + p.n + ' = ' + p.quotient + '……' + p.rem
      + (p.rem === 0 ? '，余数为 0 对应每组最后一个图形「' + p.shape + '」'
        : '，余数 ' + p.rem + ' 对应每组第 ' + p.rem + ' 个图形「' + p.shape + '」'));
}

function makePeriodFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem,
    // P38 断链修复：fill 行此前零 graphic。接通 diagram.pattern 渲染器
    // （makePeriodGeometry 同款）：周期组重复 + 省略号 + 未知位置 ?；
    // 组内字符为序列材料（6g GRAPHIC-MATERIAL 既有裁决口径），非答案复述。
    graphic: {
      type: 'diagram', subtype: 'pattern', role: 'auxiliary',
      params: { pattern: p.shapes.join(''), times: 2 }
    }
  });
  // P32-AS-11：第二参曾误传 [p.shapes]（整组形状=错误答案集合，嵌套数组缺陷），
  // 第 k 个图形唯一解为 p.shape，无等价答案，acceptable 必须为空。
  return finish(q, '找规律：「' + p.shapes.join('') + '」依次重复出现，第 ' + p.period
    + ' 个图形是 ____。', p.shape, [],
    '用有余数的除法找周期中的位置：' + p.period + ' ÷ ' + p.n + ' = ' + p.quotient + '……' + p.rem
      + '，余数 ' + (p.rem === 0 ? '0（取末位）' : p.rem) + ' → 「' + p.shape + '」');
}

function makePeriodApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var items = [['红旗', '黄旗', '蓝旗'], ['红花', '黄花', '蓝花'], ['红灯笼', '黄灯笼', '蓝灯笼']];
  var set = Rng.pick(rng, items);
  var n = set.length;
  var k = riC(rng, 10, 40, nr);
  var rem = k % n;
  var which = rem === 0 ? set[n - 1] : set[rem - 1];
  // P38 断链修复：apply 行此前零 graphic。接通 diagram.pattern 渲染器
  // （makePeriodGeometry 同款）：组字符取旗/花/灯笼词语首字（红黄蓝），
  // 答案为二字词语（如「红旗」），与图形单字文本不构成 token 命中。
  var setHead = set.map(function (w) { return w.charAt(0); }).join('');
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: n, periodPosition: k, remainder: rem,
    graphic: {
      type: 'diagram', subtype: 'pattern', role: 'auxiliary',
      params: { pattern: setHead, times: 2 }
    }
  });
  return finish(q, '学校大门前按「' + set.join('、') + '」的顺序循环挂彩旗，第 ' + k
    + ' 面彩旗是什么颜色？', which, [which],
    '用有余数的除法找周期中的位置：' + k + ' ÷ ' + n + ' = ' + Math.floor(k / n) + '……' + rem
      + '，余数 ' + (rem === 0 ? '0（取每组最后）' : rem) + ' → ' + which);
}

function makePeriodChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem,
    // P38 断链修复：choice 行此前零 graphic。接通 diagram.pattern 渲染器
    // （makePeriodGeometry 同款）；组内字符为序列材料，非答案复述。
    graphic: {
      type: 'diagram', subtype: 'pattern', role: 'auxiliary',
      params: { pattern: p.shapes.join(''), times: 2 }
    }
  });
  q.prompt = '图形按「' + p.shapes.join('') + '」为一组重复排列，第 ' + p.period
    + ' 个图形是哪个？（  ）';
  var distractors = PATTERN_SHAPES.filter(function (s) { return s !== p.shape; }).slice(0, 3);
  var periodWhy = '用有余数的除法找周期位置：' + p.period + ' ÷ ' + p.n + ' = ' + p.quotient
    + '……' + p.rem + '，余数 ' + (p.rem === 0 ? '0 取每组最后一个' : p.rem + ' 对应每组第 ' + p.rem + ' 个')
    + '图形「' + p.shape + '」，正确选项是「' + p.shape + '」。';
  return finishChoice(q, rng, p.shape, distractors, periodWhy);
}

function makePeriodGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem,
    graphicPattern: p.shapes.join(''),
    // P31-FIX-05：题面「观察排列图…照这样接着画」此前零 graphic（P31-09 登记
    // G2 geometry 中桶 NO-DESC 断链）。接通 diagram.pattern 渲染器（本任务新增
    // subtype，位于既有 svg-diagram.js 的 diagram 族）：表达周期组重复 + 省略号
    // 延续 + 未知位置 ?。intent.graphicRole=auxiliary / allowedRepresentations=
    // ['graphic']（已核实），补图合法；type='diagram' 与 brace/segment 同族路由。
    graphic: {
      type: 'diagram', subtype: 'pattern', role: 'auxiliary',
      params: { pattern: p.shapes.join(''), times: 2 }
    }
  });
  return finish(q, '观察排列图：' + p.shapes.join('') + p.shapes.join('') + '……'
    + '照这样接着画，第 ' + p.period + ' 个位置应该画什么图形？', p.shape, [p.shape],
    '每 ' + p.n + ' 个一组，' + p.period + ' ÷ ' + p.n + ' 余 '
      + (p.rem === 0 ? '0（末位）' : p.rem) + ' → 「' + p.shape + '」');
}

/* ================================================================
 * ③ scale-transform（g6）：按比放大/缩小，新长度=原长度×k（整数倍）
 * ================================================================ */

var SCALE_SIDES = [2, 3, 4, 5, 6];

function scalePick(rng) {
  var enlarge = Rng.randInt(rng, 0, 1) === 0;
  var k = Rng.randInt(rng, 2, 3);
  // 缩小场景保证整除：原长取 k 的倍数
  var orig = enlarge ? Rng.pick(rng, SCALE_SIDES) : Rng.pick(rng, SCALE_SIDES) * k;
  var next = enlarge ? orig * k : orig / k;
  return { enlarge: enlarge, k: k, orig: orig, next: next };
}

function makeScaleCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next
  });
  return finish(q, '列式计算：一个长方形的长是 ' + s.orig + ' 厘米，按 ' + ratio
    + ' 的比' + (s.enlarge ? '放大' : '缩小') + '。列式：' + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ？（厘米）',
    s.next, [String(s.next)],
    (s.enlarge ? '放大到 ' + s.k + ' 倍：' : '缩小到 1/' + s.k + '：')
      + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next,
    // P38 断链修复：fill 行此前零 graphic。接通既有 geometry.square 渲染器
    // （money.js 先例）：只画原边长 s.orig 的正方形（题面已知量），
    // 不画变换后图形（避免泄露所求边长）。
    graphic: {
      type: 'geometry', subtype: 'square', role: 'quantity-correspondence',
      params: { size: s.orig, unit: 'cm', unitPx: 26 }
    }
  });
  return finish(q, '把一个边长 ' + s.orig + ' 厘米的正方形按 ' + ratio + ' 的比'
    + (s.enlarge ? '放大' : '缩小') + '，变换后正方形的边长是（  ）厘米。', s.next, [String(s.next)],
    (s.enlarge ? '放大到原来的 ' + s.k + ' 倍：' : '缩小到原来的 1/' + s.k + '：')
      + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform',
    scaleRatio: s.enlarge ? (s.k + ':1') : ('1:' + s.k),
    fromLength: s.orig, toLength: s.next,
    // P38 断链修复：apply 行此前零 graphic。接通 geometry.square 渲染器：
    // 只画原长 s.orig 的正方形（题面已知量），不画变换后图形。
    graphic: {
      type: 'geometry', subtype: 'square', role: 'quantity-correspondence',
      params: { size: s.orig, unit: 'cm', unitPx: 26 }
    }
  });
  if (s.enlarge) {
    return finish(q, '一张小卡片长 ' + s.orig + ' 厘米，照相馆按 ' + s.k + ':1 的比把图案放大印成海报，'
      + '海报上的图案长多少厘米？', s.next, [String(s.next)],
      '放大到 ' + s.k + ' 倍：' + s.orig + ' × ' + s.k + ' = ' + s.next + ' 厘米');
  }
  return finish(q, '一张建筑设计图上某段长 ' + s.orig + ' 厘米，施工时要按 1:' + s.k
    + ' 的比缩小制作模型，模型上这段长多少厘米？', s.next, [String(s.next)],
    '缩小到 1/' + s.k + '：' + s.orig + ' ÷ ' + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next,
    // P38 断链修复：choice 行此前零 graphic。接通 geometry.square 渲染器：
    // 只画原长 s.orig 的正方形（题面已知量），不画变换后图形。
    graphic: {
      type: 'geometry', subtype: 'square', role: 'quantity-correspondence',
      params: { size: s.orig, unit: 'cm', unitPx: 26 }
    }
  });
  q.prompt = '一个图形按 ' + ratio + ' 的比' + (s.enlarge ? '放大' : '缩小')
    + '，原长 ' + s.orig + ' 厘米，变换后的长是多少厘米？（  ）';
  var scaleWhy = (s.enlarge
    ? '按 ' + ratio + ' 放大，长扩大到原来的 ' + s.k + ' 倍：' + s.orig + ' × ' + s.k + ' = ' + s.next
    : '按 ' + ratio + ' 缩小，长缩小到原来的 1/' + s.k + '：' + s.orig + ' ÷ ' + s.k + ' = ' + s.next)
    + ' 厘米，正确选项是「' + s.next + '」。';
  return finishChoice(q, rng, String(s.next),
    [String(s.orig), String(s.next + s.k), String(Math.max(1, s.next - 1))], scaleWhy);
}

function makeScaleGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next, gridFigure: true,
    // P38 断链修复：geometry 行（方格图）此前零 graphic。接通 geometry.square
    // 渲染器：只画原长 s.orig 格的正方形（题面已知量），单位用「格」如实承载
    // 方格语义，不画变换后图形。
    graphic: {
      type: 'geometry', subtype: 'square', role: 'quantity-correspondence',
      params: { size: s.orig, unit: '格', unitPx: 26 }
    }
  });
  return finish(q, '方格图上一个长方形的长占 ' + s.orig + ' 格，把图形按 ' + ratio
    + ' 的比' + (s.enlarge ? '放大' : '缩小') + '后，长应占多少格？', s.next, [String(s.next)],
    '图形' + (s.enlarge ? '放大' : '缩小') + '后形状不变，长' + (s.enlarge ? '扩大' : '缩小')
      + '到原来的' + (s.enlarge ? s.k + ' 倍' : '1/' + s.k) + '：' + s.next + ' 格');
}

/* ================================================================
 * ④ proportion-application（g6）：正/反比例与归一（不声明 operation）
 * ================================================================ */

function makePropCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  // 正比例归一：a 件共 c 元（单价整数），求 b 件
  var unit = Rng.pick(rng, [2, 3, 4, 5, 6, 8]);
  var a = riC(rng, 2, 6, nr);
  var b = riC(rng, 2, 9, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b
  });
  return finish(q, '列式计算：买 ' + a + ' 支同样的钢笔要用 ' + (a * unit)
    + ' 元，买 ' + b + ' 支这样的钢笔要用多少元？列式：' + (a * unit) + ' ÷ ' + a + ' × ' + b + ' = ？（元）',
    b * unit, [String(b * unit)],
    '先求单价（归一）：' + (a * unit) + ' ÷ ' + a + ' = ' + unit + ' 元；'
      + b + ' × ' + unit + ' = ' + (b * unit) + ' 元');
}

function makePropFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  // 正比例：速度恒定
  var speed = Rng.pick(rng, [40, 50, 60, 70, 80]);
  var t1 = riC(rng, 2, 4, nr);
  var t2 = riC(rng, 5, 9, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    speed: speed, hoursA: t1, hoursB: t2,
    // P38 断链修复：fill 行此前零 graphic。接通 diagram.ratio 渲染器（本战役新增）：
    // 两行条形为路程（速度一定→路程与时间成正比例），第一行路程已知、第二行所求
    // 以红「？」标注；答案 speed*t2 只决定条宽比例，不入图形文字。
    graphic: {
      type: 'diagram', subtype: 'ratio', role: 'auxiliary',
      params: { rows: [
        { label: t1 + '小时', text: (speed * t1) + '千米', parts: speed * t1 },
        { label: t2 + '小时', text: '?', parts: speed * t2 }
      ] }
    }
  });
  return finish(q, '一辆汽车 ' + t1 + ' 小时行驶了 ' + (speed * t1)
    + ' 千米。照这样的速度，' + t2 + ' 小时能行驶（  ）千米。', speed * t2, [String(speed * t2)],
    '速度一定，路程与时间成正比例：速度 ' + speed + ' 千米/时，' + t2 + ' × ' + speed
      + ' = ' + (speed * t2) + ' 千米');
}

function makePropApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // 反比例：总人数固定，每排人数 × 排数 = 总量，保证第二组整除
  var rows2Choices = [
    { per1: 20, rows1: 12, per2: 24 },
    { per1: 15, rows1: 16, per2: 20 },
    { per1: 12, rows1: 15, per2: 18 },
    { per1: 25, rows1: 12, per2: 20 }
  ];
  var c = Rng.pick(rng, rows2Choices);
  var total = c.per1 * c.rows1;
  var rows2 = total / c.per2;
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'inverse',
    total: total, perRowA: c.per1, rowsA: c.rows1, perRowB: c.per2,
    // P38 断链修复：apply 行此前零 graphic。接通 diagram.ratio 渲染器：两种排队
    // 方案各一行（每行人数为标签、行数为条长），总人数一定→行数与每行人数成
    // 反比例；第二行行数所求以红「？」标注，答案 rows2 只决定条宽，不入文字。
    graphic: {
      type: 'diagram', subtype: 'ratio', role: 'auxiliary',
      params: { rows: [
        { label: '每行' + c.per1 + '人', text: c.rows1 + '行', parts: c.rows1 },
        { label: '每行' + c.per2 + '人', text: '?', parts: rows2 }
      ] }
    }
  });
  return finish(q, '同学们排队做操，每行站 ' + c.per1 + ' 人，正好站 ' + c.rows1
    + ' 行。如果每行站 ' + c.per2 + ' 人，可以站多少行？', rows2, [String(rows2)],
    '总人数一定，每行人数与行数成反比例：' + c.per1 + ' × ' + c.rows1 + ' = ' + total
      + '（人），' + total + ' ÷ ' + c.per2 + ' = ' + rows2 + ' 行');
}

function makePropChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var unit = Rng.pick(rng, [3, 4, 5, 6]);
  var a = riC(rng, 2, 5, nr);
  var b = riC(rng, 6, 9, nr);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b,
    // P38 断链修复：choice 行此前零 graphic。接通 diagram.ratio 渲染器：两行条形
    // 为总价（单价一定→总价与数量成正比例），第一行总价已知、第二行所求以
    // 红「？」标注；答案 b*unit 只决定条宽，不入图形文字。
    graphic: {
      type: 'diagram', subtype: 'ratio', role: 'auxiliary',
      params: { rows: [
        { label: a + '千克', text: (a * unit) + '元', parts: a * unit },
        { label: b + '千克', text: '?', parts: b * unit }
      ] }
    }
  });
  q.prompt = '买 ' + a + ' 千克苹果付了 ' + (a * unit) + ' 元，买 ' + b
    + ' 千克同样的苹果要付多少元？（  ）';
  var propAns = b * unit + ' 元';
  return finishChoice(q, rng, String(b * unit) + ' 元',
    [String((a * unit) + b) + ' 元', String(a * b) + ' 元', String(a + b + unit) + ' 元'],
    '单价一定，总价与数量成正比例：先归一求单价 ' + (a * unit) + ' ÷ ' + a + ' = ' + unit
      + ' 元，再算 ' + b + ' 千克 ' + b + ' × ' + unit + ' = ' + (b * unit) + ' 元，正确选项是「' + propAns + '」。');
}

function makePropGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // 同一时刻物高与影长成正比例：竿高 h1 影长 s1，树影 s2 求树高，保证整数比
  var pairs = [
    { h1: 2, s1: 3, s2: 15 },
    { h1: 2, s1: 4, s2: 20 },
    { h1: 3, s1: 2, s2: 12 },
    { h1: 4, s1: 3, s2: 18 }
  ];
  var c = Rng.pick(rng, pairs);
  var h2 = c.h1 * c.s2 / c.s1;
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    poleHeight: c.h1, poleShadow: c.s1, treeShadow: c.s2,
    // P38 断链修复：geometry 行（看示意图求树高）此前零 graphic。接通 diagram.ratio
    // 渲染器：两行条形为物高（同一时刻物高与影长成正比例），竹竿行高已知、
    // 树行所求以红「？」标注；答案 h2 只决定条宽，不入图形文字。
    graphic: {
      type: 'diagram', subtype: 'ratio', role: 'auxiliary',
      params: { rows: [
        { label: '竹竿', text: '高' + c.h1 + '米', parts: c.h1 },
        { label: '树', text: '?', parts: h2 }
      ] }
    }
  });
  return finish(q, '看示意图：同一时刻，一根 ' + c.h1 + ' 米长的竹竿影长是 ' + c.s1
    + ' 米，旁边一棵树的影长是 ' + c.s2 + ' 米。这棵树高多少米？', h2, [String(h2)],
    '同一时刻物高与影长成正比例：' + c.h1 + ':' + c.s1 + ' = 树高:' + c.s2
      + '，树高 = ' + c.h1 + ' × ' + c.s2 + ' ÷ ' + c.s1 + ' = ' + h2 + ' 米');
}

/* ================================================================
 * ⑤ scale-map（g6）：比例尺 = 图上距离∶实际距离（1∶n 求实际/图上距离）
 * ================================================================ */

var MAP_SCALES = [
  { label: '1:5000', factor: 5000 },
  { label: '1:10000', factor: 10000 },
  { label: '1:20000', factor: 20000 },
  { label: '1:50000', factor: 50000 }
];

function mapPick(rng, nr) {
  var s = Rng.pick(rng, MAP_SCALES);
  var mapCm = riC(rng, 2, 9, nr);
  var realCm = mapCm * s.factor;
  return { label: s.label, factor: s.factor, mapCm: mapCm, realCm: realCm, realM: realCm / 100 };
}

function makeMapCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  if (i % 2 === 0) {
    return finish(q, '列式计算：一幅地图的比例尺是 ' + m.label + '，量得两地间的图上距离是 ' + m.mapCm
      + ' 厘米。列式求实际距离：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + '（厘米）= ？（米）',
      m.realM, [String(m.realM)],
      '实际距离 = 图上距离 × 比例尺后项：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
  }
  return finish(q, '列式计算：一幅地图的比例尺是 ' + m.label + '，两地实际相距 ' + m.realM
    + ' 米（' + m.realCm + ' 厘米）。列式求图上距离：' + m.realCm + ' ÷ ' + m.factor + ' = ？（厘米）',
    m.mapCm, [String(m.mapCm)],
    '图上距离 = 实际距离 ÷ 比例尺后项：' + m.realCm + ' ÷ ' + m.factor + ' = ' + m.mapCm + ' 厘米');
}

function makeMapFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  if (i % 2 === 0) {
    return finish(q, '在比例尺是 ' + m.label + ' 的地图上，量得两地间的图上距离是 ' + m.mapCm
      + ' 厘米，两地的实际距离是（  ）米。', m.realM, [String(m.realM)],
      '实际距离 = 图上距离 × 比例尺后项：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
  }
  return finish(q, '在比例尺是 ' + m.label + ' 的地图上，实际距离 ' + m.realM + ' 米（' + m.realCm
    + ' 厘米）的两地，图上距离是（  ）厘米。', m.mapCm, [String(m.mapCm)],
    '图上距离 = 实际距离 ÷ 比例尺后项：' + m.realCm + ' ÷ ' + m.factor + ' = ' + m.mapCm + ' 厘米');
}

function makeMapApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  var places = Rng.pick(rng, [['学校', '少年宫'], ['公园', '图书馆'], ['小明家', '汽车站']]);
  return finish(q, '小明要从' + places[0] + '走到' + places[1] + '，他在比例尺为 ' + m.label
    + ' 的地图上量得两地相距 ' + m.mapCm + ' 厘米。照这样计算，' + places[0] + '到' + places[1]
    + '实际要走多少米？', m.realM, [String(m.realM)],
    '实际距离 = 图上距离 × 比例尺后项：' + m.mapCm + ' × ' + m.factor + ' = ' + m.realCm + ' 厘米 = ' + m.realM + ' 米');
}

function makeMapChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var m = mapPick(rng, nrOf(plan));
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-map', scaleLabel: m.label, mapDistanceCm: m.mapCm, realDistanceM: m.realM
  });
  q.prompt = '一幅地图的比例尺是 ' + m.label + '，图上距离 ' + m.mapCm + ' 厘米表示的实际距离是多少米？（  ）';
  var wrongs = [m.realM + m.factor / 100, m.realM + 100, m.mapCm * m.factor];
  var mapWhy = '实际距离 = 图上距离 × 比例尺后项：' + m.mapCm + ' × ' + m.factor + ' = '
    + m.realCm + ' 厘米 = ' + m.realM + ' 米，正确选项是「' + m.realM + '」。';
  return finishChoice(q, rng, String(m.realM), wrongs.map(String), mapWhy);
}

/* ================================================================
 * ⑥ ratio-basics（g6）：比例的意义 / 比例的基本性质（内项积=外项积、解比例）
 * ================================================================ */

function ratioName(plan) {
  var p = plan && plan.semanticParams;
  return p && p.name ? p.name : '';
}

/** 可组成比例的两个比 a∶b = c∶d（a×d = b×c，数值控制在一位数） */
function equalRatiosPick(rng, nr) {
  var pairs = [[1, 2], [1, 3], [2, 3], [3, 4], [2, 5]];
  var base = Rng.pick(rng, pairs);
  var r = riC(rng, 2, 4, nr);
  var s;
  do { s = riC(rng, 2, 4, nr); } while (s === r);
  return { a: base[0] * r, b: base[1] * r, c: base[0] * s, d: base[1] * s };
}

/** 解比例 x∶b = c∶d，保证 b×c 能被 d 整除，x 为一位数 */
function solveRatioPick(rng, nr) {
  for (var t = 0; t < 40; t++) {
    var x = riC(rng, 2, 6, nr);
    var d = riC(rng, 2, 9, nr);
    var c = riC(rng, 2, 6, nr);
    if ((x * d) % c === 0) {
      var b = x * d / c;
      if (b >= 2 && b <= 9) return { x: x, b: b, c: c, d: d };
    }
  }
  return { x: 4, b: 6, c: 2, d: 3 };
}

function makeRatioCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  if (name.indexOf('基本性质') !== -1) {
    if (i % 2 === 0) {
      var s = solveRatioPick(rng, nrOf(plan));
      var q0 = buildBase(plan, context, i, {
        subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x
      });
      return finish(q0, '列式计算：解比例 x∶' + s.b + ' = ' + s.c + '∶' + s.d + '。根据比例的基本性质，'
        + 'x × ' + s.d + ' = ' + s.b + ' × ' + s.c + ' = ' + (s.b * s.c) + '，x = ' + (s.b * s.c) + ' ÷ ' + s.d + ' = ？',
        s.x, [String(s.x)],
        '内项积 = 外项积：x = ' + s.b + ' × ' + s.c + ' ÷ ' + s.d + ' = ' + s.x);
    }
    var e = equalRatiosPick(rng, nrOf(plan));
    var q1 = buildBase(plan, context, i, {
      subTopic: 'ratio-basics', aspect: 'property'
    });
    return finish(q1, '列式计算：在比例 ' + e.a + '∶' + e.b + ' = ' + e.c + '∶' + e.d
      + ' 中，两个外项的积是多少？列式：' + e.a + ' × ' + e.d + ' = ？',
      e.a * e.d, [String(e.a * e.d)],
      '外项积 = 内项积：' + e.a + ' × ' + e.d + ' = ' + e.b + ' × ' + e.c + ' = ' + (e.a * e.d));
  }
  // 比例的意义：比值相等的两个比可以组成比例
  var p = equalRatiosPick(rng, nrOf(plan));
  var q2 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'meaning' });
  return finish(q2, '列式计算：判断 ' + p.a + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d
    + ' 能否组成比例。检验：' + p.a + ' × ' + p.d + ' = ' + (p.a * p.d) + '，' + p.b + ' × ' + p.c + ' = '
    + (p.b * p.c) + '。根据检验结果，填「能」或「不能」。',
    '能', ['能'],
    '比值相等（' + p.a + '/' + p.b + ' = ' + p.c + '/' + p.d + '），可以组成比例');
}

function makeRatioFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  var s = solveRatioPick(rng, nrOf(plan));
  if (name.indexOf('基本性质') !== -1 && i % 2 === 1) {
    var e = equalRatiosPick(rng, nrOf(plan));
    var q0 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'property' });
    return finish(q0, '在比例 ' + e.a + '∶' + e.b + ' = ' + e.c + '∶' + e.d + ' 中（' + e.a + ' × ' + e.d
      + ' = ' + (e.a * e.d) + '），两个内项的积是（  ）。', e.b * e.c, [String(e.b * e.c)],
      '内项积 = 外项积 = ' + (e.a * e.d));
  }
  var q1 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x });
  return finish(q1, '根据比例的基本性质填空：x∶' + s.b + ' = ' + s.c + '∶' + s.d + '，'
    + 'x × ' + s.d + ' = ' + s.b + ' × ' + s.c + ' = ' + (s.b * s.c) + '，x =（  ）。',
    s.x, [String(s.x)], '比例中两个内项的积等于两个外项的积：x = ' + s.b + ' × ' + s.c + ' ÷ ' + s.d + ' = ' + s.x);
}

function makeRatioApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // 按比例配制：蜂蜜水中蜂蜜与水的比固定，或国旗长宽比 3∶2
  var scenarios = [
    { a: 3, b: 2, c: 9, label: '国旗长与宽的比是 3∶2，一面国旗长 9 分米', ask: '宽应该是多少分米', unit: '分米' },
    { a: 1, b: 4, c: 6, label: '调蜂蜜水时蜂蜜与水的比是 1∶4，放了 6 份蜂蜜', ask: '需要加同样份数的水多少份', unit: '份' },
    { a: 2, b: 3, c: 8, label: '配制盐水时盐与水的比是 2∶3，用了 8 克盐', ask: '需要加水多少克', unit: '克' }
  ];
  var c0 = Rng.pick(rng, scenarios);
  var x = c0.b * c0.c / c0.a;
  var q = buildBase(plan, context, i, {
    subTopic: 'ratio-basics', aspect: 'apply-solve', ratioA: c0.a, ratioB: c0.b, given: c0.c
  });
  // P32-AS-16：题面不得预先完成解比例（原式「1 × x = 4 × 6 = 24，x = ？」已算出答案）；
  // 只保留比例式（a∶b = c∶x，均为任务必需已知量），列式与求解由学生完成。
  return finish(q, c0.label + '（' + c0.a + '∶' + c0.b + ' = ' + c0.c + '∶x）。按照这个比，' + c0.ask + '？列比例求 x。',
    x, [String(x)],
    '解比例：' + c0.a + ' × x = ' + c0.b + ' × ' + c0.c + '，x = ' + c0.b + ' × ' + c0.c + ' ÷ ' + c0.a + ' = ' + x + c0.unit);
}

function makeRatioChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = ratioName(plan);
  if (name.indexOf('基本性质') !== -1) {
    var s = solveRatioPick(rng, nrOf(plan));
    var q0 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'solve', unknown: s.x });
    q0.prompt = '根据比例的基本性质解比例 x∶' + s.b + ' = ' + s.c + '∶' + s.d
      + '（x × ' + s.d + ' = ' + s.b + ' × ' + s.c + '），x = ？（  ）';
    var ratioSolveWhy = '比例中两个内项的积等于两个外项的积：x = ' + s.b + ' × ' + s.c + ' ÷ '
      + s.d + ' = ' + s.x + '，正确选项是「' + s.x + '」。';
    return finishChoice(q0, rng, String(s.x), [String(s.x + 1), String(Math.max(1, s.x - 1)), String(s.c)], ratioSolveWhy);
  }
  var p = equalRatiosPick(rng, nrOf(plan));
  var q1 = buildBase(plan, context, i, { subTopic: 'ratio-basics', aspect: 'meaning' });
  q1.prompt = '下面哪组中的两个比可以组成比例？（提示：' + p.a + ' × ' + p.d + ' = ' + (p.a * p.d)
    + '，' + p.b + ' × ' + p.c + ' = ' + (p.b * p.c) + '）（  ）';
  var correct = p.a + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d;
  var wrongs = [
    p.a + '∶' + p.b + ' 和 ' + (p.c + 1) + '∶' + p.d,
    p.a + '∶' + (p.b + 1) + ' 和 ' + p.c + '∶' + p.d,
    (p.a + 1) + '∶' + p.b + ' 和 ' + p.c + '∶' + p.d
  ];
  var ratioMeanWhy = '比例的基本性质：两外项积 ' + p.a + ' × ' + p.d + ' = ' + (p.a * p.d)
    + '，两内项积 ' + p.b + ' × ' + p.c + ' = ' + (p.b * p.c) + '，两积相等（比值也相等），可以组成比例，正确选项是「'
    + correct + '」。';
  return finishChoice(q1, rng, correct, wrongs, ratioMeanWhy);
}

/* ================================================================
 * subTopic × 题型 分派（键 = SemanticParameters.subTopic；覆盖 4 KP 全部 ALLOW 行）
 * ================================================================ */

var SUBTOPIC_MAKERS = {
  'pictorial-additive-relation': {
    calc: makeAddRelCalc, fill: makeAddRelFill, apply: makeAddRelApply,
    choice: makeAddRelChoice, geometry: makeAddRelGeometry
  },
  'periodic-pattern': {
    calc: makePeriodCalc, fill: makePeriodFill, apply: makePeriodApply,
    choice: makePeriodChoice, geometry: makePeriodGeometry
  },
  'scale-transform': {
    calc: makeScaleCalc, fill: makeScaleFill, apply: makeScaleApply,
    choice: makeScaleChoice, geometry: makeScaleGeometry
  },
  'proportion-application': {
    calc: makePropCalc, fill: makePropFill, apply: makePropApply,
    choice: makePropChoice, geometry: makePropGeometry
  },
  // P25-09
  'scale-map': {
    calc: makeMapCalc, fill: makeMapFill, apply: makeMapApply, choice: makeMapChoice
  },
  'ratio-basics': {
    calc: makeRatioCalc, fill: makeRatioFill, apply: makeRatioApply, choice: makeRatioChoice
  }
};

/** 取本 plan 的语义参数：优先 selector 注入；缺省时即时派生（直连调用方/单测兜底，同一 SSOT） */
function paramsOf(plan) {
  if (plan && plan.semanticParams) return plan.semanticParams;
  var kpId = pkp(plan);
  if (!kpId) return null;
  return SemanticParameters.resolve(kpId, plan && (plan.questionTypeId || plan.questionType));
}

function createSemanticRelationsGenerator(spec) {
  spec = spec || {};
  return {
    id: 'generator:semantic-relations',
    subject: 'math',
    capabilities: QTYPES.slice(),
    questionTypes: QTYPES.slice(),
    // 绑定真值源在 generator-registry.js CORE_RECORDS；实例不重复携带 KP 列表。
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return QTYPES.indexOf(plan.questionTypeId) !== -1;
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
  return [createSemanticRelationsGenerator()];
}

module.exports = {
  createSemanticRelationsGenerator: createSemanticRelationsGenerator,
  buildAll: buildAll
};
