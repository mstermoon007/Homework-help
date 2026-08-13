/**
 * shared/knowledge-bank.js — 数学知识库配置文件（开发/维护参考）
 *
 * 以结构化方式描述各年级数学知识点：名称、所属领域、对应插件 ID、推荐默认参数等，
 * 供动态页面（math-types.html）与综合练习（math-comprehensive）作为「题型与参数清单」参考。
 *
 * 【多年级复用】本文件采用按年级分节的格式，所有年级共用同一套字段结构：
 *   KnowledgeBank.grades[n] -> { meta, plugins, entries, byPlugin(), byCategory(), entry() }
 * 新增二年级时，只需在 grades 中追加一个 2: {...} 节点（结构照抄一年级），
 * 无需改动查询 API 与任何调用方。见 docs/knowledge-base.md。
 *
 * 注意：本文件【不参与运行逻辑】，仅作为开发和维护的静态清单。
 * 插件元数据以各插件自身（plugins/*.js）与 plugins/registry.js 为准；
 * 本清单用于——确认覆盖是否完整、编排综合练习的题型配比、以及让 math-types.html 快速获取
 * 题型名称/描述（无需逐个加载插件脚本）。
 *
 * 数据结构：
 *   KnowledgeBank.subject        —— 科目（'math'）
 *   KnowledgeBank.categoryOrder  —— 领域展示顺序
 *   KnowledgeBank.categoryNames  —— 领域中文名
 *   KnowledgeBank.grades         —— { 年级号: 该年级知识库 }，可无限追加年级
 *   KnowledgeBank.getGrade(g)    —— 取指定年级知识库，不存在返回 null
 *   兼容别名：KnowledgeBankGrade1 = KnowledgeBank.grades[1]
 *
 * category 取值（与插件 metadata.category、shared/math-knowledge.js 领域 id 对齐）：
 *   number（数与代数） / geometry（图形与几何） / statistics（统计与概率） / mixed（跨领域综合）
 *
 * 【高年级扩展预留】statistics（统计与概率）领域当前仅一年级「分类整理」；
 * 高年级将出现条形统计图、平均数、折线统计图等，新增时在对应年级下以
 * category: 'statistics' 追加 entries 即可，插件与类型体系无需改动。
 *
 * 浏览器：<script src="shared/knowledge-bank.js"></script> -> 全局 KnowledgeBank
 * Node：  const KnowledgeBank = require('./shared/knowledge-bank.js')
 */

/**
 * @typedef {Object} KnowledgeEntry
 * @property {string} id           - 知识点唯一标识（年级内唯一）
 * @property {string} name         - 知识点名称（中文）
 * @property {'number'|'geometry'|'statistics'} category - 所属领域
 * @property {string} pluginId     - 对应插件 ID（plugins/registry.js 中的 id）
 * @property {string} [type]       - 推荐题型参数（传给 generate 的 opts.type，省略则用插件默认）
 * @property {Object} [defaults]   - 推荐默认参数（传给 generate 的 opts，如 count / maxNum / difficulty）
 * @property {string} desc         - 一句话描述（供 math-types.html 展示）
 * @property {string[]} points     - 知识点细分条目
 */

(function (global) {
  'use strict';

  var CATEGORY_ORDER = ['number', 'geometry', 'statistics'];
  var CATEGORY_NAMES = { number: '数与代数', geometry: '图形与几何', statistics: '统计与概率' };

  // ============ 各年级知识库 ============
  // 每个年级结构一致：{ meta, plugins, entries }。新增年级照抄一年级结构追加即可。

  // ---------------- 一年级 ----------------
  var GRADE1_PLUGINS = [
    { id: 'math-oral',              name: '口算练习',     category: 'number',     desc: '20 以内的加减法，每天练一练，算得又快又准' },
    { id: 'math-word-problems',     name: '应用题',       category: 'number',     desc: '把生活小故事变成算式，学会自己读懂并解答' },
    { id: 'math-make-ten',          name: '凑十法',       category: 'number',     desc: '用小棒和点子学会凑十、破十的巧算方法' },
    { id: 'math-number-sense',      name: '数的认识',     category: 'number',     desc: '数数、数的顺序、组成、数位和比大小' },
    { id: 'math-clock',             name: '认识钟表',     category: 'number',     desc: '认识钟面，学会看整点时间' },
    { id: 'math-patterns',          name: '找规律',       category: 'number',     desc: '按数字或图形的排列顺序，猜出下一个' },
    { id: 'math-picture-equations', name: '看图列式',     category: 'number',     desc: '看着图画列出加法或减法算式' },
    { id: 'math-shapes',            name: '认识图形',     category: 'geometry',   desc: '认识长方体、正方体、圆柱、球等立体和平面图形' },
    { id: 'math-statistics',        name: '分类整理',     category: 'statistics', desc: '把图形分分类、数一数，填进统计表' },
    { id: 'math-money',             name: '认识人民币',   category: 'number',     desc: '认识元、角、分，学会单位换算与简单计算' },
    { id: 'math-comprehensive',     name: '综合练习',     category: 'mixed',      desc: '把一年级的本领都混合起来，一套题全练到' }
  ];

  var GRADE1_ENTRIES = [
    // ---- 数与代数 ----
    {
      id: 'count', name: '数数与顺序', category: 'number', pluginId: 'math-number-sense', type: 'count',
      defaults: { count: 8 },
      desc: '数一数圆点、写出前后数、数列填空',
      points: ['数数', '顺序']
    },
    {
      id: 'compose-digit', name: '数的组成与数位', category: 'number', pluginId: 'math-number-sense', type: 'compose',
      defaults: { count: 8 },
      desc: '几个十几个一组成几、十位个位辨析',
      points: ['组成', '数位']
    },
    {
      id: 'compare', name: '比大小', category: 'number', pluginId: 'math-number-sense', type: 'compare',
      defaults: { count: 8 },
      desc: '20 以内数比较大小，填写 > < =',
      points: ['比大小']
    },
    {
      id: 'addsub-20', name: '20 以内加减法', category: 'number', pluginId: 'math-oral', type: 'addsub',
      defaults: { count: 10, maxNum: 20, noNegative: true },
      desc: '20 以内加法与减法口算',
      points: ['20 以内加减法']
    },
    {
      id: 'chain-mixed', name: '连加连减与加减混合', category: 'number', pluginId: 'math-word-problems',
      defaults: { count: 5, difficulty: 'basic' },
      desc: '连加、连减、加减混合文字题',
      points: ['连加连减', '加减混合']
    },
    {
      id: 'make-ten', name: '凑十法', category: 'number', pluginId: 'math-make-ten',
      defaults: { count: 5, type: 'mix' },
      desc: '凑十 / 平十 / 破十拆分计算技巧',
      points: ['凑十法', '平十法', '破十法']
    },
    {
      id: 'clock-hour', name: '认识钟表（整时）', category: 'number', pluginId: 'math-clock',
      defaults: { count: 8 },
      desc: '读钟面说出整时、判断时针指向',
      points: ['整时']
    },
    {
      id: 'patterns', name: '找规律', category: 'number', pluginId: 'math-patterns',
      defaults: { count: 8 },
      desc: '数字等差规律与图形循环规律填空',
      points: ['数字规律', '图形规律']
    },
    {
      id: 'picture-equations', name: '看图列式', category: 'number', pluginId: 'math-picture-equations',
      defaults: { count: 8 },
      desc: '根据图示列出加法或减法算式',
      points: ['看图列式']
    },
    {
      id: 'money', name: '认识人民币', category: 'number', pluginId: 'math-money', type: 'mix',
      defaults: { count: 8 },
      desc: '认识元、角、分，掌握 1 元 = 10 角、1 角 = 10 分 的换算与同单位加减',
      points: ['认识面值', '元角分换算', '简单计算']
    },
    {
      id: 'solve-problems', name: '解决问题', category: 'number', pluginId: 'math-word-problems',
      defaults: { count: 5, difficulty: 'mix' },
      desc: '加法、减法、相差、连加连减、多余条件等实际问题',
      points: ['加法', '减法', '相差', '连加连减', '多余条件']
    },

    // ---- 图形与几何 ----
    {
      id: 'solid-shapes', name: '认识立体图形', category: 'geometry', pluginId: 'math-shapes', type: 'solid',
      defaults: { count: 8 },
      desc: '辨认长方体、正方体、圆柱、球',
      points: ['长方体', '正方体', '圆柱', '球']
    },
    {
      id: 'flat-shapes', name: '认识平面图形', category: 'geometry', pluginId: 'math-shapes', type: 'flat',
      defaults: { count: 8 },
      desc: '辨认三角形、正方形、长方形、圆等平面图形',
      points: ['三角形', '正方形', '长方形', '圆形', '梯形']
    },
    {
      id: 'shape-compose', name: '图形拼组', category: 'geometry', pluginId: 'math-shapes', type: 'count',
      defaults: { count: 8 },
      desc: '数一数组合图形中各种图形的个数',
      points: ['图形拼组']
    },
    {
      id: 'position', name: '上下左右位置', category: 'geometry', pluginId: 'math-shapes', type: 'position',
      defaults: { count: 8 },
      desc: '辨认图形的上、下、左、右方位关系',
      points: ['上下左右位置']
    },

    // ---- 统计与概率 ----
    {
      id: 'classify', name: '分类与整理', category: 'statistics', pluginId: 'math-statistics', type: 'classify',
      defaults: { count: 6 },
      desc: '按形状 / 颜色对图形分类并数出数量',
      points: ['按形状分类', '按颜色分类', '按用途分类']
    },
    {
      id: 'stats-table', name: '填写简单统计表', category: 'statistics', pluginId: 'math-statistics', type: 'table',
      defaults: { count: 6 },
      desc: '把整理结果填入统计表',
      points: ['填写简单统计表']
    },
    {
      id: 'pictograph', name: '象形统计图', category: 'statistics', pluginId: 'math-statistics', type: 'picto',
      defaults: { count: 6 },
      desc: '用涂色方块表示数量并比较多少',
      points: ['涂色制作象形统计图']
    }
  ];

  function buildGrade(meta, plugins, entries) {
    return {
      meta: meta,
      plugins: plugins,
      entries: entries,
      byPlugin: function (pluginId) {
        return entries.filter(function (e) { return e.pluginId === pluginId; });
      },
      byCategory: function (category) {
        return entries.filter(function (e) { return e.category === category; });
      },
      entry: function (id) {
        return entries.filter(function (e) { return e.id === id; })[0] || null;
      }
    };
  }

  // ---------------- 二年级 ----------------
  var GRADE2_PLUGINS = [
    { id: 'math-oral',              name: '表内乘除法口算', category: 'number',     desc: '表内乘除法、有余数除法、加减混合口算' },
    { id: 'math-word-problems',     name: '应用题',       category: 'number',     desc: '乘除、两步计算、进一去尾、周期、估算等实际问题' },
    { id: 'math-make-ten',          name: '凑十法',       category: 'number',     desc: '凑十、平十、破十拆分计算技巧' },
    { id: 'math-shapes',            name: '认识图形',     category: 'geometry',   desc: '辨认立体与平面图形、方位辨别、拼组数图形' },
    { id: 'math-number-sense',      name: '万以内数的认识', category: 'number',   desc: '万以内数的读写、组成、数位、比大小与近似数' },
    { id: 'math-unit-convert',      name: '单位换算',     category: 'number',     desc: '长度（米/厘米/毫米/千米）与质量（克/千克）单位换算' },
    { id: 'math-geometry',          name: '角的初步认识', category: 'geometry',   desc: '角的认识、图形的平移旋转、方格纸数格' },
    { id: 'math-data-stats',        name: '数据收集与整理', category: 'statistics', desc: '投票情境下用正字法统计、填写统计表、回答问题' },
    { id: 'math-logic-reasoning',   name: '简单推理与数独', category: 'statistics', desc: '简单逻辑推理与 3×3 数独启蒙' },
    { id: 'math-comprehensive',     name: '综合练习',     category: 'mixed',      desc: '把二年级的本领都混合起来，一套题全练到' }
  ];

  var GRADE2_ENTRIES = [
    // ---- 数与代数 ----
    {
      id: 'addsub-100', name: '100 以内加减法', category: 'number', pluginId: 'math-oral', type: 'addsub',
      defaults: { count: 10, maxNum: 100, noNegative: true },
      desc: '100 以内进位加法与退位减法口算',
      points: ['100 以内加减法', '进位加法', '退位减法', '竖式计算']
    },
    {
      id: 'muldiv', name: '表内乘除法', category: 'number', pluginId: 'math-oral', type: 'muldiv',
      defaults: { count: 10, maxNum: 50 },
      desc: '表内乘法与表内除法口算',
      points: ['乘法口诀', '表内乘法', '表内除法']
    },
    {
      id: 'remainder', name: '有余数除法', category: 'number', pluginId: 'math-oral', type: 'remainder',
      defaults: { count: 10, maxNum: 50 },
      desc: '有余数除法（商……余数）口算',
      points: ['有余数的除法', '余数与除数的关系']
    },
    {
      id: 'mixed', name: '混合运算', category: 'number', pluginId: 'math-oral', type: 'mixed',
      defaults: { count: 10, maxNum: 50 },
      desc: '乘加、乘减、除加、除减两级混合运算',
      points: ['乘加乘减', '两步运算']
    },
    {
      id: 'wp-solve', name: '解决问题', category: 'number', pluginId: 'math-word-problems',
      defaults: { count: 5, difficulty: 'mix' },
      desc: '乘除、两步、进一去尾、周期、估算、质量等实际问题',
      points: ['乘法', '除法', '两步运算', '进一法', '去尾法', '周期问题', '估算', '质量计算']
    },
    {
      id: 'readwrite', name: '万以内数的读写', category: 'number', pluginId: 'math-number-sense', type: 'readwrite',
      defaults: { count: 8 },
      desc: '万以内数的读作与写作',
      points: ['读写', '万以内数的认识']
    },
    {
      id: 'compose-4', name: '数的组成与数位', category: 'number', pluginId: 'math-number-sense', type: 'compose',
      defaults: { count: 8 },
      desc: '几个千/百/十/一组成几，数位辨析',
      points: ['组成', '数位顺序']
    },
    {
      id: 'approx', name: '近似数', category: 'number', pluginId: 'math-number-sense', type: 'approx',
      defaults: { count: 8 },
      desc: '把数估成整十、整百或整千',
      points: ['近似数']
    },
    {
      id: 'unit-convert', name: '单位换算', category: 'number', pluginId: 'math-unit-convert', type: 'convert',
      defaults: { count: 8 },
      desc: '长度（米/厘米/毫米/千米）与质量（克/千克）单位互化',
      points: ['长度单位', '单位换算', '厘米', '米', '毫米', '千米', '克与千克换算']
    },
    {
      id: 'fill-unit', name: '填合适单位', category: 'number', pluginId: 'math-unit-convert', type: 'fillUnit',
      defaults: { count: 8 },
      desc: '根据生活常识为数量选择正确的长度/质量单位',
      points: ['认识质量单位', '长度单位应用', '常见的量', '克与千克']
    },

    // ---- 图形与几何 ----
    {
      id: 'angles', name: '角的初步认识', category: 'geometry', pluginId: 'math-geometry', type: 'angleClass',
      defaults: { count: 8 },
      desc: '数角、识别锐角/直角/钝角',
      points: ['锐角', '直角', '钝角']
    },
    {
      id: 'motion', name: '图形的运动', category: 'geometry', pluginId: 'math-geometry', type: 'motion',
      defaults: { count: 8 },
      desc: '判断平移与旋转',
      points: ['平移', '旋转']
    },
    {
      id: 'grid', name: '方格纸', category: 'geometry', pluginId: 'math-geometry', type: 'grid',
      defaults: { count: 8 },
      desc: '数一数图形向右平移了几格',
      points: ['在方格纸上画简单图形']
    },
    {
      id: 'shapes-2', name: '认识图形', category: 'geometry', pluginId: 'math-shapes', type: 'mix',
      defaults: { count: 8 },
      desc: '辨认立体与平面图形、方位辨别、拼组数图形',
      points: ['立体图形', '平面图形', '上下左右位置', '图形拼组']
    },

    // ---- 统计与概率 ----
    {
      id: 'data-tally', name: '数据收集与整理', category: 'statistics', pluginId: 'math-data-stats', type: 'tally',
      defaults: { count: 6 },
      desc: '用正字法统计投票结果并填写统计表',
      points: ['正字统计法', '简单统计表']
    },
    {
      id: 'data-question', name: '根据统计结果回答问题', category: 'statistics', pluginId: 'math-data-stats', type: 'result',
      defaults: { count: 6 },
      desc: '根据统计表回答谁最多、谁最少、多几票等问题',
      points: ['根据统计结果提出建议']
    },
    {
      id: 'logic-reasoning', name: '简单逻辑推理', category: 'statistics', pluginId: 'math-logic-reasoning', type: 'bookGuess',
      defaults: { count: 6 },
      desc: '根据线索推理判断谁拿什么',
      points: ['简单逻辑推理']
    },
    {
      id: 'sudoku3', name: '3×3 数独', category: 'statistics', pluginId: 'math-logic-reasoning', type: 'sudoku3',
      defaults: { count: 6 },
      desc: '每行每列都有 1/2/3 的数独启蒙',
      points: ['数独启蒙']
    }
  ];

  // ---------------- 三年级 ----------------
  // 真实插件来自 plugins/registry.js 中 grades 含 3 的条目；
  // 另含 3 个「待开发」知识点（pluginId 指向尚未实现的插件），
  // 用于让覆盖统计产生真实缺口、驱动「建议下一个开发 Z」。
  var GRADE3_PLUGINS = [
    { id: 'math-oral',              name: '口算练习',         category: 'number',     desc: '万以内加减、多位数乘一位数、两位数乘两位数、除数是一位数除法等' },
    { id: 'math-word-problems',     name: '应用题',           category: 'number',     desc: '倍数、两步计算、搭配等实际问题' },
    { id: 'math-shapes',            name: '认识图形',         category: 'geometry',   desc: '辨认立体与平面图形、方位辨别、拼组数图形' },
    { id: 'math-number-sense',      name: '数的认识',         category: 'number',     desc: '万以内数的读写、组成、数位、近似数' },
    { id: 'math-unit-convert',      name: '单位换算',         category: 'number',     desc: '长度（毫米/分米/千米/吨）与质量单位换算' },
    { id: 'math-geometry',          name: '图形与几何',       category: 'geometry',   desc: '周长与面积计算、位置与方向' },
    { id: 'math-data-stats',        name: '数据收集与整理',   category: 'statistics', desc: '复式统计表阅读与填写' },
    { id: 'math-logic-reasoning',   name: '简单推理与集合',   category: 'statistics', desc: '简单逻辑推理与集合重叠问题' },
    { id: 'math-time-date',         name: '时间与日期',       category: 'number',     desc: '时、分、秒与年、月、日' },
    { id: 'math-position-direction',name: '方向与位置',       category: 'geometry',   desc: '东、南、西、北及东北、西南等八个方向' },
    { id: 'math-combination-set',   name: '搭配与集合',       category: 'statistics', desc: '排列组合与集合重叠' },
    { id: 'math-comprehensive',     name: '综合练习',         category: 'mixed',      desc: '把三年级的本领都混合起来，一套题全练到' }
  ];

  var GRADE3_ENTRIES = [
    // ---- 数与代数 ----
    {
      id: 'g3-time', name: '时、分、秒', category: 'number', pluginId: 'math-time-date', type: 'clock',
      defaults: { count: 8 },
      desc: '时间单位换算、经过时间计算',
      points: ['时间单位', '经过时间计算']
    },
    {
      id: 'g3-add-sub-wan', name: '万以内的加减法', category: 'number', pluginId: 'math-oral', type: 'addsub',
      defaults: { count: 10, maxNum: 10000 },
      desc: '不进位/进位加法、不退位/退位减法、验算',
      points: ['万以内加减', '验算']
    },
    {
      id: 'g3-times', name: '倍的认识', category: 'number', pluginId: 'math-word-problems', type: 'times',
      defaults: { count: 6 },
      desc: '求一个数是另一个数的几倍、求一个数的几倍是多少',
      points: ['倍数']
    },
    {
      id: 'g3-mul-multi1', name: '多位数乘一位数', category: 'number', pluginId: 'math-oral', type: 'multi1',
      defaults: { count: 10 },
      desc: '口算、笔算、估算多位数乘一位数',
      points: ['多位数乘一位数']
    },
    {
      id: 'g3-fraction', name: '分数的初步认识', category: 'number', pluginId: 'math-fraction', type: 'fraction',
      defaults: { count: 8 },
      desc: '认识几分之一/几分之几、分数比大小、同分母分数加减（待开发插件 math-fraction）',
      points: ['认识分数', '分数比大小', '同分母分数加减']
    },
    {
      id: 'g3-div1', name: '除数是一位数的除法', category: 'number', pluginId: 'math-oral', type: 'div1',
      defaults: { count: 10 },
      desc: '口算与笔算除法、商中间/末尾有 0',
      points: ['除数是一位数']
    },
    {
      id: 'g3-mul-2digit', name: '两位数乘两位数', category: 'number', pluginId: 'math-oral', type: 'twodigit',
      defaults: { count: 10 },
      desc: '口算与笔算两位数乘两位数',
      points: ['两位数乘两位数']
    },
    {
      id: 'g3-decimal', name: '小数的初步认识', category: 'number', pluginId: 'math-decimal', type: 'decimal',
      defaults: { count: 8 },
      desc: '读写小数、比较大小、简单加减（待开发插件 math-decimal）',
      points: ['读写小数', '小数比大小', '简单加减']
    },
    {
      id: 'g3-year-month', name: '年、月、日', category: 'number', pluginId: 'math-time-date', type: 'calendar',
      defaults: { count: 8 },
      desc: '大月小月、平年闰年、日历阅读、经过天数计算',
      points: ['年月日', '平年闰年', '经过天数']
    },
    {
      id: 'g3-combination', name: '搭配问题', category: 'number', pluginId: 'math-combination-set', type: 'combo',
      defaults: { count: 6 },
      desc: '数学广角：排列组合',
      points: ['排列组合']
    },

    // ---- 图形与几何 ----
    {
      id: 'g3-measure', name: '测量', category: 'geometry', pluginId: 'math-unit-convert', type: 'measure',
      defaults: { count: 8 },
      desc: '长度单位（毫米、分米、千米）与质量单位（吨）换算、填合适单位',
      points: ['毫米分米千米', '吨', '填合适单位']
    },
    {
      id: 'g3-perimeter', name: '长方形正方形的周长', category: 'geometry', pluginId: 'math-geometry', type: 'perimeter',
      defaults: { count: 8 },
      desc: '周长含义、周长计算、靠墙围栏等实际问题',
      points: ['周长含义', '周长计算']
    },
    {
      id: 'g3-area', name: '面积', category: 'geometry', pluginId: 'math-area', type: 'area',
      defaults: { count: 8 },
      desc: '面积单位、长方形正方形面积计算（待开发插件 math-area）',
      points: ['面积单位', '面积计算']
    },
    {
      id: 'g3-position', name: '位置与方向', category: 'geometry', pluginId: 'math-position-direction', type: 'direction',
      defaults: { count: 8 },
      desc: '东、南、西、北及东北、西南等八个方向',
      points: ['八个方向']
    },

    // ---- 统计与概率 ----
    {
      id: 'g3-stats-table', name: '复式统计表', category: 'statistics', pluginId: 'math-data-stats', type: 'multiTable',
      defaults: { count: 6 },
      desc: '阅读与填写复式统计表',
      points: ['复式统计表']
    },
    {
      id: 'g3-set', name: '集合思想', category: 'statistics', pluginId: 'math-combination-set', type: 'set',
      defaults: { count: 6 },
      desc: '数学广角：集合重叠问题',
      points: ['集合重叠']
    }
  ];

  var GRADES = {
    1: buildGrade(
      { grade: 1, gradeName: '一年级', subject: 'math', version: '1.0.0', maintained: '随 plugins/ 变化同步更新' },
      GRADE1_PLUGINS,
      GRADE1_ENTRIES
    ),

    // ---------------- 二年级 ----------------
    2: buildGrade(
      { grade: 2, gradeName: '二年级', subject: 'math', version: '1.0.0', maintained: '随 plugins/ 变化同步更新' },
      GRADE2_PLUGINS,
      GRADE2_ENTRIES
    ),

    // ---------------- 三年级 ----------------
    3: buildGrade(
      { grade: 3, gradeName: '三年级', subject: 'math', version: '1.0.0', maintained: '随 plugins/ 变化同步更新' },
      GRADE3_PLUGINS,
      GRADE3_ENTRIES
    )
    // ============ 后续年级：在下方追加（结构照抄一年级） ============
    // 4: buildGrade({ grade: 4, gradeName: '四年级', subject: 'math', version: '1.0.0', ... }, PLUGINS_4, ENTRIES_4),
  };

  global.KnowledgeBank = {
    subject: 'math',
    categoryOrder: CATEGORY_ORDER,
    categoryNames: CATEGORY_NAMES,
    grades: GRADES,
    getGrade: function (g) { return GRADES[g] || null; },

    /**
     * 取某年级知识点条目（开发期覆盖统计用）。
     * 非数学科目暂无知识库，返回空数组。
     * @returns {Array} 条目数组（{id,name,category,pluginId,points,...}）
     */
    getEntries: function (subject, grade) {
      if (subject && subject !== 'math') return [];
      var g = GRADES[grade];
      return g ? g.entries : [];
    },

    /**
     * 项目级覆盖统计：基于「已存在的插件集合」计算某年级知识点覆盖情况。
     * @param {string} subject 科目（当前仅 'math' 有数据）
     * @param {number} grade 年级
     * @param {string[]} coveredPluginIds 当前已注册且适用该年级的插件 id 集合
     * @returns {{total:number,covered:number,ratio:number,missing:Array,next:Object|null}}
     *   next 为第一个未覆盖条目（按 领域顺序），可用于「建议下一个开发 Z」
     */
    getCoverage: function (subject, grade, coveredPluginIds) {
      var g = GRADES[grade];
      if (!g || (subject && subject !== 'math')) {
        return { total: 0, covered: 0, ratio: 0, missing: [], next: null };
      }
      var set = {};
      (coveredPluginIds || []).forEach(function (id) { set[id] = true; });
      var entries = g.entries || [];
      var covered = 0, missing = [];
      CATEGORY_ORDER.forEach(function (cat) {
        entries.filter(function (e) { return e.category === cat; }).forEach(function (e) {
          if (set[e.pluginId]) covered++; else missing.push(e);
        });
      });
      var total = entries.length;
      return {
        total: total,
        covered: covered,
        ratio: total ? Math.round(covered / total * 100) : 0,
        missing: missing,
        next: missing.length ? missing[0] : null
      };
    },

    /** 从注册表（[{id,subject,grades}]）计算覆盖（自动提取适用该年级的插件 id） */
    coverageFromRegistry: function (subject, grade, registry) {
      var ids = [];
      (registry || []).forEach(function (p) {
        if (p.subject === subject && p.grades && p.grades.indexOf(grade) !== -1) ids.push(p.id);
      });
      return this.getCoverage(subject, grade, ids);
    },

    /** 建议下一个应开发的插件：{pluginId,name} 或 null（已全部覆盖） */
    suggestNext: function (subject, grade, coveredPluginIds) {
      var cov = this.getCoverage(subject, grade, coveredPluginIds);
      return cov.next ? { pluginId: cov.next.pluginId, name: cov.next.name } : null;
    }
  };

  // 兼容别名：旧页面/脚本仍可直接读取 KnowledgeBankGrade1
  global.KnowledgeBankGrade1 = GRADES[1];

  if (typeof module !== 'undefined' && module.exports) module.exports = global.KnowledgeBank;

})(typeof window !== 'undefined' ? window : globalThis);
