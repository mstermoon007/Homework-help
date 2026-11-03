'use strict';

/**
 * tests/generation/p45-01-count-figure.test.js — P45-01（A 类）图元数量 = 答案
 *
 * 背景（审计 A1/A2）：计数题「图中共有几个 X？」此前只渲染 1 个图元，
 * 答案却取 targetCount（3–6），学生看图只能数到 1。
 *
 * 修复：shape.js::makeCountQuestion 构造 geometry/count 描述符，
 * params.count 与 answer 同源；svg-geometry 新增 count 渲染，按 count 画 N 个同类图元。
 *
 * 冻结不变量：
 *   1. 计数题 answer / data.targetCount / data.figureCount / graphic.params.count 四值同源。
 *   2. 描述符 subtype='count'，params.shape 与题干图形族一致，渲染 SUCCESS。
 *   3. 渲染结果中「可数图元」个数 == answer（按 params.shape 取对应 SVG 图元）。
 *   4. 题干问法不变（仍为「图中共有几个 X？」）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

// SVG 渲染链（Node 直载，按 practice.html 顺序）
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
const SvgRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

// 题干图形名 → 描述符 subtype（仅覆盖计数题可能出现的平面图形族）
const NAME_TO_SUB = {
  '正方形': 'square',
  '长方形': 'rectangle',
  '三角形': 'triangle',
  '圆': 'circle',
  '平行四边形': 'parallelogram',
  '梯形': 'trapezoid',
  '角': 'angle'
};
const SUB_TO_TAG = {
  square: '<rect', rectangle: '<rect', triangle: '<polygon',
  parallelogram: '<polygon', trapezoid: '<polygon', circle: '<circle', angle: '<path'
};

const ROWS = [
  { kp: 'math-g1-down-u01-k001' }, // A1：平面图形计数（flat 族按 seed 取样）
  { kp: 'math-g4-up-u02-k001' }    // A2：角的计数
];

function genRow(kp, d, v) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: 'fill', difficulty: d, count: 1,
    seed: 'p45-01|' + kp + '|d' + d + '|v' + v
  });
  const sel = Selector.selectGenerator({ knowledgePointIds: [kp], questionTypeId: 'fill', difficulty: d, count: 1 });
  const gen = Generators.get(sel.generatorId);
  const qs = gen.generate(plan, {});
  assert.equal(qs.length, 1, kp + '|d' + d + '|v' + v + ' 产出 1 题');
  return qs[0];
}

ROWS.forEach((row) => {
  test('P45-01 ' + row.kp + '：计数题图元数 == 答案，且可渲染', () => {
    let counted = 0;
    const failures = [];
    for (let d = 1; d <= 4; d++) {
      for (let v = 0; v < 4; v++) {
        const tag = row.kp + '|d' + d + '|v' + v;
        const q = genRow(row.kp, d, v);
        const prompt = String(q.prompt);
        if (!/图中共有几个/.test(prompt)) continue; // 非计数分支（认图形）
        counted++;

        const answer = Number(q.answer.value);
        const g = q.data && q.data.graphic;
        if (!g || g.type !== 'geometry' || g.subtype !== 'count') {
          failures.push(tag + ' 描述符应为 geometry/count: ' + JSON.stringify(g && g.subtype)); continue;
        }
        const m = /^图中共有几个([^？]{1,8})？$/.exec(prompt.trim());
        if (!m) { failures.push(tag + ' 题干问法被改动: ' + prompt); continue; }
        const expectSub = NAME_TO_SUB[m[1]];
        if (!expectSub) { failures.push(tag + ' 未登记题干图形族: ' + m[1]); continue; }
        if (g.params.shape !== expectSub) {
          failures.push(tag + ' params.shape 应为 ' + expectSub + '（题干「' + m[1] + '」，实为 ' + g.params.shape + '）'); continue;
        }
        if (g.params.count !== answer || q.data.figureCount !== answer || q.data.targetCount !== answer) {
          failures.push(tag + ' 四值不同源: answer=' + answer + ' params.count=' + g.params.count +
            ' figureCount=' + q.data.figureCount + ' targetCount=' + q.data.targetCount); continue;
        }

        const rendered = SvgRegistry.renderFor(g);
        if (rendered.status !== 'SUCCESS') {
          failures.push(tag + ' 渲染失败: ' + rendered.reason); continue;
        }
        const tagOfSvg = SUB_TO_TAG[expectSub];
        const hits = (rendered.svg.match(new RegExp(tagOfSvg, 'g')) || []).length;
        if (hits !== answer) {
          failures.push(tag + ' 实渲染图元数 ' + hits + ' ≠ 答案 ' + answer); continue;
        }
      }
    }
    assert.ok(counted > 0, row.kp + ' 全 seed 面应命中至少一道计数题');
    assert.deepEqual(failures, [], row.kp + ' 计数题图元一致性失败:\n' + failures.join('\n'));
  });
});
