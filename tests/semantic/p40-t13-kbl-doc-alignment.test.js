'use strict';

/**
 * tests/semantic/p40-t13-kbl-doc-alignment.test.js — P40-T-13 KBL 写方白名单 ↔ 文档对账
 *
 * 断言 docs/02-KBL.md §4 的写方白名单表与 dev/p28/check-kbl-ai-boundary.js 的
 * KBL_WRITER_WHITELIST 一一对账（同增同改），并含 P40 冻结声明（R-FAM-01..04）。
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const doc = fs.readFileSync(path.join(ROOT, 'docs', '02-KBL.md'), 'utf8');
const boundary = fs.readFileSync(path.join(ROOT, 'dev', 'p28', 'check-kbl-ai-boundary.js'), 'utf8');

test('P40-T-13 §4 写方白名单与 check-kbl-ai-boundary 白名单一一对账', () => {
  const block = boundary.slice(boundary.indexOf('KBL_WRITER_WHITELIST'), boundary.indexOf('];', boundary.indexOf('KBL_WRITER_WHITELIST')));
  const listed = [...block.matchAll(/'([^']+\.js)'/g)].map((m) => m[1]);
  assert.ok(listed.length >= 17, '白名单脚本数应 ≥17（实得 ' + listed.length + '）');
  const missing = listed.filter((s) => doc.indexOf('`' + s + '`') === -1);
  assert.deepEqual(missing, [], '02-KBL.md §4 缺以下白名单脚本：' + missing.join(', '));
});

test('P40-T-13 §7 冻结声明含 R-FAM-01..04 与变更流程', () => {
  ['R-FAM-01', 'R-FAM-02', 'R-FAM-03', 'R-FAM-04'].forEach((id) => {
    assert.ok(doc.indexOf(id) !== -1, '缺冻结规则 ' + id);
  });
  assert.ok(/kbl:derive/.test(doc) && /build:knowledge/.test(doc), '冻结声明须含重跑流程');
  assert.ok(/多版本 Excel/.test(doc), '须含 E7 版本迁移挂账说明');
});
