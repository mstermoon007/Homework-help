/**
 * shared/generation/generation-contract.js — Generation 契约（P17-2 冻结）
 *
 * 定义共同生成内核的边界类型与职责：POL 产出 GenerationPlan（Cell 集合），
 * GenerationCore 只做「执行」，不重规划、不越权、不接触渲染/DOM。
 *
 * 契约关系（单向）：
 *   PracticeRequest
 *     → POL.plan()        → GenerationPlan { cells: GenerationCell[], targetTotal, ... }
 *     → GenerationCore    → Cell → StrategyPlan → Candidate（Generator 原生产物）
 *                            → Validator(ValidationResult) → SemanticQuestion
 *     → GenerationResult  { questions, generatedCount, plannedCount, shortfall, failures, metadata }
 *     → PresentationEngine（仅消费 SemanticQuestion[]）
 *
 * 本模块：纯数据 + 纯函数；不依赖 DOM/window/渲染器/生成器实现；浏览器与 Node 双环境兼容。
 * 版本：1
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  // ---------- canonical 题型 SSOT（7 类；classify 为第 7 类，oral/classification 为别名非新类） ----------
  var QuestionTypeRegistry = (typeof require === 'function')
    ? (function () { try { return require('../knowledge/question-type-registry.js'); } catch (e) { return null; } })()
    : (global.QuestionTypeRegistry || null);
  var CANONICAL_TYPES = (QuestionTypeRegistry && QuestionTypeRegistry.all)
    ? QuestionTypeRegistry.all().map(function (t) { return t.id; })
    : ['calc', 'fill', 'choice', 'judge', 'geometry', 'classify', 'apply'];

  // ---------- 语义字段白名单（P11-00 冻结；会改变生成语义的请求字段在此与 cell 共存） ----------
  var GENERATION_CONTEXT_FIELDS = [
    'subject', 'grade', 'difficulty', 'selectLevel', 'style', 'expectedAnswerStyle',
    'subtype', 'cognitiveLevel', 'spiralLevel', 'max_spiral_level',
    'customParams', 'settings', 'allowDifficultyOverride',
    'adaptive', 'adaptiveMode', 'adaptiveDelta', 'learnerProfile'
  ];
  // 规划级字段（不属于 cell）：combine / planLevel / typeCounts / perTypeCount / count（父级总预算）
  var PLANNING_CONTEXT_FIELDS = ['combine', 'planLevel', 'typeCounts', 'perTypeCount', 'count'];

  // ---------- GenerationCell（执行单元；较短可用循环的输入） ----------
  // 字段：
  //   kpId           : string  （单 KP，cell 是编排单元）
  //   questionType   : string  （canonical 7 类之一）
  //   difficulty     : number  （1-10，cell 级权威难度）
  //   count          : number  （本 cell 期望产出数，>=1 整数）
  //   context        : Object  （生成上下文；只含 GENERATION_CONTEXT_FIELDS 白名单派生字段）
  // 禁止：不得携带 generatorId / generator / html / svg / render / template（选择与渲染都不得进入 cell）。
  function normalizeCell(raw) {
    var c = raw || {};
    var count = Math.floor(Number(c.count));
    if (!Number.isFinite(count) || count < 1) count = 1;
    var difficulty = Number(c.difficulty);
    if (!Number.isFinite(difficulty)) difficulty = 5;
    difficulty = Math.max(1, Math.min(10, difficulty));
    var ctx = {};
    if (c.context && typeof c.context === 'object') {
      Object.keys(c.context).forEach(function (k) {
        if (GENERATION_CONTEXT_FIELDS.indexOf(k) !== -1) ctx[k] = c.context[k];
      });
    }
    // 兼容旧 cell 形状（kpId/questionType 平铺于顶层 + context 附属）
    var type = c.questionType || (c.context && c.context.questionType);
    return {
      kpId: String(c.kpId || (c.context && c.context.kpId) || ''),
      questionType: String(type || ''),
      difficulty: difficulty,
      count: count,
      context: ctx
    };
  }

  function isValidCell(cell) {
    return !!(cell && typeof cell.kpId === 'string' && cell.kpId &&
      CANONICAL_TYPES.indexOf(cell.questionType) !== -1 &&
      typeof cell.difficulty === 'number' && cell.difficulty >= 1 && cell.difficulty <= 10 &&
      Number.isInteger(cell.count) && cell.count >= 1);
  }

  // ---------- GenerationPlan（POL plan() 的规范面） ----------
  // 字段：
  //   cells        : GenerationCell[]
  //   targetTotal  : number   （计划总期望产出）
  //   requestedCount: number  （用户请求总量；不得改写）
  //   selectedTypes: string[]
  //   selectedKPs  : string[]
  //   explicitCombo: boolean  （显式 typeCounts/perTypeCount 权威时，总量以计划为准）
  //   meta         : Object   （POL 决策派生：typeCaps/coverageStatus/reason 等，仅供 trace）
  function normalizePlan(raw) {
    var p = raw || {};
    var plan = {
      cells: (Array.isArray(p.cells) ? p.cells : []).map(normalizeCell),
      targetTotal: Number(p.targetTotal) || 0,
      requestedCount: Number(p.requestedCount) || 0,
      selectedTypes: Array.isArray(p.selectedTypes) ? p.selectedTypes.slice() : [],
      selectedKPs: Array.isArray(p.selectedKPs) ? p.selectedKPs.slice() : []
    };
    if (typeof p.explicitCombo === 'boolean') plan.explicitCombo = p.explicitCombo;
    if (p.meta && typeof p.meta === 'object') plan.meta = p.meta;
    return plan;
  }

  // ---------- StrategyPlan（Strategy 逐 cell 产出；Generator 消费） ----------
  // 保留 question-plan/Contract 既有字段（knowledgePointIds/questionTypeId/difficulty/count/seed/constraints）。
  function makeStrategyPlan(cell, seedOverride) {
    return {
      knowledgePointIds: [cell.kpId],
      questionTypeId: cell.questionType,
      difficulty: cell.difficulty,
      count: cell.count,
      seed: seedOverride || null,
      constraints: Object.assign({}, cell.context)
    };
  }

  // ---------- Candidate（Generator 原生产物；Validator 的输入） ----------
  // { plan, rawItems: Object[], generatorId, generatorVersion }
  function makeCandidate(cell, generatorId, rawItems) {
    return {
      cell: cell,
      generatorId: String(generatorId || ''),
      rawItems: Array.isArray(rawItems) ? rawItems : [],
      attempts: 1
    };
  }

  // ---------- ValidationResult（Validator 输出） ----------
  // { valid, errors: string[], warnings: string[], checks: Object, filteredItems: Object[] }
  function makeValidationResult(valid, errors, warnings, checks) {
    return {
      valid: !!valid,
      errors: Array.isArray(errors) ? errors : [],
      warnings: Array.isArray(warnings) ? warnings : [],
      checks: checks || {},
      filteredItems: []
    };
  }

  // ---------- GenerationResult（GenerationCore 输出，供 Presentation/POL 汇总） ----------
  // 字段：
  //   questions      : SemanticQuestion[]   通过校验的有效题（唯一语义边界）
  //   generatedCount : number               本 core 实际产出（有效）题数
  //   plannedCount   : number               接收的计划总量
  //   shortfall      : number               plannedCount - generatedCount（>=0；交还 POL，不自行补齐）
  //   failures       : Array<{cell, error, retries}>  cell 级失败明细
  //   metadata       : Object               { retryTotal, validatorStats, generatorIds, ids/seenKeys }
  //   status         : 'SUCCESS' | 'PARTIAL' | 'FAILED'
  function makeResult(questions, plan, shortfall, failures, metadata) {
    var requested = (plan && plan.targetTotal) || 0;
    var generated = Array.isArray(questions) ? questions.length : 0;
    var status = generated === 0 ? 'FAILED' : (generated < requested ? 'PARTIAL' : 'SUCCESS');
    return {
      questions: Array.isArray(questions) ? questions : [],
      generatedCount: generated,
      plannedCount: requested,
      shortfall: requested - generated,
      failures: Array.isArray(failures) ? failures : [],
      metadata: metadata || {},
      status: status
    };
  }

  // ---------- 最短可用循环（可执行链路样例） ----------
  // 一个 Cell 从计划进入实时执行的最小链路（供 GenerationCore 实现/测试对齐）：
  //   1. cell = normalizeCell(plan.cells[i])
  //   2. assert isValidCell(cell)
  //   3. sp = makeStrategyPlan(cell)                    → Strategy（本履约：直接映射，不重规划）
  //   4. gen = selectGenerator(cell)                     → GeneratorRegistry 选择（由注入层提供）
  //   5. raw = await gen.generate(sp)（原生产物）          → 若失败/数量不足 → retry（同 cell，最多 N 次）
  //   6. items = normalizeSemanticQuestion(raw)          → 语义收敛
  //   7. vr = validate(items)                            → Validator（纯质量门，不越权）
  //   8. accept vr.valid 的 items 入 questions           → 不足量记为 shortfall
  //   9. results 汇总为 GenerationResult                 → 返回 POL（生成层不自行补齐）

  var API = {
    VERSION: VERSION,
    CANONICAL_TYPES: CANONICAL_TYPES,
    GENERATION_CONTEXT_FIELDS: GENERATION_CONTEXT_FIELDS,
    PLANNING_CONTEXT_FIELDS: PLANNING_CONTEXT_FIELDS,
    normalizeCell: normalizeCell,
    isValidCell: isValidCell,
    normalizePlan: normalizePlan,
    makeStrategyPlan: makeStrategyPlan,
    makeCandidate: makeCandidate,
    makeValidationResult: makeValidationResult,
    makeResult: makeResult
  };

  global.GenerationContract = API;
  if (global.App && typeof global.App === 'object') global.App.GenerationContract = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof global !== 'undefined' ? global : this));