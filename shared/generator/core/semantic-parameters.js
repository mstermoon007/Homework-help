/**
 * shared/generator/core/semantic-parameters.js — GenerationParameters 运行时 Read Model（P25-06）
 *
 * 语义参数消费链路的唯一取数口：
 *   KBL（知识点事实）+ kbl/teaching 语义族/题型意图（仅 Node 侧）
 *     → resolve(kpId, questionType) → GenerationParameters
 *     → Selector 选定后把参数挂到 plan.semanticParams
 *     → Generator 只按 params.subTopic 等参数分派，禁止 KP ID 猜测/尾缀切片
 *
 * 红线映射：
 *   - Generator 不得自决 questionType/count/difficulty，也不得从 KP ID 猜教学子类型；
 *     子类型（subTopic）由本模块按「语义族 + KBL name/concept 关键词」机械规则派生，
 *     每条命中都带 evidence（rule/field/matched），无命中返回 null（不再静默 fallback）。
 *   - kbl/teaching/*.json 禁止 bundle 内联：用拆分字符串的计算路径 require，
 *     bundle 环境取不到时降级为 KBL 粗族投影（subTopic 规则仅依赖 KBL 事实，双环境等价；
 *     dev 审计脚本对全部 native 绑定 KP 断言两环境结果一致）。
 *   - 纯派生：本模块不保存任何教学数据，不写回 KBL。
 *   - kbl-access 门禁：本模块不直接 require 知识层文件，KP 事实只从运行时单入口
 *     global.KnowledgeContext（= App.KNOWLEDGE 的 orchestration API）读取。
 *
 * 依赖注入：createSemanticParameterResolver({ getKp }) 可注入取 KP 函数；
 * 默认实例经全局 KnowledgeContext 取数（Node 测试经 dev/_bundle-env.js 注入）。
 */
(function (global) {
  'use strict';

  var SCHEMA_VERSION = 1;

  /* ------------------------------------------------------------------ *
   * KBL 事实读取（双环境）
   * ------------------------------------------------------------------ */

  function getGlobalKC() {
    if (global.KnowledgeContext) return global.KnowledgeContext;
    if (global.App && global.App.KnowledgeContext) return global.App.KnowledgeContext;
    return null;
  }

  function defaultGetKp(kpId) {
    // 唯一取数口：运行时单入口 KnowledgeContext（orchestration API，背后即 App.KNOWLEDGE）。
    // 浏览器 bundle 与 Node（dev/_bundle-env.js）注入同一 API；不存在时 fail-closed 返回 null，
    // 绝不直接 require 知识层文件（kbl-access / kbl-uniqueness 门禁）。
    var KC = getGlobalKC();
    if (KC && typeof KC.get === 'function') return KC.get(kpId) || null;
    return null;
  }

  /**
   * 把两种 KP 形态归一为事实包：
   *   原始 KBL 条目：name / semantic.{family,concept,operations,representations}
   *   strategyView：identity.name / knowledge.{concept,operations} /
   *                 presentation.representations / semantic 粗族（可能无）
   */
  function readFacts(kp) {
    if (!kp) return null;
    var identity = kp.identity || {};
    var knowledge = kp.knowledge || {};
    var semantic = kp.semantic || {};
    var presentation = kp.presentation || {};
    var name = typeof kp.name === 'string' ? kp.name
      : (typeof identity.name === 'string' ? identity.name : '');
    var concept = typeof semantic.concept === 'string' ? semantic.concept
      : (typeof knowledge.concept === 'string' ? knowledge.concept
        : (typeof identity.description === 'string' ? identity.description : ''));
    var operations = Array.isArray(semantic.operations) ? semantic.operations
      : (Array.isArray(knowledge.operations) ? knowledge.operations : []);
    var representations = Array.isArray(semantic.representations) ? semantic.representations
      : (Array.isArray(presentation.representations) ? presentation.representations : []);
    var coarseFamily = typeof semantic.family === 'string' ? semantic.family : null;
    return { name: name, concept: concept, operations: operations,
      representations: representations, coarseFamily: coarseFamily };
  }

  /* ------------------------------------------------------------------ *
   * kbl/teaching 读取（计算路径，禁止 bundle 内联；缺失即降级）
   * ------------------------------------------------------------------ */

  function loadTeaching(baseName) {
    try {
      // 路径与标识符都拆开，避免 bundle 静态分析把 teaching JSON 内联进产物
      return require('../../../' + 'kbl' + '/' + 'teaching' + '/' + baseName + '.json');
    } catch (e) {
      return null;
    }
  }

  var _familyTable = null;
  var _familyLoaded = false;
  function getFamilyEntry(kpId) {
    if (!_familyLoaded) {
      var doc = loadTeaching('semantic-families');
      _familyTable = (doc && doc.kpFamilies) ? doc.kpFamilies : {};
      _familyLoaded = true;
    }
    return _familyTable[kpId] || null;
  }

  var _intentIndex = null;
  function getIntent(kpId, questionType) {
    if (_intentIndex === null) {
      var doc = loadTeaching('qt-intent');
      var index = {};
      var rows = (doc && Array.isArray(doc.rows)) ? doc.rows : [];
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row && row.knowledgeId && row.questionType) {
          index[row.knowledgeId + '|' + row.questionType] = row;
        }
      }
      _intentIndex = index;
    }
    return _intentIndex[kpId + '|' + questionType] || null;
  }

  /* ------------------------------------------------------------------ *
   * subTopic 机械派生规则
   *
   * 规则按顺序匹配；families 声明规则所属语义族（Node 侧用 teaching 细族
   * 先收窄候选；bundle 侧无 teaching 表时按顺序全扫——消费方只有 native
   * 绑定 KP，dev 审计断言两侧对全部绑定 KP 结果一致）。
   * 每条规则只匹配 KBL name/concept 文本，命中后返回 matched 证据。
   * ------------------------------------------------------------------ */

  function reTest(re, text) {
    if (!text) return null;
    var m = re.exec(text);
    return m ? m[0] : null;
  }

  function nameConceptRule(subTopic, families, nameRe, conceptRe) {
    return {
      subTopic: subTopic,
      families: families,
      match: function (facts) {
        var hit = nameRe ? reTest(nameRe, facts.name) : null;
        if (hit) return { field: 'name', matched: hit };
        if (conceptRe) {
          hit = reTest(conceptRe, facts.concept);
          if (hit) return { field: 'concept', matched: hit };
        }
        return null;
      }
    };
  }

  // 顺序敏感：具体规则在前，族内兜底规则在后
  var SUBTOPIC_RULES = [
    // —— 概念理解族（concept-meaning 生成器消费）——
    nameConceptRule('times-concept', ['multiple-ratio'], /倍/),
    nameConceptRule('angle-concept', ['geometric-figure'], /角(的认识|各部分)/, /两条射线/),
    nameConceptRule('area-concept', ['geometric-measurement'], /面积/),
    // 注意排除「百分数的意义」：前面不能是「百」（bundle 降级全扫时 percent 与 fraction
    // 规则同族候选，Node 侧靠语义族收窄天然避开，此边界保证两环境派生一致）
    nameConceptRule('fraction-meaning', ['fraction'], /(^|[^百])分数的意义/),
    // —— 数量关系/比例关系族（semantic-relations 生成器消费）——
    nameConceptRule('pictorial-additive-relation', ['word-application'],
      /图形表述数量关系/, /画图[\s\S]*加减关系|加减关系[\s\S]*画图/),
    nameConceptRule('periodic-pattern', ['multiplicative-relation'],
      /周期/, /有余数除法[\s\S]*(规律|排列)|(规律|排列)[\s\S]*有余数除法/),
    nameConceptRule('scale-transform', ['ratio-proportion'],
      /放大|缩小/, /按[一]?定的比/),
    nameConceptRule('proportion-application', ['word-application', 'ratio-proportion'],
      null, /正比例|反比例/),
    // —— 百分数族（percent-calc 生成器消费）——
    nameConceptRule('percent-conversion', ['percent'], /互化/, /化百分数|百分数化/),
    nameConceptRule('percent-discount', ['percent'], /折扣|打折/, /折扣|打几?折/),
    nameConceptRule('percent-interest', ['percent'], /利率|利息|本金/, /利息\s*=|本金/),
    nameConceptRule('percent-target-rate', ['percent'], /达标/),
    nameConceptRule('percent-change', ['percent'], /增产|减产|增减/, /多（?少）?百分之几|百分之几的数是多少/),
    nameConceptRule('percent-of', ['percent'], /百分数的意义/, /百分之几/)
  ];

  function deriveSubTopic(facts, primaryFamily) {
    var rules = SUBTOPIC_RULES;
    if (primaryFamily) {
      var narrowed = [];
      for (var i = 0; i < SUBTOPIC_RULES.length; i++) {
        if (SUBTOPIC_RULES[i].families.indexOf(primaryFamily) !== -1) {
          narrowed.push(SUBTOPIC_RULES[i]);
        }
      }
      // 细族收窄后无候选则回退全扫（保证 bundle 降级路径与 Node 路径可比对）
      if (narrowed.length > 0) rules = narrowed;
    }
    for (var j = 0; j < rules.length; j++) {
      var hit = rules[j].match(facts);
      if (hit) {
        return { subTopic: rules[j].subTopic,
          evidence: { rule: rules[j].subTopic, family: primaryFamily || null,
            field: hit.field, matched: hit.matched } };
      }
    }
    return { subTopic: null, evidence: null };
  }

  /* ------------------------------------------------------------------ *
   * Resolver
   * ------------------------------------------------------------------ */

  function createSemanticParameterResolver(options) {
    var getKp = (options && typeof options.getKp === 'function') ? options.getKp : defaultGetKp;

    /**
     * resolve(kpId, questionType) → GenerationParameters
     * KP 不存在时返回 null（调用方负责放弃生成，不得再猜）。
     */
    function resolve(kpId, questionType) {
      if (!kpId) return null;
      var kp = getKp(kpId);
      if (!kp) return null;
      var facts = readFacts(kp);

      var familyEntry = getFamilyEntry(kpId);
      var primaryFamily = familyEntry && familyEntry.primary ? familyEntry.primary : null;
      var families = familyEntry && Array.isArray(familyEntry.families) ? familyEntry.families.slice() : [];
      var familySource = primaryFamily ? 'teaching:semantic-families'
        : (facts.coarseFamily ? 'kbl:semantic.family' : 'none');
      if (!primaryFamily && facts.coarseFamily) primaryFamily = facts.coarseFamily;

      var derived = deriveSubTopic(facts, familyEntry && familyEntry.primary ? familyEntry.primary : null);

      var intentRow = questionType ? getIntent(kpId, questionType) : null;
      var intent = null;
      if (intentRow && intentRow.intent) {
        intent = {
          trainsWhat: intentRow.intent.trainsWhat || null,
          whyThisType: intentRow.intent.whyThisType || null,
          differentiation: intentRow.intent.differentiation || null,
          driftRisk: intentRow.intent.driftRisk || null,
          legitimacy: intentRow.intent.legitimacy || null
        };
      }

      return {
        schemaVersion: SCHEMA_VERSION,
        knowledgePointId: kpId,
        questionType: questionType || null,
        name: facts.name,
        concept: facts.concept || null,
        semanticFamily: primaryFamily,
        families: families,
        subTopic: derived.subTopic,
        subTopicEvidence: derived.evidence,
        operations: facts.operations.slice(),
        representations: facts.representations.slice(),
        intent: intent,
        sources: {
          family: familySource,
          subTopic: 'mechanical-rule:kbl-name-concept',
          intent: intent ? 'teaching:qt-intent' : 'none'
        }
      };
    }

    /**
     * attachToPlan(plan) → 浅拷贝 plan 并挂上 semanticParams（不改写入参）。
     * 与 retry-loop 的 Object.assign({}, plan) 天然兼容：重试保留语义参数。
     */
    function attachToPlan(plan) {
      if (!plan) return plan;
      var next = Object.assign({}, plan);
      var pkp = null;
      if (Array.isArray(plan.knowledgePointIds) && plan.knowledgePointIds.length > 0) {
        pkp = plan.knowledgePointIds[0];
      } else if (plan.knowledgePointId) {
        pkp = plan.knowledgePointId;
      }
      next.semanticParams = resolve(pkp, plan.questionTypeId || plan.questionType);
      return next;
    }

    return { resolve: resolve, attachToPlan: attachToPlan };
  }

  var singleton = createSemanticParameterResolver({});

  var api = {
    SCHEMA_VERSION: SCHEMA_VERSION,
    SUBTOPIC_RULES: SUBTOPIC_RULES,
    createSemanticParameterResolver: createSemanticParameterResolver,
    resolve: singleton.resolve,
    attachToPlan: singleton.attachToPlan,
    // 机械派生原语（供 dev 审计/测试做双环境一致性比对，业务消费方应走 resolve）
    deriveSubTopic: deriveSubTopic,
    readFacts: readFacts
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.SemanticParameters = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
