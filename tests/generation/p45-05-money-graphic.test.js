'use strict';

/**
 * tests/generation/p45-05-money-graphic.test.js — P45-05（D 类）：度量题图形与题干同源
 *
 * 背景（审计 D4/D5）：
 *   D4 math-g3-down-u04-k004 apply「长方形长 8 厘米、宽 5 厘米，面积是多少？」
 *      配图为固定 params 8×3、未标注 —— 描述符尺寸与题干数据未联动；
 *   D5 单位换算类约 12 行（fill/choice/judge「9 平方分米 = ____ 平方米」等）
 *      统一挂未标注 8×3 矩形 —— 与题面无关的装饰性通用图形。
 *
 * 修复（唯一入口 money.js::makeGraphicForMoney）：
 *   - area 应用题 → rectangle 尺寸/标注 = 题干长宽（D4）；
 *   - area 换算题 → rectangle 条带，宽度 = 题干面积值、单位 = 题干源单位；
 *   - mass（含称重实践）→ weighing 天平，盘下标注题干重量；
 *   - length → ruler 刻度尺，刻度范围 = 题干长度；
 *   - rmb → currency/rmb（既有，金额与题干同源）。
 *   任何非 geometry 行不得再出现固定 8×3 无标注矩形，也不得零图形
 *   （T2 qt-intent 对这些行声明 graphicRole=auxiliary）。
 *
 * 不变量：
 *   1. D4：题面「长 X、宽 Y」→ params width/height = X/Y、labelSides=true、渲染 SUCCESS 且标注；
 *   2. D5：每个非 geometry 行的描述符字段与题干同源，且渲染 SUCCESS；
 *   3. 质量行不确定固定 unit/unitPx（单位随题面变化，全部写入盘下文案）；
 *   4. geometry 行仍用 maker 原生语义图形（不被通用图覆盖）；
 *   5. 人民币轨 currency/rmb 描述符保持不变（金额与题干同源）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

require(path.join(ROOT, 'shared', 'svg', 'svg-core.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-geometry.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-currency.js'));
require(path.join(ROOT, 'shared', 'svg', 'svg-diagram.js'));
const SvgRegistry = require(path.join(ROOT, 'shared', 'presentation', 'svg-registry.js'));

// 度量（非人民币）KPs：长度 / 面积 / 质量
const METRIC_KPS = [
  'math-g2-up-u05-k001', // 认识厘米和米
  'math-g2-up-u05-k005', // 选择合适的长度单位
  'math-g3-down-u04-k002', // 常用面积单位
  'math-g3-down-u04-k004', // 面积单位间的进率
  'math-g3-up-u03-k001', // 常用长度单位
  'math-g3-up-u03-k002', // 长度单位进率
  'math-g3-up-u04-k002', // 质量单位
  'math-g3-up-u04-k003', // 单位适用场景
  'math-g3-up-u04-k004'  // 称重实践
];
// 人民币 KPs（currency/rmb 保留）
const RMB_KPS = ['math-g1-down-u07-k001', 'math-g1-down-u07-k002', 'math-g1-down-u07-k003'];

// 修复前的装饰图指纹：固定 8×3、不标注
function isLegacyDecoration(g) {
  return !!(g && g.type === 'geometry' && g.subtype === 'rectangle' &&
    g.params && g.params.width === 8 && g.params.height === 3 &&
    g.params.labelSides === false);
}

function gen(kp, qt, d, seed, count) {
  const req = { knowledgePointIds: [kp], questionTypeId: qt, difficulty: d, count: count || 2 };
  const sel = Selector.selectGenerator(req);
  const plan = SP.attachToPlan(Object.assign({}, req, { seed: seed }));
  return Generators.get(sel.generatorId).generate(plan, {});
}

/* ------------------------------------------------------------------ *
 * D4：面积应用题描述符尺寸 = 题干长宽，并标注边长
 * ------------------------------------------------------------------ */
test('P45-05 D4：面积应用题的 rectangle 尺寸与题干长宽一致且标注', () => {
  const KP = 'math-g3-down-u04-k004';
  const failures = [];
  [1, 2, 3, 4].forEach(function (d) {
    ['p45-05|a', 'p45-05|b', 'p45-05|c'].forEach(function (seed) {
      gen(KP, 'apply', d, seed, 3).forEach(function (q, i) {
        const tag = KP + '/apply/d' + d + '/' + seed + '#' + i;
        const m = /长方形长\s*(\d+)\s*厘米，宽\s*(\d+)\s*厘米/.exec(String(q.prompt));
        if (!m) { failures.push(tag + ' 题面缺长宽条件: ' + q.prompt); return; }
        const w = Number(m[1]), h = Number(m[2]);
        if (q.data.width !== w || q.data.height !== h) {
          failures.push(tag + ' data.width/height ' + q.data.width + '/' + q.data.height + ' ≠ 题面 ' + w + '/' + h); return;
        }
        const g = q.data && q.data.graphic;
        if (!g || g.type !== 'geometry' || g.subtype !== 'rectangle') {
          failures.push(tag + ' 描述符应为 geometry/rectangle，实为 ' + JSON.stringify(g)); return;
        }
        if (g.params.width !== w || g.params.height !== h) {
          failures.push(tag + ' params ' + g.params.width + '×' + g.params.height + ' ≠ 题面 ' + w + '×' + h); return;
        }
        if (g.params.labelSides !== true) { failures.push(tag + ' 题述边长应标注（labelSides=true）'); return; }
        const r = SvgRegistry.renderFor(g);
        if (r.status !== 'SUCCESS') { failures.push(tag + ' 渲染失败: ' + r.reason); return; }
        if (r.svg.indexOf(w + 'cm') === -1 || r.svg.indexOf(h + 'cm') === -1) {
          failures.push(tag + ' 图形未标注题述边长 ' + w + 'cm/' + h + 'cm');
        }
      });
    });
  });
  assert.deepEqual(failures, [], 'D4 面积图文一致失败:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * D5：每个非 geometry 行的图形字段与题干同源，且可渲染
 * ------------------------------------------------------------------ */
test('P45-05 D5：度量行图形与题干数值/单位同源（无装饰图、无零图形）', () => {
  const failures = [];
  METRIC_KPS.forEach(function (KP) {
    ['fill', 'choice', 'judge', 'calc', 'apply'].forEach(function (qt) {
      [1, 3].forEach(function (d) {
        gen(KP, qt, d, 'p45-05|d5', 3).forEach(function (q, i) {
          const tag = KP + '/' + qt + '/d' + d + '#' + i;
          const g = q.data && q.data.graphic;
          if (!g) { failures.push(tag + ' 缺图形（T2 graphicRole=auxiliary 要求配图）: ' + q.prompt); return; }
          if (isLegacyDecoration(g)) { failures.push(tag + ' 仍是固定 8×3 装饰矩形'); return; }
          const r = SvgRegistry.renderFor(g);
          if (r.status !== 'SUCCESS') { failures.push(tag + ' 渲染失败(' + g.type + '/' + g.subtype + '): ' + r.reason); return; }

          if (q.data.operation === 'conversion') {
            // 题面把原值原样写出（X 单位），图形必须标注同一数值与单位
            const numeric = String(q.data.value) + q.data.fromUnit;
            if (String(q.prompt).indexOf(numeric) === -1) {
              failures.push(tag + ' 题面未含 data.value+fromUnit(' + numeric + '): ' + q.prompt); return;
            }
            if (g.subtype === 'ruler') {
              if (Number(g.params.to) !== Number(q.data.value) || g.params.unit !== q.data.fromUnit) {
                failures.push(tag + ' ruler 刻度 ' + g.params.to + g.params.unit + ' ≠ 题干 ' + numeric); return;
              }
              if (r.svg.indexOf('单位：' + q.data.fromUnit) === -1) {
                failures.push(tag + ' ruler 未标注单位 ' + q.data.fromUnit);
              }
            } else if (g.subtype === 'rectangle') {
              if (Number(g.params.width) !== Number(q.data.value) || g.params.unit !== q.data.fromUnit) {
                failures.push(tag + ' rectangle 标注 ' + g.params.width + g.params.unit + ' ≠ 题干 ' + numeric); return;
              }
              if (r.svg.indexOf(numeric) === -1) failures.push(tag + ' rectangle 未标注 ' + numeric);
            } else if (g.subtype === 'weighing') {
              if (g.params.leftLabel !== numeric) {
                failures.push(tag + ' weighing leftLabel ' + g.params.leftLabel + ' ≠ 题干 ' + numeric); return;
              }
              if (g.params.rightLabel !== '? ' + q.data.toUnit) {
                failures.push(tag + ' weighing rightLabel ' + g.params.rightLabel + ' ≠ ? ' + q.data.toUnit); return;
              }
              if (r.svg.indexOf(numeric) === -1) failures.push(tag + ' weighing 未标注 ' + numeric);
              // 质量单位随题面变化，描述符不得写固定 unit/unitPx 占位
              if (g.params.unit != null || g.params.unitPx != null) {
                failures.push(tag + ' 质量描述符不应含固定 unit/unitPx: ' + JSON.stringify(g.params));
              }
            } else {
              failures.push(tag + ' 未知 subtype ' + g.subtype);
            }
          } else if (q.data.kind === 'mass' && q.data.m1 != null) {
            // 质量比较应用题：两盘各标题干给出的重量
            if (g.subtype !== 'weighing') { failures.push(tag + ' 质量应用题应挂 weighing，实为 ' + g.subtype); return; }
            if (g.params.leftLabel !== '大米 ' + q.data.m1 + ' 千克' ||
                g.params.rightLabel !== '面粉 ' + q.data.m2 + ' 千克') {
              failures.push(tag + ' weighing 标注与题干重量不一致: ' + JSON.stringify(g.params)); return;
            }
            if (r.svg.indexOf('大米 ' + q.data.m1 + ' 千克') === -1) {
              failures.push(tag + ' weighing 未标注大米重量');
            }
            if (g.params.unit != null || g.params.unitPx != null) {
              failures.push(tag + ' 质量描述符不应含固定 unit/unitPx: ' + JSON.stringify(g.params));
            }
          } else if (q.data.kind === 'length' && q.data.total != null) {
            // 长度应用题：刻度尺范围 = 题干总长
            if (g.subtype !== 'ruler') { failures.push(tag + ' 长度应用题应挂 ruler，实为 ' + g.subtype); return; }
            if (Number(g.params.to) !== Number(q.data.total)) {
              failures.push(tag + ' ruler 刻度范围 ' + g.params.to + ' ≠ 题干总长 ' + q.data.total);
            }
          }
        });
      });
    });
  });
  assert.deepEqual(failures, [], 'D5 图文同源失败:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * 作用域守卫：geometry 原生图形与 RMB currency 描述符不受影响
 * ------------------------------------------------------------------ */
test('P45-05 作用域：geometry 行保持 maker 原生图形', () => {
  const failures = [];
  ['math-g3-down-u04-k004', 'math-g3-down-u04-k002', 'math-g2-up-u05-k001'].forEach(function (KP) {
    gen(KP, 'geometry', 3, 'p45-05|geo', 2).forEach(function (q, i) {
      const g = q.data && q.data.graphic;
      if (!g || !g.type) failures.push(KP + '/geometry#' + i + ' 原生图形缺失');
      else if (SvgRegistry.renderFor(g).status !== 'SUCCESS') {
        failures.push(KP + '/geometry#' + i + ' 原生图形渲染失败');
      }
    });
  });
  assert.deepEqual(failures, [], 'geometry 原生图形回归:\n' + failures.join('\n'));
});

test('P45-05 作用域：人民币轨 currency/rmb 描述符与题干金额同源', () => {
  const failures = [];
  RMB_KPS.forEach(function (KP) {
    ['fill', 'choice', 'judge', 'apply', 'calc'].forEach(function (qt) {
      gen(KP, qt, 3, 'p45-05|rmb', 2).forEach(function (q, i) {
        const tag = KP + '/' + qt + '#' + i;
        const g = q.data && q.data.graphic;
        if (!g || g.type !== 'currency' || g.subtype !== 'rmb') {
          failures.push(tag + ' 人民币题应保留 currency/rmb 描述符，实为 ' + JSON.stringify(g)); return;
        }
        if (!Array.isArray(g.params.amounts) || g.params.amounts.length === 0) {
          failures.push(tag + ' currency 描述符缺 amounts'); return;
        }
        const r = SvgRegistry.renderFor(g);
        if (r.status !== 'SUCCESS') failures.push(tag + ' 渲染失败: ' + r.reason);
      });
    });
  });
  assert.deepEqual(failures, [], '人民币描述符回归:\n' + failures.join('\n'));
});
