/**
 * shared/knowledge-bank-grade2.js — 二年级数学知识库配置文件（开发/维护参考）
 *
 * 结构同一年级知识库（shared/knowledge-bank.js 中 grades[1]）：以结构化方式描述
 * 二年级各数学知识点——名称、所属领域、对应插件 ID、推荐题量与难度参数等，
 * 供动态页面（math-types.html）、综合练习（math-comprehensive）与未来维护参考。
 *
 * 【重要】本文件【不参与运行逻辑】，仅作为开发和维护的静态清单。
 * 插件元数据以各插件自身（plugins/*.js）与 plugins/registry.js 为准；
 * 本清单用于——确认覆盖是否完整、编排综合练习的题型配比、以及让动态页面快速获取
 * 题型名称/描述（无需逐个加载插件脚本）。
 *
 * 数据结构（与一年级保持一致）：
 *   KnowledgeBankGrade2.categoryOrder —— 领域展示顺序
 *   KnowledgeBankGrade2.categoryNames —— 领域中文名
 *   KnowledgeBankGrade2.meta          —— 年级元信息
 *   KnowledgeBankGrade2.plugins       —— 本年级用到的插件清单
 *   KnowledgeBankGrade2.entries       —— 知识点清单
 *   KnowledgeBankGrade2.byPlugin(id)  —— 按插件 ID 过滤
 *   KnowledgeBankGrade2.byCategory(c) —— 按领域过滤
 *   KnowledgeBankGrade2.entry(id)     —— 按知识点 ID 取单条
 *
 * category 取值（与插件 metadata.category、shared/math-knowledge.js 领域 id 对齐）：
 *   number（数与代数） / geometry（图形与几何） / statistics（统计与概率） / mixed（跨领域综合）
 *
 * 浏览器：<script src="shared/knowledge-bank-grade2.js"></script> -> 全局 KnowledgeBankGrade2
 * Node：  const KnowledgeBankGrade2 = require('./shared/knowledge-bank-grade2.js')
 */

/**
 * @typedef {Object} KnowledgeEntry
 * @property {string} id           - 知识点唯一标识（年级内唯一）
 * @property {string} name         - 知识点名称（中文）
 * @property {'number'|'geometry'|'statistics'} category - 所属领域
 * @property {string} pluginId     - 对应插件 ID（plugins/registry.js 中的 id）
 * @property {string} [type]       - 推荐题型参数（传给 generate 的 opts.type，省略则用插件默认）
 * @property {Object} [defaults]   - 推荐默认参数（传给 generate 的 opts，如 count / maxNum / difficulty）
 * @property {string} desc         - 一句话描述（供动态页面展示）
 * @property {string[]} points     - 知识点细分条目
 */

(function (global) {
  'use strict';

  var CATEGORY_ORDER = ['number', 'geometry', 'statistics'];
  var CATEGORY_NAMES = { number: '数与代数', geometry: '图形与几何', statistics: '统计与概率' };

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

  global.KnowledgeBankGrade2 = buildGrade(
    { grade: 2, gradeName: '二年级', subject: 'math', version: '1.0.0', maintained: '随 plugins/ 变化同步更新' },
    GRADE2_PLUGINS,
    GRADE2_ENTRIES
  );
  global.KnowledgeBankGrade2.categoryOrder = CATEGORY_ORDER;
  global.KnowledgeBankGrade2.categoryNames = CATEGORY_NAMES;

  if (typeof module !== 'undefined' && module.exports) module.exports = global.KnowledgeBankGrade2;

})(typeof window !== 'undefined' ? window : globalThis);