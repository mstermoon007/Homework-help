/**
 * tests/source/build-knowledge-pages-check.test.js — P41-B2
 *
 * 缺陷：dev/build-knowledge-pages.js --check 原仅打印计数并恒以退出码 0 结束，
 *   AI 边界门禁（check B）无法发现页面与 Runtime 数据漂移。
 *
 * 覆盖：真实仓库只读一致（正例）；缺失/内容漂移可被检出（负例）。
 * 全部用例只读，不写仓库文件（负例写系统临时目录）。
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '..', '..');
const KC = require(path.join(ROOT, 'shared', 'orchestration', 'knowledge-context.js'));
const BKP = require(path.join(ROOT, 'dev', 'build-knowledge-pages.js'));

function selectable() {
  const byGrade = {};
  const ids = {};
  let total = 0;
  [1, 2, 3, 4, 5, 6].forEach((g) => {
    const list = KC.selectable({ grade: g });
    byGrade[g] = list;
    total += list.length;
    list.forEach((kp) => { ids[kp.knowledgeId] = true; });
  });
  return { byGrade, ids, total };
}

test('P41-B2 正例：真实 knowledge/ 目录与 Runtime 数据一致（drift=0，只读）', () => {
  const { byGrade, ids, total } = selectable();
  assert.deepStrictEqual(BKP.runCheck(byGrade, ids, total, BKP.OUT_DIR), []);
});

test('P41-B2 负例：目标目录为空 → 检出全部缺失页（非空 drift）', () => {
  const { byGrade, ids, total } = selectable();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p41b2-empty-'));
  try {
    const drift = BKP.runCheck(byGrade, ids, total, tmp);
    assert.ok(drift.length > 0, '空目录必须报漂移');
    assert.ok(drift.some((d) => d.startsWith('缺失页面 ')), '应含缺失页面');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('P41-B2 负例：页面内容被篡改 → 检出内容漂移', () => {
  const gc = KC.selectable({ grade: 1 })[0];
  const byGrade = { 1: [gc] };
  const ids = { [gc.knowledgeId]: true };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p41b2-tamper-'));
  try {
    const correct = BKP.buildPageHtml(gc, '1');
    const tampered = correct.replace(/kbgen:hash=[0-9a-f]{64}/, 'kbgen:hash=' + '0'.repeat(64));
    fs.writeFileSync(path.join(tmp, gc.knowledgeId + '.html'), tampered, 'utf8');
    const drift = BKP.runCheck(byGrade, ids, 1, tmp);
    assert.ok(drift.includes('内容漂移 ' + gc.knowledgeId + '.html'), '必须检出内容漂移：' + JSON.stringify(drift));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
