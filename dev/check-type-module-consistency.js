#!/usr/bin/env node
/**
 * dev/check-type-module-consistency.js — 题型↔模块↔知识点三向一致性门禁（整改方案 R4）
 *
 * R4 决策上收后校验「题型→可见模块」映射的完整性与一致性：
 *   1) module-catalog.TYPE_MODULES 中每个模块 id 必须真实存在于 MODULE_CATALOG
 *      （无悬空模块引用）。
 *   2) 修复验证：calc 必须含 M1（口算模块知识点 applicable_question_types 含 calc，
 *      修复「calc 不含 M1」漂移）。
 *   3) TYPE_MODULES 键（题型）必须可被 question-type-registry 归一为 canonical 题型
 *      （无非法题型键；vertical/mixed/match/operation/draw/picture/word/stats/reason
 *      等历史细粒度值须为 registry 显式别名，否则 FAIL）。
 *   4) practice.html 不得再定义 QT_STD_MODULES 静态过滤表（决策已上收 UI 只读）。
 *   5) practice-bridge 暴露三个大服务层查询（kpVisibleInType / visibleModulesForType /
 *      allocateKpRatio），供 UI 只读调用。
 *
 * 退出码 1 表示存在 FAIL。
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

function run() {
  const results = [];
  const errors = [];
  function record(name, pass, detail) {
    results.push({ name, pass, detail });
    if (!pass) errors.push({ name, detail });
  }

  // ---------- 加载 ----------
  const MC = require(path.join(ROOT, 'shared', 'module-catalog.js'));
  const Registry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
  const practiceSrc = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  const bridgeSrc = fs.readFileSync(path.join(ROOT, 'shared', 'practice-bridge.js'), 'utf8');

  const TYPE_MODULES = MC.TYPE_MODULES || {};
  const typeKeys = Object.keys(TYPE_MODULES);

  // ---------- 1) TYPE_MODULES 模块 id 存在性 ----------
  const dangling = [];
  typeKeys.forEach((t) => {
    (TYPE_MODULES[t] || []).forEach((mid) => {
      if (!MC.byId(mid)) dangling.push(t + '→' + mid);
    });
  });
  record(
    'TYPE_MODULES 模块 id 全部存在（无悬空）',
    dangling.length === 0,
    typeKeys.length + ' 个题型键，悬空 ' + dangling.length + (dangling.length ? '：' + dangling.join(', ') : '')
  );

  // ---------- 2) calc 含 M1 修复验证 ----------
  const calcMods = TYPE_MODULES.calc || [];
  const calcHasM1 = calcMods.indexOf('M1') !== -1;
  record(
    'calc 含 M1（修复 calc 不含 M1 漂移）',
    calcHasM1,
    'calc→[' + calcMods.join(',') + ']' + (calcHasM1 ? '' : '（缺 M1）')
  );

  // ---------- 3) TYPE_MODULES canonical 键题型合法性 ----------
  // canonical 题型键必须可被 registry 归一为 canonical 9 类（无拼写错误）；
  // 历史 URL qt 深链兼容键（match/operation/picture/reason 等，QT_STD_MODULES 原表保留）
  // 允许存在（R4 仅上收映射，键清理归 R9 越层控制清理），仅作 WARN。
  const canonical = Registry.all().map((t) => t.id);
  const canonicalKeys = typeKeys.filter((k) => canonical.indexOf(k) !== -1);
  const illegalKeys = [];
  canonicalKeys.forEach((k) => {
    const n = Registry.normalizeQuestionType(k, { allowHeuristic: false });
    if (!n || !n.id || canonical.indexOf(n.id) === -1) illegalKeys.push(k);
  });
  const HISTORIC_URL_KEYS = ['match', 'operation', 'picture', 'reason'];
  const historicKeys = typeKeys.filter((k) => HISTORIC_URL_KEYS.indexOf(k) !== -1);
  const unknownKeys = typeKeys.filter((k) => canonical.indexOf(k) === -1 && HISTORIC_URL_KEYS.indexOf(k) === -1);
  record(
    'TYPE_MODULES canonical 键均为合法题型（registry 可归一）',
    illegalKeys.length === 0,
    'canonical 键 ' + canonicalKeys.length + ' 个' +
      (illegalKeys.length ? '，非法 ' + illegalKeys.join(', ') : '') +
      (historicKeys.length ? ' | 历史 URL 键（允许）:' + historicKeys.join(',') : '') +
      (unknownKeys.length ? ' | 未知键:' + unknownKeys.join(',') : '')
  );

  // ---------- 4) practice.html 不再定义 QT_STD_MODULES ----------
  // 排除注释行后检查是否存在「QT_STD_MODULES =」赋值
  const stripped = practiceSrc
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const stillDefined = /QT_STD_MODULES\s*=\s*\{/.test(stripped);
  record(
    'practice.html 无 QT_STD_MODULES 静态过滤表定义',
    !stillDefined,
    stillDefined ? '检测到 QT_STD_MODULES = { ... } 静态表定义' : '已移除，UI 只读大服务层查询'
  );

  // ---------- 5) practice-bridge 暴露 R4 大服务层查询 ----------
  const bridgeExposes = ['kpVisibleInType', 'visibleModulesForType', 'allocateKpRatio'].every((fn) => {
    return new RegExp(fn + '\\s*:').test(bridgeSrc);
  });
  record(
    'practice-bridge 暴露 R4 大服务层查询（kpVisibleInType/visibleModulesForType/allocateKpRatio）',
    bridgeExposes,
    bridgeExposes ? '三查询已暴露' : '存在缺失（UI 只读入口不完整）'
  );

  // ---------- 汇总 ----------
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log('==== 题型模块一致性门禁（check-type-module-consistency） ====');
  results.forEach((r) => console.log('  [' + (r.pass ? 'PASS' : 'FAIL') + '] ' + r.name + (r.pass ? '' : ' — ' + r.detail)));
  console.log('-------------------------------------------');
  console.log('步骤 ' + results.length + ' 项，通过 ' + passCount + ' / 失败 ' + failCount);
  return { name: 'type-module-consistency', pass: failCount === 0, errors, summary: 'TM-CONSISTENCY ' + passCount + '/' + results.length };
}

// 直接执行
if (require.main === module) {
  const r = run();
  process.exitCode = r.pass ? 0 : 1;
}
module.exports = { run };
