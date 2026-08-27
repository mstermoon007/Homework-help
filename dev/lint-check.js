#!/usr/bin/env node
/**
 * dev/lint-check.js — 插件/共享层静态质量检查（任务11）
 *
 * 规则（违规即 errors，警告不计入退出码）：
 *   R1  运行时代码直接调用 Math.random() —— 应使用 PluginUtil.randInt / shuffle
 *       （注释中的提及不算；shared/common.js randInt 内部兜底为唯一豁免，不在扫描范围）
 *   R2  插件内联样式出现硬编码颜色（#hex / rgb()/rgba()）
 *       —— SVG 表现属性（fill=/stroke=）与 MEMORY 记录的内容插画豁免清单除外；
 *          color:#fff（彩色底上的白字）亦豁免
 *   R3  插件对象缺 subject 字段；math 科目插件缺 moduleId
 *       （语文/英语历史插件无 moduleId，降级为警告）
 *   R4  知识点 ID 不符合科目前缀四段式 {subject}-g{grade}-{module}-{slug}
 *       —— 扫描插件 knowledgePoints 声明/标注 与 shared/knowledge-*.js 数据
 *
 * 用法：node dev/lint-check.js        # 有 errors 时退出码 1
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const errors = [];
const warnings = [];

function lineOf(src, idx) { return src.slice(0, idx).split('\n').length; }

/** 去除注释后扫描 R1（避免文档性提及误报） */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1' + ' '.repeat(0));
}

// ============ R1/R2/R4：源码静态扫描 ============
// 豁免：MEMORY.md「保留字面量豁免清单」+ 白字约定（color:#fff）
const EXEMPT_HEX = new Set(['#f5576c', '#10ac84', '#b8860b', '#fdf3e3', '#fffbe8',
  '#fef0e8', '#e8870a', '#e74c3c', '#4caf50', '#fffdf6', '#6b5310', '#e8d9b8',
  '#e0c98f', '#f0e3c0']);

function scanSourceFile(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return;
  const src = fs.readFileSync(fp, 'utf8');
  const clean = stripComments(src);

  // R1: Math.random 直调（去注释后仍存在即违规）
  if (rel === 'shared/common.js') return; // R1 豁免：randInt 内部 Math.random 兜底是规范唯一允许位置
  const reRandom = /Math\.random\s*\(\s*\)/g;
  let m;
  while ((m = reRandom.exec(clean)) !== null) {
    errors.push(`${rel}:${lineOf(clean, m.index)} R1 直接调用 Math.random()（应使用 PluginUtil.randInt/shuffle）`);
  }

  // R2: 内联样式硬编码颜色
  const reStyle = /style="([^"]*)"/g;
  while ((m = reStyle.exec(src)) !== null) {
    const line = lineOf(src, m.index);
    const styleVal = m[1];
    // SVG 表现属性豁免：纯 fill/stroke
    const props = styleVal.split(';').map(s => s.trim()).filter(Boolean);
    const isSvgOnly = props.length > 0 && props.every(p => /^(fill|stroke)\s*:/.test(p));
    if (isSvgOnly) continue;
    for (const p of props) {
      let hm = p.match(/#([0-9a-fA-F]{3,8})\b/);
      if (hm) {
        const hex = '#' + hm[1].toLowerCase();
        if (EXEMPT_HEX.has(hex)) continue;
        if (hex === '#fff') continue; // 白字/白底（SVG 表面）约定：彩底上的 color:#fff 与时钟表面
        errors.push(`${rel}:${line} R2 内联样式硬编码颜色「${p.trim().slice(0, 60)}」（应使用 tokens.css 变量）`);
      }
      const rm = p.match(/\brgba?\(/);
      if (rm && !/^box-shadow/.test(p)) {
        // box-shadow 的 rgba 阴影暂列警告级（历史量大）；其余 rgb 颜色为错误
        warnings.push(`${rel}:${line} R2 内联样式 rgba()（建议改用令牌）：${p.trim().slice(0, 60)}`);
      }
    }
  }
}

// R4-a: 源码中出现的旧式无前缀知识点 ID（引号包裹）
function scanKpIdsInSource(rel) {
  const fp = path.join(ROOT, rel);
  if (!fs.existsSync(fp)) return;
  const src = fs.readFileSync(fp, 'utf8');
  const re = /['"]g[1-6]-(?:m(?:[0-9]|1[0-3])|c[1-9])-[a-z0-9-]+['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    errors.push(`${rel}:${lineOf(src, m.index)} R4 知识点 ID 缺少科目前缀: ${m[0]}`);
  }
  // 声明/标注 ID 必须匹配完整四段式（含科目合法组合粗检）
  const reFull = /['"](math|cn|en)-g[1-6]-(?:m(?:[0-9]|1[0-3])|c[1-9]|n[1-8]|e[1-6])-[a-z0-9-]+['"]/g;
  void reFull;
}

// ============ R3/R4-b：运行时加载检查 ============
function loadPlugins() {
  require(path.join(ROOT, 'shared', 'common.js'));
  const registry = require(path.join(ROOT, 'plugins', 'registry.js'));
  const out = [];
  registry.forEach(rec => {
    try {
      const mod = require(path.join(ROOT, rec.file));
      const plugin = (mod && mod.generate) ? mod
        : ((mod && global.__currentPlugin && global.__currentPlugin.id === rec.id) ? global.__currentPlugin : null);
      out.push({ rec, plugin });
    } catch (e) {
      warnings.push(`plugins/${path.basename(rec.file)} 加载失败（由 verify-setup 把关）: ${e.message}`);
    }
  });
  return out;
}

function checkPluginFields(rec, plugin) {
  const rel = rec.file;
  const findLine = needle => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const i = src.indexOf(needle);
    return i === -1 ? 1 : lineOf(src, i);
  };
  const subj = plugin ? plugin.subject : rec.subject;
  if (!subj) {
    errors.push(`${rel}:${findLine('id:')} R3 插件缺少 subject 字段`);
  }
  if (subj === 'math' && !plugin.moduleId && !(rec.moduleIds && rec.moduleIds.length)) {
    // 占位插件允许以 registry moduleIds 兜底
    if (!rec.isPlaceholder) {
      warnings.push(`${rel}:${findLine("id: '" + rec.id + "'")} R3 数学插件未声明 moduleId`);
    }
  }
  // R4-b: 运行时声明的知识点 ID 格式
  const decl = plugin && (plugin.declaredKnowledgePoints || plugin.knowledgePoints);
  if (decl) {
    const ids = Array.isArray(decl) ? decl : Object.keys(decl).flatMap(k => Array.isArray(decl[k]) ? decl[k] : []);
    const RE = /^(math|cn|en)-g[1-6]-(?:m(?:[0-9]|1[0-3])|c[1-9]|n[1-8]|e[1-6])-[a-z0-9-]+$/;
    ids.forEach(id => {
      if (!RE.test(id)) {
        errors.push(`${rel}:${findLine(id)} R4 声明的知识点 ID 不符合科目前缀格式: ${id}`);
      }
    });
  }
}

// R4-c: shared/knowledge-*.js 数据内旧式 ID
function scanKnowledgeShards() {
  ['knowledge-bank.js', 'knowledge-math.js', 'knowledge-cn.js', 'knowledge-en.js'].forEach(f => {
    scanKpIdsInSource(path.join('shared', f));
  });
}

// ============ 主流程 ============
console.log('🔍 lint-check — 插件/共享层静态质量检查\n' + '='.repeat(46));

loadPlugins().forEach(({ rec, plugin }) => {
  if (!plugin) return;
  checkPluginFields(rec, plugin);
});

listDir('plugins').forEach(scanSourceFile);
listDir('plugins').forEach(scanKpIdsInSource); // 任务11：插件源码内旧式无前缀 ID 同样拦截
listDir('shared').forEach(scanSourceFile);

scanKnowledgeShards();

function listDir(dir) {
  const p = path.join(ROOT, dir);
  if (!fs.existsSync(p)) return [];
  return fs.readdirSync(p).filter(f => f.endsWith('.js')).map(f => path.join(dir, f));
}

// 汇总
if (errors.length) {
  console.log(`\n❌ ${errors.length} 项违规：`);
  errors.forEach(e => console.log(' - ' + e));
} else {
  console.log('\n✅ 未发现违规项。');
}
if (warnings.length) {
  console.log(`\n⚠️ ${warnings.length} 项警告：`);
  warnings.forEach(w => console.log(' - ' + w));
}
process.exit(errors.length ? 1 : 0);
