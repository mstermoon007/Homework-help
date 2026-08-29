#!/usr/bin/env node
/*
 * dev/test-difficulty-static.js — 静态多维难度引擎单元测试
 * 覆盖：
 *  1) 维度评分函数自检
 *  2) D 加权公式交叉验证（与引擎内部实现一致）
 *  3) 多维度组合输出落在 1-10 且单调性合理
 *  4) 缺省/部分元数据回退正常（不抛错、结果合理）
 *  5) 同一知识点「应用」题难度高于「计算」题
 *  6) 真实知识点端到端
 */
'use strict';

global.KnowledgeBank = global.KnowledgeBank || {};
const DS = require('../shared/difficulty-static.js');
const Difficulty = require('../shared/difficulty.js');
const bank = require('../shared/knowledge-bank.js');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.error('  ✗ ' + msg); }
  else console.log('  ✓ ' + msg);
}
function clamp01(n) { n = Number(n); if (!isFinite(n)) return 0; return n < 0 ? 0 : (n > 1 ? 1 : n); }
function clamp10(n) { n = Math.round(Number(n)); if (!isFinite(n)) n = 3; return n < 1 ? 1 : (n > 10 ? 10 : n); }
function approx(a, b, eps) { return Math.abs(a - b) <= (eps || 1e-9); }

// 与引擎一致的类型推断：applicable 取系数最大者；无则 null(→0.5)
function inferredType(kp) {
  const arr = kp.applicable_question_types;
  if (!arr || !arr.length) return null;
  let best = arr[0], bx = -1;
  arr.forEach(t => { const x = t.coefficient == null ? 0 : t.coefficient; if (x > bx) { bx = x; best = t; } });
  return best.type;
}
// 独立于引擎、按规范公式重算 D 与各维度（用于交叉验证）
function recompute(kp, qt) {
  const G = (kp.max_spiral_level && kp.max_spiral_level > 1)
    ? clamp01((kp.spiral_level - 1) / (kp.max_spiral_level - 1)) : 0;
  const st = Difficulty.difficultyToStructure(kp.difficulty != null ? kp.difficulty : 3);
  const S = DS.calcStructureScore(st.steps, st.allowBracket, st.allowMultDiv);
  const C = DS.mapCognitive(kp.cognitive_level);
  const qtResolved = (qt != null && qt !== '') ? qt : inferredType(kp);
  const T = DS.getTypeCoefficient(qtResolved);
  const St = clamp01((Number(kp.max_steps_default || 1) - 1) / 4);
  const N = DS.calcNumberScore(kp.number_range_default);
  const A = DS.getContextScore(kp.context_default);
  const wsum = 0.15 * G + 0.20 * S + 0.15 * C + 0.10 * T + 0.15 * St + 0.10 * N + 0.15 * A;
  const D = 1 + 9 * wsum;
  return { G: G, S: S, C: C, T: T, St: St, N: N, A: A, D: D, level: clamp10(D) };
}

console.log('\n=== 1) 维度评分函数自检 ===');
assert(DS.mapCognitive('了解') === 0 && DS.mapCognitive('理解') === 0.33 && DS.mapCognitive('掌握') === 0.67 && DS.mapCognitive('运用') === 1.0, 'mapCognitive 映射正确');
assert(DS.getTypeCoefficient('计算') === 0.2 && DS.getTypeCoefficient('填空') === 0.25 && DS.getTypeCoefficient('判断') === 0.3 &&
  DS.getTypeCoefficient('选择') === 0.35 && DS.getTypeCoefficient('操作') === 0.5 && DS.getTypeCoefficient('应用') === 0.7 && DS.getTypeCoefficient('开放') === 0.8, 'getTypeCoefficient 规范表正确');
assert(DS.getTypeCoefficient('cushi') === 0.2 && DS.getTypeCoefficient('mix') === 0.7, 'getTypeCoefficient 插件 type 别名回落正确');
assert(approx(DS.calcStructureScore(1, false, false), 0) && approx(DS.calcStructureScore(5, true, true), 1), 'calcStructureScore 端点 0/1');
assert(DS.calcNumberScore({ min: 1, max: 100000 }) === 1 && DS.calcNumberScore({ min: 1, max: 1 }) === 0, 'calcNumberScore 端点 0/1');
assert(DS.getContextScore('pure') === 0 && DS.getContextScore('simple') === 0.3 && DS.getContextScore('standard') === 0.5 && DS.getContextScore('complex') === 0.8, 'getContextScore 正确');

console.log('\n=== 2) D 加权公式交叉验证（多维度组合）===');
const combos = [
  { difficulty: 1, spiral_level: 1, max_spiral_level: 1, cognitive_level: '了解', applicable_question_types: [{ type: 'judge', coefficient: 1 }], number_range_default: { min: 1, max: 1 }, max_steps_default: 1, context_default: 'pure' },
  { difficulty: 3, spiral_level: 1, max_spiral_level: 1, cognitive_level: '掌握', applicable_question_types: [{ type: 'calc', coefficient: 1 }], number_range_default: { min: 1, max: 100 }, max_steps_default: 2, context_default: 'standard' },
  { difficulty: 6, spiral_level: 1, max_spiral_level: 1, cognitive_level: '理解', applicable_question_types: [{ type: 'choice', coefficient: 1 }], number_range_default: { min: 1, max: 1000 }, max_steps_default: 3, context_default: 'simple' },
  { difficulty: 10, spiral_level: 3, max_spiral_level: 3, cognitive_level: '运用', applicable_question_types: [{ type: 'apply', coefficient: 1 }], number_range_default: { min: 1, max: 100000 }, max_steps_default: 5, context_default: 'complex' },
  { difficulty: 8, spiral_level: 2, max_spiral_level: 3, cognitive_level: '掌握', applicable_question_types: [{ type: 'open', coefficient: 1 }], number_range_default: { min: 1, max: 5000 }, max_steps_default: 4, context_default: 'complex' }
];
const qts = [undefined, '计算', '应用', '开放', '判断'];
combos.forEach((kp, i) => qts.forEach((qt, j) => {
  const got = DS.paramsForKnowledgePoint(kp, qt);
  const exp = recompute(kp, qt);
  const tag = `combo#${i}/${qt || '默认'}`;
  assert(got.level >= 1 && got.level <= 10, `[${tag}] level 落在 1-10（实际 ${got.level}）`);
  assert(approx(got.staticMeta.D, exp.D), `[${tag}] D 公式一致（引擎 ${got.staticMeta.D.toFixed(4)} / 期望 ${exp.D.toFixed(4)}）`);
  assert(got.level === exp.level, `[${tag}] level 与 D 取整一致（${got.level}）`);
  assert(approx(got.staticMeta.G, exp.G) && approx(got.staticMeta.S, exp.S) && approx(got.staticMeta.C, exp.C) &&
    approx(got.staticMeta.T, exp.T) && approx(got.staticMeta.St, exp.St) && approx(got.staticMeta.N, exp.N) && approx(got.staticMeta.A, exp.A),
    `[${tag}] 七维度评分与期望一致`);
}));

console.log('\n=== 3) 单调性：单维度升高，难度不降 ===');
function monoBase(over) { return Object.assign({ difficulty: 3, spiral_level: 1, max_spiral_level: 1, cognitive_level: '掌握', applicable_question_types: [{ type: 'calc', coefficient: 1 }], number_range_default: { min: 1, max: 100 }, max_steps_default: 2, context_default: 'standard' }, over); }
const dimSteps = [
  ['认知层次', c => monoBase({ cognitive_level: c }), ['了解', '理解', '掌握', '运用']],
  ['情境', c => monoBase({ context_default: c }), ['pure', 'simple', 'standard', 'complex']],
  ['数值范围', c => monoBase({ number_range_default: { min: 1, max: c } }), [1, 20, 100, 1000, 100000]],
  ['结构(难度档)', c => monoBase({ difficulty: c }), [1, 4, 7, 10]],
  ['螺旋层级', c => monoBase({ spiral_level: c, max_spiral_level: 3 }), [1, 2, 3]]
];
dimSteps.forEach(([name, fn, vals]) => {
  let prev = -1, mono = true;
  const levels = vals.map(v => DS.paramsForKnowledgePoint(fn(v)).level);
  levels.forEach(l => { if (l < prev) mono = false; prev = l; });
  assert(mono, `${name}维度升高难度单调不减：${levels.join(' → ')}`);
  assert(levels.every(l => l >= 1 && l <= 10), `${name}各档 level 均在 1-10`);
});

console.log('\n=== 4) 同一知识点：应用题 > 计算题 ===');
const appKp = { difficulty: 5, spiral_level: 1, max_spiral_level: 1, cognitive_level: '掌握', applicable_question_types: [{ type: 'apply', coefficient: 1 }], number_range_default: { min: 1, max: 100 }, max_steps_default: 2, context_default: 'standard' };
const dApply = DS.paramsForKnowledgePoint(appKp, '应用').staticMeta.D;
const dCalc = DS.paramsForKnowledgePoint(appKp, '计算').staticMeta.D;
assert(dApply > dCalc, `应用 D(${dApply.toFixed(3)}) > 计算 D(${dCalc.toFixed(3)})`);
assert(DS.paramsForKnowledgePoint(appKp, '应用').level >= DS.paramsForKnowledgePoint(appKp, '计算').level, '应用题 level >= 计算题 level');

console.log('\n=== 5) 元数据缺失/部分时的回退 ===');
let threw = false, fb;
try { fb = DS.paramsForKnowledgePoint({}); } catch (e) { threw = true; }
assert(!threw && fb.level >= 1 && fb.level <= 10, '完全空元数据：不抛错且 level 在 1-10');
assert(fb.level === recompute({}).level, `空元数据 level(${fb.level}) 与公式期望(${recompute({}).level})一致`);
const partial = { difficulty: 8, cognitive_level: '运用', context_default: 'complex', max_steps_default: 5, number_range_default: { min: 1, max: 100000 }, spiral_level: 3, max_spiral_level: 3, applicable_question_types: [{ type: 'calc', coefficient: 1 }] };
let threw2 = false;
try { DS.paramsForKnowledgePoint(partial); } catch (e) { threw2 = true; }
assert(!threw2, '部分元数据：不抛错');
const partialGot = DS.paramsForKnowledgePoint(partial);
assert(partialGot.level === recompute(partial).level, '部分元数据 level 与公式期望一致');

console.log('\n=== 6) 真实知识点端到端 ===');
function findKp(id) { let r; (bank.math || []).concat(bank.cn || [], bank.en || []).forEach(e => (e.modules || []).forEach(m => (m.knowledgePoints || []).forEach(k => { if (k.id === id) r = k; }))); return r; }
const custom = DS.paramsForKnowledgePoint({ difficulty: 3, cognitive_level: '掌握', applicable_question_types: [{ type: 'calc', coefficient: 1 }], number_range_default: { min: 1, max: 100 }, max_steps_default: 2, context_default: 'standard' }, 'calc', { scale: 99 });
assert(custom.scale === 99, 'customParams 覆盖 scale 生效');
const real = findKp('math-g2-m1-mult-table');
if (real) {
  const r = DS.paramsForKnowledgePoint(real);
  console.log(`  [真实 math-g2-m1-mult-table] level=${r.level} scale=${r.scale} steps=${r.steps} 题型推断=${r.staticMeta.T}`);
  assert(r.level >= 1 && r.level <= 10, '真实知识点 level 落在 1-10');
  assert(r.staticMeta && typeof r.staticMeta.D === 'number', '真实知识点含 staticMeta.D');
} else {
  console.log('  (跳过：未命中真实知识点)');
}

console.log('\n' + (failures ? `❌ ${failures} 项失败` : '✅ 静态难度引擎单元测试全部通过'));
process.exit(failures ? 1 : 0);
