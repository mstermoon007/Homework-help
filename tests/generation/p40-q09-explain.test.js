'use strict';

/**
 * tests/generation/p40-q09-explain.test.js — P40-Q-09 图形推理深化（解析四步化 + fill 正序化 + 单位口径）
 *
 * 层1  concept-meaning 四步解析：apply「题意→列式→计算→答」结构、calc/fill 演算归因、
 *      R13 #140 悬垂标点回归、R6 复述旧模板负断言；
 * 层2  fraction calcItem 法则句接演算（R6 #142 冒号空截断回归）；
 * 层3  reasoning fill builder 级正序题面（R13 #131/#162 倒序机制退场回归 + 空位唯一 +
 *      fill 解析「空格填」归因 + apply/choice 题面不回归）；
 * 层4  money 零结果单位口径（R8 #19「0分→沿用操作数单位」，用户裁决并入）；
 * 层5  stats CLK_CALC/TC_CALC 补 e 教学解析（R6 #24 null 兜底清零）；
 * 层6  R20 机判回放：本文件全部产出行 gradeUserAnswer(正确答案) 无 false，
 *      calc/fill 必须 true（apply 长文本说理允许 null 走家长检查，AS-14 口径）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const cmMod = require(path.join(ROOT, 'shared/generator/generators/concept-meaning.js'));
const fracMod = require(path.join(ROOT, 'shared/generator/generators/fraction.js'));
const reasonMod = require(path.join(ROOT, 'shared/generator/generators/reasoning.js'));
const moneyMod = require(path.join(ROOT, 'shared/generator/generators/money.js'));
const statsMod = require(path.join(ROOT, 'shared/generator/generators/stats.js'));
const { gradeUserAnswer } = require(path.join(ROOT, 'shared/validator/answer-validator.js'));

const ALL = [];
function collect(qs) { ALL.push.apply(ALL, qs); return qs; }

function mkPlan(extra, qt, seed, count) {
  return Object.assign({
    questionTypeId: qt, count: count || 4, difficulty: 2,
    knowledgePointIds: ['p40-q09-probe-kp'],
    constraints: { numberRange: { min: 1, max: 20 } },
    seed: seed
  }, extra);
}

/* ------------------------------------------------------------------ *
 * 层1 concept-meaning 四步解析
 * ------------------------------------------------------------------ */

const CM_SUBTOPICS = ['number-concept', 'negative-number', 'multdiv-relation', 'algebra-letter',
  'number-theory', 'make-ten', 'bracket-order', 'stepwise-format'];

test('P40-Q-09 L1 concept-meaning 四步解析：结构 + 悬垂标点 + 非复述', () => {
  const gen = cmMod.createConceptMeaningGenerator({});
  CM_SUBTOPICS.forEach((st, si) => {
    ['calc', 'fill', 'apply'].forEach((qt) => {
      const out = collect(gen.generate(
        mkPlan({ semanticParams: { subTopic: st, name: st + '主题' } }, qt, 'p40q09:cm:' + si + ':' + qt),
        { seed: 'p40q09:cm' }));
      assert.ok(out.length === 4, st + '×' + qt + ' 应产出 4 题，实得 ' + out.length);
      out.forEach((q, i) => {
        const ex = String(q.answer.explanation || '');
        assert.ok(ex.length > 0, st + '×' + qt + ' v' + i + ' 解析非空');
        assert.ok(ex.endsWith('。'), st + '×' + qt + ' v' + i + ' 解析以句号收尾：' + ex);
        assert.ok(!/[，、；：]$/.test(ex), st + '×' + qt + ' v' + i + ' 无悬垂标点（#140）：' + ex);
        assert.ok(!/^.{2,}，答案是 /.test(ex), st + '×' + qt + ' v' + i + ' 非题面复述旧模板：' + ex);
        if (qt === 'apply') {
          assert.ok(/^题意：/.test(ex), st + '×apply v' + i + ' 四步以「题意」开头：' + ex);
          assert.ok(/答：/.test(ex), st + '×apply v' + i + ' 四步含「答」步：' + ex);
        }
      });
    });
  });
});

/* ------------------------------------------------------------------ *
 * 层2 fraction calcItem 法则句接演算
 * ------------------------------------------------------------------ */

test('P40-Q-09 L2 fraction calcItem：法则句接演算（#142 冒号空截断回归）', () => {
  const gen = fracMod.createFractionGenerator({});
  const out = collect(gen.generate(
    mkPlan({ semanticParams: { name: '异分母分数加减法' } }, 'calc', 'p40q09:fr'),
    { seed: 'p40q09:fr' }));
  assert.ok(out.length === 4);
  out.forEach((q, i) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(!/[：]$/.test(ex), 'v' + i + ' 无冒号空截断：' + ex);
    assert.ok(/[=＝]/.test(ex), 'v' + i + ' 解析含演算等式：' + ex);
    assert.ok(ex.indexOf(String(q.answer.value)) !== -1, 'v' + i + ' 解析含计算结果：' + ex);
    assert.ok(ex.endsWith('。'), 'v' + i + ' 句号收尾：' + ex);
  });
});

/* ------------------------------------------------------------------ *
 * 层3 reasoning fill 正序题面
 * ------------------------------------------------------------------ */

const R_NAMES = ['抽屉原理', '最值问题', '鸡兔同笼', '植树问题', '找次品', '握手问题',
  '沏茶问题', '数字推理规律', '逻辑推理'];

test('P40-Q-09 L3 reasoning fill：builder 级正序题面（#131/#162 倒序退场回归）', () => {
  const gen = reasonMod.createReasoningGenerator({});
  R_NAMES.forEach((nm) => {
    const out = collect(gen.generate(
      mkPlan({ semanticParams: { name: nm } }, 'fill', 'p40q09:re:' + nm, 6),
      { seed: 'p40q09:re:' + nm }));
    assert.ok(out.length === 6, nm + ' 应产出 6 题');
    out.forEach((q, i) => {
      assert.equal((String(q.prompt).match(/____/g) || []).length, 1,
        nm + ' v' + i + ' 空位唯一：' + q.prompt);
      assert.ok(!/^(多少|几|谁|哪)/.test(String(q.prompt)),
        nm + ' v' + i + ' 非设问先行：' + q.prompt);
      const ex = String(q.answer.explanation || '');
      assert.ok(ex.indexOf('空格填') !== -1 && ex.endsWith('。'),
        nm + ' v' + i + ' fill 解析归因空格：' + ex);
    });
  });
  // #162 精确锚：抽屉 fill 不再倒序碎裂（正序合规语序）
  const d0 = gen.generate(mkPlan({ semanticParams: { name: '抽屉原理' } }, 'fill', 'p40q09:re:d0', 1), { seed: 'x' })[0];
  assert.equal(String(d0.prompt).indexOf('要保证有2个球颜色相同'), 0,
    '抽屉 fill 正序开头：' + d0.prompt);
  // P32-AS-16E 说谎引语特例保留（引语闭合、语序正序）
  const l0 = gen.generate(mkPlan({ semanticParams: { name: '逻辑推理' } }, 'fill', 'p40q09:re:l0', 1), { seed: 'y' })[0];
  assert.equal(l0.prompt,
    '有甲、乙、丙三人，其中只有一人说真话。甲称乙撒了谎，乙称丙撒了谎，丙则称甲、乙两人都撒了谎。说真话的是 ____。');
});

test('P40-Q-09 L3 reasoning apply/choice 题面不回归', () => {
  const gen = reasonMod.createReasoningGenerator({});
  const ap = collect(gen.generate(
    mkPlan({ semanticParams: { name: '鸡兔同笼' } }, 'apply', 'p40q09:ra', 3), { seed: 'p40q09:ra' }));
  ap.forEach((q, i) => {
    assert.equal(String(q.prompt).indexOf('鸡兔同笼'), 0, 'apply v' + i + ' 原始谜题题面：' + q.prompt);
    assert.ok(String(q.prompt).indexOf('____') === -1, 'apply 不含空位：' + q.prompt);
  });
  const ch = collect(gen.generate(
    mkPlan({ semanticParams: { name: '鸡兔同笼' } }, 'choice', 'p40q09:rc', 3), { seed: 'p40q09:rc' }));
  ch.forEach((q, i) => {
    assert.ok(/正确选项是哪一个？$/.test(String(q.prompt)), 'choice v' + i + ' 选择问式收尾：' + q.prompt);
  });
});

/* ------------------------------------------------------------------ *
 * 层4 money 零结果单位口径
 * ------------------------------------------------------------------ */

test('P40-Q-09 L4 money 零结果单位口径（#19「0分→沿用操作数单位」）', () => {
  const gen = moneyMod.createMoneyGenerator({});
  const out = collect(gen.generate(
    mkPlan({ semanticParams: { name: '人民币的简单计算' } }, 'calc', 'p40q09:mo', 80),
    { seed: 'p40q09:mo' }));
  assert.ok(out.length === 80);
  let zeros = 0;
  out.forEach((q) => {
    const ops = (q.data && q.data.operands) || [];
    if (q.data && q.data.operation === 'sub' && ops.length === 2 && Number(ops[0]) === Number(ops[1])) {
      zeros++;
      const a = Number(ops[0]);
      const expect = '0' + (a >= 100 ? '元' : a >= 10 ? '角' : '分');
      assert.equal(String(q.answer.value), expect,
        '零结果单位沿用操作数（operands=' + ops.join(',') + '）：实得 ' + q.answer.value);
      assert.ok(String(q.answer.explanation).indexOf('= ' + expect) !== -1,
        '解析同步零单位：' + q.answer.explanation);
    }
  });
  assert.ok(zeros >= 1, '80 题扫描应命中零结果样本，实得 ' + zeros);
});

/* ------------------------------------------------------------------ *
 * 层5 stats clock / time-convert calc 教学解析
 * ------------------------------------------------------------------ */

test('P40-Q-09 L5 stats CLK_CALC/TC_CALC 补 e 教学解析（#24 null 兜底清零）', () => {
  const gen = statsMod.createStatsGenerator({});
  const clk = collect(gen.generate(
    mkPlan({ semanticParams: { name: '认识钟面' } }, 'calc', 'p40q09:st1', 6), { seed: 'p40q09:st1' }));
  assert.ok(clk.length === 6);
  clk.forEach((q, i) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(ex.length > 5, 'clock calc v' + i + ' 解析非空：' + ex);
    assert.ok(ex !== String(q.prompt), 'clock calc v' + i + ' 解析非抄题面：' + ex);
    assert.ok(ex.endsWith('。'), 'clock calc v' + i + ' 句号收尾：' + ex);
  });
  const tc = collect(gen.generate(
    mkPlan({ semanticParams: { name: '时、分、秒' } }, 'calc', 'p40q09:st2', 8), { seed: 'p40q09:st2' }));
  assert.ok(tc.length === 8);
  tc.forEach((q, i) => {
    const ex = String(q.answer.explanation || '');
    assert.ok(ex.length > 5, 'time-convert calc v' + i + ' 解析非空：' + ex);
    assert.ok(ex !== String(q.prompt), 'time-convert calc v' + i + ' 解析非抄题面：' + ex);
    assert.ok(ex.indexOf(String(q.answer.value)) !== -1, 'time-convert calc v' + i + ' 解析含结果：' + ex);
  });
});

/* ------------------------------------------------------------------ *
 * 层6 R20 机判回放（本文件全部产出）
 * ------------------------------------------------------------------ */

test('P40-Q-09 L6 R20 机判回放：calc/fill 正确答案必判 true，全行无 false', () => {
  assert.ok(ALL.length >= 100, '回放样本量：' + ALL.length);
  ALL.forEach((q, idx) => {
    const r = gradeUserAnswer(String(q.answer.value), q.answer,
      { questionType: q.questionType, prompt: q.prompt });
    assert.notEqual(r, false, '行 ' + idx + '（' + q.questionType + '）正确答案被判 false：'
      + q.prompt + ' => ' + q.answer.value);
    if (q.questionType === 'calc' || q.questionType === 'fill') {
      assert.equal(r, true, '行 ' + idx + '（' + q.questionType + '）机判应 true：'
        + q.prompt + ' => ' + q.answer.value);
    }
    // apply 长文本说理允许 null（家长检查口径，AS-14）
  });
});
