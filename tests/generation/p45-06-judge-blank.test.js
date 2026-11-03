'use strict';

/**
 * tests/generation/p45-06-judge-blank.test.js — P45-06（E 类）：判断题题干不得残留作答空位
 *
 * 背景（审计 E1）：单位换算 judge 6 行的题干复用了填空句式——
 *   「判断对错：15厘米 = ____ 米。有人说结果是 0.15，对还是错？」
 *   判断题只作答「对/错」，残留的 ____ 会让学生误以为还要填空。
 *
 * 修复（唯一入口 type-contract.js::finishJudge）：拟展示结果确定后，先把题干中的
 * ____ / () / （） 替换为该数值（题干自带单位保留），再走原有「= ?」/「= 」/「…有人说」
 * 分支。对错值与 shownResult 同源规则不变。
 *
 * 不变量：
 *   1. 全量 judge 行（p28-v1 冻结 seed）题干不含 ____ / () / （）；
 *   2. 单位换算 judge：题干「= X 单位」的 X 与 data.shownResult 一致，
 *      且 answer.value === (X 与 data.expectedResult 相等)；
 *   3. 其它题型（fill）保持空位（判断题修复不得影响填空）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const KC = env.KnowledgeContext;
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));

const ALL = QTR.TYPES.map(function (t) { return t.id; });
// E1 只针对「填空句式空位」（____）；「（  ）」是判断题标准作答括号，不属残留。
const BLANK_RE = /____/;

function gradeOf(kp) {
  const m = /^math-g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

function judgePairs() {
  const pairs = [];
  for (let g = 1; g <= 6; g++) {
    (KC.kpsForGrade('math', g) || []).forEach(function (k) {
      const ev = KCV.buildEligibility([k.knowledgeId], ALL);
      const m = (ev.matrix && ev.matrix[k.knowledgeId]) || {};
      if (m.judge === 'ALLOW') pairs.push({ kp: k.knowledgeId, grade: g });
    });
  }
  return pairs;
}

function freezeSeed(kp, qt) {
  return 'freeze:p28-v1|' + kp + '|' + qt + '|d3';
}

function genJudge(kp, grade, seed) {
  const sess = new PracticeSession({ subject: 'math', grade: grade, count: 1, knowledgePointId: kp, questionType: 'judge', seed: seed });
  return sess.start().then(function () {
    return (sess.semanticQuestions || []).filter(function (q) {
      const qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
      return q.questionType === 'judge' && qk === kp;
    });
  });
}

/* ------------------------------------------------------------------ *
 * E1：全量 judge 题干零残留空位
 * ------------------------------------------------------------------ */
test('P45-06 E1：全部 judge 行题干不残留填空式空位 ____', async () => {
  const failures = [];
  const pairs = judgePairs();
  for (const p of pairs) {
    const qs = await genJudge(p.kp, p.grade, freezeSeed(p.kp, 'judge'));
    qs.forEach(function (q, i) {
      if (BLANK_RE.test(String(q.prompt))) {
        failures.push(p.kp + '/judge#' + i + ' 题干残留空位: ' + q.prompt);
      }
    });
  }
  assert.ok(pairs.length > 0, 'judge 行枚举为空');
  assert.deepEqual(failures, [], 'E1 判断题空位残留:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * 单位换算 judge：说法的数值、shownResult、对错值三口径一致
 * ------------------------------------------------------------------ */
test('P45-06 E1：单位换算 judge 说法数值与 shownResult/对错值同源', async () => {
  const failures = [];
  const pairs = judgePairs();
  for (const p of pairs) {
    const sel = Selector.selectGenerator({ knowledgePointIds: [p.kp], questionTypeId: 'judge', difficulty: 3, count: 1 });
    if (sel.generatorId !== 'generator:money-measurement') continue;
    const qs = await genJudge(p.kp, p.grade, freezeSeed(p.kp, 'judge'));
    qs.forEach(function (q, i) {
      const tag = p.kp + '/judge#' + i;
      const d = q.data || {};
      if (d.operation !== 'conversion' || !d.toUnit) return;
      const m = /=\s*([0-9.]+)\s*([^\s。，,（(]*)/.exec(String(q.prompt));
      if (!m) { failures.push(tag + ' 题干未出现「= 数值 单位」陈述: ' + q.prompt); return; }
      const shownNum = m[1];
      if (!d.shownResult || String(d.shownResult).indexOf(shownNum) !== 0) {
        failures.push(tag + ' 题干数值 ' + shownNum + ' ≠ shownResult ' + d.shownResult); return;
      }
      if (m[2] && m[2] !== d.toUnit) {
        failures.push(tag + ' 题干单位 ' + m[2] + ' ≠ toUnit ' + d.toUnit); return;
      }
      const expectedNum = String(d.expectedResult == null ? '' : d.expectedResult);
      const wantTrue = String(d.shownResult) === expectedNum;
      if (typeof q.answer.value !== 'boolean' || q.answer.value !== wantTrue) {
        failures.push(tag + ' 对错值 ' + q.answer.value + ' 与说法 ' + d.shownResult +
          ' / 正确结果 ' + expectedNum + ' 不一致');
      }
    });
  }
  assert.deepEqual(failures, [], 'E1 单位换算 judge 三口径不一致:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * 作用域守卫：fill 仍保留空位（判断题修复不外溢）
 * ------------------------------------------------------------------ */
test('P45-06 作用域：fill 换算题仍保留作答空位', async () => {
  const failures = [];
  for (const kp of ['math-g2-up-u05-k001', 'math-g3-up-u03-k001', 'math-g3-up-u04-k002']) {
    const grade = gradeOf(kp);
    const sess = new PracticeSession({ subject: 'math', grade: grade, count: 1, knowledgePointId: kp, questionType: 'fill', seed: freezeSeed(kp, 'fill') });
    const qs = (await sess.start(), (sess.semanticQuestions || []).filter(function (q) {
      const qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
      return q.questionType === 'fill' && qk === kp;
    }));
    qs.forEach(function (q, i) {
      if (!BLANK_RE.test(String(q.prompt))) failures.push(kp + '/fill#' + i + ' 填空题干缺空位: ' + q.prompt);
    });
  }
  assert.deepEqual(failures, [], 'fill 空位回归:\n' + failures.join('\n'));
});
