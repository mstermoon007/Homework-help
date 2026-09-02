#!/usr/bin/env node
/**
 * scripts/new-plugin.js — Homework Help 插件脚手架
 *
 * 用法：
 *   node scripts/new-plugin.js <id> <name> <grades> [选项]
 *
 * 位置参数：
 *   <id>      插件唯一标识，建议 <subject>-<topic>（如 math-fraction / chinese-idiom）
 *   <name>    展示名称（面向学生与家长，如「分数的初步认识」）
 *   <grades>  适用年级，逗号或空格分隔（如 1,2,3）
 *
 * 选项：
 *   --subject <math|chinese|english>   科目（缺省按 id 前缀推断，否则 math）
 *   --category <number|geometry|statistics|mixed>  数学领域（仅 math）
 *   --desc <文本>                       一句话描述
 *   --deps <a.js,b.js>                  前置依赖脚本（如中文拼音 pinyin-bank.js）
 *   --kp <id1,id2>                      声明覆盖的知识点 id（对应 knowledge-bank 条目）
 *   --module <Mx>                       知识点所属模块 ID（M0-M12，如 M8 解决问题）
 *   --no-kb                             不写入知识库（跳过覆盖统计登记）
 *   --dry-run                           仅打印将要生成的内容，不写盘
 *   --help                              显示帮助
 *
 * 交互：默认非交互，缺省项用推断值/默认值；仅加 --interactive（或 TTY 下缺省必填项）才进入终端引导。
 *
 * 产物：
 *   1) plugins/<id>.js            插件骨架（基于 createPlugin 工厂，开发者只填 generateQuestions）
 *   2) plugins/registry.js        追加一条注册表记录
 *   3) shared/knowledge-bank.js   数学插件：在指定年级的指定模块（--module）下追加知识点条目
 */
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'plugins', 'registry.js');
const KB = path.join(ROOT, 'shared', 'knowledge-bank.js');
const PLUGINS_DIR = path.join(ROOT, 'plugins');

// ============ 工具 ============
function ask(rl, q, def) {
  return new Promise((resolve) => {
    const hint = def ? ' (' + def + ')' : '';
    rl.question(q + hint + ': ', (a) => resolve((a || '').trim() || def || ''));
  });
}
function askBool(rl, q, def) {
  return ask(rl, q + ' (y/n)', def ? 'y' : 'n').then((a) => /^y|是|yes$/i.test(a || ''));
}
function parseGrades(str) {
  if (Array.isArray(str)) return str;
  return String(str)
    .split(/[,\s]+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => n >= 1 && n <= 6);
}
function loadRegistry() {
  try { delete require.cache[require.resolve(REGISTRY)]; } catch (e) {}
  return require(REGISTRY);
}
function inferSubject(id) {
  if (id.indexOf('math-') === 0) return 'math';
  if (id.indexOf('chinese-') === 0) return 'chinese';
  if (id.indexOf('english-') === 0) return 'english';
  return 'math';
}

// ============ 代码生成 ============
function generateSkeleton(cfg) {
  const { id, name, subject, grades, category, desc, knowledgePoints, moduleId } = cfg;
  const gradeArr = JSON.stringify(grades);
  const kpArr =
    knowledgePoints && knowledgePoints.length
      ? JSON.stringify(knowledgePoints)
      : '[ /* 对应 knowledge-bank 条目 id，可选 */ ]';
  const catLiteral = subject === 'math' ? `'${category}'` : 'null';
  // 数学插件必须声明归属模块（verify-setup 9.1 从插件源文件强校验 moduleId 且须存在于模块目录）
  const moduleLine = subject === 'math'
    ? (moduleId ? `moduleId: '${moduleId}',\n` : `// TODO: 声明模块归属 moduleId（如 'M8'），取值见 shared/module-catalog.js\n`)
    : '';
  return `// plugins/${id}.js
// ${name} —— 科目：${subject}，适用年级：${grades.join('/')}
// 生成逻辑见 generateQuestions；generate/render/check 由 shared/common.js 的
// PluginUtil.createPlugin 工厂自动生成（详见 plugins/CONTRACT.md 第七节）。
(function (global) {
  'use strict';
  var PU = global.PluginUtil;
  if (!PU || !PU.createPlugin) {
    throw new Error('plugins/${id}.js 依赖 shared/common.js（PluginUtil.createPlugin），请先加载');
  }

  // 知识点声明：对应 shared/knowledge-bank.js 中该年级的条目 id（用于开发期覆盖校验，可选）
  // knowledgePoints: ['<知识点id>']

  function generateQuestions(opts) {
    var grade = opts.grade || ${grades[0]};
    var count = opts.count || 10;
    var questions = [];
    // TODO: 根据题目领域实现生成逻辑，每题至少包含 answer；render 可省略（工厂用 PU.renderCard 兜底）
    for (var i = 0; i < count; i++) {
      var a = PU.randInt(1, 10);
      var b = PU.randInt(1, 10);
      questions.push({
        q: a + ' + ' + b + ' = ?',
        answer: String(a + b)
        // 如需定制卡片样式，可加：render: function (idx) { return PluginUtil.renderCard(this, idx); }
      });
    }
    return questions;
  }

  var plugin = PU.createPlugin({
    id: '${id}',
    name: '${name}',
    subject: '${subject}',
    grades: ${gradeArr},
    category: ${catLiteral},
    ${moduleLine}    description: '${desc}',
    knowledgePoints: ${kpArr},
    generateQuestions: generateQuestions
  });

  global.__currentPlugin = plugin;
  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;
})(typeof window !== 'undefined' ? window : globalThis);
`;
}

function registryEntry(cfg) {
  const { id, name, subject, grades, category, desc, deps } = cfg;
  const gradeArr = JSON.stringify(grades);
  const catLiteral = subject === 'math' ? `'${category}'` : 'null';
  const depLiteral = deps && deps.length ? `, deps: ${JSON.stringify(deps)}` : '';
  return `{ id: '${id}', file: 'plugins/${id}.js', name: '${name}', subject: '${subject}', category: ${catLiteral}, grades: ${gradeArr}${depLiteral} }`;
}

function kbKnowledgeEntry(cfg, kp, weight) {
  const { id } = cfg;
  const w = weight || 2;
  return `            { id: '${kp}', name: '${kp}', pluginId: '${id}', weight: ${w} }`;
}

// ============ 文本插入 ============
function insertBefore(text, anchor, insertion) {
  const idx = text.indexOf(anchor);
  if (idx === -1) throw new Error('未找到插入锚点：' + anchor);
  return text.slice(0, idx) + insertion + text.slice(idx);
}
// 新结构插入：在指定年级的指定模块（moduleId）下追加一条知识点
function appendKnowledgePoint(text, grade, moduleId, entryBlock) {
  const gIdx = text.indexOf('      grade: ' + grade + ',');
  if (gIdx === -1) throw new Error('knowledge-bank.js 中未找到 grade: ' + grade);
  const mIdx = text.indexOf("          moduleId: '" + moduleId + "',", gIdx);
  if (mIdx === -1) throw new Error('grade ' + grade + ' 中未找到模块 ' + moduleId + '（请确认 knowledge-bank.js 中该年级存在该模块）');
  const kIdx = text.indexOf('          knowledgePoints: [', mIdx);
  if (kIdx === -1) throw new Error('模块 ' + moduleId + ' 未找到 knowledgePoints 数组');
  const cIdx = text.indexOf('\n          ]', kIdx);
  if (cIdx === -1) throw new Error('模块 ' + moduleId + ' knowledgePoints 数组未闭合');
  const body = text.slice(kIdx + '          knowledgePoints: ['.length, cIdx);
  const isEmpty = body.trim().length === 0;
  return text.slice(0, cIdx) + (isEmpty ? '\n' : ',\n') + entryBlock + text.slice(cIdx);
}

// 注册表插入：在锚点前插入新条目，并给锚点前一行（数组元素）补逗号。
// 因为锚点前那行此前是数组最后一个元素（可省略逗号），插入新元素后它就不再是最后，必须补逗号。
function insertRegistryEntry(text, anchor, entry) {
  const idx = text.indexOf(anchor);
  if (idx === -1) throw new Error('未找到插入锚点：' + anchor);
  const before = text.slice(0, idx);
  const after = text.slice(idx);
  const lines = before.split('\n');
  // 从末尾找第一个非空、非注释行，若缺逗号则补（元素行形如 { … } 或 { … },）
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith('//')) continue;
    if (!t.endsWith(',') && !t.endsWith('[') && !t.endsWith(']')) {
      lines[i] = lines[i].replace(/\s+$/, '') + ',';
    }
    break;
  }
  return lines.join('\n') + '    ' + entry + ',\n' + after;
}

// ============ 主流程 ============
async function main() {
  const args = process.argv.slice(2);
  if (args.indexOf('--help') !== -1) {
    console.log([
      '用法：node scripts/new-plugin.js <id> <name> <grades> [选项]',
      '  <id>      插件标识，建议 <subject>-<topic>',
      '  <name>    展示名称',
      '  <grades>  适用年级，如 1,2,3',
      '  选项：--subject --category --desc --deps --kp --no-kb --dry-run --interactive/-i --help',
      '  交互：默认非交互，缺省项用推断/默认值（如科目按 id 前缀）。',
      '        仅当加 --interactive（或 TTY 下缺省必填项）才进入终端引导。',
      '  --dry-run 仅预览不写盘。'
    ].join('\n'));
    return;
  }
  const dryRun = args.indexOf('--dry-run') !== -1;
  const noKb = args.indexOf('--no-kb') !== -1;
  const getFlag = (name) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
  };

  // 已知需要带值的选项：解析时将其值从位置参数中排除，避免污染 id/name/grades
  const FLAG_WITH_VAL = { '--subject': 1, '--category': 1, '--desc': 1, '--deps': 1, '--kp': 1, '--module': 1, '--weight': 1 };
  const skipIdx = new Set();
  args.forEach((a, i) => {
    if (FLAG_WITH_VAL[a] && args[i + 1] && !args[i + 1].startsWith('--')) skipIdx.add(i + 1);
  });
  const positional = args.filter((a, i) => !a.startsWith('--') && !skipIdx.has(i));

  const id = positional[0] || null;
  const name = positional[1] || null;
  const gradesStr = positional[2] || null;
  const subject = getFlag('--subject');
  const category = getFlag('--category');
  const desc = getFlag('--desc');
  const depsRaw = getFlag('--deps');
  const kpRaw = getFlag('--kp');
  const moduleId = getFlag('--module');
  const weightRaw = getFlag('--weight');

  // 交互模式：仅在显式 --interactive，或 TTY 且缺省必填项时进入。
  // 否则（即使 isTTY 为真但只是管道/CI 环境）全程不阻塞终端，直接用默认值。
  const isTTY = !!process.stdin.isTTY;
  const wantsInteractive = args.indexOf('--interactive') !== -1 || args.indexOf('-i') !== -1;
  const needsInteractive = wantsInteractive || (isTTY && !id);
  const rl = (isTTY && needsInteractive) ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null;

  // ---- 收集参数（缺省则交互/默认） ----
  let cfgId = id;
  if (!cfgId) {
    if (!rl) { console.error('缺少插件 ID（非交互环境请通过参数提供，或加 --interactive 在终端引导）'); process.exit(1); }
    cfgId = await ask(rl, '插件 ID（如 math-fraction，建议 <subject>-<topic>）');
  }
  if (!/^[a-z][a-z0-9-]+$/.test(cfgId)) {
    console.error('ID 不合法：需以小写字母开头，仅含小写字母/数字/连字符');
    process.exit(1);
  }

  const registry = loadRegistry();
  if (registry.some((r) => r.id === cfgId)) {
    console.error('ID 已存在：' + cfgId + '（请更换）');
    process.exit(1);
  }

  let cfgName = name || (rl ? await ask(rl, '展示名称', cfgId) : cfgId);
  let cfgGrades = parseGrades(gradesStr);
  if (!cfgGrades.length) {
    if (!rl) { console.error('缺少适用年级'); process.exit(1); }
    cfgGrades = parseGrades(await ask(rl, '适用年级（如 1,2,3）', '1'));
  }
  if (!cfgGrades.length) { console.error('年级解析失败'); process.exit(1); }

  let cfgSubject = subject || inferSubject(cfgId);
  if (rl && !subject) {
    const s = await ask(rl, '科目 (math/chinese/english)', cfgSubject);
    if (['math', 'chinese', 'english'].indexOf(s) !== -1) cfgSubject = s;
  }
  if (['math', 'chinese', 'english'].indexOf(cfgSubject) === -1) cfgSubject = 'math';

  let cfgCategory = category || 'number';
  if (cfgSubject === 'math' && rl && !category) {
    cfgCategory = await ask(rl, '数学领域 (number/geometry/statistics/mixed)', 'number');
  }
  if (cfgSubject !== 'math') cfgCategory = null;

  let cfgDesc = desc || (rl ? await ask(rl, '一句话描述', cfgName) : cfgName);

  let cfgDeps = depsRaw ? depsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (cfgSubject !== 'math' && rl && !depsRaw) {
    const need = await askBool(rl, '是否需要拼音词库(pinyin-bank.js)作为依赖', cfgSubject === 'chinese');
    if (need && cfgDeps.indexOf('pinyin-bank.js') === -1) cfgDeps.push('pinyin-bank.js');
  }

  let knowledgePoints = kpRaw ? kpRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  if (cfgSubject === 'math' && rl && !kpRaw) {
    const kpStr = await ask(rl, '声明覆盖的知识点 id（逗号分隔，可空）', '');
    knowledgePoints = kpStr ? kpStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
  }

  const cfg = {
    id: cfgId, name: cfgName, subject: cfgSubject, grades: cfgGrades,
    category: cfgCategory, desc: cfgDesc, deps: cfgDeps, knowledgePoints,
    moduleId, weight: weightRaw ? parseInt(weightRaw, 10) : null
  };

  // 数学科目写知识库时必须提供模块 ID（知识点需归属到题型模块）
  if (cfgSubject === 'math' && !noKb && cfgGrades.length && knowledgePoints.length && !moduleId) {
    console.error('数学插件写知识库需指定 --module <Mx>（知识点要归属到题型模块，如 M8 解决问题）');
    process.exit(1);
  }

  // ---- 生成产物 ----
  const skeleton = generateSkeleton(cfg);
  const regEntry = registryEntry(cfg);
  const kbEntries = knowledgePoints.map((kp) => kbKnowledgeEntry(cfg, kp, cfg.weight));

  console.log('\n========== 将生成以下内容 ==========');
  console.log('【插件骨架】 plugins/' + cfgId + '.js');
  console.log('【注册表】 plugins/registry.js 追加：' + regEntry);
  if (cfgSubject === 'math' && !noKb) {
    cfgGrades.forEach((g) => {
      kbEntries.forEach((e) => console.log('【知识库 G' + g + ' · 模块 ' + cfg.moduleId + ' 知识点】\n' + e));
    });
  } else if (noKb) {
    console.log('【知识库】 已跳过（--no-kb）');
  } else {
    console.log('【知识库】 非数学科目，knowledge-bank 仅含数学，跳过');
  }

  if (dryRun) {
    console.log('\n[dry-run] 未写盘。骨架预览：\n');
    console.log(skeleton);
    if (rl) rl.close();
    return;
  }

  // ---- 写盘 ----
  fs.writeFileSync(path.join(PLUGINS_DIR, cfgId + '.js'), skeleton, 'utf8');

  // 注册表：锚点到「更多插件」注释前，并自动给前一条补逗号
  let regText = fs.readFileSync(REGISTRY, 'utf8');
  regText = insertRegistryEntry(regText, '    // ... 更多插件将在后续逐步添加', regEntry);
  fs.writeFileSync(REGISTRY, regText, 'utf8');

  // 知识库（仅数学）：按年级定位，在指定模块下追加知识点
  if (cfgSubject === 'math' && !noKb) {
    let kbText = fs.readFileSync(KB, 'utf8');
    cfgGrades.forEach((g) => {
      kbEntries.forEach((e) => {
        kbText = appendKnowledgePoint(kbText, g, cfg.moduleId, e);
      });
    });
    fs.writeFileSync(KB, kbText, 'utf8');
  }

  console.log('\n✅ 已完成：plugins/' + cfgId + '.js 已生成并注册。');
  console.log('   下一步：实现 generateQuestions 里的题目逻辑（可参考 docs/DEVELOPMENT.md §5.7 新增插件快速开始）。');
  console.log('   完成后运行 npm test / dev/plugin-check.html 校验，' +
    'dev/coverage.js 查看分科目覆盖。');
  if (rl) rl.close();
}

main().catch((e) => { console.error('失败：' + e.message); process.exit(1); });
