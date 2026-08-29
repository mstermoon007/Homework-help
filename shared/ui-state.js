/**
 * shared/ui-state.js — 通用状态 UI 辅助（任务 3.2 拆分）
 *
 * escHtml 与 UIState（空状态 / 错误横幅 HTML 生成）。仅返回 HTML 字符串，不触碰 DOM，色彩走令牌。
 * 增量挂载到 window.App.UIState / window.UIState / window.PluginUtil.escHtml。
 */
(function (global) {
  'use strict';

  // ============ 通用状态 UI 辅助（配套 shared/states.css） ============
  // 题型页（math-types.html / subject-types.html）渲染空状态 / 错误横幅时调用；
  // 仅返回 HTML 字符串，不触碰 DOM，色彩全部走令牌。
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  var UIState = {
    emptyHtml: function (icon, title, desc, actionHtml) {
      return '<div class="empty-state">' +
        '<span class="es-icon">' + escHtml(icon || '') + '</span>' +
        '<div class="est-title">' + escHtml(title || '') + '</div>' +
        (desc ? '<div class="est-desc">' + escHtml(desc) + '</div>' : '') +
        (actionHtml ? '<div class="est-actions">' + actionHtml + '</div>' : '') +
        '</div>';
    },
    bannerHtml: function (icon, title, desc, actionHtml) {
      return '<div class="error-banner">' +
        '<span class="eb-icon">' + escHtml(icon || '') + '</span>' +
        '<div class="eb-body">' +
          '<div class="eb-title">' + escHtml(title || '') + '</div>' +
          (desc ? '<div class="eb-desc">' + escHtml(desc) + '</div>' : '') +
        '</div>' +
        (actionHtml ? '<div class="eb-actions">' + actionHtml + '</div>' : '') +
        '</div>';
    }
  };

  // ============ 增量挂载 ============
  global.App = global.App || {};
  global.PluginUtil = global.PluginUtil || {};
  global.UIState = UIState;
  global.escHtml = escHtml;
  global.App.UIState = UIState;
  global.App.escHtml = escHtml;
  global.PluginUtil.escHtml = escHtml;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIState: UIState, escHtml: escHtml };
  }

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
