'use strict';

/**
 * tests/generation/p42-5-golden-truth-gate.test.js — P42-5（P42-027 残余闭合）
 *
 * golden build 写入前真值门回归（dev/p25/build-golden-dataset.js truthGate）：
 *   Part 1 门控制组：解析真等式 → PASS 放行；解析假等式（P42-005 形态）→ FAIL 拒收；
 *                   不可解析（代数式/无断言）→ UNVERIFIED 放行；门自身异常 → UNVERIFIED 放行。
 *   Part 2 现存 golden 全量过门（P42-1D 审计口径测试化，防未来重生成冻结入真缺陷）：
 *                   1114 题重建 sq 形态逐题过门，accepted=false 必须为空。
 *
 * 门口径：FAIL 拒收（与 SEMANTIC_PASS 同口径不伪造收录）；UNVERIFIED/PASS 放行（诚实缺位不判错）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const gate = require(path.join(ROOT, 'dev', 'p25', 'build-golden-dataset.js')).truthGate;
const TV = require(path.join(ROOT, 'dev', 'p42', 'truth-verifier.js'));

function sq(over) {
  return Object.assign({
    questionType: 'fill', stem: '计算：2 + 3 = ____',
    answer: { value: '5', explanation: '2 + 3 = 5，所以答案是 5。' }
  }, over);
}

test('P42-5 门控制组：真等式 PASS 放行，假等式 FAIL 拒收', () => {
  // PASS：题干空位代入一致 + 解析等式为真
  const a = gate(sq({}));
  assert.equal(a.accepted, true, '真等式不得拒收');
  assert.equal(a.status, 'PASS');
  assert.ok(a.checked >= 1, '须有真实校验子句');

  // FAIL：解析假等式（P42-005 同形态：9 × 2 = 9，真值 18）
  const b = gate(sq({ stem: '9 × 2 = ____', answer: { value: '18', explanation: '9 × 2 = 9，所以答案是 18。' } }));
  assert.equal(b.accepted, false, '解析假等式必须拒收（P42-027 写入前门）');
  assert.equal(b.status, 'FAIL');
});

test('P42-5 门控制组：UNVERIFIED 放行（代数式 / 无断言解析）', () => {
  // 代数式含拉丁字母 → 验证器诚实缺位，不判错不拒收（P42-1D 口径）
  const c = gate(sq({ stem: '当 a = 5 时，3a + 1 = ____', answer: { value: '16', explanation: '答案是 16。' } }));
  assert.equal(c.accepted, true, 'UNVERIFIED 不得拒收');
  assert.equal(c.status, 'UNVERIFIED');
  assert.equal(c.checked, 0, '无可判定子句时 checked 为 0');

  // 解析无等式断言（纯文字）→ UNVERIFIED 放行
  const d = gate(sq({ stem: '一个角有一个顶点和两条边', answer: { value: '2', explanation: '角是由两条射线组成的图形。' } }));
  assert.equal(d.accepted, true);
  assert.equal(d.status, 'UNVERIFIED');
});

test('P42-5 门控制组：门自身异常按 UNVERIFIED 放行并记录 GATE-ERROR', () => {
  const orig = TV.auditQuestion;
  TV.auditQuestion = function () { throw new Error('mock-verifier-crash'); };
  try {
    const e = gate(sq({}));
    assert.equal(e.accepted, true, '验证器故障不得阻塞派生（放行）');
    assert.equal(e.status, 'UNVERIFIED');
    assert.match((e.failures || [])[0] || '', /GATE-ERROR: mock-verifier-crash/, '异常须记录在 failures');
  } finally {
    TV.auditQuestion = orig;
  }
});

test('P42-5 现存 golden 全量过门：accepted=false 必须为空（P42-1D 口径测试化）', () => {
  // 输出文件名含 golden——按 P28-33 门禁规避先例，payload 先组装独立对象再写盘；
  // 本测试只读 kbl 数据，零写盘。
  const goldenData = JSON.parse(fs.readFileSync(path.join(ROOT, 'kbl', 'teaching', 'golden-questions.json'), 'utf8'));
  const questions = goldenData.questions || [];
  assert.ok(questions.length > 0, 'golden 题集非空');

  const rejected = [];
  let passN = 0, unverifiedN = 0;
  questions.forEach(function (q, idx) {
    const st = q.structure || {};
    const stem = st.stem || {};
    const ans = st.answer || {};
    // 与 P42-1D 审计同口径重建 sq 形态（structure.stem.prompt + structure.answer.value/explanation）
    const r = gate({
      questionType: q.questionType,
      stem: stem.prompt,
      answer: { value: ans.value, explanation: ans.explanation }
    });
    if (r.accepted === false) {
      rejected.push({ idx, kpId: q.kpId, questionType: q.questionType, failures: r.failures });
    } else if (r.status === 'PASS') {
      passN++;
    } else {
      unverifiedN++;
    }
  });

  assert.deepStrictEqual(rejected, [], 'golden 存量不得有真值 FAIL（冻结入金标即不可逆）：'
    + JSON.stringify(rejected.slice(0, 5)));
  assert.ok(passN + unverifiedN === questions.length, '全量题目均须得到门判定');
});
