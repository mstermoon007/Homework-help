#!/usr/bin/env node
/**
 * dev/check-plugin-reachability.js — 插件可达性门禁（整改方案 R7）
 *
 * R7「插件净化：按可达性判定，宁归档不删」的可达性判定标准脚本化：
 *   1. 注册性：在 plugins/registry.js 注册？
 *   2. 知识点引用性：knowledge-*.js 的 pluginId 是否指向该插件？
 *   3. 生成路径可达性：被 generation 层 / UI / verify 链引用（如 operation-map、verify-setup）？
 *   三项均不可达 → 判为死代码候选（FAIL）。
 *
 * 已排除误判（R7 方案确认）：
 *   - plugins/svg-*：经 shared/generator/graphic-renderer.js 按 module 名动态加载，非死代码；
 *   - plugins/_template.js：scripts/new-plugin.js 的新插件模板，保留；
 *   - plugins/competition/checkers/*：内部模块（index.js 加载 _registry/_shared/c1-9），活跃。
 *
 * 同时核验 registry ↔ 文件双向一致性：
 *   - registry 引用但文件缺失（悬空注册）→ FAIL；
 *   - plugins/ 根目录存在但未注册未引用 → FAIL。
 *
 * 退出码 1 表示存在 FAIL。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

function run() {
  const results = [];
  const errors = [];
  function record(name, pass, detail) {
    results.push({ name, pass, detail });
    if (!pass) errors.push({ name, detail });
  }

  // ---------- 加载 registry ----------
  const reg = require(path.join(ROOT, 'plugins', 'registry.js'));
  const regIds = new Set(reg.map((e) => e.id));

  // ---------- 知识点 pluginId 引用 ----------
  const kbRefs = new Set();
  ['shared/knowledge-math.js', 'shared/knowledge-cn.js', 'shared/knowledge-en.js'].forEach((f) => {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    [...s.matchAll(/pluginId['"]?\s*:\s*['"]([^'"]+)['"]/g)].forEach((m) => kbRefs.add(m[1]));
  });

  // ---------- 生成路径引用（operation-map 等大服务层兜底映射） ----------
  const genRefs = new Set();
  const genFiles = ['shared/ontology-operation-map.js'];
  genFiles.forEach((f) => {
    if (fs.existsSync(path.join(ROOT, f))) {
      const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
      [...s.matchAll(/['"]([a-z0-9-]+)['"]/g)].forEach((m) => genRefs.add(m[1]));
    }
  });

  // ---------- registry ↔ 文件一致性 ----------
  const missingFiles = reg.filter((e) => !fs.existsSync(path.join(ROOT, e.file)));
  record('registry 引用均有对应文件（无悬空注册）', missingFiles.length === 0,
    'registry ' + reg.length + ' 条' + (missingFiles.length ? '，缺失 ' + missingFiles.map((e) => e.id + '→' + e.file).join('; ') : ''));

  // ---------- plugins/ 根目录未注册且未引用 js ----------
  const files = fs.readdirSync(path.join(ROOT, 'plugins')).filter((f) => /\.js$/.test(f) && f !== 'registry.js');
  const dead = [];
  files.forEach((f) => {
    const id = f.replace(/\.js$/, '');
    if (/^svg-/.test(id) || id === '_template') return; // 已排除
    if (regIds.has(id) || kbRefs.has(id)) return;
    if (genRefs.has(id)) return;
    dead.push(id);
  });
  record('plugins/ 根目录无死代码插件（未注册且无引用）', dead.length === 0,
    'plugins js ' + files.length + ' 个' + (dead.length ? '，死代码候选:' + dead.join(', ') : ''));

  // ---------- 已注册但无 KP 引用的插件（警示，非 FAIL——可能经生成路径/UI 可达） ----------
  const regNoKp = reg.filter((e) => !kbRefs.has(e.id));
  // 无 KP 引用但被生成路径 / 其他插件 / verify 引用者视为可达
  const reachableNoKp = [];
  const trulySuspicious = [];
  // 收集全部插件源码，用于「被其他插件 require」检测
  const pluginSrc = files.map((f) => ({ id: f.replace(/\.js$/, ''), src: fs.readFileSync(path.join(ROOT, 'plugins', f), 'utf8') }));
  regNoKp.forEach((e) => {
    const viaGen = genRefs.has(e.id);
    const viaVerify = fs.readFileSync(path.join(ROOT, 'dev', 'verify-setup.js'), 'utf8').includes(e.id);
    const viaPlugin = pluginSrc.some((p) => p.id !== e.id && p.src.includes(e.id));
    if (viaGen || viaVerify || viaPlugin) reachableNoKp.push(e.id);
    else trulySuspicious.push(e.id);
  });
  record('已注册无 KP 引用插件均有生成路径/verify 可达性', trulySuspicious.length === 0,
    '无KP引用 ' + regNoKp.length + ' 个；经生成路径/verify 可达 ' + reachableNoKp.length +
      (reachableNoKp.length ? ':' + reachableNoKp.join(',') : '') +
      (trulySuspicious.length ? '；可疑:' + trulySuspicious.join(',') : ''));

  // ---------- 汇总 ----------
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log('==== 插件可达性门禁（check-plugin-reachability） ====');
  results.forEach((r) => console.log('  [' + (r.pass ? 'PASS' : 'FAIL') + '] ' + r.name + (r.pass ? '' : ' — ' + r.detail)));
  console.log('-------------------------------------------');
  console.log('步骤 ' + results.length + ' 项，通过 ' + passCount + ' / 失败 ' + failCount);
  return { name: 'plugin-reachability', pass: failCount === 0, errors, summary: 'PLUGIN-REACHABILITY ' + passCount + '/' + results.length };
}

// 直接执行
if (require.main === module) {
  const r = run();
  process.exitCode = r.pass ? 0 : 1;
}
module.exports = { run };
