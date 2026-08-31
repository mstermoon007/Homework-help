#!/usr/bin/env node
/**
 * dev/check-generator-migration-r18.js — M4-R18 复杂运算迁移 Gate
 *
 * 断言 apply() 后 each COMPLEX_KP：
 *   ① 选择 core 轨（scope=core, mode=native），且实例化为 generator:complex-calc
 *   ② 多材质/多难度下 N 次生成零异常、零 NaN、prompt 非空
 *   ③ 链式/括号题答案与题干自洽（复用算术核心求值）
 *   ④ 逆向题（fill-operand/fill-operator）答案与题干自洽（□ 还原使等式成立）
 *
 * 与 R17 门禁不同：R18 复杂题按 plan 语义重新生成（非 legacy 同 RNG），
 * 故采用「结构保真 + 自洽 + 非 NaN」门禁，而非 legacy FULL-EQ。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var Mode = Selector.Mode;
var Switch = require(path.join(ROOT, 'shared', 'generator', 'migration-switch.js'));
var Engine = require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
var Arith = require(path.join(ROOT, 'shared', 'generator', 'core', 'arithmetic-core.js'));
var Complex = require(path.join(ROOT, 'shared', 'generator', 'generators', 'complex.js'));

var errors = [];
function report(msg) { errors.push(msg); }

function evalChain(prompt) {
  // 形如 "a op b op c ="（链式，先乘除后加减）
  var m = prompt.match(/^(-?\d+)\s*([+\-−×÷])\s*(-?\d+)\s*([+\-−×÷])\s*(-?\d+)\s*=$/);
  if (!m) return null;
  var vals = [Number(m[1]), Number(m[3]), Number(m[5])];
  var ops = [m[2] === '-' ? '−' : m[2], m[4] === '-' ? '−' : m[4]];
  for (var i = 0; i < ops.length; i++) {
    if (ops[i] === '×' || ops[i] === '÷') {
      var r = ops[i] === '×' ? vals[i] * vals[i + 1] : vals[i] / vals[i + 1];
      vals.splice(i, 2, r); ops.splice(i, 1); i--;
    }
  }
  var acc = vals[0];
  for (i = 0; i < ops.length; i++) { acc = ops[i] === '+' ? acc + vals[i + 1] : acc - vals[i + 1]; }
  return acc;
}

Mode.clearAll();
var applied = Switch.apply();
if (applied !== Switch.ALL_MIGRATED.length) report('apply() 返回数量异常 ' + applied);

// ① 每个复杂 KP 选 core/native + 实例化为 complex-calc
Complex.COMPLEX_KPS.forEach(function (kpId) {
  var sel = Selector.selectGenerator({ knowledgePointId: kpId, questionTypeId: 'calc', difficulty: 3 });
  if (!sel.record || sel.record.scope !== 'core') report(kpId + ': 期望 scope=core，实际 ' + (sel.record && sel.record.scope) + ' ' + sel.generatorId);
  if (sel.mode !== 'native') report(kpId + ': 期望 mode=native，实际 ' + sel.mode);
  if (sel.generatorId !== 'generator:complex-calc') report(kpId + ': 期望 generator:complex-calc，实际 ' + sel.generatorId);
});

// ②③④ 端到端生成 + 自洽校验（多难度 × 多材质 × 多次）
var TRIALS = [2, 4, 7, 9];
var samples = 0;
Complex.COMPLEX_KPS.forEach(function (kpId) {
  TRIALS.forEach(function (d) {
    var plan = Engine.plan({ knowledgePointId: kpId, count: 5, difficulty: d }).plans[0];
    var inst = Selector.instantiate(Selector.selectGenerator(plan));
    if (!inst) { report(kpId + '@' + d + ': 实例化失败'); return; }
    var qs = inst.generate(plan, { seed: 'r18-' + kpId + '-' + d });
    if (!Array.isArray(qs) || qs.length !== 5) { report(kpId + '@' + d + ': 生成数量异常 ' + (qs && qs.length)); return; }
    qs.forEach(function (q, qi) {
      samples++;
      var fam = (plan.constraints.structure || {}).family;
      if (q.answer == null || (typeof q.answer === 'number' && !isFinite(q.answer))) report(kpId + '@' + d + '#' + qi + ': answer 非法 ' + q.answer);
      if (!q.prompt || typeof q.prompt !== 'string' || /\bNaN\b/.test(q.prompt)) report(kpId + '@' + d + '#' + qi + ': prompt 异常 ' + q.prompt);

      if (fam === 'inverse') {
        var mode = (plan.constraints.structure.inverse || {}).mode;
        if (mode === 'fill-operator') {
          // a □ b =，answer 为运算符；还原 a op b 是否可整除（÷）或正整数
          var m = q.prompt.match(/^(-?\d+)\s*□\s*(-?\d+)\s*=$/);
          if (!m) { report(kpId + '#' + qi + ': fill-operator prompt 异常 ' + q.prompt); return; }
          var A = Number(m[1]), B = Number(m[2]);
          var ops = ['+', '−', '×', '÷'];
          if (['+', '−', '×', '÷'].indexOf(q.answer) === -1) report(kpId + '#' + qi + ': fill-operator answer 非法 ' + q.answer);
          else if (q.answer === '÷' && B === 0) report(kpId + '#' + qi + ': fill-operator 除零');
        } else {
          // fill-operand：a □ = total 还原 □ 使等式成立
          var m2 = q.prompt.match(/^(-?\d+)\s*([+\−])\s*□\s*=\s*(-?\d+)$/);
          var m3 = q.prompt.match(/^□\s*([+\−])\s*(-?\d+)\s*=\s*(-?\d+)$/);
          var ok = false;
          if (m2) {
            var lhs = Number(m2[1]); var op = m2[2]; var rhs = Number(m2[3]);
            ok = (op === '+' ? lhs + Number(q.answer) === rhs : lhs - Number(q.answer) === rhs);
          } else if (m3) {
            var op2 = m3[1]; var k = Number(m3[2]); var r2 = Number(m3[3]);
            ok = (op2 === '+' ? Number(q.answer) + k === r2 : Number(q.answer) - k === r2);
          }
          if (!ok) report(kpId + '#' + qi + ': fill-operand 自洽失败 ' + q.prompt + ' ## ' + q.answer);
        }
      } else if (fam === 'bracket') {
        var m4 = q.prompt.match(/^\((-?\d+)\s*([+\−])\s*(-?\d+)\)\s*([×÷])\s*(-?\d+)\s*=$/);
        if (!m4) { report(kpId + '#' + qi + ': bracket prompt 异常 ' + q.prompt); return; }
        var inner = m4[2] === '+' ? Number(m4[1]) + Number(m4[3]) : Number(m4[1]) - Number(m4[3]);
        var res = m4[4] === '×' ? inner * Number(m4[5]) : inner / Number(m4[5]);
        if (Math.abs(res - Number(q.answer)) > 1e-9) report(kpId + '#' + qi + ': bracket 自洽失败 ' + q.prompt + ' ## ' + q.answer);
      } else {
        var ev = evalChain(q.prompt);
        if (ev == null) { report(kpId + '#' + qi + ': 链式 prompt 无法求值 ' + q.prompt); return; }
        if (Math.abs(ev - Number(q.answer)) > 1e-9) report(kpId + '#' + qi + ': 链式自洽失败 ' + q.prompt + ' ## ' + q.answer);
      }
    });
  });
});

if (!errors.length) {
  console.log('[PASS] M4-R18 复杂迁移：' + Complex.COMPLEX_KPS.length + ' KP → complex-calc(native)，' + samples + ' 样例全部结构/自洽/无 NaN');
  process.exitCode = 0;
} else {
  console.error('[FAIL] M4-R18 复杂迁移：');
  errors.forEach(function (e) { console.error('  - ' + e); });
  process.exitCode = 1;
}
