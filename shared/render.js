/**
 * shared/render.js — 插件渲染与工厂（任务 3.2 拆分）
 *
 * renderCard / renderGrid / clockSVG / createPlugin 及科目化工厂（math/chinese/english）。
 * 增量挂载到 window.PluginUtil；跨模块裸调用（createPlugin → defaultQCheck / _maybeReportCoverage）
 * 经全局解析（check.js / core.js 已挂全局）。
 */
(function (global) {
  'use strict';

  function renderCard(q, idx, opts) {
    opts = opts || {};
    var st = function (key, extra) {
      var s = (extra || '');
      return s ? ' style="' + s + '"' : '';
    };
    var inpW = opts.inputWidth || 96;
    // 宽度为动态值：显式 inputWidth 时内联输出，否则走 CSS 类默认 96px
    var inpWStyle = opts.inputWidth ? 'width:' + inpW + 'px;' : '';
    var svgHtml = '';
    if (q.svg) {
      svgHtml = '<div class="scene-box"' + st('scene-box') + '>' + q.svg + '</div>';
    }
    var hintHtml = q.hint ? '<div class="q-hint"' + st('q-hint') + '>💡 ' + q.hint + '</div>' : '';
    var badgeHtml = '';
    if (opts.badgeLabels && q.type && opts.badgeLabels[q.type]) {
      badgeHtml = '<span class="badge"' + st('badge') + '>' + opts.badgeLabels[q.type] + '</span>';
    }
    var formulaHtml = '<span class="qa-label"' + st('qa-label') + '>算式</span>' +
      '<input type="text" class="formula-inp" data-formula="' + idx + '" placeholder="列式" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 列式"' + st('formula-inp', 'width:120px;') + '>' +
      '<span class="qa-label"' + st('qa-label') + '>答案</span>';
    var inputHtml = '';
    if (q.inputType === 'choice') {
      var optsHtml = '';
      (q.options || []).forEach(function (o) {
        optsHtml += '<button type="button" class="opt" role="radio" aria-checked="false" data-val="' + String(o).replace(/"/g, '&quot;') + '" aria-label="第 ' + (idx + 1) + ' 题 选项：' + o + '" onclick="window.__pickOpt(this)"' + st('opt') + '>' + o + '</button>';
      });
      inputHtml = '<div class="options" role="radiogroup" aria-label="第 ' + (idx + 1) + ' 题 选项"' + st('options') + '>' + optsHtml + '</div>' +
        '<input type="hidden" data-index="' + idx + '">';
    } else if (q.inputType === 'multi') {
      var count = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      var inputs = '';
      for (var j = 0; j < count; j++) {
        inputs += '<input type="text" class="answer-inp" data-idx="' + idx + '" data-field="' + j + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 第 ' + (j + 1) + ' 空"' + st('answer-inp', inpWStyle) + '>';
      }
      inputHtml = '<div class="input-group"' + st('input-group') + '>' + inputs + '</div>';
    } else {
      inputHtml = '<div class="input-group"' + st('input-group') + '>' +
        '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off" aria-label="第 ' + (idx + 1) + ' 题 答案"' + st('answer-inp', inpWStyle) + '>' +
        (q.unit ? '<span class="unit"' + st('unit') + '>' + q.unit + '</span>' : '') +
        '</div>';
    }
    var qaRowHtml = '<div class="qa-row"' + st('qa-row') + '>' + formulaHtml + inputHtml + '</div>';
    var qTextHtml = q.rawHtml ? (q.q || '') : '<span class="q-text">' + (q.q || q.text || '') + '</span>';
    var qHeaderHtml = '<div class="q-header"' + st('q-header') + '>' +
      '<span class="num"' + st('num') + '>' + (idx + 1) + '</span>' +
      '&nbsp;&nbsp;&nbsp;&nbsp;' +
      qTextHtml +
      '</div>';
    return '<div class="question-card" data-index="' + idx + '" role="group" aria-label="第 ' + (idx + 1) + ' 题"' + st('question-card') + '>' +
      qHeaderHtml +
      badgeHtml +
      svgHtml +
      qaRowHtml +
      hintHtml +
      '<div class="feedback"' + st('feedback') + ' aria-live="polite"></div>' +
      '</div>';
  }

  /** 渲染整组题目（网格） */
  function renderGrid(questions, opts) {
    opts = opts || {};
    var cols = opts.columns || 3;
    var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
    questions.forEach(function (q, i) { html += renderCard(q, i, opts); });
    return html + '</div>';
  }

  // ============ 通用时钟 SVG（插件统一调用，避免各插件重复定义） ============
  /**
   * 统一的时钟 SVG（12 小时制，支持任意分钟；整时传 minute=0）。
   * 供 math-clock / math-time-date 等插件统一调用，单一来源、避免漂移。
   * @param {number} hour   小时（0~12，自动取模）
   * @param {number} [minute=0] 分钟
   * @returns {string} SVG 字符串
   */
  function clockSVG(hour, minute) {
    hour = ((hour % 12) + 12) % 12;
    minute = minute || 0;
    var cx = 60, cy = 60, r = 54;
    var hAngle = (hour % 12) * 30 + minute * 0.5;  // 12 点为 0°
    var mAngle = minute * 6;
    var hRad = (hAngle - 90) * Math.PI / 180;
    var mRad = (mAngle - 90) * Math.PI / 180;
    var hx = cx + 26 * Math.cos(hRad);
    var hy = cy + 26 * Math.sin(hRad);
    var mx = cx + 42 * Math.cos(mRad);
    var my = cy + 42 * Math.sin(mRad);
    var ticks = '';
    for (var i = 0; i < 12; i++) {
      var a = (i * 30 - 90) * Math.PI / 180;
      var r1 = (i % 3 === 0) ? 46 : 49;
      ticks += '<line x1="' + (cx + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (cy + r1 * Math.sin(a)).toFixed(1) +
        '" x2="' + (cx + r * Math.cos(a)).toFixed(1) + '" y2="' + (cy + r * Math.sin(a)).toFixed(1) +
        '" stroke="#9aa6bd" stroke-width="' + (i % 3 === 0 ? 2 : 1) + '"/>';
    }
    // 钟面数字：0° 为 12 点方向，顺时针 90°/180°/270° 分别对应 3/6/9 点
    var nums = [[12, 0], [3, 90], [6, 180], [9, 270]];
    var numHtml = '';
    nums.forEach(function (n) {
      var a = (n[1] - 90) * Math.PI / 180;
      var nx = cx + 40 * Math.cos(a);
      var ny = cy + 40 * Math.sin(a) + 4;
      numHtml += '<text x="' + nx.toFixed(1) + '" y="' + ny.toFixed(1) + '" text-anchor="middle" font-size="14" fill="#5b6b85" font-weight="700">' + n[0] + '</text>';
    });
    return '<svg width="120" height="120" viewBox="0 0 120 120" style="background:#fff;border-radius:50%;">' +
      '<circle cx="60" cy="60" r="54" fill="#fafbff" stroke="#5b8def" stroke-width="3"/>' +
      ticks + numHtml +
      '<line x1="60" y1="60" x2="' + hx.toFixed(1) + '" y2="' + hy.toFixed(1) + '" stroke="#27324a" stroke-width="4" stroke-linecap="round"/>' +
      '<line x1="60" y1="60" x2="' + mx.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#e8870a" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="60" cy="60" r="4" fill="#27324a"/>' +
      '</svg>';
  }

  // ============ 插件工厂 createPlugin ============
  /**
   * 插件工厂：开发者只需提供 generateQuestions(opts)，自动生成标准 generate/render/check。
   *
   * @param {Object} config
   *   id/name/subject/grades 必填；generateQuestions(opts) 必填，返回标准题目数组
   *   （每题含 answer + render(idx)，可选 check）。
   *   可选：category / description / printConfig / settings / knowledgePoints（声明覆盖的知识点 id/name）
   *        / columns（网格列数）/ meta / render（自定义整组渲染）/ check（自定义整组批改）。
   *        其余字段（如 __choose 等交互方法）原样挂载到插件对象。
   * @returns {Object} 标准 ExercisePlugin 对象（含 generate/render/check）
   */
  function createPlugin(config) {
    if (!config || typeof config !== 'object') {
      throw new Error('createPlugin(config)：配置对象缺失');
    }
    var id = config.id, name = config.name, subject = config.subject, grades = config.grades;
    if (!id || typeof id !== 'string') console.error('[createPlugin] 插件 ' + (name || '?') + ' 缺少必填字段 id（字符串）');
    if (!name) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 name');
    if (!subject) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 subject');
    if (!grades || !Array.isArray(grades) || !grades.length) console.error('[createPlugin] 插件 ' + id + ' 缺少必填字段 grades（非空数组）');
    if (typeof config.generateQuestions !== 'function') console.error('[createPlugin] 插件 ' + id + ' 必须提供 generateQuestions(opts) 函数');

    var _kb = (typeof global.KnowledgeBank !== 'undefined') ? global.KnowledgeBank : null;

    function defaultRender(set) {
      var cols = (set && set.meta && set.meta.columns) || config.columns || 3;
      var html = '<div class="questions-grid" style="display:grid;grid-template-columns:repeat(' + cols + ',1fr);gap:14px;">';
      set.questions.forEach(function (q, i) {
        html += (typeof q.render === 'function') ? q.render(i) : renderCard(q, i);
      });
      html += '</div>';
      return html;
    }

    function defaultCheck(set, answers) {
      var correct = 0, results = [], correctAnswers = [];
      set.questions.forEach(function (q, i) {
        var ok;
        if (typeof q.check === 'function') ok = !!q.check(answers, i);
        else ok = defaultQCheck(q, answers, i); // 缺省判定：multi 分字段 / 其余整串比较
        if (ok) correct++;
        results.push(ok);
        correctAnswers.push(Array.isArray(q.answer) ? q.answer.join('、') : String(q.answer));
      });
      var total = set.questions.length;
      var score = total ? Math.round(correct / total * 100) : 0;
      var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
      return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
    }

    function defaultGenerate(options) {
      var opts = options || {};
      // 参数合理性提醒
      if (opts.count != null && (!(opts.count > 0) || Math.floor(opts.count) !== opts.count)) {
        console.warn('[createPlugin:' + id + '] 参数 count 应为正整数，收到：' + opts.count);
      }
      var questions = [];
      try {
        questions = config.generateQuestions.call(plugin, opts) || [];
      } catch (e) {
        console.error('[createPlugin:' + id + '] generateQuestions 执行出错：', e);
        throw new Error('题型「' + name + '」生成题目时出错：' + (e && e.message ? e.message : e));
      }
      // 规范化：缺 render 的题用通用卡片兜底；缺 check 的题挂默认单题判定
      questions = questions.map(function (q, i) {
        if (q && typeof q.render !== 'function' && q.answer != null) {
          q.render = function (idx) { return renderCard(q, idx); };
        }
        if (q && typeof q.check !== 'function') {
          q.check = function (answers, idx) { return defaultQCheck(q, answers, idx); };
        }
        return q;
      });
      // 知识点声明校验：声明的知识点需在知识库中登记（统一结构：getEntries 扁平化）
      // 支持两种格式：① string[]（对所有 grades 统一校验）② { [grade]: string[] }（按年级分别校验）
      if (config.knowledgePoints && _kb && subject === 'math' && opts.grade) {
        var entries = _kb.getEntries ? _kb.getEntries('math', opts.grade) : [];
        if (entries.length) {
          var entryById = {};
          entries.forEach(function (e) { entryById[e.id] = true; entryById[e.name] = true; });
          var kpRaw = config.knowledgePoints;
          var kpList = Array.isArray(kpRaw) ? kpRaw : (kpRaw && kpRaw[opts.grade]) || [];
          var missing = kpList.filter(function (kp) { return !entryById[kp]; });
          if (missing.length) {
            console.warn('[createPlugin:' + id + '] 在 ' + opts.grade + ' 年级声明覆盖的知识点未在知识库登记：' +
              missing.join('、') + '（请补充 shared/knowledge-bank.js 或修正 knowledgePoints）');
          }
        }
      }
      // 开发期提示：当前页知识点覆盖（浏览器每页一次）
      _maybeReportCoverage(config);
      var meta = (typeof config.meta === 'function') ? config.meta(opts)
        : (config.meta || { grade: opts.grade, count: questions.length });
      return { questions: questions, meta: meta };
    }

    // 合并非保留字段（settings / printConfig / 自定义方法等）
    var RESERVED = { id: 1, name: 1, subject: 1, grades: 1, category: 1, description: 1,
      generateQuestions: 1, render: 1, check: 1, knowledgePoints: 1, columns: 1, meta: 1 };
    var plugin = {};
    Object.keys(config).forEach(function (k) { if (!RESERVED[k]) plugin[k] = config[k]; });
    plugin.id = id;
    plugin.name = name;
    plugin.subject = subject;
    plugin.grades = grades;
    if (config.category) plugin.category = config.category;
    if (config.description) plugin.description = config.description;
    if (config.printConfig) plugin.printConfig = config.printConfig;
    if (config.settings) plugin.settings = config.settings;
    plugin.generate = config.generate ? config.generate : defaultGenerate;
    plugin.render = config.render ? config.render : defaultRender;
    plugin.check = config.check ? config.check : defaultCheck;
    // 声明式知识点以独立字段暴露（RESERVED 不合并，避免与运行时方法混淆），
    // 供 dev/verify-knowledge-bank.js 等工具静态校验「声明 ↔ 知识库」一致性
    if (config.knowledgePoints) plugin.declaredKnowledgePoints = config.knowledgePoints;

    return plugin;
  }

  // ============ 科目化插件工厂（数学/语文/英语，自动注入 subject + difficultyParams + 修饰类） ============

  /** 科目化辅助：包装 generate，调用前自动注入 opts.difficultyParams（App.Difficulty.paramsFor 结果）。 */
  function _wrapDifficultyParams(plugin, subject) {
    var _orig = plugin.generate;
    plugin.generate = function (opts) {
      opts = opts || {};
      if (opts.difficultyParams == null) {
        var _D = (typeof global !== 'undefined') ? (global.App && global.App.Difficulty) : null;
        if (_D && typeof _D.paramsFor === 'function') {
          var lv = (opts.difficulty != null) ? opts.difficulty : (opts.level || 3);
          try { opts.difficultyParams = _D.paramsFor(subject, lv); } catch (e) { /* 安全跳过 */ }
        }
      }
      return _orig.call(plugin, opts);
    };
  }

  /** 科目化辅助：包装 render，在网格容器追加科目修饰类（math-grid / cn-grid / en-grid）。 */
  function _wrapGridClass(plugin) {
    if (!plugin.gridClass) return;
    var _orig = plugin.render;
    plugin.render = function (set) {
      var html = _orig.call(plugin, set);
      if (html.indexOf(plugin.gridClass) === -1) {
        html = html.replace('class="questions-grid"', 'class="questions-grid ' + plugin.gridClass + '"');
      }
      return html;
    };
  }

  /** 数值等价比较：'12' ≡ 12；非数值回退字符串比较 */
  function _numEq(a, b) {
    var na = Number(normalizeAns(a));
    var nb = Number(normalizeAns(b));
    if (!isNaN(na) && !isNaN(nb)) return na === nb;
    return normalizeAns(a) === normalizeAns(b);
  }

  /** 数值版 defaultQCheck：multi 分字段数值比较 / 其余整串数值比较 */
  function _mathQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (!_numEq(uv, parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return _numEq(ua, ans);
  }

  /**
   * 数学插件工厂：预设 subject='math'、数值比较批改（'12'≡12）、math-grid/math-card 修饰类、
   * 自动注入 opts.difficultyParams。旧 createPlugin(cfg) 完全兼容、行为不变。
   */
  function createMathPlugin(config) {
    config = config || {};
    config.subject = 'math';
    var _origGQ = config.generateQuestions;
    if (typeof _origGQ === 'function') {
      config.generateQuestions = function (opts) {
        var qs = _origGQ.call(this, opts) || [];
        qs.forEach(function (q) {
          if (q && typeof q.check !== 'function' && q.answer != null) {
            q.check = function (answers, idx) { return _mathQCheck(q, answers, idx); };
          }
        });
        return qs;
      };
    }
    var plugin = createPlugin(config);
    plugin.cardClass = 'math-card';
    plugin.gridClass = 'math-grid';
    _wrapDifficultyParams(plugin, 'math');
    _wrapGridClass(plugin);
    return plugin;
  }

  // ============ 增量挂载 ============
  global.PluginUtil = global.PluginUtil || {};
  global.PluginUtil.renderCard = renderCard;
  global.PluginUtil.renderGrid = renderGrid;
  global.PluginUtil.clockSVG = clockSVG;
  global.PluginUtil.createPlugin = createPlugin;
  global.PluginUtil.createMathPlugin = createMathPlugin;
  global.renderCard = renderCard;       // 跨模块裸调用兼容
  global.clockSVG = clockSVG;           // 插件直接调用兼容

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      renderCard: renderCard, renderGrid: renderGrid, clockSVG: clockSVG,
      createPlugin: createPlugin, createMathPlugin: createMathPlugin,
      _wrapDifficultyParams: _wrapDifficultyParams, _wrapGridClass: _wrapGridClass,
      _numEq: _numEq, _mathQCheck: _mathQCheck
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
