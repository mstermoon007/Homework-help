'use strict';

/**
 * tests/generation/p42-2c-cross-kp-family.test.js — P42-2C（P42-033 根因修复）
 *
 * 背景（P42-DEFECT-REGISTER P42-033，14 KP 组 33 行「目标 KP 零参与——跨 KP 错挂家族」）：
 * P2 概念回指差分发现 33 行题目题干/选项/解析/答案均无目标 KP 概念词（方向位置题挂
 * 平移/旋转 KP、整数加法挂体积 KP、正/反比例互串等）。本批次按 KP 组定位模板分支
 * 逐组根因修复（信号式收窄，禁止硬编码 KP 白名单）：
 *   1. position.js   —— 平移/旋转子类型补 geometry/apply 语义分支（含「平移」「旋转」
 *      token），observe/coordinate 子类型场景兜底保留（bypass 收窄）。
 *   2. reasoning.js  —— 乘除法 calc/choice/apply 除法分支轮转翻转（求商 token）；
 *      optimization 分派补「最优/策略」名称信号。
 *   3. shape.js      —— 平行与垂直 fill 池重排（垂直/平行 token 前置）。
 *   4. application.js—— 新增 makeIrregularVolumeTyped（排水法实验，石块/体积 token，
 *      四题型措辞互异；未授权题型 fail-closed）。
 *   5. arithmetic.js —— 新增 makeFractionDecimalMixedQuestion（分配律，运算律/小数
 *      混合运算 token）；镜像通用路径 P38 意图闸门挂 calculation-support 图形
 *      （k003 全题型 intent.graphicRole=auxiliary/carrier 强制配图）。
 *   6. semantic-relations.js —— 新增 makeInversePropTyped（货运/装订/行船，反比例
 *      token）+ makeDirectPropApply（彩带归一，正比例 token）；choice 补 q.prompt。
 *   7. fraction.js   —— 约分/通分名称信号 fill 分支（约分 token）。
 *
 * 本测试（登记验收口径：每组 ≥1 反例 seed 断言 + 非命中面零变化）：
 *   Part 1  33 行登记 seed（p42|<kp>|<qt>|d3）逐行断言 KP 概念 token 回指。
 *   Part 2  非命中面零变化：arithmetic-mixed-calculation 同族 7 个非信号 KP 不被
 *           新 maker 劫持（解析不含「小数混合运算」签名且行存活）；误报甄别行
 *           （k004|calc、分数的基本性质 fill）行为不变。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

function gradeOf(kp) {
  const m = /g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

async function makeOne(kp, qt, seed) {
  const s = new PracticeSession({
    subject: 'math', grade: gradeOf(kp), count: 1, difficulty: 3,
    knowledgePointId: kp, questionType: qt, seed: seed
  });
  await s.start();
  return (s.semanticQuestions && s.semanticQuestions[0]) || null;
}

/* ---------------- Part 1 · 33 行登记 seed 反例断言（token 回指） ---------------- */

// 33 行全清单（KP | 题型 | 审计检索域必须命中的概念 token，some 语义与 P2 差分一致）
const ROWS = [
  // 平移/旋转家族（6 KP × 2 行）
  ['math-g3-down-u01-k002', 'geometry', ['平移']],
  ['math-g3-down-u01-k002', 'apply', ['平移']],
  ['math-g3-down-u01-k003', 'geometry', ['旋转']],
  ['math-g3-down-u01-k003', 'apply', ['旋转']],
  ['math-g4-down-u07-k003', 'geometry', ['平移']],
  ['math-g4-down-u07-k003', 'apply', ['平移']],
  ['math-g4-down-u07-k004', 'geometry', ['平移']],
  ['math-g4-down-u07-k004', 'apply', ['平移']],
  ['math-g4-down-u07-k005', 'geometry', ['平移']],
  ['math-g4-down-u07-k005', 'apply', ['平移']],
  ['math-g5-up-u04-k002', 'geometry', ['旋转']],
  ['math-g5-up-u04-k002', 'apply', ['旋转']],
  // 7～9的乘、除法（3 行）
  ['math-g2-up-u07-k001', 'calc', ['求商', '÷', '除']],
  ['math-g2-up-u07-k001', 'choice', ['求商', '÷', '除']],
  ['math-g2-up-u07-k001', 'apply', ['平均分', '÷', '除', '装']],
  // 平行与垂直（3 行）
  ['math-g4-up-u05-k001', 'fill', ['垂直', '平行']],
  ['math-g4-up-u05-k001', 'choice', ['垂直', '平行']],
  ['math-g4-up-u05-k001', 'geometry', ['垂直', '平行']],
  // 不规则物体的体积（4 行）
  ['math-g5-down-u03-k006', 'fill', ['石块', '体积']],
  ['math-g5-down-u03-k006', 'apply', ['石块', '体积']],
  ['math-g5-down-u03-k006', 'choice', ['石块', '体积']],
  ['math-g5-down-u03-k006', 'judge', ['石块', '体积']],
  // 分数、小数混合运算及运算律（4 行）
  ['math-g6-up-u02-k003', 'fill', ['运算律', '小数混合运算']],
  ['math-g6-up-u02-k003', 'apply', ['运算律', '小数混合运算']],
  ['math-g6-up-u02-k003', 'choice', ['运算律', '小数混合运算']],
  ['math-g6-up-u02-k003', 'judge', ['运算律', '小数混合运算']],
  // 正/反比例（4 行）
  ['math-g6-down-u04-k004', 'apply', ['正比例']],
  ['math-g6-down-u04-k005', 'calc', ['反比例']],
  ['math-g6-down-u04-k005', 'fill', ['反比例']],
  ['math-g6-down-u04-k005', 'choice', ['反比例']],
  // 最优策略的规律（2 行）
  ['math-g5-down-u08-k002', 'fill', ['最优']],
  ['math-g5-down-u08-k002', 'choice', ['最优']],
  // 约分与通分（1 行）
  ['math-g5-down-u04-k005', 'fill', ['约分']]
];

test('P42-033 33 行登记 seed 逐行 KP 概念 token 回指（平移/旋转家族 12 行）', async () => {
  for (const [kp, qt, tokens] of ROWS.slice(0, 12)) {
    const sq = await makeOne(kp, qt, 'p42|' + kp + '|' + qt + '|d3');
    assert.ok(sq, kp + '|' + qt + ' 应产出题目（修复前 0 产出/错挂）');
    const text = JSON.stringify({ p: sq.prompt, o: sq.data && sq.data.options,
      e: sq.answer && sq.answer.explanation, d: sq.data });
    assert.ok(tokens.some(function (t) { return text.indexOf(t) !== -1; }),
      kp + '|' + qt + ' 检索域应含 ' + tokens.join('/') + '，实际：' + String(sq.prompt).slice(0, 80));
  }
});

test('P42-033 33 行登记 seed 逐行 KP 概念 token 回指（乘除法/平行垂直 6 行）', async () => {
  for (const [kp, qt, tokens] of ROWS.slice(12, 18)) {
    const sq = await makeOne(kp, qt, 'p42|' + kp + '|' + qt + '|d3');
    assert.ok(sq, kp + '|' + qt + ' 应产出题目');
    const text = JSON.stringify({ p: sq.prompt, o: sq.data && sq.data.options,
      e: sq.answer && sq.answer.explanation, d: sq.data });
    assert.ok(tokens.some(function (t) { return text.indexOf(t) !== -1; }),
      kp + '|' + qt + ' 检索域应含 ' + tokens.join('/') + '，实际：' + String(sq.prompt).slice(0, 80));
  }
});

test('P42-033 33 行登记 seed 逐行 KP 概念 token 回指（体积/小数混合运算 8 行）', async () => {
  for (const [kp, qt, tokens] of ROWS.slice(18, 26)) {
    const sq = await makeOne(kp, qt, 'p42|' + kp + '|' + qt + '|d3');
    assert.ok(sq, kp + '|' + qt + ' 应产出题目');
    const text = JSON.stringify({ p: sq.prompt, o: sq.data && sq.data.options,
      e: sq.answer && sq.answer.explanation, d: sq.data });
    assert.ok(tokens.some(function (t) { return text.indexOf(t) !== -1; }),
      kp + '|' + qt + ' 检索域应含 ' + tokens.join('/') + '，实际：' + String(sq.prompt).slice(0, 80));
  }
});

test('P42-033 33 行登记 seed 逐行 KP 概念 token 回指（正反比例/最优策略/约分 7 行）', async () => {
  for (const [kp, qt, tokens] of ROWS.slice(26)) {
    const sq = await makeOne(kp, qt, 'p42|' + kp + '|' + qt + '|d3');
    assert.ok(sq, kp + '|' + qt + ' 应产出题目');
    const text = JSON.stringify({ p: sq.prompt, o: sq.data && sq.data.options,
      e: sq.answer && sq.answer.explanation, d: sq.data });
    assert.ok(tokens.some(function (t) { return text.indexOf(t) !== -1; }),
      kp + '|' + qt + ' 检索域应含 ' + tokens.join('/') + '，实际：' + String(sq.prompt).slice(0, 80));
  }
});

test('P42-033 k003 图形意图闸门：fill/choice 天平图、apply/judge 首步分组图（auxiliary 强制配图）', async () => {
  for (const qt of ['fill', 'choice', 'apply', 'judge']) {
    const sq = await makeOne('math-g6-up-u02-k003', qt, 'p42|math-g6-up-u02-k003|' + qt + '|d3');
    assert.ok(sq, 'k003|' + qt + ' 应产出题目');
    const g = sq.data && sq.data.graphic;
    assert.ok(g, 'k003|' + qt + ' intent.graphicRole=auxiliary 必须配图');
    assert.equal(g.role, 'calculation-support', 'k003|' + qt + ' 图形角色为 calculation-support');
    if (qt === 'fill' || qt === 'choice') {
      assert.equal(g.subtype, 'balance', 'k003|' + qt + ' 天平图');
    } else {
      assert.equal(g.subtype, 'groups', 'k003|' + qt + ' 首步分组图');
    }
  }
});

/* ---------------- Part 2 · 非命中面零变化 ---------------- */

// arithmetic-mixed-calculation 同族 7 个非信号 KP（名称不含「小数混合运算」连续子串）：
// 不被新 maker 劫持（解析不含新 maker 签名「小数混合运算」）且行存活。
const SIBLING_KPS = [
  'math-g1-up-u02-k002', 'math-g3-up-u02-k001', 'math-g3-up-u02-k002',
  'math-g4-down-u01-k003', 'math-g4-down-u03-k004',
  'math-g6-up-u02-k002', 'math-g6-up-u02-k004'
];

test('P42-033 非命中面零变化：mixed 同族 7 KP 非信号行存活且不被新 maker 劫持', async () => {
  for (const kp of SIBLING_KPS) {
    // g6-up-u02-k002/k004（分数乘/除法）ALLOW 无 calc，取 fill 探活；其余 calc
    const qt = (kp === 'math-g6-up-u02-k002' || kp === 'math-g6-up-u02-k004') ? 'fill' : 'calc';
    const sq = await makeOne(kp, qt, 'p42-2c-nc|' + kp + '|' + qt + '|d3');
    assert.ok(sq, kp + '|' + qt + ' 应照常产出（零变化面）');
    const expl = (sq.answer && sq.answer.explanation) || '';
    assert.ok(expl.indexOf('小数混合运算') === -1,
      kp + ' 非「小数混合运算」信号 KP，解析不得被新 maker 劫持：' + expl.slice(0, 80));
  }
});

test('P42-033 零变化：误报甄别行 k004|calc 与分数的基本性质 fill 行为不变', async () => {
  // g6-down-u04-k004|calc（钢笔归一）判误报不入 33 行清单——修复后仍照常产出
  const k4 = await makeOne('math-g6-down-u04-k004', 'calc', 'p42-2c-nc|k4|calc|d3');
  assert.ok(k4, 'k004|calc 误报行应照常产出');

  // g5-down-u04-k004（分数的基本性质）名称不含「约分/通分」信号 → 不走约分分支
  const kn = await makeOne('math-g5-down-u04-k004', 'fill', 'p42-2c-nc|kn|fill|d3');
  assert.ok(kn, '分数的基本性质 fill 应照常产出');
  const explN = (kn.answer && kn.answer.explanation) || '';
  assert.ok(explN.indexOf('约分：分子分母同时除以公因数') === -1,
    '非信号 KP 不得被约分分支劫持：' + explN.slice(0, 80));
});
