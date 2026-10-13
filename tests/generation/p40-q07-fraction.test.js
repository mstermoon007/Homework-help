'use strict';

/**
 * tests/generation/p40-q07-fraction.test.js — P40-Q-07 分数表达深化验证
 *
 * 层1  SVGCalculation.frac 直渲契约（留白框防泄题 / resultBox:false 约分结果 / 负结果 fail-closed）；
 * 层2  真实生成：addsub-diff × calc 挂 calculation/frac 描述符（契约五元组 + 渲染 SUCCESS +
 *      防泄题 + 图文一致），choice/apply 解析补通分步骤（素材取自已生成变量）；
 * 层3  非目标行回归：同分母/choice/apply 不挂图（课标口算 + 意图无图行接管口径）；
 * 层4  约分句覆盖：通分后结果可约分时解析含「约分得」。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const fractionMod = require(path.join(ROOT, 'shared/generator/generators/fraction.js'));
const SVGCalculation = require(path.join(ROOT, 'shared/svg/svg-calculation.js'));
const gr = require(path.join(ROOT, 'shared/generator/graphic-renderer.js'));

function mkPlan(name, qt, seed) {
  return {
    questionTypeId: qt, count: 3, difficulty: 2,
    knowledgePointIds: ['math-g5-down-u04-k002'],
    semanticParams: { name: name },
    constraints: { numberRange: { min: 1, max: 20 } },
    seed: seed
  };
}

/* ------------------------------------------------------------------ *
 * 层1 frac 直渲契约
 * ------------------------------------------------------------------ */

test('P40-Q-07 frac 直渲：结果留白框防泄题（默认形态）', () => {
  const svg = SVGCalculation.frac(1, 2, 1, 3, '+', {});
  assert.ok(typeof svg === 'string' && svg.length > 100);
  assert.ok(svg.indexOf('?') !== -1, '留白框应含 ?');
  // 1/2 + 1/3 = 5/6：结果分子 5 不得出现在图中（分母 6 为操作数合法在场）
  assert.ok(svg.indexOf('>5<') === -1, '答案分子不得泄漏进图');
});

test('P40-Q-07 frac 直渲：resultBox:false 显约分结果 + 负结果 fail-closed', () => {
  const svg = SVGCalculation.frac(1, 2, 1, 3, '+', { resultBox: false });
  assert.ok(svg.indexOf('5') !== -1 && svg.indexOf('6') !== -1, '约分结果 5/6 应在场');
  assert.throws(() => SVGCalculation.frac(1, 3, 1, 2, '-', { resultBox: false }), /结果为负/);
});

/* ------------------------------------------------------------------ *
 * 层2 真实生成：异分母 calc 竖式 + 解析通分步骤
 * ------------------------------------------------------------------ */

test('P40-Q-07 异分母 calc 挂 calculation/frac 描述符：契约 + 派发 + 渲染 + 防泄题', () => {
  const gen = fractionMod.createFractionGenerator({});
  const out = gen.generate(mkPlan('异分母分数加减法', 'calc', 'p40q07:t2'), { seed: 'p40q07:t2' });
  assert.ok(out.length === 3);
  out.forEach((q, i) => {
    assert.equal(q.data.subType, 'addsub-diff');
    const g = q.data.graphic;
    assert.ok(g, '#' + i + ' 异分母 calc 应挂竖式描述符');
    assert.equal(g.type, 'calculation');
    assert.equal(g.subtype, 'frac');
    assert.equal(g.role, 'calculation-support');
    // 图文一致：descriptor 操作数必须与题面算式一致（变式数值桶冲突探测）
    const m = q.prompt.match(/(\d+)\/(\d+) \+ (\d+)\/(\d+)/);
    assert.ok(m, '题面应为 a/b + c/d 形态');
    assert.equal(+m[1], g.params.a); assert.equal(+m[2], g.params.b);
    assert.equal(+m[3], g.params.c); assert.equal(+m[4], g.params.d);
    assert.equal(g.params.op, '+');
    assert.equal(g.params.options.resultBox, true, '结果留白防泄题');
    // 派发链：calculation → svg-calculation（Q-06 已接通链）
    assert.equal(gr.GRAPHIC_RENDERERS.calculation.module, 'svg-calculation');
    // 渲染 SUCCESS + 防泄题（留白 '?' 在场、答案整串不在场）
    const svg = SVGCalculation.frac(g.params.a, g.params.b, g.params.c, g.params.d, g.params.op, g.params.options);
    assert.ok(typeof svg === 'string' && svg.length > 100);
    assert.ok(svg.indexOf('?') !== -1);
    assert.ok(svg.indexOf(q.answer.value) === -1, '答案整串不得泄漏进图');
    // 解析：通分步骤具体化（口号 → 最小公倍数 + 两分数转换）
    const ex = q.answer.explanation;
    assert.ok(/最小公倍数/.test(ex), '#' + i + ' 解析应含最小公倍数步骤');
    assert.ok(/\/\d+ = \d+\//.test(ex), '#' + i + ' 解析应含通分转换式');
  });
});

test('P40-Q-07 异分母 choice/apply 解析补通分步骤（素材取自已生成变量）', () => {
  const gen = fractionMod.createFractionGenerator({});
  ['choice', 'apply'].forEach((qt) => {
    const out = gen.generate(mkPlan('异分母分数加减法', qt, 'p40q07:t3' + qt), { seed: 'p40q07:t3' + qt });
    out.forEach((q, i) => {
      assert.equal(q.data.subType, 'addsub-diff');
      assert.equal(q.data.graphic, undefined, qt + ' 非目标行不挂图');
      const ex = q.answer.explanation;
      assert.ok(/通分/.test(ex), qt + '#' + i + ' 解析应含通分');
      assert.ok(/最小公倍数/.test(ex), qt + '#' + i + ' 解析应含最小公倍数');
      // 答案（约分后）必须出现在解析结论中（步骤闭环）
      assert.ok(ex.indexOf(q.answer.value) !== -1, qt + '#' + i + ' 解析应含最终答案');
    });
  });
});

/* ------------------------------------------------------------------ *
 * 层3 非目标行回归
 * ------------------------------------------------------------------ */

test('P40-Q-07 回归：同分母 calc 不挂竖式（课标口算，不机械扩修）', () => {
  const gen = fractionMod.createFractionGenerator({});
  const out = gen.generate(mkPlan('同分母分数加减法', 'calc', 'p40q07:t4'), { seed: 'p40q07:t4' });
  out.forEach((q, i) => {
    assert.equal(q.data.subType, 'addsub');
    assert.equal(q.data.graphic, undefined, '#' + i + ' 同分母不得挂 frac 竖式');
  });
});

/* ------------------------------------------------------------------ *
 * 层4 约分句覆盖
 * ------------------------------------------------------------------ */

test('P40-Q-07 通分后可约分时解析含「约分得」', () => {
  const gen = fractionMod.createFractionGenerator({});
  let found = false;
  for (let s = 0; s < 40 && !found; s++) {
    const seed = 'p40q07:t5:' + s;
    const out = gen.generate(mkPlan('异分母分数加减法', 'calc', seed), { seed: seed });
    out.forEach((q) => {
      const ex = q.answer.explanation || '';
      if (/约分得/.test(ex)) {
        found = true;
        // 约分句形态：cnum/lcm 约分得 n/d（d < lcm）
        const m = ex.match(/约分得 (\d+)\/(\d+)/);
        assert.ok(m, '约分句应为「约分得 n/d」形态');
        assert.equal(m[1] + '/' + m[2], q.answer.value, '约分结果必须等于答案');
      }
    });
  }
  assert.ok(found, '40 seed 内应能命中可约分组合（d1/d2 ∈ {2,3,4,6} 组合面）');
});
