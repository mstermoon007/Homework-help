/**
 * shared/generator/generator-selector.js — Generator 选择器
 *
 * 输入：QuestionPlan
 * 输出：最佳 Generator（记录 + source + match）
 *
 * 选择优先级（打分仅三维，稳定排序）：
 *   ① KP native binding    — knowledgePoints 包含主 KP（本体绑定即语义契约，直接胜出）
 *   ② content/capability   — generator.capabilities 包含 plan.questionTypeId
 *   ③ questionType         — generator.questionTypes 包含 plan.questionTypeId
 *   tiebreak：version 更高者优先；同分 core 优先
 *
 * P25-06 语义参数消费链路：
 *   instantiate 包装的 generate 在调用具体生成器前，用 SemanticParameters.attachToPlan
 *   派生 plan.semanticParams（semanticFamily / subTopic / operations / intent…）。
 *   Generator 只消费语义参数分派 maker，禁止按 KP ID 子串/尾缀猜测子类型，
 *   也禁止自决 questionType/count/difficulty。
 *
 * 无候选（任意模式）：返回 GENERATOR_UNSUPPORTED（legacy 轨道已删除）。
 */
'use strict';

var GenRegistry = require('./generator-registry.js');
var Mode = require('./generator-mode.js');
var QuestionPlan = require('../strategy/question-plan.js');
var QuestionTypeRegistry = require('../knowledge/question-type-registry.js');
var SemanticParameters = require('./core/semantic-parameters.js');
var TypeContract = require('./core/type-contract.js');

function trackOf(record) {
  return record.scope === 'core' ? 'native' : 'legacy';
}

function selectGenerator(plan, options) {
  plan = plan || {};
  options = options || {};
  var primaryKp = QuestionPlan.planPrimaryKpId(plan);
  if (!primaryKp) {
    throw new Error('GeneratorSelector: plan 缺少 knowledgePointIds');
  }

  var mode = options.mode != null ? options.mode : Mode.resolve(plan);
  // 7 类规范题型：归一 request 的 questionTypeId（oral→calc / recognize→geometry / open→apply），
  // 保证下游 capability/qt 匹配始终基于规范 7 类，且兼容历史 KB 的原始题型 token。
  if (plan && plan.questionTypeId && QuestionTypeRegistry && QuestionTypeRegistry.normalizeQuestionType) {
    var _n = QuestionTypeRegistry.normalizeQuestionType(plan.questionTypeId, { allowHeuristic: false });
    if (_n && _n.id) {
      plan = Object.assign({}, plan, { questionTypeId: _n.id });
    } else {
      // P25-09 fail-closed：题型存在但无法归一到规范 7 类时，不得靠 kp=1 绑定直通
      // （375 KP 全量 native 覆盖后，任意未知 token 都能在 kp 维度得分，会把无效题型
      // 路由给本体生成器）。显式 unsupported 由上游修正请求，禁止 fallback。
      return { generatorId: null, source: 'unsupported', errorCode: 'GENERATOR_UNSUPPORTED',
        record: null, mode: mode };
    }
  }
  var all = GenRegistry.all();
  var candidates = [];

  // C3：combine 合并计划路由收口。
  // combine=true 且 ≥2 KP 时，只有 supportsComposite 生成器能在单题/单卷中同时
  // 承载多 KP 语义；普通单 KP 生成器（如 arithmetic-addition）的产出只体现单一 KP，
  // 必然触发 KP_SEMANTIC_COMPOSITE 失败（实测合并计划连选 20 次稳定误选）。
  // 故在候选筛选最前端收口：合并计划仅 supportsComposite 生成器入候选；
  // 非合并计划（含 multi-kp 拆分后的单 KP 计划）composite 不得入候选（原 P0-07 规则）。
  var combineKpCount = QuestionPlan.planKnowledgePointIds(plan).length;
  var isCombineRequest = plan.combine === true && combineKpCount >= 2;

  all.forEach(function (g) {
    var track = trackOf(g);
    if (mode === 'native' && track !== 'native') return;

    if (g.supportsComposite === true && !isCombineRequest) return;
    if (isCombineRequest && g.supportsComposite !== true) return;

    // P25-07 form-bound 声明门：calc/geometry/classify 题型形态与内容绑定，
    // 候选必须声明该题型（native kp 绑定不豁免）——否则「未声明路由」（kp=1 直通）
    // 必然产出无算式 calc / 无图形 geometry / 无分组 classify 的契约违例题。
    if (TypeContract.FORM_BOUND.indexOf(plan.questionTypeId) !== -1 &&
      g.questionTypes.indexOf(plan.questionTypeId) === -1) return;

    var score = { record: g, kp: 0, capability: 0, qt: 0 };

// KP native binding (本体绑定即语义契约，优先于任何泛型匹配)
if (g.knowledgePoints.indexOf(primaryKp) !== -1) score.kp = 1;

// capability：generator 能否处理该 questionType
if (plan.questionTypeId && g.capabilities.indexOf(plan.questionTypeId) !== -1) score.capability = 1;

// questionType
if (plan.questionTypeId && g.questionTypes.indexOf(plan.questionTypeId) !== -1) score.qt = 1;

// Candidate qualification: at least one matching dimension
if (score.kp + score.capability + score.qt > 0) candidates.push(score);
});

// Step 12 priority: kp > capability > questionType > version（稳定排序，无 semanticOp/difficulty 二次评分）
candidates.sort(function (a, b) {
  if (a.kp !== b.kp) return b.kp - a.kp;
  if (a.capability !== b.capability) return b.capability - a.capability;
  if (a.qt !== b.qt) return b.qt - a.qt;
  var va = a.record.version || 1, vb = b.record.version || 1;
  if (va !== vb) return vb - va;
  // tiebreak：core 优先于 legacy
  if (a.record.scope === 'core' && b.record.scope !== 'core') return -1;
  if (b.record.scope === 'core' && a.record.scope !== 'core') return 1;
  return 0;
});

if (candidates.length === 0) {
  // MATH-14：legacy 轨道已删除，任何模式无候选均返回 GENERATOR_UNSUPPORTED（无 fallback 宿主）。
  return { generatorId: null, source: 'unsupported', errorCode: 'GENERATOR_UNSUPPORTED', record: null, mode: mode };
}

var best = candidates[0];
return {
  generatorId: best.record.id,
  source: 'priority',
  record: best.record,
  match: { kp: best.kp, capability: best.capability, questionType: best.qt },
  mode: mode
};
}

/**
 * 实例化选择结果：legacy 记录 → LegacyAdapter 包装；core 记录 → 核心 Generator 实例。
 * 仅在需要真正生成时调用（选择本身只用注册表数据）。
 *
 * R23：实例化后立即包装 generate —— 为每个 SemanticQuestion 附加可追溯元数据：
 *   metadata.generator / metadata.generatorVersion / metadata.seed
 * 保证历史题目可以追溯到来源 Generator 与版本。
 */
function instantiate(selection, plugin) {
  if (!selection || !selection.record) return null;
  // MATH-14：legacy 轨道已删，仅 core Generator 可实例化。
  var Generators = require('./generators/index.js');
  var gen = Generators.get(selection.record.id);
  if (!gen) return null;

  var generatorId = selection.record.id;
  var generatorVersion = toSemver(selection.record.version);

  return wrapGenerator(gen, generatorId, generatorVersion);
}

/** 数字版本 → "x.y.z" 语义化版本；已是字符串则原样保留 */
function toSemver(v) {
  if (typeof v === 'string' && /^\d+\.\d+\.\d+/.test(v)) return v;
  var n = parseInt(v, 10);
  if (!isNaN(n)) return n + '.0.0';
  return String(v == null ? '1.0.0' : v);
}

/**
 * 包装 generate：
 *   ① P25-06：调用具体生成器前派生 GenerationParameters 挂到 plan.semanticParams
 *      （浅拷贝不改写调用方 plan；retry-loop 的 Object.assign 重试会保留该字段）。
 *   ② R23：为每个产出 sq 附加 metadata.generator/.generatorVersion/.seed。
 */
function wrapGenerator(gen, generatorId, generatorVersion) {
  if (!gen || typeof gen.generate !== 'function') return gen;
  var orig = gen.generate.bind(gen);
  gen.generate = function (plan, context) {
    // P28-07：旧题型 token（oral/recognize/open）只在生成器边界经 normalizeQuestionType 归一一次，
    // 之后 generate 一律消费 canonical 7 类；旧 token 不得再作为能力声明或生成器分支进入。
    if (plan && plan.questionTypeId && QuestionTypeRegistry && typeof QuestionTypeRegistry.normalizeQuestionType === 'function') {
      var _n = QuestionTypeRegistry.normalizeQuestionType(plan.questionTypeId, { allowHeuristic: false });
      if (_n && _n.id && _n.id !== plan.questionTypeId) {
        plan = Object.assign({}, plan, { questionTypeId: _n.id });
      }
    }
    var paramPlan = SemanticParameters.attachToPlan(plan);
    var out = orig(paramPlan, context);
    // P25-07：产出单点收口 —— 按题型教育契约 finish（convertible 机械转换）
    // / drop（form-bound 与不可转换者，fail-closed），再附加追溯元数据。
    var finish = function (sqs) {
      return attachMeta(TypeContract.enforce(sqs, paramPlan), generatorId, generatorVersion);
    };
    if (out && typeof out.then === 'function') {
      return out.then(finish);
    }
    return finish(out);
  };
  return gen;
}

function attachMeta(sqs, generatorId, generatorVersion) {
  if (!sqs) return sqs;
  var arr = Array.isArray(sqs) ? sqs : (sqs.questions && Array.isArray(sqs.questions) ? sqs.questions : null);
  if (!arr) return sqs;
  arr.forEach(function (sq) {
    if (!sq) return;
    sq.metadata = sq.metadata || {};
    sq.metadata.generator = generatorId;
    sq.metadata.generatorVersion = generatorVersion;
    if (sq.seed != null) sq.metadata.seed = sq.seed;
  });
  return sqs;
}

module.exports = {
  selectGenerator: selectGenerator,
  instantiate: instantiate,
  Mode: Mode
};