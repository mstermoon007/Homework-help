#!/usr/bin/env node
/**
 * dev/r2-qtype-normalize-apply.js — 应用 R2 题型规范化到 knowledge-*.js（Frozen Core 数据）
 *
 * 依据 docs/R2_QTYPE_NORMALIZATION.md 映射（共享模块 r2-qtype-normalize-map.js）。
 * 行为：
 *   1) 归档备份 knowledge-math/cn/en.js → archive/knowledge-<sub>-qtype-<ts>.js
 *   2) 按行处理：仅对含 `applicable_question_types: [` 的单行数组改写
 *        元素级文本替换，兼容两种书写格式：
 *          - JSON 紧凑：   [{"type":"calc","coefficient":1}]
 *          - 无引号键：    [ { type: "add", coefficient: 1 } ]
 *        - type 已是 canonical → 不动
 *        - 非 canonical → type 改写为 canonical，元素级写入 rawType（原始值，审计字段）
 *        - 无法判定（'待定'）→ 不改写，记入待定清单（不阻塞）
 *    保留文件其余所有内容/注释/格式（kp.type 等其它 "type" 字段不受影响）
 *   3) 输出改写统计
 *
 * 改后验证：npm run verify:m1 && npm run verify:m2 && node dev/check-type-ssot.js && npm run check-regression
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'shared/common.js'));
const Map = require(path.join(ROOT, 'dev', 'r2-qtype-normalize-map.js'));
const CANONICAL = Map.CANONICAL;
const decide = Map.decide;

const FILES = ['math', 'cn', 'en'].map((sub) => ({
  sub,
  fp: path.join(ROOT, 'shared', 'knowledge-' + sub + '.js')
}));

function ts() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

function archive(fp, tag) {
  const dir = path.join(ROOT, 'archive');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const dst = path.join(dir, path.basename(fp).replace(/\.js$/, '') + '-' + tag + '-' + ts() + '.js');
  fs.copyFileSync(fp, dst);
  return dst;
}

const LINE_RE = /^(.*?["']?applicable_question_types["']?\s*:\s*\[)(.*)(\]\s*,?\s*)$/;
// 元素级 type 键：无引号键 `type: "v"`、JSON 紧凑 `"type":"v"`、JSON 空格 `"type": "v"` 三种写法
const ELEM_RE = /(\{[^{}]*?\})/g;
const TYPE_RE = /((?:type|"type")\s*:\s*")([^"]+)(")/g;

let totalChanged = 0;
let totalPending = 0;
const pendings = [];

FILES.forEach(({ sub, fp }) => {
  const text = fs.readFileSync(fp, 'utf8');
  const lines = text.split('\n');
  let changed = 0;
  let pending = 0;
  const pendingList = [];

  lines.forEach((line, i) => {
    const m = LINE_RE.exec(line);
    if (!m) return;
    const prefix = m[1], inner = m[2], suffix = m[3];
    let lineDirty = false;
    const newInner = inner.replace(ELEM_RE, (elem) => {
      let elemDirty = false;
      const newElem = elem.replace(TYPE_RE, (full, pre, val, post) => {
        if (CANONICAL.indexOf(val) !== -1) return full;
        const r = decide(val);
        if (r.to === '待定') { pending++; pendingList.push(val); return full; }
        const isJsonStyle = pre.charAt(0) === '"';
        const spaced = pre.indexOf(': "') !== -1;
        elemDirty = true;
        changed++;
        if (isJsonStyle) {
          return pre + r.to + post + (spaced ? ', "rawType": "' : ',"rawType":"') + val + '"';
        }
        return pre + r.to + post + ', rawType: "' + val + '"';
      });
      if (elemDirty) { lineDirty = true; return newElem; }
      return elem;
    });
    if (!lineDirty) return;
    lines[i] = prefix + newInner + suffix;
  });

  const changedText = lines.join('\n');
  if (changedText !== text) {
    const bak = archive(fp, 'qtype');
    fs.writeFileSync(fp, changedText, 'utf8');
    console.log('[' + sub + '] 改写 ' + changed + ' 实例，待定 ' + pending + ' → 备份 ' + path.basename(bak));
  } else {
    console.log('[' + sub + '] 无改写');
  }
  totalChanged += changed;
  totalPending += pending;
  pendings.push.apply(pendings, pendingList);
});

console.log('---');
console.log('改写实例合计：' + totalChanged);
console.log('待定（未改写）：' + totalPending + (totalPending ? ' → ' + [...new Set(pendings)].join('、') : ''));
console.log('备份：archive/knowledge-<sub>-qtype-*.js');
console.log('下一步验证：npm run verify:m1 && npm run verify:m2 && node dev/check-type-ssot.js && npm run check-regression');
