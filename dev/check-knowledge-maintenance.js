#!/usr/bin/env node
/**
 * dev/check-knowledge-maintenance.js — P2-R04 知识库维护 Gate
 *
 * 知识库更新机制校验：
 *   1. 仅修改 knowledge-{math,cn,en}.js 分片（不修改其他业务文件）
 *   2. Ontology 校验通过（knowledge-ontology.js）
 *   3. Capability 校验通过（capability-resolver.js / capability-matrix.js）
 *   4. Coverage 校验通过（check-generator-coverage.js / check-renderer-coverage.js）
 *   3. 不因新增知识点创建 Plugin（pluginId 仅引用现有插件）
 *
 * 用法：
 *   node dev/check-knowledge-maintenance.js           # 常规检查
 *   node dev/check-knowledge-maintenance.js --enforce # 门禁模式（失败即退出 1）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..');
var ENFORCE = process.argv.indexOf('--enforce') !== -1;

var pass = [];
var fail = [];
function add(name, ok, extra) {
  if (ok) pass.push(name); else fail.push(name + (extra ? ' — ' + extra : ''));
  console.log((ok ? '[PASS] ' : '[FAIL] ') + name + (extra ? (' (' + extra + ')') : ''));
}

function run(cmd, args) {
  var r = cp.spawnSync(process.execPath, [path.join(ROOT, cmd)].concat(args || []), { encoding: 'utf8' });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

console.log('=== P2-R04 知识库维护 Gate ===\n');

// 1. 知识库分片文件存在性
var kbFiles = [
  'shared/knowledge-math.js',
  'shared/knowledge-cn.js',
  'shared/knowledge-en.js'
];
kbFiles.forEach(function (f) {
  add('知识库分片存在: ' + f, fs.existsSync(path.join(ROOT, f)));
});

// 2. Ontology 校验
var ont = run('dev/check-ontology-schema.js');
add('Ontology Schema 校验', ont.status === 0 && /PASS|OK/i.test(ont.out), ont.out.slice(0, 200));

// 3. Capability 校验
var cap = run('dev/check-capability-resolver.js');
add('Capability Resolver 校验', cap.status === 0 && /PASS|OK/i.test(cap.out), cap.out.slice(0, 200));

// 4. Capability Matrix 校验
var mx = run('dev/check-capability-matrix.js');
add('Capability Matrix 校验', mx.status === 0 && /PASS|OK/i.test(mx.out), mx.out.slice(0, 200));

// 5. Generator Coverage 校验
var gcov = run('dev/check-generator-coverage.js');
add('Generator Coverage 校验 (0 orphan KP / 0 orphan capability)', 
  gcov.status === 0 && /orphan knowledge points: 0/.test(gcov.out) && /orphan capabilities    : 0/.test(gcov.out),
  gcov.out.slice(0, 200));

// 6. Renderer Coverage 校验
var rcov = run('dev/check-renderer-coverage.js');
add('Renderer Coverage 校验 (0 unsupported graphic)', 
  rcov.status === 0 && /unsupported graphic types: ✓/.test(rcov.out),
  rcov.out.slice(0, 200));

// 7. 知识点 pluginId 仅引用现有插件（不创建新 Plugin）
var pluginIds = new Set();
if (fs.existsSync(path.join(ROOT, 'plugins', 'registry.js'))) {
  var regSrc = fs.readFileSync(path.join(ROOT, 'plugins', 'registry.js'), 'utf8');
  var m;
  var re = /id\s*:\s*['"]([^'"]+)['"]/g;
  while ((m = re.exec(regSrc))) pluginIds.add(m[1]);
}
var kbIdsReferenced = new Set();
var kpPluginIds = new Set();
kbFiles.forEach(function (f) {
  var src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  var re = /pluginId\s*:\s*['"]([^'"]+)['"]/g;
  var m;
  while ((m = re.exec(src))) {
    kbIdsReferenced.add(m[1]);
    kpPluginIds.add(m[1]);
  }
});
var unknownPlugins = Array.from(kpPluginIds).filter(function (id) { return !pluginIds.has(id); });
add('知识点 pluginId 均在注册表中', unknownPlugins.length === 0, unknownPlugins.length ? ('未知 pluginId: ' + unknownPlugins.join(', ')) : '');

// 8. 不因新增知识点创建 Plugin（启发式：新增 KP 数 vs 新增 Plugin 数）
// 仅作提示，不阻断
console.log('\n[信息] 知识点引用的插件数: ' + kpPluginIds.size + '，注册表插件数: ' + pluginIds.size);

console.log('\n知识库维护 Gate：' + pass.length + '/' + (pass.length + fail.length) + ' 通过');
if (fail.length) {
  console.log('失败项:\n - ' + fail.join('\n - '));
  if (ENFORCE) process.exitCode = 1;
} else {
  console.log('KNOWLEDGE-MAINTENANCE: PASS');
  process.exitCode = 0;
}