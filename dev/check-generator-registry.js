#!/usr/bin/env node
/**
 * dev/check-generator-registry.js — M4-R03 Generator Registry Gate
 *
 * 校验：
 *   1) 无重复 Generator ID
 *   2) 无非法 capability（必须来自 QuestionType Registry）
 *   3) 无孤立 Generator（每记录须有 >=1 capability 且 >=1 存在知识点的 KP）
 *   4) 无知识点指向不存在 Generator（KB 中带 pluginId 的 KP 必须有对应 Generator 记录）
 *   5) 禁止保存执行函数源码（全部记录 JSON 可序列化）
 *   6) KnowledgePoint → Capability → Generator 查询关系可用
 */
'use strict';

var path = require('path');
var ROOT = path.join(__dirname, '..');
var GenRegistry = require(path.join(ROOT, 'shared', 'generator', 'generator-registry.js'));
var QuestionRegistry = require(path.join(ROOT, 'shared', 'question-type-registry.js'));
var KnowledgeBank = require(path.join(ROOT, 'shared', 'knowledge-bank.js'));
var Ontology = require(path.join(ROOT, 'shared', 'knowledge-ontology.js'));
var KnowledgePoint = require(path.join(ROOT, 'shared', 'knowledge-point.js'));

function run() {
  var errors = [];
  var warnings = [];
  var records = GenRegistry.all();

  // 1) 无重复 Generator ID
  var seen = {};
  records.forEach(function (r) {
    if (seen[r.id]) errors.push('重复 Generator ID: ' + r.id);
    seen[r.id] = true;
  });

  // 5) 禁止执行函数源码：JSON 可序列化
  try {
    var roundTrip = JSON.parse(JSON.stringify(records));
    if (JSON.stringify(roundTrip) !== JSON.stringify(records)) {
      errors.push('Registry 存在不可 JSON 序列化的值（疑似执行函数）');
    }
  } catch (e) {
    errors.push('Registry JSON 序列化失败: ' + e.message);
  }
  records.forEach(function (r) {
    for (var k in r) {
      if (typeof r[k] === 'function') errors.push(r.id + ' :: 字段 ' + k + ' 是函数（禁止保存执行函数）');
    }
  });

  // 2) 无非法 capability
  records.forEach(function (r) {
    r.capabilities.forEach(function (c) {
      if (!QuestionRegistry.has(c)) errors.push(r.id + ' :: 非法 capability: ' + c);
    });
    r.questionTypes.forEach(function (c) {
      if (!QuestionRegistry.has(c)) errors.push(r.id + ' :: 非法 questionType: ' + c);
    });
  });

  // 3) 无孤立 Generator（capability >= 1 且 KP 均存在）
  var kbIds = {};
  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) { kbIds[kp.id] = true; });
      });
    });
  });
  records.forEach(function (r) {
    if (r.capabilities.length === 0) errors.push(r.id + ' :: 孤立 Generator（无 capability）');
    // scope=core 为能力通用型（knowledgePoints 可为空）；scope=legacy 必须有 KP
    if (r.scope !== 'core' && r.knowledgePoints.length === 0) errors.push(r.id + ' :: 孤立 Generator（无 knowledgePoint）');
    r.knowledgePoints.forEach(function (kpId) {
      if (!kbIds[kpId]) errors.push(r.id + ' :: 知识点不存在于 KB: ' + kpId);
    });
  });

  // 4) 无知识点指向不存在 Generator（KB 中带 pluginId 的 KP）
  var genByPlugin = {};
  records.forEach(function (r) {
    genByPlugin[r.id.replace(/^legacy:/, '')] = r.id;
  });
  var kpWithPlugin = 0, kpWithoutPlugin = 0, orphans = [];
  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          if (!kp.pluginId) {
            kpWithoutPlugin++;
            return;
          }
          kpWithPlugin++;
          if (!genByPlugin[kp.pluginId]) {
            if (orphans.indexOf(kp.pluginId) === -1) orphans.push(kp.pluginId);
          }
        });
      });
    });
  });
  orphans.forEach(function (pid) {
    errors.push('KB 知识点指向不存在 Generator 的 pluginId: ' + pid);
  });

  // 6) 查询关系可用
  var chain = GenRegistry.resolveChain('math-g1-m0-make-ten');
  if (!chain || chain.generators.length === 0) {
    errors.push('KnowledgePoint → Capability → Generator 查询关系不可用（make-ten）');
  } else if (chain.capabilityQuestionTypes.length === 0) {
    errors.push('make-ten 的 Capability questionTypes 为空');
  }

  console.log('M4-R03 Generator Registry Gate');
  console.log('');
  console.log('Generator 记录:     ' + records.length);
  console.log('KB KP 带 pluginId:  ' + kpWithPlugin);
  console.log('KB KP 无 pluginId:  ' + kpWithoutPlugin + '（占位条目，WARNING）');
  console.log('查询关系:           ' + (chain ? 'KP→Capability→Generator OK' : 'FAIL'));
  console.log('Errors: ' + errors.length);
  errors.slice(0, 15).forEach(function (e) { console.log('  ✖ ' + e); });
  if (kpWithoutPlugin > 0) warnings.push(kpWithoutPlugin + ' 个 KB 占位 KP 未声明 pluginId（不属于任何 Generator，已知缺口）');
  console.log('Warnings: ' + warnings.length);
  console.log('');

  var ok = errors.length === 0 && records.length > 0;
  console.log(ok ? '[PASS] M4-R03 Generator Registry Gate' : '[FAIL] M4-R03 Generator Registry Gate');
  process.exitCode = ok ? 0 : 1;
}

run();
