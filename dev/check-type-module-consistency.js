#!/usr/bin/env node
/**
 * dev/check-type-module-consistency.js — 题型一致性门禁（知识点驱动生成 / 7 类规范题型）
 *
 * 整改后校验（M 题型模块已去除，改为知识点驱动）：
 *   1) 规范题型集合恰为 7 类：calc/fill/choice/judge/geometry/classify/apply
 *      （来自 question-type-registry，单一事实源）。
 *   2) 历史题型已并入规范 7 类（无独立 oral/open/recognize 规范类型）；
 *      oral→calc、open→apply、recognize→geometry 经 registry 归一闭环。
 *   3) classify 为新增规范类型；competition 为注册模式标签（落点 apply）。
 *   4) 生成链路不再按 moduleId 做题型路由（generator-selector / strategy-engine
 *      不得再出现 `moduleId === 'M7'|'C3'|'C8'|'C9'` 这类题型分支）。
 *   5) practice.html 不得再定义 QT_STD_MODULES 静态过滤表（决策上收，UI 只读）。
 *   6) practice-bridge 暴露大服务层查询（kpVisibleInType / visibleModulesForType /
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
  const Registry = require(path.join(ROOT, 'shared', 'knowledge', 'question-type-registry.js'));
  const practiceSrc = fs.readFileSync(path.join(ROOT, 'practice.html'), 'utf8');
  const bridgeSrc = fs.readFileSync(path.join(ROOT, 'shared', 'bridge', 'practice-bridge.js'), 'utf8');

  const CANON = ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];
  const registryTypes = Registry.all().map((t) => t.id);

  // ---------- 1) 规范题型恰为 7 类 ----------
  const missing = CANON.filter((id) => registryTypes.indexOf(id) === -1);
  const extra = registryTypes.filter((id) => CANON.indexOf(id) === -1);
  record(
    '规范题型恰为 7 类（calc/fill/choice/judge/geometry/classify/apply）',
    missing.length === 0 && extra.length === 0,
    'registry=[' + registryTypes.join('/') + ']' +
      (missing.length ? ' | 缺失:' + missing.join(',') : '') +
      (extra.length ? ' | 多余:' + extra.join(',') : '')
  );

  // ---------- 2) 历史题型已并入规范 7 类 ----------
  const LEGACY = ['oral', 'open', 'recognize'];
  const legacyCanonical = LEGACY.filter((t) => registryTypes.indexOf(t) !== -1);
  const unmappedLegacy = LEGACY.filter((t) => {
    const n = Registry.normalizeQuestionType(t, { allowHeuristic: false });
    return !n || CANON.indexOf(n.id) === -1;
  });
  record(
    '历史题型已并入规范 7 类（oral/open/recognize 非独立规范类型且可归一）',
    legacyCanonical.length === 0 && unmappedLegacy.length === 0,
    '仍作规范类型:' + (legacyCanonical.length ? legacyCanonical.join(',') : '无') +
      (unmappedLegacy.length ? ' | 无法归一:' + unmappedLegacy.join(',') : '')
  );

  // ---------- 3) classify 新增 + competition 为模式标签 ----------
  const classifyOk = Registry.get('classify') != null;
  const compMode = Registry.MODES && Registry.MODES.indexOf('competition') !== -1;
  const compNorm = Registry.normalizeQuestionType('competition', { allowHeuristic: false });
  const compOk = compMode && compNorm && compNorm.id === 'apply';
  record(
    'classify 为新增规范类型 且 competition 为注册模式（落点 apply）',
    classifyOk && compOk,
    'classify=' + (classifyOk ? 'ok' : '缺失') + ' | competition mode=' + (compMode ? 'ok' : '缺失') +
      ' | competition→' + (compNorm ? compNorm.id : '?')
  );

  // ---------- 4) 生成链路无 moduleId 题型路由 ----------
  const selectorSrc = fs.readFileSync(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'), 'utf8');
  const engineSrc = fs.readFileSync(path.join(ROOT, 'shared', 'strategy', 'strategy-engine.js'), 'utf8');
  const MODULE_ID_ROUTING = /moduleId\s*===\s*['"](M7|C3|C8|C9)['"]/;
  const selHit = MODULE_ID_ROUTING.test(selectorSrc);
  const engHit = MODULE_ID_ROUTING.test(engineSrc);
  record(
    '生成链路不按 moduleId 做题型路由（无 moduleId===\'M7\'/\'C3\'/\'C8\'/\'C9\'）',
    !selHit && !engHit,
    'generator-selector=' + (selHit ? '命中' : 'clean') + ' | strategy-engine=' + (engHit ? '命中' : 'clean')
  );

  // ---------- 5) practice.html 不再定义 QT_STD_MODULES ----------
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

  // ---------- 6) practice-bridge 暴露大服务层查询 ----------
  const bridgeExposes = ['kpVisibleInType', 'visibleModulesForType', 'allocateKpRatio'].every((fn) => {
    return new RegExp(fn + '\\s*:').test(bridgeSrc);
  });
  record(
    'practice-bridge 暴露大服务层查询（kpVisibleInType/visibleModulesForType/allocateKpRatio）',
    bridgeExposes,
    bridgeExposes ? '三查询已暴露' : '存在缺失（UI 只读入口不完整）'
  );

  // ---------- 汇总 ----------
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  console.log('==== 题型一致性门禁（check-type-module-consistency） ====');
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
