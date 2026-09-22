/**
 * tests/fixtures/generation-core.js — 共同生成内核 GenerationCore（P17-3 冻结）
 *
 * ⚠️ FINAL-17 迁移：TEST-ONLY / HISTORICAL（非生产链）
 *   原位置 shared/generation/generation-core.js 已删除——生产源码不得存在
 *   「看起来像正式 GenerationCore、实际无生产调用」的假核心。
 *   生产链 = api.js orchestrate → build → runPlans → generateQuestions，
 *   不经过本模块。本文件仅被 tests/orchestration/p17-*.test.js 直接装载以验证
 *   execute 语义，不进入 strategy-engine.bundle.js / presentation-engine.bundle.js。
 *
 * 职责（单一）：按 POL 产出的 GenerationPlan 逐 Cell「执行」生成。
 *   接受：GenerationPlan { cells: GenerationCell[], targetTotal }
 *   返回：GenerationResult { questions, generatedCount, plannedCount, shortfall, failures, metadata }
 *
 * 硬约束（与 P17 冻结对齐）：
 *   - 只执行，不重规划：Cell 的 kpId / questionType / difficulty / count 权威来自 POL，
 *     本层不改写任何 Cell 语义（不做 KP/Type 扩容、不做难度改写、不偷换预算单位）。
 *   - retry 同一 Cell：GenerationCore 内建候选收集循环（StrategyPlan → Selector → Generator
 *     → Validator），在 Cell 内对同 (kpId,type,diff) 重试至 count 饱和或耗尽；绝不跨 Cell 补题。
 *   - shortfall 只上报：未达 plannedCount 的差额 (shortfall) 如实交还 POL 调度，
 *     本层不自行展开新候选（剩余空间由 POL/secondary 逻辑决定）。
 *   - 不接触渲染/DOM：输出限 SemanticQuestion[]，不含 html/svg/items/renderOptions。
 *   - 依赖通过注入；Node/浏览器双环境兼容（与 api.js 一致的 DI 风格）。
 *
 * 版本：1（P17-3）
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';

  var GenerationContract = (function () {
    try { return require('../../shared/generation/generation-contract.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.GenerationContract : null);
  var Selector = (function () {
    try { return require('../../shared/generator/generator-selector.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.GeneratorSelector : null);
  var RetryLoop = (function () {
    try { return require('../../shared/generator/retry-loop.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.RetryLoop : null);
  var SQ = (function () {
    try { return require('../../shared/semantic/semantic-question.js'); } catch (e) { return null; }
  })() || (typeof global !== 'undefined' ? global.SemanticQuestion : null);

  var MAX_CELL_RETRIES = 3;

  // ---------- 依赖注入（与 api.js 对齐） ----------
  var _deps = {};
  var DEP_GLOBAL_KEYS = {
    selector: 'GeneratorSelector',
    retryLoop: 'RetryLoop',
    semanticQuestion: 'SemanticQuestion'
  };
  function getDep(name) {
    if (_deps[name]) return _deps[name];
    var key = DEP_GLOBAL_KEYS[name];
    var g = (typeof global !== 'undefined') && global[key];
    if (g) _deps[name] = g;
    return _deps[name];
  }
  function getSelector() { return Selector || getDep('selector'); }
  function getRetryLoop() { return RetryLoop || getDep('retryLoop'); }
  function getSQ() { return SQ || getDep('semanticQuestion'); }

  // ---------- 同学科共享 seenKeys（去重袋：跨 Cell 共享，frame 级全局） ----------
  function collectQuestions(result) {
    var arr = (result && result.questions) || [];
    return Array.isArray(arr) ? arr : [];
  }

  /**
   * 执行单个 Cell（核心原子）。
   * 返回 { questions, failures:[{cell,error,retries}], retries }
   */
  function executeCell(cell, options) {
    options = options || {};
    var contract = GenerationContract;
    var c = contract ? contract.normalizeCell(cell) : cell;
    if (!c || !c.kpId || !c.questionType) {
      var badErr = new Error('GenerationCore: 非法 Cell（缺 kpId 或 questionType）');
      return Promise.resolve({ questions: [], failures: [{ cell: c, error: badErr },], retries: 0 });
    }

    var baseSeed = options.seed || null;
    var seenKeys = options.seenKeys || null;
    var mathSeenKeys = options.mathSeenKeys || null;
    var maxCellRetries = options.maxRetries != null ? options.maxRetries : MAX_CELL_RETRIES;

    var selector = getSelector();
    var retryLoop = getRetryLoop();
    if (!selector || !retryLoop || !getSQ()) {
      var depErr = new Error('GenerationCore: 依赖不可用（selector/retryLoop/semanticQuestion）');
      return Promise.resolve({ questions: [], failures: [{ cell: c, error: depErr }], retries: 0 });
    }

    // StrategyPlan：由 Cell 投影（本层不重规划；约束来自 Cell.context 白名单）
    var sp = {
      knowledgePointIds: [c.kpId],
      questionTypeId: c.questionType,
      difficulty: c.difficulty,
      count: c.count,
      seed: baseSeed,
      constraints: Object.assign({}, c.context || {})
    };

    var selection;
    try {
      selection = selector.selectGenerator(sp, { mode: 'native' });
    } catch (e) {
      return Promise.resolve({ questions: [], failures: [{ cell: c, error: e }], retries: 0 });
    }
    if (!selection || !selection.record) {
      return Promise.resolve({
        questions: [],
        failures: [{ cell: c, error: new Error('无可用 Generator: ' + c.kpId + '/' + c.questionType) }],
        retries: 0
      });
    }
    var generator = selector.instantiate(selection, selection.plugin);
    if (!generator) {
      return Promise.resolve({
        questions: [],
        failures: [{ cell: c, error: new Error('Generator 实例化失败: ' + selection.record.id) }],
        retries: 0
      });
    }

    var attempts = 0;
    return retryLoop.generateWithRetry(
      function (p) { return generator.generate(p); },
      sp,
      {
        generatorId: selection.record.id,
        generatorVersion: selection.record.version || '1.0.0',
        maxRetries: maxCellRetries,
        validatorEnabled: options.skipValidation !== true,
        seed: baseSeed,
        validatorContext: {
          generatorId: selection.record.id,
          seed: baseSeed,
          seenKeys: seenKeys,
          mathSeenKeys: mathSeenKeys,
          plan: sp
        }
      }
    ).then(function (result) {
      var questions = collectQuestions(result);
      var failure = null;
      // 重试耗尽/致命/不可重试：无任何题目时记 failure；有部分有效题则按 PARTIAL（shortfall 如实上报）
      if (!result.success && (!questions || questions.length === 0)) {
        failure = {
          cell: c,
          error: new Error(((result.error || 'GENERATION_FAILED') + (result.message ? ': ' + result.message : ''))),
          retries: result.retries || 0
        };
      }
      return {
        questions: questions,
        failures: failure ? [failure] : [],
        retries: result.retries || 0
      };
    }).catch(function (err) {
      return {
        questions: [],
        failures: [{ cell: c, error: err, retries: attempts }],
        retries: attempts
      };
    });
  }

  /**
   * GenerationCore 主入口：执行整个 GenerationPlan（只执行，不重规划）。
   * @param {Object} plan GenerationPlan（含 cells）
   * @param {Object} [options] { previousSeenKeys, skipValidation, maxRetries, seed }
   * @returns {Promise<GenerationResult>}
   */
  function execute(plan, options) {
    options = options || {};
    var contract = GenerationContract;
    var normPlan = contract ? contract.normalizePlan(plan || {}) : (plan || { cells: [] });
    var cells = (Array.isArray(normPlan.cells) ? normPlan.cells : []).concat();
    var targetTotal = normPlan.targetTotal || cells.reduce(function (n, c) { return n + (c.count || 0); }, 0);

    // frame 级 seenKeys：previousSeenKeys（历史代/会话）∪ 本帧所有成功题目指纹
    var seenKeys = new Set();
    var mathSeenKeys = new Map();
    if (options.previousSeenKeys) {
      (options.previousSeenKeys.forEach ? options.previousSeenKeys : []).forEach(function (k) { seenKeys.add(k); });
    }
    if (options.previousMathSeenKeys) {
      var mk = options.previousMathSeenKeys;
      Object.keys(mk || {}).forEach(function (k) { mathSeenKeys.set(k, mk[k]); });
    }

    var allQuestions = [];
    var allFailures = [];
    var retryTotal = 0;
    var seq = Promise.resolve();
    cells.forEach(function (cell) {
      seq = seq.then(function () {
        return executeCell(cell, {
          seenKeys: seenKeys,
          mathSeenKeys: mathSeenKeys,
          skipValidation: options.skipValidation,
          maxRetries: options.maxRetries,
          seed: options.seed
        }).then(function (res) {
          allQuestions.push.apply(allQuestions, res.questions);
          retryTotal += res.retries;
          (res.failures || []).forEach(function (f) { allFailures.push(f); });
          // 成功题目指纹入 seenKeys（frame 内去重继续生效）
          (res.questions || []).forEach(function (sq) {
            if (sq && sq.questionFingerprint) seenKeys.add(sq.questionFingerprint);
          });
        });
      });
    });

    return seq.then(function () {
      var generated = allQuestions.length;
      var failures = allFailures;
      var metadata = {
        retryTotal: retryTotal,
        generatorIds: [],
        seenKeys: seenKeys,
        request: normPlan
      };
      if (contract) {
        return contract.makeResult(allQuestions, { targetTotal: targetTotal, requestedCount: normPlan.requestedCount }, targetTotal - generated, failures, metadata);
      }
      var status = generated === 0 ? 'FAILED' : (generated < targetTotal ? 'PARTIAL' : 'SUCCESS');
      return {
        questions: allQuestions,
        generatedCount: generated,
        plannedCount: targetTotal,
        shortfall: Math.max(0, targetTotal - generated),
        failures: failures,
        metadata: metadata,
        status: status
      };
    });
  }

  function inject(deps) {
    if (deps) {
      for (var k in deps) {
        if (Object.prototype.hasOwnProperty.call(deps, k)) _deps[k] = deps[k];
      }
    }
    return API;
  }

  var API = {
    execute: execute,
    executeCell: executeCell,
    MAX_CELL_RETRIES: MAX_CELL_RETRIES,
    inject: inject
  };

  global.GenerationCore = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationCore = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : this));
