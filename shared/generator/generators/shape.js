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
var KP = require('../../knowledge/knowledge-point.js');

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
  'cylinder': 'cylinder',
  'cone': 'cone',
  'sphere': 'sphere',
  // 平面图形
  'flat': 'rectangle',
  'square': 'square',
  'triangle': 'triangle',
  'circle': 'circle',
  'parallelogram': 'parallelogram',
  'trapezoid': 'trapezoid',
  // 复合/识别
  'match-shape': 'rectangle',
  'count-graph': 'rectangle',
  'draw-shape': 'rectangle',
  'shape-combine': 'rectangle'
};

// 图形特征提示词（用于 choice/judge 的提示文本）
var SHAPE_FEATURES = {
  'solid': { name: '立体图形', features: ['有长宽高', '占据空间', '有体积'], examples: ['长方体', '正方体', '圆柱', '圆锥', '球'] },
  'cube': { name: '正方体', features: ['6个面都是正方形', '棱长相等', '12条棱', '8个顶点'], examples: ['魔方', '骰子'] },
  'cylinder': { name: '圆柱', features: ['2个圆形底面', '1个侧面', '侧面展开是长方形'], examples: ['铅笔', '水桶'] },
  'cone': { name: '圆锥', features: ['1个圆形底面', '1个顶点', '侧面展开是扇形'], examples: ['路锥', '帽子'] },
  'sphere': { name: '球', features: ['没有棱和面', '滚动最快', '任意剖面是圆'], examples: ['皮球', '地球仪'] },
  'flat': { name: '平面图形', features: ['只有长和宽', '没有厚度', '在平面上'], examples: ['长方形', '正方形', '三角形', '圆'] },
  'square': { name: '正方形', features: ['4条边相等', '4个角都是直角', '对角线相等且互相垂直平分'], examples: ['手帕', '棋盘格'] },
  'triangle': { name: '三角形', features: ['3条边', '3个角', '内角和180度'], examples: ['三角尺', '屋顶'] },
  'circle': { name: '圆', features: ['没有直线边', '到圆心距离相等', '周长=2πr'], examples: ['硬币', '时钟面'] },
  'parallelogram': { name: '平行四边形', features: ['对边平行且相等', '对角互补'], examples: ['推拉窗'] },
  'trapezoid': { name: '梯形', features: ['一组对边平行', '腰不等长'], examples: ['裙子', '灯罩'] }
};

function getShapeMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
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
  var correct = target;
  var distractors = allShapes.filter(function(s){ return s !== target; }).slice(0, 3);
  if (distractors.length < 3) distractors = distractors.concat(['sphere', 'cone', 'cylinder'].filter(function(d){ return distractors.indexOf(d) === -1 && d !== target; }));
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

function makeGeometryQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // geometry qt：输出带 graphic descriptor 的填充题/判断题
  // 基于 KP 名称构建题干，让学生识别/测量图形
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '几何图形';
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

function makeRecognizeQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  // recognize qt：输出分类/判断题，让学生识别图形类型
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '图形识别';
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

function makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kp = KP.get(pkp(plan)) || {};
  var name = kp.name || '几何应用';
  // 几何 apply 题：面积/周长/体积/对称/变换 等
  var isArea = name.indexOf('面积') !== -1 || name.indexOf('周长') !== -1;
  var isVolume = name.indexOf('圆柱') !== -1 || name.indexOf('圆锥') !== -1 || name.indexOf('体积') !== -1;
  var isCoord = name.indexOf('数对') !== -1 || name.indexOf('坐标') !== -1;
  var isMotion = name.indexOf('旋转') !== -1 || name.indexOf('对称') !== -1;
  var prompt, answer, answerMode;

  if (isArea) {
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
    prompt = name + '：请在方格纸上标出点的位置。';
    answer = { value: '已标注', acceptable: [] };
    answerMode = 'input';
  } else if (isMotion) {
    prompt = name + '：请说明图形变换的三要素。';
    answer = { value: '旋转中心、旋转方向、旋转角度', acceptable: [] };
    answerMode = 'input';
  } else {
    var side = Rng.randInt(rng, 5, 20);
    prompt = name + '：一个图形的边长为' + side + '厘米，请计算相关几何量。';
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

function createShapeGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:shape';
  var subject = spec.subject || 'math';
  var mode = spec.mode || 'recognition'; // recognition | classification | naming | feature | count

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'oral', 'geometry', 'recognize', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));
      var shapeMeta = getShapeMeta(kp);

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
          q = makeGeometryQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'recognize') {
          q = makeRecognizeQuestion(plan, context, i, shapeMeta, graphic);
        } else if (qt === 'apply') {
          // geometry 应用题（面积/周长/体积等）
          q = makeGeometryApplyQuestion(plan, context, i, shapeMeta, graphic);
        } else {
          q = makeRecognitionQuestion(plan, context, i, shapeMeta, graphic);
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

// G1 立体/平面/位置/拼图 绑定
var SHAPE_KPS = [
  'math-g1-m6-solid-shape',
  'math-g1-m6-flat-shape',
  'math-g1-m6-count-graph',
  'math-g1-m6-shape-combine',
  'math-g1-m6-draw-shape',
  'math-g1-m5-match-shape',
  'math-g2-m5-match-shape',
  'math-g2-m6-solid-shape',
  'math-g2-m6-motion',
  'math-g4-m5-g4-match-shape',
  'math-g4-m6-g4-draw-sym',
  'math-g4-m6-g4-draw-move',
  'math-g4-c4-c4-count',
  'math-g4-c4-c4-solid',
  'math-g5-m4-g5-fill-solid',
  'math-g5-m5-g5-match-areaf',
  'math-g5-m5-g5-match-solid',
  'math-g5-m6-g5-draw-rotate',
  'math-g5-m6-g5-draw-sym',
  'math-g5-m6-g5-draw-coord',
  'math-g5-m8-g5-word-solid',
  'math-g5-m11-g5-judge-solid',
  'math-g5-m12-g5-choice-solid',
  'math-g5-m12-motion',
  'math-g5-c4-solid-geometry',
  'math-g6-m5-g6-match-formula',
  'math-g6-m6-g6-op-rotate-scale',
  'math-g6-m6-g6-op-position',
  'math-g6-m10-g6-reason-number-shape',
  'math-g6-c4-area-basic',
  'math-g6-c4-solid-geometry',
  // MATH-07 扩展：geometry qt KPs（原 UNSUPPORTED 40 个）
  'math-g2-m4-angle-basic',
  'math-g2-m5-match-angle',
  'math-g2-m6-angle-recognize',
  'math-g2-m6-grid-draw',
  'math-g2-m6-draw-line',
  'math-g2-m6-draw-angle',
  'math-g2-m6-clock-draw',
  'math-g2-m6-measure',
  'math-g3-m6-g3-perimeter',
  'math-g3-m6-g3-area',
  'math-g4-m4-g4-fill-line',
  'math-g4-m4-g4-fill-angle',
  'math-g4-m4-g4-fill-quad',
  'math-g4-m4-g4-fill-tri',
  'math-g4-m5-g4-match-angle',
  'math-g4-m6-g4-draw-protractor',
  'math-g4-m6-g4-draw-para',
  'math-g4-m6-g4-draw-grid',
  'math-g4-m6-g4-draw-view',
  'math-g4-m11-g4-judge-angle',
  'math-g4-m11-g4-judge-line',
  'math-g4-m11-g4-judge-tri',
  'math-g4-m12-g4-choice-angle',
  'math-g4-m12-g4-choice-shape',
  'math-g4-c3-c3-geomcount',
  'math-g4-c4-c4-angle',
  'math-g4-c4-c4-transform',
  'math-g5-c4-circle-sector',
  'math-g5-c4-angle-calculation',
  'math-g6-m4-g6-fill-circle',
  'math-g6-m6-g6-op-circle',
  'math-g6-m6-g6-op-symmetry',
  'math-g6-m8-g6-app-circle',
  'math-g6-m11-g6-judge-circle',
  'math-g6-m12-g6-choice-circle',
  'math-g6-c3-geometry-counting',
  'math-g6-c4-circle-sector',
  'math-g6-c4-angle-calculation',
  'math-g6-c4-circle-angle',
  'math-g6-c4-solid-geometry',
  // 补齐完整 56 geometry qt KPs
  'math-g3-m6-g3-position',
  'math-g4-c4-c4-pa',
  'math-g6-c4-solid-rotation',
  // MATH-04 扩展：geometry apply qt KPs（被 app-word 泛型接的 32 个）
  'math-g5-m4-g5-fill-coord',
  'math-g5-m4-g5-fill-area',
  'math-g5-m4-g5-fill-rotate',
  'math-g5-m6-g5-draw-observe',
  'math-g5-m6-g5-draw-height',
  'math-g5-m6-g5-draw-net',
  'math-g5-m7-g5-pic-area',
  'math-g5-m8-g5-word-area',
  'math-g5-m11-g5-judge-area',
  'math-g5-m11-motion',
  'math-g5-m12-g5-choice-area',
  'math-g5-c4-area-basic',
  'math-g5-c4-equal-area-transform',
  'math-g5-c4-bird-head-model',
  'math-g5-c4-butterfly-model',
  'math-g5-c4-swallow-tail-model',
  'math-g5-c4-half-model',
  'math-g5-c4-painted-cube',
  'math-g5-c4-pythagorean-theorem',
  'math-g5-c4-lattice-area',
  'math-g6-m4-g6-fill-cylinder-cone',
  'math-g6-m8-g6-app-cyl-cone',
  'math-g6-m11-g6-judge-cyl-cone',
  'math-g6-m12-g6-choice-cyl-cone',
  'math-g6-c4-equal-area-transform',
  'math-g6-c4-bird-head-model',
  'math-g6-c4-butterfly-model',
  'math-g6-c4-swallow-tail-model',
  'math-g6-c4-half-model',
  'math-g6-c4-painted-cube',
  'math-g6-c4-pythagorean-theorem',
  'math-g6-c4-lattice-area'
];

function buildAll() {
  return [
    createShapeGenerator({
      id: 'generator:shape-recognition',
      mode: 'recognition',
      knowledgePoints: SHAPE_KPS
    })
  ];
}

module.exports = {
  SHAPE_SUBTYPE: SHAPE_SUBTYPE,
  SHAPE_FEATURES: SHAPE_FEATURES,
  createShapeGenerator: createShapeGenerator,
  buildAll: buildAll
};