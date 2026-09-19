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

var QTYPES = ['calc', 'fill', 'apply', 'choice', 'geometry'];

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
    prompt: '',
    answer: null,
    answerMode: 'input',
    hint: null,
    data: Object.assign({ mode: 'semantic-relations' }, extra || {})
  };
}

function finish(q, prompt, answer, acceptable, explanation) {
  q.prompt = prompt;
  q.answer = {
    value: String(answer),
    acceptable: acceptable || [],
    explanation: explanation || (prompt.replace(/[？?]\s*$/, '') + ' = ' + answer)
  };
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
    var filler = '都不对（' + pool.length + '）';
    if (!seen[filler]) { seen[filler] = 1; pool.push(filler); }
  }
  pool = pool.slice(0, 4);
  var options = Rng.shuffle(rng, pool);
  q.data.options = options;
  q.data.correctIndex = options.indexOf(String(correct));
  return finish(q, q.prompt, String(correct), [], null);
}

/* ================================================================
 * ① pictorial-additive-relation（g1）：画图理解一步加减数量关系
 * ================================================================ */

function makeAddRelCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var take = Rng.randInt(rng, 2, 9);
  var left = Rng.randInt(rng, 2, 9);
  var subtract = (i % 2 === 0);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: subtract ? 'sub' : 'add',
    barModel: true
  });
  if (subtract) {
    return finish(q, '看图列式：盘子里原来有 ' + (take + left) + ' 个桃，小猴子吃掉 ' + take
      + ' 个（在图中圈出吃掉的部分）。还剩多少个？', left, [],
      '总数 − 吃掉的部分 = 剩下的部分：' + (take + left) + ' − ' + take + ' = ' + left);
  }
  return finish(q, '看图列式：草地上左边有 ' + left + ' 只羊，右边又来了 ' + take
    + ' 只羊（在图中画出两部分）。一共有多少只羊？', take + left, [],
    '两部分合起来：' + left + ' + ' + take + ' = ' + (take + left));
}

function makeAddRelFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 3, 9);
  var b = Rng.randInt(rng, 3, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
  });
  return finish(q, '看线段图填空：第一条线段表示 ' + a + '，第二条线段表示 ' + b
    + '，两条线段合起来表示（  ）。', a + b, [String(a + b)],
    a + ' + ' + b + ' = ' + (a + b));
}

function makeAddRelApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var base = Rng.randInt(rng, 5, 12);
  var diff = Rng.randInt(rng, 2, 8);
  var more = (i % 2 === 0);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation',
    operation: more ? 'add' : 'sub',
    barModel: true,
    comparison: more ? 'more' : 'less'
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
  var a = Rng.randInt(rng, 4, 9);
  var b = Rng.randInt(rng, 4, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
  });
  q.prompt = '线段图把总数分成两部分：第一部分是 ' + a + '，第二部分是 ' + b
    + '。求总数应该用下面哪个算式？（  ）';
  return finishChoice(q, rng, a + ' + ' + b,
    [a + ' − ' + b, b + ' − ' + a, a + ' × ' + b]);
}

function makeAddRelGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var a = Rng.randInt(rng, 4, 9);
  var longer = Rng.randInt(rng, 2, 6);
  var q = buildBase(plan, context, i, {
    subTopic: 'pictorial-additive-relation', operation: 'add', barModel: true
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

function patternPick(rng) {
  var n = Rng.randInt(rng, 2, 4);
  var shapes = Rng.shuffle(rng, PATTERN_SHAPES).slice(0, n);
  var period = Rng.randInt(rng, 7, 30);
  var rem = period % n;
  var shape = rem === 0 ? shapes[n - 1] : shapes[rem - 1];
  var quotient = Math.floor(period / n);
  return { n: n, shapes: shapes, period: period, rem: rem, shape: shape, quotient: quotient };
}

function makePeriodCalc(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
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
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  return finish(q, '图形按「' + p.shapes.join('') + '」为一组重复排列，第 ' + p.period
    + ' 个图形是（  ）。', p.shape, [p.shapes],
    p.period + ' ÷ ' + p.n + ' = ' + p.quotient + '……' + p.rem
      + '，余数 ' + (p.rem === 0 ? '0（取末位）' : p.rem) + ' → 「' + p.shape + '」');
}

function makePeriodApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var items = [['红旗', '黄旗', '蓝旗'], ['红花', '黄花', '蓝花'], ['红灯笼', '黄灯笼', '蓝灯笼']];
  var set = Rng.pick(rng, items);
  var n = set.length;
  var k = Rng.randInt(rng, 10, 40);
  var rem = k % n;
  var which = rem === 0 ? set[n - 1] : set[rem - 1];
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: n, periodPosition: k, remainder: rem
  });
  return finish(q, '学校大门前按「' + set.join('、') + '」的顺序循环挂彩旗，第 ' + k
    + ' 面彩旗是什么颜色？', which, [which],
    k + ' ÷ ' + n + ' = ' + Math.floor(k / n) + '……' + rem
      + '，余数 ' + (rem === 0 ? '0（取每组最后）' : rem) + ' → ' + which);
}

function makePeriodChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem
  });
  q.prompt = '图形按「' + p.shapes.join('') + '」为一组重复排列，第 ' + p.period
    + ' 个图形是哪个？（  ）';
  var distractors = PATTERN_SHAPES.filter(function (s) { return s !== p.shape; }).slice(0, 3);
  return finishChoice(q, rng, p.shape, distractors);
}

function makePeriodGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var p = patternPick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'periodic-pattern', operation: 'div',
    periodLength: p.n, periodPosition: p.period, remainder: p.rem,
    graphicPattern: p.shapes.join('')
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
    + ' 的比' + (s.enlarge ? '放大' : '缩小') + '，变换后的长是多少厘米？', s.next, [String(s.next)],
    (s.enlarge ? '放大到 ' + s.k + ' 倍：' : '缩小到 1/' + s.k + '：')
      + s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next + ' 厘米');
}

function makeScaleFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next
  });
  return finish(q, '把一个边长 ' + s.orig + ' 厘米的正方形按 ' + ratio + ' 的比'
    + (s.enlarge ? '放大' : '缩小') + '，变换后正方形的边长是（  ）厘米。', s.next, [String(s.next)],
    s.orig + (s.enlarge ? ' × ' : ' ÷ ') + s.k + ' = ' + s.next);
}

function makeScaleApply(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform',
    scaleRatio: s.enlarge ? (s.k + ':1') : ('1:' + s.k),
    fromLength: s.orig, toLength: s.next
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
    fromLength: s.orig, toLength: s.next
  });
  q.prompt = '一个图形按 ' + ratio + ' 的比' + (s.enlarge ? '放大' : '缩小')
    + '，原长 ' + s.orig + ' 厘米，变换后的长是多少厘米？（  ）';
  return finishChoice(q, rng, String(s.next),
    [String(s.orig), String(s.next + s.k), String(Math.max(1, s.next - 1))]);
}

function makeScaleGeometry(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var s = scalePick(rng);
  var ratio = s.enlarge ? (s.k + ':1') : ('1:' + s.k);
  var q = buildBase(plan, context, i, {
    subTopic: 'scale-transform', scaleRatio: ratio,
    fromLength: s.orig, toLength: s.next, gridFigure: true
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
  // 正比例归一：a 件共 c 元（单价整数），求 b 件
  var unit = Rng.pick(rng, [2, 3, 4, 5, 6, 8]);
  var a = Rng.randInt(rng, 2, 6);
  var b = Rng.randInt(rng, 2, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b
  });
  return finish(q, '列式计算：买 ' + a + ' 支同样的钢笔要用 ' + (a * unit)
    + ' 元，买 ' + b + ' 支这样的钢笔要用多少元？', b * unit, [String(b * unit)],
    '先求单价（归一）：' + (a * unit) + ' ÷ ' + a + ' = ' + unit + ' 元；'
      + b + ' × ' + unit + ' = ' + (b * unit) + ' 元');
}

function makePropFill(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // 正比例：速度恒定
  var speed = Rng.pick(rng, [40, 50, 60, 70, 80]);
  var t1 = Rng.randInt(rng, 2, 4);
  var t2 = Rng.randInt(rng, 5, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    speed: speed, hoursA: t1, hoursB: t2
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
    total: total, perRowA: c.per1, rowsA: c.rows1, perRowB: c.per2
  });
  return finish(q, '同学们排队做操，每行站 ' + c.per1 + ' 人，正好站 ' + c.rows1
    + ' 行。如果每行站 ' + c.per2 + ' 人，可以站多少行？', rows2, [String(rows2)],
    '总人数一定，每行人数与行数成反比例：' + c.per1 + ' × ' + c.rows1 + ' = ' + total
      + '（人），' + total + ' ÷ ' + c.per2 + ' = ' + rows2 + ' 行');
}

function makePropChoice(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var unit = Rng.pick(rng, [3, 4, 5, 6]);
  var a = Rng.randInt(rng, 2, 5);
  var b = Rng.randInt(rng, 6, 9);
  var q = buildBase(plan, context, i, {
    subTopic: 'proportion-application', proportion: 'direct',
    unitPrice: unit, quantityA: a, quantityB: b
  });
  q.prompt = '买 ' + a + ' 千克苹果付了 ' + (a * unit) + ' 元，买 ' + b
    + ' 千克同样的苹果要付多少元？（  ）';
  return finishChoice(q, rng, String(b * unit) + ' 元',
    [String((a * unit) + b) + ' 元', String(a * b) + ' 元', String(a + b + unit) + ' 元']);
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
    poleHeight: c.h1, poleShadow: c.s1, treeShadow: c.s2
  });
  return finish(q, '看示意图：同一时刻，一根 ' + c.h1 + ' 米长的竹竿影长是 ' + c.s1
    + ' 米，旁边一棵树的影长是 ' + c.s2 + ' 米。这棵树高多少米？', h2, [String(h2)],
    '同一时刻物高与影长成正比例：' + c.h1 + ':' + c.s1 + ' = 树高:' + c.s2
      + '，树高 = ' + c.h1 + ' × ' + c.s2 + ' ÷ ' + c.s1 + ' = ' + h2 + ' 米');
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
      return out;
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
