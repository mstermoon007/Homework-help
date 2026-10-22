'use strict';

/**
 * tests/validator/p40-q10-explanation-quality.test.js — P40-Q-10 explanationQuality 维
 *
 * 层1 权重契约：七维 WEIGHTS —— 新增 explanationQuality 0.10，原六维等比 ×0.9，合计 1.0；
 * 层2 四判据单测：非空 / 非复述（旧模板负断言 + 算式补全正例）/ 含分步标记 / 答案一致；
 * 层3 真实生成面：concept-meaning（Q-09 四步解析）逐题 explanationQuality ∈ [0,1] 且
 *     total === Σ breakdown×weight（加权契约），分布汇总供 P40-Q-14 验收对比。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Scorer = require(path.join(ROOT, 'shared/validator/quality-scorer.js'));
const cmMod = require(path.join(ROOT, 'shared/generator/generators/concept-meaning.js'));

// Q-10 前六维权重（×0.9 后的期望值）
const LEGACY_SCALED = {
  correctness: 0.225,
  knowledgeAlignment: 0.18,
  difficultyAlignment: 0.135,
  structuralValidity: 0.135,
  renderability: 0.135,
  uniqueness: 0.09
};

function mkSq(extra) {
  return Object.assign({
    id: 'p40q10:sq',
    prompt: '3 + 5 = ?',
    knowledgePoint: 'math-g1-up-u01-k001',
    difficulty: 2,
    answerMode: 'input',
    answer: { value: '8', explanation: null }
  }, extra);
}

/* ------------------------------------------------------------------ *
 * 层1 权重契约
 * ------------------------------------------------------------------ */

test('P40-Q-10 L1 权重契约：新增 0.10 + 原六维等比 ×0.9 + 合计 1.0', () => {
  const w = Scorer.WEIGHTS;
  assert.equal(w.explanationQuality, 0.10, '新维权重应为 0.10');
  Object.keys(LEGACY_SCALED).forEach((k) => {
    assert.equal(w[k], LEGACY_SCALED[k], k + ' 应等比 ×0.9');
  });
  const sum = Object.keys(w).reduce((a, k) => a + w[k], 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, '权重合计应为 1.0，实得 ' + sum);
  assert.equal(Object.keys(w).length, 7, '应为七维');
});

/* ------------------------------------------------------------------ *
 * 层2 四判据单测
 * ------------------------------------------------------------------ */

test('P40-Q-10 L2 判据① 非空：无解析 → 0', () => {
  const s = Scorer.scoreQuestion(mkSq(), null, {});
  assert.equal(s.breakdown.explanationQuality, 0);
});

test('P40-Q-10 L2 四判据全命中（Q-09 calc 演算形态）→ 1', () => {
  const sq = mkSq({ answer: { value: '8', explanation: '3 + 5 = 8，所以答案是 8。' } });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 1);
});

test('P40-Q-10 L2 判据② 旧复述模板「题面，答案是 X」→ 0.75', () => {
  const sq = mkSq({ answer: { value: '8', explanation: '3 + 5 = ?，答案是 8。' } });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 0.75, '复述判据应失分');
});

test('P40-Q-10 L2 判据② 算式补全「= 8」非复述（题面等号收尾 + 尾巴恰为答案）', () => {
  const sq = mkSq({ answer: { value: '8', explanation: '3 + 5 = 8。' } });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 1, '演算完成不应判为复述');
});

test('P40-Q-10 L2 判据③ 无分步标记 → 0.75', () => {
  const sq = mkSq({
    prompt: '小明有多少个苹果？',
    answer: { value: '8个', explanation: '小明有 8 个苹果。' }
  });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 0.75, '无分步标记应失分');
});

test('P40-Q-10 L2 判据④ 答案不一致 → 0.75', () => {
  const sq = mkSq({ answer: { value: '9', explanation: '3 + 5 = 8，所以答案是 8。' } });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 0.75, '解析与答案不一致应失分');
});

test('P40-Q-10 L2 判据④ 答案缺失 → 0.75（一致性不可证）', () => {
  const sq = mkSq({ answer: { value: null, explanation: '3 + 5 = 8，所以答案是 8。' } });
  const s = Scorer.scoreQuestion(sq, null, {});
  assert.equal(s.breakdown.explanationQuality, 0.75);
});

/* ------------------------------------------------------------------ *
 * 层3 真实生成面（加权契约 + 分布采样）
 * ------------------------------------------------------------------ */

test('P40-Q-10 L3 真实生成面：加权契约 + explanationQuality 分布', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  const subs = ['number-concept', 'make-ten', 'bracket-order'];
  const qts = ['calc', 'fill', 'apply'];
  const items = [];
  subs.forEach((st, si) => {
    qts.forEach((qt) => {
      const out = gen.generate({
        questionTypeId: qt, count: 4, difficulty: 2,
        knowledgePointIds: ['p40-q10-probe-kp'],
        constraints: { numberRange: { min: 1, max: 20 } },
        semanticParams: { subTopic: st, name: st + '主题' },
        seed: 'p40q10:dist:' + si + ':' + qt
      }, { seed: 'p40q10:dist' });
      items.push.apply(items, out);
    });
  });
  assert.ok(items.length === 36, '应产出 36 题，实得 ' + items.length);

  const scored = items.map((sq) => Scorer.scoreQuestion(sq, null, {}));
  const dist = { '0': 0, '0.25': 0, '0.5': 0, '0.75': 0, '1': 0 };
  let sumEq = 0;
  scored.forEach((s, i) => {
    const eq = s.breakdown.explanationQuality;
    assert.ok(eq >= 0 && eq <= 1, '第 ' + i + ' 题 explanationQuality 越界: ' + eq);
    assert.ok(Object.prototype.hasOwnProperty.call(dist, String(eq)),
      '第 ' + i + ' 题 explanationQuality 应为四判据等权档位: ' + eq);
    dist[String(eq)]++;
    sumEq += eq;
    // 加权契约：total === Σ breakdown×weight
    const expect = Object.keys(Scorer.WEIGHTS).reduce(
      (a, k) => a + (s.breakdown[k] || 0) * Scorer.WEIGHTS[k], 0);
    assert.ok(Math.abs(s.total - expect) < 0.001, '第 ' + i + ' 题 total 加权契约不符');
  });
  // Q-09 四步解析落地后，真实解析不应有零分行（零分 = 无解析）
  assert.equal(dist['0'], 0, '真实生成面不应出现无解析零分行');
  assert.ok(sumEq / scored.length >= 0.75,
    'concept-meaning 解析均值应 ≥0.75，实得 ' + (sumEq / scored.length).toFixed(3));
});

/* ------------------------------------------------------------------ *
 * P42-6 判据④′：judge 布尔答案专用（解析结论词与答案一致；否定词优先）
 * ------------------------------------------------------------------ */

test('P42-6 L2 判据④′ judge 布尔正例：结论词与答案一致 → 0.75（③不可达上限）', () => {
  // true + 肯定结论词（实证形态「说法正确」）→ ④′命中
  const t = mkSq({ prompt: '判断对错——「立体图形都有长、宽、高」。这个说法对吗？',
    answer: { value: true, explanation: '「立体图形都有长、宽、高」——符合立体图形的知识，说法正确。' } });
  assert.equal(Scorer.scoreQuestion(t, null, {}).breakdown.explanationQuality, 0.75);
  // false + 否定结论词（实证形态「说法错误」）→ ④′命中
  const f = mkSq({ prompt: '平行四边形的特征是：「有10条边」—— 对还是错？',
    answer: { value: false, explanation: '「有10条边」不是平行四边形的特征，说法错误。' } });
  assert.equal(Scorer.scoreQuestion(f, null, {}).breakdown.explanationQuality, 0.75);
});

test('P42-6 L2 判据④′负例与回归保护：结论相反/无结论词不加分；非布尔仍走原④', () => {
  // 结论相反（value=true 但解析「错误」）→ ④′不命中 → 0.5
  const bad = mkSq({ answer: { value: true, explanation: '这个说法错误。' } });
  assert.equal(Scorer.scoreQuestion(bad, null, {}).breakdown.explanationQuality, 0.5);
  // 无结论词 → ④′不命中（诚实缺位不判对）→ 0.5
  const none = mkSq({ answer: { value: false, explanation: '平行四边形是四边形的一种。' } });
  assert.equal(Scorer.scoreQuestion(none, null, {}).breakdown.explanationQuality, 0.5);
  // 否定词优先：「不对」含「对」子串，先否定后肯定 → value=false 命中 → 0.75
  const neg = mkSq({ answer: { value: false, explanation: '这个说法不对。' } });
  assert.equal(Scorer.scoreQuestion(neg, null, {}).breakdown.explanationQuality, 0.75);
  // 非布尔答案仍走原④「解析含答案值子串」→ 1（回归保护，非 judge 行零变化）
  const num = mkSq({ answer: { value: '8', explanation: '3 + 5 = 8，所以答案是 8。' } });
  assert.equal(Scorer.scoreQuestion(num, null, {}).breakdown.explanationQuality, 1);
});

/* ------------------------------------------------------------------ *
 * P42-8 符号答案归一：normalizeExplText 补 < > ☆（watch A 类 9 行根因）
 * ------------------------------------------------------------------ */

test('P42-8 L2 符号答案：normAns 不再空串，解析含符号 → ④命中', () => {
  // fill 答案 '<'：解析含 '<' → ④命中（原字符集删 < → normAns 空串 → ④跳过 → 0.5）
  const lt = mkSq({ answer: { value: '<', explanation: '先比较两数大小，答案是 <。' } });
  assert.equal(Scorer.scoreQuestion(lt, null, {}).breakdown.explanationQuality, 1);
  // geometry 答案 '☆'：解析含 '☆' → ④命中；解析无③步骤词 → 0.75
  const star = mkSq({ answer: { value: '☆', explanation: '每 4 个一组，18 ÷ 4 余 2 → 「☆」' } });
  assert.equal(Scorer.scoreQuestion(star, null, {}).breakdown.explanationQuality, 0.75);
});
