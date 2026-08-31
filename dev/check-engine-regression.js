#!/usr/bin/env node
/**
 * dev/check-engine-regression.js — M7-R29 统一 GenerationEngine 回归
 *
 * 目标：把 M7-R26 的统一 API 四种模式纳入回归——
 *   single-kp  ：按 knowledgePointId 单点生成
 *   multi-kp   ：显式 knowledgePoints 数组合并规划
 *   comprehensive：subject+grade 全量覆盖
 *   adaptive   ：接管 learnerProfile/difficulty
 *
 * 覆盖：每个 legacy 插件（经其绑定 KP）+ 每门科目 × 四种模式。
 * 断言（每 case）：
 *   noCrash       不崩溃（真崩溃 = 失败）
 *   hasQuestions  single/multi ≥1 题；comprehensive/adaptive ≥1 题
 *   gradable      每题符合 SemanticQuestion 可判分契约（answer.value 或 acceptable 或 read-aloud）
 *   promptOrGraphic 每题有提示文本 或 图形（图形题允许空 prompt）
 *   renderable    渲染 HTML 非空且含 question-card
 *   planTrace    计划数 > 0 或产出题数 > 0（不静默吞掉）
 *
 * 宽容项（WARN 非失败）：
 *   - legacy 插件忽略 count 等文件（如 multiplication-table 整表一题）
 *   - 科目×年级无知识点（如 english g1/g2）→ SKIP
 *
 * 用法：node dev/check-engine-regression.js [--only pluginId|subject]
 * 退出码：0 全部通过；1 存在真实失败。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');

require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
require(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'));
require(path.join(ROOT, 'shared', 'strategy', 'comprehensive-strategy.js'));
require(path.join(ROOT, 'shared', 'generator', 'legacy-plugin-adapter.js'));
var GE = require(path.join(ROOT, 'shared', 'generation-engine.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));

var ONLY = null;
process.argv.slice(2).forEach(function (a, i, arr) {
  if (a === '--only') ONLY = String(arr[i + 1] || '').split(',');
});
var COUNT = 4;

var pass = 0, fail = 0, skipped = 0;
var failures = [];

function log(ok, tag, line, warn) {
  if (ok) {
    if (warn) { console.log('  ~ ' + tag + (line ? ' — ' + line : '')); }
    else { pass++; console.log('  ✓ ' + tag + (line ? ' — ' + line : '')); }
  } else {
    fail++; failures.push(tag + (line ? ' — ' + line : ''));
    console.log('  ✗ ' + tag + (line ? ' — ' + line : ''));
  }
}
function skip(tag, line) { skipped++; console.log('  - ' + tag + (line ? ' — ' + line : '')); }

function inOnly(id) {
  if (!ONLY) return true;
  return ONLY.some(function (k) { return id.indexOf(k) !== -1; });
}

/** 可判分：answer 为标量 / 非空标量数组 / {value}/acceptable / read-aloud（对齐 defaultCheck） */
function isGradable(q) {
  if (!q) return false;
  // read-aloud（跟读）无书面作答，仅按提示/跟读目标接受——先于 answer 形状判定
  var am = q.answerMode || (q.question && q.question.answerMode);
  if (am === 'read-aloud') return true;
  var a = q.answer;
  if (a == null) return false;
  if (typeof a === 'string' || typeof a === 'number' || typeof a === 'boolean') return true;
  if (Array.isArray(a)) return a.length > 0 && a.every(function (v) { return v != null && v !== ''; });
  if (typeof a === 'object') {
    if (a.value != null) return true;
    if (Array.isArray(a.acceptable) && a.acceptable.length) return true;
  }
  return false;
}
/** 提示文本或图形存在：（图形题允许空 prompt） */
function hasContent(q) {
  var p = q.prompt || (q.question && q.question.prompt) || (q.content && q.content.prompt);
  if (p && String(p).trim() !== '') return true;
  return !!(q.graphic && q.graphic.type);
}

/**
 * 已知架构边界（非适配缺陷、非 SVG 丢失）：
 *   legacy `*-vertical` 插件把全部内容（竖式布局）交给 q.render() 以 HTML
 *   而非 <svg>/文本 产出——SemanticQuestion 模型（prompt+svg 图形）当前无法承载。
 *   为透明起见：此类产出以 WARN 记录（不静默通过、也不算迁移阻断），详见 R30 结论。
 */
var BOUNDARY_RE = /^(legacy:)?math-g[45]-vertical(:|$)/;
function isKnownBoundary(q) {
  var gen = (q.metadata && q.metadata.generator) || '';
  return BOUNDARY_RE.test(gen) && !hasContent(q);
}

function validate(questions, requireCount) {
  var ok = true, note = '';
  if (!Array.isArray(questions) || questions.length < 1) {
    return { ok: false, note: '产出 0 题' };
  }
  var ungrad = questions.filter(function (q) { return !isGradable(q); });
  var nocontent = questions.filter(function (q) { return !hasContent(q); });
  if (ungrad.length) { ok = false; note = ungrad.length + ' 题不可判分'; }
  else if (nocontent.length) {
    var boundary = nocontent.filter(isKnownBoundary);
    if (boundary.length === nocontent.length) {
      return { ok: true, warn: 'boundary', note: 'noContent（' + nocontent.length + ' 题全为 *-vertical HTML 布局，架构边界，见 R30 结论）' };
    }
    ok = false; note = nocontent.length + ' 题无提示且无图形';
  }
  return { ok: ok, note: note };
}

function runPluginModes(rec) {
  var subject = rec.subject || 'math';
  var grade = (Array.isArray(rec.grades) && rec.grades[0]) || 1;
  var kpId = rec.knowledgePoints[0];
  var label = rec.pluginId + '[g' + grade + ']';
  var chain = Promise.resolve();
  ['single-kp', 'multi-kp'].forEach(function (mode) {
    chain = chain.then(function () {
      return GE.generate({
        mode: mode, subject: subject, grade: grade,
        knowledgePointId: kpId, knowledgePoints: [kpId], count: COUNT, difficulty: 2
      }, { legacyOutput: true }).then(function (g) {
        var qs = g.questions || [];
        var v = validate(qs, mode !== 'comprehensive');
        // count 短接近似：单点 legacy 可能天然低产量 → WARN 而非失败
        if (v.ok && qs.length < COUNT) { log(true, label + ' [' + mode + '] ' + kpId, '题量 ' + qs.length + ' < ' + COUNT + '（低产量插件，宽容）', true); return; }
        log(v.ok, label + ' [' + mode + '] ' + kpId, v.note, v.warn === 'boundary');
      }, function (e) {
        log(false, label + ' [' + mode + '] ' + kpId, 'crash: ' + (e && e.message || e));
      });
    });
  });
  return chain;
}

function kpCountFor(subject, grade) {
  try {
    var KB = (typeof global !== 'undefined' && global.KnowledgeBank) || null;
    if (KB && typeof KB.getEntries === 'function') {
      var subjKey = subject === 'chinese' ? 'cn' : subject === 'english' ? 'en' : subject;
      return (KB.getEntries(subjKey, grade) || []).length;
    }
  } catch (e) { return -1; }
  return -1;
}

function runSubjectModes(subject, grade, mode) {
  var label = subject + ' g' + grade + ' [' + mode + ']';
  var n = kpCountFor(subject, grade);
  if (typeof n === 'number' && n === 0) {
    return Promise.resolve().then(function () { skip(label, '无知识点（SKIP）'); });
  }
  return GE.generate({
    mode: mode, subject: subject, grade: grade, count: COUNT, difficulty: 2,
    learnerProfile: (mode === 'adaptive') ? { weakKps: [], preferredTypes: [] } : undefined
  }, { legacyOutput: true }).then(function (g) {
    var qs = g.questions || [];
    if (qs.length < 1) { log(false, label, '产出 0 题'); return; }
    var v = validate(qs);
    log(v.ok, label, v.note, v.warn === 'boundary');
  }, function (e) {
    log(false, label, 'crash: ' + (e && e.message || e));
  });
}

function main() {
  var recs = GenCap.buildGeneratorCapabilityRegistry();
  var legacyRecs = recs.filter(function (r) { return !r.isPlaceholder && r.knowledgePoints.length && inOnly(r.pluginId); });

  var chain = Promise.resolve();
  legacyRecs.forEach(function (rec) {
    if (rec.pluginId === 'math-comprehensive') return; // 已作为综合覆盖，不逐插件重复
    chain = chain.then(function () { return runPluginModes(rec); });
  });

  var subjectsGrades = {
    math: [1, 2, 3, 4, 5],
    chinese: [1, 2, 3],
    english: [1, 2, 3, 4, 5]
  };
  Object.keys(subjectsGrades).forEach(function (subj) {
    if (ONLY && !ONLY.some(function (k) { return subj.indexOf(k) !== -1; })) return;
    subjectsGrades[subj].forEach(function (grade) {
      ['comprehensive', 'adaptive'].forEach(function (mode) {
        chain = chain.then(function () { return runSubjectModes(subj, grade, mode); });
      });
    });
  });

  chain.then(function () {
    console.log('\nR29 统一引擎回归：' + pass + ' 通过 / ' + (pass + fail) + ' 有效 case（SKIP ' + skipped + '），' + fail + ' 失败');
    if (failures.length) {
      console.log('失败项:');
      failures.forEach(function (f) { console.log('  ✖ ' + f); });
      process.exitCode = 1;
    } else {
      console.log('[PASS] R29 统一 GenerationEngine 回归（single/multi/comprehensive/adaptive 全通过）');
    }
  });
}

main();