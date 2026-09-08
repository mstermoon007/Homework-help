'use strict';

/**
 * shared/generator/generators/composite.js — P0-07 Step 32 Composite Generators
 *
 * 三个原生 Composite 模式（严格限定，不得扩展）：
 * 1. calc-to-judge   — 计算 → 判断（给算式让判断对错）
 * 2. measure-to-calc — 单位换算 → 运算（如：米换厘米 + 加减法）
 * 3. shape-to-apply  — 图形 → 数量关系（如：立体图形的棱/面/顶点数计算）
 *
 * 共同要求：
 * - supportsComposite = true
 * - combine = true 时，knowledgePointIds.length > 1
 * - 生成单个 SemanticQuestion，同时体现多个 KP 的语义
 */

var Rng = require('../core/rng.js');
var KP = require('../../knowledge-point.js');
var Arith = require('../core/arithmetic-core.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':composite:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':composite:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':composite:' + i;
}

function getKpMeta(kpId) {
  var kp = KP.get(kpId);
  if (!kp) return null;
  var canonical = require('../../knowledge-ontology.js').normalize(kp);
  return {
    id: canonical.id,
    category: canonical.category || kp.legacy?.category,
    legacyType: canonical.source?.legacyType || kp.legacy?.legacyType,
    numericRange: canonical.numeric?.range || null,
    structure: canonical.structure || {},
    factualContent: canonical.factualContent || null,
    graphicType: canonical.graphicType || null
  };
}

/**
 * 模式 1：计算 → 判断
 * 给出算式，让判断对错
 * 适用：加减乘除类 KP + 判断题型
 */
function makeCalcToJudge(plan, context, i, kpMetas, rng) {
  // 随机选择一个 KP 作为算式来源
  var srcKp = rng.pick(kpMetas.filter(function(m) { return m.category === 'algebra'; }));
  if (!srcKp) srcKp = rng.pick(kpMetas);
  
  var arithSem = require('../core/kp-arithmetic-semantics.js').resolveArithmeticSemantics(KP.get(srcKp.id));
  var ops = arithSem ? arithSem.operators : ['+', '−'];
  var op = rng.pick(ops);
  
  var a, b, correct, isTrue;
  if (op === '+') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a + b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '−') {
    a = Rng.randInt(rng, 2, 10);
    b = Rng.randInt(rng, 1, a - 1);
    correct = a - b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '×') {
    a = Rng.randInt(rng, 1, 9);
    b = Rng.randInt(rng, 1, 9);
    correct = a * b;
    isTrue = Rng.randInt(rng, 0, 1);
  } else if (op === '÷') {
    b = Rng.randInt(rng, 2, 9);
    correct = Rng.randInt(rng, 1, 9);
    a = b * correct;
    isTrue = Rng.randInt(rng, 0, 1);
  }
  
  var shown = isTrue ? correct : correct + (Rng.randInt(rng, 0, 1) ? 1 : -1);
  var prompt = a + ' ' + op + ' ' + b + ' = ' + shown + ' （对还是错？）';
  
  return {
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: 'judge',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: isTrue,
    answerMode: 'judge',
    data: {
      mode: 'calc-to-judge',
      steps: 1,
      primaryKp: srcKp.id,
      operation: op,
      operands: [a, b],
      correct: correct,
      shown: shown,
      composite: true
    }
  };
}

/**
 * 模式 2：单位换算 → 运算
 * 如：3米 = 300厘米，300 + 50 = 350厘米
 * 适用：度量类 KP + 计算题型
 */
function makeMeasureToCalc(plan, context, i, kpMetas, rng) {
  var measureKp = rng.pick(kpMetas.filter(function(m) { return m.category === 'measurement'; }));
  var calcKp = rng.pick(kpMetas.filter(function(m) { return m.category === 'algebra'; }));
  
  if (!measureKp || !calcKp) {
    // 兜底：单一 KP 时退化为普通计算
    return makeCalcToJudge(plan, context, i, kpMetas, rng);
  }
  
  // 单位换算：米→厘米，千克→克，小时→分钟
  var units = [
    { from: '米', to: '厘米', factor: 100 },
    { from: '千克', to: '克', factor: 1000 },
    { from: '小时', to: '分钟', factor: 60 },
    { from: '元', to: '角', factor: 10 },
    { from: '角', to: '分', factor: 10 }
  ];
  var unit = rng.pick(units);
  var baseVal = Rng.randInt(rng, 1, 9);
  var converted = baseVal * unit.factor;
  
  var op = rng.pick(['+', '−']);
  var b = Rng.randInt(rng, 1, 20);
  var answer = op === '+' ? converted + b : converted - b;
  
  var prompt = baseVal + unit.from + ' = ' + converted + unit.to + '，' + converted + unit.to + ' ' + op + ' ' + b + unit.to + ' = ____ ' + unit.to;
  
  return {
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: plan.questionTypeId || 'calc',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: 'input',
    data: {
      mode: 'measure-to-calc',
      steps: 2,
      primaryKp: calcKp.id,
      measureKp: measureKp.id,
      operation: op,
      conversion: { from: unit.from, to: unit.to, factor: unit.factor, base: baseVal, converted: converted },
      operand: b,
      composite: true
    }
  };
}

/**
 * 模式 3：图形 → 数量关系
 * 如：长方体有 12 条棱，6 个面，8 个顶点
 * 适用：几何类 KP + 填空/选择/应用题型
 */
function makeShapeToApply(plan, context, i, kpMetas, rng) {
  var shapeKp = rng.pick(kpMetas.filter(function(m) { return m.category === 'geometry'; }));
  if (!shapeKp) shapeKp = rng.pick(kpMetas);
  
  var shapeFeatures = {
    'cube': { name: '正方体', edges: 12, faces: 6, vertices: 8 },
    'cuboid': { name: '长方体', edges: 12, faces: 6, vertices: 8 },
    'cylinder': { name: '圆柱', edges: 2, faces: 3, vertices: 0 },
    'cone': { name: '圆锥', edges: 1, faces: 2, vertices: 1 },
    'sphere': { name: '球', edges: 0, faces: 1, vertices: 0 },
    'rectangle': { name: '长方形', edges: 4, faces: 1, vertices: 4 },
    'square': { name: '正方形', edges: 4, faces: 1, vertices: 4 },
    'triangle': { name: '三角形', edges: 3, faces: 1, vertices: 3 },
    'circle': { name: '圆', edges: 0, faces: 1, vertices: 0 }
  };
  
  var feature = rng.pick(Object.keys(shapeFeatures));
  var meta = shapeFeatures[feature];
  
  var attr = rng.pick(['edges', 'faces', 'vertices']);
  var attrName = { edges: '棱', faces: '面', vertices: '顶点' }[attr];
  var answer = meta[attr];
  
  var prompt = meta.name + '有几个' + attrName + '？';
  
  return {
    knowledgePointIds: kpMetas.map(function(m) { return m.id; }),
    questionType: plan.questionTypeId || 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: String(answer),
    answerMode: 'input',
    data: {
      mode: 'shape-to-apply',
      steps: 1,
      primaryKp: shapeKp.id,
      shapeType: feature,
      targetAttr: attr,
      attrName: attrName,
      composite: true
    }
  };
}

function createCompositeGenerator(spec) {
  spec = spec || {};
  var mode = spec.mode || 'auto'; // auto | calc-to-judge | measure-to-calc | shape-to-apply
  
  return {
    id: spec.id || 'generator:composite',
    subject: spec.subject || 'math',
    capabilities: ['calc', 'judge', 'fill', 'apply'],
    questionTypes: ['calc', 'judge', 'fill', 'apply', 'oral'],
    knowledgePoints: spec.knowledgePoints || [],
    supportsComposite: true,
    
    supports: function (plan) {
      if (!plan || !plan.combine) return false;
      if (!plan.knowledgePointIds || plan.knowledgePointIds.length < 2) return false;
      // 检查是否有至少两个不同类别的 KP
      var kpIds = plan.knowledgePointIds;
      var categories = new Set();
      kpIds.forEach(function(id) {
        var meta = getKpMeta(id);
        if (meta) categories.add(meta.category);
      });
      return categories.size >= 2;
    },
    
    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kpIds = plan.knowledgePointIds || [plan.knowledgePointId];
      var kpMetas = kpIds.map(getKpMeta).filter(Boolean);
      
      if (kpMetas.length < 2) {
        throw new Error('Composite generator 需要至少 2 个不同类别的 KP');
      }
      
      for (var i = 0; i < count; i++) {
        var rng = Rng.createSeededRandom(seedFor(plan, context, i));
        var q;
        
        // 根据模式选择生成策略
        var mode = spec.mode || 'auto';
        if (mode === 'auto') {
          var categories = new Set(kpMetas.map(function(m) { return m.category; }));
          if (categories.has('algebra') && categories.has('geometry')) {
            mode = 'shape-to-apply';
          } else if (categories.has('algebra') && categories.has('measurement')) {
            mode = 'measure-to-calc';
          } else if (categories.has('algebra')) {
            mode = 'calc-to-judge';
          } else {
            mode = 'calc-to-judge';
          }
        }
        
        switch (mode) {
          case 'calc-to-judge':
            q = makeCalcToJudge(plan, context, i, kpMetas, rng);
            break;
          case 'measure-to-calc':
            q = makeMeasureToCalc(plan, context, i, kpMetas, rng);
            break;
          case 'shape-to-apply':
            q = makeShapeToApply(plan, context, i, kpMetas, rng);
            break;
          default:
            q = makeCalcToJudge(plan, context, i, kpMetas, rng);
        }
        
        questions.push(q);
      }
      return questions;
    }
  };
}

var COMPOSITE_KPS = [
  // 计算 + 判断
  'math-g1-m1-addsub-10', 'math-g1-m0-make-ten', 'math-g1-m0-make-ten-cushi', 'math-g1-m1-addsub-5', 'math-g1-m11-judge-mixed',
  // 单位换算 + 运算
  'math-g1-m4-rmb-unit', 'math-g1-m4-rmb-calc', 'math-g1-m8-rmb-shopping',
  'math-g2-m4-length-unit', 'math-g2-m4-mass-unit', 'math-g2-m4-time-unit',
  'math-g2-m8-money', 'math-g3-m4-g3-measure',
  // 图形 + 数量关系
  'math-g1-m6-solid-shape', 'math-g1-m6-flat-shape', 'math-g1-m6-shape-combine',
  'math-g2-m6-solid-shape', 'math-g4-c4-c4-solid', 'math-g5-c4-solid-geometry',
  'math-g6-c4-solid-geometry'
];

function buildAll() {
  return [
    createCompositeGenerator({
      id: 'generator:composite',
      mode: 'auto',
      knowledgePoints: COMPOSITE_KPS
    })
  ];
}

module.exports = {
  COMPOSITE_KPS: COMPOSITE_KPS,
  createCompositeGenerator: createCompositeGenerator,
  buildAll: buildAll
};