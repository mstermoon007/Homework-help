'use strict';

/**
 * tests/generation/p45-02-bar-intent.test.js — P45-02（B 类）：条形图设问/答案/选项三口径一致
 *
 * 背景（审计 B1–B3，KP math-g4-up-u07-k001）：
 *   B1 fill 「____年级的人数最多？多____」答案却是「四年级，58人」（复用最多人数，未答差值）；
 *   B2 apply 同源，问「多多少」答「最多人数」；
 *   B3 choice 6 个选项全为「年级+人数」，没有任何选项回答差值 ⇒ 实际无正确选项。
 *
 * 修复（唯一入口 stats.js::makeStatsQuestion 条形图题族）：
 *   BAR_Q 三项设问与答案同源（差值统一由 hiBar.value − loBar.value 派生）；
 *   choice 分支自建 4 个互异选项，必含正确项且选项覆盖设问形态；
 *   calc 差值答案与题干列式同源；judge 布尔形态不变。
 *
 * 不变量：
 *   1. 设问含「多/少多少」→ 答案必含差值（= 图形数据最大值 − 最小值）；
 *   2. 答案所报年级的值 = 图形数据最大值/最小值（指向真实柱子）；
 *   3. choice：选项 ≥4 且互异、答案在选项中、correctIndex 指向答案、至少一项含差值；
 *   4. judge 不受影响（布尔、题面无空位）；calc 题干列式与答案同源；
 *   5. 图形描述符与题干同一组数据（不出现「题面说四年级最多、图里却是别的年级」）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));

const KP = 'math-g4-up-u07-k001';

function gen(qt, d, seed) {
  const req = { knowledgePointIds: [KP], questionTypeId: qt, difficulty: d, count: 9 };
  const plan = SP.attachToPlan(Object.assign({}, req, { seed: seed }));
  const g = Generators.get(Selector.selectGenerator(req).generatorId);
  return g.generate(plan, {});
}

function seriesOf(q) {
  const g = q.data && q.data.graphic;
  assert.ok(g && g.type === 'chart' && g.subtype === 'bar',
    '条形图族应带 chart/bar 描述符，实得: ' + JSON.stringify(g));
  return g.params.data;
}

function extremes(series) {
  const vals = series.map(function (s) { return s.value; });
  const max = Math.max.apply(null, vals);
  const min = Math.min.apply(null, vals);
  return {
    max: max, min: min, diff: max - min,
    hi: series.filter(function (s) { return s.value === max; }),
    lo: series.filter(function (s) { return s.value === min; })
  };
}

function answerValue(q) {
  return String(q.answer && q.answer.value != null ? q.answer.value : '');
}

/* ------------------------------------------------------------------ *
 * B1 / B2：fill / apply —— 设问含差值 ⇒ 答案含差值，且所报年级是图形中的真实极值柱
 * ------------------------------------------------------------------ */
test('P45-02 B1/B2：fill/apply 条形图题答案含差值且指向真实极值柱', () => {
  const failures = [];
  [1, 2, 3, 4].forEach(function (d) {
    ['fill', 'apply'].forEach(function (qt) {
      ['p45-02|a', 'p45-02|b', 'p45-02|c'].forEach(function (seed) {
        gen(qt, d, seed).forEach(function (q, i) {
          const tag = KP + '/' + qt + '/d' + d + '/' + seed + '#' + i;
          const series = seriesOf(q);
          const ex = extremes(series);
          const ans = answerValue(q);
          const form = q.data && q.data.answerForm;
          const prompt = String(q.prompt);

          if (form === 'difference') {
            // 纯差值设问：答案只能是差值
            if (ans !== String(ex.diff) && ans !== ex.diff + '人') {
              failures.push(tag + ' 差值设问答案应为 ' + ex.diff + '，实为「' + ans + '」'); return;
            }
            if (!/(多|少)(多少|____)/.test(prompt)) {
              failures.push(tag + ' 差值设问题面语义缺失: ' + prompt); return;
            }
            return;
          }
          if (form !== 'label-difference') {
            failures.push(tag + ' 未知 answerForm=' + form + '：' + prompt); return;
          }
          // 「哪个年级最多/最少 + 比另一个多/少多少」（主问在首句，二者都含「人数最多/最少」字样）
          const isMax = !/年级的人数最少/.test(prompt);
          const hit = (isMax ? ex.hi : ex.lo).filter(function (s) {
            return ans.indexOf(s.label) !== -1;
          });
          if (!hit.length) {
            failures.push(tag + ' 答案所报年级「' + ans + '」不是图形' +
              (isMax ? '最大' : '最小') + '柱 ' + (isMax ? ex.max : ex.min) + ': ' + prompt); return;
          }
          if (ans.indexOf(String(ex.diff)) === -1) {
            failures.push(tag + ' 设问「多/少多少」答案缺差值 ' + ex.diff + '：' + ans); return;
          }
          if (qt === 'fill') {
            const blanks = (prompt.match(/____/g) || []).length;
            if (blanks !== 2) {
              failures.push(tag + ' fill 应有两处空位（年级 + 差值），实为 ' + blanks + ': ' + prompt);
            }
          }
        });
      });
    });
  });
  assert.deepEqual(failures, [], 'fill/apply 设问-答案不一致:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * B3：choice —— 选项必含差值形态且含正确项
 * ------------------------------------------------------------------ */
test('P45-02 B3：choice 选项覆盖设问形态、答案在选项中且 correctIndex 正确', () => {
  const failures = [];
  [1, 2, 3, 4].forEach(function (d) {
    ['p45-02|a', 'p45-02|b', 'p45-02|c'].forEach(function (seed) {
      gen('choice', d, seed).forEach(function (q, i) {
        const tag = KP + '/choice/d' + d + '/' + seed + '#' + i;
        const series = seriesOf(q);
        const ex = extremes(series);
        const ans = answerValue(q);
        const opts = q.data && q.data.options;
        const form = q.data && q.data.answerForm;
        if (!Array.isArray(opts) || opts.length < 4) {
          failures.push(tag + ' 选项应 ≥4 个，实为 ' + (opts && opts.length)); return;
        }
        if (opts.indexOf(ans) === -1) {
          failures.push(tag + ' 答案「' + ans + '」不在选项中: ' + JSON.stringify(opts)); return;
        }
        if (q.data.correctIndex !== opts.indexOf(ans)) {
          failures.push(tag + ' correctIndex=' + q.data.correctIndex +
            ' 与答案位置 ' + opts.indexOf(ans) + ' 不符'); return;
        }
        const uniq = new Set(opts);
        if (uniq.size !== opts.length) {
          failures.push(tag + ' 选项互异失败: ' + JSON.stringify(opts)); return;
        }
        if (form === 'difference') {
          if (ans !== ex.diff + '人') {
            failures.push(tag + ' 差值题答案应为 ' + ex.diff + '人，实为「' + ans + '」'); return;
          }
          if (opts.indexOf(ex.diff + '人') === -1) {
            failures.push(tag + ' 差值题选项未含差值项: ' + JSON.stringify(opts));
          }
          return;
        }
        if (form !== 'label-difference') {
          failures.push(tag + ' 未知 answerForm=' + form); return;
        }
        const isMax = !/年级的人数最少/.test(String(q.prompt));
        const hit = (isMax ? ex.hi : ex.lo).filter(function (s) { return ans.indexOf(s.label) !== -1; });
        if (!hit.length) {
          failures.push(tag + ' 答案年级「' + ans + '」不是图形' + (isMax ? '最大' : '最小') + '柱'); return;
        }
        if (ans.indexOf(String(ex.diff)) === -1) {
          failures.push(tag + ' 答案缺差值 ' + ex.diff + '：' + ans); return;
        }
        if (!opts.some(function (o) { return o.indexOf(String(ex.diff)) !== -1; })) {
          failures.push(tag + ' 选项集无任何差值项: ' + JSON.stringify(opts));
        }
      });
    });
  });
  assert.deepEqual(failures, [], 'choice 选项-设问不一致:\n' + failures.join('\n'));
});

/* ------------------------------------------------------------------ *
 * judge / calc 不受 B 类修复影响
 * ------------------------------------------------------------------ */
test('P45-02 形态守卫：judge 保持布尔且题面无空位；calc 列式与答案同源', () => {
  const failures = [];
  [1, 2, 3].forEach(function (d) {
    gen('judge', d, 'p45-02|j').forEach(function (q, i) {
      const tag = KP + '/judge/d' + d + '#' + i;
      const series = seriesOf(q);
      if (typeof q.answer.value !== 'boolean') { failures.push(tag + ' judge 答案应为布尔'); return; }
      if (/____|（\s*）|\(\s*\)/.test(String(q.prompt))) { failures.push(tag + ' judge 题面残留空位: ' + q.prompt); return; }
      const m = /\S+有\s*(\d+)\s*人/.exec(String(q.prompt));
      if (!m) { failures.push(tag + ' judge 题面缺读数: ' + q.prompt); return; }
      const shown = Number(m[1]);
      const lbl = /「([^」]+)有/.exec(String(q.prompt));
      const s = lbl && series.filter(function (x) { return x.label === lbl[1]; })[0];
      if (!s) { failures.push(tag + ' judge 题面年级不在图形数据中: ' + q.prompt); return; }
      const truth = (s.value === shown);
      if (q.answer.value !== truth) {
        failures.push(tag + ' judge 答案 ' + q.answer.value + ' ≠ 图形判定 ' + truth); return;
      }
    });
    gen('calc', d, 'p45-02|k').forEach(function (q, i) {
      const tag = KP + '/calc/d' + d + '#' + i;
      const ex = extremes(seriesOf(q));
      const m = /列式：(\d+)\s*−\s*(\d+)\s*=\s*？/.exec(String(q.prompt));
      if (!m) { failures.push(tag + ' calc 题干缺列式: ' + q.prompt); return; }
      if (Number(m[1]) !== ex.max || Number(m[2]) !== ex.min) {
        failures.push(tag + ' 列式 ' + m[1] + '−' + m[2] + ' ≠ 图形极值 ' + ex.max + '−' + ex.min); return;
      }
      if (answerValue(q) !== String(ex.diff)) {
        failures.push(tag + ' calc 答案 ' + answerValue(q) + ' ≠ 差值 ' + ex.diff); return;
      }
      if (q.data.answerForm !== 'difference') { failures.push(tag + ' calc 应声明 answerForm=difference'); }
    });
  });
  assert.deepEqual(failures, [], 'judge/calc 回归失败:\n' + failures.join('\n'));
});
