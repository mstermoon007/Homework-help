// shared/module-catalog.js
/**
 * shared/module-catalog.js — 全科目题型模块目录（唯一数据源）
 *
 * 以结构化方式组织数学基础模块 M0–M12、竞赛模块 C1–C9、语文模块 N1–N8 与英语模块 E1–E6，
 * 供题型选择页、练习页与模块化开发参考。
 *
 * 科目代码（SUBJECTS）：
 *   math 数学（模块前缀 M/C）
 *   cn   语文（模块前缀 N）
 *   en   英语（模块前缀 E）
 * 模块 ID 全局唯一：{M|C|N|E}{序号}，与知识点 ID 的 moduleIdLower 段对应。
 *
 * 数据结构：
 *   MODULE_CATALOG[] -> { id, name, subject, grades: number[], category, level?, icon?, desc?, gradeStatus?, status? }
 *   - id       模块唯一标识
 *   - name     模块中文名
 *   - subject  所属科目（SUBJECTS 之一：math / cn / en）
 *   - grades   适用年级（1-6）
 *   - category 领域（数学：number / geometry / statistics / mixed；
 *              语文英语：language-basic / language-advanced / literature / reading / writing / comprehensive）
 *   - level    层级（仅数学模块：basic 基础 / competition 竞赛；语文英语暂不使用）
 *   - icon     展示图标（emoji，可选）
 *   - desc     模块描述（可选）
 *   - gradeStatus  按年级就绪状态（仅数学竞赛模块）：{ [grade]: 'active' | 'placeholder' }
 *       与 shared/knowledge-bank.js 对应年级知识点 status 保持一致。
 *       五年级竞赛处于重新开发阶段（见 docs/DEV_LOG.md 附录 D，原 g5-competition-knowledge-map），
 *       四年级/六年级沿用既有实现；基础模块 M0-M12 全年级 active。
 *   - status   模块整体就绪状态（仅语文/英语模块）：'active' | 'placeholder'
 *       placeholder 表示目录已建、插件与知识点待逐轮激活（如 N8/E6 综合卷）。
 *
 * 导出：
 *   MODULE_CATALOG     = BASIC_MODULES.concat(CHINESE_MODULES, ENGLISH_MODULES) 再并竞赛（全量，供页面渲染）
 *   BASIC_MODULES      数学基础模块数组（M0-M12，subject=math）
 *   COMPETITION_MODULES 数学竞赛模块数组（C1-C9，subject=math）
 *   CHINESE_MODULES    语文模块数组（N1-N8，subject=cn）
 *   ENGLISH_MODULES    英语模块数组（E1-E6，subject=en）
 *   MODULE_BY_ID(id)   —— 按 id 查模块，未命中返回 null
 *
 * 浏览器：<script src="shared/module-catalog.js"></script> -> 全局 MODULE_CATALOG / BASIC_MODULES / ...
 * Node：  const MODULE_CATALOG = require('./shared/module-catalog.js')
 */
(function(global) {
  /** 科目代码（全站唯一约定，知识点 ID 前缀与此一致） */
  const SUBJECTS = { MATH: 'math', CN: 'cn', EN: 'en' };

  const BASIC_MODULES = [
    { id: 'M0', name: '巧算专项', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic' },
    { id: 'M1', name: '口算练习', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M2', name: '竖式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M3', name: '脱式计算', subject: SUBJECTS.MATH, grades: [2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M4', name: '填空题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M5', name: '连线题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M6', name: '操作题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'geometry', level: 'basic' },
    { id: 'M7', name: '看图列式', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'number', level: 'basic' },
    { id: 'M8', name: '解决问题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    { id: 'M9', name: '分类与整理', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
    { id: 'M10', name: '推理与数学广角', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'statistics', level: 'basic' },
   { id: 'M11', name: '判断题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
   { id: 'M12', name: '选择题', subject: SUBJECTS.MATH, grades: [1,2,3,4,5,6], category: 'mixed', level: 'basic' },
    // M13 提前预习：一年级乘除法启蒙（乘法表/除法表静态展示 + 乘除填空随机练习），
    // 携带自定义显示属性（卡片草绿色 + 胶囊标签），知识点 ID 对应小写 m13
    {
      id: 'M13', name: '提前预习', subject: SUBJECTS.MATH, grades: [1], category: 'number', level: 'basic',
      display: {
        color: '#7cb342',
        tags: ['乘法表', '除法表', '乘除法填空']
      }
    }
  ];

  const COMPETITION_MODULES = [
    { id: 'C1', name: '数字谜与数阵图', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🧩',
      desc: '竖式/横式数字谜、幻方与数阵图填数，训练位值分析与枚举推理',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C2', name: '数论初步', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔢',
      desc: '整除特征、奇偶性、质数合数、因数倍数与余数规律',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C3', name: '组合计数', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🔀',
      desc: '加乘原理、排列组合初步、枚举与容斥、找规律计数',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C4', name: '几何模型', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'geometry', level: 'competition', icon: '📐',
      desc: '鸟头、蝴蝶、燕尾、一半模型，圆与扇形，勾股定理与格点面积',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C5', name: '行程问题', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'number', level: 'competition', icon: '🚗',
      desc: '相遇追及、火车过桥、流水行船与环形跑道，画线段图分析',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C6', name: '工程与浓度', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '🏗️',
      desc: '工程问题（工作量/工效/工时）、溶液浓度混合与配比问题',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C7', name: '分数与巧算', subject: SUBJECTS.MATH, grades: [5,6], category: 'number', level: 'competition', icon: '✨',
      desc: '分数与小数巧算、繁分数化简、换元与裂项等速算技巧',
      gradeStatus: { 5: 'active', 6: 'active' } },
    { id: 'C8', name: '最值与逻辑推理', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'statistics', level: 'competition', icon: '🧠',
      desc: '最大最小问题、抽屉原理、逻辑推理（列表/假设法）与对策问题',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } },
    { id: 'C9', name: '竞赛综合', subject: SUBJECTS.MATH, grades: [4,5,6], category: 'mixed', level: 'competition', icon: '🏆',
      desc: '跨模块综合卷：按各竞赛模块知识点 weight 加权混编，模拟竞赛组卷',
      gradeStatus: { 4: 'active', 5: 'active', 6: 'active' } }
  ];

  // 语文模块（N 系列）：目录先行，插件与知识点逐轮激活（status: placeholder 为占位）
  const CHINESE_MODULES = [
    { id: 'N1', name: '拼音基础', subject: SUBJECTS.CN, grades: [1,2,3], category: 'language-basic', status: 'active',
      desc: '声母韵母、声调整体认读、拼读与标调规则' },
    { id: 'N2', name: '识字写字', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '生字认读、笔顺结构、形近字与多音字辨析' },
    { id: 'N3', name: '词语积累', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '近反义词、成语积累、词语搭配与归类' },
    { id: 'N4', name: '句型句式', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '把字句被字句、扩句缩句、修改病句与句式变换' },
    { id: 'N5', name: '古诗文默写', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'literature', status: 'placeholder',
      desc: '课内古诗词与文言名句填空、理解性默写' },
    { id: 'N6', name: '阅读理解', subject: SUBJECTS.CN, grades: [3,4,5,6], category: 'reading', status: 'placeholder',
      desc: '记叙文/说明文阅读、词句赏析与信息提取' },
    { id: 'N7', name: '写作基础', subject: SUBJECTS.CN, grades: [3,4,5,6], category: 'writing', status: 'placeholder',
      desc: '看图写话、片段描写与习作构思提纲' },
    { id: 'N8', name: '语文综合', subject: SUBJECTS.CN, grades: [1,2,3,4,5,6], category: 'comprehensive', status: 'placeholder',
      desc: '跨模块综合卷：按各语文模块知识点 weight 加权混编' }
  ];

  // 英语模块（E 系列）：目录先行，插件与知识点逐轮激活
  const ENGLISH_MODULES = [
    { id: 'E1', name: '字母与发音', subject: SUBJECTS.EN, grades: [3], category: 'language-basic', status: 'active',
      desc: '26 个字母读写、大小写配对与自然拼读启蒙' },
    { id: 'E2', name: '词汇拼写', subject: SUBJECTS.EN, grades: [3,4,5,6], category: 'language-basic', status: 'placeholder',
      desc: '核心词表拼写、词性分类与高频短语' },
    { id: 'E3', name: '句型语法', subject: SUBJECTS.EN, grades: [4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '基本句型、时态初步与疑问句转换' },
    { id: 'E4', name: '情景对话', subject: SUBJECTS.EN, grades: [4,5,6], category: 'language-advanced', status: 'placeholder',
      desc: '问候购物问路等情景问答匹配与补全' },
    { id: 'E5', name: '阅读短文', subject: SUBJECTS.EN, grades: [5,6], category: 'reading', status: 'placeholder',
      desc: '短文阅读理解、判断正误与信息定位' },
    { id: 'E6', name: '英语综合', subject: SUBJECTS.EN, grades: [5,6], category: 'comprehensive', status: 'placeholder',
      desc: '跨模块综合卷：按各英语模块知识点 weight 加权混编' }
  ];

  const MODULE_CATALOG = BASIC_MODULES
    .concat(CHINESE_MODULES)
    .concat(ENGLISH_MODULES)
    .concat(COMPETITION_MODULES);

  const MODULE_BY_ID = {};
  MODULE_CATALOG.forEach(function (m) {
    if (MODULE_BY_ID[m.id]) throw new Error('module-catalog：模块 ID 重复 ' + m.id);
    MODULE_BY_ID[m.id] = m;
  });
  MODULE_CATALOG.byId = function (id) { return MODULE_BY_ID[id] || null; };
  MODULE_CATALOG.SUBJECTS = SUBJECTS;

  // ---- R4：题型→可见模块（决策上收，源自 practice.html QT_STD_MODULES）----
  // 标准题型 → 支撑该题型的模块 id 列表（用于 qt=标准题型 时过滤可见模块）。
  // 修复 calc 不含 M1 漂移：M1 口算知识点 applicable_question_types 含 calc，
  //   calc 应能过滤出 M1（口算）模块，故 calc: ['M1','M2','M3']。
  const TYPE_MODULES = {
    oral: ['M1'], calc: ['M1', 'M2', 'M3'], vertical: ['M2'], mixed: ['M3'],
    fill: ['M4'], match: ['M5'], operation: ['M6', 'M9'], draw: ['M6', 'M9'],
    picture: ['M7'], apply: ['M8'], word: ['M8'], stats: ['M9'], reason: ['M10'],
    judge: ['M11'], choice: ['M12'], open: ['M6', 'M8'], geometry: ['M6']
  };

  // 「题型→可见模块」查询：返回支撑该题型的模块 id 数组；未知题型返回 null。
  // 规范入口：先按原始值查，未命中再小写归一查（兼容 URL 参数大小写漂移）。
  function visibleModulesForType(type) {
    var t = String(type == null ? '' : type).toLowerCase().trim();
    if (!t) return null;
    var mods = TYPE_MODULES[t];
    return mods ? mods.slice() : null;
  }

  // 知识点在题型过滤范围内的可见性查询（大服务层可见性查询服务，源自 practice.html kpVisibleInQT）。
  //   - 无 qt 视为全部可见
  //   - competition 仅看 C 模块
  //   - 模块 id / 知识点类型 / 题型→可见模块 三向匹配
  function kpVisibleInType(kp, type) {
    var q = String(type == null ? '' : type).toLowerCase().trim();
    if (!q) return true;
    if (q === 'competition') return String((kp && kp.moduleId) || '').toUpperCase().charAt(0) === 'C';
    if (kp && kp.moduleId && String(kp.moduleId).toLowerCase() === q) return true;
    if (kp && kp.type && String(kp.type).toLowerCase() === q) return true;
    var mods = TYPE_MODULES[q];
    if (mods && kp && kp.moduleId && mods.indexOf(kp.moduleId) !== -1) return true;
    return false;
  }

  MODULE_CATALOG.TYPE_MODULES = TYPE_MODULES;
  MODULE_CATALOG.visibleModulesForType = visibleModulesForType;
  MODULE_CATALOG.kpVisibleInType = kpVisibleInType;

  global.MODULE_CATALOG = MODULE_CATALOG;
  global.SUBJECTS = SUBJECTS;
  global.BASIC_MODULES = BASIC_MODULES;
  global.COMPETITION_MODULES = COMPETITION_MODULES;
  global.CHINESE_MODULES = CHINESE_MODULES;
  global.ENGLISH_MODULES = ENGLISH_MODULES;
  if (typeof module !== 'undefined') module.exports = MODULE_CATALOG;
})(typeof window !== 'undefined' ? window : global);
