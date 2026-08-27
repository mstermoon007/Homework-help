// @ts-check
/// <reference path="../shared/plugin-types.js" />
/**
 * plugins/math-g1-multiplication-table.js — 提前预习（M13 · 一年级乘除法启蒙）
 *
 * 三个子题型（工具栏「题型」chip 切换）：
 *   ① 乘法表    —— 九九乘法表静态表格展示（下三角，无输入）
 *   ② 除法表    —— 除法表静态表格展示（乘法表逆运算，无输入）
 *   ③ 乘除法填空 —— 随机生成乘/除法填空题（在线作答 + 即时批改）
 *
 * 说明：
 *   - 随机数只用 PluginUtil.randInt（crypto 优先），禁止 Math.random()
 *   - 静态表格卡通过 q.render 自定义渲染（无输入框，打印输出干净）
 *   - 填空题走 createMathPlugin 数值比较缺省批改
 *   - 模块：shared/module-catalog.js 的 M13「提前预习」（知识点段小写 m13，预留）
 */
(function (global) {
  'use strict';

  var _PU = typeof PluginUtil !== 'undefined' ? PluginUtil
    : (typeof require !== 'undefined' ? require('../shared/common.js') : null);
  if (!_PU) throw new Error('plugins/math-g1-multiplication-table.js 依赖 shared/common.js（PluginUtil），请先加载');

  /** 九九乘法表（下三角）：c×r=c*r，r 为行 */
  function mulTableHtml() {
    var h = '<table class="preview-table"><tbody>';
    for (var r = 1; r <= 9; r++) {
      h += '<tr>';
      for (var c = 1; c <= r; c++) h += '<td>' + c + '×' + r + '=' + (c * r) + '</td>';
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  /** 除法表（乘法表逆运算，下三角）：(r*c)÷c=r */
  function divTableHtml() {
    var h = '<table class="preview-table"><tbody>';
    for (var r = 1; r <= 9; r++) {
      h += '<tr>';
      for (var c = 1; c <= r; c++) h += '<td>' + (r * c) + '÷' + c + '=' + r + '</td>';
      h += '</tr>';
    }
    return h + '</tbody></table>';
  }

  /** 静态表格卡：无输入框、整卡自定义渲染，批改时视为已掌握（不参与对错） */
  function staticTableCard(title, tableHtml) {
    return {
      type: 'preview-table',
      q: title,
      answer: '',
      check: function () { return true; },
      render: function (idx) {
        return '<div class="question-card preview-table-card" data-index="' + idx + '">' +
          '<div class="q-header"><span class="num">' + (idx + 1) + '</span>&nbsp;&nbsp;&nbsp;&nbsp;' +
          '<span class="q-text">' + title + '</span></div>' +
          tableHtml +
          '<div class="q-hint">📖 预习卡片：读一读、记一记，再切到「乘除法填空」练一练</div>' +
          '</div>';
      }
    };
  }

  /** 乘除法填空：三种形式混合（乘法求积 / 除法求商 / 乘法求因数） */
  function fillQuestions(count) {
    var questions = [];
    for (var i = 0; i < count; i++) {
      var a = _PU.randInt(1, 9);
      var b = _PU.randInt(1, 9);
      var prod = a * b;
      var kind = _PU.randInt(0, 2);
      if (kind === 0) {
        questions.push({ type: 'preview-fill', q: a + ' × ' + b + ' = ', answer: prod, inputType: 'text' });
      } else if (kind === 1) {
        questions.push({ type: 'preview-fill', q: prod + ' ÷ ' + a + ' = ', answer: b, inputType: 'text' });
      } else {
        questions.push({
          type: 'preview-fill',
          q: a + ' × ( ) = ' + prod,
          answer: b,
          inputType: 'text',
          hint: '想：几乘 ' + a + ' 等于 ' + prod + '？'
        });
      }
    }
    return questions;
  }

  var plugin = _PU.createMathPlugin({
    id: 'math-g1-multiplication-table',
    name: '提前预习',
    grades: [1],
    category: 'number',
    moduleId: 'M13',
    description: '乘法表、除法表静态预习 + 乘除法填空随机练习（二年级上册预习）',
    columns: 4,
    printConfig: { pageType: 'math' },

    knowledgePoints: {
      1: ['math-g1-m13-multiplication-table', 'math-g1-m13-division-table', 'math-g1-m13-fill-blank']
    },

    settings: [
      {
        key: 'subtype',
        label: '题型',
        options: [
          { value: 'mul-table', label: '乘法表' },
          { value: 'div-table', label: '除法表' },
          { value: 'fill', label: '乘除法填空' }
        ],
        default: 'mul-table'
      }
    ],

    generateQuestions(opts) {
      var type = opts.subtype || opts.type || 'mul-table';
      if (type === 'mul-table') return [staticTableCard('九九乘法表', mulTableHtml())];
      if (type === 'div-table') return [staticTableCard('除法表', divTableHtml())];
      var count = opts.count || 10;
      return fillQuestions(Math.max(1, Math.min(50, count)));
    },

    meta(opts) {
      var t = opts.subtype || opts.type || 'mul-table';
      return {
        grade: opts.grade || 1,
        count: t === 'fill' ? (opts.count || 10) : 1,
        columns: t === 'fill' ? 4 : 1
      };
    }
  });

  // ============ 导出（与所有插件保持一致，勿改） ============
  global.__currentPlugin = plugin;   // practice.html / dev/plugin-check.html

  if (typeof module !== 'undefined' && module.exports) module.exports = plugin;

})(typeof window !== 'undefined' ? window : globalThis);
