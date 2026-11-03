'use strict';

/**
 * tests/generation/p45-03-fraction-format.test.js — P45-03 分数格式化（C1–C5）
 *
 * 冻结不变量：
 *   1. 答案：分数形态必须既约；分母 1 必须折叠为整数（禁 `n/1`）。
 *   2. 解析：非选择题解析必须含最终答案；解析内不得残留 `n/1`。
 *   3. 填空：答案与解析同源，解析结论含所填值。
 *   4. 选项：纯分数选项必须既约（表达式选项不在本断言范围）。
 *
 * 覆盖登记 KP：math-g5-down-u06-k001 / k002、math-g5-down-u04-k002、
 * math-g6-up-u03-k001 / k002 / k003（k001 为 P45-10 纳入的 C6 倒数边缘项），
 * 题型 calc/fill/choice/apply，难度 1–4、变体 0–3。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

const KPS = [
  'math-g5-down-u06-k001',
  'math-g5-down-u06-k002',
  'math-g5-down-u04-k002',
  'math-g6-up-u03-k001',
  'math-g6-up-u03-k002',
  'math-g6-up-u03-k003'
];
const QTS = ['calc', 'fill', 'choice', 'apply'];

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a || 1; }
function fracOf(s) {
  const m = /^(\d+)\/(\d+)$/.exec(String(s).trim());
  return m ? { n: Number(m[1]), d: Number(m[2]) } : null;
}

function genRow(kp, qt, d, v) {
  const seed = 'p45-03|' + kp + '|' + qt + '|d' + d + '|v' + v;
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1, seed: seed
  });
  const sel = Selector.selectGenerator({ knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: 1 });
  const gen = Generators.get(sel.generatorId);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, seed + ' 应产出 1 题');
  return { q: qs[0], generatorId: sel.generatorId, seed: seed };
}

test('P45-03 全 seed 面：答案既约 / 分母 1 折叠 / 解析同源 / 选项同源', () => {
  const fail = [];
  KPS.forEach((kp) => {
    QTS.forEach((qt) => {
      for (let d = 1; d <= 4; d++) {
        for (let v = 0; v < 4; v++) {
          const { q, seed } = genRow(kp, qt, d, v);
          const val = String(q.answer.value);
          const ex = String(q.answer.explanation || '');
          const f = fracOf(val);

          if (f) {
            if (f.d === 1) fail.push(seed + ' 分母 1 未折叠: ' + val);
            if (gcd(f.n, f.d) > 1) fail.push(seed + ' 答案未约分: ' + val);
          }
          if (/\d+\/1(?!\d)/.test(val)) fail.push(seed + ' 答案残留 n/1: ' + val);
          if (/\d+\/1(?!\d)/.test(ex)) fail.push(seed + ' 解析残留 n/1: ' + ex.slice(0, 100));
          if (qt !== 'choice' && ex.indexOf(val) === -1) {
            fail.push(seed + ' 解析不含答案 ' + val + ': ' + ex.slice(0, 100));
          }
          if (qt === 'choice' && q.data && Array.isArray(q.data.options)) {
            q.data.options.forEach((o) => {
              const of = fracOf(o);
              if (of && gcd(of.n, of.d) > 1) fail.push(seed + ' 选项未约分: ' + o);
            });
          }
        }
      }
    });
  });
  assert.deepEqual(fail, [], 'P45-03 违例:\n' + fail.join('\n'));
});

test('P45-03 登记复现：C1 类 calc 全 seed 不再出现 1/1', () => {
  const hits = [];
  KPS.forEach((kp) => {
    for (let d = 1; d <= 4; d++) {
      for (let v = 0; v < 4; v++) {
        const { q, seed } = genRow(kp, 'calc', d, v);
        if (/^1\/1$/.test(String(q.answer.value))) hits.push(seed + ' → ' + q.prompt);
      }
    }
  });
  assert.deepEqual(hits, [], 'calc 答案不得为 1/1:\n' + hits.join('\n'));
});
