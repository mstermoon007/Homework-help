/**
 * shared/generator-registry.js — M7-R17 Generator Registry 最终入口
 *
 * 能力（capability）注册表。整个系统只知道「能力」而不知道「具体插件」：
 *   - StrategyEngine 只产出 capability 语义的 QuestionPlan；
 *   - 本注册表负责 capability → generator 记录的解析；
 *   - 具体执行（尤其 legacy 插件）统一经 shared/legacy/plugin-adapter.js。
 *
 * API：
 *   GeneratorRegistry.register(generator)        — 注册一个执行生成器（能力声明 + 可选 generate）
 *   GeneratorRegistry.resolve({subject, capability, questionType}) — 能力解析 → {record, execute?}
 *   GeneratorRegistry.has(capability)            — 是否存在具备该能力的生成器
 *   GeneratorRegistry.list()                     — 全部记录（含 register 注入的执行器）
 *   GeneratorRegistry.records()                  — 只读数据声明（与 M4 generator-registry 一致）
 *
 * 示例（R17）：
 *   GeneratorRegistry.resolve({ subject:'math', capability:'multiplication', questionType:'oral' })
 *
 * 依赖仅限共享层；不 require 任何 plugin 文件。
 */
(function (global) {
  'use strict';

  // 只读数据声明来源（M4-R13 generator-registry：legacy + core 记录）
  var BaseRecords = null;
  function baseRecords() {
    if (!BaseRecords) {
      try {
        BaseRecords = require('./generator/generator-registry.js');
      } catch (e) {
        BaseRecords = (typeof require === 'function') ? null : null;
      }
    }
    return BaseRecords || { all: function () { return []; }, get: function () { return null; } };
  }

  // register() 注入的执行器：id -> generator（含 generate）
  var executables = {};

  /**
   * 注册生成器（含执行能力）。
   * generator 形如 { id, subject, capabilities, questionTypes, generate }；
   * 未带 generate 时视为纯数据声明，仅参与 resolve。
   */
  function register(generator) {
    if (!generator || typeof generator !== 'object') {
      throw new Error('GeneratorRegistry.register(generator) 参数不合法');
    }
    var id = generator.id;
    if (!id) throw new Error('GeneratorRegistry.register: 缺少 generator.id');
    executables[id] = generator;
    return generator;
  }

  /** 全部记录：只读声明表 + register 注入的执行器声明（合并、去重、以 register 为准） */
  function records() {
    var out = baseRecords().all().slice();
    var seen = {};
    out.forEach(function (r) { seen[r.id] = true; });
    Object.keys(executables).forEach(function (id) {
      var g = executables[id];
      var decl = {
        id: id,
        subject: g.subject || null,
        capabilities: (g.capabilities || []).slice(),
        questionTypes: (g.questionTypes || []).slice(),
        knowledgePoints: (g.knowledgePoints || []).slice(),
        scope: g.scope || null,
        version: g.version || 1
      };
      if (!seen[id]) out.push(decl); else { // register 的声明覆盖同名记录
        for (var i = 0; i < out.length; i++) {
          if (out[i].id === id) { out[i] = decl; seen[id] = true; break; }
        }
      }
    });
    return out;
  }

  function list() {
    return records();
  }

  function has(capability) {
    if (!capability) return false;
    return records().some(function (r) {
      return (r.capabilities || []).indexOf(capability) !== -1 ||
        (r.questionTypes || []).indexOf(capability) !== -1;
    });
  }

  /**
   * 按能力解析生成器。capability 语义解析（不感知具体插件）：
   *   resolve({ subject, capability, questionType })
   * 匹配优先级：capability 命中 > questionType 命中 > subject 过滤；
   * 同分取版本更高者。返回 { record, execute }（execute 为 register 注入的生成器，可为空）。
   */
  function resolve(query) {
    if (!query || typeof query !== 'object') return null;
    var subject = query.subject || null;
    var capability = query.capability || null;
    var questionType = query.questionType || null;
    var best = null, bestScore = -1;
    var all = records();
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (subject && r.subject && r.subject !== subject) continue;
      var score = 0;
      if (capability && (r.capabilities || []).indexOf(capability) !== -1) score += 4;
      if (questionType && (r.questionTypes || []).indexOf(questionType) !== -1) score += 2;
      if (score === 0) continue;
      if (score > bestScore || (score === bestScore && (r.version || 1) > ((best && best.version) || 1))) {
        bestScore = score;
        best = r;
      }
    }
    if (!best) return null;
    return {
      record: best,
      execute: executables[best.id] || null
    };
  }

  var API = {
    register: register,
    resolve: resolve,
    has: has,
    list: list,
    records: records
  };

  global.GeneratorRegistry = API;
  if (global.App && typeof global.App === 'object') global.App.GeneratorRegistry = API;

  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  return API;
})(typeof window !== 'undefined' ? window : global);