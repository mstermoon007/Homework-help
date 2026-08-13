// 插件注册表 - 每新增一个插件，在此添加一条记录
// 字段：id 唯一标识 / file 插件文件路径 / name 展示名称（易懂、面向学生与家长）
//       subject 科目（math|chinese|english）/ category 数学领域（number|geometry|statistics|mixed）
//       grades 适用年级 / deps 前置依赖脚本
// 浏览器端动态逻辑（math-types.html / practice.html）按 id/file/deps 加载插件，
// 并按 grades 过滤年级；name/category/grades 同时作为注册表自身的完整元数据参考。
(function(global) {
  const PLUGIN_REGISTRY = [
    // 数学（一年级）
    { id: 'math-oral', file: 'plugins/math-oral.js', name: '口算练习', subject: 'math', category: 'number', grades: [1, 2, 3] },
    { id: 'math-word-problems', file: 'plugins/math-word-problems.js', name: '应用题', subject: 'math', category: 'number', grades: [1, 2, 3] },
    { id: 'math-make-ten', file: 'plugins/math-make-ten.js', name: '凑十法', subject: 'math', category: 'number', grades: [1, 2] },
    { id: 'math-shapes', file: 'plugins/math-shapes.js', name: '认识图形', subject: 'math', category: 'geometry', grades: [1, 2, 3] },
    { id: 'math-number-sense', file: 'plugins/math-number-sense.js', name: '数的认识', subject: 'math', category: 'number', grades: [1, 2, 3] },
    { id: 'math-clock', file: 'plugins/math-clock.js', name: '认识钟表', subject: 'math', category: 'number', grades: [1] },
    { id: 'math-patterns', file: 'plugins/math-patterns.js', name: '找规律', subject: 'math', category: 'number', grades: [1] },
    { id: 'math-picture-equations', file: 'plugins/math-picture-equations.js', name: '看图列式', subject: 'math', category: 'number', grades: [1] },
    { id: 'math-statistics', file: 'plugins/math-statistics.js', name: '分类与统计', subject: 'math', category: 'statistics', grades: [1] },
    { id: 'math-money', file: 'plugins/math-money.js', name: '认识人民币', subject: 'math', category: 'number', grades: [1] },
    // 数学（二年级）
    { id: 'math-unit-convert', file: 'plugins/math-unit-convert.js', name: '单位换算', subject: 'math', category: 'number', grades: [2, 3] },
    { id: 'math-geometry', file: 'plugins/math-geometry.js', name: '图形与几何', subject: 'math', category: 'geometry', grades: [2, 3] },
    { id: 'math-data-stats', file: 'plugins/math-data-stats.js', name: '数据收集与整理', subject: 'math', category: 'statistics', grades: [2, 3] },
    { id: 'math-logic-reasoning', file: 'plugins/math-logic-reasoning.js', name: '简单推理与数独', subject: 'math', category: 'statistics', grades: [2] },
    // 数学（三年级）
    { id: 'math-fraction', file: 'plugins/math-fraction.js', name: '分数的初步认识', subject: 'math', category: 'number', grades: [3] },
    { id: 'math-decimal', file: 'plugins/math-decimal.js', name: '小数的初步认识', subject: 'math', category: 'number', grades: [3] },
    { id: 'math-area', file: 'plugins/math-area.js', name: '面积', subject: 'math', category: 'geometry', grades: [3] },
    // 数学（三年级）
    { id: 'math-time-date', file: 'plugins/math-time-date.js', name: '时间与日期', subject: 'math', category: 'number', grades: [3] },
    { id: 'math-position-direction', file: 'plugins/math-position-direction.js', name: '方向与位置', subject: 'math', category: 'geometry', grades: [3] },
    { id: 'math-combination-set', file: 'plugins/math-combination-set.js', name: '搭配与集合', subject: 'math', category: 'statistics', grades: [3] },
    // 综合
    { id: 'math-comprehensive', file: 'plugins/math-comprehensive.js', name: '综合练习', subject: 'math', category: 'mixed', grades: [1, 2, 3] },
    // 语文（依赖 pinyin-bank.js，practice.html 会先加载 deps 再加载插件）
    { id: 'chinese-pinyin', file: 'plugins/chinese-pinyin.js', name: '拼音练习', subject: 'chinese', category: null, grades: [1, 2, 3, 4, 5, 6], deps: ['pinyin-bank.js'] },
    { id: 'pinyin-to-char', file: 'plugins/pinyin-to-char.js', name: '看拼音写字', subject: 'chinese', category: null, grades: [1, 2, 3, 4, 5, 6], deps: ['pinyin-bank.js'] },
    { id: 'chinese-comprehensive', file: 'plugins/chinese-comprehensive.js', name: '综合练习', subject: 'chinese', category: null, grades: [1, 2, 3, 4, 5, 6], deps: ['pinyin-bank.js'] },
    { id: 'english-alphabet', file: 'plugins/english-alphabet.js', name: '字母跟读', subject: 'english', category: null, grades: [1, 2, 3, 4, 5, 6] }
    // ... 更多插件将在后续逐步添加
  ];

  global.PLUGIN_REGISTRY = PLUGIN_REGISTRY;  // 浏览器：window.PLUGIN_REGISTRY
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PLUGIN_REGISTRY;
  }
})(typeof window !== 'undefined' ? window : globalThis);
