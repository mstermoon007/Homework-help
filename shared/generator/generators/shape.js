'use strict';

/**
 * shared/generator/generators/shape.js — Shape Generator
 *
 * 图形族 Generator：基于 KP 语义约束生成几何图形题目
 * - graphicType / factualContent / operation 决定图形类型、识别/分类/特征
 * - 严禁 shape KP 退化为 arithmetic
 * - 输出 SemanticQuestion.data.graphic 供 GraphicRenderer 派发
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
  if (context && context.seed != null) return context.seed + ':shape:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':shape:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':shape:' + i;
}

// 图形类型映射：legacyType → SVGGeometry subtype
var SHAPE_SUBTYPE = {
  // 立体图形
  'solid': 'cuboid',
  'cube': 'cube',
  'cuboid': 'cuboid',
  'cylinder': 'cylinder',
  'cone': 'cone',
  'sphere': 'sphere',
  // 平面图形
  'flat': 'rectangle',
  'rectangle': 'rectangle',
  'square': 'square',
  'triangle': 'triangle',
  'circle': 'circle',
  'parallelogram': 'parallelogram',
  'trapezoid': 'trapezoid',
  'line-segment': 'line-segment',
  'angle': 'angle',
  'symmetry': 'rectangle',
  'tessellation': 'rectangle',
  // 复合/识别
  'match-shape': 'rectangle',
  'count-graph': 'rectangle',
  'draw-shape': 'rectangle',
  'shape-combine': 'rectangle'
};

// P25-08：图形特征提示词（扩展覆盖 D 类 geometric-figure KP 的细分子类型）
var SHAPE_FEATURES = {
  'solid': { name: '立体图形', features: ['有长宽高', '占据空间', '有体积'], examples: ['长方体', '正方体', '圆柱', '圆锥', '球'] },
  'cube': { name: '正方体', features: ['6个面都是正方形', '棱长相等', '12条棱', '8个顶点'], examples: ['魔方', '骰子'] },
  'cuboid': { name: '长方体', features: ['6个面都是长方形', '相对的面相等', '12条棱分3组'], examples: ['文具盒', '砖头'] },
  'cylinder': { name: '圆柱', features: ['2个圆形底面', '1个侧面', '侧面展开是长方形'], examples: ['铅笔', '水桶'] },
  'cone': { name: '圆锥', features: ['1个圆形底面', '1个顶点', '侧面展开是扇形'], examples: ['路锥', '帽子'] },
  'sphere': { name: '球', features: ['没有棱和面', '滚动最快', '任意剖面是圆'], examples: ['皮球', '地球仪'] },
  'flat': { name: '平面图形', features: ['只有长和宽', '没有厚度', '在平面上'], examples: ['长方形', '正方形', '三角形', '圆'] },
  'rectangle': { name: '长方形', features: ['4个角都是直角', '对边相等', '对角线相等'], examples: ['课本', '黑板'] },
  'square': { name: '正方形', features: ['4条边相等', '4个角都是直角', '对角线相等且互相垂直平分'], examples: ['手帕', '棋盘格'] },
  'triangle': { name: '三角形', features: ['3条边', '3个角', '内角和180度'], examples: ['三角尺', '屋顶'] },
  'circle': { name: '圆', features: ['没有直线边', '到圆心距离相等', '周长=2πr'], examples: ['硬币', '时钟面'] },
  'parallelogram': { name: '平行四边形', features: ['对边平行且相等', '对角互补'], examples: ['推拉窗'] },
  'trapezoid': { name: '梯形', features: ['一组对边平行', '腰不等长'], examples: ['裙子', '灯罩'] },
  'line-segment': { name: '线段', features: ['有两个端点', '可以度量长度', '是直线的一部分'], examples: ['尺子的边', '桌子棱'] },
  'angle': { name: '角', features: ['有一个顶点', '两条边是射线', '有大小（度）'], examples: ['三角尺的角', '墙角'] },
  'symmetry': { name: '轴对称图形', features: ['沿对称轴对折两边重合', '至少1条对称轴', '对应点到对称轴距离相等'], examples: ['蝴蝶', '双喜字'] },
  'tessellation': { name: '密铺', features: ['无缝隙不重叠铺满平面', '拼接点处角度和为360度', '可重复单元'], examples: ['地砖', '蜂巢'] }
};

// P28-GEN-SHAPE-FLAT-SAMPLE-01：flat 兜底族取样域——小学核心平面图形五种，
// 与「认识平面图形」类 KP 的 concept（长方形/正方形/三角形/圆/平行四边形）一致；
// 顺序固定，具体取样由每题种子 rng 决定（同 KP 多题可出现不同图形）。
var FLAT_FAMILY = ['rectangle', 'square', 'triangle', 'circle', 'parallelogram'];

// P25-08：由 KP 名称机械派生图形子类型（替代 kp.source.legacyType 的 kp={} 恒 flat 问题）。
// 顺序敏感：具体形状优先于泛称（如「正方形」先于「图形」；
// P28-DEF-012：「圆柱/圆锥」必须先于「圆」，否则被 /圆/ 提前命中误派生为 circle；
// P28-DEF-015：「正方体/立方」与「长方体」必须先于「正方/长方」，
// 否则立体图形 KP（观察正方体、长方体/正方体的特征、正方体涂色系）被误派生为 square/rectangle）。
var NAME_TO_SHAPE = [
  { re: /正方体|立方/, type: 'cube' },
  { re: /长.*体|长方体/, type: 'cuboid' },
  { re: /正方/, type: 'square' },
  { re: /长方/, type: 'rectangle' },
  { re: /三角/, type: 'triangle' },
  { re: /圆柱/, type: 'cylinder' },
  { re: /圆锥/, type: 'cone' },
  { re: /圆/, type: 'circle' },
  { re: /平行四边形/, type: 'parallelogram' },
  { re: /梯形/, type: 'trapezoid' },
  { re: /线段|画线段/, type: 'line-segment' },
  { re: /角(的|各|度|认)/, type: 'angle' },
  { re: /对称/, type: 'symmetry' },
  { re: /密铺/, type: 'tessellation' },
  { re: /球/, type: 'sphere' },
  { re: /立体/, type: 'solid' },
  { re: /平面|图形/, type: 'flat' }
];

function deriveShapeTypeFromName(name) {
  if (!name || typeof name !== 'string') return null;
  for (var i = 0; i < NAME_TO_SHAPE.length; i++) {
    if (NAME_TO_SHAPE[i].re.test(name)) return NAME_TO_SHAPE[i].type;
  }
  return null;
}

function getShapeMeta(kp, name) {
  // P25-08：优先由 plan.semanticParams.name 派生具体图形类型；
  // 回退链：name 派生 → kp.source.legacyType → kp.legacy.legacyType → flat。
  var lt = deriveShapeTypeFromName(name)
    || (kp && kp.source && kp.source.legacyType)
    || (kp && kp.legacy && kp.legacy.legacyType)
    || 'flat';
  var cat = kp && kp.legacy && kp.legacy.category;
  var subtype = SHAPE_SUBTYPE[lt] || 'rectangle';
  var meta = SHAPE_FEATURES[lt] || { name: '图形', features: ['有形状', '可识别'], examples: ['各种图形'] };
  return { legacyType: lt, category: cat, subtype: subtype, meta: meta };
}

function generateGraphicParams(subtype, difficulty, rng) {
  // 根据难度和子类型生成 SVGGeometry 参数
  var unitPx = 25;
  var unit = 'cm';
  var maxDim = Math.min(12, 3 + difficulty);
  var minDim = Math.max(1, difficulty - 1);

  switch (subtype) {
    case 'square':
    case 'rectangle':
      // 平面图形尺寸控制在 2cm 以内（unitPx=25 → 最长边 50px）；不标记直角。
      // 注意：svg-geometry 渲染端 rightAngle 默认开（!== false 即画），必须显式 false。
      return {
        type: 'geometry',
        subtype: subtype,
        params: {
          width: Rng.randInt(rng, 1, 2),
          height: subtype === 'square' ? undefined : Rng.randInt(rng, 1, 2),
          size: subtype === 'square' ? Rng.randInt(rng, 1, 2) : undefined,
          labelSides: rng() < 0.7,
          rightAngle: false,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'triangle':
      var a = Rng.randInt(rng, 1, 2);
      return {
        type: 'geometry',
        subtype: 'triangle',
        params: {
          p1: [0, 0],
          p2: [a, 0],
          p3: [Rng.randInt(rng, 0, a), Rng.randInt(rng, 1, 2)],
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cuboid':
    case 'cube':
      var edge = Rng.randInt(rng, 2, maxDim);
      return {
        type: 'geometry',
        subtype: subtype,
        params: {
          length: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          width: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          height: subtype === 'cube' ? edge : Rng.randInt(rng, minDim, maxDim),
          edge: subtype === 'cube' ? edge : undefined,
          labelSides: rng() < 0.7,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cylinder':
      return {
        type: 'geometry',
        subtype: 'cylinder',
        params: {
          r: Rng.randInt(rng, 1, Math.max(2, Math.floor(maxDim/2))),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'cone':
      return {
        type: 'geometry',
        subtype: 'cone',
        params: {
          r: Rng.randInt(rng, 1, Math.max(2, Math.floor(maxDim/2))),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: rng() < 0.6,
          unit: unit,
          unitPx: unitPx
        }
      };
    // P28-GEN-SHAPE-FLAT-SAMPLE-01：flat 族取样新增两类平面图形参数分支
    // （svg-geometry.js 已注册对应渲染器：circle{r}/parallelogram{base,height,offset}）
    case 'circle':
      return {
        type: 'geometry',
        subtype: 'circle',
        params: {
          r: 1, // 半径 1cm → 直径 2cm，满足平面图形 ≤2cm
          labelRadius: false,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'parallelogram':
      var pBase = Rng.randInt(rng, 1, 2);
      return {
        type: 'geometry',
        subtype: 'parallelogram',
        params: {
          base: pBase,
          height: Rng.randInt(rng, 1, pBase),
          offset: Rng.randInt(rng, 1, pBase),
          labelSides: rng() < 0.6,
          // 渲染端 showHeight 默认开且伴随直角符号（!== false 即画），显式关闭以满足不标直角
          showHeight: false,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'trapezoid':
      // P28-DEF011：补 trapezoid 参数分支（svg-geometry.js 已注册 trapezoid{topBase,bottomBase,height} 渲染器，
      // 此前缺 case 导致「梯形」KP 落入 default 画长方形答「梯形」图形与答案不一致）。
      // 平面图形 ≤2cm：整数约束下 topBase<bottomBase 唯一解为上底 1cm、下底 2cm；高 1~2cm。
      // 渲染端 showHeight 默认开且伴随直角符号（同 parallelogram），显式关闭以满足不标直角。
      var tHeight = Rng.randInt(rng, 1, 2);
      return {
        type: 'geometry',
        subtype: 'trapezoid',
        params: {
          topBase: 1,
          bottomBase: 2,
          height: tHeight,
          labelSides: rng() < 0.6,
          showHeight: false,
          unit: unit,
          unitPx: unitPx
        }
      };
    default:
      // 兜底为长方形（同样 ≤2cm、不标直角）
      return {
        type: 'geometry',
        subtype: 'rectangle',
        params: {
          width: Rng.randInt(rng, 1, 2),
          height: Rng.randInt(rng, 1, 2),
          labelSides: true,
          rightAngle: false,
          unit: unit,
          unitPx: unitPx
        }
      };
  }
}

function makeRecognitionQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var feature = Rng.pick(rng, shapeMeta.meta.features);
  var examples = shapeMeta.meta.examples;
  var prompt = '下列哪个是' + shapeMeta.meta.name + '的特征？';
  var correct = feature;
  var distractors = examples.filter(function(e){ return e !== feature; }).slice(0, 3);
  if (distractors.length < 3) {
    distractors = distractors.concat(['无棱无面', '只有长宽', '不能滚动', '面是圆形'].filter(function(d){ return distractors.indexOf(d) === -1 && d !== feature; }));
  }
  var options = Rng.shuffle(rng, [correct].concat(distractors).slice(0, 4));
  var correctIndex = options.indexOf(correct);

  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [] },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      graphic: graphic,
      options: options,
      correctIndex: correctIndex,
      feature: feature,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeClassificationQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var allShapes = Object.keys(SHAPE_FEATURES);
  var target = shapeMeta.legacyType;
  var prompt = '下列哪个图形属于' + shapeMeta.meta.name + '？';
  // P25-07：选项用中文图形名（原 legacyType 英文键在 kp={} 时为 undefined，
  // 序列化后成 null 选项，违反 choice 契约 optionsPresent 的字符串要求）
  var correct = shapeMeta.meta.name;
  var distractorNames = allShapes.filter(function (s) { return s !== target; }).slice(0, 3)
    .map(function (s) { return SHAPE_FEATURES[s].name; });
  if (distractorNames.length < 3) {
    distractorNames = distractorNames.concat(['立体图形', '长方体', '圆柱']
      .filter(function (d) { return distractorNames.indexOf(d) === -1 && d !== correct; }));
  }
  var options = Rng.shuffle(rng, [correct].concat(distractorNames).slice(0, 4));
  var correctIndex = options.indexOf(correct);

  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [] },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      graphic: graphic,
      options: options,
      correctIndex: correctIndex,
      targetShape: target,
      shapeName: shapeMeta.meta.name
    }
  };
}

var FALSE_FEATURE_POOL = ['无棱无面', '只有长和宽', '不能滚动', '面是圆形', '有棱有角'];

function makeFeatureQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var isTrue = rng() < 0.5;
  var feature = Rng.pick(rng, shapeMeta.meta.features);
  var shown = feature;
  if (!isTrue) {
    // V5.1.0：假命题特征必须不属于该图形，排除真实特征，保证命题真值唯一；
    // 候选全为真实特征时回退为真命题（不假造可能成立的说法）
    var wrongs = FALSE_FEATURE_POOL.filter(function (f) {
      return shapeMeta.meta.features.indexOf(f) === -1;
    });
    if (wrongs.length) shown = Rng.pick(rng, wrongs);
    else isTrue = true;
  }
  var shapeName = shapeMeta.meta.name;
  var prompt = shapeName + '的特征是：「' + shown + '」—— 对还是错？';
  var explanation = isTrue
    ? '「' + shown + '」是' + shapeName + '的特征，说法正确。'
    : '「' + shown + '」不是' + shapeName + '的特征，说法错误。';
  var data = {
    mode: 'judge',
    steps: 1,
    graphic: graphic,
    shownFeature: shown,
    shapeName: shapeName
  };
  if (!isTrue) data.misconception = '图形特征混淆：把「' + shown + '」误当成了' + shapeName + '的特征。';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: isTrue, acceptable: [], explanation: explanation },
    answerMode: 'judge',
    data: data
  };
}

function makeNamingQuestion(plan, context, i, shapeMeta, graphic) {
  var prompt = '请写出该图形的名称：';
  var answer = shapeMeta.meta.name; var answerObj = { value: answer, acceptable: [] };

  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      graphic: graphic,
      targetName: shapeMeta.meta.name,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeCountQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var count = Rng.randInt(rng, 3, 6);
  var prompt = '图中共有几个' + shapeMeta.meta.name + '？';
  var answer = String(count); var answerObj = { value: answer, acceptable: [] };

  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      graphic: graphic,
      targetCount: count,
      shapeName: shapeMeta.meta.name
    }
  };
}

// P28-GEO-NATIVE-01：g6-up-u02-k001「分数乘整数」原生 maker（geometry/fill/choice/judge/apply 五行）。
// 此前这些行经 shape 泛型兜底落入 flat 随机认图（认三角形/正方形），与分数乘整数语义无关。
// 模型：单位分数条线段——把单位“1”平均分成 den 份，取 num 份，重复 times 次，
// 求一共取了多少（num/den × times）。图形走已注册的 geometry.segment 描述符，禁止新增渲染层。
// 证据形态（kbl/teaching/evidence-rules.json）：五行均要 graphic.type=geometry+unit=cm；
// judge steps=1/apply steps=2 另要 unitPx=25；KP semantic.operations=[]，严禁 data.operation
// （8 条 relationNot，含 multiply-by-times / fraction-meaning 等）。
function makeFractionTimesIntegerQuestion(plan, context, i, kpName) {
  var qt = plan.questionTypeId;
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var den = Rng.pick(rng, [4, 5, 6, 8]);
  var num = Rng.randInt(rng, 1, den - 2);
  var times = Rng.pick(rng, [2, 3]);
  var numerator = num * times;
  var mixedWhole = Math.floor(numerator / den);
  var mixedRemain = numerator % den;
  var fracStr = numerator + '/' + den;
  var answerStr = fracStr;
  var acceptable = [];
  if (mixedWhole > 0 && mixedRemain > 0) acceptable.push(mixedWhole + '又' + mixedRemain + '/' + den);
  if (mixedRemain === 0) answerStr = String(mixedWhole);
  var expr = num + '/' + den + ' × ' + times;

  function fracGraphic(unitPx) {
    var params = { total: den, part: num, unit: 'cm', partLabel: String(num), totalLabel: String(den) };
    if (unitPx) params.unitPx = unitPx;
    return { type: 'geometry', subtype: 'segment', params: params };
  }

  var data = {
    mode: qt,
    steps: 1,
    kind: 'fraction-times-integer',
    graphic: fracGraphic(null),
    fractionNumerator: num,
    fractionDenominator: den,
    times: times
  };
  var prompt, answerObj, answerMode = 'input';

  if (qt === 'geometry') {
    prompt = '看图列式计算：把单位“1”平均分成 ' + den + ' 份，取其中的 ' + num +
      ' 份表示 ' + num + '/' + den + '。这样的 ' + times + ' 份，一共是单位“1”的几分之几？' +
      expr + ' = ____';
    answerObj = { value: answerStr, acceptable: acceptable };
  } else if (qt === 'fill') {
    prompt = '看图填空：分数条把单位“1”平均分成 ' + den + ' 份，涂色部分表示 ' + num + '/' + den
      + '。同样的涂色部分有 ' + times + ' 条，合起来是 ' + expr + ' = ____。';
    answerObj = { value: answerStr, acceptable: acceptable };
  } else if (qt === 'choice') {
    // 四个互异分数选项（同分母，含正确值），correctIndex 随洗牌定位
    var pool = [answerStr];
    [num * (times + 1), numerator + 1, numerator - 1, numerator + 2, numerator - 2].forEach(function (x) {
      var s = x + '/' + den;
      if (x >= 1 && pool.indexOf(s) === -1 && pool.length < 4) pool.push(s);
    });
    var options = Rng.shuffle(rng, pool);
    data.options = options;
    data.correctIndex = options.indexOf(answerStr);
    prompt = '看图选择：分数条涂色部分是 ' + num + '/' + den + '，有 ' + times
      + ' 条同样的涂色部分。' + expr + ' 的结果是哪个？';
    answerObj = { value: answerStr, acceptable: acceptable };
    answerMode = 'choice';
  } else if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    var shownNum = isTrue ? numerator : numerator + 1;
    data.graphic = fracGraphic(25);
    prompt = '看图判断：' + num + '/' + den + ' 乘 ' + times + '，' + times + ' 条涂色部分合起来表示 '
      + shownNum + '/' + den + '。这个说法对吗？';
    answerObj = {
      value: isTrue,
      acceptable: [],
      explanation: isTrue
        ? expr + ' = ' + fracStr + '，分子乘整数、分母不变，说法正确。'
        : expr + ' = ' + fracStr + '，不是 ' + shownNum + '/' + den + '，说法错误。'
    };
    answerMode = 'judge';
  } else { // apply，steps=2
    data.steps = 2;
    data.graphic = fracGraphic(25);
    prompt = '看图解决问题：一根彩带长 ' + num + '/' + den + ' 米（分数条平均分成 ' + den
      + ' 份、涂色 ' + num + ' 份）。先说出一根彩带的长度，再列式计算 ' + times
      + ' 根这样的彩带一共长多少米：' + expr + ' = ？（米）';
    answerObj = { value: answerStr, acceptable: acceptable };
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answerObj,
    answerMode: answerMode,
    data: data
  };
}

function makeGeometryQuestion(plan, context, i, shapeMeta, graphic, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // geometry qt：输出带 graphic descriptor 的填充题/判断题
  // 基于 KP 名称构建题干，让学生识别/测量图形
  var name = kpName || '几何图形';
  var angleWords = ['角', '直角', '锐角', '钝角', '平角', '周角'];
  var isAngle = angleWords.some(function(w){ return name.indexOf(w) !== -1; });
  var prompt;
  var answer;
  var answerMode;

  if (isAngle) {
    // 角度识别
    var angleType = rng() < 0.33 ? '直角' : (rng() < 0.5 ? '锐角' : '钝角');
    prompt = '图中显示的是什么角？';
    answer = { value: angleType, acceptable: ['90度', '90°'] };
    answerMode = 'input';
  } else {
    // 通用几何图形识别——P28-GEN-SHAPE-FLAT-SAMPLE-01：题干多表达方案，按该题 rng
    // 确定性选取（同种子恒定，重新生成在种子变化时呈现不同问法）。
    // 答案为实际所画图形名（qMeta.meta.name），与「名称」类问法自洽。
    var GEOMETRY_PROMPTS = [
      '请观察图形，' + name,
      name + '：看一看，图中画的是什么图形？',
      '观察图中的图形，写出它的名称。',
      name + '：先说一说它是谁，再写出名称。',
      '图中画了一个图形，它叫什么名字？'
    ];
    prompt = GEOMETRY_PROMPTS[Math.floor(rng() * GEOMETRY_PROMPTS.length)];
    answer = { value: shapeMeta.meta.name, acceptable: [] };
    answerMode = 'input';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'geometry',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answer,
    answerMode: answerMode,
    data: {
      mode: 'geometry',
      steps: 1,
      graphic: graphic,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kpName || '几何应用';
  // 几何 apply 题：面积/周长/体积/对称/变换 等
  var isArea = name.indexOf('面积') !== -1 || name.indexOf('周长') !== -1 || name.indexOf('表面积') !== -1;
  var isVolume = name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('体积') !== -1 || name.indexOf('表面积') !== -1;
  var isCircle = name.indexOf('圆') !== -1;
  var isCoord = name.indexOf('数对') !== -1 || name.indexOf('坐标') !== -1;
  var isMotion = name.indexOf('旋转') !== -1 || name.indexOf('对称') !== -1 || name.indexOf('平移') !== -1;
  var isFeature = name.indexOf('特征') !== -1 || name.indexOf('认识') !== -1;
  var isSolid = name.indexOf('正方') !== -1 || name.indexOf('长方') !== -1 ||
    name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('球') !== -1;
  var prompt, answer, answerMode;

  if (isFeature && isSolid) {
    // 立体图形特征：面/棱/顶点数量
    var isCube = name.indexOf('正方') !== -1;
    var faces = 6;
    var featPrompt;
    if (isCube) {
      featPrompt = '正方体有 6 个面、12 条棱、8 个顶点。';
    } else if (name.indexOf('长方') !== -1) {
      featPrompt = '长方体有 6 个面、12 条棱、8 个顶点。';
    } else if (name.indexOf('圆柱') !== -1) {
      featPrompt = '圆柱有 2 个底面和 1 个侧面。';
    } else if (name.indexOf('圆锥') !== -1) {
      featPrompt = '圆锥有 1 个底面和 1 个顶点。';
    } else {
      featPrompt = '球没有平面，只有一个曲面。';
    }
    prompt = name + '：' + featPrompt + ' 请说出它有几个面？';
    answer = { value: String(faces), acceptable: [faces + '个'] };
    answerMode = 'input';
  } else if (isCircle && name.indexOf('周长') !== -1) {
    var r = Rng.randInt(rng, 3, 10);
    var circ = Math.round(2 * 3.14 * r * 100) / 100;
    prompt = '一个圆的半径是 ' + r + ' 厘米，求它的周长。（π取3.14）';
    answer = { value: String(circ), acceptable: [circ + '厘米'] };
    answerMode = 'input';
  } else if (isCircle && name.indexOf('面积') !== -1) {
    var rc = Rng.randInt(rng, 3, 10);
    var areaC = Math.round(3.14 * rc * rc * 100) / 100;
    prompt = '一个圆的半径是 ' + rc + ' 厘米，求它的面积。（π取3.14）';
    answer = { value: String(areaC), acceptable: [areaC + '平方厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('周长') !== -1) {
    var pw = Rng.randInt(rng, 4, 15);
    var ph = Rng.randInt(rng, 3, 12);
    var peri = 2 * (pw + ph);
    prompt = '一个长方形，长' + pw + '厘米，宽' + ph + '厘米，求它的周长。';
    answer = { value: String(peri), acceptable: [peri + '厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('表面积') !== -1) {
    var sw = Rng.randInt(rng, 3, 8);
    var sh = Rng.randInt(rng, 2, 6);
    var sd = Rng.randInt(rng, 2, 6);
    var surf = 2 * (sw * sh + sw * sd + sh * sd);
    prompt = '一个长方体，长' + sw + '厘米，宽' + sd + '厘米，高' + sh + '厘米，求它的表面积。';
    answer = { value: String(surf), acceptable: [surf + '平方厘米'] };
    answerMode = 'input';
  } else if (name.indexOf('圆锥') !== -1 && name.indexOf('体积') !== -1) {
    var vr = Rng.randInt(rng, 2, 6);
    var vh = Rng.randInt(rng, 3, 9);
    var vol = Math.round(3.14 * vr * vr * vh / 3 * 100) / 100;
    prompt = '一个圆锥，底面半径' + vr + '厘米，高' + vh + '厘米，求它的体积。（π取3.14）';
    answer = { value: String(vol), acceptable: [vol + '立方厘米'] };
    answerMode = 'input';
  } else if (isArea) {
    var width = Rng.randInt(rng, 4, 15);
    var height = Rng.randInt(rng, 3, 12);
    var area = width * height;
    prompt = '一个长方形，长' + width + '厘米，宽' + height + '厘米，求它的面积。';
    answer = { value: String(area), acceptable: [String(area) + '平方厘米'] };
    answerMode = 'input';
  } else if (isVolume) {
    var r = Rng.randInt(rng, 3, 8);
    var h = Rng.randInt(rng, 5, 15);
    prompt = '一个圆柱，底面半径' + r + '厘米，高' + h + '厘米，求它的体积。（π取3.14）';
    answer = { value: String(Math.round(3.14 * r * r * h)), acceptable: [] };
    answerMode = 'input';
  } else if (isCoord) {
    prompt = name + '：请在方格纸上标出点的位置，说一说你是怎样确定位置的？';
    answer = { value: '已标注', acceptable: [] };
    answerMode = 'input';
  } else if (isMotion) {
    prompt = name + '：请说一说图形变换的三要素是什么？';
    answer = { value: '旋转中心、旋转方向、旋转角度', acceptable: [] };
    answerMode = 'input';
  } else {
    // FINAL-138：非度量类 KP（图形认识/分类/长度单位等）不得套用面积计算模板，
    // 否则「认识厘米和米」「分类」等 KP 会被生成「求面积」跨概念题。
    // 出与 KP 名称绑定的生活观察开放任务（范式同上方 isCoord 分支）；
    // 场景按 item 序号轮换，保证同批题目的去重指纹互不相同。
    var scenes = ['教室里', '家里', '操场上', '上学的路上', '文具盒里', '积木堆里', '超市里', '公园中'];
    prompt = name + '：请在' + scenes[i % scenes.length] + '找一找与它有关的例子，说一说你是怎样想的？';
    answer = { value: '举例合理即可', acceptable: [] };
    answerMode = 'input';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'apply',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answer,
    answerMode: answerMode,
    data: {
      mode: 'apply',
      steps: 2,
      graphic: graphic,
      shapeName: shapeMeta.meta.name
    }
  };
}

// P25-08：几何度量计算题型（calc）—— 题干必须内嵌算式以满足 calc 不变式
function makeCalcMeasurementQuestion(plan, context, i, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kpName || '几何计算';
  var prompt, answer;

  if (name.indexOf('圆') !== -1 && name.indexOf('周长') !== -1) {
    var r = Rng.randInt(rng, 3, 10);
    var circ = Math.round(2 * 3.14 * r * 100) / 100;
    prompt = '列式计算：半径 ' + r + ' 厘米的圆，周长 = 2 × 3.14 × ' + r + ' = ？（厘米）';
    answer = String(circ);
  } else if (name.indexOf('圆') !== -1 && name.indexOf('面积') !== -1) {
    var rc = Rng.randInt(rng, 3, 10);
    var areaC = Math.round(3.14 * rc * rc * 100) / 100;
    prompt = '列式计算：半径 ' + rc + ' 厘米的圆，面积 = 3.14 × ' + rc + ' × ' + rc + ' = ？（平方厘米）';
    answer = String(areaC);
  } else if (name.indexOf('周长') !== -1) {
    var pw = Rng.randInt(rng, 4, 15);
    var ph = Rng.randInt(rng, 3, 12);
    var peri = 2 * (pw + ph);
    prompt = '列式计算：长方形长 ' + pw + ' 厘米，宽 ' + ph + ' 厘米，周长 = 2 × (' + pw + ' + ' + ph + ') = ？（厘米）';
    answer = String(peri);
  } else if (name.indexOf('表面积') !== -1) {
    var sw = Rng.randInt(rng, 3, 8);
    var sh = Rng.randInt(rng, 2, 6);
    var sd = Rng.randInt(rng, 2, 6);
    var surf = 2 * (sw * sh + sw * sd + sh * sd);
    prompt = '列式计算：长方体长 ' + sw + '、宽 ' + sd + '、高 ' + sh + ' 厘米，表面积 = 2 × (' + sw + '×' + sh + ' + ' + sw + '×' + sd + ' + ' + sh + '×' + sd + ') = ？（平方厘米）';
    answer = String(surf);
  } else if (name.indexOf('圆锥') !== -1 && name.indexOf('体积') !== -1) {
    var vr = Rng.randInt(rng, 2, 6);
    var vh = Rng.randInt(rng, 3, 9);
    var vol = Math.round(3.14 * vr * vr * vh / 3 * 100) / 100;
    prompt = '列式计算：圆锥底面半径 ' + vr + ' 厘米，高 ' + vh + ' 厘米，体积 = 3.14 × ' + vr + ' × ' + vr + ' × ' + vh + ' ÷ 3 = ？（立方厘米）';
    answer = String(vol);
  } else if (name.indexOf('面积') !== -1) {
    var w = Rng.randInt(rng, 4, 15);
    var hh = Rng.randInt(rng, 3, 12);
    var ar = w * hh;
    prompt = '列式计算：长方形长 ' + w + ' 厘米，宽 ' + hh + ' 厘米，面积 = ' + w + ' × ' + hh + ' = ？（平方厘米）';
    answer = String(ar);
  } else if (name.indexOf('角') !== -1) {
    var angle = Rng.pick(rng, [30, 45, 60, 90, 120, 150, 180]);
    prompt = '列式计算：一个 ' + angle + ' 度的角，它的补角 = 180 − ' + angle + ' = ？（度）';
    answer = String(180 - angle);
  } else {
    var a = Rng.randInt(rng, 5, 50);
    var b = Rng.randInt(rng, 1, 20);
    prompt = '列式计算：一根绳子长 ' + a + ' 厘米，用去 ' + b + ' 厘米，还剩 = ' + a + ' − ' + b + ' = ？（厘米）';
    answer = String(a - b);
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: 'calc',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: { mode: 'calc', steps: 2, shapeName: name }
  };
}

/* ==================================================================
 * P28-HOLLOW-02：shape-flat 全修（66 KP × 5 行共 263 行高置信空心）
 *
 * 此前这些 KP 的 choice/judge/fill/geometry/apply 行经泛型兜底落入 flat 随机认图
 * （「请写出该图形的名称」「图中共有几个」「下列哪个是 X 的特征」等），与 KP 语义无关。
 * 现按形态族（17 族）在 shape 内原生承接：SHAPE_THEME 逐 KP 提供教学素材
 * （facts 真命题 / wrongs 假命题+误区 / nums 数值事实 / scenes 应用情境），
 * 由 makeThemedShapeQuestion 统一组装；题干均带 KP 名称，证据包络
 * （graphic/shapeName/steps/unitPx）沿用既有派生链，不改动。
 * 分派按精确 canonical KP id 查表（同 stats STAT_SHAPE 先例：ID 引用键查表，
 * 值为生成器自有教学素材，非 canonical 载荷；bundle 审计已登记剥离）。
 * 同名 KP（如 g3-up-u03-k004 与 g6-down-u03-k006 均名「解决问题」）语义不同，
 * 名称分派无法区分，故素材表按精确 ID 声明。
 * choice/fill 去重指纹不含题面（duplicate-validator 口径），数值事实 nums
 * 提供 3 个互异数值变式（v=i%3），保证 count=3 不塌缩；judge/geometry/apply
 * 指纹含题面哈希，由变式设问保证互异。
 * ================================================================== */

// facts：3 条真命题（judge 真项/教学锚点）
// wrongs：3 对 [假命题, 误区纠正]（judge 假项，data.misconception 教学闭环）
// nums：3 组 [设问(带____), 答案字符串, 数值]（choice/fill/geometry 数值变式，数值互异）
// scenes：3 对 [情境任务, 参考答案]（apply 两步题；无 apply 行的 KP 省略）
function shapeTheme(facts, wrongs, nums, scenes) {
  return {
    facts: facts,
    wrongs: wrongs.map(function (w) { return { t: w[0], m: w[1] }; }),
    nums: nums.map(function (x) { return { q: x[0], a: x[1], n: x[2] }; }),
    scenes: (scenes || []).map(function (s) { return { t: s[0], a: s[1] }; })
  };
}

var SHAPE_THEME = {
  // ---- 形态族 1：立体图形特征（solid-feature）----
  'math-g1-up-u03-k001': shapeTheme( // 立体图形初识
    ['立体图形都有长、宽、高，占有一定的空间', '长方体、正方体、圆柱和球都是立体图形', '平面图形只有长和宽，立体图形还有高'],
    [['立体图形只有长和宽，没有厚度', '把立体图形当成了平面图形：立体图形有长、宽、高，占有空间。'],
     ['球有平平的面和尖尖的顶点', '球没有平面也没有顶点，全身是曲面，能任意滚动。'],
     ['圆柱的侧面展开是一个圆', '圆柱侧面沿高展开是长方形，上下底面才是圆。']],
    [['一个长方体有____个面', '6', 6], ['一个正方体有____条棱', '12', 12], ['一个长方体有____个顶点', '8', 8]],
    [['在积木盒里找出 3 个立体图形积木，先说出它们的名字，再数一数其中一个有几个面', '如长方体、正方体、圆柱积木；一个正方体积木有 6 个面'],
     ['先摸一摸文具盒，说一说它是哪种立体图形，再数一数它有几条棱', '文具盒是长方体，有 12 条棱'],
     ['先观察一个魔方，说出它是什么立体图形，再数一数它的面、棱和顶点', '魔方是正方体：6 个面、12 条棱、8 个顶点']]),
  'math-g1-up-u03-k002': shapeTheme( // 生活中的立体图形
    ['文具盒、砖头可以看作长方体，魔方、骰子可以看作正方体', '水桶、铅笔可以看作圆柱，皮球、地球仪可以看作球', '生活中许多物品的形状都可以看作立体图形'],
    [['课本封面是长方体', '课本整体是长方体；封面只是它的一个面，是长方形（平面图形）。'],
     ['足球是圆柱', '足球圆圆的能任意滚动，是球；圆柱有两个平平的圆形底面。'],
     ['水杯的形状是球', '水杯有两个圆形底面和一个曲面侧面，是圆柱。']],
    [['一个魔方（正方体）有____个面', '6', 6], ['骰子是正方体，它有____个顶点', '8', 8], ['一块砖头（长方体）有____条棱', '12', 12]],
    [['先在教室里找出 2 个长方体物品，再说说为什么它们是长方体？', '如讲台、文具盒：都有 6 个长方形的面、12 条棱、8 个顶点'],
     ['先在家里找一个圆柱形物品，再指出它的两个底面在哪里？', '如水杯：上下两个圆面是底面，周围的曲面是侧面'],
     ['先说说皮球为什么不是圆柱，再找一个真正的圆柱形物品？', '皮球没有平平的底面、能任意滚动，是球；罐头盒才是圆柱']]),
  'math-g5-down-u03-k001': shapeTheme( // 长方体的特征
    ['长方体有 6 个面，相对的面完全相同', '长方体有 12 条棱，相对的 4 条棱长度相等', '长方体有 8 个顶点，相交于一个顶点的三条棱分别叫长、宽、高'],
    [['长方体的 6 个面一定都是长方形', '特殊情况下长方体有两个相对的面是正方形。'],
     ['长方体的 12 条棱都一样长', '12 条棱分 3 组，每组 4 条相等；三组棱一般不相等。'],
     ['长方体有 6 个顶点', '长方体有 8 个顶点，6 是面的个数，别把面和顶点混淆。']],
    [['一个长方体有____个面', '6', 6], ['一个长方体有____条棱', '12', 12], ['一个长方体有____个顶点', '8', 8]],
    [['先找一个长方体纸盒，指出它的长、宽、高，再数一数有几组长度相等的棱', '12 条棱分 3 组，每组 4 条相等'],
     ['先观察一个长方体收纳箱，数出它的面、棱、顶点，再说说相对的面有什么关系？', '6 个面、12 条棱、8 个顶点；相对的面完全相同'],
     ['先用小棒搭一个长方体框架，数一数用了几根小棒、几个接头，再说说分别对应长方体的什么', '12 根小棒是 12 条棱，8 个接头是 8 个顶点']]),
  'math-g5-down-u03-k002': shapeTheme( // 正方体的特征
    ['正方体的 6 个面都是正方形且完全相同', '正方体的 12 条棱长度都相等', '正方体有 8 个顶点，是特殊的长方体'],
    [['正方体不是长方体', '正方体是长、宽、高都相等的特殊长方体。'],
     ['正方体只有 4 条棱相等', '正方体的 12 条棱全都相等。'],
     ['正方体的面可以是长方形', '正方体每个面都是完全相同的正方形。']],
    [['一个正方体有____条棱', '12', 12], ['一个正方体有____个面', '6', 6], ['正方体每个面有____条边', '4', 4]],
    [['先用同样大的小正方体摆一摆，再说说正方体的 6 个面有什么关系？', '6 个面都是完全相同的正方形'],
     ['先量一量魔方一条棱的长度，再说说它的 12 条棱各有多长？', '12 条棱全都一样长'],
     ['先把一个正方体盒子沿棱剪开，数一数展开图中有几个正方形，再说说发现了什么', '6 个完全相同的正方形']]),
  'math-g6-down-u03-k001': shapeTheme( // 圆柱的认识
    ['圆柱有两个完全相同的圆形底面和一个曲面侧面', '圆柱两个底面之间的距离叫作高，圆柱有无数条高', '圆柱的侧面沿高展开是长方形，长方形的长等于底面周长'],
    [['圆柱只有一条高', '圆柱两个底面之间有无数条高，长度都相等。'],
     ['圆柱的侧面展开是一个圆', '圆柱侧面沿高展开是长方形，底面才是圆。'],
     ['圆柱的 3 个面都是平面', '圆柱只有 2 个底面是平面，侧面是曲面。']],
    [['圆柱有____个底面', '2', 2], ['圆柱的底面和侧面一共有____个面', '3', 3], ['圆柱有____个顶点', '0', 0]],
    [['先找一个圆柱形水杯，指出它的底面和侧面，再数一数它一共有几个面', '2 个圆形底面和 1 个曲面侧面，共 3 个面'],
     ['先剪开圆柱形茶叶筒的侧面商标纸铺平，再算一算展开长方形的长（量出底面周长）是多少', '长方形的长=底面周长，宽=圆柱的高'],
     ['先量出圆柱形笔筒两个底面之间的距离，再说说这个距离叫什么、数一数这样的高有几条', '叫作圆柱的高，两个底面之间有无数条高']]),
  'math-g6-down-u03-k004': shapeTheme( // 圆锥的认识
    ['圆锥有一个圆形底面和一个曲面侧面', '从圆锥的顶点到底面圆心的距离叫作高，圆锥只有一条高', '圆锥的侧面展开是一个扇形'],
    [['圆锥有无数条高', '圆锥只有从顶点到底面圆心的一条高；有无数条高的是圆柱。'],
     ['圆锥有两个底面', '圆锥只有一个圆形底面，上面收成一个顶点。'],
     ['圆锥的侧面展开是长方形', '圆锥侧面展开是扇形；侧面展开是长方形的是圆柱。']],
    [['圆锥有____个底面', '1', 1], ['圆锥的底面和侧面一共有____个面', '2', 2], ['3 个圆锥一共有____个顶点', '3', 3]],
    [['先找一个圆锥形冰激凌筒，指出它的底面、侧面和顶点，再数一数它一共有几个面', '1 个圆形底面和 1 个曲面侧面，共 2 个面'],
     ['先量出圆锥模型从顶点到底面圆心的距离，再说说这个距离叫什么、数一数这样的高有几条', '叫作圆锥的高，只有 1 条'],
     ['先猜一猜圆锥的侧面展开是什么图形，再沿一条母线剪开模型数一数展开图有几条边', '展开是扇形，有 2 条直边和 1 条弧']]),

  // ---- 形态族 2：观察物体（observe-object）----
  'math-g3-up-u01-k003': shapeTheme( // 观察正方体
    ['从前面、上面、左面看一个正方体，看到的都是正方形', '观察由同样正方体搭成的图形，从不同方向看形状可能不同', '数搭成的图形用了几个正方体，要按层数，注意被挡住的'],
    [['从任何方向看正方体，看到的形状都不同', '正方体每个面都是正方形，从前面、上面、左面看都是正方形。'],
     ['数正方体个数时，看不见的一定不存在', '被挡住的正方体也要数——按层推算，不能只数看得见的。'],
     ['从上面看正方体看到的是长方形', '正方体每个面都是正方形，从上面看也是正方形。']],
    [['站在一个位置观察正方体，最多能同时看到____个面', '3', 3], ['正对着正方体的一个面看，只能看到____个面', '1', 1], ['用 2 个同样的正方体排成一行，从上面看能看到____个正方形', '2', 2]],
    [['把 4 个同样的正方体摆成 2×2 的方阵，先从上面看一看，再说出看到了几个正方形', '从上面看是 4 个正方形组成的大正方形'],
     ['用 3 个正方体搭一个「L」形，先从上面看，再说出看到了几个正方形', '从上面看到 2 个正方形（L 形占两格）'],
     ['先观察桌上的粉笔盒（正方体），再说说你最多能同时看到几个面、各是什么形状', '最多同时看到 3 个面，每个面都是正方形']]),
  'math-g4-down-u02-k001': shapeTheme( // 从不同方向观察物体
    ['从前面、上面、左面观察同一物体，看到的形状可能不同', '观察由小正方体组成的立体图形时，要先确定观察的方向', '同一物体从不同方向看，看到的正方形个数和排列可能不同'],
    [['从哪个方向看，看到的形状都一样', '观察方向不同，看到的形状可能不同，要逐方向确认。'],
     ['从上面看到的列数一定和从前面看到的一样', '上面看到的是前后排列，前面看到的是左右排列，两者不一定相同。'],
     ['从前面看是 3 个正方形，这个立体就只有 3 个小正方体', '前面看不到被挡住的正方体，实际个数可能更多。']],
    [['站在同一位置观察一个长方体盒子，最多能同时看到____个面', '3', 3], ['一个立体从前面看是 2 个正方形、从上面看也是 2 个正方形，它至少由____个小正方体组成', '2', 2], ['最少用____个同样的小正方体可以拼成一个大正方体', '8', 8]],
    [['把 4 个小正方体摆成一排，先画出从上面看到的形状，再画出从前面看到的形状？', '从上面看是 4 个正方形排一行；从前面看是 1 个正方形（或 4 个排一行，取决于摆的方向）'],
     ['用 4 个小正方体搭成 2×2 方阵，先从左面看，再说出看到的形状？', '从左面看是 2 个正方形并排'],
     ['观察讲桌上的粉笔盒，先选一个方向观察，再说说换一个方向看到的形状是否相同？', '从不同方向看，看到的面不同，形状都是正方形']]),
  'math-g4-down-u02-k002': shapeTheme( // 由平面到立体
    ['根据从不同方向看到的平面图形，可以推断立体图形的形状', '只给从一个方向看到的图形，摆法可能不止一种', '给出从前面、上面、左面三个方向看到的图形，一般能确定立体的样子'],
    [['只看从一个方向看到的图形，就能确定立体的样子', '一个方向只能看到一部分，必须结合多个方向的视图才能确定。'],
     ['从上面看是 4 个正方形，立体就只有一层', '从上面看只能确定底层占位，上面还可能叠着正方体。'],
     ['三个方向看到的正方形个数一定相同', '三个方向的视图分别反映长、宽、高，个数一般不同。']],
    [['从上面看一个立体是 3 个正方形排一行，它的第一层有____个小正方体', '3', 3], ['从前面看是 2 个正方形、从上面看是 2 个正方形、从左面看是 1 个正方形，这个立体由____个小正方体组成', '2', 2], ['从上面看是 4 个正方形（2×2），从前面看是 2 个正方形排一行，这个立体有____层', '1', 1]],
    [['给出从上面看是 3 个正方形排一行的视图，先用小正方体摆出底层，再说一说有几种摆法', '底层 3 个排一行，往上叠的摆法不唯一'],
     ['先从前面、上面、左面分别观察一个搭好的立体，画出三个视图，再根据视图让同学还原？', '三个方向视图结合才能还原立体'],
     ['只给你从前面看到的 2 个正方形，先猜一猜立体有几个小正方体，再说明为什么不能确定', '只看到前面，被挡住的个数未知，摆法不唯一']]),
  'math-g5-down-u01-k001': shapeTheme( // 从不同角度观察立体图形
    ['从正面、左面、上面观察同一立体图形，看到的平面图形可能不同', '辨认视图时要看清每行每列各有几个正方形', '观察方向变了，看到的形状和正方形的排列也会跟着变'],
    [['从正面看到的形状就是立体本身的样子', '正面视图只是一个方向的样子，还要结合其他方向。'],
     ['从上面看到的正方形个数就是立体的总个数', '上面只能看到最上层的占位，被压在下面的数不清。'],
     ['同一立体从不同方向看，正方形个数一定相同', '方向不同，看到的个数和排列可能不同。']],
    [['一个立体从正面看是 3 个正方形、从上面看是 4 个正方形，它至少有____个小正方体', '4', 4], ['观察立体图形常用正面、左面、上面，一共____个方向', '3', 3], ['从正面看是竖着排的 2 个正方形，说明这个立体最高有____层', '2', 2]],
    [['用 4 个小正方体搭一个立体，先画出从正面看到的形状，再画出从上面看到的形状？', '视图取决于搭法，如排一行：正面 1 个或 4 个、上面 4 个排一行'],
     ['先观察由 5 个小正方体搭成的立体，再说出从哪个方向看到的正方形最多？', '比较正面、左面、上面的视图，个数可能不同'],
     ['把 3 个小正方体叠成一竖列，先分别从正面和上面看，再说出各看到几个正方形', '正面看是 3 个竖排，上面看是 1 个']]),
  'math-g5-down-u01-k002': shapeTheme( // 根据平面视图搭建立体图形
    ['根据从三个方向看到的图形，可以还原出立体图形', '只根据一个方向的视图摆一摆，摆法往往不唯一', '先按从上面看到的图形确定底层，再按从正面和左面看到的确定层数'],
    [['按一个方向的视图摆出的立体是唯一的', '一个方向的视图挡不住的部分看不见，摆法不唯一。'],
     ['还原时可以不数被挡住的正方体', '被挡住的正方体要根据三个方向的视图推算。'],
     ['从上面看到的图形决定立体的高', '从上面看到的是底面占位；高由正面和左面视图决定。']],
    [['从上面看是 4 个正方形（2×2），搭这个立体第一层要____个小正方体', '4', 4], ['从正面看最高一列有 3 个正方形，这个立体有____层', '3', 3], ['用 5 个小正方体搭立体，从上面看是 3 个正方形，第二层有____个小正方体', '2', 2]],
    [['先根据「从上面看是 3 个正方形排一行」摆好底层，再根据「从正面看最高 2 层」补上第二层？', '底层 3 个排一行，某一列上再叠 1 个'],
     ['给出三个方向的视图，先摆一摆，再数一数一共用了几个小正方体', '按上→正→左顺序核对，个数由视图推算'],
     ['只用「从正面看是 2 个正方形」摆一摆，先摆出两种不同摆法，再说明为什么不唯一？', '被挡住的个数和位置无法确定，摆法不唯一']]),

  // ---- 形态族 3：长度测量（length-measure）----
  'math-g2-up-u05-k002': shapeTheme( // 测量物体长度的方法
    ['测量时把尺子的刻度 0 对准物体的一端，另一端对着几就是几厘米', '如果不是从刻度 0 开始量，物体长度=末端刻度−起始刻度', '测量时尺子要放正、贴紧被测物体'],
    [['量长度时尺子斜着放也没关系', '尺子必须放正贴紧，斜放量不准。'],
     ['从刻度 2 量到刻度 7，物体长 7 厘米', '长度=7−2=5 厘米，要减去起始刻度。'],
     ['把尺子随便往物体上一放就能读出长度', '要把刻度 0（或某一刻度）对准物体一端，才能正确读数。']],
    [['铅笔一端对着刻度 0，另一端对着刻度 8，铅笔长____厘米', '8', 8], ['橡皮一端对着刻度 2，另一端对着刻度 6，橡皮长____厘米', '4', 4], ['纸条一端对着刻度 3，另一端对着刻度 10，纸条长____厘米', '7', 7]],
    [['先量一量自己的铅笔：把刻度 0 对准一端，再读出另一端对着的刻度？', '按实际读数，如 15 厘米'],
     ['一张纸条从刻度 4 量到刻度 11，先写出算式，再算出长度？', '11−4=7（厘米）'],
     ['先用尺子量出课本的长，再说说你是怎样对准刻度的？', '把刻度 0 对准课本一端，另一端对着几就是几厘米']]),
  'math-g2-up-u05-k004': shapeTheme( // 画线段的方法
    ['画线段通常从尺子的刻度 0 画起', '画几厘米的线段就画到刻度几的地方', '画好后要在线段的两端点上端点'],
    [['画 5 厘米的线段，从刻度 1 画到刻度 5', '从刻度 1 到刻度 5 只有 4 厘米；从刻度 0 画到刻度 5 才是 5 厘米。'],
     ['画线段不用尺子也能画直', '要沿尺子的边画，才能保证线段是直的。'],
     ['线段画好后不需要标端点', '线段有两个端点，画完要标出两端。']],
    [['画一条 5 厘米的线段，从刻度 0 画到刻度____', '5', 5], ['画一条 8 厘米的线段，从刻度 0 画到刻度____', '8', 8], ['从刻度 2 画到刻度 9，画出的线段长____厘米', '7', 7]],
    [['先画一条 6 厘米的线段，再和同桌互相量一量画得准不准？', '从刻度 0 画到刻度 6，并标出两个端点'],
     ['先画一条比 10 厘米短 3 厘米的线段，再说说它长几厘米', '10−3=7，画一条 7 厘米的线段'],
     ['先画出一条 4 厘米的线段，再画出一条比它长 2 厘米的线段？', '再画 6 厘米的线段']]),
  'math-g2-up-u06-k001': shapeTheme( // 身体上的尺子
    ['一拃、一步、一庹都可以当作「身体上的尺子」来估测长度', '用身体上的尺子量出的结果是近似值，每个人的「身体尺」长度不同', '估测后再用尺子量一量，可以检验估得准不准'],
    [['每个人一拃的长度都一样', '身体大小不同，一拃长度不同，所以身体尺只能估测。'],
     ['用身体尺量出的长度是精确值', '身体尺只能估出大约长度，精确测量要用尺子。'],
     ['身体尺不能用来估计教室的长度', '可以用步数估计：步长×步数≈教室长度。']],
    [['小明一拃约 10 厘米，量得课桌宽约 4 拃，课桌宽约____厘米', '40', 40], ['小红一步约 50 厘米，走 8 步大约是____厘米', '400', 400], ['小刚一庹约 1 米，黑板约 3 庹，黑板长约____米', '3', 3]],
    [['先量出自己的一拃约几厘米，再用拃估测课桌的长', '如：一拃约 12 厘米，课桌约 5 拃，约 60 厘米'],
     ['先用步数估计教室的长，再用卷尺量一量检验？', '步长×步数≈估计值，与实测对比'],
     ['先估一估黑板的长（用庹），再说说估测和精确测量有什么不同？', '身体尺得近似值，尺子量得精确值']]),
  'math-g3-up-u03-k003': shapeTheme( // 适用场景（毫米、分米和千米）
    ['量较短较精细的物体用毫米作单位，如硬币的厚度', '量不长不短的物体用分米作单位，如课桌的高度', '量较长的距离用千米作单位，如公路的长度'],
    [['测量操场跑道的长度用毫米作单位', '跑道很长，应用米或千米；毫米用于很短很精细的物体。'],
     ['硬币的厚度用千米作单位', '硬币很薄，要用毫米作单位。'],
     ['千米只能用来量地图上的距离', '千米用于量较长路程，如两城之间、公路长度。']],
    [['1 分米=____厘米', '10', 10], ['1 千米=____米', '1000', 1000], ['3 分米=____厘米', '30', 30]],
    [['先说出量硬币厚度、课桌高度、公路长度分别用什么单位，再各举一个例子？', '毫米、分米、千米；如指甲厚度用毫米'],
     ['先估一估课本的厚度，再选择毫米或分米作单位量一量？', '课本较薄，用毫米作单位'],
     ['从学校到家的距离用什么单位？先估一估，再说说为什么不用毫米', '用千米（或米）；距离长，毫米太小不方便']]),
  'math-g3-up-u03-k004': shapeTheme( // 解决问题（量感与测量规范）
    ['操场跑道一圈 200 米，5 圈就是 1 千米', '正常步行 10 分钟约走 1 千米', '测量时把刻度 0 对齐物体一端，另一端对着的刻度就是长度'],
    [['10 个 100 米是 1000 千米', '10 个 100 米是 1000 米，也就是 1 千米，不是 1000 千米。'],
     ['量比较长的距离用厘米作单位最方便', '长距离用米或千米作单位才方便。'],
     ['2 千米和 2000 米不一样长', '1 千米=1000 米，2 千米=2000 米，一样长。']],
    [['跑道一圈 200 米，____圈正好是 1 千米', '5', 5], ['2 千米=____米', '2000', 2000], ['小明步行 10 分钟约走 1 千米，走 30 分钟约走____千米', '3', 3]],
    [['先算一算跑道 5 圈是多少米，再说说它等于几千米', '200×5=1000 米=1 千米'],
     ['先估一估从教室走到校门大约几分钟，再推算大约多少米', '如：5 分钟约 500 米（按 10 分钟约 1 千米估）'],
     ['一根绳子从刻度 0 量到刻度 25，先读出长度，再剪去 10 厘米还剩几厘米', '长 25 厘米，25−10=15 厘米']]),

  // ---- 形态族 4：线段、射线、直线（line-ray）----
  'math-g2-up-u05-k003': shapeTheme( // 认识线段
    ['线段是直的，有两个端点', '线段可以量出长度', '连接两点之间只能画一条线段'],
    [['线段可以向两端无限延长', '线段有两个端点，不能延长；能无限延长的是直线。'],
     ['弯曲的线也是线段', '线段必须是直的，弯曲的不是线段。'],
     ['线段没有端点', '线段有两个端点；没有端点的是直线。']],
    [['线段有____个端点', '2', 2], ['连接两个点只能画____条线段', '1', 1], ['一条线段有 2 个端点，3 条线段一共有____个端点', '6', 6]],
    [['先在本子上画一条线段，标出两个端点，再量出它的长度？', '按实际测量，如 5 厘米'],
     ['先找出黑板上的一条线段（如边框），再说说它为什么是线段？', '它是直的、有两个端点、可以量长度'],
     ['连接本子上两个点，先画一画，再说说能画几条线段', '只能画 1 条线段']]),
  'math-g3-up-u07-k001': shapeTheme( // 线段、射线、直线
    ['线段有两个端点，可以测量长度', '射线有一个端点，向一端无限延伸', '直线没有端点，向两端无限延伸'],
    [['射线有两个端点', '射线只有一个端点，另一端无限延伸。'],
     ['直线可以量出长度', '直线向两端无限延伸，不能度量长度。'],
     ['线段能向一端无限延伸', '线段两个端点都固定，不能延伸。']],
    [['线段有____个端点', '2', 2], ['射线有____个端点', '1', 1], ['直线有____个端点', '0', 0]],
    [['先画出一条线段、一条射线、一条直线，再分别标出它们的端点？', '线段 2 个端点，射线 1 个，直线没有'],
     ['先说说手电筒射出的光线可以看作哪种线，再说明理由？', '射线：有一个端点，向一端无限延伸'],
     ['先在直线上点出两个点，再说说这两个点之间的部分叫什么？', '线段，它有 2 个端点，可以量长度']]),
  'math-g3-up-u07-k004': shapeTheme( // 单元小结（线和角）
    ['线段、射线、直线都是直的线', '线段有两个端点、射线有一个、直线没有端点', '三种线中只有线段可以度量长度'],
    [['线段、射线、直线都可以度量长度', '只有线段可以度量；射线和直线无限延伸，不能度量。'],
     ['射线比直线短', '射线和直线都无限长，无法比较长短。'],
     ['把线段两端都无限延长就得到射线', '两端都无限延长得到的是直线；只延长一端才是射线。']],
    [['射线有____个端点', '1', 1], ['直线有____个端点', '0', 0], ['一条直线上有 3 个点，相邻两点连成一条线段，共有____条线段', '3', 3]],
    [['先列表比较线段、射线、直线的端点个数，再说说哪种能度量长度？', '线段 2 个、射线 1 个、直线 0 个；只有线段能度量'],
     ['先画出一条射线，再把它反向延长，说说得到了什么线？', '得到一条直线'],
     ['数一数：一条线段上有 4 个点（含端点），先画一画，再说出一共有几条线段', '3+2+1=6 条线段']]),

  // ---- 形态族 5：轴对称（symmetry）----
  'math-g3-down-u01-k001': shapeTheme( // 轴对称图形
    ['对折后两边能完全重合的图形是轴对称图形', '折痕所在的直线叫作对称轴', '长方形有 2 条对称轴，正方形有 4 条对称轴'],
    [['对折后两边差不多的图形就是轴对称图形', '必须完全重合才是轴对称图形，「差不多」不行。'],
     ['平行四边形是轴对称图形', '一般平行四边形沿任何直线对折都不能完全重合，不是轴对称图形。'],
     ['轴对称图形只能有一条对称轴', '可以有多条，如正方形有 4 条、圆有无数条。']],
    [['长方形有____条对称轴', '2', 2], ['正方形有____条对称轴', '4', 4], ['等腰三角形有____条对称轴', '1', 1]],
    [['先剪出一个长方形纸片对折，再数一数它有几条对称轴、说说它是不是轴对称图形', '2 条对称轴，对折能完全重合，是轴对称图形'],
     ['先数一数树叶一半轮廓上有几个关键点，再沿对称轴补画出另一半', '按关键点到对称轴距离相等补画，两边完全重合'],
     ['先找出几个轴对称的字母（如 A、H、M），再数一数每个字母有几条对称轴', 'A、H、M 各有 1 条竖直对称轴']]),
  'math-g4-down-u07-k001': shapeTheme( // 轴对称
    ['沿一条直线对折后两边完全重合的图形是轴对称图形', '在轴对称图形中，对称点到对称轴的距离相等', '圆有无数条对称轴'],
    [['对称点到对称轴的距离不相等', '对称点到对称轴的距离一定相等，这是轴对称的性质。'],
     ['圆只有 4 条对称轴', '圆的每条直径所在直线都是对称轴，有无数条。'],
     ['只要图形两边一样大就是轴对称图形', '必须沿对称轴对折后完全重合，仅「一样大」不一定重合。']],
    [['正方形有____条对称轴', '4', 4], ['长方形有____条对称轴', '2', 2], ['等边三角形有____条对称轴', '3', 3]],
    [['先在方格纸上画一个三角形并数一数它有几个顶点，再画出它关于竖直对称轴的轴对称图形', '3 个顶点，对应点到对称轴距离相等'],
     ['先量出一组对应点到对称轴的距离，再求一求另一组对应点的距离、说说发现了什么', '对应点到对称轴的距离都相等'],
     ['先判断平行四边形是不是轴对称图形，再数一数它能找到几条对称轴并说明理由', '0 条：沿任何直线对折都不能完全重合，不是轴对称图形']]),
  'math-g4-down-u07-k002': shapeTheme( // 补全轴对称图形
    ['补全轴对称图形时，先找出图形上的关键点', '数出关键点到对称轴的格数，在对称轴另一侧描出对应点', '对应点到对称轴的距离相等，最后连线成形'],
    [['对应点可以随便描，只要在对称轴另一侧就行', '对应点到对称轴的格数必须和原来的点相等。'],
     ['补全时先连线再找点', '正确顺序是找点→数格→描点→连线。'],
     ['对应点在对称轴的同一侧', '对应点必须在对称轴的另一侧，且距离相等。']],
    [['一个点到对称轴的距离是 3 格，它的对应点到对称轴的距离是____格', '3', 3], ['关键点距对称轴 2 格，对应点应描在对称轴另一侧第____格', '2', 2], ['一个点到对称轴 5 格，它的对应点距对称轴____格', '5', 5]],
    [['先在方格纸上数出对称轴左边半图有几个顶点，再补全右边的另一半', '按对应点到对称轴格数相等逐点描出后连线'],
     ['先找出半图的 3 个关键点到对称轴的距离，再描出对应点并数一数一共补了几个点', '补 3 个对应点，距离与原点相等'],
     ['先补全以虚线为对称轴的「小房子」半图，再数一数一共补了几个对应点', '按半图顶点数确定，如 5 个']]),
  'math-g5-down-u05-k003': shapeTheme( // 轴对称的再认识
    ['对称点到对称轴的距离相等，对称点的连线与对称轴垂直', '在方格纸上补全轴对称图形：找点、数格、描点、连线', '汉字和字母中也有轴对称，如「中」「A」'],
    [['对称点的连线与对称轴平行', '对称点的连线与对称轴垂直，且被对称轴平分。'],
     ['所有三角形都是轴对称图形', '只有等腰、等边三角形是轴对称图形，普通三角形不是。'],
     ['对称轴两侧的图形大小可以不同', '对称轴两侧必须完全相同（能重合）。']],
    [['点 A 到对称轴的距离是 4 格，对称点 A′到对称轴的距离是____格', '4', 4], ['等边三角形有____条对称轴', '3', 3], ['长方形有____条对称轴', '2', 2]],
    [['先画出长方形、正方形、等腰三角形，再分别数一数各有几条对称轴', '长方形 2 条，正方形 4 条，等腰三角形 1 条'],
     ['先画出圆的两条不同对称轴，再说说圆一共有多少条对称轴', '无数条，每条直径所在直线都是对称轴'],
     ['先判断等边三角形有几条对称轴，再画出来数一数验证', '3 条，每个顶点与对边中点的连线都是对称轴']]),

  // ---- 形态族 6：旋转与图案设计（rotation）----
  'math-g5-down-u05-k001': shapeTheme( // 旋转的三要素
    ['旋转的三要素是旋转中心、旋转方向和旋转角度', '图形旋转后形状和大小不变，只是位置发生变化', '旋转方向分顺时针和逆时针两种'],
    [['旋转后图形的形状会改变', '旋转只改变位置和方向，形状和大小都不变。'],
     ['旋转只需要知道旋转角度就够了', '必须同时知道旋转中心、方向和角度三要素。'],
     ['顺时针和逆时针旋转 90°的结果一样', '方向不同，旋转后的位置不同。']],
    [['旋转的三要素一共有____个', '3', 3], ['钟表指针从 12 走到 3，绕中心顺时针旋转了____度', '90', 90], ['指针从 12 走到 6，旋转了____度', '180', 180]],
    [['先观察钟表指针从 12 走到 3，再说出旋转中心、方向，并算一算旋转了多少度', '绕中心点顺时针旋转 90°'],
     ['先把三角形纸片绕一个顶点顺时针旋转 90°，再数一数旋转前后图形各占几格、说说什么没变', '形状和大小不变，只是位置变了'],
     ['先说一说风车转动是绕哪一点、向什么方向旋转，再比一比它和钟表指针方向相差多少', '绕中心点旋转；同向为顺时针，相差 0°']]),
  'math-g5-down-u05-k002': shapeTheme( // 在方格纸上画旋转图形
    ['画旋转图形先确定旋转中心', '找出关键点，按旋转方向和角度确定对应点', '最后顺次连接对应点，得到旋转后的图形'],
    [['旋转 90°后图形的大小会变', '旋转不改变形状和大小，只改变位置。'],
     ['画旋转图形时可以不找关键点直接画', '要先找关键点、定对应点，再连线，否则画不准。'],
     ['绕不同的点旋转同一个图形，结果一样', '旋转中心不同，旋转后的位置不同。']],
    [['把线段绕端点旋转____度，正好转到与原来垂直的位置', '90', 90], ['图形绕一点旋转____度后，能与原来的位置完全重合（转一整圈）', '360', 360], ['钟表上分针走 30 分钟，旋转了____度', '180', 180]],
    [['先在方格纸上画一面小旗并数一数占了几个格点，再把它绕旗杆底端顺时针旋转 90°画出来', '关键点绕中心转 90°，形状大小不变'],
     ['先画出一条线段绕端点逆时针旋转 90°后的位置，再数一数旋转前后线段各占几格', '格数相同，只是方向变了'],
     ['先把方格纸上的三角形绕一个顶点旋转 180°，再数一数对应点到旋转中心的距离各有几格', '对应点与旋转中心距离相等']]),
  'math-g5-down-u05-k004': shapeTheme( // 设计图案
    ['利用平移、旋转和轴对称可以设计出美丽的图案', '设计图案时常把同一个基本图形反复运动', '图形运动后形状和大小都不变'],
    [['设计图案只能用旋转一种方法', '平移、旋转、轴对称都可以用于设计图案。'],
     ['图案设计中的基本图形经过运动会变形', '平移、旋转、轴对称都不改变图形的形状和大小。'],
     ['同一个基本图形只能设计出一种图案', '运动方式、次数不同，可以设计出多种图案。']],
    [['把一个基本图形绕一点每次旋转 90°，旋转____次后回到原位置', '4', 4], ['把一个图形每次旋转 60°，旋转____次后回到原位置', '6', 6], ['把一个图形每次旋转 180°，旋转____次后回到原位置', '2', 2]],
    [['先选一个基本图形（如三角形），再把它绕一点每次旋转 90°，画出得到的图案', '旋转 3 次（连原图共 4 个）组成风车样图案'],
     ['先用一个正方形通过平移设计一条花边，再说说用了几次平移', '每次平移一个边长，图案连续排列'],
     ['先画一个基本图形，再分别用轴对称和旋转各设计一个图案，比较它们的相同点', '运动后形状、大小都不变，只是位置方向不同']]),

  // ---- 形态族 7：周长（perimeter）----
  'math-g3-down-u03-k002': shapeTheme( // 认识周长
    ['封闭图形一周的长度叫作它的周长', '测量周长可以先用线绕图形一周，再量出线的长度', '不封闭的图形没有周长'],
    [['不封闭的图形也有周长', '周长是封闭图形一周的长度，不封闭谈不上「一周」。'],
     ['图形里面的大小叫周长', '里面的大小是面积；一周的长度才是周长。'],
     ['只要量一条边就能知道周长', '周长是一周所有边的长度之和。']],
    [['一个三角形三条边分别是 3 厘米、4 厘米、5 厘米，它的周长是____厘米', '12', 12], ['正方形边长 4 厘米，周长是____厘米', '16', 16], ['一个四边形四条边分别是 2、3、4、5 厘米，周长是____厘米', '14', 14]],
    [['先用绳子绕课本封面一周，再量出绳子的长度并说说这就是课本封面的什么、是多少厘米', '课本封面的周长，如 88 厘米'],
     ['先用彩笔描出树叶边线的一周，再说说这一周的长度叫什么、大约有多少厘米', '树叶的周长，按实际估计'],
     ['先用直尺量出三角形纸片三条边的长度，再算出它的周长是多少厘米', '三条边相加，如 3+4+5=12 厘米']]),
  'math-g3-down-u03-k003': shapeTheme( // 长方形和正方形的周长计算
    ['长方形周长=（长+宽）×2', '正方形周长=边长×4', '已知长方形周长和长，可以求宽：宽=周长÷2−长'],
    [['长方形周长=长+宽', '周长是一周的长度，要用（长+宽）×2。'],
     ['正方形周长=边长×边长', '边长×边长是面积；周长是边长×4。'],
     ['长方形和正方形的周长公式一样', '长方形用（长+宽）×2，正方形用边长×4。']],
    [['长方形长 6 厘米、宽 4 厘米，周长是____厘米', '20', 20], ['正方形边长 7 厘米，周长是____厘米', '28', 28], ['长方形周长 24 厘米、长 8 厘米，宽是____厘米', '4', 4]],
    [['先量出课本封面的长和宽，再算出它的周长是多少厘米', '（长+宽）×2，如（26+18)×2=88 厘米'],
     ['先算出边长 5 厘米正方形的周长是多少，再说说为什么可以用边长×4', '5×4=20 厘米，4 条边一样长'],
     ['一块长方形菜地长 8 米、宽 5 米，先写出算式，再算出围栏长多少米', '(8+5)×2=26 米']]),
  'math-g3-down-u03-k004': shapeTheme( // 拼图游戏
    ['用同样的小正方形可以拼成不同形状的图形', '拼成的图形形状不同，周长可能不同', '拼的时候重合的边越多，露在外面的边越少，周长越短'],
    [['拼成的图形形状不同，周长一定相同', '拼法不同，露在外面的边数不同，周长一般不同。'],
     ['4 个小正方形无论怎么拼，周长都一样', '拼成一排周长是 10 条边长，拼成 2×2 周长是 8 条边长，不一样。'],
     ['拼图时面积和周长都不变', '面积不变（小正方形个数不变），周长随拼法改变。']],
    [['用 4 个边长 1 厘米的小正方形拼成一排，拼成的长方形周长是____厘米', '10', 10], ['用 4 个边长 1 厘米的小正方形拼成 2×2 的大正方形，周长是____厘米', '8', 8], ['用 6 个边长 1 厘米的小正方形拼成 1 行 6 列的长方形，周长是____厘米', '14', 14]],
    [['先用 4 个小正方形拼成一排，算一算周长；再拼成 2×2，比一比哪个周长短？', '一排 10 条边长，2×2 是 8 条边长，2×2 更短'],
     ['用 6 个小正方形先拼两种不同的长方形，再分别算出周长？', '1×6 周长 14 条边长，2×3 周长 10 条边长'],
     ['先想一想：怎样拼能让周长最短？再用 4 个小正方形验证', '重合边越多周长越短，2×2 拼法周长最短']]),

  // ---- 形态族 8：长正方形面积与周长面积区分（area-rect）----
  'math-g3-down-u04-k003': shapeTheme( // 长方形和正方形的面积计算
    ['长方形面积=长×宽', '正方形面积=边长×边长', '面积要用平方单位，如平方厘米'],
    [['长方形面积=（长+宽）×2', '（长+宽）×2 是周长；面积=长×宽。'],
     ['正方形面积=边长×4', '边长×4 是周长；面积=边长×边长。'],
     ['面积的单位是厘米', '面积用平方厘米等平方单位；厘米是长度单位。']],
    [['长方形长 6 厘米、宽 3 厘米，面积是____平方厘米', '18', 18], ['正方形边长 5 厘米，面积是____平方厘米', '25', 25], ['长方形面积 24 平方厘米、长 6 厘米，宽是____厘米', '4', 4]],
    [['先用 1 平方厘米的小方格铺满长 4 厘米、宽 3 厘米的长方形，再数一数它的面积是多少平方厘米', '4×3=12 平方厘米'],
     ['先算出边长 6 厘米正方形的面积是多少，再说说为什么用边长×边长', '6×6=36 平方厘米，每行 6 格共 6 行'],
     ['一张课桌面长 12 分米、宽 5 分米，先写出算式，再算出面积是多少平方分米', '12×5=60 平方分米']]),
  'math-g3-down-u04-k005': shapeTheme( // 周长与面积的联系与区分
    ['周长是封闭图形一周的长度，面积是图形面的大小', '周长用长度单位，面积用平方单位', '周长相等的图形，面积不一定相等'],
    [['周长相等的长方形，面积一定相等', '如 6×2 与 5×3 周长都是 16 厘米，面积 12≠15，不一定相等。'],
     ['面积大的图形周长一定大', '面积和周长没有必然大小关系，要分别计算。'],
     ['边长 4 厘米的正方形，周长和面积完全一样', '周长 16 厘米、面积 16 平方厘米，数值相同但意义和单位不同。']],
    [['长 6 厘米、宽 2 厘米的长方形，面积是____平方厘米', '12', 12], ['长 5 厘米、宽 3 厘米的长方形，面积是____平方厘米', '15', 15], ['边长 4 厘米的正方形，周长是____厘米', '16', 16]],
    [['先用 12 根同样长的小棒围一个长方形，再说说它的周长是多少、面积是否确定', '周长是 12 根小棒的长；面积随长宽不同而不同'],
     ['先算出边长 4 厘米正方形的周长和面积各是多少，再说说两个结果表示什么', '周长 16 厘米（边线长度），面积 16 平方厘米（面的大小）'],
     ['一个长方形长 6 厘米、宽 2 厘米，先算周长再算面积，说说两个结果各是多少、单位为什么不同', '周长 16 厘米用长度单位，面积 12 平方厘米用面积单位']]),

  // ---- 形态族 9：多边形面积（area-polygon）----
  'math-g5-up-u06-k001': shapeTheme( // 平行四边形的面积
    ['平行四边形的面积=底×高，用字母表示 S=ah', '把平行四边形沿高剪开，可以拼成一个长方形', '拼成的长方形的长等于平行四边形的底，宽等于高'],
    [['平行四边形面积=底×斜边', '面积=底×高，高是垂直距离，不是斜边。'],
     ['平行四边形拉成长方形后面积不变', '拉成长方形后周长不变，但高变了，面积改变。'],
     ['只要底相等，平行四边形面积就相等', '面积由底和高共同决定，底相等高不同面积也不同。']],
    [['平行四边形底 6 厘米、高 4 厘米，面积是____平方厘米', '24', 24], ['平行四边形面积 30 平方厘米、底 6 厘米，高是____厘米', '5', 5], ['平行四边形底 9 厘米、高 4 厘米，面积是____平方厘米', '36', 36]],
    [['先把平行四边形沿高剪开拼成长方形，再说说拼成的长方形与原来面积相差多少', '面积相等（相差 0）：长方形的长=底，宽=高'],
     ['先量出平行四边形模型的一组底和高，再算出它的面积是多少平方厘米', '面积=底×高，如底 8 厘米、高 5 厘米得 40 平方厘米'],
     ['一个平行四边形花坛底 6 米、高 4 米，先写出算式，再算出面积是多少平方米', '6×4=24 平方米']]),
  'math-g5-up-u06-k002': shapeTheme( // 三角形的面积
    ['三角形的面积=底×高÷2，用字母表示 S=ah÷2', '两个完全一样的三角形可以拼成一个平行四边形', '拼成的平行四边形面积是每个三角形面积的 2 倍'],
    [['三角形面积=底×高', '忘了÷2：三角形面积=底×高÷2。'],
     ['任意两个三角形都能拼成平行四边形', '必须是两个完全一样的三角形才能拼成。'],
     ['三角形的面积与它的形状有关', '面积只与底和高有关，与形状无关。']],
    [['三角形底 8 厘米、高 5 厘米，面积是____平方厘米', '20', 20], ['三角形面积 24 平方厘米、底 8 厘米，高是____厘米', '6', 6], ['三角形底 6 厘米、高 4 厘米，面积是____平方厘米', '12', 12]],
    [['先用两个完全一样的三角形拼成平行四边形，再说说一个三角形的面积怎么求', '平行四边形面积的一半：底×高÷2'],
     ['先量出红领巾的底和高，再算出它的面积是多少平方厘米', '面积=底×高÷2，如底 100 厘米、高 33 厘米得 1650 平方厘米'],
     ['一块三角形警示牌底 6 分米、高 4 分米，先写出算式，再算出面积是多少平方分米', '6×4÷2=12 平方分米']]),
  'math-g5-up-u06-k003': shapeTheme( // 梯形的面积
    ['梯形的面积=（上底+下底）×高÷2，用字母表示 S=(a+b)h÷2', '两个完全一样的梯形可以拼成一个平行四边形', '拼成的平行四边形的底等于梯形上底与下底的和'],
    [['梯形面积=（上底+下底）×高', '忘了÷2：梯形面积=（上底+下底）×高÷2。'],
     ['梯形的面积只与上底、下底有关', '面积还与高有关，三者共同决定。'],
     ['任意两个梯形都能拼成平行四边形', '必须是两个完全一样的梯形才能拼成。']],
    [['梯形上底 3 厘米、下底 5 厘米、高 4 厘米，面积是____平方厘米', '16', 16], ['梯形上底 2 厘米、下底 6 厘米、高 5 厘米，面积是____平方厘米', '20', 20], ['梯形面积 30 平方厘米，上底 4 厘米、下底 6 厘米，高是____厘米', '6', 6]],
    [['先用两个完全一样的梯形拼成平行四边形，再说说梯形面积公式是怎么求出来的', '（上底+下底）×高÷2'],
     ['一个梯形上底 3 厘米、下底 7 厘米、高 4 厘米，先写出算式，再算出面积是多少平方厘米', '(3+7)×4÷2=20 平方厘米'],
     ['先量出梯形水渠横断面的上底、下底和高，再算出横断面面积是多少', '（上底+下底）×高÷2，按实测代入']]),
  'math-g5-up-u06-k004': shapeTheme( // 组合图形的面积
    ['组合图形可以分成几个学过的简单图形', '分别算出各部分的面积，再相加或相减', '分的方法不同，算出的总面积相同'],
    [['组合图形的面积只能用一种方法计算', '可以分割求和，也可以补成大图形求差。'],
     ['分法不同，算出的总面积可能不同', '无论怎么分，总面积不变。'],
     ['组合图形面积等于各部分周长的和', '面积是各部分面积的和，与周长无关。']],
    [['一个组合图形分成面积 12 平方厘米和 8 平方厘米的两部分，总面积是____平方厘米', '20', 20], ['大正方形面积 25 平方厘米，挖去面积 9 平方厘米的小正方形，剩下____平方厘米', '16', 16], ['组合图形分成 10 平方厘米的三角形和 15 平方厘米的长方形，总面积是____平方厘米', '25', 25]],
    [['先把「L」形纸板分成两个长方形，再算出它的总面积是多少', '分割法：两个长方形面积相加'],
     ['先在大长方形中添补一块变成规则图形，再算出阴影部分面积是多少', '添补法：大图形面积−补上的面积'],
     ['先量出组合图形各边的长度，再选分割或添补的方法算出面积是多少', '按分割后各基本图形面积求和（或求差）']]),
  'math-g5-up-u06-k005': shapeTheme( // 格点多边形的面积（选学）
    ['方格纸上每个小方格的面积是 1 平方厘米', '不满一格的可以两个拼成一格来数', '格点多边形的面积与格点数量之间有规律（皮克定理思想）'],
    [['不满一格的都按一格算', '不满一格要拼合估算，两个半格算一格。'],
     ['格点多边形面积只能用公式算', '可以先数整格、再拼半格来估计面积。'],
     ['数格子时，格点数量与面积无关', '格点数量与面积之间有固定规律。']],
    [['每个小方格 1 平方厘米，一个图形占 8 个整格和 4 个半格，面积约____平方厘米', '10', 10], ['占 6 个整格和 2 个半格，面积约____平方厘米', '7', 7], ['占 10 个整格和 6 个半格，面积约____平方厘米', '13', 13]],
    [['先在方格纸上画一个顶点都在格点上的三角形，再用数格子的方法数一数它的面积约是多少', '满格按 1 算，不满格按半格算，合计即约面积'],
     ['先数出格点多边形内部和边界上的格点各有多少个，再试着用皮克定理算出面积', '内部格点数+边界格点数÷2−1'],
     ['先画出上底 2 格、下底 4 格、高 3 格的梯形，再用数格子验证面积是多少格', '(2+4)×3÷2=9 格，与数格子结果一致']]),
  'math-g5-up-u06-k006': shapeTheme( // 等底等高的图形面积关系
    ['等底等高的平行四边形面积相等', '等底等高的三角形面积相等', '等底等高的平行四边形面积是三角形面积的 2 倍'],
    [['等底等高的三角形形状一定相同', '等底等高只保证面积相等，形状可以不同。'],
     ['等底等高的平行四边形和三角形面积相等', '等底等高时，平行四边形面积是三角形的 2 倍。'],
     ['面积相等的三角形一定等底等高', '面积相等只需底×高的积相等，底和高可以分别不同。']],
    [['平行四边形底 6 厘米、高 4 厘米，与它等底等高的三角形面积是____平方厘米', '12', 12], ['三角形面积 10 平方厘米，与它等底等高的平行四边形面积是____平方厘米', '20', 20], ['两个等底等高的三角形，一个面积是 15 平方厘米，另一个面积是____平方厘米', '15', 15]],
    [['先画出两个等底等高的不同形状三角形，再算一算它们的面积相差多少', '相差 0：等底等高的三角形面积相等'],
     ['先在两条平行线之间画 3 个同底的三角形，再说说它们的面积各是多少、有什么关系', '高都等于平行线间距离，面积相等'],
     ['先比较平行四边形与和它等底等高的三角形的面积，再说说相差多少倍', '平行四边形面积是三角形的 2 倍']]),

  // ---- 形态族 10：三角形与内角和（triangle）----
  'math-g4-down-u05-k001': shapeTheme( // 三角形的特性
    ['三角形有 3 条边、3 个角和 3 个顶点', '三角形具有稳定性，生活中常用来加固', '四边形容易变形，三角形不容易变形'],
    [['三角形容易变形', '三角形具有稳定性；容易变形的是四边形。'],
     ['三角形有 4 条边', '三角形有 3 条边；4 条边的是四边形。'],
     ['自行车车架做成三角形只是为了好看', '是利用三角形的稳定性，使车架牢固。']],
    [['一个三角形有____条边', '3', 3], ['两个独立的三角形一共有____个角', '6', 6], ['3 个独立的三角形一共有____个顶点', '9', 9]],
    [['先找出生活中用三角形加固的例子，再说说它利用了什么特性？', '如自行车车架、屋顶桁架，利用三角形的稳定性'],
     ['先用小棒拼一个三角形和一个四边形，拉一拉，说说哪个容易变形？', '三角形拉不动（稳定），四边形容易变形'],
     ['先数一数一个三角形的边、角、顶点各有多少，再说给同桌听', '3 条边、3 个角、3 个顶点']]),
  'math-g4-down-u05-k002': shapeTheme( // 三角形的高和底
    ['从三角形的一个顶点向对边作垂线，顶点和垂足之间的线段叫高', '这条对边叫三角形的底', '三角形有 3 条高'],
    [['三角形只有 1 条高', '每个顶点都可以向对边作高，共 3 条。'],
     ['三角形的高一定在三角形里面', '钝角三角形有两条高在三角形外面。'],
     ['底和高可以随便搭配', '高必须是从顶点向它的对边（底）作的垂线段。']],
    [['三角形有____条高', '3', 3], ['直角三角形的两条直角边互为底和高，它有____条高在三角形的边上', '2', 2], ['3 个独立的三角形一共有____条高', '9', 9]],
    [['先画一个锐角三角形，再从一个顶点向对边画出它的高？', '从顶点向对边作垂线，标出垂足'],
     ['先指出直角三角形的三条高，再说说哪两条高就是直角边？', '两条直角边互为底和高，第三条在斜边上'],
     ['先画一个钝角三角形，再试着画出它的 3 条高，说说发现了什么？', '两条高落在三角形外面']]),
  'math-g4-down-u05-k003': shapeTheme( // 三角形三条边的关系
    ['三角形任意两边的和大于第三边', '判断能否围成三角形：两条短边之和与最长边比较', '三角形任意两边之差小于第三边'],
    [['任意三条线段都能围成三角形', '必须满足任意两边之和大于第三边。'],
     ['边长 2、3、6 厘米能围成三角形', '2+3=5<6，两短边之和不大于最长边，围不成。'],
     ['判断时要把两短边之和与最短的边比较', '应与最长边比较：两短边之和＞最长边才能围成。']],
    [['三条边分别是 3、4、5 厘米，其中两条短边之和是____厘米', '7', 7], ['边长 2、3、6 厘米，两条短边之和是____厘米', '5', 5], ['三角形两边分别是 4 厘米和 6 厘米，第三边一定小于____厘米', '10', 10]],
    [['先用小棒（如 3、4、5 厘米）摆一摆，再说说为什么能围成三角形？', '3+4>5，两短边之和大于最长边，能围成'],
     ['给 2、3、6 厘米三根小棒，先摆一摆，再说明为什么围不成？', '2+3=5<6，两短边之和不够长，围不成'],
     ['已知两边是 5 和 8 厘米，先写出第三边的范围，再举一个能围成的长度？', '3＜第三边＜13，如 7 厘米']]),
  'math-g4-down-u05-k004': shapeTheme( // 三角形的分类
    ['按角分：锐角三角形、直角三角形、钝角三角形', '按边分：不等边三角形、等腰三角形（等边三角形是特殊的等腰三角形）', '三个角都是锐角的三角形是锐角三角形'],
    [['有一个角是锐角的三角形是锐角三角形', '三个角都是锐角才是锐角三角形；每个三角形至少有 2 个锐角。'],
     ['等边三角形不是等腰三角形', '等边三角形是特殊的等腰三角形。'],
     ['一个三角形可以同时是直角三角形和钝角三角形', '直角和钝角不能共存于一个三角形（内角和 180°）。']],
    [['三角形按角分类，可以分成____类', '3', 3], ['等边三角形的每个角都是____度', '60', 60], ['直角三角形有____个直角', '1', 1]],
    [['先量出一个三角形三个角的度数，再说说它按角分属于哪一类', '三个角都是锐角→锐角三角形；有直角→直角三角形；有钝角→钝角三角形'],
     ['先画一个等腰三角形，再说说它按边分属于哪一类、按角分可能属于哪一类', '按边是等腰三角形；按角可能是锐角、直角或钝角三角形'],
     ['把几个三角形卡片先按角分类，再按边分类，说说两次分类结果', '标准不同，分类结果不同']]),
  'math-g4-down-u05-k005': shapeTheme( // 三角形的内角和
    ['三角形的内角和是 180°', '把三角形的三个角拼在一起，正好是一个平角', '知道两个角的度数，可以求第三个角：用 180°减去两角之和'],
    [['三角形的内角和是 360°', '三角形内角和是 180°；360°是四边形的内角和。'],
     ['大三角形的内角和比小三角形大', '所有三角形的内角和都是 180°，与大小无关。'],
     ['直角三角形的内角和是 90°', '直角三角形也是三角形，内角和仍是 180°。']],
    [['三角形两个角分别是 60°和 70°，第三个角是____度', '50', 50], ['直角三角形一个锐角是 35°，另一个锐角是____度', '55', 55], ['等边三角形每个角都是____度', '60', 60]],
    [['先量出一个三角形三个角的度数，再加一加，验证内角和？', '三个角相加等于 180°'],
     ['把纸三角形的三个角撕下来拼一拼，先说一说拼成了什么角，再写出内角和？', '拼成一个平角，内角和 180°'],
     ['已知两个角是 45°和 65°，先写出算式，再求第三个角', '180−45−65=70（度）']]),
  'math-g4-down-u05-k006': shapeTheme( // 四边形的内角和
    ['四边形的内角和是 360°', '把四边形分成两个三角形，2×180°=360°', '知道四边形三个角的度数，可以求第四个角'],
    [['四边形的内角和是 180°', '四边形可分成 2 个三角形，内角和是 360°。'],
     ['只有正方形的内角和是 360°', '所有四边形的内角和都是 360°。'],
     ['五边形的内角和也是 360°', '五边形分成 3 个三角形，内角和是 540°。']],
    [['四边形三个角分别是 90°、100°、80°，第四个角是____度', '90', 90], ['四边形的内角和是____度', '360', 360], ['一个五边形可以分成____个三角形', '3', 3]],
    [['先画一个四边形并连一条对角线，说说分成了几个三角形，再写出内角和', '分成 2 个三角形，2×180°=360°'],
     ['先量出任意四边形四个角的度数，再加一加验证？', '四个角相加等于 360°'],
     ['已知四边形三个角是 90°、90°、70°，先列式，再求第四个角', '360−90−90−70=110（度）']]),

  // ---- 形态族 11：平行垂直与四边形关系（quad-relation）----
  'math-g3-down-u03-k001': shapeTheme( // 认识多边形及长方形、正方形的特点
    ['长方形对边相等，四个角都是直角', '正方形四条边都相等，四个角都是直角', '由几条线段围成的封闭图形叫多边形'],
    [['长方形的四条边都相等', '长方形只是对边相等；四边都相等的是正方形。'],
     ['正方形的角不一定是直角', '正方形四个角都是直角。'],
     ['四边形都是长方形', '四边形包括长方形、正方形、梯形等多种。']],
    [['长方形有____个直角', '4', 4], ['长方形有____组对边', '2', 2], ['一个长方形和一个正方形一共有____条边', '8', 8]],
    [['先量出长方形纸片的四条边各是多少厘米，再说说对边有什么关系、四个角都是什么角', '对边相等，四个角都是直角'],
     ['先折一折正方形纸片数一数四条边是否都相等，再说说它和长方形的相同点与不同点', '四边都相等；都有 4 个直角，正方形是特殊的长方形'],
     ['先用小棒摆出长方形和正方形各一个，再数一数各用了几根小棒、说说边的特点', '各 4 根；长方形对边相等，正方形 4 边都相等']]),
  'math-g4-up-u05-k001': shapeTheme( // 平行与垂直
    ['在同一平面内，不相交的两条直线互相平行', '两条直线相交成直角时，互相垂直', '可以用三角尺和直尺画平行线和垂线'],
    [['同一平面内两条直线不是平行就是垂直', '还可能只是一般相交（不成直角）。'],
     ['平行线会相交于很远的一点', '同一平面内平行线永不相交。'],
     ['互相垂直的两条直线不相交', '垂直是相交成直角的特殊情况，它们相交。']],
    [['一个直角是 90°，两个直角拼起来是____度', '180', 180], ['正方形相邻两边互相垂直，一个正方形有____组互相垂直的邻边', '4', 4], ['长方形的两组对边分别平行，每组对边有____条', '2', 2]],
    [['先在练习本上画一组平行线，再说说为什么它们永不相交？', '同一平面内，沿直线方向延长也不相交'],
     ['先用三角尺画出已知直线的一条垂线，再量一量夹角？', '夹角是 90°'],
     ['在教室里找两组互相平行和两组互相垂直的边，先说一说，再指出来？', '如书本对边平行、邻边垂直']]),
  'math-g4-up-u05-k002': shapeTheme( // 平行四边形
    ['两组对边分别平行的四边形叫平行四边形', '平行四边形的对边平行且相等，对角相等', '平行四边形容易变形（不稳定性），如伸缩门'],
    [['平行四边形具有稳定性', '平行四边形容易变形；有稳定性的是三角形。'],
     ['只有一组对边平行的四边形是平行四边形', '两组对边分别平行才是；只有一组的是梯形。'],
     ['平行四边形的四个角都是直角', '一般平行四边形的角不是直角；四个直角的是长方形。']],
    [['平行四边形有____条边', '4', 4], ['平行四边形有____组对边分别平行', '2', 2], ['一个平行四边形和一个三角形一共有____条边', '7', 7]],
    [['先用小棒拼一个平行四边形，拉一拉，说说发现了什么？', '容易变形，具有不稳定性'],
     ['先量出平行四边形的两组对边，再说说它们有什么关系？', '对边平行且相等'],
     ['找一找生活中的平行四边形（如伸缩门、篱笆），先指出来，再说说利用了什么特性？', '利用平行四边形容易变形的特性']]),
  'math-g4-up-u05-k003': shapeTheme( // 梯形
    ['只有一组对边平行的四边形叫梯形', '梯形平行的两边叫上底和下底，不平行的两边叫腰', '两腰相等的梯形叫等腰梯形，有一个直角的叫直角梯形'],
    [['两组对边分别平行的四边形是梯形', '那是平行四边形；梯形只有一组对边平行。'],
     ['梯形的两条腰一定相等', '只有等腰梯形的腰相等，一般梯形不相等。'],
     ['梯形只有 2 条高', '梯形两底之间可以画无数条高。']],
    [['梯形有____组对边平行', '1', 1], ['直角梯形有____个直角', '2', 2], ['一个梯形有____条边', '4', 4]],
    [['先画一个梯形，标出上底、下底和两条腰，再画出它的一条高？', '高是两底之间的垂线段'],
     ['先判断：平行四边形是不是梯形？再说说理由', '不是；梯形只有一组对边平行，平行四边形有两组'],
     ['先画一个直角梯形，再说说它有几个直角', '直角梯形有 2 个直角']]),
  'math-g4-up-u05-k004': shapeTheme( // 四边形之间的关系
    ['长方形和正方形是特殊的平行四边形', '正方形是特殊的长方形', '梯形只有一组对边平行，与平行四边形不同类'],
    [['长方形不是平行四边形', '长方形两组对边分别平行，是特殊的平行四边形。'],
     ['正方形不是长方形', '正方形是长和宽相等的特殊长方形。'],
     ['梯形也是平行四边形', '梯形只有一组对边平行，不符合平行四边形定义。']],
    [['平行四边形、长方形、正方形都有____组对边平行', '2', 2], ['梯形有____组对边平行', '1', 1], ['一个长方形和一个梯形一共有____条边', '8', 8]],
    [['先用集合图把四边形、平行四边形、长方形、正方形、梯形整理出来，再说说谁是谁的特殊情况', '长方形是特殊的平行四边形，正方形是特殊的长方形'],
     ['先判断：正方形是不是平行四边形？再说明理由', '是；两组对边分别平行，是特殊的平行四边形'],
     ['先说出梯形和平行四边形的相同点和不同点，再各画一个？', '都有 4 条边；平行四边形两组对边平行，梯形只有一组']]),

  // ---- 形态族 12：表面积、体积与容积（solid-measure）----
  'math-g5-down-u03-k003': shapeTheme( // 表面积
    ['长方体或正方体 6 个面的总面积叫作它的表面积', '长方体表面积=（长×宽+长×高+宽×高）×2', '正方体表面积=棱长×棱长×6'],
    [['表面积只要算看得见的 3 个面', '表面积是 6 个面的总面积，看不见的面也要算。'],
     ['正方体表面积=棱长×棱长×4', '正方体有 6 个面，表面积=棱长×棱长×6。'],
     ['表面积的单位是立方厘米', '表面积用平方单位；立方单位是体积单位。']],
    [['正方体棱长 2 厘米，表面积是____平方厘米', '24', 24], ['长方体长 3 厘米、宽 2 厘米、高 1 厘米，表面积是____平方厘米', '22', 22], ['正方体棱长 1 厘米，表面积是____平方厘米', '6', 6]],
    [['先量出长方体纸盒的长、宽、高，再算出它的表面积是多少平方厘米', '（长×宽+长×高+宽×高）×2，如（10×8+10×6+8×6)×2=376 平方厘米'],
     ['先算出棱长 5 厘米正方体的表面积是多少，再说说为什么可以用棱长×棱长×6', '5×5×6=150 平方厘米，6 个面完全相同'],
     ['先拆开一个长方体包装盒铺平，数一数它有几个面，再说明表面积就是这些面的面积之和', '6 个面的面积之和']]),
  'math-g5-down-u03-k004': shapeTheme( // 体积
    ['物体所占空间的大小叫作物体的体积', '常用体积单位有立方厘米、立方分米、立方米，相邻两个单位间的进率是 1000', '长方体体积=长×宽×高，正方体体积=棱长×棱长×棱长'],
    [['体积和面积用的是同样的单位', '体积用立方单位，面积用平方单位。'],
     ['相邻体积单位之间的进率是 100', '是 1000，不是 100。'],
     ['长方体体积=（长+宽+高）×4', '（长+宽+高）×4 是棱长总和；体积=长×宽×高。']],
    [['长方体长 4 厘米、宽 3 厘米、高 2 厘米，体积是____立方厘米', '24', 24], ['正方体棱长 3 厘米，体积是____立方厘米', '27', 27], ['1 立方分米=____立方厘米', '1000', 1000]],
    [['先用 1 立方厘米的小正方体摆一个长 4、宽 3、高 2 的长方体，再数一数体积是多少立方厘米', '4×3×2=24 个，即 24 立方厘米'],
     ['先算出棱长 3 厘米正方体的体积是多少，再说说它和表面积有什么不同', '3×3×3=27 立方厘米；体积是占空间大小，表面积是 6 个面的面积和'],
     ['先把一块石头放进盛水的量杯，再看一看水面上升了多少、说说上升的水的体积和石头有什么关系', '上升部分水的体积就是石头的体积']]),
  'math-g5-down-u03-k005': shapeTheme( // 容积
    ['容器所能容纳物体的体积叫作容器的容积', '计量液体的体积常用升和毫升', '1 升=1 立方分米，1 毫升=1 立方厘米，1 升=1000 毫升'],
    [['容积和体积完全相同', '体积是物体本身占的空间；容积是容器能装多少，要从里面量。'],
     ['1 升=100 毫升', '1 升=1000 毫升。'],
     ['计量液体体积只能用立方米', '液体常用升和毫升作单位。']],
    [['1 升=____毫升', '1000', 1000], ['2 升=____毫升', '2000', 2000], ['5000 毫升=____升', '5', 5]],
    [['先说出水瓶的容积大约是多少，再看看标签上的净含量验证', '如 500 毫升，与标签一致'],
     ['一个长方体鱼缸从里面量长 5 分米、宽 3 分米、高 2 分米，先算容积，再说说能装多少升水', '5×3×2=30 立方分米=30 升'],
     ['先把 2500 毫升换算成升，再说说换算时要除以几', '2500÷1000=2.5 升，除以进率 1000']]),

  // ---- 形态族 13：圆柱圆锥度量（cylinder-measure）----
  'math-g6-down-u03-k002': shapeTheme( // 圆柱的表面积
    ['圆柱的表面积=侧面积+两个底面的面积', '圆柱的侧面积=底面周长×高', '圆柱的底面是圆，底面积=πr²'],
    [['圆柱表面积=侧面积', '还要加上两个底面的面积。'],
     ['圆柱侧面积=底面积×高', '侧面积=底面周长×高。'],
     ['圆柱表面积只算一个底面', '上下两个底面完全相同，都要算。']],
    [['圆柱底面半径 1 厘米、高 5 厘米，侧面积是____平方厘米（π取3.14）', '31.4', 31.4], ['底面半径 2 厘米的圆柱，两个底面积一共是____平方厘米（π取3.14）', '25.12', 25.12], ['圆柱底面周长 6.28 厘米、高 10 厘米，侧面积是____平方厘米', '62.8', 62.8]],
    [['先量出圆柱形水杯的底面半径和高，再算出它的表面积是多少', '侧面积+两个底面积：2πrh+2πr²，按实测代入'],
     ['先算一个底面半径 2 分米、高 5 分米的圆柱表面积，再说说侧面积是多少、怎么算的', '侧面积=底面周长×高=62.8 平方分米，表面积=62.8+2×3.14×2²=87.92 平方分米'],
     ['先拆一个圆柱形纸筒，数一数它的表面由几部分组成，再说说表面积怎么求', '3 部分：侧面积+两个底面积']]),
  'math-g6-down-u03-k003': shapeTheme( // 圆柱的体积
    ['圆柱的体积=底面积×高，用字母表示 V=Sh=πr²h', '把圆柱切拼成近似的长方体，体积不变', '拼成的长方体的底面积等于圆柱的底面积，高等于圆柱的高'],
    [['圆柱体积=底面周长×高', '底面周长×高是侧面积；体积=底面积×高。'],
     ['圆柱体积是与它等底等高圆锥体积的三分之一', '说反了：圆锥体积是等底等高圆柱的三分之一。'],
     ['底面积相等、高不相等的圆柱体积相等', '体积由底面积和高共同决定。']],
    [['圆柱底面积 10 平方厘米、高 4 厘米，体积是____立方厘米', '40', 40], ['圆柱底面半径 2 厘米、高 5 厘米，体积是____立方厘米（π取3.14）', '62.8', 62.8], ['圆柱体积 60 立方厘米、底面积 12 平方厘米，高是____厘米', '5', 5]],
    [['先算一个底面积 10 平方厘米、高 6 厘米的圆柱体积是多少，再说说公式怎么来的', '底面积×高=60 立方厘米，由长方体体积推导'],
     ['先量出圆柱形罐子的底面半径和高，再算出它的体积是多少立方厘米', 'V=πr²h，按实测代入'],
     ['一根圆柱形木料底面半径 2 分米、长 10 分米，先写出算式，再算出体积是多少立方分米', '3.14×2²×10=125.6 立方分米']]),
  'math-g6-down-u03-k005': shapeTheme( // 圆锥的体积
    ['圆锥的体积等于与它等底等高圆柱体积的三分之一', '圆锥的体积 V=(1/3)Sh=(1/3)πr²h', '等底等高的圆柱体积是圆锥的 3 倍'],
    [['圆锥体积=底面积×高', '忘了乘 1/3：等底等高时圆锥体积是圆柱的三分之一。'],
     ['任意圆锥的体积都是圆柱体积的三分之一', '必须强调「等底等高」，否则关系不成立。'],
     ['等底等高的圆柱和圆锥体积相等', '圆柱体积是圆锥的 3 倍。']],
    [['圆锥与圆柱等底等高，圆柱体积 30 立方厘米，圆锥体积是____立方厘米', '10', 10], ['圆锥底面积 12 平方厘米、高 6 厘米，体积是____立方厘米', '24', 24], ['圆锥体积 15 立方厘米，与它等底等高的圆柱体积是____立方厘米', '45', 45]],
    [['先用等底等高的圆锥和圆柱容器做倒沙实验，再说说圆锥体积是圆柱的几分之几', '倒 3 次正好装满：圆锥体积是等底等高圆柱的 1/3'],
     ['先算一个底面积 12 平方厘米、高 6 厘米的圆锥体积是多少，再与同底同高的圆柱比一比', '12×6÷3=24 立方厘米，是圆柱体积（72）的 1/3'],
     ['一个圆锥形沙堆底面半径 3 米、高 2 米，先写出算式，再算出体积是多少立方米', '3.14×3²×2÷3=18.84 立方米']]),
  'math-g6-down-u03-k006': shapeTheme( // 解决问题（圆柱圆锥应用）
    ['求圆柱形水桶能装多少水，就是求它的容积（从里面量）', '求做圆柱形水桶用多少铁皮，就是求它的表面积', '计算前先统一单位，再选择公式'],
    [['求水桶能装多少水就是求表面积', '能装多少是容积；用多少铁皮才是表面积。'],
     ['圆锥形沙堆的体积=底面积×高', '忘了乘 1/3：圆锥体积=底面积×高÷3。'],
     ['无盖水桶的表面积要算两个底面', '无盖只算一个底面加侧面。']],
    [['圆柱形水桶底面积 20 平方分米、高 5 分米，能装水____升', '100', 100], ['圆锥形沙堆底面积 9 平方米、高 2 米，体积是____立方米', '6', 6], ['圆柱形水杯底面半径 3 厘米、高 10 厘米，容积约____立方厘米（π取3.14）', '282.6', 282.6]],
    [['一个圆柱形粮囤底面积 6 平方米、高 2 米，先算它能装多少立方米粮食，再说说用了什么公式', '6×2=12 立方米，用体积=底面积×高'],
     ['做一个无盖圆柱形水桶，底面半径 2 分米、高 5 分米，先算侧面积，再加上一个底面积求用多少铁皮（π取3.14）', '侧面积 62.8 平方分米，加底面 12.56，共 75.36 平方分米'],
     ['一个圆锥形沙堆底面积 12 平方米、高 1.5 米，先列式再算出沙堆体积', '12×1.5÷3=6（立方米）']]),

  // ---- 形态族 14：圆的周长与面积、起跑线（circle-measure）----
  'math-g6-up-u04-k002': shapeTheme( // 圆的周长
    ['围成圆的曲线的长叫作圆的周长', '圆的周长与直径的比值是一个固定的数，叫作圆周率 π，π≈3.14', '圆的周长 C=πd 或 C=2πr'],
    [['圆周率 π=3', 'π≈3.14，是一个固定不变的数。'],
     ['大圆的圆周率比小圆大', '圆周率与圆的大小无关，都是 π。'],
     ['圆的周长=半径×π', 'C=2πr 或 πd；半径乘 π 只是周长的一半。']],
    [['圆的直径 10 厘米，周长是____厘米（π取3.14）', '31.4', 31.4], ['圆的半径 2 厘米，周长是____厘米（π取3.14）', '12.56', 12.56], ['圆的半径 10 厘米，周长是____厘米（π取3.14）', '62.8', 62.8]],
    [['先用绳子绕圆形杯口一周量出周长，再算一算周长除以直径的商约是多少', '商约是 3.14，即圆周率 π'],
     ['先算一个直径 10 厘米的圆的周长是多少，再说说用了哪个公式', 'C=πd=3.14×10=31.4 厘米'],
     ['一个圆形花坛半径 4 米，先写出算式，再算出绕花坛一圈有多少米', 'C=2πr=2×3.14×4=25.12 米']]),
  'math-g6-up-u04-k003': shapeTheme( // 圆的面积
    ['圆的面积 S=πr²', '把圆分成若干等份拼成近似长方形，长方形的长≈圆周长的一半', '拼成的长方形的宽≈圆的半径，面积与圆相等'],
    [['圆的面积=πd', 'πd 是周长公式；面积=πr²。'],
     ['圆的面积=πr', '面积=π×r×r，不是 π×r。'],
     ['圆拼成近似长方形后周长和面积都不变', '面积不变，但周长变了（多了两条半径）。']],
    [['圆的半径 3 厘米，面积是____平方厘米（π取3.14）', '28.26', 28.26], ['圆的半径 2 厘米，面积是____平方厘米（π取3.14）', '12.56', 12.56], ['圆的半径 10 厘米，面积是____平方厘米（π取3.14）', '314', 314]],
    [['先把圆形纸片剪成若干等份拼成近似长方形，再说说圆面积公式是怎么推导出来的、近似长方形的宽约是多少', '长=圆周长的一半、宽=半径，S=πr²'],
     ['先算一个半径 3 厘米的圆的面积是多少，再说说计算顺序', '先算 r²=9，S=3.14×9=28.26 平方厘米'],
     ['一个圆形桌面直径 8 分米，先求出半径，再算出面积是多少平方分米', 'r=4 分米，3.14×4²=50.24 平方分米']]),
  'math-g6-up-u04-k005': shapeTheme( // 确定起跑线
    ['相邻跑道起跑线的距离差=跑道宽×2π', '外圈跑道比内圈长，所以外圈起跑线要提前', '各跑道直道部分长度相同，差距来自弯道（两个半圆合成一个圆）'],
    [['所有跑道的运动员应从同一起跑线出发', '外圈更长，外圈起跑线要提前才公平。'],
     ['相邻跑道长度差=跑道宽×π', '两个弯道合成一个圆，半径差=跑道宽，周长差=跑道宽×2π。'],
     ['起跑线差距与跑道宽无关', '差距=跑道宽×2π，跑道越宽差距越大。']],
    [['跑道宽 1 米，相邻起跑线的距离差约是____米（π取3.14）', '6.28', 6.28], ['跑道宽 1.5 米，相邻起跑线的距离差约是____米（π取3.14）', '9.42', 9.42], ['跑道宽 2 米，相邻起跑线的距离差约是____米（π取3.14）', '12.56', 12.56]],
    [['400 米跑道宽 1 米，先算相邻两道相差多少米，再说说为什么起跑线要提前', '1×2×3.14=6.28 米，外圈更长所以提前'],
     ['先量一量操场跑道的宽度，再算出相邻起跑线的距离差？', '如宽 1.2 米：1.2×2×3.14≈7.54 米'],
     ['先说说为什么各道直道部分不用调整，只有弯道产生差距？', '直道长度相同；两个半圆弯道合成一个圆，半径差造成周长差']]),

  // ---- 形态族 15：密铺（tessellation）----
  'math-g5-up-u08-k001': shapeTheme( // 密铺的概念
    ['图形之间不留空隙、不重叠地铺满整个平面，这种铺法叫密铺', '密铺常用相同的图形反复拼接', '地砖、蜂巢都是生活中的密铺'],
    [['图形之间有重叠也叫密铺', '密铺要求不留空隙也不重叠。'],
     ['留有缝隙的铺法也是密铺', '密铺必须不留空隙。'],
     ['只有正方形才能密铺', '三角形、长方形、正六边形等也能密铺。']],
    [['密铺要求拼接点处各内角之和是____度', '360', 360], ['用边长 1 分米的正方形地砖铺 1 平方米的地面，需要____块', '100', 100], ['边长 2 分米的正方形地砖，4 块能铺____平方分米', '16', 16]],
    [['先观察教室地面的地砖，说说它是不是密铺，再指出拼接点？', '地砖不留空隙不重叠，是密铺'],
     ['先用同样的三角形纸片拼一拼，说说能不能密铺，再看看拼接点处有几个角', '能密铺；拼接点处各角合起来是 360°'],
     ['先画一画：用圆能不能铺满一张纸不留缝隙？再说说结论', '圆与圆之间必有空隙，不能密铺']]),
  'math-g5-up-u08-k002': shapeTheme( // 可密铺与不可密铺的图形
    ['正方形、长方形、三角形、平行四边形和梯形都能单独密铺', '正五边形、圆不能单独密铺', '任意相同的三角形都能密铺'],
    [['圆可以单独密铺', '圆与圆之间必有空隙，不能单独密铺。'],
     ['正五边形可以单独密铺', '正五边形内角 108°，360 不是 108 的整数倍，不能密铺。'],
     ['只有规则图形才能密铺', '任意三角形、任意四边形都能密铺。']],
    [['正方形、三角形、圆、平行四边形中，能单独密铺的有____种', '3', 3], ['正六边形的每个内角是____度', '120', 120], ['拼接点处 3 个正六边形的内角合起来是____度', '360', 360]],
    [['先用同样的正方形、圆纸片分别拼一拼，再说说哪个能密铺、为什么？', '正方形能密铺；圆之间有空隙不能密铺'],
     ['先猜一猜正五边形能不能密铺，再用 108°算一算拼接点处的角？', '3×108°=324°≠360°，不能密铺'],
     ['把两个完全一样的三角形拼一拼，先拼成平行四边形，再说说三角形能否密铺？', '任意相同三角形都能密铺']]),
  'math-g5-up-u08-k003': shapeTheme( // 密铺的原理
    ['拼接点处各内角之和恰好为 360°时，图形能够密铺', '正六边形每个内角 120°，3 个拼在一起正好是 360°', '正方形每个内角 90°，4 个拼在一起是 360°'],
    [['拼接点处内角和是 180°就能密铺', '必须是 360°——绕一点铺满一周。'],
     ['正五边形 3 个内角拼起来正好 360°', '3×108°=324°，不是 360°，所以正五边形不能密铺。'],
     ['只要图形好看就能密铺', '能否密铺取决于拼接点处内角和是否为 360°。']],
    [['正方形内角 90°，拼接点处需要____个正方形才能密铺', '4', 4], ['正六边形内角 120°，拼接点处需要____个正六边形才能密铺', '3', 3], ['正三角形内角 60°，拼接点处需要____个正三角形才能密铺', '6', 6]],
    [['先算出正六边形的内角，再算一算拼接点处要几个才能密铺', '120°，3×120°=360°，要 3 个'],
     ['先想一想正八边形（内角 135°）能不能单独密铺，再用 360°算一算？', '360÷135 不是整数，不能单独密铺'],
     ['先用正三角形纸片拼一拼，数出拼接点处有几个角，再算出角度和', '6 个角，6×60°=360°，能密铺']]),
  'math-g5-up-u08-k004': shapeTheme( // 设计密铺图案
    ['可以用平移、旋转、轴对称把基本图形组成密铺图案', '设计密铺图案先选能密铺的基本图形', '密铺图案体现了数学与艺术的结合'],
    [['设计密铺图案只能用一种图形', '可以用多种能密铺的图形组合设计。'],
     ['密铺图案中图形之间可以留空隙', '密铺必须不留空隙、不重叠。'],
     ['基本图形经过平移后会变形', '平移、旋转、轴对称都不改变图形的形状和大小。']],
    [['用边长 1 厘米的正方形拼密铺图案，6 块能铺____平方厘米', '6', 6], ['把一个基本图形平移 3 次，连原来的共有____个基本图形', '4', 4], ['用 8 块面积各 2 平方厘米的三角形密铺，总面积是____平方厘米', '16', 16]],
    [['先选一个能密铺的基本图形（如正方形），再用平移设计一条密铺花边', '每次平移一个边长，连续铺满'],
     ['先用两种颜色的正三角形交替密铺，再说说拼接点处角的关系', '6 个 60°角合起来 360°'],
     ['先画一个基本图形，再用旋转的方法设计一个密铺图案，说说用了几次旋转', '如绕一点每次旋转 90°，转 3 次形成图案']]),

  // ---- 形态族 16：正方体涂色问题（cube-coloring）----
  'math-g5-down-u09-k001': shapeTheme( // 正方体涂色问题
    ['把大正方体棱长平均分成 n 份切开，三面涂色的小正方体在顶点处，有 8 个', '两面涂色的在棱上（不含顶点），有 12×(n−2) 个', '一面涂色的在面上（不含棱和顶点），有 6×(n−2)² 个；没有涂色的在内部'],
    [['三面涂色的小正方体有 6 个', '三面涂色的在 8 个顶点处，共 8 个。'],
     ['两面涂色的在面上', '两面涂色的在棱上（顶点除外）。'],
     ['没有涂色的小正方体在大正方体表面', '没有涂色的在内部，有 (n−2)³ 个。']],
    [['把大正方体棱长 3 等分切开，三面涂色的小正方体有____个', '8', 8], ['棱长 3 等分，两面涂色的有 12×(3−2)=____个', '12', 12], ['棱长 3 等分，一面涂色的有 6×(3−2)²=____个', '6', 6]],
    [['把棱长 3 等分的大正方体表面涂色，先数一数三面涂色的有几个，再说说它们在哪里', '8 个，都在顶点处'],
     ['棱长 4 等分时，先列出两面涂色的算式，再算出个数', '12×(4−2)=24 个'],
     ['棱长 3 等分时，先算没有涂色的个数，再说说它们藏在哪儿', '(3−2)³=1 个，在最中间']]),
  'math-g5-down-u09-k002': shapeTheme( // 各类涂色小正方体的位置特征
    ['三面涂色的小正方体在大正方体的顶点处', '两面涂色的在棱上（除去顶点）', '一面涂色的在面上（除去棱和顶点），没有涂色的在内部'],
    [['三面涂色的在面中央', '三面涂色的只能在顶点处。'],
     ['没有涂色的在棱上', '棱上的至少两面涂色；没涂色的藏在内部。'],
     ['一面涂色的在顶点处', '顶点处是三面涂色；一面涂色的在面中央。']],
    [['棱长 4 等分的大正方体，两面涂色的有 12×(4−2)=____个', '24', 24], ['棱长 4 等分，没有涂色的有 (4−2)³=____个', '8', 8], ['棱长 5 等分，一面涂色的有 6×(5−2)²=____个', '54', 54]],
    [['先把大正方体表面涂色后切成 27 个小正方体，再数一数三面涂色的有几个、在什么位置', '8 个，都在顶点处'],
     ['先说说两面涂色的小正方体在大正方体的什么位置，再算一算 3×3×3 时有多少个', '在棱上（不含顶点），12 条棱各 1 个共 12 个'],
     ['先说说一面涂色的小正方体在什么位置，再算一算 4×4×4 时有多少个', '在每个面的中间，6 个面各 4 个共 24 个']]),

  // ---- 形态族 17：总复习与重叠问题（review）----
  'math-g3-down-u08-k003': shapeTheme( // 图形的认识与测量、位置与运动
    ['长方形周长=（长+宽）×2，面积=长×宽', '对折后能完全重合的图形是轴对称图形', '平移和旋转都不改变图形的形状和大小'],
    [['平移后图形的大小会改变', '平移只改变位置，形状和大小不变。'],
     ['周长和面积是同一个概念', '周长是一周的长度，面积是面的大小。'],
     ['旋转后图形的形状会改变', '旋转只改变方向和位置，形状和大小不变。']],
    [['长方形长 7 厘米、宽 3 厘米，周长是____厘米', '20', 20], ['长方形长 7 厘米、宽 3 厘米，面积是____平方厘米', '21', 21], ['正方形边长 6 厘米，周长是____厘米', '24', 24]],
    [['先算出一个长 8 厘米、宽 4 厘米的长方形的周长和面积，再说说两个结果有什么不同？', '周长 24 厘米（长度），面积 32 平方厘米（面的大小）'],
     ['先画一个图形，再把它向右平移 5 格，说说平移前后什么没变？', '形状和大小不变，只是位置变了'],
     ['先判断一个图形是不是轴对称图形，再画出它的对称轴？', '沿对称轴对折能完全重合才是轴对称图形']]),
  'math-g3-down-u08-k006': shapeTheme( // 数学广角——重叠问题
    ['解决重叠问题要先求两部分的和，再减去重复的部分', '重叠（重复）的部分只能算一次', '可以画集合图帮助分析重叠问题'],
    [['两部分相加就是总数，不用管重复', '重复部分被算了两次，必须减去一次。'],
     ['重叠部分要算两次', '重叠部分只能算一次。'],
     ['参加两个小组的人数之和一定等于总人数', '有重复时，和大于总人数，要减去重复人数。']],
    [['语文小组 8 人、数学小组 9 人，两组都参加的有 3 人，一共有____人', '14', 14], ['会游泳的 10 人、会骑车的 12 人，两样都会的有 4 人，至少会一样的有____人', '18', 18], ['订报纸的 15 人、订杂志的 10 人，两种都订的有 5 人，一共有____人', '20', 20]],
    [['先列出 8+9，再减去重复的 3 人，说说为什么要减？', '都参加的 3 人被算了两次，要减去一次'],
     ['班上 20 人订语文报、18 人订数学报，8 人两种都订，先画集合图，再算总人数？', '20+18−8=30 人'],
     ['先调查小组里会打乒乓球和会打羽毛球的人数，再算至少会一样的有多少人', '两部分相加再减去两样都会的人数']])
};

// 数值选项干扰项：由正确数值确定性派生 3 个互异干扰数
// （去重防 part===rest 重复；非整数统一保留两位小数，避免浮点尾巴）
function numClean(x) { return Math.round(x * 100) / 100; }
function numDistractors(n) {
  var cands = [n + 1, n - 1, n + 2, n - 2, n * 2, n + 10, Math.round(n / 2), n + 3, n - 3, n * 3];
  var out = [];
  for (var k = 0; k < cands.length && out.length < 3; k++) {
    var x = numClean(cands[k]);
    if (typeof x !== 'number' || !isFinite(x)) continue;
    if (x > 0 && x !== n && out.indexOf(x) === -1) out.push(x);
  }
  return out.map(function (x) { return String(x); });
}

// 主题化统一 maker：按题型从 KP 教学素材组装题目。
// 证据包络（mode/graphic/shapeName/steps/unitPx）与既有泛型路径完全一致；
// choice/fill 用 nums 数值变式保证去重指纹互异（data.operands），
// judge/geometry/apply 用 v=i%3 变式设问保证题面哈希互异；
// judge 假命题必带 data.misconception（p25-07 教学闭环断言）。
function makeThemedShapeQuestion(plan, context, i, qMeta, graphic, theme) {
  var qt = plan.questionTypeId;
  var name = (plan.semanticParams && plan.semanticParams.name) || '图形';
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var v = ((i % 3) + 3) % 3;
  var facts = theme.facts;
  var wrongs = theme.wrongs;
  var nums = theme.nums;
  var data = { mode: qt, steps: 1, graphic: graphic, shapeName: qMeta.meta.name };
  var prompt, answer, answerMode = 'input';

  if (qt === 'choice') {
    var cItem = nums[v % nums.length];
    var options = Rng.shuffle(rng, [cItem.a].concat(numDistractors(cItem.n)));
    data.options = options;
    data.correctIndex = options.indexOf(cItem.a);
    data.operands = [cItem.n];
    prompt = name + '：' + cItem.q + '（选出正确答案）';
    answer = { value: String(data.correctIndex), acceptable: [] };
    answerMode = 'choice';
  } else if (qt === 'judge') {
    var isTrue = rng() < 0.5;
    var shown, explanation;
    if (isTrue) {
      shown = facts[i % facts.length];
      explanation = '「' + shown + '」——符合' + name + '的知识，说法正确。';
    } else {
      var w = wrongs[i % wrongs.length];
      shown = w.t;
      explanation = '「' + shown + '」——' + w.m;
      data.misconception = w.m;
    }
    data.shownStatement = shown;
    prompt = name + '：判断对错——「' + shown + '」。这个说法对吗？';
    answer = { value: isTrue, acceptable: [], explanation: explanation };
    answerMode = 'judge';
  } else if (qt === 'fill') {
    var fItem = nums[v % nums.length];
    data.operands = [fItem.n];
    prompt = name + '：' + fItem.q;
    answer = { value: fItem.a, acceptable: [] };
  } else if (qt === 'geometry') {
    var gItem = nums[v % nums.length];
    data.operands = [gItem.n];
    prompt = name + '：观察下图（' + qMeta.meta.name + '），想一想——' + gItem.q;
    answer = { value: gItem.a, acceptable: [] };
  } else { // apply，steps=2
    var sList = theme.scenes.length
      ? theme.scenes
      : nums.map(function (x) { return { t: x.q, a: x.a }; });
    var sItem = sList[v % sList.length];
    data.steps = 2;
    prompt = name + '：' + sItem.t;
    answer = { value: sItem.a, acceptable: [] };
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: answer,
    answerMode: answerMode,
    data: data
  };
}

function createShapeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:shape';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'calc', 'geometry', 'apply'],
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
      // P25-08：从 SemanticParameters 注入的 plan.semanticParams.name 读取 KP 真实名称，
      // 派生命中具体图形类型（替代 kp={} 恒 flat 的语义偏移）。
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var shapeMeta = getShapeMeta(kp, kpName);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        // P28-GEN-SHAPE-FLAT-SAMPLE-01：flat 兜底族（泛称图形 KP，如「平面图形认识」）
        // 按该题种子 rng 从平面图形族取样具体形状——与 KP concept（直观认识长方形/
        // 正方形/三角形/圆/平行四边形）对齐；具体形状 KP（名称含正方/长方/三角/圆等）不取样。
        var qMeta = shapeMeta;
        if (shapeMeta.legacyType === 'flat') {
          var picked = FLAT_FAMILY[Math.floor(rng() * FLAT_FAMILY.length)];
          qMeta = { legacyType: picked, subtype: picked, category: shapeMeta.category, meta: SHAPE_FEATURES[picked] };
        }
        var graphic = generateGraphicParams(qMeta.subtype, plan.difficulty, rng);

        var q;
        var qt = plan.questionTypeId;
        // P28-HOLLOW-04：分数乘整数 KP 的 fill/choice/judge/apply 与 geometry 一样走分数条
        // 原生 maker（五行均要 geometry 分数条），不落 flat 随机认图/泛型度量。
        if (kpName.indexOf('分数乘整数') !== -1
          && ['fill', 'choice', 'judge', 'apply', 'geometry'].indexOf(qt) !== -1) {
          questions.push(makeFractionTimesIntegerQuestion(plan, context, i, kpName));
          continue;
        }
        // P28-HOLLOW-02：shape-flat 空心全修——SHAPE_THEME 精确查 canonical KP，
        // 命中即走主题化 maker（教学素材题面/答案），不落 flat 随机认图模板。
        var themedId = (plan.semanticParams && plan.semanticParams.knowledgePointId) || pkp(plan);
        var themed = SHAPE_THEME[themedId];
        if (themed && ['choice', 'judge', 'fill', 'geometry', 'apply'].indexOf(qt) !== -1) {
          questions.push(makeThemedShapeQuestion(plan, context, i, qMeta, graphic, themed));
          continue;
        }
        if (qt === 'choice') {
          if (rng() < 0.5) q = makeRecognitionQuestion(plan, context, i, qMeta, graphic);
          else q = makeClassificationQuestion(plan, context, i, qMeta, graphic);
        } else if (qt === 'judge') {
          q = makeFeatureQuestion(plan, context, i, qMeta, graphic);
        } else if (qt === 'fill') {
          if (rng() < 0.6) q = makeNamingQuestion(plan, context, i, qMeta, graphic);
          else q = makeCountQuestion(plan, context, i, qMeta, graphic);
        } else if (qt === 'geometry') {
          q = makeGeometryQuestion(plan, context, i, qMeta, graphic, kpName);
        } else if (qt === 'apply') {
          // geometry 应用题（面积/周长/体积等）
          q = makeGeometryApplyQuestion(plan, context, i, qMeta, graphic, kpName);
        } else if (qt === 'calc') {
          // P25-08：几何度量计算（周长/面积/表面积/体积/圆周长/圆面积）—— 题干内嵌算式
          q = makeCalcMeasurementQuestion(plan, context, i, kpName);
        } else {
          q = makeRecognitionQuestion(plan, context, i, qMeta, graphic);
        }
        questions.push(q);
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

// P25-06 H2：原 SHAPE_KPS（105 条 math-gN-mN-* 模块制 / math-gN-cN-* 竞赛制 历史 ID）
// 已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS（shape-recognition 记录的 canonical 列表）。
function buildAll() {
  return [
    createShapeGenerator({
      id: 'generator:shape-recognition'
    })
  ];
}

module.exports = {
  SHAPE_SUBTYPE: SHAPE_SUBTYPE,
  SHAPE_FEATURES: SHAPE_FEATURES,
  createShapeGenerator: createShapeGenerator,
  buildAll: buildAll
};