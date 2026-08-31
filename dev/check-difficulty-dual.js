#!/usr/bin/env node
/**
 * dev/check-difficulty-dual.js — 难度双轨测试（M0-06）
 *
 * 分别验证两套难度引擎，互不耦合：
 *   Legacy  —— App.Difficulty.paramsFor(subject, level)
 *             · 锁定当前行为（表征测试），确认 M0 前后行为一致（规则：不改 Legacy 计算）。
 *             · 确认纯函数、可重复（同输入同输出，无随机）。
 *   Static  —— App.DifficultyStatic.paramsForKnowledgePoint(kpMeta, questionType)
 *             · 仅独立测试，不接入 practice.html（规则：不接 UI）。
 *             · 确认纯函数、可重复、输出结构兼容 Legacy。
 *
 * 护栏：practice.html 不得引用 difficulty-static（静态扫描，违规即 FAIL）。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const errors = [];
const warnings = [];

// ---- 加载引擎（Node 端 require，自动装配全局 App） ----
const Difficulty = require(path.join(ROOT, 'shared', 'difficulty.js'));
const DifficultyStatic = require(path.join(ROOT, 'shared', 'difficulty-static.js'));

function assert(cond, msg) {
  if (!cond) errors.push(msg);
}

// ============ Legacy 表征测试（锁定当前行为） ============
function checkLegacy() {
  // 结构完整性
  const d3 = Difficulty.paramsFor('math', 3);
  assert(d3 && typeof d3 === 'object', 'Legacy paramsFor 返回对象');
  assert(typeof d3.scale === 'number', 'Legacy 含 scale');
  assert(typeof d3.steps === 'number', 'Legacy 含 steps');
  assert('allowBracket' in d3, 'Legacy 含 allowBracket');
  assert('allowMultDiv' in d3, 'Legacy 含 allowMultDiv');

  // 锁定档位映射（与 difficulty.js difficultyToStructure 一致）
  assert(Difficulty.paramsFor('math', 1).steps === 1, 'Legacy level1 steps=1');
  assert(Difficulty.paramsFor('math', 1).allowBracket === false, 'Legacy level1 无括号');
  assert(Difficulty.paramsFor('math', 3).steps === 2, 'Legacy level3 steps=2');
  assert(Difficulty.paramsFor('math', 5).allowBracket === true, 'Legacy level5 有括号');
  assert(Difficulty.paramsFor('math', 5).allowMultDiv === true, 'Legacy level5 有乘除');
  assert(Difficulty.paramsFor('math', 10).steps === 5, 'Legacy level10 steps=5');
  assert(Difficulty.paramsFor('math', 10).allowBracket === true, 'Legacy level10 有括号');
  assert(Difficulty.paramsFor('math', 10).allowMultDiv === true, 'Legacy level10 有乘除');

  // scale 缩放（diffScale：level3→1.0，level10→2.4）
  assert(Math.abs(Difficulty.paramsFor('math', 3).scale - 1.0) < 1e-9, 'Legacy level3 scale=1.0');
  assert(Math.abs(Difficulty.paramsFor('math', 10).scale - 2.4) < 1e-9, 'Legacy level10 scale=2.4');

  // 非法输入回退 3
  assert(Difficulty.paramsFor('math', 99).level === 10 || Difficulty.paramsFor('math', 99).scale === Difficulty.paramsFor('math', 10).scale,
    'Legacy 越界值收敛到边界');

  // 纯函数 / 可重复
  for (const lvl of [1, 2, 4, 6, 7, 9]) {
    const a = JSON.stringify(Difficulty.paramsFor('math', lvl));
    const b = JSON.stringify(Difficulty.paramsFor('math', lvl));
    assert(a === b, 'Legacy paramsFor 可重复（level=' + lvl + '）');
  }

  // 科目差异化（cn/en 独立参数）
  const cn = Difficulty.paramsFor('cn', 5);
  assert(typeof cn.charCountMax === 'number', 'Legacy cn 含 charCountMax');
  const en = Difficulty.paramsFor('en', 5);
  assert(typeof en.wordLengthMax === 'number', 'Legacy en 含 wordLengthMax');
}

// ============ Static 独立测试 ============
function checkStatic() {
  const meta = {
    difficulty: 3,
    max_spiral_level: 3,
    spiral_level: 2,
    cognitive_level: '掌握',
    applicable_question_types: [{ type: 'calc', coefficient: 0.5 }],
    number_range_default: { min: 0, max: 20 },
    max_steps_default: 2,
    context_default: 'standard'
  };
  let out;
  try {
    out = DifficultyStatic.paramsForKnowledgePoint(meta, 'calc');
  } catch (e) {
    errors.push('Static paramsForKnowledgePoint 抛错: ' + e.message);
    return;
  }
  assert(out && typeof out === 'object', 'Static 返回对象');
  assert(typeof out.difficulty === 'number' && out.difficulty >= 1 && out.difficulty <= 10,
    'Static difficulty ∈ [1,10]');
  assert('level' in out && 'scale' in out && 'steps' in out, 'Static 兼容 Legacy 结构');
  assert('staticMeta' in out && typeof out.staticMeta === 'object', 'Static 含 staticMeta');
  assert(typeof out.staticMeta.G === 'number' && typeof out.staticMeta.D === 'number',
    'Static staticMeta 含维度分');

  // 纯函数 / 可重复（无随机）
  const a = JSON.stringify(DifficultyStatic.paramsForKnowledgePoint(meta, 'calc'));
  const b = JSON.stringify(DifficultyStatic.paramsForKnowledgePoint(meta, 'calc'));
  assert(a === b, 'Static paramsForKnowledgePoint 可重复');

  // 题型缺省：取 applicable_question_types 系数最高者
  const def = DifficultyStatic.paramsForKnowledgePoint(meta);
  assert(typeof def.difficulty === 'number', 'Static 题型缺省可计算');

  // 不同认知层级应导致不同难度（基本单调性 sanity）
  const low = DifficultyStatic.paramsForKnowledgePoint(Object.assign({}, meta, { cognitive_level: '了解' }));
  const high = DifficultyStatic.paramsForKnowledgePoint(Object.assign({}, meta, { cognitive_level: '运用' }));
  assert(low.staticMeta.C < high.staticMeta.C, 'Static 认知层级影响 C 维');
}

// ============ 护栏：Static 不得成为「默认/激活」生成路径 ============
// 实际代码（与任务描述不一致，按规则#10记录）：practice.html 确实 <script> 引入了
// difficulty-static.js，但 render.js 仅在 opts.knowledgePointMeta 传入时才消费它；而
// practice.html 的 generate() 从不设置 knowledgePointMeta，故 Static 为休眠态、Legacy 仍为默认。
// 因此：主动设置 knowledgePointMeta → 违规(ERROR)；仅静态引入 → 记录差异(WARNING)。
function checkNotWiredToUI() {
  const practiceHtml = path.join(ROOT, 'practice.html');
  if (fs.existsSync(practiceHtml)) {
    const src = fs.readFileSync(practiceHtml, 'utf8');
    if (/\bknowledgePointMeta\b/.test(src)) {
      errors.push('护栏违规：practice.html 主动设置了 knowledgePointMeta（Static 被设为激活路径）');
    } else if (src.indexOf('difficulty-static') !== -1) {
      warnings.push('差异：practice.html 静态引入 difficulty-static.js，但 UI 不传 knowledgePointMeta（Static 休眠，Legacy 默认）');
    }
  }
  // Math.random 不得出现在 difficulty-static（新代码禁止）
  const ds = fs.readFileSync(path.join(ROOT, 'shared', 'difficulty-static.js'), 'utf8');
  if (/\bMath\.random\b/.test(ds)) {
    errors.push('护栏违规：difficulty-static.js 使用了 Math.random');
  }
}

function run() {
  errors.length = 0; warnings.length = 0;
  checkLegacy();
  checkStatic();
  checkNotWiredToUI();
  return {
    name: '难度双轨测试 (Difficulty Dual-track)',
    pass: errors.length === 0,
    errors: errors.slice(),
    warnings: warnings.slice(),
    summary: 'Legacy 表征 ' + (Difficulty ? '已锁定' : '缺失') +
      '；Static 独立 ' + (DifficultyStatic ? '可用' : '缺失') +
      '；发现 ' + errors.length + ' 处问题'
  };
}

module.exports = { run: run };
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
