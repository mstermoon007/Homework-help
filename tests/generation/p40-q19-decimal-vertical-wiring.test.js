'use strict';

/**
 * tests/generation/p40-q19-decimal-vertical-wiring.test.js — P40-Q-19（D18 分桶收口）
 *
 * 背景（Q-14 验收 §5 D18）：小数两数单步尾式（calc「列式计算：A op B = ？」与
 * word 情境 apply「列式求…：A op B = ？」）此前无竖式描述符——BEFORE 态 12 行
 * calc 尾式仅 6 行已接（arithmetic.js Q-06），8 行真缺口（3 apply 加法 + 5 mul）落空。
 * 修复（decimal.js buildQuestion）：镜像 arithmetic.js Q-06 descriptor 契约——
 * dec-mul → subtype 'mul'、dec-addsub → subtype 'dec' + op，均 trimDec 字符串
 * params + maskResult:true 防泄题。范围仅小数操作数（int 轨归 Q-06 整数面）；
 * div（D4 渲染能力挂账）/ 估算 / 低于年级 / 两步 / 解析失败一律 fail-closed 不挂图。
 *
 * 冻结不变量：
 *   1. 派发链：calculation → svg-calculation（Q-06 已接通链）。
 *   2. 正接线：g≥5 乘 / g≥4 加减小数尾式行 descriptor 五元组 + params 与题面
 *      数字一致 + maskResult + 渲染 SUCCESS 且 '?' 在场（结果不泄漏）。
 *   3. fail-closed：div / 低于年级（g<5 mul、g<4 addsub）行不挂图。
 *   4. 非目标面：fill/choice 不挂图（wiring 仅 calc/apply）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const decMod = require(path.join(ROOT, 'shared', 'generator', 'generators', 'decimal.js'));
const SVGCalculation = require(path.join(ROOT, 'shared', 'svg', 'svg-calculation.js'));
const gr = require(path.join(ROOT, 'shared', 'generator', 'graphic-renderer.js'));

// decimal.js P40-Q-19 尾式契约镜像（正则与生产 L475-476 同构，'−' 为 U+2212）
const RE_CALC = /^列式计算：([\d.]+)\s*([+−×÷])\s*([\d.]+)\s*=\s*？$/;
const RE_APPLY = /列式求[^：]*：([\d.]+)\s*([+−×÷])\s*([\d.]+)\s*=\s*？$/;

function mkPlan(kp, name, qt, seed) {
  return {
    questionTypeId: qt, count: 4, difficulty: 2,
    knowledgePointIds: [kp],
    semanticParams: { name: name },
    seed: seed
  };
}

const gen = decMod.createDecimalGenerator({});

function collect(kp, name, qt, tag, seeds) {
  const rows = [];
  for (let s = 0; s < seeds; s++) {
    const out = gen.generate(mkPlan(kp, name, qt, 'p40q19|' + tag + '|' + s), {});
    out.forEach((q, i) => rows.push([q, tag + '|' + s + '#' + i]));
  }
  return rows;
}

function tailOf(prompt) {
  const t = String(prompt);
  return RE_CALC.exec(t) || RE_APPLY.exec(t);
}

// 正接线契约断言：descriptor 五元组 + 图文数字一致 + 遮蔽 + 渲染
function assertWired(q, tag, op) {
  const g = q.data.graphic;
  assert.ok(g, tag + ' 尾式应挂竖式描述符: ' + q.prompt);
  assert.equal(g.type, 'calculation', tag);
  assert.equal(g.role, 'calculation-support', tag);
  assert.equal(g.subtype, op === '×' ? 'mul' : 'dec', tag + ' subtype 镜像 Q-06 契约');
  const m = tailOf(q.prompt);
  assert.ok(m, tag + ' 题面为尾式形态');
  assert.equal(Number(g.params.a), Number(m[1]), tag + ' 图文一致 a');
  assert.equal(Number(g.params.b), Number(m[3]), tag + ' 图文一致 b');
  assert.equal(g.params.options.maskResult, true, tag + ' maskResult 防泄题');
  if (op !== '×') assert.equal(g.params.op, op, tag + ' dec op 透传');
  const svg = op === '×'
    ? SVGCalculation.mul(g.params.a, g.params.b, g.params.options)
    : SVGCalculation.dec(g.params.a, g.params.b, g.params.op, g.params.options);
  assert.ok(typeof svg === 'string' && svg.length > 100, tag + ' 渲染产出 SVG');
  assert.ok(svg.indexOf('?') !== -1, tag + ' 遮蔽结果行画 ?（不泄答案）');
}

/* ---------------- 1. 派发链 ---------------- */

test('dispatch：calculation → svg-calculation（Q-06 已接通链）', () => {
  assert.equal(gr.GRAPHIC_RENDERERS.calculation.module, 'svg-calculation');
});

/* ---------------- 2. 正接线：mul（g≥5）/ dec（g≥4）---------------- */

test('小数乘法 g5 calc：尾式挂 calculation/mul，图文一致 + 遮蔽 + 渲染', () => {
  const rows = collect('math-g5-up-u02-k001', '小数乘法', 'calc', 'mul-g5', 8);
  let wired = 0;
  rows.forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && (/\./.test(m[1]) || /\./.test(m[3]))) {
      assertWired(q, tag, m[2]);
      wired++;
    } else {
      assert.equal(q.data.graphic, undefined, tag + ' 非小数尾式行不挂图');
    }
  });
  assert.ok(wired >= 3, '32 行内应命中 ≥3 条小数乘尾式（实际 ' + wired + '）');
});

test('小数加减 g4 calc：尾式挂 calculation/dec，op 透传 + 渲染；负结果减法 fail-closed', () => {
  const rows = collect('math-g4-down-u06-k001', '小数加减法', 'calc', 'dec-g4', 8);
  let wired = 0;
  rows.forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && (/\./.test(m[1]) || /\./.test(m[3]))) {
      assert.ok(m[2] !== '×', tag + ' 本组算符非乘');
      // arithmetic-core.js verticalPlan L634：减法结果为负（a<b）超纲 fail-closed 不配竖式
      if (m[2] === '−' && Number(m[1]) < Number(m[3])) {
        assert.equal(q.data.graphic, undefined, tag + ' 负结果减法不得挂图');
      } else {
        assertWired(q, tag, m[2]);
        wired++;
      }
    }
  });
  assert.ok(wired >= 1, '32 行内应命中 ≥1 条可竖式小数加减尾式（实际 ' + wired + '）');
});

test('apply 情境行（列式求…尾式）：同契约接线（word/mult apply）', () => {
  const rows = collect('math-g5-up-u02-k001', '小数乘法', 'apply', 'apply-mul', 8)
    .concat(collect('math-g5-up-u02-k001', '小数应用', 'apply', 'apply-word', 8));
  let wired = 0;
  rows.forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && (/\./.test(m[1]) || /\./.test(m[3]))) {
      // 负结果减法超纲 fail-closed（arithmetic-core.js verticalPlan L634）
      if (m[2] === '−' && Number(m[1]) < Number(m[3])) {
        assert.equal(q.data.graphic, undefined, tag + ' 负结果减法不得挂图');
      } else {
        assertWired(q, tag, m[2]);
        wired++;
      }
    }
  });
  assert.ok(wired >= 1, '64 行内应命中 ≥1 条 apply 小数尾式（实际 ' + wired + '）');
});

/* ---------------- 3. fail-closed 分桶 ---------------- */

test('dec-div 尾式 fail-closed：不挂图（D4 渲染能力挂账，显式不越界）', () => {
  const rows = collect('math-g5-up-u02-k001', '小数除法', 'calc', 'div-g5', 8);
  let divRows = 0;
  rows.forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && m[2] === '÷') {
      divRows++;
      assert.equal(q.data.graphic, undefined, tag + ' div 不得挂图');
    }
  });
  assert.ok(divRows >= 1, '32 行内应命中 ≥1 条小数除尾式（实际 ' + divRows + '）');
});

test('below-grade fail-closed：g4 乘 / g3 加减不挂图（年级规则）', () => {
  collect('math-g4-down-u02-k001', '小数乘法', 'calc', 'mul-g4', 6).forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && (/\./.test(m[1]) || /\./.test(m[3]))) {
      assert.equal(q.data.graphic, undefined, tag + ' dec-mul 需 g≥5，g4 不得挂图');
    }
  });
  collect('math-g3-up-u02-k001', '小数加减法', 'calc', 'dec-g3', 6).forEach(([q, tag]) => {
    const m = tailOf(q.prompt);
    if (m && (/\./.test(m[1]) || /\./.test(m[3]))) {
      assert.equal(q.data.graphic, undefined, tag + ' dec-addsub 需 g≥4，g3 不得挂图');
    }
  });
});

/* ---------------- 4. 非目标面回归 ---------------- */

test('fill/choice 不挂竖式（wiring 仅 calc/apply 两消费面）', () => {
  ['fill', 'choice'].forEach((qt) => {
    collect('math-g5-up-u02-k001', '小数乘法', qt, 'neg-' + qt, 3).forEach(([q, tag]) => {
      assert.equal(q.data.graphic, undefined, tag + ' 不挂图');
    });
  });
});
