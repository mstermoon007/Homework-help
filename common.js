/**
 * 共享工具函数与路由
 * 用法：<script src="common.js"></script> 后即可使用 App 全局对象
 */
(function (global) {
  'use strict';

  // ============ 常量 ============
  var GRADE_NAMES = { '1':'一年级','2':'二年级','3':'三年级','4':'四年级','5':'五年级','6':'六年级' };
  var SUBJECT_NAMES = { 'math':'数学', 'chinese':'语文', 'english':'英语' };

  // ============ 路由配置 ============
  var ROUTES = {
    home:       'index.html',
    mathTypes:  'math-types.html',
    chineseTypes: 'chinese-types.html',
    englishTypes: 'english-types.html',
    englishAlphabet: 'english-alphabet.html',
    mathPractice: 'math-practice.html',
    mathWord:   'math-word-problems.html',
    mathMakeTen: 'math-make-ten.html',
    mathShapes: 'math-shapes.html',
    mathUnitConvert: 'math-unit-convert.html',
    mathNumberSense: 'math-number-sense.html',
    mathMeasurement: 'math-measurement.html',
    mathGeometry: 'math-geometry.html',
    pinyinPractice: 'pinyin-practice.html',
    pinyinToChar: 'pinyin-to-char.html',
    comprehensive: 'comprehensive.html',
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

  /** 生成带年级参数的目标链接 */
  function buildLink(path, g) {
    var grade = g !== undefined ? g : currentGrade();
    return path + '?grade=' + encodeURIComponent(grade);
  }

  /** 根据路由名跳转页面（自动带年级参数） */
  function navigateTo(routeName, g) {
    var path = ROUTES[routeName];
    if (!path) return;
    var grade = g !== undefined ? g : currentGrade();
    global.location.href = path + '?grade=' + encodeURIComponent(grade);
  }

  // ============ 工具函数 ============

  /** 声调映射 */
  var TONE_MAP = {
    'ā':'a','á':'a','ǎ':'a','à':'a',
    'ō':'o','ó':'o','ǒ':'o','ò':'o',
    'ē':'e','é':'e','ě':'e','è':'e',
    'ī':'i','í':'i','ǐ':'i','ì':'i',
    'ū':'u','ú':'u','ǔ':'u','ù':'u',
    'ǖ':'ü','ǘ':'ü','ǚ':'ü','ǜ':'ü'
  };

  /** 增强版随机整数 [min, max] */
  function randInt(min, max) {
    var range = max - min + 1;
    if (range <= 0xFFFFFFFF && typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      return min + (arr[0] % range);
    }
    return min + Math.floor(Math.random() * range);
  }

  /** Fisher-Yates 洗牌 */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = randInt(0, i);
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /** 标准化拼音（去声调、去空格、小写） */
  function normPY(s) {
    if (!s) return '';
    return s.toLowerCase()
      .split('').map(function(c) { return TONE_MAP[c] || c; }).join('')
      .replace(/\s+/g, '')
      .replace(/v/g, 'ü')
      .replace(/[:：]/g, '');
  }

  /** 标准化汉字（去空格） */
  function normHZ(s) {
    if (!s) return '';
    return s.replace(/\s+/g, '').trim();
  }

  /** 从数组中随机取一个元素 */
  function rand(arr) {
    return arr[randInt(0, arr.length - 1)];
  }

  // ============ 页面控制器 ============

  var PAGE_CONTROLLER = {
    math: [
      { id: 'mathPractice', route: 'mathPractice', icon: '🔢', label: '口算练习' },
      { id: 'mathWord', route: 'mathWord', icon: '📝', label: '应用题' },
      { id: 'mathMakeTen', route: 'mathMakeTen', icon: '🧩', label: '凑十法', grades: [1] },
      { id: 'mathShapes', route: 'mathShapes', icon: '🔷', label: '图形练习', grades: [1] },
      { id: 'mathUnitConvert', route: 'mathUnitConvert', icon: '⏰', label: '单位换算', grades: [1] },
      { id: 'mathNumberSense', route: 'mathNumberSense', icon: '🔢', label: '数的认识', grades: [2] },
      { id: 'mathMeasurement', route: 'mathMeasurement', icon: '📏', label: '量换算与测量', grades: [2] },
      { id: 'mathGeometry', route: 'mathGeometry', icon: '📐', label: '图形的认识', grades: [2] }
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

    var container = document.querySelector('.container') || document.querySelector('.wrapper') || document.querySelector('.wrap') || document.body;
    container.insertAdjacentHTML('afterbegin', html);
    document.body.classList.add('has-page-controller');
  }

  // ============ 导出 ============
  global.App = {
    GRADE_NAMES: GRADE_NAMES,
    SUBJECT_NAMES: SUBJECT_NAMES,
    ROUTES: ROUTES,
    getGradeParam: getGradeParam,
    getGradeName: getGradeName,
    currentGrade: currentGrade,
    buildLink: buildLink,
    navigateTo: navigateTo,
    randInt: randInt,
    shuffle: shuffle,
    normPY: normPY,
    normHZ: normHZ,
    rand: rand,
    TONE_MAP: TONE_MAP,
    initPageController: initPageController
  };

})(typeof window !== 'undefined' ? window : this);