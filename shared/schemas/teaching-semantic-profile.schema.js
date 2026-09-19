/**
 * shared/schemas/teaching-semantic-profile.schema.js — TeachingSemanticProfile Schema（P25-01）
 *
 * 知识点教学语义模型的标准结构与字段级合法性规则。
 * 纯数据/纯函数，不依赖 DOM / window / 插件 / 渲染器 / Generator。
 *
 * P25 红线映射：
 *   - Profile 必须从 KBL 派生，所有教学语义唯一来源（本 Schema 不携带任何 KP 数据）；
 *   - 未经人工确认的数据不得伪造为事实：人工治理未完成的字段必须为 null/[]，
 *     并在 sourceStatus 中标记 NEEDS_REVIEW（禁止自动猜测填充）；
 *   - 不新增独立知识库 / 不建立第二套 KBL：核心 13 字段与 KBL 现有
 *     semantic/content/assessment/difficultyAnnotation 块一一对应或显式 NEEDS_REVIEW。
 *
 * 版本：1
 */
(function (global) {
  'use strict';

  var VERSION = 1;

  // KP canonical ID 形态（与 kbl-uniqueness 门禁口径一致）
  var KP_ID_RE = /^math-g[1-6]-(up|down|mixed|advance|comprehensive)-u\d{2}-k\d{3}$/;

  // ====== 字段来源状态 ======
  var STATUS = {
    KBL_DERIVED: 'kbl-derived',     // 由 KBL 现有字段投影得到（事实）
    NEEDS_REVIEW: 'needs-review',   // 人工治理未完成：值必须为 null/[]，禁止猜测（P25-02/03/09/10 填充）
    CONFIRMED: 'confirmed'          // 人工已确认（P25-02 之后才会出现）
  };

  // ====== 核心字段（指令建议最小字段）与类型规格 ======
  // nullable=true 的字段：允许 null（必须配 NEEDS_REVIEW/CONFIRMED 状态）
  // nonNull 数组字段：KBL 派生事实，允许空数组但不允许 null
  var FIELDS = {
    // —— 核心 13 字段 ——
    knowledgePointId:      { type: 'string',  nullable: false, core: true,  desc: 'canonical KP ID' },
    concept:               { type: 'string',  nullable: true,  core: true,  desc: '核心概念（KBL semantic.concept 投影）' },
    learningTargets:       { type: 'array',   nullable: true,  core: true,  desc: '学习目标（人工治理）' },
    knowledgeRelations:    { type: 'array',   nullable: true,  core: true,  desc: '知识关联（人工治理）' },
    operations:            { type: 'array',   nullable: false, core: true,  desc: '关键操作（KBL semantic.operations 投影）' },
    representations:       { type: 'array',   nullable: false, core: true,  desc: '表征方式（KBL semantic.representations 投影）' },
    contexts:              { type: 'array',   nullable: true,  core: true,  desc: '情境偏好（KBL assessment.contextDefault 投影或 NEEDS_REVIEW）' },
    cognitiveTargets:      { type: 'array',   nullable: true,  core: true,  desc: '认知目标（人工治理）' },
    questionIntent:        { type: 'object',  nullable: true,  core: true,  desc: '题目意图（P25-03 填充）' },
    variationDimensions:   { type: 'array',   nullable: true,  core: true,  desc: '变式维度（P25-09 填充）' },
    misconceptionTargets:  { type: 'array',   nullable: false, core: true,  desc: '易错点（KBL assessment.errors 投影；P25-10 治理）' },
    prerequisiteKnowledge: { type: 'array',   nullable: true,  core: true,  desc: '前置知识（人工治理）' },
    semanticConstraints:   { type: 'object',  nullable: true,  core: true,  desc: '语义约束（人工治理）' },
    // —— 派生辅助字段（携带 KBL 事实的扩展，非第二套语义） ——
    semanticFamily:        { type: 'string',  nullable: true,  core: false, desc: '语义族（KBL semantic.family 投影）' },
    cognitiveLevel:        { type: 'string',  nullable: true,  core: false, desc: '认知层级（KBL difficultyAnnotation.cognitiveLevel 投影）' },
    difficultyAnchor:      { type: 'object',  nullable: true,  core: false, desc: '难度锚点 {seedDifficulty,maxSteps,numberRange}（KBL difficultyAnnotation 投影）' },
    sourceStatus:          { type: 'object',  nullable: false, core: false, desc: '逐字段来源状态映射（本 Schema 管理的 provenance）' },
    meta:                  { type: 'object',  nullable: false, core: false, desc: '元信息 {schemaVersion,kblUnitId,unitName,grade,book,module}' }
  };

  function isKnownField(name) { return Object.prototype.hasOwnProperty.call(FIELDS, name); }

  function checkType(value, spec) {
    if (value === null) return spec.nullable;
    if (spec.type === 'array') return Array.isArray(value);
    if (spec.type === 'object') return typeof value === 'object' && !Array.isArray(value);
    if (spec.type === 'string') return typeof value === 'string' && value.length > 0;
    return false;
  }

  /**
   * validateProfile(profile) → { valid, errors[], warnings[] }
   * 规则：
   *   E01 未知字段（禁止外溢字段，防第二套 KBL）
   *   E02 缺失必填字段（knowledgePointId/sourceStatus/meta）
   *   E03 knowledgePointId 非 canonical 形态
   *   E04 字段类型不符
   *   E05 NEEDS_REVIEW 字段值非空（伪造嫌疑，红线 #8/#9）
   *   E06 sourceStatus 引用未知字段 / 状态值非法 / 覆盖不全
   *   E07 CONFIRMED 字段值为空（确认必须带来内容）
   */
  function validateProfile(p) {
    var errors = [], warnings = [];
    if (!p || typeof p !== 'object') {
      return { valid: false, errors: [{ code: 'E04', field: '*', message: 'profile 必须为对象' }], warnings: warnings };
    }
    // E01 未知字段
    Object.keys(p).forEach(function (k) {
      if (!isKnownField(k)) errors.push({ code: 'E01', field: k, message: '未知字段（禁止外溢）' });
    });
    // E02 必填
    ['knowledgePointId', 'sourceStatus', 'meta'].forEach(function (k) {
      if (p[k] == null) errors.push({ code: 'E02', field: k, message: '缺失必填字段' });
    });
    if (errors.length) return { valid: false, errors: errors, warnings: warnings };
    // E03 KP ID 形态
    if (typeof p.knowledgePointId !== 'string' || !KP_ID_RE.test(p.knowledgePointId)) {
      errors.push({ code: 'E03', field: 'knowledgePointId', message: '非 canonical KP ID 形态' });
    }
    // E04 类型 + E05 NEEDS_REVIEW 非空 + E07 CONFIRMED 为空
    Object.keys(FIELDS).forEach(function (k) {
      if (k === 'sourceStatus' || k === 'meta' || p[k] === undefined) return;
      if (!checkType(p[k], FIELDS[k])) {
        errors.push({ code: 'E04', field: k, message: '类型不符（期望 ' + FIELDS[k].type + (FIELDS[k].nullable ? '/null' : '') + '）' });
      }
    });
    var st = p.sourceStatus || {};
    // E06 sourceStatus 完整性与合法性
    Object.keys(st).forEach(function (k) {
      if (!isKnownField(k)) errors.push({ code: 'E06', field: k, message: 'sourceStatus 引用未知字段' });
      else if (STATUS.KBL_DERIVED !== st[k] && STATUS.NEEDS_REVIEW !== st[k] && STATUS.CONFIRMED !== st[k]) {
        errors.push({ code: 'E06', field: k, message: '非法状态值 ' + JSON.stringify(st[k]) });
      }
    });
    Object.keys(FIELDS).forEach(function (k) {
      if (k === 'sourceStatus' || k === 'meta') return;
      if (!(k in st)) errors.push({ code: 'E06', field: k, message: 'sourceStatus 缺少该字段的状态' });
    });
    // E05 NEEDS_REVIEW 必须为空
    Object.keys(st).forEach(function (k) {
      if (st[k] !== STATUS.NEEDS_REVIEW) return;
      var v = p[k];
      var nonEmpty = (v !== null && v !== undefined) && !(Array.isArray(v) && v.length === 0) &&
        !(typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (nonEmpty) errors.push({ code: 'E05', field: k, message: 'NEEDS_REVIEW 字段不得携带内容（未经人工确认的数据不得伪造为事实）' });
    });
    // E07 CONFIRMED 必须非空
    Object.keys(st).forEach(function (k) {
      if (st[k] !== STATUS.CONFIRMED) return;
      var v = p[k];
      var empty = v === null || v === undefined || (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
      if (empty) errors.push({ code: 'E07', field: k, message: 'CONFIRMED 字段不得为空' });
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  var API = {
    VERSION: VERSION,
    STATUS: STATUS,
    FIELDS: FIELDS,
    KP_ID_RE: KP_ID_RE,
    isKnownField: isKnownField,
    validateProfile: validateProfile,
    coreFields: function () {
      return Object.keys(FIELDS).filter(function (k) { return FIELDS[k].core; });
    },
    derivedFields: function () {
      return Object.keys(FIELDS).filter(function (k) { return !FIELDS[k].core; });
    }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.TeachingSemanticProfileSchema = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
