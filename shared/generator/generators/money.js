'use strict';

/**
 * shared/generator/generators/money.js — Money / Measurement Generator
 *
 * 金钱/度量 Generator：基于 KP 语义约束生成人民币、长度、质量、时间题目
 * - 元/角/分、厘米/米/千克/克、小时/分钟/秒 单位换算与应用
 * - factualContent 决定货币面值、度量单位、生活场景
 * - 严禁把"人民币 KP"退化成普通加减
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
  if (context && context.seed != null) return context.seed + ':money:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':money:' + i;
}

// 货币面值（分为单位）
var RMB_DENOMS = [1, 2, 5, 10, 20, 50, 100]; // 分
var RMB_UNITS = { yuan: 100, jiao: 10, fen: 1 };

// 度量单位
var LENGTH_UNITS = [
  { unit: 'cm', base: 1 },
  { unit: 'm', base: 100 },
  { unit: 'km', base: 100000 }
];
var MASS_UNITS = [
  { unit: 'g', base: 1 },
  { unit: 'kg', base: 1000 }
];
var TIME_UNITS = [
  { unit: '秒', base: 1 },
  { unit: '分', base: 60 },
  { unit: '时', base: 3600 }
];

var MEASUREMENT_KINDS = {
  'rmb': { units: ['元', '角', '分'], category: 'money' },
  'length': { units: ['厘米', '米'], category: 'length' },
  'mass': { units: ['克', '千克'], category: 'mass' },
  'time': { units: ['秒', '分', '小时'], category: 'time' },
  'capacity': { units: ['毫升', '升'], category: 'capacity' },
  'area': { units: ['平方厘米', '平方米'], category: 'area' }
};

function getMoneyMeta(kp) {
  // 防护：非 money/measurement KP 被泛型路由到此处时，返回默认 rmb 类型
  if (!kp) return { legacyType: null, category: null, kind: 'rmb' };
  var lt = (kp.source && kp.source.legacyType) || (kp.legacy && kp.legacy.legacyType);
  var cat = kp.legacy ? kp.legacy.category : null;
  
  // 判断度量种类
  var kind = 'rmb';
  if (lt?.includes('length') || cat === 'length') kind = 'length';
  else if (lt?.includes('mass') || cat === 'mass') kind = 'mass';
  else if (lt?.includes('time') || cat === 'time') kind = 'time';
  else if (lt?.includes('area') || cat === 'area') kind = 'area';
  else if (lt?.includes('capacity') || cat === 'capacity') kind = 'capacity';
  
  return { legacyType: lt, category: cat, kind: kind };
}

function randDenom(rng, maxYuan) {
  var maxFen = maxYuan * 100;
  var denoms = RMB_DENOMS.filter(function(d){ return d <= maxFen; });
  return Rng.pick(rng, denoms);
}

function formatRMB(fen) {
  if (fen >= 100 && fen % 100 === 0) return (fen / 100) + '元';
  if (fen >= 10 && fen % 10 === 0) return (fen / 10) + '角';
  return fen + '分';
}

function parseRMB(str) {
  // "3元5角2分" -> 352
  var total = 0;
  var yuanMatch = str.match(/(\d+)元/);
  var jiaoMatch = str.match(/(\d+)角/);
  var fenMatch = str.match(/(\d+)分/);
  if (yuanMatch) total += parseInt(yuanMatch[1]) * 100;
  if (jiaoMatch) total += parseInt(jiaoMatch[1]) * 10;
  if (fenMatch) total += parseInt(fenMatch[1]);
  return total || parseInt(str) * 100; // 纯数字按元处理
}

function makeRMBConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var maxYuan = Math.min(10, 2 + plan.difficulty);
  var amountFen = randDenom(rng, maxYuan);
  var amountStr = formatRMB(amountFen);
  
  // 随机选择目标单位
  var targetUnit = Rng.pick(rng, ['元', '角', '分']);
  var answer, prompt;
  
  if (targetUnit === '元') {
    answer = (amountFen / 100).toFixed(amountFen % 100 === 0 ? 0 : 2).replace(/\.00$/, '');
    prompt = amountStr + ' = ____ 元';
  } else if (targetUnit === '角') {
    answer = String(amountFen / 10);
    prompt = amountStr + ' = ____ 角';
  } else {
    answer = String(amountFen);
    prompt = amountStr + ' = ____ 分';
  }
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      kind: 'rmb',
      operation: 'conversion',
      originalAmount: amountStr,
      targetUnit: targetUnit
    }
  };
}

function makeRMBCalculationQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var maxYuan = Math.min(20, 3 + plan.difficulty);
  var aFen = randDenom(rng, maxYuan);
  var bFen = randDenom(rng, maxYuan);
  
  // 确保减法非负
  var op = Rng.pick(rng, ['add', 'sub']);
  if (op === 'sub' && aFen < bFen) {
    var tmp = aFen; aFen = bFen; bFen = tmp;
  }
  
  var answerFen = op === 'add' ? aFen + bFen : aFen - bFen;
  var aStr = formatRMB(aFen);
  var bStr = formatRMB(bFen);
  var opChar = op === 'add' ? '+' : '−';
  var prompt = aStr + ' ' + opChar + ' ' + bStr + ' = ____';
  var answer = formatRMB(answerFen);
  
  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: 'input',
    data: {
      mode: plan.questionTypeId === 'choice' ? 'choice' : 'fill',
      steps: 1,
      kind: 'rmb',
      operation: op,
      operands: [aFen, bFen]
    }
  };
}

function makeMeasurementConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  var unitInfo = (kind === 'length' ? LENGTH_UNITS : kind === 'mass' ? MASS_UNITS : TIME_UNITS)[0];
  
  var baseValue = Rng.randInt(rng, 1, Math.max(5, plan.difficulty * 2));
  var fromUnit = Rng.pick(rng, LENGTH_UNITS.concat(MASS_UNITS, TIME_UNITS).filter(function(u){ return MEASUREMENT_KINDS[kind]?.units?.includes(u.unit); }));
  var toUnit = Rng.pick(rng, LENGTH_UNITS.concat(MASS_UNITS, TIME_UNITS).filter(function(u){ return MEASUREMENT_KINDS[kind]?.units?.includes(u.unit) && u.unit !== fromUnit.unit; }));
  
  if (!fromUnit || !toUnit) {
    // 兜底回退到人民币
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var answer = baseValue * fromUnit.base / toUnit.base;
  var prompt = baseValue + fromUnit.unit + ' = ____ ' + toUnit.unit;
  
  return {
    knowledgePointId: pkp(plan),
    questionType: 'fill',
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'fill',
      steps: 1,
      kind: kind,
      operation: 'conversion',
      fromUnit: fromUnit.unit,
      toUnit: toUnit.unit
    }
  };
}

function makeWordProblemQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  
  if (kind === 'rmb') {
    var aFen = randDenom(rng, 20);
    var bFen = randDenom(rng, 20);
    if (aFen < bFen) { var tmp = aFen; aFen = bFen; bFen = tmp; }
    var op = Rng.pick(rng, ['buy', 'change', 'total']);
    var aStr = formatRMB(aFen);
    var bStr = formatRMB(bFen);
    
    if (op === 'buy') {
      var prompt = '小明买了一支笔，花了' + aStr + '，又买了一块橡皮，花了' + bStr + '，一共花了多少钱？';
      var answer = formatRMB(aFen + bFen);
    } else if (op === 'change') {
      var prompt = '小红有' + aStr + '，买文具花了' + bStr + '，还剩多少钱？';
      var answer = formatRMB(aFen - bFen);
    } else {
      var prompt = '一本书' + aStr + '，一本笔记本' + bStr + '，买这两样东西一共需要多少钱？';
      var answer = formatRMB(aFen + bFen);
    }
    return {
      knowledgePointId: pkp(plan),
      questionType: 'apply',
      difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1,
      context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: prompt,
      answer: { value: answer, acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'rmb', operation: op === 'change' ? 'sub' : 'add' }
    };
  }
  
  // 兜底
  return makeRMBConversionQuestion(plan, context, i, meta);
}

function makeGraphicForMoney(meta, difficulty) {
  if (meta.kind === 'rmb') {
    return {
      type: 'calculation',
      subtype: 'rmb',
      params: {
        operation: 'money',
        showRMB: true,
        denominations: [1, 5, 10, 20, 50, 100]
      }
    };
  }
  // 其他度量类型使用通用图形
  return {
    type: 'geometry',
    subtype: 'rectangle',
    params: { width: 8, height: 3, labelSides: false, unit: 'cm', unitPx: 30 }
  };
}

function createMoneyGenerator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:money';
  var subject = spec.subject || 'math';

  return {
    id: id,
    subject: subject,
    capabilities: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
    questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc', 'oral'],
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
      var meta = getMoneyMeta(kp);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        
        if (qt === 'fill') {
          if (meta.kind === 'rmb' && rng() < 0.5) q = makeRMBConversionQuestion(plan, context, i, meta);
          else if (meta.kind === 'rmb') q = makeRMBCalculationQuestion(plan, context, i, meta);
          else q = makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'apply') {
          q = makeWordProblemQuestion(plan, context, i, meta);
        } else if (qt === 'choice' || qt === 'judge') {
          q = makeRMBCalculationQuestion(plan, context, i, meta);
        } else {
          q = makeRMBConversionQuestion(plan, context, i, meta);
        }
        
        q.data.graphic = makeGraphicForMoney(meta, plan.difficulty);
        questions.push(q);
      }
      return questions;
    }
  };
}

var RNG_HELPER = null;
function rng() {
  if (!RNG_HELPER) RNG_HELPER = Rng.createSeededRandom('money-seed-' + Date.now());
  return RNG_HELPER();
}

var MONEY_KPS = [
  'math-g1-m4-rmb-unit',
  'math-g1-m4-rmb-calc',
  'math-g1-m5-match-rmb',
  'math-g1-m8-rmb-shopping',
  'math-g2-m4-length-unit',
  'math-g2-m4-mass-unit',
  'math-g2-m4-time-unit',
  'math-g2-m4-fill-length',
  'math-g2-m4-fill-mass',
  'math-g2-m4-fill-time',
  'math-g2-m8-money',
  'math-g3-m4-g3-measure',
  'math-g4-c4-c4-pa'
];

function buildAll() {
  return [
    createMoneyGenerator({
      id: 'generator:money-measurement',
      knowledgePoints: MONEY_KPS
    })
  ];
}

module.exports = {
  RMB_DENOMS: RMB_DENOMS,
  RMB_UNITS: RMB_UNITS,
  MEASUREMENT_KINDS: MEASUREMENT_KINDS,
  createMoneyGenerator: createMoneyGenerator,
  buildAll: buildAll
};