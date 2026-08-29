/**
 * shared/storage.js — 本地练习状态持久化（任务 2.2 / 任务 3.2 拆分）
 *
 * 跨会话保存：上次练习设置 / 错题本 / 难度自适应 EMA。零依赖，隐私模式下静默降级。
 * 增量挂载到 window.StorageManager。
 */
(function (global) {
  'use strict';

  var StorageManager = (function () {
    var KEY = 'hw-help-state';
    var VERSION = 2;
    var WRONG_CAP = 50;

    function defaults() {
      return { version: VERSION, lastPractice: null, wrongList: [], difficultyState: {} };
    }
    function storage() {
      try {
        if (typeof localStorage === 'undefined' || !localStorage) return null;
        return localStorage;
      } catch (e) { return null; } // 隐私模式 / 禁用时返回 null
    }
    function load() {
      var s = storage();
      if (!s) return defaults();
      try {
        var raw = s.getItem(KEY);
        if (!raw) return defaults();
        var obj = JSON.parse(raw);
        if (!obj || typeof obj !== 'object') return defaults();
        // 版本不符：旧 schema 的错题本/难度状态已失效，整体作废重建，避免脏缓存累积
        if (obj.version !== VERSION) return defaults();
        if (!Array.isArray(obj.wrongList)) obj.wrongList = [];
        if (!obj.difficultyState || typeof obj.difficultyState !== 'object') obj.difficultyState = {};
        return obj;
      } catch (e) { return defaults(); }
    }
    /** 合并式保存：partial 中的顶层字段覆盖；数组字段（wrongList）整体替换 */
    function save(partial) {
      var s = storage();
      if (!s) return;
      try {
        var cur = load();
        var next = {};
        for (var k in cur) { if (Object.prototype.hasOwnProperty.call(cur, k)) next[k] = cur[k]; }
        for (var p in partial) { if (Object.prototype.hasOwnProperty.call(partial, p)) next[p] = partial[p]; }
        next.version = VERSION;
        if (next.wrongList.length > WRONG_CAP) next.wrongList = next.wrongList.slice(next.wrongList.length - WRONG_CAP);
        s.setItem(KEY, JSON.stringify(next));
      } catch (e) { /* 配额/隐私模式：静默失败 */ }
    }
    function clear() {
      var s = storage();
      if (!s) return;
      try { s.removeItem(KEY); } catch (e) { /* ignore */ }
    }

    // ---- 上层便捷方法 ----
    function saveLastPractice(info) {
      save({ lastPractice: {
        pluginId: info.pluginId, grade: info.grade,
        settings: info.settings || {}, timestamp: info.timestamp || Date.now()
      } });
    }
    /** 记录错题（自动去重同题最新一条，超 50 保留最新） */
    function addWrong(item) {
      var cur = load();
      cur.wrongList.push(item);
      // 按 pluginId+questionIndex 去重，保留最新
      var seen = {};
      var dedup = [];
      for (var i = cur.wrongList.length - 1; i >= 0; i--) {
        var w = cur.wrongList[i];
        var key = (w.pluginId || '') + ':' + (w.questionIndex != null ? w.questionIndex : '') + ':' + (w.signature || '');
        if (seen[key]) continue;
        seen[key] = 1; dedup.unshift(w);
      }
      cur.wrongList = dedup;
      save({ wrongList: cur.wrongList });
    }
    function getWrongList(pluginId) {
      var list = load().wrongList;
      return pluginId ? list.filter(function (w) { return w.pluginId === pluginId; }) : list;
    }
    /** 更新并持久化某插件的难度 EMA 状态，返回最新 currentDelta */
    function updateDifficulty(pluginId, rate) {
      var cur = load();
      var st = cur.difficultyState[pluginId] || { emaRate: null, lastRate: null, currentDelta: 0, timestamp: 0 };
      var r = (typeof rate === 'number' && isFinite(rate)) ? rate : 0;
      var ema = (st.emaRate == null) ? r : (st.emaRate * 0.6 + r * 0.4);
      st.emaRate = ema; st.lastRate = r; st.timestamp = Date.now();
      var rule = (global.App && global.App.Difficulty && global.App.Difficulty.strategyFor)
        ? global.App.Difficulty.strategyFor(pluginId) : null;
      var delta = 0;
      if (rule && typeof rule.apply === 'function') delta = rule.apply({ emaRate: ema, lastRate: r }).delta;
      st.currentDelta = delta;
      cur.difficultyState[pluginId] = st;
      save({ difficultyState: cur.difficultyState });
      return delta;
    }
    function getDifficulty(pluginId) {
      var st = load().difficultyState[pluginId];
      return st || { emaRate: null, lastRate: null, currentDelta: 0, timestamp: 0 };
    }

    return {
      KEY: KEY, VERSION: VERSION, WRONG_CAP: WRONG_CAP,
      load: load, loadState: load, save: save, clear: clear, clearState: clear,
      saveLastPractice: saveLastPractice,
      addWrong: addWrong, getWrongList: getWrongList,
      updateDifficulty: updateDifficulty, getDifficulty: getDifficulty
    };
  })();

  if (typeof global !== 'undefined') global.StorageManager = StorageManager;

  if (typeof module !== 'undefined' && module.exports) module.exports = StorageManager;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
