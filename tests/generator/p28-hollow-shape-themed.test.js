'use strict';

/**
 * tests/generator/p28-hollow-shape-themed.test.js — P28-HOLLOW-02 shape-flat 空心全修
 *
 * 背景：空心探针打标 263 行高置信 shape-flat 空心 / 66 KP
 * （全部由 generator:shape-recognition 承载，几何认识/度量/运动类）。修复方式为
 * shape.js 内 SHAPE_THEME 主题化分派：66 KP × choice/judge/fill/geometry/apply
 * 统一走 makeThemedShapeQuestion（教学素材题面/答案），不落 flat 随机认图模板。
 * P28-HOLLOW-04：补 4 个 BORDERLINE KP（g3-up-u01-k002 反推观察角、
 * g3-up-u07-k003 角的度量初步、g4-up-u02-k002 角的度量、g6-up-u04-k004
 * 利用圆设计图案）共 20 行，66→70 KP、263→283 行，新增形态族 18。
 *
 * 冻结不变量：
 *   1. SHAPE_THEME 恰覆盖 70 KP；matrix 中 70 KP × 五题型行 ≥ 探针的 283 行。
 *   2. maker 真实产出（count=3）：题面不命中 SHAPE_FLAT 模板、含 KP 名前缀语义、
 *      指纹两两互异（choice/fill 靠互异 operands，judge/geometry/apply 靠题面哈希）、
 *      judge 假命题必带 data.misconception；证据包络保持（mode=graphic/shapeName/
 *      steps；不挂 data.operation——g5-down-u09-k001/k002 FORBID 算术 operation）。
 *   3. PracticeSession E2E（冻结 seed 抽样 6 族）元数据 generator = shape-recognition，
 *      题面同样不落 SHAPE_FLAT。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js')); // 副作用导入：注册全局 StrategyEngine 等，E2E PracticeSession 依赖（勿删）
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
const KpSem = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const Dup = require(path.join(ROOT, 'shared', 'validator', 'duplicate-validator.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const SHAPE = 'generator:shape-recognition';
const THEMED_QTS = ['choice', 'judge', 'fill', 'geometry', 'apply'];

// 探针同款 flat 模板指纹（修复后必须零命中）
const SHAPE_FLAT = /请写出该图形的名称|观察图中的图形，写出它的名称|图中画了一个图形，它叫什么名字|图中共有几个|下列哪个图形属于|下列哪个是.{0,6}的特征|的特征是：|图中显示的是什么角|下列哪个图形属于角|在教室里找一找|先说一说它是谁/;

// SHAPE_THEME 66 KP 以 shape.js 表为 SSOT（正则取键，测试内不另存清单防漂移）
const shapeSrc = fs.readFileSync(path.join(ROOT, 'shared', 'generator', 'generators', 'shape.js'), 'utf8');
const themeBlock = /var SHAPE_THEME = \{([\s\S]*?)\n\};/.exec(shapeSrc)[1];
const THEMED_KPS = new Set();
themeBlock.replace(/'(math-[^']+)':\s*shapeTheme\(/g, function (_, id) { THEMED_KPS.add(id); return _; });

const matrix = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared', 'knowledge', 'mappings', 'generation-contract', 'math.json'), 'utf8'));
const ROWS = matrix.mappings.filter(function (r) {
  return THEMED_KPS.has(r.knowledgeId) && THEMED_QTS.indexOf(r.questionType) !== -1;
});

function gradeOf(kp) { return Number(/^math-g(\d)-/.exec(kp)[1]); }

/* ---------------- 0. 覆盖面对账 ---------------- */

test('覆盖：SHAPE_THEME 恰 70 KP，matrix 主题行不少于探针 283 行', () => {
  assert.equal(THEMED_KPS.size, 70, 'SHAPE_THEME 应恰覆盖 70 KP（66 + HOLLOW-04 补 4），实际 ' + THEMED_KPS.size);
  assert.ok(ROWS.length >= 283, '70 KP × 五题型行应 ≥ 283（263 探针空心行 + 20 BORDERLINE 行），实际 ' + ROWS.length);
});

/* ---------------- 1. 选择器路由（抽样对账，全量由探针复核收口） ---------------- */

test('selector：主题行路由 shape-recognition（match 全 1）', () => {
  let routed = 0;
  ROWS.forEach(function (r) {
    const plan = { knowledgePointIds: [r.knowledgeId], questionTypeId: r.questionType, difficulty: 3, count: 1 };
    const sel = Selector.selectGenerator(plan);
    if (sel.generatorId === SHAPE) {
      routed++;
      assert.deepEqual(sel.match, { kp: 1, capability: 1, questionType: 1 },
        r.knowledgeId + ' / ' + r.questionType + ' match 应全 1');
    }
  });
  // 探针实测 283 行 gen 全为 shape-recognition；此处对账路由命中率不回落
  assert.ok(routed >= 283, '路由到 shape-recognition 的主题行应 ≥ 283，实际 ' + routed);
});

/* ---------------- 2. 主题化 maker 产出/契约/语义/去重 ---------------- */

test('maker：不落 flat 模板、含 KP 名、契约通过、指纹互异、judge 假命题带误区', () => {
  const gen = Generators.get(SHAPE);
  assert.ok(gen, 'shape-recognition 实例存在');

  ROWS.forEach(function (r) {
    const kp = r.knowledgeId, qt = r.questionType;
    const plan = SP.attachToPlan({
      knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 3,
      seed: 'p28-hollow-02:' + kp + ':' + qt
    });
    const kpName = (plan.semanticParams && plan.semanticParams.name) || '';
    const qs = gen.generate(plan, {});
    assert.equal(qs.length, 3, kp + ' / ' + qt + ' 产出 3 题');

    const fps = new Set();
    qs.forEach(function (q, idx) {
      const tag = kp + ' / ' + qt + ' #' + idx;
      assert.equal(q.questionType, qt, tag + ' 题型回显');
      assert.equal(q.knowledgePointId, kp, tag + ' KP 回显');

      // 不落 flat 模板 + 题面含 KP 名语义
      assert.ok(!SHAPE_FLAT.test(String(q.prompt)), tag + ' 不得命中 flat 模板: ' + q.prompt);
      assert.ok(kpName && String(q.prompt).indexOf(kpName) !== -1, tag + ' 题面应含 KP 名「' + kpName + '」: ' + q.prompt);
      assert.ok(q.answer && q.answer.value !== '' && q.answer.value != null, tag + ' 答案非空');

      // 证据包络：mode/graphic/shapeName/steps 保持，不挂算术 operation
      assert.ok(q.data && q.data.mode === qt, tag + ' data.mode 回显');
      assert.ok(q.data.graphic && q.data.graphic.type, tag + ' graphic 在场');
      assert.ok(q.data.shapeName, tag + ' shapeName 在场');
      assert.equal(q.data.steps, qt === 'apply' ? 2 : 1, tag + ' steps');
      assert.ok(q.data.operation === undefined, tag + ' 不得挂 data.operation');

      // judge 假命题必带误区（p25-07 教学闭环）
      if (qt === 'judge' && q.answer.value === false) {
        assert.ok(q.data.misconception, tag + ' 假命题必带 data.misconception');
      }

      // TypeContract
      const tv = TC.check(qt, q);
      assert.ok(tv.ok, tag + ' TypeContract: ' + JSON.stringify(tv.violations));

      // 去重指纹（同批 3 题两两互异）
      const fp = Dup.buildQuestionFingerprint(q);
      assert.ok(!fps.has(fp), tag + ' 指纹互异: ' + fp);
      fps.add(fp);

      // KpSemantic 证据（抽样 i=0 控时）
      if (idx === 0) {
        const kv = KpSem.validateKpSemantics(q, {
          plan: { knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 1 },
          kpId: kp
        });
        assert.ok(kv.valid, tag + ' KpSemantic: ' + JSON.stringify(kv.violations || kv.errors));
      }
    });
  });
});

/* ---------------- 3. PracticeSession E2E（冻结 seed，18 形态族抽样 9 行） ---------------- */

const E2E_ROWS = [
  ['math-g1-up-u03-k001', 'judge'],    // 立体图形特征
  ['math-g3-up-u03-k003', 'choice'],   // 毫米/分米/千米度量
  ['math-g5-down-u09-k001', 'choice'], // 正方体涂色（FORBID 算术 operation）
  ['math-g6-down-u03-k001', 'fill'],   // 圆柱度量
  ['math-g3-down-u08-k006', 'apply'],  // 复习·重叠问题
  ['math-g4-down-u05-k001', 'geometry'],// 三角形族
  ['math-g3-up-u01-k002', 'choice'],   // 族2·反推观察角（HOLLOW-04）
  ['math-g4-up-u02-k002', 'geometry'], // 族18·角的度量（HOLLOW-04）
  ['math-g6-up-u04-k004', 'apply']     // 族6·利用圆设计图案（HOLLOW-04）
];

E2E_ROWS.forEach(function (row) {
  test('E2E：' + row[0] + ' / ' + row[1] + ' 由 shape-recognition 出主题题', async () => {
    const kp = row[0], qt = row[1];
    const session = new PracticeSession({
      subject: 'math', grade: gradeOf(kp), count: 1, difficulty: 3,
      knowledgePointId: kp, questionType: qt,
      seed: 'freeze:p28-v1|' + kp + '|' + qt + '|d3'
    });
    await session.start();
    const q = (session.semanticQuestions || [])[0];
    assert.ok(q, kp + ' / ' + qt + ' E2E 有产出');
    assert.equal(q.metadata && q.metadata.generator, SHAPE, kp + ' / ' + qt + ' E2E producer');
    assert.equal(q.questionType, qt);
    assert.equal(q.knowledgePointId, kp);
    assert.ok(!SHAPE_FLAT.test(String(q.prompt)), kp + ' / ' + qt + ' E2E 不落 flat: ' + q.prompt);
    assert.ok(TC.check(qt, q).ok, kp + ' / ' + qt + ' E2E TypeContract');
  });
});
