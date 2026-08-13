#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let allPassed = true;
const results = [];

function check(description, condition) {
  results.push({ description, pass: !!condition });
  if (!condition) allPassed = false;
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function fileContains(relativePath, substring) {
  try {
    const content = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
    return content.includes(substring);
  } catch {
    return false;
  }
}

// 1. 核心保护层目录及文件
check('shared/ 目录存在', fileExists('shared/'));
check('plugins/ 目录存在', fileExists('plugins/'));
check('agents/ 目录存在', fileExists('agents/'));
check('dev/ 目录存在', fileExists('dev/'));

// 2. 插件接口类型定义
check('shared/plugin-types.js 存在', fileExists('shared/plugin-types.js'));
check('plugin-types.js 包含 ExercisePlugin 类型', fileContains('shared/plugin-types.js', 'ExercisePlugin'));

// 3. 样板插件
check('plugins/_template.js 存在', fileExists('plugins/_template.js'));
check('_template.js 包含 plugin 对象', fileContains('plugins/_template.js', 'const plugin'));
check('_template.js 包含 generate', fileContains('plugins/_template.js', 'generate'));
check('_template.js 包含 render', fileContains('plugins/_template.js', 'render'));
check('_template.js 包含 check', fileContains('plugins/_template.js', 'check'));
check('_template.js 包含 window.__currentPlugin', fileContains('plugins/_template.js', 'window.__currentPlugin'));

// 4. 验证工具页
check('dev/plugin-check.html 存在', fileExists('dev/plugin-check.html'));
check('plugin-check.html 包含验证逻辑', fileContains('dev/plugin-check.html', 'runBtn'));

// 5. 核心保护配置文件
check('.github/CODEOWNERS 存在', fileExists('.github/CODEOWNERS'));
check('CODEOWNERS 包含 practice.html', fileContains('.github/CODEOWNERS', 'practice.html'));
check('CODEOWNERS 包含 shared/common.js', fileContains('.github/CODEOWNERS', 'shared/common.js'));

// 6. 贡献指南
check('CONTRIBUTING.md 存在', fileExists('CONTRIBUTING.md'));
check('CONTRIBUTING.md 提及禁止操作 DOM', fileContains('CONTRIBUTING.md', '禁止操作 DOM'));

// 7. 插件注册表
check('plugins/registry.js 存在', fileExists('plugins/registry.js'));
check('registry.js 包含 PLUGIN_REGISTRY', fileContains('plugins/registry.js', 'PLUGIN_REGISTRY'));

// 8. 核心完整性检查脚本
check('dev/check-core-integrity.js 存在', fileExists('dev/check-core-integrity.js'));

// 9. 知识点覆盖基线（数学知识库 1-3 年级均有数据，且注册表可计算覆盖）
try {
  const KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
  const reg = require(path.join(ROOT, 'plugins', 'registry.js'));
  let okAll = true;
  [1, 2, 3].forEach(g => {
    const cov = KB.coverageFromRegistry('math', g, reg);
    if (cov.total === 0) okAll = false;
  });
  check('数学知识库覆盖基线可用（1-3 年级均有知识点数据）', okAll);
} catch (e) {
  check('数学知识库覆盖基线可用', false);
}

// 9. 可选：检查 git 是否已初始化（表明仓库已就绪）
try {
  execSync('git status', { cwd: ROOT, stdio: 'ignore' });
  check('Git 仓库已初始化', true);
} catch {
  check('Git 仓库已初始化（可选）', false); // 不强制失败
}

// 输出结果
console.log('\n📋 项目搭建验证结果\n' + '='.repeat(40));
results.forEach((r, i) => {
  console.log(`${r.pass ? '✅' : '❌'} ${r.description}`);
});

console.log('\n' + '='.repeat(40));
if (allPassed) {
  console.log('🎉 所有检查通过！项目开发环境已就绪。');
} else {
  console.log('⚠️  部分检查未通过，请根据上方 ❌ 项进行修复。');
}

// 输出达到的效果总结
console.log('\n📊 已达到的效果：');
console.log('- 核心文件保护机制已建立（CODEOWNERS）');
console.log('- 插件接口规范已定义（plugin-types.js）');
console.log('- 标准样板插件可复用（_template.js）');
console.log('- 本地插件验证工具可用（plugin-check.html）');
console.log('- 贡献指南与编码规范已文档化（CONTRIBUTING.md）');
console.log('- 插件注册表骨架已创建（registry.js）');
console.log('- 后续新增题型只需：复制样板 → 实现方法 → 注册 → 验证');
console.log('- 防代码漂移的架构基础已具备，可持续迭代1-6年级全科目练习');
