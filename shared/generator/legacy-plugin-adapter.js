/**
 * shared/generator/legacy-plugin-adapter.js — M4-R02 Legacy Plugin Adapter
 *
 * 将现有（legacy）插件包装为 GeneratorContract，不改动插件内部逻辑：
 *
 *   QuestionPlan
 *     ↓
 *   Adapter（createLegacyGenerator）
 *     ↓
 *   legacy options（M3 LegacyAdapter 映射）
 *     ↓
 *   plugin.generate()
 *     ↓
 *   SemanticQuestion[]（统一语义输出，无渲染函数）
 *
 * 统一映射（每个 SemanticQuestion 携带）：
 *   knowledgePointId / questionType / difficulty / difficultyParams /
 *   numberRange / spiralLevel / context / seed
 *
 * 保留旧插件 fallback：runLegacyFallback 返回原始 exerciseSet（含 render/check），
 * 渲染与打印契约不变。
 */
'use strict';

var LegacyAdapter = require('../strategy/legacy-adapter.js');
var Contract = require('./generator-contract.js');

/**
 * 把 legacy 插件包装为 GeneratorContract。
 * @param {Object} plugin 已加载的 legacy 插件（含 generate）
 * @param {Object} [meta] { capabilities: string[], knowledgePoints: string[] }
 *        可由 M2 Generator Capability Registry 注入；缺省时 capabilities 取空数组。
 */
function createLegacyGenerator(plugin, meta) {
  meta = meta || {};
  var capabilities = Array.isArray(meta.capabilities) ? meta.capabilities.slice() : [];
  var knowledgePoints = Array.isArray(meta.knowledgePoints) ? meta.knowledgePoints.slice() : [];

  var generator = {
    id: 'legacy:' + (plugin.id || 'plugin'),
    subject: Contract.canonSubject(plugin.subject || 'math'),
    capabilities: capabilities,
    knowledgePoints: knowledgePoints,
    plugin: plugin,

    supports: function (plan) {
      if (!plan || !plan.questionTypeId) return false;
      if (capabilities.length && capabilities.indexOf(plan.questionTypeId) === -1) return false;
      if (knowledgePoints.length && plan.knowledgePointId &&
          knowledgePoints.indexOf(plan.knowledgePointId) === -1) return false;
      return true;
    },

    generate: function (plan, context) {
      context = context || {};
      var options = LegacyAdapter.adaptPlanToLegacyOptions(plan, context.legacy || {});
      var set = plugin.generate(options);
      if (set && typeof set.then === 'function') {
        return set.then(function (s) {
          return toSemanticQuestions(s, plan, context);
        });
      }
      return toSemanticQuestions(set, plan, context);
    }
  };
  return generator;
}

/** 输入类型 → SemanticQuestion.answerMode 映射（M4 严格契约） */
function mapInputType(inputType) {
  // M4 Generator Contract 仅区分 'read-aloud' 与 'input'（书面作答）。
  // choice/multi/none 仍属书面作答（学生选择/填写/无需文字），统一映射为 'input'，
  // 具体差异由 questionType / options / distractors 表达，避免非法 answerMode。
  if (inputType === 'read-aloud') return 'read-aloud';
  return 'input';
}

/** 标量化（数组/对象 → 可比较字符串；对象优先取其 value） */
function coerceScalar(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (Array.isArray(v)) return v.length ? String(v[0]) : null;
    return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
  }
  return String(v);
}

/** 从 per-question render(i) 输出里提取 <svg>...</svg>（捕获失败/无图形返回 null） */
function captureSvg(renderFn, owner, index) {
  if (typeof renderFn !== 'function') return null;
  try {
    var out = renderFn.call(owner, index);
    if (out == null) return null;
    var s = String(out);
    var start = s.indexOf('<svg');
    if (start === -1) return null;
    var end = s.indexOf('</svg>', start);
    if (end === -1) return null;
    return s.slice(start, end + '</svg>'.length);
  } catch (e) {
    return null;
  }
}

/**
 * legacy exerciseSet → SemanticQuestion[]（统一映射，剥离渲染契约）。
 */
function toSemanticQuestions(set, plan, context) {
  context = context || {};
  var questions = (set && Array.isArray(set.questions)) ? set.questions : [];
  var constraints = plan.constraints || {};
  var seedBase = context.seed;
  var SQ = require('../semantic-question.js');

  return questions.map(function (q, i) {
    // 跟读类（无书面作答，如 english-alphabet 的 letter/name/sound/example）→ answerMode 'read-aloud'
    var isReadAloud = q.answer == null && q.inputType == null && (q.letter != null || q.name != null);
    // 图形/统计型插件把题干放在 q.data.question 而非 q.q（如 stats-classify/picture）
    var dataPrompt = q.data ? (q.data.question != null ? q.data.question
      : (q.data.prompt != null ? q.data.prompt
        : (q.data.text != null ? q.data.text : null))) : null;
    var prompt = q.q != null ? q.q
      : (q.question != null ? q.question
        : (q.text != null ? q.text
          : (q.stem != null ? q.stem
            : (dataPrompt != null ? dataPrompt
              : (q.name != null ? q.name
                : (q.char != null ? q.char
                  : (q.pinyin != null ? q.pinyin
                      : (q.letter != null ? q.letter : ''))))))));

    // 规范化 answer 为对象格式 { value, acceptable } 以符合 SemanticQuestion Schema
    var rawAnswer = q.answer != null ? q.answer : null;
    var answerObj = (typeof rawAnswer === 'object' && rawAnswer !== null) ? rawAnswer : { value: rawAnswer, acceptable: [] };

    // answerMode：read-aloud（跟读类）或按 inputType 映射（choice/text/input/multi）
    var answerMode = isReadAloud ? 'read-aloud' : mapInputType(q.inputType || q.type);

    // distractors：choice 题由 options（剔除正确答案）构建
    var distractors = [];
    var allOptions = [];
    if (!isReadAloud && (q.inputType === 'choice' || q.type === 'choice') && Array.isArray(q.options)) {
      var correct = rawAnswer != null ? coerceScalar(rawAnswer) : null;
      allOptions = q.options.slice(); // 完整选项（含正确答案），用于渲染
      q.options.forEach(function (opt) {
        var val = coerceScalar(opt);
        if (val && val !== correct) distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
      });
    } else if (distractors.length > 0) {
      // 回退：从 answer + distractors 重建完整选项
      var correct = answerObj && answerObj.value != null ? coerceScalar(answerObj.value) : null;
      if (correct) allOptions = [correct].concat(distractors.map(function (d) { return d.value; }));
    }

    // graphic：携带 legacy svg / graphic / drawing / illustration，
    // 使 PresentationRenderer 经由 LegacySvgAdapter（R04）渲染出图形。
    // 部分图形型插件把视觉放在 per-question render(i) 而非 q.svg 字段
    // （如 patterns/stats/picture-equations）——在此捕获其 <svg> 字符串为描述符。
    var svgRaw = q.svg || q.illustration || null;
    if (!svgRaw && typeof q.render === 'function') {
      svgRaw = captureSvg(q.render, q, i);
    }
    var sq = {
      knowledgePointId: q.knowledgePointId || plan.knowledgePointId,
      questionType: plan.questionTypeId,
      difficulty: q.difficulty != null ? q.difficulty : plan.difficulty,
      difficultyParams: {
        level: plan.difficulty,
        scale: constraints.scale != null ? constraints.scale : 1,
        steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
        allowBracket: !!constraints.allowBracket,
        allowMultDiv: !!constraints.allowMultDiv
      },
      numberRange: constraints.numberRange || { min: 1, max: 1 },
      spiralLevel: plan.spiralLevel != null ? plan.spiralLevel : 1,
      context: plan.contextType != null ? plan.contextType : 'standard',
      seed: seedBase != null ? seedBase + ':' + i : null,
      content: { prompt: prompt },
      question: { prompt: prompt, answerMode: answerMode },
      answer: answerObj,
      distractors: distractors,
      options: allOptions.length ? allOptions : undefined,
      graphic: q.graphic != null ? q.graphic
        : (svgRaw ? { type: 'custom', subtype: null, params: { rawSvg: svgRaw }, renderHints: {} } : null),
      hint: q.hint != null ? q.hint : null,
      data: {
        kind: q.kind != null ? q.kind : null,
        type: q.type != null ? q.type : null,
        letter: q.letter != null ? q.letter : null,
        name: q.name != null ? q.name : null,
        example: q.example != null ? q.example : null,
        raw: (q.data != null && typeof q.data === 'object') ? safeCopy(q.data) : null,
        meta: safeCopy(set.meta)
      }
    };
    // 使用工厂函数补全 id / knowledgePoint / metadata 等必填字段
    return SQ.createSemanticQuestion(sq);
  });
}

function safeCopy(v) {
  if (v == null) return null;
  try {
    return JSON.parse(JSON.stringify(v));
  } catch (e) {
    return null;
  }
}

/**
 * 旧插件 fallback：QuestionPlan → legacy options → plugin.generate()
 * 返回原始 exerciseSet（含 render/check），渲染与打印契约不变。
 */
function runLegacyFallback(plugin, plan, uiExtra) {
  var options = LegacyAdapter.adaptPlanToLegacyOptions(plan, uiExtra || {});
  return plugin.generate(options);
}

module.exports = {
  createLegacyGenerator: createLegacyGenerator,
  toSemanticQuestions: toSemanticQuestions,
  runLegacyFallback: runLegacyFallback
};
