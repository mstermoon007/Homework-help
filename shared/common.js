/**
 * shared/common.js — 共享基础模块（站点 + 插件，统一入口）
 *
 * 由根目录 common.js（App 全局：路由/页面控制器/年级）与插件工具
 * （PluginUtil：randInt/shuffle/normPY/normHZ）合并而来，供所有页面与插件加载。
 *
 * 浏览器：<script src="shared/common.js"></script>
 *   全局 App：页面路由、年级参数、页面控制器
 *   全局 PluginUtil：插件随机/标准化工具（插件内不得直接用 Math.random()）
 * Node：const PluginUtil = require('./shared/common.js')
 */
(function (global) {
  'use strict';

  // ============ 站点常量 ============
  var GRADE_NAMES = { '1':'一年级','2':'二年级','3':'三年级','4':'四年级','5':'五年级','6':'六年级' };
  var SUBJECT_NAMES = { 'math':'数学', 'chinese':'语文', 'english':'英语' };

  // ============ 路由配置 ============
  var ROUTES = {
    home:       'index.html',
    mathTypes:  'math-types.html',
    chineseTypes: 'chinese-types.html',
    englishTypes: 'english-types.html',
    englishAlphabet: 'practice.html?plugin=english-alphabet',
    mathPractice: 'practice.html?plugin=math-oral',
    mathWord:   'practice.html?plugin=math-word-problems',
    mathMakeTen: 'practice.html?plugin=math-make-ten',
    mathShapes: 'practice.html?plugin=math-shapes',
    mathComprehensive: 'practice.html?plugin=math-comprehensive',
    pinyinPractice: 'practice.html?plugin=chinese-pinyin',
    pinyinToChar: 'practice.html?plugin=pinyin-to-char',
    comprehensive: 'practice.html?plugin=chinese-comprehensive',
    print:      'print.js'
  };

  // ============ 路由参数 ============

  /** 从 URL 获取年级参数 */
  function getGradeParam() {
    var p = new URLSearchParams(global.location.search).get('grade');
    var valid = ['1','2','3','4','5','6'];
    return valid.indexOf(p) !== -1 ? Number(p) : 1;
  }

  /** 获取年级中文名 */
  function getGradeName(g) {
    return GRADE_NAMES[String(g)] || '一年级';
  }

  /** 获取当前页面的年级 */
  function currentGrade() {
    return getGradeParam();
  }

  /** 生成带年级参数的目标链接（path 若已含 ? 则自动用 & 拼接） */
  function buildLink(path, g) {
    var grade = g !== undefined ? g : currentGrade();
    return path + (path.indexOf('?') !== -1 ? '&' : '?') + 'grade=' + encodeURIComponent(grade);
  }

  /** 生成统一练习页链接（带插件 ID 与年级参数）：practice.html?plugin=xxx&grade=n */
  function buildPluginLink(pluginId, g) {
    return buildLink('practice.html?plugin=' + encodeURIComponent(pluginId), g);
  }

  /** 根据路由名跳转页面（自动带年级参数） */
  function navigateTo(routeName, g) {
    var path = ROUTES[routeName];
    if (!path) return;
    var grade = g !== undefined ? g : currentGrade();
    global.location.href = path + (path.indexOf('?') !== -1 ? '&' : '?') + 'grade=' + encodeURIComponent(grade);
  }

  // ============ 声调映射（站点 + 插件共用） ============
  var TONE_MAP = {
    'ā':'a','á':'a','ǎ':'a','à':'a',
    'ō':'o','ó':'o','ǒ':'o','ò':'o',
    'ē':'e','é':'e','ě':'e','è':'e',
    'ī':'i','í':'i','ǐ':'i','ì':'i',
    'ū':'u','ú':'u','ǔ':'u','ù':'u',
    'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü'
  };

  /** 增强版随机整数 [min, max]（crypto 优先，兜底 Math.random） */
  function randInt(min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  /** Fisher-Yates 洗牌（返回新数组，不改原数组） */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /** 从数组随机取一个元素 */
  function rand(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  // ============ 难度工具（1-10，数值型，由用户填写） ============
  /** 归一化难度：1-10 整数，非法值回退默认 3（标准难度） */
  function diffLevel(d) {
    var n = Number(d);
    if (!isFinite(n) || n < 1) return 3;
    if (n > 10) return 10;
    return Math.round(n);
  }
  /** 难度 → 数值缩放系数：level 1→0.8，3→1.0，5→1.4，8→2.0，10→2.4 */
  function diffScale(level) {
    var l = diffLevel(level);
    return 1 + (l - 3) * 0.2;
  }
  /** 难度 → 推荐最大数（base 为难度 3 时的基准最大值） */
  function diffMax(base, level) {
    return Math.round(base * diffScale(level));
  }

  /** 标准化拼音（去声调、去空格、小写、v→ü） */
  function normPY(s) {
    if (!s) return '';
    return s.toLowerCase()
      .split('').map(function (c) { return TONE_MAP[c] || c; }).join('')
      .replace(/\s+/g, '')
      .replace(/v/g, 'ü')
      .replace(/[:：]/g, '');
  }

  /** 标准化汉字（去空格） */
  function normHZ(s) {
    if (!s) return '';
    return s.replace(/\s+/g, '').trim();
  }

  // ============ 插件渲染/批改辅助（供 plugins/*.js 复用） ============

  /** 标准化答案比较（去空格、小写） */
  function normalizeAns(v) {
    return String(v == null ? '' : v).trim().replace(/\s+/g, '').toLowerCase();
  }

  /** 渲染单题卡片。q 形状：{ q, svg, hint, unit, inputType, options, inputCount, answer } */
  function renderCard(q, idx, opts) {
    opts = opts || {};
    var inpW = opts.inputWidth || 96;
    var svgHtml = '';
    if (q.svg) {
      svgHtml = '<div class="scene-box" style="display:flex;align-items:center;justify-content:center;gap:20px;padding:16px;background:#f8fafd;border-radius:12px;margin:8px 0;flex-wrap:wrap;">' + q.svg + '</div>';
    }
    var hintHtml = q.hint ? '<div style="font-size:11px;color:#7a879c;margin-bottom:6px;">💡 ' + q.hint + '</div>' : '';
    var badgeHtml = '';
    if (opts.badgeLabels && q.type && opts.badgeLabels[q.type]) {
      badgeHtml = '<span class="badge" style="position:absolute;right:10px;top:10px;font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:#eef3fb;color:#5b8def;">' + opts.badgeLabels[q.type] + '</span>';
    }
    var inputHtml = '';
    if (q.inputType === 'choice') {
      var optsHtml = '';
      (q.options || []).forEach(function (o) {
        optsHtml += '<span class="opt" data-val="' + String(o).replace(/"/g, '&quot;') + '" onclick="window.__pickOpt(this)" style="cursor:pointer;border:1.5px solid #e3e9f2;background:#fff;color:#27324a;border-radius:10px;padding:8px 16px;font-size:14px;font-weight:600;transition:.15s;display:inline-flex;align-items:center;gap:6px;">' + o + '</span>';
      });
      inputHtml = '<div class="options" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;">' + optsHtml + '</div>' +
        '<input type="hidden" data-index="' + idx + '">';
    } else if (q.inputType === 'multi') {
      var count = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      var inputs = '';
      for (var j = 0; j < count; j++) {
        inputs += '<input type="text" class="answer-inp" data-idx="' + idx + '" data-field="' + j + '" placeholder="?" autocomplete="off" style="width:' + inpW + 'px;height:32px;border:2px dashed #ccc;border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#3f6fd1;background:#fafafa;outline:none;">';
      }
      inputHtml = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">' + inputs + '</div>';
    } else {
      inputHtml = '<div class="input-group" style="display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap;">' +
        '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off" style="width:' + inpW + 'px;height:32px;border:2px dashed #ccc;border-radius:7px;font-size:15px;font-weight:700;text-align:center;color:#3f6fd1;background:#fafafa;outline:none;">' +
        (q.unit ? '<span style="font-size:13px;color:#7a879c;font-weight:600;">' + q.unit + '</span>' : '') +
        '</div>';
    }
    var qTextHtml = q.rawHtml ? (q.q || '') : '<span class="q-text">' + (q.q || q.text || '') + '</span>';
    return '<div class="question-card" data-index="' + idx + '" style="border:1px solid #e3e9f2;border-radius:14px;padding:14px 12px;position:relative;text-align:center;background:#fff;box-shadow:0 8px 24px rgba(40,70,120,.08);">' +
      '<span class="num" style="position:absolute;left:8px;top:8px;width:20px;height:20px;border-radius:50%;background:#eef3fb;color:#3f6fd1;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center;">' + (idx + 1) + '</span>' +
      badgeHtml +
      qTextHtml +
      svgHtml +
      hintHtml +
      inputHtml +
      '<div class="feedback" style="font-size:12px;font-weight:700;min-height:16px;margin-top:6px;"></div>' +
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

  /** 通用批改：返回 { score,total,correct,message,results,correctAnswers } */
  function computeResult(questions, userAnswers, opts) {
    opts = opts || {};
    var checkFn = opts.checkFn || function (q, ua, i) {
      if (q.inputType === 'choice' || q.inputType === 'text') {
        return normalizeAns(ua[i]) === normalizeAns(Array.isArray(q.answer) ? q.answer.join('') : q.answer);
      }
      if (q.inputType === 'multi') {
        var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(',');
        for (var j = 0; j < parts.length; j++) {
          if (normalizeAns(ua[i + ':' + j]) !== normalizeAns(parts[j])) return false;
        }
        return true;
      }
      return false;
    };
    var correct = 0, results = [], correctAnswers = [];
    questions.forEach(function (q, i) {
      var ok = checkFn(q, userAnswers, i);
      if (ok) correct++;
      results.push(ok);
      var disp = Array.isArray(q.answer) ? q.answer.join('、') : q.answer;
      correctAnswers.push(q.answerParts ? q.answerParts.join('、') : disp);
    });
    var total = questions.length;
    var score = total ? Math.round(correct / total * 100) : 0;
    var message = score === 100 ? '太棒了！全对！' : score >= 80 ? '很不错！' : '继续加油！';
    return { score: score, total: total, correct: correct, message: message, results: results, correctAnswers: correctAnswers };
  }

  /** 选项点击处理（choice 题型，写入隐藏 input） */
  function pickOpt(el) {
    var card = el.parentNode && el.parentNode.parentNode;
    if (!card) return;
    var opts = card.querySelectorAll('.opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove('chosen');
      opts[i].style.borderColor = '#e3e9f2';
      opts[i].style.background = '#fff';
      opts[i].style.color = '#27324a';
    }
    el.classList.add('chosen');
    el.style.borderColor = '#5b8def';
    el.style.background = '#5b8def';
    el.style.color = '#fff';
    var inp = card.querySelector('input[data-index]');
    if (inp) inp.value = el.getAttribute('data-val') || el.textContent;
  }
  global.__pickOpt = pickOpt;

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
        else {
          var ua = answers ? answers[i] : undefined;
          var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
          ok = normalizeAns(ua) === normalizeAns(ans);
        }
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
        throw e;
      }
      // 规范化：缺 render 的题用通用卡片兜底
      questions = questions.map(function (q, i) {
        if (q && typeof q.render !== 'function' && q.answer != null) {
          q.render = function (idx) { return renderCard(q, idx); };
        }
        return q;
      });
      // 知识点声明校验：声明的知识点需在知识库中登记
      if (config.knowledgePoints && _kb && subject === 'math' && opts.grade) {
        var g = _kb.getGrade(opts.grade);
        if (g) {
          var entryById = {};
          g.entries.forEach(function (e) { entryById[e.id] = true; entryById[e.name] = true; });
          var missing = (config.knowledgePoints || []).filter(function (kp) { return !entryById[kp]; });
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

    return plugin;
  }

  /** 浏览器内加载插件后，自动输出一次当前年级知识点覆盖提示（每页仅一次） */
  function _maybeReportCoverage(cfg) {
    if (typeof global === 'undefined' || !global.window) return; // 仅浏览器
    if (global.__kbCoverageShown) return;
    if (!global.PLUGIN_REGISTRY || !global.KnowledgeBank) return;
    if (!cfg) return;
    global.__kbCoverageShown = true;
    reportCoverage((cfg.subject) || 'math', ((cfg.grades) || [1])[0] || 1);
  }

  /**
   * 知识点覆盖提示（终端/浏览器通用）。
   * 基于注册表中实际存在的插件集合，输出「已覆盖 X/Y，建议下一个开发 Z」。
   * @param {string} subject 科目
   * @param {number} grade 年级
   * @param {Array} [registry] 注册表，缺省读取 global.PLUGIN_REGISTRY
   * @returns {Object|void} 覆盖数据（无知识库时返回 undefined）
   */
  function reportCoverage(subject, grade, registry) {
    var KB = (typeof global.KnowledgeBank !== 'undefined') ? global.KnowledgeBank : null;
    if (!KB) { if (global.console) console.warn('[coverage] KnowledgeBank 未加载，跳过覆盖统计'); return; }
    if (subject !== 'math') {
      if (global.console) console.info('[coverage] ' + subject + ' 科目暂无知识点库，跳过覆盖统计');
      return;
    }
    var g = KB.getGrade(grade);
    if (!g) { if (global.console) console.warn('[coverage] 无 ' + grade + ' 年级知识库数据'); return; }
    var reg = registry || (typeof global.PLUGIN_REGISTRY !== 'undefined' ? global.PLUGIN_REGISTRY : null);
    var cov = KB.coverageFromRegistry('math', grade, reg);
    var next = cov.next ? (cov.next.name + '（建议开发插件：' + cov.next.pluginId + '）') : '已全部覆盖 🎉';
    var missNames = cov.missing.map(function (e) { return e.name; }).join('、') || '无';
    var line = '【知识点覆盖】' + grade + '年级·数学：已覆盖 ' + cov.covered + '/' + cov.total +
      '（' + cov.ratio + '%）' + (cov.missing.length ? '，缺失：' + missNames : '，全部覆盖') +
      '；建议下一个开发：' + next;
    if (global.console) console.info(line);
    return cov;
  }

  // ============ 页面控制器 ============

  var PAGE_CONTROLLER = {
    math: [
      { id: 'mathPractice', route: 'mathPractice', icon: '🔢', label: '口算练习' },
      { id: 'mathWord', route: 'mathWord', icon: '📝', label: '应用题' },
      { id: 'mathMakeTen', route: 'mathMakeTen', icon: '🧩', label: '凑十法', grades: [1] },
      { id: 'mathShapes', route: 'mathShapes', icon: '🔷', label: '图形练习', grades: [1] },
      { id: 'mathComprehensive', route: 'mathComprehensive', icon: '🧩', label: '综合练习' }
    ],
    chinese: [
      { id: 'pinyinPractice', route: 'pinyinPractice', icon: '🔤', label: '拼音练习' },
      { id: 'pinyinToChar', route: 'pinyinToChar', icon: '✏️', label: '看拼音写字', grades: [1] },
      { id: 'comprehensive', route: 'comprehensive', icon: '🧩', label: '综合练习', grades: [1] }
    ],
    english: [
      { id: 'englishAlphabet', route: 'englishAlphabet', icon: '🔠', label: '字母练习' }
    ]
  };

  /** 初始化页面控制器 */
  function initPageController(pageId, subject) {
    var items = PAGE_CONTROLLER[subject];
    if (!items || items.length <= 1) return;

    var grade = currentGrade();
    items = items.filter(function(item) {
      if (!item.grades) return true;
      return item.grades.indexOf(grade) !== -1;
    });
    if (items.length <= 1) return;

    var html = '<nav class="page-controller"><div class="pc-inner">';
    items.forEach(function(item) {
      var isActive = item.id === pageId ? ' active' : '';
      var href = buildLink(ROUTES[item.route]);
      html += '<a href="' + href + '" class="pc-item' + isActive + '">';
      html += '<span class="pc-icon">' + item.icon + '</span>';
      html += '<span class="pc-label">' + item.label + '</span>';
      html += '</a>';
    });
    html += '</div></nav>';

    var container = global.document.querySelector('.container') || global.document.querySelector('.wrapper') || global.document.querySelector('.wrap') || global.document.body;
    container.insertAdjacentHTML('afterbegin', html);
    global.document.body.classList.add('has-page-controller');
  }

  // ============ 插件脚本加载器 PluginLoader ============
  // 统一所有页面/插件的脚本加载，提供：
  //  - scriptCache：同 url 只请求一次（避免重复请求，Promise 复用）
  //  - pluginCache：已加载的插件对象按 id 缓存（避免重复注入）
  //  - 竞态安全：每个脚本 onload 时立即抓取 window.__currentPlugin，
  //    配合 async=false 保证多脚本按追加顺序执行，解决「多插件共用全局被覆盖」问题
  //  - deps 依赖链：registry 条目的 deps 先于主文件加载
  //  - 5 秒超时：单脚本加载失败不卡死整页
  var PluginLoader = (function () {
    var scriptCache = {};   // url -> Promise（去重，避免重复请求）
    var pluginCache = {};   // id  -> plugin object（已加载插件对象）
    var META = {};          // url -> 该脚本 onload 时捕获的 window.__currentPlugin
    var TIMEOUT = 5000;

    // 脚本 onload 时立即抓取刚注入的插件元数据（此时 window.__currentPlugin 即本脚本所设）
    function capture(url) {
      var meta = global.__currentPlugin || null;
      META[url] = meta;
      return meta;
    }

    function loadScript(src) {
      if (scriptCache[src]) return scriptCache[src];
      var p = new Promise(function (resolve, reject) {
        if (typeof global.document === 'undefined') { resolve(null); return; } // Node 环境（CLI/测试）
        var s = global.document.createElement('script');
        s.src = src;
        s.async = false; // 保证按追加顺序执行，配合 onload 抓取 __currentPlugin 无竞态
        var done = false;
        var timer = setTimeout(function () {
          if (done) return; done = true;
          reject(new Error('脚本加载超时（5 秒）：' + src));
        }, TIMEOUT);
        s.onload = function () {
          if (done) return; done = true; clearTimeout(timer);
          resolve(capture(src));
        };
        s.onerror = function () {
          if (done) return; done = true; clearTimeout(timer);
          reject(new Error('脚本加载失败：' + src));
        };
        global.document.head.appendChild(s);
      });
      scriptCache[src] = p;
      return p;
    }

    function loadPlugin(record) {
      if (!record || !record.id) return Promise.reject(new Error('loadPlugin: 缺少 registry 条目 id'));
      if (pluginCache[record.id]) return Promise.resolve(pluginCache[record.id]);
      var src = record.file || ('plugins/' + record.id + '.js');
      var chain = Promise.resolve();
      (record.deps || []).forEach(function (dep) {
        chain = chain.then(function () { return loadScript(dep); });
      });
      return chain.then(function () {
        return loadScript(src).then(function (meta) {
          var p = meta || global.__currentPlugin || null;
          if (!p || !p.generate || !p.render || !p.check) {
            throw new Error('插件接口不兼容（需要 generate/render/check）：' + src);
          }
          pluginCache[record.id] = p;
          global.__currentPlugin = p; // 同步全局，兼容既有消费方
          return p;
        });
      });
    }

    // 加载某学科某年级的全部插件，返回插件对象数组（按年级过滤）
    function loadSubjectPlugins(subject, grade) {
      var reg = (typeof global.PLUGIN_REGISTRY !== 'undefined') ? global.PLUGIN_REGISTRY : [];
      var list = reg.filter(function (r) { return r.subject === subject; });
      return Promise.all(list.map(function (r) {
        return loadPlugin(r).then(function (p) {
          if (!p) return null;
          if (grade != null && p.grades && p.grades.indexOf(Number(grade)) === -1) return null;
          return p;
        });
      })).then(function (arr) { return arr.filter(Boolean); });
    }

    // 预热：不等待，提前请求脚本（减少点击延迟；配合 Service Worker 跨页复用缓存）
    function prefetch(records) {
      (records || []).forEach(function (r) {
        if (!r) return;
        if (r.file) loadScript(r.file);
        else if (r.id) loadPlugin(r);
      });
    }

    function getCached(id) { return pluginCache[id] || null; }
    function getSubjectCached(subject) {
      var reg = (typeof global.PLUGIN_REGISTRY !== 'undefined') ? global.PLUGIN_REGISTRY : [];
      return reg.filter(function (r) { return r.subject === subject && pluginCache[r.id]; })
                .map(function (r) { return pluginCache[r.id]; });
    }
    function reset() { scriptCache = {}; pluginCache = {}; META = {}; }

    return {
      TIMEOUT: TIMEOUT,
      loadScript: loadScript,
      loadPlugin: loadPlugin,
      loadSubjectPlugins: loadSubjectPlugins,
      prefetch: prefetch,
      getCached: getCached,
      getSubjectCached: getSubjectCached,
      reset: reset
    };
  })();

  // ============ Service Worker 离线缓存注册（浏览器 + http/https） ============
  function registerServiceWorker() {
    try {
      if (typeof global.navigator === 'undefined' || !('serviceWorker' in global.navigator)) return;
      if (!global.location || global.location.protocol.indexOf('http') !== 0) return; // file:// 不支持 SW
      global.addEventListener('load', function () {
        global.navigator.serviceWorker.register('./sw.js').catch(function () { /* 忽略注册失败 */ });
      });
    } catch (e) { /* 忽略 */ }
  }

  // ============ 导出：App（站点） ============
  global.App = {
    GRADE_NAMES: GRADE_NAMES,
    SUBJECT_NAMES: SUBJECT_NAMES,
    ROUTES: ROUTES,
    getGradeParam: getGradeParam,
    getGradeName: getGradeName,
    currentGrade: currentGrade,
    buildLink: buildLink,
    buildPluginLink: buildPluginLink,
    navigateTo: navigateTo,
    randInt: randInt,
    shuffle: shuffle,
    normPY: normPY,
    normHZ: normHZ,
    rand: rand,
    TONE_MAP: TONE_MAP,
    diffLevel: diffLevel,
    diffScale: diffScale,
    diffMax: diffMax,
    initPageController: initPageController,
    PluginLoader: PluginLoader,
    registerServiceWorker: registerServiceWorker
  };

  // 浏览器环境下自动注册 Service Worker（离线可用 + 跨页复用插件缓存，减少点击延迟）
  if (typeof window !== 'undefined' && typeof global.navigator !== 'undefined') {
    registerServiceWorker();
  }

  // ============ 导出：PluginUtil（插件工具，Node 端默认导出） ============
  var util = {
    randInt: randInt,
    shuffle: shuffle,
    rand: rand,
    normPY: normPY,
    normHZ: normHZ,
    TONE_MAP: TONE_MAP,
    diffLevel: diffLevel,
    diffScale: diffScale,
    diffMax: diffMax,
    // 插件工厂与开发期覆盖提示
    createPlugin: createPlugin,
    reportCoverage: reportCoverage
  };
  global.PluginUtil = util;

  if (typeof module !== 'undefined' && module.exports) module.exports = util;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));