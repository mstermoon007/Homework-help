#!/usr/bin/env node
/**
 * dev/build-knowledge-pages.js — 知识内容页 canonical 重建（P9-10 G1-E）
 *
 * 数据源：KBL Runtime（经 KnowledgeContext；唯一事实源）。
 * 产物：
 *   knowledge/{canonicalId}.html   —— 仅 selectable KP（status/publication 门禁通过）
 *   knowledge/knowledge-index.html —— 按年级/单元分组的索引
 *   <!-- kbgen:hash=... -->        —— 确定性内容哈希（增量比对 / check-knowledge-dir 门禁）
 * 剪除：带 kbgen 标记但已无对应 canonical KP 的旧页（legacy ID 页 / 模块页）全部删除。
 *
 * 约束：非 selectable KP 不生成空壳页（登记于 docs/pol-kbl-phase9-governance.md）；
 *       页面 CTA 统一 practice.html?kps={canonicalId}；不读取旧 KnowledgeBank。
 *
 * 用法：node dev/build-knowledge-pages.js [--check]
 */
'use strict';

var fs = require('fs');
var path = require('path');
var crypto = require('crypto');
var ROOT = path.join(__dirname, '..');
var OUT_DIR = path.join(ROOT, 'knowledge');
var KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));

var HASH_RE = /<!--\s*kbgen:hash=([0-9a-f]{64})\s*-->/;

// 构建工具直连 Runtime 读取关系（页面构建面；业务转换仍在 KnowledgeContext）
function runtime() { KC.stats(); return global.App.KNOWLEDGE; }
var GRADE_CN = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };
var BOOK_CN = { down: '上册', up: '下册' }; // P26-21 SEO：消歧同学期复习 KP 标题
var TEMPLATE_VERSION = 3; // P26-21：3 → 标题含学期消歧 + 描述前缀 KP 名 + cleanText 去 MathML
var BASE_URL = 'https://home.modouyu.top';
var SAME_UNIT_LINK_CAP = 8; // P26-09：同单元相关 KP 最多取 8 个

var CSS = 'body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;max-width:860px;margin:0 auto;padding:32px 20px;color:#27324a;line-height:1.7;background:#fafbff;}'
  + '.crumb{font-size:13px;color:#7a879c;margin-bottom:18px;}.crumb a{color:#3f6fd1;text-decoration:none;}'
  + 'h1{font-size:26px;margin:0 0 6px;}.meta{font-size:13px;color:#9aa5b5;margin-bottom:24px;}'
  + '.card{background:#fff;border:1px solid #e6ecf7;border-radius:14px;padding:20px 22px;margin:16px 0;box-shadow:0 2px 8px rgba(63,111,209,.06);}'
  + '.card h2{font-size:18px;margin:0 0 10px;color:#1f2a44;}'
  + '.kw{display:inline-block;background:#eef3ff;color:#3f6fd1;border-radius:8px;padding:2px 10px;font-size:12px;margin:0 6px 6px 0;}'
  + '.list{list-style:none;padding:0;margin:0;}.list li{padding:10px 12px;border-bottom:1px solid #eef1f7;}.list li:last-child{border-bottom:none;}'
  + '.list a{color:#27324a;text-decoration:none;font-weight:600;}.list a:hover{color:#3f6fd1;}.list .sub{font-size:12px;color:#9aa5b5;font-weight:400;margin-left:8px;}'
  + '.btn{display:inline-block;margin-top:14px;background:#3f6fd1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;}'
  + '.btn.ghost{background:#eef3ff;color:#3f6fd1;}footer{margin-top:40px;font-size:12px;color:#b3bccd;text-align:center;}';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
// P26-21 SEO：剔除 KBL 描述中残留的 Office MathML 标记（<r>/<rPr> 等），避免被关键词堆砌门禁误判
function cleanText(s) {
  return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}
function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }

function kpView(kp) {
  return {
    id: kp.knowledgeId,
    name: kp.name,
    grade: KC.toN(kp.grade),
    book: kp.book,
    unitName: kp.unitName,
    module: kp.module,
    type: kp.type,
    category: kp.semantic && kp.semantic.category,
    family: kp.semantic && kp.semantic.family,
    concept: kp.semantic && kp.semantic.concept,
    operations: (kp.semantic && kp.semantic.operations) || [],
    description: kp.content && kp.content.description,
    example: kp.content && kp.content.example,
    graphicType: kp.content && kp.content.graphicType,
    qts: ((kp.assessment && kp.assessment.questionTypes) || []).map(function (q) { return q.type; }),
    seed: kp.difficultyAnnotation && kp.difficultyAnnotation.seedDifficulty,
    cog: kp.difficultyAnnotation && kp.difficultyAnnotation.cognitiveLevel,
    weight: kp.weight
  };
}

function relLink(kpId) {
  var kp = KC.get(kpId);
  return '<a href="' + esc(kpId) + '.html">' + esc(kp ? kp.name : kpId) + '</a>';
}

function pageHtml(kp, relations, sameUnitKps) {
  var v = kpView(kp);
  var g = v.grade;
  var bookLabel = BOOK_CN[v.book] || '';
  // P26-21 SEO：标题含学期（上册/下册）消歧复习 KP；描述以 KP 名前缀消歧同 concept 的 KP
  var title = GRADE_CN[g] + '数学' + (bookLabel ? '（' + bookLabel + '）' : '') + ' · ' + (v.unitName || '') + ' · ' + v.name + ' · Homework Help 知识库';
  var conceptClean = cleanText(v.concept || v.description || '');
  var desc = v.name + '：' + (conceptClean || v.name) + '——' + GRADE_CN[g] + '数学知识点说明、典型例题与在线练习入口。';
  var kpUrl = BASE_URL + '/knowledge/' + v.id + '.html';
  var kws = [];
  if (v.category) kws.push('领域 ' + v.category);
  if (v.family) kws.push('语义族 ' + v.family);
  if (v.type) kws.push('子类型 ' + v.type);
  if (v.seed != null) kws.push('标注难度 ' + v.seed);
  if (v.cog) kws.push('认知 ' + v.cog);
  if (v.weight != null) kws.push('权重 ' + v.weight);

  // P26-07：Schema.org LearningResource JSON-LD（红线：不含 author/rating/review/aggregateRating）
  var learningResource = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: v.name,
    description: desc,
    educationalLevel: GRADE_CN[g] + (bookLabel ? '（' + bookLabel + '）' : ''),
    learningResourceType: 'KnowledgePoint',
    about: ['数学', v.category || v.family || '数学'].filter(function (s, i, a) { return a.indexOf(s) === i; }),
    isPartOf: { '@type': 'Course', name: GRADE_CN[g] + '数学 · ' + (v.unitName || '') },
    inLanguage: 'zh-CN',
    url: kpUrl
  };
  // P26-08：BreadcrumbList JSON-LD（与可见面包屑一致）
  var breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '数学', item: BASE_URL + '/knowledge/knowledge-index.html' },
      { '@type': 'ListItem', position: 2, name: GRADE_CN[g], item: BASE_URL + '/knowledge/knowledge-index.html#g' + g },
      { '@type': 'ListItem', position: 3, name: v.unitName || '' },
      { '@type': 'ListItem', position: 4, name: v.name }
    ]
  };
  var jsonLd = '<script type="application/ld+json">\n'
    + JSON.stringify(learningResource, null, 2) + '\n</script>\n'
    + '<script type="application/ld+json">\n'
    + JSON.stringify(breadcrumb, null, 2) + '\n</script>\n';

  // P26-04 语义化：div.card → section.card；包 <main><article>
  var cards = '';
  // P26-13 AI 摘要 section
  var practiceUrl = '../practice.html?subject=math&grade=' + encodeURIComponent(g) + '&kps=' + encodeURIComponent(v.id);
  cards += '<section class="card ai-summary"><h2>知识点摘要</h2><dl>'
    + '<dt>知识点</dt><dd>' + esc(v.name) + '</dd>'
    + '<dt>所属年级</dt><dd>' + GRADE_CN[g] + '</dd>'
    + '<dt>所属单元</dt><dd>' + esc(v.unitName || '') + '</dd>'
    + '<dt>学习内容</dt><dd>' + esc(conceptClean) + '</dd>'
    + '<dt>练习入口</dt><dd><a href="' + practiceUrl + '">去练习：' + esc(v.name) + '</a></dd>'
    + '</dl></section>';
  cards += '<section class="card"><h2>知识点说明</h2><p>' + esc(conceptClean) + '</p>'
    + (kws.length ? '<div>' + kws.map(function (k) { return '<span class="kw">' + esc(k) + '</span>'; }).join('') + '</div>' : '') + '</section>';
  if (v.example) {
    cards += '<section class="card"><h2>典型例题</h2><p>' + esc(cleanText(v.example)) + '</p></section>';
  }
  if (v.qts.length) {
    cards += '<section class="card"><h2>可练题型</h2><div>' + v.qts.map(function (q) { return '<span class="kw">' + esc(q) + '</span>'; }).join('') + '</div></section>';
  }
  // P26-09：同单元相关 KP 链接（不读 KBL.relations，由 grade+unitName 字段派生）
  if (sameUnitKps && sameUnitKps.length) {
    cards += '<section class="card"><h2>同单元知识点</h2><ul class="list">' + sameUnitKps.map(function (id) {
      var other = KC.get(id);
      return '<li><a href="' + esc(id) + '.html">' + esc(other ? other.name : id) + '</a></li>';
    }).join('') + '</ul></section>';
  }
  if (relations.prereq.length || relations.successor.length) {
    var relHtml = '';
    if (relations.prereq.length) relHtml += '<li>前置：' + relations.prereq.map(relLink).join('、') + '</li>';
    if (relations.successor.length) relHtml += '<li>后续：' + relations.successor.map(relLink).join('、') + '</li>';
    cards += '<section class="card"><h2>相关知识点</h2><ul class="list">' + relHtml + '</ul></section>';
  }
  cards += '<section class="card"><h2>在线练习</h2><p>点击下方按钮，在 Homework Help 练习页实时生成「' + esc(v.name) + '」相关题目，支持在线作答与即时批改。</p>'
    + '<a class="btn" href="' + practiceUrl + '">去练习：' + esc(v.name) + '</a>'
    + '<a class="btn ghost" href="knowledge-index.html">返回知识库首页</a></section>';

  var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>' + esc(title) + '</title>\n'
    + '<meta name="description" content="' + esc(desc) + '">\n'
    + '<link rel="canonical" href="' + esc(kpUrl) + '">\n'
    // P26-06：Open Graph meta
    + '<meta property="og:title" content="' + esc(title) + '">\n'
    + '<meta property="og:description" content="' + esc(desc) + '">\n'
    + '<meta property="og:url" content="' + esc(kpUrl) + '">\n'
    + '<meta property="og:type" content="article">\n'
    + '<meta property="og:site_name" content="Homework Help">\n'
    + '<meta property="og:locale" content="zh_CN">\n'
    + '<link rel="stylesheet" href="../shared/styles/tokens.css">\n<style>' + CSS + '</style>\n'
    + jsonLd
    + '</head>\n<body>'
    + '<nav class="crumb"><a href="knowledge-index.html">知识库首页</a> › <a href="knowledge-index.html#' + esc('g' + g) + '">' + GRADE_CN[g] + '</a> › <span>' + esc(v.name) + '</span></nav>'
    + '<main><article>'
    + '<h1>' + esc(v.name) + '</h1>'
    + '<div class="meta">' + GRADE_CN[g] + ' · ' + esc(v.unitName || '') + '（模块 ' + esc(v.module || '') + '） · 知识点 ID：' + esc(v.id) + '</div>'
    + cards
    + '</article></main>'
    + '<footer>Homework Help · 免费无广告小学 1-6 年级家庭作业生成器 · 纯前端</footer>\n</body>\n</html>';
  var hash = sha256(JSON.stringify({ v: TEMPLATE_VERSION, kp: v, rel: relations, sameUnit: sameUnitKps || [] }));
  return html + '\n<!-- kbgen:hash=' + hash + ' -->\n';
}

function indexHtml(byGrade, total) {
  var sections = '';
  Object.keys(byGrade).sort().forEach(function (g) {
    var kps = byGrade[g];
    if (!kps.length) return;
    sections += '<h2 id="' + esc('g' + g) + '" style="font-size:20px;margin:28px 0 4px;">' + GRADE_CN[g] + '数学（' + kps.length + ' 个知识点）</h2>';
    var byUnit = {};
    kps.forEach(function (kp) { (byUnit[kp.unitName || '其他'] = byUnit[kp.unitName || '其他'] || []).push(kp); });
    Object.keys(byUnit).forEach(function (unit) {
      sections += '<section class="card"><h2 style="font-size:16px;">' + esc(unit) + '</h2><ul class="list" style="display:flex;flex-wrap:wrap;gap:0;">';
      byUnit[unit].forEach(function (kp) {
        sections += '<li style="display:inline-block;width:auto;padding:4px 10px;border:none;"><a href="' + esc(kp.knowledgeId) + '.html">' + esc(kp.name) + '</a>'
          + (kp.type ? '<span class="sub">' + esc(kp.type) + '</span>' : '') + '</li>';
      });
      sections += '</ul></section>';
    });
  });
  var indexUrl = BASE_URL + '/knowledge/knowledge-index.html';
  var html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
    + '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
    + '<title>Homework Help 知识库索引 · 小学数学 1-6 年级</title>\n'
    + '<meta name="description" content="小学数学 1-6 年级知识点索引，按年级与单元组织，支持跳转在线练习。">\n'
    + '<link rel="canonical" href="' + esc(indexUrl) + '">\n'
    + '<meta property="og:title" content="Homework Help 知识库索引 · 小学数学 1-6 年级">\n'
    + '<meta property="og:description" content="小学数学 1-6 年级知识点索引，按年级与单元组织，支持跳转在线练习。">\n'
    + '<meta property="og:url" content="' + esc(indexUrl) + '">\n'
    + '<meta property="og:type" content="website">\n'
    + '<meta property="og:site_name" content="Homework Help">\n'
    + '<meta property="og:locale" content="zh_CN">\n'
    + '<link rel="stylesheet" href="../shared/styles/tokens.css">\n<style>' + CSS + '</style>\n</head>\n<body>'
    + '<nav class="crumb"><span>知识库首页</span></nav>'
    + '<main><article><h1>小学数学知识库</h1>'
    + '<div class="meta">覆盖 1–6 年级 · 共 ' + total + ' 个可练知识点</div>'
    + '<section class="card"><a class="btn" href="../index.html">返回 Homework Help 首页</a> <a class="btn ghost" href="../select.html">去选择练习</a></section>'
    + sections
    + '</article></main>'
    + '<footer>Homework Help · 免费无广告小学 1-6 年级家庭作业生成器 · 纯前端</footer>\n</body>\n</html>';
  var hash = sha256(JSON.stringify({ v: TEMPLATE_VERSION, ids: Object.keys(byGrade).sort().map(function (g) { return byGrade[g].map(function (k) { return k.knowledgeId; }); }) }));
  return html + '\n<!-- kbgen:hash=' + hash + ' -->\n';
}

// P26-11：knowledge-index.json（KBL 派生只读索引；非第二知识库，每次 build 重生）
function indexJson(byGrade, total) {
  var kps = [];
  Object.keys(byGrade).sort().forEach(function (g) {
    byGrade[g].forEach(function (kp) {
      kps.push({
        id: kp.knowledgeId,
        name: kp.name,
        grade: KC.toN(kp.grade),
        unit: kp.unitName || '',
        module: kp.module || '',
        url: BASE_URL + '/knowledge/' + kp.knowledgeId + '.html',
        status: 'published'
      });
    });
  });
  return JSON.stringify({
    version: '5.0.0',
    subject: 'math',
    generatedAt: new Date().toISOString(),
    total: total,
    knowledgePoints: kps
  }, null, 2);
}

function main() {
  var checkOnly = process.argv.indexOf('--check') !== -1;
  var byGrade = {};
  var selectableIds = {};
  var total = 0;
  [1, 2, 3, 4, 5, 6].forEach(function (g) {
    var list = KC.selectable({ grade: g });
    byGrade[g] = list;
    total += list.length;
    list.forEach(function (kp) { selectableIds[kp.knowledgeId] = true; });
  });

  // P26-09：按 grade+unitName 派生同单元 KP 映射（不读 KBL.relations）
  var sameUnitMap = {};
  Object.keys(byGrade).forEach(function (g) {
    byGrade[g].forEach(function (kp) {
      var key = g + '|' + (kp.unitName || '');
      (sameUnitMap[key] = sameUnitMap[key] || []).push(kp.knowledgeId);
    });
  });

  var written = 0, pruned = 0;
  if (!checkOnly) {
    Object.keys(byGrade).forEach(function (g) {
      byGrade[g].forEach(function (kp) {
        var rel = runtime().relationsFor(kp.knowledgeId) || { outgoing: [], incoming: [] };
        var prereq = (rel.outgoing || []).filter(function (r) { return r.type === 'prerequisite'; }).map(function (r) { return r.to || r.toId || r.knowledgeId; }).filter(Boolean);
        var successor = (rel.incoming || []).filter(function (r) { return r.type === 'prerequisite'; }).map(function (r) { return r.from || r.fromId || r.knowledgeId; }).filter(Boolean);
        // P26-09：同单元其他 KP（排除自身，最多 8 个）
        var sameKey = g + '|' + (kp.unitName || '');
        var sameUnitKps = (sameUnitMap[sameKey] || []).filter(function (id) { return id !== kp.knowledgeId; }).slice(0, SAME_UNIT_LINK_CAP);
        var html = pageHtml(kp, { prereq: prereq, successor: successor }, sameUnitKps);
        var file = path.join(OUT_DIR, kp.knowledgeId + '.html');
        var existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        var m = existing.match(HASH_RE);
        var newHash = (html.match(HASH_RE) || [])[1];
        if (!m || m[1] !== newHash) { fs.writeFileSync(file, html, 'utf8'); written++; }
      });
    });
    fs.writeFileSync(path.join(OUT_DIR, 'knowledge-index.html'), indexHtml(byGrade, total), 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'knowledge-index.json'), indexJson(byGrade, total), 'utf8');

    // 剪除：带 kbgen 标记但不在本次产物集合的旧页（legacy ID 页 / 模块页）
    fs.readdirSync(OUT_DIR).forEach(function (name) {
      if (!/\.html$/.test(name)) return;
      var full = path.join(OUT_DIR, name);
      var base = name.replace(/\.html$/, '');
      if (base === 'knowledge-index') return;
      if (selectableIds[base]) return;
      var content = fs.readFileSync(full, 'utf8');
      if (HASH_RE.test(content)) { fs.unlinkSync(full); pruned++; }
    });
  }

  console.log('知识页构建：selectable KP=' + total + '，写入/更新 ' + written + '，剪除旧页 ' + pruned);
  if (checkOnly) console.log('（--check 模式：仅统计，不写盘）');
}

main();
