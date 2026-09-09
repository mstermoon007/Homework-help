// dev/audit/kb-data-completion.js
/**
 * C5 知识库基础数据补齐审计（只读审计 + 报告生成，不修改任何源数据）
 *
 * 背景：549 个 math KP 中 operations 缺 503、category 缺 503、
 *   prerequisites 空 18、related 空 3。
 *
 * 处理原则（与 .trae/documents/生成质量收口工程_plan.md C5 一致）：
 *   FILLED      —— 原始记录已显式填写（教材事实明确）
 *   DERIVED     —— 可由 ontology 确定性推导（operations：OpsMap plugin→ops；
 *                  category：id/name 领域词法规则，46 条原始真值 100% 回放验证）
 *   UNRESOLVED  —— 无确定性依据，留空禁猜（统计与概率 KP 在
 *                  algebra/measurement/geometry/synthesis 四域分类法中无槽位）
 *   NO_PREREQUISITE / INTENTIONALLY_EMPTY —— 根节点/综合入口，空数组合法
 *
 * 输出：dev/reports/kb-data-completion-report.json
 * 运行：node dev/audit/kb-data-completion.js
 */
'use strict';

var fs = require('fs');
var path = require('path');

global.window = global;
require(path.join(__dirname, '../../shared/knowledge/knowledge-bank.js'));
require(path.join(__dirname, '../../shared/knowledge/knowledge-math.js'));
var OpsMap = require(path.join(__dirname, '../../shared/knowledge/ontology-operation-map.js'));

var KB = global.KnowledgeBank;

function loadAll() {
  var out = [];
  KB.math.forEach(function (g) {
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push(Object.assign({ grade: g.grade, moduleId: m.moduleId }, kp));
      });
    });
  });
  return out;
}

// ============ category 词法规则（有序，先命中先生效；返回 {value, rule} 或 null） ============

function nonEmpty(v) { return Array.isArray(v) ? v.length > 0 : !!v; }

/**
 * 领域判定规则。分类法（生成引擎消费方 = composite 模式路由 + selector 算术域）：
 *   algebra     数与代数（运算/方程/分数小数百分数/比/数论/规律/行程/工程/策略推理等）
 *   measurement 量与计量（人民币/时间/长度/质量/面积体积单位换算与测量活动）
 *   geometry    图形与几何（图形认识/角/线/周长面积体积概念计算/图形运动/位置方向）
 *   synthesis   综合与跨域（题型综合/竞赛综合组卷/购物等跨域应用）
 */
function deriveCategory(kp) {
  var id = (kp.id || '').toLowerCase();
  var name = kp.name || '';

  // R1 synthesis：显式组卷/题型综合（判断题综合/选择题综合）、竞赛综合卷、跨域购物。
  // 注意：「数字推理综合」「行程综合」等尾部"综合"是难度修饰，不在此列。
  if (/(判断|选择)题综合|综合应用|杂题选讲|模拟竞赛/.test(name)) return { value: 'synthesis', rule: 'R1a-name-mixed' };
  if (/购物/.test(name) || /(?:^|-)shopping(?:-|$)/.test(id)) {
    return { value: 'synthesis', rule: 'R1b-shopping-cross-domain' };
  }

  // R2 统计与概率 → 四域分类法无槽位 → UNRESOLVED（禁猜）
  var statsId = /(^|-)(stats?|data-tally|data-question|possib\w*|possible|pie-chart|linechart|stats-line\d|match-chart|judge-chart|choice-chart|pic-pie-chart|stat-pie-chart|stat-possibility|fill-pie-chart|fill-linechart|fill-possible|word-possib|word-linechart|stats-bar|stats-double|stats-avg|stats-table|stats-possib\w*|stats-line\d|fill-avg|word-avg)(-|$)/;
  if (statsId.test(id) || /统计|可能性|平均数|折线|条形统计图?|扇形统计图?|数据收集/.test(name)) {
    return { value: null, rule: 'R2-stats-no-taxonomy-slot' };
  }

  // R3 geometry：竞赛 C4 几何模块 + 几何 id 词（先于通用词，保证跨域词不误伤）
  var geomId = /(^|-)c4-|geom(?:etry|count|etric)|solid|flat-shape|shape|count-graph|angle|protractor|quad|tri(?!ple)|circle|cyl(?:inder)?|cone(?!centration)|perimeter|(?:^|-)area|lattice|pythagorean|painted-cube|transform|(?:^|-)sym|symmet|rotat|draw-move|(?:^|-)motion|draw-net|grid|draw-view|draw-observe|position|coord|(?:^|-)pa(?:-|$)|draw-para|(?:^|-)line(?:-|$)|draw-height/;
  // 数形结合（数与形规律）本质是数列/模式推理 → algebra，显式排除 shape 误伤
  if (/reason-number-shape/.test(id)) return { value: 'algebra', rule: 'R5c-number-shape-pattern' };
  if (/(^|-)c4-/.test(id)) return { value: 'geometry', rule: 'R3a-c4-geometry-module' };
  if (/(^|-)(geomcount|geometry-counting)/.test(id)) return { value: 'geometry', rule: 'R3b-geometry-counting' };
  // 行程模块 C5 的「时钟问题」是行程题（钟面相遇），algebra 须先于 measurement 的 clock 词
  if (/(^|-)c5-/.test(id)) return { value: 'algebra', rule: 'R5a-journey-module' };
  // 逻辑模块 C8（最值/抽屉/逻辑推理/对策）：名称中「对称」等为策略术语，非几何概念
  if (/(^|-)c8-/.test(id)) return { value: 'algebra', rule: 'R5e-logic-module' };
  // 线段图是代数应用题图示，不是几何（看图列式模块 M7）
  if (/\uff08?[^）]*线段图|线段图/.test(name)) return { value: 'algebra', rule: 'R5d-segment-diagram' };
  if (geomId.test(id)) return { value: 'geometry', rule: 'R3c-geometry-id-token' };

  // R4 measurement（id 层，先于几何/计量的名称层判定）：
  //   量与计量（单位/换算/测量/人民币/时间；c5 行程时钟已在 R5a 先行排除）
  var measId = /(^|-)(rmb|money|clock|time|year-month|length|mass|weight|measure|unit-convert|match-unit|fill-(?:length|mass|time)|length-(?:unit|app)|mass-(?:unit|app)|time-unit|hectare)(-|$)/;
  if (measId.test(id)) return { value: 'measurement', rule: 'R4a-measurement-id-token' };

  // 名称层几何（id 无强信号时；测量线段已在 id 层判 measurement）
  if (/图形|角[的度类型与]|量角|画角|角度|线段(?!图)|射线|直线|平行|垂直|梯形|三角形|长方|正方|圆[的周角]?|圆柱|圆锥|周长|面积|体积|表面积|展开图|对称|平移|旋转|放大|缩小|位置|方向|数对|观察物体|几何|勾股|扇形|格点|鸟头|蝴蝶|燕尾|等积|割补|涂色|棱[，、]|锥[体]/.test(name)) {
    return { value: 'geometry', rule: 'R3d-geometry-name-token' };
  }

  // 名称层计量
  if (/人民币|元角分|钟面|钟表|时、分、秒|时分秒|时间单位|长度单位|质量单位|面积单位|体积单位|容积单位|单位换算|填合适[^，。]*单位|单位与物品|测量|公顷|平方千米|年、月、日|长度|质量|重量/.test(name)) {
    return { value: 'measurement', rule: 'R4b-measurement-name-token' };
  }

  // R5 algebra：其余数学 KP（数与代数/策略应用）
  //   C1 数字谜 / C2 数论 / C3 组合计数 / C6 工程浓度 / C7 巧算 / C8 逻辑最值
  //   M10 数学广角（逻辑/数独/搭配/握手/排队/植树/找次品/集合/鸽巢）均为数与代数应用推理
  return { value: 'algebra', rule: 'R5b-number-algebra-default' };
}

// ============ prerequisites/related 空项人工复核结论 ============
//
// 分类依据：库内同作者既有约定（如 clock-draw 前置 clock-read；c9 竞赛题前置对应
// application KP：chicken-rabbit→g4-word-cr、age→g4-word-div；c5-basic g5→g4-c5-basic）。
// NO_PREREQUISITE  = 主题/策略链在库起点（无更早在库 KP 可引用；主题内关系走 related）
// INTENTIONALLY_EMPTY = 综合/组卷入口，跨全部已学技能，无单一前置与单点关联
// C5 已据强证据补填 3 条边（见 C5_PREREQ_FILLED，审计中自然计入 FILLED）。

var PREREQ_CLASSIFICATION = {
  'math-g1-m0-make-ten':          { status: 'NO_PREREQUISITE', reason: '巧算策略链起点：平十/破十/凑十变式以其为前置；carry-add-20 将 addsub-10 与 make-ten 并列引用（平行基础，非其前置）' },
  'math-g1-m4-compose-number':    { status: 'NO_PREREQUISITE', reason: '数概念链起点：digit-place/split-number 均为其后续关联节点' },
  'math-g1-m6-solid-shape':       { status: 'NO_PREREQUISITE', reason: '几何主题在库起点：g1 无更早几何 KP，flat-shape 为关联节点' },
  'math-g1-m6-position':          { status: 'NO_PREREQUISITE', reason: '位置与方向主题起点：空间方位初识，库内无前置' },
  'math-g1-m13-multiplication-table': { status: 'NO_PREREQUISITE', reason: '乘法主题在库起点：g2 表内乘法仅以 addsub-10 为前置，本节点为 g1 乘法启蒙' },
  'math-g2-m4-number-pattern':    { status: 'NO_PREREQUISITE', reason: '规律/推理主题起点：g1 无规律 KP；g2-m10-logic-reasoning 为关联而非前置' },
  'math-g2-m4-clock-read':        { status: 'NO_PREREQUISITE', reason: '时间主题在库起点：g1 无钟表 KP；clock-draw 以其为前置可证其为链首' },
  'math-g2-m9-data-tally':        { status: 'NO_PREREQUISITE', reason: '统计主题起点：data-question 为其后续关联节点' },
  'math-g5-m10-g5-reason-seq':    { status: 'NO_PREREQUISITE', reason: 'g5 数学广角新主题入口：关联 logic-reasoning/g6 数形推理，无在库直接技能前置' },
  'math-g5-c7-arithmetic-series': { status: 'NO_PREREQUISITE', reason: '数列主题首次出现：与 c9-periodic 互为关联；g2 number-pattern 为弱主题关联（属 related 层面）' },
  'math-g5-c9-periodic-problem':  { status: 'NO_PREREQUISITE', reason: '周期模型竞赛新题：related 关联 arithmetic-series，无在库直接前置' },
  'math-g5-c9-grass-problem':     { status: 'NO_PREREQUISITE', reason: '牛吃草竞赛新模型：work-problem 关联作者置于 related（同类参照，非必掌前置）' },
  'math-g4-c9-c9-integrated':     { status: 'INTENTIONALLY_EMPTY', reason: '综合应用题：跨域组卷入口，无单一前置 KP 与单点关联' },
  'math-g4-c9-c9-misc':           { status: 'INTENTIONALLY_EMPTY', reason: '杂题选讲（统筹/操作）：组卷入口，技能面开放' },
  'math-g4-c9-c9-mock':           { status: 'INTENTIONALLY_EMPTY', reason: '模拟竞赛卷：整卷综合入口，无单点前置/关联' }
};

// related 空项仅 G4 C9 三题（与 prerequisites 同因）。
var RELATED_CLASSIFICATION = {
  'math-g4-c9-c9-integrated': { status: 'INTENTIONALLY_EMPTY', reason: '综合组卷入口：关联面为全部已学技能，无单点 related' },
  'math-g4-c9-c9-misc':       { status: 'INTENTIONALLY_EMPTY', reason: '杂题选讲组卷入口：同上' },
  'math-g4-c9-c9-mock':       { status: 'INTENTIONALLY_EMPTY', reason: '模拟竞赛卷组卷入口：同上' }
};

// C5 据强约定证据补填的 prerequisites 边（审计执行时这些节点已计入 FILLED）。
var C5_PREREQ_FILLED = [
  { id: 'math-g2-m4-time-unit', added: ['math-g2-m4-clock-read'],
    evidence: '同链约定：clock-draw 前置 clock-read；换算以认读为基础（作者已在 related 引用 clock-draw/fill-time）' },
  { id: 'math-g3-m4-g3-time', added: ['math-g2-m4-clock-read'],
    evidence: '跨级直承约定：同模块 g3-year-month 前置 g3-time；时、分、秒直承 g2 时间认读' },
  { id: 'math-g5-c9-planting-problem', added: ['math-g5-m8-g5-word-tree'],
    evidence: 'c9 约定：竞赛题前置对应 application KP（chicken-rabbit→g4-word-cr、age→g4-word-div）；植树链 g5-m7 示意图→g5-m8 应用题→c9 竞赛' }
];

// ============ 执行审计 ============

function run() {
  var all = loadAll();
  var records = [];
  var sum = {
    total: all.length,
    operations: { FILLED: 0, DERIVED: 0, UNRESOLVED: 0 },
    category: { FILLED: 0, DERIVED: 0, UNRESOLVED: 0 },
    prerequisites: { FILLED: 0, NO_PREREQUISITE: 0, INTENTIONALLY_EMPTY: 0, MISSING: 0 },
    related: { FILLED: 0, INTENTIONALLY_EMPTY: 0, MISSING: 0 }
  };
  var groundTruthMismatch = [];
  var unknownEmpty = [];

  all.forEach(function (kp) {
    var rec = { id: kp.id, name: kp.name, grade: kp.grade, moduleId: kp.moduleId };

    // ---- operations ----
    if (nonEmpty(kp.operations)) {
      rec.operations = { status: 'FILLED', values: kp.operations.slice() };
      sum.operations.FILLED++;
    } else {
      var ops = OpsMap.operationsForPlugin(kp.pluginId);
      if (Array.isArray(ops) && ops.length) {
        rec.operations = { status: 'DERIVED', derivedFrom: 'ontology-operation-map:plugin:' + kp.pluginId, values: ops.slice() };
        sum.operations.DERIVED++;
      } else {
        rec.operations = { status: 'UNRESOLVED' };
        sum.operations.UNRESOLVED++;
      }
    }

    // ---- category ----
    if (kp.category) {
      rec.category = { status: 'FILLED', value: kp.category };
      sum.category.FILLED++;
      // 真值回放：规则结论必须与原始填写一致
      var d = deriveCategory(kp);
      if (d.value !== kp.category) {
        groundTruthMismatch.push({ id: kp.id, name: kp.name, raw: kp.category, derived: d.value, rule: d.rule });
      }
    } else {
      var r = deriveCategory(kp);
      if (r.value) {
        rec.category = { status: 'DERIVED', value: r.value, rule: r.rule };
        sum.category.DERIVED++;
      } else {
        rec.category = { status: 'UNRESOLVED', reason: r.rule };
        sum.category.UNRESOLVED++;
      }
    }

    // ---- prerequisites ----
    if (Array.isArray(kp.prerequisites) && kp.prerequisites.length) {
      rec.prerequisites = { status: 'FILLED', count: kp.prerequisites.length };
      sum.prerequisites.FILLED++;
    } else if (PREREQ_CLASSIFICATION[kp.id]) {
      rec.prerequisites = { status: PREREQ_CLASSIFICATION[kp.id].status, reason: PREREQ_CLASSIFICATION[kp.id].reason };
      sum.prerequisites[PREREQ_CLASSIFICATION[kp.id].status]++;
    } else {
      rec.prerequisites = { status: 'MISSING' };
      sum.prerequisites.MISSING++;
      unknownEmpty.push({ field: 'prerequisites', id: kp.id, name: kp.name });
    }

    // ---- related ----
    if (Array.isArray(kp.related) && kp.related.length) {
      rec.related = { status: 'FILLED', count: kp.related.length };
      sum.related.FILLED++;
    } else if (RELATED_CLASSIFICATION[kp.id]) {
      rec.related = { status: 'INTENTIONALLY_EMPTY', reason: RELATED_CLASSIFICATION[kp.id].reason };
      sum.related.INTENTIONALLY_EMPTY++;
    } else {
      rec.related = { status: 'MISSING' };
      sum.related.MISSING++;
      unknownEmpty.push({ field: 'related', id: kp.id, name: kp.name });
    }

    records.push(rec);
  });

  return { records: records, summary: sum, groundTruthMismatch: groundTruthMismatch, unknownEmpty: unknownEmpty };
}

function main() {
  var result = run();

  console.log('=== C5 知识库字段补齐审计 ===');
  console.log('KP 总数:', result.summary.total);
  console.log('operations :', JSON.stringify(result.summary.operations));
  console.log('category   :', JSON.stringify(result.summary.category));
  console.log('prerequisites:', JSON.stringify(result.summary.prerequisites));
  console.log('related    :', JSON.stringify(result.summary.related));
  console.log('真值回放不一致:', result.groundTruthMismatch.length);
  result.groundTruthMismatch.forEach(function (m) {
    console.log('  MISMATCH', m.id, m.name, 'raw=', m.raw, 'derived=', m.derived, m.rule);
  });
  console.log('未分类空项（MISSING，应为 0）:', result.unknownEmpty.length);
  result.unknownEmpty.forEach(function (e) {
    console.log('  UNKNOWN-EMPTY', e.field, e.id, '|', e.name);
  });

  // 空项分类明细
  ['NO_PREREQUISITE', 'INTENTIONALLY_EMPTY'].forEach(function (st) {
    var list = result.records.filter(function (r) { return r.prerequisites.status === st; });
    console.log('--- prerequisites ' + st + ' (' + list.length + ') ---');
    list.forEach(function (r) { console.log('  ', r.id, '|', r.name); });
  });

  // UNRESOLVED 清单
  var unresolved = result.records.filter(function (r) { return r.category.status === 'UNRESOLVED'; });
  console.log('--- category UNRESOLVED (' + unresolved.length + ') ---');
  unresolved.forEach(function (r) { console.log('  ', r.id, '|', r.name); });

  // DERIVED category 按规则分布
  var byRule = {};
  result.records.forEach(function (r) {
    if (r.category.status === 'DERIVED') byRule[r.category.rule] = (byRule[r.category.rule] || 0) + 1;
  });
  console.log('--- category DERIVED 规则分布 ---');
  Object.keys(byRule).sort().forEach(function (k) { console.log('  ', k, byRule[k]); });

  var outPath = path.join(__dirname, '../reports/kb-data-completion-report.json');
  var report = {
    meta: {
      generatedAt: new Date().toISOString(),
      scope: 'math 549 KP',
      taxonomy: 'algebra / measurement / geometry / synthesis',
      note: 'DERIVED category 规则经 46 条原始 FILLED 真值 100% 回放验证；UNRESOLVED 为统计与概率域（四域分类法无槽位，留空禁猜）；prerequisites/related 空项逐条人工复核（12 主题起点 + 3 组卷入口），另据库内约定证据补填 3 条 prerequisites 边（见 c5PrereqCompletions）'
    },
    summary: result.summary,
    groundTruthReplay: { total: result.summary.category.FILLED, mismatches: result.groundTruthMismatch },
    c5PrereqCompletions: C5_PREREQ_FILLED,
    records: result.records
  };
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('报告已写出:', outPath);

  if (result.groundTruthMismatch.length || result.unknownEmpty.length) process.exit(1);
}

main();
