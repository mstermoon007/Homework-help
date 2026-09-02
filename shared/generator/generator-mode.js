'use strict';

/**
 * shared/generator/generator-mode.js — M4-R14 Generator Feature Flag (P2 Task 2.1 简化)
 *
 * 双轨模式（legacy 已移除，hybrid scope 用于迁移追踪时记录 legacy 情况）：
 *   hybrid —— 旧插件和核心 Generator 都作为候选，选优
 *   native —— 只跑核心 Generator（无候选回退旧插件）
 *
 * 覆盖粒度（仅 2 级）：
 *   ① 全局        setGlobal('hybrid')
 *   ② 单知识点    override('knowledgePoint', 'math-g1-m1-addsub-5', 'native')
 *
 * 解析：resolve(plan) → 有效模式。禁 UI 直接选择 Generator。
 */
var MODES = ['hybrid', 'native'];
var SCOPES = ['knowledgePoint'];

var globalMode = 'native';
var overrides = { knowledgePoint: {} };

function isValidMode(mode) { return MODES.indexOf(mode) !== -1; }
function isValidScope(scope) { return SCOPES.indexOf(scope) !== -1; }

function setGlobal(mode) {
  if (!isValidMode(mode)) throw new Error('GeneratorMode: 非法 generatorMode="' + mode + '"（合法值: ' + MODES.join('/') + '）');
  globalMode = mode;
  return globalMode;
}

function getGlobal() { return globalMode; }

function override(scope, key, mode) {
  if (!isValidScope(scope)) throw new Error('GeneratorMode: 非法 scope="' + scope + '"（合法值: ' + SCOPES.join('/') + '）');
  if (key == null || key === '') throw new Error('GeneratorMode: ' + scope + ' 覆盖缺少 key');
  if (!isValidMode(mode)) throw new Error('GeneratorMode: 非法 mode="' + mode + '"');
  overrides[scope][String(key)] = mode;
  return mode;
}

function clearOverride(scope, key) {
  if (!isValidScope(scope)) return;
  if (key == null) { overrides[scope] = {}; return; }
  delete overrides[scope][String(key)];
}

function clearAll() {
  globalMode = 'native';
  SCOPES.forEach(function (s) { overrides[s] = {}; });
}

function dump() {
  return { generatorMode: globalMode, knowledgePointOverrides: Object.assign({}, overrides.knowledgePoint) };
}

function resolve(plan) {
  plan = plan || {};
  if (plan.knowledgePointId && overrides.knowledgePoint[plan.knowledgePointId]) return overrides.knowledgePoint[plan.knowledgePointId];
  return globalMode;
}

module.exports = {
  MODES: MODES,
  SCOPES: SCOPES,
  setGlobal: setGlobal,
  getGlobal: getGlobal,
  override: override,
  clearOverride: clearOverride,
  clearAll: clearAll,
  dump: dump,
  resolve: resolve
};
