'use strict';

/**
 * shared/generator/generators/position.js — Position Generator
 *
 * 位置关系 Generator：基于 KP 语义约束生成空间位置题目
 * - left/right/up/down/front/back 方向关系
 * - graphicType / factualContent 决定场景与视角
 * - 严禁生成无关计算题
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
  if (context && context.seed != null) return context.seed + ':position:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':position:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':position:' + i;
}

// 方向关系词汇
var DIRECTIONS = {
  horizontal: ['左边', '右边', '左侧', '右侧'],
  vertical: ['上面', '下面', '上边', '下边'],
  depth: ['前面', '后面', '前边', '后边'],
  relative: ['左边', '右边', '前面', '后面', '上面', '下面']
};

var DIRECTION_PAIRS = [
  ['左边', '右边'],
  ['上面', '下面'],
  ['前面', '后面']
];

// P34-14：交换观察主体后的相反方向（仅用于方位相对性讲解，取值自上面的方向词表）
var OPPOSITE_DIRECTION = {
  '左边': '右边', '右边': '左边', '左侧': '右侧', '右侧': '左侧',
  '上面': '下面', '下面': '上面', '上边': '下边', '下边': '上边',
  '前面': '后面', '后面': '前面', '前边': '后边', '后边': '前边'
};

var SCENE_OBJECTS = ['小猫', '小狗', '小鸟', '花朵', '树', '房子', '球', '书', '椅子', '桌子', '苹果', '书包'];

function getPositionMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function nrOf(plan) {
  return (plan && plan.constraints && plan.constraints.numberRange) || { min: 1, max: 20 };
}
function riC(rng, lo, hi, nr) {
  var min = Math.max(lo, nr.min);
  var max = Math.min(hi, nr.max);
  if (min > max) { min = lo; max = hi; }
  return Rng.randInt(rng, min, max);
}

function generateScene(rng, nr) {
  // 生成场景：网格大小随 numberRange.max 伸缩（语义地板 2、天花板 5）
  var gridSize = Math.min(5, Math.max(2, nr.max));
  var objCount = Rng.randInt(rng, 3, Math.min(6, gridSize));
  var objects = [];
  var positions = [];
  
  for (var i = 0; i < objCount; i++) {
    var x = Rng.randInt(rng, 0, gridSize - 1);
    var y = Rng.randInt(rng, 0, gridSize - 1);
    // 避免重叠
    var tries = 0;
    while (positions.some(function(p){ return p[0] === x && p[1] === y; }) && tries < 20) {
      x = Rng.randInt(rng, 0, gridSize - 1);
      y = Rng.randInt(rng, 0, gridSize - 1);
      tries++;
    }
    positions.push([x, y]);
    objects.push({
      name: Rng.pick(rng, SCENE_OBJECTS),
      x: x,
      y: y,
      gridSize: gridSize
    });
  }
  return { objects: objects, gridSize: gridSize };
}

function getRelativeDirection(obj1, obj2, perspective) {
  // perspective: 'self' (以obj1为主体) 或 'viewer' (以观察者视角)
  var dx = obj2.x - obj1.x;
  var dy = obj2.y - obj1.y;
  
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? (perspective === 'self' ? '右边' : '左边') : (perspective === 'self' ? '左边' : '右边');
  } else {
    return dy > 0 ? (perspective === 'self' ? '下面' : '上面') : (perspective === 'self' ? '上面' : '下面');
  }
}

function makeDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var perspective = rng() < 0.5 ? 'self' : 'viewer';
  var correctDir = getRelativeDirection(obj1, obj2, perspective);
  var prompt = obj1.name + '在' + obj2.name + '的' + (perspective === 'self' ? '' : '观察者视角') + correctDir + '吗？';
  
  var isTrue = rng() < 0.5;
  var shownDir = isTrue ? correctDir : Rng.pick(rng, ['左边', '右边', '上面', '下面', '前面', '后面'].filter(function(d){ return d !== correctDir; }));
  var finalPrompt = obj1.name + '在' + obj2.name + '的' + shownDir + '—— 对还是错？';
  
  var dirExplanation = isTrue
    ? obj1.name + '确实在' + obj2.name + '的' + shownDir + '，说法正确。'
    : obj1.name + '实际在' + obj2.name + '的' + correctDir + '，不是' + shownDir + '，说法错误。';
  var dirData = {
    mode: 'judge',
    steps: 1,
    scene: scene,
    targetObj: obj1.name,
    refObj: obj2.name,
    direction: shownDir,
    isTrue: isTrue
  };
  if (!isTrue) dirData.misconception = '相对方向辨认错误：以' + obj2.name + '为参照物时，' + obj1.name + '应在' + correctDir + '。';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: finalPrompt,
    answer: { value: isTrue, acceptable: [], explanation: dirExplanation },
    answerMode: 'judge',
    data: dirData
  };
}

function makeChoiceDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var correctDir = getRelativeDirection(obj1, obj2, 'self');
  var distractors = ['左边', '右边', '上面', '下面', '前面', '后面'].filter(function(d){ return d !== correctDir; });
  var options = Rng.shuffle(rng, [correctDir].concat(distractors.slice(0, 3)));
  var correctIndex = options.indexOf(correctDir);
  
  var prompt = obj1.name + '在' + obj2.name + '的哪一边？';
  var choiceExpl = '看图以' + obj2.name + '为参照物，' + obj1.name + '在它的' + correctDir
    + '，正确选项是「' + correctDir + '」。';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'choice',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(correctIndex), acceptable: [], explanation: choiceExpl },
    answerMode: 'choice',
    data: {
      mode: 'choice',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      options: options,
      correctIndex: correctIndex,
      correctDirection: correctDir
    }
  };
}

function makeFillDirectionQuestion(plan, context, i, scene, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var obj1 = Rng.pick(rng, scene.objects);
  var obj2 = Rng.pick(rng, scene.objects.filter(function(o){ return o !== obj1; }));
  if (!obj2) obj2 = { name: Rng.pick(rng, SCENE_OBJECTS), x: Rng.randInt(rng, 0, 4), y: Rng.randInt(rng, 0, 4) };
  
  var correctDir = getRelativeDirection(obj1, obj2, 'self');
  var prompt = obj1.name + '在' + obj2.name + '的____。';
  var fillExpl = '看图以' + obj2.name + '为参照物，' + obj1.name + '在它的' + correctDir + '。';

  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: correctDir, acceptable: [], explanation: fillExpl },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      correctDirection: correctDir
    }
  };
}

function makeGraphicForPosition(scene) {
  // 生成 SVG 几何场景：网格 + 物体位置
  // 这里用 geometry.grid 子类型（需要在 svg-geometry 支持或自定义）
  // 简化：用 geometry.rectangle 画网格背景，params 里带 objects 信息供前端渲染
  var gridSize = scene.gridSize;
  var unitPx = 40;
  var objects = scene.objects.map(function(o) {
    return {
      name: o.name,
      x: o.x,
      y: o.y,
      gridSize: gridSize
    };
  });
  
  return {
    type: 'geometry',
    subtype: 'position-grid',
    role: 'number-position',
    params: {
      gridSize: gridSize,
      unitPx: 35,
      objects: objects,
      showGrid: true,
      gridColor: '#e0e0e0'
    }
  };
}

// P38 断链修复闸门：意图驱动——仅当该 (KP, 题型) 行 intent.graphicRole 非空
// （plan.semanticParams.graphic 为 P30-10 权威行投影）时挂图；意图无图的行零改动。
function intentWantsGraphic(plan) {
  return !!(plan && plan.semanticParams && plan.semanticParams.graphic &&
    plan.semanticParams.graphic.role != null);
}

// P38 断链修复：平移/旋转/观察/数对四族描述符构造（role 统一 number-position）。
// 图形只画题设材料（位移/旋转演示、正方体实物、数对标点），不含所求数值，不反推题目。
function translationGraphic(dx, dy) {
  return {
    type: 'geometry', subtype: 'translationDemo', role: 'number-position',
    // P42-033：unitPx 30→35 与证据规则（T2 evidence-rules 平移族冻结值 35）对齐；
    // 30 为质量单位族 rectangle 图形专属冻结值，translationDemo 无 30 冻结行，零外溢。
    params: { points: [[0, 0], [1.5, 0], [1.5, 1], [0, 1]], dx: dx, dy: dy, unitPx: 35 }
  };
}
function rotationGraphic(angle, dir) {
  return {
    type: 'geometry', subtype: 'rotationDemo', role: 'number-position',
    params: { points: [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]], cx: 0, cy: 0,
      deg: dir === '顺时针' ? -angle : angle, unitPx: 35 }
  };
}
function clockHandGraphic(deg) {
  // 钟面指针 12 → 3（顺时针 90°，deg 取负与 SVG y 向下一致）。
  // P42-033：可选 deg 供旋转 geometry/apply 分支按方向传值；缺省 -90 零变化。
  return {
    type: 'geometry', subtype: 'rotationDemo', role: 'number-position',
    params: { points: [[0, 0], [0.16, -2.8], [-0.16, -2.8]], cx: 0, cy: 0, deg: deg === undefined ? -90 : deg, unitPx: 35 }
  };
}
function observeCubeGraphic() {
  return { type: 'geometry', subtype: 'cube', role: 'number-position',
    params: { edge: 2, labelSides: false, unit: 'cm' } };
}
function coordGridGraphic(col, row) {
  var gs = Math.max(col, row, 5);
  return {
    type: 'geometry', subtype: 'position-grid', role: 'number-position',
    params: { gridSize: gs, unitPx: gs > 6 ? 28 : 35,
      objects: [{ name: 'A', x: col - 1, y: row - 1 }], showGrid: true }
  };
}

// P25-08：由 KP 名称派生空间关系子类型
var NAME_TO_SPATIAL = [
  { re: /数对|坐标/, type: 'coordinate' },
  { re: /距离/, type: 'distance' },
  { re: /路线|行走/, type: 'route' },
  { re: /平移/, type: 'translation' },
  { re: /旋转/, type: 'rotation' },
  { re: /对称/, type: 'symmetry' },
  { re: /观察/, type: 'observe' },
  { re: /方向|位置|空间/, type: 'direction' }
];

function deriveSpatialType(name) {
  if (!name || typeof name !== 'string') return 'direction';
  for (var i = 0; i < NAME_TO_SPATIAL.length; i++) {
    if (NAME_TO_SPATIAL[i].re.test(name)) return NAME_TO_SPATIAL[i].type;
  }
  return 'direction';
}

function makeTranslationQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var dx = Rng.pick(rng, [-3, -2, -1, 1, 2, 3]);
  var dy = Rng.pick(rng, [-3, -2, -1, 1, 2, 3]);
  var qt = plan.questionTypeId;
  var hWord = dx > 0 ? '向右' + dx + '格' : '向左' + (-dx) + '格';
  var vWord = dy > 0 ? '向下' + dy + '格' : '向上' + (-dy) + '格';
  var answer = Math.abs(dx) + Math.abs(dy);
  // judge 的 shown 须在构造 prompt 前确定（judge 题面内嵌 shown）
  var shown = rng() < 0.5 ? answer : answer + (rng() < 0.5 ? 1 : -1);
  var hDir = dx > 0 ? '右' : '左';
  var vDir = dy > 0 ? '下' : '上';
  var transGraphic = intentWantsGraphic(plan) ? translationGraphic(dx, dy) : null;
  // P30-GEN-06（P30-16）：fill/choice/judge 不得共享「一个图形先…再…一共平移了多少格」骨架，
  // 按题型换引导词与问法打散共享 3-gram。
  var prompt;
  if (qt === 'fill') {
    prompt = '图形先向' + hDir + '平移 ' + Math.abs(dx) + ' 格，再向' + vDir + '平移 ' + Math.abs(dy)
      + ' 格，总共移动 ____ 格。';
  } else if (qt === 'choice') {
    prompt = '一个图形先' + hWord + '，再' + vWord + '，一共平移了多少格？';
  } else {
    prompt = '一个图形先' + hWord + '、再' + vWord + '，共平移 ' + shown + ' 格，对还是错？';
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: prompt,
      answer: { value: String(answer), acceptable: [],
        explanation: '平移分两次移动，总格数是两次格数之和：' + Math.abs(dx) + '＋' + Math.abs(dy)
          + '＝' + answer + ' 格。' }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '平移', graphic: transGraphic }
    };
  }
  if (qt === 'choice') {
    var distractorSet = new Set();
    distractorSet.add(String(answer));
    var candList = [answer + 1, answer - 1, answer + 2, Math.abs(dx), Math.abs(dy), answer + 3];
    var distractors = [];
    for (var ci = 0; ci < candList.length && distractors.length < 3; ci++) {
      var cv = String(candList[ci]);
      if (!distractorSet.has(cv) && candList[ci] > 0) { distractorSet.add(cv); distractors.push(cv); }
    }
    while (distractors.length < 3) { distractors.push(String(answer + distractors.length + 4)); }
    var opts = Rng.shuffle(rng, [String(answer)].concat(distractors)).slice(0, 4);
    var ci2 = opts.indexOf(String(answer));
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: prompt,
      answer: { value: String(ci2), acceptable: [],
        explanation: '总格数是两次平移格数之和：' + Math.abs(dx) + '＋' + Math.abs(dy)
          + '＝' + answer + ' 格，正确选项是「' + answer + '」。' }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci2, shapeName: '平移', graphic: transGraphic }
    };
  }
  // P42-033：平移 geometry/apply 此前被 spatialType bypass 成「观察下图，X在Y的什么方向」
  // 跨 KP 方向兜底题（面审计 P2 差分不回指）。收窄 bypass 后按本 KP 平移语义直出：
  // geometry 看图数单向平移格数（图形 translationGraphic(dx,0) 承载位移演示，不印答案）；
  // apply 棋子两步移动求总格数。检索 token（平移）在题面与解析同时在场；
  // fill/choice/judge 分支零变化。
  if (qt === 'geometry') {
    return {
      knowledgePointId: pkp(plan), questionType: 'geometry', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '看图：方格纸上的图形向' + hDir + '平移后到了新位置。图形平移了 ____ 格。',
      answer: { value: String(Math.abs(dx)), acceptable: [],
        explanation: '平移不改变图形的形状和大小，对应点移动的距离相同：从图上数得图形向'
          + hDir + '平移了 ' + Math.abs(dx) + ' 格。' }, answerMode: 'input',
      data: { mode: 'geometry', steps: 1, shapeName: '平移', graphic: intentWantsGraphic(plan) ? translationGraphic(dx, 0) : null }
    };
  }
  if (qt === 'apply') {
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '棋盘游戏：一枚棋子先向' + hDir + '平移 ' + Math.abs(dx) + ' 格，再向' + vDir
        + '平移 ' + Math.abs(dy) + ' 格。棋子一共平移了多少格？',
      answer: { value: String(answer), acceptable: [],
        explanation: '分两步平移，总格数是两次格数之和：' + Math.abs(dx) + '＋' + Math.abs(dy)
          + '＝' + answer + ' 格。' }, answerMode: 'input',
      data: { mode: 'apply', steps: 1, shapeName: '平移', graphic: transGraphic }
    };
  }
  // judge
  var transIsTrue = shown === answer;
  var transData = { mode: 'judge', steps: 1, shapeName: '平移', shownResult: String(shown), graphic: transGraphic };
  var transExplanation = transIsTrue
    ? '图形平移了 ' + answer + ' 格，题中答案正确。'
    : '图形平移的格数应是 ' + answer + ' 格，不是 ' + shown + ' 格，说法错误。'; // P42-7：补结论词（④′判据）
  if (!transIsTrue) {
    transData.misconception = '平移格数数错：' + (shown > answer ? '多数' : '少数') +
      '了 1 格，正确应为 ' + answer + ' 格。';
  }
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i), prompt: prompt,
    answer: { value: transIsTrue, acceptable: [], explanation: transExplanation }, answerMode: 'judge',
    data: transData
  };
}

function makeRotationQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var angle = Rng.pick(rng, [90, 180, 270]);
  var dir = rng() < 0.5 ? '顺时针' : '逆时针';
  var qt = plan.questionTypeId;
  var wantsG = intentWantsGraphic(plan);
  var prompt = '一个图形绕中心点' + dir + '旋转 ' + angle + ' 度后，方向是否改变？';
  var isTrue = angle === 180 ? true : true;
  if (qt === 'judge') {
    return {
      knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一个图形' + dir + '旋转 ' + angle + ' 度后，形状和大小不变——对还是错？',
      answer: { value: true, acceptable: [], explanation: '旋转只改变图形的位置和方向，不改变图形的形状和大小，说法正确。' }, answerMode: 'judge',
      data: { mode: 'judge', steps: 1, shapeName: '旋转', graphic: wantsG ? rotationGraphic(angle, dir) : null }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '钟表指针从 12 走到 3，是' + dir + '旋转了 ____ 度。',
      answer: { value: '90', acceptable: [],
        explanation: '钟面上指针从 12 走到 3 转过一个直角，直角是 90 度，与顺时针还是逆时针无关。' },
      answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '旋转', graphic: wantsG ? clockHandGraphic() : null }
    };
  }
  // P42-033：旋转 geometry/apply 此前被 bypass 成方向兜底题。按本 KP 旋转语义直出：
  // 钟面指针从 12 绕中心旋转 angle 度求指向数字（每大格 30 度；deg 取负与 SVG y 向下
  // 一致）。检索 token（旋转）在题面与解析同时在场；judge/fill/choice 分支零变化。
  if (qt === 'geometry' || qt === 'apply') {
    var rotDeg = dir === '顺时针' ? -angle : angle;
    var rotPos = (dir === '顺时针' ? ['12', '3', '6', '9'] : ['12', '9', '6', '3'])[(angle / 90) % 4];
    var rotPrompt = qt === 'geometry'
      ? '看图：钟面上一根指针从数字 12 开始，绕中心' + dir + '旋转 ' + angle + ' 度。指针指向数字 ____。'
      : '钟面上，分针从数字 12 开始，绕中心' + dir + '旋转 ' + angle + ' 度。分针指向数字 ____。';
    return {
      knowledgePointId: pkp(plan), questionType: qt, difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: rotPrompt,
      answer: { value: rotPos, acceptable: [],
        explanation: '钟面被 12 个数字平均分成 12 大格，每大格 30 度。指针绕中心' + dir + '旋转 '
          + angle + ' 度，转过 ' + (angle / 30) + ' 大格，从 12 指向数字 ' + rotPos + '。' },
      answerMode: 'input',
      data: { mode: qt, steps: 1, shapeName: '旋转', graphic: wantsG ? clockHandGraphic(rotDeg) : null }
    };
  }
  // choice
  var opts = Rng.shuffle(rng, ['形状不变', '大小改变', '位置不变', '颜色改变']);
  return {
    knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '图形旋转后，下列哪个说法是正确的？',
    answer: { value: '0', acceptable: [],
      explanation: '旋转只改变图形的位置和方向，不改变形状和大小，所以正确说法是「形状不变」。' },
    answerMode: 'choice',
    data: { mode: 'choice', steps: 1, options: opts, correctIndex: 0, shapeName: '旋转', graphic: wantsG ? rotationGraphic(angle, dir) : null }
  };
}

function makeObserveQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var views = ['正面', '上面', '侧面'];
  var correct = Rng.pick(rng, views);
  var qt = plan.questionTypeId;
  var obsGraphic = intentWantsGraphic(plan) ? observeCubeGraphic() : null;
  if (qt === 'choice') {
    var opts = Rng.shuffle(rng, views.slice());
    var ci = opts.indexOf(correct);
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从' + correct + '观察一个正方体，看到的形状是正方形，这是从哪个方向看到的？',
      answer: { value: String(ci), acceptable: [],
        explanation: '正方体每个面都是正方形；题中描述的是从' + correct + '看到的，正确选项是「'
          + correct + '」。' }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '观察', graphic: obsGraphic }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从____观察正方体，看到的是正方形。',
      answer: { value: correct, acceptable: [],
        explanation: '正方体的每个面都是正方形，从' + correct + '观察看到的就是正方形。' },
      answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '观察', graphic: obsGraphic }
    };
  }
  // judge
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '从不同方向观察同一个物体，看到的形状一定相同——对还是错？',
    answer: { value: false, acceptable: [], explanation: '从正面、上面、侧面等不同方向观察同一物体，看到的形状可能不同，说法错误。' }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '观察', graphic: obsGraphic, misconception: '误认为从不同方向观察同一物体，看到的形状一定相同。' }
  };
}

function makeCoordinateQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var nr = nrOf(plan);
  var x = riC(rng, 1, 9, nr);
  var y = riC(rng, 1, 9, nr);
  var qt = plan.questionTypeId;
  var wantsG = intentWantsGraphic(plan);
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      // P32-AS-16：原句「（____，y），它在第 x 列」在叙述中直接给出所求列数 x。
      // 改为给完整数对 + 列/行规则，由学生把第一个数解读为列（逆方向考查数对意义）。
      prompt: '在方格图中，点 A 的位置用数对（' + x + '，' + y + '）表示（数对中第一个数表示列），点 A 在第 ____ 列。',
      answer: { value: String(x), acceptable: [],
        explanation: '数对中第一个数表示列，（' + x + '，' + y + '）的第一个数是 ' + x
          + '，所以点 A 在第 ' + x + ' 列。' }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '数对', graphic: wantsG ? coordGridGraphic(x, y) : null }
    };
  }
  if (qt === 'choice') {
    var correct = '(' + x + ',' + y + ')';
    var candCoords = ['(' + y + ',' + x + ')', '(' + (x + 1) + ',' + y + ')', '(' + x + ',' + (y + 1) + ')', '(' + (x + 1) + ',' + (y + 1) + ')'];
    var coordSet = new Set([correct]);
    var coordDistractors = [];
    for (var cdi = 0; cdi < candCoords.length && coordDistractors.length < 3; cdi++) {
      if (!coordSet.has(candCoords[cdi])) { coordSet.add(candCoords[cdi]); coordDistractors.push(candCoords[cdi]); }
    }
    var opts = Rng.shuffle(rng, [correct].concat(coordDistractors)).slice(0, 4);
    var ci = opts.indexOf(correct);
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '点 A 在第 ' + x + ' 列第 ' + y + ' 行，用数对表示是？',
      answer: { value: String(ci), acceptable: [],
        explanation: '数对第一个数表示列、第二个数表示行，第 ' + x + ' 列第 ' + y
          + ' 行用 ' + correct + ' 表示，正确选项是「' + correct + '」。' }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '数对', graphic: wantsG ? coordGridGraphic(x, y) : null }
    };
  }
  // judge
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '数对（3，5）表示第 3 行第 5 列——对还是错？',
    answer: { value: false, acceptable: [], explanation: '数对中第一个数表示列、第二个数表示行，（3，5）表示第 3 列第 5 行，说法错误。' }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '数对', graphic: wantsG ? coordGridGraphic(3, 5) : null, misconception: '数对的列、行顺序混淆：数对（3，5）表示第 3 列第 5 行，不是第 3 行第 5 列。' }
  };
}

function createPositionGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:position';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    questionTypes: ['choice', 'judge', 'fill', 'geometry', 'apply'],
    knowledgePoints: spec.knowledgePoints || [],

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var nr = nrOf(plan);
      // P25-08：从 plan.semanticParams.name 派生空间子类型（方向/平移/旋转/观察/数对）
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var spatialType = deriveSpatialType(kpName);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var q;
        var qt = plan.questionTypeId;

        if ((spatialType === 'observe' || spatialType === 'coordinate') &&
            (qt === 'geometry' || qt === 'apply')) {
          // P42-033：仅观察/数对子类型的 maker 仍不覆盖 geometry/apply，保留场景兜底；
          // 平移/旋转子类型已补 geometry/apply 分支（含「平移」「旋转」语义 token），
          // 不再兜底成无关方向题（跨 KP 错挂家族根因修复）。
          q = null;
        } else if (spatialType === 'translation') {
          q = makeTranslationQuestion(plan, context, i);
        } else if (spatialType === 'rotation') {
          q = makeRotationQuestion(plan, context, i);
        } else if (spatialType === 'observe') {
          q = makeObserveQuestion(plan, context, i);
        } else if (spatialType === 'coordinate') {
          q = makeCoordinateQuestion(plan, context, i);
        } else {
          var scene = generateScene(rng, nr);
          var graphic = makeGraphicForPosition(scene);
          var meta = { legacyType: null, category: null };
          if (qt === 'choice') {
            q = makeChoiceDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'judge') {
            q = makeDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'fill') {
            q = makeFillDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          } else if (qt === 'geometry') {
            // P25-08：geometry 题型输出带 graphic 的方向识别题
            q = makeFillDirectionQuestion(plan, context, i, scene, meta);
            q.questionType = 'geometry';
            q.data.graphic = graphic;
          } else if (qt === 'apply') {
            // P25-08：apply 题型输出方向应用情境题
            var objA = Rng.pick(rng, scene.objects);
            var objB = Rng.pick(rng, scene.objects.filter(function(o){ return o !== objA; })) || scene.objects[0];
            var dir = getRelativeDirection(objA, objB, 'self');
            var revDir = OPPOSITE_DIRECTION[dir] || dir;
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA.name + '在' + objB.name + '的' + dir + '。请再说出' + objB.name + '在' + objA.name + '的什么方向？',
              answer: { value: revDir, acceptable: [],
                explanation: '两个物体的位置关系是相对的：' + objA.name + '在' + objB.name + '的' + dir
                  + '，交换观察主体后方向相反，所以' + objB.name + '在' + objA.name + '的' + revDir + '。' },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic, shapeName: '方向' }
            };
          } else {
            q = makeDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          }
        }
        // P42-033：observe/coordinate 子类型的 maker 仅覆盖 choice/judge/fill，
        // geometry/apply 请求走兜底，保证 questionType 匹配不被过滤；
        // translation/rotation 已补 geometry/apply 分支，不再走兜底。
        if (!q) {
          var scene2 = generateScene(rng, nr);
          var graphic2 = makeGraphicForPosition(scene2);
          var objA2 = Rng.pick(rng, scene2.objects);
          var objB2 = Rng.pick(rng, scene2.objects.filter(function(o){ return o !== objA2; })) || scene2.objects[0];
          var dir2 = getRelativeDirection(objA2, objB2, 'self');
          var revDir2 = OPPOSITE_DIRECTION[dir2] || dir2;
          if (qt === 'geometry') {
            q = {
              knowledgePointId: pkp(plan), questionType: 'geometry', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: '观察下图，' + objA2.name + '在' + objB2.name + '的什么方向？',
              answer: { value: dir2, acceptable: [],
                explanation: '看图以' + objB2.name + '为参照物，' + objA2.name + '在它的' + dir2 + '。' },
              answerMode: 'input',
              data: { mode: 'geometry', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          } else {
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA2.name + '在' + objB2.name + '的' + dir2 + '。请说一说' + objB2.name + '在' + objA2.name + '的什么方向？',
              answer: { value: revDir2, acceptable: [],
                explanation: '两个物体的位置关系是相对的：' + objA2.name + '在' + objB2.name + '的' + dir2
                  + '，交换观察主体后方向相反，所以' + objB2.name + '在' + objA2.name + '的' + revDir2 + '。' },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          }
        }
        questions.push(q);
      }
      return SemanticEvidence.attachAll(VariationApply.applyToAll(questions, plan), plan);
    }
  };
}

// P25-06 H2：原 POSITION_KPS（math-gN-m6-* 模块制 历史 ID）已随旧体系 KP 全部剔除，
// 对 canonical 375 永不命中；绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function buildAll() {
  return [createPositionGenerator({ id: 'generator:position-direction' })];
}

module.exports = {
  DIRECTION_PAIRS: DIRECTION_PAIRS,
  createPositionGenerator: createPositionGenerator,
  buildAll: buildAll
};