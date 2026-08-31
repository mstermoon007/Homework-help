/**
 * shared/question/legacy-question-adapter.js — M5-R03 Legacy Question → SemanticQuestion 适配器
 *
 * 职责：将旧插件输出的标准 Question（含 render/check/svg）转换为标准 SemanticQuestion。
 * 处理字段映射：
 *   - q/text → content.prompt / question.prompt
 *   - answer → answer.value / answer.acceptable
 *   - options → distractors (choice 题)
 *   - inputType → answerMode / expectedFormat
 *   - svg → graphic (描述性 params，不保留原始 SVG 字符串)
 *   - type/questionType → questionType / skill
 *   - difficulty/difficultyParams → difficulty / difficultyParams
 *   - knowledgePointId → knowledgePoint
 *   - render/check/svg → 保留兼容字段（不参与语义校验）
 *
 * 设计原则：
 *   - 尽量保留原有信息（答案、选项、提示、渲染/判定函数）
 *   - 语义层不产出 HTML/SVG 字符串
 *   - 兼容字段（render/check/svg）保留供 LegacyRenderer 使用
 */
'use strict';

var SQ = require('../semantic-question.js');
var Schema = require('../schemas/semantic-question.schema.js');
var QTR = require('../question-type-registry.js');
var QID = require('../question-id.js');

function coerceString(v) { return v == null ? '' : String(v); }
function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

/** 可复现的确定性索引（FNV-1a 哈希 → 无 Math.random；配合 context.seed 跨运行稳定） */
function seededIndex(seedStr) {
  var h = 2166136261;
  var s = String(seedStr);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

/**
 * 将单个 Legacy Question 转换为 SemanticQuestion
 * @param {Object} legacyQ 旧插件产出的标准 Question
 * @param {Object} [context] { generatorId, generatorVersion, seed, planId, index, knowledgePointId, difficulty }
 * @returns {Object} SemanticQuestion
 */
function adaptQuestion(legacyQ, context) {
  context = context || {};
  legacyQ = legacyQ || {};

  // --- 基础字段提取 ---
  var prompt = coerceString(legacyQ.q || legacyQ.text || legacyQ.stem || legacyQ.question || '');
  var answerVal = legacyQ.answer;
  var answerObj = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : { value: answerVal };
  var answerValue = answerObj.value != null ? answerVal : answerVal; // 兼容旧格式

  // answerMode 映射
  var answerModeMap = {
    'text': 'input',
    'input': 'input',
    'choice': 'choice',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = legacyQ.inputType || legacyQ.type || 'text';
  var answerMode = answerModeMap[inputType] || 'input';

  // distractors 从 options 构建（仅 choice 题）
  var distractors = [];
  if (inputType === 'choice' && Array.isArray(legacyQ.options)) {
    var correct = coerceString(answerValue);
    legacyQ.options.forEach(function (opt) {
      var val = coerceString(opt);
      if (val && val !== correct) {
        distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
      }
    });
  }

  // graphic 从 svg / graphic / drawing 转换（描述性 params，不保留原始 SVG 字符串）
  var graphic = null;
  if (legacyQ.svg || legacyQ.graphic || legacyQ.drawing) {
    graphic = {
      type: 'custom',
      subtype: null,
      params: { legacySvg: legacyQ.svg || legacyQ.graphic || legacyQ.drawing },
      renderHints: {}
    };
  }

  // knowledgePoint 从 context 或 legacyQ 取
  var knowledgePoint = context.knowledgePointId || legacyQ.knowledgePointId || legacyQ.kpId || '';

  // type/skill 映射（legacy 领域题型 → 标准 questionType）
  var questionType = legacyQ.questionType || legacyQ.type || legacyQ.kind || 'calc';
  var norm = QTR.normalizeQuestionType(questionType, { allowHeuristic: true });
  if (norm && norm.id) questionType = norm.id;
  var skill = legacyQ.skill || legacyQ.ability || '';

  // difficulty
  var difficulty = context.difficulty != null ? context.difficulty : coerceInteger(legacyQ.difficulty);

  // metadata 组装（可追溯三要素）
  var metadata = {
    generator: context.generatorId || legacyQ.generator || legacyQ.pluginId || 'legacy:unknown',
    generatorVersion: context.generatorVersion || legacyQ.generatorVersion || '1.0.0',
    seed: context.seed || legacyQ.seed || legacyQ.randomSeed,
    planId: context.planId || null,
    timestamp: new Date().toISOString(),
    retryCount: 0,
    validationScore: null,
    tags: ['legacy-adapted']
  };

  // 构造 SemanticQuestion
  var sq = SQ.createSemanticQuestion({
    id: legacyQ.id || legacyQ.questionId,
    knowledgePoint: knowledgePoint,
    skill: skill,
    difficulty: difficulty,
    difficultyParams: legacyQ.difficultyParams || null,
    question: { prompt: prompt },
    content: { prompt: prompt },
    answer: { value: answerValue, acceptable: ensureArray(answerObj.acceptable) },
    distractors: distractors,
    graphic: graphic,
    metadata: metadata,
    // 保留兼容字段（供 LegacyRenderer）
    render: legacyQ.render || null,
    check: legacyQ.check || null,
    svg: legacyQ.svg || null,
    // 扁平字段
    questionType: questionType,
    answerMode: answerMode,
    type: legacyQ.type || null,
    hint: legacyQ.hint || null,
    numberRange: legacyQ.numberRange || null,
    difficultyParams: legacyQ.difficultyParams || null
  });

  return sq;
}

/**
 * 批量转换 Legacy Questions → SemanticQuestions
 * @param {Array<Object>} legacyQuestions
 * @param {Object} [context] 共享上下文
 * @returns {Array<Object>}
 */
function adaptQuestions(legacyQuestions, context) {
  if (!Array.isArray(legacyQuestions)) return [];
  return legacyQuestions.map(function (q, i) {
    var ctx = Object.assign({}, context, { index: i });
    return adaptQuestion(q, ctx);
  });
}

/**
 * 反向适配：SemanticQuestion → Legacy Question（用于 LegacyRenderer 兼容）
 * @param {Object} sq SemanticQuestion
 * @returns {Object} Legacy Question 格式
 */
function toLegacyQuestion(sq) {
  if (!sq) return null;

  var answerMode = sq.answerMode || (sq.question && sq.question.answerMode) || 'input';
  var inputTypeMap = {
    'input': 'text',
    'choice': 'choice',
    'multi': 'multi',
    'none': 'none',
    'read-aloud': 'read-aloud'
  };
  var inputType = inputTypeMap[answerMode] || 'text';

  // 还原 options（choice 题从 distractors 恢复）
  var options = null;
  if (inputType === 'choice' && Array.isArray(sq.distractors) && sq.distractors.length) {
    options = sq.distractors.map(function (d) { return d.value; });
    // 插入正确答案到随机位置（可复现：由 seed 决定，全仓禁 Math.random）
    var correct = sq.answer && sq.answer.value != null ? coerceString(sq.answer.value) : '';
    if (correct && options.indexOf(correct) === -1) {
      var seedStr = (sq.seed != null ? String(sq.seed)
        : (sq.metadata && sq.metadata.seed != null ? String(sq.metadata.seed)
          : (sq.id || 'q')));
      var pos = seededIndex(seedStr) % (options.length + 1);
      options.splice(pos, 0, correct);
    }
  }

  var legacyQ = {
    id: sq.id,
    q: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    text: sq.prompt || (sq.content && sq.content.prompt) || (sq.question && sq.question.prompt) || '',
    answer: sq.answer && sq.answer.value != null ? sq.answer.value : (sq.answer ? sq.answer.value : null),
    inputType: inputType,
    options: options,
    type: sq.questionType || sq.type || sq.skill || 'calc',
    questionType: sq.questionType || sq.type || sq.skill || 'calc',
    skill: sq.skill || '',
    difficulty: sq.difficulty,
    difficultyParams: sq.difficultyParams,
    knowledgePointId: sq.knowledgePoint,
    hint: sq.hint,
    numberRange: sq.numberRange,
    // 兼容函数
    render: sq.render || null,
    check: sq.check || null,
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
  };

  return legacyQ;
}

/**
 * 批量反向适配
 * @param {Array<Object>} semanticQuestions
 * @returns {Array<Object>}
 */
function toLegacyQuestions(semanticQuestions) {
  if (!Array.isArray(semanticQuestions)) return [];
  return semanticQuestions.map(toLegacyQuestion);
}

module.exports = {
  adaptQuestion: adaptQuestion,
  adaptQuestions: adaptQuestions,
  toLegacyQuestion: toLegacyQuestion,
  toLegacyQuestions: toLegacyQuestions
};