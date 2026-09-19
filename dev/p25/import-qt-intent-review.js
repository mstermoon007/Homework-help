'use strict';

/**
 * dev/p25/import-qt-intent-review.js — P25-03 抽查裁决导入（人工回填 xlsx → 确认账本）
 *
 * 职责：读取人工修改后的 kbl/teaching/qt-intent-sample.xlsx「抽查行」sheet，
 * 清洗裁决列（兼容应用回存的拼音注音/空单元异常），生成确认账本
 * kbl/teaching/qt-intent-review.json；随后由 derive-qt-intent.js 在重推导时合并，
 * 使 confirmed 裁决在矩阵再生成中持久。
 *
 * 裁决口径：
 *   通过 → 账本 verdict=通过（ai-verified 与 needs-review 行均可；needs-review 行=人工接受其空问）
 *   打回 → 账本 verdict=打回（备注列写修正意见；本批备注为空则记空，由后续评审补充）
 *   空/其他 → 不入账本，保持原状态，汇总中列出
 *
 * 本脚本不直接修改 qt-intent.json（单一生成路径：derive-qt-intent.js + ledger 合并）。
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var TEACHING_DIR = path.join(ROOT, 'kbl', 'teaching');
var XLSX = require(path.join(ROOT, 'tools', 'kbl', 'xlsx.js'));

function assert(cond, msg) {
  if (!cond) { console.error('[P25-03] INVARIANT FAIL: ' + msg); process.exit(1); }
}

// ---------- 1. 读回抽查单（表头行可能已被应用吞掉：按 KP ID 形态识别数据行） ----------
var buf = fs.readFileSync(path.join(TEACHING_DIR, 'qt-intent-sample.xlsx'));
var sheet = XLSX.readXlsx(buf).sheets.filter(function (s) { return s.name === '抽查行'; })[0];
assert(sheet, '抽查行 sheet 不存在');
var KP_RE = /^math-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;
var dataRows = sheet.rows.filter(function (r) { return r && r[0] && KP_RE.test(String(r[0]).trim()); });
assert(dataRows.length > 0, '未识别到任何数据行');

// ---------- 2. 载入当前矩阵（校验裁决行存在性） ----------
var intent = JSON.parse(fs.readFileSync(path.join(TEACHING_DIR, 'qt-intent.json'), 'utf8'));
var rowSet = {};
intent.rows.forEach(function (r) { rowSet[r.knowledgeId + '|' + r.questionType] = r; });

// ---------- 3. 清洗裁决 ----------
var verdicts = {};
var stats = { 通过: 0, 打回: 0, empty: 0, invalid: [] };
var invalidSamples = [];
dataRows.forEach(function (r) {
  var kp = String(r[0]).trim();
  var qt = String(r[2] || '').trim();
  var st = String(r[3] || '').trim();
  var raw = String(r[10] || '').trim().replace(/<[^>]*>/g, '').trim();
  var note = String(r[11] || '').trim().replace(/<[^>]*>/g, '').trim();
  var key = kp + '|' + qt;
  assert(rowSet[key], '抽查行不在意图矩阵中: ' + key);
  assert(rowSet[key].status === st, '行状态与矩阵不一致: ' + key + ' xlsx=' + st + ' json=' + rowSet[key].status);
  if (raw === '通过' || raw === '打回') {
    stats[raw]++;
    verdicts[key] = { verdict: raw, fromStatus: st, note: note };
  } else if (raw === '') {
    stats.empty++;
  } else {
    stats.invalid.push(key + '←' + JSON.stringify(raw));
    invalidSamples.push(key);
  }
});

// ---------- 4. 写账本 ----------
var ledger = {
  schemaVersion: '1.0.0',
  purpose: 'P25-03 人工抽查裁决账本。derive-qt-intent.js 重推导时合并：通过→confirmed；打回→保留原状态并记录 humanReview.rejected',
  batch: 'sample-1',
  sourceFile: 'kbl/teaching/qt-intent-sample.xlsx',
  reviewedBy: '项目所有者（人工抽查）',
  reviewedAt: new Date().toISOString().slice(0, 10),
  counts: { sampled: dataRows.length, confirmed: stats['通过'], rejected: stats['打回'], unprocessed: stats.empty + stats.invalid.length },
  sampledKeys: dataRows.map(function (r) { return String(r[0]).trim() + '|' + String(r[2] || '').trim(); }),
  unprocessedInvalid: stats.invalid,
  verdicts: verdicts
};
fs.writeFileSync(path.join(TEACHING_DIR, 'qt-intent-review.json'), JSON.stringify(ledger, null, 2) + '\n');

console.log('[P25-03] 抽查裁决导入完成');
console.log('  抽样 ' + dataRows.length + ' 行：通过=' + stats['通过'] + ' 打回=' + stats['打回'] + ' 未填=' + stats.empty + ' 无效=' + stats.invalid.length);
if (stats.invalid.length) console.log('  无效值（保留原状态，请人工复核）: ' + stats.invalid.join(', '));
console.log('  账本：kbl/teaching/qt-intent-review.json（下一步重跑 derive-qt-intent.js 合并进矩阵）');
