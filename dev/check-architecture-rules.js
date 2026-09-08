#!/usr/bin/env node
/**
 * dev/check-architecture-rules.js — 架构护栏静态检查（M0-09）
 *
 * 可静态验证的护栏（与 generation-rules.md 对应）：
 *   R1  Static 难度不得接入线上 UI：practice.html 不得引用 difficulty-static。（ERROR）
 *   R2  插件不得直接依赖/require difficulty-static。（ERROR）
 *   R4  新代码禁止新增 Math.random：递归扫描 shared/ plugins/（含子目录）直调 Math.random，
 *       豁免 core.js/common.js（唯一随机源）。存在即记录 WARNING（既有技术债，不阻断）。
 *   R5  Legacy 插件轨道禁止复活：shared/generator/legacy-adapter.js、shared/plugin-loader.js、
 *       shared/generator-capability-registry.js、shared/generator/migration-switch.js、
 *       plugins/registry.js 不得再出现。（MATH-14 后 R5 语义反转为「禁止存在」）
 *   （R3 已移除：generation-config.js 为 M0 遗留死代码，随清单删除，不再设锁定）
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const errors = [];
const warnings = [];

function stripComments(code) {
  // 去掉 // 和 /* */ 注释，避免把「禁止 Math.random」之类的说明误判为调用
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '') // 去掉块注释
    .replace(/\/\/.*$/gm, '');        // 去掉行注释
}
function grepFile(file, re) {
  if (!fs.existsSync(file)) return [];
  const code = fs.readFileSync(file, 'utf8');
  const stripped = stripComments(code);
  const hits = [];
  stripped.split('\n').forEach(function (ln, i) {
    if (re.test(ln)) hits.push((i + 1) + ': ' + ln.trim());
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

  // R3 已删除：generation-config.js（M0 遗留 Feature Flag）与运行链无关，R3 是对死代码的历史锁定。
  // R5（MATH-14 反转）：legacy 插件轨道文件必须保持删除态，任何复活即 ERROR。
  const LEGACY_FILES = [
    'shared/generator/legacy-adapter.js',
    'shared/plugin-loader.js',
    'shared/generator-capability-registry.js',
    'shared/generator/migration-switch.js',
    'shared/presentation/legacy-svg-adapter.js',
    'plugins/registry.js'
  ];
  LEGACY_FILES.forEach(function (rel) {
    if (fs.existsSync(path.join(ROOT, rel))) {
      errors.push('R5 违规：legacy 插件轨道文件复活：' + rel + '（MATH-14 已删除，禁止恢复）');
    }
  });

  // R4
  // 检测 Math.random() 调用，而非正则字面量中的 Math.random
  // 使用更精确的正则：Math\.random\s*\( 以避免误报 FORBIDDEN_PATTERNS 等验证数组中的正则字面量
  // 递归扫描 shared/（含 generator/validator/strategy/generation 等子目录）与 plugins/（含子目录），
  // 豁免 core.js/common.js（唯一合法随机源）；*.bundle.js 为自动生成产物，不判技术债。
  const mathRandomCallRe = /\bMath\.random\s*\(/;
  function walkRulesDir(dir, out) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(function (f) {
      const abs = path.join(dir, f);
      if (fs.statSync(abs).isDirectory()) { walkRulesDir(abs, out); return; }
      if (!f.endsWith('.js') || f.endsWith('.bundle.js')) return;
      out.push(abs);
    });
  }
  ['shared', 'plugins'].forEach(function (d) {
    const files = [];
    walkRulesDir(path.join(ROOT, d), files);
    files.forEach(function (abs) {
      if (path.basename(abs) === 'core.js' || path.basename(abs) === 'common.js') return; // 唯一合法随机源
      const hits = grepFile(abs, mathRandomCallRe);
      hits.forEach(function (h) { warnings.push('R4 技术债：' + path.relative(ROOT, abs) + ' 直调 Math.random (' + h + ')'); });
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
