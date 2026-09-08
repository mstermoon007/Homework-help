/**
 * shared/presentation/render-format.js — SemanticQuestion → 可渲染题格式转换
 *
 * MATH-14：原 shared/generator/legacy-adapter.js 的 toLegacyQuestion(s) 迁移至此并更名。
 * 职责唯一：把 SemanticQuestion 映射为渲染层（PluginUtil.renderGrid/renderCard）
 * 与批改层（PluginUtil.computeResult）消费的题对象格式（q/text/answer/inputType/
 * options/render/check/svg 等展示字段）。与旧插件体系无关，纯数据映射。
 */
'use strict';

function coerceScalar(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
  }
  return String(v);
}

function seededIndex(seedStr) {
  var h = 2166136261;
  var s = String(seedStr);
  for (var i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0);
}

function toRenderableQuestion(sq) {
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

  var options = null;
  if (inputType === 'choice' && Array.isArray(sq.distractors) && sq.distractors.length) {
    options = sq.distractors.map(function (d) { return d.value; });
    var correct = sq.answer && sq.answer.value != null ? coerceScalar(sq.answer.value) : '';
    if (correct && options.indexOf(correct) === -1) {
      var seedStr = (sq.seed != null ? String(sq.seed)
        : (sq.metadata && sq.metadata.seed != null ? String(sq.metadata.seed)
          : (sq.id || 'q')));
      var pos = seededIndex(seedStr) % (options.length + 1);
      options.splice(pos, 0, correct);
    }
  }

  return {
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
    // M10-R10: 扩展 knowledgePointIds 数组（兼容多 KP combine）
    knowledgePointIds: (Array.isArray(sq.knowledgePointIds) && sq.knowledgePointIds.length)
      ? sq.knowledgePointIds.slice()
      : (sq.knowledgePoint ? [sq.knowledgePoint] : []),
    // M10-R10: 扩展 composite 结构（来自 plan.complexity 或 sq.complexity/sq.data.composite）
    composite: sq.composite || (sq.data && sq.data.composite) || null,
    hint: sq.hint,
    numberRange: sq.numberRange,
    render: sq.render || null,
    check: sq.check || null,
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
  };
}

function toRenderableQuestions(semanticQuestions) {
  if (!Array.isArray(semanticQuestions)) return [];
  return semanticQuestions.map(toRenderableQuestion);
}

module.exports = {
  toRenderableQuestion: toRenderableQuestion,
  toRenderableQuestions: toRenderableQuestions
};
