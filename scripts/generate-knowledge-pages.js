#!/usr/bin/env node
/**
 * scripts/generate-knowledge-pages.js
 *
 * 读取 shared/knowledge-bank.js 与 shared/module-catalog.js，
 * 为每个「年级 × 模块 × 知识点」生成静态 HTML 页面，输出到 knowledge/ 目录。
 *
 * 产出：
 *   knowledge/index.html                          —— 全量索引（年级/模块/知识点链接）
 *   knowledge/g{grade}-{moduleId}.html            —— 模块聚合页（列出模块下所有知识点）
 *   knowledge/{newId}.html                        —— 单知识点页（文件名 = 知识点 id）
 *
 * 命名规则：详情页直接用知识点 id 作为文件名；模块页用 g{grade}-{moduleId}（moduleId 小写）。
 *
 * 运行（项目根目录）：
 *   node scripts/generate-knowledge-pages.js
 *
 * 知识点说明来源优先级：
 *   ① 知识点自身 description 字段
 *   ② 模块级 desc（module-catalog 中竞赛模块提供）
 *   ③ 均由知识库缺失时，回退为「仅展示名称 + 模块 + 练习入口」
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'knowledge');

// ---- 加载数据源 ----
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
const MODULE_CATALOG = require(path.join(ROOT, 'shared', 'module-catalog.js'));

const GRADE_NAMES = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };

/** 模块中文名（含年级级未登记时的兜底） */
function moduleName(moduleId) {
  const m = MODULE_CATALOG.byId ? MODULE_CATALOG.byId(moduleId) : null;
  return (m && m.name) || moduleId;
}
/** 模块级描述（竞赛模块提供） */
function moduleDesc(moduleId) {
  const m = MODULE_CATALOG.byId ? MODULE_CATALOG.byId(moduleId) : null;
  return (m && m.desc) || '';
}
/** 模块页文件名（新命名：g{grade}-{moduleId}，moduleId 小写） */
function modulePageFile(grade, moduleId) {
  return 'g' + grade + '-' + String(moduleId).toLowerCase() + '.html';
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** 知识点说明：优先 description，其次模块 desc，再其次合理回退文案 */
function pointDescription(grade, moduleId, kp) {
  if (kp.description) return kp.description;
  const mdesc = moduleDesc(moduleId);
  if (mdesc) return mdesc;
  return '「' + esc(kp.name) + '」是' + GRADE_NAMES[grade] + '数学' +
    esc(moduleName(moduleId)) + '模块下的核心知识点，建议结合练习巩固掌握。';
}

/** 知识点典型例题：优先 example 字段（知识库暂未大规模提供），缺省给出练习入口提示 */
function pointExample(kp) {
  if (kp.example) return kp.example;
  return '';
}

// ============ HTML 片段 ============

function baseHead(title, desc, canonFile) {
  const canon = canonFile
    ? `\n<link rel="canonical" href="https://home.modouyu.top/knowledge/${canonFile}">`
    : '';
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · Homework Help 知识库</title>
<meta name="description" content="${esc(desc)}">${canon}
<link rel="stylesheet" href="../shared/tokens.css">
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;color:#27324a;line-height:1.7;background:#fafbff;}
  .crumb{font-size:13px;color:#7a879c;margin-bottom:18px;}
  .crumb a{color:#3f6fd1;text-decoration:none;}
  h1{font-size:26px;margin:0 0 6px;}
  .meta{font-size:13px;color:#9aa5b5;margin-bottom:24px;}
  .card{background:#fff;border:1px solid #e6ecf7;border-radius:14px;padding:20px 22px;margin:16px 0;box-shadow:0 2px 8px rgba(63,111,209,.06);}
  .card h2{font-size:18px;margin:0 0 10px;color:#1f2a44;}
  .kw{display:inline-block;background:#eef3ff;color:#3f6fd1;border-radius:8px;padding:2px 10px;font-size:12px;margin:0 6px 6px 0;}
  .list{list-style:none;padding:0;margin:0;}
  .list li{padding:10px 12px;border-bottom:1px solid #eef1f7;}
  .list li:last-child{border-bottom:none;}
  .list a{color:#27324a;text-decoration:none;font-weight:600;}
  .list a:hover{color:#3f6fd1;}
  .list .sub{font-size:12px;color:#9aa5b5;font-weight:400;margin-left:8px;}
  .btn{display:inline-block;margin-top:14px;background:#3f6fd1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;}
  .btn.ghost{background:#eef3ff;color:#3f6fd1;}
  .note{font-size:13px;color:#9aa5b5;margin-top:8px;}
  footer{margin-top:40px;font-size:12px;color:#b3bccd;text-align:center;}
</style>
</head>
<body>`;
}

function baseFoot() {
  return `
<footer>Homework Help · 免费无广告小学 1-6 年级家庭作业生成器 · 纯前端</footer>
</body>
</html>`;
}

function crumb(parts) {
  return '<nav class="crumb">' + parts.join(' › ') + '</nav>';
}

// ============ 单知识点页 ============
function renderPointPage(grade, moduleId, kp, sName, canonFile) {
  const gName = GRADE_NAMES[grade];
  const mName = moduleName(moduleId);
  const subName = sName || '数学';
  const title = `${gName}${subName} · ${mName} · ${kp.name}`;
  const desc = `${gName}${subName}知识点「${kp.name}」说明、典型例题与在线练习入口，来自 Homework Help 人教版同步知识库。`;

  const ex = pointExample(kp);
  const exampleHtml = ex
    ? `<div class="card"><h2>典型例题</h2><p>${esc(ex)}</p></div>`
    : `<div class="card"><h2>典型例题</h2><p class="note">该知识点暂未内置例题，可前往练习页实时生成题目。</p></div>`;

  const practiceHref = `../practice.html?plugin=${esc(kp.pluginId)}&grade=${grade}`;

  return baseHead(title, desc, canonFile) +
    crumb([
      '<a href="index.html">知识库首页</a>',
      `<a href="${modulePageFile(grade, moduleId)}">${gName} · ${esc(mName)}</a>`,
      `<span>${esc(kp.name)}</span>`
    ]) +
    `<h1>${esc(kp.name)}</h1>` +
    `<div class="meta">${gName} · ${esc(mName)}（模块 ${esc(moduleId)}） · 知识点 ID：${esc(kp.id)}</div>` +
    `<div class="card"><h2>知识点说明</h2><p>${esc(pointDescription(grade, moduleId, kp))}</p>` +
      `<div>${kp.type ? `<span class="kw">子类型 ${esc(kp.type)}</span>` : ''}${kp.weight != null ? `<span class="kw">重要度权重 ${kp.weight}</span>` : ''}${kp.pluginId ? `<span class="kw">练习插件 ${esc(kp.pluginId)}</span>` : ''}</div>` +
    `</div>` +
    exampleHtml +
    (kp.pluginId
      ? `<div class="card"><h2>在线练习</h2><p>点击下方按钮，在 Homework Help 练习页实时生成「${esc(kp.name)}」相关题目，支持在线作答与即时批改。</p>` +
        `<a class="btn" href="${practiceHref}">去练习：${esc(kp.name)}</a>` +
        `<a class="btn ghost" href="${modulePageFile(grade, moduleId)}">返回模块：${esc(mName)}</a>` +
        `</div>`
      : `<div class="card"><h2>在线练习</h2><p class="note">该知识点的题型生成器正在开发中，敬请期待。</p></div>`) +
    baseFoot();
}

// ============ 模块聚合页 ============
function renderModulePage(grade, moduleId, module, sName) {
  const canonFile = modulePageFile(grade, moduleId);
  const gName = GRADE_NAMES[grade];
  const mName = moduleName(moduleId);
  const subName = sName || '数学';
  const title = `${gName}${subName} · ${mName}（模块 ${moduleId}）`;
  const desc = `${gName}${subName}「${mName}」模块包含的全部知识点列表与练习入口。`;

  let items = '';
  module.knowledgePoints.forEach((kp) => {
    const href = `${kp.id}.html`;
    items += `<li><a href="${href}">${esc(kp.name)}</a><span class="sub">${esc(moduleId)} · ${esc(kp.id)}</span></li>`;
  });

  return baseHead(title, desc, canonFile) +
    crumb([
      '<a href="index.html">知识库首页</a>',
      `<span>${gName} · ${esc(mName)}</span>`
    ]) +
    `<h1>${esc(mName)}</h1>` +
    `<div class="meta">${gName} · 模块 ${esc(moduleId)} · 共 ${module.knowledgePoints.length} 个知识点</div>` +
    (moduleDesc(moduleId) ? `<div class="card"><p>${esc(moduleDesc(moduleId))}</p></div>` : '') +
    `<div class="card"><h2>知识点列表</h2><ul class="list">${items}</ul></div>` +
    `<div class="card"><a class="btn" href="../math-types.html?grade=${grade}">前往 ${gName} 数学题型练习</a></div>` +
    baseFoot();
}

// ============ 全量索引页（按科目分节） ============
function renderIndex(gradesData, SUBJECT_NAMES) {
  const title = 'Homework Help 知识库索引';
  const desc = '小学 1-6 年级全部科目知识点索引，按科目、年级与模块组织，便于浏览与练习。';

  // 按科目分节（保持 math/cn/en 顺序；空科目自动不出现）
  const bySubject = new Map();
  gradesData.forEach((g) => {
    if (!bySubject.has(g.subject)) bySubject.set(g.subject, []);
    bySubject.get(g.subject).push(g);
  });

  let body = '';
  bySubject.forEach((gradeList, subject) => {
    const subName = (SUBJECT_NAMES && SUBJECT_NAMES[subject]) || subject;
    const totalKp = gradeList.reduce((s, g) => s + g.total, 0);
    body += `<h1 style="font-size:20px;margin:28px 0 4px;">${esc(subName)}知识库</h1>`;
    body += `<div class="meta">${gradeList.length} 个年级 · 共 ${totalKp} 个知识点</div>`;
    gradeList.forEach((g) => {
      const gName = GRADE_NAMES[g.grade];
      body += `<div class="card"><h2>${gName}（共 ${g.total} 个知识点）</h2>`;
      g.modules.forEach((m) => {
        const mName = moduleName(m.moduleId);
        const href = modulePageFile(g.grade, m.moduleId);
        body += `<p><a class="btn ghost" href="${href}" style="margin:4px 8px 4px 0;">${esc(mName)}（${m.knowledgePoints.length}）</a></p><ul class="list">`;
        m.knowledgePoints.forEach((kp) => {
          const phref = `${kp.id}.html`;
          body += `<li style="display:inline-block;width:auto;padding:4px 10px;border:none;"><a href="${phref}">${esc(kp.name)}</a></li>`;
        });
        body += `</ul>`;
      });
      body += `</div>`;
    });
  });
  const firstSub = gradesData.length ? (SUBJECT_NAMES && SUBJECT_NAMES[gradesData[0].subject]) || '数学' : '数学';

  return baseHead(title, desc, 'index.html') +
    crumb(['<span>知识库首页</span>']) +
    `<h1>${esc(firstSub)}知识库</h1>` +
    `<div class="meta">覆盖 ${bySubject.size} 个科目 · ${gradesData.length} 个年级 · 共 ${gradesData.reduce((s, g) => s + g.total, 0)} 个知识点</div>` +
    `<div class="card"><a class="btn" href="../index.html">返回 Homework Help 首页</a> <a class="btn ghost" href="../math-types.html">数学题型练习</a></div>` +
    body +
    baseFoot();
}

// ============ 主流程 ============
function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  // 任务3：知识库为按科目分组对象 {math,cn,en}；逐科目生成（科目名用于页面文案）
  const SUBJECT_NAMES = { math: '数学', cn: '语文', en: '英语' };
  const subjectKeys = Object.keys(KnowledgeBank).filter(k => Array.isArray(KnowledgeBank[k]));
  const gradesData = [];
  let pointCount = 0;
  let moduleCount = 0;

  subjectKeys.forEach((subject) => {
    const sName = SUBJECT_NAMES[subject] || subject;

    KnowledgeBank[subject].forEach((gradeObj) => {
      const grade = gradeObj.grade;
      const gradeEntry = { grade: grade, subject: subject, modules: [], total: 0 };

      (gradeObj.modules || []).forEach((module) => {
        const moduleId = module.moduleId;
        // 空模块（占位阶段，如语文/英语未激活模块）跳过页面产出
        if (!Array.isArray(module.knowledgePoints) || module.knowledgePoints.length === 0) return;
        moduleCount++;

        // ① 模块聚合页
        const modHtml = renderModulePage(grade, moduleId, module, sName);
        fs.writeFileSync(path.join(OUT_DIR, modulePageFile(grade, moduleId)), modHtml, 'utf8');

        // ② 单知识点页（文件名直接用知识点 id）
        (module.knowledgePoints || []).forEach((kp) => {
          const html = renderPointPage(grade, moduleId, kp, sName, kp.id + '.html');
          const filename = kp.id + '.html';
          fs.writeFileSync(path.join(OUT_DIR, filename), html, 'utf8');
          pointCount++;
          gradeEntry.total++;
        });

        gradeEntry.modules.push(module);
      });

      if (gradeEntry.modules.length) gradesData.push(gradeEntry);
    });
  });

  // ③ 全量索引页（按科目分节）
  const indexHtml = renderIndex(gradesData, SUBJECT_NAMES);
  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), indexHtml, 'utf8');

  console.log(`✅ 已生成知识库静态页面：`);
  console.log(`   - 知识点页：${pointCount} 个`);
  console.log(`   - 模块聚合页：${moduleCount} 个`);
  console.log(`   - 索引页：1 个（knowledge/index.html，按科目分节）`);
  console.log(`   输出目录：${OUT_DIR}`);
}

main();
