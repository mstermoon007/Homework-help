#!/usr/bin/env node
/**
 * shared/generator/migration-switch.js — M4-R17 迁移切换清单（声明式）
 *
 * M4-R17 第一批迁移：math-oral 的 12 个高重复纯口算 KP 已通过逐 KP 全量
 * Adapter 对照（FULL-EQ，dev/check-generator-migration.js 门禁）。
 * 本模块声明这些 KP 的切换（knowledgePoint → native），供引擎/调用方在
 * 运行时 apply() 一次性生效；其余 KP（mixed/remainder/relation/多位数）
 * 无纯算术语义，保持 hybrid → legacy 优先，不做 native 切换。
 *
 * 注意：切换粒度必须是「知识点」，不能是「插件」——
 * 若 override('plugin','math-oral','native') 会把 N/A KP 也甩给 native
 * 的默认混合生成器，破坏 remainder/mixed/subType 语义。
 */
'use strict';

var Mode = require('./generator-mode.js');

// M4-R17 迁移批次：已 FULL-EQ 的 math-oral 纯口算 KP（12 个）
var MIGRATED_KPS = [
  'math-g1-m1-addsub-5',
  'math-g1-m1-addsub-10',
  'math-g1-m1-carry-add-20',
  'math-g1-m1-retreat-sub-20',
  'math-g1-m1-addsub-100',
  'math-g1-m1-two-digit-add',
  'math-g2-m1-add-100',
  'math-g2-m1-sub-100',
  'math-g2-m1-mult-table',
  'math-g2-m1-div-table',
  'math-g2-m1-addsub-1000',
  'math-g3-m1-g3-add-sub-wan'
];

// M4-R18 迁移批次：复杂运算（链式/括号/逆向）plan-driven KP（9 个）。
// 由 generator:complex-calc 服务，经 complex 语义注入 + per-KP native 切换生效。
var COMPLEX_KPS = [
  'math-g1-m1-mixed-chain',
  'math-g2-m1-mixed-addsub',
  'math-g2-m1-mixed-multdiv',
  'math-g2-m3-chain-addsub',
  'math-g2-m3-multdiv-mixed',
  'math-g2-m3-mixed-no-bracket',
  'math-g2-m3-mixed-bracket',
  'math-g1-m4-num-fill-unknown',
  'math-g2-m3-fill-operator'
];

// M4-R26 迁移批次：简便计算（凑整）家族——math-g4-mixed 2 个 KP（add-law/mul-law）。
// 由 arithmetic 生成器经 SPECIAL_ORAL_PROFILE kind 分派（step=2 多步凑整），FULL-EQ 全绿。
var R26_LAW_KPS = [
  'math-g4-m3-g4-mix-addlaw',
  'math-g4-m3-g4-mix-mullaw'
];

var ALL_MIGRATED = MIGRATED_KPS.concat(COMPLEX_KPS, R26_LAW_KPS);

function isMigrated(kpId) {
  return ALL_MIGRATED.indexOf(kpId) !== -1;
}

function apply() {
  ALL_MIGRATED.forEach(function (kpId) {
    Mode.override('knowledgePoint', kpId, 'native');
  });
  return ALL_MIGRATED.length;
}

module.exports = {
  MIGRATED_KPS: MIGRATED_KPS,
  COMPLEX_KPS: COMPLEX_KPS,
  R26_LAW_KPS: R26_LAW_KPS,
  ALL_MIGRATED: ALL_MIGRATED,
  isMigrated: isMigrated,
  apply: apply
};