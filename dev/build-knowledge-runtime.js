#!/usr/bin/env node
/**
 * dev/build-knowledge-runtime.js — KBL Runtime 浏览器单文件入口（方案 §23）
 *
 * 将 runtime/ 下 7 个模块按依赖顺序拼接为单一 IIFE：
 *   knowledge-contract → knowledge-loader → knowledge-relation → knowledge-policy
 *   → knowledge-index → knowledge-query → knowledge-api
 *
 * 每个模块自身已具 IIFE（检测 global vs module.exports 以区分浏览器/Node），
 * 无需外层 fake require —— 只须按序拼接，浏览器环境自然走 global 路径。
 *
 * 输出：shared/knowledge/runtime/knowledge-runtime.js
 *        页面以 <script src="shared/knowledge/runtime/knowledge-runtime.js"> 引入后
 *        获得 window.App.KNOWLEDGE（KnowledgeAPI）以及全局别名 window.KnowledgeAPI。
 *
 * Node 内可 require 本产物做冒烟测试（__dirname 解析路径一致，走 fs 加载数据）。
 *
 * 用法：node dev/build-knowledge-runtime.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RUNTIME_DIR = path.join(ROOT, 'shared/knowledge/runtime');

const MODULES = [
  'knowledge-contract.js',
  'knowledge-loader.js',
  'knowledge-relation.js',
  'knowledge-policy.js',
  'knowledge-index.js',
  'knowledge-query.js',
  'knowledge-api.js'
];

const HEADER = [
  '/* ============================================================ */',
  '/* 自动生成：node dev/build-knowledge-runtime.js（请勿手改）       */',
  '/* KBL Runtime 浏览器单文件入口（方案 §23 单入口）                 */',
  '/*                                                               */',
  '/* 包含模块（按依赖顺序）：                                       */',
  '/*   contract → loader → relation → policy → index → query → api */',
  '/*                                                               */',
  '/* 页面引入后暴露：                                               */',
  '/*   window.App.KNOWLEDGE   — KnowledgeAPI 唯一公开入口           */',
  '/*   window.KnowledgeAPI    — 便捷别名                            */',
  '/*                                                               */',
  '/* 禁止：业务层直接访问 catalog/relation/mapping/index JSON；      */',
  '/*       只允许通过 App.KNOWLEDGE 查询（方案 §24/§44）。           */',
  '/* ============================================================ */',
  ''
].join('\n');

const FOOTER = [
  '',
  '/* KnowledgeAPI 便捷别名：页面可直接用 KnowledgeAPI.byGrade(...) 等 */',
  '(function (global) {',
  '  if (global.App && global.App.KNOWLEDGE) global.KnowledgeAPI = global.App.KNOWLEDGE;',
  '})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));',
  ''
].join('\n');

const parts = [HEADER];
MODULES.forEach(function (file) {
  var src = fs.readFileSync(path.join(RUNTIME_DIR, file), 'utf8');
  // 去掉可能的 trailing newline 避免拼接时多余空行
  parts.push(src.replace(/\n$/, ''));
});
parts.push(FOOTER);

const out = parts.join('\n');
const outPath = path.join(RUNTIME_DIR, 'knowledge-runtime.js');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out, 'utf8');

console.log('Knowledge Runtime bundle written: shared/knowledge/runtime/knowledge-runtime.js (' + (out.length / 1024).toFixed(1) + ' KB)');
