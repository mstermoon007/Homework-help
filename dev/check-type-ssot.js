#!/usr/bin/env node
/**
 * dev/check-type-ssot.js — 题型单一事实源（SSOT）门禁（整改方案 R1）
 *
 * 校验三件事：
 *   1) schema.KNOWN_QUESTION_TYPES 集合 == question-type-registry TYPES id 集合
 *      （schema 引用 registry，消除 operate/oral 割裂与枚举分叉）
 *   2) 全库 applicable_question_types 每个值：canonQuestionType 后经 registry 归一
 *      必须落到 canonical 9 类（无悬空、无启发式兜底依赖）
 *   3) 两跳漂移检测：对每个题型值，registry 直接归一 vs（normalizer → registry）归一
 *      结果必须一致；operate/oral/recognize/picture 为特殊关注点
 *
 * 退出码 1 表示存在 FAIL。
 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');

function run() {
  const results = [];
  const warnings = [];
  const errors = [];

  function record(name, pass, detail) {
    results.push({ name, pass, detail });
    (pass ? [] : errors).push({ name, detail });
  }

  // ---------- 加载 ----------
  global.window = global;
  require(path.join(ROOT, 'shared', 'common.js'));
  const Schema = require(path.join(ROOT, 'shared', 'schemas', 'knowledge-point.schema.js'));
  const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
  const Normalizer = require(path.join(ROOT, 'shared', 'knowledge-ontology-normalizer.js'));
  const KB = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));

  // ---------- 1) schema == registry ----------
  const schemaTypes = Schema.KNOWN_QUESTION_TYPES.slice().sort();
  const registryTypes = Registry.all().map((t) => t.id).sort();
  const setEq = JSON.stringify(schemaTypes) === JSON.stringify(registryTypes);
  const onlySchema = schemaTypes.filter((x) => registryTypes.indexOf(x) === -1);
  const onlyRegistry = registryTypes.filter((x) => schemaTypes.indexOf(x) === -1);
  record(
    'schema == registry (canonical 集合一致)',
    setEq,
    'schema=' + schemaTypes.join('/') + ' | registry=' + registryTypes.join('/') +
      (onlySchema.length ? ' | 仅 schema:' + onlySchema.join('/') : '') +
      (onlyRegistry.length ? ' | 仅 registry:' + onlyRegistry.join('/') : '')
  );

  // ---------- 2) 全库题型值归一闭环 ----------
  const values = {};
  ['math', 'cn', 'en'].forEach((sub) => {
    const d = KB[sub] || [];
    (Array.isArray(d) ? d : []).forEach((e) => {
      (e.modules || []).forEach((m) => {
        (m.knowledgePoints || []).forEach((kp) => {
          const q = kp.applicableQuestionTypes || kp.applicable_question_types;
          if (Array.isArray(q)) q.forEach((o) => {
            const t = o && o.type;
            if (t) values[t] = (values[t] || 0) + 1;
          });
        });
      });
    });
  });

  const canonical = Registry.all().map((t) => t.id);
  const unmapped = [];
  const heuristic = [];
  const keys = Object.keys(values);
  keys.forEach((v) => {
    const viaNormalizer = Normalizer.canonQuestionType(v);
    const n = Registry.normalizeQuestionType(viaNormalizer, { allowHeuristic: false });
    if (!n.id || canonical.indexOf(n.id) === -1) unmapped.push(v + '(' + values[v] + ')');
    else if (n.confidence === 'heuristic') heuristic.push(v + '→' + n.id);
  });

  record(
    '全库题型值归一闭环（无悬空）',
    unmapped.length === 0,
    '题型值 ' + keys.length + ' 种（614 实例），悬空 ' + unmapped.length +
      (unmapped.length ? '：' + unmapped.slice(0, 15).join(', ') : '') +
      (heuristic.length ? ' | 启发式兜底 ' + heuristic.length + '：' + heuristic.slice(0, 8).join(', ') : '')
  );

  // ---------- 3) 两跳漂移检测 ----------
  const drift = [];
  keys.forEach((v) => {
    const direct = Registry.normalizeQuestionType(v, { allowHeuristic: false }).id;
    const viaNormalizer = Normalizer.canonQuestionType(v);
    const indirect = Registry.normalizeQuestionType(viaNormalizer, { allowHeuristic: false }).id;
    if (direct !== indirect) drift.push(v + '(直→' + direct + ' 经→' + indirect + ')');
  });

  record(
    '两跳漂移检测（normalizer 与 registry 方向一致）',
    drift.length === 0,
    '漂移 ' + drift.length + (drift.length ? '：' + drift.slice(0, 15).join(', ') : '')
  );

  // 特殊关注点：operate/oral/recognize/picture 收敛
  const focus = {};
  ['operate', 'oral', 'recognize', 'picture'].forEach((v) => {
    const n = Registry.normalizeQuestionType(Normalizer.canonQuestionType(v), { allowHeuristic: false });
    focus[v] = n.id;
  });
  warnings.push('特殊题型归一终点：operate→' + focus.operate + '、oral→' + focus.oral +
    '、recognize→' + focus.recognize + '、picture→' + focus.picture +
    (focus.picture === focus.operate ? '（picture 与 operate 同终点，待决策）' : ''));

  // ---------- 汇总 ----------
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log('==== 题型 SSOT 门禁（check-type-ssot） ====');
  results.forEach((r) => console.log('  [' + (r.pass ? 'PASS' : 'FAIL') + '] ' + r.name));
  warnings.forEach((w) => console.log('  [WARN] ' + w));
  console.log('-------------------------------------------');
  console.log('步骤 ' + results.length + ' 项，通过 ' + passCount + ' / 失败 ' + failCount);
  return { name: 'type-ssot', pass: failCount === 0, errors, warnings, summary: 'SSOT ' + passCount + '/' + results.length };
}

// 直接执行
if (require.main === module) {
  const r = run();
  process.exitCode = r.pass ? 0 : 1;
}
module.exports = { run };
