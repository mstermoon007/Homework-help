#!/usr/bin/env node
/**
 * dev/check-generator-traceability.js — M4-R23 Generator 版本化 / 可追溯性 Gate
 *
 * 断言：经 Selector.instantiate().generate() 产出的每个 SemanticQuestion 都带
 *   metadata.generator        ← 来源 Generator id
 *   metadata.generatorVersion ← 语义化版本（x.y.z）
 *   metadata.seed             ← 种子（可复现/追溯）
 *
 * 覆盖原生（core）与 legacy 两条路径；legacy 分别验证同步与 Promise 分支。
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var Selector = require(path.join(ROOT, 'shared', 'generator', 'generator-selector.js'));
var Mode = Selector.Mode;
var Switch = require(path.join(ROOT, 'shared', 'generator', 'migration-switch.js'));
var GenCap = require(path.join(ROOT, 'shared', 'generator-capability-registry.js'));
var loader = require(path.join(ROOT, 'dev', 'plugin-loader.js'));

var errors = [];

function checkMeta(sqs, label) {
  if (!Array.isArray(sqs) || sqs.length === 0) { errors.push(label + ': 无题目产出'); return; }
  sqs.forEach(function (sq, i) {
    var m = sq && sq.metadata;
    if (!m) { errors.push(label + '[' + i + ']: 缺 metadata'); return; }
    if (!m.generator) errors.push(label + '[' + i + ']: 缺 metadata.generator');
    if (!m.generatorVersion || !/^\d+\.\d+\.\d+$/.test(m.generatorVersion)) {
      errors.push(label + '[' + i + ']: metadata.generatorVersion 非法 (' + m.generatorVersion + ')');
    }
    if (m.seed == null) errors.push(label + '[' + i + ']: 缺 metadata.seed');
  });
}

function run() {
  Mode.clearAll();

  // 1) 原生路径：已迁移 KP → core
  Mode.clearAll();
  Switch.apply();
  var natSel = Selector.selectGenerator({ knowledgePointId: 'math-g2-m1-mult-table', questionTypeId: 'calc', difficulty: 3 });
  if (!natSel.record || natSel.record.scope !== 'core') { errors.push('原生路径选择非 core'); }
  else {
    var natGen = Selector.instantiate(natSel);
    var natSqs = natGen.generate({ knowledgePointId: 'math-g2-m1-mult-table', questionTypeId: 'calc', difficulty: 3, constraints: { numberRange: { min: 1, max: 9 } } }, { seed: 'trc-native' });
    if (natSqs && natSqs.then) natSqs = null;
    checkMeta(natSqs, 'native');
  }

  // 2) legacy 同步路径：math-oral 未迁移 KP
  var oralKps = GenCap.buildGeneratorCapabilityRegistry().find(function (r) { return r.pluginId === 'math-oral'; }).knowledgePoints;
  var nonMig = oralKps.filter(function (k) { return !Switch.isMigrated(k); })[0];
  var plugin = loader.loadPlugin('math-oral').plugin;
  var legSel = Selector.selectGenerator({ knowledgePointId: nonMig, questionTypeId: 'calc', difficulty: 3 });
  var legGen = Selector.instantiate(legSel, plugin);
  var legSqs = legGen.generate({ knowledgePointId: nonMig, questionTypeId: 'calc', difficulty: 3, constraints: { numberRange: { min: 1, max: 5 } } }, { seed: 'trc-legacy' });
  legSqs = legSqs && legSqs.then ? null : legSqs;
  checkMeta(legSqs, 'legacy-sync');

  // 3) Promise 分支：构造返回 Promise 的原生生成器
  {
    var selP = { record: { id: 'generator:arithmetic-addition', scope: 'core', version: 3, capabilities: ['calc'], knowledgePoints: ['x'] } };
    var genP = { generate: function () { return Promise.resolve([{ prompt: '2+3', answer: '5', seed: 'p:0' }]); } };
    var prev = require.cache[require.resolve(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'))];
    var patched = { get: function () { return genP; } };
    require.cache[require.resolve(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'))] = { exports: patched, loaded: true };
    var wrappedP = Selector.instantiate(selP);
    require.cache[require.resolve(path.join(ROOT, 'shared', 'generator', 'generators', 'index.js'))] = prev;
    return wrappedP.generate({ knowledgePointId: 'x', questionTypeId: 'calc', difficulty: 3 }, { seed: 'p-seed' }).then(function (sqs) {
      checkMeta(sqs, 'promise');
      finish();
    });
  }
}

function finish() {
  if (!errors.length) {
    console.log('[PASS] M4-R23 Generator 可追溯性：native/legacy-sync/promise 均带 metadata.generator/.generatorVersion/.seed');
    process.exitCode = 0;
  } else {
    errors.forEach(function (e) { console.log('  [ERR] ' + e); });
    console.log('[FAIL] M4-R23 Generator 可追溯性');
    process.exitCode = 1;
  }
}

run();
