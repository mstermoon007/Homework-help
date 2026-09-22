/**
 * P0-05 FINAL Step 14-19：真实全链 E2E + 题目追溯（KP/QT/Requirements→Generator）
 * 链路：PracticeSession → GenerationAPI.generate → POL → Strategy → Plan → 唯一 Executor → Selector → Generator → Validator → Presentation
 */
'use strict';
var ROOT = '/Users/zhanggaozhang/Code/Homework Help';
var env = require(ROOT + '/dev/_bundle-env.js');
var PracticeSession = require(ROOT + '/shared/engine/practice-session.js');
var QTR = require(ROOT + '/shared/knowledge/question-type-registry.js');

var CANON_SET = {};
['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'].forEach(function (t) { CANON_SET[t] = 1; });

var fails = [];
function assert(name, cond, detail) {
  console.log((cond ? '  ✓ ' : '  ✗ ') + name + (detail ? ' — ' + detail : ''));
  if (!cond) fails.push(name);
}

var CASES = [
  { qt: 'calc',     kp: 'math-g1-up-u05-k001' },
  { qt: 'fill',     kp: 'math-g2-down-u07-k002' },
  { qt: 'choice',   kp: 'math-g2-up-u01-k001' },
  { qt: 'judge',    kp: 'math-g2-up-u01-k001' },
  { qt: 'geometry', kp: 'math-g4-down-u02-k001' },
  { qt: 'classify', kp: 'math-g2-up-u01-k001' },
  { qt: 'apply',    kp: 'math-g4-up-u06-k001' }
];

(async function main() {
  console.log('=== 七类真实全链 E2E + 追溯 ===');
  var covered = {};
  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i];
    try {
      var session = new PracticeSession({
        subject: 'math', grade: 2, count: 3,
        knowledgePointId: c.kp, questionType: c.qt
      });
      var r = await session.start();
      // SemanticQuestion[]（Generator 原始输出）与完整 GenerateResult（含 plans）由会话持有
      var qs = session.semanticQuestions || [];
      var last = session.lastSemantic || {};
      var plans = last.plans || [];
      var plan = plans[0] || null;
      var nr = plan && plan.constraints && plan.constraints.numberRange;

      // 验证 1：KP 保留（question → knowledgePointId → 原 KP）
      var kpOk = qs.length > 0 && qs.every(function (q) {
        var qk = q.knowledgePointId || (q.knowledgePointIds && q.knowledgePointIds[0]);
        return qk === c.kp;
      });
      assert(c.qt + ' [KP保留] question→knowledgeId→原KP', kpOk, qs.length + ' 题');

      // 验证 2：QT 保留（canonical）
      var qtOk = qs.length > 0 && qs.every(function (q) { return CANON_SET[q.questionType]; });
      assert(c.qt + ' [QT保留] questionType canonical', qtOk, qs.map(function (q) { return q.questionType; }).join(','));

      // 验证 3：Requirements → Generator
      // 数值型题（题面含数字）：数值必须 ⊆ plan.constraints.numberRange（Generator 只能从 plan 拿范围）；
      // 图形/判断类题（题面无数值）：验证题面由 plan 驱动生成（非空 + plan 约束存在）。
      if (nr && nr.min != null) {
        var oor = 0, checked = 0, emptyStem = 0;
        qs.forEach(function (q) {
          var text = [q.question && q.question.prompt, q.q, q.prompt, q.text,
            q.content && JSON.stringify(q.content)].filter(Boolean).map(String).join(' ');
          if (!text.trim()) emptyStem++;
          var extra = JSON.stringify(q.distractors || '') + JSON.stringify(
            q.options && typeof q.options === 'object' ? q.options : '');
          ((text + ' ' + extra).match(/\d+(?:\.\d+)?/g) || []).forEach(function (n) {
            var v = parseFloat(n);
            checked++;
            if (v < nr.min || v > nr.max) oor++;
          });
        });
        assert(c.qt + ' [题面] 非空', emptyStem === 0, qs.length + ' 题');
        if (checked > 0) {
          assert(c.qt + ' [Req→Gen] 题面数值 ⊆ constraints.numberRange(' + nr.min + '~' + nr.max + ')',
            oor === 0, '检查 ' + checked + ' 个数值，越界 ' + oor);
        } else {
          assert(c.qt + ' [Req→Gen] plan 约束传递（图形/判断题无数值，plan 携带 Requirements）',
              !!(plan && plan.constraints && plan.cognitiveLevel), 'numberRange=' + nr.min + '~' + nr.max);
        }
      } else {
        assert(c.qt + ' [Req→Gen] plan.constraints.numberRange 存在（Generator 执行依据）', !!nr);
      }

      // 验证 4：plan 携带完整 Generation Requirements（Strategy 产物）
      assert(c.qt + ' [Plan完整] questionTypeId/cognitiveLevel/difficulty/constraints',
        !!(plan && plan.questionTypeId === c.qt && plan.cognitiveLevel && plan.difficulty != null && plan.constraints),
        'cog=' + (plan && plan.cognitiveLevel) + ' diff=' + (plan && plan.difficulty));

      covered[c.qt] = true;
    } catch (e) {
      assert(c.qt + ' 全链生成', false, '异常: ' + (e && e.message));
    }
  }

  console.log('\n=== 七类覆盖 ===');
  var missing = Object.keys(CANON_SET).filter(function (t) { return !covered[t]; });
  assert('7/7 QT 全链覆盖', missing.length === 0, missing.length ? '缺失: ' + missing.join(',') : 'calc/fill/choice/judge/geometry/classify/apply 全覆盖');

  if (fails.length) { console.error('\nFAIL ' + fails.length + ' — ' + fails.join(' | ')); process.exit(1); }
  console.log('\nPASS — P0-05 全链 E2E（7/7 QT + KP/QT/Requirements 追溯）全部通过');
})().catch(function (e) { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
