/**
 * shared/subject-utils.js — 科目专用工具集（任务12）
 *
 * 将科目特有能力从通用 PluginUtil 中分离，减少全局污染与通用层膨胀：
 *   MathUtil      数值范围处理、分数运算、运算符号筛选（数学）
 *   ChineseUtil   拼音归一化、汉字标准化、字形比较（语文；含自 common.js 迁入的 normPY/normHZ 实现）
 *   EnglishUtil   单词大小写、音标处理（英语）
 *
 * 加载与兼容：
 *   - 浏览器：挂载全局 MathUtil / ChineseUtil / EnglishUtil / SubjectUtils；
 *     由 common.js 末尾的按需加载逻辑异步注入（失败时 common 内置兼容实现兜底）。
 *   - Node：require('./subject-utils.js') 即得三工具对象。
 *
 * 依赖：MathUtil 的随机/难度缩放惰性取用 PluginUtil（运行时解析，无加载期循环依赖）。
 */
(function (global) {
  'use strict';

  // ============ MathUtil：数学 ============
  /** 惰性获取 PluginUtil（randInt/diffMax 等统一随机与缩放能力） */
  function PU() {
    if (typeof global.PluginUtil !== 'undefined') return global.PluginUtil;
    if (typeof require !== 'undefined') {
      try { return require('./common.js'); } catch (e) { /* 忽略 */ }
    }
    return null;
  }

  var MathUtil = {
    /** 区间钳制 */
    clamp: function (n, min, max) {
      n = Number(n);
      if (!isFinite(n)) n = min;
      return Math.min(max, Math.max(min, n));
    },

    /**
     * 数值范围处理：按难度等级给出运算数取值区间。
     * @param {number} base 难度 3 时的基准最大值
     * @param {number} level 难度 1-10
     * @param {{minBase?:number}} [opts] 下限基准（默认 1）
     * @returns {{min:number, max:number}}
     */
    rangeByLevel: function (base, level, opts) {
      var pu = PU();
      var max = pu && pu.diffMax ? pu.diffMax(base, level) : Math.round(base * (1 + ((Number(level) || 3) - 3) * 0.2));
      var minBase = (opts && opts.minBase) != null ? opts.minBase : 1;
      return { min: Math.max(minBase, Math.floor(max * 0.2)), max: max };
    },

    // ---- 分数运算 ----
    /** 最大公约数（欧几里得，恒正） */
    gcd: function (a, b) {
      a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
      while (b) { var t = b; b = a % b; a = t; }
      return a || 1;
    },
    /** 最小公倍数 */
    lcm: function (a, b) {
      a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b));
      return (a && b) ? (a / this.gcd(a, b)) * b : 0;
    },
    /** 约分 → {n, d}（d 恒正） */
    reduce: function (n, d) {
      n = Math.round(n); d = Math.round(d);
      if (!d) return { n: 0, d: 1 };
      if (d < 0) { n = -n; d = -d; }
      var g = this.gcd(n, d);
      return { n: n / g, d: d / g };
    },
    /** 通分后按 op 计算：op ∈ {'+','-','*','*':'×','÷'} 归一为 add/sub/mul/div */
    add: function (a, b) {
      var l = this.lcm(a.d, b.d);
      return this.reduce(a.n * (l / a.d) + b.n * (l / b.d), l);
    },
    sub: function (a, b) {
      var l = this.lcm(a.d, b.d);
      return this.reduce(a.n * (l / a.d) - b.n * (l / b.d), l);
    },
    mul: function (a, b) { return this.reduce(a.n * b.n, a.d * b.d); },
    div: function (a, b) {
      if (!b.n) return null; // 除零保护，交由调用方降级
      return this.reduce(a.n * b.d, a.d * b.n);
    },
    /** 展示串：整数返回 'n'，否则 'n/d' */
    format: function (f) {
      f = this.reduce(f.n, f.d);
      return f.d === 1 ? String(f.n) : f.n + '/' + f.d;
    },

    // ---- 运算符号筛选 ----
    ALL: ['+', '-', '×', '÷'],
    /**
     * 按约束筛选可用运算符号。
     * @param {{allowMultDiv?:boolean, allowSub?:boolean, exclude?:string[]}} opts
     * @returns {string[]} 至少包含 '+'；调用方再经 rand 抽取
     */
    filterOperators: function (opts) {
      opts = opts || {};
      var allowMultDiv = opts.allowMultDiv === true;
      var out = ['+'];
      if (opts.allowSub !== false) out.push('-');
      if (allowMultDiv) out.push('×', '÷');
      var ex = opts.exclude || [];
      out = out.filter(function (op) { return ex.indexOf(op) === -1; });
      return out.length ? out : ['+'];
    },
    /** 从候选中随机抽取一个（走 PluginUtil.randInt 统一熵源；PU 缺席时确定性取首元素） */
    pickOperator: function (list) {
      var pu = PU();
      var arr = list && list.length ? list : ['+'];
      if (pu && pu.randInt) return arr[pu.randInt(0, arr.length - 1)];
      return arr[0]; // 兜底：PU 缺席时确定性降级（全仓禁止 Math.random 直调）
    }
  };

  // ============ ChineseUtil：语文 ============
  var TONE_MAP = {
    'ā': 'a', 'á': 'a', 'ǎ': 'a', 'à': 'a',
    'ō': 'o', 'ó': 'o', 'ǒ': 'o', 'ò': 'o',
    'ē': 'e', 'é': 'e', 'ě': 'e', 'è': 'e',
    'ī': 'i', 'í': 'i', 'ǐ': 'i', 'ì': 'i',
    'ū': 'u', 'ú': 'u', 'ǔ': 'u', 'ù': 'u',
    'ǖ': 'ü', 'ǘ': 'ü', 'ǚ': 'ü', 'ǜ': 'ü'
  };

  var ChineseUtil = {
    TONE_MAP: TONE_MAP,

    /** 拼音归一化（自 common.js normPY 迁入）：去声调、去空格、小写、v→ü、去冒号 */
    normPY: function (s) {
      if (!s) return '';
      return String(s).toLowerCase()
        .split('').map(function (c) { return TONE_MAP[c] || c; }).join('')
        .replace(/\s+/g, '')
        .replace(/v/g, 'ü')
        .replace(/[:：]/g, '');
    },

    /** 汉字标准化（自 common.js normHZ 迁入）：去空格去首尾空白 */
    normHZ: function (s) {
      if (!s) return '';
      return String(s).replace(/\s+/g, '').trim();
    }
  };

  // ============ EnglishUtil：英语 ============
  var EnglishUtil = {
    /** 单词大小写归一：小写 + 压缩空白 */
    normalizeWord: function (w) {
      return String(w == null ? '' : w).trim().toLowerCase().replace(/\s+/g, ' ');
    },
    /** 大小写变换：mode 'upper' | 'lower' | 'capitalize'（首字母大写） */
    wordCase: function (word, mode) {
      var s = String(word == null ? '' : word).trim();
      if (!s) return '';
      if (mode === 'upper') return s.toUpperCase();
      if (mode === 'lower') return s.toLowerCase();
      if (mode === 'capitalize') return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
      return s;
    },

    /**
     * 音标处理：去除两侧斜杠与多余空白，保留内部 IPA 符号。
     * '/bʊk/'、'/ bʊk /' 与 'bʊk' 均归一为 'bʊk'。
     */
    normalizePhonetic: function (p) {
      var s = String(p == null ? '' : p).trim();
      s = s.replace(/^\/+/, '').replace(/\/+$/, '').trim();
      return s.replace(/\s+/g, ' ');
    },
    /** 音标等值比较（两侧均归一后比较） */
    samePhonetic: function (a, b) {
      return this.normalizePhonetic(a) === this.normalizePhonetic(b);
    }
  };

  // ============ 导出：科目隔离的全局命名空间 ============
  var SubjectUtils = { version: '1.0', MathUtil: MathUtil, ChineseUtil: ChineseUtil, EnglishUtil: EnglishUtil };

  global.SubjectUtils = SubjectUtils;
  global.MathUtil = MathUtil;
  global.ChineseUtil = ChineseUtil;
  global.EnglishUtil = EnglishUtil;

  if (typeof module !== 'undefined' && module.exports) module.exports = SubjectUtils;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
