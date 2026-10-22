'use strict';

/**
 * tests/generation/p42-2b-participation-checker.test.js — P42-2B
 *
 * 教学目标本质参与度检查器（dev/p42/participation-checker.js）控制组回归：
 *   P1 Prompt 跨 KP 复用指标（P42-023 工具缺口）——精确/模板归一分组告警；
 *   P2 概念回指差分（基线 §7 静态规则）——名称概念词提取 + 同 KP 差分；
 *   P3 Apply 答案结构化分类（P42-025 工具缺口）——形态分类控制组。
 *
 * 纪律：检查器为 dev/ 审计层纯函数；FAIL=候选（须人工甄别）非定论；
 *       处理不了记 UNVERIFIED 不判错；零生产链改动。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
require(path.join(ROOT, 'dev', '_bundle-env.js'));
const C = require(path.join(ROOT, 'dev', 'p42', 'participation-checker.js'));
const SP = require(path.join(ROOT, 'shared', 'generator', 'core', 'semantic-parameters.js'));
const Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
const Generators = require(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'));

/* ---------------- P2 概念词提取控制组 ---------------- */

test('P2 extractNameTokens：功能词剥离、分隔、无信号三态', () => {
  assert.deepEqual(C.extractNameTokens('线段、射线、直线'), ['线段', '射线', '直线']);
  assert.deepEqual(C.extractNameTokens('认识厘米和米'), ['厘米']);
  assert.deepEqual(C.extractNameTokens('平面图形认识'), ['平面图形']);
  assert.deepEqual(C.extractNameTokens('正负数的读写'), ['正负数']);
  assert.deepEqual(C.extractNameTokens('时间单位换算'), ['时间单位']);
  // 数字碎片（11—20 / 20数 / 5以内）不构成概念词
  assert.deepEqual(C.extractNameTokens('11—20数的认识'), []);
  assert.deepEqual(C.extractNameTokens('5以内的加减法'), ['加减法']);
  // 全功能词 → 无信号（UNVERIFIED 前提）
  assert.deepEqual(C.extractNameTokens('解决问题'), []);
  assert.deepEqual(C.extractNameTokens('综合运用本册知识'), []);
  assert.deepEqual(C.extractNameTokens('整理和复习'), []);
  assert.deepEqual(C.extractNameTokens(''), []);
  assert.deepEqual(C.extractNameTokens(null), []);
});

/* ---------------- P2 差分判定控制组 ---------------- */

test('P2 记法/符号映射与元词逃逸', () => {
  const text = '填空：____ × 5 = 25';
  assert.ok(C.tokenHitOne('乘法', text), '乘法 → × 符号命中');
  assert.ok(C.tokenHitOne('小数', '计算 0.1 + 0.2'), '小数 → 小数记法命中');
  assert.ok(C.tokenHitOne('分数', '每份是它的 1/4'), '分数 → 分数记法命中');
  assert.ok(C.tokenHitOne('人民币', '小红有 1 元'), '人民币 → 元角分命中');
  assert.ok(!C.tokenHitOne('凑十法', '9 + 4 = 13'), '无映射词仅字面命中');
  // META 词不计入回指（tokenHits 过滤）
  assert.deepEqual(C.tokenHits(['分类', '乘法'], { prompt: '下列哪个算式等于 4？' }), []);
  assert.deepEqual(C.tokenHits(['分类', '乘法'], { prompt: '列式计算：2 × 3 = ?' }), ['乘法']);
});

test('P2 differentialCheck：无信号/零回指 UNVERIFIED，差分出缺失行', () => {
  const q = (t) => ({ prompt: t, answer: { explanation: '' } });
  // 名称无信号
  let r = C.differentialCheck([{ rowId: 'a', q: q('1 + 1 = ?') }], '解决问题');
  assert.equal(r.status, 'UNVERIFIED');
  assert.equal(r.reason, 'name-no-signal');
  // 全 KP 零回指（描述性名称）
  r = C.differentialCheck([{ rowId: 'a', q: q('2 × 1 = ?') }, { rowId: 'b', q: q('3 × 2 = ?') }], '乘法口诀');
  assert.equal(r.status, 'UNVERIFIED');
  assert.equal(r.reason, 'no-token-any-row');
  // 差分：有行回指、有行不回指 → PASS + missingRows 候选
  r = C.differentialCheck(
    [{ rowId: 'hit', q: q('线段有____个端点') }, { rowId: 'miss', q: q('1 + 2 = ?') }],
    '线段、射线、直线'
  );
  assert.equal(r.status, 'PASS');
  assert.equal(r.missingCount, 1);
  assert.equal(r.missingRows[0].rowId, 'miss');
  // 全行回指
  r = C.differentialCheck(
    [{ rowId: 'a', q: q('线段有____个端点') }, { rowId: 'b', q: { prompt: '', answer: { explanation: '线段有2个端点。' } } }],
    '线段、射线、直线'
  );
  assert.equal(r.status, 'PASS');
  assert.equal(r.missingCount, 0);
});

/* ---------------- P1 复用指标控制组 ---------------- */

test('P1 reuseMetrics：分级阈值（精确 ≥2 alert；模板 ≥2 watch / ≥10 alert）', () => {
  const rows = [
    { rowId: '1', kp: 'kpA', grade: 1, qt: 'fill', prompt: '下面哪个算式等于 4？' },
    { rowId: '2', kp: 'kpB', grade: 3, qt: 'choice', prompt: '下面哪个算式等于 4？' },
    { rowId: '3', kp: 'kpC', grade: 5, qt: 'fill', prompt: '5 + 3 = ?' },
    { rowId: '4', kp: 'kpD', grade: 2, qt: 'fill', prompt: '6 + 2 = ?' },
    { rowId: '5', kp: 'kpA', grade: 1, qt: 'fill', prompt: '2 + 4 = ?' }
  ];
  const m = C.reuseMetrics(rows);
  // 精确组：同字面跨 KP（rows 1/2）→ alert（≥2 阈值，基线 §3 已知设计口径）
  const exactHit = m.exact.alerts.find((g) => g.key === '下面哪个算式等于 4？');
  assert.ok(exactHit, '精确组应捕获跨 KP 同字面');
  assert.deepEqual(exactHit.kps, ['kpA', 'kpB']);
  assert.deepEqual(exactHit.grades, [1, 3]);
  assert.equal(exactHit.watch, false, '精确组 alert 不落 watch');
  // 模板组：数字归一后 5+3 / 6+2 / 2+4 同模板但仅 3 KP（<10）→ watch 记录级，不得升 alert
  const tplHit = m.template.watch.find((g) => g.key === '# + # = ?');
  assert.ok(tplHit, '模板组 3 KP 应落 watch（2~9 KP 记录级）');
  assert.deepEqual(tplHit.kps, ['kpC', 'kpD', 'kpA']);
  assert.equal(tplHit.alert, false, '3 KP 模板组不得升 alert');
  assert.equal(m.template.alerts.find((g) => g.key === '# + # = ?'), undefined, 'watch 组不得同时出现在 alerts');
  // 模板组 ≥10 KP → alert（P42-3 阈值治理：超过精确组历史最大扇出 9 = 模板签名缺失强信号）
  const ten = [];
  for (let i = 1; i <= 10; i++) ten.push({ rowId: 't' + i, kp: 'kpT' + i, grade: 3, qt: 'calc', prompt: '1 + 1 = ?' });
  const m2 = C.reuseMetrics(ten);
  const tplAlert = m2.template.alerts.find((g) => g.key === '# + # = ?');
  assert.ok(tplAlert, '模板组 10 KP 应升 alert');
  assert.equal(tplAlert.kps.length, 10);
  assert.equal(m2.template.watch.length, 0, 'alert 组不得同时出现在 watch');
  // 同 KP 同字面不告警
  const same = C.reuseMetrics([
    { rowId: '1', kp: 'kpA', grade: 1, qt: 'fill', prompt: '同题' },
    { rowId: '2', kp: 'kpA', grade: 1, qt: 'fill', prompt: '同题' }
  ]);
  assert.equal(same.exact.alerts.length, 0);
});

/* ---------------- P3 Apply 答案分类控制组 ---------------- */

test('P3 classifyApplyAnswer / classifyApplyFace：六形态控制组', () => {
  assert.equal(C.classifyApplyAnswer('28'), 'numeric');
  assert.equal(C.classifyApplyAnswer('0.06'), 'numeric');
  assert.equal(C.classifyApplyAnswer('3/4'), 'fraction');
  assert.equal(C.classifyApplyAnswer('20%'), 'percent');
  assert.equal(C.classifyApplyAnswer('举例合理即可'), 'placeholder');
  assert.equal(C.classifyApplyAnswer('如：先数再比'), 'placeholder');
  assert.equal(C.classifyApplyAnswer('平行四边形'), 'short-text');
  assert.equal(C.classifyApplyAnswer('先求总数再平均分，答案是每人 3 个苹果'), 'text');
  const face = C.classifyApplyFace([
    { rowId: '1', kp: 'a', qt: 'apply', answerValue: '28' },
    { rowId: '2', kp: 'b', qt: 'apply', answerValue: '举例合理即可' },
    { rowId: '3', kp: 'c', qt: 'apply', answerValue: '3/4' }
  ]);
  assert.deepEqual(face.counts, { numeric: 1, placeholder: 1, fraction: 1 });
});

/* ---------------- 真实生成接线（检查器消费真实 sq 形态） ---------------- */

test('P42-2B 检查器接入真实生成面：抽样行可判定、状态合法', () => {
  const SAMPLES = [
    ['math-g1-down-u03-k005', 'calc'],
    ['math-g2-up-u05-k001', 'fill'],
    ['math-g5-down-u02-k002', 'calc'],
    ['math-g3-up-u07-k001', 'fill']
  ];
  SAMPLES.forEach(([kp, qt]) => {
    const plan = SP.attachToPlan({ knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 1, seed: 'p42-2b|' + kp + '|' + qt });
    const sel = Selector.selectGenerator({ knowledgePointIds: [kp], questionTypeId: qt, difficulty: 3, count: 1 });
    const q = Generators.get(sel.generatorId).generate(plan, {})[0];
    assert.ok(q, kp + ' 产出');
    const r = C.differentialCheck([{ rowId: kp + '|' + qt, q: q }], plan.semanticParams.name);
    assert.ok(['PASS', 'UNVERIFIED'].indexOf(r.status) !== -1, kp + ' 状态合法: ' + r.status);
    if (r.status === 'PASS') assert.ok(Array.isArray(r.missingRows));
  });
});
