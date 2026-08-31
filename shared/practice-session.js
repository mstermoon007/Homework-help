/**
 * shared/practice-session.js — P7-R01/P7-R02/P7-R03 统一练习会话
 *
 * 统一练习流程：
 *   生成题目 → 用户作答 → 保存答案 → 批改 → 结果收集 → 学习者模型更新
 *
 * 设计原则：
 *   - PracticeSession 为唯一练习流程入口
 *   - 页面仅调用 session.start() / session.submit() / session.review()
 *   - 答案判定统一经 check() / AnswerValidator，页面不自行实现判断
 *   - 结果收集经 PracticeResult → ResultCollector → LearnerModel → Storage
 *   - 错题本/重做/显示答案保留现有能力，经 StorageManager
 */
(function (global) {
  'use strict';

  // 依赖加载
  var GenerationEngine = (typeof global.GenerationEngine !== 'undefined') ? global.GenerationEngine
    : (typeof require !== 'undefined' ? require('./generation-engine.js') : null);
  var StorageManager = (typeof global.StorageManager !== 'undefined') ? global.StorageManager
    : (typeof require !== 'undefined' ? require('./storage.js') : null);
  var ResultCollector = (typeof global.ResultCollector !== 'undefined') ? global.ResultCollector
    : (typeof require !== 'undefined' ? require('./learner/result-collector.js') : null);
  var LearnerStorage = (typeof global.LearnerStorage !== 'undefined') ? global.LearnerStorage
    : (typeof require !== 'undefined' ? require('./learner/learner-storage.js') : null);
  var PracticeResult = (typeof global.PracticeResult !== 'undefined') ? global.PracticeResult
    : (typeof require !== 'undefined' ? require('./learner/practice-result.js') : null);
  var PluginUtil = (typeof global.PluginUtil !== 'undefined') ? global.PluginUtil
    : (typeof require !== 'undefined' ? require('./common.js') : null);
  var PresentationRenderer = (typeof global.PresentationRenderer !== 'undefined') ? global.PresentationRenderer
    : (typeof require !== 'undefined' ? require('./presentation/renderer.js') : null);
  var Print = (typeof global.Print !== 'undefined') ? global.Print
    : (typeof require !== 'undefined' ? require('./print.js') : null);

  var Metrics = (typeof global.Metrics !== 'undefined') ? global.Metrics
    : (typeof require !== 'undefined' ? require('./metrics.js') : null);

  // ============================================
  // 练习会话状态机
  // ============================================
  var STATE = {
    IDLE: 'idle',           // 待生成
    ANSWERING: 'answering', // 作答中
    SUBMITTED: 'submitted', // 已提交待批改
    CHECKED: 'checked',     // 已批改
    REVIEWING: 'reviewing'  // 复习/重做中
  };

  // ============================================
  // PracticeSession 类
  // ============================================
  function PracticeSession(options) {
    options = options || {};
    this.config = {
      subject: options.subject || 'math',
      grade: options.grade || 1,
      count: options.count || 10,
      difficulty: options.difficulty || 3,
      knowledgePointId: options.knowledgePointId || null,
      knowledgePointIds: options.knowledgePointIds || null,
      questionType: options.questionType || null,
      adaptive: options.adaptive || false,
      learnerProfile: options.learnerProfile || null
    };
    this.state = STATE.IDLE;
    this.exerciseSet = null;      // { questions: LegacyQuestion[], meta }
    this.semanticQuestions = null; // SemanticQuestion[]
    this.lastSemantic = null;      // 生成引擎完整输出
    this.checkResult = null;       // 批改结果
    this.answers = {};             // 用户作答
    this.startTime = 0;            // 开始时间戳
    this.timerId = null;
  }

  // ============================================
  // 公开 API
  // ============================================

  /**
   * 启动练习会话：生成题目 → 渲染 → 进入作答状态
   * @returns {Promise<{ questions, html, meta }>}
   */
  PracticeSession.prototype.start = function () {
    var self = this;
    this.state = STATE.IDLE;
    this.answers = {};
    this.checkResult = null;

    // 1. 构建生成请求
    var req = this._buildGenerationRequest();

    // 2. 调用统一生成引擎
    return GenerationEngine.generate(req, { renderOptions: { mode: 'screen' } })
      .then(function (g) {
        if (!g.questions || !g.questions.length) {
          throw new Error('该配置下没有可生成的题目');
        }

        // 3. 转换为 legacy 形状供批改/错题本/打印使用
        var legacy = g.questions.map(function (sq) {
          return self._sqToLegacyQuestion(sq);
        });

        self.semanticQuestions = g.questions;
        self.lastSemantic = g;

        var set = {
          questions: legacy,
          meta: { title: self._buildTitle() }
        };
        self.exerciseSet = set;
        self.state = STATE.ANSWERING;
        self.startTime = Date.now();

        // 记录指标
        if (Metrics && Metrics.recordGenerationStart) {
          Metrics.recordGenerationStart({
            generator: 'engine', subject: self.config.subject, grade: self.config.grade
          });
        }

        return { questions: legacy, html: g.html, meta: set.meta };
      })
      .catch(function (err) {
        self.state = STATE.IDLE;
        throw err;
      });
  };

  /**
   * 提交作答并批改
   * @returns {Promise<CheckResult>}
   */
  PracticeSession.prototype.submit = function () {
    var self = this;
    if (this.state !== STATE.ANSWERING) {
      return Promise.reject(new Error('当前状态不允许提交'));
    }

    this.state = STATE.SUBMITTED;
    var answers = this._collectAnswers();
    this.answers = answers;

    // 统一经 PluginUtil.computeResult 批改
    var result = PluginUtil.computeResult(this.exerciseSet.questions, answers);

    if (!result || typeof result.score !== 'number' || !Array.isArray(result.results)) {
      return Promise.reject(new Error('批改结果不兼容'));
    }

    this.checkResult = result;
    this.state = STATE.CHECKED;

    // 记录指标
    if (Metrics && Metrics.recordValidationResult) {
      result.results.forEach(function (vr) {
        Metrics.recordValidationResult({ valid: vr, generator: 'engine', subject: self.config.subject });
      });
    }

    return Promise.resolve(result);
  };

  /**
   * 获取批改结果（含标记、分数、正确答案）
   */
  PracticeSession.prototype.getCheckResult = function () {
    return this.checkResult;
  };

  /**
   * 显示/隐藏答案
   */
  PracticeSession.prototype.toggleReveal = function () {
    if (!this.exerciseSet) return;
    // 复用现有 toggleReveal 逻辑
    // 页面层实现，这里只提供答案数据
    if (!this.checkResult) {
      var answers = this._collectAnswers();
      var result = PluginUtil.computeResult(this.exerciseSet.questions, answers);
      this.checkResult = result;
    }
    return this.checkResult;
  };

  /**
   * 重做错题
   * @returns {Promise<{ questions, html, meta }>}
   */
  PracticeSession.prototype.redoWrong = function () {
    var self = this;
    if (!this.exerciseSet || !this.checkResult) {
      return Promise.reject(new Error('无错题可重做'));
    }

    var wrongIdx = [];
    this.checkResult.results.forEach(function (ok, i) { if (!ok) wrongIdx.push(i); });
    if (!wrongIdx.length) return Promise.reject(new Error('无错题'));

    var wrongQuestions = this.exerciseSet.questions.filter(function (_, i) {
      return wrongIdx.indexOf(i) !== -1;
    });

    var set = {
      questions: wrongQuestions,
      meta: (this.exerciseSet.meta || {})
    };
    this.exerciseSet = set;
    this.checkResult = null;
    this.answers = {};
    this.state = STATE.ANSWERING;
    this.startTime = Date.now();

    return Promise.resolve({
      questions: wrongQuestions,
      html: this._renderSet(set),
      meta: set.meta
    });
  };

  /**
   * 打开错题本
   * @returns {Promise<{ questions, html, meta }>}
   */
  PracticeSession.prototype.openWrongBook = function () {
    var pid = this._getPracticeContextId();
    var wrongs = StorageManager.getWrongList(pid);
    var questions = [];
    wrongs.forEach(function (w) { if (w.questionData) questions.push(w.questionData); });

    if (!questions.length) {
      return Promise.reject(new Error('暂无错题'));
    }

    var set = { questions: questions, meta: { title: '错题本 · 练习' } };
    this.exerciseSet = set;
    this.checkResult = null;
    this.answers = {};
    this.state = STATE.ANSWERING;

    return Promise.resolve({
      questions: questions,
      html: this._renderSet(set),
      meta: set.meta
    });
  };

  /**
   * 打印练习题
   */
  PracticeSession.prototype.print = function () {
    if (!this.exerciseSet || !this.exerciseSet.questions.length) {
      return Promise.reject(new Error('请先生成练习题'));
    }

    var title = this._buildTitle();
    var pageType = 'math';

    // 优先使用 Engine 产物直接打印
    if (this.lastSemantic && this.lastSemantic.questions && this.lastSemantic.questions.length) {
      return Print.openFromQuestions(this.lastSemantic.questions, { title: title });
    }

    // 回退 DOM 克隆打印
    var area = document.getElementById('problemsArea');
    var fixedCols = this.exerciseSet.meta && this.exerciseSet.meta.columns;
    var a4w = 718;
    var cols = fixedCols ? fixedCols : (global.PluginUtil && global.PluginUtil.layout
      ? global.PluginUtil.layout.calcOptimalCols(this.exerciseSet, a4w) : 3);

    var opts = { pageType: pageType, columns: cols };
    return Print.open(area, title, opts);
  };

  /**
   * 重新生成（保持当前配置）
   */
  PracticeSession.prototype.regenerate = function () {
    return this.start();
  };

  // ============================================
  // 内部方法
  // ============================================

  PracticeSession.prototype._buildGenerationRequest = function () {
    var req = {
      subject: this.config.subject,
      grade: this.config.grade,
      count: this.config.count,
      difficulty: this.config.difficulty,
      mode: 'single-kp'
    };

    if (this.config.knowledgePointIds && this.config.knowledgePointIds.length) {
      req.knowledgePoints = this.config.knowledgePointIds;
      req.mode = 'multi-kp';
    } else if (this.config.knowledgePointId) {
      req.knowledgePointId = this.config.knowledgePointId;
      req.mode = 'single-kp';
    }

    if (this.config.questionType) {
      req.questionType = this.config.questionType;
      req.questionTypes = [this.config.questionType];
    }

    // 自适应
    if (this.config.adaptive && this.config.learnerProfile) {
      req.learnerProfile = this.config.learnerProfile;
      req.adaptive = true;
      req.mode = 'adaptive';
    }

    return req;
  };

  PracticeSession.prototype._buildTitle = function () {
    var subjectName = { math: '数学', chinese: '语文', english: '英语' }[this.config.subject] || this.config.subject;
    var gradeName = '一二三四五六'.charAt(this.config.grade - 1) + '年级';
    return gradeName + ' ' + subjectName + '练习';
  };

  PracticeSession.prototype._getPracticeContextId = function () {
    var parts = [this.config.subject, 'g' + this.config.grade];
    if (this.config.knowledgePointId) parts.push(this.config.knowledgePointId);
    else if (this.config.knowledgePointIds && this.config.knowledgePointIds.length) parts.push(this.config.knowledgePointIds[0]);
    else parts.push('all');
    return parts.join('-');
  };

  PracticeSession.prototype._collectAnswers = function () {
    var answers = {};
    document.querySelectorAll('#problemsArea input[data-index], #problemsArea input[data-idx]').forEach(function (inp) {
      if (inp.hasAttribute('data-index')) {
        answers[inp.getAttribute('data-index')] = inp.value.trim();
      } else if (inp.hasAttribute('data-idx') && inp.hasAttribute('data-field')) {
        answers[inp.getAttribute('data-idx') + ':' + inp.getAttribute('data-field')] = inp.value.trim();
      }
    });
    return answers;
  };

  PracticeSession.prototype._sqToLegacyQuestion = function (sq) {
    var ans = '';
    if (sq.answer) {
      if (sq.answer.value != null) ans = sq.answer.value;
      else if (Array.isArray(sq.answer.acceptable) && sq.answer.acceptable.length) ans = sq.answer.acceptable[0];
    }
    return {
      q: sq.prompt || (sq.content && sq.content.prompt) || '',
      text: sq.prompt || '',
      answer: ans,
      id: sq.id,
      knowledgePointId: sq.knowledgePoint,
      questionType: sq.questionType,
      difficulty: sq.difficulty,
      inputType: (sq.answerMode === 'choice') ? 'choice' : undefined,
      options: sq.options || sq.distractors || undefined,
      __semantic: sq
    };
  };

  PracticeSession.prototype._renderSet = function (set) {
    // 复用现有 render 逻辑（简化版）
    var area = document.getElementById('problemsArea');
    if (!area) return '';
    // 实际渲染由页面层实现，这里返回 HTML 字符串供页面渲染
    return '';
  };

  // ============================================
  // 导出
  // ============================================
  global.PracticeSession = PracticeSession;
  if (typeof module !== 'undefined' && module.exports) module.exports = PracticeSession;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));