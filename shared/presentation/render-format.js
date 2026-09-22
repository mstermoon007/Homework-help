/**
 * shared/presentation/render-format.js — 唯一 Legacy Adapter（SemanticQuestion → Legacy Question）
 *
 * MATH-14：原 shared/generator/legacy-adapter.js 的 toLegacyQuestion(s) 迁移至此并更名。
 * P28-21：确认为全库唯一 SQ→Legacy 转换点 —— semantic-question-bridge.js 与
 * practice-session._sqToLegacyQuestion() 已删除，所有消费方（PresentationEngine /
 * PracticeSession / dev 门禁）唯一经本模块。
 * 职责：把 SemanticQuestion 映射为渲染/批改层（PresentationRenderer / HTMLRenderer /
 * PluginUtil.computeResult）消费的题对象格式（q/text/answer/inputType/options/
 * render/check/svg/__semantic 等展示字段）。与旧插件体系无关，纯数据映射。
 * P28-22：旧渲染器 shared/presentation/render.js（renderCard/renderGrid）已随双轨收口删除，
 * 唯一渲染链 = PresentationRenderer.renderAll → HTMLRenderer → RenderResult。
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
  // 统一选项源：sq.options / sq.distractors / sq.data.options（生成器三种写法一致收敛）
  var rawOptions = (Array.isArray(sq.options) && sq.options.length) ? sq.options
    : (Array.isArray(sq.distractors) && sq.distractors.length) ? sq.distractors
      : (sq.data && Array.isArray(sq.data.options) && sq.data.options.length) ? sq.data.options : null;
  if (inputType === 'choice' && rawOptions) {
    options = rawOptions.map(function (d) {
      return (d && typeof d === 'object') ? (d.label != null ? d.label : d.value) : d;
    });
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
    // answer 归一：value 优先；缺 value 时回退 acceptable[0]（与旧 _sqToLegacyQuestion 语义一致）
    answer: (sq.answer && sq.answer.value != null) ? sq.answer.value
      : (sq.answer && Array.isArray(sq.answer.acceptable) && sq.answer.acceptable.length) ? sq.answer.acceptable[0]
        : (sq.answer ? sq.answer.value : null),
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
    svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null,
    // P28-32：Learner 数据链透传字段（semanticTarget / spiralLevel / errorType）。
    // 供练习会话/页面 feedLearnerModel 逐题构建 PracticeResult；R10 约束保持——
    // errorType 只透传题面自带可靠值，缺失即 null（不伪造诊断）。
    semanticTarget: sq.semanticTarget != null ? sq.semanticTarget : null,
    spiralLevel: sq.spiralLevel != null ? sq.spiralLevel : (sq.constraints && sq.constraints.spiralLevel != null ? sq.constraints.spiralLevel : null),
    errorType: sq.errorType != null ? sq.errorType : null,
    // 保留语义引用（页面 read-aloud 判定 / 溯源复用）；实践会话 exerciseSet 依赖此字段。
    __semantic: sq
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
