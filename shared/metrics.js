/**
 * shared/metrics.js — P5-R03 Production Metrics
 *
 * 收集生产环境关键指标（仅用于开发诊断）：
 *   - 生成成功率
 *   - 验证失败率
 *   - Retry 次数分布
 *   - 重复率
 *   - 渲染失败率
 *
 * 仅内存存储，不持久化；可通过 dev/check-metrics.js 导出快照
 */
(function (global) {
  'use strict';

  var metrics = {
    generation: {
      total: 0,
      success: 0,
      failed: 0,
      byGenerator: {},
      bySubject: {},
      byGrade: {}
    },
    validation: {
      total: 0,
      passed: 0,
      failed: 0,
      errorsByCode: {},
      byGenerator: {},
      bySubject: {}
    },
    retry: {
      totalAttempts: 0,
      totalRetries: 0,
      maxRetriesHit: 0,
      retriesByGenerator: {},
      retriesByErrorCode: {}
    },
    duplicate: {
      totalQuestions: 0,
      duplicatesFound: 0,
      byGenerator: {}
    },
    render: {
      total: 0,
      success: 0,
      failed: 0,
      errorsByType: {}
    }
  };

  function reset() {
    metrics.generation = { total: 0, success: 0, failed: 0, byGenerator: {}, bySubject: {}, byGrade: {} };
    metrics.validation = { total: 0, passed: 0, failed: 0, errorsByCode: {}, byGenerator: {}, bySubject: {} };
    metrics.retry = { totalAttempts: 0, totalRetries: 0, maxRetriesHit: 0, retriesByGenerator: {}, retriesByErrorCode: {} };
    metrics.duplicate = { totalQuestions: 0, duplicatesFound: 0, byGenerator: {} };
    metrics.render = { total: 0, success: 0, failed: 0, errorsByType: {} };
  }

  // ---- Generation Metrics ----
  function recordGenerationStart(data) {
    metrics.generation.total++;
    var key = data.generator || 'unknown';
    metrics.generation.byGenerator[key] = (metrics.generation.byGenerator[key] || 0) + 1;
    if (data.subject) metrics.generation.bySubject[data.subject] = (metrics.generation.bySubject[data.subject] || 0) + 1;
    if (data.grade) metrics.generation.byGrade[data.grade] = (metrics.generation.byGrade[data.grade] || 0) + 1;
  }

  function recordGenerationSuccess(data) {
    metrics.generation.success++;
  }

  function recordGenerationFailure(data) {
    metrics.generation.failed++;
  }

  // ---- Validation Metrics ----
  function recordValidationResult(data) {
    metrics.validation.total++;
    if (data.valid) {
      metrics.validation.passed++;
    } else {
      metrics.validation.failed++;
      (data.errors || []).forEach(function (e) {
        metrics.validation.errorsByCode[e.code] = (metrics.validation.errorsByCode[e.code] || 0) + 1;
      });
    }
    if (data.generator) {
      metrics.validation.byGenerator[data.generator] = (metrics.validation.byGenerator[data.generator] || { total: 0, passed: 0, failed: 0 });
      metrics.validation.byGenerator[data.generator].total++;
      if (data.valid) metrics.validation.byGenerator[data.generator].passed++; else metrics.validation.byGenerator[data.generator].failed++;
    }
    if (data.subject) {
      metrics.validation.bySubject[data.subject] = (metrics.validation.bySubject[data.subject] || { total: 0, passed: 0, failed: 0 });
      metrics.validation.bySubject[data.subject].total++;
      if (data.valid) metrics.validation.bySubject[data.subject].passed++; else metrics.validation.bySubject[data.subject].failed++;
    }
  }

  // ---- Retry Metrics ----
  function recordRetryAttempt(data) {
    metrics.retry.totalAttempts++;
    metrics.retry.totalRetries += (data.retries || 0);
    if (data.retries >= (data.maxRetries || 3)) metrics.retry.maxRetriesHit++;
    if (data.generator) {
      metrics.retry.retriesByGenerator[data.generator] = (metrics.retry.retriesByGenerator[data.generator] || 0) + (data.retries || 0);
    }
    (data.errorCodes || []).forEach(function (code) {
      metrics.retry.retriesByErrorCode[code] = (metrics.retry.retriesByErrorCode[code] || 0) + 1;
    });
  }

  // ---- Duplicate Metrics ----
  function recordDuplicateCheck(data) {
    metrics.duplicate.totalQuestions += (data.totalQuestions || 0);
    metrics.duplicate.duplicatesFound += (data.duplicatesFound || 0);
    if (data.generator) {
      metrics.duplicate.byGenerator[data.generator] = (metrics.duplicate.byGenerator[data.generator] || { total: 0, duplicates: 0 });
      metrics.duplicate.byGenerator[data.generator].total += (data.totalQuestions || 0);
      metrics.duplicate.byGenerator[data.generator].duplicates += (data.duplicatesFound || 0);
    }
  }

  // ---- Render Metrics ----
  function recordRenderResult(data) {
    metrics.render.total++;
    if (data.success) {
      metrics.render.success++;
    } else {
      metrics.render.failed++;
      if (data.errorType) metrics.render.errorsByType[data.errorType] = (metrics.render.errorsByType[data.errorType] || 0) + 1;
    }
  }

  // ---- Summary / Export ----
  function getSummary() {
    var gen = metrics.generation;
    var val = metrics.validation;
    var ret = metrics.retry;
    var dup = metrics.duplicate;
    var ren = metrics.render;

    return {
      generation: {
        total: gen.total,
        successRate: gen.total ? gen.success / gen.total : 0,
        failureRate: gen.total ? gen.failed / gen.total : 0,
        byGenerator: gen.byGenerator,
        bySubject: gen.bySubject,
        byGrade: gen.byGrade
      },
      validation: {
        total: val.total,
        passRate: val.total ? val.passed / val.total : 0,
        failureRate: val.total ? val.failed / val.total : 0,
        topErrors: Object.entries(val.errorsByCode).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10),
        byGenerator: val.byGenerator,
        bySubject: val.bySubject
      },
      retry: {
        totalAttempts: ret.totalAttempts,
        avgRetries: ret.totalAttempts ? ret.totalRetries / ret.totalAttempts : 0,
        maxRetriesHit: ret.maxRetriesHit,
        byGenerator: ret.retriesByGenerator,
        topErrorCodes: Object.entries(ret.retriesByErrorCode).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10)
      },
      duplicate: {
        totalQuestions: dup.totalQuestions,
        duplicatesFound: dup.duplicatesFound,
        duplicateRate: dup.totalQuestions ? dup.duplicatesFound / dup.totalQuestions : 0,
        byGenerator: dup.byGenerator
      },
      render: {
        total: ren.total,
        successRate: ren.total ? ren.success / ren.total : 0,
        failureRate: ren.total ? ren.failed / ren.total : 0,
        errorsByType: ren.errorsByType
      },
      timestamp: new Date().toISOString()
    };
  }

  function exportJSON() {
    return JSON.stringify(getSummary(), null, 2);
  }

  var API = {
    reset: reset,
    recordGenerationStart: recordGenerationStart,
    recordGenerationSuccess: recordGenerationSuccess,
    recordGenerationFailure: recordGenerationFailure,
    recordValidationResult: recordValidationResult,
    recordRetryAttempt: recordRetryAttempt,
    recordDuplicateCheck: recordDuplicateCheck,
    recordRenderResult: recordRenderResult,
    getSummary: getSummary,
    exportJSON: exportJSON,
    // 直接访问原始计数器（仅开发调试用）
    _internal: metrics
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Metrics = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));