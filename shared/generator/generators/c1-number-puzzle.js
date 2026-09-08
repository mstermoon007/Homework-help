'use strict';

/**
 * shared/generator/generators/c1-number-puzzle.js — C1 Number Puzzle Generator
 *
 * 竞赛级 C1 数字谜族 Generator：竖式数字谜、横式数字谜、符号代表数、数字推理
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
  if (context && context.seed != null) return context.seed + ':c1:' + i;
  return (pkp(plan) + '|' + plan.questionTypeId + '|' + plan.difficulty + '|' + plan.count) + ':c1:' + i;
}

function makePuzzleQuestion(plan, context, i, kp) {
  var rng = Rng.createSeededRandom(seedFor(plan, context, i));
  var name = kp.name || '数字谜';
  var id = kp.id || '';

  var isVertical = name.indexOf('竖式') !== -1 || id.indexOf('vertical') !== -1 || id.indexOf('digit-puzzle') !== -1;
  var isHorizontal = name.indexOf('横式') !== -1 || id.indexOf('horizontal') !== -1;
  var isSymbol = name.indexOf('符号') !== -1 || name.indexOf('字母') !== -1 || id.indexOf('symbol') !== -1;
  var isDigitReasoning = name.indexOf('数字推理') !== -1 || id.indexOf('digit-reasoning') !== -1 || id.indexOf('number-puzzle-competition') !== -1;

  var prompt, answer;

  if (isVertical) {
    // 竖式数字谜：给定部分数字和字母，推算完整竖式
    var base = Rng.randInt(rng, 10, 50);
    var add = Rng.randInt(rng, 10, 50);
    var sum = base + add;
    // 构造竖式形式，隐藏一位数
    var hidePos = Rng.randInt(rng, 0, String(sum).length - 1);
    var sumStr = String(sum);
    var hiddenDigit = sumStr[hidePos];
    var shownSum = sumStr.substring(0, hidePos) + '□' + sumStr.substring(hidePos + 1);
    prompt = '在下面的竖式中，"□" 表示被擦掉的数字。\n  ' + base + '\n+ ' + add + '\n----\n ' + shownSum + '\n请算出 □ 代表的数字。';
    answer = hiddenDigit;
  } else if (isHorizontal) {
    // 横式数字谜：补全算式
    var a = Rng.randInt(rng, 10, 99);
    var b = Rng.randInt(rng, 10, 99);
    var c = a + b;
    prompt = '在等式 ' + a + ' + □ = ' + c + ' 中，□ 代表什么数字？';
    answer = b;
  } else if (isSymbol) {
    // 符号代表数：不同符号代表不同数字
    var aa = Rng.randInt(rng, 2, 9);
    var bb = Rng.randInt(rng, 2, 9);
    var cc = aa + bb;
    if (cc > 9) { cc = aa + bb - 9; }
    prompt = '已知 ★ + ▲ = ' + cc + '，且 ★ 和 ▲ 是不同的数字。当 ★ 最大时，★ = ?';
    answer = String(cc - 1);
  } else if (isDigitReasoning) {
    // 数字推理综合
    prompt = '一个三位数的各位数字之和是 15，百位数字比十位数字大 3，个位数字是十位数字的 2 倍。这个三位数是多少？';
    // 设十位=x, 百位=x+3, 个位=2x → 4x+3=15 → x=3 → 636
    answer = '636';
  } else {
    prompt = name + '：请根据竖式和横式中的线索，推算每个字母代表的数字。';
    answer = 'A=1, B=2, C=3';
  }

  return {
    knowledgePointId: pkp(plan),
    questionType: plan.questionTypeId,
    difficulty: plan.difficulty,
    spiralLevel: plan.spiralLevel || 1,
    context: plan.contextType || 'standard',
    seed: seedFor(plan, context, i),
    prompt: prompt,
    answer: { value: String(answer), acceptable: [] },
    answerMode: 'input',
    data: {
      mode: 'apply',
      steps: 3,
      questionType: plan.questionTypeId,
      family: 'c1-number-puzzle'
    }
  };
}

var C1_KPS = [
  // G4
  'math-g4-c1-c1-vertical',
  'math-g4-c1-c1-horizontal',
  'math-g4-c1-c1-symbol',
  // G5
  'math-g5-c1-digit-puzzle-vertical',
  'math-g5-c1-digit-puzzle-horizontal',
  'math-g5-c1-digit-puzzle-symbol',
  // G6
  'math-g6-c1-vertical-multidigit',
  'math-g6-c1-vertical-carry-complex',
  'math-g6-c1-horizontal-puzzle',
  'math-g6-c1-symbol-number',
  'math-g6-c1-digit-reasoning',
  'math-g6-c1-number-puzzle-competition'
];

function createC1Generator(spec) {
  spec = spec || {};
  var id = spec.id || 'generator:c1-number-puzzle';

  return {
    id: id,
    subject: 'math',
    capabilities: ['apply', 'calc'],
    questionTypes: ['apply', 'calc'],
    knowledgePoints: spec.knowledgePoints || C1_KPS,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      return this.capabilities.indexOf(plan.questionTypeId) !== -1;
    },

    generate: function (plan, context) {
      context = context || {};
      var count = plan.count || 1;
      var questions = [];
      var kp = KP.get(pkp(plan));

      for (var i = 0; i < count; i++) {
        questions.push(makePuzzleQuestion(plan, context, i, kp));
      }
      return questions;
    }
  };
}

function buildAll() {
  return [
    createC1Generator({
      id: 'generator:c1-number-puzzle',
      knowledgePoints: C1_KPS
    })
  ];
}

module.exports = {
  C1_KPS: C1_KPS,
  createC1Generator: createC1Generator,
  buildAll: buildAll
};
