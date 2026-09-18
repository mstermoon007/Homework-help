/**
 * shared/capacity/capacity-inventory.js — R3/R4 容量清单（只读 Capacity Map）
 *
 * 目标：将当前生成器的「实际有效容量」显式化，作为 Strategy / Budget 层的输入。
 * 不修改 KnowledgeBank 查询语义、不修改 Generator Capability Registry 职责、
 * 不保存生成执行函数；仅做只读扫描 + 缓存。
 *
 * 每条记录（KP × QuestionType 聚合为 KP 级容量）：
 *   { kpId, grade, subject, total, tier, byType, limited, limitedKind }
 *
 * 容量分级：ZERO / VERY_LOW / LOW / MEDIUM / HIGH
 *   ZERO     = 0
 *   VERY_LOW = 1~2
 *   LOW      = 3~9
 *   MEDIUM   = 10~19
 *   HIGH     = >=20
 *
 * R4 收缩分类（effectiveCapacity <= 2 的 KP）：
 *   EXPECTED_LIMITED  固定事实 / 固定识别 / 单一图形 / 唯一关系（理论空间本就极小）
 *   GENERATOR_LIMITED 生成器真实语义空间小，可扩容
 *   DEDUP_LIMITED     原始候选充足但被去重收缩（需原始计数佐证，见 scan 备注）
 *   ONTOLOGY_LIMITED  KP 本体语义狭窄（知识点定义层面）
 *
 * CLI：node dev/scan-capacity.js [--refresh]  重新扫描并写缓存。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var CACHE_FILE = path.join(__dirname, 'capacity-map.json');

// 难度分桶（P0-02：Capacity 与用户难度同维度）。
// 每桶以代表性难度采样（1-3→2，4-6→5，7-10→8）；10 满难度并入 7-10 桶。
var DIFFICULTY_BUCKETS = [
  { key: '1-3', min: 1, max: 3, sample: 2 },
  { key: '4-6', min: 4, max: 6, sample: 5 },
  { key: '7-10', min: 7, max: 10, sample: 8 }
];

function difficultyBucket(d) {
  var n = Number(d);
  if (!isFinite(n) || n < 1) n = 1;
  if (n > 10) n = 10;
  for (var i = 0; i < DIFFICULTY_BUCKETS.length; i++) {
    if (n >= DIFFICULTY_BUCKETS[i].min && n <= DIFFICULTY_BUCKETS[i].max) return DIFFICULTY_BUCKETS[i].key;
  }
  return '1-3';
}

// 引导生成层（仅扫描时需要）
// P13-04：优先使用已装载的浏览器等价全局（dev/_bundle-env.js / 页面）；
// 裸 require 冻结 Strategy 在 Node 侧不可解析（knowledge-point 依赖仅 bundle 兼容桥可解）。
function bootstrap() {
  var g = (typeof global !== 'undefined') ? global : {};
  var hasGlobals = g.KnowledgeContext && g.StrategyEngine && g.PresentationEngine;
  if (!hasGlobals) {
    [
      'shared/strategy/strategy-engine.js',
      'shared/strategy/strategy-request.js',
      'shared/strategy/question-plan.js',
      '../shared/generator/generator-registry.js',
      'shared/strategy/comprehensive-strategy.js',
      'shared/engine/presentation-engine.js',
      'shared/presentation/renderer.js',
      'shared/presentation/render-options.js',
      'shared/capability/capability-resolver.js',
      'shared/capability/knowledge-capability-view.js',
      'shared/knowledge/question-type-registry.js'
    ].forEach(function (p) { require(path.join(ROOT, p)); });
  }
  var KC = g.KnowledgeContext || require(path.join(ROOT, 'shared/orchestration/knowledge-context.js'));
  return {
    GE: g.GenerationEngine || require(path.join(ROOT, 'shared/engine/generation-engine.js')),
    KC: KC,
    KCV: g.KnowledgeCapabilityView || require(path.join(ROOT, 'shared/capability/knowledge-capability-view.js')),
    QTR: g.QuestionTypeRegistry || require(path.join(ROOT, 'shared/knowledge/question-type-registry.js'))
  };
}

// P0-02/§20：某 KP 在能力视图下「直接支持（ALLOW）」的题型候选。
function allowedTypesFor(KCV, QTR, kpId) {
  var ALL = QTR.TYPES.map(function (t) { return t.id; });
  try {
    var ev = KCV.buildEligibility([kpId], ALL);
    var eligible = KCV.eligibleTypes(ev, ALL, [kpId]) || [];
    var m = (ev.matrix && ev.matrix[kpId]) || {};
    return eligible.filter(function (t) { return m[t] === 'ALLOW'; });
  } catch (e) {
    return [];
  }
}

function tierOf(cap) {
  if (cap <= 0) return 'ZERO';
  if (cap <= 2) return 'VERY_LOW';
  if (cap <= 9) return 'LOW';
  if (cap <= 19) return 'MEDIUM';
  return 'HIGH';
}

// 固定事实 / 固定识别 / 单一图形类——理论空间本就极小，属 EXPECTED_LIMITED。
var EXPECTED_PATTERNS = [
  /-(solid-shape|flat-shape|count-graph|shape-combine|draw-shape|position|match-shape|match-angle|clock-draw|draw-line|draw-angle|measure|motion|grid-draw)$/,
  /-(rmb-unit|rmb-calc)$/,
  /-(angle-basic|angle-recognize)$/,
  /-(polygon|perimeter|area)$/
];

function classifyLimited(kpId, cap, byType) {
  if (cap > 2) return null;
  var types = Object.keys(byType || {});
  var fixedType = types.every(function (t) {
    return /^(recognize|geometry|judge|fill)$/.test(t);
  });
  if (EXPECTED_PATTERNS.some(function (re) { return re.test(kpId); }) || fixedType) {
    return 'EXPECTED_LIMITED';
  }
  // 无原始计数佐证时，默认归为 GENERATOR_LIMITED（真实语义空间小，可扩容）；
  // 若后续接入 rawCount 可细分 DEDUP_LIMITED / ONTOLOGY_LIMITED。
  return 'GENERATOR_LIMITED';
}

function allMathKps(KC) {
  var out = [];
  for (var g = 1; g <= 6; g++) {
    (KC.kpsForGrade('math', g) || []).forEach(function (kp) {
      out.push({ kpId: kp.knowledgeId, grade: g, subject: 'math' });
    });
  }
  return out;
}

/**
 * 扫描全部 math KP 的有效容量（按难度分桶）。
 * @param {Object} [opts] { count=128, refresh=true, difficulties=[2,5,8] | [1..10] }
 *   difficulties 传 null/[] 时仅扫 1-3 桶（与旧版行为一致，顶层字段即该桶）。
 * @returns {Object} capacityMap:
 *   map[kpId] = {
 *     kpId, grade, subject,
 *     total, tier, byType,           // 顶层 = 1-3 桶代表值（向后兼容）
 *     byDifficulty: { '1-3': {total,tier,byType}, '4-6': {...}, '7-10': {...} },
 *     limited, limitedKind
 *   }
 */
function scan(opts) {
  opts = opts || {};
  var COUNT = opts.count || 128;
  var samples = Array.isArray(opts.difficulties) && opts.difficulties.length
    ? opts.difficulties.slice()
    : DIFFICULTY_BUCKETS.map(function (b) { return b.sample; });
  var mods = bootstrap();
  var GE = mods.GE, KC = mods.KC, KCV = mods.KCV, QTR = mods.QTR;
  var kps = allMathKps(KC);
  // P13-04：可选 KP 过滤（分批复建 / 采样测速；不改变全量语义）
  if (Array.isArray(opts.kpIds) && opts.kpIds.length) {
    var keep = {};
    opts.kpIds.forEach(function (id) { keep[id] = true; });
    kps = kps.filter(function (e) { return keep[e.kpId]; });
  }
  var map = {};

  function scanKp(entry, difficulty) {
    var byType = {};
    var p;
    try {
      // 单 KP 模式，请求大数；以该难度真实产出（去重后有效题数）作为该桶容量。
      p = GE.generate({ knowledgePointIds: [entry.kpId], mode: 'single-kp', grade: entry.grade, count: COUNT, difficulty: difficulty }, {});
    } catch (e) {
      p = Promise.resolve(null);
    }
    return Promise.resolve(p).then(function (res) {
      var qs = (res && res.questions) || [];
      qs.forEach(function (q) {
        var t = q.questionType || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
      });
      // §20/§18：补充「能力视图 ALLOW、但通用扫描未产出」的题型容量——
      // 以该题型单类型请求的真实产出作为该 KP×题型 容量（分类/选择等非主导题型得以显式化）。
      var allowed = allowedTypesFor(KCV, QTR, entry.kpId).filter(function (t) { return !byType[t]; });
      return Promise.all(allowed.map(function (t) {
        try {
          return GE.generate({
            knowledgePointIds: [entry.kpId], mode: 'single-kp', grade: entry.grade,
            count: COUNT, difficulty: difficulty,
            questionTypes: [t], typeCounts: [{ questionType: t, count: COUNT }]
          }, {});
        } catch (e) {
          return Promise.resolve(null);
        }
      })).then(function (probes) {
        probes.forEach(function (pr, i) {
          var t = allowed[i];
          byType[t] = (pr && pr.questions) ? pr.questions.filter(function (q) { return q.questionType === t; }).length : 0;
        });
        return { total: qs.length, byType: byType };
      });
    }).catch(function () {
      return { total: 0, byType: byType };
    });
  }

  var guard = 0;
  var promises = kps.map(function (entry) {
    if (++guard > 2000) return Promise.resolve();
    return Promise.all(samples.map(function (d) { return scanKp(entry, d); }))
      .then(function (resList) {
        var byDifficulty = {};
        resList.forEach(function (res, i) {
          var key = difficultyBucket(samples[i]);
          // 同桶若被多采样点命中，取后写覆盖（抽样代表性一致）
          byDifficulty[key] = { total: res.total, tier: tierOf(res.total), byType: res.byType };
        });
        var base = byDifficulty[difficultyBucket(samples[0])] || byDifficulty['1-3'] || { total: 0, tier: 'ZERO', byType: {} };
        commit(entry, base.total, base.byType, map, byDifficulty);
      });
  });
  return Promise.all(promises).then(function () { return map; });
}

function commit(entry, cap, byType, map, byDifficulty) {
  var tier = tierOf(cap);
  var limited = cap <= 2;
  map[entry.kpId] = {
    kpId: entry.kpId,
    grade: entry.grade,
    subject: entry.subject,
    total: cap,
    tier: tier,
    byType: byType,
    byDifficulty: byDifficulty || null,
    limited: limited,
    limitedKind: limited ? classifyLimited(entry.kpId, cap, byType) : null
  };
}

/**
 * 读取 Capacity Map（缓存优先；缺失或 refresh 时扫描）。
 * @param {Object} [opts] { refresh }
 * @returns {Promise<Object>}
 */
function getCapacityMap(opts) {
  opts = opts || {};
  if (!opts.refresh && fs.existsSync(CACHE_FILE)) {
    try {
      var cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (cached && cached.map && Object.keys(cached.map).length) {
        return Promise.resolve(cached.map);
      }
    } catch (e) { /* ignore, rescan */ }
  }
  return scan({ refresh: true, count: opts.count, kpIds: opts.kpIds, difficulties: opts.difficulties }).then(function (map) {
    writeCache(map);
    return map;
  });
}

function writeCache(map) {
  var tiers = {};
  Object.keys(map).forEach(function (k) { var t = map[k].tier; tiers[t] = (tiers[t] || 0) + 1; });
  fs.writeFileSync(CACHE_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), tiers: tiers, map: map }, null, 2));
}

/** R4：低容量 KP 收缩报告 */
function collapseReport(map) {
  var buckets = { GENERATOR_LIMITED: [], DEDUP_LIMITED: [], ONTOLOGY_LIMITED: [], EXPECTED_LIMITED: [] };
  Object.keys(map).forEach(function (k) {
    var e = map[k];
    if (e.limited && e.limitedKind) buckets[e.limitedKind].push(e.kpId);
  });
  return buckets;
}

/**
 * 取某 KP 在指定用户难度下的容量条目（按难度分桶；无分桶缓存时回退顶层代表值）。
 * @param {Object} map capacityMap
 * @param {string} kpId
 * @param {number} [difficulty] 1-10，默认 3
 * @returns {{total:number,tier:string,byType:Object}|null}
 */
function getCapacityFor(map, kpId, difficulty) {
  if (!map) return null;
  var e = map[kpId];
  if (!e) return null;
  var key = difficultyBucket(difficulty);
  if (e.byDifficulty && e.byDifficulty[key]) return e.byDifficulty[key];
  return { total: e.total, tier: e.tier, byType: e.byType || {} };
}

module.exports = {
  scan: scan,
  getCapacityMap: getCapacityMap,
  collapseReport: collapseReport,
  tierOf: tierOf,
  classifyLimited: classifyLimited,
  difficultyBucket: difficultyBucket,
  getCapacityFor: getCapacityFor,
  DIFFICULTY_BUCKETS: DIFFICULTY_BUCKETS,
  CACHE_FILE: CACHE_FILE
};
