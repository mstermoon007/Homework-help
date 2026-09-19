/**
 * shared/knowledge/runtime/teaching-semantic-profile.js — TeachingSemanticProfile Runtime Read Model（P25-01）
 *
 * 唯一职责：把 KBL 现有字段（semantic / content / assessment / difficultyAnnotation）投影为
 * TeachingSemanticProfile 结构。纯派生，不做任何猜测填充：
 *   - KBL 已有字段   → kbl-derived（事实投影，允许空数组）
 *   - KBL 尚无字段   → null/[] + needs-review（等待 P25-02/03/09/10 人工治理，禁止伪造）
 *
 * 红线映射：
 *   - 不新增独立知识库 / 不建立第二套 KBL：本模块只读 KBL，不保存任何 KP 语义数据；
 *   - Generator/Strategy 不得自行定义教学语义：消费方只能经本 read model 取 Profile；
 *   - 数据落位：人工治理数据（P25-02 产出）未来经 KBL 回灌后仍由本模块投影，形成唯一来源。
 *
 * 依赖注入风格与 knowledge-runtime 一致：deriveTeachingProfile(kpEntry) 为纯函数；
 * createTeachingProfileResolver({ getKp }) 包装为按 KP ID 取用的 read model。
 */
(function (global) {
  'use strict';

  var Schema = (typeof require === 'function')
    ? require('../../schemas/teaching-semantic-profile.schema.js')
    : (global.TeachingSemanticProfileSchema || null);

  if (!Schema) throw new Error('teaching-semantic-profile: TeachingSemanticProfileSchema 不可用');

  /**
   * deriveTeachingProfile(kpEntry) → TeachingSemanticProfile（已过 Schema 校验）
   * @param kpEntry KBL KP 条目（kbl/data/math/g1..g6/knowledge-points.json 元素，含
   *                knowledgeId/name/unitId/unitName/grade/book/module、semantic、
   *                content、assessment、difficultyAnnotation）
   */
  function deriveTeachingProfile(kpEntry) {
    if (!kpEntry || typeof kpEntry !== 'object') throw new Error('deriveTeachingProfile: kpEntry 缺失');
    var id = kpEntry.knowledgeId;
    if (!id) throw new Error('deriveTeachingProfile: kpEntry.knowledgeId 缺失');

    var sem = kpEntry.semantic || {};
    var ann = kpEntry.difficultyAnnotation || {};
    var asm = kpEntry.assessment || {};

    // contexts：KBL 有 assessment.contextDefault 则投影，否则 NEEDS_REVIEW
    var contexts = (asm.contextDefault != null && asm.contextDefault !== '') ? [asm.contextDefault] : null;
    var contextsStatus = contexts ? Schema.STATUS.KBL_DERIVED : Schema.STATUS.NEEDS_REVIEW;

    // concept：KBL semantic.concept（可能为空串/缺失 → NEEDS_REVIEW）
    var concept = (typeof sem.concept === 'string' && sem.concept.length > 0) ? sem.concept : null;
    var conceptStatus = concept ? Schema.STATUS.KBL_DERIVED : Schema.STATUS.NEEDS_REVIEW;

    var profile = {
      knowledgePointId: id,
      // —— 核心 13 字段 ——
      concept: concept,
      learningTargets: null,          // KBL 无此字段；P25-02 人工治理
      knowledgeRelations: null,       // KBL relations 当前为空；P25-02 治理
      operations: sem.operations || [],
      representations: sem.representations || [],
      contexts: contexts,
      cognitiveTargets: null,         // P25-02 人工治理（cognitiveLevel 仅是锚点，非目标清单）
      questionIntent: null,           // P25-03 填充
      variationDimensions: null,      // P25-09 填充
      misconceptionTargets: asm.errors || [],
      prerequisiteKnowledge: null,    // P25-02 人工治理
      semanticConstraints: null,      // P25-02 人工治理
      // —— 派生辅助字段 ——
      semanticFamily: (typeof sem.family === 'string' && sem.family.length > 0) ? sem.family : null,
      cognitiveLevel: (typeof ann.cognitiveLevel === 'string' && ann.cognitiveLevel.length > 0) ? ann.cognitiveLevel : null,
      difficultyAnchor: {
        seedDifficulty: ann.seedDifficulty != null ? ann.seedDifficulty : null,
        maxSteps: ann.maxSteps != null ? ann.maxSteps : null,
        numberRange: ann.numberRange || null
      },
      sourceStatus: {
        knowledgePointId: Schema.STATUS.KBL_DERIVED,
        concept: conceptStatus,
        learningTargets: Schema.STATUS.NEEDS_REVIEW,
        knowledgeRelations: Schema.STATUS.NEEDS_REVIEW,
        operations: Schema.STATUS.KBL_DERIVED,
        representations: Schema.STATUS.KBL_DERIVED,
        contexts: contextsStatus,
        cognitiveTargets: Schema.STATUS.NEEDS_REVIEW,
        questionIntent: Schema.STATUS.NEEDS_REVIEW,
        variationDimensions: Schema.STATUS.NEEDS_REVIEW,
        misconceptionTargets: Schema.STATUS.KBL_DERIVED,
        prerequisiteKnowledge: Schema.STATUS.NEEDS_REVIEW,
        semanticConstraints: Schema.STATUS.NEEDS_REVIEW,
        semanticFamily: sem.family ? Schema.STATUS.KBL_DERIVED : Schema.STATUS.NEEDS_REVIEW,
        cognitiveLevel: ann.cognitiveLevel ? Schema.STATUS.KBL_DERIVED : Schema.STATUS.NEEDS_REVIEW,
        difficultyAnchor: Schema.STATUS.KBL_DERIVED
      },
      meta: {
        schemaVersion: Schema.VERSION,
        kblUnitId: kpEntry.unitId || null,
        unitName: kpEntry.unitName || null,
        grade: kpEntry.grade || null,
        book: kpEntry.book || null,
        module: kpEntry.module || null
      }
    };

    var check = Schema.validateProfile(profile);
    if (!check.valid) {
      throw new Error('deriveTeachingProfile: 投影结果未通过 Schema 校验 ' + id + ' — ' +
        check.errors.map(function (e) { return e.code + ':' + e.field; }).join('; '));
    }
    return profile;
  }

  /**
   * createTeachingProfileResolver({ getKp }) → { get, has }
   * DI：getKp(kpId) 由调用方提供（Node 测试/门禁读 kbl/data；运行时经 KnowledgeRuntime 单入口）。
   * 结果缓存，不做任何派生外的数据加工。
   */
  function createTeachingProfileResolver(deps) {
    var getKp = deps && deps.getKp;
    if (typeof getKp !== 'function') throw new Error('createTeachingProfileResolver: 需要 getKp(kpId)');
    var cache = {};
    return {
      get: function (kpId) {
        if (cache[kpId]) return cache[kpId];
        var kp = getKp(kpId);
        if (!kp) return null;
        cache[kpId] = deriveTeachingProfile(kp);
        return cache[kpId];
      },
      has: function (kpId) { return !!cache[kpId]; }
    };
  }

  var API = {
    deriveTeachingProfile: deriveTeachingProfile,
    createTeachingProfileResolver: createTeachingProfileResolver
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else if (global) {
    global.TeachingSemanticProfile = API;
  }
})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
