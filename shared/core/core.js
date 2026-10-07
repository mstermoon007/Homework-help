/**
 * shared/core/core.js — 运行时核心（任务 3.2 拆分 · L0 运行时核心 + L1 布局/覆盖）
 *
 * 站点常量 / 路由 / 年级参数 / 随机·标准化工具 / 灵活列数布局 / 知识点覆盖。
 * 以「增量挂载」方式把导出挂到 window.PluginUtil / window.App（浏览器）与 globalThis（Node），
 * 使跨模块裸调用（如 check.js 调 defaultQCheck）经全局对象解析，避免循环依赖。
 *
 * 由 shared/core/common.js（聚合出口）按需加载：
 *   浏览器：common.js 经 document.write 注入本文件；Node：common.js 经 require 加载本文件。
 */
(function (global) {
  'use strict';

  // ============ [L0 运行时核心 · Runtime Core] ============

  // ============ 站点常量 ============
  var GRADE_NAMES = { '1':'一年级','2':'二年级','3':'三年级','4':'四年级','5':'五年级','6':'六年级' };
  var SUBJECT_NAMES = { 'math':'数学' };

  // ============ 路由配置 ============
  var ROUTES = {
    home:       'index.html',
    mathTypes:  'math-types.html',
    mathPractice: 'practice.html?plugin=math-oral',
    mathWord:   'practice.html?plugin=math-word-problems',
    mathMakeTen: 'practice.html?plugin=math-make-ten',
    mathShapes: 'practice.html?plugin=math-shapes',
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

  /**
   * 标准化答案比较：去空格、小写；并归一化有余数除法的余数记号——
   * 「……」「…」「...」「余」统一为「……」，使标准答案 "4……3" 与用户输入
   * "4...3" / "4…3" / "4余3" 同源可比。批改层（check.js/defaultQCheck）与
   * golden 自测（check-golden.js/buildUserAnswers）共用此唯一口径，
   * 不得在调用方各自做 trim/记号替换。
   * 注意：单个小数点（如 3.5）不受影响（正则要求 ≥2 个连续点）。
   */
  function normalizeAns(v) {
    return String(v == null ? '' : v)
      .trim()
      .replace(/\s+/g, '')
      .replace(/(…+|\.{2,}|余)/g, '……')
      .toLowerCase();
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

  // MATH-14 native-only：reportCoverage/_maybeReportCoverage 已随 legacy 插件轨道（PLUGIN_REGISTRY）退役；
  // 覆盖统计由 native Generator 轨道承接（dev/check-core-generators.js：549/549）。

  // P31-02：[L1 布局 · 灵活列数计算] 已物理迁出至 shared/presentation/layout.js
  // （全局 QuestionLayout；预览 practice.html 与打印 print.js 共用唯一排版 SSOT，不留别名）。

  // ============ 科目工具按需加载（shared/catalog/subject-utils.js） ============
  // Node：同步 require 并挂全局；浏览器：异步注入脚本（失败仅告警，功能不受影响）。
  (function ensureSubjectUtils() {
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
      try {
        var su = require('../catalog/subject-utils.js');
        global.SubjectUtils = su;
        global.MathUtil = su.MathUtil;
      } catch (e) { /* 静默：别名兜底 */ }
      return;
    }
    var doc = (typeof document !== 'undefined') ? document : null;
    if (doc && !global.SubjectUtils) {
      var s = doc.createElement('script');
      s.src = 'shared/catalog/subject-utils.js';
      s.async = true;
      s.onerror = function () {
        if (global.console && global.console.warn) {
          console.warn('[common] subject-utils.js 加载失败，功能不受影响');
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
  // 跨模块裸调用兼容（check.js 等经全局解析）
  global.normalizeAns = normalizeAns;
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
      createPoolCache: createPoolCache
    };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
