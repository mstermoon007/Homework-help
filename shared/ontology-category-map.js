/**
 * shared/ontology-category-map.js — KP 领域（category）确定性派生表（C5）
 *
 * 背景：549 个 math KP 中仅 46 条显式填写 category（algebra / measurement /
 * geometry / synthesis），其余 503 条为空。composite 生成器按 category 路由
 * 三种跨域模式（measurement→calc、shape→apply、calc→judge），
 * normalizer 旧逻辑 category: raw || null 导致非 g1 的测量/几何 KP
 * 永远无法触发对应模式。
 *
 * 与 ontology-operation-map.js 同构：不改 KnowledgeBank 原始条目，
 * 由 Normalizer 归一化时应用；可审计、可回滚（删除本文件即恢复 raw-only）。
 *
 * 规则依据（dev/audit/kb-data-completion.js 回放验证）：
 *   - 46 条原始 FILLED 真值回放 0 不一致；
 *   - 473 条 DERIVED、30 条 UNRESOLVED（统计与概率域，四域分类法无槽位 → null，禁猜）。
 *   - V4.1.1 起：统计与概率域显式补 30 条 category='statistics'（42244d8），
 *     领域扩展为五域（+statistics），derive 对统计域可推导，canonical.category 549/549 全覆盖。
 *
 * 领域语义：
 *   algebra     数与代数（运算/方程/分数小数百分数/比/数论/规律/行程/工程/策略推理等）
 *   measurement 量与计量（人民币/时间/长度/质量/面积体积单位换算与测量活动）
 *   geometry    图形与几何（图形认识/角/线/周长面积体积概念计算/图形运动/位置方向）
 *   synthesis   综合与跨域（题型综合/竞赛综合组卷/购物等跨域应用）
 *   statistics  统计与概率（数据收集整理/统计图表/平均数/可能性）
 */
(function (global) {
  'use strict';

  var CATEGORIES = ['algebra', 'measurement', 'geometry', 'synthesis', 'statistics'];

  // ---- 领域词法规则（与 dev/audit/kb-data-completion.js deriveCategory 保持同步）----

  // 几何 id 词（先于通用词命中；R5 显式守卫防止跨域词误伤）
  var GEOM_ID = /(^|-)c4-|geom(?:etry|count|etric)|solid|flat-shape|shape|count-graph|angle|protractor|quad|tri(?!ple)|circle|cyl(?:inder)?|cone(?!centration)|perimeter|(?:^|-)area|lattice|pythagorean|painted-cube|transform|(?:^|-)sym|symmet|rotat|draw-move|(?:^|-)motion|draw-net|grid|draw-view|draw-observe|position|coord|(?:^|-)pa(?:-|$)|draw-para|(?:^|-)line(?:-|$)|draw-height/;

  // 计量 id 词
  var MEAS_ID = /(^|-)(rmb|money|clock|time|year-month|length|mass|weight|measure|unit-convert|match-unit|fill-(?:length|mass|time)|length-(?:unit|app)|mass-(?:unit|app)|time-unit|hectare)(-|$)/;

  // 统计与概率 id 词（四域分类法无槽位）
  var STATS_ID = /(^|-)(stats?|data-tally|data-question|possib\w*|possible|pie-chart|linechart|stats-line\d|match-chart|judge-chart|choice-chart|pic-pie-chart|stat-pie-chart|stat-possibility|fill-pie-chart|fill-linechart|fill-possible|word-possib|word-linechart|stats-bar|stats-double|stats-avg|stats-table|stats-possib\w*|stats-line\d|fill-avg|word-avg)(-|$)/;

  var GEOM_NAME = /图形|角[的度类型与]|量角|画角|角度|线段(?!图)|射线|直线|平行|垂直|梯形|三角形|长方|正方|圆[的周角]?|圆柱|圆锥|周长|面积|体积|表面积|展开图|对称|平移|旋转|放大|缩小|位置|方向|数对|观察物体|几何|勾股|扇形|格点|鸟头|蝴蝶|燕尾|等积|割补|涂色|棱[，、]|锥[体]/;

  var MEAS_NAME = /人民币|元角分|钟面|钟表|时、分、秒|时分秒|时间单位|长度单位|质量单位|面积单位|体积单位|容积单位|单位换算|填合适[^，。]*单位|单位与物品|测量|公顷|平方千米|年、月、日|长度|质量|重量/;

  /**
   * 按 id/name 词法信号确定性推导领域。
   * @returns {string|null} category；无确定性依据返回 null
   */
  function deriveCategory(kp) {
    var id = (kp && kp.id ? String(kp.id) : '').toLowerCase();
    var name = (kp && kp.name ? String(kp.name) : '') || '';

    // R1 synthesis：显式组卷/题型综合（判断题综合/选择题综合）、竞赛综合卷、跨域购物。
    // 「数字推理综合」「行程综合」等尾部"综合"是难度修饰，不在此列。
    if (/(判断|选择)题综合|综合应用|杂题选讲|模拟竞赛/.test(name)) return 'synthesis';
    if (/购物/.test(name) || /(?:^|-)shopping(?:-|$)/.test(id)) return 'synthesis';

    // R2 统计与概率 → statistics 域（V4.1.1 起领域扩展，可推导；显式值优先）
    if (STATS_ID.test(id) || /统计|可能性|平均数|折线|条形统计图?|扇形统计图?|数据收集/.test(name)) {
      return 'statistics';
    }

    // R3 数与形规律：数列/模式推理 → algebra（显式排除 shape 词误伤）
    if (/reason-number-shape/.test(id)) return 'algebra';
    // 竞赛 C4 几何模块
    if (/(^|-)c4-/.test(id)) return 'geometry';
    // 几何计数（跨模块显式几何）
    if (/(^|-)(geomcount|geometry-counting)/.test(id)) return 'geometry';
    // C5 行程模块的「时钟问题」是行程题（钟面相遇），algebra 先于 clock 计量词
    if (/(^|-)c5-/.test(id)) return 'algebra';
    // C8 逻辑模块（最值/抽屉/逻辑推理/对策）：名称中「对称」为策略术语，非几何
    if (/(^|-)c8-/.test(id)) return 'algebra';
    // 线段图是代数应用题图示，不是几何（看图列式 M7）
    if (/线段图/.test(name)) return 'algebra';

    if (GEOM_ID.test(id)) return 'geometry';
    if (MEAS_ID.test(id)) return 'measurement';

    if (GEOM_NAME.test(name)) return 'geometry';
    if (MEAS_NAME.test(name)) return 'measurement';

    // R5 默认：数与代数（运算/方程/分数小数/数论/组合计数/工程浓度/巧算/数学广角）
    return 'algebra';
  }

  /**
   * 解析 KP 领域：优先原始字段，缺失时确定性推导。
   * @param {object} kp 扁平 KP 记录（含 id/name/category?）
   * @returns {string|null}
   */
  function categoryForKp(kp) {
    if (!kp) return null;
    if (typeof kp.category === 'string' && CATEGORIES.indexOf(kp.category) !== -1) {
      return kp.category;
    }
    return deriveCategory(kp);
  }

  var API = {
    CATEGORIES: CATEGORIES,
    categoryForKp: categoryForKp,
    deriveCategory: deriveCategory
  };

  global.OntologyCategoryMap = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
