#!/usr/bin/env node
/**
 * dev/verify-knowledge-bank.js — 知识库结构验证（全年级）
 *
 * 自动执行静态检查：
 *   1. 知识库为数组，每个条目含 grade + modules（数组）
 *   2. 每个 moduleId 均存在于 shared/module-catalog.js 的 MODULE_CATALOG
 *   3. 每个 knowledgePoint 的 pluginId 均在 plugins/registry.js 注册
 *      且被引用插件的注册 grades 包含该年级（拦截跨年级无效引用）
 *   4. 每个知识点含 weight / type 字段（抽题配比与定向生成所需）
 *      非占位插件指向占位插件时给出警告
 *   5. 四年级 M1-M12 全覆盖、无空模块（专项校验）
 *   6. 占位插件已标记 isPlaceholder
 *
 * 用法：
 *   node dev/verify-knowledge-bank.js          # 全年级校验
 *   node dev/verify-knowledge-bank.js 5        # 仅校验某年级
 *   node dev/verify-knowledge-bank.js --g4     # 高年级专项（M1-M12 覆盖，可叠加 --g4 --g5）
 */
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const catalog = require(path.join(ROOT, 'shared', 'module-catalog.js'));
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));

const validModuleIds = new Set(catalog.map(m => m.id));
const registryEntries = new Map(registry.map(p => [p.id, p]));
const registeredPluginIds = new Set(registry.map(p => p.id));
const errors = [];
const warnings = [];
const warnPlaceholder = []; // 分类：仍指向占位插件

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
      } else if (kp.pluginId) {
        // 年级匹配：被引用插件的注册 grades 必须包含该年级（未声明 grades 视为全年级适用）
        const rec = registryEntries.get(kp.pluginId);
        if (rec && Array.isArray(rec.grades) && !rec.grades.includes(g)) {
          errors.push(`(年级${g}/${mod.moduleId}) 知识点 ${kp.name} 引用插件 ${kp.pluginId}，但其注册年级为 [${rec.grades}]，不含年级 ${g}`);
        }
        // 真实插件兜底：非占位插件应能被综合练习抽到（占位插件由覆盖率统计另行排除）
        if (rec && rec.isPlaceholder) {
          warnPlaceholder.push(`(年级${g}/${mod.moduleId}) 知识点 ${kp.name} 仍指向占位插件 ${kp.pluginId}`);
        }
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

// ============ 7. 编号体系校验 ============
// ID 格式：g{grade}-{m0-m12|c1-c9}-{base}（moduleId 小写；注意 M10/M11/M12）
const ID_RE = /^g[1-6]-(m(?:[0-9]|1[0-2])|c[1-9])-([a-z0-9-]+)$/;
const allIds = new Set();
const idGrade = new Map();
bank.forEach(e => {
  e.modules.forEach(mod => {
    (mod.knowledgePoints || []).forEach(kp => { allIds.add(kp.id); idGrade.set(kp.id, e.grade); });
  });
});
const seenIds = new Set();
const sameGradePre = [];

bank.forEach(entry => {
  if (gradeOnly && entry.grade !== gradeOnly) return;
  const g = entry.grade;
  (entry.modules || []).forEach(mod => {
    (mod.knowledgePoints || []).forEach(kp => {
      const loc = `(年级${g}/${mod.moduleId}/${kp.id})`;

      // 7.1 ID 格式 + 年级/模块段一致
      const m = ID_RE.exec(kp.id);
      if (!m) {
        errors.push(`${loc} ID 格式不符（应 ^g[1-6]-(m0-m12|c1-c9)-[a-z0-9-]+$）: ${kp.id}`);
      } else {
        if (kp.id.indexOf('g' + g + '-') !== 0) errors.push(`${loc} ID 年级段与所在年级不符: ${kp.id}`);
        if (kp.id.indexOf('-' + mod.moduleId.toLowerCase() + '-') === -1) errors.push(`${loc} ID 模块段与所在模块不符: ${kp.id}`);
      }

      // 7.2 全局唯一
      if (seenIds.has(kp.id)) errors.push(`${loc} ID 全局重复: ${kp.id}`);
      seenIds.add(kp.id);

      // 7.3 prerequisites / related 引用存在 + 前置年级
      (Array.isArray(kp.prerequisites) ? kp.prerequisites : []).forEach(ref => {
        if (!allIds.has(ref)) { errors.push(`${loc} prerequisites 引用不存在: ${ref}`); return; }
        const rg = idGrade.get(ref);
        if (rg > g) errors.push(`${loc} prerequisites 指向更高年级: ${ref}（年级 ${rg}）`);
        else if (rg === g) sameGradePre.push(kp.id + ' -> ' + ref);
      });
      (Array.isArray(kp.related) ? kp.related : []).forEach(ref => {
        if (!allIds.has(ref)) errors.push(`${loc} related 引用不存在: ${ref}`);
      });

      // 7.4 竞赛模块 difficulty 非空
      if (/^C/i.test(mod.moduleId) && (kp.difficulty == null || !Number.isFinite(kp.difficulty))) {
        errors.push(`${loc} 竞赛知识点缺少 difficulty`);
      }

      // 7.5 status 与插件占位状态一致
      if (kp.pluginId && registeredPluginIds.has(kp.pluginId)) {
        const rec = registryEntries.get(kp.pluginId);
        const isPH = !!(rec && rec.isPlaceholder);
        const want = isPH ? 'placeholder' : 'active';
        if (kp.status !== want) errors.push(`${loc} status=${kp.status} 与插件(${isPH ? '占位' : '正常'})不符，应为 ${want}`);
      } else if (kp.status !== 'active' && kp.status !== 'placeholder') {
        errors.push(`${loc} status 非法值: ${kp.status}`);
      }
    });
  });
});

// 7.6 竞赛模块同 base slug 跨年级难度不降
const cByBase = {};
bank.forEach(e => {
  (e.modules || []).forEach(mod => {
    if (!/^C/i.test(mod.moduleId)) return;
    (mod.knowledgePoints || []).forEach(kp => {
      const mm = ID_RE.exec(kp.id);
      const base = mm ? mm[2] : kp.id;
      (cByBase[base] = cByBase[base] || []).push({ g: e.grade, d: kp.difficulty });
    });
  });
});
Object.keys(cByBase).forEach(base => {
  const arr = cByBase[base].sort((a, b) => a.g - b.g);
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1].g !== arr[i].g && arr[i].d < arr[i - 1].d) {
      errors.push(`竞赛知识点 ${base} 跨年级难度下降: g${arr[i - 1].g}=${arr[i - 1].d} → g${arr[i].g}=${arr[i].d}`);
    }
  }
});

// 7.7 status 与模块状态一致：active 知识点所在模块（该年级）不得为 placeholder
bank.forEach(e => {
  const g = e.grade;
  (e.modules || []).forEach(mod => {
    if (!/^C/i.test(mod.moduleId)) return;
    const cat = validModuleIds.has(mod.moduleId) ? catalog.find(m => m.id === mod.moduleId) : null;
    if (!cat || !cat.gradeStatus || !cat.gradeStatus[g]) return;
    (mod.knowledgePoints || []).forEach(kp => {
      if (kp.status === 'active' && cat.gradeStatus[g] === 'placeholder') {
        errors.push(`(年级${g}/${mod.moduleId}/${kp.id}) status=active 但模块 ${mod.moduleId} 该年级标记为 placeholder，status 与模块状态不一致`);
      }
    });
  });
});

// 同年级前置单独计数：仅警告、不阻断，供定期人工复核
const warnSameGradePre = sameGradePre.length;

// 7.7 详情页文件对应：每个 {id}.html 存在，且无多余 HTML 文件
const KNOW_DIR = path.join(ROOT, 'knowledge');
if (fs.existsSync(KNOW_DIR)) {
  const moduleFiles = new Set();
  bank.forEach(e => (e.modules || []).forEach(mod => moduleFiles.add('g' + e.grade + '-' + mod.moduleId.toLowerCase() + '.html')));
  allIds.forEach(id => {
    if (!fs.existsSync(path.join(KNOW_DIR, id + '.html'))) errors.push(`缺少详情页: knowledge/${id}.html`);
  });
  fs.readdirSync(KNOW_DIR).filter(f => f.endsWith('.html')).forEach(f => {
    if (f === 'index.html') return;
    if (moduleFiles.has(f)) return;
    if (allIds.has(f.replace(/\.html$/, ''))) return;
    errors.push(`多余 HTML 文件: knowledge/${f}`);
  });
}

// 输出
console.log('\n📋 知识库结构验证结果\n' + '='.repeat(40));
console.log(`校验范围：${gradeOnly ? `年级 ${gradeOnly}` : '全年级'}${specialGrades.length ? `（含 ${specialGrades.join('/')} 年级 M1-M12 专项）` : ''}`);
console.log(`知识库条目数：${bank.length} 个年级`);
bank.forEach(e => {
  const n = e.modules.reduce((s, m) => s + (m.knowledgePoints || []).length, 0);
  console.log(`  · 年级 ${e.grade}：${e.modules.length} 模块 / ${n} 知识点`);
});

if (warnPlaceholder.length || warnSameGradePre > 0 || warnings.length) {
  console.log('\n⚠️  警告（按类别）：');
  if (warnPlaceholder.length) {
    console.log(' [占位插件] 以下知识点仍指向占位插件，尚未实现：');
    warnPlaceholder.forEach(w => console.log('  - ' + w));
  }
  if (warnSameGradePre > 0) {
    console.log(` [同年级前置依赖] 同年级前置依赖 ${warnSameGradePre} 条，请确认是否符合教学顺序。`);
  }
  if (warnings.length) {
    console.log(' [其他]');
    warnings.forEach(w => console.log('  - ' + w));
  }
}
if (errors.length) {
  console.log('\n❌ 知识库验证失败：');
  errors.forEach(e => console.log(' - ' + e));
  console.log('\n请修复后重试。');
  process.exit(1);
}
console.log('\n✅ 知识库验证通过：所有模块ID和插件ID均有效，结构与引用无错误。');
