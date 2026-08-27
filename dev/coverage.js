#!/usr/bin/env node
/**
 * dev/coverage.js — 知识点覆盖报告（终端）
 *
 * 基于 plugins/registry.js（实际存在的插件）与 shared/knowledge-bank.js（知识点基线），
 * 逐年级计算「已覆盖 X/Y 知识点，建议下一个开发 Z」；并在末尾输出
 * 【跨年级并集（union）】汇总：把某科目全部年级的知识点求并集，统计总体覆盖与缺失，
 * 按 pluginId 归组给出「建议优先开发哪些插件」。
 *
 * 所有年级/知识点均从 KnowledgeBank 数组动态读取（数据驱动），
 * 随 knowledge-bank.js 增加年级与知识点自动扩展，本脚本无需改动。
 *
 * 用法：
 *   node dev/coverage.js                # math 科目：各年级明细 + 跨年级并集
 *   node dev/coverage.js math           # 同上（指定科目）
 *   node dev/coverage.js math 3         # 仅输出 3 年级明细
 */
const path = require('path');
const ROOT = path.join(__dirname, '..');

const PluginUtil = require(path.join(ROOT, 'shared', 'common.js'));
const registry = require(path.join(ROOT, 'plugins', 'registry.js'));     // 数组
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

// 注入全局，供 reportCoverage 等读取（与浏览器环境对齐）
global.PluginUtil = PluginUtil;
global.KnowledgeBank = KnowledgeBank;
global.PLUGIN_REGISTRY = registry;

// 科目代号规范：注册表全称（chinese/english）↔ 知识库前缀（cn/en）
const SUBJECT_CANON = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };

// 跨年级并集：从 KnowledgeBank 对象动态读取某科目涉及的年级
// （数据驱动，随 knowledge-bank.js 增加年级/知识点自动扩展，无需改本脚本）
function gradesForSubject(subject) {
  const arr = KnowledgeBank[subject];
  if (!Array.isArray(arr)) return [];
  return arr.map(function (g) { return g.grade; })
    .sort(function (a, b) { return a - b; });
}

// 全局已注册插件 id 集合（跨年级并集；排除占位插件，占位不算真覆盖）
function allRegisteredIds(subject) {
  const cs = SUBJECT_CANON[subject] || subject;
  return new Set((registry || []).filter(function (p) {
    return (!subject || (SUBJECT_CANON[p.subject] || p.subject) === cs) && !p.isPlaceholder;
  }).map(function (p) { return p.id; }));
}

// ============ 逐年级明细 ============
function runPerGrade(subject, grades) {
  let hasData = false;
  grades.forEach(function (grade) {
    const cov = KnowledgeBank.coverageFromRegistry(subject, grade, registry);
    if (cov.total === 0) {
      console.log(`【${grade}年级·${subject}】无知识库基线数据，跳过`);
      return;
    }
    hasData = true;
    const next = cov.next
      ? `${cov.next.name}（建议开发插件：${cov.next.pluginId}）`
      : (cov.missing.length ? `缺失 ${cov.missing.length} 项均为占位（无插件归属），待对应插件落地` : '已全部覆盖 🎉');
    const miss = cov.missing.map(function (e) { return e.name; }).join('、') || '无';
    console.log(`\n【${grade}年级·${subject}】覆盖 ${cov.covered}/${cov.total}（${cov.ratio}%）`);
    console.log(`   缺失知识点：${miss}`);
    console.log(`   建议下一个开发：${next}`);
  });
  return hasData;
}

// ============ 跨年级并集（union）汇总 ============
function runUnion(subject) {
  const grades = gradesForSubject(subject);
  if (!grades.length) {
    console.log(`\n【${subject} 并集】无知识库基线数据，跳过`);
    return;
  }

  const ids = allRegisteredIds(subject);

  // 知识点并集：按 id 去重，记录每个 KP 出现在哪些年级
  const unionMap = new Map();
  grades.forEach(function (g) {
    KnowledgeBank.getEntries(subject, g).forEach(function (e) {
      if (!unionMap.has(e.id)) unionMap.set(e.id, { entry: e, grades: new Set() });
      unionMap.get(e.id).grades.add(g);
    });
  });

  const all = Array.from(unionMap.values());
  const covered = all.filter(function (x) { return ids.has(x.entry.pluginId); });
  const missing = all.filter(function (x) { return !ids.has(x.entry.pluginId); });
  const total = all.length;
  const coveredN = covered.length;
  const ratio = total ? Math.round(coveredN / total * 100) : 0;

  console.log(`\n【${subject} 跨年级并集（共 ${grades.length} 个年级：${grades.join('/')}年级）】`);
  console.log(`   知识点并集总数：${total}`);
  console.log(`   已覆盖（并集）：${coveredN}（${ratio}%）`);
  console.log(`   缺失（并集）：${missing.length}`);

  if (missing.length) {
    // 按 pluginId 归组：缺失的 KP 大多因对应插件尚未开发，给出「建议开发清单」；
    // 无 pluginId 的占位条目（如 en-g3-e2-word-spelling）单独提示，避免归组到 undefined
    const withPlugin = missing.filter(x => x.entry.pluginId);
    const placeholderOnly = missing.length - withPlugin.length;
    const byPlugin = {};
    withPlugin.forEach(function (x) {
      const pid = x.entry.pluginId;
      if (!byPlugin[pid]) byPlugin[pid] = { pluginId: pid, count: 0, points: [], grades: new Set() };
      byPlugin[pid].count++;
      byPlugin[pid].points.push(x.entry.name);
      x.grades.forEach(function (g) { byPlugin[pid].grades.add(g); });
    });
    const list = Object.keys(byPlugin).map(function (k) { return byPlugin[k]; })
      .sort(function (a, b) { return b.count - a.count; });
    if (list.length) {
      console.log('\n   建议优先开发的插件（按待覆盖知识点数排序）：');
      list.forEach(function (item) {
        const gspan = Array.from(item.grades).sort(function (a, b) { return a - b; }).join('/');
        console.log(`   • ${item.pluginId}  ——  ${item.count} 个知识点（涉及 ${gspan} 年级）：${item.points.join('、')}`);
      });
    }
    if (placeholderOnly > 0) {
      console.log(`\n   另有 ${placeholderOnly} 个占位知识点无插件归属（status='placeholder'），待对应模块开发后激活。`);
    }
  } else {
    console.log('   🎉 全部知识点均已有对应插件覆盖！');
  }
}

// ============ 主流程 ============
function run(subjectArg, gradeArg) {
  // 缺省输出全部已有基线的科目；cn/en 填充后自动纳入报告
  const subjects = subjectArg ? [subjectArg] : ['math', 'cn', 'en'];

  console.log('\n📊 知识点覆盖报告（数据源：plugins/registry.js + shared/knowledge-bank.js，数据驱动自动扩展）');
  console.log('='.repeat(62));

  subjects.forEach(function (subject) {
    if (gradeArg) {
      console.log(`\n——— ${subject} · ${gradeArg}年级 明细 ———`);
      runPerGrade(subject, [Number(gradeArg)]);
    } else {
      console.log(`\n——— ${subject} · 各年级明细 ———`);
      const hasData = runPerGrade(subject, gradesForSubject(subject));
      console.log('\n' + '-'.repeat(62));
      runUnion(subject);
      if (!hasData) {
        console.log('\n⚠️  无可统计的覆盖基线（请检查 shared/knowledge-bank.js）。');
      }
    }
  });

  console.log('\n' + '='.repeat(62));
  console.log('提示：浏览器控制台也可调用 PluginUtil.reportCoverage(\'math\', 年级) 查看实时覆盖。');
}

const arg1 = process.argv[2];
const arg2 = process.argv[3];
run(arg1, arg2);
