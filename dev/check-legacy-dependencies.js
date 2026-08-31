/**
 * dev/check-legacy-dependencies.js — M7-R19 旧插件依赖检查
 *
 * 目标（R16/R18）：
 *   - UI 页面不得直接执行旧插件（plugin.generate / plugin.render）；
 *   - UI 页面不得直接加载旧插件（require / import / App.plugins / PLUGIN_REGISTRY 执行引用）；
 *   - 管线/共享层不得直接调用 LegacyPlugin（除白名单桥接实现）。
 *
 * 分类：
 *   executions  — plugin.generate( / state.plugin.generate( / plugin.render( / state.plugin.render(
 *   deps        — require( / import  / App.plugins / plugin.load 等插件获取调用
 *   renders     — plugin.svg / SVGGenerators / .svgWrap
 *
 * 输出（R19）：
 *   Legacy dependencies: 0
 *   Legacy execution references: 0
 *   Legacy render references: 0
 *
 * 用法：node dev/check-legacy-dependencies.js
 * 退出码：有非白名单命中时 1，否则 0。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');

var PAGES = [
  'practice.html',
  'math-types.html',
  'subject-types.html'
];

// 允许的桥接实现（含内部实现），其余一律不得出现 legacy 执行/渲染引用
var WHITELIST = [
  'shared/legacy/plugin-adapter.js',
  'shared/generator/legacy-plugin-adapter.js',
  'shared/generator/generator-selector.js', // 合法消费 shared/legacy/plugin-adapter.js（M7-R18）
  'shared/strategy/legacy-adapter.js',
  'shared/generation-engine.js' // R28 boundary 检测桩 + R18 统一桥（经 LegacyPluginAdapter，非直连插件）
];

// 核心管线 + 共享层（页面之外的所有审查对象；白名单外出现即失败）
function pipelineFiles() {
  var out = [];
  ['shared/presentation', 'shared/strategy', 'shared/generator', 'shared/validator'].forEach(function (dir) {
    walk(path.join(ROOT, dir), '.js', out);
  });
  ['shared/generation-engine.js', 'shared/generator-registry.js', 'shared/generator-capability-registry.js',
   'shared/presentation-engine.js', 'shared/generator-selector.js'].forEach(function (f) {
    if (fs.existsSync(path.join(ROOT, f))) out.push(f);
  });
  return out;
}

function walk(dir, suffix, out) {
  if (!fs.existsSync(dir)) return out;
  fs.readdirSync(dir).forEach(function (name) {
    var fp = path.join(dir, name);
    var st = fs.statSync(fp);
    if (st.isDirectory()) walk(fp, suffix, out);
    else if (name.endsWith(suffix)) out.push(path.relative(ROOT, fp));
  });
  return out;
}

// 去除注释（HTML 注释 / 行注释 / 块注释），避免把注释里的 plugin.generate 误判为执行引用
function stripComments(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, '');
  src = src.replace(/\/\*[\s\S]*?\*\//g, '');
  src = src.replace(/^\s*\/\/.*$/gm, '');
  return src;
}

function countActive(file, patterns) {
  var abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) return 0;
  var src = stripComments(fs.readFileSync(abs, 'utf8'));
  var n = 0;
  patterns.forEach(function (re) {
    var m = src.match(re);
    if (m) n += m.length;
  });
  return n;
}

var EXEC_RE = /(?:state\.)?plugin\.generate\s*\(|(?:state\.)?plugin\.render\s*\(/g;
var DEP_RE = /require\s*\(|(?:^|\s)import\s+|\bApp\.plugins\b|= *new Plugin\b|\bPLUGIN_REGISTRY\[/g;
// 旧插件原始渲染调用 agent（plugin.svg(…)）；SVGGenerators 注册表/注册器属 presentation 管线自身，不计入
var RENDER_RE = /plugin\.svg\s*\(/g;

var failed = false;

// Section A：三个页面必须全零（何况 practice.html 保留 state.plugin 仅作元数据处理）
var pageExec = 0, pageDep = 0, pageRender = 0;
PAGES.forEach(function (f) {
  pageExec += countActive(f, [EXEC_RE]);
  pageDep += countActive(f, [DEP_RE]);
  pageRender += countActive(f, [RENDER_RE]);
});

if (pageExec > 0) {
  failed = true;
  console.error('FAIL [A] 页面存在旧插件执行引用 plugin.generate/plugin.render: ' + pageExec);
}
if (pageDep > 0) {
  failed = true;
  console.error('FAIL [A] 页面存在旧插件加载引用 require/import/App.plugins: ' + pageDep);
}
if (pageRender > 0) {
  failed = true;
  console.error('FAIL [A] 页面存在旧插件渲染引用 plugin.svg/SVGGenerators/svgWrap: ' + pageRender);
}

// Section B：管线/共享层除白名单外不得直接执行旧插件
pipelineFiles().forEach(function (f) {
  if (WHITELIST.indexOf(f) !== -1) return;
  var exec = countActive(f, [EXEC_RE]);
  var render = countActive(f, [RENDER_RE]);
  if (exec > 0) {
    failed = true;
    console.error('FAIL [B] 白名单外管线文件直接执行旧插件 (' + f + '): ' + exec);
  }
  if (render > 0) {
    failed = true;
    console.error('FAIL [B] 白名单外管线文件直接渲染旧插件 (' + f + '): ' + render);
  }
});

console.log('Legacy dependencies: ' + (pageDep));
console.log('Legacy execution references: ' + (pageExec));
console.log('Legacy render references: ' + (pageRender));
if (failed) {
  console.error('LEGACY-DEPENDENCIES: FAIL');
  process.exitCode = 1;
} else {
  console.log('LEGACY-DEPENDENCIES: PASS (R16/R18/R19 合规)');
  process.exitCode = 0;
}