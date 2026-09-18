/**
 * shared/orchestration/knowledge-context.js — POL 唯一知识适配入口
 *
 * 职责边界：
 *   - 只做 KBL Runtime → Standard Practice Knowledge Context 的形状转换。
 *   - 必要的临时兼容字段只在本文件转换：knowledgeId → id / unitId → moduleId / gN → N。
 *   - 禁止写回 KBL；禁止扩散到 Generator / SVG / Strategy。
 *
 * 数据来源：App.KNOWLEDGE（knowledge-runtime.js 唯一的公开知识 API）。
 * 不新建 KnowledgeService / Repository / Manager / Facade。
 *
 * 浏览器载入顺序：knowledge-runtime.js → 本文件（boot 阶段经 <script> 引入）；
 * Node: require 本文件自动装载 runtime（幂等，重复 require 无副作用）。
 *
 * @module shared/orchestration/knowledge-context
 */
(function (global) {
  'use strict';

  // 幂等装载 Runtime（浏览器已加载则直接使用；Node 兜底）
  function getRuntime() {
    var App = (typeof global !== 'undefined' && global.App) ? global.App : null;
    if (App && App.KNOWLEDGE) return App.KNOWLEDGE;
    if (typeof module !== 'undefined' && module.exports) {
      try { require('../knowledge/runtime/knowledge-runtime.js'); } catch (e) { /* 交由下方契约校验 */ }
    }
    App = (typeof global !== 'undefined' && global.App) ? global.App : null;
    return (App && App.KNOWLEDGE) ? App.KNOWLEDGE : null;
  }

  // ---------- 形状转换（仅本文件允许） ----------
  /** gN → N：'g4' -> 4；非 gN 输入原样返回 */
  function toN(grade) {
    if (grade == null) return null;
    if (typeof grade === 'number') return grade;
    if (/^g[1-6]$/.test(String(grade))) return parseInt(String(grade).slice(1), 10);
    return grade;
  }

  /** N → gN：4 -> 'g4'；非数字输入原样返回 */
  function toG(grade) {
    if (grade == null) return null;
    if (typeof grade === 'number' && grade >= 1 && grade <= 6) return 'g' + grade;
    if (/^g[1-6]$/.test(String(grade))) return String(grade);
    return grade;
  }

  /**
   * canonical KP → Practice Context（池条目视图）。
   *   knowledgeId → id
   *   module      → moduleId（模块目录 ID，M0-M13/C1-C9，legacy 语义）
   *   grade gN    → N
   * 视图是派生副本浅投影，不改写 canonical；只暴露消费方所需字段。
   * 契约：所有键恒存在；缺失值统一为 null（不出现 undefined）。
   */
  function adaptKp(kp) {
    if (!kp || typeof kp !== 'object') return null;
    return {
      id: kp.knowledgeId,
      knowledgeId: kp.knowledgeId,
      moduleId: kp.module != null ? kp.module : null,
      unitId: kp.unitId != null ? kp.unitId : null,
      unitName: kp.unitName != null ? kp.unitName : null,
      name: kp.name != null ? kp.name : null,
      type: kp.type != null ? kp.type : null,
      category: (kp.semantic && kp.semantic.category) || null,
      pluginId: (kp.generation && kp.generation.pluginId) || null,
      subject: kp.subject != null ? kp.subject : null,
      grade: toN(kp.grade),
      weight: kp.weight != null ? kp.weight : null,
      status: kp.status != null ? kp.status : null
    };
  }

  /**
   * UI 兼容视图（目录/选择页）：canonical → legacy 字段名。
   * 与 adaptKp 同属本文件的转换边界，仅供页面 UI 消费，不进入生成链。
   * 契约：所有键恒存在；缺失值统一为 null（不出现 undefined）。
   */
  function uiKp(kp) {
    if (!kp || typeof kp !== 'object') return null;
    var qts = (kp.assessment && kp.assessment.questionTypes) || [];
    var anno = kp.difficultyAnnotation || {};
    return {
      id: kp.knowledgeId,
      name: kp.name != null ? kp.name : null,
      moduleId: kp.module != null ? kp.module : null,
      unit: kp.unitName != null ? kp.unitName : null,
      book: kp.book != null ? kp.book : null,
      grade: toN(kp.grade),
      weight: kp.weight != null ? kp.weight : null,
      type: kp.type != null ? kp.type : null,
      pluginId: (kp.generation && kp.generation.pluginId) || null,
      category: (kp.semantic && kp.semantic.category) || null,
      applicable_question_types: qts.map(function (q) {
        return {
          type: q.type != null ? q.type : null,
          coefficient: q.coefficient != null ? q.coefficient : 1
        };
      }),
      difficulty: anno.seedDifficulty != null ? anno.seedDifficulty : null,
      cognitive_level: anno.cognitiveLevel != null ? anno.cognitiveLevel : null,
      status: kp.status != null ? kp.status : null
    };
  }

  /** UI 视图列表（年级） */
  function uiListForGrade(subject, grade) {
    return kpsForGrade(subject, grade).map(uiKp).filter(Boolean);
  }

  // ---------- 读取（全部经 App.KNOWLEDGE） ----------
  function get(knowledgeId) {
    var K = getRuntime();
    if (!K || typeof K.get !== 'function') return null;
    return K.get(knowledgeId) || null;
  }

  var _viewCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

  var COGNITIVE_LEVELS = { recognize: 0, understand: 0.33, apply: 1.0, analyze: 1.0 };

  /** canonical cognitiveLevel → 0..1；未知/缺失统一 0（不猜测） */
  function mapCognitiveLevel(raw) {
    if (raw == null) return 0;
    return COGNITIVE_LEVELS.hasOwnProperty(raw) ? COGNITIVE_LEVELS[raw] : 0;
  }

  function projectQuestionTypes(kp) {
    var list = (kp.assessment && kp.assessment.questionTypes) || [];
    return list.map(function (q) {
      return {
        type: q.type,
        weight: Number(q.coefficient) || 1,
        rawType: q.rawType || q.type,
        cognitiveLevels: null,
        difficultyFactor: null
      };
    });
  }

  function projectNumeric(kp) {
    var range = (kp.generation && kp.generation.numberRange) || null;
    return {
      range: range ? { min: range.min != null ? range.min : null, max: range.max != null ? range.max : null } : { min: null, max: null }
    };
  }

  function projectStructure(kp) {
    var ms = (kp.generation && kp.generation.maxSteps != null) ? Number(kp.generation.maxSteps) : 1;
    if (!isFinite(ms) || ms < 1) ms = 1;
    return { maxSteps: ms, allowBracket: false, allowMultDiv: false };
  }

  function projectContext(kp) {
    var defaults = (kp.assessment && kp.assessment.contextDefault) || [];
    var hasPure = defaults.indexOf('pure') !== -1;
    return { defaults: defaults.slice(), allowPure: true, allowContextual: !hasPure };
  }

  /**
   * Frozen Strategy 兼容视图：KBL canonical → 冻结 Strategy 期望的 Practice Context 形状。
   * 全部字段由 canonical 派生（无旧数据层、无 KBL 写回）；canonical 未承载的字段
   * （spiral / allowBracket / allowMultDiv）为**边界显式默认**（P0 已登记，见 pol-kbl-pending）。
   * 顶层 pluginId / graphicType / operations 为 frozen consumer 别名（generator-selector 读顶层）。
   * 仅供 bundle 内冻结 Strategy / Capability 经 compat 桥读取；不扩散到 Generator / SVG。
   */
  function strategyView(knowledgeId) {
    var kp = get(knowledgeId);
    if (!kp) return null;
    return buildView(kp);
  }

  /** 传入 raw kp 直接构建 strategyView（同 buildView，供合成样本/契约测试使用） */
  function strategyViewFor(kp) {
    if (!kp || !kp.knowledgeId) return null;
    return buildView(kp);
  }

  function buildView(kp) {
    if (_viewCache) {
      var hit = _viewCache.get(kp);
      if (hit) return hit;
    }
    var gen = kp.generation || {};
    var sem = kp.semantic || {};
    var content = kp.content || {};
    var anno = kp.difficultyAnnotation || {};
    var cogRaw = anno.cognitiveLevel != null ? anno.cognitiveLevel : null;
    var capabilities = (gen.capabilities || []).slice();
    var operations = (sem.operations || []).slice();
    var view = {
      id: kp.knowledgeId,
      subject: kp.subject,
      grade: toN(kp.grade),
      category: sem.category || null,
      book: kp.book || null,
      unit: kp.unitName || null,
      module: { id: kp.module || '', name: kp.module || '' },
      identity: { id: kp.knowledgeId, name: kp.name || '', description: content.description || '' },
      source: { pluginId: gen.pluginId || null, legacyType: kp.type || null },
      // frozen consumer 顶层别名（generator-selector 读顶层 pluginId / graphicType / operations）
      pluginId: gen.pluginId || null,
      graphicType: content.graphicType != null ? content.graphicType : null,
      operations: operations,
      knowledge: {
        concept: sem.concept || null,
        operations: operations.slice(),
        factualContent: content.factualContent || null
      },
      structure: projectStructure(kp),
      cognition: { level: mapCognitiveLevel(cogRaw), raw: cogRaw },
      presentation: {
        questionTypes: projectQuestionTypes(kp),
        graphicType: content.graphicType != null ? content.graphicType : null
      },
      numeric: projectNumeric(kp),
      context: projectContext(kp),
      errors: (kp.assessment && kp.assessment.errors) ? kp.assessment.errors.slice() : [],
      generation: { capabilities: capabilities },
      capabilities: capabilities.map(function (c) { return c.id; }).filter(Boolean),
      spiral: { level: 1, maxLevel: 1 },
      metadata: { weight: Number(kp.weight) || 1 },
      legacy: {
        difficulty: anno.seedDifficulty != null ? anno.seedDifficulty : null,
        example: content.example || null,
        status: kp.status || null,
        category: sem.category || null,
        cognitive_level: cogRaw,
        context_default: (kp.assessment && kp.assessment.contextDefault && kp.assessment.contextDefault[0]) || null
      }
    };
    if (_viewCache) _viewCache.set(kp, view);
    return view;
  }

  /** 年级 KP 全集（subject 过滤 + 年级 gN 转换）；返回 canonical 列表 */
  function kpsForGrade(subject, grade) {
    var K = getRuntime();
    if (!K || typeof K.byGrade !== 'function') return [];
    if (grade == null) return [];
    var list = K.byGrade(toG(grade)) || [];
    if (subject && typeof subject === 'string') {
      return list.filter(function (k) { return (k.subject || 'math') === subject; });
    }
    return list.slice();
  }

  function kpsForUnit(unitId) {
    var K = getRuntime();
    if (!K || typeof K.byUnit !== 'function') return [];
    return (K.byUnit(unitId) || []).slice();
  }

  /**
   * 池展开：subject + grade（+ 可选 unit）→ knowledgeId 候选池。
   * POL 唯一池入口；Frozen Strategy poolEntries（KB.getEntries）被本路径取代。
   * unit 兼容两种语义：模块目录 ID（M0-M13/C1-C9，legacy）与 canonical unitId。
   */
  function poolKpIds(opts) {
    opts = opts || {};
    var subject = (opts.subject === 'chinese' || opts.subject === 'english') ? 'math' : (opts.subject || 'math');
    var grade = opts.grade != null ? opts.grade : null;
    if (grade == null) return [];
    var kps = kpsForGrade(subject, grade);
    if (opts.unit != null) {
      var u = String(opts.unit);
      kps = kps.filter(function (k) { return String(k.module) === u || String(k.unitId) === u; });
    }
    return kps.map(function (k) { return k.knowledgeId; });
  }

  /** 可选性查询：{grade, unitId}（Policy 可练门禁） */
  function selectable(opts) {
    var K = getRuntime();
    if (!K || typeof K.selectable !== 'function') return [];
    var o = {};
    if (opts && opts.grade != null) o.grade = toG(opts.grade);
    if (opts && opts.unitId != null) o.unitId = opts.unitId;
    return (K.selectable(o) || []).slice();
  }

  function unit(unitId) {
    var K = getRuntime();
    if (!K || typeof K.unit !== 'function') return null;
    return K.unit(unitId) || null;
  }

  function stats() {
    var K = getRuntime();
    if (!K || typeof K.stats !== 'function') return null;
    return K.stats() || null;
  }

  /** Practice Context 视图：poolKpIds → adaptKp 列表（POL 候选池的完整 KP 上下文） */
  function poolContext(opts) {
    opts = opts || {};
    var subject = (opts.subject === 'chinese' || opts.subject === 'english') ? 'math' : (opts.subject || 'math');
    var grade = opts.grade != null ? opts.grade : null;
    if (grade == null) return [];
    var kps = kpsForGrade(subject, grade);
    if (opts.unit != null) {
      var u = String(opts.unit);
      kps = kps.filter(function (k) { return String(k.module) === u || String(k.unitId) === u; });
    }
    return kps.map(adaptKp).filter(Boolean);
  }

  var API = {
    toN: toN,
    toG: toG,
    adaptKp: adaptKp,
    uiKp: uiKp,
    uiListForGrade: uiListForGrade,
    get: get,
    strategyView: strategyView,
    strategyViewFor: strategyViewFor,
    kpsForGrade: kpsForGrade,
    kpsForUnit: kpsForUnit,
    poolKpIds: poolKpIds,
    poolContext: poolContext,
    selectable: selectable,
    unit: unit,
    stats: stats
  };

  global.KnowledgeContext = API;
  if (global.App && typeof global.App === 'object') global.App.KnowledgeContext = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

})(typeof window !== 'undefined' ? window : global);