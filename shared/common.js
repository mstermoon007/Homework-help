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

  // ============ [L0 运行时核心 · Runtime Core] ============
  // 站点常量 / 路由 / 页面控制器 / PluginLoader / ServiceWorker / 自适应难度。
  // 仅依赖全局，不依赖插件渲染细节；统一在文件末尾导出到 window.App。

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

  // ============ [L1 共享渲染与插件工具 · Shared Render & Utils] ============
  // renderCard/renderGrid/computeResult/defaultQCheck/normalizeAns/pickOpt/clockSVG/createPlugin。
  // 供 plugins/*.js 复用，与随机/标准化工具同属「共享能力层」。

  // ============ 插件渲染/批改辅助（供 plugins/*.js 复用） ============

  /** 标准化答案比较（去空格、小写） */
  function normalizeAns(v) {
    return String(v == null ? '' : v).trim().replace(/\s+/g, '').toLowerCase();
  }

  /** 渲染单题卡片。q 形状：{ q, svg, hint, unit, inputType, options, inputCount, answer }
   *
   * 样式类化：默认只输出 class，样式统一在 shared/components.css 的
   * 「题目卡片」段维护（打印/自定义覆盖无需 !important）。
   * opts.inputWidth 显式传入时仍以内联 style 输出宽度（动态值）。
   */

  /** 小题池去重生成：先穷举 builder 产出全量题池，shuffle 后取前 count 题。
   *  池不足 count 时循环取用（允许重复但不连续）。 */
  function poolFill(builder, count) {
    var pool = [], seen = {};
    var maxEnum = 2000;
    for (var i = 0; i < maxEnum; i++) {
      var q = builder();
      if (!q) break;
      var key = (q.q || '') + '|' + JSON.stringify(q.answer || '');
      if (!seen[key]) { seen[key] = 1; pool.push(q); }
    }
    // Fisher-Yates shuffle
    for (var j = pool.length - 1; j > 0; j--) {
      var k2 = randInt(0, j);
      var tmp = pool[j]; pool[j] = pool[k2]; pool[k2] = tmp;
    }
    var out = [];
    while (out.length < count && pool.length) {
      out.push(pool[out.length % pool.length]);
    }
    return out;
  }

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
      '<input type="text" class="formula-inp" data-formula="' + idx + '" placeholder="列式" autocomplete="off"' + st('formula-inp', 'width:120px;') + '>' +
      '<span class="qa-label"' + st('qa-label') + '>答案</span>';
    var inputHtml = '';
    if (q.inputType === 'choice') {
      var optsHtml = '';
      (q.options || []).forEach(function (o) {
        optsHtml += '<span class="opt" data-val="' + String(o).replace(/"/g, '&quot;') + '" onclick="window.__pickOpt(this)"' + st('opt') + '>' + o + '</span>';
      });
      inputHtml = '<div class="options"' + st('options') + '>' + optsHtml + '</div>' +
        '<input type="hidden" data-index="' + idx + '">';
    } else if (q.inputType === 'multi') {
      var count = q.inputCount || (Array.isArray(q.answer) ? q.answer.length : 1);
      var inputs = '';
      for (var j = 0; j < count; j++) {
        inputs += '<input type="text" class="answer-inp" data-idx="' + idx + '" data-field="' + j + '" placeholder="?" autocomplete="off"' + st('answer-inp', inpWStyle) + '>';
      }
      inputHtml = '<div class="input-group"' + st('input-group') + '>' + inputs + '</div>';
    } else {
      inputHtml = '<div class="input-group"' + st('input-group') + '>' +
        '<input type="text" class="answer-inp" data-index="' + idx + '" placeholder="?" autocomplete="off"' + st('answer-inp', inpWStyle) + '>' +
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
    return '<div class="question-card" data-index="' + idx + '"' + st('question-card') + '>' +
      qHeaderHtml +
      badgeHtml +
      svgHtml +
      qaRowHtml +
      hintHtml +
      '<div class="feedback"' + st('feedback') + '></div>' +
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

  /** 缺省单题判定（createPlugin 与综合练习共用）：
   *  - inputType 'multi'：按 answers['i:j'] 分字段比较（数组答案；字符串答案按 、/，/, 拆分）
   *  - 其余（text/choice）：整串比较（数组答案拼接后比较） */
  function defaultQCheck(q, answers, i) {
    if (q.inputType === 'multi') {
      var parts = Array.isArray(q.answer) ? q.answer : String(q.answer).split(/[、,，]/);
      for (var j = 0; j < parts.length; j++) {
        var uv = answers ? answers[i + ':' + j] : undefined;
        if (normalizeAns(uv) !== normalizeAns(parts[j])) return false;
      }
      return true;
    }
    var ua = answers ? answers[i] : undefined;
    var ans = Array.isArray(q.answer) ? q.answer.join('') : q.answer;
    return normalizeAns(ua) === normalizeAns(ans);
  }

  /** 通用批改：返回 { score,total,correct,message,results,correctAnswers } */
  function computeResult(questions, userAnswers, opts) {
    opts = opts || {};
    var checkFn = opts.checkFn || defaultQCheck;
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

  /** 选项点击处理（choice 题型，写入隐藏 input）。选中态由 components.css 的 .opt.chosen 呈现 */
  function pickOpt(el) {
    var card = el.parentNode && el.parentNode.parentNode;
    if (!card) return;
    var opts = card.querySelectorAll('.opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.remove('chosen');
    }
    el.classList.add('chosen');
    var inp = card.querySelector('input[data-index]');
    if (inp) inp.value = el.getAttribute('data-val') || el.textContent;
  }
  global.__pickOpt = pickOpt;

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
  global.clockSVG = clockSVG;

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
    var g = KB.findGrade ? KB.findGrade(grade) : null;
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
      var p;
      if (typeof global.document === 'undefined') {
        // Node 环境（CLI/测试）：同步 require 回退。
        // 本模块位于 shared/，站点根相对路径（plugins/xxx.js、根级文件）需回退一级。
        if (typeof require === 'undefined') {
          p = Promise.resolve(null);
        } else {
          p = new Promise(function (resolve, reject) {
            try {
              var rel = String(src).replace(/^\.\//, '');
              if (rel.indexOf('../') !== 0) rel = '../' + rel; // 站点根相对 → shared/ 的上一级
              var mod = require(rel);
              var meta = (mod && mod.generate) ? mod : (global.__currentPlugin || null);
              if (meta) global.__currentPlugin = meta;
              META[src] = meta;
              resolve(meta);
            } catch (e) {
              reject(e);
            }
          });
        }
      } else {
        p = new Promise(function (resolve, reject) {
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
      }
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

    function reset() { scriptCache = {}; pluginCache = {}; META = {}; }

    return {
      TIMEOUT: TIMEOUT,
      loadScript: loadScript,
      loadPlugin: loadPlugin,
      loadSubjectPlugins: loadSubjectPlugins,
      prefetch: prefetch,
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

  // ============ 自适应难度 v2（localStorage 历史：知识点粒度 + 难度加权 + EMA） ============
  // 相对 v1 的升级：
  //   - 存储版本 hw_adaptive_v2：值由会话数组升级为 { ema, sessions }，首次读取自动迁移并清除 v1
  //   - 主键扩展为 (subject, grade, pluginId, knowledgePointId?)；
  //     凡携带 knowledgePointId 的会话均建立 KP 级桶（总量 MAX_KEYS 上限防膨胀），其余插件忽略该上下文
  //   - 会话可携带每题难度与对错标记 → 难度加权正确率 effectiveRate = Σ答对难度 / Σ全部难度
  //   - EMA 平滑：emaRate = 0.4 × 本次正确率 + 0.6 × 上次 emaRate
  //   - 调整规则基于 (emaRate, lastRate)：≥0.85且全对→+2；≥0.8→+1；≤0.5→−2；≤0.65→−1
  var Adaptive = (function () {
    var KEY = 'hw_adaptive_v2';
    var OLD_KEY = 'hw_adaptive_v1';
    var WINDOW = 5;       // 取最近 N 次练习计算
    var MEMORY_CAP = 10;  // 每键最多保留 N 次历史
    var MAX_KEYS = 400;   // 全库键数上限（知识点级键的膨胀保护）
    var EMA_ALPHA = 0.4;
    var memStore = {};    // localStorage 不可用或不持久时的内存兜底
    // 探测 localStorage 是否真正可用（能写入并读回），否则退化为内存存储
    var store = null;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('__hw_probe__', '1');
        var probeOk = localStorage.getItem('__hw_probe__') === '1';
        localStorage.removeItem('__hw_probe__');
        if (probeOk) store = localStorage;
      }
    } catch (e) { store = null; }

    var migrated = false;
    /** v1 → v2 迁移：数组包装为 { ema:null, sessions }，先落盘 v2 再移除旧键（防中途丢历史） */
    function migrate(data) {
      if (migrated || !store || !data) return data;
      migrated = true;
      try {
        var oldRaw = store.getItem(OLD_KEY);
        if (!oldRaw) return data;
        var old = JSON.parse(oldRaw);
        var converted = false;
        for (var k in old) {
          if (Object.prototype.hasOwnProperty.call(old, k) && !data[k]) {
            var arr = Array.isArray(old[k]) ? old[k] : [];
            data[k] = { ema: null, sessions: arr.slice(-MEMORY_CAP) };
            converted = true;
          }
        }
        if (converted) {
          try { store.setItem(KEY, JSON.stringify(data)); } catch (e2) { /* 落盘失败则保留旧键兜底 */ return data; }
          store.removeItem(OLD_KEY);
        }
      } catch (e) { /* 迁移失败不阻塞，按空库继续 */ }
      return data;
    }

    function load() {
      var d;
      try {
        if (store) { var raw = store.getItem(KEY); d = raw ? JSON.parse(raw) : {}; }
        else d = memStore.data || {};
      } catch (e) { d = memStore.data || {}; }
      return migrate(d) || {};
    }
    function save(data) {
      memStore.data = data;
      try { if (store) store.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 内存兜底 */ }
    }

    function keyOf(subject, grade, pluginId, kpId) {
      return kpId ? [subject, grade, pluginId, kpId].join(':')
                  : [subject, grade, pluginId].join(':');
    }
    /** 取规范桶：缺失/形状不符时返回空桶 */
    function bucketOf(data, k) {
      var b = data[k];
      if (!b || typeof b !== 'object' || !Array.isArray(b.sessions)) b = { ema: null, sessions: [] };
      return b;
    }

    /**
     * 记录一次练习结果。
     * @param {number} correct 答对题数
     * @param {number} total   总题数
     * @param {Object} [context] 可选上下文：
     *   - knowledgePointId {string}  知识点粒度记录（仅 competition/comprehensive 插件生效）
     *   - questionDifficulties {number[]} 每题难度（需与 total 等长）
     *   - correctFlags {boolean[]}       每题对错（与 questionDifficulties 平行）
     *   二者齐备才启用加权统计；否则退化为普通正确率（EMA 同样使用普通率）。
     */
    function record(subject, grade, pluginId, correct, total, context) {
      if (!(total > 0)) return;
      context = context || {};
      var data = load();
      // 知识点级记录：凡 context 提供 knowledgePointId 即记录（步骤5 起全插件启用，
      // 综合练习需按知识点统计掌握度）；膨胀防护由 MAX_KEYS 总量上限承担
      var wantKp = !!context.knowledgePointId;
      var k = keyOf(subject, grade, pluginId, wantKp ? context.knowledgePointId : undefined);
      if (!data[k] && Object.keys(data).length >= MAX_KEYS) return; // 容量保护
      var b = bucketOf(data, k);

      var diffs = Array.isArray(context.questionDifficulties) ? context.questionDifficulties : null;
      var flags = Array.isArray(context.correctFlags) ? context.correctFlags : null;
      var rate = correct / total;
      var sess = { c: correct, t: total, ts: Date.now() };

      if (diffs && flags && diffs.length === total && flags.length === total) {
        var wOk = 0, wAll = 0;
        for (var i = 0; i < total; i++) {
          var dv = Number(diffs[i]);
          if (!isFinite(dv)) dv = 1;
          wAll += dv;
          if (flags[i]) wOk += dv;
        }
        if (wAll > 0) {
          sess.diffs = diffs.map(function (x) { return Number(x); });
          sess.flags = flags.map(function (f) { return f ? 1 : 0; });
          sess.wOk = wOk;
          sess.wAll = wAll;
          rate = wOk / wAll;
        }
      }

      b.ema = (b.ema == null) ? rate : (EMA_ALPHA * rate + 0.6 * b.ema);
      b.sessions.push(sess);
      if (b.sessions.length > MEMORY_CAP) b.sessions = b.sessions.slice(-MEMORY_CAP);
      data[k] = b;
      save(data);
    }

    /** 汇总一个桶：{rate(难度加权), emaRate, lastRate, sessions} */
    function summarize(b) {
      var arr = b.sessions;
      if (!arr.length) return { rate: null, emaRate: null, lastRate: null, sessions: 0 };
      var recent = arr.slice(-WINDOW);
      var c = 0, t = 0, wOk = 0, wAll = 0, hasW = false;
      recent.forEach(function (x) {
        c += x.c; t += x.t;
        if (x.wAll > 0) { hasW = true; wOk += x.wOk; wAll += x.wAll; }
      });
      var eff = (hasW && wAll > 0) ? (wOk / wAll) : (t ? c / t : 0);
      var last = arr[arr.length - 1];
      var lastRate = (last.wAll > 0) ? (last.wOk / last.wAll) : (last.t ? last.c / last.t : 0);
      return { rate: eff, emaRate: (b.ema != null) ? b.ema : eff, lastRate: lastRate, sessions: arr.length };
    }

    /** 计算调整量：{ difficultyDelta:-2..+2, typeBias, rate, emaRate, lastRate, sessions } */
    function computeAdjustment(subject, grade, pluginId, kpId) {
      var b = bucketOf(load(), keyOf(subject, grade, pluginId, kpId));
      var s = summarize(b);
      if (!s.sessions) return { difficultyDelta: 0, typeBias: null, rate: null, emaRate: null, lastRate: null, sessions: 0 };
      var delta = 0, bias = null;
      if (s.emaRate >= 0.85 && s.lastRate >= 0.999) { delta = 2; bias = 'hard'; }
      else if (s.emaRate >= 0.8) { delta = 1; bias = 'hard'; }
      else if (s.emaRate <= 0.5) { delta = -2; bias = 'easy'; }
      else if (s.emaRate <= 0.65) { delta = -1; bias = 'easy'; }
      return { difficultyDelta: delta, typeBias: bias, rate: s.rate, emaRate: s.emaRate, lastRate: s.lastRate, sessions: s.sessions };
    }

    /** 把基础难度叠加调整量并钳制到 1..10 */
    function adjustedDifficulty(base, delta) {
      var n = (Number(base) || 3) + (delta || 0);
      if (!isFinite(n)) n = 3;
      if (n < 1) n = 1;
      if (n > 10) n = 10;
      return Math.round(n);
    }

    /** 人类可读提示文案（用于练习页提示条） */
    function hint(subject, grade, pluginId) {
      var a = computeAdjustment(subject, grade, pluginId);
      if (a.difficultyDelta > 0) return '已根据你的表现提升难度（' + (a.rate != null ? Math.round(a.rate * 100) + '% 正确率' : '自适应') + '）';
      if (a.difficultyDelta < 0) return '已降低难度，多练基础（' + (a.rate != null ? Math.round(a.rate * 100) + '% 正确率' : '自适应') + '）';
      return '';
    }

    /**
     * 前置依赖感知（供后续步骤使用）：查询某知识点全部前置的历史掌握情况。
     * @returns {{ready:boolean|null, items:Array}|null} 无知识库/无前置返回 null；
     *   ready=true 表示所有前置均有练习数据且难度加权正确率 ≥0.7。
     */
    function getPrerequisiteStatus(knowledgePointId) {
      var KB = global.KnowledgeBank;
      if (!KB || !knowledgePointId || !KB.forEach) return null;
      var READY_LINE = 0.7;
      function findById(id) {
        var hit = null;
        KB.forEach(function (entry) {
          (entry.modules || []).forEach(function (mod) {
            (mod.knowledgePoints || []).forEach(function (kp) {
              if (kp.id === id && !hit) hit = { kp: kp, grade: entry.grade };
            });
          });
        });
        return hit;
      }
      var self = findById(knowledgePointId);
      if (!self) return null;
      var pres = Array.isArray(self.kp.prerequisites) ? self.kp.prerequisites : [];
      if (!pres.length) return { ready: null, items: [] };
      var data = load();
      var items = [], allReady = true;
      pres.forEach(function (pid) {
        var info = findById(pid);
        if (!info) { allReady = false; return; }
        var b = bucketOf(data, keyOf('math', info.grade, info.kp.pluginId));
        var s = summarize(b);
        var item = { id: pid, name: info.kp.name, grade: info.grade,
                     sessions: s.sessions, rate: s.rate, emaRate: s.emaRate };
        if (!s.sessions || !(s.rate >= READY_LINE)) allReady = false;
        items.push(item);
      });
      return { ready: allReady, items: items };
    }

    /**
     * 批改后一次性记录（practice.html 调用；混合知识点数据统一入口）：
     *  - 插件级摘要：全部题目聚合成一条会话（含难度加权；未标注难度的题按标准档 3 计权）
     *  - 知识点级分组：按 q.knowledgePointId 分组逐桶记录
     *    （仅 competition/comprehensive 插件会被 v2 门控接受，其余插件自动忽略 KP 部分，
     *     即保持原有插件级记录方式）
     * @param {Array} questions 题目对象数组（可含可选字段 knowledgePointId / difficulty）
     * @param {Array} flags     与 questions 平行的每题对错布尔数组（check().results）
     * @returns {{total:number, correct:number, kpGroups:number}} 实际记录汇总
     */
    function recordSession(subject, grade, pluginId, questions, flags) {
      if (!Array.isArray(questions) || !Array.isArray(flags)) return { total: 0, correct: 0, kpGroups: 0 };
      var n = Math.min(questions.length, flags.length);
      if (!n) return { total: 0, correct: 0, kpGroups: 0 };
      var correct = 0;
      var allD = [], allF = [];
      var groups = {}, kpCount = 0;
      for (var i = 0; i < n; i++) {
        var q = questions[i] || {};
        var okFlag = !!flags[i];
        if (okFlag) correct++;
        var dv = Number(q.difficulty);
        if (!isFinite(dv)) dv = 3;
        allD.push(dv); allF.push(okFlag);
        if (q.knowledgePointId) {
          var g = groups[q.knowledgePointId];
          if (!g) { g = groups[q.knowledgePointId] = { correct: 0, total: 0, diffs: [], flags: [] }; kpCount++; }
          g.total++; g.diffs.push(dv); g.flags.push(okFlag);
          if (okFlag) g.correct++;
        }
      }
      record(subject, grade, pluginId, correct, n, { questionDifficulties: allD, correctFlags: allF });
      Object.keys(groups).forEach(function (kp) {
        var g = groups[kp];
        record(subject, grade, pluginId, g.correct, g.total,
               { knowledgePointId: kp, questionDifficulties: g.diffs, correctFlags: g.flags });
      });
      return { total: n, correct: correct, kpGroups: kpCount };
    }

    /** 清除记忆：给定 subject/grade/pluginId 清单项；全空则清空全部 */
    function reset(subject, grade, pluginId) {
      var data = load();
      if (subject || grade || pluginId) delete data[keyOf(subject, grade, pluginId)];
      else return save({});
      save(data);
    }

    return {
      VERSION: 'hw_adaptive_v2',
      record: record,
      recordSession: recordSession,
      computeAdjustment: computeAdjustment,
      adjustedDifficulty: adjustedDifficulty,
      getPrerequisiteStatus: getPrerequisiteStatus,
      hint: hint,
      reset: reset
    };
  })();

  // ============ [L2 数据与导出 · Exports] ============
  // 将运行时核心(L0)与共享渲染/工具(L1)分别挂到 window.App 与 window.PluginUtil。

  // ============ 导出：App（站点） ============
  global.App = {
    SUBJECT_NAMES: SUBJECT_NAMES,
    ROUTES: ROUTES,
    getGradeParam: getGradeParam,
    getGradeName: getGradeName,
    currentGrade: currentGrade,
    buildLink: buildLink,
    buildPluginLink: buildPluginLink,
    randInt: randInt,
    shuffle: shuffle,
    normPY: normPY,
    normHZ: normHZ,
    rand: rand,
    diffLevel: diffLevel,
    diffScale: diffScale,
    diffMax: diffMax,
    PluginLoader: PluginLoader,
    registerServiceWorker: registerServiceWorker,
    Adaptive: Adaptive
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
    diffLevel: diffLevel,
    diffScale: diffScale,
    diffMax: diffMax,
    // 插件渲染/批改辅助（供 plugins/*.js 复用，降低重复代码）
    renderCard: renderCard,
    renderGrid: renderGrid,
    computeResult: computeResult,
    defaultQCheck: defaultQCheck,
    poolFill: poolFill,
    normalizeAns: normalizeAns,
    pickOpt: pickOpt,
    clockSVG: clockSVG,
    // 插件工厂与开发期覆盖提示
    createPlugin: createPlugin,
    reportCoverage: reportCoverage,
    // 灵活列数计算（预览 + 打印共用单一来源）
    layout: Layout
  };
  global.PluginUtil = util;

  if (typeof module !== 'undefined' && module.exports) module.exports = util;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));