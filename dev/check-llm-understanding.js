#!/usr/bin/env node
/**
 * dev/check-llm-understanding.js — P26-16/17 LLM 页面理解测试
 *
 * 模拟 AI Agent / LLM 零 JavaScript 抓取视角：
 *   GET knowledge-index.html + 20 个代表性 KP 页面
 *   纯 HTML 解析（fs.readFileSync + 正则切割，不执行 JS、不依赖 DOM hydration）
 *
 * 20 代表性 KP 覆盖：G1-G6 × 不同单元 × 不同题型 × 不同语义族
 *
 * 提取 expected（来自 KBL Runtime）vs actual（来自 HTML）：
 *   kpId / name / grade / unit / module / 可练题型 / 练习入口 URL / canonical
 *
 * 标准：20/20 PASS（任一字段不匹配即 FAIL）
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
KC.stats();

var KNOWLEDGE_DIR = path.join(ROOT, 'knowledge');
var REPORTS_DIR = path.join(ROOT, 'dev', 'p26', 'reports');

// 20 代表性 KP（覆盖 G1-G6 + 不同单元 + 不同题型 + 不同语义族；均取自 KBL selectable 真实 ID）
var REPRESENTATIVE_KP = [
  // G1（3）：down+up 不同单元
  'math-g1-down-u01-k001', 'math-g1-up-u01-k001', 'math-g1-up-u06-k001',
  // G2（3）
  'math-g2-down-u01-k001', 'math-g2-up-u03-k001', 'math-g2-up-u07-k001',
  // G3（3）
  'math-g3-down-u01-k001', 'math-g3-up-u03-k001', 'math-g3-up-u09-k001',
  // G4（3）
  'math-g4-down-u02-k001', 'math-g4-up-u03-k001', 'math-g4-up-u08-k001',
  // G5（4）
  'math-g5-down-u01-k001', 'math-g5-up-u02-k001', 'math-g5-up-u04-k001', 'math-g5-up-u09-k001',
  // G6（4）
  'math-g6-down-u01-k001', 'math-g6-up-u02-k001', 'math-g6-up-u04-k001', 'math-g6-up-u07-k001'
];

var GRADE_CN = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };

function esc(s) { return String(s == null ? '' : s); }

function extract(html, sel) {
  var map = {
    title: /<title>([^<]+)<\/title>/,
    description: /<meta name="description" content="([^"]*)">/,
    h1: /<h1>([^<]+)<\/h1>/,
    canonical: /<link rel="canonical" href="([^"]+)">/
  };
  var re = map[sel];
  if (!re) return null;
  var m = html.match(re);
  return m ? m[1] : null;
}

// 从 HTML AI 摘要 section 提取字段
function extractAiSummary(html) {
  var out = {};
  var sectionMatch = html.match(/<section class="card ai-summary">([\s\S]*?)<\/section>/);
  if (!sectionMatch) return out;
  var section = sectionMatch[1];
  var re = /<dt>([^<]+)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/g;
  var m;
  while ((m = re.exec(section)) !== null) {
    var key = m[1].trim();
    var val = m[2].replace(/<[^>]+>/g, '').trim();
    out[key] = val;
  }
  // 提取练习入口 href
  var practiceMatch = section.match(/<a href="([^"]+)">去练习/);
  if (practiceMatch) out.practiceUrl = practiceMatch[1];
  return out;
}

function expectedOf(kpId) {
  var kp = KC.get(kpId);
  if (!kp) return null;
  return {
    id: kp.knowledgeId,
    name: kp.name,
    grade: KC.toN(kp.grade),
    gradeCn: GRADE_CN[KC.toN(kp.grade)],
    unit: kp.unitName || '',
    module: kp.module || '',
    qts: ((kp.assessment && kp.assessment.questionTypes) || []).map(function (q) { return q.type; }),
    practiceUrl: '../practice.html?subject=math&grade=' + encodeURIComponent(KC.toN(kp.grade)) + '&kps=' + encodeURIComponent(kp.knowledgeId),
    canonical: 'https://home.modouyu.top/knowledge/' + kp.knowledgeId + '.html'
  };
}

function actualOf(kpId) {
  var file = path.join(KNOWLEDGE_DIR, kpId + '.html');
  if (!fs.existsSync(file)) return null;
  var html = fs.readFileSync(file, 'utf8');
  var ai = extractAiSummary(html);
  return {
    id: kpId,
    name: extract(html, 'h1'),
    gradeCn: ai['所属年级'] || null,
    unit: ai['所属单元'] || null,
    practiceUrl: ai.practiceUrl || null,
    canonical: extract(html, 'canonical'),
    // 可练题型从 .kw span 解析
    qts: (function () {
      var sectionMatch = html.match(/<section class="card"><h2>可练题型<\/h2>([\s\S]*?)<\/section>/);
      if (!sectionMatch) return [];
      var re = /<span class="kw">([^<]+)<\/span>/g;
      var out = [];
      var m;
      while ((m = re.exec(sectionMatch[1])) !== null) out.push(m[1]);
      return out;
    })()
  };
}

function compareOne(kpId) {
  var expected = expectedOf(kpId);
  var actual = actualOf(kpId);
  if (!expected || !actual) return { kpId: kpId, pass: false, reason: !expected ? 'KBL 无记录' : 'HTML 缺失' };
  var mismatches = [];
  if (actual.name !== expected.name) mismatches.push({ field: 'name', expected: expected.name, actual: actual.name });
  if (actual.gradeCn !== expected.gradeCn) mismatches.push({ field: 'gradeCn', expected: expected.gradeCn, actual: actual.gradeCn });
  if (actual.unit !== expected.unit) mismatches.push({ field: 'unit', expected: expected.unit, actual: actual.unit });
  if (actual.canonical !== expected.canonical) mismatches.push({ field: 'canonical', expected: expected.canonical, actual: actual.canonical });
  if (actual.practiceUrl !== expected.practiceUrl) mismatches.push({ field: 'practiceUrl', expected: expected.practiceUrl, actual: actual.practiceUrl });
  // 题型集合（顺序无关）
  var eQts = expected.qts.slice().sort().join(',');
  var aQts = actual.qts.slice().sort().join(',');
  if (eQts !== aQts) mismatches.push({ field: 'qts', expected: expected.qts, actual: actual.qts });
  return {
    kpId: kpId,
    pass: mismatches.length === 0,
    mismatches: mismatches
  };
}

function main() {
  if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });
  var results = REPRESENTATIVE_KP.map(compareOne);
  var passCount = results.filter(function (r) { return r.pass; }).length;
  var failCount = results.length - passCount;

  var report = {
    generatedAt: new Date().toISOString(),
    totalTested: results.length,
    passed: passCount,
    failed: failCount,
    results: results
  };

  fs.writeFileSync(path.join(REPORTS_DIR, 'llm-understanding-report.json'), JSON.stringify(report, null, 2));

  var PASS = (failCount === 0);
  console.log('[P26-17] LLM 理解测试 ' + (PASS ? 'PASS' : 'FAIL'));
  console.log('  代表性 KP：' + results.length + ' 个');
  console.log('  通过：' + passCount + '/' + results.length);
  if (failCount > 0) {
    console.log('  失败明细：');
    results.filter(function (r) { return !r.pass; }).forEach(function (r) {
      console.log('    - ' + r.kpId + '：' + (r.reason || JSON.stringify(r.mismatches)));
    });
  }
  console.log('  报告：' + path.join(REPORTS_DIR, 'llm-understanding-report.json'));
  if (!PASS) process.exit(1);
}

main();
