'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const ROOT = path.resolve(__dirname, '..', '..');
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const Arith = require(path.join(ROOT, 'shared', 'generator', 'core', 'arithmetic-core.js'));
const Contract = require(path.join(ROOT, 'shared', 'generator', 'generator-contract.js'));
const Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));

const CORE_IDS = [
  'generator:arithmetic-addition',
  'generator:arithmetic-subtraction',
  'generator:arithmetic-multiplication',
  'generator:arithmetic-division',
  'generator:arithmetic-mixed-calculation',
  'generator:selection-fill',
  'generator:selection-choice',
  'generator:selection-judge',
  'generator:complex-calc'
];

function planFor(kpId, count, difficulty, questionType) {
  return Engine.plan({ knowledgePointId: kpId, count: count || 5, difficulty: difficulty || 3 }).plans[0];
}

test('核心 Generator 全部注册', () => {
  CORE_IDS.forEach(id => {
    assert.ok(Generators.BY_ID[id], id + ' 缺失');
    assert.strictEqual(Generators.BY_ID[id].id, id);
  });
  assert.strictEqual(Generators.ALL.length, CORE_IDS.length);
});

test('GeneratorContract 全部通过', () => {
  Generators.ALL.forEach(g => {
    assert.strictEqual(Contract.validateGeneratorContract(g, null).valid, true, g.id);
  });
});

test('同一种子 → 输出完全一致（可复现）', () => {
  const plan = planFor('math-g1-m0-make-ten', 5, 4);
  Generators.ALL.forEach(g => {
    if (!g.supports(plan)) return;
    const a = g.generate(plan, { seed: 't1' });
    const b = g.generate(plan, { seed: 't1' });
    assert.deepStrictEqual(a, b, g.id + ' 不可复现');
  });
});

test('题量 === plan.count', () => {
  [3, 7].forEach(count => {
    const plan = planFor('math-g1-m0-make-ten', count, 4);
    Generators.ALL.forEach(g => {
      if (!g.supports(plan)) return;
      assert.strictEqual(g.generate(plan, { seed: 's' }).length, count, g.id + ' count=' + count);
    });
  });
});

test('算术族：答案可由题干复算，且输出为合法 SemanticQuestion', () => {
  const plan = planFor('math-g1-m0-make-ten', 10, 5);
  CORE_IDS.filter(id => id.indexOf('arithmetic') === 0).forEach(id => {
    const g = Generators.BY_ID[id];
    const qs = g.generate(plan, { seed: 'inv' });
    qs.forEach(q => {
      assert.strictEqual(Contract.validateSemanticQuestion(q).valid, true, id);
      const parsed = Arith.parseExpression(q.prompt);
      assert.ok(parsed, id + ' 题干不可解析: ' + q.prompt);
      assert.strictEqual(String(Arith.calculateAnswer(parsed.operands, parsed.operators)), String(q.answer), id + ' 答案错误: ' + q.prompt);
    });
  });
});

test('减法非负 / 除法整除 / 乘法操作数有界', () => {
  const plan = planFor('math-g1-m0-make-ten', 20, 3);
  const sub = Generators.BY_ID['generator:arithmetic-subtraction'].generate(plan, { seed: 's' });
  sub.forEach(q => {
    const p = Arith.parseExpression(q.prompt);
    assert.ok(p.operands[0] >= p.operands[1], '减法负数: ' + q.prompt);
  });
  const div = Generators.BY_ID['generator:arithmetic-division'].generate(plan, { seed: 'd' });
  div.forEach(q => {
    const p = Arith.parseExpression(q.prompt);
    // 链式表达式（如 a + b ÷ c）用答案复算不变量；÷ 为唯一运算符时校验整除性
    if (p.operators.length === 1 && p.operators[0] === '÷') {
      assert.ok(p.operands[0] % p.operands[1] === 0, '除法不整除: ' + q.prompt);
      assert.strictEqual(Number(q.answer), p.operands[0] / p.operands[1]);
    }
    assert.strictEqual(Number(q.answer), Arith.calculateAnswer(p.operands, p.operators), '答案错误: ' + q.prompt);
  });
});

test('choice：选项含唯一正确项且干扰项 >= 2；judge：布尔答案', () => {
  const planChoice = planFor('math-g1-m5-match-shape', 8, 3);
  const choice = Generators.BY_ID['generator:selection-choice'].generate(planChoice, { seed: 'c' });
  choice.forEach(q => {
    const opts = q.data.options;
    assert.ok(Array.isArray(opts) && opts.length >= 3, '选项不足');
    assert.strictEqual(opts.filter(o => o === String(q.answer)).length, 1, '正确项不唯一');
  });

  const planJudge = planFor('math-g1-m11-judge-mixed', 8, 3);
  const judge = Generators.BY_ID['generator:selection-judge'].generate(planJudge, { seed: 'j' });
  judge.forEach(q => {
    assert.strictEqual(typeof q.answer, 'boolean');
  });
});

test('M4-R07 参数化：numberRange 约束驱动操作数', () => {
  const plan = planFor('math-g1-m0-make-ten', 10, 3);
  const narrow = Object.assign({}, plan, { constraints: Object.assign({}, plan.constraints, { numberRange: { min: 1, max: 5 } }) });
  const wide = Object.assign({}, plan, { constraints: Object.assign({}, plan.constraints, { numberRange: { min: 50, max: 100 } }) });
  const g = Generators.BY_ID['generator:arithmetic-addition'];
  g.generate(narrow, { seed: 'r' }).forEach(q => {
    const p = Arith.parseExpression(q.prompt);
    p.operands.forEach(o => assert.ok(o >= 1 && o <= 5, '超出窄范围: ' + q.prompt));
  });
  g.generate(wide, { seed: 'r' }).forEach(q => {
    const p = Arith.parseExpression(q.prompt);
    p.operands.forEach(o => assert.ok(o >= 50 && o <= 100, '超出宽范围: ' + q.prompt));
  });
});

test('M4-R07：Generator 源码不得含难度/年级硬编码条件', () => {
  const files = ['arithmetic.js', 'selection.js'];
  files.forEach(f => {
    const src = fs.readFileSync(path.join(ROOT, 'shared', 'generator', 'generators', f), 'utf8');
    assert.ok(!/\bif\s*\([^)]*\bdifficulty\b[^)]*(===|==|!==|!=|<|>|<=|>=)/.test(src), f + ' 含难度硬编码');
    assert.ok(!/\bif\s*\([^)]*\bgrade\b[^)]*(===|==|!==|!=|<|>|<=|>=)/.test(src), f + ' 含年级硬编码');
    assert.ok(!/\bMath\.random\b/.test(src), f + ' 使用 Math.random');
  });
});
