// shared/module-catalog.js
/**
 * shared/module-catalog.js — 全年级题型模块目录（唯一数据源）
 *
 * 以结构化方式组织基础题型模块 M0–M12 与竞赛模块 C1–C9，
 * 供题型选择页、练习页与模块化开发参考。
 *
 * 数据结构：
 *   MODULE_CATALOG[] -> { id, name, grades: number[], category, level, icon?, desc?, gradeStatus? }
 *   - id       模块唯一标识（M0-M12 为基础模块，C1-C9 为竞赛模块）
 *   - name     模块中文名
 *   - grades   适用年级（1-6）
 *   - category 领域（number / geometry / statistics / mixed）
 *   - level    层级（basic 基础 / competition 竞赛）
 *   - icon     展示图标（emoji，可选）
 *   - desc     模块描述（可选）
 *   - gradeStatus  按年级就绪状态（仅竞赛模块）：{ [grade]: 'active' | 'placeholder' }
 *       与 shared/knowledge-bank.js 对应年级知识点 status 保持一致。
 *       五年级竞赛处于重新开发阶段（见 docs/g5-competition-knowledge-map.md），
 *       四年级/六年级沿用既有实现；基础模块 M0-M12 全年级 active。
 *
 * 导出：
 *   MODULE_CATALOG     = BASIC_MODULES.concat(COMPETITION_MODULES)（全量，供页面渲染）
 *   BASIC_MODULES      基础模块数组（M0-M12）
 *   COMPETITION_MODULES 竞赛模块数组（C1-C9）
 *   MODULE_BY_ID(id)   —— 按 id 查模块，未命中返回 null
 *
 * 浏览器：<script src="shared/module-catalog.js"></script> -> 全局 MODULE_CATALOG / BASIC_MODULES / COMPETITION_MODULES
 * Node：  const MODULE_CATALOG = require('./shared/module-catalog.js')
 */
(function(global) {
  const BASIC_MODULES = [
    { id: 'M0', name: '巧算专项', grades: [1], category: 'number', level: 'basic' },
    { id: 'M1', name: '口算练习', grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M2', name: '竖式计算', grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M3', name: '脱式计算', grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M4', name: '填空题', grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M5', name: '连线题', grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M6', name: '操作题', grades: [1,2,3,4,5,6], category: 'geometry', level: 'basic' },
    { id: 'M7', name: '看图列式', grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M8', name: '解决问题', grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M9', name: '分类与整理', grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
    { id: 'M10', name: '推理与数学广角', grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
    { id: 'M11', name: '判断题', grades: [2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M12', name: '选择题', grades: [2,3,4,5,6], category: 'mixed', level: 'basic' }
  ];

  const COMPETITION_MODULES = [
    { id: 'C1', name: '数字谜与数阵图', grades: [4,5,6], category: 'number', level: 'competition', icon: '🧩',
      desc: '竖式/横式数字谜、幻方与数阵图填数，训练位值分析与枚举推理',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C2', name: '数论初步', grades: [4,5,6], category: 'number', level: 'competition', icon: '🔢',
      desc: '整除特征、奇偶性、质数合数、因数倍数与余数规律',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C3', name: '组合计数', grades: [4,5,6], category: 'number', level: 'competition', icon: '🔀',
      desc: '加乘原理、排列组合初步、枚举与容斥、找规律计数',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C4', name: '几何模型', grades: [4,5,6], category: 'geometry', level: 'competition', icon: '📐',
      desc: '鸟头、蝴蝶、燕尾、一半模型，圆与扇形，勾股定理与格点面积',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C5', name: '行程问题', grades: [4,5,6], category: 'number', level: 'competition', icon: '🚗',
      desc: '相遇追及、火车过桥、流水行船与环形跑道，画线段图分析',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C6', name: '工程与浓度', grades: [5,6], category: 'number', level: 'competition', icon: '🏗️',
      desc: '工程问题（工作量/工效/工时）、溶液浓度混合与配比问题',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C7', name: '分数与巧算', grades: [5,6], category: 'number', level: 'competition', icon: '✨',
      desc: '分数与小数巧算、繁分数化简、换元与裂项等速算技巧',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C8', name: '最值与逻辑推理', grades: [4,5,6], category: 'statistics', level: 'competition', icon: '🧠',
      desc: '最大最小问题、抽屉原理、逻辑推理（列表/假设法）与对策问题',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C9', name: '竞赛综合', grades: [4,5,6], category: 'mixed', level: 'competition', icon: '🏆',
      desc: '跨模块综合卷：按各竞赛模块知识点 weight 加权混编，模拟竞赛组卷',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } }
  ];

  const MODULE_CATALOG = BASIC_MODULES.concat(COMPETITION_MODULES);

  const MODULE_BY_ID = {};
  MODULE_CATALOG.forEach(function (m) { MODULE_BY_ID[m.id] = m; });
  MODULE_CATALOG.byId = function (id) { return MODULE_BY_ID[id] || null; };

  global.MODULE_CATALOG = MODULE_CATALOG;
  global.BASIC_MODULES = BASIC_MODULES;
  global.COMPETITION_MODULES = COMPETITION_MODULES;
  if (typeof module !== 'undefined') module.exports = MODULE_CATALOG;
})(typeof window !== 'undefined' ? window : global);