'use strict';

/**
 * tests/validator/p45-07-quality-gates.test.js — P45-07（V-A～V-E）Validator 实例一致性门禁
 *
 * 五条门禁（任务书 §3）：
 *   V-A 图元数量与答案一致（data.figureCount，接入 answer-validator.validateInstanceConsistency）
 *   V-B 设问-答案形态一致（data.answerForm=difference/label-difference → 答案/选项须含数值）
 *   V-C 分数既约（分母 1 恒禁；计算结果非互质禁）
 *   V-D 图形描述符与题面一致（装饰指纹 / 刻度尺 from-to / 长方形·正方形尺寸）
 *   V-E 判断题题干无空位（去掉尾部作答括号后不得含 ____ 或内部空括号）
 *
 * 每类验证两件事：
 *   1. 缺陷构造 → 门禁 100% 命中（修复前缺陷可复现）；
 *   2. 真实 ALLOW 行（PracticeSession，生产口径）→ 零误报。
 * 全量 1566 行零违规证据由门禁 23（dev/p42/check-instance-gates.js）输出。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const env = require(path.join(ROOT, 'dev', '_bundle-env.js'));
const AV = require(path.join(ROOT, 'shared', 'validator', 'answer-validator.js'));
const QS = require(path.join(ROOT, 'shared', 'validator', 'quality-scorer.js'));
const KCV = require(path.join(ROOT, 'shared', 'capability', 'knowledge-capability-view.js'));
const QTR = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
const PracticeSession = require(path.join(ROOT, 'shared', 'engine', 'practice-session.js'));

const ALL = QTR.TYPES.map(function (t) { return t.id; });

function mk(over) {
  return Object.assign({
    knowledgePointId: 'k', questionType: 'fill', prompt: '', answer: { value: '' }, data: {}
  }, over || {});
}

function codesOf(errors) {
  return (errors || []).map(function (e) { return String(e && (e.message || e)); });
}

/* ------------------------------------------------------------------ *
 * V-A：图元计数 = 答案
 * ------------------------------------------------------------------ */
test('P45-07 V-A 命中：figureCount=4 而答案=1', function () {
  const sq = mk({ questionType: 'fill', answer: { value: '1' }, data: { figureCount: 4 } });
  const errs = AV.validateInstanceConsistency(sq);
  assert.equal(errs.length, 1);
  assert.match(codesOf(errs)[0], /V-A/);
});

test('P45-07 V-A 通过：figureCount=4 且答案=4', function () {
  const sq = mk({ questionType: 'fill', answer: { value: '4' }, data: { figureCount: 4 } });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

/* ------------------------------------------------------------------ *
 * V-B：差值设问 ↔ 数值答案/选项
 * ------------------------------------------------------------------ */
test('P45-07 V-B 命中：问「多多少」答案只有年级名', function () {
  const sq = mk({ questionType: 'fill', answer: { value: '四年级' }, data: { answerForm: 'difference' } });
  const errs = AV.validateInstanceConsistency(sq);
  assert.equal(errs.length, 1);
  assert.match(codesOf(errs)[0], /V-B/);
});

test('P45-07 V-B 通过：差值答案含数值', function () {
  const sq = mk({ questionType: 'fill', answer: { value: '58人' }, data: { answerForm: 'difference' } });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-B 命中：choice 选项无任何数值', function () {
  const sq = mk({
    questionType: 'choice', answer: { value: '四班' }, data: { answerForm: 'label-difference', options: ['四班', '五班'] },
    distractors: [{ value: '五班' }, { value: '六班' }]
  });
  const errs = AV.validateInstanceConsistency(sq);
  // 答案无值 + 选项无数值 → 两条 V-B（答案形态、选项形态各一条），全为 V-B 即命中
  assert.ok(errs.length >= 1);
  assert.match(codesOf(errs)[0], /V-B/);
});

test('P45-07 V-B 通过：choice 选项含差值项', function () {
  const sq = mk({
    questionType: 'choice', answer: { value: '58人' }, data: { answerForm: 'label-difference', options: ['58人', '46人', '42人', '12人'] }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

/* ------------------------------------------------------------------ *
 * V-C：分数形态（分母 1 恒禁；非互质仅 calc）
 * ------------------------------------------------------------------ */
test('P45-07 V-C 命中：分母为 1 必须折叠为整数', function () {
  assert.deepEqual(QS.checkFractionForm(mk({ questionType: 'fill', answer: { value: '4/1' } })), ['V-C 分数分母为 1，必须折叠为整数：4/1']);
});

test('P45-07 V-C 命中：calc 结果未约分', function () {
  const issues = QS.checkFractionForm(mk({ questionType: 'calc', answer: { value: '3/9' } }));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /未约分/);
});

test('P45-07 V-C 无误报：fill/choice 的 3/9 是分数意义表意', function () {
  assert.deepEqual(QS.checkFractionForm(mk({ questionType: 'fill', answer: { value: '3/9' } })), []);
  assert.deepEqual(QS.checkFractionForm(mk({ questionType: 'choice', answer: { value: '3/9' } })), []);
  assert.deepEqual(QS.checkFractionForm(mk({ questionType: 'calc', answer: { value: '0.5' } })), []);
});

/* ------------------------------------------------------------------ *
 * V-D：描述符 ↔ 题面
 * ------------------------------------------------------------------ */
test('P45-07 V-D 命中：固定装饰矩形 8×3 labelSides=false', function () {
  const sq = mk({
    questionType: 'geometry', prompt: '看图回答问题',
    answer: { value: '5' },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 8, height: 3, labelSides: false } } }
  });
  const errs = AV.validateInstanceConsistency(sq);
  assert.equal(errs.length, 1);
  assert.match(codesOf(errs)[0], /V-D/);
});

test('P45-07 V-D 命中：刻度尺 from/to 与题面读数不符', function () {
  const sq = mk({
    questionType: 'geometry', prompt: '铅笔左端对着刻度 2，右端对着刻度 10，铅笔长几厘米？',
    answer: { value: '8' },
    data: { graphic: { type: 'geometry', subtype: 'ruler', params: { from: 3, to: 9 } } }
  });
  const errs = AV.validateInstanceConsistency(sq);
  assert.ok(errs.length > 0);
  assert.match(codesOf(errs)[0], /V-D/);
});

test('P45-07 V-D 通过：刻度尺与题面读数逐一相同', function () {
  const sq = mk({
    questionType: 'geometry', prompt: '铅笔左端对着刻度 2，右端对着刻度 10，铅笔长几厘米？',
    answer: { value: '8' },
    data: { graphic: { type: 'geometry', subtype: 'ruler', params: { from: 2, to: 10 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 命中：长方形尺寸与题面不符', function () {
  const sq = mk({
    questionType: 'fill', prompt: '长方形长 6 厘米、宽 4 厘米，周长是____厘米',
    answer: { value: '20' },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 7, height: 3 } } }
  });
  const errs = AV.validateInstanceConsistency(sq);
  assert.ok(errs.length > 0);
  assert.match(codesOf(errs)[0], /V-D/);
});

test('P45-07 V-D 通过：长方形尺寸与题面一致', function () {
  const sq = mk({
    questionType: 'fill', prompt: '长方形长 6 厘米、宽 4 厘米，周长是____厘米',
    answer: { value: '20' },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 6, height: 4 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 通过：正方形边长与题面一致', function () {
  const sq = mk({
    questionType: 'fill', prompt: '正方形边长 5 厘米，周长是____厘米',
    answer: { value: '20' },
    data: { graphic: { type: 'geometry', subtype: 'square', params: { size: 5, labelSides: true } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 作用域：主题图标（width+size 归一化）不按题面尺寸判定', function () {
  // R5 议题（KP 名首命中 → 主题图标，用户裁决搁置）不属本门禁；图标 params 为归一化尺寸。
  const iconSquare = mk({
    questionType: 'fill', prompt: '正方形边长 7 厘米，周长是____厘米',
    answer: { value: '28' },
    data: { graphic: { type: 'geometry', subtype: 'square', params: { width: 2, size: 1, labelSides: true } } }
  });
  const iconRect = mk({
    questionType: 'fill', prompt: '长方形长 6 厘米、宽 4 厘米，周长是____厘米',
    answer: { value: '20' },
    data: { graphic: { type: 'geometry', subtype: 'square', params: { width: 1, size: 2, labelSides: true } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(iconSquare), []);
  assert.deepEqual(AV.validateInstanceConsistency(iconRect), []);
});

/* ------------------------------------------------------------------ *
 * V-D 图文同名（D2）：题面点名的具体图形 vs 描述符 subtype
 * ------------------------------------------------------------------ */
test('P45-07 V-D 命中：题面问长方形，描述符为正方形（D2 复现形态）', function () {
  const sq = mk({
    questionType: 'fill', prompt: '长方形有____个直角',
    answer: { value: '4' },
    data: { graphic: { type: 'geometry', subtype: 'square', params: { width: 7, height: 3 } } }
  });
  const errs = AV.validateInstanceConsistency(sq);
  assert.equal(errs.length, 1);
  assert.match(codesOf(errs)[0], /V-D 题面图形名与描述符不符/);
});

test('P45-07 V-D 通过：题面问长方形，描述符同名', function () {
  const sq = mk({
    questionType: 'fill', prompt: '长方形有____个直角',
    answer: { value: '4' },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 7, height: 3 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 作用域：题面同时点名多个图形时不做单一归属判定', function () {
  const sq = mk({
    questionType: 'fill', prompt: '长方形和正方形都有____个直角',
    answer: { value: '4' },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 7, height: 3 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 作用域：count 描述符取 params.shape 比对', function () {
  const ok = mk({
    questionType: 'fill', prompt: '图中共有几个正方形？',
    answer: { value: '4' },
    data: { graphic: { type: 'geometry', subtype: 'count', params: { shape: 'square', count: 4 } } }
  });
  const bad = mk({
    questionType: 'fill', prompt: '图中共有几个长方形？',
    answer: { value: '4' },
    data: { graphic: { type: 'geometry', subtype: 'count', params: { shape: 'square', count: 4 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(ok), []);
  assert.match(codesOf(AV.validateInstanceConsistency(bad))[0], /V-D 题面图形名与描述符不符/);
});

test('P45-07 V-D 作用域：复合描述符（view-cards）不宣称单一图形名，跳过', function () {
  const sq = mk({
    questionType: 'fill', prompt: '下面的长方体从正面看是____形',
    answer: { value: '长方' },
    data: { graphic: { type: 'geometry', subtype: 'view-cards', params: { views: [[1, 2], [2, 3]] } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 作用域：判断题命题文本不参与图文同名判定', function () {
  const sq = mk({
    questionType: 'judge', prompt: '判断对错——「圆有无数条对称轴」。这个说法对吗？',
    answer: { value: true },
    data: { graphic: { type: 'geometry', subtype: 'rectangle', params: { width: 2, height: 1 } } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-D 作用域：构词成分（乒乓球/羽毛球）不算图形名', function () {
  // 6f 复现行：题面里的「球」只是运动器材词尾，不是配图对象
  const sq = mk({
    questionType: 'apply', prompt: '先调查小组里会打乒乓球和会打羽毛球的人数，再算至少会一样的有多少人',
    answer: { value: '8' },
    data: { graphic: { type: 'geometry', subtype: 'circle', params: {} } }
  });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

/* ------------------------------------------------------------------ *
 * V-E：判断题无空位
 * ------------------------------------------------------------------ */
test('P45-07 V-E 命中：判断题题干残留 ____', function () {
  const sq = mk({ questionType: 'judge', prompt: '判断对错：15米 = ____ 厘米。', answer: { value: true } });
  const errs = AV.validateInstanceConsistency(sq);
  assert.equal(errs.length, 1);
  assert.match(codesOf(errs)[0], /V-E/);
});

test('P45-07 V-E 命中：判断题题干内部空括号', function () {
  const sq = mk({ questionType: 'judge', prompt: '判断对错：所有的（  ）都是正方形。', answer: { value: false } });
  assert.ok(AV.validateInstanceConsistency(sq).length > 0);
});

test('P45-07 V-E 通过：尾部作答括号不属空位', function () {
  const sq = mk({ questionType: 'judge', prompt: '判断对错：1千米=1000米（  ）', answer: { value: true } });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

test('P45-07 V-E 作用域：fill 保留空位不触发 V-E', function () {
  const sq = mk({ questionType: 'fill', prompt: '单位换算填空：15米 = ____ 厘米', answer: { value: '1500' } });
  assert.deepEqual(AV.validateInstanceConsistency(sq), []);
});

/* ------------------------------------------------------------------ *
 * 接线证据：validateAnswer（Pipeline Layer 1）真实返回 V 门禁错误
 * ------------------------------------------------------------------ */
test('P45-07 接线：validateAnswer 输出 V 门禁错误（Generation 面失败）', function () {
  const sq = mk({ questionType: 'fill', prompt: '图中共有几个三角形？', answer: { value: '1' }, data: { figureCount: 4 } });
  const r = AV.validateAnswer(sq);
  assert.equal(r.valid, false);
  assert.equal(r.checks.answer, 'fail');
  assert.ok(r.errors.some(function (e) { return /V-A/.test(String(e && (e.message || e))); }));
});

/* ------------------------------------------------------------------ *
 * 真实行零误报（PracticeSession 生产口径，seed 与门禁 23 一致）
 * ------------------------------------------------------------------ */
const REAL_ROWS = [
  { kp: 'math-g1-down-u01-k001', qt: 'fill' },      // V-A 计数
  { kp: 'math-g4-up-u02-k001', qt: 'fill' },        // V-A 角的计数
  { kp: 'math-g4-up-u07-k001', qt: 'fill' },        // V-B 条形图差值（P45-02 修复行）
  { kp: 'math-g4-up-u07-k001', qt: 'choice' },      // V-B 条形图选项
  { kp: 'math-g5-down-u04-k002', qt: 'fill' },      // V-C 分数意义（3/9 不得约分）
  { kp: 'math-g5-down-u06-k001', qt: 'calc' },      // V-C 分数计算（须既约）
  { kp: 'math-g2-up-u05-k002', qt: 'geometry' },    // V-D 刻度尺
  { kp: 'math-g3-down-u08-k003', qt: 'fill' },      // V-D 长方形尺寸
  { kp: 'math-g3-down-u08-k006', qt: 'apply' },     // V-D 作用域：题面「乒乓球/羽毛球」非图形名
  { kp: 'math-g2-up-u05-k001', qt: 'judge' },       // V-E 单位换算判断题
  { kp: 'math-g3-up-u03-k001', qt: 'judge' }        // V-E 度量判断题
];

function gradeOf(kp) {
  const m = /^math-g(\d)-/.exec(kp);
  return m ? Number(m[1]) : 1;
}

test('P45-07 真实行零误报：登记行 PracticeSession 产出无 V-A~V-E 违规', async function () {
  const failures = [];
  let checked = 0;
  for (const row of REAL_ROWS) {
    const ev = KCV.buildEligibility([row.kp], ALL);
    const m = (ev.matrix && ev.matrix[row.kp]) || {};
    if (m[row.qt] !== 'ALLOW') continue; // 非 ALLOW 组合不纳入本门禁面
    const sess = new PracticeSession({
      subject: 'math', grade: gradeOf(row.kp), count: 1, difficulty: 3,
      knowledgePointId: row.kp, questionType: row.qt,
      seed: 'p42|' + row.kp + '|' + row.qt + '|d3'
    });
    await sess.start();
    const q = (sess.semanticQuestions || [])[0];
    if (!q) { failures.push(row.kp + '/' + row.qt + ' 无产出'); continue; }
    checked++;
    const inst = AV.validateInstanceConsistency(q);
    const frac = QS.checkFractionForm(q);
    if (inst.length) failures.push(row.kp + '/' + row.qt + ' ' + codesOf(inst)[0]);
    if (frac.length) failures.push(row.kp + '/' + row.qt + ' ' + frac[0]);
  }
  assert.ok(checked >= 6, '纳入校验的真实行不足（checked=' + checked + '）');
  assert.deepEqual(failures, [], '真实行 V 门禁误报:\n' + failures.join('\n'));
});
