/**
 * shared/logger.js — M5-R22 Production Logging (Question Validation)
 *
 * 记录：
 *   questionId, knowledgePointId, generator, generatorVersion,
 *   validationResult, errorCodes, retryCount, seed
 *
 * 支持多种输出：console、文件、远程端点（可配置）
 */
(function (global) {
  'use strict';

  var LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
  var currentLevel = LEVELS.INFO;
  var transports = [{ type: 'console', level: LEVELS.INFO }];

  function setLevel(level) { currentLevel = LEVELS[level.toUpperCase()] || LEVELS.INFO; }
  function addTransport(t) { transports.push(t); }

  function format(msg, meta) {
    var base = { timestamp: new Date().toISOString(), level: msg.level, message: msg.message };
    return Object.assign(base, meta || {});
  }

  function log(level, message, meta) {
    if (LEVELS[level] < currentLevel) return;
    var entry = format({ level: level, message: message }, meta);
    transports.forEach(function (t) {
      if (LEVELS[t.level] <= LEVELS[level]) {
        if (t.type === 'console') console[level.toLowerCase()](JSON.stringify(entry));
        else if (t.type === 'file' && t.path) {
          try { require('fs').appendFileSync(t.path, JSON.stringify(entry) + '\n'); } catch (e) { /* ignore */ }
        } else if (t.type === 'remote' && t.url) {
          try { fetch(t.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) }); } catch (e) { /* ignore */ }
        }
      }
    });
  }

  // 专用：题目验证日志
  function logQuestionValidation(data) {
    var required = ['questionId', 'knowledgePointId', 'generator', 'generatorVersion', 'seed'];
    var missing = required.filter(function (k) { return !data[k]; });
    if (missing.length) console.warn('[Logger] questionValidation 缺少字段: ' + missing.join(', '));

    log('info', 'question_validation', {
      questionId: data.questionId,
      knowledgePointId: data.knowledgePointId,
      generator: data.generator,
      generatorVersion: data.generatorVersion,
      seed: data.seed,
      retryCount: data.retryCount || 0,
      validationResult: data.validationResult, // 'pass' | 'fail' | 'retry' | 'fatal'
      errorCodes: data.errorCodes || [],
      score: data.score,
      planId: data.planId,
      questionType: data.questionType,
      difficulty: data.difficulty
    });
  }

  // 专用：生成重试日志
  function logGenerationRetry(data) {
    log('warn', 'generation_retry', {
      generator: data.generator,
      attempt: data.attempt,
      maxRetries: data.maxRetries,
      seed: data.seed,
      errorCodes: data.errorCodes || [],
      planId: data.planId
    });
  }

  // 专用：批量验证日志
  function logBatchValidation(data) {
    log('info', 'batch_validation', {
      planId: data.planId,
      totalQuestions: data.total,
      passed: data.passed,
      passRate: data.passRate,
      errorSummary: data.errorSummary,
      qualityAvg: data.qualityAvg
    });
  }

  // P5-R03：生产指标记录
  function logGenerationMetrics(data) {
    log('info', 'generation_metrics', data);
  }

  function logValidationMetrics(data) {
    log('info', 'validation_metrics', data);
  }

  function logRetryMetrics(data) {
    log('info', 'retry_metrics', data);
  }

  function logDuplicateMetrics(data) {
    log('info', 'duplicate_metrics', data);
  }

  function logRenderMetrics(data) {
    log('info', 'render_metrics', data);
  }

  var API = {
    LEVELS: LEVELS,
    setLevel: setLevel,
    addTransport: addTransport,
    log: log,
    logQuestionValidation: logQuestionValidation,
    logGenerationRetry: logGenerationRetry,
    logBatchValidation: logBatchValidation,
    logGenerationMetrics: logGenerationMetrics,
    logValidationMetrics: logValidationMetrics,
    logRetryMetrics: logRetryMetrics,
    logDuplicateMetrics: logDuplicateMetrics,
    logRenderMetrics: logRenderMetrics,
    debug: function (m, meta) { log('DEBUG', m, meta); },
    info: function (m, meta) { log('INFO', m, meta); },
    warn: function (m, meta) { log('WARN', m, meta); },
    error: function (m, meta) { log('ERROR', m, meta); }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Logger = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));