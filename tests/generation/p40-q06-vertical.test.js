'use strict';

/**
 * tests/generation/p40-q06-vertical.test.js — P40-Q-06 竖式接线四层验证
 *
 * 层1  verticalPlan 课标判定矩阵（年级×运算×位数×数域 fail-closed）；
 * 层2  errorResultOf 单源矩阵（渲染与 finishJudge 共用同一错误得数，撞车防护）；
 * 层3  真实生成挂图：目标 calc 行 descriptor 契约 + 渲染 SUCCESS + 逐行防泄题 +
 *      图文一致（descriptor 操作数必须出现在题面——变式数值桶冲突探测器）；
 * 层4  finishJudge 竖式判断材料：假命题 shown 与图内错误结果单源对齐、
 *      真命题撤遮蔽显真值、撞车/div/dec fail-closed 撤图。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const Arith = require(path.join(ROOT, 'shared/generator/core/arithmetic-core.js'));
const SVGCalculation = require(path.join(ROOT, 'shared/svg/svg-calculation.js'));
const TC = require(path.join(ROOT, 'shared/generator/core/type-contract.js'));

/* ------------------------------------------------------------------ *
 * 层1 verticalPlan 课标判定矩阵
 * ------------------------------------------------------------------ */

test('P40-Q-06 verticalPlan 判定矩阵：整数轨（≥G2 加减 / ≥G3 乘除 + 位宽门槛）', () => {
  assert.deepEqual(Arith.verticalPlan(1, 23, 12, '+'), null);          // g1 不配竖式
  assert.deepEqual(Arith.verticalPlan(2, 23, 12, '+'), { kind: 'int', sub: 'add' });
  assert.deepEqual(Arith.verticalPlan(2, 3, 5, '+'), null);            // 一位数不配
  assert.deepEqual(Arith.verticalPlan(2, 456, 123, '−'), { kind: 'int', sub: 'sub' });
  assert.deepEqual(Arith.verticalPlan(2, 12, 3, '×'), null);           // 乘需 g3
  assert.deepEqual(Arith.verticalPlan(3, 12, 3, '×'), { kind: 'int', sub: 'mul' });
  assert.deepEqual(Arith.verticalPlan(2, 24, 3, '÷'), null);           // 除需 g3
  assert.deepEqual(Arith.verticalPlan(3, 24, 3, '÷'), { kind: 'int', sub: 'div' });
});

test('P40-Q-06 verticalPlan 判定矩阵：小数轨（加减 g4 / 乘 g5 / 除 fail-closed）', () => {
  assert.deepEqual(Arith.verticalPlan(3, 1.5, 2, '+'), null);
  assert.deepEqual(Arith.verticalPlan(4, 1.5, 2, '+'), { kind: 'dec', sub: 'add' });
  assert.deepEqual(Arith.verticalPlan(4, 8.3, 2.1, '−'), { kind: 'dec', sub: 'sub' });
  assert.deepEqual(Arith.verticalPlan(4, 1.5, 2, '×'), null);
  assert.deepEqual(Arith.verticalPlan(5, 1.5, 2, '×'), { kind: 'dec', sub: 'mul' });
  assert.deepEqual(Arith.verticalPlan(6, 1.5, 0.5, '÷'), null);        // 小数除不配
});

test('P40-Q-06 verticalPlan 判定矩阵：负数/越界/非法输入 fail-closed', () => {
  assert.deepEqual(Arith.verticalPlan(2, -3, 5, '+'), null);           // 负数不配（neg-add-sub 防御）
  // 负结果（a<b 减法）超纲 fail-closed（R9 采样缺口挂账生成器侧，竖式不背书）
  assert.deepEqual(Arith.verticalPlan(4, 1.1, 1.2, '−'), null);        // 小数减负结果（g4-u06-k002 seed11 复现）
  assert.deepEqual(Arith.verticalPlan(2, 12, 30, '−'), null);          // 整数减负结果
  assert.deepEqual(Arith.verticalPlan(0, 23, 12, '+'), null);
  assert.deepEqual(Arith.verticalPlan(9, 23, 12, '+'), null);
  assert.deepEqual(Arith.verticalPlan(2, NaN, 1, '+'), null);
  assert.deepEqual(Arith.verticalPlan(2, 23, Infinity, '+'), null);
  assert.deepEqual(Arith.verticalPlan(2, 23, 12, '%'), null);
  assert.strictEqual(Arith.verticalPlan(4, 1.2, 1.1, '−').sub, 'sub'); // 正结果照常配（a>b 减法）
});

/* ------------------------------------------------------------------ *
 * 层2 errorResultOf 单源矩阵
 * ------------------------------------------------------------------ */

test('P40-Q-06 errorResultOf 单源矩阵：no-carry / no-borrow 与撞车防护', () => {
  assert.strictEqual(SVGCalculation.errorResultOf('add', [456, 378], 'no-carry'), 724);
  assert.strictEqual(SVGCalculation.errorResultOf('sub', [502, 217], 'no-borrow'), 315);
  assert.strictEqual(SVGCalculation.errorResultOf('mul', [243, 45], 'no-carry'), 8625);
  // 撞车用例：错误得数恰等于真值 → 上层必须据此撤图（errV === an.num 分支）
  assert.strictEqual(SVGCalculation.errorResultOf('add', [200, 300], 'no-carry'), 500);
  assert.strictEqual(SVGCalculation.errorResultOf('sub', [30, 20], 'no-borrow'), 10);
  // 非法输入 fail-closed
  assert.strictEqual(SVGCalculation.errorResultOf('add', [1, 2], 'bogus'), null);
  assert.strictEqual(SVGCalculation.errorResultOf('add', ['x', 2], 'no-carry'), null);
  assert.strictEqual(SVGCalculation.errorResultOf('sub', [5], 'no-borrow'), null);
  assert.strictEqual(SVGCalculation.errorResultOf('div', [10, 2], 'no-carry'), null);
});

test('P40-Q-06 gradeOfKp 年级解析（解析失败 fail-closed 返回 0）', () => {
  assert.strictEqual(Arith.gradeOfKp('math-g2-up-u03-k001'), 2);
  assert.strictEqual(Arith.gradeOfKp('math-g5-up-u02-k002'), 5);
  assert.strictEqual(Arith.gradeOfKp('no-grade-kp'), 0);
});

/* ------------------------------------------------------------------ *
 * 层3 真实生成：挂图契约 + 渲染 SUCCESS + 逐行防泄题 + 图文一致
 * ------------------------------------------------------------------ */

global.window = global;
['shared/svg/svg-core.js', 'shared/svg/svg-calculation.js',
  'shared/presentation/svg-sanitizer.js', 'shared/presentation/svg-registry.js'
].forEach(function (rel) { require(path.join(ROOT, rel)); });
const GraphicRenderer = require(path.join(ROOT, 'shared/generator/graphic-renderer.js'));
require(path.join(ROOT, 'dev/_bundle-env.js'));
const PracticeSession = require(path.join(ROOT, 'shared/engine/practice-session.js'));

/** SVG 文本节点按 y 分组重建「渲染行」（进/借位点为 circle 不计入；属性顺序无关） */
function svgRows(svg) {
  var re = /<text\b([^>]*)>([^<]*)<\/text>/g;
  var m, cells = [];
  while ((m = re.exec(svg))) {
    var attrs = m[1];
    var xm = /x="(-?[\d.]+)"/.exec(attrs);
    var ym = /y="(-?[\d.]+)"/.exec(attrs);
    if (!xm || !ym) continue;
    cells.push({ y: parseFloat(ym[1]), x: parseFloat(xm[1]), ch: m[2] });
  }
  var byY = {};
  cells.forEach(function (c) { (byY[c.y] = byY[c.y] || []).push(c); });
  return Object.keys(byY).map(function (y) {
    return byY[y].sort(function (a, b) { return a.x - b.x; })
      .map(function (c) { return c.ch; }).join('');
  });
}

function calcGraphicOf(sq) {
  if (sq.graphic && sq.graphic.type === 'calculation') return sq.graphic;
  if (sq.data && sq.data.graphic && sq.data.graphic.type === 'calculation') return sq.data.graphic;
  return null;
}

var P40Q06_TARGETS = [
  { kp: 'math-g2-down-u05-k001', grade: 2 },   // 三位数加法竖式（应配：整数加）
  { kp: 'math-g2-down-u05-k002', grade: 2 },   // 三位数减法竖式（应配：整数减）
  { kp: 'math-g4-up-u03-k002', grade: 4 },     // 笔算乘法（应配：整数乘）
  { kp: 'math-g4-down-u06-k001', grade: 4 },   // 位数相同的小数加减法
  { kp: 'math-g4-down-u06-k002', grade: 4 },   // 位数不同的小数加减法
  { kp: 'math-g5-up-u02-k001', grade: 5 },     // 小数乘整数
  { kp: 'math-g5-up-u02-k002', grade: 5 }      // 小数乘小数
];

test('P40-Q-06 真实生成：竖式 descriptor 契约 + 渲染 SUCCESS + 逐行防泄题 + 图文一致', async () => {
  var totalHits = 0;
  var report = [];
  for (var t = 0; t < P40Q06_TARGETS.length; t++) {
    var target = P40Q06_TARGETS[t];
    var hits = 0;
    for (var s = 0; s < 12; s++) {
      var session = new PracticeSession({
        subject: 'math', grade: target.grade, count: 1, difficulty: 2,
        knowledgePointId: target.kp, questionType: 'calc',
        seed: 'p40q06|' + target.kp + '|calc|' + s
      });
      await session.start();
      var sq = (session.semanticQuestions || [])[0];
      if (!sq) continue;
      var g = calcGraphicOf(sq);
      if (!g) continue;
      hits++;
      // 契约：role / 遮蔽形态
      assert.strictEqual(g.role, 'calculation-support',
        target.kp + ' seed ' + s + ' role 应为 calculation-support');
      assert.ok(g.params && g.params.options && g.params.options.maskResult === true,
        target.kp + ' seed ' + s + ' calc 竖式必须 maskResult 遮蔽');
      // 渲染必须 SUCCESS（禁止 UNSUPPORTED/FAILED 断链）
      var rr = GraphicRenderer.render(g);
      assert.strictEqual(rr.status, 'SUCCESS',
        target.kp + ' seed ' + s + ' 竖式渲染失败: ' + (rr.reason || ''));
      // 逐行防泄题：任一渲染行不得等于真值答案（遮蔽行恒为 '?'）
      var ansStr = String(sq.answer.value).trim();
      var aStr = String(g.params.a), bStr = String(g.params.b);
      var rows = svgRows(rr.svg);
      if (ansStr !== aStr && ansStr !== bStr) {
        assert.ok(rows.indexOf(ansStr) === -1,
          target.kp + ' seed ' + s + ' 泄题：SVG 行含真值 ' + ansStr + '，行集=' + JSON.stringify(rows));
      }
      assert.ok(rows.indexOf('?') !== -1,
        target.kp + ' seed ' + s + ' 遮蔽形态缺 ? 行：' + JSON.stringify(rows));
      // 操作数行必须真实在图（descriptor 与图形单源）。
      // 渲染形态容忍：运算符与第二操作数同行（"+404"）；小数竖式整数操作数按
      // 数位对齐惯例补小数点占位（2.2−2 第二行渲染 "−2."）——剥前缀与尾点后比对
      var bareRows = rows.map(function (r) {
        return r.replace(/^[+\-−×÷*/]+/, '').replace(/\.+$/, '');
      });
      assert.ok(bareRows.indexOf(aStr) !== -1 && bareRows.indexOf(bStr) !== -1,
        target.kp + ' seed ' + s + ' 操作数行缺失：' + JSON.stringify(rows));
      // 图文一致：descriptor 操作数必须出现在题面（变式数值桶冲突探测器）
      var promptNums = String(sq.prompt).match(/\d+(?:\.\d+)?/g) || [];
      assert.ok(promptNums.indexOf(aStr) !== -1 && promptNums.indexOf(bStr) !== -1,
        target.kp + ' seed ' + s + ' 图文不一致：descriptor (' + aStr + ',' + bStr +
        ') 不在题面数字 ' + JSON.stringify(promptNums) + ' 中，题面=' + sq.prompt);
    }
    report.push(target.kp + ':' + hits + '/12');
    totalHits += hits;
  }
  // 20 行口径的抽样证明：七个目标 KP 合计至少 8 行真实挂上竖式
  assert.ok(totalHits >= 8, '竖式挂图命中不足（' + totalHits + '）：' + report.join(' '));
});

/* ------------------------------------------------------------------ *
 * 层4 finishJudge 竖式判断材料单源对齐（enforce 转换点）
 * ------------------------------------------------------------------ */

function judgeFixture(seed, subtype, a, b, answerNum) {
  return {
    id: 'j-' + seed, knowledgePointId: 'math-g2-down-u05-k001', questionType: 'judge',
    prompt: a + ' + ' + b + ' = ?', seed: 'p40q06|judge|' + subtype + '|' + seed,
    answer: { value: String(answerNum), acceptable: [] }, answerMode: 'input',
    data: {
      graphic: {
        type: 'calculation', subtype: subtype, role: 'calculation-support',
        params: { a: a, b: b, options: { maskResult: true } }
      }
    }
  };
}

test('P40-Q-06 finishJudge：假命题 shown=图内错误得数（单源），真命题撤遮蔽显真值', () => {
  var sawTrue = false, sawFake = false;
  for (var i = 0; i < 40; i++) {
    var arr = [judgeFixture(i, 'add', 456, 378, 834)];
    TC.enforce(arr, { questionTypeId: 'judge' });
    var sq = arr[0];
    assert.ok(sq, 'judge 候选不应被 drop');
    if (!sq) continue;
    assert.strictEqual(sq.answerMode, 'judge');
    assert.strictEqual(typeof sq.answer.value, 'boolean');
    var d = sq.data;
    var g = d.graphic;
    if (sq.answer.value === true) {
      sawTrue = true;
      // 真命题：撤遮蔽显真值（options 置空），图内结果行 = 真值 = shown
      assert.ok(g, '真命题应保留竖式并撤遮蔽');
      assert.deepEqual(g.params.options, {});
      assert.strictEqual(d.shownResult, '834');
      assert.ok(/834/.test(sq.prompt), '题面应含 shown：' + sq.prompt);
    } else {
      sawFake = true;
      // 假命题：shown 与错误竖式同源（errorResultOf），options 携 errorType
      var errV = SVGCalculation.errorResultOf('add', [456, 378], 'no-carry'); // 724
      assert.strictEqual(d.shownResult, String(errV));
      assert.ok(g && g.params.options && g.params.options.errorType === 'no-carry',
        '假命题 descriptor 应携 errorType');
      assert.ok(sq.prompt.indexOf(String(errV)) !== -1, '题面应含错误得数：' + sq.prompt);
      // 渲染该 descriptor：图内结果行 = shown；且不得出现真值行
      var rr = GraphicRenderer.render(g);
      assert.strictEqual(rr.status, 'SUCCESS');
      var rows = svgRows(rr.svg);
      assert.ok(rows.indexOf(String(errV)) !== -1,
        '图内应有错误结果行 724：' + JSON.stringify(rows));
      assert.ok(rows.indexOf('834') === -1, '假命题竖式不得出现真值行');
    }
  }
  assert.ok(sawTrue && sawFake, '40 seed 应同时覆盖真/假两分支');
});

test('P40-Q-06 finishJudge：撞车（errV===真值）/div/dec 形态 fail-closed 撤图', () => {
  // 撞车：200+300 no-carry = 500 === 真值 → 撤图回退 ±1
  var crash = [judgeFixture(1, 'add', 200, 300, 500)];
  TC.enforce(crash, { questionTypeId: 'judge' });
  var c = crash[0];
  assert.ok(c, '撞车候选转 judge 不应 drop');
  if (c.answer.value === false) {
    assert.strictEqual(c.data.graphic, undefined, '撞车假命题必须撤图');
    assert.strictEqual(c.data.shownResult, '501');   // ±1 口径兜底
  } else {
    assert.deepEqual(c.data.graphic.params.options, {}); // 真命题正常撤遮蔽
  }
  // div：无 errorType 能力 → 真/假命题均撤图
  var divArr = [{
    id: 'j-div', knowledgePointId: 'math-g3-down-u02-k002', questionType: 'judge',
    prompt: '84 ÷ 4 = ?', seed: 'p40q06|judge|div|1',
    answer: { value: '21', acceptable: [] }, answerMode: 'input',
    data: { graphic: { type: 'calculation', subtype: 'div', role: 'calculation-support',
      params: { a: 84, b: 4, options: { maskResult: true } } } }
  }];
  TC.enforce(divArr, { questionTypeId: 'judge' });
  if (divArr[0] && divArr[0].answer.value === false) {
    assert.strictEqual(divArr[0].data.graphic, undefined, 'div 假命题必须撤图');
  }
  // dec subtype：假命题撤图，真命题撤遮蔽
  var decFake = [{
    id: 'j-dec', knowledgePointId: 'math-g4-down-u06-k001', questionType: 'judge',
    prompt: '1.5 + 2.3 = ?', seed: 'p40q06|judge|dec|3',
    answer: { value: '3.8', acceptable: [] }, answerMode: 'input',
    data: { graphic: { type: 'calculation', subtype: 'dec', role: 'calculation-support',
      params: { a: '1.5', b: '2.3', op: '+', options: { maskResult: true } } } }
  }];
  TC.enforce(decFake, { questionTypeId: 'judge' });
  assert.ok(decFake[0], 'dec 候选不应 drop');
  if (decFake[0].answer.value === false) {
    assert.strictEqual(decFake[0].data.graphic, undefined, 'dec 假命题必须撤图');
  } else {
    assert.deepEqual(decFake[0].data.graphic.params.options, {});
  }
});

/* ------------------------------------------------------------------ *
 * judge 行回归：selection-judge 产线不受影响（boolean 直产，无竖式副作用）
 * ------------------------------------------------------------------ */

test('P40-Q-06 judge 行回归：selection-judge 输出形态不变、无 calc descriptor 副作用', async () => {
  for (var i = 0; i < 10; i++) {
    var session = new PracticeSession({
      subject: 'math', grade: 2, count: 1, difficulty: 2,
      knowledgePointId: 'math-g2-up-u05-k005', questionType: 'judge',
      seed: 'p40q06|judge-reg|' + i
    });
    await session.start();
    var sq = (session.semanticQuestions || [])[0];
    if (!sq) continue;
    assert.strictEqual(typeof sq.answer.value, 'boolean',
      'selection-judge 直产 boolean 不应被改写');
    assert.strictEqual(calcGraphicOf(sq), null,
      'judge 行不应意外携带 calc descriptor');
  }
});
