#!/usr/bin/env node
/**
 * scripts/add-asset-version.js — 为零构建静态站点注入 ?v=<APP_VERSION> 资源指纹。
 *
 * 扫描全部 HTML（入口页 + knowledge/ 等），对本地 shared/ plugins/ assets/ 的
 * <script src> / <link href> 追加（或更新）版本查询串。配合 sw.js 的 Cache-First +
 * 完整 URL 缓存键，版本升级后即令旧缓存失效，避免新旧样式混排。
 *
 * 用法：node scripts/add-asset-version.js
 * 约定：在部署/发布前运行（CI 或手动）。被改写的 HTML 不要求提交（保持源码干净），
 *       由部署流程（GitHub Actions）在服务端生成带版本指纹的副本后发布。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { APP_VERSION } = require('../shared/version.js');

const ROOT = path.resolve(__dirname, '..');
const htmlFiles = [];

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (dirent) {
    const full = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules' || dirent.name === '.git') return; // 跳过依赖/仓库元信息
      walk(full);
    } else if (dirent.name.endsWith('.html')) {
      htmlFiles.push(full);
    }
  });
}
walk(ROOT);

// 匹配 (src|href)="<可选 ./|../|/ ><shared|plugins|assets>/...<ext>(?可选?查询)>""
// 捕获组2为去查询后的基准 URL；替换时统一补 ?v=<APP_VERSION>，从而版本升级时自动更新旧指纹。
const assetPattern = /(src|href)="((?:\.\.?\/|\/)?(?:shared|plugins|assets)\/[^\"]+?\.(?:js|css|webp|svg))(?:\?[^"]*)?"/g;

let updated = 0;
htmlFiles.forEach(function (file) {
  const original = fs.readFileSync(file, 'utf8');
  const next = original.replace(assetPattern, function (match, attr, base) {
    return attr + '="' + base + '?v=' + APP_VERSION + '"';
  });
  if (next !== original) {
    fs.writeFileSync(file, next);
    updated++;
    console.log('Updated: ' + path.relative(ROOT, file));
  }
});
console.log('✅ add-asset-version: 共扫描 ' + htmlFiles.length + ' 个 HTML，更新 ' + updated +
  ' 个（版本 ' + APP_VERSION + '）');
