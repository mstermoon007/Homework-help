'use strict';

/**
 * tests/generator/p25-07-type-contracts.test.js — P25-07 七题型教育契约
 *
 * 冻结不变量：
 *   1. 契约 SSOT ↔ 执行层对齐：type-contracts.json 的 contracts[].invariants /
 *      invariantKinds / conversion(form-bound) 与 type-contract.js 的
 *      CONTRACT_MAP / INVARIANT_IDS / FORM_BOUND 完全一致。
 *   2. 不变式判定（声明制）：calc 无算式 → 违例；choice 选项/答案脱节 → 违例；
 *      judge 非布尔答案 → 违例；fill 无空位 → 违例；apply 无情境 → 违例。
 *   3. fail-closed：form-bound 题型（calc/geometry/classify）不合规 → drop（无 finisher）。
 *   4. convertible 机械转换（finisher）：choice 索引约定/数值选项 → 值约定字符串选项；
 *      judge 裸布尔 → { value: boolean }（不得串化）；fill 缺空位 → 追加。
 *   5. 裸值答案归一：answer 为裸 string/number/boolean → { value, acceptable: [] }。
 *   6. 验证器第 9 检查：无契约题型 skip / 合规 pass / 违例 fail（KP_TYPE_CONTRACT, ERROR）。
 *   7. selector form-bound 声明门：calc 计划候选必须声明 calc（未声明者不入候选）。
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const TC = require(path.join(ROOT, 'shared', 'generator', 'core', 'type-contract.js'));
const ContractDoc = require(path.join(ROOT, 'kbl', 'teaching', 'type-contracts.json'));
const KpSemantic = require(path.join(ROOT, 'shared', 'validator', 'kp-semantic-validator.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));

before(() => {});

function sq(qt, extra) {
  return Object.assign({ knowledgePointIds: ['math-g1-down-u02-k001'], questionType: qt, prompt: '', data: {} }, extra || {});
}

/* ---------------- 1. SSOT ↔ 执行层对齐 ---------------- */

test('契约对齐：JSON contracts 与 code CONTRACT_MAP 同集合同不变式', () => {
  const json = {};
  ContractDoc.contracts.forEach(c => { json[c.questionType] = c; });
  assert.deepEqual(Object.keys(TC.CONTRACT_MAP).sort(), Object.keys(json).sort());
  Object.keys(TC.CONTRACT_MAP).forEach(qt => {
    assert.deepEqual(
      TC.CONTRACT_MAP[qt].slice().sort(),
      json[qt].invariants.slice().sort(),
      qt + ' 不变式漂移'
    );
  });
});

test('契约对齐：invariantKinds 与 INVARIANT_IDS 同集合', () => {
  assert.deepEqual(Object.keys(ContractDoc.invariantKinds).sort(), TC.INVARIANT_IDS.slice().sort());
});

test('契约对齐：form-bound 集合一致（calc/geometry/classify）', () => {
  const jsonFormBound = ContractDoc.contracts
    .filter(c => c.conversion === 'form-bound').map(c => c.questionType).sort();
  assert.deepEqual(jsonFormBound, TC.FORM_BOUND.slice().sort());
  assert.deepEqual(TC.FORM_BOUND.slice().sort(), ['calc', 'classify', 'geometry']);
});

/* ---------------- 2. 不变式判定 ---------------- */

test('calc：无算式/无运算声明/无空位等式 → 违例', () => {
  const r = TC.check('calc', sq('calc', { prompt: '计算下列各题的结果是多少？' }));
  assert.equal(r.ok, false);
  assert.deepEqual(r.violations, ['expressionPresent']);
});

test('calc：题干内嵌可求值算式 → pass', () => {
  const r = TC.check('calc', sq('calc', { prompt: '18 + 4 = ?' }));
  assert.equal(r.ok, true);
});

test('choice：无选项 → 违例；值约定合规 → pass', () => {
  const bad = TC.check('choice', sq('choice', { prompt: '3 + 4 等于几？', answer: { value: '7', acceptable: [] } }));
  assert.equal(bad.ok, false);
  assert.ok(bad.violations.indexOf('optionsPresent') !== -1);

  const ok = TC.check('choice', sq('choice', {
    prompt: '3 + 4 等于几？', answer: { value: '7', acceptable: [] },
    data: { options: ['6', '7', '8'], correctIndex: 1 }
  }));
  assert.equal(ok.ok, true);
});

test('choice：索引约定（answer.value=String(correctIndex)）合规', () => {
  const r = TC.check('choice', sq('choice', {
    prompt: '3 + 4 等于几？', answer: { value: '1', acceptable: [] },
    data: { options: ['6', '7', '8'], correctIndex: 1 }
  }));
  assert.equal(r.ok, true);
});

test('judge：非布尔答案 → 违例；布尔 → pass', () => {
  const bad = TC.check('judge', sq('judge', { prompt: '3 + 4 = 7，对还是错？', answer: { value: 'false', acceptable: [] } }));
  assert.equal(bad.ok, false);
  const ok = TC.check('judge', sq('judge', { prompt: '3 + 4 = 7，对还是错？', answer: { value: true, acceptable: [] } }));
  assert.equal(ok.ok, true);
});

test('fill：无空位 → 违例；含 ____ → pass', () => {
  const bad = TC.check('fill', sq('fill', { prompt: '18 + 4 等于多少？' }));
  assert.equal(bad.ok, false);
  const ok = TC.check('fill', sq('fill', { prompt: '18 + 4 = ____。' }));
  assert.equal(ok.ok, true);
});

test('apply：裸算式 → 违例；情境叙述 → pass', () => {
  const bad = TC.check('apply', sq('apply', { prompt: '5 × 3 = ?' }));
  assert.equal(bad.ok, false);
  const ok = TC.check('apply', sq('apply', { prompt: '小明买了 5 支铅笔，每支 3 元，一共要付多少元？' }));
  assert.equal(ok.ok, true);
});

test('geometry：无图形无指令 → 违例；data.graphic → pass；classify：无分组 → 违例', () => {
  const badG = TC.check('geometry', sq('geometry', { prompt: '计算 12 + 8 的结果。' }));
  assert.equal(badG.ok, false);
  const okG = TC.check('geometry', sq('geometry', { prompt: '', data: { graphic: { type: 'chart', subtype: 'line' } } }));
  assert.equal(okG.ok, true);
  const badC = TC.check('classify', sq('classify', { prompt: '计算下面各题。' }));
  assert.equal(badC.ok, false);
});

/* ---------------- 3/4/5. enforce：fail-closed + finisher + 裸值归一 ---------------- */

test('enforce：form-bound（calc）不合规 → drop，无 finisher', () => {
  const out = TC.enforce([sq('calc', { prompt: '计算下列各题。' })], { questionTypeId: 'calc' });
  assert.equal(out.length, 0);
});

test('enforce：calc 题干内嵌算式 → pass 保留并写 trace', () => {
  const out = TC.enforce([sq('calc', { prompt: '18 + 4 = ?' })], { questionTypeId: 'calc' });
  assert.equal(out.length, 1);
  assert.equal(out[0].metadata.typeContract.action, 'pass');
});

test('enforce：choice 索引约定 + 数值选项 → finish 归一为值约定字符串选项', () => {
  const q = sq('choice', {
    prompt: '已知条件：A 有 34，B 比 A 多 4。问题：B 有多少？',
    answer: '0',
    data: { options: [38, 39, 34], correctIndex: 0 }
  });
  const out = TC.enforce([q], { questionTypeId: 'choice' });
  assert.equal(out.length, 1);
  assert.equal(out[0].metadata.typeContract.action, 'finish');
  assert.ok(out[0].data.options.every(o => typeof o === 'string'));
  assert.equal(out[0].answer.value, '38');
  assert.ok(out[0].data.options.indexOf('38') !== -1);
});

test('enforce：judge 裸布尔答案归一后保留，boolean 不被串化', () => {
  const q = sq('judge', { prompt: '已知条件：A 有 34，B 比 A 多 4。问题是 40 —— 对还是错？', answer: false });
  const out = TC.enforce([q], { questionTypeId: 'judge' });
  assert.equal(out.length, 1);
  assert.equal(typeof out[0].answer.value, 'boolean');
  assert.equal(out[0].answer.value, false);
});

test('enforce：choice 完全不可修复（无选项且答案非数值）→ drop', () => {
  const q = sq('choice', { prompt: '下列说法正确的是哪一个？', answer: { value: '对', acceptable: [] } });
  const out = TC.enforce([q], { questionTypeId: 'choice' });
  assert.equal(out.length, 0);
});

/* ---------------- 6. 验证器第 9 检查 ---------------- */

test('验证器：非契约题型（legacy token）→ skip', () => {
  const r = KpSemantic.checkTypeContract(sq('oral', { prompt: 'x' }));
  assert.equal(r.state, 'skip');
});

test('验证器：合规 calc → pass；违例 calc → fail（KP_TYPE_CONTRACT, ERROR）', () => {
  const ok = KpSemantic.checkTypeContract(sq('calc', { prompt: '18 + 4 = ?' }));
  assert.equal(ok.state, 'pass');

  const bad = KpSemantic.checkTypeContract(sq('calc', { prompt: '计算下列各题的结果。' }));
  assert.equal(bad.state, 'fail');
  assert.equal(bad.errors.length, 1);
  assert.equal(bad.errors[0].code, 'KP_TYPE_CONTRACT');
  assert.equal(bad.errors[0].severity, 'ERROR');
  assert.deepEqual(bad.errors[0].detail.violations, ['expressionPresent']);
});

/* ---------------- 7. selector form-bound 声明门 ---------------- */

test('selector：calc 计划候选必须声明 calc（无 kp 绑定时胜者声明 calc）', () => {
  const plan = { knowledgePointIds: ['math-g1-down-u02-k002'], questionTypeId: 'calc', difficulty: 2, count: 1 };
  const sel = Selector.selectGenerator(plan, { mode: 'native' });
  assert.ok(sel.generatorId, '应有候选');
  assert.ok(sel.record.questionTypes.indexOf('calc') !== -1, '胜者必须声明 calc');
});

test('selector：shape-recognition 为几何度量 KP claim calc（P25-08 新增 makeCalcMeasurementQuestion）', () => {
  // P25-08：shape-recognition 为 geometric-measurement KP 提供 calc（圆周长/面积等），
  // 题干内嵌算式满足 calc 不变式。验证其 registry 声明 calc 且对绑定 KP 胜出。
  const sel = Selector.selectGenerator(
    { knowledgePointIds: ['math-g6-up-u04-k002'], questionTypeId: 'calc', difficulty: 2, count: 1 },
    { mode: 'native' }
  );
  assert.equal(sel.generatorId, 'generator:shape-recognition', '圆的周长 calc 应由 shape-recognition 承载');
  assert.ok(sel.record.questionTypes.indexOf('calc') !== -1, 'shape-recognition 应声明 calc（几何度量）');
});

/* ---------------- 8. 端到端（bundle 环境，代表行） ---------------- */

const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

test('端到端：无 kp 绑定 calc 行由声明 calc 的生成器承载且产出合规', async () => {
  const session = new PracticeSession({
    subject: 'math', grade: 1, count: 1,
    knowledgePointId: 'math-g1-down-u02-k002', questionType: 'calc'
  });
  await session.start();
  const qs = session.semanticQuestions || [];
  assert.ok(qs.length >= 1);
  assert.equal(qs[0].questionType, 'calc');
  const c = TC.check('calc', qs[0]);
  assert.equal(c.ok, true, '契约违例：' + (c.violations || []).join(','));
});

/* ---------------- 9. V5.1.0 judge 教学闭环：解析 + 假命题错因 ----------------
 * 不变式 booleanAnswer 保持冻结（见第 2 节）；下列为产出层附加要求：
 *   - 每道 judge 题必须带非空 answer.explanation（讲清命题为何真/假）；
 *   - 假命题（answer.value===false）必须带非空 data.misconception（自由文本错因）；
 *   - 三模式（finishJudge 机械转换 / 原生 judge 分支 / 手写命题）同口径。 */

test('judge finisher：数值题机械转换后必带解析；假命题必带错因，且真假两种都能产出', () => {
  let sawTrue = false, sawFalse = false;
  for (let s = 0; s < 16; s++) {
    const q = sq('judge', {
      prompt: '列式计算：13 + 8 = ?',
      answer: { value: '21', acceptable: [] },
      seed: 'judge-finisher-expl-' + s,
      data: {}
    });
    const out = TC.enforce([q], { questionTypeId: 'judge' });
    assert.equal(out.length, 1, '可机械转换的数值判断题不应 drop');
    const t = out[0];
    assert.equal(typeof t.answer.value, 'boolean');
    assert.ok(t.answer.explanation && t.answer.explanation.length >= 5, '判断题必须带解析');
    if (t.answer.value === false) {
      sawFalse = true;
      assert.ok(t.data.misconception && t.data.misconception.length >= 5, '假命题必须带错因');
      assert.ok(t.data.expectedResult && t.data.shownResult, '假命题保留对照数据');
      assert.notEqual(t.data.shownResult, t.data.expectedResult, '假命题展示值必须不同于正确结果');
    } else {
      sawTrue = true;
      assert.equal(t.data.misconception, undefined, '真命题不写错因');
    }
  }
  assert.ok(sawTrue && sawFalse, '16 个 seed 内应同时覆盖真/假命题');
});

test('judge finisher：余数题与排序题同样带解析/错因', () => {
  const rem = sq('judge', {
    prompt: '23 ÷ 4 = ?', answer: { value: '5……3', acceptable: [] }, seed: 'judge-rem-1', data: {}
  });
  const remOut = TC.enforce([rem], { questionTypeId: 'judge' });
  assert.equal(remOut.length, 1);
  assert.ok(remOut[0].answer.explanation.length >= 5);
  if (remOut[0].answer.value === false) assert.ok(remOut[0].data.misconception.length >= 5);

  const seq = sq('judge', {
    prompt: '把 3、1、2 从小到大排列：3，1，2。',
    answer: { value: '1，2，3', acceptable: [] }, seed: 'judge-seq-1', data: {}
  });
  const seqOut = TC.enforce([seq], { questionTypeId: 'judge' });
  assert.equal(seqOut.length, 1);
  assert.ok(seqOut[0].answer.explanation.length >= 5);
  if (seqOut[0].answer.value === false) assert.ok(seqOut[0].data.misconception.length >= 5);
});

// 代表 KP 覆盖三模式：算术族=模式A finishJudge；shape/position/application/stats=模式B；
// angle/area/code=模式C 手写命题。
const JUDGE_REPRESENTATIVE_KPS = [
  { kp: 'math-g5-down-u07-k001', grade: 5 }, // 排序（模式A finishJudge 序列分支）
  { kp: 'math-g2-up-u01-k001', grade: 2 },   // 图形特征（模式B shape）
  { kp: 'math-g2-up-u04-k003', grade: 2 },   // 平移方向（模式B position）
  { kp: 'math-g4-up-u06-k002', grade: 4 },   // 应用题判断（模式B application）
  { kp: 'math-g3-up-u07-k002', grade: 3 },   // 角的认识（模式C）
  { kp: 'math-g3-down-u04-k001', grade: 3 }  // 面积的认识（模式C）
];

for (const rep of JUDGE_REPRESENTATIVE_KPS) {
  const kpId = rep.kp;
  test('端到端 judge 教学闭环：' + kpId + ' 每题带解析、假命题带错因', async () => {
    const session = new PracticeSession({
      subject: 'math', grade: rep.grade, count: 8,
      knowledgePointId: kpId, questionType: 'judge'
    });
    await session.start();
    const qs = session.semanticQuestions || [];
    assert.ok(qs.length >= 1, '该 KP 应能产出判断题');
    qs.forEach(q => {
      assert.equal(q.questionType, 'judge');
      assert.equal(typeof q.answer.value, 'boolean', 'booleanAnswer 不变式');
      assert.ok(q.answer.explanation && String(q.answer.explanation).length >= 5,
        '判断题必须带解析：' + (q.prompt || '').slice(0, 30));
      if (q.answer.value === false) {
        assert.ok(q.data && q.data.misconception && String(q.data.misconception).length >= 5,
          '假命题必须带错因：' + (q.prompt || '').slice(0, 30));
      }
    });
  });
}
