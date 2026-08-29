#!/usr/bin/env node
/*
 * 阶段1（难度元数据字段扩展）一次性迁移脚本
 * 为 shared/knowledge-{math,cn,en}.js 中每个知识点插入 7 个静态难度字段：
 *   spiral_level / max_spiral_level / cognitive_level /
 *   applicable_question_types / number_range_default /
 *   max_steps_default / context_default
 * 采用文本插入方式（在每个知识点 status: 行之前插入），保留原文件格式与注释。
 * 幂等：若知识点已含 spiral_level，则跳过。
 */
'use strict';

const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'common.js')); // 供给 PluginUtil（difficulty.js 依赖）
const Difficulty = require(path.join(ROOT, 'shared', 'difficulty.js'));
const MAX_STEPS = (Difficulty.difficultyToStructure && Difficulty.difficultyToStructure(3).steps) || 3;

global.KnowledgeBank = global.KnowledgeBank || {};
const bank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

const COGNITIVE_DEFAULT = '掌握';
const CONTEXT_DEFAULT = 'standard';

// 螺旋上升主题：按 id/pluginId 命中则赋予跨年级 spiral_level 映射与上限
const SPIRALS = [
  { re: /mul|multiply|乘/,           max: 3, map: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3 } },
  { re: /div|除/,                    max: 3, map: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3 } },
  { re: /addsub|add-sub|加减/,       max: 6, map: { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 } },
  { re: /fraction|分数/,             max: 3, map: { 3: 1, 4: 2, 5: 3, 6: 3 } },
  { re: /decimal|小数/,              max: 3, map: { 3: 1, 4: 2, 5: 3, 6: 3 } },
  { re: /unit-convert|换算|单位/,    max: 3, map: { 2: 1, 3: 2, 4: 3, 5: 3, 6: 3 } },
  { re: /geometry|shapes|图形|几何/, max: 3, map: { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3, 6: 3 } }
];

function spiralFor(kp, grade) {
  const hay = (kp.id || '') + '|' + (kp.pluginId || '');
  for (const s of SPIRALS) {
    if (s.re.test(hay)) {
      return { spiral_level: s.map[grade] || 1, max_spiral_level: s.max };
    }
  }
  return { spiral_level: 1, max_spiral_level: 1 };
}

function applicableQuestionTypes(kp) {
  const t = kp.type;
  if (Array.isArray(t)) return t.map(x => ({ type: String(x), coefficient: 1 }));
  if (typeof t === 'string' && t) return [{ type: t, coefficient: 1 }];
  if (kp.pluginId) return [{ type: kp.pluginId, coefficient: 1 }];
  return [];
}

function numberRangeDefault(subject, pluginId, grade) {
  if (subject !== 'math') return { min: 1, max: 1 };
  const g = grade || 1;
  if (/fraction/.test(pluginId)) return { min: 0, max: 1 };
  if (/decimal/.test(pluginId)) return { min: 0, max: 10 };
  if (/unit-convert|geometry|shapes|clock|pattern|position/.test(pluginId)) return { min: 1, max: 12 };
  if (/oral|number-sense|make-ten|count|recogni|compar/.test(pluginId)) return { min: 1, max: 20 };
  if (g <= 2) return { min: 1, max: 100 };
  if (g <= 4) return { min: 1, max: 1000 };
  return { min: 1, max: 10000 };
}

const computed = new Map();
function transformSubject(data, subject) {
  data.forEach(entry => {
    const g = entry.grade;
    (entry.modules || []).forEach(mod => {
      (mod.knowledgePoints || []).forEach(kp => {
        if (!kp.id) return;
        const sp = spiralFor(kp, g);
        computed.set(kp.id, {
          spiral_level: sp.spiral_level,
          max_spiral_level: sp.max_spiral_level,
          cognitive_level: COGNITIVE_DEFAULT,
          applicable_question_types: applicableQuestionTypes(kp),
          number_range_default: numberRangeDefault(subject, kp.pluginId, g),
          max_steps_default: MAX_STEPS,
          context_default: CONTEXT_DEFAULT
        });
      });
    });
  });
}
transformSubject(bank.math, 'math');
transformSubject(bank.cn, 'cn');
transformSubject(bank.en, 'en');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatFields(f, indent, quoted) {
  const k = quoted ? (s) => '"' + s + '"' : (s) => s;
  const aqt = f.applicable_question_types
    .map(a => (quoted
      ? `{ "type": "${a.type}", "coefficient": ${a.coefficient} }`
      : `{ type: "${a.type}", coefficient: ${a.coefficient} }`))
    .join(', ');
  const nr = quoted
    ? `{ "min": ${f.number_range_default.min}, "max": ${f.number_range_default.max} }`
    : `{ min: ${f.number_range_default.min}, max: ${f.number_range_default.max} }`;
  return [
    `${indent}${k('spiral_level')}: ${f.spiral_level},`,
    `${indent}${k('max_spiral_level')}: ${f.max_spiral_level},`,
    `${indent}${k('cognitive_level')}: ${JSON.stringify(f.cognitive_level)},`,
    `${indent}${k('applicable_question_types')}: [ ${aqt} ],`,
    `${indent}${k('number_range_default')}: ${nr},`,
    `${indent}${k('max_steps_default')}: ${f.max_steps_default},`,
    `${indent}${k('context_default')}: ${JSON.stringify(f.context_default)},`
  ].join('\n') + '\n';
}

const SHARDS = [
  { file: path.join(ROOT, 'shared', 'knowledge-math.js'), subject: 'math' },
  { file: path.join(ROOT, 'shared', 'knowledge-cn.js'), subject: 'cn' },
  { file: path.join(ROOT, 'shared', 'knowledge-en.js'), subject: 'en' }
];

SHARDS.forEach(({ file, subject }) => {
  let text = fs.readFileSync(file, 'utf8');
  const quoted = /"grade":/.test(text);
  const data = subject === 'math' ? bank.math : (subject === 'cn' ? bank.cn : bank.en);
  let pos = 0;
  let inserts = 0;
  let skipped = 0;

  (data || []).forEach(entry => {
    (entry.modules || []).forEach(mod => {
      (mod.knowledgePoints || []).forEach(kp => {
        if (!kp.id) return;
        const fields = computed.get(kp.id);
        if (!fields) return;
        if (Object.prototype.hasOwnProperty.call(kp, 'spiral_level')) { skipped++; return; }

        const idRe = new RegExp('(?:"id"|id)\\s*:\\s*"' + escapeRegex(kp.id) + '"');
        const idM = idRe.exec(text.slice(pos));
        if (!idM) { console.error('  ✗ 未找到 id 行:', kp.id); return; }
        const idIdx = pos + idM.index;

        const statusRe = /(?:"status"|status)\s*:/;
        const statusM = statusRe.exec(text.slice(idIdx));
        if (!statusM) { console.error('  ✗ 未找到 status 行:', kp.id); return; }
        const statusKeywordIdx = idIdx + statusM.index;
        const beforeStatus = text.slice(0, statusKeywordIdx);
        const nlStatus = beforeStatus.lastIndexOf('\n');
        const lineStart = nlStatus + 1; // 状态行起始（含前导空白）
        const indent = text.slice(lineStart, statusKeywordIdx).match(/^\s*/)[0];

        const block = formatFields(fields, indent, quoted);
        text = text.slice(0, lineStart) + block + text.slice(lineStart);
        pos = lineStart + block.length;
        inserts++;
      });
    });
  });

  fs.writeFileSync(file, text);
  console.log(`✅ ${path.basename(file)}（${quoted ? 'quoted' : 'unquoted'} keys）：插入 ${inserts} 个，跳过已存在 ${skipped} 个`);
});

console.log('\n完成。请运行 `node dev/verify-knowledge-bank.js` 校验。');
