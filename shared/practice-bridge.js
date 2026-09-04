/**
 * shared/practice-bridge.js — 关联层 (Bridge / Coordinator)
 *
 * 职责：位于 UI 层与题目生成层 (PracticeSession / GenerationAPI) 之间，
 *   按 UI 层的功能与指令，翻译成题目生成层可理解的指令（GenerateInstruction），
 *   并接受生成层的反馈（成功 / 失败 / 批改结果），归一化后交回 UI 层。
 *
 * 外围控制层 (ControlService)：
 *   本文件内抽离为一个「服务模式」整块，集中解析并全面介入：
 *     - 数量 count（预置 20/30/50 / 自定义 1~50，默认 20）
 *     - 难度 difficulty（1~10，默认 1）
 *     - 知识点 knowledgePoints / knowledgePointId
 *     - 知识点驱动生成（per-KP 配额 kpAllocation —— 配额编排由生成层引擎 multi-kp 统一处理，
 *       本层不再自行分区/合并，仅透传配额）
 *
 * 分层约束：
 *   - 本文件不修改、不侵入题目生成层（shared/practice-session.js / generation-*）。
 *   - 本文件只“构造并调用”生成层，负责把 UI 意图翻译为生成层配置。
 *   - UI 层只与本文件（PracticeBridge）交互，不再直接 new PracticeSession。
 *
 * 指令结构 (GenerateInstruction)：
 *   {
 *     subject, grade,            // 科目 / 年级
 *     count,                     // 总题量
 *     difficulty,                // 难度 1-10
 *     mode,                      // quick / teacher / competition / adaptive / multi-kp
 *     knowledgePointId,          // 单知识点（单选）
 *     knowledgePoints,           // 多知识点（多选 / 快速模式）
 *     kpAllocation,              // 知识点题量占比（关联层的知识点驱动配额）
 *     questionType, subtype,     // 题型（可空）
 *     adaptive,                  // 是否自适应
 *     learnerProfile,            // 学习者画像（自适应反馈）
 *     titleType                  // 标题规格
 *   }
 *
 * 反馈结构 (反馈统一由生成层回执，经本层归一化)：
 *   - start() 成功 → { ok:true, session, questions, html, meta }
 *   - start() 失败 → { ok:false, session, error:{ code, message } }
 *   - submit()     → { ok:true, session, score, total, correct, results, correctAnswers }
 */
(function (global) {
  'use strict';

  // ============================================================
  // 外围控制层 (ControlService) —— 服务模式整块
  // ============================================================
  // 集中解析与校验 UI 驱动生成所需的全部维度（数量/难度/知识点/知识点驱动配额），
  // 并给出生成「执行计划」：带 per-KP 配额时编排为按知识点逐个生成，否则单次直发。
  var ControlService = (function () {
    var DEFAULTS = { count: 20, difficulty: 1 };
    var COUNT_MIN = 1, COUNT_MAX = 50;
    var DIFF_MIN = 1, DIFF_MAX = 10;
    var PRESET_COUNTS = { 20: true, 30: true, 50: true };

    function normNumber(v, min, max, dft) {
      var n = Number(v);
      return (isNaN(n) || n < min || n > max) ? dft : Math.floor(n);
    }

    // ---- 数量 ----
    function resolveCount(ui) {
      var raw = (ui && ui.count != null)
        ? ui.count
        : (ui && ui.state && ui.state.count != null ? ui.state.count : null);
      return normNumber(raw, COUNT_MIN, COUNT_MAX, DEFAULTS.count);
    }
    function countProfile(ui) {
      var count = resolveCount(ui);
      return { count: count, preset: !!PRESET_COUNTS[count], min: COUNT_MIN, max: COUNT_MAX };
    }

    // ---- 难度 ----
    function resolveDifficulty(ui) {
      var raw = (ui && ui.difficulty != null)
        ? ui.difficulty
        : (ui && ui.state && ui.state.difficulty != null ? ui.state.difficulty : null);
      return normNumber(raw, DIFF_MIN, DIFF_MAX, DEFAULTS.difficulty);
    }

    // ---- 知识点 ----
    function extractKnowledgePoints(ui) {
      var st = (ui && ui.state) || {};
      var kps = ui.knowledgePoints || (Array.isArray(st.knowledgePointIds) && st.knowledgePointIds.length ? st.knowledgePointIds.slice() : null);
      var kp = ui.knowledgePointId || st.kp || null;
      if (!kps && kp) kps = [kp];
      var allocation = ui.kpAllocation || st.kpAllocation || null;
      return { knowledgePoints: kps || null, knowledgePointId: kp || null, kpAllocation: allocation || null };
    }

    /**
     * 生成执行计划（大服务层只做信息流转：参数归一 → profile；不做编排运算）。
     * 题量分配（kpAllocation 配额 / 均分）由生成层引擎 multi-kp 统一处理。
     * @param {Object} ui - UI 注入的业务状态（含 state 与命令字段）。
     * @returns {{ profile:Object }}
     */
    function plan(ui) {
      ui = ui || {};
      var st = ui.state || {};
      var mode = ui.mode || st.mode || (ui.adaptive ? 'adaptive' : (ui.knowledgePoints && ui.knowledgePoints.length ? 'multi-kp' : 'native'));
      var c = countProfile(ui);
      var d = resolveDifficulty(ui);
      var kp = extractKnowledgePoints(ui);
      var subject = ui.subject || st.subject || 'math';
      var grade = ui.grade != null ? ui.grade : (st.grade != null ? st.grade : 1);

      var profile = {
        subject: subject,
        grade: grade,
        count: c.count,
        difficulty: d,
        mode: mode,
        knowledgePointId: kp.knowledgePointId,
        knowledgePoints: kp.knowledgePoints,
        kpAllocation: kp.kpAllocation,
        questionType: ui.questionType || st.questionType || null,
        questionTypes: ui.questionTypes || st.questionTypes || null,
        subtype: ui.subtype || st.subtype || null,
        adaptive: !!(ui.adaptive || st.adaptive),
        learnerProfile: ui.learnerProfile || st.learnerProfile || null,
        titleType: ui.titleType || st.titleType || null,
        pluginIds: ui.pluginIds || st.pluginIds || null,
        raw: ui.raw || null
      };

      // 编排（多知识点配额/分区）已下沉生成层：大服务层不再自行分区，
      // 统一由 PracticeSession 携带 knowledgePoints+kpAllocation 直发生成层引擎。
      return { profile: profile };
    }

    // 把单次指令翻译为生成层构造函数可消费的 options（只构造，不改生成层）
    function sessionConfig(profile) {
      var config = {
        subject: profile.subject,
        grade: profile.grade,
        count: profile.count,
        difficulty: profile.difficulty,
        knowledgePointId: profile.knowledgePointId || null,
        knowledgePointIds: Array.isArray(profile.knowledgePoints) ? profile.knowledgePoints : (profile.knowledgePointId ? [profile.knowledgePointId] : null),
        questionType: profile.questionType || null,
        questionTypes: Array.isArray(profile.questionTypes) ? profile.questionTypes : (profile.questionTypes ? [profile.questionTypes] : null),
        adaptive: !!profile.adaptive,
        learnerProfile: profile.learnerProfile || null,
        titleType: profile.titleType || null
      };
      if (profile.kpAllocation) config.kpAllocation = profile.kpAllocation;
      return config;
    }

    // 合并标题（沿用生成层同款格式）
    function mergedTitle(profile) {
      var subjectName = { math: '数学', chinese: '语文', english: '英语' }[profile.subject] || profile.subject;
      var gradeName = '一二三四五六'.charAt(Math.max(0, profile.grade - 1)) + '年级';
      var total = profile.count || 0;
      var t = profile.titleType || '综合练习';
      return gradeName + subjectName + ' · ' + t + '（' + total + '题）';
    }

    return Object.freeze({
      DEFAULTS: DEFAULTS,
      PRESET_COUNTS: PRESET_COUNTS,
      resolveCount: resolveCount,
      resolveDifficulty: resolveDifficulty,
      countProfile: countProfile,
      extractKnowledgePoints: extractKnowledgePoints,
      plan: plan,
      sessionConfig: sessionConfig,
      mergedTitle: mergedTitle
    });
  })();

  // ---------- 关联层服务实例 ----------
  var _session = null;          // 当前持有的生成层会话（单次直发：单个会话；编排：聚合会话 shim）
  var _onStartFeedback = null;  // UI 注册：接受生成层 start 反馈的钩子
  var _onSubmitFeedback = null; // UI 注册：接受生成层 submit 反馈的钩子

  // 读取生成层类型（浏览器 / CommonJS 边界，不修改生成层）
  function sessionCtor() {
    return (typeof global.PracticeSession !== 'undefined') ? global.PracticeSession
      : (typeof require !== 'undefined' ? require('./practice-session.js') : null);
  }

  // 装载旧插件（关联层不承载该逻辑，仅委托 UI 传入的 ensureLegacyPlugins 能力）
  function ensurePlugins(ui, run) {
    var loader = ui && ui.ensureLegacyPlugins;
    var subj = (ui && ui.subject) || (ui && ui.state && ui.state.subject) || 'math';
    if (typeof loader === 'function') {
      try { return loader(subj, ui && ui.grade).then(run).catch(run); } catch (e) { run(); return null; }
    }
    run();
    return null;
  }

  // ============================================
  // 知识点驱动生成：统一直发单个 PracticeSession（配额编排由生成层引擎 multi-kp 处理）
  // ============================================
  /**
   * 依计划执行：恒为单个 PracticeSession.start()（多知识点/配额由生成层引擎统一规划）。
   * @returns {Object} 会话（单个 session），或 null。
   */
  function runPlan(plan, handlers) {
    var profile = plan.profile;
    var run = function () {
      runSingle(profile, handlers);
    };
    ensurePlugins({ ensureLegacyPlugins: handlers && handlers.ensureLegacyPlugins, subject: profile.subject, grade: profile.grade }, run);
  }

  function runSingle(profile, handlers) {
    var Ctor = sessionCtor();
    if (!Ctor) { emitStart({ ok: false, error: { code: 'E_GEN_LAYER', message: '题目生成层（PracticeSession）未加载' } }); return; }
    try {
      _session = new Ctor(ControlService.sessionConfig(profile));
    } catch (e) {
      emitStart({ ok: false, instruction: profile, error: { code: 'E_SESSION', message: '创建练习会话失败：' + (e && e.message || e) } });
      return;
    }
    _session.start().then(function (result) {
      emitStart({
        ok: true,
        session: _session,
        instruction: profile,
        questions: result && result.questions || [],
        html: result && result.html || '',
        meta: result && result.meta || null
      });
    }).catch(function (err) {
      emitStart({
        ok: false,
        session: _session,
        instruction: profile,
        error: { code: 'E_GENERATE', message: (err && err.message) || '生成失败' }
      });
    });
  }

  // ============================================
  // 生成层调用 + 反馈接收
  // ============================================
  /**
   * 开始一次生成练习：经外围控制层解析执行计划 → 直发或按知识点编排生成。
   * 反馈（成功 / 失败）归一化后回调 UI 注册的 _onStartFeedback。
   * @param {Object} ui - UI 业务状态（或已有指令）
   * @param {Object} [handlers] - { ensureLegacyPlugins }
   * @returns {Object} 会话句柄（单个 session 或 null；编排路径异步完成后经反馈返回）
   */
  function start(ui, handlers) {
    // B1 清理：__profile/__orchestrated/__partitions 为历史遗留死路径，全仓库无调用方，
    // 统一经外围控制层 plan() 解析执行计划（与 resolve* 同源，保证 count/难度/kp 一致）。
    var p = ControlService.plan(ui || {});
    runPlan(p, handlers || {});
    return _session;
  }

  // ============================================
  // R4：大服务层查询（决策上收）
  //  - 可见性查询：知识点/模块在题型过滤范围内的可见性（源自 module-catalog.kpVisibleInType）
  //  - 题型→可见模块：标准题型支撑的模块 id 列表（源自 module-catalog.visibleModulesForType）
  //  - 题量规划：按知识点权重分配总题量（源自 question-type-allocation.allocateKpRatio）
  // UI 只读查询结果，不做推导 / 不持有静态过滤表。
  // ============================================
  // 访问大服务层 module-catalog（浏览器 / CommonJS 边界）
  function moduleCatalog() {
    return (typeof global !== 'undefined' && global.MODULE_CATALOG)
      ? global.MODULE_CATALOG
      : (typeof require !== 'undefined' ? require('./module-catalog.js') : null);
  }
  // 访问大服务层 question-type-allocation（浏览器经 strategy-engine.bundle 暴露的全局 / CommonJS）
  function typeAllocation() {
    return (typeof global !== 'undefined' && global.QuestionTypeAllocation)
      ? global.QuestionTypeAllocation
      : (typeof require !== 'undefined' ? require('./strategy/question-type-allocation.js') : null);
  }
  // 访问题型注册表（全局唯一题型 SSOT；浏览器经 strategy-engine.bundle 暴露 / CommonJS）
  function questionTypeRegistry() {
    return (typeof global !== 'undefined' && global.QuestionTypeRegistry)
      ? global.QuestionTypeRegistry
      : (typeof require !== 'undefined' ? require('./question-type-registry.js') : null);
  }
  // 可见性查询：知识点是否落在题型过滤范围内（无 qt 视为全部可见）
  function kpVisibleInType(kp, type) {
    var mc = moduleCatalog();
    if (mc && typeof mc.kpVisibleInType === 'function') return mc.kpVisibleInType(kp, type);
    return true; // 大服务层不可用时保守放行（不阻断 UI）
  }
  // 题型→可见模块：返回支撑该题型的模块 id 数组（未知题型返回 null）
  function visibleModulesForType(type) {
    var mc = moduleCatalog();
    if (mc && typeof mc.visibleModulesForType === 'function') return mc.visibleModulesForType(type);
    return null;
  }
  // 题量规划：按知识点权重分配总题量（最大剩余法，sum(count) === total）
  function allocateKpRatio(kps, total) {
    var ta = typeAllocation();
    if (ta && typeof ta.allocateKpRatio === 'function') return ta.allocateKpRatio(kps, total);
    return null;
  }
  // 题型展示名：canonical 题型 → 注册表 TYPES.name；历史细粒度 qt → LEGACY_DISPLAY_NAMES（R9 上收自 TYPE_PRETTY）。
  function questionTypeDisplayName(value) {
    var r = questionTypeRegistry();
    if (r && typeof r.displayName === 'function') return r.displayName(value);
    return null;
  }

  // 提交批改：调用生成层 submit()（编排路径走聚合会话 shim），归一化反馈后交回 UI。
  function submit() {
    if (!_session) { emitSubmit({ ok: false, error: { code: 'E_NO_SESSION', message: '尚未生成练习会话' } }); return null; }
    _session.submit().then(function (result) {
      emitSubmit({
        ok: true,
        session: _session,
        score: result && result.score,
        total: result && result.total,
        correct: result && result.correct,
        results: result && result.results,
        correctAnswers: result && result.correctAnswers
      });
    }).catch(function (err) {
      emitSubmit({ ok: false, session: _session, error: { code: 'E_SUBMIT', message: (err && err.message) || '批改失败' } });
    });
    return _session;
  }

  // 组装配对新会话的会话（供错题本重做等复用）
  function newSession(ins) {
    var Ctor = sessionCtor();
    if (!Ctor) return null;
    var built = ControlService.plan(ins || {}).profile;
    _session = new Ctor(ControlService.sessionConfig(built));
    return _session;
  }

  // ---------- 反馈分发（归一化出口） ----------
  function emitStart(fb) {
    if (typeof _onStartFeedback === 'function') _onStartFeedback(fb);
  }
  function emitSubmit(fb) {
    if (typeof _onSubmitFeedback === 'function') _onSubmitFeedback(fb);
  }
  function onStartFeedback(fn) { _onStartFeedback = fn; return bridge; }
  function onSubmitFeedback(fn) { _onSubmitFeedback = fn; return bridge; }

  // ---------- 冻结公开 API ----------
  var bridge = Object.freeze({
    control: ControlService,           // 外围控制层（服务模式整块）
    start: start,
    submit: submit,
    newSession: newSession,
    onStartFeedback: onStartFeedback,
    onSubmitFeedback: onSubmitFeedback,
    // R4 大服务层查询（决策上收，UI 只读）
    kpVisibleInType: kpVisibleInType,
    visibleModulesForType: visibleModulesForType,
    allocateKpRatio: allocateKpRatio,
    questionTypeDisplayName: questionTypeDisplayName
  });

  global.PracticeBridge = bridge;
  if (global.App && typeof global.App === 'object') global.App.PracticeBridge = bridge;
  if (typeof module !== 'undefined' && module.exports) module.exports = bridge;

})(typeof window !== 'undefined' ? window : global);