'use strict';

/**
 * shared/generation/rollback-manager.js — M9-R01 Rollback Manager
 *
 * 两态回滚机制：仅保存 current / previous
 *   生成成功: previous = current; current = result
 *   回滚: current ↔ previous (仅允许一次，禁止无限历史)
 *   双重回滚拦截: A → B → rollback → B (不可继续回滚 A)
 */

// 内部状态
var _state = {
  current: null,
  previous: null,
  canRollback: false,  // 是否可回滚（需有 previous）
  rollbackUsed: false  // 本轮是否已使用回滚
};

/**
 * 记录生成成功结果，更新双态
 * @param {Object} result 生成结果 { questions, plans, trace, ... }
 * @returns {Object} 更新后的状态
 */
function commit(result) {
  if (!result || typeof result !== 'object') return _state;
  // 成功生成：previous = current; current = result
  _state.previous = _state.current;
  _state.current = cloneResult(result);
  _state.canRollback = !!_state.previous;
  _state.rollbackUsed = false; // 新一轮生成重置回滚标记
  return getStatus();
}

/**
 * 执行回滚：current ↔ previous（仅一次）
 * @returns {Object} { success, rolledBack, current, reason }
 */
function rollback() {
  if (!_state.canRollback) {
    return { success: false, rolledBack: false, current: _state.current, reason: '无可回滚状态（previous 为空）' };
  }
  if (_state.rollbackUsed) {
    return { success: false, rolledBack: false, current: _state.current, reason: '已回滚过，禁止二次回滚（A→B→rollback→B，不可再退 A）' };
  }
  // 交换 current 与 previous
  var temp = _state.current;
  _state.current = _state.previous;
  _state.previous = temp;
  _state.rollbackUsed = true;
  _state.canRollback = false; // 回滚后 previous 变为旧 current，不再允许继续回滚
  return { success: true, rolledBack: true, current: _state.current, reason: '回滚成功' };
}

/**
 * 获取当前状态（不修改）
 * @returns {Object}
 */
function getStatus() {
  return {
    hasCurrent: !!_state.current,
    hasPrevious: !!_state.previous,
    canRollback: _state.canRollback,
    rollbackUsed: _state.rollbackUsed,
    currentPreview: _state.current ? { questionCount: _state.current.questions?.length || 0, planCount: _state.current.plans?.length || 0 } : null,
    previousPreview: _state.previous ? { questionCount: _state.previous.questions?.length || 0, planCount: _state.previous.plans?.length || 0 } : null
  };
}

/**
 * 重置状态（用于新会话/请求）
 */
function reset() {
  _state.current = null;
  _state.previous = null;
  _state.canRollback = false;
  _state.rollbackUsed = false;
}

/**
 * 浅拷贝结果对象（保留关键字段，避免引用共享）
 */
function cloneResult(result) {
  if (!result || typeof result !== 'object') return null;
  var out = {};
  // 仅拷贝必要字段，避免大对象深拷贝
  if (result.questions && Array.isArray(result.questions)) {
    out.questions = result.questions.slice();
  }
  if (result.plans && Array.isArray(result.plans)) {
    out.plans = result.plans.slice();
  }
  if (result.trace && typeof result.trace === 'object') {
    out.trace = Object.assign({}, result.trace);
  }
  if (result.failedPlans && Array.isArray(result.failedPlans)) {
    out.failedPlans = result.failedPlans.slice();
  }
  if (result.items) out.items = result.items;
  if (result.html) out.html = result.html;
  if (result.renderOptions) out.renderOptions = result.renderOptions;
  return out;
}

/**
 * 获取当前结果（用于渲染/输出）
 * @returns {Object|null}
 */
function getCurrent() {
  return _state.current;
}

/**
 * 获取上一版本结果（用于对比/回滚预览）
 * @returns {Object|null}
 */
function getPrevious() {
  return _state.previous;
}

module.exports = {
  commit: commit,
  rollback: rollback,
  getStatus: getStatus,
  reset: reset,
  getCurrent: getCurrent,
  getPrevious: getPrevious
};