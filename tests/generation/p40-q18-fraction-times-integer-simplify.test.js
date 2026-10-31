'use strict';

/**
 * tests/generation/p40-q18-fraction-times-integer-simplify.test.js — P40-Q-18（D10 收口）
 *
 * 背景（Q-14 验收 §5 D10 / #151）：分数乘整数答案约分此前仅 6b 冻结面成立
 * （Q-07 挂账⑥），全 seed 面存在未约分积直出（如 3/4×2=6/4 未化简、解析无约分句）。
 * 修复（shape.js makeFractionTimesIntegerQuestion）：答案 SSOT 约分化；
 * rawFrac 保留原始积（judge 份计数主张材料 + 约分句前项）；图形 params 仍表达
 * 题设原始份计数（图文一致）；choice 候选项逐个约分判重（R11 双正确项防护）。
 *
 * 冻结不变量（H9/P44 源 Excel 改判「数与代数」后同步：geometry/judge 行移除，
 * calc 行新增，1570→1566；intentWantsGraphic 闸门使该 4 行一律禁图）：
 *   1. 路由：分数乘整数 4 行（calc/fill/choice/apply）→ generator:shape-recognition。
 *   2. 答案约分 SSOT：全 seed 面（4 题型 × d1..4 × 4 变体）答案值（分数/带分数/整数
 *      三形态）全最简，且与原始积 num/den×times 同值（约分不改值）。
 *   3. 约分句口径：原始积未最简 → 解析必含「约分得 〈最简积〉」；
 *      原始积已最简 → 解析不得出现约分句。
 *   4. choice 四选项按值互异、correctIndex 指向答案值。
 *   5. 四行一律不携带 graphic 描述符（H9 意图禁图，无图形渲染诉求）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

const KP = 'math-g6-up-u02-k001';
const SHAPE = 'generator:shape-recognition';
const QTS = ['calc', 'fill', 'choice', 'apply'];

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = a % b; a = b; b = t; } return a; }

// 'n/d' | 'w又n/d' | 整数 → { n, d, w }（w 为带分数整数部，整数形态 n=0,d=1）
function fracVal(s) {
  const t = String(s).trim();
  const m = /^(?:(\d+)又)?(\d+)\/(\d+)$/.exec(t);
  if (m) return { n: Number(m[2]), d: Number(m[3]), w: m[1] ? Number(m[1]) : 0 };
  if (/^\d+$/.test(t)) return { n: 0, d: 1, w: Number(t) };
  return null;
}

// 原始积 num/den × times 的最简串（整数形态为整数字符串）——shape.js fracStr 同构
function simpStr(num, den) {
  const g = gcd(num, den);
  const n = num / g, d = den / g;
  return d === 1 ? String(n) : n + '/' + d;
}

function genRow(qt, d, v) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [KP], questionTypeId: qt, difficulty: d, count: 1,
    seed: 'p40q18|' + qt + '|d' + d + '|v' + v
  });
  const gen = Generators.get(SHAPE);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, qt + '|d' + d + '|v' + v + ' 产出 1 题');
  return qs[0];
}

/* ---------------- 1. 路由不变量 ---------------- */

test('selector：分数乘整数 4 行 → shape-recognition（match 全 1）', () => {
  QTS.forEach((qt) => {
    const sel = Selector.selectGenerator({ knowledgePointIds: [KP], questionTypeId: qt, difficulty: 3, count: 1 });
    assert.equal(sel.generatorId, SHAPE, qt + ' 应路由到 ' + SHAPE);
    assert.deepEqual(sel.match, { kp: 1, capability: 1, questionType: 1 });
  });
});

/* ---------------- 2. 全 seed 面约分 SSOT ---------------- */

test('maker 全 seed 面：答案最简 + 同值不改值 + 约分句口径 + 选项正确 + 禁图', () => {
  const fail = [];
  QTS.forEach((qt) => {
    for (let d = 1; d <= 4; d++) {
      for (let v = 0; v < 4; v++) {
        const tag = qt + '|d' + d + '|v' + v;
        const q = genRow(qt, d, v);
        assert.equal(q.questionType, qt, tag + ' 题型回显');
        assert.equal(q.data.kind, 'fraction-times-integer', tag + ' 走原生分数乘整数 maker');
        assert.equal(q.data.operation, 'mult', tag + ' data.operation=mult（H9 语义事实）');

        const val = String(q.answer.value);
        const fv = fracVal(val);
        const expl = q.answer && q.answer.explanation != null ? String(q.answer.explanation) : '';
        const em = /(\d+)\/(\d+)\s*×\s*(\d+)/.exec(String(q.prompt) + ' ' + expl);
        if (!em) { fail.push(tag + ' 原始积表达式未在题面/解析找到'); continue; }
        const num = Number(em[1]), den = Number(em[2]), times = Number(em[3]);
        const rawNum = num * times, rawDen = den;
        const rawSimplified = gcd(rawNum, rawDen) === 1;

        // 答案为最简分数/带分数/整数三形态之一，且与原始积同值（约分不改值）
        if (!fv) { fail.push(tag + ' 答案非分数形态: ' + val); continue; }
        if (fv.d > 1 && gcd(fv.n, fv.d) > 1) { fail.push(tag + ' 答案未约分: ' + val); continue; }
        if ((fv.w * fv.d + fv.n) * rawDen !== rawNum * fv.d) {
          fail.push(tag + ' 答案与原始积不同值: ' + val + ' vs ' + rawNum + '/' + rawDen); continue;
        }
        const wantNote = rawSimplified ? -1 : expl.indexOf('约分得 ' + simpStr(rawNum, rawDen));
        if (wantNote === -1 && !rawSimplified) { fail.push(tag + ' 缺约分句: ' + expl.slice(0, 60)); continue; }
        if (rawSimplified && expl.indexOf('约分得') !== -1) {
          fail.push(tag + ' 原始积已最简却出现约分句: ' + expl.slice(0, 60)); continue;
        }

        if (qt === 'choice') {
          const opts = (q.data && q.data.options) || [];
          assert.equal(opts.length, 4, tag + ' 四选项');
          const seen = {};
          opts.forEach((o) => {
            const ov = fracVal(o);
            assert.ok(ov, tag + ' 选项为分数形态: ' + o);
            const key = ov.d === 1 ? 'i' + ov.w : 'f' + (ov.w * ov.d + ov.n) + '/' + ov.d;
            assert.ok(!seen[key], tag + ' 选项按值互异（R11 防护）: ' + opts.join(','));
            seen[key] = 1;
          });
          const ci = q.data && q.data.correctIndex;
          assert.ok(ci >= 0 && ci < opts.length && String(opts[ci]) === val,
            tag + ' correctIndex 指向答案值 ' + val + '（实际 ' + opts[ci] + '）');
        }

        // H9/P44 意图禁图：4 行一律不携带 graphic 描述符
        assert.ok(!(q.data && q.data.graphic), tag + ' 不得携带 graphic 描述符');
      }
    }
  });
  assert.deepEqual(fail, [], '全 seed 面零违例');
});
