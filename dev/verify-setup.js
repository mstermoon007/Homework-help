#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let allPassed = true;
const results = [];

// detail：可选的失败详情（仅在未通过时输出，便于定位具体是哪一项不合规）
function check(description, condition, detail) {
  results.push({ description, pass: !!condition, detail: detail || '' });
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
check('dev/ 目录存在', fileExists('dev/'));

// 2. 插件接口类型定义
check('shared/plugin-types.js 存在', fileExists('shared/plugin-types.js'));
check('plugin-types.js 包含 ExercisePlugin 类型', fileContains('shared/plugin-types.js', 'ExercisePlugin'));

// 3. 样板插件
check('plugins/_template.js 存在', fileExists('plugins/_template.js'));
check('_template.js 包含 plugin 对象', fileContains('plugins/_template.js', 'var plugin'));
check('_template.js 包含 generate', fileContains('plugins/_template.js', 'generate'));
check('_template.js 包含 render', fileContains('plugins/_template.js', 'render'));
check('_template.js 包含 check', fileContains('plugins/_template.js', 'check'));
check('_template.js 导出 __currentPlugin', fileContains('plugins/_template.js', '__currentPlugin'));

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

// 9.1 模块目录与插件 moduleId 一致性
try {
  const MC = require(path.join(ROOT, 'shared', 'module-catalog.js'));
  const KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
  const reg = require(path.join(ROOT, 'plugins', 'registry.js'));
  const validModules = new Set(MC.map(m => m.id));

  // 模块目录完整性：基础 M0-M12 + 竞赛 C1-C9 齐全、ID 唯一、无缺失
  const compMods = MC.filter(m => m.level === 'competition');
  const compIds = compMods.map(m => m.id).sort();
  const expectComp = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const uniqueIds = new Set(MC.map(m => m.id));
  check('MODULE_CATALOG 包含全部竞赛模块（C1-C9）且无缺失',
    MC.length === 22 && compMods.length === 9 &&
    JSON.stringify(compIds) === JSON.stringify(expectComp) &&
    uniqueIds.size === MC.length);

  // 每个注册数学插件必须有 moduleId，且存在于模块目录（从插件源文件提取）；
  // 占位插件（isPlaceholder）豁免该约束——允许存在，仅要求带占位标记
  let pluginOk = true;
  const missingModule = [];
  reg.filter(p => p.subject === 'math').forEach(p => {
    if (p.isPlaceholder) return; // 占位插件豁免 moduleId 约束
    const file = path.join(ROOT, p.file);
    let src = '';
    try { src = fs.readFileSync(file, 'utf8'); } catch (e) {}
    const m = src.match(/moduleId:\s*'([^']+)'/);
    if (!m || !validModules.has(m[1])) { pluginOk = false; missingModule.push(p.id + (m ? '(非法:' + m[1] + ')' : '(缺失)')); }
  });
  check('注册数学插件均有 moduleId 且与模块目录一致（占位插件豁免）', pluginOk);
  check('竞赛占位插件已注册且带占位标记', reg.some(r => r.id === 'math-competition-placeholder' && r.isPlaceholder));
  if (missingModule.length) console.log('    缺少/非法 moduleId 的插件：' + missingModule.join('、'));

  // 知识库：结构正确（数组 + grade/modules/knowledgePoints），模块 knowledgePoints 允许为空数组；
  // 模块 ID 须存在，知识点 pluginId 须已注册
  let kbFormatOk = Array.isArray(KB) && KB.length > 0;
  let kbRefOk = true;
  KB.forEach(g => {
    if (!g || typeof g.grade !== 'number' || !Array.isArray(g.modules)) { kbFormatOk = false; return; }
    g.modules.forEach(m => {
      if (!m || !m.moduleId || !validModules.has(m.moduleId)) kbRefOk = false;
      if (!Array.isArray(m.knowledgePoints)) { kbFormatOk = false; return; }
      m.knowledgePoints.forEach(kp => {
        if (!reg.some(r => r.id === kp.pluginId)) kbRefOk = false;
      });
    });
  });
  check('知识库文件存在且结构正确（允许模块 knowledgePoints 为空数组）', kbFormatOk);
  check('知识库模块 ID 与模块目录一致且知识点插件已注册', kbRefOk);

  // 9.2 竞赛模块（C1-C9）须全部有插件覆盖（真实插件优先，未实现的由占位插件兜底），
  //     避免题型选择页空白/报错。已实现的 Cx 必须从占位 moduleIds 中移除，防止一个模块两个入口。
  try {
    const compMods = MC.filter(m => m.level === 'competition');
    const placeholderRec = reg.find(r => r.id === 'math-competition-placeholder');
    const declared = (placeholderRec && Array.isArray(placeholderRec.moduleIds))
      ? placeholderRec.moduleIds : [];
    const declaredSet = new Set(declared);
    // 已实现的竞赛插件（非占位）声明的竞赛模块
    const realComp = reg.filter(r => !r.isPlaceholder && Array.isArray(r.moduleIds)
      && r.moduleIds.some(id => /^C\d$/.test(id)));
    const realSet = new Set();
    realComp.forEach(r => r.moduleIds.forEach(id => { if (/^C\d$/.test(id)) realSet.add(id); }));
    const uncovered = compMods.filter(m => !declaredSet.has(m.id) && !realSet.has(m.id)).map(m => m.id);
    const dup = [...realSet].filter(id => declaredSet.has(id));   // 真实插件与占位重复覆盖
    const placeholderFile = placeholderRec ? path.join(ROOT, placeholderRec.file) : '';
    let srcOk = false;
    try {
      const src = fs.readFileSync(placeholderFile, 'utf8');
      srcOk = src.includes('isPlaceholder') && src.includes('题目开发中');
    } catch (e) {}
    check('竞赛模块 C1-C9 全部有插件覆盖（真实插件 + 占位兜底）',
      compMods.length === 9 && uncovered.length === 0,
      uncovered.length ? '未覆盖：' + uncovered.join('、') : '');
    check('已实现的竞赛模块已从占位 moduleIds 移除（无重复入口）',
      dup.length === 0, dup.length ? '重复覆盖：' + dup.join('、') : '');
    check('占位插件文件实现占位逻辑（isPlaceholder + 提示文案）', srcOk);
  } catch (e) {
    check('竞赛占位插件校验', false);
  }

  // 9.3 各年级（M1-M12）结构校验：知识库全覆盖 + 知识点 pluginId 均已注册
  // 单一来源：四/五/六年级共用同一段逻辑，避免各年级各写一份导致规则漂移
  //（历史问题：曾只有四年级放宽了模块数断言，六年级仍硬编码 === 12，竞赛模块入库后误报）。
  // 规则：M1-M12 为必备模块，竞赛模块（C1-C9）可额外出现 → 只校验「M1-M12 全覆盖且无空模块」，不限模块总数。
  const GRADE_CN = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };
  const EXPECT_M_IDS = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'];
  function checkGradeStructure(grade) {
    const cn = GRADE_CN[grade] || (grade + '年级');
    try {
      const g = KB.findGrade ? KB.findGrade(grade) : null;
      const mods = g && Array.isArray(g.modules) ? g.modules : [];
      const ids = mods.map(m => m.moduleId);
      const missingM = EXPECT_M_IDS.filter(id => ids.indexOf(id) === -1);
      const emptyMods = mods
        .filter(m => !Array.isArray(m.knowledgePoints) || m.knowledgePoints.length === 0)
        .map(m => m.moduleId);
      const missingPlugin = [];
      mods.forEach(m => (m.knowledgePoints || []).forEach(kp => {
        if (!reg.some(r => r.id === kp.pluginId)) missingPlugin.push(kp.pluginId);
      }));
      const detail = [
        g === null ? '知识库缺少该年级' : '',
        missingM.length ? '缺模块：' + missingM.join('、') : '',
        emptyMods.length ? '空模块：' + emptyMods.join('、') : ''
      ].filter(Boolean).join('；');
      check(cn + '知识库覆盖 M1-M12 全部模块且无空模块',
        g !== null && !missingM.length && !emptyMods.length, detail);
      check(cn + '知识点 pluginId 均已注册（占位或已实现）', missingPlugin.length === 0,
        missingPlugin.length ? '未注册 pluginId：' + [...new Set(missingPlugin)].join('、') : '');
    } catch (e) {
      check(cn + '结构校验', false, e && e.message);
    }
  }
  [4, 5, 6].forEach(checkGradeStructure);
} catch (e) {
  check('模块目录/知识库一致性校验', false);
}

// 8.5 知识库结构校验（dev/verify-knowledge-bank.js 自动执行：模块ID、插件ID、weight/type、高年级 M1-M12 专项）
try {
  execSync(`node ${path.join('dev', 'verify-knowledge-bank.js')} --g4 --g5 --g6`, { cwd: ROOT, stdio: 'pipe' });
  check('知识库结构校验通过（verify-knowledge-bank.js --g4 --g5 --g6）', true);
} catch {
  check('知识库结构校验通过（verify-knowledge-bank.js --g4 --g5 --g6）', false);
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
  if (!r.pass && r.detail) console.log(`     ↳ ${r.detail}`);
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
