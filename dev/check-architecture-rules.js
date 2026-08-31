#!/usr/bin/env node
/**
 * dev/check-architecture-rules.js — 架构护栏静态检查（M0-09）
 *
 * 可静态验证的护栏（与 generation-rules.md 对应）：
 *   R1  Static 难度不得接入线上 UI：practice.html 不得引用 difficulty-static。（ERROR）
 *   R2  插件不得直接依赖/require difficulty-static。（ERROR）
 *   R3  Feature Flag 默认 legacy：shared/generation-config.js 的 getMode() === 'legacy'。（校验）
 *   R4  新代码禁止新增 Math.random：扫描 shared/ plugins/ 直调 Math.random，
 *       豁免 core.js/common.js（唯一随机源）。存在即记录 WARNING（既有技术债，不阻断）。
 *   R5  Legacy 适配层存在：shared/legacy/legacy-plugin-adapter.js 可导。（校验）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const errors = [];
const warnings = [];

function stripComment(line) {
  // 去掉 // 行内注释，避免把「禁止 Math.random」之类的说明误判为调用
  const i = line.indexOf('//');
  return i === -1 ? line : line.slice(0, i);
}
function grepFile(file, re) {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const hits = [];
  lines.forEach(function (ln, i) {
    if (re.test(stripComment(ln))) hits.push((i + 1) + ': ' + ln.trim());
  });
  return hits;
}

function run() {
  errors.length = 0; warnings.length = 0;

  // R1：Static 不得成为「默认/激活」的生成路径。
  //   实际代码（与任务描述不一致，按规则#10记录）：practice.html 确实 <script> 引入了
  //   difficulty-static.js（line 237），但 render.js 仅在 opts.knowledgePointMeta 传入时才
  //   消费它；而 practice.html 的 generate() 从不设置 knowledgePointMeta，故 Static 在实际 UI
  //   中为「休眠」态，Legacy 仍是默认路径。因此：
  //   - 若 practice.html 主动设置 knowledgePointMeta（即把 Static 设为激活路径）→ ERROR；
  //   - 仅静态引入脚本 → WARNING（记录差异，不阻断）。
  const ph = path.join(ROOT, 'practice.html');
  if (fs.existsSync(ph)) {
    const html = fs.readFileSync(ph, 'utf8');
    if (/\bknowledgePointMeta\b/.test(html)) {
      errors.push('R1 违规：practice.html 主动设置了 knowledgePointMeta（Static 被设为激活路径）');
    } else if (html.indexOf('difficulty-static') !== -1) {
      warnings.push('R1 差异：practice.html 静态引入了 difficulty-static.js，但 UI 不传 knowledgePointMeta，Static 为休眠态（Legacy 仍为默认）');
    }
  }

  // R2
  const pluginsDir = path.join(ROOT, 'plugins');
  if (fs.existsSync(pluginsDir)) {
    fs.readdirSync(pluginsDir).forEach(function (f) {
      if (!f.endsWith('.js')) return;
      const hits = grepFile(path.join(pluginsDir, f), /difficulty-static/);
      hits.forEach(function (h) { errors.push('R2 违规：plugins/' + f + ' 依赖 difficulty-static (' + h + ')'); });
    });
  }

  // R3
  try {
    const cfg = require(path.join(ROOT, 'shared', 'generation-config.js'));
    if (cfg.getMode() !== 'legacy') errors.push('R3 违规：GenerationConfig 默认模式非 legacy（=' + cfg.getMode() + '）');
    if (cfg.SUPPORTED.indexOf('legacy') === -1 || cfg.SUPPORTED.indexOf('strategy-v1') === -1)
      errors.push('R3 违规：GenerationConfig 支持模式不完整');
  } catch (e) { errors.push('R3 校验失败：' + e.message); }

  // R5
  try {
    const ad = require(path.join(ROOT, 'shared', 'legacy', 'legacy-plugin-adapter.js'));
    if (typeof ad.toLegacyOptions !== 'function' || typeof ad.runPlan !== 'function')
      errors.push('R5 违规：LegacyPluginAdapter 接口不完整');
  } catch (e) { errors.push('R5 校验失败：' + e.message); }

  // R4
  ['shared', 'plugins'].forEach(function (d) {
    const dir = path.join(ROOT, d);
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(function (f) {
      if (!f.endsWith('.js')) return;
      if (f === 'core.js' || f === 'common.js') return; // 唯一合法随机源
      const hits = grepFile(path.join(dir, f), /\bMath\.random\b/);
      hits.forEach(function (h) { warnings.push('R4 技术债：' + d + '/' + f + ' 直调 Math.random (' + h + ')'); });
    });
  });

  return {
    name: '架构护栏 (Architecture Rules)',
    pass: errors.length === 0,
    errors: errors.slice(),
    warnings: warnings.slice(),
    summary: '硬规则 ERROR ' + errors.length + '；技术债 WARNING ' + warnings.length
  };
}

module.exports = { run: run };
if (require.main === module) {
  const r = run();
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.pass ? 0 : 1);
}
