/**
 * shared/capability/capability-scan-context.js — M2-R08 Capability Scan Context
 *
 * 单次全量扫描上下文：一次性完成全量（math 域）KP 的 Canonical KP、Capability、Matrix、
 * Generator Registry、以及 KP × QuestionType 最终决策计算，供 R04、R06、R07 复用，
 * 消除重复扫描。
 *
 * 数据流：
 *   KnowledgeBank (legacy) -> Ontology.normalize -> CapabilityModel.resolveCapability
 *     -> Matrix.buildMatrix（注入已解析 cap，避免二次解析）
 *     -> 最终决策（与 Resolver.resolveFinal 同一套优先级规则）
 *
 * 支持 cacheKey 与 forceRefresh（--refresh）。
 */
'use strict';

var Ontology = require('../knowledge/knowledge-ontology.js');
var KnowledgeBank = require('../knowledge/knowledge-bank.js');
var CapabilityModel = require('./capability-model.js');
var Matrix = require('./capability-matrix.js');
var Registry = require('../knowledge/question-type-registry.js');
// MATH-14：plugin 决策源（generator-capability-registry）已删除，改用 native Generator Registry。
var GenRegistry = require('../generator/generator-registry.js');

var SUBJECTS = Ontology.SUBJECTS;
var QT_IDS = Registry.all().map(function (t) { return t.id; });

var _scanCache = null;
var _scanCount = 0;

function finalDecisionFor(matrix, genQtSet, qtId) {
  // 与 Resolver.resolveFinal 相同的最终决策优先级：
  //   INVALID → FORBID → MISSING → ALLOW → DEGRADE（DEGRADE 绝不升级为 ALLOW）
  // 输入已缓存：matrix（R04 矩阵）、genQtSet（服务该 KP 的 Generator 已声明题型集合）。
  var cell = matrix.questionTypes[qtId];
  var matrixDecision = cell ? cell.decision : 'FORBID';

  // 该 KP 实际被 Generator 覆盖的题型集合；null 表示生成层不可用时不做二次校验。
  var pluginHas = genQtSet ? genQtSet.has(qtId) : null;

  var decision;
  if (matrixDecision === 'MISSING') decision = 'MISSING';
  else if (matrixDecision === 'FORBID') decision = 'FORBID';
  else if (matrixDecision === 'ALLOW') decision = 'ALLOW';
  else decision = 'DEGRADE';

  // Generator 明确缺失该题型但 matrix ALLOW → 降级为 DEGRADE（声明不足，不伪造）
  if (decision === 'ALLOW' && pluginHas === false) decision = 'DEGRADE';

  var confidence = 'unknown';
  if (decision === 'ALLOW') confidence = 'declared';
  else if (decision === 'DEGRADE') confidence = 'inferred';

  return { decision: decision, confidence: confidence, pluginHas: pluginHas };
}

function buildScanContext(options) {
  options = options || {};
  var forceRefresh = options.forceRefresh === true;
  var cacheKey = options.cacheKey || 'default';

  if (!forceRefresh && _scanCache && _scanCache.cacheKey === cacheKey) {
    return {
      cacheHit: true,
      scanCount: _scanCount,
      data: _scanCache.data
    };
  }

  _scanCount++;
  var scanStart = Date.now();

  // ---- 1) KP 全量遍历：canonicalize + capability + matrix（每个 KP 各一次） ----
  var totalKp = 0;
  var kpResults = {};
  var stats = { ALLOW: 0, FORBID: 0, DEGRADE: 0, MISSING: 0, INVALID: 0 };
  var errors = [];
  var mutations = [];

  SUBJECTS.forEach(function (s) {
    var arr = KnowledgeBank[s];
    if (!Array.isArray(arr)) return;
    arr.forEach(function (g) {
      (g.modules || []).forEach(function (m) {
        (m.knowledgePoints || []).forEach(function (kp) {
          totalKp++;
          var before = JSON.stringify(kp);
          try {
            var canonicalKp = Ontology.normalize(kp);
            var cap = CapabilityModel.resolveCapability(canonicalKp);
            var mx = Matrix.buildMatrix(canonicalKp, cap);

            kpResults[kp.id] = {
              id: kp.id,
              subject: canonicalKp.subject,
              grade: canonicalKp.grade,
              pluginId: canonicalKp.pluginId,
              canonical: canonicalKp,
              capability: cap,
              matrix: mx
            };

            Object.keys(mx.questionTypes).forEach(function (qt) {
              var d = mx.questionTypes[qt].decision;
              if (stats[d] !== undefined) stats[d]++;
              else stats[d] = 1;
            });
          } catch (e) {
            errors.push(kp.id + ' :: ' + e.message);
          }
          var after = JSON.stringify(kp);
          if (before !== after) mutations.push(kp.id + ' 被修改');
        });
      });
    });
  });

  // ---- 2) Native Generator Registry（构建一次，供 R05/R06/R07 复用） ----
  // MATH-14：记录形状映射为 pluginId 语义（pluginId = generator id），保持下游消费兼容。
  var genRecords = GenRegistry.all().map(function (rec) {
    return {
      pluginId: rec.id,
      questionTypes: rec.questionTypes || [],
      knowledgePoints: rec.knowledgePoints || [],
      invalidCapabilities: []
    };
  });
  var genWithKp = 0;
  var genNoKp = 0;
  var genInvalidQT = [];
  var genInvalidCap = [];
  var genByPluginId = {};

  genRecords.forEach(function (rec) {
    genByPluginId[rec.pluginId] = rec;
    if (rec.knowledgePoints.length) genWithKp++;
    else genNoKp++;

    rec.questionTypes.forEach(function (qt) {
      if (!Registry.has(qt)) genInvalidQT.push(rec.pluginId + ' :: ' + qt);
    });
    rec.invalidCapabilities.forEach(function (c) {
      genInvalidCap.push(rec.pluginId + ' :: ' + c);
    });
  });

  // ---- 3) KP × QuestionType 最终决策（复用第 1、2 步缓存，不重复解析） ----
  var combos = {
    total: 0,
    stats: { ALLOW: 0, FORBID: 0, DEGRADE: 0, MISSING: 0, INVALID: 0 },
    bySubject: {},
    byGrade: {},
    byQuestionType: {},
    byPlugin: {}
  };

  Object.keys(kpResults).forEach(function (id) {
    var r = kpResults[id];
    // 该 KP 实际被 Generator 覆盖的题型集合（按 generator id 域反查，修正旧实现按 legacy pluginId 查不到的问题）
    var genRecs = GenRegistry.forKnowledgePoint(id);
    var genQtSet = new Set();
    genRecs.forEach(function (gr) { (gr.questionTypes || []).forEach(function (t) { genQtSet.add(t); }); });
    QT_IDS.forEach(function (qtId) {
      combos.total++;
      var final = finalDecisionFor(r.matrix, genQtSet, qtId);
      var d = final.decision;
      combos.stats[d] = (combos.stats[d] || 0) + 1;

      combos.bySubject[r.subject] = combos.bySubject[r.subject] || {};
      combos.bySubject[r.subject][d] = (combos.bySubject[r.subject][d] || 0) + 1;

      combos.byGrade[r.grade] = combos.byGrade[r.grade] || {};
      combos.byGrade[r.grade][d] = (combos.byGrade[r.grade][d] || 0) + 1;

      combos.byQuestionType[qtId] = combos.byQuestionType[qtId] || {};
      combos.byQuestionType[qtId][d] = (combos.byQuestionType[qtId][d] || 0) + 1;

      var plugin = r.pluginId || '(none)';
      combos.byPlugin[plugin] = combos.byPlugin[plugin] || {};
      combos.byPlugin[plugin][d] = (combos.byPlugin[plugin][d] || 0) + 1;
    });
  });

  var scanTime = Date.now() - scanStart;

  var data = {
    scanInfo: {
      scanCount: _scanCount,
      scanTime: scanTime,
      timestamp: new Date().toISOString(),
      cacheKey: cacheKey,
      cacheHit: false
    },
    totalKp: totalKp,
    questionTypeIds: QT_IDS.slice(),
    stats: stats,
    kpResults: kpResults,
    errors: errors,
    mutations: mutations,
    gen: {
      records: genRecords,
      withKp: genWithKp,
      noKp: genNoKp,
      invalidQT: genInvalidQT,
      invalidCap: genInvalidCap,
      byPluginId: genByPluginId
    },
    combos: combos
  };

  _scanCache = {
    cacheKey: cacheKey,
    data: data,
    timestamp: Date.now()
  };

  return {
    cacheHit: false,
    scanCount: _scanCount,
    data: data
  };
}

function getScanContext(options) {
  return buildScanContext(options);
}

function clearCache() {
  _scanCache = null;
  _scanCount = 0;
}

function getCacheStatus() {
  return {
    hasCache: !!_scanCache,
    scanCount: _scanCount,
    cacheKey: _scanCache ? _scanCache.cacheKey : null,
    timestamp: _scanCache ? _scanCache.timestamp : null
  };
}

module.exports = {
  getScanContext: getScanContext,
  clearCache: clearCache,
  getCacheStatus: getCacheStatus,
  finalDecisionFor: finalDecisionFor
};
