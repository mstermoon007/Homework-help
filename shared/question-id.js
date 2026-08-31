/**
 * shared/question-id.js — M5-R02 统一题目 ID / Seed / 版本 生成器
 *
 * 职责：
 *   - generateQuestionId(seed, context)  确定性 ID（同 seed+context 可复现）
 *   - generateSeed(plan, generatorId, index)  统一 seed 派生（Plan → Generator → 题号）
 *   - parseSeed(seedStr)  解析 seed 字符串
 *   - no Math.random() 任何位置
 *   - 基于 mulberry32 PRNG (shared/generator/core/rng.js)
 */
'use strict';

var Rng = require('./generator/core/rng.js');

var ID_PREFIX = 'q';
var SEED_DELIMITER = '|';
var SEED_PART_DELIMITER = ':';
var SEED_COUNTER = 0;

/**
 * 生成确定性题目 ID
 * 格式: q_<base36(timestamp)>_<base36(counter)>_<shortHash(seed)>
 * 或: q_<shortHash(seed+context)> (完全确定性)
 *
 * @param {string|number} seed 种子
 * @param {Object} context { generatorId, index, knowledgePointId, difficulty, questionType }
 * @returns {string}
 */
function generateQuestionId(seed, context) {
  var rng = Rng.createSeededRandom(seed);
  var parts = [ID_PREFIX];

  // 基于 seed+context 的短哈希（确定性）
  var ctxStr = '';
  if (context) {
    ctxStr = (context.generatorId || '') + SEED_DELIMITER +
             (context.index != null ? context.index : '') + SEED_DELIMITER +
             (context.knowledgePointId || '') + SEED_DELIMITER +
             (context.difficulty != null ? context.difficulty : '') + SEED_DELIMITER +
             (context.questionType || '');
  }
  var hash = Rng.hashSeed(String(seed) + ctxStr);
  parts.push(hash.toString(36));

  // 可选：时间戳前缀（便于排序/调试，不影响确定性）
  // parts.unshift(Date.now().toString(36));

  return parts.join('_');
}

/**
 * 派生子 seed（Plan → Generator → QuestionIndex）
 * 规则: seed = baseSeed:generatorId:index
 * 保证：相同 Plan + 相同 Generator + 相同 index → 相同 seed → 相同题目
 *
 * @param {string} baseSeed 基础种子（来自 Plan.context.seed 或 auto 生成）
 * @param {string} generatorId 生成器 ID
 * @param {number} index 题目索引 (0-based)
 * @returns {string} 派生 seed
 */
function deriveSeed(baseSeed, generatorId, index) {
  var cleanBase = String(baseSeed || 'auto').replace(/\|/g, '-');
  var cleanGen = String(generatorId).replace(/\|/g, '-');
  return [cleanBase, cleanGen, index].join(SEED_DELIMITER);
}

/**
 * 从 Plan 生成一批 seeds
 * @param {Object} plan { seed, generatorId, count }
 * @returns {string[]}
 */
function generateSeedsForPlan(plan) {
  var base = plan.seed || 'plan-' + Date.now();
  var genId = plan.generatorId || 'unknown';
  var count = plan.count || 1;
  var seeds = [];
  for (var i = 0; i < count; i++) {
    seeds.push(deriveSeed(base, genId, i));
  }
  return seeds;
}

/**
 * 解析 seed 字符串
 * @param {string} seedStr
 * @returns {Object} { base, generatorId, index, raw }
 */
function parseSeed(seedStr) {
  if (!seedStr) return { base: null, generatorId: null, index: null, raw: null };
  var parts = seedStr.split(SEED_DELIMITER);
  if (parts.length >= 3) {
    return {
      base: parts[0],
      generatorId: parts[1],
      index: parseInt(parts[2], 10),
      raw: seedStr
    };
  }
  return { base: seedStr, generatorId: null, index: null, raw: seedStr };
}

/**
 * 生成基础 seed（用于 Plan 初始化）
 * 优先使用传入的 seed，否则基于时间+计数器生成（非确定性场景兜底）
 * @param {string|number} [seed]
 * @returns {string}
 */
function generateBaseSeed(seed) {
  if (seed != null) return String(seed);
  // 兜底：时间+单调计数器（仅用于无种子场景，生产应始终显式传 seed；不使用 Math.random）
  SEED_COUNTER = (SEED_COUNTER || 0) + 1;
  return 'auto-' + Date.now().toString(36) + '-' + SEED_COUNTER.toString(36);
}

/**
 * 版本号生成/标准化
 * @param {string|number} v
 * @returns {string} semantic version "x.y.z"
 */
function normalizeVersion(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return '1.0.0';
}

/**
 * 组装完整 metadata 对象（可追溯三要素）
 * @param {Object} opts { generatorId, generatorVersion, seed, planId, timestamp }
 * @returns {Object}
 */
function createMetadata(opts) {
  opts = opts || {};
  return {
    generator: opts.generatorId || null,
    generatorVersion: normalizeVersion(opts.generatorVersion),
    seed: opts.seed || null,
    planId: opts.planId || null,
    timestamp: opts.timestamp || new Date().toISOString(),
    retryCount: opts.retryCount || 0,
    validationScore: null,
    tags: opts.tags || []
  };
}

module.exports = {
  generateQuestionId: generateQuestionId,
  deriveSeed: deriveSeed,
  generateSeedsForPlan: generateSeedsForPlan,
  parseSeed: parseSeed,
  generateBaseSeed: generateBaseSeed,
  normalizeVersion: normalizeVersion,
  createMetadata: createMetadata,
  Rng: Rng  // 导出底层 PRNG 供高级用法
};