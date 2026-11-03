'use strict';

/**
 * tests/generation/p45-04-shape-graphic.test.js — P45-04（D 类）：图形语义/题干对象/尺寸参数一致
 *
 * 背景（审计 D1/D3）：
 *   D1 math-g2-up-u05-k002 geometry「铅笔一端对着刻度 2，另一端对着刻度 10」配图是「圆」；
 *   D3 math-g3-down-u08-k003 fill「长方形长 7 厘米、宽 3 厘米」配图是平行四边形/随机图形。
 *   根因：KP 名未给出具体图形（getShapeMeta → flat 族）时，主题图形走 flat 随机取样。
 *
 * 修复（唯一入口 shape.js::themedItemMeta + stemGraphicPlan）：
 *   flat 取样时按题面派生——题面含两处刻度读数 → geometry/ruler（svg-geometry 新增 ruler 渲染）；
 *   题面点名具体图形 → 同名图形，且题面已述的边长进 params。
 *
 * 冻结不变量（A 类不受影响）：
 *   1. D1：graphic.subtype=ruler，params.from/to 与题面两处刻度读数逐一相同，渲染 SUCCESS；
 *   2. D3：题面「长方形长 X、宽 Y」→ rectangle + width/height，渲染标注 X/Y；「正方形边长 X」→ square + size=X；
 *   3. geometry 题面图形标签与描述符同名（不再出现「观察下图（圆）」问刻度尺）；
 *   4. 作用域：非 flat KP（如 k004 线段）不进入题面派生路径；D2 修复后 k001 按题面主问对象派生。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

// SVG 渲染链（Node 直载，按 practice.html 顺序；bundle 不含 SVG 模块）
require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
const SvgRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

function gen(kp, qt, d, count) {
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: count || 3,
    seed: 'p45-04|' + kp + '|' + qt + '|d' + d
  });
  const gen1 = Generators.get(Selector.selectGenerator({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: count || 3
  }).generatorId);
  return gen1.generate(plan, {});
}

/* ------------------------------------------------------------------ *
 * D1：刻度尺读数题 → geometry/ruler，参数与题面读数一致
 * ------------------------------------------------------------------ */
test('P45-04 D1：两处刻度读数题配刻度尺，params.from/to 与题面一致', () => {
  const KP = 'math-g2-up-u05-k002';
  const failures = [];
  ['fill', 'geometry'].forEach(function (qt) {
    for (let d = 1; d <= 4; d++) {
      gen(KP, qt, d).forEach(function (q, i) {
        const tag = KP + '/' + qt + '/d' + d + '#' + i;
        const g = q.data && q.data.graphic;
        const m = /刻度\s*(\d+)[^\d]{0,12}刻度\s*(\d+)/.exec(String(q.prompt));
        if (!m) { failures.push(tag + ' 题面应含两处刻度读数: ' + q.prompt); return; }
        const from = Number(m[1]), to = Number(m[2]);
        if (!g || g.type !== 'geometry' || g.subtype !== 'ruler') {
          failures.push(tag + ' 描述符应为 geometry/ruler，实为 ' + (g && g.subtype)); return;
        }
        if (g.params.from !== from || g.params.to !== to) {
          failures.push(tag + ' params.from/to ' + g.params.from + '/' + g.params.to +
            ' ≠ 题面读数 ' + from + '/' + to); return;
        }
        if (!(from < to)) { failures.push(tag + ' 题面读数应 from<to: ' + from + '/' + to); return; }
        const r = SvgRegistry.renderFor(g);
        if (r.status !== 'SUCCESS') { failures.push(tag + ' 渲染失败: ' + r.reason); return; }
        if (r.svg.indexOf('>' + from + '<') === -1 || r.svg.indexOf('>' + to + '<') === -1) {
          failures.push(tag + ' 刻度尺未画出题面两处读数 ' + from + '/' + to); return;
        }
        if (qt === 'geometry' && !/观察下图（刻度尺）/.test(String(q.prompt))) {
          failures.push(tag + ' geometry 图形标签应为刻度尺: ' + q.prompt); return;
        }
      });
    }
  });
  assert.deepEqual(failures, [], 'D1 刻度尺图文一致失败:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * D3：题面点名长方形/正方形 → 同名图形 + 题面尺寸进 params + 渲染标注
 * ------------------------------------------------------------------ */
test('P45-04 D3：长方形/正方形题配同名同尺寸图形并标注题设边长', () => {
  const KP = 'math-g3-down-u08-k003';
  const failures = [];
  ['fill', 'choice', 'geometry'].forEach(function (qt) {
    for (let d = 1; d <= 4; d++) {
      gen(KP, qt, d).forEach(function (q, i) {
        const tag = KP + '/' + qt + '/d' + d + '#' + i;
        const g = q.data && q.data.graphic;
        const prompt = String(q.prompt);
        const rect = /长方形长\s*(\d+)\s*厘米、宽\s*(\d+)\s*厘米/.exec(prompt);
        const sq = /正方形边长\s*(\d+)\s*厘米/.exec(prompt);
        if (rect) {
          if (!g || g.subtype !== 'rectangle') {
            failures.push(tag + ' 题面问长方形应配 rectangle，实为 ' + (g && g.subtype)); return;
          }
          if (g.params.width !== Number(rect[1]) || g.params.height !== Number(rect[2])) {
            failures.push(tag + ' params ' + g.params.width + '×' + g.params.height +
              ' ≠ 题面 ' + rect[1] + '×' + rect[2]); return;
          }
          if (g.params.labelSides !== true) {
            failures.push(tag + ' 题述边长应标注（labelSides=true）'); return;
          }
        } else if (sq) {
          if (!g || g.subtype !== 'square') {
            failures.push(tag + ' 题面问正方形应配 square，实为 ' + (g && g.subtype)); return;
          }
          if (g.params.size !== Number(sq[1])) {
            failures.push(tag + ' params.size ' + g.params.size + ' ≠ 题面 ' + sq[1]); return;
          }
        } else {
          failures.push(tag + ' 题面应含长方形/正方形尺寸条件: ' + prompt); return;
        }
        const r = SvgRegistry.renderFor(g);
        if (r.status !== 'SUCCESS') { failures.push(tag + ' 渲染失败: ' + r.reason); return; }
        // 渲染标注 = 题面已述边长（rectangle 标宽高两侧、square 标边长）
        const labels = rect ? [rect[1] + 'cm', rect[2] + 'cm'] : null;
        if (labels && (r.svg.indexOf(labels[0]) === -1 || r.svg.indexOf(labels[1]) === -1)) {
          failures.push(tag + ' 图形未标注题述边长 ' + labels.join('/')); return;
        }
        if (qt === 'geometry') {
          const want = rect ? '长方形' : '正方形';
          if (!new RegExp('观察下图（' + want + '）').test(prompt)) {
            failures.push(tag + ' geometry 图形标签应为' + want + ': ' + prompt); return;
          }
        }
      });
    }
  });
  assert.deepEqual(failures, [], 'D3 长方形/正方形图文一致失败:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * 作用域：题面派生只在 flat 族 KP 生效，不误伤具体图形 KP（k004 线段）与 D2 修复后的 k001（题面主问对象优先）
 * ------------------------------------------------------------------ */
test('P45-04 作用域：k004 线段题图文一致（线段→line-segment，刻度尺→ruler 且读数进 params）', () => {
  const KP = 'math-g2-up-u05-k004';
  for (let d = 1; d <= 4; d++) {
    gen(KP, 'geometry', d).forEach(function (q, i) {
      const g = q.data && q.data.graphic;
      const m = /观察下图（([^）]+)）/.exec(q.prompt || '');
      const label = m ? m[1] : '';
      const tag = KP + ' geometry#' + i + '（' + label + '）';
      if (label === '刻度尺') {
        assert.equal(g && g.subtype, 'ruler', tag + ' 题面问刻度尺应配 ruler，得: ' + (g && g.subtype));
        assert.ok(g && g.params && g.params.from != null && g.params.to != null,
          tag + ' ruler 应带 from/to 刻度读数: ' + JSON.stringify(g && g.params));
        return;
      }
      assert.equal(g && g.subtype, 'line-segment', tag + ' 题面问线段应配 line-segment，得: ' + (g && g.subtype));
    });
  }
});

test('P45-09（D2）：k001 按题面主问对象派生 rectangle（不再按 KP 名首命中 square）', () => {
  const KP = 'math-g3-down-u03-k001';
  gen(KP, 'geometry', 2).forEach(function (q, i) {
    const g = q.data && q.data.graphic;
    assert.equal(g && g.subtype, 'rectangle', KP + ' geometry#' + i + ' 题面问长方形应配 rectangle，得: ' + (g && g.subtype));
    assert.ok(/长方形/.test(q.prompt), KP + ' geometry#' + i + ' 题面主问对象应为长方形: ' + q.prompt);
  });
});

/* ------------------------------------------------------------------ *
 * 渲染器契约：ruler 描述符可渲染（含 0..to+1 刻度与两处读数）
 * ------------------------------------------------------------------ */
test('P45-04 渲染契约：geometry/ruler SUCCESS 且刻度读数完整', () => {
  const g = { type: 'geometry', subtype: 'ruler', role: 'quantity-correspondence',
    params: { from: 2, to: 10, unit: 'cm', unitPx: 25 } };
  const r = SvgRegistry.renderFor(g);
  assert.equal(r.status, 'SUCCESS', 'ruler 应渲染 SUCCESS: ' + (r.reason || ''));
  [0, 2, 5, 10, 11].forEach(function (v) {
    assert.ok(r.svg.indexOf('>' + v + '<') !== -1, '刻度尺应含刻度 ' + v);
  });
});
