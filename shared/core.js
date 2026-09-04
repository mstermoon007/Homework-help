/**
 * shared/core.js — 运行时核心（任务 3.2 拆分 · L0 运行时核心 + L1 布局/覆盖）
 *
 * 站点常量 / 路由 / 年级参数 / 随机·标准化工具 / 灵活列数布局 / 知识点覆盖。
 * 以「增量挂载」方式把导出挂到 window.PluginUtil / window.App（浏览器）与 globalThis（Node），
 * 使跨模块裸调用（如 render.js 调 defaultQCheck）经全局对象解析，避免循环依赖。
 *
 * 由 shared/common.js（聚合出口）按需加载：
 *   浏览器：common.js 经 document.write 注入本文件；Node：common.js 经 require 加载本文件。
 */
(function (global) {
  'use strict';

  // ============ [L0 运行时核心 · Runtime Core] ============

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


  // ============ 声调映射（站点 + 插件共用） ============
  var TONE_MAP = {
    'ā':'a','á':'a','ǎ':'a','à':'a',
    'ō':'o','ó':'o','ǒ':'o','ò':'o',
    'ē':'e','é':'e','ě':'e','è':'e',
    'ī':'i','í':'i','ǐ':'i','ì':'i',
    'ū':'u','ú':'u','ǔ':'u','ù':'u',
    'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü'
  };

  /** 安全浮点随机 [0,1)（crypto 53 位精度，全程不使用 Math.random）
   *  组合两个 32 位随机整数成 53 位整数为 [0, 2^53-1]，再除以 2^53 得到均匀分布浮点。 */
  function randFloat() {
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
      throw new Error('randFloat 需要 crypto.getRandomValues（运行环境未提供）');
    }
    var buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    var high = buf[0] & 0x1FFFFF; // 低 21 位
    var low = buf[1];            // 低 32 位
    var int53 = high * 0x100000000 + low; // [0, 2^53 - 1]
    return int53 / 9007199254740992;       // 2^53，结果 ∈ [0, 1)
  }

  /** 增强版随机整数 [min, max]（crypto 优先，全程不使用 Math.random）
   *  @param {function():number} [rng] 可选注入随机源，返回 [0,1) 浮点（用于测试/确定性场景） */
  function randInt(min, max, rng) {
    var range = max - min + 1;
    if (typeof rng === 'function') {
      return min + Math.floor(rng() * range);
    }
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    // 超大整数区间（> 2^32）：回退到 53 位精度浮点（仍走 crypto）
    return min + Math.floor(randFloat() * range);
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

  // ============ 公共题目池（PoolCache：跨调用连续发牌、Fisher-Yates 洗牌、不重复直至穷举） ============

  /** 全局池缓存：key → pool 对象 */
  var _poolRegistry = {};

  /**
   * 创建/获取公共题目池。
   * @param {string} key 唯一键（如 'plugin-id:type'）
   * @param {Function} buildFn 构建函数，返回完整题目数组（仅首次调用）
   * @returns {{take: function(number):Array, size: function():number}} 池对象
   */
  function createPoolCache(key, buildFn) {
    if (_poolRegistry[key]) return _poolRegistry[key];
    var pool = (typeof buildFn === 'function') ? (buildFn() || []) : [];
    var cursor = 0;
    var shuffled = shuffle(pool);
    return _poolRegistry[key] = {
      take: function (n) {
        var out = [];
        n = n || 1;
        while (out.length < n) {
          if (cursor >= shuffled.length) { shuffled = shuffle(pool); cursor = 0; }
          out.push(shuffled[cursor++]);
        }
        return out;
      },
      size: function () { return pool.length; }
    };
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
    // findGrade(subject, grade) 双参；subject 在本函数入口已确认是 'math'
    var g = KB.findGrade ? KB.findGrade('math', grade) : null;
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

  // ============ [L1 布局 · 灵活列数计算] ============
  // 预览(practice.html)与打印(print.js)共用的唯一列数算法来源，避免双份代码漂移。
  // 原则：仅用「题目本身」(算式/问句)决定布局，hint 是辅助信息、自动换行不撑宽。
  //   ① calcOptimalCols → estimateCardWidth 算每张卡最小宽度 → 决定网格几列
  //   ② fitColumns      → renderLen 度题目文本长度       → 决定单题跨几列
  //   ③ 预览用 set 直接计算；打印端无 set，改用 gridColumnsFromDom / applySpanning 从 DOM 估算（同算法）
  var Layout = (function () {
    var GAP = 12;             // 网格列间隙(px)
    var CN_W = 14, EN_W = 9;  // 中文字宽 / 英文数字字宽(px @96dpi)

    /** 取题目核心文本（仅算式/问句，不含 hint/input/序号） */
    function coreText(q) {
      return String(q.q || q.text || q.question || '').trim();
    }

    /** 度量题目核心文本长度（用于跨列判定；图形/多输入额外占宽） */
    function renderLen(q, i) {
      var txt = coreText(q);
      var score = txt.length;
      try {
        var h = (typeof q.render === 'function') ? q.render(i) : '';
        if (h.indexOf('<svg') !== -1) score += 8;
        if (h.indexOf('combine-inp') !== -1) score += 8;
        if (h.indexOf('scene-box') !== -1) score += 10;
      } catch (e) { /* ignore */ }
      return score;
    }

    /** 估算单卡最小渲染宽度(px)：仅核心文本 + 输入框 + 图形；hint 不参与宽度决策 */
    function estimateCardWidth(q, idx) {
      var w = 0;
      var txt = coreText(q);
      var cn = (txt.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
      var en = txt.length - cn;
      w += cn * CN_W + en * EN_W;
      try {
        var h = (typeof q.render === 'function') ? q.render(idx) : '';
        if (h.indexOf('combine-inp') !== -1) w += 96 * 3;
        else if (q.inputCount && q.inputCount > 1) w += 96 * q.inputCount;
        else if (q.type === 'multi' || (q.answer && Array.isArray(q.answer))) w += 96 * 2;
        else w += 96;
        if (h.indexOf('<svg') !== -1 || h.indexOf('<canvas') !== -1 || h.indexOf('scene-box') !== -1) w += 120;
      } catch (e) { w += 96; }
      w += 32 + 16; // 卡片内边距 + 安全边距
      return Math.max(w, 140);
    }

    /** 动态最优列数：set.meta.columns 优先(固定模式)，否则按中位数卡宽计算 [1,4] */
    function calcOptimalCols(set, availWidth) {
      var qs = set.questions;
      if (!qs || !qs.length) return 3;
      if (set.meta && set.meta.columns) return set.meta.columns;
      var widths = qs.map(function (q, i) { return estimateCardWidth(q, i); });
      widths.sort(function (a, b) { return a - b; });
      var medianW = widths[Math.floor(widths.length / 2)];
      var colNeed = medianW + GAP;
      var rawCols = Math.floor((availWidth + GAP) / colNeed);
      return Math.max(1, Math.min(4, rawCols));
    }

    /** 预览/打印通用：设网格列数 + 按长度跨列 + 卡片撑满列宽。匹配所有网格容器类名。 */
    function fitColumns(container, set) {
      var qs = set.questions || [];
      var fixed = set.meta && set.meta.columns;
      var base = fixed || calcOptimalCols(set, (container && container.offsetWidth) || (typeof window !== 'undefined' ? window.innerWidth - 40 : 1000));
      container.querySelectorAll('.questions-grid, .q-grid, .comprehensive-grid').forEach(function (grid) {
        grid.style.gridTemplateColumns = 'repeat(' + base + ', minmax(0, 1fr))';
        grid.style.gridAutoFlow = 'row dense';
        var kids = grid.children;
        for (var i = 0; i < kids.length; i++) {
          var item = kids[i];
          if (fixed) { item.style.gridColumn = 'span 1'; item.style.justifySelf = 'stretch'; continue; }
          var idx = item.getAttribute('data-index');
          var L = 0;
          if (idx !== null && qs[+idx]) {
            L = renderLen(qs[+idx], +idx);
          } else {
            var inner = item.querySelector('[data-index]');
            if (inner && qs[+inner.getAttribute('data-index')]) {
              L = renderLen(qs[+inner.getAttribute('data-index')], +inner.getAttribute('data-index'));
              if (item.querySelector('.q-badge')) L += 12;
            }
          }
          if (L >= 50) item.style.gridColumn = '1 / -1';
          else if (L >= 26) item.style.gridColumn = 'span ' + Math.min(2, base);
          else item.style.gridColumn = 'span 1';
          item.style.justifySelf = 'stretch';
        }
      });
    }

    /** 打印端：克隆 DOM 无 question 对象，改从 .question-card 文本估算列数（与 estimateCardWidth 同算法） */
    function gridColumnsFromDom(clone, availWidth) {
      var cards = clone.querySelectorAll('.question-card');
      if (!cards.length) return 3;
      var widths = [];
      for (var wi = 0; wi < cards.length; wi++) {
        var c = cards[wi];
        var t = (c.querySelector('.q-text') ? (c.querySelector('.q-text').textContent || '') : (c.textContent || '')).trim();
        var hintEl = c.querySelector('.q-hint');
        if (hintEl) t = t.replace(hintEl.textContent, '');
        t = t.trim();
        var cn = (t.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
        var en = t.length - cn;
        var cw = cn * CN_W + en * EN_W;
        var inputs = c.querySelectorAll('input:not(.formula-inp)');
        cw += Math.max(inputs.length, 1) * 96;
        if (c.querySelector('.scene-box, svg, canvas, img')) cw += 120;
        cw += 32 + 16;
        widths.push(Math.max(cw, 140));
      }
      widths.sort(function (a, b) { return a - b; });
      var medianW = widths[Math.floor(widths.length / 2)];
      var rawCols = Math.floor((availWidth + GAP) / (medianW + GAP));
      return Math.max(1, Math.min(4, rawCols));
    }

    /** 打印端：对克隆 DOM 应用与预览一致的 per-card 跨列（从 DOM 文本度量，保证打印/预览排版一致） */
    function applySpanning(clone, base) {
      var cards = clone.querySelectorAll('.question-card');
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var t = (card.querySelector('.q-text') ? (card.querySelector('.q-text').textContent || '') : (card.textContent || '')).trim();
        var hintEl = card.querySelector('.q-hint');
        if (hintEl) t = t.replace(hintEl.textContent, '');
        t = t.trim();
        var L = t.length;
        if (card.querySelector('svg')) L += 8;
        if (card.querySelector('.combine-inp')) L += 8;
        if (card.querySelector('.scene-box')) L += 10;
        if (L >= 50) card.style.gridColumn = '1 / -1';
        else if (L >= 26) card.style.gridColumn = 'span ' + Math.min(2, base);
        else card.style.gridColumn = 'span 1';
        card.style.justifySelf = 'stretch';
      }
    }

    return {
      GAP: GAP,
      coreText: coreText,
      renderLen: renderLen,
      estimateCardWidth: estimateCardWidth,
      calcOptimalCols: calcOptimalCols,
      fitColumns: fitColumns,
      gridColumnsFromDom: gridColumnsFromDom,
      applySpanning: applySpanning
    };
  })();

  // ============ 科目工具按需加载（shared/subject-utils.js） ============
  // Node：同步 require 并挂全局；浏览器：异步注入脚本（失败仅告警，
  // normPY/normHZ 等内置兜底实现，功能不受影响）。
  (function ensureSubjectUtils() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        var su = require('./subject-utils.js');
        global.SubjectUtils = su;
        global.ChineseUtil = su.ChineseUtil;
      } catch (e) { /* 静默：别名兜底 */ }
      return;
    }
    var doc = (typeof document !== 'undefined') ? document : null;
    if (doc && !global.SubjectUtils) {
      var s = doc.createElement('script');
      s.src = 'shared/subject-utils.js';
      s.async = true;
      s.onerror = function () {
        if (global.console && global.console.warn) {
          console.warn('[common] subject-utils.js 加载失败，normPY/normHZ 走内置兼容实现');
        }
      };
      doc.head.appendChild(s);
    }
  })();

  // ============ 增量挂载（任务 3.2：跨模块裸调用经全局解析） ============
  global.PluginUtil = global.PluginUtil || {};
  global.App = global.App || {};

  global.TONE_MAP = TONE_MAP;
  // PluginUtil（插件工具）
  global.PluginUtil.randInt = randInt;
  global.PluginUtil.randFloat = randFloat;
  global.PluginUtil.shuffle = shuffle;
  global.PluginUtil.rand = rand;
  global.PluginUtil.normPY = normPY;
  global.PluginUtil.normHZ = normHZ;
  global.PluginUtil.diffLevel = diffLevel;
  global.PluginUtil.diffScale = diffScale;
  global.PluginUtil.diffMax = diffMax;
  global.PluginUtil.normalizeAns = normalizeAns;
  global.PluginUtil.createPoolCache = createPoolCache;
  global.PluginUtil.reportCoverage = reportCoverage;
  global.PluginUtil.layout = Layout;
  // 跨模块裸调用兼容（render.js / check.js 经全局解析）
  global.normalizeAns = normalizeAns;
  global._maybeReportCoverage = _maybeReportCoverage;
  // App（站点）
  global.App.SUBJECT_NAMES = SUBJECT_NAMES;
  global.App.ROUTES = ROUTES;
  global.App.getGradeParam = getGradeParam;
  global.App.getGradeName = getGradeName;
  global.App.currentGrade = currentGrade;
  global.App.buildLink = buildLink;
  global.App.buildPluginLink = buildPluginLink;
  global.App.randInt = randInt;
  global.App.shuffle = shuffle;
  global.App.normPY = normPY;
  global.App.normHZ = normHZ;
  global.App.rand = rand;
  global.App.diffLevel = diffLevel;
  global.App.diffScale = diffScale;
  global.App.diffMax = diffMax;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      GRADE_NAMES: GRADE_NAMES, SUBJECT_NAMES: SUBJECT_NAMES, ROUTES: ROUTES, TONE_MAP: TONE_MAP,
      getGradeParam: getGradeParam, getGradeName: getGradeName, currentGrade: currentGrade,
      buildLink: buildLink, buildPluginLink: buildPluginLink,
      randInt: randInt, shuffle: shuffle, rand: rand,
      diffLevel: diffLevel, diffScale: diffScale, diffMax: diffMax,
      normPY: normPY, normHZ: normHZ, normalizeAns: normalizeAns,
      createPoolCache: createPoolCache, _maybeReportCoverage: _maybeReportCoverage,
      reportCoverage: reportCoverage, Layout: Layout
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
