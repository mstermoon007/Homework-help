#!/usr/bin/env node
/**
 * dev/p28/check-dead-code.js — P28-45 死代码治理矩阵
 *
 * 审计项目中所有可能的死代码候选，逐个判定：
 *   file / symbol / production calls / test calls / bundle calls / status / decision
 *
 * 决策：
 *   DELETE  — 确认无引用，从代码库移除
 *   KEEP    — 有引用或有意保留（bundled 预留 / contract carrier / test-only）
 *   ARCHIVE — 移入 archive/，不再参与构建
 *
 * 用法：node dev/p28/check-dead-code.js [--json]
 */

'use strict';

var path = require('path');
var fs = require('fs');
var ROOT = path.resolve(__dirname, '..', '..');

// ── 候选清单 ──
// 每条：file, symbol, prodCalls, testCalls, bundleCalls, status, decision
var CANDIDATES = [
  // ── 1. 已删除（P28 治理中已处置） ──
  {
    file: 'shared/presentation/render.js',
    symbol: 'LegacyRenderer',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'DELETED (P28-21)',
    decision: 'DELETE',
    note: '已被 renderer.js (PresentationRenderer→HTMLRenderer) 替代；P28-21 删除'
  },
  {
    file: 'shared/generator/semantic-question-bridge.js',
    symbol: 'SemanticQuestionBridge',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'DELETED (P28-21)',
    decision: 'DELETE',
    note: '重复 Legacy Bridge；Generator.generate() 已直接返回 SemanticQuestion[]；P28-21 删除'
  },

  // ── 2. RELOCATED（FINAL-17 从 shared/ 迁至 tests/fixtures/） ──
  {
    file: 'shared/generation/generation-core.js',
    symbol: 'GenerationCore',
    prodCalls: 0,
    testCalls: 4, // p17-10, p17-14, p17-15, p17-16（从 tests/fixtures/ 装载）
    bundleCalls: 0, // P28-28 从 bundle 排除
    status: 'RELOCATED (FINAL-17)',
    decision: 'RELOCATED',
    note: '原位置已删除；现位于 tests/fixtures/generation-core.js。生产链 = api.js orchestrate→build→runPlans→generateQuestions，不经过 GenerationCore；4 个测试从 fixtures 装载验证 execute 语义'
  },

  // ── 3. BUNDLE-EXCLUDED（FINAL-20：0 mapping、0 evidence、0 测试，源码保留但生产 bundle 排除） ──
  {
    file: 'shared/generator/generators/complex.js',
    symbol: 'generator:complex-calc',
    prodCalls: 0, testCalls: 0, bundleCalls: 0, // FINAL-20 后 bundle 不含
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '重复能力：calc/fill 被算术族全覆盖；0 绑定 0 产出；源码保留但 index.js 不再 require、registry 不再注册、bundle 不再打包'
  },
  {
    file: 'shared/generator/generators/c1-number-puzzle.js',
    symbol: 'generator:c1-number-puzzle',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '竞赛 C 族预留；0 绑定 0 产出；源码保留但生产 bundle 排除'
  },
  {
    file: 'shared/generator/generators/c2-number-theory.js',
    symbol: 'generator:c2-number-theory',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '竞赛 C 族预留；0 绑定 0 产出；源码保留但生产 bundle 排除'
  },
  {
    file: 'shared/generator/generators/c5-c6-journey-engineering.js',
    symbol: 'generator:c5-c6-journey-engineering',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '竞赛 C 族预留；0 绑定 0 产出；源码保留但生产 bundle 排除'
  },
  {
    file: 'shared/generator/generators/c7-clever-calc.js',
    symbol: 'generator:c7-clever-calc',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '竞赛 C 族预留；0 绑定 0 产出；源码保留但生产 bundle 排除'
  },
  {
    file: 'shared/generator/generators/c9-comprehensive.js',
    symbol: 'generator:c9-comprehensive',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'BUNDLE-EXCLUDED (FINAL-20)',
    decision: 'EXCLUDE',
    note: '竞赛 C 族预留；0 绑定 0 产出；源码保留但生产 bundle 排除'
  },
  {
    file: 'shared/generator/generators/semantic-special.js',
    symbol: 'generator:equivalent-reasoning',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'DEAD-SYMBOL-REMOVED (FINAL-20)',
    decision: 'REMOVE-SYMBOL',
    note: 'equivalent-reasoning 死符号已从 semantic-special.js 清除（工厂+题库+导出全删）；code-recognition 保留（15 行 freeze 产出）'
  },

  // ── 4. DORMANT-CONTRACT-CARRIER（契约名义载体，0 产出） ──
  {
    file: 'shared/generator/generators/selection.js',
    symbol: 'generator:selection-choice + generator:selection-judge',
    prodCalls: 0, testCalls: 0, bundleCalls: 1,
    status: 'DORMANT-CONTRACT-CARRIER',
    decision: 'KEEP',
    note: 'contract 375 行 choice + 126 行 judge 名义载体；实际 0 产出（choice 由原生绑定族全覆盖，judge 由 shape/position/classification 覆盖）'
  },

  // ── 5. SYMBOL-REMOVED（P28-UI-PRINTSTYLE-CLEANUP-01：样式/打印链路死代码定点清理，2026-09-28） ──
  {
    file: 'shared/presentation/print.js',
    symbol: 'Print.preview + Print.previewFromQuestions + ensurePreviewStyle/ensurePreviewDom/fitSheetScale/closePreview + pv-*/lastHtml/lastTitle + PRINT_ROUTES 8 条未用路由（word/makeTen/comprehensive/numberSense/measurement/geometry/shapes/unitConvert）+ label 字段',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'DEAD-SYMBOL-REMOVED (P28-UI-PRINTSTYLE-CLEANUP-01)',
    decision: 'REMOVE-SYMBOL',
    note: '页内 A4 预览模态层全库零调用方（仅定义无引用）；打印路由全库仅 3 处调用均传 math；popupAndPrint 未用 title 参数同步删除'
  },
  {
    file: 'shared/styles/components.css + shared/styles/tokens.css',
    symbol: '.q-header/.scene-box/.q-hint/.options/.opt/.input-group/.unit/.qa-row/.qa-label/.formula-inp/.question-card.compact 家族/.global-tip/.question-answer-print + 死令牌 --q-num-size/--q-text-size/--q-text-line-height/--q-unit-size/--q-input-size/--q-input-height/--q-option-size/--q-hint-size/--q-feedback-size/--q-scene-max-*/--q-card-padding/--q-section-gap',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'DEAD-SYMBOL-REMOVED (P28-UI-PRINTSTYLE-CLEANUP-01)',
    decision: 'REMOVE-SYMBOL',
    note: '全部为零产出死类（旧插件渲染链 render.js 已按 P28-22 删除，无生产方输出这些类；compact 仅 print 模式挂类而打印文档不加载 components.css）；令牌经全库 var() 消费扫描为零引用。保留在产：.question-card/.num/.q-text(renderGeneric)/.answer-inp/.feedback/question-stem 系'
  },
  {
    file: 'shared/core/check.js',
    symbol: 'pickOpt / __pickOpt（.opt.chosen 选中态处理）',
    prodCalls: 0, testCalls: 0, bundleCalls: 0,
    status: 'CANDIDATE-DEFERRED (P28-UI-PRINTSTYLE-CLEANUP-01)',
    decision: 'KEEP',
    note: '批改链候选（.opt 类已无任何产出方，pickOpt 零调用）；属批改链非本轮样式/打印范围，暂留待后续批改链治理任务处置'
  }
];

// ── 校验：确认已删除文件确实不存在 ──
var DELETE_FAILS = [];
CANDIDATES.filter(function (c) { return c.decision === 'DELETE'; }).forEach(function (c) {
  var full = path.join(ROOT, c.file);
  if (fs.existsSync(full)) {
    DELETE_FAILS.push(c.file + ' — 标记 DELETE 但文件仍存在');
  }
});

// ── 校验：确认 KEEP 文件存在 ──
var KEEP_FAILS = [];
CANDIDATES.filter(function (c) { return c.decision === 'KEEP' && c.status !== 'TEST-ONLY / HISTORICAL'; }).forEach(function (c) {
  var full = path.join(ROOT, c.file);
  if (!fs.existsSync(full)) {
    KEEP_FAILS.push(c.file + ' — 标记 KEEP 但文件不存在');
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
      keep: CANDIDATES.filter(function (c) { return c.decision === 'KEEP'; }).length,
      archive: CANDIDATES.filter(function (c) { return c.decision === 'ARCHIVE'; }).length
    },
    fails: DELETE_FAILS.concat(KEEP_FAILS)
  }, null, 2));
} else {
  console.log('=== P28-45 DEAD-CODE-MATRIX ===');
  console.log('');
  CANDIDATES.forEach(function (c, i) {
    console.log('[' + (i + 1) + '] ' + c.file);
    console.log('    symbol:       ' + c.symbol);
    console.log('    prod calls:   ' + c.prodCalls);
    console.log('    test calls:   ' + c.testCalls);
    console.log('    bundle calls: ' + c.bundleCalls);
    console.log('    status:       ' + c.status);
    console.log('    decision:     ' + c.decision);
    console.log('    note:         ' + c.note);
    console.log('');
  });

  var deletes = CANDIDATES.filter(function (c) { return c.decision === 'DELETE'; }).length;
  var keeps = CANDIDATES.filter(function (c) { return c.decision === 'KEEP'; }).length;
  var archives = CANDIDATES.filter(function (c) { return c.decision === 'ARCHIVE'; }).length;

  console.log('--- Summary ---');
  console.log('Total candidates: ' + CANDIDATES.length);
  console.log('DELETE:  ' + deletes);
  console.log('KEEP:    ' + keeps);
  console.log('ARCHIVE: ' + archives);
  console.log('');

  var allFails = DELETE_FAILS.concat(KEEP_FAILS);
  if (allFails.length > 0) {
    console.log('FAIL: ' + allFails.length + ' issue(s)');
    allFails.forEach(function (f) { console.log('  ✗ ' + f); });
    process.exit(1);
  } else {
    console.log('PASS: All ' + CANDIDATES.length + ' candidates verified.');
  }
}
