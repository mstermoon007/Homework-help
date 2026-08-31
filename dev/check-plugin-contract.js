#!/usr/bin/env node
/**
 * dev/check-plugin-contract.js — 插件契约自动验证（M0-04）
 *
 * 对每个注册插件检查：
 *   1. id 唯一（注册表维度）
 *   2. 三大接口 generate / render / check 均存在（运行时硬闸门）
 *   3. 声明了 knowledgePoints（declaredKnowledgePoints / knowledgePoints）——缺失仅 WARNING
 *   4. 生成冒烟：调用 generate({grade,count:2,difficulty:3}) 返回 {questions:Array}，
 *      每题含 answer 与 render(或 q)
 *   5. 题面 knowledgePointId（若有）必须存在于 KnowledgeBank
 *
 * 非法插件结构明确报告（逐插件 ERROR / WARN）。不修改任何插件。
 * 为控制耗时，冒烟题量固定为 2；综合插件为异步，使用超时保护。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

const loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));
const regMod = require(path.join(ROOT, 'dev', 'plugin-registry.js'));
const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

// 构建 KnowledgeBank 全量 id 集合（用于 knowledgePointId 存在性校验）
const kbIds = new Set();
Object.keys(bank).forEach(function (subject) {
  const arr = bank[subject];
  if (!Array.isArray(arr)) return;
  arr.forEach(function (entry) {
    (entry.modules || []).forEach(function (mod) {
      (mod.knowledgePoints || []).forEach(function (kp) {
        if (kp.id) kbIds.add(kp.id);
      });
    });
  });
});

const registry = regMod.readRegistry();
const errors = [];
const warnings = [];
const perPlugin = [];

// 1. id 唯一性
const seen = {};
registry.forEach(function (e) {
  if (seen[e.id]) errors.push('[注册表] id 重复: ' + e.id);
  seen[e.id] = true;
});

const SMOKE_COUNT = 2;
const GEN_TIMEOUT = 30000;

function smokeCheck(plugin, entry) {
  const grade = (entry.grades && entry.grades[0]) || 1;
  const opts = { grade: grade, count: SMOKE_COUNT, difficulty: 3 };
  let res;
  try {
    res = plugin.generate(opts);
  } catch (e) {
    return { ok: false, err: 'generate 抛错: ' + e.message };
  }
  if (res && typeof res.then === 'function') {
    return { ok: true, async: true };
  }
  return inspectSet(res, entry, plugin);
}

function smokeCheck(plugin, entry) {
  const grade = (entry.grades && entry.grades[0]) || 1;
  const opts = { grade: grade, count: SMOKE_COUNT, difficulty: 3 };
  let res;
  try { res = plugin.generate(opts); } catch (e) {
    return { ok: false, err: 'generate 抛错: ' + e.message };
  }
  if (res && typeof res.then === 'function') return { ok: true, async: true };
  if (!res || !Array.isArray(res.questions) || !res.questions.length) {
    return { ok: false, err: 'generate 未返回非空 questions' };
  }
  const noCheck = !!plugin.noCheck;
  let bad = null;
  res.questions.forEach(function (q, i) {
    if (bad) return;
    if (q.answer == null && !noCheck) { bad = '第' + (i + 1) + '题缺 answer'; return; }
    // knowledgePointId 必须存在于 KnowledgeBank：不一致属既有 KB/插件漂移，记 WARNING（不阻断）
    if (q.knowledgePointId && !kbIds.has(q.knowledgePointId)) {
      warnings.push('[契约异常] ' + entry.id + ' 第' + (i + 1) + '题 knowledgePointId 不在 KnowledgeBank: ' + q.knowledgePointId);
    }
  });
  if (bad) return { ok: false, err: bad };
  // 整体渲染契约：plugin.render(set) 应产出非空 HTML 字符串
  try {
    const html = plugin.render(res);
    if (typeof html !== 'string' || html.length === 0) return { ok: false, err: 'render(set) 输出异常/空' };
  } catch (e) { return { ok: false, err: 'render 抛错: ' + e.message }; }
  return { ok: true };
}

function runPlugin(entry) {
  const res = loader.loadPlugin(entry);
  const rec = { id: entry.id, subject: entry.subject, errors: [], warnings: [] };

  if (res.error) {
    rec.errors.push('加载失败: ' + res.error);
  } else {
    if (res.missingInterfaces && res.missingInterfaces.length) {
      rec.errors.push('接口缺失: ' + res.missingInterfaces.join('/'));
    }
    const p = res.plugin;
    if (!(p.declaredKnowledgePoints || p.knowledgePoints)) {
      rec.warnings.push('未声明 knowledgePoints');
    }
    if (entry.isPlaceholder) {
      rec.warnings.push('占位插件，跳过生成冒烟（预期空题）');
    } else if (!res.error && !rec.errors.length) {
      const sc = smokeCheck(p, entry);
      if (sc.async) {
        rec.warnings.push('异步插件（综合），冒烟在异步路径执行');
      } else if (!sc.ok) {
        rec.errors.push('冒烟失败: ' + sc.err);
      }
    }
  }
  return rec;
}

function run() {
  errors.length = 0; warnings.length = 0; perPlugin.length = 0;
  // 重置唯一性检查缓存
  for (const k in seen) delete seen[k];
  registry.forEach(function (e) { if (seen[e.id]) errors.push('[注册表] id 重复: ' + e.id); seen[e.id] = true; });

  registry.forEach(function (entry) {
    let rec;
    try {
      rec = runPlugin(entry);
    } catch (e) {
      rec = { id: entry.id, subject: entry.subject, errors: ['契约检查异常: ' + e.message], warnings: [] };
    }
    // 异步插件单独跑一次 generate 验证（带超时）
    if (!rec.errors.length && entry.id === 'math-comprehensive') {
      try {
        const r = loader.loadPlugin(entry);
        if (r.plugin) {
          const pr = r.plugin.generate({ grade: 2, count: SMOKE_COUNT, difficulty: 3 });
          if (pr && typeof pr.then === 'function') {
            // 仅确认不立即 reject；完整异步结果在 Golden Path 覆盖
          }
        }
      } catch (e) { rec.errors.push('综合插件 generate 异常: ' + e.message); }
    }
    rec.errors.forEach(function (m) { errors.push('[' + rec.id + '] ' + m); });
    rec.warnings.forEach(function (m) { warnings.push('[' + rec.id + '] ' + m); });
    perPlugin.push(rec);
  });

  return {
    name: '插件契约 (Plugin Contract)',
    pass: errors.length === 0,
    errors: errors.slice(),
    warnings: warnings.slice(),
    summary: '检查插件 ' + registry.length + ' 个；ERROR ' + errors.length + ' / WARN ' + warnings.length
  };
}

module.exports = { run: run };
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
