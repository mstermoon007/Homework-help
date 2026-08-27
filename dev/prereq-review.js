#!/usr/bin/env node
/**
 * dev/prereq-review.js — 同年级前置依赖人工审查报告（建议每月/每季度运行）
 *
 * 背景：verify-knowledge-bank 对「同年级前置依赖」仅给警告（当前约 200 条），
 * 无法自动判定教学顺序是否合理，需人工抽查。本脚本把全部同年级前置
 * 导出为 CSV，按风险排序，便于批量审查。
 *
 * 风险分级：
 *   HIGH   前置知识点难度 > 当前知识点难度（疑似顺序颠倒）
 *   MEDIUM 前置为 placeholder 而当前已是 active（先学后出题不一致）
 *   LOW    其余（默认合理，抽样即可）
 *
 * 用法：node dev/prereq-review.js [--out docs/reports/prereq-review-YYYYMMDD.csv]
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var KB = require(path.join(ROOT, 'shared/knowledge-bank.js'));

// 任务3：知识库为按科目分组对象；扁平化为带 subject 的年级条目数组
var entries = [];
Object.keys(KB).forEach(function (s) {
  if (!Array.isArray(KB[s])) return;
  KB[s].forEach(function (e) { e.subject = s; entries.push(e); });
});

// ============ 收集 ============
var rows = [];
entries.forEach(function (gradeEntry) {
  var grade = gradeEntry.grade;
  gradeEntry.modules.forEach(function (mod) {
    (mod.knowledgePoints || []).forEach(function (p) {
      (p.prerequisites || []).forEach(function (preId) {
        // 仅同年级前置（跨年级前置由校验器保证方向合法，无需审查）
        var pre = null, preGrade = null;
        entries.forEach(function (g2) {
          g2.modules.forEach(function (m2) {
            (m2.knowledgePoints || []).forEach(function (p2) {
              if (p2.id === preId) { pre = p2; preGrade = g2.grade; }
            });
          });
        });
        if (!pre || preGrade !== grade) return;
        var diffInv = typeof p.difficulty === 'number' && typeof pre.difficulty === 'number' && pre.difficulty > p.difficulty;
        var statusMismatch = p.status === 'active' && pre.status === 'placeholder';
        var risk = diffInv ? 'HIGH' : (statusMismatch ? 'MEDIUM' : 'LOW');
        rows.push({
          grade: grade,
          module: mod.moduleId,
          pointId: p.id,
          pointName: p.name,
          pointDifficulty: p.difficulty,
          pointStatus: p.status,
          prereqId: preId,
          prereqName: pre.name,
          prereqDifficulty: pre.difficulty,
          prereqStatus: pre.status,
          sameModule: preId.split('-')[1] === mod.moduleId.toLowerCase() ? 'Y' : 'N',
          risk: risk
        });
      });
    });
  });
});

// 排序：风险 > 年级 > 模块
var rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
rows.sort(function (a, b) {
  return rank[a.risk] - rank[b.risk] || a.grade - b.grade ||
    (a.module < b.module ? -1 : a.module > b.module ? 1 : 0);
});

// ============ 输出 CSV ============
var today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
var outArgIdx = process.argv.indexOf('--out');
var outFile = outArgIdx >= 0 ? process.argv[outArgIdx + 1]
  : path.join(ROOT, 'docs', 'reports', 'prereq-review-' + today + '.csv');

function csvEsc(v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
var header = ['risk', 'grade', 'module', 'pointId', 'pointName', 'pointDifficulty', 'pointStatus',
  'prereqId', 'prereqName', 'prereqDifficulty', 'prereqStatus', 'sameModule'];
var lines = [header.join(',')].concat(rows.map(function (r) {
  return header.map(function (h) { return csvEsc(r[h]); }).join(',');
}));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, '\ufeff' + lines.join('\n'), 'utf8'); // BOM 便于 Excel 打开

var high = rows.filter(function (r) { return r.risk === 'HIGH'; }).length;
var mid = rows.filter(function (r) { return r.risk === 'MEDIUM'; }).length;
console.log('同年级前置依赖共 ' + rows.length + ' 条：HIGH(难度倒挂) ' + high + ' 条 / MEDIUM(状态错位) ' + mid + ' 条 / LOW ' + (rows.length - high - mid) + ' 条');
rows.filter(function (r) { return r.risk === 'HIGH'; }).slice(0, 10).forEach(function (r) {
  console.log('  [HIGH] 年级' + r.grade + ' ' + r.pointId + '(难' + r.pointDifficulty + ') ← ' + r.prereqId + '(难' + r.prereqDifficulty + ')');
});
console.log('报告已写入: ' + outFile);
