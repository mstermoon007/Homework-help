/**
 * shared/learner/learner-storage.js — M6-R03 Learner Model Storage
 *
 * - 复用现有 StorageManager（shared/storage.js）持久化；
 *   数据存放在既有状态对象的 learnerState 顶层字段下（唯一 Storage Key：'hw-help-state'.learnerState）。
 * - 数据损坏 → 自动恢复默认状态。
 * - Storage 不可用（隐私模式/localStorage 禁用）→ 降级内存模式。
 *
 * 能力：load / save / getKnowledgePoint / updateKnowledgePoint / clear
 */
(function (global) {
  'use strict';

  var LearnerModel = (typeof LearnerModel !== 'undefined' && global.LearnerModel) ? global.LearnerModel
    : (typeof require !== 'undefined' ? require('./learner-model.js') : null);
  if (!LearnerModel) throw new Error('learner-storage.js 依赖 learner-model.js');

  var StorageManager = null;
  function resolveStorageManager() {
    if (StorageManager) return StorageManager;
    if (typeof global.StorageManager !== 'undefined') { StorageManager = global.StorageManager; return StorageManager; }
    if (typeof require !== 'undefined') {
      try { StorageManager = require('../storage.js'); return StorageManager; }
      catch (e) { StorageManager = false; }
    }
    StorageManager = false;
    return StorageManager;
  }

  function now() { return Date.now(); }

  // ===== 内存模式 =====
  var memoryState = LearnerModel.normalizeLearnerState(null);

  function storageAvailable() {
    var sm = resolveStorageManager();
    if (sm === false) return false;
    if (typeof sm.isAvailable === 'function') return sm.isAvailable() === true;
    return typeof sm.load === 'function';
  }

  /**
   * 读取 LearnerModel 顶层状态（损坏/不存在 → 默认；归一容错）。
   */
  function load() {
    if (!storageAvailable()) {
      return LearnerModel.normalizeLearnerState(memoryState);
    }
    try {
      var base = StorageManager.load || StorageManager.loadState;
      var cur = (typeof base === 'function') ? base() : {};
      var raw = (cur && typeof cur.learnerState === 'object') ? cur.learnerState : null;
      var state = LearnerModel.normalizeLearnerState(raw);
      memoryState = state;
      return state;
    } catch (e) {
      memoryState = LearnerModel.normalizeLearnerState(null);
      return memoryState; // 数据损坏 → 默认状态
    }
  }

  /**
   * 保存顶层状态（Storage 不可用时仅更新内存，下次 load 仍可用内存值）。
   */
  function save(state) {
    state = LearnerModel.normalizeLearnerState(state);
    memoryState = state;
    if (!storageAvailable()) return state;
    try {
      var smSave = StorageManager.save || StorageManager.saveState;
      if (typeof smSave === 'function') smSave({ learnerState: state });
    } catch (e) { /* 配额/隐私模式：静默降级内存 */ }
    return state;
  }

  function getKnowledgePoint(kpId, fallbackDefault) {
    var state = load();
    var kp = LearnerModel.get(state, kpId);
    if (kp) return kp;
    return (fallbackDefault || fallbackDefault === undefined)
      ? LearnerModel.defaultKpState(kpId)
      : null;
  }

  function updateKnowledgePoint(kpId, patch) {
    var state = load();
    if (patch && typeof patch === 'object' && patch.updatedAt == null) {
      // 保持派生字段与 upsert 一致
    }
    state = LearnerModel.upsert(state, kpId, patch);
    return save(state);
  }

  function clear() {
    memoryState = LearnerModel.normalizeLearnerState(null);
    if (!storageAvailable()) return memoryState;
    try {
      var cur = StorageManager.load ? StorageManager.load() : {};
      cur.learnerState = null;
      StorageManager.save({ learnerState: null });
    } catch (e) { /* ignore */ }
    return memoryState;
  }

  var LearnerStorage = {
    KEY_PATH: 'hw-help-state/.learnerState',
    load: load,
    save: save,
    getKnowledgePoint: getKnowledgePoint,
    updateKnowledgePoint: updateKnowledgePoint,
    clear: clear,
    storageAvailable: storageAvailable
  };

  global.LearnerStorage = LearnerStorage;
  if (typeof module !== 'undefined' && module.exports) module.exports = LearnerStorage;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));