#!/usr/bin/env node
/**
 * dev/check-architecture-layers.js — 四层架构归类清单 Gate
 *
 * 校验 architecture/layers.json：
 *   [A] JSON 合法且结构符合 schema（layer.sub.<group>.files[]）
 *   [B] 清单内登记的文件路径全部存在（通配 * 目录除外）
 *   [C] 覆盖率：仓库根 + shared/ 下所有 .js / .css 均已被归类到某层；未分类即 FAIL
 *
 * 见 docs/ARCHITECTURE_LAYERS.md（四层：UI/生成/知识/大服务）。
 * 退出码：0 = PASS；1 = FAIL。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var MANIFEST = path.join(ROOT, 'architecture/layers.json');
var metaWarn = [];

// 读取清单并做基本结构校验
var manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
} catch (e) {
  console.log('[FAIL] architecture/layers.json JSON 非法: ' + e.message);
  process.exit(1);
}

var layers = manifest.layers;
if (!layers || typeof layers !== 'object') { console.log('[FAIL] layers.json 缺少 layers 对象'); process.exit(1); }

var layerNames = Object.keys(layers);
var expected = ['UI', 'GENERATION', 'KNOWLEDGE', 'SERVICE'];
var missingLayers = expected.filter(function (n) { return layerNames.indexOf(n) === -1; });
if (missingLayers.length) {
  console.log('[FAIL] 缺少强制层: ' + missingLayers.join(', '));
  process.exit(1);
}

// 展平：登记的全部具体文件路径 + 目录 glob 前缀（plugins/** 等按目录覆盖）
var listed = [];
var dirGlobs = [];
function registerGlob(p) {
  // 形如  plugins/**  → 前缀 plugins/
  var slashStar = p.indexOf('/**');
  if (slashStar > 0) dirGlobs.push(p.slice(0, slashStar + 1));
}
function collect(layer, groupName, files) {
  (files || []).forEach(function (p) { if (p.indexOf('*') === -1) listed.push(p); else registerGlob(p); });
}
layerNames.forEach(function (name) {
  var L = layers[name];
  collect(name, null, L.files);
  if (L.sub && typeof L.sub === 'object') {
    Object.keys(L.sub).forEach(function (g) {
      var gv = L.sub[g];
      if (!gv || typeof gv !== 'object' || !Array.isArray(gv.files)) {
        metaWarn.push('[' + name + '/' + g + '] 应为 { desc, files:[...] }');
        return;
      }
      collect(name, g, gv.files);
    });
  }
});

// [A] 结构
var structureOK = metaWarn.length === 0;
console.log((structureOK ? '[PASS] ' : '[FAIL] ') + '清单结构合法（layer.sub.<group>.files[]）' + (structureOK ? '' : ' — ' + metaWarn.join('; ')));

// [B] 存在性
var missing = listed.filter(function (p) { return !fs.existsSync(path.join(ROOT, p)); });

// [C] 覆盖率：扫描 shared/ + plugins/ 全部 .js/.css + 顶层 .js，与登记/目录glob比对
function walk(dir, acc) {
  fs.readdirSync(dir).forEach(function (n) {
    var full = path.join(dir, n);
    var st = fs.statSync(full);
    if (st.isDirectory()) { walk(full, acc); return; }
    if (/\.(js|css)$/.test(n)) acc.push(path.relative(ROOT, full));
  });
  return acc;
}
var all = walk(path.join(ROOT, 'shared'), []);
walk(path.join(ROOT, 'plugins'), all);
fs.readdirSync(ROOT).forEach(function (n) {
  if (/\.(js)$/.test(n) && fs.existsSync(path.join(ROOT, n))) all.push(n);
});
var skipPrefixes = ['shared/legacy/', 'shared/question/']; // 空目录虚拟引用，非真实文件
var unlisted = all.filter(function (p) {
  var skip = skipPrefixes.some(function (s) { return p.indexOf(s) === 0; });
  var coveredByGlob = dirGlobs.some(function (g) { return p.indexOf(g) === 0; });
  if (skip || coveredByGlob) return false;
  return listed.indexOf(p) === -1;
});

// 输出
var pass = true;
if (!structureOK) pass = false;
if (missing.length) { console.log('[FAIL] 清单登记但文件缺失 (' + missing.length + '):\n   - ' + missing.join('\n   - ')); pass = false; }
else console.log('[PASS] 清单内登记文件全部存在 (' + listed.length + ' 个)');

if (unlisted.length) {
  console.log('[FAIL] 未归类到清单的物理文件 (' + unlisted.length + '):\n   - ' + unlisted.join('\n   - '));
  pass = false;
} else {
  console.log('[PASS] 覆盖率：shared/ + 根 .js 全部已归类 (' + all.length + ' 个文件)');
}

console.log('\n四层架构归类 Gate：' + (pass ? 'PASS' : 'FAIL'));
process.exitCode = pass ? 0 : 1;