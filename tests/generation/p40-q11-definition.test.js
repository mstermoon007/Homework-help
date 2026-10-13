'use strict';

/**
 * tests/generation/p40-q11-definition.test.js — P40-Q-11 解析引用 KBL definition
 *
 * 层1  SemanticParameters.resolve definition 投影：T3 semantic.concept 逐字镜像 +
 *      name 兜底守卫（concept===name → null，防名称冒充定义）；
 * 层2  生成器消费双证据（读信号 + 产出变化）：angle/area 的 judge/choice/fill/geometry
 *      定义连接位解析含 definition 逐字子串，judge 统一「判断依据」模板；
 * 层3  诚实退化负断言：definition 缺失（未附 semanticParams）回退既有形态不编造；
 *      makeByItem 8 builder choice 裸句保持既有诚实形态（本任务不机械扫）；
 * 层4  R20 机判回放 + 悬垂标点/句号收尾/非复述（触达行）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev/_bundle-env.js'));
const SP = require(path.join(ROOT, 'shared/generator/core/semantic-parameters.js'));
const cmMod = require(path.join(ROOT, 'shared/generator/generators/concept-meaning.js'));
const { gradeUserAnswer } = require(path.join(ROOT, 'shared/validator/answer-validator.js'));

const ANGLE_KP = 'math-g3-up-u07-k002';   // 角的认识
const AREA_KP = 'math-g3-down-u04-k001';  // 面积的认识
const ANGLE_DEF = '从一点引出两条射线所组成的图形叫做角，角的各部分名称：顶点、边。';
const AREA_DEF = '物体表面或封闭图形的大小';

// P40-T-08：解析承上启下三段模板会为有同族前序的 KP 前置「我们之前学过〈…〉…结合起来看：」桥接句。
// 该桥接句逐字引用 canonical 前序，不改变本题定义引用契约；断言前剥离可选桥接前缀。
const BRIDGE_RE = /^我们之前学过〈[^〉]+〉(（[^）]*）)?。把〈[^〉]+〉和〈[^〉]+〉结合起来看：/;
function stripBridge(s) { return String(s || '').replace(BRIDGE_RE, ''); }

function mkPlan(kpId, qt, seed, def) {
  const plan = {
    questionTypeId: qt, count: 3, difficulty: 2,
    knowledgePointIds: [kpId],
    constraints: { numberRange: { min: 1, max: 20 } },
    seed: seed,
    semanticParams: (def === undefined) ? SP.resolve(kpId, qt) : def
  };
  return plan;
}

/* ------------------------------------------------------------------ *
 * 层1 resolve definition 投影
 * ------------------------------------------------------------------ */

test('P40-Q-11 L1 resolve definition：T3 逐字镜像 + name 兜底守卫', () => {
  // 真实 KP：definition 非空、≠ name、与 runtime 镜像 semantic.concept 逐字一致
  [[ANGLE_KP, ANGLE_DEF], [AREA_KP, AREA_DEF]].forEach(([kpId, expectDef]) => {
    const r = SP.resolve(kpId, 'judge');
    assert.ok(r, kpId + ' resolve 有结果');
    assert.equal(r.definition, expectDef, kpId + ' definition 逐字等于 T3 semantic.concept');
    assert.notEqual(r.definition, r.name, kpId + ' definition ≠ name（兜底形态已剔除）');
    const kc = global.KnowledgeContext.get(kpId);
    assert.equal(r.definition, kc.semantic.concept, kpId + ' 与运行时镜像逐字一致');
  });
  // name 兜底守卫：concept===name → null；concept 缺失 → null
  const factory = SP.createSemanticParameterResolver;
  const fakeKp = (concept) => ({ name: '某知识点', semantic: { concept: concept } });
  assert.equal(factory({ getKp: () => fakeKp('某知识点') }).resolve('x', 'calc').definition, null,
    'concept===name 兜底形态 → null');
  assert.equal(factory({ getKp: () => fakeKp(null) }).resolve('x', 'calc').definition, null,
    'concept 缺失 → null');
  assert.equal(factory({ getKp: () => fakeKp('真实的定义文本。') }).resolve('x', 'calc').definition,
    '真实的定义文本。', 'concept 独立于 name → 逐字透出');
});

/* ------------------------------------------------------------------ *
 * 层2 生成器消费双证据（definition 连接位逐字引用）
 * ------------------------------------------------------------------ */

test('P40-Q-11 L2 judge：判断依据模板 + definition 逐字引用（角/面积全 item 扫描）', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  [[ANGLE_KP, ANGLE_DEF, 'angle'], [AREA_KP, AREA_DEF, 'area']].forEach(([kpId, def, tag]) => {
    const seenDefItem = [];
    for (let s = 0; s < 30; s++) {
      const out = gen.generate(mkPlan(kpId, 'judge', 'p40q11:' + tag + ':j:' + s), { seed: 'p40q11j' });
      out.forEach((q) => {
        const ex = String(q.answer.explanation || '');
        assert.ok(stripBridge(ex).startsWith('判断依据：'), tag + ' judge 解析统一判断依据模板：' + ex);
        assert.ok(!/[，、；：]$/.test(ex), tag + ' judge 无悬垂标点：' + ex);
        // 定义判断项（题面即定义句）的解析必含 definition 逐字原文
        if (q.data.statement && q.data.statement.indexOf(def.slice(0, 6)) !== -1 &&
            /定义|叫做/.test(q.data.statement)) {
          seenDefItem.push(ex);
          assert.ok(ex.indexOf(def) !== -1, tag + ' 定义项解析含 definition 逐字原文：' + ex);
          assert.ok(!/就是角，|叫做它们的面积，说法正确。$/.test(ex.replace(def, '')),
            tag + ' 无手写编造尾巴：' + ex);
        }
      });
    }
    assert.ok(seenDefItem.length >= 3, tag + ' 30 seed 覆盖定义判断项（实得 ' + seenDefItem.length + '）');
  });
});

test('P40-Q-11 L2 choice/fill/geometry：依据定义前缀 + 逐字引用（角/面积）', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  // 角 choice：定义项解析含逐字 definition
  const aChoice = gen.generate(mkPlan(ANGLE_KP, 'choice', 'p40q11:a:c'), { seed: 'p40q11c' });
  aChoice.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(stripBridge(ex).startsWith('依据定义：'), '角 choice 依据定义前缀：' + ex);
    assert.ok(ex.indexOf(ANGLE_DEF) !== -1, '角 choice 含 definition 逐字原文：' + ex);
    assert.ok(ex.indexOf('正确选项是') !== -1, '角 choice 保留指认尾：' + ex);
  });
  // 面积 fill：definition 逐字 + 应用句（旧「叫作面积」编造尾巴不再出现于逐字引用形态）
  const aFill = gen.generate(mkPlan(AREA_KP, 'fill', 'p40q11:a:f'), { seed: 'p40q11f' });
  aFill.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(stripBridge(ex).startsWith('依据定义：'), '面积 fill 依据定义前缀：' + ex);
    assert.ok(ex.indexOf(AREA_DEF) !== -1, '面积 fill 含 definition 逐字原文：' + ex);
    assert.ok(ex.indexOf('空格填面积') !== -1, '面积 fill 保留归因尾：' + ex);
  });
  // 面积 choice：定义前缀 + 单位应用
  const aAreaChoice = gen.generate(mkPlan(AREA_KP, 'choice', 'p40q11:a:ac'), { seed: 'p40q11ac' });
  aAreaChoice.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(stripBridge(ex).startsWith('依据定义：'), '面积 choice 依据定义前缀：' + ex);
    assert.ok(ex.indexOf(AREA_DEF) !== -1, '面积 choice 含 definition 逐字原文：' + ex);
  });
  // geometry 两行：依据 + 所以 结构（图形特征腿，无定义引用——性质不引定义）
  const aGeo = gen.generate(mkPlan(ANGLE_KP, 'geometry', 'p40q11:a:g'), { seed: 'p40q11g' });
  aGeo.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(stripBridge(ex).startsWith('依据：'), '角 geometry 依据前缀：' + ex);
    assert.ok(ex.indexOf('所以') !== -1, '角 geometry 含所以结论：' + ex);
  });
  const arGeo = gen.generate(mkPlan(AREA_KP, 'geometry', 'p40q11:ar:g'), { seed: 'p40q11rg' });
  arGeo.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(stripBridge(ex).startsWith('依据：'), '面积 geometry 依据前缀：' + ex);
    assert.ok(ex.indexOf('所以面积最大的是') !== -1, '面积 geometry 含所以结论：' + ex);
    assert.ok(ex.indexOf(String(q.answer.value)) !== -1, '面积 geometry 答案一致：' + ex);
  });
});

/* ------------------------------------------------------------------ *
 * 层3 诚实退化负断言
 * ------------------------------------------------------------------ */

test('P40-Q-11 L3 definition 缺失：回退既有形态不编造 + makeByItem choice 裸句不回归', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  // 未附 semanticParams（definition undefined）→ 角 judge 定义项回退既有诚实文本
  const fallback = gen.generate(mkPlan(ANGLE_KP, 'judge', 'p40q11:fb', undefined), { seed: 'p40q11fb' });
  fallback.forEach((q) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(ex.length > 0, 'definition 缺失解析非空');
    assert.ok(!ex.startsWith('判断依据：依据定义'), '不编造空定义引用：' + ex);
  });
  // makeByItem 8 builder choice：既有裸句形态保持（why 素材工程挂账，不在本任务机械扫）
  const SUBS = ['number-concept', 'negative-number', 'multdiv-relation', 'algebra-letter',
    'number-theory', 'make-ten', 'bracket-order', 'stepwise-format'];
  SUBS.forEach((st) => {
    const plan = mkPlan('probe-kp', 'choice', 'p40q11:mb:' + st,
      { subTopic: st, name: st + '主题' });
    const out = gen.generate(plan, { seed: 'p40q11mb' });
    out.forEach((q, i) => {
      const ex = String(q.answer.explanation || '');
      assert.equal(ex, '正确选项是「' + q.answer.value + '」',
        st + ' v' + i + ' 裸句形态不回归（诚实退化）：' + ex);
    });
  });
});

/* ------------------------------------------------------------------ *
 * 层4 R20 机判回放 + 表达规范（触达行）
 * ------------------------------------------------------------------ */

test('P40-Q-11 L4 R20 机判回放 + 非复述', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  const ALL = [];
  [[ANGLE_KP, 'angle'], [AREA_KP, 'area']].forEach(([kpId, tag]) => {
    ['choice', 'judge', 'fill', 'geometry'].forEach((qt) => {
      for (let s = 0; s < 6; s++) {
        const out = gen.generate(mkPlan(kpId, qt, 'p40q11:r20:' + tag + ':' + qt + ':' + s), { seed: 'p40q11r20' });
        out.forEach((q) => ALL.push({ q: q, tag: tag + '×' + qt }));
      }
    });
  });
  assert.ok(ALL.length >= 60, '回放样本充足（' + ALL.length + '）');
  ALL.forEach(({ q, tag }) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(ex.length > 0, tag + ' 解析非空');
    assert.ok(!/[，、；：]$/.test(ex), tag + ' 无悬垂标点：' + ex);
    // 非复述：解析不得整体包含题面（judge 题面含判断对错前缀，choice/fill 题面为问句）
    const normP = String(q.prompt).replace(/[\s，。：:（）()？?、]/g, '');
    const normE = ex.replace(/[\s，。：:（）()？?、]/g, '');
    assert.ok(normE.indexOf(normP) === -1, tag + ' 解析非题面复述：' + ex);
    // R20：正确答案机判通过（judge/choice/fill 必 true；geometry 填空同 fill 口径）
    const r = gradeUserAnswer(q, q.answer.value, {});
    assert.ok(r === true || r === null, tag + ' 机判回放 true/null（实得 ' + r + '）：' + q.answer.value);
  });
});
