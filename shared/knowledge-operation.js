/**
 * shared/knowledge-operation.js — Canonical Operation Vocabulary (M1-02.1)
 *
 * 统一「知识点要求学生执行的操作」枚举，解决 Legacy 中潜在的同义词碎片
 * （add / addition / plus / sum / calc-add ...）。
 *
 * 仅数据/语义定义，不依赖 DOM / 插件 / 生成流程。
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  var OPERATIONS = {
    add:        { id: 'add',        name: '加法',         description: '执行加法运算',            category: 'arithmetic' },
    subtract:   { id: 'subtract',   name: '减法',         description: '执行减法运算',            category: 'arithmetic' },
    multiply:   { id: 'multiply',   name: '乘法',         description: '执行乘法运算',            category: 'arithmetic' },
    divide:     { id: 'divide',     name: '除法',         description: '执行除法运算',            category: 'arithmetic' },
    calculate:  { id: 'calculate',  name: '计算',         description: '进行数值计算',            category: 'arithmetic' },

    compare:    { id: 'compare',    name: '比较',         description: '比较大小/多少/关系',      category: 'comparison' },
    order:      { id: 'order',      name: '排序',         description: '按规则排序/排列',         category: 'comparison' },

    compose:    { id: 'compose',    name: '组合',         description: '组合/合成整体',           category: 'composition' },
    decompose:  { id: 'decompose',  name: '分解',         description: '分解/拆分',               category: 'composition' },

    measure:    { id: 'measure',    name: '度量',         description: '测量/量化',               category: 'measurement' },
    convert:    { id: 'convert',    name: '换算',         description: '单位/形式换算',           category: 'measurement' },

    identify:   { id: 'identify',   name: '识别',         description: '识别/辨认对象或属性',     category: 'classification' },
    classify:   { id: 'classify',   name: '分类',         description: '分类/归类',               category: 'classification' },

    read:       { id: 'read',       name: '认读',         description: '认读/阅读符号文字',       category: 'literacy' },
    write:      { id: 'write',      name: '书写',         description: '书写/表达',               category: 'literacy' },

    reason:     { id: 'reason',     name: '推理',         description: '逻辑推理',                category: 'cognition' },
    represent:  { id: 'represent',  name: '表征',         description: '用图/式/模型表征',        category: 'cognition' },
    model:      { id: 'model',      name: '建模',         description: '建立模型解决问题',        category: 'cognition' }
  };

  var ALIASES = {
    addition: 'add', plus: 'add', sum: 'add', 加: 'add', 加法: 'add', calcadd: 'add', 'add-operation': 'add',
    subtraction: 'subtract', minus: 'subtract', 减: 'subtract', 减法: 'subtract', sub: 'subtract',
    multiplication: 'multiply', 乘: 'multiply', 乘法: 'multiply', mult: 'multiply',
    division: 'divide', 除: 'divide', 除法: 'divide', div: 'divide',
    比较: 'compare', 比大小: 'compare', comparison: 'compare', 对比: 'compare',
    排序: 'order', 顺序: 'order', sort: 'order', 排列: 'order',
    组合: 'compose', 合成: 'compose', 合并: 'compose',
    分解: 'decompose', 拆分: 'decompose',
    测量: 'measure', 度量: 'measure',
    换算: 'convert', 转换: 'convert',
    识别: 'identify', 辨认: 'identify', 认: 'identify',
    分类: 'classify', 归类: 'classify',
    读: 'read', 认读: 'read',
    写: 'write', 书写: 'write',
    计算: 'calculate', compute: 'calculate', calc: 'calculate',
    推理: 'reason', 逻辑: 'reason',
    表示: 'represent', 表征: 'represent',
    建模: 'model'
  };

  function isCanonical(id) {
    return OPERATIONS.hasOwnProperty(id);
  }

  function normalize(raw) {
    if (raw == null) return { canonical: null, status: 'unresolved' };
    var s = String(raw).trim();
    if (isCanonical(s)) return { canonical: s, status: 'canonical' };
    if (ALIASES.hasOwnProperty(s)) return { canonical: ALIASES[s], status: 'alias' };
    return { canonical: null, status: 'unresolved' };
  }

  function hasAliasCycle() {
    var visited = {}, inStack = {};
    var keys = Object.keys(ALIASES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (visited[k]) continue;
      var chain = [], cur = k;
      while (cur != null) {
        if (inStack[cur]) return true;
        if (visited[cur]) break;
        inStack[cur] = true; visited[cur] = true; chain.push(cur);
        cur = ALIASES[cur];
        if (cur != null && isCanonical(cur)) break;
      }
      inStack = {};
    }
    return false;
  }

  var API = {
    VERSION: VERSION,
    OPERATIONS: OPERATIONS,
    ALIASES: ALIASES,
    CANONICAL_IDS: Object.keys(OPERATIONS),
    isCanonical: isCanonical,
    normalize: normalize,
    hasAliasCycle: hasAliasCycle
  };

  global.KnowledgeOperation = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
