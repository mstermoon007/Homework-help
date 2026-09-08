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
var KP = require('../../knowledge-point.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':position:' + i;
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

var SCENE_OBJECTS = ['小猫', '小狗', '小鸟', '花朵', '树', '房子', '球', '书', '椅子', '桌子', '苹果', '书包'];

function getPositionMeta(kp) {
  var lt = kp.source?.legacyType || kp.legacy?.legacyType;
  var cat = kp.legacy?.category;
  return { legacyType: lt, category: cat };
}

function generateScene(rng, difficulty) {
  // 生成场景：网格大小随难度增加
  var gridSize = Math.min(5, 2 + difficulty);
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
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: finalPrompt,
    answer: { value: isTrue, acceptable: [] },
    answerMode: 'judge',
    data: {
      mode: 'judge',
      steps: 1,
      scene: scene,
      targetObj: obj1.name,
      refObj: obj2.name,
      direction: shownDir,
      isTrue: isTrue
    }
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
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: correctDir, acceptable: [] },
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

function makeGraphicForPosition(scene, difficulty) {
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
    params: {
      gridSize: gridSize,
      unitPx: 35,
      objects: objects,
      showGrid: true,
      gridColor: '#e0e0e0'
    }
  };
}

function createPositionGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:position';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['choice', 'judge', 'fill', 'oral'],
    questionTypes: ['choice', 'judge', 'fill', 'oral'],
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
      var meta = getPositionMeta(kp);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var scene = generateScene(rng, plan.difficulty);
        var graphic = makeGraphicForPosition(scene, plan.difficulty);

        var q;
        var qt = plan.questionTypeId;
        if (qt === 'choice') {
          q = makeChoiceDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else if (qt === 'judge') {
          q = makeDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else if (qt === 'fill') {
          q = makeFillDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        } else {
          q = makeDirectionQuestion(plan, context, i, scene, meta);
          q.data.graphic = graphic;
        }
        questions.push(q);
      }
      return questions;
    }
  };
}

var POSITION_KPS = [
  'math-g1-m6-position',
  'math-g3-m6-g3-position',
  'math-g5-m6-g5-draw-coord',
  'math-g6-m6-g6-op-position'
];

function buildAll() {
  return [
    createPositionGenerator({
      id: 'generator:position-direction',
      knowledgePoints: POSITION_KPS
    })
  ];
}

module.exports = {
  DIRECTION_PAIRS: DIRECTION_PAIRS,
  createPositionGenerator: createPositionGenerator,
  buildAll: buildAll
};