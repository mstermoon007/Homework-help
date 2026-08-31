/**
 * shared/schemas/semantic-question.schema.js — SemanticQuestion Schema (M5-R01)
 *
 * 定义标准 SemanticQuestion 结构、字段级合法性规则、枚举值。
 * 纯数据/纯函数，不依赖 DOM / window / 插件 / 渲染器。
 *
 * 版本：1
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  // ====== 题型枚举（与 KnowledgePoint 兼容）======
  var QUESTION_TYPES = [
    'calc',       // 计算题
    'fill',       // 填空题
    'judge',      // 判断题
    'choice',     // 选择题
    'operate',    // 操作题（作图/摆图等）
    'apply',      // 应用题
    'open',       // 开放题
    'read-aloud'  // 跟读/口语
  ];

  // ====== 难度档位 ======
  var DIFFICULTY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // ====== 认知层级 ======
  var COGNITIVE_LEVELS = ['了解', '理解', '掌握', '运用'];

  // ====== 答案模式 ======
  var ANSWER_MODES = ['input', 'choice', 'multi', 'none', 'read-aloud'];

  // ====== 图形类型 ======
  var GRAPHIC_TYPES = [
    'geometry',   // 几何图形
    'chart',      // 统计图表
    'diagram',    // 示意图
    'number-line', // 数轴
    'grid',       // 网格/方格
    'custom'      // 自定义
  ];

  // ====== 图形子类型 ======
  var GRAPHIC_SUBTYPES = {
    geometry: ['triangle', 'rectangle', 'circle', 'polygon', 'angle', 'line', 'point'],
    chart: ['bar', 'line', 'pie', 'scatter'],
    diagram: ['flow', 'tree', 'venn', 'mindmap'],
    'number-line': ['integer', 'fraction', 'decimal'],
    grid: ['dot', 'square', 'isometric'],
    custom: []
  };

  // ====== 干扰项错误类型分类 ======
  var DISTRACTOR_ERROR_TYPES = [
    '口诀混淆',
    '计算错误',
    '进位错误',
    '退位错误',
    '概念混淆',
    '单位混淆',
    '顺序错误',
    '符号错误',
    '估算偏差',
    '逻辑跳跃'
  ];

  // ====== 验证错误码 ======
  var ERROR_CODES = {
    // Schema 类
    SCHEMA_INVALID: 'SCHEMA_INVALID',
    REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',
    FIELD_TYPE_MISMATCH: 'FIELD_TYPE_MISMATCH',
    ENUM_VALUE_INVALID: 'ENUM_VALUE_INVALID',

    // KnowledgePoint 类
    KP_MISSING: 'KP_MISSING',
    KP_MISMATCH: 'KP_MISMATCH',
    KP_OPERATION_INVALID: 'KP_OPERATION_INVALID',
    KP_FORMAT_INVALID: 'KP_FORMAT_INVALID',
    KP_COGNITIVE_INVALID: 'KP_COGNITIVE_INVALID',
    KP_CONTEXT_INVALID: 'KP_CONTEXT_INVALID',
    KP_GRAPHIC_INVALID: 'KP_GRAPHIC_INVALID',

    // Answer 类
    ANSWER_INVALID: 'ANSWER_INVALID',
    ANSWER_MISMATCH: 'ANSWER_MISMATCH',
    ANSWER_TYPE_MISMATCH: 'ANSWER_TYPE_MISMATCH',
    ANSWER_OUT_OF_DOMAIN: 'ANSWER_OUT_OF_DOMAIN',

    // Distractor 类
    DISTRACTOR_COUNT_INVALID: 'DISTRACTOR_COUNT_INVALID',
    DISTRACTOR_DUPLICATE: 'DISTRACTOR_DUPLICATE',
    DISTRACTOR_EQUALS_ANSWER: 'DISTRACTOR_EQUALS_ANSWER',
    DISTRACTOR_TYPE_MISMATCH: 'DISTRACTOR_TYPE_MISMATCH',
    DISTRACTOR_OUT_OF_DOMAIN: 'DISTRACTOR_OUT_OF_DOMAIN',
    DISTRACTOR_ERROR_TYPE_INVALID: 'DISTRACTOR_ERROR_TYPE_INVALID',

    // Structure 类
    STRUCTURE_INVALID: 'STRUCTURE_INVALID',
    STEPS_EXCEED: 'STEPS_EXCEED',
    BRACKETS_VIOLATION: 'BRACKETS_VIOLATION',
    OPERATIONS_VIOLATION: 'OPERATIONS_VIOLATION',
    OPERAND_COUNT_INVALID: 'OPERAND_COUNT_INVALID',
    OPERAND_RANGE_INVALID: 'OPERAND_RANGE_INVALID',

    // Difficulty 类
    DIFFICULTY_MISMATCH: 'DIFFICULTY_MISMATCH',
    DIFFICULTY_OUT_OF_RANGE: 'DIFFICULTY_OUT_OF_RANGE',

    // Duplicate 类
    DUPLICATE_QUESTION: 'DUPLICATE_QUESTION',

    // Graphic 类
    GRAPHIC_INVALID: 'GRAPHIC_INVALID',
    GRAPHIC_TYPE_UNREGISTERED: 'GRAPHIC_TYPE_UNREGISTERED',
    GRAPHIC_PARAMS_INCOMPLETE: 'GRAPHIC_PARAMS_INCOMPLETE',
    GRAPHIC_RENDERER_MISSING: 'GRAPHIC_RENDERER_MISSING',

    // Render 类
    RENDER_PREFLIGHT_FAILED: 'RENDER_PREFLIGHT_FAILED',
    HTML_GENERATION_FAILED: 'HTML_GENERATION_FAILED',
    SVG_GENERATION_FAILED: 'SVG_GENERATION_FAILED',
    PRINT_GENERATION_FAILED: 'PRINT_GENERATION_FAILED'
  };

  // ====== 严重级别 ======
  var SEVERITY = {
    ERROR: 'ERROR',     // 阻断：题目不可用
    WARNING: 'WARNING', // 警告：题目可用但有隐患
    INFO: 'INFO'        // 信息：仅记录
  };

  // ====== 默认值工厂 ======
  function defaultMetadata() {
    return {
      generator: null,           // generator id (e.g., 'generator:arithmetic-addition' or 'legacy:math-oral')
      generatorVersion: null,    // semantic version string (e.g., '1.0.0')
      seed: null,                // 种子（可复现）
      timestamp: null,           // ISO timestamp
      retryCount: 0,             // 重试次数
      validationScore: null,     // 质量评分
      tags: []                   // 标签
    };
  }

  function defaultGraphic() {
    return {
      type: null,
      subtype: null,
      params: {},
      renderHints: {}
    };
  }

  function defaultContent() {
    return {
      prompt: '',           // 题干文本（纯文本，无 HTML/SVG）
      stem: null,           // 题干结构化表示（可选）
      language: 'zh-CN',    // 语言
      readingLevel: null    // 阅读难度等级
    };
  }

  function defaultQuestion() {
    return {
      prompt: '',           // 题干（核心文本）
      hint: null,           // 提示
      answerMode: 'input',  // 答题模式
      expectedFormat: null  // 期望答案格式（如 'number', 'text', 'choice-index'）
    };
  }

  function defaultAnswer() {
    return {
      value: null,          // 正确答案值
      acceptable: [],       // 可接受的替代答案
      unit: null,           // 单位
      precision: null,      // 精度要求（小数位数等）
      explanation: null     // 解析
    };
  }

  function defaultDistractor() {
    return {
      value: null,
      errorType: null,      // DISTRACTOR_ERROR_TYPES 中的值
      weight: 1             // 权重（用于自适应选择）
    };
  }

  // ====== 公共 API ======
  var API = {
    VERSION: VERSION,
    QUESTION_TYPES: QUESTION_TYPES,
    DIFFICULTY_LEVELS: DIFFICULTY_LEVELS,
    COGNITIVE_LEVELS: COGNITIVE_LEVELS,
    ANSWER_MODES: ANSWER_MODES,
    GRAPHIC_TYPES: GRAPHIC_TYPES,
    GRAPHIC_SUBTYPES: GRAPHIC_SUBTYPES,
    DISTRACTOR_ERROR_TYPES: DISTRACTOR_ERROR_TYPES,
    ERROR_CODES: ERROR_CODES,
    SEVERITY: SEVERITY,
    defaultMetadata: defaultMetadata,
    defaultGraphic: defaultGraphic,
    defaultContent: defaultContent,
    defaultQuestion: defaultQuestion,
    defaultAnswer: defaultAnswer,
    defaultDistractor: defaultDistractor,

    // 类型检查器
    isValidQuestionType: function (t) { return QUESTION_TYPES.indexOf(t) !== -1; },
    isValidDifficulty: function (d) { return DIFFICULTY_LEVELS.indexOf(d) !== -1; },
    isValidCognitiveLevel: function (c) { return COGNITIVE_LEVELS.indexOf(c) !== -1; },
    isValidAnswerMode: function (m) { return ANSWER_MODES.indexOf(m) !== -1; },
    isValidGraphicType: function (t) { return GRAPHIC_TYPES.indexOf(t) !== -1; },
    isValidGraphicSubtype: function (type, subtype) {
      var list = GRAPHIC_SUBTYPES[type];
      return list && list.indexOf(subtype) !== -1;
    },
    isValidDistractorErrorType: function (e) { return DISTRACTOR_ERROR_TYPES.indexOf(e) !== -1; },
    isValidSeverity: function (s) { return SEVERITY[s] != null; }
  };

  // 模块导出
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.SemanticQuestionSchema = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));