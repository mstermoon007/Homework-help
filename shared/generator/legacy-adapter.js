/**
 * shared/generator/legacy-adapter.js — M7-R18/P5 Task 5.1 统一 Legacy 适配层
 *
 * 合并自：
 *   - shared/legacy/plugin-adapter.js
 *   - shared/generator/legacy-plugin-adapter.js
 *   - shared/question/legacy-question-adapter.js
 *   - shared/question/legacy-renderer-adapter.js
 *   - shared/strategy/legacy-adapter.js
 *   - shared/generator/semantic-question-bridge.js
 *
 * 职责：
 *   1. adaptPlanToLegacyOptions(plan, extra) —— Plan → Legacy options
 *   2. generateByPluginId(pluginId, options) —— 加载并调用 legacy 插件
 *   3. toSemanticQuestions(exerciseSet, plan) —— Legacy exerciseSet → SemanticQuestion[]
 *   4. toLegacyQuestion(sq) —— SemanticQuestion → Legacy Question (含 render/check/svg，供旧渲染)
 *   5. hydrateLegacyGenerator(selection, plugin) —— Selector 实例化 legacy 生成器
 *   6. renderSet(set, pluginId) —— plugin.render 桥
 *   7. createLegacyGenerator(plugin, meta) —— Legacy GeneratorContract
 *   8. runLegacyFallback(plugin, plan) —— 兼容旧调用路径
 *
 * 删除：SemanticQuestion → Legacy Question 的反向转换（生成核心不再需要）。
 * 遗留插件输出直接转换为 SemanticQuestion 进入 Pipeline。
 */
(function (global) {
  'use strict';

  var isBrowser = typeof window !== 'undefined';
  var pluginCache = {};

  // ============================================================
  // 内部依赖（懒加载）
  // ============================================================
  function getSQ() {
    if (isBrowser && global.SemanticQuestion) return global.SemanticQuestion;
    if (typeof require === 'function') {
      try { return require('../semantic-question.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getQTR() {
    if (isBrowser && global.QuestionTypeRegistry) return global.QuestionTypeRegistry;
    if (typeof require === 'function') {
      try { return require('../question-type-registry.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getQID() {
    if (isBrowser && global.QuestionID) return global.QuestionID;
    if (typeof require === 'function') {
      try { return require('../question-id.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getPipeline() {
    if (isBrowser && global.ValidationPipeline) return global.ValidationPipeline;
    if (typeof require === 'function') {
      try { return require('../validator/validation-pipeline.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }
  function getPluginLoader() {
    if (isBrowser) return global.PluginLoader || null;
    if (typeof require === 'function') {
      try { return require('../../dev/plugin-loader.js'); } catch (e) { /* ignore */ }
    }
    return null;
  }

  // ============================================================
  // 1. adaptPlanToLegacyOptions —— Plan → Legacy options
  // (原 shared/strategy/legacy-adapter.js)
  // ============================================================
  function adaptPlanToLegacyOptions(plan, extra) {
    plan = plan || {};
    extra = extra || {};

    if (!plan.difficulty) {
      throw new Error('LegacyAdapter: plan 缺少 difficulty');
    }
    if (!plan.questionTypeId) {
      throw new Error('LegacyAdapter: plan 缺少 questionTypeId');
    }
    var constraints = plan.constraints || {};

    var options = {};

    options.difficulty = plan.difficulty;

    options.difficultyParams = {
      level: plan.difficulty,
      scale: constraints.scale != null ? constraints.scale : 1,
      steps: constraints.maxSteps != null ? constraints.maxSteps : 1,
      allowBracket: !!constraints.allowBracket,
      allowMultDiv: !!constraints.allowMultDiv
    };

    if (constraints.numberRange && constraints.numberRange.max != null) {
      options.maxNum = constraints.numberRange.max;
    }

    options.questionType = plan.questionTypeId;

    if (plan.subtype != null && plan.subtype !== '') options.subtype = plan.subtype;

    if (plan.cognitiveLevel != null) options.cognitiveLevel = plan.cognitiveLevel;
    if (plan.spiralLevel != null) options.spiralLevel = plan.spiralLevel;
    if (plan.contextType != null) options.contextType = plan.contextType;

    if (extra.grade != null) options.grade = extra.grade;
    if (plan.count != null) options.count = plan.count;
    else if (extra.count != null) options.count = extra.count;
    if (extra.type != null && extra.type !== '') options.type = extra.type;

    if (Array.isArray(extra.operators) && extra.operators.length) {
      options.operators = extra.operators.map(function (op) {
        if (op === '\u2212' || op === '\u2013' || op === '\uff0d') return '-';
        return op;
      });
    }
    Object.keys(extra.settings || {}).forEach(function (k) {
      if (k === 'type') return;
      var v = extra.settings[k];
      if (v !== '' && v != null) options[k] = v;
    });
    Object.keys(extra.settingNums || {}).forEach(function (k) {
      var v = extra.settingNums[k];
      if (v !== '' && v != null) options[k] = v;
    });

    return options;
  }

  // ============================================================
  // 2. Plugin 加载与生成
  // (原 shared/legacy/plugin-adapter.js + shared/generator/legacy-plugin-adapter.js)
  // ============================================================
  function loadPlugin(id) {
    if (!id) return null;
    if (pluginCache[id]) return pluginCache[id];

    var found = null;
    if (isBrowser) {
      if (global.__mathSubPlugins && global.__mathSubPlugins[id]) found = global.__mathSubPlugins[id];
      else if (global.__currentPlugin && global.__currentPlugin.id === id) found = global.__currentPlugin;
      else if (global.App && global.App.plugins && global.App.plugins[id]) found = global.App.plugins[id];
    } else {
      try {
        var loader = getPluginLoader();
        if (loader) {
          var entry = loader.loadPlugin(id);
          found = entry && !entry.error ? entry.plugin : null;
        }
      } catch (e) { /* ignore */ }
    }
    if (found) pluginCache[id] = found;
    return found || null;
  }

  function setPlugin(id, plugin) {
    if (id && plugin) pluginCache[id] = plugin;
    return plugin;
  }

  function generateByPluginId(pluginId, options) {
    return Promise.resolve().then(function () {
      var plugin = loadPlugin(pluginId);
      if (!plugin || typeof plugin.generate !== 'function') {
        throw new Error('Legacy 插件不可用或未装载: ' + pluginId);
      }
      var set = plugin.generate(options || {});
      return (set && typeof set.then === 'function') ? set : Promise.resolve(set);
    });
  }

  function renderSet(set, pluginId) {
    var plugin = loadPlugin(pluginId);
    if (!plugin || typeof plugin.render !== 'function') return null;
    try { return plugin.render(set); } catch (e) { return null; }
  }

  // ============================================================
  // 3. Legacy exerciseSet → SemanticQuestion[]
  // (原 shared/generator/legacy-plugin-adapter.js::toSemanticQuestions)
  // ============================================================
  function toSemanticQuestions(set, plan, context) {
    context = context || {};
    var questions = (set && Array.isArray(set.questions)) ? set.questions : [];
    var constraints = plan.constraints || {};
    var seedBase = context.seed;
    var SQ = getSQ();

    return questions.map(function (q, i) {
      var isReadAloud = q.answer == null && q.inputType == null && (q.letter != null || q.name != null);
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

      var rawAnswer = q.answer != null ? q.answer : null;
      var answerObj = (typeof rawAnswer === 'object' && rawAnswer !== null) ? rawAnswer : { value: rawAnswer, acceptable: [] };

      var answerMode = isReadAloud ? 'read-aloud' : mapInputType(q.inputType || q.type);

      var distractors = [];
      var allOptions = [];
      if (!isReadAloud && (q.inputType === 'choice' || q.type === 'choice') && Array.isArray(q.options)) {
        var correct = rawAnswer != null ? coerceScalar(rawAnswer) : null;
        allOptions = q.options.slice();
        q.options.forEach(function (opt) {
          var val = coerceScalar(opt);
          if (val && val !== correct) distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
        });
      } else if (distractors.length > 0) {
        var correct = answerObj && answerObj.value != null ? coerceScalar(answerObj.value) : null;
        if (correct) allOptions = [correct].concat(distractors.map(function (d) { return d.value; }));
      }

      var svgRaw = q.svg || q.illustration || null;
      if (!svgRaw && typeof q.render === 'function') {
        svgRaw = captureSvg(q.render, q, i);
      }

      var sq = {
        knowledgePointId: plan.knowledgePointId,
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
      return SQ.createSemanticQuestion(sq);
    });
  }

  // ============================================================
  // 4. Legacy Question → SemanticQuestion
  // (原 shared/question/legacy-question-adapter.js::adaptQuestion)
  // ============================================================
  function adaptQuestion(legacyQ, context) {
    context = context || {};
    legacyQ = legacyQ || {};
    var SQ = getSQ();
    var QTR = getQTR();
    var QID = getQID();

    // 基础字段提取
    var prompt = coerceString(legacyQ.q || legacyQ.text || legacyQ.stem || legacyQ.question || '');
    var answerVal = legacyQ.answer;
    var answerObj = (typeof answerVal === 'object' && answerVal !== null) ? answerVal : { value: answerVal };

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

    var distractors = [];
    if (inputType === 'choice' && Array.isArray(legacyQ.options)) {
      var correct = coerceScalar(answerVal);
      legacyQ.options.forEach(function (opt) {
        var val = coerceScalar(opt);
        if (val && val !== correct) {
          distractors.push({ value: val, errorType: '概念混淆', weight: 1 });
        }
      });
    }

    var graphic = null;
    if (legacyQ.svg || legacyQ.graphic || legacyQ.drawing) {
      graphic = {
        type: 'custom',
        subtype: null,
        params: { legacySvg: legacyQ.svg || legacyQ.graphic || legacyQ.drawing },
        renderHints: {}
      };
    }

    var knowledgePoint = context.knowledgePointId || legacyQ.knowledgePointId || legacyQ.kpId || '';
    var questionType = legacyQ.questionType || legacyQ.type || legacyQ.kind || 'calc';
    var norm = QTR && typeof QTR.normalizeQuestionType === 'function' ? QTR.normalizeQuestionType(questionType, { allowHeuristic: true }) : null;
    if (norm && norm.id) questionType = norm.id;
    var skill = legacyQ.skill || legacyQ.ability || '';

    var difficulty = context.difficulty != null ? context.difficulty : coerceInteger(legacyQ.difficulty);

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

    var sq = SQ.createSemanticQuestion({
      id: legacyQ.id || legacyQ.questionId,
      knowledgePoint: knowledgePoint,
      skill: skill,
      difficulty: difficulty,
      difficultyParams: legacyQ.difficultyParams || null,
      question: { prompt: prompt },
      content: { prompt: prompt },
      answer: { value: answerVal, acceptable: ensureArray(answerObj.acceptable) },
      distractors: distractors,
      graphic: graphic,
      metadata: metadata,
      render: legacyQ.render || null,
      check: legacyQ.check || null,
      svg: legacyQ.svg || null,
      questionType: questionType,
      answerMode: answerMode,
      type: legacyQ.type || null,
      hint: legacyQ.hint || null,
      numberRange: legacyQ.numberRange || null,
      difficultyParams: legacyQ.difficultyParams || null
    });

    return sq;
  }

  function coerceInteger(v) { var n = Number(v); return isNaN(n) ? null : Math.floor(n); }
  function ensureArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }
  function seededIndex(seedStr) {
    var h = 2166136261;
    var s = String(seedStr);
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
  }

  // ============================================================
  // 5. SemanticQuestion → Legacy Question (含 render/check/svg)
  // (原 shared/question/legacy-question-adapter.js::toLegacyQuestion)
  // ============================================================
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
      render: sq.render || null,
      check: sq.check || null,
      svg: sq.svg || (sq.graphic && sq.graphic.params && (sq.graphic.params.rawSvg || sq.graphic.params.legacySvg)) || null
    };

    return legacyQ;
  }

  function toLegacyQuestions(semanticQuestions) {
    if (!Array.isArray(semanticQuestions)) return [];
    return semanticQuestions.map(toLegacyQuestion);
  }

  // ============================================================
  // 5. createLegacyGenerator —— Legacy GeneratorContract
  // (原 shared/generator/legacy-plugin-adapter.js::createLegacyGenerator)
  // ============================================================
  function createLegacyGenerator(plugin, meta) {
    meta = meta || {};
    var capabilities = Array.isArray(meta.capabilities) ? meta.capabilities.slice() : [];
    var knowledgePoints = Array.isArray(meta.knowledgePoints) ? meta.knowledgePoints.slice() : [];

    var generator = {
      id: 'legacy:' + (plugin.id || 'plugin'),
      subject: canonSubject(plugin.subject || 'math'),
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
        var MAX_RETRIES = 3;

        function doGenerate(attempt) {
          var ctx = attempt === 0 ? context : { seed: (context.seed || '') + ':r' + attempt, legacy: context.legacy };
          var options = adaptPlanToLegacyOptions(plan, ctx.legacy || {});
          if (attempt > 0 && options.seed != null) {
            options.seed = options.seed + ':r' + attempt;
          }
          var set = plugin.generate(options);

          function handleResult(s) {
            var sqs = toSemanticQuestions(s, plan, ctx);
            var q = checkBatchQuality(sqs, plan);
            if (!q.ok && attempt < MAX_RETRIES) return doGenerate(attempt + 1);
            return sqs;
          }

          if (set && typeof set.then === 'function') {
            return set.then(handleResult);
          }
          return handleResult(set);
        }

        return doGenerate(0);
      }
    };
    return generator;
  }

  function hydrateLegacyGenerator(selection, plugin) {
    if (!selection || !selection.record) return null;
    if (!plugin) {
      var pid = selection.record.pluginId;
      if (!pid && typeof selection.record.id === 'string' && selection.record.id.indexOf('legacy:') === 0) {
        pid = selection.record.id.slice('legacy:'.length);
      }
      plugin = loadPlugin(pid);
    }
    if (!plugin) return null;
    return createLegacyGenerator(plugin, {
      capabilities: selection.record.capabilities,
      knowledgePoints: selection.record.knowledgePoints
    });
  }

  // ============================================================
  // 6. runLegacyFallback —— 兼容旧调用路径
  // ============================================================
  async function runLegacyFallback(plugin, plan, uiExtra) {
    var options = adaptPlanToLegacyOptions(plan, uiExtra || {});
    return Promise.resolve(plugin.generate(options));
  }

  // ============================================================
  // 内部工具函数
  // ============================================================
  function mapInputType(inputType) {
    if (inputType === 'read-aloud') return 'read-aloud';
    return 'input';
  }

  function coerceScalar(v) {
    if (v == null) return null;
    if (typeof v === 'object') {
      if (Array.isArray(v)) return v.length ? String(v[0]) : null;
      return v.value != null ? String(v.value) : (v.correctAnswer != null ? String(v.correctAnswer) : null);
    }
    return String(v);
  }

  function coerceString(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    return String(v);
  }

  function safeCopy(v) {
    if (v == null) return null;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return null; }
  }

  function parseOperands(prompt) {
    if (!prompt || typeof prompt !== 'string') return [];
    var nums = [];
    var re = /(-?\d+\.?\d*)/g;
    var m;
    while ((m = re.exec(prompt)) !== null) nums.push(Number(m[1]));
    return nums;
  }

  function checkBatchQuality(sqs, plan) {
    var range = (plan.constraints && plan.constraints.numberRange) || null;
    var seen = {};
    for (var i = 0; i < sqs.length; i++) {
      var q = sqs[i];
      var prompt = (q.content && q.content.prompt) || (q.question && q.question.prompt) || '';
      if (range) {
        var ops = parseOperands(prompt);
        for (var j = 0; j < ops.length; j++) {
          if (ops[j] < range.min || ops[j] > range.max) return { ok: false, reason: 'bounds' };
        }
      }
      if (seen[prompt]) return { ok: false, reason: 'duplicates' };
      seen[prompt] = true;
    }
    return { ok: true };
  }

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
    } catch (e) { return null; }
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

  function canonSubject(s) { return (s || 'math').toLowerCase(); }

  // ============================================================
  // 暴露 API
  // ============================================================
  var API = {
    adaptPlanToLegacyOptions: adaptPlanToLegacyOptions,
    loadPlugin: loadPlugin,
    setPlugin: setPlugin,
    generateByPluginId: generateByPluginId,
    renderSet: renderSet,
    toSemanticQuestions: toSemanticQuestions,
    adaptQuestion: adaptQuestion,
    toLegacyQuestion: toLegacyQuestion,
    toLegacyQuestions: toLegacyQuestions,
    createLegacyGenerator: createLegacyGenerator,
    hydrateLegacyGenerator: hydrateLegacyGenerator,
    runLegacyFallback: runLegacyFallback,
    coerceString: coerceString,
    safeCopy: safeCopy
  };

  global.LegacyAdapter = API;
  if (global.App && typeof global.App === 'object') global.App.LegacyAdapter = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);