#!/usr/bin/env node
/**
 * dev/plugin-registry.js — 插件注册表读取模块（步骤 2）
 *
 * 职责：
 *   读取 plugins/registry.js 的 PLUGIN_REGISTRY 数组，
 *   提取每个插件的 id 与 file 路径（附带 name/subject/grades 等元数据），
 *   返回标准化的插件条目列表。
 *
 * API：
 *   const { readRegistry, getEntry } = require('./dev/plugin-registry.js');
 *   readRegistry();              // → [{ id, file, absolutePath, ... }, ...]
 *   getEntry('math-oral');       // → 条目或 null
 *
 * CLI：
 *   node dev/plugin-registry.js                 # 打印全部条目清单
 *   node dev/plugin-registry.js --subject math  # 按科目过滤
 *   node dev/plugin-registry.js --json          # JSON 输出
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

/**
 * 读取注册表并标准化条目。
 * @returns {Array<{
 *   id: string,
 *   file: string,
 *   absolutePath: string,
 *   runtimeId: string,
 *   name: string,
 *   subject: string|null,
 *   category: string|null,
 *   grades: number[],
 *   moduleIds: string[],
 *   deps: string[],
 *   isPlaceholder: boolean
 * }>}
 */
function readRegistry() {
  var registryPath = path.join(ROOT, 'plugins', 'registry.js');
  if (!fs.existsSync(registryPath)) {
    throw new Error('找不到注册表文件：' + registryPath);
  }
  // 清除缓存后重载，保证开发期多次调用拿到最新内容
  delete require.cache[require.resolve(registryPath)];
  var mod = require(registryPath);
  var arr = Array.isArray(mod) ? mod : (global.PLUGIN_REGISTRY || []);
  if (!Array.isArray(arr)) {
    throw new Error('PLUGIN_REGISTRY 不是数组，请检查 plugins/registry.js');
  }

  return arr
    .filter(function (e) { return e && e.id && e.file; })
    .map(function (e) {
      return {
        id: e.id,
        file: e.file,
        absolutePath: path.join(ROOT, e.file),
        runtimeId: e.runtimeId || e.id,
        name: e.name || '',
        subject: e.subject || null,
        category: e.category == null ? null : e.category,
        grades: Array.isArray(e.grades) ? e.grades.slice() : [],
        moduleIds: Array.isArray(e.moduleIds) ? e.moduleIds.slice() : [],
        deps: Array.isArray(e.deps) ? e.deps.slice() : [],
        isPlaceholder: !!e.isPlaceholder
      };
    });
}

/** 按 id 取单个条目；不存在返回 null */
function getEntry(id) {
  var list = readRegistry();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id || list[i].runtimeId === id) return list[i];
  }
  return null;
}

module.exports = { readRegistry: readRegistry, getEntry: getEntry };

// ---- CLI ----
if (require.main === module) {
  var args = process.argv.slice(2);
  var subjectFilter = null;
  var asJson = args.indexOf('--json') !== -1;
  var si = args.indexOf('--subject');
  if (si !== -1 && args[si + 1]) subjectFilter = args[si + 1];

  var list = readRegistry();
  if (subjectFilter) {
    list = list.filter(function (e) { return e.subject === subjectFilter; });
  }

  if (asJson) {
    console.log(JSON.stringify(list, null, 2));
  } else {
    console.log('插件注册表：共 ' + list.length + ' 个条目\n');
    list.forEach(function (e) {
      var flags = [];
      if (e.isPlaceholder) flags.push('占位');
      if (e.deps.length) flags.push('deps:' + e.deps.join('+'));
      console.log(
        '  ' + e.id +
        '  [' + (e.subject || '-') + ']' +
        (flags.length ? '  (' + flags.join(', ') + ')' : '') +
        '\n    └─ ' + e.file
      );
    });
  }
}
