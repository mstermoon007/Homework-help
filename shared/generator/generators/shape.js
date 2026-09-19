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

// P25-08：由 KP 名称机械派生图形子类型（替代 kp.source.legacyType 的 kp={} 恒 flat 问题）。
// 顺序敏感：具体形状优先于泛称（如「正方形」先于「图形」）。
var NAME_TO_SHAPE = [
  { re: /正方/, type: 'square' },
  { re: /长方/, type: 'rectangle' },
  { re: /三角/, type: 'triangle' },
  { re: /圆/, type: 'circle' },
  { re: /平行四边形/, type: 'parallelogram' },
  { re: /梯形/, type: 'trapezoid' },
  { re: /线段|画线段/, type: 'line-segment' },
  { re: /角(的|各|度|认)/, type: 'angle' },
  { re: /对称/, type: 'symmetry' },
  { re: /密铺/, type: 'tessellation' },
  { re: /立方/, type: 'cube' },
  { re: /长.*体|长方体/, type: 'cuboid' },
  { re: /圆柱/, type: 'cylinder' },
  { re: /圆锥/, type: 'cone' },
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
      return {
        type: 'geometry',
        subtype: subtype,
        params: {
          width: Rng.randInt(rng, minDim, maxDim),
          height: subtype === 'square' ? undefined : Rng.randInt(rng, minDim, maxDim),
          size: subtype === 'square' ? Rng.randInt(rng, minDim, maxDim) : undefined,
          labelSides: rng() < 0.7,
          rightAngle: true,
          unit: unit,
          unitPx: unitPx
        }
      };
    case 'triangle':
      var a = Rng.randInt(rng, minDim, maxDim);
      var b = Rng.randInt(rng, minDim, maxDim);
      var c = Rng.randInt(rng, Math.abs(a-b)+1, Math.min(a+b-1, maxDim));
      return {
        type: 'geometry',
        subtype: 'triangle',
        params: {
          p1: [0, 0],
          p2: [a, 0],
          p3: [Rng.randInt(rng, 0, a), Rng.randInt(rng, 1, maxDim)],
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
    default:
      // 兜底为长方形
      return {
        type: 'geometry',
        subtype: 'rectangle',
        params: {
          width: Rng.randInt(rng, minDim, maxDim),
          height: Rng.randInt(rng, minDim, maxDim),
          labelSides: true,
          rightAngle: true,
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

function makeFeatureQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var isTrue = rng() < 0.5;
  var feature = Rng.pick(rng, shapeMeta.meta.features);
  var shown = isTrue ? feature : (Rng.pick(rng, ['无棱无面', '只有长和宽', '不能滚动', '面是圆形', '有棱有角']) || feature);
  var prompt = shapeMeta.meta.name + '的特征是：「' + shown + '」—— 对还是错？';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: isTrue, acceptable: [] },
    answerMode: 'judge',
    data: {
      mode: 'judge',
      steps: 1,
      graphic: graphic,
      shownFeature: shown,
      shapeName: shapeMeta.meta.name
    }
  };
}

function makeNamingQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
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
    // 通用几何图形识别
    prompt = '请观察图形，' + name;
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

function makeRecognizeQuestion(plan, context, i, shapeMeta, graphic, kpName) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // recognize qt：输出分类/判断题，让学生识别图形类型
  var name = kpName || '图形识别';
  var isChoice = rng() < 0.5;

  if (isChoice) {
    // 选择题：哪个是 X 图形
    var target = shapeMeta.legacyType;
    var correct = shapeMeta.meta.name;
    var allShapes = Object.keys(SHAPE_FEATURES);
    var distractors = allShapes.filter(function(s){ return s !== target; }).slice(0, 3);
    var options = [correct];
    for (var d = 0; d < distractors.length; d++) {
      options.push(SHAPE_FEATURES[distractors[d]]?.name || distractors[d]);
    }
    options = Rng.shuffle(rng, options).slice(0, 4);
    var correctIndex = options.indexOf(correct);
    return {
      knowledgePointId: pkp(plan),
      questionType: 'recognize',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: name + '：下列哪个图形符合描述？',
      answer: { value: String(correctIndex), acceptable: [] },
      answerMode: 'choice',
      data: {
        mode: 'recognize',
        steps: 1,
        graphic: graphic,
        options: options,
        correctIndex: correctIndex,
        shapeName: shapeMeta.meta.name
      }
    };
  } else {
    // 判断题：这是 X 图形吗
    var shownIsCorrect = rng() < 0.6;
    var shownShape = shownIsCorrect ? correct : (Rng.pick(rng, ['三角形', '长方形', '正方形', '圆']) || '三角形');
    return {
      knowledgePointId: pkp(plan),
      questionType: 'recognize',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: name + '：这是' + shownShape + '吗？',
      answer: { value: shownIsCorrect, acceptable: [] },
      answerMode: 'judge',
      data: {
        mode: 'recognize',
        steps: 1,
        graphic: graphic,
        expectedShape: shownShape,
        shapeName: shapeMeta.meta.name
      }
    };
  }
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
    var faces = 6, edges = 12, vertices = 8;
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
    var side = Rng.randInt(rng, 5, 20);
    prompt = name + '：一个图形的边长为' + side + '厘米，求它的面积是多少？';
    answer = { value: String(side * side), acceptable: [] };
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

function createShapeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:shape';
  var subject = spec.subject || 'math';
  var mode = spec.mode || 'recognition'; // recognition | classification | naming | feature | count

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
        var graphic = generateGraphicParams(shapeMeta.subtype, plan.difficulty, rng);

        var q;
        var qt = plan.questionTypeId;
        if (qt === 'choice') {
          if (rng() < 0.5) q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
          else q = makeClassificationQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'judge') {
          q = makeFeatureQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'fill') {
          if (rng() < 0.6) q = makeNamingQuestion(plan, context, i, shapeMeta, graphic);
          else q = makeCountQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'geometry') {
          q = makeGeometryQuestion(plan, context, i, shapeMeta, graphic, kpName);
        } else if (qt === 'recognize') {
          q = makeRecognizeQuestion(plan, context, i, shapeMeta, graphic, kpName);
        } else if (qt === 'apply') {
          // geometry 应用题（面积/周长/体积等）
          q = makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic, kpName);
        } else if (qt === 'calc') {
          // P25-08：几何度量计算（周长/面积/表面积/体积/圆周长/圆面积）—— 题干内嵌算式
          q = makeCalcMeasurementQuestion(plan, context, i, kpName);
        } else {
          q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

// P25-06 H2：原 SHAPE_KPS（105 条 math-gN-mN-* 模块制 / math-gN-cN-* 竞赛制 legacy ID）
// 已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS（shape-recognition 记录的 canonical 列表）。
function buildAll() {
  return [
    createShapeGenerator({
      id: 'generator:shape-recognition',
      mode: 'recognition'
    })
  ];
}

module.exports = {
  SHAPE_SUBTYPE: SHAPE_SUBTYPE,
  SHAPE_FEATURES: SHAPE_FEATURES,
  createShapeGenerator: createShapeGenerator,
  buildAll: buildAll
};