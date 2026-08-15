#!/usr/bin/env node
/**
 * dev/verify-knowledge-bank.js — 知识库结构验证（全年级）
 *
 * 自动执行静态检查：
 *   1. 知识库为数组，每个条目含 grade + modules（数组）
 *   2. 每个 moduleId 均存在于 shared/module-catalog.js 的 MODULE_CATALOG
 *   3. 每个 knowledgePoint 的 pluginId 均在 plugins/registry.js 注册
 *   4. 每个知识点含 weight / type 字段（抽题配比与定向生成所需）
 *   5. 四年级 M1-M12 全覆盖、无空模块（专项校验）
 *   6. 占位插件已标记 isPlaceholder
 *
 * 用法：
 *   node dev/verify-knowledge-bank.js          # 全年级校验
 *   node dev/verify-knowledge-bank.js 5        # 仅校验某年级
 *   node dev/verify-knowledge-bank.js --g4     # 高年级专项（M1-M12 覆盖，可叠加 --g4 --g5）
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const catalog = require(path.join(ROOT, 'shared', 'module-catalog.js'));
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));

const validModuleIds = new Set(catalog.map(m => m.id));
const registeredPluginIds = new Set(registry.map(p => p.id));
const errors = [];
const warnings = [];

// 参数解析
const args = process.argv.slice(2);
const gradeOnly = args.find(a => /^\d+$/.test(a)) ? Number(args.find(a => /^\d+$/.test(a))) : null;
const gFlags = args.filter(a => /^--g\d+$/.test(a)).map(a => Number(a.replace(/^--g/, '')));

const G_MODULES = ['M1','M2','M3','M4','M5','M6','M7','M8','M9','M10','M11','M12'];

bank.forEach(entry => {
  if (gradeOnly && entry.grade !== gradeOnly) return;
  const g = entry.grade;

  // 1. 结构
  if (typeof g !== 'number') errors.push(`(年级${g}) grade 必须为数字`);
  if (!Array.isArray(entry.modules) || !entry.modules.length) {
    errors.push(`(年级${g}) modules 必须为非空数组`);
    return;
  }

  entry.modules.forEach(mod => {
    // 2. 模块 ID
    if (!validModuleIds.has(mod.moduleId)) {
      errors.push(`(年级${g}) 无效模块ID: ${mod.moduleId}`);
    }
    // 3. knowledgePoints 为数组（允许空数组，占位阶段）
    if (!Array.isArray(mod.knowledgePoints)) {
      errors.push(`(年级${g}/${mod.moduleId}) knowledgePoints 必须为数组`);
      return;
    }
    // 4. 知识点引用 + weight/type
    mod.knowledgePoints.forEach(kp => {
      if (kp.pluginId && !registeredPluginIds.has(kp.pluginId)) {
        errors.push(`(年级${g}/${mod.moduleId}) 无效插件ID: ${kp.pluginId}（知识点 ${kp.name}）`);
      }
      if (kp.weight == null) warnings.push(`(年级${g}/${mod.moduleId}) 知识点 ${kp.name} 缺 weight`);
      if (kp.type == null) warnings.push(`(年级${g}/${mod.moduleId}) 知识点 ${kp.name} 缺 type`);
    });
  });
});

// 5. 高年级专项校验（--g4/--g5 等：M1-M12 全覆盖、无空模块）
const specialGrades = (gradeOnly >= 4) ? [gradeOnly] : gFlags;
specialGrades.forEach(grade => {
  const entry = bank.find(e => e.grade === grade);
  if (!entry) {
    errors.push(`(年级${grade}) 不存在该年级知识库条目`);
  } else {
    const got = entry.modules.map(m => m.moduleId);
    const missing = G_MODULES.filter(id => got.indexOf(id) === -1);
    if (missing.length) errors.push(`(年级${grade}) 缺失模块: ${missing.join('、')}`);
    const empty = entry.modules.filter(m => !Array.isArray(m.knowledgePoints) || m.knowledgePoints.length === 0);
    if (empty.length) errors.push(`(年级${grade}) 空模块: ${empty.map(m => m.moduleId).join('、')}`);
  }
});

// 6. 占位插件标记（所有 isPlaceholder 条目应在 registry 中有对应）
registry.filter(r => r.isPlaceholder).forEach(r => {
  if (!r.moduleIds || !Array.isArray(r.moduleIds) || !r.moduleIds.length) {
    warnings.push(`占位插件 ${r.id} 未声明 moduleIds`);
  }
});

// 输出
console.log('\n📋 知识库结构验证结果\n' + '='.repeat(40));
console.log(`校验范围：${gradeOnly ? `年级 ${gradeOnly}` : '全年级'}${specialGrades.length ? `（含 ${specialGrades.join('/')} 年级 M1-M12 专项）` : ''}`);
console.log(`知识库条目数：${bank.length} 个年级`);
bank.forEach(e => {
  const n = e.modules.reduce((s, m) => s + (m.knowledgePoints || []).length, 0);
  console.log(`  · 年级 ${e.grade}：${e.modules.length} 模块 / ${n} 知识点`);
});

if (warnings.length) {
  console.log('\n⚠️  警告：');
  warnings.forEach(w => console.log(' - ' + w));
}
if (errors.length) {
  console.log('\n❌ 知识库验证失败：');
  errors.forEach(e => console.log(' - ' + e));
  console.log('\n请修复后重试。');
  process.exit(1);
}
console.log('\n✅ 知识库验证通过：所有模块ID和插件ID均有效，结构与引用无错误。');
