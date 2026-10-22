'use strict';

/**
 * tests/generation/p42-4-fraction-simplify-truth.test.js — P42-4（P42-032）
 *
 * 背景（register P42-032）：fraction.js conceptTyped nature/calc 约分列式模板
 * 「列式：cn ÷ g2 = cr.n」把本步除数 g2 与最简分子 cr.n 混用——gcd(ca,cb)>1 时
 * （6/12：g2=2，simp→1/2）写出假等式「6 ÷ 2 = 1」（真值 6÷2=3，或同除以 6 得 1）；
 * gcd(ca,cb)=1 的抽样恰巧正确，属隐性模板缺陷。
 *
 * 修复（用户裁决：右值改本步商）：列式右值改为 cn/g2（=ca），恒真；
 * gcd(ca,cb)=1 时 cr.n===ca，输出逐字节不变。
 *
 * 冻结不变量：
 *   1. 真值不变量：全 seed 面（d1..4 × v0..3）题干列式 cn ÷ g2 = 右值 逐行数值成立。
 *   2. 登记样本回归（gcd>1 形态，右值 ≠ 最简分子）：p42 精确种子
 *      math-g5-down-u04-k006 calc 复现，列式「6 ÷ 2 = 3」成立，答案 1/2 不变。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

const KP = 'math-g5-down-u04-k006';

function genRow(d, v) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [KP], questionTypeId: 'calc', difficulty: d, count: 1,
    seed: 'p42-4|' + KP + '|calc|d' + d + '|v' + v
  });
  const sel = Selector.selectGenerator({ knowledgePointIds: [KP], questionTypeId: 'calc', difficulty: d, count: 1 });
  const gen = Generators.get(sel.generatorId);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, 'd' + d + '|v' + v + ' 产出 1 题');
  return qs[0];
}

test('P42-032 全 seed 面：约分列式 cn ÷ g2 = 右值 逐行数值成立', () => {
  const failures = [];
  let parsed = 0;
  for (let d = 1; d <= 4; d++) {
    for (let v = 0; v < 4; v++) {
      const q = genRow(d, v);
      const m = /列式：(\d+) ÷ (\d+) = (\d+)/.exec(String(q.prompt));
      if (!m) { failures.push('d' + d + '|v' + v + ' 列式缺失: ' + q.prompt); continue; }
      parsed++;
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (b === 0 || a % b !== 0 || a / b !== c) {
        failures.push('d' + d + '|v' + v + ': ' + a + ' ÷ ' + b + ' ≠ ' + c);
      }
    }
  }
  assert.deepEqual(failures, [], '列式真值失败:\n' + failures.join('\n'));
  assert.equal(parsed, 16, '全 seed 面每行都须含可校验列式（实得 ' + parsed + '）');
});

test('P42-032 登记样本回归（gcd>1 形态）：6 ÷ 2 = 3 成立且 ≠ 最简分子 1', async () => {
  const s = new PracticeSession({
    subject: 'math', grade: 5, count: 1, difficulty: 3,
    knowledgePointId: KP, questionType: 'calc', seed: 'p42|' + KP + '|calc|d3'
  });
  await s.start();
  const q = (s.semanticQuestions || [])[0];
  assert.ok(q, '登记样本复现产出');
  assert.match(String(q.prompt), /列式：6 ÷ 2 = 3/, '题干列式: ' + q.prompt);
  assert.equal(String(q.answer.value), '1/2', '答案规格不变');
});
