/**
 * shared/knowledge-bank.js — 全科目知识库（按科目分组，1-6 年级）
 *
 * 数据结构（任务3 按科目分组；本文件为「入口壳」——仅含空组占位、查询方法与分片映射表，
 * 实际数据在 shared/knowledge-{math,cn,en}.js 分片中，加载/装配顺序见下）：
 *   KnowledgeBank = {
 *     math: [ { grade: 1, modules: [...] }, ... ],   // ← 由 knowledge-math.js 装配
 *     cn:   [...],                                   // ← 由 knowledge-cn.js 装配
 *     en:   [...]                                    // ← 由 knowledge-en.js 装配
 *   }
 *
 * 加载与装配：
 *   - 浏览器：<script src="shared/knowledge-bank.js">（入口，先）→ 按科目经
 *     App.PluginLoader.ensureKnowledgeData(subject) 动态注入对应分片（后）；
 *     也可直接静态引入分片 <script>。分片自挂载到 KnowledgeBank 对应属性。
 *   - Node：require 本入口即自动同步 require 三分片完成全量装配（工具链/测试零感知）。
 *   其中每个年级条目：
 *     {
 *       grade: 1,
 *       modules: [
 *         {
 *           moduleId: 'M0',                 // 对应 shared/module-catalog.js 中的题型模块 ID
 *           knowledgePoints: [
 *             { id, name, pluginId, weight, type }
 *             // id：科目前缀三段式 math-g{grade}-{module}-{slug}（cn-/en- 同构）
 *             // weight：抽题比例权重（综合练习按此分配题量），也用于题型选择页排序
 *             // type：推荐传给插件 generate 的 opts.type（细分子题型），省略则用插件默认
 *           ]
 *         }
 *       ]
 *     }
 *
 * 浏览器：<script src="shared/knowledge-bank.js"></script> -> 全局 KnowledgeBank（对象）
 * Node：  const KnowledgeBank = require('./shared/knowledge-bank.js')
 *
 * 便捷查询（挂在对象上；subject 取 'math' | 'cn' | 'en'）：
 *   KnowledgeBank.findGrade(subject, grade)        -> 该科目该年级条目（{grade, modules}）或 null
 *   KnowledgeBank.getEntries(subject, grade)       -> 扁平知识点数组 [{id,name,pluginId,moduleId,weight,type}]
 *   KnowledgeBank.getCoverage(subject, grade?, ids)-> 覆盖统计；grade 省略时聚合该科目全部年级
 *   KnowledgeBank.coverageFromRegistry(...)        -> 同上，但自动从注册表提取覆盖插件 id
 *   KnowledgeBank.suggestNext(subject, ...)        -> 建议下一个开发的插件
 *
 * weight 由旧数据结构中的 importance 映射得到：
 *   importance 5 / 4 -> weight 3，3 / 2 -> weight 2，1 -> weight 1
 *   （importance 代表课时占比/重要度，weight 用于抽题比例，取小量级便于展示与排序）
 */
(function (global) {
  'use strict';

  var KnowledgeBank = {

    // ==================== 数学（math） ====================
    math: [],

    // ==================== 语文（cn） ====================
    // 任务5：一年级 N1/N2 基础知识点初始填充（框架可用性验证）；其余年级/模块逐轮激活
    cn: [],

    // ==================== 英语（en） ====================
    // 任务6：三年级 E1/E2 基础知识点初始填充；E2 暂无专属插件，以 status:'placeholder'
    // 占位（省略 pluginId，覆盖统计如实计为未覆盖），待 english-placeholder 或真实插件落地
    en: []

  };

  // ============ 便捷查询（挂在科目分组对象上） ============

  /** 科目代号规范化：兼容注册表全称（chinese/english）与 ID 前缀缩写（cn/en） */
  var SUBJECT_CANON = { math: 'math', cn: 'cn', en: 'en', chinese: 'cn', english: 'en' };

  /** 任务（按科目拆分）：分片文件路径映射表（站点根相对路径，浏览器动态注入用） */
  KnowledgeBank.SHARDS = {
    math: 'shared/knowledge-math.js',
    cn: 'shared/knowledge-cn.js',
    en: 'shared/knowledge-en.js'
  };
  function canonSubject(s) { return SUBJECT_CANON[s] || s; }

  /** 科目键合法性（未知科目一律返回空结果，不抛错） */
  function groupOf(subject) {
    var g = KnowledgeBank[canonSubject(subject)];
    return Array.isArray(g) ? g : null;
  }

  /** 取某科目某年级条目（{grade, modules}），不存在返回 null */
  KnowledgeBank.findGrade = function (subject, grade) {
    var arr = groupOf(subject);
    if (!arr) return null;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i].grade === grade) return arr[i];
    }
    return null;
  };

  /** 扁平化某年级全部知识点：[{id,name,pluginId,moduleId,weight,type}]；无数据科目返回空数组 */
  KnowledgeBank.getEntries = function (subject, grade) {
    var g = this.findGrade(subject, grade);
    if (!g) return [];
    var out = [];
    (g.modules || []).forEach(function (m) {
      (m.knowledgePoints || []).forEach(function (kp) {
        out.push({
          id: kp.id,
          name: kp.name,
          pluginId: kp.pluginId,
          moduleId: m.moduleId,
          weight: kp.weight,
          type: kp.type
        });
      });
    });
    return out;
  };

  /**
   * 知识点覆盖统计。
   * @param {string} subject 科目（'math' | 'cn' | 'en'）
   * @param {number} [grade] 年级；省略时聚合该科目全部年级（missing 按 id 去重）
   * @param {string[]} [coveredPluginIds] 已注册且适用该年级的插件 id 集合
   * @returns {{total:number,covered:number,ratio:number,missing:Array,next:Object|null}}
   */
  KnowledgeBank.getCoverage = function (subject, grade, coveredPluginIds) {
    if (grade == null) {
      // 聚合模式：合并该科目全部年级的知识点（按 id 去重，保留首次出现）
      var arr = groupOf(subject) || [];
      var seen = {}, merged = [];
      arr.forEach(function (entry) {
        this.getEntries(subject, entry.grade).forEach(function (e) {
          if (!seen[e.id]) { seen[e.id] = true; merged.push(e); }
        });
      }, this);
      return coverageOf(merged, coveredPluginIds);
    }
    return coverageOf(this.getEntries(subject, grade), coveredPluginIds);
  };

  function coverageOf(entries, coveredPluginIds) {
    if (!entries.length) {
      return { total: 0, covered: 0, ratio: 0, missing: [], next: null };
    }
    var set = {};
    (coveredPluginIds || []).forEach(function (id) { set[id] = true; });
    var missing = entries.filter(function (e) { return !set[e.pluginId]; });
    var covered = entries.length - missing.length;
    // 建议下一开发目标：优先给出有明确插件归属的缺失项（占位条目无 pluginId，跳过）
    var nextable = missing.filter(function (e) { return !!e.pluginId; });
    return {
      total: entries.length,
      covered: covered,
      ratio: entries.length ? Math.round(covered / entries.length * 100) : 0,
      missing: missing,
      next: nextable.length ? nextable[0] : null
    };
  }

  /**
   * 从注册表（[{id,subject,grades}]）计算覆盖（自动提取适用插件 id；排除占位插件）。
   * grade 省略时取该科目全部年级并集。
   */
  KnowledgeBank.coverageFromRegistry = function (subject, grade, registry) {
    var cs = canonSubject(subject);
    var ids = [];
    (registry || []).forEach(function (p) {
      if (canonSubject(p.subject) !== cs || p.isPlaceholder || !Array.isArray(p.grades)) return;
      if (grade == null || p.grades.indexOf(grade) !== -1) ids.push(p.id);
    });
    return this.getCoverage(subject, grade, ids);
  };

  /**
   * 按科目懒加载知识库分片（任务 3.1）。
   *  - 浏览器：动态注入对应分片 <script>（路径见 SHARDS），缓存 Promise 防止重复加载；
   *    分片脚本执行后会自挂载到 KnowledgeBank[subject]，onload 时即视为就绪并 resolve(KnowledgeBank[subject])。
   *  - Node：入口在被 require 时已同步装配分片，直接 resolve 已装配数组（工具链零感知）。
   *  - 网络/404 失败不抛错，resolve(null) 让调用方降级（不影响做题）。
   *  - 未选择科目（subject 为空/未知）时 resolve(null)，不发起任何请求。
   * @param {string} subject 'math' | 'cn' | 'en'（兼容 chinese/english 全称）
   * @returns {Promise<Array|null>}
   */
  KnowledgeBank.ensureKnowledgeData = function (subject) {
    var cs = canonSubject(subject);
    if (!cs || !KnowledgeBank.SHARDS || !KnowledgeBank.SHARDS[cs]) {
      return Promise.resolve(null);
    }
    // Node：分片已在入口 require 时同步装配
    if (typeof window === 'undefined') {
      return Promise.resolve(KnowledgeBank[cs]);
    }
    if (!KnowledgeBank.__pendingShards) KnowledgeBank.__pendingShards = {};
    // 正在加载或已加载：复用同一 Promise，杜绝重复请求
    if (KnowledgeBank.__pendingShards[cs]) return KnowledgeBank.__pendingShards[cs];
    // 已挂载数据（如被静态引入过）直接返回
    if (Array.isArray(KnowledgeBank[cs]) && KnowledgeBank[cs].length) {
      return Promise.resolve(KnowledgeBank[cs]);
    }
    var url = KnowledgeBank.SHARDS[cs];
    var p = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = url;
      s.async = false; // 保持顺序，确保分片在后续知识库查询前就绪
      s.onload = function () { resolve(KnowledgeBank[cs]); };
      s.onerror = function () {
        console.error('[knowledge-bank] 分片加载失败:', url);
        resolve(null); // 降级：不因知识库缺失阻塞做题
      };
      (document.head || document.documentElement).appendChild(s);
    });
    KnowledgeBank.__pendingShards[cs] = p;
    return p;
  };

  // ============ M2-09: getCapabilities (只读，不修改查询语义) ============
  KnowledgeBank.getCapabilities = function (kpId) {
    var CapabilityResolver = require('./capability-resolver.js');
    var kp = KnowledgeBank.findLegacy(kpId);
    if (!kp) return null;
    return CapabilityResolver.resolve(kp);
  };
  global.KnowledgeBank = KnowledgeBank;

  // ============ 分片自动装配（Node）：入口被 require 时同步并入三科目数据 ============
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    try { KnowledgeBank.math = require('./knowledge-math.js'); } catch (e) { /* 分片缺失保持空组 */ }
    try { KnowledgeBank.cn = require('./knowledge-cn.js'); } catch (e) { /* 同上 */ }
    try { KnowledgeBank.en = require('./knowledge-en.js'); } catch (e) { /* 同上 */ }
  }


  if (typeof module !== 'undefined' && module.exports) module.exports = global.KnowledgeBank;

})(typeof window !== 'undefined' ? window : globalThis);