/**
 * shared/ui-state.js — 通用状态 UI 辅助（任务 3.2 拆分 / P3-R03 扩展）
 *
 * escHtml 与 UIState（空状态 / 错误横幅 / 生成状态 HTML 生成）。仅返回 HTML 字符串，不触碰 DOM，色彩走令牌。
 * 增量挂载到 window.App.UIState / window.UIState / window.PluginUtil.escHtml。
 */
(function (global) {
  'use strict';

  // ============ HTML 转义 ============
  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ============ 通用状态 UI 辅助（配套 shared/states.css） ============
  // 题型页渲染空状态 / 错误横幅 / 生成状态时调用；仅返回 HTML 字符串，色彩全部走令牌。
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
    },

    // P3-R03：统一生成状态 HTML（待生成 / 生成中 / 生成完成 / 生成失败）
    generationHtml: {
      idle: function () {
        return '<div class="generation-state idle"><div class="gs-icon">✏️</div><div class="gs-title">准备就绪</div><div class="gs-desc">点击「生成练习题」开始</div></div>';
      },
      loading: function (msg) {
        return '<div class="generation-state loading"><div class="gs-spinner"></div><div class="gs-title">生成中…</div><div class="gs-desc">' + escHtml(msg || '正在为您生成题目') + '</div></div>';
      },
      success: function (count) {
        return '<div class="generation-state success"><div class="gs-icon">✅</div><div class="gs-title">生成完成</div><div class="gs-desc">共 ' + escHtml(count) + ' 题，开始作答吧</div></div>';
      },
      error: function (msg, actionHtml) {
        return '<div class="generation-state error"><div class="gs-icon">⚠️</div><div class="gs-title">生成失败</div><div class="gs-desc">' + escHtml(msg || '未知错误') + '</div>' +
          (actionHtml ? '<div class="gs-actions">' + actionHtml + '</div>' : '') +
          '</div>';
      }
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
