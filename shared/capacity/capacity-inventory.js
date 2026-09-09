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

// 引导生成层（仅扫描时需要）
function bootstrap() {
  [
    'shared/strategy/strategy-engine.js',
    'shared/strategy/strategy-request.js',
    'shared/strategy/question-plan.js',
    'shared/knowledge/knowledge-bank.js',
    'shared/generator/generator-registry.js',
    'shared/strategy/comprehensive-strategy.js',
    'shared/engine/presentation-engine.js',
    'shared/presentation/renderer.js',
    'shared/presentation/render-options.js'
  ].forEach(function (p) { require(path.join(ROOT, p)); });
  return {
    GE: require(path.join(ROOT, 'shared/engine/generation-engine.js')),
    KB: require(path.join(ROOT, 'shared/knowledge/knowledge-bank.js'))
  };
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

function allMathKps(KB) {
  var out = [];
  for (var g = 1; g <= 6; g++) {
    var grade = KB.findGrade('math', g);
    if (!grade) continue;
    (grade.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push({ kpId: kp.id, grade: g, subject: 'math' });
      });
    });
  }
  return out;
}

/**
 * 扫描全部 math KP 的有效容量。
 * @param {Object} [opts] { count=128, refresh=true }
 * @returns {Object} capacityMap: { kpId: {kpId,grade,subject,total,tier,byType,limited,limitedKind} }
 */
function scan(opts) {
  opts = opts || {};
  var COUNT = opts.count || 128;
  var mods = bootstrap();
  var GE = mods.GE, KB = mods.KB;
  var kps = allMathKps(KB);
  var map = {};
  var promises = kps.map(function (entry) {
    var byType = {};
    var p;
    try {
      // 单 KP 模式，请求大数；R1 后 PARTIAL 可交付真实容量（去重后有效题数）。
      p = GE.generate({ knowledgePointIds: [entry.kpId], mode: 'single-kp', grade: entry.grade, count: COUNT, difficulty: 3 }, {});
    } catch (e) {
      p = Promise.resolve(null);
    }
    return Promise.resolve(p).then(function (res) {
      var qs = (res && res.questions) || [];
      qs.forEach(function (q) {
        var t = q.questionType || 'unknown';
        byType[t] = (byType[t] || 0) + 1;
      });
      commit(entry, qs.length, byType, map);
    }).catch(function () {
      commit(entry, 0, byType, map);
    });
  });
  return Promise.all(promises).then(function () { return map; });
}

function commit(entry, cap, byType, map) {
  var tier = tierOf(cap);
  var limited = cap <= 2;
  map[entry.kpId] = {
    kpId: entry.kpId,
    grade: entry.grade,
    subject: entry.subject,
    total: cap,
    tier: tier,
    byType: byType,
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
  return scan({ refresh: true }).then(function (map) {
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

module.exports = {
  scan: scan,
  getCapacityMap: getCapacityMap,
  collapseReport: collapseReport,
  tierOf: tierOf,
  classifyLimited: classifyLimited,
  CACHE_FILE: CACHE_FILE
};
