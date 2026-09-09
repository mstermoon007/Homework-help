#!/usr/bin/env node
/**
 * dev/check-g1-quality-matrix.js — P1-08 一年级数学质量测试矩阵
 *
 * Step 34: 一年级全 KP 门禁（46 个数学 KP，不再按 M0–M13 题型限制）
 * Step 35: 三模式（quick / teacher / competition）
 * Step 36: 三种 KP 关系（1KP→1题、NKP→N题、NKP→1综合题）
 * Step 37: 每 KP 最少采样（常规 20 题，重点 50 题）
 *
 * 重点 KP（9 类）：
 *  5以内: addsub-5
 *  10以内: addsub-10
 *  20以内: carry-add-20, retreat-sub-20
 *  100以内: addsub-100, two-digit-add
 *  图形: solid-shape, flat-shape, count-graph, shape-combine, draw-shape
 *  位置: position
 *  人民币: rmb-unit, rmb-calc
 *  应用题: picture-add, picture-sub, picture-mixed, brace-question, add-total,
 *         sub-remain, sub-part, compare-more, compare-less, two-step, rmb-shopping, exclude-extra
 *  乘除扩展: multiplication-table, division-table
 *
 * 用法：node dev/check-g1-quality-matrix.js
 */
'use strict';

const path = require('node:path');
const ROOT = path.join(__dirname, '..');

// Bootstrap: require modules to register globals for GenerationAPI
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-request.js'));
require(path.join(ROOT, 'shared', 'strategy', 'question-plan.js'));
require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'engine', 'presentation-engine.js'));
require(path.join(ROOT, 'shared', 'presentation', 'renderer.js'));
require(path.join(ROOT, 'shared', 'presentation', 'render-options.js'));

const GE = require(path.join(ROOT, 'shared', 'engine', 'generation-engine.js'));
const KB = require(path.join(ROOT, 'shared', 'knowledge', 'knowledge-bank.js'));

// ---------- 一年级 KP 列表 ----------
function g1Kps() {
  const g1 = KB.findGrade('math', 1);
  const out = [];
  (g1.modules || []).forEach(m => (m.knowledgePoints || []).forEach(kp => out.push(kp.id)));
  return out;
}

const ALL_KPS = g1Kps();
console.log('=== G1 质量矩阵：' + ALL_KPS.length + ' 个 KP ===');

// ---------- 重点 KP 映射 ----------
const KEY_KPS = new Set([
  'math-g1-m1-addsub-5',       // 5以内
  'math-g1-m1-addsub-10',      // 10以内
  'math-g1-m1-carry-add-20',   // 20以内
  'math-g1-m1-retreat-sub-20', // 20以内
  'math-g1-m1-addsub-100',     // 100以内
  'math-g1-m1-two-digit-add',  // 100以内
  'math-g1-m6-solid-shape',    // 图形
  'math-g1-m6-flat-shape',     // 图形
  'math-g1-m6-count-graph',    // 图形
  'math-g1-m6-shape-combine',  // 图形
  'math-g1-m6-draw-shape',     // 图形
  'math-g1-m6-position',       // 位置
  'math-g1-m4-rmb-unit',       // 人民币
  'math-g1-m4-rmb-calc',       // 人民币
  'math-g1-m7-picture-add',    // 应用题
  'math-g1-m7-picture-sub',    // 应用题
  'math-g1-m7-picture-mixed',  // 应用题
  'math-g1-m7-brace-question', // 应用题
  'math-g1-m8-add-total',      // 应用题
  'math-g1-m8-sub-remain',     // 应用题
  'math-g1-m8-sub-part',       // 应用题
  'math-g1-m8-compare-more',   // 应用题
  'math-g1-m8-compare-less',   // 应用题
  'math-g1-m8-two-step',       // 应用题
  'math-g1-m8-rmb-shopping',   // 应用题
  'math-g1-m8-exclude-extra',  // 应用题
  'math-g1-m13-multiplication-table', // 乘除扩展
  'math-g1-m13-division-table',       // 乘除扩展
]);

function requiredCount(kp) {
  return KEY_KPS.has(kp) ? 50 : 20;
}

// ---------- 生成辅助 ----------
async function gen(req) {
  return GE.generate(req, {});
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runStep34() {
  console.log('\n--- Step 34: 一年级全 KP 门禁（每 KP count=5 快速门禁）---');
  let pass = 0, fail = 0;
  for (const kp of ALL_KPS) {
    try {
      const g = await gen({ knowledgePointIds: [kp], mode: 'single-kp', grade: 1, count: 5, difficulty: 3 });
      if (g.questions.length >= 5 && g.failedPlans.length === 0) {
        pass++;
      } else {
        console.log('  ⚠️ ' + kp + ': questions=' + g.questions.length + ' failed=' + g.failedPlans.length);
        fail++;
      }
    } catch (e) {
      console.log('  ❌ ' + kp + ': ' + e.name + ' ' + e.code + ' ' + e.message.slice(0,120));
      fail++;
    }
  }
  console.log('  结果: PASS=' + pass + ' FAIL=' + fail);
  return fail === 0;
}

async function runStep35() {
  console.log('\n--- Step 35: 三模式（quick / teacher / competition）---');
  const modes = [
    { name: 'quick', req: { mode: 'quick', subject: 'math', grade: 1, count: 10, difficulty: 3 } },
    { name: 'teacher', req: { mode: 'teacher', subject: 'math', grade: 1, unitId: 'M1', count: 10, difficulty: 3 } },
    { name: 'competition', req: { mode: 'competition', subject: 'math', grade: 1, count: 10, difficulty: 3 } },
  ];
  let pass = 0, fail = 0;
  for (const m of modes) {
    try {
      const g = await gen(m.req);
      if (g.questions.length >= 10 && g.failedPlans.length === 0) {
        console.log('  ✅ ' + m.name + ': ' + g.questions.length + ' questions, ' + g.plans.length + ' plans');
        pass++;
      } else {
        console.log('  ⚠️ ' + m.name + ': questions=' + g.questions.length + ' failed=' + g.failedPlans.length);
        fail++;
      }
    } catch (e) {
      console.log('  ❌ ' + m.name + ': ' + e.name + ' ' + e.code + ' ' + e.message.slice(0,120));
      fail++;
    }
  }
  console.log('  结果: PASS=' + pass + ' FAIL=' + fail);
  return fail === 0;
}

async function runStep36() {
  console.log('\n--- Step 36: 三种 KP 关系 ---');
  let pass = 0, fail = 0;

  // 1KP → 1题
  try {
    const g = await gen({ knowledgePointIds: ['math-g1-m1-addsub-10'], mode: 'single-kp', grade: 1, count: 1, difficulty: 3 });
    assert(g.questions.length === 1 && g.failedPlans.length === 0, '期望 1 题');
    console.log('  ✅ 1KP→1题: single-kp count=1 → ' + g.questions.length + ' 题');
    pass++;
  } catch (e) {
    console.log('  ❌ 1KP→1题: ' + e.message);
    fail++;
  }

  // NKP → N题 (4个KP，各1题)
  try {
    const kps = ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10', 'math-g1-m1-carry-add-20', 'math-g1-m4-compare-number'];
    const g = await gen({ knowledgePointIds: kps, mode: 'multi-kp', grade: 1, count: kps.length, difficulty: 3 });
    assert(g.questions.length === kps.length && g.failedPlans.length === 0, '期望 ' + kps.length + ' 题');
    console.log('  ✅ NKP→N题: multi-kp count=4 → ' + g.questions.length + ' 题');
    pass++;
  } catch (e) {
    console.log('  ❌ NKP→N题: ' + e.message);
    fail++;
  }

  // NKP → 1综合题 (combine=true，使用 COMPOSITE_KPS 支持的组合)
  try {
    const g = await gen({ knowledgePointIds: ['math-g1-m1-addsub-5', 'math-g1-m1-addsub-10'], combine: true, grade: 1, count: 1, difficulty: 3 });
    assert(g.questions.length === 1 && g.failedPlans.length === 0, '期望 1 综合题');
    console.log('  ✅ NKP→1综合题: combine=true count=1 → ' + g.questions.length + ' 题');
    pass++;
  } catch (e) {
    console.log('  ❌ NKP→1综合题: ' + e.message);
    fail++;
  }

  console.log('  结果: PASS=' + pass + ' FAIL=' + fail);
  return fail === 0;
}

async function runStep37() {
  console.log('\n--- Step 37: 每 KP 最小采样（常规 20，重点 50）---');
  let pass = 0, fail = 0, skipped = 0;
  for (const kp of ALL_KPS) {
    const need = requiredCount(kp);
    try {
      const g = await gen({ knowledgePointIds: [kp], mode: 'single-kp', grade: 1, count: need, difficulty: 3 });
      if (g.questions.length === need && g.failedPlans.length === 0) {
        pass++;
      } else {
        console.log('  ⚠️ ' + kp + ' (need=' + need + '): questions=' + g.questions.length + ' failed=' + g.failedPlans.length);
        fail++;
      }
    } catch (e) {
      console.log('  ❌ ' + kp + ' (need=' + need + '): ' + e.name + ' ' + e.code + ' ' + e.message.slice(0,120));
      fail++;
    }
  }
  console.log('  结果: PASS=' + pass + ' FAIL=' + fail);
  return fail === 0;
}

// ---------- 主流程 ----------
async function main() {
  const start = Date.now();
  const results = [];

  results.push({ step: 'Step 34 全KP门禁', ok: await runStep34() });
  results.push({ step: 'Step 35 三模式', ok: await runStep35() });
  results.push({ step: 'Step 36 三种KP关系', ok: await runStep36() });
  results.push({ step: 'Step 37 每KP最小采样', ok: await runStep37() });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log('\n=== 汇总 (耗时 ' + elapsed + 's) ===');
  let allOk = true;
  results.forEach(r => {
    console.log('  ' + (r.ok ? '✅' : '❌') + ' ' + r.step);
    if (!r.ok) allOk = false;
  });

  if (allOk) {
    console.log('\n🎉 所有步骤通过');
    process.exit(0);
  } else {
    console.log('\n❌ 存在失败步骤');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('脚本异常:', e);
  process.exit(1);
});
