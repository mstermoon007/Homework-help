#!/usr/bin/env node
/**
 * dev/r2-qtype-normalize-draft.js — 生成 R2 题型规范化映射草案（docs/R2_QTYPE_NORMALIZATION.md）
 *
 * 原则：以 question-type-registry 为 SSOT；registry 显式别名（exact/explicit）语义合理则采用；
 * 对启发式/悬空/明显误判值按语义纠偏（覆盖表，见 r2-qtype-normalize-map.js）；每行给出判定依据。
 * 生成物为草案文档，供评审后由 r2-qtype-normalize-apply.js 应用改写。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'shared/common.js'));
const KB = require(path.join(ROOT, 'shared/knowledge-bank.js'));
const Map = require(path.join(ROOT, 'dev', 'r2-qtype-normalize-map.js'));
const CANONICAL = Map.CANONICAL;
const decide = Map.decide;

// ============ 数据源：优先应用前备份（保证映射表完整），否则当前数据 ============
// 应用后当前数据已全部 canonical，映射决策表须来自改写前快照。
function loadPreApplyData() {
  const glob = fs.readdirSync(path.join(ROOT, 'archive'))
    .filter((f) => /^knowledge-(math|cn|en)-qtype-.*\.js$/.test(f))
    .sort();
  if (!glob.length) return null;
  // 取每个子文件最早的备份（最接近改写前原始快照，保证映射决策表完整）
  const files = ['math', 'cn', 'en'].map((sub) => {
    const cand = glob.filter((f) => f.indexOf('knowledge-' + sub + '-') === 0);
    return cand.length ? cand[0] : null;
  }).filter(Boolean);
  if (!files.length) return null;
  const src = {};
  files.forEach((f) => {
    const code = fs.readFileSync(path.join(ROOT, 'archive', f), 'utf8');
    const Module = module.constructor;
    const m = new Module(f, module);
    m.filename = path.join(ROOT, 'archive', f);
    m.paths = module.paths;
    const sandbox = { window: { KnowledgeBank: { math: [], cn: [], en: [] } }, module: m, exports: m.exports };
    try {
      (new Function('window', 'module', 'exports', code))(sandbox.window, m, m.exports);
      src[path.basename(f).replace(/^knowledge-/, '').replace(/-qtype-.*$/, '')] = sandbox.window.KnowledgeBank;
    } catch (e) {
      console.log('  [warn] 备份加载失败 ' + f + '：' + e.message);
    }
  });
  return src;
}
const PRE = loadPreApplyData();

// ============ 收集全部非 canonical 值 ============
const stat = {}, samples = {};
function scanDataSource(srcMap, fromPre) {
  Object.keys(srcMap).forEach((sub) => {
    const d = srcMap[sub];
    // 备份源：{ math:[...], cn:[...], en:[...] } 按 sub 取对应数组；当前源：直接数组
    const arr = (d && typeof d === 'object' && !Array.isArray(d)) ? (d[sub] || []) : (Array.isArray(d) ? d : []);
    (Array.isArray(arr) ? arr : []).forEach((e) => (e.modules || []).forEach((m) => (m.knowledgePoints || []).forEach((kp) => {
      const q = kp.applicableQuestionTypes || kp.applicable_question_types;
      if (Array.isArray(q)) q.forEach((o) => {
        const t = o && o.type;
        if (!t) return;
        stat[t] = (stat[t] || 0) + 1;
        if (!samples[t]) samples[t] = { kp: kp.id, sub, grade: e.grade || e.id, name: kp.name };
      });
    })));
  });
}
if (PRE) {
  scanDataSource(PRE, true);
  console.log('  [数据源] 应用前备份：' + fs.readdirSync(path.join(ROOT, 'archive')).filter((f) => /^knowledge-(math|cn|en)-qtype-.*\.js$/.test(f)).join('、'));
} else {
  scanDataSource({ math: KB.math, cn: KB.cn, en: KB.en }, false);
  console.log('  [数据源] 当前数据（未找到应用前备份）');
}
const nonCanon = Object.keys(stat).filter((t) => CANONICAL.indexOf(t) === -1).sort((a, b) => stat[b] - stat[a]);

// ============ 判定 ============
const pending = [];
let md = '# R2 题型规范化映射草案\n\n';
md += '> 依据：`docs/AI_REFACTOR_PLAN.html` R2「改写 G2-G6 + cn/en 非 canonical 题型为 canonical（保留 rawType 审计字段）」；\n';
md += '> 授权：Q5（按语义归类出草案）；Q4 已定 `picture→calc`；SSOT 原则：`question-type-registry` 为真源，registry 显式别名语义合理即采用，启发式/悬空/误判经覆盖表纠偏。\n\n';
md += '**统计**：非 canonical ' + nonCanon.length + ' 种 / ' + nonCanon.reduce((s, t) => s + stat[t], 0) + ' 实例（全库 574 KP、614 题型值）。\n\n';
md += '| 原值 | 实例 | canonical | 判定来源 | 依据 | 示例 KP |\n|---|---|---|---|---|---|\n';
nonCanon.forEach((v) => {
  const r = decide(v);
  if (r.to === '待定') pending.push(v + '(' + stat[v] + ')');
  const s = samples[v];
  md += '| ' + v + ' | ' + stat[v] + ' | ' + r.to + ' | ' + r.src + ' | ' + r.why + ' | ' + s.kp + '（' + s.name + '） |\n';
});
md += '\n---\n\n**待定项**：' + (pending.length ? pending.join('、') : '无') + '\n\n';

// ============ 数据结构扩展空间预留 ============
md += '## 数据结构：题型优化知识点结构的扩展空间预留\n\n';
md += '规范化后 `applicable_question_types` 元素结构（对齐一年级实例 `{ type, coefficient }`，加审计字段）：\n\n';
md += '```js\n// 规范化后（G2-G6 + cn/en 统一到一年级口径）\n{ type: \'calc\',      // canonical 9 类：calc/fill/choice/judge/apply/open/geometry/recognize/oral（operate 等为 registry 别名，归一 oral）\n  coefficient: 1,   // 题型配比权重（保留原值）\n  rawType: \'mix\' }  // 审计字段：改写前的原始细粒度题型值（仅非 canonical 时写入）\n```\n\n';
md += '**为后续「题型优化知识点结构」预留的空间**（本阶段只落 rawType，不额外造字段）：\n\n';
md += '1. **细粒度信息不丢失**：`rawType` 完整保留改写前值（如 `mix`/`chase`/`bar-chart`），未来若要按题型细分知识点（如"行程-追及"专项配置），可从 `rawType` 无损重建细粒度层，无需回滚数据。\n';
md += '2. **元素为开放对象**：只改写 `type` 并追加 `rawType`，不删除、不覆盖任何既有字段（当前仅 `type`/`coefficient`）；后续如需为某题型加 `subtype`/`difficultyRange`/`numberRange` 等题型级参数，直接追加字段即可，不破坏既有消费方。\n';
md += '3. **规范字段名与校验同源**：canonical 枚举以 `question-type-registry` 为唯一真源（R1 已闭环 schema==registry），未来题型扩展只需改 registry，数据层与校验层自动对齐。\n';
md += '4. **一年级为基准口径**：G1 已按 `{ type: canonical, coefficient }` 规范化（如 `math-g1-m0-make-ten` → `[{type:"calc",coefficient:1},{type:"fill",coefficient:0.6}]`），本次改写使 G2-G6 + cn/en 与一年级口径完全一致。\n\n';

md += '**应用方式**（r2-qtype-normalize-apply.js）：遍历 knowledge-*.js 全部 KP，将 `applicable_question_types[].type` 按上表改写为 canonical，非 canonical 值写入元素级 `rawType`（审计），随后 verify:m1/m2 + check-type-ssot + check-regression 全量验证；Frozen Core 改动前先归档备份。\n';

const out = path.join(ROOT, 'docs', 'R2_QTYPE_NORMALIZATION.md');
fs.writeFileSync(out, md);
console.log('已生成：' + out + '（' + nonCanon.length + ' 行映射，待定 ' + pending.length + ' 项）');
if (pending.length) console.log('待定项：' + pending.join('、'));
