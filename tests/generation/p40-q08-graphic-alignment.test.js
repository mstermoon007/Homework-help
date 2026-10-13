'use strict';

/**
 * tests/generation/p40-q08-graphic-alignment.test.js — P40-Q-08 图文配合打磨验证
 *
 * 层1  渲染契约：P40-Q-08 新增主题图形族（symmetry-grid / rotationDemo /
 *      translationDemo / reflectionDemo）经注册链渲染 SUCCESS（插件族装载顺序同
 *      tests/presentation/svg-contract-full.test.js）；
 * 层2  真实生成主题图：k002 补全轴对称 ×5 → symmetry-grid；k004 设计图案 →
 *      rotationDemo 族（apply 场景图槽三变换轮换）；k005 周长与面积 → rectangle/square
 *      （judge 命题材料图 + apply 场景图槽）；
 * 层3  图文一致抽检：descriptor 参数与题面已述条件逐一呼应（标注只复述题设，
 *      所求周长/面积数值不标）；
 * 层4  evidence 锚与真实生成一致：k002 五行 T2 锚（subtype=symmetry-grid +
 *      unitPx=25，P40-Q-08 方案 A 定向更新）与生成产出对账；
 * 层5  图形标签接通：themed 标签（对称轴格网/旋转演示）进入「观察下图（…）」题面。
 *
 * 回归面：视图 3 KP geometry 行纯文字契约由 p28-hollow-shape-themed.test.js 既有
 * 断言覆盖（P40-Q-08 守卫回退恢复 P38 冻结判例），本文件不重复。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');

/* ------------------------------------------------------------------ *
 * 层1 渲染契约（插件族 + 注册表，svg-contract-full 同款装载顺序）
 * ------------------------------------------------------------------ */

global.window = global;
['shared/svg/svg-core.js', 'shared/svg/svg-geometry.js', 'shared/svg/svg-calculation.js',
  'shared/svg/svg-make-ten.js', 'shared/svg/svg-chart.js', 'shared/svg/svg-diagram.js',
  'shared/svg/svg-currency.js', 'plugins/svg-clock.js', 'plugins/svg-area.js',
  'plugins/svg-fraction.js', 'plugins/svg-data-stats.js', 'plugins/svg-draw.js'
].forEach(function (rel) { require(path.join(ROOT, rel)); });
require(path.join(ROOT, 'shared/presentation/svg-sanitizer.js'));
const SVGRegistry = require(path.join(ROOT, 'shared/presentation/svg-registry.js'));
SVGRegistry.seedFromGlobal();

function assertRenderSuccess(type, subtype, params, tag) {
  const r = SVGRegistry.render({ type: type, subtype: subtype, params: params });
  assert.equal(r.status, 'SUCCESS', tag + ' 应渲染 SUCCESS，得: ' + r.status + ' ' + (r.reason || ''));
  assert.ok(typeof r.svg === 'string' && r.svg.indexOf('<svg') === 0, tag + ' 应产出 SVG');
}

test('P40-Q-08 渲染契约：主题图形族四子类型 SUCCESS', () => {
  assertRenderSuccess('geometry', 'symmetry-grid', {
    gridW: 7, gridH: 4, axisX: 4, points: [[1, 2]], unit: 'cm', unitPx: 25
  }, 'symmetry-grid');
  assertRenderSuccess('geometry', 'rotationDemo', {
    points: [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5]], cx: 0, cy: 0, deg: 90, unitPx: 34, unit: 'cm'
  }, 'rotationDemo');
  assertRenderSuccess('geometry', 'translationDemo', {
    points: [[0, 0], [1, 0], [1, 1], [0, 1]], dx: 2, dy: 0, unitPx: 34, unit: 'cm'
  }, 'translationDemo');
  assertRenderSuccess('geometry', 'reflectionDemo', {
    points: [[0, 0], [2, 0], [1, 1.5]], axis: 'y', unitPx: 34, unit: 'cm'
  }, 'reflectionDemo');
});

/* ------------------------------------------------------------------ *
 * 层2/3/5 真实生成：主题图 + 图文一致 + 图形标签
 * ------------------------------------------------------------------ */

require(path.join(ROOT, 'dev', '_bundle-env.js')); // 副作用导入：全局 StrategyEngine 等（勿删）
const Generators = require(path.join(ROOT, 'shared/generator/generators/index.js'));
const SP = require(path.join(ROOT, 'shared/generator/core/semantic-parameters.js'));

const SHAPE = 'generator:shape-recognition';
const QTS = ['fill', 'choice', 'judge', 'geometry', 'apply'];

function gen3(kp, qt, seedTag) {
  const gen = Generators.get(SHAPE);
  assert.ok(gen, 'shape-recognition 实例存在');
  const plan = SP.attachToPlan({
    knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 3,
    seed: 'p40q08:' + seedTag
  });
  return gen.generate(plan, {});
}

test('P40-Q-08 k002 补全轴对称：五题型挂 symmetry-grid + 标签进题面', () => {
  const KP = 'math-g4-down-u07-k002';
  QTS.forEach(function (qt) {
    const qs = gen3(KP, qt, 'k002:' + qt);
    assert.equal(qs.length, 3, KP + '/' + qt + ' 产出 3 题');
    qs.forEach(function (q, i) {
      const g = q.data.graphic;
      assert.ok(g, qt + '#' + i + ' 应挂图');
      assert.equal(g.type, 'geometry');
      assert.equal(g.subtype, 'symmetry-grid', qt + '#' + i + ' 应为对称轴格网');
      assert.equal(g.role, 'number-position');
      assert.equal(g.params.unit, 'cm');
      assert.equal(g.params.unitPx, 25);
      // 图文一致：格网参数在场且轴右侧无点（对应侧是所求，画即泄题）
      assert.ok(g.params.gridW > g.params.axisX, qt + '#' + i + ' 对称轴在格网内');
      (g.params.points || []).forEach(function (p) {
        assert.ok(p[0] < g.params.axisX, qt + '#' + i + ' 关键点只画原侧');
      });
      // 标签接通：geometry/choice「观察下图（对称轴格网）」题面（层5）
      if (qt === 'geometry') {
        assert.ok(/观察下图（对称轴格网）/.test(q.prompt), '题面应含主题图形标签: ' + q.prompt);
      }
    });
  });
});

test('P40-Q-08 k004 设计图案：变换演示族（apply 场景图三变换轮换）', () => {
  const KP = 'math-g5-down-u05-k004';
  ['fill', 'choice', 'judge', 'geometry'].forEach(function (qt) {
    const qs = gen3(KP, qt, 'k004:' + qt);
    qs.forEach(function (q, i) {
      const g = q.data.graphic;
      assert.ok(g, qt + '#' + i + ' 应挂图');
      assert.equal(g.subtype, 'rotationDemo', qt + '#' + i + ' 旋转次数/判断/观察行应配旋转演示');
      assert.equal(g.params.deg % 30, 0, qt + '#' + i + ' deg 与题设角度同族');
    });
  });
  const applies = gen3(KP, 'apply', 'k004:apply');
  const seen = new Set();
  applies.forEach(function (q, i) {
    const g = q.data.graphic;
    assert.ok(g, 'apply#' + i + ' 场景图应在场');
    assert.ok(['rotationDemo', 'translationDemo', 'reflectionDemo'].indexOf(g.subtype) !== -1,
      'apply#' + i + ' 应为变换演示族，得: ' + g.subtype);
    seen.add(g.subtype);
    assert.equal(g.params.unit, 'cm');
  });
  assert.ok(seen.size >= 2, '场景图槽应轮换多种变换演示，得: ' + [...seen].join(','));
});

test('P40-Q-08 k005 周长与面积：rectangle/square 同名图 + 标注只复述题设', () => {
  const KP = 'math-g3-down-u04-k005';
  ['fill', 'choice', 'geometry'].forEach(function (qt) {
    const qs = gen3(KP, qt, 'k005:' + qt);
    qs.forEach(function (q, i) {
      const g = q.data.graphic;
      assert.ok(g, qt + '#' + i + ' 应挂图');
      assert.ok(['rectangle', 'square'].indexOf(g.subtype) !== -1,
        qt + '#' + i + ' 应为题设同名图形，得: ' + g.subtype);
      assert.equal(g.params.unit, 'cm');
    });
  });
  // judge：命题材料图（长方形，标注为主张材料不遮口径）
  const judges = gen3(KP, 'judge', 'k005:judge');
  judges.forEach(function (q, i) {
    const g = q.data.graphic;
    assert.ok(g && g.subtype === 'rectangle', 'judge#' + i + ' 应配长方形命题材料图');
  });
  // apply：场景图槽与情境逐条呼应（小棒围形/边长4正方形/长6宽2长方形）
  const applies = gen3(KP, 'apply', 'k005:apply');
  applies.forEach(function (q, i) {
    const g = q.data.graphic;
    assert.ok(g && ['rectangle', 'square'].indexOf(g.subtype) !== -1, 'apply#' + i + ' 应配场景同名图');
  });
});

test('P40-Q-08 图文一致抽检：descriptor 参数与题面已述条件呼应', () => {
  // k005 fill：题面「长 6 厘米、宽 2 厘米」↔ params {width:6,height:2}；所求面积值不标
  const fills = gen3('math-g3-down-u04-k005', 'fill', 'k005:align');
  const q0 = fills[0];
  assert.ok(/长 6 厘米、宽 2 厘米/.test(q0.prompt), '第一条题面应为 6×2 长方形');
  assert.equal(q0.data.graphic.params.width, 6);
  assert.equal(q0.data.graphic.params.height, 2);
  const svg = SVGRegistry.render(q0.data.graphic).svg;
  assert.ok(svg.indexOf('>12<') === -1, '所求面积 12 不得标注进图（泄题）');
  // k002 fill：题面「距离是 3 格」↔ 关键点到 axisX 距离 3
  const k002fill = gen3('math-g4-down-u07-k002', 'fill', 'k002:align');
  const m = k002fill[0].prompt.match(/距离是 (\d+) 格/);
  assert.ok(m, 'k002 题面应含格距条件');
  const kp = k002fill[0].data.graphic.params;
  const pt = kp.points[0];
  assert.equal(kp.axisX - pt[0], Number(m[1]), '关键点到对称轴格数必须与题面一致');
});

/* ------------------------------------------------------------------ *
 * 层4 evidence 锚与真实生成一致（方案 A 定向更新对账）
 * ------------------------------------------------------------------ */

test('P40-Q-08 k002 T2 evidence 锚（subtype=symmetry-grid + unitPx=25）与生成一致', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl/teaching/evidence-rules.json'), 'utf8'));
  const KP = 'math-g4-down-u07-k002';
  function fieldRead(sq, p) {
    return p.split('.').reduce(function (c, k) { return c == null ? undefined : c[k]; }, sq);
  }
  QTS.forEach(function (qt) {
    const rule = rules.rules.find(function (r) { return r.knowledgePointId === KP && r.questionType === qt; });
    assert.ok(rule, KP + '/' + qt + ' evidence 规则行存在');
    const gAsserts = (rule.required || []).filter(function (a) { return /data\.graphic/.test(a.path); });
    assert.ok(gAsserts.length >= 3, qt + ' 行应保留图形锚');
    // 方案 A 更新后：labelSides 存在性锚不得残留（symmetry-grid 无该字段）
    assert.ok(!gAsserts.some(function (a) { return a.kind === 'fieldPresent' && /labelSides/.test(a.path); }),
      qt + ' 行不得再锚 labelSides');
    // 锚值与真实生成逐条对账（fieldEquals 同口径）
    const qs = gen3(KP, qt, 'k002:ev:' + qt);
    qs.forEach(function (q, i) {
      const g = q.data.graphic;
      gAsserts.forEach(function (a) {
        if (a.kind === 'field') {
          assert.deepEqual(fieldRead({ data: { graphic: g } }, a.path), a.value,
            qt + '#' + i + ' 锚 ' + a.path + '=' + JSON.stringify(a.value) + ' 应与生成一致');
        }
      });
    });
  });
});
