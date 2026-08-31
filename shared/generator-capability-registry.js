/**
 * shared/generator-capability-registry.js — 真实 Generator Capability Registry (M2-R05)
 *
 * 只读注册表/解析层：把 99 个真实插件与 M2 的 QuestionType / Capability /
 * KnowledgePoint 建立能力对齐。只描述能力，不保存任何执行函数。
 *
 * 数据来源：
 *   - plugins/registry.js   : pluginId / subject / category / grades（declared）
 *   - KnowledgeBank          : kp.pluginId → 该插件服务的 KP（declared 关联）
 *   - CapabilityResolver     : KP → questionTypes / capabilities（inferred）
 *
 * 严禁保存：generateFunction / generatorFunction / DOM / SVG renderer 引用。
 */
'use strict';

var path = require('node:path');
var Registry = require('./question-type-registry.js');
var KnowledgeBank = require('./knowledge-bank.js');
var Ontology = require('./knowledge-ontology.js');

var ROOT = path.resolve(__dirname, '..');
var pluginRegistry = require(path.join(ROOT, 'plugins', 'registry.js'));

// 惰性加载 capability-resolver，避免 circular dependency
var _Resolver = null;
function resolver() {
  if (!_Resolver) _Resolver = require('./capability-resolver.js');
  return _Resolver;
}

function buildKpByPluginId() {
  var map = {};
  Ontology.SUBJECTS.forEach(function (s) {
    (KnowledgeBank[s] || []).forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          if (kp.pluginId) {
            (map[kp.pluginId] = map[kp.pluginId] || []).push(kp);
          }
        });
      });
    });
  });
  return map;
}

function buildGeneratorCapabilityRegistry() {
  var kpByPlugin = buildKpByPluginId();

  return pluginRegistry.map(function (entry) {
    var kps = kpByPlugin[entry.id] || [];
    var questionTypeIds = [];
    var capabilities = [];
    var unknownTypes = [];
    var invalidTypes = [];

    // 通过 KP → CapabilityResolver 解析题型/能力（inferred，KB 为权威关联）
    kps.forEach(function (kp) {
      try {
        var cap = resolver().resolve(Ontology.normalize(kp));
        (cap.questionTypes || []).forEach(function (qt) {
          if (Registry.has(qt.id)) {
            if (questionTypeIds.indexOf(qt.id) === -1) questionTypeIds.push(qt.id);
            if (capabilities.indexOf(qt.id) === -1) capabilities.push(qt.id);
          } else {
            invalidTypes.push(qt.id);
          }
        });
      } catch (e) {
        unknownTypes.push(kp.id + ':' + e.message);
      }
    });

    return {
      pluginId: entry.id,
      subject: entry.subject,
      category: entry.category,
      grades: entry.grades || [],
      moduleIds: entry.moduleIds || [],
      isPlaceholder: !!entry.isPlaceholder,
      questionTypes: questionTypeIds,
      capabilities: capabilities,
      knowledgePoints: kps.map(function (k) { return k.id; }),
      unknownCapabilities: unknownTypes,
      invalidCapabilities: invalidTypes,
      source: 'plugin-contract',
      confidence: kps.length ? 'inferred' : (entry.isPlaceholder ? 'unknown' : 'unknown')
    };
  });
}

module.exports = {
  buildGeneratorCapabilityRegistry: buildGeneratorCapabilityRegistry,
  buildKpByPluginId: buildKpByPluginId
};
