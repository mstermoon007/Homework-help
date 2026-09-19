'use strict';

/**
 * dev/p25/derive-semantic-families.js — P25-05 语义族映射派生（只读 KBL → kbl/teaching）
 *
 * 计划依据：P25-05「建立语义族，而不是 375 个 Generator」
 *   1. 一个语义族可服务多个 KP；2. 一个 KP 可属多个语义族；
 *   3. 不为每个 KP 建 Generator；4/5. Generator 负责生成、Strategy 负责传参，均不定义教材语义；
 *   6. 语义族必须可测试；7. 输出 KP → Semantic Family 映射。
 *
 * 数据纪律（与 P25-01/02/03 一致）：
 *   - 唯一事实源是 KBL（kbl/data/math/g1..g6/knowledge-points.json 的 semantic.family + name）；
 *   - 全部归属由本表规则机械匹配产生，每条归属携带 evidence（rule/field/matched），可逐条溯源；
 *   - 不做任何 AI 教学目标猜测；规则无法可靠区分的不硬判，落入 reviewFlags 列账；
 *   - KBL 粗 family（8 值）与语义族（15 值）的 crosswalk 一并输出，供 P25-06 Generator 参数化消费。
 *
 * 用法：
 *   node dev/p25/derive-semantic-families.js          重新生成 kbl/teaching/semantic-families.json
 *   node dev/p25/derive-semantic-families.js --check  不落盘；产物与已提交版本不一致则 exit 1（防漂移）
 *
 * 不变式（违反即 exit 1）：
 *   375 KP 全覆盖；每 KP ≥1 族；引用的族全部已定义；每条归属有证据。
 */

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve(__dirname, '..', '..');
var OUT = path.join(ROOT, 'kbl', 'teaching', 'semantic-families.json');
var VERSION = 'p25-05-v1';

function readJSON(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function fail(msg) {
  console.error('[P25-05] INVARIANT FAIL: ' + msg);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. 语义族词表（计划列出的 13 族 + 数据强证据要求的 number-sense / ratio-proportion）
//    planListed=true 表示在 P25 计划示例 13 族内；扩展 2 族在报告中说明依据。
// ---------------------------------------------------------------------------
var FAMILIES = [
  { id: 'number-sense',          name: '数的认识与代数初步', planListed: false,
    purpose: '数的意义/读写/数位/顺序/大小比较/近似数/负数/因数倍数等数论初步，及字母表示数' },
  { id: 'integer-arithmetic',    name: '整数四则运算',       planListed: true,
    purpose: '整数加减乘除的口算/笔算/竖式/混合运算/运算律——运算执行本身' },
  { id: 'multiplicative-relation', name: '乘除关系',         planListed: true,
    purpose: '乘除法含义、平均分、包含除、互逆关系、余数——乘法性数量关系的理解' },
  { id: 'multiple-ratio',        name: '倍数关系',           planListed: true,
    purpose: '倍的认识、求倍数/比较量/基准量——以「倍」表达的两个量比较关系' },
  { id: 'fraction',              name: '分数',               planListed: true,
    purpose: '分数意义/性质/约分通分/分数运算（含分数乘除，百分数是其特例，故多族重叠）' },
  { id: 'decimal',               name: '小数',               planListed: true,
    purpose: '小数意义/性质/小数点移动/小数运算/分数小数互化' },
  { id: 'percent',               name: '百分数',             planListed: true,
    purpose: '百分数意义及折扣/税率/利率/达标率等百分率应用' },
  { id: 'ratio-proportion',      name: '比与比例',           planListed: false,
    purpose: '比例意义与性质、解比例、正反比例、比例尺、图形放缩（计划未单列，g6 有独立单元）' },
  { id: 'unit-measurement',      name: '量与计量单位',       planListed: true,
    purpose: '人民币/时间/长度/质量等计量单位的认识、换算、进率与单位选择' },
  { id: 'geometric-figure',      name: '几何图形',           planListed: true,
    purpose: '平面/立体图形的认识、要素、特征、性质、分类——形本身' },
  { id: 'geometric-measurement', name: '图形测量',           planListed: true,
    purpose: '长度/角度/周长/面积/表面积/体积/容积的测量与计算——形的量化' },
  { id: 'spatial-reasoning',     name: '空间观念与图形运动', planListed: true,
    purpose: '观察物体、方向与位置、路线、平移/旋转/轴对称——空间想象与图形变换' },
  { id: 'statistics-probability', name: '统计与概率',        planListed: true,
    purpose: '分类统计、数据收集整理、统计图表、平均数、可能性' },
  { id: 'classification',        name: '分类与比较',         planListed: true,
    purpose: '按单一/多重标准分类、逐层分类——分类思想（统计学习的前置）' },
  { id: 'word-application',      name: '问题解决与综合实践', planListed: true,
    purpose: '解决问题/数量关系应用、数学广角策略（鸽巢/找次品/鸡兔同笼等）、综合实践' }
];

// primary 取舍优先级（下标越小越具体；同优先级按规则触发顺序）
var PRIMARY_PRIORITY = [
  ['multiple-ratio', 'percent', 'ratio-proportion', 'fraction', 'decimal'],
  ['multiplicative-relation', 'number-sense', 'unit-measurement'],
  ['geometric-measurement', 'geometric-figure', 'spatial-reasoning'],
  ['classification', 'statistics-probability'],
  ['integer-arithmetic'],
  ['word-application']
];
var PRIORITY_RANK = {};
PRIMARY_PRIORITY.forEach(function (tier, i) {
  tier.forEach(function (f) { PRIORITY_RANK[f] = i; });
});

// ---------------------------------------------------------------------------
// 2. 规则表。nameRe/unless 作用于 KP.name；coarse 限定 KBL 粗 family。
//    规则顺序 = 证据记录顺序；primary 由 PRIORITY_RANK 单独决定。
// ---------------------------------------------------------------------------
var ARITH_DOMAIN_NOISE = /分数|小数|百分|比例/;          // geometry 粗桶中的算术名（派生噪声）

var NAME_RULES = [
  // —— 数与代数领域 ——
  { id: 'percent-name', family: 'percent',
    re: /百分|折扣|利率|税率|达标线|成数/ },
  { id: 'ratio-name', family: 'ratio-proportion',
    re: /比例|正比|反比|比例尺|解比例|放大与缩小/ },
  { id: 'fraction-name', family: 'fraction',
    re: /分数|约分|通分|真分数|假分数|倒数/ },
  { id: 'decimal-name', family: 'decimal',
    re: /小数/ },
  { id: 'multiple-name', family: 'multiple-ratio',
    // 排除数论语境的「倍数的特征/概念」（由 number-theory 规则归 number-sense）
    re: /倍/, unless: /因数|质数|合数|奇数|偶数|倍数的特征|倍数的概念/ },
  { id: 'number-theory-name', family: 'number-sense',
    re: /因数|质数|合数|奇数|偶数|奇偶|倍数的特征|倍数的概念/ },
  { id: 'number-sense-name', family: 'number-sense',
    re: /数数|数的组成|读数|写数|读写|读法|写法|数位|数的顺序|比较.{0,6}大小|大小比较|比较大小|近似数|计数单位|十进制|数级|算盘|数轴|负数|正负数|百数表|字母|数的认识|0的认识|6和10的认识/,
    // 「倒数的认识」含子串「数的认识」但属分数族
    unless: /倒数/ },
  { id: 'integer-ops-name', family: 'integer-arithmetic',
    coarse: ['calculation', 'multiplication-division'],
    re: /加|减|乘|除|口算|笔算|竖式|脱式|运算|凑十|破十|平十|计算/,
    unless: /单位|换算|年、月|月、日|钟面|时间|人民币|百分|比例|小数|分数|负数|字母|因数|质数|合数|奇数|偶数|数位|读写|读法|写法|数的组成|数数|近似数|计数单位|十进制|数级|比较大小|大小比较|大小关系|百数表|平年|闰年|初步认识/ },
  // —— 量与计量 ——
  { id: 'unit-name', family: 'unit-measurement',
    re: /人民币|换算|长度单位|厘米|毫米|分米|千米|质量单位|千克|公斤|克|吨|钟面|时间单位|经过时间|平年|闰年|年、月、日|面积单位|体积单位|容积单位|单位进率|合适的.{0,4}单位|单位适用|常用长度单位|常用面积单位|认识.{0,6}单位|称重/ },
  // —— 图形领域 ——
  { id: 'geo-measure-name', family: 'geometric-measurement',
    coarse: ['geometry'],
    re: /周长|面积|表面积|体积|容积|度量|测量|长度|厘米|毫米|分米|千米/ },
  { id: 'spatial-name', family: 'spatial-reasoning',
    re: /观察|方向|位置|路线|数对|定位|平移|旋转|轴对称|对称|视图|空间观念|剪纸|设计图案/ },
  { id: 'geo-figure-name', family: 'geometric-figure',
    coarse: ['geometry', 'application-word'],
    re: /图形|角|线段|射线|直线|三角形|四边形|平行四边形|梯形|长方|正方|圆|扇形|圆柱|圆锥|多边形|密铺|涂色/ },
  // —— 统计与分类 ——
  { id: 'classify-name', family: 'classification',
    re: /分类/ },
  { id: 'statistics-name', family: 'statistics-probability',
    re: /统计|数据|统计表|统计图|条形|折线|平均数|可能性|确定性/ },
  // —— 问题解决/综合实践（弱归属，允许与任何领域族共存）——
  { id: 'word-name', family: 'word-application',
    re: /解决问题|应用题|数量关系|连环画|编码|实践|综合运用|数学广角|租船|重叠|等量代换|策略|优化|鸽巢|抽屉|找次品|探究|复习|小结|问题情境|解题模型|列表法|假设法|加法模型|乘法模型/ }
];

// 粗 family 基线规则（field=semantic.family 的证据）
var COARSE_BASE = {
  fraction: 'fraction',
  decimal: 'decimal',
  percent: 'percent',
  statistics: 'statistics-probability',
  'application-word': 'word-application'
};
// multiplication-division 粗桶中已知的异质 KP（由 name 规则归入正确领域，不挂乘除基线）
var MULTDIV_NONBASE = /平年|闰年|因数|质数|合数|奇数|偶数|奇偶|倍数的特征|倍数的概念|字母|反比例|无括号|运算顺序|四则混合/;

// ---------------------------------------------------------------------------
// 3. 载入 375 KP（只读 KBL）
// ---------------------------------------------------------------------------
function loadKps() {
  var all = [];
  for (var g = 1; g <= 6; g++) {
    var doc = readJSON('kbl/data/math/g' + g + '/knowledge-points.json');
    var rows = doc.knowledgePoints;
    if (!Array.isArray(rows)) {
      fail('kbl/data/math/g' + g + '/knowledge-points.json 缺少 knowledgePoints 数组');
    }
    rows.forEach(function (k) { all.push(k); });
  }
  return all;
}

function matchedText(re, s) {
  var m = String(s || '').match(re);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// 4. 单 KP 派生
// ---------------------------------------------------------------------------
function deriveKp(kp) {
  var name = kp.name || '';
  var coarse = (kp.semantic && kp.semantic.family) || null;
  var families = [];
  var evidence = [];
  var flags = [];

  function add(family, ruleId, field, matched) {
    if (families.indexOf(family) < 0) families.push(family);
    evidence.push({ family: family, rule: ruleId, field: field, matched: matched });
  }
  // 每族证据强度：name/unitName 直接命中=2，仅粗 family 默认=1（primary 同层时强证据优先）
  function strengthOf(family) {
    return evidence.reduce(function (best, e) {
      if (e.family !== family) return best;
      var s = (e.field === 'name' || e.field === 'unitName') ? 2 : (e.field === 'semantic.family+name' ? 2 : 1);
      return Math.max(best, s);
    }, 0);
  }

  // 4.1 粗 family 基线
  if (COARSE_BASE[coarse]) {
    add(COARSE_BASE[coarse], 'coarse-' + coarse, 'semantic.family', coarse);
  } else if (coarse === 'multiplication-division') {
    if (!MULTDIV_NONBASE.test(name)) {
      add('multiplicative-relation', 'coarse-multiplication-division', 'semantic.family', coarse);
    }
  } else if (coarse === 'geometry') {
    var unitName = kp.unitName || '';
    var arithByName = ARITH_DOMAIN_NOISE.test(name);
    var arithByUnit = /分数|小数|百分|比/.test(unitName);
    if (arithByName || arithByUnit) {
      // 被 derive-kbl 误标 geometry 的算术单元（如 g6-up-u02「分数乘法」）：
      // 不挂图形基线，按 name/unitName 事实归算术族，并列账待 root 修订
      flags.push('coarse-family-conflict');
      if (/分数/.test(unitName)) add('fraction', 'unitname-domain-fraction', 'unitName', unitName);
      if (/小数/.test(unitName)) add('decimal', 'unitname-domain-decimal', 'unitName', unitName);
      if (/百分/.test(unitName)) add('percent', 'unitname-domain-percent', 'unitName', unitName);
      if (/比/.test(unitName)) add('ratio-proportion', 'unitname-domain-ratio', 'unitName', unitName);
    } else if (/周长|面积|表面积|体积|容积|度量|测量|长度|厘米|毫米|分米|千米|单位|进率/.test(name)) {
      add('geometric-measurement', 'coarse-geometry-measure', 'semantic.family+name', coarse + ':' + (name.match(/周长|面积|表面积|体积|容积|度量|测量|长度|厘米|毫米|分米|千米|单位|进率/)[0]));
    } else if (/观察|方向|位置|路线|数对|平移|旋转|轴对称|对称|视图|空间观念/.test(name)) {
      add('spatial-reasoning', 'coarse-geometry-spatial', 'semantic.family+name', coarse + ':' + (name.match(/观察|方向|位置|路线|数对|平移|旋转|轴对称|对称|视图|空间观念/)[0]));
    } else {
      add('geometric-figure', 'coarse-geometry-default', 'semantic.family', coarse);
    }
  }
  // calculation 粗桶无默认族：名称异构，全部由 name 规则区分，零归属则列账

  // 4.2 name 规则（多族叠加）
  NAME_RULES.forEach(function (rule) {
    if (rule.coarse && rule.coarse.indexOf(coarse) < 0) return;
    if (rule.unless && rule.unless.test(name)) return;
    var hit = matchedText(rule.re, name);
    if (hit) add(rule.family, rule.id, 'name', hit);
  });

  if (families.length === 0) flags.push('unassigned');
  if (families.length >= 2) flags.push('multi-family');

  // 4.3 primary：优先级表最靠前的已归属族；同层按词表内固定顺序（classification 先于 statistics）
  var tierIndex = {};
  PRIMARY_PRIORITY.forEach(function (tier) {
    tier.forEach(function (f, i) { tierIndex[f] = i; });
  });
  var primary = families.slice().sort(function (a, b) {
    var pa = PRIORITY_RANK[a] != null ? PRIORITY_RANK[a] : 99;
    var pb = PRIORITY_RANK[b] != null ? PRIORITY_RANK[b] : 99;
    if (pa !== pb) return pa - pb;
    var sa = strengthOf(a), sb = strengthOf(b);
    if (sa !== sb) return sb - sa; // 同层：name/unitName 强证据优先于粗 family 默认
    var ta = tierIndex[a] != null ? tierIndex[a] : 99;
    var tb = tierIndex[b] != null ? tierIndex[b] : 99;
    if (ta !== tb) return ta - tb;
    return families.indexOf(a) - families.indexOf(b);
  })[0] || null;

  return { knowledgeId: kp.knowledgeId, name: name, coarseFamily: coarse,
    primaryFamily: primary, families: families, evidence: evidence, flags: flags };
}

// ---------------------------------------------------------------------------
// 5. 组装产物 + 不变式
// ---------------------------------------------------------------------------
function build() {
  var kps = loadKps();
  var assignments = kps.map(deriveKp);
  var definedIds = FAMILIES.map(function (f) { return f.id; });

  // 不变式
  var seen = {};
  assignments.forEach(function (a) {
    if (seen[a.knowledgeId]) fail('重复 knowledgeId: ' + a.knowledgeId);
    seen[a.knowledgeId] = 1;
    if (!a.knowledgeId) fail('存在无 knowledgeId 的 KP');
    if (a.families.length === 0) fail('零语义族归属: ' + a.knowledgeId + ' ' + a.name);
    a.families.forEach(function (f) {
      if (definedIds.indexOf(f) < 0) fail('引用未定义语义族: ' + f + ' @ ' + a.knowledgeId);
    });
    a.evidence.forEach(function (e) {
      if (!e.matched) fail('证据缺少 matched: ' + a.knowledgeId + ' ' + e.family);
    });
  });
  if (assignments.length !== 375) fail('KP 总数应为 375，实际 ' + assignments.length);

  // 每族至少 1 个 KP（无死族）
  var byFamily = {};
  definedIds.forEach(function (id) { byFamily[id] = 0; });
  assignments.forEach(function (a) {
    a.families.forEach(function (f) { byFamily[f]++; });
  });
  definedIds.forEach(function (id) {
    if (byFamily[id] === 0) fail('语义族无任何 KP（死族）: ' + id);
  });

  // 粗 family → 语义族 crosswalk（供 P25-06 Generator 映射）
  var crosswalk = {};
  assignments.forEach(function (a) {
    var key = a.coarseFamily || '(none)';
    if (!crosswalk[key]) crosswalk[key] = {};
    a.families.forEach(function (f) { crosswalk[key][f] = (crosswalk[key][f] || 0) + 1; });
  });

  var kpFamilies = {};
  assignments.forEach(function (a) {
    kpFamilies[a.knowledgeId] = {
      name: a.name,
      primary: a.primaryFamily,
      families: a.families,
      evidence: a.evidence,
      flags: a.flags.filter(function (fl) { return fl !== 'multi-family'; })
    };
  });

  var flagged = assignments.filter(function (a) {
    return a.flags.some(function (f) { return f !== 'multi-family'; });
  }).map(function (a) {
    return { knowledgeId: a.knowledgeId, name: a.name, flags: a.flags.filter(function (f) { return f !== 'multi-family'; }) };
  });

  return {
    meta: {
      schemaVersion: VERSION,
      derivedAt: '2026-09-19',
      derivedBy: 'dev/p25/derive-semantic-families.js',
      planStep: 'P25-05',
      source: 'kbl/data/math/g1..g6/knowledge-points.json（semantic.family + name 机械匹配，无 AI 推测）',
      status: 'kbl-derived',
      note: 'flags.coarse-family-conflict 标记 KBL 粗 family 与名称明显不一致的 KP（root 数据修订候选，不影响本映射正确性）'
    },
    families: FAMILIES,
    primaryPriority: PRIMARY_PRIORITY,
    rules: NAME_RULES.map(function (r) {
      return { id: r.id, family: r.family, re: r.re.source,
        unless: r.unless ? r.unless.source : null,
        coarse: r.coarse || null };
    }),
    coverage: {
      totalKp: assignments.length,
      multiFamilyKp: assignments.filter(function (a) { return a.families.length >= 2; }).length,
      byFamilyMembership: byFamily,
      byPrimaryFamily: definedIds.reduce(function (acc, id) {
        acc[id] = assignments.filter(function (a) { return a.primaryFamily === id; }).length;
        return acc;
      }, {}),
      flaggedCount: flagged.length
    },
    coarseToFamilyCrosswalk: crosswalk,
    flaggedAssignments: flagged,
    kpFamilies: kpFamilies
  };
}

function main() {
  var payload = build();
  var body = JSON.stringify(payload, null, 2) + '\n';

  if (process.argv.indexOf('--check') >= 0) {
    var current = fs.readFileSync(OUT, 'utf8');
    if (current !== body) {
      console.error('[P25-05] semantic-families.json 与派生结果不一致，请运行 node dev/p25/derive-semantic-families.js');
      process.exit(1);
    }
    console.log('[P25-05] semantic-families.json 与派生规则一致（' + payload.coverage.totalKp + ' KP，' +
      payload.families.length + ' 族，多族 ' + payload.coverage.multiFamilyKp + '，flagged ' + payload.coverage.flaggedCount + '）');
    return;
  }

  fs.writeFileSync(OUT, body, 'utf8');
  console.log('[P25-05] 已生成 ' + path.relative(ROOT, OUT));
  console.log('[P25-05] KP ' + payload.coverage.totalKp + ' | 族 ' + payload.families.length +
    ' | 多族 KP ' + payload.coverage.multiFamilyKp + ' | flagged ' + payload.coverage.flaggedCount);
  console.log('[P25-05] primary 分布: ' + JSON.stringify(payload.coverage.byPrimaryFamily));
  console.log('[P25-05] membership 分布: ' + JSON.stringify(payload.coverage.byFamilyMembership));
  if (payload.flaggedAssignments.length) {
    console.log('[P25-05] flagged 明细:');
    payload.flaggedAssignments.forEach(function (f) {
      console.log('  - ' + f.knowledgeId + ' ' + f.name + ' [' + f.flags.join(',') + ']');
    });
  }
}

if (require.main === module) main();
module.exports = { build: build, FAMILIES: FAMILIES, NAME_RULES: NAME_RULES };
