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

// 2.5 难度系统模块（v2）
check('shared/difficulty.js 存在', fileExists('shared/difficulty.js'));
check('difficulty.js 挂载 App.Difficulty', fileContains('shared/difficulty.js', 'App.Difficulty'));
check('difficulty.js 暴露 consume/createProfile/consumeProfile/difficultyToStructure',
  ['consume', 'createProfile', 'consumeProfile', 'difficultyToStructure'].every(function (k) {
    return fileContains('shared/difficulty.js', k);
  }));

// 2.6 科目化模块（任务12/13：工具归类 + 科目 SVG 生成器）
check('shared/subject-utils.js 存在', fileExists('shared/subject-utils.js'));
check('shared/svg-chinese.js 存在', fileExists('shared/svg-chinese.js'));
check('shared/svg-english.js 存在', fileExists('shared/svg-english.js'));
check('subject-utils 暴露 MathUtil/ChineseUtil/EnglishUtil',
  ['MathUtil', 'ChineseUtil', 'EnglishUtil'].every(function (k) {
    return fileContains('shared/subject-utils.js', k);
  }));
check('svg-chinese 挂载 SVGGenerators.cn（田字格/拼音四线格/笔顺/书写格）',
  ['SVGGenerators.cn', 'hanziGrid', 'pinyinGrid', 'strokeOrder', 'sentenceLine'].every(function (k) {
    return fileContains('shared/svg-chinese.js', k);
  }));
check('svg-english 挂载 SVGGenerators.en（字母书写/单词卡/句子抄写）',
  ['SVGGenerators.en', 'letterWriting', 'wordCard', 'fourLineWriting'].every(function (k) {
    return fileContains('shared/svg-english.js', k);
  }));
// 可加载性冒烟：require 后断言真实挂载（而非仅文本存在）
try {
  const su = require(path.join(ROOT, 'shared', 'subject-utils.js'));
  const okSU = !!(su.MathUtil && su.ChineseUtil && su.EnglishUtil
    && typeof su.MathUtil.rangeByLevel === 'function'
    && typeof su.ChineseUtil.normPY === 'function'
    && typeof su.EnglishUtil.normalizePhonetic === 'function');
  const dfy = require(path.join(ROOT, 'shared', 'difficulty.js'));
  const okD = !!(dfy.DifficultyProfiles && dfy.DifficultyProfiles.math && dfy.DifficultyProfiles.cn
    && dfy.DifficultyProfiles.en && dfy.paramsFor && dfy.profileFor && dfy.strategyFor);
  check('subject-utils/difficulty 可加载且暴露科目能力（Profiles×3 / paramsFor / strategyFor）', okSU && okD);
} catch (e) {
  check('subject-utils/difficulty 可加载且暴露科目能力', false, e && e.message);
}

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

// 6. 贡献指南（V4.0.1 起统一维护于 docs/DEVELOPMENT.md）
check('docs/DEVELOPMENT.md 存在', fileExists('docs/DEVELOPMENT.md'));
check('docs/DEVELOPMENT.md 提及禁止操作 DOM', fileContains('docs/DEVELOPMENT.md', '禁止操作 DOM'));

// 7. 插件注册表
check('plugins/registry.js 存在', fileExists('plugins/registry.js'));
check('registry.js 包含 PLUGIN_REGISTRY', fileContains('plugins/registry.js', 'PLUGIN_REGISTRY'));

// 7.1 题型目录页脚本依赖：math-types 仅渲染静态题型目录
//     （经 CatalogUtils/capability-resolver，不直接加载插件、不消费 App.Difficulty），
//     因此只要求引入其渲染所需的共享层。插件加载类页面（如 practice.html）另行以
//     各自 <script> 清单自证（历史事故：缺引导致插件接口误报，故此处仍做共享层完整性门禁）。
//     注：subject-types.html 已于「二级页/三级页合并」中改为转发桩（透传 query 到 practice.html），
//     不再承载题型渲染，故移出本清单，改用 7.2 的转发桩校验。
const DYNAMIC_TYPE_PAGES = ['math-types.html'];
const REQUIRED_SHARED = [
  'shared/common.js', 'shared/knowledge-bank.js', 'shared/module-catalog.js',
  'shared/capability-resolver.js', 'shared/catalog-utils.js'
];
DYNAMIC_TYPE_PAGES.forEach(page => {
  const missing = REQUIRED_SHARED.filter(s => !fileContains(page, `<script src="${s}"`));
  check(`${page} 引入全部共享层脚本（${REQUIRED_SHARED.length} 个）`, missing.length === 0,
    missing.length ? '缺少：' + missing.join('、') : '');
});

// 7.2 subject-types.html 合并为转发桩：仅原样透传 query 到 practice.html，
//     真正的选题/生成/预览/控制统一在 practice.html 完成（二级页与三级页合并）。
check('subject-types.html 为转发桩（重定向到 practice.html）',
  fileContains('subject-types.html', "location.replace('practice.html'"));

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

  // 模块目录完整性：数学 M0-M13 + C1-C9、语文 N1-N8、英语 E1-E6 齐全、ID 唯一
  const compMods = MC.filter(m => m.level === 'competition');
  const compIds = compMods.map(m => m.id).sort();
  const expectComp = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'];
  const uniqueIds = new Set(MC.map(m => m.id));
  // 科目维度：subject 字段齐全且取值合法；前缀与科目对应（M/C→math，N→cn，E→en）
  const SUBJECT_SET = new Set(['math', 'cn', 'en']);
  const subjectOk = MC.every(m => SUBJECT_SET.has(m.subject));
  const prefixOk = MC.every(m => {
    const p = m.id[0];
    if (p === 'N') return m.subject === 'cn';
    if (p === 'E') return m.subject === 'en';
    return m.subject === 'math'; // M/C 系列
  });
  const cnMods = MC.filter(m => m.subject === 'cn');
  const enMods = MC.filter(m => m.subject === 'en');
  check('MODULE_CATALOG 含全部模块（数学23+语文8+英语6）、科目字段齐全、ID 唯一',
    mathModsOk() && compMods.length === 9 &&
    JSON.stringify(compIds) === JSON.stringify(expectComp) &&
    uniqueIds.size === MC.length &&
    subjectOk && prefixOk && cnMods.length === 8 && enMods.length === 6);

  function mathModsOk() {
    const ids = new Set(MC.map(m => m.id));
    let ok = MC.filter(m => m.subject === 'math').length === 23;
    ['M0','M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12','M13']
      .forEach(id => { if (!ids.has(id)) ok = false; });
    return ok;
  }

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

  // 知识库：结构正确（按科目分组对象 {math,cn,en} + grade/modules/knowledgePoints），
  // 模块 knowledgePoints 允许为空数组；模块 ID 须存在，知识点 pluginId 须已注册
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
        m.knowledgePoints.forEach(kp => {
          // 无 pluginId 的占位条目（status='placeholder'，如 en-g3-e2-word-spelling）合法
          if (kp.pluginId != null && !reg.some(r => r.id === kp.pluginId)) kbRefOk = false;
        });
      });
    });
  });
  check('知识库文件存在且结构正确（允许模块 knowledgePoints 为空数组）', kbFormatOk);
  check('知识库按科目分组为 {math, cn, en}',
    kbGroups.includes('math') && kbGroups.includes('cn') && kbGroups.includes('en'));
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
      const g = KB.findGrade ? KB.findGrade('math', grade) : null;
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

// 10. 全插件接口合规性检查（沙箱逐个加载插件并实调 generate/render/check）
//     单一来源：dev/check-plugin-interfaces.js；此处只消费其 --report 输出与退出码。
try {
  const out = execSync('node dev/check-plugin-interfaces.js --report', { cwd: ROOT, stdio: 'pipe' }).toString();
  const m = out.match(/== 汇总：共 (\d+)，通过 (\d+)，失败 (\d+)/);
  const failed = m ? Number(m[3]) : -1;
  const failLines = out.split('\n').filter(l => l.startsWith('[FAIL]'));
  check(`全插件接口检查通过（generate/render/check 实调合规，${m ? m[2] : '?'}/${m ? m[1] : '?'}）`,
    failed === 0,
    failLines.length ? failLines.slice(0, 8).join('\n     ') : (failed === -1 ? '无法解析检查器输出' : ''));
} catch (e) {
  // 检查器发现失败时以非零码退出 → execSync 抛错，stdout 附着在 error.stdout
  const out = e && e.stdout ? e.stdout.toString() : '';
  const failLines = out.split('\n').filter(l => l.startsWith('[FAIL]'));
  check('全插件接口检查通过（generate/render/check 实调合规）', false,
    failLines.length
      ? failLines.slice(0, 8).join('\n     ')
      : `检查器异常：${(e && e.message) || '未知错误'}（可单独运行 node dev/check-plugin-interfaces.js 定位）`);
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
console.log('- 贡献指南与编码规范已文档化（docs/DEVELOPMENT.md）');
console.log('- 插件注册表骨架已创建（registry.js）');
console.log('- 后续新增题型只需：复制样板 → 实现方法 → 注册 → 验证');
console.log('- 防代码漂移的架构基础已具备，可持续迭代1-6年级全科目练习');
