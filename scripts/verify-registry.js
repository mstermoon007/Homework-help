#!/usr/bin/env node
/**
 * scripts/verify-registry.js — 插件注册表一致性校验（任务1.3）
 *
 * 校验 plugins/registry.js 中注册条目 与 实际插件文件 的一致性，防止漏注册 / 字段错配：
 *   1) 每个插件文件（导出 window/global.__currentPlugin 且声明 math-/cn-/en- 前缀 id）都应在
 *      registry 中注册，且 registry.file 与该文件相对路径一致；
 *   2) 每个 registry 条目对应的 file 必须真实存在且为插件导出文件，且文件声明 id 与条目 id 一致；
 *   3) 文件与 registry 的 subject / grades 不一致则报错。
 *
 * 插件依赖浏览器全局 PluginUtil，无法在 Node 中安全 import，故采用静态解析：
 *   - 用括号匹配提取 createXxxPlugin({ ... }) 配置块，只读取“顶层”的 id/subject/grades，
 *     避免命中 generateQuestions 内部题目数据对象的同名字段；
 *   - 辅助文件（如 pinyin-to-char.js）不含插件前缀 id，自动排除，无需注册。
 *
 * 用法：node scripts/verify-registry.js   （不一致时退出码 1）
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

// 非插件文件（不参与注册表校验）
const EXCLUDE_FILES = new Set(['registry.js', '_template.js']);
// 插件 id 前缀（与 shared/knowledge-bank.js 四段式科目前缀一致）
const ID_PREFIX = /(math-|cn-|en-|english-|chinese-)/;

const errors = [];

function loadRegistry() {
  const regPath = path.join(PLUGINS_DIR, 'registry.js');
  delete require.cache[require.resolve(regPath)];
  return require(regPath);
}

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && ent.name.endsWith('.js')) out.push(p);
  }
}

function isPluginFile(src) {
  // 插件文件通过 window/global.__currentPlugin 导出（浏览器端 practice.html 加载）
  return /window\.__currentPlugin\s*=/.test(src) || /global\.__currentPlugin\s*=/.test(src);
}

// 提取 createXxxPlugin({ ... }) 配置块（括号匹配）
function extractConfigBlock(src) {
  const m = src.match(/create(?:Math|Chinese|English)Plugin\s*\(\s*\{/);
  if (!m) return null;
  const start = m.index + m[0].length - 1; // 指向配置块起始 '{'
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start + 1, i);
    }
  }
  return null;
}

// 在 src（或配置块）顶层读取某个 key 的值（depth===0），避免命中嵌套题目数据
function topLevel(src, key) {
  const block = extractConfigBlock(src);
  const target = block || src;
  const re = new RegExp(key + '\\s*:\\s*', 'g');
  let m;
  while ((m = re.exec(target)) !== null) {
    let d = 0;
    for (let k = 0; k < m.index; k++) {
      if (target[k] === '{') d++;
      else if (target[k] === '}') d--;
    }
    if (d === 0) {
      const rest = target.slice(m.index + key.length);
      const sm = rest.match(/^\s*['"]([^'"]+)['"]/);
      if (sm) return { kind: 'str', val: sm[1] };
      const am = rest.match(/^\s*\[([^\]]*)\]/);
      if (am) return { kind: 'arr', val: am[1] };
      return null;
    }
  }
  return null;
}

function parsePlugin(src) {
  let id = topLevel(src, 'id');
  if (!id) {
    // 兜底：整文件搜索插件前缀 id（createXxxPlugin 之外手写的情形）
    const pm = src.match(/id:\s*['"]((?:math-|cn-|en-|english-|chinese-)[a-z0-9-]*)['"]/i);
    if (pm) id = { kind: 'str', val: pm[1] };
  }
  const subjectRaw = topLevel(src, 'subject');
  const gradesRaw = topLevel(src, 'grades');
  const grades = gradesRaw && gradesRaw.kind === 'arr'
    ? gradesRaw.val.split(',').map(s => s.trim()).filter(Boolean).map(Number).filter(n => !Number.isNaN(n))
    : null;
  let subject = subjectRaw ? subjectRaw.val : null;
  if (!subject && id) {
    const pre = id.val.split('-')[0];
    if (pre === 'math') subject = 'math';
    else if (pre === 'cn') subject = 'chinese';
    else if (pre === 'en') subject = 'english';
  }
  return { id: id ? id.val : null, subject, grades };
}

function gradeSet(arr) {
  return (arr || []).slice().sort((a, b) => a - b).join(',');
}

function main() {
  const registry = loadRegistry();
  if (!Array.isArray(registry)) {
    errors.push('registry.js 导出不是数组');
    return report();
  }

  // 扫描插件文件
  const allJs = [];
  walk(PLUGINS_DIR, allJs);
  const pluginFiles = [];
  for (const fp of allJs) {
    const base = path.basename(fp);
    if (EXCLUDE_FILES.has(base)) continue;
    const rel = path.relative(ROOT, fp).split(path.sep).join('/');
    const src = fs.readFileSync(fp, 'utf8');
    if (!isPluginFile(src)) continue;
    const meta = parsePlugin(src);
    pluginFiles.push({ rel, meta });
  }

  const byId = new Map();
  const byFile = new Map();
  registry.forEach(rec => { byId.set(rec.id, rec); byFile.set(rec.file, rec); });

  // A. 插件文件 → registry（以 file 路径匹配注册，再以 id 比对）
  for (const pf of pluginFiles) {
    const rec = byFile.get(pf.rel);
    if (!rec) {
      errors.push(`插件文件 ${pf.rel}（id='${pf.meta.id}'）未在 registry.js 注册`);
      continue;
    }
    if (pf.meta.id && rec.id && pf.meta.id !== rec.id) {
      errors.push(`插件 ${pf.rel} 声明 id='${pf.meta.id}' 与 registry 条目 id='${rec.id}' 不一致`);
    }
    if (pf.meta.subject && rec.subject && pf.meta.subject !== rec.subject) {
      errors.push(`插件 ${pf.rel} 的 subject='${pf.meta.subject}' 与 registry subject='${rec.subject}' 不一致`);
    }
    if (pf.meta.grades && rec.grades && gradeSet(pf.meta.grades) !== gradeSet(rec.grades)) {
      errors.push(`插件 ${pf.rel} 的 grades=[${pf.meta.grades}] 与 registry grades=[${rec.grades}] 不一致`);
    }
  }

  // B. registry → 文件
  for (const rec of registry) {
    const fp = path.join(ROOT, rec.file);
    if (!fs.existsSync(fp)) {
      errors.push(`registry 条目 id='${rec.id}' 的 file='${rec.file}' 不存在`);
      continue;
    }
    const src = fs.readFileSync(fp, 'utf8');
    if (!isPluginFile(src)) {
      errors.push(`registry 条目 id='${rec.id}' 的 file='${rec.file}' 不含插件导出（__currentPlugin），可能不是插件文件`);
      continue;
    }
    const meta = parsePlugin(src);
    if (meta.id && meta.id !== rec.id) {
      errors.push(`registry 条目 id='${rec.id}' 与文件 ${rec.file} 声明 id='${meta.id}' 不一致`);
    }
  }

  report();
}

function report() {
  if (errors.length) {
    console.error(`❌ verify-registry 发现 ${errors.length} 处不一致：`);
    errors.forEach(e => console.error(' - ' + e));
    process.exit(1);
  }
  const registry = loadRegistry();
  console.log(`✅ verify-registry 通过：registry ${Array.isArray(registry) ? registry.length : 0} 条，插件文件一一对应。`);
}

main();
