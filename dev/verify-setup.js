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
check('dev/ 目录存在', fileExists('dev/'));

// 2.5 难度系统模块（v2）
check('shared/difficulty.js 存在', fileExists('shared/difficulty.js'));
check('difficulty.js 挂载 App.Difficulty', fileContains('shared/difficulty.js', 'App.Difficulty'));
check('difficulty.js 暴露 consume/createProfile/consumeProfile/difficultyToStructure',
  ['consume', 'createProfile', 'consumeProfile', 'difficultyToStructure'].every(function (k) {
    return fileContains('shared/difficulty.js', k);
  }));

// 2.6 科目化模块（任务12/13：工具归类 + 科目 SVG 生成器）
check('shared/subject-utils.js 存在', fileExists('shared/subject-utils.js'));
check('subject-utils 暴露 MathUtil',
  ['MathUtil'].every(function (k) {
    return fileContains('shared/subject-utils.js', k);
  }));
// 可加载性冒烟：require 后断言真实挂载（而非仅文本存在）
try {
  const su = require(path.join(ROOT, 'shared', 'subject-utils.js'));
  const okSU = !!(su.MathUtil
    && typeof su.MathUtil.rangeByLevel === 'function');
  const dfy = require(path.join(ROOT, 'shared', 'difficulty.js'));
  const okD = !!(dfy.DifficultyProfiles && dfy.DifficultyProfiles.math
    && dfy.paramsFor && dfy.profileFor && dfy.strategyFor);
  check('subject-utils/difficulty 可加载且暴露科目能力（Profiles / paramsFor / strategyFor）', okSU && okD);
} catch (e) {
  check('subject-utils/difficulty 可加载且暴露科目能力', false, e && e.message);
}

// 3. legacy 插件轨道（MATH-14）：plugin-types/_template/registry/plugin-check.html 已删除，
//    禁止复活 —— 复活检测由 dev/check-architecture-rules.js R5 承接，此处不再要求存在。

// 5. 核心保护配置文件
check('.github/CODEOWNERS 存在', fileExists('.github/CODEOWNERS'));
check('CODEOWNERS 包含 practice.html', fileContains('.github/CODEOWNERS', 'practice.html'));
check('CODEOWNERS 包含 shared/common.js', fileContains('.github/CODEOWNERS', 'shared/common.js'));

// 6. 贡献指南与编码规范（V4.0.1 起统一维护于根目录《技术文档--基础》）
check('技术文档--基础.md 存在', fileExists('技术文档--基础.md'));
check('技术文档--基础.md 载明 DOM 边界规范', fileContains('技术文档--基础.md', 'DOM 边界'));

// 7. 题型目录页已收口：math-types.html 于「目录页合并」中改为纯重定向桩，
//    不再承载题型渲染，故不再要求引入共享层脚本，改而校验其重定向目标
//    （收口到 select.html，保留极简 subject 解析并透传 grade 等参数）。
const mathTypesRedirect =
  fileContains('math-types.html', "location.replace('select.html") &&
  fileContains('math-types.html', "params.set('subject', 'math')");
check('math-types.html 为重定向桩（→ select.html，subject=math）', mathTypesRedirect);

// 7.1 旧目录页合并为重定向/转发桩：统一收口到 select.html（科目/年级/题型三维选择）。
//     subject-types.html 原样透传 query 到 select.html，不再重定向 practice.html。
check('subject-types.html 为转发桩（重定向到 select.html）',
  fileContains('subject-types.html', "location.replace('select.html'"));

// 8. 核心完整性检查脚本
check('dev/check-core-integrity.js 存在', fileExists('dev/check-core-integrity.js'));

// 9. native Generator 轨道冒烟（MATH-14）：GeneratorRegistry 可加载且记录齐全，
//    知识点「可练」判定数据源 = GeneratorRegistry 声明的 knowledgePoints 并集。
try {
  const GenReg = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
  const recs = GenReg.all();
  check('GeneratorRegistry 可加载且 native Generator 记录 > 0', Array.isArray(recs) && recs.length > 0);
  const kpSet = {};
  recs.forEach(r => (r.knowledgePoints || []).forEach(kp => { kpSet[kp] = true; }));
  const sampled = ['math-g1-m1-addsub-10', 'math-g4-m1-g4-oral-big', 'math-g6-m1-g6-oral-neg-add-sub'];
  check('GeneratorRegistry 覆盖代表性知识点（G1/G4/G6 采样）',
    sampled.every(kp => !!kpSet[kp]));
} catch (e) {
  check('GeneratorRegistry 可加载（native 轨道冒烟）', false, e && e.message);
}

// 9.1 知识库覆盖基线（数学知识库各年级均有知识点数据，且模块 ID 与目录一致）
try {
  const KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
  const MC = require(path.join(ROOT, 'shared', 'module-catalog.js'));
  const validModules = new Set(MC.map(m => m.id));

  // 模块目录完整性：数学 M0-M13 + C1-C9 齐全、ID 唯一
  const compMods = MC.filter(m => m.level === 'competition');
  const compIds = compMods.map(m => m.id).sort();
  const expectComp = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const uniqueIds = new Set(MC.map(m => m.id));
  // 科目维度：subject 字段齐全且取值合法（M 仅 math）
  const subjectOk = MC.every(m => m.subject === 'math');
  check('MODULE_CATALOG 含全部模块（数学23+竞赛9）、科目字段齐全、ID 唯一',
    mathModsOk() && compMods.length === 9 &&
    JSON.stringify(compIds) === JSON.stringify(expectComp) &&
    uniqueIds.size === MC.length &&
    subjectOk);

  function mathModsOk() {
    const ids = new Set(MC.map(m => m.id));
    let ok = MC.filter(m => m.subject === 'math').length === 23;
    ['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13']
      .forEach(id => { if (!ids.has(id)) ok = false; });
    return ok;
  }

  // 知识库：结构正确（按科目分组对象 {math} + grade/modules/knowledgePoints），
  // 模块 knowledgePoints 允许为空数组；模块 ID 须存在于模块目录
  const kbGroups = KB && typeof KB === 'object' && !Array.isArray(KB)
    ? Object.keys(KB).filter(k => Array.isArray(KB[k])) : [];
  let kbFormatOk = kbGroups.length > 0;
  let kbRefOk = true;
  kbGroups.forEach(s => {
    KB[s].forEach(g => {
      if (!g || typeof g.grade !== 'number' || !Array.isArray(g.modules)) { kbFormatOk = false; return; }
      g.modules.forEach(m => {
        if (!m || !m.moduleId || !validModules.has(m.moduleId)) kbRefOk = false;
        if (!Array.isArray(m.knowledgePoints)) { kbFormatOk = false; return; }
      });
    });
  });
  check('知识库文件存在且结构正确（允许模块 knowledgePoints 为空数组）', kbFormatOk);
  check('知识库按科目分组为 {math}',
    kbGroups.includes('math'));
  check('知识库模块 ID 与模块目录一致', kbRefOk);

  // 9.2 各年级结构校验：M1-M12 必备模块全覆盖 + 无空模块。
  // 知识点可练性由 native GeneratorRegistry 覆盖门禁承接（check-core-generators：549/549）。
  const GRADE_CN = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };
  const EXPECT_M_IDS = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'];
  function checkGradeStructure(grade) {
    const cn = GRADE_CN[grade] || (grade + '年级');
    try {
      const g = KB.findGrade ? KB.findGrade('math', grade) : null;
      const mods = g && Array.isArray(g.modules) ? g.modules : [];
      const ids = mods.map(m => m.moduleId);
      const missingM = EXPECT_M_IDS.filter(id => ids.indexOf(id) === -1);
      const emptyMods = mods
        .filter(m => !Array.isArray(m.knowledgePoints) || m.knowledgePoints.length === 0)
        .map(m => m.moduleId);
      const detail = [
        g === null ? '知识库缺少该年级' : '',
        missingM.length ? '缺模块：' + missingM.join('、') : '',
        emptyMods.length ? '空模块：' + emptyMods.join('、') : ''
      ].filter(Boolean).join('；');
      check(cn + '知识库覆盖 M1-M12 全部模块且无空模块',
        g !== null && !missingM.length && !emptyMods.length, detail);
    } catch (e) {
      check(cn + '结构校验', false, e && e.message);
    }
  }
  [4, 5, 6].forEach(checkGradeStructure);
} catch (e) {
  check('模块目录/知识库一致性校验', false);
}

// 8.5 知识库结构校验（dev/verify-knowledge-bank.js 自动执行：模块ID、weight/type、高年级 M1-M12 专项）
try {
  execSync(`node ${path.join('dev', 'verify-knowledge-bank.js')} --g4 --g5 --g6`, { cwd: ROOT, stdio: 'pipe' });
  check('知识库结构校验通过（verify-knowledge-bank.js --g4 --g5 --g6）', true);
} catch {
  check('知识库结构校验通过（verify-knowledge-bank.js --g4 --g5 --g6）', false);
}

// 10.（MATH-14）全插件接口合规性检查已随 legacy 插件轨道删除；
//     native Generator 契约由 verify:m4（check-generator-contract / check-core-generators）承接。

// 11. 可选：检查 git 是否已初始化（表明仓库已就绪）
try {
  execSync('git status', { cwd: ROOT, stdio: 'ignore' });
  check('Git 仓库已初始化', true);
} catch {
  check('Git 仓库已初始化（可选）', false); // 不强制失败
}

// 输出结果
console.log('\n📋 项目搭建验证结果\n' + '='.repeat(40));
results.forEach((r) => {
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
console.log('- 难度系统与科目化工具已就绪（difficulty.js / subject-utils.js）');
console.log('- native Generator 轨道已就绪（GeneratorRegistry，契约由 verify:m4 承接）');
console.log('- 贡献指南与编码规范已文档化（技术文档--基础.md / 设计文档.md）');
console.log('- 防代码漂移的架构基础已具备，可持续迭代1-6年级全科目练习');
