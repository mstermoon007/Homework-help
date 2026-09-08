/**
 * shared/subject-utils.js — 科目专用工具集（任务12）
 *
 * 将科目特有能力从通用 PluginUtil 中分离，减少全局污染与通用层膨胀：
 *   MathUtil      数值范围处理、分数运算、运算符号筛选（数学）
 *
 * 加载与兼容：
 *   - 浏览器：挂载全局 MathUtil / SubjectUtils；
 *     由 common.js 末尾的按需加载逻辑异步注入（失败时 common 内置兼容实现兜底）。
 *   - Node：require('./subject-utils.js') 即得工具对象。
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

  // ============ 导出 ============
  var SubjectUtils = { version: '1.0', MathUtil: MathUtil };

  global.SubjectUtils = SubjectUtils;
  global.MathUtil = MathUtil;

  if (typeof module !== 'undefined' && module.exports) module.exports = SubjectUtils;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
