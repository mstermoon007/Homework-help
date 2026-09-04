#!/usr/bin/env node
/**
 * scripts/audit-g1-field-consumption.js — 一年级数学知识库「字段消费度」只读审计
 *
 * 目的：回答「去掉中间层后由知识点驱动出题」时，G1 知识点的 26 个字段
 *       目前有多少被生成链路实际消费（core/aux/unused），多少只是填充了数据。
 *
 * 只读：不修改任何数据源。运行（项目根目录）：
 *   node scripts/audit-g1-field-consumption.js          # 控制台汇总 + 写审计 JSON
 *   node scripts/audit-g1-field-consumption.js --json   # 仅输出 JSON（供下游使用）
 *
 * 判定口径：
 *   - 「填充率」= 53 个 G1 知识点中该字段有有效值的个数占比（数据完整性维度）。
 *   - 「消费等级」= 基于生成链路源码静态核验（证据见 FIELD_EVIDENCE）：
 *       core   生成链路强消费（策略/生成器直接读取，影响题面/题型/题量/约束）
 *       aux    辅助消费（normalizer 兜底 / 展示层 / 数据完整性，生成不强依赖）
 *       unused 生成链路未消费（仅 canonical 保留或草案未应用）
 *
 * 消费链路（字段流向）：
 *   shared/knowledge-math.js (扁平字段)
 *     → shared/knowledge-ontology-normalizer.js (扁平→canonical)
 *     → shared/strategy/* (题型/难度/数值范围/结构/螺旋/情境/认知)
 *     → shared/generator/{generator-selector,kp-arithmetic-semantics,legacy-adapter}
 *     → 核心生成器 shared/generator/generators/* 或旧插件 plugins/*.js
 */

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

// ============ 1. 加载 G1 知识点（保留完整字段 + 模块归属） ============
const grade1 = (KnowledgeBank.math || []).find(function (g) { return g.grade === 1; });
if (!grade1) { console.error('未找到 G1 数学知识库'); process.exit(1); }

const kps = [];
(grade1.modules || []).forEach(function (m) {
  (m.knowledgePoints || []).forEach(function (kp) {
    kps.push(Object.assign({ moduleId: m.moduleId }, kp));
  });
});
const N = kps.length;

// ============ 2. 字段清单 ============
const FIELD_DEFS = [
  // 扁平字段（shared/knowledge-math.js 中真实存在）
  'id', 'name', 'pluginId', 'weight', 'type', 'description', 'example', 'concept',
  'operations', 'factualContent', 'common_errors', 'graphicType', 'prerequisites',
  'related', 'difficulty', 'spiral_level', 'max_spiral_level', 'cognitive_level',
  'applicable_question_types', 'number_range_default', 'max_steps_default',
  'context_default', 'status',
  // 草案标注字段（docs/g1-math-knowledge-base-draft.json，尚未写回数据源）
  'book', 'unit', 'category'
];

// ============ 3. 字段消费证据（生成链路源码核验，文件:行号） ============
const FIELD_EVIDENCE = {
  id:                   { level: 'core',   ev: 'strategy-engine.js:51 kp.id；全链路知识点标识' },
  name:                 { level: 'aux',    ev: 'normalizer:111 identity.name；知识库页 generate-knowledge-pages.js:157 读 kp.name（展示）' },
  pluginId:             { level: 'aux',    ev: 'normalizer:115 source.pluginId；:121/130/205 兜底 operations/factual/errors；generator-selector.js:82 legacyPluginId fallback' },
  type:                 { level: 'core',   ev: 'kp-arithmetic-semantics.js:60 kp.source.legacyType→operators；normalizer:81/164 capabilities+aqt 兜底；question-type-strategy.js:79' },
  weight:               { level: 'core',   ev: 'normalizer:218 metadata.weight；comprehensive-strategy.js:92/104/115 e.weight；question-type-allocation.js:141/146 k.weight（综合/多知识点题量分配）' },
  description:          { level: 'aux',    ev: 'normalizer:112 identity.description；知识库页说明（生成不强依赖）' },
  example:              { level: 'aux',    ev: 'normalizer:224 legacy.example；generate-knowledge-pages.js:72 pointExample 读 kp.example（知识库页，非生成链路）' },
  concept:              { level: 'unused', ev: 'normalizer:131/134 knowledge.concept 保留；未见 strategy/generator 读取' },
  operations:           { level: 'aux',    ev: 'normalizer:119-128 knowledge.operations 规范化；算术语义用 source.legacyType 而非 operations；未见下游读取' },
  factualContent:       { level: 'unused', ev: 'normalizer:129 knowledge.factualContent 保留；未见 strategy/generator 读取' },
  common_errors:        { level: 'aux',    ev: 'normalizer:199-206 errors；legacy 干扰项/错误答案生成可能使用，未见生成链路直接读取' },
  graphicType:          { level: 'aux',    ev: 'normalizer:175 presentation.graphicType；展示/渲染选图（renderer），生成不强依赖' },
  prerequisites:        { level: 'unused', ev: 'normalizer:132/225 knowledge+legacy.prerequisites 保留；strategy-engine 全 8 步未读 → 无跨单元递进出题' },
  related:              { level: 'unused', ev: 'normalizer:226 legacy.related 保留；无下游消费' },
  difficulty:           { level: 'core',   ev: 'normalizer:223 legacy.difficulty；static-difficulty.js:31 kp.legacy.difficulty（静态难度基线）' },
  spiral_level:         { level: 'core',   ev: 'normalizer:211 spiral.level；static-difficulty.js:33、spiral-strategy.js:45' },
  max_spiral_level:     { level: 'core',   ev: 'normalizer:213 spiral.maxLevel；static-difficulty.js:35、strategy-engine.js:94（自适应上限）' },
  cognitive_level:      { level: 'core',   ev: 'normalizer:149/231 cognition.raw/legacy.cognitive_level；cognitive-strategy.js:55/61、static-difficulty.js:37' },
  applicable_question_types: { level: 'core', ev: 'normalizer:153 presentation.questionTypes；question-type-strategy.js:79 选择题型；deriveCapabilities' },
  number_range_default: { level: 'core',   ev: 'normalizer:179 numeric.range；number-range-strategy.js:57 kp.numeric.range' },
  max_steps_default:    { level: 'core',   ev: 'normalizer:140 structure.maxSteps；structure-constraints.js + static-difficulty.js:39' },
  context_default:      { level: 'core',   ev: 'normalizer:191 context.defaults；context-strategy.js:50-52' },
  status:               { level: 'unused', ev: 'normalizer:227 legacy.status 保留；仅数据状态/覆盖统计，生成链路不读' },
  book:                 { level: 'unused', ev: '草案字段（g1-math-knowledge-base-draft.json），normalizer 未映射，未写回数据源' },
  unit:                 { level: 'unused', ev: '草案字段，normalizer 未映射，未写回数据源' },
  category:             { level: 'unused', ev: 'normalizer:228 legacy.category 已预留；下游 strategy/生成器未读' }
};

// ============ 4. 填充率统计 ============
function hasValue(kp, f) {
  const v = kp[f];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'object') return Object.keys(v).length > 0;
  return true;
}

const fieldStats = FIELD_DEFS.map(function (f) {
  const filled = kps.filter(function (k) { return hasValue(k, f); }).length;
  return {
    field: f,
    filled: filled,
    filledPct: N ? Math.round((filled / N) * 100) : 0,
    level: FIELD_EVIDENCE[f] ? FIELD_EVIDENCE[f].level : 'unknown',
    evidence: FIELD_EVIDENCE[f] ? FIELD_EVIDENCE[f].ev : ''
  };
});

// ============ 5. 汇总 ============
const byLevel = { core: 0, aux: 0, unused: 0 };
fieldStats.forEach(function (s) { byLevel[s.level] = (byLevel[s.level] || 0) + 1; });

// 全填充（100%）字段 / 零填充字段
const fullFilled = fieldStats.filter(function (s) { return s.filled === N; }).map(function (s) { return s.field; });
const zeroFilled = fieldStats.filter(function (s) { return s.filled === 0; }).map(function (s) { return s.field; });

const summary = {
  grade: 1,
  subject: 'math',
  kpCount: N,
  moduleCount: grade1.modules.length,
  fieldsAudited: fieldStats.length,
  byLevel: byLevel,
  fullFilled: fullFilled,
  zeroFilled: zeroFilled,
  fields: fieldStats,
  generatedAt: new Date().toISOString()
};

// ============ 6. 输出 ============
if (process.argv.indexOf('--json') !== -1) {
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
} else {
  const pad = function (s, n) { s = String(s); while (s.length < n) s += ' '; return s; };
  console.log('一年级数学知识库 · 字段消费度审计（只读）');
  console.log('='.repeat(70));
  console.log('G1 知识点数: ' + N + ' | 模块数: ' + grade1.modules.length + ' | 审计字段: ' + fieldStats.length);
  console.log('消费等级分布: core ' + byLevel.core + ' | aux ' + byLevel.aux + ' | unused ' + byLevel.unused);
  console.log('-' .repeat(70));
  console.log(pad('字段', 26) + pad('填充', 7) + pad('等级', 8) + '证据');
  console.log('-'.repeat(70));
  fieldStats.forEach(function (s) {
    console.log(pad(s.field, 26) + pad(s.filled + '/' + N + ' (' + s.filledPct + '%)', 7) + pad(s.level, 8) + s.evidence);
  });
  console.log('-'.repeat(70));
  console.log('100% 填充字段: ' + fullFilled.join(', '));
  console.log('0% 填充字段(未应用): ' + (zeroFilled.length ? zeroFilled.join(', ') : '(无)'));
  console.log('生成层未消费(unused)字段: ' + fieldStats.filter(function (s) { return s.level === 'unused'; }).map(function (s) { return s.field; }).join(', '));

  // 写 JSON 结果到 scripts/../audit-results（供报告/可视化引用）
  try {
    const outDir = path.join(ROOT, 'audit-results');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, 'g1-field-consumption.json');
    fs.writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8');
    console.log('已写 JSON: ' + outFile);
  } catch (e) {
    console.log('写 JSON 失败(跳过): ' + e.message);
  }
}
