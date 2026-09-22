#!/usr/bin/env node
/**
 * dev/p28/check-legacy-matrix.js — P28-46 Legacy 治理矩阵
 *
 * 审计所有 legacy / compat / bridge / fallback / deprecated 符号：
 *   file / symbol / 存在原因 / 调用者 / 删除条件 / decision
 *
 * 规则：
 *   - 没有存在理由 → DELETE
 *   - 禁止"以后可能用到，所以先留着"
 *   - 有生产/测试调用者 → KEEP（注明理由）
 */

'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..', '..');

var CANDIDATES = [
  // ── 1. practice-result.js: fromLegacy ──
  {
    file: 'shared/learner/practice-result.js',
    symbol: 'fromLegacy()',
    reason: '从旧格式 question 对象构造 PracticeResult（pre-SemanticQuestion 时代）',
    callers: { prod: 0, test: 1, dev: 0, bundle: 1 },
    deleteCondition: '测试迁移到 fromSemanticQuestion 后可删；当前测试仍依赖',
    decision: 'KEEP',
    note: 'tests/generator/p27-12-knowledge-practice-state.test.js 调用 fromLegacy 验证 semanticTarget 传递'
  },
  // ── 4. learner-model.js: recomputeMasteryFallback ──
  {
    file: 'shared/learner/learner-model.js',
    symbol: 'recomputeMasteryFallback()',
    reason: '当 mastery 字段缺失时从 answered/correct 重算（防止旧数据无 mastery 字段）',
    callers: { prod: 1, test: 0, dev: 0, bundle: 1 },
    deleteCondition: 'KBL 数据全部补齐 mastery 字段后可删；当前为生产安全网',
    decision: 'KEEP',
    note: '内部调用（line 127）：data.mastery 缺失时 fallback 重算。生产路径安全网'
  },
  // ── 5. adaptive-strategy.js: legacyDelta / legacyEffective ──
  {
    file: 'shared/strategy/adaptive-strategy.js',
    symbol: 'legacyDelta + legacyEffective',
    reason: 'legacy/shadow 自适应模式下使用旧 delta 计算 effectiveDifficulty',
    callers: { prod: 1, test: 1, dev: 0, bundle: 1 },
    deleteCondition: 'adaptiveMode 不再支持 legacy/shadow 模式后可删；当前为活跃模式之一',
    decision: 'KEEP',
    note: '生产路径：mode==="legacy"||"shadow" 时 effectiveDifficulty=legacyEffective；测试：adaptive-strategy.test.js'
  },
  // ── 6. knowledge-compat.js: KnowledgeCompat ──
  {
    file: 'shared/engine/knowledge-compat.js',
    symbol: 'KnowledgePointCompat + KnowledgeOntologyCompat + KnowledgeCompat',
    reason: 'KBL 运行时兼容层：KnowledgePoint → KP/Ontology 适配（StrategyEngine 依赖）',
    callers: { prod: 3, test: 0, dev: 3, bundle: 1 },
    deleteCondition: 'KBL schema 统一后可删；当前为生产依赖',
    decision: 'KEEP',
    note: '调用者：comprehensive-strategy.js / sw.js / _bundle-env.js / check-kbl-uniqueness.js / check-knowledge-access.js / build-strategy-bundle.js'
  },
  // ── 7. question-type-registry.js: LEGACY_DISPLAY_NAMES ──
  {
    file: 'shared/knowledge/question-type-registry.js',
    symbol: 'LEGACY_DISPLAY_NAMES',
    reason: '历史细粒度题型 token（oral/recognize/open 等）→ 展示名映射',
    callers: { prod: 1, test: 0, dev: 0, bundle: 1 },
    deleteCondition: '历史 token 全部从 mappings 消除后可删；当前 normalizeQuestionType 仍承载',
    decision: 'KEEP',
    note: 'practice-bridge.js 调用 displayName() 间接使用 LEGACY_DISPLAY_NAMES；P28-LEGACY-ISOLATION 确认生产代码 0 命中旧 token'
  },
  // ── 8. practice-session.js: legacy variable ──
  {
    file: 'shared/engine/practice-session.js',
    symbol: 'var legacy = RenderFormat.toRenderableQuestions(g.questions)',
    reason: '唯一 Legacy Adapter = render-format.js，将 SemanticQuestion 转为渲染格式',
    callers: { prod: 1, test: 0, dev: 0, bundle: 1 },
    deleteCondition: '不可删——这是活跃生产路径（唯一渲染适配器）',
    decision: 'KEEP',
    note: '变量名 legacy 但为活跃代码；render-format.js 是冻结的唯一 Legacy Adapter'
  },
  // ── 9. retry-loop.js: legacy 注释 ──
  {
    file: 'shared/generator/retry-loop.js',
    symbol: '// legacy 生成器可能不产 seed',
    reason: '注释说明 retry-loop 对不产 seed 的旧生成器的兼容处理',
    callers: { prod: 'N/A (comment)', test: 0, dev: 0, bundle: 'N/A' },
    deleteCondition: '注释，非代码',
    decision: 'KEEP',
    note: '仅注释，描述代码行为'
  },
  // ── 10. arithmetic-core.js: fallback 注释 ──
  {
    file: 'shared/generator/core/arithmetic-core.js',
    symbol: '// fallback: (2 + 3) * 4 = 20',
    reason: '注释描述 fallback 生成路径的示例',
    callers: { prod: 'N/A (comment)', test: 0, dev: 0, bundle: 'N/A' },
    deleteCondition: '注释，非代码',
    decision: 'KEEP',
    note: '仅注释，描述代码行为'
  }
];

// ── 校验：DELETE 候选的文件仍存在（待删除操作） ──
var DELETE_FAILS = [];
CANDIDATES.filter(function (c) { return c.decision === 'DELETE'; }).forEach(function (c) {
  var full = path.join(ROOT, c.file);
  if (!fs.existsSync(full)) {
    DELETE_FAILS.push(c.file + ' — 标记 DELETE 但文件不存在');
  }
});

// ── 输出 ──
var jsonMode = process.argv.indexOf('--json') !== -1;

if (jsonMode) {
  console.log(JSON.stringify({
    candidates: CANDIDATES,
    summary: {
      total: CANDIDATES.length,
      delete: CANDIDATES.filter(function (c) { return c.decision === 'DELETE'; }).length,
      keep: CANDIDATES.filter(function (c) { return c.decision === 'KEEP'; }).length
    },
    fails: DELETE_FAILS
  }, null, 2));
} else {
  console.log('=== P28-46 LEGACY-MATRIX ===');
  console.log('');
  CANDIDATES.forEach(function (c, i) {
    console.log('[' + (i + 1) + '] ' + c.file);
    console.log('    symbol:     ' + c.symbol);
    console.log('    reason:     ' + c.reason);
    console.log('    callers:    prod=' + c.callers.prod + ' test=' + c.callers.test + ' dev=' + c.callers.dev + ' bundle=' + c.callers.bundle);
    console.log('    del-cond:   ' + c.deleteCondition);
    console.log('    decision:   ' + c.decision);
    console.log('    note:       ' + c.note);
    console.log('');
  });

  var deletes = CANDIDATES.filter(function (c) { return c.decision === 'DELETE'; }).length;
  var keeps = CANDIDATES.filter(function (c) { return c.decision === 'KEEP'; }).length;

  console.log('--- Summary ---');
  console.log('Total: ' + CANDIDATES.length + ' | DELETE: ' + deletes + ' | KEEP: ' + keeps);
  console.log('');

  if (DELETE_FAILS.length > 0) {
    console.log('FAIL: ' + DELETE_FAILS.length + ' issue(s)');
    DELETE_FAILS.forEach(function (f) { console.log('  ✗ ' + f); });
    process.exit(1);
  } else {
    console.log('PASS: All ' + CANDIDATES.length + ' candidates verified.');
  }
}
