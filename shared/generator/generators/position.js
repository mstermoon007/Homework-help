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
  var prompt = '一个图形先' + hWord + '，再' + vWord + '，一共平移了多少格？';
  var answer = Math.abs(dx) + Math.abs(dy);
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i), prompt: prompt + ' ____ 格',
      answer: { value: String(answer), acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '平移' }
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
      answer: { value: String(ci2), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci2, shapeName: '平移' }
    };
  }
  // judge
  var shown = rng() < 0.5 ? answer : answer + (rng() < 0.5 ? 1 : -1);
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i), prompt: prompt + ' 答案是 ' + shown + ' 格——对还是错？',
    answer: { value: shown === answer, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '平移' }
  };
}

function makeRotationQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var angle = Rng.pick(rng, [90, 180, 270]);
  var dir = rng() < 0.5 ? '顺时针' : '逆时针';
  var qt = plan.questionTypeId;
  var prompt = '一个图形绕中心点' + dir + '旋转 ' + angle + ' 度后，方向是否改变？';
  var isTrue = angle === 180 ? true : true;
  if (qt === 'judge') {
    return {
      knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一个图形' + dir + '旋转 ' + angle + ' 度后，形状和大小不变——对还是错？',
      answer: { value: true, acceptable: [] }, answerMode: 'judge',
      data: { mode: 'judge', steps: 1, shapeName: '旋转' }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '钟表指针从 12 走到 3，是' + dir + '旋转了 ____ 度。',
      answer: { value: '90', acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '旋转' }
    };
  }
  // choice
  var opts = Rng.shuffle(rng, ['形状不变', '大小改变', '位置不变', '颜色改变']);
  return {
    knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '图形旋转后，下列哪个说法是正确的？',
    answer: { value: '0', acceptable: [] }, answerMode: 'choice',
    data: { mode: 'choice', steps: 1, options: opts, correctIndex: 0, shapeName: '旋转' }
  };
}

function makeObserveQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var views = ['正面', '上面', '侧面'];
  var correct = Rng.pick(rng, views);
  var qt = plan.questionTypeId;
  if (qt === 'choice') {
    var opts = Rng.shuffle(rng, views.slice());
    var ci = opts.indexOf(correct);
    return {
      knowledgePointId: pkp(plan), questionType: 'choice', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从' + correct + '观察一个正方体，看到的形状是正方形，这是从哪个方向看到的？',
      answer: { value: String(ci), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '观察' }
    };
  }
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '从____观察正方体，看到的是正方形。',
      answer: { value: correct, acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '观察' }
    };
  }
  // judge
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '从不同方向观察同一个物体，看到的形状一定相同——对还是错？',
    answer: { value: false, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '观察' }
  };
}

function makeCoordinateQuestion(plan, context, i) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var x = Rng.randInt(rng, 1, 9);
  var y = Rng.randInt(rng, 1, 9);
  var qt = plan.questionTypeId;
  if (qt === 'fill') {
    return {
      knowledgePointId: pkp(plan), questionType: 'fill', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '在方格图中，点 A 的位置用数对表示是（____，' + y + '），它在第 ' + x + ' 列。',
      answer: { value: String(x), acceptable: [] }, answerMode: 'input',
      data: { mode: 'fill', steps: 1, shapeName: '数对' }
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
      answer: { value: String(ci), acceptable: [] }, answerMode: 'choice',
      data: { mode: 'choice', steps: 1, options: opts, correctIndex: ci, shapeName: '数对' }
    };
  }
  // judge
  return {
    knowledgePointId: pkp(plan), questionType: 'judge', difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: '数对（3，5）表示第 3 行第 5 列——对还是错？',
    answer: { value: false, acceptable: [] }, answerMode: 'judge',
    data: { mode: 'judge', steps: 1, shapeName: '数对' }
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
      // P25-08：从 plan.semanticParams.name 派生空间子类型（方向/平移/旋转/观察/数对）
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var spatialType = deriveSpatialType(kpName);

      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var q;
        var qt = plan.questionTypeId;

        if ((spatialType === 'translation' || spatialType === 'rotation' ||
             spatialType === 'observe' || spatialType === 'coordinate') &&
            (qt === 'geometry' || qt === 'apply')) {
          // P25-08：这些子类型的 maker 仅覆盖 choice/judge/fill；geometry/apply 走场景兜底
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
          var scene = generateScene(rng, plan.difficulty);
          var graphic = makeGraphicForPosition(scene, plan.difficulty);
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
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA.name + '在' + objB.name + '的' + dir + '。请再说出' + objB.name + '在' + objA.name + '的什么方向？',
              answer: { value: dir === '左边' ? '右边' : dir === '右边' ? '左边' : dir === '上面' ? '下面' : dir === '下面' ? '上面' : dir, acceptable: [] },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic, shapeName: '方向' }
            };
          } else {
            q = makeDirectionQuestion(plan, context, i, scene, meta);
            q.data.graphic = graphic;
          }
        }
        // P25-08：translation/rotation/observe/coordinate 子类型的 maker 仅覆盖
        // choice/judge/fill；geometry/apply 请求走兜底，保证 questionType 匹配不被过滤。
        if (!q) {
          var scene2 = generateScene(rng, plan.difficulty);
          var graphic2 = makeGraphicForPosition(scene2, plan.difficulty);
          var objA2 = Rng.pick(rng, scene2.objects);
          var objB2 = Rng.pick(rng, scene2.objects.filter(function(o){ return o !== objA2; })) || scene2.objects[0];
          var dir2 = getRelativeDirection(objA2, objB2, 'self');
          if (qt === 'geometry') {
            q = {
              knowledgePointId: pkp(plan), questionType: 'geometry', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: '观察下图，' + objA2.name + '在' + objB2.name + '的什么方向？',
              answer: { value: dir2, acceptable: [] }, answerMode: 'input',
              data: { mode: 'geometry', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          } else {
            q = {
              knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
              spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
              seed: seedFor(plan, context, i),
              prompt: objA2.name + '在' + objB2.name + '的' + dir2 + '。请说一说' + objB2.name + '在' + objA2.name + '的什么方向？',
              answer: { value: dir2 === '左边' ? '右边' : dir2 === '右边' ? '左边' : dir2 === '上面' ? '下面' : dir2 === '下面' ? '上面' : dir2, acceptable: [] },
              answerMode: 'input',
              data: { mode: 'apply', steps: 1, graphic: graphic2, shapeName: '空间' }
            };
          }
        }
        questions.push(q);
      }
      return questions;
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