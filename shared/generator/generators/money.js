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
var Arith = require('../core/arithmetic-core.js');
var OpSem = require('../core/op-semantics.js');

function pkp(plan) {
  if (!plan) return null;
  if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds[0]) return plan.knowledgePointIds[0];
  if (typeof plan.knowledgePointId === 'string' && plan.knowledgePointId) return plan.knowledgePointId;
  return null;
}

function seedFor(plan, context, i) {
  if (context && context.seed != null) return context.seed + ':money:' + i;
  // C2：契约层已按本代 baseSeed 派生 per-item seed（plan.seed）；无 context 时必须采用，
  // 否则退化为 KP|题型|难度|题量 的确定性种子，导致「重新生成」题目完全不变。
  if (plan && plan.seed != null) return plan.seed + ':money:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':money:' + i;
}

// 货币面值（分为单位）
var RMB_DENOMS = [1, 2, 5, 10, 20, 50, 100]; // 分
var RMB_UNITS = { yuan: 100, jiao: 10, fen: 1 };

// 度量单位（P25-08：单位名与 MEASUREMENT_KINDS 对齐，否则换算题恒回退 RMB）
var LENGTH_UNITS = [
  { unit: '毫米', base: 1 },
  { unit: '厘米', base: 10 },
  { unit: '米', base: 1000 },
  { unit: '千米', base: 1000000 }
];
var MASS_UNITS = [
  { unit: '克', base: 1 },
  { unit: '千克', base: 1000 },
  { unit: '吨', base: 1000000 }
];
var TIME_UNITS = [
  { unit: '秒', base: 1 },
  { unit: '分', base: 60 },
  { unit: '小时', base: 3600 }
];

var MEASUREMENT_KINDS = {
  'rmb': { units: ['元', '角', '分'], category: 'money' },
  'length': { units: ['毫米', '厘米', '米', '千米'], category: 'length' },
  'mass': { units: ['克', '千克', '吨'], category: 'mass' },
  'time': { units: ['秒', '分', '小时'], category: 'time' },
  'capacity': { units: ['毫升', '升'], category: 'capacity' },
  'area': { units: ['平方厘米', '平方分米', '平方米'], category: 'area' }
};

// 面积单位（独立，因进率与长度不同）
var AREA_UNITS = [
  { unit: '平方厘米', base: 1 },
  { unit: '平方分米', base: 100 },
  { unit: '平方米', base: 10000 }
];
var CAPACITY_UNITS = [
  { unit: '毫升', base: 1 },
  { unit: '升', base: 1000 }
];

// P25-08：由 KP 名称机械派生度量种类（替代 kp={} 恒 rmb 的语义偏移）
// P25-09：补「称重/秤」（g3-up-u04-k004 称重实践）；名称无信号时允许用 concept 文本二次派生
//（g3-up-u04-k003 单位适用场景，concept 明确列举克/千克/吨的适用物品）。
var NAME_TO_MEASURE = [
  { re: /人民币|元.*角|角.*分|购物|钱/, kind: 'rmb' },
  { re: /面积/, kind: 'area' },
  { re: /容积|升|毫升/, kind: 'capacity' },
  { re: /质量|千克|克|吨|称重|秤/, kind: 'mass' },
  { re: /时间|时.*分|分.*秒|小时/, kind: 'time' },
  { re: /厘米|米|长度|线段|进率/, kind: 'length' }
];

function deriveMeasureKind(name) {
  if (!name || typeof name !== 'string') return null;
  for (var i = 0; i < NAME_TO_MEASURE.length; i++) {
    if (NAME_TO_MEASURE[i].re.test(name)) return NAME_TO_MEASURE[i].kind;
  }
  return null;
}

function getMoneyMeta(kp, name, concept) {
  // P25-08：优先由 plan.semanticParams.name 派生度量种类；
  // P25-09：名称无信号时用 concept 文本兜底（仅 money 已绑定的度量 KP，误派面可控）；
  // 再回退 legacyType/category；最终 rmb。
  var kind = deriveMeasureKind(name)
    || deriveMeasureKind(concept)
    || (kp && ((kp.source && kp.source.legacyType) || (kp.legacy && kp.legacy.legacyType)))
    || (kp && kp.legacy && kp.legacy.category)
    || 'rmb';
  // normalize kind token
  if (typeof kind === 'string') {
    if (kind.indexOf('length') !== -1 || kind.indexOf('厘米') !== -1 || kind.indexOf('米') !== -1) kind = 'length';
    else if (kind.indexOf('mass') !== -1 || kind.indexOf('克') !== -1 || kind.indexOf('千克') !== -1) kind = 'mass';
    else if (kind.indexOf('time') !== -1 || kind.indexOf('时') !== -1 || kind.indexOf('分') !== -1) kind = 'time';
    else if (kind.indexOf('area') !== -1 || kind.indexOf('面积') !== -1) kind = 'area';
    else if (kind.indexOf('capacity') !== -1 || kind.indexOf('升') !== -1) kind = 'capacity';
    else kind = 'rmb';
  }
  var lt = (kp && kp.source && kp.source.legacyType) || (kp && kp.legacy && kp.legacy.legacyType);
  var cat = kp && kp.legacy && kp.legacy.category;
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
  var opChar = OpSem.symbol(op) || '−';
  var prompt = aStr + ' ' + opChar + ' ' + bStr + ' = ____';
  var answer = formatRMB(answerFen);
  var qt = plan.questionTypeId;
  var result = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: answer, acceptable: [] },
    answerMode: qt === 'choice' ? 'choice' : 'input',
    data: {
      mode: qt === 'choice' ? 'choice' : 'fill',
      steps: 1,
      kind: 'rmb',
      operation: op,
      operands: [aFen, bFen]
    }
  };
  // P25-08：choice 必须提供选项（答案带单位如「105分」，finisher 数值选项构建无法解析）
  if (qt === 'choice') {
    var distractors = [];
    var deltaSet = [1, 5, 10, 50, 100];
    while (distractors.length < 3) {
      var d = answerFen + Rng.pick(rng, deltaSet) * (rng() < 0.5 ? 1 : -1);
      if (d <= 0) d = answerFen + Rng.pick(rng, deltaSet);
      var dStr = formatRMB(d);
      if (dStr !== answer && distractors.indexOf(dStr) === -1) distractors.push(dStr);
    }
    result.data.options = Rng.shuffle(rng, [answer].concat(distractors).slice(0, 4));
    result.data.correctIndex = result.data.options.indexOf(answer);
    result.answer = { value: String(result.data.correctIndex), acceptable: [] };
  }
  return result;
}

function makeMeasurementConversionQuestion(plan, context, i, meta) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var kind = meta.kind;
  var table = kind === 'area' ? AREA_UNITS
    : kind === 'capacity' ? CAPACITY_UNITS
    : kind === 'mass' ? MASS_UNITS
    : kind === 'time' ? TIME_UNITS
    : LENGTH_UNITS;
  var units = table.filter(function(u){
    return MEASUREMENT_KINDS[kind] && MEASUREMENT_KINDS[kind].units && MEASUREMENT_KINDS[kind].units.indexOf(u.unit) !== -1;
  });
  
  if (units.length < 2) {
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var baseValue = Rng.randInt(rng, 1, Math.max(5, plan.difficulty * 2));
  var fromUnit = Rng.pick(rng, units);
  var toUnit = Rng.pick(rng, units.filter(function(u){ return u.unit !== fromUnit.unit; }));
  
  if (!fromUnit || !toUnit) {
    return makeRMBConversionQuestion(plan, context, i, meta);
  }
  
  var factor = fromUnit.base / toUnit.base;
  var answer = baseValue * factor;
  // 消除浮点噪声：度量换算均为 10^n 进制，保留 6 位小数后去尾
  answer = Math.round(answer * 1e6) / 1e6;
  var qt = plan.questionTypeId;
  var prompt;
  // P25-08：calc 题型必须内嵌算式（EXPR_RE 或 BLANK_EQ_RE）
  if (qt === 'calc') {
    prompt = baseValue + fromUnit.unit + ' = ' + baseValue + ' × ' + factor + ' = ____ ' + toUnit.unit;
  } else {
    prompt = baseValue + fromUnit.unit + ' = ____ ' + toUnit.unit;
  }
  
  var result = {
    knowledgePointId: pkp(plan),
    questionType: qt,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: qt === 'choice' ? 'choice' : 'input',
    data: {
      mode: qt,
      steps: 1,
      kind: kind,
      operation: 'conversion',
      fromUnit: fromUnit.unit,
      toUnit: toUnit.unit
    }
  };
  // P25-08：choice 提供数值选项
  if (qt === 'choice') {
    var ansNum = Number(answer);
    var distr = [];
    var deltas = [1, 2, 5, 10, 100];
    while (distr.length < 3) {
      var dv = ansNum + Rng.pick(rng, deltas) * (rng() < 0.5 ? 1 : -1);
      if (dv <= 0) dv = ansNum + Rng.pick(rng, deltas);
      if (distr.indexOf(dv) === -1 && dv !== ansNum) distr.push(dv);
    }
    result.data.options = Rng.shuffle(rng, [ansNum].concat(distr).slice(0, 4));
    result.data.correctIndex = result.data.options.indexOf(ansNum);
    result.answer = { value: String(result.data.correctIndex), acceptable: [] };
  }
  return result;
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
      data: { mode: 'apply', steps: 2, kind: 'rmb', operation: op === 'change' ? 'sub' : 'add', amountA: aFen, amountB: bFen }
    };
  }
  
  // 兜底
  // P25-08：非 rmb 度量种类的应用情境题
  if (kind === 'length') {
    var a = Rng.randInt(rng, 5, 50);
    var b = Rng.randInt(rng, 1, 20);
    var useCut = rng() < 0.5;
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: useCut
        ? '一根绳子长 ' + a + ' 厘米，剪去 ' + b + ' 厘米，还剩多少厘米？'
        : '小明身高 ' + a + ' 厘米，小红比小明矮 ' + b + ' 厘米，小红身高多少厘米？',
      answer: { value: String(useCut ? a - b : a - b), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'length', operation: 'sub' }
    };
  }
  if (kind === 'area') {
    var w = Rng.randInt(rng, 3, 12);
    var h = Rng.randInt(rng, 2, 10);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一个长方形长 ' + w + ' 厘米，宽 ' + h + ' 厘米，它的面积是多少平方厘米？',
      answer: { value: String(w * h), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'area', operation: 'mul' }
    };
  }
  if (kind === 'mass') {
    var m1 = Rng.randInt(rng, 1, 10);
    var m2 = Rng.randInt(rng, 1, 5);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一袋大米重 ' + m1 + ' 千克，一袋面粉重 ' + m2 + ' 千克，大米比面粉重多少千克？',
      answer: { value: String(m1 - m2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'mass', operation: 'sub' }
    };
  }
  if (kind === 'time') {
    var t1 = Rng.randInt(rng, 1, 10);
    var t2 = Rng.randInt(rng, 1, 5);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '小明做作业用了 ' + t1 + ' 分钟，看电视用了 ' + t2 + ' 分钟，一共用了多少分钟？',
      answer: { value: String(t1 + t2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'time', operation: 'add' }
    };
  }
  if (kind === 'capacity') {
    var c1 = Rng.randInt(rng, 1, 5);
    var c2 = Rng.randInt(rng, 1, 3);
    return {
      knowledgePointId: pkp(plan), questionType: 'apply', difficulty: plan.difficulty,
      spiralLevel: plan.spiralLevel || 1, context: plan.contextType || 'standard',
      seed: seedFor(plan, context, i),
      prompt: '一桶油有 ' + c1 + ' 升，用去 ' + c2 + ' 升，还剩多少升？',
      answer: { value: String(c1 - c2), acceptable: [] },
      answerMode: 'input',
      data: { mode: 'apply', steps: 2, kind: 'capacity', operation: 'sub' }
    };
  }
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
    capabilities: ['fill', 'choice', 'judge', 'apply', 'calc'],
    questionTypes: ['fill', 'choice', 'judge', 'apply', 'calc'],
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
      // P25-08：从 plan.semanticParams.name 派生度量种类（rmb/length/area/mass/time/capacity）
      // P25-09：name 无信号时用 concept 文本兜底（如「单位适用场景」）
      var kpName = (plan.semanticParams && plan.semanticParams.name) || '';
      var kpConcept = (plan.semanticParams && plan.semanticParams.concept) || '';
      var meta = getMoneyMeta(kp, kpName, kpConcept);

      for (var i = 0; i < count; i++) {
        var q;
        var qt = plan.questionTypeId;
        var isRMB = meta.kind === 'rmb';
        
        if (qt === 'fill') {
          if (isRMB && rng() < 0.5) q = makeRMBConversionQuestion(plan, context, i, meta);
          else if (isRMB) q = makeRMBCalculationQuestion(plan, context, i, meta);
          else q = makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'apply') {
          q = makeWordProblemQuestion(plan, context, i, meta);
        } else if (qt === 'calc') {
          // P25-08：calc 必须内嵌算式。rmb 用金额计算，其他度量用单位换算算式。
          q = isRMB ? makeRMBCalculationQuestion(plan, context, i, meta)
                    : makeMeasurementConversionQuestion(plan, context, i, meta);
        } else if (qt === 'choice' || qt === 'judge') {
          q = isRMB ? makeRMBCalculationQuestion(plan, context, i, meta)
                    : makeMeasurementConversionQuestion(plan, context, i, meta);
        } else {
          q = makeRMBConversionQuestion(plan, context, i, meta);
        }
        
        q.data.graphic = makeGraphicForMoney(meta, plan.difficulty);
        // 人民币轨：发真实 currency/rmb 描述符（按题干实际金额画币值图标）
        if (meta.kind === 'rmb' && q.data) {
          var amounts = null;
          var qd = q.data;
          if (Array.isArray(qd.operands) && qd.operands.length >= 2) {
            amounts = qd.operands.slice(0, 2).map(Number);
          } else if (qd.amountA != null && qd.amountB != null) {
            amounts = [Number(qd.amountA), Number(qd.amountB)];
          } else if (qd.originalAmount != null) {
            var fen = (typeof qd.originalAmount === 'string') ? parseRMB(qd.originalAmount) : Number(qd.originalAmount);
            amounts = isFinite(fen) ? [fen] : null;
          }
          var op = OpSem.symbol(qd.operation);
          if (amounts && amounts.length) {
            q.data.graphic = { type: 'currency', subtype: 'rmb', params: { amounts: amounts, op: op } };
          } else {
            delete q.data.graphic;
          }
        }
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

// P25-06 H2：原 MONEY_KPS（math-gN-mN-* 模块制 / math-gN-c4-* 竞赛制 历史 ID）
// 已随旧体系 KP 全部剔除，对 canonical 375 永不命中；
// 绑定 SSOT 在 generator-registry.js CORE_RECORDS。
function buildAll() {
  return [createMoneyGenerator({ id: 'generator:money-measurement' })];
}

module.exports = {
  RMB_DENOMS: RMB_DENOMS,
  RMB_UNITS: RMB_UNITS,
  MEASUREMENT_KINDS: MEASUREMENT_KINDS,
  createMoneyGenerator: createMoneyGenerator,
  buildAll: buildAll
};